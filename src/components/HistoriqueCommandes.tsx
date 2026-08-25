import { useState, useMemo } from 'react'
import { Search, Download, PackageSearch } from 'lucide-react'
import { TRANSPORTEURS } from '../utils/trackingUrl'
import { Commande, Transporteur } from '../types'

type CommandeGroupee = {
  cle: string
  date: string
  references: { nom: string; quantite: number }[]
  transporteur: Transporteur | null
  numeroSuivi: string | null
  // 'en_cours' si au moins une ligne reste à recevoir.
  statut: 'en_cours' | 'receptionnee'
  montant: number | null
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMontant(montant: number | null): string {
  if (montant == null) return '—'
  return montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

function champCsv(valeur: string): string {
  if (/[";\n\r]/.test(valeur)) return `"${valeur.replace(/"/g, '""')}"`
  return valeur
}

function libelleTransporteur(t: Transporteur | null): string {
  if (!t) return '—'
  return TRANSPORTEURS.find((x) => x.value === t)?.label ?? t
}

export default function HistoriqueCommandes({ commandes }: { commandes: Commande[] }) {
  const [filtreReference, setFiltreReference] = useState('')
  const [filtreTransporteur, setFiltreTransporteur] = useState<Transporteur | ''>('')
  const [filtreStatut, setFiltreStatut] = useState<'' | 'en_cours' | 'receptionnee'>('')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')

  const hasFiltresActifs = !!(filtreReference || filtreTransporteur || filtreStatut || filtreDateDebut || filtreDateFin)

  function resetFiltres() {
    setFiltreReference('')
    setFiltreTransporteur('')
    setFiltreStatut('')
    setFiltreDateDebut('')
    setFiltreDateFin('')
  }

  // Les lignes partageant un groupe_id forment une seule commande.
  const groupes = useMemo<CommandeGroupee[]>(() => {
    const parCle = new Map<string, Commande[]>()
    for (const c of commandes) {
      const cle = c.groupe_id ?? c.id
      const liste = parCle.get(cle)
      if (liste) liste.push(c)
      else parCle.set(cle, [c])
    }

    return [...parCle.entries()]
      .map(([cle, lignes]) => {
        const montants = lignes.map((l) => l.montant_paye).filter((m): m is number => m != null)
        return {
          cle,
          date: lignes[0].date_commande,
          references: lignes.map((l) => ({
            nom: l.pieces?.nom ?? '—',
            quantite: l.quantite_commandee,
          })),
          transporteur: lignes[0].transporteur,
          numeroSuivi: lignes[0].numero_suivi,
          statut: lignes.some((l) => l.statut === 'en_cours') ? 'en_cours' as const : 'receptionnee' as const,
          montant: montants.length > 0 ? montants.reduce((s, m) => s + m, 0) : null,
        }
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [commandes])

  const groupesFiltres = useMemo(() => {
    return groupes.filter((g) => {
      if (filtreReference) {
        const q = filtreReference.toLowerCase()
        if (!g.references.some((r) => r.nom.toLowerCase().includes(q))) return false
      }
      if (filtreTransporteur && g.transporteur !== filtreTransporteur) return false
      if (filtreStatut && g.statut !== filtreStatut) return false
      if (filtreDateDebut && new Date(g.date) < new Date(filtreDateDebut)) return false
      if (filtreDateFin) {
        const fin = new Date(filtreDateFin)
        fin.setHours(23, 59, 59, 999)
        if (new Date(g.date) > fin) return false
      }
      return true
    })
  }, [groupes, filtreReference, filtreTransporteur, filtreStatut, filtreDateDebut, filtreDateFin])

  const totalFiltre = useMemo(
    () => groupesFiltres.reduce((s, g) => s + (g.montant ?? 0), 0),
    [groupesFiltres]
  )

  function exporterCsv() {
    const entetes = ['Date de commande', 'Références', 'Quantité totale', 'Transporteur', 'N° de suivi', 'Statut', 'Montant payé HT (€)']
    const lignes = groupesFiltres.map((g) => [
      formatDate(g.date),
      g.references.map((r) => `${r.nom} × ${r.quantite}`).join(' | '),
      String(g.references.reduce((s, r) => s + r.quantite, 0)),
      libelleTransporteur(g.transporteur),
      g.numeroSuivi ?? '',
      g.statut === 'en_cours' ? 'En cours' : 'Réceptionnée',
      g.montant != null ? String(g.montant).replace('.', ',') : '',
    ])
    const contenu = [entetes, ...lignes].map((r) => r.map(champCsv).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `achats-mp-${new Date().toISOString().slice(0, 10)}.csv`
    lien.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="mt-5 bg-white rounded-2xl border border-primary-100 p-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <PackageSearch size={16} className="text-primary-700" />
          <h2 className="text-sm font-bold text-primary-900">Historique des commandes passées</h2>
        </div>
        <button
          onClick={exporterCsv}
          disabled={groupesFiltres.length === 0}
          className="flex items-center gap-2 px-3 py-1.5 bg-white border border-primary-200 hover:bg-primary-50 disabled:opacity-40 text-primary-900 text-xs font-semibold rounded-lg transition-colors"
        >
          <Download size={13} />
          Exporter en CSV
        </button>
      </div>

      {/* Filtres */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Référence
          </label>
          <div className="relative">
            <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
            <input
              type="text"
              value={filtreReference}
              onChange={(e) => setFiltreReference(e.target.value)}
              placeholder="Rechercher…"
              className="w-full pl-8 pr-3 py-2 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Transporteur
          </label>
          <select
            value={filtreTransporteur}
            onChange={(e) => setFiltreTransporteur(e.target.value as Transporteur | '')}
            className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
          >
            <option value="">Tous</option>
            {TRANSPORTEURS.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Statut
          </label>
          <select
            value={filtreStatut}
            onChange={(e) => setFiltreStatut(e.target.value as '' | 'en_cours' | 'receptionnee')}
            className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
          >
            <option value="">Tous</option>
            <option value="en_cours">En cours</option>
            <option value="receptionnee">Réceptionnée</option>
          </select>
        </div>

        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Date de commande
          </label>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-400 flex-shrink-0">Du</span>
            <input
              type="date"
              value={filtreDateDebut}
              onChange={(e) => setFiltreDateDebut(e.target.value)}
              className="flex-1 min-w-0 border border-primary-200 rounded-xl px-2 py-2 text-xs text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-400 flex-shrink-0">Au</span>
            <input
              type="date"
              value={filtreDateFin}
              onChange={(e) => setFiltreDateFin(e.target.value)}
              className="flex-1 min-w-0 border border-primary-200 rounded-xl px-2 py-2 text-xs text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-3 gap-3">
        <p className="text-xs text-primary-500 tabular-nums">
          {groupesFiltres.length} commande{groupesFiltres.length !== 1 ? 's' : ''}
        </p>
        {hasFiltresActifs && (
          <button
            onClick={resetFiltres}
            className="text-xs font-medium text-primary-500 hover:text-primary-900 transition-colors flex-shrink-0"
          >
            Réinitialiser les filtres
          </button>
        )}
      </div>

      {groupesFiltres.length === 0 ? (
        <div className="py-10 border border-dashed border-primary-200 rounded-xl text-center">
          <p className="text-sm text-primary-400 italic">Aucune commande trouvée</p>
        </div>
      ) : (
        <>
          <div className="overflow-hidden rounded-xl border border-primary-100">
            <div className="max-h-[420px] overflow-auto">
              <table className="w-full text-sm">
                <thead className="bg-primary-50 border-b border-primary-100 sticky top-0 z-[1]">
                  <tr>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3 whitespace-nowrap">Date</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Références</th>
                    <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Qté</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Transporteur</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Statut</th>
                    <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3 whitespace-nowrap">Montant HT</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-50">
                  {groupesFiltres.map((g) => (
                    <tr key={g.cle} className="hover:bg-primary-50 transition-colors">
                      <td className="px-3 py-3 text-xs text-primary-500 whitespace-nowrap">{formatDate(g.date)}</td>
                      <td className="px-3 py-3">
                        <div className="max-w-[280px]">
                          {g.references.map((r, i) => (
                            <span key={i} className="text-xs text-primary-800 block truncate" title={r.nom}>
                              {r.nom} <span className="text-primary-400 tabular-nums">× {r.quantite}</span>
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="px-3 py-3 text-right text-xs font-bold text-primary-700 tabular-nums">
                        {g.references.reduce((s, r) => s + r.quantite, 0)}
                      </td>
                      <td className="px-3 py-3 text-xs text-primary-600 whitespace-nowrap">
                        {libelleTransporteur(g.transporteur)}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg whitespace-nowrap ${
                          g.statut === 'en_cours'
                            ? 'bg-alert-100 text-alert-600'
                            : 'bg-success-100 text-success-600'
                        }`}>
                          {g.statut === 'en_cours' ? 'En cours' : 'Reçue'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-right text-sm font-bold text-primary-700 tabular-nums whitespace-nowrap">
                        {formatMontant(g.montant)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-primary-100">
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600">
              Total {hasFiltresActifs ? 'filtré' : ''}
            </span>
            <span className="text-lg font-bold text-primary-900 tabular-nums">{formatMontant(totalFiltre)}</span>
          </div>
        </>
      )}
    </div>
  )
}

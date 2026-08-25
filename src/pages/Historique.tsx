import { useState, useMemo } from 'react'
import { Search, ScrollText, ShoppingBag, Truck, Download } from 'lucide-react'
import { useExpeditions } from '../hooks/useExpeditions'
import { useCommandes } from '../hooks/useCommandes'
import { CATEGORIE_LABEL } from '../utils/categoriesExpedition'

type CategorieLigne = 'vente' | 'achat'

type LigneHistorique = {
  id: string
  date: string
  categorie: CategorieLigne
  // Bouée complète / SAV / Don pour une vente, nom de la pièce pour un achat.
  type: string
  // Positif pour une vente (perçu), négatif pour un achat (dépensé).
  montant: number | null
  detail: string
}

function formatDate(iso: string): string {
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

export default function Historique() {
  const { expeditions, chargement: chargementVentes } = useExpeditions()
  const { commandes, chargement: chargementAchats } = useCommandes()

  const [recherche, setRecherche] = useState('')
  const [filtreCategorie, setFiltreCategorie] = useState<CategorieLigne | ''>('')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')

  const chargement = chargementVentes || chargementAchats

  const hasFiltresActifs = !!(recherche || filtreCategorie || filtreDateDebut || filtreDateFin)

  function resetFiltres() {
    setRecherche('')
    setFiltreCategorie('')
    setFiltreDateDebut('')
    setFiltreDateFin('')
  }

  // Une ligne par vente et par achat de matière première, fusionnées puis
  // triées par date décroissante.
  const lignes = useMemo<LigneHistorique[]>(() => {
    const ventes: LigneHistorique[] = expeditions.map((e) => ({
      id: `vente-${e.id}`,
      date: e.date_commande,
      categorie: 'vente',
      type: e.categorie ? CATEGORIE_LABEL[e.categorie] : '—',
      montant: e.montant_paye,
      detail: `${e.prenom_destinataire} ${e.nom_destinataire}`.trim(),
    }))

    const achats: LigneHistorique[] = commandes.map((c) => ({
      id: `achat-${c.id}`,
      date: c.date_commande,
      categorie: 'achat',
      type: c.pieces?.nom ?? '—',
      montant: c.montant_paye,
      detail: `${c.quantite_commandee} unité${c.quantite_commandee > 1 ? 's' : ''}`,
    }))

    return [...ventes, ...achats].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    )
  }, [expeditions, commandes])

  const lignesFiltrees = useMemo(() => {
    return lignes.filter((l) => {
      if (filtreCategorie && l.categorie !== filtreCategorie) return false
      if (recherche) {
        const q = recherche.toLowerCase()
        if (!l.type.toLowerCase().includes(q) && !l.detail.toLowerCase().includes(q)) return false
      }
      if (filtreDateDebut && new Date(l.date) < new Date(filtreDateDebut)) return false
      if (filtreDateFin) {
        const fin = new Date(filtreDateFin)
        fin.setHours(23, 59, 59, 999)
        if (new Date(l.date) > fin) return false
      }
      return true
    })
  }, [lignes, recherche, filtreCategorie, filtreDateDebut, filtreDateFin])

  const totaux = useMemo(() => {
    let percu = 0
    let depense = 0
    for (const l of lignesFiltrees) {
      if (l.montant == null) continue
      if (l.categorie === 'vente') percu += l.montant
      else depense += l.montant
    }
    return { percu, depense, solde: percu - depense }
  }, [lignesFiltrees])

  function exporterCsv() {
    const entetes = ['Date', 'Catégorie', 'Type', 'Détail', 'Montant perçu HT (€)', 'Montant dépensé HT (€)']
    const donnees = lignesFiltrees.map((l) => [
      formatDate(l.date),
      l.categorie === 'vente' ? 'Vente' : 'Achat MP',
      l.type,
      l.detail,
      l.categorie === 'vente' && l.montant != null ? String(l.montant).replace('.', ',') : '',
      l.categorie === 'achat' && l.montant != null ? String(l.montant).replace('.', ',') : '',
    ])
    const contenu = [entetes, ...donnees].map((r) => r.map(champCsv).join(';')).join('\r\n')
    const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `historique-${new Date().toISOString().slice(0, 10)}.csv`
    lien.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="p-5 md:p-8">

      {/* En-tête */}
      <div className="flex items-end justify-between mb-8 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Historique</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            {lignes.length} mouvement{lignes.length !== 1 ? 's' : ''} — ventes et achats
          </p>
        </div>
        <button
          onClick={exporterCsv}
          disabled={lignesFiltrees.length === 0}
          className="flex items-center gap-2 px-4 py-2.5 bg-white border border-primary-200 hover:bg-primary-50 disabled:opacity-40 text-primary-900 text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
        >
          <Download size={15} />
          <span className="hidden sm:inline">Exporter en CSV</span>
        </button>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center h-40 text-primary-400 text-sm">
          Chargement...
        </div>
      ) : (
        <>
          {/* Totaux */}
          <div className="grid grid-cols-1 sm:grid-cols-3 bg-primary-900 rounded-2xl overflow-hidden mb-6">
            <div className="px-6 py-5 flex flex-col gap-1.5">
              <span className="text-4xl font-bold leading-none tracking-tight tabular-nums text-success-300">
                {totaux.percu.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                <span className="text-xl ml-1">€</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">
                Perçu HT
              </span>
            </div>
            <div className="px-6 py-5 flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-primary-800">
              <span className="text-4xl font-bold leading-none tracking-tight tabular-nums text-alert-400">
                {totaux.depense.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                <span className="text-xl ml-1">€</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">
                Dépensé HT
              </span>
            </div>
            <div className="px-6 py-5 flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-primary-800">
              <span className={`text-4xl font-bold leading-none tracking-tight tabular-nums ${
                totaux.solde >= 0 ? 'text-success-300' : 'text-danger-400'
              }`}>
                {totaux.solde.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
                <span className="text-xl ml-1">€</span>
              </span>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">
                Solde
              </span>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-primary-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <ScrollText size={16} className="text-primary-700" />
              <h2 className="text-sm font-bold text-primary-900">Ventes et achats de matières premières</h2>
            </div>

            {/* Filtres */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Recherche
                </label>
                <div className="relative">
                  <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
                  <input
                    type="text"
                    value={recherche}
                    onChange={(e) => setRecherche(e.target.value)}
                    placeholder="Type, client, pièce…"
                    className="w-full pl-8 pr-3 py-2 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Catégorie
                </label>
                <select
                  value={filtreCategorie}
                  onChange={(e) => setFiltreCategorie(e.target.value as CategorieLigne | '')}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
                >
                  <option value="">Toutes</option>
                  <option value="vente">Vente</option>
                  <option value="achat">Achat MP</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Date
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
                {lignesFiltrees.length} résultat{lignesFiltrees.length !== 1 ? 's' : ''}
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

            {lignesFiltrees.length === 0 ? (
              <div className="py-10 border border-dashed border-primary-200 rounded-xl text-center">
                <p className="text-sm text-primary-400 italic">Aucun mouvement trouvé</p>
              </div>
            ) : (
              <div className="overflow-hidden rounded-xl border border-primary-100">
                <div className="max-h-[560px] overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-primary-50 border-b border-primary-100 sticky top-0 z-[1]">
                      <tr>
                        <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3 whitespace-nowrap">Date</th>
                        <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Catégorie</th>
                        <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Type</th>
                        <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Détail</th>
                        <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3 whitespace-nowrap">Perçu HT</th>
                        <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3 whitespace-nowrap">Dépensé HT</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-primary-50">
                      {lignesFiltrees.map((l) => (
                        <tr key={l.id} className="hover:bg-primary-50 transition-colors">
                          <td className="px-3 py-3 text-xs text-primary-500 whitespace-nowrap">
                            {formatDate(l.date)}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg whitespace-nowrap ${
                              l.categorie === 'vente'
                                ? 'bg-success-100 text-success-600'
                                : 'bg-alert-100 text-alert-600'
                            }`}>
                              {l.categorie === 'vente' ? <ShoppingBag size={10} /> : <Truck size={10} />}
                              {l.categorie === 'vente' ? 'Vente' : 'Achat MP'}
                            </span>
                          </td>
                          <td className="px-3 py-3 font-medium text-primary-900">
                            <div className="max-w-[180px] truncate" title={l.type}>{l.type}</div>
                          </td>
                          <td className="px-3 py-3 text-xs text-primary-600">
                            <div className="max-w-[180px] truncate" title={l.detail}>{l.detail}</div>
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-bold text-success-600 tabular-nums whitespace-nowrap">
                            {l.categorie === 'vente' ? formatMontant(l.montant) : ''}
                          </td>
                          <td className="px-3 py-3 text-right text-sm font-bold text-alert-600 tabular-nums whitespace-nowrap">
                            {l.categorie === 'achat' ? formatMontant(l.montant) : ''}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}

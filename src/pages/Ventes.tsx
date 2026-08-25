import { useState, useMemo } from 'react'
import { Plus, Search, Download, Pencil, Trash2, ShoppingBag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useExpeditions } from '../hooks/useExpeditions'
import { useClients } from '../hooks/useClients'
import ConfirmDialog from '../components/ConfirmDialog'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { drapeauLangue, labelLangue, LANGUES } from '../utils/langues'
import { CATEGORIE_LABEL, CATEGORIE_BADGE, CATEGORIES_TOUTES } from '../utils/categoriesExpedition'
import { ORIGINES_VENTE, ORIGINE_VENTE_LABEL } from '../utils/originesVente'
import ModalVente from '../components/ModalVente'
import GraphiqueCaMensuel from '../components/GraphiqueCaMensuel'
import { Expedition, CategorieExpedition, OrigineVente, Langue } from '../types'

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function formatMontant(montant: number | null): string {
  if (montant == null) return '—'
  return montant.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €'
}

// Échappement CSV : guillemets doublés, champ encadré si nécessaire.
function champCsv(valeur: string): string {
  if (/[";\n\r]/.test(valeur)) return `"${valeur.replace(/"/g, '""')}"`
  return valeur
}

export default function Ventes() {
  const { expeditions, chargement, recharger } = useExpeditions()
  const { clients, recharger: rechargerClients } = useClients()
  const utilisateur = getUtilisateurStored()

  const [modalOuvert, setModalOuvert] = useState<'creer' | 'modifier' | null>(null)
  const [venteEnEdition, setVenteEnEdition] = useState<Expedition | null>(null)
  const [venteASupprimer, setVenteASupprimer] = useState<Expedition | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)

  const [filtreClient, setFiltreClient] = useState('')
  const [filtreLangue, setFiltreLangue] = useState<Langue | ''>('')
  const [filtreCategorie, setFiltreCategorie] = useState<CategorieExpedition | ''>('')
  const [filtreOrigine, setFiltreOrigine] = useState<OrigineVente | ''>('')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')

  const hasFiltresActifs = !!(filtreClient || filtreLangue || filtreCategorie || filtreOrigine || filtreDateDebut || filtreDateFin)

  function resetFiltres() {
    setFiltreClient('')
    setFiltreLangue('')
    setFiltreCategorie('')
    setFiltreOrigine('')
    setFiltreDateDebut('')
    setFiltreDateFin('')
  }

  const ventes = useMemo(
    () => [...expeditions].sort(
      (a, b) => new Date(b.date_commande).getTime() - new Date(a.date_commande).getTime()
    ),
    [expeditions]
  )

  const ventesFiltrees = useMemo(() => {
    return ventes.filter((v) => {
      if (filtreClient) {
        const nomComplet = `${v.prenom_destinataire} ${v.nom_destinataire}`.toLowerCase()
        if (!nomComplet.includes(filtreClient.toLowerCase())) return false
      }
      if (filtreLangue && v.langue !== filtreLangue) return false
      if (filtreCategorie && v.categorie !== filtreCategorie) return false
      if (filtreOrigine && v.origine_vente !== filtreOrigine) return false
      if (filtreDateDebut && new Date(v.date_commande) < new Date(filtreDateDebut)) return false
      if (filtreDateFin) {
        // Borne haute inclusive : on compare à la fin de la journée choisie.
        const fin = new Date(filtreDateFin)
        fin.setHours(23, 59, 59, 999)
        if (new Date(v.date_commande) > fin) return false
      }
      return true
    })
  }, [ventes, filtreClient, filtreLangue, filtreCategorie, filtreOrigine, filtreDateDebut, filtreDateFin])

  const totalFiltre = useMemo(
    () => ventesFiltrees.reduce((somme, v) => somme + (v.montant_paye ?? 0), 0),
    [ventesFiltrees]
  )

  function exporterCsv() {
    const entetes = [
      'Date de commande', 'Prénom', 'Nom', 'Adresse', 'Langue', 'Type de commande',
      'Origine', 'Commentaire origine', 'Type de bateau', 'Montant payé HT (€)',
    ]
    const lignes = ventesFiltrees.map((v) => [
      formatDate(v.date_commande),
      v.prenom_destinataire,
      v.nom_destinataire,
      v.adresse ?? '',
      v.langue ? labelLangue(v.langue) : '',
      v.categorie ? CATEGORIE_LABEL[v.categorie] : '',
      v.origine_vente ? ORIGINE_VENTE_LABEL[v.origine_vente] : '',
      v.commentaire_origine ?? '',
      v.type_bateau ?? '',
      v.montant_paye != null ? String(v.montant_paye).replace('.', ',') : '',
    ])

    const contenu = [entetes, ...lignes]
      .map((ligne) => ligne.map(champCsv).join(';'))
      .join('\r\n')

    // BOM UTF-8 pour qu'Excel ouvre les accents correctement.
    const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `ventes-${new Date().toISOString().slice(0, 10)}.csv`
    lien.click()
    URL.revokeObjectURL(url)
  }

  function ouvrirCreation() {
    setVenteEnEdition(null)
    setModalOuvert('creer')
  }

  function ouvrirModification(v: Expedition) {
    setVenteEnEdition(v)
    setModalOuvert('modifier')
  }

  function apresEnregistrement() {
    recharger()
    rechargerClients()
  }

  // Une vente et son expédition sont la même ligne : la supprimer ici la
  // retire aussi de la page Expédition, quel que soit son statut.
  async function confirmerSuppression() {
    if (!venteASupprimer) return
    setSuppressionEnCours(true)
    try {
      await supabase.from('expeditions').delete().eq('id', venteASupprimer.id)
      recharger()
    } finally {
      setSuppressionEnCours(false)
      setVenteASupprimer(null)
    }
  }

  return (
    <div className="p-5 md:p-8">

      {/* En-tête */}
      <div className="flex items-end justify-between mb-8 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Ventes</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            {ventes.length} vente{ventes.length !== 1 ? 's' : ''} enregistrée{ventes.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={exporterCsv}
            disabled={ventesFiltrees.length === 0}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-primary-200 hover:bg-primary-50 disabled:opacity-40 text-primary-900 text-sm font-semibold rounded-xl transition-colors"
          >
            <Download size={15} />
            <span className="hidden sm:inline">Exporter en CSV</span>
          </button>
          <button
            onClick={ouvrirCreation}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Ajouter une vente</span>
          </button>
        </div>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center h-40 text-primary-400 text-sm">
          Chargement...
        </div>
      ) : (
        <>
        <GraphiqueCaMensuel ventes={ventes} />
        <div className="bg-white rounded-2xl border border-primary-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <ShoppingBag size={16} className="text-primary-700" />
            <h2 className="text-sm font-bold text-primary-900">Historique des ventes</h2>
          </div>

          {/* Filtres */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Client
              </label>
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
                <input
                  type="text"
                  value={filtreClient}
                  onChange={(e) => setFiltreClient(e.target.value)}
                  placeholder="Rechercher…"
                  className="w-full pl-8 pr-3 py-2 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Langue
              </label>
              <select
                value={filtreLangue}
                onChange={(e) => setFiltreLangue(e.target.value as Langue | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Toutes</option>
                {LANGUES.map((l) => (
                  <option key={l.value} value={l.value}>{l.drapeau} {l.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Type de commande
              </label>
              <select
                value={filtreCategorie}
                onChange={(e) => setFiltreCategorie(e.target.value as CategorieExpedition | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Tous</option>
                {CATEGORIES_TOUTES.map((c) => (
                  <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Origine
              </label>
              <select
                value={filtreOrigine}
                onChange={(e) => setFiltreOrigine(e.target.value as OrigineVente | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Toutes</option>
                {ORIGINES_VENTE.map((o) => (
                  <option key={o} value={o}>{ORIGINE_VENTE_LABEL[o]}</option>
                ))}
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
              {ventesFiltrees.length} résultat{ventesFiltrees.length !== 1 ? 's' : ''}
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

          {ventesFiltrees.length === 0 ? (
            <div className="py-10 border border-dashed border-primary-200 rounded-xl text-center">
              <p className="text-sm text-primary-400 italic">Aucune vente trouvée</p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-xl border border-primary-100">
              <div className="max-h-[520px] overflow-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary-50 border-b border-primary-100 sticky top-0 z-[1]">
                    <tr>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3 whitespace-nowrap">Date de commande</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Nom &amp; Prénom</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Adresse</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Langue</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Type</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3">Origine</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3 whitespace-nowrap">Type de bateau</th>
                      <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-3 py-3 whitespace-nowrap">Montant payé HT</th>
                      <th className="px-3 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-50">
                    {ventesFiltrees.map((v) => (
                      <tr key={v.id} className="hover:bg-primary-50 transition-colors">
                        <td className="px-3 py-3 text-xs text-primary-500 whitespace-nowrap">
                          {formatDate(v.date_commande)}
                        </td>
                        <td className="px-3 py-3 font-medium text-primary-900 whitespace-nowrap">
                          {v.prenom_destinataire} {v.nom_destinataire}
                        </td>
                        <td className="px-3 py-3 text-xs text-primary-600">
                          <div className="max-w-[130px] truncate" title={v.adresse ?? ''}>
                            {v.adresse ?? '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap" title={v.langue ? labelLangue(v.langue) : ''}>
                          {v.langue ? drapeauLangue(v.langue) : '—'}
                        </td>
                        <td className="px-3 py-3">
                          {v.categorie ? (
                            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg whitespace-nowrap ${CATEGORIE_BADGE[v.categorie]}`}>
                              {CATEGORIE_LABEL[v.categorie]}
                            </span>
                          ) : (
                            <span className="text-primary-400 text-xs">—</span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs whitespace-nowrap">
                          {v.origine_vente ? (
                            <span className="text-primary-700 font-medium">{ORIGINE_VENTE_LABEL[v.origine_vente]}</span>
                          ) : (
                            <span className="text-primary-400">—</span>
                          )}
                          {v.commentaire_origine && (
                            <span
                              className="block text-primary-400 font-normal max-w-[120px] truncate"
                              title={v.commentaire_origine}
                            >
                              {v.commentaire_origine}
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-3 text-xs text-primary-600">
                          <div className="max-w-[110px] truncate" title={v.type_bateau ?? ''}>
                            {v.type_bateau ?? '—'}
                          </div>
                        </td>
                        <td className="px-3 py-3 text-right text-sm font-bold text-primary-700 tabular-nums whitespace-nowrap">
                          {formatMontant(v.montant_paye)}
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            <button
                              type="button"
                              title="Modifier"
                              onClick={() => ouvrirModification(v)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg text-primary-400 hover:bg-primary-100 hover:text-primary-700 transition-colors flex-shrink-0"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              type="button"
                              title="Supprimer"
                              onClick={() => setVenteASupprimer(v)}
                              className="w-6 h-6 flex items-center justify-center rounded-lg text-primary-400 hover:bg-danger-100 hover:text-danger-600 transition-colors flex-shrink-0"
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </div>

              <div className="flex items-center justify-end gap-3 mt-3 pt-3 border-t border-primary-100">
                <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600">
                  Total {hasFiltresActifs ? 'filtré' : ''} HT
                </span>
                <span className="text-lg font-bold text-primary-900 tabular-nums">
                  {formatMontant(totalFiltre)}
                </span>
              </div>
            </>
          )}
        </div>
        </>
      )}

      {modalOuvert && utilisateur && (
        <ModalVente
          mode={modalOuvert}
          vente={venteEnEdition}
          clients={clients}
          utilisateur={utilisateur}
          onClose={() => { setModalOuvert(null); setVenteEnEdition(null) }}
          onSaved={apresEnregistrement}
        />
      )}

      {venteASupprimer && (
        <ConfirmDialog
          titre="Supprimer la vente"
          message={`Supprimer la vente de ${venteASupprimer.prenom_destinataire} ${venteASupprimer.nom_destinataire} ? Elle disparaîtra aussi de la page Expédition. Le stock déjà décompté ne sera pas restitué.`}
          onCancel={() => !suppressionEnCours && setVenteASupprimer(null)}
          onConfirm={confirmerSuppression}
        />
      )}
    </div>
  )
}

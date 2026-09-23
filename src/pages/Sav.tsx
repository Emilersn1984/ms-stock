import { useState, useMemo } from 'react'
import { Plus, Wrench, Pencil, Trash2, Truck, Handshake, Search, Download } from 'lucide-react'
import { useSav } from '../hooks/useSav'
import { useExpeditions } from '../hooks/useExpeditions'
import { useClients } from '../hooks/useClients'
import { useSousEnsemblesStock } from '../hooks/useSousEnsemblesStock'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { resumeContenu } from '../utils/produitsAtelier'
import { calculerStatsSav } from '../utils/statsSav'
import { supprimerRenvoiSav } from '../utils/expeditionSav'
import { TRANSPORTEURS } from '../utils/trackingUrl'
import ModalSav from '../components/ModalSav'
import ConfirmDialog from '../components/ConfirmDialog'
import { Sav, CauseSav, ModeRecuperation } from '../types'

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function labelTransporteur(valeur: string | null): string {
  return TRANSPORTEURS.find((t) => t.value === valeur)?.label ?? '—'
}

const CAUSE_LABEL: Record<CauseSav, string> = {
  electronique: 'Électronique',
  mecanique: 'Mécanique',
}

const MODE_LABEL: Record<ModeRecuperation, string> = {
  mains_propres: 'Mains propres',
  envoi: 'Envoi',
}

// Échappement CSV : guillemets doublés, champ encadré si nécessaire.
function champCsv(valeur: string): string {
  if (/[";\n\r]/.test(valeur)) return `"${valeur.replace(/"/g, '""')}"`
  return valeur
}

function Compteur({ valeur, libelle, precision, alerte }: {
  valeur: number
  libelle: string
  precision: string
  alerte?: boolean
}) {
  return (
    <div className="px-6 py-5 flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-primary-800 first:border-t-0 sm:first:border-l-0">
      <span className={`text-5xl font-bold leading-none tracking-tight tabular-nums ${alerte ? 'text-danger-400' : 'text-success-300'}`}>
        {valeur}
      </span>
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">{libelle}</span>
      <span className="text-[10px] text-primary-300">{precision}</span>
    </div>
  )
}

export default function SavPage() {
  const { savs, chargement, erreur, recharger, supprimer } = useSav()
  const { expeditions } = useExpeditions()
  const { clients } = useClients()
  const { sousEnsembles } = useSousEnsemblesStock()
  const utilisateur = getUtilisateurStored()

  const [modalOuvert, setModalOuvert] = useState<'creer' | 'modifier' | null>(null)
  const [savEnEdition, setSavEnEdition] = useState<Sav | null>(null)
  const [savASupprimer, setSavASupprimer] = useState<Sav | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)

  const [filtreClient, setFiltreClient] = useState('')
  const [filtreCause, setFiltreCause] = useState<CauseSav | ''>('')
  const [filtreMode, setFiltreMode] = useState<ModeRecuperation | ''>('')
  const [filtreRemboursement, setFiltreRemboursement] = useState<'' | 'oui' | 'non'>('')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')

  const hasFiltresActifs = !!(filtreClient || filtreCause || filtreMode || filtreRemboursement || filtreDateDebut || filtreDateFin)

  function resetFiltres() {
    setFiltreClient('')
    setFiltreCause('')
    setFiltreMode('')
    setFiltreRemboursement('')
    setFiltreDateDebut('')
    setFiltreDateFin('')
  }

  const savsFiltres = useMemo(() => {
    return savs.filter((s) => {
      if (filtreClient) {
        const nomComplet = `${s.prenom_client} ${s.nom_client}`.toLowerCase()
        if (!nomComplet.includes(filtreClient.toLowerCase())) return false
      }
      if (filtreCause && s.cause !== filtreCause) return false
      if (filtreMode && s.mode_recuperation !== filtreMode) return false
      if (filtreRemboursement === 'oui' && !s.remboursement_demande) return false
      if (filtreRemboursement === 'non' && s.remboursement_demande) return false
      // date_sav est un jour civil (yyyy-mm-dd) : comparaison directe de chaînes.
      if (filtreDateDebut && s.date_sav < filtreDateDebut) return false
      if (filtreDateFin && s.date_sav > filtreDateFin) return false
      return true
    })
  }, [savs, filtreClient, filtreCause, filtreMode, filtreRemboursement, filtreDateDebut, filtreDateFin])

  function exporterCsv() {
    const entetes = [
      'Date du SAV', 'Prénom', 'Nom', 'Cause', 'Description', 'Matériel concerné',
      'Remboursement demandé', 'Récupération', 'Transporteur', 'Numéro de suivi', 'Renvoi prévu',
    ]
    const lignes = savsFiltres.map((s) => [
      formatDate(s.date_sav),
      s.prenom_client,
      s.nom_client,
      s.cause ? CAUSE_LABEL[s.cause] : '',
      s.description ?? '',
      resumeContenu(s.materiel, sousEnsembles),
      s.remboursement_demande ? 'Oui' : 'Non',
      s.mode_recuperation ? MODE_LABEL[s.mode_recuperation] : '',
      s.mode_recuperation === 'envoi' ? labelTransporteur(s.transporteur) : '',
      s.numero_suivi ?? '',
      s.date_renvoi_prevue ? formatDate(s.date_renvoi_prevue) : '',
    ])

    const contenu = [entetes, ...lignes]
      .map((ligne) => ligne.map(champCsv).join(';'))
      .join('\r\n')

    // BOM UTF-8 pour qu'Excel ouvre les accents correctement.
    const blob = new Blob(['﻿' + contenu], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const lien = document.createElement('a')
    lien.href = url
    lien.download = `sav-${new Date().toISOString().slice(0, 10)}.csv`
    lien.click()
    URL.revokeObjectURL(url)
  }

  const annee = new Date().getFullYear()
  const stats = useMemo(
    () => calculerStatsSav(expeditions, savs, sousEnsembles, annee),
    [expeditions, savs, sousEnsembles, annee]
  )

  function ouvrirCreation() {
    setSavEnEdition(null)
    setModalOuvert('creer')
  }

  function ouvrirModification(sav: Sav) {
    setSavEnEdition(sav)
    setModalOuvert('modifier')
  }

  // La suppression retire aussi le colis de renvoi s'il n'est pas encore parti.
  async function confirmerSuppression() {
    if (!savASupprimer) return
    setSuppressionEnCours(true)
    try {
      await supprimerRenvoiSav(savASupprimer.expedition_id)
      await supprimer(savASupprimer.id)
    } finally {
      setSuppressionEnCours(false)
      setSavASupprimer(null)
    }
  }

  if (!utilisateur) return null

  return (
    <div className="p-5 md:p-8">

      {/* En-tête */}
      <div className="flex items-end justify-between mb-8 gap-3">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">SAV</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            {savs.length} reprise{savs.length !== 1 ? 's' : ''} déclarée{savs.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={exporterCsv}
            disabled={savsFiltres.length === 0}
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
            <span className="hidden sm:inline">Déclarer un SAV</span>
          </button>
        </div>
      </div>

      {/* Bandeau de compteurs */}
      <div className="grid grid-cols-1 sm:grid-cols-4 bg-primary-900 rounded-2xl overflow-hidden mb-8">
        <Compteur valeur={stats.produitsVendusTotal} libelle="Produits vendus" precision="Depuis le début" />
        <Compteur valeur={stats.savTotal} libelle="SAV" precision="Depuis le début" alerte={stats.savTotal > 0} />
        <Compteur valeur={stats.produitsVendusAnnee} libelle="Produits vendus" precision={`Année ${annee}`} />
        <Compteur valeur={stats.savAnnee} libelle="SAV" precision={`Année ${annee}`} alerte={stats.savAnnee > 0} />
      </div>

      {chargement ? (
        <div className="flex items-center justify-center h-40 text-primary-400 text-sm">Chargement...</div>
      ) : (
        <div className="bg-white rounded-2xl border border-primary-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Wrench size={16} className="text-primary-700" />
            <h2 className="text-sm font-bold text-primary-900">Historique des SAV</h2>
          </div>

          {/* Filtres */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 mb-4">
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
                Cause
              </label>
              <select
                value={filtreCause}
                onChange={(e) => setFiltreCause(e.target.value as CauseSav | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Toutes</option>
                <option value="electronique">Électronique</option>
                <option value="mecanique">Mécanique</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Récupération
              </label>
              <select
                value={filtreMode}
                onChange={(e) => setFiltreMode(e.target.value as ModeRecuperation | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Tous</option>
                <option value="mains_propres">Mains propres</option>
                <option value="envoi">Envoi</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Remboursement
              </label>
              <select
                value={filtreRemboursement}
                onChange={(e) => setFiltreRemboursement(e.target.value as '' | 'oui' | 'non')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Tous</option>
                <option value="oui">Demandé</option>
                <option value="non">Non demandé</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Date du SAV
              </label>
              <div className="flex items-center gap-1.5">
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
              {savsFiltres.length} résultat{savsFiltres.length !== 1 ? 's' : ''}
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

          {erreur && (
            <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm mb-4">{erreur}</p>
          )}

          {savsFiltres.length === 0 ? (
            <div className="py-10 border border-dashed border-primary-200 rounded-xl text-center">
              <p className="text-sm text-primary-400 italic">
                {hasFiltresActifs ? 'Aucun SAV trouvé' : 'Aucune reprise déclarée pour le moment'}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-500 border-b border-primary-100">
                    <th className="text-left font-bold py-2 pr-3">Date</th>
                    <th className="text-left font-bold py-2 pr-3">Client</th>
                    <th className="text-left font-bold py-2 pr-3">Cause</th>
                    <th className="text-left font-bold py-2 pr-3">Matériel</th>
                    <th className="text-left font-bold py-2 pr-3">Remb.</th>
                    <th className="text-left font-bold py-2 pr-3">Récupération</th>
                    <th className="text-left font-bold py-2 pr-3">Renvoi prévu</th>
                    <th className="w-16" />
                  </tr>
                </thead>
                <tbody>
                  {savsFiltres.map((s) => (
                    <tr key={s.id} className="border-b border-primary-50 last:border-b-0 hover:bg-primary-50/50 transition-colors">
                      <td className="py-2.5 pr-3 text-primary-600 whitespace-nowrap">{formatDate(s.date_sav)}</td>
                      <td className="py-2.5 pr-3 font-medium text-primary-900">{s.prenom_client} {s.nom_client}</td>
                      <td className="py-2.5 pr-3">
                        {s.cause ? (
                          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg whitespace-nowrap ${
                            s.cause === 'electronique' ? 'bg-alert-100 text-alert-600' : 'bg-primary-100 text-primary-600'
                          }`}>
                            {CAUSE_LABEL[s.cause]}
                          </span>
                        ) : (
                          <span className="text-primary-300">À compléter</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-primary-700">{resumeContenu(s.materiel, sousEnsembles) || '—'}</td>
                      <td className="py-2.5 pr-3 text-primary-600">{s.remboursement_demande ? 'Oui' : 'Non'}</td>
                      <td className="py-2.5 pr-3 text-primary-600">
                        {s.mode_recuperation === 'envoi' ? (
                          <span className="flex items-center gap-1.5">
                            <Truck size={13} className="text-primary-400 flex-shrink-0" />
                            <span className="truncate">
                              {labelTransporteur(s.transporteur)}
                              {s.numero_suivi ? ` · ${s.numero_suivi}` : ''}
                            </span>
                          </span>
                        ) : s.mode_recuperation === 'mains_propres' ? (
                          <span className="flex items-center gap-1.5">
                            <Handshake size={13} className="text-primary-400 flex-shrink-0" />
                            {MODE_LABEL.mains_propres}
                          </span>
                        ) : (
                          <span className="text-primary-300">À compléter</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-primary-600 whitespace-nowrap">{formatDate(s.date_renvoi_prevue)}</td>
                      <td className="py-2.5">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => ouvrirModification(s)}
                            title="Modifier"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-primary-400 hover:text-primary-700 hover:bg-primary-100 transition-colors"
                          >
                            <Pencil size={14} />
                          </button>
                          <button
                            onClick={() => setSavASupprimer(s)}
                            title="Supprimer"
                            className="w-7 h-7 flex items-center justify-center rounded-lg text-primary-400 hover:text-danger-600 hover:bg-danger-100 transition-colors"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {modalOuvert && (
        <ModalSav
          mode={modalOuvert}
          sav={savEnEdition}
          clients={clients}
          sousEnsembles={sousEnsembles}
          utilisateur={utilisateur}
          onClose={() => { setModalOuvert(null); setSavEnEdition(null) }}
          onSaved={recharger}
        />
      )}

      {savASupprimer && (
        <ConfirmDialog
          titre="Supprimer le SAV"
          message={`Supprimer la reprise de ${savASupprimer.prenom_client} ${savASupprimer.nom_client} ? Le colis de renvoi sera retiré des produits à expédier s'il n'est pas encore parti.`}
          onCancel={() => !suppressionEnCours && setSavASupprimer(null)}
          onConfirm={confirmerSuppression}
        />
      )}
    </div>
  )
}

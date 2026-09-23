import { useState, useMemo } from 'react'
import { Plus, Wrench, Pencil, Trash2, Truck, Handshake } from 'lucide-react'
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
import { Sav } from '../types'

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}

function labelTransporteur(valeur: string | null): string {
  return TRANSPORTEURS.find((t) => t.value === valeur)?.label ?? '—'
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
        <button
          onClick={ouvrirCreation}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Déclarer un SAV</span>
        </button>
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
            <h2 className="text-sm font-bold text-primary-900">Reprises de SAV</h2>
          </div>

          {erreur && (
            <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm mb-4">{erreur}</p>
          )}

          {savs.length === 0 ? (
            <p className="text-sm text-primary-400 italic py-8 text-center">
              Aucune reprise déclarée pour le moment.
            </p>
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
                  {savs.map((s) => (
                    <tr key={s.id} className="border-b border-primary-50 last:border-b-0 hover:bg-primary-50/50 transition-colors">
                      <td className="py-2.5 pr-3 text-primary-600 whitespace-nowrap">{formatDate(s.date_sav)}</td>
                      <td className="py-2.5 pr-3 font-medium text-primary-900">{s.prenom_client} {s.nom_client}</td>
                      <td className="py-2.5 pr-3">
                        <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg whitespace-nowrap ${
                          s.cause === 'electronique' ? 'bg-alert-100 text-alert-600' : 'bg-primary-100 text-primary-600'
                        }`}>
                          {s.cause === 'electronique' ? 'Électronique' : 'Mécanique'}
                        </span>
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
                        ) : (
                          <span className="flex items-center gap-1.5">
                            <Handshake size={13} className="text-primary-400 flex-shrink-0" />
                            Mains propres
                          </span>
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

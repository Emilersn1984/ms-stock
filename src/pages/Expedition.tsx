import { useState, useMemo } from 'react'
import { Truck, ShoppingBag, Search, PackageCheck, Pencil, Trash2, CheckCircle2, Undo2, CalendarClock, Users } from 'lucide-react'
import { useSousEnsemblesStock } from '../hooks/useSousEnsemblesStock'
import { useStock } from '../hooks/useStock'
import { useClients } from '../hooks/useClients'
import { useExpeditions } from '../hooks/useExpeditions'
import { useParametreProduction } from '../hooks/useParametreProduction'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { drapeauLangue } from '../utils/langues'
import { CATEGORIE_LABEL, CATEGORIE_BADGE, CATEGORIES_TOUTES } from '../utils/categoriesExpedition'
import { buildTrackingUrl } from '../utils/trackingUrl'
import { supabase } from '../lib/supabase'
import ModalExpedition from '../components/ModalExpedition'
import ModalClients from '../components/ModalClients'
import ConfirmDialog from '../components/ConfirmDialog'
import { creerOperation } from '../utils/creerOperation'
import { Expedition, CategorieExpedition, Transporteur, Langue } from '../types'

function SectionLabel({ texte, accent, count }: { texte: string; accent?: string; count?: number | string }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <span className={`text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap ${accent ?? 'text-primary-700'}`}>
        {texte}
      </span>
      <div className="flex-1 h-px bg-primary-100" />
      {count !== undefined && (
        <span className="text-xs font-semibold text-primary-600 tabular-nums">{count}</span>
      )}
    </div>
  )
}

function EtatVide({ texte }: { texte: string }) {
  return (
    <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">{texte}</p>
  )
}

function CategorieBadge({ categorie }: { categorie: CategorieExpedition | null }) {
  if (!categorie) return null
  return (
    <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg flex-shrink-0 ${CATEGORIE_BADGE[categorie]}`}>
      {CATEGORIE_LABEL[categorie]}
    </span>
  )
}

function ActionIcon({ icon, onClick, title, className }: { icon: React.ReactNode; onClick: (e: React.MouseEvent) => void; title: string; className?: string }) {
  return (
    <button
      type="button"
      title={title}
      onClick={(e) => { e.stopPropagation(); onClick(e) }}
      className={`w-6 h-6 flex items-center justify-center rounded-lg text-primary-400 hover:bg-primary-100 hover:text-primary-700 transition-colors flex-shrink-0 ${className ?? ''}`}
    >
      {icon}
    </button>
  )
}

function CarteAExpedier({
  expedition,
  onFinaliser,
  onModifier,
  onSupprimer,
}: {
  expedition: Expedition
  onFinaliser: () => void
  onModifier: () => void
  onSupprimer: () => void
}) {
  const nomComplet = `${expedition.prenom_destinataire} ${expedition.nom_destinataire}`.trim() || '—'
  return (
    <div
      onClick={onFinaliser}
      className="w-full flex rounded-xl overflow-hidden border border-primary-100 hover:border-primary-300 transition-colors text-left cursor-pointer"
    >
      <div className={`w-[3px] flex-shrink-0 ${expedition.origine === 'stripe' ? 'bg-primary-500' : 'bg-primary-300'}`} />
      <div className="flex-1 px-3.5 py-2.5 bg-white min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-primary-900 truncate flex-1">{nomComplet}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <CategorieBadge categorie={expedition.categorie} />
            <ActionIcon icon={<Pencil size={12} />} title="Modifier" onClick={onModifier} />
            <ActionIcon icon={<Trash2 size={12} />} title="Supprimer" onClick={onSupprimer} className="hover:!bg-danger-100 hover:!text-danger-600" />
          </div>
        </div>
        <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-primary-500 tabular-nums flex-wrap">
          <span>
            {new Date(expedition.date_commande).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
          {expedition.langue && <span>{drapeauLangue(expedition.langue)}</span>}
          <span className={`flex items-center gap-1 font-medium ${expedition.origine === 'stripe' ? 'text-primary-600' : 'text-primary-400'}`}>
            {expedition.origine === 'stripe' ? <><ShoppingBag size={11} /> Stripe</> : 'Ajout manuel'}
          </span>
          {expedition.date_envoi_previsionnelle && (
            <span className="flex items-center gap-1 text-alert-600 font-medium">
              <CalendarClock size={11} />
              {new Date(expedition.date_envoi_previsionnelle).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function CarteEnvoyee({
  expedition,
  onModifier,
  onSupprimer,
  onReceptionner,
  onRenvoyer,
}: {
  expedition: Expedition
  onModifier?: () => void
  onSupprimer?: () => void
  onReceptionner?: () => void
  onRenvoyer?: () => void
}) {
  const nomComplet = `${expedition.prenom_destinataire} ${expedition.nom_destinataire}`.trim() || '—'
  const urlSuivi = buildTrackingUrl(expedition.transporteur, expedition.numero_suivi)
  return (
    <div className="flex rounded-xl overflow-hidden border border-primary-100">
      <div className={`w-[3px] flex-shrink-0 ${expedition.statut === 'receptionne' ? 'bg-primary-300' : 'bg-success-400'}`} />
      <div className="flex-1 px-3.5 py-2.5 bg-white min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-primary-900 truncate flex-1">{nomComplet}</span>
          <div className="flex items-center gap-1 flex-shrink-0">
            <CategorieBadge categorie={expedition.categorie} />
            {onRenvoyer && expedition.statut === 'envoye' && (
              <ActionIcon icon={<Undo2 size={12} />} title="Renvoyer vers à expédier" onClick={onRenvoyer} />
            )}
            {onModifier && <ActionIcon icon={<Pencil size={12} />} title="Modifier" onClick={onModifier} />}
            {onSupprimer && <ActionIcon icon={<Trash2 size={12} />} title="Supprimer" onClick={onSupprimer} className="hover:!bg-danger-100 hover:!text-danger-600" />}
          </div>
        </div>
        <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-primary-500 tabular-nums flex-wrap">
          <span>
            {expedition.statut === 'receptionne' ? 'Reçu le' : 'Envoyé le'} {(expedition.statut === 'receptionne' ? expedition.date_reception : expedition.date_expedition)
              ? new Date((expedition.statut === 'receptionne' ? expedition.date_reception : expedition.date_expedition) as string).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </span>
          {expedition.version_code && <span className="text-primary-400">{expedition.version_code}</span>}
          {expedition.langue && <span>{drapeauLangue(expedition.langue)}</span>}
          {expedition.numero_serie && (
            <span className="font-bold text-primary-700">{expedition.numero_serie}</span>
          )}
        </div>
        {(urlSuivi || onReceptionner) && (
          <div className="flex items-center gap-2 mt-2">
            {urlSuivi && (
              <a
                href={urlSuivi}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-900 transition-colors px-2.5 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50"
              >
                <Truck size={12} />
                Suivre le colis
              </a>
            )}
            {onReceptionner && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onReceptionner() }}
                className="flex-1 flex items-center justify-center gap-1.5 text-xs font-semibold text-success-600 hover:text-success-700 transition-colors px-2.5 py-1.5 rounded-lg border border-success-300 hover:bg-success-50"
              >
                <CheckCircle2 size={13} />
                Marquer reçu
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default function ExpeditionPage() {
  const { sousEnsembles, chargement: chargementSe } = useSousEnsemblesStock()
  const { pieces, chargement: chargementPieces } = useStock()
  const { clients, chargement: chargementClients, recharger: rechargerClients } = useClients()
  const { aExpedier, envoyees, historique, expeditions, chargement: chargementExp, recharger: rechargerExpeditions } = useExpeditions()
  const { sousEnsembleBoueeId } = useParametreProduction()
  const utilisateur = getUtilisateurStored()

  const [modalOuvert, setModalOuvert] = useState<'creer' | 'finaliser' | 'modifier' | null>(null)
  const [modalClientsOuvert, setModalClientsOuvert] = useState(false)
  const [expeditionEnEdition, setExpeditionEnEdition] = useState<Expedition | null>(null)
  const [expeditionASupprimer, setExpeditionASupprimer] = useState<Expedition | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)

  // Filtres historique
  const [filtreClient, setFiltreClient] = useState('')
  const [filtreTransporteur, setFiltreTransporteur] = useState<Transporteur | ''>('')
  const [filtreVersion, setFiltreVersion] = useState('')
  const [filtreLangue, setFiltreLangue] = useState<Langue | ''>('')
  const [filtreCategorie, setFiltreCategorie] = useState<CategorieExpedition | ''>('')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')

  function ouvrirFinalisation(e: Expedition) {
    setExpeditionEnEdition(e)
    setModalOuvert('finaliser')
  }

  function ouvrirModification(e: Expedition) {
    setExpeditionEnEdition(e)
    setModalOuvert('modifier')
  }

  function fermerModal() {
    setModalOuvert(null)
    setExpeditionEnEdition(null)
  }

  function recharger() {
    rechargerExpeditions()
    rechargerClients()
  }

  async function confirmerSuppression() {
    if (!expeditionASupprimer) return
    setSuppressionEnCours(true)
    try {
      await supabase.from('expeditions').delete().eq('id', expeditionASupprimer.id)
      recharger()
    } finally {
      setSuppressionEnCours(false)
      setExpeditionASupprimer(null)
    }
  }

  async function marquerReceptionnee(e: Expedition) {
    await supabase
      .from('expeditions')
      .update({ statut: 'receptionne', date_reception: new Date().toISOString() })
      .eq('id', e.id)
    recharger()
  }

  async function renvoyerVersAExpedier(e: Expedition) {
    if (!utilisateur) return
    for (const item of e.items ?? []) {
      if (item.sous_ensemble_id) {
        const se = sousEnsembles.find((s) => s.id === item.sous_ensemble_id)
        if (!se) continue
        const nouvelleQuantite = se.quantite + item.quantite
        const { error } = await supabase.from('sous_ensembles').update({ quantite: nouvelleQuantite }).eq('id', se.id)
        if (error) throw error
        await creerOperation({
          type: 'expedition',
          sous_ensemble_id: se.id,
          quantite_avant: se.quantite,
          quantite_apres: nouvelleQuantite,
          delta: item.quantite,
          utilisateur_id: utilisateur.id,
          commentaire: `Retour en attente d'expédition — ${e.prenom_destinataire} ${e.nom_destinataire}`,
        })
      } else if (item.piece_id) {
        const piece = pieces.find((p) => p.id === item.piece_id)
        if (!piece) continue
        const nouvelleQuantite = piece.quantite + item.quantite
        const { error } = await supabase.from('pieces').update({ quantite: nouvelleQuantite }).eq('id', piece.id)
        if (error) throw error
        await creerOperation({
          type: 'expedition',
          piece_id: piece.id,
          quantite_avant: piece.quantite,
          quantite_apres: nouvelleQuantite,
          delta: item.quantite,
          utilisateur_id: utilisateur.id,
          commentaire: `Retour en attente d'expédition — ${e.prenom_destinataire} ${e.nom_destinataire}`,
        })
      }
    }
    await supabase
      .from('expeditions')
      .update({ statut: 'a_expedier', date_expedition: null })
      .eq('id', e.id)
    recharger()
  }

  const versionsDisponibles = useMemo(() => {
    const set = new Set<string>()
    expeditions.forEach((e) => { if (e.version_code) set.add(e.version_code) })
    return Array.from(set).sort()
  }, [expeditions])

  const historiqueFiltre = useMemo(() => {
    return historique.filter((e) => {
      if (filtreClient.trim()) {
        const nom = `${e.prenom_destinataire} ${e.nom_destinataire}`.toLowerCase()
        if (!nom.includes(filtreClient.toLowerCase())) return false
      }
      if (filtreTransporteur && e.transporteur !== filtreTransporteur) return false
      if (filtreVersion && e.version_code !== filtreVersion) return false
      if (filtreLangue && e.langue !== filtreLangue) return false
      if (filtreCategorie && e.categorie !== filtreCategorie) return false
      if (filtreDateDebut && (!e.date_reception || new Date(e.date_reception) < new Date(filtreDateDebut))) return false
      if (filtreDateFin) {
        const fin = new Date(filtreDateFin)
        fin.setHours(23, 59, 59, 999)
        if (!e.date_reception || new Date(e.date_reception) > fin) return false
      }
      return true
    })
  }, [historique, filtreClient, filtreTransporteur, filtreVersion, filtreLangue, filtreCategorie, filtreDateDebut, filtreDateFin])

  const hasFiltresActifs =
    !!filtreClient || !!filtreTransporteur || !!filtreVersion || !!filtreLangue || !!filtreCategorie || !!filtreDateDebut || !!filtreDateFin

  function resetFiltres() {
    setFiltreClient('')
    setFiltreTransporteur('')
    setFiltreVersion('')
    setFiltreLangue('')
    setFiltreCategorie('')
    setFiltreDateDebut('')
    setFiltreDateFin('')
  }

  const chargement = chargementSe || chargementPieces || chargementClients || chargementExp

  if (!utilisateur) {
    return (
      <div className="p-5 md:p-8">
        <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
          Connectez-vous pour gérer les expéditions.
        </p>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8">
      {/* En-tête */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Expédition</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            Gestionnaire d'expéditions
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalClientsOuvert(true)}
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-primary-200 hover:bg-primary-50 active:bg-primary-100 text-primary-900 text-sm font-semibold rounded-xl transition-colors"
          >
            <Users size={15} />
            <span className="hidden sm:inline">Clients</span>
          </button>
        </div>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center h-40 text-primary-400 text-sm">
          Chargement...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Colonne gauche — à expédier */}
          <div className="bg-white rounded-2xl border border-primary-100 p-5 flex flex-col min-h-0">
            <SectionLabel
              texte="À expédier"
              count={aExpedier.length}
              accent={aExpedier.length > 0 ? 'text-alert-600' : 'text-primary-400'}
            />
            {aExpedier.length === 0 ? (
              <EtatVide texte="Aucune commande à expédier" />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[560px]">
                {aExpedier.map((e) => (
                  <CarteAExpedier
                    key={e.id}
                    expedition={e}
                    onFinaliser={() => ouvrirFinalisation(e)}
                    onModifier={() => ouvrirModification(e)}
                    onSupprimer={() => setExpeditionASupprimer(e)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Colonne droite — envoyé */}
          <div className="bg-white rounded-2xl border border-primary-100 p-5 flex flex-col min-h-0">
            <SectionLabel
              texte="Envoyé"
              count={envoyees.length}
              accent={envoyees.length > 0 ? 'text-success-600' : 'text-primary-400'}
            />
            {envoyees.length === 0 ? (
              <EtatVide texte="Aucune expédition envoyée" />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[560px]">
                {envoyees.slice(0, 30).map((e) => (
                  <CarteEnvoyee
                    key={e.id}
                    expedition={e}
                    onModifier={() => ouvrirModification(e)}
                    onSupprimer={() => setExpeditionASupprimer(e)}
                    onReceptionner={() => marquerReceptionnee(e)}
                    onRenvoyer={() => renvoyerVersAExpedier(e)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Historique filtrable */}
      {!chargement && (
        <div className="mt-5 bg-white rounded-2xl border border-primary-100 p-5">
          <div className="flex items-center gap-3 mb-4">
            <PackageCheck size={16} className="text-primary-700" />
            <h2 className="text-sm font-bold text-primary-900">Historique des expéditions</h2>
          </div>

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
                Transporteur
              </label>
              <select
                value={filtreTransporteur}
                onChange={(e) => setFiltreTransporteur(e.target.value as Transporteur | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Tous</option>
                <option value="colissimo">Colissimo</option>
                <option value="chronopost">Chronopost</option>
                <option value="ups">UPS</option>
                <option value="dhl">DHL</option>
                <option value="fedex">FedEx</option>
                <option value="gls">GLS</option>
                <option value="autre">Autre</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Version du code
              </label>
              <select
                value={filtreVersion}
                onChange={(e) => setFiltreVersion(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Toutes</option>
                {versionsDisponibles.map((v) => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
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
                <option value="fr">🇫🇷 Français</option>
                <option value="en">🇬🇧 Anglais</option>
                <option value="de">🇩🇪 Allemand</option>
                <option value="es">🇪🇸 Espagnol</option>
                <option value="it">🇮🇹 Italien</option>
                <option value="nl">🇳🇱 Néerlandais</option>
                <option value="pt">🇵🇹 Portugais</option>
              </select>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Catégorie
              </label>
              <select
                value={filtreCategorie}
                onChange={(e) => setFiltreCategorie(e.target.value as CategorieExpedition | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">Toutes</option>
                {CATEGORIES_TOUTES.map((c) => (
                  <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>
                ))}
              </select>
            </div>

            <div className="lg:col-span-2">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Date de réception
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

          {hasFiltresActifs && (
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-primary-500 tabular-nums">
                {historiqueFiltre.length} résultat{historiqueFiltre.length !== 1 ? 's' : ''}
              </p>
              <button
                onClick={resetFiltres}
                className="text-xs font-medium text-primary-500 hover:text-primary-900 transition-colors"
              >
                Réinitialiser les filtres
              </button>
            </div>
          )}

          {historiqueFiltre.length === 0 ? (
            <EtatVide texte="Aucune expédition trouvée" />
          ) : (
            <div className="hidden md:block overflow-hidden rounded-xl border border-primary-100">
              <div className="max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-primary-50 border-b border-primary-100 sticky top-0 z-[1]">
                    <tr>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-3">Date réception</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-3">Client</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-3">Catégorie</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-3">Version</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-3">Langue</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-3">Transporteur</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-3">N° série</th>
                      <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-4 py-3">Origine</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-primary-50">
                    {historiqueFiltre.map((e) => (
                      <tr key={e.id} className="hover:bg-primary-50 transition-colors">
                        <td className="px-4 py-3 text-xs text-primary-500 whitespace-nowrap">
                          {e.date_reception ? new Date(e.date_reception).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                        </td>
                        <td className="px-4 py-3 font-medium text-primary-900">
                          {e.prenom_destinataire} {e.nom_destinataire}
                        </td>
                        <td className="px-4 py-3">
                          <CategorieBadge categorie={e.categorie} />
                        </td>
                        <td className="px-4 py-3 text-xs text-primary-600">{e.version_code ?? '—'}</td>
                        <td className="px-4 py-3 text-xs">{e.langue ? drapeauLangue(e.langue) : '—'}</td>
                        <td className="px-4 py-3 text-xs text-primary-600 capitalize">{e.transporteur ?? '—'}</td>
                        <td className="px-4 py-3 text-xs font-bold text-primary-700 tabular-nums">{e.numero_serie ?? '—'}</td>
                        <td className="px-4 py-3 text-xs">
                          {e.origine === 'stripe' ? (
                            <span className="flex items-center gap-1 text-primary-600"><ShoppingBag size={11} /> Stripe</span>
                          ) : (
                            <span className="text-primary-400">Manuel</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex justify-end">
                            <ActionIcon
                              icon={<Trash2 size={12} />}
                              title="Supprimer"
                              onClick={() => setExpeditionASupprimer(e)}
                              className="hover:!bg-danger-100 hover:!text-danger-600"
                            />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Cartes mobile */}
          <div className="md:hidden space-y-1.5 max-h-[420px] overflow-y-auto">
            {historiqueFiltre.map((e) => (
              <CarteEnvoyee
                key={e.id}
                expedition={e}
                onModifier={() => ouvrirModification(e)}
                onSupprimer={() => setExpeditionASupprimer(e)}
                onReceptionner={e.statut === 'envoye' ? () => marquerReceptionnee(e) : undefined}
              />
            ))}
          </div>
        </div>
      )}

      {modalOuvert && (
        <ModalExpedition
          mode={modalOuvert}
          expedition={expeditionEnEdition}
          clients={clients}
          sousEnsembles={sousEnsembles}
          pieces={pieces}
          expeditionsEnvoyees={envoyees}
          utilisateur={utilisateur}
          sousEnsembleBoueeId={sousEnsembleBoueeId}
          onClose={fermerModal}
          onSaved={recharger}
        />
      )}

      {modalClientsOuvert && (
        <ModalClients
          clients={clients}
          onClose={() => setModalClientsOuvert(false)}
          onSaved={rechargerClients}
        />
      )}

      {expeditionASupprimer && (
        <ConfirmDialog
          titre="Supprimer la commande"
          message={`Voulez-vous vraiment supprimer la commande de ${expeditionASupprimer.prenom_destinataire} ${expeditionASupprimer.nom_destinataire} ?`}
          onCancel={() => !suppressionEnCours && setExpeditionASupprimer(null)}
          onConfirm={confirmerSuppression}
        />
      )}
    </div>
  )
}

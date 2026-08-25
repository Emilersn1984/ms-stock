import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Check, Pencil, ShoppingBag, CalendarClock } from 'lucide-react'
import { useStock } from '../hooks/useStock'
import { useAlertes } from '../hooks/useAlertes'
import { useUtilisateur } from '../hooks/useUtilisateur'
import { useParametreProduction } from '../hooks/useParametreProduction'
import { useCommandes } from '../hooks/useCommandes'
import { useExpeditions } from '../hooks/useExpeditions'
import { calcAchatsRecommandes } from '../utils/calcAchatsRecommandes'
import type { AchatRecommande } from '../utils/calcAchatsRecommandes'
import { calcMaxFabricableDetail, calcBesoinPieces } from '../utils/calcDisponibilite'
import { drapeauLangue } from '../utils/langues'
import { CATEGORIE_LABEL, CATEGORIE_BADGE } from '../utils/categoriesExpedition'
import { supabase } from '../lib/supabase'
import type { SousEnsemble, AlerteManuelle, Piece, Expedition } from '../types'

type NomEntry = {
  piece_id: string | null
  sous_ensemble_id: string
  sous_ensemble_enfant_id: string | null
  quantite_requise: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateAujourdhui() {
  return new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
}


function formatDateAlerte(dateStr: string) {
  return new Date(dateStr).toLocaleString('fr-FR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  })
}

// ─── KPI Strip ─────────────────────────────────────────────────────────────────

function KpiStrip({
  chiffreAffairesMois, nombreCommandesMois, colisFabricables, pieceLimitante,
}: {
  chiffreAffairesMois: number
  nombreCommandesMois: number
  colisFabricables: number
  pieceLimitante: Piece | null
}) {
  const moisCourant = new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 bg-primary-900 rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-5 flex flex-col gap-1.5">
        <span className="text-5xl font-bold leading-none tracking-tight tabular-nums text-success-300">
          {chiffreAffairesMois.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}
          <span className="text-2xl ml-1">€</span>
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">
          Chiffre d'affaires HT du mois
        </span>
        <span className="text-[10px] text-primary-300 capitalize">{moisCourant}</span>
      </div>

      <div className="px-6 py-5 flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-primary-800">
        <span className="text-5xl font-bold leading-none tracking-tight tabular-nums text-success-300">
          {nombreCommandesMois}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">
          Commandes du mois
        </span>
        <span className="text-[10px] text-primary-300 capitalize">{moisCourant}</span>
      </div>

      <div className="px-6 py-5 flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-primary-800">
        <span className={`text-5xl font-bold leading-none tracking-tight tabular-nums ${
          colisFabricables === 0 ? 'text-danger-400' : 'text-success-300'
        }`}>
          {colisFabricables}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">
          Colis fabricables (stock actuel)
        </span>
        {pieceLimitante && (
          <span className="text-[10px] text-primary-300 truncate">
            Limité par : <span className="font-semibold text-primary-100">{pieceLimitante.nom}</span>
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Réglage production hebdomadaire ───────────────────────────────────────────

// Objectif de vente mensuel. Alimente les achats recommandés, la consommation
// 3D et toute la page Projections.
function ReglageProduction({
  objectifMensuel, onChange, enregistrement,
}: {
  objectifMensuel: number
  onChange: (val: number) => void
  enregistrement: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [valeur, setValeur] = useState(String(objectifMensuel))

  useEffect(() => {
    if (!editing) setValeur(String(objectifMensuel))
  }, [objectifMensuel, editing])

  function valider() {
    const n = parseInt(valeur, 10)
    if (!isNaN(n) && n >= 0) onChange(n)
    else setValeur(String(objectifMensuel))
    setEditing(false)
  }

  return (
    <div className="flex items-center gap-2 mb-6 text-xs text-primary-600">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">
        Objectif de vente
      </span>
      {editing ? (
        <input
          type="number"
          min={0}
          autoFocus
          value={valeur}
          onChange={(e) => setValeur(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === 'Enter') valider()
            if (e.key === 'Escape') { setValeur(String(objectifMensuel)); setEditing(false) }
          }}
          className="w-16 border border-primary-200 rounded-lg px-2 py-1 text-sm font-bold tabular-nums text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          title="Cliquer pour régler la valeur"
          className="flex items-center gap-1.5 font-bold text-primary-900 hover:opacity-70 transition-opacity tabular-nums"
        >
          {objectifMensuel}
          <Pencil size={11} className="text-primary-400" />
        </button>
      )}
      <span>produits vendus par mois</span>
      {enregistrement && <span className="text-primary-400">Enregistrement…</span>}
    </div>
  )
}

// ─── Section label ─────────────────────────────────────────────────────────────

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

// ─── Bento card ────────────────────────────────────────────────────────────────

function BentoCard({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-primary-100 p-5 flex flex-col min-h-0 ${className}`}>
      {children}
    </div>
  )
}

// ─── Alert item ────────────────────────────────────────────────────────────────

function AlerteItem({ alerte, onResoudre }: { alerte: AlerteManuelle; onResoudre: () => void }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-primary-100">
      <div className="w-[3px] flex-shrink-0 bg-alert-500" />
      <div className="flex-1 flex items-start justify-between gap-3 px-3.5 py-3 bg-white">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-primary-900 leading-snug">{alerte.message}</p>
          {alerte.commentaire && (
            <p className="text-xs text-primary-500 mt-1 leading-relaxed">{alerte.commentaire}</p>
          )}
          <p className="text-[10px] text-primary-500 mt-1.5 tabular-nums">
            {formatDateAlerte(alerte.created_at)}
          </p>
        </div>
        <button
          onClick={onResoudre}
          className="flex-shrink-0 flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-success-600 transition-colors mt-0.5 whitespace-nowrap"
        >
          <Check size={11} />
          Résoudre
        </button>
      </div>
    </div>
  )
}

// ─── Achat recommandé row ─────────────────────────────────────────────────────

function AchatRow({ achat, commandee }: { achat: AchatRecommande; commandee?: boolean }) {
  const critique = achat.urgence === 'critique'
  const barColor = commandee ? '#22B84F' : critique ? '#E53535' : '#F97316'
  const badgeClass = commandee
    ? 'bg-success-100 text-success-700'
    : critique
      ? 'bg-danger-100 text-danger-600'
      : 'bg-alert-100 text-alert-600'
  const badgeText = commandee ? 'Commandée' : critique ? 'Rupture estimée' : 'À commander'
  return (
    <div className="flex rounded-xl overflow-hidden border border-primary-100">
      <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: barColor }} />
      <div className="flex-1 px-3.5 py-2.5 bg-white min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-primary-900 truncate flex-1">{achat.piece.nom}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg flex-shrink-0 ${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        {achat.source === 'predictive' ? (
          <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-primary-500 tabular-nums flex-wrap">
            <span>Stock: <span className="font-bold text-primary-700">{achat.piece.quantite}</span></span>
            {achat.consommationHebdo > 0 && (
              <span>Conso: <span className="font-bold">{achat.consommationHebdo}/sem</span></span>
            )}
            {achat.piece.delai_appro != null && (
              <span>Délai: <span className="font-bold">{achat.piece.delai_appro} sem</span></span>
            )}
            <span className={critique ? 'text-danger-600 font-bold' : 'text-alert-600 font-bold'}>
              Restant estimé: {achat.stockRestantEstime}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-primary-500 tabular-nums">
            <span>Stock: <span className="font-bold text-primary-700">{achat.piece.quantite}</span></span>
            <span className="text-primary-400">· seuil statique</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── À expédier row ──────────────────────────────────────────────



function AExpedierRow({ expedition, onClick }: { expedition: Expedition; onClick: () => void }) {
  const nomComplet = `${expedition.prenom_destinataire} ${expedition.nom_destinataire}`.trim() || '—'
  return (
    <div
      onClick={onClick}
      className="w-full flex rounded-xl overflow-hidden border border-primary-100 hover:border-primary-300 transition-colors text-left cursor-pointer"
    >
      <div className={`w-[3px] flex-shrink-0 ${expedition.origine === 'stripe' ? 'bg-primary-500' : 'bg-primary-300'}`} />
      <div className="flex-1 px-3.5 py-2.5 bg-white min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-primary-900 truncate flex-1">{nomComplet}</span>
          {expedition.categorie && (
            <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg flex-shrink-0 ${CATEGORIE_BADGE[expedition.categorie]}`}>
              {CATEGORIE_LABEL[expedition.categorie]}
            </span>
          )}
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

// ─── Sous-ensemble card ─────────────────────────────────────────────────────────

// ─── Etat vide ─────────────────────────────────────────────────────────────────

function EtatVide({ texte }: { texte: string }) {
  return (
    <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">{texte}</p>
  )
}

// ─── Dashboard principal ───────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { utilisateur } = useUtilisateur()
  const estOuvrier = utilisateur?.role === 'ouvrier'
  const { pieces, chargement: chargementStock } = useStock()
  const { alertes: toutesLesAlertes, chargement: chargementAlertes, creerAlerte, resoudreAlerte } = useAlertes()
  const { objectifVenteMensuel, objectifVenteHebdo, definirObjectifVenteMensuel, chargement: chargementParam, enregistrement } = useParametreProduction()
  const { commandesEnCours } = useCommandes()
  const { aExpedier, expeditions, chargement: chargementExpeditions } = useExpeditions()

  const alertes = useMemo(
    () => estOuvrier
      ? toutesLesAlertes.filter((a) => a.utilisateur_id === utilisateur?.id)
      : toutesLesAlertes,
    [toutesLesAlertes, estOuvrier, utilisateur?.id]
  )

  const [sousEnsembles, setSousEnsembles] = useState<SousEnsemble[]>([])
  const [nomenclature, setNomenclature] = useState<NomEntry[]>([])
  const [chargementSE, setChargementSE] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [messageAlerte, setMessageAlerte] = useState('')
  const [commentaireAlerte, setCommentaireAlerte] = useState('')
  const [envoiAlerte, setEnvoiAlerte] = useState(false)

  useEffect(() => {
    async function charger() {
      const [{ data: seData }, { data: nomData }] = await Promise.all([
        supabase.from('sous_ensembles').select('*').order('nom'),
        supabase.from('nomenclature').select('piece_id, sous_ensemble_id, sous_ensemble_enfant_id, quantite_requise'),
      ])
      setSousEnsembles((seData as SousEnsemble[]) ?? [])
      setNomenclature((nomData as NomEntry[]) ?? [])
      setChargementSE(false)
    }
    charger()
  }, [])

  const colisTermineFermeId = useMemo(
    () => sousEnsembles.find((se) => se.nom.trim().toLowerCase() === 'colis terminé fermé')?.id ?? null,
    [sousEnsembles]
  )

  // Besoin en pièces dérivé uniquement de la valeur "Colis terminé fermé / semaine"
  // réglée à la main, via l'explosion complète de la nomenclature (BOM). Les
  // productions réellement déclarées dans l'onglet Fabrication sont ignorées.
  const consommationParPiece = useMemo(
    () => (colisTermineFermeId ? calcBesoinPieces(colisTermineFermeId, objectifVenteHebdo, nomenclature) : new Map<string, number>()),
    [colisTermineFermeId, objectifVenteHebdo, nomenclature]
  )

  const achatsRecommandes = useMemo(
    () => calcAchatsRecommandes(pieces, consommationParPiece),
    [pieces, consommationParPiece]
  )

  const piecesDejaCommandees = useMemo(
    () => new Set(commandesEnCours.map((c) => c.piece_id)),
    [commandesEnCours]
  )

  // Ventes du mois calendaire en cours, d'après la date de commande.
  const { chiffreAffairesMois, nombreCommandesMois } = useMemo(() => {
    const maintenant = new Date()
    const debutMois = new Date(maintenant.getFullYear(), maintenant.getMonth(), 1)
    const duMois = expeditions.filter((e) => new Date(e.date_commande) >= debutMois)
    return {
      chiffreAffairesMois: duMois.reduce((somme, e) => somme + (e.montant_paye ?? 0), 0),
      nombreCommandesMois: duMois.length,
    }
  }, [expeditions])

  const { max: colisFabricables, pieceLimitante } = useMemo(
    () => (colisTermineFermeId ? calcMaxFabricableDetail(colisTermineFermeId, pieces, nomenclature) : { max: 0, pieceLimitante: null }),
    [colisTermineFermeId, pieces, nomenclature]
  )


  const conso3DActive = objectifVenteMensuel > 0

  const chargement = chargementStock || chargementAlertes || chargementSE || chargementParam || chargementExpeditions

  async function handleCreerAlerte() {
    if (!messageAlerte.trim() || !utilisateur) return
    setEnvoiAlerte(true)
    await creerAlerte(messageAlerte.trim(), utilisateur.id, commentaireAlerte)
    setMessageAlerte('')
    setCommentaireAlerte('')
    setEnvoiAlerte(false)
    setShowModal(false)
  }

  function fermerModal() {
    setShowModal(false)
    setMessageAlerte('')
    setCommentaireAlerte('')
  }

  return (
    <div className="p-5 md:p-8">

      {/* En-tête */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mb-1.5 capitalize">
            {dateAujourdhui()}
          </p>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Tableau de bord</h1>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <AlertTriangle size={15} />
          <span className="hidden sm:inline">Créer une alerte</span>
        </button>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center h-40 text-primary-400 text-sm">
          Chargement...
        </div>
      ) : (
        <>
          {/* KPI strip */}
          <KpiStrip
            chiffreAffairesMois={chiffreAffairesMois}
            nombreCommandesMois={nombreCommandesMois}
            colisFabricables={colisFabricables}
            pieceLimitante={pieceLimitante}
          />

          <ReglageProduction
            objectifMensuel={objectifVenteMensuel}
            onChange={definirObjectifVenteMensuel}
            enregistrement={enregistrement}
          />

          {/* Grille bento — achats recommandés et impressions 3D côte à côte */}
          <div className={`grid grid-cols-1 gap-5 mb-6 ${estOuvrier ? '' : 'lg:grid-cols-3'}`}>

            {/* Paquet 2 — Achats recommandés (réduit) — masqué pour les ouvriers */}
            {!estOuvrier && (
              <BentoCard>
                <SectionLabel
                  texte="Achats recommandés"
                  count={achatsRecommandes.length}
                  accent={achatsRecommandes.length > 0 ? 'text-danger-500' : 'text-primary-400'}
                />
                {conso3DActive && (
                  <p className="text-[10px] font-medium text-primary-400 uppercase tracking-wide mb-3">
                    Basé sur la valeur réglée à la main de Colis terminé fermé / semaine
                  </p>
                )}
                {achatsRecommandes.length === 0 ? (
                  <EtatVide texte={
                    !conso3DActive
                      ? 'Colis terminé fermé / semaine réglé à 0 — augmentez la valeur pour activer les prévisions'
                      : 'Aucun achat requis — tous les stocks sont suffisants'
                  } />
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[280px]">
                    {achatsRecommandes.map((a) => (
                      <AchatRow key={a.piece.id} achat={a} commandee={piecesDejaCommandees.has(a.piece.id)} />
                    ))}
                  </div>
                )}
              </BentoCard>
            )}

            {/* Paquet 3 — À expédier (à côté des achats) — masqué pour les ouvriers */}
            {!estOuvrier && (
              <BentoCard>
                <SectionLabel
                  texte="À expédier"
                  count={aExpedier.length}
                  accent={aExpedier.length > 0 ? 'text-alert-500' : 'text-primary-400'}
                />
                <p className="text-[10px] font-medium text-primary-400 uppercase tracking-wide mb-3">
                  Commandes en attente d'expédition
                </p>
                {aExpedier.length === 0 ? (
                  <EtatVide texte="Aucune commande à expédier" />
                ) : (
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[280px]">
                    {aExpedier.map((e) => (
                      <AExpedierRow key={e.id} expedition={e} onClick={() => navigate('/expedition')} />
                    ))}
                  </div>
                )}
              </BentoCard>
            )}

            {/* Paquet 4 — Alertes manuelles (filtrées sur mes alertes pour un ouvrier) */}
            <BentoCard>
              <SectionLabel
                texte={estOuvrier ? 'Mes alertes' : 'Alertes manuelles'}
                count={alertes.length}
                accent={alertes.length > 0 ? 'text-alert-500' : 'text-primary-400'}
              />
              {alertes.length === 0 ? (
                <EtatVide texte={estOuvrier ? 'Aucune alerte envoyée pour le moment' : 'Aucune alerte manuelle active'} />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1 max-h-[280px]">
                  {alertes.map((a) => (
                    <AlerteItem key={a.id} alerte={a} onResoudre={() => resoudreAlerte(a.id)} />
                  ))}
                </div>
              )}
            </BentoCard>
          </div>
        </>
      )}

      {/* Modal créer alerte */}
      {showModal && (
        <div
          className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-alert-100 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={17} className="text-alert-500" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary-900 leading-tight">Créer une alerte manuelle</h2>
                <p className="text-xs text-primary-500 mt-0.5">Visible par tous les utilisateurs</p>
              </div>
            </div>
            <textarea
              className="w-full border border-primary-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              rows={2}
              placeholder="Titre / objet de l'alerte..."
              value={messageAlerte}
              onChange={(e) => setMessageAlerte(e.target.value)}
              autoFocus
              maxLength={500}
            />
            <p className="text-[10px] text-primary-400 text-right mt-1 tabular-nums">{messageAlerte.length}/500</p>
            <textarea
              className="w-full border border-primary-200 rounded-xl p-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 mt-2"
              rows={3}
              placeholder="Commentaire facultatif — contexte, raison..."
              value={commentaireAlerte}
              onChange={(e) => setCommentaireAlerte(e.target.value)}
              maxLength={1000}
            />
            <div className="flex gap-3 mt-5">
              <button
                onClick={fermerModal}
                className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleCreerAlerte}
                disabled={!messageAlerte.trim() || envoiAlerte}
                className="flex-1 py-2.5 bg-alert-500 hover:bg-alert-600 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {envoiAlerte ? 'Envoi...' : "Créer l'alerte"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

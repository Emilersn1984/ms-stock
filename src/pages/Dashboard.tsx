import { useState, useEffect, useMemo } from 'react'
import { AlertTriangle, Check } from 'lucide-react'
import { useStock } from '../hooks/useStock'
import { useAlertes } from '../hooks/useAlertes'
import { useUtilisateur } from '../hooks/useUtilisateur'
import { useProductionHebdo } from '../hooks/useProductionHebdo'
import { calcAchatsRecommandes } from '../utils/calcAchatsRecommandes'
import type { AchatRecommande } from '../utils/calcAchatsRecommandes'
import { calcImpressions3DRecommandees } from '../utils/calcImpressions3D'
import type { Impression3DRecommandee } from '../utils/calcImpressions3D'
import { calcMaxFabricableDetail } from '../utils/calcDisponibilite'
import { supabase } from '../lib/supabase'
import type { SousEnsemble, AlerteManuelle, Piece } from '../types'

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
  productionHebdo, simulationActive, onChangeProduction, onResetProduction,
  boueesFabricables, pieceLimitante, semainesAutonomie,
}: {
  productionHebdo: number
  simulationActive: boolean
  onChangeProduction: (val: number) => void
  onResetProduction: () => void
  boueesFabricables: number
  pieceLimitante: Piece | null
  semainesAutonomie: number | null
}) {
  const [editing, setEditing] = useState(false)
  const [valeur, setValeur] = useState(String(productionHebdo))

  useEffect(() => {
    if (!editing) setValeur(String(productionHebdo))
  }, [productionHebdo, editing])

  function valider() {
    const n = parseInt(valeur, 10)
    if (!isNaN(n) && n >= 0) {
      onChangeProduction(n)
    } else {
      setValeur(String(productionHebdo))
    }
    setEditing(false)
  }

  const fabricableAccent = boueesFabricables === 0
    ? 'text-danger-400'
    : boueesFabricables < productionHebdo
      ? 'text-alert-400'
      : 'text-success-300'

  const autonomieAccent = semainesAutonomie === null
    ? 'text-primary-400'
    : semainesAutonomie < 1
      ? 'text-danger-400'
      : semainesAutonomie < 2
        ? 'text-alert-400'
        : 'text-success-300'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 bg-primary-900 rounded-2xl overflow-hidden mb-8">
      <div className="px-6 py-5 flex flex-col gap-1.5 relative">
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
              if (e.key === 'Escape') { setValeur(String(productionHebdo)); setEditing(false) }
            }}
            className="w-24 bg-transparent text-5xl font-bold leading-none tracking-tight tabular-nums text-success-300 border-b-2 border-success-300 focus:outline-none"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            title="Cliquer pour simuler une production différente"
            className={`text-5xl font-bold leading-none tracking-tight tabular-nums text-left hover:opacity-80 transition-opacity ${
              productionHebdo > 0 ? 'text-success-300' : 'text-primary-400'
            }`}
          >
            {productionHebdo}
          </button>
        )}
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1 flex items-center gap-1.5">
          Bouées méca / semaine
          {simulationActive && (
            <span className="px-1.5 py-0.5 rounded bg-alert-500 text-white text-[9px] normal-case tracking-normal font-bold">
              Simulation
            </span>
          )}
        </span>
        {simulationActive && (
          <button
            type="button"
            onClick={onResetProduction}
            className="absolute top-2 right-2 text-[9px] font-semibold text-primary-300 hover:text-white underline underline-offset-2"
          >
            Réinitialiser
          </button>
        )}
      </div>

      <div className="px-6 py-5 flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-primary-800">
        <span className={`text-5xl font-bold leading-none tracking-tight tabular-nums ${fabricableAccent}`}>
          {boueesFabricables}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">
          Bouées fabricables (stock actuel)
        </span>
        {pieceLimitante && (
          <span className="text-[10px] text-primary-300 truncate">
            Limité par : <span className="font-semibold text-primary-100">{pieceLimitante.nom}</span>
          </span>
        )}
      </div>

      <div className="px-6 py-5 flex flex-col gap-1.5 border-t sm:border-t-0 sm:border-l border-primary-800">
        <span className={`text-5xl font-bold leading-none tracking-tight tabular-nums ${autonomieAccent}`}>
          {semainesAutonomie === null ? '—' : semainesAutonomie.toFixed(1)}
        </span>
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200 mt-1">
          Semaines d'autonomie
        </span>
      </div>
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

function AchatRow({ achat }: { achat: AchatRecommande }) {
  const critique = achat.urgence === 'critique'
  const barColor = critique ? '#E53535' : '#F97316'
  const badgeClass = critique ? 'bg-danger-100 text-danger-600' : 'bg-alert-100 text-alert-600'
  const badgeText = critique ? 'Rupture estimée' : 'À commander'
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

// ─── Impression 3D row ──────────────────────────────────────────────

function ImpressionRow({ impression }: { impression: Impression3DRecommandee }) {
  const critique = impression.urgence === 'critique'
  const barColor = critique ? '#E53535' : '#F97316'
  const badgeClass = critique ? 'bg-danger-100 text-danger-600' : 'bg-alert-100 text-alert-600'
  const badgeText = critique ? 'Impression urgente' : 'À lancer'
  return (
    <div className="flex rounded-xl overflow-hidden border border-primary-100">
      <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: barColor }} />
      <div className="flex-1 px-3.5 py-2.5 bg-white min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <span className="text-sm font-medium text-primary-900 truncate flex-1">{impression.piece.nom}</span>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg flex-shrink-0 ${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        {impression.source === 'predictive' ? (
          <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-primary-500 tabular-nums flex-wrap">
            <span>Stock: <span className="font-bold text-primary-700">{impression.piece.quantite}</span></span>
            {impression.consommationHebdo > 0 && (
              <span>Conso: <span className="font-bold">{impression.consommationHebdo}/sem</span></span>
            )}
            {impression.tempsImpressionHeures != null && (
              <span>Impression: <span className="font-bold">{impression.tempsImpressionHeures}h</span></span>
            )}
            <span className={critique ? 'text-danger-600 font-bold' : 'text-alert-600 font-bold'}>
              Restant estimé: {impression.stockRestantEstime}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 text-xs text-primary-500 tabular-nums">
            <span>Stock: <span className="font-bold text-primary-700">{impression.piece.quantite}</span></span>
            <span className="text-primary-400">· seuil statique</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Sous-ensemble card ─────────────────────────────────────────────────────────

function SousEnsembleCard({ se }: { se: SousEnsemble }) {
  const ok = se.quantite > 0
  return (
    <div className={`rounded-xl p-4 h-24 flex flex-col justify-between ${
      ok ? 'bg-primary-900' : 'bg-white border border-dashed border-primary-200'
    }`}>
      <p className={`text-[11px] font-medium truncate leading-tight ${ok ? 'text-white' : 'text-primary-700'}`}>{se.nom}</p>
      <p className={`text-3xl font-bold leading-none tabular-nums ${
        ok ? 'text-success-300' : 'text-primary-500'
      }`}>{se.quantite}</p>
    </div>
  )
}

// ─── Etat vide ─────────────────────────────────────────────────────────────────

function EtatVide({ texte }: { texte: string }) {
  return (
    <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">{texte}</p>
  )
}

// ─── Dashboard principal ───────────────────────────────────────────────────────

export default function Dashboard() {
  const { utilisateur } = useUtilisateur()
  const { pieces, chargement: chargementStock } = useStock()
  const { alertes, chargement: chargementAlertes, creerAlerte, resoudreAlerte } = useAlertes()
  const { totalHebdo, consommationMoyenne, chargement: chargementProd } = useProductionHebdo()

  const [sousEnsembles, setSousEnsembles] = useState<SousEnsemble[]>([])
  const [nomenclature, setNomenclature] = useState<NomEntry[]>([])
  const [chargementSE, setChargementSE] = useState(true)

  const [showModal, setShowModal] = useState(false)
  const [messageAlerte, setMessageAlerte] = useState('')
  const [commentaireAlerte, setCommentaireAlerte] = useState('')
  const [envoiAlerte, setEnvoiAlerte] = useState(false)

  const [simulationBouees, setSimulationBouees] = useState<number | null>(null)

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

  const boueeMecaId = useMemo(
    () => sousEnsembles.find((se) => se.nom.trim().toLowerCase() === 'bouée méca')?.id ?? null,
    [sousEnsembles]
  )

  // Consommation utilisée pour les calculs: si une simulation manuelle est active,
  // on remplace la quantité "bouée méca" par la valeur saisie, en conservant les
  // autres sous-ensembles inchangés.
  const consommationEffective = useMemo(() => {
    if (simulationBouees === null || !boueeMecaId) return consommationMoyenne
    const autres = consommationMoyenne.filter((c) => c.sous_ensemble_id !== boueeMecaId)
    return [...autres, { sous_ensemble_id: boueeMecaId, nom: 'Bouée méca', quantite: simulationBouees }]
  }, [consommationMoyenne, simulationBouees, boueeMecaId])

  const productionHebdoAffichee = simulationBouees ?? totalHebdo

  const nomenclaturePieces = useMemo(
    () => nomenclature.filter((n): n is NomEntry & { piece_id: string } => n.piece_id !== null),
    [nomenclature]
  )

  const achatsRecommandes = useMemo(
    () => calcAchatsRecommandes(pieces, nomenclaturePieces, consommationEffective),
    [pieces, nomenclaturePieces, consommationEffective]
  )

  const impressions3D = useMemo(
    () => calcImpressions3DRecommandees(pieces, nomenclaturePieces, consommationEffective),
    [pieces, nomenclaturePieces, consommationEffective]
  )

  const { max: boueesFabricables, pieceLimitante } = useMemo(
    () => (boueeMecaId ? calcMaxFabricableDetail(boueeMecaId, pieces, nomenclature) : { max: 0, pieceLimitante: null }),
    [boueeMecaId, pieces, nomenclature]
  )

  const semainesAutonomie = productionHebdoAffichee > 0 ? boueesFabricables / productionHebdoAffichee : null

  const conso3DActive = consommationEffective.some((c) => c.quantite > 0)

  const chargement = chargementStock || chargementAlertes || chargementSE || chargementProd

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
            productionHebdo={productionHebdoAffichee}
            simulationActive={simulationBouees !== null}
            onChangeProduction={setSimulationBouees}
            onResetProduction={() => setSimulationBouees(null)}
            boueesFabricables={boueesFabricables}
            pieceLimitante={pieceLimitante}
            semainesAutonomie={semainesAutonomie}
          />

          {/* Paquet 1 — Sous-ensembles disponibles (juste sous le bandeau KPI) */}
          <BentoCard className="mb-6">
            <SectionLabel
              texte="Sous-ensembles disponibles"
              count={`${sousEnsembles.filter((se) => se.quantite > 0).length} / ${sousEnsembles.length}`}
            />
            {sousEnsembles.length === 0 ? (
              <EtatVide texte="Aucun sous-ensemble défini" />
            ) : (
              <div className="overflow-y-auto max-h-[260px] pr-1">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {[...sousEnsembles]
                    .sort((a, b) => b.quantite - a.quantite)
                    .map((se) => <SousEnsembleCard key={se.id} se={se} />)}
                </div>
              </div>
            )}
          </BentoCard>

          {/* Grille bento — achats recommandés et impressions 3D côte à côte */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 mb-6">

            {/* Paquet 2 — Achats recommandés (réduit) */}
            <BentoCard>
              <SectionLabel
                texte="Achats recommandés"
                count={achatsRecommandes.length}
                accent={achatsRecommandes.length > 0 ? 'text-danger-500' : 'text-primary-400'}
              />
              {conso3DActive && (
                <p className="text-[10px] font-medium text-primary-400 uppercase tracking-wide mb-3">
                  Basé sur la plus forte production entre cette semaine et la précédente
                </p>
              )}
              {achatsRecommandes.length === 0 ? (
                <EtatVide texte={
                  !conso3DActive
                    ? 'Aucune production récente déclarée — déclarez une fabrication pour activer les prévisions'
                    : 'Aucun achat requis — tous les stocks sont suffisants'
                } />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[280px]">
                  {achatsRecommandes.map((a) => (
                    <AchatRow key={a.piece.id} achat={a} />
                  ))}
                </div>
              )}
            </BentoCard>

            {/* Paquet 3 — File d'impression 3D (à côté des achats) */}
            <BentoCard>
              <SectionLabel
                texte="File d'impression 3D"
                count={impressions3D.length}
                accent={impressions3D.length > 0 ? 'text-alert-500' : 'text-primary-400'}
              />
              <p className="text-[10px] font-medium text-primary-400 uppercase tracking-wide mb-3">
                Pièces produites en interne — triées par urgence
              </p>
              {impressions3D.length === 0 ? (
                <EtatVide texte="Aucune impression 3D urgente — tous les stocks sont suffisants" />
              ) : (
                <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[280px]">
                  {impressions3D.map((imp) => (
                    <ImpressionRow key={imp.piece.id} impression={imp} />
                  ))}
                </div>
              )}
            </BentoCard>

            {/* Paquet 4 — Alertes manuelles */}
            <BentoCard>
              <SectionLabel
                texte="Alertes manuelles"
                count={alertes.length}
                accent={alertes.length > 0 ? 'text-alert-500' : 'text-primary-400'}
              />
              {alertes.length === 0 ? (
                <EtatVide texte="Aucune alerte manuelle active" />
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

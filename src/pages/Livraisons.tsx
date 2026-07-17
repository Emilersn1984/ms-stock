import { useState, useEffect, useMemo } from 'react'
import { Truck, Check, AlertCircle, Plus, PackageSearch, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStock } from '../hooks/useStock'
import { useCommandes } from '../hooks/useCommandes'
import { useProductionHebdo } from '../hooks/useProductionHebdo'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { creerOperation } from '../utils/creerOperation'
import { calcAchatsRecommandes } from '../utils/calcAchatsRecommandes'
import type { AchatRecommande } from '../utils/calcAchatsRecommandes'
import { buildTrackingUrl, TRANSPORTEURS } from '../utils/trackingUrl'
import ModalNouvelleCommande from '../components/ModalNouvelleCommande'
import { Piece, Commande, Transporteur } from '../types'

type NomEntry = {
  piece_id: string | null
  sous_ensemble_id: string
  sous_ensemble_enfant_id: string | null
  quantite_requise: number
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

function EtatVide({ texte }: { texte: string }) {
  return (
    <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">{texte}</p>
  )
}

// ─── Achat recommandé row (cliquable) ──────────────────────────────────────────

function AchatRow({ achat, onCommander }: { achat: AchatRecommande; onCommander: () => void }) {
  const critique = achat.urgence === 'critique'
  const barColor = critique ? '#E53535' : '#F97316'
  const badgeClass = critique ? 'bg-danger-100 text-danger-600' : 'bg-alert-100 text-alert-600'
  const badgeText = critique ? 'Rupture estimée' : 'À commander'
  return (
    <button
      type="button"
      onClick={onCommander}
      className="w-full flex rounded-xl overflow-hidden border border-primary-100 hover:border-primary-300 transition-colors text-left"
    >
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
    </button>
  )
}

// ─── Carte commande en cours ────────────────────────────────────────────────────

function CommandeCard({
  commande,
  onMarquerRecu,
  onMettreAJourSuivi,
  chargement,
}: {
  commande: Commande
  onMarquerRecu: () => void
  onMettreAJourSuivi: (transporteur: Transporteur, numeroSuivi: string) => Promise<void>
  chargement: boolean
}) {
  const suiviManquant = !commande.numero_suivi
  const urlSuivi = buildTrackingUrl(commande.transporteur, commande.numero_suivi)

  const [editionSuivi, setEditionSuivi] = useState(false)
  const [transporteurSaisi, setTransporteurSaisi] = useState<Transporteur | ''>(commande.transporteur ?? '')
  const [numeroSaisi, setNumeroSaisi] = useState(commande.numero_suivi ?? '')
  const [enregistrement, setEnregistrement] = useState(false)

  async function validerSuivi() {
    if (!transporteurSaisi || !numeroSaisi.trim()) return
    setEnregistrement(true)
    try {
      await onMettreAJourSuivi(transporteurSaisi, numeroSaisi.trim())
      setEditionSuivi(false)
    } finally {
      setEnregistrement(false)
    }
  }

  return (
    <div className="flex rounded-xl overflow-hidden border border-primary-100">
      <div className="w-[3px] flex-shrink-0 bg-success-400" />
      <div className="flex-1 px-3.5 py-3 bg-white min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-semibold text-primary-900 truncate">
              {commande.pieces?.nom ?? '—'}
            </span>
            {suiviManquant && (
              <span title="Numéro de suivi non renseigné" className="flex-shrink-0">
                <AlertCircle size={13} className="text-danger-500" />
              </span>
            )}
          </div>
          <span className="text-xs font-bold tabular-nums text-primary-700 flex-shrink-0">
            × {commande.quantite_commandee}
          </span>
        </div>

        <div className="flex items-center gap-x-3 gap-y-0.5 text-xs text-primary-500 tabular-nums flex-wrap mb-2.5">
          <span>Commandé le <span className="font-medium text-primary-700">
            {new Date(commande.date_commande).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
          </span></span>
          {commande.date_livraison_prevue && (
            <span>Livraison prévue <span className="font-medium text-primary-700">
              {new Date(commande.date_livraison_prevue).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
            </span></span>
          )}
        </div>

        {editionSuivi ? (
          <div className="flex items-center gap-1.5 mb-1">
            <select
              value={transporteurSaisi}
              onChange={(e) => setTransporteurSaisi(e.target.value as Transporteur | '')}
              className="border border-primary-200 rounded-lg px-2 py-1.5 text-xs text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 bg-white"
            >
              <option value="">Transporteur…</option>
              {TRANSPORTEURS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={numeroSaisi}
              onChange={(e) => setNumeroSaisi(e.target.value)}
              placeholder="N° de suivi"
              autoFocus
              className="flex-1 min-w-0 border border-primary-200 rounded-lg px-2 py-1.5 text-xs text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
            <button
              type="button"
              onClick={validerSuivi}
              disabled={enregistrement || !transporteurSaisi || !numeroSaisi.trim()}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg bg-primary-900 text-white disabled:opacity-40"
            >
              <Check size={12} />
            </button>
            <button
              type="button"
              onClick={() => setEditionSuivi(false)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg border border-primary-200 text-primary-500"
            >
              <X size={12} />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            {urlSuivi && (
              <a
                href={urlSuivi}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-medium text-primary-600 hover:text-primary-900 transition-colors px-2.5 py-1.5 rounded-lg border border-primary-200 hover:bg-primary-50"
              >
                <Truck size={12} />
                Suivre le colis
              </a>
            )}
            {suiviManquant && (
              <button
                type="button"
                onClick={() => setEditionSuivi(true)}
                className="flex items-center gap-1.5 text-xs font-medium text-danger-600 hover:text-danger-700 transition-colors px-2.5 py-1.5 rounded-lg border border-danger-200 hover:bg-danger-100"
              >
                <PackageSearch size={12} />
                Ajouter le suivi
              </button>
            )}
            <button
              type="button"
              onClick={onMarquerRecu}
              disabled={chargement}
              className="flex items-center gap-1.5 text-xs font-semibold text-success-600 hover:text-success-700 transition-colors px-2.5 py-1.5 rounded-lg border border-success-300 hover:bg-success-50 disabled:opacity-40"
            >
              <Check size={12} />
              Marquer reçu
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Carte commande reçue ────────────────────────────────────────────────────

function CommandeRecueRow({ commande }: { commande: Commande }) {
  return (
    <div className="flex rounded-xl overflow-hidden border border-primary-100">
      <div className="w-[3px] flex-shrink-0 bg-primary-300" />
      <div className="flex-1 flex items-center justify-between gap-3 px-3.5 py-2.5 bg-white min-w-0">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-sm font-medium text-primary-900 truncate">
            {commande.pieces?.nom ?? '—'}
          </span>
          <span className="text-xs font-bold tabular-nums text-primary-600 flex-shrink-0">
            × {commande.quantite_commandee}
          </span>
        </div>
        <span className="text-xs text-primary-500 tabular-nums flex-shrink-0">
          Reçue le{' '}
          <span className="font-medium text-primary-700">
            {commande.date_reception
              ? new Date(commande.date_reception).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'}
          </span>
        </span>
      </div>
    </div>
  )
}

// ─── Page principale ────────────────────────────────────────────────────────────

export default function Livraisons() {
  const { pieces, chargement: chargementStock, recharger: rechargerPieces } = useStock()
  const { commandesEnCours, commandesRecues, chargement: chargementCommandes, recharger: rechargerCommandes } = useCommandes()
  const { consommationMoyenne, chargement: chargementProd } = useProductionHebdo()
  const utilisateur = getUtilisateurStored()

  const [nomenclature, setNomenclature] = useState<NomEntry[]>([])
  const [chargementNom, setChargementNom] = useState(true)

  const [modalOuvert, setModalOuvert] = useState(false)
  const [pieceModal, setPieceModal] = useState<Piece | null>(null)
  const [receptionEnCours, setReceptionEnCours] = useState<string | null>(null)
  const [erreurReception, setErreurReception] = useState<string | null>(null)

  useEffect(() => {
    async function charger() {
      const { data } = await supabase
        .from('nomenclature')
        .select('piece_id, sous_ensemble_id, sous_ensemble_enfant_id, quantite_requise')
      setNomenclature((data as NomEntry[]) ?? [])
      setChargementNom(false)
    }
    charger()
  }, [])

  const nomenclaturePieces = useMemo(
    () => nomenclature.filter((n): n is NomEntry & { piece_id: string } => n.piece_id !== null),
    [nomenclature]
  )

  const piecesDejaCommandees = useMemo(
    () => new Set(commandesEnCours.map((c) => c.piece_id)),
    [commandesEnCours]
  )

  const achatsRecommandes = useMemo(
    () => calcAchatsRecommandes(pieces, nomenclaturePieces, consommationMoyenne)
      .filter((a) => !piecesDejaCommandees.has(a.piece.id)),
    [pieces, nomenclaturePieces, consommationMoyenne, piecesDejaCommandees]
  )

  function ouvrirModal(piece: Piece | null) {
    setPieceModal(piece)
    setModalOuvert(true)
  }

  function fermerModal() {
    setModalOuvert(false)
    setPieceModal(null)
  }

  async function marquerRecu(commande: Commande) {
    if (!utilisateur) return
    setReceptionEnCours(commande.id)
    setErreurReception(null)
    try {
      const piece = pieces.find((p) => p.id === commande.piece_id)
      if (!piece) throw new Error('Pièce introuvable')

      const nouvelleQuantite = piece.quantite + commande.quantite_commandee

      const { error: errPiece } = await supabase
        .from('pieces')
        .update({ quantite: nouvelleQuantite })
        .eq('id', piece.id)
      if (errPiece) throw errPiece

      const { error: errCommande } = await supabase
        .from('commandes')
        .update({ statut: 'receptionnee', date_reception: new Date().toISOString() })
        .eq('id', commande.id)
      if (errCommande) throw errCommande

      await creerOperation({
        type: 'livraison',
        piece_id: piece.id,
        quantite_avant: piece.quantite,
        quantite_apres: nouvelleQuantite,
        delta: commande.quantite_commandee,
        utilisateur_id: utilisateur.id,
        commentaire: 'Commande reçue',
      })

      rechargerPieces()
      rechargerCommandes()
    } catch (err: unknown) {
      setErreurReception(err instanceof Error ? err.message : 'Erreur lors de la réception')
    } finally {
      setReceptionEnCours(null)
    }
  }

  async function mettreAJourSuivi(commande: Commande, transporteur: Transporteur, numeroSuivi: string) {
    const { error } = await supabase
      .from('commandes')
      .update({ transporteur, numero_suivi: numeroSuivi })
      .eq('id', commande.id)
    if (error) throw error
    rechargerCommandes()
  }

  const commandesRecuesTriees = useMemo(
    () => [...commandesRecues].sort((a, b) => {
      const dateA = a.date_reception ? new Date(a.date_reception).getTime() : 0
      const dateB = b.date_reception ? new Date(b.date_reception).getTime() : 0
      return dateB - dateA
    }),
    [commandesRecues]
  )

  const chargement = chargementStock || chargementCommandes || chargementProd || chargementNom

  if (!utilisateur) {
    return (
      <div className="p-5 md:p-8">
        <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
          Connectez-vous pour gérer les commandes.
        </p>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8">

      {/* En-tête */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Livraisons</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            Gestionnaire de commandes
          </p>
        </div>
        <button
          onClick={() => ouvrirModal(null)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors"
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Commander une pièce</span>
        </button>
      </div>

      {erreurReception && (
        <p className="mb-6 text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreurReception}</p>
      )}

      {chargement ? (
        <div className="flex items-center justify-center h-40 text-primary-400 text-sm">
          Chargement...
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

          {/* Colonne gauche — à commander */}
          <div className="bg-white rounded-2xl border border-primary-100 p-5 flex flex-col min-h-0">
            <SectionLabel
              texte="À commander"
              count={achatsRecommandes.length}
              accent={achatsRecommandes.length > 0 ? 'text-danger-500' : 'text-primary-400'}
            />
            {achatsRecommandes.length === 0 ? (
              <EtatVide texte="Aucun achat requis — tous les stocks sont suffisants" />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[560px]">
                {achatsRecommandes.map((a) => (
                  <AchatRow key={a.piece.id} achat={a} onCommander={() => ouvrirModal(a.piece)} />
                ))}
              </div>
            )}
          </div>

          {/* Colonne droite — commandes en cours */}
          <div className="bg-white rounded-2xl border border-primary-100 p-5 flex flex-col min-h-0">
            <SectionLabel
              texte="Commandes en cours"
              count={commandesEnCours.length}
              accent={commandesEnCours.length > 0 ? 'text-success-600' : 'text-primary-400'}
            />
            {commandesEnCours.length === 0 ? (
              <EtatVide texte="Aucune commande en cours" />
            ) : (
              <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 max-h-[560px]">
                {commandesEnCours.map((c) => (
                  <CommandeCard
                    key={c.id}
                    commande={c}
                    onMarquerRecu={() => marquerRecu(c)}
                    onMettreAJourSuivi={(transporteur, numeroSuivi) => mettreAJourSuivi(c, transporteur, numeroSuivi)}
                    chargement={receptionEnCours === c.id}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {!chargement && (
        <div className="mt-5 bg-white rounded-2xl border border-primary-100 p-5">
          <SectionLabel
            texte="Commandes reçues"
            count={commandesRecuesTriees.length}
            accent={commandesRecuesTriees.length > 0 ? 'text-primary-600' : 'text-primary-400'}
          />
          {commandesRecuesTriees.length === 0 ? (
            <EtatVide texte="Aucune commande reçue pour le moment" />
          ) : (
            <div className="space-y-1.5 max-h-[320px] overflow-y-auto pr-1">
              {commandesRecuesTriees.map((c) => (
                <CommandeRecueRow key={c.id} commande={c} />
              ))}
            </div>
          )}
        </div>
      )}

      {modalOuvert && (
        <ModalNouvelleCommande
          piece={pieceModal}
          pieces={pieces}
          utilisateur={utilisateur}
          onClose={fermerModal}
          onCreated={rechargerCommandes}
        />
      )}
    </div>
  )
}


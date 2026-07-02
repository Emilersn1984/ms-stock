import { useState, useMemo, useRef, useEffect, useCallback } from 'react'
import { Search, Check, X, PackagePlus } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStock } from '../hooks/useStock'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { creerOperation } from '../utils/creerOperation'
import { getCouleurSeuil } from '../utils/couleurSeuil'
import { Piece } from '../types'

type LivraisonRecente = {
  id: string
  piece_id: string | null
  delta: number | null
  quantite_apres: number | null
  commentaire: string | null
  created_at: string
  pieces: { nom: string } | null
  utilisateurs: { nom: string; prenom: string } | null
}

export default function Livraisons() {
  const { pieces, chargement } = useStock()
  const utilisateur = getUtilisateurStored()

  const [pieceSelectionnee, setPieceSelectionnee] = useState<Piece | null>(null)
  const [recherchePiece, setRecherchePiece] = useState('')
  const [dropdownOuvert, setDropdownOuvert] = useState(false)
  const [quantite, setQuantite] = useState('')
  const [commentaire, setCommentaire] = useState('')
  const [chargementSoumission, setChargementSoumission] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState<{ piece: string; quantite: number } | null>(null)
  const [livraisonsRecentes, setLivraisonsRecentes] = useState<LivraisonRecente[]>([])
  const [chargementHistorique, setChargementHistorique] = useState(true)

  const dropdownRef = useRef<HTMLDivElement>(null)

  const chargerLivraisonsRecentes = useCallback(async () => {
    const { data } = await supabase
      .from('operations')
      .select('id, piece_id, delta, quantite_apres, commentaire, created_at, pieces(nom), utilisateurs(nom, prenom)')
      .eq('type', 'livraison')
      .order('created_at', { ascending: false })
      .limit(8)
    setLivraisonsRecentes((data as unknown as LivraisonRecente[]) ?? [])
    setChargementHistorique(false)
  }, [])

  useEffect(() => {
    chargerLivraisonsRecentes()
  }, [chargerLivraisonsRecentes])

  useEffect(() => {
    if (!confirmation) return
    const timer = setTimeout(() => setConfirmation(null), 6000)
    return () => clearTimeout(timer)
  }, [confirmation])

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOuvert(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const piecesFiltrees = useMemo(() => {
    if (!recherchePiece.trim()) return pieces
    return pieces.filter((p) =>
      p.nom.toLowerCase().includes(recherchePiece.toLowerCase())
    )
  }, [pieces, recherchePiece])

  function selectionnerPiece(piece: Piece) {
    setPieceSelectionnee(piece)
    setRecherchePiece(piece.nom)
    setDropdownOuvert(false)
    setErreur(null)
  }

  function resetForm() {
    setPieceSelectionnee(null)
    setRecherchePiece('')
    setQuantite('')
    setCommentaire('')
    setErreur(null)
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!utilisateur) { setErreur('Vous devez être connecté'); return }
    if (!pieceSelectionnee) { setErreur('Veuillez sélectionner une pièce'); return }
    const qte = parseInt(quantite, 10)
    if (isNaN(qte) || qte === 0) { setErreur('Quantité invalide — ne peut pas être zéro'); return }

    setChargementSoumission(true)
    setErreur(null)

    try {
      const nouvelleQuantite = pieceSelectionnee.quantite + qte

      const { error } = await supabase
        .from('pieces')
        .update({ quantite: nouvelleQuantite })
        .eq('id', pieceSelectionnee.id)

      if (error) throw error

      await creerOperation({
        type: 'livraison',
        piece_id: pieceSelectionnee.id,
        quantite_avant: pieceSelectionnee.quantite,
        quantite_apres: nouvelleQuantite,
        delta: qte,
        utilisateur_id: utilisateur.id,
        commentaire: commentaire.trim() || undefined,
      })

      setConfirmation({ piece: pieceSelectionnee.nom, quantite: qte })
      resetForm()
      chargerLivraisonsRecentes()
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : 'Erreur lors de la livraison')
    } finally {
      setChargementSoumission(false)
    }
  }

  const qteNumerique = parseInt(quantite, 10)
  const stockApres =
    pieceSelectionnee && !isNaN(qteNumerique) && qteNumerique !== 0
      ? pieceSelectionnee.quantite + qteNumerique
      : null

  const STATUT_HEX: Record<string, string> = { rouge: '#E53535', jaune: '#F9BC1A', vert: '#22B84F' }

  if (!utilisateur) {
    return (
      <div className="p-5 md:p-8">
        <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
          Connectez-vous pour déclarer une livraison.
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
            Déclarer une réception de stock
          </p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
          <PackagePlus size={17} className="text-primary-700" />
        </div>
      </div>

      {/* Confirmation */}
      {confirmation && (
        <div className="mb-6 flex rounded-xl overflow-hidden border border-primary-100">
          <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: '#22B84F' }} />
          <div className="flex-1 flex items-center gap-3 px-3.5 py-3 bg-white min-w-0">
            <div className="w-7 h-7 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 border border-primary-100">
              <Check size={13} className="text-success-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-primary-900">Livraison enregistrée</p>
              <p className="text-xs text-primary-500 mt-0.5">
                <span className="font-bold text-success-600">+{confirmation.quantite}</span> × {confirmation.piece}
              </p>
            </div>
            <button
              onClick={() => setConfirmation(null)}
              className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
            >
              <X size={13} />
            </button>
          </div>
        </div>
      )}

      {/* Formulaire */}
      <form onSubmit={soumettre} className="bg-white rounded-2xl border border-primary-100 p-5 space-y-4">

        {/* Sélecteur de pièce */}
        <div ref={dropdownRef} className="relative">
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Pièce
          </label>
          {chargement ? (
            <div className="w-full border border-primary-100 rounded-xl px-4 py-2.5 text-sm text-primary-400 bg-primary-50">
              Chargement…
            </div>
          ) : (
            <>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
                <input
                  type="text"
                  value={recherchePiece}
                  onChange={(e) => {
                    setRecherchePiece(e.target.value)
                    setDropdownOuvert(true)
                    if (pieceSelectionnee && e.target.value !== pieceSelectionnee.nom) {
                      setPieceSelectionnee(null)
                    }
                  }}
                  onFocus={() => setDropdownOuvert(true)}
                  placeholder="Rechercher une pièce…"
                  className="w-full pl-9 pr-4 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  autoComplete="off"
                />
              </div>

              {dropdownOuvert && piecesFiltrees.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-56 overflow-y-auto">
                  {piecesFiltrees.map((piece) => {
                    const couleur = getCouleurSeuil(piece)
                    return (
                      <button
                        key={piece.id}
                        type="button"
                        onClick={() => selectionnerPiece(piece)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition-colors text-left"
                      >
                        <div
                          className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                          style={{ backgroundColor: STATUT_HEX[couleur] }}
                        />
                        <span className="flex-1 text-sm font-medium text-primary-900">{piece.nom}</span>
                        <span className="text-xs text-primary-400 tabular-nums flex-shrink-0">{piece.quantite} en stock</span>
                      </button>
                    )
                  })}
                </div>
              )}

              {dropdownOuvert && recherchePiece.trim() && piecesFiltrees.length === 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg px-4 py-3">
                  <p className="text-sm text-primary-400">Aucune pièce trouvée</p>
                </div>
              )}
            </>
          )}

          {pieceSelectionnee && (
            <div className="mt-2 bg-primary-50 rounded-xl px-3.5 py-2.5 flex items-center gap-3">
              <div
                className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: STATUT_HEX[getCouleurSeuil(pieceSelectionnee)] }}
              />
              <p className="text-sm text-primary-800">
                Stock actuel :{' '}
                <span className="font-bold tabular-nums">{pieceSelectionnee.quantite}</span>
                {pieceSelectionnee.categorie && (
                  <span className="ml-2 text-primary-500 text-xs">· {pieceSelectionnee.categorie}</span>
                )}
              </p>
            </div>
          )}
        </div>

        {/* Quantité */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Quantité reçue
          </label>
          <input
            type="number"
            value={quantite}
            onChange={(e) => setQuantite(e.target.value)}
            placeholder="Ex : 50"
            className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          />
          {stockApres !== null && (
            <p className={`text-sm mt-1.5 font-medium tabular-nums ${qteNumerique > 0 ? 'text-success-600' : 'text-alert-500'}`}>
              {qteNumerique > 0 ? '+' : ''}{qteNumerique} → stock après :{' '}
              <span className="font-bold">{stockApres}</span>
            </p>
          )}
        </div>

        {/* Commentaire */}
        <div>
          <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
            Commentaire{' '}
            <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
          </label>
          <textarea
            value={commentaire}
            onChange={(e) => setCommentaire(e.target.value)}
            rows={2}
            placeholder="Ex : Fournisseur Dupont, BL 2026-123"
            className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-sm focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none placeholder-primary-400"
          />
        </div>

        {erreur && (
          <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>
        )}

        <button
          type="submit"
          disabled={chargementSoumission || !pieceSelectionnee || !quantite.trim()}
          className="w-full bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm"
        >
          {chargementSoumission ? 'Enregistrement…' : 'Valider la livraison'}
        </button>
      </form>

      {/* Historique récent */}
      <div className="mt-8">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 whitespace-nowrap">
            Dernières livraisons
          </span>
          <div className="flex-1 h-px bg-primary-100" />
        </div>

        {chargementHistorique ? (
          <div className="flex items-center justify-center h-32">
            <p className="text-primary-400 text-sm">Chargement…</p>
          </div>
        ) : livraisonsRecentes.length === 0 ? (
          <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
            Aucune livraison enregistrée
          </p>
        ) : (
          <div className="space-y-1.5">
            {livraisonsRecentes.map((liv) => (
              <div key={liv.id} className="flex rounded-xl overflow-hidden border border-primary-100">
                <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: '#22B84F' }} />
                <div className="flex-1 flex items-center gap-3 px-3.5 py-2.5 bg-white min-w-0">
                  <div className="w-8 h-8 rounded-lg bg-primary-50 flex items-center justify-center flex-shrink-0 border border-primary-100">
                    <span className="text-xs font-bold tabular-nums text-success-600">
                      +{liv.delta ?? '?'}
                    </span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-primary-900 truncate">
                      {liv.pieces?.nom ?? '—'}
                    </p>
                    {liv.commentaire && (
                      <p className="text-xs text-primary-500 truncate mt-0.5">{liv.commentaire}</p>
                    )}
                    <p className="text-[10px] text-primary-400 mt-0.5 tabular-nums">
                      {liv.utilisateurs
                        ? `${liv.utilisateurs.prenom} ${liv.utilisateurs.nom}`
                        : 'Utilisateur inconnu'}{' '}
                      · {new Date(liv.created_at).toLocaleDateString('fr-FR', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-bold tabular-nums text-primary-900">
                      {liv.quantite_apres ?? '—'}
                    </p>
                    <p className="text-[10px] text-primary-400 uppercase tracking-wide font-bold">en stock</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

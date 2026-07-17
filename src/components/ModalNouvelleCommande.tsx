import { useState, useMemo, useRef, useEffect } from 'react'
import { PackagePlus, Search, X } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Piece, Transporteur, Utilisateur } from '../types'
import { TRANSPORTEURS } from '../utils/trackingUrl'

function dateAujourdhuiISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

export default function ModalNouvelleCommande({
  piece,
  pieces,
  utilisateur,
  onClose,
  onCreated,
}: {
  piece: Piece | null
  pieces: Piece[]
  utilisateur: Utilisateur
  onClose: () => void
  onCreated: () => void
}) {
  const [pieceSelectionnee, setPieceSelectionnee] = useState<Piece | null>(piece)
  const [recherchePiece, setRecherchePiece] = useState(piece?.nom ?? '')
  const [dropdownOuvert, setDropdownOuvert] = useState(false)
  const [quantite, setQuantite] = useState('')
  const [dateCommande, setDateCommande] = useState(dateAujourdhuiISO())
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState('')
  const [transporteur, setTransporteur] = useState<Transporteur | ''>('')
  const [numeroSuivi, setNumeroSuivi] = useState('')
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const dropdownRef = useRef<HTMLDivElement>(null)

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
    return pieces.filter((p) => p.nom.toLowerCase().includes(recherchePiece.toLowerCase()))
  }, [pieces, recherchePiece])

  function selectionnerPiece(p: Piece) {
    setPieceSelectionnee(p)
    setRecherchePiece(p.nom)
    setDropdownOuvert(false)
    setErreur(null)
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!pieceSelectionnee) { setErreur('Veuillez sélectionner une pièce'); return }
    const qte = parseInt(quantite, 10)
    if (isNaN(qte) || qte <= 0) { setErreur('Quantité invalide'); return }
    if (!dateCommande) { setErreur('Date de commande requise'); return }

    setEnvoi(true)
    setErreur(null)
    try {
      const { error } = await supabase.from('commandes').insert({
        piece_id: pieceSelectionnee.id,
        quantite_commandee: qte,
        date_commande: dateCommande,
        date_livraison_prevue: dateLivraisonPrevue || null,
        transporteur: transporteur || null,
        numero_suivi: numeroSuivi.trim() || null,
        statut: 'en_cours',
        utilisateur_id: utilisateur.id,
      })
      if (error) throw error
      onCreated()
      onClose()
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : 'Erreur lors de la création de la commande')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <PackagePlus size={17} className="text-primary-700" />
            </div>
            <div>
              <h2 className="text-base font-bold text-primary-900 leading-tight">Nouvelle commande</h2>
              <p className="text-xs text-primary-500 mt-0.5">Renseigner les détails de la commande</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={soumettre} className="space-y-4">
          {/* Sélecteur de pièce */}
          <div ref={dropdownRef} className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Pièce
            </label>
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
              <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {piecesFiltrees.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => selectionnerPiece(p)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition-colors text-left"
                  >
                    <span className="flex-1 text-sm font-medium text-primary-900">{p.nom}</span>
                    <span className="text-xs text-primary-400 tabular-nums flex-shrink-0">{p.quantite} en stock</span>
                  </button>
                ))}
              </div>
            )}
            {dropdownOuvert && recherchePiece.trim() && piecesFiltrees.length === 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg px-4 py-3">
                <p className="text-sm text-primary-400">Aucune pièce trouvée</p>
              </div>
            )}
          </div>

          {/* Quantité */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Quantité commandée
            </label>
            <input
              type="number"
              min={1}
              value={quantite}
              onChange={(e) => setQuantite(e.target.value)}
              placeholder="Ex : 100"
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-lg font-bold tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Date de commande
              </label>
              <input
                type="date"
                value={dateCommande}
                onChange={(e) => setDateCommande(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Livraison prévue
              </label>
              <input
                type="date"
                value={dateLivraisonPrevue}
                onChange={(e) => setDateLivraisonPrevue(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>

          {/* Transporteur + suivi */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Transporteur{' '}
                <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
              </label>
              <select
                value={transporteur}
                onChange={(e) => setTransporteur(e.target.value as Transporteur | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">—</option>
                {TRANSPORTEURS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                N° de suivi{' '}
                <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
              </label>
              <input
                type="text"
                value={numeroSuivi}
                onChange={(e) => setNumeroSuivi(e.target.value)}
                placeholder="Ex : 6A123..."
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>

          {erreur && (
            <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={envoi || !pieceSelectionnee || !quantite.trim()}
              className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {envoi ? 'Enregistrement…' : 'Valider la commande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

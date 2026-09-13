import { useEffect, useState } from 'react'
import { X, Package, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { getCouleurSeuil, COULEUR_LABEL } from '../utils/couleurSeuil'
import { Piece } from '../types'

type Props = {
  piece: Piece
  // Nom de chaque sous-ensemble, pour la section « Utilisée dans ».
  nomsSousEnsembles: Record<string, string>
  canEdit: boolean
  onModifier: () => void
  onPhoto: (url: string) => void
  onClose: () => void
}

const STATUT_CLASS = { rouge: 'text-danger-600', jaune: 'text-warning-600', vert: 'text-success-600' }

function Ligne({ label, valeur }: { label: string; valeur: React.ReactNode }) {
  const vide = valeur == null || valeur === ''
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-primary-50 last:border-b-0">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-500 flex-shrink-0">{label}</span>
      <span className={`text-sm text-right min-w-0 break-words ${vide ? 'text-primary-300' : 'text-primary-900'}`}>
        {vide ? '—' : valeur}
      </span>
    </div>
  )
}

/** Fiche en lecture seule d'une pièce, ouverte au clic dans la liste du stock. */
export default function ModalFichePiece({ piece, nomsSousEnsembles, canEdit, onModifier, onPhoto, onClose }: Props) {
  const [utilisations, setUtilisations] = useState<{ sous_ensemble_id: string; quantite_requise: number }[] | null>(null)

  useEffect(() => {
    let annule = false
    supabase
      .from('nomenclature')
      .select('sous_ensemble_id, quantite_requise')
      .eq('piece_id', piece.id)
      .then(({ data }) => { if (!annule) setUtilisations(data ?? []) })
    return () => { annule = true }
  }, [piece.id])

  useEffect(() => {
    function surTouche(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', surTouche)
    return () => document.removeEventListener('keydown', surTouche)
  }, [onClose])

  const couleur = getCouleurSeuil(piece)
  const euros = (n: number) => `${n.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} € HT`

  return (
    <div
      className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            {piece.photo_url ? (
              <img
                src={piece.photo_url}
                alt=""
                onClick={() => onPhoto(piece.photo_url!)}
                className="w-12 h-12 rounded-xl object-cover flex-shrink-0 cursor-zoom-in"
              />
            ) : (
              <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Package size={20} className="text-primary-500" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="text-base font-bold text-primary-900 leading-tight break-words">{piece.nom}</h2>
              <p className="text-xs text-primary-500 mt-0.5">
                <span className={`font-bold ${STATUT_CLASS[couleur]}`}>{piece.quantite}</span> en stock ·{' '}
                <span className={`font-bold uppercase ${STATUT_CLASS[couleur]}`}>{COULEUR_LABEL[couleur]}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="mb-4">
          <Ligne label="Référence" valeur={piece.reference} />
          <Ligne label="Fournisseur" valeur={piece.fournisseur} />
          <Ligne label="Catégorie" valeur={piece.categorie} />
          <Ligne label="Description" valeur={piece.description} />
          <Ligne label="Commentaire" valeur={piece.commentaire} />
          <Ligne label="Prix unitaire" valeur={piece.prix_unitaire != null ? euros(piece.prix_unitaire) : null} />
          <Ligne label="MOQ" valeur={piece.moq} />
          {piece.est_impression_3d ? (
            <Ligne label="Impression 3D" valeur={piece.temps_impression_heures != null ? `${piece.temps_impression_heures} h par pièce` : 'Oui'} />
          ) : (
            <Ligne label="Délai appro" valeur={piece.delai_appro != null ? `${piece.delai_appro} sem.` : null} />
          )}
          <Ligne
            label="Seuils"
            valeur={`Critique ≤ ${piece.seuil_rouge} · Faible ≤ ${piece.seuil_jaune}`}
          />
        </div>

        <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">Utilisée dans</p>
        {utilisations === null ? (
          <p className="text-xs text-primary-400 italic mb-5">Chargement…</p>
        ) : utilisations.length === 0 ? (
          <p className="text-xs text-primary-400 italic mb-5">Aucun sous-ensemble</p>
        ) : (
          <ul className="mb-5 space-y-1">
            {utilisations.map((u) => (
              <li key={u.sous_ensemble_id} className="flex justify-between text-sm text-primary-800">
                <span>{nomsSousEnsembles[u.sous_ensemble_id] ?? '—'}</span>
                <span className="tabular-nums text-primary-500">× {u.quantite_requise}</span>
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
          >
            Fermer
          </button>
          {canEdit && (
            <button
              type="button"
              onClick={onModifier}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-primary-900 hover:bg-primary-800 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              <Pencil size={14} /> Modifier
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

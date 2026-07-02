import type { Piece } from '../types'

export type NomenclatureRow = {
  sous_ensemble_id: string
  piece_id: string | null
  sous_ensemble_enfant_id: string | null
  quantite_requise: number
}

function resoudreRecursif(
  seId: string,
  multiplicateur: number,
  besoin: Map<string, number>,
  nomenclature: NomenclatureRow[],
  ancetres: Set<string>
): void {
  if (ancetres.has(seId)) return
  const cheminCourant = new Set([...ancetres, seId])

  const lignes = nomenclature.filter((n) => n.sous_ensemble_id === seId)

  for (const ligne of lignes) {
    if (ligne.piece_id) {
      const qte = ligne.quantite_requise * multiplicateur
      besoin.set(ligne.piece_id, (besoin.get(ligne.piece_id) ?? 0) + qte)
    } else if (ligne.sous_ensemble_enfant_id) {
      resoudreRecursif(
        ligne.sous_ensemble_enfant_id,
        ligne.quantite_requise * multiplicateur,
        besoin,
        nomenclature,
        cheminCourant
      )
    }
  }
}

export function calcMaxFabricable(
  seId: string,
  pieces: Piece[],
  nomenclature: NomenclatureRow[]
): number {
  const besoin = new Map<string, number>()
  resoudreRecursif(seId, 1, besoin, nomenclature, new Set())

  if (besoin.size === 0) return 0

  const piecesMap = new Map(pieces.map((p) => [p.id, p]))
  let max = Infinity

  for (const [pieceId, quantiteRequise] of besoin) {
    const piece = piecesMap.get(pieceId)
    if (!piece) return 0
    const faisable = Math.floor(piece.quantite / quantiteRequise)
    if (faisable < max) max = faisable
  }

  return Math.max(0, max === Infinity ? 0 : max)
}

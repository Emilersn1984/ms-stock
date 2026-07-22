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

// Explose la nomenclature (BOM) depuis `seId`, en multipliant les quantités
// requises par `multiplicateur`, et retourne le besoin total par pièce
// (piece_id -> quantité). Utilisé pour dériver les besoins en pièces à partir
// d'une valeur de production hebdomadaire réglée à la main, indépendamment
// de tout stock ou production réellement déclarée.
export function calcBesoinPieces(
  seId: string,
  multiplicateur: number,
  nomenclature: NomenclatureRow[]
): Map<string, number> {
  const besoin = new Map<string, number>()
  resoudreRecursif(seId, multiplicateur, besoin, nomenclature, new Set())
  return besoin
}

export function calcMaxFabricable(
  seId: string,
  pieces: Piece[],
  nomenclature: NomenclatureRow[]
): number {
  return calcMaxFabricableDetail(seId, pieces, nomenclature).max
}

export type MaxFabricableDetail = {
  max: number
  pieceLimitante: Piece | null
}

export function calcMaxFabricableDetail(
  seId: string,
  pieces: Piece[],
  nomenclature: NomenclatureRow[]
): MaxFabricableDetail {
  const besoin = new Map<string, number>()
  resoudreRecursif(seId, 1, besoin, nomenclature, new Set())

  if (besoin.size === 0) return { max: 0, pieceLimitante: null }

  const piecesMap = new Map(pieces.map((p) => [p.id, p]))
  let max = Infinity
  let pieceLimitante: Piece | null = null

  for (const [pieceId, quantiteRequise] of besoin) {
    const piece = piecesMap.get(pieceId)
    if (!piece) return { max: 0, pieceLimitante: null }
    // Les pièces imprimées en 3D sont produites en interne rapidement :
    // elles ne doivent pas plafonner le nombre théorique de bouées fabricables.
    if (piece.est_impression_3d) continue
    const faisable = Math.floor(piece.quantite / quantiteRequise)
    if (faisable < max) {
      max = faisable
      pieceLimitante = piece
    }
  }

  return {
    max: Math.max(0, max === Infinity ? 0 : max),
    pieceLimitante: max === Infinity ? null : pieceLimitante,
  }
}

import { Piece } from '../types'
import { getCouleurSeuil } from './couleurSeuil'

export type NiveauUrgence = 'critique' | 'commander'

export type AchatRecommande = {
  piece: Piece
  consommationHebdo: number
  stockRestantEstime: number
  urgence: NiveauUrgence
  source: 'predictive' | 'seuil'
}

// consommationParPiece : piece_id -> quantité consommée par semaine, dérivée
// uniquement de la valeur de production réglée à la main (voir calcBesoinPieces).
export function calcAchatsRecommandes(
  pieces: Piece[],
  consommationParPiece: Map<string, number>,
): AchatRecommande[] {
  const results: AchatRecommande[] = []

  for (const piece of pieces) {
    if (piece.est_impression_3d) continue

    if (piece.delai_appro != null) {
      const consommationHebdo = consommationParPiece.get(piece.id) ?? 0

      if (consommationHebdo === 0) {
        const couleur = getCouleurSeuil(piece)
        if (couleur === 'rouge') {
          results.push({
            piece,
            consommationHebdo: 0,
            stockRestantEstime: piece.quantite,
            urgence: 'critique',
            source: 'seuil',
          })
        } else if (couleur === 'jaune') {
          results.push({
            piece,
            consommationHebdo: 0,
            stockRestantEstime: piece.quantite,
            urgence: 'commander',
            source: 'seuil',
          })
        }
        continue
      }

      const stockNeeded = consommationHebdo * piece.delai_appro
      const stockRestantEstime = piece.quantite - stockNeeded

      let urgence: NiveauUrgence | null = null
      if (stockRestantEstime <= 0) {
        urgence = 'critique'
      } else if (stockRestantEstime < consommationHebdo) {
        urgence = 'commander'
      }

      if (urgence) {
        results.push({ piece, consommationHebdo, stockRestantEstime, urgence, source: 'predictive' })
      }
    } else {
      const couleur = getCouleurSeuil(piece)
      if (couleur === 'rouge') {
        results.push({
          piece,
          consommationHebdo: 0,
          stockRestantEstime: piece.quantite,
          urgence: 'critique',
          source: 'seuil',
        })
      } else if (couleur === 'jaune') {
        results.push({
          piece,
          consommationHebdo: 0,
          stockRestantEstime: piece.quantite,
          urgence: 'commander',
          source: 'seuil',
        })
      }
    }
  }

  results.sort((a, b) => {
    const order: Record<NiveauUrgence, number> = { critique: 0, commander: 1 }
    const orderDiff = order[a.urgence] - order[b.urgence]
    if (orderDiff !== 0) return orderDiff
    return a.stockRestantEstime - b.stockRestantEstime
  })

  return results
}

import { Piece } from '../types'
import { getCouleurSeuil } from './couleurSeuil'

export type NiveauUrgence = 'critique' | 'commander'

export type Impression3DRecommandee = {
  piece: Piece
  consommationHebdo: number
  tempsImpressionHeures: number | null
  stockRestantEstime: number
  urgence: NiveauUrgence
  source: 'predictive' | 'seuil'
}

const HEURES_PAR_SEMAINE = 7 * 24

// consommationParPiece : piece_id -> quantité consommée par semaine, dérivée
// uniquement de la valeur de production réglée à la main (voir calcBesoinPieces).
export function calcImpressions3DRecommandees(
  pieces: Piece[],
  consommationParPiece: Map<string, number>,
): Impression3DRecommandee[] {
  const results: Impression3DRecommandee[] = []

  for (const piece of pieces) {
    if (!piece.est_impression_3d) continue

    const consommationHebdo = consommationParPiece.get(piece.id) ?? 0

    if (piece.temps_impression_heures == null || consommationHebdo === 0) {
      const couleur = getCouleurSeuil(piece)
      if (couleur === 'rouge' || couleur === 'jaune') {
        results.push({
          piece,
          consommationHebdo,
          tempsImpressionHeures: piece.temps_impression_heures,
          stockRestantEstime: piece.quantite,
          urgence: couleur === 'rouge' ? 'critique' : 'commander',
          source: 'seuil',
        })
      }
      continue
    }

    const consommationHoraire = consommationHebdo / HEURES_PAR_SEMAINE
    const stockNeeded = consommationHoraire * piece.temps_impression_heures
    const stockRestantEstime = piece.quantite - stockNeeded

    let urgence: NiveauUrgence | null = null
    if (stockRestantEstime <= 0) {
      urgence = 'critique'
    } else if (stockRestantEstime < consommationHebdo) {
      urgence = 'commander'
    }

    if (urgence) {
      results.push({
        piece,
        consommationHebdo,
        tempsImpressionHeures: piece.temps_impression_heures,
        stockRestantEstime,
        urgence,
        source: 'predictive',
      })
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

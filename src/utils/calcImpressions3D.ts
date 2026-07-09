import { Piece } from '../types'
import { getCouleurSeuil } from './couleurSeuil'
import type { ProductionHebdo } from '../hooks/useProductionHebdo'

export type NiveauUrgence = 'critique' | 'commander'

export type Impression3DRecommandee = {
  piece: Piece
  consommationHebdo: number
  tempsImpressionHeures: number | null
  stockRestantEstime: number
  urgence: NiveauUrgence
  source: 'predictive' | 'seuil'
}

type NomEntry = {
  piece_id: string
  sous_ensemble_id: string
  quantite_requise: number
}

const HEURES_PAR_SEMAINE = 7 * 24

export function calcImpressions3DRecommandees(
  pieces: Piece[],
  nomenclature: NomEntry[],
  productions: ProductionHebdo[],
): Impression3DRecommandee[] {
  const productionMap: Record<string, number> = {}
  for (const p of productions) {
    productionMap[p.sous_ensemble_id] = p.quantite
  }

  const results: Impression3DRecommandee[] = []

  for (const piece of pieces) {
    if (!piece.est_impression_3d) continue

    let consommationHebdo = 0
    for (const entry of nomenclature) {
      if (entry.piece_id === piece.id) {
        const prod = productionMap[entry.sous_ensemble_id] ?? 0
        consommationHebdo += entry.quantite_requise * prod
      }
    }

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

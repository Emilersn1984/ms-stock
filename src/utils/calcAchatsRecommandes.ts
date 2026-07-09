import { Piece } from '../types'
import { getCouleurSeuil } from './couleurSeuil'
import type { ProductionHebdo } from '../hooks/useProductionHebdo'

export type NiveauUrgence = 'critique' | 'commander'

export type AchatRecommande = {
  piece: Piece
  consommationHebdo: number
  stockRestantEstime: number
  urgence: NiveauUrgence
  source: 'predictive' | 'seuil'
}

type NomEntry = {
  piece_id: string
  sous_ensemble_id: string
  quantite_requise: number
}

export function calcAchatsRecommandes(
  pieces: Piece[],
  nomenclature: NomEntry[],
  productions: ProductionHebdo[],
): AchatRecommande[] {
  const productionMap: Record<string, number> = {}
  for (const p of productions) {
    productionMap[p.sous_ensemble_id] = p.quantite
  }

  const results: AchatRecommande[] = []

  for (const piece of pieces) {
    if (piece.est_impression_3d) continue

    if (piece.delai_appro != null) {
      let consommationHebdo = 0
      for (const entry of nomenclature) {
        if (entry.piece_id === piece.id) {
          const prod = productionMap[entry.sous_ensemble_id] ?? 0
          consommationHebdo += entry.quantite_requise * prod
        }
      }

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

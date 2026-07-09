import { supabase } from '../lib/supabase'
import { Piece, SousEnsemble } from '../types'

export type LigneConsommation = {
  piece_id: string
  nom: string
  quantite_necessaire: number
  quantite_stock: number
}

export type LigneConsommationSE = {
  sous_ensemble_id: string
  nom: string
  quantite_necessaire: number
  quantite_stock: number
}

export type ResultatConsommation = {
  pieces: LigneConsommation[]
  sousEnsembles: LigneConsommationSE[]
}

async function resoudreRecursif(
  sousEnsembleId: string,
  multiplicateur: number,
  resultatPieces: Map<string, LigneConsommation>,
  resultatSE: Map<string, LigneConsommationSE>,
  piecesMap: Map<string, Piece>,
  sousEnsemblesMap: Map<string, SousEnsemble>,
  seReserve: Map<string, number>,
  ancetres: Set<string>
): Promise<void> {
  if (ancetres.has(sousEnsembleId)) return
  const cheminCourant = new Set([...ancetres, sousEnsembleId])

  const { data: lignes, error } = await supabase
    .from('nomenclature')
    .select('piece_id, sous_ensemble_enfant_id, quantite_requise')
    .eq('sous_ensemble_id', sousEnsembleId)

  if (error || !lignes) return

  for (const ligne of lignes) {
    if (ligne.piece_id) {
      const piece = piecesMap.get(ligne.piece_id)
      if (!piece) continue
      const qte = ligne.quantite_requise * multiplicateur
      const existing = resultatPieces.get(ligne.piece_id)
      if (existing) {
        existing.quantite_necessaire += qte
      } else {
        resultatPieces.set(ligne.piece_id, {
          piece_id: ligne.piece_id,
          nom: piece.nom,
          quantite_necessaire: qte,
          quantite_stock: piece.quantite,
        })
      }
    } else if (ligne.sous_ensemble_enfant_id) {
      const enfantId = ligne.sous_ensemble_enfant_id
      const qteRequise = ligne.quantite_requise * multiplicateur
      const enfant = sousEnsemblesMap.get(enfantId)
      const stockEnfant = enfant?.quantite ?? 0
      const dejaReserve = seReserve.get(enfantId) ?? 0
      const disponible = Math.max(0, stockEnfant - dejaReserve)
      const consommeDuStock = Math.min(qteRequise, disponible)
      const manquant = qteRequise - consommeDuStock

      // Priorité au stock existant du sous-ensemble enfant : on le consomme
      // directement sans toucher aux pièces qui le composent.
      if (consommeDuStock > 0) {
        seReserve.set(enfantId, dejaReserve + consommeDuStock)
        const existing = resultatSE.get(enfantId)
        if (existing) {
          existing.quantite_necessaire += consommeDuStock
        } else {
          resultatSE.set(enfantId, {
            sous_ensemble_id: enfantId,
            nom: enfant?.nom ?? '—',
            quantite_necessaire: consommeDuStock,
            quantite_stock: stockEnfant,
          })
        }
      }

      // Seul le manque (si le stock du SE enfant est insuffisant) déclenche
      // l'explosion de sa nomenclature en pièces de base.
      if (manquant > 0) {
        await resoudreRecursif(
          enfantId,
          manquant,
          resultatPieces,
          resultatSE,
          piecesMap,
          sousEnsemblesMap,
          seReserve,
          cheminCourant
        )
      }
    }
  }
}

export async function calcConsommation(
  sousEnsembleId: string,
  quantiteAFabriquer: number,
  pieces: Piece[],
  sousEnsembles: SousEnsemble[] = []
): Promise<ResultatConsommation> {
  const piecesMap = new Map(pieces.map((p) => [p.id, p]))
  const sousEnsemblesMap = new Map(sousEnsembles.map((s) => [s.id, s]))
  const resultatPieces = new Map<string, LigneConsommation>()
  const resultatSE = new Map<string, LigneConsommationSE>()
  await resoudreRecursif(
    sousEnsembleId,
    quantiteAFabriquer,
    resultatPieces,
    resultatSE,
    piecesMap,
    sousEnsemblesMap,
    new Map<string, number>(),
    new Set()
  )
  return {
    pieces: Array.from(resultatPieces.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
    sousEnsembles: Array.from(resultatSE.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr')),
  }
}

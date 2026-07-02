import { supabase } from '../lib/supabase'
import { Piece } from '../types'

export type LigneConsommation = {
  piece_id: string
  nom: string
  quantite_necessaire: number
  quantite_stock: number
}

async function resoudreRecursif(
  sousEnsembleId: string,
  multiplicateur: number,
  resultat: Map<string, LigneConsommation>,
  piecesMap: Map<string, Piece>,
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
      const existing = resultat.get(ligne.piece_id)
      if (existing) {
        existing.quantite_necessaire += qte
      } else {
        resultat.set(ligne.piece_id, {
          piece_id: ligne.piece_id,
          nom: piece.nom,
          quantite_necessaire: qte,
          quantite_stock: piece.quantite,
        })
      }
    } else if (ligne.sous_ensemble_enfant_id) {
      await resoudreRecursif(
        ligne.sous_ensemble_enfant_id,
        ligne.quantite_requise * multiplicateur,
        resultat,
        piecesMap,
        cheminCourant
      )
    }
  }
}

export async function calcConsommation(
  sousEnsembleId: string,
  quantiteAFabriquer: number,
  pieces: Piece[]
): Promise<LigneConsommation[]> {
  const piecesMap = new Map(pieces.map((p) => [p.id, p]))
  const resultat = new Map<string, LigneConsommation>()
  await resoudreRecursif(sousEnsembleId, quantiteAFabriquer, resultat, piecesMap, new Set())
  return Array.from(resultat.values()).sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

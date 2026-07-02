import { supabase } from '../lib/supabase'
import { TypeOperation } from '../types'

type ParamsOperation = {
  type: TypeOperation
  piece_id?: string
  sous_ensemble_id?: string
  quantite_avant: number
  quantite_apres: number
  delta: number
  utilisateur_id: string
  commentaire?: string
}

export async function creerOperation(params: ParamsOperation): Promise<void> {
  const { error } = await supabase.from('operations').insert({
    type: params.type,
    piece_id: params.piece_id ?? null,
    sous_ensemble_id: params.sous_ensemble_id ?? null,
    quantite_avant: params.quantite_avant,
    quantite_apres: params.quantite_apres,
    delta: params.delta,
    utilisateur_id: params.utilisateur_id,
    commentaire: params.commentaire ?? null,
  })

  if (error) {
    console.error('Erreur création opération:', error)
    throw error
  }
}

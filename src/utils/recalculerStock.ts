import { supabase } from '../lib/supabase'

export async function recalculerStock(pieceId: string): Promise<void> {
  const { data: ops, error } = await supabase
    .from('operations')
    .select('id, delta, quantite_avant, quantite_apres, created_at')
    .eq('piece_id', pieceId)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!ops || ops.length === 0) return

  let stockCourant: number = ops[0].quantite_avant ?? 0

  for (const op of ops) {
    const quantiteAvant = stockCourant
    const quantiteApres = stockCourant + (op.delta ?? 0)

    if (op.quantite_avant !== quantiteAvant || op.quantite_apres !== quantiteApres) {
      const { error: updateError } = await supabase
        .from('operations')
        .update({ quantite_avant: quantiteAvant, quantite_apres: quantiteApres })
        .eq('id', op.id)
      if (updateError) throw updateError
    }

    stockCourant = quantiteApres
  }

  const { error: pieceError } = await supabase
    .from('pieces')
    .update({ quantite: stockCourant })
    .eq('id', pieceId)

  if (pieceError) throw pieceError
}

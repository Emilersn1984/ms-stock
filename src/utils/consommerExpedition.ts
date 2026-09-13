import { supabase } from '../lib/supabase'
import { calcBesoinPieces, NomenclatureRow } from './calcDisponibilite'
import { creerOperation } from './creerOperation'
import { ExpeditionItem } from '../types'

/**
 * Mouvements de stock d'une expédition.
 *
 * Les sous-ensembles ne sont plus fabriqués ni stockés : quand un produit sort
 * de l'atelier, sa nomenclature est explosée récursivement et ce sont les
 * composants unitaires qui sont décomptés. Les lignes portant directement une
 * pièce (anciennes expéditions) sont décomptées telles quelles.
 */

async function chargerNomenclature(): Promise<NomenclatureRow[]> {
  const { data, error } = await supabase
    .from('nomenclature')
    .select('sous_ensemble_id, piece_id, sous_ensemble_enfant_id, quantite_requise')
  if (error) throw error
  return (data ?? []) as NomenclatureRow[]
}

function besoinPieces(items: ExpeditionItem[], nomenclature: NomenclatureRow[]): Map<string, number> {
  const total = new Map<string, number>()
  for (const item of items) {
    if (item.quantite <= 0) continue
    if (item.sous_ensemble_id) {
      for (const [pieceId, qte] of calcBesoinPieces(item.sous_ensemble_id, item.quantite, nomenclature)) {
        total.set(pieceId, (total.get(pieceId) ?? 0) + qte)
      }
    } else if (item.piece_id) {
      total.set(item.piece_id, (total.get(item.piece_id) ?? 0) + item.quantite)
    }
  }
  return total
}

// Applique un delta signé par pièce (négatif = sortie du stock). Les quantités
// sont relues en base juste avant l'écriture pour ne pas partir d'un état périmé.
async function appliquerDeltas(deltas: Map<string, number>, utilisateurId: string, commentaire: string) {
  const ids = [...deltas.entries()].filter(([, d]) => d !== 0).map(([id]) => id)
  if (ids.length === 0) return

  const { data, error } = await supabase.from('pieces').select('id, quantite').in('id', ids)
  if (error) throw error

  for (const piece of (data ?? []) as { id: string; quantite: number }[]) {
    const delta = deltas.get(piece.id) ?? 0
    const nouvelleQuantite = piece.quantite + delta
    const { error: errMaj } = await supabase.from('pieces').update({ quantite: nouvelleQuantite }).eq('id', piece.id)
    if (errMaj) throw errMaj
    await creerOperation({
      type: 'expedition',
      piece_id: piece.id,
      quantite_avant: piece.quantite,
      quantite_apres: nouvelleQuantite,
      delta,
      utilisateur_id: utilisateurId,
      commentaire,
    })
  }
}

/** Décompte les composants du contenu expédié. */
export async function sortirContenu(items: ExpeditionItem[], utilisateurId: string, commentaire: string) {
  const besoin = besoinPieces(items, await chargerNomenclature())
  await appliquerDeltas(new Map([...besoin].map(([id, q]) => [id, -q])), utilisateurId, commentaire)
}

/** Remet en stock les composants d'un contenu expédié (annulation de l'envoi). */
export async function retournerContenu(items: ExpeditionItem[], utilisateurId: string, commentaire: string) {
  await appliquerDeltas(besoinPieces(items, await chargerNomenclature()), utilisateurId, commentaire)
}

/** Répercute un changement de contenu sur une expédition déjà envoyée. */
export async function ajusterContenu(
  ancien: ExpeditionItem[],
  nouveau: ExpeditionItem[],
  utilisateurId: string,
  commentaire: string
) {
  const nomenclature = await chargerNomenclature()
  const avant = besoinPieces(ancien, nomenclature)
  const apres = besoinPieces(nouveau, nomenclature)
  const deltas = new Map<string, number>()
  for (const id of new Set([...avant.keys(), ...apres.keys()])) {
    deltas.set(id, (avant.get(id) ?? 0) - (apres.get(id) ?? 0))
  }
  await appliquerDeltas(deltas, utilisateurId, commentaire)
}

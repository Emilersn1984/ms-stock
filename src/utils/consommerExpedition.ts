import { supabase } from '../lib/supabase'
import { calcConsommation } from './calcConsommation'
import { creerOperation } from './creerOperation'
import { Piece, SousEnsemble } from '../types'

type ParamsConsommation = {
  sousEnsembleId: string
  quantite: number
  pieces: Piece[]
  sousEnsembles: SousEnsemble[]
  utilisateurId: string
  commentaire: string
}

/**
 * Décompte un sous-ensemble expédié.
 *
 * Le stock déjà assemblé est consommé en priorité. Pour ce qui manque, on
 * considère que l'assemblage a bien eu lieu même s'il n'a jamais été
 * enregistré : la nomenclature est explosée et ce sont les composants qui
 * sont décomptés, récursivement — un sous-ensemble enfant est lui aussi pris
 * dans son propre stock avant d'être explosé à son tour.
 */
export async function consommerSousEnsembleExpedie({
  sousEnsembleId,
  quantite,
  pieces,
  sousEnsembles,
  utilisateurId,
  commentaire,
}: ParamsConsommation): Promise<void> {
  if (quantite <= 0) return
  const se = sousEnsembles.find((s) => s.id === sousEnsembleId)
  if (!se) return

  const disponible = Math.max(0, se.quantite)
  const prisEnStock = Math.min(quantite, disponible)
  const manquant = quantite - prisEnStock

  if (prisEnStock > 0) {
    const nouvelleQuantite = se.quantite - prisEnStock
    const { error } = await supabase
      .from('sous_ensembles')
      .update({ quantite: nouvelleQuantite })
      .eq('id', se.id)
    if (error) throw error
    await creerOperation({
      type: 'expedition',
      sous_ensemble_id: se.id,
      quantite_avant: se.quantite,
      quantite_apres: nouvelleQuantite,
      delta: -prisEnStock,
      utilisateur_id: utilisateurId,
      commentaire,
    })
  }

  if (manquant === 0) return

  // Rien (ou pas assez) en stock : on décompte les composants comme si
  // l'assemblage venait d'être fait.
  const resultat = await calcConsommation(sousEnsembleId, manquant, pieces, sousEnsembles)
  const commentaireExplose = `${commentaire} — assemblé à l'expédition (${se.nom})`

  for (const ligne of resultat.sousEnsembles) {
    const nouvelleQuantite = ligne.quantite_stock - ligne.quantite_necessaire
    const { error } = await supabase
      .from('sous_ensembles')
      .update({ quantite: nouvelleQuantite })
      .eq('id', ligne.sous_ensemble_id)
    if (error) throw error
    await creerOperation({
      type: 'expedition',
      sous_ensemble_id: ligne.sous_ensemble_id,
      quantite_avant: ligne.quantite_stock,
      quantite_apres: nouvelleQuantite,
      delta: -ligne.quantite_necessaire,
      utilisateur_id: utilisateurId,
      commentaire: commentaireExplose,
    })
  }

  for (const ligne of resultat.pieces) {
    const nouvelleQuantite = ligne.quantite_stock - ligne.quantite_necessaire
    const { error } = await supabase
      .from('pieces')
      .update({ quantite: nouvelleQuantite })
      .eq('id', ligne.piece_id)
    if (error) throw error
    await creerOperation({
      type: 'expedition',
      piece_id: ligne.piece_id,
      sous_ensemble_id: sousEnsembleId,
      quantite_avant: ligne.quantite_stock,
      quantite_apres: nouvelleQuantite,
      delta: -ligne.quantite_necessaire,
      utilisateur_id: utilisateurId,
      commentaire: commentaireExplose,
    })
  }
}

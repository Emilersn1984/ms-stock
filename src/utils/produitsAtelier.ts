import { ExpeditionItem, ProduitAtelier, SousEnsemble } from '../types'

export const PRODUITS_ATELIER: ProduitAtelier[] = ['bouee_complete', 'bouee_mecanique', 'boitier_bord', 'tourelle']

export const PRODUIT_ATELIER_LABEL: Record<ProduitAtelier, string> = {
  bouee_complete: 'Bouée complète',
  bouee_mecanique: 'Bouée mécanique',
  boitier_bord: 'Boîtier bord',
  tourelle: 'Tourelle',
}

/** Sous-ensemble rattaché à chaque produit (colonne sous_ensembles.produit). */
export function sousEnsemblesParProduit(sousEnsembles: SousEnsemble[]): Map<ProduitAtelier, SousEnsemble> {
  const map = new Map<ProduitAtelier, SousEnsemble>()
  for (const se of sousEnsembles) if (se.produit) map.set(se.produit, se)
  return map
}

/**
 * Libellé court du contenu d'une expédition : « 2 × Tourelle, Boîtier bord ».
 * Le nom du produit prime sur celui enregistré dans la ligne, pour que les
 * anciennes expéditions (« Colis terminé fermé ») s'affichent comme les nouvelles.
 */
export function resumeContenu(items: ExpeditionItem[] | null | undefined, sousEnsembles: SousEnsemble[] = []): string {
  return (items ?? [])
    .map((i) => {
      const produit = sousEnsembles.find((s) => s.id === i.sous_ensemble_id)?.produit
      const nom = produit ? PRODUIT_ATELIER_LABEL[produit] : i.nom
      return i.quantite > 1 ? `${i.quantite} × ${nom}` : nom
    })
    .join(', ')
}

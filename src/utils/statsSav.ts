import { Expedition, Sav, SousEnsemble } from '../types'

export type StatsSav = {
  produitsVendusTotal: number
  produitsVendusAnnee: number
  savTotal: number
  savAnnee: number
}

/**
 * Nombre de produits (bouée complète, bouée mécanique, boîtier bord, tourelle)
 * contenus dans une expédition : une vente de 2 bouées compte pour 2. Les
 * lignes qui ne correspondent à aucun produit d'atelier sont ignorées.
 *
 * Les ventes saisies avant l'apparition du choix des produits n'ont aucun
 * contenu : elles comptent pour 1, faute de quoi la moitié de l'historique
 * disparaîtrait du compteur.
 */
function nombreProduits(expedition: Expedition, idsProduits: Set<string>): number {
  const total = (expedition.items ?? [])
    .filter((i) => i.sous_ensemble_id && idsProduits.has(i.sous_ensemble_id))
    .reduce((somme, i) => somme + (i.quantite ?? 0), 0)
  return total > 0 ? total : 1
}

function annee(iso: string | null): number | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d.getFullYear()
}

/**
 * Compteurs du bandeau de la page SAV.
 *
 * - Produits vendus : produits des expéditions de catégorie « vente », tous
 *   statuts confondus, rattachés à l'année de la date de commande.
 * - SAV : une reprise déclarée = 1, quel que soit le nombre de pièces reprises.
 *   Les expéditions SAV antérieures au module (saisies depuis la page Ventes)
 *   sont comptées elles aussi, sauf celles déjà rattachées à une reprise, pour
 *   éviter de compter deux fois le colis de renvoi.
 */
export function calculerStatsSav(
  expeditions: Expedition[],
  savs: Sav[],
  sousEnsembles: SousEnsemble[],
  anneeCourante: number = new Date().getFullYear()
): StatsSav {
  const idsProduits = new Set(sousEnsembles.filter((se) => se.produit).map((se) => se.id))
  const expeditionsRattachees = new Set(savs.map((s) => s.expedition_id).filter(Boolean) as string[])

  let produitsVendusTotal = 0
  let produitsVendusAnnee = 0
  let savTotal = savs.length
  let savAnnee = savs.filter((s) => annee(s.date_sav) === anneeCourante).length

  for (const e of expeditions) {
    if (e.categorie === 'vente') {
      const n = nombreProduits(e, idsProduits)
      produitsVendusTotal += n
      if (annee(e.date_commande) === anneeCourante) produitsVendusAnnee += n
    } else if (e.categorie === 'sav' && !expeditionsRattachees.has(e.id)) {
      savTotal += 1
      if (annee(e.date_commande) === anneeCourante) savAnnee += 1
    }
  }

  return { produitsVendusTotal, produitsVendusAnnee, savTotal, savAnnee }
}

import { CategorieExpedition } from '../types'

export const CATEGORIE_LABEL: Record<CategorieExpedition, string> = {
  vente: 'Bouée complète',
  sav: 'SAV',
  don: 'Don',
  demo: 'Démo',
  autre: 'Autre',
}

export const CATEGORIE_BADGE: Record<CategorieExpedition, string> = {
  vente: 'bg-success-100 text-success-600',
  sav: 'bg-danger-100 text-danger-600',
  don: 'bg-alert-100 text-alert-600',
  demo: 'bg-alert-100 text-alert-600',
  autre: 'bg-primary-100 text-primary-600',
}

// Types proposés à la saisie d'une nouvelle vente. « Démo » et « Autre »
// restent acceptés en base pour les lignes historiques, mais ne sont plus
// proposés à la création.
export const CATEGORIES_VENTE: CategorieExpedition[] = ['vente', 'sav', 'don']

// Toutes les valeurs possibles, pour les listes de filtres.
export const CATEGORIES_TOUTES: CategorieExpedition[] = ['vente', 'sav', 'don', 'demo', 'autre']

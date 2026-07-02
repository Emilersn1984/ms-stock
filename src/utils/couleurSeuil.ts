import { CouleurSeuil, Piece } from '../types'

export function getCouleurSeuil(piece: Piece): CouleurSeuil {
  if (piece.quantite <= piece.seuil_rouge) return 'rouge'
  if (piece.quantite <= piece.seuil_jaune) return 'jaune'
  return 'vert'
}

export const BADGE_CLASSES: Record<CouleurSeuil, string> = {
  rouge: 'bg-danger-100 text-danger-700 border border-danger-300',
  jaune: 'bg-warning-100 text-warning-700 border border-warning-300',
  vert: 'bg-success-100 text-success-700 border border-success-300',
}

export const DOT_CLASSES: Record<CouleurSeuil, string> = {
  rouge: 'bg-danger-500',
  jaune: 'bg-warning-400',
  vert: 'bg-success-500',
}

export const COULEUR_LABEL: Record<CouleurSeuil, string> = {
  rouge: 'Critique',
  jaune: 'Faible',
  vert: 'OK',
}

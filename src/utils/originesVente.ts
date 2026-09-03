import { OrigineVente } from '../types'

export const ORIGINE_VENTE_LABEL: Record<OrigineVente, string> = {
  web: 'Web',
  salon: 'Salon nautique',
  b2b: 'B2B',
  autre: 'Autre',
}

export const ORIGINES_VENTE: OrigineVente[] = ['web', 'salon', 'b2b', 'autre']

// Origines d'une vente, en tolérant les lignes antérieures au multi-choix
// qui ne portent encore que l'ancienne colonne au singulier.
export function originesDeLaVente(
  vente: { origines_vente?: OrigineVente[] | null; origine_vente?: OrigineVente | null }
): OrigineVente[] {
  if (vente.origines_vente && vente.origines_vente.length > 0) return vente.origines_vente
  return vente.origine_vente ? [vente.origine_vente] : []
}

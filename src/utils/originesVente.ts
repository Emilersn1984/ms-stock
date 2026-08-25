import { OrigineVente } from '../types'

export const ORIGINE_VENTE_LABEL: Record<OrigineVente, string> = {
  web: 'Web',
  salon: 'Salon nautique',
  b2b: 'B2B',
  autre: 'Autre',
}

export const ORIGINES_VENTE: OrigineVente[] = ['web', 'salon', 'b2b', 'autre']

import { Transporteur } from '../types'

export const TRANSPORTEURS: { value: Transporteur; label: string }[] = [
  { value: 'colissimo', label: 'Colissimo' },
  { value: 'chronopost', label: 'Chronopost' },
  { value: 'ups', label: 'UPS' },
  { value: 'dhl', label: 'DHL' },
  { value: 'gls', label: 'GLS' },
  { value: 'autre', label: 'Autre' },
]

export function buildTrackingUrl(transporteur: Transporteur | null, numeroSuivi: string | null): string | null {
  if (!numeroSuivi || !numeroSuivi.trim()) return null
  const num = encodeURIComponent(numeroSuivi.trim())

  switch (transporteur) {
    case 'colissimo':
      return `https://www.laposte.fr/outils/suivre-vos-colis?code=${num}`
    case 'chronopost':
      return `https://www.chronopost.fr/tracking-no-cms/suivi-page?listeNumerosLT=${num}`
    case 'ups':
      return `https://www.ups.com/track?loc=fr_FR&tracknum=${num}`
    case 'dhl':
      return `https://www.dhl.com/fr-fr/home/tracking/tracking-express.html?tracking-id=${num}`
    case 'gls':
      return `https://gls-group.com/FR/fr/suivi-colis?match=${num}`
    default:
      return `https://www.google.com/search?q=${num}+suivi+colis`
  }
}

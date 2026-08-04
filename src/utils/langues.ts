import { Langue } from '../types'

export const LANGUES: { value: Langue; label: string; drapeau: string }[] = [
  { value: 'fr', label: 'Français', drapeau: '🇫🇷' },
  { value: 'en', label: 'Anglais', drapeau: '🇬🇧' },
  { value: 'de', label: 'Allemand', drapeau: '🇩🇪' },
  { value: 'es', label: 'Espagnol', drapeau: '🇪🇸' },
  { value: 'it', label: 'Italien', drapeau: '🇮🇹' },
  { value: 'nl', label: 'Néerlandais', drapeau: '🇳🇱' },
  { value: 'pt', label: 'Portugais', drapeau: '🇵🇹' },
]

export function drapeauLangue(langue: Langue | null | undefined): string {
  return LANGUES.find((l) => l.value === langue)?.drapeau ?? '🏳️'
}

export function labelLangue(langue: Langue | null | undefined): string {
  return LANGUES.find((l) => l.value === langue)?.label ?? '—'
}

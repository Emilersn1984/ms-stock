import { Expedition } from '../types'

/**
 * Numéros de série d'une expédition. Les lignes antérieures aux expéditions
 * multi-bouées n'ont que la colonne `numero_serie`.
 */
export function numerosSerieExpedition(
  expedition: { numeros_serie?: string[] | null; numero_serie?: string | null }
): string[] {
  const liste = expedition.numeros_serie?.filter((n) => n && n.trim()) ?? []
  if (liste.length > 0) return liste
  return expedition.numero_serie ? [expedition.numero_serie] : []
}

/**
 * Prochain numéro libre : le plus haut déjà distribué, incrémenté de `decalage`
 * (1 pour le suivant, 2 pour celui d'après…). `autresNumeros` ajoute ceux en
 * cours de saisie, pas encore enregistrés. On ne lit que la partie numérique
 * finale, pour rester tolérant aux anciens formats (« 00001 » comme « SN-26-00007 »).
 */
export function prochainNumeroSerie(
  expeditions: Expedition[],
  decalage = 1,
  autresNumeros: string[] = []
): string {
  let maximum = 0
  const numeros = [...expeditions.flatMap(numerosSerieExpedition), ...autresNumeros]
  for (const numero of numeros) {
    const chiffres = numero.match(/(\d+)\s*$/)
    if (!chiffres) continue
    const n = parseInt(chiffres[1], 10)
    if (Number.isFinite(n) && n > maximum) maximum = n
  }
  const annee = String(new Date().getFullYear()).slice(-2)
  return `SN-${annee}-${String(maximum + decalage).padStart(5, '0')}`
}

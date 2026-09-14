/**
 * Gestion des stocks JLC : reprise de la feuille « Compare » du fichier
 * « JLC Stock Manager ».
 *
 *   stock min = quantité par produit × nombre de produits à couvrir
 *   stock max = plus grand des deux stocks JLC (JLCPCB, Global Sourcing)
 *   manque    = stock max − stock min   (négatif = à réapprovisionner)
 */

export type LigneBomJlc = {
  id: string
  reference: string
  quantite_par_produit: number
  ordre: number
}

export type StockJlc = {
  reference: string
  mfr: string | null
  jlc: number
  globalSourcing: number
}

export type ManqueJlc = {
  reference: string
  mfr: string | null
  quantiteParProduit: number
  stockMin: number
  stockMax: number
  manque: number
  // La référence de la BOM ne figure pas dans l'inventaire : son stock est compté à 0.
  absente: boolean
}

type Cellule = string | number | boolean | Date | null | undefined

const normaliser = (v: Cellule) => String(v ?? '').trim().toLowerCase()

function nombre(v: Cellule): number {
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0
  const n = Number(String(v ?? '').replace(/\s/g, '').replace(',', '.'))
  return Number.isFinite(n) ? n : 0
}

/**
 * Lit les lignes d'un export « Parts Inventory on JLCPCB ». Les colonnes sont
 * repérées par leur en-tête, car leur position change d'un export à l'autre.
 */
export function lireInventaireJlc(lignes: Cellule[][]): Map<string, StockJlc> {
  const iEntete = lignes.findIndex((l) => l.some((c) => normaliser(c) === 'jlcpcb part #'))
  if (iEntete === -1) {
    throw new Error("Colonne « JLCPCB Part # » introuvable : ce fichier n'est pas un inventaire JLCPCB.")
  }
  const entete = lignes[iEntete].map(normaliser)
  const colonne = (test: (h: string) => boolean) => entete.findIndex(test)

  const iRef = colonne((h) => h === 'jlcpcb part #')
  const iJlc = colonne((h) => h.startsWith('jlcpcb parts qty'))
  const iGsp = colonne((h) => h.startsWith('global sourcing'))
  const iMfr = colonne((h) => h === 'mfr part #')
  if (iJlc === -1 && iGsp === -1) {
    throw new Error('Colonnes de quantité « JLCPCB Parts Qty » / « Global Sourcing Parts Qty » introuvables.')
  }

  const stocks = new Map<string, StockJlc>()
  for (const ligne of lignes.slice(iEntete + 1)) {
    const reference = String(ligne[iRef] ?? '').trim()
    if (!reference) continue
    const precedent = stocks.get(reference)
    // Une référence présente deux fois : on cumule ses lignes.
    stocks.set(reference, {
      reference,
      mfr: iMfr === -1 ? null : (String(ligne[iMfr] ?? '').trim() || null),
      jlc: (precedent?.jlc ?? 0) + (iJlc === -1 ? 0 : nombre(ligne[iJlc])),
      globalSourcing: (precedent?.globalSourcing ?? 0) + (iGsp === -1 ? 0 : nombre(ligne[iGsp])),
    })
  }
  return stocks
}

/** Toutes les lignes de la BOM avec leur manque, les plus critiques en premier. */
export function calculerManquesJlc(
  bom: LigneBomJlc[],
  stocks: Map<string, StockJlc>,
  nombreProduits: number
): ManqueJlc[] {
  return bom
    .map((ligne) => {
      const stock = stocks.get(ligne.reference)
      const stockMin = ligne.quantite_par_produit * nombreProduits
      const stockMax = stock ? Math.max(stock.jlc, stock.globalSourcing) : 0
      return {
        reference: ligne.reference,
        mfr: stock?.mfr ?? null,
        quantiteParProduit: ligne.quantite_par_produit,
        stockMin,
        stockMax,
        manque: stockMax - stockMin,
        absente: !stock,
      }
    })
    .sort((a, b) => a.manque - b.manque)
}

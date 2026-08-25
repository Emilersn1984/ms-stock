import { calcBesoinPieces } from './calcDisponibilite'
import { Commande, Piece } from '../types'

type NomenclatureRow = {
  piece_id: string | null
  sous_ensemble_id: string
  sous_ensemble_enfant_id: string | null
  quantite_requise: number
}

export type ReapproMois = {
  // Coût total des réapprovisionnements déclenchés ce mois-là.
  cout: number
  // Détail : une entrée par pièce passée sous son seuil critique.
  lignes: { nom: string; moq: number; prixUnitaire: number; cout: number }[]
}

/**
 * Projette les achats de matières premières sur N mois.
 *
 * Modèle : chaque mois, la production nécessaire pour honorer l'objectif de
 * vente consomme les pièces selon la nomenclature du produit fini. Dès qu'une
 * pièce tombe à son seuil critique (rouge), on rachète **un MOQ complet** —
 * pas seulement de quoi repasser au-dessus du seuil — au prix unitaire saisi.
 * Le stock est recrédité du MOQ, ce qui peut éviter un rachat le mois suivant.
 *
 * Les commandes déjà passées et non encore réceptionnées sont comptées comme
 * du stock à venir : une pièce sous son seuil mais déjà réapprovisionnée ne
 * déclenche pas de rachat.
 *
 * Une pièce sans MOQ ou sans prix unitaire ne peut pas être chiffrée : elle est
 * ignorée et remontée dans `piecesNonChiffrees`.
 */
export function projeterAchatsMatieresPremieres({
  sousEnsembleBoueeId,
  objectifVenteMensuel,
  nbMois,
  pieces,
  nomenclature,
  commandesEnCours = [],
}: {
  sousEnsembleBoueeId: string | null
  objectifVenteMensuel: number
  nbMois: number
  pieces: Piece[]
  nomenclature: NomenclatureRow[]
  commandesEnCours?: Commande[]
}): { mois: ReapproMois[]; piecesNonChiffrees: string[] } {
  const mois: ReapproMois[] = Array.from({ length: nbMois }, () => ({ cout: 0, lignes: [] }))
  const piecesNonChiffrees = new Set<string>()

  if (!sousEnsembleBoueeId || objectifVenteMensuel <= 0) {
    return { mois, piecesNonChiffrees: [] }
  }

  // Consommation mensuelle de chaque pièce, nomenclature dépliée.
  const besoinMensuel = calcBesoinPieces(sousEnsembleBoueeId, objectifVenteMensuel, nomenclature)

  // Stock simulé, initialisé au stock réel d'aujourd'hui, augmenté de ce qui
  // est déjà commandé et pas encore reçu : ce réappro-là n'est pas à reprévoir.
  const stock = new Map<string, number>()
  for (const p of pieces) stock.set(p.id, p.quantite)
  for (const c of commandesEnCours) {
    if (c.statut !== 'en_cours') continue
    stock.set(c.piece_id, (stock.get(c.piece_id) ?? 0) + c.quantite_commandee)
  }

  for (let m = 0; m < nbMois; m++) {
    for (const [pieceId, besoin] of besoinMensuel) {
      const piece = pieces.find((p) => p.id === pieceId)
      if (!piece || besoin <= 0) continue

      const restant = (stock.get(pieceId) ?? 0) - besoin
      stock.set(pieceId, restant)

      if (restant > piece.seuil_rouge) continue

      // Seuil critique atteint : on rachète un MOQ.
      if (piece.moq == null || piece.prix_unitaire == null) {
        piecesNonChiffrees.add(piece.nom)
        continue
      }
      const cout = piece.moq * piece.prix_unitaire
      mois[m].cout += cout
      mois[m].lignes.push({
        nom: piece.nom,
        moq: piece.moq,
        prixUnitaire: piece.prix_unitaire,
        cout,
      })
      stock.set(pieceId, restant + piece.moq)
    }
    mois[m].lignes.sort((a, b) => b.cout - a.cout)
  }

  return { mois, piecesNonChiffrees: [...piecesNonChiffrees].sort((a, b) => a.localeCompare(b, 'fr')) }
}

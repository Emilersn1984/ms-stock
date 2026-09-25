import { Client, Expedition, Langue } from '../types'

/**
 * Un client à qui proposer un SAV. `clientId` est NULL pour les clients connus
 * seulement par leurs ventes : l'import initial de l'historique n'a pas créé de
 * fiche pour eux, et il ne faut pas les rendre introuvables pour autant.
 */
export type ClientConnu = {
  clientId: string | null
  nom: string
  prenom: string
  ville: string | null
  langue: Langue | null
  adresse: string | null
  code_postal: string | null
  pays: string | null
}

/** Clé de rapprochement : insensible à la casse, aux accents et aux espaces. */
function cle(prenom: string, nom: string): string {
  return `${prenom} ${nom}`
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Fusionne les fiches clients et les destinataires des ventes. Une fiche client
 * prime toujours sur une ligne de vente ; pour un client sans fiche, on garde
 * l'adresse de sa vente la plus récente.
 */
export function clientsConnus(clients: Client[], expeditions: Expedition[]): ClientConnu[] {
  const parCle = new Map<string, ClientConnu>()

  for (const c of clients) {
    parCle.set(cle(c.prenom, c.nom), {
      clientId: c.id,
      nom: c.nom,
      prenom: c.prenom,
      ville: c.ville,
      langue: c.langue,
      adresse: c.adresse,
      code_postal: c.code_postal,
      pays: c.pays,
    })
  }

  const parDateDecroissante = [...expeditions].sort(
    (a, b) => new Date(b.date_commande).getTime() - new Date(a.date_commande).getTime()
  )

  for (const e of parDateDecroissante) {
    const nom = (e.nom_destinataire ?? '').trim()
    const prenom = (e.prenom_destinataire ?? '').trim()
    if (!nom && !prenom) continue
    const k = cle(prenom, nom)
    if (parCle.has(k)) continue
    parCle.set(k, {
      clientId: e.client_id,
      nom,
      prenom,
      ville: e.ville,
      langue: e.langue,
      adresse: e.adresse,
      code_postal: e.code_postal,
      pays: e.pays,
    })
  }

  return [...parCle.values()].sort((a, b) => a.nom.localeCompare(b.nom, 'fr'))
}

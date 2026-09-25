import { supabase } from '../lib/supabase'
import { ExpeditionItem } from '../types'
import { ClientConnu } from './clientsConnus'

type ParamsRenvoi = {
  // Colis de renvoi déjà créé pour ce SAV, s'il existe.
  expeditionId: string | null
  client: ClientConnu | null
  nomClient: string
  prenomClient: string
  dateSav: string
  dateRenvoiPrevue: string | null
  materiel: ExpeditionItem[]
  description: string | null
  utilisateurId: string
}

/** Statut du colis de renvoi, ou null s'il n'existe plus. */
async function statutExpedition(id: string): Promise<string | null> {
  const { data } = await supabase.from('expeditions').select('statut').eq('id', id).maybeSingle()
  return (data?.statut as string | undefined) ?? null
}

/**
 * Crée, met à jour ou retire le colis de renvoi au client correspondant à un SAV.
 * Renvoie l'id de l'expédition à enregistrer dans sav.expedition_id.
 *
 * Un colis déjà parti n'est jamais retouché : son contenu a été décompté du
 * stock à l'expédition, le modifier ici fausserait les quantités.
 */
export async function synchroniserRenvoiSav(p: ParamsRenvoi): Promise<string | null> {
  const statut = p.expeditionId ? await statutExpedition(p.expeditionId) : null
  const expeditionExistante = statut !== null ? p.expeditionId : null

  if (expeditionExistante && statut !== 'a_expedier') return expeditionExistante

  // Plus de date de renvoi : le colis encore à expédier n'a plus lieu d'être.
  if (!p.dateRenvoiPrevue) {
    if (expeditionExistante) await supabase.from('expeditions').delete().eq('id', expeditionExistante)
    return null
  }

  const champs = {
    client_id: p.client?.clientId ?? null,
    nom_destinataire: p.nomClient,
    prenom_destinataire: p.prenomClient,
    langue: p.client?.langue ?? null,
    adresse: p.client?.adresse ?? null,
    ville: p.client?.ville ?? null,
    code_postal: p.client?.code_postal ?? null,
    pays: p.client?.pays ?? null,
    categorie: 'sav' as const,
    commentaire: p.description?.trim() ? `SAV : ${p.description.trim()}` : 'SAV',
    items: p.materiel,
    date_commande: new Date(p.dateSav).toISOString(),
    date_envoi_previsionnelle: p.dateRenvoiPrevue,
  }

  if (expeditionExistante) {
    const { error } = await supabase.from('expeditions').update(champs).eq('id', expeditionExistante)
    if (error) throw error
    return expeditionExistante
  }

  const { data, error } = await supabase
    .from('expeditions')
    .insert({ ...champs, statut: 'a_expedier', origine: 'manuel', utilisateur_id: p.utilisateurId })
    .select('id')
    .single()
  if (error) throw error
  return data?.id ?? null
}

/**
 * Suppression d'un SAV : on retire le colis de renvoi s'il n'est pas encore
 * parti, on le laisse sinon (il fait alors partie de l'historique d'expédition).
 */
export async function supprimerRenvoiSav(expeditionId: string | null): Promise<void> {
  if (!expeditionId) return
  const statut = await statutExpedition(expeditionId)
  if (statut === 'a_expedier') {
    await supabase.from('expeditions').delete().eq('id', expeditionId)
  }
}

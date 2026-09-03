export type Role = 'ouvrier' | 'patron' | 'autre'

export type Utilisateur = {
  id: string
  nom: string
  prenom: string
  role: Role
  created_at: string
}

export type Piece = {
  id: string
  nom: string
  quantite: number
  seuil_rouge: number
  seuil_jaune: number
  seuil_vert: number
  categorie: string | null
  description: string | null
  commentaire: string | null
  archivee: boolean
  photo_url: string | null
  delai_appro: number | null
  prix_unitaire: number | null
  moq: number | null
  est_impression_3d: boolean
  temps_impression_heures: number | null
  created_at: string
}

export type Production = {
  id: string
  sous_ensemble_id: string
  quantite: number
  utilisateur_id: string | null
  created_at: string
}

export type SousEnsemble = {
  id: string
  nom: string
  description: string | null
  quantite: number
  photo_url: string | null
  created_at: string
}

export type Nomenclature = {
  id: string
  sous_ensemble_id: string
  piece_id: string | null
  sous_ensemble_enfant_id: string | null
  quantite_requise: number
}

export type TypeOperation = 'livraison' | 'fabrication' | 'correction' | 'ajout_piece' | 'expedition'

export type Operation = {
  id: string
  type: TypeOperation
  piece_id: string | null
  sous_ensemble_id: string | null
  quantite_avant: number | null
  quantite_apres: number | null
  delta: number | null
  utilisateur_id: string
  commentaire: string | null
  created_at: string
}

export type AlerteManuelle = {
  id: string
  message: string
  commentaire: string | null
  utilisateur_id: string
  resolue: boolean
  created_at: string
}

export type CouleurSeuil = 'rouge' | 'jaune' | 'vert'

export type Transporteur = 'colissimo' | 'chronopost' | 'ups' | 'dhl' | 'fedex' | 'gls' | 'autre'

export type StatutCommande = 'en_cours' | 'receptionnee'

export type Commande = {
  id: string
  piece_id: string
  quantite_commandee: number
  date_commande: string
  date_livraison_prevue: string | null
  transporteur: Transporteur | null
  numero_suivi: string | null
  statut: StatutCommande
  date_reception: string | null
  montant_paye: number | null
  // Lignes d'une même commande multi-références. Le montant n'est porté que
  // par la première ligne du groupe.
  groupe_id: string | null
  utilisateur_id: string | null
  created_at: string
  pieces?: { nom: string } | null
}

export type Langue = 'fr' | 'en' | 'de' | 'es' | 'it' | 'nl' | 'pt'

export type CategorieExpedition = 'vente' | 'sav' | 'demo' | 'autre' | 'don'

export type StatutExpedition = 'a_expedier' | 'envoye' | 'receptionne'

export type OrigineExpedition = 'manuel' | 'stripe'

// Origine commerciale d'une vente, à ne pas confondre avec OrigineExpedition
// qui décrit la façon dont la ligne est entrée dans l'application.
export type OrigineVente = 'web' | 'salon' | 'b2b' | 'autre'

export type Client = {
  id: string
  nom: string
  prenom: string
  langue: Langue | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  pays: string | null
  email: string | null
  telephone: string | null
  created_at: string
}

export type ExpeditionItem = {
  sous_ensemble_id: string | null
  piece_id: string | null
  nom: string
  quantite: number
}

export type Expedition = {
  id: string
  statut: StatutExpedition
  origine: OrigineExpedition
  stripe_session_id: string | null
  client_id: string | null
  nom_destinataire: string
  prenom_destinataire: string
  langue: Langue | null
  adresse: string | null
  ville: string | null
  code_postal: string | null
  pays: string | null
  version_code: string | null
  categorie: CategorieExpedition | null
  commentaire: string | null
  transporteur: Transporteur | null
  numero_suivi: string | null
  numero_serie: string | null
  montant_paye: number | null
  origine_vente: OrigineVente | null
  origines_vente: OrigineVente[] | null
  commentaire_origine: string | null
  type_bateau: string | null
  items: ExpeditionItem[]
  date_commande: string
  date_envoi_previsionnelle: string | null
  date_expedition: string | null
  date_reception: string | null
  utilisateur_id: string | null
  created_at: string
  clients?: { id: string; nom: string; prenom: string } | null
}

export type SectionProjection = 'recettes' | 'depenses'

// Une ligne du plan de trésorerie sur 3 mois. Un montant à NULL sur une ligne
// « auto » signifie « garder la valeur calculée » ; une valeur saisie la remplace.
export type LigneProjection = {
  id: string
  section: SectionProjection
  categorie: string
  libelle: string
  ordre: number
  montant_m0: number | null
  montant_m1: number | null
  montant_m2: number | null
  auto: 'ca' | 'achats_mp' | null
  created_at: string
}

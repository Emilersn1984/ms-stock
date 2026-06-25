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
  archivee: boolean
  created_at: string
}

export type SousEnsemble = {
  id: string
  nom: string
  description: string | null
  created_at: string
}

export type Nomenclature = {
  id: string
  sous_ensemble_id: string
  piece_id: string | null
  sous_ensemble_enfant_id: string | null
  quantite_requise: number
}

export type TypeOperation = 'livraison' | 'fabrication' | 'correction' | 'ajout_piece'

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
  utilisateur_id: string
  resolue: boolean
  created_at: string
}

export type CouleurSeuil = 'rouge' | 'jaune' | 'vert'

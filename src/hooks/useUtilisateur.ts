import { useState } from 'react'
import { Utilisateur } from '../types'

const STORAGE_KEY = 'ms_stock_utilisateur'

export function useUtilisateur() {
  const [utilisateur, setUtilisateur] = useState<Utilisateur | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })

  function connecter(user: Utilisateur) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(user))
    setUtilisateur(user)
  }

  function deconnecter() {
    localStorage.removeItem(STORAGE_KEY)
    setUtilisateur(null)
  }

  return { utilisateur, connecter, deconnecter }
}

export function getUtilisateurStored(): Utilisateur | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    return stored ? JSON.parse(stored) : null
  } catch {
    return null
  }
}

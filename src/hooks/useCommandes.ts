import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Commande } from '../types'

export function useCommandes() {
  const [commandes, setCommandes] = useState<Commande[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const chargerCommandes = useCallback(async () => {
    const { data, error } = await supabase
      .from('commandes')
      .select('*, pieces(nom)')
      .order('created_at', { ascending: false })

    if (error) {
      setErreur(error.message)
    } else {
      setCommandes((data as unknown as Commande[]) ?? [])
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    chargerCommandes()

    const channel = supabase
      .channel('commandes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'commandes' },
        () => { chargerCommandes() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chargerCommandes])

  const commandesEnCours = commandes.filter((c) => c.statut === 'en_cours')
  const commandesRecues = commandes.filter((c) => c.statut === 'receptionnee')

  return { commandes, commandesEnCours, commandesRecues, chargement, erreur, recharger: chargerCommandes }
}

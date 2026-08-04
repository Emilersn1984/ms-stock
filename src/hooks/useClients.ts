import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Client } from '../types'

export function useClients() {
  const [clients, setClients] = useState<Client[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const chargerClients = useCallback(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('nom', { ascending: true })

    if (error) {
      setErreur(error.message)
    } else {
      setClients((data as Client[]) ?? [])
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    chargerClients()

    const channel = supabase
      .channel('clients-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'clients' },
        () => { chargerClients() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chargerClients])

  return { clients, chargement, erreur, recharger: chargerClients }
}

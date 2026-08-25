import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { SousEnsemble } from '../types'

export function useSousEnsemblesStock() {
  const [sousEnsembles, setSousEnsembles] = useState<SousEnsemble[]>([])
  const [chargement, setChargement] = useState(true)

  async function charger() {
    const { data } = await supabase
      .from('sous_ensembles')
      .select('*')
      .order('nom', { ascending: true })
    setSousEnsembles((data as SousEnsemble[]) ?? [])
    setChargement(false)
  }

  useEffect(() => {
    charger()

    const channel = supabase
      .channel(`se-stock-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sous_ensembles' },
        () => { charger() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { sousEnsembles, chargement, recharger: charger }
}

import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Sav } from '../types'

/** Reprises de SAV, les plus récentes en premier. */
export function useSav() {
  const [savs, setSavs] = useState<Sav[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('sav')
      .select('*')
      .order('date_sav', { ascending: false })

    if (error) setErreur(error.message)
    else setSavs((data as Sav[]) ?? [])
    setChargement(false)
  }, [])

  useEffect(() => {
    charger()

    const channel = supabase
      .channel(`sav-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sav' },
        () => { charger() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [charger])

  const supprimer = useCallback(async (id: string) => {
    const { error } = await supabase.from('sav').delete().eq('id', id)
    if (error) setErreur(error.message)
    charger()
  }, [charger])

  return { savs, chargement, erreur, recharger: charger, supprimer }
}

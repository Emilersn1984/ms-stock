import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { AlerteManuelle } from '../types'

export function useAlertes() {
  const [alertes, setAlertes] = useState<AlerteManuelle[]>([])
  const [chargement, setChargement] = useState(true)

  async function charger() {
    const { data } = await supabase
      .from('alertes_manuelles')
      .select('*')
      .eq('resolue', false)
      .order('created_at', { ascending: false })
    setAlertes(data ?? [])
    setChargement(false)
  }

  async function creerAlerte(message: string, utilisateur_id: string, commentaire?: string) {
    const payload: Record<string, unknown> = { message, utilisateur_id, resolue: false }
    if (commentaire?.trim()) payload.commentaire = commentaire.trim()
    await supabase.from('alertes_manuelles').insert(payload)
  }

  async function resoudreAlerte(id: string) {
    await supabase.from('alertes_manuelles').update({ resolue: true }).eq('id', id)
  }

  useEffect(() => {
    charger()

    const channel = supabase
      .channel('alertes-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alertes_manuelles' },
        () => { charger() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { alertes, chargement, creerAlerte, resoudreAlerte, recharger: charger }
}

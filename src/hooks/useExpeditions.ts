import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { Expedition } from '../types'

export function useExpeditions() {
  const [expeditions, setExpeditions] = useState<Expedition[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const chargerExpeditions = useCallback(async () => {
    const { data, error } = await supabase
      .from('expeditions')
      .select('*, clients(id, nom, prenom)')
      .order('created_at', { ascending: false })
      .limit(1000)

    if (error) {
      setErreur(error.message)
    } else {
      setExpeditions((data as unknown as Expedition[]) ?? [])
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    chargerExpeditions()

    const channel = supabase
      .channel('expeditions-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'expeditions' },
        () => { chargerExpeditions() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [chargerExpeditions])

  const aExpedier = expeditions
    .filter((e) => e.statut === 'a_expedier')
    .sort((a, b) => new Date(a.date_commande).getTime() - new Date(b.date_commande).getTime())

  const envoyees = expeditions
    .filter((e) => e.statut === 'envoye')
    .sort((a, b) => {
      const dA = a.date_expedition ? new Date(a.date_expedition).getTime() : 0
      const dB = b.date_expedition ? new Date(b.date_expedition).getTime() : 0
      return dB - dA
    })

  const historique = expeditions
    .filter((e) => e.statut === 'receptionne')
    .sort((a, b) => {
      const dA = a.date_reception ? new Date(a.date_reception).getTime() : 0
      const dB = b.date_reception ? new Date(b.date_reception).getTime() : 0
      return dB - dA
    })

  return { expeditions, aExpedier, envoyees, historique, chargement, erreur, recharger: chargerExpeditions }
}

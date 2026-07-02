import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { Piece } from '../types'

export function useStock() {
  const [pieces, setPieces] = useState<Piece[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  async function chargerPieces() {
    const { data, error } = await supabase
      .from('pieces')
      .select('*')
      .eq('archivee', false)
      .order('nom', { ascending: true })

    if (error) {
      setErreur(error.message)
    } else {
      setPieces(data ?? [])
    }
    setChargement(false)
  }

  useEffect(() => {
    chargerPieces()

    const channel = supabase
      .channel('pieces-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pieces' },
        () => { chargerPieces() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  return { pieces, chargement, erreur, recharger: chargerPieces }
}

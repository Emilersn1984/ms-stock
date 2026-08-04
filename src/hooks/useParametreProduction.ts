import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Valeur réglée à la main : nombre de "Colis terminé fermé" à produire
// par semaine. Persistée en base (table singleton `parametres`) afin
// d'être conservée d'une connexion à l'autre, pour tous les utilisateurs.
export function useParametreProduction() {
  const [colisParSemaine, setColisParSemaine] = useState(0)
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('parametres')
      .select('colis_fermes_par_semaine')
      .eq('id', 1)
      .single()

    if (error) {
      setErreur(error.message)
    } else {
      setColisParSemaine((data?.colis_fermes_par_semaine as number) ?? 0)
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    charger()

    const channel = supabase
      .channel('parametres-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'parametres' },
        () => { charger() }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [charger])

  const definirColisParSemaine = useCallback(async (valeur: number) => {
    setColisParSemaine(valeur)
    setEnregistrement(true)
    setErreur(null)
    const { error } = await supabase
      .from('parametres')
      .update({ colis_fermes_par_semaine: valeur, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) setErreur(error.message)
    setEnregistrement(false)
  }, [])

  return { colisParSemaine, definirColisParSemaine, chargement, enregistrement, erreur }
}

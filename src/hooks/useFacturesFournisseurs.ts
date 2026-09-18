import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { FactureFournisseur } from '../types'

/** Factures fournisseurs à payer, les échéances les plus proches en premier. */
export function useFacturesFournisseurs() {
  const [factures, setFactures] = useState<FactureFournisseur[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('factures_fournisseurs')
      .select('*')
      .order('date_echeance', { ascending: true })

    if (error) setErreur(error.message)
    else setFactures((data as FactureFournisseur[]) ?? [])
    setChargement(false)
  }, [])

  useEffect(() => {
    charger()

    const channel = supabase
      .channel(`factures-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'factures_fournisseurs' },
        () => { charger() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [charger])

  const ajouter = useCallback(async (facture: {
    fournisseur: string
    libelle: string | null
    montant_ttc: number
    date_echeance: string
  }) => {
    const { error } = await supabase.from('factures_fournisseurs').insert(facture)
    if (error) setErreur(error.message)
    else { setErreur(null); charger() }
  }, [charger])

  // Mise à jour optimiste : le champ reste fluide à la saisie, la base suit.
  const modifier = useCallback(async (id: string, champs: Partial<FactureFournisseur>) => {
    setFactures((prev) => prev.map((f) => (f.id === id ? { ...f, ...champs } : f)))
    const { error } = await supabase.from('factures_fournisseurs').update(champs).eq('id', id)
    if (error) { setErreur(error.message); charger() }
  }, [charger])

  const supprimer = useCallback(async (id: string) => {
    const { error } = await supabase.from('factures_fournisseurs').delete().eq('id', id)
    if (error) setErreur(error.message)
    charger()
  }, [charger])

  return { factures, chargement, erreur, ajouter, modifier, supprimer }
}

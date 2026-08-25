import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { LigneProjection } from '../types'

export function useProjections() {
  const [lignes, setLignes] = useState<LigneProjection[]>([])
  const [chargement, setChargement] = useState(true)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('projections_lignes')
      .select('*')
      .order('section', { ascending: true })
      .order('ordre', { ascending: true })

    if (error) setErreur(error.message)
    else setLignes((data as LigneProjection[]) ?? [])
    setChargement(false)
  }, [])

  useEffect(() => {
    charger()

    const channel = supabase
      .channel(`projections-realtime-${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'projections_lignes' },
        () => { charger() }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [charger])

  // Mise à jour optimiste : la cellule reste fluide à la frappe, la base suit.
  const definirMontant = useCallback(async (id: string, mois: 0 | 1 | 2, valeur: number | null) => {
    const colonne = `montant_m${mois}` as 'montant_m0' | 'montant_m1' | 'montant_m2'
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, [colonne]: valeur } : l)))
    const { error } = await supabase
      .from('projections_lignes')
      .update({ [colonne]: valeur })
      .eq('id', id)
    if (error) setErreur(error.message)
  }, [])

  const renommerLigne = useCallback(async (id: string, libelle: string) => {
    setLignes((prev) => prev.map((l) => (l.id === id ? { ...l, libelle } : l)))
    const { error } = await supabase.from('projections_lignes').update({ libelle }).eq('id', id)
    if (error) setErreur(error.message)
  }, [])

  const ajouterLigne = useCallback(async (
    section: 'recettes' | 'depenses',
    categorie: string,
    libelle: string
  ) => {
    // La nouvelle ligne se place à la fin de sa catégorie.
    const { data: existantes } = await supabase
      .from('projections_lignes')
      .select('ordre')
      .eq('section', section)
      .order('ordre', { ascending: false })
      .limit(1)
    const ordre = ((existantes?.[0]?.ordre as number | undefined) ?? 0) + 10

    const { error } = await supabase
      .from('projections_lignes')
      .insert({ section, categorie, libelle, ordre })
    if (error) setErreur(error.message)
    else await charger()
  }, [charger])

  /**
   * Décale toutes les lignes d'un mois vers la gauche : le mois en cours est
   * abandonné, m1 devient m0, m2 devient m1, et le nouveau troisième mois
   * repart vide. Les lignes automatiques (CA, achats MP) se recalculent
   * d'elles-mêmes sur la nouvelle fenêtre.
   */
  const decalerDunMois = useCallback(async () => {
    const decalees = lignes.map((l) => ({
      id: l.id,
      section: l.section,
      categorie: l.categorie,
      libelle: l.libelle,
      ordre: l.ordre,
      auto: l.auto,
      montant_m0: l.montant_m1,
      montant_m1: l.montant_m2,
      montant_m2: null,
    }))
    setLignes((prev) => prev.map((l) => ({
      ...l, montant_m0: l.montant_m1, montant_m1: l.montant_m2, montant_m2: null,
    })))
    const { error } = await supabase.from('projections_lignes').upsert(decalees)
    if (error) setErreur(error.message)
    await charger()
  }, [lignes, charger])

  const supprimerLigne = useCallback(async (id: string) => {
    setLignes((prev) => prev.filter((l) => l.id !== id))
    const { error } = await supabase.from('projections_lignes').delete().eq('id', id)
    if (error) setErreur(error.message)
  }, [])

  return { lignes, chargement, erreur, recharger: charger, definirMontant, renommerLigne, ajouterLigne, supprimerLigne, decalerDunMois }
}

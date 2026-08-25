import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

// Semaines moyennes par mois (52 / 12), pour convertir l'objectif de vente
// mensuel en cadence hebdomadaire là où les calculs raisonnent en semaines.
export const SEMAINES_PAR_MOIS = 52 / 12

/**
 * Paramètres réglés à la main, persistés dans la table singleton `parametres`
 * pour être partagés entre tous les utilisateurs.
 */
export function useParametreProduction() {
  // Objectif de vente mensuel, en produits finis.
  const [objectifVenteMensuel, setObjectifVenteMensuel] = useState(0)
  const [prixVenteMoyenTtc, setPrixVenteMoyenTtc] = useState(0)
  const [tresorerieInitiale, setTresorerieInitiale] = useState(0)
  // Premier des 3 mois affichés dans Projections, au format YYYY-MM-DD.
  const [projectionsMoisDebut, setProjectionsMoisDebut] = useState<string | null>(null)
  // Sous-ensemble considéré comme une « bouée complète » à l'expédition.
  const [sousEnsembleBoueeId, setSousEnsembleBoueeId] = useState<string | null>(null)
  const [chargement, setChargement] = useState(true)
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const charger = useCallback(async () => {
    const { data, error } = await supabase
      .from('parametres')
      .select('objectif_vente_mensuel, prix_vente_moyen_ttc, tresorerie_initiale, sous_ensemble_bouee_id, projections_mois_debut')
      .eq('id', 1)
      .single()

    if (error) {
      setErreur(error.message)
    } else {
      setObjectifVenteMensuel((data?.objectif_vente_mensuel as number) ?? 0)
      setPrixVenteMoyenTtc(Number(data?.prix_vente_moyen_ttc ?? 0))
      setTresorerieInitiale(Number(data?.tresorerie_initiale ?? 0))
      setSousEnsembleBoueeId((data?.sous_ensemble_bouee_id as string | null) ?? null)
      setProjectionsMoisDebut((data?.projections_mois_debut as string | null) ?? null)
    }
    setChargement(false)
  }, [])

  useEffect(() => {
    charger()

    const channel = supabase
      .channel(`parametres-realtime-${Math.random().toString(36).slice(2)}`)
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

  const enregistrerParametre = useCallback(async (colonne: string, valeur: number) => {
    setEnregistrement(true)
    setErreur(null)
    const { error } = await supabase
      .from('parametres')
      .update({ [colonne]: valeur, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) setErreur(error.message)
    setEnregistrement(false)
  }, [])

  const definirObjectifVenteMensuel = useCallback(async (valeur: number) => {
    setObjectifVenteMensuel(valeur)
    await enregistrerParametre('objectif_vente_mensuel', valeur)
  }, [enregistrerParametre])

  const definirPrixVenteMoyenTtc = useCallback(async (valeur: number) => {
    setPrixVenteMoyenTtc(valeur)
    await enregistrerParametre('prix_vente_moyen_ttc', valeur)
  }, [enregistrerParametre])

  const definirTresorerieInitiale = useCallback(async (valeur: number) => {
    setTresorerieInitiale(valeur)
    await enregistrerParametre('tresorerie_initiale', valeur)
  }, [enregistrerParametre])

  // Avance d'un mois la fenêtre de projection. Déclenché à la main.
  const avancerMoisProjections = useCallback(async () => {
    const base = projectionsMoisDebut ? new Date(projectionsMoisDebut) : new Date()
    const suivant = new Date(base.getFullYear(), base.getMonth() + 1, 1)
    const iso = `${suivant.getFullYear()}-${String(suivant.getMonth() + 1).padStart(2, '0')}-01`
    setProjectionsMoisDebut(iso)
    setEnregistrement(true)
    const { error } = await supabase
      .from('parametres')
      .update({ projections_mois_debut: iso, updated_at: new Date().toISOString() })
      .eq('id', 1)
    if (error) setErreur(error.message)
    setEnregistrement(false)
  }, [projectionsMoisDebut])

  // Cadence hebdomadaire équivalente, pour les achats recommandés et la 3D.
  const objectifVenteHebdo = objectifVenteMensuel / SEMAINES_PAR_MOIS

  return {
    objectifVenteMensuel,
    objectifVenteHebdo,
    prixVenteMoyenTtc,
    tresorerieInitiale,
    sousEnsembleBoueeId,
    projectionsMoisDebut,
    definirObjectifVenteMensuel,
    definirPrixVenteMoyenTtc,
    definirTresorerieInitiale,
    avancerMoisProjections,
    chargement,
    enregistrement,
    erreur,
  }
}

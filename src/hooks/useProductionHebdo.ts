import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export type ProductionHebdo = {
  sous_ensemble_id: string
  nom: string
  quantite: number
}

function grouperParSousEnsemble(data: any[]): Record<string, { nom: string; quantite: number }> {
  const grouped: Record<string, { nom: string; quantite: number }> = {}
  for (const row of data) {
    const seId = row.sous_ensemble_id as string
    const seNom = Array.isArray(row.sous_ensembles)
      ? (row.sous_ensembles[0]?.nom ?? 'Inconnu')
      : (row.sous_ensembles?.nom ?? 'Inconnu')
    if (!grouped[seId]) {
      grouped[seId] = { nom: seNom as string, quantite: 0 }
    }
    grouped[seId].quantite += row.quantite as number
  }
  return grouped
}

export function useProductionHebdo() {
  const [productions, setProductions] = useState<ProductionHebdo[]>([])
  const [totalHebdo, setTotalHebdo] = useState(0)
  const [consommationMoyenne, setConsommationMoyenne] = useState<ProductionHebdo[]>([])
  const [chargement, setChargement] = useState(true)

  useEffect(() => {
    async function charger() {
      const now = new Date()
      const jourSemaine = now.getDay() === 0 ? 6 : now.getDay() - 1
      const debutSemaine = new Date(now)
      debutSemaine.setDate(now.getDate() - jourSemaine)
      debutSemaine.setHours(0, 0, 0, 0)

      const debutSemainePrecedente = new Date(debutSemaine)
      debutSemainePrecedente.setDate(debutSemainePrecedente.getDate() - 7)

      const [{ data: dataSemaine }, { data: dataSemainePrecedente }] = await Promise.all([
        supabase
          .from('productions')
          .select('sous_ensemble_id, quantite, sous_ensembles(nom)')
          .gte('created_at', debutSemaine.toISOString()),
        supabase
          .from('productions')
          .select('sous_ensemble_id, quantite, sous_ensembles(nom)')
          .gte('created_at', debutSemainePrecedente.toISOString())
          .lt('created_at', debutSemaine.toISOString()),
      ])

      let listSemaine: ProductionHebdo[] = []
      if (dataSemaine) {
        const grouped = grouperParSousEnsemble(dataSemaine as any[])
        listSemaine = Object.entries(grouped).map(([id, v]) => ({
          sous_ensemble_id: id,
          nom: v.nom,
          quantite: v.quantite,
        }))
        setProductions(listSemaine)
        const boueeMeca = listSemaine.find((p) => p.nom.trim().toLowerCase() === 'bouée méca')
        setTotalHebdo(boueeMeca?.quantite ?? 0)
      }

      let listPrecedente: ProductionHebdo[] = []
      if (dataSemainePrecedente) {
        const grouped = grouperParSousEnsemble(dataSemainePrecedente as any[])
        listPrecedente = Object.entries(grouped).map(([id, v]) => ({
          sous_ensemble_id: id,
          nom: v.nom,
          quantite: v.quantite,
        }))
      }

      // Approche conservatrice: on garde, pour chaque sous-ensemble, la plus
      // grande des deux valeurs entre la semaine en cours et la semaine
      // précédente, afin de ne jamais sous-estimer la consommation récente.
      const parId: Record<string, ProductionHebdo> = {}
      for (const p of listPrecedente) parId[p.sous_ensemble_id] = { ...p }
      for (const p of listSemaine) {
        const existant = parId[p.sous_ensemble_id]
        if (!existant || p.quantite > existant.quantite) {
          parId[p.sous_ensemble_id] = { ...p }
        }
      }
      setConsommationMoyenne(Object.values(parId))

      setChargement(false)
    }
    charger()
  }, [])

  return { productions, totalHebdo, consommationMoyenne, chargement }
}

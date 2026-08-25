import { useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import GraphiqueLigne, { PointGraphe } from './GraphiqueLigne'
import { Expedition } from '../types'

const NB_MOIS = 12

function cleMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function labelMois(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short' })
}

/** Chiffre d'affaires HT par mois sur les 12 derniers mois glissants. */
export default function GraphiqueCaMensuel({ ventes }: { ventes: Expedition[] }) {
  const mois = useMemo(() => {
    const maintenant = new Date()
    const buckets = Array.from({ length: NB_MOIS }, (_, i) => {
      const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - (NB_MOIS - 1 - i), 1)
      return { cle: cleMois(d), label: labelMois(d), total: 0 }
    })
    const index = new Map(buckets.map((b) => [b.cle, b]))

    for (const v of ventes) {
      if (v.montant_paye == null) continue
      const bucket = index.get(cleMois(new Date(v.date_commande)))
      if (bucket) bucket.total += v.montant_paye
    }
    return buckets
  }, [ventes])

  const totalPeriode = mois.reduce((s, m) => s + m.total, 0)
  const points: PointGraphe[] = mois.map((m) => ({ label: m.label, valeur: m.total }))

  return (
    <div className="bg-white rounded-2xl border border-primary-100 p-5 mb-5">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <TrendingUp size={16} className="text-primary-700" />
          <h2 className="text-sm font-bold text-primary-900">Chiffre d'affaires HT par mois</h2>
        </div>
        <span className="text-xs text-primary-500 tabular-nums">
          12 derniers mois — {totalPeriode.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
        </span>
      </div>

      {totalPeriode === 0 ? (
        <p className="text-sm text-primary-400 italic py-8 text-center">
          Aucun montant renseigné sur les 12 derniers mois
        </p>
      ) : (
        <GraphiqueLigne
          points={points}
          formatValeur={(v) => (v === 0 ? '' : Math.round(v).toLocaleString('fr-FR'))}
        />
      )}
    </div>
  )
}

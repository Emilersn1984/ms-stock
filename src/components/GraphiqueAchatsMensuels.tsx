import { useMemo } from 'react'
import { TrendingDown, AlertTriangle } from 'lucide-react'
import GraphiqueLigne, { PointGraphe } from './GraphiqueLigne'
import { projeterAchatsMatieresPremieres } from '../utils/projectionAchats'
import { Commande, Piece } from '../types'

type NomenclatureRow = {
  piece_id: string | null
  sous_ensemble_id: string
  sous_ensemble_enfant_id: string | null
  quantite_requise: number
}

const NB_MOIS = 12

function cleMois(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function labelMois(d: Date): string {
  return d.toLocaleDateString('fr-FR', { month: 'short' })
}

/**
 * Dépenses d'achat de matières premières par mois, plus une projection du mois
 * suivant tracée en pointillés.
 *
 * La projection utilise exactement le même moteur que la page Projections, pour
 * que les deux écrans ne puissent pas afficher des chiffres contradictoires :
 * l'objectif de vente consomme les pièces via la nomenclature, et une pièce qui
 * bascule sous son seuil critique déclenche l'achat d'un MOQ complet. Les
 * approvisionnements déjà en cours sont comptés comme du stock à venir.
 */
export default function GraphiqueAchatsMensuels({
  commandes,
  pieces,
  nomenclature,
  sousEnsembleBoueeId,
  objectifVenteMensuel,
  commandesEnCours,
}: {
  commandes: Commande[]
  pieces: Piece[]
  nomenclature: NomenclatureRow[]
  sousEnsembleBoueeId: string | null
  objectifVenteMensuel: number
  commandesEnCours: Commande[]
}) {
  const mois = useMemo(() => {
    const maintenant = new Date()
    const buckets = Array.from({ length: NB_MOIS }, (_, i) => {
      const d = new Date(maintenant.getFullYear(), maintenant.getMonth() - (NB_MOIS - 1 - i), 1)
      return { cle: cleMois(d), label: labelMois(d), total: 0 }
    })
    const index = new Map(buckets.map((b) => [b.cle, b]))

    for (const c of commandes) {
      if (c.montant_paye == null) continue
      const bucket = index.get(cleMois(new Date(c.date_commande)))
      if (bucket) bucket.total += c.montant_paye
    }
    return buckets
  }, [commandes])

  // Mois 0 = mois courant, mois 1 = le mois projeté en pointillés.
  const { projection, nbReferences, piecesNonChiffrees } = useMemo(() => {
    const { mois: simules, piecesNonChiffrees: absentes } = projeterAchatsMatieresPremieres({
      sousEnsembleBoueeId,
      objectifVenteMensuel,
      nbMois: 2,
      pieces,
      nomenclature,
      commandesEnCours,
    })
    const suivant = simules[1] ?? { cout: 0, lignes: [] }
    return {
      projection: suivant.cout,
      nbReferences: suivant.lignes.length,
      piecesNonChiffrees: absentes,
    }
  }, [sousEnsembleBoueeId, objectifVenteMensuel, pieces, nomenclature, commandesEnCours])

  const moisProjete = useMemo(() => {
    const d = new Date()
    d.setMonth(d.getMonth() + 1, 1)
    return { label: labelMois(d), annee: d.getFullYear() }
  }, [])

  const totalPeriode = mois.reduce((s, m) => s + m.total, 0)

  const points: PointGraphe[] = [
    ...mois.map((m) => ({ label: m.label, valeur: m.total })),
    { label: moisProjete.label, valeur: projection, projete: true },
  ]

  return (
    <div className="bg-white rounded-2xl border border-primary-100 p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4 flex-wrap">
        <div className="flex items-center gap-3">
          <TrendingDown size={16} className="text-primary-700" />
          <h2 className="text-sm font-bold text-primary-900">Dépenses d'achat HT par mois</h2>
        </div>
        <span className="text-xs text-primary-500 tabular-nums">
          12 derniers mois — {totalPeriode.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
        </span>
      </div>

      {totalPeriode === 0 && projection === 0 ? (
        <p className="text-sm text-primary-400 italic py-8 text-center">
          Aucun montant renseigné sur les 12 derniers mois
        </p>
      ) : (
        <>
          <GraphiqueLigne
            points={points}
            formatValeur={(v) => (v === 0 ? '' : Math.round(v).toLocaleString('fr-FR'))}
          />
          <p className="text-[11px] text-primary-500 mt-3 leading-relaxed">
            <span className="inline-block w-6 border-t-2 border-dashed border-alert-500 align-middle mr-1.5" />
            Projection {moisProjete.label} {moisProjete.annee} :{' '}
            <span className="font-semibold text-primary-700">
              {projection.toLocaleString('fr-FR', { maximumFractionDigits: 0 })} €
            </span>{' '}
            — {nbReferences} référence{nbReferences !== 1 ? 's' : ''} bascule
            {nbReferences !== 1 ? 'nt' : ''} sous leur seuil critique après un mois de production,
            chacune rachetée par MOQ complet. Même calcul que la page Projections.
          </p>
          {piecesNonChiffrees.length > 0 && (
            <p className="text-[11px] text-alert-600 mt-2 flex items-start gap-1.5 leading-relaxed">
              <AlertTriangle size={12} className="flex-shrink-0 mt-0.5" />
              <span>
                Montant sous-estimé : {piecesNonChiffrees.length} référence
                {piecesNonChiffrees.length > 1 ? 's' : ''} bascule
                {piecesNonChiffrees.length > 1 ? 'nt' : ''} aussi en critique mais n'
                {piecesNonChiffrees.length > 1 ? 'ont' : 'a'} ni MOQ ni prix unitaire renseigné,
                et {piecesNonChiffrees.length > 1 ? 'restent' : 'reste'} donc hors du chiffrage.
              </span>
            </p>
          )}
        </>
      )}
    </div>
  )
}

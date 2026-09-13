import { useMemo } from 'react'
import { Minus, Plus } from 'lucide-react'
import { ExpeditionItem, SousEnsemble } from '../types'
import { PRODUITS_ATELIER, PRODUIT_ATELIER_LABEL, sousEnsemblesParProduit } from '../utils/produitsAtelier'

type Props = {
  sousEnsembles: SousEnsemble[]
  items: ExpeditionItem[]
  onChange: (items: ExpeditionItem[]) => void
}

/**
 * Choix des produits sortis de l'atelier (plusieurs possibles, avec quantité).
 * Le contenu est stocké dans expeditions.items, une ligne par sous-ensemble.
 */
export default function SelecteurProduits({ sousEnsembles, items, onChange }: Props) {
  const parProduit = useMemo(() => sousEnsemblesParProduit(sousEnsembles), [sousEnsembles])

  const quantite = (seId: string) => items.find((i) => i.sous_ensemble_id === seId)?.quantite ?? 0

  function definir(se: SousEnsemble, libelle: string, qte: number) {
    const autres = items.filter((i) => i.sous_ensemble_id !== se.id)
    onChange(qte <= 0 ? autres : [...autres, { sous_ensemble_id: se.id, piece_id: null, nom: libelle, quantite: qte }])
  }

  // Lignes héritées qui ne correspondent à aucun des quatre produits : on les
  // montre pour ne pas les faire disparaître en silence.
  const lignesHorsProduits = items.filter(
    (i) => !i.sous_ensemble_id || !sousEnsembles.some((s) => s.id === i.sous_ensemble_id && s.produit)
  )

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {PRODUITS_ATELIER.map((p) => {
          const se = parProduit.get(p)
          const qte = se ? quantite(se.id) : 0
          const libelle = PRODUIT_ATELIER_LABEL[p]
          if (!se) {
            return (
              <button
                key={p}
                type="button"
                disabled
                title="Aucun sous-ensemble n'est rattaché à ce produit"
                className="py-2 rounded-xl text-xs font-semibold border border-dashed border-primary-200 text-primary-300 cursor-not-allowed"
              >
                {libelle}
              </button>
            )
          }
          if (qte === 0) {
            return (
              <button
                key={p}
                type="button"
                onClick={() => definir(se, libelle, 1)}
                className="py-2 rounded-xl text-xs font-semibold transition-colors border bg-white text-primary-600 border-primary-200 hover:bg-primary-50"
              >
                {libelle}
              </button>
            )
          }
          return (
            <div key={p} className="rounded-xl border border-primary-900 bg-primary-900 text-white px-1.5 py-1 flex flex-col items-center gap-0.5">
              <span className="text-xs font-semibold leading-tight text-center">{libelle}</span>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => definir(se, libelle, qte - 1)}
                  title={qte === 1 ? 'Retirer' : 'Diminuer'}
                  className="w-5 h-5 flex items-center justify-center rounded-md bg-primary-700 hover:bg-primary-600"
                >
                  <Minus size={10} />
                </button>
                <span className="w-4 text-center text-xs font-bold tabular-nums">{qte}</span>
                <button
                  type="button"
                  onClick={() => definir(se, libelle, qte + 1)}
                  title="Augmenter"
                  className="w-5 h-5 flex items-center justify-center rounded-md bg-primary-700 hover:bg-primary-600"
                >
                  <Plus size={10} />
                </button>
              </div>
            </div>
          )
        })}
      </div>
      {lignesHorsProduits.length > 0 && (
        <p className="text-[11px] text-primary-500">
          Contenu hérité conservé :{' '}
          {lignesHorsProduits.map((i) => `${i.quantite} × ${i.nom}`).join(', ')}
        </p>
      )}
    </div>
  )
}

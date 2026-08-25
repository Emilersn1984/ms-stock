import { SousEnsemble } from '../types'

function normaliserNom(nom: string): string {
  return nom
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036F]/g, '')
}

// Seuls ces sous-ensembles sont affichés, dans cet ordre. Les autres existent
// toujours en base et dans les nomenclatures : ils sont simplement masqués ici.
const SOUS_ENSEMBLES_AFFICHES = [
  'bouee meca',
  'tourelle',
  'bb',
  'colis termine ferme',
].map(normaliserNom)

export function trierSousEnsembles(sousEnsembles: SousEnsemble[]) {
  const rangDe = (se: SousEnsemble) => SOUS_ENSEMBLES_AFFICHES.indexOf(normaliserNom(se.nom))

  return sousEnsembles
    .filter((se) => rangDe(se) !== -1)
    .sort((a, b) => rangDe(a) - rangDe(b))
}

function SousEnsembleCard({ se, onSelectionner }: { se: SousEnsemble; onSelectionner?: (se: SousEnsemble) => void }) {
  const ok = se.quantite > 0
  const contenu = (
    <>
      <p className={`text-[11px] font-medium truncate leading-tight ${ok ? 'text-white' : 'text-primary-700'}`}>{se.nom}</p>
      <p className={`text-3xl font-bold leading-none tabular-nums ${
        ok ? 'text-success-300' : 'text-primary-500'
      }`}>{se.quantite}</p>
    </>
  )
  const classe = `rounded-xl p-4 h-24 flex flex-col justify-between text-left w-full ${
    ok ? 'bg-primary-900' : 'bg-white border border-dashed border-primary-200'
  }`

  if (!onSelectionner) {
    return <div className={classe}>{contenu}</div>
  }
  return (
    <button
      type="button"
      onClick={() => onSelectionner(se)}
      title="Corriger la quantité"
      className={`${classe} hover:opacity-80 transition-opacity`}
    >
      {contenu}
    </button>
  )
}

/**
 * Bandeau « Sous-ensembles disponibles » : tous les sous-ensembles définis,
 * ceux en stock d'abord. Les sous-ensembles à zéro restent visibles en pointillé
 * pour qu'on voie d'un coup d'œil ce qui manque.
 */
export default function CarteSousEnsembles({
  sousEnsembles,
  onSelectionner,
}: {
  sousEnsembles: SousEnsemble[]
  // Fourni depuis la page Stock pour permettre la correction de quantité.
  onSelectionner?: (se: SousEnsemble) => void
}) {
  const affiches = trierSousEnsembles(sousEnsembles)
  const enStock = affiches.filter((se) => se.quantite > 0).length
  return (
    <div className="bg-white rounded-2xl border border-primary-100 p-5 flex flex-col min-h-0 mb-6">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-[10px] font-bold uppercase tracking-[0.18em] whitespace-nowrap text-primary-700">
          Sous-ensembles disponibles
        </span>
        <div className="flex-1 h-px bg-primary-100" />
        <span className="text-xs font-semibold text-primary-600 tabular-nums">
          {enStock} / {affiches.length}
        </span>
      </div>
      {affiches.length === 0 ? (
        <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
          Aucun sous-ensemble défini
        </p>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {affiches.map((se) => (
            <SousEnsembleCard key={se.id} se={se} onSelectionner={onSelectionner} />
          ))}
        </div>
      )}
    </div>
  )
}

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Search, Check, ClipboardList, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import AnimatedList from '../components/AnimatedList'
import { useAnimatedListItem } from '../hooks/useAnimatedListItem'
import { getUtilisateurStored } from '../hooks/useUtilisateur'
import { recalculerStock } from '../utils/recalculerStock'
import { TypeOperation } from '../types'

type OperationComplete = {
  id: string
  type: TypeOperation
  piece_id: string | null
  sous_ensemble_id: string | null
  quantite_avant: number | null
  quantite_apres: number | null
  delta: number | null
  utilisateur_id: string
  commentaire: string | null
  created_at: string
  pieces: { id: string; nom: string } | null
  utilisateurs: { nom: string; prenom: string } | null
  sous_ensembles: { nom: string } | null
}

const TYPE_LABELS: Record<TypeOperation, string> = {
  livraison: 'Livraison',
  fabrication: 'Fabrication',
  correction: 'Correction',
  ajout_piece: 'Ajout pièce',
}

const TYPE_TEXT_CLASS: Record<TypeOperation, string> = {
  livraison: 'text-success-600',
  fabrication: 'text-primary-600',
  correction: 'text-alert-600',
  ajout_piece: 'text-primary-500',
}

const TYPE_BAR_HEX: Record<TypeOperation, string> = {
  livraison: '#22B84F',
  fabrication: '#20808E',
  correction: '#F97316',
  ajout_piece: '#38A5B4',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('fr-FR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OperationRow({ op, index, onModifier }: {
  op: OperationComplete
  index: number
  onModifier: (op: OperationComplete) => void
}) {
  const { ref, style } = useAnimatedListItem<HTMLTableRowElement>(index)
  return (
    <tr ref={ref} style={style} className="hover:bg-primary-50 transition-colors">
      <td
        className="border-l-4 px-4 py-3.5 text-xs text-primary-500 whitespace-nowrap"
        style={{ borderLeftColor: TYPE_BAR_HEX[op.type] }}
      >
        {formatDate(op.created_at)}
      </td>
      <td className="px-5 py-3.5">
        <span className={`text-xs font-bold uppercase tracking-wide ${TYPE_TEXT_CLASS[op.type]}`}>
          {TYPE_LABELS[op.type]}
        </span>
      </td>
      <td className="px-5 py-3.5 font-medium text-primary-900">
        {op.pieces?.nom ?? op.sous_ensembles?.nom ?? '—'}
      </td>
      <td className="px-5 py-3.5 text-xs text-primary-500 whitespace-nowrap">
        {op.utilisateurs ? `${op.utilisateurs.prenom} ${op.utilisateurs.nom}` : '—'}
      </td>
      <td className="px-5 py-3.5 text-right font-bold tabular-nums">
        {op.delta != null ? (
          <span className={op.delta >= 0 ? 'text-success-600' : 'text-danger-600'}>
            {op.delta >= 0 ? '+' : ''}{op.delta}
          </span>
        ) : '—'}
      </td>
      <td className="px-5 py-3.5 text-right font-bold tabular-nums text-primary-700">
        {op.quantite_apres ?? '—'}
      </td>
      <td className="px-5 py-3.5 text-xs text-primary-400 max-w-[180px] truncate">
        {op.commentaire ?? ''}
      </td>
      <td className="px-5 py-3.5 text-right">
        <button
          onClick={() => onModifier(op)}
          className="text-sm text-primary-500 hover:text-primary-800 font-medium transition-colors"
        >
          Modifier
        </button>
      </td>
    </tr>
  )
}

function OperationCard({ op, index, onModifier }: {
  op: OperationComplete
  index: number
  onModifier: (op: OperationComplete) => void
}) {
  const { ref, style } = useAnimatedListItem<HTMLDivElement>(index)
  return (
    <div ref={ref} style={style} className="flex rounded-xl overflow-hidden border border-primary-100">
      <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: TYPE_BAR_HEX[op.type] }} />
      <div className="flex-1 px-3.5 py-2.5 bg-white min-w-0">
        <div className="flex items-start justify-between gap-2 mb-1">
          <div className="flex-1 min-w-0">
            <span className={`text-[10px] font-bold uppercase tracking-wide ${TYPE_TEXT_CLASS[op.type]}`}>
              {TYPE_LABELS[op.type]}
            </span>
            <p className="text-sm font-medium text-primary-900 truncate mt-0.5">
              {op.pieces?.nom ?? op.sous_ensembles?.nom ?? '—'}
            </p>
          </div>
          {op.delta != null && (
            <span className={`text-base font-bold tabular-nums flex-shrink-0 ${op.delta >= 0 ? 'text-success-600' : 'text-danger-600'}`}>
              {op.delta >= 0 ? '+' : ''}{op.delta}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] text-primary-400 tabular-nums">
              {op.utilisateurs ? `${op.utilisateurs.prenom} ${op.utilisateurs.nom}` : '—'} · {formatDate(op.created_at)}
            </p>
            {op.commentaire && (
              <p className="text-xs text-primary-400 mt-0.5 truncate">{op.commentaire}</p>
            )}
          </div>
          <button
            onClick={() => onModifier(op)}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-400 hover:text-primary-800 hover:bg-primary-50 transition-colors ml-2"
          >
            <Pencil size={13} />
          </button>
        </div>
      </div>
    </div>
  )
}

export default function Historique() {
  const utilisateur = getUtilisateurStored()

  const [operations, setOperations] = useState<OperationComplete[]>([])
  const [chargement, setChargement] = useState(true)

  const [filtreType, setFiltreType] = useState<TypeOperation | 'tous'>('tous')
  const [filtrePiece, setFiltrePiece] = useState('')
  const [filtreDateDebut, setFiltreDateDebut] = useState('')
  const [filtreDateFin, setFiltreDateFin] = useState('')
  const [filtreOperateur, setFiltreOperateur] = useState('')

  const [operationAModifier, setOperationAModifier] = useState<OperationComplete | null>(null)
  const [nouveauDelta, setNouveauDelta] = useState('')
  const [nouveauCommentaire, setNouveauCommentaire] = useState('')
  const [chargementModif, setChargementModif] = useState(false)
  const [erreurModif, setErreurModif] = useState<string | null>(null)
  const [confirmationModif, setConfirmationModif] = useState(false)

  const chargerOperations = useCallback(async () => {
    setChargement(true)
    const { data } = await supabase
      .from('operations')
      .select('*, pieces(id, nom), utilisateurs(nom, prenom), sous_ensembles(nom)')
      .order('created_at', { ascending: false })
      .limit(500)
    setOperations((data as unknown as OperationComplete[]) ?? [])
    setChargement(false)
  }, [])

  useEffect(() => {
    chargerOperations()
  }, [chargerOperations])

  const operateurs = useMemo(() => {
    const map = new Map<string, { id: string; nom: string; prenom: string }>()
    for (const op of operations) {
      if (op.utilisateurs && !map.has(op.utilisateur_id)) {
        map.set(op.utilisateur_id, {
          id: op.utilisateur_id,
          nom: op.utilisateurs.nom,
          prenom: op.utilisateurs.prenom,
        })
      }
    }
    return Array.from(map.values()).sort((a, b) =>
      `${a.prenom} ${a.nom}`.localeCompare(`${b.prenom} ${b.nom}`)
    )
  }, [operations])

  const operationsFiltrees = useMemo(() => {
    return operations.filter((op) => {
      if (filtreType !== 'tous' && op.type !== filtreType) return false
      if (filtrePiece.trim()) {
        const nom = (op.pieces?.nom ?? op.sous_ensembles?.nom ?? '').toLowerCase()
        if (!nom.includes(filtrePiece.toLowerCase())) return false
      }
      if (filtreOperateur && op.utilisateur_id !== filtreOperateur) return false
      if (filtreDateDebut && new Date(op.created_at) < new Date(filtreDateDebut)) return false
      if (filtreDateFin) {
        const fin = new Date(filtreDateFin)
        fin.setHours(23, 59, 59, 999)
        if (new Date(op.created_at) > fin) return false
      }
      return true
    })
  }, [operations, filtreType, filtrePiece, filtreOperateur, filtreDateDebut, filtreDateFin])

  const hasFiltresActifs =
    filtreType !== 'tous' || filtrePiece || filtreDateDebut || filtreDateFin || filtreOperateur

  function resetFiltres() {
    setFiltreType('tous')
    setFiltrePiece('')
    setFiltreDateDebut('')
    setFiltreDateFin('')
    setFiltreOperateur('')
  }

  function ouvrirModal(op: OperationComplete) {
    setOperationAModifier(op)
    setNouveauDelta(op.delta?.toString() ?? '0')
    setNouveauCommentaire(op.commentaire ?? '')
    setErreurModif(null)
    setConfirmationModif(false)
  }

  function fermerModal() {
    setOperationAModifier(null)
    setNouveauDelta('')
    setNouveauCommentaire('')
    setErreurModif(null)
    setConfirmationModif(false)
  }

  async function sauvegarderModification() {
    if (!operationAModifier || !utilisateur) return
    const delta = parseInt(nouveauDelta, 10)
    if (isNaN(delta)) {
      setErreurModif('Delta invalide')
      return
    }

    setChargementModif(true)
    setErreurModif(null)

    try {
      const { error } = await supabase
        .from('operations')
        .update({
          delta,
          commentaire: nouveauCommentaire.trim() || null,
        })
        .eq('id', operationAModifier.id)

      if (error) throw error

      if (operationAModifier.piece_id) {
        await recalculerStock(operationAModifier.piece_id)
      }

      setConfirmationModif(true)
      chargerOperations()
      setTimeout(() => fermerModal(), 1800)
    } catch (err) {
      setErreurModif(err instanceof Error ? err.message : 'Erreur lors de la modification')
    } finally {
      setChargementModif(false)
    }
  }

  if (!utilisateur) {
    return (
      <div className="p-5 md:p-8">
        <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
          Connectez-vous pour accéder à l'historique.
        </p>
      </div>
    )
  }

  return (
    <div className="p-5 md:p-8">

      {/* En-tête */}
      <div className="flex items-end justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Historique</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            Toutes les opérations enregistrées
          </p>
        </div>
        <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center">
          <ClipboardList size={17} className="text-primary-700" />
        </div>
      </div>

      {/* Filtres */}
      <div className="bg-white rounded-2xl border border-primary-100 p-4 mb-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Type
            </label>
            <select
              value={filtreType}
              onChange={(e) => setFiltreType(e.target.value as TypeOperation | 'tous')}
              className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
            >
              <option value="tous">Tous les types</option>
              <option value="livraison">Livraison</option>
              <option value="fabrication">Fabrication</option>
              <option value="correction">Correction</option>
              <option value="ajout_piece">Ajout pièce</option>
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Pièce / SE
            </label>
            <div className="relative">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
              <input
                type="text"
                value={filtrePiece}
                onChange={(e) => setFiltrePiece(e.target.value)}
                placeholder="Rechercher…"
                className="w-full pl-8 pr-3 py-2 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Opérateur
            </label>
            <select
              value={filtreOperateur}
              onChange={(e) => setFiltreOperateur(e.target.value)}
              className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
            >
              <option value="">Tous les opérateurs</option>
              {operateurs.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.prenom} {u.nom}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Période
            </label>
            <div className="flex gap-2">
              <input
                type="date"
                value={filtreDateDebut}
                onChange={(e) => setFiltreDateDebut(e.target.value)}
                className="flex-1 min-w-0 border border-primary-200 rounded-xl px-2 py-2 text-xs text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
              <input
                type="date"
                value={filtreDateFin}
                onChange={(e) => setFiltreDateFin(e.target.value)}
                className="flex-1 min-w-0 border border-primary-200 rounded-xl px-2 py-2 text-xs text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>
        </div>

        {hasFiltresActifs && (
          <div className="mt-3 flex items-center justify-between">
            <p className="text-xs text-primary-500 tabular-nums">
              {operationsFiltrees.length} résultat{operationsFiltrees.length !== 1 ? 's' : ''}
            </p>
            <button
              onClick={resetFiltres}
              className="text-xs font-medium text-primary-500 hover:text-primary-900 transition-colors"
            >
              Réinitialiser les filtres
            </button>
          </div>
        )}
      </div>

      {/* Contenu */}
      {chargement ? (
        <div className="flex items-center justify-center h-40">
          <p className="text-primary-400 text-sm">Chargement…</p>
        </div>
      ) : operationsFiltrees.length === 0 ? (
        <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
          Aucune opération trouvée
        </p>
      ) : (
        <>
          {/* Tableau desktop */}
          <div className="hidden md:block bg-white rounded-2xl border border-primary-100 overflow-hidden mb-2">
            <AnimatedList maxHeightClass="max-h-[60vh]" fadeColor="#FFFFFF">
              <table className="w-full text-sm">
                <thead className="bg-primary-50 border-b border-primary-100 sticky top-0 z-[1]">
                  <tr>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Date</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Type</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Pièce / SE</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Opérateur</th>
                    <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Delta</th>
                    <th className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Stock après</th>
                    <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-5 py-3.5">Commentaire</th>
                    <th className="px-5 py-3.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-primary-50">
                  {operationsFiltrees.map((op, i) => (
                    <OperationRow key={op.id} op={op} index={i} onModifier={ouvrirModal} />
                  ))}
                </tbody>
              </table>
            </AnimatedList>
          </div>

          {/* Cartes mobile */}
          <AnimatedList maxHeightClass="max-h-[60vh]" className="md:hidden space-y-1.5">
            {operationsFiltrees.map((op, i) => (
              <OperationCard key={op.id} op={op} index={i} onModifier={ouvrirModal} />
            ))}
          </AnimatedList>
        </>
      )}

      {!chargement && operations.length > 0 && (
        <p className="text-xs text-primary-400 text-center mt-4 tabular-nums">
          {operationsFiltrees.length} opération{operationsFiltrees.length !== 1 ? 's' : ''} affichée
          {operationsFiltrees.length !== 1 ? 's' : ''}
          {hasFiltresActifs ? ` sur ${operations.length} au total` : ''}
        </p>
      )}

      {/* Modal correction */}
      {operationAModifier && (
        <div
          className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4"
          
        >
          <div className="bg-white rounded-2xl shadow-2xl w-full sm:max-w-md p-6">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Pencil size={17} className="text-primary-700" />
              </div>
              <div>
                <h2 className="text-base font-bold text-primary-900 leading-tight">Modifier l'opération</h2>
                <p className="text-xs text-primary-500 mt-0.5">
                  <span className={`font-bold ${TYPE_TEXT_CLASS[operationAModifier.type]}`}>
                    {TYPE_LABELS[operationAModifier.type]}
                  </span>
                  {' · '}
                  {operationAModifier.pieces?.nom ?? operationAModifier.sous_ensembles?.nom ?? '—'}
                  {' · '}
                  {formatDate(operationAModifier.created_at)}
                </p>
              </div>
            </div>

            {confirmationModif ? (
              <div className="flex rounded-xl overflow-hidden border border-primary-100">
                <div className="w-[3px] flex-shrink-0" style={{ backgroundColor: '#22B84F' }} />
                <div className="flex items-center gap-3 px-3.5 py-3 bg-white flex-1">
                  <Check size={14} className="text-success-600 flex-shrink-0" />
                  <p className="text-sm font-medium text-primary-900">Opération modifiée. Stock recalculé.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                    Delta (quantité){' '}
                    <span className="text-primary-400 font-normal normal-case tracking-normal">
                      — valeur actuelle : {operationAModifier.delta ?? 'N/A'}
                    </span>
                  </label>
                  <input
                    type="number"
                    value={nouveauDelta}
                    onChange={(e) => setNouveauDelta(e.target.value)}
                    className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-primary-900 text-base tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                    Commentaire
                  </label>
                  <textarea
                    value={nouveauCommentaire}
                    onChange={(e) => setNouveauCommentaire(e.target.value)}
                    rows={3}
                    placeholder="Raison de la correction…"
                    className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
                  />
                </div>

                {erreurModif && (
                  <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreurModif}</p>
                )}

                <div className="flex gap-3">
                  <button
                    onClick={fermerModal}
                    className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={sauvegarderModification}
                    disabled={chargementModif || !nouveauDelta.trim()}
                    className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
                  >
                    {chargementModif ? 'Enregistrement…' : 'Sauvegarder'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

import { useState, useMemo, useRef, useEffect } from 'react'
import { PackagePlus, PencilLine, Search, X, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Commande, Piece, Transporteur, Utilisateur } from '../types'
import { TRANSPORTEURS } from '../utils/trackingUrl'

function dateAujourdhuiISO() {
  const d = new Date()
  const off = d.getTimezoneOffset()
  return new Date(d.getTime() - off * 60000).toISOString().slice(0, 10)
}

type LigneReference = {
  cle: string
  piece: Piece | null
  recherche: string
  quantite: string
}

function nouvelleCle() {
  return Math.random().toString(36).slice(2)
}

// ─── Sélecteur de pièce d'une ligne ────────────────────────────────────────────

function SelecteurPiece({
  ligne, pieces, dejaChoisies, onChange,
}: {
  ligne: LigneReference
  pieces: Piece[]
  // Références déjà présentes sur d'autres lignes, retirées des propositions.
  dejaChoisies: string[]
  onChange: (maj: Partial<LigneReference>) => void
}) {
  const [ouvert, setOuvert] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOuvert(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtrees = useMemo(() => {
    const q = ligne.recherche.trim().toLowerCase()
    return pieces
      .filter((p) => !dejaChoisies.includes(p.id) || p.id === ligne.piece?.id)
      .filter((p) => !q || p.nom.toLowerCase().includes(q))
      .slice(0, 30)
  }, [pieces, ligne.recherche, ligne.piece, dejaChoisies])

  return (
    <div ref={ref} className="relative flex-1 min-w-0">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
        <input
          type="text"
          value={ligne.recherche}
          onChange={(e) => {
            const v = e.target.value
            setOuvert(true)
            onChange({ recherche: v, piece: ligne.piece && v !== ligne.piece.nom ? null : ligne.piece })
          }}
          onFocus={() => setOuvert(true)}
          placeholder="Rechercher une référence…"
          className="w-full pl-8 pr-3 py-2 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          autoComplete="off"
        />
      </div>
      {ouvert && filtrees.length > 0 && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
          {filtrees.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => { onChange({ piece: p, recherche: p.nom }); setOuvert(false) }}
              className="w-full flex items-center gap-3 px-3.5 py-2 hover:bg-primary-50 transition-colors text-left"
            >
              <span className="flex-1 text-sm font-medium text-primary-900 truncate">{p.nom}</span>
              <span className="text-xs text-primary-400 tabular-nums flex-shrink-0">{p.quantite} en stock</span>
            </button>
          ))}
        </div>
      )}
      {ouvert && ligne.recherche.trim() && filtrees.length === 0 && (
        <div className="absolute z-30 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg px-3.5 py-2.5">
          <p className="text-sm text-primary-400">Aucune référence trouvée</p>
        </div>
      )}
    </div>
  )
}

// ─── Modale ────────────────────────────────────────────────────────────────────

export default function ModalNouvelleCommande({
  piece,
  pieces,
  utilisateur,
  commandeAModifier,
  onClose,
  onCreated,
}: {
  piece: Piece | null
  pieces: Piece[]
  utilisateur: Utilisateur
  commandeAModifier?: Commande | null
  onClose: () => void
  onCreated: () => void
}) {
  const modeEdition = !!commandeAModifier
  const pieceInitiale = commandeAModifier
    ? pieces.find((p) => p.id === commandeAModifier.piece_id) ?? null
    : piece

  const [references, setReferences] = useState<LigneReference[]>([{
    cle: nouvelleCle(),
    piece: pieceInitiale,
    recherche: pieceInitiale?.nom ?? commandeAModifier?.pieces?.nom ?? '',
    quantite: commandeAModifier ? String(commandeAModifier.quantite_commandee) : '',
  }])

  const [dateCommande, setDateCommande] = useState(
    commandeAModifier?.date_commande ?? dateAujourdhuiISO()
  )
  const [dateLivraisonPrevue, setDateLivraisonPrevue] = useState(
    commandeAModifier?.date_livraison_prevue ?? ''
  )
  const [transporteur, setTransporteur] = useState<Transporteur | ''>(
    commandeAModifier?.transporteur ?? ''
  )
  const [numeroSuivi, setNumeroSuivi] = useState(commandeAModifier?.numero_suivi ?? '')
  const [montantPaye, setMontantPaye] = useState(
    commandeAModifier?.montant_paye != null ? String(commandeAModifier.montant_paye) : ''
  )
  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const dejaChoisies = references.map((r) => r.piece?.id).filter(Boolean) as string[]

  function majLigne(cle: string, maj: Partial<LigneReference>) {
    setReferences((prev) => prev.map((r) => (r.cle === cle ? { ...r, ...maj } : r)))
    setErreur(null)
  }

  function ajouterLigne() {
    setReferences((prev) => [...prev, { cle: nouvelleCle(), piece: null, recherche: '', quantite: '' }])
  }

  function retirerLigne(cle: string) {
    setReferences((prev) => (prev.length === 1 ? prev : prev.filter((r) => r.cle !== cle)))
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()

    const lignesValides = references.filter((r) => r.piece)
    if (lignesValides.length === 0) { setErreur('Veuillez sélectionner au moins une référence'); return }
    for (const r of lignesValides) {
      const q = parseInt(r.quantite, 10)
      if (isNaN(q) || q <= 0) { setErreur(`Quantité invalide pour « ${r.piece!.nom} »`); return }
    }
    if (!dateCommande) { setErreur('Date de commande requise'); return }
    const montantValue = montantPaye.trim() ? Number(montantPaye.replace(',', '.')) : null
    if (montantValue !== null && !Number.isFinite(montantValue)) { setErreur('Montant payé invalide'); return }

    const champsCommuns = {
      date_commande: dateCommande,
      date_livraison_prevue: dateLivraisonPrevue || null,
      transporteur: transporteur || null,
      numero_suivi: numeroSuivi.trim() || null,
    }

    setEnvoi(true)
    setErreur(null)
    try {
      if (modeEdition && commandeAModifier) {
        const seule = lignesValides[0]
        const { error } = await supabase
          .from('commandes')
          .update({
            ...champsCommuns,
            piece_id: seule.piece!.id,
            quantite_commandee: parseInt(seule.quantite, 10),
            montant_paye: montantValue,
          })
          .eq('id', commandeAModifier.id)
        if (error) throw error
      } else {
        // Une ligne par référence, reliées par un même groupe_id. Le montant
        // n'est porté que par la première pour ne pas être compté plusieurs fois.
        const groupeId = crypto.randomUUID()
        const lignes = lignesValides.map((r, i) => ({
          ...champsCommuns,
          groupe_id: groupeId,
          piece_id: r.piece!.id,
          quantite_commandee: parseInt(r.quantite, 10),
          montant_paye: i === 0 ? montantValue : null,
          statut: 'en_cours',
          utilisateur_id: utilisateur.id,
        }))
        const { error } = await supabase.from('commandes').insert(lignes)
        if (error) throw error
      }
      onCreated()
      onClose()
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement de la commande')
    } finally {
      setEnvoi(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              {modeEdition ? (
                <PencilLine size={17} className="text-primary-700" />
              ) : (
                <PackagePlus size={17} className="text-primary-700" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-primary-900 leading-tight">
                {modeEdition ? 'Modifier la commande' : 'Nouvelle commande'}
              </h2>
              <p className="text-xs text-primary-500 mt-0.5">
                {modeEdition
                  ? 'Mettre à jour les détails de la commande'
                  : 'Une ou plusieurs références, un seul envoi'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        <form onSubmit={soumettre} className="space-y-4">
          {/* Références commandées */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600">
                Références commandées
              </label>
              {!modeEdition && (
                <button
                  type="button"
                  onClick={ajouterLigne}
                  className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-500 hover:text-primary-900 transition-colors"
                >
                  <Plus size={11} />
                  Ajouter
                </button>
              )}
            </div>
            <div className="space-y-2">
              {references.map((r) => (
                <div key={r.cle} className="flex items-center gap-2">
                  <SelecteurPiece
                    ligne={r}
                    pieces={pieces}
                    dejaChoisies={dejaChoisies}
                    onChange={(maj) => majLigne(r.cle, maj)}
                  />
                  <input
                    type="number"
                    min={1}
                    value={r.quantite}
                    onChange={(e) => majLigne(r.cle, { quantite: e.target.value })}
                    placeholder="Qté"
                    className="w-20 flex-shrink-0 border border-primary-200 rounded-xl px-2 py-2 text-primary-900 text-sm font-bold tabular-nums text-right focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  />
                  {!modeEdition && (
                    <button
                      type="button"
                      onClick={() => retirerLigne(r.cle)}
                      disabled={references.length === 1}
                      title="Retirer cette référence"
                      className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:bg-danger-100 hover:text-danger-600 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-primary-300 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Date de commande
              </label>
              <input
                type="date"
                value={dateCommande}
                onChange={(e) => setDateCommande(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Livraison prévue
              </label>
              <input
                type="date"
                value={dateLivraisonPrevue}
                onChange={(e) => setDateLivraisonPrevue(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>

          {/* Transporteur + suivi */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Transporteur{' '}
                <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
              </label>
              <select
                value={transporteur}
                onChange={(e) => setTransporteur(e.target.value as Transporteur | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              >
                <option value="">—</option>
                {TRANSPORTEURS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                N° de suivi{' '}
                <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
              </label>
              <input
                type="text"
                value={numeroSuivi}
                onChange={(e) => setNumeroSuivi(e.target.value)}
                placeholder="Ex : 6A123..."
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Montant payé HT{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">
                (en euros, pour la commande entière)
              </span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={montantPaye}
              onChange={(e) => setMontantPaye(e.target.value)}
              placeholder="Ex : 249.90"
              className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 placeholder-primary-400 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>

          {erreur && (
            <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>
          )}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
            >
              Annuler
            </button>
            <button
              type="submit"
              disabled={envoi}
              className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {envoi ? 'Enregistrement…' : modeEdition ? 'Enregistrer' : 'Créer la commande'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

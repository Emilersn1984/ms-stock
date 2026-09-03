import { useState, useEffect, useMemo, Fragment } from 'react'
import { Plus, Trash2, TrendingUp, Wallet, Pencil, AlertTriangle, CalendarClock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useStock } from '../hooks/useStock'
import { useProjections } from '../hooks/useProjections'
import { useCommandes } from '../hooks/useCommandes'
import { useExpeditions } from '../hooks/useExpeditions'
import { useParametreProduction } from '../hooks/useParametreProduction'
import { projeterAchatsMatieresPremieres } from '../utils/projectionAchats'
import GraphiqueLigne from '../components/GraphiqueLigne'
import ConfirmDialog from '../components/ConfirmDialog'
import { LigneProjection, SectionProjection } from '../types'

const NB_MOIS = 3

type NomEntry = {
  piece_id: string | null
  sous_ensemble_id: string
  sous_ensemble_enfant_id: string | null
  quantite_requise: number
}

function formatEuros(v: number): string {
  return v.toLocaleString('fr-FR', { maximumFractionDigits: 0 }) + ' €'
}

// Premier jour du mois, à partir du paramètre ou du mois courant par défaut.
function moisDebutDepuis(iso: string | null): Date {
  if (!iso) {
    const n = new Date()
    return new Date(n.getFullYear(), n.getMonth(), 1)
  }
  const [a, m] = iso.split('-').map(Number)
  return new Date(a, m - 1, 1)
}

function moisProjetes(debut: Date): { label: string; cle: string }[] {
  return Array.from({ length: NB_MOIS }, (_, i) => {
    const d = new Date(debut.getFullYear(), debut.getMonth() + i, 1)
    return {
      cle: `${d.getFullYear()}-${d.getMonth()}`,
      label: d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    }
  })
}

// Nombre de mois entre le mois courant et le début de la fenêtre affichée.
function decalageMois(debut: Date): number {
  const n = new Date()
  return Math.max(0, (debut.getFullYear() - n.getFullYear()) * 12 + (debut.getMonth() - n.getMonth()))
}

// ─── Cellule de montant, éditable ──────────────────────────────────────────────

function CelluleMontant({
  valeur, valeurAuto, onChange,
}: {
  valeur: number | null
  // Valeur calculée par l'application, si la ligne est automatique.
  valeurAuto: number | null
  onChange: (v: number | null) => void
}) {
  const effective = valeur ?? valeurAuto ?? 0
  const estAuto = valeur === null && valeurAuto !== null
  const [editing, setEditing] = useState(false)
  const [saisie, setSaisie] = useState('')
  // Contenu du champ à l'ouverture : sans modification, on n'écrit rien.
  // Sans ça, ouvrir puis quitter une cellule calculée la figeait en dur.
  const [saisieInitiale, setSaisieInitiale] = useState('')

  function ouvrir() {
    const depart = valeur != null
      ? String(valeur)
      : (valeurAuto != null ? String(Math.round(valeurAuto)) : '')
    setSaisie(depart)
    setSaisieInitiale(depart)
    setEditing(true)
  }

  function valider() {
    setEditing(false)
    const brut = saisie.trim().replace(',', '.')
    if (brut === saisieInitiale.trim().replace(',', '.')) return
    if (brut === '') { onChange(null); return }
    const n = Number(brut)
    if (Number.isFinite(n)) onChange(n)
  }

  if (editing) {
    return (
      <td className="px-1.5 py-0">
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === 'Enter') valider()
            if (e.key === 'Escape') setEditing(false)
          }}
          className="w-full border border-primary-300 rounded px-1.5 py-0.5 text-xs text-right tabular-nums text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      </td>
    )
  }

  return (
    <td className="px-1.5 py-0 text-right">
      <button
        type="button"
        onClick={ouvrir}
        title={estAuto
          ? 'Valeur calculée — cliquer pour la remplacer'
          : 'Valeur saisie — vider la case pour revenir au calcul automatique'}
        className={`w-full text-right text-xs tabular-nums px-1.5 py-1 rounded hover:bg-primary-100 transition-colors ${
          estAuto ? 'text-primary-500 italic' : effective === 0 ? 'text-primary-300' : 'text-primary-900'
        }`}
      >
        {effective === 0 ? '—' : formatEuros(effective)}
      </button>
    </td>
  )
}

// ─── Tableau d'une section ─────────────────────────────────────────────────────

function TableauSection({
  titre, section, lignes, mois, valeursAuto, totalParMois, onChangeMontant,
  onRenommer, onSupprimer, onAjouter,
}: {
  titre: string
  section: SectionProjection
  lignes: LigneProjection[]
  mois: { label: string; cle: string }[]
  valeursAuto: Map<string, (number | null)[]>
  totalParMois: number[]
  onChangeMontant: (id: string, m: 0 | 1 | 2, v: number | null) => void
  onRenommer: (id: string, libelle: string) => void
  onSupprimer: (id: string) => void
  onAjouter: (categorie: string, libelle: string) => void
}) {
  const categories = useMemo(() => {
    const vues: string[] = []
    for (const l of lignes) if (!vues.includes(l.categorie)) vues.push(l.categorie)
    return vues
  }, [lignes])

  const [ajoutOuvert, setAjoutOuvert] = useState(false)
  const [nouvelleCategorie, setNouvelleCategorie] = useState('')
  const [nouvelleCategoriePerso, setNouvelleCategoriePerso] = useState('')
  const [nouveauLibelle, setNouveauLibelle] = useState('')

  useEffect(() => {
    if (!nouvelleCategorie && categories.length > 0) setNouvelleCategorie(categories[0])
  }, [categories, nouvelleCategorie])

  function confirmerAjout() {
    const cat = nouvelleCategorie === '__autre__' ? nouvelleCategoriePerso.trim() : nouvelleCategorie
    if (!cat || !nouveauLibelle.trim()) return
    onAjouter(cat, nouveauLibelle.trim())
    setNouveauLibelle('')
    setNouvelleCategoriePerso('')
    setAjoutOuvert(false)
  }

  return (
    <div className="bg-white rounded-2xl border border-primary-100 p-5 mb-6">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h2 className="text-sm font-bold text-primary-900">{titre}</h2>
        <button
          onClick={() => setAjoutOuvert((v) => !v)}
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-500 hover:text-primary-900 transition-colors"
        >
          <Plus size={12} />
          Ajouter une ligne
        </button>
      </div>

      {ajoutOuvert && (
        <div className="flex flex-wrap items-end gap-2 mb-4 p-3 bg-primary-50 rounded-xl">
          <div className="flex-1 min-w-[160px]">
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1">
              Catégorie
            </label>
            <select
              value={nouvelleCategorie}
              onChange={(e) => setNouvelleCategorie(e.target.value)}
              className="w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm bg-white text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
            >
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
              <option value="__autre__">Nouvelle catégorie…</option>
            </select>
          </div>
          {nouvelleCategorie === '__autre__' && (
            <div className="flex-1 min-w-[160px]">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1">
                Nom de la catégorie
              </label>
              <input
                type="text"
                value={nouvelleCategoriePerso}
                onChange={(e) => setNouvelleCategoriePerso(e.target.value)}
                className="w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
              />
            </div>
          )}
          <div className="flex-1 min-w-[180px]">
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1">
              Libellé
            </label>
            <input
              type="text"
              value={nouveauLibelle}
              onChange={(e) => setNouveauLibelle(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') confirmerAjout() }}
              placeholder="Ex : Assurance flotte"
              className="w-full border border-primary-200 rounded-lg px-2 py-1.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300"
            />
          </div>
          <button
            onClick={confirmerAjout}
            disabled={!nouveauLibelle.trim()}
            className="px-4 py-1.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            Ajouter
          </button>
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm table-fixed">
          <thead>
            <tr className="border-b border-primary-100">
              <th className="text-left text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-2 py-1.5 w-48">Poste</th>
              {mois.map((m) => (
                <th key={m.cle} className="text-right text-[10px] font-bold text-primary-600 uppercase tracking-[0.15em] px-2 py-1.5 capitalize whitespace-nowrap w-28">
                  {m.label}
                </th>
              ))}
              <th className="w-7" />
            </tr>
          </thead>
          <tbody>
            {categories.map((cat) => (
              <Fragment key={cat}>
                <tr className="bg-primary-50">
                  <td colSpan={NB_MOIS + 2} className="px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-700">
                    {cat}
                  </td>
                </tr>
                {lignes.filter((l) => l.categorie === cat).map((l) => {
                  const auto = valeursAuto.get(l.id) ?? [null, null, null]
                  return (
                    <tr key={l.id} className="border-b border-primary-50 hover:bg-primary-50/60 group">
                      <td className="px-1.5 py-0">
                        <input
                          type="text"
                          defaultValue={l.libelle}
                          onBlur={(e) => {
                            const v = e.target.value.trim()
                            if (v && v !== l.libelle) onRenommer(l.id, v)
                          }}
                          className="w-full bg-transparent text-xs text-primary-800 px-1 py-1 rounded truncate hover:bg-white focus:bg-white focus:outline-none focus:ring-2 focus:ring-primary-300"
                        />
                      </td>
                      {([0, 1, 2] as const).map((m) => (
                        <CelluleMontant
                          key={m}
                          valeur={[l.montant_m0, l.montant_m1, l.montant_m2][m]}
                          valeurAuto={auto[m]}
                          onChange={(v) => onChangeMontant(l.id, m, v)}
                        />
                      ))}
                      <td className="px-1">
                        <button
                          onClick={() => onSupprimer(l.id)}
                          title="Supprimer la ligne"
                          className="w-6 h-6 flex items-center justify-center rounded-lg text-primary-300 opacity-0 group-hover:opacity-100 hover:bg-danger-100 hover:text-danger-600 transition-all"
                        >
                          <Trash2 size={12} />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </Fragment>
            ))}
            <tr className="border-t-2 border-primary-200 font-bold">
              <td className="px-2 py-1.5 text-[10px] uppercase tracking-[0.15em] text-primary-900">Total {section === 'recettes' ? 'recettes' : 'dépenses'}</td>
              {totalParMois.map((t, i) => (
                <td key={i} className="px-2 py-1.5 text-right text-xs tabular-nums text-primary-900">{formatEuros(t)}</td>
              ))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Réglage numérique compact ─────────────────────────────────────────────────

function Reglage({
  label, valeur, suffixe, onChange, decimales = false, effacable = false,
}: {
  label: string
  valeur: number
  suffixe: string
  // `null` n'est transmis que si `effacable` : la case vidée repasse en calcul.
  onChange: (v: number | null) => void
  decimales?: boolean
  effacable?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [saisie, setSaisie] = useState(String(valeur))
  const [saisieInitiale, setSaisieInitiale] = useState(String(valeur))

  useEffect(() => { if (!editing) setSaisie(String(valeur)) }, [valeur, editing])

  function ouvrir() {
    setSaisie(String(valeur))
    setSaisieInitiale(String(valeur))
    setEditing(true)
  }

  function valider() {
    setEditing(false)
    // Sans modification, ne rien écrire : ouvrir puis quitter une valeur
    // calculée ne doit pas la figer.
    if (saisie.trim() === saisieInitiale.trim()) return
    if (effacable && saisie.trim() === '') { onChange(null); return }
    const n = decimales ? Number(saisie.replace(',', '.')) : parseInt(saisie, 10)
    if (Number.isFinite(n) && n >= 0) onChange(n)
    else setSaisie(String(valeur))
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200">{label}</span>
      {editing ? (
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === 'Enter') valider()
            if (e.key === 'Escape') { setSaisie(String(valeur)); setEditing(false) }
          }}
          className="w-28 bg-transparent text-3xl font-bold tabular-nums text-success-300 border-b-2 border-success-300 focus:outline-none"
        />
      ) : (
        <button
          type="button"
          onClick={ouvrir}
          title="Cliquer pour modifier"
          className="flex items-center gap-2 text-3xl font-bold tabular-nums text-success-300 hover:opacity-80 transition-opacity text-left"
        >
          {valeur.toLocaleString('fr-FR')}
          <span className="text-base text-primary-200 font-medium">{suffixe}</span>
          <Pencil size={13} className="text-primary-300" />
        </button>
      )}
    </div>
  )
}

// ─── Réglage sur fond clair, en en-tête de page ────────────────────────────────

function ReglageClair({
  label, valeur, suffixe, onChange,
}: {
  label: string
  valeur: number
  suffixe: string
  onChange: (v: number) => void
}) {
  const [editing, setEditing] = useState(false)
  const [saisie, setSaisie] = useState(String(valeur))
  const [saisieInitiale, setSaisieInitiale] = useState(String(valeur))

  useEffect(() => { if (!editing) setSaisie(String(valeur)) }, [valeur, editing])

  function ouvrir() {
    setSaisie(String(valeur))
    setSaisieInitiale(String(valeur))
    setEditing(true)
  }

  function valider() {
    setEditing(false)
    if (saisie.trim() === saisieInitiale.trim()) return
    const n = Number(saisie.replace(',', '.'))
    if (Number.isFinite(n) && n >= 0) onChange(n)
    else setSaisie(String(valeur))
  }

  return (
    <div className="flex flex-col gap-1">
      <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600">{label}</span>
      {editing ? (
        <input
          type="text"
          inputMode="decimal"
          autoFocus
          value={saisie}
          onChange={(e) => setSaisie(e.target.value)}
          onFocus={(e) => e.currentTarget.select()}
          onBlur={valider}
          onKeyDown={(e) => {
            if (e.key === 'Enter') valider()
            if (e.key === 'Escape') { setSaisie(String(valeur)); setEditing(false) }
          }}
          className="w-28 border border-primary-300 rounded-lg px-2 py-1.5 text-sm font-bold tabular-nums text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300"
        />
      ) : (
        <button
          type="button"
          onClick={ouvrir}
          title="Cliquer pour modifier"
          className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg border border-primary-200 bg-white hover:bg-primary-50 transition-colors text-sm font-bold tabular-nums text-primary-900"
        >
          {valeur.toLocaleString('fr-FR')} {suffixe}
          <Pencil size={11} className="text-primary-400" />
        </button>
      )}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function Projections() {
  const { pieces, chargement: chargementStock } = useStock()
  const { commandesEnCours } = useCommandes()
  const { expeditions } = useExpeditions()
  const {
    lignes, chargement: chargementLignes,
    definirMontant, renommerLigne, ajouterLigne, supprimerLigne, decalerDunMois,
  } = useProjections()
  const {
    objectifVenteMensuel, prixVenteMoyenTtc, tresorerieInitiale, sousEnsembleBoueeId,
    projectionsMoisDebut, caTtcRealise, definirObjectifVenteMensuel, definirPrixVenteMoyenTtc,
    definirTresorerieInitiale, definirCaTtcRealise, avancerMoisProjections,
    chargement: chargementParam,
  } = useParametreProduction()

  const [nomenclature, setNomenclature] = useState<NomEntry[]>([])
  const [bascule, setBascule] = useState(false)
  const [confirmerBascule, setConfirmerBascule] = useState(false)

  // Réalisé du mois calendaire en cours, d'après les ventes saisies.
  const moisEnCours = useMemo(
    () => new Date().toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }),
    []
  )
  const { ventesRealiseesMois, caHtRealiseMois } = useMemo(() => {
    const n = new Date()
    const debutMois = new Date(n.getFullYear(), n.getMonth(), 1)
    const duMois = expeditions.filter((e) => new Date(e.date_commande) >= debutMois)
    return {
      // Seules les bouées complètes comptent comme « vente réalisée ».
      ventesRealiseesMois: duMois.filter((e) => e.categorie === 'vente').length,
      caHtRealiseMois: duMois.reduce((s, e) => s + (e.montant_paye ?? 0), 0),
    }
  }, [expeditions])
  const caTtcRealiseEffectif = caTtcRealise ?? caHtRealiseMois * 1.2

  const debut = useMemo(() => moisDebutDepuis(projectionsMoisDebut), [projectionsMoisDebut])
  const mois = useMemo(() => moisProjetes(debut), [debut])
  const decalage = useMemo(() => decalageMois(debut), [debut])

  // Le décalage et le remplacement des montants doivent aller ensemble.
  async function passerAuMoisSuivant() {
    setBascule(true)
    try {
      await decalerDunMois()
      await avancerMoisProjections()
    } finally {
      setBascule(false)
    }
  }

  useEffect(() => {
    supabase
      .from('nomenclature')
      .select('piece_id, sous_ensemble_id, sous_ensemble_enfant_id, quantite_requise')
      .then(({ data }) => setNomenclature((data as NomEntry[]) ?? []))
  }, [])

  // Achats de matières premières projetés, mois par mois.
  // La simulation part toujours du stock d'aujourd'hui : si la fenêtre
  // affichée commence plus tard, on simule les mois intermédiaires puis on ne
  // garde que les trois mois visibles.
  const { mois: reappro, piecesNonChiffrees } = useMemo(() => {
    const resultat = projeterAchatsMatieresPremieres({
      sousEnsembleBoueeId,
      objectifVenteMensuel,
      nbMois: decalage + NB_MOIS,
      pieces,
      nomenclature,
      commandesEnCours,
    })
    return { ...resultat, mois: resultat.mois.slice(decalage) }
  }, [sousEnsembleBoueeId, objectifVenteMensuel, pieces, nomenclature, decalage, commandesEnCours])

  // Valeurs calculées par ligne automatique.
  const valeursAuto = useMemo(() => {
    const map = new Map<string, (number | null)[]>()
    for (const l of lignes) {
      if (l.auto === 'ca') {
        const ca = objectifVenteMensuel * prixVenteMoyenTtc
        map.set(l.id, [ca, ca, ca])
      } else if (l.auto === 'achats_mp') {
        map.set(l.id, reappro.map((m) => m.cout))
      }
    }
    return map
  }, [lignes, objectifVenteMensuel, prixVenteMoyenTtc, reappro])

  function montantEffectif(l: LigneProjection, m: 0 | 1 | 2): number {
    const saisi = [l.montant_m0, l.montant_m1, l.montant_m2][m]
    if (saisi != null) return saisi
    return valeursAuto.get(l.id)?.[m] ?? 0
  }

  const recettes = useMemo(() => lignes.filter((l) => l.section === 'recettes'), [lignes])
  const depenses = useMemo(() => lignes.filter((l) => l.section === 'depenses'), [lignes])

  const totauxRecettes = useMemo(
    () => ([0, 1, 2] as const).map((m) => recettes.reduce((s, l) => s + montantEffectif(l, m), 0)),
    [recettes, valeursAuto]
  )
  const totauxDepenses = useMemo(
    () => ([0, 1, 2] as const).map((m) => depenses.reduce((s, l) => s + montantEffectif(l, m), 0)),
    [depenses, valeursAuto]
  )

  // Trésorerie de fin de mois, cumulée depuis le solde de départ.
  const tresorerie = useMemo(() => {
    const suite: number[] = []
    let courante = tresorerieInitiale
    for (let m = 0; m < NB_MOIS; m++) {
      courante += totauxRecettes[m] - totauxDepenses[m]
      suite.push(courante)
    }
    return suite
  }, [tresorerieInitiale, totauxRecettes, totauxDepenses])

  const chargement = chargementStock || chargementLignes || chargementParam
  return (
    <div className="p-5 md:p-8">
      <div className="flex items-end justify-between gap-3 mb-8">
        <div>
          <h1 className="text-3xl font-bold text-primary-900 leading-none">Projections</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-1.5">
            Plan de trésorerie — {mois[0]?.label} à {mois[NB_MOIS - 1]?.label}
          </p>
        </div>
        <div className="flex items-end gap-4 flex-shrink-0 flex-wrap justify-end">
          <ReglageClair
            label="Prix de vente moyen TTC"
            valeur={prixVenteMoyenTtc}
            suffixe="€"
            onChange={definirPrixVenteMoyenTtc}
          />
          <ReglageClair
            label="Trésorerie de départ"
            valeur={tresorerieInitiale}
            suffixe="€"
            onChange={definirTresorerieInitiale}
          />
          <button
            onClick={() => setConfirmerBascule(true)}
            disabled={bascule}
            title="Abandonne le premier mois, décale les deux autres et ouvre un nouveau troisième mois"
            className="flex items-center gap-2 px-4 py-2.5 bg-white border border-primary-200 hover:bg-primary-50 disabled:opacity-40 text-primary-900 text-sm font-semibold rounded-xl transition-colors"
          >
            <CalendarClock size={15} />
            <span className="hidden sm:inline">{bascule ? 'Décalage…' : 'Passer au mois suivant'}</span>
          </button>
        </div>
      </div>

      {chargement ? (
        <div className="flex items-center justify-center h-40 text-primary-400 text-sm">Chargement...</div>
      ) : (
        <>
          {/* Objectif, puis réalisé du mois en cours */}
          <div className="grid grid-cols-1 sm:grid-cols-3 bg-primary-900 rounded-2xl overflow-hidden mb-6">
            <div className="px-6 py-5">
              <Reglage
                label="Objectif de vente"
                valeur={objectifVenteMensuel}
                suffixe="/ mois"
                onChange={(v) => definirObjectifVenteMensuel(v ?? 0)}
              />
            </div>
            <div className="px-6 py-5 border-t sm:border-t-0 sm:border-l border-primary-800 flex flex-col gap-1">
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-200">
                Ventes réalisées
              </span>
              <span className="text-3xl font-bold tabular-nums text-success-300">
                {ventesRealiseesMois}
              </span>
              <span className="text-[10px] text-primary-300 capitalize">
                {moisEnCours} — bouées complètes
              </span>
            </div>
            <div className="px-6 py-5 border-t sm:border-t-0 sm:border-l border-primary-800">
              <Reglage
                label="CA TTC réalisé"
                valeur={Math.round(caTtcRealiseEffectif)}
                suffixe="€"
                onChange={definirCaTtcRealise}
                decimales
                effacable
              />
              <span className="text-[10px] text-primary-300 capitalize block mt-1">
                {moisEnCours}
                {caTtcRealise == null ? ' — calculé (HT × 1,2)' : ' — saisi'}
              </span>
            </div>
          </div>

          {/* Graphe de trésorerie */}
          <div className="bg-white rounded-2xl border border-primary-100 p-5 mb-6">
            <div className="flex items-center gap-3 mb-5">
              <Wallet size={16} className="text-primary-700" />
              <h2 className="text-sm font-bold text-primary-900">Trésorerie projetée</h2>
            </div>
            <GraphiqueLigne
              points={[
                { label: "Aujourd'hui", valeur: tresorerieInitiale },
                ...tresorerie.map((v, i) => ({ label: mois[i].label, valeur: v, projete: true })),
              ]}
              formatValeur={formatEuros}
            />
            {tresorerie.some((v) => v < 0) && (
              <p className="text-xs text-danger-600 mt-4 flex items-center gap-1.5">
                <AlertTriangle size={13} />
                La trésorerie projetée passe sous zéro sur la période.
              </p>
            )}
          </div>

          {/* Recettes */}
          <TableauSection
            titre="Recettes TTC"
            section="recettes"
            lignes={recettes}
            mois={mois}
            valeursAuto={valeursAuto}
            totalParMois={totauxRecettes}
            onChangeMontant={definirMontant}
            onRenommer={renommerLigne}
            onSupprimer={supprimerLigne}
            onAjouter={(cat, lib) => ajouterLigne('recettes', cat, lib)}
          />

          {/* Dépenses */}
          <TableauSection
            titre="Dépenses TTC"
            section="depenses"
            lignes={depenses}
            mois={mois}
            valeursAuto={valeursAuto}
            totalParMois={totauxDepenses}
            onChangeMontant={definirMontant}
            onRenommer={renommerLigne}
            onSupprimer={supprimerLigne}
            onAjouter={(cat, lib) => ajouterLigne('depenses', cat, lib)}
          />

          {/* Détail des achats projetés */}
          <div className="bg-white rounded-2xl border border-primary-100 p-5">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp size={16} className="text-primary-700" />
              <h2 className="text-sm font-bold text-primary-900">Détail des achats de matières premières projetés</h2>
            </div>
            <p className="text-xs text-primary-500 mb-4 leading-relaxed">
              Chaque mois, l'objectif de vente consomme les pièces selon la nomenclature du produit fini.
              Dès qu'une pièce atteint son seuil critique, on rachète <strong>un MOQ complet</strong> à son
              prix unitaire, et le stock est recrédité d'autant.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {reappro.map((m, i) => (
                <div key={i} className="border border-primary-100 rounded-xl p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 capitalize mb-1">
                    {mois[i].label}
                  </p>
                  <p className="text-xl font-bold text-primary-900 tabular-nums mb-2">{formatEuros(m.cout)}</p>
                  {m.lignes.length === 0 ? (
                    <p className="text-xs text-primary-400 italic">Aucun réapprovisionnement</p>
                  ) : (
                    <ul className="space-y-1">
                      {m.lignes.map((l, j) => (
                        <li key={j} className="text-xs text-primary-600 flex justify-between gap-2">
                          <span className="truncate" title={l.nom}>{l.nom}</span>
                          <span className="tabular-nums whitespace-nowrap text-primary-500">
                            {l.moq} × {l.prixUnitaire.toLocaleString('fr-FR', { minimumFractionDigits: 2 })} €
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ))}
            </div>
            {piecesNonChiffrees.length > 0 && (
              <p className="text-xs text-alert-600 mt-4 flex items-start gap-1.5 leading-relaxed">
                <AlertTriangle size={13} className="flex-shrink-0 mt-0.5" />
                <span>
                  {piecesNonChiffrees.length} pièce{piecesNonChiffrees.length > 1 ? 's' : ''} passe
                  {piecesNonChiffrees.length > 1 ? 'nt' : ''} en critique sans MOQ ni prix unitaire renseigné,
                  et {piecesNonChiffrees.length > 1 ? 'sont' : 'est'} donc absente
                  {piecesNonChiffrees.length > 1 ? 's' : ''} du chiffrage : {piecesNonChiffrees.join(', ')}.
                </span>
              </p>
            )}
          </div>
        </>
      )}

      {confirmerBascule && (
        <ConfirmDialog
          titre="Passer au mois suivant"
          message={`Les montants de ${mois[0]?.label} seront définitivement abandonnés. ${mois[1]?.label} et ${mois[2]?.label} se décalent vers la gauche, et un nouveau mois vide s'ouvre à droite.`}
          onCancel={() => !bascule && setConfirmerBascule(false)}
          onConfirm={async () => { await passerAuMoisSuivant(); setConfirmerBascule(false) }}
        />
      )}
    </div>
  )
}

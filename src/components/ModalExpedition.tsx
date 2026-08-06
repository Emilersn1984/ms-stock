import { useState, useMemo, useRef, useEffect } from 'react'
import { PackagePlus, Send, Search, X, Minus, Plus as PlusIcon, Pencil } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Client,
  Expedition,
  ExpeditionItem,
  SousEnsemble,
  Piece,
  Transporteur,
  CategorieExpedition,
  Langue,
  Utilisateur,
} from '../types'
import { TRANSPORTEURS } from '../utils/trackingUrl'
import { LANGUES } from '../utils/langues'
import { PAYS, drapeauPays } from '../utils/pays'
import { creerOperation } from '../utils/creerOperation'

const CATEGORIES: { value: CategorieExpedition; label: string }[] = [
  { value: 'vente', label: 'Vente' },
  { value: 'sav', label: 'SAV' },
  { value: 'demo', label: 'Démo' },
  { value: 'autre', label: 'Autre' },
]

const VERSIONS_CODE = ['v1', 'v2', 'v3', 'v4', 'v5']

type Props = {
  mode: 'creer' | 'finaliser' | 'modifier'
  expedition: Expedition | null
  clients: Client[]
  sousEnsembles: SousEnsemble[]
  pieces: Piece[]
  expeditionsEnvoyees: Expedition[]
  utilisateur: Utilisateur
  onClose: () => void
  onSaved: () => void
}

function adresseComplete(c: { adresse?: string | null; code_postal?: string | null; ville?: string | null } | null | undefined): string {
  if (!c) return ''
  return [c.adresse, c.code_postal, c.ville].filter((v) => v && v.trim()).join('\n')
}

export default function ModalExpedition({
  mode,
  expedition,
  clients,
  sousEnsembles,
  pieces,
  expeditionsEnvoyees,
  utilisateur,
  onClose,
  onSaved,
}: Props) {
  const [nom, setNom] = useState(expedition?.nom_destinataire ?? '')
  const [prenom, setPrenom] = useState(expedition?.prenom_destinataire ?? '')
  const [langue, setLangue] = useState<Langue | ''>(expedition?.langue ?? '')
  const [adresse, setAdresse] = useState(adresseComplete(expedition))
  const [pays, setPays] = useState(expedition?.pays ?? '')
  const [clientIdSelectionne, setClientIdSelectionne] = useState<string | null>(expedition?.client_id ?? null)

  const [rechercheClient, setRechercheClient] = useState(
    expedition?.clients ? `${expedition.clients.prenom} ${expedition.clients.nom}` : ''
  )
  const [dropdownClientOuvert, setDropdownClientOuvert] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  const [dropdownPaysOuvert, setDropdownPaysOuvert] = useState(false)
  const paysDropdownRef = useRef<HTMLDivElement>(null)

  const [versionCode, setVersionCode] = useState(expedition?.version_code ?? '')
  const [categorie, setCategorie] = useState<CategorieExpedition | ''>(expedition?.categorie ?? '')
  const [commentaire, setCommentaire] = useState(expedition?.commentaire ?? '')
  const [transporteur, setTransporteur] = useState<Transporteur | ''>(expedition?.transporteur ?? '')
  const [numeroSuivi, setNumeroSuivi] = useState(expedition?.numero_suivi ?? '')

  const [rechercheSav, setRechercheSav] = useState('')
  const [dropdownSavOuvert, setDropdownSavOuvert] = useState(false)
  const savDropdownRef = useRef<HTMLDivElement>(null)

  const [items, setItems] = useState<ExpeditionItem[]>(expedition?.items ?? [])
  const [rechercheItem, setRechercheItem] = useState('')

  const [numeroSerie, setNumeroSerie] = useState(expedition?.numero_serie ?? '')
  const [dateEnvoiPrevisionnelle, setDateEnvoiPrevisionnelle] = useState(
    expedition?.date_envoi_previsionnelle ? expedition.date_envoi_previsionnelle.slice(0, 10) : ''
  )
  const isAdmin = utilisateur.role === 'patron'

  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // À la finalisation, les informations déjà renseignées lors de la création
  // de la commande ne doivent plus être modifiables (seuls le contenu du colis,
  // le transporteur, le suivi et le n° de série restent éditables).
  const verrouilleALaFinalisation = mode === 'finaliser'
  const champVerrouille = (valeur: string | null | undefined) =>
    verrouilleALaFinalisation && !!valeur && valeur.trim() !== ''
  const champDesactiveClass = 'disabled:bg-primary-50 disabled:text-primary-500 disabled:cursor-not-allowed'

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setDropdownClientOuvert(false)
      }
      if (savDropdownRef.current && !savDropdownRef.current.contains(e.target as Node)) {
        setDropdownSavOuvert(false)
      }
      if (paysDropdownRef.current && !paysDropdownRef.current.contains(e.target as Node)) {
        setDropdownPaysOuvert(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const clientsFiltres = useMemo(() => {
    if (!rechercheClient.trim()) return clients.slice(0, 8)
    const q = rechercheClient.toLowerCase()
    return clients.filter((c) => `${c.prenom} ${c.nom}`.toLowerCase().includes(q)).slice(0, 8)
  }, [clients, rechercheClient])

  const paysFiltres = useMemo(() => {
    const q = pays.trim().toLowerCase()
    if (!q) return PAYS.slice(0, 8)
    return PAYS.filter((p) => p.nom.toLowerCase().startsWith(q) || p.code.toLowerCase() === q).slice(0, 8)
  }, [pays])

  // Recherche SAV : par client déjà renseigné, ou par numéro de série d'un colis déjà expédié
  const resultatsSav = useMemo(() => {
    if (!rechercheSav.trim()) return []
    const q = rechercheSav.toLowerCase()
    const parClient = clients
      .filter((c) => `${c.prenom} ${c.nom}`.toLowerCase().includes(q))
      .map((c) => ({
        type: 'client' as const,
        client: c as Client | null,
        numeroSerie: null as string | null,
        nomDest: undefined as string | undefined,
        prenomDest: undefined as string | undefined,
      }))
    const parSerie = expeditionsEnvoyees
      .filter((e) => e.numero_serie && e.numero_serie.toLowerCase().includes(q))
      .map((e) => ({
        type: 'serie' as const,
        client: (e.clients ? clients.find((c) => c.id === e.clients!.id) ?? null : null) as Client | null,
        numeroSerie: e.numero_serie as string | null,
        nomDest: e.nom_destinataire as string | undefined,
        prenomDest: e.prenom_destinataire as string | undefined,
      }))
    return [...parClient, ...parSerie].slice(0, 8)
  }, [rechercheSav, clients, expeditionsEnvoyees])

  function selectionnerClient(c: Client) {
    setClientIdSelectionne(c.id)
    setNom(c.nom)
    setPrenom(c.prenom)
    setLangue(c.langue ?? '')
    setAdresse(adresseComplete(c))
    setPays(c.pays ?? '')
    setRechercheClient(`${c.prenom} ${c.nom}`)
    setDropdownClientOuvert(false)
  }

  function selectionnerPays(code: string) {
    setPays(code)
    setDropdownPaysOuvert(false)
  }

  function selectionnerResultatSav(r: { client: Client | null; numeroSerie: string | null; nomDest?: string; prenomDest?: string }) {
    if (r.client) {
      selectionnerClient(r.client)
    } else {
      setNom(r.nomDest ?? '')
      setPrenom(r.prenomDest ?? '')
    }
    if (r.numeroSerie) {
      setRechercheSav(`${r.numeroSerie}`)
    }
    setDropdownSavOuvert(false)
  }

  // Un sous-ensemble/pièce déjà réservé dans cette expédition reste affiché même si son
  // stock disponible est retombé à 0, afin de pouvoir le réduire ou le retirer.
  const sousEnsemblesDisponibles = useMemo(() => {
    const idsReserves = new Set(items.filter((i) => i.sous_ensemble_id).map((i) => i.sous_ensemble_id as string))
    return sousEnsembles.filter((se) => se.quantite > 0 || idsReserves.has(se.id))
  }, [sousEnsembles, items])

  const piecesDisponibles = useMemo(() => {
    const idsReserves = new Set(items.filter((i) => i.piece_id).map((i) => i.piece_id as string))
    return pieces.filter((p) => p.quantite > 0 || idsReserves.has(p.id))
  }, [pieces, items])

  const sousEnsemblesFiltres = useMemo(() => {
    if (!rechercheItem.trim()) return sousEnsemblesDisponibles
    const q = rechercheItem.toLowerCase()
    return sousEnsemblesDisponibles.filter((se) => se.nom.toLowerCase().includes(q))
  }, [sousEnsemblesDisponibles, rechercheItem])

  const piecesFiltrees = useMemo(() => {
    if (!rechercheItem.trim()) return piecesDisponibles
    const q = rechercheItem.toLowerCase()
    return piecesDisponibles.filter((p) => p.nom.toLowerCase().includes(q))
  }, [piecesDisponibles, rechercheItem])

  function quantiteSousEnsemble(seId: string): number {
    return items.find((i) => i.sous_ensemble_id === seId)?.quantite ?? 0
  }

  function quantitePiece(pieceId: string): number {
    return items.find((i) => i.piece_id === pieceId)?.quantite ?? 0
  }

  function ajusterItemSousEnsemble(se: SousEnsemble, delta: number) {
    setItems((prev) => {
      const existant = prev.find((i) => i.sous_ensemble_id === se.id)
      const actuelle = existant?.quantite ?? 0
      const max = se.quantite + actuelle
      const nouvelle = Math.max(0, Math.min(max, actuelle + delta))
      if (nouvelle === 0) {
        return prev.filter((i) => i.sous_ensemble_id !== se.id)
      }
      if (existant) {
        return prev.map((i) => (i.sous_ensemble_id === se.id ? { ...i, quantite: nouvelle } : i))
      }
      return [...prev, { sous_ensemble_id: se.id, piece_id: null, nom: se.nom, quantite: nouvelle }]
    })
  }

  function ajusterItemPiece(piece: Piece, delta: number) {
    setItems((prev) => {
      const existant = prev.find((i) => i.piece_id === piece.id)
      const actuelle = existant?.quantite ?? 0
      const max = piece.quantite + actuelle
      const nouvelle = Math.max(0, Math.min(max, actuelle + delta))
      if (nouvelle === 0) {
        return prev.filter((i) => i.piece_id !== piece.id)
      }
      if (existant) {
        return prev.map((i) => (i.piece_id === piece.id ? { ...i, quantite: nouvelle } : i))
      }
      return [...prev, { sous_ensemble_id: null, piece_id: piece.id, nom: piece.nom, quantite: nouvelle }]
    })
  }

  // Édition du contenu autorisée à la finalisation, ou lors de la modification
  // d'une expédition déjà envoyée/reçue (le stock est alors réajusté à l'enregistrement).
  const editionContenuAutorisee = mode === 'finaliser' || (mode === 'modifier' && expedition?.statut !== 'a_expedier')

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim() || !prenom.trim()) { setErreur('Nom et prénom du destinataire requis'); return }
    if (mode === 'finaliser' && !categorie) { setErreur('Veuillez choisir une catégorie de colis'); return }
    if (!verrouilleALaFinalisation && !clientIdSelectionne) { setErreur('Veuillez sélectionner un client existant'); return }

    setEnvoi(true)
    setErreur(null)
    try {
      const clientId = clientIdSelectionne
      if (clientId) {
        await supabase
          .from('clients')
          .update({
            nom: nom.trim(),
            prenom: prenom.trim(),
            langue: langue || null,
            adresse: adresse.trim() || null,
            ville: null,
            code_postal: null,
            pays: pays.trim() || null,
          })
          .eq('id', clientId)
      }

      const champsCommuns = {
        client_id: clientId,
        nom_destinataire: nom.trim(),
        prenom_destinataire: prenom.trim(),
        langue: langue || null,
        adresse: adresse.trim() || null,
        ville: null,
        code_postal: null,
        pays: pays.trim() || null,
        version_code: versionCode.trim() || null,
        categorie: categorie || null,
        commentaire: commentaire.trim() || null,
        transporteur: transporteur || null,
        numero_suivi: numeroSuivi.trim() || null,
        date_envoi_previsionnelle: dateEnvoiPrevisionnelle || null,
      }

      if (mode === 'creer') {
        const { error } = await supabase.from('expeditions').insert({
          ...champsCommuns,
          statut: 'a_expedier',
          origine: 'manuel',
          items: [],
          utilisateur_id: utilisateur.id,
        })
        if (error) throw error
      } else if (mode === 'modifier' && expedition) {
        // Si l'expédition est déjà envoyée/reçue, on répercute les différences
        // de contenu sur les stocks (sous-ensembles et pièces classiques).
        if (expedition.statut !== 'a_expedier') {
          const cle = (i: ExpeditionItem) => (i.sous_ensemble_id ? `se:${i.sous_ensemble_id}` : `p:${i.piece_id}`)
          const mapAncien = new Map((expedition.items ?? []).map((i) => [cle(i), i.quantite]))
          const mapNouveau = new Map(items.map((i) => [cle(i), i.quantite]))
          const clesTouchees = new Set([...mapAncien.keys(), ...mapNouveau.keys()])

          for (const c of clesTouchees) {
            const avant = mapAncien.get(c) ?? 0
            const apres = mapNouveau.get(c) ?? 0
            const delta = apres - avant
            if (delta === 0) continue

            if (c.startsWith('se:')) {
              const se = sousEnsembles.find((s) => s.id === c.slice(3))
              if (!se) continue
              const nouvelleQuantite = se.quantite - delta
              const { error: errSe } = await supabase
                .from('sous_ensembles')
                .update({ quantite: nouvelleQuantite })
                .eq('id', se.id)
              if (errSe) throw errSe
              await creerOperation({
                type: 'expedition',
                sous_ensemble_id: se.id,
                quantite_avant: se.quantite,
                quantite_apres: nouvelleQuantite,
                delta: -delta,
                utilisateur_id: utilisateur.id,
                commentaire: `Modification expédition — ${prenom.trim()} ${nom.trim()}`,
              })
            } else {
              const piece = pieces.find((p) => p.id === c.slice(2))
              if (!piece) continue
              const nouvelleQuantite = piece.quantite - delta
              const { error: errPiece } = await supabase
                .from('pieces')
                .update({ quantite: nouvelleQuantite })
                .eq('id', piece.id)
              if (errPiece) throw errPiece
              await creerOperation({
                type: 'expedition',
                piece_id: piece.id,
                quantite_avant: piece.quantite,
                quantite_apres: nouvelleQuantite,
                delta: -delta,
                utilisateur_id: utilisateur.id,
                commentaire: `Modification expédition — ${prenom.trim()} ${nom.trim()}`,
              })
            }
          }
        }

        const { error } = await supabase
          .from('expeditions')
          .update({
            ...champsCommuns,
            items,
            ...(isAdmin ? { numero_serie: numeroSerie.trim() || null } : {}),
          })
          .eq('id', expedition.id)
        if (error) throw error
      } else if (expedition) {
        // Décompte du stock des sous-ensembles et pièces sélectionnés
        for (const item of items) {
          if (item.sous_ensemble_id) {
            const se = sousEnsembles.find((s) => s.id === item.sous_ensemble_id)
            if (!se) continue
            const nouvelleQuantite = se.quantite - item.quantite
            const { error: errSe } = await supabase
              .from('sous_ensembles')
              .update({ quantite: nouvelleQuantite })
              .eq('id', se.id)
            if (errSe) throw errSe

            await creerOperation({
              type: 'expedition',
              sous_ensemble_id: se.id,
              quantite_avant: se.quantite,
              quantite_apres: nouvelleQuantite,
              delta: -item.quantite,
              utilisateur_id: utilisateur.id,
              commentaire: `Expédition — ${prenom.trim()} ${nom.trim()}`,
            })
          } else if (item.piece_id) {
            const piece = pieces.find((p) => p.id === item.piece_id)
            if (!piece) continue
            const nouvelleQuantite = piece.quantite - item.quantite
            const { error: errPiece } = await supabase
              .from('pieces')
              .update({ quantite: nouvelleQuantite })
              .eq('id', piece.id)
            if (errPiece) throw errPiece

            await creerOperation({
              type: 'expedition',
              piece_id: piece.id,
              quantite_avant: piece.quantite,
              quantite_apres: nouvelleQuantite,
              delta: -item.quantite,
              utilisateur_id: utilisateur.id,
              commentaire: `Expédition — ${prenom.trim()} ${nom.trim()}`,
            })
          }
        }

        // Génération automatique du numéro de série à la finalisation
        // (l'admin peut avoir déjà saisi/modifié un numéro manuellement dans le champ dédié)
        let numeroSerieFinal: string | null = numeroSerie.trim() || expedition.numero_serie || null
        if (!numeroSerieFinal) {
          const { data: serieData, error: errSerie } = await supabase.rpc('generate_numero_serie')
          if (errSerie) throw errSerie
          numeroSerieFinal = serieData as string
        }

        const { error } = await supabase
          .from('expeditions')
          .update({
            ...champsCommuns,
            statut: 'envoye',
            items,
            numero_serie: numeroSerieFinal,
            date_expedition: new Date().toISOString(),
          })
          .eq('id', expedition.id)
        if (error) throw error
      }

      onSaved()
      onClose()
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : 'Erreur lors de l\'enregistrement')
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
              {mode === 'creer' ? (
                <PackagePlus size={17} className="text-primary-700" />
              ) : mode === 'modifier' ? (
                <Pencil size={17} className="text-primary-700" />
              ) : (
                <Send size={17} className="text-primary-700" />
              )}
            </div>
            <div>
              <h2 className="text-base font-bold text-primary-900 leading-tight">
                {mode === 'creer' ? 'Nouvelle expédition' : mode === 'modifier' ? 'Modifier l\'expédition' : 'Finaliser l\'expédition'}
              </h2>
              <p className="text-xs text-primary-500 mt-0.5">
                {mode === 'creer'
                  ? 'Ajouter manuellement une commande à expédier'
                  : mode === 'modifier'
                    ? 'Modifier les informations de la commande'
                    : 'Compléter les informations avant envoi'}
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
          {/* Recherche client existant */}
          {!verrouilleALaFinalisation && (
            <div ref={clientDropdownRef} className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Client
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
                <input
                  type="text"
                  value={rechercheClient}
                  onChange={(e) => { setRechercheClient(e.target.value); setDropdownClientOuvert(true); setClientIdSelectionne(null) }}
                  onFocus={() => setDropdownClientOuvert(true)}
                  placeholder="Rechercher un client existant…"
                  className="w-full pl-9 pr-4 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  autoComplete="off"
                />
              </div>
              {dropdownClientOuvert && clientsFiltres.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {clientsFiltres.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => selectionnerClient(c)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition-colors text-left"
                    >
                      <span className="text-base flex-shrink-0">{drapeauPays(c.pays)}</span>
                      <span className="flex-1 text-sm font-medium text-primary-900">{c.prenom} {c.nom}</span>
                      <span className="text-xs text-primary-400 flex-shrink-0">{c.ville ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {clientIdSelectionne && (
                <p className="text-xs text-success-600 mt-1.5 flex items-center gap-1">
                  Client sélectionné — les informations ci-dessous ont été pré-remplies.
                </p>
              )}
            </div>
          )}

          {/* Nom / prénom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Prénom
              </label>
              <input
                type="text"
                value={prenom}
                onChange={(e) => { setPrenom(e.target.value); setClientIdSelectionne(null) }}
                disabled={champVerrouille(expedition?.prenom_destinataire)}
                className={`w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 ${champDesactiveClass}`}
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Nom
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => { setNom(e.target.value); setClientIdSelectionne(null) }}
                disabled={champVerrouille(expedition?.nom_destinataire)}
                className={`w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 ${champDesactiveClass}`}
              />
            </div>
          </div>

          {/* Langue */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Langue
            </label>
            <select
              value={langue}
              onChange={(e) => setLangue(e.target.value as Langue | '')}
              disabled={champVerrouille(expedition?.langue)}
              className={`w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white ${champDesactiveClass}`}
            >
              <option value="">—</option>
              {LANGUES.map((l) => (
                <option key={l.value} value={l.value}>{l.drapeau} {l.label}</option>
              ))}
            </select>
          </div>

          {/* Adresse — un seul champ pour permettre le copier-coller */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Adresse complète
            </label>
            <textarea
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              rows={3}
              placeholder="N° et rue, code postal, ville…"
              disabled={champVerrouille(adresse)}
              className={`w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none ${champDesactiveClass}`}
            />
          </div>

          {/* Pays — sélection par autocomplétion avec drapeau */}
          <div ref={paysDropdownRef} className="relative">
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Pays
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-base pointer-events-none">
                {drapeauPays(pays)}
              </span>
              <input
                type="text"
                value={pays}
                onChange={(e) => { setPays(e.target.value); setDropdownPaysOuvert(true) }}
                onFocus={() => setDropdownPaysOuvert(true)}
                placeholder="Tapez les premières lettres…"
                disabled={champVerrouille(pays)}
                className={`w-full pl-10 pr-4 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 ${champDesactiveClass}`}
                autoComplete="off"
              />
            </div>
            {dropdownPaysOuvert && paysFiltres.length > 0 && (
              <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                {paysFiltres.map((p) => (
                  <button
                    key={p.code}
                    type="button"
                    onClick={() => selectionnerPays(p.code)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition-colors text-left"
                  >
                    <span className="text-base flex-shrink-0">{drapeauPays(p.code)}</span>
                    <span className="flex-1 text-sm font-medium text-primary-900">{p.nom}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Version code + catégorie */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Version du code
              </label>
              <div className="flex gap-1.5">
                {VERSIONS_CODE.map((v) => (
                  <button
                    key={v}
                    type="button"
                    onClick={() => setVersionCode(versionCode === v ? '' : v)}
                    disabled={champVerrouille(expedition?.version_code)}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase transition-colors border disabled:cursor-not-allowed disabled:opacity-50 ${
                      versionCode === v
                        ? 'bg-primary-900 border-primary-900 text-white'
                        : 'border-primary-200 text-primary-600 hover:bg-primary-50'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Catégorie de colis
              </label>
              <select
                value={categorie}
                onChange={(e) => setCategorie(e.target.value as CategorieExpedition | '')}
                disabled={champVerrouille(expedition?.categorie)}
                className={`w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white ${champDesactiveClass}`}
              >
                <option value="">—</option>
                {CATEGORIES.map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Recherche SAV — uniquement à la création/modification, pas à la finalisation */}
          {!verrouilleALaFinalisation && categorie === 'sav' && (
            <div ref={savDropdownRef} className="relative">
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Client / colis d'origine (SAV)
              </label>
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
                <input
                  type="text"
                  value={rechercheSav}
                  onChange={(e) => { setRechercheSav(e.target.value); setDropdownSavOuvert(true) }}
                  onFocus={() => setDropdownSavOuvert(true)}
                  placeholder="Nom du client ou n° de série…"
                  className="w-full pl-9 pr-4 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  autoComplete="off"
                />
              </div>
              {dropdownSavOuvert && resultatsSav.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white border border-primary-100 rounded-xl shadow-lg max-h-48 overflow-y-auto">
                  {resultatsSav.map((r, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => selectionnerResultatSav(r)}
                      className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-primary-50 transition-colors text-left"
                    >
                      <span className="flex-1 text-sm font-medium text-primary-900">
                        {r.client ? `${r.client.prenom} ${r.client.nom}` : `${r.prenomDest ?? ''} ${r.nomDest ?? ''}`}
                      </span>
                      {r.numeroSerie && (
                        <span className="text-xs text-primary-400 tabular-nums flex-shrink-0">{r.numeroSerie}</span>
                      )}
                    </button>
                  ))}
                </div>
              )}
              <p className="text-xs text-primary-400 mt-1">
                Sélectionnez un client/n° de série existant, ou renseignez simplement un nouveau client et un n° de suivi ci-dessous.
              </p>
            </div>
          )}

          {/* Contenu du colis : sous-ensembles + pièces du stock classique — zone distincte pour bien la séparer visuellement du reste du formulaire */}
          {editionContenuAutorisee && (
            <div className="space-y-4 bg-primary-50/80 border border-primary-100 rounded-2xl p-3.5">
              <div className="relative">
                <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
                <input
                  type="text"
                  value={rechercheItem}
                  onChange={(e) => setRechercheItem(e.target.value)}
                  placeholder="Rechercher un élément du stock…"
                  className="w-full pl-9 pr-4 py-2.5 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
                  autoComplete="off"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Sous-ensembles {mode === 'modifier' ? 'du colis' : 'en stock à expédier'}
                </label>
                {sousEnsemblesFiltres.length === 0 ? (
                  <p className="text-xs text-primary-400 italic">
                    {rechercheItem.trim() ? 'Aucun résultat' : 'Aucun sous-ensemble en stock'}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {sousEnsemblesFiltres.map((se) => {
                      const qte = quantiteSousEnsemble(se.id)
                      const max = se.quantite + qte
                      return (
                        <div
                          key={se.id}
                          className="flex items-center justify-between gap-2 border border-primary-100 rounded-xl px-3 py-2 bg-white"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-primary-900 truncate">{se.nom}</p>
                            <p className="text-[11px] text-primary-400 tabular-nums">Stock : {se.quantite}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => ajusterItemSousEnsemble(se, -1)}
                              disabled={qte === 0}
                              className="w-6 h-6 flex items-center justify-center rounded-lg border border-primary-200 text-primary-600 disabled:opacity-30"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-6 text-center text-sm font-bold tabular-nums text-primary-900">{qte}</span>
                            <button
                              type="button"
                              onClick={() => ajusterItemSousEnsemble(se, 1)}
                              disabled={qte >= max}
                              className="w-6 h-6 flex items-center justify-center rounded-lg border border-primary-200 text-primary-600 disabled:opacity-30"
                            >
                              <PlusIcon size={11} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Pièces du stock classique (mousqueton, dyneema…)
                </label>
                {piecesFiltrees.length === 0 ? (
                  <p className="text-xs text-primary-400 italic">
                    {rechercheItem.trim() ? 'Aucun résultat' : 'Aucune pièce en stock'}
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
                    {piecesFiltrees.map((p) => {
                      const qte = quantitePiece(p.id)
                      const max = p.quantite + qte
                      return (
                        <div
                          key={p.id}
                          className="flex items-center justify-between gap-2 border border-primary-100 rounded-xl px-3 py-2 bg-white"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-primary-900 truncate">{p.nom}</p>
                            <p className="text-[11px] text-primary-400 tabular-nums">Stock : {p.quantite}</p>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            <button
                              type="button"
                              onClick={() => ajusterItemPiece(p, -1)}
                              disabled={qte === 0}
                              className="w-6 h-6 flex items-center justify-center rounded-lg border border-primary-200 text-primary-600 disabled:opacity-30"
                            >
                              <Minus size={11} />
                            </button>
                            <span className="w-6 text-center text-sm font-bold tabular-nums text-primary-900">{qte}</span>
                            <button
                              type="button"
                              onClick={() => ajusterItemPiece(p, 1)}
                              disabled={qte >= max}
                              className="w-6 h-6 flex items-center justify-center rounded-lg border border-primary-200 text-primary-600 disabled:opacity-30"
                            >
                              <PlusIcon size={11} />
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Transporteur + suivi */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Transporteur
              </label>
              <select
                value={transporteur}
                onChange={(e) => setTransporteur(e.target.value as Transporteur | '')}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">—</option>
                {TRANSPORTEURS.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                N° de suivi
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

          {/* Commentaire */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Commentaire / instructions
            </label>
            <textarea
              value={commentaire}
              onChange={(e) => setCommentaire(e.target.value)}
              rows={3}
              placeholder="Détails de l'expédition, instructions du client…"
              disabled={champVerrouille(commentaire)}
              className={`w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none ${champDesactiveClass}`}
            />
          </div>

          {/* Date d'envoi prévisionnelle — uniquement à la création/modification */}
          {mode !== 'finaliser' && (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Date d'envoi prévisionnelle
              </label>
              <input
                type="date"
                value={dateEnvoiPrevisionnelle}
                onChange={(e) => setDateEnvoiPrevisionnelle(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          )}

          {isAdmin && (mode === 'modifier' || mode === 'finaliser') ? (
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                N° de série {mode === 'finaliser' ? '(laisser vide pour génération automatique)' : ''}
              </label>
              <input
                type="text"
                value={numeroSerie}
                onChange={(e) => setNumeroSerie(e.target.value)}
                placeholder="Généré automatiquement si vide"
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          ) : expedition?.numero_serie ? (
            <p className="text-xs text-primary-500">
              N° de série : <span className="font-bold text-primary-800">{expedition.numero_serie}</span>
            </p>
          ) : null}

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
              disabled={envoi || !nom.trim() || !prenom.trim() || (!verrouilleALaFinalisation && !clientIdSelectionne)}
              className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 disabled:opacity-40 text-white text-sm font-semibold rounded-xl transition-colors"
            >
              {envoi
                ? 'Enregistrement…'
                : mode === 'creer'
                  ? 'Ajouter à la liste'
                  : mode === 'modifier'
                    ? 'Enregistrer les modifications'
                    : 'Valider l\'expédition'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

import { useState, useMemo, useRef, useEffect } from 'react'
import { PackagePlus, Send, Search, X, Plus as PlusIcon, Pencil, UserSearch, UserPlus2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import {
  Client,
  Expedition,
  ExpeditionItem,
  SousEnsemble,
  Transporteur,
  CategorieExpedition,
  Langue,
  Utilisateur,
} from '../types'
import { TRANSPORTEURS } from '../utils/trackingUrl'
import { LANGUES } from '../utils/langues'
import { drapeauPays } from '../utils/pays'
import { sortirContenu, ajusterContenu } from '../utils/consommerExpedition'
import { PRODUIT_ATELIER_LABEL, sousEnsemblesParProduit } from '../utils/produitsAtelier'
import { numerosSerieExpedition, prochainNumeroSerie } from '../utils/numerosSerie'
import SelecteurProduits from './SelecteurProduits'
import { CATEGORIE_LABEL, CATEGORIE_BADGE, CATEGORIES_TOUTES } from '../utils/categoriesExpedition'


const VERSIONS_CODE = ['v1', 'v2', 'v3', 'v4', 'v5']

type Props = {
  mode: 'creer' | 'finaliser' | 'modifier'
  expedition: Expedition | null
  clients: Client[]
  sousEnsembles: SousEnsemble[]
  expeditionsExistantes: Expedition[]
  utilisateur: Utilisateur
  onClose: () => void
  onSaved: () => void
}

function adresseComplete(c: { adresse?: string | null; code_postal?: string | null; ville?: string | null } | null | undefined): string {
  if (!c) return ''
  return [c.adresse, c.code_postal, c.ville].filter((v) => v && v.trim()).join('\n')
}

/** Nombre de bouées complètes dans le colis : autant de numéros de série. */
function nombreBouees(items: ExpeditionItem[], sousEnsembles: SousEnsemble[]): number {
  const bouee = sousEnsemblesParProduit(sousEnsembles).get('bouee_complete')
  if (!bouee) return 0
  return items.filter((i) => i.sous_ensemble_id === bouee.id).reduce((s, i) => s + i.quantite, 0)
}

export default function ModalExpedition({
  mode,
  expedition,
  clients,
  sousEnsembles,
  expeditionsExistantes,
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

  // Choix exclusif : rechercher un client existant OU saisir manuellement
  const [modeSaisieClient, setModeSaisieClient] = useState<'recherche' | 'manuel'>(
    expedition?.client_id ? 'recherche' : 'manuel'
  )

  const [rechercheClient, setRechercheClient] = useState(
    expedition?.clients ? `${expedition.clients.prenom} ${expedition.clients.nom}` : ''
  )
  const [dropdownClientOuvert, setDropdownClientOuvert] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)


  const [versionCode, setVersionCode] = useState(expedition?.version_code ?? '')
  const [categorie, setCategorie] = useState<CategorieExpedition | ''>(expedition?.categorie ?? '')
  const [commentaire, setCommentaire] = useState(expedition?.commentaire ?? '')
  const [transporteur, setTransporteur] = useState<Transporteur | ''>(expedition?.transporteur ?? '')
  const [numeroSuivi, setNumeroSuivi] = useState(expedition?.numero_suivi ?? '')

  // Produits sortis de l'atelier. Une vente saisie avant l'apparition de ce
  // choix arrive sans contenu : on propose une bouée complète par défaut.
  const [items, setItems] = useState<ExpeditionItem[]>(() => {
    if (expedition?.items?.length) return expedition.items
    const bouee = sousEnsemblesParProduit(sousEnsembles).get('bouee_complete')
    if (mode === 'finaliser' && expedition?.categorie === 'vente' && bouee) {
      return [{ sous_ensemble_id: bouee.id, piece_id: null, nom: PRODUIT_ATELIER_LABEL.bouee_complete, quantite: 1 }]
    }
    return []
  })

  // Un numéro de série par bouée. À la finalisation on pré-remplit avec les
  // prochains numéros libres ; ils restent modifiables, et la génération côté
  // base ne sert plus que de filet.
  // Les numéros ne sont proposés d'office qu'à la finalisation, ou sur une
  // expédition qui en a déjà : sur une commande encore à expédier, les champs
  // s'ouvrent vides pour ne pas consommer des numéros sans le vouloir.
  const numerotationAutomatique = mode === 'finaliser' || numerosSerieExpedition(expedition ?? {}).length > 0

  const [numerosSerie, setNumerosSerie] = useState<string[]>(() => {
    const existants = numerosSerieExpedition(expedition ?? {})
    if (existants.length > 0) return existants
    if (mode === 'creer') return []
    const nb = nombreBouees(items, sousEnsembles)
    if (mode === 'modifier') return Array.from({ length: nb }, () => '')
    return Array.from({ length: Math.max(1, nb) }, (_, i) => prochainNumeroSerie(expeditionsExistantes, i + 1))
  })

  // Nombre de champs déjà ouverts automatiquement : on ne complète que ce qui
  // manque, et un champ retiré à la main ne revient pas.
  const champsOuverts = useRef(numerosSerie.length)

  // Un colis de deux bouées ouvre deux champs, aussi bien à la finalisation
  // qu'en modification d'une expédition existante.
  useEffect(() => {
    if (mode === 'creer') return
    const nb = nombreBouees(items, sousEnsembles)
    if (nb <= champsOuverts.current) return
    const manquants = nb - champsOuverts.current
    champsOuverts.current = nb
    setNumerosSerie((prev) => [
      ...prev,
      ...Array.from({ length: manquants }, (_, i) =>
        numerotationAutomatique ? prochainNumeroSerie(expeditionsExistantes, i + 1, prev) : ''
      ),
    ])
  }, [items, sousEnsembles, mode, numerotationAutomatique, expeditionsExistantes])
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
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const clientsFiltres = useMemo(() => {
    if (!rechercheClient.trim()) return clients.slice(0, 8)
    const q = rechercheClient.toLowerCase()
    return clients.filter((c) => `${c.prenom} ${c.nom}`.toLowerCase().includes(q)).slice(0, 8)
  }, [clients, rechercheClient])


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

  const categorieEffective: CategorieExpedition | null = expedition?.categorie ?? (categorie || null)

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim() || !prenom.trim()) { setErreur('Nom et prénom du destinataire requis'); return }
    if (mode === 'finaliser' && !categorieEffective) { setErreur('Veuillez choisir un type de commande'); return }
    if (mode === 'finaliser' && items.length === 0) { setErreur("Choisissez au moins un produit sorti de l'atelier"); return }

    // Numéros vides ignorés, doublons écartés.
    const numerosSerieSaisis = [...new Set(numerosSerie.map((n) => n.trim()).filter(Boolean))]

    setEnvoi(true)
    setErreur(null)
    try {
      // Upsert / création du client si nécessaire
      let clientId = modeSaisieClient === 'recherche' ? clientIdSelectionne : null
      if (!clientId) {
        const { data: nouveauClient, error: errClient } = await supabase
          .from('clients')
          .insert({
            nom: nom.trim(),
            prenom: prenom.trim(),
            langue: langue || null,
            adresse: adresse.trim() || null,
            ville: null,
            code_postal: null,
            pays: pays.trim() || null,
          })
          .select('id')
          .single()
        if (errClient) throw errClient
        clientId = nouveauClient?.id ?? null
      } else {
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
        // Expédition déjà partie : le stock a été décompté sur l'ancien contenu,
        // on ne répercute que la différence.
        if (expedition.statut !== 'a_expedier') {
          await ajusterContenu(expedition.items ?? [], items, utilisateur.id, `Modification expédition — ${prenom.trim()} ${nom.trim()}`)
        }

        const { error } = await supabase
          .from('expeditions')
          .update({
            ...champsCommuns,
            items,
            ...(isAdmin ? { numeros_serie: numerosSerieSaisis, numero_serie: numerosSerieSaisis[0] ?? null } : {}),
          })
          .eq('id', expedition.id)
        if (error) throw error
      } else if (expedition) {
        await sortirContenu(items, utilisateur.id, `Expédition — ${prenom.trim()} ${nom.trim()}`)

        // Génération automatique si aucun numéro n'a été saisi à la finalisation.
        let numerosFinaux = numerosSerieSaisis.length > 0
          ? numerosSerieSaisis
          : numerosSerieExpedition(expedition)
        if (numerosFinaux.length === 0) {
          const { data: serieData, error: errSerie } = await supabase.rpc('generate_numero_serie')
          if (errSerie) throw errSerie
          numerosFinaux = [serieData as string]
        }

        const { error } = await supabase
          .from('expeditions')
          .update({
            ...champsCommuns,
            statut: 'envoye',
            items,
            numeros_serie: numerosFinaux,
            numero_serie: numerosFinaux[0] ?? null,
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
          {/* Choix exclusif : client existant OU saisie manuelle — non pertinent à la finalisation */}
          {!verrouilleALaFinalisation && (
          <div className="grid grid-cols-2 gap-2 p-1 bg-primary-50 rounded-xl">
            <button
              type="button"
              onClick={() => setModeSaisieClient('recherche')}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                modeSaisieClient === 'recherche' ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'
              }`}
            >
              <UserSearch size={14} /> Client existant
            </button>
            <button
              type="button"
              onClick={() => {
                setModeSaisieClient('manuel')
                setClientIdSelectionne(null)
                setRechercheClient('')
                setDropdownClientOuvert(false)
              }}
              className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors ${
                modeSaisieClient === 'manuel' ? 'bg-white text-primary-900 shadow-sm' : 'text-primary-500 hover:text-primary-700'
              }`}
            >
              <UserPlus2 size={14} /> Nouveau client
            </button>
          </div>
          )}

          {/* Recherche client existant */}
          {!verrouilleALaFinalisation && modeSaisieClient === 'recherche' && (
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
              
              className={`w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none ${champDesactiveClass}`}
            />
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
                Type de commande
              </label>
              {/* Renseigné dans la page Ventes : on l'affiche tel quel. Le choix
                  reste ouvert pour les lignes anciennes ou venues de Stripe. */}
              {expedition?.categorie ? (
                <div className="w-full border border-primary-200 rounded-xl px-3 py-2.5 bg-primary-50">
                  <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-lg ${CATEGORIE_BADGE[expedition.categorie]}`}>
                    {CATEGORIE_LABEL[expedition.categorie]}
                  </span>
                </div>
              ) : (
                <select
                  value={categorie}
                  onChange={(e) => setCategorie(e.target.value as CategorieExpedition | '')}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
                >
                  <option value="">—</option>
                  {CATEGORIES_TOUTES.map((c) => (
                    <option key={c} value={c}>{CATEGORIE_LABEL[c]}</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* Produits sortis de l'atelier : leurs composants sont décomptés à la validation */}
          <div className="bg-primary-50/80 border border-primary-100 rounded-2xl p-3.5">
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Contenu du colis{mode === 'finaliser' ? ' *' : ''}{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(plusieurs choix possibles)</span>
            </label>
            <SelecteurProduits sousEnsembles={sousEnsembles} items={items} onChange={setItems} />
            <p className="text-[11px] text-primary-500 mt-2">
              {mode === 'creer' || expedition?.statut === 'a_expedier'
                ? "Les composants de chaque produit seront décomptés du stock à la validation de l'expédition."
                : 'Expédition déjà partie : toute modification du contenu est répercutée sur le stock des composants.'}
            </p>
          </div>

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
              disabled={champVerrouille(expedition?.commentaire)}
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
                N° de série{numerosSerie.length > 1 ? 's' : ''}{' '}
                <span className="text-primary-400 font-normal normal-case tracking-normal">
                  (un par bouée{mode === 'finaliser' ? ', laisser vide pour génération automatique' : ''})
                </span>
              </label>
              <div className="space-y-2">
                {numerosSerie.map((numero, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={numero}
                      onChange={(e) => setNumerosSerie((prev) => prev.map((v, j) => (j === i ? e.target.value : v)))}
                      placeholder="Généré automatiquement si vide"
                      className="flex-1 border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                    />
                    {numerosSerie.length > 1 && (
                      <button
                        type="button"
                        title="Retirer ce numéro"
                        onClick={() => setNumerosSerie((prev) => prev.filter((_, j) => j !== i))}
                        className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-400 hover:bg-danger-100 hover:text-danger-600 transition-colors flex-shrink-0"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={() => setNumerosSerie((prev) => [...prev, prochainNumeroSerie(expeditionsExistantes, 1, prev)])}
                className="mt-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-500 hover:text-primary-900 transition-colors"
              >
                <PlusIcon size={12} /> Ajouter un numéro
              </button>
            </div>
          ) : numerosSerieExpedition(expedition ?? {}).length > 0 ? (
            <p className="text-xs text-primary-500">
              N° de série : <span className="font-bold text-primary-800">{numerosSerieExpedition(expedition ?? {}).join(', ')}</span>
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
              disabled={envoi || !nom.trim() || !prenom.trim()}
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

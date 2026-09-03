import { useState, useRef, useEffect, useMemo } from 'react'
import { X, ShoppingBag, Search, UserSearch, UserPlus2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { LANGUES } from '../utils/langues'
import { CATEGORIES_VENTE, CATEGORIE_LABEL } from '../utils/categoriesExpedition'
import { ORIGINES_VENTE, ORIGINE_VENTE_LABEL } from '../utils/originesVente'
import { Client, Expedition, CategorieExpedition, OrigineVente, Langue, Utilisateur } from '../types'

type Props = {
  mode: 'creer' | 'modifier'
  vente?: Expedition | null
  clients: Client[]
  utilisateur: Utilisateur
  onClose: () => void
  onSaved: () => void
}

// yyyy-mm-dd, tel qu'attendu par <input type="date">
function versInputDate(iso: string | null | undefined): string {
  if (!iso) return new Date().toISOString().slice(0, 10)
  return new Date(iso).toISOString().slice(0, 10)
}

export default function ModalVente({ mode, vente, clients, utilisateur, onClose, onSaved }: Props) {
  const [modeSaisieClient, setModeSaisieClient] = useState<'recherche' | 'manuel'>('recherche')
  const [clientIdSelectionne, setClientIdSelectionne] = useState<string | null>(vente?.client_id ?? null)
  const [rechercheClient, setRechercheClient] = useState('')
  const [dropdownClientOuvert, setDropdownClientOuvert] = useState(false)
  const clientDropdownRef = useRef<HTMLDivElement>(null)

  const [dateCommande, setDateCommande] = useState(versInputDate(vente?.date_commande))
  const [dateEnvoiPrevisionnelle, setDateEnvoiPrevisionnelle] = useState(
    vente?.date_envoi_previsionnelle ? vente.date_envoi_previsionnelle.slice(0, 10) : ""
  )
  const [nom, setNom] = useState(vente?.nom_destinataire ?? '')
  const [prenom, setPrenom] = useState(vente?.prenom_destinataire ?? '')
  const [adresse, setAdresse] = useState(vente?.adresse ?? '')
  const [langue, setLangue] = useState<Langue | ''>(vente?.langue ?? '')
  const [categorie, setCategorie] = useState<CategorieExpedition | ''>(vente?.categorie ?? '')
  const [montantPaye, setMontantPaye] = useState(vente?.montant_paye != null ? String(vente.montant_paye) : '')
  const [originesVente, setOriginesVente] = useState<OrigineVente[]>(
    vente?.origines_vente ?? (vente?.origine_vente ? [vente.origine_vente] : [])
  )
  const [commentaireOrigine, setCommentaireOrigine] = useState(vente?.commentaire_origine ?? '')
  const [typeBateau, setTypeBateau] = useState(vente?.type_bateau ?? '')

  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  // Fermeture du menu déroulant client au clic à l'extérieur
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(e.target as Node)) {
        setDropdownClientOuvert(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const clientsFiltres = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase()
    if (!q) return clients.slice(0, 8)
    return clients
      .filter((c) => `${c.prenom} ${c.nom}`.toLowerCase().includes(q))
      .slice(0, 8)
  }, [clients, rechercheClient])

  function selectionnerClient(c: Client) {
    setClientIdSelectionne(c.id)
    setRechercheClient(`${c.prenom} ${c.nom}`)
    setDropdownClientOuvert(false)
    setNom(c.nom)
    setPrenom(c.prenom)
    setAdresse(c.adresse ?? '')
    setLangue(c.langue ?? '')
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!nom.trim() || !prenom.trim()) { setErreur('Nom et prénom du client requis'); return }
    if (!categorie) { setErreur('Veuillez choisir un type de commande'); return }
    if (originesVente.length === 0) { setErreur("Veuillez choisir au moins une origine"); return }

    const montantValue = montantPaye.trim() ? Number(montantPaye.replace(',', '.')) : null
    if (montantValue !== null && !Number.isFinite(montantValue)) { setErreur('Montant payé invalide'); return }

    setEnvoi(true)
    setErreur(null)
    try {
      // Création ou mise à jour de la fiche client
      let clientId = modeSaisieClient === 'recherche' ? clientIdSelectionne : null
      if (!clientId) {
        const { data: nouveauClient, error: errClient } = await supabase
          .from('clients')
          .insert({
            nom: nom.trim(),
            prenom: prenom.trim(),
            langue: langue || null,
            adresse: adresse.trim() || null,
          })
          .select('id')
          .single()
        if (errClient) throw errClient
        clientId = nouveauClient?.id ?? null
      } else {
        const { error: errMaj } = await supabase
          .from('clients')
          .update({
            nom: nom.trim(),
            prenom: prenom.trim(),
            langue: langue || null,
            adresse: adresse.trim() || null,
          })
          .eq('id', clientId)
        if (errMaj) throw errMaj
      }

      const champs = {
        client_id: clientId,
        nom_destinataire: nom.trim(),
        prenom_destinataire: prenom.trim(),
        langue: langue || null,
        adresse: adresse.trim() || null,
        categorie,
        montant_paye: montantValue,
        origines_vente: originesVente,
        origine_vente: originesVente[0] ?? null,
        commentaire_origine: commentaireOrigine.trim() || null,
        type_bateau: typeBateau.trim() || null,
        date_commande: new Date(dateCommande).toISOString(),
        date_envoi_previsionnelle: dateEnvoiPrevisionnelle || null,
      }

      if (mode === 'creer') {
        const { error } = await supabase.from('expeditions').insert({
          ...champs,
          statut: 'a_expedier',
          origine: 'manuel',
          items: [],
          utilisateur_id: utilisateur.id,
        })
        if (error) throw error
      } else if (vente) {
        const { error } = await supabase
          .from('expeditions')
          .update(champs)
          .eq('id', vente.id)
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
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
              <ShoppingBag size={17} className="text-primary-700" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-primary-900 leading-tight">
                {mode === 'creer' ? 'Nouvelle vente' : 'Modifier la vente'}
              </h2>
              <p className="text-xs text-primary-500 mt-0.5">
                {mode === 'creer'
                  ? 'La vente rejoindra les expéditions à préparer'
                  : `${vente?.prenom_destinataire} ${vente?.nom_destinataire}`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            type="button"
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={soumettre} className="space-y-4">

          {/* Choix exclusif : client existant OU nouveau client */}
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

          {modeSaisieClient === 'recherche' && (
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
                      <span className="flex-1 text-sm font-medium text-primary-900">{c.prenom} {c.nom}</span>
                      <span className="text-xs text-primary-400 flex-shrink-0">{c.ville ?? ''}</span>
                    </button>
                  ))}
                </div>
              )}
              {clientIdSelectionne && (
                <p className="text-xs text-success-600 mt-1.5">
                  Client sélectionné — les informations ci-dessous ont été pré-remplies.
                </p>
              )}
            </div>
          )}

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
                Expédition prévue{' '}
                <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
              </label>
              <input
                type="date"
                value={dateEnvoiPrevisionnelle}
                onChange={(e) => setDateEnvoiPrevisionnelle(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>

          {/* Nom / prénom */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Prénom *
              </label>
              <input
                type="text"
                value={prenom}
                onChange={(e) => setPrenom(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Nom *
              </label>
              <input
                type="text"
                value={nom}
                onChange={(e) => setNom(e.target.value)}
                className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>
          </div>

          {/* Adresse */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Adresse
            </label>
            <textarea
              value={adresse}
              onChange={(e) => setAdresse(e.target.value)}
              rows={2}
              placeholder="Adresse complète du client…"
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>

          {/* Langue */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Langue
            </label>
            <select
              value={langue}
              onChange={(e) => setLangue(e.target.value as Langue | '')}
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
            >
              <option value="">—</option>
              {LANGUES.map((l) => (
                <option key={l.value} value={l.value}>{l.drapeau} {l.label}</option>
              ))}
            </select>
          </div>

          {/* Type de commande */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Type de commande *
            </label>
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES_VENTE.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategorie(c)}
                  className={`py-2 rounded-xl text-xs font-semibold transition-colors border ${
                    categorie === c
                      ? 'bg-primary-900 text-white border-primary-900'
                      : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
                  }`}
                >
                  {CATEGORIE_LABEL[c]}
                </button>
              ))}
            </div>
          </div>

          {/* Origines — plusieurs choix possibles */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Origine *{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">
                (plusieurs choix possibles)
              </span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {ORIGINES_VENTE.map((o) => {
                const active = originesVente.includes(o)
                return (
                  <button
                    key={o}
                    type="button"
                    onClick={() => setOriginesVente((prev) =>
                      prev.includes(o) ? prev.filter((x) => x !== o) : [...prev, o]
                    )}
                    className={`py-2 rounded-xl text-xs font-semibold transition-colors border ${
                      active
                        ? 'bg-primary-900 text-white border-primary-900'
                        : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
                    }`}
                  >
                    {ORIGINE_VENTE_LABEL[o]}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Commentaire sur l'origine */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Commentaire sur l'origine{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
            </label>
            <textarea
              value={commentaireOrigine}
              onChange={(e) => setCommentaireOrigine(e.target.value)}
              rows={2}
              placeholder="Ex : Nautic Paris 2026, recommandation d'un client…"
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 resize-none"
            />
          </div>

          {/* Type de bateau */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Type de bateau{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
            </label>
            <input
              type="text"
              value={typeBateau}
              onChange={(e) => setTypeBateau(e.target.value)}
              placeholder="Ex : Sun Odyssey 410"
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
            />
          </div>

          {/* Montant payé */}
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
              Montant payé HT{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(en euros)</span>
            </label>
            <input
              type="text"
              inputMode="decimal"
              value={montantPaye}
              onChange={(e) => setMontantPaye(e.target.value)}
              placeholder="Ex : 1290.00"
              className="w-full border border-primary-200 rounded-xl px-4 py-2.5 text-sm text-primary-900 placeholder-primary-400 tabular-nums focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
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
              {envoi ? 'Enregistrement…' : mode === 'creer' ? 'Enregistrer la vente' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

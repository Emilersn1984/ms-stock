import { useState, useRef, useEffect, useMemo } from 'react'
import { X, Wrench, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { TRANSPORTEURS } from '../utils/trackingUrl'
import { synchroniserRenvoiSav } from '../utils/expeditionSav'
import SelecteurProduits from './SelecteurProduits'
import {
  Client, ExpeditionItem, Sav, SousEnsemble, Transporteur, Utilisateur,
  CauseSav, ModeRecuperation,
} from '../types'

type Props = {
  mode: 'creer' | 'modifier'
  sav?: Sav | null
  clients: Client[]
  sousEnsembles: SousEnsemble[]
  utilisateur: Utilisateur
  onClose: () => void
  onSaved: () => void
}

const CAUSES: { value: CauseSav; label: string }[] = [
  { value: 'electronique', label: 'Électronique' },
  { value: 'mecanique', label: 'Mécanique' },
]

const MODES: { value: ModeRecuperation; label: string }[] = [
  { value: 'mains_propres', label: 'En mains propres' },
  { value: 'envoi', label: 'Envoi' },
]

function aujourdhui(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Déclaration d'une reprise de SAV sur un client existant. */
export default function ModalSav({ mode, sav, clients, sousEnsembles, utilisateur, onClose, onSaved }: Props) {
  const [clientId, setClientId] = useState<string | null>(sav?.client_id ?? null)
  const [rechercheClient, setRechercheClient] = useState(
    sav ? `${sav.prenom_client} ${sav.nom_client}` : ''
  )
  const [dropdownOuvert, setDropdownOuvert] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  const [dateSav, setDateSav] = useState(sav?.date_sav ?? aujourdhui())
  const [cause, setCause] = useState<CauseSav | ''>(sav?.cause ?? '')
  const [description, setDescription] = useState(sav?.description ?? '')
  const [remboursement, setRemboursement] = useState(sav?.remboursement_demande ?? false)
  const [modeRecuperation, setModeRecuperation] = useState<ModeRecuperation | ''>(sav?.mode_recuperation ?? '')
  const [materiel, setMateriel] = useState<ExpeditionItem[]>(sav?.materiel ?? [])
  const [transporteur, setTransporteur] = useState<Transporteur | ''>(sav?.transporteur ?? '')
  const [numeroSuivi, setNumeroSuivi] = useState(sav?.numero_suivi ?? '')
  const [dateRenvoi, setDateRenvoi] = useState(sav?.date_renvoi_prevue ?? '')

  const [envoi, setEnvoi] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  useEffect(() => {
    function clicExterieur(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) setDropdownOuvert(false)
    }
    document.addEventListener('mousedown', clicExterieur)
    return () => document.removeEventListener('mousedown', clicExterieur)
  }, [])

  const clientsFiltres = useMemo(() => {
    const q = rechercheClient.trim().toLowerCase()
    if (!q) return clients.slice(0, 8)
    return clients.filter((c) => `${c.prenom} ${c.nom}`.toLowerCase().includes(q)).slice(0, 8)
  }, [clients, rechercheClient])

  const client = useMemo(() => clients.find((c) => c.id === clientId) ?? null, [clients, clientId])

  function selectionnerClient(c: Client) {
    setClientId(c.id)
    setRechercheClient(`${c.prenom} ${c.nom}`)
    setDropdownOuvert(false)
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!client) { setErreur('Sélectionnez un client existant') ; return }
    if (!cause) { setErreur('Indiquez la cause du SAV') ; return }
    if (!modeRecuperation) { setErreur('Indiquez le moyen de récupération du matériel') ; return }
    if (materiel.length === 0) { setErreur('Indiquez le matériel concerné') ; return }

    setEnvoi(true)
    setErreur(null)
    try {
      const champs = {
        client_id: client.id,
        nom_client: client.nom,
        prenom_client: client.prenom,
        date_sav: dateSav,
        cause,
        description: description.trim() || null,
        remboursement_demande: remboursement,
        mode_recuperation: modeRecuperation,
        materiel,
        // Récupération chez le client : sans objet si remise en mains propres.
        transporteur: modeRecuperation === 'envoi' ? (transporteur || null) : null,
        numero_suivi: modeRecuperation === 'envoi' ? (numeroSuivi.trim() || null) : null,
        date_renvoi_prevue: dateRenvoi || null,
      }

      let savId = sav?.id ?? null
      if (mode === 'creer') {
        const { data, error } = await supabase.from('sav').insert(champs).select('id').single()
        if (error) throw error
        savId = data?.id ?? null
      } else if (savId) {
        const { error } = await supabase.from('sav').update(champs).eq('id', savId)
        if (error) throw error
      }

      // Le colis de renvoi rejoint la liste des produits à expédier.
      const expeditionId = await synchroniserRenvoiSav({
        expeditionId: sav?.expedition_id ?? null,
        client,
        nomClient: client.nom,
        prenomClient: client.prenom,
        dateSav,
        dateRenvoiPrevue: dateRenvoi || null,
        materiel,
        description: description.trim() || null,
        utilisateurId: utilisateur.id,
      })

      if (savId && expeditionId !== (sav?.expedition_id ?? null)) {
        await supabase.from('sav').update({ expedition_id: expeditionId }).eq('id', savId)
      }

      onSaved()
      onClose()
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : "Erreur lors de l'enregistrement")
    } finally {
      setEnvoi(false)
    }
  }

  const labelClass = 'block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5'
  const inputClass = 'w-full border border-primary-200 rounded-xl px-3 py-2.5 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400'

  function chip(actif: boolean): string {
    return `py-2 rounded-xl text-xs font-semibold transition-colors border ${
      actif ? 'bg-primary-900 text-white border-primary-900' : 'bg-white text-primary-600 border-primary-200 hover:bg-primary-50'
    }`
  }

  return (
    <div className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">

        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-danger-100 flex items-center justify-center flex-shrink-0">
              <Wrench size={17} className="text-danger-600" />
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-primary-900 leading-tight">
                {mode === 'creer' ? 'Nouveau SAV' : 'Modifier le SAV'}
              </h2>
              <p className="text-xs text-primary-500 mt-0.5">
                Le matériel repris n'est pas remis en stock
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

          <div ref={dropdownRef} className="relative">
            <label className={labelClass}>Client</label>
            <div className="relative">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
              <input
                type="text"
                value={rechercheClient}
                onChange={(e) => { setRechercheClient(e.target.value); setDropdownOuvert(true); setClientId(null) }}
                onFocus={() => setDropdownOuvert(true)}
                placeholder="Rechercher un client existant…"
                className={`${inputClass} pl-9`}
                autoComplete="off"
              />
            </div>
            {dropdownOuvert && clientsFiltres.length > 0 && (
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
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date du SAV</label>
              <input type="date" value={dateSav} onChange={(e) => setDateSav(e.target.value)} className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Cause</label>
              <div className="grid grid-cols-2 gap-2">
                {CAUSES.map((c) => (
                  <button key={c.value} type="button" onClick={() => setCause(c.value)} className={chip(cause === c.value)}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className={labelClass}>Description du problème</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Ex : plus de réveil au mouillage après une nuit"
              className={`${inputClass} resize-none`}
            />
          </div>

          <div className="bg-primary-50/80 border border-primary-100 rounded-2xl p-3.5">
            <label className={labelClass}>
              Matériel concerné{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(plusieurs choix possibles)</span>
            </label>
            <SelecteurProduits sousEnsembles={sousEnsembles} items={materiel} onChange={setMateriel} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Remboursement demandé</label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => setRemboursement(true)} className={chip(remboursement)}>Oui</button>
                <button type="button" onClick={() => setRemboursement(false)} className={chip(!remboursement)}>Non</button>
              </div>
            </div>
            <div>
              <label className={labelClass}>Récupération du matériel</label>
              <div className="grid grid-cols-2 gap-2">
                {MODES.map((m) => (
                  <button key={m.value} type="button" onClick={() => setModeRecuperation(m.value)} className={chip(modeRecuperation === m.value)}>
                    {m.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {modeRecuperation === 'envoi' && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelClass}>Transporteur</label>
                <select
                  value={transporteur}
                  onChange={(e) => setTransporteur(e.target.value as Transporteur | '')}
                  className={`${inputClass} bg-white`}
                >
                  <option value="">—</option>
                  {TRANSPORTEURS.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className={labelClass}>Numéro de suivi</label>
                <input
                  type="text"
                  value={numeroSuivi}
                  onChange={(e) => setNumeroSuivi(e.target.value)}
                  placeholder="Ex : 6A12345678901"
                  className={inputClass}
                />
              </div>
            </div>
          )}

          <div>
            <label className={labelClass}>
              Renvoi prévu au client{' '}
              <span className="text-primary-400 font-normal normal-case tracking-normal">(facultatif)</span>
            </label>
            <input type="date" value={dateRenvoi} onChange={(e) => setDateRenvoi(e.target.value)} className={inputClass} />
            <p className="text-[11px] text-primary-500 mt-1.5">
              Avec une date, le matériel concerné rejoint les produits à expédier à cette date.
              Sans date, aucun colis n'est créé.
            </p>
          </div>

          {erreur && <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm">{erreur}</p>}

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
              {envoi ? 'Enregistrement…' : mode === 'creer' ? 'Enregistrer le SAV' : 'Enregistrer'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

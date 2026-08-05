import { useMemo, useState } from 'react'
import { Users, X, Plus, Pencil, Trash2, Search, ArrowLeft } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Client, Langue } from '../types'
import { LANGUES } from '../utils/langues'
import { PAYS } from '../utils/pays'
import ConfirmDialog from './ConfirmDialog'

type Props = {
  clients: Client[]
  onClose: () => void
  onSaved: () => void
}

type FormState = {
  nom: string
  prenom: string
  langue: Langue | ''
  adresse: string
  code_postal: string
  ville: string
  pays: string
  email: string
  telephone: string
}

const FORM_VIDE: FormState = {
  nom: '',
  prenom: '',
  langue: '',
  adresse: '',
  code_postal: '',
  ville: '',
  pays: '',
  email: '',
  telephone: '',
}

export default function ModalClients({ clients, onClose, onSaved }: Props) {
  const [vue, setVue] = useState<'liste' | 'form'>('liste')
  const [clientEnEdition, setClientEnEdition] = useState<Client | null>(null)
  const [form, setForm] = useState<FormState>(FORM_VIDE)
  const [recherche, setRecherche] = useState('')
  const [enregistrement, setEnregistrement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)
  const [clientASupprimer, setClientASupprimer] = useState<Client | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)

  const clientsFiltres = useMemo(() => {
    const q = recherche.trim().toLowerCase()
    const tries = [...clients].sort((a, b) => a.nom.localeCompare(b.nom))
    if (!q) return tries
    return tries.filter((c) =>
      `${c.prenom} ${c.nom} ${c.email ?? ''} ${c.ville ?? ''}`.toLowerCase().includes(q)
    )
  }, [clients, recherche])

  function ouvrirAjout() {
    setClientEnEdition(null)
    setForm(FORM_VIDE)
    setErreur(null)
    setVue('form')
  }

  function ouvrirModification(c: Client) {
    setClientEnEdition(c)
    setForm({
      nom: c.nom ?? '',
      prenom: c.prenom ?? '',
      langue: c.langue ?? '',
      adresse: c.adresse ?? '',
      code_postal: c.code_postal ?? '',
      ville: c.ville ?? '',
      pays: c.pays ?? '',
      email: c.email ?? '',
      telephone: c.telephone ?? '',
    })
    setErreur(null)
    setVue('form')
  }

  function retourListe() {
    setVue('liste')
    setClientEnEdition(null)
  }

  async function soumettre(e: React.FormEvent) {
    e.preventDefault()
    if (!form.nom.trim() || !form.prenom.trim()) {
      setErreur('Nom et prénom requis')
      return
    }
    setEnregistrement(true)
    setErreur(null)
    try {
      const payload = {
        nom: form.nom.trim(),
        prenom: form.prenom.trim(),
        langue: form.langue || null,
        adresse: form.adresse.trim() || null,
        code_postal: form.code_postal.trim() || null,
        ville: form.ville.trim() || null,
        pays: form.pays.trim() || null,
        email: form.email.trim() || null,
        telephone: form.telephone.trim() || null,
      }
      if (clientEnEdition) {
        const { error } = await supabase.from('clients').update(payload).eq('id', clientEnEdition.id)
        if (error) throw error
      } else {
        const { error } = await supabase.from('clients').insert(payload)
        if (error) throw error
      }
      onSaved()
      retourListe()
    } catch (err: unknown) {
      setErreur(err instanceof Error ? err.message : "Erreur lors de l'enregistrement")
    } finally {
      setEnregistrement(false)
    }
  }

  async function confirmerSuppression() {
    if (!clientASupprimer) return
    setSuppressionEnCours(true)
    try {
      const { error } = await supabase.from('clients').delete().eq('id', clientASupprimer.id)
      if (error) throw error
      onSaved()
    } finally {
      setSuppressionEnCours(false)
      setClientASupprimer(null)
    }
  }

  return (
    <div className="fixed inset-0 bg-primary-900/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col">
        {/* En-tête */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-primary-100 flex-shrink-0">
          <div className="flex items-center gap-3">
            {vue === 'form' ? (
              <button
                type="button"
                onClick={retourListe}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-primary-500 hover:bg-primary-100 hover:text-primary-900 transition-colors"
              >
                <ArrowLeft size={16} />
              </button>
            ) : (
              <div className="w-9 h-9 rounded-xl bg-primary-100 flex items-center justify-center flex-shrink-0">
                <Users size={17} className="text-primary-700" />
              </div>
            )}
            <h2 className="text-base font-bold text-primary-900 leading-tight">
              {vue === 'liste' ? 'Clients' : clientEnEdition ? 'Modifier le client' : 'Ajouter un client'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-lg text-primary-300 hover:text-primary-700 transition-colors"
          >
            <X size={15} />
          </button>
        </div>

        {vue === 'liste' ? (
          <>
            <div className="px-6 pt-4 flex items-center gap-3 flex-shrink-0">
              <div className="relative flex-1">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400 pointer-events-none" />
                <input
                  type="text"
                  value={recherche}
                  onChange={(e) => setRecherche(e.target.value)}
                  placeholder="Rechercher un client…"
                  className="w-full pl-8 pr-3 py-2 border border-primary-200 rounded-xl text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
              </div>
              <button
                type="button"
                onClick={ouvrirAjout}
                className="flex items-center gap-2 px-3.5 py-2 bg-primary-900 hover:bg-primary-800 active:bg-primary-700 text-white text-sm font-semibold rounded-xl transition-colors flex-shrink-0"
              >
                <Plus size={14} />
                <span className="hidden sm:inline">Ajouter</span>
              </button>
            </div>

            <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
              {clientsFiltres.length === 0 ? (
                <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200">
                  Aucun client trouvé
                </p>
              ) : (
                <div className="space-y-1.5">
                  {clientsFiltres.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 rounded-xl border border-primary-100 hover:border-primary-300 transition-colors px-3.5 py-2.5"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-primary-900 truncate">
                          {c.prenom} {c.nom}
                        </p>
                        <p className="text-xs text-primary-500 truncate">
                          {[c.email, c.ville].filter(Boolean).join(' · ') || '—'}
                        </p>
                      </div>
                      <button
                        type="button"
                        title="Modifier"
                        onClick={() => ouvrirModification(c)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-primary-400 hover:bg-primary-100 hover:text-primary-700 transition-colors flex-shrink-0"
                      >
                        <Pencil size={13} />
                      </button>
                      <button
                        type="button"
                        title="Supprimer"
                        onClick={() => setClientASupprimer(c)}
                        className="w-7 h-7 flex items-center justify-center rounded-lg text-primary-400 hover:bg-danger-100 hover:text-danger-600 transition-colors flex-shrink-0"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        ) : (
          <form onSubmit={soumettre} className="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Prénom
                </label>
                <input
                  type="text"
                  value={form.prenom}
                  onChange={(e) => setForm((f) => ({ ...f, prenom: e.target.value }))}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  required
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Nom
                </label>
                <input
                  type="text"
                  value={form.nom}
                  onChange={(e) => setForm((f) => ({ ...f, nom: e.target.value }))}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Téléphone
                </label>
                <input
                  type="tel"
                  value={form.telephone}
                  onChange={(e) => setForm((f) => ({ ...f, telephone: e.target.value }))}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Adresse
              </label>
              <input
                type="text"
                value={form.adresse}
                onChange={(e) => setForm((f) => ({ ...f, adresse: e.target.value }))}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Code postal
                </label>
                <input
                  type="text"
                  value={form.code_postal}
                  onChange={(e) => setForm((f) => ({ ...f, code_postal: e.target.value }))}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Ville
                </label>
                <input
                  type="text"
                  value={form.ville}
                  onChange={(e) => setForm((f) => ({ ...f, ville: e.target.value }))}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                  Pays
                </label>
                <select
                  value={form.pays}
                  onChange={(e) => setForm((f) => ({ ...f, pays: e.target.value }))}
                  className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
                >
                  <option value="">—</option>
                  {PAYS.map((p) => (
                    <option key={p.code} value={p.code}>{p.nom}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase tracking-[0.15em] text-primary-600 mb-1.5">
                Langue
              </label>
              <select
                value={form.langue}
                onChange={(e) => setForm((f) => ({ ...f, langue: e.target.value as Langue | '' }))}
                className="w-full border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400 bg-white"
              >
                <option value="">—</option>
                {LANGUES.map((l) => (
                  <option key={l.value} value={l.value}>{l.drapeau} {l.label}</option>
                ))}
              </select>
            </div>

            {erreur && (
              <p className="text-sm text-danger-600 bg-danger-50 border border-danger-200 rounded-xl px-3 py-2">
                {erreur}
              </p>
            )}

            <div className="flex gap-3 pt-2 mt-auto">
              <button
                type="button"
                onClick={retourListe}
                className="flex-1 py-2.5 border border-primary-200 text-primary-700 text-sm font-medium rounded-xl hover:bg-primary-50 transition-colors"
              >
                Annuler
              </button>
              <button
                type="submit"
                disabled={enregistrement}
                className="flex-1 py-2.5 bg-primary-900 hover:bg-primary-800 active:bg-primary-700 disabled:opacity-60 text-white text-sm font-semibold rounded-xl transition-colors"
              >
                {enregistrement ? 'Enregistrement…' : clientEnEdition ? 'Enregistrer' : 'Ajouter'}
              </button>
            </div>
          </form>
        )}
      </div>

      {clientASupprimer && (
        <ConfirmDialog
          titre="Supprimer le client"
          message={`Voulez-vous vraiment supprimer ${clientASupprimer.prenom} ${clientASupprimer.nom} ?`}
          onCancel={() => !suppressionEnCours && setClientASupprimer(null)}
          onConfirm={confirmerSuppression}
        />
      )}
    </div>
  )
}

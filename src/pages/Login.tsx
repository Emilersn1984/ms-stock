import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Briefcase, Wrench, User, Plus, X, Lock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { Utilisateur, Role } from '../types'
import { useUtilisateur } from '../hooks/useUtilisateur'
import type { LucideIcon } from 'lucide-react'

const ROLES: { value: Role; label: string; icon: LucideIcon }[] = [
  { value: 'patron', label: 'Admin', icon: Briefcase },
  { value: 'ouvrier', label: 'Ouvrier', icon: Wrench },
  { value: 'autre', label: 'Autre', icon: User },
]

const MOT_DE_PASSE_ADMIN = 'admin'

export default function Login() {
  const navigate = useNavigate()
  const { connecter } = useUtilisateur()

  const [roleSelectionne, setRoleSelectionne] = useState<Role | null>(null)
  const [utilisateurs, setUtilisateurs] = useState<Utilisateur[]>([])
  const [chargement, setChargement] = useState(false)
  const [erreur, setErreur] = useState<string | null>(null)

  const [showAjouter, setShowAjouter] = useState(false)
  const [prenom, setPrenom] = useState('')
  const [nom, setNom] = useState('')
  const [ajoutEnCours, setAjoutEnCours] = useState(false)
  const [erreurAjout, setErreurAjout] = useState<string | null>(null)
  const [confirmSupprId, setConfirmSupprId] = useState<string | null>(null)
  const [suppressionEnCours, setSuppressionEnCours] = useState(false)

  const [adminDeverrouille, setAdminDeverrouille] = useState(false)
  const [motDePasse, setMotDePasse] = useState('')
  const [erreurMdp, setErreurMdp] = useState<string | null>(null)

  useEffect(() => {
    setAdminDeverrouille(false)
    setMotDePasse('')
    setErreurMdp(null)
  }, [roleSelectionne])

  useEffect(() => {
    if (!roleSelectionne) {
      setUtilisateurs([])
      return
    }

    if (roleSelectionne === 'patron' && !adminDeverrouille) {
      setUtilisateurs([])
      return
    }

    setChargement(true)
    setErreur(null)
    setShowAjouter(false)
    setPrenom('')
    setNom('')
    setErreurAjout(null)

    supabase
      .from('utilisateurs')
      .select('*')
      .eq('role', roleSelectionne)
      .order('nom')
      .then(({ data, error }) => {
        if (error) {
          setErreur('Erreur de connexion à la base de données.')
        } else {
          setUtilisateurs(data ?? [])
        }
        setChargement(false)
      })
  }, [roleSelectionne, adminDeverrouille])

  function verifierMotDePasse() {
    if (motDePasse === MOT_DE_PASSE_ADMIN) {
      setAdminDeverrouille(true)
      setErreurMdp(null)
    } else {
      setErreurMdp('Mot de passe incorrect.')
    }
  }

  function handleSelectUser(user: Utilisateur) {
    connecter(user)
    navigate('/dashboard')
  }

  async function supprimerMembre(id: string) {
    setSuppressionEnCours(true)
    await supabase.from('utilisateurs').delete().eq('id', id)
    setUtilisateurs((prev) => prev.filter((u) => u.id !== id))
    setConfirmSupprId(null)
    setSuppressionEnCours(false)
  }

  async function ajouterMembre() {
    if (!prenom.trim() || !nom.trim() || !roleSelectionne) return
    setAjoutEnCours(true)
    setErreurAjout(null)
    const { data, error } = await supabase
      .from('utilisateurs')
      .insert({ prenom: prenom.trim(), nom: nom.trim(), role: roleSelectionne })
      .select()
      .single()
    if (error) {
      setErreurAjout('Erreur lors de l\'ajout.')
      setAjoutEnCours(false)
      return
    }
    setUtilisateurs((prev) => [...prev, data as Utilisateur].sort((a, b) => a.nom.localeCompare(b.nom, 'fr')))
    setPrenom('')
    setNom('')
    setShowAjouter(false)
    setAjoutEnCours(false)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center px-4 py-10" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className="w-full max-w-sm">

        {/* Brand */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-primary-900 tracking-tight leading-none">MS Stock</h1>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-500 mt-2">
            Mooring Solution — Gestion des stocks
          </p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-2xl border border-primary-100 p-6">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600 mb-4">
            Qui êtes-vous ?
          </p>

          {/* Sélection du rôle */}
          <div className="grid grid-cols-3 gap-2.5 mb-6">
            {ROLES.map((r) => {
              const isActive = roleSelectionne === r.value
              return (
                <button
                  key={r.value}
                  onClick={() => setRoleSelectionne(r.value)}
                  className={`flex flex-col items-center justify-center py-4 rounded-xl border-2 transition-all ${
                    isActive
                      ? 'border-primary-900 bg-primary-900 text-white'
                      : 'border-primary-100 bg-white text-primary-600 hover:border-primary-200 hover:bg-primary-50'
                  }`}
                >
                  <r.icon size={20} className="mb-1.5" />
                  <span className="text-xs font-semibold">{r.label}</span>
                </button>
              )
            })}
          </div>

          {roleSelectionne && (
            <div>
              <div className="flex items-center gap-3 mb-3">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-700 whitespace-nowrap">
                  Sélectionner votre nom
                </span>
                <div className="flex-1 h-px bg-primary-100" />
              </div>

              {roleSelectionne === 'patron' && !adminDeverrouille ? (
                <div className="space-y-3">
                  <p className="text-sm text-primary-600">
                    Entrez le mot de passe administrateur pour continuer.
                  </p>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-primary-400" />
                    <input
                      type="password"
                      value={motDePasse}
                      onChange={(e) => setMotDePasse(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && verifierMotDePasse()}
                      placeholder="Mot de passe"
                      autoFocus
                      className="w-full border border-primary-200 rounded-xl pl-9 pr-3 py-2 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                    />
                  </div>
                  {erreurMdp && (
                    <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-xs">{erreurMdp}</p>
                  )}
                  <button
                    onClick={verifierMotDePasse}
                    className="w-full bg-primary-900 hover:bg-primary-800 text-white rounded-xl py-2 text-sm font-semibold transition-colors"
                  >
                    Déverrouiller
                  </button>
                </div>
              ) : (
                <>
              {chargement && (
                <div className="flex items-center justify-center py-6">
                  <p className="text-sm text-primary-400">Chargement…</p>
                </div>
              )}

              {erreur && (
                <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-sm mb-3">{erreur}</p>
              )}

              {!chargement && !erreur && utilisateurs.length === 0 && (
                <p className="text-sm text-primary-600 italic py-2 pl-3 border-l-2 border-primary-200 mb-3">
                  Aucun utilisateur dans ce rôle.
                </p>
              )}

              <div className="space-y-1.5">
                {utilisateurs.map((user) => (
                  <div key={user.id} className="flex rounded-xl overflow-hidden border border-primary-100">
                    <button
                      onClick={() => handleSelectUser(user)}
                      className="flex-1 text-left px-3.5 py-2.5 hover:bg-primary-50 transition-colors flex items-center gap-3 min-w-0"
                    >
                      <div className="w-8 h-8 rounded-xl bg-primary-100 text-primary-700 flex items-center justify-center font-bold text-xs flex-shrink-0">
                        {user.prenom[0]}{user.nom[0]}
                      </div>
                      <span className="text-sm font-medium text-primary-900 truncate">{user.prenom} {user.nom}</span>
                    </button>

                    {(roleSelectionne === 'patron' || roleSelectionne === 'ouvrier') && (
                      confirmSupprId === user.id ? (
                        <div className="flex items-center gap-1 px-2 flex-shrink-0 bg-white">
                          <button
                            onClick={() => supprimerMembre(user.id)}
                            disabled={suppressionEnCours}
                            className="text-xs bg-danger-500 hover:bg-danger-600 text-white px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {suppressionEnCours ? '…' : 'Oui'}
                          </button>
                          <button
                            onClick={() => setConfirmSupprId(null)}
                            className="text-xs text-primary-500 hover:text-primary-800 px-1.5 py-1.5 rounded-lg transition-colors"
                          >
                            Non
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmSupprId(user.id)}
                          className="flex-shrink-0 w-9 flex items-center justify-center bg-white text-primary-300 hover:text-danger-500 hover:bg-danger-100 transition-colors border-l border-primary-100"
                          title="Supprimer"
                        >
                          <X size={13} />
                        </button>
                      )
                    )}
                  </div>
                ))}
              </div>

              {(roleSelectionne === 'patron' || roleSelectionne === 'ouvrier') && (
                <div className="mt-4 pt-4 border-t border-primary-100">
                  {!showAjouter ? (
                    <button
                      onClick={() => setShowAjouter(true)}
                      className="w-full text-xs font-medium text-primary-400 hover:text-primary-900 transition-colors py-1.5 flex items-center justify-center gap-1.5"
                    >
                      <Plus size={13} />
                      Ajouter un membre
                    </button>
                  ) : (
                    <div className="space-y-3">
                      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary-600">
                        Nouveau membre
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={prenom}
                          onChange={(e) => setPrenom(e.target.value)}
                          placeholder="Prénom"
                          autoFocus
                          className="flex-1 border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                        />
                        <input
                          type="text"
                          value={nom}
                          onChange={(e) => setNom(e.target.value)}
                          placeholder="Nom"
                          onKeyDown={(e) => e.key === 'Enter' && ajouterMembre()}
                          className="flex-1 border border-primary-200 rounded-xl px-3 py-2 text-sm text-primary-900 placeholder-primary-400 focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
                        />
                      </div>
                      {erreurAjout && (
                        <p className="text-danger-600 bg-danger-100 rounded-xl p-3 text-xs">{erreurAjout}</p>
                      )}
                      <div className="flex gap-2">
                        <button
                          onClick={() => { setShowAjouter(false); setPrenom(''); setNom(''); setErreurAjout(null) }}
                          className="flex-1 border border-primary-200 text-primary-700 rounded-xl py-2 text-sm font-medium hover:bg-primary-50 transition-colors"
                        >
                          Annuler
                        </button>
                        <button
                          onClick={ajouterMembre}
                          disabled={!prenom.trim() || !nom.trim() || ajoutEnCours}
                          className="flex-1 bg-primary-900 hover:bg-primary-800 text-white rounded-xl py-2 text-sm font-semibold transition-colors disabled:opacity-40"
                        >
                          {ajoutEnCours ? 'Ajout…' : 'Ajouter'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

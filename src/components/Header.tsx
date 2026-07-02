import { useNavigate, Link } from 'react-router-dom'
import { Utilisateur } from '../types'

type Props = {
  utilisateur: Utilisateur
  onDeconnecter: () => void
}

export default function Header({ utilisateur, onDeconnecter }: Props) {
  const navigate = useNavigate()

  function handleDeconnecter() {
    onDeconnecter()
    navigate('/login')
  }

  return (
    <header className="bg-white border-b border-primary-100 px-4 py-3 flex items-center justify-between sticky top-0 z-10">
      <div className="flex items-center gap-3">
        <Link to="/dashboard" className="flex items-center gap-2 mr-2">
          <img
            src="/Logo-symbole-noir.svg"
            alt="Mooring Solution"
            className="h-7 w-auto"
          />
        </Link>
        <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
          {utilisateur.prenom[0]}{utilisateur.nom[0]}
        </div>
        <div className="leading-tight">
          <div className="text-sm font-semibold text-primary-900">
            {utilisateur.prenom} {utilisateur.nom}
          </div>
          <div className="text-xs text-primary-500 capitalize">
            {utilisateur.role === 'patron' ? 'Admin' : utilisateur.role}
          </div>
        </div>
      </div>

      <button
        onClick={handleDeconnecter}
        className="text-xs text-primary-500 hover:text-danger-500 transition-colors px-2 py-1 rounded"
      >
        Changer
      </button>
    </header>
  )
}

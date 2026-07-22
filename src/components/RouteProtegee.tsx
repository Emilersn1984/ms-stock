import { Navigate } from 'react-router-dom'
import { useUtilisateur } from '../hooks/useUtilisateur'
import type { Role } from '../types'

type Props = {
  children: React.ReactNode
  rolesInterdits: Role[]
}

export default function RouteProtegee({ children, rolesInterdits }: Props) {
  const { utilisateur } = useUtilisateur()

  if (utilisateur && rolesInterdits.includes(utilisateur.role)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}

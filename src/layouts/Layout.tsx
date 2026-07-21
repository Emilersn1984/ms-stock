import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useUtilisateur } from '../hooks/useUtilisateur'
import Header from '../components/Header'
import { Home, Package, Truck, Settings, ClipboardList, ScrollText } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Tableau de bord', icon: Home },
  { to: '/stock', label: 'Stock', icon: Package },
  { to: '/nomenclature', label: 'Sous-ensembles', icon: ClipboardList },
  { to: '/commandes', label: 'Commandes', icon: Truck },
  { to: '/fabrication', label: 'Fabrication', icon: Settings },
  { to: '/historique', label: 'Historique', icon: ScrollText },
]

export default function Layout() {
  const { utilisateur, deconnecter } = useUtilisateur()

  if (!utilisateur) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <Header utilisateur={utilisateur} onDeconnecter={deconnecter} />

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-primary-100 py-4 px-3 gap-1 flex-shrink-0 overflow-y-auto">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary-50 text-primary-700'
                    : 'text-primary-600 hover:bg-primary-50'
                }`
              }
            >
              <item.icon size={18} />
              {item.label}
            </NavLink>
          ))}
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-primary-100 z-10">
        <div className="grid grid-cols-6 h-16">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex flex-col items-center justify-center gap-0.5 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary-600' : 'text-primary-400'
                }`
              }
            >
              <item.icon size={20} />
              <span className="leading-tight truncate px-1 text-center">{item.label.split(' ')[0]}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  )
}

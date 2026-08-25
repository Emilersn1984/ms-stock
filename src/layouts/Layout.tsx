import { useState } from 'react'
import { NavLink, Outlet, Navigate } from 'react-router-dom'
import { useUtilisateur } from '../hooks/useUtilisateur'
import Header from '../components/Header'
import { Home, Package, Truck, ScrollText, Send, ShoppingBag, LineChart } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

type NavItem = {
  to: string
  label: string
  icon: LucideIcon
}

const NAV_ITEMS: NavItem[] = [
  { to: '/dashboard', label: 'Tableau de bord', icon: Home },
  { to: '/ventes', label: 'Ventes', icon: ShoppingBag },
  { to: '/expedition', label: 'Expédition', icon: Send },
  { to: '/stock', label: 'Stock', icon: Package },
  { to: '/commandes', label: 'Achats MP', icon: Truck },
  { to: '/projections', label: 'Projections', icon: LineChart },
  { to: '/historique', label: 'Historique', icon: ScrollText },
]

const NAV_ITEMS_MASQUES_OUVRIER = ['/commandes', '/ventes', '/expedition', '/historique', '/projections']

export default function Layout() {
  const { utilisateur, deconnecter } = useUtilisateur()
  // Le bandeau se replie dès qu'on quitte le haut de la page, pour rendre
  // sa hauteur au contenu (tableaux longs de la page Projections).
  const [enHautDePage, setEnHautDePage] = useState(true)

  if (!utilisateur) {
    return <Navigate to="/login" replace />
  }

  const navItems = utilisateur.role === 'ouvrier'
    ? NAV_ITEMS.filter((item) => !NAV_ITEMS_MASQUES_OUVRIER.includes(item.to))
    : NAV_ITEMS

  return (
    <div className="h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg)' }}>
      <div className={`flex-shrink-0 overflow-hidden ${enHautDePage ? "" : "h-0"}`}>
        <Header utilisateur={utilisateur} onDeconnecter={deconnecter} />
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar desktop */}
        <aside className="hidden md:flex flex-col w-56 bg-white border-r border-primary-100 py-4 px-3 gap-1 flex-shrink-0 overflow-y-auto">
          {navItems.map((item) => (
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
        <main
          className="flex-1 overflow-auto pb-20 md:pb-0"
          onScroll={(e) => setEnHautDePage(e.currentTarget.scrollTop < 8)}
        >
          <Outlet />
        </main>
      </div>

      {/* Bottom nav mobile */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-primary-100 z-10">
        <div className={`grid h-16 grid-cols-${navItems.length}`}>
          {navItems.map((item) => (
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

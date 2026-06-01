import { NavLink, Outlet } from 'react-router-dom'
import { ThemeToggle } from './ThemeToggle'

const navItems = [
  { to: '/', label: 'Esami', end: true },
  { to: '/guida', label: 'Guida' },
]

function NavItems() {
  return (
    <>
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
        >
          {item.label}
        </NavLink>
      ))}
    </>
  )
}

export function Layout() {
  return (
    <div className="app-layout">
      <aside className="sidebar" aria-label="Navigazione principale">
        <div className="brand">Study App</div>
        <nav className="sidebar-nav">
          <NavItems />
        </nav>
        <div className="sidebar-theme">
          <ThemeToggle />
        </div>
      </aside>

      <main className="main-content">
        <Outlet />
      </main>

      <nav className="bottom-tab" aria-label="Navigazione mobile">
        <NavItems />
        <ThemeToggle />
      </nav>
    </div>
  )
}

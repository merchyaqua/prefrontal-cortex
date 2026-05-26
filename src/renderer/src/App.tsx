import { useState, useEffect } from 'react'
import { Routes, Route, NavLink, Navigate } from 'react-router-dom'
import Auth from './routes/Auth'
import Today from './routes/Today'
import Dashboard from './routes/Dashboard'
import Destructor from './routes/Destructor'
import Principles from './routes/Principles'
import Tells from './routes/Tells'
import Session from './routes/Session'
import History from './routes/History'
import CheckIn from './routes/CheckIn'

type AuthState = { user_id: string } | null | 'loading'

const navItems = [
  { to: '/today', label: 'Today' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/destructor', label: 'Destructor' },
  { to: '/principles', label: 'Principles' },
  { to: '/tells', label: 'Tells' },
  { to: '/session', label: 'Session' },
  { to: '/history', label: 'History' }
]

function Shell({ children, onSignOut }: { children: React.ReactNode; onSignOut: () => void }) {
  return (
    <div className="flex h-full">
      <aside className="w-44 shrink-0 border-r border-black/5 px-4 py-6 text-sm">
        <div className="mb-6 text-lg leading-tight text-ink/80">
          prefrontal cortex
          <br />
          <span className="text-muted">companion</span>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((n) => (
            <NavLink
              key={n.to}
              to={n.to}
              className={({ isActive }) =>
                `rounded px-2 py-1 transition ${
                  isActive ? 'bg-ink text-paper' : 'text-muted hover:text-ink'
                }`
              }
            >
              {n.label}
            </NavLink>
          ))}
        </nav>
        <button
          onClick={onSignOut}
          className="mt-auto absolute bottom-6 left-4 right-4 text-xs text-muted/50 hover:text-muted transition"
        >
          sign out
        </button>
      </aside>
      <main className="flex-1 overflow-auto">{children}</main>
    </div>
  )
}

export default function App() {
  const [auth, setAuth] = useState<AuthState>('loading')

  useEffect(() => {
    window.api.db.getSession().then((s) => setAuth(s))
  }, [])

  async function handleSignOut() {
    await window.api.db.signOut()
    setAuth(null)
  }

  if (auth === 'loading') {
    return (
      <div className="flex h-full items-center justify-center">
        <span className="text-sm text-muted">loading…</span>
      </div>
    )
  }

  if (!auth) {
    return <Auth onAuth={(s) => setAuth(s)} />
  }

  return (
    <Routes>
      <Route path="/destructor" element={<Destructor />} />
      <Route path="/check-in" element={<CheckIn />} />
      <Route
        path="/*"
        element={
          <Shell onSignOut={handleSignOut}>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/today" element={<Today />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/principles" element={<Principles />} />
              <Route path="/tells" element={<Tells />} />
              <Route path="/session" element={<Session />} />
              <Route path="/history" element={<History />} />
            </Routes>
          </Shell>
        }
      />
    </Routes>
  )
}

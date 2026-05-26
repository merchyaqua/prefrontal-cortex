import { useEffect, useState } from 'react'
import type { ActiveWindowInfo } from '@shared/types'

export default function Dashboard() {
  const [active, setActive] = useState<ActiveWindowInfo | null>(null)

  useEffect(() => {
    void window.api.focus.current().then(setActive)
    const id = window.setInterval(() => {
      void window.api.focus.current().then(setActive)
    }, 5000)
    return () => window.clearInterval(id)
  }, [])

  return (
    <div className="p-10">
      <h1 className="text-3xl text-ink/90">Dashboard</h1>
      <p className="mt-2 text-muted">
        Hotkeys: <kbd>⌘⇧D</kbd> destructor · <kbd>⌘⇧L</kbd> log state
      </p>

      <section className="mt-8 max-w-xl">
        <h2 className="text-sm uppercase tracking-wide text-muted">Foreground</h2>
        <div className="mt-2 rounded border border-black/5 bg-white px-4 py-3 text-sm">
          {active ? (
            <>
              <div className="font-medium">{active.appName}</div>
              <div className="text-muted">{active.title}</div>
            </>
          ) : (
            <span className="text-muted">no active window detected</span>
          )}
        </div>
      </section>
    </div>
  )
}

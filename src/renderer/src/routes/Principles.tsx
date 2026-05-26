import { useState, useEffect, useRef } from 'react'
import type { Principle } from '@shared/types'

type PrincipleRow = Principle & { restructuring?: boolean }

const isKnown = (s?: string | null) => s && s !== '<UNKNOWN>'

function IIFields({ p }: { p: PrincipleRow }) {
  if (p.restructuring) {
    return (
      <div className="mt-3 space-y-1.5 border-t border-black/5 pt-3">
        <div className="h-2 w-2/5 animate-pulse rounded-full bg-black/8" />
        <div className="h-2 w-3/5 animate-pulse rounded-full bg-black/8" />
        <div className="h-2 w-1/2 animate-pulse rounded-full bg-black/8" />
      </div>
    )
  }
  if (!isKnown(p.ii_when) && !isKnown(p.ii_then) && !isKnown(p.ii_because)) return null
  return (
    <dl className="mt-3 space-y-1 border-t border-black/5 pt-3">
      {isKnown(p.ii_when) && (
        <div className="flex gap-2 text-xs">
          <span className="shrink-0 pt-px text-[10px] uppercase tracking-widest text-muted/50">when</span>
          <span className="text-muted">{p.ii_when}</span>
        </div>
      )}
      {isKnown(p.ii_then) && (
        <div className="flex gap-2 text-xs">
          <span className="shrink-0 pt-px text-[10px] uppercase tracking-widest text-muted/50">then</span>
          <span className="text-muted">{p.ii_then}</span>
        </div>
      )}
      {isKnown(p.ii_because) && (
        <div className="flex gap-2 text-xs">
          <span className="shrink-0 pt-px text-[10px] uppercase tracking-widest text-muted/50">why</span>
          <span className="text-muted">{p.ii_because}</span>
        </div>
      )}
    </dl>
  )
}

export default function Principles() {
  const [principles, setPrinciples] = useState<PrincipleRow[]>([])
  const [loading, setLoading] = useState(true)
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const [bounced, setBounced] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.api.db
      .listPrinciples()
      .then((ps) => setPrinciples(ps))
      .finally(() => setLoading(false))
  }, [])

  async function triggerRestructure(id: string, text: string) {
    try {
      const ii = await window.api.claude.restructurePrinciple(text)
      const allUnknown = !isKnown(ii.ii_when) && !isKnown(ii.ii_then) && !isKnown(ii.ii_because)
      if (allUnknown) {
        setPrinciples((prev) => prev.filter((p) => p.id !== id))
        await window.api.db.deletePrinciple(id)
        setBounced(text)
        return
      }
      const updated = await window.api.db.upsertPrinciple({ id, ...ii })
      setPrinciples((prev) =>
        prev.map((p) => (p.id === id ? { ...updated, restructuring: false } : p))
      )
    } catch {
      setPrinciples((prev) =>
        prev.map((p) => (p.id === id ? { ...p, restructuring: false } : p))
      )
    }
  }

  async function handleAdd() {
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true)
    setDraft('')
    try {
      const saved = await window.api.db.upsertPrinciple({ text })
      setPrinciples((prev) => [...prev, { ...saved, restructuring: true }])
      void triggerRestructure(saved.id, text)
    } finally {
      setAdding(false)
      textareaRef.current?.focus()
    }
  }

  async function handleDelete(id: string) {
    setPrinciples((prev) => prev.filter((p) => p.id !== id))
    await window.api.db.deletePrinciple(id)
  }

  async function handleToggle(p: Principle) {
    const updated = await window.api.db.upsertPrinciple({ id: p.id, active: !p.active })
    setPrinciples((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: updated.active } : x)))
  }

  async function handleRestructure(p: PrincipleRow) {
    if (p.restructuring) return
    setPrinciples((prev) => prev.map((x) => (x.id === p.id ? { ...x, restructuring: true } : x)))
    void triggerRestructure(p.id, p.text)
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">
      <h1 className="text-3xl text-ink/90">Principles</h1>

      <div className="mt-8">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => { setDraft(e.target.value); setBounced(null) }}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
          }}
          placeholder="e.g. Small resets work better than all-or-nothing thinking after slipping up."
          rows={3}
          className="w-full resize-none rounded border border-black/10 bg-white px-4 py-3 text-sm text-ink outline-none placeholder:text-muted/35 transition focus:border-ink/25 focus:ring-1 focus:ring-ink/10"
          disabled={adding}
        />
        {bounced && (
          <p className="mt-2 text-xs text-muted/60">
            Could not structure <em>{bounced.length > 40 ? bounced.slice(0, 40) + '...' : bounced}</em> &mdash; try being more specific.
          </p>
        )}
        <div className="mt-2 flex items-center justify-between">
          <span className="text-xs text-muted/40">&#8984;&#8629; to add</span>
          <button
            onClick={handleAdd}
            disabled={adding || !draft.trim()}
            className="rounded bg-ink px-4 py-1.5 text-sm font-medium text-paper transition hover:bg-ink/80 disabled:opacity-30"
          >
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </div>

      <div className="mt-10 space-y-3">
        {loading && <p className="text-sm text-muted/50">Loading...</p>}

        {!loading && principles.length === 0 && (
          <p className="text-sm text-muted/50">No principles yet.</p>
        )}

        {principles.map((p) => (
          <div
            key={p.id}
            className={`group rounded-lg border px-5 py-4 transition ${
              p.active
                ? 'border-black/10 bg-white shadow-sm'
                : 'border-black/5 bg-black/2 opacity-60'
            }`}
          >
            <div className="flex items-start justify-between gap-4">
              <p className={`flex-1 text-sm leading-relaxed ${p.active ? 'text-ink' : 'text-muted'}`}>
                {p.text}
              </p>
              <div className="flex shrink-0 items-center gap-1 opacity-0 transition focus-within:opacity-100 group-hover:opacity-100">
                <button
                  onClick={() => handleRestructure(p)}
                  disabled={p.restructuring}
                  title="Re-structure"
                  className="rounded px-2 py-1 text-xs text-muted hover:bg-black/5 hover:text-ink disabled:opacity-40"
                >
                  &#8635;
                </button>
                <button
                  onClick={() => handleToggle(p)}
                  title={p.active ? 'Deactivate' : 'Activate'}
                  className="rounded px-2 py-1 text-xs text-muted hover:bg-black/5 hover:text-ink"
                >
                  {p.active ? 'pause' : 'resume'}
                </button>
                <button
                  onClick={() => handleDelete(p.id)}
                  title="Delete"
                  className="rounded px-2 py-1 text-xs text-muted hover:bg-red-50 hover:text-accent"
                >
                  delete
                </button>
              </div>
            </div>

            <IIFields p={p} />
          </div>
        ))}
      </div>
    </div>
  )
}

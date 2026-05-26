import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Intention, IntentionScope } from '@shared/types'

const TODAY = new Date().toISOString().slice(0, 10)

const SCOPES: { key: IntentionScope; label: string; placeholder: string }[] = [
  { key: 'day',      label: 'Today',      placeholder: 'what does today look like when it goes right?' },
  { key: 'week',     label: 'This week',  placeholder: 'what are you building toward this week?' },
  { key: 'longterm', label: 'Long-term',  placeholder: 'what matters most right now?' }
]

function formatDate(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long'
  })
}

export default function Today() {
  const [scope, setScope] = useState<IntentionScope>('day')
  const [intentions, setIntentions] = useState<Intention[]>([])
  const [draft, setDraft] = useState('')
  const [adding, setAdding] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const current = SCOPES.find((s) => s.key === scope)!

  useEffect(() => {
    const params = scope === 'day' ? { scope, date: TODAY } : { scope }
    window.api.db.listIntentions(params).then(setIntentions)
  }, [scope])

  async function handleAdd() {
    const text = draft.trim()
    if (!text || adding) return
    setAdding(true)
    setDraft('')
    try {
      const saved = await window.api.db.upsertIntention({ text, scope, date: TODAY })
      setIntentions((prev) => [...prev, saved])
    } finally {
      setAdding(false)
      textareaRef.current?.focus()
    }
  }

  async function handleDelete(id: string) {
    setIntentions((prev) => prev.filter((i) => i.id !== id))
    await window.api.db.deleteIntention(id)
  }

  return (
    <div className="mx-auto max-w-2xl px-10 py-10">

      {/* Date — accent color, energetic but not loud */}
      <p className="text-xs uppercase tracking-widest text-accent/60">
        {formatDate(TODAY)}
      </p>

      {/* Scope tabs */}
      <div className="mt-5 flex gap-5">
        {SCOPES.map((s) => (
          <button
            key={s.key}
            onClick={() => setScope(s.key)}
            className={`text-sm transition ${
              scope === s.key
                ? 'text-ink border-b border-ink pb-px'
                : 'text-muted/50 hover:text-muted'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      {/* Input */}
      <div className="mt-8">
        <textarea
          ref={textareaRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleAdd()
          }}
          placeholder={current.placeholder}
          rows={3}
          disabled={adding}
          className="w-full resize-none bg-transparent text-lg text-ink outline-none placeholder:text-muted/25 leading-relaxed"
        />
        {draft.trim() && (
          <p className="mt-1 text-xs text-muted/40">&#8984;&#8629; to save</p>
        )}
      </div>

      {/* Intentions list */}
      <div className="mt-10 space-y-4">
        <AnimatePresence initial={false}>
          {intentions.map((intention) => (
            <motion.div
              key={intention.id}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2 }}
              className="group flex items-start justify-between gap-4"
            >
              <p className="flex-1 text-base leading-relaxed text-ink/80">
                {intention.text}
              </p>
              <button
                onClick={() => handleDelete(intention.id)}
                className="mt-0.5 shrink-0 text-xs text-muted/30 opacity-0 transition hover:text-accent group-hover:opacity-100"
              >
                delete
              </button>
            </motion.div>
          ))}
        </AnimatePresence>

        {intentions.length === 0 && !draft && (
          <p className="text-sm text-muted/30">nothing yet.</p>
        )}
      </div>

    </div>
  )
}

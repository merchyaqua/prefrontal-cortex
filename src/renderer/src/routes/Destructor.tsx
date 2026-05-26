import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import type { Principle, DestructorResult, HighlightSpan } from '@shared/types'

type Token = { text: string; isWord: boolean; highlighted: boolean; index: number }

function tokenize(text: string, spans: HighlightSpan[]): Token[] {
  const tokens: Token[] = []
  const regex = /\S+|\s+/g
  let match
  let wordIndex = 0
  while ((match = regex.exec(text)) !== null) {
    const start = match.index
    const end = start + match[0].length
    const isWord = match[0].trim().length > 0
    const highlighted = isWord && spans.some((s) => start < s.end && end > s.start)
    tokens.push({ text: match[0], isWord, highlighted, index: isWord ? wordIndex++ : -1 })
  }
  return tokens
}

function renderWithPhrases(text: string, phrases: string[]) {
  if (!phrases.length) return [{ text, relevant: false }]
  // Find all match positions via indexOf, build non-overlapping segments
  type Seg = { start: number; end: number }
  const matches: Seg[] = []
  for (const phrase of phrases) {
    let idx = text.toLowerCase().indexOf(phrase.toLowerCase())
    while (idx !== -1) {
      matches.push({ start: idx, end: idx + phrase.length })
      idx = text.toLowerCase().indexOf(phrase.toLowerCase(), idx + 1)
    }
  }
  // Sort and merge overlapping spans
  matches.sort((a, b) => a.start - b.start)
  const merged: Seg[] = []
  for (const m of matches) {
    if (merged.length && m.start <= merged[merged.length - 1].end) {
      merged[merged.length - 1].end = Math.max(merged[merged.length - 1].end, m.end)
    } else {
      merged.push({ ...m })
    }
  }
  if (!merged.length) return [{ text, relevant: false }]
  const segs: Array<{ text: string; relevant: boolean }> = []
  let pos = 0
  for (const m of merged) {
    if (m.start > pos) segs.push({ text: text.slice(pos, m.start), relevant: false })
    segs.push({ text: text.slice(m.start, m.end), relevant: true })
    pos = m.end
  }
  if (pos < text.length) segs.push({ text: text.slice(pos), relevant: false })
  return segs
}

type Phase = 'input' | 'analyzing' | 'result'

export default function Destructor() {
  const [thought, setThought] = useState('')
  const [phase, setPhase] = useState<Phase>('input')
  const [result, setResult] = useState<DestructorResult | null>(null)
  const [principles, setPrinciples] = useState<Principle[]>([])
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    window.api.db.listPrinciples().then(setPrinciples)
  }, [])

  const matchedPrinciple = result?.principleId
    ? principles.find((p) => p.id === result.principleId) ?? null
    : null

  async function handleSubmit() {
    const text = thought.trim()
    if (!text || phase !== 'input') return
    setPhase('analyzing')
    try {
      const res = await window.api.claude.rewrite({ thought: text, principles })
      setResult(res)
      setPhase('result')
    } catch {
      setPhase('input')
    }
  }

  function handleReset() {
    setThought('')
    setResult(null)
    setPhase('input')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  if (phase === 'input') {
    return (
      <div className="flex h-full items-center justify-center bg-paper">
        <div className="w-full max-w-xl px-10">
          <textarea
            ref={textareaRef}
            autoFocus
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit()
            }}
            placeholder="what are you doing right now?"
            rows={4}
            className="w-full resize-none bg-transparent text-xl text-ink outline-none placeholder:text-muted/25 leading-relaxed"
          />
          {thought.trim() && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4 text-xs text-muted/40"
            >
              &#8984;&#8629; to run
            </motion.p>
          )}
        </div>
      </div>
    )
  }

  if (phase === 'analyzing') {
    return (
      <div className="flex h-full items-center justify-center bg-paper">
        <div className="w-full max-w-xl px-10">
          <div className="relative overflow-hidden">
            <p className="text-xl leading-relaxed text-ink/30 select-none">{thought}</p>
            <motion.div
              className="absolute top-0 bottom-0 w-px bg-ink/25"
              initial={{ left: 0 }}
              animate={{ left: '100%' }}
              transition={{ duration: 2.2, repeat: Infinity, ease: 'linear' }}
            />
          </div>
        </div>
      </div>
    )
  }

  const tokens = result ? tokenize(thought, result.highlightedSpans) : []
  const wordCount = tokens.filter((t) => t.isWord).length
  const quoteDelay = Math.min(wordCount * 0.025, 0.4) + 0.15
  const actionDelay = quoteDelay + 0.3
  const metaDelay = actionDelay + 0.2

  return (
    <div className="flex h-full items-start justify-center bg-paper pt-16">
      <div className="w-full max-w-xl px-10">

        {/* Thought — equal weight to principle, muted vs bold */}
        <p className="text-base leading-relaxed">
          {tokens.map((t, i) =>
            !t.isWord ? (
              <span key={i}>{t.text}</span>
            ) : (
              <motion.span
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: t.highlighted ? 0.25 : 0.6 }}
                transition={{ duration: 0.2, delay: Math.min(t.index * 0.02, 0.35) }}
                className={`text-ink${t.highlighted ? ' line-through' : ''}`}
              >
                {t.text}
              </motion.span>
            )
          )}
        </p>

        {/* Principle quote — the hero */}
        {matchedPrinciple ? (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: quoteDelay }}
            className="mt-10 border-l-2 border-black/10 pl-5"
          >
            <p className="text-[10px] uppercase tracking-widest text-muted/40 mb-3">
              past you said this
            </p>
            <p className="text-base leading-relaxed line-clamp-3">
              {renderWithPhrases(matchedPrinciple.text, result?.principleKeyPhrases ?? []).map((seg, i) =>
                seg.relevant ? (
                  <span key={i} className="font-semibold text-ink">{seg.text}</span>
                ) : (
                  <span key={i} className="text-ink/35">{seg.text}</span>
                )
              )}
            </p>
          </motion.div>
        ) : (
          <div className="mt-10" />
        )}

        {/* Suggested action */}
        {result?.suggestedAction && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.3, delay: actionDelay }}
            className="mt-8 text-sm text-muted leading-relaxed"
          >
            {result.suggestedAction}
          </motion.p>
        )}

        {/* Framing + reset */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3, delay: metaDelay }}
          className="mt-10 flex items-center justify-between"
        >
          {result?.framing && (
            <span className="text-[10px] uppercase tracking-widest text-muted/30">
              {result.framing}
            </span>
          )}
          <button
            onClick={handleReset}
            className="ml-auto text-xs text-muted/40 transition hover:text-muted"
          >
            again
          </button>
        </motion.div>

      </div>
    </div>
  )
}

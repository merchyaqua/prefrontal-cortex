export type State = 'low' | 'ok' | 'peak'

export interface Principle {
  id: string
  user_id: string
  text: string
  ii_when: string | null
  ii_then: string | null
  ii_because: string | null
  active: boolean
  created_at: string
}

export interface Tell {
  id: string
  user_id: string
  label: string
  created_at: string
}

export interface CheckIn {
  id: string
  user_id: string
  ts: string
  state: State
  story: string | null
  tells_observed: string[]
}

export interface FocusSession {
  id: string
  user_id: string
  started_at: string
  ended_at: string | null
  intent: string
  likely_detractor: string | null
}

export interface HighlightSpan {
  start: number
  end: number
  reason: string
}

export interface DestructorResult {
  highlightedSpans: HighlightSpan[]
  principleId: string | null
  principleKeyPhrases: string[]
  suggestedAction: string
  framing: string
}

export interface ThoughtLog {
  id: string
  user_id: string
  ts: string
  original: string
  rewritten: string
  suggested_action: string
  highlights: HighlightSpan[]
  principles_used: string[]
  focus_session_id: string | null
}

export interface ActiveWindowInfo {
  title: string
  appName: string
  url?: string
}

export type IntentionScope = 'day' | 'week' | 'longterm'

export interface Intention {
  id: string
  user_id: string
  text: string
  scope: IntentionScope
  date: string
  created_at: string
}

export interface DestructorRequest {
  thought: string
  currentIntent?: string
}

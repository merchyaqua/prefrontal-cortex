import { app, IpcMain } from 'electron'
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import ws from 'ws'
import fs from 'node:fs'
import path from 'node:path'
import { IPC } from '../../shared/ipc'
import type { Principle, Tell, CheckIn, FocusSession, ThoughtLog, Intention, IntentionScope } from '../../shared/types'

// ─── persistent session storage (file in userData) ───────────────────────────

function sessionFile(): string {
  return path.join(app.getPath('userData'), 'supabase-session.json')
}

const fileStorage = {
  getItem(key: string): string | null {
    try {
      const f = sessionFile()
      if (!fs.existsSync(f)) return null
      const data = JSON.parse(fs.readFileSync(f, 'utf-8')) as Record<string, string>
      return typeof data[key] === 'string' ? data[key] : null
    } catch {
      return null
    }
  },
  setItem(key: string, value: string): void {
    try {
      const f = sessionFile()
      const data: Record<string, string> = fs.existsSync(f)
        ? (JSON.parse(fs.readFileSync(f, 'utf-8')) as Record<string, string>)
        : {}
      data[key] = value
      fs.writeFileSync(f, JSON.stringify(data), 'utf-8')
    } catch {}
  },
  removeItem(key: string): void {
    try {
      const f = sessionFile()
      if (!fs.existsSync(f)) return
      const data = JSON.parse(fs.readFileSync(f, 'utf-8')) as Record<string, string>
      delete data[key]
      fs.writeFileSync(f, JSON.stringify(data), 'utf-8')
    } catch {}
  }
}

// ─── client singleton ─────────────────────────────────────────────────────────

let _client: SupabaseClient | null = null

function db(): SupabaseClient {
  if (_client) return _client
  const url = process.env['SUPABASE_URL']
  const key = process.env['SUPABASE_ANON_KEY']
  if (!url || !key) throw new Error('SUPABASE_URL / SUPABASE_ANON_KEY not set in .env')
  _client = createClient(url, key, {
    auth: {
      storage: fileStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    realtime: { transport: ws as any }
  })
  return _client
}

async function requireUserId(): Promise<string> {
  const { data, error } = await db().auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated')
  return data.user.id
}

// ─── default tells ────────────────────────────────────────────────────────────

const DEFAULT_TELLS = [
  'snacking',
  'scratching',
  'nose-picking',
  'tab-switching',
  'phone-checking',
  'fidgeting',
  'standing-up-and-wandering'
]

// ─── IPC handler registration ─────────────────────────────────────────────────

export function registerDbHandlers(ipcMain: IpcMain): void {
  // ── auth ──

  ipcMain.handle(IPC.db.signInWithMagicLink, async (_e, email: string) => {
    const { error } = await db().auth.signInWithOtp({ email, options: { shouldCreateUser: true } })
    if (error) throw error
  })

  ipcMain.handle(IPC.db.verifyOtp, async (_e, email: string, token: string) => {
    const { data, error } = await db().auth.verifyOtp({ email, token, type: 'email' })
    if (error || !data.user) throw error ?? new Error('Verification failed')
    return { user_id: data.user.id }
  })

  ipcMain.handle(
    IPC.db.setSession,
    async (_e, accessToken: string, refreshToken: string) => {
      const { data, error } = await db().auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      })
      if (error || !data.user) throw error ?? new Error('Failed to set session')
      return { user_id: data.user.id }
    }
  )

  ipcMain.handle(IPC.db.signOut, async () => {
    await db().auth.signOut()
  })

  ipcMain.handle(IPC.db.getSession, async () => {
    const { data } = await db().auth.getUser()
    return data.user ? { user_id: data.user.id } : null
  })

  // ── seed ──

  ipcMain.handle(IPC.db.seedDefaultTells, async () => {
    const user_id = await requireUserId()
    const { data: existing } = await db().from('tells').select('id').eq('user_id', user_id)
    if (existing && existing.length > 0) return // already seeded
    const rows = DEFAULT_TELLS.map((label) => ({ user_id, label }))
    await db().from('tells').insert(rows)
  })

  // ── principles ──

  ipcMain.handle(IPC.db.listPrinciples, async () => {
    const user_id = await requireUserId()
    const { data, error } = await db()
      .from('principles')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data as Principle[]
  })

  ipcMain.handle(
    IPC.db.upsertPrinciple,
    async (
      _e,
      p: Partial<Principle> & { text?: string }
    ) => {
      const user_id = await requireUserId()
      if (p.id) {
        // update — only allow fields that can legitimately change
        const { id, text, ii_when, ii_then, ii_because, active } = p
        const patch: Partial<Principle> = {}
        if (text !== undefined) patch.text = text
        if (ii_when !== undefined) patch.ii_when = ii_when
        if (ii_then !== undefined) patch.ii_then = ii_then
        if (ii_because !== undefined) patch.ii_because = ii_because
        if (active !== undefined) patch.active = active
        const { data, error } = await db()
          .from('principles')
          .update(patch)
          .eq('id', id)
          .eq('user_id', user_id)
          .select()
          .single()
        if (error) throw error
        return data as Principle
      } else {
        if (!p.text) throw new Error('text is required')
        const { data, error } = await db()
          .from('principles')
          .insert({ user_id, text: p.text, active: true })
          .select()
          .single()
        if (error) throw error
        return data as Principle
      }
    }
  )

  ipcMain.handle(IPC.db.deletePrinciple, async (_e, id: string) => {
    const user_id = await requireUserId()
    const { error } = await db()
      .from('principles')
      .delete()
      .eq('id', id)
      .eq('user_id', user_id)
    if (error) throw error
  })

  // ── tells ──

  ipcMain.handle(IPC.db.listTells, async () => {
    const user_id = await requireUserId()
    const { data, error } = await db()
      .from('tells')
      .select('*')
      .eq('user_id', user_id)
      .order('created_at', { ascending: true })
    if (error) throw error
    return data as Tell[]
  })

  ipcMain.handle(IPC.db.upsertTell, async (_e, t: Partial<Tell> & { label?: string }) => {
    const user_id = await requireUserId()
    if (t.id) {
      const { data, error } = await db()
        .from('tells')
        .update({ label: t.label })
        .eq('id', t.id)
        .eq('user_id', user_id)
        .select()
        .single()
      if (error) throw error
      return data as Tell
    } else {
      if (!t.label) throw new Error('label is required')
      const { data, error } = await db()
        .from('tells')
        .insert({ user_id, label: t.label })
        .select()
        .single()
      if (error) throw error
      return data as Tell
    }
  })

  ipcMain.handle(IPC.db.deleteTell, async (_e, id: string) => {
    const user_id = await requireUserId()
    const { error } = await db().from('tells').delete().eq('id', id).eq('user_id', user_id)
    if (error) throw error
  })

  // ── intentions ──

  ipcMain.handle(
    IPC.db.listIntentions,
    async (_e, params?: { scope?: IntentionScope; date?: string }) => {
      const user_id = await requireUserId()
      let q = db().from('intentions').select('*').eq('user_id', user_id)
      if (params?.scope) q = q.eq('scope', params.scope)
      if (params?.date) q = q.eq('date', params.date)
      const { data, error } = await q.order('created_at', { ascending: true })
      if (error) throw error
      return data as Intention[]
    }
  )

  ipcMain.handle(
    IPC.db.upsertIntention,
    async (_e, i: { id?: string; text: string; scope: IntentionScope; date: string }) => {
      const user_id = await requireUserId()
      if (i.id) {
        const { data, error } = await db()
          .from('intentions')
          .update({ text: i.text })
          .eq('id', i.id)
          .eq('user_id', user_id)
          .select()
          .single()
        if (error) throw error
        return data as Intention
      } else {
        const { data, error } = await db()
          .from('intentions')
          .insert({ user_id, text: i.text, scope: i.scope, date: i.date })
          .select()
          .single()
        if (error) throw error
        return data as Intention
      }
    }
  )

  ipcMain.handle(IPC.db.deleteIntention, async (_e, id: string) => {
    const user_id = await requireUserId()
    const { error } = await db().from('intentions').delete().eq('id', id).eq('user_id', user_id)
    if (error) throw error
  })

  // ── check-ins ──

  ipcMain.handle(
    IPC.db.insertCheckIn,
    async (_e, c: Pick<CheckIn, 'state' | 'story' | 'tells_observed'>) => {
      const user_id = await requireUserId()
      const { data, error } = await db()
        .from('check_ins')
        .insert({ user_id, state: c.state, story: c.story ?? null, tells_observed: c.tells_observed })
        .select()
        .single()
      if (error) throw error
      return data as CheckIn
    }
  )

  ipcMain.handle(IPC.db.listCheckIns, async (_e, limit = 50) => {
    const user_id = await requireUserId()
    const { data, error } = await db()
      .from('check_ins')
      .select('*')
      .eq('user_id', user_id)
      .order('ts', { ascending: false })
      .limit(limit)
    if (error) throw error
    return data as CheckIn[]
  })

  // ── focus sessions ──

  ipcMain.handle(
    IPC.db.startSession,
    async (_e, s: Pick<FocusSession, 'intent' | 'likely_detractor'>) => {
      const user_id = await requireUserId()
      const { data, error } = await db()
        .from('focus_sessions')
        .insert({ user_id, intent: s.intent, likely_detractor: s.likely_detractor ?? null })
        .select()
        .single()
      if (error) throw error
      return data as FocusSession
    }
  )

  ipcMain.handle(IPC.db.endSession, async (_e, id: string) => {
    const user_id = await requireUserId()
    const { error } = await db()
      .from('focus_sessions')
      .update({ ended_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', user_id)
    if (error) throw error
  })

  ipcMain.handle(IPC.db.currentSession, async () => {
    const user_id = await requireUserId()
    const { data, error } = await db()
      .from('focus_sessions')
      .select('*')
      .eq('user_id', user_id)
      .is('ended_at', null)
      .order('started_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (error) throw error
    return data as FocusSession | null
  })

  // ── thought logs ──

  ipcMain.handle(
    IPC.db.insertThoughtLog,
    async (_e, log: Omit<ThoughtLog, 'id' | 'user_id' | 'ts'>) => {
      const user_id = await requireUserId()
      const { data, error } = await db()
        .from('thought_logs')
        .insert({ user_id, ...log })
        .select()
        .single()
      if (error) throw error
      return data as ThoughtLog
    }
  )

  ipcMain.handle(IPC.db.searchThoughtLogs, async (_e, query: string) => {
    const user_id = await requireUserId()
    const { data, error } = await db()
      .from('thought_logs')
      .select('*')
      .eq('user_id', user_id)
      .ilike('original', `%${query}%`)
      .order('ts', { ascending: false })
      .limit(20)
    if (error) throw error
    return data as ThoughtLog[]
  })
}

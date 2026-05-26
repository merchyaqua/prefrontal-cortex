import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/ipc'
import type {
  ActiveWindowInfo,
  Principle,
  Tell,
  CheckIn,
  FocusSession,
  ThoughtLog,
  Intention,
  IntentionScope,
  DestructorRequest,
  DestructorResult
} from '../shared/types'

const api = {
  claude: {
    restructurePrinciple: (
      text: string
    ): Promise<{ ii_when: string; ii_then: string; ii_because: string }> =>
      ipcRenderer.invoke(IPC.claude.restructurePrinciple, text),

    rewrite: (
      req: DestructorRequest & { principles: Principle[] }
    ): Promise<DestructorResult> => ipcRenderer.invoke(IPC.claude.rewrite, req)
  },

  db: {
    // auth
    signInWithMagicLink: (email: string): Promise<void> =>
      ipcRenderer.invoke(IPC.db.signInWithMagicLink, email),
    verifyOtp: (email: string, token: string): Promise<{ user_id: string }> =>
      ipcRenderer.invoke(IPC.db.verifyOtp, email, token),
    setSession: (accessToken: string, refreshToken: string): Promise<{ user_id: string }> =>
      ipcRenderer.invoke(IPC.db.setSession, accessToken, refreshToken),
    signOut: (): Promise<void> => ipcRenderer.invoke(IPC.db.signOut),
    getSession: (): Promise<{ user_id: string } | null> =>
      ipcRenderer.invoke(IPC.db.getSession),
    seedDefaultTells: (): Promise<void> => ipcRenderer.invoke(IPC.db.seedDefaultTells),

    // intentions
    listIntentions: (params?: { scope?: IntentionScope; date?: string }): Promise<Intention[]> =>
      ipcRenderer.invoke(IPC.db.listIntentions, params),
    upsertIntention: (i: { id?: string; text: string; scope: IntentionScope; date: string }): Promise<Intention> =>
      ipcRenderer.invoke(IPC.db.upsertIntention, i),
    deleteIntention: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC.db.deleteIntention, id),

    // principles
    listPrinciples: (): Promise<Principle[]> => ipcRenderer.invoke(IPC.db.listPrinciples),
    upsertPrinciple: (
      p: Partial<Principle> & { text?: string }
    ): Promise<Principle> => ipcRenderer.invoke(IPC.db.upsertPrinciple, p),
    deletePrinciple: (id: string): Promise<void> =>
      ipcRenderer.invoke(IPC.db.deletePrinciple, id),

    // tells
    listTells: (): Promise<Tell[]> => ipcRenderer.invoke(IPC.db.listTells),
    upsertTell: (t: Partial<Tell> & { label?: string }): Promise<Tell> =>
      ipcRenderer.invoke(IPC.db.upsertTell, t),
    deleteTell: (id: string): Promise<void> => ipcRenderer.invoke(IPC.db.deleteTell, id),

    // check-ins
    insertCheckIn: (
      c: Pick<CheckIn, 'state' | 'story' | 'tells_observed'>
    ): Promise<CheckIn> => ipcRenderer.invoke(IPC.db.insertCheckIn, c),
    listCheckIns: (limit?: number): Promise<CheckIn[]> =>
      ipcRenderer.invoke(IPC.db.listCheckIns, limit),

    // focus sessions
    startSession: (
      s: Pick<FocusSession, 'intent' | 'likely_detractor'>
    ): Promise<FocusSession> => ipcRenderer.invoke(IPC.db.startSession, s),
    endSession: (id: string): Promise<void> => ipcRenderer.invoke(IPC.db.endSession, id),
    currentSession: (): Promise<FocusSession | null> =>
      ipcRenderer.invoke(IPC.db.currentSession),

    // thought logs
    insertThoughtLog: (
      log: Omit<ThoughtLog, 'id' | 'user_id' | 'ts'>
    ): Promise<ThoughtLog> => ipcRenderer.invoke(IPC.db.insertThoughtLog, log),
    searchThoughtLogs: (query: string): Promise<ThoughtLog[]> =>
      ipcRenderer.invoke(IPC.db.searchThoughtLogs, query)
  },

  focus: {
    current: (): Promise<ActiveWindowInfo | null> => ipcRenderer.invoke(IPC.focus.current)
  },

  hotkey: {
    openDestructor: (): void => ipcRenderer.send(IPC.hotkey.openDestructor),
    openCheckIn: (): void => ipcRenderer.send(IPC.hotkey.openCheckIn)
  }
}

export type Api = typeof api

contextBridge.exposeInMainWorld('api', api)

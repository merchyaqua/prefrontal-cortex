import type { ActiveWindowInfo } from '../../shared/types'

export async function getActiveWindow(): Promise<ActiveWindowInfo | null> {
  try {
    const { default: activeWin } = await import('active-win')
    const w = await activeWin()
    if (!w) return null
    return {
      title: w.title,
      appName: w.owner.name,
      url: 'url' in w ? (w as { url?: string }).url : undefined
    }
  } catch {
    return null
  }
}

import { useEffect, useState } from 'react'

type WebkitDoc = Document & { webkitFullscreenElement?: Element | null; webkitExitFullscreen?: () => void }
type WebkitEl = HTMLElement & { webkitRequestFullscreen?: () => void }
const fullEl = () => document.fullscreenElement ?? (document as WebkitDoc).webkitFullscreenElement ?? null

/** Toggle browser full-screen. Used by the crew panel button and the A + F shortcut.
 *  Safari on iPad only has the webkit- names, and iPhone has no page full-screen at all — never throw. */
export function toggleFullscreen() {
  const d = document as WebkitDoc
  const el = document.documentElement as WebkitEl
  try {
    if (fullEl()) void (d.exitFullscreen ? d.exitFullscreen().catch(() => {}) : d.webkitExitFullscreen?.())
    else if (el.requestFullscreen) void el.requestFullscreen().catch(() => {})
    else el.webkitRequestFullscreen?.()
  } catch {
    /* not available here (iPhone) */
  }
}

/**
 * Tracks full-screen, and while in it holds a screen wake lock so the booth laptop never
 * dims or sleeps. The browser drops the lock whenever the tab is hidden, so it's re-taken on return.
 */
export function useFullscreen() {
  const [full, setFull] = useState(() => !!fullEl())
  const [awake, setAwake] = useState(false)

  useEffect(() => {
    const onChange = () => setFull(!!fullEl())
    document.addEventListener('fullscreenchange', onChange)
    document.addEventListener('webkitfullscreenchange', onChange)
    return () => {
      document.removeEventListener('fullscreenchange', onChange)
      document.removeEventListener('webkitfullscreenchange', onChange)
    }
  }, [])

  useEffect(() => {
    if (!full || !('wakeLock' in navigator)) return
    let lock: WakeLockSentinel | null = null
    let dead = false
    const take = async () => {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        lock = await navigator.wakeLock.request('screen')
        if (dead) return void lock.release()
        setAwake(true)
        lock.addEventListener('release', () => setAwake(false))
      } catch {
        setAwake(false)
      }
    }
    void take()
    document.addEventListener('visibilitychange', take)
    return () => {
      dead = true
      document.removeEventListener('visibilitychange', take)
      void lock?.release()
      setAwake(false)
    }
  }, [full])

  return { full, awake }
}

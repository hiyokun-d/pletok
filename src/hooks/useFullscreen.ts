import { useEffect, useState } from 'react'

/** Toggle browser full-screen. Used by the crew panel button and the A + F shortcut. */
export function toggleFullscreen() {
  if (document.fullscreenElement) void document.exitFullscreen()
  else void document.documentElement.requestFullscreen().catch(() => {})
}

/**
 * Tracks full-screen, and while in it holds a screen wake lock so the booth laptop never
 * dims or sleeps. The browser drops the lock whenever the tab is hidden, so it's re-taken on return.
 */
export function useFullscreen() {
  const [full, setFull] = useState(() => !!document.fullscreenElement)
  const [awake, setAwake] = useState(false)

  useEffect(() => {
    const onChange = () => setFull(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
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

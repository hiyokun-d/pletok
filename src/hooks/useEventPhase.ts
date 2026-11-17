import { useSyncExternalStore } from 'react'
import { EVENT } from '../data/event'

export type Phase = 'pre-open' | 'open' | 'last-call' | 'closed'

const LAST_CALL_MS = EVENT.lastCallMinutes * 60_000

/**
 * Debug overrides so every phase can be previewed before the event:
 *   ?now=2026-11-25T15:59:50+07:00   start the clock at that instant
 *   ?phase=pre-open|open|last-call|closed
 */
function initialOffset(): number {
  const params = new URLSearchParams(window.location.search)
  const now = params.get('now')
  if (now && !Number.isNaN(Date.parse(now))) return Date.parse(now) - Date.now()
  const phaseStart: Record<string, number> = {
    // before the event the real clock already is pre-open — keep it, so the days count is real
    'pre-open': Date.now() < EVENT.open.getTime() ? Date.now() : EVENT.open.getTime() - (3 * 86400 + 2 * 3600 + 14 * 60) * 1000,
    open: EVENT.open.getTime() + 47 * 60_000,
    'last-call': EVENT.close.getTime() - 12 * 60_000,
    closed: EVENT.close.getTime() + 500,
  }
  const phase = params.get('phase')
  if (phase && phase in phaseStart) return phaseStart[phase] - Date.now()
  return 0
}

/**
 * Crew clock override (A+B panel): the whole site runs on `real time + offset`, so moving the
 * clock moves everything at once — countdowns, phases, zoom, ceremony, closing. Persisted so a
 * refresh keeps it; a `?now=` in the URL still wins.
 */
const CLOCK_KEY = 'pletok:clock'
const urlClock = new URLSearchParams(window.location.search).has('now') || new URLSearchParams(window.location.search).has('phase')
let offset = (() => {
  if (urlClock) return initialOffset()
  try {
    const v = Number(localStorage.getItem(CLOCK_KEY))
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
})()
let now = Date.now() + offset
const listeners = new Set<() => void>()

/**
 * Manual override for the booth crew (A+B panel) — e.g. opening late or closing early.
 * Persisted so a refresh on the booth laptop keeps it.
 */
const FORCE_KEY = 'pletok:phase'
const PHASES: Phase[] = ['pre-open', 'open', 'last-call', 'closed']
let forced: Phase | null = (() => {
  try {
    const v = localStorage.getItem(FORCE_KEY) as Phase | null
    return v && PHASES.includes(v) ? v : null
  } catch {
    return null
  }
})()
let version = 0

export function setForcedPhase(p: Phase | null) {
  forced = p
  try {
    if (p) localStorage.setItem(FORCE_KEY, p)
    else localStorage.removeItem(FORCE_KEY)
  } catch {
    /* storage blocked — override still works for this session */
  }
  version++
  listeners.forEach((l) => l())
}

export const getForcedPhase = () => forced

/** Jump the site clock to `at` (epoch ms), or back to real time with null. Clears any forced phase so the clock decides. */
export function setClock(at: number | null) {
  offset = at === null ? 0 : at - Date.now()
  try {
    if (offset) localStorage.setItem(CLOCK_KEY, String(offset))
    else localStorage.removeItem(CLOCK_KEY)
  } catch {
    /* storage blocked — still works until refresh */
  }
  forced = null
  try {
    localStorage.removeItem(FORCE_KEY)
  } catch {
    /* ignore */
  }
  version++
  window.clearTimeout(timer)
  if (listeners.size) tick()
}
export const clockShifted = () => offset !== 0
export const nudgeClock = (ms: number) => setClock(Date.now() + offset + ms)
let timer: number | undefined

function tick() {
  now = Date.now() + offset
  listeners.forEach((l) => l())
  // Align ticks to the wall-clock second so digits flip together
  timer = window.setTimeout(tick, 1000 - ((Date.now() + offset) % 1000) + 5)
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) tick()
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) window.clearTimeout(timer)
  }
}

// snapshot changes when the clock ticks or the override changes
const getSnap = () => now + version * 1e-6

export function phaseAt(t: number): Phase {
  if (t < EVENT.open.getTime()) return 'pre-open'
  if (t >= EVENT.close.getTime()) return 'closed'
  if (t >= EVENT.close.getTime() - LAST_CALL_MS) return 'last-call'
  return 'open'
}

export interface EventClock {
  phase: Phase
  forced: boolean
  /** ms until the next milestone (open or close); 0 once closed */
  remaining: number
  /** calendar days (WIB) until opening day — 1 = tomorrow, 0 = today */
  daysAway: number
  now: number
}

export function useEventPhase(): EventClock {
  const t = Math.floor(useSyncExternalStore(subscribe, getSnap))
  // an early manual "open" hands control back to the clock once 13:00 actually arrives,
  // otherwise the closing at 16:00 would never trigger on its own
  if (forced === 'open' && phaseAt(t) !== 'pre-open') queueMicrotask(() => setForcedPhase(null))
  const phase = forced ?? phaseAt(t)
  const target = phase === 'pre-open' ? EVENT.open.getTime() : EVENT.close.getTime()
  const wibDay = (ms: number) => Math.floor((ms + 7 * 3600_000) / 86_400_000)
  return { phase, forced: forced !== null, remaining: Math.max(0, target - t), now: t, daysAway: wibDay(EVENT.open.getTime()) - wibDay(t) }
}

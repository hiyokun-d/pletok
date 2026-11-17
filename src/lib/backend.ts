/**
 * Talks to the Google Sheet backend (apps-script/Code.gs). Set VITE_BACKEND_URL to the
 * Apps Script web-app URL; without it everything still works locally and just waits.
 *
 * Nothing is lost on bad wifi: feedback goes into an outbox on the phone first and is
 * re-sent (every 15 s, when the connection comes back, and on the next visit) until the
 * Sheet confirms it. The Sheet skips duplicates by ID, so retries are safe.
 */
export const BACKEND: string | undefined = import.meta.env.VITE_BACKEND_URL || undefined

const OUTBOX = 'pletok:outbox'
type Payload = Record<string, unknown> & { type: string; id?: string }

const read = (): Payload[] => {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX) ?? '[]') as Payload[]
  } catch {
    return []
  }
}
const write = (q: Payload[]) => {
  try {
    localStorage.setItem(OUTBOX, JSON.stringify(q))
  } catch {
    /* storage blocked — the in-flight send is all we get */
  }
}

/** a plain-text POST is a "simple" request, so the browser skips the CORS preflight Apps Script can't answer */
async function post(p: Payload): Promise<boolean> {
  if (!BACKEND) return false
  try {
    const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify(p), keepalive: true })
    const j = (await r.json()) as { ok?: boolean }
    return !!j.ok
  } catch {
    return false
  }
}

let flushing = false
export async function flushOutbox() {
  if (flushing || !BACKEND) return
  flushing = true
  try {
    for (const p of read()) {
      if (!(await post(p))) break // offline or busy — keep the rest for the next try
      write(read().filter((q) => q.id !== p.id))
    }
  } finally {
    flushing = false
  }
}

export const pendingCount = () => read().length

/** queue it, then try to send right away */
export function enqueue(p: Payload) {
  write([...read().filter((q) => q.id !== p.id), p])
  return flushOutbox()
}

/** one QR scan — fire and forget, a lost scan isn't worth a queue */
export function logScan(target: 'link' | 'ig' | 'feedback') {
  if (BACKEND) void post({ type: 'scan', target, ua: navigator.userAgent })
}

export interface RemoteStats {
  feedbacks: number
  contacts: number
  rating: number | null
  favorite: string | null
  /** all drinks tied for most-loved (newer script versions) */
  favorites?: string[]
  qrBooth: number
  qrFeedback: number
  menu: { state: unknown; at: number } | null
  /** set from /hasil only; 'auto' = follow the schedule */
  feedbackMode?: 'auto' | 'open' | 'closed'
  preorder?: PreorderConfig
}

export async function fetchStats(): Promise<RemoteStats | null> {
  if (!BACKEND) return null
  try {
    return (await (await fetch(BACKEND)).json()) as RemoteStats
  } catch {
    return null
  }
}

/** crew-only writes (sold-out sync) carry the PIN typed into the A + C panel on that laptop */
const PIN_KEY = 'pletok:crew-pin'
export const crewPin = () => {
  try {
    return localStorage.getItem(PIN_KEY)
  } catch {
    return null
  }
}
export async function setCrewPin(pin: string | null): Promise<boolean> {
  if (pin === null) {
    localStorage.removeItem(PIN_KEY)
    return true
  }
  const ok = await post({ type: 'pin', pin })
  if (ok) localStorage.setItem(PIN_KEY, pin)
  return ok
}
export interface Response {
  at: number
  rating: number | null
  /** "Original, Yakult" — as written in the Sheet */
  favorites: string
  like: string
  wish: string
  question: string
  idea: string
  name: string
  contact: string
  consent: boolean
  source: string
}
export interface Results {
  sheetUrl: string
  orders?: Order[]
  responses: Response[]
  scans: Array<{ at: number; target: string }>
}

/** every answer, for the crew's /hasil page (needs the PIN) */
export async function fetchResults(pin: string): Promise<Results | 'pin' | null> {
  if (!BACKEND) return null
  try {
    const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify({ type: 'results', pin }) })
    const j = (await r.json()) as Results & { ok: boolean; error?: string }
    return j.ok ? j : j.error === 'pin' ? 'pin' : null
  } catch {
    return null
  }
}

/** admin switch for the feedback form (from /hasil) — the PIN is checked by the Sheet */
export async function setFeedbackModeRemote(pin: string, mode: 'auto' | 'open' | 'closed'): Promise<boolean> {
  if (!BACKEND) return false
  const ok = await post({ type: 'feedback-mode', pin, mode })
  if (ok) void pollOnce()
  return ok
}

/* ---------------------------------------------------------------- pre-order */

/** prices in thousands (18 = Rp18.000) — what's on sale is decided by the Sheet, set from /hasil */
export interface PreorderConfig {
  enabled: boolean
  /** epoch ms; orders close after this (default: end of 24 Nov WIB, H-1) */
  cutoff: number
  items: Record<string, { on: boolean; price: number }>
}
export interface Order {
  at: number
  code: string
  name: string
  wa: string
  summary: string
  total: number
  note: string
  done: boolean
  lines: Array<{ id: string; name: string; qty: number; price: number }>
}

/** a POST whose answer we need (the order code) — retried a few times on a flaky connection */
async function postJson<T>(p: Payload, tries = 3): Promise<(T & { ok: boolean; error?: string }) | null> {
  if (!BACKEND) return null
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify(p) })
      return (await r.json()) as T & { ok: boolean; error?: string }
    } catch {
      await new Promise((res) => window.setTimeout(res, 1200 * (i + 1)))
    }
  }
  return null
}

export function submitPreorder(order: { id: string; items: Array<{ id: string; qty: number }>; name: string; wa: string; note: string; hp: string }) {
  return postJson<{ code: string; total: number }>({ type: 'preorder', ...order })
}

export async function savePreorderConfig(pin: string, config: PreorderConfig): Promise<boolean> {
  const r = await postJson({ type: 'preorder-config', pin, config })
  if (r?.ok) void pollOnce()
  return !!r?.ok
}

export async function setOrderDone(pin: string, code: string, done: boolean): Promise<boolean> {
  const r = await postJson({ type: 'preorder-status', pin, code, done })
  return !!r?.ok
}

export const pushMenu = (state: unknown) => {
  const pin = crewPin()
  return pin ? post({ type: 'menu', pin, state }) : Promise.resolve(false)
}

/**
 * One shared poll for the whole page (closing stats + sold-out sync). The booth laptop asks
 * every 10 s, phones every 30 s, and nobody asks while the tab is hidden — a crowd of
 * phones stays far under Apps Script's limits (the script also caches for 10 s).
 */
const statSubs = new Set<(s: RemoteStats) => void>()
let lastStats: RemoteStats | null = null
let polling = false
async function pollOnce() {
  if (document.visibilityState === 'hidden') return
  const s = await fetchStats()
  if (!s) return
  lastStats = s
  statSubs.forEach((f) => f(s))
}
export function onStats(fn: (s: RemoteStats) => void) {
  statSubs.add(fn)
  if (lastStats) fn(lastStats)
  if (BACKEND && !polling) {
    polling = true
    void pollOnce()
    window.setInterval(pollOnce, window.matchMedia('(pointer: fine)').matches ? 10_000 : 30_000)
    document.addEventListener('visibilitychange', () => void pollOnce())
  }
  return () => {
    statSubs.delete(fn)
  }
}

if (typeof window !== 'undefined' && BACKEND) {
  window.addEventListener('online', () => void flushOutbox())
  window.setInterval(() => void flushOutbox(), 15_000)
  void flushOutbox()
}

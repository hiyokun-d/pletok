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
// anything with a PIN tells the Sheet which device sent it — a wrong PIN lands in the "Keamanan" tab
const withUa = (p: Payload) => ('pin' in p ? { ...p, ua: navigator.userAgent } : p)

async function post(p: Payload): Promise<boolean> {
  if (!BACKEND) return false
  try {
    const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify(withUa(p)), keepalive: true })
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
  /** first-N promo slots already taken */
  promoUsed?: number
}

export async function fetchStats(): Promise<RemoteStats | null> {
  if (!BACKEND) return null
  // a crowd-drowned network can hang a request for minutes — give up and count it as a miss
  const abort = new AbortController()
  const t = window.setTimeout(() => abort.abort(), 15_000)
  try {
    return (await (await fetch(BACKEND, { signal: abort.signal })).json()) as RemoteStats
  } catch {
    return null
  } finally {
    window.clearTimeout(t)
  }
}

/** crew-only writes (menu, admin) carry the PIN entered on /hasil on that device */
const PIN_KEY = 'pletok:crew-pin'
export const crewPin = () => {
  try {
    return localStorage.getItem(PIN_KEY)
  } catch {
    return null
  }
}
/** checks the PIN with the Sheet (one PIN for every crew page); remembers it on this device */
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
export interface SecurityEvent {
  at: number
  what: string
  from: string
  ua: string
  detail: string
}
export interface Results {
  sheetUrl: string
  /** who holds each pot of money — written on /hasil */
  money?: MoneyHolders
  /** newest first: wrong PINs and visits to the fake /admin */
  security?: SecurityEvent[]
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
  /** where customers transfer to — set on /config */
  bca?: { number: string; holder: string }
  /** "first N orders" discount — the Sheet decides who gets it when the order is written */
  promo?: Promo
}
export interface Promo {
  on: boolean
  slots: number
  /** rp = flat thousands off each order · pct = percent of the order */
  mode: 'rp' | 'pct'
  value: number
}
/** the discount (thousands) an order of `total` would get — same rule as promoFor_ in Code.gs */
export const promoOff = (p: Promo | undefined, total: number) => (!p?.on || !p.value || !total ? 0 : Math.max(0, Math.min(p.mode === 'pct' ? Math.round((total * p.value) / 100) : p.value, total - 1)))
/** hold = waiting for an admin to find the transfer · process = verified, has its pickup code */
export type OrderStatus = 'hold' | 'process' | 'done' | 'rejected'
export interface Order {
  at: number
  /** pickup code — empty until verified */
  code: string
  id: string
  name: string
  wa: string
  summary: string
  total: number
  note: string
  status: OrderStatus
  lines: Array<{ id: string; name: string; qty: number; price: number }>
  pay: string
  /** name on the sender's bank account, to match the transfer */
  sender: string
  /** an admin sent the code on WhatsApp */
  sent: boolean
  /** the customer's private "kode cek" for finding the order on any phone */
  ref: string
  /** Drive link of the transfer screenshot ('' = none yet) */
  proof: string
  /** first-N promo discount (thousands), already taken off `total` */
  promo?: number
}
/** what a customer's phone gets back about its own order */
export interface PublicOrder {
  id: string
  ref: string
  status: OrderStatus
  /** empty until paid */
  code: string
  total: number
  name: string
  at: number
  lines: Array<{ id: string; name: string; qty: number; price: number }>
  /** a transfer screenshot is uploaded */
  proof: boolean
  /** BCA transfer or QRIS (older Sheet: missing → BCA) */
  pay?: PreorderPay
  /** first-N promo discount (thousands), already taken off `total` */
  promo?: number
}

/** a POST whose answer we need (the order code) — retried a few times on a flaky connection */
async function postJson<T>(p: Payload, tries = 3): Promise<(T & { ok: boolean; error?: string }) | null> {
  if (!BACKEND) return null
  for (let i = 0; i < tries; i++) {
    try {
      const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify(withUa(p)) })
      return (await r.json()) as T & { ok: boolean; error?: string }
    } catch {
      await new Promise((res) => window.setTimeout(res, 1200 * (i + 1)))
    }
  }
  return null
}

export function submitPreorder(order: { id: string; items: Array<{ id: string; qty: number }>; name: string; wa: string; note: string; hp: string }) {
  return postJson<{ status: OrderStatus; total: number; ref: string; promo?: number; promoWhy?: '' | 'off' | 'full' | 'used' }>({ type: 'preorder', ...order })
}

/** the customer's own orders, by their private ids — the code only comes back once verified */
export async function lookupOrders(ids: string[]) {
  const r = await postJson<{ orders: PublicOrder[] }>({ type: 'preorder-lookup', ids }, 1)
  return r?.ok ? r.orders : null
}

/** the transfer screenshot (already shrunk to a JPEG data URL) — the Sheet names it after the customer */
export async function uploadProof(id: string, image: string): Promise<boolean> {
  const r = await postJson({ type: 'preorder-proof', id, image }, 2)
  return !!r?.ok
}

/** admin: the screenshot itself, fetched with the PIN (the Drive file stays private) */
export async function fetchProof(pin: string, id: string) {
  const r = await postJson<{ image: string; name: string; url: string }>({ type: 'preorder-proof-get', pin, id }, 2)
  return r?.ok ? r : null
}

/** "Cek pesanan" on any phone: the kode cek or pickup code alone, or WhatsApp number + name */
export async function findOrders(q: { ref: string } | { wa: string; name: string }) {
  const r = await postJson<{ orders: PublicOrder[] }>({ type: 'preorder-find', ...q })
  return r?.ok ? r.orders : null
}

export async function savePreorderConfig(pin: string, config: PreorderConfig): Promise<boolean> {
  const r = await postJson({ type: 'preorder-config', pin, config })
  if (r?.ok) void pollOnce()
  return !!r?.ok
}

export type WipeTarget = 'orders' | 'booth' | 'feedback' | 'scans' | 'security' | 'proofs'
/** admin: clear test data — the Sheet backs each tab up first; returns how many were removed */
export async function wipeData(pin: string, what: WipeTarget[]) {
  const r = await postJson<{ done: Partial<Record<WipeTarget, number>> }>({ type: 'wipe', pin, what }, 1)
  return r?.ok ? r.done : null
}

/** how a pre-order was paid — the customer picks it on the hold screen, an admin can correct it */
export type PreorderPay = 'BCA' | 'QRIS'
/** the customer switched between BCA and QRIS while it's on hold — fire and forget */
export function setPreorderPay(id: string, pay: PreorderPay) {
  void postJson({ type: 'preorder-pay', id, pay }, 2)
}

/** the crew member who holds each pot: the BCA account, the GoPay Merchant (QRIS), the cash box */
export interface MoneyHolders {
  bca: string
  qris: string
  tunai: string
}
export async function saveMoneyHolders(pin: string, money: MoneyHolders): Promise<boolean> {
  return !!(await postJson({ type: 'money-holders', pin, money }, 2))?.ok
}

/** admin: move an order along (verifying hands out its code) and/or mark the code as sent */
export async function updateOrder(pin: string, id: string, patch: { status?: OrderStatus; sent?: boolean; pay?: PreorderPay }): Promise<boolean> {
  const r = await postJson({ type: 'preorder-status', pin, id, ...patch })
  return !!r?.ok
}

export const pushMenu = (state: unknown) => {
  // dev /hasil?demo never touches the real menu
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')) return Promise.resolve(true)
  const pin = crewPin()
  return pin ? post({ type: 'menu', pin, state }) : Promise.resolve(false)
}

/**
 * One shared poll for the whole page (closing stats + sold-out sync). The booth laptop asks
 * every 10 s, phones every 30 s, and nobody asks while the tab is hidden — a crowd of
 * phones stays far under Apps Script's limits (the script also caches for 10 s).
 */
const statSubs = new Set<(s: RemoteStats) => void>()
/** how the last poll went — the real signal at the booth, not what the phone's bars claim */
export interface NetState {
  ok: boolean
  /** round trip to the Sheet in ms (null when it failed) */
  rtt: number | null
  /** 0 = not measured yet */
  at: number
}
let net: NetState = { ok: true, rtt: null, at: 0 }
const netSubs = new Set<() => void>()
export const netState = () => net
export const onNet = (f: () => void) => {
  netSubs.add(f)
  return () => void netSubs.delete(f)
}
let lastStats: RemoteStats | null = null
let polling = false
async function pollOnce() {
  if (document.visibilityState === 'hidden') return
  const t0 = performance.now()
  const s = await fetchStats()
  net = { ok: !!s, rtt: s ? performance.now() - t0 : null, at: Date.now() }
  netSubs.forEach((f) => f())
  if (!s) return
  lastStats = s
  statSubs.forEach((f) => f(s))
}
// something live on screen (the promo slots counting down) asks for quicker checks; the Sheet
// answers from a 10 s cache, so this costs a fetch, not a Sheet read
let fast = 0
export function fastStats() {
  fast++
  return () => void fast--
}
const every = () => (fast > 0 ? 8_000 : window.matchMedia('(pointer: fine)').matches ? 10_000 : 30_000)
let lastPoll = 0
function loop() {
  window.setTimeout(() => {
    if (Date.now() - lastPoll >= every() - 500) {
      lastPoll = Date.now()
      void pollOnce()
    }
    loop()
  }, 2_000)
}
export function onStats(fn: (s: RemoteStats) => void) {
  statSubs.add(fn)
  if (lastStats) fn(lastStats)
  if (BACKEND && !polling) {
    polling = true
    lastPoll = Date.now()
    void pollOnce()
    loop()
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

/* ---------------------------------------------------------------- booth: /cashier and /pickup */

/** a line as the booth sells it — `drinks` are the cups to make (a bundle has 2–3) */
export interface BoothLine {
  id: string
  name: string
  qty: number
  price: number
  drinks: string[]
}
/** one paid order in the pickup queue: a verified pre-order ('po') or a walk-in sale ('booth') */
export interface QueueOrder {
  src: 'po' | 'booth'
  id: string
  code: string
  name: string
  at: number
  total: number
  pay: string
  note: string
  done: boolean
  lines: Array<{ id: string; name: string; qty: number; price: number; drinks?: string[] }>
}

export async function fetchQueue(pin: string): Promise<QueueOrder[] | 'pin' | null> {
  const r = await postJson<{ orders: QueueOrder[] }>({ type: 'queue', pin }, 1)
  return r?.ok ? r.orders : r?.error === 'pin' ? 'pin' : null
}

export type BoothPay = 'tunai' | 'qris' | 'bca'
/** a walk-in sale; the id makes a retry safe (same sale, same code) */
export async function sendBoothOrder(pin: string, order: { id: string; lines: BoothLine[]; pay: BoothPay; name: string; note: string }) {
  const r = await postJson<{ code: string }>({ type: 'booth-order', pin, ...order })
  return r?.ok ? r.code : r?.error === 'pin' ? ('pin' as const) : null
}

export async function voidBoothOrder(pin: string, id: string) {
  return !!(await postJson({ type: 'booth-void', pin, id }, 2))?.ok
}

export async function markPickedUp(pin: string, src: QueueOrder['src'], id: string, done: boolean) {
  return !!(await postJson({ type: 'pickup', pin, src, id, done }, 2))?.ok
}

/** the fake /admin page reports itself — fire and forget */
export function reportTrap(path: string, tries: number) {
  if (!BACKEND) return
  void fetch(BACKEND, { method: 'POST', body: JSON.stringify({ type: 'trap', path, tries, ua: navigator.userAgent }), keepalive: true }).catch(() => {})
}

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

/* ---------------------------------------------------------------- health: is the Sheet answering?
 * Every request reports in. Two misses in a row while the phone is online = the Sheet is down:
 * the status bar tells customers their data is safe on the phone, crew pages turn red. The first
 * answer after that = recovered: the outboxes flush, and the phone tells the Sheet how long it was
 * gone (logged in "Keamanan", emailed to the admins) — so an outage never goes unnoticed. */
const DOWN_AFTER = 2
export interface Health {
  offline: boolean
  /** the Sheet missed DOWN_AFTER times in a row while the phone had internet */
  down: boolean
  /** first miss of the current streak */
  since: number | null
  fails: number
  /** when it last came back (0 = never went down) */
  recoveredAt: number
}
let hp = { fails: 0, serverFails: 0, since: null as number | null, recoveredAt: 0 }
const isOffline = () => typeof navigator !== 'undefined' && !navigator.onLine
let healthSnap: Health = { offline: isOffline(), down: false, since: null, fails: 0, recoveredAt: 0 }
const healthSubs = new Set<() => void>()
const emitHealth = () => {
  healthSnap = { offline: isOffline(), down: hp.serverFails >= DOWN_AFTER, since: hp.since, fails: hp.fails, recoveredAt: hp.recoveredAt }
  healthSubs.forEach((f) => f())
}
export const health = () => healthSnap
export const onHealth = (f: () => void) => {
  healthSubs.add(f)
  return () => void healthSubs.delete(f)
}
/** answers that are a normal "no" (wrong PIN, pre-order closed…) — the Sheet is fine */
const EXPECTED = ['pin', 'closed', 'empty', 'contact', 'id', 'status', 'image', 'size', 'none', 'type', 'mode', 'input', 'proof', 'taken']
/** did the Sheet itself work? A crash ("Exception: …") or "busy" counts as a miss */
const sheetOk = (j: { ok?: boolean; error?: string } | null) => !!j && (!!j.ok || EXPECTED.includes(String(j.error)))
function reportHealth(ok: boolean) {
  if (ok) {
    const wasDown = hp.serverFails >= DOWN_AFTER
    const since = hp.since
    const fails = hp.fails
    hp = { fails: 0, serverFails: 0, since: null, recoveredAt: wasDown ? Date.now() : hp.recoveredAt }
    emitHealth()
    if (wasDown && since) {
      // self-recovery: send what waited, wake whoever has a queue of their own, and report the outage
      void flushOutbox()
      window.dispatchEvent(new Event('pletok:recovered'))
      void post({ type: 'incident', page: location.pathname, downFor: Date.now() - since, fails, ua: navigator.userAgent })
    }
    return
  }
  hp.fails++
  hp.since ??= Date.now()
  if (!isOffline()) hp.serverFails++
  emitHealth()
}
if (typeof window !== 'undefined') {
  window.addEventListener('online', emitHealth)
  window.addEventListener('offline', emitHealth)
}

/** a plain-text POST is a "simple" request, so the browser skips the CORS preflight Apps Script can't answer */
// anything with a PIN tells the Sheet which device sent it — a wrong PIN lands in the "Keamanan" tab
const withUa = (p: Payload) => ('pin' in p ? { ...p, ua: navigator.userAgent } : p)

/** 'ok' · 'no' = the Sheet answered and refused (wrong PIN, closed…) — retrying won't help · 'down' = no usable answer */
async function send(p: Payload): Promise<'ok' | 'no' | 'down'> {
  if (!BACKEND) return 'down'
  try {
    const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify(withUa(p)), keepalive: true })
    const j = (await r.json()) as { ok?: boolean; error?: string }
    if (p.type !== 'incident') reportHealth(sheetOk(j))
    return j.ok ? 'ok' : sheetOk(j) ? 'no' : 'down'
  } catch {
    if (p.type !== 'incident') reportHealth(false)
    return 'down'
  }
}
const post = async (p: Payload) => (await send(p)) === 'ok'

let flushing = false
export async function flushOutbox() {
  if (flushing || !BACKEND) return
  flushing = true
  try {
    for (const p of read()) {
      const r = await send(p)
      if (r === 'down') break // offline or the Sheet is down — keep the rest for the next try
      // sent, or refused for good (it would block everything behind it forever)
      write(read().filter((q) => !same(q, p)))
    }
  } finally {
    flushing = false
  }
}

export const pendingCount = () => read().length

/** one entry per kind of thing per id: a sale and its pickup share an id but are different entries */
const same = (a: Payload, b: Payload) => a.id === b.id && a.type === b.type && a.src === b.src && !!a.ready === !!b.ready
/** queue it, then try to send right away (order kept: a sale queued before its pickup lands first) */
export function enqueue(p: Payload) {
  write([...read().filter((q) => !same(q, p)), p])
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

/* the last good stats live on the phone too: when the Sheet is down the menu, prices and the
   pre-order settings still load (from the last time it answered) instead of an error page */
const STATS_KEY = 'pletok:stats'
function saveStats(s: RemoteStats) {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify({ s, at: Date.now() }))
  } catch {
    /* storage blocked */
  }
}
/** the saved stats and when they were fresh — null on a phone that never reached the Sheet */
export function cachedStats(): { s: RemoteStats; at: number } | null {
  try {
    const v = JSON.parse(localStorage.getItem(STATS_KEY) ?? 'null') as { s: RemoteStats; at: number } | null
    // older than 3 days is a different week's menu — don't pretend
    return v && Date.now() - v.at < 3 * 86_400_000 ? v : null
  } catch {
    return null
  }
}

export async function fetchStats(): Promise<RemoteStats | null> {
  if (!BACKEND) return null
  // a crowd-drowned network can hang a request for minutes — give up and count it as a miss
  const abort = new AbortController()
  const t = window.setTimeout(() => abort.abort(), 15_000)
  try {
    const s = (await (await fetch(BACKEND, { signal: abort.signal })).json()) as RemoteStats & { error?: string }
    // the Sheet crashed with nothing saved to fall back on → it's a JSON error, still a miss
    if (s.error) throw new Error(s.error)
    reportHealth(true)
    saveStats(s)
    return s
  } catch {
    reportHealth(false)
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
    // signed out: the customer data kept for quick page loads goes with it
    Object.values(WARM).forEach((k) => localStorage.removeItem(k))
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
  /** /financial: costs, HPP, target, crew — null until someone saves it */
  finance?: FinanceConfig | null
  /** /financial: what each pot actually held when counted at closing */
  closing?: Partial<Record<'tunai' | 'bca' | 'qris', ClosingCount>>
  responses: Response[]
  scans: Array<{ at: number; target: string }>
}

/*
 * Crew data kept warm. Every crew page preloads the queue and the results in the background
 * (main.tsx), so the page opened next — even in a new tab — starts on a copy that's seconds old
 * instead of a spinner, then refreshes. Kept on the crew phone only (it's behind the PIN, like the
 * pickup cache); a copy older than 12 h — yesterday's, a test run — is ignored.
 */
const WARM = { queue: 'pletok:warm-queue', results: 'pletok:warm-results' } as const
const WARM_MAX_MS = 12 * 3_600_000
export function warm<K extends keyof typeof WARM>(k: K): { at: number; data: K extends 'queue' ? QueueOrder[] : Results } | null {
  try {
    const w = JSON.parse(localStorage.getItem(WARM[k]) ?? 'null')
    return w && Date.now() - w.at < WARM_MAX_MS ? w : null
  } catch {
    return null
  }
}
const keepWarm = (k: keyof typeof WARM, data: unknown) => {
  try {
    localStorage.setItem(WARM[k], JSON.stringify({ at: Date.now(), data }))
  } catch {
    /* full or blocked — the page still loads it live */
  }
}
// a page and the preloader asking at the same moment share one request (only while it's running,
// so a load right after a save never gets an answer from before the save)
const running = new Map<string, Promise<unknown>>()
function once<T>(key: string, run: () => Promise<T>): Promise<T> {
  const had = running.get(key)
  if (had) return had as Promise<T>
  const p = run().finally(() => running.delete(key))
  running.set(key, p)
  return p
}

/** every answer, for the crew's /hasil page (needs the PIN) */
export function fetchResults(pin: string): Promise<Results | 'pin' | null> {
  return once(`results:${pin}`, () => loadResults(pin))
}
async function loadResults(pin: string): Promise<Results | 'pin' | null> {
  if (!BACKEND) return null
  try {
    const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify({ type: 'results', pin }) })
    const j = (await r.json()) as Results & { ok: boolean; error?: string }
    reportHealth(sheetOk(j))
    if (j.ok) keepWarm('results', j)
    return j.ok ? j : j.error === 'pin' ? 'pin' : null
  } catch {
    reportHealth(false)
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
  /** last 4 digits of the WhatsApp number it was ordered with — the other pickup proof */
  wa4?: string
}

/** a POST whose answer we need (the order code) — retried a few times on a flaky connection */
async function postJson<T>(p: Payload, tries = 3): Promise<(T & { ok: boolean; error?: string }) | null> {
  if (!BACKEND) return null
  let last: (T & { ok: boolean; error?: string }) | null = null
  for (let i = 0; i < tries; i++) {
    // a crowd-drowned network can hang a request for minutes; the Sheet itself may wait ~25 s for its lock
    const abort = new AbortController()
    const t = window.setTimeout(() => abort.abort(), 30_000)
    try {
      const r = await fetch(BACKEND, { method: 'POST', body: JSON.stringify(withUa(p)), signal: abort.signal })
      last = (await r.json()) as T & { ok: boolean; error?: string }
      reportHealth(sheetOk(last))
      // a crash or "busy" is worth another go, like a dropped connection; a plain "no" isn't
      if (sheetOk(last)) return last
    } catch {
      reportHealth(false)
    } finally {
      window.clearTimeout(t)
    }
    if (i < tries - 1) await new Promise((res) => window.setTimeout(res, 1200 * (i + 1)))
  }
  return last
}

/** answers that mean "this order will never go in" — anything else (no answer, a crash) is worth queueing */
export const FINAL_PREORDER_ERRORS = ['closed', 'empty', 'contact']
/** `queuedAt`: when the customer pressed send — an order that waited on the phone through an outage */
export function submitPreorder(order: { id: string; items: Array<{ id: string; qty: number }>; name: string; wa: string; note: string; hp: string; queuedAt?: number }) {
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
/* ---------------------------------------------------------------- /financial
 * All money here is in full rupiah (like BEC_VENTURE), unlike order totals (thousands). Kept as
 * script properties in Code.gs — the Sheet gets no extra tab. */
export interface CostLine {
  name: string
  /** full rupiah */
  amount: number
  /** "7 Liter × 45.000" — how it was bought, for the report */
  detail?: string
  /** who paid it out of their own pocket ('' = from the team's money) */
  by?: string
}
export interface FinanceConfig {
  /** cost of one cup, full rupiah — cup + ingredients (BEC_VENTURE "HPP") */
  hpp: Record<string, number>
  /** stock bought for the day (BEC_VENTURE "MODAL") */
  modal: CostLine[]
  /** everything else: banner, sticker, table cloth, prototypes (BEC_VENTURE "Quotation") */
  ops: CostLine[]
  /** the plan: cups and omzet (full rupiah) */
  target: { cups: number; omzet: number }
  /** who shares the profit at the end ([] = it stays in the team's money) */
  crew: string[]
  at?: number
}
export interface ClosingCount {
  /** full rupiah */
  counted: number
  by: string
  at: number
}
export async function saveFinance(pin: string, finance: FinanceConfig): Promise<boolean> {
  return !!(await postJson({ type: 'finance', pin, finance: { ...finance, at: Date.now() } }, 2))?.ok
}
/** `counted: null` clears that pot's count */
export async function saveClosing(pin: string, pot: 'tunai' | 'bca' | 'qris', counted: number | null, by: string) {
  const r = await postJson<{ closing: Results['closing'] }>({ type: 'closing', pin, pot, counted, by }, 2)
  return r?.ok ? (r.closing ?? {}) : null
}
export async function makeFinanceReport(pin: string, title: string, sections: Array<{ heading: string; note?: string; rows: string[][] }>) {
  const r = await postJson<{ url: string }>({ type: 'finance-report', pin, title, sections }, 1)
  return r?.ok ? r.url : null
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
  if (!lastStats) lastStats = cachedStats()?.s ?? null
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
  /** pre-orders: hashes of the pickup proofs (kode cek / last 4 WA digits) — check with proofMatches */
  vref?: string
  vwa?: string
  /** pre-orders: how it was verified when handed over ("kode cek · 14.05") */
  pickedBy?: string
  /** booth sales: the kode cek on the buyer's receipt page, to compare at pickup */
  ref?: string
  /** booth sales: the barista called it — the buyer's receipt page is ringing */
  ready?: boolean
  readyAt?: number
}

export function fetchQueue(pin: string): Promise<QueueOrder[] | 'pin' | null> {
  return once(`queue:${pin}`, async () => {
    const r = await postJson<{ orders: QueueOrder[] }>({ type: 'queue', pin }, 1)
    if (r?.ok) keepWarm('queue', r.orders)
    return r?.ok ? r.orders : r?.error === 'pin' ? 'pin' : null
  })
}

export type BoothPay = 'tunai' | 'qris' | 'bca'
/** a walk-in sale; the id makes a retry safe (same sale, same code) */
export async function sendBoothOrder(pin: string, order: { id: string; lines: BoothLine[]; pay: BoothPay; name: string; note: string }) {
  const r = await postJson<{ code: string }>({ type: 'booth-order', pin, ...order })
  return r?.ok ? r.code : r?.error === 'pin' ? ('pin' as const) : null
}

/** which of these booth sales the Sheet already has: id → its code and status (diproses / selesai / batal) */
export async function checkBoothOrders(pin: string, ids: string[]) {
  const r = await postJson<{ found: Record<string, { code: string; status: string }> }>({ type: 'booth-check', pin, ids }, 2)
  return r?.ok ? r.found : r?.error === 'pin' ? ('pin' as const) : null
}

/** "siap": the drink is ready — the buyer's receipt page (/r/<id>) rings */
export async function markReady(pin: string, id: string) {
  return !!(await postJson({ type: 'pickup', pin, src: 'booth', id, ready: true }, 2))?.ok
}

/** a booth sale's live receipt — everything comes from the Sheet, the QR only carries the id */
export interface BoothReceipt {
  code: string
  ref: string
  name: string
  at: number
  total: number
  pay: string
  lines: Array<{ name: string; qty: number; price: number }>
  status: 'process' | 'ready' | 'done' | 'void'
  readyAt: number
  doneAt: number
}
/** null = no answer (try again) · 'none' = the Sheet doesn't have this sale (yet) */
export async function fetchReceipt(id: string): Promise<BoothReceipt | 'none' | null> {
  if (!BACKEND) return null
  const abort = new AbortController()
  const t = window.setTimeout(() => abort.abort(), 15_000)
  try {
    const r = (await (await fetch(`${BACKEND}?r=${encodeURIComponent(id)}`, { signal: abort.signal })).json()) as { ok: boolean; receipt?: BoothReceipt }
    reportHealth(true)
    return r.ok && r.receipt ? r.receipt : 'none'
  } catch {
    reportHealth(false)
    return null
  } finally {
    window.clearTimeout(t)
  }
}

export async function voidBoothOrder(pin: string, id: string) {
  return !!(await postJson({ type: 'booth-void', pin, id }, 2))?.ok
}

const normProof = (t: string) => t.toUpperCase().replace(/[^A-Z0-9]/g, '')
const sha256 = async (t: string) =>
  [...new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(t)))].map((b) => b.toString(16).padStart(2, '0')).join('')
/** does what the customer showed / said match this pre-order? Checked on the device — works offline */
export async function proofMatches(o: QueueOrder, typed: string): Promise<'kode cek' | '4 digit WA' | null | 'unknown'> {
  if (!o.vref && !o.vwa) return 'unknown' // an older Sheet that doesn't send the hashes — it checks itself
  const p = normProof(typed)
  if (!p) return null
  if (o.vref && (await sha256(`${o.id}:${p}`)) === o.vref) return 'kode cek'
  if (o.vwa && /^\d{4}$/.test(p) && (await sha256(`${o.id}:${p}`)) === o.vwa) return '4 digit WA'
  return null
}
/** hand a pre-order over: with its proof, or `manual` (a reason) — the Sheet checks again and refuses a second pickup */
export async function pickUpPreorder(pin: string, id: string, proof: { proof?: string; manual?: string }) {
  const r = await postJson<{ by?: string }>({ type: 'pickup', pin, src: 'po', id, done: true, ...proof }, 2)
  return r ? { ok: r.ok, error: r.error, by: r.by } : null
}

export async function markPickedUp(pin: string, src: QueueOrder['src'], id: string, done: boolean) {
  return !!(await postJson({ type: 'pickup', pin, src, id, done }, 2))?.ok
}

/** the fake /admin page reports itself — fire and forget */
export function reportTrap(path: string, tries: number) {
  if (!BACKEND) return
  void fetch(BACKEND, { method: 'POST', body: JSON.stringify({ type: 'trap', path, tries, ua: navigator.userAgent }), keepalive: true }).catch(() => {})
}

import { enqueue, type QueueOrder } from './backend'
import { ledger, onLedger } from './boothLedger'
import { PAY_LABEL, asQueueOrder, tempCode, type PackedSale } from './saleCode'

/*
 * What a crew phone knows on its own, for when the Sheet can't be reached (venue wifi gone, Apps
 * Script down). /pickup keeps working from this:
 *   - the last queue it saw (with each pre-order's proof hashes, so hand-overs still check offline)
 *   - booth sales that reached it without the Sheet: scanned off a buyer's struk QR, or rung up on
 *     /cashier in another tab of this same phone
 *   - its own taps ("Diambil", "Siap") until the Sheet has them
 * Every phone holding a sale also delivers it: the sale goes in the outbox before its pickup, so
 * whichever crew phone gets signal first puts both in the Sheet (same id → never twice).
 */

const SALES = 'pletok:crew-sales'
const CACHE = 'pletok:pickup-cache'
const MARKS = 'pletok:pickup-marks'
const KEEP_MS = 2 * 86_400_000

const get = <T,>(k: string, fallback: T): T => {
  try {
    return (JSON.parse(localStorage.getItem(k) ?? 'null') as T) ?? fallback
  } catch {
    return fallback
  }
}
const put = (k: string, v: unknown) => {
  try {
    localStorage.setItem(k, JSON.stringify(v))
  } catch {
    /* storage blocked — it still works while the page stays open */
  }
  notify()
}

const subs = new Set<() => void>()
const notify = () => subs.forEach((f) => f())
/** changes from this tab, other tabs (storage event) and this phone's cashier log */
export function onCrewLocal(f: () => void) {
  subs.add(f)
  const onStorage = (e: StorageEvent) => [SALES, CACHE, MARKS].includes(e.key ?? '') && f()
  window.addEventListener('storage', onStorage)
  const off = onLedger(f)
  return () => {
    subs.delete(f)
    window.removeEventListener('storage', onStorage)
    off()
  }
}

/* ---------------------------------------------------------------- the last queue seen */

export const cachedQueue = () => get<{ at: number; orders: QueueOrder[] } | null>(CACHE, null)
export const saveQueue = (orders: QueueOrder[]) => put(CACHE, { at: Date.now(), orders })

/* ---------------------------------------------------------------- sales that reached this phone without the Sheet */

type Held = PackedSale & { addedAt: number }
const heldSales = () => get<Held[]>(SALES, []).filter((s) => Date.now() - s.addedAt < KEEP_MS)

/** a sale scanned off a struk: into this phone's queue, and on its way to the Sheet */
export function holdSale(pin: string, s: PackedSale) {
  put(SALES, [...heldSales().filter((x) => x.id !== s.id), { ...s, addedAt: Date.now() }])
  void enqueue({ type: 'booth-order', pin, id: s.id, lines: s.lines, pay: s.pay, name: s.name, note: 'masuk lewat scan struk (offline)' })
}

/** the booth sales this phone knows about that the Sheet hasn't shown yet */
export function localSales(): Array<QueueOrder & { via: 'scan' | 'kasir' }> {
  const fromLedger = ledger()
    .filter((s) => s.state === 'pending')
    .map((s) => ({ src: 'booth' as const, id: s.id, code: tempCode(s.id), name: s.name, at: s.at, total: s.total, pay: PAY_LABEL[s.pay], note: '', done: false, lines: s.lines, via: 'kasir' as const }))
  const scanned = heldSales().map((s) => ({ ...asQueueOrder(s), via: 'scan' as const }))
  const ids = new Set(fromLedger.map((s) => s.id))
  return [...fromLedger, ...scanned.filter((s) => !ids.has(s.id))]
}

/** the Sheet has these now — the local copies can go */
export function forgetSales(ids: Set<string>) {
  const held = heldSales()
  const left = held.filter((s) => !ids.has(s.id))
  if (left.length !== held.length) put(SALES, left)
}

/* ---------------------------------------------------------------- this phone's taps */

export interface Mark {
  done?: boolean
  ready?: boolean
  at: number
  /** pre-orders: how it was checked ("kode cek · 14.05") */
  by?: string
}
export const marks = () => get<Record<string, Mark>>(MARKS, {})
export function setMark(id: string, m: Partial<Mark>) {
  put(MARKS, { ...marks(), [id]: { ...marks()[id], ...m, at: Date.now() } })
}
/** drops the taps the Sheet already agrees with */
export function settleMarks(orders: QueueOrder[]) {
  const all = marks()
  let changed = false
  for (const o of orders) {
    const m = all[o.id]
    if (!m) continue
    const doneOk = m.done === undefined || m.done === o.done
    const readyOk = !m.ready || o.ready || o.done
    if (doneOk && readyOk) {
      delete all[o.id]
      changed = true
    }
  }
  // a day-old tap is either in by now or about something that's gone
  for (const [id, m] of Object.entries(all))
    if (Date.now() - m.at > KEEP_MS) {
      delete all[id]
      changed = true
    }
  if (changed) put(MARKS, all)
}

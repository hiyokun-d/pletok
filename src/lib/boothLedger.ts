import { checkBoothOrders, sendBoothOrder, type BoothLine, type BoothPay } from './backend'

/*
 * The cashier phone's own log of every sale — written BEFORE anything goes over the network, so a
 * sale exists the moment "Lunas" is tapped, whatever the Sheet is doing. Then:
 *   sync      — sends what the Sheet hasn't confirmed yet (each sale keeps its id, and the Sheet
 *               skips an id it already has, so sending twice can never make two sales)
 *   reconcile — asks the Sheet which of these ids it really has: found → marked in (with the
 *               Sheet's code), missing → sent again, cancelled there → left alone
 * Kept for 2 days on this phone; downloadable as CSV as the last-resort backup.
 */

export interface LedgerSale {
  id: string
  at: number
  lines: BoothLine[]
  pay: BoothPay
  name: string
  total: number
  /** B-001 once the Sheet has it */
  code: string
  /** pending = only on this phone · sent = the Sheet has it · void = cancelled */
  state: 'pending' | 'sent' | 'void'
}

const KEY = 'pletok:kasir-ledger'
const KEEP_MS = 2 * 86_400_000
const subs = new Set<() => void>()
let snap: LedgerSale[] = read()

function read(): LedgerSale[] {
  try {
    return (JSON.parse(localStorage.getItem(KEY) ?? '[]') as LedgerSale[]).filter((s) => Date.now() - s.at < KEEP_MS)
  } catch {
    return []
  }
}
function write(sales: LedgerSale[]) {
  snap = sales
  try {
    localStorage.setItem(KEY, JSON.stringify(sales))
  } catch {
    /* storage blocked — the in-memory copy still syncs while the page is open */
  }
  subs.forEach((f) => f())
}
const patch = (id: string, p: Partial<LedgerSale>) => write(read().map((s) => (s.id === id ? { ...s, ...p } : s)))

export const ledger = () => snap
export const onLedger = (f: () => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}

/** step one of every sale: on the phone first */
export function record(sale: Omit<LedgerSale, 'code' | 'state'>) {
  write([...read().filter((s) => s.id !== sale.id), { ...sale, code: '', state: 'pending' }])
}
export const markSent = (id: string, code: string) => patch(id, { state: 'sent', code })
export const markVoid = (id: string) => patch(id, { state: 'void' })

let syncing = false
/** send everything still pending, oldest first; stops at the first miss (the Sheet's still down) */
export async function sync(pin: string): Promise<'pin' | number> {
  if (syncing) return 0
  syncing = true
  let sent = 0
  try {
    for (const s of read().filter((x) => x.state === 'pending').sort((a, b) => a.at - b.at)) {
      const r = await sendBoothOrder(pin, { id: s.id, lines: s.lines, pay: s.pay, name: s.name, note: '' })
      if (r === 'pin') return 'pin'
      if (!r) break
      markSent(s.id, r)
      sent++
    }
  } finally {
    syncing = false
  }
  return sent
}

export interface Reconciled {
  at: number
  /** the Sheet has it */
  matched: number
  /** the Sheet didn't — sent again */
  resent: number
  /** still couldn't get in (the Sheet went quiet again) */
  left: number
}
/** "did we already send this?" — the Sheet's answer decides, not this phone's memory */
export async function reconcile(pin: string): Promise<Reconciled | 'pin' | null> {
  const all = read().filter((s) => s.state !== 'void')
  if (!all.length) return { at: Date.now(), matched: 0, resent: 0, left: 0 }
  const found = await checkBoothOrders(pin, all.map((s) => s.id))
  if (found === 'pin' || !found) return found
  let matched = 0
  for (const s of all) {
    const f = found[s.id]
    if (f && f.status === 'batal') markVoid(s.id)
    else if (f) {
      matched++
      if (s.state !== 'sent' || s.code !== f.code) markSent(s.id, f.code)
    } else if (s.state === 'sent') patch(s.id, { state: 'pending', code: '' }) // we thought it went in — it didn't
  }
  const missing = read().filter((s) => s.state === 'pending').length
  const r = await sync(pin)
  if (r === 'pin') return 'pin'
  return { at: Date.now(), matched, resent: r, left: missing - r }
}

/** the whole log as a spreadsheet file — if all else fails, nothing is only in someone's memory */
export function downloadLedger() {
  const rows = [['Waktu', 'ID', 'Kode', 'Status', 'Nama', 'Pesanan', 'Total (Rp)', 'Bayar']].concat(
    read().map((s) => [
      new Date(s.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta' }),
      s.id,
      s.code,
      s.state === 'sent' ? 'di Sheet' : s.state === 'void' ? 'batal' : 'BELUM di Sheet',
      s.name,
      s.lines.map((l) => `${l.qty}x ${l.name}`).join(', '),
      String(s.total * 1000),
      s.pay,
    ]),
  )
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv' }))
  a.download = `Kasir Pletok (HP ini) ${new Date().toLocaleDateString('id-ID')}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

import { DRINKS, type DrinkId } from '../data/menu'
import { PREORDER_ITEMS } from '../data/preorder'
import type { ClosingCount, FinanceConfig, MoneyHolders, Order, QueueOrder } from './backend'

/*
 * The money behind /financial. Everything here is FULL rupiah (BEC_VENTURE style); order totals
 * from the Sheet are in thousands and get ×1000 on the way in.
 *
 * Two views of profit, the same two BEC_VENTURE uses:
 *   laba kotor  = omzet − HPP of the cups actually sold        (is each cup worth it?)
 *   laba bersih = omzet − everything spent (modal + other costs) (did the day pay for itself?)
 * "Balik modal" (break-even) is the second one crossing zero.
 */

/** BEC_VENTURE → cashFlow / Quotation, as of 20 Nov 2026. Admins edit them on /financial. */
export const DEFAULT_FINANCE: FinanceConfig = {
  hpp: { original: 6600, lychee: 8933, yakult: 10000 },
  modal: [
    { name: 'Bir Pletok', detail: '7 Liter × Rp45.000', amount: 315000, by: '' },
    { name: 'Yakult', detail: '4 Pak (5 botol) × Rp17.000', amount: 68000, by: '' },
    { name: 'Sparkling Lychee', detail: '3 Botol 480 ml × Rp14.000', amount: 42000, by: '' },
    { name: 'Cup 8 oz', detail: '50 pcs × Rp1.200', amount: 60000, by: 'El' },
  ],
  // "Paper Cup (Product)" in Quotation is the same 50 cups as "Cup 8 oz" above — counted once
  ops: [
    { name: 'Paper cup (prototype)', detail: '50 pcs', amount: 27000, by: 'El' },
    { name: 'Banner 160×60', detail: '1', amount: 50000, by: 'El' },
    { name: 'Sticker', detail: '77 (1 lembar)', amount: 15000, by: 'El' },
    { name: 'Kain meja', detail: '', amount: 37200, by: 'Calvin' },
  ],
  target: { cups: 40, omzet: 964000 },
  crew: [],
}

export type Pot = keyof MoneyHolders
export const POT_IDS: Pot[] = ['tunai', 'bca', 'qris']
/** booth rows say 'Tunai' / 'QRIS' / 'Transfer BCA'; pre-orders say 'BCA' / 'QRIS' */
export const potOf = (pay: string): Pot => (/qris/i.test(pay) ? 'qris' : /bca/i.test(pay) ? 'bca' : 'tunai')

/** one paid sale, from either side */
export interface Sale {
  src: 'po' | 'booth'
  id: string
  at: number
  /** full rupiah */
  total: number
  pot: Pot
  cups: Partial<Record<DrinkId, number>>
  bundles: number
  singles: number
  /** first-N promo given away (pre-orders), full rupiah */
  promo: number
}

const cupsOfLine = (l: { id: string; drinks?: string[] }) => (l.drinks?.length ? l.drinks : (PREORDER_ITEMS.find((i) => i.id === l.id)?.drinks ?? [])) as DrinkId[]

/** verified pre-orders + booth sales that weren't cancelled */
export function salesOf(orders: Order[], booth: QueueOrder[]): Sale[] {
  const one = (src: Sale['src'], o: { id: string; at: number; total: number; pay: string; lines: Array<{ id: string; qty: number; drinks?: string[] }>; promo?: number }): Sale => {
    const cups: Sale['cups'] = {}
    let bundles = 0
    let singles = 0
    for (const l of o.lines) {
      const d = cupsOfLine(l)
      d.forEach((id) => (cups[id] = (cups[id] ?? 0) + l.qty))
      if (d.length > 1) bundles += l.qty
      else singles += l.qty
    }
    return { src, id: o.id, at: o.at, total: o.total * 1000, pot: potOf(o.pay), cups, bundles, singles, promo: (o.promo ?? 0) * 1000 }
  }
  return [...orders.filter((o) => o.status === 'process' || o.status === 'done').map((o) => one('po', o)), ...booth.map((o) => one('booth', o))]
}

export const sumCosts = (lines: FinanceConfig['modal']) => lines.reduce((t, l) => t + (Number(l.amount) || 0), 0)

export interface Summary {
  omzet: number
  n: number
  cups: Record<DrinkId, number>
  cupsTotal: number
  hppUsed: number
  labaKotor: number
  modal: number
  ops: number
  spent: number
  labaBersih: number
  /** stock bought but not sold yet, at cost (BEC_VENTURE "Sisa Stok") */
  sisaStok: number
  /** omzet still needed to break even (0 once there) */
  toBep: number
  avgTicket: number
  /** average cup price, for "≈ N cup lagi" */
  perCup: number
  promo: number
  bundles: number
  singles: number
  pots: Record<Pot, { sum: number; n: number; po: number; booth: number }>
}

export function summarize(sales: Sale[], f: FinanceConfig): Summary {
  const cups = Object.fromEntries(DRINKS.map((d) => [d.id, 0])) as Record<DrinkId, number>
  const pots = Object.fromEntries(POT_IDS.map((p) => [p, { sum: 0, n: 0, po: 0, booth: 0 }])) as Summary['pots']
  let omzet = 0
  let promo = 0
  let bundles = 0
  let singles = 0
  for (const s of sales) {
    omzet += s.total
    promo += s.promo
    bundles += s.bundles
    singles += s.singles
    for (const [id, n] of Object.entries(s.cups)) cups[id as DrinkId] += n ?? 0
    const p = pots[s.pot]
    p.sum += s.total
    p.n++
    p[s.src === 'po' ? 'po' : 'booth'] += s.total
  }
  const cupsTotal = Object.values(cups).reduce((a, b) => a + b, 0)
  const hppUsed = DRINKS.reduce((t, d) => t + cups[d.id] * (Number(f.hpp[d.id]) || 0), 0)
  const modal = sumCosts(f.modal)
  const ops = sumCosts(f.ops)
  const spent = modal + ops
  const perCup = cupsTotal ? omzet / cupsTotal : f.target.cups ? f.target.omzet / f.target.cups : 19000
  return {
    omzet,
    n: sales.length,
    cups,
    cupsTotal,
    hppUsed,
    labaKotor: omzet - hppUsed,
    modal,
    ops,
    spent,
    labaBersih: omzet - spent,
    sisaStok: modal - hppUsed,
    toBep: Math.max(0, spent - omzet),
    avgTicket: sales.length ? omzet / sales.length : 0,
    perCup,
    promo,
    bundles,
    singles,
    pots,
  }
}

/** the event hours (WIB) as buckets, with everything paid before the day in its own bar */
export function byHour(sales: Sale[], day = '2026-11-25') {
  const start = new Date(`${day}T00:00:00+07:00`).getTime()
  const hourOf = (at: number) => Math.floor((at - start) / 3_600_000)
  const hours = [13, 14, 15]
  // anything sold outside the plan (setting up early, running late) still shows up
  sales.forEach((s) => {
    const h = hourOf(s.at)
    if (h >= 0 && h < 24 && !hours.includes(h)) hours.push(h)
  })
  hours.sort((a, b) => a - b)
  const pre = sales.filter((s) => s.at < start)
  return [
    { key: 'pre', label: 'Pre-order', sub: 'sebelum hari H', sum: pre.reduce((t, s) => t + s.total, 0), n: pre.length },
    ...hours.map((h) => {
      const xs = sales.filter((s) => s.at >= start && hourOf(s.at) === h)
      return { key: String(h), label: `${String(h).padStart(2, '0')}.00`, sub: `–${String(h + 1).padStart(2, '0')}.00`, sum: xs.reduce((t, s) => t + s.total, 0), n: xs.length }
    }),
  ]
}

/* ---------------------------------------------------------------- settling up */

export const KAS = 'Kas tim'

export interface Person {
  name: string
  /** money they hold at the end (counted, else what the system expects) */
  holds: number
  /** costs they paid out of their own pocket */
  paid: number
  /** their part of the profit (or loss) */
  share: number
  /** + = has to hand over, − = gets money */
  net: number
}
export interface Transfer {
  from: string
  to: string
  amount: number
}

/**
 * Who ends up with what. Everyone who paid for something gets it back first (costs without a name
 * were paid from the team's money → "Kas tim" gets them back); what's left is the profit, split
 * equally over `crew` (no crew listed → it stays in Kas tim). Then the fewest transfers that make
 * everyone square: whoever holds more than their part hands it to whoever holds less.
 */
export function settle(f: FinanceConfig, holders: MoneyHolders, held: Record<Pot, number>) {
  const people = new Map<string, Person>()
  const get = (raw: string) => {
    const name = raw.trim() || KAS
    const key = name.toLowerCase()
    if (!people.has(key)) people.set(key, { name, holds: 0, paid: 0, share: 0, net: 0 })
    return people.get(key)!
  }
  POT_IDS.forEach((p) => (get(holders[p]).holds += held[p]))
  ;[...f.modal, ...f.ops].forEach((l) => (get(l.by ?? '').paid += Number(l.amount) || 0))
  const crew = f.crew.map((c) => c.trim()).filter(Boolean)
  crew.forEach(get)
  const total = POT_IDS.reduce((t, p) => t + held[p], 0)
  const paid = [...people.values()].reduce((t, p) => t + p.paid, 0)
  const profit = total - paid
  if (crew.length) crew.forEach((c) => (get(c).share += profit / crew.length))
  else get(KAS).share += profit
  const list = [...people.values()].map((p) => ({ ...p, net: Math.round(p.holds - p.paid - p.share) }))

  const give = list.filter((p) => p.net > 0).map((p) => ({ name: p.name, left: p.net }))
  const take = list.filter((p) => p.net < 0).map((p) => ({ name: p.name, left: -p.net }))
  const transfers: Transfer[] = []
  give.sort((a, b) => b.left - a.left)
  take.sort((a, b) => b.left - a.left)
  for (const g of give)
    for (const t of take) {
      const x = Math.min(g.left, t.left)
      // rounding leftovers under Rp100 aren't worth a transfer
      if (x < 100) continue
      transfers.push({ from: g.name, to: t.name, amount: x })
      g.left -= x
      t.left -= x
    }
  return { people: list.filter((p) => p.holds || p.paid || p.share).sort((a, b) => b.net - a.net), transfers, profit }
}

/** what each pot actually holds: the closing count where it's been done, else what the system expects */
export const heldIn = (s: Summary, closing: Partial<Record<Pot, ClosingCount>>) =>
  Object.fromEntries(POT_IDS.map((p) => [p, closing[p]?.counted ?? s.pots[p].sum])) as Record<Pot, number>

export const idr = (n: number) => `${n < 0 ? '−' : ''}Rp${Math.round(Math.abs(n)).toLocaleString('id-ID')}`

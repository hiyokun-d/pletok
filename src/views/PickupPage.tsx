import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, CupSoda, HandPlatter, Loader2, RotateCcw, Search, StickyNote, WifiOff } from 'lucide-react'
import { BACKEND, crewPin, fetchQueue, markPickedUp, type QueueOrder } from '../lib/backend'
import { PREORDER_ITEMS } from '../data/preorder'
import { DRINKS } from '../data/menu'
import { CrewNav, Empty, PinGate, Shell, hhmm, useCrewPage } from './adminUi'

/*
 * /pickup — the hand-over counter. Every paid order waits here: verified pre-orders (PLT-001…)
 * and booth sales from /cashier (B-001…). Type the digits, hand it over, tap "Diambil".
 */

const REFRESH_MS = 5_000
type Filter = 'all' | 'po' | 'booth'

/** the cups an order line takes to make — bundles count each drink in them */
const cupsOf = (l: QueueOrder['lines'][number]) => l.drinks?.length ? l.drinks : PREORDER_ITEMS.find((i) => i.id === l.id)?.drinks ?? []
const minutesAgo = (at: number) => Math.max(0, Math.round((Date.now() - at) / 60_000))

export function PickupPage() {
  const [pin, setPin] = useState(crewPin)
  const [wrong, setWrong] = useState(false)
  useCrewPage('Pickup')
  const [orders, setOrders] = useState<QueueOrder[] | null>(null)
  const [offline, setOffline] = useState(false)
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  // taps not confirmed by the Sheet yet: id → done
  const [pending, setPending] = useState<Record<string, boolean>>({})
  // orders seen on the first load don't flash as "new"
  const seen = useRef<Set<string> | null>(null)
  const [fresh, setFresh] = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    if (!pin) return
    const r = await fetchQueue(pin)
    if (r === 'pin') return setPin(null), setWrong(true)
    setOffline(!r)
    if (!r) return
    if (seen.current) {
      const added = r.filter((o) => !o.done && !seen.current!.has(o.id)).map((o) => o.id)
      if (added.length) setFresh((f) => new Set([...f, ...added]))
    }
    seen.current = new Set(r.map((o) => o.id))
    setOrders(r)
  }, [pin])
  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  const all = useMemo(() => (orders ?? []).map((o) => (o.id in pending ? { ...o, done: pending[o.id] } : o)), [orders, pending])
  const match = (o: QueueOrder) => {
    if (filter !== 'all' && o.src !== filter) return false
    const t = q.trim().toLowerCase()
    if (!t) return true
    // "7" or "007" → the code number, anything else → the name
    if (/^\d{1,4}$/.test(t)) return Number(o.code.replace(/\D/g, '')) === Number(t)
    return o.name.toLowerCase().includes(t) || o.code.toLowerCase().includes(t)
  }
  const waiting = all.filter((o) => !o.done && match(o)).sort((a, b) => a.at - b.at)
  const handed = all.filter((o) => o.done && match(o)).sort((a, b) => b.at - a.at).slice(0, 12)
  // what the drink-maker still has to pour, across everything waiting
  const tally = DRINKS.map((d) => ({ d, n: all.filter((o) => !o.done).reduce((t, o) => t + o.lines.reduce((s, l) => s + l.qty * cupsOf(l).filter((x) => x === d.id).length, 0), 0) }))

  const mark = async (o: QueueOrder, done: boolean) => {
    if (!pin) return
    setPending((p) => ({ ...p, [o.id]: done }))
    setFresh((f) => {
      const n = new Set(f)
      n.delete(o.id)
      return n
    })
    const ok = await markPickedUp(pin, o.src, o.id, done)
    if (ok) setOrders((os) => os?.map((x) => (x.id === o.id ? { ...x, done } : x)) ?? os)
    setPending((p) => {
      const n = { ...p }
      delete n[o.id]
      return n
    })
    if (!ok) setOffline(true)
  }

  if (!BACKEND) return <Shell><Empty title="Belum tersambung" text="VITE_BACKEND_URL belum diisi — lihat apps-script/README.md." /></Shell>
  if (!pin) return <Shell><PinGate title="Pickup Pletok" wrong={wrong} onOk={setPin} /></Shell>

  return (
    <Shell>
      <CrewNav at="pickup" />
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold">
          <HandPlatter className="size-7 text-terracotta" /> Pickup
          <motion.span key={waiting.length} initial={{ scale: 1.5 }} animate={{ scale: 1 }} className="ml-1 rounded-full bg-terracotta px-3 py-0.5 text-lg text-cream">
            {waiting.length}
          </motion.span>
        </h1>
        {offline && (
          <span className="flex items-center gap-1.5 rounded-full bg-terracotta/10 px-3 py-1 font-cond text-sm italic text-terracotta">
            <WifiOff className="size-4" /> Sinyal putus — mencoba lagi
          </span>
        )}
      </div>

      {/* cups to make for everything still waiting */}
      <div className="mb-4 grid grid-cols-3 gap-2">
        {tally.map(({ d, n }) => (
          <div key={d.id} className="flex items-center gap-2 rounded-2xl border border-brown/10 bg-cream/80 p-2.5">
            <img src={d.image} alt="" className="h-10 w-auto" />
            <div className="min-w-0">
              <motion.p key={n} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-display text-2xl font-bold leading-none tabular-nums">{n}</motion.p>
              <p className="truncate font-cond text-xs italic text-brown-soft">{d.short}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="mb-5 flex flex-wrap gap-2">
        <label className="flex min-w-0 flex-1 items-center gap-2 rounded-2xl bg-cream-deep/80 px-3.5 py-3 focus-within:ring-2 focus-within:ring-terracotta">
          <Search className="size-5 text-brown-soft" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ketik nomor (007) atau nama" className="w-full bg-transparent font-display text-lg outline-none" />
        </label>
        <div className="grid grid-cols-3 gap-1 rounded-2xl bg-brown/10 p-1">
          {(
            [
              ['all', 'Semua'],
              ['po', 'Pre-order'],
              ['booth', 'Kasir'],
            ] as const
          ).map(([id, label]) => (
            <button key={id} type="button" onClick={() => setFilter(id)} className="relative rounded-xl px-3 py-2 font-display text-sm font-semibold">
              {filter === id && <motion.span layoutId="pickup-filter" className="absolute inset-0 rounded-xl bg-brown" />}
              <span className={`relative ${filter === id ? 'text-cream' : ''}`}>{label}</span>
            </button>
          ))}
        </div>
      </div>

      {!orders ? (
        <p className="flex items-center gap-2 font-cond italic text-brown/55"><Loader2 className="size-4 animate-spin" /> Memuat antrean…</p>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <AnimatePresence mode="popLayout">
              {waiting.map((o) => (
                <motion.li
                  key={o.id}
                  layout
                  initial={{ opacity: 0, scale: 0.85, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.8, x: 80, transition: { duration: 0.3 } }}
                  transition={{ type: 'spring', stiffness: 320, damping: 26 }}
                  className={`relative flex flex-col rounded-3xl border-2 bg-cream p-4 ${fresh.has(o.id) ? 'border-[#e8b53a]' : 'border-brown/10'}`}
                >
                  {fresh.has(o.id) && (
                    <motion.span aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl ring-4 ring-[#e8b53a]" animate={{ opacity: [1, 0.2, 1] }} transition={{ duration: 1.2, repeat: Infinity }} />
                  )}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-4xl font-bold leading-none tracking-wide text-terracotta">{o.code}</p>
                      <p className="mt-1 font-display text-lg font-semibold">{o.name || 'Tanpa nama'}</p>
                    </div>
                    <div className="text-right">
                      <span className={`rounded-full px-2.5 py-1 font-display text-xs font-semibold ${o.src === 'po' ? 'bg-leaf text-cream' : 'bg-brown text-cream'}`}>
                        {o.src === 'po' ? 'Pre-order' : `Kasir · ${o.pay}`}
                      </span>
                      <p className="mt-1.5 font-cond text-sm italic text-brown/55">
                        {hhmm(o.at)}
                        {o.src === 'booth' && ` · ${minutesAgo(o.at)} mnt`}
                      </p>
                    </div>
                  </div>
                  <ul className="mt-3 flex flex-col gap-1 border-t-2 border-dashed border-brown/15 pt-3 font-display">
                    {o.lines.map((l, k) => {
                      const cups = cupsOf(l)
                      return (
                        <li key={k}>
                          <span className="text-xl font-bold">{l.qty}×</span> <span className="text-lg">{l.name}</span>
                          {cups.length > 1 && (
                            <span className="block font-cond text-sm italic text-brown-soft">
                              <CupSoda className="mr-1 inline size-3.5" />
                              {cups.map((c) => DRINKS.find((d) => d.id === c)?.short ?? c).join(' + ')}
                            </span>
                          )}
                        </li>
                      )
                    })}
                  </ul>
                  {o.note && (
                    <p className="mt-2 flex items-start gap-1.5 rounded-xl bg-[#e8b53a]/20 px-3 py-2 font-display text-sm">
                      <StickyNote className="mt-0.5 size-4 shrink-0" /> {o.note}
                    </p>
                  )}
                  <motion.button
                    type="button"
                    whileTap={{ scale: 0.95 }}
                    disabled={o.id in pending}
                    onClick={() => void mark(o, true)}
                    className="mt-4 flex items-center justify-center gap-2 rounded-full bg-leaf py-3.5 font-display text-lg font-semibold text-cream shadow-[0_5px_0_#3f5426]"
                  >
                    {o.id in pending ? <Loader2 className="size-5 animate-spin" /> : <Check className="size-5" />} Sudah diambil
                  </motion.button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
          {!waiting.length && (
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-3xl border-2 border-dashed border-brown/15 p-10 text-center font-display text-lg text-brown-soft">
              {q ? 'Nggak ada yang cocok — cek lagi nomornya.' : 'Antrean kosong. Santai dulu 🍹'}
            </motion.p>
          )}

          {handed.length > 0 && (
            <section className="mt-8">
              <p className="mb-2 font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-brown/55">Baru diambil</p>
              <ul className="flex flex-col divide-y divide-brown/10 rounded-3xl border border-brown/10 bg-cream/60 px-4">
                <AnimatePresence initial={false}>
                  {handed.map((o) => (
                    <motion.li key={o.id} layout initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="flex items-center gap-3 py-2.5 font-display">
                      <span className="w-20 font-bold text-brown/60 line-through decoration-2">{o.code}</span>
                      <span className="min-w-0 flex-1 truncate text-brown-soft">{o.name || 'Tanpa nama'} · {o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}</span>
                      <button type="button" disabled={o.id in pending} onClick={() => void mark(o, false)} className="flex items-center gap-1 rounded-full border border-brown/15 px-2.5 py-1 text-xs font-semibold text-brown-soft">
                        <RotateCcw className="size-3" /> Belum
                      </button>
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          )}
        </>
      )}
    </Shell>
  )
}

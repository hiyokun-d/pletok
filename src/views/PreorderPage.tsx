import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { CalendarClock, MapPin, Minus, Plus, ShoppingBag, TriangleAlert } from 'lucide-react'
import { EVENT } from '../data/event'
import { ErrorPage } from './ErrorPage'
import { DEFAULT_CUTOFF, PREORDER_ITEMS, rupiah } from '../data/preorder'
import { BACKEND, submitPreorder } from '../lib/backend'
import { trackClick } from '../lib/analytics'
import { usePreorder } from '../hooks/usePreorder'
import { BackButton } from '../components/BackButton'
import { PaperPlane } from '../components/PaperPlane'
import { ParticleField } from '../components/ParticleField'
import { Sprout } from '../components/Sprout'
import { spring } from '../lib/motion'

/** the plane loops at least this long, so a fast answer still reads as "on its way" */
const MIN_FLIGHT_MS = 1600
const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`
const dateLong = (ms: number) =>
  new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })

/**
 * /preorder — pick drinks / bundles, leave a name + WhatsApp, get an order code to show at
 * Meja 9 on the day. What's on sale and the prices come from the Sheet (set on /hasil); the
 * Sheet re-checks everything, so the total here is only a preview.
 */
export function PreorderPage() {
  const { config, loaded, open } = usePreorder()
  // no answer from the Sheet after a while → say so instead of an endless sprout
  const [stuck, setStuck] = useState(false)
  useEffect(() => {
    if (loaded) return setStuck(false)
    const t = window.setTimeout(() => setStuck(true), 12_000)
    return () => window.clearTimeout(t)
  }, [loaded])
  const items = PREORDER_ITEMS.filter((i) => config.items[i.id]?.on).map((i) => ({ ...i, price: config.items[i.id].price }))
  const [qty, setQty] = useState<Record<string, number>>({})
  const [name, setName] = useState('')
  const [wa, setWa] = useState('')
  const [note, setNote] = useState('')
  const [hp, setHp] = useState('')
  const [flight, setFlight] = useState<null | 'flying' | 'away'>(null)
  // a snapshot of what was ordered, so a later config refresh can't change the receipt
  const [done, setDone] = useState<{ code: string; name: string; total: number; lines: Array<{ id: string; name: string; qty: number; price: number }> } | null>(null)
  const [error, setError] = useState<string | null>(null)
  // one id per order attempt, so a retry never makes a second order
  const [orderId] = useState(newId)

  const lines = items.filter((i) => (qty[i.id] ?? 0) > 0)
  const total = useMemo(() => lines.reduce((t, i) => t + i.price * qty[i.id], 0), [lines, qty])
  const cups = lines.reduce((n, i) => n + qty[i.id], 0)
  const waOk = wa.replace(/\D/g, '').length >= 9
  const ready = lines.length > 0 && name.trim() && waOk

  const bump = (id: string, d: number) => setQty((q) => ({ ...q, [id]: Math.max(0, Math.min(20, (q[id] ?? 0) + d)) }))

  const submit = async () => {
    if (!ready || flight) return
    setError(null)
    setFlight('flying')
    window.scrollTo({ top: 0, behavior: 'smooth' })
    const started = performance.now()
    const r = await submitPreorder({ id: orderId, items: lines.map((i) => ({ id: i.id, qty: qty[i.id] })), name: name.trim(), wa, note: note.trim(), hp })
    await new Promise((res) => window.setTimeout(res, Math.max(0, MIN_FLIGHT_MS - (performance.now() - started))))
    if (r?.ok) {
      trackClick('preorder-terkirim')
      setDone({ code: r.code, name: name.trim(), total: r.total, lines: lines.map((i) => ({ id: i.id, name: i.name, qty: qty[i.id], price: i.price })) })
      setFlight('away')
    } else {
      setFlight(null)
      setError(
        r?.error === 'closed'
          ? 'Pre-order baru saja ditutup. Sampai ketemu di booth ya!'
          : r?.error === 'empty'
            ? 'Ada menu yang barusan dimatikan — cek lagi pesananmu.'
            : r?.error === 'contact'
              ? 'Cek lagi nama dan nomor WhatsApp-mu.'
              : 'Sinyalnya lagi susah — pesanan belum terkirim. Coba lagi ya.',
      )
    }
  }

  return (
    <main className="paper min-h-dvh px-5 pb-10 pt-6 text-brown">
      <div className="mx-auto max-w-2xl">
        <AnimatePresence mode="wait">
          {flight ? (
            <motion.section key="flight" className="flex min-h-[80dvh] flex-col items-center justify-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <PaperPlane state={flight} onGone={() => setFlight(null)} />
              <motion.p className="font-display text-xl font-semibold text-brown-soft" animate={{ opacity: flight === 'flying' ? [0.5, 1, 0.5] : 0 }} transition={flight === 'flying' ? { duration: 1.4, repeat: Infinity } : { duration: 0.3 }}>
                Mengirim pesananmu…
              </motion.p>
            </motion.section>
          ) : done ? (
            <motion.section key="done" className="flex min-h-[80dvh] flex-col items-center justify-center text-center" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
              <ParticleField preset="burst" overrides={{ shape: 'leaf', count: 80 }} points={[[window.innerWidth / 2, window.innerHeight * 0.3]]} burstKey={1} />
              <h1 className="font-script text-6xl font-bold">Makasih!</h1>
              <p className="mt-2 font-display text-lg text-brown-soft">Pesananmu sudah masuk. Tunjukkan kode ini di booth:</p>
              <motion.p className="mt-4 rounded-3xl bg-brown px-8 py-4 font-display text-5xl font-bold tracking-wider text-cream shadow-[0_6px_0_#3a1c0f]" initial={{ scale: 0.6, rotate: -6 }} animate={{ scale: 1, rotate: -2 }} transition={spring.pop}>
                {done.code}
              </motion.p>
              <p className="mt-3 font-display text-lg">
                atas nama <b>{done.name}</b>
              </p>
              <div className="mt-5 w-full max-w-sm rounded-3xl border-2 border-brown/10 bg-cream/80 p-4 text-left">
                {done.lines.map((i) => (
                  <p key={i.id} className="flex justify-between font-display">
                    <span>{i.qty}× {i.name}</span>
                    <span className="tabular-nums">{rupiah(i.price * i.qty)}</span>
                  </p>
                ))}
                <p className="mt-2 flex justify-between border-t border-brown/10 pt-2 font-display text-lg font-bold">
                  <span>Total</span>
                  <span className="tabular-nums">{rupiah(done.total)}</span>
                </p>
              </div>
              <p className="mt-5 flex items-center gap-2 font-display text-brown-soft">
                <MapPin className="size-4" /> Ambil di {EVENT.table} · {EVENT.dateLabel}, {EVENT.timeLabel}
              </p>
              <p className="mt-2 font-cond text-sm italic text-brown/55">Screenshot halaman ini ya — sebutkan kode & nama saat ambil. Tim kami akan menghubungi lewat WhatsApp.</p>
            </motion.section>
          ) : BACKEND && !loaded && stuck ? (
            <motion.section key="down" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <ErrorPage kind={navigator.onLine ? 503 : 'offline'} />
            </motion.section>
          ) : BACKEND && !loaded ? (
            <motion.section key="loading" className="grid min-h-[70dvh] place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <Sprout state="grow" className="h-auto w-14" />
            </motion.section>
          ) : !open ? (
            <motion.section key="closed" className="flex min-h-[80dvh] flex-col items-center justify-center text-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <BackButton className="fixed left-5 top-6" />
              <Sprout state="grow" className="h-auto w-16" />
              <h1 className="mt-4 font-display text-3xl font-bold">Pre-order lagi tutup</h1>
              <p className="mt-3 max-w-sm font-display text-lg text-brown-soft">
                Langsung mampir aja ke {EVENT.table} — {EVENT.dateLabel}, {EVENT.timeLabel}.
              </p>
            </motion.section>
          ) : (
            <motion.form
              key="form"
              className="flex flex-col gap-6"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
            >
              <BackButton />
              <header className="-mt-2">
                <h1 className="flex items-center gap-2 font-display text-3xl font-bold leading-none">
                  <ShoppingBag className="size-7 text-terracotta" /> Pre-order Pletok
                </h1>
                <p className="mt-2 flex items-center gap-1.5 font-cond text-base italic text-brown-soft">
                  <MapPin className="size-4" /> Ambil di {EVENT.table} · {EVENT.dateLabel}, {EVENT.timeLabel}
                </p>
                <p className="flex items-center gap-1.5 font-cond text-base italic text-brown-soft">
                  <CalendarClock className="size-4" /> Pre-order ditutup {dateLong(Math.min(config.cutoff, DEFAULT_CUTOFF))} WIB
                </p>
              </header>

              <div className="flex flex-col gap-3">
                {items.map((i) => {
                  const n = qty[i.id] ?? 0
                  return (
                    <div key={i.id} className={`flex items-center gap-3 rounded-3xl border-2 p-3 transition-colors ${n ? 'border-terracotta/60 bg-cream' : 'border-brown/10 bg-cream/70'}`}>
                      <div className="flex h-20 w-24 shrink-0 items-end justify-center">
                        {i.images.map((src, k) => (
                          <img key={k} src={src} alt="" className="h-full w-auto min-w-0 object-contain" style={{ marginInline: i.images.length > 1 ? -10 : 0 }} />
                        ))}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-display text-lg font-bold leading-tight">{i.name}</p>
                        <p className="truncate font-cond text-sm italic text-brown-soft">{i.detail}</p>
                        <p className="mt-0.5 font-display font-semibold text-terracotta">{rupiah(i.price)}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Step label={`Kurangi ${i.name}`} onClick={() => bump(i.id, -1)} disabled={!n}>
                          <Minus className="size-4" />
                        </Step>
                        <span className="w-6 text-center font-display text-lg font-bold tabular-nums">{n}</span>
                        <Step label={`Tambah ${i.name}`} onClick={() => bump(i.id, 1)} solid>
                          <Plus className="size-4" />
                        </Step>
                      </div>
                    </div>
                  )
                })}
              </div>

              <section className="flex flex-col gap-2">
                <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-terracotta">Data pemesan</p>
                <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Nama" autoComplete="name" className="rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta" />
                <input value={wa} onChange={(e) => setWa(e.target.value)} maxLength={20} placeholder="Nomor WhatsApp (08…)" inputMode="tel" autoComplete="tel" className="rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta" />
                <textarea value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} rows={2} placeholder="Catatan (opsional) — misal: es sedikit" className="resize-none rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta" />
                <p className="font-cond text-sm italic text-brown/55">Nomor WhatsApp cuma dipakai tim Pletok untuk konfirmasi pesananmu.</p>
              </section>

              <input tabIndex={-1} autoComplete="off" value={hp} onChange={(e) => setHp(e.target.value)} className="absolute -left-[9999px] size-px opacity-0" aria-hidden />

              {error && (
                <p className="flex items-start gap-2 rounded-2xl bg-terracotta/10 p-3 font-display text-sm text-terracotta">
                  <TriangleAlert className="mt-0.5 size-4 shrink-0" /> {error}
                </p>
              )}

              <div className="sticky bottom-0 -mx-5 bg-gradient-to-t from-cream from-60% to-transparent px-5 pb-4 pt-6">
                <motion.button
                  type="submit"
                  disabled={!ready}
                  whileTap={{ scale: 0.96 }}
                  className="flex w-full items-center justify-between gap-3 rounded-full bg-terracotta px-6 py-4 font-display text-lg font-semibold text-cream shadow-[0_6px_0_#6e3418] disabled:bg-[#cfa98f] disabled:shadow-none"
                >
                  <span>{!lines.length ? 'Pilih menu dulu' : !name.trim() || !waOk ? 'Isi nama & WhatsApp' : `Pesan · ${cups} cup`}</span>
                  <span className="tabular-nums">{rupiah(total)}</span>
                </motion.button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>
      </div>
    </main>
  )
}

function Step({ children, onClick, disabled, solid, label }: { children: React.ReactNode; onClick: () => void; disabled?: boolean; solid?: boolean; label: string }) {
  return (
    <motion.button
      type="button"
      aria-label={label}
      whileTap={{ scale: 0.85 }}
      onClick={onClick}
      disabled={disabled}
      className={`grid size-9 place-items-center rounded-full disabled:opacity-30 ${solid ? 'bg-brown text-cream' : 'bg-cream-deep text-brown'}`}
    >
      {children}
    </motion.button>
  )
}

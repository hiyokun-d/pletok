import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { BellRing, CheckCircle2, ChefHat, CloudOff, Loader2, MapPin, MessageCircle, ReceiptText, XCircle } from 'lucide-react'
import { fetchReceipt, type BoothReceipt } from '../lib/backend'
import { rupiah } from '../data/preorder'
import { ADMIN_WA, adminChat } from '../data/event'
import { hhmm } from './adminUi'
import { chime, unlockAudio } from '../lib/chime'

/*
 * /r/<sale id> — the buyer's receipt, opened from the QR the cashier shows after "Lunas".
 *   - Can't be faked: the QR holds only the sale's random id; every line here is read live from the
 *     Sheet. A screenshot gives itself away — the clock ticks and the seal turns on a live page.
 *   - Tells them when to come: Dibayar → Sedang dibuat → Siap diambil. When the barista taps "Siap"
 *     on /pickup the page rings (vibrate + chime + notification + blinking tab title). It has to stay
 *     open for that — there's no push server behind a Google Sheet.
 *   - Lost it? It's saved on this phone (/struk lists them), the cashier can show the QR again, and
 *     at pickup the B-number + name still works.
 */

const SAVED = 'pletok:receipts'
type Saved = { id: string; code: string; at: number }
export function savedReceipts(): Saved[] {
  try {
    return (JSON.parse(localStorage.getItem(SAVED) ?? '[]') as Saved[]).filter((s) => Date.now() - s.at < 3 * 86_400_000)
  } catch {
    return []
  }
}
function save(id: string, r: BoothReceipt) {
  try {
    localStorage.setItem(SAVED, JSON.stringify([{ id, code: r.code, at: r.at }, ...savedReceipts().filter((s) => s.id !== id)].slice(0, 20)))
    localStorage.setItem(`${SAVED}:${id}`, JSON.stringify(r))
  } catch {
    /* storage blocked — the page still works while it's open */
  }
}
function cached(id: string): BoothReceipt | null {
  try {
    return JSON.parse(localStorage.getItem(`${SAVED}:${id}`) ?? 'null')
  } catch {
    return null
  }
}

export function ReceiptPage({ id }: { id: string }) {
  const [r, setR] = useState<BoothReceipt | null>(() => cached(id))
  const [state, setState] = useState<'loading' | 'ok' | 'none' | 'offline'>('loading')
  const [now, setNow] = useState(Date.now())
  const [armed, setArmed] = useState(false)
  const rang = useRef(false)

  // poll: quick while waiting for the drink, then slow, stop once it's handed over
  useEffect(() => {
    let live = true
    let t = 0
    const tick = async () => {
      const x = await fetchReceipt(id)
      if (!live) return
      if (x && x !== 'none') {
        setR(x)
        setState('ok')
        save(id, x)
      } else setState(x === 'none' ? 'none' : 'offline')
      const done = x && x !== 'none' && (x.status === 'done' || x.status === 'void')
      if (!done) t = window.setTimeout(tick, x === 'none' ? 8000 : 5000)
    }
    void tick()
    return () => {
      live = false
      window.clearTimeout(t)
    }
  }, [id])

  // the live seal: a clock that ticks every second
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(t)
  }, [])

  // ready → ring, once
  const ready = r?.status === 'ready'
  useEffect(() => {
    if (!ready || rang.current) return
    rang.current = true
    navigator.vibrate?.([300, 120, 300, 120, 600])
    chime()
    try {
      if ('Notification' in window && Notification.permission === 'granted') new Notification(`${r!.code} siap diambil!`, { body: 'Ambil di Meja 9 · Pletok', tag: id })
    } catch {
      /* some phones only notify from a service worker — the screen still shows it */
    }
    const base = document.title
    let on = false
    const t = window.setInterval(() => {
      on = !on
      document.title = on ? `🔔 ${r!.code} SIAP!` : base
    }, 900)
    return () => {
      window.clearInterval(t)
      document.title = base
    }
  }, [ready, r, id])

  // the tap that unlocks sound + notifications (browsers only allow them after one)
  const arm = async () => {
    setArmed(true)
    unlockAudio()
    chime()
    try {
      if ('Notification' in window && Notification.permission === 'default') await Notification.requestPermission()
      await (navigator as Navigator & { wakeLock?: { request: (t: 'screen') => Promise<unknown> } }).wakeLock?.request('screen')
    } catch {
      /* fine without */
    }
  }

  const step = !r ? 0 : r.status === 'done' ? 3 : r.status === 'ready' ? 2 : 1
  const clock = new Date(now).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' })

  return (
    <main className={`paper min-h-dvh px-4 pb-12 pt-6 text-brown transition-colors ${ready ? 'bg-leaf/15' : ''}`}>
      <div className="mx-auto max-w-sm">
        <p className="mb-3 flex items-center justify-center gap-2 font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-brown/55">
          <ReceiptText className="size-4" /> Struk Pletok
        </p>

        {!r ? (
          <div className="rounded-[2rem] border-2 border-dashed border-brown/15 p-8 text-center font-display">
            {state === 'none' ? (
              <>
                <p className="text-xl font-bold">Struk belum masuk sistem</p>
                <p className="mt-2 text-sm text-brown-soft">Kalau baru bayar, tunggu sebentar — halaman ini mengecek sendiri. Pesananmu tetap tercatat di kasir.</p>
              </>
            ) : state === 'offline' ? (
              <p className="flex items-center justify-center gap-2 text-brown-soft"><CloudOff className="size-5" /> Sinyal / sistem gangguan — mencoba lagi…</p>
            ) : (
              <p className="flex items-center justify-center gap-2 text-brown-soft"><Loader2 className="size-5 animate-spin" /> Memuat struk…</p>
            )}
          </div>
        ) : (
          <>
            {/* the status, big — the part they'll actually look at */}
            <motion.section
              key={r.status}
              initial={{ scale: 0.94, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`rounded-[2rem] p-6 text-center ${r.status === 'ready' ? 'bg-leaf text-cream shadow-[0_8px_0_#3f5426]' : r.status === 'void' ? 'bg-terracotta/10' : r.status === 'done' ? 'bg-brown/10' : 'bg-cream'}`}
            >
              {r.status === 'ready' ? (
                <motion.div animate={{ rotate: [0, -12, 12, -8, 8, 0] }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 1.2 }} className="inline-block">
                  <BellRing className="size-12" />
                </motion.div>
              ) : r.status === 'done' ? (
                <CheckCircle2 className="mx-auto size-12 text-leaf" />
              ) : r.status === 'void' ? (
                <XCircle className="mx-auto size-12 text-terracotta" />
              ) : (
                <ChefHat className="mx-auto size-12 text-terracotta" />
              )}
              <p className="mt-2 font-display text-6xl font-bold tracking-wide">{r.code}</p>
              <p className="mt-2 font-display text-xl font-bold">
                {r.status === 'ready' ? 'Siap diambil!' : r.status === 'done' ? `Sudah diambil ${r.doneAt ? hhmm(r.doneAt) : ''}` : r.status === 'void' ? 'Transaksi dibatalkan' : 'Sedang dibuat…'}
              </p>
              <p className={`mt-1 flex items-center justify-center gap-1 font-cond italic ${r.status === 'ready' ? 'text-cream/85' : 'text-brown-soft'}`}>
                <MapPin className="size-4" /> {r.status === 'ready' ? 'Datang ke Meja 9 & tunjukkan halaman ini' : 'Meja 9 · Balkon Lt. 2'}
              </p>

              {/* Dibayar → Sedang dibuat → Siap → Diambil */}
              {r.status !== 'void' && (
                <ol className="mt-5 grid grid-cols-4 gap-1 font-display text-[11px] font-semibold">
                  {['Dibayar', 'Dibuat', 'Siap', 'Diambil'].map((s, i) => (
                    <li key={s} className="flex flex-col items-center gap-1">
                      <span className={`h-1.5 w-full rounded-full ${i <= step ? (r.status === 'ready' ? 'bg-cream' : 'bg-leaf') : r.status === 'ready' ? 'bg-cream/30' : 'bg-brown/15'}`} />
                      {s}
                    </li>
                  ))}
                </ol>
              )}
            </motion.section>

            {/* the live seal — a screenshot freezes it */}
            <div className="mt-3 flex items-center justify-between gap-3 rounded-2xl border-2 border-leaf/40 bg-cream/80 px-4 py-2.5 font-display">
              <span className="flex items-center gap-2 text-sm font-semibold text-leaf">
                <motion.span animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: 'linear' }} className="grid size-7 place-items-center rounded-full border-2 border-dashed border-leaf text-xs">
                  ✓
                </motion.span>
                Struk asli · live
              </span>
              <span className="font-mono text-lg font-bold tabular-nums">{clock}</span>
            </div>
            {state === 'offline' && (
              <p className="mt-2 flex items-center gap-1.5 font-cond text-sm italic text-terracotta"><CloudOff className="size-4" /> Sinyal putus — status terakhir yang tersimpan. Mencoba lagi…</p>
            )}

            {/* ring when ready */}
            {r.status === 'process' && (
              <button
                type="button"
                onClick={() => void arm()}
                disabled={armed}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-terracotta py-3.5 font-display font-semibold text-cream shadow-[0_5px_0_#6e3418] disabled:bg-leaf disabled:shadow-none"
              >
                <BellRing className="size-5" /> {armed ? 'Oke! HP bunyi saat siap — biarkan halaman ini terbuka' : 'Kabari saya saat siap'}
              </button>
            )}

            {/* the receipt itself */}
            <section className="mt-4 rounded-[2rem] border border-brown/10 bg-cream/80 p-5 font-display">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-bold">{r.name ? `a.n. ${r.name}` : 'Pembeli booth'}</p>
                <p className="font-cond text-sm italic text-brown-soft">{new Date(r.at).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5 border-y-2 border-dashed border-brown/15 py-3">
                {r.lines.map((l, i) => (
                  <li key={i} className="flex justify-between gap-3">
                    <span>{l.qty}× {l.name}</span>
                    <span className="tabular-nums">{rupiah(l.qty * l.price)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="tabular-nums">{rupiah(r.total)}</span>
              </div>
              <p className="mt-1 flex justify-between text-sm text-brown-soft">
                <span>Dibayar</span>
                <span>{r.pay} · Lunas</span>
              </p>
              {r.ref && (
                <p className="mt-3 flex items-center justify-between rounded-xl bg-brown/[0.06] px-3 py-2 text-sm">
                  <span className="text-brown-soft">Kode cek</span>
                  <b className="text-lg tracking-[0.2em]">{r.ref}</b>
                </p>
              )}
            </section>

            <p className="mt-4 text-center font-cond text-sm italic text-brown/55">
              Struk ini tersimpan di HP-mu (buka lagi lewat pletok.hiyokun.dev/struk). Hilang? Sebut nomor {r.code} + namamu di booth.
            </p>
          </>
        )}

        {ADMIN_WA && (
          <a href={adminChat(`Halo admin Pletok, soal struk booth ${r?.code ?? ''}`)} target="_blank" rel="noreferrer" data-track="receipt-admin" className="mx-auto mt-4 flex w-fit items-center gap-1.5 rounded-full border-2 border-brown/15 px-4 py-2 font-display text-sm font-semibold">
            <MessageCircle className="size-4" /> Tanya admin
          </a>
        )}
      </div>
    </main>
  )
}

/** /struk — every receipt this phone has opened */
export function SavedReceiptsPage() {
  const list = savedReceipts()
  return (
    <main className="paper min-h-dvh px-4 pb-12 pt-8 text-brown">
      <div className="mx-auto max-w-sm">
        <h1 className="flex items-center gap-2 font-display text-3xl font-bold"><ReceiptText className="size-7 text-terracotta" /> Struk saya</h1>
        {!list.length ? (
          <p className="mt-4 rounded-3xl border-2 border-dashed border-brown/15 p-6 text-center font-display text-brown-soft">
            Belum ada struk di HP ini. Hilang? Sebut nomor pesananmu (B-…) + nama di booth Meja 9.
          </p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {list.map((s) => (
              <li key={s.id}>
                <a href={`/r/${s.id}`} className="flex items-center justify-between rounded-3xl border-2 border-brown/15 bg-cream/80 p-4 font-display">
                  <span className="text-2xl font-bold text-terracotta">{s.code}</span>
                  <span className="font-cond italic text-brown-soft">{hhmm(s.at)} · buka →</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  )
}

import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Ban, Check, Crown, DoorClosed, PackageCheck, RotateCcw, UtensilsCrossed, Download, ExternalLink, HelpCircle, Lightbulb, Loader2, Lock, MessageCircle, MessageCircleHeart, RefreshCw, ScanLine, Search, ShieldCheck, ShoppingBag, Sparkles, Star, ThumbsUp, Users, Wallet } from 'lucide-react'
import { EVENT } from '../data/event'
import { DRINKS } from '../data/menu'
import { BACKEND, crewPin, fetchResults, savePreorderConfig, setCrewPin, setFeedbackModeRemote, setOrderDone, type Order, type PreorderConfig, type Response, type Results } from '../lib/backend'
import { DEFAULT_CUTOFF, DEFAULT_PREORDER, PREORDER_ITEMS, rupiah } from '../data/preorder'
import { usePreorder } from '../hooks/usePreorder'
import { resetMenu, setBundleForced, setBundleItems, setClosedEarly, setDrinkSold, useMenu, useMenuSync } from '../hooks/useMenu'
import { useEventPhase } from '../hooks/useEventPhase'
import type { DrinkId } from '../data/menu'
import { useFeedbackOpen, type FeedbackMode } from '../hooks/useFeedbackOpen'
import { spring } from '../lib/motion'

/**
 * Crew-only results (/hasil), laid out like Google Forms' "Ringkasan" tab: headline numbers,
 * one chart per question, then every written answer. Live from the Sheet (refreshes every 30 s).
 * One series per chart → one brand colour; labels carry identity, never colour alone.
 */

const BAR = '#a8572a' // validated on the cream surface (dataviz validator: all checks pass)
const RATING_LABELS = ['Kurang', 'Biasa', 'Enak', 'Enak bgt', 'Juara!']
const GRID = [
  { key: 'like', title: 'Like', sub: 'yang disukai', Icon: ThumbsUp },
  { key: 'wish', title: 'Wishes', sub: 'kritik & saran', Icon: Sparkles },
  { key: 'question', title: 'Questions', sub: 'pertanyaan', Icon: HelpCircle },
  { key: 'idea', title: 'Ideas', sub: 'ide', Icon: Lightbulb },
] as const
const REFRESH_MS = 30_000
const BUCKET_MIN = 15
/** "saved here, not in the Sheet yet" — every admin control turns this colour until the Sheet agrees */
const WAIT = '#e8b53a'
const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)
const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
const dayTime = (ms: number) => new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

/** dev only: /hasil?demo shows made-up answers so the layout can be checked without the PIN */
const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')

export function HasilPage() {
  const [pin, setPin] = useState(DEMO ? 'demo' : crewPin)
  const [data, setData] = useState<Results | null>(DEMO ? demoResults() : null)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'pin'>('idle')
  const [at, setAt] = useState<number | undefined>(DEMO ? Date.now() : undefined)
  const preorder = usePreorder()
  const [demoPreorder, setDemoPreorder] = useState<PreorderConfig>(DEFAULT_PREORDER)

  // keep it out of search results
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex'
    document.head.appendChild(m)
    document.title = 'Hasil Feedback · Pletok'
    return () => m.remove()
  }, [])

  const load = useCallback(async () => {
    if (!pin || DEMO) return
    setState('loading')
    const r = await fetchResults(pin)
    if (r === 'pin') {
      setState('pin')
      setPin(null)
      return
    }
    if (!r) return setState('error')
    setData(r)
    setAt(Date.now())
    setState('idle')
  }, [pin])

  useEffect(() => {
    void load()
    const t = window.setInterval(() => void load(), REFRESH_MS)
    return () => window.clearInterval(t)
  }, [load])

  if (!BACKEND && !DEMO) return <Shell><Empty title="Belum tersambung" text="VITE_BACKEND_URL belum diisi — lihat apps-script/README.md." /></Shell>
  if (!pin) return <Shell><PinGate wrong={state === 'pin'} onOk={setPin} /></Shell>

  return (
    <Shell>
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.3em] text-terracotta">{EVENT.table} · {EVENT.name}</p>
          <h1 className="font-display text-4xl font-bold leading-none">Hasil Feedback</h1>
          <p className="mt-1.5 font-cond text-base italic text-brown-soft">
            {state === 'error' ? 'Gagal ambil data — coba lagi' : at ? `Diperbarui ${hhmm(at)} · otomatis tiap 30 detik` : 'Mengambil data…'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Btn onClick={() => void load()} icon={<RefreshCw className={`size-4 ${state === 'loading' ? 'animate-spin' : ''}`} />}>Muat ulang</Btn>
          {data && <Btn onClick={() => downloadCsv(data.responses)} icon={<Download className="size-4" />}>Unduh CSV</Btn>}
          {data && <Btn href={data.sheetUrl} icon={<ExternalLink className="size-4" />} solid>Buka Google Sheet</Btn>}
        </div>
      </header>

      <MenuAdmin />
      <AdminPanel demo={DEMO} save={(m) => (DEMO ? wait(1200).then(() => true) : setFeedbackModeRemote(pin, m))} />
      <PreorderAdmin
        remote={DEMO ? demoPreorder : preorder.config}
        loaded={DEMO || preorder.loaded}
        save={async (c) => {
          if (!DEMO) return savePreorderConfig(pin, c)
          await wait(1200)
          setDemoPreorder(c)
          return true
        }}
      />
      {data?.orders && (
        <Orders
          orders={data.orders}
          setDone={async (code, done) => {
            if (DEMO) {
              await wait(1200)
              setData((d) => d && { ...d, orders: d.orders?.map((o) => (o.code === code ? { ...o, done } : o)) })
              return true
            }
            const ok = await setOrderDone(pin, code, done)
            if (ok) void load()
            return ok
          }}
        />
      )}
      {data && <Summary data={data} />}
    </Shell>
  )
}

/* ------------------------------------------------------------------ admin */

const MODES: Array<{ id: FeedbackMode; label: string; hint: string }> = [
  { id: 'auto', label: 'Auto', hint: 'ikut jadwal' },
  { id: 'open', label: 'Buka', hint: 'paksa buka' },
  { id: 'closed', label: 'Tutup', hint: 'paksa tutup' },
]

/** the ONLY place the feedback form is opened / closed — saved in the Sheet, every phone follows */
function AdminPanel({ save, demo }: { save: (m: FeedbackMode) => Promise<boolean>; demo?: boolean }) {
  const live = useFeedbackOpen()
  const [demoMode, setDemoMode] = useState<FeedbackMode>('auto')
  const mode = demo ? demoMode : live.mode
  // the pill moves on click; it stays yellow until the Sheet reports the same mode back
  const [pending, setPending] = useState<FeedbackMode | null>(null)
  const [failed, setFailed] = useState(false)
  const latest = useRef(0)
  useEffect(() => {
    if (pending && mode === pending) setPending(null)
  }, [mode, pending])
  const shown = pending ?? mode
  const open = demo ? shown === 'open' : live.open
  const pick = async (m: FeedbackMode) => {
    if (m === shown) return
    const n = ++latest.current
    setPending(m)
    setFailed(false)
    const ok = await save(m)
    if (n !== latest.current) return
    if (!ok) {
      setPending(null)
      setFailed(true)
    } else if (demo) setDemoMode(m)
  }
  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-brown p-5 text-cream">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-cream/10"><ShieldCheck className="size-5 text-yakult" /></span>
        <div>
          <p className="font-display text-lg font-bold leading-tight">
            Form feedback{' '}
            <span className={`ml-1 rounded-full px-2.5 py-0.5 align-middle font-cond text-sm font-semibold italic ${pending ? 'text-brown' : open ? 'bg-leaf' : 'bg-cream/15 text-cream/70'}`} style={pending ? { background: WAIT } : undefined}>
              {pending ? 'menyimpan…' : open ? 'terbuka' : 'tertutup'}
            </span>
          </p>
          <p className="font-cond text-sm italic text-cream/60">
            {failed
              ? 'Gagal menyimpan — cek sinyal / PIN'
              : pending
                ? 'Menunggu Google Sheet… semua HP ikut dalam ±30 detik'
                : mode === 'auto'
                  ? `Auto: buka ${EVENT.timeLabel.split(' –')[0]} s/d ${hhmm(live.until)} (25 menit setelah tutup)`
                  : 'Manual — semua HP ikut dalam ±30 detik'}
          </p>
        </div>
      </div>
      <div className="relative grid grid-cols-3 gap-1 rounded-2xl bg-cream/10 p-1">
        {MODES.map((m) => {
          const on = shown === m.id
          const syncing = on && !!pending
          return (
            <button key={m.id} onClick={() => void pick(m.id)} aria-pressed={on} className={`relative min-w-24 rounded-xl px-3 py-2 text-center ${syncing ? 'text-brown' : ''}`}>
              {on && <motion.span layoutId="admin-mode" className="absolute inset-0 rounded-xl" style={{ background: syncing ? WAIT : 'var(--color-terracotta)' }} transition={spring.snappy} />}
              <span className="relative flex items-center justify-center gap-1.5 font-display text-sm font-semibold">
                {syncing && <Loader2 className="size-3.5 animate-spin" />}
                {m.label}
              </span>
              <span className={`relative block font-cond text-[0.7rem] italic ${syncing ? 'text-brown/70' : 'text-cream/60'}`}>{syncing ? 'menyimpan…' : m.hint}</span>
            </button>
          )
        })}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ live menu */

const nextDrink = (id: DrinkId) => DRINKS[(DRINKS.findIndex((d) => d.id === id) + 1) % DRINKS.length].id

/**
 * What's still on sale, from any crew phone: mark drinks SOLD (bundles with that drink follow),
 * swap a bundle's cups, close early, restock. Saved in the Sheet; the booth screen and every
 * phone follow. Anything not in the Sheet yet is yellow.
 */
function MenuAdmin() {
  const menu = useMenu()
  const sync = useMenuSync()
  const { phase } = useEventPhase()
  const selling = phase === 'open' || phase === 'last-call'
  const r = sync.remote
  const drinkWait = (id: DrinkId) => sync.pending && (!r || r.drinks.find((d) => d.id === id)?.soldOut !== menu.drinks.find((d) => d.id === id)?.soldOut)
  const bundleWait = (name: string) => {
    if (!sync.pending) return false
    const a = menu.bundles.find((b) => b.name === name)
    const b = r?.bundles.find((x) => x.name === name)
    return !b || a?.items.join() !== b.items.join() || a?.reason !== b.reason
  }
  const yellow = (on: boolean) => (on ? { boxShadow: `inset 0 0 0 2px ${WAIT}` } : undefined)

  return (
    <Card
      className="mt-6"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <UtensilsCrossed className="size-5 text-terracotta" /> Menu hari ini
          <span
            className={`rounded-full px-2.5 py-0.5 font-cond text-sm font-semibold italic ${sync.pending ? 'text-brown' : menu.closedEarly ? 'bg-brown text-cream' : menu.allSoldOut ? 'bg-terracotta text-cream' : 'bg-leaf text-cream'}`}
            style={sync.pending ? { background: WAIT } : undefined}
          >
            {sync.pending ? 'menyimpan…' : menu.closedEarly ? 'booth ditutup' : menu.allSoldOut ? 'semua habis' : menu.anySoldOut ? 'sebagian habis' : 'semua tersedia'}
          </span>
        </span>
      }
      meta={sync.failed ? 'Gagal menyimpan — cek sinyal / PIN' : 'Layar booth & semua HP ikut dalam ±10–30 detik'}
    >
      <p className="mb-2 font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-brown/50">Minuman — ketuk kalau habis</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {menu.drinks.map((d) => {
          const wait = drinkWait(d.id)
          return (
            <button
              key={d.id}
              onClick={() => setDrinkSold(d.id, !d.soldOut)}
              aria-pressed={d.soldOut}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${d.soldOut ? 'border-terracotta bg-terracotta/10' : 'border-brown/10 bg-cream'}`}
              style={wait ? { borderColor: WAIT } : undefined}
            >
              <img src={d.image} alt="" className={`h-12 w-auto shrink-0 object-contain ${d.soldOut ? 'opacity-60 grayscale' : ''}`} />
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block font-display font-semibold">{d.short}</span>
                <span className="font-cond text-sm italic text-brown/60">{d.soldOut ? `SOLD · ${hhmm(d.soldAt!)}` : `${d.price}K · tersedia`}</span>
              </span>
              {wait ? <Loader2 className="size-5 shrink-0 animate-spin text-brown" /> : d.soldOut ? <Ban className="size-5 shrink-0 text-terracotta" /> : <Check className="size-5 shrink-0 text-leaf" />}
            </button>
          )
        })}
      </div>

      <p className="mb-2 mt-5 font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-brown/50">Paket — ketuk gelasnya untuk ganti isi</p>
      <div className="flex flex-col gap-2">
        {menu.bundles.map((b) => {
          const wait = bundleWait(b.name)
          return (
            <div key={b.name} className={`flex flex-wrap items-center gap-3 rounded-2xl border-2 p-2.5 ${b.soldOut ? 'border-terracotta/50 bg-terracotta/5' : 'border-brown/10 bg-cream'}`} style={wait ? { borderColor: WAIT } : undefined}>
              <div className="flex gap-1">
                {b.items.map((id, slot) => {
                  const d = menu.drinks.find((x) => x.id === id)!
                  return (
                    <motion.button
                      key={slot}
                      title="Ganti isi"
                      whileTap={{ scale: 0.85 }}
                      onClick={() => setBundleItems(b.name, b.items.map((x, i) => (i === slot ? nextDrink(x) : x)))}
                      className="grid size-12 place-items-center rounded-xl bg-cream-deep/70"
                    >
                      <img src={d.image} alt={d.short} className={`h-10 w-auto object-contain ${d.soldOut ? 'opacity-50 grayscale' : ''}`} />
                    </motion.button>
                  )
                })}
              </div>
              <div className="min-w-0 flex-1 basis-40 leading-tight">
                <p className="font-display font-semibold">
                  {b.name.replace('Paket ', '')} · {b.price}K {b.edited && <span className="ml-1 rounded-full bg-spice/25 px-1.5 font-cond text-xs italic">diubah</span>}
                </p>
                <p className="font-cond text-sm italic text-brown/60">{b.detail}</p>
              </div>
              <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 font-cond text-xs font-semibold italic ${wait ? 'text-brown' : b.soldOut ? 'bg-terracotta text-cream' : 'bg-leaf text-cream'}`} style={wait ? { background: WAIT } : undefined}>
                {wait && <Loader2 className="size-3 animate-spin" />}
                {b.soldOut ? (b.reason === 'manual' ? 'SOLD · manual' : `SOLD · ${b.reason} habis`) : 'tersedia'}
              </span>
              <div className="flex gap-1">
                {b.edited && (
                  <button onClick={() => setBundleItems(b.name, null)} className="rounded-full border-2 border-brown/15 px-3 py-1 font-display text-xs font-semibold">
                    isi asli
                  </button>
                )}
                <button onClick={() => setBundleForced(b.name, b.reason !== 'manual')} className="rounded-full border-2 border-brown/15 px-3 py-1 font-display text-xs font-semibold">
                  {b.reason === 'manual' ? 'buka lagi' : 'paksa sold'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-brown/10 pt-4">
        <p className="max-w-md font-cond text-sm italic text-brown/60">
          Semua minuman habis → layar booth otomatis menampilkan &ldquo;Ludes terjual&rdquo;. Kalau mau langsung pamit, tekan Tutup sekarang.
        </p>
        <div className="flex flex-wrap gap-2">
          {(menu.closedEarly || (menu.allSoldOut && selling)) && (
            <button
              onClick={() => setClosedEarly(!menu.closedEarly)}
              className="flex items-center gap-2 rounded-full bg-brown px-4 py-2.5 font-display text-sm font-semibold text-cream"
              style={yellow(sync.pending && !!r && r.closedEarly !== menu.closedEarly)}
            >
              <DoorClosed className="size-4" /> {menu.closedEarly ? 'Buka booth lagi' : 'Tutup sekarang'}
            </button>
          )}
          <button
            onClick={resetMenu}
            disabled={!menu.anySoldOut && !menu.bundles.some((b) => b.edited) && !menu.closedEarly}
            className="flex items-center gap-2 rounded-full bg-leaf px-4 py-2.5 font-display text-sm font-semibold text-cream disabled:opacity-40"
          >
            {menu.allSoldOut ? <PackageCheck className="size-4" /> : <RotateCcw className="size-4" />} Restock semua
          </button>
        </div>
      </div>
    </Card>
  )
}

/* ------------------------------------------------------------------ pre-order admin */

/** the shape the Sheet stores (rounded, clamped, every item present) — so "same as the Sheet" is a string compare */
const normPreorder = (c: PreorderConfig): PreorderConfig => ({
  enabled: !!c.enabled,
  cutoff: Math.min(c.cutoff, DEFAULT_CUTOFF),
  items: Object.fromEntries(
    PREORDER_ITEMS.map((i) => {
      const s = c.items[i.id] ?? { on: true, price: i.price }
      return [i.id, { on: s.on !== false, price: Math.max(1, Math.min(500, Math.round(s.price || i.price))) }]
    }),
  ),
})
const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)
/** <input type="datetime-local"> speaks WIB regardless of the laptop's timezone */
const toWib = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 16)
const fromWib = (v: string) => new Date(`${v}:00+07:00`).getTime()

function PreorderAdmin({ remote, loaded, save }: { remote: PreorderConfig; loaded: boolean; save: (c: PreorderConfig) => Promise<boolean> }) {
  // local edits live here until the Sheet reports the same thing back; anything that differs is yellow
  const [draft, setDraft] = useState<PreorderConfig | null>(null)
  const [failed, setFailed] = useState(false)
  const seq = useRef(0)
  const saved = normPreorder(remote)
  const cfg = draft ?? remote
  const want = draft && normPreorder(draft)

  useEffect(() => {
    if (draft && sameJson(normPreorder(draft), normPreorder(remote))) setDraft(null)
  }, [draft, remote])

  // one save shortly after the last change, so typing a price isn't a save per key
  const saveRef = useRef(save)
  saveRef.current = save
  useEffect(() => {
    // a price box left empty mid-typing isn't saved (the Sheet would fall back to the menu price)
    if (!draft || PREORDER_ITEMS.some((i) => !(draft.items[i.id]?.price > 0))) return
    const n = ++seq.current
    const t = window.setTimeout(async () => {
      const ok = await saveRef.current(normPreorder(draft))
      if (!ok && n === seq.current) {
        setDraft(null)
        setFailed(true)
      }
    }, 800)
    return () => window.clearTimeout(t)
  }, [draft])

  const edit = (f: (c: PreorderConfig) => PreorderConfig) => {
    setFailed(false)
    setDraft((d) => f(d ?? remote))
  }
  const setItem = (id: string, patch: Partial<{ on: boolean; price: number }>) =>
    edit((c) => ({ ...c, items: { ...c.items, [id]: { ...(c.items[id] ?? { on: true, price: 0 }), ...patch } } }))

  const pending = !!want
  const open = cfg.enabled && Date.now() < Math.min(cfg.cutoff, DEFAULT_CUTOFF)
  const dirty = (pick: (c: PreorderConfig) => unknown) => !!want && !sameJson(pick(want), pick(saved))

  return (
    <Card
      className="mt-6"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <ShoppingBag className="size-5 text-terracotta" /> Pre-order
          <span className={`rounded-full px-2.5 py-0.5 font-cond text-sm font-semibold italic ${pending ? 'text-brown' : open ? 'bg-leaf text-cream' : 'bg-brown/10 text-brown/60'}`} style={pending ? { background: WAIT } : undefined}>
            {pending ? 'menyimpan…' : open ? 'terbuka' : cfg.enabled ? 'lewat batas' : 'tertutup'}
          </span>
        </span>
      }
      meta={failed ? 'Gagal menyimpan — cek sinyal / PIN' : loaded ? 'Tersimpan di Google Sheet · HP pelanggan ikut dalam ±30 detik' : 'Memuat pengaturan…'}
    >
      <div className={`grid gap-3 sm:grid-cols-2 ${loaded ? '' : 'pointer-events-none opacity-50'}`}>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-cream-deep/60 p-4">
          <span>
            <span className="block font-display font-semibold">Terima pre-order</span>
            <span className="font-cond text-sm italic text-brown/60">Link muncul di halaman QR · <a href="/preorder" target="_blank" className="underline">lihat /preorder</a></span>
          </span>
          <Switch on={cfg.enabled} pending={dirty((c) => c.enabled)} onClick={() => edit((c) => ({ ...c, enabled: !c.enabled }))} label="Terima pre-order" />
        </label>
        <label className="flex items-center justify-between gap-3 rounded-2xl bg-cream-deep/60 p-4" style={dirty((c) => c.cutoff) ? { boxShadow: `inset 0 0 0 2px ${WAIT}` } : undefined}>
          <span>
            <span className="block font-display font-semibold">Batas pesan (WIB)</span>
            <span className="font-cond text-sm italic text-brown/60">Paling lambat H-1 ({dayTime(DEFAULT_CUTOFF)}) — hari-H tidak ada pre-order</span>
          </span>
          <input
            type="datetime-local"
            value={toWib(Math.min(cfg.cutoff, DEFAULT_CUTOFF))}
            max={toWib(DEFAULT_CUTOFF)}
            onChange={(e) => e.target.value && edit((c) => ({ ...c, cutoff: Math.min(fromWib(e.target.value), DEFAULT_CUTOFF) }))}
            className="rounded-xl bg-cream px-2.5 py-2 font-cond text-sm outline-none focus:ring-2 focus:ring-terracotta"
          />
        </label>
      </div>

      <ul className={`mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 ${loaded ? '' : 'pointer-events-none opacity-50'}`}>
        {PREORDER_ITEMS.map((it) => {
          const s = cfg.items[it.id] ?? { on: true, price: it.price }
          const syncing = dirty((c) => c.items[it.id])
          return (
            <li key={it.id} className={`flex items-center gap-3 rounded-2xl border-2 p-3 transition-opacity ${s.on ? '' : 'opacity-55'}`} style={{ borderColor: syncing ? WAIT : 'rgb(90 46 26 / 0.08)' }}>
              <span className="flex shrink-0 -space-x-3">
                {it.images.map((src, i) => <img key={i} src={src} alt="" className="h-11 w-auto drop-shadow" />)}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-display text-sm font-semibold">{it.name}</span>
                <span className="mt-1 flex items-center font-cond text-sm">
                  Rp
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={500}
                    value={s.price || ''}
                    onChange={(e) => setItem(it.id, { price: Math.min(500, Math.max(0, Math.round(Number(e.target.value)))) })}
                    aria-label={`Harga ${it.name} (ribu)`}
                    className="mx-1 w-12 rounded-lg bg-cream-deep/70 px-1.5 py-0.5 text-right font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-terracotta"
                  />
                  .000
                  {s.price !== it.price && <span className="ml-1.5 italic text-brown/45">(menu {it.price}K)</span>}
                </span>
              </span>
              <Switch on={s.on} pending={syncing} onClick={() => setItem(it.id, { on: !s.on })} label={`Jual ${it.name}`} />
            </li>
          )
        })}
      </ul>
    </Card>
  )
}

function Switch({ on, pending, onClick, label }: { on: boolean; pending: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className={`relative flex h-7 w-12 shrink-0 items-center rounded-full p-1 transition-colors ${on ? 'justify-end' : 'justify-start'} ${pending ? '' : on ? 'bg-leaf' : 'bg-brown/20'}`}
      style={pending ? { background: WAIT } : undefined}
    >
      <motion.span layout transition={spring.snappy} className="grid size-5 place-items-center rounded-full bg-cream shadow">
        {pending && <Loader2 className="size-3 animate-spin text-brown" />}
      </motion.span>
    </button>
  )
}

/* ------------------------------------------------------------------ orders */

/** 0812… / +62812… / 812… → 62812… for wa.me */
const waLink = (wa: string, code: string) => {
  let d = wa.replace(/\D/g, '')
  if (d.startsWith('0')) d = '62' + d.slice(1)
  else if (d.startsWith('8')) d = '62' + d
  return `https://wa.me/${d}?text=${encodeURIComponent(`Halo kak! Dari Pletok, soal pre-order ${code} `)}`
}

function Orders({ orders, setDone }: { orders: Order[]; setDone: (code: string, done: boolean) => Promise<boolean> }) {
  // ticked here, not confirmed by the Sheet yet → yellow
  const [pending, setPending] = useState<Record<string, boolean>>({})
  const [failed, setFailed] = useState<string | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => {
    setPending((p) => {
      const left = Object.fromEntries(Object.entries(p).filter(([code, done]) => orders.find((o) => o.code === code)?.done !== done))
      return Object.keys(left).length === Object.keys(p).length ? p : left
    })
  }, [orders])
  const isDone = (o: Order) => pending[o.code] ?? o.done
  const toggle = async (o: Order) => {
    const next = !isDone(o)
    setPending((p) => ({ ...p, [o.code]: next }))
    setFailed(null)
    if (!(await setDone(o.code, next))) {
      setPending(({ [o.code]: _, ...rest }) => rest)
      setFailed(o.code)
    }
  }

  const doneCount = orders.filter(isDone).length
  const revenue = orders.reduce((a, o) => a + o.total, 0)
  // cups to make, split by what's still waiting for pickup
  const prep = DRINKS.map((d) => {
    const cups = (os: Order[]) => os.reduce((a, o) => a + o.lines.reduce((b, l) => b + l.qty * (PREORDER_ITEMS.find((i) => i.id === l.id)?.drinks.filter((x) => x === d.id).length ?? 0), 0), 0)
    return { d, total: cups(orders), left: cups(orders.filter((o) => !isDone(o))) }
  })
  const needle = q.trim().toLowerCase()
  const list = orders
    .filter((o) => !needle || `${o.code} ${o.name} ${o.wa}`.toLowerCase().includes(needle))
    .sort((a, b) => Number(a.done) - Number(b.done) || a.at - b.at)

  return (
    <Card
      className="mt-4"
      title={
        <span className="flex items-center gap-2">
          <ShoppingBag className="size-5 text-terracotta" /> Daftar pre-order
        </span>
      }
      meta={failed ? `Gagal menandai ${failed} — coba lagi` : 'Ambil di booth · cocokkan kode + nama, lalu tandai selesai'}
    >
      <div className="grid gap-3 sm:grid-cols-3">
        <Tile Icon={ShoppingBag} label="Pesanan" value={orders.length} sub={`${doneCount} sudah diambil · ${orders.length - doneCount} menunggu`} />
        <Tile Icon={Wallet} label="Total pre-order" value={rupiah(revenue)} sub="bayar di booth saat ambil" />
        <div className="rounded-3xl border border-brown/10 bg-cream/80 p-5">
          <span className="font-cond text-sm italic text-brown-soft">Cup yang perlu disiapkan</span>
          <ul className="mt-2 space-y-1">
            {prep.map(({ d, total, left }) => (
              <li key={d.id} className="flex items-baseline justify-between gap-2 font-display text-sm">
                <span className="font-semibold">{d.short}</span>
                <span className="tabular-nums">
                  <b className="text-lg">{left}</b> <span className="font-cond italic text-brown/55">sisa dari {total}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <label className="flex flex-1 items-center gap-2 rounded-full bg-cream-deep/70 px-4 py-2.5">
          <Search className="size-4 text-brown/50" />
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Cari nama / kode / nomor" className="w-full bg-transparent font-cond outline-none" />
        </label>
        <Btn onClick={() => downloadOrders(orders)} icon={<Download className="size-4" />}>Unduh CSV</Btn>
      </div>

      {list.length === 0 ? (
        <p className="py-8 text-center font-cond italic text-brown/55">{orders.length ? 'Tidak ada yang cocok' : 'Belum ada pre-order'}</p>
      ) : (
        <ul className="mt-3 divide-y divide-brown/10">
          {list.map((o) => {
            const done = isDone(o)
            const syncing = o.code in pending
            return (
              <motion.li layout key={o.code} transition={spring.snappy} className={`flex flex-wrap items-center gap-x-4 gap-y-2 py-3 ${done && !syncing ? 'opacity-55' : ''}`}>
                <button
                  onClick={() => void toggle(o)}
                  aria-pressed={done}
                  aria-label={done ? `Batalkan selesai ${o.code}` : `Tandai ${o.code} selesai`}
                  className={`grid size-9 shrink-0 place-items-center rounded-full border-2 transition-colors ${syncing ? 'border-transparent text-brown' : done ? 'border-leaf bg-leaf text-cream' : 'border-brown/25 text-transparent hover:border-leaf hover:text-leaf/50'}`}
                  style={syncing ? { background: WAIT } : undefined}
                >
                  {syncing ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" strokeWidth={3} />}
                </button>
                <div className="min-w-0 flex-1 basis-56">
                  <p className="font-display font-semibold">
                    <span className="mr-2 rounded-md bg-brown px-1.5 py-0.5 font-cond text-sm tracking-wide text-cream">{o.code}</span>
                    {o.name}
                    <span className="ml-2 font-cond text-sm font-normal italic text-brown/55">{dayTime(o.at)}</span>
                  </p>
                  <p className="mt-0.5 font-cond text-brown-soft">{o.summary}</p>
                  {o.note && <p className="font-cond text-sm italic text-terracotta">“{o.note}”</p>}
                </div>
                <span className="font-display font-bold tabular-nums">{rupiah(o.total)}</span>
                <a href={waLink(o.wa, o.code)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-leaf px-3.5 py-2 font-display text-sm font-semibold text-cream">
                  <MessageCircle className="size-4" /> Hubungi
                </a>
              </motion.li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}

/* ------------------------------------------------------------------ the summary */

function Summary({ data }: { data: Results }) {
  const rs = data.responses
  const rated = rs.filter((r) => r.rating)
  const avg = rated.length ? rated.reduce((a, r) => a + r.rating!, 0) / rated.length : null
  const ratingCounts = [1, 2, 3, 4, 5].map((n) => rated.filter((r) => r.rating === n).length)
  const withFav = rs.filter((r) => r.favorites.trim())
  const favCounts = DRINKS.map((d) => ({ label: d.short, img: d.image, n: withFav.filter((r) => r.favorites.split(', ').includes(d.short)).length })).sort((a, b) => b.n - a.n)
  const topFav = Math.max(0, ...favCounts.map((f) => f.n))
  const lovesAll = withFav.filter((r) => DRINKS.every((d) => r.favorites.split(', ').includes(d.short))).length
  const contacts = rs.filter((r) => r.consent && r.contact.trim())
  const boothScans = data.scans.filter((s) => s.target === 'link' || s.target === 'ig').length

  return (
    <>
      <div className="mt-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile Icon={MessageCircleHeart} label="feedback masuk" value={rs.length} />
        <Tile Icon={Star} label="rating rata-rata" value={avg === null ? '–' : avg.toFixed(1)} unit={avg === null ? '' : '/ 5'} />
        <Tile Icon={ScanLine} label="scan QR booth" value={boothScans} sub={boothScans ? `${pct(rs.length, boothScans)}% lanjut isi feedback` : undefined} />
        <Tile Icon={Users} label="mau dihubungi lagi" value={contacts.length} />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card title="Seberapa enak?" meta={`${rated.length} jawaban`}>
          <ColumnChart
            bars={ratingCounts.map((n, i) => ({ label: RATING_LABELS[i], sub: String(i + 1), n }))}
            total={rated.length}
            tip={(b) => `${b.sub} · ${b.label}: ${b.n} orang (${pct(b.n, rated.length)}%)`}
          />
        </Card>

        <Card title="Menu favorit" meta={`${withFav.length} jawaban · bisa pilih lebih dari satu`}>
          <div className="flex flex-col gap-3 pt-1">
            {favCounts.map((f) => (
              <HBar key={f.label} label={f.label} img={f.img} n={f.n} share={pct(f.n, withFav.length)} top={f.n > 0 && f.n === topFav} />
            ))}
          </div>
          {lovesAll > 0 && <p className="mt-4 font-cond text-sm italic text-brown-soft">{lovesAll} orang suka semua menu</p>}
        </Card>
      </div>

      <Card title="Feedback masuk per 15 menit" meta="jam WIB" className="mt-4">
        <Timeline responses={rs} />
      </Card>

      <h2 className="mt-10 font-display text-2xl font-bold">Jawaban tertulis</h2>
      <p className="font-cond text-base italic text-brown-soft">Feedback-Capture Grid — terbaru di atas</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        {GRID.map(({ key, title, sub, Icon }) => {
          const items = rs.filter((r) => r[key].trim()).sort((a, b) => b.at - a.at)
          return (
            <Card key={key} title={<span className="flex items-center gap-2"><Icon className="size-5 text-terracotta" /> {title} <span className="font-cond text-base font-normal italic text-brown-soft">{sub}</span></span>} meta={`${items.length} jawaban`}>
              {items.length ? (
                <ul className="-mx-1 flex max-h-80 flex-col gap-2 overflow-y-auto px-1">
                  {items.map((r, i) => (
                    <li key={i} className="rounded-2xl bg-cream-deep/60 px-4 py-3">
                      <p className="whitespace-pre-line font-display text-[0.95rem] leading-snug">{r[key]}</p>
                      <p className="mt-1 font-cond text-xs italic text-brown/50">{r.name || 'Anonim'} · {dayTime(r.at)}</p>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="font-cond italic text-brown/45">Belum ada jawaban</p>
              )}
            </Card>
          )
        })}
      </div>

      <Card title="Boleh dihubungi" meta={`${contacts.length} orang · rahasia tim`} className="mt-4">
        {contacts.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[28rem] text-left font-display text-sm">
              <thead className="font-cond text-xs uppercase italic tracking-wider text-brown/50">
                <tr><th className="pb-2 font-semibold">Nama</th><th className="pb-2 font-semibold">Kontak</th><th className="pb-2 font-semibold">Rating</th><th className="pb-2 font-semibold">Waktu</th></tr>
              </thead>
              <tbody>
                {contacts.map((r, i) => (
                  <tr key={i} className="border-t border-brown/10">
                    <td className="py-2 pr-3">{r.name || '–'}</td>
                    <td className="py-2 pr-3 font-semibold">{r.contact}</td>
                    <td className="py-2 pr-3">{r.rating ?? '–'}</td>
                    <td className="py-2 text-brown/60">{dayTime(r.at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="font-cond italic text-brown/45">Belum ada</p>
        )}
      </Card>
    </>
  )
}

/* ------------------------------------------------------------------ charts (plain HTML, one hue) */

interface ColBar {
  label: string
  sub: string
  n: number
}

/** vertical bars on a shared baseline; count on top, hover for the full sentence */
function ColumnChart({ bars, total, tip }: { bars: ColBar[]; total: number; tip: (b: ColBar) => string }) {
  const [hover, setHover] = useState<number | null>(null)
  const max = Math.max(1, ...bars.map((b) => b.n))
  return (
    <div className="relative">
      <div className="relative flex h-48 items-end gap-[2px] border-b border-brown/20" onPointerLeave={() => setHover(null)}>
        {/* recessive gridlines at half and full */}
        {[0.5, 1].map((g) => (
          <span key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-brown/10" style={{ bottom: `${g * 100}%` }} />
        ))}
        {bars.map((b, i) => (
          <div
            key={b.label}
            className="relative flex h-full flex-1 cursor-default flex-col items-center justify-end px-[6%]"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
          >
            <span className="mb-1 font-display text-sm font-semibold tabular-nums text-brown">{b.n || ''}</span>
            <motion.span
              className="w-full max-w-16 rounded-t-[4px]"
              style={{ background: BAR, opacity: hover === null || hover === i ? 1 : 0.45 }}
              initial={{ height: 0 }}
              animate={{ height: `${(b.n / max) * 82}%` }}
              transition={spring.glide}
            />
            {hover === i && <Tooltip>{tip(b)}</Tooltip>}
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-[2px]">
        {bars.map((b) => (
          <div key={b.label} className="flex-1 text-center leading-tight">
            <span className="block font-display text-sm font-semibold">{b.sub}</span>
            <span className="block font-cond text-xs italic text-brown/55">{b.label}</span>
          </div>
        ))}
      </div>
      {!total && <p className="absolute inset-x-0 top-16 text-center font-cond italic text-brown/45">Belum ada rating</p>}
    </div>
  )
}

/** one row of a checkbox question: picture, name, bar (% of people who answered), count */
function HBar({ label, img, n, share, top }: { label: string; img: string; n: number; share: number; top: boolean }) {
  const [hover, setHover] = useState(false)
  return (
    <div className="relative flex items-center gap-3" onPointerEnter={() => setHover(true)} onPointerLeave={() => setHover(false)}>
      <img src={img} alt="" className="h-10 w-8 shrink-0 object-contain" />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <span className="flex items-center gap-2 font-display font-semibold">
            {label}
            {/* every drink tied for first gets it */}
            {top && <span className="inline-flex items-center gap-1 rounded-full bg-terracotta px-2 py-0.5 font-cond text-xs font-semibold italic text-cream"><Crown className="size-3" /> Favorit</span>}
          </span>
          <span className="font-display text-sm tabular-nums text-brown-soft">
            {n} <span className="text-brown/45">· {share}%</span>
          </span>
        </div>
        <div className="mt-1 h-3 rounded-[4px] bg-brown/[0.07]">
          <motion.div className="h-full rounded-[4px]" style={{ background: BAR }} initial={{ width: 0 }} animate={{ width: `${share}%` }} transition={spring.glide} />
        </div>
      </div>
      {hover && <Tooltip>{`${label}: dipilih ${n} orang — ${share}% dari yang menjawab`}</Tooltip>}
    </div>
  )
}

/** feedback per 15 min across the event (stretches if answers came in outside the hours) */
function Timeline({ responses }: { responses: Response[] }) {
  const [hover, setHover] = useState<number | null>(null)
  const step = BUCKET_MIN * 60_000
  const buckets = useMemo(() => {
    const times = responses.map((r) => r.at)
    const from = Math.floor(Math.min(EVENT.open.getTime(), ...times) / step) * step
    const to = Math.ceil(Math.max(EVENT.close.getTime() + 30 * 60_000, ...times) / step) * step
    const out: Array<{ at: number; n: number }> = []
    // a test row from days earlier would stretch this into hundreds of empty bars — cap it
    for (let t = Math.max(from, to - 48 * step); t < to; t += step) out.push({ at: t, n: times.filter((x) => x >= t && x < t + step).length })
    return out
  }, [responses, step])
  const max = Math.max(1, ...buckets.map((b) => b.n))

  return (
    <div>
      <div className="relative flex h-40 items-end gap-[2px] border-b border-brown/20">
        {[0.5, 1].map((g) => (
          <span key={g} className="pointer-events-none absolute inset-x-0 border-t border-dashed border-brown/10" style={{ bottom: `${g * 100}%` }} />
        ))}
        {buckets.map((b, i) => (
          <div key={b.at} className="relative flex h-full flex-1 items-end" onPointerEnter={() => setHover(i)} onPointerLeave={() => setHover(null)}>
            <motion.span
              className="w-full rounded-t-[4px]"
              style={{ background: BAR, opacity: hover === null || hover === i ? 1 : 0.45, minHeight: b.n ? 4 : 0 }}
              initial={{ height: 0 }}
              animate={{ height: `${(b.n / max) * 92}%` }}
              transition={spring.glide}
            />
            {hover === i && <Tooltip>{`${hhmm(b.at)}–${hhmm(b.at + step)} · ${b.n} feedback`}</Tooltip>}
          </div>
        ))}
      </div>
      {/* hour ticks only — every bar would be unreadable */}
      <div className="mt-1.5 flex gap-[2px]">
        {buckets.map((b) => (
          <span key={b.at} className="flex-1 text-center font-cond text-xs italic text-brown/55">
            {new Date(b.at).getUTCMinutes() === 0 ? hhmm(b.at).slice(0, 2) : ''}
          </span>
        ))}
      </div>
    </div>
  )
}

function Tooltip({ children }: { children: string }) {
  return (
    <span className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 -translate-x-1/2 whitespace-nowrap rounded-xl bg-brown px-3 py-1.5 font-display text-xs font-semibold text-cream shadow-lg">
      {children}
    </span>
  )
}

/* ------------------------------------------------------------------ bits */

function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="paper min-h-dvh px-4 py-8 text-brown sm:px-8">
      <div className="mx-auto max-w-6xl">{children}</div>
    </main>
  )
}

function Card({ title, meta, children, className = '' }: { title: ReactNode; meta?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl border border-brown/10 bg-cream/80 p-5 shadow-[0_10px_30px_-22px_rgb(90_46_26/0.5)] ${className}`}>
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="font-display text-xl font-bold">{title}</h3>
        {meta && <span className="font-cond text-sm italic text-brown/55">{meta}</span>}
      </div>
      {children}
    </section>
  )
}

function Tile({ Icon, label, value, unit, sub }: { Icon: typeof Star; label: string; value: number | string; unit?: string; sub?: string }) {
  return (
    <div className="rounded-3xl border border-brown/10 bg-cream/80 p-5">
      <span className="flex items-center gap-2 font-cond text-sm italic text-brown-soft">
        <Icon className="size-4 text-terracotta" /> {label}
      </span>
      <p className="mt-1 font-display text-4xl font-bold tabular-nums leading-none">
        {value}
        {unit && <span className="ml-1 text-lg font-semibold text-brown/45">{unit}</span>}
      </p>
      {sub && <p className="mt-1.5 font-cond text-xs italic text-brown/55">{sub}</p>}
    </div>
  )
}

function Btn({ children, icon, onClick, href, solid }: { children: string; icon: ReactNode; onClick?: () => void; href?: string; solid?: boolean }) {
  const cls = `inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-display text-sm font-semibold ${solid ? 'bg-brown text-cream' : 'border-2 border-brown/15 bg-cream/70'}`
  return href ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{icon} {children}</a> : <button onClick={onClick} className={cls}>{icon} {children}</button>
}

function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-[70dvh] place-items-center text-center">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 font-cond text-lg italic text-brown-soft">{text}</p>
      </div>
    </div>
  )
}

function PinGate({ wrong, onOk }: { wrong: boolean; onOk: (pin: string) => void }) {
  const [pin, setPin] = useState('')
  const [bad, setBad] = useState(wrong)
  return (
    <form
      className="mx-auto mt-[18vh] flex max-w-xs flex-col items-center text-center"
      onSubmit={async (e) => {
        e.preventDefault()
        if (await setCrewPin(pin)) onOk(pin)
        else setBad(true)
      }}
    >
      <span className="grid size-14 place-items-center rounded-2xl bg-brown text-cream"><Lock className="size-6" /></span>
      <h1 className="mt-4 font-display text-2xl font-bold">Hasil Feedback</h1>
      <p className="mt-1 font-cond italic text-brown-soft">Khusus tim Pletok — masukkan PIN crew</p>
      <input
        value={pin}
        onChange={(e) => {
          setPin(e.target.value)
          setBad(false)
        }}
        type="password"
        inputMode="numeric"
        autoFocus
        placeholder="PIN"
        className="mt-5 w-full rounded-2xl bg-cream-deep/80 p-3.5 text-center font-display text-lg tracking-[0.4em] outline-none focus:ring-2 focus:ring-terracotta"
      />
      {bad && <p className="mt-2 font-cond text-sm italic text-terracotta">PIN salah atau belum ada sinyal</p>}
      <button className="mt-3 w-full rounded-full bg-terracotta py-3 font-display font-semibold text-cream">Masuk</button>
    </form>
  )
}

/** a CSV that Excel / Google Sheets / Docs open cleanly (BOM for Excel's UTF-8) */
function saveCsv(file: string, head: string[], rows: unknown[][]) {
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const blob = new Blob(['\ufeff' + [head, ...rows].map((r) => r.map(esc).join(',')).join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${file}-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

const downloadCsv = (rs: Response[]) =>
  saveCsv(
    'pletok-feedback',
    ['Waktu', 'Rating', 'Menu favorit', 'Like', 'Wishes', 'Questions', 'Ideas', 'Nama', 'Kontak', 'Boleh dihubungi', 'Sumber'],
    rs.map((r) => [dayTime(r.at), r.rating ?? '', r.favorites, r.like, r.wish, r.question, r.idea, r.name, r.consent ? r.contact : '', r.consent ? 'ya' : 'tidak', r.source]),
  )

const downloadOrders = (os: Order[]) =>
  saveCsv(
    'pletok-preorder',
    ['Waktu', 'Kode', 'Nama', 'WhatsApp', 'Pesanan', 'Total (Rp)', 'Catatan', 'Status'],
    os.map((o) => [dayTime(o.at), o.code, o.name, o.wa, o.summary, o.total * 1000, o.note, o.done ? 'selesai' : 'baru']),
  )

function demoResults(): Results {
  const open = EVENT.open.getTime()
  const words = {
    like: ['Jahenya hangat banget, pas!', 'Lychee-nya seger parah', 'Kemasannya lucu', 'Booth-nya rame dan ramah'],
    wish: ['Es-nya kebanyakan', 'Antriannya agak lama', 'Pengen ada ukuran besar'],
    question: ['Ini beneran 0% alkohol?', 'Jual online juga nggak?'],
    idea: ['Rasa mangga!', 'Paket buat ber-4', 'Kolab sama kopi'],
  }
  const favs = ['Original', 'Lychee Sparkling', 'Yakult', 'Original, Yakult', 'Original, Lychee Sparkling, Yakult', 'Lychee Sparkling']
  const responses = Array.from({ length: 46 }, (_, i) => {
    const pick = <T,>(a: T[]) => a[(i * 7 + a.length) % a.length]
    return {
      at: open + ((i * 37) % 170) * 60_000 + (i % 3) * 20_000,
      rating: [5, 4, 5, 3, 4, 5, 2, 4, 5, 4][i % 10],
      favorites: pick(favs),
      like: i % 2 ? pick(words.like) : '',
      wish: i % 3 === 0 ? pick(words.wish) : '',
      question: i % 5 === 0 ? pick(words.question) : '',
      idea: i % 4 === 0 ? pick(words.idea) : '',
      name: i % 3 ? `Pengunjung ${i + 1}` : '',
      contact: i % 4 === 1 ? `@contoh${i}` : '',
      consent: i % 4 === 1,
      source: 'link',
    }
  })
  const names = ['Nadia', 'Raka', 'Salsa', 'Bima', 'Citra', 'Dimas', 'Aurel', 'Fikri']
  const orders: Order[] = names.map((name, i) => {
    const lines = [PREORDER_ITEMS[i % 6], ...(i % 3 ? [] : [PREORDER_ITEMS[(i + 2) % 6]])].map((it, j) => ({ id: it.id, name: it.name, qty: 1 + ((i + j) % 2), price: it.price }))
    return {
      at: open - (30 - i * 3) * 3_600_000,
      code: `PLT-${String(i + 1).padStart(3, '0')}`,
      name,
      wa: `0812${String(10000000 + i * 1234567).slice(0, 8)}`,
      summary: lines.map((l) => `${l.qty}× ${l.name}`).join(', '),
      total: lines.reduce((a, l) => a + l.qty * l.price, 0),
      note: i % 4 === 1 ? 'Less sugar ya kak' : '',
      done: i < 2,
      lines,
    }
  })
  return { sheetUrl: '#', responses, orders, scans: Array.from({ length: 128 }, (_, i) => ({ at: open + i * 80_000, target: 'link' })) }
}

import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Ban, Check, DoorClosed, Loader2, PackageCheck, RotateCcw, ShieldCheck, ShoppingBag, UtensilsCrossed } from 'lucide-react'
import { EVENT } from '../data/event'
import { BUNDLES, DRINKS, type DrinkId } from '../data/menu'
import { DEFAULT_CUTOFF, DEFAULT_PREORDER, PREORDER_ITEMS } from '../data/preorder'
import { BACKEND, crewPin, savePreorderConfig, setFeedbackModeRemote, type PreorderConfig } from '../lib/backend'
import { usePreorder } from '../hooks/usePreorder'
import { resetMenu, setBundleForced, setBundleItems, setClosedEarly, setDrinkSold, setMenuPrice, useMenu, useMenuSync } from '../hooks/useMenu'
import { useEventPhase } from '../hooks/useEventPhase'
import { useFeedbackOpen, type FeedbackMode } from '../hooks/useFeedbackOpen'
import { spring } from '../lib/motion'
import { Card, CrewNav, DEMO, Empty, PinGate, Shell, Switch, WAIT, dayTime, hhmm, sameJson, useCrewPage, wait } from './adminUi'
import { SignalBars } from '../components/SignalBars'

/**
 * /config — crew settings (same PIN as /hasil): today's menu (sold out, bundle cups, prices,
 * close early), the feedback form switch, and pre-order (on/off, cut-off, items, prices).
 * Everything is saved in the Sheet and every screen follows; yellow = not in the Sheet yet.
 */
export function ConfigPage() {
  const [pin, setPin] = useState(DEMO ? 'demo' : crewPin)
  const preorder = usePreorder()
  const [demoPreorder, setDemoPreorder] = useState<PreorderConfig>(DEFAULT_PREORDER)
  useCrewPage('Config')

  if (!BACKEND && !DEMO) return <Shell><Empty title="Belum tersambung" text="VITE_BACKEND_URL belum diisi — lihat apps-script/README.md." /></Shell>
  if (!pin) return <Shell><PinGate title="Config Pletok" wrong={false} onOk={setPin} /></Shell>

  return (
    <Shell>
      <CrewNav at="config" />
      <header>
        <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.3em] text-terracotta">{EVENT.table} · {EVENT.name}</p>
        <h1 className="font-display text-4xl font-bold leading-none">Config</h1>
        <p className="mt-1.5 font-cond text-base italic text-brown-soft">Tersimpan di Google Sheet · layar booth & semua HP ikut · kuning = belum tersimpan</p>
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
    </Shell>
  )
}

/* ------------------------------------------------------------------ feedback switch */

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
          {/* this phone's line to the Sheet — tells "my signal" apart from "the Sheet didn't take it" */}
          <span className="inline-flex items-center gap-1.5 rounded-full bg-brown/5 px-2.5 py-0.5">
            <SignalBars label />
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

      <p className="mb-2 mt-5 font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-brown/50">Harga menu — kemahalan? ubah di sini</p>
      <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {[...menu.drinks.map((d) => ({ key: d.id as string, label: d.short, images: [d.image], price: d.price, base: DRINKS.find((x) => x.id === d.id)!.price, remote: r?.drinks.find((x) => x.id === d.id)?.price, sub: '' })),
          ...menu.bundles.map((b) => ({ key: b.name, label: b.name.replace('Paket ', ''), images: b.items.map((id) => DRINKS.find((x) => x.id === id)!.image), price: b.price, base: BUNDLES.find((x) => x.name === b.name)!.price, remote: r?.bundles.find((x) => x.name === b.name)?.price, sub: `normal ${b.normal}K · hemat ${b.normal - b.price}K` }))].map((p) => (
          <PriceRow {...p} key={p.key} wait={sync.pending && p.remote !== undefined && p.remote !== p.price} onSave={(v) => setMenuPrice(p.key, v === p.base ? null : v)} />
        ))}
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

/** one menu price: typed freely, saved when the box is left (or Enter) — not one save per key */
function PriceRow({ label, images, price, base, sub, wait, onSave }: { label: string; images: string[]; price: number; base: number; sub: string; wait: boolean; onSave: (v: number) => void }) {
  const [text, setText] = useState(String(price))
  useEffect(() => setText(String(price)), [price])
  const save = () => {
    const v = Math.round(Number(text))
    if (v >= 1 && v <= 500 && v !== price) onSave(v)
    else setText(String(price))
  }
  return (
    <label className="flex items-center gap-3 rounded-2xl border-2 bg-cream p-2.5" style={{ borderColor: wait ? WAIT : 'rgb(90 46 26 / 0.08)' }}>
      <span className="flex shrink-0 -space-x-3">
        {images.map((src, i) => <img key={i} src={src} alt="" className="h-10 w-auto" />)}
      </span>
      <span className="min-w-0 flex-1 leading-tight">
        <span className="block truncate font-display text-sm font-semibold">{label}</span>
        <span className="font-cond text-xs italic text-brown/55">{price !== base ? `asli ${base}K` : sub || 'harga asli'}{price !== base && sub ? ` · ${sub}` : ''}</span>
      </span>
      <span className="flex items-center font-cond text-sm">
        {wait && <Loader2 className="mr-1 size-3.5 animate-spin" />}
        <input
          type="number"
          inputMode="numeric"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
          aria-label={`Harga ${label} (ribu)`}
          className="w-14 rounded-lg bg-cream-deep/70 px-1.5 py-1 text-right font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-terracotta"
        />
        K
      </span>
    </label>
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
/** <input type="datetime-local"> speaks WIB regardless of the laptop's timezone */
const toWib = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 16)
const fromWib = (v: string) => new Date(`${v}:00+07:00`).getTime()

function PreorderAdmin({ remote, loaded, save }: { remote: PreorderConfig; loaded: boolean; save: (c: PreorderConfig) => Promise<boolean> }) {
  // a pre-order price can be typed as a number or as "% off" today's menu price
  const menu = useMenu()
  const menuPrice = (id: string) => {
    const it = PREORDER_ITEMS.find((i) => i.id === id)!
    return (it.kind === 'drink' ? menu.drinks.find((d) => d.id === id)?.price : menu.bundles.find((b) => b.name === it.name)?.price) ?? it.price
  }
  const offPct = (id: string, price: number) => Math.round((1 - price / menuPrice(id)) * 100)
  const fromPct = (id: string, pct: number) => Math.max(1, Math.round(menuPrice(id) * (1 - Math.min(90, Math.max(0, pct)) / 100)))
  const [allPct, setAllPct] = useState('10')
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

      <div className={`mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-cream-deep/60 p-3 font-cond ${loaded ? '' : 'pointer-events-none opacity-50'}`}>
        <span className="font-display text-sm font-semibold">Semua item:</span>
        <span className="flex items-center">
          diskon
          <input type="number" inputMode="numeric" min={0} max={90} value={allPct} onChange={(e) => setAllPct(e.target.value)} aria-label="Diskon semua (persen)" className="mx-1 w-12 rounded-lg bg-cream px-1.5 py-1 text-right font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-terracotta" />%
        </span>
        <button type="button" onClick={() => edit((c) => ({ ...c, items: Object.fromEntries(PREORDER_ITEMS.map((i) => [i.id, { ...(c.items[i.id] ?? { on: true }), price: fromPct(i.id, Number(allPct) || 0) }])) }))} className="rounded-full bg-brown px-3.5 py-1.5 font-display text-sm font-semibold text-cream">
          Terapkan
        </button>
        <button type="button" onClick={() => edit((c) => ({ ...c, items: Object.fromEntries(PREORDER_ITEMS.map((i) => [i.id, { ...(c.items[i.id] ?? { on: true }), price: menuPrice(i.id) }])) }))} className="rounded-full border-2 border-brown/15 px-3.5 py-1.5 font-display text-sm font-semibold">
          Samakan dengan harga menu
        </button>
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
                  <span className="ml-2 text-brown/40">atau</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={90}
                    value={s.price ? Math.max(0, offPct(it.id, s.price)) : ''}
                    onChange={(e) => setItem(it.id, { price: fromPct(it.id, Number(e.target.value)) })}
                    aria-label={`Diskon ${it.name} (persen)`}
                    className="mx-1 w-10 rounded-lg bg-cream-deep/70 px-1.5 py-0.5 text-right font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-terracotta"
                  />
                  % off
                </span>
                <span className="block font-cond text-xs italic text-brown/45">
                  menu {menuPrice(it.id)}K{s.price < menuPrice(it.id) ? ` · hemat ${menuPrice(it.id) - s.price}K` : s.price > menuPrice(it.id) ? ' · lebih mahal dari menu!' : ' · sama dengan menu'}
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


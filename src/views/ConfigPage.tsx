import { motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Ban, Check, Palette, DoorClosed, Gift, Megaphone, X, Landmark, Loader2, PackageCheck, RotateCcw, ShieldCheck, ShoppingBag, Trash2, UtensilsCrossed } from 'lucide-react'
import { EVENT } from '../data/event'
import { BUNDLES, DRINKS, type DrinkId } from '../data/menu'
import { DEFAULT_CUTOFF, DEFAULT_PREORDER, PREORDER_ITEMS } from '../data/preorder'
import { BACKEND, crewPin, savePreorderConfig, setFeedbackModeRemote, wipeData, type PreorderConfig, type Promo, type WipeTarget } from '../lib/backend'
import { usePreorder } from '../hooks/usePreorder'
import { SHOWS } from '../components/AttentionShow'
import { resetMenu, scheduleAttention, setTheme, type ThemeId, setBundleForced, setBundleItems, setClosedEarly, setDrinkSold, setMenuPrice, useMenu, useMenuSync } from '../hooks/useMenu'
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
      <ThemePicker />
      <AttentionRemote />
      <AdminPanel demo={DEMO} save={(m) => (DEMO ? wait(1200).then(() => true) : setFeedbackModeRemote(pin, m))} />
      <PreorderAdmin
        remote={DEMO ? demoPreorder : preorder.config}
        promoUsed={DEMO ? 6 : preorder.promoUsed}
        loaded={DEMO || preorder.loaded}
        save={async (c) => {
          if (!DEMO) return savePreorderConfig(pin, c)
          await wait(1200)
          setDemoPreorder(c)
          return true
        }}
      />
      <DataReset wipe={(what) => (DEMO ? wait(1500).then(() => Object.fromEntries(what.map((w) => [w, 3]))) : wipeData(pin, what))} />
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
  bca: { number: (c.bca?.number ?? '').replace(/[^0-9 -]/g, '').slice(0, 30), holder: (c.bca?.holder ?? '').slice(0, 60) },
  promo: normPromo(c.promo),
})
const normPromo = (p?: Promo): Promo => {
  const mode = p?.mode === 'pct' ? 'pct' : 'rp'
  return { on: !!p?.on, slots: Math.max(1, Math.min(200, Math.round(p?.slots || 10))), mode, value: Math.max(0, Math.min(mode === 'pct' ? 50 : 100, Math.round(p?.value || 0))) }
}
/** <input type="datetime-local"> speaks WIB regardless of the laptop's timezone */
const toWib = (ms: number) => new Date(ms + 7 * 3_600_000).toISOString().slice(0, 16)
const fromWib = (v: string) => new Date(`${v}:00+07:00`).getTime()

function PreorderAdmin({ remote, loaded, save, promoUsed }: { remote: PreorderConfig; loaded: boolean; save: (c: PreorderConfig) => Promise<boolean>; promoUsed: number }) {
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

      {/* where customers transfer to — shown on their payment screen after ordering */}
      <div
        className={`mt-3 grid gap-2 rounded-2xl bg-cream-deep/60 p-4 sm:grid-cols-[auto_1fr_1fr] sm:items-center ${loaded ? '' : 'pointer-events-none opacity-50'}`}
        style={dirty((c) => c.bca) ? { boxShadow: `inset 0 0 0 2px ${WAIT}` } : undefined}
      >
        <span>
          <span className="flex items-center gap-1.5 font-display font-semibold"><Landmark className="size-4 text-terracotta" /> Rekening BCA</span>
          <span className="font-cond text-sm italic text-brown/60">QRIS menyusul</span>
        </span>
        <input
          value={cfg.bca?.number ?? ''}
          onChange={(e) => edit((c) => ({ ...c, bca: { number: e.target.value, holder: c.bca?.holder ?? '' } }))}
          inputMode="numeric"
          placeholder="Nomor rekening"
          aria-label="Nomor rekening BCA"
          className="rounded-xl bg-cream px-3 py-2 font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-terracotta"
        />
        <input
          value={cfg.bca?.holder ?? ''}
          onChange={(e) => edit((c) => ({ ...c, bca: { number: c.bca?.number ?? '', holder: e.target.value } }))}
          placeholder="Atas nama"
          aria-label="Atas nama rekening"
          className="rounded-xl bg-cream px-3 py-2 font-display outline-none focus:ring-2 focus:ring-terracotta"
        />
      </div>

      <PromoRow promo={normPromo(cfg.promo)} used={promoUsed} dirty={dirty((c) => c.promo)} loaded={loaded} onChange={(p) => edit((c) => ({ ...c, promo: p }))} />

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

      <ul className={`mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 ${loaded ? '' : 'pointer-events-none opacity-50'}`}>
        {PREORDER_ITEMS.map((it) => {
          const s = cfg.items[it.id] ?? { on: true, price: it.price }
          const syncing = dirty((c) => c.items[it.id])
          return (
            <li key={it.id} className={`flex min-w-0 flex-col gap-2.5 rounded-2xl border-2 p-3 transition-opacity ${s.on ? '' : 'opacity-55'}`} style={{ borderColor: syncing ? WAIT : 'rgb(90 46 26 / 0.08)' }}>
              {/* top: picture · name + what it means · switch — same shape for a drink and a bundle */}
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-20 shrink-0 items-center justify-center -space-x-4">
                  {it.images.map((src, i) => <img key={i} src={src} alt="" className="h-11 w-auto drop-shadow" />)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2 font-display text-sm font-semibold leading-tight">{it.name}</span>
                  <span className="block truncate font-cond text-xs italic text-brown/50">
                    menu {menuPrice(it.id)}K{s.price < menuPrice(it.id) ? ` · hemat ${menuPrice(it.id) - s.price}K` : s.price > menuPrice(it.id) ? ' · lebih mahal dari menu!' : ' · sama dengan menu'}
                  </span>
                </span>
                <Switch on={s.on} pending={syncing} onClick={() => setItem(it.id, { on: !s.on })} label={`Jual ${it.name}`} />
              </div>
              {/* bottom: the price as a number or as % off — each half stays on one line */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5 pl-1 font-cond text-sm">
                <span className="flex items-center whitespace-nowrap">
                  Rp
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={500}
                    value={s.price || ''}
                    onChange={(e) => setItem(it.id, { price: Math.min(500, Math.max(0, Math.round(Number(e.target.value)))) })}
                    aria-label={`Harga ${it.name} (ribu)`}
                    className="mx-1 w-14 rounded-lg bg-cream-deep/70 px-2 py-1 text-right font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-terracotta"
                  />
                  .000
                </span>
                <span className="text-brown/40">atau</span>
                <span className="flex items-center whitespace-nowrap">
                  <input
                    type="number"
                    inputMode="numeric"
                    min={0}
                    max={90}
                    value={s.price ? Math.max(0, offPct(it.id, s.price)) : ''}
                    onChange={(e) => setItem(it.id, { price: fromPct(it.id, Number(e.target.value)) })}
                    aria-label={`Diskon ${it.name} (persen)`}
                    className="mr-1 w-12 rounded-lg bg-cream-deep/70 px-2 py-1 text-right font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-terracotta"
                  />
                  % off
                </span>
              </div>
            </li>
          )
        })}
      </ul>
    </Card>
  )
}


/* ------------------------------------------------------------------ A+G from a phone */

const ATTN_DELAYS = [3, 15, 30, 60]

/** the booth screen's attention show, started from here — a delay so the screen has the order in time */
/* ------------------------------------------------------------------ theme */

const THEMES: Array<{ id: ThemeId; name: string; hint: string; preview: string }> = [
  { id: 'classic', name: 'Klasik Pletok', hint: 'Krem & cokelat, kertas poster', preview: 'linear-gradient(160deg, #f5ebdd 0%, #ecdcc5 55%, #a8572a 100%)' },
  {
    id: 'sunset',
    name: 'Neon Sunset',
    hint: 'Warna Pletok tetap — cahaya senja dari atas + bayangan daun palem yang bergoyang',
    preview: 'radial-gradient(60% 90% at 15% 0%, #ff4f9a99, transparent 70%), radial-gradient(55% 90% at 55% 0%, #ffa24a99, transparent 70%), radial-gradient(50% 90% at 92% 0%, #9b5cff88, transparent 72%), #f5ebdd',
  },
]

/** the look of the screens customers see — the booth laptop, the cashier and /link follow within ~30 s */
function ThemePicker() {
  const menu = useMenu()
  const sync = useMenuSync()
  const saving = sync.pending && (sync.remote?.theme ?? 'classic') !== menu.theme
  return (
    <Card
      className="mt-6"
      title={
        <span className="flex flex-wrap items-center gap-2">
          <Palette className="size-5 text-terracotta" /> Tema layar
          {saving && <span className="rounded-full px-2.5 py-0.5 font-cond text-sm font-semibold italic text-brown" style={{ background: WAIT }}>menyimpan…</span>}
        </span>
      }
      meta="Menu booth · /cashier · /link — layar crew lain tetap klasik"
    >
      <div className="grid gap-3 sm:grid-cols-2">
        {THEMES.map((t) => {
          const on = menu.theme === t.id
          return (
            <motion.button
              key={t.id}
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={() => setTheme(t.id)}
              aria-pressed={on}
              className={`overflow-hidden rounded-3xl border-2 text-left ${on ? 'border-terracotta' : 'border-brown/10'}`}
              style={on && saving ? { boxShadow: `inset 0 0 0 2px ${WAIT}` } : undefined}
            >
              <span className="relative block h-24" style={{ background: t.preview }}>
                {t.id === 'sunset' && (
                  <span className="absolute -right-3 -top-4 text-6xl opacity-30 grayscale" style={{ transform: 'rotate(200deg)' }}>🌴</span>
                )}
                {on && (
                  <span className="absolute right-2 top-2 flex items-center gap-1 rounded-full bg-terracotta px-2.5 py-1 font-display text-xs font-semibold text-cream">
                    <Check className="size-3.5" /> Dipakai
                  </span>
                )}
              </span>
              <span className="block p-3">
                <span className="block font-display text-lg font-bold">{t.name}</span>
                <span className="block font-cond text-sm italic text-brown-soft">{t.hint}</span>
              </span>
            </motion.button>
          )
        })}
      </div>
      <p className="mt-3 font-cond text-sm italic text-brown-soft">
        Coba dulu:{' '}
        <a href="/" target="_blank" rel="noreferrer" className="underline">menu</a> ·{' '}
        <a href="/link" target="_blank" rel="noreferrer" className="underline">/link</a> ·{' '}
        <a href="/cashier" target="_blank" rel="noreferrer" className="underline">/cashier</a>
      </p>
    </Card>
  )
}

function AttentionRemote() {
  const { attnAt } = useMenu()
  const sync = useMenuSync()
  const [delay, setDelay] = useState(3)
  const [pick, setPick] = useState(-1) // -1 = acak
  const [now, setNow] = useState(Date.now)
  const waiting = !!attnAt && attnAt > now
  // tick through the countdown and the 10 s "now playing" note after it
  const ticking = !!attnAt && now < attnAt + 10_000
  useEffect(() => {
    if (!ticking) return
    const t = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(t)
  }, [ticking])
  const left = attnAt ? Math.ceil((attnAt - now) / 1000) : 0
  const justPlayed = !!attnAt && !waiting && now - attnAt < 10_000
  return (
    <Card title={<span className="flex items-center gap-2"><Megaphone className="size-5 text-terracotta" /> Attention show (A+G)</span>} meta="diputar di layar booth">
      <p className="font-display text-sm text-brown-soft">Show ±8 detik yang rame buat narik orang ke meja — sama seperti A+G di laptop booth. Layar booth cek perintah tiap ±10 detik: jeda 3 dtk = main begitu layar menerimanya.</p>
      {waiting ? (
        <div className="mt-3 flex items-center gap-3 rounded-2xl p-4" style={{ background: sync.pending ? `${WAIT}33` : 'rgb(94 123 58 / 0.12)' }}>
          {sync.pending ? <Loader2 className="size-5 animate-spin text-brown" /> : <Megaphone className="size-5 text-leaf" />}
          <span className="flex-1 font-display font-semibold">
            {sync.pending ? 'Mengirim ke Sheet…' : 'Terkirim'} · mulai dalam <span className="tabular-nums">{left}</span> dtk
          </span>
          <button type="button" onClick={() => scheduleAttention(null)} className="flex items-center gap-1 rounded-full border-2 border-brown/15 px-3 py-1.5 font-display text-sm font-semibold">
            <X className="size-4" /> Batal
          </button>
        </div>
      ) : (
        <>
        <div className="mt-3 flex flex-wrap gap-2">
          {[{ name: 'Acak', hint: 'Pilih satu dari 5' }, ...SHOWS].map((sh, k) => {
            const i = k - 1
            return (
              <button key={sh.name} type="button" onClick={() => setPick(i)} aria-pressed={pick === i} className={`rounded-2xl px-3 py-2 text-left ${pick === i ? 'bg-brown text-cream' : 'border-2 border-brown/15'}`}>
                <span className="block font-display text-sm font-semibold">{sh.name}</span>
                <span className={`block font-cond text-xs italic ${pick === i ? 'text-cream/70' : 'text-brown/60'}`}>{sh.hint}</span>
              </button>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className="font-cond italic text-brown-soft">Jeda</span>
          {ATTN_DELAYS.map((d) => (
            <button key={d} type="button" onClick={() => setDelay(d)} className={`rounded-full px-3 py-1.5 font-display text-sm font-semibold ${delay === d ? 'bg-brown text-cream' : 'border-2 border-brown/15'}`}>
              {d} dtk
            </button>
          ))}
          <motion.button type="button" whileTap={{ scale: 0.96 }} onClick={() => (scheduleAttention(delay * 1000, pick), setNow(Date.now()))} className="ml-auto flex items-center gap-2 rounded-full bg-terracotta px-5 py-2.5 font-display font-semibold text-cream shadow-[0_4px_0_#6e3418]">
            <Megaphone className="size-4" /> Putar
          </motion.button>
        </div>
        </>
      )}
      {justPlayed && <p className="mt-2 font-cond text-sm italic text-leaf">Lagi diputar di layar booth 🎉</p>}
      {sync.failed && <p className="mt-2 font-cond text-sm italic text-terracotta">Gagal terkirim — cek sinyal, lalu coba lagi.</p>}
    </Card>
  )
}

/* ------------------------------------------------------------------ first-N promo */

/** "Promo N pemesan pertama": the Sheet hands out the slots in order, one per WhatsApp number */
function PromoRow({ promo, used, dirty, loaded, onChange }: { promo: Promo; used: number; dirty: boolean; loaded: boolean; onChange: (p: Promo) => void }) {
  const set = (p: Partial<Promo>) => onChange({ ...promo, ...p })
  const num = 'w-16 rounded-lg bg-cream px-2 py-1.5 text-right font-display font-semibold tabular-nums outline-none focus:ring-2 focus:ring-terracotta'
  // worst case, so the team knows what the promo can cost
  const most = promo.mode === 'rp' ? `maks Rp${(promo.slots * promo.value * 1000).toLocaleString('id-ID')} total` : `${promo.value}% × ${promo.slots} pesanan`
  return (
    <div className={`mt-3 rounded-2xl bg-cream-deep/60 p-4 ${loaded ? '' : 'pointer-events-none opacity-50'}`} style={dirty ? { boxShadow: `inset 0 0 0 2px ${WAIT}` } : undefined}>
      <div className="flex items-center justify-between gap-3">
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 font-display font-semibold"><Gift className="size-4 text-terracotta" /> Promo pemesan pertama</span>
          <span className="font-cond text-sm italic text-brown/60">{promo.on ? `${Math.min(used, promo.slots)}/${promo.slots} slot terpakai · ${most}` : 'mati'}</span>
        </span>
        <Switch on={promo.on} pending={dirty} onClick={() => set({ on: !promo.on })} label="Promo pemesan pertama" />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 font-cond">
        <label className="flex items-center gap-1.5">
          <input type="number" inputMode="numeric" min={1} max={200} value={promo.slots} onChange={(e) => set({ slots: Number(e.target.value) || 1 })} aria-label="Jumlah slot promo" className={num} /> orang pertama
        </label>
        <span className="flex items-center gap-1.5">
          potongan
          <input type="number" inputMode="numeric" min={0} max={promo.mode === 'pct' ? 50 : 100} value={promo.value} onChange={(e) => set({ value: Number(e.target.value) || 0 })} aria-label="Besar potongan" className={num} />
          <span className="flex rounded-full bg-cream p-0.5 font-display text-sm font-semibold">
            {(['rp', 'pct'] as const).map((m) => (
              <button key={m} type="button" onClick={() => set({ mode: m, value: m === 'pct' ? Math.min(promo.value, 50) : promo.value })} className={`rounded-full px-2.5 py-1 ${promo.mode === m ? 'bg-brown text-cream' : 'text-brown/60'}`}>
                {m === 'rp' ? 'rb' : '%'}
              </button>
            ))}
          </span>
          / pesanan
        </span>
      </div>
      <p className="mt-2 font-cond text-sm italic text-brown/55">1× per nomor WA · pesanan ditolak mengembalikan slotnya · yang dapat ditentukan Sheet waktu pesanan masuk, jadi slot nggak bisa kelebihan.</p>
    </div>
  )
}

/* ------------------------------------------------------------------ clean up test data */

const WIPE: Array<{ id: WipeTarget; label: string; hint: string }> = [
  { id: 'orders', label: 'Pre-order', hint: 'semua pesanan + kode ambil mulai lagi dari 001' },
  { id: 'booth', label: 'Penjualan kasir', hint: 'semua transaksi /cashier + nomor B- mulai lagi dari 001' },
  { id: 'feedback', label: 'Feedback', hint: 'semua jawaban form' },
  { id: 'scans', label: 'Scan & klik', hint: 'hitungan scan QR / link' },
  { id: 'security', label: 'Log keamanan', hint: 'PIN salah & kunjungan /admin palsu' },
  { id: 'proofs', label: 'Bukti transfer', hint: 'screenshot di Drive → Sampah (30 hari bisa dipulihkan)' },
]
const CONFIRM = 'HAPUS'

/** before launch: wipe the test rows. Menu, prices and pre-order settings are never touched. */
function DataReset({ wipe }: { wipe: (what: WipeTarget[]) => Promise<Partial<Record<WipeTarget, number>> | null> }) {
  const [pick, setPick] = useState<WipeTarget[]>(['orders', 'booth', 'feedback', 'scans', 'security', 'proofs'])
  const [typed, setTyped] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const [done, setDone] = useState<Partial<Record<WipeTarget, number>>>()
  const armed = typed.trim().toUpperCase() === CONFIRM && pick.length > 0 && state !== 'busy'
  const run = async () => {
    if (!armed) return
    setState('busy')
    setDone(undefined)
    const r = await wipe(pick)
    if (!r) return setState('error')
    setDone(r)
    setTyped('')
    setState('idle')
  }
  return (
    <Card title={<span className="flex items-center gap-2"><Trash2 className="size-5 text-terracotta" /> Bersihkan data</span>} meta="sebelum hari H — hapus data tes">
      <p className="font-display text-sm text-brown-soft">
        Kosongkan isi tab yang dipilih. Tiap tab disalin dulu ke tab <em>Backup …</em> di Sheet, jadi kalau salah hapus masih bisa diambil lagi. Menu, harga & setelan pre-order <b>nggak</b> ikut terhapus.
      </p>
      <div className="mt-3 flex flex-col gap-2">
        {WIPE.map((w) => {
          const on = pick.includes(w.id)
          return (
            <button
              key={w.id}
              type="button"
              onClick={() => setPick((p) => (on ? p.filter((x) => x !== w.id) : [...p, w.id]))}
              className={`flex items-center gap-3 rounded-2xl border-2 p-3 text-left transition-colors ${on ? 'border-terracotta/50 bg-terracotta/5' : 'border-brown/10'}`}
            >
              <span className={`grid size-5 shrink-0 place-items-center rounded-md border-2 ${on ? 'border-terracotta bg-terracotta text-cream' : 'border-brown/30'}`}>{on && <Check className="size-3.5" />}</span>
              <span className="min-w-0 flex-1">
                <span className="block font-display font-semibold">{w.label}</span>
                <span className="font-cond text-sm italic text-brown/60">{w.hint}</span>
              </span>
              {done?.[w.id] !== undefined && <span className="shrink-0 font-cond text-sm italic text-leaf">{done[w.id]} dihapus</span>}
            </button>
          )
        })}
      </div>
      <label className="mt-4 block font-display text-sm text-brown-soft">
        Ketik <b className="tracking-widest text-terracotta">{CONFIRM}</b> untuk lanjut
        <input value={typed} onChange={(e) => setTyped(e.target.value)} autoCapitalize="characters" autoComplete="off" spellCheck={false} className="mt-1.5 w-full rounded-2xl bg-cream-deep/80 p-3 font-display tracking-widest outline-none focus:ring-2 focus:ring-terracotta" />
      </label>
      <motion.button
        type="button"
        onClick={() => void run()}
        disabled={!armed}
        whileTap={{ scale: 0.97 }}
        transition={spring.snappy}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-terracotta py-3 font-display font-semibold text-cream disabled:opacity-35"
      >
        {state === 'busy' ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
        {state === 'busy' ? 'Menghapus…' : `Hapus yang dipilih (${pick.length})`}
      </motion.button>
      {state === 'error' && <p className="mt-2 font-cond text-sm italic text-terracotta">Gagal — sinyal, atau Code.gs belum di-deploy versi baru. Nggak ada yang terhapus kalau ini muncul sebelum Sheet menjawab.</p>}
      {done && <p className="mt-2 font-cond text-sm italic text-leaf">Beres! Backup-nya ada di tab "Backup …" di Google Sheet — hapus tab itu kalau sudah yakin.</p>}
    </Card>
  )
}

import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowRight, Check, Crown, Download, ExternalLink, HelpCircle, Lightbulb, Loader2, MessageCircle, MessageCircleHeart, RefreshCw, ScanLine, Search, Settings2, ShoppingBag, Sparkles, Star, ThumbsUp, Users, Wallet } from 'lucide-react'
import { EVENT } from '../data/event'
import { DRINKS } from '../data/menu'
import { BACKEND, crewPin, fetchResults, setOrderDone, type Order, type Response, type Results } from '../lib/backend'
import { PREORDER_ITEMS, rupiah } from '../data/preorder'
import { spring } from '../lib/motion'
import { Btn, Card, CrewNav, DEMO, Empty, PinGate, Shell, Tile, WAIT, dayTime, hhmm, useCrewPage, wait } from './adminUi'

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

const pct = (n: number, of: number) => (of ? Math.round((n / of) * 100) : 0)


export function HasilPage() {
  const [pin, setPin] = useState(DEMO ? 'demo' : crewPin)
  const [data, setData] = useState<Results | null>(DEMO ? demoResults() : null)
  const [state, setState] = useState<'idle' | 'loading' | 'error' | 'pin'>('idle')
  const [at, setAt] = useState<number | undefined>(DEMO ? Date.now() : undefined)
  useCrewPage('Hasil')

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
  if (!pin) return <Shell><PinGate title="Hasil Pletok" wrong={state === 'pin'} onOk={setPin} /></Shell>

  return (
    <Shell>
      <CrewNav at="hasil" />
      {/* the admins learned "/hasil = settings" — point them to where the switches went */}
      <a href={'/config' + window.location.search} className="mb-6 flex items-center gap-3 rounded-3xl bg-terracotta p-4 text-cream shadow-[0_6px_0_#6e3418]">
        <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-cream/15"><Settings2 className="size-5" /></span>
        <span className="min-w-0 flex-1">
          <span className="block font-display text-lg font-bold leading-tight">Cari pengaturan? Sekarang di /config</span>
          <span className="font-cond text-sm italic text-cream/80">Menu habis, harga, buka/tutup feedback, pre-order — semuanya pindah ke sana</span>
        </span>
        <ArrowRight className="size-5 shrink-0" />
      </a>
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

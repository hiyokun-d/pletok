import { motion } from 'motion/react'
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Crown, Download, ShieldCheck, ExternalLink, HelpCircle, Lightbulb, Lock, MessageCircleHeart, RefreshCw, ScanLine, Sparkles, Star, ThumbsUp, Users } from 'lucide-react'
import { EVENT } from '../data/event'
import { DRINKS } from '../data/menu'
import { BACKEND, crewPin, fetchResults, setCrewPin, setFeedbackModeRemote, type Response, type Results } from '../lib/backend'
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

      {!DEMO && <AdminPanel pin={pin} />}
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
function AdminPanel({ pin }: { pin: string }) {
  const { open, mode, until } = useFeedbackOpen()
  const [saving, setSaving] = useState<FeedbackMode | null>(null)
  const [failed, setFailed] = useState(false)
  const pick = async (m: FeedbackMode) => {
    setSaving(m)
    setFailed(false)
    const ok = await setFeedbackModeRemote(pin, m)
    setSaving(null)
    if (!ok) setFailed(true)
  }
  return (
    <section className="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-brown p-5 text-cream">
      <div className="flex items-center gap-3">
        <span className="grid size-11 place-items-center rounded-2xl bg-cream/10"><ShieldCheck className="size-5 text-yakult" /></span>
        <div>
          <p className="font-display text-lg font-bold leading-tight">
            Form feedback{' '}
            <span className={`ml-1 rounded-full px-2.5 py-0.5 align-middle font-cond text-sm font-semibold italic ${open ? 'bg-leaf' : 'bg-cream/15 text-cream/70'}`}>{open ? 'terbuka' : 'tertutup'}</span>
          </p>
          <p className="font-cond text-sm italic text-cream/60">
            {failed ? 'Gagal menyimpan — cek sinyal / PIN' : mode === 'auto' ? `Auto: buka ${EVENT.timeLabel.split(' –')[0]} s/d ${hhmm(until)} (25 menit setelah tutup)` : 'Manual — semua HP ikut dalam ±30 detik'}
          </p>
        </div>
      </div>
      <div className="relative grid grid-cols-3 gap-1 rounded-2xl bg-cream/10 p-1">
        {MODES.map((m) => (
          <button key={m.id} onClick={() => void pick(m.id)} disabled={!!saving} className="relative min-w-24 rounded-xl px-3 py-2 text-center">
            {mode === m.id && <motion.span layoutId="admin-mode" className="absolute inset-0 rounded-xl bg-terracotta" transition={spring.snappy} />}
            <span className="relative block font-display text-sm font-semibold">{saving === m.id ? '…' : m.label}</span>
            <span className="relative block font-cond text-[0.7rem] italic text-cream/60">{m.hint}</span>
          </button>
        ))}
      </div>
    </section>
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

/** every answer as a CSV that Excel / Google Sheets / Docs open cleanly (BOM for Excel's UTF-8) */
function downloadCsv(rs: Response[]) {
  const head = ['Waktu', 'Rating', 'Menu favorit', 'Like', 'Wishes', 'Questions', 'Ideas', 'Nama', 'Kontak', 'Boleh dihubungi', 'Sumber']
  const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const lines = rs.map((r) => [dayTime(r.at), r.rating ?? '', r.favorites, r.like, r.wish, r.question, r.idea, r.name, r.consent ? r.contact : '', r.consent ? 'ya' : 'tidak', r.source].map(esc).join(','))
  const blob = new Blob(['﻿' + [head.map(esc).join(','), ...lines].join('\n')], { type: 'text/csv;charset=utf-8' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `pletok-feedback-${new Date().toISOString().slice(0, 10)}.csv`
  a.click()
  URL.revokeObjectURL(a.href)
}

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
  return { sheetUrl: '#', responses, scans: Array.from({ length: 128 }, (_, i) => ({ at: open + i * 80_000, target: 'link' })) }
}

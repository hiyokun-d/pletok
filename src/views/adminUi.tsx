import { motion } from 'motion/react'
import { useEffect, useState, type ReactNode } from 'react'
import { BarChart3, HandPlatter, Loader2, Lock, PiggyBank, Settings2, ShoppingBasket, type LucideIcon } from 'lucide-react'
import { setCrewPin } from '../lib/backend'
import { spring } from '../lib/motion'

/* Shared pieces of the crew pages: /hasil (results), /financial (money), /config (settings), /cashier and /pickup. One PIN for all. */

/** "saved here, not in the Sheet yet" — every admin control turns this colour until the Sheet agrees */
export const WAIT = '#e8b53a'
export const wait = (ms: number) => new Promise((r) => window.setTimeout(r, ms))
export const hhmm = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
export const dayTime = (ms: number) => new Date(ms).toLocaleString('id-ID', { timeZone: 'Asia/Jakarta', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
export const sameJson = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

/** dev only: ?demo shows made-up data and never writes to the Sheet */
export const DEMO = import.meta.env.DEV && new URLSearchParams(window.location.search).has('demo')

/** crew pages stay out of search results */
export function useCrewPage(title: string) {
  useEffect(() => {
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex'
    document.head.appendChild(m)
    document.title = `${title} · Pletok`
    return () => m.remove()
  }, [title])
}

export type CrewPage = 'hasil' | 'financial' | 'config' | 'cashier' | 'pickup'
/** big switch between the crew pages — any crew phone is one tap from the others */
export function CrewNav({ at }: { at: CrewPage }) {
  const tabs: Array<{ id: CrewPage; href: string; label: string; Icon: LucideIcon }> = [
    { id: 'cashier', href: '/cashier', label: 'Kasir', Icon: ShoppingBasket },
    { id: 'pickup', href: '/pickup', label: 'Pickup', Icon: HandPlatter },
    { id: 'hasil', href: '/hasil', label: 'Hasil & pre-order', Icon: BarChart3 },
    { id: 'financial', href: '/financial', label: 'Financial', Icon: PiggyBank },
    { id: 'config', href: '/config', label: 'Config', Icon: Settings2 },
  ]
  return (
    <nav className="mb-6 grid grid-cols-2 gap-1 rounded-2xl bg-brown/10 p-1 sm:grid-cols-5">
      {tabs.map(({ id, href, label, Icon }) => (
        <a key={id} href={href + window.location.search} aria-current={at === id ? 'page' : undefined} className="relative flex items-center justify-center gap-2 rounded-xl px-3 py-3 text-center font-display text-sm font-semibold last:col-span-2 sm:text-base sm:last:col-span-1">
          {at === id && <motion.span layoutId="crew-nav" className="absolute inset-0 rounded-xl bg-brown" transition={spring.snappy} />}
          <Icon className={`relative size-4 shrink-0 ${at === id ? 'text-yakult' : ''}`} />
          <span className={`relative ${at === id ? 'text-cream' : ''}`}>{label}</span>
        </a>
      ))}
    </nav>
  )
}

export function Shell({ children }: { children: ReactNode }) {
  return (
    <main className="paper min-h-dvh px-4 py-8 text-brown sm:px-8">
      <div className="mx-auto max-w-6xl">{children}</div>
    </main>
  )
}

export function Card({ title, meta, children, className = '' }: { title: ReactNode; meta?: string; children: ReactNode; className?: string }) {
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

export function Tile({ Icon, label, value, unit, sub }: { Icon: LucideIcon; label: string; value: number | string; unit?: string; sub?: string }) {
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

export function Btn({ children, icon, onClick, href, solid }: { children: string; icon: ReactNode; onClick?: () => void; href?: string; solid?: boolean }) {
  const cls = `inline-flex items-center gap-2 rounded-full px-4 py-2.5 font-display text-sm font-semibold ${solid ? 'bg-brown text-cream' : 'border-2 border-brown/15 bg-cream/70'}`
  return href ? <a href={href} target="_blank" rel="noreferrer" className={cls}>{icon} {children}</a> : <button onClick={onClick} className={cls}>{icon} {children}</button>
}

export function Empty({ title, text }: { title: string; text: string }) {
  return (
    <div className="grid min-h-[70dvh] place-items-center text-center">
      <div>
        <h1 className="font-display text-3xl font-bold">{title}</h1>
        <p className="mt-2 font-cond text-lg italic text-brown-soft">{text}</p>
      </div>
    </div>
  )
}

/**
 * The Google Sheet is optional: with VITE_BACKEND_URL empty (unplugged after the event) the public
 * pages carry on — recap, gallery, menu. Crew pages that need it show this instead of breaking,
 * with what to do to plug it back in. Fits a phone and the booth laptop.
 */
export function SheetUnplugged({ page, children }: { page: string; children?: ReactNode }) {
  return (
    <div className="mx-auto mt-6 max-w-2xl">
      <section className="rounded-3xl bg-[#e8b53a] p-6 text-brown shadow-[0_18px_40px_-24px_rgb(90_46_26/0.6)] sm:p-8">
        <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.25em]">{page} · butuh Google Sheet</p>
        <h1 className="mt-1 font-display text-3xl font-bold leading-tight sm:text-4xl">Google Sheet lagi dicabut</h1>
        <p className="mt-2 font-display text-lg leading-snug">Halaman publik tetap jalan (recap, galeri, menu). Halaman crew ini butuh Sheet buat simpan data — sambungkan lagi dulu:</p>
        <ol className="mt-4 flex list-decimal flex-col gap-2 pl-5 font-display leading-snug">
          <li>Buka Apps Script proyek Pletok → <b>Deploy → Manage deployments</b>, pastikan Web app aktif (atau <b>New version</b>).</li>
          <li>Salin URL Web app ke <b>VITE_BACKEND_URL</b> — di Vercel: Settings → Environment Variables; di laptop: <code className="rounded bg-brown/10 px-1">.env.local</code>.</li>
          <li><b>Redeploy</b> di Vercel (atau restart <code className="rounded bg-brown/10 px-1">bun dev</code>), lalu buka halaman ini lagi.</li>
        </ol>
        <p className="mt-4 font-cond text-base italic text-brown/75">Langkah lengkap: apps-script/README.md</p>
      </section>
      {children}
    </div>
  )
}

export function PinGate({ wrong, onOk, title }: { wrong: boolean; onOk: (pin: string) => void; title: string }) {
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
      <h1 className="mt-4 font-display text-2xl font-bold">{title}</h1>
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


export function Switch({ on, pending, onClick, label }: { on: boolean; pending: boolean; onClick: () => void; label: string }) {
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


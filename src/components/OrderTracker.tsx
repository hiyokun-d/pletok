import { AnimatePresence, motion } from 'motion/react'
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react'
import { ArrowLeft, ArrowRight, Ban, Check, CloudOff, Send, Gift, CheckCircle2, ChevronDown, Copy, Hourglass, ImageUp, KeyRound, Landmark, Loader2, MapPin, MessageCircle, Phone, QrCode, RefreshCw, Search, ShieldAlert, XCircle } from 'lucide-react'
import { ADMIN_NAME, ADMIN_WA, EVENT } from '../data/event'
import { rupiah } from '../data/preorder'
import { FINAL_PREORDER_ERRORS, findOrders, lookupOrders, setPreorderPay, submitPreorder, uploadProof, type OrderStatus, type PreorderConfig, type PreorderPay, type Promo, type PublicOrder } from '../lib/backend'
import { spring } from '../lib/motion'
import { ParticleField } from './ParticleField'
import { QrisCode } from './QrisCode'
import { Morph } from './Morph'

/* ------------------------------------------------------------------ the phone's own orders */

export interface MyOrder {
  id: string
  at: number
  name: string
  total: number
  saved: number
  lines: Array<{ id: string; name: string; qty: number; price: number }>
  status: OrderStatus
  /** pickup code — arrives once an admin verifies the transfer */
  code: string
  /** private "kode cek": finds this order again on any phone */
  ref?: string
  /** a transfer screenshot went up */
  proof?: boolean
  /** first-N promo discount (thousands) the Sheet gave, already off `total` */
  promo?: number
  /** the Sheet couldn't be reached when they pressed send: the order waits on this phone and is
   *  re-sent until it lands (the Sheet skips a repeat of the same id, so retries never double it) */
  queued?: { items: Array<{ id: string; qty: number }>; name: string; wa: string; note: string; at: number }
  /** the Sheet answered a queued order with a final no ('closed' / 'empty' / 'contact') */
  failed?: string
  /** BCA transfer or QRIS — picked on the hold screen */
  pay?: PreorderPay
  /** the screen promised a promo slot but they were all gone by the time the order landed */
  promoMissed?: boolean | 'used'
}

const KEY = 'pletok:orders'
const load = (): MyOrder[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) || '[]') as MyOrder[]
  } catch {
    return []
  }
}
const store = (os: MyOrder[]) => {
  try {
    localStorage.setItem(KEY, JSON.stringify(os.slice(-10)))
  } catch {
    /* storage blocked — the page still shows it until a refresh */
  }
}

/** orders made on this phone, kept fresh from the Sheet while any of them waits for verification */
export function useMyOrders() {
  const [orders, setOrders] = useState<MyOrder[]>(load)
  const add = useCallback((o: MyOrder) => {
    setOrders((os) => {
      const next = [...os.filter((x) => x.id !== o.id), o]
      store(next)
      return next
    })
  }, [])
  // orders found with "Cek pesanan" (another phone, a cleared browser) join the list
  const merge = useCallback((found: PublicOrder[]) => {
    setOrders((os) => {
      const next = [...os]
      found.forEach((f) => {
        const i = next.findIndex((o) => o.id === f.id)
        const o: MyOrder = { ...(i >= 0 ? next[i] : { saved: 0 }), id: f.id, at: f.at, name: f.name, total: f.total, lines: f.lines, status: f.status, code: f.code, ref: f.ref, proof: f.proof, promo: f.promo, pay: f.pay }
        if (i >= 0) next[i] = o
        else next.push(o)
      })
      store(next)
      return next
    })
  }, [])
  const patch = useCallback((id: string, p: Partial<MyOrder>) => {
    setOrders((os) => {
      const next = os.map((o) => (o.id === id ? { ...o, ...p } : o))
      store(next)
      return next
    })
  }, [])
  // the hold room shows when it last asked, so waiting never feels stuck
  const [checkedAt, setCheckedAt] = useState<number>()
  const refresh = useCallback(async () => {
    const ids = load().filter((o) => !o.queued && !o.failed && (o.status === 'hold' || o.status === 'process' || o.status === 'rejected')).map((o) => o.id)
    if (!ids.length) return
    const r = await lookupOrders(ids)
    if (!r) return
    setCheckedAt(Date.now())
    setOrders((os) => {
      // asked about but no longer in the Sheet (test data cleared from /config) → forget it here too
      const next = os.flatMap((o) => {
        const u = r.find((x) => x.id === o.id)
        if (!u) return ids.includes(o.id) ? [] : [o]
        return [{ ...o, status: u.status, total: u.total || o.total, code: u.code || o.code, ref: u.ref || o.ref, proof: u.proof || o.proof, promo: u.promo ?? o.promo, pay: u.pay ?? o.pay }]
      })
      store(next)
      return next
    })
  }, [])
  const waiting = orders.some((o) => o.status === 'hold' || o.status === 'process' || o.status === 'rejected')
  useEffect(() => {
    if (!waiting) return
    void refresh()
    const t = window.setInterval(() => void refresh(), 10_000)
    const vis = () => document.visibilityState === 'visible' && void refresh()
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.clearInterval(t)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [waiting, refresh])
  // Plan B: orders that couldn't reach the Sheet go out again every 15 s, when the signal comes
  // back, when the page is looked at again, and the moment any request finds the Sheet back up
  const sending = useRef(false)
  const [triedAt, setTriedAt] = useState<number>()
  const sendQueued = useCallback(async () => {
    if (sending.current) return
    sending.current = true
    try {
      for (const o of load().filter((x) => x.queued)) {
        const q = o.queued!
        const r = await submitPreorder({ id: o.id, items: q.items, name: q.name, wa: q.wa, note: q.note, hp: '', queuedAt: q.at })
        setTriedAt(Date.now())
        if (r?.ok) patch(o.id, { queued: undefined, status: r.status, total: r.total, ref: r.ref, promo: r.promo ?? 0 })
        else if (r && FINAL_PREORDER_ERRORS.includes(String(r.error))) patch(o.id, { queued: undefined, failed: String(r.error) })
        else break // still down — the rest wait for the next round
      }
    } finally {
      sending.current = false
    }
  }, [patch])
  const queuedN = orders.filter((o) => o.queued).length
  useEffect(() => {
    if (!queuedN) return
    void sendQueued()
    const t = window.setInterval(() => void sendQueued(), 15_000)
    const go = () => void sendQueued()
    const vis = () => document.visibilityState === 'visible' && go()
    window.addEventListener('online', go)
    window.addEventListener('pletok:recovered', go)
    document.addEventListener('visibilitychange', vis)
    return () => {
      window.clearInterval(t)
      window.removeEventListener('online', go)
      window.removeEventListener('pletok:recovered', go)
      document.removeEventListener('visibilitychange', vis)
    }
  }, [queuedN, sendQueued])
  return { orders, add, merge, patch, checkedAt, sendQueued, triedAt }
}

/** the order as a WhatsApp message to the admin — Plan B when the system is down */
export const orderToAdmin = (o: Pick<MyOrder, 'id' | 'name' | 'total' | 'lines'> & { wa?: string; note?: string }) =>
  `https://wa.me/${ADMIN_WA}?text=${encodeURIComponent(
    [
      'Halo admin Pletok! Sistem pre-order lagi gangguan, aku mau pesan:',
      ...o.lines.map((l) => `> ${l.qty}x ${l.name} (${rupiah(l.price * l.qty)})`),
      `Total: ${rupiah(o.total)}`,
      `Nama: ${o.name}`,
      ...(o.wa ? [`WA: ${o.wa}`] : []),
      ...(o.note ? [`Catatan: ${o.note}`] : []),
      `ID pesanan: ${o.id.slice(0, 8)}`,
      '(pesanan ini juga tersimpan di HP-ku dan masuk otomatis begitu sistem pulih — ID-nya sama)',
    ].join('\n'),
  )}`

/* ------------------------------------------------------------------ bits */

/** whatever they type or paste — 0812…, 62812…, +62 812-… — down to the part after +62 ("812…") */
export const waLocal = (raw: string) => {
  let d = raw.replace(/\D/g, '')
  if (d.startsWith('62')) d = d.slice(2)
  else if (d.startsWith('0')) d = d.slice(1)
  return d.slice(0, 13)
}
export const waValid = (local: string) => /^8\d{8,12}$/.test(local)
export const waGroups = (local: string) => [local.slice(0, 3), local.slice(3, 7), local.slice(7)].filter(Boolean).join('-')

/** a WhatsApp field with a fixed +62 in front: typing 0…, 62… or +62… all land in the same place */
export function WaInput({ value, onChange, placeholder = '812-3456-7890', className = '' }: { value: string; onChange: (local: string) => void; placeholder?: string; className?: string }) {
  return (
    <label className={`flex items-center rounded-2xl bg-cream-deep/80 font-display focus-within:ring-2 focus-within:ring-terracotta ${className}`}>
      <span className="flex items-center gap-1.5 self-stretch border-r-2 border-brown/10 py-3.5 pl-3.5 pr-3 font-semibold text-brown/70">
        <Phone className="size-4" /> +62
      </span>
      <input
        value={waGroups(value)}
        onChange={(e) => onChange(waLocal(e.target.value))}
        inputMode="tel"
        autoComplete="tel"
        placeholder={placeholder}
        aria-label="Nomor WhatsApp"
        className="min-w-0 flex-1 bg-transparent p-3.5 tracking-wide outline-none"
      />
    </label>
  )
}

const TONE: Record<OrderStatus, { label: string; short: string; bg: string; fg: string; Icon: typeof Check }> = {
  hold: { label: 'Menunggu verifikasi', short: 'Dicek', bg: '#e8b53a', fg: '#5a2e1a', Icon: Hourglass },
  process: { label: 'Terverifikasi', short: 'Lunas', bg: '#5e7b3a', fg: '#f5ebdd', Icon: CheckCircle2 },
  done: { label: 'Sudah diambil', short: 'Diambil', bg: '#5a2e1a', fg: '#f5ebdd', Icon: Check },
  rejected: { label: 'Pembayaran belum ketemu', short: 'Ditolak', bg: '#a8572a', fg: '#f5ebdd', Icon: XCircle },
}

/** a status capsule that morphs when the admin moves the order along */
export function StatusPill({ status, small = false }: { status: OrderStatus; small?: boolean }) {
  const t = TONE[status]
  return (
    <motion.span layout className={`inline-flex shrink-0 items-center overflow-hidden whitespace-nowrap rounded-full font-display font-semibold ${small ? 'gap-1 px-2.5 py-0.5 text-xs' : 'gap-2 px-4 py-1.5 text-sm'}`} animate={{ backgroundColor: t.bg, color: t.fg }} transition={spring.snappy}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span key={status} className="inline-flex items-center gap-1.5" initial={{ opacity: 0, filter: 'blur(6px)', scale: 0.8 }} animate={{ opacity: 1, filter: 'blur(0px)', scale: 1 }} exit={{ opacity: 0, filter: 'blur(6px)', scale: 0.8 }}>
          <t.Icon className={`${small ? 'size-3' : 'size-4'} ${status === 'hold' ? 'animate-pulse' : ''}`} /> {small ? t.short : t.label}
        </motion.span>
      </AnimatePresence>
    </motion.span>
  )
}

function CopyBtn({ text, label }: { text: string; label: string }) {
  const [done, setDone] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text)
    } catch {
      const t = document.createElement('textarea')
      t.value = text
      document.body.appendChild(t)
      t.select()
      document.execCommand('copy')
      t.remove()
    }
    setDone(true)
    window.setTimeout(() => setDone(false), 1600)
  }
  return (
    <button type="button" onClick={() => void copy()} aria-label={label} className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-brown px-3 py-1.5 font-display text-sm font-semibold text-cream">
      {done ? <Check className="size-4" /> : <Copy className="size-4" />} {done ? 'Tersalin' : 'Salin'}
    </button>
  )
}

/** "ada pertanyaan?" — the admin's WhatsApp (ADMIN_WA in data/event.ts) */
export function AdminContact({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-start gap-1.5 font-cond text-base italic text-brown-soft ${className}`}>
      <MessageCircle className="mt-1 size-4 shrink-0" />
      <span>
        Ada pertanyaan? WhatsApp admin:{' '}
        {ADMIN_WA && ADMIN_NAME ? (
          <a href={`https://wa.me/${ADMIN_WA}`} target="_blank" rel="noreferrer" className="font-semibold not-italic text-leaf underline">
            +{ADMIN_WA} {ADMIN_NAME}
          </a>
        ) : (
          <span className="font-semibold">[the developer forgot to change this, pls don't blame him, he's an idiot]</span>
        )}
      </span>
    </p>
  )
}

/** the phone's orders, as small cards — tap one to open it */
export function MyOrdersList({ orders, onOpen }: { orders: MyOrder[]; onOpen: (id: string) => void }) {
  if (!orders.length) return null
  return (
    <section className="flex flex-col gap-2">
      <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.25em] text-terracotta">Pesananmu</p>
      {[...orders].reverse().map((o) => (
        <motion.button layout key={o.id} type="button" onClick={() => onOpen(o.id)} className="flex items-center justify-between gap-3 rounded-3xl border-2 border-brown/10 bg-cream/80 p-3.5 text-left">
          <span className="min-w-0">
            <span className="block truncate font-display font-semibold">
              {o.code && <span className="mr-2 rounded-md bg-brown px-1.5 py-0.5 font-cond text-sm tracking-wide text-cream">{o.code}</span>}
              {o.lines.map((l) => `${l.qty}× ${l.name}`).join(', ')}
            </span>
            <span className="font-cond text-sm italic text-brown-soft">{rupiah(o.total)} · a.n. {o.name}</span>
          </span>
          {o.queued ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#e8b53a] px-2.5 py-0.5 font-display text-xs font-semibold text-brown"><CloudOff className="size-3 animate-pulse" /> Antre</span>
          ) : o.failed ? (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-terracotta px-2.5 py-0.5 font-display text-xs font-semibold text-cream"><XCircle className="size-3" /> Gagal</span>
          ) : (
            <StatusPill status={o.status} small />
          )}
        </motion.button>
      ))}
    </section>
  )
}

/**
 * "Cek pesanan" from any phone — a small button until it's needed, so the menu stays the first
 * thing people see. The kode cek (K7Q2MX) alone — never the pickup code, PLT-001 is easy to guess —
 * without either, WhatsApp number + name must both match.
 */
export function FindOrder({ onFound, onOpen, notice }: { onFound: (os: PublicOrder[]) => void; onOpen: (id: string) => void; notice?: string }) {
  const [open, setOpen] = useState(!!notice)
  // a WhatsApp link that didn't resolve opens this, with why
  useEffect(() => {
    if (notice) setOpen(true)
  }, [notice])
  const [mode, setMode] = useState<'ref' | 'wa'>('ref')
  const [ref, setRef] = useState('')
  const [wa, setWa] = useState('')
  const [name, setName] = useState('')
  const [state, setState] = useState<'idle' | 'busy' | 'none' | 'error'>('idle')
  const ready = mode === 'ref' ? ref.replace(/[^a-z0-9]/gi, '').length >= 6 : waValid(wa) && name.trim().length > 0
  // not a <form>: it sits inside the order form, and a nested form would submit (reload) that one
  const submit = async () => {
    if (!ready || state === 'busy') return
    setState('busy')
    const r = await findOrders(mode === 'ref' ? { ref: ref.trim() } : { wa: '0' + wa, name })
    if (!r) return setState('error')
    if (!r.length) return setState('none')
    setState('idle')
    onFound(r)
    onOpen(r[r.length - 1].id)
  }
  const input = 'w-full rounded-2xl bg-cream-deep/80 p-3.5 font-display outline-none focus:ring-2 focus:ring-terracotta'
  return (
    <motion.div layout transition={spring.snappy} className={`overflow-hidden ${open ? 'rounded-3xl border-2 border-brown/10 bg-cream/70' : 'self-start rounded-full'}`}>
      <motion.button
        layout="position"
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className={`flex w-full items-center gap-2 font-display font-semibold ${open ? 'p-4 pb-2' : 'rounded-full border-2 border-brown/15 px-4 py-2.5 text-sm'}`}
      >
        <Search className="size-4 text-terracotta" /> Sudah pesan? Cek pesanan
        <ChevronDown className={`ml-auto size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
      </motion.button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="find"
            role="search"
            onKeyDown={(e) => {
              if (e.key !== 'Enter' || !(e.target instanceof HTMLInputElement)) return
              e.preventDefault()
              void submit()
            }}
            className="flex flex-col gap-2 px-4 pb-4"
            initial={{ opacity: 0, height: 0, filter: 'blur(6px)' }}
            animate={{ opacity: 1, height: 'auto', filter: 'blur(0px)' }}
            exit={{ opacity: 0, height: 0, filter: 'blur(6px)' }}
            transition={spring.snappy}
          >
            <div className="flex gap-1 rounded-full bg-cream-deep/70 p-1">
              {([['ref', 'Pakai kode cek', KeyRound], ['wa', 'Pakai nomor WA', Phone]] as const).map(([m, label, Icon]) => (
                <button key={m} type="button" onClick={() => (setMode(m), setState('idle'))} className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-full py-2 font-display text-sm font-semibold ${mode === m ? 'text-cream' : 'text-brown/70'}`}>
                  {mode === m && <motion.span layoutId="find-mode" className="absolute inset-0 rounded-full bg-brown" transition={spring.snappy} />}
                  <Icon className="relative size-4" /> <span className="relative">{label}</span>
                </button>
              ))}
            </div>
            <AnimatePresence mode="popLayout" initial={false}>
              {mode === 'ref' ? (
                <motion.div key="ref" initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(4px)' }}>
                  <input value={ref} onChange={(e) => setRef(e.target.value)} maxLength={8} placeholder="Kode cek, misal K7Q2MX" autoCapitalize="characters" autoComplete="off" spellCheck={false} className={input} />
                </motion.div>
              ) : (
                <motion.div key="wa" className="flex flex-col gap-2" initial={{ opacity: 0, filter: 'blur(4px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }} exit={{ opacity: 0, filter: 'blur(4px)' }}>
                  <WaInput value={wa} onChange={setWa} placeholder="Nomor WA waktu pesan" />
                  <input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} placeholder="Nama waktu pesan" className={input} />
                </motion.div>
              )}
            </AnimatePresence>
            {notice && state === 'idle' && <p className="font-cond text-sm italic text-terracotta">{notice}</p>}
            {state === 'none' && <p className="font-cond text-sm italic text-terracotta">Belum ketemu — cek lagi {mode === 'ref' ? 'kodenya' : 'nomor & namanya (harus sama dengan waktu pesan)'}.</p>}
            {state === 'error' && <p className="font-cond text-sm italic text-terracotta">Sinyalnya lagi susah — coba lagi ya.</p>}
            <button type="button" onClick={() => void submit()} disabled={!ready || state === 'busy'} className="flex items-center justify-center gap-2 rounded-full bg-brown py-3 font-display font-semibold text-cream disabled:opacity-40">
              {state === 'busy' ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />} Cek
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

/** shrink a phone photo / screenshot to a JPEG small enough for the Sheet (≤1600 px, ~200–500 KB) */
async function shrink(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    const k = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight))
    const c = document.createElement('canvas')
    c.width = Math.round(img.naturalWidth * k)
    c.height = Math.round(img.naturalHeight * k)
    c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.82)
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** "Upload bukti transfer" — the Sheet saves it in Drive, renamed after the customer */
function ProofUpload({ order, onDone }: { order: MyOrder; onDone: () => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [state, setState] = useState<'idle' | 'busy' | 'error'>('idle')
  const [preview, setPreview] = useState<string>()
  const pick = async (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f) return
    setState('busy')
    try {
      const data = await shrink(f)
      setPreview(data)
      if (!(await uploadProof(order.id, data))) throw new Error('upload')
      setState('idle')
      onDone()
    } catch {
      setState('error')
    }
  }
  const sent = order.proof && state === 'idle'
  return (
    <div className="mt-3 w-full max-w-sm">
      <input ref={input} type="file" accept="image/*" className="hidden" onChange={(e) => void pick(e)} />
      <motion.button
        layout
        type="button"
        onClick={() => input.current?.click()}
        disabled={state === 'busy'}
        whileTap={{ scale: 0.97 }}
        className={`flex w-full items-center gap-3 rounded-3xl p-4 text-left ${sent ? 'bg-leaf/15 ring-2 ring-leaf/40' : 'bg-terracotta text-cream shadow-[0_5px_0_#6e3418]'}`}
      >
        {preview ? <img src={preview} alt="" className="size-12 shrink-0 rounded-xl object-cover" /> : <ImageUp className="size-7 shrink-0" />}
        <span className="min-w-0 flex-1">
          <span className="block font-display font-bold">{state === 'busy' ? 'Mengunggah…' : sent ? 'Bukti transfer terkirim' : 'Upload bukti transfer'}</span>
          <span className={`font-cond text-sm italic ${sent ? 'text-leaf' : 'text-cream/80'}`}>
            {state === 'error' ? 'Gagal — sinyal? Ketuk untuk coba lagi' : sent ? 'Ketuk untuk ganti foto' : 'Screenshot dari m-BCA / bukti transfer'}
          </span>
        </span>
        {state === 'busy' ? <Loader2 className="size-5 animate-spin" /> : sent ? <CheckCircle2 className="size-6 text-leaf" /> : null}
      </motion.button>
    </div>
  )
}

/**
 * "Promo N pemesan pertama" — slots fill up as dots. The count on screen can be ~30 s old;
 * that's fine, the Sheet decides when the order is written and the payment screen shows the result.
 */
export function PromoBanner({ promo, left, href, loud = false, className = '' }: { promo: Promo; left: number; href?: string; loud?: boolean; className?: string }) {
  const used = promo.slots - left
  const off = promo.mode === 'pct' ? `${promo.value}%` : rupiah(promo.value)
  const gone = left <= 0
  // someone just grabbed a slot (or the last one went) while this screen was open: say so
  const [taken, setTaken] = useState<{ n: number; at: number }>()
  const prevLeft = useRef(left)
  useEffect(() => {
    if (left < prevLeft.current) setTaken({ n: prevLeft.current - left, at: Date.now() })
    prevLeft.current = left
  }, [left])
  // on the landing page / link page it's a way in: tap → /preorder
  const Box = href ? motion.a : motion.div
  return (
    <Box
      layout
      {...(href ? { href, 'data-track': 'promo-banner', whileTap: { scale: 0.97 } } : {})}
      className={`relative block overflow-hidden rounded-3xl p-4 text-left ${gone ? 'border-2 border-dashed border-brown/15' : 'bg-leaf text-cream shadow-[0_6px_0_#3f5426]'} ${className}`}
      // loud (top of the landing page): breathes a little so the eye lands on it
      {...(loud && !gone ? { animate: { scale: [1, 1.025, 1] }, transition: { duration: 2.4, repeat: Infinity, ease: 'easeInOut' } } : {})}
    >
      {loud && !gone && (
        // a shine that sweeps across every few seconds
        <motion.span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 -left-1/3 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-cream/35 to-transparent"
          animate={{ x: ['0%', '450%'] }}
          transition={{ duration: 1.1, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut' }}
        />
      )}
      <AnimatePresence>
        {taken && !gone && (
          <motion.span
            key={taken.at}
            aria-hidden
            className="pointer-events-none absolute right-4 top-3 rounded-full bg-[#e8b53a] px-2.5 py-0.5 font-display text-sm font-bold text-brown shadow"
            initial={{ opacity: 0, y: 12, scale: 0.6 }}
            animate={{ opacity: [0, 1, 1, 0], y: [12, 0, -6, -26], scale: [0.6, 1.15, 1, 0.9] }}
            transition={{ duration: 2.2, times: [0, 0.15, 0.7, 1] }}
            onAnimationComplete={() => setTaken(undefined)}
          >
            −{taken.n} slot!
          </motion.span>
        )}
      </AnimatePresence>
      {taken && !gone && (
        // a flash across the card as the slot goes
        <motion.span key={'f' + taken.at} aria-hidden className="pointer-events-none absolute inset-0 rounded-3xl bg-[#e8b53a]" initial={{ opacity: 0.45 }} animate={{ opacity: 0 }} transition={{ duration: 0.9 }} />
      )}
      <div className="relative flex items-center gap-3">
        <motion.span className="shrink-0" {...(loud && !gone ? { animate: { rotate: [0, -14, 12, -8, 0] }, transition: { duration: 0.9, repeat: Infinity, repeatDelay: 2.6 } } : {})}>
          <Gift className={`size-7 ${gone ? 'text-brown/40' : ''}`} />
        </motion.span>
        <div className="min-w-0 flex-1">
          {loud && !gone && <span className="mb-1 inline-block rounded-full bg-[#e8b53a] px-2 py-0.5 font-display text-[0.65rem] font-bold uppercase tracking-wider text-brown">Terbatas · cepetan!</span>}
          <p className="font-display font-bold leading-tight">{gone ? `Promo ${promo.slots} pemesan pertama sudah habis` : `Promo ${promo.slots} pemesan pertama: potongan ${off}!`}</p>
          <p className={`font-cond text-sm italic ${gone ? 'text-brown/55' : 'text-cream/85'}`}>
            {gone ? 'Makasih yang udah gercep! Harga pre-order tetap lebih murah dari booth.' : (
              <>
                <span className="relative mr-1.5 inline-flex size-2 align-middle" aria-hidden>
                  <span className="absolute inline-flex size-full animate-ping rounded-full bg-cream opacity-70" />
                  <span className="relative inline-flex size-2 rounded-full bg-cream" />
                </span>
                Sisa{' '}
                <motion.span key={left} className="inline-block" initial={taken ? { scale: 1.8 } : false} animate={{ scale: 1 }} transition={{ type: 'spring', stiffness: 400, damping: 12 }}>
                  <Morph text={String(left)} className="font-bold not-italic" />
                </motion.span>{' '}
                slot{href ? ' · tap buat pesan' : ' · 1× per nomor WA · dihitung waktu pesanan masuk'}
              </>
            )}
          </p>
        </div>
        {href && !gone && <ArrowRight className="size-5 shrink-0" />}
        {gone && (
          <motion.span
            aria-hidden
            className="shrink-0 rotate-[-12deg] rounded-lg border-2 border-terracotta px-2 py-0.5 font-display text-sm font-bold uppercase tracking-wider text-terracotta"
            initial={{ scale: 2.6, opacity: 0, rotate: -30 }}
            animate={{ scale: 1, opacity: 1, rotate: -12 }}
            transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.15 }}
          >
            Habis
          </motion.span>
        )}
      </div>
      {!gone && promo.slots <= 30 && (
        <div className="mt-3 flex flex-wrap gap-1.5" aria-hidden>
          {Array.from({ length: promo.slots }, (_, i) => (
            <motion.span
              key={i}
              className={`h-2 min-w-2.5 flex-1 rounded-full transition-colors duration-500 ${i < used ? 'bg-cream/25' : 'bg-cream'}`}
              style={{ transitionDelay: `${i * 30}ms` }}
              // the dot that just went out pops
              animate={taken && i >= used - taken.n && i < used ? { scaleY: [1, 2.6, 1], scaleX: [1, 1.15, 1] } : { scaleY: 1, scaleX: 1 }}
              transition={{ duration: 0.6 }}
            />
          ))}
        </div>
      )}
    </Box>
  )
}

/** the team's rule, shown before ordering and again before paying */
export function NoRefund({ className = '' }: { className?: string }) {
  return (
    <p className={`flex items-start gap-2 rounded-2xl bg-brown/5 p-3 text-left font-display text-sm text-brown-soft ${className}`}>
      <Ban className="mt-0.5 size-4 shrink-0 text-terracotta" />
      <span>
        <span className="font-bold text-brown">No refund & no cancel.</span> Pesanan yang sudah dibayar nggak bisa dibatalkan atau diuangkan kembali — cek lagi pesanan & jadwal ambilnya sebelum transfer ya.
      </span>
    </p>
  )
}

/** a friendly plea: every transfer is matched by a person against the BCA mutasi */
function NoScam() {
  return (
    <div className="mt-3 flex w-full max-w-sm gap-3 rounded-3xl border-2 border-dashed border-terracotta/40 bg-terracotta/5 p-4 text-left">
      <ShieldAlert className="mt-0.5 size-5 shrink-0 text-terracotta" />
      <p className="font-display text-sm text-brown-soft">
        <span className="font-bold text-brown">Plis jangan scam ya 🙏</span> Tiap transfer kami cocokkan <em>manual</em>, satu per satu, ke mutasi BCA — bukti editan atau nominal kurang pasti ketahuan dan pesanannya kami batalkan. Kami mahasiswa, modalnya pas-pasan hehe.
      </p>
    </div>
  )
}

/** the hold room: says it's checking by itself, and when it last did */
function AutoCheck({ at }: { at?: number }) {
  return (
    <p className="mt-2 flex items-center gap-2 font-cond text-sm italic text-brown-soft">
      <span className="relative flex size-2">
        <span className="absolute inline-flex size-full animate-ping rounded-full bg-[#e8b53a] opacity-75" />
        <span className="relative inline-flex size-2 rounded-full bg-[#e8b53a]" />
      </span>
      Dicek otomatis tiap 10 detik{at ? ` · terakhir ${new Date(at).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta' })}` : ''}
      <RefreshCw className="size-3.5 animate-spin [animation-duration:3s]" />
    </p>
  )
}

/* ------------------------------------------------------------------ the tracker */

/**
 * One order, live: while it's on hold it shows how to pay (BCA transfer or QRIS) and waits;
 * the moment an admin verifies the transfer, it turns into the pickup code.
 */
export function OrderTracker({ order, config, onBack, onProof, checkedAt, onRetry, triedAt }: { order: MyOrder; config: PreorderConfig; onBack: () => void; onProof: () => void; checkedAt?: number; onRetry?: () => void; triedAt?: number }) {
  const bca = config.bca ?? { number: '', holder: '' }
  // the Sheet hears which one they picked, so the crew knows where to look for the money
  const [pay, setPay] = useState<PreorderPay>(order.pay ?? 'BCA')
  const pick = (p: PreorderPay) => {
    if (p === pay) return
    setPay(p)
    setPreorderPay(order.id, p)
  }
  const verified = order.status === 'process' || order.status === 'done'
  // celebrate the moment it turns verified while they're looking (not on every visit)
  const [burst, setBurst] = useState<number>()
  const [was, setWas] = useState(order.status)
  useEffect(() => {
    if (was === 'hold' && verified) setBurst(Date.now())
    setWas(order.status)
  }, [order.status]) // eslint-disable-line react-hooks/exhaustive-deps
  // a promo slot they just landed gets its own little party (only right after ordering, not on every visit)
  const [promoBurst, setPromoBurst] = useState<number>()
  const fresh = !!order.promo && order.status === 'hold' && Date.now() - order.at < 60_000
  useEffect(() => {
    if (fresh) setPromoBurst(Date.now() + 500)
  }, [order.id]) // eslint-disable-line react-hooks/exhaustive-deps

  if (order.queued || order.failed) return <QueuedOrder order={order} onBack={onBack} onRetry={onRetry} triedAt={triedAt} />

  return (
    <div className="flex flex-col items-center text-center">
      <ParticleField preset="burst" overrides={{ shape: 'leaf', count: 80 }} points={[[window.innerWidth / 2, window.innerHeight * 0.3]]} burstKey={burst} />
      <ParticleField preset="burst" overrides={{ shape: 'sparkle', count: 60, colors: ['#e8b53a', '#8faa4f', '#f5ebdd', '#5e7b3a'] }} points={[[window.innerWidth / 2, 190]]} burstKey={promoBurst} />
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 self-start font-display font-semibold text-brown-soft">
        <ArrowLeft className="size-4" /> Kembali
      </button>
      <StatusPill status={order.status} />
      {(order.status === 'hold' || order.status === 'rejected') && <AutoCheck at={checkedAt} />}
      {order.ref && (
        <div className="mt-3 flex items-center gap-2 rounded-full border-2 border-dashed border-brown/20 py-1 pl-4 pr-1">
          <span className="font-cond text-sm italic text-brown-soft">Kode cek</span>
          <span className="font-display font-bold tracking-[0.2em]">{order.ref}</span>
          <CopyBtn text={order.ref} label="Salin kode cek" />
        </div>
      )}

      <AnimatePresence mode="wait">
        {verified ? (
          <motion.div key="code" className="flex w-full flex-col items-center" initial={{ opacity: 0, scale: 0.92, filter: 'blur(8px)' }} animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }} exit={{ opacity: 0 }} transition={spring.glide}>
            <h1 className="mt-4 font-script text-6xl font-bold">{order.status === 'done' ? 'Makasih!' : 'Lunas!'}</h1>
            <p className="mt-2 font-display text-lg text-brown-soft">{order.status === 'done' ? 'Pesananmu sudah diambil. Selamat menikmati!' : 'Pembayaranmu sudah dicek. Tunjukkan kode ini di booth:'}</p>
            <motion.p className="mt-4 rounded-3xl bg-brown px-8 py-4 font-display text-5xl font-bold tracking-wider text-cream shadow-[0_6px_0_#3a1c0f]" initial={{ scale: 0.6, rotate: -6 }} animate={{ scale: 1, rotate: -2 }} transition={spring.pop}>
              {order.code}
            </motion.p>
            <p className="mt-3 font-display text-lg">
              atas nama <b>{order.name}</b>
            </p>
          </motion.div>
        ) : order.status === 'rejected' ? (
          <motion.div key="rejected" className="mt-4 flex max-w-sm flex-col items-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <h1 className="font-display text-3xl font-bold">Transfernya belum ketemu</h1>
            <p className="mt-2 font-display text-lg text-brown-soft">Tim kami belum menemukan pembayaran untuk pesanan ini. Sudah transfer? Upload bukti transfernya — kami cek ulang.</p>
            <ProofUpload order={order} onDone={onProof} />
            <AdminContact className="mt-4 text-left" />
          </motion.div>
        ) : (
          <motion.div key="pay" className="flex w-full flex-col items-center" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, filter: 'blur(8px)' }}>
            <h1 className="mt-4 font-display text-3xl font-bold">Tinggal bayar</h1>
            <p className="mt-1 max-w-sm font-display text-brown-soft">Bayar persis sejumlah ini lewat transfer BCA atau QRIS, lalu tunggu sebentar — kode ambilmu muncul di sini setelah kami cek.</p>
            {!!order.promo && (
              <motion.p
                className="mt-3 inline-flex items-center gap-2 rounded-full bg-leaf px-4 py-1.5 font-display text-sm font-semibold text-cream shadow-[0_4px_0_#3f5426]"
                initial={fresh ? { scale: 0.3, opacity: 0, rotate: -6 } : false}
                animate={{ scale: [null, 1.12, 1], opacity: 1, rotate: 0 }}
                transition={{ delay: 0.45, duration: 0.6, ease: 'backOut' }}
              >
                <motion.span animate={fresh ? { rotate: [0, -18, 14, -10, 0], scale: [1, 1.3, 1] } : undefined} transition={{ delay: 0.9, duration: 0.8 }}>
                  <Gift className="size-4" />
                </motion.span>
                Selamat! Kamu dapat promo pemesan pertama −{rupiah(order.promo)}
              </motion.p>
            )}
            {order.promoMissed && !order.promo && (
              <p className="mt-3 max-w-sm rounded-2xl bg-brown/5 px-4 py-2 font-display text-sm text-brown-soft">{order.promoMissed === 'used' ? 'Promo pemesan pertama cuma 1× per nomor WA, dan nomor ini sudah dapat 🙏 Totalnya pakai harga pre-order biasa (tetap lebih murah dari booth).' : 'Yah, slot promonya keburu habis duluan 🥲 Totalnya pakai harga pre-order biasa (tetap lebih murah dari booth).'}</p>
            )}

            <div className="mt-5 w-full max-w-sm rounded-3xl bg-brown p-5 text-cream">
              <p className="font-cond text-sm italic text-cream/70">Total bayar</p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="font-display text-4xl font-bold tabular-nums">{rupiah(order.total)}</span>
                <CopyBtn text={String(order.total * 1000)} label="Salin total" />
              </div>
            </div>

            <div className="mt-3 grid w-full max-w-sm grid-cols-2 gap-1 rounded-2xl bg-brown/10 p-1">
              {(['BCA', 'QRIS'] as const).map((p) => (
                <button key={p} type="button" onClick={() => pick(p)} aria-pressed={pay === p} className="relative flex items-center justify-center gap-2 rounded-xl py-2.5 font-display font-semibold">
                  {pay === p && <motion.span layoutId="po-pay" className="absolute inset-0 rounded-xl bg-brown" transition={spring.snappy} />}
                  <span className={`relative flex items-center gap-2 ${pay === p ? 'text-cream' : ''}`}>
                    {p === 'BCA' ? <Landmark className="size-4" /> : <QrCode className="size-4" />} {p === 'BCA' ? 'Transfer BCA' : 'QRIS'}
                  </span>
                </button>
              ))}
            </div>

            <AnimatePresence mode="wait" initial={false}>
              {pay === 'BCA' ? (
                <motion.div key="bca" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 w-full max-w-sm rounded-3xl border-2 border-brown/15 bg-cream p-5 text-left">
                  <p className="flex items-center gap-2 font-display font-bold">
                    <Landmark className="size-5 text-terracotta" /> Transfer BCA
                  </p>
                  {bca.number ? (
                    <>
                      <div className="mt-2 flex items-center justify-between gap-3">
                        <span className="font-display text-2xl font-bold tracking-wider tabular-nums">{bca.number}</span>
                        <CopyBtn text={bca.number.replace(/\D/g, '')} label="Salin nomor rekening" />
                      </div>
                      {bca.holder && <p className="font-cond italic text-brown-soft">a.n. {bca.holder}</p>}
                    </>
                  ) : (
                    <p className="mt-2 font-display font-semibold text-terracotta">[nomor rekening belum diisi admin — tanya admin dulu ya]</p>
                  )}
                </motion.div>
              ) : (
                <motion.div key="qris" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} className="mt-3 w-full max-w-sm rounded-3xl border-2 border-brown/15 bg-cream p-5">
                  <p className="flex items-center gap-2 text-left font-display font-bold">
                    <QrCode className="size-5 text-terracotta" /> QRIS · semua e-wallet & m-banking
                  </p>
                  <QrisCode total={order.total} save className="mx-auto mt-3 max-w-64" />
                  <p className="mt-3 text-left font-cond text-sm italic text-brown-soft">Buka di HP ini? Simpan gambarnya, lalu di GoPay / DANA / OVO / ShopeePay / m-banking pilih <b>Scan → dari galeri</b>. Nominal {rupiah(order.total)} sudah terisi otomatis.</p>
                </motion.div>
              )}
            </AnimatePresence>

            <ProofUpload order={order} onDone={onProof} />
            <NoScam />
            <NoRefund className="mt-3 w-full max-w-sm" />

            <ol className="mt-5 w-full max-w-sm space-y-2 text-left font-display text-brown-soft">
              {[pay === 'QRIS' ? 'Scan QRIS di atas (nominal sudah terisi), lalu bayar.' : 'Transfer persis sejumlah total di atas.', 'Upload screenshot bukti bayarnya di sini.', 'Tim Pletok cek — halaman ini ikut berubah sendiri.', 'Kode ambil muncul di sini & kami kirim lewat WhatsApp.'].map((t, i) => (
                <li key={i} className="flex gap-3">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-terracotta font-display text-sm font-bold text-cream">{i + 1}</span>
                  {t}
                </li>
              ))}
            </ol>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 w-full max-w-sm rounded-3xl border-2 border-brown/10 bg-cream/80 p-4 text-left">
        {order.lines.map((i) => (
          <p key={i.id} className="flex justify-between font-display">
            <span>
              {i.qty}× {i.name}
            </span>
            <span className="tabular-nums">{rupiah(i.price * i.qty)}</span>
          </p>
        ))}
        {!!order.promo && (
          <p className="flex justify-between font-display font-semibold text-leaf">
            <span className="flex items-center gap-1.5"><Gift className="size-4" /> Promo pemesan pertama</span>
            <span className="tabular-nums">−{rupiah(order.promo)}</span>
          </p>
        )}
        <p className="mt-2 flex justify-between border-t border-brown/10 pt-2 font-display text-lg font-bold">
          <span>Total</span>
          <span className="tabular-nums">{rupiah(order.total)}</span>
        </p>
        {order.saved > 0 && <p className="mt-1 text-right font-display text-sm font-semibold text-leaf">Kamu hemat {rupiah(order.saved)} dari harga di booth</p>}
      </div>
      <p className="mt-5 flex items-center gap-2 font-display text-brown-soft">
        <MapPin className="size-4" /> Ambil di {EVENT.table} · {EVENT.dateLabel}, {EVENT.timeLabel}
      </p>
      <p className="mt-2 max-w-sm font-cond text-sm italic text-brown/55">
        Tersimpan di HP ini — buka /preorder lagi kapan saja. Ganti HP? Pakai <b>kode cek</b>{order.ref ? ` ${order.ref}` : ''} atau nomor WA + nama di "Cek pesanan".
      </p>
      <AdminContact className="mt-3 max-w-sm text-left" />
    </div>
  )
}

const FAILED_WHY: Record<string, string> = {
  closed: 'Pre-order keburu tutup waktu sistem kami pulih.',
  empty: 'Ada menu di pesananmu yang sudah tidak tersedia.',
  contact: 'Nama atau nomor WhatsApp-nya tidak terbaca sistem.',
}

/**
 * Plan B, on the customer's side: the order is safe on this phone while the Sheet is down and goes
 * out by itself once it's back. Nothing to pay yet — the final total (promo) and kode cek come from
 * the Sheet. Can't wait? The whole order goes to the admin on WhatsApp in one tap.
 */
function QueuedOrder({ order, onBack, onRetry, triedAt }: { order: MyOrder; onBack: () => void; onRetry?: () => void; triedAt?: number }) {
  const [retrying, setRetrying] = useState(false)
  const failed = !!order.failed
  return (
    <div className="flex flex-col items-center text-center">
      <button type="button" onClick={onBack} className="mb-4 inline-flex items-center gap-1.5 self-start font-display font-semibold text-brown-soft">
        <ArrowLeft className="size-4" /> Kembali
      </button>
      {failed ? (
        <span className="inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-1.5 font-display text-sm font-semibold text-cream"><XCircle className="size-4" /> Pesanan belum bisa diterima</span>
      ) : (
        <span className="inline-flex items-center gap-2 rounded-full bg-[#e8b53a] px-4 py-1.5 font-display text-sm font-semibold text-brown"><CloudOff className="size-4 animate-pulse" /> Menunggu sistem</span>
      )}
      <h1 className="mt-4 font-display text-3xl font-bold">{failed ? 'Yah, belum bisa masuk' : 'Pesananmu aman di HP ini'}</h1>
      <p className="mt-2 max-w-sm font-display text-brown-soft">
        {failed
          ? `${FAILED_WHY[order.failed!] ?? 'Sistem menolak pesanan ini.'} Chat admin ya — kami bantu langsung.`
          : 'Sistem Pletok lagi gangguan sebentar. Pesananmu sudah tersimpan dan terkirim otomatis begitu sistem pulih — biarkan halaman ini terbuka, atau buka /preorder lagi nanti.'}
      </p>
      {!failed && (
        <>
          <p className="mt-3 flex items-center gap-2 font-cond text-sm italic text-brown/60">
            <Loader2 className="size-3.5 animate-spin" /> Dicoba lagi tiap 15 detik{triedAt ? ` · terakhir ${new Date(triedAt).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' })}` : ''}
          </p>
          {onRetry && (
            <button
              type="button"
              disabled={retrying}
              onClick={async () => {
                setRetrying(true)
                await onRetry()
                setRetrying(false)
              }}
              className="mt-2 inline-flex items-center gap-1.5 rounded-full border-2 border-brown/15 px-4 py-2 font-display text-sm font-semibold"
            >
              {retrying ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />} Coba kirim sekarang
            </button>
          )}
          <p className="mt-5 w-full max-w-sm rounded-2xl bg-[#e8b53a]/30 p-4 text-left font-display text-sm">
            <b>Jangan bayar dulu ya.</b> Total final (termasuk promo), cara bayar & kode cek muncul di sini begitu pesananmu masuk ke sistem.
          </p>
        </>
      )}

      {ADMIN_WA && (
        <a
          href={orderToAdmin({ ...order, wa: order.queued?.wa, note: order.queued?.note })}
          target="_blank"
          rel="noreferrer"
          data-track="preorder-planb-wa"
          className="mt-4 flex w-full max-w-sm items-center gap-3 rounded-3xl bg-leaf p-4 text-left text-cream shadow-[0_4px_0_#3f5426]"
        >
          <Send className="size-5 shrink-0" />
          <span className="min-w-0 flex-1 font-display leading-tight">
            <b className="block">{failed ? 'Chat admin soal pesanan ini' : 'Nggak mau nunggu? Kirim ke admin'}</b>
            <span className="text-sm text-cream/80">Pesananmu langsung tersusun di WhatsApp · {ADMIN_NAME ? ADMIN_NAME.charAt(0) + ADMIN_NAME.slice(1).toLowerCase() : 'admin'}</span>
          </span>
          <ArrowRight className="size-5 shrink-0" />
        </a>
      )}

      <div className="mt-6 w-full max-w-sm rounded-3xl border-2 border-brown/10 bg-cream/80 p-4 text-left">
        {order.lines.map((i) => (
          <p key={i.id} className="flex justify-between font-display">
            <span>{i.qty}× {i.name}</span>
            <span className="tabular-nums">{rupiah(i.price * i.qty)}</span>
          </p>
        ))}
        <p className="mt-2 flex justify-between border-t border-brown/10 pt-2 font-display text-lg font-bold">
          <span>Perkiraan total</span>
          <span className="tabular-nums">{rupiah(order.total)}</span>
        </p>
        <p className="mt-1 font-cond text-xs italic text-brown/55">Total final dihitung sistem (promo pemesan pertama ikut dicek saat pesanan masuk).</p>
      </div>
      <p className="mt-5 flex items-center gap-2 font-display text-brown-soft">
        <MapPin className="size-4" /> Ambil di {EVENT.table} · {EVENT.dateLabel}, {EVENT.timeLabel}
      </p>
    </div>
  )
}

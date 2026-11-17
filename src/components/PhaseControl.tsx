import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { BarChart3, Clock, Coffee, History, Maximize, Megaphone, Minimize, PartyPopper, RotateCcw, Sparkles, X } from 'lucide-react'
import { clockShifted, nudgeClock, setClock, setForcedPhase, useEventPhase, type Phase } from '../hooks/useEventPhase'
import { EVENT } from '../data/event'
import { signal } from '../lib/events'
import { toggleFullscreen, useFullscreen } from '../hooks/useFullscreen'
import { isBoothDevice, setBoothDevice } from '../lib/analytics'
import { spring } from '../lib/motion'
import { useFeedbackOpen } from '../hooks/useFeedbackOpen'
import { setFeedbackMode } from '../hooks/useMenu'

const OPTIONS: Array<{ id: Phase | null; label: string }> = [
  { id: null, label: 'Auto' },
  { id: 'pre-open', label: 'Pre-open' },
  { id: 'open', label: 'Open' },
  { id: 'last-call', label: 'Last call' },
  { id: 'closed', label: 'Closed' },
]

const O = EVENT.open.getTime()
const C = EVENT.close.getTime()
const MIN = 60_000
/** one tap to land on any moment of the day — each preview a real state the booth will hit */
const JUMPS: Array<{ label: string; at: number | null; hint: string }> = [
  { label: 'Jam asli', at: null, hint: 'ikut jam laptop' },
  { label: 'H-3', at: O - 3 * 1440 * MIN - 3 * 60 * MIN, hint: 'dashboard preview' },
  { label: 'H-1', at: O - 22 * 60 * MIN, hint: '15.00 · hitung mundur' },
  { label: '−6 menit', at: O - 6 * MIN, hint: 'sebelum zoom logo' },
  { label: '−3 menit', at: O - 3 * MIN, hint: 'tengah zoom' },
  { label: '−15 detik', at: O - 15_000, hint: 'grand opening' },
  { label: 'Buka +5m', at: O + 5 * MIN, hint: 'booth buka' },
  { label: 'Last call −10d', at: C - 30 * MIN - 10_000, hint: 'masuk last call' },
  { label: 'Tutup −10d', at: C - 10_000, hint: 'animasi tutup' },
  { label: 'Sudah tutup', at: C + 5 * MIN, hint: 'terima kasih' },
]
const NUDGES = [
  { label: '−1 jam', ms: -60 * MIN },
  { label: '−1 m', ms: -MIN },
  { label: '+1 m', ms: MIN },
  { label: '+1 jam', ms: 60 * MIN },
]
/** epoch ms ⇄ `datetime-local` value, always in WIB whatever the laptop's zone */
const toWib = (ms: number) => new Date(ms + 7 * 3600_000).toISOString().slice(0, 19)
const fromWib = (v: string) => Date.parse(`${v.length === 16 ? `${v}:00` : v}+07:00`)

/**
 * Crew-only panel. Phase, clock and every scene can be overridden here; the whole site reads
 * one shared clock, so a change here moves everything at once. A + G fires the attention show, A + T pops hype stickers (spam it). A + F toggles full-screen (which also keeps the laptop awake). Hold A + B together (or long-press the bottom-left corner on touch)
 * to override the phase if the schedule changes on the day.
 */
export function PhaseControl() {
  const [open, setOpen] = useState(false)
  // one crew panel at a time: opening this one closes A + C, and the other way round
  useEffect(() => {
    if (open) signal.emit('panel-booth')
  }, [open])
  useEffect(() => signal.on('panel-menu', () => setOpen(false)), [])
  const { phase, forced, now, remaining } = useEventPhase()
  const shifted = clockShifted()
  const { full, awake } = useFullscreen()
  const [booth, setBooth] = useState(isBoothDevice)

  useEffect(() => {
    const down = new Set<string>()
    const onDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase()
      down.add(k)
      if (down.has('a') && down.has('b')) setOpen((o) => !o)
      if (down.has('a') && k === 'f') toggleFullscreen()
      if (down.has('a') && k === 'g' && !e.repeat) signal.emit('attention')
      // A + T is meant to be mashed — key-repeat while holding counts too
      if (down.has('a') && k === 't') signal.emit('hype')
      if (k === 'escape') setOpen(false)
    }
    const onUp = (e: KeyboardEvent) => down.delete(e.key.toLowerCase())
    const clear = () => down.clear()
    window.addEventListener('keydown', onDown)
    window.addEventListener('keyup', onUp)
    window.addEventListener('blur', clear)
    return () => {
      window.removeEventListener('keydown', onDown)
      window.removeEventListener('keyup', onUp)
      window.removeEventListener('blur', clear)
    }
  }, [])

  // touch fallback: long-press an invisible corner
  let pressTimer: number | undefined
  const corner = (
    <div
      className="fixed bottom-0 left-0 z-[70] size-12"
      onPointerDown={() => (pressTimer = window.setTimeout(() => setOpen(true), 1200))}
      onPointerUp={() => window.clearTimeout(pressTimer)}
      onPointerLeave={() => window.clearTimeout(pressTimer)}
    />
  )

  const time = new Date(now).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const date = new Date(now).toLocaleDateString('id-ID', { timeZone: 'Asia/Jakarta', weekday: 'short', day: 'numeric', month: 'short' })
  const s = Math.ceil(remaining / 1000)
  const left = `${Math.floor(s / 86400) ? `${Math.floor(s / 86400)}h ` : ''}${String(Math.floor((s % 86400) / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  return (
    <>
      {corner}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-x-0 bottom-4 z-[80] mx-auto max-h-[calc(100dvh-2rem)] w-[min(94vw,700px)] overflow-y-auto rounded-3xl border border-cream/10 bg-[#2b160c] p-4 text-cream shadow-2xl"
            initial={{ y: 80, opacity: 0, scale: 0.9 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 60, opacity: 0, scale: 0.95 }}
            transition={spring.snappy}
          >
            <div className="mb-3 flex items-center justify-between">
              <div>
                <p className="font-display text-lg font-semibold">Kontrol Booth</p>
                <p className="flex flex-wrap items-center gap-1.5 font-cond text-sm italic text-cream/60">
                  <Clock className="size-3.5" /> {date} · <b className="font-display not-italic tabular-nums text-cream">{time}</b> WIB
                  {shifted && <span className="rounded-full bg-spice px-2 not-italic text-brown">jam diubah</span>}· fase <b className="text-yakult">{phase}</b> {forced && '(manual)'} ·{' '}
                  {phase === 'closed' ? 'selesai' : `${phase === 'pre-open' ? 'buka' : 'tutup'} dalam ${left}`}
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="grid size-9 place-items-center rounded-full bg-cream/10" aria-label="Tutup panel">
                <X className="size-4" />
              </button>
            </div>
            <Label>Fase</Label>
            <div className="relative grid grid-cols-5 gap-1 rounded-2xl bg-cream/5 p-1">
              {OPTIONS.map((o) => {
                const active = (o.id === null && !forced) || (forced && o.id === phase)
                return (
                  <button key={o.label} onClick={() => setForcedPhase(o.id)} className="relative rounded-xl px-2 py-2.5 font-display text-sm font-semibold">
                    {active && <motion.span layoutId="phase-pill" className="absolute inset-0 rounded-xl bg-terracotta" transition={spring.snappy} />}
                    <span className="relative">{o.label}</span>
                  </button>
                )
              })}
            </div>

            <Label>Form feedback</Label>
            <FeedbackSwitch />

            <a href="/hasil" target="_blank" rel="noreferrer" className="mt-2 flex items-center justify-between rounded-2xl bg-cream/5 px-4 py-2.5 font-display text-sm font-semibold hover:bg-cream/10">
              Lihat hasil feedback (grafik) <span className="font-cond text-xs italic text-cream/50">/hasil · PIN crew ↗</span>
            </a>

            <Label>Waktu</Label>
            <div className="grid grid-cols-5 gap-1.5">
              {JUMPS.map((j) => {
                const on = j.at === null ? !shifted : shifted && Math.abs(now - j.at) < 1500
                return (
                  <button
                    key={j.label}
                    onClick={() => setClock(j.at)}
                    className={`flex flex-col items-start rounded-xl px-2.5 py-1.5 text-left transition-colors ${on ? 'bg-terracotta' : 'bg-cream/5 hover:bg-cream/10'}`}
                  >
                    <span className="font-display text-sm font-semibold leading-tight">{j.label}</span>
                    <span className="font-cond text-[0.7rem] italic leading-tight text-cream/55">{j.hint}</span>
                  </button>
                )
              })}
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
              {NUDGES.map((n) => (
                <button key={n.label} onClick={() => nudgeClock(n.ms)} className="rounded-full bg-cream/10 px-3 py-1 font-display text-sm font-semibold tabular-nums active:scale-95">
                  {n.label}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 font-cond text-sm italic text-cream/60">
                <History className="size-3.5" /> set jam
                <input
                  type="datetime-local"
                  step={1}
                  value={toWib(now)}
                  onChange={(e) => {
                    const at = fromWib(e.target.value)
                    if (!Number.isNaN(at)) setClock(at)
                  }}
                  className="rounded-lg bg-cream/10 px-2 py-1 font-display text-sm not-italic text-cream [color-scheme:dark]"
                />
              </label>
            </div>

            <Label>Adegan</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                onClick={() => {
                  setOpen(false)
                  signal.emit('grand-opening')
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-leaf px-4 py-3 font-display font-semibold"
              >
                <PartyPopper className="size-4" /> Grand opening!
              </button>
              <button
                onClick={() => {
                  setOpen(false)
                  signal.emit('replay-intro')
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-cream/10 px-4 py-3 font-display font-semibold"
              >
                <RotateCcw className="size-4" /> Putar intro
              </button>
              <button
                onClick={() => {
                  setOpen(false)
                  signal.emit('attention')
                }}
                className="flex items-center justify-center gap-2 rounded-2xl bg-terracotta px-4 py-3 font-display font-semibold"
              >
                <Megaphone className="size-4" /> Tarik perhatian!
              </button>
              <button
                onClick={toggleFullscreen}
                className={`col-span-3 flex items-center justify-center gap-2 rounded-2xl px-4 py-3 font-display font-semibold ${full ? 'bg-cream text-brown' : 'bg-cream/10'}`}
              >
                {full ? <Minimize className="size-4" /> : <Maximize className="size-4" />}
                {full ? 'Keluar layar penuh' : 'Layar penuh'}
                {full && (
                  <span className={`ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 font-cond text-xs italic ${awake ? 'bg-leaf text-cream' : 'bg-brown/15'}`}>
                    <Coffee className="size-3" /> {awake ? 'laptop tetap nyala' : 'no-sleep tidak didukung'}
                  </span>
                )}
              </button>
            </div>
            <button
              onClick={() => {
                setBoothDevice(!booth)
                setBooth(!booth)
              }}
              className={`mt-2 flex w-full items-center justify-between gap-2 rounded-2xl px-4 py-2.5 font-display text-sm font-semibold ${booth ? 'bg-leaf' : 'bg-cream/10'}`}
            >
              <span className="flex items-center gap-2">
                <BarChart3 className="size-4" /> Laptop booth — jangan dihitung di analytics
              </span>
              <span className="rounded-full bg-black/20 px-2 py-0.5 text-xs">{booth ? 'ON' : 'OFF'}</span>
            </button>
            <p className="mt-3 flex items-center gap-1.5 font-cond text-xs italic text-cream/50">
              <Sparkles className="size-3" /> A + B panel · A + G tarik perhatian · A + T spam hype · A + F layar penuh (anti-sleep) · fase & jam tersimpan walau di-refresh · “Auto” + “Jam asli” = ikut jadwal sungguhan
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

/** Auto = open from 13.00 until 25 min after closing; Buka / Tutup override it (synced to phones) */
function FeedbackSwitch() {
  const { open, mode, until } = useFeedbackOpen()
  const hhmm = new Date(until).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })
  const opts = [
    { id: 'auto', label: 'Auto' },
    { id: 'open', label: 'Buka' },
    { id: 'closed', label: 'Tutup' },
  ] as const
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid flex-1 grid-cols-3 gap-1 rounded-2xl bg-cream/5 p-1">
        {opts.map((o) => (
          <button key={o.id} onClick={() => setFeedbackMode(o.id)} className="relative rounded-xl px-2 py-2 font-display text-sm font-semibold">
            {mode === o.id && <motion.span layoutId="fb-pill" className="absolute inset-0 rounded-xl bg-terracotta" transition={spring.snappy} />}
            <span className="relative">{o.label}</span>
          </button>
        ))}
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 font-cond text-xs font-semibold italic ${open ? 'bg-leaf' : 'bg-cream/10 text-cream/60'}`}>
        {open ? 'terbuka' : 'tertutup'}
        {mode === 'auto' && ` · auto s/d ${hhmm}`}
      </span>
    </div>
  )
}

function Label({ children }: { children: string }) {
  return <p className="mb-1.5 mt-3 font-cond text-xs font-semibold uppercase italic tracking-[0.3em] text-cream/45">{children}</p>
}

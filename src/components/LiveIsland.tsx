import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { BadgePercent, CupSoda, Gift, MapPin, MessageCircleHeart, MessageCircleOff, PackageCheck, PartyPopper, RefreshCw, ShoppingBag, Wifi, WifiOff, type LucideIcon } from 'lucide-react'
import { useEventPhase, type Phase } from '../hooks/useEventPhase'
import { useMenu, type LiveMenu } from '../hooks/useMenu'
import { usePreorder } from '../hooks/usePreorder'
import { useFeedbackOpen } from '../hooks/useFeedbackOpen'
import { BACKEND, onStats } from '../lib/backend'
import { EVENT } from '../data/event'
import { Countdown } from './Countdown'
import { SignalBars } from './SignalBars'
import { Morph } from './Morph'

const pad = (n: number) => String(n).padStart(2, '0')
const clock = (ms: number) => {
  const s = Math.ceil(ms / 1000)
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`
}

const TONE: Record<Phase, { dot: string; label: string; title: string }> = {
  'pre-open': { dot: '#c98a3c', label: 'Segera buka', title: 'Buka dalam' },
  open: { dot: '#8faa4f', label: 'Sedang buka', title: 'Tutup dalam' },
  'last-call': { dot: '#e9827f', label: 'Last call!', title: 'Tutup dalam' },
  closed: { dot: '#a8572a', label: 'Tutup', title: 'Sampai jumpa' },
}

const GREEN = '#8faa4f'
const GOLD = '#e8b53a'
const RED = '#e9827f'

export interface Note {
  id: number
  icon: LucideIcon
  text: string
  sub?: string
  /** a few words for the small desktop version */
  short?: string
  tone: string
}

/* The current notice, shared: on the booth screen the clock pill (a "host") shows it in place of
 * the big island, so nothing lands on top of the layout. */
let shared: Note | null = null
let hosts = 0
const subs = new Set<() => void>()
const emit = () => subs.forEach((f) => f())
const subscribe = (f: () => void) => {
  subs.add(f)
  return () => void subs.delete(f)
}
/** read the live notice (for a host) */
export const useIslandNote = () => useSyncExternalStore(subscribe, () => shared)
/** mount inside a component that shows notices itself — the floating island steps aside */
export function useIslandHost() {
  useEffect(() => {
    hosts++
    emit()
    return () => {
      hosts--
      emit()
    }
  }, [])
}

/** springs tuned to feel like the iPhone island: quick to grow, a touch of overshoot, soft to settle */
const ISLAND = { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 } as const

/** what changed on the menu, in the words a customer cares about */
function describeMenu(prev: LiveMenu, next: LiveMenu): Omit<Note, 'id'> | null {
  if (next.allSoldOut && !prev.allSoldOut) return { icon: PartyPopper, text: 'Ludes terjual!', sub: 'Makasih semuanya', tone: GOLD }
  const sold = next.drinks.filter((d, i) => d.soldOut && !prev.drinks[i]?.soldOut)
  if (sold.length) return { icon: CupSoda, text: `${sold.map((d) => d.short).join(' & ')} habis`, short: sold.length > 1 ? `${sold.length} menu habis` : undefined, sub: 'Menu lain masih ada', tone: RED }
  const back = next.drinks.filter((d, i) => !d.soldOut && prev.drinks[i]?.soldOut)
  if (back.length) return { icon: PackageCheck, text: `${back.map((d) => d.short).join(' & ')} ada lagi`, short: back.length > 1 ? `${back.length} menu ada lagi` : undefined, sub: 'Baru di-restock', tone: GREEN }
  const priced = [
    ...next.drinks.filter((d, i) => d.price !== prev.drinks[i]?.price).map((d) => `${d.short} ${d.price}K`),
    ...next.bundles.filter((b, i) => b.price !== prev.bundles[i]?.price).map((b) => `${b.name.replace('Paket ', '')} ${b.price}K`),
  ]
  if (priced.length) return { icon: BadgePercent, text: 'Harga diperbarui', sub: priced.length === 1 ? priced[0] : `${priced.length} menu`, tone: GOLD }
  const bundleSold = next.bundles.find((b, i) => b.soldOut && !prev.bundles[i]?.soldOut)
  if (bundleSold) return { icon: CupSoda, text: `${bundleSold.name.replace('Paket ', '')} habis`, tone: RED }
  return { icon: RefreshCw, text: 'Menu diperbarui', tone: GOLD }
}

const sig = (m: LiveMenu) => JSON.stringify([m.drinks.map((d) => [d.price, d.soldOut]), m.bundles.map((b) => [b.price, b.soldOut, b.items])])

/**
 * Remote changes (from /config) as island notices. Nothing fires for what the page learns on
 * load — only for what changes while someone is watching.
 */
function useNotes() {
  const menu = useMenu()
  const preorder = usePreorder().open
  const feedback = useFeedbackOpen().open
  const [online, setOnline] = useState(navigator.onLine)
  const [note, setNote] = useState<Note | null>(null)
  const armed = useRef(false)
  const prev = useRef({ menu, preorder, feedback, online, sig: sig(menu) })
  const n = useRef(0)

  // arm once the first Sheet answer has settled every hook (or straight away without a Sheet)
  useEffect(() => {
    let t = 0
    const arm = () => {
      window.clearTimeout(t)
      t = window.setTimeout(() => (armed.current = true), 800)
    }
    if (!BACKEND) arm()
    const off = onStats(() => !armed.current && arm())
    return () => {
      off()
      window.clearTimeout(t)
    }
  }, [])

  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])

  const s = sig(menu)
  useEffect(() => {
    const p = prev.current
    let next: Omit<Note, 'id'> | null = null
    if (armed.current) {
      if (online !== p.online && online) next = { icon: Wifi, text: 'Online lagi', sub: 'Menu ikut terbaru', tone: GREEN }
      else if (preorder !== p.preorder) next = preorder ? { icon: ShoppingBag, text: 'Pre-order dibuka', sub: 'Ambil di booth', tone: GREEN } : { icon: ShoppingBag, text: 'Pre-order ditutup', tone: RED }
      else if (feedback !== p.feedback) next = feedback ? { icon: MessageCircleHeart, text: 'Feedback dibuka', sub: 'Kami nungguin :)', tone: GREEN } : { icon: MessageCircleOff, text: 'Feedback ditutup', tone: RED }
      else if (s !== p.sig) next = describeMenu(p.menu, menu)
    }
    prev.current = { menu, preorder, feedback, online, sig: s }
    if (!next) return
    setNote({ ...next, id: ++n.current })
  }, [s, preorder, feedback, online, menu])

  // each notice holds for a moment, then the island folds back
  useEffect(() => {
    if (!note) return
    const t = window.setTimeout(() => setNote(null), 3400)
    return () => window.clearTimeout(t)
  }, [note])

  const offline: Note | null = online ? null : { id: -1, icon: WifiOff, text: 'Offline', sub: 'Menu tetap bisa dilihat', tone: RED }
  const current = note ?? offline
  useEffect(() => {
    shared = current
    emit()
  }, [current?.id]) // eslint-disable-line react-hooks/exhaustive-deps
  return { note: current, dismiss: () => setNote(null) }
}

/**
 * One Dynamic-Island capsule at the top for everything live: the countdown on phones before we
 * open, and every change the crew makes from /config (menu, prices, sold out, pre-order, feedback,
 * signal). When there's nothing to say it isn't there at all — it drops in as a bead, swells to
 * fit the notice, then folds away.
 */
export function LiveIsland({ phaseBase, hidden, desktop }: { phaseBase: boolean; hidden: boolean; desktop: boolean }) {
  const { phase, remaining, daysAway } = useEventPhase()
  const { note: raw, dismiss } = useNotes()
  // booth screen: a host (the clock pill) shows the notice in place — the island stays out of the layout
  const hosted = useSyncExternalStore(subscribe, () => hosts > 0)
  const note = desktop && hosted ? null : raw
  const [open, setOpen] = useState(false)
  const show = !hidden && (!!note || phaseBase)

  // a phase change blooms the countdown for a moment, like an incoming call
  const firstPhase = useRef(true)
  useEffect(() => {
    if (firstPhase.current) return void (firstPhase.current = false)
    setOpen(true)
    const t = window.setTimeout(() => setOpen(false), 4500)
    return () => window.clearTimeout(t)
  }, [phase])

  // a second live activity, iOS-style: once the promo card has scrolled away, a small bubble splits
  // off the island with the slots left — tap → /preorder
  const { open: poOpen, config: po, promoLeft } = usePreorder()
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    if (desktop) return
    const on = () => setScrolled(window.scrollY > 320)
    on()
    window.addEventListener('scroll', on, { passive: true })
    return () => window.removeEventListener('scroll', on)
  }, [desktop])
  const bubble = !desktop && !hidden && !open && scrolled && poOpen && !!po.promo?.on && promoLeft > 0

  const t = TONE[phase]
  const live = phase === 'open' || phase === 'last-call'
  const compactTime = phase === 'pre-open' && daysAway >= 2 ? `${daysAway} hari lagi` : phase === 'pre-open' && daysAway === 1 ? `Besok · ${clock(remaining)}` : clock(remaining)
  const view = note ? `note-${note.id}` : open ? 'open' : 'compact'

  return (
    <div className={`pointer-events-none fixed z-[60] flex items-start ${desktop ? 'right-[2.5vw] top-[1.5vh] justify-end' : 'inset-x-0 top-2 justify-center gap-2 px-3'}`}>
      <AnimatePresence>
        {show && (
          <motion.button
            key="island"
            layout
            type="button"
            onClick={() => (note ? dismiss() : setOpen((o) => !o))}
            className="pointer-events-auto relative overflow-hidden bg-[#1a0d06] text-cream shadow-[0_12px_32px_-10px_rgb(0_0_0/0.55)]"
            style={{ borderRadius: open && !note ? 28 : 999 }}
            // drops in as a small bead and swells; leaves the same way
            initial={{ opacity: 0, scale: 0.35, y: -18, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, y: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.35, y: -18, filter: 'blur(6px)', transition: { duration: 0.35, ease: [0.4, 0, 1, 1] } }}
            transition={ISLAND}
            aria-live="polite"
            aria-expanded={open}
          >
            {/* a little squash every time the content swaps */}
            <motion.div key={view} initial={{ scale: 0.94 }} animate={{ scale: [0.94, 1.04, 1] }} transition={{ duration: 0.45 }}>
              <AnimatePresence mode="popLayout" initial={false}>
                {note ? (
                  <motion.div
                    key={view}
                    layout="position"
                    className={`flex items-center whitespace-nowrap ${desktop ? 'h-8 gap-2 pl-1 pr-3.5' : 'h-11 gap-2.5 pl-1.5 pr-4'}`}
                    initial={{ opacity: 0, filter: 'blur(6px)' }}
                    animate={{ opacity: 1, filter: 'blur(0px)', transition: { delay: 0.08 } }}
                    exit={{ opacity: 0, filter: 'blur(6px)' }}
                    transition={{ duration: 0.25 }}
                  >
                    <motion.span
                      className={`grid shrink-0 place-items-center rounded-full ${desktop ? 'size-6' : 'size-8'}`}
                      style={{ background: `${note.tone}33`, color: note.tone }}
                      initial={{ scale: 0, rotate: -40 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.12 }}
                    >
                      <note.icon className={desktop ? 'size-3.5' : 'size-4'} />
                    </motion.span>
                    <span className="font-display text-sm font-semibold">{desktop ? (note.short ?? note.text) : note.text}</span>
                    {note.sub && !desktop && <span className="font-display text-sm text-cream/55">{note.sub}</span>}
                    {note.id === -1 && <SignalBars dark className="ml-1" />}
                  </motion.div>
                ) : open ? (
                  <motion.div
                    key="open"
                    layout="position"
                    className="flex w-[min(92vw,380px)] flex-col items-center gap-2.5 px-5 pb-4 pt-3"
                    initial={{ opacity: 0, scale: 0.9, filter: 'blur(4px)' }}
                    animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.25 }}
                  >
                    <span className="flex items-center gap-2 font-cond text-sm font-semibold uppercase italic tracking-widest" style={{ color: t.dot }}>
                      <Dot color={t.dot} live={live} /> {t.label}
                    </span>
                    {phase !== 'closed' && (
                      <>
                        <span className="font-display text-base font-semibold text-cream/80">{t.title}</span>
                        <Countdown remaining={remaining} urgent={phase === 'last-call'} days={phase === 'pre-open' && daysAway >= 2} size="sm" />
                      </>
                    )}
                    <span className="flex items-center gap-1.5 font-display text-xs text-cream/60">
                      <MapPin className="size-3.5" /> {EVENT.place} · {EVENT.campus} · {EVENT.table}
                    </span>
                    <SignalBars dark label />
                  </motion.div>
                ) : (
                  <motion.div
                    key="compact"
                    layout="position"
                    className="flex h-9 items-center gap-2.5 whitespace-nowrap pl-3 pr-4"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Dot color={t.dot} live={live} />
                    <span className="font-display text-sm font-semibold">{t.label}</span>
                    {phase !== 'closed' && <span className="font-display text-sm font-bold tabular-nums" style={{ color: t.dot }}>{compactTime}</span>}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.button>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {bubble && (
          <motion.a
            key="promo-bubble"
            layout
            href="/preorder"
            data-track="island-promo"
            aria-label={`Promo pre-order: sisa ${promoLeft} slot`}
            className="pointer-events-auto flex h-9 items-center gap-1.5 rounded-full bg-[#1a0d06] pl-2.5 pr-3 font-display text-sm font-bold text-cream shadow-[0_12px_32px_-10px_rgb(0_0_0/0.55)]"
            // pinches off the side of the island like a droplet, and merges back the same way
            initial={{ opacity: 0, scale: 0.3, x: -36, filter: 'blur(6px)' }}
            animate={{ opacity: 1, scale: 1, x: 0, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.3, x: -36, filter: 'blur(6px)', transition: { duration: 0.3 } }}
            transition={ISLAND}
            whileTap={{ scale: 0.9 }}
          >
            <motion.span animate={{ rotate: [0, -14, 12, -8, 0] }} transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 3 }}>
              <Gift className="size-4" style={{ color: GREEN }} />
            </motion.span>
            <Morph text={String(promoLeft)} className="tabular-nums" />
            <span className="font-normal text-cream/60">slot</span>
          </motion.a>
        )}
      </AnimatePresence>
    </div>
  )
}

function Dot({ color, live }: { color: string; live: boolean }) {
  return (
    <span className="relative flex size-2.5">
      {live && <span className="absolute inline-flex size-full animate-ping rounded-full opacity-75" style={{ background: color }} />}
      <span className="relative inline-flex size-2.5 rounded-full" style={{ background: color }} />
    </span>
  )
}

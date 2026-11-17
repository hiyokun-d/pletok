import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'
import { useEventPhase, type Phase } from '../hooks/useEventPhase'
import { EVENT } from '../data/event'
import { Countdown } from './Countdown'
import { spring } from '../lib/motion'

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

/**
 * Dynamic-Island-style phase pill at the top of the screen. Compact: status + live clock.
 * Tap / hover (and every phase change) morphs it open into the full countdown.
 */
export function PhaseIsland() {
  const { phase, remaining, daysAway } = useEventPhase()
  const [open, setOpen] = useState(false)
  const [pulse, setPulse] = useState(0)
  const first = useRef(true)
  const auto = useRef<number>(undefined)

  // a phase change blooms the island for a moment, like an incoming call
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    setPulse((p) => p + 1)
    setOpen(true)
    window.clearTimeout(auto.current)
    auto.current = window.setTimeout(() => setOpen(false), 4500)
  }, [phase])

  const t = TONE[phase]
  const live = phase === 'open' || phase === 'last-call'
  const compactTime = phase === 'pre-open' && daysAway >= 2 ? `${daysAway} hari lagi` : phase === 'pre-open' && daysAway === 1 ? `Besok · ${clock(remaining)}` : clock(remaining)

  return (
    <div className="pointer-events-none fixed inset-x-0 top-2 z-[45] flex justify-center px-3">
      <motion.button
        layout
        type="button"
        onClick={() => setOpen((o) => !o)}
        onHoverStart={() => window.matchMedia('(pointer:fine)').matches && setOpen(true)}
        onHoverEnd={() => window.matchMedia('(pointer:fine)').matches && setOpen(false)}
        className="pointer-events-auto relative overflow-hidden bg-[#1a0d06] text-cream shadow-[0_10px_30px_-10px_rgb(0_0_0/0.55)]"
        style={{ borderRadius: open ? 28 : 999 }}
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -60, opacity: 0 }}
        transition={{ ...spring.pop, stiffness: 380, damping: 26 }}
        aria-expanded={open}
        aria-label={`${t.label} — ${t.title} ${clock(remaining)}`}
      >
        {/* squash on every phase change */}
        <motion.div key={pulse} animate={pulse ? { scale: [1, 1.12, 0.96, 1] } : undefined} transition={{ duration: 0.5 }}>
          <AnimatePresence mode="popLayout" initial={false}>
            {open ? (
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

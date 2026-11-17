import { AnimatePresence, motion } from 'motion/react'
import { CalendarDays } from 'lucide-react'
import { useEventPhase } from '../hooks/useEventPhase'
import { EVENT } from '../data/event'
import { Countdown } from './Countdown'
import { spring } from '../lib/motion'

const LABEL = {
  'pre-open': { title: 'Buka dalam', note: 'Siap-siap, rempahnya lagi diseduh!' },
  open: { title: 'Tutup dalam', note: 'Lagi buka sekarang — mampir ke Meja 9!' },
  'last-call': { title: 'Last call! Tutup dalam', note: 'Tinggal sebentar lagi, buruan sebelum habis!' },
  closed: { title: 'Sudah tutup', note: 'Terima kasih sudah mampir!' },
} as const

/** Countdown block (the phase badge itself lives in the PhaseIsland). Same component on mobile and the booth screen. */
export function EventStatus({ size = 'md', align = 'start', teaser = false }: { size?: 'sm' | 'md' | 'lg' | 'fluid'; align?: 'start' | 'center'; teaser?: boolean }) {
  const { phase, remaining, daysAway } = useEventPhase()
  if (teaser && phase === 'pre-open') return <Teaser days={daysAway} />
  const urgent = phase === 'last-call'
  const l = LABEL[phase]

  return (
    <div className={`flex w-full flex-col ${size === 'fluid' ? 'gap-[1.4vh]' : 'gap-3'} ${align === 'center' ? 'items-center text-center' : 'items-start'}`}>
      <AnimatePresence mode="wait">
        <motion.div
          key={phase}
          initial={{ opacity: 0, y: 12, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.9 }}
          transition={spring.snappy}
          className="flex flex-col gap-1"
        >
          <span className={`font-display font-semibold text-brown ${size === 'fluid' ? 'text-[clamp(1rem,2.4vh,1.5rem)]' : 'text-xl'}`}>{l.title}</span>
        </motion.div>
      </AnimatePresence>
      {/* a day cell while it's 2+ days out; from the day before, hours just count down (e.g. 31 jam) */}
      {phase !== 'closed' && <Countdown remaining={remaining} urgent={urgent} days={phase === 'pre-open' && daysAway >= 2} size={size} />}
      <motion.p key={l.note} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`font-script leading-tight text-brown-soft ${size === 'fluid' ? 'text-[clamp(1rem,2.2vh,1.4rem)]' : 'text-xl'}`}>
        {l.note}
      </motion.p>
    </div>
  )
}

/** Days out: no ticking clock yet (that starts the day before) — just how many sleeps are left */
function Teaser({ days }: { days: number }) {
  return (
    <div className="flex w-full flex-col gap-[1vh]">
      <span className="font-display text-[clamp(1rem,2.4vh,1.5rem)] font-semibold text-brown">Segera hadir</span>
      <div className="flex items-end gap-3">
        <AnimatePresence mode="popLayout">
          <motion.span
            key={days}
            className="font-display text-[clamp(3rem,10vh,6.5rem)] font-bold leading-[0.85] text-terracotta tabular-nums"
            initial={{ y: 40, opacity: 0, rotate: -8 }}
            animate={{ y: 0, opacity: 1, rotate: 0 }}
            exit={{ y: -40, opacity: 0 }}
            transition={spring.pop}
          >
            {days}
          </motion.span>
        </AnimatePresence>
        <span className="pb-[0.6vh] font-display text-[clamp(1.1rem,3vh,1.8rem)] font-bold uppercase leading-none text-brown">hari lagi</span>
      </div>
      <span className="flex items-center gap-1.5 font-display text-[clamp(0.8rem,1.8vh,1.05rem)] font-semibold text-brown/75">
        <CalendarDays className="size-[1.1em] text-terracotta" /> {EVENT.dateLabel} · {EVENT.timeLabel}
      </span>
      <span className="font-script text-[clamp(1rem,2.2vh,1.4rem)] leading-tight text-brown-soft">Hitung mundurnya mulai H-1. Rempahnya lagi disiapkan!</span>
    </div>
  )
}

import { motion } from 'motion/react'
import { FlipDigit } from './FlipDigit'

interface CountdownProps {
  remaining: number
  urgent?: boolean
  /** show a `hari` cell (else hours run past 24, e.g. 31 jam) */
  days?: boolean
  /** `fluid` fills its container's width and scales with viewport height (booth screen) */
  size?: 'sm' | 'md' | 'lg' | 'fluid'
  className?: string
}

const SIZE = {
  fluid: { num: 'text-[clamp(1.5rem,4.6vh,3.2rem)]', unit: 'text-[clamp(0.55rem,1.2vh,0.8rem)]', cell: 'flex-1 min-w-0 px-1 py-[1.1vh]' },
  sm: { num: 'text-3xl', unit: 'text-[0.6rem]', cell: 'min-w-12 px-2 py-1.5' },
  md: { num: 'text-5xl', unit: 'text-xs', cell: 'min-w-[4.5rem] px-3 py-2' },
  lg: { num: 'text-6xl', unit: 'text-sm', cell: 'min-w-24 px-3 py-3' },
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Reused for "Buka dalam" and "Tutup dalam" — same component, different tone */
export function Countdown({ remaining, urgent = false, days = false, size = 'md', className = '' }: CountdownProps) {
  const total = Math.ceil(remaining / 1000)
  const d = days ? Math.floor(total / 86400) : 0
  const h = Math.floor((total - d * 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const parts = [
    ...(days ? [{ v: pad(d), u: 'hari' }] : []),
    { v: pad(h), u: 'jam' },
    { v: pad(m), u: 'menit' },
    { v: pad(s), u: 'detik' },
  ]
  const sz = SIZE[size]
  const fluid = size === 'fluid'

  return (
    <motion.div
      className={`flex items-start ${fluid ? 'w-full gap-[0.8vh]' : 'gap-2'} ${className}`}
      animate={urgent ? { scale: [1, 1.04, 1, 1.02, 1] } : { scale: 1 }}
      transition={urgent ? { duration: 1, repeat: Infinity, times: [0, 0.12, 0.3, 0.42, 1] } : undefined}
      role="timer"
      aria-live="off"
    >
      {parts.map((p, i) => (
        <motion.div
          key={p.u}
          className={`flex items-start ${fluid ? 'min-w-0 flex-1' : 'gap-2'}`}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 22, delay: i * 0.07 }}
        >
          <div
            className={`flex flex-col items-center rounded-2xl ${sz.cell} transition-colors duration-500 ${
              urgent ? 'bg-terracotta text-cream shadow-[0_6px_0_#7a3d1c]' : 'bg-brown text-cream shadow-[0_6px_0_#3a1c0f]'
            }`}
          >
            <span className={`flex font-display font-bold leading-none ${sz.num}`}>
              <FlipDigit value={p.v[0]} />
              <FlipDigit value={p.v[1]} />
            </span>
            <span className={`mt-1 font-cond font-semibold uppercase italic tracking-wider opacity-80 ${sz.unit}`}>{p.u}</span>
          </div>
          {!fluid && i < parts.length - 1 && (
            <motion.span
              className={`font-display font-bold leading-none text-brown/60 ${sz.num}`}
              animate={{ opacity: [1, 0.25, 1] }}
              transition={{ duration: 1, repeat: Infinity, ease: 'easeInOut' }}
            >
              :
            </motion.span>
          )}
        </motion.div>
      ))}
    </motion.div>
  )
}

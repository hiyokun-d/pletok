import { motion } from 'motion/react'
import { useSignal } from '../hooks/useSignal'

const TONE = ['#b23b2a', '#d0603a', '#e8b53a', '#8faa4f', '#5e7b3a'] as const

/**
 * Four bars, like the phone's status bar, but measured against our own Sheet — so the crew can
 * tell a bad booth signal from a bad phone at a glance. `label` adds the word + round-trip time.
 */
export function SignalBars({ label = false, className = '', dark = false }: { label?: boolean; className?: string; dark?: boolean }) {
  const s = useSignal()
  const color = TONE[s.bars]
  const sec = s.rtt !== null ? `${(s.rtt / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} dtk` : null
  return (
    <span
      className={`inline-flex items-center gap-1.5 whitespace-nowrap font-display text-xs font-semibold ${dark ? 'text-cream/80' : 'text-brown/70'} ${className}`}
      title={`Sinyal: ${s.label}${sec ? ` · ${sec} ke Sheet` : ''}`}
      aria-label={`Sinyal ${s.label}`}
    >
      <span className="flex h-[0.9em] items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((b) => (
          <motion.span
            key={b}
            className="w-[3px] rounded-full"
            style={{ height: `${25 + b * 18.75}%` }}
            animate={{
              backgroundColor: b <= s.bars ? color : dark ? 'rgb(245 235 221 / 0.22)' : 'rgb(90 46 26 / 0.15)',
              opacity: s.measuring ? [0.35, 1, 0.35] : 1,
            }}
            transition={s.measuring ? { duration: 1.2, repeat: Infinity, delay: b * 0.12 } : { duration: 0.4, delay: b * 0.05 }}
          />
        ))}
      </span>
      {label && (
        <span>
          {s.label}
          {sec && <span className="font-normal opacity-60"> · {sec}</span>}
        </span>
      )}
    </span>
  )
}

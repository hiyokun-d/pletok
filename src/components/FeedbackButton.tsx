import { motion, useMotionValue, useSpring } from 'motion/react'
import { MessageCircleHeart, ArrowUpRight } from 'lucide-react'
import type { PointerEvent } from 'react'
import { FEEDBACK_URL } from '../data/event'
import { useFeedbackOpen } from '../hooks/useFeedbackOpen'

/** Magnetic pill: follows the pointer a little, shine sweeps across, icon wiggles. */
/** hidden while the feedback form is closed (before opening / 25 min after closing) */
export function FeedbackButton(props: { className?: string; compact?: boolean }) {
  return useFeedbackOpen().open ? <MagneticFeedback {...props} /> : null
}

function MagneticFeedback({ className = '', compact = false }: { className?: string; compact?: boolean }) {
  const x = useSpring(useMotionValue(0), { stiffness: 300, damping: 18 })
  const y = useSpring(useMotionValue(0), { stiffness: 300, damping: 18 })

  const onMove = (e: PointerEvent<HTMLAnchorElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - r.left - r.width / 2) * 0.25)
    y.set((e.clientY - r.top - r.height / 2) * 0.35)
  }
  const reset = () => {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.a
      href={FEEDBACK_URL}
      style={{ x, y }}
      onPointerMove={onMove}
      onPointerLeave={reset}
      whileHover={{ scale: 1.04 }}
      whileTap={{ scale: 0.94 }}
      className={`group relative inline-flex items-center gap-2 overflow-hidden rounded-full bg-brown font-display font-semibold text-cream shadow-[0_5px_0_#3a1c0f] active:shadow-[0_2px_0_#3a1c0f] ${
        compact ? 'px-4 py-2.5 text-sm' : 'px-6 py-3.5 text-base'
      } ${className}`}
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/30 to-transparent"
        animate={{ x: ['0%', '520%'] }}
        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
      />
      <motion.span
        animate={{ rotate: [0, -14, 12, -8, 0] }}
        transition={{ duration: 0.9, repeat: Infinity, repeatDelay: 3 }}
        className="inline-flex"
      >
        <MessageCircleHeart className={compact ? 'size-4' : 'size-5'} />
      </motion.span>
      <span>Kasih Feedback</span>
      <ArrowUpRight className="size-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
    </motion.a>
  )
}

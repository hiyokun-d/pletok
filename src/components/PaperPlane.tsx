import { motion } from 'motion/react'

/** a folded paper plane in the poster colours (nose points right) */
function Plane({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 80" className={className} aria-hidden>
      <path d="M4 38 L116 6 L44 50 Z" fill="#f5ebdd" stroke="#5a2e1a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 50 L116 6 L70 72 Z" fill="#ecdcc5" stroke="#5a2e1a" strokeWidth="3" strokeLinejoin="round" />
      <path d="M44 50 L52 76 L70 72" fill="#c9b39a" stroke="#5a2e1a" strokeWidth="3" strokeLinejoin="round" />
      {/* the folded message tucked in the wing */}
      <rect x="54" y="36" width="20" height="13" rx="2" transform="rotate(-28 64 42)" fill="#a8572a" />
    </svg>
  )
}

/**
 * The send animation. `flying` while the message is on its way: the plane loops in place
 * with a dashed trail; `away` once it's delivered: it banks and shoots off the top-right.
 */
export function PaperPlane({ state, onGone }: { state: 'flying' | 'away'; onGone?: () => void }) {
  return (
    <div className="pointer-events-none relative mx-auto h-56 w-full max-w-sm">
      {/* dashed loop trail */}
      <svg viewBox="0 0 300 200" className="absolute inset-0 size-full" aria-hidden>
        <motion.path
          d="M20 150 C 80 40, 160 40, 150 100 S 230 170, 280 60"
          fill="none"
          stroke="#a8572a"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray="2 10"
          initial={{ pathLength: 0, opacity: 0.6 }}
          animate={state === 'flying' ? { pathLength: [0, 1], opacity: 0.6 } : { opacity: 0 }}
          transition={state === 'flying' ? { duration: 1.6, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 }}
        />
      </svg>
      <motion.div
        className="absolute left-1/2 top-1/2 w-28 -translate-x-1/2 -translate-y-1/2"
        initial={{ x: -260, y: 80, rotate: -25, scale: 0.6, opacity: 0 }}
        animate={
          state === 'flying'
            ? // a lazy figure-eight while we wait
              { x: [-30, 30, 0, -30], y: [10, -18, 14, 10], rotate: [-8, 6, -4, -8], scale: 1, opacity: 1 }
            : { x: [0, -30, 700], y: [0, 20, -520], rotate: [-8, 10, -35], scale: [1, 1.1, 0.4], opacity: [1, 1, 0] }
        }
        transition={
          state === 'flying'
            ? { duration: 2.2, repeat: Infinity, ease: 'easeInOut', opacity: { duration: 0.3 }, scale: { duration: 0.4 } }
            : { duration: 1, times: [0, 0.25, 1], ease: 'easeIn' }
        }
        onAnimationComplete={() => state === 'away' && onGone?.()}
      >
        <Plane className="h-auto w-full drop-shadow-[0_10px_10px_rgb(90_46_26/0.25)]" />
      </motion.div>
    </div>
  )
}

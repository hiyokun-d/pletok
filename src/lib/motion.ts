import type { Transition, Variants } from 'motion/react'

/** Shared springs — every moving thing in the app picks one of these so motion feels like one family. */
export const spring = {
  /** Snappy UI response, tiny overshoot */
  snappy: { type: 'spring', stiffness: 420, damping: 30, mass: 0.8 },
  /** Bouncy arrival — squash/overshoot for prices, badges */
  pop: { type: 'spring', stiffness: 520, damping: 16, mass: 0.9 },
  /** Soft, weighty glide for large surfaces */
  glide: { type: 'spring', stiffness: 140, damping: 22, mass: 1.1 },
  /** Lazy float for ambient things */
  float: { type: 'spring', stiffness: 60, damping: 14, mass: 1.2 },
} satisfies Record<string, Transition>

/** Slow-in/slow-out curves */
export const ease = {
  out: [0.22, 1, 0.36, 1] as const,
  inOut: [0.65, 0, 0.35, 1] as const,
  /** Anticipation: dips back before going forward */
  anticipate: [0.68, -0.6, 0.32, 1.6] as const,
}

/** Parent that staggers its children (overlapping action) */
export const stagger = (each = 0.08, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: each, delayChildren: delay } },
  exit: { transition: { staggerChildren: each / 2, staggerDirection: -1 } },
})

/** Rise in with a little blur — default entrance used by <Reveal> */
export const rise: Variants = {
  hidden: { opacity: 0, y: 36, scale: 0.96 },
  show: { opacity: 1, y: 0, scale: 1, transition: spring.glide },
  exit: { opacity: 0, y: -24, scale: 0.98, transition: { duration: 0.35, ease: ease.inOut } },
}

/** Squash & stretch drop — letters, badges */
export const drop: Variants = {
  hidden: { opacity: 0, y: -90, scaleY: 1.25, scaleX: 0.85 },
  show: {
    opacity: 1,
    y: [-90, 0, -10, 0],
    scaleY: [1.25, 0.78, 1.06, 1],
    scaleX: [0.85, 1.18, 0.96, 1],
    transition: { duration: 0.8, times: [0, 0.45, 0.72, 1], ease: 'easeOut' },
  },
  exit: { opacity: 0, y: 40, transition: { duration: 0.25 } },
}

/** Pop with overshoot — prices, chips */
export const pop: Variants = {
  hidden: { opacity: 0, scale: 0.3, rotate: -12 },
  show: { opacity: 1, scale: 1, rotate: 0, transition: spring.pop },
  exit: { opacity: 0, scale: 0.6, transition: { duration: 0.2 } },
}

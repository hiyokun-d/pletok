import { motion, useAnimate } from 'motion/react'
import { useEffect } from 'react'
import { LOGO_BROWN } from '../data/logo'

export type SproutState = 'hidden' | 'grow' | 'idle' | 'wilt'

interface SproutProps {
  state: SproutState
  className?: string
  style?: React.CSSProperties
  /** Bump to play a quick "shaken" wiggle */
  wiggleKey?: number
  onGrown?: () => void
  color?: string
  veinColor?: string
}

// Shapes traced from the leaf on top of the Pletok "T" (viewBox matches the logo crop, 59×49)
export const LEFT = 'M26 41 C 18 41 5 34 1 18 C 12 18 23 26 26 41 Z'
export const LEFT_VEIN = 'M21.5 35.5 C 15.5 32 10.5 27 7.5 22.5'
export const RIGHT = 'M29 41 C 27 22 38 6 58 1 C 59 20 49 37 29 41 Z'
export const RIGHT_VEIN = 'M33.5 34 C 37 24.5 43 15.5 50.5 9'
export const STEM = 'M27.6 53 C 27.6 48 27.6 43 27.5 39'

/** The sprout from the logo — grows, sways, gets shaken and wilts. */
export function Sprout({ state, className = '', style, wiggleKey, onGrown, color = LOGO_BROWN, veinColor = 'var(--color-cream)' }: SproutProps) {
  const [scope, animate] = useAnimate()

  useEffect(() => {
    let cancelled = false
    let grown = 0
    const run = async () => {
      if (state === 'hidden') {
        // a 0-length stroke with round caps still paints two dots — hide it outright
        animate('.stem', { pathLength: 0, opacity: 0 }, { duration: 0 })
        animate('.leaf', { scale: 0 }, { duration: 0 })
        return
      }
      if (state === 'grow') {
        // on a clock, not on the animations' promises: Safari sometimes never resolves the leaf
        // scale, and the whole intro used to wait on it forever
        animate('.leaf', { scale: 0 }, { duration: 0 })
        animate('.stem', { pathLength: [0, 1], opacity: [1, 1] }, { duration: 0.35, ease: 'easeOut' })
        grown = window.setTimeout(() => {
          animate('.leaf-l', { scale: [0, 1.15, 1], rotate: [-50, 8, 0] }, { duration: 0.6, ease: 'easeOut' })
          animate('.leaf-r', { scale: [0, 1.15, 1], rotate: [50, -8, 0] }, { duration: 0.65, delay: 0.12, ease: 'easeOut' })
          grown = window.setTimeout(() => !cancelled && onGrown?.(), 800)
        }, 350)
        return
      }
      if (state === 'idle') {
        animate('.stem', { pathLength: 1, opacity: 1 }, { duration: 0 })
        animate('.leaf', { scale: 1 }, { duration: 0.2 })
        // secondary action: the two leaves breathe out of phase
        animate('.leaf-l', { rotate: [0, -6, 0, 3, 0] }, { duration: 4.2, repeat: Infinity, ease: 'easeInOut' })
        animate('.leaf-r', { rotate: [0, 5, 0, -4, 0] }, { duration: 3.6, repeat: Infinity, ease: 'easeInOut', delay: 0.4 })
        return
      }
      if (state === 'wilt') {
        animate('.leaf-l', { rotate: 38, scaleY: 0.9 }, { duration: 1.1, ease: [0.5, 0, 0.3, 1] })
        animate('.leaf-r', { rotate: -16, scaleY: 0.92 }, { duration: 1.2, ease: [0.5, 0, 0.3, 1], delay: 0.15 })
      }
    }
    run()
    return () => {
      cancelled = true
      window.clearTimeout(grown)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state])

  useEffect(() => {
    if (!wiggleKey) return
    animate('.leaf-l', { rotate: [0, -28, 18, -10, 4, 0] }, { duration: 0.8 })
    animate('.leaf-r', { rotate: [0, 26, -20, 10, -4, 0] }, { duration: 0.85, delay: 0.04 })
  }, [wiggleKey, animate])

  return (
    <svg ref={scope} viewBox="0 0 59 49" className={`overflow-visible ${className}`} style={style} aria-hidden>
      <motion.path className="stem" d={STEM} stroke={color} strokeWidth={3.4} strokeLinecap="round" fill="none" initial={{ pathLength: state === 'hidden' || state === 'grow' ? 0 : 1, opacity: state === 'hidden' || state === 'grow' ? 0 : 1 }} />
      <motion.g className="leaf leaf-l" style={{ originX: '26px', originY: '41px', transformBox: 'view-box' }} initial={{ scale: state === 'hidden' || state === 'grow' ? 0 : 1 }}>
        <path d={LEFT} fill={color} />
        <path className="vein" d={LEFT_VEIN} stroke={veinColor} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </motion.g>
      <motion.g className="leaf leaf-r" style={{ originX: '29px', originY: '41px', transformBox: 'view-box' }} initial={{ scale: state === 'hidden' || state === 'grow' ? 0 : 1 }}>
        <path d={RIGHT} fill={color} />
        <path className="vein" d={RIGHT_VEIN} stroke={veinColor} strokeWidth={2.6} strokeLinecap="round" fill="none" />
      </motion.g>
    </svg>
  )
}

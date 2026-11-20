import { AnimatePresence, motion } from 'motion/react'
import { blurFx } from '../lib/perf'

/** One digit that rolls over with a 3D flip when its value changes */
export function FlipDigit({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`relative inline-grid overflow-hidden [perspective:400px] ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="col-start-1 row-start-1 inline-block tabular-nums"
          initial={{ y: '70%', rotateX: -80, opacity: 0, ...blurFx(2) }}
          animate={{ y: '0%', rotateX: 0, opacity: 1, ...blurFx(0) }}
          exit={{ y: '-70%', rotateX: 80, opacity: 0, ...blurFx(2) }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

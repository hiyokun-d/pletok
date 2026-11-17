import { AnimatePresence, motion } from 'motion/react'

/** One digit that rolls over with a 3D flip when its value changes */
export function FlipDigit({ value, className = '' }: { value: string; className?: string }) {
  return (
    <span className={`relative inline-grid overflow-hidden [perspective:400px] ${className}`}>
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={value}
          className="col-start-1 row-start-1 inline-block tabular-nums"
          initial={{ y: '70%', rotateX: -80, opacity: 0, filter: 'blur(2px)' }}
          animate={{ y: '0%', rotateX: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: '-70%', rotateX: 80, opacity: 0, filter: 'blur(2px)' }}
          transition={{ type: 'spring', stiffness: 380, damping: 26 }}
        >
          {value}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

import { AnimatePresence, motion } from 'motion/react'

/** Rubber-stamp "SOLD" that slams onto a sold-out item (and lifts off again on restock) */
export function SoldStamp({ show, className = '', small = false }: { show: boolean; className?: string; small?: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.span
          className={`pointer-events-none absolute z-10 rounded-xl border-[0.5vh] border-terracotta bg-cream/90 font-display font-bold uppercase leading-none text-terracotta shadow-[0_0.6vh_0_rgb(168_87_42/0.25)] ${
            small ? 'px-[1.2vh] py-[0.5vh] text-[clamp(0.9rem,2.6vh,1.6rem)]' : 'px-[2vh] py-[0.8vh] text-[clamp(1.4rem,5vh,3.2rem)]'
          } ${className}`}
          initial={{ scale: 2.6, opacity: 0, rotate: -24 }}
          animate={{ scale: 1, opacity: 1, rotate: -12 }}
          exit={{ scale: 0.6, opacity: 0, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 520, damping: 18 }}
        >
          Sold
        </motion.span>
      )}
    </AnimatePresence>
  )
}

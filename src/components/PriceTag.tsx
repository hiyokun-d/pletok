import { motion } from 'motion/react'
import { spring } from '../lib/motion'
import { Morph } from './Morph'

interface PriceTagProps {
  price: number
  /** Normal price — drawn struck through, like the bundle promo */
  was?: number
  size?: 'sm' | 'md' | 'lg' | 'fluid'
  className?: string
  delay?: number
}

const SIZES = {
  sm: { box: 'h-12 w-24 text-2xl', was: 'text-lg' },
  md: { box: 'h-16 w-32 text-[2.1rem]', was: 'text-2xl' },
  lg: { box: 'h-20 w-40 text-[2.7rem]', was: 'text-3xl' },
  fluid: { box: 'h-[7.2vh] w-[14.5vh] text-[3.9vh]', was: 'text-[2.6vh]' },
}

/** Terracotta brush-stroke price badge from the poster. Pops in with overshoot, old price gets slashed. */
export function PriceTag({ price, was, size = 'md', className = '', delay = 0 }: PriceTagProps) {
  const s = SIZES[size]
  return (
    <motion.div
      className={`flex items-center gap-3 ${className}`}
      initial="hidden"
      whileInView="show"
      viewport={{ once: false, amount: 0.6 }}
      variants={{ hidden: {}, show: { transition: { delayChildren: delay, staggerChildren: 0.25 } } }}
    >
      <motion.div
        className={`relative grid place-items-center ${s.box}`}
        variants={{
          hidden: { scale: 0.2, rotate: -14, opacity: 0 },
          show: { scale: 1, rotate: -4, opacity: 1, transition: spring.pop },
        }}
        whileHover={{ rotate: 2, scale: 1.06 }}
      >
        <svg viewBox="0 0 160 80" className="absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          <path
            d="M10 18 C 30 4 70 10 98 6 C 122 3 148 2 154 16 C 160 30 150 44 156 58 C 160 72 130 78 100 74 C 70 72 40 80 18 72 C 2 66 8 52 4 40 C 0 30 0 24 10 18 Z"
            fill="#a8572a"
          />
          <path d="M14 22 C 40 12 90 16 140 12" stroke="#c98a3c" strokeWidth={3} fill="none" opacity={0.5} strokeLinecap="round" />
          <path d="M20 64 C 60 70 110 66 146 62" stroke="#7a3d1c" strokeWidth={3} fill="none" opacity={0.5} strokeLinecap="round" />
        </svg>
        <span className="relative font-display font-bold leading-none text-white [text-shadow:2px_3px_0_#5a2e1a]"><Morph text={`${price}K`} /></span>
      </motion.div>
      {/* only a real discount gets the strike — a price edit can make the bundle cost the same */}
      {was !== undefined && was > price && (
        <motion.span
          className={`relative font-display font-bold text-brown/80 ${s.was}`}
          variants={{ hidden: { opacity: 0, x: -10 }, show: { opacity: 1, x: 0, transition: spring.snappy } }}
        >
          <Morph text={`${was}K`} />
          <svg className="absolute inset-x-[-4px] top-1/2 h-4 w-[calc(100%+8px)] -translate-y-1/2 overflow-visible" viewBox="0 0 60 12" preserveAspectRatio="none" aria-hidden>
            <motion.path
              d="M2 9 C 20 6 40 5 58 2"
              stroke="#c0392b"
              strokeWidth={3.5}
              strokeLinecap="round"
              fill="none"
              variants={{ hidden: { pathLength: 0 }, show: { pathLength: 1, transition: { duration: 0.45, delay: 0.15, ease: 'easeOut' } } }}
            />
          </svg>
        </motion.span>
      )}
    </motion.div>
  )
}

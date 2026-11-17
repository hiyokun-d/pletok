import { motion } from 'motion/react'
import { useRef } from 'react'
import { LogoRig } from './LogoRig'
import { ParticleField } from './ParticleField'
import { ease } from '../lib/motion'

/** Entrance: a seed drops, the sprout grows in close-up, the camera pulls back and the logo blooms. */
export function Intro({ onDone }: { onDone: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  // leave, and if the exit wipe never plays (Safari), get out of the way regardless
  const done = () => {
    onDone()
    window.setTimeout(() => ref.current && (ref.current.style.display = 'none'), 1200)
  }
  return (
    <motion.div
      ref={ref}
      className="paper fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      exit={{ clipPath: 'circle(0% at 50% 42%)', transition: { duration: 0.8, ease: ease.inOut } }}
      initial={{ clipPath: 'circle(150% at 50% 42%)' }}
      onClick={done}
    >
      <ParticleField preset="leaf" overrides={{ count: 14, travel: [20, 40], opacity: 0.5 }} />
      <LogoRig play="intro" interactive={false} className="w-[min(86vw,640px)]" onReady={() => setTimeout(done, 700)} />
      <motion.p
        className="mt-4 font-script text-3xl font-bold text-terracotta"
        initial={{ opacity: 0, y: 14, letterSpacing: '0.3em' }}
        animate={{ opacity: 1, y: 0, letterSpacing: '0em' }}
        transition={{ delay: 3.4, duration: 0.8, ease: ease.out }}
      >
        Tradisi Abadi, Jiwa Muda
      </motion.p>
      <motion.span
        className="absolute bottom-8 font-cond text-sm font-semibold uppercase italic tracking-[0.3em] text-brown/40"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
      >
        tap untuk lewati
      </motion.span>
    </motion.div>
  )
}

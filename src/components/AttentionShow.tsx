import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { BUNDLES, DRINKS } from '../data/menu'
import { EVENT } from '../data/event'
import { ParticleField } from './ParticleField'
import { ease } from '../lib/motion'

type Pt = [number, number]
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** what the big word says, beat by beat */
const BEATS = ['PSST!', 'HAUS?', 'SINI!'] as const

/**
 * Crew-triggered (A + G) attention grabber for the booth screen — ~7 s of loud:
 * flash, spinning sunburst, PSST! HAUS? SINI!, the three cups slam in, a halal stamp,
 * then "COBAIN DI MEJA 9!" with confetti — and it gets out of the way again.
 */
export function AttentionShow({ onDone }: { onDone: () => void }) {
  const [scope, animate] = useAnimate()
  const [beat, setBeat] = useState(-1)
  const [burst, setBurst] = useState<{ key: number; pts: Pt[] }>()
  const [confetti, setConfetti] = useState<{ key: number; pts: Pt[] }>()
  const done = useRef(onDone)
  done.current = onDone

  useEffect(() => {
    let alive = true
    const W = window.innerWidth
    const H = window.innerHeight
    const shake = (k = 1) => animate(scope.current, { x: [0, -14 * k, 12 * k, -8 * k, 5 * k, 0], y: [0, 8 * k, -6 * k, 4 * k, 0] }, { duration: 0.4 })
    const run = async () => {
      // 1 · flash + rays bloom
      await animate('.flash', { opacity: [0, 1, 0] }, { duration: 0.35 })
      animate('.rays', { opacity: [0, 1], scale: [0.3, 1] }, { duration: 0.6, ease: ease.out })

      // 2 · PSST! HAUS? SINI! — each slams and shakes the screen
      for (let i = 0; i < BEATS.length && alive; i++) {
        setBeat(i)
        await wait(90)
        shake(i === 2 ? 1.4 : 0.9)
        setBurst({ key: Date.now(), pts: [[W / 2, H / 2]] })
        await wait(720)
      }
      if (!alive) return
      setBeat(-1)

      // 3 · the cups slam in from below, one after another, then all hop together
      await wait(150)
      for (let i = 0; i < DRINKS.length; i++) {
        animate(`.atn-cup-${i}`, { y: ['110vh', '-6vh', '1.5vh', '0vh'], rotate: [(i - 1) * 30, (i - 1) * -6, 0], scaleY: [1, 1, 0.9, 1] }, { duration: 0.6, ease: 'easeOut' })
        await wait(170)
      }
      await wait(500)
      shake(0.8)
      animate('.atn-cupwrap', { y: [0, -36, 0] }, { duration: 0.45, delay: (i: number) => i * 0.07, ease: 'easeOut' })

      // 4 · halal stamp
      await animate('.atn-halal', { scale: [3, 0.9, 1], opacity: [0, 1, 1], rotate: [-25, -8, -8] }, { duration: 0.45, ease: 'easeOut' })
      shake(0.6)
      await wait(500)

      // 5 · the call to action
      await animate('.atn-cta', { scale: [0.2, 1.12, 1], opacity: [0, 1, 1], rotate: [8, -3, -3] }, { duration: 0.55, ease: 'easeOut' })
      shake(1.2)
      setConfetti({ key: Date.now(), pts: [[W * 0.2, H * 0.3], [W * 0.8, H * 0.3], [W / 2, H * 0.75]] })
      animate('.atn-cta', { scale: [1, 1.06, 1] }, { duration: 0.5, repeat: 3, ease: 'easeInOut' })
      await wait(2300)

      // 6 · everything blows away, overlay leaves
      if (!alive) return
      DRINKS.forEach((_, i) => animate(`.atn-cup-${i}`, { y: '-120vh', rotate: (i - 1) * 25 }, { duration: 0.6, delay: i * 0.05, ease: ease.inOut }))
      await animate('.atn-text', { scale: 0.4, opacity: 0 }, { duration: 0.35 })
      await animate(scope.current, { clipPath: ['circle(150% at 50% 50%)', 'circle(0% at 50% 50%)'] }, { duration: 0.6, ease: ease.inOut })
      done.current()
    }
    void run()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && done.current()
    window.addEventListener('keydown', onKey)
    return () => {
      alive = false
      window.removeEventListener('keydown', onKey)
    }
  }, [animate, scope])

  return (
    <motion.div ref={scope} className="fixed inset-0 z-[65] overflow-hidden bg-cream" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      {/* spinning sunburst, poster-style */}
      <motion.div
        className="rays absolute left-1/2 top-1/2 aspect-square w-[260vmax] -translate-x-1/2 -translate-y-1/2 opacity-0"
        style={{ background: 'repeating-conic-gradient(from 0deg, #f1d3a8 0deg 9deg, #f5ebdd 9deg 18deg)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 25%, rgb(245 235 221 / 0.85) 75%)' }} />

      <ParticleField preset="burst" overrides={{ shape: 'leaf', count: 70, size: [12, 26], burstSpeed: [300, 900], gravity: 600 }} points={burst?.pts} burstKey={burst?.key} />
      <ParticleField
        preset="burst"
        overrides={{ shape: 'sparkle', count: 120, colors: ['#a8572a', '#e9827f', '#c98a3c', '#5e7b3a', '#f1d3a8'], size: [8, 16], burstSpeed: [300, 1000], gravity: 700 }}
        points={confetti?.pts}
        burstKey={confetti?.key}
      />

      {/* PSST! / HAUS? / SINI! */}
      <div className="pointer-events-none absolute inset-0 grid place-items-center">
        <AnimatePresence mode="popLayout">
          {beat >= 0 && (
            <motion.span
              key={beat}
              className="font-display text-[min(30vw,40vh)] font-bold leading-none text-brown [text-shadow:0_1.2vh_0_#a8572a]"
              initial={{ scale: 3.2, opacity: 0, rotate: beat % 2 ? 10 : -10 }}
              animate={{ scale: 1, opacity: 1, rotate: beat % 2 ? -4 : 4 }}
              exit={{ scale: 0.4, opacity: 0, rotate: 0, transition: { duration: 0.15 } }}
              transition={{ type: 'spring', stiffness: 520, damping: 20 }}
            >
              {BEATS[beat]}
            </motion.span>
          )}
        </AnimatePresence>
      </div>

      {/* the line-up */}
      <div className="absolute inset-x-0 bottom-[7vh] flex items-end justify-center gap-[3vw]">
        {DRINKS.map((d, i) => (
          <div key={d.id} className="atn-cupwrap">
            <img
              src={d.image}
              alt=""
              draggable={false}
              className={`atn-cup-${i} h-[min(44vh,34vw)] w-auto object-contain drop-shadow-[0_24px_24px_rgb(90_46_26/0.35)]`}
              style={{ transform: 'translateY(110vh)', transformOrigin: '50% 100%' }}
            />
          </div>
        ))}
      </div>

      {/* halal stamp + CTA */}
      <div className="atn-text pointer-events-none absolute inset-x-0 top-[7vh] flex flex-col items-center gap-[3vh]">
        <span className="atn-halal rounded-2xl border-[5px] border-leaf bg-cream px-[3vh] py-[1vh] font-display text-[min(5vw,7vh)] font-bold uppercase leading-none text-leaf opacity-0">
          0% alkohol · 100% halal
        </span>
        <span className="atn-cta rounded-[3vh] bg-terracotta px-[4vh] py-[1.6vh] text-center font-display text-[min(8vw,11vh)] font-bold uppercase leading-none text-cream opacity-0 shadow-[0_1.2vh_0_#5a2e1a]">
          Cobain di {EVENT.table}!
          <span className="mt-[1vh] block font-script text-[min(4vw,5.5vh)] normal-case text-yakult">mulai {Math.min(...DRINKS.map((d) => d.price))}K · paket hemat {Math.min(...BUNDLES.map((b) => b.price))}K</span>
        </span>
      </div>

      <motion.div className="flash pointer-events-none absolute inset-0 bg-white opacity-0" />
      <span className="absolute bottom-3 right-4 font-cond text-xs font-semibold uppercase italic tracking-widest text-brown/35">esc · lewati</span>
    </motion.div>
  )
}

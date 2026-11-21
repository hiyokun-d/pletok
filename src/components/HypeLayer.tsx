import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { DRINKS } from '../data/menu'
import { EVENT } from '../data/event'
import { signal } from '../lib/events'
import { ParticleField } from './ParticleField'

type Pt = [number, number]

/** sticker words, in the poster's colours */
const WORDS = [
  { t: 'PLE!', bg: '#a8572a', fg: '#fff' },
  { t: 'TOK!', bg: '#5a2e1a', fg: '#f5ebdd' },
  { t: 'HALAL!', bg: '#5e7b3a', fg: '#fff' },
  { t: 'SEGER!', bg: '#e9827f', fg: '#fff' },
  { t: `${EVENT.table.toUpperCase()}!`, bg: '#a8572a', fg: '#fff' },
  { t: 'MULAI 18K', bg: '#f1d3a8', fg: '#5a2e1a' },
  { t: 'COBAIN!', bg: '#c98a3c', fg: '#fff' },
  { t: '0% ALKOHOL', bg: '#5e7b3a', fg: '#fff' },
]
const MAX_POPS = 18

interface Pop {
  id: number
  x: number
  y: number
  rot: number
  /** a word sticker, or one of the cups */
  word?: (typeof WORDS)[number]
  cup?: string
}

/**
 * A + T — the spammable one. Every press pops a sticker or a cup somewhere on screen with a
 * burst and a little shake; mash or hold it for more. Lives above every scene and never blocks the page.
 */
export function HypeLayer() {
  const [scope, animate] = useAnimate()
  const [pops, setPops] = useState<Pop[]>([])
  // three burst emitters taking turns, so mashing doesn't cut the previous burst short
  const [bursts, setBursts] = useState<Array<{ key: number; pts: Pt[] } | undefined>>([undefined, undefined, undefined])
  const n = useRef(0)

  useEffect(() => {
    const off = signal.on('hype', () => {
      const W = window.innerWidth
      const H = window.innerHeight
      const now = performance.now()

      const id = ++n.current
      const x = W * (0.12 + Math.random() * 0.76)
      const y = H * (0.18 + Math.random() * 0.62)
      const cupTurn = id % 4 === 0
      const pop: Pop = {
        id,
        x,
        y,
        rot: (Math.random() - 0.5) * 36,
        ...(cupTurn ? { cup: DRINKS[id % DRINKS.length].image } : { word: WORDS[Math.floor(Math.random() * WORDS.length)] }),
      }
      setPops((p) => [...p.slice(-(MAX_POPS - 1)), pop])
      window.setTimeout(() => setPops((p) => p.filter((q) => q.id !== id)), 1500)

      setBursts((b) => b.map((v, i) => (i === id % 3 ? { key: now, pts: [[x, y]] } : v)))

      const root = document.getElementById('root')
      // only on one-screen layouts — on the long phone page the pulse would jump fixed bars around
      if (root && document.documentElement.scrollHeight <= H + 4) animate(root, { scale: [1, 1.012, 1] }, { duration: 0.4, ease: [0.22, 1, 0.36, 1] })
    })
    return () => {
      off()
    }
  }, [animate, scope])

  return (
    <div ref={scope} className="pointer-events-none fixed inset-0 z-[66] overflow-hidden">
      {bursts.map((b, i) => (
        <ParticleField
          key={i}
          preset="burst"
          overrides={{ shape: i === 1 ? 'sparkle' : 'leaf', count: 40, size: [10, 20], burstSpeed: [220, 720], gravity: 600 }}
          points={b?.pts}
          burstKey={b?.key}
        />
      ))}

      <AnimatePresence>
        {pops.map((p) => (
          <motion.div
            key={p.id}
            className="absolute"
            style={{ left: p.x, top: p.y, x: '-50%', y: '-50%' }}
            initial={{ scale: 0, rotate: p.rot * 2, opacity: 1 }}
            animate={{ scale: [0, 1.35, 1], rotate: p.rot, y: ['-50%', '-50%', '-90%'] }}
            exit={{ scale: 0.6, opacity: 0, y: '-180%', transition: { duration: 0.35 } }}
            transition={{ duration: 1.1, times: [0, 0.25, 1], ease: 'easeOut' }}
          >
            {p.cup ? (
              <img src={p.cup} alt="" draggable={false} className="h-[min(24vh,30vw)] w-auto object-contain drop-shadow-[0_14px_14px_rgb(90_46_26/0.35)]" />
            ) : (
              <span
                className="block whitespace-nowrap rounded-[2vh] px-[2.4vh] py-[1vh] font-display text-[min(7vh,9vw)] font-bold leading-none shadow-[0_0.8vh_0_rgb(58_28_15/0.85)]"
                style={{ background: p.word!.bg, color: p.word!.fg }}
              >
                {p.word!.t}
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>


    </div>
  )
}

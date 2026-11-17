import { useState, type PointerEvent } from 'react'
import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { Flame, Hand, RotateCcw, Waves, X } from 'lucide-react'
import { ParticleField } from './ParticleField'
import { StirScene } from './StirScene'
import { ease, spring } from '../lib/motion'

type Side = 'left' | 'right'

/** The three stories behind the name — every one of them is a sound */
const VERSIONS = [
  { Icon: Waves, title: 'Dikocok di tabung bambu', body: 'Es dan minuman dikocok dalam bambu — bunyinya pletak-pletok.' },
  { Icon: Flame, title: 'Kapulaga yang pecah', body: 'Waktu direbus, biji kapulaga meletup: pletok!' },
  { Icon: Hand, title: 'Diaduk penjualnya', body: 'Pengaduk mengetuk gelas berisi es: ple… tok!' },
]

/**
 * "Kenapa namanya Pletok?" — a 3D glass of bir pletok gets stirred, then the stirrer knocks
 * the glass: PLE! … TOK! Afterwards visitors tap the glass to knock it themselves.
 */
export function PletokEgg({ onDone }: { onDone: () => void }) {
  const [scope, animate] = useAnimate()
  const [run, setRun] = useState(0)
  const [finished, setFinished] = useState(false)
  const [tap, setTap] = useState<{ side: Side; key: number }>()
  const [count, setCount] = useState(0)
  const [burst, setBurst] = useState<{ key: number; pts: [number, number][] }>()

  const onKnock = (side: Side, [x, y]: [number, number]) => {
    setBurst({ key: Date.now(), pts: [[x, y]] })
    if (finished) setCount((c) => c + 1)
    const word = side === 'left' ? '.word-ple' : '.word-tok'
    const ring = side === 'left' ? '.ring-l' : '.ring-r'
    const host = scope.current?.getBoundingClientRect()
    if (host) {
      const el = scope.current!.querySelector(ring) as HTMLElement
      el.style.left = `${x - host.left - 32}px`
      el.style.top = `${y - host.top - 32}px`
    }
    // every knock lands a little differently, so tapping never feels canned
    const tilt = (Math.random() - 0.5) * 16
    animate(ring, { scale: [0.2, 3], opacity: [0.9, 0] }, { duration: 0.6, ease: ease.out })
    animate(word, { scale: [0, 1.45, 1], opacity: [0, 1, 1], rotate: side === 'left' ? [-40, -6 + tilt, -10 + tilt] : [40, 4 + tilt, 8 + tilt], y: [30, -8, 0] }, { duration: 0.5, ease: 'easeOut' })
    animate(scope.current!, { x: [0, side === 'left' ? -10 : 10, 5, 0] }, { duration: 0.3 })
  }

  const knock = (e: PointerEvent<HTMLDivElement>) => {
    if (!finished) return
    const r = e.currentTarget.getBoundingClientRect()
    setTap({ side: e.clientX < r.left + r.width / 2 ? 'left' : 'right', key: Date.now() })
  }

  const replay = () => {
    setFinished(false)
    setCount(0)
    animate('.word', { opacity: 0 }, { duration: 0.2 })
    setRun((r) => r + 1)
  }

  return (
    <motion.div
      className="paper fixed inset-0 z-50 overflow-y-auto overflow-x-hidden"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ clipPath: 'circle(0% at 50% 50%)', transition: { duration: 0.6, ease: ease.inOut } }}
      transition={{ duration: 0.7, ease: ease.out }}
    >
      <ParticleField preset="leaf" overrides={{ count: 12, opacity: 0.5 }} />
      <ParticleField
        preset="burst"
        overrides={{ shape: 'bubble', count: 70, colors: ['#7a2a1a', '#b4532f', '#ffffff', '#c98a3c'], size: [5, 12], burstSpeed: [200, 560] }}
        points={burst?.pts}
        burstKey={burst?.key}
      />

      <button onClick={onDone} aria-label="Tutup" className="fixed right-4 top-4 z-10 grid size-11 place-items-center rounded-full bg-brown text-cream shadow-[0_4px_0_#3a1c0f] active:scale-95">
        <X className="size-5" />
      </button>

      <div className="relative mx-auto flex min-h-full max-w-3xl flex-col items-center px-5 pb-10 pt-[6vh]">
        <motion.p className="font-cond text-sm font-semibold uppercase italic tracking-[0.3em] text-terracotta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          Asal-usul nama
        </motion.p>
        <motion.h2 className="mt-1 text-center font-display text-3xl font-bold text-brown md:text-5xl" initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.25 }}>
          Kenapa namanya <span className="text-terracotta">Pletok</span>?
        </motion.h2>

        {/* the 3D glass — after the demo, tap a side to knock it */}
        <div ref={scope} onPointerDown={knock} className={`relative h-[min(46vh,440px)] w-[min(94vw,620px)] shrink-0 select-none ${finished ? 'cursor-pointer' : ''}`}>
          <StirScene run={run} tap={tap} onKnock={onKnock} onDone={() => setFinished(true)} className="absolute inset-0" />
          <span className="word word-ple pointer-events-none absolute left-[2%] top-[10%] font-display text-[clamp(3rem,11vw,6rem)] font-bold text-terracotta opacity-0 [text-shadow:4px_5px_0_#5a2e1a]">PLE!</span>
          <span className="word word-tok pointer-events-none absolute right-[2%] top-[4%] font-display text-[clamp(3.5rem,13vw,7rem)] font-bold text-brown opacity-0 [text-shadow:4px_5px_0_#a8572a]">TOK!</span>
          <span className="ring-l pointer-events-none absolute size-16 rounded-full border-4 border-terracotta opacity-0" />
          <span className="ring-r pointer-events-none absolute size-16 rounded-full border-4 border-brown opacity-0" />

          <AnimatePresence>
            {finished && (
              <motion.div
                key={count > 0 ? 'count' : 'hint'}
                className="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center"
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6 }}
                transition={spring.pop}
              >
                {count === 0 ? (
                  <span className="flex items-center gap-2 rounded-full bg-brown px-4 py-2 font-display text-sm font-semibold text-cream">
                    <motion.span animate={{ rotate: [0, -20, 0] }} transition={{ duration: 0.8, repeat: Infinity }}>
                      <Hand className="size-4" />
                    </motion.span>
                    Ketuk kiri / kanan gelasnya!
                  </span>
                ) : (
                  <motion.span key={count} className="rounded-full bg-terracotta px-4 py-2 font-display text-sm font-bold text-cream" initial={{ scale: 1.3 }} animate={{ scale: 1 }}>
                    {count >= 6 ? 'Kamu jago bikin pletok! ' : ''}
                    {count}× pletok
                  </motion.span>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div className="w-full" initial={false} animate={finished ? 'show' : 'hidden'} variants={{ hidden: {}, show: { transition: { staggerChildren: 0.1 } } }}>
          <motion.p
            className="mx-auto mt-2 max-w-md text-center font-display text-lg leading-snug text-brown"
            variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: spring.glide } }}
          >
            Namanya datang dari <b className="text-terracotta">bunyi</b>. Ada tiga versi ceritanya:
          </motion.p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {VERSIONS.map(({ Icon, title, body }, i) => (
              <motion.div
                key={title}
                className="flex items-start gap-3 rounded-2xl border-2 border-brown/10 bg-[#fbf5ec] p-4 md:flex-col"
                variants={{ hidden: { opacity: 0, y: 30, rotate: i % 2 ? 3 : -3 }, show: { opacity: 1, y: 0, rotate: 0, transition: { type: 'spring', stiffness: 260, damping: 20 } } }}
                whileHover={{ y: -4, rotate: i % 2 ? 1 : -1 }}
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-terracotta text-cream">
                  <Icon className="size-5" />
                </span>
                <div>
                  <p className="font-cond text-xs font-semibold uppercase italic tracking-widest text-terracotta">Versi {i + 1}</p>
                  <p className="font-display text-base font-bold leading-tight text-brown">{title}</p>
                  <p className="mt-0.5 font-display text-sm leading-snug text-brown-soft">{body}</p>
                </div>
              </motion.div>
            ))}
          </div>
          <motion.p className="mt-3 text-center font-cond text-base italic text-brown-soft" variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}>
            Whichever story you believe — the name is the sound.
          </motion.p>
          <motion.div className="mt-5 flex justify-center gap-3" variants={{ hidden: { opacity: 0, y: 16 }, show: { opacity: 1, y: 0, transition: spring.glide } }}>
            <button onClick={replay} className="inline-flex items-center gap-2 rounded-full border-2 border-brown px-5 py-2.5 font-display font-semibold text-brown transition-transform active:scale-95">
              <RotateCcw className="size-4" /> Aduk lagi
            </button>
            <button onClick={onDone} className="inline-flex items-center gap-2 rounded-full bg-brown px-5 py-2.5 font-display font-semibold text-cream shadow-[0_4px_0_#3a1c0f] transition-transform active:scale-95">
              <X className="size-4" /> Tutup
            </button>
          </motion.div>
        </motion.div>
      </div>
    </motion.div>
  )
}

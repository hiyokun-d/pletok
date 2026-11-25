import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { EVENT } from '../data/event'
import { ParticleField } from './ParticleField'
import { GigiBalang, Kawung, Lawang, Tumpal } from './BetawiPattern'
import { ease } from '../lib/motion'
import { useMenu } from '../hooks/useMenu'

type Pt = [number, number]
type Animate = ReturnType<typeof useAnimate>[1]
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

// the list lives in data/shows so the booth app knows how many there are without loading them
import { SHOWS, SHOW_COUNT } from '../data/shows'
export { SHOWS, SHOW_COUNT }

/**
 * Crew-triggered (A + G, or /config from a phone) attention grabber for the booth screen — ~7 s of loud,
 * then it gets out of the way again. Five different shows; `show` picks one.
 */
export function AttentionShow({ show, onDone }: { show: number; onDone: () => void }) {
  const Show = [PsstShow, LawangShow, MarqueeShow, CardsShow, SpotShow][show % SHOW_COUNT]
  return <Show onDone={onDone} />
}

/* ------------------------------------------------------------------ shared */

interface Kit {
  alive: () => boolean
  push: (k?: number) => void
  confetti: () => void
}

/** runs a show's script once, then wipes the overlay away; Esc skips */
function useScript(scope: RefObject<HTMLDivElement | null>, animate: Animate, onDone: () => void, script: (kit: Kit) => Promise<void>) {
  const done = useRef(onDone)
  done.current = onDone
  const [confettiKey, setConfettiKey] = useState<number>()
  useEffect(() => {
    let alive = true
    const kit: Kit = {
      alive: () => alive,
      // a smooth push-in on each hit — no shaking
      push: (k = 1) => void animate(scope.current!, { scale: [1, 1 + 0.03 * k, 1] }, { duration: 0.55, ease: [0.22, 1, 0.36, 1] }),
      confetti: () => setConfettiKey(Date.now()),
    }
    void script(kit).then(async () => {
      if (!alive) return
      await animate(scope.current!, { clipPath: ['circle(150% at 50% 50%)', 'circle(0% at 50% 50%)'] }, { duration: 0.6, ease: ease.inOut })
      if (alive) done.current()
    })
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && done.current()
    window.addEventListener('keydown', onKey)
    return () => {
      alive = false
      window.removeEventListener('keydown', onKey)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  return confettiKey
}

function Stage({ scope, className = 'bg-cream', confettiKey, dark = false, children }: { scope: RefObject<HTMLDivElement | null>; className?: string; confettiKey?: number; dark?: boolean; children: ReactNode }) {
  const W = window.innerWidth
  const H = window.innerHeight
  const pts: Pt[] = [[W * 0.2, H * 0.3], [W * 0.8, H * 0.3], [W / 2, H * 0.75]]
  return (
    <motion.div ref={scope} className={`fixed inset-0 z-[65] overflow-hidden ${className}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.15 }}>
      {children}
      <ParticleField
        preset="burst"
        overrides={{ shape: 'sparkle', count: 120, colors: ['#a8572a', '#e9827f', '#c98a3c', '#5e7b3a', '#f1d3a8'], size: [8, 16], burstSpeed: [300, 1000], gravity: 700 }}
        points={confettiKey ? pts : undefined}
        burstKey={confettiKey}
      />
      <span className={`absolute bottom-3 right-4 z-30 font-cond text-xs font-semibold uppercase italic tracking-widest ${dark ? 'text-cream/35' : 'text-brown/35'}`}>esc · lewati</span>
    </motion.div>
  )
}

/** "Cobain di Meja 9!" with today's lowest prices — every show ends on it */
function Cta({ className }: { className: string }) {
  const live = useMenu()
  return (
    <span className={`${className} rounded-[3vh] bg-terracotta px-[4vh] py-[1.6vh] text-center font-display text-[min(8vw,11vh)] font-bold uppercase leading-none text-cream opacity-0 shadow-[0_1.2vh_0_#5a2e1a]`}>
      Cobain di {EVENT.table}!
      <span className="mt-[1vh] block font-script text-[min(4vw,5.5vh)] normal-case text-yakult">
        mulai {Math.min(...live.drinks.map((d) => d.price))}K · paket hemat {Math.min(...live.bundles.map((b) => b.price))}K
      </span>
    </span>
  )
}

const pop = { scale: [0.2, 1.12, 1], opacity: [0, 1, 1], rotate: [8, -3, -3] }

/* ------------------------------------------------------------------ 0 · PSST! HAUS? SINI! */

const BEATS = ['PSST!', 'HAUS?', 'SINI!'] as const

/** flash, spinning sunburst, three slammed words, the cups slam in, halal stamp, CTA */
function PsstShow({ onDone }: { onDone: () => void }) {
  const live = useMenu()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [beat, setBeat] = useState(-1)
  const [burst, setBurst] = useState<number>()
  const confettiKey = useScript(scope, animate, onDone, async ({ alive, push, confetti }) => {
    await animate('.flash', { opacity: [0, 1, 0] }, { duration: 0.35 })
    animate('.rays', { opacity: [0, 1], scale: [0.3, 1] }, { duration: 0.6, ease: ease.out })
    for (let i = 0; i < BEATS.length && alive(); i++) {
      setBeat(i)
      await wait(90)
      push(i === 2 ? 1.4 : 0.9)
      setBurst(Date.now())
      await wait(720)
    }
    if (!alive()) return
    setBeat(-1)
    await wait(150)
    for (let i = 0; i < live.drinks.length; i++) {
      animate(`.atn-cup-${i}`, { y: ['110vh', '-6vh', '1.5vh', '0vh'], rotate: [(i - 1) * 30, (i - 1) * -6, 0], scaleY: [1, 1, 0.9, 1] }, { duration: 0.6, ease: 'easeOut' })
      await wait(170)
    }
    await wait(500)
    push(0.8)
    animate('.atn-cupwrap', { y: [0, -36, 0] }, { duration: 0.45, delay: (i: number) => i * 0.07, ease: 'easeOut' })
    await animate('.atn-halal', { scale: [3, 0.9, 1], opacity: [0, 1, 1], rotate: [-25, -8, -8] }, { duration: 0.45, ease: 'easeOut' })
    push(0.6)
    await wait(500)
    await animate('.atn-cta', pop, { duration: 0.55, ease: 'easeOut' })
    push(1.2)
    confetti()
    animate('.atn-cta', { scale: [1, 1.06, 1] }, { duration: 0.5, repeat: 3, ease: 'easeInOut' })
    await wait(2300)
    if (!alive()) return
    live.drinks.forEach((_, i) => animate(`.atn-cup-${i}`, { y: '-120vh', rotate: (i - 1) * 25 }, { duration: 0.6, delay: i * 0.05, ease: ease.inOut }))
    await animate('.atn-text', { scale: 0.4, opacity: 0 }, { duration: 0.35 })
  })

  const W = window.innerWidth
  const H = window.innerHeight
  return (
    <Stage scope={scope} confettiKey={confettiKey}>
      {/* spinning sunburst, poster-style */}
      <motion.div
        className="rays absolute left-1/2 top-1/2 aspect-square w-[260vmax] -translate-x-1/2 -translate-y-1/2 opacity-0"
        style={{ background: 'repeating-conic-gradient(from 0deg, #f1d3a8 0deg 9deg, #f5ebdd 9deg 18deg)' }}
        animate={{ rotate: 360 }}
        transition={{ duration: 24, repeat: Infinity, ease: 'linear' }}
      />
      <div className="absolute inset-0" style={{ background: 'radial-gradient(circle at 50% 50%, transparent 25%, rgb(245 235 221 / 0.85) 75%)' }} />
      <ParticleField preset="burst" overrides={{ shape: 'leaf', count: 70, size: [12, 26], burstSpeed: [300, 900], gravity: 600 }} points={burst ? [[W / 2, H / 2]] : undefined} burstKey={burst} />

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

      <div className="absolute inset-x-0 bottom-[7vh] flex items-end justify-center gap-[3vw]">
        {live.drinks.map((d, i) => (
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

      <div className="atn-text pointer-events-none absolute inset-x-0 top-[7vh] flex flex-col items-center gap-[3vh]">
        <span className="atn-halal rounded-2xl border-[5px] border-leaf bg-cream px-[3vh] py-[1vh] font-display text-[min(5vw,7vh)] font-bold uppercase leading-none text-leaf opacity-0">
          0% alkohol · 100% halal
        </span>
        <Cta className="atn-cta" />
      </div>

      <motion.div className="flash pointer-events-none absolute inset-0 bg-white opacity-0" />
    </Stage>
  )
}

/* ------------------------------------------------------------------ 1 · Lawang Betawi */

/** knock knock on a carved Betawi double door — it swings open in 3D onto the line-up */
function LawangShow({ onDone }: { onDone: () => void }) {
  const live = useMenu()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const confettiKey = useScript(scope, animate, onDone, async ({ alive, push, confetti }) => {
    await wait(300)
    for (const k of ['.lw-k0', '.lw-k1']) {
      animate(k, { opacity: [0, 1], scale: [2, 1], rotate: [k === '.lw-k0' ? -14 : 12, k === '.lw-k0' ? -6 : 5] }, { type: 'spring', stiffness: 500, damping: 18 })
      animate('.lw-doors', { scale: [1, 1.015, 1] }, { duration: 0.3, ease: 'easeOut' })
      await wait(520)
    }
    await wait(400)
    if (!alive()) return
    animate('.lw-k0, .lw-k1', { opacity: 0, scale: 1.4 }, { duration: 0.25 })
    animate('.door-l', { rotateY: [0, -112] }, { duration: 1.5, ease: [0.65, 0, 0.35, 1] })
    animate('.door-r', { rotateY: [0, 112] }, { duration: 1.5, ease: [0.65, 0, 0.35, 1] })
    animate('.lw-doors', { opacity: [1, 1, 0] }, { duration: 1.5, times: [0, 0.8, 1] })
    // light floods out from behind the doors
    animate('.lw-glow', { opacity: [0, 1], scale: [0.4, 1] }, { duration: 1.2, ease: ease.out })
    await wait(450)
    live.drinks.forEach((_, i) => animate(`.lw-cup-${i}`, { y: ['50vh', '0vh'], rotateY: [i === 1 ? 0 : (i - 1) * 70, 0], opacity: [0, 1] }, { type: 'spring', stiffness: 160, damping: 17, delay: 0.1 + i * 0.12 }))
    await wait(700)
    await animate('.lw-title', { opacity: [0, 1], y: [30, 0] }, { duration: 0.5, ease: ease.out })
    animate('.lw-band', { y: ['-100%', '0%'] }, { duration: 0.6, ease: ease.out })
    await animate('.lw-cta', pop, { duration: 0.55, ease: 'easeOut' })
    push(1)
    confetti()
    await wait(2800)
  })
  return (
    <Stage scope={scope} confettiKey={confettiKey} className="bg-[#2b160c]">
      <div className="lw-glow absolute inset-0 bg-cream opacity-0" style={{ background: 'radial-gradient(circle at 50% 55%, #fff6e6 0%, #f5ebdd 45%, #ecdcc5 100%)' }} />
      <Kawung className="absolute inset-0 opacity-[0.08]" color="#a8572a" size={70} />
      <div className="lw-band absolute inset-x-0 top-0" style={{ transform: 'translateY(-100%)' }}>
        <GigiBalang color="#a8572a" accent="#f5ebdd" size={40} />
      </div>
      <div className="absolute inset-x-0 bottom-0 opacity-30">
        <Tumpal color="#5e7b3a" accent="#f5ebdd" size={30} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3vh]" style={{ perspective: 1200 }}>
        <p className="lw-title font-script text-[min(9vw,10vh)] font-bold text-terracotta opacity-0">Silakan mampir!</p>
        <div className="flex items-end gap-[4vw]">
          {live.drinks.map((d, i) => (
            <img key={d.id} src={d.image} alt="" draggable={false} className={`lw-cup-${i} h-[min(38vh,30vw)] w-auto object-contain opacity-0 drop-shadow-[0_24px_24px_rgb(90_46_26/0.35)]`} />
          ))}
        </div>
        <Cta className="lw-cta" />
      </div>
      <div className="lw-doors absolute inset-0">
        <Lawang />
      </div>
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center gap-[6vw] font-display text-[min(16vw,20vh)] font-bold uppercase text-yakult [text-shadow:0_1vh_0_#1f0f07]">
        <span className="lw-k0 opacity-0">Tok!</span>
        <span className="lw-k1 opacity-0">Tok!</span>
      </div>
    </Stage>
  )
}

/* ------------------------------------------------------------------ 2 · Pita berjalan */

const BANDS = [
  { t: 'Bir Pletok', bg: '#a8572a', fg: '#f5ebdd' },
  { t: '0% Alkohol', bg: '#f5ebdd', fg: '#5a2e1a' },
  { t: 'Rempah Betawi', bg: '#5e7b3a', fg: '#f5ebdd' },
  { t: 'Dingin · Segar', bg: '#5a2e1a', fg: '#f1d3a8' },
  { t: `${EVENT.table}`, bg: '#c98a3c', fg: '#2b160c' },
]

/** huge words race across tilted ribbons, then the ribbons tear away to the CTA */
function MarqueeShow({ onDone }: { onDone: () => void }) {
  const live = useMenu()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const confettiKey = useScript(scope, animate, onDone, async ({ alive, push, confetti }) => {
    BANDS.forEach((_, i) => {
      animate(`.mq-band-${i}`, { x: [i % 2 ? '-110%' : '110%', '0%'] }, { duration: 0.6, ease: ease.out, delay: i * 0.08 })
      animate(`.mq-row-${i}`, { x: i % 2 ? ['-50%', '0%'] : ['0%', '-50%'] }, { duration: 9, ease: 'linear' })
    })
    await wait(900)
    push(0.7)
    await wait(2200)
    if (!alive()) return
    BANDS.forEach((_, i) => animate(`.mq-band-${i}`, { x: i % 2 ? '120%' : '-120%' }, { duration: 0.55, ease: [0.7, 0, 0.84, 0], delay: i * 0.05 }))
    await wait(450)
    live.drinks.forEach((_, i) => animate(`.mq-cup-${i}`, { y: ['60vh', '0vh'], rotate: [(i - 1) * 20, 0], opacity: [0, 1] }, { type: 'spring', stiffness: 220, damping: 16, delay: i * 0.1 }))
    await animate('.mq-cta', { rotateX: [-90, 10, 0], opacity: [0, 1, 1] }, { duration: 0.6, ease: 'easeOut', delay: 0.25 })
    push(1.1)
    confetti()
    await wait(2600)
  })
  return (
    <Stage scope={scope} confettiKey={confettiKey} className="bg-[#2b160c]" dark>
      <div className="absolute -inset-x-[20%] inset-y-[-10%] flex rotate-[-10deg] flex-col justify-center gap-[2vh]">
        {BANDS.map((b, i) => (
          <div key={i} className={`mq-band-${i} overflow-hidden py-[1.2vh] shadow-[0_1vh_0_rgb(0_0_0/0.25)]`} style={{ background: b.bg, transform: 'translateX(110%)' }}>
            <div className={`mq-row-${i} flex w-max whitespace-nowrap font-display text-[min(11vw,13vh)] font-bold uppercase leading-none`} style={{ color: b.fg }}>
              {Array.from({ length: 12 }, (_, k) => (
                <span key={k} className="px-[2vw]">
                  {b.t} <span className="opacity-50">✦</span>
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4vh]" style={{ perspective: 900 }}>
        <div className="flex items-end gap-[3vw]">
          {live.drinks.map((d, i) => (
            <img key={d.id} src={d.image} alt="" draggable={false} className={`mq-cup-${i} h-[min(40vh,30vw)] w-auto object-contain opacity-0`} />
          ))}
        </div>
        <Cta className="mq-cta" />
      </div>
    </Stage>
  )
}

/* ------------------------------------------------------------------ 3 · Kartu rahasia */

/** three batik-backed cards fall onto the table and flip over one by one in 3D */
function CardsShow({ onDone }: { onDone: () => void }) {
  const live = useMenu()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const confettiKey = useScript(scope, animate, onDone, async ({ alive, push, confetti }) => {
    await animate('.kt-title', { opacity: [0, 1], y: [-30, 0] }, { duration: 0.45, ease: ease.out })
    for (let i = 0; i < live.drinks.length; i++) {
      animate(`.kt-card-${i}`, { y: ['-110vh', '0vh'], rotateZ: [(i - 1) * 25 - 10, (i - 1) * 4] }, { type: 'spring', stiffness: 170, damping: 17 })
      await wait(160)
    }
    await wait(700)
    push(0.5)
    for (let i = 0; i < live.drinks.length && alive(); i++) {
      animate(`.kt-card-${i}`, { rotateY: [0, 180], scale: [1, 1.12, 1] }, { duration: 0.75, ease: [0.65, 0, 0.35, 1] })
      await wait(600)
      push(0.35)
    }
    if (!alive()) return
    await wait(300)
    animate('.kt-title', { opacity: 0 }, { duration: 0.2 })
    await animate('.kt-cta', pop, { duration: 0.55, ease: 'easeOut' })
    push(1)
    confetti()
    await wait(2600)
  })
  return (
    <Stage scope={scope} confettiKey={confettiKey}>
      <Kawung className="absolute inset-0 opacity-[0.1]" color="#a8572a" size={64} />
      <div className="absolute inset-x-0 top-0 opacity-80">
        <GigiBalang color="#a8572a" accent="#f5ebdd" size={36} />
      </div>
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[4vh]">
        <p className="kt-title font-script text-[min(8vw,9vh)] font-bold text-terracotta opacity-0">Pilih jagoanmu…</p>
        <div className="flex gap-[3vw]" style={{ perspective: 1400 }}>
          {live.drinks.map((d, i) => (
            <div key={d.id} className={`kt-card-${i} relative aspect-[3/4] w-[min(26vw,30vh)]`} style={{ transformStyle: 'preserve-3d', transform: 'translateY(-110vh)' }}>
              {/* back: batik */}
              <div className="absolute inset-0 overflow-hidden rounded-[2.4vh] border-[0.6vh] border-[#c98a3c] bg-[#4a2414] [backface-visibility:hidden]">
                <Kawung className="absolute inset-0 opacity-40" color="#c98a3c" size={44} />
                <span className="absolute inset-0 grid place-items-center font-display text-[10vh] font-bold text-[#c98a3c]">?</span>
              </div>
              {/* front: the drink */}
              <div className="absolute inset-0 flex flex-col items-center justify-end gap-[1vh] overflow-hidden rounded-[2.4vh] border-[0.6vh] border-terracotta bg-cream p-[2vh] [backface-visibility:hidden]" style={{ transform: 'rotateY(180deg)' }}>
                <img src={d.image} alt="" draggable={false} className="min-h-0 flex-1 object-contain" />
                <span className="text-center font-display text-[min(2.6vw,3.2vh)] font-bold uppercase leading-tight text-brown">{d.name}</span>
                <span className="rounded-full bg-terracotta px-[2vh] py-[0.5vh] font-display text-[min(3vw,4vh)] font-bold text-cream">{d.price}K</span>
              </div>
            </div>
          ))}
        </div>
        <Cta className="kt-cta" />
      </div>
    </Stage>
  )
}

/* ------------------------------------------------------------------ 4 · Lampu sorot */

const SAY = ['Ini?', 'Atau ini?', 'Yang ini?']

/** the lights go out; a spotlight hunts for each cup… then every light comes on */
function SpotShow({ onDone }: { onDone: () => void }) {
  const live = useMenu()
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const [say, setSay] = useState(-1)
  const confettiKey = useScript(scope, animate, onDone, async ({ alive, push, confetti }) => {
    const W = window.innerWidth
    const H = window.innerHeight
    const at = (sel: string) => {
      const r = scope.current!.querySelector(sel)!.getBoundingClientRect()
      return { x: r.left + r.width / 2 - W / 2, y: r.top + r.height / 2 - H / 2 }
    }
    await animate('.st-spot', { scale: [0.25, 1] }, { duration: 0.5, ease: ease.out })
    for (let i = 0; i < live.drinks.length && alive(); i++) {
      setSay(i)
      await animate('.st-spot', at(`.st-cup-${i}`), { type: 'spring', stiffness: 90, damping: 15 })
      animate(`.st-cup-${i}`, { y: [0, -24, 0] }, { duration: 0.4 })
      await wait(450)
    }
    if (!alive()) return
    setSay(-1)
    await animate('.st-spot', { x: 0, y: 0, scale: 0.6 }, { duration: 0.35, ease: ease.inOut })
    // every light on
    await animate('.st-spot', { scale: 14 }, { duration: 0.55, ease: [0.7, 0, 0.84, 0] })
    animate('.st-spot', { opacity: 0 }, { duration: 0.2 })
    await animate('.st-all', { scale: [3, 1], opacity: [0, 1], rotate: [-12, -4] }, { duration: 0.4, ease: [0.2, 0, 0, 1] })
    push(1.3)
    animate('.st-cupwrap', { y: [0, -40, 0] }, { duration: 0.45, delay: (i: number) => i * 0.07, ease: 'easeOut' })
    await animate('.st-cta', pop, { duration: 0.55, ease: 'easeOut' })
    confetti()
    await wait(2600)
  })
  return (
    <Stage scope={scope} confettiKey={confettiKey}>
      <Kawung className="absolute inset-0 opacity-[0.08]" color="#a8572a" size={64} />
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-[3vh]">
        <span className="st-all font-display text-[min(12vw,14vh)] font-bold uppercase leading-none text-brown opacity-0 [text-shadow:0_1vh_0_#a8572a]">Semuanya!</span>
        <div className="flex items-end gap-[6vw]">
          {live.drinks.map((d, i) => (
            <div key={d.id} className="st-cupwrap">
              <img src={d.image} alt="" draggable={false} className={`st-cup-${i} h-[min(38vh,28vw)] w-auto object-contain`} />
            </div>
          ))}
        </div>
        <Cta className="st-cta" />
      </div>
      {/* the dark: one huge shadow ring around a hole that moves (transforms only — cheap to draw) */}
      {/* dark from the first frame: starts small (the ring still covers everything) and opens up */}
      <div
        className="st-spot pointer-events-none absolute left-1/2 top-1/2 size-[46vh] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ transform: 'scale(0.25)', boxShadow: '0 0 0 300vmax #120804, inset 0 0 6vh 4vh #120804' }}
      />
      <div className="pointer-events-none absolute inset-x-0 top-[8vh] grid place-items-center">
        <AnimatePresence mode="popLayout">
          {say >= 0 && (
            <motion.span
              key={say}
              className="font-script text-[min(8vw,9vh)] font-bold text-yakult"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20, transition: { duration: 0.15 } }}
            >
              {SAY[say]}
            </motion.span>
          )}
        </AnimatePresence>
      </div>
    </Stage>
  )
}

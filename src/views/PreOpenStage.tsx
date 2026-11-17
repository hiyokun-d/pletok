import { AnimatePresence, motion, useAnimate, useMotionValue, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { CalendarDays, Clock, MapPin } from 'lucide-react'
import { EVENT } from '../data/event'
import { useEventPhase } from '../hooks/useEventPhase'
import { LogoRig } from '../components/LogoRig'
import { ParticleField } from '../components/ParticleField'
import { WindLeaves } from '../components/WindLeaves'
import { ease, spring } from '../lib/motion'
import { useMenu } from '../hooks/useMenu'
import { Morph } from '../components/Morph'

type Pt = [number, number]
const pad = (n: number) => String(n).padStart(2, '0')

/** Big leaves framing the stage; they lean when a gust blows through */
const FRAME_LEAVES = [
  { x: -5, y: -10, s: 38, r: 150, c: '#5e7b3a' },
  { x: -7, y: 38, s: 26, r: 100, c: '#a3b860' },
  { x: 4, y: 72, s: 30, r: 30, c: '#8faa4f' },
  { x: 88, y: -12, s: 34, r: -150, c: '#6f8c3f' },
  { x: 95, y: 40, s: 28, r: -100, c: '#5e7b3a' },
  { x: 84, y: 74, s: 32, r: -30, c: '#a3b860' },
]

/** the last minutes zoom into the logo: starts at 5:00 left, fully in by 2:00 */
const ZOOM_FROM = 5 * 60_000
const ZOOM_TO = 2 * 60_000

/**
 * Booth screen from the day before 13:00: logo on top, a huge countdown that celebrates every
 * tick, the three drinks below — and a simulated wind blowing leaves across the stage.
 */
export function PreOpenStage({ onEgg }: { onEgg: () => void }) {
  const live = useMenu()
  const { remaining, daysAway } = useEventPhase()
  const [scope, animate] = useAnimate()
  const [burst, setBurst] = useState<{ key: number; pts: Pt[] }>()
  // the leaf sim writes its wind here; everything else on stage leans into it
  const wind = useMotionValue(0)
  const lean = useSpring(useTransform(wind, [-300, 300], [-1, 1]), { stiffness: 60, damping: 9 })

  // camera: 0 = normal stage, 1 = zoomed into the logo with the clock under it
  const zoomTarget = Math.min(1, Math.max(0, (ZOOM_FROM - remaining) / (ZOOM_FROM - ZOOM_TO)))
  const zoom = useSpring(zoomTarget, { stiffness: 30, damping: 14 })
  useEffect(() => zoom.set(zoomTarget), [zoom, zoomTarget])
  const logoScale = useTransform(zoom, [0, 1], [1, 2.05])
  const logoY = useTransform(zoom, [0, 1], ['0vh', '17vh'])
  const clockY = useTransform(zoom, [0, 1], ['0vh', '27vh'])
  const clockScale = useTransform(zoom, [0, 1], [1, 0.78])
  const outY = useTransform(zoom, [0, 1], ['0vh', '45vh'])
  const outFade = useTransform(zoom, [0, 0.6], [1, 0])
  // the info line sits right where the clock slides down to — clear it out first
  const infoFade = useTransform(zoom, [0, 0.2], [1, 0])
  const bgScale = useTransform(zoom, [0, 1], [1, 1.35])
  const glow = useTransform(zoom, [0, 1], [0.22, 0.42])
  const glowBg = useTransform(glow, (g) => `radial-gradient(circle, rgb(201 138 60 / ${g}), transparent 62%)`)

  const total = Math.ceil(remaining / 1000)
  const showDays = daysAway >= 2
  const d = showDays ? Math.floor(total / 86400) : 0
  const h = Math.floor((total - d * 86400) / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  // the last hour is just mm:ss — a "00 jam" card is dead weight
  const units = [...(showDays ? [{ id: 'd', v: d, u: 'hari' }] : []), ...(showDays || h > 0 ? [{ id: 'h', v: h, u: 'jam' }] : []), { id: 'm', v: m, u: 'menit' }, { id: 's', v: s, u: 'detik' }]

  // every tick: the seconds card thumps and rings; every minute: a wave + leaf burst
  const prev = useRef({ s, m, h })
  useEffect(() => {
    const p = prev.current
    prev.current = { s, m, h }
    if (p.s === s) return
    animate('.ring-s', { scale: [0.9, 1.5], opacity: [0.55, 0] }, { duration: 0.9, ease: ease.out })
    if (p.m !== m || p.h !== h) {
      animate('.unit', { y: [0, -18, 0], rotate: [0, -3, 2, 0] }, { duration: 0.6, delay: (i: number) => i * 0.07, ease: 'easeOut' })
      const el = scope.current?.querySelector('.unit-m') as HTMLElement | null
      if (el) {
        const r = el.getBoundingClientRect()
        setBurst({ key: Date.now(), pts: [[r.left + r.width / 2, r.top + r.height / 2]] })
      }
    }
  }, [s, m, h, animate, scope])

  return (
    <motion.main
      ref={scope}
      className="paper fixed inset-0 overflow-hidden"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.04, transition: { duration: 0.6 } }}
    >
      {/* background layer: pushes outward as the camera dives into the logo */}
      <motion.div className="pointer-events-none absolute inset-0" style={{ scale: bgScale }}>
        <motion.div
          className="absolute left-1/2 top-[48%] aspect-square w-[70vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
          style={{ background: glowBg }}
        />
        {/* frame leaves bend with the simulated wind — each with its own stiffness, so they never move in sync */}
        {FRAME_LEAVES.map((l, i) => (
          <FrameLeaf key={i} leaf={l} index={i} lean={lean} />
        ))}
      </motion.div>

      <WindLeaves count={38} size={[16, 32]} wind={wind} />
      <ParticleField preset="burst" overrides={{ shape: 'leaf', count: 50, size: [10, 20], burstSpeed: [200, 640], gravity: 500 }} points={burst?.pts} burstKey={burst?.key} />

      <div className="relative flex h-full flex-col items-center px-[4vw] pt-[4vh]">
        {/* logo */}
        <motion.div style={{ scale: logoScale, y: logoY, originY: 0.5 }} className="relative z-10">
          <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ ...spring.glide, delay: 0.1 }} className="w-[min(26vw,38vh)]">
            <LogoRig onLeafTap={onEgg} />
          </motion.div>
        </motion.div>

        <motion.div style={{ y: clockY, scale: clockScale }} className="flex flex-col items-center">

        {/* countdown */}
        <motion.p
          className="mt-[2.5vh] font-cond text-[clamp(1rem,2.8vh,1.7rem)] font-semibold uppercase italic tracking-[0.45em] text-terracotta"
          initial={{ opacity: 0, letterSpacing: '1em' }}
          animate={{ opacity: 1, letterSpacing: '0.45em' }}
          transition={{ duration: 1, delay: 0.3 }}
        >
          Buka dalam
        </motion.p>
        <div className="mt-[1.6vh] flex items-start gap-[1.6vw]">
          {units.map((u, i) => (
            <div key={u.id} className="flex items-start gap-[1.6vw]">
              <motion.div
                className={`unit unit-${u.id} relative flex flex-col items-center`}
                initial={{ y: 60, opacity: 0, scale: 0.8 }}
                animate={{ y: 0, opacity: 1, scale: 1 }}
                transition={{ ...spring.pop, delay: 0.35 + i * 0.08 }}
              >
                {u.id === 's' && <span className="ring-s pointer-events-none absolute inset-0 rounded-[2.2vh] border-[3px] border-spice opacity-0" />}
                <div className="flex gap-[0.6vh]">
                  {pad(u.v)
                    .split('')
                    .map((ch, k) => (
                      <Digit key={k} ch={ch} />
                    ))}
                </div>
                <span className="mt-[1vh] font-cond text-[clamp(0.8rem,2.2vh,1.3rem)] font-semibold uppercase italic tracking-[0.3em] text-brown/70">{u.u}</span>
              </motion.div>
              {i < units.length - 1 && (
                <motion.span
                  className="mt-[3vh] font-display text-[min(9vh,5vw)] font-bold leading-none text-brown/30"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1, repeat: Infinity }}
                >
                  :
                </motion.span>
              )}
            </div>
          ))}
        </div>
        </motion.div>

        <motion.div style={{ opacity: infoFade }}>
        <motion.div
          className="mt-[2.4vh] flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-display text-[clamp(0.9rem,2.1vh,1.25rem)] font-semibold text-brown/80"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
        >
          <span className="flex items-center gap-1.5">
            <CalendarDays className="size-[1.1em] text-terracotta" /> {EVENT.dateLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <Clock className="size-[1.1em] text-terracotta" /> {EVENT.timeLabel}
          </span>
          <span className="flex items-center gap-1.5">
            <MapPin className="size-[1.1em] text-terracotta" /> {EVENT.place}, {EVENT.campus} · {EVENT.table}
          </span>
        </motion.div>
        </motion.div>

        {/* the line-up, leaning into the wind */}
        <motion.div style={{ y: outY, opacity: outFade }} className="mt-auto flex w-full items-end justify-center gap-[5vw] pb-[3vh]">
          {live.drinks.map((dr, i) => (
            <motion.div
              key={dr.id}
              className="flex flex-col items-center"
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ ...spring.pop, stiffness: 200, damping: 14, delay: 0.6 + i * 0.12 }}
            >
              <WindCup src={dr.image} alt={dr.name} lean={lean} index={i} />
              <p className="mt-[0.8vh] font-display text-[clamp(0.85rem,2vh,1.2rem)] font-bold uppercase text-brown">
                {dr.short} <Morph className="text-terracotta" text={`${dr.price}K`} />
              </p>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </motion.main>
  )
}

/** A big frame leaf rooted at its stem, bending with the wind */
function FrameLeaf({ leaf: l, index, lean }: { leaf: (typeof FRAME_LEAVES)[number]; index: number; lean: MotionValue<number> }) {
  // heavier leaves (bigger) answer slower and swing less
  const rotate = useSpring(useTransform(lean, (v) => l.r + v * (26 - l.s * 0.3)), { stiffness: 40 - l.s * 0.6, damping: 5 + (index % 3) })
  return (
    <motion.svg
      viewBox="0 0 32 41"
      className="absolute"
      style={{ left: `${l.x}%`, top: `${l.y}%`, width: `${l.s}vh`, height: `${l.s * 1.28}vh`, opacity: 0.2, originX: '10%', originY: '95%', rotate }}
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ ...spring.pop, delay: 0.2 + index * 0.08 }}
    >
      <path d="M2 40 C 0 21 11 5 31 0 C 32 19 22 36 2 40 Z" fill={l.c} />
      <path d="M6.5 33 C 10 23.5 16 14.5 23.5 8" stroke="#f5ebdd" strokeWidth={1.4} strokeLinecap="round" fill="none" />
    </motion.svg>
  )
}

/** A cup that tilts on its base when the wind pushes — springy, a bit wobbly, never scripted */
function WindCup({ src, alt, lean, index }: { src: string; alt: string; lean: MotionValue<number>; index: number }) {
  const rotate = useSpring(useTransform(lean, (v) => v * 7), { stiffness: 90 + index * 25, damping: 6 })
  const x = useTransform(rotate, (r) => r * 1.2)
  return (
    <motion.img
      src={src}
      alt={alt}
      draggable={false}
      className="h-[min(26vh,24vw)] w-auto object-contain drop-shadow-[0_18px_18px_rgb(90_46_26/0.3)]"
      style={{ originY: 1, rotate, x }}
      whileHover={{ y: -16, scale: 1.05 }}
      transition={spring.pop}
    />
  )
}

/** One flipping digit: the new number swings down over the old one like a split-flap */
function Digit({ ch }: { ch: string }) {
  return (
    <span className="relative grid h-[min(17vh,10vw)] w-[min(12vh,7vw)] place-items-center overflow-hidden rounded-[2vh] bg-brown text-cream shadow-[0_1vh_0_#3a1c0f] [perspective:600px]">
      {/* hinge line */}
      <span className="pointer-events-none absolute inset-x-0 top-1/2 z-10 h-px bg-black/25" />
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={ch}
          className="font-display text-[min(13vh,7.5vw)] font-bold leading-none tabular-nums"
          style={{ originY: 0.5 }}
          initial={{ rotateX: -95, y: '-20%', opacity: 0 }}
          animate={{ rotateX: 0, y: '0%', opacity: 1 }}
          exit={{ rotateX: 95, y: '20%', opacity: 0 }}
          transition={{ type: 'spring', stiffness: 380, damping: 22 }}
        >
          {ch}
        </motion.span>
      </AnimatePresence>
    </span>
  )
}

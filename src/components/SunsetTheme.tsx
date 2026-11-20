import { useEffect, useMemo, useRef } from 'react'
import { usePath } from '../lib/nav'
import { motion, useReducedMotion, useSpring, useTransform, type MotionValue } from 'motion/react'
import { useMenu } from '../hooks/useMenu'
import { useLite } from '../lib/perf'

/*
 * "Neon Sunset" — the optional look for the screens customers see (menu, /cashier, /link), picked on
 * /config and followed by every device. The palette turns to dusk (index.css); over the page it lays:
 *
 *   BEHIND the page: a dusk sky, the sun glowing (canvas), two backlit palms standing in it
 *   OVER the page, the way a camera sees a low sun (canvas, every frame):
 *       core       — the sun's hot glow spilling over whatever stands in front of it
 *       god rays   — beams fanning out of it, flickering as the palm leaves move in the wind
 *       anamorphic — the long horizontal streak cinema lenses make
 *       ghosts     — lens-flare reflections on the line from the sun through the screen centre
 *                    (that's where a real lens puts them), some hexagonal like aperture blades
 *       dust       — specks drifting on the wind that only light up inside a beam
 *     The sun stays in the top-right corner. The pointer is a hand in the light: a beam stops at it
 *     and leaves a shadow behind, the hand glows where light hits it, and the lens ghosts swing with
 *     it like a camera panning. A tap is a flare (+80 %, settling back). Idle → the hand fades out.
 *
 * Physics: one springy "wind" value moves trees, rays and dust. The pointer's speed pushes it, a tap
 * is a gust, a breeze comes every few seconds so the booth screen lives on its own. Nothing takes
 * taps (pointer-events off); prefers-reduced-motion gets one still frame, and so does a lite phone
 * (lib/perf.ts) — which also skips the lens layer, a full-screen blend over the scrolling page.
 */

const PATHS = ['', '/link', '/cashier']

export function ThemeHost() {
  const { theme } = useMenu()
  const path = usePath()
  const on = theme === 'sunset' && PATHS.includes(path)
  useEffect(() => {
    if (!on) return
    document.documentElement.dataset.theme = 'sunset'
    return () => void delete document.documentElement.dataset.theme
  }, [on])
  return on ? <SunsetScene calm={path === '/cashier'} /> : null
}

function SunsetScene({ calm }: { calm: boolean }) {
  const lite = useLite()
  const still = !!useReducedMotion() || lite
  // the wind: -1 (blowing left) … 1 (right); a loose spring, so it overshoots and settles like air
  const wind = useSpring(0, { stiffness: 30, damping: 5, mass: 1.2 })
  // the pointer (0…1) and when it last moved — it casts a shadow through the beams while it's there
  const pointer = useRef<Pointer>({ x: 0.5, y: 0.5, at: 0, burst: 0 })
  const back = useRef<HTMLCanvasElement>(null)
  const front = useRef<HTMLCanvasElement>(null)
  useLight(back, front, wind, pointer, still, calm)

  useEffect(() => {
    if (still) return
    let lastX = 0
    let lastT = 0
    let calmT = 0
    const move = (e: PointerEvent) => {
      const now = performance.now()
      const v = lastT ? (e.clientX - lastX) / Math.max(16, now - lastT) : 0 // px per ms
      lastX = e.clientX
      lastT = now
      pointer.current = { ...pointer.current, x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, at: now }
      wind.set(Math.max(-1, Math.min(1, v * 0.9)))
      window.clearTimeout(calmT)
      calmT = window.setTimeout(() => wind.set(0), 160)
    }
    const gust = (e: PointerEvent) => {
      // a tap: the lens catches the sun — a flare that settles back (and a gust for the palms)
      pointer.current = { ...pointer.current, x: e.clientX / window.innerWidth, y: e.clientY / window.innerHeight, at: performance.now(), burst: performance.now() }
      wind.set(e.clientX < window.innerWidth / 2 ? 0.8 : -0.8)
      window.setTimeout(() => wind.set(0), 220)
    }
    const breeze = window.setInterval(() => {
      wind.set((Math.random() - 0.5) * 0.8)
      window.setTimeout(() => wind.set(0), 900)
    }, 4200)
    window.addEventListener('pointermove', move, { passive: true })
    window.addEventListener('pointerdown', gust, { passive: true })
    return () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerdown', gust)
      window.clearInterval(breeze)
      window.clearTimeout(calmT)
    }
  }, [still, wind])

  return (
    <>
      {/* behind the page: the sky, the sun glowing through, and the palms standing in it */}
      <div aria-hidden className={`pointer-events-none fixed inset-0 -z-10 overflow-hidden ${calm ? 'sunset-calm' : ''}`}>
        <div className="sunset-sky absolute inset-0" />
        <canvas ref={back} className="absolute inset-0 h-full w-full" />
        <Palm wind={wind} still={still} className="sunset-tree-left" give={1} />
        <Palm wind={wind} still={still} className="sunset-tree-right" give={0.8} flip />
      </div>
      {/* over the page: only what light does to a lens and the air — beams, streak, ghosts, dust.
          No haze over everything: shadows stay dark, so the light reads as light */}
      <div aria-hidden className={`pointer-events-none fixed inset-0 z-[5] overflow-hidden ${calm ? 'opacity-50' : ''} ${lite ? 'hidden' : ''}`}>
        <canvas ref={front} className="sunset-light absolute inset-0 h-full w-full" />
        <div className="sunset-grain absolute inset-0" />
      </div>
    </>
  )
}

/* ------------------------------------------------------------------ light */

type Mote = { x: number; y: number; vx: number; vy: number; r: number; p: number }
type Canvas = { current: HTMLCanvasElement | null }
type Pointer = { x: number; y: number; at: number; burst: number }
const RAYS = 13
// direction of ray i (radians, 0 = right): fanned down-left out of a top-right sun, drifting slowly
const rayAngle = (i: number, t: number) => 0.42 * Math.PI + (i / (RAYS - 1)) * 0.62 * Math.PI + Math.sin(t * 0.00013 + i) * 0.03
// leaves crossing the sun: each ray dims and brightens on its own, faster when it's windy
const flicker = (i: number, t: number, w: number) => 0.55 + 0.25 * Math.sin(t * 0.0011 * (1 + Math.abs(w) * 3) + i * 1.7) + 0.2 * Math.sin(t * 0.0023 + i * 4.1)

function useLight(backRef: Canvas, frontRef: Canvas, wind: MotionValue<number>, pointer: { current: Pointer }, still: boolean, calm: boolean) {
  useEffect(() => {
    const backC = backRef.current!
    const frontC = frontRef.current!
    const bctx = backC.getContext('2d')!
    const fctx = frontC.getContext('2d')!
    // light is soft: drawn at half size and stretched — free blur, and cheap on a phone
    const scale = 0.5
    let W = 0
    let H = 0
    const fit = () => {
      W = window.innerWidth
      H = window.innerHeight
      for (const [c, x] of [
        [backC, bctx],
        [frontC, fctx],
      ] as const) {
        c.width = Math.round(W * scale)
        c.height = Math.round(H * scale)
        x.setTransform(scale, 0, 0, scale, 0, 0)
      }
    }
    fit()
    window.addEventListener('resize', fit)

    const motes: Mote[] = Array.from({ length: calm ? 26 : 60 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vx: 0,
      vy: 0,
      r: 1 + Math.random() * 2.4,
      p: Math.random() * Math.PI * 2,
    }))
    // the sun stays in the top-right corner; the "camera" (the lens ghosts) pans with the pointer
    const SUN = { x: 0.95, y: -0.02 }
    const cam = { x: 0.5, y: 0.5, vx: 0, vy: 0 }
    // the hand in the light: fades in while the pointer moves, out ~3 s after it stops
    let hand = 0
    let raf = 0
    const start = performance.now()

    const beamsAt = (ang: number, t: number, w: number) => {
      let b = 0
      for (let i = 0; i < RAYS; i++) {
        const d = Math.abs(ang - rayAngle(i, t))
        if (d < 0.05) b += (1 - d / 0.05) * flicker(i, t, w)
      }
      return Math.min(1, b)
    }

    const frame = (now: number) => {
      const t = now - start
      const w = wind.get()
      const P = pointer.current
      const sx = SUN.x * W
      const sy = SUN.y * H
      const R = Math.hypot(W, H)
      const pulse = 1 + 0.04 * Math.sin(t * 0.0015) // the sun breathes a little
      // tap flare: jumps to +80 %, settles back over ~1.2 s
      const since = now - P.burst
      const flare = P.burst && since < 1400 ? 1 + 0.8 * Math.exp(-since / 320) : 1
      hand += ((now - P.at < 3000 ? 1 : 0) - hand) * 0.06
      const hx = P.x * W
      const hy = P.y * H
      const hAng = Math.atan2(hy - sy, hx - sx)
      const hDist = Math.hypot(hx - sx, hy - sy)
      // the camera eases after the pointer (a spring), dragging the ghosts' line with it
      const tx = 0.5 + (P.x - 0.5) * 0.8 * hand
      const ty = 0.5 + (P.y - 0.5) * 0.8 * hand
      cam.vx = (cam.vx + (tx - cam.x) * 0.03) * 0.85
      cam.vy = (cam.vy + (ty - cam.y) * 0.03) * 0.85
      cam.x += cam.vx
      cam.y += cam.vy

      /* ---- behind the page: the sun and its glow, lighting the sky behind the trees */
      bctx.clearRect(0, 0, W, H)
      bctx.globalCompositeOperation = 'lighter'
      let g = bctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.75)
      g.addColorStop(0, 'rgba(255,250,235,1)')
      g.addColorStop(0.035 * pulse, 'rgba(255,236,190,0.95)')
      g.addColorStop(0.08, `rgba(255,170,100,${Math.min(1, 0.6 * flare)})`)
      g.addColorStop(0.22, 'rgba(255,100,90,0.32)')
      g.addColorStop(0.45, 'rgba(220,60,140,0.14)')
      g.addColorStop(1, 'rgba(120,40,160,0)')
      bctx.fillStyle = g
      bctx.fillRect(0, 0, W, H)

      /* ---- over the page */
      fctx.clearRect(0, 0, W, H)
      fctx.globalCompositeOperation = 'lighter'

      // the sun's hot core spilling over whatever is in front of it
      g = fctx.createRadialGradient(sx, sy, 0, sx, sy, R * 0.16)
      g.addColorStop(0, `rgba(255,248,225,${Math.min(1, 0.9 * flare)})`)
      g.addColorStop(0.3, `rgba(255,200,140,${0.35 * flare})`)
      g.addColorStop(1, 'rgba(255,140,100,0)')
      fctx.fillStyle = g
      fctx.fillRect(0, 0, W, H)

      // god rays: wedges out of the sun, bright at the root, fading down the screen
      for (let i = 0; i < RAYS; i++) {
        const a = rayAngle(i, t)
        const spread = 0.016 + (i % 3) * 0.012
        const len = R * (0.7 + (i % 4) * 0.13)
        const k = flicker(i, t, w) * flare
        // the hand in this beam: light stops at it, a faint remainder leaks round the edges
        const blocked = hand > 0.05 && Math.abs(hAng - a) < spread + 0.012 && hDist < len
        if (blocked) {
          fctx.save()
          fctx.beginPath()
          fctx.arc(sx, sy, hDist, 0, Math.PI * 2)
          fctx.clip()
        }
        g = fctx.createRadialGradient(sx, sy, 0, sx, sy, len)
        g.addColorStop(0, `rgba(255,236,200,${0.55 * k})`)
        g.addColorStop(0.25, `rgba(255,190,130,${0.28 * k})`)
        g.addColorStop(0.65, `rgba(255,130,140,${0.08 * k})`)
        g.addColorStop(1, 'rgba(255,120,160,0)')
        fctx.fillStyle = g
        const beam = new Path2D()
        beam.moveTo(sx, sy)
        beam.lineTo(sx + Math.cos(a - spread) * len, sy + Math.sin(a - spread) * len)
        beam.lineTo(sx + Math.cos(a + spread) * len, sy + Math.sin(a + spread) * len)
        beam.closePath()
        fctx.fill(beam)
        if (blocked) {
          fctx.restore()
          // past the hand: only a dim leak, so the shadow fades back in as the hand moves away
          fctx.save()
          fctx.globalAlpha = 1 - hand * 0.8
          fctx.beginPath()
          fctx.rect(0, 0, W, H)
          fctx.arc(sx, sy, hDist, 0, Math.PI * 2, true)
          fctx.clip('evenodd')
          fctx.fill(beam)
          fctx.restore()
        }
      }

      // light falling on the hand: a warm glow where it stands in a beam
      const onHand = hand * beamsAt(hAng, t, w)
      if (onHand > 0.02) {
        g = fctx.createRadialGradient(hx, hy, 0, hx, hy, 90)
        g.addColorStop(0, `rgba(255,220,170,${0.5 * onHand})`)
        g.addColorStop(1, 'rgba(255,160,120,0)')
        fctx.fillStyle = g
        fctx.fillRect(hx - 90, hy - 90, 180, 180)
      }

      // anamorphic streak: a long, flat blue-white line through the sun
      fctx.save()
      fctx.translate(sx, sy)
      fctx.scale(1, 0.022)
      g = fctx.createRadialGradient(0, 0, 0, 0, 0, W * 0.8)
      g.addColorStop(0, `rgba(255,250,255,${Math.min(1, 0.85 * flare)})`)
      g.addColorStop(0.25, 'rgba(180,170,255,0.35)')
      g.addColorStop(1, 'rgba(120,120,255,0)')
      fctx.fillStyle = g
      fctx.fillRect(-W, -W * 0.8, W * 2, W * 1.6)
      fctx.restore()

      // lens ghosts: on the line sun → lens centre → beyond, the way a real lens reflects;
      // the lens centre is where the "camera" points, so they swing as the pointer moves
      const cx = cam.x * W
      const cy = cam.y * H
      const ghosts: Array<[number, number, string, boolean]> = [
        [0.3, 0.03, '255,170,90', false],
        [0.55, 0.016, '120,230,255', true],
        [0.8, 0.055, '255,90,170', false],
        [1.15, 0.026, '190,140,255', true],
        [1.4, 0.08, '255,190,120', false],
        [1.75, 0.036, '90,255,210', true],
      ]
      for (const [d, size, rgb, hex] of ghosts) {
        const gx = sx + (cx - sx) * d
        const gy = sy + (cy - sy) * d
        const r = size * Math.min(W, H) * 2
        g = fctx.createRadialGradient(gx, gy, r * 0.2, gx, gy, r)
        g.addColorStop(0, `rgba(${rgb},0.03)`)
        g.addColorStop(0.75, `rgba(${rgb},${(hex ? 0.22 : 0.14) * flare})`)
        g.addColorStop(1, `rgba(${rgb},0)`)
        fctx.fillStyle = g
        fctx.beginPath()
        if (hex)
          for (let k = 0; k < 6; k++) {
            const ang = (k / 6) * Math.PI * 2 + 0.3
            fctx[k ? 'lineTo' : 'moveTo'](gx + Math.cos(ang) * r, gy + Math.sin(ang) * r)
          }
        else fctx.arc(gx, gy, r, 0, Math.PI * 2)
        fctx.closePath()
        fctx.fill()
      }

      // dust: drifts on the wind and rises a touch; glints only where a beam passes
      for (const m of motes) {
        if (!still) {
          m.vx = (m.vx + w * 0.00004 + (Math.random() - 0.5) * 0.00002) * 0.985
          m.vy = (m.vy - 0.000004 + (Math.random() - 0.5) * 0.00002) * 0.985
          m.x = (m.x + m.vx + 1) % 1
          m.y = (m.y + m.vy + 1) % 1
        }
        const px = m.x * W
        const py = m.y * H
        const lit = beamsAt(Math.atan2(py - sy, px - sx), t, w)
        const a = (0.05 + lit * 0.9) * (0.6 + 0.4 * Math.sin(t * 0.003 + m.p))
        fctx.fillStyle = `rgba(255,240,210,${a})`
        fctx.beginPath()
        fctx.arc(px, py, m.r * (1 + lit * 1.5), 0, Math.PI * 2)
        fctx.fill()
      }

      if (!still) raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', fit)
    }
  }, [backRef, frontRef, wind, pointer, still, calm])
}

/* ------------------------------------------------------------------ palm trees */

// a frond's spine: out from the crown, arching up and drooping down at the tip
const SPINE: [number, number][] = [
  [0, 0],
  [70, -60],
  [160, -50],
  [215, 40],
]
const bez = (t: number, i: 0 | 1) => {
  const u = 1 - t
  return u * u * u * SPINE[0][i] + 3 * u * u * t * SPINE[1][i] + 3 * u * t * t * SPINE[2][i] + t * t * t * SPINE[3][i]
}
/** one feathery frond: the spine + leaflets hanging off both sides, longest in the middle */
function frondPath() {
  let d = `M0 0 C ${SPINE[1].join(' ')}, ${SPINE[2].join(' ')}, ${SPINE[3].join(' ')} L ${SPINE[3][0] - 3} ${SPINE[3][1] - 4} C ${SPINE[2][0] - 2} ${SPINE[2][1] - 6}, ${SPINE[1][0]} ${SPINE[1][1] - 6}, 0 -5 Z`
  for (let t = 0.07; t < 0.97; t += 0.038) {
    const x = bez(t, 0)
    const y = bez(t, 1)
    const dx = bez(t + 0.01, 0) - x
    const dy = bez(t + 0.01, 1) - y
    const l = Math.hypot(dx, dy)
    const tx = dx / l
    const ty = dy / l
    const nx = -ty // the side below the spine
    const ny = tx
    const len = 58 * Math.sin(Math.PI * Math.min(1, t * 1.15)) ** 0.6 + 8
    const w = 3.2
    for (const [side, droop] of [
      [1, 0.9],
      [-1, 0.35],
    ] as const) {
      // leaflets sweep forward and hang down (gravity), the upper row less
      const ex = x + (nx * side * 0.55 + tx * 0.55) * len + 0
      const ey = y + (ny * side * 0.55 + ty * 0.55) * len + droop * len * 0.55
      d += ` M${(x - tx * w).toFixed(1)} ${(y - ty * w).toFixed(1)} Q ${((x + ex) / 2 + nx * side * 4).toFixed(1)} ${((y + ey) / 2 - 6).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)} L ${(x + tx * w).toFixed(1)} ${(y + ty * w).toFixed(1)} Z`
    }
  }
  return d
}
// around the crown: [angle, mirrored (droops the other way), size]
const FRONDS: Array<[number, boolean, number]> = [
  [-8, false, 1],
  [22, false, 0.92],
  [-40, false, 0.95],
  [-72, false, 0.75],
  [-8, true, 1],
  [24, true, 0.9],
  [-42, true, 0.95],
  [-74, true, 0.72],
  [52, false, 0.7],
  [54, true, 0.68],
]

function Palm({ wind, still, className, give, flip = false }: { wind: MotionValue<number>; still: boolean; className: string; give: number; flip?: boolean }) {
  const frond = useMemo(frondPath, [])
  const id = flip ? 'r' : 'l'
  // the whole tree leans with the wind, rooted at the bottom
  const lean = useTransform(wind, (w) => (flip ? -w : w) * 1.6 * give)
  return (
    <div className={`sunset-tree absolute ${className}`}>
      <motion.div className={`h-full w-full origin-bottom ${still ? '' : 'sunset-sway'}`} style={{ rotate: still ? 0 : lean, animationDuration: `${6 + give * 2}s` }}>
        <svg viewBox="0 0 400 800" className="h-full w-full overflow-visible">
          <defs>
            {/* backlit: dark, with a warm rim on the side facing the sun */}
            <linearGradient id={`trunk-${id}`} x1="0" x2="1">
              <stop offset="0" stopColor="#09040b" />
              <stop offset="0.62" stopColor="#0f0712" />
              <stop offset="0.88" stopColor="#5a2430" />
              <stop offset="1" stopColor="#ffa15c" />
            </linearGradient>
          </defs>
          {/* a curved trunk, wide at the root, leaning out of the screen */}
          <path d="M250 800 C 250 640, 200 430, 120 215 L 138 208 C 222 420, 280 630, 290 800 Z" fill={`url(#trunk-${id})`} />
          {Array.from({ length: 22 }, (_, i) => {
            const t = i / 22
            const y = 800 - t * 590
            const x = 268 - t * t * 140 - t * 10
            const half = 20 - t * 10
            return <path key={i} d={`M${x - half} ${y} q ${half} ${-5 + t * 2} ${half * 2} -2`} stroke="#000" strokeWidth={2.2 - t} fill="none" opacity="0.8" />
          })}
          <g transform="translate(128 210)" fill="#0b050d">
            {FRONDS.map(([a, m, s], i) => (
              <Frond key={i} d={frond} wind={wind} angle={a} mirror={m} size={s} give={give * (0.7 + (i % 3) * 0.2)} still={still} flip={flip} />
            ))}
            {/* coconuts */}
            <circle cx="-8" cy="14" r="11" />
            <circle cx="9" cy="16" r="10" />
            <circle cx="0" cy="26" r="9.5" />
            <circle cx="0" cy="0" r="13" />
          </g>
        </svg>
      </motion.div>
    </div>
  )
}

function Frond({ d, wind, angle, mirror, size, give, still, flip }: { d: string; wind: MotionValue<number>; angle: number; mirror: boolean; size: number; give: number; still: boolean; flip: boolean }) {
  // set straight on the SVG attribute: it pivots exactly at the crown, no re-render per frame
  const ref = useRef<SVGGElement>(null)
  useEffect(() => {
    const transform = (w: number) => {
      // a mirrored frond bends the other way in its own space; the right tree is mirrored as a whole
      const bend = still ? 0 : (mirror ? -1 : 1) * (flip ? -1 : 1) * w * 12 * give
      return `scale(${mirror ? -size : size} ${size}) rotate(${angle + bend})`
    }
    const set = (w: number) => ref.current?.setAttribute('transform', transform(w))
    set(wind.get())
    return still ? undefined : wind.on('change', set)
  }, [wind, angle, mirror, size, give, still, flip])
  return (
    <g ref={ref}>
      <path d={d} />
    </g>
  )
}

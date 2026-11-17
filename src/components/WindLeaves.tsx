import { useEffect, useRef } from 'react'
import type { MotionValue } from 'motion/react'

/**
 * Leaves blown around by a simulated wind — no keyframes, nothing loops.
 *
 * Each leaf is a little rigid body: gravity pulls it down, air drag pulls it toward the local
 * wind, and an aerodynamic lift/torque pair (the falling-paper model) makes it flutter, glide
 * and tumble. The wind itself is layered noise that never repeats, plus random events: gusts,
 * a whirlwind that spins leaves up, and the visitor's cursor stirring the air. Leaves that
 * reach the ground settle there until a strong enough gust picks them up and moves them.
 */

const LEAF = new Path2D('M2 40 C 0 21 11 5 31 0 C 32 19 22 36 2 40 Z')
const VEIN = new Path2D('M6.5 33 C 10 23.5 16 14.5 23.5 8')
const PALETTE = [
  ['#5e7b3a', '#4a632c'],
  ['#8faa4f', '#72893d'],
  ['#a3b860', '#86994a'],
  ['#6f8c3f', '#566e30'],
  ['#c98a3c', '#a26e2c'], // the odd dry one
]

interface Leaf {
  x: number
  y: number
  vx: number
  vy: number
  a: number // in-plane angle
  w: number // angular velocity
  roll: number // spin around its own spine, fakes the 3D flip
  size: number
  mass: number
  grip: number // wind speed needed to lift it once it has landed
  color: number
  resting: boolean
}

/* ---- tiny 1D/2D value noise: smooth, cheap, aperiodic enough at these scales */
const hash = (n: number) => {
  const s = Math.sin(n * 127.1) * 43758.5453
  return s - Math.floor(s)
}
const smooth = (t: number) => t * t * (3 - 2 * t)
const noise1 = (x: number) => {
  const i = Math.floor(x)
  const f = smooth(x - i)
  return hash(i) * (1 - f) + hash(i + 1) * f
}
const noise2 = (x: number, y: number) => {
  const ix = Math.floor(x)
  const iy = Math.floor(y)
  const fx = smooth(x - ix)
  const fy = smooth(y - iy)
  const h = (a: number, b: number) => hash(a * 57 + b * 131)
  const top = h(ix, iy) * (1 - fx) + h(ix + 1, iy) * fx
  const bot = h(ix, iy + 1) * (1 - fx) + h(ix + 1, iy + 1) * fx
  return top * (1 - fy) + bot * fy
}
const rand = (a: number, b: number) => a + Math.random() * (b - a)

export interface WindLeavesProps {
  count?: number
  /** overall leaf opacity */
  opacity?: number
  /** size range in px (leaf height) */
  size?: [number, number]
  /** mean wind written here every frame, so other things (cups, frame leaves) can lean into it */
  wind?: MotionValue<number>
  className?: string
}

export function WindLeaves({ count = 34, opacity = 0.85, size = [16, 30], wind, className = '' }: WindLeavesProps) {
  const ref = useRef<HTMLCanvasElement>(null)
  const [minS, maxS] = size

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let W = 0
    let H = 0
    const resize = () => {
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const spawn = (anywhere: boolean, fromLeft = true): Leaf => {
      const s = rand(minS, maxS)
      return {
        x: anywhere ? rand(0, W) : fromLeft ? -40 : W + 40,
        y: anywhere ? rand(-H * 0.2, H * 0.9) : rand(-H * 0.1, H * 0.6),
        vx: rand(-20, 20),
        vy: rand(-10, 30),
        a: rand(0, Math.PI * 2),
        w: rand(-2, 2),
        roll: rand(0, Math.PI * 2),
        size: s,
        mass: s / 22,
        grip: rand(70, 190),
        color: Math.random() < 0.12 ? 4 : Math.floor(rand(0, 4)),
        resting: false,
      }
    }
    const leaves: Leaf[] = Array.from({ length: reduced ? Math.ceil(count / 3) : count }, () => spawn(true))

    /* ---- random weather events */
    let gust = { until: 0, dir: 1, power: 0 } // seconds-based, eased
    let nextGust = rand(3, 7)
    let vortex: { x: number; y: number; until: number; r: number; spin: number } | null = null
    let nextVortex = rand(12, 22)

    /* ---- the visitor stirs the air */
    const ptr = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0 }
    const onMove = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      const now = performance.now()
      const dt = Math.max(16, now - ptr.t) / 1000
      ptr.vx = ptr.vx * 0.5 + ((x - ptr.x) / dt) * 0.5
      ptr.vy = ptr.vy * 0.5 + ((y - ptr.y) / dt) * 0.5
      ptr.x = x
      ptr.y = y
      ptr.t = now
    }
    window.addEventListener('pointermove', onMove)

    let t = 0
    let last = performance.now()
    let raf = 0

    const windAt = (x: number, y: number, base: number, gustNow: number) => {
      // large slow swells + a finer turbulent layer that varies across the screen
      let wx = base + gustNow + (noise2(x * 0.0025 + t * 0.15, y * 0.003) - 0.5) * 70
      let wy = (noise2(x * 0.003 - t * 0.2, y * 0.0025 + 40) - 0.5) * 50
      if (vortex) {
        const dx = x - vortex.x
        const dy = y - vortex.y
        const d = Math.hypot(dx, dy) + 1
        const fall = Math.exp(-((d / vortex.r) ** 2))
        const life = Math.min(1, (vortex.until - t) / 1.2)
        // tangential swirl + an updraft at its core
        wx += (-dy / d) * vortex.spin * fall * life
        wy += (dx / d) * vortex.spin * fall * life - 120 * fall * life
      }
      const pd = Math.hypot(x - ptr.x, y - ptr.y)
      if (pd < 160 && performance.now() - ptr.t < 120) {
        const k = (1 - pd / 160) ** 2 * 0.9
        wx += ptr.vx * k
        wy += ptr.vy * k
      }
      return [wx, wy] as const
    }

    const step = (dt: number) => {
      t += dt
      // wind swells over ~10–30s, never quite repeating
      const base = (noise1(t * 0.07) - 0.42) * 90 + (noise1(t * 0.23 + 9) - 0.5) * 40

      if (t > nextGust) {
        gust = { until: t + rand(1.8, 3.6), dir: Math.random() < 0.78 ? 1 : -1, power: rand(160, 340) }
        nextGust = gust.until + rand(5, 12)
      }
      const gLeft = gust.until - t
      const gustNow = gLeft > 0 ? gust.dir * gust.power * Math.sin(Math.min(1, gLeft / 3.6) * Math.PI) : 0

      if (!vortex && t > nextVortex) {
        vortex = { x: rand(W * 0.2, W * 0.8), y: rand(H * 0.55, H * 0.9), until: t + rand(3, 5), r: rand(120, 200), spin: rand(180, 280) * (Math.random() < 0.5 ? -1 : 1) }
      }
      if (vortex) {
        vortex.x += (base + gustNow) * 0.25 * dt // it drifts with the weather
        if (t > vortex.until) {
          vortex = null
          nextVortex = t + rand(14, 26)
        }
      }
      wind?.set(base + gustNow)

      const ground = H - 6
      for (const l of leaves) {
        const [wx, wy] = windAt(l.x, l.y, base, gustNow)

        if (l.resting) {
          // a landed leaf only goes when the air beats its grip — then it hops up and away
          if (Math.hypot(wx, wy * 1.5) > l.grip || wy < -90) {
            l.resting = false
            l.vy = -rand(60, 140)
            l.vx = wx * 0.6
            l.w = rand(-6, 6)
          } else {
            l.vx *= 0.9
            l.x += l.vx * dt
            l.w += (Math.sin(t * 3 + l.x) * 0.3 * Math.abs(wx)) / 200
            l.w *= 0.85
            l.a += l.w * dt
            continue
          }
        }

        // relative air velocity
        const rx = wx - l.vx
        const ry = wy - l.vy
        const sp = Math.hypot(rx, ry) + 1e-3
        const phi = Math.atan2(ry, rx)
        const attack = Math.sin(2 * (l.a - phi))

        // drag toward the wind, lift sideways off the blade, gravity down
        const drag = 0.018 * sp
        let ax = (rx * drag) / l.mass
        let ay = (ry * drag) / l.mass + 70
        const lift = (0.006 * sp * sp * attack) / l.mass
        ax += (-ry / sp) * lift
        ay += (rx / sp) * lift

        // torque from the pressure centre sitting off the leaf's middle → flutter & tumble
        const torque = -0.0009 * sp * sp * attack - 1.6 * l.w + (noise1(t * 1.7 + l.size) - 0.5) * 2.4
        l.w += (torque / l.mass) * dt
        l.vx += ax * dt
        l.vy += ay * dt
        l.x += l.vx * dt
        l.y += l.vy * dt
        l.a += l.w * dt
        l.roll += (1.2 + Math.abs(l.w) * 0.6) * dt

        // landing
        if (l.y > ground) {
          l.y = ground
          if (l.vy > 0) l.vy *= -0.15
          l.vx *= 0.6
          if (Math.abs(l.vy) < 25) {
            l.resting = true
            l.vy = 0
            l.a = Math.round(l.a / Math.PI) * Math.PI + rand(-0.4, 0.4) // lies flat-ish
          }
        }
        // blown off screen → a new one rides in from upwind
        if (l.x < -80 || l.x > W + 80 || l.y < -H * 0.6) {
          Object.assign(l, spawn(false, base + gustNow >= 0))
        }
      }
    }

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      ctx.globalAlpha = opacity
      for (const l of leaves) {
        const flip = Math.cos(l.roll) // edge-on when 0, underside when negative
        const [face, back] = PALETTE[l.color]
        ctx.save()
        ctx.translate(l.x, l.y)
        ctx.rotate(l.a)
        ctx.scale((l.size / 41) * (0.25 + 0.75 * Math.abs(flip)) * Math.sign(flip || 1), l.size / 41)
        ctx.translate(-16, -20)
        ctx.fillStyle = flip >= 0 ? face : back
        ctx.fill(LEAF)
        ctx.strokeStyle = 'rgba(245,235,221,0.75)'
        ctx.lineWidth = 1.4
        ctx.lineCap = 'round'
        ctx.stroke(VEIN)
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }

    // let the scene settle so it doesn't start as a uniform spray
    for (let i = 0; i < 90; i++) step(1 / 30)

    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      step(dt)
      draw()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame((n) => {
      last = n
      loop(n)
    })

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointermove', onMove)
    }
  }, [count, opacity, minS, maxS, wind])

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />
}

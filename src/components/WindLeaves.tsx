import { useEffect, useRef } from 'react'
import type { MotionValue } from 'motion/react'

/**
 * Leaves blown around by a simulated wind — no keyframes, nothing loops.
 *
 * Each leaf is a little rigid body with a front and a back: gravity pulls it down, air drag pulls
 * it toward the local wind (more when it lies flat to the air, less edge-on), and an aerodynamic
 * lift/torque pair (the falling-paper model) makes it flutter, glide and tumble. It also spins
 * around its own spine (autorotation), which is what turns it over and makes it catch the light.
 *
 * The scene has depth: far leaves are smaller, fainter, slower and land higher up the "floor".
 * The weather is layered noise that never repeats, with calm spells and breezy ones; gusts roll
 * across the screen from the upwind side (you can watch the front pass), and now and then a
 * whirlwind lifts a few leaves. Landed leaves cast a soft shadow, tremble in the breeze, skitter
 * and hop along the ground in moderate wind, flip over, and only take off when a gust beats their
 * grip. If too many pile up, the oldest fade away and new ones drift in from the trees above.
 *
 * Visitors stir the air: a moving pointer or finger leaves a wake that lingers and spreads, a tap
 * puffs leaves away from it, and a fast scroll drags the air with the page. Nothing runs while the
 * canvas is off-screen or the tab is hidden.
 */

const LEAF = new Path2D('M2 40 C 0 21 11 5 31 0 C 32 19 22 36 2 40 Z')
const VEIN = new Path2D('M6.5 33 C 10 23.5 16 14.5 23.5 8')
const PALETTE = ['#5e7b3a', '#8faa4f', '#a3b860', '#6f8c3f', '#c98a3c' /* the odd dry one */]
const rgbOf = (hex: string) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number]

/** depth range: 0.6 = far back, 1.25 = close to the glass */
const Z_MIN = 0.6
const Z_MAX = 1.25
const G = 70
/** physics never steps more than this (s) — keeps the aero forces stable on a slow frame */
const MAX_STEP = 1 / 90

interface Leaf {
  x: number
  y: number
  vx: number
  vy: number
  a: number // in-plane angle
  w: number // angular velocity
  roll: number // turn around its own spine: 0 = face up, π = underside
  rw: number // roll velocity
  z: number // depth
  size: number
  mass: number
  grip: number // wind speed needed to lift it once it has landed
  face: [number, number, number]
  back: [number, number, number]
  phase: number // its own little offset in every noise it reads
  /** seconds on the ground, 0 = flying */
  rest: number
  /** the angle it settles to on the ground */
  restA: number
  /** 0…1, how hard the breeze is tugging it while it lies there (for the tremble) */
  tug: number
  /** 0…1 fade — recycled leaves fade out on the ground and fade in as they arrive */
  fade: number
  leaving: boolean
}

interface Puff {
  x: number
  y: number
  vx: number
  vy: number
  r: number
  life: number
  max: number
  /** wake = carries the pointer's motion · blast = pushes outward from a tap */
  blast: boolean
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
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

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
    /** reduced motion: a still, gentle breeze — no gusts, no whirlwinds */
    const calm = reduced ? 0.35 : 1
    const dpr = Math.min(window.devicePixelRatio || 1, 1.5)
    let W = 0
    let H = 0
    // the floor recedes: far leaves rest a little higher up the screen
    const groundAt = (z: number) => H - 5 - (Z_MAX - z) * 34
    const resize = () => {
      const oldH = H
      W = canvas.clientWidth
      H = canvas.clientHeight
      canvas.width = Math.round(W * dpr)
      canvas.height = Math.round(H * dpr)
      // the floor moved: whatever was lying on the old one drops (or is lifted) onto the new one
      if (oldH && oldH !== H) for (const l of leaves) if (l.rest) l.y = groundAt(l.z)
    }

    const spawn = (where: 'anywhere' | 'top' | 'left' | 'right'): Leaf => {
      const s = rand(minS, maxS)
      const z = rand(Z_MIN, Z_MAX)
      const dry = Math.random() < 0.12
      const [r, g, b] = rgbOf(dry ? PALETTE[4] : PALETTE[Math.floor(rand(0, 4))])
      // every leaf its own shade; the underside paler and a touch more yellow
      const j = rand(-14, 14)
      const face: [number, number, number] = [r + j, g + j, b + j * 0.5]
      const back: [number, number, number] = [r * 0.82 + 52, g * 0.82 + 50, b * 0.8 + 26]
      return {
        x: where === 'anywhere' || where === 'top' ? rand(-20, W + 20) : where === 'left' ? -40 : W + 40,
        y: where === 'anywhere' ? rand(-H * 0.2, H * 0.9) : where === 'top' ? rand(-60, -30) : rand(-H * 0.1, H * 0.55),
        vx: rand(-20, 20),
        vy: rand(-10, 30),
        a: rand(0, Math.PI * 2),
        w: rand(-2, 2),
        roll: rand(0, Math.PI * 2),
        rw: rand(-3, 3),
        z,
        size: s * z,
        mass: (s / 22) * rand(0.85, 1.15),
        grip: rand(70, 190) * (dry ? 0.75 : 1), // dry leaves are lighter on their feet
        face,
        back,
        phase: rand(0, 100),
        rest: 0,
        restA: 0,
        tug: 0,
        fade: where === 'anywhere' ? 1 : 0,
        leaving: false,
      }
    }
    const leaves: Leaf[] = []
    resize()
    for (let i = 0; i < (reduced ? Math.ceil(count / 3) : count); i++) leaves.push(spawn('anywhere'))
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    /* ---- random weather events */
    let gust = { start: -99, len: 0, dir: 1, power: 0 }
    let nextGust = rand(3, 7)
    let vortex: { x: number; y: number; until: number; r: number; spin: number } | null = null
    let nextVortex = rand(12, 22)
    /** how fast a gust front crosses the screen, px/s */
    const FRONT = 650

    /* ---- the visitor stirs the air */
    const puffs: Puff[] = []
    const ptr = { x: -1e4, y: -1e4, vx: 0, vy: 0, t: 0, lastPuff: 0 }
    const local = (e: PointerEvent) => {
      const r = canvas.getBoundingClientRect()
      return [e.clientX - r.left, e.clientY - r.top] as const
    }
    const addPuff = (p: Puff) => {
      if (puffs.length > 28) puffs.shift()
      puffs.push(p)
    }
    const onMove = (e: PointerEvent) => {
      const [x, y] = local(e)
      const now = performance.now()
      const dt = Math.max(16, now - ptr.t) / 1000
      // a fresh touch starts from rest, not from wherever the last one ended
      const jump = now - ptr.t > 200
      ptr.vx = jump ? 0 : ptr.vx * 0.5 + ((x - ptr.x) / dt) * 0.5
      ptr.vy = jump ? 0 : ptr.vy * 0.5 + ((y - ptr.y) / dt) * 0.5
      ptr.x = x
      ptr.y = y
      ptr.t = now
      // the wake: little parcels of moving air dropped along the path, which linger and spread
      const sp = Math.hypot(ptr.vx, ptr.vy)
      if (sp > 60 && now - ptr.lastPuff > 28 && x > -100 && x < W + 100 && y > -100 && y < H + 100) {
        ptr.lastPuff = now
        const k = Math.min(1, 900 / sp) * 0.85 // a frantic swipe doesn't become a hurricane
        addPuff({ x, y, vx: ptr.vx * k, vy: ptr.vy * k, r: 60, life: 0.7, max: 0.7, blast: false })
      }
    }
    const onDown = (e: PointerEvent) => {
      const [x, y] = local(e)
      if (x < 0 || x > W || y < 0 || y > H) return
      // a tap is a little puff of breath: leaves scatter from it, the ones on the ground jump
      addPuff({ x, y, vx: 0, vy: 0, r: 120, life: 0.45, max: 0.45, blast: true })
    }
    let scrollY = window.scrollY
    let scrollWind = 0
    const onScroll = () => {
      const y = window.scrollY
      // the page drags the air with it — a flick sends the leaves swirling the other way
      scrollWind = clamp(scrollWind + (scrollY - y) * 4, -400, 400)
      scrollY = y
    }
    window.addEventListener('pointermove', onMove, { passive: true })
    window.addEventListener('pointerdown', onDown, { passive: true })
    window.addEventListener('scroll', onScroll, { passive: true })

    let t = 0
    let base = 0
    let gustMid = 0

    const gustAt = (x: number) => {
      if (!gust.len) return 0
      // the front arrives from upwind: leaves on that side feel it first
      const delay = (gust.dir > 0 ? x + 200 : W + 200 - x) / FRONT
      const p = (t - gust.start - delay) / gust.len
      if (p <= 0 || p >= 1) return 0
      // sharp onset, long tail — how real gusts feel
      return gust.dir * gust.power * Math.sin(Math.PI * Math.pow(p, 0.6))
    }

    const windAt = (x: number, y: number, z: number) => {
      // large slow swells + a finer turbulent layer that varies across the screen (and by depth)
      let wx = base + gustAt(x) + (noise2(x * 0.0025 + t * 0.15, y * 0.003 + z * 3) - 0.5) * 70 * calm
      let wy = (noise2(x * 0.003 - t * 0.2, y * 0.0025 + 40 + z * 5) - 0.5) * 50 * calm + scrollWind
      if (vortex) {
        const dx = x - vortex.x
        const dy = y - vortex.y
        const d = Math.hypot(dx, dy) + 1
        const fall = Math.exp(-((d / vortex.r) ** 2))
        const life = Math.min(1, (vortex.until - t) / 1.2, (t - (vortex.until - 4)) / 0.8)
        // tangential swirl + an updraft at its core
        wx += (-dy / d) * vortex.spin * fall * life
        wy += (dx / d) * vortex.spin * fall * life - 120 * fall * life
      }
      for (const p of puffs) {
        const dx = x - p.x
        const dy = y - p.y
        const d2 = dx * dx + dy * dy
        if (d2 > p.r * p.r * 6) continue
        const k = Math.exp(-d2 / (p.r * p.r)) * (p.life / p.max)
        if (p.blast) {
          const d = Math.sqrt(d2) + 8
          wx += (dx / d) * 560 * k
          wy += (dy / d) * 560 * k - 160 * k
        } else {
          wx += p.vx * k
          wy += p.vy * k
        }
      }
      return [wx, wy] as const
    }

    const step = (dt: number) => {
      t += dt
      // calm spells and breezy spells, minutes apart; inside them the wind swells over ~10–30 s
      const mood = 0.35 + 0.9 * noise1(t * 0.025 + 3)
      base = ((noise1(t * 0.07) - 0.42) * 90 + (noise1(t * 0.23 + 9) - 0.5) * 40) * mood * calm

      if (!reduced && t > nextGust) {
        gust = { start: t, len: rand(1.8, 3.6), dir: Math.random() < 0.78 ? 1 : -1, power: rand(160, 340) * (0.6 + 0.5 * mood) }
        // calm spells get fewer gusts
        nextGust = t + gust.len + (W + 400) / FRONT + rand(5, 12) / mood
      }
      gustMid = gustAt(W / 2)

      if (!reduced && !vortex && t > nextVortex) {
        vortex = { x: rand(W * 0.2, W * 0.8), y: rand(H * 0.55, H * 0.9), until: t + rand(3, 5), r: rand(120, 200), spin: rand(180, 280) * (Math.random() < 0.5 ? -1 : 1) }
      }
      if (vortex) {
        vortex.x += (base + gustMid) * 0.25 * dt // it drifts with the weather
        if (t > vortex.until) {
          vortex = null
          nextVortex = t + rand(14, 26)
        }
      }
      for (let i = puffs.length - 1; i >= 0; i--) {
        const p = puffs[i]
        p.life -= dt
        if (p.life <= 0) {
          puffs.splice(i, 1)
          continue
        }
        // a parcel of air coasts, slows and spreads out
        p.x += p.vx * dt * 0.35
        p.y += p.vy * dt * 0.35
        p.vx *= Math.exp(-2.5 * dt)
        p.vy *= Math.exp(-2.5 * dt)
        p.r += (p.blast ? 260 : 90) * dt
      }
      scrollWind *= Math.exp(-5 * dt)
      wind?.set(base + gustMid)

      let resting = 0
      for (const l of leaves) if (l.rest) resting++
      // too many on the ground → the one that's lain there longest fades away (and comes back from the top)
      if (resting > leaves.length * 0.38) {
        let oldest: Leaf | null = null
        for (const l of leaves) if (l.rest && !l.leaving && (!oldest || l.rest > oldest.rest)) oldest = l
        if (oldest && oldest.rest > 6) oldest.leaving = true
      }

      for (const l of leaves) {
        if (l.leaving) {
          l.fade -= dt / 1.6
          if (l.fade <= 0) Object.assign(l, spawn('top'))
        } else if (l.fade < 1) l.fade = Math.min(1, l.fade + dt / 0.8)

        // far leaves feel the air and gravity less — parallax
        const zf = 0.45 + 0.55 * ((l.z - Z_MIN) / (Z_MAX - Z_MIN))
        const [wx0, wy0] = windAt(l.x, l.y, l.z)
        const wx = wx0 * zf
        const wy = wy0 * zf
        const ground = groundAt(l.z)

        if (l.rest) {
          l.rest += dt
          // near the floor the air is slower (boundary layer)
          const ws = Math.hypot(wx * 0.7, wy)
          l.tug = Math.min(1, ws / l.grip)
          if (!l.leaving && (ws > l.grip || wy < -90)) {
            // lifts off: it hops up and away, spinning
            l.rest = 0
            l.vy = -rand(60, 140) * zf
            l.vx = wx * 0.6
            l.w = rand(-6, 6)
            l.rw = rand(-10, 10)
            continue
          }
          if (Math.abs(wx) > l.grip * 0.45) {
            // skitter: dragged along the ground, with the odd little hop or cartwheel
            l.vx += (wx * 0.55 - l.vx) * 2.2 * dt
            if (Math.random() < dt * 1.2 * l.tug) {
              l.rest = 0
              l.vy = -rand(25, 55) * zf
              l.rw += Math.sign(wx) * rand(4, 9)
              continue
            }
            l.w += (Math.sign(wx) * l.tug * 2 - l.w) * 3 * dt
          } else {
            l.vx *= Math.exp(-6 * dt)
            // settle: lie flat at its angle, face up or face down
            l.w += (-(l.a - l.restA) * 18 - l.w * 5) * dt
          }
          const flat = Math.round(l.roll / Math.PI) * Math.PI
          l.rw += (-(l.roll - flat) * 30 - l.rw * 7) * dt
          l.x += l.vx * dt
          l.a += l.w * dt
          l.roll += l.rw * dt
          l.y = ground
          if (l.x < -80 || l.x > W + 80) Object.assign(l, spawn(base + gustMid >= 0 ? 'left' : 'right'))
          continue
        }

        // relative air velocity
        const rx = wx - l.vx
        const ry = wy - l.vy
        const sp = Math.hypot(rx, ry) + 1e-3
        const phi = Math.atan2(ry, rx)
        const attack = Math.sin(2 * (l.a - phi))
        // flat to the air it catches a lot, edge-on it slices through
        const area = 0.3 + 0.7 * Math.abs(Math.cos(l.roll))

        // drag toward the wind, lift sideways off the blade, gravity down
        const drag = 0.018 * sp * area
        let ax = (rx * drag) / l.mass
        let ay = (ry * drag) / l.mass + G * zf
        const lift = (0.006 * sp * sp * attack * area) / l.mass
        ax += (-ry / sp) * lift
        ay += (rx / sp) * lift

        // torque from the pressure centre sitting off the leaf's middle → flutter & tumble
        const torque = -0.0009 * sp * sp * attack * area - 1.6 * l.w + (noise1(t * 1.7 + l.phase) - 0.5) * 2.4
        l.w += (torque / l.mass) * dt
        // around its spine a falling leaf wants to lie broadside to the air (it rocks there like a
        // pendulum); turbulence knocks it over now and then, and a gust's rough air spins it over and over
        const rollTorque = -0.045 * sp * Math.sin(2 * l.roll) - 1.2 * l.rw + (noise1(t * 1.3 + l.phase * 2) - 0.5) * (8 + sp * 0.09) + l.w * 0.6
        l.rw = clamp(l.rw + (rollTorque / l.mass) * dt, -28, 28)
        l.vx = clamp(l.vx + ax * dt, -900, 900)
        l.vy = clamp(l.vy + ay * dt, -900, 900)
        l.x += l.vx * dt
        l.y += l.vy * dt
        l.a += l.w * dt
        l.roll += l.rw * dt

        // landing
        if (l.y > ground) {
          l.y = ground
          if (l.vy > 60) {
            // a hard landing bounces and knocks it round a bit
            l.vy *= -0.18
            l.w += l.vx * 0.02
            l.vx *= 0.6
          } else {
            l.rest = 1e-3
            l.vy = 0
            l.vx *= 0.5
            // lies flat-ish, a little askew — the nearer of its two flat angles
            l.restA = Math.round(l.a / Math.PI) * Math.PI + rand(-0.45, 0.45)
          }
        }
        // blown off screen → a new one rides in from upwind, or drops from the trees above
        if (l.x < -80 || l.x > W + 80 || l.y < -H * 0.6) {
          const w = base + gustMid
          Object.assign(l, spawn(Math.random() < 0.35 ? 'top' : w >= 0 ? 'left' : 'right'))
        }
      }
      // far ones first, so the near ones pass in front
      leaves.sort((a, b) => a.z - b.z)
    }

    const shade = (c: [number, number, number], k: number) => `rgb(${clamp(c[0] * k, 0, 255) | 0},${clamp(c[1] * k, 0, 255) | 0},${clamp(c[2] * k, 0, 255) | 0})`

    const draw = () => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)

      // soft contact shadows: they appear as a leaf comes down, darkest when it lies there
      for (const l of leaves) {
        const ground = groundAt(l.z)
        const d = ground - l.y
        if (d > 130) continue
        const near = 1 - d / 130
        const a = 0.16 * near * near * l.fade * opacity * (0.5 + 0.5 * (l.z - Z_MIN) / (Z_MAX - Z_MIN))
        const spread = 1 + (d / 130) * 0.8
        const wdt = l.size * 0.55 * (0.45 + 0.55 * Math.abs(Math.cos(l.roll))) * spread
        ctx.fillStyle = `rgba(48,30,14,${a * 0.55})`
        ctx.beginPath()
        ctx.ellipse(l.x + d * 0.08, ground + 3, wdt * 1.35, l.size * 0.12 * spread + 1.5, 0, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = `rgba(48,30,14,${a})`
        ctx.beginPath()
        ctx.ellipse(l.x + d * 0.08, ground + 3, wdt, l.size * 0.08 * spread + 1, 0, 0, Math.PI * 2)
        ctx.fill()
      }

      for (const l of leaves) {
        const n = Math.cos(l.roll) // edge-on when 0, underside when negative
        const up = n >= 0
        // depth haze: far leaves fainter
        ctx.globalAlpha = opacity * l.fade * (0.55 + 0.45 * ((l.z - Z_MIN) / (Z_MAX - Z_MIN)))
        // lying on the ground the tip trembles and lifts a little when the breeze tugs at it
        const tremble = l.rest ? l.tug * (0.5 + 0.5 * Math.sin(t * (9 + l.phase % 5) + l.phase)) : 0
        ctx.save()
        ctx.translate(l.x, l.y)
        ctx.rotate(l.a + tremble * 0.12)
        const k = l.size / 41
        ctx.scale(k * Math.max(0.07, Math.abs(n)) * (up ? 1 : -1), k * (1 - tremble * 0.2))
        ctx.translate(-16, -20)
        // light from above: face-on to it it's brightest, edge-on it darkens; the underside is matte
        const lit = 0.74 + 0.34 * Math.abs(n) * (up ? 1 : 0.75) + Math.sin(l.a) * 0.06
        ctx.fillStyle = shade(up ? l.face : l.back, lit)
        ctx.fill(LEAF)
        // the vein shows on the face; edge-on you can't see it
        ctx.strokeStyle = up ? `rgba(245,235,221,${0.35 + 0.45 * Math.abs(n)})` : `rgba(255,248,225,${0.25 + 0.3 * Math.abs(n)})`
        ctx.lineWidth = 1.4
        ctx.lineCap = 'round'
        ctx.stroke(VEIN)
        // a glint as it turns square-on to the light mid-flight
        if (!l.rest && up && n > 0.93) {
          ctx.fillStyle = `rgba(255,252,236,${(n - 0.93) * 4.5})`
          ctx.fill(LEAF)
        }
        ctx.restore()
      }
      ctx.globalAlpha = 1
    }

    // let the scene settle so it doesn't start as a uniform spray
    for (let i = 0; i < 270; i++) step(1 / 90)

    let raf = 0
    let last = 0
    let visible = true
    const loop = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      // fixed small steps keep the aero forces stable on a slow phone
      const n = Math.max(1, Math.ceil(dt / MAX_STEP))
      for (let i = 0; i < n; i++) step(dt / n)
      draw()
      raf = requestAnimationFrame(loop)
    }
    const start = () => {
      if (raf || !visible || document.visibilityState === 'hidden') return
      raf = requestAnimationFrame((n) => {
        last = n
        loop(n)
      })
    }
    const stop = () => {
      cancelAnimationFrame(raf)
      raf = 0
    }
    // off-screen or a hidden tab: nothing is drawn, no battery spent
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting
      if (visible) start()
      else stop()
    })
    io.observe(canvas)
    const onVis = () => (document.visibilityState === 'hidden' ? stop() : start())
    document.addEventListener('visibilitychange', onVis)
    draw()
    start()

    return () => {
      stop()
      ro.disconnect()
      io.disconnect()
      document.removeEventListener('visibilitychange', onVis)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onDown)
      window.removeEventListener('scroll', onScroll)
    }
  }, [count, opacity, minS, maxS, wind])

  return <canvas ref={ref} aria-hidden className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} />
}

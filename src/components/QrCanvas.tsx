import { useEffect, useMemo, useRef } from 'react'
import { encode } from 'uqr'
import { LEAF_BOX, LETTERS, LOGO_BOX, LOGO_BROWN, TAGLINE } from '../data/logo'
import { LEFT, LEFT_VEIN, RIGHT, RIGHT_VEIN, STEM } from './Sprout'

interface QrCanvasProps {
  value: string
  className?: string
}

const DARK = '#3b1d0e'
const DECO = '#5a2e1a'
const CREAM = '#f5ebdd'
const QUIET = 3
const ENTRANCE = 1.5 // s
const POSITION = 2 // uqr QrCodeDataType.Position

const easeOutBack = (t: number) => {
  const c = 1.9
  return 1 + (c + 1) * (t - 1) ** 3 + c * (t - 1) ** 2
}
const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function hash(x: number, y: number) {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function roundRect(ctx: CanvasRenderingContext2D | Path2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/** Draws the traced vector logo centred at (0,0), `width` px wide — crisp at any QR size */
function drawLogo(ctx: CanvasRenderingContext2D, width: number) {
  const k = width / LOGO_BOX.w
  ctx.save()
  ctx.translate(-width / 2, (-LOGO_BOX.h * k) / 2)
  ctx.fillStyle = LOGO_BROWN
  for (const p of [...LETTERS, TAGLINE]) {
    ctx.save()
    ctx.translate((p.x - LOGO_BOX.x) * k, (p.y - LOGO_BOX.y) * k)
    ctx.scale((p.w * k) / p.vw, (p.h * k) / p.vh)
    ctx.fill(new Path2D(p.d), 'evenodd')
    ctx.restore()
  }
  ctx.translate((LEAF_BOX.x - LOGO_BOX.x) * k, (LEAF_BOX.y - LOGO_BOX.y) * k)
  ctx.scale(k, k)
  ctx.fill(new Path2D(LEFT))
  ctx.fill(new Path2D(RIGHT))
  ctx.strokeStyle = LOGO_BROWN
  ctx.lineCap = 'round'
  ctx.lineWidth = 3.4
  ctx.stroke(new Path2D(STEM))
  ctx.strokeStyle = CREAM
  ctx.lineWidth = 2.4
  ctx.stroke(new Path2D(LEFT_VEIN))
  ctx.stroke(new Path2D(RIGHT_VEIN))
  ctx.restore()
}

function fitCanvas(canvas: HTMLCanvasElement, w: number, h: number) {
  const dpr = Math.min(window.devicePixelRatio, 2)
  canvas.width = Math.round(w * dpr)
  canvas.height = Math.round(h * dpr)
  canvas.style.width = `${w}px`
  canvas.style.height = `${h}px`
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  return ctx
}

/**
 * The scannable code, brand-styled, filling its (square) container. It re-ripples in whenever
 * its box changes size — so when the layout morphs, the code "re-prints" itself.
 */
export function QrCanvas({ value, className = '' }: QrCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const qr = useMemo(() => encode(value, { ecc: 'H', border: 0 }), [value])

  useEffect(() => {
    const host = hostRef.current!
    const canvas = canvasRef.current!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const N = qr.size
    const Q = N + QUIET * 2
    let m = 0
    let ox = 0
    let oy = 0
    let size = 0
    let start = performance.now()
    let raf = 0

    const draw = (t: number) => {
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle = CREAM
      ctx.beginPath()
      roundRect(ctx, ox, oy, m * Q, m * Q, m * 1.6)
      ctx.fill()

      const bx = ox + QUIET * m
      const by = oy + QUIET * m
      const c = N / 2
      const maxD = Math.hypot(c, c)
      const logoCells = Math.round(N * 0.24) | 1
      const l0 = (N - logoCells) / 2

      ctx.fillStyle = DARK
      ctx.beginPath()
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          if (!qr.data[y][x] || qr.types[y][x] === POSITION) continue
          if (x >= l0 - 0.5 && x < l0 + logoCells && y >= l0 - 0.5 && y < l0 + logoCells) continue
          const delay = (Math.hypot(x - c, y - c) / maxD) * (ENTRANCE - 0.55)
          const k = easeOutBack(clamp01((t - delay) / 0.45))
          if (k <= 0) continue
          const s = m * Math.min(k, 1.15)
          roundRect(ctx, bx + x * m + (m - s) / 2, by + y * m + (m - s) / 2, s, s, s * 0.3)
        }
      }
      ctx.fill()

      const eye = easeOutBack(clamp01((t - (ENTRANCE - 0.6)) / 0.5))
      if (eye > 0) {
        for (const [ex, ey] of [
          [0, 0],
          [N - 7, 0],
          [0, N - 7],
        ]) {
          ctx.save()
          ctx.translate(bx + (ex + 3.5) * m, by + (ey + 3.5) * m)
          ctx.scale(eye, eye)
          for (const [s, r, col] of [
            [7, 2, DARK],
            [5, 1.4, CREAM],
            [3, 0.9, DARK],
          ] as const) {
            ctx.fillStyle = col
            ctx.beginPath()
            roundRect(ctx, (-s / 2) * m, (-s / 2) * m, s * m, s * m, r * m)
            ctx.fill()
          }
          ctx.restore()
        }
      }

      const lk = easeOutBack(clamp01((t - (ENTRANCE - 0.3)) / 0.5))
      if (lk > 0) {
        const bs = logoCells * m
        ctx.save()
        ctx.translate(bx + l0 * m + bs / 2, by + l0 * m + bs / 2)
        ctx.scale(lk, lk)
        ctx.fillStyle = CREAM
        ctx.beginPath()
        roundRect(ctx, -bs / 2, -bs / 2, bs, bs, m * 1.2)
        ctx.fill()
        drawLogo(ctx, bs * 0.9)
        ctx.restore()
      }
    }

    const frame = (now: number) => {
      const t = (now - start) / 1000
      draw(t)
      if (t < ENTRANCE + 0.6) raf = requestAnimationFrame(frame)
    }

    const layout = () => {
      // clientWidth ignores transforms, so a morphing (scaled) parent doesn't fool the measurement
      const next = Math.floor(Math.min(host.clientWidth, host.clientHeight))
      if (next < 40 || next === size) return
      size = next
      m = Math.max(2, Math.floor(size / Q))
      ox = oy = Math.floor((size - m * Q) / 2)
      fitCanvas(canvas, size, size)
      cancelAnimationFrame(raf)
      start = performance.now() - (reduced ? 10_000 : 0)
      raf = requestAnimationFrame(frame)
    }

    const ro = new ResizeObserver(layout)
    ro.observe(host)
    layout()
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [qr])

  return (
    <div ref={hostRef} className={`grid place-items-center ${className}`} role="img" aria-label={`QR code: ${value}`}>
      <canvas ref={canvasRef} />
    </div>
  )
}

/** Low-contrast QR-style texture for backgrounds. Shimmers; never scannable on purpose. */
export function QrTexture({ cell = 18, className = '' }: { cell?: number; className?: string }) {
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = hostRef.current!
    const canvas = canvasRef.current!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let cells: Array<{ x: number; y: number; d: number; r: number }> = []
    let W = 0
    let H = 0
    let raf = 0
    let last = 0
    const start = performance.now()
    const BUCKETS = 6

    const layout = () => {
      W = host.clientWidth
      H = host.clientHeight
      fitCanvas(canvas, W, H)
      cells = []
      const cx = W / 2
      const cy = H / 2
      const maxD = Math.hypot(cx, cy)
      for (let y = 0; y < H; y += cell) {
        for (let x = 0; x < W; x += cell) {
          const gx = Math.round(x / cell)
          const gy = Math.round(y / cell)
          const n = hash(gx, gy) * 0.6 + hash(gx >> 1, gy >> 1) * 0.4
          if (n < 0.52) continue
          cells.push({ x, y, d: Math.hypot(x - cx, y - cy) / maxD, r: hash(gy, gx) })
        }
      }
    }

    const frame = (now: number) => {
      const t = (now - start) / 1000
      // ripple in once, then freeze — a static texture costs nothing per frame
      if (t < 2.6 && !reduced) raf = requestAnimationFrame(frame)
      if (now - last < 33 && t < 2.6) return
      last = now
      const time = 0
      const ctx = canvas.getContext('2d')!
      ctx.clearRect(0, 0, W, H)
      const paths = Array.from({ length: BUCKETS }, () => new Path2D())
      for (const c of cells) {
        const appear = easeOutBack(clamp01((t - 0.1 - c.d * 1.2 - c.r * 0.25) / 0.5))
        if (appear <= 0) continue
        const wave = Math.sin((c.x + c.y) / (cell * 9) - time * 1.3) * 0.5 + 0.5
        const breath = Math.sin(time * 0.8 + c.r * 12) * 0.5 + 0.5
        const level = Math.min(BUCKETS - 1, Math.floor((wave ** 3 * 0.75 + breath * 0.25) * BUCKETS))
        const s = cell * 0.7 * Math.min(appear, 1.1) * (0.9 + level * 0.04)
        paths[level].roundRect(c.x + (cell - s) / 2, c.y + (cell - s) / 2, s, s, s * 0.32)
      }
      ctx.fillStyle = DECO
      paths.forEach((p, i) => {
        ctx.globalAlpha = 0.045 + i * 0.018
        ctx.fill(p)
      })
      ctx.globalAlpha = 1
    }

    layout()
    const ro = new ResizeObserver(() => {
      layout()
      frame(performance.now() + 1e7)
    })
    ro.observe(host)
    raf = requestAnimationFrame(frame)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [cell])

  return (
    <div ref={hostRef} aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <canvas ref={canvasRef} className="absolute left-0 top-0" />
    </div>
  )
}

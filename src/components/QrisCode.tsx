import { useEffect, useMemo, useRef } from 'react'
import { encode } from 'uqr'
import { Download } from 'lucide-react'
import { QRIS_MERCHANT, QRIS_NMID, qrisWithAmount } from '../lib/qris'
import { rupiah } from '../data/preorder'
import { QR_INK, QR_PAPER, QR_QUIET, drawQr, isFinder } from '../lib/qrisDraw'

/*
 * A QRIS with the amount in it, in Pletok colours (drawn by lib/qrisDraw) — no logo in the middle:
 * bank apps are pickier than phone cameras, and a payment code has to scan on the first try.
 *
 * It builds itself: the three corner squares lock in first, then the rest ripples out from the
 * middle, each square popping into place — the whole code in ~0.6 s. While `loading` (the amount
 * is still changing, an order is on its way) it shows a faint shimmering pattern instead, so the
 * same box doubles as the loading state.
 */

const BUILD_MS = 620
const CELL_MS = 170

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))
const hash = (x: number, y: number) => {
  let h = (x * 374761393 + y * 668265263) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

/** `total` in thousands, like every price on the site */
export function QrisCode({ total, save = false, loading = false, className = '' }: { total: number; save?: boolean; loading?: boolean; className?: string }) {
  const value = useMemo(() => qrisWithAmount(total * 1000), [total])
  const qr = useMemo(() => encode(value, { ecc: 'M', border: 0 }), [value])
  const n = qr.size + QR_QUIET * 2

  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const host = hostRef.current!
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const N = qr.size
    const c = (N - 1) / 2
    const maxD = Math.hypot(c, c)
    // when each square starts popping in: corners at once, the rest from the centre outwards
    const delay = qr.data.map((row, y) => row.map((_, x) => (isFinder(qr, x, y) ? 0 : (0.85 * Math.hypot(x - c, y - c)) / maxD + 0.15 * hash(x, y)) * (BUILD_MS - CELL_MS)))
    let size = 0
    let raf = 0
    const start = performance.now()

    // drawn in device pixels, so drawQr's whole-pixel cells are whole on the screen too
    const fit = () => {
      const css = host.clientWidth
      size = Math.round(css * Math.min(window.devicePixelRatio, 3))
      canvas.width = canvas.height = size
      canvas.style.width = canvas.style.height = `${css}px`
    }

    const frame = (now: number) => {
      const t = now - start
      // the same grid drawQr uses
      const m = Math.max(1, Math.floor(size / n))
      const off = Math.round((size - m * n) / 2)
      ctx.clearRect(0, 0, size, size)
      // the real code, popping in cell by cell (nothing yet while loading)
      const moving = drawQr(ctx, qr, size, (x, y) => (loading ? 0 : reduced ? 1 : clamp01((t - delay[y][x]) / CELL_MS)))

      // the shimmer: random dots breathing in a diagonal wave — fades out as the real code builds
      const ghost = loading ? 1 : 1 - clamp01(t / 220)
      if (ghost > 0 && !reduced) {
        for (let y = 0; y < N; y++)
          for (let x = 0; x < N; x++) {
            if (hash(x + 7, y + 3) < 0.55) continue
            const wave = 0.5 + 0.5 * Math.sin(now / 260 - (x + y) * 0.28)
            ctx.globalAlpha = ghost * (0.06 + 0.16 * wave)
            ctx.fillStyle = QR_INK
            ctx.beginPath()
            ctx.arc(off + (x + QR_QUIET + 0.5) * m, off + (y + QR_QUIET + 0.5) * m, m * 0.36 * (0.7 + 0.3 * wave), 0, Math.PI * 2)
            ctx.fill()
          }
        ctx.globalAlpha = 1
      }
      if (loading || moving || ghost > 0) raf = requestAnimationFrame(frame)
    }

    fit()
    raf = requestAnimationFrame(frame)
    const ro = new ResizeObserver(() => {
      fit()
      cancelAnimationFrame(raf)
      raf = requestAnimationFrame(frame)
    })
    ro.observe(host)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
    }
  }, [qr, n, loading])

  // a PNG for the gallery: on a phone you can't scan your own screen, but every e-wallet scans from a picture
  const download = () => {
    const c = document.createElement('canvas')
    c.width = c.height = n * 16
    drawQr(c.getContext('2d')!, qr, c.width)
    const a = document.createElement('a')
    a.href = c.toDataURL('image/png')
    a.download = `QRIS Pletok ${rupiah(total)}.png`
    a.click()
  }

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="w-full rounded-2xl shadow-[0_6px_18px_-10px_rgb(46_22_10/0.55)]" style={{ background: QR_PAPER }}>
        <div ref={hostRef} className="aspect-square w-full">
          <canvas ref={canvasRef} role="img" aria-label={loading ? 'QRIS sedang dibuat…' : `QRIS ${rupiah(total)} ke ${QRIS_MERCHANT}`} aria-busy={loading} className="block" />
        </div>
      </div>
      <p className="mt-2 text-center font-display text-sm font-semibold">{QRIS_MERCHANT}</p>
      <p className="text-center font-cond text-xs italic opacity-70">{loading ? 'Menyiapkan QR…' : `NMID ${QRIS_NMID} · nominal sudah terisi`}</p>
      {save && (
        <button type="button" onClick={download} disabled={loading} className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-brown px-3.5 py-2 font-display text-sm font-semibold text-cream disabled:opacity-50">
          <Download className="size-4" /> Simpan gambar QR
        </button>
      )}
    </div>
  )
}

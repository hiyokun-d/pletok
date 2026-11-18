import type { QrCodeGenerateResult } from 'uqr'

/*
 * How the QRIS is drawn — the same on screen (animated) and in the saved picture. Brand colours,
 * but kept dark-on-light with plenty of contrast: bank apps read a QR by threshold, so the ink
 * stays near-black brown, the corner "eyes" a deep terracotta, the paper a light cream.
 */

export const QR_INK = '#2e160a'
export const QR_EYE = '#8a3f1c'
export const QR_PAPER = '#f8efe2'
/** cells of empty paper around the code — scanners need it */
export const QR_QUIET = 4
const POSITION = 2 // uqr QrCodeDataType.Position — the three corner squares
/** a data square's corner rounding (share of its side). Full-size squares, only softened: dots with
 * gaps or rounder corners looked nice but failed to scan at some sizes (tested with jsQR) */
const ROUND = 0.18

const easeOutBack = (t: number) => 1 + 2.4 * (t - 1) ** 3 + 1.4 * (t - 1) ** 2
export const isFinder = (qr: QrCodeGenerateResult, x: number, y: number) => qr.types[y][x] === POSITION

function round(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * The code at `size` px. `at(x, y)` is how far that cell is built (0 → 1); a corner eye uses its
 * top-left cell and pops in as one piece. Returns whether anything is still moving.
 */
export function drawQr(ctx: CanvasRenderingContext2D, qr: QrCodeGenerateResult, size: number, at: (x: number, y: number) => number = () => 1) {
  const N = qr.size
  // whole-pixel cells (the leftover goes to the margin): fractional ones blur every edge, and
  // blurry edges are what make a bank app hesitate
  const m = Math.max(1, Math.floor(size / (N + QR_QUIET * 2)))
  const off = (size - m * (N + QR_QUIET * 2)) / 2
  let moving = false

  ctx.fillStyle = QR_PAPER
  ctx.beginPath()
  round(ctx, 0, 0, size, size, m * 2)
  ctx.fill()
  ctx.save()
  ctx.translate(Math.round(off), Math.round(off))

  // the corner eyes: a rounded frame + a rounded centre
  for (const [ox, oy] of [[0, 0], [N - 7, 0], [0, N - 7]]) {
    const p = at(ox, oy)
    if (p <= 0) {
      moving = true
      continue
    }
    if (p < 1) moving = true
    const k = p >= 1 ? 1 : easeOutBack(p)
    const cx = (ox + QR_QUIET + 3.5) * m
    const cy = (oy + QR_QUIET + 3.5) * m
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(k, k)
    ctx.fillStyle = QR_INK
    ctx.beginPath()
    round(ctx, -3.5 * m, -3.5 * m, 7 * m, 7 * m, 2.2 * m)
    round(ctx, -2.5 * m, -2.5 * m, 5 * m, 5 * m, 1.5 * m)
    ctx.fill('evenodd')
    ctx.fillStyle = QR_EYE
    ctx.beginPath()
    round(ctx, -1.5 * m, -1.5 * m, 3 * m, 3 * m, 0.9 * m)
    ctx.fill()
    ctx.restore()
  }

  // the data: rounded dots
  ctx.fillStyle = QR_INK
  ctx.beginPath()
  for (let y = 0; y < N; y++)
    for (let x = 0; x < N; x++) {
      if (!qr.data[y][x] || isFinder(qr, x, y)) continue
      const p = at(x, y)
      if (p <= 0) {
        moving = true
        continue
      }
      if (p < 1) moving = true
      const s = m * (p >= 1 ? 1 : easeOutBack(p))
      round(ctx, (x + QR_QUIET + 0.5) * m - s / 2, (y + QR_QUIET + 0.5) * m - s / 2, s, s, s * ROUND)
    }
  ctx.fill()
  ctx.restore()
  return moving
}

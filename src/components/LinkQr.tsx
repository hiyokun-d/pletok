import { useEffect, useMemo, useRef } from 'react'
import { encode } from 'uqr'
import { drawQr } from '../lib/qrisDraw'

/** a plain link QR in Pletok colours (same drawing as the QRIS, no animation) — ecc Q, scans from a tilted screen */
export function LinkQr({ url, className = '' }: { url: string; className?: string }) {
  const qr = useMemo(() => encode(url, { ecc: 'Q', border: 0 }), [url])
  const hostRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const host = hostRef.current!
    const canvas = canvasRef.current!
    const draw = () => {
      const css = host.clientWidth
      const size = Math.round(css * Math.min(window.devicePixelRatio, 3))
      canvas.width = canvas.height = size
      canvas.style.width = canvas.style.height = `${css}px`
      drawQr(canvas.getContext('2d')!, qr, size)
    }
    draw()
    const ro = new ResizeObserver(draw)
    ro.observe(host)
    return () => ro.disconnect()
  }, [qr])
  return (
    <div ref={hostRef} className={`aspect-square w-full ${className}`}>
      <canvas ref={canvasRef} role="img" aria-label={`QR: ${url}`} />
    </div>
  )
}

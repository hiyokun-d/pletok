import { AnimatePresence, motion } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Camera, CheckCircle2, ClipboardPaste, Loader2, ScanLine, ShieldAlert, X } from 'lucide-react'
import { holdSale } from '../lib/crewLocal'
import { unpack, verify } from '../lib/saleCode'
import type { QueueOrder } from '../lib/backend'

/*
 * "Scan struk" on /pickup — the cashier → pickup hand-off with no network at all. The buyer's
 * struk QR carries the sale (lib/saleCode); scanning it puts that sale in this phone's queue.
 *   - the camera opens right here on every phone: browsers that read QR codes themselves (Chrome on
 *     Android / Mac) use that; the rest (every iPhone, Samsung Internet, Firefox) read the frames
 *     with jsQR, downloaded only when the scanner opens
 *   - no camera / permission refused: the phone's own Camera app reads the struk → tap the link →
 *     the struk page shows crew phones a "Tambahkan ke pickup" button. Same result, one extra tap.
 *   - a link sent over WhatsApp can be pasted in too
 * It also reads a pre-order's pickup QR (the customer's "Lunas!" screen): that's their /c/<kode cek>
 * link, the same one WhatsApp sent them. The order opens with its kode cek already filled in — the
 * crew still taps "Serahkan", and the Sheet still checks it and refuses a second pickup.
 */

type Detector = { detect: (src: CanvasImageSource) => Promise<Array<{ rawValue: string }>> }
type DetectorCtor = (new (o: { formats: string[] }) => Detector) & { getSupportedFormats?: () => Promise<string[]> }
const Native = (globalThis as unknown as { BarcodeDetector?: DetectorCtor }).BarcodeDetector
const canCamera = !!navigator.mediaDevices?.getUserMedia
/** a phone/laptop browser only offers the camera on https (or localhost) — a phone opening the dev
 *  server as http://192.168…:5173 has no camera API at all, so say that instead of "no camera" */
const insecure = !window.isSecureContext
const touch = window.matchMedia('(pointer: coarse)').matches
type Cam = 'starting' | 'on' | 'denied' | 'busy' | 'none' | 'insecure'
const CAM_TEXT: Partial<Record<Cam, string>> = {
  denied: 'Kamera ditolak. iPhone: Pengaturan › Safari › Kamera › Izinkan (atau ikon "aA" di address bar). Android: ikon gembok di address bar › Kamera. Atau pakai cara di bawah.',
  busy: 'Kamera sedang dipakai aplikasi lain (video call, aplikasi kamera) — tutup dulu, lalu buka scan lagi.',
}

/** one frame of the camera → the QR's text (or null). The browser's own reader when it has a working
 *  one; otherwise jsQR on a shrunk copy of the frame (≤ 640 px: quick even on a cheap phone) */
async function makeReader(): Promise<(v: HTMLVideoElement) => Promise<string | null>> {
  if (Native) {
    try {
      // some Androids have the API but no QR engine behind it — then it'd never find anything
      const formats = await Native.getSupportedFormats?.()
      if (!formats || formats.includes('qr_code')) {
        const d = new Native({ formats: ['qr_code'] })
        return async (v) => (await d.detect(v))[0]?.rawValue ?? null
      }
    } catch {
      /* fall through to jsQR */
    }
  }
  const { default: jsQR } = await import('jsqr')
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d', { willReadFrequently: true })!
  return async (v) => {
    const k = Math.min(1, 640 / Math.max(v.videoWidth, v.videoHeight))
    c.width = Math.round(v.videoWidth * k)
    c.height = Math.round(v.videoHeight * k)
    ctx.drawImage(v, 0, 0, c.width, c.height)
    const img = ctx.getImageData(0, 0, c.width, c.height)
    return jsQR(img.data, c.width, c.height, { inversionAttempts: 'dontInvert' })?.data ?? null
  }
}

type Result = { kind: 'ok'; code: string; id: string; proof?: string; po?: boolean } | { kind: 'bad' | 'old' | 'other'; text: string }

/** a pre-order pickup QR / link → its kode cek: …/c/K7Q2MX or …/preorder?cek=K7Q2MX */
export const preorderRef = (text: string) =>
  text.trim().match(/\/c\/([A-Za-z0-9]{4,12})\/?(?:[?#].*)?$/)?.[1]?.toUpperCase() ?? text.trim().match(/[?&]cek=([A-Za-z0-9]{4,12})(?:[&#]|$)/)?.[1]?.toUpperCase()

/** what a scanned / pasted text means for the queue */
async function take(pin: string, text: string, known: (id: string) => QueueOrder | undefined, byRef: FindRef): Promise<Result> {
  const ref = preorderRef(text)
  if (ref) {
    const o = await byRef(ref)
    if (!o) return { kind: 'old', text: `Pre-order dengan kode ${ref} belum ada di antrean — belum lunas / belum diverifikasi admin, atau sinyal. Cari nomor PLT-nya manual.` }
    if (o.done) return { kind: 'bad', text: `${o.code} sudah diambil${o.pickedBy ? ` (${o.pickedBy})` : ''} — jangan diserahkan lagi.` }
    return { kind: 'ok', code: o.code, id: o.id, proof: ref, po: true }
  }
  const m = text.trim().match(/\/r\/([A-Za-z0-9-]{8,64})\/?(?:[?#].*)?$/)
  if (!m) return { kind: 'other', text: 'Bukan QR struk Pletok.' }
  const packed = unpack(m[1], m[2] ?? (text.match(/#.*$/)?.[0] ?? ''))
  if (!packed) {
    // a struk with just its id (made before the order was packed in, or the link got cut): this phone's
    // queue may still have it — then go straight to it
    const o = known(m[1])
    if (o) return { kind: 'ok', code: o.code, id: o.id }
    return { kind: 'old', text: 'Pesanan ini belum ada di antrean HP ini (sinyal / Sheet). Tanya nama pembelinya lalu cari di kolom pencarian — atau minta kasir buka "Struk" di riwayatnya dan scan QR dari layar kasir.' }
  }
  const seal = await verify(pin, packed)
  if (seal === 'bad') return { kind: 'bad', text: 'Segel tidak cocok — QR ini bukan dari kasir Pletok atau isinya diubah. Jangan serahkan, cek ke kasir.' }
  holdSale(pin, packed)
  return { kind: 'ok', code: '#' + packed.id.slice(0, 4).toUpperCase(), id: packed.id }
}

/** a pre-order from its kode cek (checked against the queue's hashes, or asked of the Sheet) */
export type FindRef = (ref: string) => Promise<QueueOrder | undefined>
type Props = { pin: string; known: (id: string) => QueueOrder | undefined; byRef: FindRef; onClose: () => void; onFound: (id: string, code: string, proof?: string) => void }

export function ScanStruk({ open, ...props }: Props & { open: boolean }) {
  return <AnimatePresence>{open && <Sheet key="scan" {...props} />}</AnimatePresence>
}

function Sheet({ pin, known, byRef, onClose, onFound }: Props) {
  const video = useRef<HTMLVideoElement>(null)
  // the page re-renders every few seconds (its poll) — the camera mustn't restart each time
  const found = useRef(onFound)
  found.current = onFound
  const lookup = useRef(known)
  lookup.current = known
  const findRef = useRef(byRef)
  findRef.current = byRef
  // a camera facing you (laptop webcam, selfie camera) shows as a mirror — easier to aim the QR
  const [mirror, setMirror] = useState(false)
  const [cam, setCam] = useState<Cam>(insecure ? 'insecure' : canCamera ? 'starting' : 'none')
  const [result, setResult] = useState<Result | null>(null)
  const [paste, setPaste] = useState('')

  useEffect(() => {
    if (!canCamera) return
    let stream: MediaStream | null = null
    let live = true
    let t = 0
    const reader = makeReader()
    // a code that didn't work stays in front of the camera — check it once, not 4× a second
    let last = ''
    let lastAt = 0
    let busy = false
    const tick = async () => {
      if (!live) return
      const v = video.current
      if (v && v.readyState >= 2 && !busy) {
        busy = true
        try {
          const text = await (await reader)(v)
          const again = text === last && Date.now() - lastAt < 4000
          if (text) {
            last = text
            lastAt = Date.now()
          }
          if (text && live && !again) {
            const r = await take(pin, text, lookup.current, findRef.current)
            setResult(r)
            if (r.kind === 'ok') {
              navigator.vibrate?.(80)
              window.setTimeout(() => live && found.current(r.id, r.code, r.proof), 700)
              return
            }
          }
        } catch {
          /* a frame it couldn't read — try the next */
        }
        busy = false
      }
      t = window.setTimeout(tick, 220)
    }
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
      .then((s) => {
        if (!live) return s.getTracks().forEach((x) => x.stop())
        stream = s
        // mirrored like a mirror only when the camera faces you (selfie camera, laptop webcam); the
        // back camera stays true to life. Many Androids don't say which way it faces → a phone's
        // camera counts as the back one, a laptop's as the webcam
        const facing = s.getVideoTracks()[0]?.getSettings?.().facingMode
        setMirror(facing ? facing === 'user' : !touch)
        if (video.current) {
          video.current.srcObject = s
          void video.current.play().catch(() => {})
        }
        setCam('on')
        tick()
      })
      .catch((e: unknown) => {
        if (!live) return
        const name = (e as { name?: string })?.name
        setCam(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : name === 'NotFoundError' || name === 'OverconstrainedError' ? 'none' : 'busy')
      })
    return () => {
      live = false
      window.clearTimeout(t)
      stream?.getTracks().forEach((x) => x.stop())
    }
  }, [pin])

  const submitPaste = async () => {
    const r = await take(pin, paste, lookup.current, findRef.current)
    setResult(r)
    if (r.kind === 'ok') window.setTimeout(() => found.current(r.id, r.code, r.proof), 700)
  }

  return (
    <motion.div className="fixed inset-0 z-50 grid place-items-end bg-brown/60 backdrop-blur-sm sm:place-items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
      <motion.div
        role="dialog"
        aria-label="Scan QR struk atau pre-order"
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92dvh] w-full overflow-y-auto rounded-t-[2rem] bg-cream p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] font-display text-brown sm:max-w-md sm:rounded-[2rem]"
        initial={{ y: 60 }}
        animate={{ y: 0 }}
        exit={{ y: 60 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
      >
        <div className="flex items-center justify-between">
          <p className="flex items-center gap-2 text-xl font-bold"><ScanLine className="size-6 text-terracotta" /> Scan QR pembeli</p>
          <button type="button" onClick={onClose} aria-label="Tutup" className="grid size-9 place-items-center rounded-full bg-brown/10"><X className="size-5" /></button>
        </div>
        <p className="mt-1 font-cond text-sm italic text-brown-soft">Struk kasir (jalan tanpa internet) atau QR pre-order dari layar "Lunas!".</p>

        {cam === 'insecure' && (
          <p className="mt-4 rounded-2xl bg-terracotta/10 p-3 text-sm text-terracotta">
            Kamera hanya jalan di <b>https://</b> — halaman ini dibuka lewat http (mis. server dev di Wi-Fi). Buka <b>pletok.hiyokun.dev/pickup</b>, atau pakai cara di bawah.
          </p>
        )}
        {cam !== 'none' && cam !== 'insecure' && (
          <div className="relative mt-4 aspect-square overflow-hidden rounded-3xl bg-brown">
            {/* muted + playsInline: iOS only plays a live camera inline like this */}
            <video ref={video} muted playsInline autoPlay className="size-full object-cover" style={mirror ? { transform: 'scaleX(-1)' } : undefined} />
            <span className="pointer-events-none absolute inset-[18%] rounded-3xl border-4 border-yakult/80" />
            {cam === 'starting' && <span className="absolute inset-0 grid place-items-center text-cream"><Loader2 className="size-8 animate-spin" /></span>}
            {CAM_TEXT[cam] && <span className="absolute inset-0 grid place-items-center p-6 text-center text-sm text-cream">{CAM_TEXT[cam]}</span>}
          </div>
        )}

        {cam !== 'on' && (
          <ol className="mt-4 flex flex-col gap-2 rounded-2xl bg-brown/[0.06] p-4 text-sm">
            <li className="flex gap-2"><Camera className="mt-0.5 size-4 shrink-0 text-terracotta" /> <span>Buka aplikasi <b>Kamera</b> HP ini, arahkan ke QR di HP pembeli (struk, pre-order, atau layar kasir).</span></li>
            <li className="flex gap-2"><span className="w-4 shrink-0 text-center font-bold text-terracotta">2</span> <span>Tap link <b>pletok…/r/…</b> yang muncul.</span></li>
            <li className="flex gap-2"><span className="w-4 shrink-0 text-center font-bold text-terracotta">3</span> <span>Tekan <b>Tambahkan ke pickup</b> → kembali ke tab ini. QR pre-order: tempel link-nya di bawah.</span></li>
          </ol>
        )}

        <label className="mt-4 flex items-center gap-2 rounded-2xl bg-cream-deep/80 px-3 py-2.5">
          <ClipboardPaste className="size-5 shrink-0 text-brown-soft" />
          <input value={paste} onChange={(e) => setPaste(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && void submitPaste()} placeholder="…atau tempel link struk / pre-order" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          {paste && (
            <button type="button" onClick={() => void submitPaste()} className="rounded-full bg-brown px-3 py-1 text-sm font-semibold text-cream">Cek</button>
          )}
        </label>

        <AnimatePresence initial={false}>
          {result && (
            <motion.p
              key={result.kind + ('code' in result ? result.code : result.text)}
              role={result.kind === 'bad' ? 'alert' : 'status'}
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className={`mt-3 flex items-start gap-2 overflow-hidden rounded-2xl p-3 text-sm ${result.kind === 'ok' ? 'bg-leaf text-cream' : result.kind === 'bad' ? 'bg-terracotta text-cream' : 'bg-[#e8b53a]/30'}`}
            >
              {result.kind === 'ok' ? <CheckCircle2 className="mt-0.5 size-5 shrink-0" /> : <ShieldAlert className="mt-0.5 size-5 shrink-0" />}
              {result.kind === 'ok' ? <span><b>{result.code}</b> {result.po ? 'ketemu — kode ceknya sudah diisi, tinggal Serahkan.' : 'masuk antrean pickup HP ini.'}</span> : <span>{result.text}</span>}
            </motion.p>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  )
}

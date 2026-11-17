import { Component, useEffect, type ReactNode } from 'react'
import { motion } from 'motion/react'
import { CupSoda, Home, RotateCw } from 'lucide-react'
import cupOriginal from '../assets/cup-original.png'
import { spring } from '../lib/motion'

export type ErrorKind = 404 | 500 | 503 | 'offline'

const COPY: Record<ErrorKind, { code: string; title: string; text: string }> = {
  404: { code: '404', title: 'Halamannya tumpah', text: 'Halaman yang kamu cari nggak ada — mungkin link-nya salah ketik atau sudah dipindah.' },
  500: { code: '500', title: 'Ada yang keselek di dapur', text: 'Halaman ini error di HP-mu. Coba muat ulang — kalau masih, mampir aja langsung ke booth kami.' },
  503: { code: '503', title: 'Server lagi sibuk', text: 'Kami belum bisa tersambung ke data Pletok. Tunggu sebentar lalu coba lagi.' },
  offline: { code: 'Offline', title: 'Sinyalnya hilang', text: 'HP-mu sedang tidak tersambung ke internet. Begitu sinyal balik, halaman ini muat ulang sendiri.' },
}

/** one look for every error: a spilled cup, the code, what to do next */
export function ErrorPage({ kind, onRetry }: { kind: ErrorKind; onRetry?: () => void }) {
  const c = COPY[kind]
  const retry = onRetry ?? (() => window.location.reload())

  useEffect(() => {
    const was = document.title
    document.title = `${c.code} · Pletok`
    const m = document.createElement('meta')
    m.name = 'robots'
    m.content = 'noindex'
    document.head.appendChild(m)
    // offline fixes itself: try again the moment the connection is back
    const back = () => retry()
    if (kind === 'offline') window.addEventListener('online', back)
    return () => {
      document.title = was
      m.remove()
      window.removeEventListener('online', back)
    }
  }, [kind]) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="paper grid min-h-dvh place-items-center px-4 py-10 text-center text-brown">
      <div className="flex max-w-md flex-col items-center">
        <div className="relative mb-2 h-44 w-56">
          {/* the puddle */}
          <motion.span
            className="absolute bottom-3 left-1/2 h-5 rounded-[50%] bg-terracotta/30"
            initial={{ width: 0, x: '-20%' }}
            animate={{ width: 170, x: '-35%' }}
            transition={{ delay: 0.45, duration: 0.6, ease: 'easeOut' }}
          />
          <motion.img
            src={cupOriginal}
            alt=""
            className="absolute bottom-4 left-[18%] h-36 w-auto drop-shadow-[0_10px_10px_rgb(90_46_26/0.25)]"
            // tips over its own bottom-right edge, so it lands on the "table" instead of through it
            style={{ originX: 1, originY: 1 }}
            initial={{ rotate: 0 }}
            animate={{ rotate: [0, -8, 88, 80, 84] }}
            transition={{ duration: 1, times: [0, 0.2, 0.6, 0.8, 1], ease: 'easeInOut' }}
          />
        </div>
        <motion.p className="font-display text-7xl font-bold leading-none text-terracotta" initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={spring.pop}>
          {c.code}
        </motion.p>
        <h1 className="mt-3 font-display text-3xl font-bold">{c.title}</h1>
        <p className="mt-2 font-display text-lg text-brown-soft">{c.text}</p>
        <div className="mt-7 flex flex-wrap justify-center gap-3">
          {kind !== 404 && (
            <button onClick={retry} className="inline-flex items-center gap-2 rounded-full bg-terracotta px-5 py-3 font-display font-semibold text-cream">
              <RotateCw className="size-4" /> Coba lagi
            </button>
          )}
          {/* no signal / no server: the menu is saved on the phone, so it still opens */}
          <a href={kind === 'offline' || kind === 503 ? '/' : '/link'} className={`inline-flex items-center gap-2 rounded-full px-5 py-3 font-display font-semibold ${kind === 404 ? 'bg-terracotta text-cream' : 'border-2 border-brown/15 bg-cream/70'}`}>
            {kind === 'offline' || kind === 503 ? <CupSoda className="size-4" /> : <Home className="size-4" />} {kind === 'offline' || kind === 503 ? 'Lihat menu' : 'Ke halaman Pletok'}
          </a>
        </div>
      </div>
    </main>
  )
}

/** a crash anywhere below shows the 500 page instead of a blank screen */
export class ErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(err: unknown) {
    console.error('[Pletok]', err)
  }
  render() {
    return this.state.failed ? <ErrorPage kind={navigator.onLine ? 500 : 'offline'} /> : this.props.children
  }
}

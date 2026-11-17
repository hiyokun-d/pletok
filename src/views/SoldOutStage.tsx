import { motion } from 'motion/react'
import { useEffect, useState } from 'react'
import { DRINKS } from '../data/menu'
import { EVENT, INSTAGRAM_HANDLE, INSTAGRAM_URL, QR_LINKS } from '../data/event'
import { useMenu } from '../hooks/useMenu'
import { useFeedbackOpen } from '../hooks/useFeedbackOpen'
import { useEventPhase } from '../hooks/useEventPhase'
import { ParticleField } from '../components/ParticleField'
import { QrCanvas } from '../components/QrCanvas'
import { InstagramIcon } from '../components/InstagramIcon'
import { SoldStamp } from '../components/SoldStamp'
import { spring } from '../lib/motion'

const clock = (ms: number) => new Date(ms).toLocaleTimeString('id-ID', { timeZone: 'Asia/Jakarta', hour: '2-digit', minute: '2-digit' })

/**
 * Every drink is marked SOLD in the A + C panel → we're not restocking, so the booth stops
 * selling and says thanks: the cups hop in, get stamped one by one, then the big "Ludes!"
 * lands with confetti. "Restock semua" in the panel brings the menu straight back.
 */
export function SoldOutStage({ desktop }: { desktop: boolean }) {
  const { drinks } = useMenu()
  const feedback = useFeedbackOpen().open
  const { phase, remaining } = useEventPhase()
  const s = Math.floor(remaining / 1000)
  const left = [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':')
  const order = drinks.filter((d) => d.soldAt).sort((a, b) => a.soldAt! - b.soldAt!)
  // stamps land one per cup, then the headline
  const [stamped, setStamped] = useState(0)
  const [boom, setBoom] = useState<number>()
  useEffect(() => {
    const ts = DRINKS.map((_, i) => window.setTimeout(() => setStamped(i + 1), 900 + i * 450))
    ts.push(window.setTimeout(() => setBoom(Date.now()), 900 + DRINKS.length * 450 + 250))
    return () => ts.forEach(window.clearTimeout)
  }, [])

  return (
    <motion.main
      className="fixed inset-0 overflow-hidden bg-brown text-cream"
      initial={{ clipPath: 'circle(0% at 50% 50%)' }}
      animate={{ clipPath: 'circle(150% at 50% 50%)' }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.9, ease: [0.65, 0, 0.35, 1] }}
    >
      <ParticleField preset="leaf" overrides={{ count: desktop ? 26 : 14, opacity: 0.35 }} />
      <ParticleField preset="burst" overrides={{ shape: 'sparkle', count: 160, burstSpeed: [300, 1100] }} points={[[window.innerWidth / 2, window.innerHeight * 0.45]]} burstKey={boom} />

      <div className="relative flex h-full flex-col items-center justify-center px-6 text-center">
        <div className="flex items-end justify-center gap-[2vw]">
          {DRINKS.map((d, i) => (
            <motion.div
              key={d.id}
              className="relative"
              initial={{ y: '-70vh', rotate: (i - 1) * 25 }}
              animate={{ y: 0, rotate: (i - 1) * -6 }}
              transition={{ ...spring.pop, stiffness: 260, damping: 14, delay: 0.3 + i * 0.12 }}
            >
              <img
                src={d.image}
                alt={d.name}
                draggable={false}
                className={`h-[min(26vh,34vw)] w-auto object-contain drop-shadow-[0_18px_18px_rgb(0_0_0/0.35)] transition-[filter,opacity] duration-700 ${stamped > i ? 'opacity-50 grayscale' : ''}`}
              />
              <SoldStamp show={stamped > i} small className="left-1/2 top-[38%] -translate-x-1/2" />
            </motion.div>
          ))}
        </div>

        <motion.h1
          className="mt-[4vh] font-script text-[clamp(3.2rem,12vh,8rem)] font-bold leading-none text-yakult"
          initial={{ scale: 3, opacity: 0, rotate: -8 }}
          animate={boom ? { scale: 1, opacity: 1, rotate: -3 } : {}}
          transition={{ type: 'spring', stiffness: 380, damping: 16 }}
        >
          Ludes terjual!
        </motion.h1>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={boom ? { opacity: 1, y: 0 } : {}} transition={{ ...spring.glide, delay: 0.3 }}>
          <p className="mx-auto mt-[2vh] max-w-xl font-display text-[clamp(1rem,2.4vh,1.35rem)] leading-relaxed text-cream/85">
            Makasih banyak semuanya! Semua Pletok hari ini sudah habis dan kami nggak restock lagi. Sampai jumpa di event berikutnya —{' '}
            <span className="text-yakult">tradisi abadi, jiwa muda.</span>
          </p>
          {order.length > 0 && (
            <p className="mt-[1.6vh] font-cond text-[clamp(0.85rem,1.9vh,1.1rem)] italic text-cream/60">
              Habis duluan: {order.map((d) => `${d.short} (${clock(d.soldAt!)})`).join(' → ')}
            </p>
          )}
          <a
            href={INSTAGRAM_URL}
            data-track="soldout-instagram"
            className="mt-[3vh] inline-flex items-center gap-2 rounded-full border-2 border-cream/30 px-6 py-3 font-display font-semibold hover:bg-cream/10"
          >
            <InstagramIcon /> Follow {INSTAGRAM_HANDLE}
          </a>
        </motion.div>
      </div>

      {desktop && (
        <motion.div
          className="absolute bottom-[4vh] right-[2.5vw] flex flex-col items-center gap-2 rounded-[1.75rem] bg-cream p-[2vh] text-brown"
          initial={{ opacity: 0, x: 40 }}
          animate={boom ? { opacity: 1, x: 0 } : {}}
          transition={{ ...spring.glide, delay: 0.6 }}
        >
          <QrCanvas value={QR_LINKS} className="size-[min(20vh,180px)]" />
          <p className="font-display text-sm font-semibold">{feedback ? 'Kasih feedback & follow kami' : 'Follow kami buat event berikutnya'}</p>
        </motion.div>
      )}
      {/* the booth stays up until the official close (or the crew taps "Tutup sekarang" in A + C) */}
      <motion.div
        className="absolute left-1/2 top-[3vh] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/25 px-4 py-2 font-display text-[clamp(0.85rem,1.9vh,1.05rem)] font-semibold ring-1 ring-cream/10"
        initial={{ y: -30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...spring.snappy, delay: 0.8 }}
      >
        <span className={`size-2 rounded-full ${phase === 'last-call' ? 'bg-terracotta' : 'bg-yakult'}`} />
        <span className="text-cream/70">Booth tutup dalam</span>
        <span className="tabular-nums text-yakult">{left}</span>
      </motion.div>
      <p className="absolute bottom-[3vh] left-0 right-0 text-center font-cond text-sm italic text-cream/35 lg:left-[2.5vw] lg:right-auto lg:text-left">
        {EVENT.table} · {EVENT.name}
      </p>
    </motion.main>
  )
}

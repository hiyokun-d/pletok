import { motion, useAnimate } from 'motion/react'
import { useEffect, useMemo, useState } from 'react'
import { Heart, RotateCcw } from 'lucide-react'
import { DRINKS } from '../data/menu'
import { LEAF_BOX, LETTERS, LOGO_BOX, TAGLINE, pct } from '../data/logo'
import { EVENT, FEEDBACK_READY, FEEDBACK_URL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../data/event'
import { ParticleField } from '../components/ParticleField'
import { QrCanvas } from '../components/QrCanvas'
import { FeedbackButton } from '../components/FeedbackButton'
import { InstagramIcon } from '../components/InstagramIcon'
import { LogoPiece } from '../components/LogoPiece'
import { Sprout } from '../components/Sprout'
import { useViewport } from '../hooks/useViewport'
import { ease, spring } from '../lib/motion'

type Stage = 'calm' | 'storm' | 'zoom' | 'brown'

const BROWN = '#5a2e1a'
const CREAM = '#f5ebdd'
const LEAF_COLORS = ['#5e7b3a', '#6f8c3f', '#8faa4f', '#a3b860', '#4b6530', '#5e7b3a', '#7a4a33']
// a single leaf blade + its vein (from the right leaf of the logo's sprout, re-centred)
const BLADE = 'M2 40 C 0 21 11 5 31 0 C 32 19 22 36 2 40 Z'
const BLADE_VEIN = 'M6.5 33 C 10 23.5 16 14.5 23.5 8'

/** Camera-zoom target inside the logo: the body of the sprout's right leaf (leaf units 45,25 of 59×49) */
const ZOOM_ORIGIN = {
  x: ((LEAF_BOX.x + (45 / 59) * LEAF_BOX.w - LOGO_BOX.x) / LOGO_BOX.w) * 100,
  y: ((LEAF_BOX.y + (25 / 49) * LEAF_BOX.h - LOGO_BOX.y) / LOGO_BOX.h) * 100,
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/** Leaves rush in from every edge and land on a jittered grid so together they cover the screen */
function useStorm(w: number, h: number, desktop: boolean) {
  return useMemo(() => {
    const cols = desktop ? 9 : 4
    const rows = desktop ? 6 : 7
    const cw = w / cols
    const ch = h / rows
    const out = []
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const tx = (c + 0.5 + (Math.random() - 0.5) * 0.6) * cw
        const ty = (r + 0.5 + (Math.random() - 0.5) * 0.6) * ch
        // fly in from the nearest edge, curving past a swirl point
        const fromLeft = tx < w / 2
        const sx = fromLeft ? -w * 0.25 - Math.random() * 200 : w * 1.25 + Math.random() * 200
        const sy = ty + (Math.random() - 0.3) * h * 0.6
        const size = Math.max(cw, ch) * (1.5 + Math.random() * 0.7)
        out.push({
          id: `${r}-${c}`,
          size,
          color: LEAF_COLORS[(r * 3 + c * 5) % LEAF_COLORS.length],
          x: [sx, (sx + tx) / 2 + (Math.random() - 0.5) * 200, tx],
          y: [sy, (sy + ty) / 2 - 120 - Math.random() * 160, ty],
          rotate: [Math.random() * 360, Math.random() * 360 + 180, Math.random() * 360 + 360],
          // edges land first, the middle fills last — the screen closes in toward the logo
          delay: (1 - Math.hypot(tx / w - 0.5, ty / h - 0.5) / 0.71) * 0.9 + Math.random() * 0.15,
        })
      }
    }
    return out
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [desktop])
}

/**
 * Closing: leaves storm in and blanket the booth screen → the camera dives into the logo's leaf
 * until everything is brown → a cream logo regrows on brown with the thank-you.
 */
export function ClosingSequence({ desktop }: { desktop: boolean }) {
  const [scope, animate] = useAnimate()
  const { w, h } = useViewport()
  const [stage, setStage] = useState<Stage>('calm')
  const [run, setRun] = useState(0)
  const [burstKey, setBurstKey] = useState<number>()
  const storm = useStorm(w, h, desktop)

  useEffect(() => {
    let cancelled = false
    const play = async () => {
      setStage('calm')
      await wait(80)
      await animate('.close-logo', { opacity: [0, 1], scale: [0.9, 1] }, { duration: 0.7, ease: ease.out })
      animate('.close-cup', { opacity: [0, 1], y: [60, 0] }, { duration: 0.6, delay: (i: number) => i * 0.08, ease: ease.out })
      await animate('.close-kicker', { opacity: [0, 1], y: [12, 0] }, { duration: 0.5 })
      await wait(1500)
      if (cancelled) return

      // 1. leaf storm — the logo shivers as the wind picks up
      setStage('storm')
      animate('.close-kicker', { opacity: 0, y: -10 }, { duration: 0.3 })
      animate('.close-cup', { y: [0, -8, 0], rotate: [0, -4, 3, 0] }, { duration: 0.6, delay: (i: number) => i * 0.05 })
      animate('.close-logo', { rotate: [0, -1.5, 1.5, -1, 0] }, { duration: 0.8 })
      await wait(2300)
      if (cancelled) return

      // 2. camera dives into the leaf: veins fade so it's solid brown, ease-in so it accelerates
      setStage('zoom')
      animate('.vein', { opacity: 0 }, { duration: 0.4 })
      animate('.close-cup', { opacity: 0, scale: 0.8 }, { duration: 0.4 })
      animate('.storm-leaf', { scale: 1.6, opacity: 0 }, { duration: 1.2, ease: 'easeIn', delay: 0.3 })
      await animate('.close-zoom', { scale: [1, 1.15, 110] }, { duration: 1.7, times: [0, 0.18, 1], ease: [ease.out, [0.7, 0, 0.9, 0.3]] })
      if (cancelled) return

      // 3. brown
      setStage('brown')
      setBurstKey(Date.now())
    }
    play()
    return () => {
      cancelled = true
    }
  }, [run, animate])

  const brown = stage === 'brown'
  const logoW = desktop ? 'min(46vw, 640px)' : '82vw'

  return (
    <motion.div
      ref={scope}
      className="fixed inset-0 z-40 overflow-hidden"
      style={{ background: brown ? BROWN : CREAM }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.6 }}
    >
      {!brown && (
        <>
          <div className="paper absolute inset-0" />
          <ParticleField preset="leaf" overrides={{ count: stage === 'calm' ? 14 : 60, travel: stage === 'calm' ? [28, 60] : [160, 320] }} speed={stage === 'calm' ? 1 : 2.4} />

          {/* the storm (under the logo, so the logo is the last thing standing) */}
          {stage !== 'calm' &&
            storm.map((l) => (
              <motion.svg
                key={l.id}
                viewBox="0 0 32 41"
                className="storm-leaf absolute left-0 top-0 will-change-transform"
                style={{ width: l.size, height: l.size * 1.28, marginLeft: -l.size / 2, marginTop: -l.size * 0.64 }}
                initial={{ x: l.x[0], y: l.y[0], rotate: l.rotate[0] }}
                animate={{ x: l.x, y: l.y, rotate: l.rotate }}
                transition={{ duration: 1.5, delay: l.delay, ease: ease.out }}
              >
                <path d={BLADE} fill={l.color} />
                <path d={BLADE_VEIN} stroke={CREAM} strokeOpacity={0.35} strokeWidth={1.6} strokeLinecap="round" fill="none" />
              </motion.svg>
            ))}

          {/* the logo — the zoom wrapper dives into the right leaf */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <p className="close-kicker mb-[3vh] font-script text-[clamp(1.6rem,4.4vh,2.8rem)] font-bold text-terracotta opacity-0">Waktunya tutup…</p>
            <div
              className="close-zoom relative will-change-transform"
              style={{ width: logoW, aspectRatio: `${LOGO_BOX.w} / ${LOGO_BOX.h}`, transformOrigin: `${ZOOM_ORIGIN.x}% ${ZOOM_ORIGIN.y}%` }}
            >
              <div className="close-logo absolute inset-0 opacity-0">
                {/* cream halo keeps the logo readable on top of the leaves */}
                <div className="absolute -inset-[12%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(245_235_221/0.95),rgb(245_235_221/0.7)_60%,transparent)]" />
                {[...LETTERS, TAGLINE].map((p) => (
                  <div key={p.id} className="absolute" style={pct(p)}>
                    <LogoPiece part={p} className="h-full w-full" />
                  </div>
                ))}
                <div className="absolute" style={pct(LEAF_BOX)}>
                  <Sprout state="idle" className="h-full w-full" />
                </div>
              </div>
            </div>
            <div className="mt-[4vh] flex items-end gap-[2vw]">
              {DRINKS.map((d) => (
                <img key={d.id} src={d.image} alt="" draggable={false} className="close-cup w-auto object-contain opacity-0 drop-shadow-[0_14px_14px_rgb(90_46_26/0.3)]" style={{ height: desktop ? '20vh' : '13vh' }} />
              ))}
            </div>
          </div>
        </>
      )}

      {/* ---------------- brown: thank-you ---------------- */}
      {brown && (
        <>
          <ParticleField preset="leaf" overrides={{ count: 18, colors: ['#8faa4f', '#a3b860', '#c98a3c', '#f1d3a8'], opacity: 0.55 }} />
          <ParticleField
            preset="burst"
            overrides={{ count: 220, shape: 'leaf', colors: ['#8faa4f', '#a3b860', '#f1d3a8', '#c98a3c'], burstSpeed: [300, 1100] }}
            points={[[w / 2, h * 0.42]]}
            burstKey={burstKey}
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
            <motion.div
              className="relative"
              style={{ width: desktop ? 'min(30vw, 420px)' : '64vw', aspectRatio: `${LOGO_BOX.w} / ${LOGO_BOX.h}` }}
              initial={{ opacity: 0, y: 40, scale: 0.85 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 220, damping: 16, delay: 0.2 }}
            >
              {[...LETTERS, TAGLINE].map((p) => (
                <div key={p.id} className="absolute" style={pct(p)}>
                  <LogoPiece part={p} color={CREAM} className="h-full w-full" />
                </div>
              ))}
              {/* a new sprout — see you next time */}
              <div className="absolute" style={pct(LEAF_BOX)}>
                <Sprout state="grow" color="#a3b860" veinColor={BROWN} className="h-full w-full" />
              </div>
            </motion.div>

            <motion.h2
              className="mt-[3vh] py-1 pl-4 pr-8 font-script font-bold leading-none text-yakult"
              style={{ fontSize: desktop ? 'clamp(3.5rem, 11vh, 7.5rem)' : '3.6rem' }}
              initial={{ clipPath: 'inset(0 100% 0 0)' }}
              animate={{ clipPath: 'inset(0 0% 0 0)' }}
              transition={{ duration: 1.1, delay: 0.8, ease: ease.inOut }}
            >
              Terima kasih!
            </motion.h2>
            <motion.p
              className="mt-2 max-w-lg font-display text-[clamp(1rem,2.2vh,1.25rem)] text-cream/80"
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.glide, delay: 1.5 }}
            >
              Pletok sudah tutup untuk {EVENT.name} hari ini. Sampai jumpa lagi — tradisi abadi, jiwa muda.
            </motion.p>
            <motion.div
              className="mt-[3vh] flex flex-wrap items-center justify-center gap-3"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...spring.glide, delay: 1.7 }}
            >
              <FeedbackButton className="bg-cream! text-brown! shadow-[0_5px_0_#c9b39a]!" />
              <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-full border-2 border-cream/70 px-5 py-3 font-display font-semibold text-cream">
                <InstagramIcon /> {INSTAGRAM_HANDLE}
              </a>
            </motion.div>
          </div>

          {desktop && (
            <motion.div
              className="absolute bottom-[4vh] right-[2.5vw] flex flex-col items-center gap-2 rounded-[1.75rem] bg-cream p-4 shadow-[0_24px_60px_-20px_rgb(0_0_0/0.5)]"
              initial={{ opacity: 0, scale: 0.6, rotate: 8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ ...spring.pop, delay: 2 }}
            >
              <QrCanvas value={FEEDBACK_URL} className="size-[min(22vh,200px)]" />
              <p className="flex items-center gap-1.5 font-display text-lg font-bold text-brown">
                Masih sempat! <Heart className="size-4 fill-lychee text-lychee" />
              </p>
              <p className="-mt-1 font-cond text-sm italic text-brown-soft">{FEEDBACK_READY ? 'Scan untuk kasih feedback' : 'Scan untuk follow Pletok'}</p>
            </motion.div>
          )}

          <motion.button
            onClick={() => setRun((r) => r + 1)}
            className="absolute bottom-[4vh] left-[2.5vw] flex items-center gap-2 rounded-full px-3 py-2 font-cond text-sm font-semibold italic text-cream/50 hover:text-cream"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 3 }}
            whileTap={{ scale: 0.92 }}
          >
            <RotateCcw className="size-4" /> Putar lagi
          </motion.button>
        </>
      )}
    </motion.div>
  )
}

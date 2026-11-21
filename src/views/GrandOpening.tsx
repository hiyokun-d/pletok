import { AnimatePresence, motion, useAnimate } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { DRINKS, drinkById } from '../data/menu'
import { EVENT, INSTAGRAM_HANDLE } from '../data/event'
import { useEventPhase } from '../hooks/useEventPhase'
import { useViewport } from '../hooks/useViewport'
import { LogoRig } from '../components/LogoRig'
import { ParticleField } from '../components/ParticleField'
import { ease } from '../lib/motion'
import { Flame, Leaf, ShieldCheck } from 'lucide-react'
import { useMenu } from '../hooks/useMenu'
import { useLite } from '../lib/perf'
import { GigiBalang, Kawung, Lawang, Tumpal } from '../components/BetawiPattern'

type Scene = 'count' | 'title' | 'logo' | 'halal' | 'tour' | 'finale'
const STOPS = DRINKS.length + 1 // three drinks + the bundles
type Pt = [number, number]

interface GrandOpeningProps {
  /** `auto`: follows the real clock's last 10s. `manual`: crew pressed the button — own 5s count. */
  mode: 'auto' | 'manual'
  onDone: () => void
}

const PAN: [number, number, number, number] = [0.76, 0, 0.24, 1]
const TAGLINE_WORDS = ['Tradisi', 'Abadi,', 'Jiwa', 'Muda.']
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * The opening ceremony, shot like a product keynote:
 * countdown → INTRODUCING (push-in, zoom-through) → the logo blooms → kinetic tagline →
 * zoom into "BIR?" → 0% ALKOHOL stamp → leaf-wipe whip-pans through each drink + the bundles →
 * pull back to the whole line-up → RESMI DIBUKA!  (All positions in vw/vh so a resize mid-show can't break it.)
 * Esc skips straight to the menu.
 */
export function GrandOpening({ mode, onDone }: GrandOpeningProps) {
  const live = useMenu() // today's prices (editable on /config)
  const { now, phase } = useEventPhase()
  const { w: W, h: H } = useViewport()
  // phones get their own framing: tighter cups, chips instead of side callouts, stacked bundles
  const portrait = W < H
  const cupH = portrait ? 0.46 : 0.62
  const [scope, animate] = useAnimate()
  const [scene, setScene] = useState<Scene>('count')
  const [manualLeft, setManualLeft] = useState(5)
  const [showLogo, setShowLogo] = useState(false)
  const [showHalal, setShowHalal] = useState(false)
  const [halalKey, setHalalKey] = useState<number>()
  const [showTour, setShowTour] = useState(false)
  const [station, setStation] = useState(-1)
  const [reached, setReached] = useState(-1)
  const [landKey, setLandKey] = useState<number>()
  const [boomKey, setBoomKey] = useState<number>()
  const [confettiKey, setConfettiKey] = useState<number>()
  const [showDoors, setShowDoors] = useState(false)
  const lite = useLite()
  const started = useRef(false)
  const done = useRef(false)
  const logoReady = useRef<() => void>(undefined)

  // count to 13:00 itself — `remaining` flips to time-until-close (10800s) the moment we open
  const left = mode === 'auto' ? Math.max(0, Math.ceil((EVENT.open.getTime() - now) / 1000)) : manualLeft

  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }

  useEffect(() => {
    if (mode !== 'manual' || scene !== 'count' || manualLeft <= 0) return
    const t = window.setTimeout(() => setManualLeft((v) => v - 1), 1000)
    return () => window.clearTimeout(t)
  }, [mode, manualLeft, scene])

  // a phone has no Esc: two taps close together skip (one tap could be an accident)
  const lastTap = useRef(0)
  const tap = () => {
    const now = Date.now()
    if (now - lastTap.current < 400) finish()
    lastTap.current = now
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && finish()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (started.current || scene !== 'count') return
    if (left <= 0 || (mode === 'auto' && phase !== 'pre-open')) {
      started.current = true
      show()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [left, mode, phase, scene])

  /** A giant leaf sweeps across the frame to hide the cut — the logo's own leaf, blown up */
  // the leaf is sized by the screen's height (180vh wide), so on a tall phone ±120vw left most of it
  // parked over the cups — it travels its own half-width past each edge instead, then hides
  const leafWipe = (flip = false) => {
    const d = window.innerWidth / 2 + window.innerHeight * 0.9 + 40
    return animate(
      '.leaf-wipe',
      { x: flip ? [-d, d] : [d, -d], y: ['30vh', '-25vh'], rotate: flip ? [40, -30] : [-40, 30], opacity: [1, 1, 0] },
      { duration: 1.1, ease: [0.5, 0, 0.5, 1], opacity: { duration: 1.1, times: [0, 0.97, 1] } },
    )
  }

  const shake = (k = 1) => animate(scope.current, { x: [0, -14 * k, 11 * k, -7 * k, 4 * k, 0], y: [0, 9 * k, -6 * k, 4 * k, -2 * k, 0] }, { duration: 0.45 })

  /** The whole show, one camera move after another */
  const show = async () => {
    // ---- boom
    setBoomKey(Date.now())
    animate('.flash', { opacity: [0, 1, 0] }, { duration: 0.9, times: [0, 0.08, 1] })
    animate('.shock', { scale: [0, 4], opacity: [0.9, 0] }, { duration: 1.4, delay: (i: number) => i * 0.12, ease: ease.out })
    shake(1.4)
    setShowDoors(true)
    await wait(260)
    setScene('title')
    await wait(60)
    // the flash hides the cut: a pair of carved Betawi doors (lawang) is standing there — they swing open
    animate('.door-l', { rotateY: [0, -110] }, { duration: 1.5, ease: [0.65, 0, 0.35, 1] })
    animate('.door-r', { rotateY: [0, 110] }, { duration: 1.5, ease: [0.65, 0, 0.35, 1] })
    animate('.doors', { opacity: [1, 1, 0] }, { duration: 1.5, times: [0, 0.75, 1] }).then(() => setShowDoors(false))
    await wait(350)

    // ---- INTRODUCING: letters tighten while the camera creeps in, then we fly through the word
    const narrow = window.innerWidth < window.innerHeight
    animate('.t-kicker', { opacity: [0, 1], letterSpacing: narrow ? ['0.6em', '0.22em'] : ['1.4em', '0.6em'] }, { duration: 1.4, ease: ease.out })
    await wait(250)
    // letters spring up one by one, flipping in from below
    await animate(
      '.t-letter',
      { y: ['110%', '-12%', '0%'], rotateX: [-90, 10, 0], opacity: [0, 1, 1] },
      { duration: 0.55, delay: (i: number) => i * 0.045, ease: 'easeOut' },
    )
    shake(0.5)
    animate('.t-line', { scaleX: [0, 1] }, { duration: 0.6, ease: ease.inOut })
    await animate('.t-shine', { backgroundPosition: ['100% 0', '0% 0'] }, { duration: 0.9, ease: ease.inOut })
    // anticipation: the word sucks in a little… then we punch through it
    await animate('.t-cam', { scale: [1, 0.94] }, { duration: 0.25, ease: 'easeOut' })
    animate('.t-kicker, .t-line', { opacity: 0 }, { duration: 0.2 })
    await animate('.t-cam', { scale: [0.94, 14], opacity: [1, 1, 0] }, { duration: 0.6, ease: [0.7, 0, 0.84, 0] })

    // ---- the logo blooms out of its leaf
    setShowLogo(true)
    setScene('logo')
    await new Promise<void>((r) => (logoReady.current = r))
    await wait(250)
    for (let i = 0; i < TAGLINE_WORDS.length; i++) {
      await animate(`.w-${i}`, { opacity: [0, 1], scale: [2.6, 1], y: ['-30%', '0%'] }, { duration: 0.3, ease: [0.2, 0, 0, 1] })
      shake(0.45)
      await wait(170)
    }
    await wait(900)
    await animate('.l-cam', { scale: [1, 0.95] }, { duration: 0.22, ease: 'easeOut' })

    // ---- "BIR?" — zoom through the logo, then the halal punchline
    setShowHalal(true)
    setScene('halal')
    await animate('.l-cam', { scale: [0.95, 9], opacity: [1, 1, 0] }, { duration: 0.6, ease: [0.7, 0, 0.84, 0] })
    setShowLogo(false)
    await animate('.h-bir', { opacity: [0, 1], scale: [3.2, 1] }, { duration: 0.45, ease: [0.2, 0, 0, 1] })
    shake(0.7)
    await animate('.h-q', { opacity: [0, 1], y: [16, 0] }, { duration: 0.45, ease: ease.out })
    await wait(700)
    await animate('.h-stamp', { scale: [3.4, 0.9, 1.05, 1], rotate: [-24, -8, -11, -10], opacity: [0, 1, 1, 1] }, { duration: 0.5, ease: 'easeOut' })
    shake(1.2)
    setHalalKey(Date.now())
    animate('.h-bir', { opacity: 0.35 }, { duration: 0.4 })
    await animate('.h-badge', { opacity: [0, 1], y: [30, 0], scale: [0.6, 1] }, { type: 'spring', stiffness: 380, damping: 18, delay: (i: number) => 0.15 + i * 0.14 })
    await animate('.h-line', { clipPath: ['inset(0 100% 0 0)', 'inset(0 0% 0 0)'] }, { duration: 0.8, ease: ease.inOut })
    animate('.h-stamp', { rotate: [-10, -6, -12, -10] }, { duration: 0.6 })
    await wait(1300)

    // ---- whip-pan to the drinks — a giant leaf sweeps the cut
    setShowTour(true)
    setScene('tour')
    await wait(40)
    leafWipe()
    animate('.h-layer', { x: ['0vw', '-100vw'], skewX: [0, 6, 0] }, { duration: 1.05, ease: PAN })
    animate('.cam', { scale: [0.86, 0.86, 1], rotateY: [0, -14, 0] }, { duration: 1.05, times: [0, 0.4, 1], ease: PAN })
    animate('.leaf-bg', { x: ['12vw', '0vw'] }, { duration: 1.2, ease: PAN })
    await animate('.strip', { x: ['100vw', '0vw'], skewX: [0, -6, 0] }, { duration: 1.05, ease: PAN })
    setShowHalal(false)
    animate('.bug', { opacity: [0, 1], x: [-30, 0] }, { duration: 0.5, ease: ease.out })

    for (let i = 0; i < STOPS; i++) {
      if (i > 0) {
        setStation(-1)
        // the old cup gets flung off with a spin as the camera whips on
        animate(`.cup-${i - 1}`, { x: ['0vw', '-30vw'], y: ['0vh', '-20vh'], rotate: [0, -40] }, { duration: 0.8, ease: [0.5, 0, 0.75, 0] })
        leafWipe(i % 2 === 1)
        animate(`.name-${i - 1}`, { x: '-40vw' }, { duration: 1.1, ease: PAN })
        animate('.leaf-bg', { x: `${-i * 12}vw` }, { duration: 1.2, ease: PAN })
        animate('.cam', { scale: [1, 0.84, 1], rotateY: [0, i % 2 ? 12 : -12, 0] }, { duration: 1.05, ease: PAN })
        await animate('.strip', { x: `${-i * 100}vw`, skewX: [0, -6, 0] }, { duration: 1.05, ease: PAN })
      }
      setReached(i)
      setStation(i)
      if (i < DRINKS.length) {
        // cup drops onto the coaster — dust and a thump on landing
        await wait(430)
        setLandKey(Date.now())
        shake(0.55)
        await wait(2300)
      } else await wait(3600)
    }

    // ---- pull way back: the whole line-up in one frame
    setStation(-1)
    // outer cups glide in toward the middle so the line-up fits the frame
    DRINKS.forEach((_, k) => animate(`.cup-${k}`, { x: `${(1 - k) * (window.innerWidth < window.innerHeight ? 34 : 64)}vw`, y: '0vh', rotate: 0 }, { type: 'spring', stiffness: 120, damping: 16, delay: 0.3 + k * 0.1 }))
    animate('.name, .bug', { opacity: 0 }, { duration: 0.4 })
    animate('.bundle-stop', { opacity: 0 }, { duration: 0.5 })
    animate('.strip', { x: '-100vw', skewX: 0 }, { duration: 1.7, ease: [0.65, 0, 0.35, 1] })
    await animate('.cam', window.innerWidth < window.innerHeight ? { scale: [1, 0.5], y: ['0vh', '4vh'] } : { scale: [1, 0.64], y: ['0vh', '11vh'] }, { duration: 1.8, ease: [0.65, 0, 0.35, 1] })
    setScene('finale')
    await wait(40)
    await animate('.f-logo', { opacity: [0, 1], y: [-60, 0], scale: [0.8, 1] }, { type: 'spring', stiffness: 260, damping: 18 })
    animate('.cup-img', { y: [0, -60, 0], scaleY: [1, 1.04, 1] }, { duration: 0.55, delay: (i: number) => i * 0.09, ease: 'easeOut' })
    await wait(350)
    await animate(
      '.stamp',
      { scale: [3.4, 0.92, 1.04, 1], rotate: [-24, -5, -7, -6], rotateX: [70, -8, 3, 0], opacity: [0, 1, 1, 1] },
      { duration: 0.6, ease: 'easeOut' },
    )
    shake(1.3)
    animate('.f-orn', { opacity: [0, 0.4], scale: [0.5, 1] }, { duration: 1.2, ease: ease.out })
    animate('.f-band', { y: ['-100%', '0%'] }, { duration: 0.7, ease: ease.out })
    setConfettiKey(Date.now())
    animate('.stamp-dust', { scale: [0.6, 1.9], opacity: [0.7, 0] }, { duration: 0.7, ease: ease.out })
    await animate('.f-info', { opacity: [0, 1], y: [24, 0] }, { duration: 0.5, delay: (i: number) => i * 0.08, ease: ease.out })
    await wait(4500)
    finish()
  }

  const counting = scene === 'count'
  const urgency = counting ? Math.max(0, 1 - left / 10) : 1
  const center: Pt = [W / 2, H / 2]
  const ring = (n: number, r: number) => Array.from({ length: n }, (_, i) => [center[0] + Math.cos((i / n) * Math.PI * 2) * r, center[1] + Math.sin((i / n) * Math.PI * 2) * r] as Pt)
  const dark = scene === 'count' || scene === 'title'
  const tourParticle = station >= DRINKS.length ? 'sparkle' : DRINKS[Math.max(station, 0)].particle

  return (
    <motion.div
      className="fixed inset-0 z-[60] overflow-hidden bg-[#2b160c]"
      // quick: the page underneath was still showing through the countdown on a phone
      initial={{ opacity: 0 }}
      animate={{ opacity: 1, transition: { duration: 0.25 } }}
      onClick={tap}
      // no exit animation: the finale cuts straight to the open booth
      exit={{ opacity: 1, transition: { duration: 0 } }}
    >
      <div ref={scope} className="absolute inset-0" style={{ perspective: 1400 }}>
        {/* backdrop: roasted brown while counting → cream once the show starts */}
        <motion.div
          className="absolute inset-0"
          animate={{
            backgroundColor: dark ? (counting ? `rgb(${Math.round(90 - urgency * 40)} ${Math.round(46 - urgency * 22)} ${Math.round(26 - urgency * 12)})` : '#1f0f07') : '#f5ebdd',
          }}
          transition={{ duration: counting ? 0.9 : 0.25 }}
        />
        {!dark && <div className="paper absolute inset-0" />}

        <ParticleField preset="spice" overrides={{ count: 60, colors: ['#c98a3c', '#f1d3a8', '#a8572a'], opacity: counting ? 0.9 : 0 }} speed={1 + urgency * 4} />

        {/* ================= countdown ================= */}
        <AnimatePresence>
          {counting && (
            <motion.div className="absolute inset-0 flex flex-col items-center justify-center text-cream" exit={{ opacity: 0, scale: 1.5, transition: { duration: 0.35 } }}>
              <motion.div
                className="pointer-events-none absolute inset-0"
                animate={{ opacity: 0.6 + urgency * 0.4 }}
                style={{ background: 'radial-gradient(circle at 50% 50%, rgb(201 138 60 / 0.35), transparent 55%)' }}
              />
              {/* standing under a Betawi roof: kawung batik behind, gigi balang hanging from the eaves */}
              <Kawung className="pointer-events-none absolute inset-0 opacity-[0.06]" color="#f1d3a8" size={portrait ? 56 : 80} />
              <motion.div className="pointer-events-none absolute inset-x-0 top-0" initial={{ y: '-100%' }} animate={{ y: '0%' }} transition={{ duration: 0.9, ease: ease.out }}>
                <GigiBalang color="#1f0f07" accent="#c98a3c" size={portrait ? 30 : 44} />
              </motion.div>
              <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-50" initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 0.9, ease: ease.out }}>
                <Tumpal color="#1f0f07" accent="#c98a3c" size={portrait ? 22 : 32} />
              </motion.div>
              <motion.p className="font-cond text-[clamp(1rem,2.6vh,1.6rem)] font-semibold uppercase italic tracking-[0.5em] text-yakult/80" initial={{ opacity: 0, letterSpacing: '1em' }} animate={{ opacity: 1, letterSpacing: '0.5em' }}>
                Grand opening
              </motion.p>
              <div className="relative grid h-[48vh] place-items-center [perspective:900px]">
                {[0, 1].map((i) => (
                  <motion.span
                    key={`${left}-${i}`}
                    className="absolute size-[30vh] rounded-full border-[3px] border-yakult/50"
                    initial={{ scale: 0.6, opacity: 0.8 }}
                    animate={{ scale: 2.2, opacity: 0 }}
                    transition={{ duration: 1, delay: i * 0.18, ease: ease.out }}
                  />
                ))}
                <AnimatePresence mode="popLayout">
                  <motion.span
                    key={left}
                    className="font-display text-[min(40vh,38vw)] font-bold leading-none tabular-nums [text-shadow:0_14px_0_rgb(0_0_0/0.25)]"
                    initial={{ scale: 1.8, opacity: 0, rotateX: -85 }}
                    animate={{ scale: 1, opacity: 1, rotateX: 0 }}
                    exit={{ scale: 0.7, opacity: 0, rotateX: 85, y: -40 }}
                    transition={{ type: 'spring', stiffness: 420, damping: 22 }}
                  >
                    {Math.max(left, 0)}
                  </motion.span>
                </AnimatePresence>
              </div>
              <p className="font-script text-[clamp(1.6rem,4.4vh,3rem)] font-bold text-yakult">Rempahnya siap diseduh…</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ================= INTRODUCING ================= */}
        {scene === 'title' && (
          <div className="t-cam absolute inset-0 flex flex-col items-center justify-center text-cream will-change-transform">
            <p className="t-kicker max-w-[92vw] px-4 text-center font-cond text-[clamp(0.9rem,2.4vh,1.4rem)] font-semibold uppercase italic text-yakult/70 opacity-0">
              {EVENT.name} · {EVENT.campus} mempersembahkan
            </p>
            <ParticleField preset="leaf" overrides={{ count: 26, colors: ['#5e7b3a', '#8faa4f', '#a3b860'], opacity: 0.7 }} />
            {/* warm stage light behind the word */}
            <motion.div
              className="pointer-events-none absolute left-1/2 top-1/2 h-[70vh] w-[90vw] -translate-x-1/2 -translate-y-1/2 rounded-[50%]"
              style={{ background: 'radial-gradient(closest-side, rgb(201 138 60 / 0.22), rgb(168 87 42 / 0.08) 55%, transparent)' }}
              initial={{ opacity: 0, scale: 0.7 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.6, ease: ease.out }}
            />
            <h1 className="relative mt-[2vh] whitespace-nowrap [perspective:700px] py-[1vh] font-display text-[min(11vw,20vh)] font-bold uppercase leading-none">
              <span className="flex [perspective:600px]">
                {'Introducing'.split('').map((ch, i) => (
                  <span key={i} className="t-letter inline-block opacity-0 [text-shadow:0_0.06em_0_rgb(0_0_0/0.35)]" style={{ transformOrigin: '50% 100%' }}>
                    {ch}
                  </span>
                ))}
              </span>
              {/* the glint: same letters, a gold band clipped to the glyphs — light on the type, never a box */}
              <span
                aria-hidden
                className="t-shine pointer-events-none absolute inset-0 flex bg-clip-text py-[1vh] text-transparent"
                style={{
                  backgroundImage: 'linear-gradient(100deg, transparent 38%, rgb(241 211 168 / 0.9) 47%, #fff 50%, rgb(241 211 168 / 0.9) 53%, transparent 62%)',
                  backgroundSize: '300% 100%',
                  backgroundPosition: '100% 0',
                }}
              >
                {'Introducing'.split('').map((ch, i) => (
                  <span key={i} className="inline-block">
                    {ch}
                  </span>
                ))}
              </span>
            </h1>
            <span className="t-line mt-[3vh] h-[3px] w-[30vw] origin-center rounded-full bg-gradient-to-r from-transparent via-spice to-transparent" style={{ transform: 'scaleX(0)' }} />
          </div>
        )}

        {/* ================= logo + kinetic tagline ================= */}
        {showLogo && (
          <motion.div className="l-layer absolute inset-0" initial={{ scale: 1.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ duration: 0.7, ease: ease.out }}>
            <ParticleField preset="leaf" overrides={{ count: 30, travel: [40, 90] }} />
            <div className="l-cam absolute inset-0 flex flex-col items-center justify-center will-change-transform">
              <LogoRig play="intro" interactive={false} className={portrait ? 'w-[86vw]' : 'w-[min(58vw,92vh)]'} onReady={() => logoReady.current?.()} />
              <div className="mt-[5vh] flex flex-wrap items-baseline justify-center gap-x-[2.2vw] gap-y-[1vh] px-6">
                {TAGLINE_WORDS.map((word, i) => (
                  <span
                    key={word}
                    className={`w-${i} font-display text-[min(9vw,9vh)] font-bold uppercase leading-none opacity-0 ${i < 2 ? 'text-brown' : 'text-terracotta'}`}
                  >
                    {word}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ================= BIR? → 0% alkohol ================= */}
        {showHalal && (
          <div className="h-layer absolute inset-0">
            <ParticleField
              preset="burst"
              overrides={{ count: 160, shape: 'leaf', colors: ['#5e7b3a', '#8faa4f', '#a3b860', '#a8572a'], burstSpeed: [300, 1000] }}
              points={[[W / 2, H * 0.42]]}
              burstKey={halalKey}
            />
            <div className="h-cam absolute inset-0 flex flex-col items-center justify-center will-change-transform">
              <div className="relative">
                <h2 className="h-bir font-display text-[min(30vw,46vh)] font-bold uppercase leading-[0.85] text-brown opacity-0">Bir?</h2>
                <div className="h-stamp absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-2xl border-[6px] border-terracotta bg-cream px-[3vh] py-[1.4vh] font-display text-[min(8vw,12vh)] font-bold uppercase leading-none text-terracotta opacity-0 shadow-[0_12px_0_rgb(168_87_42/0.25)]">
                  0% Alkohol
                </div>
              </div>
              <p className="h-q mt-[1vh] font-script text-[clamp(1.6rem,5vh,3.2rem)] font-bold text-terracotta opacity-0">…tapi bukan bir yang itu.</p>
              <div className="mt-[3.5vh] flex flex-wrap justify-center gap-[1.4vh]">
                {[
                  { Icon: ShieldCheck, t: '100% Halal' },
                  { Icon: Leaf, t: 'Rempah asli Betawi' },
                  { Icon: Flame, t: 'Hangat di badan' },
                ].map(({ Icon, t }) => (
                  <span key={t} className="h-badge flex items-center gap-2 rounded-full bg-leaf px-[2.2vh] py-[1vh] font-display text-[clamp(1rem,2.8vh,1.7rem)] font-semibold text-cream opacity-0 shadow-[0_5px_0_#3f5226]">
                    <Icon className="size-[1.1em]" /> {t}
                  </span>
                ))}
              </div>
              <p className="h-line mt-[3vh] px-6 text-center font-cond text-[clamp(1rem,2.6vh,1.5rem)] font-semibold italic text-brown-soft" style={{ clipPath: 'inset(0 100% 0 0)' }}>
                Lahir di Batavia sebagai jawaban halal untuk bir Belanda — sejak zaman kolonial.
              </p>
            </div>
          </div>
        )}

        {/* ================= camera tour → finale line-up ================= */}
        {showTour && (
          <>
            <ParticleField preset={tourParticle} overrides={{ count: 70, opacity: station >= 0 ? 1 : 0 }} speed={1.4} />
            <ParticleField
              preset="burst"
              overrides={{ count: 90, shape: 'mixed', size: [6, 14], burstSpeed: [200, 650], gravity: 1400, colors: ['#a8572a', '#c98a3c', '#5e7b3a', '#ecdcc5'] }}
              points={[[W / 2 - H * cupH * 0.2, H * (0.5 + cupH / 2)], [W / 2 + H * cupH * 0.2, H * (0.5 + cupH / 2)]]}
              burstKey={landKey}
            />
            <div className="cam absolute inset-0 will-change-transform" style={{ transformOrigin: '50% 50%' }}>
              {/* motion's `initial` applies once — a re-render (e.g. resize) can't snap the strip back */}
              <motion.div className="strip absolute left-0 top-0 h-full will-change-transform" style={{ width: `${STOPS * 100}vw` }} initial={{ x: '100vw' }}>
                {live.drinks.map((d, i) => (
                  <Station key={d.id} drink={d} index={i} active={station === i} shown={reached >= i || scene === 'finale'} portrait={portrait} />
                ))}
                <BundleStop index={DRINKS.length} active={station === DRINKS.length} portrait={portrait} />
              </motion.div>
            </div>
          </>
        )}

        {scene === 'finale' && (
          <div className="pointer-events-none absolute inset-0">
            <ParticleField preset="leaf" overrides={{ count: 70, travel: [80, 160], size: [14, 28] }} />
            <ParticleField
              preset="burst"
              overrides={{ count: 400, shape: 'mixed', burstSpeed: [500, 1500], life: [2, 3.4], size: [10, 24] }}
              points={[[W * 0.15, H * 0.1], [W * 0.5, H * 0.05], [W * 0.85, H * 0.1], [W * 0.5, H * 0.55]]}
              burstKey={confettiKey}
            />
            <div className={`f-logo absolute inset-x-0 mx-auto opacity-0 ${portrait ? 'top-[9vh] w-[72vw]' : 'top-[5vh] w-[min(34vw,52vh)]'}`}>
              <LogoRig interactive={false} />
            </div>
            {/* a kawung medallion opens behind the stamp, like the carved panel above a Betawi door */}
            <div
              className="f-orn absolute left-1/2 top-[57%] size-[min(120vw,90vh)] -translate-x-1/2 -translate-y-1/2 opacity-0"
              style={{ maskImage: 'radial-gradient(circle, #000 25%, transparent 66%)', WebkitMaskImage: 'radial-gradient(circle, #000 25%, transparent 66%)' }}
            >
              <Kawung className={`size-full ${lite ? '' : 'animate-[spin_80s_linear_infinite]'}`} color="#a8572a" size={52} />
            </div>
            <div className="f-band absolute inset-x-0 top-0" style={{ transform: 'translateY(-100%)' }}>
              <GigiBalang color="#5a2e1a" accent="#c98a3c" size={portrait ? 26 : 38} />
            </div>
            <div className="absolute left-1/2 top-[57%] -translate-x-1/2 -translate-y-1/2 [perspective:800px]">
              <span className="stamp-dust absolute left-1/2 top-1/2 size-[34vh] -translate-x-1/2 -translate-y-1/2 rounded-full bg-terracotta/30 opacity-0" />
              <div className="stamp relative whitespace-nowrap rounded-2xl border-[5px] border-terracotta bg-cream px-[3vh] py-[1.2vh] font-display text-[min(9vh,8.5vw)] font-bold uppercase leading-none text-terracotta opacity-0 shadow-[0_10px_0_rgb(168_87_42/0.25)]">
                Resmi dibuka!
              </div>
            </div>
            <div className="absolute inset-x-0 bottom-[6vh] flex flex-wrap justify-center gap-[1vh] px-6">
              {[EVENT.dateLabel, EVENT.timeLabel, `${EVENT.place} · ${EVENT.campus}`, EVENT.table, `IG ${INSTAGRAM_HANDLE}`].map((t) => (
                <span key={t} className="f-info rounded-full bg-brown px-4 py-1.5 font-display text-[clamp(0.9rem,2.2vh,1.3rem)] font-semibold text-cream opacity-0">
                  {t}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* botanical backdrop: big swaying leaves frame every cream scene, drifting slower than the camera */}
        {!dark && <LeafBackdrop />}

        {/* Betawi eaves over every cream scene: gigi balang along the top, a tumpal sarung border along the bottom */}
        {!dark && scene !== 'finale' && (
          <motion.div className="pointer-events-none absolute inset-x-0 top-0 opacity-80" initial={{ y: '-100%' }} animate={{ y: '0%' }} transition={{ duration: 0.7, ease: ease.out }}>
            <GigiBalang color="#a8572a" accent="#f5ebdd" size={portrait ? 22 : 32} />
          </motion.div>
        )}
        {!dark && (
          <motion.div className="pointer-events-none absolute inset-x-0 bottom-0 opacity-25" initial={{ y: '100%' }} animate={{ y: '0%' }} transition={{ duration: 0.7, ease: ease.out }}>
            <Tumpal color="#5e7b3a" accent="#f5ebdd" size={portrait ? 18 : 26} />
          </motion.div>
        )}

        {/* leaves drift through every cream scene — the jamu signature */}
        {!dark && scene !== 'finale' && <ParticleField preset="leaf" overrides={{ count: 34, travel: [50, 110], size: [12, 24] }} />}

        {/* broadcast-style logo bug while the camera tours */}
        {showTour && !portrait && (
          <div className={`bug pointer-events-none absolute right-[3vw] top-[4vh] opacity-0 ${portrait ? 'w-[24vw]' : 'w-[min(13vw,20vh)]'}`}>
            <LogoRig interactive={false} />
          </div>
        )}

        {showDoors && <Lawang className="doors z-10" />}

        {/* the leaf that wipes each cut */}
        <svg viewBox="0 0 59 49" className="leaf-wipe pointer-events-none absolute left-1/2 top-1/2 z-20 h-[150vh] w-[180vh] -translate-x-1/2 -translate-y-1/2 opacity-0" aria-hidden>
          <path d="M26 41 C 18 41 5 34 1 18 C 12 18 23 26 26 41 Z" fill="#5e7b3a" />
          <path d="M29 41 C 27 22 38 6 58 1 C 59 20 49 37 29 41 Z" fill="#6a371c" />
          <path d="M33.5 34 C 37 24.5 43 15.5 50.5 9" stroke="#f5ebdd" strokeOpacity={0.5} strokeWidth={1.4} strokeLinecap="round" fill="none" />
          <path d="M21.5 35.5 C 15.5 32 10.5 27 7.5 22.5" stroke="#f5ebdd" strokeOpacity={0.4} strokeWidth={1.2} strokeLinecap="round" fill="none" />
        </svg>

        {/* ================= boom fx ================= */}
        <ParticleField preset="burst" overrides={{ count: 400, burstSpeed: [400, 1500], life: [1.8, 3.2], size: [10, 26] }} points={[center, ...ring(7, 140)]} burstKey={boomKey} />
        {[0, 1, 2].map((i) => (
          <span key={i} className="shock pointer-events-none absolute left-1/2 top-1/2 size-[40vh] -translate-x-1/2 -translate-y-1/2 rounded-full border-[6px] border-spice opacity-0" />
        ))}
        <div className="flash pointer-events-none absolute inset-0 bg-white opacity-0" />
      </div>

      {!counting && (
        <span className={`absolute bottom-3 right-4 z-10 font-cond text-xs font-semibold uppercase italic tracking-widest transition-colors duration-500 ${dark ? 'text-cream/35' : 'text-brown/35'}`}>{portrait ? 'ketuk 2× · lewati' : 'esc · lewati'}</span>
      )}
    </motion.div>
  )
}

/** One stop on the camera tour: big pale name, the cup drops in, ingredient callouts, the price */
function Station({ drink, index, active, shown, portrait }: { drink: (typeof DRINKS)[number]; index: number; active: boolean; shown: boolean; portrait: boolean }) {
  const word = drink.name.replace('Pletok ', '').split(' ')[0]
  return (
    <div className="absolute top-0 h-full w-screen" style={{ left: `${index * 100}vw` }}>
      <div className="absolute inset-0" style={{ background: `radial-gradient(ellipse 45% 55% at 50% 52%, ${drink.tint}, transparent 75%)` }} />
      {/* a pale, filled word — reads as backdrop, never fights the callouts */}
      <div className={`name name-${index} absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 overflow-hidden whitespace-nowrap`}>
        {word.split('').map((ch, k) => (
          <motion.span
            key={k}
            className="inline-block font-display text-[min(24vw,40vh)] font-bold uppercase leading-[1.05]"
            style={{ color: drink.accent, opacity: 0.13 }}
            initial={false}
            animate={shown ? { y: '0%' } : { y: '105%' }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: shown ? k * 0.04 : 0 }}
          >
            {ch}
          </motion.span>
        ))}
      </div>

      <motion.span
        className={`absolute left-[6%] font-cond text-[3vh] font-semibold uppercase italic tracking-[0.3em] ${portrait ? 'top-[5%]' : 'top-[9%]'}`}
        style={{ color: drink.accent }}
        animate={{ opacity: active ? 1 : 0, x: active ? 0 : -30 }}
        transition={{ duration: 0.5, ease: ease.out }}
      >
        0{index + 1} / 0{STOPS}
      </motion.span>

      {/* drop → squash on the coaster → idle bob (cup-N is flung off by the camera move) */}
      <div className={`cup-${index} absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 ${portrait ? 'h-[46vh]' : 'h-[62vh]'}`}>
        <motion.div
          className="h-full"
          initial={false}
          animate={active ? { y: [0, -14, 0], rotate: [0, 1.6, 0, -1.6, 0] } : { y: 0, rotate: 0 }}
          transition={active ? { duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: 0.9 } : { duration: 0.3 }}
        >
          <motion.img
            src={drink.image}
            alt={drink.name}
            draggable={false}
            className="cup-img h-full w-auto object-contain drop-shadow-[0_40px_40px_rgb(90_46_26/0.35)]"
            style={{ transformOrigin: '50% 100%' }}
            initial={{ y: '-120vh', opacity: 0 }}
            animate={
              shown
                ? { y: ['-120vh', '0vh', '0vh', '0vh'], scaleY: [1.12, 0.8, 1.06, 1], scaleX: [0.9, 1.16, 0.97, 1], rotate: [-14, 0, 0, 0], opacity: 1 }
                : { y: '-120vh', opacity: 0 }
            }
            transition={{ duration: 0.85, times: [0, 0.5, 0.75, 1], ease: ['easeIn', 'easeOut', 'easeInOut'] }}
          />
        </motion.div>
        {/* contact shadow grows as the cup falls */}
        <motion.span
          className="absolute -bottom-[1vh] left-1/2 h-[3vh] w-[70%] -translate-x-1/2 rounded-[50%] bg-brown/25"
          initial={false}
          animate={shown ? { scaleX: [0.2, 1.1, 1], opacity: [0, 1, 1] } : { scaleX: 0.2, opacity: 0 }}
          transition={{ duration: 0.85, times: [0, 0.5, 1] }}
        />
      </div>

      {/* portrait: ingredient chips pop in above the cup */}
      {portrait && (
        <motion.div
          className="absolute inset-x-0 top-[11%] flex flex-wrap justify-center gap-2 px-6"
          initial={false}
          animate={active ? 'on' : 'off'}
          variants={{ on: { transition: { delayChildren: 0.5, staggerChildren: 0.1 } }, off: {} }}
        >
          {drink.ingredients.map((ing) => (
            <motion.span
              key={ing}
              className="rounded-full bg-brown px-3 py-1 font-display text-[2vh] font-semibold text-cream"
              variants={{ on: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring', stiffness: 420, damping: 18 } }, off: { opacity: 0, scale: 0.5, y: 10 } }}
            >
              {ing}
            </motion.span>
          ))}
        </motion.div>
      )}

      {!portrait && (
        <>
      {/* callouts draw out from the cup */}
      {drink.ingredients.map((ing, k) => {
        const leftSide = k % 2 === 0
        const top = 26 + Math.floor(k / 2) * 15
        return (
          <motion.div
            key={ing}
            className={`absolute flex items-center ${leftSide ? 'flex-row-reverse' : ''}`}
            style={{ top: `${top}%`, ...(leftSide ? { right: 'calc(50% + 15vh)' } : { left: 'calc(50% + 15vh)' }) }}
            initial={false}
            animate={active ? 'on' : 'off'}
            variants={{ on: { transition: { delayChildren: 0.5 + k * 0.18, staggerChildren: 0.12 } }, off: {} }}
          >
            <motion.span className="size-3 rounded-full border-[3px] bg-cream" style={{ borderColor: drink.accent }} variants={{ on: { scale: 1 }, off: { scale: 0 } }} />
            <motion.span
              className="h-[2px] w-[7vw]"
              style={{ background: drink.accent, originX: leftSide ? 1 : 0 }}
              variants={{ on: { scaleX: 1, transition: { duration: 0.35, ease: ease.out } }, off: { scaleX: 0 } }}
            />
            <motion.span
              className="rounded-full bg-brown px-[1.6vh] py-[0.7vh] font-display text-[2.4vh] font-semibold text-cream"
              variants={{ on: { opacity: 1, x: 0, transition: { type: 'spring', stiffness: 420, damping: 22 } }, off: { opacity: 0, x: leftSide ? 20 : -20 } }}
            >
              {ing}
            </motion.span>
          </motion.div>
        )
      })}

        </>
      )}

      <motion.div
        className={`absolute inset-x-0 flex items-center justify-center gap-[2vh] px-6 text-center ${portrait ? 'bottom-[8%] flex-col gap-[1.2vh]' : 'bottom-[6%]'}`}
        initial={false}
        animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
        transition={{ type: 'spring', stiffness: 260, damping: 22, delay: active ? 0.3 : 0 }}
      >
        <span className="font-display text-[min(5vh,7.5vw)] font-bold uppercase leading-none text-brown">{drink.name}</span>
        <motion.span
          className="rounded-2xl px-[1.6vh] py-[0.6vh] font-display text-[5vh] font-bold leading-none text-cream shadow-[0_6px_0_rgb(90_46_26/0.3)]"
          style={{ background: drink.accent }}
          initial={false}
          animate={active ? { scale: [0, 1.25, 1], rotate: [-20, 4, -3] } : { scale: 0 }}
          transition={{ duration: 0.5, delay: active ? 1.4 : 0 }}
        >
          {drink.price}K
        </motion.span>
      </motion.div>
    </div>
  )
}

/** Last tour stop: the three bundles — old price gets struck, the deal stamps in */
function BundleStop({ index, active, portrait }: { index: number; active: boolean; portrait: boolean }) {
  const { bundles } = useMenu()
  return (
    <div className="bundle-stop absolute top-0 h-full w-screen" style={{ left: `${index * 100}vw` }}>
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 55% 55% at 50% 55%, #f1d3a8, transparent 75%)' }} />
      <span className={`absolute left-[6%] font-cond text-[3vh] font-semibold uppercase italic tracking-[0.3em] text-terracotta ${portrait ? 'top-[2%]' : 'top-[9%]'}`}>
        0{index + 1} / 0{STOPS}
      </span>
      <motion.div
        className={`name name-${index} absolute inset-x-0 flex flex-col items-center ${portrait ? 'top-[6%]' : 'top-[5%]'}`}
        initial={false}
        animate={active ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: -30, scale: 0.9 }}
        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
      >
        <h3 className="font-display text-[min(8vh,11vw)] font-bold uppercase leading-none text-brown">Paket hemat</h3>
        <p className="font-script text-[min(4vh,6vw)] font-bold leading-tight text-terracotta">Lebih hemat bareng teman!</p>
      </motion.div>

      <div className={`absolute inset-x-[5%] bottom-[5%] grid ${portrait ? 'top-[19%] grid-rows-3 gap-[2vh]' : 'top-[25%] grid-cols-3 gap-[3vw]'}`}>
        {bundles.map((b, k) => (
          <motion.div
            key={b.name}
            className={`flex min-h-0 items-center ${portrait ? 'flex-row gap-4 rounded-3xl bg-[#fbf5ec]/80 px-3' : 'flex-col'}`}
            initial={false}
            animate={active ? { opacity: 1, y: 0, scale: 1 } : { opacity: 0, y: 80, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 200, damping: 20, delay: active ? 0.3 + k * 0.18 : 0 }}
          >
            <div className={`flex min-h-0 items-end justify-center ${portrait ? 'h-full w-[42%] shrink-0 py-2' : 'flex-1'}`}>
              {b.items.map((id, j) => (
                <img
                  key={id}
                  src={drinkById(id).image}
                  alt=""
                  draggable={false}
                  className="h-full max-h-[36vh] min-w-0 object-contain object-bottom drop-shadow-[0_20px_20px_rgb(90_46_26/0.3)]"
                  style={{ marginInline: b.items.length > 2 ? '-3.5vw' : '-2.5vw', zIndex: j === 1 ? 2 : 1, maxWidth: b.items.length > 2 ? '42%' : '58%' }}
                />
              ))}
            </div>
            <div className={`flex flex-col ${portrait ? 'items-start text-left' : 'items-center text-center'}`}>
            <p className={`font-display font-bold uppercase leading-none text-brown ${portrait ? 'text-[3.2vh]' : 'mt-[2vh] text-[4.2vh]'}`}>{b.name.replace('Paket ', '')}</p>
            <p className="mt-[0.8vh] font-cond text-[2vh] font-semibold italic leading-tight text-brown-soft">{b.detail}</p>
            <div className="mt-[1.6vh] flex items-center gap-[1.4vh]">
              {/* no strike when a price edit made the bundle cost the same as its cups */}
              {b.normal > b.price && <span className="relative font-display text-[3.4vh] font-bold text-brown/45">
                {b.normal}K
                <motion.span
                  className="absolute inset-x-[-8%] top-1/2 h-[3px] origin-left rounded-full bg-terracotta"
                  initial={false}
                  animate={{ scaleX: active ? 1 : 0 }}
                  transition={{ duration: 0.35, delay: active ? 1.1 + k * 0.25 : 0 }}
                />
              </span>}
              <motion.span
                className="rounded-2xl bg-terracotta px-[1.6vh] py-[0.5vh] font-display text-[5vh] font-bold leading-none text-cream shadow-[0_6px_0_rgb(90_46_26/0.3)]"
                initial={false}
                animate={active ? { scale: [0, 1.3, 1], rotate: [-20, 5, -3] } : { scale: 0 }}
                transition={{ duration: 0.5, delay: active ? 1.4 + k * 0.25 : 0 }}
              >
                {b.price}K
              </motion.span>
            </div>
            {b.normal > b.price && <motion.span
              className="mt-[1vh] rounded-full bg-leaf px-3 py-0.5 font-cond text-[2vh] font-semibold uppercase italic text-cream"
              initial={false}
              animate={{ opacity: active ? 1 : 0, scale: active ? 1 : 0.5 }}
              transition={{ ...{ type: 'spring', stiffness: 400, damping: 18 }, delay: active ? 1.8 + k * 0.25 : 0 }}
            >
              hemat {b.normal - b.price}K
            </motion.span>}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}

/** Big swaying leaves around the frame — the botanical set the whole show plays in */
const BG_LEAVES = [
  { x: -4, y: -8, s: 34, r: 150, c: '#5e7b3a' },
  { x: 8, y: 70, s: 26, r: 30, c: '#8faa4f' },
  { x: -6, y: 40, s: 22, r: 100, c: '#a3b860' },
  { x: 86, y: -10, s: 30, r: -150, c: '#6f8c3f' },
  { x: 94, y: 48, s: 26, r: -100, c: '#5e7b3a' },
  { x: 80, y: 78, s: 32, r: -30, c: '#a3b860' },
  { x: 40, y: 92, s: 20, r: 10, c: '#8faa4f' },
  { x: 116, y: 10, s: 30, r: -160, c: '#8faa4f' },
  { x: 128, y: 70, s: 34, r: -40, c: '#5e7b3a' },
  { x: 150, y: -6, s: 24, r: 170, c: '#a3b860' },
  { x: 164, y: 60, s: 30, r: -80, c: '#6f8c3f' },
]
function LeafBackdrop() {
  return (
    <div className="leaf-bg pointer-events-none absolute inset-y-0 left-0 w-[200vw]">
      {BG_LEAVES.map((l, i) => (
        <motion.svg
          key={i}
          viewBox="0 0 32 41"
          className="absolute"
          style={{ left: `${l.x / 2}%`, top: `${l.y}%`, width: `${l.s}vh`, height: `${l.s * 1.28}vh`, opacity: 0.16 }}
          initial={{ scale: 0, rotate: l.r - 40 }}
          animate={{ scale: 1, rotate: [l.r, l.r + 7, l.r - 4, l.r] }}
          transition={{
            scale: { type: 'spring', stiffness: 120, damping: 14, delay: 0.1 + i * 0.05 },
            rotate: { duration: 5 + (i % 4), repeat: Infinity, ease: 'easeInOut' },
          }}
        >
          <path d="M2 40 C 0 21 11 5 31 0 C 32 19 22 36 2 40 Z" fill={l.c} />
          <path d="M6.5 33 C 10 23.5 16 14.5 23.5 8" stroke="#f5ebdd" strokeWidth={1.4} strokeLinecap="round" fill="none" />
        </motion.svg>
      ))}
    </div>
  )
}


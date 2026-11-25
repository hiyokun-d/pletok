import { AnimatePresence, animate as animateValue, motion, stagger, useAnimate, useInView, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowDown, ArrowUpRight, Clock, Coffee, Download, Heart, Images, MessageCircleHeart, Play, Quote, RotateCcw, ScanLine, ShoppingBag, Star } from 'lucide-react'
import { DRINKS, drinkById, type DrinkId } from '../data/menu'
import { LEAF_BOX, LETTERS, LOGO_BOX, TAGLINE, pct } from '../data/logo'
import { EVENT, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../data/event'
import { CREW, DEV_NOTE, FAQ, IDEAS, JOURNEY, LOVES, MEDIA, RECAP, STORY_VIDEO, WISHES, thumb, videoSrc, type Media } from '../data/recap'
import { WindLeaves } from '../components/WindLeaves'
import { LogoPiece } from '../components/LogoPiece'
import { Sprout } from '../components/Sprout'
import { InstagramIcon } from '../components/InstagramIcon'
import { Batik, GigiBalang, Kawung, Lawang, Tumpal, type BatikKind } from '../components/BetawiPattern'
import { Reveal, RevealItem } from '../components/Reveal'
import { MediaLightbox } from '../components/MediaLightbox'
import { ease, spring } from '../lib/motion'
import { useLite } from '../lib/perf'
import cupOriginal from '../assets/cup-original-sm.webp'
import cupLychee from '../assets/cup-lychee-sm.webp'
import cupYakult from '../assets/cup-yakult-sm.webp'

const CREAM = '#f5ebdd'
const BROWN = '#5a2e1a'
/** the cups at the size this page shows them (~46 KB for all three instead of ~500 KB) */
const CUP: Record<DrinkId, string> = { original: cupOriginal, lychee: cupLychee, yakult: cupYakult }
const num = (n: number, d = 0) => n.toLocaleString('id-ID', { minimumFractionDigits: d, maximumFractionDigits: d })
const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * After closing: the whole day on one scrolling page — the numbers (never money), the road to the
 * day, the batik we showed, the crew, what customers wrote (no names), the gallery and the story
 * video. Everything comes from data/recap, so it stands on its own with the Google Sheet unplugged.
 * Same page on the booth laptop and on phones: the menu is gone, there's just the recap to scroll.
 *
 * Cheap phones (lib/perf lite): the wind leaves stay — fewer of them — but no parallax, no autoplay
 * video and no live site preview; everything else is transforms and opacity only.
 */
export function RecapSite({ desktop, onReplay }: { desktop: boolean; onReplay: () => void }) {
  const [shown, setShown] = useState<number | null>(null)
  useEffect(() => {
    document.title = 'Pletok · Rekap BINUS Festival'
  }, [])

  return (
    <motion.main className="relative overflow-x-clip bg-cream text-brown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.4 }}>
      <Hero desktop={desktop} onReplay={onReplay} />
      <Marquee />
      <Numbers />
      <Journey />
      <Crew />
      <Reviews />
      <GalleryTeaser onOpen={setShown} />
      <Finale desktop={desktop} />
      <Outro />
      <MediaLightbox items={MEDIA} at={shown} onAt={setShown} />
      <TravelLogo />
      <Doors />
    </motion.main>
  )
}

/* ------------------------------------------------------------------ bits */

function Kicker({ children, light }: { children: ReactNode; light?: boolean }) {
  return <p className={`font-cond text-sm font-semibold uppercase italic tracking-[0.2em] sm:text-base sm:tracking-[0.3em] ${light ? 'text-yakult' : 'text-terracotta'}`}>{children}</p>
}
function H2({ children, light }: { children: ReactNode; light?: boolean }) {
  return <h2 className={`mt-2 font-display text-[clamp(2.2rem,7vw,4.6rem)] font-bold leading-[0.95] ${light ? 'text-cream' : 'text-brown'}`}>{children}</h2>
}

/** counts up once, the first time it scrolls into view */
function CountUp({ to, decimals = 0 }: { to: number; decimals?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const seen = useInView(ref, { once: true, amount: 0.6 })
  useEffect(() => {
    const el = ref.current
    if (!el || !seen) return
    const c = animateValue(0, to, { duration: Math.min(1.8, 0.7 + to / 80), ease: ease.out, onUpdate: (v) => (el.textContent = num(v, decimals)) })
    return () => c.stop()
  }, [seen, to, decimals])
  return <span ref={ref}>{num(0, decimals)}</span>
}

function Stars({ n, className = 'size-4', dim = 'text-brown/20' }: { n: number; className?: string; dim?: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${n} dari 5 bintang`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`${className} ${i <= Math.round(n) ? 'fill-spice text-spice' : dim}`} />
      ))}
    </span>
  )
}

/** a rubber stamp that slams down when it scrolls into view */
function Stamp({ children, className = '', delay = 0.2 }: { children: ReactNode; className?: string; delay?: number }) {
  return (
    <motion.span
      className={`pointer-events-none absolute z-10 rounded-xl border-[3px] border-terracotta bg-cream/95 px-3 py-1 font-display font-bold uppercase leading-none text-terracotta shadow-[0_4px_0_rgb(168_87_42/0.25)] ${className}`}
      initial={{ scale: 2.6, opacity: 0, rotate: -26 }}
      whileInView={{ scale: 1, opacity: 1, rotate: -11 }}
      viewport={{ once: true, amount: 1 }}
      transition={{ type: 'spring', stiffness: 520, damping: 17, delay }}
    >
      {children}
    </motion.span>
  )
}

/**
 * A section's cloth: one batik motif printed faintly across the whole background, fading out
 * toward the edges like the worn part of a kain. Plain SVG pattern, drawn once, never animated.
 */
function Kain({ kind, color, opacity = 0.07, size = 56 }: { kind: BatikKind; color: string; opacity?: number; size?: number }) {
  return (
    <div className="pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_70%_30%,black_10%,transparent_75%)]" style={{ opacity }} aria-hidden>
      <Batik kind={kind} className="absolute inset-0 h-full w-full" color={color} size={size} />
    </div>
  )
}

/** the little kawung flower — our separator instead of a generic sparkle */
function KawungMark({ className = '' }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" className={className} aria-hidden>
      {[0, 90, 180, 270].map((r) => (
        <ellipse key={r} cx="10" cy="5" rx="3.2" ry="4.6" fill="currentColor" transform={`rotate(${r} 10 10)`} />
      ))}
      <circle cx="10" cy="10" r="1.4" fill="#5a2e1a" />
    </svg>
  )
}

/** a real photo taped onto the page, slightly crooked, with a handwritten caption */
function Polaroid({ m, caption, tilt, className = '' }: { m: Media; caption: string; tilt: number; className?: string }) {
  return (
    <motion.figure
      className={`relative bg-[#fbf6ee] p-2.5 pb-3 shadow-[0_18px_40px_-18px_rgb(0_0_0/0.6)] sm:p-3 sm:pb-4 ${className}`}
      initial={{ opacity: 0, y: 30, rotate: tilt * 3 }}
      whileInView={{ opacity: 1, y: 0, rotate: tilt }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ type: 'spring', stiffness: 140, damping: 16 }}
    >
      {/* two bits of tape */}
      <span className="absolute -top-3 left-6 h-6 w-16 -rotate-6 bg-yakult/80" />
      <span className="absolute -top-3 right-6 h-6 w-14 rotate-[8deg] bg-yakult/70" />
      <img {...thumb(m, '(min-width: 1024px) 360px, 70vw')} alt={m.caption} loading="lazy" decoding="async" className="block w-full object-cover" style={{ aspectRatio: `${m.w} / ${m.h}` }} />
      <figcaption className="mt-2 text-center font-script text-2xl font-bold leading-none text-brown sm:text-3xl">{caption}</figcaption>
    </motion.figure>
  )
}

/* ------------------------------------------------------------------ the logo */

/**
 * One logo for the whole page, drawn once. It waits docked at the top-left of the screen; when a
 * spot for it (LogoSlot) scrolls into view — the hero, the crew header, the finale — it flies into
 * that spot on a spring and the letters do a little hop as it lands, then it flies back to the dock
 * when the spot scrolls away. Inside a spot it's locked to the page (no lag while scrolling): only
 * the flight between places is sprung. In a spot its ink suits that spot; in the dock it wears a dark chip.
 */
type Tone = 'dark' | 'light'
const SLOTS = new Map<HTMLElement, Tone>()
const BASE = 320 // drawn once at this width; moved and scaled with transforms only
const dock = () => ({ x: window.innerWidth < 640 ? 12 : 20, y: window.innerWidth < 640 ? 12 : 18, w: window.innerWidth < 640 ? 72 : 100 })

/** a place the logo flies into; `tone` is the background around it */
function LogoSlot({ width, tone = 'dark', className = '' }: { width: string; tone?: Tone; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current!
    SLOTS.set(el, tone)
    window.dispatchEvent(new Event('pletok:slots'))
    return () => {
      SLOTS.delete(el)
      window.dispatchEvent(new Event('pletok:slots'))
    }
  }, [tone])
  return <div ref={ref} aria-hidden className={`shrink-0 ${className}`} style={{ width, aspectRatio: `${LOGO_BOX.w} / ${LOGO_BOX.h}` }} />
}

function TravelLogo() {
  const [scope, animate] = useAnimate()
  // where it is: the spot's position, set straight from the scroll…
  const bx = useMotionValue(0)
  const by = useMotionValue(0)
  const bs = useMotionValue(0.2)
  // …plus a sprung offset that carries it there whenever it changes place
  const fly = { stiffness: 170, damping: 22, mass: 0.9 }
  const ox = useSpring(0, fly)
  const oy = useSpring(0, fly)
  const os = useSpring(0, fly)
  const x = useTransform([bx, ox], ([a, b]: number[]) => a + b)
  const y = useTransform([by, oy], ([a, b]: number[]) => a + b)
  const scale = useTransform([bs, os], ([a, b]: number[]) => a + b)
  const [docked, setDocked] = useState(false)
  const [tone, setTone] = useState<Tone>('dark')
  const [ready, setReady] = useState(false)
  const [shake, setShake] = useState(0)

  useEffect(() => {
    let raf = 0
    let place: HTMLElement | null | undefined // undefined = not placed yet
    const measure = () => {
      raf = 0
      const vh = window.innerHeight
      let el: HTMLElement | null = null
      let r: { left: number; top: number; width: number } | null = null
      for (const s of SLOTS.keys()) {
        const b = s.getBoundingClientRect()
        if (b.width && b.top < vh * 0.78 && b.bottom > vh * 0.18) ((el = s), (r = b))
        if (el) break
      }
      const d = dock()
      const next = r ?? { left: d.x, top: d.y, width: d.w }
      if (el !== place) {
        // changing place: keep it where it's drawn now, then let the spring carry it over
        if (place !== undefined) {
          ox.jump(x.get() - next.left)
          oy.jump(y.get() - next.top)
          os.jump(scale.get() - next.width / BASE)
          ox.set(0)
          oy.set(0)
          os.set(0)
        }
        if (el && place !== undefined) void animate('.lp', { y: ['0%', '-18%', '0%'] }, { duration: 0.5, delay: stagger(0.045, { startDelay: 0.35 }) })
        place = el
        setDocked(!el)
        setReady(true)
      }
      bx.set(next.left)
      by.set(next.top)
      bs.set(next.width / BASE)
      // the ink: the spot's own background; in the dock it sits on its own dark chip
      setTone(el ? SLOTS.get(el)! : 'dark')
    }
    const req = () => (raf ||= requestAnimationFrame(measure))
    req()
    // fonts and pictures settle the layout a moment later
    const late = [300, 1200].map((ms) => window.setTimeout(req, ms))
    window.addEventListener('scroll', req, { passive: true })
    window.addEventListener('resize', req)
    window.addEventListener('pletok:slots', req)
    return () => {
      cancelAnimationFrame(raf)
      late.forEach(clearTimeout)
      window.removeEventListener('scroll', req)
      window.removeEventListener('resize', req)
      window.removeEventListener('pletok:slots', req)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <motion.button
      ref={scope}
      type="button"
      onClick={() => (docked ? window.scrollTo({ top: 0, behavior: 'smooth' }) : setShake((n) => n + 1))}
      onPointerEnter={() => setShake((n) => n + 1)}
      aria-label={docked ? 'Pletok, kembali ke atas' : 'Pletok'}
      className="fixed left-0 top-0 z-40 origin-top-left cursor-pointer select-none transition-colors duration-500"
      style={{ x, y, scale, width: BASE, aspectRatio: `${LOGO_BOX.w} / ${LOGO_BOX.h}`, color: tone === 'dark' ? CREAM : BROWN, visibility: ready ? 'visible' : 'hidden', willChange: 'transform' }}
    >
      {/* the dock's chip: the logo reads over any section or card that scrolls under it */}
      <motion.span
        className="absolute -inset-x-[34px] -inset-y-[26px] block rounded-[64px] bg-[#2b160c]/90 shadow-[0_12px_40px_-10px_rgb(0_0_0/0.5)] ring-[3px] ring-cream/15"
        initial={false}
        animate={{ opacity: docked ? 1 : 0, scale: docked ? 1 : 0.8 }}
        transition={{ duration: 0.35 }}
      />
      {[...LETTERS, TAGLINE].map((p, i) => (
        // three layers, so nothing interrupts anything: the tagline steps out in the dock (too small
        // to read there), the first drop-in, and the hop on landing
        <motion.span key={p.id} className="absolute block" style={pct(p)} animate={{ opacity: p === TAGLINE && docked ? 0 : 1 }}>
          <motion.span
            className="block h-full w-full"
            initial={{ y: '-120%', opacity: 0, rotate: i % 2 ? 12 : -12 }}
            animate={ready ? { y: '0%', opacity: 1, rotate: 0 } : undefined}
            transition={{ type: 'spring', stiffness: 420, damping: 15, delay: 0.2 + 0.08 * i }}
          >
            <span className="lp block h-full w-full">
              <LogoPiece part={p} color="currentColor" className="h-full w-full" />
            </span>
          </motion.span>
        </motion.span>
      ))}
      <span className="absolute block" style={pct(LEAF_BOX)}>
        <Sprout state={ready ? 'grow' : 'hidden'} wiggleKey={shake} color="#a3b860" veinColor={tone === 'dark' ? BROWN : CREAM} className="h-full w-full" />
      </span>
    </motion.button>
  )
}

/* ------------------------------------------------------------------ the doors */

/**
 * The page opens like the booth did on 13.00: two carved Lawang doors swing apart. Once per visit
 * (a reload in the same tab skips it), never with reduced motion. Only transforms — fine on any phone.
 */
function Doors() {
  const [scope, animate] = useAnimate()
  const [on, setOn] = useState(() => {
    try {
      return !reduced() && !sessionStorage.getItem('pletok:doors')
    } catch {
      return !reduced()
    }
  })
  useEffect(() => {
    if (!on) return
    try {
      sessionStorage.setItem('pletok:doors', '1')
    } catch {
      /* fine */
    }
    let alive = true
    void (async () => {
      await animate('.door-plate', { opacity: [0, 1], scale: [0.8, 1] }, { duration: 0.35, delay: 0.15 })
      await animate('.door-plate', { opacity: 0, scale: 1.15 }, { duration: 0.25, delay: 0.35 })
      animate('.door-l', { rotateY: -112 }, { duration: 1.1, ease: [0.6, 0, 0.2, 1] })
      await animate('.door-r', { rotateY: 112 }, { duration: 1.1, ease: [0.6, 0, 0.2, 1] })
      if (alive) setOn(false)
    })()
    return () => {
      alive = false
    }
  }, [on, animate])
  if (!on) return null
  return (
    <div ref={scope} className="pointer-events-none fixed inset-0 z-[70]" aria-hidden>
      <Lawang />
      <div className="door-plate absolute inset-0 grid place-items-center opacity-0">
        <span className="rounded-2xl border-2 border-[#c98a3c] bg-[#2b160c] px-6 py-3 font-cond text-lg font-semibold uppercase italic tracking-[0.35em] text-[#f1d3a8]">Rekap Meja 9</span>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ hero */

function Hero({ desktop, onReplay }: { desktop: boolean; onReplay: () => void }) {
  const lite = useLite()
  return (
    <section className="relative flex min-h-[100svh] flex-col overflow-hidden bg-brown text-cream">
      <Kawung className="pointer-events-none absolute inset-0 opacity-[0.05]" size={88} />
      {/* the signature: leaves on real wind physics — stir them with a finger or the mouse */}
      <WindLeaves count={lite ? 12 : desktop ? 40 : 22} opacity={0.75} size={desktop ? [18, 34] : [14, 26]} className="absolute inset-0 h-full w-full" />

      <motion.div
        className="relative mx-auto grid w-full max-w-7xl flex-1 items-center gap-10 px-4 pb-28 pt-16 sm:px-8 sm:pt-12 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16"
        // the stamp lands → the whole hero takes the hit
        animate={{ x: [0, 0, -7, 6, -3, 0], y: [0, 0, 4, -3, 1, 0] }}
        transition={{ duration: 0.45, times: [0, 0.01, 0.25, 0.5, 0.75, 1], delay: 2.05 }}
      >
        <div className="flex flex-col items-center text-center lg:items-start lg:text-left">
          <LogoSlot width={desktop ? 'min(26vw, 340px)' : 'min(58vw, 260px)'} />
          <motion.div className="mt-7" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
            <Kicker light>{EVENT.name} · 25.11.2026 · {EVENT.table}</Kicker>
          </motion.div>
          <div className="relative">
            <motion.h1
              className="-ml-2 mt-2 py-2 pl-2 pr-6 font-script text-[clamp(3.6rem,17vw,9.5rem)] font-bold leading-[0.85] text-yakult"
              initial={{ clipPath: 'inset(0 100% 0 0)' }}
              animate={{ clipPath: 'inset(0 0% 0 0)' }}
              transition={{ duration: 1, delay: 0.6, ease: ease.inOut }}
            >
              Terima
              <br />
              kasih!
            </motion.h1>
            <motion.span
              className="absolute -right-1 bottom-1 rounded-xl border-[3px] border-lychee bg-brown/90 px-3 py-1 font-display text-[clamp(1.1rem,4.5vw,2rem)] font-bold uppercase leading-none text-lychee sm:-right-6"
              initial={{ scale: 3, opacity: 0, rotate: -30 }}
              animate={{ scale: 1, opacity: 1, rotate: -12 }}
              transition={{ type: 'spring', stiffness: 560, damping: 16, delay: 1.9 }}
            >
              Ludes!
            </motion.span>
          </div>
          <motion.p className="mt-4 max-w-xl font-display text-[clamp(1.05rem,2.6vw,1.45rem)] leading-snug text-cream/85" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.glide, delay: 1.1 }}>
            Tiga jam, {RECAP.cups} cup, habis 13 menit sebelum tutup. Ini rekap Pletok di {EVENT.name}.
          </motion.p>

          <motion.ul className="mt-6 flex flex-wrap justify-center gap-2 lg:justify-start" initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.08, delayChildren: 1.3 } } }}>
            {[
              { Icon: Coffee, t: `${RECAP.cups} cup` },
              { Icon: Clock, t: `Ludes ${RECAP.soldOutAt}` },
              { Icon: Star, t: `${num(RECAP.rating, 1)} · ${RECAP.feedbacks} feedback` },
            ].map(({ Icon, t }) => (
              <motion.li key={t} variants={{ hidden: { opacity: 0, y: 12, scale: 0.9 }, show: { opacity: 1, y: 0, scale: 1, transition: spring.pop } }} className="flex items-center gap-2 rounded-full bg-cream/10 px-3.5 py-2 font-display text-sm font-semibold ring-1 ring-cream/15 sm:px-4 sm:text-base">
                <Icon className="size-4 text-yakult" /> {t}
              </motion.li>
            ))}
          </motion.ul>

          <motion.div className="mt-7 flex w-full flex-col items-stretch gap-3 min-[400px]:w-auto min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:justify-center lg:justify-start" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ ...spring.glide, delay: 1.6 }}>
            <a href="/gallery" className="inline-flex items-center justify-center gap-2 rounded-full bg-cream px-6 py-3.5 font-display text-lg font-bold text-brown shadow-[0_5px_0_#c9b39a] transition-transform active:translate-y-1 active:shadow-none">
              <Images className="size-5" /> Lihat galeri
            </a>
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-cream/60 px-6 py-3 font-display text-lg font-semibold text-cream hover:bg-cream/10">
              <InstagramIcon /> {INSTAGRAM_HANDLE}
            </a>
          </motion.div>
        </div>

        <motion.div className="flex justify-center" initial={{ opacity: 0, y: 40, rotate: 4 }} animate={{ opacity: 1, y: 0, rotate: desktop ? -3 : 0 }} transition={{ ...spring.glide, delay: 0.8 }}>
          <StoryPhone autoplay={desktop && !lite} />
        </motion.div>
      </motion.div>

      <button onClick={onReplay} className="absolute right-2 top-[max(0.5rem,env(safe-area-inset-top))] z-10 flex items-center gap-1.5 rounded-full px-3 py-2 font-cond text-sm font-semibold italic text-cream/45 hover:text-cream">
        <RotateCcw className="size-4" /> Putar penutupan
      </button>
      <a href="#angka" className="pk-float absolute bottom-14 left-1/2 z-10 -translate-x-1/2 text-cream/60" aria-label="Scroll">
        <ArrowDown className="size-7" />
      </a>
      <GigiBalang className="absolute inset-x-0 bottom-0" color={CREAM} accent="#a8572a" flip />
    </section>
  )
}

/** the 9:16 story video in a phone — plays by itself on the booth laptop, on a tap on phones */
function StoryPhone({ autoplay }: { autoplay: boolean }) {
  const ref = useRef<HTMLVideoElement>(null)
  const [playing, setPlaying] = useState(autoplay)
  const play = () => {
    const v = ref.current
    if (!v) return
    v.muted = false
    v.controls = true
    v.preload = 'auto'
    void v.play()
    setPlaying(true)
  }
  return (
    <div id="story" className="relative w-[min(68vw,330px)] rounded-[2.4rem] bg-[#1d0f08] p-2 shadow-[0_40px_80px_-30px_rgb(0_0_0/0.7)] ring-1 ring-cream/15 sm:p-2.5">
      <div className="relative overflow-hidden rounded-[2rem] bg-black" style={{ aspectRatio: `${STORY_VIDEO.w} / ${STORY_VIDEO.h}` }}>
        <video
          ref={ref}
          src={videoSrc(STORY_VIDEO.file)}
          poster={`/gallery/${STORY_VIDEO.file}${autoplay ? '' : '-xs'}.webp`}
          autoPlay={autoplay}
          muted
          loop
          playsInline
          preload={autoplay ? 'auto' : 'none'}
          className="absolute inset-0 h-full w-full object-cover"
        />
        {!playing && (
          <button onClick={play} className="absolute inset-0 grid place-items-center bg-black/25" aria-label="Putar video story">
            <span className="grid size-16 place-items-center rounded-full bg-cream/90 text-brown shadow-xl sm:size-20">
              <Play className="ml-1 size-8 fill-brown sm:size-9" />
            </span>
          </button>
        )}
      </div>
      <a href={videoSrc(STORY_VIDEO.file)} download="pletok-story.mp4" className="absolute -bottom-11 left-1/2 flex -translate-x-1/2 items-center gap-1.5 whitespace-nowrap font-cond text-sm font-semibold italic text-cream/60 hover:text-cream">
        <Download className="size-4" /> Simpan video story
      </a>
    </div>
  )
}

/* ------------------------------------------------------------------ marquee */

const BAND = [`${RECAP.cups} cup`, `Ludes ${RECAP.soldOutAt}`, `★ ${num(RECAP.rating, 1)}`, `${RECAP.orders} pesanan`, `${RECAP.scans} scan`, 'Makasih BINUS Festival']

/** a tilted ticker between hero and numbers — one CSS animation, runs on the compositor */
function Marquee() {
  const row = (hidden?: boolean) => (
    <span className="flex shrink-0 items-center" aria-hidden={hidden}>
      {BAND.map((t) => (
        <span key={t} className="flex items-center whitespace-nowrap px-4 font-display text-[clamp(1.3rem,4.5vw,2.4rem)] font-bold uppercase sm:px-6">
          {t} <KawungMark className="ml-8 size-[0.7em] text-yakult sm:ml-12" />
        </span>
      ))}
    </span>
  )
  return (
    <div className="relative z-10 -my-3 -rotate-2 overflow-hidden bg-terracotta py-2.5 text-cream shadow-[0_14px_30px_-18px_rgb(90_46_26/0.8)] sm:py-3">
      <Tumpal className="absolute inset-x-0 top-0 opacity-40" color="#5a2e1a" accent="#f1d3a8" size={18} flip />
      <div className="pk-marquee flex w-max py-2">
        {row()}
        {row(true)}
      </div>
      <Tumpal className="absolute inset-x-0 bottom-0 opacity-40" color="#5a2e1a" accent="#f1d3a8" size={18} />
    </div>
  )
}

/* ------------------------------------------------------------------ the numbers */

function Numbers() {
  const tiles = [
    { Icon: Coffee, n: RECAP.cups, label: 'cup terjual', sub: 'paket dihitung per cup' },
    { Icon: ShoppingBag, n: RECAP.orders, label: 'pesanan', sub: `${RECAP.boothOrders} di booth · ${RECAP.preorders} pre-order` },
    { Icon: MessageCircleHeart, n: RECAP.feedbacks, label: 'feedback', sub: `${RECAP.fiveStars} kasih bintang 5` },
    { Icon: Star, n: RECAP.rating, d: 1, label: 'rating rata-rata', sub: `dari ${RECAP.rated} penilaian` },
    { Icon: ScanLine, n: RECAP.scans, label: 'scan QR booth', sub: 'menu & feedback dari HP' },
    { Icon: Clock, text: RECAP.soldOutAt, label: 'semua varian ludes', sub: '13 menit sebelum tutup', stamp: true },
  ]
  const most = Math.max(...Object.values(RECAP.perDrink))
  const peak = Math.max(...RECAP.hours.map((h) => h.cups))
  return (
    <section id="angka" className="paper relative scroll-mt-4 overflow-hidden px-4 pb-20 pt-24 sm:px-8 sm:pb-28 sm:pt-32">
      <Kain kind="parang" color={BROWN} opacity={0.08} />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <Kicker>Satu hari di {EVENT.table}</Kicker>
          <H2>Angka-angka kita</H2>
        </Reveal>

        <Reveal stagger={0.07} className="mt-10 grid grid-cols-1 gap-3 min-[360px]:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {tiles.map((t) => (
            <RevealItem key={t.label} className="relative rounded-[1.5rem] bg-cream-deep/70 p-4 ring-1 ring-brown/10 sm:rounded-[1.75rem] sm:p-7">
              <t.Icon className="size-6 text-terracotta sm:size-7" />
              <p className="mt-3 font-display text-[clamp(2.2rem,11vw,4.8rem)] font-bold leading-none tabular-nums">{t.text ?? <CountUp to={t.n!} decimals={t.d} />}</p>
              <p className="mt-1 font-display text-base font-semibold leading-tight sm:text-xl">{t.label}</p>
              <p className="mt-0.5 font-cond text-sm italic leading-tight text-brown-soft sm:text-base">{t.sub}</p>
              {t.stamp && <Stamp className="right-3 top-3 text-base sm:right-5 sm:top-5 sm:text-2xl">Ludes</Stamp>}
            </RevealItem>
          ))}
        </Reveal>

        <div className="mt-12 grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Reveal className="rounded-[1.5rem] bg-brown p-5 text-cream sm:rounded-[1.75rem] sm:p-8">
            <p className="font-display text-xl font-bold">Cup per varian</p>
            <p className="font-cond text-sm italic text-cream/60">Lychee Sparkling juara, juga paling banyak dipilih di feedback ({RECAP.favoriteVotes.lychee})</p>
            <ul className="mt-6 flex flex-col gap-5">
              {(Object.entries(RECAP.perDrink) as Array<[DrinkId, number]>).map(([id, n], i) => {
                const d = drinkById(id)
                return (
                  <li key={id} className="flex items-center gap-3 sm:gap-4" title={`${d.name}: ${n} cup`}>
                    <img src={CUP[id]} alt="" width={48} height={60} className="h-14 w-11 shrink-0 object-contain sm:h-20 sm:w-14" draggable={false} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="truncate font-display font-semibold">{d.short}</span>
                        <span className="font-display text-2xl font-bold tabular-nums">
                          {n} <span className="font-cond text-sm font-semibold italic text-cream/60">cup</span>
                        </span>
                      </div>
                      <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-cream/10">
                        {/* scaleX, not width: the bar grows on the compositor, no layout per frame */}
                        <motion.div
                          className="h-full origin-left rounded-full"
                          style={{ background: d.accent, width: `${(n / most) * 100}%` }}
                          initial={{ scaleX: 0 }}
                          whileInView={{ scaleX: 1 }}
                          viewport={{ once: true }}
                          transition={{ duration: 1, delay: 0.15 * i, ease: ease.out }}
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </Reveal>

          <Reveal className="rounded-[1.5rem] bg-cream-deep/70 p-5 ring-1 ring-brown/10 sm:rounded-[1.75rem] sm:p-8">
            <p className="font-display text-xl font-bold">Cup per jam di booth</p>
            <p className="font-cond text-sm italic text-brown-soft">Pembeli langsung · pre-order diambil sepanjang hari</p>
            <div className="mt-6 flex h-48 items-end gap-2.5 border-b-2 border-brown/15 sm:h-52 sm:gap-5">
              {RECAP.hours.map((h, i) => (
                <div key={h.h} className="group flex h-full flex-1 flex-col items-center justify-end" title={`${h.h}: ${h.cups} cup`}>
                  <span className="mb-1 font-display text-lg font-bold tabular-nums">{h.cups}</span>
                  <motion.div
                    className={`w-full max-w-16 origin-bottom rounded-t-[4px] ${h.cups === peak ? 'bg-terracotta' : 'bg-brown/35 group-hover:bg-brown/50'}`}
                    style={{ height: `${(h.cups / peak) * 78}%` }}
                    initial={{ scaleY: 0 }}
                    whileInView={{ scaleY: 1 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.8, delay: 0.1 * i, ease: ease.out }}
                  />
                </div>
              ))}
            </div>
            <div className="mt-2 flex gap-2.5 sm:gap-5">
              {RECAP.hours.map((h) => (
                <span key={h.h} className="flex-1 text-center font-cond text-sm font-semibold italic text-brown-soft">{h.h}</span>
              ))}
            </div>
            <p className="mt-4 font-display text-sm text-brown-soft">
              <b className="text-terracotta">Paling ramai jam 14.00.</b> Habis satu per satu: {RECAP.soldOut.map((s) => `${drinkById(s.id).short} ${s.at}`).join(' → ')}.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ the journey */

function Journey() {
  return (
    <section className="relative overflow-hidden bg-brown-soft px-4 pb-20 pt-24 text-cream sm:px-8 sm:pb-28 sm:pt-28">
      <Kain kind="megamendung" color={CREAM} opacity={0.07} size={64} />
      <Tumpal className="absolute inset-x-0 top-0" color={CREAM} accent="#c98a3c" flip />
      <div className="relative mx-auto grid max-w-6xl gap-12 lg:grid-cols-[1fr_280px]">
        <div>
        <Reveal>
          <Kicker light>Perjalanan</Kicker>
          <H2 light>Dari ide sampai ludes</H2>
        </Reveal>
        <div className="relative mt-12 pl-8 sm:pl-12">
          {/* the line draws itself down as the section comes in */}
          <motion.span
            className="absolute bottom-2 left-[0.7rem] top-2 w-0.5 origin-top bg-gradient-to-b from-yakult via-yakult/60 to-lychee sm:left-[1.2rem]"
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true, amount: 0.2 }}
            transition={{ duration: 1.8, ease: ease.inOut }}
          />
          {JOURNEY.map((m, i) => {
            const peak = i === JOURNEY.length - 2
            return (
              <Reveal key={m.title} className="relative mb-10 last:mb-0">
                <motion.span
                  className={`absolute -left-8 top-1 grid size-6 place-items-center rounded-full ring-4 ring-brown-soft sm:-left-12 sm:top-1.5 ${peak ? 'bg-lychee' : 'bg-yakult'}`}
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={spring.pop}
                >
                  {peak ? <KawungMark className="size-4 text-brown" /> : <span className="size-2 rounded-full bg-brown" />}
                </motion.span>
                <p className="font-cond text-base font-semibold uppercase italic tracking-[0.2em] text-yakult">{m.when}</p>
                <h3 className={`mt-1 font-display font-bold leading-tight ${peak ? 'text-[clamp(2rem,7vw,3.4rem)] text-lychee' : 'text-[clamp(1.5rem,4.5vw,2.4rem)]'}`}>{m.title}</h3>
                <p className="mt-1.5 max-w-2xl font-display text-base leading-snug text-cream/80 sm:text-lg">{m.text}</p>
              </Reveal>
            )
          })}
        </div>
        </div>
        <div className="flex justify-center lg:block">
          <div className="lg:sticky lg:top-16">
            <Polaroid m={MEDIA[4]} caption="selfie dulu" tilt={-3} className="w-[min(60vw,260px)]" />
          </div>
        </div>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ the crew */

const CREW_TINT = ['#a8572a', '#e9827f', '#c98a3c', '#5e7b3a', '#7a4a33']

function Crew() {
  return (
    <section className="relative bg-brown px-4 py-20 text-cream sm:px-8 sm:py-28">
      <GigiBalang className="absolute inset-x-0 top-0" color="#2b160c" accent="#c98a3c" size={28} />
      <Kain kind="ceplok" color={CREAM} opacity={0.06} size={60} />
      <div className="relative mx-auto max-w-6xl">
        <div className="flex flex-col gap-10 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:gap-10">
            <LogoSlot width="min(46vw, 230px)" />
            <Reveal>
              <Kicker light>Di balik meja</Kicker>
              <H2 light>Tim Pletok</H2>
              <p className="mt-3 max-w-sm font-display text-base text-cream/70 sm:text-lg">Lima orang, satu meja, tiga jam.</p>
            </Reveal>
          </div>
          <Polaroid m={MEDIA[0]} caption="Meja 9, 25.11.26" tilt={3} className="w-[min(52vw,220px)] self-center md:mr-4 md:self-auto" />
        </div>
        <Reveal stagger={0.08} className="mt-10 grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-3">
          {CREW.map((c, i) => (
            <RevealItem key={c.name} className={`relative flex flex-col rounded-[1.5rem] bg-cream/[0.06] p-5 ring-1 ring-cream/12 sm:rounded-[1.75rem] sm:p-6 ${c.site ? 'z-10' : ''}`}>
              <div className="flex items-center gap-3 sm:gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-2xl font-display text-xl font-bold text-cream sm:size-16 sm:text-2xl" style={{ background: CREW_TINT[i] }}>
                  {c.name
                    .split(' ')
                    .filter((w) => w.length > 2)
                    .slice(0, 2)
                    .map((w) => w[0])
                    .join('')
                    .toUpperCase()}
                </span>
                <div className="min-w-0">
                  {c.site ? <SitePeek name={c.name} site={c.site} /> : <p className="font-display text-lg font-bold leading-tight sm:text-xl">{c.name}</p>}
                  <p className="mt-0.5 font-cond text-base font-semibold italic text-yakult">
                    {c.role}
                    {c.site && <span className="text-cream/45"> · aka {c.short}</span>}
                  </p>
                </div>
              </div>
              <p className="mt-4 font-display leading-snug text-cream/75">{c.what}</p>
            </RevealItem>
          ))}
          <RevealItem className="flex flex-col justify-center rounded-[1.5rem] bg-terracotta p-5 sm:rounded-[1.75rem] sm:p-6">
            <Heart className="size-7 fill-cream text-cream" />
            <p className="mt-3 font-display text-xl font-bold leading-tight">+ {RECAP.feedbacks} feedback</p>
            <p className="mt-1 font-display text-cream/80">Dibaca satu-satu. Jadi catatan buat resep berikutnya.</p>
          </RevealItem>
        </Reveal>
      </div>
    </section>
  )
}

/**
 * Easter egg on the developer's name: hover it (tap on a phone) and a little window peeks at their
 * portfolio, live — click it to go there. The site only loads the first time someone finds it, and
 * lite phones get the link without the live preview.
 */
function SitePeek({ name, site }: { name: string; site: { url: string; label: string } }) {
  const lite = useLite()
  const [open, setOpen] = useState(false)
  const [found, setFound] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  const leave = useRef<number>(undefined)
  const show = () => (window.clearTimeout(leave.current), setOpen(true), setFound(true))
  const hide = () => (leave.current = window.setTimeout(() => setOpen(false), 180))
  // a tap anywhere else closes it on phones
  useEffect(() => {
    if (!open) return
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('pointerdown', away)
    return () => document.removeEventListener('pointerdown', away)
  }, [open])

  return (
    <div ref={box} className="relative" onPointerEnter={(e) => e.pointerType === 'mouse' && show()} onPointerLeave={(e) => e.pointerType === 'mouse' && hide()}>
      <button
        type="button"
        onClick={() => (open ? setOpen(false) : show())}
        onFocus={show}
        onBlur={hide}
        aria-expanded={open}
        className="text-left font-display text-lg font-bold leading-tight decoration-yakult/60 decoration-dotted underline-offset-4 hover:underline sm:text-xl"
      >
        {name}
      </button>
      <AnimatePresence>
        {open && (
          <motion.a
            href={site.url}
            target="_blank"
            rel="noreferrer"
            data-track="dev-portfolio"
            // on a phone it lines up with the card's left edge (past the avatar) so it never runs off-screen
            className="absolute -left-[4.25rem] top-full z-30 mt-3 block w-[min(19rem,calc(100vw-4rem))] origin-top-left overflow-hidden rounded-2xl bg-[#1d0f08] shadow-[0_24px_50px_-16px_rgb(0_0_0/0.7)] ring-1 ring-cream/20 sm:left-0"
            initial={{ opacity: 0, y: -6, scale: 0.92 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.92 }}
            transition={spring.snappy}
          >
            <span className="flex items-center gap-1.5 border-b border-cream/10 px-3 py-2">
              <span className="size-2 rounded-full bg-lychee" />
              <span className="size-2 rounded-full bg-yakult" />
              <span className="size-2 rounded-full bg-leaf-light" />
              <span className="ml-2 truncate font-cond text-xs italic text-cream/55">{site.label}</span>
            </span>
            {!lite && (
              // the real site, shrunk: drawn at 1280×800, scaled to the window's width
              <span className="relative block aspect-[16/10] w-full overflow-hidden bg-cream/5">
                {found && (
                  <iframe
                    src={site.url}
                    title={site.label}
                    loading="lazy"
                    sandbox="allow-scripts allow-same-origin"
                    tabIndex={-1}
                    className="pointer-events-none absolute left-0 top-0 h-[800px] w-[1280px] origin-top-left border-0"
                    style={{ transform: 'scale(var(--peek))' }}
                    ref={(f) => {
                      if (f?.parentElement) f.style.setProperty('--peek', String(f.parentElement.clientWidth / 1280))
                    }}
                  />
                )}
              </span>
            )}
            <span className="flex items-center justify-between gap-2 px-3 py-2.5 font-display text-sm font-semibold text-cream">
              Mampir ke portfolio-nya <ArrowUpRight className="size-4 text-yakult" />
            </span>
          </motion.a>
        )}
      </AnimatePresence>
    </div>
  )
}

/* ------------------------------------------------------------------ reviews */

const DIST = [
  { s: 5, n: 13 },
  { s: 4, n: 12 },
  { s: 3, n: 5 },
  { s: 2, n: 1 },
  { s: 1, n: 0 },
]

function Reviews() {
  const top = Math.max(...DIST.map((d) => d.n))
  return (
    <section className="paper relative px-4 py-20 sm:px-8 sm:py-28">
      <Kain kind="truntum" color={BROWN} opacity={0.07} size={54} />
      <div className="relative mx-auto max-w-6xl">
        <Reveal>
          <Kicker>Kata pelanggan</Kicker>
          <H2>{RECAP.feedbacks} feedback masuk</H2>
          <p className="mt-3 max-w-2xl font-display text-base text-brown-soft sm:text-lg">Langsung dari form feedback, tanpa nama.</p>
        </Reveal>

        <div className="mt-10 grid gap-4 sm:gap-6 lg:grid-cols-[0.8fr_1.2fr]">
          <Reveal className="h-fit rounded-[1.5rem] bg-brown p-5 text-cream sm:rounded-[1.75rem] sm:p-8 lg:sticky lg:top-6">
            <p className="font-display text-[clamp(4rem,18vw,5rem)] font-bold leading-none tabular-nums">{num(RECAP.rating, 1)}</p>
            <div className="mt-1 flex items-center gap-2">
              <Stars n={RECAP.rating} className="size-5" dim="text-cream/20" />
              <span className="font-cond italic text-cream/60">{RECAP.rated} penilaian</span>
            </div>
            <ul className="mt-6 flex flex-col gap-2">
              {DIST.map((d) => (
                <li key={d.s} className="flex items-center gap-3" title={`${d.s} bintang: ${d.n}`}>
                  <span className="w-8 font-display font-semibold">{d.s}★</span>
                  <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-cream/10">
                    <motion.span className="block h-full origin-left rounded-full bg-yakult" style={{ width: `${(d.n / top) * 100}%` }} initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ duration: 0.8, ease: ease.out }} />
                  </span>
                  <span className="w-6 text-right font-display font-semibold tabular-nums">{d.n}</span>
                </li>
              ))}
            </ul>
            <div className="mt-8 border-t border-cream/10 pt-6">
              <p className="font-display font-bold">Menu favorit</p>
              <ul className="mt-3 flex flex-col gap-1.5">
                {(Object.entries(RECAP.favoriteVotes) as Array<[DrinkId, number]>).map(([id, n]) => (
                  <li key={id} className="flex justify-between font-display text-cream/85">
                    <span>{drinkById(id).short}</span>
                    <span className="font-semibold tabular-nums">{n} suara</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <div className="columns-1 gap-3 sm:columns-2 sm:gap-4 [&>*]:mb-3 sm:[&>*]:mb-4">
            {LOVES.map((r, i) => (
              <motion.figure
                key={i}
                className="break-inside-avoid rounded-[1.25rem] bg-cream-deep/70 p-4 ring-1 ring-brown/10 sm:rounded-[1.5rem] sm:p-5"
                initial={{ opacity: 0, y: 24, rotate: i % 2 ? 1.5 : -1.5 }}
                whileInView={{ opacity: 1, y: 0, rotate: 0 }}
                viewport={{ once: true, amount: 0.4 }}
                transition={{ ...spring.glide, delay: (i % 4) * 0.05 }}
              >
                <Quote className="size-5 text-terracotta/50" />
                <blockquote className={`mt-2 font-display leading-snug ${r.text.length > 40 ? 'text-base sm:text-lg' : 'text-xl font-semibold sm:text-2xl'}`}>{r.text}</blockquote>
                <figcaption className="mt-3 flex flex-wrap items-center gap-2">
                  {r.rating && <Stars n={r.rating} className="size-3.5" />}
                  {r.drink && <span className="rounded-full bg-cream px-2.5 py-0.5 font-cond text-sm font-semibold italic text-brown-soft">{drinkById(r.drink).short}</span>}
                </figcaption>
              </motion.figure>
            ))}
          </div>
        </div>

        <div className="mt-12 grid gap-4 sm:gap-6 lg:grid-cols-2">
          <Reveal className="rounded-[1.5rem] bg-leaf p-5 text-cream sm:rounded-[1.75rem] sm:p-8">
            <p className="font-display text-2xl font-bold">Harapan pelanggan</p>
            <p className="font-cond italic text-cream/70">Catatan buat versi berikutnya</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {WISHES.map((w) => (
                <li key={w} className="rounded-full bg-cream/15 px-3.5 py-2 font-display text-sm font-medium sm:px-4 sm:text-base">{w}</li>
              ))}
            </ul>
          </Reveal>
          <Reveal className="rounded-[1.5rem] bg-lychee/90 p-5 text-brown sm:rounded-[1.75rem] sm:p-8">
            <p className="font-display text-2xl font-bold">Ide rasa & kolaborasi</p>
            <p className="font-cond italic text-brown/70">Usulan buat menu berikutnya</p>
            <ul className="mt-5 flex flex-wrap gap-2">
              {IDEAS.map((w) => (
                <li key={w} className="rounded-full bg-cream/70 px-3.5 py-2 font-display text-sm font-semibold sm:px-4 sm:text-base">{w}</li>
              ))}
            </ul>
          </Reveal>
        </div>

        <Reveal className="mt-12">
          <p className="font-display text-2xl font-bold">Yang paling sering ditanya</p>
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {FAQ.map((f) => (
              <div key={f.q} className="rounded-[1.25rem] bg-cream-deep/70 p-4 ring-1 ring-brown/10 sm:rounded-[1.5rem] sm:p-5">
                <p className="font-display text-lg font-bold">{f.q}</p>
                <p className="mt-1.5 font-display leading-snug text-brown-soft">{f.a}</p>
              </div>
            ))}
          </div>
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ gallery teaser */

function GalleryTeaser({ onOpen }: { onOpen: (i: number) => void }) {
  const picks = MEDIA.slice(0, 8)
  return (
    <section className="relative bg-brown px-4 py-20 text-cream sm:px-8 sm:py-28">
      <Kain kind="songket" color="#e6b84a" opacity={0.07} size={50} />
      <div className="relative mx-auto max-w-6xl">
        <Reveal className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <Kicker light>Galeri</Kicker>
            <H2 light>Momen di Meja 9</H2>
          </div>
          <a href="/gallery" className="inline-flex items-center gap-2 rounded-full bg-cream px-5 py-3 font-display font-bold text-brown">
            Semua foto & video <ArrowUpRight className="size-5" />
          </a>
        </Reveal>
        <Reveal stagger={0.05} className="mt-8 grid grid-cols-2 gap-2.5 sm:grid-cols-4 sm:gap-3">
          {picks.map((m, i) => (
            <RevealItem key={m.file} className={i === 0 ? 'col-span-2 row-span-2' : ''}>
              <button onClick={() => onOpen(i)} className="group relative block h-full w-full overflow-hidden rounded-[1rem] bg-cream/5 sm:rounded-[1.25rem]" style={{ aspectRatio: i === 0 ? '1 / 1' : '3 / 4' }}>
                <img {...thumb(m, i === 0 ? '(min-width: 640px) 50vw, 100vw' : '(min-width: 640px) 25vw, 50vw')} alt={m.caption} loading="lazy" decoding="async" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                {m.kind === 'video' && (
                  <span className="absolute right-2 top-2 grid size-8 place-items-center rounded-full bg-black/45 text-cream sm:size-9">
                    <Play className="ml-0.5 size-4 fill-cream" />
                  </span>
                )}
                <span className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent p-2.5 pt-8 text-left font-display text-xs font-semibold sm:p-3 sm:text-sm">{m.caption}</span>
              </button>
            </RevealItem>
          ))}
        </Reveal>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ the end */

function Finale({ desktop }: { desktop: boolean }) {
  const lite = useLite()
  return (
    <section className="paper relative overflow-hidden px-4 pb-40 pt-24 sm:px-8 sm:pt-32">
      {/* the leaves come back for the last word — and settle on the floor of the page */}
      <Kain kind="kawung" color={BROWN} opacity={0.06} size={64} />
      <WindLeaves count={lite ? 8 : desktop ? 26 : 14} opacity={0.8} size={desktop ? [18, 32] : [14, 24]} className="absolute inset-0 h-full w-full" />
      <div className="relative mx-auto max-w-4xl text-center">
        <LogoSlot width="min(48vw, 220px)" tone="light" className="mx-auto mb-8" />
        <Reveal>
          <Kicker>Untuk semua yang mampir</Kicker>
          <p className="mt-3 font-display text-[clamp(2.2rem,8vw,4.4rem)] font-bold leading-[0.95]">
            Sampai ketemu di <span className="text-terracotta">gelas berikutnya.</span>
          </p>
          <p className="mx-auto mt-4 max-w-xl font-display text-base text-brown-soft sm:text-lg">Makasih udah antre, nyobain, dan ngisi feedback.</p>
        </Reveal>
        <Reveal className="relative mx-auto mt-16 max-w-3xl rounded-[1.75rem] bg-brown px-5 py-12 text-cream sm:rounded-[2rem] sm:px-12">
          <Quote className="absolute -top-6 left-1/2 size-12 -translate-x-1/2 rounded-full bg-terracotta p-2.5 text-cream" />
          <p className="font-script text-[clamp(2.3rem,9vw,4.4rem)] font-bold leading-[1.02] text-yakult">“{DEV_NOTE.quote}”</p>
          <p className="mt-5 font-display text-base text-cream/75 sm:text-lg">
            {DEV_NOTE.by}, {DEV_NOTE.role}
          </p>
        </Reveal>

        <Reveal className="mt-16 flex flex-col items-center gap-5">
          <div className="flex items-end gap-3">
            {DRINKS.map((d, i) => (
              <img key={d.id} src={CUP[d.id]} alt={d.name} width={96} height={120} className="pk-float h-24 w-auto object-contain drop-shadow-[0_12px_12px_rgb(90_46_26/0.25)] sm:h-32" style={{ animationDelay: `${i * 0.6}s` }} draggable={false} />
            ))}
          </div>
          <p className="max-w-xl font-display text-base text-brown-soft sm:text-lg">Kalau Pletok buka lagi, kabarnya duluan di Instagram.</p>
          <div className="flex w-full flex-col gap-3 min-[400px]:w-auto min-[400px]:flex-row min-[400px]:flex-wrap min-[400px]:justify-center">
            <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-full bg-brown px-6 py-3.5 font-display text-lg font-bold text-cream shadow-[0_5px_0_#3b1d10] active:translate-y-1 active:shadow-none">
              <InstagramIcon /> Follow {INSTAGRAM_HANDLE}
            </a>
            <a href="/gallery" className="inline-flex items-center justify-center gap-2 rounded-full border-2 border-brown/30 bg-cream/60 px-6 py-3 font-display text-lg font-semibold">
              <Images className="size-5" /> Galeri
            </a>
          </div>
        </Reveal>

        <p className="mt-16 font-cond text-sm italic text-brown-soft/70">
          Tim Pletok · {EVENT.name} · {EVENT.campus} · {EVENT.place}
        </p>
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ the outro */

/**
 * The sign-off. The page opened with the Lawang doors swinging apart; scroll to the very end and
 * they swing shut on a "sampai jumpa" — once per visit, never forced again. "Buka lagi" opens them,
 * "Dari awal" opens them and goes back to the top. Transforms only, so it runs on any phone.
 */
function Outro() {
  const end = useRef<HTMLDivElement>(null)
  const reached = useInView(end, { amount: 1 })
  const [state, setState] = useState<'idle' | 'shut' | 'gone'>('idle')
  const [scope, animate] = useAnimate()
  useEffect(() => {
    if (reached && state === 'idle' && !reduced()) setState('shut')
  }, [reached, state])
  useEffect(() => {
    if (state !== 'shut' || !scope.current) return
    animate('.door-l', { rotateY: [-112, 0] }, { duration: 1.2, ease: [0.5, 0, 0.3, 1] })
    animate('.door-r', { rotateY: [112, 0] }, { duration: 1.2, ease: [0.5, 0, 0.3, 1] })
    // the doors meet → a thud
    animate(scope.current, { x: [0, -6, 5, -2, 0] }, { duration: 0.35, delay: 1.15 })
    animate('.outro-plate', { opacity: [0, 1], y: [24, 0], scale: [0.9, 1] }, { type: 'spring', stiffness: 260, damping: 20, delay: 1.35 })
  }, [state, animate, scope])
  const reopen = async (top: boolean) => {
    animate('.outro-plate', { opacity: 0, scale: 0.94 }, { duration: 0.2 })
    animate('.door-l', { rotateY: -112 }, { duration: 1, ease: [0.6, 0, 0.2, 1] })
    if (top) window.scrollTo({ top: 0, behavior: 'smooth' })
    await animate('.door-r', { rotateY: 112 }, { duration: 1, ease: [0.6, 0, 0.2, 1] })
    setState('gone')
  }

  return (
    <>
      <div ref={end} className="h-px" aria-hidden />
      {state === 'shut' && (
        <div ref={scope} className="fixed inset-0 z-[70]" role="dialog" aria-label="Sampai jumpa">
          <div className="absolute inset-0 [&_.door-l]:[transform:rotateY(-112deg)] [&_.door-r]:[transform:rotateY(112deg)]">
            <Lawang />
          </div>
          <div className="outro-plate absolute inset-0 flex flex-col items-center justify-center px-6 text-center opacity-0">
            <div className="rounded-[1.75rem] border-2 border-[#c98a3c] bg-[#2b160c]/95 px-7 py-8 text-cream shadow-[0_30px_60px_-20px_rgb(0_0_0/0.8)] sm:px-12">
              <p className="font-cond text-sm font-semibold uppercase italic tracking-[0.35em] text-[#c98a3c]">Pintu ditutup</p>
              <p className="mt-2 font-script text-[clamp(3.4rem,14vw,6rem)] font-bold leading-[0.9] text-yakult">Sampai jumpa!</p>
              <p className="mt-3 font-display text-base text-cream/80 sm:text-lg">Tim Pletok · {EVENT.name}</p>
              <p className="mt-1 font-cond text-sm italic text-cream/50">Tradisi Abadi, Jiwa Muda</p>
              <div className="mt-6 flex flex-col gap-2 min-[380px]:flex-row min-[380px]:justify-center">
                <button onClick={() => void reopen(false)} className="rounded-full bg-cream px-5 py-3 font-display font-bold text-brown">
                  Buka lagi
                </button>
                <button onClick={() => void reopen(true)} className="rounded-full border-2 border-cream/40 px-5 py-2.5 font-display font-semibold">
                  Dari awal ↑
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

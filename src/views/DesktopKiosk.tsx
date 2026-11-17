import { AnimatePresence, motion } from 'motion/react'
import type { MotionStyle } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { Leaf, MapPin, MessageCircleHeart, QrCode, ScanLine, ShoppingBag, Sparkles, UtensilsCrossed } from 'lucide-react'
import { BUNDLES, DRINKS, drinkById, TAGLINE } from '../data/menu'
import { STORY } from '../data/story'
import { EVENT, QR_LINKS } from '../data/event'
import { useEventPhase } from '../hooks/useEventPhase'
import { useViewport } from '../hooks/useViewport'
import { QrCanvas, QrTexture } from '../components/QrCanvas'
import { WindLeaves } from '../components/WindLeaves'
import { SoldStamp } from '../components/SoldStamp'
import { useMenu, type LiveBundle } from '../hooks/useMenu'
import { useFeedbackOpen } from '../hooks/useFeedbackOpen'
import { usePreorder } from '../hooks/usePreorder'
import { PriceTag } from '../components/PriceTag'
import { EventStatus } from '../components/EventStatus'
import { LogoRig } from '../components/LogoRig'
import { DrinkSpotlight } from '../components/DrinkSpotlight'
import { SignalBars } from '../components/SignalBars'
import { useIslandHost, useIslandNote } from '../components/LiveIsland'
import { InstagramIcon } from '../components/InstagramIcon'
import { ease, spring } from '../lib/motion'
import { Morph } from '../components/Morph'

type Focus = 'qr' | 'menu'
const ISLAND_H = 0 // the phase island only shows on phones
type Slide = { kind: 'drink'; i: number } | { kind: 'bundle'; i: number }
const SLIDES: Slide[] = [...DRINKS.map((_, i) => ({ kind: 'drink' as const, i })), ...BUNDLES.map((_, i) => ({ kind: 'bundle' as const, i }))]
const IDLE_RESET_MS = 45_000

function useCycle(length: number, ms: number, paused = false) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (paused) return
    const t = window.setInterval(() => setI((v) => (v + 1) % length), ms)
    return () => window.clearInterval(t)
  }, [length, ms, paused])
  return [i, setI] as const
}

/* ------------------------------------------------------------------ shared bits */

/** remote switches: a chip or button grows out of a blur and folds back into one */
const chipIn = {
  initial: { opacity: 0, scale: 0.4, filter: 'blur(8px)' },
  animate: { opacity: 1, scale: 1, filter: 'blur(0px)' },
  exit: { opacity: 0, scale: 0.4, filter: 'blur(8px)' },
  transition: { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 },
} as const

function MenuCarousel() {
  const { drinks: DRINKS, bundles: BUNDLES } = useMenu()
  const [idx] = useCycle(SLIDES.length, 5500)
  const slide = SLIDES[idx]
  const cups = slide.kind === 'drink' ? [DRINKS[slide.i]] : BUNDLES[slide.i].items.map(drinkById)
  const accent = cups.length === 1 ? cups[0].tint : '#ecdcc5'
  const title = slide.kind === 'drink' ? DRINKS[slide.i].name : BUNDLES[slide.i].name
  const sub = slide.kind === 'drink' ? DRINKS[slide.i].ingredients.join(' · ') : BUNDLES[slide.i].detail
  const price = slide.kind === 'drink' ? DRINKS[slide.i].price : BUNDLES[slide.i].price
  const was = slide.kind === 'bundle' ? BUNDLES[slide.i].normal : undefined
  const mid = (cups.length - 1) / 2

  return (
    <div className="relative flex h-full min-h-0 flex-col">
      <div className="flex items-center justify-between">
        <span className="font-cond text-[clamp(0.75rem,1.6vh,0.95rem)] font-semibold uppercase italic tracking-[0.25em] text-terracotta">
          {slide.kind === 'drink' ? 'Menu' : 'Promo Bundling'}
        </span>
        <div className="flex gap-1.5">
          {SLIDES.map((_, i) => (
            <motion.span key={i} className="h-1.5 rounded-full bg-brown" animate={{ width: i === idx ? 22 : 6, opacity: i === idx ? 1 : 0.25 }} transition={spring.snappy} />
          ))}
        </div>
      </div>
      {/* overflow-hidden + per-cup width caps keep bundles inside the card */}
      <div className="relative mt-[1vh] min-h-0 flex-1 overflow-hidden rounded-2xl">
        <motion.div
          className="absolute inset-x-[4%] top-[4%] aspect-square rounded-full transition-[background] duration-700"
          style={{ background: `radial-gradient(circle, ${accent} 0%, transparent 68%)` }}
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }}
        />
        <AnimatePresence mode="popLayout">
          <motion.div key={idx} className="absolute inset-0 flex items-end justify-center px-[4%]">
            {cups.map((d, i) => (
              <motion.img
                key={d.id + i}
                src={d.image}
                alt={d.name}
                draggable={false}
                className="relative min-w-0 object-contain object-bottom drop-shadow-[0_20px_20px_rgb(90_46_26/0.3)]"
                style={{
                  height: cups.length === 1 ? '96%' : '78%',
                  maxWidth: cups.length === 1 ? '100%' : `${100 / cups.length + 10}%`,
                  marginInline: cups.length === 1 ? 0 : '-3%',
                  zIndex: i === Math.round(mid) ? 2 : 1,
                }}
                initial={{ x: 200 + i * 40, y: 30, rotate: 22, opacity: 0, scale: 0.8 }}
                animate={{ x: 0, y: 0, rotate: (i - mid) * -6, opacity: 1, scale: 1, transition: { ...spring.pop, stiffness: 240, damping: 16, delay: i * 0.08 } }}
                exit={{ x: -220, y: -10, rotate: -24, opacity: 0, scale: 0.85, transition: { duration: 0.45, ease: ease.inOut, delay: i * 0.04 } }}
              />
            ))}
          </motion.div>
        </AnimatePresence>
      </div>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial="hidden"
          animate="show"
          exit="exit"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07, delayChildren: 0.15 } }, exit: { transition: { staggerChildren: 0.03 } } }}
          className="mt-[1.6vh]"
        >
          {[
            <h3 key="t" className="font-display text-[clamp(1.35rem,3.6vh,2.4rem)] font-bold uppercase leading-[0.95] text-brown">{title}</h3>,
            <p key="s" className="mt-[0.8vh] font-cond text-[clamp(0.9rem,2vh,1.2rem)] font-medium italic leading-snug text-brown-soft">{sub}</p>,
          ].map((el, i) => (
            <motion.div
              key={i}
              variants={{
                hidden: { opacity: 0, y: 18 },
                show: { opacity: 1, y: 0, transition: spring.snappy },
                exit: { opacity: 0, y: -12, transition: { duration: 0.2 } },
              }}
            >
              {el}
            </motion.div>
          ))}
          <motion.div variants={{ hidden: { opacity: 0 }, show: { opacity: 1 }, exit: { opacity: 0 } }} className="mt-[1.4vh]">
            <PriceTag price={price} was={was} size={window.innerHeight < 820 ? 'sm' : 'md'} />
          </motion.div>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

function StoryRotator({ compact = false }: { compact?: boolean }) {
  const [idx] = useCycle(STORY.length, 9000)
  const f = STORY[idx]
  return (
    <div className="relative min-h-0 flex-1 overflow-hidden [mask-image:linear-gradient(to_bottom,black_72%,transparent)]">
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 14, rotateX: -30 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          exit={{ opacity: 0, y: -14, rotateX: 30 }}
          transition={spring.glide}
          style={{ transformPerspective: 600 }}
        >
          <p className="font-cond text-[clamp(0.65rem,1.4vh,0.85rem)] font-semibold uppercase italic tracking-widest text-terracotta">Tahukah kamu? · {f.kicker}</p>
          <p className="mt-[0.5vh] font-display text-[clamp(1rem,2.4vh,1.5rem)] font-bold leading-tight text-brown">{f.title}</p>
          <p className={`mt-[0.6vh] font-display text-[clamp(0.8rem,1.75vh,1.05rem)] leading-relaxed text-brown/80 ${compact ? 'line-clamp-3' : ''}`}>{f.body}</p>
        </motion.div>
      </AnimatePresence>
    </div>
  )
}

// solid fill instead of backdrop-blur: blur over a live background repaints every frame
const card = 'rounded-[1.75rem] border border-brown/10 bg-[#f7efe4] shadow-[0_30px_70px_-34px_rgb(90_46_26/0.55)]'

const panelIn = (dir: -1 | 1 | 0, delay = 0) => ({
  initial: { opacity: 0, x: 70 * dir, y: dir === 0 ? 40 : 0, scale: 0.96 },
  animate: { opacity: 1, x: 0, y: 0, scale: 1, transition: { ...spring.glide, delay } },
  exit: { opacity: 0, x: 50 * dir, y: dir === 0 ? 30 : 0, scale: 0.96, transition: { duration: 0.35, ease: ease.inOut } },
})

function ScanCta() {
  const feedback = useFeedbackOpen().open
  const preorder = usePreorder().open
  return (
    <div className="flex shrink-0 items-center gap-[1.4vh] rounded-2xl bg-brown p-[1.5vh] text-cream">
      <motion.div className="grid size-[clamp(2rem,5vh,2.8rem)] shrink-0 place-items-center rounded-xl bg-cream/10" animate={{ scale: [1, 1.12, 1] }} transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}>
        <ScanLine className="size-[60%]" />
      </motion.div>
      <div className="min-w-0 flex-1 leading-tight">
        {/* remote switches (/config) swap the words with a blur instead of a jump */}
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={`${preorder}-${feedback}`} initial={{ opacity: 0, y: 8, filter: 'blur(6px)' }} animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }} exit={{ opacity: 0, y: -8, filter: 'blur(6px)' }} transition={{ duration: 0.35 }}>
            <p className="whitespace-nowrap font-display text-[clamp(0.95rem,2.2vh,1.25rem)] font-semibold">{preorder ? 'Scan buat pre-order!' : 'Scan QR-nya!'}</p>
            <p className="truncate font-cond text-[clamp(0.75rem,1.6vh,0.95rem)] italic opacity-80">
              {preorder ? 'Pesan sekarang, ambil di booth · IG kami' : feedback ? 'Feedback & Instagram kami' : 'Follow Instagram kami'}
            </p>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

/* ------------------------------------------------------------------ build-up after the grand opening */

type Box = { x: number; y: number; w: number; h: number; label: string }

/**
 * The booth "setting itself up": construction guides shoot across the screen, every card's
 * outline is drafted in dashes with its name, a progress chip counts up — then the real
 * cards drop into their outlines while the drawing fades away.
 */
function Blueprint({ boxes, onDone }: { boxes: Box[]; onDone: () => void }) {
  const [pct, setPct] = useState(0)
  // the kiosk re-renders every clock tick — keep the latest callback without restarting the build
  const done = useRef(onDone)
  done.current = onDone
  useEffect(() => {
    const start = performance.now()
    const DUR = 1900
    let raf = 0
    const tick = (n: number) => {
      const p = Math.min(1, (n - start) / DUR)
      // eased, with a little hitch near the end like a real loader
      setPct(Math.round(100 * (p < 0.8 ? p * 0.9 : 0.72 + (p - 0.8) * 1.4)))
      if (p < 1) raf = requestAnimationFrame(tick)
      else window.setTimeout(() => done.current(), 250)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const guides = [...new Set(boxes.flatMap((b) => [Math.round(b.y), Math.round(b.y + b.h)]))]
  const vguides = [...new Set(boxes.flatMap((b) => [Math.round(b.x), Math.round(b.x + b.w)]))]

  return (
    <motion.div className="pointer-events-none absolute inset-0 z-40" exit={{ opacity: 0, transition: { duration: 0.8, delay: 0.25 } }}>
      {/* construction guides */}
      {guides.map((y, i) => (
        <motion.span
          key={`h${y}`}
          className="absolute inset-x-0 h-px bg-terracotta/25"
          style={{ top: y, originX: i % 2 ? 1 : 0 }}
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.55, delay: i * 0.04, ease: ease.out }}
        />
      ))}
      {vguides.map((x, i) => (
        <motion.span
          key={`v${x}`}
          className="absolute inset-y-0 w-px bg-terracotta/25"
          style={{ left: x, originY: i % 2 ? 1 : 0 }}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ duration: 0.55, delay: 0.1 + i * 0.04, ease: ease.out }}
        />
      ))}

      {/* drafted card outlines */}
      <svg className="absolute inset-0 h-full w-full overflow-visible">
        {boxes.map((b, i) => (
          <motion.rect
            key={b.label}
            x={b.x}
            y={b.y}
            width={b.w}
            height={b.h}
            rx={28}
            fill="rgb(168 87 42 / 0.05)"
            stroke="#a8572a"
            strokeWidth={2}
            strokeDasharray="10 8"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 + i * 0.12, ease: ease.inOut }}
          />
        ))}
      </svg>
      {boxes.map((b, i) => (
        <motion.span
          key={b.label}
          className="absolute font-cond text-[clamp(0.7rem,1.5vh,0.9rem)] font-semibold uppercase italic tracking-[0.3em] text-terracotta"
          style={{ left: b.x + 18, top: b.y + 12 }}
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.6 + i * 0.12 }}
        >
          {b.label} · {Math.round(b.w)}×{Math.round(b.h)}
        </motion.span>
      ))}

      {/* progress */}
      <motion.div
        className="absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 flex-col items-center gap-2 rounded-3xl bg-brown px-6 py-4 text-cream shadow-[0_20px_50px_-20px_rgb(0_0_0/0.5)]"
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.6, opacity: 0 }}
        transition={spring.pop}
      >
        <span className="font-cond text-sm font-semibold uppercase italic tracking-[0.35em] text-yakult">{pct < 100 ? 'Menyiapkan booth' : 'Booth siap!'}</span>
        <span className="font-display text-4xl font-bold tabular-nums">{pct}%</span>
        <span className="h-1.5 w-48 overflow-hidden rounded-full bg-cream/15">
          <span className="block h-full rounded-full bg-spice" style={{ width: `${pct}%` }} />
        </span>
      </motion.div>
    </motion.div>
  )
}

/* ------------------------------------------------------------------ the booth screen */

/**
 * Two layouts that morph into each other:
 *  - `qr`   (pre-open): the code is the hero, menu + countdown on the sides
 *  - `menu` (open):     logo + menu spotlight take over, the code shrinks into a card
 * The QR card is ONE element that changes position, so motion morphs it between layouts.
 */
/**
 * `preview`: days before the event — the full dashboard to set up and test, minus the live clock.
 * `build`: right after the grand opening — the booth assembles itself from a blueprint first.
 */
export function DesktopKiosk({ onEgg, preview = false, build = false, onBuilt }: { onEgg: () => void; preview?: boolean; build?: boolean; onBuilt?: () => void }) {
  const [building, setBuilding] = useState(build)
  const vp = useViewport()
  const W = vp.w
  // the phase island sits in its own strip above the layout
  const H = vp.h - ISLAND_H
  const { phase } = useEventPhase()
  const auto: Focus = phase === 'pre-open' ? 'qr' : 'menu'
  const [manual, setManual] = useState<Focus | null>(null)
  const focus = manual ?? auto
  // focus-on-hover: null = nothing hovered, everything shown at full strength
  const [hoverDrink, setHoverDrink] = useState<number | null>(null)
  const [hoverBundle, setHoverBundle] = useState<number | null>(null)
  const menu = useMenu()
  const feedback = useFeedbackOpen().open
  const preorder = usePreorder().open
  const lastPointer = useRef(Date.now())

  // phase change or 45s without anyone touching → back to the schedule's layout
  useEffect(() => setManual(null), [phase])
  useEffect(() => {
    const onMove = () => (lastPointer.current = Date.now())
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerdown', onMove)
    const t = window.setInterval(() => {
      const idle = Date.now() - lastPointer.current
      if (idle > IDLE_RESET_MS) setManual(null)
    }, 4500)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerdown', onMove)
      window.clearInterval(t)
    }
  }, [])

  const gap = Math.round(Math.max(16, W * 0.016))
  const urgent = phase === 'last-call'

  // ---- qr layout
  const side = Math.min(Math.max(W * 0.25, 300), 460)
  const qrBig = Math.floor(Math.min(H * 0.78, W - side * 2 - gap * 4))
  const qrBigLeft = (W - qrBig) / 2
  const qrBigTop = (H - qrBig) / 2 - H * 0.04
  const sideW = qrBigLeft - gap * 2

  // ---- menu layout
  // right column = timer pill + one compact card (QR · scan · IG · Meja), centred above the bundles
  const headerH = H * 0.2
  const bundlesH = H * 0.21
  const qrSmall = Math.floor(Math.min(W * 0.16, H * 0.4))
  const colW = Math.max(qrSmall + gap * 2, 220)
  const colLeft = W - gap - colW
  const pillH = Math.max(34, H * 0.055)
  const capH = H * 0.115
  const qrSmallH = qrSmall + gap * 2 + capH
  const colBottom = H - bundlesH - gap * 2
  const pillTop = gap + Math.max(0, (colBottom - gap - (pillH + gap + qrSmallH)) / 2)
  const qrSmallTop = pillTop + pillH + gap
  const mainW = colLeft - gap * 2

  const qrBox =
    focus === 'qr'
      ? { left: qrBigLeft, top: qrBigTop, width: qrBig, height: qrBig, borderRadius: 32 }
      : { left: colLeft, top: qrSmallTop, width: colW, height: qrSmallH, borderRadius: 28 }

  return (
    <motion.main className="paper fixed inset-0 overflow-hidden" initial={{ opacity: build ? 1 : 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, transition: { duration: 0.6 } }}>
      <motion.div className="absolute inset-0" animate={{ opacity: focus === 'qr' ? 1 : 0.35 }} transition={{ duration: 0.8 }}>
        <QrTexture cell={Math.max(10, Math.floor(qrBig / 35))} />
      </motion.div>
      <WindLeaves count={urgent ? 30 : 22} opacity={0.7} />
      {preview && (
        // QR layout: centred over the code. Menu layout: tucked above the right column, where it
        // can't sit on the header text on a narrower window
        <motion.span
          key={focus}
          className={`absolute top-[1vh] z-30 whitespace-nowrap rounded-full bg-brown px-4 py-1 font-cond text-[clamp(0.75rem,1.6vh,0.95rem)] font-semibold uppercase italic text-cream ${focus === 'qr' ? 'left-1/2 -translate-x-1/2 tracking-[0.3em]' : 'tracking-[0.18em]'}`}
          style={focus === 'qr' ? undefined : { right: gap }}
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ ...spring.pop, delay: focus === 'qr' ? 0.6 : 0.3 }}
        >
          {focus === 'qr' ? `Preview · buka ${EVENT.dateLabel.split(', ')[1]}` : 'Preview · buka 25 Nov'}
        </motion.span>
      )}

      <AnimatePresence>
        {building && (
          <Blueprint
            key="bp"
            boxes={[
              { x: gap * 1.5, y: gap, w: mainW, h: headerH, label: 'logo' },
              { x: gap, y: gap * 2 + headerH, w: mainW + gap, h: H - headerH - bundlesH - gap * 4, label: 'menu' },
              { x: gap, y: H - gap - bundlesH, w: W - gap * 2, h: bundlesH, label: 'paket' },
              { x: colLeft, y: pillTop, w: colW, h: pillH, label: 'jam' },
              { x: colLeft, y: qrSmallTop, w: colW, h: qrSmallH, label: 'qr · ig' },
            ]}
            onDone={() => {
              setBuilding(false)
              onBuilt?.()
            }}
          />
        )}
      </AnimatePresence>
      {!building && (
      <div className="absolute inset-x-0 bottom-0" style={{ top: ISLAND_H }}>
      {/* ============ the morphing QR card ============ */}
      <motion.div layout className={`absolute z-20 flex flex-col overflow-hidden ${card}`} style={qrBox} transition={spring.glide}>
        <motion.div layout="position" className="relative flex-1 [perspective:800px]">
          {/* one code for everything: feedback + socials live on the /link page */}
          <div className="absolute inset-0" style={{ margin: focus === 'qr' ? 0 : gap }}>
            <QrCanvas value={QR_LINKS} className="absolute inset-0" />
          </div>
        </motion.div>
        <AnimatePresence>
          {focus === 'menu' && (
            <motion.div
              key="cap"
              className="flex flex-col gap-[1vh] pb-[1.4vh]"
              style={{ paddingInline: gap, height: capH }}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
              exit={{ opacity: 0 }}
            >
              <div className="flex items-center justify-between gap-2">
                <p className="flex min-w-0 items-center gap-1.5 font-display text-[clamp(0.8rem,1.7vh,1.05rem)] font-semibold leading-tight text-brown">
                  <ScanLine className="size-[1.2em] shrink-0" /> Scan aku
                </p>
                {/* lives beside the code, never on top of it — covering a finder eye breaks scanning */}
                <FocusToggle focus={focus} onClick={() => setManual('qr')} />
              </div>
              {/* the words drop out on a narrow card (icons stay) so the row never wraps or clips */}
              <div className="@container flex items-center justify-between gap-2 border-t border-brown/10 pt-[1vh]">
                {/* remote on/off from /config: a chip grows in or folds away, the rest slide over */}
                <span className="flex min-w-0 items-center gap-1.5 overflow-hidden whitespace-nowrap font-display text-[clamp(0.75rem,1.6vh,1rem)] font-semibold text-brown/80 [&_.lbl]:hidden @min-[13rem]:[&_.lbl]:inline">
                  <AnimatePresence mode="popLayout" initial={false}>
                    {preorder && (
                      <motion.span key="po" layout {...chipIn} className="flex items-center gap-1.5">
                        <ShoppingBag className="size-[1.2em] shrink-0" /> <span className="lbl">Pre-order</span>
                        <span className="text-brown/30">·</span>
                      </motion.span>
                    )}
                    {feedback && (
                      <motion.span key="fb" layout {...chipIn} className="flex items-center gap-1.5">
                        <MessageCircleHeart className="size-[1.2em] shrink-0" /> <span className="lbl">Feedback</span>
                        <span className="text-brown/30">·</span>
                      </motion.span>
                    )}
                    <motion.span key="ig" layout transition={chipIn.transition} className="flex items-center gap-1.5">
                      <InstagramIcon className="size-[1.2em] shrink-0" /> IG
                    </motion.span>
                  </AnimatePresence>
                </span>
                <MejaBadge small />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      <AnimatePresence mode="popLayout">
        {focus === 'qr' ? (
          <motion.div key="qr-layout" className="absolute inset-0" exit={{ opacity: 1 }}>
            <motion.aside {...panelIn(-1, 0.15)} className={`absolute z-10 flex flex-col overflow-hidden p-[2.6vh] ${card}`} style={{ left: gap, width: sideW, top: qrBigTop, height: qrBig }}>
              <MenuCarousel />
            </motion.aside>
            <motion.aside {...panelIn(1, 0.25)} className={`absolute z-10 flex flex-col gap-[2vh] overflow-hidden p-[2.6vh] ${card}`} style={{ right: gap, width: sideW, top: qrBigTop, height: qrBig }}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-script text-[clamp(1.2rem,2.8vh,1.8rem)] font-bold leading-none text-terracotta">{TAGLINE}</p>
                  <p className="mt-[0.8vh] flex items-center gap-1.5 font-display text-[clamp(0.75rem,1.7vh,1rem)] leading-tight text-brown/80">
                    <MapPin className="size-[1.1em] shrink-0" />
                    {EVENT.place} · {EVENT.campus}
                  </p>
                  <p className="mt-[0.6vh] flex items-center gap-2 font-cond text-[clamp(0.7rem,1.5vh,0.9rem)] font-semibold uppercase italic tracking-widest text-brown/50">
                    Sinyal <SignalBars label className="normal-case not-italic tracking-normal" />
                  </p>
                </div>
                <MejaBadge />
              </div>
              <EventStatus size="fluid" teaser={preview} />
              <div className="h-px shrink-0 bg-brown/10" />
              <StoryRotator />
              <ScanCta />
            </motion.aside>
          </motion.div>
        ) : (
          <motion.div key="menu-layout" className="absolute inset-0">
            {/* header: logo + who/where/what */}
            <motion.header {...panelIn(0, 0.1)} className="absolute z-10 flex items-center gap-[2.5vw]" style={{ left: gap * 1.5, top: gap, width: mainW, height: headerH }}>
              <LogoRig className="h-full shrink-0" showTagline onLeafTap={onEgg} />
              <div className="min-w-0 flex-1">
                <p className="font-script text-[clamp(1.4rem,3.6vh,2.6rem)] font-bold leading-none text-terracotta">{TAGLINE}</p>
                <p className="mt-[0.6vh] font-display text-[clamp(0.9rem,2vh,1.3rem)] leading-snug text-brown/85">
                  Bir pletok — minuman rempah khas Betawi, <b>tanpa alkohol</b>, kami racik ulang biar cocok buat lidah anak muda.
                </p>
                <div className="mt-[1.2vh] flex flex-wrap gap-[0.8vh]">
                  {[
                    { Icon: Leaf, t: 'Jahe · Kayu Manis · Cengkeh · Serai' },
                    { Icon: Sparkles, t: 'Non-alkohol' },
                    { Icon: MapPin, t: `${EVENT.place}, ${EVENT.campus} · ${EVENT.table}` },
                  ].map(({ Icon, t }, i) => (
                    <motion.span
                      key={t}
                      className="inline-flex items-center gap-1.5 rounded-full bg-cream-deep px-3 py-1 font-cond text-[clamp(0.75rem,1.6vh,1rem)] font-semibold italic text-brown"
                      initial={{ opacity: 0, scale: 0.6 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...spring.pop, delay: 0.4 + i * 0.08 }}
                    >
                      <Icon className="size-[1.1em]" /> {t}
                    </motion.span>
                  ))}
                  <motion.button
                    onClick={onEgg}
                    className="inline-flex items-center gap-1.5 rounded-full border-2 border-dashed border-terracotta/70 px-3 py-0.5 font-cond text-[clamp(0.75rem,1.6vh,1rem)] font-semibold italic text-terracotta"
                    initial={{ opacity: 0, scale: 0.6 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.06, rotate: -2 }}
                    whileTap={{ scale: 0.92 }}
                    transition={{ ...spring.pop, delay: 0.7 }}
                  >
                    ▶ Kenapa namanya “Pletok”?
                  </motion.button>
                </div>
              </div>
            </motion.header>

            {/* drink spotlight stage */}
            <motion.section {...panelIn(0, 0.2)} className="absolute z-10 grid grid-cols-3 gap-[1.5vw]" style={{ left: gap, top: gap * 2 + headerH, width: mainW + gap, height: H - headerH - bundlesH - gap * 4 }}>
              {menu.drinks.map((d, i) => (
                <DrinkSpotlight key={d.id} drink={d} soldOut={d.soldOut} active={hoverDrink === i} dimmed={hoverDrink !== null && hoverDrink !== i} onHover={(on) => setHoverDrink((h) => (on && !d.soldOut ? i : h === i ? null : h))} />
              ))}
            </motion.section>

            {/* bundles strip */}
            <motion.section {...panelIn(0, 0.3)} className="absolute z-10 grid grid-cols-3 gap-[1vw]" style={{ left: gap, width: W - gap * 2, bottom: gap, height: bundlesH }}>
              {menu.bundles.map((b, i) => (
                <BundleTile
                  key={b.name}
                  index={i}
                  bundle={b}
                  dimmed={hoverBundle !== null && hoverBundle !== i}
                  onHover={(on) => setHoverBundle((h) => (on && !b.soldOut ? i : h === i ? null : h))}
                />
              ))}
            </motion.section>

            {/* the only clock on the open screen: a small pill above the QR card */}
            <motion.div {...panelIn(1, 0.15)} className="absolute z-10 flex justify-center" style={{ left: colLeft, top: pillTop, width: colW, height: pillH }}>
              <TimerPill />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* layout switch — so visitors can browse right here, not only on their phones */}
      {focus === 'qr' && (
        <motion.div layout transition={chipIn.transition} className="absolute z-30 flex items-center gap-3" style={{ left: '50%', x: '-50%', top: qrBigTop + qrBig + H * 0.025 }}>
          <motion.div layout transition={chipIn.transition}>
            <FocusToggle focus={focus} onClick={() => setManual('menu')} />
          </motion.div>
          {/* pre-order right on this screen — no phone needed (laptop visitors, or the crew helping someone) */}
          <AnimatePresence mode="popLayout">
            {preorder && (
              <motion.a
                layout
                href="/preorder"
                data-track="preorder-kiosk"
                className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full bg-terracotta px-5 py-3 font-display text-[clamp(0.85rem,1.9vh,1.1rem)] font-semibold text-cream shadow-[0_5px_0_#7a3c1b]"
                {...chipIn}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.93 }}
              >
                <ShoppingBag className="size-[1.1em]" /> Pre-order di sini
              </motion.a>
            )}
          </AnimatePresence>
        </motion.div>
      )}
      </div>
      )}
    </motion.main>
  )
}

function FocusToggle({ focus, onClick, className = '', style }: { focus: 'qr' | 'menu'; onClick: () => void; className?: string; style?: MotionStyle }) {
  const big = focus === 'qr'
  return (
    <motion.button
      layoutId="focus-toggle"
      onClick={onClick}
      data-track={big ? 'lihat-menu' : 'qr-perbesar'}
      className={`relative flex shrink-0 items-center gap-2 overflow-hidden rounded-full bg-brown font-display font-semibold text-cream shadow-[0_5px_0_#3a1c0f] ${big ? 'px-5 py-3 text-[clamp(0.85rem,1.9vh,1.1rem)]' : 'px-3.5 py-2 text-[clamp(0.75rem,1.6vh,0.95rem)]'} ${className}`}
      style={style}
      whileHover={{ scale: 1.05 }}
      whileTap={{ scale: 0.93 }}
      transition={spring.glide}
    >
      <motion.span
        aria-hidden
        className="absolute inset-y-0 -left-1/2 w-1/3 skew-x-[-20deg] bg-gradient-to-r from-transparent via-white/25 to-transparent"
        animate={{ x: ['0%', '520%'] }}
        transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.6, ease: 'easeInOut' }}
      />
      <motion.span layout="position" className="relative flex items-center gap-2 whitespace-nowrap">
        {big ? (
          <>
            <UtensilsCrossed className="size-[1.1em]" /> Lihat menu di layar ini
          </>
        ) : (
          <>
            <QrCode className="size-[1.1em]" /> Perbesar
          </>
        )}
      </motion.span>
    </motion.button>
  )
}

/**
 * The open-screen clock: one small pill that always counts down. Calm while open; in last call
 * it turns terracotta and beats so the queue knows. Past closing it just says we're wrapping up
 * (we keep serving whoever is still in line).
 */
function TimerPill() {
  const { phase, remaining, daysAway } = useEventPhase()
  const last = phase === 'last-call'
  const s = Math.ceil(remaining / 1000)
  const p2 = (n: number) => String(n).padStart(2, '0')
  const clock = `${p2(Math.floor(s / 3600))}:${p2(Math.floor((s % 3600) / 60))}:${p2(s % 60)}`
  const label = phase === 'pre-open' ? 'Segera buka' : last ? 'Last call!' : 'Sedang buka'
  const value = phase === 'pre-open' ? (daysAway >= 2 ? `${daysAway} hari lagi` : clock) : clock
  // remote changes from /config show up right here: the pill swells into the notice and folds back
  useIslandHost()
  const note = useIslandNote()
  return (
    <motion.div
      layout
      className={`flex h-full max-w-full items-center gap-[1vh] overflow-hidden whitespace-nowrap rounded-full px-[1.8vh] font-display text-[clamp(0.8rem,1.9vh,1.15rem)] font-semibold shadow-[0_8px_20px_-10px_rgb(90_46_26/0.6)] ${last && !note ? 'bg-terracotta text-cream' : 'bg-[#1a0d06] text-cream'}`}
      style={{ borderRadius: 999 }}
      animate={last && !note ? { scale: [1, 1.06, 1, 1.04, 1] } : { scale: 1 }}
      transition={last && !note ? { duration: 1.2, repeat: Infinity, repeatDelay: 0.4 } : { type: 'spring', stiffness: 420, damping: 30, mass: 0.9 }}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        {note ? (
          <motion.span key={`note-${note.id}`} layout="position" {...chipIn} className="flex min-w-0 items-center gap-[0.8vh]">
            <motion.span
              className="grid size-[1.6em] shrink-0 place-items-center rounded-full"
              style={{ background: `${note.tone}33`, color: note.tone }}
              initial={{ scale: 0, rotate: -40 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 18, delay: 0.1 }}
            >
              <note.icon className="size-[0.9em]" />
            </motion.span>
            <span className="truncate">{note.short ?? note.text}</span>
          </motion.span>
        ) : (
          <motion.span key="clock" layout="position" {...chipIn} className="flex items-center gap-[1vh]">
            <span className="relative flex size-2.5">
              {phase !== 'pre-open' && <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60" style={{ color: last ? '#f5ebdd' : '#8faa4f' }} />}
              <span className="relative inline-flex size-2.5 rounded-full" style={{ background: last ? '#f5ebdd' : phase === 'pre-open' ? '#c98a3c' : '#8faa4f' }} />
            </span>
            <span>{label}</span>
            <span className={`font-bold tabular-nums ${last ? 'text-cream' : 'text-yakult'}`}>{value}</span>
            {/* the booth's line to the Sheet, right where the crew glances anyway */}
            <SignalBars dark className="ml-[0.4vh] text-[1em]" />
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

function MejaBadge({ small = false }: { small?: boolean }) {
  return small ? (
    <span className="shrink-0 whitespace-nowrap rounded-full bg-brown px-3 py-1 font-display text-sm font-bold text-cream">{EVENT.table}</span>
  ) : (
    <div className="shrink-0 rounded-2xl bg-brown px-[1.4vh] py-[0.8vh] text-center text-cream">
      <p className="font-cond text-[clamp(0.55rem,1.1vh,0.75rem)] uppercase italic tracking-widest opacity-75">Meja</p>
      <p className="font-display text-[clamp(1.5rem,4vh,2.6rem)] font-bold leading-none">9</p>
    </div>
  )
}

function BundleTile({ bundle, index, dimmed, onHover }: { bundle: LiveBundle; index: number; dimmed: boolean; onHover: (on: boolean) => void }) {
  const cups = bundle.items.map(drinkById)
  const mid = (cups.length - 1) / 2
  return (
    <motion.div
      className={`group relative flex h-full min-w-0 items-center gap-[0.6vw] py-[1.2vh] pl-[0.6vh] pr-[1.6vh] ${card}`}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      animate={{ opacity: dimmed ? 0.4 : 1, scale: dimmed ? 0.97 : 1 }}
      whileHover={{ y: -8, scale: 1.02 }}
      transition={spring.snappy}
    >
      {/* cups are allowed to rise out of the tile a little — fills the space and adds depth */}
      <SoldStamp show={bundle.soldOut} small className="left-[12%] top-1/2 -translate-y-1/2" />
      <div className={`relative -mt-[3vh] flex h-[calc(100%+3vh)] w-[46%] shrink-0 items-end justify-center transition-[filter,opacity] duration-500 ${bundle.soldOut ? 'opacity-45 grayscale' : ''}`}>
        {cups.map((d, i) => (
          <motion.img
            key={d.id + i}
            src={d.image}
            alt=""
            draggable={false}
            className="relative h-full min-w-0 object-contain object-bottom drop-shadow-[0_10px_10px_rgb(90_46_26/0.25)]"
            style={{ maxWidth: `${100 / cups.length + (cups.length > 2 ? 22 : 30)}%`, marginInline: cups.length > 2 ? '-9%' : '-7%', zIndex: i === Math.round(mid) ? 2 : 1 }}
            initial={{ y: 40, opacity: 0, rotate: (i - mid) * 20 }}
            animate={{ y: 0, opacity: 1, rotate: (i - mid) * -6 }}
            transition={{ ...spring.pop, delay: 0.5 + index * 0.1 + i * 0.06 }}
            whileHover={{ y: -8, rotate: 0 }}
          />
        ))}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-display text-[clamp(1rem,2.6vh,1.7rem)] font-bold uppercase leading-none text-brown">{bundle.name.replace('Paket ', '')}</p>
        <p className="mt-[0.5vh] line-clamp-2 font-cond text-[clamp(0.7rem,1.55vh,0.95rem)] italic leading-tight text-brown-soft">{bundle.detail}</p>
        <div className="mt-[1vh] flex flex-wrap items-center gap-x-[1vh] gap-y-[0.4vh]">
          <span className={`rounded-xl px-[1.2vh] py-[0.3vh] font-display text-[clamp(1.4rem,4.2vh,2.6rem)] font-bold leading-tight text-white [text-shadow:1px_2px_0_#5a2e1a] ${bundle.soldOut ? 'bg-brown/30 line-through' : 'bg-terracotta'}`}><Morph text={`${bundle.price}K`} /></span>
          {bundle.normal > bundle.price && (
            <>
              <span className="font-display text-[clamp(0.95rem,2.4vh,1.4rem)] font-bold text-brown/55 line-through decoration-red-700 decoration-2"><Morph text={`${bundle.normal}K`} /></span>
              <span className="rounded-full bg-leaf/15 px-2 font-script text-[clamp(1rem,2.4vh,1.45rem)] font-bold text-leaf">hemat <Morph text={`${bundle.normal - bundle.price}K`} /></span>
            </>
          )}
        </div>
      </div>
    </motion.div>
  )
}

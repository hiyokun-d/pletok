import { AnimatePresence, motion, useScroll, useSpring, useTransform } from 'motion/react'
import { useRef } from 'react'
import { CalendarDays, Clock, MapPin, MessageCircleHeart, ShoppingBag, Sparkles } from 'lucide-react'
import { InstagramIcon } from '../components/InstagramIcon'
import { DRINKS, TAGLINE } from '../data/menu'
import { useMenu } from '../hooks/useMenu'
import { SOURCES, STORY } from '../data/story'
import { EVENT, FEEDBACK_URL, INSTAGRAM_HANDLE, INSTAGRAM_URL } from '../data/event'
import { Ornament } from '../components/Ornament'
import { LogoRig } from '../components/LogoRig'
import { CupCard } from '../components/CupCard'
import { DrinkDetails } from '../components/DrinkDetails'
import { BundleCard } from '../components/BundleCard'
import { EventStatus } from '../components/EventStatus'
import { usePreorder } from '../hooks/usePreorder'
import { PromoBanner } from '../components/OrderTracker'
import { useFeedbackOpen } from '../hooks/useFeedbackOpen'
import { SignalBars } from '../components/SignalBars'
import { Reveal, RevealItem } from '../components/Reveal'
import { drop, pop, spring } from '../lib/motion'
import { blurFx, useLite } from '../lib/perf'

function SectionTitle({ kicker, title }: { kicker: string; title: string }) {
  return (
    <Reveal stagger={0.08} className="mb-6 flex flex-col items-center text-center">
      <RevealItem variants={pop} className="font-script text-2xl font-bold text-terracotta">
        {kicker}
      </RevealItem>
      <RevealItem className="flex items-center gap-3">
        <Ornament variant="dashes" className="h-8 w-6" />
        <h2 className="font-display text-4xl font-bold uppercase tracking-tight text-brown">{title}</h2>
        <Ornament variant="dashes" className="h-8 w-6" flip />
      </RevealItem>
      <RevealItem className="mt-2 w-48">
        <Ornament variant="divider" className="h-4 w-full" />
      </RevealItem>
    </Reveal>
  )
}

export function MobileSite({ onEgg }: { onEgg: () => void }) {
  const menu = useMenu()
  const { open: preorder, config: poConfig, promoLeft } = usePreorder()
  const promoLive = preorder && !!poConfig.promo?.on && promoLeft > 0
  const feedback = useFeedbackOpen().open
  const heroRef = useRef<HTMLElement>(null)
  const storyRef = useRef<HTMLElement>(null)
  const { scrollYProgress: heroP } = useScroll({ target: heroRef, offset: ['start start', 'end start'] })
  const { scrollYProgress: storyP } = useScroll({ target: storyRef, offset: ['start 70%', 'end 60%'] })
  const { scrollY, scrollYProgress } = useScroll()
  const progress = useSpring(scrollYProgress, { stiffness: 200, damping: 30 })
  const progressLeft = useTransform(progress, (v) => `${v * 100}%`)
  const line = useSpring(storyP, { stiffness: 120, damping: 24 })
  const logoY = useTransform(heroP, [0, 1], [0, -80])
  const logoScale = useTransform(heroP, [0, 1], [1, 0.85])
  const cupsY = useTransform(heroP, [0, 1], [0, 40])
  const barY = useSpring(useTransform(scrollY, [250, 400], [120, 0]), spring.snappy)
  useLite() // re-render if the phone turns out to be slow, so the blur-free variants below take over

  return (
    <motion.main
      className="paper relative min-h-dvh overflow-x-clip pb-32"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.5 } }}
    >
      <div className="pointer-events-none fixed inset-x-0 top-0 z-40 h-1">
        <motion.div className="h-full origin-left bg-gradient-to-r from-leaf to-terracotta" style={{ scaleX: progress }} />
        <motion.div className="absolute inset-x-0 -top-2.5 h-6 will-change-transform" style={{ x: progressLeft }}>
          <div className="absolute left-0 top-0 size-6 -translate-x-1/2">
            <Ornament variant="leaf" className="size-6 rotate-90" draw={false} />
          </div>
        </motion.div>
      </div>

      {/* ---------- hero ---------- */}
      <section ref={heroRef} className="relative z-10 flex min-h-[92dvh] flex-col items-center px-5 pt-10">
        <Ornament variant="leaf" className="absolute -left-6 top-6 w-28 -rotate-12" />
        <Ornament variant="leaf" className="absolute -right-6 top-24 w-24 rotate-[160deg]" delay={0.2} />
        <Ornament variant="spice-star" className="absolute left-6 top-[46%] w-10" delay={0.4} />
        <Ornament variant="spice-star" className="absolute right-8 top-[40%] w-8" delay={0.6} />

        {/* first-N promo, live — the first thing on the page while slots are left */}
        <AnimatePresence>
          {promoLive && poConfig.promo && (
            <motion.div key="promo" className="relative z-20 mb-5 mt-4 w-full max-w-sm" initial={{ opacity: 0, y: -24, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, scale: 0.9, ...blurFx(6) }} transition={{ ...spring.pop, delay: 0.4 }}>
              <PromoBanner promo={poConfig.promo} left={promoLeft} href="/preorder" loud />
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div style={{ y: logoY, scale: logoScale }} initial="hidden" animate="show" variants={drop} className="relative mb-4 w-[min(84vw,400px)] will-change-transform">
          {/* every letter bounces, the leaf shakes & sheds leaves when tapped */}
          <LogoRig />
        </motion.div>

        <motion.h1
          className="text-center font-display text-[2.4rem] font-bold uppercase leading-[0.95] text-brown"
          initial={{ opacity: 0, y: 30, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          transition={{ ...spring.pop, delay: 0.35 }}
        >
          {TAGLINE}
        </motion.h1>

        <motion.button
          onClick={onEgg}
          className="mt-4 inline-flex items-center gap-2 rounded-full border-2 border-dashed border-terracotta/60 px-4 py-1.5 font-cond text-base font-semibold italic text-terracotta"
          initial={{ opacity: 0, scale: 0.6 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ ...spring.pop, delay: 0.7 }}
          whileTap={{ scale: 0.92 }}
        >
          <span className="pk-wiggle inline-flex">
            <Sparkles className="size-4" />
          </span>
          Kenapa namanya “Pletok”?
        </motion.button>

        <motion.div style={{ y: cupsY }} className="relative mt-6 flex h-64 w-full max-w-sm items-end justify-center will-change-transform">
          {DRINKS.map((d, i) => {
            const off = i - 1
            return (
              <motion.img
                key={d.id}
                src={d.image}
                alt={d.name}
                draggable={false}
                className="relative h-52 w-auto cursor-grab touch-none object-contain drop-shadow-[0_18px_18px_rgb(90_46_26/0.3)] active:cursor-grabbing"
                style={{ marginInline: -26, zIndex: off === 0 ? 2 : 1 }}
                initial={{ y: 220, rotate: off * 30, opacity: 0 }}
                animate={{ y: off === 0 ? -18 : 0, rotate: off * 8, opacity: 1 }}
                transition={{ ...spring.pop, stiffness: 220, damping: 13, delay: 0.5 + Math.abs(off) * 0.12 }}
                // fling a cup — it springs home with a wobble
                drag
                dragSnapToOrigin
                dragElastic={0.6}
                dragTransition={{ bounceStiffness: 300, bounceDamping: 12 }}
                whileDrag={{ scale: 1.12, rotate: off * 8 + 10, zIndex: 5 }}
                whileTap={{ scaleY: 0.9, scaleX: 1.08 }}
              />
            )
          })}
        </motion.div>

        <motion.div
          className="relative z-10 mt-6 flex flex-wrap items-center justify-center gap-2 font-cond text-base font-semibold italic text-brown-soft"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.08, delayChildren: 1 } } }}
        >
          {[EVENT.name, '25 Nov', EVENT.timeLabel, EVENT.table].map((t) => (
            <motion.span key={t} variants={pop} className="rounded-full bg-cream-deep px-3 py-1">
              {t}
            </motion.span>
          ))}
        </motion.div>

        <motion.div
          className="mt-8 h-10 w-6 rounded-full border-2 border-brown/40"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6 }}
        >
          <div className="pk-scroll-dot mx-auto mt-1.5 size-1.5 rounded-full bg-brown/60" />
        </motion.div>
      </section>

      {/* ---------- status ---------- */}
      <section className="relative z-10 mx-auto w-full max-w-lg px-5 py-10">
        <Reveal className="relative overflow-hidden rounded-[2rem] bg-[#fbf5ec] p-6 shadow-[0_20px_50px_-28px_rgb(90_46_26/0.5)]">
          <Ornament variant="spice-star" className="absolute -right-3 -top-3 w-20 opacity-30" />
          <EventStatus size="sm" />
        </Reveal>
      </section>

      {/* ---------- menu ---------- */}
      <section className="relative z-10 mx-auto w-full max-w-lg px-5 py-12">
        <SectionTitle kicker="Pilih rasamu" title="Menu" />
        {/* measured against our own Sheet — the crew can tell "the booth wifi is drowning" at a glance */}
        <div className="-mt-2 mb-6 flex justify-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-cream-deep/80 px-3 py-1.5 ring-1 ring-brown/10">
            <span className="font-cond text-xs font-semibold uppercase italic tracking-widest text-brown/50">Sinyal</span>
            <SignalBars label />
          </span>
        </div>
        <div className="flex flex-col gap-8">
          {menu.drinks.map((d, i) => (
            <div key={d.id} className="flex flex-col">
              <CupCard drink={d} index={i} soldOut={d.soldOut} />
              <DrinkDetails drink={d} />
            </div>
          ))}
        </div>
      </section>

      {/* ---------- bundles ---------- */}
      <section className="relative z-10 mx-auto w-full max-w-lg px-5 py-12">
        <SectionTitle kicker="Lebih hemat" title="Promo Bundling" />
        <div className="flex flex-col gap-6">
          {menu.bundles.map((b, i) => (
            <BundleCard key={b.name} bundle={b} index={i} soldOut={b.soldOut} />
          ))}
        </div>
      </section>

      {/* ---------- story ---------- */}
      <section ref={storyRef} className="relative z-10 mx-auto w-full max-w-lg overflow-hidden px-5 py-14">
        <Ornament variant="batik-corner" className="absolute -left-10 top-0 w-44 -scale-y-100 opacity-40" />
        <Ornament variant="batik-corner" className="absolute -right-10 bottom-0 w-44 opacity-40" flip />
        <SectionTitle kicker="Kenalan sama" title="Bir Pletok" />
        <div className="relative pl-10">
          <div className="absolute bottom-2 left-[15px] top-2 w-[3px] rounded-full bg-brown/10" />
          <motion.div className="absolute bottom-2 left-[15px] top-2 w-[3px] origin-top rounded-full bg-terracotta" style={{ scaleY: line }} />
          <div className="flex flex-col gap-8">
            {STORY.map((f, i) => (
              <Reveal key={f.title} stagger={0.08} amount={0.5} className="relative">
                <RevealItem variants={pop} className="absolute -left-10 top-0 grid size-8 place-items-center rounded-full bg-cream shadow-[0_0_0_3px_#a8572a]">
                  <Ornament variant="spice-star" className="size-6" draw={false} />
                </RevealItem>
                <RevealItem className="font-cond text-sm font-semibold uppercase italic tracking-wider text-terracotta">{f.kicker}</RevealItem>
                <RevealItem className="font-display text-2xl font-bold leading-tight text-brown">{f.title}</RevealItem>
                <RevealItem className="mt-1.5 font-display text-[0.98rem] leading-relaxed text-brown/85">{f.body}</RevealItem>
                <RevealItem className="mt-1 font-script text-lg text-brown-soft">{f.en}</RevealItem>
                {i === 2 && (
                  <RevealItem>
                    <motion.button
                      onClick={onEgg}
                      whileTap={{ scale: 0.94 }}
                      className="mt-3 inline-flex items-center gap-2 rounded-full bg-terracotta px-4 py-2 font-display text-sm font-semibold text-cream shadow-[0_4px_0_#7a3d1c]"
                    >
                      ▶ Lihat “pletak-pletok”-nya
                    </motion.button>
                  </RevealItem>
                )}
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal className="mt-10 text-center font-cond text-xs italic text-brown/50">
          Sumber:{' '}
          {SOURCES.map((s, i) => (
            <span key={s.url}>
              <a href={s.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2">
                {s.label}
              </a>
              {i < SOURCES.length - 1 ? ' · ' : ''}
            </span>
          ))}
        </Reveal>
      </section>

      {/* ---------- where ---------- */}
      <section className="relative z-10 mx-auto w-full max-w-lg px-5 py-12">
        <SectionTitle kicker="Temukan kami" title="Di Booth" />
        <Reveal stagger={0.1} className="relative overflow-hidden rounded-[2rem] bg-brown p-6 text-cream shadow-[0_24px_60px_-30px_rgb(58_28_15/0.9)]">
          <Ornament variant="batik-corner" color="#f5ebdd" className="absolute -bottom-6 -right-6 w-40 opacity-15" flip />
          <RevealItem className="flex items-end justify-between">
            <div>
              <p className="font-cond text-sm font-semibold uppercase italic tracking-widest text-yakult/80">{EVENT.name}</p>
              <p className="font-display text-3xl font-bold">{EVENT.campus}</p>
            </div>
            <motion.div variants={pop} className="text-right">
              <p className="font-cond text-xs uppercase italic tracking-widest text-yakult/80">Meja</p>
              <p className="font-display text-6xl font-bold leading-none text-yakult">9</p>
            </motion.div>
          </RevealItem>
          {[
            { Icon: MapPin, text: `${EVENT.place}, ${EVENT.campus}` },
            { Icon: CalendarDays, text: EVENT.dateLabel },
            { Icon: Clock, text: `${EVENT.timeLabel} — hanya 1 hari!` },
          ].map(({ Icon, text }) => (
            <RevealItem key={text} className="mt-3 flex items-center gap-3 font-display text-base">
              <span className="grid size-9 place-items-center rounded-full bg-cream/10">
                <Icon className="size-4.5" />
              </span>
              {text}
            </RevealItem>
          ))}
        </Reveal>
      </section>

      {/* ---------- footer ---------- */}
      <footer className="relative z-10 flex flex-col items-center gap-4 px-5 pb-10 pt-6 text-center">
        <Reveal className="w-52">
          <LogoRig />
        </Reveal>
        <a href={INSTAGRAM_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 font-display font-semibold text-brown">
          <InstagramIcon className="size-5" /> {INSTAGRAM_HANDLE}
        </a>
        <p className="font-cond text-sm italic text-brown/50">Tradisi abadi, jiwa muda · BINUS Festival 2026</p>
      </footer>

      {/* ---------- sticky action bar ---------- */}
      <motion.div style={{ y: barY }} className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-center gap-3 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3">
        <div className="absolute inset-0 bg-gradient-to-t from-cream via-cream/80 to-transparent" />
        <ActionDock preorder={preorder} feedback={feedback} />
      </motion.div>
    </motion.main>
  )
}

/** a button that grows out of the dock and folds back into it (no blur on a lite phone) */
const morphIn = () => ({
  initial: { opacity: 0, scale: 0.4, ...blurFx(8) },
  animate: { opacity: 1, scale: 1, ...blurFx(0) },
  exit: { opacity: 0, scale: 0.4, ...blurFx(8) },
})
const DOCK = { type: 'spring', stiffness: 420, damping: 32, mass: 0.9 } as const

/**
 * The bottom bar as a little island: up to three buttons (feedback, pre-order, Instagram) in one
 * dark capsule. When the crew opens or closes feedback / pre-order from /config, the capsule
 * stretches or shrinks and the button grows out of it or folds back in — no jump.
 */
function ActionDock({ preorder, feedback }: { preorder: boolean; feedback: boolean }) {
  const count = 1 + Number(preorder) + Number(feedback)
  const pill = 'relative inline-flex h-12 items-center gap-2 whitespace-nowrap rounded-full font-display font-semibold'
  return (
    <motion.div layout transition={DOCK} className="relative flex items-center gap-1.5 bg-[#1a0d06] p-1.5 shadow-[0_14px_34px_-12px_rgb(0_0_0/0.55)]" style={{ borderRadius: 999 }}>
      <AnimatePresence mode="popLayout" initial={false}>
        {feedback && (
          <motion.a key="feedback" layout href={FEEDBACK_URL} data-track="mobile-feedback" {...morphIn()} transition={DOCK} whileTap={{ scale: 0.93 }} className={`${pill} bg-yakult px-5 text-brown`}>
            <MessageCircleHeart className="size-5 shrink-0" />
            <motion.span layout="position">{count > 2 ? 'Feedback' : 'Kasih feedback'}</motion.span>
          </motion.a>
        )}
        {preorder && (
          <motion.a key="preorder" layout href="/preorder" data-track="mobile-preorder" {...morphIn()} transition={DOCK} whileTap={{ scale: 0.93 }} className={`${pill} bg-terracotta px-5 text-cream`}>
            <ShoppingBag className="size-5 shrink-0" />
            <motion.span layout="position">{count > 2 ? 'Pre-order' : 'Pre-order sekarang'}</motion.span>
          </motion.a>
        )}
        <motion.a
          key="ig"
          layout
          href={INSTAGRAM_URL}
          target="_blank"
          rel="noreferrer"
          data-track="mobile-instagram"
          transition={DOCK}
          whileTap={{ scale: 0.9 }}
          className={`${pill} justify-center bg-cream/10 text-cream ${count > 1 ? 'w-12' : 'px-5'}`}
          aria-label="Instagram Pletok"
        >
          <InstagramIcon className="size-5 shrink-0" />
          <AnimatePresence mode="popLayout" initial={false}>
            {count === 1 && (
              <motion.span key="ig-label" layout="position" initial={{ opacity: 0, ...blurFx(4) }} animate={{ opacity: 1, ...blurFx(0) }} exit={{ opacity: 0, ...blurFx(4) }}>
                Follow {INSTAGRAM_HANDLE}
              </motion.span>
            )}
          </AnimatePresence>
        </motion.a>
      </AnimatePresence>
    </motion.div>
  )
}

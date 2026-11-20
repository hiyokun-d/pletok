import { AnimatePresence, motion, useAnimate } from 'motion/react'
import type { CSSProperties } from 'react'
import { Info } from 'lucide-react'
import { DRINK_PROFILE, type Drink } from '../data/menu'
import { spring } from '../lib/motion'
import { ParticleField } from './ParticleField'
import { PriceTag } from './PriceTag'
import { SoldStamp } from './SoldStamp'
import { Morph } from './Morph'

interface DrinkSpotlightProps {
  drink: Drink
  /** the one being hovered — lifts, glows, runs particles, shows its blurb */
  active: boolean
  /** another drink is hovered — step back so that one gets the focus */
  dimmed: boolean
  onHover: (on: boolean) => void
  soldOut?: boolean
  /** where its profile card slides out — over a dimmed neighbour, never over its own cup */
  side?: 'left' | 'right'
}

/** Booth-screen drink: lifts into the spotlight on hover, tap shakes it — PLE! TOK! */
export function DrinkSpotlight({ drink, active, dimmed, onHover, soldOut = false, side = 'right' }: DrinkSpotlightProps) {
  const [scope, animate] = useAnimate()

  const shake = async () => {
    onHover(true)
    animate('.mini-ple', { opacity: [0, 1, 1, 0], scale: [0.3, 1.3, 1, 0.8], y: [10, -20, -26, -40], rotate: [-30, -8, -8, -8] }, { duration: 0.9 })
    animate('.mini-tok', { opacity: [0, 1, 1, 0], scale: [0.3, 1.3, 1, 0.8], y: [10, -24, -30, -44], rotate: [30, 8, 8, 8] }, { duration: 0.9, delay: 0.22 })
    await animate('.cup', { rotate: [0, -12, 14, -9, 6, 0], x: [0, -14, 16, -8, 4, 0] }, { duration: 0.7, ease: 'easeInOut' })
  }

  return (
    <motion.div
      ref={scope}
      onPointerEnter={() => onHover(true)}
      onPointerLeave={() => onHover(false)}
      onClick={soldOut ? undefined : shake}
      className="relative flex h-full min-w-0 cursor-pointer flex-col items-center"
      // nobody hovering → all three equal; hovering one → the others step back
      animate={{ scale: dimmed ? 0.9 : active ? 1.04 : 1, opacity: dimmed ? 0.35 : 1 }}
      transition={spring.glide}
      style={{ zIndex: active ? 20 : 1 }}
    >
      <AnimatePresence>{active && !soldOut && <Profile key="profile" drink={drink} side={side} />}</AnimatePresence>
      <div className="relative w-full flex-1">
        <motion.div
          aria-hidden
          className="absolute left-[2%] top-[8%] aspect-square w-[96%] rounded-full"
          style={{ background: `radial-gradient(circle, ${drink.tint} 0%, transparent 68%)` }}
          animate={{ scale: active ? [1, 1.12, 1] : 0.9, opacity: active ? 1 : 0.55 }}
          transition={active ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } : spring.glide}
        />
        {/* only the spotlighted drink runs particles — one WebGL context instead of three */}
        {active && !soldOut && <ParticleField preset={drink.particle} overrides={{ count: 30 }} speed={1.3} />}
        {/* wooden pedestal shadow */}
        <motion.div
          className="absolute bottom-[3%] left-1/2 h-[6%] w-[70%] -translate-x-1/2 rounded-[50%] bg-brown/25 blur-md"
          animate={{ scaleX: active ? 1 : 0.85, opacity: active ? 1 : 0.7 }}
          transition={spring.glide}
        />
        <motion.img
          src={drink.image}
          alt={drink.name}
          draggable={false}
          className={`cup absolute inset-x-0 bottom-[4%] mx-auto h-[92%] w-auto max-w-full object-contain drop-shadow-[0_26px_26px_rgb(90_46_26/0.35)] transition-[filter,opacity] duration-500 ${soldOut ? 'opacity-45 grayscale' : ''}`}
          style={{ transformOrigin: '50% 95%' }}
          animate={{ y: active && !soldOut ? -14 : 0 }}
          transition={spring.pop}
        />
        <SoldStamp show={soldOut} className="left-1/2 top-[42%] -translate-x-1/2" />
        <span className="mini-ple pointer-events-none absolute left-[6%] top-[18%] font-display text-[4.5vh] font-bold text-terracotta opacity-0 [text-shadow:3px_3px_0_#5a2e1a]">PLE!</span>
        <span className="mini-tok pointer-events-none absolute right-[6%] top-[12%] font-display text-[5vh] font-bold text-brown opacity-0 [text-shadow:3px_3px_0_#a8572a]">TOK!</span>
      </div>

      <div className="mt-[0.6vh] flex w-full flex-col items-center text-center">
        {/* name with the price right beside it — one compact row */}
        <div className="flex max-w-full items-center justify-center gap-[1.2vh]">
          <h3 className="min-w-0 font-display text-[clamp(1.1rem,3vh,2.1rem)] font-bold uppercase leading-[0.95] text-brown">{drink.name.replace('Pletok ', '')}</h3>
          {soldOut ? (
            <span className="shrink-0 font-display text-[3.4vh] font-bold text-brown/40 line-through decoration-terracotta decoration-[0.4vh]"><Morph text={`${drink.price}K`} /></span>
          ) : (
            <PriceTag price={drink.price} size="fluid" className="shrink-0" />
          )}
        </div>
        <p className="mt-[0.6vh] flex max-w-full flex-wrap items-center justify-center gap-x-1.5 font-cond text-[clamp(0.75rem,1.75vh,1.05rem)] font-semibold italic leading-tight text-brown">
          {drink.ingredients.map((ing, i) => (
            <span key={ing} className="flex items-center gap-x-1.5 whitespace-nowrap">
              {i > 0 && <span className="size-1 rounded-full" style={{ background: drink.accent }} />}
              {ing}
            </span>
          ))}
        </p>
        <div className="relative h-[3.4vh] w-full overflow-hidden">
          <AnimatePresence>
            {/* the profile card says it better — only a sold-out drink (no card) keeps its blurb line */}
            {active && soldOut && (
              <motion.p
                key="blurb"
                className="absolute inset-x-0 line-clamp-1 font-script text-[clamp(0.95rem,2.2vh,1.35rem)] leading-tight text-brown-soft"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={spring.snappy}
              >
                {drink.blurb}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </motion.div>
  )
}

const TASTE: Array<[keyof (typeof DRINK_PROFILE)['original']['taste'], string]> = [
  ['manis', 'Manis'],
  ['rempah', 'Rempah'],
  ['segar', 'Segar'],
  ['lembut', 'Lembut'],
]

/**
 * The drink up close, beside its cup: a taste meter, how it feels, who it's for, the upside and the
 * honest heads-up. Lines come in one after another, the meter fills dot by dot.
 */
function Profile({ drink, side }: { drink: Drink; side: 'left' | 'right' }) {
  const p = DRINK_PROFILE[drink.id]
  const dx = side === 'right' ? -24 : 24
  const line = (i: number) => ({ initial: { opacity: 0, x: dx / 2 }, animate: { opacity: 1, x: 0 }, transition: { ...spring.snappy, delay: 0.12 + i * 0.07 } })
  return (
    <motion.aside
      aria-label={`Tentang ${drink.name}`}
      className="pointer-events-none absolute top-[4%] w-[94%] rounded-[2.2vh] border-2 bg-cream/95 p-[1.8vh] text-brown shadow-[0_24px_50px_-24px_rgb(58_28_15/0.6)] backdrop-blur-md"
      style={{ [side === 'right' ? 'left' : 'right']: '88%', borderColor: `${drink.accent}55` } as CSSProperties}
      initial={{ opacity: 0, x: dx, scale: 0.94 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, x: dx / 2, scale: 0.97, transition: { duration: 0.18 } }}
      transition={spring.snappy}
    >
      {/* a little tab pointing back at its cup */}
      <span aria-hidden className="absolute top-[4vh] size-[1.6vh] rotate-45 border-2 bg-cream" style={{ [side === 'right' ? 'left' : 'right']: '-0.9vh', borderColor: `${drink.accent}55`, [side === 'right' ? 'borderRightColor' : 'borderLeftColor']: 'transparent', [side === 'right' ? 'borderTopColor' : 'borderBottomColor']: 'transparent' } as CSSProperties} />
      <motion.p {...line(0)} className="font-script text-[clamp(1rem,2.4vh,1.5rem)] leading-tight text-brown-soft">{p.feel}</motion.p>

      <div className="mt-[1.2vh] grid grid-cols-[auto_1fr] items-center gap-x-[1vh] gap-y-[0.5vh]">
        {TASTE.map(([k, label], i) => (
          <motion.div key={k} {...line(1 + i)} className="contents">
            <span className="font-cond text-[clamp(0.7rem,1.55vh,0.95rem)] font-semibold uppercase italic tracking-wider text-brown/60">{label}</span>
            <span className="flex gap-[0.5vh]" role="img" aria-label={`${label} ${p.taste[k]} dari 5`}>
              {[1, 2, 3, 4, 5].map((n) => (
                <motion.span
                  key={n}
                  className="h-[1.1vh] flex-1 rounded-full"
                  style={{ background: n <= p.taste[k] ? drink.accent : 'rgb(90 46 26 / 0.1)' }}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ ...spring.snappy, delay: 0.25 + i * 0.07 + n * 0.04 }}
                />
              ))}
            </span>
          </motion.div>
        ))}
      </div>

      <motion.p {...line(5)} className="mt-[1.3vh] font-cond text-[clamp(0.7rem,1.5vh,0.95rem)] font-semibold uppercase italic tracking-widest text-terracotta">Cocok buat</motion.p>
      <motion.div {...line(6)} className="mt-[0.4vh] flex flex-wrap gap-[0.5vh]">
        {p.goodFor.map((g) => (
          <span key={g} className="rounded-full px-[1vh] py-[0.25vh] font-display text-[clamp(0.7rem,1.55vh,0.95rem)] font-semibold" style={{ background: `${drink.accent}1f` }}>
            {g}
          </span>
        ))}
      </motion.div>

      <motion.p {...line(7)} className="mt-[1.2vh] font-display text-[clamp(0.75rem,1.65vh,1rem)] leading-snug">
        <b className="text-leaf">＋</b> {p.plus}
      </motion.p>
      <motion.p {...line(8)} className="mt-[0.7vh] flex gap-[0.6vh] font-display text-[clamp(0.75rem,1.65vh,1rem)] leading-snug text-brown/80">
        <Info className="mt-[0.2vh] size-[1.1em] shrink-0 text-terracotta" /> {p.heads}
      </motion.p>
    </motion.aside>
  )
}

import { AnimatePresence, motion, useAnimate } from 'motion/react'
import type { Drink } from '../data/menu'
import { spring } from '../lib/motion'
import { ParticleField } from './ParticleField'
import { PriceTag } from './PriceTag'

interface DrinkSpotlightProps {
  drink: Drink
  /** the one being hovered — lifts, glows, runs particles, shows its blurb */
  active: boolean
  /** another drink is hovered — step back so that one gets the focus */
  dimmed: boolean
  onHover: (on: boolean) => void
}

/** Booth-screen drink: lifts into the spotlight on hover, tap shakes it — PLE! TOK! */
export function DrinkSpotlight({ drink, active, dimmed, onHover }: DrinkSpotlightProps) {
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
      onClick={shake}
      className="relative flex h-full min-w-0 cursor-pointer flex-col items-center"
      // nobody hovering → all three equal; hovering one → the others step back
      animate={{ scale: dimmed ? 0.9 : active ? 1.04 : 1, opacity: dimmed ? 0.35 : 1 }}
      transition={spring.glide}
    >
      <div className="relative w-full flex-1">
        <motion.div
          aria-hidden
          className="absolute left-[2%] top-[8%] aspect-square w-[96%] rounded-full"
          style={{ background: `radial-gradient(circle, ${drink.tint} 0%, transparent 68%)` }}
          animate={{ scale: active ? [1, 1.12, 1] : 0.9, opacity: active ? 1 : 0.55 }}
          transition={active ? { duration: 3.5, repeat: Infinity, ease: 'easeInOut' } : spring.glide}
        />
        {/* only the spotlighted drink runs particles — one WebGL context instead of three */}
        {active && <ParticleField preset={drink.particle} overrides={{ count: 30 }} speed={1.3} />}
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
          className="cup absolute inset-x-0 bottom-[4%] mx-auto h-[92%] w-auto max-w-full object-contain drop-shadow-[0_26px_26px_rgb(90_46_26/0.35)]"
          style={{ transformOrigin: '50% 95%' }}
          animate={{ y: active ? -14 : 0 }}
          transition={spring.pop}
        />
        <span className="mini-ple pointer-events-none absolute left-[6%] top-[18%] font-display text-[4.5vh] font-bold text-terracotta opacity-0 [text-shadow:3px_3px_0_#5a2e1a]">PLE!</span>
        <span className="mini-tok pointer-events-none absolute right-[6%] top-[12%] font-display text-[5vh] font-bold text-brown opacity-0 [text-shadow:3px_3px_0_#a8572a]">TOK!</span>
      </div>

      <div className="mt-[0.6vh] flex w-full flex-col items-center text-center">
        {/* name with the price right beside it — one compact row */}
        <div className="flex max-w-full items-center justify-center gap-[1.2vh]">
          <h3 className="min-w-0 font-display text-[clamp(1.1rem,3vh,2.1rem)] font-bold uppercase leading-[0.95] text-brown">{drink.name.replace('Pletok ', '')}</h3>
          <PriceTag price={drink.price} size="fluid" className="shrink-0" />
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
            {active && (
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

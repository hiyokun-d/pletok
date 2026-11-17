import { motion, useMotionValue, useSpring, useTransform } from 'motion/react'
import { useEffect, useState, type PointerEvent } from 'react'
import { RotateCw } from 'lucide-react'
import { INGREDIENT_NOTES, type Drink } from '../data/menu'
import { useMenu } from '../hooks/useMenu'
import { pop, spring, stagger } from '../lib/motion'
import { ParticleField } from './ParticleField'
import { PriceTag } from './PriceTag'
import { Ornament } from './Ornament'
import { SoldStamp } from './SoldStamp'
import { Morph } from './Morph'

interface CupCardProps {
  drink: Drink
  index?: number
  /** Show its themed particle field behind the cup */
  particles?: boolean
  className?: string
  soldOut?: boolean
}

/** One card for all three drinks — props decide image, accent, particles. */
export function CupCard({ drink, index = 0, particles = true, className = '', soldOut = false }: CupCardProps) {
  const { bundles } = useMenu()
  const px = useMotionValue(0)
  const py = useMotionValue(0)
  const rx = useSpring(useTransform(py, [-0.5, 0.5], [10, -10]), spring.snappy)
  const ry = useSpring(useTransform(px, [-0.5, 0.5], [-12, 12]), spring.snappy)
  const cupX = useSpring(useTransform(px, [-0.5, 0.5], [-14, 14]), spring.glide)

  const onMove = (e: PointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect()
    px.set((e.clientX - r.left) / r.width - 0.5)
    py.set((e.clientY - r.top) / r.height - 0.5)
  }
  const reset = () => {
    px.set(0)
    py.set(0)
  }

  const flip = index % 2 === 1
  const [flipped, setFlipped] = useState(false)
  // the flip is a spring we read ourselves: each face shows only on its half of the turn,
  // because Safari can ignore backface-visibility once the faces hold animated layers
  const turn = useSpring(0, { stiffness: 160, damping: 18 })
  useEffect(() => turn.set(flipped ? 180 : 0), [flipped, turn])
  const frontShown = useTransform(turn, (v) => (v < 90 ? 1 : 0))
  const backShown = useTransform(turn, (v) => (v < 90 ? 0 : 1))

  return (
    <motion.article
      className={`relative ${className}`}
      initial="hidden"
      whileInView="show"
      viewport={{ once: false, amount: 0.35 }}
      variants={stagger(0.1)}
    >
      <motion.div
        onPointerMove={onMove}
        onPointerLeave={reset}
        style={{ rotateX: rx, rotateY: ry, transformPerspective: 900 }}
        variants={{
          hidden: { opacity: 0, x: flip ? 80 : -80, rotate: flip ? 6 : -6 },
          show: { opacity: 1, x: 0, rotate: 0, transition: spring.glide },
          exit: { opacity: 0, x: flip ? -60 : 60 },
        }}
        className="relative [transform-style:preserve-3d]"
      >
      <motion.div
        className="relative [transform-style:preserve-3d]"
        style={{ rotateY: turn }}
        onClick={() => setFlipped((f) => !f)}
        data-track={`kartu-${drink.id}`}
      >
      <motion.div style={{ opacity: frontShown }} className="relative isolate overflow-hidden rounded-[2rem] border-2 border-brown/10 bg-[#fbf5ec] px-5 pb-6 pt-4 shadow-[0_20px_50px_-24px_rgb(90_46_26/0.45)] [backface-visibility:hidden] [-webkit-backface-visibility:hidden]">
        {/* tinted glow */}
        <motion.div
          aria-hidden
          className="absolute left-1/2 top-8 -z-10 size-96 -translate-x-1/2 rounded-full"
          style={{ background: `radial-gradient(circle, ${drink.tint} 0%, transparent 65%)` }}
          animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
          transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.6 }}
        />
        {particles && <ParticleField preset={drink.particle} className="-z-10" />}
        <Ornament variant="spice-star" className={`absolute top-4 size-10 opacity-70 ${flip ? 'left-4' : 'right-4'}`} />

        <SoldStamp show={soldOut} className="left-1/2 top-28 -translate-x-1/2" />
        <motion.div
          className={`relative mx-auto h-72 w-60 transition-[filter,opacity] duration-500 ${soldOut ? 'opacity-45 grayscale' : ''}`}
          style={{ x: cupX }}
          animate={{ y: [0, -10, 0], rotate: [0, flip ? 1.5 : -1.5, 0] }}
          transition={{ duration: 4.5, repeat: Infinity, ease: 'easeInOut', delay: index * 0.4 }}
        >
          <motion.img
            src={drink.image}
            alt={drink.name}
            draggable={false}
            className="absolute inset-0 h-full w-full object-contain drop-shadow-[0_24px_24px_rgb(90_46_26/0.35)]"
            variants={{
              hidden: { y: 120, scale: 0.6, rotate: flip ? 18 : -18, opacity: 0 },
              show: { y: 0, scale: 1, rotate: 0, opacity: 1, transition: { ...spring.pop, stiffness: 260, damping: 14 } },
            }}
          />
        </motion.div>

        <PriceTag price={drink.price} className="absolute right-4 top-56" delay={0.35} />

        <motion.h3
          className="mt-3 font-display text-[1.7rem] font-bold uppercase leading-none tracking-tight text-brown"
          variants={{ hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: spring.snappy } }}
        >
          {drink.name}
        </motion.h3>
        <motion.p
          className="mt-2 font-script text-xl leading-snug text-brown-soft"
          variants={{ hidden: { opacity: 0 }, show: { opacity: 1, transition: { duration: 0.6 } } }}
        >
          {drink.blurb}
        </motion.p>
        <motion.ul className="mt-3 flex flex-wrap gap-1.5" variants={stagger(0.06, 0.2)}>
          {drink.ingredients.map((ing) => (
            <motion.li
              key={ing}
              variants={pop}
              className="rounded-full px-3 py-1 font-cond text-sm font-semibold italic"
              style={{ background: `${drink.accent}22`, color: '#5a2e1a', boxShadow: `inset 0 0 0 1.5px ${drink.accent}55` }}
            >
              {ing}
            </motion.li>
          ))}
        </motion.ul>
        <p className="mt-3 flex items-center gap-1.5 font-cond text-sm font-semibold italic text-brown/50">
          <RotateCw className="size-3.5" /> tap untuk lihat rempahnya
        </p>
      </motion.div>

      {/* back face */}
      <motion.div
        className="absolute inset-0 flex flex-col overflow-hidden rounded-[2rem] border-2 p-6 text-cream [backface-visibility:hidden] [-webkit-backface-visibility:hidden] [transform:rotateY(180deg)]"
        style={{ opacity: backShown, background: `linear-gradient(160deg, #5a2e1a, ${drink.accent})`, borderColor: `${drink.accent}66` }}
      >
        <p className="font-cond text-sm font-semibold uppercase italic tracking-widest text-yakult/80">Di dalam gelasnya</p>
        <h3 className="mt-1 font-display text-2xl font-bold uppercase leading-none">{drink.name}</h3>
        <ul className="mt-4 flex flex-col gap-2.5">
          {drink.ingredients.map((ing, i) => (
            <motion.li
              key={ing}
              className="flex items-baseline justify-between gap-3 border-b border-cream/15 pb-2"
              animate={flipped ? { opacity: 1, x: 0 } : { opacity: 0, x: 20 }}
              transition={{ ...spring.snappy, delay: flipped ? 0.25 + i * 0.06 : 0 }}
            >
              <span className="font-display text-lg font-semibold">{ing}</span>
              <span className="text-right font-script text-lg text-yakult">{INGREDIENT_NOTES[ing]}</span>
            </motion.li>
          ))}
        </ul>
        <div className="mt-auto pt-4">
          <p className="font-cond text-sm font-semibold uppercase italic tracking-widest text-yakult/80">Ada di paket</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {bundles.filter((b) => b.items.includes(drink.id)).map((b) => (
              <span key={b.name} className="rounded-full bg-cream/15 px-3 py-1 font-display text-sm font-semibold">
                {b.name.replace('Paket ', '')} · <Morph text={`${b.price}K`} />
              </span>
            ))}
          </div>
          <p className="mt-3 flex items-center gap-1.5 font-cond text-sm italic text-cream/60">
            <RotateCw className="size-3.5" /> tap untuk balik
          </p>
        </div>
      </motion.div>
      </motion.div>
      </motion.div>
    </motion.article>
  )
}

import { motion } from 'motion/react'
import { drinkById, type Bundle } from '../data/menu'
import { spring } from '../lib/motion'
import { useLite } from '../lib/perf'
import { PriceTag } from './PriceTag'
import { SoldStamp } from './SoldStamp'
import { Morph } from './Morph'

/** Bundle card — reuses the drink images; cups slide in and huddle together, then the price slashes. */
export function BundleCard({ bundle, index = 0, soldOut = false }: { bundle: Bundle; index?: number; soldOut?: boolean }) {
  const cups = bundle.items.map(drinkById)
  const mid = (cups.length - 1) / 2
  const save = (bundle.normal - bundle.price) * 1000
  const once = useLite()

  return (
    <motion.article
      initial="hidden"
      whileInView="show"
      viewport={{ once, amount: 0.4 }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.12 } } }}
      className="relative overflow-hidden rounded-[2rem] border-2 border-brown/10 bg-cream-deep/70 p-5 shadow-[0_16px_40px_-24px_rgb(90_46_26/0.5)]"
    >
      <SoldStamp show={soldOut} className="left-1/2 top-16 -translate-x-1/2" />
      <div className={`relative flex h-44 items-end justify-center transition-[filter,opacity] duration-500 ${soldOut ? 'opacity-45 grayscale' : ''}`}>
        <motion.div
          aria-hidden
          className="absolute bottom-0 h-8 w-[85%] rounded-[50%] bg-[radial-gradient(closest-side,rgb(90_46_26/0.18),transparent)]"
          variants={{ hidden: { scaleX: 0.3, opacity: 0 }, show: { scaleX: 1, opacity: 1, transition: spring.glide } }}
        />
        {cups.map((d, i) => (
          <motion.img
            key={d.id + i}
            src={d.image}
            alt={d.name}
            draggable={false}
            className="relative h-40 w-auto object-contain drop-shadow-[0_14px_14px_rgb(90_46_26/0.3)]"
            style={{ marginInline: -18, zIndex: i === Math.round(mid) ? 2 : 1 }}
            variants={{
              hidden: { x: (i - mid) * 140, y: 40, rotate: (i - mid) * 25, opacity: 0 },
              show: {
                x: 0,
                y: 0,
                rotate: (i - mid) * -6,
                opacity: 1,
                transition: { ...spring.pop, stiffness: 300, damping: 15, delay: index * 0.05 },
              },
            }}
            whileHover={{ y: -10, rotate: 0, transition: spring.snappy }}
          />
        ))}
      </div>
      <motion.h3
        className="mt-4 font-display text-2xl font-bold uppercase leading-none text-brown"
        variants={{ hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: spring.snappy } }}
      >
        {bundle.name}
      </motion.h3>
      <motion.p
        className="mt-1 font-cond text-lg font-medium italic text-brown-soft"
        variants={{ hidden: { opacity: 0 }, show: { opacity: 1 } }}
      >
        {bundle.detail}
      </motion.p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <motion.span
          className={`font-script text-2xl font-bold text-brown ${save > 0 ? '' : 'invisible'}`}
          variants={{ hidden: { opacity: 0, rotate: -6 }, show: { opacity: 1, rotate: -3, transition: spring.pop } }}
        >
          Hemat Rp <Morph text={save.toLocaleString('id-ID')} />
        </motion.span>
        <PriceTag price={bundle.price} was={bundle.normal} size="sm" delay={0.3} />
      </div>
    </motion.article>
  )
}

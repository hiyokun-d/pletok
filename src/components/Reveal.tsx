import { motion, type HTMLMotionProps, type Variants } from 'motion/react'
import { rise, stagger as staggerVariants } from '../lib/motion'
import { useLite } from '../lib/perf'

interface RevealProps extends Omit<HTMLMotionProps<'div'>, 'variants'> {
  variants?: Variants
  /** Stagger direct <Reveal.Item> children instead of animating as one block */
  stagger?: number
  delay?: number
  amount?: number
}

/**
 * The one entrance/exit wrapper. It animates in when scrolled into view and back out
 * when it leaves, so every section has both an "in" and an "out" (lite mode: in once, then it stays).
 */
export function Reveal({ variants, stagger, delay = 0, amount = 0.25, children, ...rest }: RevealProps) {
  const once = useLite()
  return (
    <motion.div
      initial="hidden"
      whileInView="show"
      exit="exit"
      viewport={{ once, amount }}
      variants={variants ?? (stagger !== undefined ? staggerVariants(stagger, delay) : rise)}
      {...rest}
    >
      {children}
    </motion.div>
  )
}

/** Child of a staggered Reveal */
export function RevealItem({ variants = rise, ...rest }: Omit<HTMLMotionProps<'div'>, 'variants'> & { variants?: Variants }) {
  return <motion.div variants={variants} {...rest} />
}

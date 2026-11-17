import { motion, type Transition } from 'motion/react'

type Variant = 'leaf' | 'spice-star' | 'dashes' | 'batik-corner' | 'divider'

interface OrnamentProps {
  variant: Variant
  className?: string
  color?: string
  /** Draw strokes in when scrolled into view */
  draw?: boolean
  delay?: number
  flip?: boolean
}

/**
 * Every decorative motif from the menu poster, redrawn as one SVG component.
 * Strokes draw themselves in (pathLength) so ornaments feel hand-inked.
 */
export function Ornament({ variant, className = '', color, draw = true, delay = 0, flip = false }: OrnamentProps) {
  const t = (i = 0, duration = 1.1): Transition => ({ duration, delay: delay + i * 0.12, ease: [0.65, 0, 0.35, 1] })
  const stroke = {
    initial: draw ? { pathLength: 0, opacity: 0 } : false,
    whileInView: { pathLength: 1, opacity: 1 },
    viewport: { once: false, amount: 0.4 },
  } as const
  const fillIn = (i = 0) =>
    ({
      initial: draw ? { scale: 0, opacity: 0 } : false,
      whileInView: { scale: 1, opacity: 1 },
      viewport: { once: false, amount: 0.4 },
      transition: { type: 'spring', stiffness: 380, damping: 16, delay: delay + 0.3 + i * 0.1 },
    }) as const
  const style = flip ? { transform: 'scaleX(-1)' } : undefined

  switch (variant) {
    case 'leaf':
      // two-tone leaf pair, like the poster's corner leaves
      return (
        <svg viewBox="0 0 120 120" className={className} style={style} aria-hidden>
          {[
            { d: 'M60 110 C 20 90 10 45 40 12 C 55 45 70 80 60 110 Z', rot: -18, c1: '#5e7b3a', c2: '#7d9a48' },
            { d: 'M62 110 C 100 92 112 55 92 22 C 76 52 64 82 62 110 Z', rot: 8, c1: '#6f8c3f', c2: '#a3b860' },
          ].map((l, i) => (
            <motion.g key={i} style={{ originX: '50%', originY: '92%' }} {...fillIn(i)}>
              <path d={l.d} fill={color ?? l.c1} />
              <path d={l.d} fill={color ?? l.c2} style={{ clipPath: 'inset(0 0 0 50%)' }} />
              <motion.path d={l.d.split('C')[0] + 'L ' + (i ? '92 22' : '40 12')} stroke="#3e5226" strokeWidth={1.6} fill="none" opacity={0.5} {...stroke} transition={t(i)} />
            </motion.g>
          ))}
        </svg>
      )
    case 'spice-star': {
      const c = color ?? '#c27a3a'
      return (
        <svg viewBox="0 0 100 100" className={className} style={style} aria-hidden>
          {[0, 90, 180, 270].map((r, i) => (
            <g key={r} transform={`rotate(${r + 45} 50 50)`}>
              <motion.path d="M50 50 C 40 38 40 18 50 6 C 60 18 60 38 50 50 Z" stroke={c} strokeWidth={4} fill="none" strokeLinejoin="round" {...stroke} transition={t(i, 0.8)} />
              <motion.circle cx={50} cy={27} r={3.4} fill={c} {...fillIn(i)} />
            </g>
          ))}
        </svg>
      )
    }
    case 'dashes': {
      const c = color ?? '#5a2e1a'
      return (
        <svg viewBox="0 0 40 60" className={className} style={style} aria-hidden>
          {['M6 14 L 26 6', 'M4 30 L 30 30', 'M6 46 L 26 54'].map((d, i) => (
            <motion.path key={d} d={d} stroke={c} strokeWidth={5} strokeLinecap="round" {...stroke} transition={t(i, 0.4)} />
          ))}
        </svg>
      )
    }
    case 'divider': {
      const c = color ?? '#a8572a'
      return (
        <svg viewBox="0 0 300 20" className={className} aria-hidden preserveAspectRatio="none">
          <motion.path d="M4 10 H 136" stroke={c} strokeWidth={1.5} opacity={0.5} {...stroke} transition={t(0, 0.9)} />
          <motion.path d="M164 10 H 296" stroke={c} strokeWidth={1.5} opacity={0.5} {...stroke} transition={t(0, 0.9)} />
          <motion.path d="M150 2 L 158 10 L 150 18 L 142 10 Z" fill={c} {...fillIn(1)} />
        </svg>
      )
    }
    case 'batik-corner': {
      // vine flourish with curling tendrils — a simplified take on the poster's batik corners
      const c = color ?? '#7a4a33'
      const paths = [
        'M8 196 C 30 150 20 110 60 90 C 95 72 120 96 110 120 C 100 140 76 132 80 116 C 84 104 98 106 98 114',
        'M8 196 C 60 186 96 196 128 170 C 156 148 150 118 128 112 C 112 108 104 124 114 132 C 122 138 132 130 128 122',
        'M60 90 C 54 60 70 34 96 26 C 118 20 132 38 122 52 C 114 62 100 56 104 46',
        'M128 170 C 150 182 176 176 186 156 C 194 140 182 126 170 132 C 160 138 166 150 174 146',
      ]
      const leaves = [
        { x: 38, y: 128, r: -40 },
        { x: 92, y: 182, r: 30 },
        { x: 78, y: 58, r: -10 },
        { x: 150, y: 150, r: 60 },
        { x: 24, y: 168, r: -70 },
      ]
      return (
        <svg viewBox="0 0 200 200" className={className} style={style} aria-hidden>
          {paths.map((d, i) => (
            <motion.path key={i} d={d} stroke={c} strokeWidth={4} fill="none" strokeLinecap="round" {...stroke} transition={t(i, 1.4)} />
          ))}
          {leaves.map((l, i) => (
            <motion.path
              key={i}
              d="M0 0 C 6 -8 18 -8 24 0 C 18 8 6 8 0 0 Z"
              fill={c}
              transform={`translate(${l.x} ${l.y}) rotate(${l.r})`}
              {...fillIn(i + 2)}
            />
          ))}
        </svg>
      )
    }
  }
}

import { useId } from 'react'

/*
 * Betawi & Nusantara ornament, drawn here as plain SVG patterns (no pictures, any size):
 *   - gigi balang — the row of "teeth" (downward triangles) under the eaves of a Betawi house;
 *     said to be a balang's (grasshopper's) jaw: honest, strong, patient
 *   - tumpal — the row of tall triangles on the edge of a batik or songket cloth
 *   - kawung — four ovals around a centre, the oldest batik motif in Java
 * All tile seamlessly; pass a className for size/position and colours for the brand.
 */

/** the eave fringe of a Betawi house: a band with a row of teeth hanging off it */
export function GigiBalang({ className = '', color = '#a8572a', accent = '#f1d3a8', flip = false, size = 36 }: { className?: string; color?: string; accent?: string; flip?: boolean; size?: number }) {
  const id = useId().replace(/:/g, '')
  const h = size * 1.15
  return (
    <svg className={className} style={flip ? { transform: 'scaleY(-1)' } : undefined} width="100%" height={h} aria-hidden>
      <defs>
        <pattern id={`gb-${id}`} width={size} height={h} patternUnits="userSpaceOnUse">
          <rect width={size} height={size * 0.18} fill={color} />
          {/* the tooth, with a cut-out diamond like the carved wood */}
          <path d={`M0 ${size * 0.18} H${size} L${size / 2} ${h} Z`} fill={color} />
          <path d={`M${size / 2} ${size * 0.34} L${size * 0.62} ${size * 0.52} L${size / 2} ${size * 0.7} L${size * 0.38} ${size * 0.52} Z`} fill={accent} />
          <circle cx={0} cy={size * 0.09} r={size * 0.05} fill={accent} />
        </pattern>
      </defs>
      <rect width="100%" height={h} fill={`url(#gb-${id})`} />
    </svg>
  )
}

/** a border of tall tumpal triangles, each with a chevron inside — the edge of a sarung */
export function Tumpal({ className = '', color = '#5e7b3a', accent = '#f1d3a8', size = 30, flip = false }: { className?: string; color?: string; accent?: string; size?: number; flip?: boolean }) {
  const id = useId().replace(/:/g, '')
  const h = size * 1.6
  return (
    <svg className={className} style={flip ? { transform: 'scaleY(-1)' } : undefined} width="100%" height={h} aria-hidden>
      <defs>
        <pattern id={`tp-${id}`} width={size} height={h} patternUnits="userSpaceOnUse">
          <path d={`M0 ${h} L${size / 2} 0 L${size} ${h} Z`} fill={color} />
          <path d={`M${size * 0.22} ${h} L${size / 2} ${h * 0.4} L${size * 0.78} ${h}`} stroke={accent} strokeWidth={size * 0.07} fill="none" />
          <path d={`M${size * 0.36} ${h} L${size / 2} ${h * 0.68} L${size * 0.64} ${h}`} stroke={accent} strokeWidth={size * 0.06} fill="none" />
        </pattern>
      </defs>
      <rect width="100%" height={h} fill={`url(#tp-${id})`} />
    </svg>
  )
}

/** kawung batik as a full background (keep it faint: opacity on the className) */
export function Kawung({ className = '', color = '#f1d3a8', size = 64 }: { className?: string; color?: string; size?: number }) {
  const id = useId().replace(/:/g, '')
  const s = size
  const r = s * 0.22
  return (
    <svg className={className} width="100%" height="100%" aria-hidden>
      <defs>
        <pattern id={`kw-${id}`} width={s} height={s} patternUnits="userSpaceOnUse">
          {/* four petals around the tile's corner points meet in a small cross */}
          {[
            [s / 2, s / 2 - r * 0.95, 0],
            [s / 2 + r * 0.95, s / 2, 90],
            [s / 2, s / 2 + r * 0.95, 0],
            [s / 2 - r * 0.95, s / 2, 90],
          ].map(([x, y, rot], i) => (
            <ellipse key={i} cx={x} cy={y} rx={r * 0.55} ry={r * 0.95} transform={`rotate(${rot} ${x} ${y})`} fill="none" stroke={color} strokeWidth={s * 0.03} />
          ))}
          <circle cx={s / 2} cy={s / 2} r={s * 0.04} fill={color} />
          <circle cx={0} cy={0} r={s * 0.06} fill={color} />
          <circle cx={s} cy={0} r={s * 0.06} fill={color} />
          <circle cx={0} cy={s} r={s * 0.06} fill={color} />
          <circle cx={s} cy={s} r={s * 0.06} fill={color} />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#kw-${id})`} />
    </svg>
  )
}

/** the carved double door of a Betawi house — closed after the boom, swings open in 3D (animate .door-l / .door-r rotateY) */
export function Lawang({ className = '' }: { className?: string }) {
  return (
    <div className={`pointer-events-none absolute inset-0 flex ${className}`} style={{ perspective: 1600 }}>
      {(['l', 'r'] as const).map((side) => (
        <div
          key={side}
          className={`door-${side} relative h-full w-1/2 overflow-hidden border-[#1f0f07] bg-[#4a2414] [backface-visibility:hidden] ${side === 'l' ? 'origin-left border-r-2' : 'origin-right border-l-2'}`}
        >
          <Kawung className="absolute inset-0 opacity-20" color="#c98a3c" size={56} />
          {/* carved inner panel with an arched top */}
          <div className="absolute inset-x-[12%] bottom-[8%] top-[14%] rounded-t-[45%] border-2 border-[#c98a3c]/50" />
          <div className="absolute inset-x-[18%] bottom-[11%] top-[18%] rounded-t-[45%] border border-[#c98a3c]/30" />
          <div className="absolute inset-x-0 top-0">
            <GigiBalang color="#2b160c" accent="#c98a3c" size={28} />
          </div>
          {/* brass ring handle by the meeting edge */}
          <span className={`absolute top-1/2 size-[3vh] -translate-y-1/2 rounded-full border-[3px] border-[#c98a3c] ${side === 'l' ? 'right-[7%]' : 'left-[7%]'}`} />
        </div>
      ))}
    </div>
  )
}

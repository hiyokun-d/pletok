import { useId, type ReactNode } from 'react'

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
export function Lawang({ className = '', open = false }: { className?: string; open?: boolean }) {
  return (
    <div className={`pointer-events-none absolute inset-0 flex ${className}`} style={{ perspective: 1600 }}>
      {(['l', 'r'] as const).map((side) => (
        <div
          key={side}
          style={open ? { transform: `rotateY(${side === 'l' ? -110 : 110}deg)` } : undefined}
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
          {/* low on the door, clear of whatever is written across the middle */}
          <span className={`absolute top-[68%] size-[3vh] -translate-y-1/2 rounded-full border-[3px] border-[#c98a3c] ${side === 'l' ? 'right-[7%]' : 'left-[7%]'}`} />
        </div>
      ))}
    </div>
  )
}

/* ---- the Nusantara pattern wall (grand opening countdown) */

export type BatikKind = 'kawung' | 'parang' | 'truntum' | 'megamendung' | 'ceplok' | 'songket' | 'tumpal' | 'gigibalang'

/** each pattern with where it comes from — the wall labels its tiles with these */
/** traditional colourways: sogan browns for the Javanese court patterns, Cirebon's indigo, songket red & gold */
export const BATIK_COLORS: Record<BatikKind, { bg: string; ink: string; edge: string }> = {
  kawung: { bg: '#5a2e1a', ink: '#ecdcc5', edge: '#2b160c' },
  parang: { bg: '#7a4a24', ink: '#f1d3a8', edge: '#2b160c' },
  megamendung: { bg: '#1f3b63', ink: '#cfe0f2', edge: '#0f1f38' },
  truntum: { bg: '#24283d', ink: '#f1e6c8', edge: '#12141f' },
  songket: { bg: '#7a1f24', ink: '#e6b84a', edge: '#3d0d10' },
  ceplok: { bg: '#3f5226', ink: '#efe3c2', edge: '#1f2a12' },
  gigibalang: { bg: '#a8572a', ink: '#2b160c', edge: '#5a2e1a' },
  tumpal: { bg: '#4a2414', ink: '#c98a3c', edge: '#1f0f07' },
}

export const BATIK: Array<{ kind: BatikKind; name: string; from: string }> = [
  { kind: 'gigibalang', name: 'Gigi Balang', from: 'Betawi' },
  { kind: 'kawung', name: 'Kawung', from: 'Yogyakarta' },
  { kind: 'parang', name: 'Parang', from: 'Surakarta' },
  { kind: 'megamendung', name: 'Mega Mendung', from: 'Cirebon' },
  { kind: 'truntum', name: 'Truntum', from: 'Surakarta' },
  { kind: 'songket', name: 'Songket', from: 'Palembang' },
  { kind: 'ceplok', name: 'Ceplok', from: 'Jawa' },
  { kind: 'tumpal', name: 'Tumpal', from: 'Nusantara' },
]

/** one tile-able pattern — fills its box. Plain SVG: drawn once, cheap on any phone */
export function Batik({ kind, className = '', color = '#c98a3c', size = 48 }: { kind: BatikKind; className?: string; color?: string; size?: number }) {
  const id = useId().replace(/:/g, '')
  if (kind === 'kawung') return <Kawung className={className} color={color} size={size} />
  const s = size
  const w = s * 0.05
  const line = { fill: 'none', stroke: color, strokeWidth: w, strokeLinecap: 'round' as const }
  let body: ReactNode
  switch (kind) {
    case 'parang':
      // diagonal bands of linked "S" blades with the small lozenge (mlinjon) between them
      body = (
        <>
          <path d={`M${-s * 0.1} ${s * 0.6} C ${s * 0.15} ${s * 0.3}, ${s * 0.35} ${s * 0.55}, ${s * 0.6} ${-s * 0.1}`} {...line} strokeWidth={w * 2.4} />
          <path d={`M${s * 0.4} ${s * 1.1} C ${s * 0.65} ${s * 0.8}, ${s * 0.85} ${s * 1.05}, ${s * 1.1} ${s * 0.4}`} {...line} strokeWidth={w * 2.4} />
          <path d={`M${s * 0.72} ${s * 0.18} l${s * 0.1} ${s * 0.1} l${-s * 0.1} ${s * 0.1} l${-s * 0.1} ${-s * 0.1} Z`} fill={color} />
          <path d={`M${s * 0.22} ${s * 0.68} l${s * 0.1} ${s * 0.1} l${-s * 0.1} ${s * 0.1} l${-s * 0.1} ${-s * 0.1} Z`} fill={color} />
        </>
      )
      break
    case 'truntum':
      // little star-flowers scattered like a night sky (the "love that blooms again" batik)
      body = (
        <>
          {[[s * 0.25, s * 0.25], [s * 0.75, s * 0.75]].map(([x, y], i) => (
            <g key={i} transform={`translate(${x} ${y})`}>
              {Array.from({ length: 8 }, (_, k) => (
                <ellipse key={k} cx={0} cy={-s * 0.09} rx={s * 0.03} ry={s * 0.07} fill={color} transform={`rotate(${k * 45})`} />
              ))}
              <circle r={s * 0.035} fill="none" stroke={color} strokeWidth={w * 0.6} />
            </g>
          ))}
          <circle cx={s * 0.75} cy={s * 0.25} r={s * 0.025} fill={color} />
          <circle cx={s * 0.25} cy={s * 0.75} r={s * 0.025} fill={color} />
        </>
      )
      break
    case 'megamendung':
      // Cirebon's rain clouds: nested rounded arcs stepping down
      body = (
        <>
          {[0, 1, 2].map((k) => {
            const r = s * (0.38 - k * 0.1)
            return <path key={k} d={`M${s * 0.5 - r} ${s * 0.7} a${r / 2} ${r / 2} 0 0 1 ${r} 0 a${r / 2} ${r / 2} 0 0 1 ${r} 0`} {...line} />
          })}
          <path d={`M0 ${s * 0.2} a${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.24} 0`} {...line} />
          <path d={`M${s * 0.76} ${s * 0.2} a${s * 0.12} ${s * 0.12} 0 0 1 ${s * 0.24} 0`} {...line} />
        </>
      )
      break
    case 'ceplok':
      // a rosette in a square grid — four pointed petals, a ring, a dot
      body = (
        <>
          <rect x={0} y={0} width={s} height={s} {...line} strokeWidth={w * 0.6} />
          {[0, 90, 180, 270].map((r) => (
            <path key={r} d={`M${s / 2} ${s / 2} Q ${s * 0.62} ${s * 0.3} ${s / 2} ${s * 0.12} Q ${s * 0.38} ${s * 0.3} ${s / 2} ${s / 2} Z`} fill={color} transform={`rotate(${r + 45} ${s / 2} ${s / 2})`} />
          ))}
          <circle cx={s / 2} cy={s / 2} r={s * 0.1} fill="none" stroke={color} strokeWidth={w} />
        </>
      )
      break
    case 'songket':
      // gold-thread lozenge lattice with a small diamond inside each
      body = (
        <>
          <path d={`M${s / 2} 0 L${s} ${s / 2} L${s / 2} ${s} L0 ${s / 2} Z`} {...line} />
          <path d={`M${s / 2} ${s * 0.3} L${s * 0.7} ${s / 2} L${s / 2} ${s * 0.7} L${s * 0.3} ${s / 2} Z`} fill={color} />
          <circle cx={0} cy={0} r={s * 0.06} fill={color} />
          <circle cx={s} cy={s} r={s * 0.06} fill={color} />
        </>
      )
      break
    case 'tumpal':
      body = (
        <>
          <path d={`M0 ${s} L${s / 2} 0 L${s} ${s} Z`} {...line} />
          <path d={`M${s * 0.25} ${s} L${s / 2} ${s * 0.45} L${s * 0.75} ${s}`} {...line} />
          <circle cx={s / 2} cy={s * 0.78} r={s * 0.05} fill={color} />
        </>
      )
      break
    case 'gigibalang':
      body = (
        <>
          <rect width={s} height={s * 0.14} fill={color} />
          <path d={`M0 ${s * 0.14} H${s} L${s / 2} ${s * 0.6} Z`} fill={color} />
          <path d={`M${s / 2} ${s * 0.22} l${s * 0.08} ${s * 0.1} l${-s * 0.08} ${s * 0.1} l${-s * 0.08} ${-s * 0.1} Z`} fill="#1f0f07" />
          <path d={`M0 ${s * 0.6} H${s} L${s / 2} ${s} Z`} {...line} strokeWidth={w * 0.6} />
        </>
      )
      break
  }
  return (
    <svg className={className} width="100%" height="100%" aria-hidden>
      <defs>
        <pattern id={`bt-${id}`} width={s} height={s} patternUnits="userSpaceOnUse">
          {body}
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill={`url(#bt-${id})`} />
    </svg>
  )
}

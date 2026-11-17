import { LOGO_BROWN, type LogoPart } from '../data/logo'

/** One traced vector piece of the logo (a letter or the tagline) */
export function LogoPiece({ part, className = '', color = LOGO_BROWN }: { part: LogoPart; className?: string; color?: string }) {
  return (
    <svg viewBox={`0 0 ${part.vw} ${part.vh}`} className={className} preserveAspectRatio="none" aria-hidden>
      <path d={part.d} fill={color} fillRule="evenodd" />
    </svg>
  )
}


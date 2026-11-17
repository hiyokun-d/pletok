import { LOGO_PATHS } from './logoPaths'

/** Frame around the whole logo (letters + sprout + tagline) in source-logo pixels */
export const LOGO_BOX = { x: 100, y: 76, w: 352, h: 208 }
/** Where the sprout sits on top of the T, in source-logo pixels */
export const LEAF_BOX = { x: 257.1, y: 80.3, w: 76.7, h: 63.7 }
export const LOGO_BROWN = '#6a371c'

type PathKey = keyof typeof LOGO_PATHS
export interface LogoPart {
  id: PathKey
  x: number
  y: number
  w: number
  h: number
  vw: number
  vh: number
  d: string
}

const part = (id: PathKey): LogoPart => ({ id, ...LOGO_PATHS[id] })

export const LETTERS: LogoPart[] = (['P', 'L', 'E', 'T', 'O', 'K'] as const).map(part)
export const TAGLINE: LogoPart = part('tagline')

/** Percent box of a part inside LOGO_BOX — lets the rig scale with any container width */
export const pct = (p: { x: number; y: number; w: number; h: number }) => ({
  left: `${((p.x - LOGO_BOX.x) / LOGO_BOX.w) * 100}%`,
  top: `${((p.y - LOGO_BOX.y) / LOGO_BOX.h) * 100}%`,
  width: `${(p.w / LOGO_BOX.w) * 100}%`,
  height: `${(p.h / LOGO_BOX.h) * 100}%`,
})

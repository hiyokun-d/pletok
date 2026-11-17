/**
 * Particle presets are plain data. <ParticleField> reads one of these and only swaps
 * uniforms — the WebGL canvas, geometry and program are never rebuilt.
 */
export type ParticleShape = 'leaf' | 'spice' | 'bubble' | 'sparkle' | 'mixed'
export type ParticleEmitter = 'top' | 'bottom' | 'area' | 'points'

export interface ParticlePreset {
  shape: ParticleShape
  emitter: ParticleEmitter
  mode: 'ambient' | 'burst'
  count: number
  colors: string[]
  /** px — [min, max] */
  size: [number, number]
  /** px/s travel speed for ambient top/bottom emitters */
  travel: [number, number]
  /** px/s horizontal drift */
  wind: number
  /** px amplitude of side-to-side sway */
  sway: number
  /** rad/s spin */
  spin: number
  /** px/s² (burst only) */
  gravity: number
  /** px/s initial speed (burst only) */
  burstSpeed: [number, number]
  /** s — [min, max] (burst + area) */
  life: [number, number]
  opacity: number
}

const base: ParticlePreset = {
  shape: 'leaf',
  emitter: 'top',
  mode: 'ambient',
  count: 40,
  colors: ['#5e7b3a'],
  size: [14, 26],
  travel: [28, 60],
  wind: 12,
  sway: 40,
  spin: 1.2,
  gravity: 900,
  burstSpeed: [250, 700],
  life: [2, 4],
  opacity: 1,
}

export const PRESETS = {
  /** Drifting jamu leaves — the signature background */
  leaf: { ...base, colors: ['#5e7b3a', '#8faa4f', '#6f8c3f', '#a3b860'] },
  /** Cloves & spice stars, like the motif on the menu poster */
  spice: {
    ...base,
    shape: 'spice',
    count: 26,
    colors: ['#a8572a', '#c98a3c', '#7a4a33'],
    size: [10, 18],
    travel: [20, 40],
    sway: 24,
    spin: 0.8,
  },
  /** Sparkling-water bubbles rising */
  fizz: {
    ...base,
    shape: 'bubble',
    emitter: 'bottom',
    count: 46,
    colors: ['#e9827f', '#f4a9a5', '#ffffff'],
    size: [6, 16],
    travel: [50, 120],
    wind: 0,
    sway: 10,
    spin: 0,
  },
  /** Twinkles that fade in and out in place */
  sparkle: {
    ...base,
    shape: 'sparkle',
    emitter: 'area',
    count: 24,
    colors: ['#c98a3c', '#f1d3a8', '#ffffff'],
    size: [8, 18],
    sway: 6,
    spin: 0.6,
    life: [1.6, 3.2],
  },
  /** One-shot explosion at given points — closing sequence + price reveals */
  burst: {
    ...base,
    shape: 'mixed',
    emitter: 'points',
    mode: 'burst',
    count: 260,
    colors: ['#5e7b3a', '#8faa4f', '#a8572a', '#c98a3c', '#e9827f'],
    size: [8, 22],
    spin: 4,
    gravity: 1100,
    burstSpeed: [260, 900],
    life: [1.4, 2.6],
  },
} satisfies Record<string, ParticlePreset>

export type PresetName = keyof typeof PRESETS

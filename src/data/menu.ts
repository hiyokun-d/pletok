import cupOriginal from '../assets/cup-original.png'
import cupYakult from '../assets/cup-yakult.png'
import cupLychee from '../assets/cup-lychee.png'
import type { PresetName } from '../components/particlePresets'

export type DrinkId = 'original' | 'yakult' | 'lychee'

export interface Drink {
  id: DrinkId
  name: string
  short: string
  price: number
  image: string
  ingredients: string[]
  blurb: string
  /** Accent color used for glow, particles and chips */
  accent: string
  tint: string
  particle: PresetName
}

export const DRINKS: Drink[] = [
  {
    id: 'original',
    name: 'Pletok Original',
    short: 'Original',
    price: 18,
    image: cupOriginal,
    ingredients: ['Jahe', 'Kayu Manis', 'Cengkeh', 'Serai'],
    blurb: 'Resep rempah Betawi yang hangat — pedas jahe, wangi serai, manis kayu manis.',
    accent: '#a8572a',
    tint: '#e8c3a3',
    particle: 'spice',
  },
  {
    id: 'lychee',
    name: 'Pletok Lychee Sparkling',
    short: 'Lychee Sparkling',
    price: 20,
    image: cupLychee,
    ingredients: ['Jahe', 'Kayu Manis', 'Cengkeh', 'Serai', 'Lychee', 'Sparkling'],
    blurb: 'Fruity, fizzy and full of refreshing surprise.',
    accent: '#e9827f',
    tint: '#f8d2cf',
    particle: 'fizz',
  },
  {
    id: 'yakult',
    name: 'Pletok Yakult',
    short: 'Yakult',
    price: 20,
    image: cupYakult,
    ingredients: ['Rempah Betawi', 'Yakult'],
    blurb: 'A creamy, sweet-and-tangy twist that blends Betawi spices with Yakult.',
    accent: '#c98a3c',
    tint: '#f6e2c2',
    particle: 'sparkle',
  },
]

export const drinkById = (id: DrinkId) => DRINKS.find((d) => d.id === id)!

export interface Bundle {
  name: string
  items: DrinkId[]
  detail: string
  price: number
  normal: number
}

export const BUNDLES: Bundle[] = [
  { name: 'Paket Duo Klasik', items: ['original', 'yakult'], detail: '1 Pletok Original + 1 Pletok Yakult', price: 35, normal: 38 },
  { name: 'Paket Duo Segar', items: ['original', 'lychee'], detail: '1 Pletok Original + 1 Pletok Lychee Sparkling', price: 35, normal: 38 },
  { name: 'Paket Trio Kalcer', items: ['original', 'lychee', 'yakult'], detail: 'All-Variant · 1 Original + 1 Lychee + 1 Yakult', price: 52, normal: 58 },
]

export const TAGLINE = 'Tradisi Abadi, Jiwa Muda'

/** Short notes shown on the back of each drink card */
export const INGREDIENT_NOTES: Record<string, string> = {
  Jahe: 'hangat & sedikit pedas',
  'Kayu Manis': 'manis-wangi, bikin rileks',
  Cengkeh: 'aroma rempah yang tegas',
  Serai: 'segar, wangi citrus',
  Lychee: 'manis buah leci',
  Sparkling: 'soda yang bikin nyes',
  'Rempah Betawi': 'jahe, kayu manis, cengkeh, serai',
  Yakult: 'creamy, asam-manis',
}

export const bundlesWith = (id: DrinkId) => BUNDLES.filter((b) => b.items.includes(id))

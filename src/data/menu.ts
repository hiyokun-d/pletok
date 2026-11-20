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

/**
 * What each drink is like, for the booth screen's spotlight: taste on a 1–5 scale, how it feels,
 * who it's for, the upside and the honest heads-up. Kept modest — taste & tradition, no health promises.
 */
export interface DrinkProfile {
  taste: { manis: number; rempah: number; segar: number; lembut: number }
  feel: string
  goodFor: string[]
  plus: string
  heads: string
  /** where it comes from */
  origin: string
  /** the drinking, start to finish */
  sensation: string[]
  /** modest, tradition-and-taste upsides — never a cure */
  benefits: string[]
  /** a rough per-cup estimate from the recipe, not a lab test — ESTIMATE, re-check against the team's recipe */
  gizi: { kkal: string; gula: string; kafein: string; alkohol: string; lain: string }
  /** honest: what too many cups does */
  tooMuch: string[]
}
export const DRINK_PROFILE: Record<DrinkId, DrinkProfile> = {
  original: {
    taste: { manis: 2, rempah: 5, segar: 2, lembut: 1 },
    feel: 'Hangat di tenggorokan — pedas jahe datang pelan, wangi serai di ujung.',
    goodFor: ['Pencinta rasa jamu', 'Habis makan berat', 'Cuaca adem / hujan'],
    plus: 'Rempah asli Betawi yang turun-temurun diminum buat menghangatkan badan. 0% alkohol, halal.',
    heads: 'Jahenya terasa pedas — perut sensitif? Minum pelan-pelan.',
    origin: 'Batavia, zaman kolonial. Orang Betawi meracik "bir" versi mereka sendiri dari rempah — halal, tanpa alkohol — sebagai tandingan bir Belanda. Resep kami tetap setia ke rempah aslinya.',
    sensation: ['Teguk pertama: manis tipis & wangi serai', 'Lalu jahe pelan-pelan menghangat di tenggorokan', 'Penutupnya: cengkeh & kayu manis tertinggal lama'],
    benefits: ['Jahe dari dulu dipakai untuk meredakan mual & bikin badan hangat', 'Serai & kayu manis bikin aromanya menenangkan', 'Tanpa alkohol, tanpa kafein — aman diminum siang-sore'],
    gizi: { kkal: '± 80–100 kkal', gula: '± 18–22 g', kafein: '0 mg', alkohol: '0%', lain: 'Tanpa susu · tanpa soda' },
    tooMuch: ['Jahe berlebihan bisa bikin perih lambung / heartburn', 'Gulanya tetap ada — 2–3 cup sehari itu sudah banyak', 'Sedang minum obat pengencer darah? Jangan kebanyakan jahe & cengkeh'],
  },
  lychee: {
    taste: { manis: 4, rempah: 2, segar: 5, lembut: 1 },
    feel: 'Nyes di lidah: soda leci yang manis dulu, hangat rempah menyusul belakangan.',
    goodFor: ['Siang yang panas', 'Pertama kali coba bir pletok', 'Suka minuman bersoda'],
    plus: 'Paling segar & ringan dari ketiganya — pintu paling gampang buat kenalan sama rempah.',
    heads: 'Bersoda dan paling manis di antara ketiganya.',
    origin: 'Racikan baru Tim Pletok: basis bir pletok Betawi ketemu leci (buah asal Tiongkok selatan yang sudah lama akrab di Indonesia) dan soda. Tradisi yang dibikin lebih ringan buat lidah anak muda.',
    sensation: ['Desis soda & wangi leci langsung kena di hidung', 'Manis buahnya ringan, dingin, nyes', 'Hangat rempah baru muncul di belakang — kejutan kecilnya'],
    benefits: ['Paling menyegarkan saat siang panas', 'Ada potongan buah leci asli', 'Cara paling gampang kenalan sama rasa rempah'],
    gizi: { kkal: '± 100–130 kkal', gula: '± 24–30 g', kafein: '0 mg', alkohol: '0%', lain: 'Bersoda · tanpa susu' },
    tooMuch: ['Paling manis dari ketiganya — gulanya cepat numpuk', 'Soda bisa bikin kembung / begah', 'Gigi sensitif? Dingin + soda + manis terasa ngilu'],
  },
  yakult: {
    taste: { manis: 4, rempah: 3, segar: 3, lembut: 5 },
    feel: 'Asam-manis Yakult ketemu rempah hangat — lembut, tajamnya jahe jadi kalem.',
    goodFor: ['Kurang suka jahe yang tajam', 'Pencinta yang manis', 'Teman ngemil'],
    plus: 'Yakult membawa bakteri baik L. casei Shirota; rempahnya jadi lebih bersahabat.',
    heads: 'Ada susu fermentasi — skip kalau alergi susu.',
    origin: 'Dua budaya dalam satu gelas: rempah Betawi + Yakult, minuman susu fermentasi dari Jepang (1935) yang jadi teman jajan anak Indonesia. Racikan Tim Pletok.',
    sensation: ['Asam-manis Yakult menyapa duluan', 'Teksturnya lebih lembut, hampir creamy', 'Rempahnya hangat tapi kalem — jahenya nggak menggigit'],
    benefits: ['Yakult berisi bakteri baik L. casei Shirota (probiotik)', 'Pilihan paling bersahabat buat yang kurang suka jahe', 'Tanpa alkohol, tanpa kafein'],
    gizi: { kkal: '± 110–140 kkal', gula: '± 22–28 g', kafein: '0 mg', alkohol: '0%', lain: 'Mengandung susu (fermentasi)' },
    tooMuch: ['Gula dari Yakult + sirup rempah ikut bertambah', 'Alergi susu / intoleransi laktosa: sebaiknya lewati', 'Probiotik kebanyakan sekaligus bisa bikin perut bergas'],
  },
}

export const bundlesWith = (id: DrinkId) => BUNDLES.filter((b) => b.items.includes(id))

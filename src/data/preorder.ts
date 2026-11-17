import { BUNDLES, DRINKS, drinkById, type DrinkId } from './menu'
import type { PreorderConfig } from '../lib/backend'

/** what can be pre-ordered — same ids as PREORDER_ITEMS in apps-script/Code.gs */
export interface PreorderItem {
  id: string
  kind: 'drink' | 'bundle'
  name: string
  detail: string
  images: string[]
  /** the cups it takes to make — for the crew's prep list */
  drinks: DrinkId[]
  /** default price in thousands */
  price: number
}

const slug = (name: string) => name.replace(/^Paket /, '').toLowerCase().replace(/\s+/g, '-')

export const PREORDER_ITEMS: PreorderItem[] = [
  ...DRINKS.map((d) => ({ id: d.id, kind: 'drink' as const, name: `Pletok ${d.short}`, detail: d.ingredients.join(' · '), images: [d.image], drinks: [d.id], price: d.price })),
  ...BUNDLES.map((b) => ({ id: slug(b.name), kind: 'bundle' as const, name: b.name, detail: b.detail, images: b.items.map((i) => drinkById(i).image), drinks: b.items, price: b.price })),
]

/** H-1: end of 24 Nov WIB — the latest it can ever be (no pre-orders on the event day); matches Code.gs */
export const DEFAULT_CUTOFF = new Date('2026-11-24T23:59:00+07:00').getTime()

export const DEFAULT_PREORDER: PreorderConfig = {
  enabled: false,
  cutoff: DEFAULT_CUTOFF,
  items: Object.fromEntries(PREORDER_ITEMS.map((i) => [i.id, { on: true, price: i.price }])),
  bca: { number: '', holder: '' },
  promo: { on: false, slots: 10, mode: 'rp', value: 3 },
}

export const rupiah = (k: number) => `Rp${(k * 1000).toLocaleString('id-ID')}`

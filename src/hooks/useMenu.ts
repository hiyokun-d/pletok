import { useSyncExternalStore } from 'react'
import { BUNDLES, DRINKS, drinkById, type Bundle, type Drink, type DrinkId } from '../data/menu'
import { BACKEND, onStats, pushMenu } from '../lib/backend'

/**
 * Live menu state for the day, controlled from /hasil (admin, PIN) on any crew phone:
 *  - a drink can be marked SOLD (sold-out time is remembered for the closing screen)
 *  - a bundle is SOLD automatically when any cup in it is sold out — unless the operator swaps
 *    its cups (e.g. Duo Klasik → 2 Original), or forces it sold by hand
 *  - "tutup sekarang": close the booth early once everything's gone
 * Persisted per device and synced across tabs; every change from /hasil is saved in the Sheet
 * and the booth screen + all phones pick it up within ~10–30 s.
 */

interface BundleOverride {
  items?: DrinkId[]
  forced?: boolean
}
interface MenuState {
  soldAt: Partial<Record<DrinkId, number>>
  bundles: Record<string, BundleOverride>
  /** menu prices changed on /config, in thousands — drink id or bundle name → price */
  prices?: Record<string, number>
  /** the crew closed the booth early (everything sold) */
  closedAt?: number
  /** /config "Putar A+G": when the booth screen should play the attention show (epoch ms) */
  attnAt?: number
  /** /config "Tema layar": the look of the menu screen, /cashier and /link */
  theme?: ThemeId
  /** last change, to tell the newer copy apart when syncing */
  at?: number
}

export type ThemeId = 'classic' | 'sunset'

export interface LiveDrink extends Drink {
  soldOut: boolean
  soldAt?: number
}
export interface LiveBundle extends Bundle {
  soldOut: boolean
  /** why it's sold: the drink that ran out, or 'manual' */
  reason?: string
  /** cups were swapped from the original recipe */
  edited: boolean
}
export interface LiveMenu {
  drinks: LiveDrink[]
  bundles: LiveBundle[]
  allSoldOut: boolean
  anySoldOut: boolean
  closedEarly: boolean
  attnAt?: number
  theme: ThemeId
}

const KEY = 'pletok:menu'
const empty = (): MenuState => ({ soldAt: {}, bundles: {} })

function load(): MenuState {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null') as MenuState | null
    return v && v.soldAt && v.bundles ? v : empty()
  } catch {
    return empty()
  }
}

function commit(next: MenuState, push = true) {
  state = push ? { ...next, at: Date.now() } : next
  snap = derive(state)
  try {
    localStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* storage blocked — still works until refresh */
  }
  listeners.forEach((l) => l())
  if (push) {
    failed = false
    const sent = state
    void pushMenu(state).then((ok) => {
      // didn't reach the Sheet → back to what the Sheet has, and say so
      if (ok || state !== sent) return
      failed = true
      if (remote) commit(remote, false)
      else listeners.forEach((l) => l())
    })
  }
}

// another tab (e.g. the crew opened the site twice) changed it → follow along
if (typeof window !== 'undefined')
  window.addEventListener('storage', (e) => {
    if (e.key !== KEY) return
    state = load()
    snap = derive(state)
    listeners.forEach((l) => l())
  })

const count = (items: DrinkId[]) =>
  items.reduce<Record<string, number>>((m, id) => ((m[id] = (m[id] ?? 0) + 1), m), {})

/** "1 Pletok Original + 1 Pletok Yakult" / "2 Pletok Original" */
export const describe = (items: DrinkId[]) =>
  Object.entries(count(items))
    .map(([id, n]) => `${n} ${drinkById(id as DrinkId).name}`)
    .join(' + ')

function derive(s: MenuState): LiveMenu {
  const price = (key: string, base: number) => s.prices?.[key] ?? base
  const drinks = DRINKS.map((d) => ({ ...d, price: price(d.id, d.price), soldOut: s.soldAt[d.id] !== undefined, soldAt: s.soldAt[d.id] }))
  const drinkPrice = (id: DrinkId) => drinks.find((d) => d.id === id)!.price
  const sold = (id: DrinkId) => s.soldAt[id] !== undefined
  const bundles = BUNDLES.map((b) => {
    const o = s.bundles[b.name] ?? {}
    const items = o.items ?? b.items
    const edited = !!o.items && o.items.join() !== b.items.join()
    const out = items.find(sold)
    const reason = o.forced ? 'manual' : out ? drinkById(out).short : undefined
    // "was" price = the cups bought one by one, at today's prices
    const normal = items.reduce((n, id) => n + drinkPrice(id), 0)
    return { ...b, items, price: price(b.name, b.price), normal, detail: edited ? describe(items) : b.detail, soldOut: !!reason, reason, edited }
  })
  const allSoldOut = drinks.every((d) => d.soldOut)
  return { drinks, bundles, allSoldOut, anySoldOut: drinks.some((d) => d.soldOut) || bundles.some((b) => b.soldOut), closedEarly: !!s.closedAt, attnAt: s.attnAt, theme: s.theme ?? 'classic' }
}

// set up after the helpers above — derive() needs describe() when a saved bundle was edited
let state = load()
let snap = derive(state)
const listeners = new Set<() => void>()
// what the Sheet last told us, and whether our last save bounced
let remote: MenuState | null = null
let remoteSnap: LiveMenu | null = null
let failed = false
let syncSnap: { remote: LiveMenu | null; failed: boolean; pending: boolean } = { remote: remoteSnap, failed, pending: false }
const syncState = () => {
  const pending = !!BACKEND && !failed && (state.at ?? 0) > (remote?.at ?? 0)
  if (syncSnap.remote !== remoteSnap || syncSnap.failed !== failed || syncSnap.pending !== pending) syncSnap = { remote: remoteSnap, failed, pending }
  return syncSnap
}

// someone else (the crew laptop) changed it → take the newer copy
let syncing = false
function startSync() {
  if (syncing || !BACKEND) return
  syncing = true
  onStats((s) => {
    const r = s.menu?.state as MenuState | undefined
    if (!r?.soldAt || !r.bundles) return
    remote = r
    remoteSnap = derive(r)
    if ((r.at ?? 0) > (state.at ?? 0)) commit(r, false)
    else listeners.forEach((l) => l())
  })
}

const subscribe = (l: () => void) => {
  startSync()
  listeners.add(l)
  return () => listeners.delete(l)
}

export function useMenu(): LiveMenu {
  return useSyncExternalStore(subscribe, () => snap)
}

/** for the admin: the Sheet's copy (to colour what's still saving), saving / failed */
export function useMenuSync() {
  return useSyncExternalStore(subscribe, syncState)
}

/* ---- operator actions (/hasil) */

export function setDrinkSold(id: DrinkId, sold: boolean) {
  const soldAt = { ...state.soldAt }
  if (sold) soldAt[id] = soldAt[id] ?? Date.now()
  else delete soldAt[id]
  commit({ ...state, soldAt })
}

export function setBundleItems(name: string, items: DrinkId[] | null) {
  const cur = state.bundles[name] ?? {}
  commit({ ...state, bundles: { ...state.bundles, [name]: { ...cur, items: items ?? undefined } } })
}

export function setBundleForced(name: string, forced: boolean) {
  const cur = state.bundles[name] ?? {}
  commit({ ...state, bundles: { ...state.bundles, [name]: { ...cur, forced } } })
}

/** everything's gone → close the booth now instead of waiting for 16:00 (undo: `false`) */
export function setClosedEarly(closed: boolean) {
  commit({ ...state, closedAt: closed ? Date.now() : undefined })
}

/** the look of the customer-facing screens, for every device */
export function setTheme(theme: ThemeId) {
  commit({ ...state, theme })
}

/** A+G from a phone: the booth plays the attention show `delayMs` from now (null = cancel) */
export function scheduleAttention(delayMs: number | null) {
  commit({ ...state, attnAt: delayMs === null ? undefined : Date.now() + delayMs })
}

/** today's menu price for a drink id or bundle name; `null` = back to the printed menu */
export function setMenuPrice(key: string, price: number | null) {
  const prices = { ...state.prices }
  if (price === null) delete prices[key]
  else prices[key] = Math.max(1, Math.min(500, Math.round(price)))
  commit({ ...state, prices })
}

/** restock: everything back on sale, bundles back to their recipe, booth open again */
export function resetMenu() {
  commit({ ...empty(), prices: state.prices })
}

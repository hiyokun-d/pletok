import { useSyncExternalStore } from 'react'
import { BUNDLES, DRINKS, drinkById, type Bundle, type Drink, type DrinkId } from '../data/menu'
import { BACKEND, onStats, pushMenu } from '../lib/backend'

/**
 * Live menu state for the day, controlled from the A + C panel:
 *  - a drink can be marked SOLD (sold-out time is remembered for the closing screen)
 *  - a bundle is SOLD automatically when any cup in it is sold out — unless the operator swaps
 *    its cups (e.g. Duo Klasik → 2 Original), or forces it sold by hand
 * Persisted per device and synced across tabs; with the Google Sheet backend the crew laptop
 * (PIN set in A + C) pushes every change and all phones pick it up within ~30 s.
 */

interface BundleOverride {
  items?: DrinkId[]
  forced?: boolean
}
interface MenuState {
  soldAt: Partial<Record<DrinkId, number>>
  bundles: Record<string, BundleOverride>
  /** crew override for the feedback form; unset = follow the schedule (see useFeedbackOpen) */
  feedback?: FeedbackMode
  /** last change, to tell the newer copy apart when syncing */
  at?: number
}
export type FeedbackMode = 'open' | 'closed'

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
  feedbackMode: FeedbackMode | 'auto'
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
  if (push) void pushMenu(state)
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
  const drinks = DRINKS.map((d) => ({ ...d, soldOut: s.soldAt[d.id] !== undefined, soldAt: s.soldAt[d.id] }))
  const sold = (id: DrinkId) => s.soldAt[id] !== undefined
  const bundles = BUNDLES.map((b) => {
    const o = s.bundles[b.name] ?? {}
    const items = o.items ?? b.items
    const edited = !!o.items && o.items.join() !== b.items.join()
    const out = items.find(sold)
    const reason = o.forced ? 'manual' : out ? drinkById(out).short : undefined
    const normal = edited ? items.reduce((n, id) => n + drinkById(id).price, 0) : b.normal
    return { ...b, items, normal, detail: edited ? describe(items) : b.detail, soldOut: !!reason, reason, edited }
  })
  const allSoldOut = drinks.every((d) => d.soldOut)
  return { drinks, bundles, allSoldOut, feedbackMode: s.feedback ?? 'auto', anySoldOut: drinks.some((d) => d.soldOut) || bundles.some((b) => b.soldOut) }
}

// set up after the helpers above — derive() needs describe() when a saved bundle was edited
let state = load()
let snap = derive(state)
const listeners = new Set<() => void>()

// someone else (the crew laptop) changed it → take the newer copy
let syncing = false
function startSync() {
  if (syncing || !BACKEND) return
  syncing = true
  onStats((s) => {
    const remote = s.menu?.state as MenuState | undefined
    if (remote?.soldAt && remote.bundles && (remote.at ?? 0) > (state.at ?? 0)) commit(remote, false)
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

/* ---- operator actions (A + C panel) */

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

/** force the feedback form open/closed, or back to the schedule */
export function setFeedbackMode(mode: FeedbackMode | 'auto') {
  commit({ ...state, feedback: mode === 'auto' ? undefined : mode })
}

/** restock: everything back on sale, bundles back to their recipe (the feedback setting stays) */
export function resetMenu() {
  commit({ ...empty(), feedback: state.feedback })
}

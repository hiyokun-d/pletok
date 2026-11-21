import { useSyncExternalStore } from 'react'

/*
 * Lite mode: the same site for the cheapest phones on the market (think Galaxy J2 Prime — 1.5 GB,
 * a quad-core and a GPU from 2014). It keeps every entrance and spring but drops what those phones
 * can't draw at 60 fps: WebGL particles, animated blur, drop shadows, the sunset light loop, and
 * sections re-animating every time they scroll back in.
 *
 * Decided on load from what the browser tells us (RAM, cores, Save-Data), then double-checked by
 * timing real frames for a few seconds on a touch screen — a phone that can't hold ~40 fps goes
 * lite, and stays lite on its next visit. `?lite=1` / `?lite=0` forces it (and remembers).
 */

const KEY = 'pletok:perf'

type Nav = Navigator & { deviceMemory?: number; connection?: { saveData?: boolean } }

function read(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}
function write(v: 'lite' | 'full') {
  try {
    localStorage.setItem(KEY, v)
  } catch {
    /* private mode — this visit only */
  }
}

const forced = new URLSearchParams(window.location.search).get('lite')
if (forced === '1' || forced === '0') write(forced === '1' ? 'lite' : 'full')
const saved = read()

const nav = navigator as Nav
const touch = window.matchMedia('(pointer: coarse)').matches
const android = /Android/i.test(nav.userAgent)
const weak =
  (nav.deviceMemory !== undefined && nav.deviceMemory <= 2) ||
  // iOS doesn't report real core counts, and even old iPhones cope — only Android is judged by cores
  (android && (nav.hardwareConcurrency || 8) <= 4) ||
  !!nav.connection?.saveData

let lite = saved ? saved === 'lite' : weak
const subs = new Set<() => void>()

function apply() {
  if (lite) document.documentElement.dataset.perf = 'lite'
  else delete document.documentElement.dataset.perf
}
apply()

function set(v: boolean) {
  if (v === lite) return
  lite = v
  apply()
  subs.forEach((f) => f())
}

/** read once, e.g. inside an animation object — components that must react use useLite() */
export const isLite = () => lite

export function useLite() {
  return useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => void subs.delete(cb)
    },
    () => lite,
  )
}

/** `filter: blur()` for an animation state — nothing at all in lite (blur is the costliest thing to animate) */
export const blurFx = (px: number): { filter?: string } => (lite ? {} : { filter: `blur(${px}px)` })

// the frame check: phones only, never overriding a choice already made, never while the tab is hidden
if (touch && !saved) {
  window.setTimeout(() => {
    let frames = 0
    let start = 0
    let slow = 0
    let last = 0
    const tick = (now: number) => {
      if (document.hidden) return // the clock stops when hidden — that's not a slow phone
      if (!start) start = last = now
      else {
        frames++
        if (now - last > 34) slow++ // missed at least one 60 Hz frame
        last = now
      }
      if (now - start < 3000) return void requestAnimationFrame(tick)
      const fps = (frames * 1000) / (now - start)
      if (fps < 40 || slow / Math.max(1, frames) > 0.3) {
        write('lite')
        set(true)
      }
    }
    requestAnimationFrame(tick)
    // after the intro (~6 s): timing frames during it would call a mid-range phone slow
  }, 7000)
}

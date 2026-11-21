import { useSyncExternalStore } from 'react'

/*
 * A new deploy while a page is open. Crew tabs live all day and never reload (they poll, and the
 * crew tabs switch in place), so without this a fix pushed at 12.00 never reaches the phone at the
 * counter. The offline worker is asked for updates every few minutes; once a new version takes over,
 * SystemStatus's pill offers the reload — never forced, so nobody loses a half-rung sale or a typed form.
 */

let ready = false
const subs = new Set<() => void>()

/** called once from main.tsx with the worker registration */
export function watchUpdates(reg: ServiceWorkerRegistration) {
  // the very first install also "takes over" — that's not an update
  const hadWorker = !!navigator.serviceWorker.controller
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadWorker || ready) return
    ready = true
    subs.forEach((f) => f())
  })
  const check = () => document.visibilityState === 'visible' && void reg.update().catch(() => {})
  window.setInterval(check, 5 * 60_000)
  document.addEventListener('visibilitychange', check)
}

export const useUpdateReady = () =>
  useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => void subs.delete(cb)
    },
    () => ready,
  )

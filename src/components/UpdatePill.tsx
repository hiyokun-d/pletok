import { useSyncExternalStore } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { RefreshCw } from 'lucide-react'

/*
 * A new deploy while a page is open. Crew tabs live all day and never reload (they poll, and the
 * crew tabs switch in place), so without this a fix pushed at 12.00 never reaches the phone at the
 * counter. The offline worker is asked for updates every few minutes; once a new version takes over,
 * a small pill offers the reload — never forced, so nobody loses a half-rung sale or a typed form.
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

export function UpdatePill() {
  const show = useSyncExternalStore(
    (cb) => {
      subs.add(cb)
      return () => void subs.delete(cb)
    },
    () => ready,
  )
  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key="update"
          type="button"
          onClick={() => window.location.reload()}
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] left-1/2 z-[70] flex -translate-x-1/2 items-center gap-2 whitespace-nowrap rounded-full bg-[#1a0d06] px-4 py-2.5 font-display text-sm font-semibold text-cream shadow-[0_12px_32px_-10px_rgb(0_0_0/0.55)]"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
        >
          <RefreshCw className="size-4 text-[#8faa4f]" /> Versi baru siap · ketuk untuk muat ulang
        </motion.button>
      )}
    </AnimatePresence>
  )
}

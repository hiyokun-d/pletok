import { useSyncExternalStore } from 'react'

let snap = { w: window.innerWidth, h: window.innerHeight }
function subscribe(cb: () => void) {
  const on = () => {
    snap = { w: window.innerWidth, h: window.innerHeight }
    cb()
  }
  window.addEventListener('resize', on)
  return () => window.removeEventListener('resize', on)
}
export const useViewport = () => useSyncExternalStore(subscribe, () => snap)

import { useSyncExternalStore } from 'react'

const QUERY = '(min-width: 1024px) and (pointer: fine)'

function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY)
  mq.addEventListener('change', cb)
  return () => mq.removeEventListener('change', cb)
}

/** Desktop = the booth screen: wide viewport and a mouse. `?view=mobile|desktop` forces one. */
export function useIsDesktop() {
  const forced = new URLSearchParams(window.location.search).get('view')
  const matches = useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches)
  if (forced === 'desktop') return true
  if (forced === 'mobile') return false
  return matches
}

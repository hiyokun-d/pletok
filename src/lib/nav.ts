import { useSyncExternalStore } from 'react'

/*
 * In-app page changes for the crew pages (CrewRouter): the address bar changes, the page swaps,
 * nothing reloads. Anything that depends on which page is showing reads usePath().
 */

const EVENT = 'pletok:navigate'
const clean = (p: string) => p.replace(/\/+$/, '')

export const currentPath = () => clean(window.location.pathname)

export function onPath(f: () => void) {
  window.addEventListener('popstate', f)
  window.addEventListener(EVENT, f)
  return () => {
    window.removeEventListener('popstate', f)
    window.removeEventListener(EVENT, f)
  }
}

/** the page showing now — follows in-app page changes and the back button */
export const usePath = () => useSyncExternalStore(onPath, currentPath)

/** change the address without a reload; CrewRouter shows the page */
export function pushPath(href: string) {
  history.pushState(null, '', href)
  window.dispatchEvent(new Event(EVENT))
}

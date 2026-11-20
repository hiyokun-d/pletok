import { useEffect, useState, type ReactNode } from 'react'
import { currentPath, onPath, pushPath } from '../lib/nav'

/**
 * Kasir ↔ Pickup ↔ Hasil ↔ Financial ↔ Config without reloading: a tap on a link to another crew
 * page swaps the page in place. Their code is preloaded and their data is warm (lib/backend), so the
 * next page is on screen at once. The old page stays until the new one is ready — never a blank.
 * Anything else (the menu, a struk, a new tab, ctrl-click) is a normal link.
 */
export function CrewRouter({ first, pages }: { first: ReactNode; pages: Record<string, () => Promise<ReactNode>> }) {
  const [view, setView] = useState({ path: currentPath(), node: first })

  useEffect(() => {
    let alive = true
    const show = () => {
      const path = currentPath()
      if (!pages[path]) return window.location.reload()
      pages[path]()
        .then((node) => {
          if (!alive || currentPath() !== path) return
          setView({ path, node })
          window.scrollTo(0, 0)
        })
        // code not here (offline, never loaded) — a real page load gets the saved copy instead
        .catch(() => window.location.reload())
    }
    const click = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return
      const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null
      if (!a || a.target === '_blank' || a.hasAttribute('download') || a.origin !== window.location.origin) return
      const path = a.pathname.replace(/\/+$/, '')
      if (!pages[path]) return
      e.preventDefault()
      if (path + a.search === currentPath() + window.location.search) return
      pushPath(a.pathname + a.search)
    }
    const off = onPath(show)
    document.addEventListener('click', click)
    return () => {
      alive = false
      off()
      document.removeEventListener('click', click)
    }
  }, [pages])

  // keyed by page: each one starts fresh, like a real page load (but from the warm data)
  return <div key={view.path}>{view.node}</div>
}

import { pageview, track, type BeforeSendEvent } from '@vercel/analytics'

/**
 * Vercel Web Analytics on the free plan only records page views (visitors, pages, referrers,
 * countries, devices, browsers, OS). Custom events (`track`) need a paid plan — so every click is
 * ALSO logged as a virtual page view under /klik/<name>, which shows up in the free "Pages" list.
 * If the project is ever upgraded, the `track` calls start showing under "Events" too.
 */

const NO_TRACK = 'pletok:no-track'

/** The booth laptop runs all day — mark it so it doesn't count as a visitor */
export function isBoothDevice() {
  try {
    return localStorage.getItem(NO_TRACK) === '1'
  } catch {
    return false
  }
}
export function setBoothDevice(on: boolean) {
  try {
    if (on) localStorage.setItem(NO_TRACK, '1')
    else localStorage.removeItem(NO_TRACK)
  } catch {
    /* storage blocked — nothing to remember */
  }
}

/** Drops everything from a booth-marked device, and strips our debug params from URLs */
export function beforeSend(event: BeforeSendEvent) {
  if (isBoothDevice()) return null
  const url = new URL(event.url)
  for (const p of ['now', 'phase', 'view', 'nointro']) url.searchParams.delete(p)
  return { ...event, url: url.toString() }
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40)

/** One click → a custom event (paid plans) + a /klik/<name> page view (free plan) */
export function trackClick(name: string, props?: Record<string, string>) {
  if (isBoothDevice()) return
  const n = slug(name)
  track(n, props)
  pageview({ route: `/klik/${n}`, path: `/klik/${n}` })
}

/**
 * Where people came from. Vercel drops query strings, so a shared link like
 * pletok.hiyokun.dev/?src=wa-angkatan is turned into a /dari/wa-angkatan page view.
 */
export function trackSource() {
  const src = new URLSearchParams(window.location.search).get('src')
  if (src && !isBoothDevice()) pageview({ route: `/dari/${slug(src)}`, path: `/dari/${slug(src)}` })
}

/**
 * One listener for the whole site: any link leaving the site, or anything marked
 * `data-track="name"`, is counted on click — no per-button wiring needed.
 */
export function installClickTracking() {
  const onClick = (e: MouseEvent) => {
    const el = (e.target as Element | null)?.closest<HTMLElement>('[data-track], a[href]')
    if (!el) return
    const named = el.dataset.track
    if (named) return trackClick(named)
    const href = el.getAttribute('href') ?? ''
    if (!/^https?:/.test(href)) return
    const host = new URL(href).hostname.replace(/^www\./, '')
    if (host === window.location.hostname) return
    trackClick(host.includes('instagram') ? 'instagram' : host.includes('forms') || host.includes('form') ? 'feedback' : `link-${host}`)
  }
  document.addEventListener('click', onClick, { capture: true })
  return () => document.removeEventListener('click', onClick, { capture: true })
}

import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import { GoHop, type HopTarget } from './views/GoHop'
import { TRAP_PATH, TrapPage } from './views/TrapPage'
import { SystemStatus } from './components/SystemStatus'
import { CrewRouter } from './components/CrewRouter'
import { ThemeHost } from './components/SunsetTheme'
import { watchUpdates } from './lib/updates'
import { ErrorBoundary, ErrorPage, type ErrorKind } from './views/ErrorPage'
import { beforeSend, installClickTracking, trackSource } from './lib/analytics'
import './index.css'
// decides lite mode (cheap phones) before anything draws
import './lib/perf'

// short order link from WhatsApp: /c/DSK54N → /preorder?cek=DSK54N (opens that order's live status)
const short = window.location.pathname.match(/^\/c\/([A-Za-z0-9-]{4,20})\/?$/)?.[1]
if (short) history.replaceState(null, '', `/preorder?cek=${encodeURIComponent(short)}`)

// small standalone pages (no booth app around them): the QR's links page, the form, old /go hops
const path = window.location.pathname.replace(/\/+$/, '')
const hop = path.match(/^\/go\/(ig|feedback)$/)?.[1] as HopTarget | undefined
// a booth receipt from the cashier's QR: /r/<sale id>
const receipt = path.match(/^\/r\/([A-Za-z0-9-]{8,64})$/)?.[1]
/*
 * Each page is its own download: a crew phone opening /pickup on festival wifi doesn't pull in the
 * menu's 3D leaves and particles first. The loading screen stays up until the page's code is here,
 * then it renders in one go (no second spinner).
 */
const PAGES: Record<string, () => Promise<ReactNode>> = {
  '': () => import('./App').then((m) => <m.default />),
  '/link': () => import('./views/LinksPage').then((m) => <m.LinksPage />),
  '/feedback': () => import('./views/FeedbackPage').then((m) => <m.FeedbackPage />),
  '/hasil': () => import('./views/HasilPage').then((m) => <m.HasilPage />),
  '/financial': () => import('./views/FinancialPage').then((m) => <m.FinancialPage />),
  '/preorder': () => import('./views/PreorderPage').then((m) => <m.PreorderPage />),
  '/config': () => import('./views/ConfigPage').then((m) => <m.ConfigPage />),
  '/cashier': () => import('./views/CashierPage').then((m) => <m.CashierPage />),
  '/pickup': () => import('./views/PickupPage').then((m) => <m.PickupPage />),
  '/struk': () => import('./views/ReceiptPage').then((m) => <m.SavedReceiptsPage />),
}
/** the crew tabs: once one is open, the others download quietly, and switching between them doesn't reload */
const CREW = ['/cashier', '/pickup', '/hasil', '/financial', '/config']
const CREW_PAGES = Object.fromEntries(CREW.map((p) => [p, PAGES[p]]))
// dev only: /_error/500 (or 503, offline) previews the other error pages
const preview = import.meta.env.DEV ? path.match(/^\/_error\/(404|500|503|offline)$/)?.[1] : undefined
const load = async (): Promise<ReactNode> =>
  hop ? (
    <GoHop to={hop} />
  ) : TRAP_PATH.test(path) ? (
    // /admin & co: a decoy that logs who's poking around (the real crew pages need the PIN on the server)
    <TrapPage />
  ) : preview ? (
    <ErrorPage kind={(preview === 'offline' ? 'offline' : Number(preview)) as ErrorKind} />
  ) : receipt ? (
    import('./views/ReceiptPage').then((m) => <m.ReceiptPage id={receipt} />)
  ) : (
    (PAGES[path]?.() ?? <ErrorPage kind={404} />)
  )

// keep the menu working when the venue wifi gives up (production only — dev stays uncached)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  // and tell long-open pages (crew tabs) when a new deploy is ready
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').then(watchUpdates).catch(() => {}))
}

if (!hop) {
  installClickTracking()
  trackSource()
}

const page = await load()

// the app is up: index.html's safety net stands down and its loading screen fades away
;(window as Window & { __pletokUp?: boolean }).__pletokUp = true
try {
  sessionStorage.removeItem('pletok:retried')
} catch {
  /* fine */
}
requestAnimationFrame(() => {
  const boot = document.getElementById('boot')
  if (!boot) return
  boot.classList.add('gone')
  window.setTimeout(() => boot.remove(), 500)
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{CREW.includes(path) ? <CrewRouter first={page} pages={CREW_PAGES} /> : page}</ErrorBoundary>
    {/* the look picked on /config (menu, /cashier, /link) */}
    {!hop && <ThemeHost />}
    {/* offline / Sheet down / back again / new version ready — the booth app has its own island for this */}
    {!hop && path !== '' && <SystemStatus />}
    {/* free Vercel Web Analytics + Speed Insights (only report on the deployed site, not localhost) */}
    <Analytics beforeSend={beforeSend} />
    {!hop && <SpeedInsights />}
  </StrictMode>,
)

if (CREW.includes(path)) {
  // Safari has no requestIdleCallback
  const idle = (f: () => void) => (typeof requestIdleCallback === 'function' ? requestIdleCallback(f, { timeout: 3000 }) : setTimeout(f, 1500))
  idle(() => CREW.filter((p) => p !== path).forEach((p) => void PAGES[p]().catch(() => {})))
  // the data too: queue + results stay warm on every crew page, so the next tab opens already filled
  // (a page asking at the same moment shares the request — lib/backend `once`)
  void import('./lib/backend').then(({ crewPin, fetchQueue, fetchResults }) => {
    const warmUp = () => {
      const pin = crewPin()
      if (!pin || document.visibilityState !== 'visible') return
      void fetchQueue(pin)
      void fetchResults(pin)
    }
    setTimeout(warmUp, 4000)
    setInterval(warmUp, 45_000)
    document.addEventListener('visibilitychange', warmUp)
  })
  // cashier sales still only on this phone go out from whichever crew page is open (not only /cashier)
  void import('./lib/boothLedger').then(({ ledger, sync }) =>
    import('./lib/backend').then(({ crewPin }) => {
      const push = () => {
        const pin = crewPin()
        if (pin && ledger().some((s) => s.state === 'pending')) void sync(pin)
      }
      setInterval(push, 20_000)
      window.addEventListener('online', push)
      window.addEventListener('pletok:recovered', push)
    }),
  )
}

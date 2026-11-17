import { StrictMode, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import { GoHop, type HopTarget } from './views/GoHop'
import { LinksPage } from './views/LinksPage'
import { FeedbackPage } from './views/FeedbackPage'
import { HasilPage } from './views/HasilPage'
import { PreorderPage } from './views/PreorderPage'
import { ConfigPage } from './views/ConfigPage'
import { OfflinePill } from './components/OfflinePill'
import { ErrorBoundary, ErrorPage, type ErrorKind } from './views/ErrorPage'
import { beforeSend, installClickTracking, trackSource } from './lib/analytics'
import './index.css'

// short order link from WhatsApp: /c/DSK54N → /preorder?cek=DSK54N (opens that order's live status)
const short = window.location.pathname.match(/^\/c\/([A-Za-z0-9-]{4,20})\/?$/)?.[1]
if (short) history.replaceState(null, '', `/preorder?cek=${encodeURIComponent(short)}`)

// small standalone pages (no booth app around them): the QR's links page, the form, old /go hops
const path = window.location.pathname.replace(/\/+$/, '')
const hop = path.match(/^\/go\/(ig|feedback)$/)?.[1] as HopTarget | undefined
const PAGES: Record<string, () => ReactNode> = {
  '': () => <App />,
  '/link': () => <LinksPage />,
  '/feedback': () => <FeedbackPage />,
  '/hasil': () => <HasilPage />,
  '/preorder': () => <PreorderPage />,
  '/config': () => <ConfigPage />,
}
// dev only: /_error/500 (or 503, offline) previews the other error pages
const preview = import.meta.env.DEV ? path.match(/^\/_error\/(404|500|503|offline)$/)?.[1] : undefined
const page = hop ? (
  <GoHop to={hop} />
) : preview ? (
  <ErrorPage kind={(preview === 'offline' ? 'offline' : Number(preview)) as ErrorKind} />
) : (
  PAGES[path]?.() ?? <ErrorPage kind={404} />
)

// keep the menu working when the venue wifi gives up (production only — dev stays uncached)
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => {}))
}

if (!hop) {
  installClickTracking()
  trackSource()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>{page}</ErrorBoundary>
    {/* the booth app has its own island for this */}
    {!hop && path !== '' && <OfflinePill />}
    {/* free Vercel Web Analytics + Speed Insights (only report on the deployed site, not localhost) */}
    <Analytics beforeSend={beforeSend} />
    {!hop && <SpeedInsights />}
  </StrictMode>,
)

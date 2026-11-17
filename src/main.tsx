import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { Analytics } from '@vercel/analytics/react'
import { SpeedInsights } from '@vercel/speed-insights/react'
import App from './App'
import { GoHop, type HopTarget } from './views/GoHop'
import { LinksPage } from './views/LinksPage'
import { FeedbackPage } from './views/FeedbackPage'
import { HasilPage } from './views/HasilPage'
import { PreorderPage } from './views/PreorderPage'
import { beforeSend, installClickTracking, trackSource } from './lib/analytics'
import './index.css'

// small standalone pages (no booth app around them): the QR's links page, the form, old /go hops
const path = window.location.pathname.replace(/\/+$/, '')
const hop = path.match(/^\/go\/(ig|feedback)$/)?.[1] as HopTarget | undefined
const page = hop ? <GoHop to={hop} /> : path === '/link' ? <LinksPage /> : path === '/feedback' ? <FeedbackPage /> : path === '/hasil' ? <HasilPage /> : path === '/preorder' ? <PreorderPage /> : <App />

if (!hop) {
  installClickTracking()
  trackSource()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {page}
    {/* free Vercel Web Analytics + Speed Insights (only report on the deployed site, not localhost) */}
    <Analytics beforeSend={beforeSend} />
    {!hop && <SpeedInsights />}
  </StrictMode>,
)

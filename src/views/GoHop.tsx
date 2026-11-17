import { useEffect } from 'react'
import { FEEDBACK_URL, INSTAGRAM_URL } from '../data/event'
import { logScan } from '../lib/backend'

export type HopTarget = 'ig' | 'feedback'

/** let the analytics beacon for this page view leave before we navigate away */
const FORWARD_AFTER = 500

/** Older /go/ig and /go/feedback links: count it, then forward (the booth QR now uses /link). */
export function GoHop({ to }: { to: HopTarget }) {
  useEffect(() => {
    logScan(to)
    const t = window.setTimeout(() => window.location.replace(to === 'ig' ? INSTAGRAM_URL : FEEDBACK_URL), FORWARD_AFTER)
    return () => window.clearTimeout(t)
  }, [to])
  return <main className="paper fixed inset-0" />
}

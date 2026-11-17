import { useEffect, useSyncExternalStore } from 'react'
import { BACKEND, netState, onNet, onStats } from '../lib/backend'

export type Bars = 0 | 1 | 2 | 3 | 4

export interface Signal {
  bars: Bars
  label: string
  /** last round trip to the Sheet, ms */
  rtt: number | null
  /** nothing measured yet */
  measuring: boolean
}

type Conn = { effectiveType?: string; addEventListener?: (t: string, f: () => void) => void; removeEventListener?: (t: string, f: () => void) => void }
const conn = () => (navigator as Navigator & { connection?: Conn }).connection

const subscribe = (f: () => void) => {
  window.addEventListener('online', f)
  window.addEventListener('offline', f)
  conn()?.addEventListener?.('change', f)
  const off = onNet(f)
  return () => {
    window.removeEventListener('online', f)
    window.removeEventListener('offline', f)
    conn()?.removeEventListener?.('change', f)
    off()
  }
}
// a string snapshot so useSyncExternalStore sees a stable value between changes
const snap = () => {
  const n = netState()
  return `${navigator.onLine ? 1 : 0}|${n.ok ? 1 : 0}|${n.rtt === null ? '' : Math.round(n.rtt)}|${n.at}|${conn()?.effectiveType ?? ''}`
}

/**
 * Signal strength as the booth actually feels it: measured from the round trip of the shared
 * Sheet poll (an Apps Script call is ~1 s on a good line), capped by the phone's own network
 * hint where the browser gives one (Chrome/Android; Safari doesn't). Offline = 0 bars.
 */
export function useSignal(): Signal {
  // the poll is what we measure — make sure it runs on this page
  useEffect(() => onStats(() => {}), [])
  const [online, ok, rttS, atS, type] = useSyncExternalStore(subscribe, snap).split('|')
  const rtt = rttS ? Number(rttS) : null
  const at = Number(atS)
  if (online === '0') return { bars: 0, label: 'Offline', rtt: null, measuring: false }
  const cap: Bars = type === 'slow-2g' || type === '2g' ? 1 : type === '3g' ? 2 : 4
  const capped = (b: Bars, label: string): Signal => {
    const bars = Math.min(b, cap) as Bars
    return { bars, label: bars < b ? (bars <= 1 ? 'Parah' : 'Lemah') : label, rtt, measuring: false }
  }
  if (!BACKEND) return { ...capped(4, 'Online'), measuring: false }
  if (!at) return { bars: cap, label: 'Mengukur…', rtt: null, measuring: true }
  if (ok === '0') return { bars: 1, label: 'Sheet tak terjangkau', rtt: null, measuring: false }
  const r = rtt ?? 0
  return r < 1800 ? capped(4, 'Bagus') : r < 3500 ? capped(3, 'Oke') : r < 7000 ? capped(2, 'Lemah') : capped(1, 'Parah')
}

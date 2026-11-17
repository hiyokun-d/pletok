import { useEffect, useState } from 'react'
import type { DrinkId } from '../data/menu'
import { BACKEND, onStats } from './backend'

/**
 * Real numbers for the closing screen, from the Google Sheet (apps-script/Code.gs).
 * Until VITE_BACKEND_URL is set everything is null and the screen shows "segera".
 * (Website visitors live in Vercel Analytics — it can't be read back from the page.)
 */
export interface LiveStats {
  scans: number | null
  feedbacks: number | null
  contacts: number | null
  rating: number | null
  /** most-loved drinks — more than one when they tie */
  favorites: DrinkId[]
}

const NOTHING: LiveStats = { scans: null, feedbacks: null, contacts: null, rating: null, favorites: [] }

export function useLiveStats(): { connected: boolean; stats: LiveStats } {
  const [stats, setStats] = useState<LiveStats>(NOTHING)
  useEffect(
    () =>
      onStats((s) =>
        setStats({ scans: s.qrBooth + s.qrFeedback, feedbacks: s.feedbacks, contacts: s.contacts ?? 0, rating: s.rating, favorites: (s.favorites ?? (s.favorite ? [s.favorite] : [])) as DrinkId[] }),
      ),
    [],
  )
  return { connected: !!BACKEND, stats }
}

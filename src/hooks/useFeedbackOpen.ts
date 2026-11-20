import { useEffect, useState } from 'react'
import { EVENT } from '../data/event'
import { cachedStats, onStats } from '../lib/backend'
import { useEventPhase } from './useEventPhase'

/** feedback stays open this long after closing — for the people still holding a cup */
export const FEEDBACK_GRACE_MIN = 25

export type FeedbackMode = 'auto' | 'open' | 'closed'

/**
 * Is the feedback form open right now? On schedule: from opening until 25 min after closing
 * (hidden before we open). Admins can force it open or closed from /hasil only — the switch
 * lives in the Google Sheet, so every phone follows within ~30 s and no booth device can flip it.
 */
export function useFeedbackOpen() {
  const { now } = useEventPhase()
  // the last switch this phone saw, straight away — not "auto" until the Sheet answers
  const [mode, setMode] = useState<FeedbackMode>(() => cachedStats()?.s.feedbackMode ?? 'auto')
  useEffect(() => onStats((s) => setMode(s.feedbackMode ?? 'auto')), [])
  const until = EVENT.close.getTime() + FEEDBACK_GRACE_MIN * 60_000
  // the real clock, not the crew's A+B clock override (dev keeps it, to preview the form). The Sheet
  // checks the same window, so a wrong clock can't get a form in anyway.
  const t = import.meta.env.DEV ? now : Date.now()
  const auto = t >= EVENT.open.getTime() && t < until
  return { open: mode === 'auto' ? auto : mode === 'open', auto, mode, until }
}

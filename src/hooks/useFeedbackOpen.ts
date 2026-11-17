import { useEffect, useState } from 'react'
import { EVENT } from '../data/event'
import { onStats } from '../lib/backend'
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
  const { phase, now } = useEventPhase()
  const [mode, setMode] = useState<FeedbackMode>('auto')
  useEffect(() => onStats((s) => setMode(s.feedbackMode ?? 'auto')), [])
  const until = EVENT.close.getTime() + FEEDBACK_GRACE_MIN * 60_000
  const auto = phase === 'open' || phase === 'last-call' || (phase === 'closed' && now < until)
  return { open: mode === 'auto' ? auto : mode === 'open', auto, mode, until }
}

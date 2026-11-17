import { EVENT } from '../data/event'
import { useEventPhase } from './useEventPhase'
import { useMenu } from './useMenu'

/** feedback stays open this long after closing — for the people still holding a cup */
export const FEEDBACK_GRACE_MIN = 25

/**
 * Is the feedback form open right now? On schedule: from opening until 25 min after closing
 * (hidden before we open). The crew can force it open or closed in A + B — that override
 * syncs to every phone with the Sheet backend, like sold-out does.
 */
export function useFeedbackOpen() {
  const { phase, now } = useEventPhase()
  const { feedbackMode } = useMenu()
  const until = EVENT.close.getTime() + FEEDBACK_GRACE_MIN * 60_000
  const auto = phase === 'open' || phase === 'last-call' || (phase === 'closed' && now < until)
  return { open: feedbackMode === 'auto' ? auto : feedbackMode === 'open', auto, mode: feedbackMode, until }
}

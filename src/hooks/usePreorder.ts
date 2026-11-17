import { useEffect, useState } from 'react'
import { DEFAULT_CUTOFF, DEFAULT_PREORDER } from '../data/preorder'
import { onStats, type PreorderConfig } from '../lib/backend'
import { useEventPhase } from './useEventPhase'

/**
 * Pre-order settings from the Sheet (set on /hasil) + whether it's open right now:
 * switched on by an admin AND before the cut-off (H-1). After that every link to it hides.
 */
export function usePreorder() {
  const { now } = useEventPhase()
  const [config, setConfig] = useState<PreorderConfig>(DEFAULT_PREORDER)
  const [loaded, setLoaded] = useState(false)
  useEffect(
    () =>
      onStats((s) => {
        if (s.preorder) setConfig(s.preorder)
        setLoaded(true)
      }),
    [],
  )
  return { config, loaded, open: config.enabled && now < Math.min(config.cutoff, DEFAULT_CUTOFF) }
}

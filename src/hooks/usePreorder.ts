import { useEffect, useState } from 'react'
import { DEFAULT_CUTOFF, DEFAULT_PREORDER } from '../data/preorder'
import { fastStats, onStats, type PreorderConfig } from '../lib/backend'

/**
 * Pre-order settings from the Sheet (set on /hasil) + whether it's open right now:
 * switched on by an admin AND before the cut-off (H-1). After that every link to it hides.
 * Real time on purpose — NOT the booth clock, which the crew can move with A+B (and which
 * stays moved in that browser), while the Sheet only ever checks the real time.
 */
export function usePreorder() {
  const [now, setNow] = useState(Date.now)
  const [config, setConfig] = useState<PreorderConfig>(DEFAULT_PREORDER)
  const [loaded, setLoaded] = useState(false)
  const [promoUsed, setPromoUsed] = useState(0)
  useEffect(
    () =>
      onStats((s) => {
        if (s.preorder) setConfig(s.preorder)
        if (typeof s.promoUsed === 'number') setPromoUsed(s.promoUsed)
        setLoaded(true)
      }),
    [],
  )
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  const promo = config.promo
  const promoLeft = promo?.on && promo.value ? Math.max(0, promo.slots - promoUsed) : 0
  const open = config.enabled && now < Math.min(config.cutoff, DEFAULT_CUTOFF)
  // slots are going: check every ~8 s so the count on screen keeps up
  const racing = open && promoLeft > 0
  useEffect(() => (racing ? fastStats() : undefined), [racing])
  return { config, loaded, promoUsed, promoLeft, open }
}

import { AnimatePresence, MotionConfig } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { phaseAt, setForcedPhase, useEventPhase } from './hooks/useEventPhase'
import { useIsDesktop } from './hooks/useIsDesktop'
import { signal } from './lib/events'
import { trackClick } from './lib/analytics'
import { Intro } from './components/Intro'
import { PletokEgg } from './components/PletokEgg'
import { PhaseControl } from './components/PhaseControl'
import { PhaseIsland } from './components/PhaseIsland'
import { MobileSite } from './views/MobileSite'
import { DesktopKiosk } from './views/DesktopKiosk'
import { PreOpenStage } from './views/PreOpenStage'
import { ClosingSequence } from './views/ClosingSequence'
import { GrandOpening } from './views/GrandOpening'
import { AttentionShow } from './components/AttentionShow'
import { HypeLayer } from './components/HypeLayer'
import { MenuControl } from './components/MenuControl'
import { SoldOutStage } from './views/SoldOutStage'
import { useMenu } from './hooks/useMenu'

const skipIntro = new URLSearchParams(window.location.search).has('nointro')

export default function App() {
  const { phase, remaining, daysAway, now } = useEventPhase()
  // every drink marked SOLD (A + C) while we're open → the sold-out thank-you replaces the booth
  const soldOut = useMenu().allSoldOut && (phase === 'open' || phase === 'last-call')
  // desktop pre-open: the countdown stage from the day before (or under 23h); earlier, a preview dashboard
  const countdownStage = phase === 'pre-open' && (daysAway <= 1 || remaining < 23 * 3600_000)
  const desktop = useIsDesktop()
  const closed = phase === 'closed'
  const [intro, setIntro] = useState(!skipIntro && !closed)
  const [egg, setEgg] = useState(false)
  const [attention, setAttention] = useState(0)
  const [grand, setGrand] = useState<'auto' | 'manual' | null>(null)
  const autoPlayed = useRef(false)
  // the blueprint build-up belongs to the ceremony only — every other entrance is the plain one
  const [buildKiosk, setBuildKiosk] = useState(false)
  const [buildRun, setBuildRun] = useState(0)
  const built = useCallback(() => setBuildKiosk(false), [])
  const openEgg = useCallback(() => {
    trackClick('easter-egg')
    setEgg(true)
  }, [])

  // last 10 seconds before 13:00 → the ceremony takes over the screen
  useEffect(() => {
    // crew moved the clock back before the last 10s → the ceremony can fire again
    if (phase === 'pre-open' && remaining > 10_000) autoPlayed.current = false
    if (!autoPlayed.current && phase === 'pre-open' && remaining > 0 && remaining <= 10_000) {
      autoPlayed.current = true
      setGrand('auto')
    }
  }, [phase, remaining])

  useEffect(() => {
    const offGrand = signal.on('grand-opening', () => setGrand('manual'))
    const offIntro = signal.on('replay-intro', () => setIntro(true))
    const offAttn = signal.on('attention', () => setAttention(Date.now()))
    return () => {
      offGrand()
      offIntro()
      offAttn()
    }
  }, [])

  const finishGrand = () => {
    // the ceremony IS the opening: whatever got us here (clock, a manual trigger, or a leftover
    // forced "pre-open"), the booth is open afterwards. Past 13:00 the clock takes over again;
    // before it, "open" is held until 13:00 arrives (then useEventPhase hands back to Auto).
    setForcedPhase(phaseAt(now) === 'pre-open' ? 'open' : null)
    setBuildKiosk(true)
    setBuildRun((n) => n + 1)
    setGrand(null)
  }

  return (
    <MotionConfig reducedMotion="user">
      <AnimatePresence mode="wait">
        {/* nothing renders under the ceremony, so the booth's entrance plays the moment it ends */}
        {!intro && !closed && !grand && soldOut && <SoldOutStage key="soldout" desktop={desktop} />}
        {!intro && !closed && !grand && !soldOut && (desktop ? (countdownStage ? <PreOpenStage key="pre" onEgg={openEgg} /> : <DesktopKiosk key={`desk-${buildRun}`} onEgg={openEgg} preview={phase === 'pre-open'} build={buildKiosk} onBuilt={built} />) : <MobileSite key="mob" onEgg={openEgg} />)}
        {!intro && closed && <ClosingSequence key="closed" desktop={desktop} />}
      </AnimatePresence>
      <AnimatePresence>
        {intro && <Intro key="intro" onDone={() => setIntro(false)} />}
        {egg && <PletokEgg key="egg" onDone={() => setEgg(false)} />}
        {/* crew A + G: a loud 7 s show to pull people to the table (not during the ceremony) */}
        {attention > 0 && !grand && <AttentionShow key={`attn-${attention}`} onDone={() => setAttention(0)} />}
        {grand && <GrandOpening key="grand" mode={grand} onDone={finishGrand} />}
      </AnimatePresence>
      {/* the island is a phone thing, and only while we count down to opening */}
      <AnimatePresence>{!desktop && !intro && !grand && !egg && phase === 'pre-open' && <PhaseIsland key="island" />}</AnimatePresence>
      <HypeLayer />
      <PhaseControl />
      <MenuControl />
    </MotionConfig>
  )
}

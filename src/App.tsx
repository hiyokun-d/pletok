import { AnimatePresence, MotionConfig } from 'motion/react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { phaseAt, setForcedPhase, useEventPhase } from './hooks/useEventPhase'
import { useIsDesktop } from './hooks/useIsDesktop'
import { signal } from './lib/events'
import { trackClick } from './lib/analytics'
import { Intro } from './components/Intro'
import { PletokEgg } from './components/PletokEgg'
import { PhaseControl } from './components/PhaseControl'
import { LiveIsland } from './components/LiveIsland'
import { MobileSite } from './views/MobileSite'
import { DesktopKiosk } from './views/DesktopKiosk'
import { PreOpenStage } from './views/PreOpenStage'
import { ClosingSequence } from './views/ClosingSequence'
import { GrandOpening } from './views/GrandOpening'
import { AttentionShow, SHOW_COUNT } from './components/AttentionShow'
import { HypeLayer } from './components/HypeLayer'
import { SoldOutStage } from './views/SoldOutStage'
import { useMenu } from './hooks/useMenu'

const skipIntro = new URLSearchParams(window.location.search).has('nointro')

export default function App() {
  const { phase, remaining, daysAway, now } = useEventPhase()
  // every drink marked SOLD (from /hasil) while we're open → the sold-out thank-you replaces the booth;
  // "Tutup sekarang" there skips straight to the closing show
  const menu = useMenu()
  const selling = phase === 'open' || phase === 'last-call'
  const soldOut = menu.allSoldOut && selling
  // sold out while someone's watching: the island says "Ludes terjual!" first, then the stage takes over
  const [soldOutShown, setSoldOutShown] = useState(soldOut)
  useEffect(() => {
    if (!soldOut) return setSoldOutShown(false)
    const t = window.setTimeout(() => setSoldOutShown(true), 2200)
    return () => window.clearTimeout(t)
  }, [soldOut])
  // desktop pre-open: the countdown stage from the day before (or under 23h); earlier, a preview dashboard
  const countdownStage = phase === 'pre-open' && (daysAway <= 1 || remaining < 23 * 3600_000)
  const desktop = useIsDesktop()
  const closed = phase === 'closed' || (menu.closedEarly && selling)
  const [intro, setIntro] = useState(!skipIntro && !closed)
  const [egg, setEgg] = useState(false)
  const [attention, setAttention] = useState(0)
  // which of the attention shows plays (see AttentionShow)
  const [attnShow, setAttnShow] = useState(0)
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

  // last 30 seconds before 13:00 (batik wall at 20 s, the gate shuts at 12 s) → the ceremony takes over the screen
  useEffect(() => {
    // crew moved the clock back before the last 30s → the ceremony can fire again
    if (phase === 'pre-open' && remaining > 30_000) autoPlayed.current = false
    if (!autoPlayed.current && phase === 'pre-open' && remaining > 0 && remaining <= 30_000) {
      autoPlayed.current = true
      setGrand('auto')
    }
  }, [phase, remaining])

  // A+G sent from /config: the booth screen plays it at the time the phone picked (a short delay so
  // the screen has polled the Sheet by then). Shows older than ~20 s are never replayed on a reload.
  const attnAt = menu.attnAt
  const attnPick = menu.attnShow
  const attnSeen = useRef(0)
  useEffect(() => {
    if (!desktop || !attnAt || attnAt <= attnSeen.current || attnAt < Date.now() - 20_000) return
    attnSeen.current = attnAt
    // "acak" picks from the send time, so every booth screen plays the same one
    const show = attnPick !== undefined && attnPick >= 0 ? attnPick % SHOW_COUNT : attnAt % SHOW_COUNT
    const t = window.setTimeout(() => (setAttnShow(show), setAttention(Date.now())), Math.max(0, attnAt - Date.now()))
    return () => {
      window.clearTimeout(t)
      attnSeen.current = 0 // cancelled or rescheduled → let the new time through
    }
  }, [attnAt, attnPick, desktop])

  useEffect(() => {
    const offGrand = signal.on('grand-opening', () => setGrand('manual'))
    const offIntro = signal.on('replay-intro', () => setIntro(true))
    const offAttn = signal.on('attention', () => (setAttnShow(Math.floor(Math.random() * SHOW_COUNT)), setAttention(Date.now())))
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
        {!intro && !closed && !grand && soldOutShown && <SoldOutStage key="soldout" desktop={desktop} />}
        {!intro && !closed && !grand && !soldOutShown && (desktop ? (countdownStage ? <PreOpenStage key="pre" onEgg={openEgg} /> : <DesktopKiosk key={`desk-${buildRun}`} onEgg={openEgg} preview={phase === 'pre-open'} build={buildKiosk} onBuilt={built} />) : <MobileSite key="mob" onEgg={openEgg} />)}
        {!intro && closed && <ClosingSequence key="closed" desktop={desktop} />}
      </AnimatePresence>
      <AnimatePresence>
        {intro && <Intro key="intro" onDone={() => setIntro(false)} />}
        {egg && <PletokEgg key="egg" onDone={() => setEgg(false)} />}
        {/* crew A + G: a loud 7 s show to pull people to the table (not during the ceremony) */}
        {attention > 0 && !grand && <AttentionShow key={`attn-${attention}`} show={attnShow} onDone={() => setAttention(0)} />}
        {grand && <GrandOpening key="grand" mode={grand} onDone={finishGrand} />}
      </AnimatePresence>
      {/* one island for everything live: the phone countdown before we open + every remote change from /config */}
      <LiveIsland desktop={desktop} phaseBase={!desktop && phase === 'pre-open'} hidden={intro || !!grand || egg} />
      <HypeLayer />
      <PhaseControl />
    </MotionConfig>
  )
}

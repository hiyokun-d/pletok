import { AnimatePresence, MotionConfig } from 'motion/react'
import { Suspense, lazy, useCallback, useEffect, useRef, useState, type ComponentType } from 'react'
import { phaseAt, phaseNow, setForcedPhase, useEventPhase } from './hooks/useEventPhase'
import { useIsDesktop } from './hooks/useIsDesktop'
import { signal } from './lib/events'
import { trackClick } from './lib/analytics'
import { PhaseControl } from './components/PhaseControl'
import { LiveIsland } from './components/LiveIsland'
import { HypeLayer } from './components/HypeLayer'
import { SHOW_COUNT } from './data/shows'
import { useMenu } from './hooks/useMenu'
import { EVENT } from './data/event'

/*
 * Every stage is its own download: after the event a visitor (on the cheapest phone, on mobile data)
 * only pulls the recap — not the menu, kiosk, ceremony and shows it will never see. Before and
 * during the event the stages that could come next load in the background (see `warm` below).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const view = <M extends Record<K, ComponentType<any>>, K extends keyof M>(load: () => Promise<M>, name: K) => lazy(() => load().then((m) => ({ default: m[name] })))
const Intro = view(() => import('./components/Intro'), 'Intro')
const PletokEgg = view(() => import('./components/PletokEgg'), 'PletokEgg')
const MobileSite = view(() => import('./views/MobileSite'), 'MobileSite')
const DesktopKiosk = view(() => import('./views/DesktopKiosk'), 'DesktopKiosk')
const PreOpenStage = view(() => import('./views/PreOpenStage'), 'PreOpenStage')
const ClosingSequence = view(() => import('./views/ClosingSequence'), 'ClosingSequence')
const GrandOpening = view(() => import('./views/GrandOpening'), 'GrandOpening')
const AttentionShow = view(() => import('./components/AttentionShow'), 'AttentionShow')
const SoldOutStage = view(() => import('./views/SoldOutStage'), 'SoldOutStage')
const RecapSite = view(() => import('./views/RecapSite'), 'RecapSite')
/** the booth's live stages, fetched while the browser is idle so a phase change never waits on the network */
const warm = () =>
  [
    () => import('./components/Intro'),
    () => import('./views/MobileSite'),
    () => import('./views/DesktopKiosk'),
    () => import('./views/PreOpenStage'),
    () => import('./views/ClosingSequence'),
    () => import('./views/GrandOpening'),
    () => import('./components/AttentionShow'),
    () => import('./views/SoldOutStage'),
    () => import('./components/PletokEgg'),
  ].forEach((f) => void f().catch(() => {}))

/** main.tsx keeps the boot screen up until the first stage's code is here too — no blank flash in between */
export function preloadFirst(): Promise<unknown> {
  if (phaseNow() === 'closed') return EVENT.recap ? import('./views/RecapSite') : import('./views/ClosingSequence')
  const desktop = window.matchMedia('(min-width: 1024px) and (pointer: fine)').matches
  return Promise.all([skipIntro ? null : import('./components/Intro'), desktop ? import('./views/DesktopKiosk') : import('./views/MobileSite')])
}

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
  // after closing, the recap page (/config "Acara" can turn it off). Closing while someone's watching
  // (the booth laptop at 16:00, A+B, "tutup sekarang") plays the leaf-storm show first, then the recap.
  const recap = EVENT.recap
  const [closingShow, setClosingShow] = useState(false)
  const wasClosed = useRef(closed)
  useEffect(() => {
    if (closed && !wasClosed.current) setClosingShow(true)
    if (!closed) setClosingShow(false)
    wasClosed.current = closed
  }, [closed])
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

  // the booth is live (or about to be): fetch every stage it might switch to while the browser is idle
  useEffect(() => {
    if (closed) return
    const t = window.setTimeout(warm, 2500)
    return () => window.clearTimeout(t)
  }, [closed])

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
      {/* each stage waits for its own code (fallback: nothing — the boot screen covers the first one) */}
      <AnimatePresence mode="wait">
        {/* nothing renders under the ceremony, so the booth's entrance plays the moment it ends */}
        {!intro && !closed && !grand && soldOutShown && (
          <Suspense key="soldout" fallback={null}>
            <SoldOutStage desktop={desktop} />
          </Suspense>
        )}
        {!intro && !closed && !grand && !soldOutShown && (
          <Suspense key={desktop ? (countdownStage ? 'pre' : `desk-${buildRun}`) : 'mob'} fallback={null}>
            {desktop ? countdownStage ? <PreOpenStage onEgg={openEgg} /> : <DesktopKiosk onEgg={openEgg} preview={phase === 'pre-open'} build={buildKiosk} onBuilt={built} /> : <MobileSite onEgg={openEgg} />}
          </Suspense>
        )}
        {!intro && closed && (
          <Suspense key={recap && !closingShow ? 'recap' : 'closed'} fallback={null}>
            {recap && !closingShow ? <RecapSite desktop={desktop} onReplay={() => setClosingShow(true)} /> : <ClosingSequence desktop={desktop} onDone={recap ? () => setClosingShow(false) : undefined} />}
          </Suspense>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {intro && (
          <Suspense key="intro" fallback={null}>
            <Intro onDone={() => setIntro(false)} />
          </Suspense>
        )}
        {egg && (
          <Suspense key="egg" fallback={null}>
            <PletokEgg onDone={() => setEgg(false)} />
          </Suspense>
        )}
        {/* crew A + G: a loud 7 s show to pull people to the table (not during the ceremony) */}
        {attention > 0 && !grand && (
          <Suspense key={`attn-${attention}`} fallback={null}>
            <AttentionShow show={attnShow} onDone={() => setAttention(0)} />
          </Suspense>
        )}
        {grand && (
          <Suspense key="grand" fallback={null}>
            <GrandOpening mode={grand} onDone={finishGrand} />
          </Suspense>
        )}
      </AnimatePresence>
      {/* one island for everything live: the phone countdown before we open + every remote change from /config */}
      <LiveIsland desktop={desktop} phaseBase={!desktop && phase === 'pre-open'} hidden={intro || !!grand || egg} />
      <HypeLayer />
      <PhaseControl />
    </MotionConfig>
  )
}

import { motion, useAnimate, useMotionTemplate, useMotionValue, useTransform } from 'motion/react'
import { useEffect, useRef, useState } from 'react'
import { LEAF_BOX, LETTERS, LOGO_BOX, LOGO_BROWN, TAGLINE, pct } from '../data/logo'
import { Sprout, type SproutState } from './Sprout'
import { ParticleField } from './ParticleField'
import { LogoPiece } from './LogoPiece'

interface LogoRigProps {
  /** `intro`: a seed drops, the sprout grows in close-up, then the camera pulls back and the wordmark blooms out of the leaf */
  play?: 'intro' | 'static'
  interactive?: boolean
  showTagline?: boolean
  className?: string
  onReady?: () => void
  onLeafTap?: () => void
}

// the leaf's centre inside the logo box, in % — camera pivot and bloom origin
const LEAF_PT = {
  x: ((LEAF_BOX.x + LEAF_BOX.w * 0.47 - LOGO_BOX.x) / LOGO_BOX.w) * 100,
  y: ((LEAF_BOX.y + LEAF_BOX.h * 0.6 - LOGO_BOX.y) / LOGO_BOX.h) * 100,
}
const CLOSE_UP = 3.4

/**
 * The Pletok logo: one vector wordmark (always moves as a whole) + the SVG sprout on the T.
 * Used by the intro, the grand opening, the hero and the booth header.
 */
export function LogoRig({ play = 'static', interactive = true, showTagline = true, className = '', onReady, onLeafTap }: LogoRigProps) {
  const intro = play === 'intro'
  const [scope, animate] = useAnimate()
  const [sprout, setSprout] = useState<SproutState>(intro ? 'hidden' : 'idle')
  const [wiggle, setWiggle] = useState(0)
  const [burst, setBurst] = useState<{ key: number; at: [number, number] }>()
  const fxRef = useRef<HTMLDivElement>(null)
  const leafRef = useRef<HTMLButtonElement>(null)
  // the bloom mask radius as a motion value — Safari won't animate a CSS variable inside mask-image
  const bloomR = useMotionValue(intro ? 0 : 170)
  const bloomIn = useTransform(bloomR, (v) => v - 14)
  const bloom = useMotionTemplate`radial-gradient(circle at ${LEAF_PT.x}% ${LEAF_PT.y}%, #000 ${bloomIn}%, transparent ${bloomR}%)`
  const finished = useRef(false)
  const pulledBack = useRef(false)
  // the close-up lives in motion values, not in the style prop — a re-render can't put it back
  const camScale = useMotionValue(intro ? CLOSE_UP : 1)
  const camX = useMotionValue(intro ? `${50 - LEAF_PT.x}%` : '0%')
  const camY = useMotionValue(intro ? `${50 - LEAF_PT.y}%` : '0%')

  useEffect(() => {
    if (!intro) return
    let cancelled = false
    // every step on a clock: an animation that never finishes (Safari) can't hold the intro hostage
    const timers: number[] = []
    const at = (ms: number, f: () => void) => timers.push(window.setTimeout(() => !cancelled && f(), ms))
    // seed falls into frame, lands with a squash and a ripple
    animate('.seed', { y: ['-30vh', '0vh'], opacity: [1, 1] }, { duration: 0.6, ease: [0.55, 0, 1, 0.45] })
    at(600, () => {
      animate('.seed', { scaleX: [1, 1.9, 0], scaleY: [1, 0.35, 0] }, { duration: 0.35 })
      animate('.ripple', { scale: [0, 4], opacity: [0.7, 0] }, { duration: 0.9, delay: (i: number) => i * 0.14, ease: [0.2, 0.8, 0.3, 1] })
      setSprout('grow')
    })
    // the sprout normally reports in at ~1.8 s; if it doesn't, pull back anyway
    at(2600, () => void onGrown())
    return () => {
      cancelled = true
      timers.forEach(window.clearTimeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro, animate])

  /** the intro's end state, applied directly — used if any browser stalls mid-sequence */
  const snapToEnd = () => {
    bloomR.set(170)
    camScale.set(1)
    camX.set('0%')
    camY.set('0%')
    setSprout('idle')
    // and straight on the DOM too, in case the animation loop itself is what stalled
    const root = scope.current as HTMLElement | null
    const cam = root?.querySelector<HTMLElement>('.cam')
    if (cam) cam.style.transform = 'none'
    const mark = root?.querySelector<SVGElement>('.mark')
    if (mark) {
      mark.style.maskImage = 'none'
      mark.style.webkitMaskImage = 'none'
    }
    const tag = root?.querySelector<HTMLElement>('.tagline')
    if (tag) {
      tag.style.opacity = '1'
      tag.style.clipPath = 'none'
    }
  }
  const finish = () => {
    if (finished.current) return
    finished.current = true
    onReady?.()
  }

  // watchdog: whatever happens (Safari, a dropped frame, a thrown animation) the intro ends
  useEffect(() => {
    if (!intro) return
    const t = window.setTimeout(() => {
      if (finished.current) return
      snapToEnd()
      finish()
    }, 6500)
    return () => window.clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intro])

  const onGrown = () => {
    setSprout('idle')
    if (!intro) return fireLeaves()
    // the sprout's own callback and the fallback timer can both land here — pull back once
    if (pulledBack.current) return
    pulledBack.current = true
    const ease = [0.7, 0, 0.2, 1] as const
    try {
      // camera pulls back from the sprout while the wordmark blooms outward from the leaf
      animate(bloomR, 170, { duration: 1.25, ease: [0.5, 0, 0.25, 1], delay: 0.1 })
      animate('.mark', { scale: [1.06, 1] }, { duration: 1.4, ease: [0.3, 0, 0.2, 1], delay: 0.1 })
      animate(camScale, 1, { duration: 1.3, ease })
      animate(camX, '0%', { duration: 1.3, ease })
      animate(camY, '0%', { duration: 1.3, ease })
    } catch {
      snapToEnd()
    }
    window.setTimeout(() => {
      fireLeaves()
      try {
        animate('.flash-ring', { scale: [0.2, 1.6], opacity: [0.5, 0] }, { duration: 0.9, ease: [0.2, 0.8, 0.3, 1] })
        if (showTagline) animate('.tagline', { clipPath: ['inset(0 50% 0 50%)', 'inset(0 0% 0 0%)'], opacity: [1, 1] }, { duration: 0.7, ease: [0.65, 0, 0.35, 1] })
      } catch {
        /* the snap below covers it */
      }
    }, 1300)
    // done on the clock; snap whatever didn't make it to its end state
    window.setTimeout(() => {
      snapToEnd()
      finish()
    }, 2100)
  }

  const fireLeaves = () => {
    const fx = fxRef.current?.getBoundingClientRect()
    const leaf = leafRef.current?.getBoundingClientRect()
    if (!fx || !leaf) return
    setBurst({ key: Date.now(), at: [leaf.left - fx.left + leaf.width / 2, leaf.top - fx.top + leaf.height * 0.4] })
  }

  const tapLeaf = () => {
    setWiggle((w) => w + 1)
    fireLeaves()
    onLeafTap?.()
  }


  return (
    <div ref={scope} className={`relative ${className}`} style={{ aspectRatio: `${LOGO_BOX.w} / ${LOGO_BOX.h}` }}>
      {/* particle stage bleeds outside the logo so leaves can fly free */}
      <div ref={fxRef} className="pointer-events-none absolute -inset-x-[40%] -inset-y-[60%]">
        <ParticleField
          preset="burst"
          overrides={{ shape: 'leaf', count: intro ? 60 : 36, size: [8, 16], burstSpeed: [160, intro ? 620 : 420], gravity: 500, colors: ['#5e7b3a', '#8faa4f', '#6a371c', '#a3b860'] }}
          points={burst ? [burst.at] : undefined}
          burstKey={burst?.key}
        />
      </div>

      <motion.div
        className="cam absolute inset-0 will-change-transform"
        style={{ transformOrigin: `${LEAF_PT.x}% ${LEAF_PT.y}%`, scale: camScale, x: camX, y: camY }}
      >
        {intro && (
          <>
            <span
              className="flash-ring pointer-events-none absolute aspect-square w-[60%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-leaf/40 opacity-0"
              style={{ left: `${LEAF_PT.x}%`, top: `${LEAF_PT.y}%` }}
            />
            {[0, 1].map((i) => (
              <span
                key={i}
                className="ripple pointer-events-none absolute aspect-square w-[3%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-brown/40 opacity-0"
                style={{ left: `${LEAF_PT.x}%`, top: `${((LEAF_BOX.y + LEAF_BOX.h - LOGO_BOX.y) / LOGO_BOX.h) * 100}%` }}
              />
            ))}
            <span
              className="seed absolute aspect-square w-[2%] -translate-x-1/2 -translate-y-full rounded-full opacity-0"
              style={{ background: LOGO_BROWN, left: `${LEAF_PT.x}%`, top: `${((LEAF_BOX.y + LEAF_BOX.h - LOGO_BOX.y) / LOGO_BOX.h) * 100}%` }}
            />
          </>
        )}

        {/* the wordmark is ONE svg — it never comes apart */}
        <motion.svg
          aria-label="Pletok"
          viewBox={`${LOGO_BOX.x} ${LOGO_BOX.y} ${LOGO_BOX.w} ${LOGO_BOX.h}`}
          className={`mark absolute inset-0 h-full w-full overflow-visible ${interactive ? 'cursor-pointer' : ''}`}
          style={intro ? { maskImage: bloom, WebkitMaskImage: bloom } : { originY: 1 }}
          whileHover={interactive ? { y: '-3%', rotate: -1, transition: { type: 'spring', stiffness: 400, damping: 14 } } : undefined}
          whileTap={interactive ? { scaleY: 0.9, scaleX: 1.05 } : undefined}
        >
          {LETTERS.map((l) => (
            <svg key={l.id} x={l.x} y={l.y} width={l.w} height={l.h} viewBox={`0 0 ${l.vw} ${l.vh}`} preserveAspectRatio="none">
              <path d={l.d} fill={LOGO_BROWN} fillRule="evenodd" />
            </svg>
          ))}
        </motion.svg>

        <motion.button
          ref={leafRef}
          type="button"
          onClick={interactive ? tapLeaf : undefined}
          className={`absolute ${interactive ? 'cursor-pointer' : 'pointer-events-none'}`}
          style={pct(LEAF_BOX)}
          whileHover={interactive ? { scale: 1.12, rotate: -4 } : undefined}
          aria-label="Goyang daunnya"
        >
          <Sprout state={sprout} wiggleKey={wiggle} onGrown={onGrown} className="h-full w-full" />
        </motion.button>

        {showTagline && (
          <div aria-label="Betawi, full of flavor." className={`tagline absolute select-none ${intro ? 'opacity-0' : ''}`} style={pct(TAGLINE)}>
            <LogoPiece part={TAGLINE} className="h-full w-full" />
          </div>
        )}
      </motion.div>
    </div>
  )
}

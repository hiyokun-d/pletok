import { Component, useEffect, useRef, useState, type ReactNode } from 'react'
import { Geometry, Mesh, Program, Renderer } from 'ogl'
import { PRESETS, type ParticlePreset, type PresetName } from './particlePresets'

const MAX_INSTANCES = 400
const MAX_COLORS = 6
const MAX_POINTS = 8

const SHAPE_ID = { leaf: 0, spice: 1, bubble: 2, sparkle: 3, mixed: 4 } as const
const EMITTER_ID = { top: 0, bottom: 1, area: 2, points: 3 } as const

const vertex = /* glsl */ `
precision highp float;
attribute vec2 position;
attribute vec4 aSeed;
attribute vec4 aSeed2;

uniform float uTime;
uniform float uBurstT;
uniform vec2 uRes;
uniform float uMode;
uniform float uEmitter;
uniform vec2 uSize;
uniform vec2 uTravel;
uniform float uWind;
uniform float uSway;
uniform float uSpin;
uniform float uGravity;
uniform vec2 uBurstSpeed;
uniform vec2 uLife;
uniform float uSpeed;
uniform vec2 uPoints[${MAX_POINTS}];
uniform float uPointCount;

varying vec2 vUv;
varying float vAlpha;
varying float vSeed;
varying float vSize;

const float PI = 3.14159265;

vec2 rot(vec2 p, float a) { float c = cos(a), s = sin(a); return vec2(c * p.x - s * p.y, s * p.x + c * p.y); }

void main() {
  float size = mix(uSize.x, uSize.y, aSeed.x * aSeed.x);
  float pad = uSize.y * 2.0;
  float t = uTime * uSpeed;
  vec2 pos;
  float angle = aSeed.y * 2.0 * PI;
  float alpha = 1.0;
  float flip = 1.0;

  if (uMode < 0.5) {
    // ---- ambient: endless loop, each particle phase-shifted by its seed
    float span = uRes.y + pad * 2.0;
    float travel = mix(uTravel.x, uTravel.y, aSeed.z);
    float life = uEmitter < 1.5 ? span / travel : mix(uLife.x, uLife.y, aSeed.z);
    float lt = mod(t + aSeed.w * life * 7.0, life);
    float p = lt / life;
    float swayT = lt * (0.6 + aSeed2.x * 0.9) + aSeed2.y * 6.2831;
    float x = aSeed2.z * (uRes.x + pad * 2.0) - pad + uWind * lt + sin(swayT) * uSway;
    x = mod(x + pad, uRes.x + pad * 2.0) - pad;

    if (uEmitter < 0.5) {            // top → falls
      pos = vec2(x, -pad + span * p);
    } else if (uEmitter < 1.5) {     // bottom → rises
      pos = vec2(x, uRes.y + pad - span * p);
      alpha = smoothstep(0.0, 0.1, p) * (1.0 - smoothstep(0.75, 1.0, p));
    } else {                          // area → twinkle in place
      pos = vec2(aSeed2.z * uRes.x, aSeed2.w * uRes.y - p * uSway * 4.0) + vec2(sin(swayT), 0.0) * uSway;
      alpha = sin(p * PI);
      alpha *= alpha;
      size *= 0.4 + 0.6 * alpha;
    }
    angle += lt * uSpin * (aSeed2.x - 0.5) * 2.0 + sin(swayT) * 0.6;
    flip = mix(0.3, 1.0, abs(cos(swayT * 0.8)));   // leaf turning over in the air
  } else {
    // ---- burst: one shot from emitter points with drag + gravity
    float bt = (uTime - uBurstT) ;
    float life = mix(uLife.x, uLife.y, aSeed.z);
    float idx = floor(aSeed2.x * uPointCount);
    vec2 origin = uPoints[0];
    for (int i = 1; i < ${MAX_POINTS}; i++) { if (float(i) == idx) origin = uPoints[i]; }
    float a = mix(-PI * 0.97, -PI * 0.03, aSeed2.y);       // fan upward, falls back down
    float speed = mix(uBurstSpeed.x, uBurstSpeed.y, aSeed2.z * aSeed2.z);
    vec2 v = vec2(cos(a), sin(a)) * speed;
    float k = 2.2;
    float tt = max(bt, 0.0);
    pos = origin + v * (1.0 - exp(-k * tt)) / k + vec2(sin(tt * 3.0 + aSeed.w * 6.0) * 18.0, 0.5 * uGravity * 0.35 * tt * tt);
    alpha = step(0.0, bt) * (1.0 - smoothstep(life * 0.55, life, tt));
    angle += tt * uSpin * (aSeed2.w - 0.5) * 2.0;
    flip = mix(0.4, 1.0, abs(cos(tt * 5.0 + aSeed.w * 6.0)));
  }

  vec2 corner = rot(position * vec2(flip, 1.0) * size * 0.5, angle);
  vec2 px = pos + corner;
  vec2 clip = (px / uRes) * 2.0 - 1.0;
  gl_Position = vec4(clip.x, -clip.y, 0.0, 1.0);

  vUv = position;
  vAlpha = alpha;
  vSeed = aSeed.w;
  vSize = size;
}
`

const fragment = /* glsl */ `
precision highp float;
uniform float uShape;
uniform vec3 uColors[${MAX_COLORS}];
uniform float uColorCount;
uniform float uOpacity;

varying vec2 vUv;
varying float vAlpha;
varying float vSeed;
varying float vSize;

const float PI = 3.14159265;

// Each returns (coverage, shade)
vec2 leaf(vec2 p, float aa) {
  // vesica: intersection of two circles → pointed leaf, plus a tiny stem
  float r = 0.95;
  float d = max(length(p - vec2(0.55, 0.0)) - r, length(p + vec2(0.55, 0.0)) - r);
  float body = 1.0 - smoothstep(-aa, aa, d);
  float stem = (1.0 - smoothstep(0.04, 0.04 + aa, abs(p.x))) * step(0.72, p.y) * step(p.y, 0.98);
  float rib = 1.0 - smoothstep(0.02, 0.02 + aa, abs(p.x));
  // two-tone halves like the poster leaves
  float shade = p.x > 0.0 ? 1.0 : 0.78;
  shade = mix(shade, 0.6, rib * body);
  return vec2(max(body, stem), shade);
}

vec2 spice(vec2 p, float aa) {
  // four petals + dot, the poster's spice-star motif
  float a = atan(p.y, p.x) + PI * 0.25;
  float r = length(p);
  float petal = 0.95 * pow(abs(cos(2.0 * a)), 0.7);
  float fill = 1.0 - smoothstep(petal - aa, petal + aa, r);
  float hole = smoothstep(petal * 0.45 - aa, petal * 0.45 + aa, r);
  float core = 1.0 - smoothstep(0.14 - aa, 0.14 + aa, r);
  return vec2(max(fill * hole, core), 1.0);
}

vec2 bubble(vec2 p, float aa) {
  float r = length(p);
  float ring = 1.0 - smoothstep(0.1 - aa, 0.1 + aa, abs(r - 0.78));
  float inner = (1.0 - smoothstep(0.78 - aa, 0.78 + aa, r)) * 0.22;
  float hi = 1.0 - smoothstep(0.12, 0.12 + aa * 2.0, length(p - vec2(-0.32, -0.34)));
  return vec2(max(max(ring, inner), hi), 1.0 + hi * 0.4);
}

vec2 sparkle(vec2 p, float aa) {
  vec2 q = abs(p);
  float d = pow(q.x, 0.5) + pow(q.y, 0.5) - 0.95;
  float star = 1.0 - smoothstep(-aa * 2.0, aa * 2.0, d);
  float glow = exp(-length(p) * 3.5) * 0.45;
  return vec2(max(star, glow), 1.15);
}

void main() {
  vec2 p = vUv;
  float aa = 3.0 / max(vSize, 1.0);
  float s = uShape;
  if (s > 3.5) s = vSeed < 0.55 ? 0.0 : (vSeed < 0.82 ? 1.0 : 3.0);

  vec2 res;
  if (s < 0.5) res = leaf(p, aa);
  else if (s < 1.5) res = spice(p, aa);
  else if (s < 2.5) res = bubble(p, aa);
  else res = sparkle(p, aa);

  float ci = floor(fract(vSeed * 13.37) * uColorCount);
  vec3 col = uColors[0];
  for (int i = 1; i < ${MAX_COLORS}; i++) { if (float(i) == ci) col = uColors[i]; }
  col *= res.y;

  float a = res.x * vAlpha * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(col * a, a);
}
`

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255]
}

export interface ParticleFieldProps {
  preset: PresetName
  /** Override any preset value — colors, count, speeds… */
  overrides?: Partial<ParticlePreset>
  /** Global time multiplier (e.g. faster during last call) */
  speed?: number
  /** Burst emitters, in px relative to this field */
  points?: Array<[number, number]>
  /** Change this value to (re)fire a burst */
  burstKey?: number | string
  onBurstDone?: () => void
  className?: string
}

/**
 * The single particle system for the whole site. One canvas, one instanced quad, all motion
 * computed in the vertex shader from time — the CPU only uploads a few uniforms per frame.
 */
function ParticleFieldInner({
  preset,
  overrides,
  speed = 1,
  points,
  burstKey,
  onBurstDone,
  className = '',
}: ParticleFieldProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const programRef = useRef<Program | null>(null)
  const geometryRef = useRef<Geometry | null>(null)
  const clockRef = useRef(0)
  const configRef = useRef<{ cfg: ParticlePreset; speed: number }>(null)
  const onDoneRef = useRef(onBurstDone)
  onDoneRef.current = onBurstDone

  const reduced =
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const cfg: ParticlePreset = { ...PRESETS[preset], ...overrides }
  configRef.current = { cfg, speed: reduced ? speed * 0.5 : speed }

  // ---- mount once: renderer, geometry, program, loop
  useEffect(() => {
    const host = hostRef.current!
    let renderer: Renderer
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 1.25), alpha: true, premultipliedAlpha: true, antialias: false })
      if (!renderer.gl) throw new Error('WebGL unavailable')
    } catch {
      // No WebGL (old GPU, context limit, GPU reset) — particles are decoration, so just skip them
      return
    }
    const gl = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    host.appendChild(canvas)

    const seedA = new Float32Array(MAX_INSTANCES * 4)
    const seedB = new Float32Array(MAX_INSTANCES * 4)
    for (let i = 0; i < seedA.length; i++) {
      seedA[i] = Math.random()
      seedB[i] = Math.random()
    }
    const geometry = new Geometry(gl, {
      position: { size: 2, data: new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]) },
      index: { data: new Uint16Array([0, 1, 2, 2, 1, 3]) },
      aSeed: { instanced: 1, size: 4, data: seedA },
      aSeed2: { instanced: 1, size: 4, data: seedB },
    })
    geometryRef.current = geometry

    const program = new Program(gl, {
      vertex,
      fragment,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uBurstT: { value: -100 },
        uRes: { value: [1, 1] },
        uMode: { value: 0 },
        uEmitter: { value: 0 },
        uShape: { value: 0 },
        uSize: { value: [10, 20] },
        uTravel: { value: [30, 60] },
        uWind: { value: 0 },
        uSway: { value: 0 },
        uSpin: { value: 0 },
        uGravity: { value: 0 },
        uBurstSpeed: { value: [0, 0] },
        uLife: { value: [1, 2] },
        uSpeed: { value: 1 },
        uOpacity: { value: 1 },
        uColors: { value: new Float32Array(MAX_COLORS * 3) },
        uColorCount: { value: 1 },
        uPoints: { value: new Float32Array(MAX_POINTS * 2) },
        uPointCount: { value: 1 },
      },
    })
    program.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
    programRef.current = program
    const mesh = new Mesh(gl, { geometry, program, frustumCulled: false })

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      renderer.setSize(Math.max(1, width), Math.max(1, height))
      program.uniforms.uRes.value = [Math.max(1, width), Math.max(1, height)]
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    // pause when off-screen or tab hidden
    let visible = true
    const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting))
    io.observe(host)

    // GPU reset or context evicted — stop drawing rather than throwing every frame
    let lost = false
    const onLost = (e: Event) => {
      e.preventDefault()
      lost = true
    }
    canvas.addEventListener('webglcontextlost', onLost)

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      if (lost || !visible || document.hidden) return
      clockRef.current += dt
      program.uniforms.uTime.value = clockRef.current
      program.uniforms.uSpeed.value = configRef.current!.speed
      renderer.render({ scene: mesh })
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      io.disconnect()
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.remove()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
      programRef.current = null
    }
  }, [])

  // ---- config → uniforms (no remount when preset/colors change)
  const cfgKey = JSON.stringify(cfg)
  useEffect(() => {
    const program = programRef.current
    const geometry = geometryRef.current
    if (!program || !geometry) return
    const c = configRef.current!.cfg
    const u = program.uniforms
    const count = Math.min(MAX_INSTANCES, Math.round(c.count * (reduced ? 0.4 : 1)))
    geometry.instancedCount = count
    u.uMode.value = c.mode === 'burst' ? 1 : 0
    u.uEmitter.value = EMITTER_ID[c.emitter]
    u.uShape.value = SHAPE_ID[c.shape]
    u.uSize.value = c.size
    u.uTravel.value = c.travel
    u.uWind.value = c.wind
    u.uSway.value = c.sway
    u.uSpin.value = c.spin
    u.uGravity.value = c.gravity
    u.uBurstSpeed.value = c.burstSpeed
    u.uLife.value = c.life
    u.uOpacity.value = c.opacity
    const colors = new Float32Array(MAX_COLORS * 3)
    c.colors.slice(0, MAX_COLORS).forEach((hex, i) => colors.set(hexToRgb(hex), i * 3))
    u.uColors.value = colors
    u.uColorCount.value = Math.min(MAX_COLORS, c.colors.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cfgKey, reduced])

  // ---- burst trigger
  const pointsKey = JSON.stringify(points ?? [])
  useEffect(() => {
    const program = programRef.current
    if (!program || burstKey === undefined) return
    const pts = new Float32Array(MAX_POINTS * 2)
    const list = points?.length ? points : [[0, 0] as [number, number]]
    list.slice(0, MAX_POINTS).forEach(([x, y], i) => pts.set([x, y], i * 2))
    program.uniforms.uPoints.value = pts
    program.uniforms.uPointCount.value = Math.min(MAX_POINTS, list.length)
    program.uniforms.uBurstT.value = clockRef.current
    const done = window.setTimeout(() => onDoneRef.current?.(), configRef.current!.cfg.life[1] * 1000)
    return () => window.clearTimeout(done)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [burstKey, pointsKey])

  return <div ref={hostRef} aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`} />
}

/** Particles are pure decoration: if anything in WebGL throws, drop them instead of the page. */
class ParticleBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? null : this.props.children
  }
}

/**
 * Each WebGL context is expensive, so a field only creates one while its area is on screen
 * (and a burst field only while a burst is actually playing). Off-screen → context released.
 */
export function ParticleField(props: ParticleFieldProps) {
  const gateRef = useRef<HTMLDivElement>(null)
  const [onScreen, setOnScreen] = useState(false)
  const [bursting, setBursting] = useState(false)
  const isBurst = (props.overrides?.mode ?? PRESETS[props.preset].mode) === 'burst'

  useEffect(() => {
    const io = new IntersectionObserver(([e]) => setOnScreen(e.isIntersecting), { rootMargin: '120px' })
    io.observe(gateRef.current!)
    return () => io.disconnect()
  }, [])

  useEffect(() => {
    if (!isBurst || props.burstKey === undefined) return
    setBursting(true)
  }, [isBurst, props.burstKey])

  const live = onScreen && (!isBurst || bursting)
  return (
    <div ref={gateRef} aria-hidden className={`pointer-events-none absolute inset-0 ${props.className ?? ''}`}>
      {live && (
        <ParticleBoundary>
          <ParticleFieldInner
            {...props}
            className=""
            onBurstDone={() => {
              setBursting(false)
              props.onBurstDone?.()
            }}
          />
        </ParticleBoundary>
      )}
    </div>
  )
}

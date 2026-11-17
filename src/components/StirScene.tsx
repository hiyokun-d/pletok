import { useEffect, useRef, useState } from 'react'
import { Box, Camera, Cylinder, Mesh, Program, Renderer, Transform, Vec3, type OGLRenderingContext } from 'ogl'
import cupImg from '../assets/cup-original.png'

interface StirSceneProps {
  /** bump to replay */
  run: number
  onKnock: (side: 'left' | 'right', screen: [number, number]) => void
  onDone: () => void
  /** after the demo: bump `key` to make the stirrer knock that side of the glass */
  tap?: { side: 'left' | 'right'; key: number }
  className?: string
}

const vertex = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
uniform mat4 modelViewMatrix;
uniform mat4 projectionMatrix;
uniform mat3 normalMatrix;
varying vec3 vNormal;
varying vec3 vLocal;
varying vec3 vObjN;
void main() {
  vNormal = normalize(normalMatrix * normal);
  vObjN = normal;
  vLocal = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`

const LIGHT = 'normalize(vec3(-0.4, 0.8, 0.6))'

const glassFrag = /* glsl */ `
precision highp float;
varying vec3 vNormal; varying vec3 vLocal;
void main() {
  vec3 n = normalize(vNormal);
  float facing = abs(n.z);
  float rim = pow(1.0 - facing, 2.2);
  float a = atan(vLocal.z, vLocal.x);
  float streak = smoothstep(0.06, 0.0, abs(a - 2.2)) * 0.6 + smoothstep(0.03, 0.0, abs(a - 2.55)) * 0.35;
  float lip = smoothstep(0.93, 1.0, vLocal.y);
  vec3 col = mix(vec3(0.86, 0.93, 0.98), vec3(1.0), rim);
  float alpha = 0.06 + rim * 0.5 + streak + lip * 0.4;
  gl_FragColor = vec4(col * alpha, alpha);
}
`

const liquidFrag = /* glsl */ `
precision highp float;
uniform float uSwirl; uniform float uTopY; uniform float uR;
varying vec3 vNormal; varying vec3 vLocal; varying vec3 vObjN;
void main() {
  vec3 deep = vec3(0.30, 0.07, 0.04);
  vec3 amber = vec3(0.70, 0.27, 0.12);
  vec3 col;
  if (vObjN.y > 0.5) {
    // surface: vortex spiral driven by the stirring
    float r = length(vLocal.xz) / uR;
    float a = atan(vLocal.z, vLocal.x);
    float twist = a + uSwirl * (1.2 - r) * 2.5 + r * 7.0;
    float band = sin(twist * 3.0) * 0.5 + 0.5;
    col = mix(deep * 1.4, amber * 1.15, band * (0.35 + r * 0.5));
    col = mix(col, vec3(0.93, 0.78, 0.62), smoothstep(0.86, 1.0, r) * 0.55); // foam ring
    col *= 1.0 - smoothstep(0.0, 0.35, 0.35 - r) * 0.35 * min(abs(uSwirl) * 0.05, 1.0); // dip in the middle
  } else {
    float h = clamp((vLocal.y + 0.8) / 1.6, 0.0, 1.0);
    vec3 n = normalize(vNormal);
    float lam = max(dot(n, ${LIGHT}), 0.0);
    float rim = pow(1.0 - abs(n.z), 2.0);
    col = mix(deep, amber, h * 0.8 + rim * 0.4) * (0.55 + lam * 0.6);
    col += vec3(0.9, 0.4, 0.2) * pow(lam, 8.0) * 0.25;
  }
  gl_FragColor = vec4(col, 1.0);
}
`

const iceFrag = /* glsl */ `
precision highp float;
varying vec3 vNormal; varying vec3 vLocal;
void main() {
  vec3 n = normalize(vNormal);
  float lam = max(dot(n, ${LIGHT}), 0.0);
  float rim = pow(1.0 - abs(n.z), 1.6);
  vec3 col = mix(vec3(0.82, 0.9, 0.96), vec3(1.0), lam * 0.7 + rim * 0.5);
  float edge = max(max(abs(vLocal.x), abs(vLocal.y)), abs(vLocal.z));
  float alpha = 0.55 + rim * 0.35 + smoothstep(0.17, 0.19, edge) * 0.0;
  gl_FragColor = vec4(col * alpha, alpha);
}
`

const woodFrag = /* glsl */ `
precision highp float;
uniform vec3 uColor; uniform float uRings;
varying vec3 vNormal; varying vec3 vLocal; varying vec3 vObjN;
void main() {
  vec3 n = normalize(vNormal);
  float lam = max(dot(n, ${LIGHT}), 0.0);
  float grain;
  if (uRings > 0.5 && vObjN.y > 0.5) grain = sin(length(vLocal.xz) * 46.0) * 0.5 + 0.5;  // tree rings on the coaster
  else grain = sin(vLocal.y * 60.0 + sin(vLocal.x * 30.0) * 2.0) * 0.5 + 0.5;
  vec3 col = uColor * (0.85 + grain * 0.2) * (0.5 + lam * 0.7);
  gl_FragColor = vec4(col, 1.0);
}
`

const ease = (t: number) => (t < 0 ? 0 : t > 1 ? 1 : 1 - (1 - t) ** 3)
const lerp = (a: number, b: number, t: number) => a + (b - a) * t

/**
 * Real-time 3D stir: glass of bir pletok on a wooden coaster, stirrer swirls a vortex,
 * then knocks the glass — PLE!… TOK! Falls back to the 2D cup image without WebGL.
 */
export function StirScene({ run, onKnock, onDone, tap, className = '' }: StirSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const [fallback, setFallback] = useState(false)
  const cb = useRef({ onKnock, onDone })
  cb.current = { onKnock, onDone }
  const taps = useRef<Array<'left' | 'right'>>([])

  useEffect(() => {
    if (tap) taps.current.push(tap.side)
  }, [tap?.key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const host = hostRef.current!
    let renderer: Renderer
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 2), alpha: true, premultipliedAlpha: true, antialias: true })
      if (!renderer.gl) throw new Error('no webgl')
    } catch {
      setFallback(true)
      // keep the story going without 3D
      const t1 = window.setTimeout(() => cb.current.onKnock('left', [innerWidth / 2 - 60, innerHeight / 2]), 900)
      const t2 = window.setTimeout(() => cb.current.onKnock('right', [innerWidth / 2 + 60, innerHeight / 2]), 1500)
      const t3 = window.setTimeout(() => cb.current.onDone(), 2100)
      return () => [t1, t2, t3].forEach(clearTimeout)
    }
    const gl: OGLRenderingContext = renderer.gl
    gl.clearColor(0, 0, 0, 0)
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'
    host.appendChild(canvas)

    const camera = new Camera(gl, { fov: 32 })
    const scene = new Transform()
    const cup = new Transform()
    cup.setParent(scene)

    const prog = (fragment: string, uniforms: Record<string, { value: unknown }> = {}, transparent = false) => {
      const p = new Program(gl, { vertex, fragment, uniforms, transparent, cullFace: transparent ? false : gl.BACK, depthWrite: !transparent })
      if (transparent) p.setBlendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      return p
    }

    const R_TOP = 0.95
    const R_BOT = 0.74
    const LIQ_H = 1.5
    const LIQ_TOP = -1 + LIQ_H
    const rAt = (y: number) => lerp(R_BOT, R_TOP, (y + 1) / 2)

    const coaster = new Mesh(gl, {
      geometry: new Cylinder(gl, { radiusTop: 1.3, radiusBottom: 1.36, height: 0.26, radialSegments: 48 }),
      program: prog(woodFrag, { uColor: { value: [0.62, 0.42, 0.27] }, uRings: { value: 1 } }),
    })
    coaster.position.y = -1.14
    coaster.setParent(scene)

    const liquidProgram = prog(liquidFrag, { uSwirl: { value: 0 }, uTopY: { value: LIQ_H / 2 }, uR: { value: rAt(LIQ_TOP) - 0.04 } })
    const liquid = new Mesh(gl, {
      geometry: new Cylinder(gl, { radiusTop: rAt(LIQ_TOP) - 0.04, radiusBottom: R_BOT - 0.04, height: LIQ_H, radialSegments: 64 }),
      program: liquidProgram,
    })
    liquid.position.y = -1 + LIQ_H / 2
    liquid.setParent(cup)

    const iceProgram = prog(iceFrag, {}, true)
    const ice = [0, 1, 2, 3].map((i) => {
      const m = new Mesh(gl, { geometry: new Box(gl, { width: 0.36, height: 0.36, depth: 0.36 }), program: iceProgram })
      m.setParent(cup)
      return { m, phase: (i / 4) * Math.PI * 2, r: 0.42 + (i % 2) * 0.12, spin: 0.6 + i * 0.3, jump: 0 }
    })

    const stickPivot = new Transform()
    stickPivot.setParent(cup)
    const stick = new Mesh(gl, {
      geometry: new Cylinder(gl, { radiusTop: 0.055, radiusBottom: 0.045, height: 3.2, radialSegments: 16 }),
      program: prog(woodFrag, { uColor: { value: [0.55, 0.33, 0.2] }, uRings: { value: 0 } }),
    })
    stick.position.y = 1.6 // pivot sits at the tip
    stick.setParent(stickPivot)

    const glass = new Mesh(gl, {
      geometry: new Cylinder(gl, { radiusTop: R_TOP, radiusBottom: R_BOT, height: 2, radialSegments: 64, openEnded: true }),
      program: prog(glassFrag, {}, true),
    })
    glass.setParent(cup)
    glass.renderOrder = 10

    const resize = () => {
      const { width, height } = host.getBoundingClientRect()
      renderer.setSize(width, height)
      camera.perspective({ aspect: width / Math.max(height, 1) })
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(host)

    /** cup-space point → page px, so DOM effects (rings, words, splashes) line up with the 3D hit */
    const project = (x: number, y: number, z: number): [number, number] => {
      const r = host.getBoundingClientRect()
      const v = new Vec3(x, y, z).applyMatrix4(cup.worldMatrix)
      camera.project(v)
      return [r.left + ((v[0] + 1) / 2) * r.width, r.top + ((1 - v[1]) / 2) * r.height]
    }

    const start = performance.now()
    let raf = 0
    let knocked = { left: false, right: false }
    let done = false
    let swirl = 0
    let wobble = { t: -10, dir: 0 }
    let manual: { at: number; side: -1 | 1; fired: boolean } | null = null
    taps.current = []

    // timeline (s)
    const T = { rise: 0.9, enter: 1.3, stirEnd: 3.6, knockL: 3.95, knockR: 4.6, exit: 5.1, end: 5.9 }

    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const t = (now - start) / 1000
      const dt = 1 / 60

      // camera drifts slowly around the cup (parallax depth)
      const orbit = Math.sin(t * 0.35) * 0.35
      camera.position.set(Math.sin(orbit) * 6.4, 2.5 + Math.sin(t * 0.5) * 0.1, Math.cos(orbit) * 6.4)
      camera.lookAt([0, 0.05, 0])

      // cup rises into frame with overshoot
      const rise = ease(t / T.rise)
      scene.position.y = lerp(-3, 0, rise) + Math.sin(Math.min(t / T.rise, 1) * Math.PI) * 0.15
      scene.scale.set(lerp(0.6, 1, rise))

      // stirring speed ramps up then down
      const stirAmt = t < T.enter ? 0 : t < T.stirEnd ? Math.min((t - T.enter) / 0.6, 1) : Math.max(0, 1 - (t - T.stirEnd) / 0.8)
      swirl += dt * stirAmt * 9
      liquidProgram.uniforms.uSwirl.value = swirl

      // stick: enters from above, stirs in a circle, then knocks left & right walls
      const theta = swirl * 0.9
      let tipX = Math.cos(theta) * 0.38
      let tipZ = Math.sin(theta) * 0.38
      let tipY = LIQ_TOP - 0.55
      let lean = -0.42
      if (t < T.enter + 0.4) {
        const k = ease((t - T.enter + 0.4) / 0.8)
        tipY = lerp(4.5, tipY, k)
        tipX = lerp(1.6, tipX, k)
      }
      const strike = (tStart: number, side: -1 | 1) => {
        const k = (t - tStart) / 0.16
        if (k < -1.4 || k > 2.2) return null
        // anticipation (pull back) → snap to the wall → rebound
        if (k < 0) return lerp(0, -side * 0.25, ease(k + 1.4))
        if (k < 1) return lerp(-side * 0.25, side * (rAt(LIQ_TOP) - 0.1), k * k)
        return lerp(side * (rAt(LIQ_TOP) - 0.1), side * 0.2, ease(k - 1))
      }
      const sL = strike(T.knockL, -1)
      const sR = strike(T.knockR, 1)
      if (sL !== null || sR !== null) {
        tipX = (sL ?? sR)!
        tipZ = 0.15
        lean = (sL !== null ? 0.35 : -0.5)
      }
      // after the demo the stirrer waits just above the rim, ready for the visitor's taps
      if (t > T.exit) {
        const k = ease((t - T.exit) / 0.6)
        tipY = lerp(tipY, LIQ_TOP + 0.45 + Math.sin(t * 2.2) * 0.06, k)
        tipX = lerp(tipX, 0, k)
        tipZ = lerp(tipZ, 0.1, k)
        lean = lerp(lean, -0.15, k)
      }
      if (t > T.end) {
        if (!manual && taps.current.length) manual = { at: t + 0.23, side: taps.current.shift() === 'left' ? -1 : 1, fired: false }
        if (manual) {
          const sx = strike(manual.at, manual.side)
          if (sx !== null) {
            tipX = sx
            tipY = LIQ_TOP - 0.3
            tipZ = 0.15
            lean = manual.side < 0 ? 0.35 : -0.5
          }
          if (!manual.fired && t >= manual.at + 0.16) {
            manual.fired = true
            const side = manual.side < 0 ? 'left' : 'right'
            wobble = { t, dir: manual.side < 0 ? 1 : -1 }
            ice.forEach((c) => (c.jump = t))
            cb.current.onKnock(side, project(manual.side * R_TOP, 0.9, 0))
          }
          if (t > manual.at + 0.5) manual = null
        }
      }
      stickPivot.position.set(tipX, tipY, tipZ)
      stickPivot.rotation.z = lean
      stickPivot.rotation.x = -0.25 + Math.sin(t * 3) * 0.05

      for (const [side, at] of [['left', T.knockL + 0.16], ['right', T.knockR + 0.16]] as const) {
        if (!knocked[side] && t >= at) {
          knocked[side] = true
          wobble = { t, dir: side === 'left' ? 1 : -1 }
          ice.forEach((c) => (c.jump = t))
          cb.current.onKnock(side, project(side === 'left' ? -R_TOP : R_TOP, 0.9, 0))
        }
      }

      // glass wobble after each hit (damped spring)
      const wt = t - wobble.t
      cup.rotation.z = wt < 3 ? wobble.dir * 0.18 * Math.exp(-wt * 5) * Math.sin(wt * 22) : 0
      cup.scale.set(1, wt < 0.4 ? 1 - Math.sin((wt / 0.4) * Math.PI) * 0.06 : 1, 1)

      // ice rides the vortex and bobs; hops on every knock
      ice.forEach((c, i) => {
        const a = c.phase + swirl * 0.5
        const jt = t - c.jump
        const hop = jt > 0 && jt < 0.6 ? Math.sin((jt / 0.6) * Math.PI) * (0.5 + i * 0.08) : 0
        c.m.position.set(Math.cos(a) * c.r, LIQ_TOP + 0.02 + Math.sin(t * 2 + i) * 0.03 + hop, Math.sin(a) * c.r)
        c.m.rotation.set(t * c.spin * 0.4 + hop * 2, a * 1.3, hop)
      })

      renderer.render({ scene, camera })

      if (!done && t > T.end) {
        done = true
        cb.current.onDone()
      }
    }
    raf = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      canvas.remove()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
  }, [run])

  return (
    // caller's className may position it (absolute…) — only fall back to relative when it doesn't
    <div ref={hostRef} className={className || 'relative'}>
      {fallback && <img src={cupImg} alt="Pletok Original" className="absolute inset-0 m-auto h-[85%] animate-bounce object-contain" />}
    </div>
  )
}

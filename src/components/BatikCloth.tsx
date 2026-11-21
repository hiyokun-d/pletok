import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Geometry, Mesh, Program, Renderer, Texture } from 'ogl'
import { BATIK, Batik, Tumpal, type BatikKind } from './BetawiPattern'

/*
 * Full-screen kain batik that behave like cloth, for the grand opening's last 20 s.
 *
 * The physics is Verlet cloth (Jakobsen, "Advanced Character Physics", 2001), the same trick games use:
 *   - the cloth is a grid of points; each remembers where it is and where it was a step ago, so its
 *     velocity is implicit (pos - prev) and the integration stays stable even with big steps
 *   - gravity and a gusting wind push every point; then distance constraints between neighbours
 *     (straight, diagonal and two-apart for stiffness) are relaxed a few times to stop it stretching
 *   - the top row is pinned to an invisible rod: drop the rod and the cloth swings in, unpin it and
 *     it falls away
 * It runs in screen pixels with depth (z) for the wind, and is drawn as one WebGL mesh: the batik is
 * the texture, the fold normals light it so the ripples read as real fabric. ~1–2 ms a frame.
 *
 * Lite phones (and no WebGL) get the same kain as flat pictures sliding in, no simulation.
 */

/** traditional colourways: sogan browns for the Javanese court patterns, Cirebon's indigo, songket red & gold */
const PALETTE: Record<BatikKind, { bg: string; ink: string; edge: string }> = {
  kawung: { bg: '#5a2e1a', ink: '#ecdcc5', edge: '#2b160c' },
  parang: { bg: '#7a4a24', ink: '#f1d3a8', edge: '#2b160c' },
  megamendung: { bg: '#1f3b63', ink: '#cfe0f2', edge: '#0f1f38' },
  truntum: { bg: '#24283d', ink: '#f1e6c8', edge: '#12141f' },
  songket: { bg: '#7a1f24', ink: '#e6b84a', edge: '#3d0d10' },
  ceplok: { bg: '#3f5226', ink: '#efe3c2', edge: '#1f2a12' },
  gigibalang: { bg: '#a8572a', ink: '#2b160c', edge: '#5a2e1a' },
  tumpal: { bg: '#4a2414', ink: '#c98a3c', edge: '#1f0f07' },
}

const vertex = /* glsl */ `
attribute vec3 position;
attribute vec3 normal;
attribute vec2 uv;
uniform vec2 uRes;
varying vec2 vUv;
varying vec3 vN;
void main() {
  // simple perspective around the screen centre: z > 0 is further away
  float s = 1100.0 / (1100.0 + position.z);
  vec2 c = uRes * 0.5;
  vec2 p = c + (position.xy - c) * s;
  gl_Position = vec4(p.x / uRes.x * 2.0 - 1.0, 1.0 - p.y / uRes.y * 2.0, 0.0, 1.0);
  vUv = uv;
  vN = normal;
}`

const fragment = /* glsl */ `
precision highp float;
uniform sampler2D tMap;
varying vec2 vUv;
varying vec3 vN;
void main() {
  vec3 n = normalize(vN);
  float d = abs(dot(n, normalize(vec3(-0.35, -0.55, -1.0))));
  vec3 col = texture2D(tMap, vUv).rgb;
  // folds facing away go dark, faces toward the light get a soft silk sheen
  gl_FragColor = vec4(col * (0.42 + 0.68 * d) + pow(d, 24.0) * 0.16, 1.0);
}`

/** one kain as SVG: the pattern field between two tumpal "kepala" borders, like a real kain panjang */
function Kain({ kind, w, h, svgRef }: { kind: BatikKind; w: number; h: number; svgRef?: (el: SVGSVGElement | null) => void }) {
  const p = PALETTE[kind]
  const band = Math.round(h * 0.085)
  const tumpal = Math.round((band * 0.8) / 1.6)
  return (
    <svg ref={svgRef} xmlns="http://www.w3.org/2000/svg" width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
      <rect width={w} height={h} fill={p.bg} />
      <svg x={0} y={band} width={w} height={h - band * 2}>
        <Batik kind={kind} color={p.ink} size={Math.round(w / 11)} />
      </svg>
      {[0, 1].map((end) => (
        <g key={end} transform={end ? `translate(0 ${h}) scale(1 -1)` : undefined}>
          <rect width={w} height={band} fill={p.edge} />
          <svg x={0} y={band * 0.1} width={w} height={band * 0.8}>
            <Tumpal color={p.ink} accent={p.edge} size={tumpal} />
          </svg>
          <rect y={band - 6} width={w} height={3} fill={p.ink} />
          <rect y={band + 4} width={w} height={2} fill={p.ink} opacity={0.6} />
        </g>
      ))}
    </svg>
  )
}

const svgToCanvas = (svg: SVGSVGElement, w: number, h: number) =>
  new Promise<HTMLCanvasElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = w
      c.height = h
      c.getContext('2d')!.drawImage(img, 0, 0, w, h)
      resolve(c)
    }
    img.onerror = reject
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(new XMLSerializer().serializeToString(svg))
  })

/**
 * the kain, one after another every `every` ms. Mount it early with `show` false: the textures and the
 * cloth motion are prepared in the background, then `show` starts the show straight away.
 */
export function BatikCloth({ lite, show, every = 1600 }: { lite: boolean; show: boolean; every?: number }) {
  const host = useRef<HTMLDivElement>(null)
  const showRef = useRef(show)
  showRef.current = show
  const svgs = useRef<(SVGSVGElement | null)[]>([])
  const [current, setCurrent] = useState(0)
  const [flat, setFlat] = useState(lite)
  const W = window.innerWidth
  const H = window.innerHeight
  // texture size: screen-shaped, bounded so a tall phone doesn't upload a huge image
  const TW = 768
  const TH = Math.min(1400, Math.round((TW * H) / W))

  // which kain is up: the overlay caption follows it, and the flat fallback swaps on it
  useEffect(() => {
    if (!show) return
    const t = window.setInterval(() => setCurrent((c) => c + 1), every)
    return () => window.clearInterval(t)
  }, [every, show])

  useEffect(() => {
    if (flat) return
    let renderer: Renderer
    try {
      renderer = new Renderer({ dpr: Math.min(window.devicePixelRatio, 1.25), alpha: true, antialias: false })
      if (!renderer.gl) throw new Error('WebGL unavailable')
    } catch {
      setFlat(true)
      return
    }
    const gl = renderer.gl
    const canvas = gl.canvas as HTMLCanvasElement
    canvas.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none'
    // first child: the vignette and the caption sit on top of the cloth
    host.current!.prepend(canvas)
    renderer.setSize(W, H)

    // ---- grid: a little bigger than the screen so the edges never show when it billows
    const portrait = H > W
    const NX = portrait ? 22 : 34
    const NY = portrait ? 38 : 24
    const CW = W * 1.12
    const CH = H * 1.1
    const x0 = (W - CW) / 2
    const N = NX * NY
    const restPos = new Float32Array(N * 3)
    const uv = new Float32Array(N * 2)
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const k = j * NX + i
        restPos[k * 3] = x0 + (i / (NX - 1)) * CW
        restPos[k * 3 + 1] = (j / (NY - 1)) * CH
        uv[k * 2] = i / (NX - 1)
        uv[k * 2 + 1] = 1 - j / (NY - 1)
      }
    const index = new Uint16Array((NX - 1) * (NY - 1) * 6)
    let q = 0
    for (let j = 0; j < NY - 1; j++)
      for (let i = 0; i < NX - 1; i++) {
        const a = j * NX + i
        index.set([a, a + 1, a + NX, a + NX, a + 1, a + NX + 1], q)
        q += 6
      }
    // constraints: neighbours (structure), diagonals (shear), two apart (bending)
    const pairs: number[] = []
    const link = (a: number, b: number) => pairs.push(a, b)
    for (let j = 0; j < NY; j++)
      for (let i = 0; i < NX; i++) {
        const a = j * NX + i
        if (i < NX - 1) link(a, a + 1)
        if (j < NY - 1) link(a, a + NX)
        if (i < NX - 1 && j < NY - 1) (link(a, a + NX + 1), link(a + 1, a + NX))
        if (i < NX - 2) link(a, a + 2)
        if (j < NY - 2) link(a, a + NX * 2)
      }
    const C = new Int32Array(pairs)
    const rest = new Float32Array(C.length / 2)
    for (let c = 0; c < rest.length; c++) {
      const a = C[c * 2] * 3
      const b = C[c * 2 + 1] * 3
      rest[c] = Math.hypot(restPos[a] - restPos[b], restPos[a + 1] - restPos[b + 1])
    }

    // ---- textures, drawn from the hidden SVG kain below
    const textures: Texture[] = []
    let alive = true
    void Promise.all(
      BATIK.map((_, k) =>
        svgToCanvas(svgs.current[k]!, TW, TH).then((img) => {
          textures[k] = new Texture(gl, { image: img, generateMipmaps: false, minFilter: gl.LINEAR, magFilter: gl.LINEAR, wrapS: gl.CLAMP_TO_EDGE, wrapT: gl.CLAMP_TO_EDGE, flipY: true })
        }),
      ),
    ).catch(() => alive && setFlat(true))

    // ---- the physics, run ahead of time. One cloth's whole life — drops in, hangs in the wind, lets go,
    // falls — is simulated while the count is still at 30→20 s (a few frames' work at a time so nothing
    // stutters), and every frame's shape is stored. During the show a phone only copies stored frames
    // to the GPU: no physics at all while it plays. Two lives with different wind, taken in turn.
    const FPS = 60
    const HOLD = every / 1000
    const LIFE = HOLD + 1.6 // hanging, then 1.6 s to fall off the bottom
    const FRAMES = Math.ceil(LIFE * FPS)
    const STRIDE = N * 6 // per frame: positions (3N) then normals (3N)
    const baked = [new Float32Array(FRAMES * STRIDE), new Float32Array(FRAMES * STRIDE)]
    const bakedUpTo = [0, 0]

    const G = 2300 // px/s²
    const DROP = 0.75 // s for the rod to come down
    const bake = (v: 0 | 1) => {
      const pos = new Float32Array(restPos)
      for (let p = 1; p < pos.length; p += 3) pos[p] -= CH + 60 // starts hanging above the screen
      const prev = new Float32Array(pos)
      const out = baked[v]
      const phase = v * 3.7
      const sub = (age: number, dt: number) => {
        const t = age + phase
        const gust = 0.6 + 0.4 * Math.sin(t * 0.9) + 0.25 * Math.sin(t * 2.3)
        for (let k = 0; k < N; k++) {
          const p = k * 3
          const x = pos[p]
          const y = pos[p + 1]
          const z = pos[p + 2]
          const lower = ((k / NX) | 0) / (NY - 1)
          // wind mostly pushes through the cloth (z) in travelling waves, more at the free bottom
          const az = 1500 * gust * lower * (Math.sin(t * 2.6 + x * 0.006 + y * 0.004) + 0.55 * Math.sin(t * 4.1 - y * 0.009 + x * 0.003))
          const ax = 160 * Math.sin(t * 1.1 + y * 0.004)
          const vx = (x - prev[p]) * 0.985
          const vy = (y - prev[p + 1]) * 0.985
          const vz = (z - prev[p + 2]) * 0.97
          prev[p] = x
          prev[p + 1] = y
          prev[p + 2] = z
          pos[p] = x + vx + ax * dt * dt
          pos[p + 1] = y + vy + G * dt * dt
          pos[p + 2] = z + vz + az * dt * dt
        }
        // the rod eases down to just above the screen top and holds the top row — until it lets go
        const pinned = age < HOLD
        const rodY = -(CH + 60) * (1 - Math.min(1, age / DROP)) ** 3 - H * 0.03
        for (let it = 0; it < 5; it++) {
          if (pinned)
            for (let i = 0; i < NX; i++) {
              pos[i * 3] = restPos[i * 3]
              pos[i * 3 + 1] = rodY
              pos[i * 3 + 2] = 0
            }
          for (let c = 0; c < rest.length; c++) {
            const a = C[c * 2] * 3
            const b = C[c * 2 + 1] * 3
            const dx = pos[b] - pos[a]
            const dy = pos[b + 1] - pos[a + 1]
            const dz = pos[b + 2] - pos[a + 2]
            const d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1
            const f = ((d - rest[c]) / d) * 0.5
            pos[a] += dx * f
            pos[a + 1] += dy * f
            pos[a + 2] += dz * f
            pos[b] -= dx * f
            pos[b + 1] -= dy * f
            pos[b + 2] -= dz * f
          }
        }
      }
      const store = (f: number) => {
        const o = f * STRIDE
        out.set(pos, o)
        // fold normals for the lighting, from each point's neighbours
        for (let j = 0; j < NY; j++)
          for (let i = 0; i < NX; i++) {
            const l = (j * NX + Math.max(0, i - 1)) * 3
            const r = (j * NX + Math.min(NX - 1, i + 1)) * 3
            const u = (Math.max(0, j - 1) * NX + i) * 3
            const d = (Math.min(NY - 1, j + 1) * NX + i) * 3
            const ax = pos[r] - pos[l], ay = pos[r + 1] - pos[l + 1], az = pos[r + 2] - pos[l + 2]
            const bx = pos[d] - pos[u], by = pos[d + 1] - pos[u + 1], bz = pos[d + 2] - pos[u + 2]
            const k = o + N * 3 + (j * NX + i) * 3
            out[k] = ay * bz - az * by
            out[k + 1] = az * bx - ax * bz
            out[k + 2] = ax * by - ay * bx
          }
      }
      let f = 0
      return () => {
        // ~6 ms of work per slice, so the countdown never drops a frame while this runs
        const until = performance.now() + 6
        for (; f < FRAMES && performance.now() < until; f++) {
          const age = f / FPS
          sub(age, 0.5 / FPS)
          sub(age + 0.5 / FPS, 0.5 / FPS)
          store(f)
        }
        bakedUpTo[v] = f
        return f >= FRAMES
      }
    }
    const jobs = [bake(0), bake(1)]
    let job = 0
    let bakeTimer = 0
    const work = () => {
      if (!alive) return
      if (jobs[job]()) job++
      if (job < jobs.length) bakeTimer = window.setTimeout(work, 16)
    }
    bakeTimer = window.setTimeout(work, 0)

    interface Playing {
      born: number
      v: 0 | 1
      mesh: Mesh
      geo: Geometry
    }
    const cloths: Playing[] = []
    const spawn = (k: number, now: number, v: 0 | 1) => {
      const geo = new Geometry(gl, {
        position: { size: 3, data: new Float32Array(N * 3) },
        normal: { size: 3, data: new Float32Array(N * 3) },
        uv: { size: 2, data: uv },
        index: { data: index },
      })
      const program = new Program(gl, { vertex, fragment, cullFace: false, depthTest: false, depthWrite: false, uniforms: { tMap: { value: textures[k % BATIK.length] }, uRes: { value: [W, H] } } })
      cloths.push({ born: now, v, mesh: new Mesh(gl, { geometry: geo, program, frustumCulled: false }), geo })
    }

    let lost = false
    const onLost = (e: Event) => (e.preventDefault(), (lost = true))
    canvas.addEventListener('webglcontextlost', onLost)

    let raf = 0
    let last = performance.now()
    let t = 0
    let next = 0
    let shown = 0
    const loop = (now: number) => {
      raf = requestAnimationFrame(loop)
      const frame = Math.min((now - last) / 1000, 1 / 20)
      last = now
      if (lost || document.hidden || !showRef.current) return
      t += frame
      // next kain drops in behind the one that is letting go (its fall is in the stored frames)
      // the second wind is a bonus: if a slow phone hasn't finished it, the first one plays again
      const v = (bakedUpTo[1] >= FRAMES ? shown % 2 : 0) as 0 | 1
      if (t >= next && textures[shown % BATIK.length] && bakedUpTo[v] >= FRAMES) {
        spawn(shown, t, v)
        shown++
        next = t + HOLD
      }
      for (let k = cloths.length - 1; k >= 0; k--) {
        const cl = cloths[k]
        const f = Math.round((t - cl.born) * FPS)
        if (f >= FRAMES) {
          cl.geo.remove()
          cl.mesh.program.remove()
          cloths.splice(k, 1)
          continue
        }
        const o = f * STRIDE
        const src = baked[cl.v]
        ;(cl.geo.attributes.position.data as Float32Array).set(src.subarray(o, o + N * 3))
        ;(cl.geo.attributes.normal.data as Float32Array).set(src.subarray(o + N * 3, o + STRIDE))
        cl.geo.attributes.position.needsUpdate = true
        cl.geo.attributes.normal.needsUpdate = true
      }
      // the newest hangs at the back; the older one falls in front of it
      ;[...cloths].sort((a, b) => a.born - b.born).reverse().forEach((cl, k) => renderer.render({ scene: cl.mesh, clear: k === 0 }))
    }
    raf = requestAnimationFrame(loop)

    return () => {
      alive = false
      window.clearTimeout(bakeTimer)
      cancelAnimationFrame(raf)
      canvas.removeEventListener('webglcontextlost', onLost)
      canvas.remove()
      gl.getExtension('WEBGL_lose_context')?.loseContext()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flat])

  const now = BATIK[current % BATIK.length]
  return (
    <motion.div ref={host} className="pointer-events-none absolute inset-0 overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: show ? 1 : 0 }} exit={{ opacity: 0, transition: { duration: 0.3 } }}>
      {/* the kain as SVG, off-screen: the source of the textures (and of the flat fallback) */}
      <div aria-hidden className="absolute size-0 overflow-hidden">
        {BATIK.map((b, k) => (
          <Kain key={b.kind} kind={b.kind} w={TW} h={TH} svgRef={(el) => (svgs.current[k] = el)} />
        ))}
      </div>

      {flat && show && (
        <AnimatePresence>
          <motion.div
            key={current}
            className="absolute inset-0 [&>svg]:size-full"
            initial={{ y: '-100%', skewY: -3 }}
            animate={{ y: '0%', skewY: [3, -1.5, 0] }}
            exit={{ y: '100%', transition: { duration: 0.6, ease: [0.5, 0, 0.75, 0] } }}
            transition={{ duration: 0.8, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <Kain kind={now.kind} w={TW} h={TH} />
          </motion.div>
        </AnimatePresence>
      )}

      {/* keep the middle calm so the number reads */}
      <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse at 50% 46%, rgb(20 10 5 / 0.88) 20%, rgb(20 10 5 / 0.45) 52%, transparent 82%)' }} />

      {/* which cloth this is */}
      <div className="absolute inset-x-0 bottom-[11vh] grid place-items-center">
        <AnimatePresence mode="wait">
          <motion.span
            key={current}
            className="rounded-full bg-[#1f0f07]/75 px-[2vh] py-[0.6vh] font-cond text-[clamp(0.9rem,2.2vh,1.3rem)] font-semibold uppercase italic tracking-[0.3em] text-yakult"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0, transition: { delay: 0.35 } }}
            exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
          >
            {now.name} · {now.from}
          </motion.span>
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

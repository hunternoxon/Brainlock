import { useEffect, useRef } from 'react'

/**
 * Page background behind the home card: a fine grid of semicircle-in-square
 * tiles (concentric arcs, white hairlines on near-black).
 * Rest: static-electricity flicker; tiles occasionally twitch to a new orientation.
 * On a selection change: a plasma-ball "touch". Tendrils and brightening rings
 * reach toward the last tap, then retract as it releases.
 */
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uTile;
uniform vec2 uTouch;
uniform float uSpike;
uniform float uRest;

float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

void main() {
  vec2 px = gl_FragCoord.xy;
  vec2 cell = floor(px / uTile);
  vec2 p = fract(px / uTile);
  float r = h(cell);

  // Plasma touch: distance / angle from the touch point
  vec2 tp = px - uTouch;
  float dist = length(tp) / min(uRes.x, uRes.y);
  float ang = atan(tp.y, tp.x);
  float reach = 0.08 + uSpike * 0.75;
  float near = smoothstep(reach, reach * 0.15, dist) * uSpike;
  float tendrils = pow(abs(sin(ang * 4.0 + sin(uTime * 9.0 + ang * 3.0) * 1.3 + dist * 14.0 - uTime * 5.0)), 22.0);
  tendrils = max(tendrils, pow(abs(sin(ang * 7.0 - uTime * 3.0 + dist * 9.0)), 40.0));

  // Static: each tile occasionally snaps to a new orientation (faster when charged)
  float epoch = floor(uTime * (0.3 + near * 6.0) + r * 9.0);
  float o = floor(h(cell + epoch * 1.37) * 4.0);
  vec2 q = p - 0.5;
  if (o == 1.0) q = vec2(-q.y, q.x);
  else if (o == 2.0) q = -q;
  else if (o == 3.0) q = vec2(q.y, -q.x);
  q += 0.5;

  // Concentric semicircles centred on one edge of the square
  float d = length(q - vec2(0.5, 0.0));
  float rings = 4.0;
  float f = d * rings * 2.0 - near * uTime * 2.0;
  float lineD = abs(fract(f) - 0.5) / (rings * 2.0);
  float lw = 0.55 / uTile;
  float aa = 1.0 / uTile;
  float line = (1.0 - smoothstep(lw, lw + aa, lineD)) * step(d, 0.5);

  // Static flicker + rare sparks
  float flick = h(cell + floor(uTime * 14.0));
  float spark = step(0.994, flick) * 0.35;
  float base = uRest * (0.7 + 0.3 * flick) + spark * uRest * 3.0;
  float energy = near * (0.25 + 0.75 * tendrils);
  float a = clamp(line * (base + energy), 0.0, 1.0);
  gl_FragColor = vec4(mix(vec3(0.02, 0.02, 0.025), vec3(1.0), a), 1.0);
}
`
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'
const TILE_CSS_PX = 22

export function Field({ pulse }: { pulse: unknown }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const trigger = useRef<number | null>(null)
  const touch = useRef<[number, number] | null>(null)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    trigger.current = performance.now()
  }, [pulse])

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' })
    if (!gl) {
      canvas.dataset.fallback = ''
      return
    }
    const sh = (type: number, src: string) => {
      const s = gl.createShader(type)!
      gl.shaderSource(s, src)
      gl.compileShader(s)
      return s
    }
    const prog = gl.createProgram()!
    gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT))
    gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG))
    gl.linkProgram(prog)
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
      canvas.dataset.fallback = ''
      return
    }
    gl.useProgram(prog)
    const buf = gl.createBuffer()
    gl.bindBuffer(gl.ARRAY_BUFFER, buf)
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
    const loc = gl.getAttribLocation(prog, 'p')
    gl.enableVertexAttribArray(loc)
    gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0)
    const U = (n: string) => gl.getUniformLocation(prog, n)
    const uRes = U('uRes'), uTime = U('uTime'), uTile = U('uTile'), uTouch = U('uTouch'), uSpike = U('uSpike'), uRest = U('uRest')
    gl.uniform1f(uRest, 0.1)

    let scale = 1
    const resize = () => {
      scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTile, TILE_CSS_PX * scale)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const onDown = (e: PointerEvent) => {
      touch.current = [e.clientX, e.clientY]
    }
    window.addEventListener('pointerdown', onDown, { passive: true })

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    let last = 0
    const frame = (now: number) => {
      // Touch → quick charge (120 ms) → release (~1 s)
      let spike = 0
      if (trigger.current !== null) {
        const t = (now - trigger.current) / 1000
        spike = t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * 3.2)
        if (spike < 0.005 && t > 0.2) trigger.current = null
      }
      // Static at rest is stepped anyway: ~15 fps; every frame while charged
      if (spike > 0 || now - last > 66) {
        last = now
        const [cx, cy] = touch.current ?? [window.innerWidth / 2, window.innerHeight * 0.35]
        gl.uniform2f(uTouch, cx * scale, (window.innerHeight - cy) * scale)
        gl.uniform1f(uSpike, spike)
        gl.uniform1f(uTime, (now - start) / 1000)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      raf = requestAnimationFrame(frame)
    }
    if (reduced) {
      gl.uniform1f(uTime, 7)
      gl.uniform1f(uSpike, 0)
      gl.uniform2f(uTouch, 0, 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    } else raf = requestAnimationFrame(frame)
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) raf = requestAnimationFrame(frame)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('pointerdown', onDown)
      document.removeEventListener('visibilitychange', onVis)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [])

  return <canvas ref={ref} className="field-bg" aria-hidden="true" />
}

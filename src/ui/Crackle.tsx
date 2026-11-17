import { useEffect, useRef } from 'react'

/**
 * Crackle-paint background (loosely after a black/white crackle bike frame):
 * big Voronoi cells with a finer crack web inside, slowly drifting. Each
 * settings change bumps the energy: cracks darken, widen and shift faster,
 * then settle back.
 */
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uEnergy;
uniform vec3 uBase;
uniform vec3 uInk;
uniform float uRest;

vec2 hash2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Distance to the nearest Voronoi border (Inigo Quilez)
float border(vec2 x, float t) {
  vec2 n = floor(x), f = fract(x), mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 o = 0.5 + 0.42 * sin(t + 6.2831 * hash2(n + g));
    vec2 r = g + o - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 o = 0.5 + 0.42 * sin(t + 6.2831 * hash2(n + g));
    vec2 r = g + o - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return md;
}

void main() {
  vec2 uv = gl_FragCoord.xy / min(uRes.x, uRes.y);
  float e = uEnergy;
  // Wobbly, hand-cracked lines
  uv += 0.02 * vec2(sin(uv.y * 9.0 + uTime * 0.15), cos(uv.x * 8.0 - uTime * 0.12)) * (1.0 + e * 2.5);
  // Jagged, angular crack edges (crackle paint, not honeycomb)
  uv += 0.006 * vec2(sin(uv.y * 83.0 + uv.x * 17.0), cos(uv.x * 71.0 - uv.y * 23.0));
  float t = uTime * (0.05 + 0.6 * e);
  float big = border(uv * 3.2, t);
  float fine = border(uv * 9.5 + 7.0, t * 0.7 + 3.0);
  float w = 0.008 + 0.022 * e;
  float lines = 1.0 - smoothstep(w, w + 0.012, big);
  lines = max(lines, (1.0 - smoothstep(0.003, 0.010 + 0.008 * e, fine)) * 0.5);
  float amount = lines * (uRest + (0.85 - uRest) * e);
  gl_FragColor = vec4(mix(uBase, uInk, amount), 1.0);
}
`
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'

const hex = (c: string): [number, number, number] => {
  const m = c.trim().match(/^#?([0-9a-f]{3}|[0-9a-f]{6})$/i)
  if (!m) return [1, 1, 1]
  const h = m[1].length === 3 ? m[1].split('').map((x) => x + x).join('') : m[1]
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
}

export function Crackle({ pulse }: { pulse: unknown }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const energy = useRef(0)
  const first = useRef(true)

  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    energy.current = 1
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
    const uRes = U('uRes'), uTime = U('uTime'), uEnergy = U('uEnergy'), uBase = U('uBase'), uInk = U('uInk'), uRest = U('uRest')

    const css = getComputedStyle(document.documentElement)
    const dark = window.matchMedia('(prefers-color-scheme: dark)')
    const colors = () => {
      gl.uniform3fv(uBase, hex(css.getPropertyValue('--paper') || '#fff'))
      gl.uniform3fv(uInk, hex(css.getPropertyValue('--ink-strong') || '#111'))
      gl.uniform1f(uRest, dark.matches ? 0.28 : 0.1)
    }
    colors()
    dark.addEventListener('change', colors)

    const resize = () => {
      const s = Math.min(window.devicePixelRatio || 1, 2) * 0.5
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * s))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * s))
      gl.viewport(0, 0, canvas.width, canvas.height)
      gl.uniform2f(uRes, canvas.width, canvas.height)
    }
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const start = performance.now()
    let raf = 0
    let last = 0
    let lastT = start
    const draw = (now: number) => {
      const dt = (now - lastT) / 1000
      lastT = now
      energy.current = Math.max(0, energy.current - dt * 0.9)
      // Calm: ~20fps; while energised: every frame
      if (energy.current > 0.01 || now - last > 50) {
        last = now
        gl.uniform1f(uTime, (now - start) / 1000)
        gl.uniform1f(uEnergy, energy.current * energy.current * (3 - 2 * energy.current))
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      raf = requestAnimationFrame(draw)
    }
    if (reduced) {
      gl.uniform1f(uTime, 12)
      gl.uniform1f(uEnergy, 0)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    } else raf = requestAnimationFrame(draw)
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden && !reduced) raf = requestAnimationFrame(draw)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      dark.removeEventListener('change', colors)
      document.removeEventListener('visibilitychange', onVis)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [])

  return <canvas ref={ref} className="crackle" aria-hidden="true" />
}

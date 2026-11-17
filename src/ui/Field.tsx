import { useEffect, useRef } from 'react'

/**
 * Page background behind the home card, in the same visual language as the
 * Land / Miss screens: a slow greyscale tunnel whose walls are lined with
 * semicircle-in-square tiles, with fog, grain and static flicker.
 * A selection change gives a Land-style rush forward, then a small Miss-style
 * melt that recovers.
 */
const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uTravel;
uniform float uSpike;
uniform float uMelt;
uniform float uRest;

const float PI = 3.14159265;
float h(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Semicircle-in-square tile, returns line coverage
float tile(vec2 tc, float lw) {
  vec2 cell = floor(tc);
  vec2 p = fract(tc);
  float epoch = floor(uTime * (0.25 + uSpike * 5.0) + h(cell) * 9.0);
  float o = floor(h(cell + epoch * 1.37) * 4.0);
  vec2 q = p - 0.5;
  if (o == 1.0) q = vec2(-q.y, q.x);
  else if (o == 2.0) q = -q;
  else if (o == 3.0) q = vec2(q.y, -q.x);
  q += 0.5;
  float d = length(q - vec2(0.5, 0.0));
  float lineD = abs(fract(d * 8.0) - 0.5) / 8.0;
  return (1.0 - smoothstep(lw, lw * 2.2, lineD)) * step(d, 0.5);
}

// One trippy tunnel layer: spiral twist, breathing kaleidoscope, tile-lined walls
float layer(vec2 uv, float spin, float dens, float segs, float off) {
  float r = length(uv);
  r *= 1.0 + 0.07 * sin(atan(uv.y, uv.x) * 5.0 + uTime * 0.4 + off);
  float a = atan(uv.y, uv.x) + spin * (0.25 * sin(uTime * 0.11 + off) + 0.55 / (r + 0.25) * sin(uTime * 0.07 + off));
  float s = PI / segs;
  float m = mod(abs(a), 2.0 * s);
  float u = abs(m - s) / s;
  float depth = 0.32 / max(r, 0.02) + uTravel * (1.0 + 0.3 * off);
  depth += sin(a * 3.0 + uTime * 0.6) * 0.06;
  return tile(vec2(u * dens, depth * dens), 0.025) * smoothstep(0.03, 0.55, r);
}

float scene(vec2 uv) {
  float segs = 7.0 + 2.0 * sin(uTime * 0.05);
  float l1 = layer(uv, 1.0, 6.0, segs, 0.0);
  // Counter-rotating second skin: interference moiré
  float l2 = layer(uv * 1.08, -1.4, 4.5, segs + 2.0, 1.7);
  return max(l1, l2 * 0.75) + l1 * l2 * 0.6;
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  vec2 uv = (frag - 0.5 * uRes) / min(uRes.x, uRes.y);

  // Miss language: columns sag and drip after a surge, then recover
  float x = frag.x / uRes.x;
  float drip = pow(clamp(0.5 + 0.5 * sin(x * 23.0 + sin(x * 9.0) * 2.0) * sin(x * 7.3 + 1.7), 0.0, 1.0), 2.0);
  uv.y += uMelt * drip * 0.18;
  // Slow breathing zoom; a little lurch when charged (land rush)
  uv *= 1.0 - 0.06 * sin(uTime * 0.21) - uSpike * 0.12;

  // Greyscale echo ghost (trippy afterimage)
  float line = scene(uv) * 0.75 + scene(uv * (1.035 + uSpike * 0.04)) * 0.4;

  vec2 tc = floor(uv * 40.0);
  float flick = h(tc + floor(uTime * 12.0));
  float lum = line * (uRest * (0.7 + 0.3 * flick) + uSpike * 0.35);
  float r = length(uv);
  lum += 0.0012 / (r * r + 0.006) * (0.5 + uSpike);

  vec2 sp = frag / uRes;
  float vig = 1.0 - 0.45 * smoothstep(0.4, 1.1, length(sp - 0.5) * 1.3);
  float g = (0.02 + lum) * vig;
  g += (h(frag + fract(uTime * 7.0) * 113.0) - 0.5) * 0.07;
  gl_FragColor = vec4(vec3(clamp(g, 0.0, 1.0)), 1.0);
}
`
const VERT = 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'

export function Field({ pulse }: { pulse: unknown }) {
  const ref = useRef<HTMLCanvasElement>(null)
  const trigger = useRef<number | null>(null)
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
    const uRes = U('uRes'), uTime = U('uTime'), uTravel = U('uTravel'), uSpike = U('uSpike'), uMelt = U('uMelt'), uRest = U('uRest')
    gl.uniform1f(uRest, 0.14)

    let scale = 1
    const resize = () => {
      scale = Math.min(window.devicePixelRatio || 1, 2)
      canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale))
      canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale))
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
    let travel = 0
    const frame = (now: number) => {
      const dt = Math.min(0.1, (now - lastT) / 1000)
      lastT = now
      // Selection change: Land-style rush (charge 120 ms, release ~1 s), then a small Miss-style melt that recovers
      let spike = 0
      let melt = 0
      if (trigger.current !== null) {
        const t = (now - trigger.current) / 1000
        spike = t < 0.12 ? t / 0.12 : Math.exp(-(t - 0.12) * 3.2)
        const tm = Math.max(0, t - 0.35)
        melt = tm > 0 ? (1 - Math.exp(-tm * 5)) * Math.exp(-tm * 1.6) : 0
        if (t > 3) trigger.current = null
      }
      travel += dt * (0.04 + spike * 1.4)
      if (spike > 0.002 || melt > 0.002 || now - last > 66) {
        last = now
        gl.uniform1f(uSpike, spike)
        gl.uniform1f(uMelt, melt)
        gl.uniform1f(uTravel, travel)
        gl.uniform1f(uTime, (now - start) / 1000)
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
      }
      raf = requestAnimationFrame(frame)
    }
    if (reduced) {
      gl.uniform1f(uTime, 7)
      gl.uniform1f(uSpike, 0)
      gl.uniform1f(uMelt, 0)
      gl.uniform1f(uTravel, 0)
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
      document.removeEventListener('visibilitychange', onVis)
      gl.deleteBuffer(buf)
      gl.deleteProgram(prog)
    }
  }, [])

  return <canvas ref={ref} className="field-bg" aria-hidden="true" />
}

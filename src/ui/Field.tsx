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
vec2 h2(vec2 p) {
  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
  return fract(sin(p) * 43758.5453);
}

// Crackle network (bike-frame paint): border distance + id of the paint chip
vec3 crack(vec2 x) {
  vec2 n = floor(x), f = fract(x), mg, mr;
  float md = 8.0;
  for (int j = -1; j <= 1; j++)
  for (int i = -1; i <= 1; i++) {
    vec2 g = vec2(float(i), float(j));
    vec2 r = g + 0.15 + 0.7 * h2(n + g) - f;
    float d = dot(r, r);
    if (d < md) { md = d; mr = r; mg = g; }
  }
  md = 8.0;
  for (int j = -2; j <= 2; j++)
  for (int i = -2; i <= 2; i++) {
    vec2 g = mg + vec2(float(i), float(j));
    vec2 r = g + 0.15 + 0.7 * h2(n + g) - f;
    if (dot(mr - r, mr - r) > 0.00001) md = min(md, dot(0.5 * (mr + r), normalize(r - mr)));
  }
  return vec3(md, n + mg);
}

void main() {
  vec2 frag = gl_FragCoord.xy;
  float m = min(uRes.x, uRes.y);

  // Paint chips: jagged crack lines; each chip shifts the pattern slightly (shattered look)
  vec2 cu = frag / (uTile * 7.0);
  cu += 0.03 * vec2(sin(cu.y * 23.0 + cu.x * 7.0), cos(cu.x * 19.0 - cu.y * 5.0));
  cu += 0.008 * vec2(sin(cu.y * 97.0 + cu.x * 31.0), cos(cu.x * 89.0 - cu.y * 41.0));
  vec3 cr = crack(cu);
  vec2 chipShift = (h2(cr.yz) - 0.5) * uTile * 0.35;
  vec2 px = frag + chipShift;

  vec2 cell = floor(px / uTile);
  vec2 p = fract(px / uTile);
  float r = h(cell);

  // Plasma touch
  vec2 tp = frag - uTouch;
  float dist = length(tp) / m;
  float ang = atan(tp.y, tp.x);
  float reach = 0.08 + uSpike * 0.75;
  float near = smoothstep(reach, reach * 0.15, dist) * uSpike;
  float tendrils = pow(abs(sin(ang * 4.0 + sin(uTime * 9.0 + ang * 3.0) * 1.3 + dist * 14.0 - uTime * 5.0)), 22.0);
  tendrils = max(tendrils, pow(abs(sin(ang * 7.0 - uTime * 3.0 + dist * 9.0)), 40.0));

  // Static: tiles snap to new orientations
  float epoch = floor(uTime * (0.3 + near * 6.0) + r * 9.0);
  float o = floor(h(cell + epoch * 1.37) * 4.0);
  vec2 q = p - 0.5;
  if (o == 1.0) q = vec2(-q.y, q.x);
  else if (o == 2.0) q = -q;
  else if (o == 3.0) q = vec2(q.y, -q.x);
  q += 0.5;

  float d = length(q - vec2(0.5, 0.0));
  float rings = 4.0;
  float f = d * rings * 2.0 - near * uTime * 2.0;
  float lineD = abs(fract(f) - 0.5) / (rings * 2.0);
  float lw = 0.6 / uTile;
  float aa = 1.2 / uTile;
  float line = (1.0 - smoothstep(lw, lw + aa, lineD)) * step(d, 0.5);

  // Crack lines: gaps in the pattern with a pale chipped edge
  // Thin, sharp main cracks + fine hairline sub-cracks inside each chip
  float cw = 0.009;
  float crackLine = 1.0 - smoothstep(cw, cw + 0.008, cr.x);
  float fineC = crack(cu * 3.1 + 11.0).x;
  float hair = (1.0 - smoothstep(0.012, 0.022, fineC)) * (1.0 - crackLine);
  float edge = 0.0;
  line *= 1.0 - crackLine;

  float flick = h(cell + floor(uTime * 14.0));
  float spark = step(0.994, flick) * 0.35;
  float base = uRest * (0.7 + 0.3 * flick) + spark * uRest * 3.0;
  float energy = near * (0.25 + 0.75 * tendrils);
  float a = clamp(line * (base + energy) + edge * (0.05 + energy * 0.5), 0.0, 1.0);
  // Faint white crack veins (charged cracks glow a little when touched)
  a = max(a, crackLine * (0.34 + near * 0.5));
  a = max(a, hair * (0.07 + near * 0.2));

  // Photo: uneven soft exposure, vignette, lifted blacks, grain (greyscale)
  vec2 sp = frag / uRes;
  float light = 0.95 + 0.4 * smoothstep(0.9, 0.0, length(sp - vec2(0.3 + 0.1 * sin(uTime * 0.05), 0.75)));
  float vig = 1.0 - 0.35 * smoothstep(0.45, 1.1, length(sp - 0.5) * 1.3);
  float g = 0.025 + a * light;
  g *= vig;
  float grain = h(frag + fract(uTime * 7.0) * 113.0) - 0.5;
  g += grain * 0.09;
  gl_FragColor = vec4(vec3(clamp(g, 0.0, 1.0)), 1.0);
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
    gl.uniform1f(uRest, 0.12)

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

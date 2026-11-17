/**
 * Tunnel engine, ported from the hunternoxon.com design kit (import/design-kit/code/tunnel.ts).
 * Shader unchanged; the photo atlas is replaced by a procedural texture so no
 * image assets are shipped.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

const FRAG = `
precision highp float;
uniform vec2 uRes;
uniform float uTime;
uniform float uTravel;
uniform float uIntensity;
uniform float uWarp;
uniform float uExit;
uniform vec2 uMouse;
uniform sampler2D uTex;
uniform float uShape;
uniform float uSegs;
uniform float uTwist;
uniform float uZoom;
uniform float uHue;

const float PI = 3.14159265;

vec3 pal(float t) {
  t = fract(t);
  float s = t * 7.0;
  vec3 c = mix(vec3(0.02, 0.01, 0.03), vec3(0.28, 0.04, 0.48), smoothstep(0.0, 1.0, s));
  c = mix(c, vec3(0.82, 0.12, 0.95), smoothstep(1.0, 2.0, s));
  c = mix(c, vec3(1.0, 0.52, 0.92), smoothstep(2.0, 3.0, s));
  c = mix(c, vec3(1.0, 0.94, 0.38), smoothstep(3.0, 4.0, s));
  c = mix(c, vec3(0.56, 1.0, 0.18), smoothstep(4.0, 5.0, s));
  c = mix(c, vec3(0.07, 0.32, 0.05), smoothstep(5.0, 6.0, s));
  c = mix(c, vec3(0.02, 0.01, 0.03), smoothstep(6.0, 7.0, s));
  return c;
}

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453);
}

vec3 tunnel(vec2 uv) {
  float a = atan(uv.y, uv.x);
  float r = length(uv);
  if (uShape > 2.5) r = (abs(uv.x) + abs(uv.y)) * 0.75;
  else if (uShape > 1.5) r *= 1.0 + 0.22 * sin(a * 5.0 + uTime * 0.3);
  else if (uShape > 0.5) r = max(abs(uv.x), abs(uv.y));
  a += uTwist * (uMouse.x * 0.9 + sin(uTime * 0.37) * 0.7 * uIntensity) * (0.28 / (r + 0.22));
  float segs = uSegs > 0.5 ? uSegs : 1.0 + floor(uIntensity * 6.99);
  float s = PI / segs;
  float m = mod(abs(a), 2.0 * s);
  float u = abs(m - s) / s / segs;
  float depth = 0.34 * uZoom / max(r, 0.015) + uTravel;
  depth += sin(a * 3.0 + uTime * 0.9) * 0.06 * uIntensity;
  vec3 photo = texture2D(uTex, vec2(u, depth * 0.3)).rgb;
  float lum = dot(photo, vec3(0.299, 0.587, 0.114));
  vec3 trip = pal(lum * 1.2 + depth * 0.08 - uTime * 0.04 + uHue) * (0.35 + lum * 1.25);
  float breathe = 0.5 + 0.5 * sin(uTime * 0.55 + depth * 0.35);
  float amount = 0.25 + smoothstep(0.05, 0.85, uIntensity) * mix(0.15, 0.65, breathe);
  vec3 col = mix(photo, trip, amount);
  col *= 0.82 + 0.3 * (0.5 + 0.5 * sin(depth * 4.0)) * uIntensity;
  float lv = mix(64.0, 5.0, smoothstep(0.55, 1.0, uIntensity));
  col = floor(col * lv + 0.5) / lv;
  col *= smoothstep(0.015, 0.4, r);
  return col;
}

void main() {
  vec2 uv = (gl_FragCoord.xy - 0.5 * uRes) / min(uRes.x, uRes.y);
  uv -= uMouse * vec2(0.2, 0.14);
  uv *= 1.0 - uWarp * 0.32;
  float ca = 0.005 + uWarp * 0.035 + uIntensity * 0.01;
  vec3 col;
  col.r = tunnel(uv * (1.0 + ca)).r;
  col.g = tunnel(uv).g;
  col.b = tunnel(uv * (1.0 - ca)).b;
  float r = length(uv);
  col += vec3(1.0, 0.72, 1.0) * (0.0016 / (r * r + 0.004)) * (0.3 + uIntensity);
  vec2 sp = gl_FragCoord.xy / uRes;
  float wave = sin(sp.x * 5.0 + uTime * 0.25) * 0.08;
  col += vec3(0.75, 0.1, 0.9) * smoothstep(0.35, 1.05, sp.y + wave) * 0.22 * (0.4 + uIntensity);
  col += vec3(0.35, 0.95, 0.12) * smoothstep(0.55, -0.05, sp.y - wave) * 0.12 * (0.4 + uIntensity);
  col = pow(max(col, 0.0), vec3(1.18));
  col *= 1.0 - smoothstep(0.5, 1.2, r) * 0.75;
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.09;
  col = mix(col, vec3(1.0), clamp(uExit * 1.5 - r * (1.0 - uExit) * 1.3, 0.0, 1.0));
  float trail = clamp(uWarp * 0.9 + uIntensity * 0.3, 0.0, 0.82);
  gl_FragColor = vec4(col, 1.0 - trail);
}
`

export type TunnelLook = { shape: number; segments: number; twist: number; zoom: number; hue: number }
export const DEFAULT_LOOK: TunnelLook = { shape: 0, segments: 0, twist: 1, zoom: 1, hue: 0 }

/** Same key → same look; different landings → different tunnels. */
export function lookFor(key: string): TunnelLook {
  let h = 2166136261
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619)
  const pick = (n: number) => {
    h = Math.imul(h ^ (h >>> 13), 0x5bd1e995) >>> 0
    return h % n
  }
  return {
    shape: pick(4),
    segments: [3, 4, 5, 6, 8][pick(5)],
    twist: (pick(2) ? 1 : -1) * (0.6 + pick(10) * 0.12),
    zoom: 0.75 + pick(10) * 0.06,
    hue: pick(100) / 100,
  }
}

/** Procedural stand-in for the photo atlas: grip-tape grain, deck plies, wheel rings. */
function proceduralAtlas(): HTMLCanvasElement {
  const c = document.createElement('canvas')
  c.width = 1024
  c.height = 512
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 1024, 0)
  grad.addColorStop(0, '#111')
  grad.addColorStop(0.5, '#ddd')
  grad.addColorStop(1, '#222')
  g.fillStyle = grad
  g.fillRect(0, 0, 1024, 512)
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${i % 2 ? 255 : 0},${0.08 + (i % 5) * 0.05})`
    g.fillRect(0, i * 13, 1024, 4 + (i % 4) * 3)
  }
  for (let i = 0; i < 18; i++) {
    g.beginPath()
    g.lineWidth = 6 + (i % 3) * 6
    g.strokeStyle = i % 2 ? 'rgba(255,255,255,.7)' : 'rgba(0,0,0,.6)'
    g.arc(60 + i * 57, 120 + (i % 4) * 90, 22 + (i % 5) * 9, 0, Math.PI * 2)
    g.stroke()
  }
  const img = g.getImageData(0, 0, 1024, 512)
  let s = 1
  for (let i = 0; i < img.data.length; i += 4) {
    s = (s * 16807) % 2147483647
    const n = ((s / 2147483647) - 0.5) * 70
    img.data[i] += n
    img.data[i + 1] += n
    img.data[i + 2] += n
  }
  g.putImageData(img, 0, 0)
  return c
}

export type TunnelFrame = { intensity: number; warp: number; exit: number; mouseX: number; mouseY: number; speed: number; look?: TunnelLook }
export type Tunnel = { render(dt: number, frame: TunnelFrame): void; dispose(): void }

export function createTunnel(canvas: HTMLCanvasElement, renderScale = 0.45): Tunnel | null {
  const gl = canvas.getContext('webgl', { alpha: false, antialias: false, preserveDrawingBuffer: true, powerPreference: 'low-power' })
  if (!gl) return null
  const compile = (type: number, src: string) => {
    const sh = gl.createShader(type)!
    gl.shaderSource(sh, src)
    gl.compileShader(sh)
    return sh
  }
  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl.VERTEX_SHADER, VERT))
  gl.attachShader(program, compile(gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(program)
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const u = (n: string) => gl.getUniformLocation(program, n)
  const U = {
    res: u('uRes'), time: u('uTime'), travel: u('uTravel'), intensity: u('uIntensity'), warp: u('uWarp'), exit: u('uExit'),
    mouse: u('uMouse'), shape: u('uShape'), segs: u('uSegs'), twist: u('uTwist'), zoom: u('uZoom'), hue: u('uHue'),
  }

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, proceduralAtlas())
  gl.generateMipmap(gl.TEXTURE_2D)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)
  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  const resize = () => {
    const scale = Math.min(window.devicePixelRatio || 1, 2) * renderScale
    canvas.width = Math.max(1, Math.round(canvas.clientWidth * scale))
    canvas.height = Math.max(1, Math.round(canvas.clientHeight * scale))
    gl.viewport(0, 0, canvas.width, canvas.height)
  }
  const ro = new ResizeObserver(resize)
  ro.observe(canvas)
  resize()

  let disposed = false
  let travel = 0
  const start = performance.now()
  return {
    render(dt, f) {
      if (disposed) return
      travel += dt * f.speed
      const look = f.look ?? DEFAULT_LOOK
      gl.uniform2f(U.res, canvas.width, canvas.height)
      gl.uniform1f(U.time, (performance.now() - start) / 1000)
      gl.uniform1f(U.travel, travel)
      gl.uniform1f(U.intensity, f.intensity)
      gl.uniform1f(U.warp, f.warp)
      gl.uniform1f(U.exit, f.exit)
      gl.uniform2f(U.mouse, f.mouseX, f.mouseY)
      gl.uniform1f(U.shape, look.shape)
      gl.uniform1f(U.segs, look.segments)
      gl.uniform1f(U.twist, look.twist)
      gl.uniform1f(U.zoom, look.zoom)
      gl.uniform1f(U.hue, look.hue)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    dispose() {
      disposed = true
      ro.disconnect()
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    },
  }
}

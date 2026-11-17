/**
 * The tunnel engine: a photo-textured WebGL tunnel shared by the About ride
 * and the hover "focus field" used across the site.
 */

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`

/*
 * A photo-textured tunnel. Your photos wrap the walls and stream toward the
 * camera. As the trip intensifies: psychedelic color mapping, more
 * kaleidoscope slices, a wobbling spiral, posterized color, chromatic
 * aberration and long-exposure trails. At the end, white light floods in.
 */
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
// The look: shape 0 round / 1 square / 2 flower / 3 diamond, kaleidoscope
// slices (0 = build with intensity), twist, depth scale, palette offset
uniform float uShape;
uniform float uSegs;
uniform float uTwist;
uniform float uZoom;
uniform float uHue;

const float PI = 3.14159265;

// Palette from the Emerica "Stay Gold" poster: mostly black, with aurora
// glows of violet, magenta, hot pink, yellow and acid green.
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

  // Spiral twist: follows the cursor, breathes as the trip builds
  a += uTwist * (uMouse.x * 0.9 + sin(uTime * 0.37) * 0.7 * uIntensity) * (0.28 / (r + 0.22));

  // Mirrored kaleidoscope: 1 slice at the start, up to 7 at the peak.
  // Mirroring also hides the texture seam.
  float segs = uSegs > 0.5 ? uSegs : 1.0 + floor(uIntensity * 6.99);
  float s = PI / segs;
  float m = mod(abs(a), 2.0 * s);
  // Keep texture density constant however many slices there are
  float u = abs(m - s) / s / segs;

  float depth = 0.34 * uZoom / max(r, 0.015) + uTravel;
  depth += sin(a * 3.0 + uTime * 0.9) * 0.06 * uIntensity;

  vec3 photo = texture2D(uTex, vec2(u, depth * 0.3)).rgb;
  float lum = dot(photo, vec3(0.299, 0.587, 0.114));

  // Map the photo's light and shadow onto a cycling rainbow
  vec3 trip = pal(lum * 1.2 + depth * 0.08 - uTime * 0.04 + uHue) * (0.35 + lum * 1.25);
  // The trip breathes: photos surface, dissolve into color, surface again
  float breathe = 0.5 + 0.5 * sin(uTime * 0.55 + depth * 0.35);
  // Photos are always pulled a little toward the poster's palette
  float amount = 0.25 + smoothstep(0.05, 0.85, uIntensity) * mix(0.15, 0.65, breathe);
  vec3 col = mix(photo, trip, amount);

  // Soft light bands rushing past (kept slow: no strobing)
  col *= 0.82 + 0.3 * (0.5 + 0.5 * sin(depth * 4.0)) * uIntensity;

  // Posterize toward the peak
  float lv = mix(64.0, 5.0, smoothstep(0.55, 1.0, uIntensity));
  col = floor(col * lv + 0.5) / lv;

  // Fog into the dark heart of the tunnel
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
  // Hot violet-white core, like the light behind the skater
  col += vec3(1.0, 0.72, 1.0) * (0.0016 / (r * r + 0.004)) * (0.3 + uIntensity);

  // Aurora: magenta bleeding from above, acid green from below
  vec2 sp = gl_FragCoord.xy / uRes;
  float wave = sin(sp.x * 5.0 + uTime * 0.25) * 0.08;
  col += vec3(0.75, 0.1, 0.9) * smoothstep(0.35, 1.05, sp.y + wave) * 0.22 * (0.4 + uIntensity);
  col += vec3(0.35, 0.95, 0.12) * smoothstep(0.55, -0.05, sp.y - wave) * 0.12 * (0.4 + uIntensity);

  // Mostly black: crush the shadows, deepen the edges
  col = pow(max(col, 0.0), vec3(1.18));
  col *= 1.0 - smoothstep(0.5, 1.2, r) * 0.75;

  // Film grain
  col += (hash(gl_FragCoord.xy + fract(uTime) * 91.0) - 0.5) * 0.09;

  col = mix(col, vec3(1.0), clamp(uExit * 1.5 - r * (1.0 - uExit) * 1.3, 0.0, 1.0));

  float trail = clamp(uWarp * 0.9 + uIntensity * 0.3, 0.0, 0.82);
  gl_FragColor = vec4(col, 1.0 - trail);
}
`

function compile(gl: WebGLRenderingContext, type: number, src: string) {
  const shader = gl.createShader(type)!
  gl.shaderSource(shader, src)
  gl.compileShader(shader)
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    console.error(gl.getShaderInfoLog(shader))
  }
  return shader
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/** Lays the photos side by side in one texture, each cropped to fill its cell. */
async function buildAtlas(srcs: string[]) {
  const images = (await Promise.allSettled(srcs.map(loadImage)))
    .filter((r): r is PromiseFulfilledResult<HTMLImageElement> => r.status === 'fulfilled')
    .map((r) => r.value)
  const canvas = document.createElement('canvas')
  canvas.width = 2048
  canvas.height = 1024
  const ctx = canvas.getContext('2d')!
  const cell = canvas.width / Math.max(1, images.length)
  images.forEach((img, i) => {
    const scale = Math.max(cell / img.width, canvas.height / img.height)
    const w = img.width * scale
    const h = img.height * scale
    ctx.save()
    ctx.beginPath()
    ctx.rect(i * cell, 0, cell, canvas.height)
    ctx.clip()
    ctx.drawImage(img, i * cell + (cell - w) / 2, (canvas.height - h) / 2, w, h)
    ctx.restore()
  })
  return canvas
}

export type TunnelFrame = {
  /** 0 → 1: how far the trip has built (color, kaleidoscope, posterize) */
  intensity: number
  /** 0 → 1: speed boost, chromatic aberration, trails */
  warp: number
  /** 0 → 1: white light flooding in from the center */
  exit: number
  /** Steering, -1 → 1 */
  mouseX: number
  mouseY: number
  /** Depth travelled per second */
  speed: number
  look?: TunnelLook
}

/** What makes one tunnel feel different from another. */
export type TunnelLook = {
  /** 0 round, 1 square, 2 flower, 3 diamond */
  shape: number
  /** Fixed kaleidoscope slices; 0 = build up with intensity */
  segments: number
  /** Twist strength and direction (negative spins the other way) */
  twist: number
  /** Depth scale: higher feels longer and faster */
  zoom: number
  /** Shift through the palette (0 → 1) */
  hue: number
}

export const DEFAULT_LOOK: TunnelLook = { shape: 0, segments: 0, twist: 1, zoom: 1, hue: 0 }

export type Tunnel = {
  setImages(srcs: string[]): void
  render(dt: number, frame: TunnelFrame): void
  dispose(): void
}

/** Creates a tunnel on a canvas, or returns null when WebGL isn't available. */
export function createTunnel(canvas: HTMLCanvasElement, renderScale = 0.6): Tunnel | null {
  const gl = canvas.getContext('webgl', {
    alpha: false,
    antialias: false,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  })
  if (!gl) return null

  const program = gl.createProgram()!
  gl.attachShader(program, compile(gl, gl.VERTEX_SHADER, VERT))
  gl.attachShader(program, compile(gl, gl.FRAGMENT_SHADER, FRAG))
  gl.linkProgram(program)
  gl.useProgram(program)

  const buffer = gl.createBuffer()
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer)
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW)
  const aPos = gl.getAttribLocation(program, 'aPos')
  gl.enableVertexAttribArray(aPos)
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0)

  const u = (name: string) => gl.getUniformLocation(program, name)
  const uRes = u('uRes')
  const uTime = u('uTime')
  const uTravel = u('uTravel')
  const uIntensity = u('uIntensity')
  const uWarp = u('uWarp')
  const uExit = u('uExit')
  const uMouse = u('uMouse')
  const uShape = u('uShape')
  const uSegs = u('uSegs')
  const uTwist = u('uTwist')
  const uZoom = u('uZoom')
  const uHue = u('uHue')

  const texture = gl.createTexture()
  gl.bindTexture(gl.TEXTURE_2D, texture)
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([40, 20, 60, 255]))
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.REPEAT)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR)
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR)

  gl.enable(gl.BLEND)
  gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)

  // Rendered below native resolution: faster, and the softness suits it
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
  let request = 0
  let travel = 0
  const start = performance.now()

  return {
    setImages(srcs) {
      const id = ++request
      buildAtlas(srcs).then((atlas) => {
        if (disposed || id !== request) return
        gl.bindTexture(gl.TEXTURE_2D, texture)
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, atlas)
        gl.generateMipmap(gl.TEXTURE_2D)
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR)
      })
    },
    render(dt, f) {
      if (disposed) return
      travel += dt * f.speed
      gl.uniform2f(uRes, canvas.width, canvas.height)
      gl.uniform1f(uTime, (performance.now() - start) / 1000)
      gl.uniform1f(uTravel, travel)
      gl.uniform1f(uIntensity, f.intensity)
      gl.uniform1f(uWarp, f.warp)
      gl.uniform1f(uExit, f.exit)
      gl.uniform2f(uMouse, f.mouseX, f.mouseY)
      const look = f.look ?? DEFAULT_LOOK
      gl.uniform1f(uShape, look.shape)
      gl.uniform1f(uSegs, look.segments)
      gl.uniform1f(uTwist, look.twist)
      gl.uniform1f(uZoom, look.zoom)
      gl.uniform1f(uHue, look.hue)
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4)
    },
    dispose() {
      disposed = true
      ro.disconnect()
      // Free resources but keep the context: React may remount into the same canvas.
      gl.deleteTexture(texture)
      gl.deleteBuffer(buffer)
      gl.deleteProgram(program)
    },
  }
}

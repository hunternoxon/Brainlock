import { useEffect, useRef } from 'react'
import { about, tunnelPhotos } from '../content'
import { createTunnel, DEFAULT_LOOK, type TunnelLook } from '../lib/tunnel'
import './FocusField.css'

const DEFAULT_IMAGES = [about.portrait.src, ...tunnelPhotos.map((p) => p.src)]
const EVENT = 'focusfield'

/**
 * Every focus target gets its own look, derived from what it is (its images
 * and text), so the same hover always opens the same tunnel and no two match.
 */
function lookFor(target: Element): TunnelLook {
  const key = (target.getAttribute('data-focus') ?? '') + (target.textContent ?? '').slice(0, 60)
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

/** Programmatically put an element in focus (or clear it), e.g. mobile pages. */
export function setFocus(el: Element | null) {
  window.dispatchEvent(new CustomEvent<Element | null>(EVENT, { detail: el }))
}

/**
 * The tunnel, everywhere. Anything marked `data-focus="img1.jpg,img2.jpg"`
 * opens a live tunnel behind itself while hovered or focused, textured with
 * its own images. Optional `data-focus-title` / `data-focus-sub` put a message
 * in the open screen space beside it.
 */
export function FocusField() {
  const root = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const noteRef = useRef<HTMLDivElement>(null)
  const titleRef = useRef<HTMLParagraphElement>(null)
  const subRef = useRef<HTMLParagraphElement>(null)

  useEffect(() => {
    const el = root.current
    const canvas = canvasRef.current
    const note = noteRef.current
    if (!el || !canvas || !note) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const canHover = window.matchMedia('(hover: hover)').matches
    const tunnel = reduced ? null : createTunnel(canvas, 0.45)
    if (!tunnel) el.dataset.fallback = ''

    let current: Element | null = null
    let raf = 0
    let stopTimer = 0
    let last = performance.now()
    let since = 0
    let warp = 0
    let look: TunnelLook = DEFAULT_LOOK
    const mouse = { x: 0, y: 0, tx: 0, ty: 0, speed: 0 }

    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      since += dt
      // Builds while you linger: a gentle start, then it really gets going
      const intensity = Math.min(0.78, 0.18 + since * 0.16)
      const warpTarget = Math.min(1, mouse.speed * 0.004)
      warp += (warpTarget - warp) * (1 - Math.exp(-dt * (warpTarget > warp ? 5 : 2)))
      mouse.speed *= Math.exp(-dt * 6)
      mouse.x += (mouse.tx - mouse.x) * (1 - Math.exp(-dt * 3))
      mouse.y += (mouse.ty - mouse.y) * (1 - Math.exp(-dt * 3))

      tunnel!.render(dt, {
        intensity,
        warp,
        exit: 0,
        mouseX: mouse.x,
        mouseY: mouse.y,
        speed: (0.22 + intensity * 0.35 + warp * 1.6) * look.zoom,
        look,
      })
      raf = requestAnimationFrame(tick)
    }

    /** Puts the message on whichever side of the screen has more room. */
    const placeNote = (target: Element) => {
      const title = target.getAttribute('data-focus-title')
      if (!title) {
        delete note.dataset.show
        return
      }
      titleRef.current!.textContent = title
      subRef.current!.textContent = target.getAttribute('data-focus-sub') ?? ''
      const r = target.getBoundingClientRect()
      const roomLeft = r.left
      const roomRight = window.innerWidth - r.right
      note.dataset.side = roomRight >= roomLeft ? 'right' : 'left'
      note.style.setProperty('--room', `${Math.max(roomLeft, roomRight)}px`)
      note.dataset.show = ''
    }

    const activate = (target: Element | null) => {
      if (target === current) return
      current = target
      window.clearTimeout(stopTimer)
      if (target) {
        const imgs = target.getAttribute('data-focus')
        tunnel?.setImages(imgs ? imgs.split(',') : DEFAULT_IMAGES)
        look = lookFor(target)
        since = 0
        el.dataset.active = ''
        placeNote(target)
        if (tunnel && !raf) {
          last = performance.now()
          raf = requestAnimationFrame(tick)
        }
      } else {
        delete el.dataset.active
        delete note.dataset.show
        // Keep rendering through the fade-out, then rest
        stopTimer = window.setTimeout(() => {
          cancelAnimationFrame(raf)
          raf = 0
        }, 600)
      }
    }

    const focusTarget = (node: EventTarget | null) =>
      node instanceof Element ? node.closest('[data-focus]') : null

    const onOver = (e: PointerEvent) => {
      if (e.pointerType === 'mouse') activate(focusTarget(e.target))
    }
    const onMove = (e: PointerEvent) => {
      mouse.speed += Math.hypot(e.movementX, e.movementY)
      mouse.tx = (e.clientX / window.innerWidth) * 2 - 1
      mouse.ty = -((e.clientY / window.innerHeight) * 2 - 1)
    }
    const onFocusIn = (e: FocusEvent) => {
      if (canHover) activate(focusTarget(e.target))
    }
    const onFocusOut = (e: FocusEvent) => {
      if (canHover && !focusTarget(e.relatedTarget)) activate(null)
    }
    const onLeaveWindow = () => canHover && activate(null)
    const onSet = (e: Event) => activate((e as CustomEvent<Element | null>).detail)
    // The message is placed for where the card was; re-place after scrolling
    const onScroll = () => current && note.dataset.show !== undefined && placeNote(current)

    document.addEventListener('pointerover', onOver)
    document.addEventListener('pointermove', onMove, { passive: true })
    document.addEventListener('focusin', onFocusIn)
    document.addEventListener('focusout', onFocusOut)
    document.documentElement.addEventListener('pointerleave', onLeaveWindow)
    window.addEventListener(EVENT, onSet)
    window.addEventListener('scroll', onScroll, { passive: true })

    return () => {
      cancelAnimationFrame(raf)
      window.clearTimeout(stopTimer)
      document.removeEventListener('pointerover', onOver)
      document.removeEventListener('pointermove', onMove)
      document.removeEventListener('focusin', onFocusIn)
      document.removeEventListener('focusout', onFocusOut)
      document.documentElement.removeEventListener('pointerleave', onLeaveWindow)
      window.removeEventListener(EVENT, onSet)
      window.removeEventListener('scroll', onScroll)
      tunnel?.dispose()
    }
  }, [])

  return (
    <div ref={root} className="focus-field" aria-hidden="true">
      <canvas ref={canvasRef} />
      <div ref={noteRef} className="focus-field__note">
        <p ref={titleRef} className="focus-field__title" />
        <p ref={subRef} className="focus-field__sub" />
      </div>
    </div>
  )
}

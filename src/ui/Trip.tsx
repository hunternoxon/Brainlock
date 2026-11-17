import { useEffect, useRef } from 'react'
import { createTunnel, lookFor, type Tunnel } from './tunnel'

const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/**
 * The one loud moment: a landed trick opens the tunnel behind the result.
 * Static aurora fallback for reduced motion or no WebGL.
 */
export function Trip({ active, lookKey, variant = 'land' }: { active: boolean; lookKey: string; variant?: 'land' | 'fail' }) {
  const root = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const tunnel = useRef<Tunnel | null | undefined>(undefined)

  useEffect(() => {
    return () => {
      tunnel.current?.dispose()
      tunnel.current = undefined
    }
  }, [])

  useEffect(() => {
    const el = root.current
    if (!active || !el || !canvas.current) return
    if (tunnel.current === undefined) tunnel.current = reducedMotion() ? null : createTunnel(canvas.current)
    const t = tunnel.current
    if (!t) {
      el.dataset.fallback = ''
      return
    }
    const look = lookFor(lookKey)
    let raf = 0
    let last = performance.now()
    let since = 0
    const tick = (now: number) => {
      const dt = Math.min(0.05, (now - last) / 1000)
      last = now
      since += dt
      if (variant === 'fail') {
        // Slumps instead of rushes: slow, sinking, melting
        const melt = Math.min(1, since * 0.3)
        t.render(dt, { intensity: 0.35, warp: Math.max(0, 0.4 - since * 0.5), exit: 0, mouseX: 0, mouseY: 0, speed: -0.06 * look.zoom, look, mode: 1, melt })
      } else {
        // Lands with a rush, then settles into a slow ride
        const warp = Math.max(0, 1 - since * 0.9)
        const intensity = Math.min(0.75, 0.3 + since * 0.12)
        t.render(dt, { intensity, warp, exit: 0, mouseX: Math.sin(since * 0.4) * 0.3, mouseY: 0, speed: (0.22 + intensity * 0.35 + warp * 1.6) * look.zoom, look })
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [active, lookKey, variant])

  return (
    <div ref={root} className="trip" data-active={active || undefined} data-variant={variant} aria-hidden="true">
      <canvas ref={canvas} />
    </div>
  )
}

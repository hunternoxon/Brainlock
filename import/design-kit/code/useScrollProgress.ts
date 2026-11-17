import { useEffect, type RefObject } from 'react'

/**
 * Writes how far the user has scrolled through a tall element (0 → 1) into a
 * `--p` CSS variable on that element, and optionally into a ref for
 * animation loops. No React re-renders per frame.
 */
export function useScrollProgress(
  ref: RefObject<HTMLElement | null>,
  enabled = true,
  progress?: { current: number },
) {
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return

    let frame = 0
    const update = () => {
      frame = 0
      const rect = el.getBoundingClientRect()
      const scrollable = rect.height - window.innerHeight
      const p = scrollable > 0 ? Math.min(1, Math.max(0, -rect.top / scrollable)) : 0
      el.style.setProperty('--p', p.toFixed(4))
      if (progress) progress.current = p
    }
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }, [ref, enabled, progress])
}

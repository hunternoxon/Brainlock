/**
 * Scrolls the page just enough for an element to be fully visible.
 * `extraBottom` accounts for growth that hasn't happened yet (e.g. a card
 * that's about to open up). Taller-than-viewport elements align to the top.
 */
export function ensureInView(el: HTMLElement, extraBottom = 0) {
  const rect = el.getBoundingClientRect()
  const mobile = window.matchMedia('(max-width: 767px)').matches
  const topMargin = mobile ? 80 : 32
  const bottomMargin = 32

  const top = rect.top - topMargin
  const bottom = rect.bottom + extraBottom + bottomMargin - window.innerHeight
  const fits = rect.height + extraBottom + topMargin + bottomMargin <= window.innerHeight

  let delta = 0
  if (top < 0 || !fits) delta = top
  else if (bottom > 0) delta = bottom

  if (Math.abs(delta) > 2) {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollBy({ top: delta, behavior: reduced ? 'auto' : 'smooth' })
  }
}

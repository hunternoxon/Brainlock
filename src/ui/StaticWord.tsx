import { useEffect, useState } from 'react'

const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

/** Swaps between words with a burst of TV static at each change. */
export function StaticWord({ words, every = 3600, glitchMs = 520 }: { words: string[]; every?: number; glitchMs?: number }) {
  const [i, setI] = useState(0)
  const [glitch, setGlitch] = useState(false)
  useEffect(() => {
    const timers: number[] = []
    const id = window.setInterval(() => {
      if (reduced()) {
        setI((x) => (x + 1) % words.length)
        return
      }
      setGlitch(true)
      timers.push(window.setTimeout(() => setI((x) => (x + 1) % words.length), glitchMs / 2))
      timers.push(window.setTimeout(() => setGlitch(false), glitchMs))
    }, every)
    return () => {
      window.clearInterval(id)
      timers.forEach(clearTimeout)
    }
  }, [every, glitchMs, words.length])
  return (
    <span className="static-word" data-glitch={glitch || undefined} data-text={words[i]} aria-live="off">
      {words[i]}
    </span>
  )
}

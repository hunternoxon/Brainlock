// Optional, off by default. Small synthesized blips; no audio files.
let ac: AudioContext | null = null

function ctx(): AudioContext | null {
  if (ac) return ac
  const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  ac = new AC()
  return ac
}

function tone(freq: number, at: number, dur: number, type: OscillatorType = 'sine', vol = 0.12) {
  const a = ctx()
  if (!a) return
  if (a.state === 'suspended') void a.resume()
  const o = a.createOscillator()
  const g = a.createGain()
  o.type = type
  o.frequency.setValueAtTime(freq, a.currentTime + at)
  g.gain.setValueAtTime(0.0001, a.currentTime + at)
  g.gain.linearRampToValueAtTime(vol, a.currentTime + at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + at + dur)
  o.connect(g).connect(a.destination)
  o.start(a.currentTime + at)
  o.stop(a.currentTime + at + dur + 0.05)
}

export const sfx = {
  land() {
    tone(660, 0, 0.12, 'triangle')
    tone(990, 0.08, 0.16, 'triangle')
    tone(1480, 0.16, 0.22, 'sine', 0.06)
  },
  miss() {
    tone(220, 0, 0.12, 'sine', 0.08)
  },
  fail() {
    tone(196, 0, 0.18, 'sawtooth', 0.05)
    tone(147, 0.14, 0.28, 'sawtooth', 0.05)
  },
  over() {
    // the alien sign-off
    tone(880, 0, 0.18, 'sine')
    tone(1320, 0.14, 0.18, 'sine')
    tone(587, 0.3, 0.4, 'triangle', 0.08)
  },
}

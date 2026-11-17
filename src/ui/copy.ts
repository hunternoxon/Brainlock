// Host voice: mostly quiet, a little alien. Picked deterministically per challenge.
const LANDED = ['Clean.', 'Signal received.', 'Brain unlocked.', 'Logged.', 'Smooth.', 'Stuck it.', 'Noted, earthling.']
const FAILED = ['Not this time.', 'Transmission lost.', 'Shake it off.', 'Next one.']
const SKIPPED = ['Moving on.', 'Skipped.']

const pick = (xs: string[], i: number) => xs[i % xs.length]

export const copy = {
  landed: (i: number) => pick(LANDED, i),
  failed: (i: number) => pick(FAILED, i),
  skipped: (i: number) => pick(SKIPPED, i),
  over: (reason?: string) =>
    reason === 'skate' ? 'S-K-A-T-E. Session over.' : reason === 'solo-complete' ? 'Run complete.' : 'Session ended.',
}

export const fmt = (n: number) => n.toLocaleString('en-US')
export const ordinal = (n: number) => (n === 1 ? '1st' : n === 2 ? '2nd' : n === 3 ? '3rd' : `${n}th`)

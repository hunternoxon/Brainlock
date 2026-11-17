// Browser smoke test at phone width using the locally installed Google Chrome.
// Usage: npm run build && npm run smoke   (or SMOKE_URL=http://localhost:5280 npm run smoke)
import { spawn } from 'node:child_process'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const OUT = 'output/smoke'
mkdirSync(OUT, { recursive: true })
let server
let base = process.env.SMOKE_URL
if (!base) {
  base = 'http://localhost:4179'
  server = spawn('npx', ['vite', 'preview', '--port', '4179', '--strictPort'], { stdio: 'pipe' })
  await new Promise((res, rej) => {
    server.stdout.on('data', (d) => String(d).includes('4179') && res())
    server.on('exit', (c) => rej(new Error('preview exited ' + c)))
    setTimeout(() => rej(new Error('preview timeout')), 15000)
  })
}

const results = []
const errors = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok: !!ok, detail })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
const page = await ctx.newPage()
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
page.on('pageerror', (e) => errors.push(String(e)))
const shot = (n) => page.screenshot({ path: `${OUT}/${n}.png` })
const btn = (name) => page.getByRole('button', { name, exact: true })
const text = async (sel) => (await page.locator(sel).first().textContent())?.trim() ?? ''
const visible = (name) => btn(name).isVisible()

try {
  await page.goto(base)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  check('home loads with wordmark', await page.getByRole('heading', { name: 'Brainlock' }).isVisible())
  check('all 12 obstacles by default', (await text('.setup-summary')).includes('All 12 obstacles'))
  await shot('01-home')

  // Setup persists
  await page.getByRole('button', { name: 'Raise level' }).click() // raise to level 4
  await page.locator('.setup-summary').click()
  await page.getByRole('button', { name: 'quarterpipe', exact: true }).click()
  await btn('Done').click()
  await page.reload()
  check('settings persist across reload', (await text('.stepper__val')) === '4' && (await text('.setup-summary')).includes('11 obstacles'))

  // SKATE
  await btn('Start session').click()
  const t1 = await text('.trick__name')
  check('SKATE shows a non-empty trick', t1.length > 2, `${t1} ${await text('.trick__where')}`)
  check('attempt 1 of 3 shown', (await text('.attempts__label')) === 'Attempt 1 of 3')
  check('Land/Miss/Skip visible, Next hidden', (await visible('Land')) && (await visible('Miss')) && !(await visible('Next')))
  await shot('02-playing')

  await btn('Land').click()
  const pts = await text('.result__points')
  check('land shows points', /^\+\d+/.test(pts), pts)
  check('result waits for Next; Land/Miss gone', (await visible('Next')) && !(await visible('Land')) && !(await visible('Miss')))
  const scoreAfterLand = await text('.score')
  check('score updated once', scoreAfterLand === pts.replace('+', ''), `score ${scoreAfterLand}`)
  await page.waitForTimeout(900)
  await shot('03-landed-tunnel')
  await btn('Score breakdown').click()
  check('breakdown expands with formula rows', (await page.locator('.receipt__row').count()) >= 5)
  await shot('04-receipt')
  await page.keyboard.press('l') // stray land key must not double-award
  check('no double award on stray input', (await text('.score')) === scoreAfterLand)

  await btn('Next').click()
  const t2 = (await text('.trick__name')) + (await text('.trick__where'))
  check('Next generates a new challenge at attempt 1', (await text('.attempts__label')) === 'Attempt 1 of 3', t2)

  await btn('Miss').click()
  check('miss → attempt 2', (await text('.attempts__label')) === 'Attempt 2 of 3')
  await btn('Miss').click()
  check('miss → attempt 3', (await text('.attempts__label')) === 'Attempt 3 of 3')

  // Reload mid-attempt and resume
  await page.reload()
  check('reload offers Resume', await visible('Resume'))
  await shot('05-resume-offer')
  await btn('Resume').click()
  const t2b = (await text('.trick__name')) + (await text('.trick__where'))
  check('resume restores same trick + attempt 3', t2b === t2 && (await text('.attempts__label')) === 'Attempt 3 of 3', t2b)
  check('resume restores score', (await text('.score')) === scoreAfterLand)

  await btn('Miss').click()
  check('third miss → "S earned" result', (await text('.result__head')).includes('S earned'))
  check('letter S lit', (await page.locator('.letter[data-on]').count()) === 1)
  await shot('06-failed')
  await btn('Next').click()

  await page.getByRole('button', { name: /^Skip/ }).click()
  const skipHead = await text('.result__head')
  check('skip shows result with no letter, waits for Next', skipHead.includes('Skipped') && (await visible('Next')) && (await page.locator('.letter[data-on]').count()) === 1)
  check('skip applied penalty', (await text('.score')) === String(Math.max(0, Number(scoreAfterLand) - 50)), await text('.score'))
  await btn('Next').click()

  for (let i = 0; i < 4; i++) {
    for (let m = 0; m < 3; m++) await btn('Miss').click()
    if (i < 3) await btn('Next').click()
  }
  check('5th letter ends SKATE immediately', (await text('.summary__title')).includes('S-K-A-T-E'))
  check('no extra trick after final letter', !(await visible('Next')) && !(await visible('Land')))
  check('recap lists every challenge', (await page.locator('.recap li').count()) === 7)
  await shot('07-skate-over')
  await btn('Home').click()

  // Solo 10
  await page.getByRole('radio', { name: 'Solo' }).click()
  await page.getByRole('radio', { name: '10' }).click()
  await btn('Start session').click()
  check('Solo shows progress, not SKATE letters', (await page.locator('.letters').count()) === 0 && (await text('.progress')).startsWith('1'))
  let n = 0
  while (!(await page.locator('.summary__title').isVisible()) && n < 20) {
    const act = n % 3
    if (act === 0) await btn('Land').click()
    else if (act === 1) for (let m = 0; m < 3; m++) await btn('Miss').click()
    else await page.getByRole('button', { name: /^Skip/ }).click()
    n++
    if (n === 4) await shot('08-solo-progress')
    await page.getByRole('button', { name: /^(Next|See results)$/ }).click()
  }
  check('Solo 10 ends after exactly 10', n === 10 && (await text('.summary__title')) === 'Run complete.', `resolved ${n}`)
  await shot('09-solo-summary')
  await btn('Home').click()

  // Manual end
  await btn('Start session').click()
  await btn('Menu').click()
  await btn('End session').click()
  await btn('Tap again to end session').click()
  check('manual end → "Session ended." and not a high score', (await text('.summary__title')) === 'Session ended.' && (await text('.summary__score')).includes('not high scores'))
  await btn('Home').click()

  await btn('Scores & history').click()
  const board = await page.locator('.board').count()
  check('scores page has SKATE + Solo 10 boards and history', board === 2 && (await page.locator('.history li').count()) === 3)
  await shot('10-scores')
  await btn('Done').click()

  // Empty pool guidance
  await page.getByRole('button', { name: 'Lower level' }).click()
  await page.getByRole('button', { name: 'Lower level' }).click()
  await page.getByRole('button', { name: 'Lower level' }).click()
  await page.locator('.setup-summary').click()
  if (await visible('All')) await btn('All').click()
  await btn('Just flat').click()
  await page.getByRole('button', { name: 'flat', exact: true }).click()
  await page.getByRole('button', { name: 'handrail', exact: true }).click()
  check('handrail-only at L1 explains why and blocks Start', (await page.locator('.notice--warn').textContent()).includes('level 6'))
  await shot('11-empty-pool')
  await btn('Reset to everything on').click()
  await btn('Done').click()

  // Tap target audit on play screen
  await btn('Start session').click()
  const small = await page.$$eval('button', (bs) =>
    bs.filter((b) => b.offsetParent && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map((b) => b.textContent),
  )
  check('all visible play buttons ≥ 44px', small.length === 0, small.join(', '))
} catch (e) {
  check('smoke run completed without exceptions', false, String(e).split('\n')[0])
  await shot('99-error').catch(() => {})
}

check('no console errors or page errors', errors.length === 0, errors.join(' | '))
await browser.close()
server?.kill()
const failed = results.filter((r) => !r.ok)
console.log(`\n${results.length - failed.length}/${results.length} smoke checks passed. Screenshots: ${OUT}/`)
process.exit(failed.length ? 1 : 0)

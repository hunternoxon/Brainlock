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
let okSeenOnLevel = false
const wait = (ms) => page.waitForTimeout(ms)
const choose = async (re) => {
  await page.getByRole('radio', { name: re }).click()
  await wait(450)
}
/**
 * Walk the Typeform-style home survey from question 1 to the Ready step.
 * Returns the level shown on the level question (single player).
 */
const survey = async ({ mode = 'SKATE', length = 10, players = 1, level } = {}) => {
  while (await btn('Back').isVisible()) {
    await btn('Back').click()
    await wait(120)
  }
  await page.getByRole('radio', { name: new RegExp('^' + mode) }).click()
  await btn('Get started').click()
  await wait(450)
  if (mode === 'Marathon') await choose(new RegExp('^' + length + ' challenges'))
  await choose(players === 1 ? /^Just me/ : new RegExp('^' + players + ' players'))
  if (players > 1) return null
  const shown = await text('.stepper__val')
  okSeenOnLevel = okSeenOnLevel || (await btn('OK').count()) > 0
  if (level !== undefined) {
    for (let i = 0; i < 10 && Number(await text('.stepper__val')) !== level; i++)
      await btn(Number(await text('.stepper__val')) < level ? 'Raise level' : 'Lower level').click()
  }
  await btn('Next').click()
  await wait(450)
  return shown
}

try {
  await page.goto(base)
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  check('home loads with wordmark', await page.getByRole('heading', { name: 'Brainlock' }).isVisible())
  check('landing shows only logo, description and mode choice', (await page.locator('.choice').count()) === 2 && (await page.locator('.setup-summary').count()) === 0 && (await page.locator('.home__foot').count()) === 0)
  const card = await page.$eval('.survey', (el) => { const r = el.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2, h: r.height, bg: getComputedStyle(el).backgroundColor, blur: getComputedStyle(el).backdropFilter } })
  check('landing card is compact, centered and glassy', Math.abs(card.cx - 195) < 4 && Math.abs(card.cy - 422) < 30 && card.h <= 620 && card.bg.includes('0.1') && card.blur.includes('blur'), JSON.stringify(card))
  await shot('00-landing')
  await page.getByRole('radio', { name: /^Marathon/ }).click()
  await wait(450)
  check('choosing a mode selects it without leaving the first question', (await text('.q__title')) === 'Choose a mode' && (await page.getByRole('radio', { name: /^Marathon/ }).getAttribute('aria-checked')) === 'true')
  await page.getByRole('radio', { name: /^SKATE/ }).click()
  await btn('Get started').click()
  await wait(450)
  check('Get started moves to the next question with Back / Next', (await text('.q__title')) === 'Who’s playing?' && (await visible('Back')) && (await visible('Next')))
  const h1 = await page.$eval('.survey', (el) => Math.round(el.getBoundingClientRect().height))
  await survey({ level: 4 })
  const h2 = await page.$eval('.survey', (el) => Math.round(el.getBoundingClientRect().height))
  check('every question card is the same height', h1 === h2, `${h1} vs ${h2}`)
  check('survey ends at Ready with setup + a single Start in the Next position', (await page.locator('.setup-summary').count()) === 1 && (await btn('Start session').count()) === 1 && (await page.locator('.survey__next').textContent()) === 'Start session' && !(await visible('Next')))
  check('level question has no OK button', okSeenOnLevel === false)
  check('all 12 obstacles by default', (await text('.setup-summary')).includes('All 12 obstacles'))
  await shot('01-home')

  // Setup persists
  await page.locator('.setup-summary').click()
  await page.getByRole('button', { name: 'quarterpipe', exact: true }).click()
  await btn('Done').click()
  await page.reload()
  const lvl = await survey({})
  check('settings persist across reload', lvl === '4' && (await text('.setup-summary')).includes('11 obstacles'))

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
  check('third miss opens the red melt background', (await page.locator('.play[data-failed] .trip[data-variant=fail][data-active]').count()) === 1)
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
  await survey({ mode: 'Marathon', length: 10 })
  await btn('Start session').click()
  check('Marathon shows progress, not SKATE letters', (await page.locator('.letters').count()) === 0 && (await text('.progress')).startsWith('1'))
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
  check('Marathon 10 ends after exactly 10', n === 10 && (await text('.summary__title')) === 'Run complete.', `resolved ${n}`)
  await shot('09-solo-summary')
  await btn('Home').click()
  check('after the recap, Home starts at the first question', (await text('.q__title')) === 'Choose a mode')

  // Manual end
  await survey({ mode: 'Marathon', length: 10 })
  await btn('Start session').click()
  await btn('Menu').click()
  await btn('End session').click()
  await btn('Tap again to end session').click()
  check('manual end → "Session ended." and not a high score', (await text('.summary__title')) === 'Session ended.' && (await text('.summary__score')).includes('not high scores'))
  await btn('Home').click()
  check('after ending early, Home starts at the first question', (await text('.q__title')) === 'Choose a mode')
  await survey({ mode: 'Marathon', length: 10 })

  await btn('Scores & history').click()
  const board = await page.locator('.board').count()
  check('scores page has SKATE + Marathon 10 boards and history', board === 2 && (await page.locator('.history > li').count()) === 3)
  await shot('10-scores')
  await btn('Done').click()

  // Forget a completed session for learning (reason required), history kept
  await btn('Scores & history').click()
  await page.getByRole('button', { name: 'Forget this session for skill learning' }).first().click()
  const forgetBtn = page.getByRole('button', { name: 'Forget for learning' })
  check('forget requires a reason', await forgetBtn.isDisabled())
  await page.locator('.forget select').selectOption('Device issue')
  await forgetBtn.click()
  check('forgotten session stays in history, marked not used', (await page.locator('.history > li').count()) === 3 && (await page.locator('.history__learn', { hasText: 'Not used for learning (Device issue)' }).count()) === 1)
  await btn('Done').click()

  // Empty pool guidance + no-obstacles guidance
  await survey({ mode: 'Marathon', length: 10, level: 1 })
  await page.locator('.setup-summary').click()
  await btn('None').click()
  check('no obstacles → clear guidance', (await page.locator('.notice--warn').textContent()).includes('No obstacles selected'))
  await page.getByRole('button', { name: 'handrail', exact: true }).click()
  check('handrail-only at L1 explains why and blocks Start', (await page.locator('.notice--warn').textContent()).includes('level 6'))
  await shot('11-empty-pool')
  // Quarterpipe only → real coping tricks
  await page.getByRole('button', { name: 'handrail', exact: true }).click()
  await page.getByRole('button', { name: 'quarterpipe', exact: true }).click()
  check('quarterpipe-only pool available at L1', (await text('.pool-status')).includes('possible tricks'))
  await shot('12-setup-mobile')
  await btn('Done').click()
  check('home blocks nothing for quarterpipe-only', !(await btn('Start session').isDisabled()))
  await btn('Start session').click()
  const qp = []
  for (let i = 0; i < 4; i++) {
    qp.push((await text('.trick__name')) + ' ' + (await text('.trick__where')))
    await btn('Land').click()
    if (i === 0) {
      await page.getByRole('button', { name: 'too easy' }).click()
      check('too easy acknowledged', (await text('.feedback')).includes('harder next'))
    }
    await btn('Next').click()
  }
  check('quarterpipe-only session gives coping tricks', qp.every((x) => x.includes('quarterpipe')) && qp.some((x) => /Stall|Rock|50-50|5-0|Disaster|Blunt/.test(x)), qp.join(' | '))
  await btn('Menu').click()
  await btn('End session').click()
  await btn('Tap again to end session').click()
  await btn('Home').click()
  await survey({ mode: 'Marathon', length: 10 })
  await page.locator('.setup-summary').click()
  await btn('Reset setup to defaults').click()
  await btn('Done').click()

  // Tap target audit on play screen
  await btn('Start session').click()
  const small = await page.$$eval('button', (bs) =>
    bs.filter((b) => b.offsetParent && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map((b) => b.textContent),
  )
  check('all visible play buttons ≥ 44px', small.length === 0, small.join(', '))
  await btn('Menu').click()
  await btn('End session').click()
  await btn('Tap again to end session').click()
  await btn('Home').click()

  // Local multiplayer: 2-player SKATE to the end
  await survey({ mode: 'SKATE', players: 2 })
  await page.getByRole('textbox', { name: 'Player 2 name' }).fill('Sam')
  await btn('Next').click()
  await wait(450)
  await btn('Start 2-player match').click()
  check('match shows both players and whose turn', (await page.locator('.matchbar__p').count()) === 2 && (await text('.turn')) === 'Your turn')
  const sharedTrick = await text('.trick__name')
  await btn('Land').click()
  check('Next hands the phone over', (await text('.pill--next')) === 'Pass to Sam')
  await page.locator('.pill--next').click()
  check('Sam gets the same trick (shared round)', (await text('.turn')).startsWith('Sam') && (await text('.trick__name')) === sharedTrick)
  await shot('17-match-turn')
  for (let r = 0; r < 5; r++) {
    for (let m = 0; m < 3; m++) await btn('Miss').click()
    await page.locator('.pill--next').click()
    if (r < 4) {
      await btn('Land').click()
      await page.locator('.pill--next').click()
    }
  }
  check('2-player SKATE ends when Sam spells SKATE; You win', (await text('.summary__title')) === 'You win' && (await page.locator('.standings li').count()) === 2)
  await shot('18-match-summary')
  await btn('Home').click()
  await survey({})

  // Desktop width
  await page.setViewportSize({ width: 1440, height: 900 })
  await wait(200)
  const dc = await page.$eval('.survey', (el) => { const r = el.getBoundingClientRect(); return { cx: r.left + r.width / 2, w: r.width } })
  check('desktop survey card is centered and compact', Math.abs(dc.cx - 720) < 4 && dc.w <= 540, JSON.stringify(dc))
  await shot('13-home-desktop')
  await page.locator('.setup-summary').click()
  const famCols = await page.$eval('.setup__families', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  const gridCols = await page.$eval('.setup__grid', (el) => getComputedStyle(el).gridTemplateColumns.split(' ').length)
  const appW = await page.$eval('.app', (el) => el.getBoundingClientRect().width)
  check('desktop setup: side column + multi-column families, wide container', gridCols === 2 && famCols >= 2 && appW > 1000, `grid ${gridCols}, families ${famCols}, width ${appW}`)
  const headVsChip = await page.evaluate(() => {
    const h = document.querySelector('.family__head h3')
    const c = document.querySelector('.chips--sub .chip')
    return { headFont: parseFloat(getComputedStyle(h).fontSize), chipFont: parseFloat(getComputedStyle(c).fontSize), headIsHeading: h.tagName, switches: document.querySelectorAll('.family [role=switch]').length }
  })
  check('category headers are headings with switches, distinct from trick chips', headVsChip.headIsHeading === 'H3' && headVsChip.switches === 5 && headVsChip.headFont > headVsChip.chipFont, JSON.stringify(headVsChip))
  await shot('14-setup-desktop')
  await btn('Done').click()
  await btn('Start session').click()
  await shot('15-play-desktop')
  await page.setViewportSize({ width: 390, height: 844 })
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

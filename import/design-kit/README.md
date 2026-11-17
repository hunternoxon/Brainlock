# Design kit: hunternoxon.com look & feel

A portable reference for carrying the vibe of the personal site into new
projects. Hand this file to an AI agent (or yourself) at the start of a project.

- Live source: `~/Projects/personal-site`
- Figma: https://www.figma.com/design/q9gCStfzYJzKAy548k05Lt
- Color reference: `stay-gold-reference.jpg` (Emerica "Stay Gold" poster)
- Tunnel sample: `tunnel-sample.jpg`
- Reusable code: `code/` (see bottom)

---

## The concept in one line

**Clean, quiet, and white at rest. Interactions open a portal into a loud,
psychedelic, skate-video world, then put you back.**

The contrast is the point. The calm surface earns the chaos.

## Principles

1. **Calm by default.** Landing views are mostly static: white, Inter, generous
   space. Motion on load is subtle (lines rising in, a fade).
2. **Go all out on interaction.** Hover, focus, scroll, and click are where the
   personality lives. Make them feel special and a bit unexpected, but tasteful.
3. **Digital and alive, not literal.** Inspired by scrapbooks, zines, and skate
   videos, but never a recreation of them. Things get *cut, lifted, and warped*
   in real time, not pasted down.
4. **One idea, used everywhere.** The tunnel is the signature. Reuse it for hover
   takeovers, transitions, and storytelling instead of inventing new effects.
5. **Content stays readable.** The focused thing always sits above the chaos,
   fully legible and fully on screen (scroll it into view if needed).
6. **Every hover is unique.** Same style, different tunnel: shape, slice count,
   twist, depth, and palette offset vary per item, textured with its own imagery.

## Look

### Surface (rest state)
| Token | Light | Dark |
| --- | --- | --- |
| Page | `#e2e5e5` | `#0c0d0d` |
| Paper | `#ffffff` | `#131414` |
| Ink | `#1d1d1d` / strong `#111` | `#e9ecec` |
| Muted | `#777` / `#888` | `#8d9393` |
| Active pill | `#1d1d1d` bg, white text | inverted |

### The trip (interaction state): Stay Gold palette
Mostly black, with aurora glows:

| | |
| --- | --- |
| Black base | `#050307` |
| Violet | `#470a7a` |
| Magenta | `#d21ff2` |
| Hot pink | `#ff85eb` |
| Yellow | `#fff061` |
| Acid green | `#8cff2e` |
| Deep green | `#125208` |
| Laser (accents) | `#ff2414` |

Treatment: crushed shadows, magenta bleeding from the top, acid green from the
bottom, a violet-white core glow, chromatic aberration, heavy film grain.
Cut-outs and cards on top are **pure white or pure black**, never tan or gold.

### Type
- **Inter only** (Inter Variable on web). Monospace (`ui-monospace` / JetBrains
  Mono) only for tiny uppercase meta lines like `APPLE · 2020–2023`.
- Fluid body size: `clamp(16px, 0.55rem + 1.05vw, 28px)`.
- Headlines: weight 500, tight tracking (`-0.025em`).
- Cut-out type: weight 800–850, very tight (`-0.05em`), line-height ~0.95.

### Shape & depth
- Small radii (0.2–0.5em). Pills for chips and buttons.
- Lifted pieces get a real shadow: `0 0.6em 1.4em -0.3em rgb(0 0 0 / .22)`.
- Easing: out `cubic-bezier(.16,1,.3,1)`, snap `cubic-bezier(.34,1.56,.64,1)`.

## Interaction patterns that worked

- **Focus takeover:** on hover/focus, the page disappears into a full-screen live
  tunnel built from that item's images; the item floats above it; a big white
  message uses the open screen space beside it. (`FocusField`)
- **Apple TV–style cards:** the card tilts in 3D toward the cursor with a sliding
  glare, lifts onto a white plate, and grows open to fit its description.
- **Cut words:** a thin laser slits between words, then the words lift apart as
  white chips with shadows; one chosen word flips to black. (`CutWords`)
- **Scroll-driven tunnel story:** a sticky WebGL tunnel textured with personal
  photos; chapters swap white blurb cards on a timer (never scrubbed, so never
  half-cropped); facts fly past as rotated black/white cut-out labels.
- **Next page rises over the tunnel** like a sheet, instead of a hard cut.
- **Mobile:** snap-locked, one-item-per-screen pages with the tunnel behind.
- **Explicit actions:** never make a whole card a surprise external link. Put
  a clear button inside it.

## Do / Don't (learned the hard way)

**Do**
- Keep rest states clean white and quiet.
- Use the person's real story and specific facts, not slogans.
- Make focus content legible and keep it fully in the viewport.
- Respect `prefers-reduced-motion` (calm fallbacks for everything).

**Don't**
- No tan, beige, gold, or newsprint colors.
- No tape, no fake scrapbook props, no "special report" newspaper styling.
- No newspaper, typewriter, marker, or blackletter fonts.
- No ransom-note letters or anything that hurts readability.
- No decorative lines, strokes, borders, arrows, or numbers in nav and lists.
- No slicing images or titles in half; no messages inside a cut.
- No corny labels ("Exhibit 02", "motion detected") or over-explaining copy.
- No buzzword copy ("at the intersection of…", dated tech mentions).
- No full-screen takeovers that feel broken or trap the user.

## Reusable code (`code/`)

| File | What it is |
| --- | --- |
| `tunnel.ts` | The tunnel engine: WebGL shader, Stay Gold palette, photo atlas, `TunnelLook` (shape/segments/twist/zoom/hue) |
| `FocusField.tsx/.css` | Site-wide hover takeover: any element with `data-focus="img1,img2"` opens a unique tunnel behind it; `data-focus-title`/`-sub` add a side message |
| `CutWords.tsx/.css` | Laser-slit, lifting word chips with a chosen highlight word |
| `tokens.css` | Colors (light/dark), easing, shadows, grain texture |
| `ensureInView.ts` | Scroll just enough to keep a focused element fully on screen |
| `useScrollProgress.ts` | Scroll progress → `--p` CSS variable (and a ref) |
| `useReducedMotion.ts` | Reduced-motion hook |

Stack it was built on: React + TypeScript + Vite, plain CSS, raw WebGL,
Web Animations API. No CSS or animation libraries.

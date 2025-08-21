# Brainlock – PWA (Dataset + SKATE Mode)

A minimal Vite + React + TS PWA with:
- Dataset Trick Browser (`/tricks`)
- SKATE Session (`/skate`) with attempts, letters, scoring, obstacles

## Quick start
```bash
npm i
npm run dev
```
Open http://localhost:5173

## Build
```bash
npm run build
npm run preview
```

## Deploy to GitHub Pages
- Push this folder as a repo, then use any static host (Netlify, Vercel, Pages). For GitHub Pages with Vite, set a `base` in `vite.config.ts` to your repo name if using project pages.

## Notes
- Data: `public/data/brainlock_dataset.json` (~35.7k tricks) and `public/data/obstacles.json` (editable mapping).
- The obstacle mapping is approximate because the source dataset doesn't specify spot geometry. Tweak `obstacles.json` to steer generation.
- Scoring: base = difficulty * 100; land bonus: 1st = 1.00, 2nd = 0.94, 3rd = 0.92.
- Letters: S-K-A-T-E; 3 attempts per trick; game ends at E.

## Styling
Dark, minimal “Citizen”-ish vibe via Tailwind.

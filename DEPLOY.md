# Deploying Brainlock dist on GitHub Pages

1) Create a repository and enable GitHub Pages (Settings → Pages).
2) Upload **the contents of this folder** (not the folder itself) to the branch that Pages serves from
   (e.g., `main` / root or `gh-pages` / root).
3) Visit: `https://<your-username>.github.io/<repo-name>/#/skate`

Notes
- Hash routing (`#/skate`, `#/tricks`) avoids needing server rewrites.
- All paths are relative; works under project pages (`/<repo>/`).
- Service Worker cache version is `brainlock-static-v2`. If you ever need to bust, bump it.

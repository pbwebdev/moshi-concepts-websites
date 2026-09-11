# Moshi Concepts — Landing Page

Single-page marketing site for **Moshi Concepts**, a research and product studio
working at the intersection of blockchain, applied AI, and stablecoin payments.
Its first product is an on-chain escrow platform built on Cardano.

Built as a static, dependency-free site (plain HTML + CSS) from the design
handoff. No build step and no JavaScript required.

## Structure

```
index.html      # the page
styles.css      # all styles (mobile-first; desktop from 900px up)
assets/         # images (placeholders — see below)
```

## Running locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deployment

Hosted on **Cloudflare Pages** (static, no build step). Production branch is
`main`; pushes auto-deploy. See [`DEPLOY.md`](DEPLOY.md) for the one-time setup.

## Design fidelity

Recreated pixel-for-pixel from the two designed breakpoints — desktop (1440)
and mobile (390) — as one responsive page with a single breakpoint at 960px.
The site canvas is capped at 1440px and centered on a `#F5F5F4` page background.

Design tokens live as CSS custom properties at the top of `styles.css`
(colors, fonts). Fonts are loaded from Google Fonts:
`Zen Kaku Gothic New` (500, 700) and `Inter` (400, 500).

## Images

Client artwork is in `assets/`. Raster images are downscaled and compressed for
the web (hero and escrow as WebP; icons as palette PNG) — the whole image
payload is ~150 KB. Fits are tuned per image in `styles.css`: the globe is a
right-anchored `cover` crop (keeps the city labels), the escrow diagram shows
whole (its captions must not be cropped), and the icons use `contain`.

| File | Slot | Status |
| --- | --- | --- |
| `assets/hero.webp` | Hero image | ✅ supplied |
| `assets/escrow.webp` | Escrow product visual | ✅ supplied |
| `assets/icon-blockchain.png` | "Blockchain infrastructure" icon | ✅ supplied |
| `assets/icon-ai.png` | "AI escrow and payments" icon | ✅ supplied |
| `assets/icon-stablecoin.png` | "Stablecoin payments" icon | ✅ supplied |
| `assets/draper-dragon.svg` | "Backed by Draper Dragon" logo | ⏳ placeholder (32×32) |
| `assets/cat.svg` | Cat illustration | ⏳ placeholder (360×360 / 240×240 mobile) |

To swap a placeholder: drop the real file into `assets/` and, if the extension
differs, update the matching `src` in `index.html`. Keep large raster art
optimized (resize to ~2× display size; WebP for photos, palette PNG for flat art
with transparency).

## Still to confirm

- **Footer GitHub link** currently points to `https://github.com/pbwebdev`.
  Update to the real Moshi Concepts organization URL.
- The "Read more about the escrow platform" link and the hero CTA both anchor to
  the on-page escrow section. Point them at a dedicated page once one exists.

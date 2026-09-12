# Moshi Concepts — Landing Page

Single-page marketing site for **Moshi Concepts**, a research and product studio
working at the intersection of blockchain, applied AI, and stablecoin payments.
Its first product is an on-chain escrow platform built on Cardano.

Built as a static, dependency-free site (plain HTML + CSS) from the v2 design
handoff. No build step and no JavaScript required.

Sections, in order: nav · hero · **01** Our first product (escrow flow card) ·
**02** Where we're looking (three cards) · **03** Who we are (founder) ·
dark CTA · footer.

## Structure

```
index.html      # the page
styles.css      # all styles (mobile-first; desktop from 960px up)
_headers        # Cloudflare security + caching headers
assets/         # images
```

## Running locally

Open `index.html` directly in a browser, or serve the folder:

```bash
python3 -m http.server 8000
# then visit http://localhost:8000
```

## Deployment

Hosted on **Cloudflare Workers** (static assets, served from the repo root).
Pushes to the connected branch auto-deploy. See [`DEPLOY.md`](DEPLOY.md).

## Design fidelity

Recreated from the two designed breakpoints — desktop (1440) and mobile (390)
— as one responsive page with a single breakpoint at 960px (the point where the
full text nav fits). The site canvas is capped at 1440px and centered.

Design tokens live as CSS custom properties at the top of `styles.css`.
Fonts are loaded from Google Fonts: `Zen Kaku Gothic New` (500, 700) and
`Inter` (400, 500).

The escrow flow diagram and its arrows are built in HTML/CSS (not an image),
so the copy and spacing stay editable. The optional abstract visual on the dark
CTA section is omitted (no asset supplied); the text block keeps the design's
7/12 column width.

## Images

All artwork lives in `assets/`, downscaled and compressed for the web (photos
as WebP; flat art as palette PNG). Fits are tuned per image in `styles.css`.

| File | Slot | Notes |
| --- | --- | --- |
| `assets/hero.webp` | Hero image | Right-anchored `cover` crop keeps the city labels in frame |
| `assets/draper-dragon.png` | "Backed by Draper Dragon" logo | Red shield on white; `contain` |
| `assets/step-payee.png` | Escrow step 1 · Payee | Shown unclipped — the art draws its own ring + badge |
| `assets/step-lock.png` | Escrow step 2 · Funds locked | " |
| `assets/step-validate.png` | Escrow step 3 · Contract validates | " |
| `assets/step-release.png` | Escrow step 4 · Funds released | " |
| `assets/icon-blockchain.png` | Card 01 icon | `contain` |
| `assets/icon-ai.png` | Card 02 icon | `contain` |
| `assets/icon-stablecoin.png` | Card 03 icon | `contain` |
| `assets/founder.webp` | Founder photo | Square source, `cover`-cropped to the 280×340 portrait (140×170 mobile), radius 8 |
| `assets/favicon.svg` | Browser tab icon | Cat mark |

**Step icons:** the four escrow-step icons were cut from the original composite
flow illustration (the same artwork, at full resolution). If standalone exports
become available, drop them in under the same filenames — nothing else changes.

To swap any image: place the new file in `assets/` and, if the extension
differs, update the matching `src` in `index.html`. Keep large raster art
optimized (resize to ~2× display size; WebP for photos, palette PNG for flat art
with transparency).

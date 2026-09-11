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

All client artwork is in `assets/` and supplied — no placeholders remain. Raster
images are downscaled and compressed for the web (photos as WebP; flat art with
transparency as palette PNG); the whole image payload is ~210 KB. Fits are tuned
per image in `styles.css`: the globe is a right-anchored `cover` crop (keeps the
city labels), the escrow diagram shows whole (its captions must not be cropped),
and the icons, the Draper Dragon shield, and the founder photo use `contain`.

| File | Slot |
| --- | --- |
| `assets/hero.webp` | Hero image |
| `assets/escrow.webp` | Escrow product visual |
| `assets/icon-blockchain.png` | "Blockchain infrastructure" icon |
| `assets/icon-ai.png` | "AI escrow and payments" icon |
| `assets/icon-stablecoin.png` | "Stablecoin payments" icon |
| `assets/draper-dragon.png` | "Backed by Draper Dragon" logo (red shield) |
| `assets/founder.webp` | Founder photo in "Who we are" |
| `assets/favicon.svg` | Browser tab icon (cat mark) |

To swap an image: drop the new file into `assets/` and, if the extension differs,
update the matching `src` in `index.html`. Keep large raster art optimized
(resize to ~2× display size; WebP for photos, palette PNG for flat art with
transparency).

## Still to confirm

- **Footer GitHub link** currently points to `https://github.com/pbwebdev`.
  Update to the real Moshi Concepts organization URL.
- The "Read more about the escrow platform" link and the hero CTA both anchor to
  the on-page escrow section. Point them at a dedicated page once one exists.

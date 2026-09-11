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

## Design fidelity

Recreated pixel-for-pixel from the two designed breakpoints — desktop (1440)
and mobile (390) — as one responsive page with a single breakpoint at 960px.
The site canvas is capped at 1440px and centered on a `#F5F5F4` page background.

Design tokens live as CSS custom properties at the top of `styles.css`
(colors, fonts). Fonts are loaded from Google Fonts:
`Zen Kaku Gothic New` (500, 700) and `Inter` (400, 500).

## Placeholders to replace

The images in `assets/` are neutral placeholders. Replace each file in place
(keep the same filename) with the client-supplied artwork:

| File | Slot | Target size |
| --- | --- | --- |
| `assets/hero.svg` | Hero image | 600×520 (desktop), full-width 220h (mobile) |
| `assets/draper-dragon.svg` | "Backed by Draper Dragon" logo | 32×32 |
| `assets/escrow.svg` | Escrow product visual | 600:210 aspect |
| `assets/icon-blockchain.svg` | "Blockchain infrastructure" icon | square |
| `assets/icon-ai.svg` | "AI escrow and payments" icon | square |
| `assets/icon-stablecoin.svg` | "Stablecoin payments" icon | square |
| `assets/cat.svg` | Cat illustration | 360×360 (desktop), 240×240 (mobile) |

Raster files (`.png`/`.jpg`/`.webp`) are fine too — just update the matching
`src` in `index.html` to the new extension.

## Still to confirm

- **Footer GitHub link** currently points to `https://github.com/pbwebdev`.
  Update to the real Moshi Concepts organization URL.
- The "Read more about the escrow platform" link and the hero CTA both anchor to
  the on-page escrow section. Point them at a dedicated page once one exists.

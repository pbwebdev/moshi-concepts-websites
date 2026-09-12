# Moshi Concepts — Landing Page

Single-page marketing site for **Moshi Concepts**, a research and product studio
working at the intersection of blockchain, applied AI, and stablecoin payments.
Its first product is an on-chain escrow platform built on Cardano.

Built as a static site (plain HTML + CSS) from the v2 design handoff, with a
tiny Cloudflare Worker behind it for the contact form. No build step; the
JavaScript on the page is progressive enhancement only.

Sections, in order: nav · hero · **01** Our first product (escrow flow card) ·
**02** The bigger picture (trust-layer diagram) · **03** Where we're looking (three
cards) · **04** Who we are (founder) · dark CTA · footer.

## Structure

```
public/             # the static site (served as-is)
  index.html        #   the page
  styles.css        #   all styles (mobile-first; desktop from 960px up)
  eco.js            #   trust-layer ring parallax (progressive enhancement)
  contact.js        #   contact form submit-in-place (progressive enhancement)
  _headers          #   Cloudflare security + caching headers
  assets/           #   images
src/worker.mjs      # Cloudflare Worker: serves public/, handles POST /api/contact
test/               # worker unit tests (`node --test test/worker.test.mjs`)
wrangler.jsonc      # Worker + static-assets config used by `npx wrangler deploy`
```

## Running locally

Serve the `public/` folder (the form needs an HTTP origin, not `file://`):

```bash
python3 -m http.server 8000 --directory public
# then visit http://localhost:8000
```

To run the worker too (contact form included), use `npx wrangler dev` with the
three variables below in a local `.dev.vars` file (git-ignored).

## Deployment

Hosted on **Cloudflare Workers**: `wrangler.jsonc` deploys `src/worker.mjs`
with `public/` as its static assets. Pushes to `main` auto-deploy. The contact
form needs three variables set in the Cloudflare dashboard — see
[`DEPLOY.md`](DEPLOY.md).

## Design fidelity

Recreated from the two designed breakpoints — desktop (1440) and mobile (390)
— as one responsive page with a single breakpoint at 960px (the point where the
full text nav fits). The site canvas is capped at 1440px and centered.

Design tokens live as CSS custom properties at the top of `styles.css`.
Fonts are loaded from Google Fonts: `Zen Kaku Gothic New` (500, 700) and
`Inter` (400, 500).

The escrow flow diagram and its arrows are built in HTML/CSS (not an image),
so the copy and spacing stay editable.

**The bigger picture (02)** follows design's mockup for the trust layer:
copy on the left (eyebrow, headline, intro, and a "Global use cases" list) and
the ecosystem diagram on the right — a black Moshi hub with a soft halo and
seven use-case nodes on a gold dotted orbit, each labelled with a white pill
placed to its outer side. It is real HTML/SVG rather than the low-res mockup
crop: the seven line icons are inline SVG and the orbit is a generated SVG. The
diagram's geometry is a 780×560 reference expressed in container-query units
(`cqw`), so it scales with whatever column it sits in; each node sits at a
precomputed ring position given as percentage `left`/`top` in the CSS
(`:nth-child` rules), because some browsers resolve `cqw` to zero inside
`transform`. Keeping the positions in the stylesheet also means a stale
HTML/CSS pairing after a deploy can never leave the nodes unplaced; the page
and stylesheet are served `no-cache` (see `_headers`) and the generated SVGs
carry a `?v=` stamp so regenerated art isn't served stale. From 1200px the text
sits beside the diagram; from 960–1199px the diagram sits full-width below the
text; under 960px it becomes a vertical list of use-case cards (ringed icon,
title, one-line description, gold arrow chip) in reading order, with the hub
and the "Global use cases" block hidden, per the mobile mockup.

The ring is interactive on desktop as a progressive enhancement: `eco.js`
(same-origin, so it passes the CSP) nudges the nodes, orbit and hub toward the
cursor at different depths for a parallax feel, hovering a node lifts it with a
gold ring, and the nodes float slowly at rest. All of it is skipped on touch
devices and when the OS asks for reduced motion; the diagram is complete and
correctly placed with JavaScript off.

**The dark CTA** carries the three pillars from the same reference — Open
systems / Real utility / Global impact — on a gold rule in the right column,
over a generated dotted network wave (`assets/cta-wave.svg`).

## Contact form

The page never exposes an email address. The form in the dark CTA section
(`#contact`) POSTs to `/api/contact`, handled by `src/worker.mjs`, which
validates the submission and sends it through [Resend](https://resend.com)
with the submitter's address as `Reply-To`.

- **Configuration** lives only in the Cloudflare dashboard (Worker → Settings →
  Variables and Secrets): `RESEND_API_KEY` (secret), `CONTACT_TO` (where
  messages go) and `CONTACT_FROM` (a sender on a domain verified in Resend).
  Until they're set the endpoint answers 503 and the form shows a friendly
  "not configured yet" message.
- **Spam:** a honeypot field bots fill and people can't see, and a timing check
  (`contact.js` stamps the form on load; a submit within 3 s is dropped). Both
  answer with a fake success so bots learn nothing. Add Cloudflare Turnstile if
  volume ever warrants it.
- **Without JavaScript** the form still works: a plain POST, and the worker
  redirects back to `/#contact-sent` or `/#contact-error`, which reveal a
  `:target` message in the form.
- The CSP allows same-origin `form-action` and `connect-src` for this; the
  Resend key never reaches the browser.

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
| `assets/eco-orbit.svg` | Trust-layer orbit ring, spokes, dots | Generated, decorative (`alt=""`) |
| `assets/cta-wave.svg` | Dark CTA dotted network wave | Generated, decorative (`alt=""`) |
| `assets/favicon.svg` | Browser tab icon | Cat mark |

**Step icons:** the four escrow-step icons were cut from the original composite
flow illustration (the same artwork, at full resolution). If standalone exports
become available, drop them in under the same filenames — nothing else changes.

To swap any image: place the new file in `assets/` and, if the extension
differs, update the matching `src` in `index.html`. Keep large raster art
optimized (resize to ~2× display size; WebP for photos, palette PNG for flat art
with transparency).

# Moshi Concepts , Landing Page

Single-page marketing site for **Moshi Concepts**, which builds non-custodial,
programmable payment infrastructure for digital commerce. Its first product is
**Hokan**, a Cardano-first escrow platform, currently an **MVP in active
development**. Hokan has its own site at [usehokan.com](https://usehokan.com/),
which this page links out to from the hero, from section 01, from the closing
call to action, and from the footer.

The positioning the page has to carry: escrow is the wedge, programmable
settlement is the platform, and the product is being built rather than shipped.

**Outbound links.** Everything leaving the site opens in a new tab with
`rel="noopener"`. Text links get a corner arrow; the Draper Dragon credit is a
logo lockup and goes without one. The credit appears twice, in the hero and the
footer, and both point at draperdragon.com. Its shield image is marked
decorative (`alt=""`) because the link's own text already names the firm, so a
screen reader announces it once rather than twice.

Built as a static site (plain HTML + CSS) from the v2 design handoff, with a
tiny Cloudflare Worker behind it for the contact form. No build step; the
JavaScript on the page is progressive enhancement only.

Sections, in order: nav · hero · **01** Our first product (Hokan, escrow flow
card) · **02** The bigger picture (use-case ring and the staged progression) ·
**03** Where we're going (three themes, network and revenue notes) · **04**
Company (founder) · dark CTA · footer.

Section ids are `#build`, `#platform`, `#vision`, `#company` and `#contact`.
The nav labels them Hokan, Platform, Vision, Company and Talk to us.

## Structure

```
public/             # the static site (served as-is)
  index.html        #   the page
  styles.css        #   all styles (mobile-first; desktop from 960px up)
  eco.js            #   trust-layer ring parallax (progressive enhancement)
  reveal.js         #   fades content blocks in as they scroll into view
  contact.js        #   contact form submit-in-place (progressive enhancement)
  analytics.js      #   Google Analytics 4, gated on consent, loaded when idle
  consent.js        #   the cookie banner, and the only thing that starts GA
  _headers          #   Cloudflare security + caching headers
  assets/           #   images
  llms.txt          #   summary for language models (hand-written)
  llms-full.txt     #   the page as markdown (generated: node tools/llms.mjs)
src/worker.mjs      # Cloudflare Worker: serves public/, handles POST /api/contact
test/               # unit tests (`node --test test/*.test.mjs`)
  worker.test.mjs   #   the contact-form worker
  discoverability.test.mjs # robots, llms.txt, indexing meta
  csp.test.mjs      #   the content security policy vs what the page loads
  performance.test.mjs #  fonts, image formats, preloads and asset budgets
  consent.test.mjs  #   the consent gate, including analytics run in a sandbox
  positioning.test.mjs #  product stage, escrow terms, claims we must not make
  motion.test.mjs   #   the scroll reveal: what it hides, and when it must not
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
form needs three variables set in the Cloudflare dashboard , see
[`DEPLOY.md`](DEPLOY.md).

## Design fidelity

Recreated from the two designed breakpoints , desktop (1440) and mobile (390)
, as one responsive page with a single breakpoint at 960px (the point where the
full text nav fits). The site canvas is capped at 1440px and centered.

**Corporate structure.** The site says the company is a Delaware corporation
whose research and engineering happen in Australia. That appears in three
places, which have to move together: the footer legal line, the second
paragraph of section 04, and the `location` on the `Organization` in the
JSON-LD. `public/llms.txt` repeats it, and `llms-full.txt` picks the first two
up on regeneration.

It says where the work happens, and deliberately claims **no Australian
entity**, because none is registered yet. Once the Australian company exists,
the wording can be upgraded to name it: say the parent owns it in the three
places above, and in the JSON-LD replace the bare `location` with a
`subOrganization` carrying the registered name and a `parentOrganization`
pointing back at `#organization`. Until then, describing a subsidiary that
does not exist would be a false statement about corporate structure on a page
investors read.

**Product stage.** Hokan is being built, and the site has to read that way.
The stage badge (`.stage`) appears in the hero and again beside the section-01
heading, the spec strip says "Initial planned assets" rather than "Assets", and
the copy uses "is designed to" rather than the present tense for behaviour that
is not yet running. `test/positioning.test.mjs` fails if any of that is lost.

**Claims to keep out.** No absolute pre-launch safety, custody, audit or
regulatory claims: no "funds can never be lost", no "cannot access funds", no
"not a money transmitter". Custody is described by architecture, as
non-custodial infrastructure where funds are controlled by smart-contract
rules. The same test asserts these stay absent.

**Chain positioning.** Cardano is the launch network, not the only one. The
spec strip reads "Cardano first" on desktop and "Cardano" on mobile via
`.spec__long`, and a note under section 03 says expansion is part of the
longer-term roadmap without promising dates.

**The progression** (`.rail`) draws the seven stages from the Hokan MVP through
to additional networks, with only the first marked as underway and a line
saying the rest describe direction rather than committed dates. It is a
vertical timeline on mobile and a horizontal rail on desktop, and it spans both
grid columns from 1200px up.

**Renaming Hokan.** The name may have to change after trademark clearance, so
nothing structural depends on it: no class, id, selector or asset filename
contains it. Renaming is a find and replace across `public/index.html` and
`public/llms.txt`, then `node tools/llms.mjs`. A test enforces that property.

Design tokens live as CSS custom properties at the top of `styles.css`.
Fonts are `Zen Kaku Gothic New` (500, 700) and `Inter` (400 to 500), served
from this origin rather than Google. See [`tools/fonts.md`](tools/fonts.md).

The escrow flow diagram and its arrows are built in HTML/CSS (not an image),
so the copy and spacing stay editable.

**The bigger picture (02)** follows design's mockup for the trust layer:
copy on the left (eyebrow, headline, intro, and a "Global use cases" list) and
the ecosystem diagram on the right , a black Moshi hub with a soft halo and
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

**Where we're looking (03)** answers the cursor: a card picks up a gold border,
a soft gold glow and a 2px lift, and each chip lights up gold on its own. Both
sit behind `@media (hover: hover)` so a tap on a phone doesn't leave the state
stuck on, and `prefers-reduced-motion` drops the lift and the fades while
keeping the colour change. The glow mixes `--accent-rgb`, which has to stay in
step with `--accent` if the brand colour ever moves.

**The dark CTA** carries the three pillars from the same reference , Open
systems / Real utility / Global impact , on a gold rule in the right column,
over a generated dotted network wave (`assets/cta-wave.svg`).

## Analytics

Google Analytics 4, measurement ID in `public/analytics.js`. Google's own
snippet is an async tag in the head plus an inline `<script>` to configure it.
Neither is used here, for two reasons.

- **The inline block would cost the policy.** `script-src` has no
  `'unsafe-inline'`, and adding it to admit six lines of configuration would
  admit every injected script too. The configuration lives in `analytics.js`
  instead, same-origin, which `'self'` already covers.
- **gtag.js is big and runs on the main thread.** Fetching it during page load
  competes with the hero image for bandwidth and adds work inside the window
  Lighthouse scores. `analytics.js` queues the pageview immediately, then
  fetches Google's script only once the page has loaded and the browser is
  idle, or the moment the visitor scrolls, clicks or types. gtag.js replays
  whatever is already on `dataLayer` when it arrives, so nothing is lost.

Measured at 4x CPU throttling, adding this moved FCP and LCP by about 12ms,
which is inside run-to-run noise, and cost one request and roughly 2 KB.
gtag.js was not fetched before the load event in any run.

The trade is that a visitor who leaves within a second or two may never
trigger the load. If precise bounce counting ever matters more than the
score, drop the idle wait in `analytics.js` and let it fire on `load`.

### Consent

The default is no tracking. `analytics.js` only defines `window.startAnalytics`
and waits; `consent.js` calls it on an explicit accept and at no other time. So
nothing Google-owned is fetched and no analytics cookie is set for a visitor
who has declined or has not answered yet. With JavaScript off there is no
banner and no analytics, which is the safe way round.

- **The choice lives in `localStorage`**, not a cookie, so asking for consent
  does not set the thing being asked about. Every access is wrapped: storage
  throws rather than returning nothing in a locked-down browser, and a failed
  read is treated as no answer rather than as a yes.
- **Both answers are the same size** and equally reachable. A decline that is
  harder to find than an accept is not a real choice.
- **The banner is `position: fixed`**, so revealing it shifts nothing.
  Measured cumulative layout shift with it showing is zero.
- **"Cookie settings" in the footer** reopens it, so a decline can be undone.
  It is always rendered rather than revealed by script, which is what keeps
  the shift at zero.
- A `version` on the stored record retires old answers, for when what is being
  asked changes.

`test/consent.test.mjs` runs `analytics.js` against a stand-in browser and
asserts that loading it appends no script, registers no listener, schedules no
work and creates no `dataLayer` until `startAnalytics` is called. That is the
gate, tested by behaviour rather than by grepping the source.

## Performance

The page is static HTML with no framework, so most of the work is in what it
loads rather than what it runs.

**Fonts are self-hosted.** Loading them from Google meant a render-blocking
stylesheet on another origin plus two extra connections before the first font
byte. They now live in `public/assets/fonts/`, declared by `styles.css` itself,
so there is no extra request at all, and the two faces above the fold are
preloaded. Inter is the variable cut, which covers both weights in one file
instead of two, and every file is subset to the Latin ranges the page and the
contact form need. Total: 48 KB for two faces. The full story, and how to
rebuild them, is in [`tools/fonts.md`](tools/fonts.md).

**Raster art ships as AVIF with a PNG fallback**, chosen by the browser through
`<picture>`. For this artwork WebP was actually *larger* than the palette PNGs
it would have replaced, while AVIF cut the icon set from 106 KB to 41 KB. The
wrapper carries `display: contents` so it disappears from layout and every rule
that sizes the `<img>` as a flex child still applies.

**The hero is offered at seven widths** through `srcset` and `sizes`, so a 1x
display takes 23 KB where a 2x one takes 71. Before this every device
downloaded the 2x file. `sizes` has to keep describing the real layout, which
is half the content width from 960px up and full width below it; get it wrong
and the browser picks the wrong file.

**Everything below the fold is lazy**, including the two decorative SVGs, one of
which is 24 KB. The hero is the exception: it carries `fetchpriority="high"` and
must never be made lazy, because it is the LCP element.

**Every asset URL carries a `?v=` stamp**, which is what lets `/assets/*` be
cached for a year as immutable. A changed file must get a changed stamp, or
visitors hold the old one for a year. `test/performance.test.mjs` fails if an
asset is referenced without a stamp.

**The stylesheet is minified.** `public/styles.css` is the source;
`public/styles.min.css` is generated by `node tools/minify.mjs` and is what the
page loads. The minifier is deliberately dull: it strips comments and collapses
whitespace, and leaves strings, `url()` and anything inside `calc()` alone,
because a space in `calc((100vw - 240px) / 2)` is load-bearing. Gzipped it is
5.0 KB against the source's 8.5 KB. `test/performance.test.mjs` re-runs the
minifier and fails if the committed file has drifted.

Measured at 4x CPU throttling, median of five runs: FCP and LCP both 184ms,
cumulative layout shift 0, total blocking time 30ms, and 47 KB over 18 requests
for the initial load.

Cloudflare Web Analytics is still injected at the edge and accounts for the
longest request chain on the page. See [`DEPLOY.md`](DEPLOY.md); it cannot be
changed from here.

**Colour contrast.** `--accent-hover` used to do two jobs, and failed one of
them: as text it was 3.3:1 on white and 3.1:1 on the tint, under the 4.5:1
minimum. Darkening it far enough would have pushed the black label on the
button's hover background under the same threshold, so the two jobs are now
separate tokens: `--accent-hover` for text, `--accent-press` for the background
black text sits on. Keep them apart.

One thing deliberately left alone: the page, stylesheet and scripts are served
`no-cache` even though they carry `?v=` stamps that would allow year-long
caching. That trades one conditional request for the guarantee that a forgotten
stamp can never serve a stale stylesheet for a year.

## Motion

Content blocks fade up as they come into view: 20px of lift over 620ms, with
siblings staggered 70ms apart so a row of cards arrives one at a time rather
than as a slab.

**What fades is the thing to get right.** The first version animated whole
sections and read as no animation at all. A section's box begins 138 to 193px
above its first line of text, so the fade was spent on empty padding: by the
time a heading appeared at the bottom of the screen it was already at 0.62 to
0.84 opacity, and fully opaque before it was anywhere near readable. The
animated blocks are now the ones a reader actually looks at, listed in `GROUPS`
at the top of [`public/reveal.js`](public/reveal.js). Nothing in that list may
be a whole section, and `test/motion.test.mjs` fails if one appears.

**The fade is time-based, not scroll-linked.** CSS scroll-driven animation
(`animation-timeline: view()`) is the more elegant mechanism and needs no
script, but it advances only as far as the reader scrolls, so a flick of the
wheel skips it. A transition always plays its full 620ms. That is the whole
reason this costs a 1 KB script.

**Two observers, not one.** The main one pulls the root up 12% from the bottom
edge, so a block starts moving once it is properly on screen instead of while
it is still clipped by the fold. That margin puts the foot of the document out
of reach: when the page will not scroll any further, the last blocks sit inside
that 12% and can never enter the root. A second observer at `threshold: 1`
catches anything fully in view. Without it the footer stays invisible
permanently, which is exactly what happened in testing.

Three things keep a failure from turning into a blank page, each of them tested:

- **Nothing is hidden by CSS alone.** `.reveal` is added by the script, and
  only to blocks still below the fold. With no JavaScript the page renders
  complete. Anything already on screen is left alone, since hiding it then
  would flicker content the visitor has already seen.
- **Printing is reset.** Paper never scrolls, so whatever was hidden would
  print blank.
- **Reduced motion means none.** The script returns before it hides anything,
  and the stylesheet exempts `.reveal` as well.

Only `opacity` and `transform` are animated, so the work stays on the
compositor and cumulative layout shift stays at 0, measured on mobile, tablet
and desktop.

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

## SEO and social sharing

The page targets *programmable payments*, *non-custodial escrow*, *payment
infrastructure*, *stablecoin settlement* and *Cardano escrow* through both the
copy and the metadata:

- `<title>`, meta description, canonical URL (`https://moshiconcepts.com/`),
  `robots` hints, and a full Open Graph + Twitter card set pointing at an
  absolute 1200×630 image (`public/assets/og.jpg`).
- JSON-LD structured data: `Organization` (founder, funded by Draper Dragon,
  logo `assets/logo.png`, `owns` the product), `WebSite`, `WebPage`, and Hokan as
  a `Product` whose `url` is `https://usehokan.com/`. It's a data block, so the
  strict CSP doesn't affect it. Validate with Google's Rich Results Test after
  changes.
- `public/robots.txt` (blocks `/api/`) and `public/sitemap.xml`.
- The hero image carries `fetchpriority="high"` (it's the LCP element).

### Reading by AI

Everything is open to AI crawlers, and the page is plain server-rendered HTML,
so nothing has to run JavaScript to read it.

- `public/llms.txt` is the summary written for language models: what the
  company is, the key facts, and where to go next. Hand-written.
- `public/llms-full.txt` is the whole page as markdown. **Generated** , run
  `node tools/llms.mjs` after changing page copy, or the drift check in
  `test/discoverability.test.mjs` fails.
- `robots.txt` names the AI crawlers explicitly and allows them. A crawler that
  finds its own name ignores the wildcard group, so each group repeats the same
  rules, with `Disallow` before `Allow` so first-match parsers reach the same
  answer as longest-match ones.
- The robots meta sets `max-snippet:-1`, so nothing caps how much may be quoted.
- `test/discoverability.test.mjs` guards all of the above, since none of it
  changes the rendered page when it breaks.

**The repo can't open the edge.** Cloudflare's AI crawler blocking, Bot Fight
Mode or a WAF rule will stop crawlers before robots.txt is read. See
[`DEPLOY.md`](DEPLOY.md) for what to check and how to verify with curl.

**Social card:** `tools/og-card.html` is the source. Regenerate by screenshotting
it at 1200×630 (e.g. with Playwright) and saving as `public/assets/og.jpg`. It
uses the site's own hero art and tokens; when Google Fonts aren't available to
the renderer it falls back to a system sans, so for a pixel-perfect card render
it on a machine with `Zen Kaku Gothic New` installed , or drop in a designer-made
1200×630 JPG under the same filename. If the live domain changes, update the
`https://moshiconcepts.com` URLs in `index.html`, `robots.txt` and `sitemap.xml`.

## Images

All artwork lives in `assets/`, downscaled and compressed for the web (photos
as WebP; flat art as palette PNG). Fits are tuned per image in `styles.css`.

The hero is the page's LCP element, so it ships as a `<picture>`: an AVIF that
modern browsers take, and a WebP fallback for the rest. Both are the same
1184x980 art, which is 2x its largest display size (600px wide, in the desktop
hero column). The source export carries a wide white margin either side; that
margin is trimmed in the asset so the globe fills the column, and because the
art's background and the page are both white, the margin that remains is
invisible. The image is never cropped by CSS: it scales with its column at its
own aspect ratio, so no edge of the composition can be cut off. Its intrinsic
`width`/`height` are on the `<img>` so the layout does not shift while it
loads.

| File | Slot | Notes |
| --- | --- | --- |
| `assets/hero.avif` | Hero image | Served first; AVIF is ~30% smaller than the WebP at the same quality |
| `assets/hero.webp` | Hero image fallback | Same art, for browsers without AVIF |
| `assets/draper-dragon.png` | "Backed by Draper Dragon" credit | Red shield on white; `contain`. Used twice, in the hero and the footer |
| `assets/step-payer.png` | Escrow step 1 · Payer | Shown unclipped: the art draws its own ring and badge |
| `assets/step-lock.png` | Escrow step 2 · Funds locked | " |
| `assets/step-validate.png` | Escrow step 3 · Conditions verified | " |
| `assets/step-release.png` | Escrow step 4 · Receiver | " |
| `assets/icon-blockchain.png` | Card 01 icon | `contain` |
| `assets/icon-ai.png` | Card 02 icon | `contain` |
| `assets/icon-stablecoin.png` | Card 03 icon | `contain` |
| `assets/founder.webp` | Founder photo | Square source, `cover`-cropped to the 280×340 portrait (140×170 mobile), radius 8 |
| `assets/eco-orbit.svg` | Trust-layer orbit ring, spokes, dots | Generated, decorative (`alt=""`) |
| `assets/cta-wave.svg` | Dark CTA dotted network wave | Generated, decorative (`alt=""`) |
| `assets/favicon.svg` | Browser tab icon | Cat mark |

**Step icons:** the four escrow-step icons were cut from the original composite
flow illustration (the same artwork, at full resolution). If standalone exports
become available, drop them in under the same filenames , nothing else changes.

To swap any image: place the new file in `assets/` and, if the extension
differs, update the matching `src` in `index.html`. Keep large raster art
optimized (resize to ~2× display size; WebP for photos, palette PNG for flat art
with transparency).

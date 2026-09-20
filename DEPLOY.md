# Deploying to Cloudflare

The site runs on **Cloudflare Workers**. `wrangler.jsonc` describes the
deployment: `src/worker.mjs` is the Worker and `public/` is served as static
assets (the Worker only runs for `POST /api/contact`; everything else is served
straight from the assets). The connected Git integration runs
`npx wrangler deploy` on every push to **`main`**.

- **Production branch:** `main` · **Build command:** none ·
  **Deploy command:** `npx wrangler deploy` · **Root directory:** `/`
- Live (workers.dev): https://moshi-concepts-websites.mail-e4c.workers.dev

## One-time: configure the contact form

The form sends through [Resend](https://resend.com). Nothing sensitive is in the
repo; set these in the dashboard under the Worker → **Settings → Variables and
Secrets** (add each as type **Secret** so they're encrypted and survive deploys).
**Use the top-level "Variables and Secrets" panel — not the one inside
Settings → Builds.** The Builds panel holds *build-time* secrets for
`npx wrangler deploy`; the running Worker never sees those, and the form will
report all three as missing:

| Name | Value |
| --- | --- |
| `RESEND_API_KEY` | An API key from Resend → **API Keys** (sending access is enough) |
| `CONTACT_TO` | The address that should receive messages |
| `CONTACT_FROM` | The sender, e.g. `Moshi Concepts <hello@yourdomain>` — must be on a domain **verified in Resend** |

In Resend, verify the sending domain first (Resend → **Domains** → add the
domain → create the DNS records it lists — easy if the DNS is on Cloudflare).
Until the domain is verified, Resend only delivers from `onboarding@resend.dev`
to the account owner's own address, which is fine for a first test.

After saving the secrets there's nothing to redeploy: the running Worker reads
them on the next request. Test by submitting the form on the live site.

## Ongoing deploys

Push to `main`. Cloudflare clones, runs `npx wrangler deploy`, and the new
version is live in about a minute. No build step, no environment variables in
the repo. `keep_vars` in `wrangler.jsonc` stops deploys from wiping variables
set in the dashboard.

## Custom domain

Worker → **Domains** (or **Settings → Domains & Routes**) → **Add** → enter the
hostname. If the domain's DNS is on this Cloudflare account, records and SSL are
automatic; otherwise Cloudflare shows the record to add at your registrar.

## Letting AI crawlers in

The repo says everything is open: `public/robots.txt` names the AI crawlers and
allows them, the page carries `index, follow, max-snippet:-1`, and no header
sets `X-Robots-Tag`. **Cloudflare can still block them at the edge, before any
of that is read.** Check these in the dashboard for the zone, not the Worker:

| Where | Setting | Wanted |
| --- | --- | --- |
| Security → Bots | **Block AI bots** / AI Scrapers and Crawlers | Off |
| Security → Bots | **Bot Fight Mode** | Off, or AI crawlers allowed |
| Security → WAF | Managed rules and custom rules matching bot traffic | No rule blocking these user agents |
| Security → Settings | **AI Labyrinth** | Off |

Cloudflare turns AI crawler blocking on by default for some new zones, so the
answer is not obviously "we never enabled it" — look rather than assume.

To confirm from outside, request the page as a crawler and expect `200`:

```sh
curl -sI -A "ClaudeBot/1.0" https://moshiconcepts.com/ | head -1
curl -sI -A "GPTBot/1.1"   https://moshiconcepts.com/llms.txt | head -1
```

A `403`, a `503`, or an HTML challenge page means the edge is blocking, and
nothing in this repo can undo that.

## Cloudflare Web Analytics is now redundant

The zone still injects Cloudflare's `beacon.min.js`. Since the site added
Google Analytics 4, that is a second analytics tool measuring the same page,
and PageSpeed charges for it three times over:

| Finding | Cost |
| --- | --- |
| Transfer | 10 KiB |
| Legacy JavaScript | 10.7 KiB of polyfills we do not need |
| Longest critical request chain | 459 ms, through `/cdn-cgi/rum` |

None of it can be fixed from this repository, because Cloudflare injects the
script at the edge. Turn it off under the zone's **Analytics → Web Analytics**,
or keep it and accept those three findings.

There is a second reason to prefer one or the other. The cookie banner gates
Google Analytics and nothing else, so Cloudflare's beacon runs regardless of
what a visitor chooses. It is cookieless, which is the usual argument for
leaving it outside consent, but it is worth deciding rather than inheriting.

If you do turn it off, the content policy can drop
`https://static.cloudflareinsights.com` from `script-src` and
`https://cloudflareinsights.com` from `connect-src` in `public/_headers`.

## Notes

- Moving the site into `public/` is what lets the Worker source, config and
  docs stay out of what's served.
- `public/_headers` sets security headers (CSP allows same-origin form posts and
  fetches for the contact form), caches `/assets/*` for a day, and serves the
  page, stylesheet and scripts `no-cache` so a deploy can never leave them out of
  step with each other.

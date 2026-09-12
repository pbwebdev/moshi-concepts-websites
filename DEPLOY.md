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
Secrets** (add each as type **Secret** so they're encrypted and survive deploys):

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

## Notes

- Moving the site into `public/` is what lets the Worker source, config and
  docs stay out of what's served.
- `public/_headers` sets security headers (CSP allows same-origin form posts and
  fetches for the contact form), caches `/assets/*` for a day, and serves the
  page, stylesheet and scripts `no-cache` so a deploy can never leave them out of
  step with each other.

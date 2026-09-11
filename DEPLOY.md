# Deploying to Cloudflare Pages

This is a static site (no build step), deployed via Cloudflare Pages' Git
integration. Production branch: **`main`**. Every push to `main` auto-deploys.

## One-time setup (Cloudflare dashboard)

1. Go to the Cloudflare dashboard → **Workers & Pages** → **Create** →
   **Pages** → **Connect to Git**.
2. Authorize GitHub if prompted, then select the repository
   **`pbwebdev/moshi-concepts-websites`**.
3. Configure the build:
   - **Production branch:** `main`
   - **Framework preset:** `None`
   - **Build command:** *(leave empty)*
   - **Build output directory:** `/`
4. Click **Save and Deploy**. The first build publishes to a
   `*.pages.dev` URL (e.g. `moshi-concepts-websites.pages.dev`).

## Custom domain

In the new Pages project → **Custom domains** → **Set up a domain** → enter
the production hostname (e.g. `moshiconcepts.com` and/or `www.moshiconcepts.com`).
If the domain's DNS is already on Cloudflare, records are added automatically.

## Ongoing deploys

Push to `main` and Cloudflare rebuilds and republishes automatically. Pushes to
other branches produce preview deployments at their own URLs.

## Notes

- `_headers` sets security headers (CSP, `X-Content-Type-Options`, etc.) and a
  1-day cache on `/assets/*`. Adjust there if you enable extra Cloudflare
  features. The CSP already allows Cloudflare Web Analytics if you turn it on.
- No secrets or environment variables are required for this site.

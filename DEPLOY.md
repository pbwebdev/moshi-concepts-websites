# Deploying to Cloudflare

This static site is deployed on **Cloudflare Workers** using the **Static Assets**
model (Cloudflare merged Pages into Workers; the "import a repository" flow now
uses `npx wrangler deploy` rather than the old Pages build-output-directory flow).

- **Live (workers.dev):** https://moshi-concepts-websites.mail-e4c.workers.dev
- **Serves from:** the repo **root** (`index.html`, `styles.css`, `assets/`,
  `_headers`). The assets directory is configured in the Cloudflare dashboard,
  so no `wrangler.jsonc` is required in the repo.
- **Deploy command (dashboard):** `npx wrangler deploy`
- **Build command:** none · **Root directory:** `/`

## Ongoing deploys

Pushing to the connected branch triggers an automatic build and redeploy.
No build step, no secrets, no environment variables.

## Custom domain

In the Cloudflare dashboard → the **moshi-concepts-websites** Worker →
**Domains** (or **Settings → Domains & Routes**) → **Add** → enter the hostname
(e.g. `moshiconcepts.com` and `www.moshiconcepts.com`). If the domain's DNS is
already on this Cloudflare account, records and SSL are provisioned
automatically; otherwise Cloudflare shows the DNS record to add at your
registrar.

## Notes

- `public/`-style restructuring is **not** used — the dashboard expects the site
  at the repo root. Moving files into a subfolder would require also updating the
  Worker's assets directory setting, or adding a `wrangler.jsonc` with
  `assets.directory` pointing at the new folder.
- `_headers` (security headers + a 1-day cache on `/assets/*`) is honored by
  Workers Static Assets, the same as it was under Pages.

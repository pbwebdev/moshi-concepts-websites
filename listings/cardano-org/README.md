# cardano.org company listing: Moshi Concepts

These are the files for adding Moshi Concepts to
[Entities Building on Cardano](https://cardano.org/entities), following
[cardano-foundation/cardano-org#356](https://github.com/cardano-foundation/cardano-org/issues/356)
and the repo guide `docs/get-involved/add-company.md`.

This folder is not deployed. Wrangler only serves `public/`.

## Status: not eligible yet

The guide only accepts companies that qualify through one of two paths:

1. **A listed product.** The company has a product on
   [Cardano Applications](https://cardano.org/apps) or
   [Builder Tools](https://developers.cardano.org/tools) that "works today on
   Cardano mainnet, no coming soon, no preview, no promises".
2. **Core development.** The company maintains a core IntersectMBO repository,
   or it was the vendor of an enacted treasury withdrawal.

Hokan is an MVP in active development, so Moshi Concepts doesn't meet path 1
yet. It doesn't meet path 2 either. The `entry.json` here is ready to submit
once Hokan clears these steps:

1. Hokan is live on mainnet.
2. Hokan is listed on cardano.org/apps (guide: `docs/get-involved/add-app.md`;
   needs a 2048×1440 WebP screenshot under 500 KB) or on Builder Tools (a PR to
   the developer portal repo that needs three reviewer approvals).
3. The company PR below is opened from an established GitHub account that the
   Cardano community knows.

## What goes into the cardano-org PR

| File here | Destination in cardano-org |
|---|---|
| `static/img/logos/moshiconcepts.svg` | `static/img/logos/moshiconcepts.svg` (light mode) |
| `static/img/logos/moshiconcepts-dark.svg` | `static/img/logos/moshiconcepts-dark.svg` (dark mode) |
| `entry.json` | add the object to `src/data/logosCompanies.json`, in alphabetical order (between the `M…` neighbours) |

Choices made against the guide's rules:

- **SVG only**, built from the same cat mark as the site's nav, with no
  raster images embedded.
- **No transparent border.** The viewBox is cropped to the mark's own
  bounds, so the logo doesn't render small.
- **Size of at least 600×600.** The declared size is 612×720.
- **Dark variant.** The head is white and the face is near-black, so the
  mark reads on a dark background. The amber eyes stay the same.
- **`showCompanyName: true`.** The mark has no wordmark, so cardano.org
  prints "Moshi Concepts" under it.
- **`link`** points at the company site (moshiconcepts.com) rather than the
  product site, as the guide requires.
- **`knownFor: "Hokan"`.** This must name the listed product, so it only
  becomes valid once Hokan is listed.

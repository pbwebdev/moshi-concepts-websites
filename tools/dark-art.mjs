/**
 * Makes the dark-mode versions of the artwork drawn on white.
 *
 * The hero globe and the flow-step icons are raster art on an opaque white
 * background, so in dark mode they would sit on the page as white boxes.
 * Rather than redraw them, each pixel is treated as ink on white paper:
 *
 *   1. Lift the ink off the white (colour-to-alpha against white). A pale
 *      yellow glow becomes yellow ink at low opacity; a grey shadow becomes
 *      black ink at partial opacity; white becomes nothing.
 *   2. Turn neutral ink light. Black line work, dots and labels become the
 *      dark theme's text colour; coloured ink keeps its hue.
 *   3. Lay it over the dark page colour.
 *   4. Keep strongly coloured pixels exactly as drawn, so the brand yellow
 *      is the brand yellow, not a dimmed version of it.
 *   5. Keep anything enclosed by the yellow exactly as drawn too. A black
 *      padlock or tick inside a yellow badge is drawn for contrast with the
 *      yellow, not the page, and turned light it all but disappears. Only
 *      small enclosures count, so the orbit ring around the whole globe does
 *      not freeze the globe inside it.
 *
 * Usage:  node tools/dark-art.mjs
 * Needs sharp:  npm i --no-save sharp   (not a dependency of the site)
 *
 * The outputs are committed. Re-run after replacing any of the source art.
 */
import sharp from 'sharp';
import { fileURLToPath } from 'node:url';

const assets = (p) => fileURLToPath(new URL(`../public/assets/${p}`, import.meta.url));

// Must match --page-bg and --ink in the stylesheet's dark block, or the
// art's margins show as a box.
const BG = [0x0C, 0x0A, 0x09];
const INK = [0xFA, 0xFA, 0xF9];

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function toDark(r, g, b) {
  // 1. Colour to alpha against white. The "white" in this art is not quite
  // white: it carries a faint warm cast, a level or two off 255. Lifted as
  // ink, that cast becomes a brownish wash across the whole image, which on
  // the dark page shows exactly where each image ends. So the faintest ink,
  // within about 4% of white, is treated as paper.
  const PAPER = 0.04;
  const a0 = Math.max(255 - r, 255 - g, 255 - b) / 255;
  const a = clamp((a0 - PAPER) / (1 - PAPER), 0, 1);
  let ink = [0, 0, 0];
  if (a0 > 0) ink = [r, g, b].map((c) => clamp((c - (1 - a0) * 255) / a0, 0, 255));

  // 2. Neutral ink becomes light; coloured ink keeps its colour.
  const inkChroma = Math.max(...ink) - Math.min(...ink);
  const k = clamp(1 - inkChroma / 120, 0, 1);
  ink = ink.map((c, i) => k * INK[i] + (1 - k) * c);

  // 3. Over the dark page.
  const over = ink.map((c, i) => c * a + BG[i] * (1 - a));

  // 4. Saturated pixels exactly as drawn.
  const chroma = Math.max(r, g, b) - Math.min(r, g, b);
  const w = clamp((chroma - 90) / 70, 0, 1);
  return over.map((c, i) => Math.round(w * [r, g, b][i] + (1 - w) * c));
}

/** Pixels in small regions fully enclosed by saturated colour: glyphs inside
    badges. Returns a Uint8Array mask, 1 where the original must be kept. */
export function enclosedBySaturated(data, width, height, maxShare = 0.03) {
  const n = width * height;
  // The walls are the coloured pixels themselves, with no dilation. The
  // glyphs are 2 to 3px strokes, and growing the walls by even a pixel
  // swallows them whole, leaving nothing to keep. A threshold lower than
  // toDark's picks up the antialiased rim of each badge instead.
  const wall = new Uint8Array(n);
  for (let p = 0; p < n; p++) {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 60) wall[p] = 1;
  }
  // Label the regions between the walls; keep the small ones that never
  // touch the image's edge.
  const keep = new Uint8Array(n);
  const seen = new Uint8Array(n);
  const stack = new Int32Array(n);
  for (let start = 0; start < n; start++) {
    if (wall[start] || seen[start]) continue;
    let top = 0, size = 0, edge = false;
    const members = [];
    stack[top++] = start; seen[start] = 1;
    while (top) {
      const p = stack[--top]; size++; members.push(p);
      const x = p % width, y = (p / width) | 0;
      if (x === 0 || y === 0 || x === width - 1 || y === height - 1) edge = true;
      for (const q of [p - 1, p + 1, p - width, p + width]) {
        if (q < 0 || q >= n || seen[q] || wall[q]) continue;
        if ((q === p - 1 && x === 0) || (q === p + 1 && x === width - 1)) continue;
        seen[q] = 1; stack[top++] = q;
      }
    }
    if (!edge && size < n * maxShare) for (const p of members) keep[p] = 1;
  }
  return keep;
}

async function convert(src) {
  const { data, info } = await sharp(assets(src)).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const keep = enclosedBySaturated(data, info.width, info.height);
  const out = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += 3) {
    if (keep[i / 3]) { out[i] = data[i]; out[i + 1] = data[i + 1]; out[i + 2] = data[i + 2]; continue; }
    const [r, g, b] = toDark(data[i], data[i + 1], data[i + 2]);
    out[i] = r; out[i + 1] = g; out[i + 2] = b;
  }
  return sharp(out, { raw: { width: info.width, height: info.height, channels: 3 } });
}

/** The hero, at the same widths as the light version. */
async function hero() {
  const master = await (await convert('hero-1184.webp')).png().toBuffer();
  for (const w of [400, 500, 600, 700, 800, 960, 1184]) {
    const img = sharp(master).resize({ width: w });
    // 4:4:4: the default 4:2:0 shifts a flat near-black a level or two
    // redder, and against the page that is enough to draw the image's edge.
    await img.clone().avif({ quality: 50, effort: 9, chromaSubsampling: '4:4:4' }).toFile(assets(`hero-dark-${w}.avif`));
    await img.clone().webp({ quality: 80, effort: 6 }).toFile(assets(`hero-dark-${w}.webp`));
  }
}

/** The four flow steps, as PNG and AVIF like the light ones. */
async function steps() {
  for (const name of ['step-payer', 'step-lock', 'step-validate', 'step-release']) {
    const img = await convert(`${name}.png`);
    const png = await img.png({ palette: true, quality: 90, effort: 10 }).toBuffer();
    await sharp(png).toFile(assets(`${name}-dark.png`));
    await sharp(png).avif({ quality: 70, effort: 9, chromaSubsampling: '4:4:4' }).toFile(assets(`${name}-dark.avif`));
  }
}

/** The Draper Dragon shield, cut out of its white square.

    This one is not recoloured: it is another company's mark. The shield is
    convex, so its outline is the convex hull of its red pixels: everything
    outside the hull goes, everything inside stays. That keeps the white
    emblem, whose arm runs off the image's top edge and so cannot be told
    apart from the background by flood-filling the white. The two pixels
    inside the rim are unblended from the white they were antialiased
    against, which is what stops a pale halo on dark. Over white the result
    matches the original, so the light theme uses the same file. */
function convexHull(points) {
  points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (pts) => {
    const h = [];
    for (const p of pts) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], p) <= 0) h.pop();
      h.push(p);
    }
    h.pop();
    return h;
  };
  return [...half(points), ...half([...points].reverse())];
}

function insideConvex(hull, x, y) {
  for (let i = 0; i < hull.length; i++) {
    const [ax, ay] = hull[i], [bx, by] = hull[(i + 1) % hull.length];
    if ((bx - ax) * (y - ay) - (by - ay) * (x - ax) < 0) return false;
  }
  return true;
}

async function draper() {
  // The original, with its white square, kept outside public/ so it is not deployed.
  const original = fileURLToPath(new URL('./art/draper-dragon-source.png', import.meta.url));
  const { data, info } = await sharp(original).removeAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height } = info;
  const n = width * height;
  const red = [];
  for (let p = 0; p < n; p++) {
    const r = data[p * 3], g = data[p * 3 + 1], b = data[p * 3 + 2];
    if (Math.max(r, g, b) - Math.min(r, g, b) > 60) red.push([p % width, (p / width) | 0]);
  }
  const hull = convexHull(red);
  const bg = new Uint8Array(n);
  for (let p = 0; p < n; p++) if (!insideConvex(hull, p % width, (p / width) | 0)) bg[p] = 1;
  const nearBg = (p) => {
    const x = p % width, y = (p / width) | 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx >= 0 && yy >= 0 && xx < width && yy < height && bg[yy * width + xx]) return true;
    }
    return false;
  };
  const out = Buffer.alloc(n * 4);
  for (let p = 0; p < n; p++) {
    const [r, g, b] = [data[p * 3], data[p * 3 + 1], data[p * 3 + 2]];
    let rgba = [r, g, b, 255];
    // Outside the outline and along its inner rim, unblend from white rather
    // than delete: pure white becomes fully transparent, and the shield's own
    // antialiased edge survives as partial red instead of being cut away.
    if (bg[p] || nearBg(p)) {
      const a = Math.max(255 - r, 255 - g, 255 - b) / 255;
      rgba = a === 0 ? [255, 255, 255, 0]
        : [...[r, g, b].map((c) => clamp(Math.round((c - (1 - a) * 255) / a), 0, 255)), Math.round(a * 255)];
    }
    out.set(rgba, p * 4);
  }
  const img = sharp(out, { raw: { width, height, channels: 4 } });
  await img.clone().png({ effort: 10 }).toFile(assets('draper-dragon.png'));
  await img.clone().avif({ quality: 60, effort: 9 }).toFile(assets('draper-dragon.avif'));
}

if (import.meta.url === `file://${process.argv[1]}`) {
  await hero();
  await steps();
  await draper();
  console.log('dark art written');
}

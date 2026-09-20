/**
 * Guards the things that make the page fast, all of which are easy to undo by
 * accident and none of which are visible when they regress: the fonts staying
 * same-origin, the images keeping their modern format, the preloads matching
 * the faces they preload, and the asset budgets.
 *
 * Run: node --test test/performance.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, statSync, existsSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

const pub = (p) => fileURLToPath(new URL(`../public/${p}`, import.meta.url));
const read = (p) => readFileSync(pub(p), "utf8");
const kb = (p) => statSync(pub(p)).size / 1024;

const html = read("index.html");
const css = read("styles.css");
const headers = read("_headers");

test("nothing on the critical path comes from another origin", () => {
  // A third-party stylesheet blocks rendering and costs a DNS lookup and a
  // TLS handshake before the first byte of CSS arrives.
  const blocking = [...html.matchAll(/<link[^>]*rel="stylesheet"[^>]*>/g)].map((m) => m[0]);
  for (const tag of blocking) {
    assert.doesNotMatch(tag, /https?:\/\//, `stylesheet loaded cross-origin: ${tag}`);
  }
  assert.doesNotMatch(html, /fonts\.googleapis\.com/, "still linking Google Fonts");
  assert.doesNotMatch(html, /fonts\.gstatic\.com/, "still connecting to gstatic");
});

test("the policy allows no external style or font source", () => {
  const csp = headers.match(/Content-Security-Policy:\s*(.+)/)[1];
  const directive = (name) =>
    csp.split(";").map((d) => d.trim()).find((d) => d.startsWith(name + " "))?.slice(name.length + 1).trim();
  assert.equal(directive("style-src"), "'self'", "style-src should need nothing but self");
  assert.equal(directive("font-src"), "'self'", "font-src should need nothing but self");
});

test("every declared font face points at a file that exists", () => {
  const faces = [...css.matchAll(/@font-face\s*\{[^}]*?src:\s*url\(([^)]+)\)[^}]*\}/gs)].map((m) => m[1]);
  assert.ok(faces.length >= 2, `expected at least two faces, found ${faces.length}`);
  for (const src of faces) {
    assert.ok(existsSync(pub(src)), `@font-face points at a missing file: ${src}`);
  }
});

test("preloaded fonts are fonts the stylesheet actually asks for", () => {
  // A preload that no @font-face matches downloads the file twice: once for
  // the preload and once for the real request.
  const preloads = [...html.matchAll(/<link[^>]*rel="preload"[^>]*href="([^"]+)"[^>]*>/g)].map((m) => m[1]);
  assert.ok(preloads.length > 0, "expected the above-the-fold faces to be preloaded");
  for (const href of preloads) {
    assert.ok(existsSync(pub(href)), `preloading a missing file: ${href}`);
    assert.ok(css.includes(href), `preloaded font is never used by the stylesheet: ${href}`);
  }
  // Fonts must be preloaded with crossorigin or the browser fetches twice.
  for (const tag of [...html.matchAll(/<link[^>]*rel="preload"[^>]*as="font"[^>]*>/g)].map((m) => m[0])) {
    assert.match(tag, /crossorigin/, `font preload needs crossorigin: ${tag}`);
  }
});

test("fonts are cached hard, because their names change when they do", () => {
  const block = headers.split(/\n(?=\/)/).find((b) => b.startsWith("/assets/fonts/*"));
  assert.ok(block, "no cache rule for the fonts");
  assert.match(block, /immutable/);
});

test("raster art is offered in a modern format with a fallback", () => {
  // Every PNG the page loads should sit inside a <picture> that offers AVIF,
  // and the AVIF should be the smaller of the two or there is no point.
  const pngs = [...html.matchAll(/<img[^>]*src="assets\/([^"]+)\.png"/g)].map((m) => m[1]);
  for (const name of new Set(pngs)) {
    const avif = `assets/${name}.avif`;
    assert.ok(existsSync(pub(avif)), `${name}.png has no AVIF alternative`);
    assert.match(
      html,
      new RegExp(`<source srcset="assets/${name}\\.avif" type="image/avif">`),
      `${name} is not offered as AVIF`,
    );
    assert.ok(
      kb(avif) < kb(`assets/${name}.png`),
      `${name}.avif is not smaller than the PNG it replaces`,
    );
  }
});

test("the wrappers do not disturb the layout they sit in", () => {
  // <picture> is only there for format negotiation. display:contents keeps
  // the <img> as the direct flex or grid child, so every rule sizing the
  // image still applies.
  assert.match(css, /picture\s*\{\s*display:\s*contents;\s*\}/);
});

test("images below the fold are lazy, and the hero is not", () => {
  const imgs = [...html.matchAll(/<img\b[^>]*>/gs)].map((m) => m[0]);
  const hero = imgs.find((t) => t.includes("hero-"));
  assert.ok(hero, "no hero image");
  assert.match(hero, /fetchpriority="high"/, "the LCP image should be prioritised");
  assert.doesNotMatch(hero, /loading="lazy"/, "the LCP image must not be lazy");

  for (const tag of imgs.filter((t) => !t.includes("hero-") && !t.includes("draper-dragon"))) {
    assert.match(tag, /loading="lazy"/, `below-the-fold image is not lazy: ${tag.slice(0, 70)}`);
  }
});

test("every image declares its dimensions, so nothing shifts while loading", () => {
  for (const tag of [...html.matchAll(/<img\b[^>]*>/g)].map((m) => m[0])) {
    assert.match(tag, /\bwidth="\d+"/, `image without width: ${tag.slice(0, 70)}`);
    assert.match(tag, /\bheight="\d+"/, `image without height: ${tag.slice(0, 70)}`);
  }
});

test("the hero is offered at several widths, so 1x screens take less", () => {
  // Without this every device downloads the 2x file. sizes has to describe
  // the real layout or the browser picks the wrong one.
  const picture = html.match(/<div class="hero__media">[\s\S]*?<\/picture>/)[0];
  const widths = [...picture.matchAll(/hero-(\d+)\.avif\?v=\d+\s+(\d+)w/g)];
  assert.ok(widths.length >= 3, `hero offered at only ${widths.length} widths`);
  for (const [, file, declared] of widths) {
    assert.equal(file, declared, "srcset width descriptor does not match the file");
    assert.ok(existsSync(pub(`assets/hero-${file}.avif`)), `missing hero-${file}.avif`);
    assert.ok(existsSync(pub(`assets/hero-${file}.webp`)), `missing hero-${file}.webp`);
  }
  assert.match(picture, /sizes="[^"]*min-width: 960px[^"]*"/, "sizes must describe the desktop column");
});

test("every asset the page loads carries a version stamp", () => {
  // /assets/* is cached for a year as immutable, which is only safe while a
  // changed file means a changed URL.
  const refs = [...html.matchAll(/(?:src|href)="(assets\/[^"]+)"/g)].map((m) => m[1]);
  const inSrcset = [...html.matchAll(/srcset="([^"]+)"/g)]
    .flatMap((m) => m[1].split(",").map((c) => c.trim().split(/\s+/)[0]));
  for (const url of [...refs, ...inSrcset]) {
    if (url.includes("/fonts/")) continue; // cached by filename instead
    assert.match(url, /\?v=\d+/, `asset referenced without a version stamp: ${url}`);
  }
});

test("the asset budgets still hold", () => {
  // Numbers chosen with headroom over what is shipping. They are here to
  // catch a full-resolution export dropped in by mistake.
  const budgets = [
    ["assets/hero-1184.avif", 90],
    ["assets/hero-600.avif", 35],
    ["assets/og.jpg", 150],
    ["assets/fonts/inter-var.woff2", 60],
    ["assets/fonts/zen-kaku-700.woff2", 20],
  ];
  for (const [file, max] of budgets) {
    assert.ok(kb(file) <= max, `${file} is ${kb(file).toFixed(1)} KB, over its ${max} KB budget`);
  }

  const fonts = readdirSync(pub("assets/fonts"));
  const total = fonts.reduce((sum, f) => sum + kb(`assets/fonts/${f}`), 0);
  assert.ok(total <= 60, `fonts total ${total.toFixed(1)} KB, over the 60 KB budget`);
});

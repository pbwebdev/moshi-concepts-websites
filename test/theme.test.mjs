/**
 * Guards the light and dark themes. The page follows the operating system's
 * setting, so most visitors only ever see one of them, and a regression in
 * the other goes unnoticed by whoever made it. Everything here is checked in
 * both.
 *
 * Run: node --test test/theme.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = (p) => fileURLToPath(new URL(`../${p}`, import.meta.url));
const read = (p) => readFileSync(root(p), "utf8");
const css = read("public/styles.css");
const html = read("public/index.html");

/** Custom properties declared directly in a block of declarations. */
function tokens(block) {
  return Object.fromEntries([...block.matchAll(/(--[a-z-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
}

const lightBlock = css.match(/:root \{([\s\S]*?)\n\}/)[1];
const darkBlock = css.match(/@media \(prefers-color-scheme: dark\) \{\s*:root \{([\s\S]*?)\n  \}/)?.[1];

const LIGHT = tokens(lightBlock);
const DARK = { ...LIGHT, ...tokens(darkBlock ?? "") };
const THEMES = { light: LIGHT, dark: DARK };

function rgb(value) {
  const m = /^#([0-9a-f]{6})$/i.exec(value);
  assert.ok(m, `not a six-digit hex colour: ${value}`);
  return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
}

function luminance([r, g, b]) {
  const lin = (c) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

function contrast(a, b) {
  const [hi, lo] = [luminance(rgb(a)), luminance(rgb(b))].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}

test("there is a dark theme, and it follows the system setting", () => {
  assert.ok(darkBlock, "no @media (prefers-color-scheme: dark) block redefining :root");
  assert.match(lightBlock, /color-scheme:\s*light dark/, "form controls and scrollbars will not follow the theme");
  assert.match(html, /<meta name="color-scheme" content="light dark">/);
  assert.match(html, /<meta name="theme-color" media="\(prefers-color-scheme: light\)" content="#FFFFFF">/);
  assert.match(
    html,
    new RegExp(`<meta name="theme-color" media="\\(prefers-color-scheme: dark\\)" content="${DARK["--page-bg"]}">`, "i"),
    "the browser chrome should match the dark page colour",
  );
});

test("the dark theme only redefines tokens the light theme has", () => {
  for (const name of Object.keys(tokens(darkBlock))) {
    assert.ok(name in LIGHT, `${name} is set in dark but has no light value`);
  }
});

test("text on the accent stays black in both themes", () => {
  // The buttons and arrow chips put black text on orange. If that text used
  // --ink, dark mode would turn it light, and light on orange fails.
  for (const name of ["--on-accent", "--accent", "--accent-deep"]) {
    assert.ok(!(name in tokens(darkBlock)), `${name} must not change in dark mode`);
  }
  const accentRules = [...css.matchAll(/\{[^{}]*background:\s*var\(--accent\);[^{}]*\}/g)].map((m) => m[0]);
  for (const rule of accentRules) {
    assert.doesNotMatch(rule, /color:\s*var\(--ink\)/, `text on the accent uses --ink: ${rule.slice(0, 80)}`);
  }
});

/** [foreground, background, what it is] for every text colour on every surface it meets. */
const PAIRS = [
  ["--ink", "--page-bg", "headings on the page"],
  ["--ink", "--tint", "headings on the tinted sections"],
  ["--ink", "--surface", "labels on the raised panels"],
  ["--body", "--page-bg", "body text on the page"],
  ["--body", "--tint", "body text on the tinted sections"],
  ["--body", "--surface", "body text in the cookie banner and cards"],
  ["--muted", "--page-bg", "small print on the page"],
  ["--muted", "--tint", "rail dates and notes on the tinted section"],
  ["--accent-hover", "--page-bg", "links and numbers on the page"],
  ["--accent-hover", "--tint", "links and numbers on the tinted sections"],
  ["--accent-hover", "--surface", "accent text on the raised panels"],
  ["--on-accent", "--accent", "button labels"],
  ["--on-accent", "--accent-press", "button labels on hover"],
];

for (const [theme, t] of Object.entries(THEMES)) {
  test(`every text colour meets WCAG AA in the ${theme} theme`, () => {
    for (const [fg, bg, what] of PAIRS) {
      const ratio = contrast(t[fg], t[bg]);
      assert.ok(ratio >= 4.5, `${theme}: ${what} (${fg} ${t[fg]} on ${bg} ${t[bg]}) is ${ratio.toFixed(2)}:1, under 4.5`);
    }
    const pressed = contrast("#FFFFFF", t["--accent-deep"]);
    assert.ok(pressed >= 4.5, `${theme}: white on the pressed button is ${pressed.toFixed(2)}:1`);
  });
}

test("no panel is hard-coded white, which would glare in dark mode", () => {
  // Backgrounds belong in tokens. The exceptions are deliberate: the hover
  // on the button inside the always-black contact section.
  const allowed = [".btn--dark:hover"];
  for (const m of css.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = m[1].trim().split("\n").pop().trim();
    if (!/background:\s*#FFFFFF/i.test(m[2])) continue;
    assert.ok(allowed.includes(selector), `${selector} has a hard-coded white background`);
  }
});

test("every dark image the page offers exists", () => {
  const sources = [...html.matchAll(/<source[^>]*media="\(prefers-color-scheme: dark\)"[^>]*>/g)].map((m) => m[0]);
  assert.ok(sources.length >= 6, `expected dark sources for the hero, the steps and the orbit; found ${sources.length}`);
  for (const tag of sources) {
    const srcset = tag.match(/srcset="([^"]+)"/)[1];
    for (const candidate of srcset.split(",")) {
      const url = candidate.trim().split(/\s+/)[0].replace(/\?.*$/, "");
      assert.ok(existsSync(root(`public/${url}`)), `missing dark image: ${url}`);
    }
  }
});

test("each dark source comes before the light one it replaces", () => {
  // A <picture> uses the first source that matches. A light source listed
  // first would match in dark mode too, and the dark one would never load.
  for (const pic of [...html.matchAll(/<picture>([\s\S]*?)<\/picture>/g)].map((m) => m[1])) {
    const sources = [...pic.matchAll(/<source[^>]*>/g)].map((m) => m[0]);
    const firstLight = sources.findIndex((s) => !s.includes("prefers-color-scheme"));
    const lastDark = sources.map((s) => s.includes("prefers-color-scheme: dark")).lastIndexOf(true);
    if (lastDark === -1) continue;
    assert.ok(lastDark < firstLight || firstLight === -1, `a light source shadows a dark one:\n${pic.trim().slice(0, 200)}`);
  }
});

test("the dark artwork was drawn on the dark page colour", () => {
  // tools/dark-art.mjs paints the art onto a fixed colour. If --page-bg
  // changes without regenerating, every image shows as a box.
  const tool = read("tools/dark-art.mjs");
  const bg = tool.match(/const BG = \[0x([0-9A-F]{2}), 0x([0-9A-F]{2}), 0x([0-9A-F]{2})\]/i);
  assert.ok(bg, "could not find BG in tools/dark-art.mjs");
  assert.equal(`#${bg[1]}${bg[2]}${bg[3]}`.toUpperCase(), DARK["--page-bg"].toUpperCase(),
    "dark art and the dark page colour have drifted; re-run node tools/dark-art.mjs");
  const ink = tool.match(/const INK = \[0x([0-9A-F]{2}), 0x([0-9A-F]{2}), 0x([0-9A-F]{2})\]/i);
  assert.equal(`#${ink[1]}${ink[2]}${ink[3]}`.toUpperCase(), DARK["--ink"].toUpperCase(),
    "the art's line work should be the dark theme's text colour");
});

test("the panel the step icons sit on is the page colour in both themes", () => {
  // The dark step icons are painted on --page-bg; the panel must match.
  assert.match(css, /\.flow \{[^}]*background:\s*var\(--page-bg\)/);
});

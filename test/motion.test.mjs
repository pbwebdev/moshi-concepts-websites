/**
 * Guards the scroll reveal. Every failure mode here is a page that looks
 * broken rather than a page that looks unanimated: content stuck at opacity 0
 * because the animation never ran, a printout blank below the hero, or motion
 * shown to someone whose system asked for none. None of that is visible in a
 * normal browser session, which is exactly why it needs asserting.
 *
 * Run: node --test test/motion.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("styles.css");
const headers = read("_headers");
const reveal = read("reveal.js");

/** The @supports block that holds the CSS half of the effect. */
const supportsBlock = (() => {
  const start = css.indexOf("@supports (animation-timeline: view())");
  assert.ok(start > -1, "the scroll-driven animation is gone from the stylesheet");
  // Walk the braces rather than regex them: this block nests a media query.
  let depth = 0;
  for (let i = css.indexOf("{", start); i < css.length; i++) {
    if (css[i] === "{") depth++;
    else if (css[i] === "}" && --depth === 0) return css.slice(start, i + 1);
  }
  throw new Error("unbalanced braces after @supports");
})();

test("the fade only ever hides a section conditionally", () => {
  // The one rule that can hold content at opacity 0 without JavaScript is the
  // animation. If it escaped the @supports block, a browser that cannot run
  // it would paint nothing below the hero and never recover.
  const animated = [...css.matchAll(/animation:\s*section-reveal[^;]*;/g)];
  assert.equal(animated.length, 1, "section-reveal is applied in more than one place");
  assert.ok(
    supportsBlock.includes(animated[0][0]),
    "section-reveal is applied outside @supports (animation-timeline: view())",
  );
  // .reveal is the JavaScript path's hiding class. It must not be in the
  // markup, or a visitor without JavaScript keeps it forever.
  assert.doesNotMatch(html, /class="[^"]*\breveal\b/, "a section ships pre-hidden in the HTML");
});

test("the animation is skipped under reduced motion and off screen media", () => {
  assert.match(
    supportsBlock,
    /@media screen and \(prefers-reduced-motion: no-preference\)/,
    "the scroll animation must be scoped to screen and to no-preference",
  );
  // The class-based path needs the same courtesy, stated separately because
  // reveal.js may already have added .reveal before the query is consulted.
  assert.match(css, /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.reveal\s*\{[^}]*opacity:\s*1/);
});

test("printing shows the whole page, not just the hero", () => {
  // animation-timeline has no meaning on paper, so `both` would freeze every
  // section on its first keyframe: opacity 0.
  const print = css.match(/@media print\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(print, "no print override for the reveal");
  assert.match(print, /animation:\s*none/);
  assert.match(print, /opacity:\s*1/);
  assert.match(print, /transform:\s*none/);
  for (const sel of ["#build", "#platform", "#vision", "#company", "#contact", ".footer", ".reveal"]) {
    assert.ok(print.includes(sel), `${sel} is not reset for print`);
  }
});

test("the fade animates nothing that costs a layout", () => {
  // opacity and transform are the two properties a compositor can animate on
  // its own. Anything else here would relayout the page on every scroll frame
  // and show up as jank and as layout shift.
  const frames = css.match(/@keyframes section-reveal\s*\{[\s\S]*?\n\}/)?.[0];
  assert.ok(frames, "the section-reveal keyframes are gone");
  const properties = [...frames.matchAll(/([a-z-]+)\s*:/g)].map((m) => m[1]);
  for (const property of properties) {
    assert.ok(
      ["opacity", "transform"].includes(property),
      `section-reveal animates ${property}, which cannot run on the compositor`,
    );
  }
  assert.match(css, /\.reveal--in\s*\{[\s\S]*?transition:[^;]*opacity[\s\S]*?\}/);
});

test("both halves of the effect cover the same sections", () => {
  // Drift here is silent: a section added to the stylesheet but not to the
  // script simply never fades in Safari, and nobody testing in Chrome sees it.
  // The selector list is the one the animation is declared on, not the
  // media query it is nested inside.
  const inCss = supportsBlock.match(/([^{}\n]+)\{[^{}]*animation:\s*section-reveal/)[1];
  const inJs = reveal.match(/SELECTOR\s*=\s*'([^']+)'/)[1];
  const list = (s) => s.split(",").map((p) => p.trim()).filter(Boolean).sort();
  assert.deepEqual(list(inJs), list(inCss), "the CSS and the script target different sections");
  for (const selector of list(inCss)) {
    const token = selector.replace(/^[.#]/, "");
    assert.ok(html.includes(token), `${selector} does not exist in the page`);
  }
});

test("the script is same-origin, deferred, stamped, and never cached stale", () => {
  const tag = html.match(/<script[^>]*reveal\.js[^>]*>/)?.[0];
  assert.ok(tag, "reveal.js is not loaded by the page");
  assert.match(tag, /src="reveal\.js\?v=\d+"/, "reveal.js needs a version stamp");
  assert.match(tag, /\bdefer\b/, "a render-blocking reveal script defeats the point");
  const block = headers.split(/\n(?=\/)/).find((b) => b.startsWith("/reveal.js"));
  assert.ok(block, "no cache rule for /reveal.js");
  assert.match(block, /no-cache/, "reveal.js must revalidate, its name does not change");
});

/**
 * Runs reveal.js against a stand-in browser so the fallback is tested by what
 * it does rather than by reading it for suspicious strings.
 */
function run({ scrollTimelines = false, observer = true, reducedMotion = false, tops = [] } = {}) {
  const observed = [];
  const unobserved = [];
  const elements = tops.map((top) => {
    const classes = new Set();
    return {
      top,
      classes,
      classList: { add: (c) => classes.add(c), contains: (c) => classes.has(c) },
      getBoundingClientRect: () => ({ top }),
    };
  });

  let callback = null;
  const window = {
    innerHeight: 900,
    document: { querySelectorAll: () => elements },
    matchMedia: (query) => ({ matches: reducedMotion && query.includes("reduce") }),
  };
  if (scrollTimelines) window.CSS = { supports: (p, v) => p === "animation-timeline" && v === "view()" };
  if (observer) {
    window.IntersectionObserver = class {
      constructor(fn) {
        callback = fn;
        this.unobserve = (el) => unobserved.push(el);
      }
      observe(el) {
        observed.push(el);
      }
      unobserve(el) {
        unobserved.push(el);
      }
    };
  }
  window.window = window;

  runInContext(reveal, createContext(window));
  return { elements, observed, unobserved, arrive: (el) => callback([{ isIntersecting: true, target: el }]) };
}

test("the script stands down where the stylesheet already handles it", () => {
  const env = run({ scrollTimelines: true, tops: [1200, 2400] });
  assert.deepEqual(env.observed, [], "the observer ran alongside the CSS animation");
  for (const el of env.elements) {
    assert.ok(!el.classes.has("reveal"), "a section was hidden by both mechanisms at once");
  }
});

test("without scroll timelines the script hides only what is below the fold", () => {
  const env = run({ tops: [-200, 400, 1500, 3000] });
  const hidden = env.elements.filter((el) => el.classes.has("reveal"));
  assert.deepEqual(hidden.map((el) => el.top), [1500, 3000], "a section on screen was hidden after paint");
  assert.equal(env.observed.length, 2, "only the hidden sections should be observed");
});

test("a section that has arrived stays arrived", () => {
  const env = run({ tops: [1500] });
  const section = env.elements[0];
  env.arrive(section);
  assert.ok(section.classes.has("reveal--in"), "the section never faded in");
  assert.deepEqual(env.unobserved, [section], "the observer keeps watching an arrived section");
});

test("reduced motion and a missing observer both leave the page alone", () => {
  for (const options of [{ reducedMotion: true }, { observer: false }]) {
    const env = run({ ...options, tops: [1500, 3000] });
    for (const el of env.elements) {
      assert.ok(!el.classes.has("reveal"), `a section was hidden with ${JSON.stringify(options)}`);
    }
  }
});

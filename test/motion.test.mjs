/**
 * Guards the scroll reveal. Two kinds of failure hide here, and neither is
 * visible in a normal browser session: content stuck at opacity 0 because
 * nothing ever revealed it, and an effect that technically runs but is spent
 * before the reader can see it. The second one shipped once already, by
 * animating whole sections whose top padding swallowed the whole fade.
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

/** The selectors reveal.js hides, as written in its GROUPS list. */
const groups = [...reveal.matchAll(/^\s*'([^']+)',$/gm)].map((m) => m[1]);

test("the page is never hidden by the stylesheet alone", () => {
  // .reveal is added by script, and only to what is below the fold. If the
  // stylesheet hid anything on its own, a visitor with JavaScript off would
  // get a blank page and never recover.
  assert.doesNotMatch(html, /class="[^"]*\breveal\b/, "a block ships pre-hidden in the HTML");
  const hiding = [...css.matchAll(/([^{}\n]*)\{[^{}]*opacity:\s*0[;\s}]/g)].map((m) => m[1].trim());
  for (const selector of hiding) {
    assert.match(
      selector,
      /\.reveal\b|\[hidden\]|\.consent|\.form__note|\.eco/,
      `${selector} hides content without the script being involved`,
    );
  }
});

test("the fade is long enough to be seen", () => {
  // The complaint that prompted this: an effect can run correctly and still
  // read as a static page. Anything under about a third of a second does.
  const rule = css.match(/\.reveal--in\s*\{[\s\S]*?\}/)[0];
  const durations = [...rule.matchAll(/(\d+)ms/g)].map((m) => +m[1]);
  assert.ok(durations.length >= 2, "expected both opacity and transform to be timed");
  for (const ms of durations) {
    assert.ok(ms >= 350, `a ${ms}ms fade is too quick to register as motion`);
  }
  assert.match(rule, /transition:[^;]*opacity/, "opacity is not transitioned");
  assert.match(rule, /transition:[^;]*transform/, "transform is not transitioned");
});

test("the fade moves nothing that costs a layout", () => {
  // opacity and transform are the two properties the compositor can animate
  // alone. Anything else relayouts the page on every frame and shows up as
  // both jank and layout shift.
  for (const rule of [css.match(/\.reveal\s*\{[^}]*\}/)[0], css.match(/\.reveal--in\s*\{[\s\S]*?\}/)[0]]) {
    const properties = [...rule.matchAll(/(?:^|[{;]\s*)([a-z-]+)\s*:/g)].map((m) => m[1]);
    for (const property of properties) {
      assert.ok(
        ["opacity", "transform", "transition"].includes(property),
        `the reveal sets ${property}, which cannot be animated on the compositor`,
      );
    }
  }
});

test("the stagger classes the script uses all exist", () => {
  const max = +reveal.match(/MAX_STEP\s*=\s*(\d+)/)[1];
  for (let step = 1; step <= max; step++) {
    assert.match(
      css,
      new RegExp(`\\.reveal--d${step}\\s*\\{[^}]*transition-delay`),
      `reveal.js can add .reveal--d${step}, which the stylesheet does not define`,
    );
  }
  // The delays have to come after .reveal--in, whose shorthand resets them.
  assert.ok(
    css.indexOf(".reveal--d1") > css.indexOf(".reveal--in"),
    "the delay rules sit before .reveal--in and are overridden by it",
  );
});

test("reduced motion and printing both show everything", () => {
  // The stylesheet has more than one reduced-motion block; this is the one
  // that speaks for the reveal.
  const reduced = [...css.matchAll(/@media \(prefers-reduced-motion: reduce\)\s*\{[\s\S]*?\n\}/g)]
    .map((m) => m[0])
    .find((block) => block.includes(".reveal"));
  assert.ok(reduced, "the reveal is not exempted under reduced motion");
  assert.match(reduced, /\.reveal\s*\{[^}]*opacity:\s*1/);
  // Paper never scrolls, so whatever is hidden when printing stays hidden.
  const print = css.match(/@media print\s*\{[\s\S]*?\n\}/)[0];
  assert.match(print, /\.reveal[\s\S]*opacity:\s*1/);
  assert.match(print, /transform:\s*none/);
});

test("every block the script reveals exists in the page", () => {
  // A selector that matches nothing is a block that silently never fades.
  assert.ok(groups.length >= 10, `only ${groups.length} blocks are revealed`);
  for (const selector of groups) {
    const [token] = selector.split(/\s*>\s*|\s+/).filter((p) => p.startsWith("."));
    assert.ok(html.includes(token.slice(1)), `${selector} matches nothing in the page`);
  }
});

test("no section wrapper is revealed as a whole", () => {
  // The regression this file exists for. A section box starts 138 to 193px
  // above its first line of text, so a fade on the wrapper is spent on empty
  // padding and the content arrives already opaque.
  for (const selector of groups) {
    assert.doesNotMatch(
      selector,
      /^(#build|#platform|#vision|#company|#contact|\.section|\.footer|section|body)$/,
      `${selector} is a whole section: its fade would run out over the padding`,
    );
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
 * Runs reveal.js against a stand-in browser, so the behaviour is tested by
 * what it does rather than by reading it for suspicious strings.
 */
function run({ observer = true, reducedMotion = false, nodes = {} } = {}) {
  const made = new Map();
  const element = (top, parent) => {
    const classes = new Set();
    return {
      top,
      parentNode: parent,
      classes,
      classList: { add: (c) => classes.add(c) },
      getBoundingClientRect: () => ({ top }),
    };
  };
  for (const [selector, spec] of Object.entries(nodes)) {
    made.set(selector, spec.map(({ top, parent }) => element(top, parent ?? {})));
  }

  // Two observers, because the page's last blocks can never enter a root
  // that is pulled up from the bottom edge.
  const observers = [];
  let callback = null;

  const window = {
    innerHeight: 900,
    document: { querySelectorAll: (selector) => made.get(selector) ?? [] },
    matchMedia: (query) => ({ matches: reducedMotion && query.includes("reduce") }),
  };
  if (observer) {
    window.IntersectionObserver = class {
      constructor(fn, options) {
        callback = fn;
        this.options = options ?? {};
        this.observed = [];
        this.unobserved = [];
        observers.push(this);
      }
      observe(el) {
        this.observed.push(el);
      }
      unobserve(el) {
        this.unobserved.push(el);
      }
    };
  }
  window.window = window;

  runInContext(reveal, createContext(window));
  return {
    made,
    observers,
    /** Every block handed to any observer, without duplicates. */
    get observed() {
      return [...new Set(observers.flatMap((o) => o.observed))];
    },
    arrive: (el) => callback([{ isIntersecting: true, target: el }]),
  };
}

test("only what is below the fold is hidden", () => {
  const env = run({ nodes: { ".sec-head": [{ top: -200 }, { top: 400 }, { top: 1500 }] } });
  const [above, onScreen, below] = env.made.get(".sec-head");
  assert.ok(!above.classes.has("reveal"), "a block scrolled past was hidden");
  assert.ok(!onScreen.classes.has("reveal"), "a block already on screen was hidden after paint");
  assert.ok(below.classes.has("reveal"), "a block below the fold was not hidden");
  assert.deepEqual(env.observed, [below], "only the hidden block should be observed");
});

test("siblings arrive one after another, strangers do not", () => {
  const left = {};
  const right = {};
  const env = run({
    nodes: {
      ".cards > .card": [
        { top: 1500, parent: left },
        { top: 1500, parent: left },
        { top: 1500, parent: left },
        { top: 2000, parent: right },
      ],
    },
  });
  const [first, second, third, other] = env.made.get(".cards > .card");
  assert.ok(!first.classes.has("reveal--d1"), "the first sibling should not be delayed");
  assert.ok(second.classes.has("reveal--d1"), "the second sibling is not staggered");
  assert.ok(third.classes.has("reveal--d2"), "the third sibling is not staggered");
  assert.ok(
    !other.classes.has("reveal--d3"),
    "the stagger carried across into a different parent, delaying it for no reason",
  );
});

test("the stagger is capped, so a long list does not crawl", () => {
  const parent = {};
  const many = Array.from({ length: 9 }, () => ({ top: 1500, parent }));
  const env = run({ nodes: { ".rail__steps > li": many } });
  const max = +reveal.match(/MAX_STEP\s*=\s*(\d+)/)[1];
  for (const node of env.made.get(".rail__steps > li")) {
    const delay = [...node.classes].find((c) => c.startsWith("reveal--d"));
    if (!delay) continue;
    assert.ok(+delay.slice("reveal--d".length) <= max, `${delay} is past the cap`);
  }
});

test("a block that has arrived stays arrived", () => {
  const env = run({ nodes: { ".founder": [{ top: 1500 }] } });
  const [block] = env.made.get(".founder");
  env.arrive(block);
  assert.ok(block.classes.has("reveal--in"), "the block never faded in");
  for (const observer of env.observers) {
    assert.deepEqual(
      observer.unobserved,
      [block],
      `an observer with ${JSON.stringify(observer.options)} keeps watching an arrived block`,
    );
  }
});

test("the trigger waits until a block is properly on screen", () => {
  // A positive bottom margin would start the fade while the block is still
  // below the fold, which is how the effect becomes invisible.
  const env = run({ nodes: { ".founder": [{ top: 1500 }] } });
  const arriving = env.observers.find((o) => o.options.rootMargin);
  assert.ok(arriving, "nothing holds the reveal back until a block is on screen");
  const bottom = arriving.options.rootMargin.split(/\s+/)[2];
  assert.match(bottom, /^-/, `rootMargin bottom is ${bottom}, so blocks reveal before they are seen`);

  // That negative margin puts the foot of the document out of reach: when the
  // page will not scroll any further, its last blocks sit inside it. Something
  // has to catch them or they stay invisible for good.
  const net = env.observers.find((o) => o.options.threshold === 1);
  assert.ok(net, "no observer catches the blocks at the very bottom of the page");
  assert.ok(!net.options.rootMargin, "the safety net inherits the same blind spot");
  assert.equal(net.observed.length, 1, "the safety net is not watching anything");
});

test("reduced motion and a missing observer both leave the page alone", () => {
  for (const options of [{ reducedMotion: true }, { observer: false }]) {
    const env = run({ ...options, nodes: { ".sec-head": [{ top: 1500 }, { top: 3000 }] } });
    for (const node of env.made.get(".sec-head")) {
      assert.ok(!node.classes.has("reveal"), `a block was hidden with ${JSON.stringify(options)}`);
    }
  }
});

/**
 * Guards the consent gate. The failure that matters here is silent and legal
 * rather than visual: analytics starting for someone who never agreed. None
 * of it shows up on the rendered page, so it needs asserting.
 *
 * Run: node --test test/consent.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createContext, runInContext } from "node:vm";

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), "utf8");
const html = read("index.html");
const analytics = read("analytics.js");
const consent = read("consent.js");

test("the banner is in the page, hidden, and offers both answers", () => {
  const banner = html.match(/<div class="consent"[^>]*>/)?.[0];
  assert.ok(banner, "no consent banner in the page");
  assert.match(banner, /\bhidden\b/, "the banner must start hidden");
  assert.match(banner, /id="consent"/);
  assert.match(html, /data-consent="granted"/, "no accept button");
  assert.match(html, /data-consent="denied"/, "no decline button");
  assert.match(html, /id="consent-reopen"/, "no way to revisit the choice");
});

test("the banner is announced to assistive technology", () => {
  const banner = html.match(/<div class="consent"[^>]*>/)[0];
  assert.match(banner, /role="dialog"/);
  assert.match(banner, /aria-labelledby="consent-title"/);
  assert.match(banner, /aria-describedby="consent-text"/);
  assert.match(html, /id="consent-title"/);
  assert.match(html, /id="consent-text"/);
});

test("both answers are real buttons, not links or divs", () => {
  const buttons = [...html.matchAll(/<button[^>]*data-consent="(granted|denied)"[^>]*>/g)];
  assert.equal(buttons.length, 2, "expected exactly one accept and one decline button");
  for (const [tag] of buttons) assert.match(tag, /type="button"/);
});

/**
 * Runs analytics.js against a stand-in browser, so the gate is tested by
 * behaviour rather than by reading the source for suspicious strings.
 */
function loadAnalytics(readyState) {
  const appended = [];
  const listeners = [];
  const idle = [];
  const timers = [];

  const document = {
    readyState,
    head: { appendChild: (el) => appended.push(el) },
    createElement: () => ({}),
  };
  const window = {
    document,
    addEventListener: (name, fn) => listeners.push({ name, fn }),
    removeEventListener: () => {},
    setTimeout: (fn, ms) => (timers.push({ fn, ms }), 1),
    requestIdleCallback: (fn, opts) => (idle.push({ fn, opts }), 1),
  };
  window.window = window;

  const context = createContext(window);
  runInContext(readFileSync(new URL("../public/analytics.js", import.meta.url), "utf8"), context);
  return { window, appended, listeners, idle, timers };
}

test("loading analytics.js does nothing until it is told to", () => {
  const env = loadAnalytics("loading");
  assert.equal(typeof env.window.startAnalytics, "function", "startAnalytics was never defined");
  assert.deepEqual(env.appended, [], "a script was injected before any consent");
  assert.deepEqual(env.listeners, [], "listeners were registered before any consent");
  assert.deepEqual(env.idle, [], "work was scheduled before any consent");
  assert.deepEqual(env.timers, [], "a timer was set before any consent");
  assert.equal(env.window.dataLayer, undefined, "dataLayer was created before any consent");
});

test("starting analytics queues the pageview but still defers the fetch", () => {
  const env = loadAnalytics("complete");
  env.window.startAnalytics();

  assert.equal(env.appended.length, 0, "gtag.js was fetched immediately instead of at idle");
  assert.equal(env.window.dataLayer.length, 2, "expected the js and config calls to be queued");
  assert.equal(env.idle.length, 1, "expected the fetch to be scheduled for idle");
  assert.ok(env.idle[0].opts.timeout > 0, "idle work needs a timeout or a background tab never fires it");

  const wake = env.listeners.map((l) => l.name);
  for (const name of ["pointerdown", "keydown", "scroll"]) {
    assert.ok(wake.includes(name), `no ${name} listener to bring the fetch forward`);
  }

  // Now let the idle callback run.
  env.idle[0].fn();
  assert.equal(env.appended.length, 1, "the idle callback did not fetch gtag.js");
  assert.match(env.appended[0].src, /^https:\/\/www\.googletagmanager\.com\/gtag\/js\?id=G-/);
  assert.equal(env.appended[0].async, true, "gtag.js must not block");

  // And never twice.
  env.idle[0].fn();
  assert.equal(env.appended.length, 1, "gtag.js was fetched more than once");
});

test("starting analytics twice is harmless", () => {
  const env = loadAnalytics("complete");
  env.window.startAnalytics();
  env.window.startAnalytics();
  assert.equal(env.window.dataLayer.length, 2, "the pageview was queued twice");
});

test("consent is the only thing that starts analytics", () => {
  assert.match(consent, /window\.startAnalytics\(\)/, "consent.js never starts analytics");
  // It must only do so for an explicit yes.
  assert.match(
    consent,
    /choice\s*===\s*"granted"[\s\S]{0,120}window\.startAnalytics/,
    "consent.js must start analytics only on an explicit grant",
  );
});

test("the choice is stored without setting a cookie to ask about cookies", () => {
  assert.match(consent, /localStorage/, "expected the choice in localStorage");
  assert.doesNotMatch(consent, /document\.cookie/, "consent.js must not set cookies");
  assert.doesNotMatch(analytics, /document\.cookie/, "analytics.js must not set cookies itself");
});

test("storage failure never reads as consent", () => {
  // localStorage throws rather than returning null in a locked-down browser.
  assert.match(consent, /catch\s*\(\s*\w+\s*\)\s*\{\s*return null;/, "a failed read must be treated as no answer");
});

test("analytics is defined before consent looks for it", () => {
  // Both are deferred, so they run in document order.
  const order = [...html.matchAll(/<script src="(analytics|consent)\.js[^"]*" defer><\/script>/g)].map(
    (m) => m[1],
  );
  assert.deepEqual(order, ["analytics", "consent"], "analytics.js must come first");
});

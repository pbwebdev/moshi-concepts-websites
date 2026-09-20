/**
 * Guards the content security policy against the page drifting out from under
 * it. A violation is invisible in the markup and silent in production for
 * anyone not watching the console: the browser simply drops the thing. That is
 * how the mobile card order was broken for a while, by a style attribute the
 * policy stripped.
 *
 * Run: node --test test/csp.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), "utf8");
const html = read("index.html");
const headers = read("_headers");

const CSP = headers.match(/Content-Security-Policy:\s*(.+)/)?.[1].trim();

/** The policy as a map of directive name to its list of sources. */
const directives = Object.fromEntries(
  CSP.split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((part) => {
      const [name, ...sources] = part.split(/\s+/);
      return [name, sources];
    }),
);

test("the policy is present and parses", () => {
  assert.ok(CSP, "no Content-Security-Policy in _headers");
  for (const name of ["default-src", "script-src", "style-src", "connect-src", "img-src"]) {
    assert.ok(directives[name], `policy has no ${name}`);
  }
});

test("scripts are never trusted inline or by eval", () => {
  for (const unsafe of ["'unsafe-inline'", "'unsafe-eval'"]) {
    assert.ok(
      !directives["script-src"].includes(unsafe),
      `script-src must not allow ${unsafe}`,
    );
  }
});

test("the page carries no executable inline script", () => {
  // A <script> with no src and no type is executable and the policy blocks it.
  // application/ld+json is data, not code, so the policy does not apply.
  const inline = [...html.matchAll(/<script(?![^>]*\bsrc=)([^>]*)>/gi)]
    .map((m) => m[1])
    .filter((attrs) => !/type=["']application\/ld\+json["']/i.test(attrs));
  assert.deepEqual(inline, [], "found an inline <script>; move it to a same-origin file");
});

test("the page carries no inline style attribute", () => {
  // style-src has no 'unsafe-inline', so any style="" here is silently dropped
  // by the browser. Put the rule in styles.css instead.
  const styled = [...html.matchAll(/\sstyle="([^"]*)"/gi)].map((m) => m[1]);
  assert.deepEqual(styled, [], "found inline style attributes; move them into styles.css");
});

test("every script the page loads is allowed by the policy", () => {
  const sources = [...html.matchAll(/<script[^>]*\ssrc="([^"]+)"/gi)].map((m) => m[1]);
  assert.ok(sources.length > 0, "expected the page to load some scripts");

  for (const src of sources) {
    if (!/^https?:\/\//i.test(src)) {
      // A relative path is same-origin, which 'self' covers.
      assert.ok(directives["script-src"].includes("'self'"), "script-src must allow 'self'");
      continue;
    }
    const origin = new URL(src).origin;
    assert.ok(
      directives["script-src"].includes(origin),
      `script-src does not allow ${origin}`,
    );
  }
});

test("analytics loads same-origin and deferred", () => {
  // Google's own snippet is an inline block plus a head tag. Ours is neither:
  // the config is same-origin so the policy stays tight, and deferred so it is
  // off the critical path.
  assert.match(html, /<script src="analytics\.js(\?[^"]*)?" defer><\/script>/);
  assert.doesNotMatch(html, /googletagmanager\.com/, "gtag must be injected at runtime, not in the HTML");
});

test("the policy allows the endpoints Google Analytics actually uses", () => {
  assert.ok(
    directives["script-src"].includes("https://www.googletagmanager.com"),
    "script-src must allow the gtag.js loader",
  );
  // GA4 posts to regional collection hosts, not just www.google-analytics.com.
  for (const host of ["https://*.google-analytics.com", "https://*.analytics.google.com"]) {
    assert.ok(directives["connect-src"].includes(host), `connect-src must allow ${host}`);
  }
  assert.ok(
    directives["img-src"].includes("https://*.google-analytics.com"),
    "img-src must allow the pixel fallback transport",
  );
});

test("every script the page loads is revalidated rather than cached stale", () => {
  const relative = [...html.matchAll(/<script[^>]*\ssrc="([^"?]+)(?:\?[^"]*)?"/gi)]
    .map((m) => m[1])
    .filter((src) => !/^https?:/i.test(src));
  for (const src of relative) {
    const block = headers.split(/\n(?=\/)/).find((b) => b.startsWith(`/${src}\n`));
    assert.ok(block, `_headers has no cache rule for /${src}`);
    assert.match(block, /Cache-Control: no-cache/);
  }
});

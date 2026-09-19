/**
 * Guards the machine-readable surface of the site: the robots rules, the
 * llms.txt pair, and the meta tags that let search engines and AI assistants
 * read and quote the page. These are easy to break silently, because nothing
 * on the rendered page changes when they do.
 *
 * Run: node --test test/discoverability.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), "utf8");
const html = read("index.html");
const robots = read("robots.txt");
const llms = read("llms.txt");
const full = read("llms-full.txt");
const headers = read("_headers");

/** The crawlers that matter for AI answers, each named in robots.txt. */
const AI_BOTS = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "Claude-SearchBot",
  "Google-Extended",
  "PerplexityBot",
  "CCBot",
];

test("robots.txt names every AI crawler we care about", () => {
  for (const bot of AI_BOTS) {
    assert.ok(
      new RegExp(`^User-agent:\\s*${bot}\\s*$`, "im").test(robots),
      `robots.txt does not name ${bot}`,
    );
  }
});

/**
 * Splits robots.txt into groups the way a crawler does: consecutive
 * User-agent lines share the rule block that follows them.
 */
function parseGroups(text) {
  const groups = [];
  let current = null;
  let collectingAgents = false;

  for (const raw of text.split("\n")) {
    const line = raw.replace(/#.*$/, "").trim();
    if (!line) continue;
    const match = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!match) continue;
    const field = match[1].toLowerCase();
    const value = match[2].trim();

    if (field === "user-agent") {
      if (!collectingAgents) {
        current = { agents: [], rules: [] };
        groups.push(current);
        collectingAgents = true;
      }
      current.agents.push(value);
    } else if (field === "allow" || field === "disallow") {
      if (!current) continue;
      collectingAgents = false;
      current.rules.push([field, value]);
    }
  }
  return groups;
}

test("every robots group allows the site and blocks only the API", () => {
  // Disallow has to come first so first-match parsers agree with
  // longest-match ones, and every group must repeat the permission: a
  // crawler that finds its own name ignores the wildcard group entirely.
  const groups = parseGroups(robots);
  assert.ok(groups.length >= 2, "expected a wildcard group and a named group");
  assert.ok(
    groups.some((g) => g.agents.includes("*")),
    "expected a wildcard group",
  );

  for (const group of groups) {
    assert.deepEqual(
      group.rules,
      [
        ["disallow", "/api/"],
        ["allow", "/"],
      ],
      `unexpected rules for: ${group.agents.join(", ")}`,
    );
  }
});

test("each AI crawler lands in a group that allows the site", () => {
  const groups = parseGroups(robots);
  for (const bot of AI_BOTS) {
    const group = groups.find((g) =>
      g.agents.some((a) => a.toLowerCase() === bot.toLowerCase()),
    );
    assert.ok(group, `${bot} is in no group`);
    assert.ok(
      group.rules.some(([kind, path]) => kind === "allow" && path === "/"),
      `${bot} is not allowed the site root`,
    );
  }
});

test("robots.txt blocks nothing else, and points at the sitemap", () => {
  const disallowed = [...robots.matchAll(/^Disallow:\s*(\S*)\s*$/gim)].map((m) => m[1]);
  assert.deepEqual([...new Set(disallowed)], ["/api/"]);
  assert.match(robots, /^Sitemap:\s*https:\/\/moshiconcepts\.com\/sitemap\.xml\s*$/im);
});

test("the page invites indexing with no snippet limit", () => {
  const meta = html.match(/<meta name="robots" content="([^"]+)">/)?.[1];
  assert.ok(meta, "no robots meta tag");
  assert.match(meta, /\bindex\b/);
  assert.match(meta, /\bfollow\b/);
  assert.match(meta, /max-snippet:-1/);
  assert.doesNotMatch(meta, /\bnoindex\b|\bnofollow\b|\bnoarchive\b|\bnosnippet\b|\bnoai\b|\bnoimageai\b/);
});

test("no header quietly tells crawlers to stay away", () => {
  assert.doesNotMatch(headers, /X-Robots-Tag/i);
});

test("llms.txt follows the convention and points to the full text", () => {
  assert.match(llms, /^# Moshi Concepts$/m, "needs an H1 with the site name");
  assert.match(llms, /^> /m, "needs a blockquote summary");
  assert.match(llms, /llms-full\.txt/, "should link the full text");
  assert.match(llms, /https:\/\/usehokan\.com\//, "should link the product");
});

test("the page links the full text for machine readers", () => {
  assert.match(html, /<link rel="alternate" type="text\/markdown" href="\/llms-full\.txt"/);
});

test("the text files are served as UTF-8 so punctuation survives", () => {
  for (const file of ["/llms.txt", "/llms-full.txt", "/robots.txt"]) {
    const block = headers.split(/\n(?=\/)/).find((b) => b.startsWith(`${file}\n`));
    assert.ok(block, `no _headers block for ${file}`);
    assert.match(block, /Content-Type: text\/plain; charset=utf-8/);
  }
});

test("llms-full.txt still carries the page's own copy", () => {
  // Cheap drift check: if the page's headline or product wording changes and
  // nobody reruns tools/llms.mjs, this fails instead of shipping stale text.
  const headline = html.match(/<h1>([^<]+)<\/h1>/)?.[1];
  assert.ok(headline, "no h1 on the page");
  assert.ok(full.includes(headline), `llms-full.txt is missing the h1: ${headline}`);

  const description = html.match(/<meta name="description" content="([^"]+)">/)?.[1];
  assert.ok(full.includes(description), "llms-full.txt is missing the meta description");

  for (const phrase of ["Hokan", "Cardano first", "Draper Dragon", "usehokan.com"]) {
    assert.ok(full.includes(phrase), `llms-full.txt is missing: ${phrase}`);
  }
});

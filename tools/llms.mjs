/**
 * Regenerates public/llms-full.txt from public/index.html.
 *
 * The page is the source of truth: this walks the rendered DOM and writes the
 * same copy as plain markdown, so a text-only reader gets the whole page
 * without parsing HTML, and the two can never drift apart by hand.
 *
 * Usage:  node tools/llms.mjs
 * Needs Playwright (same dependency as tools/og-card.html), and serves
 * public/ on a scratch port while it reads.
 */
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
import { createServer } from "node:http";
import { readFile, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

const ROOT = new URL("../public/", import.meta.url).pathname;
const PORT = 8123;
const TYPES = { ".html": "text/html", ".css": "text/css", ".js": "text/javascript", ".svg": "image/svg+xml" };

const server = createServer(async (req, res) => {
  const path = req.url === "/" ? "/index.html" : req.url.split("?")[0];
  try {
    const body = await readFile(join(ROOT, path));
    res.writeHead(200, { "content-type": TYPES[extname(path)] ?? "application/octet-stream" });
    res.end(body);
  } catch {
    res.writeHead(404).end("not found");
  }
});
await new Promise((r) => server.listen(PORT, r));

const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${PORT}/`, { waitUntil: "domcontentloaded" });

const data = await page.evaluate(() => {
  const txt = (el) => (el ? el.textContent.replace(/\s+/g, " ").trim() : "");
  const all = (root, sel) => [...root.querySelectorAll(sel)].map(txt).filter(Boolean);

  const meta = (name) =>
    document.querySelector(`meta[name="${name}"]`)?.content ??
    document.querySelector(`meta[property="${name}"]`)?.content ??
    "";

  const section = (sel) => {
    const el = document.querySelector(sel);
    if (!el) return null;
    return {
      eyebrow: txt(el.querySelector(".eyebrow")),
      heading: txt(el.querySelector("h1, h2")),
      intro: all(el, ".lead, .sec-head__intro, .trust__intro, .who__text p, .cta__text p"),
    };
  };

  return {
    title: document.title,
    description: meta("description"),
    canonical: document.querySelector('link[rel="canonical"]')?.href ?? "",
    hero: {
      ...section("header.hero"),
      stage: txt(document.querySelector("header.hero .stage")),
      backing: txt(document.querySelector(".backed span")),
      backingUrl: document.querySelector("a.backed")?.href ?? "",
    },
    build: {
      ...section("#build"),
      stage: txt(document.querySelector("#build .stage")),
      steps: [...document.querySelectorAll("#build .step")].map((s) => ({
        name: txt(s.querySelector("h3")),
        detail: txt(s.querySelector("p")),
      })),
      specs: [...document.querySelectorAll("#build .spec")].map((s) => ({
        label: txt(s.querySelector(".spec__label")),
        value: txt(s.querySelector(".spec__value")),
      })),
      productUrl: document.querySelector('#build a[href^="http"]')?.href ?? "",
    },
    platform: {
      ...section("#platform"),
      uses: all(document, "#platform .trust__uses-list li"),
      nodes: [...document.querySelectorAll("#platform .eco__node")].map((n) => ({
        name: txt(n.querySelector(".eco__label")),
        detail: txt(n.querySelector(".eco__sub")),
      })).filter((n) => n.name),
    },
    rail: [...document.querySelectorAll(".rail__step")].map((r) => ({
      label: txt(r.querySelector(".rail__label")),
      when: txt(r.querySelector(".rail__when")),
    })),
    vision: {
      ...section("#vision"),
      cards: [...document.querySelectorAll("#vision .card")].map((c) => ({
        num: txt(c.querySelector(".card__num")),
        name: txt(c.querySelector("h3")),
        detail: txt(c.querySelector("p")),
        chips: all(c, ".chip"),
      })),
    },
    notes: [...document.querySelectorAll(".note")].map((n) => ({
      label: txt(n.querySelector(".note__label")),
      body: txt(n).replace(txt(n.querySelector(".note__label")), "").trim(),
    })),
    company: {
      ...section("#company"),
      person: txt(document.querySelector(".founder__name")),
      role: txt(document.querySelector(".founder__role")),
      creds: all(document, ".creds li"),
    },
    contact: {
      ...section("#contact"),
      pillars: all(document, ".cta__pillar"),
    },
    legal: txt(document.querySelector(".footer__legal")),
    links: [...document.querySelectorAll('a[href^="http"]')]
      .map((a) => ({
        name: (txt(a) || a.getAttribute("aria-label") || "").replace(/\s*↗$/, ""),
        href: a.href,
      }))
      .filter((l, i, arr) => l.name && arr.findIndex((x) => x.href === l.href) === i),
  };
});

await browser.close();
await new Promise((r) => server.close(r));

const L = [];
const push = (...lines) => L.push(...lines, "");
const list = (items) => items.forEach((i) => L.push(`- ${i}`));

push(`# ${data.title}`);
push(`> ${data.description}`);
push(`Canonical URL: ${data.canonical}`);
push(
  "This is the full text of the Moshi Concepts home page, the single page that",
  "makes up the site. It is generated from the page itself, so it carries the",
  "same wording. Reuse it freely, with attribution to Moshi Concepts.",
);

push("## Hero");
push(data.hero.eyebrow);
push(`### ${data.hero.heading}`);
data.hero.intro.forEach((p) => push(p));
push(`Product stage: ${data.hero.stage}`);
push(`${data.hero.backing} (${data.hero.backingUrl})`);

push(`## ${data.build.eyebrow}`);
push(`### ${data.build.heading}`);
push(`Product stage: ${data.build.stage}`);
data.build.intro.forEach((p) => push(p));
push(`Learn more: ${data.build.productUrl}`);
L.push("How the escrow flow works, in order:");
list(data.build.steps.map((s, i) => `Step ${i + 1}. ${s.name}: ${s.detail}`));
L.push("");
L.push("Specifications:");
list(data.build.specs.map((s) => `${s.label}: ${s.value}`));
L.push("");

push(`## ${data.platform.eyebrow}`);
push(`### ${data.platform.heading}`);
data.platform.intro.forEach((p) => push(p));
L.push("The thesis:");
list(data.platform.uses);
L.push("");
L.push("Use cases:");
list(data.platform.nodes.map((n) => `${n.name}: ${n.detail}`));
L.push("");
L.push("The platform, built in stages:");
list(data.rail.map((r, i) => `${i + 1}. ${r.label} (${r.when.toLowerCase()})`));
L.push("");

push(`## ${data.vision.eyebrow}`);
push(`### ${data.vision.heading}`);
data.vision.intro.forEach((p) => push(p));
data.vision.cards.forEach((c) => {
  push(`#### ${c.num} ${c.name}`);
  push(c.detail);
  push(`Keywords: ${c.chips.join(", ")}`);
});

data.notes.forEach((n) => push(`**${n.label}.** ${n.body}`));

push(`## ${data.company.eyebrow}`);
push(`### ${data.company.heading}`);
data.company.intro.forEach((p) => push(p));
push(`${data.company.person}, ${data.company.role}`);
list(data.company.creds);
L.push("");

push(`## ${data.contact.eyebrow}`);
push(`### ${data.contact.heading}`);
data.contact.intro.forEach((p) => push(p));
push(`Principles: ${data.contact.pillars.join(" · ")}`);
push(
  "The site does not publish an email address. Use the contact form at",
  `${data.canonical}#contact to reach the team.`,
);

push("## Links");
list(data.links.map((l) => `[${l.name}](${l.href})`));
L.push("");

push("## Legal");
push(data.legal);

const out = L.join("\n").replace(/\n{3,}/g, "\n\n").trimEnd() + "\n";
await writeFile(new URL("../public/llms-full.txt", import.meta.url), out, "utf8");
console.log(`wrote public/llms-full.txt (${out.length} bytes, ${out.split("\n").length} lines)`);

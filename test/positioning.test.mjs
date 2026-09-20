/**
 * Guards the things the site says about itself that are easy to get wrong and
 * expensive to get wrong: the product's stage, the escrow terminology, and
 * claims stronger than the company can currently support.
 *
 * Run: node --test test/positioning.test.mjs
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

const read = (p) => readFileSync(new URL(`../public/${p}`, import.meta.url), "utf8");
const html = read("index.html");
const css = read("styles.css");
const llms = read("llms.txt");
const full = read("llms-full.txt");

/** Page copy with the markup taken out, so assertions read the visible words. */
const copy = html
  .replace(/<script[\s\S]*?<\/script>/g, "")
  .replace(/<style[\s\S]*?<\/style>/g, "")
  .replace(/<!--[\s\S]*?-->/g, "")
  .replace(/<[^>]+>/g, " ")
  .replace(/&nbsp;/g, " ")
  .replace(/\s+/g, " ");

test("the product stage is stated where the product is described", () => {
  assert.match(html, /Hokan MVP in active development/, "the hero must state the stage");
  assert.match(html, /MVP in active development/, "the product section must state the stage");
  const badges = [...html.matchAll(/class="stage[^"]*"/g)];
  assert.ok(badges.length >= 2, "expected the stage badge in the hero and the product section");
  assert.match(llms, /Product stage: MVP in active development/);
  assert.match(full, /Product stage/);
});

test("the escrow flow names the parties correctly", () => {
  // The party sending funds is the payer. Calling them the payee, as the
  // page once did, inverts the whole diagram.
  assert.match(copy, /\bPayer\b/, "the first step must name the payer");
  assert.match(copy, /\bReceiver\b/, "the last step must name the receiver");
  assert.doesNotMatch(copy, /\bPayee\b/, "payee is the wrong word for the funding party");
  for (const step of ["Funds the escrow", "Funds locked", "Conditions verified"]) {
    assert.ok(copy.includes(step), `missing flow step: ${step}`);
  }
});

test("the company is not described as a research studio", () => {
  // The positioning is an infrastructure company, not an experiment.
  assert.doesNotMatch(copy, /research and product studio/i);
  assert.doesNotMatch(llms, /research and product studio/i);
  assert.match(copy, /payment infrastructure/i);
});

test("no absolute pre-launch safety or custody claims", () => {
  const forbidden = [
    /funds can never be lost/i,
    /cannot access (?:your |customer )?funds/i,
    /never lose/i,
    /always resolve/i,
    /is secure\b/i,
    /fully audited/i,
    /has been audited/i,
    /not a money transmitter/i,
    /\bregulated\b/i,
  ];
  for (const pattern of forbidden) {
    assert.doesNotMatch(copy, pattern, `page makes an unsupportable claim: ${pattern}`);
    assert.doesNotMatch(llms, pattern, `llms.txt makes an unsupportable claim: ${pattern}`);
  }
});

test("custody is described by architecture rather than by promise", () => {
  assert.match(copy, /Non-custodial/i);
  // "never us" was a promise about behaviour; the claim should be about design.
  assert.doesNotMatch(copy, /never us\b/);
});

test("Cardano is framed as the first network, not the only one", () => {
  assert.match(copy, /Cardano is our first settlement network/);
  assert.match(copy, /additional networks/i);
});

test("the site is written in Australian English and without em dashes", () => {
  assert.doesNotMatch(html, /—/, "em dash in index.html");
  assert.doesNotMatch(llms, /—/, "em dash in llms.txt");
  assert.doesNotMatch(full, /—/, "em dash in llms-full.txt");
  // Spellings that would give away US English in this copy.
  for (const word of [/\borganizations?\b/i, /\bcentered\b/i, /\boptimiz/i, /\banalyz/i]) {
    assert.doesNotMatch(copy, word, `US spelling on the page: ${word}`);
  }
});

test("the product name can still be renamed without touching the design", () => {
  // The brand may need to change after trademark clearance, so nothing
  // structural may depend on it: no class, id, filename or selector.
  assert.doesNotMatch(css, /^[^/]*\bhokan\b/im, "a stylesheet rule is named after the product");
  assert.doesNotMatch(html, /(?:class|id)="[^"]*hokan/i, "a class or id is named after the product");
  const assets = readdirSync(new URL("../public/assets/", import.meta.url));
  assert.deepEqual(
    assets.filter((f) => /hokan/i.test(f)),
    [],
    "an asset filename is named after the product",
  );
});

test("the closing call to action asks for pilots, not newsletter signups", () => {
  assert.match(copy, /Discuss a pilot/);
  assert.match(copy, /pilot deployments/i);
  assert.doesNotMatch(copy, /newsletter|subscribe/i);
});

test("the business model is stated", () => {
  assert.match(copy, /revenue from settled transactions and API access/);
});

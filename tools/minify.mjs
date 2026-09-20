/**
 * Minifies public/styles.css into public/styles.min.css.
 *
 * Deliberately conservative. It only removes things that carry no meaning:
 * comments, and runs of whitespace that can be collapsed or dropped. It does
 * not reorder declarations, merge rules, shorten colours or touch anything
 * inside a string or a url(), because this stylesheet is hand-written and a
 * clever transform that is wrong 1% of the time is worse than a dull one.
 *
 * The two traps it is built around:
 *
 *   calc((100vw - 240px) / 2)   the spaces around - and / are load-bearing
 *   grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)
 *                               the space between the two values is too
 *
 * So whitespace is only removed next to the punctuation where CSS never needs
 * it ({ } ; , and the colon in a declaration), and is otherwise collapsed to a
 * single space rather than deleted.
 *
 * Usage:  node tools/minify.mjs
 * The result is committed. test/performance.test.mjs re-runs this and fails if
 * the committed file has drifted from the source.
 */
import { readFileSync, writeFileSync } from "node:fs";

/**
 * Splits CSS into pieces that may be rewritten and pieces that must not be:
 * quoted strings and url() contents are returned verbatim.
 */
function* segments(css) {
  const pattern = /("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(url\([^)]*\))|(\/\*[\s\S]*?\*\/)/g;
  let last = 0;
  for (const m of css.matchAll(pattern)) {
    if (m.index > last) yield { text: css.slice(last, m.index), rewritable: true };
    // A comment is dropped; a string or url() is kept exactly as written.
    yield { text: m[4] ? "" : m[0], rewritable: false };
    last = m.index + m[0].length;
  }
  if (last < css.length) yield { text: css.slice(last), rewritable: true };
}

export function minify(css) {
  let out = "";
  for (const part of segments(css)) {
    if (!part.rewritable) {
      out += part.text;
      continue;
    }
    out += part.text
      // Any run of whitespace becomes one space. Never nothing: inside calc()
      // and between grid track values a space is meaningful.
      .replace(/\s+/g, " ")
      // Around this punctuation CSS never needs whitespace.
      .replace(/\s*([{};,])\s*/g, "$1")
      // The colon in a declaration or a media feature. Selectors such as
      // a:hover have no space to begin with, so this is a no-op there.
      .replace(/\s*:\s+/g, ":")
      // The last declaration in a block does not need its semicolon.
      .replace(/;}/g, "}");
  }
  return out.trim() + "\n";
}

const src = new URL("../public/styles.css", import.meta.url);
const dest = new URL("../public/styles.min.css", import.meta.url);

if (import.meta.url === `file://${process.argv[1]}`) {
  const css = readFileSync(src, "utf8");
  const min = minify(css);
  writeFileSync(dest, min, "utf8");
  const saved = 100 - (min.length / css.length) * 100;
  console.log(
    `styles.min.css written: ${(css.length / 1024).toFixed(1)} KB -> ` +
      `${(min.length / 1024).toFixed(1)} KB (${saved.toFixed(0)}% smaller)`,
  );
}

# Rebuilding the fonts

The site serves its own fonts from `public/assets/fonts/` rather than loading
them from Google. That removes a render-blocking third-party stylesheet and two
extra connections from the critical path, and it is why the content policy can
say `style-src 'self'; font-src 'self'` with no external hosts.

The `@font-face` rules live at the top of `public/styles.css`, so the faces are
declared by the stylesheet the page already loads. No extra request.

## What is in the files

| File | Family | Weights |
| --- | --- | --- |
| `inter-var.woff2` | Inter | 400 to 500, variable |
| `zen-kaku-500.woff2` | Zen Kaku Gothic New | 500 |
| `zen-kaku-700.woff2` | Zen Kaku Gothic New | 700 |

Two decisions worth knowing before you regenerate them.

**Inter is the variable cut.** Google will serve two static files for weights
400 and 500, at about 47 KB each. The variable font covers the whole range in
one file of the same size, so asking for `wght@400..500` halves the payload.

**Zen Kaku Gothic New is a Japanese family.** Its stylesheet offers more than a
hundred subsets per weight. The site is English, so only the `latin` subset is
downloaded. Taking the whole family would add megabytes.

Both are then subset to the Latin ranges the page needs. The range is wider
than the page's own text on purpose: the contact form renders whatever a
visitor types, so it covers Latin-1 and Latin Extended-A rather than just the
characters currently on the page. Narrow it and a name with an accent falls
back to a system font mid-word.

## Steps

Fetch the stylesheets with a modern browser user agent, or Google returns TTF
instead of WOFF2.

```sh
UA="Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36"
curl -A "$UA" "https://fonts.googleapis.com/css2?family=Inter:wght@400..500&display=swap" -o inter.css
curl -A "$UA" "https://fonts.googleapis.com/css2?family=Zen+Kaku+Gothic+New:wght@500;700&display=swap" -o zen.css
```

From each stylesheet take only the `@font-face` block preceded by a
`/* latin */` comment, and download the URL inside it. Then subset:

```sh
pip install fonttools brotli
RANGE="U+0020-007E,U+00A0-00FF,U+0100-017F,U+2000-206F,U+2122,U+2190-21BB,U+20A0-20BF,U+00D7,U+00F7,U+FEFF"
pyftsubset in.woff2 --output-file=out.woff2 --flavor=woff2 --layout-features='*' --unicodes="$RANGE"
```

Copy the results into `public/assets/fonts/` under the names in the table above
and check that every character on the page is still covered:

```sh
node --test test/performance.test.mjs
```

## After regenerating

- The two faces above the fold are preloaded in `index.html`. If a filename
  changes, change the preload too, or the browser fetches the font twice.
- `public/_headers` caches `/assets/fonts/*` for a year as immutable. That is
  safe only while a changed font means a changed filename. If you replace a
  file in place, rename it.
- The arrows `→` and `↗` are not in either family and never were. They render
  from a system font, which is why they look consistent but are not subset here.

# When Hokan launches

Until launch, both sites describe Hokan as an MVP in active development, and
nothing here should change before then. This is the list of what changes on
the day, so the stage moves everywhere at once rather than in pieces.

Decided 19 October 2026: no stage changes on either site until launch.

## moshiconcepts.com

Every place the stage is stated, in `public/index.html` unless noted:

| Where | Today |
| --- | --- |
| Hero badge (`.stage`) | "Hokan MVP in active development. Pilot partners welcome." |
| Section 01 badge (`.stage--section`) | "MVP in active development" |
| Stage rail, first step (`.rail__step--now`) | "Hokan escrow MVP" / "In development" |
| Stage rail footnote | "Stages after the MVP describe direction, not committed dates." |
| Contact section, first paragraph | "Hokan is in active development and we are speaking with..." |
| `og:description` and `twitter:description` | "...is in development..." |
| JSON-LD `additionalProperty` "Development status" | "MVP in active development" |
| `public/llms.txt`, summary and "Product stage" line | "MVP in active development" |

Then:

1. Move the rail on: the first step becomes live, and the next step that is
   actually in progress takes `.rail__step--now`.
2. Rewrite the contact section's pitch. "Pilot partners" may no longer be the
   right ask once there is something to sign up to.
3. Update `test/positioning.test.mjs`, which pins this wording on purpose and
   fails until the new wording is written into it too. Two tests are
   affected: "the product stage is stated" (the stage text), and "the closing
   call to action asks for pilots" if step 2 changes the pitch.
4. Run `node tools/llms.mjs` to regenerate `public/llms-full.txt` from the page.
5. Bump `<lastmod>` in `public/sitemap.xml`.
6. Run `node --test test/*.test.mjs`.

The social card (`tools/og-card.html`, `assets/og.jpg`) states no stage and
does not need regenerating.

## usehokan.com

The Hokan site already speaks as if launched, so after launch it is the
accurate one. Before launch, these lines run ahead of the product:

- `architecture.html` and `trust.html`: "the only one live today"
- `index.html`: "everything on this site describes what runs there today"
- `pricing.html`: "Includes a sandbox and testnet access from signup"

At launch, check each still describes what is really running, in particular
that signup really does give sandbox and testnet access.

## Still true after launch

The claim rules from the repositioning brief do not lapse at launch:

- No absolute security claims ("funds can never be lost", "the protocol is
  secure").
- Say an audit has been completed only once it has, and name who did it.
- No categorical regulatory conclusions unless legal counsel has confirmed them.

`test/positioning.test.mjs` enforces all three. Its forbidden list includes
"has been audited" and "fully audited". When an audit really is complete,
relax those two patterns in the same commit that adds the audit wording, and
keep the rest of the list.

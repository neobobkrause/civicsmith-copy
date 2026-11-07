# screens-public — notes

**Status** · Job screens-public, attempt 1 (replacement session), 5 Nov 2026. Reader: BOB.

## What this job did

The module's code lives in `bio-plane/src/screens-public/` (ledger, BOB 5 Nov 21:37). The screens these lines rule stay screens-publish's, in `bio-plane/src/screens-publish/`; this module holds self-contained parts (interface-shell R21 (1)) that a screen lists among its own `parts` to draw. Each reads `publishedcase`'s answer as public-read states it, reads its words by key, and answers "" when it has nothing to draw. `PART_KEYS` names the keys each part reads. Tests (`parts.test.mjs`) run over `publishedcase` as public-read's real code answers it (`world.mjs`, built as public-read's own T53 world).

| part | for | met here |
|---|---|---|
| `ungradedStatement(cs, answer)` | R84 | yes: from `ungraded_passages` (public-read R46), the line by count and the "Which passages" fold with exactly the signed rows; nothing for all-graded or an earlier format |
| `evidenceList(cs, answer)` | R100 | yes: from `materials.materials[].entry` (public-read R41), name, locator, short fingerprint and the link where it can be read; no heading with no evidence |
| `signatureShown(cs, answer)` | R100 | yes: `screen.published.verify.detail` drawn only with the signature and public key it says are "shown here" |

- **R86** met earlier in this attempt by the doorbell's code (`t53.test.mjs`).
- Why the page draws nothing today (R100): `published.mjs` reads `e.captures || e.materials` as an array, but `publishedcase` answers `captures: null` and `materials` as `{materials: [...]}`, so the EVIDENCE section is always empty.

## Found marks for screens-publish (its hooks; never edited here)

1. `published` lists `ungradedStatement` among its parts and draws it at the top of the edition and of a signed case, with `PART_KEYS.ungradedStatement` in its words (R84 on the page).
2. `published` draws `evidenceList` in place of its EVIDENCE section (`published.mjs`, the `captures`/`materials` read), keeping its R19 "Open the document" act for a held copy, and `signatureShown` in place of the bare `screen.published.verify.detail` line (R100 on the page).
3. R101: the `publishedcase` act's `done` says it re-read, with the time; `verify`'s short-paste refusal says how many characters are needed; `pubprint` says why it cannot print (`published.mjs`).
4. R104: `published`, `docket-public` and `review-outside` draw the group's name at head and the foot, and set the tab title.

## Owed by others (the marks stay open)

- R101: word rows for "read again at {time}" and "cannot print: {why}" (none in the table).
- R102: the short unrated line and the folded "NO BAR IS RECORDED" paragraph's words (the requirement says words owed).
- R104: the "Made with Civicsmith" foot row (none in the table), and screens-publish's three screens.

## Attempt 2 (7 Nov 2026), reopened for R101, R102, R104. Reader: BOB.

Since attempt 1, screens-publish wired the public pages for most of these lines; this attempt tests them on the real `published` page, over public-read's real `publishedcase` answer (`world.mjs`, now with `graded` and the case read by `caseId`), in `t53.test.mjs`. Test-only: no source of this module changed.

- **R102 met** (mark struck): a case no member has graded draws one short line (`screen.published.ungraded.line`) in place of the long unrated lines, and the no-bar paragraph folded under `screen.published.ungraded.more`. Control: a graded case draws no ungraded line. Reading: the control's "neither" is taken as the ungraded line; the no-bar paragraph is R6's ("no bar declared") and is drawn, folded, whenever the edition declares no bar, graded or not.
- **R101 still open**: "Check it" with a short paste names the 64 characters and sends nothing (tested). Owed: "Read the case" saying it re-read with the time (the `publishedcase` act in `published.mjs` has no `done`, and the word table has no row), and "Print the case" saying why it cannot print (`cs.print` in interface-shell's browser kit swallows the failure and always answers true; `pubprint` in `published.mjs` would need to say it; no word row).
- **R104 still open**: the head (the group's public name) and the foot ("Made with Civicsmith") are drawn on `published` signed in and out (tested here; screens-publish tests the docket and review-outside too). Owed: the tab title "<case title> - <group name>", which is interface-shell's (`page.title.public`).

### Found marks to report

1. screens-publish: `published.mjs`'s `publishedcase` act gets a `done` that says the case was read again, with the time (R101).
2. screens-publish: `pubprint` says why it cannot print when the kit says so (R101); needs (3).
3. interface-shell: `cs.print()` answers whether the browser printed, or why not (R101).
4. interface-shell: the public frame's tab title reads "<case title> - <group name>" (R104).
5. setup-words (word table): rows for "read again at {time}" and "cannot print: {why}" (R101).

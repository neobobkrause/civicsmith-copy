# screens-intake-rounds: notes

**Status** · Job screens-intake-rounds, attempt 1 (replacement session), 5 Nov 2026; attempt 2, 7 Nov 2026. For BOB.

## What this job did

The module's code lives in `bio-plane/src/screens-intake-rounds/` (ledger, PR 585). The screens these lines rule stay screens-intake's, in `bio-plane/src/screens-intake/`; this module holds self-contained parts (interface-shell R21 (1)) that a screen lists among its own `parts` to draw. Each part reads its words by key and answers "" when it has nothing to draw. `PART_KEYS` names the keys each part reads, for the screen's `words` (screens-intake R26).

| part | for | met here |
|---|---|---|
| `leftOutLine(cs, left_out)` | R81 | yes: `{what}` built from A4-R3's kinds, each by `screen.photo.dropped.<kind>`, joined; the closed set only |
| `mailboxCountLine(cs, {n, read, held, refused})` | R82, its count line | part only: "From {parent}" has no row |
| `stepLine`, `readRefusedLine`, `uploadTooLargeLine`, `sizeWords`, `finishLine`, `addressHeldLine` | R78 | part only: capture.mjs still draws its stand-ins; `screen.capture.read.queued` has no row |
| `previewCutLine`, `safeViewPagesLine` | R79 | part only: no next-rows op, no "Show more rows" or cancel wiring |

## Found marks for screens-intake (its hooks; never edited here)

1. `open-file` lists `leftOutLine` among its parts and draws it beside the safe picture from the answer's `left_out`, with `PART_KEYS.leftOutLine` in its words (R81 on the screen, R77).
2. `capture` draws the parts of R78 in place of its stand-ins (finish, address held, fetch done, the reading's steps and refusals, the parted upload's steps, the upload ceiling's figures in MB), and R79's cut sentence and parted-upload cancel (`captureuploadabort`).
3. `archive` draws `mailboxCountLine` for a mailbox, and a member file's parent (R82).
4. `open-file` draws `safeViewPagesLine` on both safe-view panels (R79).

## Owed by others (the marks stay open)

- Word rows: `screen.capture.limits.*` (R72), `screen.capture.refusal.toolarge.nothing_read|register|part` (R73, R74), `screen.capture.read.queued` (R78; DEC-456 waits), R80's kept-not-read and refused sentences, R82's "From {parent}", "Handed in through the doorbell" (R75, BOB's).
- Ops: a read serving acquisition's `limitsByKind` to the screen (R72); a preview's next rows from `next_row` (R79, its name BOB's); `sourceLinksFor` (R75, R76).
- Other modules: registers' `registerList` and `registerFilter` (R74); interface-shell-t53 R140's `ceiling` scale (R83); capture R96 and R120 (R94); interface-shell R35 (R90), R144 (R94); PLATFORM's Seed A timing (R84); screens-publish's doorbell (R93).
- R85 to R92 change plane answers and screen layout across held, archive, inbox and document; none can be met without editing screens-intake's screens.

## Attempt 2 (7 Nov 2026)

Since attempt 1 the design stream returned the rows for R72 (`screen.capture.limits.*`), R73 and R74 (`screen.capture.refusal.toolarge.*`), R78's `screen.capture.read.queued` and R79's `screen.capture.file.parts.cancelled`, and acquisition's `limitsByKind` (R135) and registers' `registerList` landed. New parts, tested at the providers' real code (acquisition's `limitsByKind`, registers' own test world):

| part | for | met here |
|---|---|---|
| `limitsSection(cs, limitsByKind())` | R72 | part only: one row per kind with its one figure, the background line; the figure equals the bound R73 refuses at |
| `tooLargeLines(cs, {size, bound}, {register, project})` | R73, R74 | part only: size and limit, "Nothing was added or read.", way (a) linking `/app/registers/<key>?project=` when matched, way (b) always; no "first part" way |
| `registerOfAddress(registerList(), address)` | R74 (a) | part only: mechanical URL match (host case, trailing slash, fragment ignored) |
| `stepLine` `queued` | R78 | part only: the returned row |
| `partsCancelledLine(cs, abortAnswer)` | R79 | part only |

No mark is struck: every one of the 22 is a screen's drawing, and the screens are screens-intake's. Found marks for screens-intake, added to attempt 1's four:

5. `capture` draws `limitsSection` from a read serving `limitsByKind` on "A file or photo" and "From an address", before a file is chosen (R72); that read is an op for op-declarations/store-assembly (BOB names it).
6. `capture` draws `tooLargeLines` for a `TOO_LARGE` upload or fetch, with `registerOfAddress` over `registerlist` for an address (R73, R74).
7. `capture` draws `stepLine` for the job row's `queued` state in place of its fallback (capture.mjs:285) and `partsCancelledLine` after `captureuploadabort` (R78, R79).

Open questions for the design lane: R73 names "the TOO_LARGE sentence (R64)"; R64's reading sentence (`screen.capture.read.refused.TOO_LARGE`) says the file "is kept whole", which contradicts "Nothing was added or read", so the part uses the upload ceiling's figures row, whose own text ends "Nothing was written." and so says it twice beside `nothing_read`. The `registers` screen does not exist yet (screen-registry lists it owed), so R74 (a)'s link target `/app/registers/<key>?project=` is this part's guess, not verified.

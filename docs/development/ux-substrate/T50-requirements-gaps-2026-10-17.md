# T50's screen requirements against the design (17 October, UX design #26)

A reading worker (Sonnet, medium) compared every screens-* and interface-shell requirement line added on `tranche/T50` on 17 October (except DEC-313 to DEC-317's, already reviewed) with the design. Each gap is the design's to draw or align, one DEC per batch, then a NOTICE to BOB. Verify each against the requirement line before drawing; this list is a reader's report, not a ruling.

## Not drawn at all (worst first)
- **screens-daily R48 (Find in):** no flow-step form, no prefilled-from-passage note, no "Recorded:" acknowledgement, no `passage.facts.count`; "A name or term" is still a tick box (R48 (6) removes it); "For which question (optional)" disagrees with `findin.question.choose` "For which question"; sheet-match and uncalculated-cell states undrawn.
- **screens-daily R47:** `recordpersonfact` a bare button: no validity bounds (from, to, precision, zone).
- **screens-investigate R36:** `proceeding` has no court choice, no `court.none` / "Add a court" form, no kind choice.
- **screens-settings R46:** `places` has no "Add a court" (`court.add`, `.name`, `.help`).
- **screens-investigate R38:** "Same person?" lacks the in-place `identityclaim` form (other record, You say, Because, documents, Why, `screen.person.claim.empty`); the row lacks `claim.by`.
- **screens-wizards R17:** the dock never asks for a subject (`wizard.subject.project`, `wizard.subject.none.project`).
- **screens-inquiry R61:** `document` has no "In which question" choice (`screen.document.cite.question`).
- **screens-investigate R33 (5):** `timeline` has no "Dated in the documents" list (`timeline.dated.title`).
- **screens-investigate R32:** person page: no facts of undetermined validity (`mark.gap.undetermined`), no `person.graph.none`.
- **screens-action R20:** `request` has no no-office state (`screen.request.nooffice`) pointing to `places`.
- **screens-action R21:** `request` draws no "Sent with" / "In this matter" stake lines; `stake.none`, `stake.source.action`, `stake.unreadable`, undetermined tier undrawn.

## Drawn, but disagreeing
- **screens-intake R29:** "For which question" sits on the file tab; R29 puts it on the address tab.
- **screens-intake R32:** inbox row shows the raw `KNOCK-…` id as text, not on a folded "Reference" line; already-held state undrawn.
- **screens-daily R43:** Projects' Themes draws counts; R43 says none (`themeread` answers none).
- **screens-daily R50 (2):** `act.taskresolve.label.queue` still "Act on an item".
- **screens-daily R51:** Home's Investigation block opens `project`, not `dash-project`.
- **screens-settings R45:** time zone is free text; R45 wants a pick by name from the IANA list; two-profile and no-zone states undrawn.
- **screens-publish R33:** stale on BOB's side (R34 supersedes it; U332 told BOB). Still owed by design: the corrections line's count-above-zero and undetermined states drawn.
- **screens-daily R40:** new team's Home (state c) lacks the "Name your team" lead (`home.first.name`).
- **screens-daily R45:** a watched row lacks "take off my watch list"; the flag's note field undrawn; registry label "Flag for a second look" lacks the mock's ellipsis.
- **screens-daily R44:** the `since: null` (no "new") state and `next`/`truncated` paging undrawn.

## Words exist, states undrawn (lower priority)
screens-daily R49 `queue.source.untitled`; R50 `due.ours.passed*`, `home.strip.ours_passed.one`, `queue.done`. screens-inquiry R50 `question.empty.conclude.own`; R52 `project.bar.*`; R53 `stake.history`, `stake.none`, `stake.unreadable`; R55 `document.vouched`, `document.image.unread`, `document.table.flattened`, `document.untitled.web`; R57 the tokens cost line, `ai.run.ending.completed.none`, `.unknown`; R58 `ai.progress.check.ok|fail|checked`, `ai.reading.levels.disagree`. screens-intake R35 `document.uploaded.by`, `size.small`; R36 `safetext`, `.cut`. screens-investigate R31 `theme.out.withdrawn`. screens-publish R26 `case-import.group_fields_*`, `caseimport.stake.unreadable`; R27 `until.nozone`; R28 `ceremony.gate.*`, `case.draft.untitled`, `case.ladder.notyet`, `screen.case-editor.tip.distributed`; R29 `published.check.elsewhere`. screens-settings R43 `screen.security.period.bad`; R51 `member.founder.unnamed`; R52 `settings.set.*`, `screen.group.name.same`.

## Agree
screens-action R22, R23; screens-entry R22–R24; screens-inquiry R42, R51, R54, R56, R59, R60, R62, R63; screens-intake R30, R31, R33, R34, R37; screens-investigate R34, R35, R37; screens-publish R25, R30–R32; screens-settings R41, R42, R44, R47–R50, R53; screens-wizards R13–R16; interface-shell R73–R87 (R85 stale on BOB's side: its re-points are in the registry).

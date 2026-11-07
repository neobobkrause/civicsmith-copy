# screens-matter — job notes

**Status** · Attempt 1 (layer 11, 7 Nov 2026), for BOB.

## Attempt 1: what was met, and how

Met and struck: **R7** (T53; R-68, matter half), each case in `bio-plane/test/m/screens-matter/r7-escalation-offer.test.mjs`, through `screens-action`'s matter world (real reads and acts).

- The project's matter (`/app/matter/<project>`) now reads each live determination's `escalationstatus` and offers, for one that found the act noncompliant and has no open escalation, "Open an escalation" and "Decline to escalate", each with what it does (`act.<op>.does`). The determination's own page draws the same, through one shared part (`offer`). The two acts carry the determination they act on, so a press on the project's matter opens or declines that one.
- "Not available yet" now gives, beside each reason, the step that clears it: three new sentences, written once with `localize` in `words-fix-matter.mjs` (`screen.matter.unavailable.step.*`).
- "This project has no dated event yet" now has the way to record one beside it: a link to the project's Timeline (`screen.timeline.name`).
- Control: a decline recorded through the project's matter is drawn as "declined" on both pages.

R1 to R6 were already met (no marks). `words-fix-r56.mjs` was not touched.

## Not verified

- The walk itself (journeys 11 and 22, steps 4 and 8) on a deployed site; the dating half of R-68 is T52-74 (`screens-investigate`).
- An event recorded but left undated still counts as an event for the picker; whether "no dated event" should also cover a project with only undated events is a question for the design stream, not changed here.

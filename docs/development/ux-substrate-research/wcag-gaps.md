# WCAG 2.2 AA gaps: a list to schedule (6 Nov 2026)

This list comes from [`best-practice.md`](best-practice.md) §1–§2 and the code it cites, at tranche `705f8823d1`. Each row is one piece of work.

The **owner** column says where the work lands:
- *lane*: the ux lane changes `docs/development/ux-substrate/` itself, through a lane-only pull request.
- *module*: BOB schedules it, as found marks or a job.

The **size** column is rough: S is under an hour, M is a session, L is several sessions.

## Lane work (the design's own sources)

| id | criterion | the gap | where | size |
| --- | --- | --- | --- | --- |
| W1 (done 6 Nov: `check_contrast.py` checks each graphic colour against ground, surface and sheet; all pass; `rule` recorded as decorative) | 1.4.11 Non-text contrast | `check_contrast.py` tests graphic colours against `surface` only. A colour must also hold 3:1 against each colour it can sit on (`sheet`, `ground`, tints). `kind-part` is 3.07–3.12 on ground and sheet, which is a thin margin. `rule` (1.6:1) is never checked; a rule that carries meaning needs 3:1, a purely decorative one is exempt. | `visual-language/check_contrast.py`, `palette.json` `pairs` | M |
| W2 (done 6 Nov, no colour change: every focus outline is offset 2px, so it meets the background, never accent-strong's fill; the checker now fails a focus rule without that offset, or one that removes the outline and draws nothing else) | 2.4.7 / 2.4.11 Focus | `--c-focus` is the same colour as `accent-strong` (1.0:1 between them). A focused primary button is told apart only by the 2px offset. Give focus its own token, at 3:1 against accent and surface. | `palette.json`, `components.css:8` | S |
| W3 | 2.4.11 Focus not obscured | Sticky dialog action bars, the fixed tip, the phone's bottom tabs and the dock can hide a focused control. Add `scroll-padding` (top and bottom) sized to each bar, then check in a browser at 390×844 and 1280×900. | `components.css:306,319`; `screens/page.src.html:300,911` | M |
| W4 | 3.3.1 / 4.1.3 Error identification, status messages | No error-summary pattern is drawn, and there is no `role="alert"`. Design one: a summary at the top that takes focus and links to each field, plus a line at each field saying what to do. Add its words. | `components.css`, `screens/mock-kit.js`, words | M |
| W5 | 3.3.1 / plain language | Raw codes reach members: "(invalid_grant)" and HTTP "{status}". Move each code to a details line or a support reference, and keep the sentence plain. | `screens/words-drawn-2.src.py:1778`, `words-drawn-3.src.py:92`; `layouts.html:3080` (frozen, BD-5) | S |
| W6 | 1.4.4 / readability | Some tab and chip labels are 11 and 11.5 px, under the visual language's 13 px floor. | `components.css` (best-practice.md §1) | S |
| W7 | 1.4.1 Use of colour; 1.4.11 | Levels 1 and 2 of the security heat map are tints of one hue. Give each level its own word or texture, as level 3 has. | `components.css:347-348` | S |
| W8 | 1.4.11 in forced colours | There is no `forced-colors` pass. Tinted chips and the heat map lose their meaning in Windows High Contrast. | `components.css` | M |

## Module work (BOB schedules)

| id | criterion | the gap | modules | size |
| --- | --- | --- | --- | --- |
| M1 | 3.3.1, 4.1.3 | Draw W4's error summary wherever a form is refused, and move focus to it. | interface-shell, screens-* forms, newgroup | L |
| M2 | 3.3.8 Accessible authentication; 1.3.5 | Password, one-time-code and email fields set `autocomplete` (`current-password`, `one-time-code`, `email`) and never block paste. | interface-shell (sign-in), screens-entry (claim), newgroup | S |
| M3 | 3.2.6 Consistent help | Check that help sits in the same relative place on every screen, by journey-check's walk at both widths. | journey-check | M |
| M4 | 2.4.11 | Confirm W3 in the live product, by journey-check's walker, with a focused control behind each sticky bar. | journey-check | M |

## The lane's own call, not yet made

**Negative contractions.** GOV.UK advises avoiding "can't", "don't" and similar, which some readers find harder. The words use them more than 370 times, and the voice traits ("Plain", "Calm") read naturally with them. This is a voice decision beneath Bob's principles (BD-4), so it is the lane's to make. When the lane decides, it records the decision as a DEC with its evidence.

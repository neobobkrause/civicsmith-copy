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
| W3 (done 6 Nov: every focusable control keeps scroll-margin-block of a tap plus 16px, so keyboard focus is scrolled clear of sticky and fixed bars up to that height; the shell's masthead, tabs and dock are grid rows, not overlays; the live check is M4) | 2.4.11 Focus not obscured | Sticky dialog action bars, the fixed tip, the phone's bottom tabs and the dock can hide a focused control. Add `scroll-padding` (top and bottom) sized to each bar, then check in a browser at 390×844 and 1280×900. | `components.css:306,319`; `screens/page.src.html:300,911` | M |
| W4 (done 6 Nov: `.cs-errsum` and `.cs-field .refused` in components.css, the frame words `screen.form.refused.*`; drawing it in every form is M1) | 3.3.1 / 4.1.3 Error identification, status messages | No error-summary pattern is drawn, and there is no `role="alert"`. Design one: a summary at the top that takes focus and links to each field, plus a line at each field saying what to do. Add its words. | `components.css`, `screens/mock-kit.js`, words | M |
| W5 (done 6 Nov: `queue.fill.reason.http` and `installer.fleet.why.http` give the plain cause first and the code last, "(its code: {status})"; `invalid_grant` already sits in a details disclosure; `instance-setup` detail lines are administrators' diagnostics and keep "HTTP {status}") | 3.3.1 / plain language | Raw codes reach members: "(invalid_grant)" and HTTP "{status}". Move each code to a details line or a support reference, and keep the sentence plain. | `screens/words-drawn-2.src.py:1778`, `words-drawn-3.src.py:92`; `layouts.html:3080` (frozen, BD-5) | S |
| W6 (done 6 Nov: the phone tabs and the heat map's labels use --t-xs, 13px) | 1.4.4 / readability | Some tab and chip labels are 11 and 11.5 px, under the visual language's 13 px floor. | `components.css` (best-practice.md §1) | S |
| W7 (done 6 Nov: levels 1, 2 and 3 have dots, lines and hatching, in the map and its key) | 1.4.1 Use of colour; 1.4.11 | Levels 1 and 2 of the security heat map are tints of one hue. Give each level its own word or texture, as level 3 has. | `components.css:347-348` | S |
| W8 (done 6 Nov: a forced-colors block keeps the heat map's own colours and textures, gives tinted chips, bands and the error summary a system-colour border, and the focus ring Highlight) | 1.4.11 in forced colours | There is no `forced-colors` pass. Tinted chips and the heat map lose their meaning in Windows High Contrast. | `components.css` | M |

## Module work (BOB schedules)

| id | criterion | the gap | modules | size |
| --- | --- | --- | --- | --- |
| M1 | 3.3.1, 4.1.3 | Draw W4's error summary wherever a form is refused, and move focus to it. | interface-shell, screens-* forms, newgroup | L |
| M2 | 3.3.8 Accessible authentication; 1.3.5 | Password, one-time-code and email fields set `autocomplete` (`current-password`, `one-time-code`, `email`) and never block paste. | interface-shell (sign-in), screens-entry (claim), newgroup | S |
| M3 | 3.2.6 Consistent help | Check that help sits in the same relative place on every screen, by journey-check's walk at both widths. | journey-check | M |
| M4 | 2.4.11 | Confirm W3 in the live product, by journey-check's walker, with a focused control behind each sticky bar. | journey-check | M |

## The lane's own call: negative contractions (decided 6 Nov, DEC-494)

The lane keeps negative contractions in the house voice. It writes negatives in full in protected words, the warnings before a signed, terminal, irreversible or outward act, and in any clause that says what did not happen. New words follow this rule from today. The 45 protected rows that use a contraction now (of 636 rows in all) will be reworded in one sweep, run with the modules' tests. The decision is recorded on the ux decisions artifact.

# screens-settings: requirements notes

Text moved word for word out of `build/requirements/screens-settings.md` on 4 Nov 2026 (job screens-settings, attempt 1), so that the requirements file holds requirements. No requirement id, requirement line or unmet mark moved: `bio-plane/test/m/screens-settings/requirements-ids.test.mjs` checks that against the start commit d3580fbd.

## For BOB: the file cannot get under the cap by moving text out, so it needs a split

(Attempt 4, 4 Nov 2026: the Uses and Suggestions lists moved here too; the file is now 101,741 bytes, its requirement lines still 84,028 of them, so the split below is still needed.)

`build/requirements/screens-settings.md` was 110,832 bytes, and the cap is 70,000. Its 105 requirement lines (R1 to R105, no F lines), kept word for word as the START requires, come to **84,049 bytes on their own**. That is over the cap before any heading. With everything that is not a requirement moved here (the Status history, the Size line, the bullets left under the retired R4 and R5, and the Satisfies list), the file is 104,049 bytes. Most of the rest is the indented test and detail bullets under live requirements. Those are part of what each requirement says, so they stay where they are.

**Proposed split, by screen.** The administrator's team screens are separate files with their own tests, which gives a clean break:

- **New module `screens-team`** (layer 11, directly after `screens-settings`) takes the requirements of `group`, `group-identity`, `places`, `security`, `updates`, `bias` and `grouprules`. Its code is `group.mjs`, `identity.mjs`, `places.mjs`, `security.mjs`, `updates.mjs`, `bias.mjs`, `grouprules.mjs` and their tests and seeds. By a rough tally of each line's subject, that is about 38,000 bytes of requirement lines: R15, R16, R18, R19, R25, R27, R31, R34, R40, R43 to R46, R58, R60, R61, R62, R65, R66, R68, R69, R70, R73 to R75, R77, R79, R81, R83 to R87, R99, R100, R104 and R105. The tally is rough, and BOB settles the exact list. Each line moves as `- **R<n>** (moved from screens-settings:R<m>) …`, and this file keeps `- **R<m>** *(retired: moved to screens-team:R<n>)*`, as instance-setup's split did.
- **`screens-settings` keeps** `settings`, `members`, `account`, `notes`, `recovery`, `glossary`, the common rules (R8, R10, R28, R37, R39, R78, R96 and the like) and the retired ids: about 46,000 bytes of requirement lines plus headings, which leaves room under the cap.
- `screens-team`'s `SCREENS` would be composed into the shell beside this module's (`control-plane/index.mjs` and `journey-check` import `SCREENS` from here today). That is one job for the new module, plus a re-run of this one.

**Other choices, BOB's or Bob's:** (a) let this file stay over the cap; (b) let each requirement line move its opening source bracket here (not enough by itself: the brackets come to about 9,000 bytes).

## Status history (was the file's Status paragraph)

**Status** · New in T46 (T46-55; K657, K1043): a module built fresh, layer 11 directly after `interface-shell` (N897 (1), (3), Bob's K2816; K2147; DEC-136, DEC-153, DEC-156, DEC-188; DEC-197 and N934: a handle fixed at joining). Drafted in `build/plan/draft-T46-interface.md` §2.3, amended by DEC-197, worded here by BOB (P5). No ids move. Not yet met (T46). Last changed T47 (T47-58: R11 new, `writinghelp`'s `untested` drawn, N984; R12 new, the kit's row reference and appearance control, N985; R13 new, amending R4, `connect` reads `part_signin`, N989; R14–R16 new, `group-identity`, `security` and `translations` redrawn from the setup page, N897 (1), N551, N669, N703, N710); marked not yet met (T47). Places and offices and recovery codes stay on the setup page: no registry screen draws them in the working frame. Last changed T48 (T48-71: R25 new, amending R19, Places' count of where else to go, N847, DEC-227 (1); R26 new, amending R9, thirty days of bars and a meter on the AI account panel, N1026, DEC-215 (1), K3198; R27 new, amending R17, the screen `updates`, N1047, DEC-226 (2), (3); K3189, K3190, K3195); marked not yet met (T48). Last changed T48 (K3254, the L11 design fold of WALK-084 #2, K3250: R28 new, the common line; R29 new, members' counts; R30 new, the connect chooser; R31 new, languages by name, no keys; R32 new, the link list; R33 new, no credential names); marked not yet met (T48). Last changed T49 (T49-22: R34, R35, R37, R38 new; R36 retired, K3347; K3334); marked not yet met (T49). Last changed T50 (T50-29: R42–R53 new; R53 amended, the last check's six steps with their times, the button and the fold "If the check stops" (DEC-311 (1), K3689); Sounds and recovery, Security's lead and period, defined terms, the time zone, Add a court, Members and the team's assistant, connect redrawn, a code being exchanged, the founder's row, setup values, the check's words; N1158, N1119, N1154, N1181, N1190, N1194, N1196, N1163; DEC-262, DEC-283, DEC-284, DEC-287, DEC-290, DEC-291, DEC-299, DEC-300, DEC-301); marked not yet met (T50). Last changed T50 (T50-29: R43, R45, R46, R51, R52 amended; the security period's refusal fold, the time zone by name with its two-places and none states, the Courts section, the founder's row, the same-name fold; DEC-319, DEC-322, DEC-323, DEC-325; K3720, K3724, K3726, K3728); marked not yet met (T50). Last changed T51 (T51-116, L11 fold, BOB #210: R55 new, signing keys for others, withdrawn and reactivated (A74, B5); R56 new, what removing an administrator takes (A72, the founder's reconcile note), the removal under way waiting on N1248 (T52) and drawn as absent; R57 new, `account`'s key made in the browser (C1), a key registered for the member and the glossary link; R58 new, `group-identity`'s `instancegroupseed`; R59 new, the screen `glossary` (A11); A5 is met by R18 (`group` carries the website claim and its verdict); K3807, K3806; DEC-330, DEC-331 (2), DEC-332 (3), (4)); R55–R59 worded to DEC-335 and DEC-336 (K3897: fills given to the key rows, the glossary's words given, R58 now only the one sentence); marked not yet met (T51). Last changed T51 (FR-25: R63–R77 new, the fix round of T51: a confirmed expertise's withdrawal, the founder in the key chooser, the screen `bias`, a copy of the record, the cover name's publication, the copy's health, the website file on `group`, the vouched documents in the group rules' picker, a member's link by handle, the confirmation before the grant that administers, a release no member recorded, the scanner's credential labels, the hosting account's recorder, `connect`'s declared fields, a scanner with no signatures; K4165, K4168, K4194, K4197, K4204, K4213; DEC-374, DEC-376, DEC-384, DEC-386); marked not yet met (T51). Fix round 6 (T51): R70 amended (G20; SCREENS-SETTINGS #17, K4595). Last changed T53 (BOB's worker pass for #325: R82 to R105 new; R4, R5, R13, R24, R30, R38, R41, R48 to R50, R53, R54 and R76 retired, `connect` and `teamai` leaving Settings for `screens-ai` (N1220, K5457); R1, R2, R3, R17, R34, R37, R47 and R57 amended to match; the places page as a tree with its information mark, the level's gauge, the placement's truth, the founder in the app and JOURNEYS' defects); marked not yet met (T53).

## Size (was the file's Size line)

**Size (P6).** Estimated 2,400–3,000 lines with comments, its own keyed sentences included, measured at its START (M-T46-1, K617).

## Text left under retired requirements

Under **R4** (retired; `connect`'s reads):

  - (K2960, K3004; `instance-setup` R81) `connect` also reads `bootstrap`'s `parts` and offers the sign-in only while `signin` is present.

Under **R5** (retired; `connect`'s acts):

  - **Subscription sign-in** (DEC-156; K2147; N897 (3)): "Open Anthropic's sign-in page" sends `op=subscriptionsignin` with body `{step: "start"}` and opens the answered `address` in a new browsing context (`rel="noopener noreferrer"`); the field "The code from Anthropic's page" sends `{step: "code", code}` in the body only, never stored, logged or drawn again; `connected: true` draws the second situation. Refusals are drawn by `interface-shell` R13, with these meanings in this module's `SCREEN_WORDS` until the design stream keys them: `NO_SIGNIN_WAITING` (the sign-in timed out or was never started: start again), `SIGNIN_REFUSED` (Anthropic's page did not accept the code; the runner's `detail` shown), `SIGNIN_UNAVAILABLE`, `SIGNIN_ADDRESS_UNEXPECTED`, `AGENT_WORKER_UNBOUND` (the sign-in cannot run on your group's Civicsmith yet), `AI_KEPT_AWAY` (`agent-runner` R17–R19, `agent-worker` R66, `signin-door` R1); `RUNNER_NOT_CONFIGURED` and `DISCLOSURE_DUE` by the translation the door relays (`signin-door` R1).
  - **API key:** `accountreferenceset` with the key in the request's body only, never drawn again.
  - **Disconnect:** a connected subscription sends `op=subscriptiondisconnect`; an API key, `accountreferenceremove`.
  - The member's own account panel (R9): `accountusesset`, `ailimitset` with `owner: "member:<me>"`.

## Satisfies (was the file's Satisfies list)

- Registry screens `members`, `account`, `connect`, `notes` (DEC-139); N897 (1), (3) (Bob's K2816: the assistant paid by Bob's own sign-in through `connect`); K2147.
- (T47) Registry screens `group-identity`, `security`, `translations` (`registry.json` at `a0fab7abf0`): R14–R16; DEC-152, DEC-153 (R14), DEC-157 (R16), DEC-165, DEC-166, DEC-168, DEC-169 (R15); N551, N669, N703, N710; N984 (R11), N985 (R12), N989 (R13).
- (T48) DEC-227 (1) (R25); DEC-215 (1) (R26); DEC-226 (2), (3) and K3158 (R27; registry screen `updates` at `4664e8efd4`).
- DEC-136 (R6, R7), DEC-153 (R6), DEC-156 (R5), DEC-188 (R1, R2, R4, R9), DEC-197 and DEC-196 (R1, R3; N934), DEC-149 (R2's sentence).
- (T51 FR-25) DEC-374 (R65, R69), DEC-376 (R63, R64, R66, R67, R68), DEC-384 (R72–R75), DEC-386 (R63).
- (T51) DEC-330 A5 (R18), A11 (R59), A72 (R56), A74 (R55, R57), B5, C1 (R57); DEC-331 (2), DEC-336 (1) (R58); DEC-332 (3) (R56), (4) (R55); DEC-335 and DEC-336 (7), (8) (R55–R59: keys with fills, the account's label, the glossary's words).
- (T53) K5562, K5563, K5568 (R91 to R94: DEC-484, DEC-485); K5450, K5452, K5458, K5497 (R83 to R85: DEC-404, DEC-468); K5438, K5444, K5454, K5569 (R86, R87); K5440, K5441 (R88); DEC-470 (R89); DEC-483 (R90, R94); K5456, DEC-462 (R82); N1220, K5457, DEC-420 (R95 and the retired R4, R5, R13, R24, R30, R38, R41, R48 to R50, R53, R54, R76); K5471 (6), K5474, K5561, DEC-472 (R96 to R105).

## Uses (was the file's Uses list; moved 4 Nov 2026, attempt 4)

- `setup-words.word`, `setup-words.hasWord` (K3366, K3368): every member-facing sentence, by key.

- `interface-shell`: the kit `cs` and the screen contract (its R21), the act gate and refusals (its R11–R13, R19, R20).
- `setup-words`: `WORD_ROWS` keys.
- (T47) Through the plane: `membership` (`groupdescription`, `groupdescriptionset`, R109, R110; R14), `instance-setup` (`groupdescriptiondraft`, R65; the translation ops, R67–R74, R16; `bootstrap`'s parts, R82, R13, R15), `file-safety` (R5, R27–R31; R15), `wizard-scripts` (R34's label; R11).
- Through the plane: `membership` (the roster and administrator acts, R12–R13, R123; R108's court sentence), `credentials` (R3, R9–R10, R33, R35, R43, R51–R62), `ai-use` (R12 and the limit acts), `instance-setup` (R53, R54, R64, R79), `hypotheses` (notes), `wizard-scripts` (R27, `writinghelp`), `signin-door` R1.
- (T48) Through the plane: `wizard-scripts` (`startfrom`, its R37; R25), `ai-use` (`aiuseovertime`, its R14; R26), `instance-setup` (`updatenotice`, `updatestart`, `updatelater`, `updateskip`, its R89, R90; R27).
- Tests only: `op-declarations` (`OPS`).
- (T51) Through the plane: `credentials` R6–R9 (`signeradd`, `signerset`, `signerlist`; R55, R57), `membership` R5 (`adminarith`; R56; the read of removals under way is N1248, T52's, and is not used in T51), (`instancegroup` and `instancegroupseed` are not used by a session: R58, DEC-336 (1).) `interface-shell` R90, R95, R97, R101 (the kit options, chips and terms, the signer and the new paths).
- (T53) For the founder's lines (R91 to R94): `member-roster` K5562-R1 to K5563-R5 (`adminremove`, `adminremovals`, `adminendorse`, `adminproposalcancel`) through the plane; for the gauge (R86, R87): the plane's weekly indicator counts (PL26) and `runtime-limits`' level rows (`levelOf`, `levelFigures`) through the plane; `instance-setup` R108 (`profiles`) and `local-facts` R23, R26 (R83). Tests only: `op-declarations` for the new and retired ops.

## Suggestions (was the file's Suggestions list; moved 4 Nov 2026, attempt 4)

- The sign-in refusals' words, DEC-197's handle sentence and the screens' own sentences are a HANDOFF to the design stream in BOB's channel act; until given, `SCREEN_WORDS` holds the meanings above (`screen.<id>.<part>` keys).
- The "Need more? Connect your own account" link is a scroll to the section, not a route. (T53: R9 is retired and `projectai` with it; R26's render is the one kept.)
- Tests per `draft-T46-interface.md` §4 (1): one table per screen lists every registry act; a test fails if a screen draws an act not listed, or a listed act is not drawn in the state where it applies.

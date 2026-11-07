# screens-ai: what is built, and what each open requirement waits on (7 Nov 2026)

For BOB. Attempt 2 (`job/screens-ai-2`), checked against `layer/11` at eed7d79ba, with `screens-settings` landed.

## Built

`bio-plane/src/screens-ai/`: three screens, `aiproviders`, `aimine` and `aiproject`, each passing `interface-shell`'s R21 check, every
act on its registry row, every sentence a word read by key. They draw `screens-settings`' `aiUsageBars` as a part and hold no render of
their own for an account's use.

**Met and struck: R2, R16.** Tests: `bio-plane/test/m/screens-ai/r2.test.mjs`, `r16.test.mjs`.

Built and tested, mark kept: R12, R13 (`r12-r13.test.mjs`), R15 (`drawer.test.mjs`). The open part of each is below.

**Found mark for control-plane** (BOB, 7 Nov): `control-plane/index.mjs`'s `APP_SCREENS` does not import screens-ai's `SCREENS`, so
the served page does not offer the three screens until control-plane adds them. That import is control-plane's, not in this diff.

## How R2 was read

- "Under each account the team pays for it draws Use by member": `aiusebymember` answers per owner (`group`), not per account, so the
  table is drawn once for the team's accounts, under "In use, in order". A per-account split needs an `account_id` on the read.
- The re-test switch's state has no read of its own: it is read from `ailimits`' `history` (the latest `retest_on` or `retest_off`;
  none means on, the owner's default).
- The health preview draws one row per AI and day of `aihealthpreview`'s `reports`. The world records no health counts, so the rows
  were checked only as the answer's (empty) list; a row's words are not verified.

## What each open requirement waits on (none of it in this module's paths)

| Req | Waits on | Owner |
|---|---|---|
| R1 | each row's "sends what where, keeps it how long", its listing word (listed, watch, lapsed, retired) and reason: a catalogue read; each account's health: a health read per account (`aipathready` is the plane's only) | ai-catalogue, op-declarations; ai-use or ai-accounts |
| R3 | "Add an AI": providers, plans, check answers with grade, source and date, not offered and held: a catalogue read | ai-catalogue, op-declarations |
| R4 | the time an account was stopped: `flagged_at` in `accountsof` (the table holds it; the read does not answer it); a stale catalogue: a read | ai-accounts; ai-catalogue |
| R5, R14 | `aisignin`, `aikeyreference` (declared, no store serves them: `UNKNOWN_OP`), `aiconnecttest` (same) | ai-accounts, ai-gate, store-assembly |
| R6 | the team's locked checks: `aichecks {level: group}` refuses a member `NOT_AN_ADMIN`; `checksInForce`'s sources have no op | ai-accounts, op-declarations |
| R7 | the team's locked checks, to a project owner who does not administer (as R6) | ai-accounts |
| R8 | the run's choices and moments as served answers (`aicontinue`, `aistop`, `aiwait`, `aiwithout`, `aiswitchaccount`, …) | ai-runs |
| R9 | `aitestsetup`, `aitestrun`, `airesultsend`, `airesultsdecline`: declared, `UNKNOWN_OP` in the store | ai-gate, store-assembly |
| R10 | `airesultsread`, `airesultown`: declared, `UNKNOWN_OP` | ai-catalogue, ai-gate, store-assembly |
| R11 | labels are drawn on other modules' screens; "How this run went" needs runs that `airunparts` answers (it answers `found: false` in the world) | screens-inquiry and others; ai-runs |
| R12, R13 | a refusal drawn by its owner's `ai.refused.<code>` key with its fills: the owners' refusals do not carry the fields their words name (e.g. `CHECK_LOCKED` answers `check_id` and `level`; `ai.refused.checklocked` asks `{check}` and `{level}`), and carry no `word` naming the key (ai-use's do; ai-accounts' do not). The shell draws them by `refusal.<code>` or the translation. | ai-accounts (a `word` and the named fields on each refusal), or interface-shell (draw a refusal's `word`) |
| R15 | the drawer's heading: R15 says "a key owed by design"; none exists, so the drawer is headed by `ai.usage.bars` meanwhile. The drawer is a box that redraws (interface-shell R90): the kit's fold (R139) is not built, and the shell has no hook for a fold's first opening | UX-DESIGN (the key); interface-shell (R139) |

`aiconnect`, `aimoments`, `aitest` and `airesults` are not built: each rests on the ops above.

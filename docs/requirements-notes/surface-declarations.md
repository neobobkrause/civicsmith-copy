# surface-declarations — notes from the job (attempt 1, 7 Nov 2026)

For BOB. What this attempt built, what it left, and why.

## Met

- **R10** read waves: `declareScreenReads(screen, reads)` (`op-declarations/compose.mjs`, checked by `declared.mjs`' `screenReads`) refuses an unknown op, a write, a skipped wave, a duplicate name and an argument `{from: <read>}` naming a read in the same or a later wave; `screenHops` derives one hop for the session plus one per wave.
- **R12** budget classes: `opBudgets()` gives every op in `OPS` a `{budget_class, ceiling_ms}` checked against `runtime-limits`' `budgetOf` (read-bounds.mjs). A row names its class in `t51.mjs`' `BUDGET_CLASS_ROWS`. Where no row names one, the op takes its kind's class: a write the write act's, a read the read act's (`defaultBudgetClass`). **For BOB to confirm:** that kind rule is my reading of "every op declares a class"; the alternative, a written row for each of about 1,100 ops, is a ruling. Screens take `screen_load` unless a row overrides it downward (`screenBudget`). `budgetFindings` reports a name with no row; an unknown class and an override above its class are refused.
- **R16** `followfrom` follow, the explore reads (the non-mutating `explore*` ops and `proposeParts`) explore, `interpretationOf`, `interpretedFor` and `limitsByKind` read act. `partsOf` takes `screen_load` because "full-load-share" is not a `runtime-limits` key (R18: no other key names a class); BOB to confirm. A first-wave `proposeParts` is refused by the wave check.
- **R18** `ai_act` for `ask`, the six `/draft` ops, `airunstart` and `aiconnecttest`; `gate_run` for `aitestrun`.

The budget table and the read waves are not `index.mjs` exports. `op-declarations`' t48 test pins that module's export list at 111 names, and that test is outside these paths. So they live in `compose.mjs`, which reads `OPS` lazily, only once one of its functions is first called (R69 holds: nothing is built at import).

## Not met, and whose work it is

- **R11**: built `SCREENREAD` (the spec), the declaration check (a write is refused) and `screenReadOf` (refused reads answered beside whole ones; past-bound or missing reads answered `slow` with the bound; `server_ms` capped by the bounds). Two things are left: an `OPS` row and a route for `screenread`, which wait until the control plane serves it, and the timer that actually cuts a slow read, which belongs to the door. The mark stays, reworded.
- **R13**: Home, Queue, Add and Document still name `heldcaptures` in their own read objects (`screens-daily/doors.mjs`, `screens-intake/held.mjs`, `screens-inquiry/document.mjs`). Found mark for those screens' modules: declare their reads through `declareScreenReads` with `heldcaptures` out of wave 1. Re-timing needs the study copy.
- **R14**: `adminproposalcancel` and `adminremovals` are declared by member-roster's `DECLARED_OPS` and agree with R81. But `adminproposalcancel` is not in `GOVERNANCE_ACTIONS`, and `adminremovals` is in no member-roster family. Both are hand tables in `index.mjs`, outside the declaration rows this START gives me.
- **R15**: these ops have no spec because no owner serves them yet: `aimodelchoose`, `aichooseother`, `aiaccountpick`, `aiaskadmin`, `airesultsdecline`, `aikeyreference`, `aisignin`, `aitestsetup`, `airesultsend`, `aiconnecttest`, `aitestrun`, `airunstart`, `airesultsread`, `airesultown`. The three Worker-only ops (`aicredential`, `aigatewayserved`, `aicredentialfailed`) are still in both session sets, which is a hand row. The alpha ops are not yet removed. The budget classes of every R15 op are stated in `BUDGET_CLASS_ROWS`, and the three screen moves have theirs in `moveBudgets()`.
- **R17**: `acceptProposals`, `interpretationWithdraw`, `guideOptOut`, `layersset`, `interpretationOf`, `interpretedFor`, `proposeParts` and `limitsByKind` have no owner declaration. The grades are op-grades' (F1). The classes are stated.
- **R9**: K5512's lines ("a source this text rests on changed", "last checked") are not in filing-templates or reading-guides, so the five-profile door test cannot pass. Not attempted.
- **F1**: grades, op-grades' work.

## Provider notice

- `filing-templates:712`: confirmed. This module's only filing-templates row is `templatebyhandle` (a `sessionread` in its family, `t51.mjs`), which `filingTemplatesOps` still serves.

- `notice-producers` (land dbb6ca4edf, layer PR 809), attempt 2: re-tested. The change adds the register-changed and register-import notices and their limits (`REGISTER_CHANGE_*`, `REGISTER_IMPORT_*`, `REGISTER_IMPORT_STATES`); it declares no op and changes no `DECLARED_OPS`, so nothing this module composes moved. The suite (`p3 test surface-declarations`) runs green on a branch holding dbb6ca4edf: 14 pass, 1 todo (the owed marks), 0 fail. No code change.

## Baseline

`op-declarations`' own suite has 6 failures before and after this change (R34 ai-use/pagetranscribe partitions, R3 NEEDS counts, R6), none touching these files.

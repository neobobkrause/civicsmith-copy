# screens-plan — notes

**Status** · Job screens-plan, attempt 1, 7 Nov 2026. For BOB (the coordinator) and the next job on this module.

## Met

- **R9** — each option row draws, beside its category, "Goes to {office} · {tier}" (`screen.plan.option.goes`; office from the option's `addressee`: an office's role and body, a reporter's or organisation's role and organisation, an audience's description; `screen.plan.option.nooffice` where there is none; tier by `screen.plan.option.tier.*`, "Not assessed yet" where none). A hypothetical matter's "Assumed: not shown yet" is followed by `screen.plan.support.hypothetical.means`. Words are the design lane's (5 Nov). Test: `bio-plane/test/m/screens-plan/t53-plan.test.mjs`.
- **R10** — a phase with a checkpoint draws its test (`condition`) and where each judgement leads ("if met, go to {phase} / if not met, go to {phase}", from `branches`), or "no next step set" where none is set; its judge day is the row's due date. New words, written once with `localize` in `words-fix-plan.mjs` (`screen.plan.checkpoint.tests`, `.leads.met`, `.leads.not_met`, `.nonext`). They go to the unreviewed list, waiting for the design lane's review. Same test file.

## Not met

- **R8** (a taken item stays taken after a reload) needs a change in a provider module. "Take this up" sends `itemtakeup` (plan-work R11), which writes the take-up but answers it only in the act's own reply. No op lets a screen read take-ups back: `plan-work.takeUpsFor` is called only by `action-producers`, and the `plan` read carries no take-up. `itemTakeUp` also takes no target date, so "her target date" has nothing to read either. Today the screen keeps the taken state only for the page's life (`view.ui.took`). To unblock: a provider (plan-work, or action-plans' `plan` read) needs to answer, for each checkpoint and escalation stage the viewer can see, who took it up and when, plus the target date if R8 keeps it. That needs an op declaration in `op-declarations` too. After that, this module draws the answer. Left as `test.todo` in the test file.

## Provider notices

- `action-plans:726` — checked. The plan screen imports no `action-plans` export. It reads the `plan` op's answer, and the fields this job draws (an option's `addressee` and `tier`, a phase's `condition` and `branches`) have the same shape in `bio-plane/src/action-plans/values.mjs` on this branch (`addresseeOf`, `checkPhases`). No change needed.

# screens-ai: why the first job stopped (5 Nov 2026)

For BOB. The job for `screens-ai` (attempt 1) built no screen and struck no mark. These notes list what each requirement needs that is not on `tranche` yet (checked at 2abde07b, and on the `job/` branches of ai-gate, ai-runs, ai-use, ai-catalogue, instance-setup, wizard-scripts and op-declarations). None of it is in this module's paths.

## Why the screens can't be served yet

`interface-shell`'s `checkScreens` (its R21) throws when a screen's act names an op that `OPS` doesn't hold, or an op the registry row doesn't list for that screen. So a screen can't carry these acts until they exist.

**1. Ops not in `OPS`** (`op-declarations`; each op's owner from this file's Uses):

| Op | Owner | Needed by |
|---|---|---|
| `aibudgetset` | ai-use | R2 |
| `aiprojectbudget` | ai-use | R7 |
| `aisignin` | ai-accounts | R5, R14 |
| `aikeyreference` | ai-accounts | R5, R14 |
| `aiconnecttest` | ai-gate | R5 |
| `aitestsetup` | ai-gate | R9 |
| `aitestrun` | ai-gate | R9 |
| `airesultsend` | ai-gate | R9 |
| `airesultsdecline` | ai-gate | R9 |
| `airesultown` | ai-gate | R10 |
| `airesultsread` | ai-catalogue | R10 |
| `aiwaitswitch` | ai-runs | R8 |
| `airunparts` | ai-runs | R11 |
| the run's choices (`aicontinue`, `aistop`, `airunstart`, `aiaccountpick`, and the rest of `aimoments`' owed row) | ai-runs | R8 |
| `assistantreadiness` | instance-setup | R1, R11 |

**2. Ops missing from registry rows** (`wizard-scripts`' `screen-registry.mjs`, from the design's `registry.json`):

- `aioptinset` is in `OPS` but on neither `aiproviders`' nor `aimine`'s owed row. R1 and R6 need it.
- `projectrequest` and `projectjoin` are not on `aiproject`'s row. R16 needs them.

## Reads with no op

- **The catalogue.** Nothing serves its providers, plans, entries, check answers (with grade, source and date), listing word (listed, watch, lapsed, retired) with its reason, or whether the copy is stale; `ai-catalogue` routes no op. R1 needs it for each row's "sends what where, keeps it how long" and its listing word. R3 needs it for the whole "Add an AI" fold, and R4 for the out-of-date-list state. K5571 (5) says op-declarations names these reads at START; none is named.
- **Health per account.** R1 shows each account's health. `aipathready` is the plane's and is not in `OPS`, and no read answers health per account.
- **`checksInForce`.** It is in-plane only, with no op, so R6 can't show the sources of each check in force for a member.
- **The team's checks, for a member.** `aichecks {level: "group"}` refuses a member who doesn't administer with `NOT_AN_ADMIN`. So `aimine` and `aiproject` (R6, R7) can't show which checks the team locks.
- **When an account was stopped.** `accountsof` and `accountstate` answer `flagged` and `flag_cause` but not `flagged_at`, and R4's sentences name the time. `creditsStopsOpen` (ai-accounts R75) holds the time, but it is in-plane only.

## Other

- **R15.** The drawer must use `screens-settings`' `aiUsageBars`; this module may hold no render of its own. `build/modules.json` doesn't list `screens-settings` among `screens-ai`'s uses, and R15 asks for that edge.
- **R11.** The labels `screen.machine.*.ai` are drawn on the screens that label the assistant's work, which belong to other modules. The run's parts need `airunparts`.
- **R12, R13, R14.** These hold over the screens as built, so they are met when the screens are.

## What does work today

Checked with a real store world (store-request's `storeWorld({ai: true})`, founder and one member):

- `accountsof {owner: "group"}` answers each account in order. Each carries `position`, `provider`, `plan`, `means`, `on`, `held`, `flagged` (with `flag_cause`), `opt_in`, `switches` and `entries`; a member gets the shorter form.
- `aichecks {level: "group"}` answers `{ticks: {P1..P7}}`.
- `aioffered`, `aiusebymember {owner}`, `aiuseovertime {owner}`, `aihealthpreview` and `accounthistory {owner}` all answer.
- These acts are in `OPS`: `aiaccountadd`, `aiownadd`, `aiaccountremove`, `aiaccountswitch`, `aiorderset`, `aiprojectorder`, `aimemberallow`, `aiprojectuse`, `aimineuse`, `aicheckset`, `aiprojectcheckset`, `aimycheckset`, `aikeyenter`, `aikeycloudflare`, `aikeyseal`, `aitermsaccept`, `aipersonalchoose`, `aicreditsclear`, `aioptinset`, `airetestset` and `aihealthset`.

The next job can build on these as they stand.

## To unblock

1. Land the ops in table 1 with their owners' jobs.
2. Add the owed acts in list 2 to the registry rows.
3. Give the catalogue, the health, `checksInForce` and the team's checks (for members) a read each, named in op-declarations.
4. Add `flagged_at` to `accountsof`.
5. Add the uses edge `screens-ai` → `screens-settings` to `build/modules.json`.

Then restart this job. Once ai-gate, ai-runs and instance-setup are in, all seven screens can be built in one job.

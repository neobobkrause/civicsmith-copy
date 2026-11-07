# ai-runs — requirements notes

Text moved out of `build/requirements/ai-runs.md` to bring that file under the requirements cap (70,000 bytes), unchanged in wording (job ai-runs, T53). No requirement lives here: every **R<n>** line and its mark stays in the requirements file. `bio-plane/test/m/ai-runs/requirements-ids.test.mjs` asserts the move changed no id and no mark.

## Change history (the requirements file's former Status line)

**Status** · In force: approved by Bob 2026-09-26 (K102), as split that day (K82: `op=suggest` and the EXTRACT proposals to `run-productions`, the bias debt to `bias`). Split again for size (K617, K649 (1)): R1–R8 and R44 retired here, moved to `run-rules`. Last changed T35 (T35-44: R48, R52 amended; R54 new); every requirement met (K1990). Last changed T40 (T40-8: R48–R51 retired, moved to `ai-use` R1–R4; R52, R53 amended; R72 new; N812; K2373, K2394); those marked not yet met (T40), now T41. Last changed T41 (T41-23: R73–R76 new, the explorer's runs, batches, the test bar and a run's actual cost, as `draft-T41-investigation.md` §3.6; K2405, K2418), not yet met. Last changed T46 (T46-14: R78 new, `testInstance()` and `partAdmitted`, the test-instance exception as the one gate, its label answered by R10, R19 and R28; R18 amended, a member's own run on her own sign-in dispatched for her only at her act (Bob's, K2892); N897 (2), K2816, N919); marked not yet met (T46). Last changed T47 (T47-20: R18 amended, a member's run dispatched at her act under the segment credential `credentials` R63 mints, T46's page-held one-day credential retired, so a reloaded dock continues the run; R14 amended, the run's segment credentials ended with it; N955, K2976, K2999, K3027, K3030; R40 re-worded, its "(today only check)"; N949); marked not yet met (T47). Last changed T48 (T48-30: `groupKeySwitches`, `accountUses`, `accountReferenceState`, `groupKeyState` and `accountFor` read from `ai-accounts`, `credentials` kept for `aiRunCredentialMint`, `aiRunCredentialsEnd` and `aiCredentialLook`, its tests following; R18, R52 and R79's citations re-pointed, meaning unchanged; N996 §5; K3195): no requirement's meaning changed, so none is marked. Last changed T50 (T50-13: R87–R89; K3637); marked not yet met (T50).

## Size

**Size (P6).** About 3,490 lines at T45 (K2826): `index.mjs` and `schema.mjs`. Under the 4,000 mark. A job reads it whole with its uses' public parts.

## R79's former notes (R79 is retired; its line stays in the requirements file)

  - This replaces the T38 sentence "no `secret` key at all" (`index.mjs`:2083, :3141).
  - The secret stays where an API key's does: never logged, stored or answered.
  - **Tests:**
    - a sentinel token held for the payer reaches the stub agent-worker's `account.secret` and no record;
    - control: an `apikey` account is unchanged.
  -

## Suggestions moved from the requirements file

- **What stays out.** `op=suggest`, `op=extractpropose`, `op=extractproposals`, `proposed_readings`, `suggest_refusals` and C-27 are `run-productions`'. The bias debt and C-26.13–C-26.19 are `bias`'s (K82 (3)); its queue item (`#obligationsBiasDebt`) is `queue`'s. The migration replay's `surfaced_in` arm and C-66.5 are `inquiry`'s; C-66.6 (`REPLAY_UNVERIFIED`) is `control-plane`'s; `aiCredentialLook` is `credentials`', C-29 `membership`'s; `searchedSection` is `case-authoring`'s (N138).
- **T46 (T46-14).** M-T46-3 at START: whether `CIVICSMITH_TEST_INSTANCE`, a `secret_text` binding, survives `deploy.mjs`' `keep_bindings` as the trial assumes; if not, the deploy's fix is `bundler`'s, and R78 is unchanged. M-T46-4 at START: whether `agent-worker`'s `/run` takes a member's sign-in principal through the runner; if not, its admission joins T46-19 (`agent-worker` R80) and R18's tests drive a stub binding until it merges. `partAdmitted` and `testInstance` are read by `question-explorer` (its R16), `instance-setup` (`bootstrap`'s `test_instance`) and `store-assembly` (R57, the transcriber); the door that calls `dispatchMemberRun` is `control-plane`'s (T46-59).
- **T47 (T47-20).** `credentials` R63 (T47-9, L2) is the provider; `control-plane` R77 (T47-65), the plane's `dispatchMemberRun` RPC (T47-66) and `screens-inquiry` (T47-61) retire the page's credential in their own jobs, so the composed plane carries the change only when they merge. `agent-worker` R37's `PLANE_OPS` writes are `AI_RUN_WRITES`; whether the gate confines the minted credential to its run and writes is `admission`'s (its R10). The Tests line above still says an open in mode `plan` is refused by R40; since T46 `plan` is deployed (`run-rules` R14), so that arm reads the deployed flag.
- **Tests.** Each refusal gets a negative control; R14 and R15 get the killed-run arm (a lapsed lease is reaped with its terminal entry); R18 the arm that counts calls at the binding; R23 the arm proving the search half has no lens field; R28 the arm proving an invisible run and an absent one answer alike. For K660: R46 each refusal in order with nothing written, `plan` stored and answered by `read` and `runFor`, and today an open in mode `plan` refused C-109.1 by R40 (control: an open in mode `check` with no `plan` still lands); R47 the registered check's refusal passed on unchanged, no check registered refused `AI_RUN_MODE_UNCHECKED`, a second registration `LISTENER_DECLARED` (control: a check answering null lets the open land).

## T53 job: readings taken, and what waits on other modules (for BOB)

Readings this job took where the requirement left a figure or a word open, each reversible and in this module:

- **Gate 1's source.** `partAdmitted(part, entry)` reads Gate 1 verdicts through one seam, `registerGateVerdicts(module, fn)`, which `ai-gate` registers at start; until it does, a real instance admits nothing (C-109.1, BOB's ruling). The module's tests stand in throwaway records in `ai-gate` R37's shape.
- **The open's admission** is judged on the entry the opener's account is served on. With no account serving the act, only the flag and the chain are asked there, so `AI_NO_ACCOUNT` (R52) is the refusal that answers.
- **`pause_max`** (R83, For BOB 8) is 24 hours, `AiRuns.PAUSE_MAX_MS`, overridden by `AI_RUN_PAUSE_MAX_MS`. `PROBE_BATCH` is 10 and `PROBE_INTERVAL_MS` 60,000 (R98).
- **`aisend`** is ai-accounts' op (its R51, R61); ai-runs does not serve or declare it (two modules may not serve one op, store-assembly R83). A run held for a recipient's notice is dispatched once ai-accounts records the notice read.
- **`aiwithout`** and a declined hop (`aistop`) end the run with the ending `cancelled`, partial results kept. **`aisendrefuse`** sends nothing and leaves the run held, so its member may still switch or continue without AI.
- **A continuation stays on its last segment's account**: only a hop moves a run (R84, R92), and after a hop the paying owner is the last segment's (R52).
- **`op=aipathready`** is reached through `registerPathReady(module, fn)`, registered by whichever module serves that op; with none registered the plane is not asked and the Worker's own `AI_PATH_NOT_READY` still withholds (R97). **The probe** (R98) is offered as `registerHealthProbe(slot)`; the composition root hands it the scheduler at start.
- **`produced_by`** (R107) is kept in `ai_run_producers`, keyed by the entry's seq; a label's display name must be the catalogue's for an entry the run's open segment was served on or used, or one this tick's usage names.

Not met here, each waiting on another module:

- **R40**: `PART_NOT_PASSED` has no `run-rules` row (its C-number is BOB's). Until it does, a mode no entry has passed is refused C-109.1.
- **R75**: `testBarRecord` is to move to `ai-gate`, which has no code yet. It stays here, recording `entry_id`; `groupTestResults` shows results per (entry, part).
- **R106**: `AI_RUN_IDEM_INVALID` has no `run-rules` row (its C-number is BOB's), so the retried write's `idem` is not built.
- **R46/R81 callers.** The R9 rename refuses `principalClaude`. `action-plans`, `plan-work`, `question-explorer`, `screens-inquiry` and `capture-requests` (which reads `runFor`'s old `principal_claude`) still use the old names and need provider notices.
- **ai-use** still asks ai-accounts' retired `accountUses({owner})`, so a project's owner cannot set its limit (a `test.todo` in `usage.test.mjs`). ai-use's `by_entry` (its R15) is not built yet; `session.cost` carries it once ai-use answers it.
- **F1 and `op=aipathready` (coordinator 23:20; BOB 23:30, 4 Nov).** F1 makes ai-runs the owner of `op=aipathready`: the plane's door answers it from ai-runs' `pathReadyRead` (declared in ai-runs' `DECLARED_OPS`, reaching OPS through op-declarations R80), fail closed, to a viewer who can see the account (`ai-accounts`' `accountState`). So the future source of a path's health, `agent-model`'s `health(account, entry)` over the Worker (R95, R97, R98; `agent-model` R35, which names that read `op=aipathready`), must be served under another name and registered with `registerPathReady`; until a module registers one, every dispatch is withheld `AI_PATH_NOT_READY` and the read answers not ready.

## Satisfies (moved from the requirements file, unchanged; job ai-runs, attempt 11)

- `docs/development/INVESTIGATIVE-SESSION.md` §3 (reads, the stated viewer), §11 (the run is an object; item 5 rules 1–3), §14 (bias a fence first), §14a (the cascade, running sessions visible in context), §14b items 3, 6 and 7 (resumable, bounded, the one exit, partial results).
- `docs/architecture/BIO_Assistant_and_AI_Roles_v0_1.md` §2 (the four roles), §3 rules 1–5, 8 and 10, §6 (the credential cascade, the woken run's caller), §7.3 (the `mints` bound).
- `docs/development/OBSERVATION-LOG-DESIGN.md` §4.4 (the run's log is the observation log).
- `docs/architecture/BIO_Content_Framework_v0_10.md` §13 (the lens a run was formed under).
- `docs/development/SCHEDULER.md` (interval consumers, self-terminating).
- `docs/architecture/BIO_Membership_Architecture_v2.md` §7 (sight); Bob's DEC-24, DEC-55, DEC-60, DEC-62, DEC-63.
- `BIO_Action_v0_1.md` §4 rule 1 (the planning run, R46–R47; K660).
- `BIO_Action_v0_2.md` rule 16 (K2780; T45, N893): a plan re-examined after a recorded response, started within the recording member's act (R46, R77).
- DEC-152 and DEC-153 (a draft's use and ceiling, R48, R52; T35, N686, K1837). DEC-149 ("your group's Civicsmith"; R54).
- K2816 (2) (Bob: the deployer-set test-instance exception, every output labelled; R78); K2892 (Bob: a member's own sign-in runs check and plan for that member only; R18).
- `build/layers.md`, layer 6's contract.
- (T53) AIR5, AIR7, AIR13, AIR25–AIR28, AIR41, AD7, AD13, AD14, AD36, AD37, BR13, BR18, BR19, BR22, BR27–BR29 (K5457, K5475, K5477, K5489): R9, R10, R12, R18, R19, R28, R40, R52, R54, R72, R75, R76, R78, R83, R84, R88, R90–R105; N1219, DEC-466 U1, U2: R99–R105.

- **Notice ai-use:378 (5 Nov 2026, attempt 12).** `ai-use` R10 now falls back to `agent-model.estimate`'s range for the entry an act is served on when the account has too few measured acts, and `useEstimate` answers a promise when an `entry_id` is named. Adapted: R74's `openMany` names the entry of the account `ai-accounts.accountFor` answers for her act (when that account is the paying owner's) and awaits the answer, so a new account's batch estimate is the entry's range (`price_only` or `measured`) rather than `not_known`. Test `notice-ai-use-378.test.mjs`; R74's test now expects `entry_id` in the asked fields. No requirement text changed.

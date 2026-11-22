Length: 43 lines. Last section: "Suggestions".

# signin-door: requirements

Next number: 7

**Size (P6).** Measured at its START (M-T47-1, K617).

## Public

### Purpose

The subscription sign-in door: a member's own sign-in with her Claude subscription, relayed to `agent-worker`'s `POST /signin`, each request traced, the token held through `credentials` and never answered, logged or echoed, and the test instance's trace read.

### Provides

- **R1** [met] (was `control-plane` R65) (N708; DEC-156; K2134, K2147, K2200 (9); `op-declarations` R36, `agent-worker` R66, `ai-accounts` R18) The door routes `subscriptionsignin` to `agent-worker`'s `POST /signin` through the `AGENT_WORKER` binding, refused to any caller not arriving by a member's own session, sending `{member, step, code?}` with `member` stamped from the session's `by`, never a value the caller sends, and `step` and `code` from the request's body only. `start` and `code` are refused while the group keeps its material away (`ai-accounts.aiKeptAway()`, its R7: `AI_KEPT_AWAY` with its row, nothing sent); `state` and `signout` are always sent. The runner's answer is relayed as given, status and body; the code is never logged, stored, echoed or put in an answer by this module (R30). When a `code` or `state` answer carries `connected: true` for that member, the door records it through `ai-accounts.subscriptionConnected({member})` (its R18), and only then. On the member's own `subscriptiondisconnect` and on the member's revocation (`ai-accounts` R27) the door sends `step: "signout"` for that member, and a failure to reach the runner changes neither act's answer. With no `AGENT_WORKER` binding it answers 503 `AGENT_WORKER_UNBOUND`; a silence, 502 `AGENT_WORKER_SILENT`. (T46; N897 (3), (4); `draft-T46-trial.md` §2.2 items 4, 5; `instance-setup` R54) `start` is refused `DISCLOSURE_DUE` while `instance-setup.disclosureOf({member})` answers `shown: false` for that member, nothing sent, after the keep-away refusal; its row is held with the door's other rows (R32; `answer-envelope` R8), the next free number, in DEC-83's form, its translation until `words.json` holds `refusal.DISCLOSURE_DUE`: "Read what connecting means first: your questions and what is read to answer them go to Anthropic under your own account." `state` and `signout` are never refused for it. `agent-worker`'s `RUNNER_NOT_CONFIGURED` (503) is relayed with its code and status unchanged, plus a `translation` read by key `ai.refused.signinabsent`, until `words.json` holds it: "Signing in with Claude is not installed in your group's Civicsmith yet. Whoever installed your group's Civicsmith can add it." Controls: a member with no disclosure recorded is refused `start` with nothing posted to the binding, and after `disclosureshown` the same `start` is sent; a stub binding without a runner answers 503 `RUNNER_NOT_CONFIGURED` carrying that translation.
- **R2** [met] (was `control-plane` R78) (T47; N981; K3030; amends R65, R32; `ai-accounts` R23; `answer-envelope` R14) A sign-in's `start` is refused `DISCLOSURE_DUE` as `ai-accounts.disclosureDue({member})` answers it (its R23, the one site that mints the code, K231), relayed as given, after the keep-away refusal and before anything is sent; the door no longer reads `instance-setup.disclosureOf` itself, holds no row of its own for the code, and its interim sentence goes (C-69.6 retired, `answer-envelope` R14). R32's rows no longer name C-69.6. Control: a member with no disclosure recorded is refused at `start` with C-29.40's `check` and translation, nothing sent to the runner; with one recorded the `start` is sent.
- **R3** [met] (was `control-plane` R85) (N1001; connect §3) Each `subscriptionsignin` request gets a `trace`, sent with `member_ref` to `agent-worker` in headers, one log line `signin.door` per request, `trace` in every answer.
- **R4** [met] (was `control-plane` R86) (K3060 D10; connect §3; amends R65) On `code` the door sends `hold: true`; an answer carrying `token` is handed to `ai-accounts.subscriptionTokenHold` (its R19) and its result read; `token` and `valid_for` are removed before answering `held: true`, or `held: false` with the fact's code; `state` is answered from `ai-accounts.accountReferenceState`'s `subscription`; disconnect and revocation drop the token through `ai-accounts` and send `signout`; an ask or draft answered `SIGNIN_TOKEN_REFUSED` calls `ai-accounts.subscriptionTokenRefused`. Test: a sentinel token in no answer, log or request but the hold.
- **R5** [met] (was `control-plane` R87) (connect §3) On a test instance only, a bounded trace store answers `op=signintrace` (the last 200 lines, no token, secret or code); elsewhere `SIGNINTRACE_NOT_TEST`.
- **R6** [met] (K5046 (c); K4168; `op-declarations` R80, R81; `op-grades` R49, R50; was `control-plane` R112, in part) The module exports `DECLARED_OPS`, a frozen object with the row of `subscriptionsignin`: `classes` `["admin", "member"]`, `machineClasses` `[]`, `mutating` true, `stamps` `["viewer", "by"]`, `needs` none, `weight` `credential`, `description` the word key of its row (`control-plane.declared.subscriptionsignin` today, a row of `setup-words`), `fields.accepts` `step`, `code` and `attempt`, `fields.requires` `step` (`BAD_STEP`, `agent-worker` R66's refusal, relayed as R1 relays it). It is no longer declared by `control-plane`'s owner map, so no op is declared twice (`store-assembly` R83). Test: `declaredOpHolds` through `subscriptionSignin` over a stub binding that judges `step` as `agent-worker` R66 does (without `step` the refusal is relayed; `code` and `attempt` are accepted; a field outside the declaration is dropped); the registration takes the row. Control: a row whose stamps disagree with the hand row is refused naming the op.

## Private

### Uses

- `agent-worker`: `POST /signin` through the `AGENT_WORKER` binding (its R66, R81, R84; R1, R3, R4).
- `ai-accounts` (since T48; N996): `aiKeptAway`, `subscriptionConnected`, `disclosureDue`, `subscriptionTokenHold`, `accountReferenceState`, `subscriptionTokenRefused`, the member's revocation (its R2, R7, R18, R19, R23, R27; R1, R2, R4). A `modules.json` edge `signin-door → ai-accounts` once its code imports it (today it reaches them through `credentials`' delegates, `credentials` R72).
- `admission`: the caller it admits (a member's own session; R1).
- `answer-envelope`: the relay and refusal rows (R1, R2).

### Invariants

- None of its own beyond R1–R5: R1, R4 and R5 carry `control-plane` R30's rule that no code, token or secret is logged, stored, echoed or answered.

### Satisfies

- As `control-plane` R65, R78, R85–R87 satisfy them: N708, DEC-156 (R1); N981 (R2); N1001, connect §3 (R3–R5); K3060 D10 (R4).

### Suggestions

- The split is copy then delete (K624): this module merges after `store-door` in L11; `control-plane`'s job (T47-65) deletes its copies after it.

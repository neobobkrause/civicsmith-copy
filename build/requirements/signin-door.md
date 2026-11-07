# signin-door — requirements

**Status** · Fix round 10 (T51; K5046 (c)): R6 new, `subscriptionsignin` declared here (from `control-plane`). New in T47 (T47-91; N1001; connect §3; K617, K624; folded K3100, the fold draft's doubt 2 taken): split by copy from `control-plane` for size, layer 11 after `store-door` and before `interface-assets`. R1–R5 are `control-plane` R65, R78, R85, R86, R87, meaning unchanged, each marked "was"; `control-plane`'s job deletes its copies and routes `subscriptionsignin` and `subscriptiondisconnect` to this module (its R26 pattern). Not yet met (T47). T48 (T48-67; N996; K3101): citations of `credentials` R35, R43, R64, R70 and R16's sign-in clause re-pointed to `ai-accounts` R7, R18, R23, R19 and R27, wording only, unmarked (K3038). Last changed T53 (BOB's worker pass for #325: R1 to R6 retired, the sign-in relay and `subscriptionsignin` replaced by the adapter's connect flow and `aisignin`, N1220, K5457, N1199). With every line retired the module is empty: removing it from `modules.json` and `layers.md` is BOB's act at the layer-11 START (the worker did not edit them), and `agent-worker`'s job removes `POST /signin`.

**Size (P6).** Measured at its START (M-T47-1, K617).

## Public

### Purpose

Retired whole (T53, K5571 (6); `draft-assistant-screens.md` §9). The subscription sign-in door (a member's own sign-in with her Claude subscription, relayed to `agent-worker`'s `POST /signin`) is replaced by the adapter's connect flow behind `agent-model` and the op `aisignin`, which `ai-accounts` owns and `op-declarations` R90 declares. This module provides nothing; its removal from `modules.json` and `layers.md` is BOB's act at the layer-11 START.

### Provides

- **R1** retired (T53, N1220, K5457; N1199; `draft-assistant-screens.md` §9, `FOLD-AI.md` §2.8): the relay of `subscriptionsignin` to `agent-worker`'s `POST /signin` is replaced by the adapter's connect flow behind `agent-model` (`aisignin`). *(retired: T53)*
- **R2** retired (T53, N1220, K5457; N1199; `draft-assistant-screens.md` §9, `FOLD-AI.md` §2.8): `subscriptionsignin` is retired, so is its `DISCLOSURE_DUE` refusal at `start` (the disclosure before first material goes to a provider is `aimoments`', `ai-accounts` R23). *(retired: T53)*
- **R3** retired (T53, N1220, K5457; N1199; `draft-assistant-screens.md` §9, `FOLD-AI.md` §2.8): the sign-in relay and its trace are retired; the connect flow's own trace line replaces them (`agent-worker`, `draft-agent-run-path.md` R83 to R85). *(retired: T53)*
- **R4** retired (T53, N1220, K5457; N1199; `draft-assistant-screens.md` §9, `FOLD-AI.md` §2.8): the held-token hand-off of the Claude sign-in is retired; a provider-issued token is `ai-accounts`' under `aisignin`. *(retired: T53)*
- **R5** retired (T53, N1220, K5457; N1199; `draft-assistant-screens.md` §9, `FOLD-AI.md` §2.8): the sign-in trace read goes with the relay (`agent-runner` `POST /signin` is retired). *(retired: T53)*
- **R6** retired (T53, N1220, K5457; N1199; `draft-assistant-screens.md` §9, `FOLD-AI.md` §2.8): `subscriptionsignin` is no longer declared: it is retired and replaced by `aisignin`, declared by `ai-accounts` (`op-declarations` R90). *(retired: T53)*

## Private

### Uses

- None. Every line is retired (K5571 (6)); the relay, its trace and the sign-in token hand-off left with the Claude sign-in route (`draft-assistant-screens.md` §9). The edges to `agent-worker`, `ai-accounts`, `admission` and `answer-envelope` go when BOB removes the module from `modules.json` at the layer-11 START.

### Invariants

- None. (The rule of `control-plane` R30 that no code, token or secret is logged, stored, echoed or answered binds the connect flow that replaces this module's lines, `ai-accounts` and `agent-model`.)

### Satisfies

- As `control-plane` R65, R78, R85–R87 satisfy them: N708, DEC-156 (R1); N981 (R2); N1001, connect §3 (R3–R5); K3060 D10 (R4).

### Suggestions

- None. The module is removed whole at the layer-11 START (BOB); `agent-worker`'s job removes `POST /signin`.
- **F1** (store-request job, 4 Nov; met 4 Nov) signin-door asks the retired store route accountreference: STORE_ROUTES.state is 'accountreference' (bio-plane/src/signin-door/index.mjs:65), which ai-accounts' T53 rewrite retired with no alias (ai-accounts R35, R10), so subscriptionSignin's state read answers 'unknown op: accountreference' and a member's subscription sign-in breaks (store-request world.test R17 and recipes-team connectedSignIn, measured 4 Nov). Read the T53 account state (accountstate, or ai-accounts' current R-numbered read) instead, with a test that a connected subscription sign-in reads its state through the T53 route.
- **F2** *(not yet met: coordinator ruling 5 Nov 04:19)* op-grades R57 (op-grades.md:132): remove the alpha AI ops declared at bio-plane/src/signin-door/index.mjs:48, keeping affordances' totality.
- **F3** *(not yet met: coordinator 17:20, op-declarations ruling)* Retire subscriptionsignin from DECLARED_OPS at bio-plane/src/signin-door/index.mjs:48 (op-grades R57: in no table); bio-plane/test/m/signin-door/declared-ops.test.mjs:47 (R6) follows, testing that the registration takes no subscriptionsignin row from this door.

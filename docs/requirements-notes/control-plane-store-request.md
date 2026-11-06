# control-plane-store-request — notes

**Status** · Job control-plane-store-request, attempt 1 (5 Nov 2026). For BOB and the next job of this module.

## What this job did

This module owns no code yet (coordinator ruling 17:48: the code stays `control-plane`'s, in `bio-plane/src/control-plane/` and `bio-plane/src/store-request/`, until a START moves it). Both open marks, R64 and R29 (`T52`), are already met by the code on `tranche`; this job proves each with a test in `bio-plane/test/m/control-plane-store-request/` and strikes the mark. No code changed.

- **R64** — `r64-digest-body.test.mjs`: through the real door (`makeFetch`, `control-plane`'s harness world), each of the ten ops R64 names, with a sentinel secret for the seven grant doors and the generated secret for the three mints. The digest is in the store request's body only, never in an address or a header of any request the plane makes, and the owner's own map (`reviewOps`, `caseInputsOps`, `filingTemplatesOps`, `credentialsOps`) reads it. Control: those maps read no digest from the address.
- **R29** — `r29-no-caller-stamp.test.mjs`: every op `OP_STAMPS` gives a stamp, through `innerRequest`, for six kinds of caller that admission admits over a real world store (founder, member, organisation's ai credential, admin, probe, daemon). Every stamp is forged in the address and the body, and none reaches the place a handler reads it. Then one request through the real door, with a control: a parameter that is not a stamp passes.

## Seen, not acted on

- The query-stamp names (`viewer`, `identity`, `author`, …) that a caller sends in the **body** reach the store's body unchanged for most ops. Handlers read those stamps from the address (`control-plane` Suggestions: "Handlers read stamps from the request, never the body's own fields"), and R9 lists only `BODY_STAMPS`, so R29 holds as written. If a handler ever reads a body `viewer`, R29 would break without any test going red.
- `bodyBy` in `OP_STAMPS` is a declaration (store-request R10), not a key a caller can send.

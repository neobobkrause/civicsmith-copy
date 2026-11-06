# op-capabilities — requirements

**Status** · Draft, T49 (K3298, K3327; `build/extraction/op-declarations-split.md`, reviewed in `build/plan/draft-T49-fold-L11-a.md` §0): split from `op-declarations` for size (P6) by copy. R1 states the hand-written half of `op-declarations` R3's `NEEDS`; R2 and R3 are the forms of its R5 and R69 for this table. No requirement changes meaning. Every requirement is not yet met (T49).

**Size (P6).** About 913 lines copy from `op-declarations/index.mjs` (2,413–3,301 and 3,307–3,330), most of them the rows' standing comments; about 945 with the header, the cache and the wrapper. Well under 4,000.

## Public

### Purpose

The hand-written half of the op layer's capability table: for each op whose row its family's kind does not give, the one capability a session needs for it, or a stated `null` with its reason. It holds data only. It decides no caller's right and judges no request: `op-declarations` composes it into `NEEDS` (its R3), and `admission` reads that.

### Provides

Terms. A **capability** is membership's (its vocabulary); the rows use three of them, `contribute`, `publish` and `create_projects`. A **row** is an op's name and either one capability or `null`: no capability, stated, with its reason in the comment beside it. A **family row** is one `op-declarations` gives from an op's kind (its R19); it is not held here.

**needsRows() → frozen `{op: capability | null}`**
- **R1** Answers the 323 hand-written rows exactly as `op-declarations` held them at T49's opening, each with the comment that gives its reason: `contribute` for 185 ops, `publish` for 7 (`ratify`, `caseratify`, `publishat`, `publish`, `reviewgrant`, `reviewrevoke`, `strengthbar`), `create_projects` for `projectfork`, and a present `null` for the other 130. A `null` states that the op needs no capability. That covers a read, a public op, an act bounded by who the session is, and an unattended wake. It is not the same as no row: an op with no row needs none, and the answer has no key for it. No key is an alias (`op-declarations` R21 makes those over the composed table), and no key has a row its family's kind gives (`op-declarations` R19).
- **R2** The answer is frozen data. The module imports nothing, and neither importing it nor calling `needsRows()` reads or touches a store, the network, a clock, randomness or the environment. No place is named in a row or a comment. Every load of the module answers the same table.
- **R3** The table is built on the first call to `needsRows()`, never when the module is evaluated: evaluating it freezes no table of a hundred entries or more, the first call builds and freezes the table once, and every later call answers the same object and builds nothing.
- Errors: it takes no argument and never throws.

## Private

### Uses

- None. This module imports nothing: every value in the copied range is a string literal or `null`, and every other name in it is in a comment. Its `modules.json` `uses` is empty.

### Invariants

- Each row's value is one of `contribute`, `publish`, `create_projects` or `null` (R1).
- No op has two rows, and no key is an alias or has a family row (R1).

### Satisfies

- `docs/architecture/BIO_Membership_Architecture_v2.md` §5 (capabilities enforced at the op layer; a capability gates a session and nothing else).
- `CAPABILITIES.md` §4 (no fifth capability token): the rows name only the existing capabilities.
- Bob's rulings K3 and K23; `layers.md` ruling 2 (declarations stay with the door); K617, K624; K3298 (this split).

### Suggestions

- **Paths.** `bio-plane/src/op-capabilities/index.mjs`, exporting `needsRows`; tests in `bio-plane/test/m/op-capabilities/`.
- **Copy, then compose.** The rows and their comments are copied unchanged from `op-declarations/index.mjs` 2,413–3,301 and 3,307–3,330. The only new code is the wrapper (`let rows; export function needsRows() { return rows ??= build(); }`, with `build()` returning `Object.freeze({ … })`). `op-declarations` deletes its copy and composes at T49-17.
- **The census is the caller's.** That every mutating op a session reaches has a row in `NEEDS` is `op-declarations` R3's test over the composed table, because this module cannot read `OPS` or `SESSION_OPS`.
- **Tests.** R1 against a golden copy of the 323 rows taken at T49's opening, with the count by value, and a control that an absent op answers `undefined`, not `null`. R2 as `op-declarations` R5 and R7 are tested, with no `import` in the source text. R3 in a child process, by `op-declarations`' R69 method (`t48.test.mjs`:440).

- **F1** *(not yet met: BD-1, corpus-export R17/R18)* Golden capability rows for corpus-export's whole-record export (BD-1): exportwhole and exportwholepart, founder-only like export, so a member session is refused at the door. Needed for corpus-export R17 (a member is refused) and R18 (each part fetchable through op=exportwholepart); corpus-export reruns for its door tests once op-declarations, op-grades, op-capabilities and store-assembly carry these rows.

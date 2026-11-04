# op-declarations: requirements notes

## Split proposal (job op-declarations, attempt 1, 2026-11-04), for BOB

**Why moving text out can't work.** `build/requirements/op-declarations.md` is 126,484 bytes, and the cap is 70,000. Its 92 requirement lines (R1–R93, no R44; no F lines), kept word for word as the START requires, come to **71,521 bytes on their own**. That is over the cap before any heading, the Terms, or a test sub-bullet. Only R93 is marked `(not yet met: T53)`. Stripping each line's opening source bracket would save 4,937 bytes, but that is not word for word, and the file would still sit at about 66.6k plus headings, too close to the cap to hold. So the file has to split.

**Proposed split.** The break is by tranche. R1–R75 are the tables, the act gate, the invariants and the op specs of K921 through T50. R76–R93 are T51's browser acts and reads, the T51 fix round, and T53's combined read, budget classes, founder's acts and assistant ops. Together R76–R93 are 24,077 bytes of requirement lines.

- **New module `surface-declarations`** (layer 11) takes R76–R93, renumbered R1–R18. Each line says "was op-declarations R<n>", and the meaning does not change (the same precedent as K617/K624, by which `control-plane` R34 and R31 became this module's R1 and R6). It owns `BROWSER_ACTS`, `T51_SHARES`/`T51_FAMILIES`, the owners' declarations (`declared.mjs`, R80/R81), the screens' read waves and `screenread`, the `budget_class` rows, and the assistant's ops. It exports them as rows that `op-declarations` composes, the way it already composes `op-capabilities`' `needsRows()` into `NEEDS` (R3).
- **`op-declarations` keeps** R1–R75 with their ids. It gains a "Uses `surface-declarations`" line, and its R6 totality reads the composed rows. Expected size is about 47.4k of requirement lines plus headings and Terms, which leaves room under the cap.

**`build/modules.json`.** Insert this row between `op-capabilities` (line 165) and `op-declarations` (line 166):

```json
{"id": "surface-declarations", "layer": 11, "paths": ["bio-plane/src/surface-declarations/"], "tests": ["bio-plane/test/m/surface-declarations/"], "uses": ["setup-words", "test-support", "runtime-limits", "capture", "promotion", "basis-versions", "entities", "project-roster", "filing-templates", "standards", "calculations", "member-roster", "ai-use", "ai-runs", "ai-gate", "ai-catalogue", "notice-producers", "mail-door", "registers"]},
```

Then add `"surface-declarations"` to `op-declarations`' `uses`. Every owner listed above is already in `op-declarations`' uses. So that each one sits earlier in the order than the new row, check where the order places it; the new row must come after all of them.

**`build/layers.md`.** Add `surface-declarations` to layer 11's module list, just before `op-declarations`, and add this table row:

```
| surface-declarations | 11 | op-capabilities (before op-declarations) | T51's browser acts and reads, the screens' declared read waves and `screenread`, every op's and screen's budget class, and the assistant's and other lanes' ops; split from `op-declarations` by copy for size, meaning unchanged (R76–R93 → R1–R18); pure data like it (K617, K624, K651) |
```

**What the split costs.** The code moves out of `op-declarations/t51.mjs`, `declared.mjs` and the T51/T53 parts of `index.mjs`, and `t51.test.mjs`, `declared.test.mjs`, `fix3.test.mjs` and `browser.mjs` move with it. That is one job for `surface-declarations` plus a re-run of `op-declarations`' job to consolidate R1–R75 and answer the notices.

**Other choices, BOB's or Bob's.** (a) Let this file go over the cap. (b) Let each requirement line move its opening source bracket into these notes. That is not enough by itself (see above), but it would help if combined with moving the "Test:" sub-bullets out.

**Not done this attempt.** Following the START, I stopped at the cap. No requirement text was moved, and the provider notices `calculations:70`, `connections:71` and `membership:77` are not answered.

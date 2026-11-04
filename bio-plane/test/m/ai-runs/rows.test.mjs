/* ai-runs R35, R39: the rows of the checks this module's acts mint, held in `run-rules`' table and read by key (its
   R11, R15); and no place in the module's outward text. The pure rules and their rows (R1–R8, R44, R45's figure) moved
   to `run-rules` with their tests (K617). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, ORG, ANN } from "./world.mjs";
import { AI_RUNS_CHECKS } from "../../../src/run-rules/index.mjs";

/** Every code this module's acts mint, with its catalogue number (R35, R40, R46, R47, R52, R73, R75, R78), read from the owner's
 *  declaration (N1073, K3268): `run-rules`' table (its R11, R15), the rows whose site is a function of this module's file. A row
 *  whose site is a pure rule `run-rules` mints and this module relays (`projectGate`, `checkBound`, …) is run-rules' own. The ceiling
 *  codes (R50, retired with R48–R51 to `ai-use`, K624) are not this module's: `ai-use` mints `AI_LIMIT_REACHED` and
 *  `AI_LIMIT_INVALID` in its own table (its R8). */
export const MINTED = Object.freeze(Object.fromEntries(Object.entries(AI_RUNS_CHECKS)
  .filter(([, row]) => /^src\/ai-runs\/index\.mjs /.test(row.where)).map(([code, row]) => [code, row.check])));

test("R35 (K624): the retired ceiling codes are no longer minted here — run-rules keeps them retired, their numbers never reused", () => {
  for (const code of ["AI_USE_CEILING_REACHED", "AI_USE_COPY_CEILING_REACHED", "AI_CEILING_INVALID"])
    assert.equal(Object.prototype.hasOwnProperty.call(MINTED, code), false, code);
  /* control: a code this module still mints is listed, and one it only relays from run-rules is not */
  assert.equal(MINTED.AI_NO_ACCOUNT, "C-109.10");
  assert.equal(Object.prototype.hasOwnProperty.call(MINTED, "AI_RUN_NOT_PROJECT_MEMBER"), false);
});

test("R35: each check this module's acts mint has its row in run-rules' table, read by key — its number, a translation and a where naming this module's site", () => {
  assert.ok(Object.keys(MINTED).length >= 26, "the declaration names every code this module mints");
  assert.equal(new Set(Object.values(MINTED)).size, Object.keys(MINTED).length, "a catalogue number is one code's");
  for (const [code, check] of Object.entries(MINTED)) {
    const row = AI_RUNS_CHECKS[code];
    assert.ok(row, `${code} has a row`);
    assert.match(check, /^C-\d+\.\d+$/, code);
    assert.equal(row.check, check, code);
    assert.ok(typeof row.translation === "string" && row.translation.length > 40, code);
    assert.match(row.where, /^src\/ai-runs\/index\.mjs /, code);
  }
});

test("R39: no place is named in the module's outward text — its acts' rows, refusals, notes and answers (R52's account, R73–R75's texts included)", async () => {
  const PLACE = /oakland|alameda|california|berkeley|san francisco|\bcounty of\b/i;
  const w = world();
  await w.group("ann"); w.bundle(INQ);
  const texts = Object.keys(MINTED).map((c) => AI_RUNS_CHECKS[c].translation);
  texts.push(JSON.stringify(await w.runs.open(OPEN({ run: "" }))), JSON.stringify(await w.runs.open(OPEN({ principalAi: null }))),
             JSON.stringify(await w.runs.open(OPEN({ mode: "extract" }))), JSON.stringify(await w.runs.open(OPEN({ plan: "PLN-2026-0001" }))),
             JSON.stringify(await w.runs.open(OPEN())), JSON.stringify(await w.runs.open(OPEN())),
             JSON.stringify(await w.runs.listInContext({})), JSON.stringify(await w.runs.read({ run: "R1", viewer: "admin" })),
             JSON.stringify(w.runs.log({ run: "R1", viewer: "admin" })), JSON.stringify(w.surface("INQ-2026-0100", { run: "NONE" })),
             JSON.stringify(await w.runs.close({ run: "R1", bound: "completed", viewer: "admin", caller: ORG })));
  /* R52's account, R73's origin and step, R74's batch, R75's group test */
  texts.push(
             JSON.stringify(await w.runs.open(OPEN({ run: "R9", principalAi: "x" }))),
             JSON.stringify(await w.runs.open(OPEN({ run: "R9", origin: "elsewhere" }))),
             JSON.stringify(await w.runs.open(OPEN({ run: "R9", origin: "explore" }))),
             JSON.stringify(await w.runs.open(OPEN({ run: "R9", step: "STP-2026-0001" }))),
             JSON.stringify(await w.runs.openMany({ steps: [], actor: ANN })),
             JSON.stringify(await w.runs.openMany({ steps: ["STP-2026-0001"], actor: ANN, viewer: ANN, principalPlane: ORG, skillVersion: "bio@1" })),
             JSON.stringify(w.runs.groupTestSet({ part: "check", by: ANN })));
  for (const t of texts) assert.equal(PLACE.test(String(t)), false, String(t).slice(0, 80));
});

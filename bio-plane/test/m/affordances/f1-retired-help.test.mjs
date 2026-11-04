/* affordances F1 (T53; ai-accounts R35; the affordances job's PR 244 receipt): act help holds none of the ai-accounts ops T53
   retired. R48: a key naming a retired op is not held. The retired ops are read from wizard-scripts' own `RETIRED_ACTS`
   (each retired door op with the T53 op that does its act, or null), never listed here (K3268). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RETIRED_ACTS } from "../../../src/wizard-scripts/data.mjs";
import { ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { ACT_HELP, ACT_HELP_OPS, ACT_HELP_KEYS } from "../../../src/affordances/act-help.mjs";

const RETIRED = Object.keys(RETIRED_ACTS);
const REPLACEMENTS = [...new Set(Object.values(RETIRED_ACTS).filter((v) => v !== null))];
const absent = new Set(Object.values(ACT_HELP_ABSENT).flatMap((g) => [...(g.ops ?? [])]));

test("F1: no ai-accounts op T53 retired is held in ACT_HELP_OPS, ACT_HELP or ACT_HELP_KEYS", () => {
  assert.ok(RETIRED.length >= 12, `wizard-scripts names ${RETIRED.length} retired ops`);
  assert.deepEqual(RETIRED.filter((op) => ACT_HELP_OPS.includes(op)), []);
  assert.deepEqual(RETIRED.filter((op) => Object.hasOwn(ACT_HELP, op)), []);
  assert.deepEqual(RETIRED.filter((op) => Object.hasOwn(ACT_HELP_KEYS, op)), []);
});

test("F1: each T53 op that replaces a retired one is explained by ACT_HELP or named in op-declarations' ACT_HELP_ABSENT", () => {
  assert.ok(REPLACEMENTS.length > 0);
  for (const op of REPLACEMENTS)
    assert.ok((Object.hasOwn(ACT_HELP, op) && ACT_HELP[op].length > 0) || absent.has(op), `${op} is placed`);
});

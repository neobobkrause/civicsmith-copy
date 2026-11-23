/* op-grades' requirements proven over every real owner (ARCH's placement after op-grades #1, PR 1167): op-grades comes before
   the owners of declared ops in the module order, so what it states of EVERY owner's `DECLARED_OPS` is proven here, after them,
   where control-plane already registers them all (`register-declared.mjs`). The owners are found by test-support's collector
   bounded at this module (`declaredOpsOf(root, "control-plane")`), never listed by hand. Each registration is made on a fresh
   instance of op-grades, so no table has been read before it (op-grades R50 (c)). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { declaredOpsOf } from "../../declared-ops.mjs";
import { OP_ALIASES as DECLARED_ALIASES } from "../../../src/op-declarations/index.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

const ROOT = fileURLToPath(new URL("../../../../", import.meta.url));
const OWNERS = await declaredOpsOf(ROOT, "control-plane");

/** A fresh instance of op-grades, its tables unread. */
let fresh = 0;
const load = () => import(`../../../src/op-grades/index.mjs?owners=${++fresh}`);
/** Every owner's rows, by owner, as `registerDeclaredOps` takes them. */
function byOwner(ops = OWNERS.ops, owners = OWNERS.owners) {
  /** @type {Record<string, Record<string, any>>} */
  const out = {};
  for (const [op, row] of Object.entries(ops)) (out[owners[op]] ??= {})[op] = row;
  return out;
}
/** An op-grades instance with every owner's rows registered. */
async function registered() {
  const m = await load();
  m.registerDeclaredOps(byOwner());
  return m;
}
/** A text as an owner declared it: a word key the list holds, or the sentence itself (op-grades R49, R51). */
const sentenceOf = (text) => (hasWord(text) ? word(text) : text);
/** The text of one requirement of op-grade-tranches (where op-grades' R13 and R17 are kept), read as text. */
function requirement(n) {
  const lines = readFileSync(new URL("../../../../process/modules/op-grade-tranches.md", import.meta.url), "utf8").split("\n");
  const line = lines.find((l) => l.startsWith(`- **R${n}**`));
  assert.ok(line, `op-grade-tranches R${n}`);
  return line;
}

test("op-grades R50 (B21): every owner's DECLARED_OPS, up to control-plane, registers with no DECLARED_OP_DISAGREES and no DECLARED_OP_DUPLICATE; control: one owner's read with its description changed is refused naming the op", async () => {
  assert.deepEqual(OWNERS.duplicates, [], "no op is declared by two owners");
  assert.ok(Object.keys(OWNERS.ops).length > 100, "the owners' rows are found");
  const m = await load();
  assert.doesNotThrow(() => m.registerDeclaredOps(byOwner()));
  /* control: a hand-rowed read whose owner's description differs is refused, naming it, and the instance stays open */
  const hand = Object.keys(OWNERS.ops).find((op) => OWNERS.ops[op].weight === "read" && Object.hasOwn((m.NON_ACTS), op));
  assert.ok(hand, "a declared read with a hand row");
  const changed = { ...OWNERS.ops, [hand]: { ...OWNERS.ops[hand], description: "a description its owner never wrote" } };
  const other = await load();
  assert.throws(() => other.registerDeclaredOps(byOwner(changed)), (e) => e.code === "DECLARED_OP_DISAGREES" && e.op === hand);
});

test("op-grades R13 (K5157): every read `answers` declares is named in NON_ACTS with its owner's sentence, and none holds a rung or ground; control: a write `answers` declares is weighed as an act", async () => {
  const m = await registered();
  const reads = Object.keys(OWNERS.ops).filter((op) => OWNERS.owners[op] === "answers" && OWNERS.ops[op].weight === "read");
  assert.ok(reads.length > 0, "answers declares reads");
  for (const op of reads) {
    assert.equal(m.NON_ACTS[op], sentenceOf(OWNERS.ops[op].description), op);
    assert.equal(Object.hasOwn(m.RUNGS, op) || Object.hasOwn(m.RUNG_ABSENT, op), false, op);
  }
  /* control: `standingquestionset`, a write `answers` declares, is weighed as an act, not a read */
  assert.equal(OWNERS.owners.standingquestionset, "answers");
  assert.equal(OWNERS.ops.standingquestionset.mutating, true);
  assert.notEqual(OWNERS.ops.standingquestionset.weight, "read");
  assert.equal(reads.includes("standingquestionset"), false);
});

test("op-grades R13 (K5159): every read an owner R13 names declares is a NON_ACT, with no rung or ground; control: the same owners' writes are graded, not read", async () => {
  const named = new Set([...requirement(13).matchAll(/`([a-z][a-z0-9-]*)`/g)].map((x) => x[1]));
  const owners = new Set(Object.values(OWNERS.owners).filter((o) => named.has(o)));
  assert.ok(owners.has("answers"), "R13's owners are found among the declaring modules");
  const m = await registered();
  const reads = Object.keys(OWNERS.ops).filter((op) => OWNERS.ops[op].weight === "read" && owners.has(OWNERS.owners[op]));
  assert.ok(reads.length >= 10, String(reads.length));
  assert.deepEqual(reads.filter((op) => !Object.hasOwn(m.NON_ACTS, op)), [], "every declared read holds its NON_ACTS row");
  for (const op of reads) assert.equal(Object.hasOwn(m.RUNGS, op) || Object.hasOwn(m.RUNG_ABSENT, op), false, op);
  const writes = Object.keys(OWNERS.ops).filter((op) => OWNERS.ops[op].mutating === true && owners.has(OWNERS.owners[op]));
  assert.ok(writes.length > 0);
  for (const op of writes) assert.equal(OWNERS.ops[op].weight === "read", false, op);
});

test("op-grades R17: OP_ALIASES names exactly op-declarations' own alias table, each alias to the same op; control: an alias takes its op's grade", async () => {
  const m = await registered();
  assert.deepEqual(Object.keys(m.OP_ALIASES).sort(), Object.keys(DECLARED_ALIASES).sort());
  for (const [alias, op] of Object.entries(DECLARED_ALIASES)) assert.equal(m.OP_ALIASES[alias], op, alias);
  const [alias, op] = Object.entries(DECLARED_ALIASES)[0];
  assert.equal(m.phoneOf(alias), m.phoneOf(op), alias);
});

test("op-grades R51 (K4247): a declared op's NON_ACTS reason is its owner's word: after every real owner registers, each such reason equals the owner's declared description; control: a read whose reason differs from its owner's is refused", async () => {
  const m = await registered();
  const compared = [];
  for (const [op, row] of Object.entries(OWNERS.ops)) {
    if (!Object.hasOwn(m.NON_ACTS, op)) continue;
    assert.equal(m.NON_ACTS[op], sentenceOf(row.description), op);
    compared.push(op);
  }
  assert.ok(compared.length > 0, "some declared op's reason was compared");
  const op = compared[0];
  const refuse = await load();
  assert.throws(() => refuse.registerDeclaredOps({ [OWNERS.owners[op]]: { [op]: { ...OWNERS.ops[op], description: "not the owner's word" } } }),
    (e) => e.code === "DECLARED_OP_DISAGREES" && e.op === op);
});

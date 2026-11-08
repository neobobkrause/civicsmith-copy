/* op-declarations F4 (layer 12, CR2-17; hypotheses F1, BD-17) and the provider notices leg-earning:1003, ai-runs:1004,
   hypotheses:1005 and inquiry:1006. The rival explanations' three ops, `hypothesisrivals`, `explorenext` and `rivals`, are
   admitted through hypotheses' own `DECLARED_OPS` rows (R80), registered as the plane registers them: this module adds no
   hand row for them, so the owner's row is the declaration and no R81 disagreement can arise. The ux lane gave each a text
   (DEC-502, `act.<op>.does`), which affordances holds in `ACT_HELP` (CR2-16), so R34 names none of them under any ground of
   `ACT_HELP_ABSENT`. Until hypotheses' re-pass (CR2-19) declares them, none has a spec or a session set. The four providers'
   changes add, rename or retire no op: R6 holds over each one's own map and declarations, read from its code (K3268). */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, NEEDS, OP_STAMPS, OP_FAMILIES, ACT_GATE, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { legEarningOps } from "../../../src/leg-earning/index.mjs";
import { aiRunsOps } from "../../../src/ai-runs/index.mjs";
import { inquiryOps } from "../../../src/inquiry/index.mjs";
import { hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { explained } from "./help.mjs";

/* F4: the three ops CR2-17 admits, named by this module's own requirement */
const RIVAL_OPS = ["hypothesisrivals", "explorenext", "rivals"];
const named = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);
const stub = () => new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
const served = (map) => Object.keys(map(stub(), new URL("http://plane/"), {}, stub(), stub()));

test("F4, R34, R80, R81 (CR2-17): hypothesisrivals, explorenext and rivals have no hand row here and are named under no ground of ACT_HELP_ABSENT; each is in OPS exactly when hypotheses declares it, and then its spec, NEEDS row, stamps and both session sets are its declared row's and ACT_HELP explains it (negative control: an op hypotheses does not declare has no spec)", () => {
  const fam = OP_FAMILIES.hypotheses;
  assert.ok(fam && fam.kinds, "hypotheses' family is missing");
  const declared = REGISTERED.hypotheses ?? {};
  for (const op of RIVAL_OPS) {
    assert.equal(Object.hasOwn(fam.kinds, op), false, `${op}: a hand row in hypotheses' family`);
    assert.deepEqual(named(op), [], `${op}: named under a ground of ACT_HELP_ABSENT`);
    const row = declared[op];
    if (!row) {
      assert.equal(Object.hasOwn(OPS, op), false, `${op}: a spec with no declaration`);
      assert.ok(!SESSION_OPS.member.has(op) && !SESSION_OPS.admin.has(op), `${op}: in a session set with no declaration`);
      continue;
    }
    assert.equal(OPS[op].mutating, row.mutating, `${op}: mutating`);
    assert.deepEqual([...OPS[op].classes].sort(), [...row.classes].sort(), `${op}: classes`);
    assert.ok(SESSION_OPS.member.has(op) && SESSION_OPS.admin.has(op), `${op}: not in both session sets`);
    assert.equal(ACT_GATE.mode(op), "session", `${op}: the gate's mode`);
    if (row.mutating) assert.equal(NEEDS[op], row.needs, `${op}: NEEDS`);
    assert.deepEqual([...OP_STAMPS[op]].sort(), [...(row.stamps ?? ["viewer"])].sort(), `${op}: stamps`);
    assert.ok(explained(op), `${op}: a member op with no ACT_HELP text and no ground (R34)`);
  }
  /* negative control */
  assert.equal(Object.hasOwn(OPS, "rivalsnosuchop"), false);
  assert.deepEqual(named("rivalsnosuchop"), []);
});

test("notices leg-earning:1003, ai-runs:1004, hypotheses:1005, inquiry:1006 (R6, R81): every op each provider serves or declares has a spec, and each declared row agrees with it (negative control: an op no provider serves has none)", () => {
  const PROVIDERS = {
    "leg-earning:1003": [served(legEarningOps), REGISTERED["leg-earning"] ?? {}],
    "ai-runs:1004": [served(aiRunsOps), REGISTERED["ai-runs"] ?? {}],
    "hypotheses:1005": [served(hypothesesOps), REGISTERED.hypotheses ?? {}],
    "inquiry:1006": [served(inquiryOps), REGISTERED.inquiry ?? {}],
  };
  /* R6: the in-process reads the control plane routes to no member (leg-earning R4, t33's IN_PROCESS) have no spec */
  const IN_PROCESS = { "leg-earning:1003": ["basis", "restson"], "inquiry:1006": ["basis", "restson"] };
  for (const [notice, [ops, declared]] of Object.entries(PROVIDERS)) {
    assert.ok(ops.length > 0, `${notice}: its map serves no op`);
    const internal = IN_PROCESS[notice] ?? [];
    for (const op of internal) assert.ok(ops.includes(op) && !Object.hasOwn(OPS, op), `${notice}: ${op} is specced or not served`);
    for (const op of new Set([...ops, ...Object.keys(declared)])) {
      if (!internal.includes(op)) assert.ok(Object.hasOwn(OPS, op), `${notice}: ${op} has no spec`);
    }
    for (const [op, row] of Object.entries(declared)) assert.equal(OPS[op].mutating, row.mutating, `${notice}: ${op}: mutating`);
  }
  assert.equal(Object.hasOwn(OPS, "nosuchop-cr2"), false);
});

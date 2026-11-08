/* op-declarations, provider notices filing-templates:712, actions:715, action-plans:726 and filings:727 (layer 11,
   attempt 7). Each provider changed its behaviour and none added, renamed or retired an op: filing-templates (R15,
   R35–R38: who reviewed which text), actions (R112–R116, action-grammar R31's law stages), action-plans (R55, R56:
   `idem` and `produced_by`, body fields of `optionpropose`) and filings (a test fixture). Confirmed with no change here:
   R6 holds both ways over each provider's own ops map and declarations, read from the provider's code (K3268), and
   action-plans' two new body fields reach `optionPropose` through its own map with `optionpropose`'s spec unchanged. */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, NEEDS } from "../../../src/op-declarations/index.mjs";
import { filingTemplatesOps } from "../../../src/filing-templates/index.mjs";
import { actionsOps, DECLARED_OPS as ACTIONS_DECLARED } from "../../../src/actions/index.mjs";
import { actionPlansOps, DECLARED_OPS as PLANS_DECLARED } from "../../../src/action-plans/index.mjs";
import { filingsOps, DECLARED_OPS as FILINGS_DECLARED } from "../../../src/filings/index.mjs";

const svc = () => new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({ ok: true })) });
const served = (map) => Object.keys(map(svc(), new URL("http://plane/"), {}, svc(), svc()));
const has = (s, o) => (s.has ? s.has(o) : s.includes(o));

const PROVIDERS = {
  "filing-templates:712": [served(filingTemplatesOps), {}],
  "actions:715": [served(actionsOps), ACTIONS_DECLARED],
  "action-plans:726": [served(actionPlansOps), PLANS_DECLARED],
  "filings:727": [served(filingsOps), FILINGS_DECLARED],
};

test("notices filing-templates:712, actions:715, action-plans:726, filings:727 (R6): every op each provider serves or declares has a spec in OPS (negative control: an op no provider serves has none)", () => {
  for (const [notice, [ops, declared]] of Object.entries(PROVIDERS)) {
    assert.ok(ops.length > 0, `${notice}: its map serves no op`);
    for (const op of new Set([...ops, ...Object.keys(declared)])) assert.ok(OPS[op], `${notice}: ${op} has no spec`);
  }
  assert.equal(OPS["nosuchop-l11"], undefined);
});

test("notice action-plans:726 (R6, R11's line in OPS): idem and produced_by are body fields that reach optionPropose through action-plans' own map, and optionpropose's spec, session sets and NEEDS row are unchanged", async () => {
  assert.ok(OPS.optionpropose, "optionpropose has no spec");
  assert.ok(has(SESSION_OPS.member, "optionpropose") && has(SESSION_OPS.admin, "optionpropose"));
  assert.equal(OPS.optionpropose.mutating, true);
  assert.ok(Object.hasOwn(NEEDS, "optionpropose"));
  let seen = null;
  const m = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : (args) => { if (k === "optionPropose") seen = args; return { ok: true }; }) });
  const body = { idem: "run-1:1:propose:1", produced_by: [{ provider: "p" }] };
  await actionPlansOps(m, new URL("http://plane/?plan=PLN-1"), body).optionpropose();
  assert.equal(seen?.idem, body.idem);
  assert.deepEqual(seen?.produced_by, body.produced_by);
  /* the spec names no body field: nothing in OPS needed changing for them */
  assert.equal("idem" in OPS.optionpropose, false);
  assert.equal("produced_by" in OPS.optionpropose, false);
});

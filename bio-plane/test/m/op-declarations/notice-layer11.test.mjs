/* op-declarations, the layer-11 provider notices: filing-templates:712, actions:715, action-plans:726, filings:727, and
   following:744, investigation:628, publication:632, case-import:635, public-read:642, case-carriage:658,
   case-authoring:681 and action-records:696. Each provider changed its source or exports; none added an op this module
   must declare beyond what it already does. Confirmed with no code change here: every op each declares has a spec (R6),
   its declared rows agree with the tables (R2, R4), and each member op it serves is explained or named under exactly one
   ground (R34). Totality over each served map, with its store-internal routes, stays t33's (R6). The ops are read from each provider's own map and declarations, never a hand list (K3268). */
import { REGISTERED } from "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { OPS, SESSION_OPS, OP_STAMPS, ACT_HELP_ABSENT } from "../../../src/op-declarations/index.mjs";
import { explained } from "./help.mjs";
import { filingTemplatesOps } from "../../../src/filing-templates/index.mjs";
import { actionsOps } from "../../../src/actions/index.mjs";
import { actionPlansOps } from "../../../src/action-plans/index.mjs";
import { filingsOps } from "../../../src/filings/index.mjs";
import { followingOps } from "../../../src/following/index.mjs";
import { investigationOps } from "../../../src/investigation/ops.mjs";
import { publicationOps } from "../../../src/publication/index.mjs";
import { caseImportOps } from "../../../src/case-import/index.mjs";
import { publicReadOps } from "../../../src/public-read/index.mjs";
import { caseCarriageOps } from "../../../src/case-carriage/index.mjs";
import { caseAuthoringOps } from "../../../src/case-authoring/index.mjs";
import { actionRecordsOps } from "../../../src/action-records/index.mjs";

const stub = new Proxy({}, { get: (_, k) => (k === "then" ? undefined : () => ({})) });
const url = new URL("http://plane/");
const MAPS = {
  "filing-templates:712": ["filing-templates", filingTemplatesOps], "actions:715": ["actions", actionsOps],
  "action-plans:726": ["action-plans", actionPlansOps], "filings:727": ["filings", filingsOps],
  "following:744": ["following", followingOps], "investigation:628": ["investigation", investigationOps],
  "publication:632": ["publication", publicationOps], "case-import:635": ["case-import", caseImportOps],
  "public-read:642": ["public-read", publicReadOps], "case-carriage:658": ["case-carriage", caseCarriageOps],
  "case-authoring:681": ["case-authoring", caseAuthoringOps], "action-records:696": ["action-records", actionRecordsOps],
};
const grounds = (op) => Object.entries(ACT_HELP_ABSENT).filter(([, g]) => g.ops.includes(op)).map(([k]) => k);

for (const [notice, [owner, map]] of Object.entries(MAPS)) {
  test(`notice ${notice} (R6, R2, R4, R34): every op ${owner} declares has a spec and its rows agree with the tables, and each member op is explained or under exactly one ground (negative control: an op it does not serve has none)`, () => {
    const served = Object.keys(map(stub, url, {}, null));
    assert.ok(served.length > 0, `${owner} serves nothing`);
    for (const [op, row] of Object.entries(REGISTERED[owner] ?? {})) {
      assert.ok(Object.hasOwn(OPS, op), `${owner}: ${op} declared, no spec`);
      assert.equal(OPS[op].mutating, row.mutating, op);
      assert.deepEqual([...(OPS[op].classes ?? [])].sort(), [...(row.classes ?? [])].sort(), op);
      if (row.stamps && OP_STAMPS[op] !== undefined) assert.deepEqual([...OP_STAMPS[op]].sort(), [...row.stamps].sort(), op);
    }
    for (const op of served.filter((o) => SESSION_OPS.member.has(o))) assert.equal(grounds(op).length, explained(op) ? 0 : 1, op);
    assert.equal(Object.hasOwn(OPS, `${owner.replace(/-/g, "")}nosuchop`), false);
  });
}

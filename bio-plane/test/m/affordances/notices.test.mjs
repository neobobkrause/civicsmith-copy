/* affordances: the provider notices of T53 (job affordances), each confirmed at this module's interface over the provider's real code.
   - action-clocks:60 (its R27–R29, PR 60): a proposal's key is now `<layer id>:<rule>@<proposer>`; `clockadopt` (R52) names the key
     action-clocks' own read answers, never one composed here, so two layers' proposals of one rule are offered as two acts.
   - credentials:74 (its R27, R63, R73, PR 74): `aigrantmint` stays credentials' op, graded and published as before; the run credential
     (R63, R73) is in-plane and no op; the account-reference ops `ai-accounts` R35 retired are served by no owner.
   - membership:77 (its R154, PR 77): `membershipOps` answers `adminproposalcancel` and `adminremovals` beside its own; registered as
     their owner declares them (op-grades R49), each is accounted for (R12) and neither is an act (R1). */
import "./register-owners.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import * as A from "../../../src/affordances.mjs";
import { affordancesOf } from "../../../src/affordances/facts.mjs";
import { RUNGS, RUNG_ABSENT, NON_ACTS } from "../../../src/op-grades/index.mjs";
import { world as cWorld, V as CV } from "../action-clocks/fixture.mjs";
import { FOREST, forestCopy } from "../../../../jurisdictions/test/fixtures/forest.mjs";
import { credentialsOps } from "../../../src/credentials/index.mjs";
import { aiAccountsOps } from "../../../src/ai-accounts/index.mjs";
import { membershipOps } from "../../../src/membership/index.mjs";

const url = new URL("http://x/");
const keysOf = (f) => Object.keys(f({}, url, {}, {}));
const published = (op) => [...A.ACTS, ...A.CAPTURE_ACTS, ...A.PER_ITEM_ACTS].some((a) => a.id === op);

/* ---- action-clocks:60 ---- */
const RULE = "records_response", CITY_A = "forest-city-a", CITY_B = "forest-city-b";
const LAYERS = ["forest-federal", "forest-state", "forest-county-a", CITY_A, "forest-county-b", CITY_B];
/* jurisdictions' published test forest, its two city-like layers each giving a rule `records_response` (as action-clocks' own T53 test) */
function forest() {
  const ls = forestCopy(FOREST.all).filter((l) => LAYERS.includes(l.id));
  for (const l of ls) if (l.id === CITY_A || l.id === CITY_B) { l.deadlines[0].rule = RULE; l.records_laws[0].response = RULE; }
  return { profiles: LAYERS, override: Object.fromEntries(ls.map((l) => [l.id, l])) };
}
/* The owners this scene does not drive answer as absent (R10), as t46's clock scene has them. */
const SILENT = { escalationsFor: () => ({ ok: true, items: [] }), determinationRead: () => ({ ok: false }),
  templatesForAction: () => ({ ok: false }), filingsFor: () => ({ ok: false }), remindersFor: () => ({ ok: false }),
  pressureFor: () => ({ ok: false }), holdsOf: () => ({ ok: false }) };

test("notice action-clocks:60 (R52 R18): two layers' proposals of one rule offer two clockadopt acts, each naming its own layer key", () => {
  /* each act's key is the one action-clocks answers, and is accepted; control: one adopted, only the other stays offered */
  const w = cWorld(forest());
  const CA = "ACTN-2026-0001-a", M = CV("alice");
  w.action(CA);
  assert.equal(w.actions.actionCorrespond({ target: CA, direction: "sent", at: "2026-06-05", account: "sent", viewer: M, author: M }).ok, true);
  const facts = affordancesOf(w.host, { record: w.record, membership: w.membership, actions: w.actions, actionClocks: w.c,
    escalation: SILENT, conformance: SILENT, filings: SILENT, actionHolds: SILENT });
  const offered = () => A.deriveActs(facts.affordanceFacts({ target: CA, viewer: M, identity: M, author: M, by: "alice" }))
    .filter((a) => a.id === "clockadopt").map((a) => a.proposal);
  const pa = w.c.clockPropose({ target: CA, rule: RULE, layer: CITY_A, proposer: M, viewer: M });
  const pb = w.c.clockPropose({ target: CA, rule: RULE, layer: CITY_B, proposer: M, viewer: M });
  assert.equal(pa.ok && pb.ok, true, JSON.stringify([pa, pb]).slice(0, 300));
  assert.deepEqual(offered().sort(), [`${CITY_A}:${RULE}@${M}`, `${CITY_B}:${RULE}@${M}`].sort());
  assert.deepEqual(offered().sort(), w.c.clockProposalsFor({ action: CA, viewer: M }).proposals.map((p) => p.key).sort());
  const [first] = offered().filter((k) => k.startsWith(`${CITY_A}:`));
  assert.equal(w.c.clockAdopt({ target: CA, proposal: first, author: M, viewer: M }).ok, true);
  assert.deepEqual(offered(), [`${CITY_B}:${RULE}@${M}`]);
});

/* ---- credentials:74 ---- */
test("notice credentials:74 (R12 R1): aigrantmint stays credentials' op and accounted; the retired account-reference ops are served by none", () => {
  /* the run credential (R63, R73) is in-plane and no op */
  const creds = keysOf(credentialsOps), accounts = keysOf(aiAccountsOps);
  assert.ok(creds.includes("aigrantmint"));
  assert.equal(published("aigrantmint"), false);
  assert.equal(RUNG_ABSENT.aigrantmint?.ground ?? RUNGS.aigrantmint, "credential");
  assert.deepEqual(A.unaccounted([{ op: "aigrantmint", mutating: true, gated: true }]).unranked, []);
  for (const op of ["airuncredentialmint", "airuncredentialsend"]) assert.equal(creds.includes(op), false, `${op} is in-plane, no op`);
  for (const op of ["accountreferenceset", "accountreferenceremove"])
    assert.ok(!creds.includes(op) && !accounts.includes(op), `${op} is served by no owner`);
});

/* ---- membership:77 ---- */
test("notice membership:77 (R12 R1): adminproposalcancel and adminremovals are answered, accounted for and no act", () => {
  /* registered as declared: the write is ranked and the read a NON_ACT; adminremove keeps its rung */
  const ops = keysOf(membershipOps);
  for (const op of ["adminproposalcancel", "adminremovals"]) {
    assert.ok(ops.includes(op), `membership answers ${op}`);
    assert.equal(published(op), false, `${op} is no act`);
  }
  const r = A.unaccounted([{ op: "adminproposalcancel", mutating: true, gated: true }, { op: "adminremovals", mutating: false, gated: true }]);
  assert.deepEqual([r.unpublished, r.unranked], [[], []]);
  assert.ok(Object.hasOwn(NON_ACTS, "adminremovals"));
  assert.ok(Object.hasOwn(RUNGS, "adminproposalcancel") || Object.hasOwn(RUNG_ABSENT, "adminproposalcancel"));
  assert.equal(RUNGS.adminremove, "reasoned");
});

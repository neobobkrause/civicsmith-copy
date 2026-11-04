/* escalation, provider notice jurisdictions:40 (jurisdictions R119, PR 40): the federal layer puts the government's FOIA
   offices into the combined view's counterparties, each `level: federal`, `elected: false`, with no `oversight` flag.
   R12 and R34 read an office's election and oversight from the view by role and body; this drives them with the real
   federal layer active beside the test profile, at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { combine } from "../../../../jurisdictions/index.mjs";
import { seeded, toStage, V, OFFICE } from "./fixture.mjs";
import { ESCALATION_CHECKS } from "../../../src/escalation/index.mjs";

const PROFILES = ["test-port-ellery", "us-federal"];
const std = ["STD-2026-0001-a"];

test("R12 R34 with the federal layer's FOIA offices in the view (jurisdictions R119): an official_request addressed to a federal office, which the profile marks elected: false, is refused COUNTERPARTY_NOT_ELECTED, by R9 and by attachConditions alike; its oversight, which the profile does not state, is undetermined, so an oversight or audit request lands and the read says so; testimony asks no condition; the test profile's own offices answer as without the federal layer", () => {
  const view = combine(PROFILES);
  assert.equal(view.ok, true);
  const federal = view.view.counterparties.filter((c) => c.level === "federal");
  assert.ok(federal.length > 0, "the federal layer's offices are in the view");
  const fed = federal.find((c) => c.role === "Headquarters" && c.body === "Environmental Protection Agency") || federal[0];
  assert.deepEqual([fed.elected, "oversight" in fed], [false, false]);

  const w = seeded({ profiles: PROFILES });
  toStage(w, 7);
  const act = (office) => w.action({ project: w.P, restsOn: [w.D], counterparty: { state: "named", role: office.role, body: office.body } });
  const attach = (a, purpose) => w.esc.escalationAttach({ id: w.E, action: a, purpose, standards: std, reason: "This act serves the stage.",
    author: V("bob"), viewer: V("bob") });

  /* attachConditions: what R9 would judge for the federal office */
  const a = act(fed);
  const c = w.esc.attachConditions({ id: w.E, action: a, viewer: V("bob") });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300));
  assert.deepEqual([c.purposes.official_request.state, c.purposes.official_request.code, c.purposes.official_request.check,
                    c.purposes.official_request.translation],
    ["refused", "COUNTERPARTY_NOT_ELECTED", "C-116.17", ESCALATION_CHECKS.COUNTERPARTY_NOT_ELECTED.translation]);
  assert.equal(c.purposes.oversight_request.state, "undetermined");
  assert.equal(c.purposes.audit_request.state, "undetermined");
  assert.equal(c.purposes.testimony.state, "none_asked");

  /* R9 agrees: refused for official_request, landing for audit_request with its oversight read undetermined */
  assert.equal(attach(a, "official_request").reason, "COUNTERPARTY_NOT_ELECTED");
  assert.equal(attach(a, "audit_request").ok, true);
  const item = w.esc.escalationRead({ id: w.E, viewer: V("bob") }).actions.find((x) => x.action === a);
  assert.equal(item.oversight.state, "undetermined");
  assert.equal("election" in item, false, "no election note for an audit request");
  assert.equal(attach(act(fed), "testimony").ok, true);

  /* control: the test profile's offices answer as before with the federal layer present */
  assert.equal(attach(act(OFFICE.board), "official_request").ok, true, "an elected office is still admitted");
  assert.equal(attach(act(OFFICE.clerk), "official_request").reason, "COUNTERPARTY_NOT_ELECTED");
  const unlisted = act(OFFICE.unlisted);
  assert.equal(attach(unlisted, "official_request").ok, true, "an office in no layer still lands");
  const u = w.esc.escalationRead({ id: w.E, viewer: V("bob") }).actions.find((x) => x.action === unlisted);
  assert.equal(u.election.state, "undetermined");
});

/* action-clocks' T51 entry at its interface (T51-267): R24, `clocksRunning({viewer})` (`op=clocksrunning`), the pending clock
   entries of the visible open actions counted for Home's clocks reading (N1088, K3189, K4059; for `screens-daily` R64). On
   the test profile; instance clock 2026-09-28T12:00Z. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, CLK } from "./fixture.mjs";
import * as clocks from "../../../src/action-clocks/index.mjs";
import * as actions from "../../../src/actions/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const M = V("alice");
const A = "ACTN-2026-0001-a", B = "ACTN-2026-0002-b", C = "ACTN-2026-0003-c", D = "ACTN-2026-0004-d", X = "ACTN-2026-0005-x";
/* One clock entry's lines, with an owner when given. */
const E = (date, owed = null, status = "pending") => [`  - text: "t"`, '    description: "d"', `    date: ${date}`,
  "    basis: Act s.2", `    status: ${status}`, ...(owed ? [`    owed_by: ${owed}`] : [])];

test("R24 clocksRunning counts the pending clock entries of visible open actions, in all and by owed_by with each one's earliest date; controls: a met entry, a resolved action's pending entry and an action the viewer cannot see are not counted; at most 500 actions are read, truncated stated; writes nothing", () => {
  const w = world();
  w.action(A, ["clock:", ...E("2026-09-10", "group"), ...E("2026-09-12", "group")]);
  w.action(B, ["clock:", ...E("2026-09-05", "body")]);
  w.action(C, ["clock:", ...E("2026-09-20"), ...CLK("2026-09-01", "met")]);
  /* controls: a resolved action's pending entry, and an action no member of the viewer's sees (the `nobody` viewer). */
  w.action(D, ["resolution: complied", "clock:", ...E("2026-09-03", "group")], { state: "resolved" });
  const before = JSON.stringify(w.rows(`SELECT * FROM action_clock_proposals`));
  const r = w.c.clocksRunning({ viewer: M });
  assert.deepEqual(r, {
    ok: true, total: 4, actions_limit: 500, truncated: false,
    by_owed: { group: { count: 2, next: "2026-09-10" }, body: { count: 1, next: "2026-09-05" }, undetermined: { count: 1, next: "2026-09-20" } },
  });
  assert.deepEqual(Object.keys(r.by_owed), ["group", "body", "undetermined"], "each owed_by value R18 names");
  assert.equal(w.c.clocksRunning({ viewer: "nobody" }).total, 0, "an action the viewer cannot see counts for no one");
  assert.equal(w.c.clocksRunning({ viewer: null }).total, 0, "no viewer sees no action");
  /* writes nothing: the documents and the module's tables stand as they were. */
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM action_clock_proposals`)), before);
  assert.equal(w.fm(A).clock[0].status, "pending");
});

test("R24 at most 500 actions are read, and truncated is stated", () => {
  const many = world();
  for (let i = 0; i < 501; i++) {
    const id = `ACTN-2026-${String(i + 1).padStart(4, "0")}-m`;
    many.action(id, ["clock:", ...E("2026-10-01", "body")]);
  }
  const r = many.c.clocksRunning({ viewer: M });
  assert.deepEqual([r.total, r.by_owed.body.count, r.truncated, r.actions_limit], [500, 500, true, 500]);
  assert.equal(clocks.CLOCKS_RUNNING_ACTIONS_MAX, 500);
});

test("R24 the op clocksrunning reads the viewer from the query and answers clocksRunning's own answer", () => {
  const w = world();
  w.action(X, ["clock:", ...E("2026-09-15", "undetermined")]);
  const op = (qs, body = null) => clocks.actionClocksOps(w.c, new URL(`https://x/?${qs}`), body).clocksrunning();
  assert.deepEqual(op(`viewer=${M}`), w.c.clocksRunning({ viewer: M }));
  assert.equal(op(`viewer=${M}`).total, 1);
  assert.equal(op("", { viewer: M }).total, 0, "a viewer in the body is not the stamp");
});

/* R2 (K4227; screens-investigate R59): `NO_SUCH_RULE` also answers the deadlines the profile states for the action's kind. */
const KINDS = (kind) => combine(["test-port-ellery"]).view.deadlines.filter((d) => d.applies_to === kind);
const propose = (w, id, rule) => w.c.clockPropose({ target: id, rule, proposer: M, viewer: M });

test("R2 NO_SUCH_RULE answers deadlines: the profile's deadlines for the action's kind, each rule with its citation, and the rest of the refusal unchanged", () => {
  const w = world();
  w.action(A, ["action_kind: bylaw_complaint"]);
  const no = propose(w, A, "no_such");
  assert.equal(no.reason, "NO_SUCH_RULE");
  assert.deepEqual(no.deadlines, KINDS("bylaw_complaint").map((d) => ({ rule: d.rule, citation: d.citation })));
  assert.equal(no.deadlines.length, 3, "the kind's own deadlines only, not the claim kind's nor another kind's");
  assert.deepEqual([no.ok, no.target, no.rule, Object.keys(no).sort()], [false, A, "no_such", ["deadlines", "detail", "ok", "reason", "rule", "target"]]);
  /* an absent rule is refused at the same place, with the same list. */
  assert.deepEqual(propose(w, A, null).deadlines, no.deadlines);
  /* every rule listed is one clockPropose accepts. */
  for (const d of no.deadlines) assert.equal(propose(w, A, d.rule).ok, true);
});

test("R2 NO_SUCH_RULE answers an empty deadlines list when no deadline applies to the kind or no profile is active; a label the profile states is kept", () => {
  const w = world();
  w.action(B, ["action_kind: recognition_letter"]);
  assert.deepEqual(propose(w, B, "records_answer").deadlines, [], "a kind with no deadline of its own");
  const bare = world({ profiles: null });
  bare.action(C);
  assert.deepEqual(propose(bare, C, "records_answer").deadlines, [], "no active profile");
  /* a deadline the view gives with a label carries it; one without carries none. */
  assert.deepEqual(clocks.deadlinesFor({ deadlines: [{ rule: "a", applies_to: "k", citation: "c", label: "L" }, { rule: "b", applies_to: "k" }, { rule: "z", applies_to: "other", citation: "x" }] }, "k"),
    [{ rule: "a", label: "L", citation: "c" }, { rule: "b" }]);
  assert.deepEqual(clocks.deadlinesFor(null, "k"), []);
});

test("R2 control: a valid rule is unchanged by the deadlines list, the proposal carrying no deadlines field", () => {
  const w = world();
  w.action(D);
  const p = propose(w, D, "records_answer");
  assert.equal(p.ok, true);
  assert.equal("deadlines" in p, false);
  assert.deepEqual(Object.keys(p).sort(), ["evidence", "ok", "proposal", "says", "target", "weight"]);
});

/* C68: the deadlines an action's kind offers come in the order of the office's own level, not the view's */
const LEVELLED = { records_laws: [{ level: "state", name: "State act", citation: "State Code § 7920.000 et seq." }, { level: "federal", name: "Federal act", citation: "Fed. Code § 552" }],
  counterparties: [{ role: "Registrar", body: "State Registry", level: "state" }, { role: "Records Officer", body: "Federal Agency", level: "federal" }],
  deadlines: [{ rule: "state_answer", applies_to: "records_request", citation: "State Code § 7922.535(a)" }, { rule: "local_answer", applies_to: "records_request", citation: "Local Code § 2.20.230" },
    { rule: "federal_answer", applies_to: "records_request", citation: "Fed. Code § 552(a)(6)(A)(i)" }, { rule: "other", applies_to: "other_kind", citation: "Fed. Code § 1" }] };
const to = (o) => ({ action_kind: "records_request", counterparty: { state: "named", kind: "office", ...o } });
const rules = (fm) => clocks.deadlinesFor(LEVELLED, "records_request", fm).map((d) => d.rule);

test("R2 (C68): a request to a federal office lists the federal law's deadline first, the others after in the view's order; control: a state office lists the state's first and the federal last", () => {
  // the level is the office's own as the view lists it, or the one the addressee states
  assert.deepEqual(rules(to({ role: "Records Officer", body: "Federal Agency" })), ["federal_answer", "state_answer", "local_answer"]);
  assert.deepEqual(rules(to({ role: "Anyone", body: "Elsewhere", level: "federal" })), ["federal_answer", "state_answer", "local_answer"]);
  assert.deepEqual(rules(to({ role: "Registrar", body: "State Registry" })), ["state_answer", "local_answer", "federal_answer"]);
  // controls: an office of no known level, an addressee that is no office and no action keep the view's own order, and the list is the same set
  for (const fm of [to({ role: "Unlisted", body: "Nowhere" }), { action_kind: "records_request", counterparty: { state: "undetermined", basis: "x" } }, null])
    assert.deepEqual(rules(fm), ["state_answer", "local_answer", "federal_answer"]);
  assert.equal(clocks.officeLevel(to({ role: "Records Officer", body: "Federal Agency" }), LEVELLED), "federal");
  assert.equal(clocks.officeLevel(null, LEVELLED), null);
  // only the kind's own deadlines, with their citations as before
  assert.deepEqual(clocks.deadlinesFor(LEVELLED, "records_request", to({ role: "Records Officer", body: "Federal Agency" }))[0], { rule: "federal_answer", citation: "Fed. Code § 552(a)(6)(A)(i)" });
});

/* R26 (fix round 3, C53; K4370): `op=remindersfor` reads an action's reminders after a fresh read, through the op. */
test("R26 op=remindersfor answers remindersFor's own answer: a reminder a member set, read through a fresh op map; controls: an invisible and an absent action answer as an absent one, the viewer is the stamp not the body", () => {
  const w = world();
  w.action(A, ["clock:", ...E("2026-12-01", "group")]);
  assert.equal(w.c.reminderSet({ target: A, entry: 0, on: "2026-11-20", author: M, viewer: M }).ok, true);
  const op = (qs, body = null) => clocks.actionClocksOps(w.c, new URL(`https://x/?${qs}`), body).remindersfor();
  const r = op(`viewer=${M}&action=${A}`);
  assert.equal(r.ok, true);
  assert.deepEqual(r.reminders.map((x) => [x.entry, x.on, x.set_by, x.state]), [[0, "2026-11-20", M, "waiting"]]);
  assert.deepEqual(r, w.c.remindersFor({ action: A, viewer: M }), "the service's own answer");
  assert.deepEqual(op(`viewer=${M}`, { action: A }), r, "the action from the body when not in the address");
  assert.deepEqual(op("viewer=nobody&action=" + A), actions.noSuchAction(A), "an invisible action answers as an absent one");
  assert.deepEqual(op(`viewer=${M}&action=${B}`), actions.noSuchAction(B), "an absent action");
  assert.deepEqual(op("", { action: A, viewer: M }), actions.noSuchAction(A), "a viewer in the body is not the stamp");
  assert.equal(JSON.stringify(clocks.DECLARED_OPS.remindersfor.fields), JSON.stringify({ accepts: ["action"], requires: ["action"] }));
  assert.equal(clocks.DECLARED_OPS.remindersfor.mutating, false);
});

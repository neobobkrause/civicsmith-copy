/* actions' reads and services at its interface (R12, R25, R26, R29, R30, R36, R39, R41, R51; R31 retired to `action-clocks`, its held copy gone, N428). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, storage, V, MACHINE, actionMd, CP, NOW_MS } from "./fixture.mjs";
import * as actions from "../../../src/actions/index.mjs";
import { migrateActions } from "../../../src/actions/schema.mjs";
import * as grammar from "../../../src/action-grammar/index.mjs";
import { get as profileOf, combine } from "../../../../jurisdictions/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
const profile = (id) => combine([id]).view;

const A = "ACTN-2026-0001-a";
const M = V("alice");
const CLK = (d, st = "pending") => ['  - text: "t"', '    description: "d"', `    date: ${d}`, "    basis: Act s.2", `    status: ${st}`];

test("R12 actionFacts is pure; null for another type or an unparsable document; overdue on the office's local day, never the UTC day (K1444 (iii))", () => {
  const md = actionMd(A, [...CP, "action_kind: other", "risk_tier: 2", "clock:", ...CLK("2026-09-14"), ...CLK("2026-09-10", "met")]);
  const view = profile("test-port-ellery");                 /* America/Halifax, UTC-3 in September */
  const at = (iso, place = view) => actions.actionFacts(md, Date.parse(iso), place);
  /* 23:30 on the 14th in Halifax is 02:30 UTC on the 15th: still met that day */
  assert.deepEqual(at("2026-09-15T02:30:00Z"), { kind: "other", risk_tier: 2, counterparty_state: "named", resolution: null,
                                                 clock_next: "2026-09-14", clock_overdue: false });
  assert.equal(at("2026-09-15T02:59:59Z").clock_overdue, false, "the last second of the local day");
  assert.equal(at("2026-09-15T03:00:00Z").clock_overdue, true, "the local day after has begun");
  /* negative control: the UTC day would have read it overdue three hours early */
  assert.equal(at("2026-09-15T00:00:00Z").clock_overdue, false);
  assert.equal(at("2026-09-15T00:00:00Z", "UTC").clock_overdue, true, "a zone given as a string is read as the zone");
  /* no zone held: undetermined, never computed on UTC */
  assert.equal(at("2026-09-20T00:00:00Z", null).clock_overdue, null);
  assert.equal(at("2026-09-20T00:00:00Z", { counterparties: [] }).clock_overdue, null);
  assert.equal(actions.actionFacts(actionMd(A, ["action_kind: other"]), NOW_MS).risk_tier, null, "undetermined is null");
  const none = { kind: null, risk_tier: null, counterparty_state: null, resolution: null, clock_next: null, clock_overdue: null };
  assert.deepEqual(actions.actionFacts(md.replace("object_type: action", "object_type: information"), NOW_MS, view), none);
  assert.deepEqual(actions.actionFacts("not a document", NOW_MS, view), none);
  assert.deepEqual(at("2026-09-15T03:00:00Z"), at("2026-09-15T03:00:00Z"), "pure");
  const w = world();
  assert.equal(w.reg.facts.length, 1); assert.equal(w.reg.facts[0].m, "actions", "registered with retrieval R53");
  /* the registered function reads the zone from the active profiles' view */
  assert.equal(w.reg.facts[0].fn(md, Date.parse("2026-09-15T02:30:00Z")).clock_overdue, false);
  assert.equal(w.reg.facts[0].fn(md, Date.parse("2026-09-15T03:00:00Z")).clock_overdue, true);
  assert.equal(world({ profiles: null }).reg.facts[0].fn(md, Date.parse("2026-09-20T00:00:00Z")).clock_overdue, null, "no profile, no zone");
});

test("R12 an entry whose basis says close of business is overdue from the close of the office's hours that day (civil-time R14)", () => {
  const view = profile("test-port-ellery");                 /* the Town Clerk closes at 16:00 Mon-Thu, 12:00 Fri */
  const cob = (d) => ['  - text: "t"', '    description: "d"', `    date: ${d}`, '    basis: "Bylaw 4: by close of business"', "    status: pending"];
  const office = ["counterparty:", "  state: named", "  role: Town Clerk", "  body: City of Port Ellery"];
  const md = (d) => actionMd(A, [...office, "action_kind: other", "clock:", ...cob(d)]);
  const at = (d, iso) => actions.actionFacts(md(d), Date.parse(iso), view).clock_overdue;
  /* Monday 14 September: closes 16:00 local (19:00 UTC); civil-time's minute is overdue once it has passed */
  assert.equal(at("2026-09-14", "2026-09-14T18:59:00Z"), false);
  assert.equal(at("2026-09-14", "2026-09-14T19:01:00Z"), true, "after close, the same day");
  /* Friday 18 September: closes 12:00 local */
  assert.equal(at("2026-09-18", "2026-09-18T15:01:00Z"), true);
  /* negative controls: no hours for the office (another office), or a basis that says no close: the day governs */
  const other = actionMd(A, [...CP, "action_kind: other", "clock:", ...cob("2026-09-14")]);
  assert.equal(actions.actionFacts(other, Date.parse("2026-09-14T19:01:00Z"), view).clock_overdue, false);
  const plain = md("2026-09-14").replace("by close of business", "fourteen days");
  assert.equal(actions.actionFacts(plain, Date.parse("2026-09-14T19:01:00Z"), view).clock_overdue, false);
});

test("R25 R26 the projection block: derived at now beside the cached flag; legs, ledger, laws, proposals, lifecycle, own outcome, responses", () => {
  const w = world();
  w.doc("INFO-2026-0001-d");
  w.action(A, ["risk_tier: 2", "clock:", ...CLK("2026-09-14"), "action_basis:", "  - target: INFO-2026-0001-d", "    kind: rests_on",
    "consequence:", "  claim: impact", '  description: "a hearing"', "  at: 2026-09-20"]);
  w.st.sql.exec(`INSERT INTO refs (bundle_id, target_id, kind) VALUES ('INFO-2026-0001-d', ?, 'responds_to')`, A);
  assert.equal(w.reg.decorations[0].m, "actions", "registered with retrieval R56");
  const d = w.reg.decorations[0].fn({ bundle_id: A, object_type: "action", action_clock_overdue: 0 }, { nowMs: Date.parse("2026-09-20T00:00:00Z") }).action;
  assert.deepEqual([d.kind, d.risk_tier, d.risk_tier_words, d.clock_next, d.clock_overdue, d.clock_overdue_cached, d.as_of],
    ["records_request", 2, word("risk.tier.2"), "2026-09-14", true, false, "2026-09-20T00:00:00.000Z"]);
  assert.equal(d.basis.length, 1); assert.equal(d.correspondence.length, 0);
  assert.equal(d.governing_laws.state, "undetermined"); assert.match(d.governing_laws.stated, /assumes none/);
  assert.ok(d.governing_laws_proposals.says && d.risk_tier_proposals.says);
  assert.equal(d.risk_tier_history.intake.by, null);
  assert.deepEqual(d.responses, ["INFO-2026-0001-d"]);
  assert.ok(!("consequence" in d), "R26: never answered as `consequence`");
  assert.equal(d.own_outcome.state, "established"); assert.deepEqual(d.own_outcome.evidence, ["INFO-2026-0001-d"]);
  assert.doesNotMatch(JSON.stringify(d.own_outcome), /breach/i);
  const B = "ACTN-2026-0002-b";
  w.action(B, ["consequence:", "  claim: impact", '  description: "x"']);
  assert.equal(w.decorate(B).action.own_outcome.state, "unproven");
  assert.equal(w.decorate(B).action.risk_tier, "undetermined", "never defaulted");
  assert.deepEqual(w.reg.decorations[0].fn({ bundle_id: "INFO-2026-0001-d", object_type: "information" }, {}), {});
  assert.equal(w.decorate(A).action.clock_overdue, true, "at the instance clock when the caller names none");
});

test("R29 R36 actionRead answers R25's block and the document's values; absent and invisible alike", () => {
  const w = world();
  w.action(A, ['law: "Act s.1"', "breach: false"]);
  const r = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual([r.ok, r.id, r.current_state, r.law, r.counterparty.role, r.breach], [true, A, "planned", "Act s.1", "Town Clerk", false]);
  for (const k of ["kind", "risk_tier", "clock_next", "clock_overdue", "governing_laws", "lifecycle", "own_outcome", "responses", "legs", "clock"])
    assert.ok(k in r, k);
  w.a.actionMove({ target: A, to: "active", reason: "go", viewer: M, author: M });
  assert.deepEqual(w.a.actionRead({ id: A, viewer: M }).state_history, [{ state: "active", at: "2026-09-28T12:00:00Z", by: M }]);
  /* R106 (T50): absent, invisible and no-action alike answer through R43 (t50.test.mjs holds the full arms) */
  assert.equal(w.a.actionRead({ id: "ACTN-2026-0404-x", viewer: M }).reason, "NO_SUCH_ACTION");
  assert.equal(w.a.actionRead({ id: A, viewer: "nobody" }).reason, "NO_SUCH_ACTION", "invisible answers as absent");
  w.doc("INFO-2026-0001-d");
  assert.equal(w.a.actionRead({ id: "INFO-2026-0001-d", viewer: M }).reason, "NO_SUCH_ACTION");
});

test("R30 actionsFor filters visible actions in id order, at most 200 a page, truncated by reading one past", () => {
  const w = world();
  w.doc("INFO-2026-0001-d");
  for (let i = 1; i <= 203; i++) {
    const id = `ACTN-2026-${String(i).padStart(4, "0")}-z`;
    w.promote(id, actionMd(id, [...CP, `action_kind: ${i % 2 ? "other" : "records_request"}`,
      ...(i === 7 ? ["action_basis:", "  - target: INFO-2026-0001-d", "    kind: rests_on"] : [])]));
  }
  const p1 = w.a.actionsFor({ viewer: M });
  assert.deepEqual([p1.items.length, p1.truncated, p1.limit], [200, true, 200]);
  assert.equal(p1.items[0].id, "ACTN-2026-0001-z");
  const p2 = w.a.actionsFor({ viewer: M, after: p1.cursor });
  assert.deepEqual([p2.items.length, p2.truncated], [3, false]);
  assert.equal(w.a.actionsFor({ viewer: M, kind: "other", limit: 500 }).items.length, 102);
  assert.equal(w.a.actionsFor({ viewer: M, determination: "INFO-2026-0001-d" }).items[0].id, "ACTN-2026-0007-z", "matches R8's legs");
  assert.equal(w.a.actionsFor({ viewer: M, counterparty: "Town Clerk, Town of Port Ellery", limit: 5 }).items.length, 5);
  assert.equal(w.a.actionsFor({ viewer: M, state: "active" }).items.length, 0);
  assert.equal(w.a.actionsFor({ viewer: "nobody" }).items.length, 0, "only visible actions");
});

test("R51 R36 the audit reports C-2.10 and C-11.1 over an action, a missing counterparty and a past pending entry; tables purge with the action", () => {
  const w = world();
  const md = actionMd(A, ["action_kind: other", "clock:", ...CLK("2020-01-01")]);
  const f = w.a.audit({ files: new Map([["bundle.md", md]]) });
  assert.ok(f.some((x) => x.check === "C-2.10" && /counterparty block is missing/.test(x.message)));
  assert.ok(f.some((x) => x.check === "C-11.1" && /past-due/.test(x.message)));
  assert.deepEqual(w.a.audit({ files: new Map([["bundle.md", actionMd(A, [...CP, "action_kind: cpra_request"])]]) }), [], "an old kind reads as written");
  w.action(A, ["action_basis:", "  - target: INFO-2026-0404-q", "    kind: rests_on"].slice(0, 0));
  /* the proposals' tables are action-records' (its R11), created and declared at this module's creation */
  w.a.records.actionLawsPropose({ target: A, laws: [{ level: "city", citation: "B" }], proposer: MACHINE, viewer: MACHINE });
  w.a.records.actionRiskPropose({ target: A, tier: 2, basis: "b", proposer: MACHINE, viewer: MACHINE });
  w.a.actionCorrespond({ target: A, direction: "sent", at: "2026-09-02", account: "x", viewer: M, author: M });
  const r = w.record.purge({ bundleId: A });
  for (const t of actions.ACTIONS_TABLES) assert.ok(t in (r.removed || r.tables || r) || JSON.stringify(r).includes(t), t);
  for (const t of ["action_law_proposals", "action_risk_proposals", "correspondence"])
    assert.equal(w.rows(`SELECT COUNT(*) AS n FROM ${t} WHERE bundle_id=?`, A)[0].n, 0, t);
});

test("R36 every table this module creates is keyed by bundle_id, listed in ACTIONS_TABLES and cleared by the purge", () => {
  const bare = storage();
  migrateActions(bare.sql);
  const made = bare.db.prepare(`SELECT name FROM sqlite_master WHERE type='table'`).all().map((r) => r.name).sort();
  assert.deepEqual(made, [...actions.ACTIONS_TABLES].sort(), "the schema's tables are exactly the list");
  for (const t of made)
    assert.ok(bare.db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === "bundle_id"), `${t} is keyed by bundle_id`);
  const w = world();
  w.action(A);
  const removed = w.record.purge({ bundleId: A }).removed;
  for (const t of made) assert.ok(t in removed, `${t} is declared to the purge`);
});

test("R39 R41 no place is named in outward text; an old records-law kind names no law; tests run on the test profile", () => {
  const oak = profileOf("oakland-alameda");
  const places = ["Oakland", "Alameda", "California", "CPRA", ...oak.covers];
  const outward = JSON.stringify([grammar.ACTION_FENCE_CHECKS, grammar.ACTION_ACT_CHECKS, grammar.GOVERNING_LAW_CHECKS,
    grammar.QUOTE_CHECKS, grammar.LIFECYCLE_CHECKS, grammar.RISK_TIER_REVISION_CHECKS, grammar.RECORDS_LAW_FENCE_CHECKS,
    grammar.ACTION_CATALOGUE_CHECKS, grammar.governingLawsOf({ action_kind: "cpra_request" }), grammar.DUE_UNDETERMINED_SAYS]);
  for (const p of places) assert.ok(!outward.includes(p), p);
  const g = grammar.governingLawsOf({ action_kind: "cpra_request" });
  assert.equal(g.state, "undetermined"); assert.match(g.stated, /named the records law it was made under/);
  assert.equal(profileOf("test-port-ellery").test, true);
});


/* R1, R7, R10: noticeItems at its interface: queue's one read, its homes and options passed in, every producer's bound
   in `facts`, a throwing provider named and the rest answered, nothing written, nothing thrown; no hidden project asked
   about or counted; no place named. The host is money-checks' test world (real record-core and membership), every
   provider a stand-in answering one item in its requirements' shape. */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "../money-checks/fixture.mjs";
import { homeOfHomed } from "../provenance/fixtures.mjs";
import { fresh, reader, byId, texts, sentences, snapshot } from "./fixture.mjs";
import { list as profiles } from "../../../../jurisdictions/index.mjs";
import { NOTICE_KINDS, NOTICE_PROJECTS_MAX, DUTIES_MAX, POLICY_CHANGES_MAX, POLICY_CHANGE_DAYS, SCAN_FINDINGS_MAX, SCAN_FINDINGS_DAYS, TOOL_EVENTS_MAX,
  ACCOUNT_ITEMS_MAX, INVESTIGATION_ITEMS_MAX, WATCHED_ITEMS_MAX, FETCH_DONE_MAX, FETCH_DONE_DAYS, INGEST_NOTICE_MAX, INGEST_NOTICE_DAYS, READING_ENDED_MAX, READING_ENDED_DAYS } from "../../../src/notice-producers/index.mjs";
import { SECURITY_DAYS } from "../../../src/credentials/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const NOW = "2026-10-06T12:00:00Z";
const P = "PROJ-2026-0001-alpha", H = "PROJ-2026-0002-hidden";
const day = (value) => ({ value, precision: "day", zone: "UTC" });

/* One answer of each provider, for any project or member asked. */
function providers(calls = []) {
  return {
    people: { listChecks: () => ({ ok: true, checks: [{ check: "CHK-1", version: 1, condition: { from: { line: "holds" } } }] }),
      checkResults: ({ project }) => { calls.push(["people", project]); return { ok: true, checks: [{ check: "CHK-1", version: 1, name: "a check", gated: false,
        denominator: "a set", results: [{ result_id: `r-${project}`, derivation: { rows: [] }, denominator: { label: "a set", counted: 3 }, at: NOW }], truncated: false }] }; } },
    moneyChecks: { noticed: ({ project }) => { calls.push(["money-checks", project]); return { ok: true, project, truncated: false, items: [{ result_id: `m-${project}`,
      detector_id: "md-1", version: 1, label: "Noticed", detector_label: "a detector", subject: { kind: "pattern" }, numerator: { value: "1" },
      denominator: { value: "2" }, derivation: {}, inputs: [], at: NOW, gate: { gold_set: "g", false_alarm_rate: "0.1" } }] }; } },
    answers: { standingAnswersFor: () => ({ ok: true, cursor: null, entries: [{ question: { id: "STQ-1", question: "q?" }, run: 1, at: NOW,
      finds: { ids: ["x"] }, answer: null, held_back: { condition: "not_deployed" }, withheld: [] }] }) },
    duties: { dutiesOf: ({ entity }) => ({ ok: true, entity, duties: [{ duty_id: "DUT-1", adoption: { by: "member:alice" }, performance: { act: "post it" } }], truncated: false }),
      occurrencesOf: () => ({ ok: true, occurrences: [{ key: "OCC-1", trigger: { kind: "date", ref: "2026-01-01" }, due: { date: day("2026-01-11"), basis_kind: "rule" },
        state: "overdue", why: "passed", evidence: [], question: "Was it done by 2026-01-11?" }] }) },
    inquiry: { datedWaits: ({ member }) => ({ ok: true, member, waits: [{ inquiry: "INQ-1", index: 0, text: "a reply", description: "from the office",
      date: "2026-10-01", set_by: member, set_at: NOW, state: "due" }] }) },
    credentials: { securityLevel: () => ({ level: "High", levelAt: "2026-10-06T11:00:00Z" }),
      securityMap: ({ from, to }) => { const f = Date.parse(from), t = Date.parse(to);
        return { ok: true, from, to, step: "hour", buckets: Array.from({ length: Math.ceil((t - f) / 3600e3) }, (_, i) => {
          const start = new Date(f + i * 3600e3).toISOString().replace(/\.\d+Z$/, "Z");
          const n = start >= "2026-10-06T11:00:00Z" ? 40 : 0;
          return { start, counts: { through: 0, total: n }, usual: { through: 0, total: 0 } }; }) }; }, },
    aiAccounts: { projectAccountsSuspended: () => [{ project: P, member: "alice", since: "2026-10-02T00:00:00Z", key: `${P}|alice|2026-10-02T00:00:00Z` }] },
    following: { policyChanges: () => ({ ok: true, cursor: null, changes: [{ watch: 7, standard: "STD-1", address: "https://example.org/p",
      before: { capture: "a".repeat(64), at: "2026-09-01T00:00:00Z" }, after: { capture: "b".repeat(64), at: "2026-10-01T00:00:00Z" }, amendment_held: false }] }) },
    standards: { standardRead: ({ id }) => ({ ok: true, id, cite: "a policy", declared_by: "member:alice" }) },
    fileSafety: { scanFindings: () => ({ ok: true, truncated: false, cursor: "1", findings: [{ captureSha: "c".repeat(64), note_id: "FSN-1",
      tool: "clamav", engine: "clamav", findings: ["Xls.Downloader.Agent-917"], at: NOW }] }),
      securityToolEvents: () => ({ ok: true, truncated: false, cursor: "2", events: [{ tool_id: "scanii-1", event: "added", at: "2026-10-01T00:00:00Z" },
        { tool_id: "scanii-1", event: "switched_off", at: "2026-10-05T00:00:00Z" }] }),
      securityTools: () => ({ ok: true, tools: [{ tool_id: "scanii-1", provider_id: "scanii", state: "off", off_reason: "PRIVATE_MODE_NOT_HONOURED" }] }) },
    provenance: homeOfHomed({ ["c".repeat(64)]: "INFO-2026-0001-scan" }),
    /* R16 (ai-use R5, R9) and R17 (steps, question-explorer, investigation, review): one entry each, as each answers */
    aiUse: { exploreAsksPending: () => ({ ok: true, asks: [{ key: `explore-ask:project:${P}:2026-10-06`, owner: `project:${P}`, day: "2026-10-06",
        what: ["What did the council vote?"], asked_at: NOW, estimate: word("question-explorer.known") }] }),
      limitsReached: () => ({ ok: true, reached: [{ key: "ai-limit:group:ask:usd:day:2026-10-06", owner: "group", scope: "ask", unit: "usd",
        period: "day", period_start: "2026-10-06", reached_at: NOW }] }) },
    questionExplorer: { findsFor: () => ({ ok: true, truncated: false, finds: [{ key: "explore-find:F1:INQ-1", find: "F1", question: "INQ-1",
      kind: "page", label: "machine", by: "system", says: "FIND-MARK: a page the question led to.", at: NOW }] }) },
    steps: { laterFound: () => ({ ok: true, found: [{ step: "STP-1", look: 1, observation: 2, at: NOW, questions: ["INQ-1"], key: "k-later" }] }),
      stepsDue: () => ({ ok: true, due: [{ step: "STP-1", work: "ask the clerk", kind: "past_date", date: "2026-10-01", key: "k-date" },
        { step: "STP-1", work: "ask the clerk", kind: "reminder", date: "2026-10-06", key: "k-rem" }] }),
      costShares: () => ({ ok: true, shares: [{ step: "STP-2", totals: { USD: "40.00" }, projects: [{ id: P, name: "alpha" }, { id: "PROJ-2026-0009-z", name: "zeta" }], key: "k-share" }] }),
      costMessages: () => ({ ok: true, messages: [{ message: 4, step: "STP-2", text: "shall we split it?", writer: "zed", at: NOW }] }) },
    investigation: { milestonesOverdue: () => ({ ok: true, due: [{ kind: "overdue", milestone: 3, project: P, name: "draft out", date: "2026-10-01", key: "k-ms" },
        { kind: "reminder", milestone: 3, project: P, name: "draft out", date: "2026-10-01", key: "k-msr" }] }),
      quietPrompts: () => ({ ok: true, prompts: [{ project: P, spell: 1, key: "k-quiet", objective: "o", condition: "c", gaps: [], doors: ["watch"] }] }) },
    review: { reviewCommentsLeftOut: () => ({ ok: true, undetermined: 0, truncated: false,
      items: [{ key: `FINDING::review-comment-left-out::CASE-1::1::alice`, case: "CASE-1", edition: 1, project: P, left_out: 2, comments: [1, 2] }] }) },
  };
}
/* membership as the real one answers, with alice an administrator besides (R12's recipient). */
const adminAlice = (m) => ({ participation: (...a) => m.participation(...a), projectOwners: (...a) => m.projectOwners(...a),
  memberFacts: () => ({ status: "active" }), activeAdmins: () => ["alice"] });
function setup(over = {}) {
  const w = world();
  w.project(P, ["alice"]);
  w.project(H, ["bob"]);
  w.st.sql.exec(`CREATE TABLE IF NOT EXISTS duties (duty_id TEXT, obligor TEXT)`);
  w.st.sql.exec(`INSERT INTO duties VALUES ('DUT-1', 'ENT-2026-0001')`);
  const calls = [];
  const n = fresh(w.host, { membership: w.membership, ...providers(calls), ...(typeof over === "function" ? over(w) : over) });
  return { w, n, calls, ...reader(n) };
}

test("R1: every item R2–R6, R12–R17 and R24 derive for this member and viewer, each homed through homesOf and carrying its options; facts state each producer's bound and truncated, R16's and R17's as R13's", () => {
  const { read, asked } = setup((w) => ({ membership: adminAlice(w.membership) }));
  const r = read("alice", { now: NOW });
  const m = byId(r);
  assert.deepEqual(Object.keys(m).sort(), [
    `FINDING::interest-check-noticed::CHK-1::r-${P}`, `FINDING::money-detector-noticed::md-1::m-${P}`,
    "FINDING::standing-answer::STQ-1::1", "FINDING::temporal-expectation-due::DUT-1::OCC-1::overdue",
    "OBLIGATION::inquiry-recheck-due::INQ-1::2026-10-01", "FINDING::security-level-high::2026-10-06T11:00:00Z",
    `FINDING::policy-changed-noticed::7::${"b".repeat(64)}`, `FINDING::scan-found::${"c".repeat(64)}::FSN-1`,
    "FINDING::security-tool-off::scanii-1::2026-10-05T00:00:00Z",
    `FINDING::explore-ask::explore-ask:project:${P}:2026-10-06`, "FINDING::ai-limit-reached::ai-limit:group:ask:usd:day:2026-10-06",
    `FINDING::project-account-suspended::${P}|alice|2026-10-02T00:00:00Z`,
    "FINDING::question-find::explore-find:F1:INQ-1", "FINDING::step-later-found::k-later", "OBLIGATION::step-date-due::k-date",
    "OBLIGATION::step-reminder::k-rem", "FINDING::step-cost-shared::k-share", "FINDING::step-cost-message::4",
    "FINDING::milestone-overdue::k-ms", "OBLIGATION::milestone-reminder::k-msr", "FINDING::project-quiet::k-quiet",
    "FINDING::review-comment-left-out::CASE-1::1::alice"].sort());
  for (const it of r.items) {
    assert.equal(it.class, NOTICE_KINDS[it.kind], it.kind);
    assert.ok(it.case && Array.isArray(it.case.ancestors), "a home set from the walk passed in");
    assert.ok(Array.isArray(it.options));
    assert.equal("disposition" in it, false, "queue's mint gives the disposition");
  }
  assert.deepEqual(asked.homes.filter((s) => s.includes(P)).length >= 2, true, "the walk asked from the projects");
  assert.deepEqual(m["FINDING::temporal-expectation-due::DUT-1::OCC-1::overdue"].options, [{ id: "opt", on: ["DUT-1"] }], "queue's options for the subject");
  assert.deepEqual(r.facts, { projects: { bound: NOTICE_PROJECTS_MAX, truncated: false }, interest_check: { truncated: false },
    money_detector: { truncated: false }, standing_answer: { bound: 1000, truncated: false },
    temporal_expectation: { bound: DUTIES_MAX, truncated: false }, inquiry_recheck: { truncated: false },
    security_level: { days: SECURITY_DAYS, truncated: false }, policy_change: { bound: POLICY_CHANGES_MAX, days: POLICY_CHANGE_DAYS, truncated: false },
    scan_found: { bound: SCAN_FINDINGS_MAX, days: SCAN_FINDINGS_DAYS, truncated: false }, security_tool_off: { bound: TOOL_EVENTS_MAX, truncated: false },
    explore_ask: { bound: ACCOUNT_ITEMS_MAX, truncated: false }, ai_limit: { bound: ACCOUNT_ITEMS_MAX, truncated: false },
    signin_suspended: { bound: ACCOUNT_ITEMS_MAX, truncated: false },
    question_find: { bound: INVESTIGATION_ITEMS_MAX, truncated: false }, step_later_found: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
    step_due: { bound: INVESTIGATION_ITEMS_MAX, truncated: false }, step_cost_shared: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
    step_cost_message: { bound: INVESTIGATION_ITEMS_MAX, truncated: false }, milestone: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
    project_quiet: { bound: INVESTIGATION_ITEMS_MAX, truncated: false }, review_left_out: { bound: INVESTIGATION_ITEMS_MAX, truncated: false },
    watched_changed: { bound: WATCHED_ITEMS_MAX, truncated: false },
    fetch_done: { bound: FETCH_DONE_MAX, days: FETCH_DONE_DAYS, truncated: false },
    ingest: { bound: INGEST_NOTICE_MAX, days: INGEST_NOTICE_DAYS, truncated: false },
    reading_ended: { bound: READING_ENDED_MAX, days: READING_ENDED_DAYS, truncated: false }, failed: [] });
  /* R16's and R17's items each carry the class queue R1 takes for its kind */
  assert.deepEqual(Object.fromEntries(r.items.filter((i) => !/::(interest|money|standing|temporal|inquiry|security|policy|scan)/.test(i.id))
    .map((i) => [i.kind, i.class])), { "explore-ask": "FINDING", "ai-limit-reached": "FINDING", "project-account-suspended": "FINDING",
    "question-find": "FINDING", "step-later-found": "FINDING", "step-date-due": "OBLIGATION", "step-reminder": "OBLIGATION",
    "step-cost-shared": "FINDING", "step-cost-message": "FINDING", "milestone-overdue": "FINDING", "milestone-reminder": "OBLIGATION",
    "project-quiet": "FINDING", "review-comment-left-out": "FINDING" });
});

test("R1: with no walk and no options passed, an item is ungrouped and carries only its own acts", () => {
  const { read } = setup();
  const r = read("alice", { now: NOW, homes: false, options: false });
  for (const it of r.items) assert.equal(it.case.ancestors.filter((a) => a.depth !== 0).length, 0);
  assert.deepEqual(byId(r)["FINDING::temporal-expectation-due::DUT-1::OCC-1::overdue"].options, []);
});

test("R1: writes nothing and never throws; a provider that throws contributes no item and is named in facts.failed, the others still answer", () => {
  const boom = () => { throw new Error("down"); };
  const { w, read } = setup({ people: { checkResults: boom, listChecks: boom }, inquiry: { datedWaits: boom }, following: { policyChanges: boom },
    fileSafety: { scanFindings: boom, securityToolEvents: boom }, aiUse: { exploreAsksPending: boom, limitsReached: () => ({ ok: true, reached: [], unreadable: true }) },
    questionExplorer: { findsFor: boom }, steps: { laterFound: boom, stepsDue: boom, costShares: boom, costMessages: boom },
    investigation: { milestonesOverdue: () => null, quietPrompts: boom }, review: { reviewCommentsLeftOut: () => ({ ok: false }) } });
  const before = snapshot((q) => w.st.sql.exec(q));
  const r = read("alice", { now: NOW });
  assert.deepEqual(snapshot((q) => w.st.sql.exec(q)), before);
  assert.deepEqual(r.facts.failed, ["people", "inquiry", "following", "file-safety", "ai-use", "question-explorer", "steps", "investigation", "review"]);
  assert.deepEqual(r.items.map((i) => i.kind).sort(), ["money-detector-noticed", "project-account-suspended", "standing-answer", "temporal-expectation-due"]);
  /* a provider throwing part-way contributes nothing at all */
  let calls = 0;
  const part = setup({ duties: { dutiesOf: ({ entity }) => ({ ok: true, entity, truncated: false, duties: [{ duty_id: "DUT-1", adoption: { by: "member:alice" } },
    { duty_id: "DUT-2", adoption: { by: "member:alice" } }] }), occurrencesOf: ({ dutyId }) => { if (++calls === 2) throw new Error("x");
    return { ok: true, occurrences: [{ key: `OCC-${dutyId}`, state: "overdue", due: { date: day("2026-01-11") }, evidence: [] }] }; } } });
  const pr = part.read("alice", { now: NOW });
  assert.deepEqual(pr.items.filter((i) => i.kind === "temporal-expectation-due"), []);
  assert.deepEqual(pr.facts.failed, ["duties"]);
  /* malformed arguments: still an answer */
  for (const a of [undefined, {}, { member: 42 }, { member: "alice", viewer: null }, { member: "alice", now: "not a time" }])
    assert.doesNotThrow(() => part.n.noticeItems(a));
  const bad = setup({ membership: { participation: boom } });
  assert.deepEqual(bad.read("alice", { now: NOW }).facts.failed.includes("membership"), true);
});

test("R1: a projects bound of 50 in id order, stated with truncated when a further project qualifies", () => {
  const { w, read, calls } = setup();
  for (let i = 0; i < NOTICE_PROJECTS_MAX; i++) w.project(`PROJ-2026-1${String(i).padStart(3, "0")}-x`, ["alice"]);
  const r = read("alice", { now: NOW });
  assert.deepEqual(r.facts.projects, { bound: NOTICE_PROJECTS_MAX, truncated: true });
  const peopleAsked = calls.filter((a) => a[0] === "people").map((a) => a[1]);
  assert.equal(peopleAsked.length, NOTICE_PROJECTS_MAX);
  assert.deepEqual(peopleAsked, [...peopleAsked].sort());
});

test("R5: at most 500 duties derived a read, the cut stated", () => {
  const many = Array.from({ length: DUTIES_MAX + 1 }, (_, i) => ({ duty_id: `DUT-${i}`, adoption: { by: "member:zed" } }));
  const { read } = setup({ duties: { dutiesOf: ({ entity }) => ({ ok: true, entity, duties: many, truncated: false }), occurrencesOf: () => ({ ok: true, occurrences: [] }) } });
  assert.deepEqual(read("alice", { now: NOW }).facts.temporal_expectation, { bound: DUTIES_MAX, truncated: true });
});

test("R7: no answer names a project the viewer may not see, and no count reveals one: a hidden project is never asked about", () => {
  const { read, calls } = setup();
  const r = read("alice", { now: NOW });
  assert.ok(!calls.some((a) => a[1] === H), "the hidden project is never asked");
  assert.ok(!texts(r).some((t) => t.includes(H)));
  /* bob's project and alice's: bob asks about his own alone */
  calls.length = 0;
  read("bob", { now: NOW });
  assert.deepEqual([...new Set(calls.map((a) => a[1]))], [H]);
  /* facts carry bounds and flags, never a count of what was withheld */
  assert.ok(!texts(r.facts).some((t) => /count|withheld|hidden/.test(t)));
});

test("R10: no place is named in this module's behaviour or outward text", () => {
  const places = profiles().flatMap((p) => p.covers).map((c) => c.replace(/^City of /, "").replace(/ County$/, ""));
  assert.ok(places.length >= 4);
  const { read } = setup();
  const r = read("alice", { now: NOW });
  const words = r.items.flatMap((i) => [...sentences(i), ...texts(i.basis)]).join(" \n ");
  for (const p of places) assert.ok(!words.includes(p), p);
});

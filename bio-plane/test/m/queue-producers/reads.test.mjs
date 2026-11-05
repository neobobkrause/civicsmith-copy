/* R49, R50, R51 (T51's fix round; L13, L12, K4194, K4195, K4210): a feed reads once what it needs; a failed feed names the read and its
   code, and a read that says "told nothing" is not a failure; the feed publishes what it cost. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, NOW, iso, sha, homed, MONITORING } from "./world.mjs";
import { busy, everyKind } from "./every.mjs";
import { readRefusals } from "../contradiction/fixtures.mjs";

const side = (inquiry) => ({ kind: "claim", inquiry });
const ids = (r) => r.items.map((i) => i.id).sort();

/* ------------------------------------------------------------------------------------------------ R51 */

test("R51: facts.ms has whole non-negative milliseconds for each feed read, the one that threw included; a feed named in facts.absent was not read and has none", () => {
  const w = busy();
  const r = w.read("alice");
  const FEEDS = ["bias-debts", "proposals", "shared-inquiries", "leads", "exports", "references", "objectives", "sources", "machinery", "contradictions",
    "signing-keys", "ai-credits-stop", "retesting-off", "action", "attribution", "docket", "cited-cases", "wizards", "schedule", "places", "projects", "members"];
  assert.deepEqual(Object.keys(r.facts.ms).sort(), [...FEEDS].sort(), "every feed this world reads");
  for (const [feed, v] of Object.entries(r.facts.ms)) assert.ok(Number.isInteger(v) && v >= 0, `${feed}: ${v}`);
  /* a feed that threw is timed too */
  const t = busy({ monitoring: { flagged: () => { throw new Error("no"); }, monitoring: () => MONITORING.empty.monitoring,
                                 archiveEligible: () => MONITORING.empty.archiveEligible } });
  const rt = t.read("alice");
  assert.ok(rt.facts.failed.some((f) => f.feed === "sources"));
  assert.ok(Number.isInteger(rt.facts.ms.sources) && rt.facts.ms.sources >= 0, "the feed that threw has its milliseconds");
  /* a feed with no provider composed is not read */
  const a = world(); a.member("ada", { role: "admin" });
  const ra = a.read("ada");
  assert.deepEqual(ra.facts.absent, ["places"]);
  assert.ok(!("places" in ra.facts.ms), "absent: not read, no milliseconds");
  assert.ok("members" in ra.facts.ms);
});

test("R51 (control): with every provider answering, failed is [] and the items are R8's as before; ms is added and no other fact changes", () => {
  const w = world(); w.member("alice");
  const r = w.read("alice");
  assert.deepEqual(r.facts.failed, []);
  assert.deepEqual(Object.keys(r.facts).sort(), ["absent", "action", "contradiction", "dispositions", "failed", "ms", "objective_gap", "unattributed"]);
  assert.deepEqual(r.items, []);
});

/* ------------------------------------------------------------------------------------------------ R50 */

const FOUR = [
  ["contradiction.candidatesFor", (w, how) => { w.fakes.contradiction.candidatesFor = how; }],
  ["reevaluation.correctedDependents", (w, how) => { w.fakes.reevaluation.correctedDependents = how; }],
  ["case-tensions.caseTensions", (w, how) => { w.fakes.caseTensions.caseTensions = how; }],
  ["contradiction.conflictNotices", (w, how) => { w.fakes.contradiction.conflictNotices = how; }],
];
const CONTRADICTION_KINDS = ["contradiction-duty", "contradiction-lead", "contradiction-plurality", "contradiction-duty-unseen",
  "contradiction-plurality-unseen", "side-corrected", "tension-after-publication"];

test("R50: each of the contradictions feed's four reads refusing in turn names itself and its code in facts.failed, and no other feed is lost", () => {
  const base = everyKind().read("alice");
  assert.ok(base.items.some((i) => CONTRADICTION_KINDS.includes(i.kind)), "the fixture makes the feed speak");
  for (const [read, set] of FOUR) {
    const w = everyKind();
    set(w, () => ({ ok: false, reason: "SOMETHING", code: "SOME_REFUSAL", detail: "x" }));
    const r = w.read("alice");
    assert.deepEqual(r.facts.failed.filter((f) => f.feed === "contradictions"), [{ feed: "contradictions", reason: "refused", read, code: "SOME_REFUSAL" }], read);
    assert.ok(!r.items.some((i) => CONTRADICTION_KINDS.includes(i.kind)), `${read}: the feed contributes no item`);
    assert.deepEqual(ids(r), ids(base).filter((id) => !base.items.find((i) => i.id === id && CONTRADICTION_KINDS.includes(i.kind))), `${read}: every other feed's items stand`);
    /* a read that threw is named by its read alone, and one that answered undetermined by its read */
    const t = everyKind();
    set(t, () => { throw new Error("boom"); });
    assert.deepEqual(t.read("alice").facts.failed.filter((f) => f.feed === "contradictions"), [{ feed: "contradictions", reason: "threw", read }], `${read}: threw`);
    const u = everyKind();
    set(u, () => ({ ok: true, state: "undetermined" }));
    assert.deepEqual(u.read("alice").facts.failed.filter((f) => f.feed === "contradictions"), [{ feed: "contradictions", reason: "undetermined", read }], `${read}: undetermined`);
  }
});

test("R50: with no candidate index (nothing makes candidates, the assistant being held) and projects present, the feed answers no item and failed is []", () => {
  const w = world({
    contradiction: { candidatesFor: () => ({ ok: true, wrote: false, candidates: [], truncated: false, undetermined: true, empty: { level: "undetermined" } }),
                     conflictNotices: () => ({ ok: true, wrote: false, notices: [], truncated: false, undetermined: true, why: "no index" }) },
    caseTensions: { caseTensions: () => ({ ok: true, wrote: false, cases: [], cursor: null, undetermined: true, why: "no provider" }) } });
  w.member("alice"); w.bundle("PRJ-1", "project"); w.bundle("PRJ-2", "project");
  w.join("PRJ-1", "alice", { owner: true }); w.join("PRJ-2", "alice");
  const r = w.read("alice");
  assert.deepEqual(r.items.filter((i) => CONTRADICTION_KINDS.includes(i.kind)), []);
  assert.deepEqual(r.facts.failed, []);
  assert.deepEqual(r.facts.contradiction, { bound: 50, truncated: false });
});

test("R50, R7: a project contradiction.conflictNotices tells this viewer nothing about (NOT_A_PARTICIPANT, NO_SUCH_PROJECT) has no notice for her and is no failure; another refusal still names the feed", () => {
  const real = readRefusals();
  for (const [name, refusal] of [["notAParticipant", real.notAParticipant], ["unknownProject", real.unknownProject]]) {
    const code = refusal.code;
    const w = everyKind();
    w.fakes.contradiction.conflictNotices = ({ project }) => (project === "PRJ-A"
      ? refusal
      : { ok: true, truncated: false, cursor: null, notices: [] });
    const r = w.read("alice");
    assert.deepEqual(r.facts.failed.filter((f) => f.feed === "contradictions"), [], `${name} (${code})`);
    assert.ok(!r.items.some((i) => /-unseen$/.test(i.kind)), `${code}: no notice`);
    assert.ok(r.items.some((i) => i.kind === "contradiction-duty"), `${code}: the feed's other reads still answer`);
  }
  const w = everyKind();
  // fixtures-generic: OTHER (a code no refusal of conflictNotices gives: the control that a refusal this module does not know is a failure)
  w.fakes.contradiction.conflictNotices = () => ({ ok: false, reason: "OTHER", code: "OTHER", detail: "x" });
  assert.deepEqual(w.read("alice").facts.failed.filter((f) => f.feed === "contradictions"),
    [{ feed: "contradictions", reason: "refused", read: "contradiction.conflictNotices", code: "OTHER" }], "control: another code is a failure");
});

/* ------------------------------------------------------------------------------------------------ R49 */

/* N projects the member has joined and owns, and M items in each of four feeds that name them: M contradiction candidates (each reaching all N
   projects, over four inquiries), M corrected dependents (over the same four), M flagged documents (half with no title, half captured on
   a day), N published cases with tensions. The providers that take one project at a time are counted; the module's own statements are those
   the world's storage saw. */
function scaled(N, M) {
  const counts = { candidates: 0, notices: 0, tensions: 0, gaps: 0 };
  const projects = Array.from({ length: N }, (_, i) => `PRJ-${String(i + 1).padStart(3, "0")}`);
  const cand = (j) => ({ candidate: `cc-${String(j).padStart(3, "0")}`, weight: "duty", state: "open", a: side(`INQ-${j % 4}`), b: side("INQ-X"),
    between_projects: [], machine: { at: iso(NOW - 1000 - j) } });
  const w = world({
    contradiction: { candidatesFor: () => { counts.candidates += 1; return { ok: true, truncated: false, cursor: null, candidates: Array.from({ length: M }, (_, j) => cand(j)) }; },
                     conflictNotices: () => { counts.notices += 1; return { ok: true, truncated: false, cursor: null, notices: [] }; } },
    reevaluation: { correctedDependents: () => ({ ok: true, truncated: false, cursor: null,
      entries: Array.from({ length: M }, (_, j) => ({ dependent: `INQ-${j % 4}`, candidate: `cc-${String(j).padStart(3, "0")}`, reason: "named wrong", since: iso(NOW - 5) })) }) },
    caseTensions: { caseTensions: ({ project }) => { counts.tensions += 1; return { ok: true, cursor: null, cases: [{ case: `CASE-${project}`, edition: 1, project,
      tensions: [{ candidate: "cc-000", member: "INQ-0", state: "open", depth: 1 }, { candidate: "cc-000", member: "INQ-1", state: "open", depth: 1 }] }] }; } },
    monitoring: { monitoring: () => MONITORING.empty.monitoring,
                  archiveEligible: () => MONITORING.empty.archiveEligible,
                  flagged: () => ({ ok: true, limit: 200, truncated: false, items: Array.from({ length: M }, (_, j) => ({ bundleId: `DOC-${String(j).padStart(3, "0")}`, source_status: "modified", since: iso(NOW - 9) })) }) },
    intent: { gaps: () => { counts.gaps += 1; return { ok: true, gaps: [] }; } },
    /* machinery-producers' own reads (its R1) are its module's, answered here by a fake that raises nothing */
    machinery: { conditionItems: () => ({ items: [], facts: {} }) },
    projectRoster: { projectList: () => ({ ok: true, projects: [] }), projectInvitations: () => ({ ok: true, invitations: [] }),
                     projectParticipants: () => ({ ok: true, participants: [] }), projectRequests: () => ({ ok: true, requests: [] }),
                     projectOwnerVotes: () => ({ ok: true, changes: [] }) },
  });
  w.member("alice");
  for (let i = 0; i < 4; i++) w.bundle(`INQ-${i}`, "inquiry");
  w.bundle("INQ-X", "inquiry");
  for (const p of projects) { w.bundle(p, "project"); w.join(p, "alice", { owner: true }); w.cite(p, "INQ-0"); }
  for (let j = 0; j < M; j++) {
    const id = `DOC-${String(j).padStart(3, "0")}`;
    w.bundle(id, "information", { title: j % 2 === 0 ? `Document ${j}` : null });
    if (j % 2 === 1) {
      w.run(`INSERT INTO register (capture_sha, bundle_id, path, encoding, registered, bytes, authored, author) VALUES (?,?,?,?,?,1,0,NULL)`, `sha${j}`, id, "p", "utf8", iso(NOW));
      w.run(`INSERT INTO captured_locators (address_norm, address, capture_sha, first_retrieved, last_retrieved) VALUES (?,?,?,?,?)`, `a${j}`, `https://x.example/${j}`, `sha${j}`, "2026-08-10T10:00:00Z", "2026-08-11T10:00:00Z");
    }
  }
  return { w, counts, projects };
}

/** What this module asked: the statements its storage saw, and the walks and options it asked queue for. */
function measure(N, M) {
  const { w, counts } = scaled(N, M);
  w.read("alice");                                  // warm: migrations, schemas
  for (const k of Object.keys(counts)) counts[k] = 0;
  const before = { s: w.statements.length, h: w.asked.homes.length, o: w.asked.options.length };
  const r = w.read("alice");
  return { r, counts, statements: w.statements.length - before.s, homes: w.asked.homes.slice(before.h), options: w.asked.options.slice(before.o), w };
}

test("R49: the module's own statements do not grow with the number of items or of projects, homes and options are asked once for each distinct subject set, and each project-keyed provider read is made once for each project", () => {
  const small = measure(2, 4), large = measure(8, 32);
  for (const [name, m, N, M] of [["small", small, 2, 4], ["large", large, 8, 32]]) {
    const kinds = (k) => m.r.items.filter((i) => i.kind === k).length;
    assert.equal(kinds("contradiction-duty"), M, `${name}: one item per candidate, however many projects it reaches`);
    assert.equal(kinds("side-corrected"), M);
    assert.equal(kinds("source-modified"), M);
    assert.equal(kinds("tension-after-publication"), N);
    assert.deepEqual(m.r.facts.failed, [], name);
    /* the providers that take one project: once for each project (one page each), never again for an item */
    assert.deepEqual(m.counts, { candidates: N, notices: N, tensions: N, gaps: N }, `${name}: one read of each for each project`);
    /* homes: one walk for each distinct set of subjects, never twice for the same one */
    const walked = m.homes.map((h) => JSON.stringify(h));
    assert.equal(new Set(walked).size, walked.length, `${name}: no subject set walked twice`);
    const sets = new Set(m.r.items.map((i) => JSON.stringify(i.case.of)));
    assert.equal(walked.length, sets.size, `${name}: one walk for each distinct subject set the items have`);
    const asked = m.options.map((o) => JSON.stringify(o));
    assert.equal(new Set(asked).size, asked.length, `${name}: no option set derived twice`);
  }
  assert.equal(large.statements, small.statements,
    `the statements this module made did not grow with 4x the projects and 8x the items: ${small.statements} at 2 projects and 4 items, ${large.statements} at 8 and 32`);
});

test("R49 (control): the items and their order are the same as before the change: the answer at the small size", () => {
  const { r } = measure(2, 4);
  const shape = r.items.map((i) => [i.id, i.case.ancestors.map((a) => `${a.id}@${a.depth}`), i.options.map((o) => o.on.join("+"))]);
  assert.deepEqual(shape, SMALL_SHAPE);
});

test("R49 (control): items that share their subjects are homed once, and an item with other subjects is homed again", () => {
  const { w } = scaled(1, 8);                       // eight candidates over four inquiries: four subject sets, not eight
  const before = w.asked.homes.length;
  const r = w.read("alice");
  const candidateSets = new Set(r.items.filter((i) => i.kind === "contradiction-duty").map((i) => JSON.stringify(i.case.of)));
  assert.equal(candidateSets.size, 4);
  const walks = w.asked.homes.slice(before).map((h) => JSON.stringify(h));
  for (const s of candidateSets) assert.equal(walks.filter((x) => x === s).length, 1, `${s} walked once`);
  w.fakes.contradiction.candidatesFor = () => ({ ok: true, truncated: false, cursor: null, candidates: [
    { candidate: "zz-1", weight: "duty", state: "open", a: side("INQ-1"), b: side("INQ-X"), between_projects: [], machine: { at: iso(NOW) } },
    { candidate: "zz-2", weight: "duty", state: "open", a: side("INQ-2"), b: side("INQ-X"), between_projects: [], machine: { at: iso(NOW) } }] });
  const again = w.asked.homes.length;
  w.read("alice");
  const added = w.asked.homes.slice(again).map((h) => JSON.stringify(h));
  assert.equal(added.filter((x) => x === JSON.stringify(["INQ-1", "INQ-X"])).length, 1);
  assert.equal(added.filter((x) => x === JSON.stringify(["INQ-2", "INQ-X"])).length, 1, "another set is walked for itself");
});

test("R49: the proposals feed reads the bundles behind its instances once for all of them: the statements do not grow with the number of proposals", () => {
  const run = (K) => {
    const proposals = Array.from({ length: K }, (_, j) => ({ key: `p::s${j}`, progression_key: "p", progression_label: "P", stage_key: `s${j}`, stage_label: `S${j}`,
      required: "always", definition_version: 1, n: 1, kinds: ["missing_predecessor"], grade: null, grade_determined: false, overdue: false, overdue_count: 0,
      surfaced_by: "machine", prior_disposition: null, instances: [{ progression_key: "p", entity_id: `E${j}` }] }));
    const w = world({ progressions: { proposalsFeed: () => ({ instances: [], dispositions: [], proposals }) } });
    w.member("alice");
    for (let j = 0; j < K; j++) { w.bundle(`DOC-${j}`); w.run(`INSERT INTO progression_instances VALUES ('p', ?, ?, ?, ?)`, `E${j}`, `s${j}`, `c${j}`, `DOC-${j}`); }
    w.read("alice");
    const before = w.statements.length;
    const r = w.read("alice");
    return { r, statements: w.statements.length - before };
  };
  const small = run(2), large = run(20);
  assert.equal(small.r.items.filter((i) => i.kind === "missing_predecessor").length, 2);
  assert.equal(large.r.items.filter((i) => i.kind === "missing_predecessor").length, 20);
  assert.deepEqual(small.r.items[0].subject.bundles, ["DOC-0"]);
  assert.equal(large.statements, small.statements, `${small.statements} statements at 2 proposals, ${large.statements} at 20`);
});

test("R49: the leads read where their captures are registered and what points at those bundles once for all of them: the statements do not grow with the number of leads, and each lead's basis entry is its own", () => {
  const run = (K) => {
    const requests = Array.from({ length: K }, (_, j) => ({ request: `CR-${j}`, run: "r", target: "INQ-A", lead_inquiry: "INQ-S", address: `https://x.example/${j}`,
      host: "x.example", purpose: "investigate", ua_mode: "civicos", capture_sha: sha(`sha${j}`), captured_at: iso(NOW), attribution: { ok: true, statement: "s" } }));
    const w = world({ captureRequests: { leads: () => ({ requests }) }, provenance: homed(Object.fromEntries(requests.map((q, j) => [q.capture_sha, `DOC-${j}`]))) });
    w.member("alice"); w.bundle("INQ-S", "inquiry"); w.bundle("INQ-A", "inquiry");
    for (let j = 0; j < K; j++) w.bundle(`DOC-${j}`);
    w.leg("INQ-S", "DOC-1");                                       // only the second document is part of a case
    w.read("alice");
    const before = w.statements.length;
    const r = w.read("alice");
    return { r, statements: w.statements.length - before };
  };
  const small = run(3), large = run(24);
  const entry = (r, j) => r.items.find((i) => i.id === `FINDING::out-of-inquiry-lead::CR-${j}`).basis.basis_entry;
  assert.deepEqual([entry(small.r, 0).state, entry(small.r, 0).basis_legs, entry(small.r, 0).bundle_id], ["absent", 0, "DOC-0"]);
  assert.deepEqual([entry(small.r, 1).state, entry(small.r, 1).basis_legs, entry(small.r, 1).bundle_state], ["present", 1, "collected"]);
  assert.equal(large.r.items.filter((i) => i.kind === "out-of-inquiry-lead").length, 24);
  assert.equal(large.statements, small.statements, `${small.statements} statements at 3 leads, ${large.statements} at 24`);
});

/* The small fixture's answer as the code produced it before the change (R49's control). */
const SMALL_SHAPE = [
  ["FINDING::source-modified::DOC-000", [], ["DOC-000"]],
  ["FINDING::source-modified::DOC-001", [], ["DOC-001"]],
  ["FINDING::source-modified::DOC-002", [], ["DOC-002"]],
  ["FINDING::source-modified::DOC-003", [], ["DOC-003"]],
  ["OBLIGATION::contradiction::cc-000", ["INQ-0@0", "INQ-X@0", "PRJ-001@1", "PRJ-002@1"], ["INQ-0+INQ-X"]],
  ["OBLIGATION::contradiction::cc-001", ["INQ-1@0", "INQ-X@0"], ["INQ-1+INQ-X"]],
  ["OBLIGATION::contradiction::cc-002", ["INQ-2@0", "INQ-X@0"], ["INQ-2+INQ-X"]],
  ["OBLIGATION::contradiction::cc-003", ["INQ-3@0", "INQ-X@0"], ["INQ-3+INQ-X"]],
  ["FINDING::side-corrected::INQ-0::cc-000", ["INQ-0@0", "PRJ-001@1", "PRJ-002@1"], ["INQ-0"]],
  ["FINDING::side-corrected::INQ-1::cc-001", ["INQ-1@0"], ["INQ-1"]],
  ["FINDING::side-corrected::INQ-2::cc-002", ["INQ-2@0"], ["INQ-2"]],
  ["FINDING::side-corrected::INQ-3::cc-003", ["INQ-3@0"], ["INQ-3"]],
  ["FINDING::tension-after-publication::CASE-PRJ-001::cc-000", ["PRJ-001@0"], ["INQ-0+INQ-1"]],
  ["FINDING::tension-after-publication::CASE-PRJ-002::cc-000", ["PRJ-002@0"], ["INQ-0+INQ-1"]]
];

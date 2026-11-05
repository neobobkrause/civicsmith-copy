/* run-productions: the narrow candidate source (R14), the checks it carries (R16), its tables and their purge (R17),
   no place in its outward text (R19), and the factory. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as RP from "../../../src/run-productions/index.mjs";
import { world, Q, Q2, DOC, DOC2, RUN, ALICE, BOB, MACHINE } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const AK = "class:ai/k1";
const CHAIN = [{ step: "pixels", extent: { kind: "pages", pages: [0, 1, 2] } },
               { step: "ocr", engine: "tesseract", version: "5.3.4", cap: "C", confidence: { basis: "none" },
                 extent: { kind: "pages", pages: [0, 1, 2] } }];

function extractWorld(mints = 20) {
  const w = world();
  w.inquiry(Q); w.inquiry(Q2);
  w.run(RUN);
  const cap = w.doc(DOC);
  w.ex.readings[cap] = { chain: CHAIN, pageCount: 3 };
  w.run("RUN-E", { mode: "extract", principal_plane: AK, mints });
  const propose = (refs, at) => w.p.extractPropose({ run: "RUN-E", bundleId: DOC, fn: "propose-reading", version: "0.1.0",
                                                     refs, proposedBy: AK, viewer: ALICE, caller: AK, at });
  return { w, cap, propose };
}

test("R14: for a capture, the proposals with a position, newest first, at most the count asked, read one past it for truncated, each {run, ref, label, position, content_id, proposed_by, mint label}", () => {
  const { w, cap, propose } = extractWorld();
  propose([{ ref: "ordinance:1", refKind: "ordinance", refKey: "1", source: { kind: "pdf-page", page: 0, ref: "page 1" } }], "2026-09-28T01:00:00Z");
  propose([{ ref: "ordinance:2", refKind: "ordinance", refKey: "2", source: { kind: "pdf-page", page: 1, ref: "page 2" } }], "2026-09-28T02:00:00Z");
  propose([{ ref: "a name", label: "The Clerk" }], "2026-09-28T03:00:00Z");
  const two = w.p.candidates({ captureSha: cap, max: 5 });
  assert.equal(two.truncated, false);
  assert.deepEqual(two.rows.map((r) => r.ref), ["ordinance:2", "ordinance:1"], "positioned only, newest first");
  const [r] = two.rows;
  assert.deepEqual(Object.keys(r).sort(), ["content_id", "label", "mint", "position", "proposed_by", "ref", "run"]);
  assert.deepEqual([r.run, r.proposed_by, r.position.kind, r.position.page, r.mint.machine_work], ["RUN-E", AK, "pdf-page", 1, true]);
  assert.match(r.content_id, /^[0-9a-f]{64}$/);
  const one = w.p.candidates({ captureSha: cap, max: 1 });
  assert.deepEqual([one.rows.length, one.truncated], [1, true]);
  assert.deepEqual(w.p.candidates({ captureSha: "0".repeat(64), max: 5 }), { truncated: false, rows: [] });
});

test("R14: the source is registered with basis-versions' onCandidates (its R40) when basis-versions offers it", () => {
  const { w } = extractWorld();
  assert.deepEqual(w.candidateSources.map((s) => s.module), ["run-productions"]);
  const fn = w.candidateSources[0].fn;
  assert.deepEqual(fn({ captureSha: "0".repeat(64), max: 3 }), { truncated: false, rows: [] });
});

test("R16: C-27.1–C-27.14, C-27.16–C-27.19 and C-104.1–C-104.31 are this module's own rows, each with a translation and a `where` naming the region of this module's op that mints it; C-27.15 is not among them; SUGGEST_LEVELS is defined here; each row is minted by this module with its row (R21–R24's among them)", () => {
  /* C-27 less C-27.15 (basis-versions' document-gate row, VERSION_KIND_UNKNOWN): nineteen rows (C-27.20 since T53). */
  const SUGGEST_REGIONS = { SUGGEST_NO_TARGET: ["C-27.1", "is-suggest-shape"], SUGGEST_NOT_AN_INQUIRY: ["C-27.2", "is-suggest-shape"],
    SUGGEST_UNKNOWN_KIND: ["C-27.3", "is-suggest-shape"], SUGGEST_NO_RUN: ["C-27.4", "is-suggest-shape"],
    SUGGEST_NAME_TAKEN: ["C-27.5", "is-suggest-shape"], SUGGEST_EMPTY_LEVEL_UNSTATED: ["C-27.6", "is-suggest-shape"],
    SUGGEST_TOO_MANY_LEGS: ["C-27.7", "is-suggest-shape"], SUGGEST_LEG_UNREACHABLE: ["C-27.8", "is-suggest-checks"],
    SUGGEST_PAIR_DOES_NOT_COMPUTE: ["C-27.9", "is-suggest-checks"], SUGGEST_NOT_DIFFERENT: ["C-27.10", "is-suggest-checks"],
    SUGGEST_BRANCHES_NOT_INDEPENDENT: ["C-27.11", "is-suggest-checks"], SUGGEST_BOILERPLATE: ["C-27.12", "is-suggest-checks"],
    SUGGEST_UNWRITABLE_STATE: ["C-27.13", "is-suggest-checks"], SUGGEST_UNWRITABLE_DOCUMENT: ["C-27.14", "is-suggest-write"],
    SUGGEST_COMPARISON_INCOMPLETE: ["C-27.16", "is-suggest-checks"], SUGGEST_NO_DOCUMENT: ["C-27.17", "is-suggest-shape"],
    SUGGEST_RUN_NOT_RUNNING: ["C-27.18", "is-suggest-shape"], SUGGEST_OUTSIDE_RUN_CONTEXT: ["C-27.19", "is-suggest-shape"],
    /* T53 (R29): a malformed produced_by, the family's next number. */
    SUGGEST_PRODUCED_BY_MALFORMED: ["C-27.20", "is-suggest-shape"] };
  assert.deepEqual([...RP.SUGGEST_CHECK_KEYS].sort(), Object.keys(SUGGEST_REGIONS).sort());
  assert.deepEqual(Object.keys(RP.SUGGEST_CHECKS).sort(), Object.keys(SUGGEST_REGIONS).sort());
  for (const [k, [check, region]] of Object.entries(SUGGEST_REGIONS)) {
    const r = RP.SUGGEST_CHECKS[k];
    assert.deepEqual([r.check, r.where], [check, `src/run-productions/index.mjs suggest > ${region}`], k);
    assert.ok(typeof r.translation === "string" && r.translation.length > 40, k);
  }
  assert.equal(Object.values(RP.SUGGEST_CHECKS).some((r) => r.check === "C-27.15"), false, "C-27.15 is basis-versions'");
  assert.ok(Object.isFrozen(RP.SUGGEST_CHECKS) && Object.isFrozen(RP.EXTRACT_PROPOSE_CHECKS));
  /* C-104 is this module's own family: exactly thirty-two rows, numbered C-104.1 to C-104.32 (T41-24 added .13–.31,
     T42-18 .32, R25). */
  assert.deepEqual(Object.keys(RP.EXTRACT_PROPOSE_CHECKS).map((k) => RP.EXTRACT_PROPOSE_CHECKS[k].check),
                   Array.from({ length: 32 }, (_, i) => `C-104.${i + 1}`));
  assert.deepEqual([...RP.EXTRACT_PROPOSE_CHECK_KEYS], Object.keys(RP.EXTRACT_PROPOSE_CHECKS));
  /* Each code's one site: the run's and the document's codes in the one helper every production asks. */
  const REGIONS = { NO_PROPOSER: "extractPropose > is-extract-run", NO_RUN: "productionRun > is-production-run",
    NO_SUCH_RUN: "productionRun > is-production-run", RUN_NOT_RUNNING: "productionRun > is-production-live",
    NOT_AN_EXTRACT_RUN: "extractPropose > is-extract-door", NO_MINTS_BOUND: "extractPropose > is-extract-door",
    MINTS_BOUND_REACHED: "extractPropose > is-extract-door", NO_PROPOSALS: "extractPropose > is-extract-door",
    NOT_A_DOCUMENT: "heldDocument > is-held-document", NO_BYTES_HELD: "heldDocument > is-held-document",
    MINTS_BOUND_WOULD_EXCEED: "extractPropose > is-extract-whole-batch", EXTRACT_NO_SCOPE: "extractProposals > is-extract-scope",
    NOT_A_READING_RUN: "readPages > is-read-run", NO_PAGES_BOUND: "readPages > is-read-door",
    PAGES_BOUND_REACHED: "readPages > is-read-door", CONNECTION_GRADE_OFFERED: "extractPropose > is-extract-connection",
    CONNECTION_NO_TARGET: "extractPropose > is-extract-connection", CONNECTION_NO_QUOTE: "extractPropose > is-extract-connection",
    CONNECTION_PERSON_NO_ROLE: "extractPropose > is-extract-connection",
    CONNECTION_NOT_ESTABLISHED: "extractPropose > is-extract-connection", STEP_UNREADABLE: "extractPropose > is-extract-step",
    READING_PROPOSAL_ABSENT: "proposalAccept > is-accept", ACCEPT_NOT_A_MEMBER: "proposalAccept > is-accept",
    ACCEPT_FORM_UNKNOWN: "proposalAccept > is-accept", ACCEPT_NEEDS_HER_WORDS: "proposalAccept > is-accept",
    ACCEPT_AS_PROPOSED_TAKES_NO_WORDS: "proposalAccept > is-accept", PROPOSAL_ALREADY_ACCEPTED: "proposalAccept > is-accept",
    BEARING_NO_QUESTION: "bearingNote > is-bearing", BEARING_NO_CAPTURE: "bearingNote > is-bearing",
    BEARING_NO_SENTENCES: "bearingNote > is-bearing", BEARING_NOTHING_TIED: "bearingNote > is-bearing",
    PROPOSAL_NOT_TAKEN_UP: "machinePassage > is-machine-passage" };
  assert.deepEqual(Object.keys(RP.EXTRACT_PROPOSE_CHECKS).sort(), Object.keys(REGIONS).sort());
  for (const [k, region] of Object.entries(REGIONS)) {
    const r = RP.EXTRACT_PROPOSE_CHECKS[k];
    assert.equal(r.where, `src/run-productions/index.mjs ${region}`, k);
    assert.ok(typeof r.translation === "string" && r.translation.length > 40, k);
  }
  assert.ok(Object.isFrozen(RP.SUGGEST_LEVELS));
  /* Drive every code once, and collect what the module minted. */
  const driven = new Map();
  const see = (r) => { if (r && r.ok === false && r.code) driven.set(r.code, r); return r; };
  const { w, propose } = extractWorld();
  w.inquiry(Q2, [{ name: "held" }]);
  w.st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                 VALUES ('INQ-2026-0003-nofile', 'inquiry', 'g', 't', 'open', 't', 't', 'sha')`);
  w.run("RUN-Q2", { context_id: Q2 }); w.run("RUN-NF", { context_id: "INQ-2026-0003-nofile" });
  w.run("RUN-END", { status: "completed" });
  const S = (o) => see(w.suggest(o));
  S({ target: "" }); S({ target: DOC }); S({ kind: "x" }); S({ run: "none" }); S({ run: "RUN-END" }); S({ target: Q2 });
  S({ target: "INQ-2026-0003-nofile", run: "RUN-NF" }); S({ target: Q2, run: "RUN-Q2", name: "held" });
  S({ name: "t", legs: Array.from({ length: 121 }, () => ({ target: DOC })) }); S({ name: "e", kind: "level-empty" });
  S({ name: "s", state: "accepted" }); S({ name: "b", description: "tbd" });
  S({ name: "pb", produced_by: "an AI" });
  S({ name: "u", legs: [{ target: "INFO-2026-0099-x", role: "supports", ground: "g" }], grounds: [{ ground: "g", statement: "the one part" }] });
  w.strength.error = "x"; S({ name: "p" }); w.strength.error = null;
  w.strength.independence = { checked: true, parts: 2, shared: [], complete: false, limit: 200 }; S({ name: "i" });
  w.strength.independence = { checked: true, parts: 2, shared: [{ a: "a", b: "b", through: ["bundle:x"] }], complete: true, limit: 200 }; S({ name: "n" });
  w.strength.independence = null;
  assert.equal(w.suggest({ name: "d1" }).ok, true); S({ name: "d2" });
  w.basisVersions.unsplice = true; S({ name: "w", claim: "a different claim" }); w.basisVersions.unsplice = false;
  w.run("RUN-EE", { mode: "extract", principal_plane: AK, status: "completed", mints: 1 });
  w.run("RUN-C", { mode: "check", principal_plane: AK, mints: 1 });
  w.run("RUN-NB", { mode: "extract", principal_plane: AK });
  w.run("RUN-F", { mode: "extract", principal_plane: AK, mints: 1 }); w.bounds.set("RUN-F|mints", { allowed: 1, consumed: 1 });
  w.run("RUN-1M", { mode: "extract", principal_plane: AK, mints: 1 });
  const P = (o) => see(w.p.extractPropose({ run: "RUN-E", bundleId: DOC, fn: "propose-reading", version: "0.1.0",
                                            refs: [{ ref: "k:1", refKind: "k", refKey: "1" }], proposedBy: AK, viewer: ALICE, caller: AK, ...o }));
  P({ proposedBy: "" }); P({ run: "" }); P({ run: "none" }); P({ run: "RUN-EE" }); P({ run: "RUN-C" }); P({ run: "RUN-NB" });
  P({ run: "RUN-F" }); P({ refs: [] }); P({ bundleId: Q }); w.doc(DOC2, "unread", { read: false });
  w.registered[DOC2] = []; P({ bundleId: DOC2 });
  P({ run: "RUN-1M", refs: [{ ref: "k:1", refKind: "k", refKey: "1", source: { kind: "pdf-page", page: 0, ref: "p1" } },
                            { ref: "k:2", refKind: "k", refKey: "2", source: { kind: "pdf-page", page: 1, ref: "p2" } }] });
  see(w.p.extractProposals({ viewer: ALICE }));
  /* R21–R24's rows, each driven once. */
  const PLACE = { kind: "pdf-page", page: 0, ref: "page 1" };
  w.units(w.content.captureFor(DOC), ["The Board approved ordinance 12 on 3 March 2026."]);
  const C = (c) => P({ refs: [], connections: [{ to_kind: "question", to: Q, quote: "ordinance 12", source: PLACE,
                                                 how: "shared_identifier", key: "12", ...c }] });
  C({ grade: "B" }); C({ to_kind: "nation" }); C({ quote: "" }); C({ to_kind: "person", to: "ENT-2026-0001" });
  C({ how: "vibes" }); P({ step: "STP-x" });
  w.run("RUN-R", { mode: "extract", principal_plane: AK, pages: 1 }); w.run("RUN-R0", { mode: "extract", principal_plane: AK });
  const R = (o) => see(w.p.readPages({ run: "RUN-R", bundleId: DOC, viewer: ALICE, caller: AK, ...o }));
  R({ run: "RUN-C" }); R({ run: "RUN-R0" }); R({}); R({});
  const prop = P({ refs: [{ ref: "k:9", refKind: "k", refKey: "9" }] }).proposed[0].id;
  const A = (o) => see(w.p.proposalAccept({ proposal: prop, form: "as_proposed", by: ALICE, viewer: ALICE, ...o }));
  A({ by: AK }); A({ proposal: "prp:none" }); A({ form: "maybe" }); A({ form: "edited" }); A({ edit: "my words" }); A({}); A({});
  const B = (o) => see(w.p.bearingNote({ capture: w.content.captureFor(DOC), question: Q, run: "RUN-E", viewer: ALICE, caller: AK,
                                         sentences: [{ text: "It names the ordinance.", quote: "not in the text", source: PLACE }], ...o }));
  B({ question: DOC }); B({ capture: "0".repeat(64) }); B({ sentences: [] }); B({});
  const cid = P({ refs: [{ ref: "k:7", refKind: "k", refKey: "7", source: PLACE }] }).proposed[0].content_id;
  see(w.p.machinePassage({ legs: [{ ord: 0, target: DOC, content_id: cid }], author: BOB, viewer: BOB }));
  const mine = [...RP.SUGGEST_CHECK_KEYS, ...RP.EXTRACT_PROPOSE_CHECK_KEYS].sort();
  assert.deepEqual(mine.filter((k) => !driven.has(k)), [], "every row this module carries is driven out of it");
  for (const k of mine) {
    const row = RP.SUGGEST_CHECKS[k] || RP.EXTRACT_PROPOSE_CHECKS[k];
    assert.deepEqual([driven.get(k).check, driven.get(k).translation], [row.check, row.translation], k);
  }
});

test("R17: proposed_readings (by bundle) and suggest_refusals (by target) are declared to record-core's purge: a bundle's purge takes its own, the whole-store purge takes all", () => {
  const { w, propose } = extractWorld();
  propose([{ ref: "k:1", refKind: "k", refKey: "1" }]);
  w.suggest({ name: "b", description: "tbd" });
  w.run("RUN-Q2", { context_id: Q2 });
  w.suggest({ target: Q2, run: "RUN-Q2", name: "b", description: "tbd" });
  assert.deepEqual([w.count("proposed_readings"), w.count("suggest_refusals")], [1, 2]);
  assert.deepEqual(w.p.counts(), { proposedReadings: 1, suggestRefusals: 2 });
  w.record.purge({ bundleId: Q });
  assert.deepEqual([w.count("proposed_readings"), w.count("suggest_refusals")], [1, 1], "the question's refusals went, the document's proposals stayed");
  w.record.purge({ bundleId: DOC });
  assert.equal(w.count("proposed_readings"), 0);
  w.record.purge({});
  assert.equal(w.count("suggest_refusals"), 0);
  assert.equal(RP.runProductionsOwns("proposed_readings") && RP.runProductionsOwns({ name: "suggest_refusals" }), true);
  assert.equal(RP.runProductionsOwns("ai_runs"), false);
});

test("R17: the counts op=stats reports leave out the rows naming a bundle the caller may not see", () => {
  const { w, propose } = extractWorld();
  propose([{ ref: "k:1", refKind: "k", refKey: "1" }]);
  w.suggest({ name: "b", description: "tbd" });
  const hid = { sql: "(?)", args: [DOC] };
  assert.deepEqual(w.p.counts(hid), { proposedReadings: 0, suggestRefusals: 1 });
});

test("R19: no place is named in this module's behaviour or outward text — its rows' translations, its sentences, and every refusal it composed in these tests", () => {
  const PLACE = /oakland|alameda|california|berkeley|san francisco|\bcity of\b|\bcounty\b/i;
  const texts = [
    ...Object.values(RP.SUGGEST_CHECKS).map((r) => r.translation), ...Object.values(RP.EXTRACT_PROPOSE_CHECKS).map((r) => r.translation),
    RP.EXTRACT_PROPOSALS_SAYS, RP.EXTRACT_PROPOSAL_ROW_SAYS, ...Object.values(RP.SUGGEST_KINDS),
  ];
  const { w, propose } = extractWorld();
  for (const o of [{ target: "" }, { kind: "x" }, { run: "none" }, { name: "b", description: "tbd" }, { name: "s", state: "x" }])
    texts.push(JSON.stringify(w.suggest(o)));
  texts.push(JSON.stringify(propose([{ ref: "k:1", refKind: "k", refKey: "1" }])));
  texts.push(JSON.stringify(w.p.extractProposals({ viewer: ALICE })), JSON.stringify(w.p.extractProposals({ run: "RUN-E", viewer: ALICE })));
  assert.deepEqual(texts.filter((t) => PLACE.test(t)), []);
});

test("K61, R18 (N194): runProductionsOf answers one instance per storage; a provider not given is reached through its factory — ai-runs' own instance (aiRunsOf), whose runFor, boundOf and consumeBound are the only way a run or bound is read", async () => {
  const { aiRunsOf } = await import("../../../src/ai-runs/index.mjs");
  const { w } = extractWorld();
  assert.equal(RP.runProductionsOf(w.host), w.p);
  const bare = world({ aiRuns: null });
  assert.equal(bare.p.aiRuns, aiRunsOf(bare.host), "ai-runs reached through its factory, not a hand-over");
  /* Driven through the real provider: a run nobody opened is SUGGEST_NO_RUN and NO_SUCH_RUN, read through its runFor. */
  bare.inquiry(Q);
  assert.equal(bare.suggest({ run: "RUN-NEVER" }).code, "SUGGEST_NO_RUN");
  assert.equal(bare.p.extractPropose({ run: "RUN-NEVER", bundleId: DOC, fn: "propose-reading", version: "0.1.0",
                                       refs: [{ ref: "k:1", refKind: "k", refKey: "1" }], proposedBy: AK, viewer: ALICE,
                                       caller: AK }).code, "NO_SUCH_RUN");
});

test("R3's constants are published: the legs bound, the origin limit, the versions bound, the member-only fields and the three axes", () => {
  assert.deepEqual([RP.SUGGEST_LEGS_MAX, RP.SUGGEST_ORIGIN_MAX, RP.SUGGEST_VERSIONS_MAX], [120, 200, 1000]);
  assert.deepEqual([...RP.SUGGEST_UNWRITABLE_FIELDS], ["state", "hidden", "state_by", "state_at", "state_reason", "at", "affirmed_parts", "affirmed"]);
  assert.deepEqual([...RP.PAIR_AXES], ["capture", "connection", "testimony"]);
  assert.deepEqual(RP.posFields({ kind: "pdf-page", ref: "p1", page: 0, rect: [0, 0, 1, 1] }), { page: 0, rect: [0, 0, 1, 1] });
  assert.equal(RP.substanceOf("name\ta\nkind\tk\nderived_from\tb\nground\tg\tm\t2026\ts"), "kind\tk\nground\tg\tm\t\ts");
});

test("R3 through the extracted providers: strength's candidatePair and candidateIndependence (its R26, R27) and citation's retiredNotCitable (its R5), reached through their factories", async () => {
  const { strengthOf } = await import("../../../src/strength/index.mjs");
  const { citationOf } = await import("../../../src/citation/index.mjs");
  const w = world({ real: true });
  assert.equal(w.p.strength, strengthOf(w.host));
  assert.equal(w.p.citation, citationOf(w.host));
  w.inquiry(Q); w.run(RUN);
  w.doc(DOC); w.doc(DOC2, "retired doc", { state: "retired" });
  const PART = [{ ground: "paper", statement: "the paper trail of the approval" }];
  const leg = (target, over = {}) => ({ target, role: "supports", ground: "paper", ...over });
  const retired = w.suggest({ name: "r", legs: [leg(DOC2)], grounds: PART });
  assert.equal(retired.code, "SUGGEST_LEG_UNREACHABLE");
  assert.equal(retired.legs[0].why, word("run-productions.why.record_retired"));
  const ok = w.suggest({ name: "g", legs: [leg(DOC, { grade: "B", grade_axis: "capture", grade_source: "capture" })], grounds: PART });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.deepEqual([ok.pair.capture.state, ok.pair.capture.grade, ok.pair.connection.state, ok.pair.testimony.state],
                   ["graded", "B", "unrated", "unrated"]);
  assert.deepEqual([ok.origins_complete, ok.shared_origins, ok.origin_limit], [true, [], 200]);
  /* A hunch is inert in the pair, and named (strength R5): the reading rests on nothing graded. */
  const hunch = w.suggest({ name: "h", legs: [leg(DOC, { grade: "A", grade_axis: "capture", grade_source: "hunch" })], grounds: PART });
  assert.equal(hunch.ok, true);
  assert.equal(hunch.pair.capture.state, "unrated");
  /* Two parts resting on one document share an upstream origin: refused C-27.11 by strength's own trace. */
  const two = [{ ground: "paper", statement: "one part of it" }, { ground: "record", statement: "the other part" }];
  const shared = w.suggest({ name: "s", legs: [leg(DOC), leg(DOC, { ground: "record" })], grounds: two });
  assert.equal(shared.code, "SUGGEST_BRANCHES_NOT_INDEPENDENT");
  assert.deepEqual(shared.shared.map((x) => [x.a, x.b]), [["paper", "record"]]);
});

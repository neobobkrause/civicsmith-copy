/* contradiction R13–R17, R19–R22: the candidate door (`propose`, op=contradictionpropose), the run gate and the
   purge declaration, driven at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, k4World, sha, MACHINE, MEMBER, OUTSIDER } from "./fixture.mjs";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { canonicalJson } from "../../../src/record-grammar/json.mjs";
import { Contradiction, CONTRADICTION_CANDIDATE_CHECKS, CONTRADICTION_PAIR_CHECKS, CONTRADICTION_LABELS,
         CONTRADICTION_TABLES } from "../../../src/contradiction/index.mjs";

const RUN = "RUN-2026-0001";
const PRINCIPAL = "member:m1";

/* A record forming one K2 pair (two claims on subject E1) and one K4 pair (two extents on entity E1), with a running
   run whose principal is m1. */
function proposeWorld(opts) {
  const w = k4World({ contentType: "rule" }, { contentType: "act" }, opts);
  w.inquiry("INQ-2026-0002", { subject: "E1" }); w.version("INQ-2026-0002", "v1", { claim: "the fee rose" });
  w.inquiry("INQ-2026-0003", { subject: "E1" }); w.version("INQ-2026-0003", "v1", { claim: "the fee fell" });
  w.runs.set(RUN, { status: "running", principal: PRINCIPAL });
  return w;
}
const pairOf = (w, key, viewer = MEMBER) => w.c.pairs({ key, viewer }).pairs[0];
const propose = (w, proposals, extra = {}) =>
  w.c.propose({ run: RUN, proposals, proposedBy: "class:ai/tok1", viewer: MEMBER, caller: PRINCIPAL, ...extra });
const one = (w, key, extra = {}) => { const p = pairOf(w, key); return { key, a: p.a, b: p.b, label: "precision", reason: "same fact", ...extra }; };
const count = (w) => w.one(`SELECT COUNT(*) AS n FROM contradiction_candidates`).n;

function refused(r, code) {
  assert.equal(r.ok, false, JSON.stringify(r));
  assert.equal(r.code, code);
  assert.equal(r.reason, code);
  const row = CONTRADICTION_CANDIDATE_CHECKS[code];
  assert.equal(r.check, row.check);
  assert.equal(r.translation, row.translation);
  assert.equal(typeof r.detail, "string");
}

test("R13: refusals in order, each of the whole batch before anything is written — proposer, run, principal, running, proposals, label, reason, pair", () => {
  const w = proposeWorld();
  w.runs.set("RUN-2026-0002", { status: "ended", principal: PRINCIPAL });
  w.runs.set("RUN-2026-0003", { status: "running", principal: PRINCIPAL, hidden: true });
  const good = one(w, "K2");
  /* C-93.1: an empty stamp, asked first (a missing run too) */
  for (const proposedBy of [null, undefined, "", "  ", 7]) {
    refused(propose(w, [good], { proposedBy }), "CANDIDATE_NO_PROPOSER");
    refused(propose(w, [good], { proposedBy, run: null }), "CANDIDATE_NO_PROPOSER");
  }
  /* C-93.2: no run named, one absent, or one not visible — the same answer */
  for (const run of [null, "", "  ", 42]) {
    const r = propose(w, [good], { run });
    refused(r, "CANDIDATE_NO_RUN");
    assert.equal(r.run, null);
  }
  const absent = propose(w, [good], { run: "RUN-2026-0404", caller: "nobody" });
  const hidden = propose(w, [good], { run: "RUN-2026-0003", caller: "nobody" });
  refused(absent, "CANDIDATE_NO_RUN"); refused(hidden, "CANDIDATE_NO_RUN");
  assert.deepEqual({ ...absent, run: null, detail: null }, { ...hidden, run: null, detail: null });
  assert.match(absent.detail, /no run named 'RUN-2026-0404' is open/);
  assert.match(hidden.detail, /no run named 'RUN-2026-0003' is open/);
  /* the principal's refusal, relayed with its own code, asked before whether the run is running */
  for (const run of [RUN, "RUN-2026-0002"]) {
    const r = propose(w, [good], { run, caller: "member:someone-else" });
    assert.deepEqual([r.ok, r.code, r.reason, r.check], [false, "AI_RUN_NOT_PRINCIPAL", "AI_RUN_NOT_PRINCIPAL", "C-22.12"]);
    assert.equal(r.translation, "not the run's principal");
    assert.equal(r.run, run);
    assert.match(r.note, /Nothing was written/);
  }
  /* C-93.3 */
  refused(propose(w, [good], { run: "RUN-2026-0002" }), "CANDIDATE_RUN_NOT_RUNNING");
  /* C-93.4 */
  for (const proposals of [[], null, undefined, "x", {}]) refused(propose(w, proposals), "CANDIDATE_NO_PROPOSALS");
  /* C-93.5 over the whole batch before C-93.6: a later bad label wins over an earlier blank reason */
  const lab = propose(w, [{ ...good, reason: "" }, { ...good, label: "contradiction" }]);
  refused(lab, "CANDIDATE_LABEL_UNKNOWN");
  assert.equal(lab.index, 1);
  assert.deepEqual(lab.labels, [...CONTRADICTION_LABELS]);
  for (const label of [undefined, null, "World", " world", "finding"]) refused(propose(w, [{ ...good, label }]), "CANDIDATE_LABEL_UNKNOWN");
  refused(propose(w, [null]), "CANDIDATE_LABEL_UNKNOWN");
  /* C-93.6 over the whole batch before C-93.7: a later blank reason wins over an earlier unformed pair */
  const rea = propose(w, [{ ...good, key: "K1" }, { ...good, reason: "   " }]);
  refused(rea, "CANDIDATE_NO_REASON");
  assert.equal(rea.index, 1);
  for (const reason of [undefined, null, "", 3]) refused(propose(w, [{ ...good, reason }]), "CANDIDATE_NO_REASON");
  /* C-93.7: a pair not formed for this viewer now, by key and both sides at their versions */
  const nf = propose(w, [good, { ...good, key: "K1" }]);
  refused(nf, "CANDIDATE_PAIR_NOT_FORMED");
  assert.equal(nf.index, 1);
  assert.deepEqual(nf.cut_keys, []);
  const k4 = one(w, "K4");
  for (const bad of [{ ...good, a: { ...good.a, claim: "the fee rose a little" } },          /* a changed claim (R14) */
                     { ...good, a: { ...good.a, version: "v9" } },
                     { ...good, b: good.a },
                     { ...k4, key: "K2" },
                     { ...k4, b: { ...k4.b, content_id: "zz" } },
                     { ...k4, b: { ...k4.b, content_id: null, capture_sha: "nope" } },
                     { key: "K2", label: "world", reason: "r" }])
    refused(propose(w, [bad]), "CANDIDATE_PAIR_NOT_FORMED");
  /* not formed for THIS viewer: a side in a project the outsider does not take part in */
  const p = world(); p.runs.set(RUN, { status: "running", principal: PRINCIPAL });
  p.inquiry("INQ-2026-0001", { subject: "E1" }); p.version("INQ-2026-0001", "v1");
  p.inquiry("PROJ-2026-0001", { subject: "E1", project: true }); p.version("PROJ-2026-0001", "v1");
  const seen = one(p, "K2");
  assert.equal(propose(p, [seen]).ok, true);
  refused(propose(p, [seen], { viewer: OUTSIDER }), "CANDIDATE_PAIR_NOT_FORMED");
  /* a pair past the bound is not formed, and the refusal names the keys cut */
  const c = world(); c.runs.set(RUN, { status: "running", principal: PRINCIPAL });
  c.inquiry("INQ-2026-0001");
  for (let i = 0; i < 51; i++) {
    c.content(`s${i}`, `caps${i}`, "INFO-2026-0001");
    c.leg("INQ-2026-0001", i, "supports", { content: `s${i}` });
  }
  c.content("x", "capx", "INFO-2026-0002");
  c.leg("INQ-2026-0001", 99, "cuts_against", { content: "x" });
  const past = { key: "K1", a: { kind: "leg", content_id: "s9", capture_sha: "caps9" },
                 b: { kind: "leg", content_id: "x", capture_sha: "capx" }, label: "world", reason: "r" };
  const all = c.c.pairs({ key: "K1", viewer: MEMBER });
  assert.equal(all.keys[0].truncated, true);
  const formedIds = new Set(all.pairs.map((q) => q.a.content_id));
  const beyond = [...Array(51).keys()].map((i) => `s${i}`).find((id) => !formedIds.has(id));
  const cut = propose(c, [{ ...past, a: { kind: "leg", content_id: beyond, capture_sha: `caps${beyond.slice(1)}` } }]);
  refused(cut, "CANDIDATE_PAIR_NOT_FORMED");
  assert.deepEqual(cut.cut_keys, ["K1"]);
  assert.match(cut.detail, /cut at its bound on K1/);
  /* nothing was written by any refusal above */
  assert.equal(count(w), 0);
  assert.equal(count(c), 0);
});

test("R14: a claim is inquiry|version versioned by its text's digest; a leg or extent is its content id versioned by the capture", () => {
  const w = proposeWorld();
  const r = propose(w, [one(w, "K2", { label: "record" }), one(w, "K4", { label: "world" })]);
  assert.equal(r.ok, true);
  const [claim, extent] = r.candidates;
  const sides = (c) => [[c.a_kind, c.a_ref, c.a_version], [c.b_kind, c.b_ref, c.b_version]];
  assert.deepEqual(sides(claim).sort(), [["claim", "INQ-2026-0002|v1", sha("the fee rose")],
                                         ["claim", "INQ-2026-0003|v1", sha("the fee fell")]].sort());
  assert.deepEqual(sides(extent).sort(), [["extent", "ca", "capA"], ["extent", "cb", "capB"]].sort());
  /* a leg is its own kind; its referent the content id and capture */
  const k1 = world(); k1.runs.set(RUN, { status: "running", principal: PRINCIPAL });
  k1.inquiry("INQ-2026-0001"); k1.content("c1", "cap1", "INFO-2026-0001"); k1.content("c2", "cap2", "INFO-2026-0002");
  k1.leg("INQ-2026-0001", 0, "supports", { content: "c1" }); k1.leg("INQ-2026-0001", 1, "cuts_against", { content: "c2" });
  const l = propose(k1, [one(k1, "K1", { label: "world" })]).candidates[0];
  assert.deepEqual(sides(l).sort(), [["leg", "c1", "cap1"], ["leg", "c2", "cap2"]]);
  /* the claim changes: the pair the plane forms now is a different referent, and the old proposal is refused */
  const old = one(w, "K2");
  w.st.sql.exec(`UPDATE inquiry_basis_versions SET claim='the fee rose sharply' WHERE bundle_id='INQ-2026-0002'`);
  refused(propose(w, [old]), "CANDIDATE_PAIR_NOT_FORMED");
  const fresh = propose(w, [one(w, "K2")]);
  assert.equal(fresh.written, 1);
  assert.notEqual(fresh.candidates[0].candidate, claim.candidate);
});

test("R15: the id is the SHA-256 of {v: 1, key, sides} with the sides ordered; the row carries what the plane read; a re-proposal writes nothing", () => {
  const w = proposeWorld();
  const long = `  ${"x".repeat(2500)}  `;
  const p = one(w, "K4", { label: "world", reason: long });
  const r = propose(w, [p], { at: "2026-09-28T01:02:03Z", proposedBy: "  class:ai/tok1  " });
  assert.equal(r.ok, true);
  const c = r.candidates[0];
  const handles = ["extent|ca@capA", "extent|cb@capB"].sort();
  assert.equal(c.candidate, sha(canonicalJson({ v: 1, key: "K4", sides: handles })));
  const formed = pairOf(w, "K4");
  const { a: fa, b: fb, key: _k, ...context } = formed;
  assert.deepEqual(c, {
    new: true, candidate: c.candidate, key: "K4",
    a_kind: "extent", a_ref: "ca", a_version: "capA", a_bundle_id: "INFO-2026-0001",
    b_kind: "extent", b_ref: "cb", b_version: "capB", b_bundle_id: "INFO-2026-0002",
    run: RUN, proposed_by: "class:ai/tok1", label: "world", reason: "x".repeat(2000),
    state: "proposed", origin: "machine", at: "2026-09-28T01:02:03Z",
    /* both sides as the plane formed them, in the row's order, with the pair's own context */
    a_side: JSON.stringify({ ...fa, context }), b_side: JSON.stringify({ ...fb, context }) });
  /* the sides given in the other order are the same candidate; the claim sides live in their inquiries */
  const swapped = propose(w, [{ ...p, a: p.b, b: p.a, label: "precision", reason: "another" }]);
  assert.deepEqual([swapped.written, swapped.unchanged, swapped.candidates[0].new], [0, 1, false]);
  assert.deepEqual({ ...swapped.candidates[0], new: true }, c);
  const k2 = propose(w, [one(w, "K2")]).candidates[0];
  assert.deepEqual([k2.a_bundle_id, k2.b_bundle_id].sort(), ["INQ-2026-0002", "INQ-2026-0003"]);
  /* without `at`, the module's clock */
  const x = proposeWorld({ now: () => "2026-09-28T09:09:09Z" });
  assert.equal(propose(x, [one(x, "K2")]).candidates[0].at, "2026-09-28T09:09:09Z");
  assert.equal(count(w), 2);
});

test("R16: the answer is {ok, run, proposed, written, unchanged, candidates} and says each is proposed machine work and no finding", () => {
  const w = proposeWorld();
  const first = propose(w, [one(w, "K2")]);
  const r = propose(w, [one(w, "K2"), one(w, "K4")]);
  assert.deepEqual(Object.keys(r).sort(), ["candidates", "ok", "proposed", "run", "says", "unchanged", "written"]);
  assert.deepEqual([r.ok, r.run, r.proposed, r.written, r.unchanged], [true, RUN, 2, 1, 1]);
  assert.deepEqual(r.candidates.map((c) => c.new), [false, true]);
  assert.equal(r.candidates[0].candidate, first.candidates[0].candidate);
  for (const c of r.candidates) assert.deepEqual(c, { new: c.new, ...w.one(`SELECT candidate, key, a_kind, a_ref, a_version,
    a_bundle_id, b_kind, b_ref, b_version, b_bundle_id, run, proposed_by, label, reason, state, origin, at, a_side, b_side
    FROM contradiction_candidates WHERE candidate=?`, c.candidate) });
  assert.match(r.says, /1 candidate\(s\) written as PROPOSED machine work; 1 named two referents/);
  assert.match(r.says, /never a finding/);
});

test("R17: append-only — nothing updates or deletes a candidate but its bundles' purge, which either side's bundle takes", () => {
  const w = proposeWorld();
  const c = propose(w, [one(w, "K4", { label: "world", reason: "first" })]).candidates[0];
  const again = propose(w, [one(w, "K4", { label: "unrelated", reason: "second" })]);
  assert.equal(again.written, 0);
  assert.deepEqual(w.one(`SELECT label, reason FROM contradiction_candidates WHERE candidate=?`, c.candidate),
                   { label: "world", reason: "first" });
  /* the pairing read and a further proposal leave it as it was */
  w.c.pairs({ viewer: MACHINE });
  const k2 = propose(w, [one(w, "K2")]).candidates[0];
  assert.equal(count(w), 2);
  /* a purge of an unrelated bundle leaves both; either side's bundle takes the row */
  w.record.purge({ bundleId: "INFO-2026-0099" });
  assert.equal(count(w), 2);
  w.record.purge({ bundleId: "INFO-2026-0002" });       /* K4's b side */
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM contradiction_candidates WHERE candidate=?`, c.candidate).n, 0);
  w.record.purge({ bundleId: "INQ-2026-0002" });        /* K2's a side */
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM contradiction_candidates WHERE candidate=?`, k2.candidate).n, 0);
});

test("R19: no act here judges, grades, edits or closes a side, and no read shows a candidate", () => {
  const w = proposeWorld();
  const snapshot = () => JSON.stringify(["bundles", "inquiry_basis", "inquiry_basis_versions", "inquiry_basis_version_legs",
    "content", "readings", "resolutions"].map((t) => w.rows(`SELECT * FROM ${t} ORDER BY 1`)));
  const before = snapshot();
  const pairsBefore = w.c.pairs({ viewer: MACHINE });
  assert.equal(propose(w, [one(w, "K2", { label: "record" }), one(w, "K4", { label: "world" })]).written, 2);
  assert.equal(snapshot(), before);
  const pairsAfter = w.c.pairs({ viewer: MACHINE });
  assert.deepEqual(pairsAfter, pairsBefore);
  assert.doesNotMatch(JSON.stringify(pairsAfter), /"candidate"|"proposed"|contradiction_candidates/);
});

test("R20, R61: C-60.1–C-60.3 and C-93.1–C-93.42 are this module's invariants, each with its row, its translation, and a refusal test", () => {
  assert.deepEqual(Object.entries(CONTRADICTION_PAIR_CHECKS).map(([k, r]) => [k, r.check]), [
    ["CONTRADICTION_KEY_UNKNOWN", "C-60.1"], ["CANDIDATES_NO_SUBJECT", "C-60.2"], ["TENSIONS_TOO_MANY", "C-60.3"]]);
  const codes = Object.entries(CONTRADICTION_CANDIDATE_CHECKS).map(([k, r]) => [k, r.check]);
  assert.deepEqual(codes.slice(0, 7), [
    ["CANDIDATE_NO_PROPOSER", "C-93.1"], ["CANDIDATE_NO_RUN", "C-93.2"], ["CANDIDATE_RUN_NOT_RUNNING", "C-93.3"],
    ["CANDIDATE_NO_PROPOSALS", "C-93.4"], ["CANDIDATE_LABEL_UNKNOWN", "C-93.5"], ["CANDIDATE_NO_REASON", "C-93.6"],
    ["CANDIDATE_PAIR_NOT_FORMED", "C-93.7"]]);
  assert.deepEqual(codes.map(([, c]) => c), Array.from({ length: 42 }, (_, i) => `C-93.${i + 1}`));
  /* The N345 rows and their translations are exactly the requirement's table (R20; N345). */
  const req = readFileSync(fileURLToPath(new URL("../../../../build/requirements/contradiction.md", import.meta.url)), "utf8");
  const table = [...req.matchAll(/^\| (C-(?:60|93)\.\d+) \| `([A-Z_]+)` \| "(.+)" \|$/gm)].map((m) => [m[1], m[2], m[3]]);
  assert.equal(table.length, 37);  /* C-60.2, C-60.3 and C-93.8–C-93.42 (R20; N345; R61) */
  const all = { ...CONTRADICTION_PAIR_CHECKS, ...CONTRADICTION_CANDIDATE_CHECKS };
  for (const [check, code, translation] of table) {
    assert.equal(all[code]?.check, check, code);
    assert.equal(all[code].translation, translation, code);
  }
  for (const row of Object.values(all)) {
    assert.ok(row.translation.length > 40);
    assert.match(row.where, /^src\/contradiction\/index\.mjs #?[A-Za-z]+ > is-[a-z-]+$/);
  }
});

test("R21: the run gate is registered once; with none registered the run checks refuse as C-93.2; it is asked (run, viewer, caller)", () => {
  const w = proposeWorld({ gate: false });
  const good = one(w, "K2");
  refused(propose(w, [good]), "CANDIDATE_NO_RUN");
  assert.deepEqual(w.c.registerRunGate("", () => null).reason, "RUN_GATE_MALFORMED");
  assert.deepEqual(w.c.registerRunGate("ai-runs", "gate").reason, "RUN_GATE_MALFORMED");
  const calls = [];
  const answers = [{ found: false, running: true, refusal: null },
                   { found: true, running: true, refusal: { code: "AI_RUN_NOT_PRINCIPAL", check: "C-22.12", translation: "t", detail: "d" } },
                   { found: true, running: false, refusal: null },
                   { found: true, running: true, refusal: null }];
  let n = 0;
  assert.deepEqual(w.c.registerRunGate("ai-runs", (...args) => { calls.push(args); return answers[n++]; }), { ok: true, module: "ai-runs" });
  const second = w.c.registerRunGate("run-rules", () => answers[3]);
  assert.deepEqual([second.ok, second.reason, second.module], [false, "RUN_GATE_DECLARED", "ai-runs"]);
  refused(propose(w, [good], { run: " RUN-X " }), "CANDIDATE_NO_RUN");
  assert.equal(propose(w, [good]).code, "AI_RUN_NOT_PRINCIPAL");
  refused(propose(w, [good]), "CANDIDATE_RUN_NOT_RUNNING");
  assert.equal(propose(w, [good]).ok, true);
  assert.deepEqual(calls, [["RUN-X", MEMBER, PRINCIPAL], [RUN, MEMBER, PRINCIPAL], [RUN, MEMBER, PRINCIPAL], [RUN, MEMBER, PRINCIPAL]]);
  /* a blank run never asks the gate */
  refused(propose(w, [good], { run: "  " }), "CANDIDATE_NO_RUN");
  assert.equal(calls.length, 4);
});

test("R22: contradiction_candidates is declared to record-core's purge by a_bundle_id and b_bundle_id, once", () => {
  const w = proposeWorld();
  assert.equal(CONTRADICTION_TABLES[0], "contradiction_candidates");
  assert.deepEqual(w.c.declarePurge(), { ok: true, already: true });
  w.c.migrate();   /* idempotent at every boot */
  assert.equal(propose(w, [one(w, "K4")]).written, 1);
  const all = w.record.purge({});
  assert.ok(JSON.stringify(all).includes("contradiction_candidates"));
  assert.equal(count(w), 0);
  /* a second module declaring the table is refused by record-core */
  const other = new Contradiction(w.st, { record: w.record, extraction: w.x });
  assert.equal(other.declarePurge().reason, "TABLE_DECLARED");
});

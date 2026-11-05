/* run-productions: op=suggest, the investigative session's one write (R1–R9, R15). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SUGGEST_CHECKS } from "../../../src/run-productions/index.mjs";
import { SUFFICIENCY_UNCLAIMED } from "../../../src/basis-versions/index.mjs";
import { world, GRADED, Q, Q2, PROJ, HIDDEN_PROJ, DOC, DOC2, RUN, XRUN, ALICE, ALICE_TOKEN, BOB, MACHINE, sha } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const row = (code) => SUGGEST_CHECKS[code];
function refusedAs(r, code) {
  assert.equal(r.ok, false, `refused: ${JSON.stringify(r).slice(0, 300)}`);
  assert.equal(r.code, code, `code ${r.code} (${r.detail})`);
  if (row(code)) { assert.equal(r.check, row(code).check); assert.equal(r.translation, row(code).translation); }
}
const LEG = (target, over = {}) => ({ target, role: "supports", ground: "paper", ...over });
const PART = [{ ground: "paper", statement: "the paper trail of the approval" }];

function base() {
  const w = world();
  w.inquiry(Q); w.inquiry(Q2);
  w.run(RUN);
  const cap = w.doc(DOC);
  return { w, cap };
}

/* Every refusal of R1, each with nothing written, in the order R1 states: the request carries every later fault too,
   and each earlier one is removed in turn (the negative control removing it alone). */
test("R1: shape refusals in order, nothing written on any: C-27.1, C-27.2, C-27.3, invisible target, C-27.4, ai-runs R5 relayed, C-27.18, C-27.19, C-27.17, C-27.5, C-27.7, C-27.6", () => {
  const { w } = base();
  w.inquiry(Q2, [{ name: "held reading" }]);
  w.st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
                 VALUES ('INQ-2026-0003-nofile', 'inquiry', 'g', 't', 'open', 't', 't', 'sha')`);
  w.run("RUN-ENDED", { status: "completed", context_id: Q2 });
  w.run("RUN-Q2", { context_id: Q2 });
  w.run("RUN-NOFILE", { context_id: "INQ-2026-0003-nofile" });
  w.run("RUN-BOB", { context_id: Q2, principal_plane: BOB });
  const legs121 = Array.from({ length: 121 }, () => LEG(DOC));
  const worst = { target: Q2, kind: "level-empty", run: "RUN-Q2", name: "held reading", legs: legs121 };
  const before = w.snapshot();
  const steps = [
    [{ ...worst, target: "" }, "SUGGEST_NO_TARGET"],
    [{ ...worst, target: "INFO-2026-0001-a" }, "SUGGEST_NOT_AN_INQUIRY"],
    [{ ...worst, kind: "new-version" }, "SUGGEST_UNKNOWN_KIND"],
    [{ ...worst, viewer: "nobody" }, "SUGGEST_NOT_AN_INQUIRY"],
    [{ ...worst, target: "INQ-2026-0099-absent" }, "SUGGEST_NOT_AN_INQUIRY"],
    [{ ...worst, run: "" }, "SUGGEST_NO_RUN"],
    [{ ...worst, run: "RUN-NONE" }, "SUGGEST_NO_RUN"],
    [{ ...worst, run: "RUN-BOB" }, "AI_RUN_NOT_PRINCIPAL"],
    [{ ...worst, run: "RUN-ENDED" }, "SUGGEST_RUN_NOT_RUNNING"],
    [{ ...worst, run: RUN }, "SUGGEST_OUTSIDE_RUN_CONTEXT"],
    [{ ...worst, target: "INQ-2026-0003-nofile", run: "RUN-NOFILE" }, "SUGGEST_NO_DOCUMENT"],
    [worst, "SUGGEST_NAME_TAKEN"],
    [{ ...worst, name: "held\nreading" }, "SUGGEST_NAME_TAKEN"],
    [{ ...worst, name: "fresh" }, "SUGGEST_TOO_MANY_LEGS"],
    [{ ...worst, name: "fresh", legs: [] }, "SUGGEST_EMPTY_LEVEL_UNSTATED"],
    [{ ...worst, name: "fresh", legs: [], level: "documents" }, "SUGGEST_EMPTY_LEVEL_UNSTATED"],
    [{ ...worst, name: "fresh", legs: [], level: "document", observed_at: "log:1" }, "SUGGEST_EMPTY_LEVEL_UNSTATED"],
  ];
  for (const [over, code] of steps) {
    const r = w.suggest(over);
    refusedAs(r, code);
    assert.equal(r.repeated, undefined, `${code} is a shape refusal and is not memoised`);
  }
  assert.deepEqual(w.snapshot(), before, "nothing written on any shape refusal, not even R2's memo");
  /* The relayed position refusal is ai-runs' own, whole (C-22.12). */
  const np = w.suggest({ ...worst, run: "RUN-BOB" });
  assert.equal(np.check, "C-22.12");
  assert.match(np.detail, /suggesting a reading under a run/);
  /* The too-many-legs refusal publishes its bound. */
  assert.equal(w.suggest({ ...worst, name: "fresh" }).limit, 120);
  /* And the last negative control: with every shape fault removed, the same request lands. */
  assert.equal(w.suggest({ ...worst, name: "fresh", legs: [], level: "documents", observed_at: "log:1" }).ok, true);
});

test("R1: an invisible run and a never-held one answer the same SUGGEST_NO_RUN, byte for byte but for the id", () => {
  const { w } = base();
  w.project(HIDDEN_PROJ, [ALICE.slice(7)]);
  w.run("RUN-HID", { context_type: "project", context_id: HIDDEN_PROJ, principal_plane: BOB });
  const hidden = w.suggest({ run: "RUN-HID", viewer: BOB, author: BOB, caller: BOB });
  const never = w.suggest({ run: "RUN-NEVER", viewer: BOB, author: BOB, caller: BOB });
  refusedAs(hidden, "SUGGEST_NO_RUN"); refusedAs(never, "SUGGEST_NO_RUN");
  assert.deepEqual(JSON.parse(JSON.stringify(hidden).replaceAll("RUN-HID", "X")),
                   JSON.parse(JSON.stringify(never).replaceAll("RUN-NEVER", "X")));
  /* A project run lands on a question its project confirmed-cites, and only there. */
  w.project(PROJ, ["alice"]);
  w.run("RUN-P", { context_type: "project", context_id: PROJ });
  refusedAs(w.suggest({ run: "RUN-P" }), "SUGGEST_OUTSIDE_RUN_CONTEXT");
  w.cites[Q] = [PROJ];
  assert.equal(w.suggest({ run: "RUN-P" }).ok, true);
});

test("R2: a verbatim resubmit of a refused submission answers the stored refusal unchanged, evaluates nothing and moves nothing; a moved document is judged afresh", () => {
  const { w } = base();
  const bad = { description: "TBD", name: "r1" };
  const first = w.suggest(bad);
  refusedAs(first, "SUGGEST_BOILERPLATE");
  assert.deepEqual([first.repeated, first.evaluated, first.wrote], [false, true, false]);
  const shaBefore = w.sha(Q);
  const docBefore = w.md(Q);
  const pairsAsked = w.calls.filter((c) => c.name === "candidatePair").length;
  const again = w.suggest(bad);
  const { repeated, evaluated, wrote, repeats, first_refused_at, ...stored } = again;
  assert.deepEqual([repeated, evaluated, wrote, repeats], [true, false, false, 1]);
  assert.equal(first_refused_at, "2026-09-28T01:00:00Z");
  const { repeated: r0, evaluated: e0, wrote: w0, ...firstStored } = first;
  assert.deepEqual(stored, firstStored, "the stored refusal, unchanged");
  assert.equal(w.suggest(bad).repeats, 2, "the counter is the one thing that moves");
  assert.equal(w.sha(Q), shaBefore); assert.equal(w.md(Q), docBefore);
  assert.equal(w.calls.filter((c) => c.name === "candidatePair").length, pairsAsked, "no check ran again");
  assert.equal(w.count("inquiry_basis_versions"), 0);
  /* Any byte of the submission differs: judged afresh. */
  assert.equal(w.suggest({ ...bad, claim: "another claim" }).repeated, false);
  /* The question's document moves: the same bytes are a different question. */
  w.inquiry(Q, [{ name: "someone else's reading" }]);
  const afresh = w.suggest(bad);
  assert.deepEqual([afresh.repeated, afresh.evaluated], [false, true]);
});

test("R3: the pre-write verdicts, each named, in order — C-27.13, C-27.12, C-27.8, C-27.9, C-27.16, C-27.11, C-27.10, C-27.14 — each removed alone lets the next speak; every one is kept for R2", () => {
  const { w } = base();
  w.retired.add(DOC2); w.doc(DOC2, "doc2");
  w.inquiry(Q, [{ name: "held" }]);
  /* A held reading identical in substance to what we will send, under another name and an earlier clock. */
  const same = { description: "the ledger shows it twice", claim: "approved twice", legs: [], grounds: [] };
  w.clock.now = "2026-09-28T00:00:00Z";
  assert.equal(w.suggest({ ...same, name: "twin" }).ok, true);
  w.clock.now = "2026-09-28T01:00:00Z";
  const all = { ...same, name: "new", state: "accepted", description: "TBD", legs: [LEG(DOC2)], grounds: PART };
  const order = [
    [{}, "SUGGEST_UNWRITABLE_STATE"],
    [{ state: undefined }, "SUGGEST_BOILERPLATE"],
    [{ state: undefined, description: same.description }, "SUGGEST_LEG_UNREACHABLE"],
  ];
  for (const [over, code] of order) refusedAs(w.suggest({ ...all, ...over }), code);
  /* Each step is a new submission (a new name), since a verbatim resubmit answers R2's stored refusal. */
  const ok = (n) => ({ ...all, name: n, state: undefined, description: same.description, legs: [LEG(DOC)] });
  w.strength.error = "the walk failed";
  refusedAs(w.suggest(ok("n1")), "SUGGEST_PAIR_DOES_NOT_COMPUTE");
  w.strength.error = null;
  w.strength.independence = { checked: true, parts: 1, shared: [], complete: false, limit: 7 };
  const inc = w.suggest(ok("n2"));
  refusedAs(inc, "SUGGEST_COMPARISON_INCOMPLETE");
  assert.equal(inc.limit, 7, "the trace's own published bound");
  w.strength.independence = { checked: true, parts: 2, shared: [{ a: "paper", b: "record", through: ["bundle:" + DOC] }], complete: true, limit: 200 };
  refusedAs(w.suggest(ok("n3")), "SUGGEST_BRANCHES_NOT_INDEPENDENT");
  w.strength.independence = null;
  const dup = w.suggest({ ...same, name: "new" });
  refusedAs(dup, "SUGGEST_NOT_DIFFERENT");
  assert.equal(dup.same_as, "twin");
  w.basisVersions.unsplice = true;
  refusedAs(w.suggest({ ...same, name: "new", claim: "different" }), "SUGGEST_UNWRITABLE_DOCUMENT");
  w.basisVersions.unsplice = false;
  /* Every one of these was stored for R2. */
  const codes = w.rows(`SELECT code FROM suggest_refusals`).map((r) => r.code).sort();
  assert.deepEqual(codes, ["SUGGEST_BOILERPLATE", "SUGGEST_BRANCHES_NOT_INDEPENDENT", "SUGGEST_COMPARISON_INCOMPLETE",
    "SUGGEST_LEG_UNREACHABLE", "SUGGEST_NOT_DIFFERENT", "SUGGEST_PAIR_DOES_NOT_COMPUTE", "SUGGEST_UNWRITABLE_DOCUMENT",
    "SUGGEST_UNWRITABLE_STATE"]);
});

test("R3: C-27.13 refuses every member-only field by name, and a structure composed by an unnamed credential, or by a machine unless it declares exactly one part (DEC-65)", () => {
  const { w } = base();
  for (const f of ["state", "hidden", "state_by", "state_at", "state_reason", "at", "affirmed_parts", "affirmed"]) {
    const r = w.suggest({ name: `n-${f}`, [f]: f === "hidden" ? true : "x" });
    refusedAs(r, "SUGGEST_UNWRITABLE_STATE");
    assert.deepEqual(r.fields, [f]);
  }
  const two = [{ ground: "paper", statement: "one part of the approval" }, { ground: "record", statement: "the other part" }];
  refusedAs(w.suggest({ name: "m2", author: MACHINE, legs: [LEG(DOC), LEG(DOC, { ground: "record" })], grounds: two }), "SUGGEST_UNWRITABLE_STATE");
  refusedAs(w.suggest({ name: "u1", author: "", legs: [LEG(DOC)], grounds: PART }), "SUGGEST_UNWRITABLE_STATE");
  refusedAs(w.suggest({ name: "u0", author: "", legs: [], grounds: PART }), "SUGGEST_UNWRITABLE_STATE");
  /* The licence and nothing wider: one part, a machine composer. */
  assert.equal(w.suggest({ name: "m1", author: MACHINE, legs: [LEG(DOC)], grounds: PART }).ok, true);
  /* A kind that rests on nothing, from a machine, asserts nothing and lands. */
  assert.equal(w.suggest({ name: "m0", author: MACHINE, kind: "level-empty", level: "internet", observed_at: "log:9" }).ok, true);
});

test("R3: C-27.12 names every field carrying filler, and a real sentence quoting a placeholder is not filler", () => {
  const { w } = base();
  const r = w.suggest({ name: "f", description: "n/a", claim: "TODO", legs: [LEG(DOC, { note: "..." })],
                        grounds: [{ ground: "paper", statement: "placeholder" }] });
  refusedAs(r, "SUGGEST_BOILERPLATE");
  assert.deepEqual(r.fields, ["description", "claim", "a statement on 'paper'", "the note on leg 0"]);
  const echo = w.suggest({ name: "e", description: "the same words", claim: "The same words" });
  assert.deepEqual(echo.fields, [word("run-productions.claim_repeats_description")]);
  assert.equal(w.suggest({ name: "q", description: "the contract names the counterparty as 'to be named', which is the defect" }).ok, true);
});

test("R3: C-27.8 refuses a leg with no address, one not in the record or not readable from here, and one the record retired; the retired predicate is citation's and asked whatever the viewer", () => {
  const { w } = base();
  w.project(HIDDEN_PROJ, ["carol"]);
  w.doc(DOC2, "doc2"); w.retired.add(DOC2);
  const r = w.suggest({ name: "l", legs: [LEG(""), LEG("INFO-2026-0099-none"), LEG(HIDDEN_PROJ), LEG(DOC2), LEG(DOC)], grounds: PART });
  refusedAs(r, "SUGGEST_LEG_UNREACHABLE");
  assert.deepEqual(r.legs.map((l) => [l.ord, l.why]), [[0, "no address"],
    [1, word("run-productions.why.record_readable")], [2, word("run-productions.why.record_readable")],
    [3, word("run-productions.why.record_retired")]]);
  assert.ok(w.calls.some((c) => c.name === "retiredNotCitable" && c.a.id === HIDDEN_PROJ),
            "asked of the hidden target too: citability is never viewer-gated");
});

test("R3: C-27.9 refuses an axis that does not resolve and a partition the legs disagree with; the pair is strength's over the candidate's legs", () => {
  const { w } = base();
  w.strength.pair = { ...GRADED, connection: { axis: "connection", state: "graded", grade: "B", weakest: null } };
  const bad = w.suggest({ name: "p1", legs: [LEG(DOC)], grounds: PART });
  refusedAs(bad, "SUGGEST_PAIR_DOES_NOT_COMPUTE");
  assert.deepEqual(bad.pair, { capture: "graded", connection: "graded", testimony: "unrated" });
  w.strength.pair = GRADED;
  const dis = w.suggest({ name: "p2", legs: [LEG(DOC, { ground: "other" })], grounds: PART });
  refusedAs(dis, "SUGGEST_PAIR_DOES_NOT_COMPUTE");
  assert.deepEqual([dis.declared, dis.used], [["paper"], ["other"]]);
  const asked = w.calls.filter((c) => c.name === "candidatePair").at(-1).a;
  assert.equal(asked.inquiry, Q);
  assert.deepEqual(asked.legs, [{ target: DOC, role: "supports", grade: null, grade_axis: null, grade_source: null, ground: "other" }]);
  assert.equal(w.suggest({ name: "p3", legs: [LEG(DOC)], grounds: PART }).ok, true);
});

test("R3: C-27.16 fails closed past 1,000 held versions; C-27.10 compares as the document would store it, name, parentage and clock excluded", () => {
  const { w } = base();
  const text = { description: 'the "ledger" shows it\ntwice', claim: "approved twice" };
  assert.equal(w.suggest({ ...text, name: "first" }).ok, true);
  w.clock.now = "2026-09-28T05:00:00Z";
  const dup = w.suggest({ ...text, name: "second", derived_from: "first" });
  refusedAs(dup, "SUGGEST_NOT_DIFFERENT");
  assert.equal(w.suggest({ ...text, name: "third", claim: "approved three times" }).ok, true, "differs in what it says: lands");
  for (let i = 0; i < 1001; i++)
    w.st.sql.exec(`INSERT INTO inquiry_basis_versions (bundle_id, name, ord, composition) VALUES (?, ?, ?, ?)`, Q2, `v${i}`, i, `name\tv${i}`);
  w.run("RUN-Q2", { context_id: Q2 });
  const many = w.suggest({ target: Q2, run: "RUN-Q2", name: "late" });
  refusedAs(many, "SUGGEST_COMPARISON_INCOMPLETE");
  assert.equal(many.limit, 1000);
});

test("R3: a refusal of the write by basis-versions or promotion is returned unchanged and kept for R2", () => {
  const { w } = base();
  w.basisVersions.refuse = { ok: false, reason: "BASIS_VERSION_REFUSED", check: "C-25.3", findings: [{ code: "X" }] };
  const r = w.suggest({ name: "w" });
  assert.equal(r.reason, "BASIS_VERSION_REFUSED"); assert.equal(r.check, "C-25.3");
  assert.deepEqual(r.findings, [{ code: "X" }]);
  assert.equal(r.code, "BASIS_VERSION_REFUSED");
  assert.equal(w.suggest({ name: "w" }).repeated, true);
  /* N411: the relay states its own verdict and names the code and reason it carries; every other field is the
     provider's, unchanged, whichever of code and reason the provider gave. */
  const given = { ok: false, code: "PROMOTE_REFUSED", check: "C-59.1", translation: "t", detail: "d", findings: [{ code: "Y" }] };
  w.basisVersions.refuse = given;
  const relayed = w.suggest({ name: "w2" });
  const { repeated, evaluated, wrote, target, name, ...rest } = relayed;
  assert.deepEqual([relayed.ok, repeated, evaluated, wrote, target, name], [false, false, true, false, Q, "w2"]);
  assert.deepEqual(rest, { ...given, reason: "PROMOTE_REFUSED" });
  w.basisVersions.refuse = { ok: false, reason: "ONLY_A_REASON" };
  const reasonOnly = w.suggest({ name: "w3" });
  assert.deepEqual([reasonOnly.ok, reasonOnly.code, reasonOnly.reason], [false, "ONLY_A_REASON", "ONLY_A_REASON"]);
  w.basisVersions.refuse = null;
});

test("R4: success writes exactly one version through appendVersion, in state suggested, carrying its run, kind, author and description, with a Session Log entry naming the run; every leg a document leg", () => {
  const { w, cap } = base();
  const before = w.snapshot();
  const r = w.suggest({ name: "r", legs: [LEG(DOC, { grade: "B", grade_axis: "capture", grade_source: "capture", note: "the approval page" })], grounds: PART });
  assert.equal(r.ok, true);
  assert.equal(w.basisVersions.appended.length, 1);
  const a = w.basisVersions.appended[0];
  assert.equal(a.target, Q);
  assert.deepEqual(Object.keys(a.version), ["name", "kind", "description", "claim", "relationship", "derived_from", "run", "author", "at"],
                   "the version row in the order the document writes it (basis-versions R28)");
  assert.equal(a.version.state, undefined); assert.equal(a.version.hidden, undefined);
  assert.deepEqual([a.version.run, a.version.kind, a.author, a.version.description],
                   [RUN, "basis-version", ALICE, "the ledger shows the transfer was approved twice"]);
  assert.match(a.log, /Suggestion/); assert.match(a.log, /carrying run RUN-1/);
  assert.deepEqual(a.legs, [{ target: DOC, role: "supports", ground: "paper", grade: "B", grade_axis: "capture",
                              grade_source: "capture", note: "the approval page", extent_kind: "document", extent_capture: cap }]);
  assert.deepEqual(a.grounds, [{ ground: "paper", asserted_by: ALICE, at: "2026-09-28T01:00:00Z", statement: "the paper trail of the approval" }]);
  /* Nothing else moved: no run, no bound, no capture, no request, no notification — only the question's own rows. */
  const after = w.snapshot();
  const moved = Object.keys(after).filter((t) => after[t] !== before[t]).sort();
  /* and this module's own row of the write (R28, R29: its idem, answer and produced_by). */
  assert.deepEqual(moved.filter((t) => !["bundles", "files", "history", "manifest", "inquiry_basis_versions", "mint_ledger", "bundles_fts", "suggest_writes"].includes(t)), []);
  assert.equal(w.calls.filter((c) => c.name === "consumeBound").length, 0);
});

test("R4: a machine author's grounds are asserted by no one (SUFFICIENCY_UNCLAIMED), the version's author still naming the machine", () => {
  const { w } = base();
  assert.equal(w.suggest({ name: "m", author: MACHINE, legs: [LEG(DOC)], grounds: PART }).ok, true);
  const a = w.basisVersions.appended.at(-1);
  assert.equal(a.author, MACHINE);
  assert.deepEqual(a.grounds.map((g) => g.asserted_by), [SUFFICIENCY_UNCLAIMED]);
});

test("R5: the answer is labelled by source — record read back, derived, call — the label total; composition_of says record, or unread with nulls", () => {
  const { w } = base();
  w.strength.pair = GRADED;
  const r = w.suggest({ name: "the folded\nreading", legs: [LEG(DOC)], grounds: [{ ground: "paper", statement: "the trail" }] });
  assert.equal(r.version, "the folded reading", "the name the record holds, not the one sent");
  assert.deepEqual(Object.keys(r).sort(), Object.keys(r.fields_of).sort(), "total over the answer's keys");
  const bySource = (s) => Object.keys(r.fields_of).filter((k) => r.fields_of[k] === s).sort();
  assert.deepEqual(bySource("record"), ["at", "author", "bundleSha", "composition", "count", "ground_count", "grounds", "kind", "legs", "produced_by", "rowVersion", "run", "state", "target", "version"]);
  assert.deepEqual(bySource("derived"), ["origins_complete", "pair", "shared_origins"]);
  assert.deepEqual(bySource("call"), ["evaluated", "limit", "ok", "origin_limit", "read_back", "repeated", "truncated", "weight", "wrote"]);
  assert.deepEqual([r.weight, r.limit, r.origin_limit, r.truncated, r.evaluated, r.repeated, r.wrote, r.read_back],
                   ["single", 120, 200, false, true, false, true, true]);
  assert.equal(r.composition_of, "record");
  assert.equal(r.composition_grades, "authored");
  assert.deepEqual(r.pair, GRADED);
  assert.deepEqual(r.grounds, ["paper"]); assert.equal(r.count, 1); assert.equal(r.state, "suggested");
  const readBack = w.basisVersions.basisVersions({ id: Q, limit: 1000, viewer: ALICE }).versions.find((v) => v.name === r.version);
  assert.equal(r.composition, readBack.composition);
  /* The read-back empty: nulls, never the candidate. */
  const orig = w.basisVersions.basisVersions;
  w.basisVersions.basisVersions = () => ({ ok: true, versions: [] });
  const u = w.suggest({ name: "unread" });
  w.basisVersions.basisVersions = orig;
  assert.equal(u.composition_of, "unread");
  assert.deepEqual([u.version, u.composition, u.legs, u.grounds, u.ground_count, u.read_back], [null, null, null, null, null, false]);
});

test("R6: SUGGEST_KINDS is exactly §9's five and SUGGEST_LEVELS exactly the four; every kind lands and level-empty lands at each level", async () => {
  const { SUGGEST_KINDS, SUGGEST_LEVELS } = await import("../../../src/run-productions/index.mjs");
  assert.deepEqual(Object.keys(SUGGEST_KINDS).sort(), ["basis-version", "level-empty", "new-edition", "new-inquiry", "sharpen-question"]);
  assert.deepEqual([...SUGGEST_LEVELS], ["meaning", "content", "documents", "internet"]);
  const { w } = base();
  for (const k of Object.keys(SUGGEST_KINDS))
    assert.equal(w.suggest({ name: `k-${k}`, kind: k, level: "content", observed_at: "log:1", claim: `claim for ${k}` }).ok, true, k);
  for (const l of SUGGEST_LEVELS)
    assert.equal(w.suggest({ name: `l-${l}`, kind: "level-empty", level: l, observed_at: `log:${l}`, claim: `nothing at ${l}` }).ok, true, l);
  const le = w.basisVersions.appended.at(-1).version;
  assert.deepEqual([le.level, le.observed_at], ["internet", "log:internet"]);
  const bv = w.basisVersions.appended.find((x) => x.version.kind === "basis-version").version;
  assert.equal(bv.level, undefined, "a level is carried by the empty-level kind only");
});

test("R7: every R1 refusal and R3 verdict is asked before anything is written; a refused suggestion writes only R2's memo", () => {
  const { w } = base();
  const before = w.snapshot();
  refusedAs(w.suggest({ name: "x", description: "tbd" }), "SUGGEST_BOILERPLATE");
  refusedAs(w.suggest({ name: "y", legs: [LEG("INFO-2026-0099-none")], grounds: PART }), "SUGGEST_LEG_UNREACHABLE");
  const after = w.snapshot();
  assert.deepEqual(Object.keys(after).filter((t) => after[t] !== before[t]), ["suggest_refusals"]);
  assert.equal(w.basisVersions.appended.length, 0);
});

test("R8, R15: through the op the target and run are the body's; author, viewer and caller are the control plane's stamps, and a body's are overwritten", async () => {
  const { runProductionsOps } = await import("../../../src/run-productions/index.mjs");
  const { w } = base();
  const url = new URL(`https://plane/?op=suggest&author=${encodeURIComponent(ALICE)}&viewer=${encodeURIComponent(ALICE)}&principal=${encodeURIComponent(ALICE)}`);
  const body = { target: Q, kind: "basis-version", run: RUN, name: "via op", description: "the approval appears twice in the minutes",
                 author: BOB, viewer: "admin", caller: BOB };
  const r = runProductionsOps(w.p, url, body).suggest();
  assert.equal(r.ok, true);
  assert.equal(w.basisVersions.appended.at(-1).author, ALICE, "the stamp, never the body's author");
  assert.deepEqual(w.calls.filter((c) => c.name === "runFor").at(-1).a, { run: RUN, viewer: ALICE });
  /* R15: the run names a principal the stamped caller holds; a body naming the principal does not make it so. */
  const asBob = new URL(`https://plane/?op=suggest&author=${encodeURIComponent(BOB)}&viewer=${encodeURIComponent(BOB)}&principal=${encodeURIComponent(BOB)}`);
  const refused = runProductionsOps(w.p, asBob, { ...body, name: "as bob", caller: ALICE_TOKEN }).suggest();
  assert.equal(refused.code, "AI_RUN_NOT_PRINCIPAL");
});

test("R9: each suggested leg names the capture the run read — the one it names when the record holds it for that document, else the one the record presents; a question leg names none", () => {
  const { w, cap } = base();
  const other = w.doc(DOC2, "doc2 first");
  assert.equal(w.suggest({ name: "pin", legs: [LEG(DOC), LEG(DOC2, { extent_capture: other }), LEG(Q2)], grounds: PART }).ok, true);
  const legs = w.basisVersions.appended.at(-1).legs;
  assert.deepEqual(legs.map((l) => l.extent_capture ?? null), [cap, other, null]);
  const r = w.suggest({ name: "bad pin", legs: [LEG(DOC, { extent_capture: sha("never held") })], grounds: PART });
  refusedAs(r, "SUGGEST_LEG_UNREACHABLE");
  assert.match(r.legs[0].why, /capture it names/);
  refusedAs(w.suggest({ name: "q pin", legs: [LEG(Q2, { extent_capture: cap })], grounds: PART }), "SUGGEST_LEG_UNREACHABLE");
});

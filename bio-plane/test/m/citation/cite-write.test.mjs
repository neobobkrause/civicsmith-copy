/* citation: what `cite` writes and answers (R2, R3), its fixed weight (R7) and the grades it never invents (R8), at the
   module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, STAMP, sha } from "./fixture.mjs";
import { CITE_LOG_SAMPLE } from "../../../src/citation/index.mjs";
import { machinePassageUnchecked } from "../../../src/inquiry/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const ANN = { viewer: V("ann"), owner: "o", author: "member:ann", identity: V("ann") };
/* The detail of an answer whose selection had nothing left to cite, read through the list (R14): `tail` is the part
   that says a part of the document was named and written nowhere, empty when none was named. */
const everyMember = (tail = "") => localize("citation.index.every_member_of_the_selection",
  "every member of the selection was already cited; nothing was written{v1}", { v1: tail });
const NOWHERE_TAIL = localize("citation.index.part_named_written_nowhere", ". The part of the document this call named was written NOWHERE, because no leg was written at all: making an existing citation more specific is a separate authored act on this record's own plan.");

function setup() {
  const w = world();
  const caps = {};
  for (const n of [1, 2, 3]) caps[`INFO-2026-000${n}`] = w.info(`INFO-2026-000${n}`);
  w.info("INFO-2026-0004", { captured: false });
  w.inquiry("INQ-2026-0001");
  w.inquiry("INQ-2026-0002", ["subject_entity: ENT-2026-0001"]);
  return { w, caps, p: w.project(), q: "INQ-2026-0001" };
}

const blockOf = (md, key) => {
  const m = new RegExp(`\\n${key}:\\n((?:  .*\\n)+)`).exec(md);
  return m ? m[1] : null;
};

test("R2: on a project each new member becomes a confirmed cites edge carrying the note, a document's pinned to content.captureFor's capture, a question's and an uncaptured document's not", async () => {
  const { w, caps, p } = setup();
  const h = await w.select(["INFO-2026-0002", "INQ-2026-0001", "INFO-2026-0004", "INFO-2026-0001"]);
  const r = w.cit.cite({ project: p, handle: h, ...ANN, note: "the budget line" });
  assert.equal(r.ok, true);
  assert.equal(blockOf(w.md(p), "references"), [
    ["INFO-2026-0001", caps["INFO-2026-0001"]], ["INFO-2026-0002", caps["INFO-2026-0002"]], ["INFO-2026-0004", null], ["INQ-2026-0001", null],
  ].map(([t, pin]) => `  - rel: cites\n    target: ${t}\n    status: confirmed\n    note: "the budget line"\n`
                      + (pin ? `    extent_capture: ${pin}\n` : "")).join(""));
  assert.deepEqual(r.pinned_captures, { "INFO-2026-0001": caps["INFO-2026-0001"], "INFO-2026-0002": caps["INFO-2026-0002"],
                                         "INFO-2026-0004": null, "INQ-2026-0001": null });
  assert.deepEqual(w.fm(p).references.map((e) => [e.target, e.status]).sort(),
                   [["INFO-2026-0001", "confirmed"], ["INFO-2026-0002", "confirmed"], ["INFO-2026-0004", "confirmed"], ["INQ-2026-0001", "confirmed"]]);
});

test("R2, R8: on an inquiry each new member becomes a leg with the member's role, graded from inquiry.earned only where earned (connection, resolution), else carrying no grade, axis or source; a document leg pinned; its target joins references once", async () => {
  const { w, caps } = setup();
  const q = "INQ-2026-0002";
  /* Already referenced under another relation: not referenced a second time. */
  w.put(q, w.md(q).replace("references: []", "references:\n  - rel: mentions\n    target: INFO-2026-0003\n    status: confirmed\n    note: \"\""));
  w.earned["INFO-2026-0001"] = { grade: "A", why: "resolved to the subject at A" };
  const h = await w.select(["INFO-2026-0001", "INFO-2026-0003", "INQ-2026-0001"]);
  const r = w.cit.cite({ project: q, handle: h, ...ANN, role: "cuts_against", note: "contradicts" });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(w.earnedCalls.at(-1), { subject: "ENT-2026-0001", targets: ["INFO-2026-0001", "INFO-2026-0003", "INQ-2026-0001"] });
  assert.equal(blockOf(w.md(q), "basis"), [
    `  - target: INFO-2026-0001\n    role: cuts_against\n    grade: A\n    grade_axis: connection\n    grade_source: resolution\n    note: "contradicts"\n    extent_capture: "${caps["INFO-2026-0001"]}"\n`,
    `  - target: INFO-2026-0003\n    role: cuts_against\n    note: "contradicts"\n    extent_capture: "${caps["INFO-2026-0003"]}"\n`,
    `  - target: INQ-2026-0001\n    role: cuts_against\n    note: "contradicts"\n`,
  ].join(""));
  const refs = w.fm(q).references;
  assert.deepEqual(refs.map((e) => [e.rel, e.target]), [["mentions", "INFO-2026-0003"], ["cites", "INFO-2026-0001"], ["cites", "INQ-2026-0001"]]);
  assert.deepEqual(r.legs, [
    { target: "INFO-2026-0001", role: "cuts_against", grade: "A", grade_axis: "connection", grade_source: "resolution",
      why: "resolved to the subject at A", pinned_capture: caps["INFO-2026-0001"] },
    { target: "INFO-2026-0003", role: "cuts_against", grade: null, grade_axis: null, grade_source: null, why: null,
      pinned_capture: caps["INFO-2026-0003"] },
    { target: "INQ-2026-0001", role: "cuts_against", grade: null, grade_axis: null, grade_source: null, why: null, pinned_capture: null },
  ]);
  assert.deepEqual([r.citingObjectType, r.role, r.gradesFilled, r.gradesUndetermined], ["inquiry", "cuts_against", 1, 2]);
});

test("R8: an earned D, a letterless answer or no registry entry leaves the leg ungraded; the subject is read from the document's bytes", async () => {
  const { w, q } = setup();
  w.earned["INFO-2026-0001"] = { grade: null, why: "nothing earned" };
  const h = await w.select(["INFO-2026-0001", "INFO-2026-0002"]);
  const r = w.cit.cite({ project: q, handle: h, ...ANN, role: "supports" });
  assert.deepEqual(r.legs.map((l) => l.grade), [null, null]);
  assert.doesNotMatch(blockOf(w.md(q), "basis"), /grade/);
  assert.equal(w.earnedCalls.at(-1).subject, null, "INQ-2026-0001 names no subject");
});

test("R2: a document leg that names a content id is not pinned again; a named part is written on the leg in the grammar's fixed order and answered as written", async () => {
  const { w, q } = setup();
  const h = await w.select(["INFO-2026-0001"]);
  const id = "b".repeat(64);
  const withId = w.cit.cite({ project: q, handle: h, ...ANN, role: "supports", extent: { content_id: id } });
  assert.equal(withId.ok, true, JSON.stringify(withId).slice(0, 300));
  assert.deepEqual([withId.legs[0].pinned_capture, withId.legs[0].content_id, withId.legs[0].extent], [null, id, { kind: "document" }]);
  assert.match(blockOf(w.md(q), "basis"), new RegExp(`    content_id: "${id}"\\n$`));
  const q2 = w.inquiry("INQ-2026-0003");
  const r = w.cit.cite({ project: q2, handle: h, ...ANN, role: "supports",
                        extent: { extent_page: " 3 ", extent_kind: "pdf-page", extent_rect: "[1, 2.5, 30, 40]", extent_ref: "table 2" } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const leg = blockOf(w.md(q2), "basis").split("\n").slice(2).filter(Boolean);
  assert.deepEqual(leg, ['    extent_kind: "pdf-page"', `    extent_capture: "${w.content.captureFor("INFO-2026-0001")}"`,
                         "    extent_page: 3", "    extent_rect: [1, 2.5, 30, 40]", '    extent_ref: "table 2"']);
  assert.deepEqual(r.legs[0].extent, { kind: "pdf-page", ref: "table 2", page: 3, rect: [1, 2.5, 30, 40] });
});

test("R2: over-strictness — a cite naming no part (or only empty part fields) writes exactly the leg a part-less act writes, with no extent line", async () => {
  const { w, caps } = setup();
  const q1 = w.inquiry("INQ-2026-0010"), q2 = w.inquiry("INQ-2026-0011");
  const h = await w.select(["INFO-2026-0001"]);
  const a = w.cit.cite({ project: q1, handle: h, ...ANN, role: "supports", note: "n" });
  const b = w.cit.cite({ project: q2, handle: h, ...ANN, role: "supports", note: "n", extent: { extent_kind: "", extent_page: "  " } });
  assert.equal(blockOf(w.md(q1), "basis"), `  - target: INFO-2026-0001\n    role: supports\n    note: "n"\n    extent_capture: "${caps["INFO-2026-0001"]}"\n`);
  assert.equal(blockOf(w.md(q2), "basis"), blockOf(w.md(q1), "basis"));
  assert.equal("extent" in a.legs[0], false);
  assert.equal("extent" in b.legs[0], false);
});

test("R2: a member already cited is reported, not rewritten; with nothing new the answer is ok, cited empty, nothing written; a named part is said to have been written nowhere", async () => {
  const { w, p, q } = setup();
  const one = await w.select(["INFO-2026-0001"]);
  w.cit.cite({ project: p, handle: one, ...ANN });
  w.cit.cite({ project: q, handle: one, ...ANN, role: "supports" });
  const two = await w.select(["INFO-2026-0002", "INFO-2026-0001"]);
  const r = w.cit.cite({ project: p, handle: two, ...ANN });
  assert.deepEqual([r.cited, r.alreadyCited], [["INFO-2026-0002"], ["INFO-2026-0001"]]);
  assert.equal(w.fm(p).references.length, 2);
  for (const [obj, extra] of [[p, {}], [q, { role: "supports" }]]) {
    const snap = w.snapshot();
    const head = w.record.head(obj);
    const none = w.cit.cite({ project: obj, handle: one, ...ANN, ...extra });
    assert.deepEqual([none.ok, none.cited, none.alreadyCited, none.severed, none.bundleSha, none.rowVersion],
                     [true, [], ["INFO-2026-0001"], [], head.bundleSha, null]);
    assert.equal(none.detail, everyMember());
    assert.deepEqual(w.snapshot(), snap, "nothing written");
  }
  /* On a question, a target it merely references is not "already cited": the leg is written. */
  const q2 = w.inquiry("INQ-2026-0005");
  w.put(q2, w.md(q2).replace("references: []", "references:\n  - rel: cites\n    target: INFO-2026-0003\n    status: confirmed\n    note: \"\""));
  const three = await w.select(["INFO-2026-0003"]);
  assert.deepEqual(w.cit.cite({ project: q2, handle: three, ...ANN, role: "supports" }).cited, ["INFO-2026-0003"]);
  const page1 = { extent_kind: "pdf-page", extent_page: "1" };
  assert.deepEqual(w.cit.cite({ project: q2, handle: three, ...ANN, role: "supports", extent: page1 }).cited, ["INFO-2026-0003"], "another part is a new leg (R22)");
  const nowhere = w.cit.cite({ project: q2, handle: three, ...ANN, role: "supports", extent: page1 });
  assert.deepEqual([nowhere.ok, nowhere.cited], [true, []]);
  assert.equal(nowhere.detail, everyMember(NOWHERE_TAIL));
});

test("R3: the write moves last_updated and appends one Session Log entry naming the author, the selection, at most 20 ids and a count of the rest, and the note; it counts records, a question among them, never calling them all information", async () => {
  const w = world();
  const ids = [];
  for (let i = 1; i <= 23; i++) { const id = `INFO-2026-${String(i).padStart(4, "0")}`; w.info(id, { captured: false }); ids.push(id); }
  const p = w.project();
  const h = await w.select(ids);
  const r = w.cit.cite({ project: p, handle: h, ...ANN, note: "all of them" });
  assert.equal(r.ok, true);
  assert.equal(w.fm(p).last_updated, STAMP);
  assert.equal(w.record.head(p).rowVersion, 2);
  const log = w.md(p).split("## Session Log\n\n")[1];
  assert.equal(log, localize("citation.index.session_cited_many_records", "### Session {when} | Cited {count} records | {who}\n", { when: STAMP, count: "23", who: "member:ann" })
    + localize("citation.index.trigger_selection_handle", "Trigger: selection {handle}\n", { handle: h })
    + localize("citation.index.changes_cites_edges_added", "Changes: cites edges added to {listed}.{note}\n",
      { listed: `${ids.slice(0, CITE_LOG_SAMPLE).join(", ")}, and 3 more`, note: localize("citation.index.log_note", " Note: {note}.", { note: "all of them" }) }));
  assert.equal(CITE_LOG_SAMPLE, 20);
  /* One record, no note; the author defaults to "member". */
  const p2 = w.project("Second");
  const one = await w.select(["INFO-2026-0001"]);
  w.cit.cite({ project: p2, handle: one, viewer: V("ann"), owner: "o", identity: V("ann") });
  assert.equal(w.md(p2).split("## Session Log\n\n")[1],
    `### Session ${STAMP} | Cited 1 record | member\nTrigger: selection ${one}\nChanges: cites edges added to INFO-2026-0001.\n`);
  /* A question cited by a case is a record, not "an Information record". */
  w.inquiry("INQ-2026-0001");
  const p3 = w.project("Third");
  const qs = await w.select(["INQ-2026-0001"]);
  assert.equal(w.cit.cite({ project: p3, handle: qs, ...ANN }).ok, true);
  assert.match(w.md(p3), new RegExp(`### Session ${STAMP} \\| Cited 1 record \\| member:ann\\n`));
  assert.doesNotMatch(w.md(p3), /Information record/);
});

test("R3: on an inquiry the entry states the role and how many legs were graded and left undetermined, inside the document's existing Session Log", async () => {
  const { w, q } = setup();
  w.earned["INFO-2026-0002"] = { grade: "B", why: "w" };
  const h = await w.select(["INFO-2026-0001", "INFO-2026-0002"]);
  w.cit.cite({ project: q, handle: h, ...ANN, role: "supports", note: "both" });
  const md = w.md(q);
  assert.match(md, new RegExp(`## Session Log\\n\\n### Session ${STAMP} \\| Rested this question on 2 records \\(supports\\) \\| member:ann\\n`
    + `Trigger: selection ${h}\\nChanges: basis legs added for INFO-2026-0001, INFO-2026-0002, each with role supports\\. `
    + `Grades: 1 filled from the record's own resolutions to this question's subject; 1 left undetermined and stated\\. Note: both\\.\\n\\n## Review Notes`));
});

test("R3: the entry says the set had moved when the selection's answer changed since it was made (report weight proceeds)", async () => {
  const { w, p } = setup();
  const h = await w.select(["INFO-2026-0001", "INFO-2026-0002"]);
  w.revise("INFO-2026-0002", w.md("INFO-2026-0002").replace('title: "Document INFO-2026-0002"', 'title: "Renamed"'));
  const r = w.cit.cite({ project: p, handle: h, ...ANN });
  assert.equal(r.ok, true);
  assert.equal(r.moved, true);
  assert.equal(r.drift.revised.length, 1);
  assert.match(w.md(p), new RegExp(`Trigger: selection ${h} \\(the set had moved since it was made; citing is report-weight and proceeded\\)\\n`));
});

test("R3: the answer carries cited, alreadyCited, drift, moved, bundleSha, rowVersion, the gate and its expiry, and question (null when none was named); pinned_captures only on a project; the per-leg fields only on an inquiry", async () => {
  const { w, p, q } = setup();
  const h = await w.select(["INFO-2026-0001"]);
  const onP = w.cit.cite({ project: p, handle: h, ...ANN });
  const head = w.record.head(p);
  assert.deepEqual(Object.keys(onP).sort(), ["alreadyCited", "bundleSha", "cited", "drift", "expires", "gate", "handle", "moved",
    "ok", "pinned_captures", "project", "question", "rowVersion", "severed", "weight"].sort());
  assert.equal(onP.question, null);
  assert.deepEqual([onP.bundleSha, onP.rowVersion, onP.weight], [head.bundleSha, head.rowVersion, "report"]);
  const onQ = w.cit.cite({ project: q, handle: h, ...ANN, role: "supports" });
  assert.deepEqual(Object.keys(onQ).sort(), ["alreadyCited", "bundleSha", "cited", "citingObjectType", "drift", "expires", "gate",
    "gradesFilled", "gradesUndetermined", "handle", "legs", "moved", "ok", "project", "question", "role", "rowVersion", "severed", "weight"].sort());
  assert.equal(onQ.question, null);
  assert.equal(typeof onQ.expires, "string");
});

test("R2: every other live file of the citing object is carried forward untouched", async () => {
  const w = world();
  w.info("INFO-2026-0001");
  const c = { path: "snapshots/kept.txt", text: "kept bytes", sha: sha("kept bytes") };
  const q = w.inquiry("INQ-2026-0001");
  w.put(q, w.md(q), { captures: [c] });
  const before = w.record.livePaths(q).filter((x) => x !== "bundle.md").map((x) => [x, w.record.readFile(q, x).sha256]);
  const h = await w.select(["INFO-2026-0001"]);
  assert.equal(w.cit.cite({ project: q, handle: h, ...ANN, role: "supports" }).ok, true);
  assert.deepEqual(w.record.livePaths(q).filter((x) => x !== "bundle.md").map((x) => [x, w.record.readFile(q, x).sha256]), before);
  assert.ok(before.length >= 2);
});

test("R7: weight is not a parameter — cite is report whatever the caller sends: a moved selection still cites", async () => {
  const { w, p } = setup();
  const h = await w.select(["INFO-2026-0001"]);
  w.revise("INFO-2026-0001", w.md("INFO-2026-0001").replace('title: "Document INFO-2026-0001"', 'title: "Moved"'));
  const r = w.cit.cite({ project: p, handle: h, ...ANN, weight: "refuse" });
  assert.deepEqual([r.ok, r.weight, r.moved], [true, "report", true]);
});

/* T42 (N834; K2496, K2608): no seam of citation's own. A leg `cite` writes onto a question passes inquiry's check (its
   R11), which asks the one machine-passage read (inquiry R62, registered by run-productions R25); its refusal is
   answered unchanged (R1). Driven through the real inquiry, booted on the host, with the read registered by the test. */
test("R1 (T42): through the real inquiry, the machine-passage read's refusal (run-productions R25's PROPOSAL_NOT_TAKEN_UP) is answered unchanged with the handle and drift, nothing written; a read that throws or answers anything else is inquiry R62's MACHINE_PASSAGE_UNCHECKED; a read answering null lets the leg land", async () => {
  const w = world({ inquiry: true });
  const cap = w.info("INFO-2026-0001-doc");
  const q = w.inquiry("INQ-2026-0001-q");
  const p = w.project();
  let answer = () => null;
  const calls = [];
  const reg = w.inquiryModule.onMachinePassage("run-productions", (a) => { calls.push(a); return answer(a); });
  assert.ok(!reg || reg.ok !== false, `registered: ${JSON.stringify(reg)}`);
  const h = await w.select(["INFO-2026-0001-doc"]);
  const taken = { ok: false, reason: "PROPOSAL_NOT_TAKEN_UP", code: "PROPOSAL_NOT_TAKEN_UP", check: "C-104.32",
                  legs: [{ ord: 0, target: "INFO-2026-0001-doc", proposal: "PROP-1" }],
                  detail: "this passage was proposed by a run and you have not taken it up" };
  answer = () => taken;
  const snap = w.snapshot();
  const r = w.cit.cite({ project: q, handle: h, ...ANN, role: "supports" });
  assert.equal(r.ok, false);
  /* Unchanged: every field of the read's refusal stands as it answered, with the handle and drift beside it. */
  for (const [k, v] of Object.entries(taken)) assert.deepEqual(r[k], v, k);
  assert.deepEqual([r.project, r.handle, r.drift.kind], [q, h, "enumerated"]);
  assert.deepEqual(w.snapshot(), snap, "nothing written");
  /* The read was asked once, of the leg this cite adds, with the act's author. */
  assert.equal(calls.length, 1);
  assert.deepEqual([calls[0].author, calls[0].viewer], ["member:ann", "member:ann"], "the viewer is the author (K2648)");
  assert.deepEqual(calls[0].legs.map((l) => [l.target, l.extent_capture]), [["INFO-2026-0001-doc", cap]]);
  /* Fail closed: a read that throws, or answers anything but null or a refusal, is MACHINE_PASSAGE_UNCHECKED (C-2.20). */
  for (const odd of [() => { throw new Error("cannot read acceptances"); }, () => "yes", () => ({ ok: true }), () => undefined]) {
    answer = odd;
    const u = w.cit.cite({ project: q, handle: h, ...ANN, role: "supports" });
    assert.deepEqual([u.ok, u.reason, u.check, u.handle, u.project], [false, "MACHINE_PASSAGE_UNCHECKED", "C-2.20", h, q], String(odd));
    assert.equal(typeof u.drift, "object");
    /* inquiry's one spelling of the refusal (its R62, K231), relayed as it came. */
    const { detail, ...spelled } = machinePassageUnchecked("x", { legs: [0] });
    assert.deepEqual({ ...u, detail: undefined, project: undefined, handle: undefined, drift: undefined },
                     { ...spelled, detail: undefined, project: undefined, handle: undefined, drift: undefined });
    assert.deepEqual(w.snapshot(), snap, "nothing written");
  }
  /* The same refusal through a found passage: handle null, drift false. */
  const [match] = w.find("INFO-2026-0001-doc", "budget", { pages: { [cap]: ["The budget line."] } });
  answer = () => taken;
  const f = w.cit.cite({ project: q, found: match, ...ANN, role: "supports" });
  for (const [k, v] of Object.entries(taken)) assert.deepEqual(f[k], v, k);
  assert.deepEqual([f.handle, f.drift], [null, false]);
  /* A case's cites edge is not a leg: the read is not asked and the edge lands. */
  const asked = calls.length;
  const onP = w.cit.cite({ project: p, handle: h, ...ANN });
  assert.equal(onP.ok, true, JSON.stringify(onP).slice(0, 300));
  assert.equal(calls.length, asked);
  /* Negative control: the read answering null, the leg lands. */
  answer = () => null;
  const ok = w.cit.cite({ project: q, handle: h, ...ANN, role: "supports" });
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.deepEqual(w.fm(q).basis.map((l) => l.target), ["INFO-2026-0001-doc"]);
});

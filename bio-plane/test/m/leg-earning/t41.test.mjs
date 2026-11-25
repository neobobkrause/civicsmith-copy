/* T41-14: the projects drawing on a question, paged (R13) and as a viewer may be shown them (R14); a passage of an AI
   transcription's capture ceiling (R15); and the authored note's route words (R16). Each with its negative control
   (K874). Driven at the interface over the real modules (`fixture.mjs`). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, inquiryMd } from "./fixture.mjs";
import { PROJECTS_DRAWING_MAX, PROJECTS_PAGE_MAX, PROJECTS_PAGE_DEFAULT, PROJECTS_SHOWN_MAX, AUTHORED_ROUTE_WORDS, legCapped }
  from "../../../src/leg-earning/index.mjs";
import { ARCHIVE_VIA, UPLOAD_VIA, DOORBELL_VIA } from "../../../src/provenance/index.mjs";
import { EARNED_CAPTURE_CEILING, BASIS_GRADES } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const Q = "INQ-2026-4101-q";

/* Every page of R13 for `id` at `limit`, followed by its cursor. */
const allPages = (w, id, limit) => {
  const pages = [];
  let after = null;
  for (let i = 0; i < 1000; i++) {
    const p = w.k.projectsDrawingOnPaged({ id, after, limit });
    assert.equal(p.ok, true, JSON.stringify(p));
    pages.push(p);
    if (!p.cursor) return pages;
    after = p.cursor;
  }
  throw new Error("no end");
};

/* ------------------------------------------------------------------------------------------------ R13 */

test("R13 projectsDrawingOnPaged answers every project drawing on the question, a page at a time by id with cursor; severed citers and non-projects take no slot", () => {
  const w = world(); w.member("alice");
  w.inquiry(Q);
  const drawing = [];
  for (let i = 0; i < 7; i++) {
    if (i % 2) w.project(`Severed ${i}`, "alice", [{ target: Q, status: "severed" }]);
    drawing.push(w.project(`Draws ${i}`, "alice", [Q]));
  }
  w.inquiry("INQ-2026-4102-r", { legs: [{ target: Q }] });   /* a cites reference from a question: not a project */
  drawing.sort();
  const pages = allPages(w, Q, 3);
  assert.deepEqual(pages.map((p) => p.projects), [drawing.slice(0, 3), drawing.slice(3, 6), drawing.slice(6)]);
  assert.deepEqual(pages.map((p) => p.cursor), [drawing[2], drawing[5], null]);
  assert.ok(pages.every((p) => p.limit === 3 && p.id === Q));
  /* negative control: a page that ends exactly at the last project names no cursor */
  const exact = w.k.projectsDrawingOnPaged({ id: Q, limit: 7 });
  assert.deepEqual([exact.projects, exact.cursor], [drawing, null]);
  const after = w.k.projectsDrawingOnPaged({ id: Q, after: drawing[6] });
  assert.deepEqual([after.projects, after.cursor], [[], null]);
  assert.equal(w.k.projectsDrawingOnPaged({ id: "INQ-2026-4199-none" }).projects.length, 0);
  assert.equal(w.k.projectsDrawingOnPaged({}).reason, "NO_ID");
});

test("R13 the limit is at most 500, default 100; R7's 32-bound stays for its callers while the pages answer every project", () => {
  const w = world(); w.member("alice");
  w.inquiry(Q);
  const all = Array.from({ length: 40 }, (_, i) => w.project(`P${i}`, "alice", [Q])).sort();
  assert.deepEqual([PROJECTS_PAGE_MAX, PROJECTS_PAGE_DEFAULT], [500, 100]);
  assert.equal(w.k.projectsDrawingOnPaged({ id: Q, limit: 100000 }).limit, PROJECTS_PAGE_MAX);
  for (const bad of [undefined, null, 0, -3, 2.5, "10"])
    assert.equal(w.k.projectsDrawingOnPaged({ id: Q, limit: bad }).limit, PROJECTS_PAGE_DEFAULT, String(bad));
  const whole = w.k.projectsDrawingOnPaged({ id: Q });
  assert.deepEqual([whole.projects, whole.cursor], [all, null], "every project, past R7's bound");
  const r7 = w.k.projectsDrawingOn(Q);
  assert.deepEqual([[...r7], r7.truncated, PROJECTS_DRAWING_MAX], [all.slice(0, 32), true, 32]);
  assert.deepEqual(allPages(w, Q, 9).flatMap((p) => p.projects), all);
});

/* ------------------------------------------------------------------------------------------------ R14 */

/* A project by `owner` citing `cites`, set discoverable unless `hidden` (a new project is hidden). */
const proj = (w, title, owner, cites, { hidden = false } = {}) => {
  const id = w.project(title, owner, cites);
  if (!hidden) {
    const r = w.membership.projectVisibilitySet({ projectId: id, setting: "discoverable", by: owner, viewer: V(owner) });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  }
  return id;
};

test("R14 projectsShownOn answers the non-hidden projects drawing on a question, each {id, name} as the viewer's sight lets her see it; a hidden project is never answered, named or counted, even to its participants", () => {
  const w = world(); w.member("alice"); w.member("bob"); w.member("carol");
  w.inquiry(Q);
  const shown = [proj(w, "Open by Alice", "alice", [Q]), proj(w, "Open by Bob", "bob", [Q])];
  const before = { carol: w.k.projectsShownOn({ id: Q, viewer: V("carol") }), alice: w.k.projectsShownOn({ id: Q, viewer: V("alice") }) };
  const hidden = [proj(w, "Hidden by Alice", "alice", [Q], { hidden: true }), proj(w, "Hidden by Bob", "bob", [Q], { hidden: true })];
  proj(w, "Severed", "bob", [{ target: Q, status: "severed" }]);
  const want = shown.map((id) => ({ id, name: w.row(`SELECT title FROM bundles WHERE bundle_id=?`, id).title })).sort((a, b) => (a.id < b.id ? -1 : 1));
  assert.deepEqual(want.map((p) => p.name).sort(), ["Open by Alice", "Open by Bob"]);
  for (const who of ["carol", "alice", "bob"]) {
    const r = w.k.projectsShownOn({ id: Q, viewer: V(who) });
    assert.deepEqual(r, { ok: true, id: Q, projects: want, truncated: false }, who);
    assert.ok(!JSON.stringify(r).includes("Hidden") && hidden.every((h) => !JSON.stringify(r).includes(h)), who);
  }
  /* the same answer whether or not a hidden project draws on it */
  assert.deepEqual(w.k.projectsShownOn({ id: Q, viewer: V("carol") }), before.carol);
  assert.deepEqual(w.k.projectsShownOn({ id: Q, viewer: V("alice") }), before.alice);
  /* negative control: the paged read (in-process, over every project) does see them */
  assert.deepEqual(w.k.projectsDrawingOnPaged({ id: Q }).projects.length, 4);
});

test("R14 R11 a viewer who may not see the question is answered exactly as for an absent one; no id is NO_ID", () => {
  const w = world(); w.member("alice"); w.member("bob");
  const P = proj(w, "Alice's work", "alice", []);
  /* a question inside a hidden project bob is not in */
  const inside = "INQ-2026-4103-inside";
  w.inquiry(inside, { extra: [`project: ${P}`] });
  proj(w, "Draws", "alice", [inside]);
  const absent = (id) => ({ ok: false, reason: "NO_SUCH_BUNDLE", target: id });
  assert.equal(w.membership.inSight(inside, V("alice")), true, "the fixture places the question in the project");
  assert.deepEqual(w.k.projectsShownOn({ id: inside, viewer: V("bob") }), absent(inside));
  assert.deepEqual(w.k.projectsShownOn({ id: "INQ-2026-4199-none", viewer: V("bob") }), absent("INQ-2026-4199-none"));
  assert.deepEqual(w.k.projectsShownOn({ id: Q, viewer: null }), absent(Q));
  assert.equal(w.k.projectsShownOn({ id: inside, viewer: V("alice") }).projects.length, 1, "her own sight shows it");
  assert.equal(w.k.projectsShownOn({ viewer: V("alice") }).reason, "NO_ID");
});

test("R14 at most 200 shown, the first by id, truncated only when one more would be shown: hidden projects past the bound never set it", () => {
  const w = world(); w.member("alice"); w.member("carol");
  w.inquiry(Q);
  assert.equal(PROJECTS_SHOWN_MAX, 200);
  const open = Array.from({ length: PROJECTS_SHOWN_MAX }, (_, i) => proj(w, `Open ${i}`, "alice", [Q])).sort();
  for (let i = 0; i < 3; i++) proj(w, `Hidden ${i}`, "alice", [Q], { hidden: true });
  const at = w.k.projectsShownOn({ id: Q, viewer: V("carol") });
  assert.deepEqual([at.projects.map((p) => p.id), at.truncated], [open, false], "200 shown and hidden ones beyond: not truncated");
  const extra = proj(w, "One more", "alice", [Q]);
  const over = w.k.projectsShownOn({ id: Q, viewer: V("carol") });
  assert.deepEqual([over.projects.map((p) => p.id), over.truncated], [[...open, extra].sort().slice(0, 200), true]);
});

/* ------------------------------------------------------------------------------------------------ R15 */

const aiChain = (pages = null) => {
  const extent = pages ? { extent: { kind: "pages", pages } } : {};
  return [{ step: "pixels", cap: null, ...extent },
          { step: "ai_transcription", engine: "claude-reader", version: "1", cap: null, confidence: { basis: "none" }, ...extent }];
};
const ocrPages = (pages, cap) => [{ step: "pixels", extent: { kind: "pages", pages } },
  { step: "ocr", engine: "tesseract", version: "5.3.4", cap, confidence: { basis: "none" }, extent: { kind: "pages", pages } }];

/* An inquiry citing page `p` of each document (and the whole document when `whole`), answering its content ids. */
let qn = 0;
const pagesCited = (w, cites) => {
  const id = `INQ-2026-42${String(++qn).padStart(2, "0")}-p`;
  const legs = cites.map(([doc, page]) => page === "whole"
    ? [`  - target: ${doc}`, "    role: supports"]
    : [`  - target: ${doc}`, "    role: supports", "    extent_kind: pdf-page", `    extent_page: ${page}`]).flat();
  const r = w.promoteInquiry(id, inquiryMd(id, { refs: [...new Set(cites.map(([d]) => d))].map((t) => ({ target: t })),
                                                 extra: ["basis:", ...legs] }));
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  return { id, cids: r.content.map((c) => c.content_id) };
};
const attest = (w, capSha, member, page) => {
  const r = w.content.attestText({ captureSha: capSha, member, at: "2026-09-28T00:00:00Z",
    extent: page == null ? { kind: "document" } : { kind: "page", page }, viewer: V(member), note: "Checked against the page." });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
};

test("R15 a passage of an AI transcription earns an undetermined capture ceiling, the empty level named; legCapped refuses every letter against it", () => {
  const w = world(); w.member("sam");
  const DOC = "INFO-2026-4201-ai";
  w.doc(DOC, ["read by an AI"], { chain: aiChain() });
  const { id, cids: [p0, whole] } = pagesCited(w, [[DOC, 0], [DOC, "whole"]]);
  const e = w.k.earnedBasis({ id, viewer: "admin" }).earned;
  assert.equal(e.capture[DOC].grade, null, "the document is undetermined (text-chain R104 through captureBound)");
  for (const cid of [p0, whole]) {
    const c = e.content[cid].capture;
    assert.deepEqual([c.grain, c.mode, c.grade, c.determined, c.undetermined_because],
                     ["passage", "ceiling", null, false, "CAPTURE_FIDELITY_UNMEASURED"], cid);
    assert.match(c.empty_level, /AI's reading of the page/);
    assert.match(c.why, /op=attesttext/);
    for (const g of BASIS_GRADES) assert.deepEqual(legCapped(g, c, DOC), { grade: null, why: c.why });
  }
});

test("R15 at an extent a member attested against the page the passage earns the capture's own grade; elsewhere it stays undetermined", () => {
  const w = world(); w.member("sam");
  const DIRECT = "INFO-2026-4202-ai-direct", REPLAY = "INFO-2026-4203-ai-replay";
  const [dCap] = w.doc(DIRECT, ["direct AI pages"], { chain: aiChain() });
  const [rCap] = w.doc(REPLAY, ["replayed AI pages"], { chain: aiChain(), via: ARCHIVE_VIA });
  const { id, cids: [d1, d2, r1] } = pagesCited(w, [[DIRECT, 1], [DIRECT, 2], [REPLAY, 1]]);
  attest(w, dCap, "sam", 1); attest(w, rCap, "sam", 1);
  const e = w.k.earnedBasis({ id, viewer: "admin" }).earned;
  const c1 = e.content[d1].capture;
  assert.deepEqual([c1.grain, c1.grade, c1.determined, c1.determinant, c1.by], ["passage", EARNED_CAPTURE_CEILING, true, "attestation", ["sam"]]);
  assert.equal(c1.stated_as, undefined, "a fetched route: measured, never stated as authored");
  /* the capture's own grade, not the attestation's ceiling: a replayed capture earns its route's letter */
  const replayGrade = w.prov.captureGrade(rCap).grade;
  assert.notEqual(replayGrade, EARNED_CAPTURE_CEILING);
  assert.deepEqual([e.content[r1].capture.grade, e.content[r1].capture.determined], [replayGrade, true]);
  assert.equal(legCapped(EARNED_CAPTURE_CEILING, e.content[r1].capture, REPLAY).grade, replayGrade);
  /* negative control: page 2 was not attested */
  assert.deepEqual([e.content[d2].capture.grade, e.content[d2].capture.undetermined_because], [null, "CAPTURE_FIDELITY_UNMEASURED"]);
  /* the document grain is unchanged by a page's attestation */
  assert.equal(e.capture[DIRECT].grade, null);
});

test("R15 an attested AI passage of an uploaded capture earns its letter stated as authored; an unruled route stays undetermined", () => {
  const w = world(); w.member("sam");
  const UP = "INFO-2026-4204-ai-upload", PIGEON = "INFO-2026-4205-ai-pigeon";
  const [uCap] = w.doc(UP, ["uploaded AI pages"], { chain: aiChain(), via: null });
  w.prov.recordReceipt({ address: `upload:${UP}`, addressNorm: `upload:${UP}`, captureSha: uCap, retrieved: "2026-09-27T00:00:00Z",
                         via: UPLOAD_VIA, by: "member:sam", statement: "From the clerk's binder." });
  const [pCap] = w.doc(PIGEON, ["pigeon AI pages"], { chain: aiChain(), via: "carrier-pigeon" });
  const { id, cids: [u, p] } = pagesCited(w, [[UP, "whole"], [PIGEON, "whole"]]);
  attest(w, uCap, "sam", null); attest(w, pCap, "sam", null);
  const e = w.k.earnedBasis({ id, viewer: "admin" }).earned;
  assert.deepEqual([e.content[u].capture.grade, e.content[u].capture.stated_as, e.content[u].capture.route_basis],
                   [EARNED_CAPTURE_CEILING, "authored", ["CAPTURE_RECEIVED_NOT_FETCHED"]]);
  assert.match(e.content[u].capture.why, /uploaded by a member/);
  assert.deepEqual([e.content[p].capture.grade, e.content[p].capture.undetermined_because], [null, "CAPTURE_GRADE_VIA_UNRULED"]);
});

test("R15 negative controls: a passage no AI step covers keeps content's document pointer, and an answer asked with no content ids is unchanged", () => {
  const w = world(); w.member("sam");
  const MIXED = "INFO-2026-4206-mixed", OCR = "INFO-2026-4207-ocr";
  /* pages 0–1 OCR'd at C, page 2 read by an AI */
  w.doc(MIXED, ["mixed pages"], { chain: [...ocrPages([0, 1], "C"), ...aiChain([2]).slice(1)] });
  w.doc(OCR, ["ocr pages"], { chain: ocrPages([0, 1], "C") });
  const { id, cids: [m0, m2, o0] } = pagesCited(w, [[MIXED, 0], [MIXED, 2], [OCR, 0]]);
  const e = w.k.earnedBasis({ id, viewer: "admin" }).earned;
  for (const cid of [m0, o0]) assert.equal(e.content[cid].capture.grain, "document", cid);
  assert.equal(e.content[m2].capture.grain, "passage");
  assert.equal(w.k.earned(null, [MIXED, OCR]).earned.content, undefined);
});

/* ------------------------------------------------------------------------------------------------ R16 */

test("R16 the authored note names each route in words: the doorbell's receipt, a member's upload, no route recorded; never an upload as the doorbell", () => {
  const w = world();
  const BELL = "INFO-2026-4301-bell", UP = "INFO-2026-4302-up", NONE = "INFO-2026-4303-none", BOTH = "INFO-2026-4304-both";
  w.doc(BELL, ["bell"], { via: DOORBELL_VIA });
  const [u] = w.doc(UP, ["up"], { via: null });
  w.prov.recordReceipt({ address: `upload:${UP}`, addressNorm: `upload:${UP}`, captureSha: u, retrieved: "2026-09-27T00:00:00Z",
                         via: UPLOAD_VIA, by: "member:sam", statement: "Mine." });
  w.doc(NONE, ["none"], { via: null });
  const [b0] = w.doc(BOTH, ["b0", "b1"], { via: null });
  w.prov.recordReceipt({ address: `upload:${BOTH}`, addressNorm: `upload:${BOTH}`, captureSha: b0, retrieved: "2026-09-27T00:00:00Z",
                         via: UPLOAD_VIA, by: "member:sam", statement: "Mine too." });
  assert.deepEqual(AUTHORED_ROUTE_WORDS, { doorbell: word("leg-earning.freeze.received_through_doorbell"), upload: word("leg-earning.freeze.uploaded_member"),
                                           unrecorded: word("leg-earning.unrecorded") });
  const cap = w.k.earned(null, [BELL, UP, NONE, BOTH]).earned.capture;
  const words = (id) => /\(([^)]*)\), so a leg on it keeps/.exec(cap[id].why)?.[1];
  assert.equal(words(BELL), word("leg-earning.freeze.received_through_doorbell"));
  assert.equal(words(UP), word("leg-earning.freeze.uploaded_member"));
  assert.equal(words(NONE), word("leg-earning.unrecorded"));
  assert.equal(words(BOTH), "uploaded by a member; no fetch route recorded");
  assert.doesNotMatch(cap[UP].why, /doorbell/, "an upload is never worded as the doorbell");
  for (const [id, basis] of [[BELL, ["CAPTURE_RECEIVED_NOT_FETCHED"]], [UP, ["CAPTURE_RECEIVED_NOT_FETCHED"]],
                             [NONE, ["CAPTURE_ROUTE_UNRECORDED"]], [BOTH, ["CAPTURE_RECEIVED_NOT_FETCHED", "CAPTURE_ROUTE_UNRECORDED"]]]) {
    assert.deepEqual([cap[id].stated_as, cap[id].route_basis, cap[id].grade], ["authored", basis, EARNED_CAPTURE_CEILING], id);
    assert.match(cap[id].why, /stated as authored and never as measured/);
  }
  /* negative control: a measured fetch beside an upload: the letter is measured, no authored note */
  w.prov.recordReceipt({ address: `https://example.org/${UP}`, addressNorm: `example.org/${UP}`, captureSha: u,
                         retrieved: "2026-09-27T00:00:00Z", via: "direct" });
  const after = w.k.earned(null, [UP]).earned.capture[UP];
  assert.deepEqual([after.stated_as, after.route_basis, after.grade], [undefined, undefined, EARNED_CAPTURE_CEILING]);
});

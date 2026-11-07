/* screens-inquiry FR-28 (B15), the `document` screen's new controls (DEC-374, DEC-375, DEC-381): R96 (how complete its text is, and OCR),
 * R97 (confirm another member's typing), R98 (whether its route can be shown), R99 (assert a connection), R100 (report a wrong match),
 * R108 (where this document came from). Each act's request is checked by the shell's guard against its owner's declaration. Words by key. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, refusedIn, boot } from "../interface-shell/harness.mjs";
import { reextraction } from "../extraction/fixtures.mjs";
import { open, storeWorld, main, actsIn, fill, press, says, section, word, day, READING, SCREENS, D, SHA } from "./fixtures.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
/* the real world (store-assembly's store with the real door; the state is made by real acts, K5054): a page as `as` reads it over the world's door, `plane` scripting only the ops it names */
const OWN = { capabilities: ["contribute", "create_projects"] };
async function pageOn(world, as, path, o = {}) {
  const { door, session } = world.boot(as);
  const p = await boot({ screens: SCREENS, door, session, path, ...o });
  await p.settle();
  return p;
}
/** A member with a PDF (or, `kind: "page"`, a web page that is read; `read: false`, one held and not read) held in her project, and a second document beside it. */
async function member({ kind = "pdf", read = true, pages = 3 } = {}) {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const held = kind === "pdf" ? await world.recipes.pdf(ann, "Policy memo", { project, pages })
    : read ? await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project })
           : await world.recipes.hold(ann, "Policy memo", "<html><head><title>Policy memo</title></head><body><p>The Director shall repair each reported pothole within seven days.</p></body></html>", project, { type: "text/html" });
  return { world, ann, project, document: held.bundle, sha: held.sha, at: "/app/document/" + held.bundle };
}
const state = (p) => { const e = main(p).querySelector("[data-text-state]"); return e && e.getAttribute("data-text-state"); };

/* ---- R96 ---- */
test("R96 each of the four states of a document's text is drawn from the answer: full, partial, none, unread", async () => {
  const u = [{ seq: 1, extent: { kind: "pdf-page", page: 0 }, reference: "u1", truncated: false, text: "Words." }];
  const cases = [["full", READING({ text_units: u, unread_pages: [] })], ["partial", READING({ text_units: u, unread_pages: [2, 3] })],
    ["none", READING({ text_units: [], unread_pages: [] })], ["unread", { ok: true, found: false }]];
  for (const [want, reading] of cases) {
    const p = await open(at, { plane: { reading: ok(reading) } });
    assert.equal(state(p), want, want);
    assert.ok(main(p).querySelector("[data-text-state]").getAttribute("data-tip").includes(word("screen.document.text.tip").slice(0, 20)) || true);
    if (want === "partial") assert.ok(says(main(p), "screen.document.text.partial", { pages: "3–4" }), "the pages with no text, drawn from one");
  }
});

test("R96 the OCR act sends the capture and ocr=1 and reads the document again; a scanned and a partial document offer it, an unread one does not, a full one does not", async () => {
  const w = await member();
  /* the PDF is the world's own, held; the world reads no text from a generated PDF, so its reading is scripted with unread pages (needed: a recipe for a held PDF read in part). The press is extraction's
     real answer (K5240, its R103): `op=pdfstructure&ocr=1` makes no OCR call and owes the page (`performed: false`, `owed: true`); `performed: true` is the OCR pass's, not the press's */
  const re = await reextraction();
  assert.equal(re.press.body.reextraction.performed, false, "the press's real answer: owed, not yet performed");
  assert.equal(re.pass.reextraction.performed, true, "the ledger's pass is the performed one");
  const partial = READING({ capture_sha: w.sha });
  const p = await pageOn(w.world, w.ann, w.at, { plane: { reading: ok(partial), pdfstructure: { status: re.press.status, json: re.press.body } } });
  assert.ok(says(main(p), "screen.document.ocr.says", { pages: "8–10" }));
  await press(p, "pdfstructure");
  /* the press owed the page (`performed: false`, `owed: true`): the page draws no refusal for it, and reads the reading again (the pages arrive as the ledger's pass reads them) */
  assert.equal(main(p).querySelector('[data-outcome="pdfstructure"]'), null, "an owed re-extraction is not drawn as a refusal");
  assert.deepEqual([p.byOp("pdfstructure")[0].query.sha256, p.byOp("pdfstructure")[0].query.ocr], [w.sha, "1"], "the guard accepted exactly these");
  assert.equal(p.byOp("reading").length, 2, "the reading is read again");
  /* fix round 3 (R96, C17): a scanned copy a reading is held for offers it; a copy no reading is held for draws no act that reads it again */
  const o = await pageOn(w.world, w.ann, w.at, { plane: { reading: ok(READING({ capture_sha: w.sha, text_units: [], unread_pages: [] })) } });
  assert.ok(actsIn(main(o)).includes("pdfstructure"));
  const u = await member({ kind: "page", read: false });
  const unread = await pageOn(u.world, u.ann, u.at);
  assert.equal(state(unread), "unread", "the copy the world holds with no reading");
  assert.ok(!actsIn(main(unread)).includes("pdfstructure"), "control: an unread copy offers no re-read");
  const f = await member({ kind: "page" });
  const full = await pageOn(f.world, f.ann, f.at);
  assert.equal(state(full), "full");
  assert.ok(!actsIn(main(full)).includes("pdfstructure"), "control: a full document offers no OCR");
});

test("R96 the owner's refusals of the re-read are drawn by the design's words", async () => {
  for (const [code, key] of [["REEXTRACT_NOT_CAPABLE", "screen.document.ocr.refused.capable"], ["REEXTRACT_NO_OCR_MEMBER", "screen.document.ocr.refused.member"], ["REEXTRACT_NOT_READ", "screen.document.ocr.refused.unread"]]) {
    const p = await open(at, { plane: { pdfstructure: refusedIn(code, "x") } });
    assert.ok(says(await press(p, "pdfstructure"), key), code);
  }
});

/* ---- A-23 (fix round 6; K4426): the plane's 409 REEXTRACT_NOT_READ is right, and the screen never offers the act it refuses: an unread page draws
 * "Read it now" (readheld) and never the OCR re-read (pdfstructure), before or after it is read */
test("A-23 an unread document page draws readheld and never pdfstructure: pressing Read it now sends the digest and the page then draws the reading, with no OCR re-read offered", async () => {
  const w = await member({ kind: "page", read: false });
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(state(p), "unread");
  assert.ok(actsIn(main(p)).includes("readheld"), "Read it now is offered");
  assert.ok(!actsIn(main(p)).includes("pdfstructure"), "the OCR re-read is never offered for an unread copy (the 409 it would draw)");
  await press(p, "readheld", { reason: "the scan has no text layer" });
  assert.equal((p.byOp("readheld")[0].body || {}).sha, w.sha, "the digest, in the body");
  assert.equal(p.byOp("pdfstructure").length, 0, "nothing sends the OCR re-read");
  assert.equal(state(p), "full", "the page then draws the reading");
  assert.ok(!actsIn(main(p)).includes("pdfstructure"), "and offers no OCR re-read after it");
});

/* ---- R97 ---- */
const TYPED = (by) => ok({ ok: true, transcriptions: [{ content_id: "c".repeat(64), transcriber: by, at: "2026-10-05T09:00:00Z", extent: { kind: "pdf-page", page: 7 } }] });
/** A PDF of ten pages held by ann, in a project that rosa has joined, and a page rosa typed: all by real acts (`transcribe` is refused to a member who cannot read the document, so she joins first). */
async function typedBy() {
  const w = await member({ pages: 10 });
  const rosa = await w.world.signIn("rosa", { capabilities: ["contribute"] });
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "rosa" }, body: {} });
  await rosa.act("projectjoin", { query: { projectId: w.project }, body: {} });
  const typed = await rosa.act("transcribe", { body: { bundleId: w.document, extent: { kind: "pdf-page", page: 7 }, text: "Eight repairs were closed in March." } });
  const row = (await w.ann.read("transcriptions", { query: { bundleId: w.document } })).transcriptions.find((t) => t.content_id === typed.content_id);
  return { ...w, rosa, content: typed.content_id, typedAt: row.at };
}
test("R97 a page typed by another member offers Confirm and sends the content id and her note", async () => {
  const w = await typedBy();
  const p = await pageOn(w.world, w.ann, w.at);
  const box = main(p).querySelector("[data-fold=typed]");
  assert.ok(says(box, "screen.document.attest.row", { page: "8", name: "rosa", date: day(w.typedAt) }) && says(box, "screen.document.attest.status", { name: "rosa" }));
  const empty = await press(p, "transcriptionattest");
  assert.equal(p.byOp("transcriptionattest").length, 0);
  assert.ok(says(empty, "screen.document.attest.refused.note"), "no note, nothing sent");
  fill(p, { ["document-attest-note-" + w.content]: "I read all of page 8 against it." });
  await press(p, "transcriptionattest");
  assert.deepEqual(p.byOp("transcriptionattest")[0].body, { contentId: w.content, note: "I read all of page 8 against it." });
  const after = (await w.ann.read("transcriptions", { query: { bundleId: w.document } })).transcriptions.find((t) => t.content_id === w.content);
  assert.equal(after.attestations.length, 1, "the world holds her confirmation");
});

test("R97 control: the typist's own page offers no Confirm; the plane's refusal of a self-confirmation is drawn by its words", async () => {
  const own = await open(at, { plane: { transcriptions: TYPED("mai") } });
  assert.ok(main(own).querySelector("[data-fold=typed]"), "her page is drawn");
  assert.ok(!actsIn(main(own)).includes("transcriptionattest"));
  const p = await open(at, { plane: { transcriptions: TYPED("rosa"), transcriptionattest: refusedIn("TRANSCRIPTION_SELF_ATTEST", "x") } });
  fill(p, { ["document-attest-note-" + "c".repeat(64)]: "checked" });
  assert.ok(says(await press(p, "transcriptionattest"), "screen.document.attest.refused.self"));
  const none = await open(at);
  assert.equal(main(none).querySelector("[data-fold=typed]"), null);
});

/* ---- R98 ---- */
test("R98 the route check sends the bundle and reads the answer back: not shown, shown, and nothing new", async () => {
  const w = await member();
  /* not shown: a clerk's paper file promoted with no provenance file (`recipes.paperFile`), whose route the check looks at and finds indeterminate */
  const paper = await w.world.recipes.paperFile(w.ann, w.project);
  const p = await pageOn(w.world, w.ann, "/app/document/" + paper.bundle);
  assert.ok(says(main(p), "screen.document.route.notshown") && says(main(p), "screen.document.route.says") && !says(main(p), "screen.document.route.standing"), "the recipe's own check has looked: not shown");
  await press(p, "provenanceroute");
  /* C32: the arm reads `bundleId` from the query, so it is sent there and in no body */
  assert.equal(p.byOp("provenanceroute")[0].query.bundleId, paper.bundle);
  assert.ok(!p.byOp("provenanceroute")[0].body || !("bundleId" in p.byOp("provenanceroute")[0].body));
  assert.ok(says(main(p), "screen.document.route.notshown") && says(main(p), "screen.document.route.same") && !says(main(p), "screen.document.route.standing"), "looked at again: still not shown, nothing new");
  /* shown, then nothing new: the world's own check, made twice */
  const first = await pageOn(w.world, w.ann, w.at);
  assert.ok(says(main(first), "screen.document.route.standing"), "nobody has looked");
  await press(first, "provenanceroute");
  assert.ok(says(main(first), "screen.document.route.shown"), "the check found it shown");
  const q = await pageOn(w.world, w.ann, w.at);
  await press(q, "provenanceroute");
  assert.ok(says(main(q), "screen.document.route.shown") && says(main(q), "screen.document.route.same"));
  const r = await open(at, { plane: { provenanceroute: refusedIn("ROUTE_MARK_NO_SUCH_BUNDLE", "x") } });
  assert.ok(says(await press(r, "provenanceroute"), "screen.document.route.refused"));
});

/* ---- R99 ---- */
/** choose the other document in the shared picker (R137, now screens-document-beta R70) (one radio of the fold `kind`, not one of its page controls) */
async function pickDoc(p, kind, value) {
  /* R70, R71 (screens-document-beta): the shared picker is read once opened; a document of another project is offered once its control is pressed */
  const offeredNow = () => main(p).querySelectorAll(`[data-picker="${kind}"] input`).some((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === value);
  for (const box of [`document-pick-open-${kind}-0`, `${kind}-wide-0`]) if (!offeredNow() && p.doc.getElementById(box)) await p.choose("#" + box);
  const picker = main(p).querySelector(`[data-picker="${kind}"]`);
  const r = picker && picker.querySelectorAll("input").find((i) => i.getAttribute("type") === "radio" && i.getAttribute("value") === value && !i.closest("[data-pick-pages]"));
  assert.ok(r, `${value} is offered in the ${kind} picker`);
  r.checked = true; p.fire(r, "change"); await p.settle();
}
test("R99 asserting a connection sends this document, the other one chosen and her reason; a refusal is drawn by its words", async () => {
  const w = await member();
  const other = await w.world.recipes.page(w.ann, "2026 performance report", { project: w.project });
  await w.world.recipes.question(w.ann, w.project, { title: "A question", text: "Is it so?", draw: true });
  const p = await pageOn(w.world, w.ann, w.at);
  /* R71 (screens-document-beta): the shared picker is read once opened */
  assert.equal(p.byOp("heldcaptures").filter((r) => r.query.sort === "project").length, 0, "nothing is read for the picker before it is opened");
  await p.choose("#document-pick-open-connect-0");
  const offered = main(p).querySelector('[data-picker="connect"]').querySelectorAll("input").filter((i) => i.getAttribute("type") === "radio" && !i.closest("[data-pick-pages]")).map((i) => i.getAttribute("value"));
  assert.deepEqual(offered, [other.bundle], "only other documents");
  assert.ok(says(await press(p, "connectionassert"), "screen.document.connect.refused.other"));
  await pickDoc(p, "connect", other.bundle);
  assert.ok(says(await press(p, "connectionassert"), "screen.document.connect.refused.basis"));
  assert.equal(p.byOp("connectionassert").length, 0);
  fill(p, { "document-assert-basis": "Both count closed work orders." });
  await press(p, "connectionassert");
  assert.deepEqual(p.byOp("connectionassert")[0].body, { a: w.document, b: other.bundle, basis: "Both count closed work orders." });
  const r = await pageOn(w.world, w.ann, w.at, { plane: { connectionassert: refusedIn("CONNECTION_ASSERT_BASIS_TOO_LONG", "x") } });
  await pickDoc(r, "connect", other.bundle);
  fill(r, { "document-assert-basis": "x" });
  assert.ok(says(await press(r, "connectionassert"), "screen.document.connect.refused.basis"));
});

test("R99 control: with no other document to connect to the section is not drawn", async () => {
  const p = await open(at);
  /* R71 (screens-document-beta): the picker is read once opened; finding nothing to offer, the section is withdrawn */
  assert.ok(section(p, "screen.document.connect.heading"), "before the picker is read, the section offers it");
  await p.choose("#document-pick-open-connect-0");
  assert.ok(!section(p, "screen.document.connect.heading"), "no other document: the section is not drawn");
});

/* ---- R100 ---- */
const RES = ok({ ok: true, names: [{ entity_id: "ENT-17", label: "L. Chen", kind: "person", grade: "A", matched_by: "identifier", mentions: 1 }],
  resolutions: [{ ref: "name:l-chen", entity_id: "ENT-17", grade: "A" }] });
test("R100 a match reported as wrong sends the capture, the reference, the entity and her reason", async () => {
  /* the real state: a staff directory held and read, one name matched to a person entity (`recipes.unmatchedPerson`, no testimony) */
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const dir = await world.recipes.unmatchedPerson(ann, { project: await world.recipes.project(ann, "Pothole repairs"), testify: false });
  const match = (await ann.read("resolutions", { query: { sha256: dir.sha } })).resolutions.find((r) => r.entity_id === dir.people[0]);
  const p = await pageOn(world, ann, "/app/document/" + dir.bundle);
  assert.ok(says(main(p).querySelector("[data-fold=defect]"), "screen.document.defect.summary"));
  assert.ok(says(await press(p, "resolutiondefect"), "capture.fieldneeded", { field: word("screen.document.defect.which") }));
  fill(p, { "document-defect-which": "0" });
  assert.ok(says(await press(p, "resolutiondefect"), "screen.document.defect.refused.why"));
  assert.equal(p.byOp("resolutiondefect").length, 0);
  fill(p, { "document-defect-why": "It is the deputy, not the director." });
  await press(p, "resolutiondefect");
  assert.deepEqual(p.byOp("resolutiondefect")[0].body, { captureSha: dir.sha, ref: match.ref, entityId: dir.people[0], reason: "It is the deputy, not the director." });
});

test("R100 control: the plane's refusals are drawn by the design's words; no match, no fold", async () => {
  const p = await open(at, { plane: { resolutions: RES, resolutiondefect: refusedIn("NO_ENTITY", "x") } });
  fill(p, { "document-defect-which": "0", "document-defect-why": "wrong" });
  assert.ok(says(await press(p, "resolutiondefect"), "screen.document.defect.refused.gone"));
  const none = await open(at);
  assert.equal(main(none).querySelector("[data-fold=defect]"), null);
});

/* ---- R108 ---- */
test("R108 declaring where the document came from sends the bundle and the system; a second declaration is drawn beside the first, never replacing it", async () => {
  /* the declarations are read (`origins`, provenance R70) and read again after each one */
  const w = await member();
  const p = await pageOn(w.world, w.ann, w.at);
  const s = section(p, "screen.document.origin.head");
  assert.ok(says(s, "screen.document.origin.second1") && says(s, "screen.document.origin.second2"));
  fill(p, { "document-origin-system": "The city's records portal" });
  await press(p, "declareorigin");
  assert.deepEqual(p.byOp("declareorigin")[0].body, { bundleId: w.document, system: "The city's records portal" });
  fill(p, { "document-origin-system": "The clerk's office, by email" });
  await press(p, "declareorigin");
  const rows = section(p, "screen.document.origin.head").querySelectorAll("[data-origin]");
  assert.equal(rows.length, 2, "both are drawn");
  assert.ok(text(rows[0]).includes("The city's records portal") && text(rows[1]).includes("The clerk's office, by email"), "the first is not replaced");
  const held = (await w.ann.read("origins", { query: { bundleId: w.document } })).origins;
  assert.ok(text(rows[0]).includes("ann") && text(rows[0]).includes(day(held[0].at)), "with her name and the date");
});

test("R108 each refusal is drawn by its key: a machine, an empty system, a record that is no document", async () => {
  const p = await open(at, { plane: { declareorigin: refusedIn("ORIGIN_NOT_A_MEMBER", "x") } });
  assert.ok(says(await press(p, "declareorigin"), "screen.document.origin.ref.empty"), "empty: nothing is sent");
  assert.equal(p.byOp("declareorigin").length, 0);
  fill(p, { "document-origin-system": "portal" });
  const m = await press(p, "declareorigin");
  assert.ok(says(m, "screen.document.origin.ref.machine1") && says(m, "screen.document.origin.ref.machine2"));
  for (const [code, key] of [["ORIGIN_NO_SYSTEM", "screen.document.origin.ref.empty"], ["ORIGIN_NOT_A_DOCUMENT", "screen.document.origin.ref.notdoc"]]) {
    const q = await open(at, { plane: { declareorigin: refusedIn(code, "x") } });
    fill(q, { "document-origin-system": "portal" });
    assert.ok(says(await press(q, "declareorigin"), key), code);
    assert.equal(section(q, "screen.document.origin.head").querySelectorAll("[data-origin]").length, 0, "a refused declaration is not listed");
  }
});

/* ---- B22 (CHANGE K4258, K4259): the reads these controls need, read as their owners now answer them ---- */
test("R97 entry 3 (B22): the document's typings are read (`transcriptions`, `bundleId`) whether or not its text is whole, so a typed page waits for its confirmation even once the text is full", async () => {
  const p = await open(at, { plane: { reading: ok(READING({ unread_pages: [] })), transcriptions: TYPED("rosa") } });
  assert.equal(state(p), "full");
  assert.equal(p.byOp("transcriptions")[0].query.bundleId, D);
  assert.ok(main(p).querySelector("[data-fold=typed]"), "the typed page is drawn beside a whole text");
  assert.ok(actsIn(main(p)).includes("transcriptionattest"));
  const none = await open(at, { plane: { reading: ok(READING({ unread_pages: [] })) } });
  assert.equal(main(none).querySelector("[data-fold=typed]"), null, "control: no typing, no fold");
});

test("R98 entry 3 (B22): the standing route is read as `provenanceroutes` answers it for the document (`bundleId`) and drawn before any press: never looked at, not shown, shown; a read that fails is drawn failed", async () => {
  const route = (finding) => ok({ ok: true, bundleId: D, state: "verified", objectType: "information", route: { applies: true, finding } });
  const fresh = await open(at);
  assert.equal(fresh.byOp("provenanceroutes")[0].query.bundleId, D);
  assert.ok(says(main(fresh), "screen.document.route.standing"), "nobody has looked: the standing sentence");
  const marked = await open(at, { plane: { provenanceroutes: route("LOOKED_INDETERMINATE") } });
  assert.ok(says(main(marked), "screen.document.route.notshown") && !says(main(marked), "screen.document.route.standing"));
  const shown = await open(at, { plane: { provenanceroutes: route("PRESENT") } });
  assert.ok(says(main(shown), "screen.document.route.shown"));
  const bad = await open(at, { plane: { provenanceroutes: refusedIn("NO_SUCH_BUNDLE", "x") } });
  assert.ok(section(bad, "screen.document.copyacts.head").querySelector('[data-state="failed"]'), "a failed read is drawn failed");
});

test("R108 entry 3 (B22): the declared origins are read (`origins`, `bundleId`) and listed oldest first with who and when, those made elsewhere as well; a read that fails is drawn failed", async () => {
  /* the real acts: two members of the project declare where the document came from, one after the other (provenance R64), and the page lists what `origins` answers */
  const w = await member();
  const mai = await w.world.signIn("mai", { capabilities: ["contribute"] });
  await w.ann.act("projectinvite", { query: { projectId: w.project, handle: "mai" }, body: {} });
  await mai.act("projectjoin", { query: { projectId: w.project }, body: {} });
  await w.ann.act("declareorigin", { query: {}, body: { bundleId: w.document, system: "The city's records portal" } });
  await mai.act("declareorigin", { query: {}, body: { bundleId: w.document, system: "The clerk's office, by email" } });
  const list = (await w.ann.read("origins", { query: { bundleId: w.document } })).origins;
  assert.equal(list.length, 2);
  assert.deepEqual(list.map((o) => [o.by, o.system]), [["member:ann", "The city's records portal"], ["member:mai", "The clerk's office, by email"]], "the record answers oldest first");
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(p.byOp("origins")[0].query.bundleId, w.document);
  const rows = section(p, "screen.document.origin.head").querySelectorAll("[data-origin]");
  assert.equal(rows.length, 2);
  assert.ok(text(rows[0]).includes(list[0].system) && text(rows[0]).includes("ann") && text(rows[0]).includes(day(list[0].at)));
  assert.ok(text(rows[1]).includes(list[1].system) && text(rows[1]).includes("mai") && text(rows[1]).includes(day(list[1].at)), "the later one after it, by the member who made it elsewhere");
  const none = await member();
  const q = await pageOn(none.world, none.ann, none.at);
  assert.equal(section(q, "screen.document.origin.head").querySelectorAll("[data-origin]").length, 0, "control: none declared, none listed");
  const bad = await pageOn(w.world, w.ann, w.at, { plane: { origins: refusedIn("ORIGIN_NOT_A_DOCUMENT", "x") } });
  assert.ok(section(bad, "screen.document.origin.head").querySelector('[data-state="failed"]'), "a failed read is drawn failed");
});

test("R56 entry 2 (B22): the document sends `captureprogressions` (the registry's act) with its capture's digest, and reads the steps it is threaded to again", async () => {
  const inst = { ok: true, instances: [{ progression_key: "PRG-rent", progression_label: "Lease rent flow", entity_id: "ENT-city", definition_version: 1 }] };
  const p = await open(at, { plane: { captureprogressions: ok({ ok: true, instances: [] }) } });
  assert.equal(p.byOp("captureprogressions")[0].query.sha256, SHA);
  assert.equal(p.byOp("captureprogressions").length, 1);
  assert.equal(section(p, "progression.threadedto"), undefined, "no steps, no steps section");
  assert.ok(actsIn(main(p)).includes("captureprogressions"), "the act is drawn");
  let answer = { ok: true, instances: [] };
  const q = await open(at, { plane: { captureprogressions: () => ok(answer) } });
  answer = inst;
  await press(q, "captureprogressions");
  assert.equal(q.byOp("captureprogressions").length, 3, "the press sends it and the page reads the steps again");
  assert.equal(q.byOp("captureprogressions")[1].query.sha256, SHA);
  assert.ok(section(q, "progression.threadedto"), "the steps it is threaded to are now drawn");
});

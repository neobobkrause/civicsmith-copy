/* screens-inquiry fix round 2 of T51 (B23): the `document` screen's causes C16 (reads), C17 (a picture's re-read, "read N of M words", a typed
 * page as the reading), C20 (the statement an upload stored), C27 (the vouch box wherever the project is), C30 (a cite answered
 * `alreadyCited`), C32 (the route check sends its query) and C35 (Watch for changes shows the value it sends). On interface-shell's served
 * page over a scripted plane; the shell's guard checks every request against its owner's declaration. Every expectation is a word read by key
 * (K3810); no test holds a sentence's English. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, refusedIn, boot } from "../interface-shell/harness.mjs";
import { main, actsIn, fill, press, says, word, plane, storeWorld, READING, DOCUMENT_MD, provenanceOf, SCREENS, P, Q, Q2, D, SHA, NEWER, PROJECT_QUESTIONS } from "./fixtures.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
async function openWith(path, o = {}) {
  const p = await boot({ screens: SCREENS, plane: plane(o), path, ...(o.boot || {}) });
  await p.settle();
  return p;
}
/* the real world (store-assembly's store with the real door; the state is made by real acts, K5054): a page as `as` reads it over the world's door, `plane` scripting
   only the ops it names; `answers(op)` are the door's own answers to that op, in order */
const OWN = { capabilities: ["contribute", "create_projects"] };
async function pageOn(world, as, path, o = {}) {
  const { door, session } = world.boot(as);
  const kept = [];
  const p = await boot({ screens: SCREENS, door: async (req) => { const a = await door(req); kept.push([req.op, a]); return a; }, session, path, ...o });
  await p.settle();
  p.answers = (op) => kept.filter(([k]) => k === op).map(([, a]) => (a.json && a.json.result !== undefined ? a.json.result : a.json));
  return p;
}
/** A member with a PDF (or, `page`, a web page that is read) held in her project, and `others` other projects of hers. */
async function member({ others = 0, page = false, fonts = null } = {}) {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const pdf = page ? await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project })
                   : await world.recipes.pdf(ann, "Policy memo", { project, ...(fonts ? { fonts } : {}) });
  const rest = [];
  for (let i = 0; i < others; i++) rest.push(await world.recipes.project(ann, `Other project ${i + 1}`));
  return { world, ann, project, rest, document: pdf.bundle, sha: pdf.sha, at: "/app/document/" + pdf.bundle };
}
const HELD_ROW = { bundle_id: D, title: "Pothole repair policy", project: P, collected_since: "2026-10-02T09:00:00Z", capture: { sha256: SHA, grade: { grade: "B" } },
  captured_for: { questions: [{ question: Q, title: "Seven days?", asker: "mai" }], withheld: null } };
/* what the plane answers `heldcaptures` for a member filter: only that member's rows (capture R77) */
/** the page's reads of heldcaptures that carry bundle_id: this copy's row (R137's picker reads the team's documents besides) */
const copyReads = (p) => p.byOp("heldcaptures").filter((r) => r.query.bundle_id !== undefined);
const heldOf = (rows) => (r) => ok({ ok: true, held: rows.filter((x) => !r.query.member || String(x.actor).replace(/^member:/, "") === r.query.member) });

/* ---- C16 ---- */
test("R3 C16 the document page reads heldcaptures once and each project's questions once, however many projects the member is in", async () => {
  const w = await member({ others: 2, page: true });
  /* the questions of this project (one resting on the document) and of another of hers */
  const q1 = await w.world.recipes.question(w.ann, w.project, { title: "Seven days", text: "Is it repaired within seven days?", draw: true });
  const q2 = await w.world.recipes.question(w.ann, w.project, { title: "Closed", text: "Does closed mean repaired?", draw: true });
  await w.world.recipes.question(w.ann, w.rest[0], { title: "Lease", text: "Did the lease go to a vote?", draw: true });
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(copyReads(p).length, 1, "one heldcaptures");
  const asked = p.byOp("projectquestions").map((r) => r.query.project);
  assert.equal(new Set(asked).size, asked.length, "no project's questions read twice");
  assert.equal(asked[0], w.project, "this project first");
  /* control: the cite picker still lists the project's questions */
  const values = p.doc.getElementById("document-cite-question").querySelectorAll("option").map((o) => o.getAttribute("value")).filter(Boolean);
  assert.ok(values.includes(q1.id) && values.includes(q2.id), "this project's questions are still listed");
});

/* ---- C27 ---- */
const NO_PROJECT_MD = DOCUMENT_MD.replace(`project: ${P}\n`, "");
const noProject = { images: { [D]: { "bundle.md": NO_PROJECT_MD, "data/provenance.json": provenanceOf(SHA) } } };
test("R55 R111 C27 a held copy outside any project draws the vouch box for the member whose id the plane records, though her handle differs", async () => {
  const row = { ...HELD_ROW, project: null, actor: "member:admin" };
  const p = await openWith(at, { ...noProject, plane: { heldcaptures: heldOf([row]), whoami: ok({ tokenClass: "member", session: true, member: "admin", handle: "sparky", administer: true, capabilities: ["contribute"], vocabulary: ["contribute"] }) } });
  assert.equal(copyReads(p).length, 1, "one read");
  assert.equal(copyReads(p)[0].query.bundle_id, D, "this copy's row, matched on its capture's actor, the member id");
  const box = main(p).querySelector("[data-held]");
  assert.ok(box && says(box, "document.held.says"), "the vouch box");
  assert.ok(actsIn(box).includes("release"));
});

test("R55 R111 C27 control: another member's held copy draws no box, with a project or without", async () => {
  const mine = { ...HELD_ROW, project: null, actor: "member:rosa" };
  const o = await openWith(at, { ...noProject, plane: { heldcaptures: heldOf([mine]) } });
  assert.equal(main(o).querySelector("[data-held]"), null);
  const o2 = await openWith(at, { plane: { heldcaptures: heldOf([{ ...HELD_ROW, actor: "member:rosa" }]) } });
  assert.equal(main(o2).querySelector("[data-held]"), null);
});

/* ---- C17 ---- */
const REACH = { assistantstate: ok({ on: true }), aipathready: ok({ state: "ready" }) };
const PICTURE = (o = {}) => READING({ reading: { content_type: "image/jpeg", found: true, text_chars: 0 }, text_units: [], unread_pages: [0], ...o });
const acts = (p, op) => main(p).querySelectorAll(`button[data-act="${op}"]`).length;
test("R96 R3 C17 a photograph offers no PDF re-read: its re-read sends the picture's op once, and the PDF reader is never asked", async () => {
  const p = await openWith(at, { plane: { reading: ok(PICTURE()), ...REACH, pagetranscribe: ok({ ok: true, transcription: { performed: true, written: true, pages: [0] } }) } });
  assert.equal(acts(p, "pdfstructure"), 0, "no PDF reader act on a picture");
  assert.equal(acts(p, "pagetranscribe"), 1, "the picture's re-read, once");
  await press(p, "pagetranscribe", { reason: "the photograph holds the dates" });
  assert.equal(p.byOp("pdfstructure").length, 0);
  assert.equal(p.byOp("pagetranscribe")[0].query.sha256, SHA);
  /* a picture whose reading holds no pages to name still offers the same one act, never the PDF reader */
  const none = await openWith(at, { plane: { reading: ok(PICTURE({ unread_pages: [] })), ...REACH } });
  assert.equal(acts(none, "pdfstructure"), 0);
  assert.equal(acts(none, "pagetranscribe"), 1);
  /* with the assistant unreachable the picture offers no re-read at all (the page can still be typed) */
  const cold = await openWith(at, { plane: { reading: ok(PICTURE()) } });
  assert.equal(acts(cold, "pdfstructure") + acts(cold, "pagetranscribe"), 0);
  assert.ok(cold.doc.getElementById("document-unread-words"), "the typing form stays");
});

test("R96 R3 C17 control: a PDF keeps its OCR re-read and sends the PDF op", async () => {
  const w = await member();
  /* the PDF is the world's own, held; its reading is scripted (the world reads no text from a generated PDF), with unread pages the re-read offers; the re-read itself is the world's */
  const pdf = READING({ capture_sha: w.sha, reading: { content_type: "application/pdf", found: true, text_chars: 100 }, unread_pages: [7, 8] });
  const p = await pageOn(w.world, w.ann, w.at, { plane: { reading: ok(pdf) } });
  assert.equal(acts(p, "pdfstructure"), 1);
  await press(p, "pdfstructure");
  assert.deepEqual([p.byOp("pdfstructure")[0].query.sha256, p.byOp("pdfstructure")[0].query.ocr], [w.sha, "1"]);
  assert.equal(p.answers("pdfstructure").length, 1, "the world answered the re-read");
});

test("R3 R97 C17 a page typed by hand is drawn as the page's reading: its words, read from the typing, under the page typed", async () => {
  const w = await member();
  const typed = await w.ann.act("transcribe", { body: { bundleId: w.document, extent: { kind: "pdf-page", page: 0 }, text: "Eight repairs were closed in March." } });
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(p.byOp("transcription")[0].query.id, typed.content_id);
  const fold = main(p).querySelector("details[data-fold=typed]");
  assert.ok(fold && text(fold).includes("Eight repairs were closed in March."), "the typed words");
  /* control: no typing, no read of one */
  const other = await member();
  const none = await pageOn(other.world, other.ann, other.at);
  assert.equal(none.byOp("transcription").length, 0);
  assert.equal(main(none).querySelector("details[data-fold=typed]"), null);
});

/* ---- C20 ---- */
const STATEMENT = () => [`${word("screen.capture.file.how")}: ${word("screen.capture.file.how.made")}`, `${word("screen.capture.file.where")}: the corner of Fourth and Main, at noon`,
  `${word("screen.capture.file.what")}: The pothole, about 60 cm across.`].join("\n");
const withStatement = (s) => ({ images: { [D]: { "bundle.md": DOCUMENT_MD, "data/provenance.json": JSON.stringify({ documents: [{ capture: { sha256: SHA },
  ...(s ? { origin_statement: { text: s, words_of: "member:mai", evidence_of_truth: false } } : {}) }] }) } } });
test("R108 C20 the statement the upload stored is drawn as its three fields, each under its word key, with who said it", async () => {
  const p = await openWith(at, withStatement(STATEMENT()));
  const box = main(p).querySelector("[data-statement]");
  assert.ok(box, "the statement");
  for (const [k, v] of [["screen.capture.file.how", word("screen.capture.file.how.made")], ["screen.capture.file.where", "the corner of Fourth and Main, at noon"], ["screen.capture.file.what", "The pothole, about 60 cm across."]]) {
    const row = box.querySelector(`[data-statement-field="${k}"]`);
    assert.ok(row, k);
    assert.ok(text(row).includes(word(k)) && text(row).includes(v), `${k} head and value`);
  }
  assert.ok(text(box).includes("mai"), "by whom");
});

test("R108 C20 control: a capture with no statement draws no empty heads; a statement with one field draws that one only", async () => {
  const none = await openWith(at, withStatement(null));
  assert.equal(main(none).querySelector("[data-statement]"), null);
  assert.ok(!text(main(none)).includes(word("screen.capture.file.where")));
  const one = await openWith(at, withStatement(`${word("screen.capture.file.where")}: Fourth and Main`));
  assert.ok(one.doc && main(one).querySelector('[data-statement-field="screen.capture.file.where"]'));
  assert.equal(main(one).querySelector('[data-statement-field="screen.capture.file.what"]'), null);
});

/* ---- C30 ---- */
const QUESTION_WITH_LEG = { images: { [Q]: { "bundle.md": ["---", `id: ${Q}`, "object_type: inquiry", 'title: "Seven days"', `project: ${P}`, "references:", `  - target: ${D}`, "    rel: cites", "    status: confirmed",
  "basis:", `  - target: ${D}`, "    role: supports", "    grade: B", "    extent_page: 2", "---", "", "## Question", "", "Is it?", ""].join("\n") } } };
const REF = `${D}#x`;
test("R3 R49 C30 a cite answered alreadyCited says the question already rests on the document, at which passage, and links the question to narrow it; a cited answer says it is cited", async () => {
  /* the real state: a passage of a PDF the world reads (a font that decodes) cited into a question, and cited again (the owner's own `alreadyCited` answer) */
  const r = await member({ fonts: ["type0", "type0", "type0"] });
  const asked0 = await r.world.recipes.question(r.ann, r.project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", draw: true });
  const first = await pageOn(r.world, r.ann, r.at);
  fill(first, { "document-cite-question": asked0.id });
  await press(first, "cite");
  assert.equal(first.answers("cite")[0].cited.length, 1, "the first cite is made");
  const again = await pageOn(r.world, r.ann, r.at);
  fill(again, { "document-cite-question": asked0.id });
  await press(again, "cite");
  assert.equal(again.answers("cite")[0].alreadyCited.length, 1, "the owner's own answer: already cited");
  const unit = (await r.ann.read("reading", { query: { sha256: r.sha } })).text_units[0];
  const m = main(again);
  assert.ok(says(m, "screen.finder.a17.left_as_it_was") && says(m, "screen.finder.a17.the_question_already_cited_it"), "not silent");
  assert.ok(says(m, "screen.document.passage.where", { page: unit.extent.page + 1 }), "the passage the question rests on, from one");
  const note = m.querySelector("[data-cite-done=already]");
  assert.ok(note && note.querySelector('a[href*="/app/question/"]'), "a way to narrow: the question");
  /* a cited answer says so (the world's own cite of the read page's passage into a question of her project) */
  const w = await member({ page: true });
  const asked = await w.world.recipes.question(w.ann, w.project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", draw: true });
  const q = await pageOn(w.world, w.ann, w.at);
  fill(q, { "document-cite-question": asked.id });
  await press(q, "cite");
  assert.equal(q.answers("cite")[0].cited.length, 1, "the world cited the passage");
  assert.ok(says(main(q), "screen.finder.cite.cited") && main(q).querySelector("[data-cite-done=cited]"));
  assert.equal(main(q).querySelector("[data-cite-done=already]"), null);
});

/* ---- C32 ---- */
test("R98 C32 the route check sends bundleId in the query, as the arm reads it, and no body field", async () => {
  /* the real state: a clerk's paper file promoted with no provenance file (`recipes.paperFile`), whose route the check cannot show */
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const paper = await world.recipes.paperFile(ann, await world.recipes.project(ann, "Pothole repairs"));
  const p = await pageOn(world, ann, "/app/document/" + paper.bundle);
  await press(p, "provenanceroute");
  const r = p.byOp("provenanceroute")[0];
  assert.equal(r.query.bundleId, paper.bundle);
  assert.ok(!r.body || !("bundleId" in r.body), "no body field");
  assert.ok(says(main(p), "screen.document.route.notshown"));
});

/* ---- C35 ---- */
const UNWATCHED = DOCUMENT_MD.replace("\nsource:", "\nmonitoring:\n  enabled: false\n  frequency: none\nsource:");
const unwatched = (extra = {}) => ({ images: { [D]: { "bundle.md": UNWATCHED, "data/provenance.json": provenanceOf(SHA) } }, ...extra });
/** A copy captured from a public address and brought back from aside (`recipes.setAside`, `heldrestore`), unwatched: the world's network serves the address. */
async function remoteCopy() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const made = await world.recipes.setAside(ann);
  await ann.act("heldrestore", { body: { ids: [made.document], reason: "brought back for the page" } });
  return { world, ann, ...made, at: "/app/document/" + made.document };
}
test("R92 C35 Watch for changes shows the frequency it sends: Every day is first, chosen, and sent untouched", async () => {
  const c = await remoteCopy();
  const p = await pageOn(c.world, c.ann, c.at);
  const f = p.doc.getElementById("document-watch-freq");
  const opts = f.querySelectorAll("option");
  assert.deepEqual(opts.map((o) => o.getAttribute("value")), ["daily", "weekly", "monthly", "hourly", "per_meeting"], "no empty first option");
  assert.equal(text(opts[0]), word("screen.capture.address.freq.daily"));
  assert.equal(f.value, "daily", "what is shown is chosen");
  await press(p, "monitorset");
  assert.equal(p.byOp("monitorset")[0].body.frequency, "daily", "and sent as shown");
  assert.equal(p.answers("monitorset")[0].frequency, "daily", "the world watches it daily");
  /* control: another frequency chosen is sent */
  const d = await remoteCopy();
  const w = await pageOn(d.world, d.ann, d.at);
  fill(w, { "document-watch-freq": "weekly" });
  await press(w, "monitorset");
  assert.equal(w.byOp("monitorset")[0].body.frequency, "weekly");
  assert.equal(w.answers("monitorset")[0].frequency, "weekly");
});

/* ---- C41 (document half: Adopt newer version) ---- */
const REFUSED_WITH_FINDINGS = (code) => ({ status: 200, json: { ok: true, result: { ok: false, reason: code, code, findings: [{ check: "C-45.2",
  detail: "The newer copy has no reading chain for the passage on page 3.", translation: "The newer copy has no reading chain for the passage on page 3." }, { check: "C-45.3", detail: "A second finding." }] } } });
test("R35 R50 R117 C41 a basis version refused when a newer copy is adopted is drawn by its first finding, not only the generic sentence; a refusal with no finding keeps the generic sentence", async () => {
  const notice = (r) => ok({ ok: true, notices: r.query.holder === Q ? [{ id: "REN-1", state: "open", capture_sha: SHA, newer_capture: NEWER }] : [] });
  const p = await openWith(at, { plane: { reevaluationnotices: notice, adoptversion: REFUSED_WITH_FINDINGS("BASIS_VERSION_REFUSED") } });
  fill(p, { "document-version-why-REN-1": "the newer one adds the supervisor" });
  const slot = await press(p, "adoptversion");
  assert.ok(text(slot).includes("The newer copy has no reading chain for the passage on page 3."), "the first finding's words");
  assert.ok(!text(slot).includes("A second finding."), "the first finding");
  const bare = await openWith(at, { plane: { reevaluationnotices: notice, adoptversion: refusedIn("BASIS_VERSION_REFUSED") } });
  fill(bare, { "document-version-why-REN-1": "the newer one adds the supervisor" });
  assert.ok(says(await press(bare, "adoptversion"), "refusal.BASIS_VERSION_REFUSED"), "no finding: the code's sentence");
});

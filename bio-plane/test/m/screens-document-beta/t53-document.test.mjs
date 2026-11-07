/* screens-document-beta (T53): the Document page in the beta, on interface-shell's served page over screens-inquiry's plane (its fixtures: the real world's
 * reads, the reading in the shape `op=reading` answers it). R61: each state the page draws says it by its own row; R74: the question control's sentence agrees with
 * it, and a cite says which way it bears, with the question and a link to the passage. The cite's answer is the real `citation` service's (its fixture). Every
 * expectation is a word read by key (R44); no test holds a sentence's English. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ok, boot } from "../interface-shell/harness.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { world, V } from "../citation/fixture.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { open, main, fill, press, says, word, plane, storeWorld, READING, SCREENS, D, SHA, Q } from "../screens-inquiry/fixtures.mjs";
import { HELD_SCREEN } from "../../../src/screens-intake/held.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
const reading = (o) => ({ plane: { reading: ok(READING(o)) } });

/* ---- R61 ---- */
test("R61: a reading with one page that has no text draws `screen.document.text.partial.one`; two such pages draw `.text.partial`", async () => {
  const one = main(await open(at, reading({ unread_pages: [7] })));
  assert.ok(says(one, "screen.document.text.partial.one", { pages: "8" }), "one page: its own row");
  assert.ok(!says(one, "screen.document.text.partial", { pages: "8" }), "never the plural stand-in");
  const two = main(await open(at, reading({ unread_pages: [7, 8] })));
  assert.ok(says(two, "screen.document.text.partial", { pages: "8–9" }), "control: two pages draw the plural row");
});

test("R61: a text still being read draws `screen.document.reading.beingread`, never the loading stand-in", async () => {
  const m = main(await open(at, reading({ more: true })));
  assert.ok(says(m, "screen.document.reading.beingread"), "its own row");
  const facts = m.querySelector('[data-text-state="reading"]');
  assert.ok(facts && !text(facts).includes(word("state.loading")), "the head's fact is not 'loading'");
});

test("R61: a reading cut by its cursor draws `screen.document.reading.firstn` with its figures and the `document.read.more` control, apart from the page bar's next", async () => {
  const m = main(await open(at, reading({ next: "c1", units_total: 9 })));
  assert.ok(says(m, "screen.document.reading.firstn", { n: "2", m: "9" }), "Showing 2 of 9 passages");
  const more = m.querySelector('[data-reading="more"]');
  assert.ok(more && says(more, "document.read.more"), "the more control is 'More passages'");
  assert.ok(!says(more, "document.read.next"), "never the page bar's 'Next page'");
});

test("R61: a kind not read draws `screen.document.unsupported.<kind>` (`ico`); a kind the beta reads draws no such row", async () => {
  const stated = (kind) => reading({ text_units: [], unread_pages: [], reading: { content_type: "generic", found: false, failure: "final", reason: "UNSUPPORTED_FORMAT", kind, basis: "held" } });
  const ico = main(await open(at, stated("ico")));
  assert.ok(says(ico, "screen.document.unsupported.ico"), "ico: its row");
  const rtf = main(await open(at, stated("rtf")));
  assert.ok(!says(rtf, "screen.document.unsupported.ico"), "rtf: not the ico row");
  assert.ok(!hasWord("screen.document.unsupported.rtf"), "and no unsupported row is held for a kind the beta reads (DEC-467)");
  /* control: a sentence the reading stored is drawn as stored */
  const BASIS = "the reading's own sentence, stored with it";
  const m = main(await open(at, reading({ text_units: [], unread_pages: [], reading: { content_type: "generic", found: false, failure: "final", reason: "SOMETHING_ELSE", basis: BASIS } })));
  assert.ok(text(m).includes(BASIS), "control: a stored reading sentence is drawn as stored");
});

/* ---- R74 ---- */
const heldFor = (questions) => ok({ ok: true, held: [{ bundle_id: D, capture: { sha256: SHA, grade: { grade: "B", route: "fetched", determined: true } },
  captured_for: { questions, withheld: null } }] });

test("R74: with no capture question the sentence over the control says 'Choose a question'; with one it says 'Set to the question this document was captured for' and that question is chosen", async () => {
  const none = main(await open(at, { plane: { heldcaptures: heldFor([]) } }));
  const helpNone = none.querySelector("[data-cite-help]");
  assert.equal(helpNone && helpNone.getAttribute("data-cite-help"), "choose");
  assert.ok(says(helpNone, "screen.document.cite.choose") && !says(none, "screen.document.cite.question.help"), "the choosing sentence, not the set one");
  const p = await open(at, { plane: { heldcaptures: heldFor([{ question: Q, title: "Seven days?", asker: "mai" }]) } });
  const help = main(p).querySelector("[data-cite-help]");
  assert.equal(help && help.getAttribute("data-cite-help"), "set");
  assert.ok(says(help, "screen.document.cite.question.help"), "the set sentence");
  assert.equal(p.doc.getElementById("document-cite-question").value, Q, "and that question chosen");
});

const ANN = { viewer: V("ann"), owner: "o", author: "member:ann", identity: V("ann") };
/** the real citation service's answer to a first cite, in the role asked */
async function citeAnswer(role) {
  const w = world();
  w.info(D); w.inquiry("INQ-2026-0001");
  const h = await w.select([D]);
  return w.cit.cite({ project: "INQ-2026-0001", handle: h, ...ANN, role });
}

test("R74: after a 'cuts against' cite the line says 'Cuts against' with the question and a link to the passage; after a 'supports' cite, 'Supports'", async () => {
  for (const [role, key, other] of [["cuts_against", "screen.question.against.head", "screen.question.supports.head"], ["supports", "screen.question.supports.head", "screen.question.against.head"]]) {
    const answer = await citeAnswer(role);
    assert.deepEqual(answer.cited, [D], "the real cite cited");
    const p = await boot({ screens: SCREENS, plane: plane({ plane: { cite: ok({ ...answer, inquiry: Q }) } }), path: at });
    await p.settle();
    fill(p, { "document-cite-question": Q, "document-cite-role": role });
    await press(p, "cite");
    assert.equal(p.byOp("cite")[0].body.role, role, "the role sent is the one chosen");
    const line = main(p).querySelector("[data-cite-done=cited]");
    assert.ok(line, "the line is drawn");
    assert.equal(line.getAttribute("data-cite-role"), role);
    const bold = line.querySelectorAll("b").map((b) => text(b));
    assert.ok(bold.includes(word(key)) && !bold.includes(word(other)), `it says ${role}`);
    assert.ok(line.querySelector('a[href*="/app/question/"]'), "with the question");
    const link = line.querySelector('a[href^="#document-passage-"]');
    assert.ok(link, "and a link to the passage");
    assert.ok(main(p).querySelector("#" + link.getAttribute("href").slice(1)), "which is the passage drawn on the page");
    /* control: the options list is unchanged */
    assert.deepEqual(p.doc.getElementById("document-cite-role").querySelectorAll("option").map((o) => o.getAttribute("value")), ["supports", "cuts_against"], "control: the role's options are unchanged");
  }
});

/* ---- R62, R72: the parts the reading states today; the rest are owed (below) ---- */
test("R62 (part): a kind kept and not read (`held_unread`) draws the held sentence with its plain kind; a locked file draws the password sentence", async () => {
  const held = main(await open(at, reading({ text_units: [], unread_pages: [], reading: { content_type: "generic", found: false },
    held_unread: { name: "visio", kind_key: "file.kind.visio", text: word("file.kind.visio") } })));
  assert.ok(says(held, "screen.document.held.kind", { kind: word("file.kind.visio") }), "Visio: kept whole, not read yet");
  const locked = main(await open(at, reading({ text_units: [], unread_pages: [], reading: { content_type: "application/pdf", found: false, failure: "final", reason: "PASSWORD_REQUIRED", basis: "x" } })));
  assert.ok(says(locked, "screen.document.encrypted"), "needs a password");
  const read = main(await open(at));
  assert.ok(!says(read, "screen.document.encrypted") && !read.querySelector('[data-reading="heldkind"]'), "control: a read PDF draws neither");
});

test("R72 (part): a reading whose reader measured clarity draws how many words were hard to make out, and marks their pages; one with no measure draws none", async () => {
  const m = main(await open(at, reading({ words_read: 4000, words_total: 4000, unclear_words: { count: 7, positions: [{ page: 2, count: 7 }] } })));
  assert.ok(says(m, "screen.document.text.unsure", { unsure: "7" }), "the sentence with 7");
  const marks = m.querySelectorAll("[data-unsure]");
  assert.equal(marks.length, 1, "the passage on the page that holds them is marked");
  assert.equal(marks[0].getAttribute("data-unsure"), "7");
  assert.ok(marks[0].getAttribute("data-tip").includes(word("screen.document.text.unsure.tip_why")), "with the card");
  const plain = main(await open(at, reading({ words_read: 4000, words_total: 4000 })));
  assert.ok(!says(plain, "screen.document.text.unsure", { unsure: "7" }) && plain.querySelectorAll("[data-unsure]").length === 0, "control: no measure, no sentence, no mark");
});

/* ---- R73 (part): the stored sentences of who vouched and of a reading that found no names, drawn in the member's words; the fingerprint is owed (below) ---- */
const STORED = ["no authority is asserted", "taken from the session at op=testify", "recorded as an empty reading", "text-layer text (tier"];
const drawsNone = (el) => STORED.filter((x) => text(el).includes(x));
/** the page `path` as `me`, over the world's door and the session her sign-in made */
async function pageAs(w, me, path) {
  const { door, session } = w.boot(me);
  const p = await boot({ screens: SCREENS, door, session, path });
  await p.settle();
  return p;
}

test("R73 (part): a member's upload and her testimony draw who vouched in the member's words (`screen.document.basis.added`, `.basis.testimony`), never the stored sentence", async () => {
  const w = await storeWorld();
  const ann = await w.signIn("ann", { capabilities: ["contribute", "create_projects"] });
  const project = await w.recipes.project(ann, "Stormwater");
  const { bundle } = await w.recipes.hold(ann, "Minutes", "The council met on Monday.", project);
  const up = main(await pageAs(w, ann, "/app/document/" + bundle));
  const upLine = up.querySelector("[data-authority-basis]");
  assert.ok(upLine, "the authority's basis is drawn");
  assert.ok(text(upLine).startsWith(word("screen.document.basis.added", { at: "\u0000" }).split("\u0000")[0]), "an upload: added by a member");
  assert.deepEqual(drawsNone(up), [], "none of the stored sentences");
  const testified = await ann.act("testify", { body: { words: "I saw the pothole at 4th and Main.", observedAt: "2026-10-04T09:10:00Z" } });
  const ts = main(await pageAs(w, ann, "/app/document/" + testified.bundle_id));
  const tsLine = ts.querySelector("[data-authority-basis]");
  assert.ok(tsLine && text(tsLine).includes(word("screen.document.basis.testimony", { member: "\u0000", recorded: "" }).split("\u0000")[1].split(".")[0]), "a testimony: her own account");
  assert.deepEqual(drawsNone(ts), [], "none of the stored sentences");
  /* control: a member's decision keeps her own words */
  const { sha: sha2, bundle: b2 } = await w.recipes.hold(ann, "Letter", "Dear council.", project);
  provenanceOf(w.ctx).declareAuthority({ bundle: b2, capture: sha2, outcome: "undetermined_after_review", basis: "No issuer is named on it.", by: "ann", viewer: "member:ann" });
  assert.equal(text(main(await pageAs(w, ann, "/app/document/" + b2)).querySelector("[data-authority-basis]")), "No issuer is named on it.", "control: a decision's basis is drawn as stored");
});

test("R73 (part): a reading that found no names, in a docx's text layer, draws `screen.document.reading.nonames`; one whose text could not be parsed draws `.reading.unparsed`", async () => {
  const stated = (basis) => reading({ text_units: [], unread_pages: [], reading: { content_type: "generic", found: false, failure: "final", reason: "SOMETHING_ELSE", basis } });
  const none = main(await open(at, stated(word("reading-pipeline.why.reader_found_entities", { key: "generic", fmt: "docx", wired_tier: "1" }))));
  assert.ok(says(none, "screen.document.reading.nonames"), "no names found, in the member's words");
  assert.deepEqual(drawsNone(none), [], "neither 'recorded as an empty reading' nor 'text-layer text (tier 1)'");
  const bad = main(await open(at, stated(word("reading-pipeline.why.reader_parse_text", { key: "generic", fmt: "docx", parse_error: "x" }))));
  assert.ok(says(bad, "screen.document.reading.unparsed"), "the text could not be parsed, in the member's words");
  assert.deepEqual(drawsNone(bad), [], "never the text layer's tier");
});

/* ---- R70, R71: the shared picker (interface-shell R138's `cs.picker`), read once opened ---- */
const OWN = { capabilities: ["contribute", "create_projects"] };
const pickerOf = (p, kind) => main(p).querySelector(`[data-picker="${kind}"]`);
const offeredIn = (p, kind, scope) => pickerOf(p, kind).querySelectorAll(`[data-scope="${scope}"] input`).filter((i) => i.getAttribute("type") === "radio").map((i) => i.getAttribute("value"));
const listReads = (p) => p.byOp("heldcaptures").filter((r) => !r.query.bundle_id);
/** ann with a document in project A (this one), another in A and one in B */
async function twoProjects({ withB = true } = {}) {
  const w = await storeWorld();
  const ann = await w.signIn("ann", OWN);
  const a = await w.recipes.project(ann, "Pothole repairs");
  const b = withB ? await w.recipes.project(ann, "The Coliseum lease") : null;
  const here = await w.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project: a });
  const inA = await w.recipes.hold(ann, "Work orders 2025", "Closed work orders for the year.", a);
  const inB = withB ? await w.recipes.hold(ann, "Lease draft", "The draft lease for the Coliseum.", b) : null;
  return { w, ann, a, b, here: here.bundle, inA: inA.bundle, inB: inB && inB.bundle };
}

test("R70: the connect fold's picker is the shared one: it lists project A's documents only, and its control adds B's; choosing B's and pressing 'Connections you assert' sends that document", async () => {
  const t = await twoProjects();
  const p = await pageAs(t.w, t.ann, "/app/document/" + t.here);
  await p.choose("#document-pick-open-connect-0");
  assert.deepEqual(offeredIn(p, "connect", "here"), [t.inA], "A's only, this document excepted");
  assert.equal(pickerOf(p, "connect").querySelector('[data-scope="others"]'), null, "B's not before the control");
  const control = p.doc.getElementById("connect-wide-0");
  assert.ok(control && text(control.parentNode).includes(word("form.choose.widen.documents")), "the kit's control, by its word");
  await p.choose("#connect-wide-0");
  assert.deepEqual(offeredIn(p, "connect", "others"), [t.inB], "the control adds B's, A's not repeated");
  assert.deepEqual(pickerOf(p, "connect").querySelectorAll('[data-scope="others"] legend').map(text), ["The Coliseum lease"], "under its project");
  const b = pickerOf(p, "connect").querySelectorAll("input").find((i) => i.getAttribute("value") === t.inB);
  b.checked = true; p.fire(b, "change"); await p.settle();
  fill(p, { "document-assert-basis": "The lease names the same contractor." });
  await press(p, "connectionassert");
  assert.deepEqual(p.byOp("connectionassert")[0].body, { a: t.here, b: t.inB, basis: "The lease names the same contractor." }, "the document chosen from B is sent");
});

test("R70 control: with documents in one project only, the picker draws no control", async () => {
  const t = await twoProjects({ withB: false });
  const p = await pageAs(t.w, t.ann, "/app/document/" + t.here);
  await p.choose("#document-pick-open-connect-0");
  assert.deepEqual(offeredIn(p, "connect", "here"), [t.inA]);
  assert.equal(p.doc.getElementById("connect-wide-0"), null, "no control");
});

test("R71: the Document screen's first wave reads no list of `heldcaptures`; the picker reads it once opened", async () => {
  const t = await twoProjects();
  const p = await pageAs(t.w, t.ann, "/app/document/" + t.here);
  assert.ok(main(p).querySelector('[data-picker="connect"]'), "the screen is drawn, its picker closed");
  assert.deepEqual(listReads(p), [], "no `heldcaptures` list read on open");
  await p.choose("#document-pick-open-connect-0");
  assert.ok(listReads(p).length >= 1, "read as the picker's read, on open");
  assert.ok(listReads(p).every((r) => r.query.state === "held_and_vouched"), "the picker's read");
});

test("R71 control: Held still reads `heldcaptures` on open", async () => {
  const t = await twoProjects({ withB: false });
  const { door, session } = t.w.boot(t.ann);
  const p = await boot({ screens: [HELD_SCREEN], door, session, path: "/app/held" });
  await p.settle();
  assert.ok(p.byOp("heldcaptures").length >= 1, "Held reads it on open");
});

/* ---- R73: the member's words, and no fingerprint printed whole ---- */
test("R73: documents of four sources (an upload, a testimony, a docx's empty reading, a reading not parsed) draw none of the stored sentences and no 64-hex string; the fingerprint is a short mark whose Copy holds the whole", async () => {
  const w = await storeWorld();
  const ann = await w.signIn("ann", OWN);
  const project = await w.recipes.project(ann, "Stormwater");
  const { bundle, sha } = await w.recipes.hold(ann, "Minutes", "The council met on Monday.", project);
  const testified = await ann.act("testify", { body: { words: "I saw the pothole at 4th and Main.", observedAt: "2026-10-04T09:10:00Z" } });
  const HEX = /[0-9a-f]{64}/;
  for (const path of ["/app/document/" + bundle, "/app/document/" + testified.bundle_id]) {
    const m = main(await pageAs(w, ann, path));
    assert.deepEqual(drawsNone(m), [], path + ": none of the stored sentences");
    assert.ok(!HEX.test(text(m)), path + ": no 64-hex string printed");
  }
  const stated = (basis) => reading({ text_units: [], unread_pages: [], reading: { content_type: "generic", found: false, failure: "final", reason: "SOMETHING_ELSE", basis } });
  for (const basis of [word("reading-pipeline.why.reader_found_entities", { key: "generic", fmt: "docx", wired_tier: "1" }), word("reading-pipeline.why.reader_parse_text", { key: "generic", fmt: "docx", parse_error: "x" })]) {
    const m = main(await open(at, stated(basis)));
    assert.deepEqual(drawsNone(m), []);
    assert.ok(!HEX.test(text(m)), "no 64-hex string printed");
  }
  /* the fingerprint: the short mark, with a way to copy the whole */
  const p = await pageAs(w, ann, "/app/document/" + bundle);
  const mark = main(p).querySelector('[data-fingerprint="capture"]');
  assert.equal(text(mark), sha.slice(0, 8) + "…" + sha.slice(-4), "a short mark");
  const copied = [];
  p.win.navigator = { clipboard: { writeText: (t) => copied.push(t) } };
  await p.click(main(p).querySelector('button[data-act="hashcopy"]'));
  assert.deepEqual(copied, [sha], "Copy puts the whole on the clipboard");
  /* control: the stored sentence is unchanged in the record */
  const prov = JSON.parse((await ann.read("image", { query: { id: bundle } }))["data/provenance.json"]);
  assert.equal(prov.documents[0].capture.sha256, sha, "the record keeps the whole");
});

/* ---- R75: a document page with nothing to show has a way out ---- */
test("R75: `document` with an unknown id, or bare, draws R35's 'Nothing is here' with the way back to its place as R61 draws it, its crumbs links, and no separate 'Go to Home'", async () => {
  const w = await storeWorld();
  const ann = await w.signIn("ann", OWN);
  for (const path of ["/app/document/INFO-2099-9999", "/app/document"]) {
    const p = await pageAs(w, ann, path);
    const root = p.doc.querySelector("main") || main(p);
    const state = root.querySelector('[data-unavailable="nothing"]');
    assert.ok(state && says(state, "shell.unavailable.nothing.says"), path + ": Nothing is here");
    const back = root.querySelectorAll("a.cs-btn").find((a) => a.getAttribute("href") === "/app/project");
    assert.ok(back && text(back).includes(word("rail.projects.name")), path + ": the way back to its place, Projects");
    assert.ok(!text(root).includes(word("shell.unavailable.home")), path + ": no separate 'Go to Home'");
    const crumbs = root.querySelector("nav.mk-crumbs");
    assert.ok(crumbs && crumbs.querySelector('a[href="/app/project"]'), path + ": its crumbs are links");
  }
  /* control: a known id is unchanged */
  const project = await w.recipes.project(ann, "Stormwater");
  const { bundle } = await w.recipes.hold(ann, "Minutes", "The council met on Monday.", project);
  const known = await pageAs(w, ann, "/app/document/" + bundle);
  assert.equal((known.doc.querySelector("main") || main(known)).querySelector("[data-unavailable]"), null, "control: the document is drawn");
});

/* ---- owed: each waits on a provider this module does not hold ---- */
test.todo("R58: the door 'A source' for listed members (waits on a route for sources' `sourceLinksFor`, sources R23)");
test.todo("R59: typed words cited with their label and grade (waits on cite of a typing's handle and the cite picker offering typings)");
test.todo("R60: 'Follow from here' on the document (waits on interface-shell R139 `cs.follow` and the `followfrom` op)");
test.todo("R62: the macro, page-of-a-TIFF and converted-copy sentences (waits on the reading stating macros, a page's place in a multi-page file and a converted original)");
test.todo("R63: a photograph's safe picture, when and where, and what was left out (waits on a read that carries image-cover's `facts` and `left_out` to the page)");
test.todo("R64: the 'Interpreted' fact row (waits on an op for extraction's `interpretationOf`)");
test.todo("R65: 'Interpret parts of this for {investigation}' (waits on the `interpretmark` op, owed in the registry)");
test.todo("R66: the part chooser (waits on `interpretmark`)");
test.todo("R67: citing or opening a part says it was interpreted (waits on `interpretationOf`)");
test.todo("R68: the margin bars of what is interpreted (waits on `interpretationOf`)");
test.todo("R69: the document's chips on the ceiling scale (waits on interface-shell R140)");
test.todo("R72: each hard word underlined dotted (waits on the reading stating each word's position; it states a count per page)");

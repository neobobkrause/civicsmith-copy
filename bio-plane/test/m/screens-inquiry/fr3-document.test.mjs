/* screens-inquiry fix round 2 of T51 (SCREENS-INQUIRY #18, package A), the `document` screen: C31 (R125, R3: the cite act sends a body and marks the
 * passage), C33 (R123, R55, R113: retire's refusals in their own sentences; a held copy is set aside, not retired), C40 (R55: one act obtains both
 * confirmations), C42 (R124, R69: a move of citations only where it can be done), C95 (R3: the cite picker), C94 (interface-shell R111: members by
 * handle), C17 (R96: "read N of M words"), DEC-394 (3d, 3e: R126 `resolvetestify`, R127 `contradictionflag`), C41 (R117, R35, R50: the unplaced legs).
 * On interface-shell's served page over a scripted plane; the shell's guard checks every request against its owner's declaration. Every expectation
 * is a word read by key (K3810); no test holds a sentence's English. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { ok, refusedIn, boot } from "../interface-shell/harness.mjs";
import { unnamedFounderWorld } from "../store-request/fixtures.mjs";
import { main, actsIn, fill, press, says, section, word, plane, storeWorld, WORLD_FOUNDER_HANDLE, READING, DOCUMENT_MD, provenanceOf, inquiryMd, INQUIRY_REFS, SCREENS, P, Q, Q2, D, SHA, NEWER } from "./fixtures.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
async function openWith(path, o = {}) {
  const p = await boot({ screens: SCREENS, plane: plane(o), path, ...(o.boot || {}) });
  await p.settle();
  return p;
}
/** A choice changed as a member does it: the value set and the change fired (the kit's choice that redraws, interface-shell R90). */
async function choose(p, id, value) {
  const el = p.doc.getElementById(id);
  el.value = value;
  p.fire(el, "change");
  await p.settle();
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
const PARAGRAPHS = ["The Director shall repair each reported pothole within seven calendar days of the report.", "Repairs are recorded as closed when the crew reports the work complete."];
const pageHtml = (paragraphs) => `<html><head><title>Council minutes</title></head><body>\n<h1>Council minutes</h1>\n${paragraphs.map((t) => `<p>${t}</p>`).join("\n")}\n</body></html>`;
/** A member `ann` with a project, two questions in it (`seven`, `closed`) and a copy of a web page held by her (read: its passages are the two paragraphs). With `forQuestion` the copy was
 *  captured from a public address for `closed` (`acquire` with `for`, the address served by the world's network, `world.script`) and filed as held (`recipes.hold` of the same bytes),
 *  so its held row names that question; with `vouch` she has also vouched for it (`select`, `release`). `cites` are questions of the project made resting on the copy (their titles). */
async function member({ forQuestion = false, vouch = false, cites = [] } = {}) {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const seven = (await world.recipes.question(ann, project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", draw: true })).id;
  const closed = (await world.recipes.question(ann, project, { title: "Closed", text: "Does closed mean repaired?", draw: true })).id;
  const html = pageHtml(PARAGRAPHS);
  if (forQuestion) {
    const address = "https://records.example.org/minutes.html";
    world.script(address, async () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
    await ann.act("acquire", { body: { locator: address, for: closed } });
  }
  const doc = await world.recipes.hold(ann, "Council minutes", html, project, { type: "text/html", read: true });
  if (vouch) {
    const sel = await ann.act("select", { body: { ids: [doc.bundle] } });
    await ann.act("release", { query: { handle: sel.handle, acknowledgment: "Checked against the site", mitigation: "None needed" } });
  }
  const citing = [];
  for (const title of cites) citing.push((await world.recipes.question(ann, project, { title, text: title, legs: [{ target: doc.bundle, role: "supports" }], draw: true })).id);
  const units = (await ann.read("reading", { query: { sha256: doc.sha } })).text_units;
  return { world, ann, project, seven, closed, citing, document: doc.bundle, sha: doc.sha, units, at: "/app/document/" + doc.bundle };
}

/* ---- C31 / R125 / R3: the cite act sends a body and marks the passage ---- */
test("R125 R3 C31 the cite act sends the project, role and passage in the request body and none of them in the address", async () => {
  const w = await member();
  const p = await pageOn(w.world, w.ann, w.at);
  await choose(p, "document-cite-question", w.seven);
  fill(p, { "document-cite-role": "cuts_against" });
  await press(p, "cite");
  const r = p.byOp("cite")[0];
  const found = typeof r.body.found === "string" ? JSON.parse(r.body.found) : r.body.found;
  assert.deepEqual([r.body.project, r.body.role, found], [w.seven, "cuts_against", { capture_sha: w.sha, extent: w.units[0].extent, kind: "passage" }], "the body carries the three fields");
  for (const f of ["project", "role", "found"]) assert.ok(!(f in r.query), `control: ${f} is not in the address`);
  assert.equal(p.answers("cite")[0].cited.length, 1, "the world cited the passage");
});

test("R125 R3 C31 once cited, the passage is marked on the reading as cited by this question; control: a passage not cited, and a reading before any cite, draw no mark", async () => {
  const w = await member();
  const p = await pageOn(w.world, w.ann, w.at);
  assert.equal(main(p).querySelector("[data-passage-cited]"), null, "control: nothing cited, no mark");
  await choose(p, "document-cite-question", w.seven);
  assert.equal(main(p).querySelector("[data-passage-cited]"), null, "control: the question chosen, the passage not cited in it, no mark");
  await press(p, "cite");
  const marks = main(p).querySelectorAll("[data-passage-cited]");
  assert.equal(marks.length, 1, "the passage cited is marked, and the other passage draws none (control)");
  const mark = marks[0];
  assert.equal(mark.getAttribute("data-passage-cited"), w.seven, "as cited by this question");
  assert.ok(says(mark, "screen.finder.cite.cited") && mark.querySelector(`a.cs-ref[href="/app/question/${w.seven}"]`), "by its key, with the question as a reference");
  /* a question that holds a leg on this document at that passage is marked without a cite at all (the question the copy was held for) */
  const h = await member({ forQuestion: true });
  await h.ann.act("cite", { body: { project: h.closed, role: "supports", found: { capture_sha: h.sha, extent: h.units[0].extent, kind: "passage" } } });
  const held = await pageOn(h.world, h.ann, h.at);
  assert.equal(held.doc.getElementById("document-cite-question").value, h.closed);
  assert.equal(main(held).querySelector("[data-passage-cited]").getAttribute("data-passage-cited"), h.closed, "the question already holding a leg there marks the passage");
});

/* ---- C33 / R123 / R55 / R113: retire, and a held copy ---- */
const HELD_ROW = { bundle_id: D, title: "Pothole repair policy", project: P, collected_since: "2026-10-02T09:00:00Z", capture: { sha256: SHA, grade: { grade: "B" } },
  captured_for: { questions: [{ question: Q, title: "Seven days?", asker: "mai" }], withheld: null } };
const dialog = (p) => p.root().querySelector('[role="dialog"]');
const slotOf = (p, op) => p.root().querySelector(`[data-slot="${p.root().querySelector(`button[data-act="${op}"]`).getAttribute("data-ai")}"]`);
/** Retire pressed and confirmed with a reason; the slot beside the act, where the answer is drawn. */
async function retireIt(p) {
  await press(p, "retire");
  const slot = slotOf(p, "retire");
  dialog(p).querySelector("textarea").value = "the scan is of the wrong report";
  await p.click(dialog(p).querySelector('[data-shell="confirm"]'));
  await p.settle();
  return slot;
}

test("R123 R55 R113 C33 a held copy offers no retire; control: a vouched copy offers it, as does a copy of no held row", async () => {
  const w = await member();
  const held = await pageOn(w.world, w.ann, w.at);
  assert.ok(main(held).querySelector("[data-held]"), "the copy is held");
  assert.ok(!actsIn(main(held)).includes("retire"), "a held copy offers no retire");
  assert.equal(main(held).querySelector('[data-fold="retire"]'), null, "nor the fold that holds it");
  assert.ok(!actsIn(main(held)).includes("heldsetaside"), "and draws no set-aside act of its own");
  const door = main(held).querySelector("a[data-held-door]");
  assert.ok(door && door.getAttribute("href") === "/app/held" && door.hasAttribute("data-nav") && says(door, "screen.held.name"), "but a door to the Held screen, where it is set aside");
  fill(held, { "document-release-ack": "Checked", "document-release-mitigation": "None needed" });
  await press(held, "release");
  assert.ok(main(held).querySelector("[data-vouched]"), "vouched for");
  assert.ok(actsIn(main(held)).includes("retire"), "control: a vouched copy offers retire");
  assert.equal(main(held).querySelector("a[data-held-door]"), null, "control: a vouched copy draws no door");
  /* a copy of another member's, in a project she has joined, is no held row of hers */
  const rosa = await w.world.signIn("rosa", OWN);
  const hers = await w.world.recipes.project(rosa, "Rosa's project");
  await rosa.act("projectinvite", { query: { projectId: hers, handle: "ann" }, body: {} });
  await w.ann.act("projectjoin", { query: { projectId: hers }, body: {} });
  const copy = await w.world.recipes.page(rosa, "Rosa's page", { project: hers });
  const plain = await pageOn(w.world, w.ann, "/app/document/" + copy.bundle);
  assert.ok(actsIn(main(plain)).includes("retire"), "control: a copy that is no held row of hers offers retire");
});

test("R123 R113 C33 retire answered CITED draws the questions that cite the copy as references and not the release act's sentence", async () => {
  const w = await member({ vouch: true, cites: ["Seven days?", "Does closed mean repaired?"] });
  const p = await pageOn(w.world, w.ann, w.at);
  const slot = await retireIt(p);
  assert.equal(p.answers("retire")[0].reason, "CITED", "the world refuses it");
  const refs = slot.querySelectorAll("a.cs-ref");
  assert.deepEqual(refs.map((a) => a.getAttribute("href")).sort(), w.citing.map((q) => "/app/question/" + q).sort(), "both questions, each a door to its page");
  assert.deepEqual(refs.map(text).sort(), ["Does closed mean repaired?", "Seven days?"], "named by their titles");
  assert.ok(!says(slot, "refusal.ILLEGAL_TRANSITION"), "never the release act's sentence");
  assert.ok(text(slot).includes(word("screen.document.retire.refused.cited", { questions: "" }).split("{")[0].trim().slice(0, 20)), "the cited sentence is drawn by its key");
  /* a refusal that lists no offenders cannot exist: the owner's CITED always names the offending copy and its citers (promotion/index.mjs:802) */
});

test("R123 R113 C33 retire answered ILLEGAL_TRANSITION does not draw the release act's sentence", async () => {
  const illegal = { status: 200, json: { ok: true, result: { ok: false, reason: "ILLEGAL_TRANSITION", code: "ILLEGAL_TRANSITION", translation: word("refusal.ILLEGAL_TRANSITION"), to: "retired" } } };
  const w = await member({ vouch: true });
  /* scripted: the retire's refusal (needs a recipe that brings a copy to a state the world refuses to retire it from) */
  const p = await pageOn(w.world, w.ann, w.at, { plane: { retire: illegal } });
  const slot = await retireIt(p);
  assert.ok(!says(slot, "refusal.ILLEGAL_TRANSITION") && !text(slot).includes(word("refusal.ILLEGAL_TRANSITION")), "not the release sentence");
  assert.ok(says(slot, "screen.document.retire.refused.illegal"), "its own sentence, by key");
  assert.equal(p.byOp("retire").length, 1, "the retire was sent");
  /* control: a vouched, uncited copy retires as before */
  const ok2 = await pageOn(w.world, w.ann, w.at);
  await retireIt(ok2);
  assert.equal(ok2.answers("retire")[0].ok, true, "the world retired it");
  assert.ok(main(ok2).querySelector("[data-retired]"), "control: retired as before");
});

/* ---- C40 / R55: one act obtains both confirmations ---- */
const TOKEN = { file: "snapshots/timestamp-abc.tsr", kind: "rfc3161", service: "tsa", sha256: "a".repeat(64), bytes: 10, over: SHA };
const attestAnswer = (o) => ({ status: 200, json: { ok: true, result: { attempts: [], ...o } } });
async function attestIt(p) {
  await press(p, "attest");
  const slot = slotOf(p, "attest");
  await p.click(p.root().querySelector('[data-shell="confirm"]'));
  await p.settle();
  return slot;
}
const WEB = DOCUMENT_MD;
const HTTP_MD = DOCUMENT_MD.replace("https://example.org/ai-4-12.pdf", "http://example.org/ai-4-12.pdf");
const TESTIMONY_MD = ["---", `id: ${D}`, "object_type: information", "title: \"The pothole at 4th and Main\"", `project: ${P}`, "source:", "  locator: \"a member's firsthand observation, authored in this record\"",
  "  retrieved: 2026-10-04T09:00:00Z", "---", "", "## Provenance Notes", "", word("provenance.testify.provenance_notes", { obs: "2026-10-04T09:00:00Z", recorded: "2026-10-04T09:00:00Z" }), ""].join("\n");
const withMd = (md) => ({ images: { [D]: { "bundle.md": md, "data/provenance.json": provenanceOf(SHA) } } });

/** A copy captured from a public address for a question and brought back from aside (`recipes.setAside`, `heldrestore`): the world's network serves the address. */
async function remoteCopy() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const made = await world.recipes.setAside(ann);
  await ann.act("heldrestore", { body: { ids: [made.document], reason: "brought back for the page" } });
  const held = (await ann.read("heldcaptures", { query: { bundle_id: made.document } })).held[0];
  return { world, ann, ...made, address: held.source.address, at: "/app/document/" + made.document };
}

test("R55 C40 attest sends the digest, the archive request and the document's public https address; a testimony, an http address and a local host send neither", async () => {
  const c = await remoteCopy();
  const p = await pageOn(c.world, c.ann, c.at);
  await attestIt(p);
  assert.deepEqual(p.byOp("attest")[0].body, { sha256: c.sha, archive: true, locator: c.address });
  assert.equal(p.answers("attest").length, 1, "the world answered the attestation");
  /* a copy held at an http address, a local host or a bare IP cannot exist: the capture refuses such a locator (BAD_LOCATOR, acquisition/index.mjs:1140). The copies that have no public https address are a member's
     own testimony and a page she brought in: neither asks for the archive */
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const testified = await ann.act("testify", { body: { words: "I saw the pothole at 4th and Main.", observedAt: "2026-10-04T09:10:00Z" } });
  const brought = await world.recipes.page(ann, "Policy memo", {});
  for (const bundle of [testified.bundle_id, brought.bundle]) {
    const q = await pageOn(world, ann, "/app/document/" + bundle);
    await attestIt(q);
    assert.deepEqual(Object.keys(q.byOp("attest")[0].body), ["sha256"], "control: no archive asked for an address that is not public https");
  }
});

test("R55 C40 attest says which of the two is still missing, in words that exist; both obtained says done only; neither is refused as before", async () => {
  /* the time-stamping authority and the archive stand in the world's network as `recipes.attested` makes them answer (up or down); the page's own press is the second ask of the owner */
  const pressed = async (net) => {
    const world = await storeWorld();
    const ann = await world.signIn("ann", OWN);
    const made = await world.recipes.attested(ann, net);
    const p = await pageOn(world, ann, "/app/document/" + made.document);
    return { p, slot: await attestIt(p) };
  };
  const outcome = (p) => text(main(p).querySelector('[data-outcome="attest"]'));
  const both = await pressed({ tsa: true, archive: true });
  assert.ok(says(main(both.p), "screen.document.attest.done") && !outcome(both.p).includes(word("filings.trusted_timestamp_archive")), "both: done only");
  const noArchive = await pressed({ tsa: true, archive: false });
  assert.ok(says(main(noArchive.p).querySelector('[data-outcome="attest"]'), "filings.trusted_timestamp_archive"), "a timestamp and no co-archive");
  assert.ok(!says(main(noArchive.p).querySelector('[data-outcome="attest"]'), "screen.document.attest.done"));
  const noStamp = await pressed({ tsa: false, archive: true });
  assert.ok(says(slotOf(noStamp.p, "attest"), "filings.archive_trusted_timestamp"), "a co-archive and no trusted timestamp");
  const neither = await pressed({ tsa: false, archive: false });
  assert.ok(!says(neither.slot, "filings.archive_trusted_timestamp") && !says(neither.slot, "filings.trusted_timestamp_archive") && !says(main(neither.p), "screen.document.attest.done"), "neither: the refusal as before");
  assert.ok(text(neither.slot).includes(word("refusal.NO_ATTESTATION")) || says(neither.slot, "refusal.NO_ATTESTATION"), "refused in the owner's words");
});

/* ---- C42 / R124 / R69: a move of citations only where it can be done ---- */
const NOTICE = (newer = NEWER) => (r) => ok({ ok: true, notices: r.query.holder === Q ? [{ notice: "REN-1", id: "REN-1", holder: Q, target: D, state: "open", capture_sha: SHA, newer_capture: newer, affects: "unaffected" }] : [] });
const CHAIN = (shas) => ok({ ok: true, at_index: 0, versions: shas.map((s, i) => ({ capture_sha: s, first_retrieved: `2026-10-0${i + 2}T09:00:00Z` })) });
const legRow = (p) => main(p).querySelector(`[data-leg-row="${Q}"]`);

test("R124 R69 C42 a newer copy with a chain offers Move my citations; one nothing was captured for, or one with no text, offers none and says what is missing", async () => {
  const withChain = await openWith(at, { plane: { reevaluationnotices: NOTICE(), versionchain: CHAIN([SHA, NEWER]) } });
  assert.deepEqual(actsIn(legRow(withChain)).sort(), ["adoptversion", "keepversion"], "captured, with a reading chain: both acts");
  assert.equal(withChain.byOp("reading").filter((r) => r.query.sha256 === NEWER).length, 1, "the newer copy's reading is read");
  const observed = await openWith(at, { plane: { reevaluationnotices: NOTICE(), versionchain: CHAIN([SHA]) } });
  assert.deepEqual(actsIn(legRow(observed)), ["keepversion"], "a change observed, nothing captured: no move");
  assert.ok(!says(legRow(observed), "refusal.CONTENT_EXTENT_NO_CHAIN"), "and no chain is claimed missing for a copy that was never captured");
  const noText = await openWith(at, { plane: { reevaluationnotices: NOTICE(), versionchain: CHAIN([SHA, NEWER]),
    reading: (r) => ok(r.query.sha256 === NEWER ? READING({ text_units: [], unread_pages: [] }) : READING()) } });
  assert.deepEqual(actsIn(legRow(noText)), ["keepversion"], "captured but no text: no move");
  assert.ok(says(legRow(noText), "refusal.CONTENT_EXTENT_NO_CHAIN"), "and it says what is missing");
  const none = await openWith(at, { plane: { reevaluationnotices: ok({ ok: true, notices: [] }), versionchain: CHAIN([SHA, NEWER]) } });
  assert.deepEqual(actsIn(legRow(none)), ["versionnotice"], "control: no newer copy offers neither act");
});

/* ---- C95 / R3: the cite picker: this project first, a search box, title and date ---- */
const MANY = Array.from({ length: 30 }, (_, i) => ({ bundle_id: `INQ-2026-01${String(i).padStart(2, "0")}-x`, title: `${i % 3 === 0 ? "Budget" : "Lease"} question ${i}`, created: "2026-09-15T10:00:00Z" }));
const MANY_LIST = ok({ bundles: [...MANY, { bundle_id: Q, title: "Is the city repairing reported potholes within seven days?", created: "2026-10-03T10:00:00Z" }, { bundle_id: Q2, title: "Does closed mean repaired?" }] });
const pickerValues = (p) => p.doc.getElementById("document-cite-question").querySelectorAll("option").map((o) => o.getAttribute("value"));
async function typeSearch(p, value) {
  const el = p.doc.getElementById("document-cite-search");
  el.value = value;
  p.fire(el, "input");
  await p.clock.tick(600);
  await p.settle();
}

test("R3 C95 the cite picker has a search box: typing a word narrows the questions to the titles holding it, this project's first; the question chosen is kept; each carries its date", async () => {
  const p = await openWith(at, { plane: { list: MANY_LIST } });
  const all = pickerValues(p);
  assert.equal(all.length, 1 + 32, "control: nothing typed lists every question after the choose option");
  assert.deepEqual(all.slice(1, 3), [Q, Q2], "control: this project's own questions first");
  await typeSearch(p, "BUDGET");
  const some = pickerValues(p);
  assert.equal(some.filter((v) => v && v !== Q && v !== Q2).length, 10, "the ten Budget titles, whatever the case typed");
  assert.ok(!some.includes(Q) && !some.includes(Q2), "this project's questions that do not match are gone");
  assert.ok(some.slice(1).every((v) => MANY.find((m) => m.bundle_id === v).title.startsWith("Budget")));
  /* a question chosen stays whatever is typed */
  await typeSearch(p, "");
  await choose(p, "document-cite-question", Q);
  await typeSearch(p, "lease");
  assert.ok(pickerValues(p).includes(Q), "the chosen question is kept though the search hides it");
  assert.equal(p.doc.getElementById("document-cite-question").value, Q);
  /* title and date */
  const opt = p.doc.getElementById("document-cite-question").querySelectorAll("option").find((o) => o.getAttribute("value") === Q);
  assert.ok(text(opt).includes("Is the city repairing") && text(opt).includes(word("date.daymonthyear", { day: "3", month: word("date.month.october"), year: "2026" })), "title and date in the option");
});

/* ---- C94 / interface-shell R111: members named by handle ---- */
test("C94 R111 a member the record names is drawn by her handle, the founder's id included, never by the id; an id with no handle known draws the plain word", async () => {
  const w = await member();
  const founder = await w.world.signIn(WORLD_FOUNDER_HANDLE);
  /* the founder's member id is `admin`, her handle is not; both declare where the copy came from (provenance R64) */
  await founder.act("declareorigin", { body: { bundleId: w.document, system: "Portal" } });
  await w.ann.act("declareorigin", { body: { bundleId: w.document, system: "Email" } });
  const p = await pageOn(w.world, w.ann, w.at);
  const rows = section(p, "screen.document.origin.head").querySelectorAll("[data-origin]");
  assert.ok(text(rows[0]).includes(WORLD_FOUNDER_HANDLE) && text(rows[1]).includes("ann"), "each one's handle");
  const all = text(main(p));
  assert.doesNotMatch(all, /\badmin\b/, "never the founder's id");
  /* control: the founder holds no handle (a claim made with none, `unnamedFounderWorld`): she is the unnamed founder, the other keeps the handle she declared by */
  const bare = await unnamedFounderWorld();
  const ben = await bare.signIn("ann", OWN);
  const doc = await bare.recipes.page(ben, "Policy memo", {});
  await bare.unnamed.act("declareorigin", { body: { bundleId: doc.bundle, system: "Portal" } });
  await ben.act("declareorigin", { body: { bundleId: doc.bundle, system: "Email" } });
  const none = await pageOn(bare, ben, "/app/document/" + doc.bundle);
  const r2 = section(none, "screen.document.origin.head").querySelectorAll("[data-origin]");
  assert.ok(text(r2[0]).includes(word("member.founder.unnamed")) && text(r2[1]).includes("ann"), "control: no handle known draws the fallback word: " + r2.map(text).join(" | "));
  /* an id the record names that no member of the roster holds draws the plain word (scripted: the origins, since the world's records name only members it holds) */
  const stray = await pageOn(w.world, w.ann, w.at, { plane: { origins: ok({ ok: true, bundleId: w.document, origins: [{ seq: 1, system: "Paper", by: "m-99", at: "2026-10-03T09:00:00Z" }] }) } });
  const r3 = section(stray, "screen.document.origin.head").querySelectorAll("[data-origin]");
  assert.ok(text(r3[0]).includes(word("shell.card.member")) && !text(main(stray)).includes("m-99"), "an unknown id draws the plain word, never the id");
});

/* ---- C17 / R96: "read N of M words" ---- */
test("R96 R3 C17 a reading that counts its words draws Read N of M words beside the text state; one that does not draws none", async () => {
  const p = await openWith(at, { plane: { reading: ok(READING({ words_read: 80, words_total: 100, unread_pages: [] })) } });
  const facts = main(p).querySelector(".mk-facts");
  assert.ok(says(facts, "screen.document.text.read", { read: "80", total: "100" }), "beside the text state, in the facts row");
  assert.ok(facts.querySelector("[data-text-state]"), "the state itself is still drawn");
  const none = await openWith(at);
  assert.equal(main(none).querySelector("[data-words-read]"), null);
});

/* ---- C41 / R117 / R35 / R50: the unplaced legs ---- */
const LEG_A = "INFO-2026-0005", LEG_B = "INFO-2026-0006", LEG_C = "INFO-2026-0007";
const docMd = (id, title) => ["---", `id: ${id}`, "object_type: information", `title: ${JSON.stringify(title)}`, "---", "", "## Summary", ""].join("\n");
const adoptRefused = (legs) => ({ status: 200, json: { ok: true, result: { ok: false, reason: "BASIS_VERSION_REFUSED", code: "BASIS_VERSION_REFUSED",
  findings: [{ check: "C-2.8", code: "VERSION_PARTITION_INCOMPLETE", detail: "a supporting leg has no ground", ...(legs ? { legs } : {}) }, { check: "C-9.9", detail: "second finding" }] } } });
const noticeOpen = (r) => ok({ ok: true, notices: r.query.holder === Q ? [{ id: "REN-1", state: "open", capture_sha: SHA, newer_capture: NEWER }] : [] });
async function adoptWith(legs) {
  const base = plane();
  const p = await openWith(at, { plane: { reevaluationnotices: noticeOpen, adoptversion: adoptRefused(legs),
    image: (r) => (r.query.id === LEG_A ? ok({ "bundle.md": docMd(LEG_A, "Work orders 2025") }) : r.query.id === LEG_B ? ok({ "bundle.md": docMd(LEG_B, "Crew log") }) : r.query.id === LEG_C ? ok(null) : base.image(r)) } });
  fill(p, { "document-version-why-REN-1": "the newer one adds the supervisor" });
  return text(await press(p, "adoptversion"));
}

test("R117 R35 R50 C41 a basis version refused for unplaced legs names each leg by its document's title, after the finding; a leg with no title draws the plain word once; control: a finding with no legs draws as before", async () => {
  const said = await adoptWith([LEG_A, LEG_B, LEG_C]);
  assert.ok(said.includes("a supporting leg has no ground") || said.includes(word("refusal.VERSION_PARTITION_INCOMPLETE")), "the first finding as before");
  assert.ok(said.includes("Work orders 2025") && said.includes("Crew log"), "both legs named by title");
  assert.equal(said.split(word("shell.card.document")).length - 1, 1, "the untitled leg draws the plain word once");
  assert.ok(!said.includes(LEG_A) && !said.includes(LEG_B) && !said.includes("second finding"), "never an id; the first finding only");
  const bare = await adoptWith(null);
  assert.ok(!bare.includes("Work orders 2025") && !bare.includes(word("shell.card.document")), "control: no legs, nothing added");
});

/* ---- DEC-394 (3d) R126: resolvetestify ---- */
const testifyFold = (p) => main(p).querySelector('[data-fold="testify"]');

test("R126 DEC-394 resolvetestify: a name the record matched to no subject is listed with a field for who it is and how she knows; it sends the declared fields; no how, nothing is sent; control: no unmatched name, no fold", async () => {
  /* the real state: a staff directory read, one name matched to a person and the rest matched to none, and a second entity she may say a name is (`recipes.unmatchedPerson`, no testimony yet) */
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const dir = await world.recipes.unmatchedPerson(ann, { project, testify: false });
  const unresolved = (await ann.read("resolutions", { query: { sha256: dir.sha } })).unresolved;
  const p = await pageOn(world, ann, "/app/document/" + dir.bundle);
  const fold = testifyFold(p);
  assert.ok(fold && says(fold, "screen.document.testify.head") && says(fold, "screen.document.testify.note3"), "the fold and its notes by key");
  const which = p.doc.getElementById("document-testify-which").querySelectorAll("option");
  assert.deepEqual(which.map((o) => o.getAttribute("value")), unresolved.map((_, i) => String(i)), "each name the read gives, none preselected over the first");
  fill(p, { "document-testify-which": "1", "document-testify-who": dir.people[1] });
  assert.ok(says(await press(p, "resolvetestify"), "screen.document.testify.refused"), "no how: refused in place");
  assert.equal(p.byOp("resolvetestify").length, 0, "nothing sent");
  fill(p, { "document-testify-how": "I was at the meeting." });
  await press(p, "resolvetestify");
  assert.deepEqual(p.byOp("resolvetestify")[0].body, { captureSha: dir.sha, ref: unresolved[1].ref, entityId: dir.people[1], basis: "I was at the meeting." });
  const plain = await world.recipes.page(ann, "Plain memo", { project });
  const none = await pageOn(world, ann, "/app/document/" + plain.bundle);
  assert.equal(testifyFold(none), null, "control: the read gives no unmatched name, so no form");
  assert.ok(!actsIn(main(none)).includes("resolvetestify"));
});

/* ---- DEC-394 (3e) R127: contradictionflag ---- */
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
const flagFold = (p) => main(p).querySelector('[data-fold="contradict"]');

test("R127 DEC-394 contradictionflag: a passage here and a passage in another document are chosen with how they disagree; it sends the declared fields; refusals by key; control: no other document, no fold", async () => {
  const w = await member();
  const other = await w.world.recipes.page(w.ann, "Rent notice, October 2026", { paragraphs: ["The rent rises on November 1."], project: w.project });
  const there = (await w.ann.read("reading", { query: { sha256: other.sha } })).text_units[0].extent;
  const p = await pageOn(w.world, w.ann, w.at);
  const fold = flagFold(p);
  assert.ok(fold && says(fold, "screen.document.contradict.head") && says(fold, "screen.document.contradict.note1"), "the fold and its note by key");
  assert.ok(says(await press(p, "contradictionflag"), "refusal.FLAG_NO_PASSAGE"), "no passage chosen: refused by its key, nothing sent");
  await pickDoc(p, "flag", other.bundle);
  assert.equal(p.byOp("reading").filter((r) => r.query.sha256 === other.sha).length, 1, "the other document's passages are read");
  fill(p, { "document-flag-here": "0", "document-flag-there": "0" });
  assert.ok(says(await press(p, "contradictionflag"), "refusal.FLAG_NO_REASON"), "no reason: refused by its key");
  assert.equal(p.byOp("contradictionflag").length, 0);
  fill(p, { "document-flag-why": "One says November, the other December." });
  await press(p, "contradictionflag");
  assert.deepEqual(p.byOp("contradictionflag")[0].body, { here: { capture: w.sha, extent: w.units[0].extent }, other: { capture: other.sha, extent: there }, reason: "One says November, the other December." });
  assert.equal(p.answers("contradictionflag").length, 1, "the world answered it");
  /* the owner's refusals drawn by their keys (scripted: the world's flag is refused for no passage only past the page's own checks) */
  for (const code of ["FLAG_SAME_DOCUMENT", "FLAG_NO_PASSAGE"]) {
    const q = await pageOn(w.world, w.ann, w.at, { plane: { contradictionflag: refusedIn(code, "x") } });
    await pickDoc(q, "flag", other.bundle);
    fill(q, { "document-flag-here": "0", "document-flag-there": "0", "document-flag-why": "x" });
    assert.ok(says(await press(q, "contradictionflag"), "refusal." + code), code);
  }
  const lone = await member();
  const alone = await pageOn(lone.world, lone.ann, lone.at);
  /* R71 (screens-document-beta): the picker is read once opened, so the fold is withdrawn once its read finds nothing to offer */
  await alone.choose("#document-pick-open-flag-0");
  assert.ok(!flagFold(alone), "control: no other document to set it beside, no fold");
});

/* scripted: heldcaptures (needs a recipe that holds a copy whose upload is not whole, `whole: false`) */
test("R55 R123 capture R77 a held row that is not whole (whole: false) withholds the vouch box and the OCR re-read; whole: true and whole: null draw them", async () => {
  const row = (whole) => ok({ ok: true, held: [{ ...HELD_ROW, whole }] });
  const no = await openWith(at, { plane: { heldcaptures: row(false) } });
  assert.equal(main(no).querySelector("[data-held]"), null, "no vouch box on a copy that is not whole");
  for (const w of [true, null]) {
    const yes = await openWith(at, { plane: { heldcaptures: row(w) } });
    assert.ok(main(yes).querySelector("[data-held]"), "whole " + w + " draws the vouch box");
  }
});

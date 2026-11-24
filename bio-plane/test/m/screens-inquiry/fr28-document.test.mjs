/* screens-inquiry FR-28 (B15), the `document` screen's acts sent as their owners declare them and read as the plane answers them:
 * R84 (Thread), R85 (the mention that counts), R86 (the versions of one address), R92 (Watch for changes names a frequency), R93
 * (Check now says what happened, through `screens-intake`'s drawing), R95 (names are references), R111 (the held list as the plane
 * answers it), R112 (a reading in blocks), R113 (Stop using this copy says so), R117 (a refusal names its finding), R118 (cite and
 * watch), and R10 for `document` (it draws exactly its registry acts). On interface-shell's served page over a scripted plane; every
 * request is checked by the shell's guard against its owner's declaration (a FieldMismatch fails the test that pressed the act).
 * Every expectation is a word read by key (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { ok, refusedIn, boot } from "../interface-shell/harness.mjs";
import { connectionChooseMention } from "../connections/fixtures.mjs";
import { documentScreen } from "../../../src/screens-inquiry/document.mjs";
import { checkOutcome } from "../../../src/screens-intake/index.mjs";
import { COMMON } from "../../../src/screens-inquiry/common.mjs";
import { main, actsIn, fill, press, says, section, word, day, plane, storeWorld, WORLD_FOUNDER_HANDLE, READING, DOCUMENT_MD, provenanceOf, SCREENS, P, Q, D, SHA, NEWER } from "./fixtures.mjs";

process.env.TZ = "UTC";
const at = "/app/document/" + D;
const text = (el) => String(el && el.textContent || "");
/** The requests that wrote: the page's own frame read (`subscriptionsignin`) is a POST that writes nothing. */
const writes = (p) => p.requests.filter((r) => r.method === "POST" && r.op !== "subscriptionsignin");
/** The page with the `person` screen standing by (it is another module's: a reference to it is a link only where the page serves it). */
const PERSON = Object.freeze({ id: "person", reads: () => ({}), render: () => "", acts: [] });
async function openWith(path, o = {}) {
  const p = await boot({ screens: [...SCREENS, PERSON], plane: plane(o), path, ...(o.boot || {}) });
  await p.settle();
  return p;
}
/* the real world (store-assembly's store with the real door; the state is made by real acts, K5054): a page as `as` reads it, over the world's door,
   the `plane` it is given scripting only the ops the world cannot answer as the test needs */
const OWN = { capabilities: ["contribute", "create_projects"] };
async function pageOn(world, as, path, o = {}) {
  const { door, session } = world.boot(as);
  const kept = [];
  const p = await boot({ screens: [...SCREENS, PERSON], door: async (req) => { const a = await door(req); kept.push([req.op, a]); return a; }, session, path, ...o });
  await p.settle();
  p.answers = (op) => kept.filter(([k]) => k === op).map(([, a]) => (a.json && a.json.result !== undefined ? a.json.result : a.json));
  return p;
}
/** A copy captured from a public address for a question, then brought back from aside (`recipes.setAside`, `heldrestore`): the copy of a page the world's network serves
 *  (`world.script`), its locator that address, so it can be watched; `watched` also has her set it watching weekly (`monitorset`). */
async function remoteCopy({ watched = false } = {}) {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const made = await world.recipes.setAside(ann);
  await ann.act("heldrestore", { body: { ids: [made.document], reason: "brought back for the page" } });
  if (watched) await ann.act("monitorset", { body: { bundleId: made.document, enabled: true, frequency: "weekly" } });
  const held = (await ann.read("heldcaptures", { query: { bundle_id: made.document, state: "held_and_vouched" } })).held[0];
  return { world, ann, ...made, title: held.title, address: held.source.address, at: "/app/document/" + made.document };
}
const MINUTES = "<html><head><title>Council minutes</title></head><body><p>The council met on Monday.</p></body></html>";
/** A copy a member captured from a public address for a question of her project (`acquire` with `for`, the address served by the world's network, `world.script`), then filed in the
 *  project as held (`recipes.hold` of the same bytes): its held row is hers, names the question it was captured for, and is eligible to be vouched for. */
async function heldCopy() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const project = await world.recipes.project(ann, "Pothole repairs");
  const q = await world.recipes.question(ann, project, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", draw: true });
  const address = "https://records.example.org/minutes.html";
  world.script(address, async () => new Response(MINUTES, { status: 200, headers: { "content-type": "text/html" } }));
  await ann.act("acquire", { body: { locator: address, for: q.id } });
  const held = await world.recipes.hold(ann, "Council minutes", MINUTES, project, { type: "text/html", read: true });
  return { world, ann, project, question: q.id, document: held.bundle, sha: held.sha, at: "/app/document/" + held.bundle };
}
const withMd = (md, extra = {}) => ({ images: { [D]: { "bundle.md": md, "data/provenance.json": provenanceOf(SHA) } }, ...extra });
const WATCHED = DOCUMENT_MD.replace("\nsource:", "\nmonitoring:\n  enabled: true\n  frequency: weekly\nsource:");
const UNWATCHED = DOCUMENT_MD.replace("\nsource:", "\nmonitoring:\n  enabled: false\n  frequency: none\nsource:");

/* ---- R84 ---- */
/** Two captures naming one ordinance, threaded under a flow of two stages (agenda, minutes) by the real acts (`recipes.connection`): the page of the first, which stands at "minutes". */
const threaded = async () => {
  const world = await storeWorld();
  const made = await world.recipes.connection(await world.signIn(WORLD_FOUNDER_HANDLE), await world.signIn("ann", OWN));
  return { world, made, page: () => pageOn(world, made.as, "/app/document/" + made.documents[0]) };
};

test("R84 Thread it to a step sends the flow's key, the entity from captureprogressions and one placement for the stage chosen; the guard accepts it", async () => {
  const t = await threaded();
  const p = await t.page();
  const row = p.answers("captureprogressions")[0].instances[0];
  assert.equal(p.byOp("progression")[0].query.key, row.progression_key, "the flow's stages are read by the row's key");
  const s = section(p, "progression.threadedto");
  assert.ok(s, "the steps section is drawn where a thread is");
  const stage = p.doc.getElementById("document-thread-stage-0");
  const stages = p.answers("progression")[0].stages.map((x) => x.stage_key);
  assert.deepEqual(stage.querySelectorAll("option").map((o) => o.getAttribute("value")), ["", ...stages], "the flow's own stages, none chosen");
  fill(p, { "document-thread-stage-0": stages[0] });
  await press(p, "thread");
  assert.deepEqual(p.byOp("thread")[0].body, { progressionKey: row.progression_key, entityId: t.made.entity, placements: [{ stage: stages[0], captureSha: t.made.shas[0] }] }, "the three fields, the guard having accepted them");
});

test("R84 control: no stage chosen sends nothing and says so beside the act; a document threaded under no flow draws no steps section", async () => {
  const t = await threaded();
  const p = await t.page();
  const slot = await press(p, "thread");
  assert.equal(p.byOp("thread").length, 0, "nothing is sent");
  assert.ok(says(slot, "capture.fieldneeded", { field: word("progression.steps") }), "the missing field is named by its key");
  const none = await pageOn(t.world, t.made.as, "/app/document/" + (await t.world.recipes.page(t.made.as, "Alone", {})).bundle);
  assert.equal(section(none, "progression.threadedto"), undefined);
  assert.equal(none.byOp("progression").length, 0, "no flow, no flow read");
});

/* ---- R85 ---- */
const OTHER_SHA = "8".repeat(64);
const MENTIONS = [{ ref: "c1", occurrence: "o1", grade: "A", position: { kind: "pdf-page", page: 0 } }, { ref: "c2", occurrence: "o2", grade: "B", position: { kind: "pdf-page", page: 2 } }];
const NAMES = ok({ ok: true, names: [{ entity_id: "ENT-17", label: "L. Chen, Director of Public Works", kind: "person", grade: "A", established: true, needs_confirmation: false, matched_by: "identifier", mentions: 2 }],
  resolutions: [{ ref: "c1", entity_id: "ENT-17", grade: "A" }, { ref: "c2", entity_id: "ENT-17", grade: "B" }] });
/* connections' real answer to a member's choice of one mention (R85) */
const CHOSEN = connectionChooseMention();
const CONNS = (mentions = MENTIONS) => ok({ ok: true, connections: [{ a_capture_sha: SHA, b_capture_sha: OTHER_SHA, entity_id: "ENT-17", entity_name: "L. Chen",
  on_point: { a: { ref: "c1", occurrence: { page: 1 }, chosen_by: "record" }, b: null }, occurrences: 2, mentions, mentions_truncated: false }] });

test("R85 the mentions the connection lists are offered and the one chosen is sent with its ref and occurrence; the guard accepts it", async () => {
  const p = await openWith(at, { plane: { resolutions: NAMES, connections: CONNS(), connectionchoose: ok(CHOSEN) } });
  const opts = p.doc.getElementById("document-mention-ENT-17").querySelectorAll("option");
  assert.equal(opts.length, 3, "none chosen, then the two mentions");
  assert.ok(text(opts[2]).includes("c2"), "each mention is named by its reference");
  fill(p, { "document-mention-ENT-17": "1" });
  await press(p, "connectionchoose");
  assert.deepEqual(p.byOp("connectionchoose")[0].body, { capture: SHA, other: OTHER_SHA, entity: "ENT-17", ref: "c2", occurrence: "o2" }, "the second mention, not the one the record chose");
});

test("R85 control: the mention already chosen is not the default, and nothing chosen sends nothing; a mention with no occurrence sends no occurrence", async () => {
  const p = await openWith(at, { plane: { resolutions: NAMES, connections: CONNS(), connectionchoose: ok(CHOSEN) } });
  assert.equal(p.doc.getElementById("document-mention-ENT-17").value, "", "the record's own choice (c1) is not preselected");
  const slot = await press(p, "connectionchoose");
  assert.equal(p.byOp("connectionchoose").length, 0, "nothing is sent");
  assert.ok(says(slot, "capture.fieldneeded", { field: word("act.connectionchoose.label.document") }));
  const q = await openWith(at, { plane: { resolutions: NAMES, connections: CONNS([{ ref: "c1", occurrence: null, grade: "A", position: null }]), connectionchoose: ok(CHOSEN) } });
  fill(q, { "document-mention-ENT-17": "0" });
  await press(q, "connectionchoose");
  assert.deepEqual(q.byOp("connectionchoose")[0].body, { capture: SHA, other: OTHER_SHA, entity: "ENT-17", ref: "c1" });
});

/* ---- R86 ---- */
const THREE = ok({ ok: true, at_index: 1, versions: [{ capture_sha: "1".repeat(64), bundle_id: "INFO-2026-0001", first_retrieved: "2026-09-01T09:00:00Z" },
  { capture_sha: SHA, bundle_id: D, first_retrieved: "2026-10-02T09:00:00Z" }, { capture_sha: NEWER, bundle_id: "INFO-2026-0099", first_retrieved: "2026-10-09T09:00:00Z" }] });

test("R86 each other version of the address is a reference opening that version's document; this copy is not", async () => {
  const p = await openWith(at, { plane: { versionchain: THREE } });
  const s = section(p, "screen.document.versions.head");
  const refs = s.querySelectorAll("a.cs-ref");
  assert.deepEqual(refs.map((a) => a.getAttribute("href")), ["/app/document/INFO-2026-0001", "/app/document/INFO-2026-0099"], "two references");
  assert.equal(text(refs[0]), day("2026-09-01T09:00:00Z"), "each is drawn by its date");
  assert.ok(says(s.querySelectorAll(".cs-row")[1], "screen.document.versions.this"), "this copy is marked");
  assert.equal(s.querySelectorAll(".cs-row")[1].querySelectorAll("a.cs-ref").length, 0, "and is no reference");
});

test("R86 control: a version the record holds no document for is a date alone", async () => {
  const none = ok({ ok: true, at_index: 0, versions: [{ capture_sha: SHA, bundle_id: D, first_retrieved: "2026-10-02T09:00:00Z" }, { capture_sha: NEWER, bundle_id: null, first_retrieved: "2026-10-09T09:00:00Z" }] });
  const p = await openWith(at, { plane: { versionchain: none } });
  const s = section(p, "screen.document.versions.head");
  assert.equal(s.querySelectorAll("a.cs-ref").length, 0);
  assert.ok(text(s).includes(day("2026-10-09T09:00:00Z")));
});

/* ---- R92 ---- */
test("R92 Watch for changes sends the frequency chosen; the page says it is watched only after the answer; the guard accepts it", async () => {
  const c = await remoteCopy();
  const p = await pageOn(c.world, c.ann, c.at);
  const f = p.doc.getElementById("document-watch-freq");
  assert.deepEqual(f.querySelectorAll("option").map((o) => o.getAttribute("value")), ["daily", "weekly", "monthly", "hourly", "per_meeting"], "the frequencies the plane takes, the first shown and chosen (C35)");
  assert.equal(f.value, "daily", "what is shown is chosen");
  fill(p, { "document-watch-freq": "weekly" });
  assert.ok(!says(main(p), "screen.document.monitorset.done"), "nothing is said before the answer");
  await press(p, "monitorset");
  assert.deepEqual(p.byOp("monitorset")[0].body, { bundleId: c.document, enabled: true, frequency: "weekly" });
  assert.ok(says(main(p), "screen.document.monitorset.done"), "said once answered");
  const image = await c.ann.read("image", { query: { id: c.document } });
  assert.ok(image["bundle.md"].includes("monitoring:\n  enabled: true\n  frequency: weekly"), "and the record now holds the copy as watched, weekly");
});

test("R92 control: none chosen sends nothing and refuses in place, naming the missing frequency; a refused answer says nothing of watching", async () => {
  const c = await remoteCopy();
  /* the refusal's code is one no word is held for (the world's own refusals of this act have a word): scripted over the real copy */
  const p = await pageOn(c.world, c.ann, c.at, { plane: { monitorset: refusedIn("SOME_UNHELD_CODE", "Say how often.") } });
  fill(p, { "document-watch-freq": "" });
  const slot = await press(p, "monitorset");
  assert.equal(p.byOp("monitorset").length, 0);
  assert.ok(says(slot, "capture.fieldneeded", { field: word("screen.capture.address.freq") }));
  fill(p, { "document-watch-freq": "daily" });
  const slot2 = await press(p, "monitorset");
  assert.equal(p.byOp("monitorset").length, 1);
  assert.ok(text(slot2).includes("Say how often."), "the plane's refusal is drawn beside the act");
  assert.ok(!says(main(p), "screen.document.monitorset.done"));
});

/* ---- R93 ---- */
/** What `screens-intake`'s drawing gives for an answer: its word where the table holds one, else the key it draws (the module owns both). */
const outcomeWords = (status, note, title = "Pothole repair policy, Administrative Instruction 4.12") => {
  const key = "screen.capture.address.checked." + (status || "unknown");
  const fills = status ? { title } : { title, note };
  return hasWord(key) ? word(key, fills) : key;
};
test("R93 Check now draws what the check found: four answers draw four different outcomes through the drawing screens-intake owns", async () => {
  const page = (body) => async () => new Response(`<html><head><title>Council minutes</title></head><body>${body}</body></html>`, { status: 200, headers: { "content-type": "text/html" } });
  /* each answer is the address's own, as the real check finds it: the bytes it captured, other bytes, a 404 again a day after the first (a removal is confirmed only by a second look), no answer at all */
  const answers = [["unchanged", async (c) => c.world.script(c.address, page("<p>The council met.</p>"))],
    ["modified", async (c) => c.world.script(c.address, page("<p>The council met and voted.</p>"))],
    ["removed", async (c) => {
      c.world.script(c.address, async () => new Response("gone", { status: 404 }));
      await c.ann.act("monitor", { body: { bundleId: c.document } });
      await c.world.tick(25 * 3600 * 1000);
      c.ann = await c.world.signIn("ann", OWN);   /* a day on, her session has run out: she signs in again */
    }],
    [undefined, async (c) => c.world.script(c.address, async () => { throw new Error("The site did not answer."); })]];
  const seen = new Set();
  for (const [status, setup] of answers) {
    const c = await remoteCopy({ watched: true });
    await setup(c);
    const p = await pageOn(c.world, c.ann, c.at);
    await press(p, "monitor");
    assert.deepEqual(p.byOp("monitor")[0].body, { bundleId: c.document });
    const said = text(main(p).querySelector('[data-outcome="monitor"]'));
    seen.add(said);
    const note = status ? undefined : "The site did not answer.";
    assert.ok(said.includes(outcomeWords(status, note, c.title).split("{")[0].slice(0, 20)), `${status || "unknown"} drawn by the imported drawing's key`);
    assert.ok(!says(main(p), "screen.document.monitor.done"), "never 'Checked just now' for every outcome");
  }
  assert.equal(seen.size, 4, "four different sentences");
});

test("R93 control: this module holds no outcome key of its own and carries the imported drawing as its part", () => {
  const src = readFileSync(new URL("../../../src/screens-inquiry/document.mjs", import.meta.url), "utf8");
  assert.ok(!/screen\.capture\.address\.checked/.test(src), "no outcome key in this module's source");
  assert.equal(documentScreen(COMMON).parts.checkOutcome, checkOutcome, "the one drawing, imported");
});

/* ---- R95 ---- */
test("R95 each name row is a reference opening person with the entity id", async () => {
  const p = await openWith(at, { plane: { resolutions: NAMES } });
  const s = section(p, "document.names.title");
  const refs = s.querySelectorAll("a.cs-ref");
  assert.deepEqual(refs.map((a) => a.getAttribute("href")), ["/app/person/ENT-17"]);
  assert.equal(text(refs[0]), "L. Chen, Director of Public Works", "named by its label");
});

test("R95 control: without the page serving person, the name is the kit's card, not a link; no names, no section", async () => {
  const p = await boot({ screens: SCREENS, plane: plane({ plane: { resolutions: NAMES } }), path: at });
  await p.settle();
  assert.equal(section(p, "document.names.title").querySelectorAll("a.cs-ref").length, 0);
  assert.ok(text(section(p, "document.names.title")).includes("L. Chen"));
  const none = await openWith(at);
  assert.equal(section(none, "document.names.title"), undefined);
});

/* ---- R111 ---- */
test("R111 a held capture, read as the plane answers it ({held: rows}), draws the two release fields and the act, and its question is preselected", async () => {
  const c = await heldCopy();
  const p = await pageOn(c.world, c.ann, c.at);
  assert.ok(p.byOp("heldcaptures").some((r) => r.query.bundle_id === c.document), "this copy's held row is read");
  const box = main(p).querySelector("[data-held]");
  assert.ok(box && says(box, "document.held.says"));
  assert.ok(p.doc.getElementById("document-release-ack") && p.doc.getElementById("document-release-mitigation"), "the two fields");
  assert.ok(actsIn(box).includes("release"), "and the act");
  assert.equal(p.doc.getElementById("document-cite-question").value, c.question, "the row's captured_for question is preselected");
});

test("R111 control: a document she vouched for draws the vouched note and no release", async () => {
  /* a held row of another document cannot be answered: the owner filters a read by `bundle_id` (capture/index.mjs:2043), so the page never meets one */
  /* a copy held by her own upload is released by the page's own acts (`select`, then `release`) */
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const held = await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.");
  const p = await pageOn(world, ann, "/app/document/" + held.bundle);
  assert.ok(main(p).querySelector("[data-held]"), "held before");
  fill(p, { "document-release-ack": "Checked", "document-release-mitigation": "None needed" });
  await press(p, "release");
  assert.ok(main(p).querySelector("[data-vouched]"), "the vouched note");
  assert.equal(main(p).querySelector("[data-held]"), null);
});

/* ---- R112 ---- */
const UNITS = (n) => Array.from({ length: n }, (_, i) => ({ seq: i + 1, extent: { kind: "paragraph", para: i }, reference: "u" + (i + 1), truncated: false, text: `Unit ${i + 1} of the page.` }));
test("R112 a reading of 700 units that carry no page is drawn in one block, with a page bar and the Cite controls of that block only", async () => {
  const p = await openWith(at, { plane: { reading: ok(READING({ text_units: UNITS(700), unread_pages: [] })) } });
  const shown = main(p).querySelectorAll("blockquote");
  assert.ok(shown.length > 0 && shown.length < 700, "a block, not the whole reading");
  assert.ok(shown.length <= 50, "of a stated size");
  assert.equal(main(p).querySelectorAll('button[data-act="cite"]').length, shown.length, "the Cite controls of that block only");
  const count = Math.ceil(700 / shown.length);
  const bar = main(p).querySelector("[data-pagebar]");
  assert.ok(bar && says(bar, "document.read.page", { n: "1", count: String(count) }), "the page bar says which block of how many");
  assert.ok(text(shown[0]).includes("Unit 1 of") && !text(main(p)).includes("Unit 700 of"));
  const next = p.doc.getElementById("document-read-page").querySelectorAll("label").find((l) => l.textContent.includes(word("document.read.next"))).querySelector("input");
  next.checked = true; p.fire(next, "change"); await p.settle();
  assert.ok(text(main(p).querySelectorAll("blockquote")[0]).includes(`Unit ${shown.length + 1} of`), "the next block follows the first");
  assert.equal(p.byOp("reading").length, 1, "no new read");
});

test("R112 control: a short reading draws no page bar; a PDF reading pages by its pages as before", async () => {
  const short = await openWith(at, { plane: { reading: ok(READING({ text_units: UNITS(5), unread_pages: [] })) } });
  assert.equal(main(short).querySelector("[data-pagebar]"), null);
  assert.equal(main(short).querySelectorAll("blockquote").length, 5);
  const pdf = await openWith(at);
  assert.ok(says(main(pdf).querySelector("[data-pagebar]"), "document.read.page", { n: "3", count: "10" }), "the PDF's own pages (3 to 10, the unread ones counted)");
  assert.equal(main(pdf).querySelectorAll("blockquote").length, 1);
});

/* ---- R113 ---- */
const dialog = (p) => p.root().querySelector('[role="dialog"]');
/** A copy she holds and has vouched for (`select`, then `release` with her acknowledgment and the mitigation), so it is hers to stop using. */
async function vouchedCopy() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const held = await world.recipes.hold(ann, "Policy memo", "The Director shall repair each reported pothole within seven days.");
  const sel = await ann.act("select", { body: { ids: [held.bundle] } });
  await ann.act("release", { query: { handle: sel.handle, acknowledgment: "Checked", mitigation: "None needed" } });
  return { world, ann, ...held, at: "/app/document/" + held.bundle };
}
test("R113 Stop using this copy, confirmed with a reason, sends select then retire with the handle, says the copy is retired by key and reads the document again", async () => {
  const c = await vouchedCopy();
  const p = await pageOn(c.world, c.ann, c.at);
  assert.equal(main(p).querySelector("[data-retired]"), null, "not retired before");
  await press(p, "retire");
  dialog(p).querySelector("textarea").value = "mistaken capture, wrong page";
  await p.click(dialog(p).querySelector('[data-shell="confirm"]'));
  assert.deepEqual(p.byOp("select")[0].body, { ids: [c.bundle] });
  assert.deepEqual([p.requests.findIndex((r) => r.op === "select") < p.requests.findIndex((r) => r.op === "retire")], [true], "select first");
  const r = p.byOp("retire")[0].query;
  assert.deepEqual([typeof r.handle, r.handle !== "", r.reason], ["string", true, "mistaken capture, wrong page"], "the handle the select made");
  assert.ok(p.byOp("image").filter((q) => q.query.id === c.bundle).length >= 2, "the document is read again");
  const note = main(p).querySelector("[data-retired]");
  assert.ok(note && says(note, "state.item.retired.name") && says(note, "state.item.retired.means"), "the retired state, by key");
  assert.ok(!actsIn(main(p)).includes("retire"), "and no second retirement is offered");
});

test("R113 a select that fails draws its refusal; control: Confirm with no reason is refused in place and nothing is sent", async () => {
  const c = await vouchedCopy();
  /* the select's refusal is one no word is held for and no act makes (a select of a copy she may use is never refused): scripted over the real copy */
  const p = await pageOn(c.world, c.ann, c.at, { plane: { select: refusedIn("SOME_UNHELD_CODE", "That copy could not be selected just now.") } });
  await press(p, "retire");
  dialog(p).querySelector("textarea").value = "wrong page";
  await p.click(dialog(p).querySelector('[data-shell="confirm"]'));
  assert.equal(p.byOp("retire").length, 0, "the retire is not sent after a failed select");
  assert.ok(text(main(p)).includes("That copy could not be selected just now."));
  const q = await pageOn(c.world, c.ann, c.at);
  await press(q, "retire");
  dialog(q).querySelector("textarea").value = "   ";
  await q.click(dialog(q).querySelector('[data-shell="confirm"]'));
  assert.equal(q.byOp("select").length + q.byOp("retire").length, 0, "no reason, nothing sent");
  assert.ok(text(q.root()).includes(word("shell.reason.needed")), "refused in place");
});

/* ---- R117 ---- */
const basisRefused = (findings) => ({ status: 200, json: { ok: true, result: { ok: false, reason: "BASIS_REFUSED", code: "BASIS_REFUSED", ...(findings ? { findings } : {}) } } });
const citeWith = async (answer) => {
  const p = await openWith(at, { plane: { cite: answer } });
  fill(p, { "document-cite-question": Q });
  return { p, slot: await press(p, "cite") };
};
test("R117 a BASIS_REFUSED answer carrying findings draws the first finding by key where a word is held for its code, else its detail, and not the generic sentence", async () => {
  const { slot } = await citeWith(basisRefused([{ check: "C-2.10", code: "INTERVIEW_NOT_A_LEG", detail: "basis[0] rests on STEP-1, an intake interview" }, { check: "C-9.9", detail: "second finding" }]));
  assert.ok(says(slot, "refusal.INTERVIEW_NOT_A_LEG"), "the first finding's word, by its key");
  assert.ok(!says(slot, "refusal.BASIS_REFUSED"), "not the generic sentence");
  assert.ok(!text(slot).includes("second finding"), "the first finding only");
  const { slot: s2 } = await citeWith(basisRefused([{ check: "C-2.10", detail: "the target was not a canonical id" }]));
  assert.ok(text(s2).includes("the target was not a canonical id") && text(s2).includes("C-2.10"), "its check and detail where no word is held");
  assert.ok(!says(s2, "refusal.BASIS_REFUSED"));
});

test("R117 control: a refusal without findings draws the code's generic sentence", async () => {
  const { slot } = await citeWith(basisRefused(null));
  assert.ok(says(slot, "refusal.BASIS_REFUSED"));
  const { slot: s2 } = await citeWith(basisRefused([]));
  assert.ok(says(s2, "refusal.BASIS_REFUSED"), "an empty list names nothing");
});

/* ---- R118 ---- */
/** A copy held in the project "Pothole repairs", whose two questions rest on nothing yet, a third question in another project, "The Coliseum lease", and a fourth in none: all by real acts. */
async function twoProjects() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const mine = await world.recipes.project(ann, "Pothole repairs");
  const other = await world.recipes.project(ann, "The Coliseum lease");
  const held = await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project: mine });
  const q1 = await world.recipes.question(ann, mine, { title: "Seven days", text: "Is the city repairing reported potholes within seven days?", draw: true });
  const q2 = await world.recipes.question(ann, mine, { title: "Closed", text: "Does closed mean repaired?", draw: true });
  const q3 = await world.recipes.question(ann, other, { title: "Lease", text: "Did the lease go to a vote?", draw: true });
  const q4 = await world.recipes.question(ann, "", { title: "Unfiled", text: "Who signed the lease?" });   /* a question of no project: its list row states none */
  return { world, ann, mine, other, held, q: [q1.id, q2.id, q3.id, q4.id], at: "/app/document/" + held.bundle };
}
const options = (p) => p.doc.getElementById("document-cite-question").querySelectorAll("option");
test("R118 Cite in which question lists each question with its project by the key, and the choose option first when nothing is preselected", async () => {
  const t = await twoProjects();
  const p = await pageOn(t.world, t.ann, t.at);
  const o = options(p);
  assert.equal(text(o[0]), word("screen.document.cite.choose"), "never starts blank");
  assert.equal(o[0].getAttribute("value"), "");
  assert.equal(text(o[1]), word("screen.document.cite.option", { question: "Is the city repairing reported potholes within seven days?", project: "Pothole repairs" }));
  /* fix round 3 (C16): a project's questions are not read one project at a time, so a question of another project is named by the project its list row states, else by its title alone;
     fr4-document names the project where titles collide */
  assert.equal(text(o[3]), word("screen.document.cite.option", { question: "Did the lease go to a vote?", project: "The Coliseum lease" }), "a question of another project, by the project its list row states");
  assert.equal(text(o[4]), "Who signed the lease?", "a question whose project is not known is its title alone");
  assert.deepEqual(p.byOp("projectquestions").map((r) => r.query.project), [t.mine], "only this project's questions are read");
  assert.deepEqual(o.slice(1).map((x) => x.getAttribute("value")), t.q, "this project's questions first");
});

test("R118 control: with a question preselected the choose option is not drawn and the list starts at it", async () => {
  const c = await heldCopy();
  const p = await pageOn(c.world, c.ann, c.at);
  assert.equal(p.doc.getElementById("document-cite-question").value, c.question);
  assert.ok(!options(p).some((x) => text(x) === word("screen.document.cite.choose")));
});

test("R118 the screen puts no weight mark of its own on Ask whether a newer copy exists, Check now or Watch for changes (the shell draws marks by key, B17)", async () => {
  /* a watched copy of a page, one question resting on it, and its address's one version: the real records */
  const c = await remoteCopy({ watched: true });
  await c.world.recipes.question(c.ann, c.project, { title: "Rests on it", text: "What did the council decide?", legs: [{ target: c.document, role: "supports" }], draw: true });
  const p = await pageOn(c.world, c.ann, c.at);
  for (const op of ["monitor", "monitorset"]) {
    const b = main(p).querySelector(`button[data-act="${op}"]`);
    assert.ok(b, op);
    assert.equal(b.querySelector(".w"), null, `${op} draws no weight mark`);
  }
  assert.ok(main(p).querySelector('button[data-act="versionnotice"]'));
  const screen = SCREENS.find((s) => s.id === "document");
  for (const a of screen.acts) assert.ok(!("mark" in a) && !("weight" in a), `${a.op}: the screen states no mark or weight`);
  const src = readFileSync(new URL("../../../src/screens-inquiry/document.mjs", import.meta.url), "utf8");
  assert.ok(!/cs\.act\([^)]*\b(mark|weight):/.test(src), "and passes none to the kit");
});

test("R118 an unwatched address draws the unwatched key and Watch for changes and no Check now; a watched one the reverse", async () => {
  const un = await openWith(at, withMd(UNWATCHED));
  assert.ok(says(main(un), "screen.document.unwatched.head") && says(main(un), "screen.document.unwatched"));
  assert.ok(actsIn(main(un)).includes("monitorset") && !actsIn(main(un)).includes("monitor"));
  const none = await openWith(at);
  assert.ok(says(main(none), "screen.document.unwatched") && !actsIn(main(none)).includes("monitor"), "a document with no monitoring block is not watched");
  const w = await openWith(at, withMd(WATCHED));
  assert.ok(!says(main(w), "screen.document.unwatched") && !says(main(w), "screen.document.unwatched.head"));
  assert.ok(actsIn(main(w)).includes("monitor"));
});

test("R118 control: a testimony offers neither watching nor checking and says nothing of being unwatched", async () => {
  const TESTIMONY = ["---", `id: ${D}`, "object_type: information", "title: \"The pothole at 4th and Main\"", `project: ${P}`, "source:", "  locator: \"a member's firsthand observation, authored in this record\"",
    "  retrieved: 2026-10-04T09:00:00Z", "---", "", "## Provenance Notes", "", "Authored through op=testify.", ""].join("\n");
  const p = await openWith(at, withMd(TESTIMONY));
  assert.ok(!actsIn(main(p)).includes("monitor") && !actsIn(main(p)).includes("monitorset") && !says(main(p), "screen.document.unwatched"));
});

/* ---- R10 ---- */
test("R10 the document draws exactly its registry acts, each labelled by a word the table holds", () => {
  const REG = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
  const want = REG.screens.find((s) => s.id === "document").acts.map((a) => a.op.replace(/^owed:(\w+) DEC-\d+$/, "$1"));
  const screen = SCREENS.find((s) => s.id === "document");
  assert.deepEqual(screen.acts.map((a) => a.op).filter((op) => op !== "readheld").sort(), want.sort(), "the registry's acts, no more and no fewer (captureprogressions among them, B22 entry 2)");
  /* `readheld` is interface-shell's re-point until the registry lists it (R129); its label is a held word as the others are */
  for (const a of screen.acts) assert.ok(hasWord(a.label) && screen.words.includes(a.label), `${a.op}: ${a.label}`);
});

test("R10 every request the page makes on load is accepted by its owner's declaration (the guard raises no FieldMismatch)", async () => {
  const p = await (await threaded()).page();
  assert.ok(p.requests.length > 5);
  assert.equal(writes(p).length, 0, "and the load writes nothing");
});

/* screens-intake T51 fix round 3 (SCREENS-INTAKE #14; K4356, K4370): C9 R49, C14, C17 R2, C23 R4, C25 R54, C28 R7, C29, C35, C78 R47, C94,
 * FC-23 and N4 (R57 proposed), C81. A sentence is asserted by its key (R26), never by its English.
 * Fix round 10 (K5054): over the REAL store. The members are signed in by the real acts; a document is held by a real upload or a real capture of an
 * address the world's network is scripted to answer (an environment double); a project, a question, a knock, a login are made by the owners' own acts;
 * every value an assertion needs (an id, a digest, a title) is read from those acts' answers. The one scripted answer that stays is named where it is. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, text, html, main, btn, fill, press, ok, refused, word, says, saysIn, DOCUMENT_STUB } from "./page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { generate } from "../../pdfgen.mjs";

const ADDRESS = "https://www.acgov.org/board/minutes-2026-10.html";
const MINUTES = "<html><head><title>Board minutes</title></head><body><p>The board met on Tuesday.</p></body></html>";
const CAN = ["contribute", "create_projects"];
/* a team: mai (who may start projects) and two projects she is in; the world's network answers the exact addresses a test serves */
async function team() {
  const t = await members({ mai: CAN }, {});
  t.mine = await t.world.recipes.project(t.mai, "Pothole repairs");
  t.home = await t.world.recipes.project(t.mai, "Housing repairs");
  return t;
}
const serve = (world, address, body, type = "text/html", headers = {}) => world.script((req) => req.url === address, () => new Response(body, { status: 200, headers: { "content-type": type, ...headers } }));
const open = (t, path, o = {}) => openWorld(path, { world: t.world, as: o.as || t.mai, screens: [...SCREENS, DOCUMENT_STUB], plane: o.plane || {} });
const anchors = (p, id) => Array.from(main(p).querySelectorAll("a")).filter((a) => String(a.getAttribute("href")).includes(id));

/* ---------- C9: R49 (capture R100, R101) ---------- */

/* The sentence for "filed here as well" is the design's row (DEC-412), asserted by its key. */
const FILEDHERE = "screen.capture.address.filedhere";
const saysFiled = (p, home) => says(p, FILEDHERE, { project: home });

/* the minutes held under `project` by a real upload, and the address that answers the same bytes */
async function minutesIn(t, project, as = t.mai) {
  const held = await t.world.recipes.hold(as, "Board minutes", MINUTES, project, { type: "text/html" });
  serve(t.world, ADDRESS, MINUTES);
  return held;
}
const capture = async (p, address = ADDRESS) => { fill(p, { "ci-address": address }); return press(p, "acquire"); };

test("R49 (C9) a capture from a project's page whose bytes are held under another project's document sends `captureseenin` for the subject project and says it is filed here as well", async () => {
  const t = await team();
  const held = await minutesIn(t, t.home);
  const p = await open(t, `/app/capture/address/${t.mine}`);
  await capture(p);
  assert.deepEqual(p.byOp("captureseenin").map((r) => r.body), [{ captureSha: held.sha, project: t.mine }], "the digest and the subject project, nothing else");
  assert.equal(p.byOp("allocid").length + p.byOp("promote").length, 0, "no second document is written");
  assert.equal(anchors(p, held.bundle).length, 1, "the held copy is shown once");
  assert.ok(saysFiled(p, "Housing repairs"), "the result says it is filed here as well");
  const listed = (await t.mai.read("heldcaptures", { query: { project: t.mine } })).held.map((h) => h.bundle_id);
  assert.ok(listed.includes(held.bundle), "the owner now lists the document in the subject project");
});

test("R49 (C9) control: a found document whose home is the subject project is recorded as seen nowhere; with no subject nothing is sent", async () => {
  const t = await team();
  const held = await minutesIn(t, t.mine);
  const same = await open(t, `/app/capture/address/${t.mine}`);
  await capture(same);
  assert.equal(same.byOp("captureseenin").length, 0);
  assert.equal(anchors(same, held.bundle).length, 1);
  const u = await team();
  const away = await minutesIn(u, u.home);
  const bare = await open(u, "/app/capture/address");
  await capture(bare);
  assert.equal(bare.byOp("captureseenin").length, 0);
  assert.equal(anchors(bare, away.bundle).length, 1);
});

test("R49 (C9) control: a hidden home names the holder and files nothing (no `captureseenin`)", async () => {
  /* the bytes are held in a project rosa is in and mai is not: mai's record shows her no document for them, so her own promotion is refused by provenance */
  const t = await members({ mai: CAN, rosa: CAN });
  t.mine = await t.world.recipes.project(t.mai, "Pothole repairs");
  const theirs = await t.world.recipes.project(t.rosa, "Rosa's project");
  const hidden = await t.world.recipes.hold(t.rosa, "The earlier minutes", MINUTES, theirs, { type: "text/html" });
  serve(t.world, ADDRESS, MINUTES);
  assert.equal((await t.mai.read("heldat", { query: { sha256: hidden.sha } })).held, false, "mai is shown no document for these bytes");
  const p = await open(t, `/app/capture/address/${t.mine}`);
  await capture(p);
  assert.equal(p.byOp("captureseenin").length, 0);
  assert.ok(says(p, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"), "the refusal in words");
  assert.equal(anchors(p, hidden.bundle).length, 0, "the owner names a holder only to a caller who may see it: a holder it withholds is neither named nor linked");
  /* control: where the owner does name the holder the page links it once. The owner names a holder only to a caller who may see it, and the sight rule that lets her see it
     also shows her a copy at `heldat`, so no act of the world refuses a promotion with a holder she sees: the one scripted answer (a fault), naming rosa's real bundle */
  const q = await open(t, `/app/capture/address/${t.mine}`, { plane: { promote: refused("CAPTURE_HELD_BY_ANOTHER_BUNDLE", undefined, 409, { holder: hidden.bundle }) } });
  await capture(q);
  assert.equal(q.byOp("captureseenin").length, 0);
  assert.ok(says(q, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"));
  assert.equal(anchors(q, hidden.bundle).length, 1);
});

test("R49 (C9) a `captureseenin` the plane refuses is drawn by its words and the held copy is still linked once", async () => {
  /* the page stops a member who is neither in the project nor invited (G74); an invited member who has not joined passes, and the owner refuses her: a real refusal */
  const t = await members({ mai: CAN, rosa: CAN });
  t.home = await t.world.recipes.project(t.mai, "Housing repairs");
  const theirs = await t.world.recipes.project(t.rosa, "Pothole repairs");
  await t.rosa.act("projectinvite", { query: { projectId: theirs, handle: "mai" } });
  const held = await minutesIn(t, t.home);
  const p = await open(t, `/app/capture/address/${theirs}`);
  await capture(p);
  assert.equal(p.byOp("captureseenin").length, 1);
  assert.ok(says(p, "refusal.PROJECT_ACT_NOT_A_PARTICIPANT"), "the refusal in words");
  assert.equal(anchors(p, held.bundle).length, 1);
  assert.ok(!saysFiled(p, "Housing repairs"), "it is not said to be filed");
});

test("R49 (C9) an upload whose bytes are held under another project's document is filed in the subject project as well", async () => {
  const t = await team();
  const held = await t.world.recipes.hold(t.mai, "Seminary Ave", "photo bytes", t.home, { type: "image/jpeg" });
  const p = await open(t, `/app/capture/file/${t.mine}`);
  fill(p, { "ci-file": new File(["photo bytes"], "Seminary Ave.jpg", { type: "image/jpeg" }), "ci-how-made": true, "ci-where": "6012 Seminary Ave", "ci-what": "The pothole." });
  await press(p, "captureupload");
  assert.deepEqual(p.byOp("captureseenin").map((r) => r.body), [{ captureSha: held.sha, project: t.mine }]);
  assert.equal(p.byOp("captureupload")[0].query.for, undefined, "an existed upload takes no `for` (R29)");
  assert.equal(anchors(p, held.bundle).length, 1);
  assert.ok(saysFiled(p, "Housing repairs"));
});

test("R49 (acquisition R96) a `CAPTURE_NOT_KEPT` acquire is drawn through its row's words, files nothing and links nothing", async () => {
  const t = await team();
  /* the owner refuses a capture it could not keep whole when the object store fails mid-write, which no act of the world makes: the one scripted answer (a fault) */
  const p = await open(t, "/app/capture/address", { plane: { acquire: refused("CAPTURE_NOT_KEPT", "The copy could not be kept whole, so nothing was filed.", 502) } });
  serve(t.world, ADDRESS, MINUTES);
  await capture(p);
  assert.ok(says(p, "refusal.CAPTURE_NOT_KEPT"));
  assert.equal(p.byOp("promote").length + p.byOp("captureseenin").length, 0);
});

/* ---------- C17: R2 (the result line of a project-less upload) ---------- */

const picture = () => new File([new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 255, 217])], "Seminary Ave.jpg", { type: "image/jpeg" });
const note = (words = "a note about the garage") => new File([words], "note.txt", { type: "text/plain" });
const FILLED = { "ci-how-made": true, "ci-where": "6012 Seminary Ave", "ci-what": "The pothole." };
/* an upload made through the page, the owner's answer drawn as it stands */
async function upload(t, path, file, plane = {}) {
  const p = await open(t, path, { plane });
  fill(p, { "ci-file": file, ...FILLED });
  await press(p, "captureupload");
  return p;
}
/* The owner's `captureupload` answers the held capture and its receipt and carries no reading (the door reads a document after it is promoted), so a line that is drawn
   from a reading the ANSWER carries is made from the owner's own answer for these very bytes with the reading added: the one scripted answer of these tests, which no act
   of the world makes. The bytes are stored by the real act and no document holds them yet, so the page's own promotion is real. */
async function answerWithReading(t, file, reading, units) {
  const type = file.type, name = file.name;
  const up = await t.world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: "s", name, type })}`, init: { method: "POST", headers: { "content-type": type }, body: new Uint8Array(await file.arrayBuffer()) } }, t.mai);
  const real = up.json.result;
  assert.equal(real.ok, true);
  return { captureupload: ok({ ...real, document: { ...real.document, reading, text_units: units } }) };
}

test("R2 (C17) a project-less upload's result line says the document was read when the answer carries a reading", async () => {
  const t = await team();
  const counted = await upload(t, "/app/capture/file", note("a note"), await answerWithReading(t, note("a note"), { title: "A note", words_read: 2, words_total: 2 }, [{ text: "a note" }]));
  assert.ok(says(counted, "screen.document.text.label"));
  assert.ok(says(counted, "screen.document.text.read", { read: "2", total: "2" }), "the count when the reading states one");
  assert.ok(!says(counted, "screen.document.text.unread") && !says(counted, "capture.picture.unread"));
  const words = note("a second note");
  const plain = await upload(t, "/app/capture/file", words, await answerWithReading(t, words, { title: "A note" }, [{ text: "a second note" }]));
  assert.ok(says(plain, "screen.document.text.full"), "a reading with words and no count");
  const empty = picture();
  const blank = await upload(t, "/app/capture/file", empty, await answerWithReading(t, empty, { title: null }, []));
  assert.ok(says(blank, "screen.document.text.none"), "a reading that found no words");
});

test("R2 (C17) a project-less upload with no reading says no reading is held, and for a picture what to do next", async () => {
  const t = await team();
  const photo = await upload(t, "/app/capture/file", picture());
  assert.ok(says(photo, "capture.picture.unread"), "a picture: its words can't be found until read or typed");
  assert.ok(!says(photo, "screen.document.text.read", { read: "0", total: "0" }));
  const file = await upload(t, "/app/capture/file", note());
  assert.ok(says(file, "screen.document.text.unread"), "any other file: not read yet");
});

test("R2 (C17) control: an upload with a project says what it did before and draws no reading line", async () => {
  const t = await team();
  const p = await upload(t, `/app/capture/file/${t.mine}`, picture());
  assert.ok(says(p, "screen.capture.file.done", { name: "Seminary Ave.jpg" }));
  assert.ok(says(p, "capture.filed.project", { project: "Pothole repairs" }));
  assert.ok(!says(p, "capture.picture.unread") && !says(p, "screen.document.text.unread") && !says(p, "screen.document.text.label"));
});

/* ---------- C14: R77, R88 (the reads the screens make) ---------- */

test("R50 (C14) Add makes one `heldcaptures` read, with fields=picker, and no read for a row; Held reads picker rows, then the full fields", async () => {
  const t = await team();
  const housing = await t.world.recipes.hold(t.mai, "Housing notice", "<html><head><title>Housing notice</title></head><body><p>A notice.</p></body></html>", "", { type: "text/html" });
  const add = await open(t, "/app/capture/address");
  assert.deepEqual(add.byOp("heldcaptures").map((r) => r.query.fields), ["picker"], "one read, the cheap picker row");
  const listed = (await t.mai.read("heldcaptures", { query: { fields: "picker" } })).held.map((h) => h.bundle_id);
  assert.ok(listed.includes(housing.bundle), "the owner lists the document the picker draws");
  serve(t.world, ADDRESS, MINUTES);
  await capture(add);
  assert.equal(add.byOp("heldcaptures").length, 1, "an act does not read the list again");
  assert.equal(add.byOp("image").length + add.byOp("captureaccounts").length, 0, "no read for each row");
  const held = await open(t, "/app/held");
  const reads = held.byOp("heldcaptures").filter((r) => r.query.state !== "set_aside");
  assert.deepEqual(reads.map((r) => (r.query.fields === "picker" ? "picker" : r.query.bundle_ids ? "full" : "page")), ["picker", "full"], "Held reads the page as picker rows, then the full fields of its rows (fix round 4)");
  assert.ok(text(held).includes("Housing notice"));
});

/* ---------- C25: R54 (one rule for a document's name) ---------- */

const promoted = (p) => p.byOp("promote").map((r) => r.body.meta.title);
let seq = 0;
const pageOf = (title, heading = "") => `<html>${title === null ? "" : `<head><title>${title}</title></head>`}<body>${heading ? `<h1>${heading}</h1>` : ""}<p>Page ${++seq}, as the site sent it.</p></body></html>`;
const pdfOf = (seed) => generate({ kind: "pdf", seed, size: { pages: 1, lines: 1 }, kinds: ["text"] }).bytes();
/* a page captured as the member's press does it: the address answers what the test serves, and the owners' acquire, allocid and promote do the rest */
async function captureOf(t, body, { type = "text/html", headers = {}, address = `https://www.example.gov/page-${++seq}`, plane = {} } = {}) {
  serve(t.world, address, body, type, headers);
  const p = await open(t, "/app/capture/address", { plane });
  await capture(p, address);
  return p;
}
const attachment = (name) => ({ "content-disposition": `attachment; filename="${name}"` });

test("R54 (C25) a page with a title is named by it; one without by its file name; one with neither by its host and the day, never the file part of its address", async () => {
  const t = await team();
  const titled = await captureOf(t, pageOf("Notice 2026-118"));
  assert.deepEqual(promoted(titled), ["Notice 2026-118"]);
  const filed = await captureOf(t, await pdfOf("notice"), { type: "application/pdf", headers: attachment("notice.pdf") });
  assert.deepEqual(promoted(filed), ["notice.pdf"]);
  /* the owner states the file part of an address that ends in a file name as the file's name, so a page whose address names no file is the one named by its host and the day */
  const neither = await captureOf(t, pageOf(null), { address: "https://www.example.gov/reports/street-maintenance-2026" });
  assert.equal(promoted(neither).length, 1);
  assert.ok(promoted(neither)[0].includes("www.example.gov") && !promoted(neither)[0].includes("street-maintenance"), "host and day");
});

test("R54 (C25) the name drawn at capture from `document.title` equals the name drawn once read from `reading.title`", async () => {
  const t = await team();
  /* the owner states one title for a page, as the document's and as its reading's: a page whose title is its first heading gives both */
  const atCapture = await captureOf(t, pageOf("Housing notice"));
  const onceRead = await captureOf(t, pageOf(null, "Housing notice"));
  assert.deepEqual(promoted(atCapture), promoted(onceRead));
  const sha = (await t.mai.read("heldcaptures", { query: { fields: "picker" } })).held.map((h) => h.capture.sha256).pop();
  assert.equal((await t.mai.read("reading", { query: { sha256: sha } })).reading.title, promoted(onceRead)[0], "the owner's reading states the title the page was named by");
  /* a capture held in parts (fix round 10, K5245): the owner makes one only of a file past 32 MiB, which no `acquire` answers inline (a source that long is parked and owed), so the case of
     a multi-part document answered by `acquire` is removed; the name of a document held in parts is not drawn by this screen's press */
});

test("R54 (C25) a PDF with no reading yet is named by its file name, once read by `reading.title`; one with no Title is named by its file name on both", async () => {
  const t = await team();
  /* a PDF the owner reads no title from is named by its file name; a page it reads one from is named by that title, whatever its file is called */
  assert.deepEqual(promoted(await captureOf(t, await pdfOf("agenda-a"), { type: "application/pdf", headers: attachment("agenda.pdf") })), ["agenda.pdf"]);
  assert.deepEqual(promoted(await captureOf(t, pageOf("Board agenda, October"), { headers: attachment("agenda.html") })), ["Board agenda, October"]);
  assert.deepEqual(promoted(await captureOf(t, pageOf(null), { headers: attachment("agenda-2.html") })), ["agenda-2.html"]);
});

test("R54 (C25) control: two documents from one host with different titles are told apart by their names", async () => {
  const t = await team();
  const a = await captureOf(t, pageOf("Minutes, September"));
  const b = await captureOf(t, pageOf("Minutes, October"));
  assert.notEqual(promoted(a)[0], promoted(b)[0]);
});

/* ---------- C23: R4 (Held by project) ---------- */

test("R4 (C23) Held filtered by a project reads that project's captures and marks a document filed there from another project (`also_here`); with no project chosen it lists all", async () => {
  const t = await team();
  const doc = (title) => `<html><head><title>${title}</title></head><body><p>${title}, ${++seq}.</p></body></html>`;
  await t.world.recipes.hold(t.mai, "Street survey", doc("Street survey"), t.mine, { type: "text/html" });
  const seen = await t.world.recipes.hold(t.mai, "Board minutes", doc("Board minutes"), t.home, { type: "text/html" });
  await t.world.recipes.hold(t.mai, "Other minutes", doc("Other minutes"), t.home, { type: "text/html" });
  await t.mai.act("captureseenin", { body: { captureSha: seen.sha, project: t.mine } });
  const filtered = await open(t, `/app/held/${t.mine}`);
  assert.ok(filtered.byOp("heldcaptures").length >= 1 && filtered.byOp("heldcaptures").every((r) => r.query.project === t.mine), "every list is that project's");
  assert.ok(text(filtered).includes("Street survey") && text(filtered).includes("Board minutes") && !text(filtered).includes("Other minutes"));
  const marked = Array.from(main(filtered).querySelectorAll("[data-also-here]"));
  assert.equal(marked.length, 1, "only the filed-from-elsewhere row is marked");
  assert.ok(marked[0].textContent.includes("Housing repairs") || marked[0].closest("[role=listitem], tr, .cs-row") !== null, "the mark names where it is held");
  const all = await open(t, "/app/held");
  assert.ok(all.byOp("heldcaptures").every((r) => r.query.project === undefined));
  assert.ok(text(all).includes("Other minutes") && main(all).querySelectorAll("[data-also-here]").length === 0, "all listed, none marked");
});

/* ---------- C29: no result line holds two full stops where one sentence ends ---------- */

const statusLines = (p) => Array.from(main(p).querySelectorAll('[role="status"]')).map((e) => e.textContent.trim()).filter(Boolean);
const DOUBLED = /(?<!\.)\.\.(?!\.)/;
async function testified(t, words) {
  const saw = await open(t, "/app/capture/saw");
  fill(saw, { "ci-words": words, "ci-where": "6012 Seminary Ave", "ci-when": "2026-10-04T09:10:00Z" });
  await press(saw, "testify");
  return saw;
}

test("C29 (R3) the testimony's result line does not double the full stop when the member's words end in one", async () => {
  const t = await team();
  const saw = await testified(t, "The pothole is still open.");
  assert.ok(statusLines(saw).length >= 1);
  assert.ok(statusLines(saw).every((l) => !DOUBLED.test(l)), JSON.stringify(statusLines(saw)));
  assert.ok(statusLines(saw).some((l) => l.includes("The pothole is still open")), "the words are still the link's name");
});

test("C29 control: a name that ends in an ellipsis is unchanged", async () => {
  const t = await team();
  const dots = await testified(t, "Wait for it...");
  assert.ok(statusLines(dots).some((l) => l.includes("Wait for it...")), "the typed ellipsis is kept whole");
  const cut = await testified(t, "x".repeat(100));
  assert.ok(statusLines(cut).some((l) => l.includes("x…")), "words cut for the name keep their ellipsis");
  const plain = await testified(t, "The pothole is still open");
  assert.ok(statusLines(plain).some((l) => l.includes("The pothole is still open")), "words with no full stop are unchanged");
});

test("C29 (R50, R2) the capture and upload result lines do not double a full stop either", async () => {
  const t = await team();
  const page = await captureOf(t, pageOf("Minutes of the board."));
  assert.ok(statusLines(page).every((l) => !DOUBLED.test(l)), JSON.stringify(statusLines(page)));
  const up = await upload(t, "/app/capture/file", new File(["x"], "notes.", { type: "text/plain" }));
  assert.ok(statusLines(up).length >= 1 && statusLines(up).every((l) => !DOUBLED.test(l)), JSON.stringify(statusLines(up)));
});

/* ---------- C28: R7 (the Inbox shows the name and type the sender stated) ---------- */

/* three knocks at the public door from one knocker, as the doorbell takes them: two state a file name and type, one neither */
async function knocks(t) {
  const knock = async (o) => {
    const a = (await t.world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ knockerSecret: "k".repeat(24), ...o }) } }, null)).json;
    assert.equal(a.ok, true);
    return { id: a.knockId, pseudonym: a.pseudonym, ...o };
  };
  return {
    ka: await knock({ contentText: "The agenda sheets for October.", note: "Sheets.", fileName: "agenda-oct.pdf", mediaType: "application/pdf" }),
    kb: await knock({ contentText: "A line with no name." }),
    kc: await knock({ contentText: "A picture of the pothole.", fileName: "photo.jpg", mediaType: "image/jpeg" }),
  };
}
const rowOf = (p, k) => Array.from(main(p).querySelectorAll('[role="listitem"]')).find((r) => r.querySelector(`a[href*="${k.id}"]`));

test("R7 (C28) an Inbox row draws the file name and type the sender stated; a knock with neither draws neither, with no empty label", async () => {
  const t = await team();
  const { ka, kb, kc } = await knocks(t);
  const p = await open(t, "/app/inbox");
  assert.ok(rowOf(p, ka).textContent.includes("agenda-oct.pdf") && rowOf(p, ka).textContent.includes("application/pdf"));
  assert.ok(rowOf(p, kc).textContent.includes("photo.jpg") && rowOf(p, kc).textContent.includes("image/jpeg"));
  const bare = rowOf(p, kb);
  assert.ok(bare, "the knock is listed");
  assert.equal(bare.querySelectorAll(".mk-data").length, 0, "no name, no type: nothing drawn for them");
  assert.ok(!/null|undefined/.test(bare.textContent) && !/ · \s*$/.test(bare.textContent.trim()), "and no empty label");
});

test("R7 (C28) the knocker's other material (`knocksof`) draws each knock's stated name and type too", async () => {
  const t = await team();
  const { ka, kb, kc } = await knocks(t);
  const p = await open(t, `/app/inbox/${ka.id}`);
  await press(p, "knocksof");
  const sec = main(p).querySelectorAll("section.cs-section").find((s) => s.querySelector(`a[href*="${kc.id}"]`));
  assert.ok(sec, "the section of other material");
  assert.ok(sec.textContent.includes("photo.jpg") && sec.textContent.includes("image/jpeg"));
  const none = Array.from(sec.querySelectorAll('[role="listitem"]')).find((r) => r.querySelector(`a[href*="${kb.id}"]`));
  assert.equal(none.querySelectorAll(".mk-data").length, 0, "a knock with neither draws neither");
});

/* ---------- C35: R29 ("For which question" tells questions of the same title apart) ---------- */

const options = (p) => Array.from(main(p).querySelectorAll("select#ci-for option, #ci-for option")).map((o) => o.textContent);
/* the page reads the routed question's project at once and the team's others afterwards, off the settle path */
const later = async (p) => { await p.settle(); await p.clock.tick(2000); for (let i = 0; i < 8; i++) await p.settle(20); };

/* a question is listed by its words, which is the title the owner's search gives it */
const SEVEN = "Are reported repairs made within seven days?", LIGHT = "Is the street lighting repaired?";

test("R29 (C35) two questions of different projects with the same title are told apart by project, one row per question", async () => {
  const t = await team();
  const qa = await t.world.recipes.question(t.mai, t.mine, { title: "Seven days", text: SEVEN, draw: true });
  await t.world.recipes.question(t.mai, t.home, { title: "Seven days", text: SEVEN, draw: true });
  await t.world.recipes.question(t.mai, t.mine, { title: "Street lighting", text: LIGHT, draw: true });
  const p = await open(t, `/app/capture/address/${qa.id}`);
  await later(p);
  const o = options(p);
  assert.equal(o.filter((x) => x.includes(SEVEN)).length, 2, "one row per question (a question the search lists twice is drawn once)");
  assert.ok(o.some((x) => x.includes(SEVEN) && x.includes("Pothole repairs")) && o.some((x) => x.includes(SEVEN) && x.includes("Housing repairs")), JSON.stringify(o));
});

test("R29 (C35) control: a question whose project no read names is listed by its title alone, as before", async () => {
  const t = await team();
  /* questions promoted into the projects but drawn into none: no project's list of questions names them */
  const qa = await t.world.recipes.question(t.mai, t.mine, { title: "Seven days", text: SEVEN });
  await t.world.recipes.question(t.mai, t.home, { title: "Seven days", text: SEVEN });
  await t.world.recipes.question(t.mai, t.mine, { title: "Street lighting", text: LIGHT });
  const p = await open(t, `/app/capture/address/${qa.id}`);
  await later(p);
  const o = options(p);
  assert.ok(o.includes(LIGHT), JSON.stringify(o));
  assert.equal(o.filter((x) => x === SEVEN).length, 2, "unchanged: both titles as the hits give them");
});

/* ---------- FC-23, N4, C78, C94: the logins section (DEC-403) and the requests for later; R57 (proposed) ---------- */

/* The door stamps the supplier of a login `by` as the member's viewer (`member:mai`), where capture-sources' own handler reads a bare member id (`mai`) and so refuses every
   member's login as `CAPTURE_CREDENTIAL_NOT_A_MEMBER` (a defect between store-request's stamp and capture-sources, reported). The owner is therefore asked its own handler with the
   member id it reads, and its answer is the page's: `owner(world, as, ...ops)` answers a plane entry that passes the page's request to the owner's route as that member. */
const ownerAs = async (world, as, op, body) => {
  const res = await world.send({ url: `http://x/${op}?viewer=${encodeURIComponent(as.member === "admin" ? "admin" : `member:${as.member}`)}&by=${encodeURIComponent(as.member)}`, body });
  const a = await res.json();
  return a.result ?? a;
};
const owner = (world, as, ...ops) => Object.fromEntries(ops.map((op) => [op, async (req) => ok(await ownerAs(world, as, op, req.body))]));
const SECRET = "p4ss-w0rd-X";
const LOGIN_HOST = "records.example-city.gov", AGENT_HOST = "agendas.example.org";
/* a team that can seal a login (the key is a binding the world is made with), the founder, and a member the founder added who has not yet chosen a handle */
async function lteam() {
  const t = await members({ mai: CAN, rosa: ["contribute"] }, { env: { CAPTURE_CREDENTIALS_KEY: "k".repeat(64) } });
  t.mine = await t.world.recipes.project(t.mai, "Pothole repairs");
  t.admin = await t.world.signIn("admin");
  return t;
}
const supplied = async (t, as, body) => {
  const a = await ownerAs(t.world, as, "capturecredentialsupply", { scope: "group", kind: "login", ...body });
  assert.equal(a.ok, true, JSON.stringify(a));
  return a;
};
const addr = (t, o = {}) => open(t, "/app/capture/address", o);
const sectionOf = (p, key) => main(p).querySelectorAll("section.cs-section").find((s) => s.querySelector("h2") && s.querySelector("h2").textContent.includes(word(key)));
const rowFor = (p, host) => Array.from(sectionOf(p, "screen.capture.logins.head").querySelectorAll(".cs-row")).find((r) => r.textContent.includes(host));

test("FC-23 the logins button with none stored says none; nothing is drawn before it is pressed", async () => {
  const t = await lteam();
  const p = await addr(t);
  const sec = sectionOf(p, "screen.capture.logins.head");
  assert.ok(sec, "the section is drawn");
  for (const k of ["screen.capture.logins.about1", "screen.capture.logins.about2", "screen.capture.logins.about3"]) assert.ok(saysIn(sec, k), k);
  assert.ok(!says(p, "screen.capture.logins.none"), "control: nothing before the press");
  assert.equal(p.byOp("capturecredentiallist").length, 0, "and no read before the press");
  await press(p, "capturecredentiallist");
  assert.ok(says(p, "screen.capture.logins.none"));
});

test("FC-23 the logins button with some stored draws the list: site, what it asks for, who may use it, who gave it and when; a login is withdrawn and the list read again", async () => {
  const t = await lteam();
  const first = (await supplied(t, t.rosa, { host: LOGIN_HOST, secret: "rosa:pw" })).credential.credential;
  await supplied(t, t.admin, { host: AGENT_HOST, kind: "user-agent", scope: "member", secret: "Civicsmith-Reader/1" });
  /* the founder reads every login and may withdraw another member's */
  const p = await addr(t, { as: t.admin, plane: owner(t.world, t.admin, "capturecredentialwithdraw") });
  await press(p, "capturecredentiallist");
  assert.ok(!says(p, "screen.capture.logins.none"));
  assert.equal(sectionOf(p, "screen.capture.logins.head").querySelectorAll(".cs-row").length, 2);
  const a = rowFor(p, LOGIN_HOST), b = rowFor(p, AGENT_HOST);
  assert.ok(a.textContent.includes(word("screen.capture.logins.kind.login")) && a.textContent.includes(word("screen.capture.logins.scope.group")) && a.textContent.includes("rosa"), "the row names site, kind, scope and giver");
  assert.ok(b.textContent.includes(word("screen.capture.logins.kind.user-agent")) && b.textContent.includes(word("screen.capture.logins.scope.member")));
  assert.ok(!/\badmin\b/.test(b.textContent), "no member id where a handle is known: the founder is named by her handle");
  assert.ok(b.textContent.includes("founder"));
  assert.ok(!text(p).includes(SECRET) && !text(p).includes("rosa:pw"), "never a secret");
  await press(p, "capturecredentialwithdraw", { reason: "No longer needed.", sel: `[data-credential="${first}"]` });
  assert.deepEqual(p.byOp("capturecredentialwithdraw").map((r) => r.body.credential), [first]);
  assert.equal(Array.from(sectionOf(p, "screen.capture.logins.head").querySelectorAll(".cs-row")).length, 1, "the list is read again");
  assert.equal((await t.admin.read("capturecredentiallist")).entries.filter((e) => e.withdrawn_at === null).length, 1, "the owner withdrew it");
});

test("C78 the stored-logins explanation is the node after its own button; the other button, requests for later, has none", async () => {
  const t = await lteam();
  await supplied(t, t.rosa, { host: LOGIN_HOST, secret: "rosa:pw" });
  const p = await addr(t);
  const sec = sectionOf(p, "screen.capture.logins.head");
  const button = sec.querySelector('button[data-act="capturecredentiallist"]');
  assert.ok(button);
  let at = button.closest(".mk-acts") || button;
  const next = at.nextElementSibling;
  assert.ok(next && saysIn(next, "screen.capture.cred.listnote1") && saysIn(next, "screen.capture.cred.listnote2"), "the explanation follows its button");
  const later = main(p).querySelector('button[data-act="capturerequests"]');
  const after = (later.closest(".mk-acts") || later).nextElementSibling;
  assert.ok(!after || (!saysIn(after, "screen.capture.cred.listnote1") && !saysIn(after, "screen.capture.logins.about1")), "control: the other button has no such explanation");
});

test("FC-23 giving a login for a site sends kind, host, secret, scope (and the project for 'this project'); a login's secret is `username:secret`; no request is retried", async () => {
  const t = await lteam();
  const p = await open(t, `/app/capture/address/${t.mine}`, { plane: owner(t.world, t.mai, "capturecredentialsupply") });
  fill(p, { "cl-host": "Records.Example-City.gov", "cl-name": "mai", "cl-secret": SECRET });
  p.doc.getElementById("cl-scope").value = "project";
  await press(p, "capturecredentialsupply", { reason: "The team needs this site.", sel: '[data-general="1"]' });
  const sent = p.byOp("capturecredentialsupply");
  assert.equal(sent.length, 1);
  const { reason, ...body } = sent[0].body;
  assert.deepEqual(body, { kind: "login", host: "records.example-city.gov", secret: `mai:${SECRET}`, scope: "project", project: t.mine });
  assert.equal(p.byOp("capturerequestretry").length, 0, "needs no refused request");
  assert.ok(!html(p).includes(SECRET), "the secret is not drawn back");
  for (const r of p.requests) if (r.op !== "capturecredentialsupply") assert.ok(!JSON.stringify(r).includes(SECRET), `${r.op} carries no secret`);
  assert.ok(sectionOf(p, "screen.capture.logins.head").querySelectorAll(".cs-row").length >= 1, "the list is read again and drawn");
  const kept = (await t.mai.read("capturecredentiallist")).entries;
  assert.deepEqual(kept.map((e) => [e.kind, e.host, e.scope, e.project, e.supplied_by]), [["login", LOGIN_HOST, "project", t.mine, "mai"]], "the owner holds what the page sent");
});

test("FC-23 a browser name or something else is sent as the secret alone; a missing site, username (for a login) or secret sends nothing and says which", async () => {
  const t = await lteam();
  const p = await addr(t, { plane: owner(t.world, t.mai, "capturecredentialsupply") });
  fill(p, { "cl-host": AGENT_HOST, "cl-secret": "Civicsmith-Reader/1" });
  p.doc.getElementById("cl-kind").value = "user-agent";
  await press(p, "capturecredentialsupply", { reason: "r", sel: '[data-general="1"]' });
  const { reason, ...body } = p.byOp("capturecredentialsupply")[0].body;
  assert.deepEqual(body, { kind: "user-agent", host: AGENT_HOST, secret: "Civicsmith-Reader/1", scope: "group" });
  const q = await addr(t);
  fill(q, { "cl-host": "", "cl-name": "mai", "cl-secret": SECRET });
  const a = await press(q, "capturecredentialsupply", { reason: "r", sel: '[data-general="1"]' });
  assert.ok(saysIn(a.slot(), "capture.fieldneeded", { field: word("screen.capture.logins.site") }));
  fill(q, { "cl-host": "x.example.org", "cl-name": "", "cl-secret": SECRET });
  const b = await press(q, "capturecredentialsupply", { reason: "r", sel: '[data-general="1"]' });
  assert.ok(saysIn(b.slot(), "capture.fieldneeded", { field: word("screen.capture.logins.name") }));
  fill(q, { "cl-name": "mai", "cl-secret": "" });
  const c = await press(q, "capturecredentialsupply", { reason: "r", sel: '[data-general="1"]' });
  assert.ok(saysIn(c.slot(), "capture.fieldneeded", { field: word("screen.capture.logins.secret") }));
  assert.equal(q.byOp("capturecredentialsupply").length, 0);
  assert.equal((await t.mai.read("capturecredentiallist")).entries.length, 1, "the owner holds the one login, and none of the three that were stopped");
});

test("N4 'Show my requests for later' with none says none; with some it draws them; nothing is drawn before it is pressed", async () => {
  const t = await lteam();
  const p = await addr(t);
  assert.ok(!main(p).textContent.includes(word("screen.capture.later.head")), "control: nothing before the press");
  await press(p, "capturerequests");
  const sec = sectionOf(p, "screen.capture.later.head");
  assert.ok(sec, "the section is drawn once asked");
  assert.ok(sec.textContent.includes(word("screen.capture.later.none")), "and says there are none");
  const asked = await t.mai.act("capturerequest", { body: { address: "https://records.example-city.gov/a" } });
  /* DEFECT (screens-intake, reported): the page keeps a request as the member's own by `principal_plane`, a field the owner's rows do not carry (they name who asked under
     `attribution.principals.plane`), so the owner's own request is not drawn and this assertion fails until the screen reads the owner's field */
  const q = await addr(t);
  await press(q, "capturerequests");
  const draws = sectionOf(q, "screen.capture.later.head");
  assert.ok(draws && draws.textContent.includes("records.example-city.gov") && !draws.textContent.includes(word("screen.capture.later.none")));
  assert.ok((await t.mai.read("capturerequests")).requests.some((r) => r.request === asked.request), "the owner holds the request");
});

test("C94 a member is named by handle where the capture screen names one (link and name), never by id; a member with no handle draws the fallback word", async () => {
  const t = await lteam();
  /* the founder holds a document at an address: her member id is `admin` and her handle `founder` */
  serve(t.world, ADDRESS, MINUTES);
  const held = await t.world.recipes.hold(t.admin, "Board minutes", MINUTES, "", { type: "text/html" });
  await t.admin.act("acquire", { body: { locator: ADDRESS } });
  const p = await open(t, "/app/capture/address");
  await capture(p);
  const link = Array.from(main(p).querySelectorAll("a")).find((a) => String(a.getAttribute("href")).includes("/app/members/"));
  assert.ok(link, "the member is linked");
  assert.equal(link.getAttribute("href"), "/app/members/founder", "by handle");
  assert.equal(link.textContent, "founder");
  assert.ok(!/\badmin\b/.test(text(p)), "no member id drawn");
  assert.ok(anchors(p, held.bundle).length >= 1);
  /* a member the founder added who has not enrolled has no handle: a login she gave is named by the fallback word, never by her id */
  await t.admin.act("memberadd", { body: { memberId: "ghost", cover: "the world's member ghost" } });
  await t.admin.act("memberset", { body: { memberId: "ghost", status: "active" } });
  await supplied(t, { member: "ghost" }, { host: AGENT_HOST, kind: "user-agent", secret: "Civicsmith-Reader/1" });
  const q = await addr(t);
  await press(q, "capturecredentiallist");
  assert.ok(rowFor(q, AGENT_HOST).textContent.includes(word("shell.card.member")), "no handle known: the fallback word");
  assert.ok(!text(q).includes("ghost"), "never the id");
});

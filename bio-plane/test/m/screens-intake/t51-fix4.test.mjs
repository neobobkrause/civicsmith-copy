/* screens-intake T51 fix round 4 (SCREENS-INTAKE #15; K4429): C9 R49 (the pre-flight's path), FC-23 (the login control's words), C14 (Held's read
 * set: the picker for the page, the full fields for the rows it draws; capture R102), C25 R54 (a PDF named by its title), and the rows
 * DEC-412 wrote (`filedhere`, `later.none`, `unread.next`). A sentence is asserted by its key (R26), never by its English. Every test
 * enters by pressing the act (or opening the page), never by calling a `done` function.
 *
 * Fix round 10 (K5054): over the REAL store. A document held is held by real acts (the page's own capture of an address, an upload and its promotion); a member
 * who may or may not see it is a participant of its project, or not (`projectinvite`, `projectjoin`); a site that changed is the world's network answering
 * another body (an environment double). Every value an assertion needs (a digest, a bundle id, the picker's order) is read from what those acts answered. A fault
 * is the only scripted answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { ok, openWorld, members, text, main, btn, fill, press, refused, word, says, DOCUMENT_STUB, untitled } from "./page.mjs";
import { SCREENS, SCREEN_KEYS } from "../../../src/screens-intake/index.mjs";
import { generate } from "../../pdfgen.mjs";

const ADDRESS = "https://www.nps.gov/yose/index.htm";
const CAN = ["contribute", "create_projects"];
const PAGE = "<html><head><title>Yosemite National Park</title></head><body>\n<h1>Yosemite National Park</h1>\n<p>Yosemite National Park, as first captured.</p>\n</body></html>";
const PLAIN = { "content-type": "text/html" };
/* a page whose substance the capture can judge (an ASP.NET calendar, capture R96): a different row is a change, not a rebuilt page */
const CALENDAR_HEADERS = { "content-type": "text/html; charset=utf-8", "x-powered-by": "ASP.NET", server: "Microsoft-IIS/10.0" };
const calendar = (row) => `<!DOCTYPE html><html><head><title>City Council Calendar</title></head><body><div id="hdr">nav</div><form id="aspnetForm" method="post"><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="STATE_${"x".repeat(300)}" /><main id="mainContent" role="main"><table><tr><th>Name</th><th>Date</th></tr><tr><td>${row}</td><td>7/15/2026</td></tr></table></main></form></body></html>`;
const anchors = (p, id) => Array.from(main(p).querySelectorAll("a")).filter((a) => String(a.getAttribute("href")).includes(id));
const open = (t, as, path, plane = {}) => openWorld(path, { world: t.world, as, plane, screens: [...SCREENS, DOCUMENT_STUB] });
const serve = (t, address, body, headers = PLAIN) => t.world.script(address, async () => new Response(body, { status: 200, headers }));
const pressCapture = async (p, address = ADDRESS) => { fill(p, { "ci-address": address }); await press(p, "acquire"); };

/* the team: `mai` has the project MINE; `xan` has the project HOME and has captured the address into it by the page's own act, so the record holds it (under
   HOLDER, with the digest SHA); `mai` is a participant of HOME (invited by xan, joined by herself) only when `sees` (a viewer who may not see the home reads
   the address as not held, capture R96). The host's cooling-off after the first fetch has passed. */
async function heldElsewhere({ sees = true, body = PAGE, headers = PLAIN } = {}) {
  const t = await members({ mai: CAN, xan: CAN });
  serve(t, ADDRESS, body, headers);
  t.MINE = await t.world.recipes.project(t.mai, "Pothole repairs");
  t.HOME = await t.world.recipes.project(t.xan, "Housing repairs");
  await pressCapture(await open(t, t.xan, `/app/capture/address/${t.HOME}`));
  const filed = (await t.xan.read("heldcaptures", { query: { project: t.HOME } })).held;
  assert.equal(filed.length, 1, "the other member's capture is in the record");
  t.HOLDER = filed[0].bundle_id;
  t.SHA = filed[0].capture.sha256;
  if (sees) {
    await t.xan.act("projectinvite", { query: { projectId: t.HOME, handle: "mai" } });
    await t.mai.act("projectjoin", { query: { projectId: t.HOME } });
  }
  await t.world.tick(120_000);
  return t;
}

/* ---------- C9: R49, the pre-flight's path ---------- */

test("R49 (C9) pressing Capture on an address already held under another project, from a project's page, sends no acquire, files the document in this project and says so", async () => {
  const t = await heldElsewhere();
  const p = await open(t, t.mai, `/app/capture/address/${t.MINE}`);
  await pressCapture(p);
  assert.equal(p.byOp("acquire").length, 0, "the pre-flight found it held: nothing is fetched");
  assert.equal(p.byOp("heldat").length, 1, "the press asked, once");
  assert.deepEqual([p.byOp("heldat")[0].query.address, p.byOp("heldat")[0].query.check], [ADDRESS, "true"]);
  assert.deepEqual(p.byOp("captureseenin").map((r) => r.body), [{ captureSha: t.SHA, project: t.MINE }], "the digest and the page's project, nothing else");
  assert.equal(p.byOp("allocid").length + p.byOp("promote").length, 0, "no second document is written");
  const list = (await t.mai.read("heldcaptures", { query: { project: t.MINE } })).held;
  assert.deepEqual(list.map((r) => [r.bundle_id, r.also_here]), [[t.HOLDER, { home: t.HOME }]], "the project's list now holds it, as seen from its home");
  assert.ok(says(p, "screen.capture.address.filedhere", { project: "Housing repairs" }), "the draw says it is filed here as well and where it stays held");
  assert.equal(anchors(p, t.HOLDER).length, 1, "the held copy is linked once");
});

test("R49 (C9) the compared copy of an undetermined look is filed here too; a changed site waits for the member's choice and files nothing at the press", async () => {
  /* the site now gives other bytes of a page whose substance the capture cannot judge: undetermined */
  const u = await heldElsewhere();
  serve(u, ADDRESS, PAGE.replace("as first captured", "as it reads now"));
  const pu = await open(u, u.mai, `/app/capture/address/${u.MINE}`);
  await pressCapture(pu);
  assert.deepEqual(pu.byOp("captureseenin").map((r) => r.body), [{ captureSha: u.SHA, project: u.MINE }]);
  assert.ok(says(pu, "screen.capture.address.filedhere", { project: "Housing repairs" }));
  /* the site now gives a page whose substance differs and can be judged: changed */
  const c = await heldElsewhere({ body: calendar("City Council"), headers: CALENDAR_HEADERS });
  serve(c, ADDRESS, calendar("Rules Committee"), CALENDAR_HEADERS);
  const pc = await open(c, c.mai, `/app/capture/address/${c.MINE}`);
  await pressCapture(pc);
  assert.equal(pc.byOp("captureseenin").length, 0, "the member has not chosen: nothing is filed");
  assert.equal(pc.byOp("acquire").length, 0);
  assert.ok(btn(pc, "acquire", '[data-again="1"]'), "and the two acts are offered");
});

test("R49 (C9) control: a home that is the page's own project, and a page with no project, file nothing and send no captureseenin", async () => {
  /* the home is the page's own project: the member captured the address into it herself */
  const t = await members({ mai: CAN });
  serve(t, ADDRESS, PAGE);
  const MINE = await t.world.recipes.project(t.mai, "Pothole repairs");
  await pressCapture(await open(t, t.mai, `/app/capture/address/${MINE}`));
  const holder = (await t.mai.read("heldcaptures", { query: { project: MINE } })).held[0].bundle_id;
  await t.world.tick(120_000);
  const ps = await open(t, t.mai, `/app/capture/address/${MINE}`);
  await pressCapture(ps);
  assert.equal(ps.byOp("captureseenin").length, 0);
  assert.equal(ps.byOp("acquire").length, 0);
  assert.equal(anchors(ps, holder).length, 1, "it is still named and linked");
  assert.ok(!says(ps, "screen.capture.address.filedhere", { project: "Pothole repairs" }));
  /* a page with no project */
  const bare = await heldElsewhere();
  const pb = await open(bare, bare.mai, "/app/capture/address");
  await pressCapture(pb);
  assert.equal(pb.byOp("captureseenin").length, 0);
});

test("R49 (C9) control: a viewer who cannot see the home reads the address as not held, so the capture goes on and the holder sentence is drawn; nothing is filed", async () => {
  const t = await heldElsewhere({ sees: false });
  const p = await open(t, t.mai, `/app/capture/address/${t.MINE}`);
  await pressCapture(p);
  assert.equal(p.byOp("acquire").length, 1, "not held for this viewer: the capture goes on");
  assert.equal(p.byOp("captureseenin").length, 0);
  assert.ok(says(p, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"));
});

test("R49 (C9) a captureseenin the plane refuses at the press is drawn by its words and the compared copy is still shown once, not said to be filed", async () => {
  const t = await heldElsewhere();
  /* the owner's refusal of a reference to a document it holds is a fault no real act of the member can cause: the one scripted answer */
  const p = await open(t, t.mai, `/app/capture/address/${t.MINE}`, { captureseenin: refused("CAPTURE_NOT_HELD", "That document is not held.", 404) });
  await pressCapture(p);
  assert.equal(p.byOp("captureseenin").length, 1);
  assert.ok(says(p, "refusal.CAPTURE_NOT_HELD"), "the refusal in the row's words");
  assert.equal(anchors(p, t.HOLDER).length, 1);
  assert.ok(!says(p, "screen.capture.address.filedhere", { project: "Housing repairs" }));
});

test("R49 (G73) a home project the member cannot read: no filedhere sentence and never the home's id; the project it is filed under is named, and the held list's marker is drawn without words", async () => {
  const t = await heldElsewhere();
  /* the owner names the home to a viewer who may read it; here the home answers no name (its document and its project's list entry are not read for her): the two reads the screen names it by */
  const unreadable = (as, op, hide) => async (req) => {
    const hidden = hide(req);
    if (hidden) return hidden;
    const { op: _op, ...query } = req.query;
    return ok(await as.read(op, { query }));
  };
  const plane = {
    image: unreadable(t.mai, "image", (req) => (req.query.id === t.HOME ? refused("NOT_FOUND", "No such project.", 404) : null)),
    projectlist: async () => ok({ projects: (await t.mai.read("projectlist")).projects.filter((x) => x.id !== t.HOME) }),
  };
  const p = await open(t, t.mai, `/app/capture/address/${t.MINE}`, plane);
  await pressCapture(p);
  assert.equal(p.byOp("captureseenin").length, 1, "it is filed here all the same");
  assert.ok(!says(p, "screen.capture.address.filedhere", { project: "Housing repairs" }) && !says(p, "screen.capture.address.filedhere", { project: "" }), "no filedhere sentence");
  assert.ok(says(p, "capture.filed.project", { project: "Pothole repairs" }), "the project it is filed under is named");
  assert.ok(!text(p).includes(t.HOME) && !text(p).includes("housing-repairs"), "never the home's id");
  const held = await open(t, t.mai, `/app/held/${t.MINE}`, plane);
  const choice = held.doc.getElementById("ch-who");   /* the document is xan's: Everyone's holds it */
  choice.value = "all";
  await held.fire(choice, "change");
  await held.settle(); await held.settle();
  const row = main(held).querySelector(`#pick-held-${t.HOLDER}`);
  assert.ok(row, "the project's list holds it");
  const mark = main(held).querySelector("[data-also-here]");
  assert.ok(mark && mark.textContent.trim() === "", "the marker is drawn without words");
  assert.ok(!text(held).includes(t.HOME), "and never the home's id");
});

/* ---------- FC-23: the login control's words ---------- */

test("FC-23 the 'Store this login' control carries its words, inside the folded 'Give a login for a site' disclosure", async () => {
  const t = await members({ mai: CAN });
  const p = await open(t, t.mai, "/app/capture/address");
  const b = btn(p, "capturecredentialsupply", '[data-general="1"]');
  assert.ok(b, "the control is drawn");
  assert.equal(b.textContent.trim().startsWith(word("screen.capture.logins.store")), true, "its text is the key's words");
  const d = b.closest("details");
  assert.ok(d, "inside the fold: a closed fold has no rendered text for a reader of `innerText` (the walker's empty text), not a missing word");
  assert.ok(d.querySelector("summary").textContent.includes(word("screen.capture.logins.give")));
});

/* ---------- the rows DEC-412 wrote ---------- */

test("DEC-412 the screen lists the keys it draws: filedhere and later.none (capture), whose rows exist", async () => {
  for (const k of ["screen.capture.address.filedhere", "screen.capture.later.none", "screen.document.text.unread.next"]) assert.ok(SCREEN_KEYS.capture.includes(k), k);
});

test("N4 'Show my requests for later' with none says screen.capture.later.none, by its key", async () => {
  const t = await members({ mai: CAN });
  const p = await open(t, t.mai, "/app/capture/address");
  await press(p, "capturerequests");
  assert.ok(says(p, "screen.capture.later.none"));
  assert.ok(!says(p, "state.empty"));
});

test("R2 (C17) an unread upload that is no picture says what to do next, by screen.document.text.unread.next", async () => {
  const t = await members({ mai: CAN });
  const p = await open(t, t.mai, "/app/capture/file");
  fill(p, { "ci-file": new File(["a note"], "note.bin", { type: "application/octet-stream" }), "ci-how-made": true, "ci-where": "Here", "ci-what": "A note." });
  await press(p, "captureupload");
  assert.equal(p.byOp("promote").length, 1, "the upload was filed");
  assert.ok(says(p, "screen.document.text.unread"));
  assert.ok(says(p, "screen.document.text.unread.next"));
});

/* ---------- C25: R54, one name for a PDF ---------- */

/* acquisition R98 (pdf-reader R40): the IRS Form 1040-ES answers `document.title` "2026 Form 1040-ES" (the title its Info dictionary holds), the real file the
   pdf-reader's own tests read (331,490 bytes), and the file name the source gives, `f1040es.pdf`. A PDF with no title is a generated one with no Info dictionary. */
const IRS = "https://www.irs.gov/pub/irs-pdf/f1040es.pdf";
const IRS_PDF = new Uint8Array(readFileSync(new URL("../pdf-reader/fixtures/f1040es.pdf", import.meta.url)));
const PDF_HEADERS = { "content-type": "application/pdf" };
const TITLE = "2026 Form 1040-ES";

async function capturePdf(titled, stated = null) {
  const t = await members({ mai: CAN });
  serve(t, IRS, titled ? IRS_PDF : await generate({ kind: "pdf", seed: "untitled", size: { pages: 2, lines: 3 }, kinds: ["text"] }).bytes(),
    stated ? { ...PDF_HEADERS, "content-disposition": `attachment; filename="${stated}"` } : PDF_HEADERS);
  const add = await open(t, t.mai, "/app/capture/address");
  fill(add, { "ci-address": IRS });
  await press(add, "acquire");
  const filed = add.byOp("promote").map((r) => r.body);
  const held = await open(t, t.mai, "/app/held");
  return { add, held, filed };
}
const rowOf = (p, id) => main(p).querySelector(`#pick-held-${id}`).closest("tr, .cs-r, li, div");

test("R54 (C25) a PDF whose answer carries its title is named by it on the Add result, in the filed bundle and on Held", async () => {
  const { add, held, filed } = await capturePdf(true);
  assert.equal(filed.length, 1);
  assert.equal(filed[0].meta.title, TITLE, "the bundle is titled by the PDF's own title");
  assert.ok(text(add).includes(TITLE), "the Add result names it");
  assert.ok(!text(add).includes("f1040es.pdf"), "and not by the file part of its address");
  assert.ok(rowOf(held, filed[0].bundleId).textContent.includes(TITLE), "Held names it the same");
});

test("R54 (C25) control: a PDF with no title is named by the file name the source states, on the Add result and on Held alike", async () => {
  const { add, held, filed } = await capturePdf(false, "estimated-tax-vouchers.pdf");
  assert.equal(filed[0].meta.title, "estimated-tax-vouchers.pdf");
  assert.ok(text(add).includes("estimated-tax-vouchers.pdf"));
  assert.ok(rowOf(held, filed[0].bundleId).textContent.includes("estimated-tax-vouchers.pdf"));
});

test("R54 (C25) control: a PDF with no title whose source states the very name its address ends in (a content-disposition) is named by it", async () => {
  const { add, held, filed } = await capturePdf(false, "f1040es.pdf");
  assert.equal(filed[0].meta.title, "f1040es.pdf", "the source stated it");
  assert.ok(text(add).includes("f1040es.pdf"));
  assert.ok(rowOf(held, filed[0].bundleId).textContent.includes("f1040es.pdf"));
});

test("R54 (C25) control: a PDF with no title whose source states no name is never named by the file part of its address, but by its host and the day", async () => {
  const { add, held, filed } = await capturePdf(false);
  assert.equal(filed[0].meta.title, untitled("www.irs.gov"));
  assert.ok(!text(add).includes("f1040es.pdf"));
  assert.ok(rowOf(held, filed[0].bundleId).textContent.includes(untitled("www.irs.gov")));
});

/* ---------- C14: Held's read set (capture R102) ---------- */

/* documents the member holds, by the real acts of an upload and its promotion (`hold`): `n` of them, filed under `projectId` when one is named; a crucial one
   (`crucial`) is a document the record marks of crucial criticality, which a batch never releases (ratification), so the list states it ineligible */
async function documents(t, n, projectId = "") {
  for (let i = 0; i < n; i++) await t.world.recipes.hold(t.mai, `Document ${i}`, `The words of document ${i}.\n`, projectId);
}
async function crucial(t, name, content) {
  const { hex, instant } = await import("../store-request/door.mjs");
  const up = await t.world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: name, name })}`, init: { method: "POST", headers: { "content-type": "text/plain" }, body: new TextEncoder().encode(content) } }, t.mai);
  const doc = up.json.result.document, sha = doc.capture.sha256, now = instant(t.world);
  const id = (await t.mai.read("allocid", { query: { prefix: "INFO", year: now.slice(0, 4) } })).id + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const front = ["---", "id: " + id, "object_type: information", "schema: information@2", "title: " + JSON.stringify(name), "current_state: collected", "prior_state: null", "created: " + now,
    "last_updated: " + now, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false",
    "  since: null", "  source: null", "visuals: []", "criticality: crucial", "source_status: unchanged", "content_hash: sha256:" + hex(sha), "source:", "  locator: " + JSON.stringify(doc.locator || "upload"),
    "  authority: member-entered", "  retrieved: " + now, "monitoring:", "  enabled: false", "  frequency: none", "---", "", "## Summary", "", name, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const prov = JSON.stringify({ documents: [doc] }, null, 1), dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator || "upload", sha256: sha }] });
  const len = (x) => new TextEncoder().encode(x).length;
  const files = [{ path: "bundle.md", text: front, bytes: len(front), sha256: hex(front) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: hex(prov) },
    { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: hex(dataset) }, { path: doc.file, blobSha: sha, sha256: sha, bytes: doc.capture.bytes }];
  await t.mai.act("promote", { body: { bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + hex(id).slice(0, 8),
    meta: { object_type: "information", title: name, current_state: "collected", created: now, last_updated: now }, files, register: [{ sha256: sha, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }] } });
  return id;
}
const reads = (p) => p.byOp("heldcaptures").map(({ query: { op, ...q } }) => q);

test("R4 (C14) Held reads the page as picker rows, then the full fields for the rows it draws by bundle_ids (at most 50), and nothing else of heldcaptures", async () => {
  const t = await members({ mai: CAN });
  await documents(t, 60);
  const p = await open(t, t.mai, "/app/held");
  const q = reads(p);
  assert.equal(q.length, 3, "the picker page, the full fields of its rows, the set-aside list: no more");
  const picker = q.find((x) => x.fields === "picker"), full = q.find((x) => x.bundle_ids), aside = q.find((x) => x.state === "set_aside");
  /* fix round 10, cause 33 (R4, DEC-97 clause 1): the list opens on the viewer's own captures, sent as `member` */
  assert.deepEqual(picker, { limit: "50", fields: "picker", member: "mai" });
  assert.ok(full && !full.fields, "the full read asks no picker");
  const ids = full.bundle_ids.split(",");
  assert.equal(ids.length, 50, "the 50 rows the page draws, never 60");
  const pickerRows = (await t.mai.read("heldcaptures", { query: picker })).held.map((r) => r.bundle_id);
  assert.deepEqual(ids, pickerRows, "in the picker's order");
  assert.equal(new Set(ids).size, 50);
  assert.ok(aside);
  assert.equal(p.byOp("projectlist").length, 1, "the projects once");
  assert.equal(main(p).querySelectorAll('[id^="pick-held-"]').length, 50, "50 rows drawn");
  assert.ok(says(p, "screen.held.more", { count: 50 }), "the page says there are more");
});

test("R4 (C14) a project's Held carries the project in both reads; a refresh reads the picker and the full fields once each; an act that changes the list does the same", async () => {
  const t = await members({ mai: CAN });
  const project = await t.world.recipes.project(t.mai, "The Coliseum lease");
  await documents(t, 3, project);
  const p = await open(t, t.mai, `/app/held/${project}`);
  assert.deepEqual(reads(p).filter((x) => x.state !== "set_aside").map((x) => x.project), [project, project]);
  const bare = await open(t, t.mai, "/app/held");
  const before = reads(bare).length;
  await press(bare, "heldcaptures");
  const after = reads(bare).slice(before);
  assert.equal(after.filter((x) => x.fields === "picker").length, 2, "the act's own picker read and the list's, both the cheap read");
  assert.equal(after.filter((x) => x.bundle_ids).length, 1, "and the full fields once for the new answer, not again for the same rows");
  assert.equal(after.filter((x) => !x.fields && !x.bundle_ids && x.state !== "set_aside").length, 0, "no full-row page read");
});

test("R4 (C14) the rows are listed from the picker at once, and the full fields (eligibility, the questions, the age) are drawn once they arrive; a full read that fails is drawn failed beside rows still listed", async () => {
  const t = await members({ mai: CAN });
  await documents(t, 2);
  const lease = await crucial(t, "The lease", "The lease runs ten years.\n");
  const p = await open(t, t.mai, "/app/held");
  assert.equal(main(p).querySelectorAll('[id^="pick-held-"]').length, 3);
  const full = (await t.mai.read("heldcaptures", { query: { bundle_ids: lease } })).held[0];
  assert.deepEqual([full.eligible, full.class], [false, "CRUCIAL_IN_BATCH"], "the owner states the lease ineligible");
  assert.ok(says(p, "screen.held.ineligible.alone"), "a full field drawn from the second read");
  /* a full read that fails: the store silent for that read alone, a fault; every other read is the owner's */
  const bad = await open(t, t.mai, "/app/held", { heldcaptures: (req) => (req.query.bundle_ids ? refused("STORE_SILENT", "store silent (test fixture)", 502) : t.world.door(req, t.mai)) });
  assert.equal(main(bad).querySelectorAll('[id^="pick-held-"]').length, 3, "the rows are still listed");
  assert.match(text(bad), /store silent \(test fixture\)/);
  assert.ok(main(bad).querySelector('[data-state="failed"]'));
});

test("R4 (C14) control: an empty page makes no full read", async () => {
  const t = await members({ mai: CAN });
  const p = await open(t, t.mai, "/app/held");
  assert.equal(reads(p).filter((x) => x.bundle_ids).length, 0);
});

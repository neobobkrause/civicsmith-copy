/* screens-intake T51 fix round 6 (SCREENS-INTAKE #18): G2 (a capture too large for the request is said, watched and finished: R58), G3 ("Finish it" answered at
 * once is watched to its end: R31), G7 ("the reading follows" only where the answer holds no reading: R57), G6 (an upload's register names the whole first: R21).
 * Every test enters by pressing the act. A sentence is asserted by its key (R26). The words are the nearest held rows (K4269): `screen.capture.address.working.head`,
 * `size.mb`, `capture.filed.project`, `screen.capture.address.done`, `refusal.FETCH_FAILED`; rows owed are named in the job record.
 *
 * R-SEAM: acquisition's `fetch_pending` answer and capture's `opencaptures` listing are the providers' (G2), unmerged at this START: the screen is drawn against the shapes
 * the plan states, and the last test holds capture's own declaration of `acquire` to carrying `project`, red by name until capture merges. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, main, fill, press, ok, says, word, lapse, DOCUMENT_STUB } from "./page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { collectOwnerRows as realRows } from "../interface-shell/harness.mjs";

/* Fix round 10 (K5245): an owed fetch is delivered, lapsed or refused by the store's own clock (`deliver: true`, store-request R19). */
/* Fix round 10 (K5054): every screen here is opened over the REAL store. A member and a project are made by real acts; an address is answered by the world's
 * network (`world.script`, an environment double); the page's own acts (`acquire`, `captureupload`, `promote`) are answered by the real modules. What stays scripted
 * is what the world cannot make and is said where it stays: the plane's alarm runs no delivery here (store-assembly's pending work holds no control-plane
 * `deliverOwedRender`), so a parked fetch is never filed or dropped from the list by a clock; and an owner's flag a real act cannot raise. */
const CAN = ["contribute", "create_projects"];
const ADDRESS = "https://www.nps.gov/yose/planyourvisit/upload/big.pdf";
const BYTES = 15932155;
/* a member, and a project of hers named Yosemite */
async function team(opts = {}, others = {}) {
  const t = await members({ mai: CAN, ...others }, opts);
  t.project = await t.world.recipes.project(t.mai, "Yosemite");
  return t;
}
const open = (t, path, plane = {}) => openWorld(path, { world: t.world, as: t.mai, plane, screens: [...SCREENS, DOCUMENT_STUB] });
/* what the site at an address answers (the world's network) */
const site = (t, address, make) => t.world.script(address, async () => make());
const page = (t, address, html = "<html><head><title>Sagamore</title></head><body><p>Payment vouchers are due in four instalments.</p></body></html>") =>
  site(t, address, () => new Response(html, { status: 200, headers: { "content-type": "text/html" } }));
/* a file the source says is too long to wait for: acquisition parks it (`fetch_pending`) before one byte is read; once `release()` is called the source serves the file itself (what the
   owed fetch finds when it runs) */
const FILE_BODY = "%PDF-1.4\n1 0 obj << /Title (Yosemite) >> endobj\n";
const bigFile = (t, address = ADDRESS) => {
  const gate = { parked: true, release: () => { gate.parked = false; } };
  site(t, address, () => gate.parked ? new Response("%PDF-", { status: 200, headers: { "content-type": "application/pdf", "content-length": String(BYTES) } })
    : new Response(FILE_BODY, { status: 200, headers: { "content-type": "application/pdf" } }));
  return gate;
};
const fetching = (p) => main(p).querySelectorAll("[data-fetching]").length;
const size = word_n("15.2");
function word_n(n) { return ["size.mb", { n }]; }
const pressCapture = async (p) => { fill(p, { "ci-address": ADDRESS }); await press(p, "acquire"); };

test("R58 (G2) a capture answered fetch_pending is said at once (size, where it is filed), nothing is promoted, and when the session leaves the list the finished line links the document", async () => {
  const t = await team({ deliver: true });
  const gate = bigFile(t);
  const p = await open(t, `/app/capture/address/${t.project}`);
  await pressCapture(p);
  assert.deepEqual(p.byOp("acquire").map((r) => r.body), [{ locator: ADDRESS, project: t.project }], "the project rides so the delivery can file it");
  assert.equal(fetching(p), 1, "the what-and-why line is drawn once");
  assert.ok(says(p, "screen.capture.fetch.pending", { size: word(size[0], size[1]), project: "Yosemite" }), "the DEC-418 row: about 15.2 MB, and where it will be filed");
  assert.equal(p.byOp("allocid").length + p.byOp("promote").length, 0, "no document is promoted from a document-less answer");
  const before = p.byOp("opencaptures").length;
  await p.clock.tick(4000);
  for (let i = 0; i < 6; i++) await p.settle(20);
  assert.ok(p.byOp("opencaptures").length > before, "opencaptures is polled");
  assert.equal(fetching(p), 1, "still listed: still being fetched");
  assert.equal(says(p, "screen.capture.address.done", { title: "x" }), false);
  /* the store's alarm runs the owed fetch: the source now serves the file, the real owedFetch makes the capture, the delivery files it under the project and the session leaves the list */
  gate.release();
  await t.world.tick(60_000);
  assert.equal((await t.mai.read("opencaptures")).captures.length, 0, "the delivery dropped the session");
  const home = (await t.mai.read("heldat", { query: { address: ADDRESS } })).copy.document;
  await p.clock.tick(4000);
  for (let i = 0; i < 8; i++) await p.settle(20);
  assert.equal(fetching(p), 0, "the working line is gone");
  assert.ok(main(p).querySelector(`a[href*="${home}"]`), "the finished line links the document the delivery filed");
  assert.equal(p.byOp("promote").length, 0, "the screen filed nothing: the delivery did");
  const asks = p.byOp("heldat").filter((r) => !r.query.check);
  assert.ok(asks.length >= 1 && asks.every((r) => r.query.address === ADDRESS), "the record is asked for the copy at the address, nothing fetched");
});

test("R58 (G2) a capture whose declared size is not stated draws the line without a size; no subject files it nowhere", async () => {
  const t = await team();
  /* a body of more than the request reads, with no length declared: acquisition parks it, and states no size */
  site(t, ADDRESS, () => new Response(new Uint8Array(9 * 1024 * 1024), { status: 200, headers: { "content-type": "application/pdf" } }));
  const p = await open(t, "/app/capture/address");
  await pressCapture(p);
  assert.deepEqual(p.byOp("acquire").map((r) => r.body), [{ locator: ADDRESS }], "no project, none sent");
  assert.equal(fetching(p), 1);
  assert.equal(/\d+\.\d MB/.test(main(p).textContent), false, "no size is invented (the why row's own \"8 MB\" is not one)");
  assert.equal(says(p, "capture.filed.project", { project: "Yosemite" }), false);
});

test("R58 (G2) a session that left the list with no copy at the address three asks in a row is refusal.FETCH_FAILED beside the act, and claims nothing", async () => {
  const t = await team();
  bigFile(t);
  const p = await open(t, `/app/capture/address/${t.project}`);
  await pressCapture(p);
  assert.equal(fetching(p), 1, "being fetched");
  /* the session leaves the list by the store's own clock (a month's idle), and the record holds no copy, as it really does */
  await lapse(t, p);
  assert.equal((await t.mai.read("opencaptures")).captures.length, 0, "the session left the list");
  for (let i = 0; i < 3; i++) { await p.clock.tick(4000); for (let j = 0; j < 8; j++) await p.settle(20); }
  assert.equal(fetching(p), 0);
  assert.ok(says(p, "refusal.FETCH_FAILED"));
  assert.equal(main(p).querySelectorAll('a[href*="INFO-"]').length, 0, "no document is claimed");
});

test("R58 (G2) a session being fetched is listed under Unfinished without Finish it; an ordinary unfinished capture keeps it", async () => {
  const t = await team();
  /* an unfinished capture with files outstanding is made by the alarm's walk of a page's supporting files, which the world's runtime does not stop short: scripted */
  const both = ok({ ok: true, truncated: false, captures: [
    { session: "rs_fetch", locator: ADDRESS, started: "2026-10-22T10:00:00Z", outstanding: 0, fetch_pending: { since: "2026-10-22T10:00:00Z", declared_bytes: BYTES } },
    { session: "rs_plain", locator: "https://www.nps.gov/acad/index.htm", started: "2026-10-22T09:00:00Z", outstanding: 2 }] });
  const p = await open(t, "/app/capture/address", { opencaptures: both });
  assert.equal(fetching(p), 1, "the one being fetched is said");
  const finishes = Array.from(main(p).querySelectorAll('button[data-act="acquire"]')).filter((b) => b.getAttribute("data-session"));
  assert.deepEqual(finishes.map((b) => b.getAttribute("data-session")), ["rs_plain"], "Finish it only for the ordinary one");
});

test("R58 control: a page answered with its document in the request is promoted and linked as before, with no fetching line and no poll", async () => {
  const t = await team();
  page(t, ADDRESS);
  const p = await open(t, "/app/capture/address");
  await pressCapture(p);
  assert.equal(fetching(p), 0);
  assert.equal(p.byOp("promote").length, 1);
  assert.ok(main(p).querySelector(`a[href*="${p.byOp("promote")[0].body.bundleId}"]`), "and linked");
  const n = p.byOp("opencaptures").length;
  await p.clock.tick(30000);
  for (let i = 0; i < 6; i++) await p.settle(20);
  assert.equal(p.byOp("opencaptures").length, n, "nothing is polled");
});

/* ---- G3: "Finish it" answered at once ----
   Fix round 10 (K5245; K4297 (2)): the cases of a "Finish it" answered with a continuation (files outstanding) or a render pending are removed. An unfinished capture with files
   outstanding and a pending render are made only by the capture of "the page as a visitor saw it", which opens a browser the world has none of (the capture of the page as the site
   sent it keeps no snapshot: measured over 60, 200 and 700 images), so no act makes them. r7-finish.test.mjs holds the press of "Finish it". */

/* ---- G7: the flag over the fact ---- */

const pendingMarks = (p) => main(p).querySelectorAll('[data-reading="pending"]').length;
/* A web page captured by the owner's real act (at an address of its own, so that the pressed address is still one the record does not hold): its answer is the owner's, and a test adds to it only the flag a real act cannot raise (a reading that did not fit the door's bound). */
let distinct = 0;
async function captured(t) {
  const n = ++distinct, address = `https://www.nps.gov/yose/real-${n}.htm`;
  page(t, address, `<html><head><title>Sagamore ${n}</title></head><body><p>Payment vouchers are due in ${n} instalments.</p></body></html>`);
  return t.mai.act("acquire", { body: { locator: address } });
}
/* A file uploaded by the owner's real act (the page's own `captureupload`), its answer as the owner gave it */
async function uploaded(t, name, type = "application/pdf") {
  const bytes = new TextEncoder().encode(`%PDF-1.4 packet ${++distinct}`);
  const a = await t.world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: name, name, type })}`, init: { method: "POST", headers: { "content-type": type }, body: bytes } }, t.mai);
  assert.equal(a.json.ok, true, JSON.stringify(a.json).slice(0, 300));
  return a.json.result;
}
/* the reading the owner holds of a page (its `reading` read), for a test that needs a reading beside an upload's answer */
async function readingOfAPage(t) {
  const held = await t.world.recipes.page(t.mai, "A page read", { paragraphs: ["Payment vouchers are due in four instalments.", "The vote was five to two."] });
  const r = await t.mai.read("reading", { query: { sha256: held.sha } });
  assert.ok(r.reading && Array.isArray(r.text_units) && r.text_units.length, "the owner holds a reading with its text");
  return r;
}
const FILLED = { "ci-how-made": true, "ci-where": "City hall", "ci-what": "The packet." };

test("R57 (G7) an answer that holds a reading of its own draws no 'reading follows', though it says reading_pending; one without does", async () => {
  const t = await team();
  /* each case is a document of its own: the record gives a document one home, and refuses a second promotion of the same bytes */
  const real = await captured(t);
  assert.ok(real.document.reading && real.document.reading.words_total > 0 && !real.reading_pending, "the owner's real answer holds its reading");
  const own = await open(t, "/app/capture/address", { acquire: ok({ ...real, existed: false, reading_pending: true }) });
  await pressCapture(own);
  assert.equal(pendingMarks(own), 0, "the reading is there: no 'check again soon'");
  const other = await captured(t);
  const bare = { ...other, document: { ...other.document, reading: undefined } };
  const none = await open(t, "/app/capture/address", { acquire: ok({ ...bare, existed: false, reading_pending: true }) });
  await pressCapture(none);
  assert.equal(pendingMarks(none), 1, "control: no reading of its own, the mark stays");
  /* a promotion's own flag beside a reading in the answer (the door's reading after `promote`) is no case here: the world's door follows no promotion with a reading (store-request,
     J56 (2) (b)), so no act raises it (K4297 (2)) */
});

test("R57 (G7) an upload answered with its reading draws no 'reading follows' beside it, whatever the flag says", async () => {
  const t = await team();
  const FILE = new File(["x"], "w40.pdf", { type: "application/pdf" });
  const { reading } = await readingOfAPage(t);
  for (const [more, marks] of [[{ reading_pending: true, reading, text_units: [] }, 0], [{ reading_pending: true }, 1]]) {
    const real = await uploaded(t, "w40.pdf");   /* a document of its own each: the record gives one home to the same bytes */
    const p = await open(t, "/app/capture/file", { captureupload: ok({ ...real, existed: false, ...more }) });
    fill(p, { "ci-file": FILE, ...FILLED });
    await press(p, "captureupload");
    assert.equal(pendingMarks(p), marks, JSON.stringify(more));
  }
});

/* ---- G6: the upload's register ---- */

test("R21 (G6; G127a, G127c) a multipart upload is registered as its whole, one row carrying its parts in order and no part as a row; a single-part upload registers its one file", async () => {
  const t = await team();
  const PART = 8 * 1024 * 1024;
  const sha = async (u) => Buffer.from(await crypto.subtle.digest("SHA-256", u)).toString("hex");
  const big = new Uint8Array(2 * PART + 1000).map((_, i) => (i * 31 + (i >> 12)) & 255);
  const FILE = new File([big], "w40.pdf", { type: "application/pdf" });
  const p = await open(t, "/app/capture/file");
  fill(p, { "ci-file": FILE, ...FILLED });
  await press(p, "captureupload");
  const reg = p.byOp("promote")[0].body.register;
  assert.deepEqual(reg.map((r) => r.sha256), [await sha(big)], "the register is the whole alone: a part's digest is no row (K4833)");
  assert.equal(reg[0].bytes, big.length, "with its total size");
  const cut = [big.subarray(0, PART), big.subarray(PART, 2 * PART), big.subarray(2 * PART)];
  assert.deepEqual(reg[0].parts.map((x) => [x.sha256, x.bytes]), await Promise.all(cut.map(async (c) => [await sha(c), c.length])), "the parts, in order, on the whole's row");
  assert.ok(reg[0].parts.every((x) => typeof x.path === "string" && x.path), "each part by its file");
  const small = new Uint8Array(9).map((_, i) => i + 65);
  const single = await open(t, "/app/capture/file");
  fill(single, { "ci-file": new File([small], "w40.pdf", { type: "application/pdf" }), ...FILLED });
  await press(single, "captureupload");
  assert.deepEqual(single.byOp("promote")[0].body.register.map((r) => r.sha256), [await sha(small)]);
});

/* ---- R-SEAM: red by name until capture merges ---- */

test("R58 (G2 seam) capture's own declaration of acquire accepts `project` (capture, the G2 provider; red until it merges)", () => {
  const row = realRows().acquire;
  assert.ok(row && row.fields, "acquire is declared by its owner");
  const accepted = [...row.fields.accepts, ...row.fields.requires].flat();
  assert.ok(accepted.includes("project"), "acquire accepts project");
});

/* ---- B31: a session whose owed fetch ended in a stated refusal ---- */

/* a refusal no later try changes, by the real acts: rosa holds the very bytes the source will serve under a document of her own hidden project, so the bytes mai's owed fetch makes are held
   under a document she cannot see (provenance R2); the store's alarm runs the fetch, the delivery's promotion is refused CAPTURE_HELD_BY_ANOTHER_BUNDLE, which ends the entry stated (acquisition R111) */
async function heldElsewhere() {
  /* the world's clock is set to the page's own, so that the page's "listed for a day from the failure" (N1) reads the entry's `failed_at` against the same day */
  const t = await team({ deliver: true, now: Date.now() }, { rosa: CAN });
  const hers = await t.world.recipes.project(t.rosa, "Hers", { visibility: "hidden" });
  await t.world.recipes.hold(t.rosa, "big.pdf", FILE_BODY, hers, { type: "application/pdf" });
  await t.world.tick(60_000);   /* the reading of her document, owed since it was held, is made first */
  return t;
}

test("R58 (B31) an entry kept with `failed` draws the failure in the refusal's words at once, from the poll and from the list, without waiting for three asks", async () => {
  const t = await heldElsewhere();
  const gate = bigFile(t);
  const p = await open(t, `/app/capture/address/${t.project}`);
  await pressCapture(p);
  assert.equal(fetching(p), 1, "being fetched");
  gate.release();
  await t.world.tick(60_000);   /* the alarm runs mai's owed fetch; the delivery is refused */
  const listed = (await t.mai.read("opencaptures")).captures;
  assert.equal(listed.length, 1);
  assert.equal(listed[0].fetch_pending.failed, "CAPTURE_HELD_BY_ANOTHER_BUNDLE", "the entry states the refusal");
  await p.clock.tick(4000);
  for (let i = 0; i < 8; i++) await p.settle(20);
  assert.equal(fetching(p), 0, "no working line");
  assert.ok(says(p, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"), "the stated reason, in the refusal's words");
  assert.equal(p.byOp("heldat").filter((r) => !r.query.check).length, 0, "the record is not asked: the answer was stated");
  const reloaded = await open(t, "/app/capture/address");
  assert.ok(says(reloaded, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"), "the list says it too");
  assert.equal(Array.from(main(reloaded).querySelectorAll('button[data-act="acquire"]')).filter((b) => b.getAttribute("data-session")).length, 0, "and offers no Finish it");
});

/* ---- G14: completeness; G19: supporting files ---- */

const reads = (p, k) => main(p).querySelectorAll(`[data-reading="${k}"]`).length;

test("R57 (G14) a capture whose reading says it is partial never draws 'full'; stated draws its reason; whole is as before", async () => {
  const t = await team();
  /* a reading that is partial or stated is the owner's account of a document too large to read whole, which a small real upload does not make: the owner's real answer, with the completeness added */
  const held = await readingOfAPage(t);
  const answer = async (more) => ok({ ...(await uploaded(t, "w.pdf")), existed: false, ...more });
  const up = async (p) => { fill(p, { "ci-file": new File(["x"], "w.pdf", { type: "application/pdf" }), ...FILLED }); await press(p, "captureupload"); };
  const partial = await open(t, "/app/capture/file", { captureupload: await answer({ reading: held.reading, text_units: held.text_units, completeness: { state: "partial" } }) });
  await up(partial);
  assert.equal(reads(partial, "partial"), 1);
  assert.equal(says(partial, "screen.document.text.full"), false, "never 'full' while partial");
  const stated = await open(t, "/app/capture/file", { captureupload: await answer({ reading: { ...held.reading, found: false, failure: "final" }, text_units: [], completeness: { state: "stated", why: "TOO_LARGE" } }) });
  await up(stated);
  assert.equal(reads(stated, "stated"), 1);
  assert.ok(says(stated, "refusal.TOO_LARGE"));
  assert.equal(says(stated, "screen.document.text.full") || says(stated, "screen.document.text.none"), false);
  const whole = await open(t, "/app/capture/file", { captureupload: await answer({ reading: held.reading, text_units: held.text_units, completeness: { state: "whole" } }) });
  await up(whole);
  assert.equal(reads(whole, "read"), 1, "control: whole draws the reading as it did");
  /* the owner's reading states its counts, so the whole one is drawn by them (the old fixture's reading had none, and was drawn "full") */
  assert.ok(says(whole, "screen.document.text.read", { read: String(held.reading.words_read), total: String(held.reading.words_total) }));
  assert.equal(says(whole, "screen.document.text.full"), false);
});

test("R2 R59 (G19) a capture that skipped supporting files says how many of how many it kept and why; none skipped says nothing", async () => {
  const t = await team();
  const real = await captured(t);
  const sup = (x) => async () => { const p = await open(t, "/app/capture/address", { acquire: ok({ ...real, existed: false, supporting: x }) }); await pressCapture(p); return p; };
  const p = await sup({ kept: 400, skipped: 50, reasons: [{ reason: "CAP_REACHED", count: 50, limit: 400, detail: "the plane's own words" }] })();
  const line = main(p).querySelector("[data-supporting]");
  assert.ok(line, "the line is drawn");
  assert.ok(line.textContent.includes(word("screen.capture.supporting.kept", { kept: "400", total: "450" })), "N of M");
  assert.ok(line.textContent.includes(word("screen.capture.supporting.cap", { cap: "400" })), "and the reason, by its code's key (G110: the plane's `detail` is never drawn)");
  assert.equal(line.textContent.includes("the plane's own words"), false);
  const none = await sup({ kept: 12, skipped: 0, reasons: [] })();
  assert.equal(main(none).querySelectorAll("[data-supporting]").length, 0, "control: nothing skipped, nothing said");
  const absent = await sup(undefined)();
  assert.equal(main(absent).querySelectorAll("[data-supporting]").length, 0);
});

/* ---- G20: lists that stop say so; the already-held look covers every held document ---- */

/* a knock really received (the public door, as a visitor's), its fingerprint and the rest as the doorbell holds them */
let visitor = 0;
async function knocked(t, content = "A packet of sheets.") {
  const a = await t.world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `203.0.113.${++visitor}` }, body: JSON.stringify({ contentText: content, note: "n" }) } });
  assert.equal(a.json.ok, true, JSON.stringify(a.json).slice(0, 300));
  return a.json.result;
}

test("R7 R60 (G20) the inbox says when the doorbell stopped at its limit; an untruncated list says nothing", async () => {
  const t = await team();
  await knocked(t);
  const real = await t.mai.read("inbox");
  assert.ok(Array.isArray(real.inbox) && real.inbox.length === 1, "the doorbell holds the knock");
  /* the doorbell stops at its limit only past a great many knocks: its own `truncated` and `next` are the one scripted addition */
  const cut = await open(t, "/app/inbox", { inbox: ok({ ...real, truncated: true, next: "c1" }) });
  assert.ok(says(cut, "screen.held.more", { count: String(real.inbox.length) }));
  const whole = await open(t, "/app/inbox");
  assert.equal(says(whole, "screen.held.more", { count: String(real.inbox.length) }), false);
});

test("R29 R60 (G20) the question chooser says when the search stopped at its limit; and the already-held look reads every page by next", async () => {
  const t = await team();
  const first = await t.world.recipes.question(t.mai, t.project, { title: "Q1" });
  await t.world.recipes.question(t.mai, t.project, { title: "Q2" });
  const real = await t.mai.read("search", { query: { q: "type:inquiry", limit: "200" } });
  assert.ok(real.hits.length >= 2, "the record holds the questions");
  const at = `/app/capture/address/${first.id}`;
  /* the search stops at 200 hits: its own `truncated` and `next` are the one scripted addition */
  const q = await open(t, at, { search: ok({ ...real, truncated: true, next: "n1" }) });
  assert.ok(says(q, "screen.held.more", { count: String(real.hits.length) }));
  const whole = await open(t, at);
  assert.equal(says(whole, "screen.held.more", { count: String(real.hits.length) }), false);
  /* the document at an address is found on the second page of held documents: a second page needs more held documents than one page holds (a thousand), so the pages are
     the owner's own row, cut in two */
  page(t, ADDRESS);
  const held = await t.world.recipes.hold(t.mai, "The earlier copy", "Payment vouchers.", t.project);
  const row = (await t.mai.read("heldcaptures", { query: { limit: "200", state: "held_and_vouched", fields: "picker" } })).held.find((h) => h.bundle_id === held.bundle);
  assert.ok(row, "the owner lists the document");
  const pages = (r) => r.query.after === "p2"
    ? ok({ ok: true, held: [{ ...row, source: { ...(row.source || {}), address: ADDRESS } }], truncated: false, next: null })
    : ok({ ok: true, held: [{ ...row, bundle_id: "INFO-2026-0001-first", title: "First", source: { address: "https://other.example/" }, capture: { sha256: "a".repeat(64) } }], truncated: true, next: "p2" });
  const p = await open(t, "/app/capture/address", { heldcaptures: pages });
  fill(p, { "ci-address": "https://one.example/now" });
  page(t, "https://one.example/now");
  await press(p, "acquire");
  fill(p, { "ci-address": ADDRESS });
  await press(p, "monitorset", { reason: "r" });
  assert.equal(p.byOp("monitorset")[0].body.bundleId, held.bundle, "found on the second page");
  const looks = p.byOp("heldcaptures").filter((r) => r.query.state === "held_and_vouched" && r.query.limit === "1000" || r.query.after);
  assert.ok(looks.some((r) => r.query.after === "p2"), "the second page is read by the first's next");
});

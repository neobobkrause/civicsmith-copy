/* screens-intake attempt 3 (BOB ruling, PR 888; screens-intake-rounds' found marks): R79's parted-upload cancel and R73's too-large refusal (DEC-500), entered by
 * pressing the acts over the real served page and the real store (the owner's own begin, parts and abort answer the page). The cue to send in parts and a file past
 * what the surface keeps are the scripted answers r9-parts.test.mjs names (no test file is that size). Words by key (R26). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, main, text, fill, press, idle, says, word, hasWord } from "./page.mjs";
import { PARTED_PART_BYTES } from "../../../src/capture/index.mjs";

const MIB = 1048576;
const SIZE = 2 * PARTED_PART_BYTES + MIB;
const refusal = (status, code, more = {}) => ({ status, json: { ok: false, reason: code, code, ...more } });
const FILLED = (file) => ({ "ci-file": file, "ci-how-made": true, "ci-where": "City hall", "ci-what": "The packet." });
const patterned = (size) => { const b = Buffer.alloc(size, 7); for (let i = 0; i < size; i += 4096) b.writeUInt32LE((i / 4096) >>> 0, i); return b; };
async function scene(plane, { size = SIZE, name = "packet.pdf", type = "application/pdf" } = {}) {
  const t = await members({ mai: ["contribute", "create_projects"] });
  const file = new File([patterned(size)], name, { type });
  const forward = (req) => t.world.door({ url: req.url, init: req.init }, t.mai);
  const p = await openWorld("/app/capture/file", { world: t.world, as: t.mai, plane: typeof plane === "function" ? plane({ forward }) : plane });
  return { ...t, p, file };
}
async function drive(p, until, rounds = 3000) {
  for (let i = 0; i < rounds && !until(); i++) { await p.clock.tick(1); await idle(p); }
  await idle(p);
}
test("R26 the keys these lines read are held by the word table", () => {
  for (const k of ["screen.capture.file.parts.cancelled", "act.captureuploadabort.label.capture", "screen.capture.refusal.toolarge.size", "screen.capture.refusal.toolarge.archive",
                   "screen.capture.refusal.toolarge.nothing_read", "screen.capture.refusal.toolarge.part"]) assert.ok(hasWord(k), k);
});
const cancelBtn = (p) => main(p).querySelector('button[data-act="captureuploadabort"]');

test("R79 a file sent in parts offers Cancel sending; pressing it aborts the upload, sends no more parts, completes and files nothing, and says nothing was kept", async () => {
  /* the second part is held until the test has pressed cancel, so the press lands while the upload is going */
  let release, seen = 0;
  const gate = new Promise((r) => { release = r; });
  const s = await scene(({ forward }) => ({ captureupload: refusal(413, "TOO_LARGE", { in_parts: true, size: SIZE, bound: 100 * MIB }),
    captureuploadpart: async (req) => { if (++seen === 2) await gate; return forward(req); } }));
  fill(s.p, FILLED(s.file));
  await press(s.p, "captureupload");
  await drive(s.p, () => seen >= 2 && !!cancelBtn(s.p), 400);
  assert.ok(cancelBtn(s.p), "Cancel sending is drawn while the parts go");
  const upload = s.p.byOp("captureuploadbegin").length ? s.p.byOp("captureuploadpart")[0].query.upload : "";
  assert.ok(upload, "an upload was begun");
  await press(s.p, "captureuploadabort");
  release();
  await drive(s.p, () => !!main(s.p).querySelector('[data-parted="cancelled"]'), 200);
  const aborts = s.p.byOp("captureuploadabort");
  assert.equal(aborts.length, 1, "one abort");
  assert.equal(aborts[0].body.upload, upload, "of the upload being sent");
  assert.equal(s.p.byOp("captureuploadpart").length, 2, "no part after the cancel");
  assert.equal(s.p.byOp("captureuploadcomplete").length, 0, "nothing completed");
  assert.equal(s.p.byOp("promote").length, 0, "nothing filed");
  assert.ok(says(s.p, "screen.capture.file.parts.cancelled"), "the canceled line, by key");
  assert.equal(cancelBtn(s.p), null, "the act is gone once canceled");
  assert.equal(main(s.p).querySelector('[data-parted="failed"]'), null, "a cancel is not drawn as a failure");
});

test("R79 control: a file sent in one request draws no Cancel sending and no canceled line", async () => {
  const s = await scene({}, { size: 9, name: "note.txt", type: "text/plain" });
  fill(s.p, FILLED(s.file));
  await press(s.p, "captureupload");
  await idle(s.p);
  assert.equal(cancelBtn(s.p), null);
  assert.ok(!says(s.p, "screen.capture.file.parts.cancelled"));
  assert.equal(s.p.byOp("captureuploadabort").length, 0);
});

test("R73 R74 (DEC-500) a file over its limit is refused with its size and the limit, 'Nothing was added or read.', and the member's own part as the way in; never the upload figures row", async () => {
  const s = await scene({ captureupload: refusal(413, "TOO_LARGE", { size: 120 * MIB, bound: 100 * MIB, kind: "pdf" }) }, { size: 9 });
  fill(s.p, FILLED(s.file));
  const r = await press(s.p, "captureupload");
  await idle(s.p);
  const slot = r.slot().textContent;
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.size", { size: word("size.mb", { n: "120.0" }), bound: word("size.mb", { n: "100.0" }) })), "size and limit, in MB");
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.nothing_read")), "nothing was added or read");
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.part")), "R74 (b): the member's own part");
  assert.ok(!slot.includes(word("screen.capture.refusal.toolarge.register")), "R74 (a) is for an address a register lists, never an upload");
  assert.ok(!slot.includes(word("screen.capture.refusal.upload.TOO_LARGE.figures", { size: word("size.mb", { n: "120.0" }), bound: word("size.mb", { n: "100.0" }) })), "not the figures row ('Nothing was written')");
  assert.equal(s.p.byOp("captureuploadbegin").length, 0, "nothing begun");
  assert.equal(s.p.byOp("promote").length, 0, "nothing filed");
});

test("R73 (DEC-500) an archive over its total is refused by the archive's sentence; control: a refusal with no figures keeps the bare sentence, never a hole", async () => {
  const a = await scene({ captureupload: refusal(413, "TOO_LARGE", { size: 300 * MIB, bound: 256 * MIB, kind: "zip" }) }, { size: 9, name: "a.zip", type: "application/zip" });
  fill(a.p, FILLED(a.file));
  const ra = await press(a.p, "captureupload");
  await idle(a.p);
  assert.ok(ra.slot().textContent.includes(word("screen.capture.refusal.toolarge.archive", { size: word("size.mb", { n: "300.0" }), bound: word("size.mb", { n: "256.0" }) })));
  const b = await scene({ captureupload: refusal(413, "TOO_LARGE") }, { size: 9 });
  fill(b.p, FILLED(b.file));
  const rb = await press(b.p, "captureupload");
  await idle(b.p);
  assert.ok(rb.slot().textContent.includes(word("screen.capture.refusal.upload.TOO_LARGE")));
  assert.ok(!rb.slot().textContent.includes(word("screen.capture.refusal.toolarge.nothing_read")));
});

/* R73, R74 on the address tab: a source that declares more than a capture takes (one byte over acquisition's `CAPTURE_MAX`, as capture.test.mjs's R1 makes it) is refused by
   the owner's real `acquire`; the register way is matched against the real `registerlist` (registers' shipped list), never guessed */
const { CAPTURE_MAX } = await import("../../../src/acquisition/index.mjs");
const { DEF } = await import("../registers/fixture.mjs");
const huge = (w, url) => w.script(url, async () => new Response("xx", { status: 200, headers: { "content-type": "application/pdf", "content-length": String(CAPTURE_MAX + 1) } }));
async function addressScene(t, url, path = "/app/capture") {
  huge(t.world, url);
  const p = await openWorld(path, { world: t.world, as: t.mai });
  fill(p, { "ci-address": url });
  const r = await press(p, "acquire");
  await idle(p);
  return { p, r };
}

test("R73 R74 (DEC-500) an address over the limit is refused with its size and the limit, 'Nothing was added or read.' and the member's own part; an address a register lists also offers that register, the project's filter prefilled", async () => {
  const t = await members({ mai: ["contribute", "create_projects"] });
  /* the team's own register, defined by the real act from registers' published definition (its fixture), so `registerlist` lists its address */
  const def = { ...DEF("town_filings"), key: "our_filings", label: "Our filings" };
  assert.equal((await t.mai.act("registerdefine", { body: { definition: def, reason: "The town's filings, for our question." } })).ok, true);
  const list = await t.mai.read("registerlist");
  const reg = (list.own || []).find((e) => e && e.key === "our_filings");
  assert.ok(reg && /^https:\/\//.test(reg.url), "the register lists its address");
  const project = await t.world.recipes.project(t.mai, "Campaign money");
  const { p, r } = await addressScene(t, reg.url + "/", `/app/capture/address/${project}`);
  const slot = r.slot().textContent;
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.size", { size: word("size.mb", { n: ((CAPTURE_MAX + 1) / MIB).toFixed(1) }), bound: word("size.mb", { n: (CAPTURE_MAX / MIB).toFixed(1) }) })), slot);
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.nothing_read")) && slot.includes(word("screen.capture.refusal.toolarge.part")));
  assert.ok(!slot.includes(word("refusal.TOO_LARGE")), "not the bare sentence once the figures are known");
  const way = main(p).querySelector('[data-way="register"] a');
  assert.ok(way, "the register way is offered");
  assert.equal(way.textContent, word("screen.capture.refusal.toolarge.register"));
  assert.equal(way.getAttribute("href"), `/app/registers/${encodeURIComponent(reg.key)}?project=${encodeURIComponent(project)}`);
  assert.equal(p.byOp("registerlist").length, 1, "the list is read once, after the refusal");
  assert.equal(p.byOp("promote").length, 0, "nothing filed");
});

test("R74 control: an address no register lists is offered only the member's own part; no way offers 'the first part' of a file", async () => {
  const t = await members({ mai: ["contribute", "create_projects"] });
  const { p, r } = await addressScene(t, "https://huge.example/a.pdf");
  assert.ok(r.slot().textContent.includes(word("screen.capture.refusal.toolarge.part")));
  assert.equal(main(p).querySelector('[data-way="register"]'), null);
  assert.ok(!/first part/i.test(text(p)));
});

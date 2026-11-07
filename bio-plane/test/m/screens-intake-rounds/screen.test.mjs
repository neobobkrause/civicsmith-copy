/* screens-intake-rounds attempt 2 (BOB ruling (b), 7 Nov 2026): the T53 lines met through the screens screens-intake draws (PR 908), over the real served
 * page and the real store: each press goes through the world's own door and the owners' own code answers it. The figures are the providers' own, read when
 * the test runs (acquisition's `limitsByKind`, `CAPTURE_MAX`); words by key, never a copied sentence (K3810). A screen's drawn state is waited for before it
 * is read (R66: `press` settles, then `idle`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, main, text, fill, press, idle, says, word, hasWord, dayOf, DOCUMENT_STUB, rawKeys } from "../screens-intake/page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { limitsByKind, CAPTURE_MAX } from "../../../src/acquisition/index.mjs";

const MIB = 1048576;
const CAN = ["contribute", "create_projects"];
/* sizes as the screen draws a refusal's figures: MB with one decimal */
const mb = (n) => word("size.mb", { n: (n / MIB).toFixed(1) });
const limit = (kind) => limitsByKind().kinds.find((k) => k.kind === kind);
const FILLED = (file) => ({ "ci-file": file, "ci-how-made": true, "ci-where": "City hall", "ci-what": "The packet." });

async function upload(t, file) {
  const p = await openWorld("/app/capture/file", { world: t.world, as: t.mai });
  fill(p, FILLED(file));
  const r = await press(p, "captureupload");
  await idle(p);
  /* a file over what one request carries is hashed, then begun in parts (capture R113): its refusal comes from the begin */
  for (let i = 0; i < 3000 && main(p).querySelector('[data-parted="hashing"]'); i++) { await p.clock.tick(1); await idle(p); }
  await idle(p);
  return { p, r };
}
const sized = (bytes, name, type) => new File([Buffer.alloc(bytes, 0x61)], name, { type });
const held = async (t) => { const h = await t.mai.read("heldcaptures"); assert.ok(h && Array.isArray(h.held), "the held list is read"); return h.held; };

test("R73 the keys these lines read are rows of the word table", () => {
  for (const k of ["screen.capture.refusal.toolarge.size", "screen.capture.refusal.toolarge.nothing_read", "screen.capture.refusal.toolarge.part",
                   "screen.capture.refusal.toolarge.register", "screen.inbox.row.named", "screen.inbox.row.noted", "screen.inbox.row.unnamed", "screen.inbox.row.became"])
    assert.ok(hasWord(k), k);
});

test("R73 a 60 MB sheet is refused through the real door with its size and the 50 MB limit R72's figure states, 'Nothing was added or read.' and R74's own part", async () => {
  const t = await members({ mai: CAN });
  const sheet = limit("sheet");
  const size = 60 * MIB;
  assert.ok(size > sheet.bytes, "the file is over the sheet's limit");
  const { p, r } = await upload(t, sized(size, "rows.csv", "text/csv"));
  const slot = r.slot().textContent;
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.size", { size: mb(size), bound: mb(sheet.bytes) })), slot);
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.nothing_read")), "nothing was added or read");
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.part")), "R74 (b): the member's own part");
  assert.ok(!slot.includes(word("screen.capture.refusal.toolarge.register")), "an upload is never a register's source");
  assert.ok(!/first part/i.test(text(p)), "reading only the first part is never offered");
  /* control: no part of the file is held, read or searched */
  assert.equal(p.byOp("captureuploadbegin").length, 0, "no parted upload begun");
  assert.equal(p.byOp("promote").length, 0, "nothing filed");
  assert.deepEqual(await held(t), [], "the record holds no capture for it");
});

/* R73's 120 MB PDF is over what one request carries, so the screen hashes it and begins it in parts (capture R113). The real `captureuploadbegin` refuses it
   TOO_LARGE with its size and the document limit, but `sendInParts` draws that refusal through `refusalHtml` as the bare `refusal.TOO_LARGE` (the address's
   sentence: no figures, no "Nothing was added or read.", no way in). A found mark for screens-intake (capture.mjs, `sendInParts`' `ended`), reported to BOB;
   R73 stays open until it lands. What is drawn today is pinned nowhere (K208). */
test.todo("R73 a 120 MB PDF, sent in parts, is refused with its size, the 100 MB document limit, nothing_read and R74 (b)'s part (owed by screens-intake: sendInParts draws the begin's TOO_LARGE bare)");

test("R73 control: a sheet exactly at its limit is not refused as too large", async () => {
  const t = await members({ mai: CAN });
  const { p } = await upload(t, sized(limit("sheet").bytes, "rows.csv", "text/csv"));
  assert.ok(!says(p, "screen.capture.refusal.toolarge.nothing_read"), "no too-large refusal");
  assert.equal(p.byOp("captureupload").length, 1, "the file was sent whole");
  assert.equal(p.byOp("promote").length, 1, "and filed");
  assert.equal((await held(t)).length, 1, "the record holds it");
});

/* an address over what a capture takes, refused by the owner's real `acquire` (one byte over `CAPTURE_MAX`, as screens-intake's capture tests make it) */
test("R73 R74 (b) an address over the limit is refused with its size, the limit and 'Nothing was added or read.'; an address no register lists is offered only the member's own part", async () => {
  const t = await members({ mai: CAN });
  const url = "https://huge.example/minutes.pdf";
  t.world.script(url, async () => new Response("xx", { status: 200, headers: { "content-type": "application/pdf", "content-length": String(CAPTURE_MAX + 1) } }));
  const p = await openWorld("/app/capture", { world: t.world, as: t.mai });
  fill(p, { "ci-address": url });
  const r = await press(p, "acquire");
  await idle(p);
  const slot = r.slot().textContent;
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.size", { size: mb(CAPTURE_MAX + 1), bound: mb(CAPTURE_MAX) })), slot);
  assert.ok(slot.includes(word("screen.capture.refusal.toolarge.nothing_read")) && slot.includes(word("screen.capture.refusal.toolarge.part")));
  assert.equal(main(p).querySelector('[data-way="register"]'), null, "no register way for an address no register lists");
  assert.ok(!/first part/i.test(text(p)));
  assert.equal(p.byOp("promote").length, 0, "nothing filed");
});

/* R92: knocks rung at the doorbell's own door, pulled by the member's own act on the served inbox */
const open = (t, path) => openWorld(path, { world: t.world, as: t.mai, screens: [...SCREENS, DOCUMENT_STUB] });
const sizeOf = (n) => (n >= MIB ? word("size.mb", { n: (n / MIB).toFixed(1) }) : n >= 1024 ? word("size.kb", { n: String(Math.round(n / 1024)) }) : word("size.small"));
const look = async (t, id) => (await t.mai.read("inboxget", { query: { id } })).item;
async function ring(t, { name, bytes, note = null }) {
  await new Promise((r) => setTimeout(r, 5));
  const head = `${name}: `;
  const res = await t.world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentText: head + "z".repeat(Math.max(0, bytes - head.length)), ...(note ? { note } : {}) }) } });
  assert.equal(res.json && res.json.ok, true, "the doorbell took the knock");
  return { id: res.json.knockId, ...(await look(t, res.json.knockId)) };
}

test("R92 three knocks draw three different titles: what was handed in (a note's first words, or that it came with neither), each with its true size", async () => {
  const t = await members({ mai: CAN });
  const A = await ring(t, { name: "A", bytes: 2048, note: "Minutes of the closed session on the bridge contract, as kept by the clerk." });
  const B = await ring(t, { name: "B", bytes: 3 * MIB, note: "Inspection sheets." });
  const C = await ring(t, { name: "C", bytes: 500 });
  const p = await open(t, "/app/inbox");
  const rows = [...main(p).querySelectorAll('[role="listitem"]')].map((x) => x.textContent);
  assert.equal(rows.length, 3);
  const titles = [A, B, C].map((k) => {
    const row = rows.find((x) => x.includes(dayOf(k.received)) && x.includes(sizeOf(k.bytes)));
    assert.ok(row, `a row with knock ${k.knock_id}'s true size and day`);
    return row;
  });
  assert.equal(new Set(titles).size, 3, "three different titles");
  assert.ok(text(p).includes(word("screen.inbox.row.noted", { words: "Minutes of the closed session on", size: sizeOf(A.bytes) })), "the note's first words and the true size");
  assert.ok(text(p).includes(word("screen.inbox.row.noted", { words: "Inspection sheets.", size: sizeOf(B.bytes) })));
  assert.ok(text(p).includes(word("screen.inbox.row.unnamed", { size: sizeOf(C.bytes) })), "a knock with neither a name nor a note says so");
  assert.ok(!text(p).includes(A.knock_id) && !/KNOCK-/.test(text(p)), "never its id");
  assert.deepEqual(rawKeys(p), []);
});

test("R92 a knock moved into the record links the document it made; control: an unmoved knock draws no link", async () => {
  const t = await members({ mai: CAN });
  const K = await ring(t, { name: "K", bytes: 900, note: "Bridge minutes." });
  const p = await open(t, `/app/inbox/${K.id}`);
  assert.equal(main(p).querySelector("[data-became]"), null, "an unmoved knock draws no link");
  await press(p, "inboxpull", { reason: "It bears on our question." });
  await idle(p);
  assert.ok((await look(t, K.id)).capture_sha, "the knock was moved into the record");
  const link = main(p).querySelector("[data-became] a");
  assert.ok(link, "the moved knock links the document it made");
  assert.match(link.getAttribute("href") || "", /^\/app\/document\//);
  assert.ok(main(p).querySelector("[data-became]").textContent.startsWith(word("screen.inbox.row.became", { document: "" }).trim()));
});

test("R92 each of the five state words is drawn beside its own explanation", async () => {
  const t = await members({ mai: CAN });
  const K = await ring(t, { name: "K", bytes: 900, note: "Bridge minutes." });
  const p = await open(t, `/app/inbox/${K.id}`);
  const dl = main(p).querySelector("[data-ladder-means]");
  assert.ok(dl, "the explanations are drawn with the ladder");
  const rungs = ["unknown", "same", "partly", "group", "public"];
  assert.deepEqual(dl.querySelectorAll("dt").map((x) => x.textContent), rungs.map((r) => word(`screen.inbox.ladder.${r}`)));
  assert.deepEqual(dl.querySelectorAll("dd").map((x) => x.textContent), rungs.map((r) => word(`screen.inbox.ladder.${r}.means`)));
});

/* R74 (a): the register way, matched against the real `registerlist` (a register the team defines by the real act from registers' published definition) */
test("R74 (a) an address a register lists as its source is refused with the register way, opening that register with the project's filter; (b) beside it", async () => {
  const { DEF } = await import("../registers/fixture.mjs");
  const t = await members({ mai: CAN });
  const def = { ...DEF("town_filings"), key: "our_filings", label: "Our filings" };
  assert.equal((await t.mai.act("registerdefine", { body: { definition: def, reason: "The town's filings, for our question." } })).ok, true);
  const reg = ((await t.mai.read("registerlist")).own || []).find((e) => e && e.key === "our_filings");
  assert.ok(reg && /^https:\/\//.test(reg.url), "the register lists its address");
  const project = await t.world.recipes.project(t.mai, "Campaign money");
  t.world.script(reg.url, async () => new Response("xx", { status: 200, headers: { "content-type": "text/csv", "content-length": String(CAPTURE_MAX + 1) } }));
  const p = await openWorld(`/app/capture/address/${project}`, { world: t.world, as: t.mai });
  /* matched mechanically: host case and a trailing slash do not matter */
  const u = new URL(reg.url);
  fill(p, { "ci-address": `${u.protocol}//${u.host.toUpperCase()}${u.pathname}/${u.search}` });
  const r = await press(p, "acquire");
  await idle(p);
  const way = main(p).querySelector('[data-way="register"] a');
  assert.ok(way, "the register way is offered");
  assert.equal(way.textContent, word("screen.capture.refusal.toolarge.register"));
  assert.equal(way.getAttribute("href"), `/app/registers/${encodeURIComponent(reg.key)}?project=${encodeURIComponent(project)}`, "the link carries the register and the project");
  assert.ok(r.slot().textContent.includes(word("screen.capture.refusal.toolarge.part")), "(b) beside it");
  assert.equal(p.byOp("promote").length, 0, "nothing filed");
});

/* R79's cancel: a 120 MB archive (over what one request carries, within its kind's limit) begun in parts by the real owner; the second part is held at the
   door until the test has pressed "Cancel sending" (the owner's own answer is forwarded, never scripted) */
test("R79 (its cancel) a file sent in parts draws 'Cancel sending'; pressing it aborts, sends no more parts, files nothing and draws the canceled line", async () => {
  const t = await members({ mai: CAN });
  let release, seen = 0;
  const gate = new Promise((res) => { release = res; });
  const forward = (req) => t.world.door({ url: req.url, init: req.init }, t.mai);
  const p = await openWorld("/app/capture/file", { world: t.world, as: t.mai,
    plane: { captureuploadpart: async (req) => { if (++seen === 2) await gate; return forward(req); } } });
  fill(p, FILLED(sized(120 * MIB, "papers.zip", "application/zip")));
  await press(p, "captureupload");
  const cancel = () => main(p).querySelector('button[data-act="captureuploadabort"]');
  for (let i = 0; i < 4000 && !(seen >= 2 && cancel()); i++) { await p.clock.tick(1); await idle(p); }
  assert.ok(cancel(), "Cancel sending is drawn while the parts go");
  assert.equal(p.byOp("captureuploadbegin").length, 1, "the real owner began it");
  await press(p, "captureuploadabort");
  release();
  for (let i = 0; i < 400 && !main(p).querySelector('[data-parted="cancelled"]'); i++) { await p.clock.tick(1); await idle(p); }
  assert.ok(says(p, "screen.capture.file.parts.cancelled"), "the canceled line, by key");
  assert.equal(p.byOp("captureuploadabort").length, 1);
  assert.equal(p.byOp("captureuploadpart").length, 2, "no part after the cancel");
  assert.equal(p.byOp("captureuploadcomplete").length, 0, "nothing completed");
  assert.equal(p.byOp("promote").length, 0, "nothing filed");
  assert.deepEqual(await held(t), [], "nothing kept");
});

/* screens-intake R45, R49, R50 (T51 fix round; DEC-375 C19; K4194 L3; DEC-384 A1, A2, I-02, I-03, I-04): the capture screen by
 * address on the real served page, over the REAL store (fix round 10, K5054): the member is signed in by the real acts, the address is answered by the
 * world's network (an environment double, scripted), `acquire`, `heldat`, `allocid` and `promote` are the owners' own, and what a test reads of a capture (its
 * digest, the document it was filed as) it reads from those answers. A sentence is asserted by its key (R26), never by its English. A fault (an
 * owner's refusal the real acts cannot make, a held answer) is the only scripted answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, untitled, dayOf, text, main, btn, fill, press, refused, word, says, saysIn, DOCUMENT_STUB } from "./page.mjs";
import { pending } from "../interface-shell/harness.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";

/* no file part: the owner names a fetched file by the name its address states, so a document with no title and no file name is an address without one (R54) */
const ADDRESS = "https://www.example.gov/reports/street-maintenance-2026";
const SAME_BYTES = "https://www.example.gov/reports/street-maintenance-2026-copy";
const CAN = ["contribute", "create_projects"];
const PDF = "%PDF-1.4\n1 0 obj << /Type /Catalog >> endobj\ntrailer << /Root 1 0 R >>\n%%EOF\n";
/* the world's network answers an address with the bytes a site would serve (store-assembly R94) */
const serve = (world, address, body = PDF, type = "application/pdf") => world.script(address, async () => new Response(body, { status: 200, headers: { "content-type": type } }));
const team = async (served = {}) => {
  const t = await members({ mai: CAN });
  serve(t.world, ADDRESS, served.body, served.type);
  return t;
};
const open = (t, path = "/app/capture/address", plane = {}, as = t.mai) => openWorld(path, { world: t.world, as, plane, screens: [...SCREENS, DOCUMENT_STUB] });
const capture = async (p, address = ADDRESS) => { fill(p, { "ci-address": address }); return press(p, "acquire"); };
/* what the page filed: the digest the register holds and the bundle it promoted */
const filed = (p) => { const b = p.byOp("promote")[0].body; return { sha: b.register[0].sha256, bundle: b.bundleId }; };

test("R45 the page as the site sent it is the default and sends no render; the visitor's view sends acquire with render: true", async () => {
  const t = await team();
  const p = await open(t);
  assert.equal(p.doc.getElementById("ci-render-0").checked, true);
  assert.equal(p.doc.getElementById("ci-render-1").checked, false);
  /* the visitor's view first: the world binds no renderer, so it files nothing and the default press is then not pre-empted by a held copy of the address */
  fill(p, { "ci-address": ADDRESS, "ci-render-1": true });
  await press(p, "acquire");
  fill(p, { "ci-render-1": false, "ci-render-0": true });
  await press(p, "acquire");
  assert.deepEqual(p.byOp("acquire").map((r) => r.body), [{ locator: ADDRESS, render: true }, { locator: ADDRESS }]);
  for (const k of ["screen.capture.render.keep.site", "screen.capture.render.keep.visitor", "screen.capture.render.keep.explain1", "screen.capture.render.keep.explain2"]) assert.ok(says(p, k), k);
});

test("R45 control: the web-archive capture is drawn as unavailable with its reason and offers nothing: no choice, no act, nothing sent", async () => {
  const t = await team();
  const p = await open(t);
  for (const k of ["screen.capture.archive.summary", "screen.capture.archive.explain1", "screen.capture.archive.explain2"]) assert.ok(says(p, k), k);
  const radios = main(p).querySelectorAll('input[name="ci-render"]');
  assert.equal(radios.length, 2, "two choices: the site's and the visitor's; none for the archive");
  await capture(p);
  assert.ok(p.byOp("acquire").length >= 1 && p.byOp("acquire").every((r) => !("coArchive" in r.body) && !("via" in r.body)));
});

test("R45 a render refusal is drawn by its own key", async () => {
  /* the world binds no renderer, so the owner's own refusal is the answer to the visitor's view: no scripted answer */
  const t = await team();
  const p = await open(t);
  fill(p, { "ci-address": ADDRESS, "ci-render-1": true });
  const r = await press(p, "acquire");
  assert.ok(saysIn(r.slot(), "refusal.RENDER_NO_RENDERER"));
});

test("R49 existed: true with a visible document links it and files nothing", async () => {
  const t = await team();
  serve(t.world, SAME_BYTES);
  const first = await open(t);
  await capture(first);
  const home = filed(first);
  /* the same bytes at another address: the record holds the digest and the member sees the document that holds it */
  const p = await open(t);
  await capture(p, SAME_BYTES);
  assert.deepEqual(p.byOp("heldat").map((r) => r.query).slice(-1), [{ op: "heldat", sha256: home.sha }]);
  assert.equal(p.byOp("allocid").length, 0);
  assert.equal(p.byOp("promote").length, 0);
  assert.ok(main(p).querySelector(`a[href*="${home.bundle}"]`), "a link to the document that holds the bytes");
  assert.ok(says(p, "screen.capture.address.existed", { title: untitled() }));
});

test("R49 existed: true with no document the viewer sees files a new one and links it", async () => {
  const t = await team();
  /* the bytes are in the store (a real acquire) but no document of hers holds them */
  await t.mai.act("acquire", { body: { locator: ADDRESS } });
  const p = await open(t);
  await capture(p);
  await p.settle();
  assert.equal(p.byOp("promote").length, 1, "promoted for the viewer");
  const id = p.byOp("promote")[0].body.bundleId;
  assert.ok(main(p).querySelector(`a[href*="${id}"]`), "and linked");
  assert.ok(says(p, "screen.capture.address.done", { title: untitled() }));
});

test("R49 control: existed: false promotes as before and looks nothing up by digest", async () => {
  const t = await team();
  const p = await open(t);
  await capture(p);
  await p.settle();
  assert.equal(p.byOp("promote").length, 1);
  assert.ok(p.byOp("heldat").every((r) => r.query.sha256 === undefined));
});

test("R50 (A1) the working key is drawn from the press until the answer, and not after", async () => {
  const t = await team();
  /* a held answer: the gate is the only way to stop the clock on an act the owner answers at once */
  const p = await open(t, "/app/capture/address", { acquire: pending });
  fill(p, { "ci-address": ADDRESS });
  await p.click(btn(p, "acquire"));
  await p.settle(20);
  assert.ok(says(p, "screen.capture.address.working"), "while the answer is out");
  assert.ok(says(p, "screen.capture.address.working.head"));
  const q = await open(t);
  assert.ok(!says(q, "screen.capture.address.working"), "control: nothing before a press");
  await capture(q);
  await q.settle();
  assert.ok(!says(q, "screen.capture.address.working"), "none after the answer");
});

test("R50 (A2) the result is a status line directly under the act row", async () => {
  const t = await team();
  const p = await open(t);
  await capture(p);
  await p.settle();
  const acts = btn(p, "acquire").closest(".mk-acts");
  const next = acts.nextElementSibling;
  assert.equal(next.getAttribute("role"), "status");
  assert.ok(next.textContent.includes(word("screen.capture.address.done", { title: untitled() })));
});

test("R50 (I-03) R54 a document is named by its title; without one by its host and the day, never the file part of its address", async () => {
  const t = await team({ body: "<html><head><title>Housing notice 2026-118</title></head><body><p>The notice.</p></body></html>", type: "text/html" });
  const q = await open(t);
  await capture(q);
  await q.settle();
  assert.ok(says(q, "screen.capture.address.done", { title: "Housing notice 2026-118" }));
  const u = await team();
  const p = await open(u);
  await capture(p);
  await p.settle();
  assert.ok(says(p, "document.untitled.web", { site: "www.example.gov", date: dayOf(Date.now()) }));
  assert.ok(!text(p).includes("street-maintenance-2026"), "no part of the address");
});

test("R50 (I-04) an existing document is said with its existed key and an Open it link to it", async () => {
  const t = await team();
  serve(t.world, SAME_BYTES);
  const first = await open(t);
  await capture(first);
  const home = filed(first);
  const p = await open(t);
  await capture(p, SAME_BYTES);
  const a = main(p).querySelector(`a[href*="${home.bundle}"]`);
  assert.ok(a.textContent.includes(word("screen.capture.address.existed.open")));
});

test("R50 (I-02) ACQUIRE_TIMED_OUT is drawn by its reworded key", async () => {
  /* the owner's timeout is a fault no real act of this world can make (its fetch answers at once) */
  const t = await team();
  const p = await open(t, "/app/capture/address", { acquire: refused("ACQUIRE_TIMED_OUT", "builder detail", 504) });
  fill(p, { "ci-address": ADDRESS });
  const r = await press(p, "acquire");
  assert.ok(saysIn(r.slot(), "refusal.ACQUIRE_TIMED_OUT"));
  assert.ok(!r.slot().textContent.includes("builder detail"));
});

test("R50 control: a file capture is unchanged: its done sentence names the file and no working line is drawn", async () => {
  const t = await team();
  const p = await open(t, "/app/capture/file");
  assert.ok(!says(p, "screen.capture.address.working"));
  assert.ok(!says(p, "screen.capture.render.keep.site"), "the render choice is the address tab's alone");
});

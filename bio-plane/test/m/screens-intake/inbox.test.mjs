/* screens-intake R7: the `inbox` screen on the real served page, its reads and three acts, over the REAL store (fix round 10, K5054): a knock is rung at the
 * doorbell's own door, pulled or set aside by the members' own acts, a source's rung moved by the sources' own disclosures; the ids, sizes and days
 * the assertions need are read from those acts' answers. A fault (a refusal the real acts cannot make from this page) is the only scripted answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld as openOver, members, html, text, main, btn, fill, press, ok, refused, rawKeys, word, hasWord, says, saysIn, dayOf, DOCUMENT_STUB } from "./page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";

/* a document named on the page is a link only where the `document` screen is served: the stand-in serves it */
const open = (path, o = {}) => openOver(path, { ...o, screens: [...SCREENS, DOCUMENT_STUB] });
const rung = (k) => word(`screen.inbox.ladder.${k}`);
const sizeOf = (n) => (n >= 1048576 ? word("size.mb", { n: (n / 1048576).toFixed(1) }) : n >= 1024 ? word("size.kb", { n: String(Math.round(n / 1024)) }) : word("size.small"));

const CAN = ["contribute", "create_projects"];
const MB = 1048576;
const SECRET = "the-doorbell-secret-of-one-knocker";
const WHY = "It bears on our question.";

/* a knock rung at the doorbell's own door (`knock`, no account): `bytes` of text, a note, a knocker's secret that makes its pseudonym. Answers the knock as the inbox holds it. */
async function ring(t, { name, bytes, note = null, secret = null, content = null }) {
  await new Promise((r) => setTimeout(r, 5));   /* knocks are received at distinct instants */
  const head = `${name}: `;
  const body = content ?? head + "z".repeat(Math.max(0, bytes - head.length));
  const res = await t.world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ contentText: body, ...(note ? { note } : {}), ...(secret ? { knockerSecret: secret } : {}) }) } });
  if (!res.json || res.json.ok !== true) throw new Error(`the doorbell refused a knock: ${JSON.stringify(res.json).slice(0, 300)}`);
  return { id: res.json.knockId, text: body, ...(await look(t, res.json.knockId)) };
}
const look = async (t, id) => (await t.mai.read("inboxget", { query: { id } })).item;
const pull = (t, k, as = t.mai) => as.act("inboxpull", { body: { knockId: k.knock_id ?? k.id, reason: WHY } });
const discard = (t, k, reason) => t.mai.act("inboxresolve", { body: { knockId: k.knock_id ?? k.id, status: "discarded", reason } });
/* the knock as it stands after an act (the record's own status, capture and instants) */
const after = async (t, k) => ({ ...k, ...(await look(t, k.id)) });
const members2 = () => members({ mai: CAN, rosa: CAN });
const at = (t, path, plane = {}, as = t.mai) => open(path, { world: t.world, as, plane });
const knockPage = (t, k, plane = {}) => at(t, `/app/inbox/${k.id}`, plane);

/* the inbox of the first tests: K3 pulled and handed in with no secret, K2 set aside as spam (the same knocker as K1), K1 new, 3 MB, with a note */
async function inbox() {
  const t = await members2();
  const K3 = await after(t, await ring(t, { name: "K3", bytes: 2048 })); await pull(t, K3);
  const K2 = await ring(t, { name: "K2", bytes: 500, secret: SECRET }); await discard(t, K2, "Spam.");
  const K1 = await ring(t, { name: "K1", bytes: 3 * MB, secret: SECRET, note: "The inspection sheets they don't publish." });
  return { ...t, K1: await after(t, K1), K2: await after(t, K2), K3: await after(t, K3) };
}
const day = (k) => dayOf(k.received);
const handed = (k) => `${word("screen.inbox.knock", { size: sizeOf(k.bytes) })} ${day(k)}`;

test("R7 reads inbox always and inboxget for the knock the address names", async () => {
  const t = await inbox();
  const p = await at(t, "/app/inbox");
  assert.equal(p.byOp("inbox").length, 1);
  assert.equal(p.byOp("inboxget").length, 0);
  const q = await knockPage(t, t.K1);
  assert.equal(q.byOp("inboxget")[0].query.id, t.K1.knock_id);
  const e = await at(await members2(), "/app/inbox");
  assert.ok(says(e, "screen.inbox.empty"));
});

test("R7 each knock: what was handed in, its note, the same-knocker mark and, opened, the identification ladder", async () => {
  const t = await inbox();
  const p = await knockPage(t, t.K1);
  const s = text(p);
  assert.ok(s.includes(`${word("screen.inbox.knock", { size: "3.0 MB" })} ${day(t.K1)}`));
  assert.ok(s.includes(word("screen.inbox.note", { note: "The inspection sheets they don't publish." })));
  assert.ok(s.includes(word("screen.inbox.same", { count: 1 })));
  assert.ok(s.includes(word("screen.inbox.nonote")));
  assert.ok(s.includes(word("screen.inbox.resolved", { reason: "Spam." })));
  assert.equal(main(p).querySelector('[data-ladder="ident"] [aria-current="step"]').textContent, rung("same"));
  assert.deepEqual(rawKeys(p), []);
  /* control: a knock with no secret stands at Unknown */
  assert.equal(main(await knockPage(t, t.K3)).querySelector('[data-ladder="ident"] [aria-current="step"]').textContent, rung("unknown"));
});

test("R7 a new knock offers inboxpull and inboxresolve; one already pulled offers neither; the list alone draws no act", async () => {
  const t = await inbox();
  const p = await knockPage(t, t.K1);
  assert.ok(btn(p, "inboxpull"));
  assert.ok(btn(p, "inboxresolve"));
  assert.equal(btn(p, "sourcelink"), null, "a knock not in the record has no source yet (R12)");
  assert.ok(says(p, "screen.inbox.link.nosource"));
  const q = await knockPage(t, t.K3);
  assert.equal(btn(q, "inboxpull"), null);
  assert.equal(btn(q, "inboxresolve"), null);
  assert.equal(main(await at(t, "/app/inbox")).querySelector("button[data-act]"), null);
});

test("R7 inboxpull moves the knock into the record", async () => {
  const t = await inbox();
  const p = await knockPage(t, t.K1);
  await press(p, "inboxpull", { reason: "It bears on our question." });
  assert.equal(p.byOp("inboxpull")[0].body.knockId, t.K1.knock_id);
  assert.ok(says(p, "screen.inbox.pulled"));
  assert.equal((await look(t, t.K1.knock_id)).status, "pulled", "the owner moved it into the record");
  /* the knock was pulled in another window before this press: the owner answers that it existed */
  const u = await inbox();
  const q = await knockPage(u, u.K1);
  await pull(u, u.K1);
  await press(q, "inboxpull", { reason: "again" });
  assert.ok(says(q, "screen.inbox.existed"));
});

test("R7 R32 inboxresolve to discarded asks why first (inbox.discard.why) and sends the words as reason; with none, refusal.RESOLVE_NO_REASON is drawn and the knock is left as it was", async () => {
  const t = await inbox();
  const p = await knockPage(t, t.K1);
  assert.ok(says(p, "inbox.discard.why"), "the question is asked, by its key");
  assert.ok(p.doc.getElementById("cx-why"), "in a field of its own, beside the act");
  const r0 = await press(p, "inboxresolve");
  assert.equal(p.byOp("inboxresolve").length, 0, "nothing is sent without the words");
  assert.ok(saysIn(r0.slot(), "refusal.RESOLVE_NO_REASON"), "drawn by its words");
  fill(p, { "cx-why": "   " });
  await press(p, "inboxresolve");
  assert.equal(p.byOp("inboxresolve").length, 0, "blank words are none");
  fill(p, { "cx-why": "Nothing in it bears on our questions." });
  await press(p, "inboxresolve");
  assert.deepEqual(p.byOp("inboxresolve")[0].body, { knockId: t.K1.knock_id, status: "discarded", reason: "Nothing in it bears on our questions." });
  assert.ok(says(p, "screen.inbox.discarded"));
  const done = await look(t, t.K1.knock_id);
  assert.deepEqual([done.status, done.resolve_reason], ["discarded", "Nothing in it bears on our questions."], "the owner set it aside with those words");
  /* the door's own refusal is drawn by the same words, and nothing is shown as discarded (the page sends the words it was given, so the owner's refusal is a fault the real act
     cannot be made to cause from here: the one scripted answer) */
  const u = await inbox();
  const q = await knockPage(u, u.K1, { inboxresolve: refused("RESOLVE_NO_REASON", "the owner's words") });
  fill(q, { "cx-why": "x" });
  const r = await press(q, "inboxresolve");
  assert.ok(saysIn(r.slot(), "refusal.RESOLVE_NO_REASON"));
  assert.ok(!r.slot().textContent.includes("the owner's words"));
  assert.ok(!says(q, "screen.inbox.discarded"));
  assert.equal((await look(u, u.K1.knock_id)).status, "new", "the knock is left as it was");
  /* control: a knock already pulled offers no discard and no question */
  const k = await knockPage(u, u.K3);
  assert.equal(k.doc.getElementById("cx-why"), null);
});

test("R10 each knock named is a reference of the kind knock, opening inbox at it, its card naming what was handed in and when", async () => {
  assert.ok(hasWord("shell.card.knock"), "interface-shell R27 holds the knock's card word");
  const t = await inbox();
  const p = await at(t, "/app/inbox");
  for (const k of [t.K1, t.K2, t.K3]) {
    const a = main(p).querySelector(`a.cs-ref[href="/app/inbox/${k.knock_id}"][data-nav]`);
    assert.ok(a, k.knock_id);
    assert.equal(a.textContent, handed(k), "R32: a knock is named by what was handed in and when, never by its id");
    assert.ok(a.getAttribute("data-tip").startsWith(`<b>${word("shell.card.knock")}</b>`), k.knock_id);
  }
  const tip = main(p).querySelector(`a.cs-ref[href="/app/inbox/${t.K1.knock_id}"]`).getAttribute("data-tip");
  assert.match(tip, /3\.0 MB/);
  assert.ok(tip.includes(day(t.K1)));
  assert.match(tip, /The inspection sheets/);
});

/* R12: the sources as sources R1, R9 answer them; a member's session reads them (op-declarations R56). K5 and K4 are earlier, pulled; K3 (the knock the page opens) is pulled and
   the same knocker's as K4 and K1 (K1 new, the newest); a source's attribute makes its rung "partly known". */
async function sources({ only = false } = {}) {
  const t = await members2();
  const K5 = only ? null : await after(t, await ring(t, { name: "K5", bytes: 100 }));
  if (K5) await pull(t, K5);
  const K4 = only ? null : await after(t, await ring(t, { name: "K4", bytes: 900, note: "Earlier.", secret: SECRET }));
  if (K4) await pull(t, K4);
  const K3 = await after(t, await ring(t, { name: "K3p", bytes: 2048, secret: SECRET }));
  await pull(t, K3);
  const K1 = only ? null : await ring(t, { name: "K1", bytes: 3 * MB, secret: SECRET, note: "The inspection sheets they don't publish." });
  const srcOf = async (k) => (await t.mai.read("sourceof", { query: { capture: (await look(t, k.id)).capture_sha } })).sourceId;
  const out = { ...t, K1: K1 && await after(t, K1), K3: await after(t, K3), K4: K4 && await after(t, K4), K5: K5 && await after(t, K5), srcOf };
  await t.mai.act("sourcedisclose", { body: { source: await srcOf(K3), revealed: { kind: "attribute", attribute: "employer", value: "Public Works" }, how: "third_party",
    knownTo: "group", evidence: "A letter on file.", sight: ["mai"] } });
  return out;
}
const pulled = (t, plane = {}) => knockPage(t, t.K3, plane);

test("R12 a pulled knock's source is read through sourceof by its capture digest, its rung through sourcerung, and the ladder drawn at that rung", async () => {
  const t = await sources();
  const p = await pulled(t);
  const src = await t.srcOf(t.K3);
  assert.equal(p.byOp("sourceof").find((r) => r.query.capture === t.K3.capture_sha).query.capture, t.K3.capture_sha);
  assert.deepEqual(p.byOp("sourcerung").map((r) => r.query.source_id), [src]);
  assert.equal(main(p).querySelector('[data-ladder="ident"] [aria-current="step"]').textContent, rung("partly"));
  /* a knock at each other rung, every one a pulled knock whose source the sources' own acts have moved there */
  const w = await members2();
  const R = {};
  R.unknown = await after(w, await ring(w, { name: "R1", bytes: 300 }));
  R.same_knocker = await after(w, await ring(w, { name: "R2", bytes: 301, secret: SECRET }));
  R.known_to_group = await after(w, await ring(w, { name: "R3", bytes: 302 }));
  R.publicly_known = await after(w, await ring(w, { name: "R4", bytes: 303 }));
  for (const k of Object.values(R)) await pull(w, k);
  const sourceOf = async (k) => (await w.mai.read("sourceof", { query: { capture: (await look(w, k.id)).capture_sha } })).sourceId;
  for (const [named, knownTo] of [["known_to_group", "group"], ["publicly_known", "public"]])
    await w.mai.act("sourcedisclose", { body: { source: await sourceOf(R[named]), revealed: { kind: "name", value: "Pat Doe" }, how: "self", knownTo, evidence: "Said so in person.", sight: ["mai"] } });
  for (const [named, shown] of [["unknown", "unknown"], ["same_knocker", "same"], ["known_to_group", "group"], ["publicly_known", "public"]]) {
    assert.equal((await w.mai.read("sourcerung", { query: { source_id: await sourceOf(R[named]) } })).rung, named, `the owner stands ${named} there`);
    const q = await knockPage(w, R[named]);
    assert.equal(main(q).querySelector('[data-ladder="ident"] [aria-current="step"]').textContent, rung(shown), named);
  }
  /* control: a knock not yet pulled reads no source; the same knocker (its secret) stands at "Same knocker" */
  const n = await knockPage(t, t.K1);
  assert.equal(n.byOp("sourceof").filter((r) => r.query.capture === t.K1.sha256).length, 0);
  assert.equal(n.byOp("sourcerung").length, 0);
  assert.equal(main(n).querySelector('[data-ladder="ident"] [aria-current="step"]').textContent, rung("same"));
});

test("R7 R12 sourcelink names the source read and a source chosen among the earlier knocks' (the same knocker's first), with the evidence: no id typed", async () => {
  const t = await sources();
  const p = await pulled(t);
  const [own, four, five] = [await t.srcOf(t.K3), await t.srcOf(t.K4), await t.srcOf(t.K5)];
  assert.equal(main(p).querySelector('input#cx-source, input#cx-to'), null, "no field to type a source id");
  /* sources are one for each knocker's pseudonym (sources R1): K4, the same knocker's as the knock opened, is its own source, which is left out */
  const opts = p.doc.getElementById("cx-to").querySelectorAll("option");
  assert.deepEqual(opts.map((o) => o.getAttribute("value")), [five], "its own left out, the same knocker's with it");
  assert.equal(four, own, "the same knocker's source is this knock's own");
  assert.equal(opts[0].textContent, `${word("screen.inbox.knock", { size: word("size.small") })} ${day(t.K5)}`);
  /* a source of the same pseudonym that is not this knock's own cannot be made by a real act (one source for each pseudonym); the screen's "the same knocker's first" is kept on
     the one scripted variation: the real `sourceof` answer for K4's capture with a source id that is not the knock's own */
  const elsewhere = `${four}-elsewhere`;
  const realOf = (req) => t.mai.read("sourceof", { query: { capture: req.query.capture } }).then(ok);
  const v = await pulled(t, { sourceof: async (req) => (req.query.capture === t.K4.capture_sha ? ok({ ...(await t.mai.read("sourceof", { query: { capture: req.query.capture } })), sourceId: elsewhere }) : realOf(req)) });
  const vopts = v.doc.getElementById("cx-to").querySelectorAll("option");
  assert.deepEqual(vopts.map((o) => o.getAttribute("value")), [elsewhere, five], "the same knocker's source first");
  assert.equal(vopts[0].textContent, word("screen.inbox.same.date", { date: day(t.K4) }), "R32: the same knocker's, by the day, no id drawn");
  assert.equal(vopts[1].textContent, `${word("screen.inbox.knock", { size: word("size.small") })} ${day(t.K5)}`);
  fill(p, { "cx-to": five, "cx-evidence": "Same handwriting on the cover note." });
  await press(p, "sourcelink");
  assert.deepEqual(p.byOp("sourcelink")[0].body, { source: own, to: five, evidence: "Same handwriting on the cover note." });
  assert.ok(says(p, "screen.inbox.link.done"));
  /* the owner recorded the link: the history of the source holds the claim */
  assert.ok(JSON.stringify((await t.mai.read("sourceof", { query: { capture: t.K3.capture_sha } })).history).includes(five), "the owner recorded the link");
  /* nothing is sent without the evidence */
  const q = await pulled(t);
  fill(q, { "cx-evidence": "" });
  assert.ok(saysIn((await press(q, "sourcelink")).slot(), "screen.inbox.link.missing", { fields: word("screen.inbox.link.evidence") }));
  assert.equal(q.byOp("sourcelink").length, 0);
  /* control: with no other source read, nothing to link to and no act */
  const only = await sources({ only: true });
  const r = await pulled(only);
  assert.equal(btn(r, "sourcelink"), null);
  assert.ok(says(r, "screen.inbox.link.none"));
  /* control: a source sourceof refuses is not offered (the owner refuses a source the viewer may not see; the page cannot make that refusal by a real act, so this one answer is scripted,
     beside the variation above that gives the other source) */
  const s = await pulled(t, { sourceof: async (req) => (req.query.capture === t.K5.capture_sha ? refused("NO_SUCH_SOURCE", "No.")
    : req.query.capture === t.K4.capture_sha ? ok({ ...(await t.mai.read("sourceof", { query: { capture: req.query.capture } })), sourceId: elsewhere }) : realOf(req)) });
  assert.deepEqual(s.doc.getElementById("cx-to").querySelectorAll("option").map((o) => o.getAttribute("value")), [elsewhere]);
});

test("R26 every key the inbox screen reads is a word of the list, and its states draw word(key, vars)", async () => {
  for (const k of SCREENS.find((x) => x.id === "inbox").words) assert.ok(hasWord(k), k);
  const t = await inbox();
  const p = await at(t, "/app/inbox");
  for (const k of ["screen.inbox.sub", "screen.inbox.status.new", "screen.inbox.status.pulled", "screen.inbox.status.discarded"]) assert.ok(says(p, k), k);
});

/* ---- T50 (T50-30): R32 ---- */
const NOTICE = "Housing notice 2026-118";
/* a knock whose bytes a captured document already holds: the document is held (by `as`, in `project`) from the very bytes the knock carries */
async function heldKnock(as = null, project = "") {
  const t = await members2();
  const k = await ring(t, { name: "K1", bytes: 4096, secret: SECRET });
  const held = await t.world.recipes.hold(as ? t[as] : t.mai, NOTICE, k.text, project);
  return { ...t, K1: k, held };
}

test("R32 a knock whose bytes a captured document already holds draws screen.inbox.alreadyheld with that document as the holder, and the screen writes nothing new", async () => {
  const t = await heldKnock();
  assert.equal(t.K1.sha256, t.held.sha, "the document holds the knock's bytes");
  const p = await knockPage(t, t.K1);
  await press(p, "inboxpull");
  assert.ok(says(p, "screen.inbox.alreadyheld", { holder: NOTICE }), text(p));
  const link = main(p).querySelector(`a[href*="${t.held.bundle}"]`);
  assert.ok(link && link.textContent === NOTICE, "the holder is a reference to the document, by its title");
  assert.deepEqual(p.byOp("inboxpull").map((r) => r.body), [{ knockId: t.K1.knock_id }]);
  for (const op of ["allocid", "promote"]) assert.equal(p.byOp(op).length, 0, `${op}: nothing new written`);
  assert.ok(!says(p, "screen.inbox.pulled") && !says(p, "screen.inbox.existed"));
  assert.equal(p.byOp("inboxresolve").length, 0, "no set-aside offered after");
});

test("R32 controls: a holder the viewer may not see is not named; a knock already pulled before draws screen.inbox.existed with no holder; a fresh knock moves as before", async () => {
  /* the document that holds the bytes is rosa's, in a project mai takes no part in: the owner does not name it to mai */
  const h = await members2();
  const hidden = await h.world.recipes.project(h.rosa, "Rosa's matter");
  const k = await ring(h, { name: "K1", bytes: 4096, secret: SECRET });
  const held = await h.world.recipes.hold(h.rosa, NOTICE, k.text, hidden);
  const o = await knockPage(h, k);
  await press(o, "inboxpull");
  assert.ok(says(o, "screen.inbox.alreadyheld.other"));
  assert.equal(main(o).querySelector(`a[href*="INFO-"]`), null);
  assert.ok(!text(o).includes(held.bundle));
  /* pulled before (in another window): the owner answers that the knock existed, and names no holder */
  const t = await inbox();
  const e = await knockPage(t, t.K1);
  await pull(t, t.K1);
  await press(e, "inboxpull");
  assert.ok(says(e, "screen.inbox.existed"));
  assert.ok(!text(e).includes(word("screen.inbox.alreadyheld.other").slice(0, 20)));
  const u = await inbox();
  const f = await knockPage(u, u.K1);
  await press(f, "inboxpull");
  assert.ok(says(f, "screen.inbox.pulled"));
});

test("R32 no source id (SRC-…) or knock id (KNOCK-…) is a heading or a sentence: a delivery's ids appear only on a folded Reference line", async () => {
  const bare = (p) => { let t = text(p); for (const d of main(p).querySelectorAll("details")) t = t.replace(d.textContent, ""); return t; };
  const t = await sources();
  for (const p of [await at(t, "/app/inbox"), await knockPage(t, t.K1), await pulled(t)]) {
    assert.doesNotMatch(bare(p), /KNOCK-|SRC-/, "outside the fold");
    for (const h of main(p).querySelectorAll("h1, h2, h3")) assert.doesNotMatch(h.textContent, /KNOCK-|SRC-/);
  }
  const p = await pulled(t);
  const src = await t.srcOf(t.K3);
  const fold = main(p).querySelector("details[data-reference]");
  assert.ok(fold && !fold.hasAttribute("open"), "folded");
  assert.equal(fold.querySelector("summary").textContent, word("reference.label"));
  assert.ok(fold.textContent.includes(t.K3.knock_id) && fold.textContent.includes(src), "the ids, for support");
  /* the act still names the source it records, in its data and not in words */
  assert.equal(main(p).querySelector('button[data-act="sourcelink"]').getAttribute("data-source"), src);
});

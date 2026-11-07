/* screens-inquiry R137 (T51 fix round 10; DEC-435, DEC-432 (c); K5195; amends R99, R127): one document picker on the Document page, for "Connections you assert" and
 * "This contradicts another document"; since screens-document-beta R70 and R71 (T53) it is interface-shell R138's shared picker (`cs.picker`), read once opened,
 * with two scopes: this document's project, then, by its control, the member's other projects. Every state through the real world (store-request's `storeWorld`, its state made by real acts): the team's documents
 * the member can see are the world's own `heldcaptures` answers, an archive's files the world's own unpack. Every expectation is a word read by key; the
 * picker's rows `screen.document.pick.*` are owed to the words list, so where one is not yet held its stand-in's word is expected (`wordOr`). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { hasWord } from "../../../src/setup-words/index.mjs";
import { boot } from "../interface-shell/harness.mjs";
import { makeZip } from "../../make-zip.mjs";
import { main, fill, press, section, word, storeWorld, SCREENS } from "./fixtures.mjs";

const OWN = { capabilities: ["contribute", "create_projects"] };
const text = (el) => String(el && el.textContent || "");
/** a picker word where the list holds it, else the held row that stands in for it */
/* B68 (K5197): every pick word is drawn by key; until rows.mjs holds it the key itself is what is drawn */
const wordOr = (key, vars) => (hasWord(key) ? word(key, vars) : key);

async function pageOn(world, as, path) {
  const { door, session } = world.boot(as);
  const kept = [];
  const p = await boot({ screens: SCREENS, door: async (req) => { const a = await door(req); kept.push([req.op, a]); return a; }, session, path });
  await p.settle();
  p.answers = (op) => kept.filter(([k]) => k === op).map(([, a]) => (a.json && a.json.result !== undefined ? a.json.result : a.json));
  return p;
}

const picker = (p, kind) => main(p).querySelector(`[data-picker="${kind}"]`);
/** the picker's document radios (not its page controls), each `{value, text, checked}` */
const radios = (p, kind) => picker(p, kind).querySelectorAll("input").filter((i) => i.getAttribute("type") === "radio" && !i.closest("[data-pick-pages]"))
  .map((i) => ({ el: i, value: i.getAttribute("value"), text: text(i.parentNode), checked: !!i.checked }));
/** R71: the picker is read once the member opens it */
const openPick = (p, kind) => p.choose(`#document-pick-open-${kind}-0`);
/** R70: the control that adds the member's other projects */
const widen = (p, kind) => p.choose(`#${kind}-wide-0`);
async function pick(p, kind, value) {
  const r = radios(p, kind).find((x) => x.value === value);
  assert.ok(r, `${value} is offered in the ${kind} picker`);
  r.el.checked = true; p.fire(r.el, "change"); await p.settle();
}
async function turn(p, kind, key, scope = "here") {
  const pages = picker(p, kind).querySelector(`[data-pick-pages="${kind}:${scope}"]`);
  const box = pages.querySelectorAll("label").find((l) => l.textContent.includes(word(key))).querySelector("input");
  box.checked = true; p.fire(box, "change"); await p.settle();
}
async function find(p, kind, value) {
  const el = p.doc.getElementById(kind + "-q");
  el.value = value; p.fire(el, "input");
  await p.clock.tick(600); await p.settle();
}
const pickReads = (p) => p.byOp("heldcaptures").filter((r) => r.query.sort === "project" && r.query.limit === "20");
const legendsOf = (p, kind, scope) => picker(p, kind).querySelectorAll(`[data-scope="${scope}"] legend`).map(text);
const scopeValues = (p, kind, scope) => picker(p, kind).querySelectorAll(`[data-scope="${scope}"] input`).filter((i) => i.getAttribute("type") === "radio").map((i) => i.getAttribute("value"));
const PARAS = ["The rent rises on December 1 for every tenant of the building.", "The notice was posted in the lobby on the first of the month."];

/** ann, two projects of hers, this document (a read web page) in the first, another document in each project and one in none */
async function grouped() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const mine = await world.recipes.project(ann, "Pothole repairs");
  const other = await world.recipes.project(ann, "The Coliseum lease");
  const here = await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project: mine });
  const orders = await world.recipes.hold(ann, "Work orders 2025", "Closed work orders for the year.", mine);
  const lease = await world.recipes.hold(ann, "Lease draft", "The draft lease for the Coliseum.", other);
  const loose = await world.recipes.hold(ann, "Loose note", "A note filed in no project.");
  return { world, ann, mine, other, here, orders: orders.bundle, lease: lease.bundle, loose: loose.bundle, at: "/app/document/" + here.bundle };
}
/** ann's project holding 22 other documents (two reads of 20 by `next`), this one held last */
async function many() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const mine = await world.recipes.project(ann, "Pothole repairs");
  const docs = [];
  for (let i = 0; i < 22; i++) docs.push((await world.recipes.hold(ann, `Report ${String(i + 1).padStart(2, "0")}`, `Report number ${i + 1}.`, mine)).bundle);
  const here = await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project: mine });
  return { world, ann, mine, docs, here, at: "/app/document/" + here.bundle };
}

/** ann's project holding 20 reports and, held after them, one more by another name: 21 other documents, the 21st on the second page */
async function zebra() {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const mine = await world.recipes.project(ann, "Pothole repairs");
  for (let i = 0; i < 20; i++) await world.recipes.hold(ann, `Report ${String(i + 1).padStart(2, "0")}`, `Report number ${i + 1}.`, mine);
  const last = await world.recipes.hold(ann, "Zebra crossing study", "A study of the crossing on Fifth Street.", mine);
  const here = await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project: mine });
  return { world, ann, last: last.bundle, at: "/app/document/" + here.bundle };
}

test("R137 (R70) the picker opens with this document's project's documents under the fold's label; its control adds her other project's and the project-less one, each under its own heading; this document is not offered", async () => {
  const g = await grouped();
  const p = await pageOn(g.world, g.ann, g.at);
  for (const kind of ["connect", "flag"]) {
    await openPick(p, kind);
    assert.deepEqual(scopeValues(p, kind, "here"), [g.orders], `${kind}: this project's own first`);
    assert.deepEqual(legendsOf(p, kind, "here"), [word(kind === "connect" ? "screen.document.connect.other" : "screen.document.contradict.other")], `${kind}: the first scope under the fold's own label`);
    assert.ok(p.doc.getElementById(kind + "-wide-0"), `${kind}: the control beneath`);
    await widen(p, kind);
    assert.deepEqual(legendsOf(p, kind, "others"), ["The Coliseum lease", wordOr("screen.document.pick.noproject")], `${kind}: each under its project, none last`);
    assert.deepEqual(scopeValues(p, kind, "others"), [g.lease, g.loose], `${kind}: this project's not repeated`);
    assert.ok(!radios(p, kind).some((r) => r.value === g.here.bundle), "this document excepted");
  }
  assert.ok(text(main(p)).includes(word("screen.document.connect.other")));
  const reads = pickReads(p);
  assert.equal(reads[0].query.project, g.mine, "this project's documents are read first");
  assert.equal(reads[0].query.state, "held_and_vouched");
  assert.equal(new Set(reads.map((r) => JSON.stringify(r.query))).size, reads.length, "each page is read once, for both folds");
});

test("R137 (R70) an archive is one row naming its files' count, and each of its files is offered beside it naming the archive", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const mine = await world.recipes.project(ann, "Pothole repairs");
  const enc = (s) => new TextEncoder().encode(s);
  const files = [1, 2].map((i) => ({ name: `m${i}.txt`, data: enc(`member number ${i} has some words in it, enough to be read as text`) }));
  const m1 = await world.recipes.hold(ann, "m1.txt", files[0].data, mine);
  const m2 = await world.recipes.hold(ann, "m2.txt", files[1].data, mine);
  const zip = await world.recipes.hold(ann, "minutes.zip", makeZip(files), mine, { type: "application/zip" });
  await ann.act("unpack", { body: { archiveSha: zip.sha } });
  const here = await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project: mine });
  const p = await pageOn(world, ann, "/app/document/" + here.bundle);
  await openPick(p, "connect");
  const all = radios(p, "connect");
  const row = all.find((r) => r.value === zip.bundle);
  assert.ok(row && row.text.includes("minutes.zip") && row.text.includes(wordOr("screen.document.pick.archive", { n: "2" })), "the archive's one row: " + (row && row.text));
  const inner = all.slice(all.indexOf(row) + 1).filter((r) => [m1.bundle, m2.bundle].includes(r.value));
  assert.deepEqual(inner.map((x) => x.value), [m1.bundle, m2.bundle], "each file beside it, in the archive's order");
  for (const [x, name] of [[inner[0], "m1.txt"], [inner[1], "m2.txt"]]) {
    assert.ok(x.text.includes(name), name);
    assert.ok(x.text.includes(word("screen.document.pick.member", { archive: "minutes.zip" })), "naming the archive: " + x.text);
  }
  assert.equal(all.filter((r) => r.value === m1.bundle).length, 1, "a file is listed once, beside its archive");
  /* control: a file chosen beside its archive is what is sent */
  await pick(p, "connect", m2.bundle);
  fill(p, { "document-assert-basis": "The minutes record the vote." });
  await press(p, "connectionassert");
  assert.deepEqual(p.byOp("connectionassert")[0].body, { a: here.bundle, b: m2.bundle, basis: "The minutes record the vote." });
});

test("R137 (R70) 'Find a document' narrows the list to the documents whose name holds the text, whatever the case; none matching says so with the text, and the control is still offered", async () => {
  const g = await grouped();
  const p = await pageOn(g.world, g.ann, g.at);
  await openPick(p, "connect");
  await openPick(p, "flag");
  assert.equal(text(picker(p, "connect").querySelector('label[for="connect-q"]')), word("screen.document.pick.find"), "the find box, by its key");
  await find(p, "connect", "ORDERS");
  assert.deepEqual(radios(p, "connect").map((r) => r.value), [g.orders], "only the name that holds it");
  await find(p, "connect", "LEASE");
  assert.equal(radios(p, "connect").length, 0);
  const none = picker(p, "connect").querySelector("[data-none]");
  assert.ok(none && text(none).includes(word("screen.document.pick.none", { text: "LEASE" })), "none found, said");
  assert.ok(p.doc.getElementById("connect-wide-0"), "the control still offered");
  await widen(p, "connect");
  assert.deepEqual(radios(p, "connect").map((r) => r.value), [g.lease], "typing narrows the second scope too");
  assert.deepEqual(radios(p, "flag").map((r) => r.value), [g.orders], "control: the other fold's picker is its own");
  await find(p, "connect", "");
  assert.equal(radios(p, "connect").length, 3, "cleared, every document again");
  assert.equal(picker(p, "connect").querySelector("[data-none]"), null);
});

test("R137 (R70) 20 a page by the read's next: the first 20, the line the read allows (its total, else how many are shown), Next; the next page by the read's cursor, with Previous", async () => {
  const m = await many();
  const p = await pageOn(m.world, m.ann, m.at);
  await openPick(p, "connect");
  const first = radios(p, "connect").map((r) => r.value);
  assert.deepEqual(first, m.docs.slice(0, 20), "the first 20");
  const answer = p.answers("heldcaptures").find((a) => a && Array.isArray(a.held) && a.held.length === 20);
  assert.ok(answer && typeof answer.next === "string", "the read pages by next");
  const pages = picker(p, "connect").querySelector('[data-pick-pages="connect:here"]');
  const line = Number.isInteger(answer.total) ? word("screen.list.showing", { shown: "20", total: String(answer.total) }) : wordOr("screen.document.pick.more", { count: "20" });
  assert.ok(text(pages).includes(line), "the line: " + text(pages));
  assert.ok(text(pages).includes(word("document.read.next")) && !text(pages).includes(word("document.read.prev")), "Next, and no Previous on the first page");
  await turn(p, "connect", "document.read.next");
  assert.deepEqual(radios(p, "connect").map((r) => r.value), m.docs.slice(20), "the rest, on the second page");
  assert.ok(pickReads(p).some((r) => r.query.after === answer.next), "read after the first read's cursor");
  const second = picker(p, "connect").querySelector('[data-pick-pages="connect:here"]');
  assert.ok(text(second).includes(word("document.read.prev")) && !text(second).includes(word("document.read.next")), "Previous past the first page, and no Next at the end");
  await turn(p, "connect", "document.read.prev");
  assert.deepEqual(radios(p, "connect").map((r) => r.value), first, "back to the first page");
});

test("R137 (R70) while a page is unread and nothing read so far matches the text, the picker says more follow and never 'none found'; the page turned, the match is offered; with every page read, none matching says so", async () => {
  const z = await zebra();
  const p = await pageOn(z.world, z.ann, z.at);
  await openPick(p, "connect");
  await find(p, "connect", "zebra");
  assert.deepEqual(radios(p, "connect").map((r) => r.value), [], "nothing on the pages read so far matches");
  assert.ok(!picker(p, "connect").querySelector("[data-none]"), "not 'none found' while a page is unread");
  const more = picker(p, "connect").querySelector("[data-pick-more]");
  assert.ok(more && text(more).includes(wordOr("screen.document.pick.more", { count: "20" })), "that more follow: " + (more && text(more)));
  await turn(p, "connect", "document.read.next");
  assert.deepEqual(radios(p, "connect").map((r) => r.value), [z.last], "the second page holds the match");
  assert.ok(!picker(p, "connect").querySelector("[data-none]"));
  assert.ok(!picker(p, "connect").querySelector("[data-pick-more]"), "nothing unread, nothing more to say");
  await find(p, "connect", "qqq");
  assert.ok(picker(p, "connect").querySelector("[data-none]"), "control: every page read and none matching, none found is said");
  assert.ok(!picker(p, "connect").querySelector("[data-pick-more]"));
});

test("R137 (R70) one radio choice: a choice made on another page replaces the first, and is the one sent", async () => {
  const m = await many();
  const p = await pageOn(m.world, m.ann, m.at);
  await openPick(p, "connect");
  await pick(p, "connect", m.docs[3]);
  assert.deepEqual(radios(p, "connect").filter((r) => r.checked).map((r) => r.value), [m.docs[3]], "one choice");
  await turn(p, "connect", "document.read.next");
  await pick(p, "connect", m.docs[21]);
  await turn(p, "connect", "document.read.prev");
  assert.deepEqual(radios(p, "connect").filter((r) => r.checked).map((r) => r.value), [], "the first page's choice was replaced");
  fill(p, { "document-assert-basis": "Both count closed work orders." });
  await press(p, "connectionassert");
  assert.deepEqual(p.byOp("connectionassert")[0].body, { a: m.here.bundle, b: m.docs[21], basis: "Both count closed work orders." }, "the last choice is sent");
});

test("R137 (R70) in the contradict fold, once a document is chosen, its passages are offered to choose from; the flag sends the passage chosen", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const mine = await world.recipes.project(ann, "Pothole repairs");
  const here = await world.recipes.page(ann, "Policy memo", { paragraphs: ["The rent rises on November 1 for every tenant.", "Repairs are recorded as closed."], project: mine });
  const other = await world.recipes.page(ann, "Rent notice, October 2026", { paragraphs: PARAS, project: mine });
  const units = (await ann.read("reading", { query: { sha256: other.sha } })).text_units.filter((u) => String(u.text || "").trim());
  const mineUnits = (await ann.read("reading", { query: { sha256: here.sha } })).text_units.filter((u) => String(u.text || "").trim());
  const p = await pageOn(world, ann, "/app/document/" + here.bundle);
  const fold = main(p).querySelector('[data-fold="contradict"]');
  assert.ok(fold && fold.querySelector('[data-picker="flag"]'), "the fold chooses the other document through the picker");
  assert.equal(p.doc.getElementById("document-flag-there"), null, "no passage choice before a document is chosen");
  await openPick(p, "flag");
  await pick(p, "flag", other.bundle);
  const there = p.doc.getElementById("document-flag-there");
  assert.ok(there, "its passages, once chosen");
  assert.equal(text(p.doc.querySelector('label[for="document-flag-there"]')), wordOr("screen.document.pick.passage"));
  const offered = there.querySelectorAll("option").map((o) => o.textContent).filter(Boolean);
  assert.equal(offered.length, units.length, "each of its passages");
  assert.ok(offered.some((t) => t.includes(PARAS[0].slice(0, 40))), "its own passages: " + JSON.stringify(offered));
  fill(p, { "document-flag-here": "0", "document-flag-there": "1", "document-flag-why": "One says November, the other December." });
  await press(p, "contradictionflag");
  assert.deepEqual(p.byOp("contradictionflag")[0].body, { here: { capture: here.sha, extent: mineUnits[0].extent }, other: { capture: other.sha, extent: units[1].extent }, reason: "One says November, the other December." });
  assert.equal(p.answers("contradictionflag")[0].ok === false, false, "the world answered it");
});

test("R137 (R70, R71) control: with no other document to offer, each fold is withdrawn once its picker has read so", async () => {
  const world = await storeWorld();
  const ann = await world.signIn("ann", OWN);
  const mine = await world.recipes.project(ann, "Pothole repairs");
  const here = await world.recipes.page(ann, "Policy memo", { paragraphs: ["The Director shall repair each reported pothole within seven days."], project: mine });
  const p = await pageOn(world, ann, "/app/document/" + here.bundle);
  assert.equal(pickReads(p).length, 0, "nothing is read for the picker before it is opened");
  await openPick(p, "connect");
  assert.ok(pickReads(p).length >= 1, "the team's documents were read");
  assert.ok(!section(p, "screen.document.connect.heading"), "no Connections you assert");
  await openPick(p, "flag");
  assert.ok(!main(p).querySelector('[data-fold="contradict"]'), "no contradiction fold");
  assert.ok(!main(p).querySelector("[data-picker]"));
});

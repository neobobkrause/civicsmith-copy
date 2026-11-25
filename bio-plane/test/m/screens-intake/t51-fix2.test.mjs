/* screens-intake R49, R50, R53–R56, R7 (T51 fix round 2: C9, C10, C11, C14, C23, C25, C29, C45, C78, C90, C91; DEC-394 3b, 3c): the
 * capture, held, inbox and watching screens on the real served page. A sentence is asserted by its key (R26), never by its English. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { openWorld, members, text, main, btn, fill, press, ok, refused, word, says, saysIn, untitled, DOCUMENT_STUB } from "./page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";

/* Fix round 10 (K5054): every screen here is opened over the REAL store. The members are signed in by the real acts, a project, a question and a held document are made
 * by the owners' acts (the recipes), an address is answered by the world's network (`world.script`, an environment double), and what a test reads of an owner's answer it
 * reads from that answer. What stays scripted is a fault, or a state the world cannot make, said where it stays. */
const CAN = ["contribute", "create_projects"];
const ADDRESS = "https://www.example.gov/reports/street-maintenance-2026.pdf";
/* a member and a project of hers */
async function team(spec = {}, opts = {}) {
  const t = await members({ mai: CAN, ...spec }, opts);
  t.project = await t.world.recipes.project(t.mai, "Pothole repairs");
  return t;
}
const open = (t, path, plane = {}, as = t.mai) => openWorld(path, { world: t.world, as, plane, screens: [...SCREENS, DOCUMENT_STUB] });
/* what the site at an address answers (the world's network) */
const site = (t, address, body, type = "text/plain") => t.world.script(address, async () => new Response(body, { status: 200, headers: { "content-type": type } }));
let distinct = 0;
/* a page the owner really captured, at an address of its own (a document has one home: each case brings bytes of its own) */
async function captured(t, { title = null, address = null } = {}) {
  const n = ++distinct, where = address || `https://www.example.gov/real-${n}.htm`;
  site(t, where, `<html><head>${title === null ? `<title>Report ${n}</title>` : title ? `<title>${title}</title>` : ""}</head><body><p>Street maintenance spending rose in ${n}.</p></body></html>`, "text/html");
  return t.mai.act("acquire", { body: { locator: where } });
}
const anchors = (p, id) => Array.from(main(p).querySelectorAll("a")).filter((a) => String(a.getAttribute("href")).includes(id));
const hasKey = (k) => hasWord(k);
const TEXT = "Street maintenance spending rose in 2026 by one tenth.\n";

/* ---------- C9, C10: R49 ---------- */

test("R49 (C9) a capture from a question sends the question as `for`; a document the viewer sees that holds the bytes is linked and none is written", async () => {
  const t = await team();
  const q = await t.world.recipes.question(t.mai, t.project, { title: "Seven days" });
  const held = await t.world.recipes.hold(t.mai, "The street report", TEXT, t.project);
  site(t, ADDRESS, TEXT);
  const p = await open(t, `/app/capture/address/${q.id}`);
  fill(p, { "ci-address": ADDRESS });
  await press(p, "acquire");
  assert.deepEqual(p.byOp("acquire").map((r) => r.body), [{ locator: ADDRESS, for: q.id, project: t.project }], "the plane records the capture as made for this question when `for` rides on acquire (acquisition R47)");
  assert.equal(p.byOp("capturerequest").length, 0);
  assert.equal(p.byOp("allocid").length + p.byOp("promote").length, 0, "no document is written");
  assert.equal(anchors(p, held.bundle).length >= 1, true, "the holder is linked");
  assert.ok(saysIn(main(p), "screen.capture.address.existed.open"));
});

test("R49 (C9) control: with no question chosen acquire carries no `for`", async () => {
  const t = await team();
  await t.world.recipes.hold(t.mai, "The street report", TEXT, t.project);
  site(t, ADDRESS, TEXT);
  const p = await open(t, "/app/capture/address");
  fill(p, { "ci-address": ADDRESS });
  await press(p, "acquire");
  assert.deepEqual(p.byOp("acquire").map((r) => r.body), [{ locator: ADDRESS }]);
});

test("R49 (C9) when the bytes have another home the sentence names the holder and links it where the plane names it, and says so without a name or link where it does not", async () => {
  const t = await team({ rosa: CAN });
  /* the bytes are held by rosa's document in a project mai is not in: the owner refuses the promotion and names no holder to a caller who may not see it (provenance R2, D-15) */
  const hers = await t.world.recipes.project(t.rosa, "Rosa's minutes");
  const elsewhere = await t.world.recipes.hold(t.rosa, "The earlier minutes", TEXT, hers);
  site(t, ADDRESS, TEXT);
  const unnamed = await open(t, "/app/capture/address");
  fill(unnamed, { "ci-address": ADDRESS });
  await press(unnamed, "acquire");
  assert.ok(says(unnamed, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"));
  assert.equal(anchors(unnamed, "INFO-").length, 0, "no name and no link where the plane names none");
  /* a holder the owner names is a holder the viewer may see, whose bytes the record's look by digest did not show her: the owner's refusal naming it is the one scripted answer */
  const mine = await t.world.recipes.hold(t.mai, "The earlier minutes", "Minutes of the council, 4 March.\n", t.project);
  const named = await open(t, "/app/capture/address", { promote: refused("CAPTURE_HELD_BY_ANOTHER_BUNDLE", null, 409, { holder: mine.bundle }) });
  fill(named, { "ci-address": ADDRESS });
  await press(named, "acquire");
  assert.ok(says(named, "refusal.CAPTURE_HELD_BY_ANOTHER_BUNDLE"), "the sentence of the key");
  const link = anchors(named, mine.bundle);
  assert.equal(link.length, 1, "a link to the holder");
  assert.ok(link[0].textContent.includes("The earlier minutes"), "named by its title");
  assert.ok(elsewhere.bundle);
});

const FILE = new File(["photo bytes"], "Seminary Ave.jpg", { type: "image/jpeg" });
const filled = { "ci-file": FILE, "ci-how-made": true, "ci-where": "6012 Seminary Ave", "ci-what": "The pothole." };
/* a file really uploaded (the owner's act, as the page's own is), not filed in a document */
async function uploaded(t, bytes = "photo bytes", name = "Seminary Ave.jpg", type = "image/jpeg") {
  const a = await t.world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: name, name, type })}`, init: { method: "POST", headers: { "content-type": type }, body: new TextEncoder().encode(bytes) } }, t.mai);
  assert.equal(a.json.ok, true, JSON.stringify(a.json).slice(0, 300));
  return a.json.result;
}

test("R49 (C10) an upload whose bytes the store holds links the document the viewer sees and writes none", async () => {
  const t = await team();
  const held = await t.world.recipes.hold(t.mai, "The pothole photo", "photo bytes", t.project, { type: "image/jpeg" });
  const p = await open(t, "/app/capture/file");
  fill(p, filled);
  await press(p, "captureupload");
  assert.deepEqual(p.byOp("heldat").map((r) => r.query), [{ op: "heldat", sha256: held.sha }]);
  assert.equal(p.byOp("allocid").length + p.byOp("promote").length, 0);
  assert.equal(anchors(p, held.bundle).length >= 1, true, "linked");
  assert.ok(says(p, "screen.capture.file.existed", { name: "Seminary Ave.jpg" }));
});

test("R49 (C10) an upload whose bytes the store holds, no document the viewer sees, and an answer that carries the document files one for the viewer and links it", async () => {
  const t = await team();
  /* the bytes are in the store (uploaded) and in no document: the owner answers existed, with the document */
  const before = await uploaded(t);
  assert.ok(before.document, "the owner's answer carries the document");
  const p = await open(t, "/app/capture/file");
  fill(p, filled);
  await press(p, "captureupload");
  await p.settle();
  assert.equal(p.byOp("promote").length, 1, "promoted under the project");
  assert.equal(anchors(p, p.byOp("promote")[0].body.bundleId).length >= 1, true, "and linked");
});

test("R49 (C10) control: an upload that is new promotes as before and asks nothing by digest; held bytes with neither a holder nor a document write nothing", async () => {
  const t = await team();
  const fresh = await open(t, "/app/capture/file");
  fill(fresh, filled);
  await press(fresh, "captureupload");
  await fresh.settle();
  assert.equal(fresh.byOp("promote").length, 1);
  assert.equal(fresh.byOp("heldat").length, 0);
  /* bytes held with neither a document the viewer sees nor one in the owner's answer: the owner's answer for held bytes carries its document, so this one answer is the owner's, less it */
  const known = await uploaded(t, "other bytes", "Other.jpg");
  const { document, ...bare } = known;
  const barely = await open(t, "/app/capture/file", { captureupload: ok({ ...bare, existed: true }) });
  fill(barely, { ...filled, "ci-file": new File(["other bytes"], "Other.jpg", { type: "image/jpeg" }) });
  await press(barely, "captureupload");
  assert.equal(barely.byOp("promote").length, 0);
});

/* ---------- C11: R50 ---------- */

test("R50 (C11) a refused acquire clears the working note at once, and its refusal stays drawn after the page redraws", async () => {
  const t = await team();
  /* the source cannot be reached: the world's network fails as an unreachable one does, and acquisition refuses FETCH_FAILED */
  t.world.script(ADDRESS, async () => { throw new TypeError("fetch failed"); });
  const p = await open(t, "/app/capture/address");
  fill(p, { "ci-address": ADDRESS });
  const r = await press(p, "acquire");
  assert.ok(!says(p, "screen.capture.address.working"), "the working note is gone");
  assert.ok(saysIn(r.slot(), "refusal.FETCH_FAILED"));
  await press(p, "capturerequest");
  assert.ok(saysIn(r.slot(), "refusal.FETCH_FAILED"), "still drawn after another act redrew the page");
});

/* ---------- C14: R77, R88 (the reads) ---------- */

test("R50 (C14) the capture screen reads the held and vouched documents once, as pickers, and an act does not read the list again", async () => {
  const t = await team();
  await t.world.recipes.hold(t.mai, "Housing notice", "The housing notice.\n", t.project);
  site(t, ADDRESS, TEXT);
  const p = await open(t, "/app/capture/address");
  assert.deepEqual(p.byOp("heldcaptures").map((r) => r.query), [{ op: "heldcaptures", limit: "200", state: "held_and_vouched", fields: "picker" }]);
  fill(p, { "ci-address": ADDRESS });
  await press(p, "acquire");
  assert.equal(p.byOp("heldcaptures").length, 1, "an act reads the list no more");
});

test("R4 (C14) the Held screen reads each of its two lists once, and an act reads only the list it changed", async () => {
  const t = await team();
  await t.world.recipes.hold(t.mai, "Housing notice", "The housing notice.\n", t.project);
  const p = await open(t, "/app/held");
  /* the lists are the reads without `bundle_ids`; a read by `bundle_ids` is the page asking after the rows it drew */
  const lists = () => p.byOp("heldcaptures").filter((r) => r.query.bundle_ids === undefined);
  const listed = () => lists().map((r) => r.query.state || "held");
  assert.deepEqual(listed().sort(), ["held", "set_aside"]);
  const before = lists().length;
  await p.click(btn(p, "heldcaptures"));
  assert.ok(lists().length - before <= 2, "the refresh asks the one list it shows (the act and the read it draws)");
  assert.equal(p.byOp("heldcaptures").filter((r) => r.query.state === "set_aside").length, 1, "the set-aside list is not read again");
});

/* ---------- C23: Held ---------- */

test("R4 (C23) the project filter: Held opened for a project reads that project's captures, each row says its state by the one word, and a project name opens the filter", async () => {
  const t = await team();
  await t.world.recipes.hold(t.mai, "Housing notice", "The housing notice.\n", t.project);
  const all = await open(t, "/app/held");
  assert.ok(says(all, "state.item.review.name"), "a held row is in the state the Find chip names");
  assert.ok(all.byOp("heldcaptures").every((r) => r.query.project === undefined), "unfiltered by default");
  const door = anchors(all, `/app/held/${t.project}`);
  assert.equal(door.length >= 1, true, "the project name opens the filter");
  const one = await open(t, `/app/held/${t.project}`);
  assert.ok(one.byOp("heldcaptures").length >= 1 && one.byOp("heldcaptures").every((r) => r.query.project === t.project), "the filter reads the project's captures");
  assert.equal(Array.from(main(one).querySelectorAll("a")).filter((a) => a.getAttribute("href") === "/app/held").length >= 1, true, "and a way back to all");
});

/* ---------- C25: R54 ---------- */

/* a page or a file at an address of its own, pressed on the capture screen; what the source sends is the world's network */
let named = 0;
async function pressed(t, { body, type = "text/html", headers = {}, host = "www.example.gov", path = "reports/street-maintenance-2026" } = {}) {
  const address = `https://${host}/${path}-${++named}${type === "application/pdf" ? ".pdf" : ".htm"}`;
  t.world.script(address, async () => new Response(body(named), { status: 200, headers: { "content-type": type, ...headers } }));
  const p = await open(t, "/app/capture/address");
  fill(p, { "ci-address": address });
  await press(p, "acquire");
  await p.settle();
  return p;
}
const html = (title, n) => `<html><head>${title ? `<title>${title}</title>` : ""}</head><body><p>Street spending rose in ${n}.</p></body></html>`;

test("R54 (C25) a document is named by its title, else its file name, else its host and the day it was captured: a PDF and a web page by one rule", async () => {
  const t = await team();
  const titled = await pressed(t, { body: (n) => html("Housing notice 2026-118", n) });
  assert.ok(says(titled, "screen.capture.address.done", { title: "Housing notice 2026-118" }), "its own title");
  const filedAs = await pressed(t, { type: "application/pdf", headers: { "content-disposition": 'attachment; filename="annual-report.pdf"' }, body: (n) => `%PDF-1.4\n% ${n}\n` });
  assert.ok(says(filedAs, "screen.capture.address.done", { title: "annual-report.pdf" }), "its file name");
  for (const type of ["application/pdf", "text/html"]) {
    const none = await pressed(t, { type, body: (n) => (type === "text/html" ? html("", n) : `%PDF-1.4\n% ${n}\n`) });
    assert.ok(says(none, "screen.capture.address.done", { title: untitled() }), `${type}: host and day`);
    assert.ok(!text(none).includes("street-maintenance-2026"), "never the file part of the address");
  }
});

test("R54 (C25) control: two documents from one host with different titles are told apart by their names", async () => {
  const t = await team();
  const a = await pressed(t, { body: (n) => html("Minutes, 4 March", n) });
  const b = await pressed(t, { body: (n) => html("Minutes, 1 April", n) });
  assert.ok(says(a, "screen.capture.address.done", { title: "Minutes, 4 March" }) && says(b, "screen.capture.address.done", { title: "Minutes, 1 April" }));
});

/* ---------- C29, C45 ---------- */

test("R3 (C29) the testimony's result links the document it made, and draws no raw number", async () => {
  const t = await team();
  const words = "I saw the pothole at 6012 Seminary Ave still open.";
  const fillSaw = { "ci-words": words, "ci-where": "6012 Seminary Ave", "ci-when": "2026-10-01T09:00:00Z" };
  const p = await open(t, "/app/capture/saw");
  fill(p, fillSaw);
  await press(p, "testify");
  const links = Array.from(main(p).querySelectorAll('a[href*="INFO-"]'));
  assert.equal(links.length, 1, "a link to the document");
  const made = String(links[0].getAttribute("href")).match(/INFO-[A-Za-z0-9-]+/)[0];
  assert.ok(await t.mai.read("image", { query: { id: made } }), "the document is the one the owner made");
  assert.ok(!text(p).includes(made), "no raw record number");
  /* an answer that names no document is one the owner never gives for a testimony it took (fix round 10, K5245): no act makes it, so the case is removed */
});

test("R25 (C45) \"For which question\" shows the question's title, not its id; a question whose title cannot be read shows the word for a question", async () => {
  const t = await team();
  const q = await t.world.recipes.question(t.mai, t.project, { title: "Seven days" });
  /* the search that lists questions finds none, so the title is the one read of the question itself (the screen's route names it) */
  const withTitle = await open(t, `/app/capture/address/${q.id}`, { search: ok({ hits: [] }) });
  const option = () => text(withTitle);
  assert.ok(option().includes("Seven days"));
  assert.ok(!Array.from(withTitle.doc.getElementById("ci-for").parentNode.querySelectorAll("*")).some((e) => e.children.length === 0 && e.textContent.trim() === q.id), "the id is no one's label");
  /* a question whose document cannot be read: the owner answering nothing for it is the fault */
  const without = await open(t, `/app/capture/address/${q.id}`, { search: ok({ hits: [] }), image: ok(null) });
  assert.ok(!Array.from(without.doc.getElementById("ci-for").parentNode.querySelectorAll("*")).some((e) => e.children.length === 0 && e.textContent.trim() === q.id), "still not the id");
  assert.ok(says(without, "shell.card.question"));
});

/* ---------- C78 ---------- */

test("R47 (C78) the explanation of \"Show the stored logins\" sits directly under its own button, before the list it explains", async () => {
  /* a stored login is made by the owner's `capturecredentialsupply` (capture-sources R72: a member's own, the door stamping her), so the list the screen reads is the owner's */
  const t = await team({}, { env: { CAPTURE_CREDENTIALS_KEY: "k".repeat(64) } });
  await t.world.recipes.credential(t.mai, { host: "records.example.gov" });
  const p = await open(t, "/app/capture/address");
  assert.ok(btn(p, "capturecredentiallist").closest(".mk-acts").nextElementSibling.textContent.includes(word("screen.capture.cred.listnote1")), "it stands under its button before the press too (the shell closes the tip on the press, fix round 3, C78)");
  await press(p, "capturecredentiallist");
  const under = btn(p, "capturecredentiallist").closest(".mk-acts").nextElementSibling;
  assert.ok(under && under.textContent.includes(word("screen.capture.cred.listnote1")), "the note is the next thing under the button");
  assert.ok(text(p).indexOf(word("screen.capture.cred.listnote1")) < text(p).indexOf("records.example.gov"));
});

/* ---------- C90, C91 ---------- */

test("R46 (C90) \"Pause the watching\" is drawn for an administrator and not for a member, whom the plane would refuse", async () => {
  const t = await team();
  const ada = await t.world.signIn("ada", { admin: true });
  const admin = await open(t, "/app/watching", {}, ada);
  assert.ok(btn(admin, "monitorpause"));
  const member = await open(t, "/app/watching");
  assert.equal(btn(member, "monitorpause"), null);
  assert.ok(says(member, "screen.watching.running"), "the state is still said");
});

test("R44 R46 (C91) Add has doors to Watched addresses and Leads for an administrator and a member, and none for a viewer who may not use them", async () => {
  const t = await team();
  const ada = await t.world.signIn("ada", { admin: true });
  for (const [who, as] of [["admin", ada], ["member", t.mai]]) {
    const p = await open(t, "/app/capture/address", {}, as);
    assert.equal(anchors(p, "/app/watching").length, 1, `${who}: watching`);
    assert.equal(anchors(p, "/app/leads").length, 1, `${who}: leads`);
    assert.ok(says(p, "screen.watching.name") && says(p, "screen.leads.name"));
  }
  const viewer = await t.world.signIn("vera", { capabilities: [] });
  const none = await open(t, "/app/capture/address", {}, viewer);
  assert.equal(anchors(none, "/app/watching").length + anchors(none, "/app/leads").length, 0);
});

/* ---------- DEC-394 (3c): requests for later ---------- */

test("R55 (DEC-394 3c) \"Your requests for later\" lists the member's capture requests by their three states, from the one capturerequests read", async () => {
  const t = await team({ rosa: CAN });
  const at = (host, path) => `https://${host}/${path}`;
  const drain = () => t.world.door({ url: "/api/?op=capturerequestdrain", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: t.world.env.DAEMON_TOKEN });
  const done = at("b.example", "done"), no = at("c.example", "no"), waiting = at("a.example", "waiting"), theirs = at("d.example", "theirs");
  t.world.script(done, async () => new Response("<html><head><title>Done</title></head><body><p>It was captured.</p></body></html>", { status: 200, headers: { "content-type": "text/html" } }));
  t.world.script(no, async () => new Response("Sign in", { status: 401, headers: { "content-type": "text/plain" } }));
  await t.mai.act("capturerequest", { body: { address: done } });
  await t.mai.act("capturerequest", { body: { address: no } });
  await drain();
  await t.mai.act("capturerequest", { body: { address: waiting } });
  await t.rosa.act("capturerequest", { body: { address: theirs } });
  const asked = (await t.mai.read("capturerequests")).requests;
  assert.deepEqual(asked.map((r) => r.state).sort(), ["captured", "refused", "requested"], "the owner holds the three states");
  const p = await open(t, "/app/capture/address");
  assert.equal(p.byOp("capturerequests").length, 1, "one read serves the list and the logins asked for");
  for (const k of ["screen.capture.later.head", "screen.capture.later.about", "screen.capture.later.waiting", "screen.capture.later.captured", "screen.capture.later.turned"]) assert.ok(says(p, k), k);
  for (const a of ["a.example/waiting", "b.example/done", "c.example/no"]) assert.ok(text(p).includes(a), a);
  assert.ok(!text(p).includes("d.example/theirs"), "another member's request is not listed");
  const none = await open(t, "/app/capture/address", {}, await t.world.signIn("nell", { capabilities: CAN }));
  assert.ok(!says(none, "screen.capture.later.head"), "control: none to list draws no section");
});

/* ---------- C28: R7, R32 ---------- */

let visitor = 0;
/* a knock really received at the public door, as a visitor's; answers its id as the inbox lists it */
async function knocked(t, content, extra = {}) {
  const a = await t.world.door({ url: "/api/?op=knock", init: { method: "POST", headers: { "content-type": "application/json", "cf-connecting-ip": `203.0.113.${++visitor}` }, body: JSON.stringify({ contentText: content, note: "Sheets.", ...extra }) } });
  assert.equal(a.json.ok, true, JSON.stringify(a.json).slice(0, 300));
  const listed = (await t.mai.read("inbox")).inbox;
  const mine = listed.find((k) => k.sha256 && !knocked.seen.has(k.knock_id));
  knocked.seen.add(mine.knock_id);
  return mine;
}
knocked.seen = new Set();

test("R7 R32 (C28) a knock's detail shows its fingerprint, labelled, before the member decides; the list rows do not", async () => {
  const t = await team();
  const K = await knocked(t, "Three megabytes of sheets.");
  const one = await open(t, `/app/inbox/${K.knock_id}`);
  assert.ok(says(one, "screen.document.fingerprint"), "its label, by key");
  assert.ok(Array.from(main(one).querySelectorAll(".mk-data")).some((e) => e.textContent.trim() === K.sha256), "the fingerprint itself");
  assert.ok(btn(one, "inboxresolve") && btn(one, "inboxpull"), "and the acts of the decision");
  const list = await open(t, "/app/inbox");
  assert.ok(!text(list).includes(K.sha256) && !says(list, "screen.document.fingerprint"));
});

/* ---------- acquisition R5, R20: what was kept but is not finished ---------- */

test("R50 R71 a render RENDER-NOTE-X is said as it stands and an attestation not yet answered by screen.capture.attest.pending, never by the owner's ATTEST-NOTE-X; a capture with neither says neither", async () => {
  const t = await team();
  /* a render still pending and an attestation that did not finish are the owner's account of work a clock in the world does not run: the owner's real answer, with those two fields added */
  const real = await captured(t);
  const doc = { ...real.document, render_pending: { session: "rs_x", since: "2026-10-01T10:00:00Z", note: "RENDER-NOTE-X" },
    attestation_attempts: [{ service: "attest", attempted: true, ok: false, pending: true, at: "2026-10-01T10:00:00Z", note: "ATTEST-NOTE-X" }] };
  const p = await open(t, "/app/capture/address", { acquire: ok({ ...real, document: doc }) });
  fill(p, { "ci-address": ADDRESS });
  await press(p, "acquire");
  await p.settle();
  assert.ok(text(p).includes("RENDER-NOTE-X"));
  /* R71 (D-M6): the attestation is the list's sentence, never the owner's note */
  assert.ok(says(p, "screen.capture.attest.pending") && !text(p).includes("ATTEST-NOTE-X"));
  /* control: a capture the owner finished, with no render and no attestation owed, is pressed as it is */
  /* (the owner's own attempts are `pending` only while a service has not answered, which a clock decides: the same real answer with none pending is scripted) */
  const done = { ...real.document, attestation_attempts: real.document.attestation_attempts.map(({ pending, ...x }) => x) };
  const q = await open(t, "/app/capture/address", { acquire: ok({ ...real, document: done }) });
  fill(q, { "ci-address": ADDRESS });
  await press(q, "acquire");
  await q.settle();
  assert.ok(!text(q).includes("RENDER-NOTE-X") && !says(q, "screen.capture.attest.pending"));
});

/* ---------- control-plane R105, R116 (K4326): what a timed-out capture kept ---------- */

test("R50 a timed-out capture is drawn by what it kept: held and undetermined by their keys (where the table holds them), nothing by the base words", async () => {
  const t = await team();
  /* the door's 25 seconds cannot pass in the world, so the refusal and what it kept are the owner's, scripted */
  for (const kept of ["held", "undetermined", "nothing", undefined]) {
    const p = await open(t, "/app/capture/address", { acquire: refused("ACQUIRE_TIMED_OUT", "builder detail", 504, kept ? { kept } : {}) });
    fill(p, { "ci-address": ADDRESS });
    const r = await press(p, "acquire");
    const key = kept === "held" || kept === "undetermined" ? `refusal.ACQUIRE_TIMED_OUT.${kept}` : "refusal.ACQUIRE_TIMED_OUT";
    assert.ok(saysIn(r.slot(), hasKey(key) ? key : "refusal.ACQUIRE_TIMED_OUT"), String(kept));
    assert.ok(!r.slot().textContent.includes("builder detail"));
  }
});

test("R7 (C28) a discarded knock offers put-back, sending status new and saying it was done; a new knock offers discard and no put-back", async () => {
  const t = await team();
  const K = await knocked(t, "The agenda for March.", { fileName: "agenda.pdf", mediaType: "application/pdf" });
  await t.mai.act("inboxresolve", { body: { knockId: K.knock_id, status: "discarded", reason: "dup" } });
  const at = (id) => open(t, `/app/inbox/${id}`);
  const p = await at(K.knock_id);
  assert.ok(text(p).includes("agenda.pdf") && text(p).includes("application/pdf"), "the sender's stated name and type (R7, C28)");
  assert.equal(btn(p, "inboxpull"), null);
  await press(p, "inboxresolve");
  assert.equal(p.byOp("inboxresolve").length, 0, "no reason, nothing sent");
  fill(p, { "cx-back": "Mistake." });
  await press(p, "inboxresolve");
  assert.deepEqual(p.byOp("inboxresolve")[0].body, { knockId: K.knock_id, status: "new", reason: "Mistake." });
  assert.ok(says(p, "screen.inbox.putback.done"));
  assert.equal((await t.mai.read("inboxget", { query: { id: K.knock_id } })).item.status, "new", "the owner put it back");
  const fresh = await knocked(t, "A second packet of sheets.");
  const n = await at(fresh.knock_id);
  assert.ok(btn(n, "inboxresolve") && btn(n, "inboxpull"), "control: a new knock offers discard");
  assert.ok(!says(n, "act.inboxresolve.label.inbox.putback"));
});

test("R4 (capture R77 whole) a held row with no object under its fingerprint is marked refused and is never sent to release; control: whole true is", async () => {
  const t = await team();
  const whole = await t.world.recipes.hold(t.mai, "Whole one", "The whole one.\n", t.project);
  const parts = await t.world.recipes.hold(t.mai, "Parts only", "Parts only.\n", t.project);
  /* a held row whose whole object is missing under its fingerprint is a store the world's acts do not leave (a multipart capture whose parts alone remain): the owner's real rows, with `whole` false on one */
  const seen = await t.mai.read("heldcaptures", { query: { limit: "50", fields: "picker" } });
  const rows = (req) => ok({ ...seen, truncated: false, held: req.query.state === "set_aside" ? [] : seen.held.map((h) => ({ ...h, whole: h.bundle_id !== parts.bundle })) });
  const p = await open(t, "/app/held", { heldcaptures: rows });
  const picks = Array.from(main(p).querySelectorAll('input[type="checkbox"]'));
  for (const c of picks) c.checked = true;
  for (const c of picks) p.fire(c, "change");
  fill(p, { "ch-ack": "I read it.", "ch-mitigation": "I compared it." });
  await press(p, "release", { reason: "x" });
  const sel = p.byOp("select");
  assert.ok(sel.every((r) => !r.body.ids.includes(parts.bundle)), "the parts-only document is never selected");
  assert.ok(sel.some((r) => r.body.ids.includes(whole.bundle)), "the whole one is");
});

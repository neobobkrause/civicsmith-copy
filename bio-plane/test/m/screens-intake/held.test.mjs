/* screens-intake R4: the `held` screen (DEC-97) on the real served page: its read, its rows and picks, the hold strip's
 * acts and the restore. Fix round 10 (K5054): over the REAL store. The rows are documents the members hold by real acts (an upload, an `acquire` of an
 * address the world's network answers, a question's capture request drained by the daemon, a ZIP opened by `acquire`), promoted at `collected`; the
 * picks, the vouching and the setting aside are the page's own acts, answered by `retrieval`, `ratification` and `capture`. Every figure and sentence
 * an assertion needs (an age, an asker, a count of files, a day) is read from the owner's answer. What the owner cannot be made to answer stays
 * scripted, each said where it is. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { openWorld, members, idle, html, text, main, btn, fill, press, ok, refused, rawKeys, word, hasWord, says, saysIn, dayOf } from "./page.mjs";
import { SCREENS } from "../../../src/screens-intake/index.mjs";
import { makeZip } from "../../make-zip.mjs";

const sha = (v) => createHash("sha256").update(v).digest("hex");
const DAY = 86_400_000;
const CAN = ["contribute", "create_projects"];
const SPEC = { mai: CAN, rosa: CAN };
/* a world of the members named; `aged` pins its clock two days back, so that what is held before `later` has been held two days */
const desk = async (spec = SPEC, { aged = false, ...opts } = {}) => {
  const t = await members(spec, { ...(aged ? { now: Date.now() - 2 * DAY } : {}), ...opts });
  t.spec = spec;
  return t;
};
/* the clock moves on by `ms`, and the members sign in again (their sessions have ended) */
const later = async (t, ms = 2 * DAY) => {
  await t.world.tick(ms);
  for (const [handle, caps] of Object.entries(t.spec)) t[handle] = await t.world.signIn(handle, caps && caps.length ? { capabilities: caps } : {});
};
const daemon = (t, op, body = {}) => t.world.door({ url: `/api/?op=${op}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } }, { token: t.world.env.DAEMON_TOKEN }).then((r) => r.json.result);

/* A capture by the member's real act: `captureupload` of the bytes, or `acquire` of `address` (the world's network answers it). Answers the captured document. */
async function capture(t, as, { address = null, bytes: content, type = "text/plain", name = "notice" }) {
  if (address) {
    t.world.script(address, () => new Response(content, { status: 200, headers: { "content-type": type } }));
    return (await as.act("acquire", { body: { locator: address } })).document;
  }
  const up = await t.world.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement: name, name, type })}`, init: { method: "POST", headers: { "content-type": type }, body: typeof content === "string" ? new TextEncoder().encode(content) : content } }, as);
  const doc = up.json && up.json.result && up.json.result.document;
  if (!doc || !doc.capture) throw new Error(`${name} was not captured`);
  return doc;
}
/* A captured document promoted at `collected` (`allocid`, `promote`), as the recipe `hold` does it, with the title, project and criticality asked. */
async function promoteDoc(t, as, doc, { name = "notice", title = name, project = "", criticality = "supporting" } = {}) {
  const now = new Date(t.world.now()).toISOString().replace(/\.\d{3}Z$/, "Z");
  const id = (await as.read("allocid", { query: { prefix: "INFO", year: now.slice(0, 4) } })).id + "-" + name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const cap = doc.capture.sha256;
  const front = ["---", "id: " + id, "object_type: information", "schema: information@2", "title: " + JSON.stringify(title), "current_state: collected", "prior_state: null",
    "created: " + now, "last_updated: " + now, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0",
    "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: " + criticality, "source_status: unchanged", "content_hash: sha256:" + cap,
    "source:", "  locator: " + JSON.stringify(doc.locator || "upload"), "  authority: member-entered", "  retrieved: " + now, "monitoring:", "  enabled: false", "  frequency: none",
    ...(project ? ["project: " + project] : []), "---", "", "## Summary", "", title, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const prov = JSON.stringify({ documents: [doc] }, null, 1), dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator || "upload", sha256: cap }] });
  const len = (v) => new TextEncoder().encode(v).length;
  const files = [{ path: "bundle.md", text: front, bytes: len(front), sha256: sha(front) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: sha(prov) },
    { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: sha(dataset) }, { path: doc.file, blobSha: cap, sha256: cap, bytes: doc.capture.bytes }];
  const made = await as.act("promote", { body: { bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + sha(id).slice(0, 8),
    meta: { object_type: "information", title, current_state: "collected", created: now, last_updated: now, criticality }, files,
    register: [{ sha256: cap, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }] } });
  return { sha: cap, bundle: made.bundleId || id };
}
/* a document held: captured and promoted. `name` is the file's name (an upload's) and the id's tail; `title` the title the record stores. */
const hold = async (t, as, o = {}) => promoteDoc(t, as, await capture(t, as, { bytes: `${o.name || "notice"}\n`, ...o }), o);
/* A document captured for a question, by real acts (the recipe `setAside`'s first half): a question in `projectId`, the member's request to capture a public
   address for it, drained by the daemon, the document promoted at `collected`. Answers `{bundle, sha, question}`. */
let askedN = 0;
async function asked(t, as, projectId, { title = "What was asked", pageTitle = "Council minutes" } = {}) {
  const n = ++askedN;
  const q = await t.world.recipes.question(as, projectId, { title, text: title });
  const address = `https://records.example.org/minutes-${n}.html`;
  t.world.script(address, async () => new Response(`<html><head><title>${pageTitle}</title></head><body><p>The council met.</p></body></html>`, { status: 200, headers: { "content-type": "text/html" } }));
  const request = await as.act("capturerequest", { body: { address, target: q.id } });
  const done = ((await daemon(t, "capturerequestdrain")).captured || []).find((c) => c.request === request.request);
  if (!done || !done.promoted || !done.promoted.bundle_id) throw new Error("the captured document was not promoted");
  return { bundle: done.promoted.bundle_id, sha: done.sha, question: q.id };
}
/* A ZIP the member opens by `acquire` (the address answered by the world's network): the archive's document and each file the unpack filed are promoted
   (the door's own promotion of an unpack's files is not the world's), in `project`. `entries` are `{name, data}`; `locked` more entries the archive
   holds password-locked (not filed). Answers `{archive: {sha, bundle}, files: [{sha, bundle, name}]}`. */
let zipN = 0;
async function archiveOf(t, as, { entries, locked = 0, project = "", title = "Agenda packet (ZIP)" }) {
  const n = ++zipN;
  const zip = makeZip([...entries, ...Array.from({ length: locked }, (_, i) => ({ name: `locked${i + 1}.pdf`, data: "x", encrypted: "traditional" }))]);
  const address = `https://city.example/packet-${n}.zip`;
  t.world.script(address, () => new Response(zip, { status: 200, headers: { "content-type": "application/zip" } }));
  const got = await as.act("acquire", { body: { locator: address } });
  const archive = await promoteDoc(t, as, got.document, { name: `packet-${n}`, title, project });
  const files = [];
  for (const d of got.unpack.documents) files.push({ ...(await promoteDoc(t, as, d, { name: `packet-${n}-${d.container.index}`, title: d.container.path, project })), name: d.container.path });
  return { archive, files, unpack: got.unpack };
}
const zipEntries = (n, first = "01_Agenda.pdf") => Array.from({ length: n }, (_, i) => ({ name: i === 0 ? first : `${String(i + 1).padStart(2, "0")}_Part.pdf`, data: `Part ${i + 1} of the agenda packet.\n` }));

/* the page, the full rows the owner answers for it, and what the page asked */
const open = (t, path = "/app/held", as = t.mai, extra = {}) => openWorld(path, { world: t.world, as, ...extra });
const rowsOf = async (as, ids, extra = {}) => Object.fromEntries((await as.read("heldcaptures", { query: { limit: 50, bundle_ids: [].concat(ids).join(","), ...extra } })).held.map((r) => [r.bundle_id, r]));
const pick = async (p, id) => p.click(main(p).querySelector(`#pick-held-${id}`));
/* the page opens on the viewer's own captures; "everyone's" is its filter to the team's (R90), which a document captured at a member's request (made by the daemon) needs */
const everyone = async (p) => {
  const choice = p.doc.getElementById("ch-who");
  choice.value = "all";
  await p.fire(choice, "change");
  await idle(p);
  return p;
};
const day = (iso) => dayOf(iso);
/* the design's row for an empty Mine (DEC-435) is on the words list once setup-words is regenerated: its key where held, else the empty state's */
const mineEmpty = hasWord("screen.held.empty.mine") ? "screen.held.empty.mine" : "screen.held.empty";
const wordOr = (k, alt) => (hasWord(k) ? k : alt);
const age = (d) => (d === 0 ? word("screen.held.age.today") : d === 1 ? word("screen.held.age.one") : word("screen.held.age", { days: d }));

test("R4 the screen reads heldcaptures; a list with no row is drawn in the screen's own empty sentence", async () => {
  const t = await desk({ mai: CAN });
  await hold(t, t.mai, { name: "City budget" });
  const p = await open(t);
  /* C14 (capture R102): the page as picker rows, the set-aside list, and the full fields of the rows the page draws; no other read */
  assert.deepEqual(p.byOp("heldcaptures").map((r) => (r.query.state ? "state:" + r.query.state : r.query.fields ? "fields:" + r.query.fields : r.query.bundle_ids ? "bundle_ids" : "page")).sort(), ["bundle_ids", "fields:picker", "state:set_aside"]);
  const none = await desk({ mai: CAN });
  const e = await open(none);
  assert.ok(says(e, mineEmpty), "R70: on Mine, the empty state of Mine");
  /* control: a read that failed is drawn as failed, never as empty (the store's silence is a fault no act can make) */
  const f = await open(t, "/app/held", t.mai, { plane: { heldcaptures: refused("STORE_SILENT", "store silent (test fixture)") } });
  /* interface-shell R61: a refusal with its own words is drawn as those words alone */
  assert.match(text(f), /store silent \(test fixture\)/);
  assert.ok(main(f).querySelector('[data-state="failed"]'));
  assert.ok(!says(f, "state.failed", { reason: "x" }) && !text(f).includes(word("state.failed", { reason: "" }).split("{")[0].trim()));
  assert.ok(!says(f, "screen.held.empty"));
});

test("R4 each row with its title, age and project; the questions it waits for; withheld and refused marks with their reasons", async () => {
  const t = await desk(SPEC, { aged: true });
  const pothole = await t.world.recipes.project(t.mai, "Pothole repairs"), coliseum = await t.world.recipes.project(t.mai, "Coliseum");
  /* held two days: a photo in a project, a document captured for a question of hers, one captured for a question of rosa's she may not see */
  const photo = await hold(t, t.mai, { name: "Photo · Seminary Ave", project: pothole });
  const budget = await asked(t, t.mai, pothole, { title: "Were the transfers authorised?", pageTitle: "City budget" });
  const rosaProject = await t.world.recipes.project(t.rosa, "Rosa's matter");
  const minutes = await asked(t, t.rosa, rosaProject, { title: "What did the council decide?", pageTitle: "Council minutes" });
  /* held today: a lease declaring itself crucial, which the batch examination refuses */
  await later(t);
  const lease = await hold(t, t.mai, { name: "Lease amendment", project: coliseum, criticality: "crucial" });
  const p = await everyone(await open(t));
  const rows = await rowsOf(t.mai, [photo.bundle, budget.bundle, minutes.bundle, lease.bundle]);
  const x = text(p);
  for (const id of [photo.bundle, budget.bundle, minutes.bundle, lease.bundle]) assert.ok(main(p).querySelector(`#pick-held-${id}`), id);
  assert.equal(rows[photo.bundle].age_days, 2);
  assert.equal(rows[lease.bundle].age_days, 0);
  assert.ok(x.includes(`${age(2)} · ${word("screen.held.project", { project: "Pothole repairs" })}`));
  assert.ok(x.includes(`${word("screen.held.age.today")} · ${word("screen.held.project", { project: "Coliseum" })}`));
  const q = rows[budget.bundle].captured_for.questions[0];
  assert.equal(q.title, "Were the transfers authorised?");
  assert.ok(x.includes(word("screen.held.for", { asker: q.asker, title: q.title })));
  assert.ok(rows[minutes.bundle].captured_for.withheld, "the owner withholds a question she may not see");
  assert.ok(main(p).querySelector('[data-gap="withheld"]'));
  assert.ok(x.includes(word("screen.held.withheld")));
  assert.equal(rows[lease.bundle].eligible, false);
  assert.ok(main(p).querySelector('[data-gap="refused"]'));
  assert.ok(x.includes(`${word("screen.held.ineligible", { reason: word("screen.held.ineligible.crucial") })} ${word("screen.held.ineligible.alone")}`));
  assert.ok(rows[lease.bundle].reason && !x.includes(rows[lease.bundle].reason), "R23: never the catalogue's sentence");
  assert.deepEqual(rawKeys(p), []);
  /* an undetermined eligibility is read only when a page's examination ran out of time (HELD_PAGE_WAIT_MS, 5 s: capture R91) or for a vouched row (R88): no act of the world makes either on this list, so the case that scripted one is removed (fix round 10, K5245) */
  /* control: an eligible row with nothing withheld carries no gap mark */
  const one = await desk({ mai: CAN });
  await hold(one, one.mai, { name: "Photo" });
  assert.equal(main(await open(one)).querySelector("[data-gap]"), null);
});

test("R4 rows are picked (shell R19) and the hold strip offers heldsetaside and release; an archive's files open open-file", async () => {
  const t = await desk({ mai: CAN });
  const sewer = await t.world.recipes.project(t.mai, "Sewer");
  const budget = await hold(t, t.mai, { name: "City budget" });
  /* an agenda packet of fifty-two files and two the archive holds locked: the row lists the first fifty, and says there are more */
  const packet = await archiveOf(t, t.mai, { entries: zipEntries(52), locked: 2, project: sewer });
  const p = await open(t);
  assert.equal(btn(p, "release"), null, "no strip before a pick");
  await pick(p, budget.bundle);
  const strip = main(p).querySelector(".cs-hold");
  assert.ok(strip.querySelector('button[data-act="heldsetaside"]'));
  assert.ok(strip.querySelector('button[data-act="release"]'));
  assert.ok(strip.textContent.includes(word("shell.picked", { n: 1 })));
  const row = (await rowsOf(t.mai, packet.archive.bundle))[packet.archive.bundle];
  assert.equal(row.files_truncated, true);
  assert.deepEqual([row.archive.filed, row.archive.not_filed], [52, 2], "the owner counts what it filed and what it did not");
  const file = main(p).querySelector(`a.cs-ref[href="/app/open-file/${row.files[0].sha256}"]`);
  assert.equal(file.textContent, "01_Agenda.pdf");
  assert.equal(row.files[0].sha256, packet.files[0].sha);
  /* a document's screen is screens-inquiry's: registered alone, this module's page draws its card (shell R16) */
  assert.ok(main(p).querySelectorAll(".cs-card, a.cs-ref").some((e) => e.textContent === "City budget"));
  assert.ok(says(p, "screen.held.archive", { parts: `${word("screen.held.archive.filed", { count: row.archive.filed })}, ${word("screen.held.archive.notfiled", { count: row.archive.not_filed })}` }));
  assert.ok(says(p, "screen.held.archivemore", { shown: row.files.length, total: row.files_total }));
});

const ACK = "Each copy is what its source gave.", MITIGATION = "Compared with the site.";
/* two eligible documents of the member's own, picked on the page */
const twoPicked = async (t = null) => {
  t ||= await desk({ mai: CAN });
  const pothole = await t.world.recipes.project(t.mai, "Pothole repairs");
  const photo = await hold(t, t.mai, { name: "Photo · Seminary Ave", project: pothole });
  const budget = await hold(t, t.mai, { name: "City budget" });
  const p = await open(t);
  await pick(p, photo.bundle);
  await pick(p, budget.bundle);
  return { t, p, photo, budget };
};

test("R4 release: an enumerated selection of the picked rows, then the release over its handle, with the member's acknowledgment and mitigation", async () => {
  const { t, p, photo, budget } = await twoPicked();
  fill(p, { "ch-ack": ACK, "ch-mitigation": MITIGATION });
  await press(p, "release");
  assert.deepEqual(p.byOp("select")[0].body, { ids: [photo.bundle, budget.bundle] });
  /* K3017: ratification's map reads handle, acknowledgment and mitigation from the query alone */
  const rq = p.byOp("release")[0];
  assert.ok(typeof rq.query.handle === "string" && rq.query.handle, "the handle the selection gave");
  assert.equal(rq.query.acknowledgment, ACK);
  assert.equal(rq.query.mitigation, MITIGATION);
  assert.equal(rq.method, "POST");
  assert.ok(says(p, "screen.held.released", { count: 2 }));
  assert.ok(p.byOp("heldcaptures").length >= 2, "read again after the act (R8)");
  /* the owner released the two the page picked: they are no longer held awaiting a decision */
  assert.deepEqual(await rowsOf(t.mai, [photo.bundle, budget.bundle]), {});
  const vouched = await rowsOf(t.mai, [photo.bundle, budget.bundle], { state: "held_and_vouched" });
  assert.deepEqual(Object.values(vouched).map((r) => r.standing), ["verified", "verified"]);
});

test("R4 (K3114; ratification R51) release as ratification reads it: the three from the body, else the query; carried by neither, refused (control)", async () => {
  const t = await desk({ mai: CAN });
  const [a, b, c] = [await hold(t, t.mai, { name: "First" }), await hold(t, t.mai, { name: "Second" }), await hold(t, t.mai, { name: "Third" })];
  const p = await open(t);
  await pick(p, a.bundle);
  fill(p, { "ch-ack": ACK, "ch-mitigation": MITIGATION });
  await press(p, "release");
  assert.ok(says(p, "screen.held.released", { count: 1 }));
  const rq = p.byOp("release")[0];
  assert.deepEqual([rq.body.acknowledgment, rq.body.mitigation], [ACK, MITIGATION]);
  assert.ok(typeof rq.body.handle === "string" && rq.body.handle, "the handle the selection gave");
  assert.deepEqual(await rowsOf(t.mai, a.bundle), {}, "the owner released it");
  /* controls, each both ways, by the owner's own release: the three in the body alone, or in the query alone, release alike; in neither, refused */
  const F = (handle) => ({ handle, acknowledgment: "a", mitigation: "m" });
  const handle = async (doc) => (await t.mai.act("select", { body: { ids: [doc.bundle] } })).handle;
  const viaBody = await t.mai.act("release", { body: F(await handle(b)) });
  assert.deepEqual(viaBody.released, [b.bundle]);
  const viaQuery = await t.mai.act("release", { query: F(await handle(c)), body: {} });
  assert.deepEqual(viaQuery.released, [c.bundle]);
  const d = await hold(t, t.mai, { name: "Fourth" });
  const neither = await t.world.door({ url: "/api/?op=release", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, t.mai);
  assert.equal(neither.json.result.ok, false);
  assert.ok(neither.json.result.reason, "refused, with the owner's reason");
  assert.deepEqual(Object.keys(await rowsOf(t.mai, d.bundle)), [d.bundle], "and nothing released: it is still held");
});

test("R4 release sends nothing with a field missing, or a field outside ratification R20's bounds", async () => {
  const t = await desk({ mai: CAN });
  const photo = await hold(t, t.mai, { name: "Photo · Seminary Ave" });
  const cases = [[{ "ch-ack": "", "ch-mitigation": "" }, ["screen.held.vouchmissing", { fields: `${word("screen.held.ack")}, ${word("screen.held.mitigation")}` }]],
                 [{ "ch-ack": "a", "ch-mitigation": "" }, ["screen.held.vouchmissing", { fields: word("screen.held.mitigation") }]],
                 [{ "ch-ack": 'has a " quote', "ch-mitigation": "ok" }, ["screen.held.vouchbad", { field: word("screen.held.ack") }]],
                 [{ "ch-ack": "two\nlines", "ch-mitigation": "ok" }, ["screen.held.vouchbad", { field: word("screen.held.ack") }]],
                 [{ "ch-ack": "x".repeat(501), "ch-mitigation": "ok" }, ["screen.held.vouchbad", { field: word("screen.held.ack") }]]];
  for (const [values, [key, vars]] of cases) {
    const p = await open(t);
    await pick(p, photo.bundle);
    fill(p, values);
    const r = await press(p, "release");
    assert.equal(p.byOp("select").length + p.byOp("release").length, 0, JSON.stringify(values));
    assert.ok(saysIn(r.slot(), key, vars), JSON.stringify(values));
  }
  assert.deepEqual(Object.keys(await rowsOf(t.mai, photo.bundle)), [photo.bundle], "nothing was released");
  /* control: at 500 characters it is sent, and the owner releases it */
  const p = await open(t);
  await pick(p, photo.bundle);
  fill(p, { "ch-ack": "x".repeat(500), "ch-mitigation": "ok" });
  await press(p, "release");
  assert.equal(p.byOp("release").length, 1);
  assert.deepEqual(await rowsOf(t.mai, photo.bundle), {}, "released");
  /* a refused selection sends no release: the owner's refusal of a selection too large is a fault no few documents can cause, scripted */
  const u = await desk({ mai: CAN });
  const other = await hold(u, u.mai, { name: "City budget" });
  const q = await open(u, "/app/held", u.mai, { plane: { select: refused("TOO_LARGE") } });
  await pick(q, other.bundle);
  fill(q, { "ch-ack": "a", "ch-mitigation": "b" });
  const r = await press(q, "release");
  assert.equal(q.byOp("release").length, 0);
  assert.ok(saysIn(r.slot(), "screen.held.selectfailed"));
});

/* The team's Claude account, by an administrator's real acts (the recipes' own steps), so that the assistant is reachable for the members: her password again,
   the team's key set and switched on, its notice read. The key is a stand-in no call ever sends. */
const assistant = async (t) => {
  const ada = await t.world.signIn("ada", { admin: true });
  await ada.act("reauth", { body: { password: ada.password } });
  await ada.act("groupkeyset", { body: { key: "sk-ant-api03-" + "w".repeat(40) } });
  await ada.act("groupkeyswitch", { body: { on: true } });
  await ada.act("groupkeynoticeseen", { body: {} });
  return ada;
};
const asideOf = async (as, ids) => rowsOf(as, ids, { state: "set_aside" });

test("R4 R13 heldsetaside: one reason (the shell's reason field, no writing help) for every picked row; they move to the Set aside list", async () => {
  const t = await desk(SPEC, { ai: true });
  await assistant(t);
  assert.deepEqual([(await t.mai.read("assistantstate")).on, (await t.mai.read("groupkeystate")).on], [true, true], "the assistant is reachable for her");
  const pothole = await t.world.recipes.project(t.mai, "Pothole repairs");
  /* a document a question of hers waits on, and one that nothing waits on */
  const budget = await asked(t, t.mai, pothole, { title: "Were the transfers authorised?", pageTitle: "City budget" });
  const photo = await hold(t, t.mai, { name: "Photo · Seminary Ave", project: pothole });
  const p = await everyone(await open(t, "/app/held", t.mai));
  assert.ok(!says(p, "screen.held.setaside"), "R19: an empty Set aside is not drawn");
  const before = (await rowsOf(t.mai, budget.bundle))[budget.bundle];
  await pick(p, budget.bundle);
  const r = await press(p, "heldsetaside", { reason: "Wrong year.", sel: ":not([data-id])" });
  assert.equal(r.slot() && r.slot().querySelector('[data-act="writinghelp"]'), null, "no writing help on a reason (K1841)");
  assert.deepEqual(p.byOp("heldsetaside")[0].body, { ids: [budget.bundle], reason: "Wrong year." });
  assert.ok(says(p, "screen.held.setasidecount", { count: 1 }));
  const asker = before.captured_for.questions[0].asker;
  assert.ok(says(p, "screen.held.waiting", { asker, capture: before.title }), "the question that waits on it is told");
  const a = (await asideOf(t.mai, budget.bundle))[budget.bundle].set_aside;
  assert.equal(a.reason, "Wrong year.");
  assert.ok(text(p).includes(`${word("screen.held.asideby", { author: a.author, reason: a.reason })} ${day(a.at)}`), "read again, the row names who, why and when");
  assert.deepEqual(Object.keys(await rowsOf(t.mai, [budget.bundle, photo.bundle])), [photo.bundle], "and it is no longer held");
});

/* the owner's own read, with a fault laid over the one read the test names: `decide(req)` answers the scripted fault, or nothing to let the real read through */
const over = (as, op, decide) => async (req) => { const mine = decide(req); if (mine) return mine; const { op: _op, ...query } = req.query; return ok(await as.read(op, { query })); };
const aside = (req) => req.query.state === "set_aside";

test("R13 the Set aside list: heldcaptures with state set_aside, each row naming who set it aside, when and why; heldrestore with a reason, in its panel and for picked rows", async () => {
  const t = await desk({ mai: CAN, ben: CAN });
  const budget = await hold(t, t.mai, { name: "City budget" });
  const memo = await hold(t, t.ben, { name: "Memo" });
  await t.mai.act("heldsetaside", { body: { ids: [budget.bundle], reason: "Wrong year." } });
  await t.ben.act("heldsetaside", { body: { ids: [memo.bundle], reason: "Duplicate." } });
  const kept = await asideOf(t.mai, [budget.bundle, memo.bundle]);
  const open2 = () => open(t, "/app/held", t.mai);
  const p = await open2();
  assert.equal(p.byOp("heldcaptures").find((r) => r.query.state === "set_aside").query.state, "set_aside");
  const x = text(p);
  for (const id of [budget.bundle, memo.bundle]) {
    const a = kept[id].set_aside;
    assert.ok(x.includes(`${word("screen.held.asideby", { author: a.author, reason: a.reason })} ${day(a.at)}`), id);
  }
  assert.deepEqual([kept[budget.bundle].set_aside.author, kept[memo.bundle].set_aside.author], ["mai", "ben"], "the owner names who set each aside");
  /* in its row's panel: the one row, set aside in an earlier visit */
  await press(p, "heldrestore", { reason: "Right year after all.", sel: `[data-id="${budget.bundle}"]` });
  assert.deepEqual(p.byOp("heldrestore")[0].body, { ids: [budget.bundle], reason: "Right year after all." });
  assert.ok(says(p, "screen.held.restored", { count: 1 }));
  assert.deepEqual(Object.keys(await rowsOf(t.mai, budget.bundle)), [budget.bundle], "the owner holds it again");
  /* in the hold strip, for the picked rows */
  await t.mai.act("heldsetaside", { body: { ids: [budget.bundle], reason: "Wrong year." } });
  const q = await open2();
  await q.click(main(q).querySelector(`#pick-aside-${budget.bundle}`));
  await q.click(main(q).querySelector(`#pick-aside-${memo.bundle}`));
  await press(q, "heldrestore", { reason: "Both belong.", sel: ":not([data-id])" });
  assert.deepEqual([...q.byOp("heldrestore")[0].body.ids].sort(), [budget.bundle, memo.bundle].sort());
  assert.equal(q.byOp("heldrestore")[0].body.reason, "Both belong.");
  assert.ok(says(q, "screen.held.restored", { count: 2 }));
  assert.deepEqual(Object.keys(await rowsOf(t.mai, [budget.bundle, memo.bundle])).sort(), [budget.bundle, memo.bundle].sort());
  /* control: the Held list offers no restore, and a failed set-aside read is drawn failed, never empty */
  const f = await open(t, "/app/held", t.mai, { plane: { heldcaptures: over(t.mai, "heldcaptures", (req) => (aside(req) ? refused("STORE_SILENT", "store silent (test fixture)") : null)) } });
  assert.equal(btn(f, "heldrestore"), null);
  assert.ok(!says(f, "screen.held.asideempty"));
  /* interface-shell R61: a refusal with its own words is drawn as those words alone */
  assert.match(text(f), /store silent \(test fixture\)/);
  assert.ok(main(f).querySelector('[data-state="failed"]'));
});

test("R11 each row's grade is one mark from capture.grade, never a received or authored capture drawn as measured; its thumbnail opens open-file", async () => {
  const t = await desk({ mai: CAN });
  /* a page fetched from its address (a measured grade), a file brought in (received, not fetched), a member's own words (authored: testimony) */
  const fetched = await hold(t, t.mai, { name: "Fetched", address: "https://city.example/fetched.html", bytes: "<html><head><title>Fetched</title></head><body><p>The council met.</p></body></html>", type: "text/html" });
  const uploaded = await hold(t, t.mai, { name: "Uploaded" });
  const seen = (await t.mai.act("testify", { body: { words: "I saw the pothole.", observedAt: "2026-10-04T09:10:00Z" } })).bundle_id;
  const rows = await rowsOf(t.mai, [fetched.bundle, uploaded.bundle, seen]);
  const p = await everyone(await open(t));   /* a member's own words are filed by no capture of hers: the team's list holds them */
  const row = (id) => { const pick = main(p).querySelector(`#pick-held-${id}`); if (!pick) throw new Error(`no row ${id}: ${[...main(p).querySelectorAll("input")].map((i) => i.id).join(",")}`); return pick.parentNode.parentNode; };
  const grades = (id) => row(id).querySelectorAll(".cs-grade");
  const g = rows[fetched.bundle].capture.grade;
  assert.ok(g.grade && g.determined, "the owner measures a fetched page");
  assert.equal(grades(fetched.bundle).length, 1);
  assert.match(grades(fetched.bundle)[0].textContent, new RegExp(`${g.grade}$`));
  assert.equal(rows[uploaded.bundle].capture.grade.basis, "CAPTURE_RECEIVED_NOT_FETCHED");
  assert.equal(grades(uploaded.bundle).length, 0, "a received capture earns no letter");
  assert.ok(saysIn(row(uploaded.bundle), "screen.held.grade.received"));
  assert.equal(rows[seen].capture.grade.basis, "CAPTURE_AXIS_AUTHORED");
  assert.equal(grades(seen).length, 0);
  assert.ok(saysIn(row(seen), "screen.held.grade.testimony"));
  /* the thumbnail opens open-file for capture.sha256 */
  for (const id of [fetched.bundle, uploaded.bundle, seen]) assert.ok(row(id).querySelector(`a.cs-ref[href="/app/open-file/${rows[id].capture.sha256}"]`), id);
  assert.deepEqual(rawKeys(p), []);
  /* a letter stated by its author without a measure (route unrecorded) and a row with no capture are states the owner's record does not make from any act of a member (its grade axis is
     measured or authored, and a held document files its capture): the case that scripted them is removed (fix round 10, K5245) */
});

test("R4 heldcaptures (\"See held captures\") asks the list again", async () => {
  const t = await desk({ mai: CAN });
  await hold(t, t.mai, { name: "Notice" });
  const p = await open(t);
  const before = p.byOp("heldcaptures").length;
  await press(p, "heldcaptures", { reason: "refresh" });
  assert.ok(p.byOp("heldcaptures").length > before && p.byOp("heldcaptures").length >= 3);
});

test("R23 a held row's refusal is drawn by its words, never the catalogue's text; a crucial capture is still refused, in words", async () => {
  /* the owner's own refusals: a document declaring itself crucial (CRUCIAL_IN_BATCH), a member's own words with none of what a document needs (ENTRY_REQUIREMENTS), and a
     document a contradiction touches (CONTESTED_IN_BATCH, made by an administrator's run) */
  const t = await desk({ mai: CAN }, { ai: true });
  t.ada = await t.world.signIn("ada", { admin: true });
  const crucial = await hold(t, t.mai, { name: "Lease amendment", criticality: "crucial" });
  const incomplete = (await t.mai.act("testify", { body: { words: "I saw the pothole.", observedAt: "2026-10-04T09:10:00Z" } })).bundle_id;
  const contested = (await t.world.recipes.contradiction(t.ada)).documents[0];
  const rows = await rowsOf(t.ada, [crucial.bundle, incomplete, contested]);
  assert.deepEqual([rows[crucial.bundle].class, rows[incomplete].class, rows[contested].class], ["CRUCIAL_IN_BATCH", "ENTRY_REQUIREMENTS", "CONTESTED_IN_BATCH"]);
  const CAT = rows[crucial.bundle].reason;
  assert.ok(CAT && CAT !== word("screen.held.ineligible.crucial"), "the owner's catalogue sentence is its own");
  /* a class the page does not know and a refusal naming no class are not made by the owner: the two scripted rows of this test are removed (fix round 10, K5245) */
  const p = await everyone(await open(t, "/app/held", t.ada));
  const row = (id) => main(p).querySelector(`#pick-held-${id}`).parentNode.parentNode;
  assert.ok(!text(p).includes(CAT), "no row draws the catalogue's text");
  assert.ok(saysIn(row(crucial.bundle), "screen.held.ineligible.crucial"));
  assert.ok(saysIn(row(contested), "screen.held.ineligible.contested"));
  for (const id of [crucial.bundle, incomplete, contested]) {
    assert.ok(row(id).querySelector('[data-gap="refused"]'), id);
    assert.ok(saysIn(row(id), "screen.held.ineligible.alone"), id);
  }
  /* control: the other class's sentence is not drawn for a crucial one */
  assert.ok(!saysIn(row(crucial.bundle), "screen.held.ineligible.contested"));
  /* the release over a crucial pick is refused CRUCIAL_IN_BATCH by the owner and drawn in its words, counting the offenders */
  const q = await everyone(await open(t, "/app/held", t.mai));
  await pick(q, crucial.bundle);
  fill(q, { "ch-ack": "a", "ch-mitigation": "b" });
  const r = await press(q, "release");
  const refused1 = (await t.world.door({ url: `/api/?op=release&handle=${encodeURIComponent(q.byOp("release")[0].query.handle)}&acknowledgment=a&mitigation=b`, init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, t.mai)).json.result;
  assert.equal(refused1.reason, "CRUCIAL_IN_BATCH", "the owner refuses it");
  assert.ok(saysIn(r.slot(), "refusal.CRUCIAL_IN_BATCH", { count: refused1.offenders.length }), r.slot().textContent);
  assert.ok(!r.slot().textContent.includes("{count}"));
  assert.ok(!r.slot().textContent.includes(CAT));
  /* ENTRY_REQUIREMENTS names each offender with what it lacks */
  const e = await everyone(await open(t, "/app/held", t.mai));
  await pick(e, incomplete);
  fill(e, { "ch-ack": "a", "ch-mitigation": "b" });
  const s = await press(e, "release");
  const lacking = (await t.world.door({ url: `/api/?op=release&handle=${encodeURIComponent(e.byOp("release")[0].query.handle)}&acknowledgment=a&mitigation=b`, init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, t.mai)).json.result;
  assert.equal(lacking.reason, "ENTRY_REQUIREMENTS");
  const named = lacking.offenders.map((o) => `${o.id} (${o.missing.join(", ")})`).join("; ");
  assert.ok(saysIn(s.slot(), "refusal.ENTRY_REQUIREMENTS", { offenders: named }), s.slot().textContent);
  /* control: any other code is the shell's (R13): the answer's own words. The owner refuses a release with no other code from this page: the one scripted answer */
  const o = await open(t, "/app/held", t.mai, { plane: { release: refused("SOMETHING_ELSE", "The owner's own words.") } });
  await pick(o, crucial.bundle);
  fill(o, { "ch-ack": "a", "ch-mitigation": "b" });
  assert.match((await press(o, "release")).slot().textContent, /The owner's own words\./);
});

test("R26 every key the held screen reads is a word of the list, and its rows draw word(key, vars)", async () => {
  const keys = SCREENS.find((x) => x.id === "held").words;
  for (const k of keys) assert.ok(hasWord(k), k);
  const t = await desk({ mai: CAN }, { now: Date.now() });   /* the world's clock at today: the document is held today */
  await hold(t, t.mai, { name: "Notice" });
  const p = await open(t);
  for (const k of ["screen.held.sub"]) assert.ok(says(p, k), k);
  assert.ok(says(p, "screen.held.age.today"));
  assert.ok(says(p, "screen.held.noproject"));
});

/* ---- T50 (T50-30): R35, R37; T51 (T51-117): R40 ---- */
/* capture R77 (T51): a row answers `actor`, `retrieved` and `bytes` of its own; `memberlist` gives the uploader's handle */
test("R35 R40 a held upload reads uploaded by its member's handle and the day of retrieved, then its size, never upload:<hex>", async () => {
  const t = await desk({ mai: CAN, rosa: CAN });
  const up = await hold(t, t.rosa, { name: "Pothole photo", bytes: "p".repeat(2300) });
  const row = (await rowsOf(t.rosa, up.bundle))[up.bundle];
  const handle = (await t.mai.read("memberlist")).members.find((m) => m.member_id === t.rosa.member);
  assert.ok(handle && handle.handle, "the roster names her");
  const p = await everyone(await open(t, "/app/held", t.mai));
  const x = text(p);
  const by = word("document.uploaded.by", { member: handle.handle, date: dayOf(row.retrieved) });
  assert.ok(x.includes(`${by} · ${word("size.kb", { n: "2" })}`), "the uploader, then the size, in the same row");
  assert.ok(!x.includes("upload:") && !x.includes(up.sha.slice(0, 16)), "no raw fingerprint, no upload:<hex>");
  /* in a world a member's handle is her id, so only the stamp's form can be told apart from the handle */
  assert.ok(!x.includes("member:"), "the handle, never the stamp (`member:<id>`)");
  /* the size words: below 1 KB, MB */
  for (const [bytes, expected] of [[200, word("size.small")], [3 * 1048576, word("size.mb", { n: "3.0" })]]) {
    const u = await desk({ rosa: CAN });
    await hold(u, u.rosa, { name: "Sized", bytes: "s".repeat(bytes) });
    const q = await open(u, "/app/held", u.rosa);
    assert.ok(text(q).includes(expected), String(bytes));
    assert.ok(!/\b\d+ B\b/.test(text(q)), "never a byte count");
  }
  assert.ok(p.byOp("memberlist").length >= 1, "the shell's roster gives the handle (interface-shell R111)");
});

const sizeWord = (n) => (n < 1024 ? word("size.small") : n >= 1048576 ? word("size.mb", { n: (n / 1048576).toFixed(1) }) : word("size.kb", { n: String(Math.round(n / 1024)) }));
const uploaded = word("document.uploaded.by", { member: "x", date: "y" }).split("x")[0].trim();

test("R35 R40 controls: a fetched row still names its address; an archive's row draws the archive's size", async () => {
  const t = await desk({ mai: CAN });
  const address = "https://city.example/notice.pdf";
  const fetched = await hold(t, t.mai, { name: "Notice", address, bytes: "<html><head><title>Notice</title></head><body><p>The council met.</p></body></html>", type: "text/html" });
  const p = await open(t);
  assert.ok(text(p).includes(word("screen.held.from", { address })));
  assert.ok(!text(p).includes(uploaded));
  /* an archive's row draws the archive's size */
  const zipped = await hold(t, t.mai, { name: "Packet", bytes: makeZip(zipEntries(3)), type: "application/zip" });
  const zrow = (await rowsOf(t.mai, zipped.bundle))[zipped.bundle];
  assert.ok(Number.isFinite(zrow.bytes), "the owner states the archive's size");
  assert.ok(text(await open(t)).includes(sizeWord(zrow.bytes)));
  /* held's own two lists stay held and set_aside: it lists no vouched row */
  assert.ok(p.byOp("heldcaptures").every((r) => r.query.state === undefined || r.query.state === "set_aside"), "held reads no vouched row");
  assert.ok(fetched.bundle);
});

test("R37 a held ZIP draws its summary in both parts and one door, Open its files, a reference of kind archive for the archive's digest; the files it lists sit under it", async () => {
  const t = await desk({ mai: CAN });
  const z = await archiveOf(t, t.mai, { entries: zipEntries(36), locked: 2 });
  const row = (await rowsOf(t.mai, z.archive.bundle))[z.archive.bundle];
  assert.deepEqual([row.archive.filed, row.archive.not_filed], [36, 2], "the owner counts what it filed and what it did not");
  const p = await open(t);
  assert.ok(text(p).includes(word("screen.held.archive", { parts: `${word("screen.held.archive.filed", { count: 36 })}, ${word("screen.held.archive.notfiled", { count: 2 })}` })));
  assert.ok(text(p).includes(word("screen.held.archivefiles")), "the door's words");
  const door = main(p).querySelectorAll("[data-tip]").find((e) => e.textContent === word("screen.held.archivefiles"));
  assert.ok(door && door.getAttribute("data-tip").startsWith(`<b>${word("shell.card.archive")}</b>`), "the door is a reference of kind archive, with its card");
  assert.ok(text(p).includes("01_Agenda.pdf"), "its files listed beside it");
  assert.deepEqual(rawKeys(p), []);
});

test("R37 the door opens archive with the archive's own digest as its subject (needs interface-shell R81's kind)", async () => {
  const t = await desk({ mai: CAN });
  const z = await archiveOf(t, t.mai, { entries: zipEntries(3) });
  const row = (await rowsOf(t.mai, z.archive.bundle))[z.archive.bundle];
  const p = await open(t);
  const door = main(p).querySelector(`a.cs-ref[href="/app/archive/${row.archive.sha256}"][data-nav]`);
  assert.ok(door, "a link to archive for the archive's digest");
  assert.equal(door.textContent, word("screen.held.archivefiles"));
});

test("R37 controls: no not-filed part at zero, no summary at all at zero both; truncation said with shown and total", async () => {
  const t = await desk({ mai: CAN });
  const z = await archiveOf(t, t.mai, { entries: zipEntries(36) });
  const row = (await rowsOf(t.mai, z.archive.bundle))[z.archive.bundle];
  assert.deepEqual([row.archive.filed, row.archive.not_filed], [36, 0]);
  const a = await open(t);
  assert.ok(text(a).includes(word("screen.held.archive", { parts: word("screen.held.archive.filed", { count: 36 }) })));
  assert.ok(!text(a).includes(word("screen.held.archive.notfiled", { count: 0 })) && !text(a).includes("0 not filed"));
  /* an archive every file of which the team already held (filed none, not filed none): the same files in another order make another archive, whose files are all held already */
  const again = await archiveOf(t, t.mai, { entries: zipEntries(36).reverse() });
  const arow = (await rowsOf(t.mai, again.archive.bundle))[again.archive.bundle];
  assert.deepEqual([arow.archive.filed, arow.archive.already_held, arow.archive.not_filed], [0, 36, 0], "the owner counts every file as already held");
  const nothing = await open(t);
  const nrow = main(nothing).querySelector(`#pick-held-${again.archive.bundle}`).parentNode.parentNode;
  assert.ok(!nrow.textContent.includes(word("screen.held.archive", { parts: "x" }).split("x")[0].trim()), "no summary line with nothing in it");
  assert.ok(nrow.textContent.includes(word("screen.held.archivefiles")), "the door remains");
  const cut = await archiveOf(t, t.mai, { entries: zipEntries(52) });
  const crow = (await rowsOf(t.mai, cut.archive.bundle))[cut.archive.bundle];
  assert.equal(crow.files_truncated, true);
  assert.ok(text(await open(t)).includes(word("screen.held.archivemore", { shown: crow.files.length, total: crow.files_total })));
  /* a row whose listing did not settle in time (capture R91, a wait of 5 s) answers no files: no act makes it, so the case that scripted it is removed (fix round 10, K5245) */
});

test("R37 control: an ordinary row, and a file cut out of an archive (archive: {sha256} alone), draw no door", async () => {
  const t = await desk({ mai: CAN });
  const notice = await hold(t, t.mai, { name: "Notice" });
  const z = await archiveOf(t, t.mai, { entries: zipEntries(2) });
  /* the archive's own row released, its files remain held on their own, each answering its archive by the digest alone */
  const handle = (await t.mai.act("select", { body: { ids: [z.archive.bundle] } })).handle;
  await t.mai.act("release", { body: { handle, acknowledgment: "a", mitigation: "m" } });
  const file = (await rowsOf(t.mai, z.files[0].bundle))[z.files[0].bundle];
  assert.deepEqual(Object.keys(file.archive || {}), ["sha256"], "the owner answers the file's archive by its digest alone");
  assert.ok(file && (await rowsOf(t.mai, notice.bundle))[notice.bundle]);
  const only = await open(t);
  assert.ok(!text(only).includes(word("screen.held.archivefiles")));
});

test("B6 a row names its project by its name, never its record id; no project says so", async () => {
  const t = await desk({ mai: CAN });
  const pothole = await t.world.recipes.project(t.mai, "Pothole repairs");
  const filed = await hold(t, t.mai, { name: "Photo", project: pothole });
  const p = await open(t);
  assert.ok(text(p).includes(word("screen.held.project", { project: "Pothole repairs" })));
  assert.ok(!text(p).includes(pothole) && !text(p).includes("pothole-repairs"), "no slug, no id");
  /* a project the viewer's list does not name: a hidden project's documents are not the viewer's to see, so no row reaches her naming one (measured); the case that scripted it is removed (fix round 10, K5245) */
  const loose = await hold(t, t.mai, { name: "Loose" });
  const none = await open(t);
  assert.ok(text(none).includes(word("screen.held.noproject")));
  /* an archive's listed file with no name is no answer the owner gives (every file carries its path): the case that scripted one is removed (fix round 10, K5245) */
});

test("R69 Set aside asks its reason: picked rows with no reason typed send nothing and draw the field's refusal; a reason typed sends heldsetaside with it, and the row moves to Set aside with who, when and why", async () => {
  const t = await desk({ mai: CAN });
  const a = await hold(t, t.mai, { name: "City budget" });
  const p = await open(t);
  await pick(p, a.bundle);
  const none = await press(p, "heldsetaside", { reason: "", sel: ":not([data-id])" });
  assert.equal(p.byOp("heldsetaside").length, 0, "nothing is sent");
  assert.ok(none.slot().textContent.trim().length > 0, "the field's own refusal is drawn");
  assert.deepEqual(Object.keys(await rowsOf(t.mai, a.bundle)), [a.bundle], "and the owner still holds it");
  await press(p, "heldsetaside", { reason: "Wrong year.", sel: ":not([data-id])" });
  assert.deepEqual(p.byOp("heldsetaside")[0].body, { ids: [a.bundle], reason: "Wrong year." });
  const kept = (await asideOf(t.mai, a.bundle))[a.bundle].set_aside;
  assert.equal(kept.reason, "Wrong year.");
  assert.ok(text(p).includes(`${word("screen.held.asideby", { author: kept.author, reason: kept.reason })} ${day(kept.at)}`), "who, when and why");
});

test("R70 the Held list: Mine by default, Everyone's by the choice, each reading the list again; the empty state of each", async () => {
  const t = await desk({ mai: CAN, rosa: CAN });
  const mine = await hold(t, t.mai, { name: "Mai's notice" });
  const hers = await hold(t, t.rosa, { name: "Rosa's notice" });
  const p = await open(t);
  assert.ok(main(p).querySelector(`#pick-held-${mine.bundle}`) && !main(p).querySelector(`#pick-held-${hers.bundle}`), "Mine: what the viewer handed in");
  assert.ok(p.byOp("heldcaptures").some((r) => r.query.member === t.mai.member), "read for the viewer");
  const before = p.byOp("heldcaptures").length;
  await everyone(p);
  assert.ok(main(p).querySelector(`#pick-held-${mine.bundle}`) && main(p).querySelector(`#pick-held-${hers.bundle}`), "Everyone's: both");
  assert.ok(p.byOp("heldcaptures").length > before && p.byOp("heldcaptures").slice(before).some((r) => r.query.member === undefined && r.query.state === undefined), "the choice reads the list again, without a member");
  /* the choice's words and the empty states */
  assert.ok(says(p, wordOr("screen.held.who.mine", "ai.whose.own")) && says(p, wordOr("screen.held.who.all", "ai.whose.group")));
  const none = await desk({ mai: CAN });
  const e = await open(none);
  assert.ok(says(e, mineEmpty), "none of Mine");
  await everyone(e);
  assert.ok(says(e, "screen.held.empty"), "none of Everyone's");
  /* a member's own empty Mine is not the team's: rosa holds one, mai none */
  const mixed = await desk({ mai: CAN, rosa: CAN });
  await hold(mixed, mixed.rosa, { name: "Rosa's notice" });
  assert.ok(says(await open(mixed), mineEmpty));
});

test("R70 past a page of 50 the list says more are waiting with a door to the next page, drawn only when the read gives next; the second page by next, with a door back", async () => {
  const t = await desk({ mai: CAN });
  for (let i = 0; i < 52; i++) await t.world.recipes.hold(t.mai, `Held ${String(i).padStart(2, "0")}`, `Held capture number ${i}.\n`);
  const p = await open(t);
  const first = p.byOp("heldcaptures").find((r) => !r.query.state && r.query.fields === "picker");
  assert.equal(first.query.limit, "50");
  const page = await t.mai.read("heldcaptures", { query: { limit: 50, fields: "picker", member: t.mai.member } });
  assert.ok(page.truncated === true && typeof page.next === "string" && page.next, "the owner says there are more, and where");
  assert.equal(main(p).querySelectorAll('input[id^="pick-held-"]').length, 50);
  assert.ok(says(p, "screen.held.more", { count: 50 }));
  const nextWord = wordOr("screen.held.next", "document.read.next");
  const door = main(p).querySelectorAll('button[data-act="heldcaptures"]').find((b) => b.textContent.includes(word(nextWord)));
  assert.ok(door, "its door");
  assert.equal(main(p).querySelectorAll('button[data-act="heldcaptures"]').filter((b) => b.textContent.includes(word(wordOr("screen.held.back", "document.read.prev")))).length, 0, "no way back on the first page");
  await p.click(door);
  await idle(p);
  assert.ok(p.byOp("heldcaptures").some((r) => r.query.after === page.next), "read from the answer's next");
  assert.equal(main(p).querySelectorAll('input[id^="pick-held-"]').length, 2, "the rest");
  assert.ok(!says(p, "screen.held.more", { count: 2 }), "no sentence of more on the last page");
  assert.ok(main(p).querySelectorAll('button[data-act="heldcaptures"]').some((b) => b.textContent.includes(word(wordOr("screen.held.back", "document.read.prev")))), "a door back");
  /* control: a team of fewer than a page draws neither */
  const small = await desk({ mai: CAN });
  await hold(small, small.mai, { name: "One" });
  const q = await open(small);
  assert.ok(!main(q).querySelector("[data-more]"));
});

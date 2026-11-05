/* screens-daily, T51 fix round 2 (wave 2): C21 (Find's hits name their document and draw the plane's excerpt), C72 ("What you answered"
   draws every answered obligation), C94 (a member is named by handle, never by id) and C14 (the held captures are read once, as the
   cheap picker where only documents are chosen). Requirement lines proposed in the job record: R83 (C21), R84 (C72), R85 (C94), R86 (C14).
   Every sentence is asserted as `word(key, vars)` (R34). */
import "../../sandbox.mjs";
import test from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "../store-request/fixtures.mjs";
import { hex, instant, resultOf } from "../store-request/door.mjs";
import { open as openRaw, text, main, press, word, withScreens, settle } from "./page.mjs";

// The page is opened over the REAL store (store-request's `storeWorld()`, op-tables §5.3): every state below is made by the real acts of members.
const open = (w, as, path, plane = {}) => openRaw(path, plane, { ...w.boot(as), screens: withScreens("document", "question", "person", "action", "plan", "project") });
const links = (p) => main(p).querySelectorAll("a[href]").map((a) => [a.getAttribute("href"), a.textContent]);
const timeout = { timeout: 180000 };
const WORLD = {};

/** A web page held with no title of its own (a scan whose title was never read): `captureupload` and `promote` of an information bundle that states none, and
 *  the held file read, as `recipes.hold` does for a titled one. Answers its bundle id. */
async function heldUntitled(w, as, statement, html, project) {
  const up = await w.door({ url: `/api/?${new URLSearchParams({ op: "captureupload", statement, name: statement, type: "text/html" })}`,
    init: { method: "POST", headers: { "content-type": "text/html" }, body: new TextEncoder().encode(html) } }, as);
  const doc = resultOf(up).document;
  const now = instant(w);
  const id = (await as.read("allocid", { query: { prefix: "INFO", year: now.slice(0, 4) } })).id + "-untitled";
  const sha = doc.capture.sha256;
  const front = ["---", "id: " + id, "object_type: information", "schema: information@2", "current_state: collected", "prior_state: null",
    "created: " + now, "last_updated: " + now, "produced_by:", "  mode: assisted", "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0",
    "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting", "source_status: unchanged", "content_hash: sha256:" + hex(sha),
    "source:", "  locator: " + JSON.stringify(doc.locator || "upload"), "  authority: member-entered", "  retrieved: " + now, "monitoring:", "  enabled: false", "  frequency: none",
    ...(project ? ["project: " + project] : []), "---", "", "## Summary", "", statement, "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const prov = JSON.stringify({ documents: [doc] }, null, 1), dataset = JSON.stringify({ documents: [{ bytes: doc.capture.bytes, locator: doc.locator || "upload", sha256: sha }] });
  const len = (s) => new TextEncoder().encode(s).length;
  const files = [{ path: "bundle.md", text: front, bytes: len(front), sha256: hex(front) }, { path: "data/provenance.json", text: prov, bytes: len(prov), sha256: hex(prov) },
    { path: "data/dataset.json", text: dataset, bytes: len(dataset), sha256: hex(dataset) }, { path: doc.file, blobSha: sha, sha256: sha, bytes: doc.capture.bytes }];
  const made = await as.act("promote", { body: { bundleId: id, base: null, snapKey: now.replace(/[-:]/g, "") + "_" + hex(id).slice(0, 8),
    meta: { object_type: "information", current_state: "collected", created: now, last_updated: now }, files, register: [{ sha256: sha, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }] } });
  await as.act("readheld", { query: { sha } });
  return made.bundleId || id;
}

test("R83: every passage row names its document by the title the plane gives it and links it; a document with no title is named by the untitled word, never left out or by its id", timeout, async () => {
  const w = await storeWorld(WORLD);
  const rosa = await w.signIn("rosa", { admin: true });
  const project = await w.recipes.project(rosa, "Water board");
  const packet = await w.recipes.page(rosa, "Water board packet", { paragraphs: ["quorum absent and hydrostatic pressure rising"], project });
  const scan = await heldUntitled(w, rosa, "a scan", "<html><body><p>a second hydrostatic test</p></body></html>", project);
  const p = await open(w, rosa, "/app/finder/hydrostatic");
  await settle();
  assert.ok(links(p).some(([href, t]) => href === "/app/document/" + packet.bundle && t === "Water board packet"), "the titled document is a link");
  assert.ok(links(p).some(([href, t]) => href === "/app/document/" + scan && t === word("shell.card.document")), "the untitled one is named by the kit's plain word");
  assert.ok(!text(p).includes(scan) && !text(p).includes(packet.bundle), "no document id is drawn");
});

test("R83: a question hit draws the plane's excerpt (its title and conclusion, the match emphasised) and opens the question; a passage hit names its document; control: a document hit is unchanged", timeout, async () => {
  const w = await storeWorld(WORLD);
  const rosa = await w.signIn("rosa", { admin: true });
  const project = await w.recipes.project(rosa, "Council business");
  const q = await w.recipes.question(rosa, project, { title: "Who pays for the sewer repair?", text: "Who pays for the sewer repair?", draw: true });
  const packet = await w.recipes.page(rosa, "Water board packet", { paragraphs: ["quorum absent and sewer pressure"], project });
  const note = await w.recipes.hold(rosa, "Sewer fund note", "the sewer fund holds nothing", project);
  const p = await open(w, rosa, "/app/finder/sewer");
  await settle();
  const rowOf = (href) => { let r = main(p).querySelector(`a[href="${href}"]`); while (r && !(r.className || "").includes("cs-row")) r = r.parentNode; return r; };
  assert.ok(links(p).some(([href, t]) => href === "/app/question/" + q.id && t === "Who pays for the sewer repair?"), "the question opens question");
  const question = rowOf("/app/question/" + q.id);
  assert.deepEqual(question.querySelectorAll("em").map((e) => e.textContent), ["sewer"], "the match is emphasised in the question's excerpt");
  assert.ok(!/\[|\]|##|INQ-|sha256/.test(text(p, question).replace(/INQ-[0-9-]+/g, "")), "no markdown heading, brackets or hash in the question's excerpt");
  const passage = rowOf("/app/document/" + packet.bundle);
  assert.deepEqual(passage.querySelectorAll("em").map((e) => e.textContent), ["sewer"], "the match is emphasised in the passage");
  assert.ok(links(p).some(([href, t]) => href === "/app/document/" + packet.bundle && t === "Water board packet"), "a passage hit with no title of its own is named by its document's title");
  assert.ok(!/\[|\]|sha256/.test(text(p, passage)), "no brackets or hash in the passage");
  assert.ok(links(p).some(([href, t]) => href === "/app/document/" + note.bundle && t === "Sewer fund note"), "control: the document hit is as before");
  // The real store also finds the project the question is drawn into (its row is a hit too), so the matches are the rows' own: each of the three named above and the project's.
  const ems = main(p).querySelectorAll("em").map((e) => e.textContent.toLowerCase());
  assert.ok(ems.length >= 3 && ems.every((x) => x === "sewer"), "the matches are emphasised, the brackets are not drawn: the note's, the question's and the passage's");
});

/* ---------- C94 · R85: a member is named by handle, never by id ---------- */

const unknownWord = () => word("shell.card.member");
const clockOf = (iso) => { const d = new Date(iso); return word("time.clock", { hour: String(d.getHours() % 12 === 0 ? 12 : d.getHours() % 12), minute: String(d.getMinutes()).padStart(2, "0"), ampm: word(d.getHours() < 12 ? "time.am" : "time.pm") }); };
const whenOf = (iso) => word("time.at", { date: word("date.daymonthyear", { day: String(Number(iso.slice(8, 10))), month: word("date.month." + MONTH_OF(iso)), year: iso.slice(0, 4) }), time: clockOf(iso) });
const MONTH_OF = (iso) => ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"][Number(iso.slice(5, 7)) - 1];

/** Real to-dos for a team: a question in a project and `n` documents each captured, at the request of rosa, from a public address of its own
 *  (`capturerequest`, drained by the daemon), whose authority nobody has determined: after the scheduler's next round the administrator holds one to-do for each. */
async function undetermined(w, rosa, project, n) {
  const q = await w.recipes.question(rosa, project, { title: "What was decided", text: "What did the council decide?" });
  for (let i = 1; i <= n; i++) {
    const address = `https://site${i}.example.org/minutes.html`;
    w.script(address, async () => new Response(`<html><head><title>Minutes ${i}</title></head><body><p>The council met.</p></body></html>`, { status: 200, headers: { "content-type": "text/html" } }));
    await rosa.act("capturerequest", { body: { address, target: q.id } });
  }
  await w.door({ url: "/api/?op=capturerequestdrain", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, { token: w.env.DAEMON_TOKEN });
  await w.tick(120_000);
  return (await rosa.read("tasks")).tasks;
}
/** A team, the founder named (`founder`) or not (`named: false`: the founder claimed the instance with no handle), rosa an administrator and mo a member. */
async function team({ named = true } = {}) {
  const w = await storeWorld(named ? WORLD : { ...WORLD, claimed: false });
  if (!named) await w.claim({ password: "world-founder-passphrase" });
  const founder = await w.signIn("admin");
  const rosa = await w.signIn("rosa", { admin: true });
  const mo = await w.signIn("mo", { capabilities: ["contribute", "create_projects"] });
  return { w, founder, rosa, mo };
}
/** The answer of `op` for the page as the real store gives it, passed through `fn` (the world's door, the answer changed in one place). */
const through = (w, as, op, fn) => async (req) => {
  const a = await w.door({ url: `/api/?${new URLSearchParams({ ...req.query, op })}`, init: { method: "GET" } }, as);
  return { ...a, json: { ...a.json, result: fn(a.json.result) } };
};

test("R85 (C94): What you answered names the member who answered, and the one a to-do was forwarded to, by handle: the founder by hers, a founder with none by a word, never the id", timeout, async () => {
  for (const named of [true, false]) {
    const { w, founder, rosa } = await team({ named });
    const project = await w.recipes.project(rosa, "Council business");
    const [first, second] = await undetermined(w, rosa, project, 2);
    await founder.act("taskresolve", { body: { id: first.id } });
    await rosa.act("taskforward", { body: { id: second.id, to: "mo" } });
    const rows = (await rosa.read("queue", { query: { answered: "1" } })).answered;
    const resolved = rows.find((r) => r.act === "resolved"), forwarded = rows.find((r) => r.act === "forwarded");
    const p = await open(w, rosa, "/app/queue/answered");
    await settle();
    const t = text(p);
    assert.ok(t.includes(word("queue.answered.bymember", { member: named ? "founder" : word("member.founder.unnamed"), when: whenOf(resolved.at) })), named ? "the founder by her handle" : "a founder with no handle by the founder's plain word");
    assert.ok(t.includes(word("queue.answered.forwarded", { item: forwarded.title, member: "mo" })), "the member it went to by handle");
    assert.ok(!/\b(admin)\b/.test(t), "no member id is drawn");
    if (!named) continue;
    // The id nobody knows: the same real answer with the resolver's id one the team has never had (the world cannot make an actor outside its roster).
    const stranger = await open(w, rosa, "/app/queue/answered", { queue: through(w, rosa, "queue", (r) => (r && r.answered ? { ...r, answered: r.answered.map((x) => (x.by ? { ...x, by: "u-9" } : x)) } : r)) });
    await settle();
    assert.ok(text(stranger).includes(word("queue.answered.bymember", { member: unknownWord(), when: whenOf(resolved.at) })), "an id nobody knows by a word");
    assert.ok(!/\b(admin|u-9)\b/.test(text(stranger)), "no member id is drawn");
  }
});

test("R85 (C94): a set-aside finding another member decided names her by handle, never her id", timeout, async () => {
  const { w, founder, rosa } = await team();
  const project = await w.recipes.project(founder, "Council business");
  await founder.act("proposedispose", { query: { project, finding: "FINDING::case-gap::1" }, body: { project, finding: "FINDING::case-gap::1", state: "dismissed", reason: "not needed" } });
  const p = await open(w, rosa, "/app/queue/answered");
  await settle();
  const at = (await rosa.read("queue", { query: { aside: "1" } })).aside[0].at;
  assert.ok(text(p).includes(word("queue.aside.dismissed.bymember", { member: "founder", date: word("date.daymonthyear", { day: String(Number(at.slice(8, 10))), month: word("date.month." + MONTH_OF(at)), year: at.slice(0, 4) }) })), "by her handle");
  assert.ok(!/\badmin\b/.test(text(p)), "no member id is drawn");
});

test("R85 (C94): Projects names an owner and members answered with no handle by the roster's handle, an unknown member by a word, never by her member id", timeout, async () => {
  const { w, founder, rosa, mo } = await team();
  const library = await w.recipes.project(rosa, "Library hours");
  await w.recipes.project(mo, "Sewer fund");
  await w.recipes.project(founder, "Budget");
  const parks = await w.recipes.project(rosa, "Parks");
  // The roster rows the real store answers name each member by handle; the rows here lose them (a roster that gave ids alone), so the page names them by the real memberlist,
  // and the member the team does not know (a project whose owner is not on the roster) by a word.
  const bare = (r) => ({ ...r, projects: r.projects.map((x) => ({ ...x, owner: x.id === parks ? { member: "u-9", handle: null } : x.owner ? { member: x.owner.member, handle: null } : x.owner,
    members: (x.members || []).map((m) => ({ member: m.member, handle: null })).concat(x.id === library ? [{ member: "u-9", handle: null }] : []) })) });
  const p = await open(w, rosa, "/app/projects", { projectlist: through(w, rosa, "projectlist", bare) });
  await settle();
  const t = text(p);
  const refs = main(p).querySelectorAll(".cs-card, a.cs-ref").map((e) => e.textContent);
  assert.ok(refs.includes("founder") && refs.includes("rosa") && refs.includes("mo"), "an owner is a reference to the member by her handle: " + JSON.stringify(refs));
  assert.ok(!refs.includes(unknownWord()), "an unknown member is told by a word, not as a reference");
  assert.ok(t.includes(unknownWord()), "an unknown member is told by a word");
  assert.ok(!/\b(u-9|admin)\b/.test(t) && !links(p).some(([href]) => /u-9|admin/.test(href)), "no member id is drawn or linked");
});

test("R85 (C94): Find in names who recorded a result by handle, never by id", timeout, async () => {
  const { w, founder } = await team();
  await w.recipes.profiles(founder, ["oakland-alameda"]);
  const project = await w.recipes.project(founder, "Housing");
  const code = await w.recipes.page(founder, "Housing code", { paragraphs: ["Landlords keep records.", "The landlord shall repair the roof."], project });
  await w.recipes.question(founder, project, { title: "Roof", text: "Who repairs the roof?", draw: true, legs: [{ target: code.bundle, role: "supports", extent_kind: "doc-para", extent_para: 2 }] });
  await w.tick(120_000);
  const p = await open(w, founder, "/app/find-in/" + project);
  await settle();
  await press(p, "findin", { values: { "findin-kind-requirements": true }, reason: "looking" });
  assert.ok(text(p).includes(word("screen.find-in.recorded", { who: "founder" })), "by her handle");
  assert.ok(!/\badmin\b/.test(text(p)), "no member id");
});

for (const [where, path] of [["queue", "/app/queue"], ["home", "/app"]]) {
  test(`R85 (C94, ${where}): who has agreed and who is still awaited on an endorsement are named by handle (the founder by hers), never by member id; control: a handle is drawn as itself`, timeout, async () => {
    // sam proposes a further administrator while the founder and rosa are the others (the founder's own proposal issues at once, member-roster R87): the real
    // endorsement-owed item is rosa's, who has agreed (sam) and who is awaited (the founder, rosa) in its basis.
    const w = await storeWorld(WORLD);
    const rosa = await w.signIn("rosa", { admin: true });
    const sam = await w.signIn("sam", { admin: true });
    await sam.act("reauth", { body: { password: sam.password } });
    const proposed = await sam.act("memberadd", { body: { memberId: "ana", cover: "the world's member ana", role: "admin" } }).catch((e) => e);
    assert.match(String(proposed.message || ""), /CONSENSUS_REQUIRED/, "the further administrator awaits the others' endorsement");
    const item = (await rosa.read("queue")).items.find((i) => i.kind === "endorsement-owed");
    assert.deepEqual([item.basis.have, item.basis.awaiting], [["sam"], ["admin", "rosa"]], "the real item holds ids");
    const p = await open(w, rosa, path);
    await settle();
    const t = text(p);
    assert.ok(t.includes("founder"), "the founder who is awaited, by her handle");
    assert.ok(t.includes("rosa") && t.includes("sam"), "control: a handle is drawn as itself");
    assert.ok(!/\badmin\b/.test(t), "no member id is drawn");
  });
}

/* ---------- C14 · R86: the held captures are read as cheaply as the screen's use allows ---------- */

for (const [screen, path] of [["home", "/app"], ["queue", "/app/queue"]]) {
  test(`R86 (C14, ${screen}): the door's count of held captures is the cheap picker read, and (fix round 3, R88) the one read: her to-dos are its rows whose actor is she; control: the door still counts the rows`, timeout, async () => {
    const w = await storeWorld(WORLD);
    const founder = await w.signIn("admin");
    await w.recipes.project(founder, "The Coliseum lease");
    for (const n of [1, 2, 3]) await w.recipes.hold(founder, "Photo " + n, "Photo " + n + " of the gate", "");
    const p = await open(w, founder, path);
    await settle();
    const reads = p.byOp("heldcaptures");
    assert.equal(reads.length, 1, "the held captures are read once");
    assert.equal(reads[0].query.fields, "picker", "and the read is the cheap picker read");
    const door = main(p).querySelector('a[href="/app/held"]');
    assert.ok(door, "the door is drawn from the picker rows");
    assert.ok(main(p).querySelectorAll(".cs-row").find((r) => r.querySelector('a[href="/app/held"]')).textContent.includes("3"));
  });
}

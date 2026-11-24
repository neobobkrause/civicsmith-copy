/* screens-investigate R10 (with interface-shell R8–R13 and R16 on this module's screens), on the shell's served page:
 * each screen with each read it draws answered pending, refused and not at all draws that read in its own state, beside
 * the rest; every grade is one mark (the scale's name and the letter) explaining itself; every record item named is a
 * reference with its card; each screen draws exactly its registry acts and the shell serves the module's screens (its
 * R21 check); the module's own words are well formed; after an act the screen reads again what it changed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { interfacePage, RE_POINTS } from "../../../src/interface-shell/index.mjs";
import { WORD_ROWS, word, hasWord } from "../../../src/setup-words/index.mjs";
import { OPS } from "../../../src/op-declarations/index.mjs";
import { createHash } from "node:crypto";
import { refusedIn, silent, pending, ok } from "../interface-shell/harness.mjs";
import { inWorld, openAs, refused, settled, rewrite, readHeld, declareStandard } from "./world.mjs";
import { main, rawKeys, press, fill, SCREENS } from "./fixtures.mjs";
import { theWorld, TIES, changing } from "./universe.mjs";

const REGISTRY = JSON.parse(readFileSync(new URL("./fixtures/registry-43379a1a44.json", import.meta.url), "utf8"));
/* R64 (DEC-438): the Standard's entry as the design file holds it at b1adf4236d, with the five acts of "Whom it binds"; the rest of the registry is the older copy the other screens' tests were written against */
REGISTRY.screens = REGISTRY.screens.map((x) => (x.id === "standard" ? JSON.parse(readFileSync(new URL("./fixtures/registry-standard-b1adf4236d.json", import.meta.url), "utf8")) : x));
/* N1073: no hand list of other modules' ops. The reads a screen makes are those it is seen to send over the scripted plane; each
 * answered pending, refused and not at all must leave the screen standing, and draw its own state where the screen draws one (the
 * reads that only feed a title or a choice draw none). The screen's subject read and the screen's other state-drawn reads are
 * found by the page itself: at least one read per screen draws its state. */
/* The design's own label keys for acts whose words the requirements name (R31, R32, R33, R36, R37). */
const LABELS = { "person:entityalias": "entity.alias.add", "person:aliaswithdraw": "act.owed_aliaswithdraw.label.person", "person:relationdeclare": "entity.relation.declare",
  "person:resolve": "entity.naming.match", "person:resolvetestify": "entity.naming.testify", "person:connect": "entity.connect", "timeline:thread": "progression.thread",
  "timeline:discharge": "progression.discharge", "timeline:proposedispose": "progression.setaside", "timeline:progressiondefine": "progression.define.go",
  "theme:themedeclare": "theme.declare.go", "theme:themeplace": "theme.confirm", "people:entitycreate": "screen.people.add.submit" };


test("R10 a read that answers nothing is drawn empty, never failed (control: a refusal is failed, never empty); R22: ties with none draws its designed empty state, not \"You have listed no tie\"", async () => {
  const { world, me } = await inWorld();
  const p = await openAs(world, me, TIES);
  assert.deepEqual((await me.read("memberties")).ties, [], "the member has declared no tie: the world's own answer");
  assert.ok(main(p).textContent.includes(word("screen.ties.first")), "the designed empty state, naming the first step");
  assert.ok(!main(p).querySelector('[data-state="failed"]'));
  /* a refused read is a fault the real code cannot be made to cause: scripted */
  const q = await openAs(world, me, TIES, { plane: { memberties: refusedIn("SOME_REFUSAL") } });
  assert.ok(!main(q).querySelector('[data-state="empty"]'));
});

test("R10 every grade is drawn as one mark (the scale's name and the letter) explaining itself, on every screen that draws grades", async () => {
  const U = await theWorld();
  /* the store grades no upload: a figure's and an event's capture grade are the one scripted line (a measured capture, K5044 (1)); a post's grade and a visit's are the store's */
  const grade = { timeline: { timeline: changing(U.world, U.me, "timeline", (r) => {
    if (!r.world) return r;
    const w = JSON.parse(JSON.stringify(r.world));
    for (const x of w.items) x.grade = "B";
    return { ...r, world: w };
  }) }, money: { money: changing(U.world, U.me, "money", (r) => (r.fact ? { ...r, fact: { ...r.fact, grade: { ...r.fact.grade, reading: "B" } } } : r)) } };
  for (const id of ["person", "timeline", "money", "calculation"]) {
    const p = await openAs(U.world, U.me, U.PATHS[id], { plane: grade[id] || {} });
    const grades = main(p).querySelectorAll(".cs-grade");
    assert.ok(grades.length > 0, id);
    for (const g of grades) {
      assert.ok(["capture", "connection", "testimony", "subject"].includes(g.getAttribute("data-scale")), id);
      const scale = g.getAttribute("data-scale");
      assert.equal(g.textContent, word("mark.scale." + scale + ".name") + g.textContent.slice(-1), id);
      assert.match(g.textContent, /[A-D]$/, id);
      assert.ok((g.getAttribute("data-tip") || "").includes(word("mark.grade.reading").split(";")[0]), `${id}: the grade explains itself`);
    }
  }
});

test("R10 every record item a screen names is a reference with its card (DEC-160): people and organisations open person, documents their capture", async () => {
  const U = await theWorld();
  for (const id of ["people", "person", "timeline", "money", "calculation", "proceeding", "ties"]) {
    const p = await openAs(U.world, U.me, U.PATHS[id]);
    const refs = main(p).querySelectorAll("a.cs-ref, .cs-card");
    assert.ok(refs.length > 0, id);
    /* the trail's own node in the graph is drawn a card with none (see the REPORTED todo below) */
    for (const r of refs) if (!r.closest(".mk-graph")) assert.ok(r.getAttribute("data-tip"), `${id}: ${r.textContent} carries its card`);
    for (const a of main(p).querySelectorAll('a.cs-ref[href^="/app/person/"]')) assert.match(a.getAttribute("href"), /^\/app\/person\/ENT-/);
  }
  const p = await openAs(U.world, U.me, U.PATHS.people);
  assert.ok(main(p).querySelector(`a.cs-ref[href="/app/person/${U.chen}"]`), "a person's name opens person (interface-shell R47)");
});

test("R10 DEC-160 a trail's own node in the money graph carries its card: every record item a screen names does", async () => {
  const U = await theWorld();
  const p = await openAs(U.world, U.me, U.PATHS.money);
  const node = main(p).querySelectorAll(".mk-graph .cs-card, .mk-graph a.cs-ref");
  assert.ok(node.length > 0, "the graph names the trail");
  for (const r of node) assert.ok(r.getAttribute("data-tip"), `money: ${r.textContent} carries its card`);
});

test("R10 after an act the screen reads again what it changed and draws it (control: a refused act reads nothing again)", async () => {
  const { world, me } = await inWorld();
  const transit = (await me.act("entitycreate", { body: { kind: "institution", label: "East Bay Transit", note: "The transit agency." } })).entity_id;
  const p = await openAs(world, me, TIES);
  assert.equal(p.byOp("memberties").length, 1);
  fill(p, { "tie-who": transit, "tie-note": "East Bay Transit" });
  await press(p, "declaretie");
  await settled(p);
  assert.equal(p.byOp("memberties").length, 2, "read again after the act");
  const held = (await me.read("memberties")).ties;
  assert.equal(held.length, 1, "the tie is held");
  assert.deepEqual([held[0].entity, held[0].note], [transit, "East Bay Transit"]);
  assert.ok(main(p).textContent.includes(held[0].note), "the tie she added, read again");
  /* the real store refuses a tie to a record it does not hold */
  const q = await openAs(world, me, TIES);
  const before = q.byOp("memberties").length;
  const gone = "ENT-2026-9999";
  const why = await refused(world, me, "declaretie", { entity: gone, note: "x" });
  assert.equal(why.ok, false, "the store refuses a tie to an entity it does not hold");
  fill(q, { "tie-who": gone, "tie-note": "x" });
  await press(q, "declaretie");
  await settled(q);
  assert.equal(q.byOp("memberties").length, before);
  assert.ok(main(q).textContent.includes(why.translation || why.why || why.code), "the refusal by its words");
  assert.equal(q.doc.getElementById("tie-note").value, "x", "the form keeps what was typed (interface-shell R13)");
});

test("R10 each screen draws exactly its registry acts, labelled by its words, each an op OPS holds; the shell serves the twelve screens", () => {
  assert.equal(typeof interfacePage(SCREENS), "string", "interface-shell R21's check passes");
  assert.deepEqual(SCREENS.map((s) => s.id), ["people", "person", "explore", "timeline", "money", "calculation", "help", "proceeding", "due-date", "standard", "ties", "theme"]);
  for (const s of SCREENS) {
    const reg = REGISTRY.screens.find((x) => x.id === s.id);
    assert.ok(reg, `${s.id} is a registry screen`);
    /* B14 (K4259): each screen names exactly the acts the registry lists for it (and its owed acts under their op names) */
    const want = reg.acts.map((a) => a.op.replace(/^owed:(\S+).*$/, "$1")).concat((RE_POINTS[s.id] || []).filter((op) => s.acts.some((a) => a.op === op)));
    assert.deepEqual([...new Set(s.acts.map((a) => a.op))].sort(), [...new Set(want)].sort(), s.id);
    for (const a of s.acts) {
      assert.ok(Object.hasOwn(OPS, a.op), `${a.op} in OPS`);
      assert.equal(a.label, LABELS[s.id + ":" + a.op] ? LABELS[s.id + ":" + a.op] : a.op === "stepsource" ? "act.stepsource.label.explore" : `act.${a.op}.label.${s.id}`);
      assert.ok(ADOPTED.includes(a.label) || s.words.some((w) => (typeof w === "string" ? w : w[0]) === a.label), `${a.label} listed`);
    }
  }
});

/* K5173 (HANDOFF B520): the rows UX-DESIGN adopts for this round's causes; the source draws each by key, and each is a `test.todo` until the word table holds it */
const ADOPTED = ["screen.person.expunge.marker", "screen.person.holds.heading", "screen.person.holds.holder", "screen.person.holds.capacity", "screen.person.holds.empty",
  "act.recordline.label.office", "screen.person.holds.through", "act.linecurrentthrough.label.person", "act.linecurrentthrough.does", "screen.timeline.nozone", "screen.calculation.column", "screen.calculation.column.help", "screen.calculation.part", "screen.calculation.part.help",
  ...["implements", "refers_to", "amends", "repeals", "renumbers", "recodifies", "defines", "excepts", "incorporates"].map((k) => "screen.standard.rel.in." + k)];
for (const key of ADOPTED) if (!hasWord(key)) test.todo(`K5173: ${key} is a word the table holds (hasWord)`);

test("R30 the module holds no member-facing English: no SCREEN_WORDS, every screen lists keys only, each key a word setup-words holds (hasWord); what is drawn equals word(key, vars)", async () => {
  const mod = await import("../../../src/screens-investigate/index.mjs");
  assert.equal(mod.SCREEN_WORDS, undefined, "the module exports no rows of English");
  for (const s of SCREENS) {
    assert.equal(new Set(s.words).size, s.words.length, `${s.id}: keys listed once`);
    for (const w of s.words) {
      assert.equal(typeof w, "string", `${s.id}: ${JSON.stringify(w)} is a key, not a row`);
      assert.ok(hasWord(w), `${s.id}: ${w} is a word`);
    }
  }
  /* each key the source names, found by its shape, is a word (the keys a screen reads without listing them too) */
  const dir = new URL("../../../src/screens-investigate/", import.meta.url);
  const SHAPE = /["`]((?:screen|act|connection|mark|state|file|proceeding|column|shell)\.[a-z0-9_.-]*[a-z0-9_])["`]/g;
  for (const f of readdirSync(dir)) {
    const text = readFileSync(new URL(f, dir), "utf8");
    for (const m of text.matchAll(SHAPE)) assert.ok(hasWord(m[1]) || ADOPTED.includes(m[1]), `${f}: ${m[1]} is no word`);
  }
  const U = await theWorld();
  const p = await openAs(U.world, U.me, TIES);
  for (const k of ["screen.ties.why.1", "screen.ties.who.1", "screen.ties.either", "screen.ties.add"]) assert.ok(main(p).textContent.includes(word(k)), k);
  assert.ok(WORD_ROWS.length > 0);
});

test("D29 an answer that says ok and carries a refusal is drawn as the refusal, never as success: a graph, a search and a spot-check read", async () => {
  const refusal = ok({ ok: true, refused: "NO_NODE", why: "No such record." });
  const U = await theWorld();
  const g = await openAs(U.world, U.me, U.PATHS.explore, { plane: { exploregraph: refusal } });
  assert.ok(main(g).querySelector('[data-state="failed"]'), "the graph read");
  assert.ok(!main(g).querySelector(".mk-graph"));
  const s = await openAs(U.world, U.me, U.PATHS.calculation, { plane: { spotcheck: refusal } });
  assert.ok(main(s).querySelector('[data-state="failed"]'), "the spot-check read");
  const p = await openAs(U.world, U.me, U.PATHS.people, { plane: { peopledirectory: rewrite(U.world, U.me, (req, a) => (req.query && req.query.q ? refusal : a)) } });
  fill(p, { "people-q": "chen" });
  await press(p, "search");
  await settled(p);
  assert.ok(main(p).querySelector('[data-state="failed"]'), "the search");
  assert.ok(!main(p).querySelector('[data-state="empty"]'));
});

test("R10 a page whose read never answers is quiet once its other reads have answered: opening it waits for the quiet window, never for the ceiling of rounds (the loading state of a read that never answers does not end)", async () => {
  const U = await theWorld();
  const began = Date.now();
  const p = await openAs(U.world, U.me, U.PATHS.timeline, { plane: { image: pending } });
  const took = Date.now() - began;
  assert.ok(main(p).querySelector('[data-state="loading"]'), "the read that never answers is drawn loading");
  assert.ok(took < 6000, `opened in ${took} ms, not after the 1500-round ceiling (about 16 s)`);
});

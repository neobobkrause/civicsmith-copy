/* reading-guides: the guide in force (R5), the list (R8), the tables and sight (R9), the rows (R11). */
import test from "node:test";
import assert from "node:assert/strict";
import { READING_GUIDES_CHECKS, READING_GUIDES_TABLE_CLASSES, READING_GUIDES_TABLES, GUIDES_MAX, freezeLibrary,
         readingGuidesOps } from "../../../src/reading-guides/index.mjs";
import { world, row, item, ITEMS, ANN, BOB, CY, REV, BOSS, MACHINE } from "./fixture.mjs";

const CIVIC = freezeLibrary([{ id: "GUD-2026-civicsmith000002", kind: "staff_report", origin: "civicsmith", state: "group",
  items: [item("Recommendation", "Look for the staff recommendation")], author: "a writer", reviewed_by: "a reviewer", based_on: null,
  approved_by: "Bob", measured_use: { summary: "measured on 30 staff reports", measured_on: "2026-10-02" } }]);

test("R5 the guide in force: the viewer's own usable guide, else the group's, else Civicsmith's, else none, with its origin", () => {
  const w = world({ civicsmith: CIVIC });
  const at = (viewer) => { const r = w.g.guideFor({ kind: "staff_report", viewer }); return [r.guide?.id ?? null, r.origin]; };
  assert.deepEqual(at(ANN), [CIVIC[0].id, "civicsmith"]);
  const grp = w.groupGuide();
  assert.deepEqual(at(ANN), [grp, "group"]);
  assert.deepEqual(at(CY), [grp, "group"]);
  const mine = w.g.guideDraft({ kind: "staff_report", items: [item("Mine", "Look for my own thing")], by: CY }).guide;
  assert.deepEqual(at(CY), [mine, "group"], "her own usable guide when she asks");
  assert.equal(w.g.guideFor({ kind: "staff_report", viewer: CY }).guide.state, "usable_by_author");
  assert.deepEqual(at(ANN), [grp, "group"], "another's own guide is not in force for her");
  /* the newest of several, by when it last changed */
  const grp2 = w.groupGuide({ items: [item("Second", "Look for the second thing")] });
  assert.deepEqual(at(BOB), [grp2, "group"]);
  w.g.guideRetire({ guide: grp2, reason: "r", by: BOB });
  assert.deepEqual(at(BOB), [grp, "group"], "a retired guide is not in force");
  /* a viewer outside the group sees Civicsmith's alone */
  for (const v of [REV, "stranger", "member:nobody"]) assert.deepEqual(at(v), [CIVIC[0].id, "civicsmith"], v);
  /* a machine and an internal call see the group's */
  assert.deepEqual(at(MACHINE), [grp, "group"]);
  assert.deepEqual(at(undefined), [grp, "group"]);
  /* none for a kind with none, and for anything not a kind */
  assert.deepEqual(w.g.guideFor({ kind: "policy", viewer: ANN }), { ok: true, kind: "policy", guide: null, origin: null, withheld: [] });
  assert.equal(w.g.guideFor({ kind: "court_order", viewer: ANN }).guide, null);
});

test("R5 never throws, whatever it is handed", () => {
  const w = world();
  for (const a of [undefined, null, 3, "x", [], { kind: {} }, { kind: "staff_report", viewer: {} }, { get kind() { throw new Error("x"); } }])
    assert.doesNotThrow(() => { const r = w.g.guideFor(a); assert.equal(r.ok, true); assert.equal(r.guide, null); });
});

test("R8 the list: the guides the viewer may see, Civicsmith's first, filtered by kind and state, at most 200, truncated", () => {
  const w = world({ civicsmith: CIVIC });
  const own = w.draft();
  const grp = w.groupGuide();
  const ids = (a) => w.g.guidesOf(a).guides.map((g) => g.id);
  assert.deepEqual(ids({ viewer: ANN }), [CIVIC[0].id, own, grp]);
  assert.deepEqual(ids({ viewer: BOB, state: "usable_by_author" }), [own], "every group guide is the group's to see, any state");
  assert.deepEqual(ids({ viewer: ANN, state: "group" }), [CIVIC[0].id, grp]);
  assert.deepEqual(ids({ viewer: ANN, kind: "policy" }), []);
  assert.deepEqual(ids({ viewer: REV }), [CIVIC[0].id], "outside the group: Civicsmith's alone");
  assert.deepEqual(ids({ viewer: "stranger" }), [CIVIC[0].id]);
  assert.deepEqual(ids({ viewer: MACHINE }), [CIVIC[0].id, own, grp]);
  assert.deepEqual(ids({ viewer: ANN, kind: "court_order" }), []);
  assert.deepEqual(ids({ viewer: ANN, state: "lost" }), []);
  assert.equal(w.g.guidesOf({ viewer: ANN }).truncated, false);
  assert.deepEqual(w.g.guidesOf({ viewer: ANN, limit: 2 }), { ok: true, guides: w.g.guidesOf({ viewer: ANN }).guides.slice(0, 2), truncated: true });
  for (let i = 0; i < GUIDES_MAX; i++)
    w.st.sql.exec(`INSERT INTO reading_guides (guide_id, kind, origin, items_json, state, author, created_at, updated_at)
                   VALUES (?, 'policy', 'group', ?, 'group', 'ann', '2026-10-10T00:00:00Z', '2026-10-10T00:00:00Z')`,
      `GUD-2026-${String(i).padStart(16, "0")}`, JSON.stringify(ITEMS));
  const all = w.g.guidesOf({ viewer: ANN, limit: 1000 });
  assert.equal(all.guides.length, GUIDES_MAX, "a limit is never raised past 200");
  assert.equal(all.truncated, true);
  assert.doesNotThrow(() => w.g.guidesOf({ get viewer() { throw new Error("x"); } }));
});

test("R9 the tables are declared through record-core.declareTable, sight the group's, and purged with the store", () => {
  const w = world();
  const decl = w.record.declaredTables().filter((d) => d.module === "reading-guides");
  assert.deepEqual(decl.map((d) => d.name ?? d.table).sort(), [...READING_GUIDES_TABLES].sort());
  for (const e of READING_GUIDES_TABLE_CLASSES) {
    assert.equal(e.sight, "group", e.name);
    assert.equal(e.purge, "clear", e.name);
  }
  assert.deepEqual(READING_GUIDES_TABLE_CLASSES.map((e) => [e.name, e.version_chain]),
    [["reading_guides", false], ["reading_guide_history", true], ["reading_guide_proposals", false]]);
  w.groupGuide();
  w.g.guidePropose({ kind: "policy", items: ITEMS, run: "R", by: MACHINE });
  const p = w.record.purge();
  for (const t of READING_GUIDES_TABLES) assert.equal(w.count(t), 0, t);
  assert.ok(p.ok !== false);
  /* negative control: a second declaration of the same tables is refused, so no other module holds them */
  const again = w.record.declareTable("other", READING_GUIDES_TABLE_CLASSES.map((e) => ({ ...e, keys: [...e.keys] })));
  assert.equal(again.ok, false);
  assert.equal(again.reason, "TABLE_DECLARED");
});

test("R11 each refusal carries its row in the module's own checks.mjs, a new family C-144, numbered in order", () => {
  const codes = Object.keys(READING_GUIDES_CHECKS);
  assert.equal(codes.length, 19);
  codes.forEach((code, i) => {
    const r = READING_GUIDES_CHECKS[code];
    assert.equal(r.check, `C-144.${i + 1}`, code);
    assert.deepEqual(Object.keys(r).sort(), ["check", "translation", "where"]);
    assert.match(r.where, /^src\/reading-guides\/(index|check)\.mjs \w+ > is-guide-[a-z-]+$/, code);
    assert.match(r.translation, /Nothing was (written|sent)\.$/, code);
  });
  assert.equal(new Set(Object.values(READING_GUIDES_CHECKS).map((r) => r.where)).size, codes.length, "one site per code");
  assert.ok(Object.isFrozen(READING_GUIDES_CHECKS));
});

const PLACES = /\b(Oakland|Alameda|California|Port Ellery|Berkeley|San Francisco)\b/i;

test("R11 every code is answered by its act, with its row, naming no place (each reached at the interface)", () => {
  const w = world({ civicsmith: CIVIC });
  const reached = new Set();
  const see = (r) => {
    row(r, r.reason);
    reached.add(r.reason);
    assert.doesNotMatch(`${r.translation} ${r.detail}`, PLACES, "no place is named in outward text");
  };
  const own = w.draft(), grp = w.groupGuide();
  see(w.g.guideDraft({ kind: "staff_report", items: [item("L", "Ask the model")], by: ANN }));
  see(w.g.guideDraft({ kind: "staff_report", items: [], by: ANN }));
  see(w.g.guideDraft({ kind: "staff_report", items: ITEMS, by: MACHINE }));
  see(w.g.guideDraft({ kind: "x", items: ITEMS, by: ANN }));
  see(w.g.guideRead({ guide: "GUD-2026-zzzzzzzzzzzzzzzz", viewer: ANN }));
  see(w.g.guideRetire({ guide: CIVIC[0].id, reason: "r", by: ANN }));
  see(w.g.guideReview({ guide: own, verdict: "approve", by: ANN }));
  see(w.g.guideReview({ guide: own, verdict: "maybe", by: BOB }));
  see(w.g.guideReview({ guide: own, verdict: "refuse", by: BOB }));
  see(w.g.guideReview({ guide: grp, verdict: "approve", by: CY }));
  see(w.g.guideOffer({ guide: own, by: ANN }));
  see(w.g.guideAdopt({ bytes: "x", by: ANN }));
  see(world({ slug: null }).g.guideOffer({ guide: "GUD-2026-zzzzzzzzzzzzzzzz", by: ANN }));
  const n = world({ slug: null }); see(n.g.guideOffer({ guide: n.groupGuide(), by: ANN }));
  see(w.g.guideRetire({ guide: grp, reason: "r", by: ANN }));
  w.g.guideRetire({ guide: grp, reason: "r", by: BOSS }); see(w.g.guideRetire({ guide: grp, reason: "r", by: BOB }));
  see(w.g.guideDraft({ kind: "staff_report", items: ITEMS, based_on: "GUD-2026-zzzzzzzzzzzzzzzz", by: ANN }));
  see(w.g.guidePropose({ kind: "policy", items: ITEMS, run: "R", by: ANN }));
  see(w.g.guidePropose({ kind: "policy", items: ITEMS, run: "", by: MACHINE }));
  see(w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: [{ route: "Ask the Town Clerk" }], by: ANN }));
  assert.deepEqual([...reached].sort(), Object.keys(READING_GUIDES_CHECKS).sort());
});

test("R2–R8 the ops this module hands the control plane: by in the body, viewer from the URL", () => {
  const w = world();
  const url = (q) => new URL(`https://x/?${q}`);
  const d = readingGuidesOps(w.g, url(""), { kind: "staff_report", items: ITEMS, by: ANN }).guidedraft();
  assert.equal(d.ok, true);
  assert.equal(readingGuidesOps(w.g, url(`kind=staff_report&viewer=${ANN}`), { viewer: "stranger" }).guidefor().guide.id, d.guide);
  assert.equal(readingGuidesOps(w.g, url(`viewer=stranger`), { viewer: ANN }).guides().guides.length, 0, "a body cannot set the viewer");
  assert.equal(readingGuidesOps(w.g, url(`guide=${d.guide}&viewer=${ANN}`), {}).guide().guide.id, d.guide);
  assert.deepEqual(Object.keys(readingGuidesOps(w.g, url(""), {})).sort(),
    ["guide", "guideadopt", "guidedraft", "guidefor", "guideoffer", "guideproposals", "guidepropose", "guideproposetocivicsmith",
     "guideretire", "guidereview", "guides", "procedureguides"]);
});

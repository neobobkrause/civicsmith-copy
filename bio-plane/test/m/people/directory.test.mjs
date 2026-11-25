/* people's directory at its interface: R37 (T47; DEC-203 (1)–(4), K3061 D8, K3104), the people and organisations the
   record follows, with the documents, questions and projects naming each among those the viewer may see. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, ANN, OUT } from "./fixture.mjs";
import { peopleOps, DIRECTORY_DEFAULT, DIRECTORY_MAX } from "../../../src/people/index.mjs";

const span = (from, to) => ({ from, to });

/* A name in a captured document tied to an entity (entities R12's testimony), the reading's reference held in `bundle`
   (the capture's own when not given); the capture registered at `registered` when given. */
function name(w, entity, c, { bundle = null, registered = null } = {}) {
  const ref = `name:${entity}`;
  w.st.sql.exec(`INSERT OR IGNORE INTO reading_refs (capture_sha, bundle_id, ref, ref_kind, ref_key, label) VALUES (?,?,?,?,?,?)`,
                c.captureSha, bundle || c.bundle, ref, "name", entity, entity);
  const r = w.real.testify({ captureSha: c.captureSha, ref, entityId: entity, basis: "the test names them", resolvedBy: ANN });
  assert.equal(r.ok, true, JSON.stringify(r));
  if (registered) w.st.sql.exec(`UPDATE register SET registered=? WHERE capture_sha=?`, registered, c.captureSha);
}

/* The mockup's record, small: a director, his department and its office; a company named only inside the fenced
   project; a judge named in nothing. */
function record() {
  const w = world();
  const chen = w.person("Lee Chen", ["L. Chen"]);
  const works = w.entity("institution", "Public Works Department", { sector: "government" });
  const director = w.entity("office", "Director of Public Works");
  w.line("post_in", director, works, span("2020-01-01", "2030-12-31"));
  w.line("holds", chen, director, span("2022-03-01", "2027-03-01"), { title: "Director of Public Works" });
  const bayline = w.entity("institution", "Bayline Properties", { sector: "company" });
  const ferris = w.person("M. Ferris");
  const open = w.capture("council report"), fenced = w.capture("lease file", { fenced: true });
  const asked = w.capture("question attachment"), q = w.question();
  name(w, chen, open, { registered: "2026-02-20T00:00:00Z" });
  name(w, chen, fenced, { registered: "2026-02-25T00:00:00Z" });
  name(w, chen, asked, { bundle: q, registered: "2025-12-01T00:00:00Z" });
  name(w, works, open);
  name(w, bayline, w.capture("lease schedule", { fenced: true }), { registered: "2025-06-01T00:00:00Z" });
  return { w, chen, works, director, bayline, ferris, open, fenced, q, project: w.project() };
}
const rowOf = (r, id) => r.rows.find((x) => x.entity === id);
const all = (w, args) => w.p.peopleDirectory({ limit: DIRECTORY_MAX, ...args });

test("R37 peopleDirectory answers the people and organisations the record follows (persons and the organisation kinds; never an office, any other kind or the group's members), each row {entity, kind, name, today, documents, questions, projects, newest_added, mine}", () => {
  const { w, chen, works, director, bayline, ferris } = record();
  const source = w.entity("source", "A tipster");
  const r = all(w, { viewer: ANN });
  assert.equal(r.ok, true);
  const ids = r.rows.map((x) => x.entity);
  for (const id of [chen, works, bayline, ferris]) assert.ok(ids.includes(id), id);
  assert.ok(!ids.includes(director), "an office is a post, never a row");
  assert.ok(!ids.includes(source), "only the person and organisation kinds are rows");
  assert.ok(r.rows.every((x) => x.kind === "person" || ["institution", "body", "movement"].includes(x.kind)));
  assert.ok(!r.rows.some((x) => /^(member:)?(ann|out|boss|admin)$/.test(x.entity)), "the team's members are never rows");
  const c = rowOf(r, chen);
  assert.deepEqual(Object.keys(c).sort(), ["documents", "entity", "kind", "mine", "name", "newest_added", "projects", "questions", "today"]);
  assert.equal(c.name, "Lee Chen");
  assert.equal(c.today.posts.length, 1);
  assert.equal(c.today.posts[0].title, "Director of Public Works");
  assert.deepEqual(c.today.posts[0].office, { entity: director, label: "Director of Public Works" });
  assert.deepEqual(c.today.posts[0].body, { entity: works, label: "Public Works Department" });
  assert.deepEqual(rowOf(r, works).today, { kind: "institution", sector: "government", note: "a subject the test registers",
                                             note_by: ANN, machine: false });
  assert.deepEqual([c.documents, c.questions, c.projects, c.newest_added, c.mine], [3, 1, 1, "2026-02-25T00:00:00.000Z", true]);
  const f = rowOf(r, ferris);
  assert.deepEqual([f.documents, f.questions, f.projects, f.newest_added, f.mine], [0, 0, 0, null, false], "named in nothing yet");
  assert.equal(w.p.peopleDirectory({ viewer: null }).reason, "NO_VIEWER", "fails closed with no viewer");
});

test("R37 counts only what the viewer may see: a project hidden from the viewer counts as nothing and is never named (control: the same mentions counted for a participant)", () => {
  const { w, chen, bayline, project } = record();
  const ann = all(w, { viewer: ANN }), out = all(w, { viewer: OUT });
  const a = rowOf(ann, chen), o = rowOf(out, chen);
  assert.deepEqual([a.documents, a.projects], [3, 1], "control: the participant counts the fenced document and its project");
  assert.deepEqual([o.documents, o.questions, o.projects, o.mine], [2, 1, 0, false], "the outsider counts neither");
  assert.equal(o.newest_added, "2026-02-20T00:00:00.000Z", "the newest it may see");
  const b = rowOf(out, bayline);
  assert.deepEqual([b.documents, b.projects, b.newest_added], [0, 0, null]);
  assert.deepEqual([rowOf(ann, bayline).documents, rowOf(ann, bayline).projects], [1, 1]);
  assert.ok(!JSON.stringify(out).includes(project), "the hidden project is never named");
  const named = w.p.peopleDirectory({ namedIn: project, viewer: OUT });
  assert.deepEqual([named.ok, named.rows.length, named.following], [true, 0, 0]);
  assert.ok(!JSON.stringify(named).includes(project));
  assert.equal(w.p.peopleDirectory({ namedIn: project, viewer: ANN }).following, 2, "control: the participant's project keeps its two");
});

test("R37 each filter: q (a name, a name they are also known by, an office held), show, office (a body), namedIn (any, mine, one project), since (30, 90, 365 days)", () => {
  const { w, chen, works, bayline, ferris, project } = record();
  const ids = (args) => all(w, { viewer: ANN, ...args }).rows.map((x) => x.entity).sort();
  assert.deepEqual(ids({ q: "lee chen" }), [chen]);
  assert.deepEqual(ids({ q: "L. Chen" }), [chen], "the alias match (R37 q)");
  assert.deepEqual(ids({ q: "director of public" }), [chen], "an office held");
  assert.deepEqual(ids({ q: "Public Works" }), [chen, works].sort(), "the body's name and the office it holds");
  assert.deepEqual(ids({ q: "Alvarez" }), []);
  const people = ids({ show: "people" }), orgs = ids({ show: "organisations" });
  assert.ok(people.includes(chen) && people.includes(ferris) && !people.includes(works));
  assert.ok(orgs.includes(works) && orgs.includes(bayline) && !orgs.includes(chen));
  assert.deepEqual(ids({ show: "both" }), ids({}));
  assert.deepEqual(ids({ office: works }), [chen], "holding an office in that body");
  assert.deepEqual(ids({ office: bayline }), []);
  assert.deepEqual(ids({ namedIn: "mine" }), [chen, bayline].sort());
  assert.deepEqual(ids({ namedIn: project }), [chen, bayline].sort());
  assert.deepEqual(all(w, { namedIn: "mine", viewer: OUT }).rows, [], "an outsider works on no project");
  assert.ok(ids({ namedIn: "any" }).includes(ferris), "any project lists those named in none");
  /* since: the fixture's clock reads 2026-03-02 */
  assert.deepEqual(ids({ since: 30 }), [chen, works].sort(), "both named in the council report of 20 February");
  assert.ok(ids({ since: "90" }).includes(chen) && !ids({ since: 90 }).includes(bayline));
  assert.ok(ids({ since: 365 }).includes(bayline) && !ids({ since: 365 }).includes(ferris));
  /* a post that has ended is not held today: neither the office filter nor q finds it */
  const old = w.person("Ana Ruiz");
  w.line("holds", old, w.entity("office", "Deputy Director"), span("2010-01-01", "2012-01-01"));
  assert.deepEqual(ids({ q: "Deputy Director" }), []);
  assert.deepEqual(rowOf(all(w, { viewer: ANN }), old).today.posts, []);
});

test("R37 a malformed argument is refused naming it, and nothing is read", () => {
  const { w, director } = record();
  const refused = (args, argument) => {
    const r = w.p.peopleDirectory({ viewer: ANN, ...args });
    assert.deepEqual([r.ok, r.reason, r.argument], [false, "BAD_ARGUMENT", argument], JSON.stringify(args));
  };
  refused({ q: "x".repeat(201) }, "q");
  refused({ q: 7 }, "q");
  refused({ show: "parcels" }, "show");
  refused({ office: "ENT-2026-9999" }, "office");
  refused({ office: director }, "office");
  refused({ namedIn: "   " }, "namedIn");
  refused({ since: 7 }, "since");
  refused({ limit: 0 }, "limit");
  refused({ limit: 201 }, "limit");
  refused({ limit: "x" }, "limit");
  refused({ cursor: "not-a-cursor" }, "cursor");
  /* controls: each at its edge is answered */
  for (const args of [{ q: "x".repeat(200) }, { limit: 1 }, { limit: "200" }, { since: "30" }, { show: "people" }])
    assert.equal(w.p.peopleDirectory({ viewer: ANN, ...args }).ok, true, JSON.stringify(args));
  assert.equal(w.p.peopleDirectory({ viewer: ANN }).limit, DIRECTORY_DEFAULT);
});

test("R37 the order: named in the viewer's projects first, then newest added first, then by entity id; following and in_your_projects are totals over the filter", () => {
  const { w, chen, works, bayline, ferris } = record();
  const r = all(w, { viewer: ANN });
  const ids = r.rows.map((x) => x.entity);
  assert.deepEqual(ids.slice(0, 2), [chen, bayline], "mine first, newest added first");
  assert.ok(ids.indexOf(works) < ids.indexOf(ferris), "a named row before one never named");
  const rest = r.rows.slice(2);
  for (let i = 1; i < rest.length; i++) {
    const [a, b] = [rest[i - 1], rest[i]];
    assert.ok(!a.mine && !b.mine);
    if (a.newest_added === b.newest_added) assert.ok(a.entity < b.entity, "ties by entity id");
    else assert.ok(b.newest_added === null || (a.newest_added !== null && a.newest_added > b.newest_added));
  }
  assert.equal(r.following, r.rows.length);
  assert.equal(r.in_your_projects, 2);
  const people = w.p.peopleDirectory({ show: "people", limit: 1, viewer: ANN });
  assert.equal(people.rows.length, 1);
  assert.equal(people.following, all(w, { show: "people", viewer: ANN }).rows.length, "a total over the filter, not the page");
  assert.equal(people.in_your_projects, 1);
});

test("R37 pages by cursor, at most limit rows, with truncated: paging to the end never skips or repeats a row", () => {
  const { w } = record();
  for (let i = 0; i < 9; i++) {
    const p = w.person(`Person ${i}`);
    if (i % 3 === 0) name(w, p, w.capture(`doc ${i}`), { registered: `2026-01-0${i + 1}T00:00:00Z` });
  }
  const whole = all(w, { viewer: ANN });
  assert.equal(whole.truncated, false);
  assert.equal(whole.cursor, null);
  for (const limit of [1, 2, 4]) {
    const seen = [];
    let cursor = null, pages = 0;
    for (;;) {
      const r = w.p.peopleDirectory({ limit, cursor, viewer: ANN });
      assert.ok(r.rows.length <= limit);
      assert.equal(r.following, whole.following);
      seen.push(...r.rows);
      pages++;
      if (!r.truncated) { assert.equal(r.cursor, null); break; }
      assert.equal(r.rows.length, limit);
      cursor = r.cursor;
    }
    assert.deepEqual(seen, whole.rows, `limit ${limit}: every row once, in order`);
    assert.equal(pages, Math.ceil(whole.rows.length / limit));
  }
});

test("R37 writes nothing, and op=peopledirectory answers what the read answers, its viewer stamped in the query", () => {
  const { w, chen } = record();
  const census = () => JSON.stringify(w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .map(({ name: t }) => [t, w.rows(`SELECT COUNT(*) AS n FROM "${t}"`)[0].n]));
  const before = census();
  all(w, { viewer: ANN }); all(w, { viewer: OUT, q: "chen", since: 30, namedIn: "mine" });
  assert.equal(census(), before);
  const url = (qs) => new URL(`https://plane.example/?${qs}`);
  const viaOp = peopleOps(w.p, url(`viewer=${encodeURIComponent(ANN)}&q=chen&show=people&limit=5`), null).peopledirectory();
  assert.deepEqual(viaOp, w.p.peopleDirectory({ q: "chen", show: "people", limit: 5, viewer: ANN }));
  assert.equal(viaOp.rows[0].entity, chen);
  assert.equal(peopleOps(w.p, url(""), null).peopledirectory().ok, false, "no stamped viewer: fails closed");
});

test("R38 an organisation row answers in today, beside note, note_by (the entity's declared_by as entities holds it) and machine (true exactly when that author is a machine identity): a body setup's seeding declared answers machine: true; control: a body a member registered answers that member's stamp and machine: false; a person row is unchanged", () => {
  const { w, chen, works } = record();
  /* instance-setup R50: setup's seeding declares as a machine identity */
  const seed = w.entities.createEntity({ kind: "body", label: "City Council", note: "seeded at setup", declaredBy: "class:setup" });
  assert.equal(seed.ok, true, JSON.stringify(seed));
  const daemon = w.entities.createEntity({ kind: "institution", label: "Port Authority", note: "seeded", declaredBy: "class:daemon" });
  const r = all(w, { viewer: ANN });
  assert.deepEqual(rowOf(r, seed.entity_id).today, { kind: "body", sector: w.real.readEntity({ entityId: seed.entity_id }).entity.sector,
                                                     note: "seeded at setup", note_by: "class:setup", machine: true });
  assert.deepEqual([rowOf(r, daemon.entity_id).today.note_by, rowOf(r, daemon.entity_id).today.machine], ["class:daemon", true]);
  /* control: a member's words */
  assert.deepEqual([rowOf(r, works).today.note_by, rowOf(r, works).today.machine], [ANN, false]);
  for (const x of r.rows.filter((x) => x.kind !== "person")) {
    assert.equal(x.today.note_by, w.real.readEntity({ entityId: x.entity }).entity.declared_by, x.entity);
    assert.equal(typeof x.today.machine, "boolean");
  }
  /* a person row is unchanged: its posts only */
  assert.deepEqual(Object.keys(rowOf(r, chen).today), ["posts"]);
  /* the outsider reads the same author: the registry is group-wide */
  assert.deepEqual(rowOf(all(w, { viewer: OUT }), seed.entity_id).today, rowOf(r, seed.entity_id).today);
});

/* contradiction R58 (the connection owner; connection-grammar R2, R6–R9; K1487) and R59 (the tables declared
   explicitly; record-core R21), driven at the module's interface and through connection-grammar's registry and
   battery. "In tension with" is undated (a candidate states no dates), so, per K1563 (2), the battery's only failure is
   its inapplicable `in` check, and R6's date rule is tested here directly. */
import test from "node:test";
import assert from "node:assert/strict";
import { word } from "../../../src/setup-words/index.mjs";
import { world, MACHINE, OUTSIDER } from "./fixture.mjs";
import { seeded, cand, RUN, PRINCIPAL, IQ, INFO, M1 } from "./seed.mjs";
import { defaultRegistry, ownerConformance, derivedId, LOWEST_GRADE, BOUNDS } from "../../../src/connection-grammar/index.mjs";
import { CONNECTION_OWNER, CONNECTION_KIND, CONNECTION_KINDS, OWNER_REGISTRATION, ownerNeighbours, CONTRADICTION_TABLES,
         Contradiction } from "../../../src/contradiction/index.mjs";

const AT = "2026-10-06";
const read = (w, node, extra = {}) => w.c.neighbours({ node, kinds: null, at: AT, page: null, viewer: M1, scope: null, ...extra });

test("R58: registered once at load into the plane's registry, owner contradiction, one kind 'in tension with', class derived", () => {
  assert.deepEqual(OWNER_REGISTRATION, { ok: true, owner: "contradiction" });
  assert.deepEqual([CONNECTION_OWNER, CONNECTION_KIND], ["contradiction", "in_tension_with"]);
  assert.deepEqual(defaultRegistry.kindOf("in_tension_with"), { owner: "contradiction", word: word("contradiction.word.tension"), class: "derived" });
  assert.deepEqual(defaultRegistry.owners().find((o) => o.owner === "contradiction").kinds, CONNECTION_KINDS.map((k) => ({ ...k })));
  /* a second registration is the registry's to refuse */
  assert.equal(defaultRegistry.registerOwner({ owner: "contradiction", kinds: [...CONNECTION_KINDS], neighbours: ownerNeighbours }).refused,
               "OWNER_DUPLICATE");
});

test("R58: each candidate on a side's node — an inquiry or a document (a money fact once K6 is shown) — is one derived connection between its sides' nodes, its id derivedId, its candidate named, labelled machine work, graded the lowest grade, undetermined at any date", () => {
  const w = seeded();
  const k2 = cand(w, "K2", "record");
  const k4 = cand(w, "K4", "world");
  const k1 = cand(w, "K1", "undetermined");
  /* K2: two claims, presented at their inquiries */
  const a = read(w, IQ.a);
  assert.equal(a.items.length, 1);
  const c = a.items[0];
  assert.deepEqual([c.from, c.to, c.kind, c.owner, c.candidate, c.key, c.weight, c.state], [IQ.a, IQ.b, CONNECTION_KIND, CONNECTION_OWNER, k2, "K2", "duty", "open"]);
  assert.deepEqual(defaultRegistry.checkConnection(c), { ok: true });
  const row = w.one(`SELECT at FROM contradiction_candidates WHERE candidate=?`, k2);
  assert.equal(c.id, derivedId({ kind: CONNECTION_KIND, from: IQ.a, to: IQ.b, as_of: row.at, method: `contradiction K2: candidate ${k2}` }));
  assert.deepEqual(c.derived.inputs[0].candidate, k2);
  assert.deepEqual(c.grade, { assertion: LOWEST_GRADE, ends: [LOWEST_GRADE, LOWEST_GRADE] });
  assert.deepEqual([c.evidence, c.machine_work, c.judgement.origin, c.judgement.label], [[], true, "machine", "record"]);
  assert.equal(c.label, undefined);
  assert.deepEqual(c.undetermined.why, { key: "contradiction.undated_why", vars: {} });
  assert.deepEqual(c.valid, { from: null, to: null, precision: "day", zone: "UTC" });
  /* K4 and K1: passages, presented at the documents they are filed in */
  const doc = read(w, INFO.a).items;
  assert.deepEqual(doc.map((i) => i.candidate).sort(), [k1, k4].sort());
  assert.ok(doc.every((i) => [i.from, i.to].sort().join() === [INFO.a, INFO.b].sort().join()));
  for (const i of doc) assert.deepEqual(defaultRegistry.checkConnection(i), { ok: true });
  /* nothing on a node no candidate reaches; a kind not asked answers none */
  assert.deepEqual(read(w, IQ.c), { items: [] });
  assert.deepEqual(read(w, IQ.a, { kinds: ["mentioned_together"] }), { items: [] });
  /* K6: two money facts; a K6 candidate is withheld until its prompt arm is measured (K1601), so it is no connection */
  const m = world();
  m.runs.set(RUN, { status: "running", principal: PRINCIPAL });
  const MA = "MNY-2026-aaaaaaaaaaaaaaaa", MB = "MNY-2026-bbbbbbbbbbbbbbbb";
  m.fact(MA); m.fact(MB, { amount: "150" });
  const p = m.c.pairs({ key: "K6", viewer: MACHINE }).pairs[0];
  const id = m.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MACHINE, caller: PRINCIPAL,
                           proposals: [{ key: "K6", a: p.a, b: p.b, label: "world", reason: "r" }] }).candidates[0].candidate;
  assert.match(id, /^[0-9a-f]{64}$/);
  assert.deepEqual([read(m, MA), read(m, MB)], [{ items: [] }, { items: [] }]);
});

test("R58, R24, R26: a not_shown candidate and a dismissed one are not connections; a resolved one still is, with its state", () => {
  const w = seeded();
  cand(w, "K2", "precision");
  assert.deepEqual(read(w, IQ.a), { items: [] });
  const lead = cand(w, "K4", "world");
  assert.equal(read(w, INFO.a).items.length, 1);
  assert.equal(w.c.dismiss({ candidate: lead, reason: "not_same_matter", viewer: M1, author: M1 }).ok, true);
  assert.deepEqual(read(w, INFO.a), { items: [] });
  const w2 = seeded();
  const duty = cand(w2, "K2", "record");
  w2.c.clarify({ candidate: duty, choice: "one_wrong", wrongSide: "a", reason: "misread", viewer: M1, author: M1 });
  assert.deepEqual(read(w2, IQ.a).items.map((i) => i.state), ["resolved"]);
});

test("R58, connection-grammar R7: a candidate whose side the viewer may not see is neither returned nor counted; a missing viewer is refused", () => {
  const w = seeded();
  w.inquiry("PROJ-2026-0009-h", { subject: "E1", project: true });
  w.version("PROJ-2026-0009-h", "v1", { claim: "the fee held" });
  const pairs = w.c.pairs({ key: "K2", viewer: MACHINE }).pairs;
  for (const p of pairs) w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MACHINE, caller: PRINCIPAL,
                                       proposals: [{ key: "K2", a: p.a, b: p.b, label: "record", reason: "r" }] });
  assert.equal(read(w, IQ.a, { viewer: M1 }).items.length, 2);
  assert.equal(read(w, IQ.a, { viewer: OUTSIDER }).items.length, 1);
  assert.deepEqual(read(w, "PROJ-2026-0009-h", { viewer: OUTSIDER }), { items: [] });
  for (const viewer of [undefined, null, ""]) assert.equal(read(w, IQ.a, { viewer }).refused, "VIEWER_MISSING");
  /* an unrecognised viewer sees nothing */
  assert.deepEqual(read(w, IQ.a, { viewer: "somebody" }), { items: [] });
});

test("R58: through the registry — the host is passed through to its instance; with none, the isolate's one instance, else OWNER_HOST_AMBIGUOUS; every answer conforms", () => {
  const w = seeded();
  cand(w, "K2", "record");
  const r = defaultRegistry.neighbours({ owner: "contradiction", node: IQ.a, at: AT, viewer: M1, scope: null, host: w.host });
  assert.equal(r.items.length, 1, JSON.stringify(r).slice(0, 300));
  assert.equal(ownerNeighbours({ node: IQ.a, at: AT, viewer: M1, scope: null, host: w.host.storage }).items.length, 1);
  /* several records are open in this test isolate, so a read naming no host cannot say whose it reads */
  assert.equal(ownerNeighbours({ node: IQ.a, at: AT, viewer: M1, scope: null }).refused, "OWNER_HOST_AMBIGUOUS");
  assert.equal(ownerNeighbours({ node: IQ.a, at: AT, viewer: M1, scope: null, host: { storage: {} } }).refused, "OWNER_HOST_AMBIGUOUS");
});

test("R58, connection-grammar R6: paging is stable and complete, and a node over the hub bound is named by its size with no items", () => {
  const w = seeded();
  /* many K4 candidates on one document: each a passage of capA against a passage of another capture on E1 */
  for (let i = 0; i < 5; i++) {
    const info = `INFO-2026-01${String(i).padStart(2, "0")}-x`;
    w.content(`cx${i}`, `capX${i}`, info);
    w.leg(IQ.c, 10 + i, "supports", { content: `cx${i}`, target: info });
    w.resolution(`capX${i}`, info, "E1");
    w.reading(`capX${i}`, info, { contentType: `kind${i}` });
  }
  for (const p of w.c.pairs({ key: "K4", viewer: MACHINE }).pairs)
    w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MACHINE, caller: PRINCIPAL, proposals: [{ key: "K4", a: p.a, b: p.b, label: "world", reason: "r" }] });
  const all = read(w, INFO.a).items;
  assert.ok(all.length >= 5);
  assert.deepEqual(all.map((i) => i.id), [...all.map((i) => i.id)].sort());
  const first = read(w, INFO.a, { page: { after: all[1].id } }).items;
  assert.deepEqual(first.map((i) => i.id), all.slice(2).map((i) => i.id));
  assert.equal(BOUNDS.fanout, 1000);
  /* two identical calls give identical answers */
  assert.deepEqual(read(w, INFO.a), read(w, INFO.a));
});

test("R58, connection-grammar R9: the owner-conformance battery over this module's fixture fails only its inapplicable `in` check (an undated kind; K1563 (2))", () => {
  const w = seeded();
  const shown = cand(w, "K4", "world");
  cand(w, "K1", "undetermined");
  /* a fenced candidate: a K4 pair whose other passage is filed in a project the outsider does not take part in */
  w.inquiry("PROJ-2026-0009-h", { project: true });
  w.content("ch", "capH", "PROJ-2026-0009-h");
  w.leg(IQ.c, 5, "supports", { content: "ch", target: "PROJ-2026-0009-h" });
  w.resolution("capH", "PROJ-2026-0009-h", "E1");
  w.reading("capH", "PROJ-2026-0009-h", { contentType: "memo" });
  const fencedPair = w.c.pairs({ key: "K4", viewer: MACHINE }).pairs.find((p) => [p.a.capture_sha, p.b.capture_sha].includes("capH")
                                                                            && [p.a.capture_sha, p.b.capture_sha].includes("capA"));
  const fenced = w.c.propose({ run: RUN, proposedBy: "class:ai/t", viewer: MACHINE, caller: PRINCIPAL,
    proposals: [{ key: "K4", a: fencedPair.a, b: fencedPair.b, label: "world", reason: "r" }] }).candidates[0].candidate;
  const items = read(w, INFO.a, { viewer: M1 }).items;
  const idOf = (cid) => items.find((i) => i.candidate === cid).id;
  const fixture = { node: INFO.a, at: AT, viewers: { sees: M1, blind: OUTSIDER },
                    in: idOf(shown), out: "no-item-is-out-at-any-date", undetermined: idOf(shown),
                    fenced: idOf(fenced), expected: items.map((i) => i.id) };
  const neighbours = (a) => w.c.neighbours(a);
  const r = ownerConformance({ owner: "contradiction", kinds: CONNECTION_KINDS.map((k) => ({ ...k })), neighbours, fixture });
  assert.deepEqual(r.failures.map((f) => f.check), ["at"], JSON.stringify(r.failures));
  assert.match(r.failures[0].why, /in at the date/);
  /* R6 directly: every item is undetermined at any date asked, never out, and none is dropped for its date */
  for (const at of ["1999-01-01", AT, "2100-12-31"]) {
    const got = w.c.neighbours({ node: INFO.a, at, viewer: M1, scope: null }).items;
    assert.deepEqual(got.map((i) => i.id), items.map((i) => i.id), at);
    assert.ok(got.every((i) => i.undetermined.why.key === "contradiction.undated_why" && Object.keys(i.undetermined.why.vars).length === 0), at);
  }
  /* R7 directly: the fenced candidate reaches the participant and not the outsider, and is not counted for them */
  const blind = w.c.neighbours({ node: INFO.a, at: AT, viewer: OUTSIDER, scope: null });
  assert.deepEqual(blind.items.map((i) => i.id), items.filter((i) => i.candidate !== fenced).map((i) => i.id));
  assert.equal(JSON.stringify(blind).includes(fenced), false);
});

test("R59: every table declared explicitly through declareTable — purge clear by both sides' bundles (opt-ins and responses by their project too), sight of the bundle, append-only, the rest declarePurge's defaults", () => {
  const w = seeded();
  const held = w.record.declaredTables().filter((d) => d.module === "contradiction");
  assert.deepEqual(held.map((d) => d.name ?? d.table), [...CONTRADICTION_TABLES]);
  for (const d of held) {
    const name = d.name ?? d.table;
    const keys = name === "contradiction_optins" || name === "contradiction_responses"
      ? ["a_bundle_id", "b_bundle_id", "project_id"] : ["a_bundle_id", "b_bundle_id"];
    assert.deepEqual([d.purge, d.expunge, d.export, d.sight, d.derive, d.version_chain], ["clear", "none", "admin-only", "bundle", "stored", true], name);
    assert.deepEqual(d.keys, keys, name);
  }
  /* once per instance; a second module's declaration of the tables is refused */
  assert.deepEqual(w.c.declareTables(), { ok: true, already: true });
  assert.equal(new Contradiction(w.st, { record: w.record }).declareTables().reason, "TABLE_DECLARED");
});

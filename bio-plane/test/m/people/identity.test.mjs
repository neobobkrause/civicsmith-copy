/* people's identity claims and cluster at its interface: R1–R6, R26, R28. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, doc, ANN, OUT, MACHINE } from "./fixture.mjs";
import { CLAIM_KINDS, CLAIM_BASES, IDENTITY_KIND_WORDS, peopleOf } from "../../../src/people/index.mjs";
import { ownerConformance, defaultRegistry } from "../../../src/connection-grammar/index.mjs";
import { hasWord } from "../../../src/setup-words/index.mjs";

const day = (from, to) => ({ from, to, precision: "day", zone: "UTC" });

/* Two same-name persons with one identifier each, and two cited records. entities R43 lets two persons hold one
   identifier only at validities that do not overlap: a holds it through 2020, b from 2021, each record dated within. */
function pair(w, { ids = ["P001", "P001"], label = "Michael Houston" } = {}) {
  const a = w.person(label), b = w.person(label);
  if (ids[0]) w.identify(a, "ellery_person", ids[0], day("2020-01-01", "2020-12-31"));
  if (ids[1]) w.identify(b, "ellery_person", ids[1], day("2021-01-01", "2021-12-31"));
  const ca = w.capture(`a-${a}`), cb = w.capture(`b-${b}`);
  return { a, b, ev: { a: doc(ca, "2020-03-01"), b: doc(cb, "2021-06-01"), identifier: { scheme: "ellery_person", id: ids[0] || ids[1] } } };
}
const count = (w) => w.one(`SELECT COUNT(*) AS n FROM identity_claims`).n;

test("R1 claimIdentity refuses in order NO_ENDS, SELF_CLAIM, NO_SUCH_ENTITY naming the end, NOT_A_PERSON naming the end, UNKNOWN_CLAIM_KIND naming the three, UNKNOWN_BASIS, NO_EVIDENCE, NO_NOTE, IDENTITY_GRADE_UNEARNED; each writes nothing; otherwise one IDC- claim answered {ok, claim_id, kind, grade, why, at}", () => {
  const w = world();
  const { a, b, ev } = pair(w);
  const office = w.entity("office", "City Clerk");
  const base = { a, b, kind: "same_as", basis: "identifier", evidence: ev, note: "the same filer number", by: ANN };
  const cases = [
    [{ ...base, a: "" }, "NO_ENDS"], [{ ...base, b: undefined }, "NO_ENDS"],
    [{ ...base, b: a }, "SELF_CLAIM"],
    [{ ...base, a: "ENT-2026-9999", b: "ENT-2026-9998", kind: "bogus" }, "NO_SUCH_ENTITY"],
    [{ ...base, b: office, kind: "bogus" }, "NOT_A_PERSON"],
    [{ ...base, kind: "bogus", basis: "bogus" }, "UNKNOWN_CLAIM_KIND"],
    [{ ...base, basis: "bogus", evidence: null, note: "" }, "UNKNOWN_BASIS"],
    [{ ...base, evidence: null, note: "" }, "NO_EVIDENCE"], [{ ...base, evidence: {}, note: "" }, "NO_EVIDENCE"],
    [{ ...base, note: "  " }, "NO_NOTE"],
    [{ ...base, evidence: { ...ev, identifier: { scheme: "ellery_person", id: "P002" } } }, "IDENTITY_GRADE_UNEARNED"],
    [{ ...base, by: null }, "NO_BY"],
  ];
  for (const [args, reason] of cases) {
    const r = w.p.claimIdentity(args);
    assert.equal(r.ok, false, reason);
    assert.equal(r.reason, reason, JSON.stringify(args).slice(0, 120));
    assert.equal(typeof r.detail, "string");
  }
  assert.equal(w.p.claimIdentity({ ...base, a: "ENT-2026-9999" }).end, "a");
  assert.equal(w.p.claimIdentity({ ...base, b: office }).end, "b");
  const k = w.p.claimIdentity({ ...base, kind: "x" });
  for (const kind of CLAIM_KINDS) assert.ok(k.detail.includes(kind));
  assert.equal(count(w), 0, "no refusal wrote a claim");
  const ok = w.p.claimIdentity(base);
  assert.deepEqual(Object.keys(ok).sort(), ["at", "claim_id", "grade", "kind", "ok", "why"]);
  assert.match(ok.claim_id, /^IDC-2026-[a-z0-9]{16}$/, "record-grammar's opaque form");
  assert.equal(ok.kind, "same_as");
  /* testimony needs no evidence */
  const t = w.p.claimIdentity({ a, b, kind: "unsure", basis: "testimony", note: "I met them", by: ANN });
  assert.equal(t.ok, true);
  assert.equal(t.grade, "D");
  assert.equal(count(w), 2);
});

test("R2 the grade is earned from the basis, never stated: identifier A only with one scheme identifier held on both and valid at both cited dates; corroborated_name B only with a cited line on each valid at both dates; name C; testimony D; a failed condition refused IDENTITY_GRADE_UNEARNED naming it; why says 'claimed the same person, grade X, because …', never 'is the same person'", () => {
  const w = world();
  /* identifier: held on one end only is refused A */
  const one = pair(w, { ids: ["P001", null] });
  const r1 = w.p.claimIdentity({ a: one.a, b: one.b, kind: "same_as", basis: "identifier", evidence: one.ev, note: "n", by: ANN, grade: "A" });
  assert.equal(r1.reason, "IDENTITY_GRADE_UNEARNED");
  assert.match(r1.condition, /b holds the scheme identifier/);
  /* identifier valid on b only before b's record date is refused */
  const late = pair(w, { ids: ["P002", null] });
  w.identify(late.b, "ellery_person", "P002", day("2019-01-01", "2019-12-31"));
  const r2 = w.p.claimIdentity({ a: late.a, b: late.b, kind: "same_as", basis: "identifier", evidence: late.ev, note: "n", by: ANN });
  assert.equal(r2.reason, "IDENTITY_GRADE_UNEARNED");
  assert.match(r2.condition, /valid on b at its record's date 2021-06-01/);
  /* identifier with a date missing is refused */
  const nod = pair(w, { ids: ["P003", "P003"] });
  const r3 = w.p.claimIdentity({ a: nod.a, b: nod.b, kind: "same_as", basis: "identifier", evidence: { ...nod.ev, b: doc(w.capture("z")) }, note: "n", by: ANN });
  assert.equal(r3.reason, "IDENTITY_GRADE_UNEARNED");
  assert.match(r3.condition, /date of b's cited record/);
  /* identifier earned A */
  const good = pair(w, { ids: ["P004", "P004"] });
  const A = w.p.claimIdentity({ a: good.a, b: good.b, kind: "same_as", basis: "identifier", evidence: good.ev, note: "n", by: ANN, grade: "D" });
  assert.equal(A.grade, "A", "a caller's grade field is never read");
  assert.equal(A.why, "claimed the same person, grade A, because both records hold the identifier ellery_person P004, valid at 2020-03-01 and 2021-06-01");
  /* corroborated_name: the same post on each, valid at each date */
  const c = pair(w, { ids: [null, null] });
  const post = w.entity("office", "Harbour Master");
  const la = w.line("holds", c.a, post, { from: "2019-01-01", to: "2020-12-31" });
  const lb = w.line("holds", c.b, post, { from: "2021-01-01", to: "2022-12-31" });
  const lbad = w.line("holds", c.b, post, { from: "2023-01-01", to: "2023-12-31" });
  const other = w.line("holds", c.b, w.entity("office", "Other Post"), { from: "2021-01-01", to: "2022-12-31" });
  const cn = (lines) => w.p.claimIdentity({ a: c.a, b: c.b, kind: "same_as", basis: "corroborated_name", evidence: { a: c.ev.a, b: c.ev.b, lines }, note: "n", by: ANN });
  assert.match(cn(null).condition, /lines: \{a, b\}/);
  assert.match(cn({ a: la, b: lbad }).condition, /valid at b's record date/);
  const lopen = w.line("holds", c.b, post, { from: "2020-01-01", to: null });
  assert.match(cn({ a: la, b: lopen }).condition, /valid at b's record date/, "a line the record does not settle at the date earns nothing");
  assert.match(cn({ a: la, b: other }).condition, /the same fact/);
  assert.match(cn({ a: la, b: "LIN-2026-none" }).condition, /is held/);
  const B = cn({ a: la, b: lb });
  assert.equal(B.grade, "B");
  assert.match(B.why, /^claimed the same person, grade B, because both records carry the name 'Michael Houston' and each holds a holds line/);
  /* corroborated_name and name need a shared name */
  const d = { a: w.person("Ann Lee"), b: w.person("Bo Chan") };
  const dn = w.p.claimIdentity({ ...d, kind: "same_as", basis: "name", evidence: { a: c.ev.a, b: c.ev.b }, note: "n", by: ANN });
  assert.equal(dn.reason, "IDENTITY_GRADE_UNEARNED");
  assert.match(dn.condition, /share a name/);
  const C = w.p.claimIdentity({ a: c.a, b: c.b, kind: "unsure", basis: "name", evidence: { a: c.ev.a, b: c.ev.b }, note: "n", by: ANN });
  assert.equal(C.grade, "C");
  assert.equal(C.why, "claimed unsure whether the same person, grade C, because both records carry the name 'Michael Houston'");
  const D = w.p.claimIdentity({ ...d, kind: "not_same_as", basis: "testimony", note: "different people", by: ANN });
  assert.equal(D.grade, "D");
  assert.match(D.why, /^claimed not the same person, grade D, because/);
  for (const r of [A, B, C, D]) assert.doesNotMatch(r.why, /\bis the same person\b/);
  assert.deepEqual([...CLAIM_BASES], ["identifier", "corroborated_name", "name", "testimony"]);
});

test("R3 a machine may record only an identifier claim from source-native data with identifiers at both ends; any other machine claim is MACHINE_CLAIM_REFUSED", () => {
  const w = world();
  const { a, b, ev } = pair(w);
  for (const basis of ["corroborated_name", "name", "testimony"]) {
    const r = w.p.claimIdentity({ a, b, kind: "same_as", basis, evidence: ev, note: "n", by: MACHINE });
    assert.equal(r.reason, "MACHINE_CLAIM_REFUSED", basis);
  }
  const noCapture = w.p.claimIdentity({ a, b, kind: "same_as", basis: "identifier", evidence: { identifier: ev.identifier }, note: "n", by: MACHINE });
  assert.equal(noCapture.reason, "MACHINE_CLAIM_REFUSED");
  const ok = w.p.claimIdentity({ a, b, kind: "same_as", basis: "identifier", evidence: ev, note: "from the register", by: MACHINE });
  assert.equal(ok.grade, "A");
  assert.equal(w.one(`SELECT by_actor FROM identity_claims WHERE claim_id=?`, ok.claim_id).by_actor, MACHINE, "named as the machine (DEC-52)");
});

test("R4 a claim is never edited or deleted: withdrawIdentityClaim refuses NO_REASON and NO_SUCH_CLAIM, and NO_BY with no stamp, a repeat answers already, the withdrawn claim links nothing, and no entities row, alias or resolution moves", () => {
  const w = world();
  const { a, b, ev } = pair(w);
  const before = JSON.stringify(w.rows(`SELECT * FROM entities ORDER BY entity_id`)) + JSON.stringify(w.rows(`SELECT * FROM entity_aliases ORDER BY entity_id, alias_norm`));
  const c = w.p.claimIdentity({ a, b, kind: "same_as", basis: "identifier", evidence: ev, note: "n", by: ANN });
  assert.deepEqual(w.p.identityOf({ entityId: a, viewer: ANN }).members, [a, b].sort());
  assert.equal(w.p.withdrawIdentityClaim({ claimId: c.claim_id, reason: " ", by: ANN }).reason, "NO_REASON");
  assert.equal(w.p.withdrawIdentityClaim({ claimId: "IDC-2026-nope", reason: "x", by: ANN }).reason, "NO_SUCH_CLAIM");
  for (const by of [null, undefined, ""]) assert.equal(w.p.withdrawIdentityClaim({ claimId: c.claim_id, reason: "x", by }).reason, "NO_BY");
  assert.deepEqual(w.p.identityOf({ entityId: a, viewer: ANN }).members, [a, b].sort(), "an unstamped withdrawal changes nothing");
  const wd = w.p.withdrawIdentityClaim({ claimId: c.claim_id, reason: "wrong filer", by: ANN });
  assert.equal(wd.ok, true);
  assert.deepEqual(Object.keys(wd.withdrawn).sort(), ["at", "by", "reason"]);
  const again = w.p.withdrawIdentityClaim({ claimId: c.claim_id, reason: "again", by: OUT });
  assert.equal(again.already, true);
  assert.equal(again.withdrawn.reason, "wrong filer");
  const row = w.one(`SELECT * FROM identity_claims WHERE claim_id=?`, c.claim_id);
  assert.equal(row.why, c.why, "the claim itself is kept unchanged");
  assert.deepEqual(w.p.identityOf({ entityId: a, viewer: ANN }).members, [a], "a withdrawn claim links nothing");
  const after = JSON.stringify(w.rows(`SELECT * FROM entities ORDER BY entity_id`)) + JSON.stringify(w.rows(`SELECT * FROM entity_aliases ORDER BY entity_id, alias_norm`));
  assert.equal(after, before);
});

test("R5 identityOf answers the transitive same_as cluster the viewer may see, each link with claim, grade and why; undetermined when a not_same_as joins two members (naming it); unsure listed and joining nothing; an unregistered id found:false; bounded at 500 members with truncated", () => {
  const w = world();
  const [x, y, z, u, v] = ["P X", "P Y", "P Z", "P U", "P V"].map((n) => w.person(n));
  const t = (a, b, kind = "same_as", extra = {}) => w.p.claimIdentity({ a, b, kind, basis: "testimony", note: "said so", by: ANN, ...extra });
  t(x, y); t(y, z);
  const un = t(z, u, "unsure");
  const fenced = t(x, v, "same_as", { project: w.project() });
  const ann = w.p.identityOf({ entityId: x, viewer: ANN });
  assert.equal(ann.state, "linked");
  assert.deepEqual(ann.members, [v, x, y, z].sort(), "transitive, and the fenced claim joins for a participant");
  for (const l of ann.links) { assert.ok(l.claim_id && l.grade && l.why); }
  assert.deepEqual(ann.unsure.map((c) => c.claim_id), [un.claim_id]);
  assert.ok(!ann.members.includes(u), "unsure joins nothing");
  const out = w.p.identityOf({ entityId: x, viewer: OUT });
  assert.deepEqual(out.members, [x, y, z].sort(), "the fenced claim is neither shown nor joins for an outsider");
  assert.ok(!out.links.some((l) => l.claim_id === fenced.claim_id));
  const apart = t(x, z, "not_same_as");
  const und = w.p.identityOf({ entityId: y, viewer: ANN });
  assert.equal(und.state, "undetermined");
  assert.deepEqual(und.not_same_as.map((c) => c.claim_id), [apart.claim_id]);
  assert.deepEqual(und.why, { key: "people.why.claim_joins_two", vars: { apart: apart.claim_id } }, "R40: a key with its fills");
  assert.ok(hasWord(und.why.key));
  assert.deepEqual(w.p.identityOf({ entityId: "ENT-2026-7777", viewer: ANN }), { ok: true, found: false, entity_id: "ENT-2026-7777" });
  assert.equal(w.p.identityOf({ entityId: "", viewer: ANN }).reason, "NO_ENTITY");
  assert.equal(w.p.identityOf({ entityId: x, viewer: null }).ok, false, "an absent viewer fails closed");
  /* the bound: a chain of 502 persons */
  const w2 = world();
  const ids = Array.from({ length: 502 }, (_, i) => w2.person(`Q ${i}`));
  for (let i = 1; i < ids.length; i++) w2.p.claimIdentity({ a: ids[i - 1], b: ids[i], kind: "same_as", basis: "testimony", note: "chain", by: ANN });
  const big = w2.p.identityOf({ entityId: ids[0], viewer: ANN });
  assert.equal(big.members.length, 500);
  assert.equal(big.truncated, true);
});

test("R6 the cluster is a derived cache rebuilt in each claim's and withdrawal's transaction, equal to its rebuild, and read fail-closed: a stale or differing cache answers undetermined with the reason, never a stale cluster", () => {
  const w = world();
  const [x, y, z] = ["R X", "R Y", "R Z"].map((n) => w.person(n));
  const c1 = w.p.claimIdentity({ a: x, b: y, kind: "same_as", basis: "testimony", note: "n", by: ANN });
  w.p.claimIdentity({ a: y, b: z, kind: "same_as", basis: "testimony", note: "n", by: ANN });
  assert.deepEqual(w.record.rebuildAndCompare("people", "identity_cluster"), { same: true });
  w.p.withdrawIdentityClaim({ claimId: c1.claim_id, reason: "no", by: ANN });
  assert.deepEqual(w.record.rebuildAndCompare("people", "identity_cluster"), { same: true });
  assert.ok(w.record.declaredTables().some((d) => d.name === "identity_cluster" && d.derive === "derived-rebuildable"));
  /* a cache that differs from its rebuild */
  w.st.sql.exec(`UPDATE identity_cluster SET component=? WHERE entity_id=?`, x, z);
  assert.equal(w.record.rebuildAndCompare("people", "identity_cluster").same, false);
  const d = w.p.identityOf({ entityId: z, viewer: ANN });
  assert.equal(d.state, "undetermined");
  assert.deepEqual(d.why, { key: "people.identity_cluster_cache_differs", vars: {} }, "R40");
  assert.ok(hasWord(d.why.key));
  assert.deepEqual(d.members, [z]);
  /* a stale mark */
  w.record.rebuildDerived("people", "identity_cluster");
  w.record.transact(() => w.record.markStale("people", "identity_cluster", y));
  const s = w.p.identityOf({ entityId: y, viewer: ANN });
  assert.equal(s.state, "undetermined");
  assert.deepEqual(s.why, { key: "people.identity_cluster_cache", vars: {} }, "R40");
  assert.ok(hasWord(s.why.key));
});

test("R26 people registers as the owner of same_as, not_same_as and unsure; neighbours presents each visible unwithdrawn claim as one evidentiary hop with the claim's evidence and grade; it passes connection-grammar's owner-conformance battery", () => {
  const w = world();
  assert.deepEqual(w.registry.owners().find((o) => o.owner === "people").kinds.map((k) => k.kind), ["same_as", "not_same_as", "unsure"]);
  for (const k of IDENTITY_KIND_WORDS) assert.equal(w.registry.kindOf(k.kind).class, "evidentiary");
  const node = w.person("N Node");
  const cap = (n) => w.capture(n);
  const name = (b, da, db, extra = {}) => w.p.claimIdentity({ a: node, b, kind: "same_as", basis: "name",
    evidence: { a: doc(cap(`${b}a`), da), b: doc(cap(`${b}b`), db) }, note: "n", by: ANN, ...extra });
  const inn = name(w.person("N Node"), "2020-01-01", "2022-01-01");
  const out = name(w.person("N Node"), "2010-01-01", "2011-01-01");
  const und = w.p.claimIdentity({ a: node, b: w.person("N Other"), kind: "unsure", basis: "testimony", note: "maybe", by: ANN });
  const fenced = w.p.claimIdentity({ a: node, b: w.person("N Fenced"), kind: "not_same_as", basis: "testimony", note: "no", by: ANN, project: w.project() });
  const gone = name(w.person("N Node"), "2020-01-01", "2022-01-01");
  w.p.withdrawIdentityClaim({ claimId: gone.claim_id, reason: "wrong", by: ANN });
  const r = ownerConformance({ owner: "people", neighbours: (a) => w.p.neighbours(a), kinds: IDENTITY_KIND_WORDS.map((k) => ({ ...k })),
    fixture: { node, at: { value: "2021-01-01", precision: "day", zone: "UTC" }, in: inn.claim_id, out: out.claim_id, undetermined: und.claim_id, fenced: fenced.claim_id,
               viewers: { sees: ANN, blind: OUT }, expected: [inn.claim_id, und.claim_id, fenced.claim_id] } });
  assert.deepEqual(r.failures, []);
  assert.equal(r.ok, true);
  const got = w.registry.neighbours({ owner: "people", node, at: { value: "2021-01-01", precision: "day", zone: "UTC" }, viewer: ANN, scope: null });
  const hop = got.items.find((i) => i.id === inn.claim_id);
  assert.deepEqual(hop.grade, { assertion: "C", ends: ["C", "C"] });
  assert.equal(hop.evidence.length, 2);
  assert.ok(!got.items.some((i) => i.id === gone.claim_id), "a withdrawn claim is never a hop");
  /* K1563 (1): the plane's registry holds people's entry from load; it reads the host the walk passes, and with no host
     and more than one instance in the isolate it refuses rather than guess */
  assert.ok(defaultRegistry.owners().some((o) => o.owner === "people"));
  const host = { storage: w.st };
  const plane = peopleOf(host, { ...w.deps, registry: null });
  const viaHost = defaultRegistry.neighbours({ owner: "people", node, at: { value: "2021-01-01", precision: "day", zone: "UTC" }, viewer: ANN, scope: null, host });
  assert.deepEqual(viaHost.items.map((i) => i.id).sort(), got.items.map((i) => i.id).sort());
  assert.equal(plane, peopleOf(host), "one instance per storage");
  const blind = defaultRegistry.neighbours({ owner: "people", node, at: { value: "2021-01-01", precision: "day", zone: "UTC" }, viewer: ANN, scope: null });
  assert.equal(blind.refused, "OWNER_HOST_AMBIGUOUS");
});

test("R28 linked, never merged: no act of people changes an entities row, alias or resolution, and two persons stay two ids whatever claims join them", () => {
  const w = world();
  const { a, b, ev } = pair(w);
  const snap = () => JSON.stringify([w.rows(`SELECT * FROM entities ORDER BY entity_id`), w.rows(`SELECT * FROM entity_aliases ORDER BY entity_id, alias_norm`),
    w.rows(`SELECT * FROM entity_relations`), w.rows(`SELECT * FROM resolutions`)]);
  const before = snap();
  const c = w.p.claimIdentity({ a, b, kind: "same_as", basis: "identifier", evidence: ev, note: "n", by: ANN });
  w.p.claimIdentity({ a, b, kind: "same_as", basis: "testimony", note: "n", by: OUT });
  w.p.recordPersonFact({ person: a, kind: "name", value: "Mike Houston", valid: { from: "2020-01-01", to: null }, citation: ev.a, by: ANN });
  w.p.withdrawIdentityClaim({ claimId: c.claim_id, reason: "x", by: ANN });
  assert.equal(snap(), before);
  assert.ok(w.real.has(a) && w.real.has(b) && a !== b);
  assert.equal(w.real.readEntity({ entityId: b }).entity.entity_id, b);
});

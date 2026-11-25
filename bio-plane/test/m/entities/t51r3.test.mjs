/* entities at T51's fix round 3 (C64, C60; DEC-401, DEC-402 @ 43379a1a44; K4356): R63 a member names an office from a request and
   it carries `named_by_member` until R64 an administrator confirms it (`confirmOffice`, `op=officeconfirm`); R62 declares that op;
   C60's fault half. Every test drives `entities` at its interface, the acts through the ops map as the door runs them. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, MACHINE } from "./fixture.mjs";
import { entitiesOps, DECLARED_OPS, ENTITY_CHECKS } from "../../../src/entities/index.mjs";
import { declaredOpHolds } from "../../declared-ops.mjs";

const NOTE = "a subject the test registers";
const PE = ["test-port-ellery"];
const LAW = "Test Stat. § 1.100";
const VIEWER = "member:ann";
/* an instance with an administrator (`ada`), an ordinary member (`bea`) and a second ordinary member (`cy`) */
function team() {
  const w = world();
  for (const [id, role] of [["ada", "admin"], ["bea", "member"], ["cy", "member"]])
    w.st.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES (?, ?, ?, 'active', '2026-01-01', '2026-01-01')`, id, id, role);
  return w;
}
const op = (w, name, { query = {}, body = null } = {}) => {
  const url = new URL("https://x.example/");
  for (const [k, v] of Object.entries(query)) url.searchParams.set(k, v);
  return entitiesOps(w.e, url, body)[name]();
};
/* what a member's "Use this office" sends from the request screen, as the door stamps it (`declaredBy` the member) */
const nameOffice = (w, by, label = "Office of Information Policy") =>
  op(w, "entitycreate", { body: { kind: "office", label, note: "the office that holds the department's records", declaredBy: by } });
/* the confirm as the door runs it: `by` and `viewer` stamped in the address, the office in the body */
const confirm = (w, entityId, by, extraBody = {}) => op(w, "officeconfirm", { query: { ...(by == null ? {} : { by }), viewer: by == null ? "" : `member:${by}` }, body: { entityId, ...extraBody } });
const listed = (w, kind = "office") => op(w, "entitieskind", { query: { kind, viewer: VIEWER } });
const snapshot = (w) => ["entities", "entity_aliases"].map((t) => w.rows(`SELECT * FROM ${t} ORDER BY 1, 2`));

/* ---------------------------------------------------------------- R63 */

test("R63 an office a member names is registered for the team, recorded as declared by her, and carries named_by_member: true in readEntity and entitiesOfKind until confirmed", () => {
  const w = team();
  const made = nameOffice(w, "bea");
  assert.equal(made.ok, true, JSON.stringify(made));
  const read = op(w, "entity", { query: { id: made.entity_id, viewer: VIEWER } });
  assert.deepEqual([read.entity.kind, read.entity.declared_by, read.entity.named_by_member, read.entity.confirmed_by], ["office", "bea", true, null]);
  const items = listed(w).entities;
  assert.deepEqual(items.map((i) => [i.entity_id, i.declared_by, i.named_by_member, i.confirmed_by]), [[made.entity_id, "bea", true, null]],
    "listed for the whole team, the mark with it");
  /* the team's next request finds it by its name, as any registered office */
  assert.equal(op(w, "entitybyalias", { query: { alias: "office of information policy", viewer: VIEWER } }).entities[0].named_by_member, true);
});

test("R63 control: an office an administrator creates, or a machine registers, carries named_by_member: false; so does an office held before the mark; a kind that is not an office carries none", () => {
  const w = team();
  const byAdmin = nameOffice(w, "ada", "Clerk of the Board");
  const byMachine = nameOffice(w, MACHINE, "Registrar");
  assert.equal(byAdmin.ok && byMachine.ok, true);
  for (const id of [byAdmin.entity_id, byMachine.entity_id])
    assert.equal(op(w, "entity", { query: { id, viewer: VIEWER } }).entity.named_by_member, false, id);
  /* an office registered before the column existed (NULL) reads unmarked, not marked */
  const old = nameOffice(w, "bea", "Old Office").entity_id;
  w.st.sql.exec(`UPDATE entities SET named_by_member = NULL WHERE entity_id = ?`, old);
  assert.equal(op(w, "entity", { query: { id: old, viewer: VIEWER } }).entity.named_by_member, false);
  assert.deepEqual(listed(w).entities.map((i) => i.named_by_member), [false, false, false]);
  /* a member's person or body is registered as before and carries no mark */
  const person = op(w, "entitycreate", { body: { kind: "person", label: "Pat Quill", note: NOTE, declaredBy: "bea" } });
  const body = op(w, "entitycreate", { body: { kind: "body", label: "Port Board", note: NOTE, declaredBy: "bea" } });
  assert.equal(person.ok && body.ok, true);
  for (const id of [person.entity_id, body.entity_id]) assert.equal(op(w, "entity", { query: { id, viewer: VIEWER } }).entity.named_by_member, null);
  assert.equal("named_by_member" in listed(w, "person").entities[0], false);
  assert.equal("named_by_member" in listed(w, "body").entities[0], false);
});

test("R63 (K4364, DEC-402) an office also holds where requests go (contact: address, email or portal) and the law they go under (a records law of the active profiles), read back by readEntity and entitiesOfKind; null when not stated; an unknown law or a bad contact is refused in words", () => {
  const w = world({ profiles: PE });
  w.st.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('bea', 'bea', 'member', 'active', '2026-01-01', '2026-01-01')`);
  const make = (extra, label = "Records Office") => op(w, "entitycreate", { body: { kind: "office", label, note: NOTE, declaredBy: "bea", ...extra } });
  const contact = { kind: "portal", value: "https://records.example.org/requests" };
  const made = make({ contact, law: LAW });
  assert.equal(made.ok, true, JSON.stringify(made));
  const read = w.e.readEntity({ entityId: made.entity_id }).entity;
  assert.deepEqual([read.contact, read.law, read.named_by_member], [contact, LAW, true]);
  const item = listed(w).entities[0];
  assert.deepEqual([item.contact, item.law], [contact, LAW]);
  /* the law may be named by the law's name as well; it is held as its citation */
  const byName = make({ law: "Freedom of Records Act (test)" }, "Second Office");
  assert.equal(w.e.readEntity({ entityId: byName.entity_id }).entity.law, LAW);
  /* an office that states neither answers null for each */
  const bare = make({}, "Third Office");
  const b = w.e.readEntity({ entityId: bare.entity_id }).entity;
  assert.deepEqual([b.contact, b.law], [null, null]);
  assert.deepEqual(listed(w).entities.filter((i) => i.entity_id === bare.entity_id).map((i) => [i.contact, i.law]), [[null, null]]);
  /* refusals, each before an id is allocated and writing nothing */
  const before = snapshot(w);
  const unknown = make({ law: "No Such Act" }, "Fourth Office");
  assert.deepEqual([unknown.ok, unknown.reason], [false, "UNKNOWN_LAW"]);
  assert.ok(unknown.laws.includes(LAW) && typeof unknown.detail === "string");
  for (const bad of [{ kind: "carrier-pigeon", value: "x" }, { kind: "email", value: "  " }, { kind: "email" }, "a@b.c", []]) {
    const r = make({ contact: bad }, "Fifth Office");
    assert.deepEqual([r.ok, r.reason], [false, "BAD_CONTACT"], JSON.stringify(bad));
  }
  for (const [kind, field] of [["person", { law: LAW }], ["body", { contact }]]) {
    const r = op(w, "entitycreate", { body: { kind, label: "Not An Office", note: NOTE, declaredBy: "bea", ...field } });
    assert.deepEqual([r.ok, r.reason], [false, "OFFICE_FIELD_NOT_FOR_KIND"], kind);
  }
  assert.deepEqual(snapshot(w), before);
  /* control: no profile gives a law, so a team with none refuses any law and still registers an office without one */
  const none = world();
  assert.equal(none.e.createEntity({ kind: "office", label: "O", note: NOTE, law: LAW }).reason, "UNKNOWN_LAW");
  assert.equal(none.e.createEntity({ kind: "office", label: "O", note: NOTE }).ok, true);
});

test("R63 a store written before the mark gets its columns once at boot; an office it already holds reads unmarked, with no contact and no law, and can then be named beside it", () => {
  const w = team();
  const old = nameOffice(w, "ada", "Old Office").entity_id;
  for (const c of ["named_by_member", "confirmed_by", "confirmed_at", "contact_kind", "contact_value", "law"]) w.st.sql.exec(`ALTER TABLE entities DROP COLUMN ${c}`);
  assert.equal(w.rows(`PRAGMA table_info(entities)`).some((c) => c.name === "named_by_member"), false, "the store is as it was before");
  w.e.migrate();
  w.e.migrate();
  const read = w.e.readEntity({ entityId: old }).entity;
  assert.deepEqual([read.named_by_member, read.confirmed_by, read.contact, read.law], [false, null, null, null]);
  assert.equal(nameOffice(w, "bea", "New Office").ok, true);
  assert.deepEqual(listed(w).entities.map((i) => [i.label, i.named_by_member]), [["Old Office", false], ["New Office", true]]);
});

/* ---------------------------------------------------------------- R64 */

test("R64 an administrator's confirm clears the mark and records herself and when; the name, alias and note of the office are unchanged", () => {
  const w = team();
  const id = nameOffice(w, "bea").entity_id;
  const before = w.e.readEntity({ entityId: id }).entity;
  const done = confirm(w, id, "ada");
  assert.equal(done.ok, true, JSON.stringify(done));
  assert.deepEqual([done.entity_id, done.named_by_member, done.confirmed_by, typeof done.at, done.already], [id, false, "ada", "string", undefined]);
  const after = w.e.readEntity({ entityId: id }).entity;
  assert.deepEqual([after.named_by_member, after.confirmed_by, after.confirmed_at], [false, "ada", done.at]);
  for (const k of ["label", "note", "aliases", "declared_by", "at", "kind"]) assert.deepEqual(after[k], before[k], k);
  const item = listed(w).entities[0];
  assert.deepEqual([item.named_by_member, item.confirmed_by], [false, "ada"]);
});

test("R64 a member's confirm is refused NOT_AN_ADMIN and the mark stays; a machine's is refused too; the refusal writes nothing", () => {
  const w = team();
  const id = nameOffice(w, "bea").entity_id;
  const before = snapshot(w);
  for (const by of ["cy", "bea", MACHINE, null, undefined, "nobody"]) {
    const r = confirm(w, id, by);
    assert.deepEqual([r.ok, r.reason, r.code], [false, "NOT_AN_ADMIN", "NOT_AN_ADMIN"], String(by));
    assert.equal(typeof r.detail, "string");
  }
  assert.deepEqual(snapshot(w), before);
  assert.equal(w.e.readEntity({ entityId: id }).entity.named_by_member, true);
  /* a `by` a caller puts in the body is never read: the stamp is the address's (R4) */
  const spoof = confirm(w, id, "bea", { by: "ada" });
  assert.equal(spoof.reason, "NOT_AN_ADMIN");
  assert.equal(op(w, "officeconfirm", { body: { entityId: id, by: "ada" } }).reason, "NOT_AN_ADMIN", "no stamp at all");
  assert.equal(w.e.readEntity({ entityId: id }).entity.named_by_member, true);
});

test("R64 the refusals come in order and each writes nothing: NO_ENTITY, NO_SUCH_ENTITY, NOT_AN_ADMIN, NOT_AN_OFFICE, NOT_NAMED_BY_A_MEMBER", () => {
  const w = team();
  const named = nameOffice(w, "bea").entity_id;
  const own = nameOffice(w, "ada", "Clerk of the Board").entity_id;
  const person = op(w, "entitycreate", { body: { kind: "person", label: "Pat Quill", note: NOTE, declaredBy: "bea" } }).entity_id;
  const before = snapshot(w);
  const reason = (entityId, by) => confirm(w, entityId, by).reason;
  assert.equal(reason(undefined, "bea"), "NO_ENTITY", "named by no id, first of all");
  assert.equal(reason("", "ada"), "NO_ENTITY");
  assert.equal(reason("ENT-2026-9999", "bea"), "NO_SUCH_ENTITY", "before the caller is asked");
  assert.equal(reason(person, "bea"), "NOT_AN_ADMIN", "before the kind is asked");
  assert.equal(reason(person, "ada"), "CONFIRM_NOT_AN_OFFICE");
  assert.equal(reason(own, "ada"), "NOT_NAMED_BY_A_MEMBER", "control: an administrator's own office");
  assert.deepEqual(snapshot(w), before);
  /* each refusal has a row and a sentence of its own (K4364): CONFIRM_NOT_AN_OFFICE keeps clear of duties' NOT_AN_OFFICE */
  const rows = [["CONFIRM_NOT_AN_OFFICE", person, "C-91.10"], ["NOT_NAMED_BY_A_MEMBER", own, "C-91.11"]].map(([c, id, check]) => {
    const r = confirm(w, id, "ada");
    assert.deepEqual([r.ok, r.reason, r.code, r.check], [false, c, c, check]);
    assert.equal(r.translation, ENTITY_CHECKS[c].translation);
    assert.ok(typeof r.translation === "string" && r.translation.length > 0 && typeof r.detail === "string" && r.detail.length > 0);
    assert.match(ENTITY_CHECKS[c].where, /^src\/entities\/index\.mjs confirmOffice > is-/);
    return r.translation;
  });
  assert.equal(new Set(rows).size, 2);
  assert.equal(ENTITY_CHECKS.NOT_AN_OFFICE, undefined, "duties' code is not minted here");
  /* control: the named office is still confirmable after every refusal */
  assert.equal(confirm(w, named, "ada").ok, true);
});

test("R64 a repeat answers already: true and writes nothing; an office an administrator once confirmed is not NOT_NAMED_BY_A_MEMBER", () => {
  const w = team();
  const id = nameOffice(w, "bea").entity_id;
  const first = confirm(w, id, "ada");
  const before = snapshot(w);
  const again = confirm(w, id, "ada");
  assert.deepEqual([again.ok, again.already, again.entity_id, again.named_by_member, again.confirmed_by, again.at], [true, true, id, false, "ada", first.at]);
  assert.deepEqual(snapshot(w), before);
  /* another administrator repeating it changes nothing either, and does not take the confirmation */
  w.st.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES ('dee', 'dee', 'admin', 'active', '2026-01-01', '2026-01-01')`);
  const other = confirm(w, id, "dee");
  assert.deepEqual([other.ok, other.already, other.confirmed_by], [true, true, "ada"]);
  assert.deepEqual(snapshot(w), before);
});

/* ---------------------------------------------------------------- R62 */

test("R62 entities declares officeconfirm: its requires alone raise no refusal naming a field, a call without entityId is refused naming it, and a field outside accepts is dropped or refused", async () => {
  const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);
  const call = async (given) => {
    const w = team();
    const office = nameOffice(w, "bea").entity_id;
    const fields = { ...given, ...("entityId" in given ? { entityId: office } : {}) };
    const q = new URLSearchParams({ op: "officeconfirm", by: "ada", viewer: "member:ada", ...Object.fromEntries(Object.entries(given).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
    return entitiesOps(w.e, new URL("http://x/?" + q), fields).officeconfirm();
  };
  const named = (answer, field) => !!answer && answer.ok === false && answer.code === "NO_ENTITY" && field === "entityId";
  const d = DECLARED_OPS.officeconfirm;
  assert.deepEqual([d.mutating, d.fields.accepts, d.fields.requires], [true, ["entityId"], ["entityId"]]);
  assert.ok(d.classes.includes("admin") && d.classes.includes("member"), "the module itself refuses a member (NOT_AN_ADMIN)");
  assert.deepEqual([d.stamps, d.needs, d.machineClasses], [["viewer", "by"], null, []], "the stamps are the address's; an administrator's act needs no capability; no machine");
  await declaredOpHolds({ op: "officeconfirm", declaration: d, call, refusedNaming: named, values: {}, same: sameCode });
});

/* ---------------------------------------------------------------- C60 (fault half) */

test("C60 a vouched memo naming a registered organisation is found by connect: it resolves to the organisation, and strongestByCapture and concerns, which connect reads, hold the memo", () => {
  const w = team();
  const org = w.e.createEntity({ kind: "body", label: "Harbour Authority", note: NOTE, sector: "government", declaredBy: "ada" }).entity_id;
  const other = w.e.createEntity({ kind: "body", label: "Port Board", note: NOTE, declaredBy: "ada" }).entity_id;
  const memo = sha("vouched memo");
  w.held("INFO-MEMO", memo);
  w.read("INFO-MEMO", memo, [{ kind: "org", key: "harbour-authority", label: "Harbour Authority" }]);
  const r = w.e.resolve({ captureSha: memo, resolvedBy: "bea" });
  assert.deepEqual([r.resolved_count, r.unresolved_count], [1, 0], JSON.stringify(r));
  const strongest = w.e.strongestByCapture(org);
  assert.deepEqual([...strongest.keys()], [memo]);
  assert.equal(strongest.get(memo).grade, "C");
  const c = w.e.concerns({ entityId: org, viewer: VIEWER });
  assert.deepEqual([c.count, c.documents[0].capture_sha], [1, memo]);
  assert.deepEqual(w.e.namingDocuments({ entityId: org, viewer: VIEWER }).documents.map((d) => d.capture_sha), [memo]);
  /* control: the memo does not name the other organisation, so it is found for neither connect nor the name lookup */
  assert.equal(w.e.strongestByCapture(other).size, 0);
  assert.equal(w.e.concerns({ entityId: other, viewer: VIEWER }).count, 0);
  /* a member who stands behind the memo (testimony, grade D) is found as well, never lowering the machine's grade */
  const t = w.e.testify({ captureSha: memo, ref: r.resolved[0].ref, entityId: org, basis: "I wrote the memo", resolvedBy: "bea" });
  assert.equal(t.ok, true);
  assert.equal(w.e.strongestByCapture(org).get(memo).grade, "C");
});

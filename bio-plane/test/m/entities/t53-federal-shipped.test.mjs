/* entities over the shipped federal layer (provider notice jurisdictions:40; `jurisdictions` R119, PR 40): the view the
   instance's active profile makes through `jurisdictions`' own code holds the government's list of federal FOIA offices in
   its `counterparties` (level `federal`, elected false, contacts, no ids or hours). R68 reads them as the built-in list:
   `federalOfficesFind` answers them, and `createEntity` with `built_in` makes one an office with FOIA as its law. No office
   is hand-built here: each one asked for is taken from the view the provider's code made. */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "./fixture.mjs";
import { labelTerms, normAlias } from "../../../src/extraction/index.mjs";

const NOTE = "the office that holds the agency's records";

function shipped() {
  const w = world({ profiles: ["oakland-alameda"] });
  for (const [id, role] of [["ada", "admin"], ["bea", "member"]])
    w.st.sql.exec(`INSERT INTO members (member_id, cover, role, status, created, updated) VALUES (?, ?, ?, 'active', '2026-01-01', '2026-01-01')`, id, id, role);
  const view = w.e.view();
  const federal = view.layers.find((l) => l.level === "federal");
  const offices = view.counterparties.filter((c) => c.level === "federal");
  const foia = view.records_laws.find((l) => l.layer === federal.id && Array.isArray(l.governs) && l.governs.includes("federal"));
  return { w, federal, offices, foia };
}
const make = (w, by, extra) => w.e.createEntity({ kind: "office", label: null, note: NOTE, declaredBy: by, ...extra });
const count = (w) => w.rows(`SELECT entity_id FROM entities`).length;

test("notice jurisdictions:40 R68 over the shipped federal layer: its FOIA offices are the built-in list, found by name and chosen as an office under FOIA", () => {
  const { w, federal, offices, foia } = shipped();
  assert.ok(offices.length > 20, `the shipped layer holds the government's list (${offices.length})`);
  assert.ok(federal && federal.as_of, "the federal layer states the date its list was read");
  assert.ok(foia, "the federal layer gives the law its offices are under");
  assert.equal(count(w), 0, "no federal office is an entity until a member chooses it (jurisdictions R119)");

  /* an office whose component name is its own: a query by every word of it answers it, with its contacts and the read's date */
  const shared = (o) => offices.filter((x) => normAlias(x.role) === normAlias(o.role)).length;
  const own = offices.find((o) => shared(o) === 1 && o.contacts.length);
  const found = w.e.federalOfficesFind({ query: own.role, viewer: "member:bea" });
  assert.equal(found.ok, true, JSON.stringify(found));
  const hit = found.offices.find((o) => o.role === own.role && o.body === own.body);
  assert.ok(hit, `${own.role} is found by its name`);
  assert.deepEqual(hit.contacts, own.contacts.map((k) => ({ how: k.how, value: k.value })));
  assert.deepEqual([hit.layer, hit.as_of], [federal.id, federal.as_of]);

  /* a query naming many answers at most 20, with truncated */
  const term = labelTerms(own.body).find((t) => offices.filter((o) => labelTerms(o.body).includes(t)).length > 20)
    ?? "office";
  const broad = w.e.federalOfficesFind({ query: term, viewer: "member:bea" });
  assert.deepEqual([broad.count, broad.truncated, broad.limit], [20, true, 20]);
  assert.equal(count(w), 0, "reading the list registers nothing");

  /* choosing it makes an office: not marked, built_in, FOIA as its law with its layer, the contact the list states */
  const chosen = make(w, "bea", { built_in: { role: own.role, body: own.body } });
  assert.equal(chosen.ok, true, JSON.stringify(chosen));
  assert.equal(chosen.label, own.role);
  assert.deepEqual(chosen.built_in, { layer: federal.id, as_of: federal.as_of });
  const read = w.e.readEntity({ entityId: chosen.entity_id, viewer: "member:bea" }).entity;
  assert.deepEqual([read.named_by_member, read.law, read.law_layer, read.layer, read.body],
    [false, foia.citation, federal.id, federal.id, own.body]);
  const how = { web: "portal", email: "email", mail: "address" };
  const first = ["web", "email", "mail"].map((h) => own.contacts.find((k) => k.how === h)).find(Boolean);
  assert.deepEqual(read.contact, { kind: how[first.how], value: first.value });
});

test("notice jurisdictions:40 R68 control over the shipped federal layer: a component name several agencies share is chosen by its agency, never by guess", () => {
  const { w, federal, offices } = shipped();
  const shared = offices.find((o) => offices.filter((x) => normAlias(x.role) === normAlias(o.role)).length > 1);
  assert.ok(shared, "the government's list repeats a component name across agencies");
  const before = count(w);
  assert.equal(make(w, "bea", { built_in: { role: shared.role } }).reason, "NOT_IN_BUILT_IN_LIST");
  assert.equal(count(w), before, "the refusal writes nothing");
  const chosen = make(w, "bea", { built_in: { role: shared.role, body: shared.body } });
  assert.equal(chosen.ok, true, JSON.stringify(chosen));
  assert.equal(w.e.readEntity({ entityId: chosen.entity_id, viewer: "member:bea" }).entity.body, shared.body);
  assert.deepEqual(chosen.built_in, { layer: federal.id, as_of: federal.as_of });
  /* a query matching nothing answers an empty list; the member names the office herself */
  assert.deepEqual(w.e.federalOfficesFind({ query: "zzzzqqq", viewer: "member:bea" }).offices, []);
});

/* affordances, T53's entries (N1260; DEC-409, DEC-410, DEC-447): R72 (each connection kind's dimension), R73 (`DIMENSION_ONWARD`, what
   "Follow from here" offers on each kind of item), R74 at this module's interface (`named_in`, which `connections` registers and routes,
   carried in `connection_kinds` with its class, group and dimension, and reached from an entity over connections' own world), R75's read
   half, and the two ai-account ops the alpha screens send, explained by their `does` words (the ux lane, 6 Nov). Every read is at the
   module's exports or at the provider's interface over its published fixture. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { vocabulariesFor } from "../../../src/affordances.mjs";
import { affordancesAnswer } from "../../../src/affordances/door.mjs";
import { CONNECTION_GROUPS, CONNECTION_GROUP_NAMES, CONNECTION_DIMENSIONS, CONNECTION_DIMENSION_NAMES }
  from "../../../src/affordances/words.mjs";
import { DIMENSION_ONWARD, ONWARD_OTHER, onwardFor } from "../../../src/affordances/onward.mjs";
import { ACT_HELP, ACT_HELP_KEYS, T53_AI_ACCOUNT_OPS } from "../../../src/affordances/act-help.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";
import { owners } from "../../../src/connection-grammar/index.mjs";
import { NAMED_IN_KIND } from "../../../src/connections/index.mjs";
import { world as eventsWorld } from "../events/fixture.mjs";
import { world as dutiesWorld } from "../duties/fixture.mjs";
import { world as rWorld } from "../action-replies/fixture.mjs";
import { world as connectionsWorld, V as CV } from "../connections/fixture.mjs";
import "../../../src/standards/index.mjs";
import "../../../src/progressions/index.mjs";
import "../../../src/hypotheses/index.mjs";
import "../../../src/contradiction/index.mjs";
import "../../../src/entities/index.mjs";

/* the registry as the plane composes it: every owner that registers at load, the events owner at its start, the duties owner at its
   creation, and the action-replies world t48's R59 test composes beside them */
const compose = () => { rWorld(); eventsWorld().ev.start(); dutiesWorld(); };
const registry = () => owners().flatMap((o) => o.kinds.map((k) => k.kind));
const isHunch = (kind) => owners().some((o) => o.kinds.some((k) => k.kind === kind && k.class === "hunch"));

/* ============================================================ R72 */
test("R72: each connection kind answers its dimension, one of the seven or null for a hunch kind, from a frozen map total over the "
   + "registry with no key the registry lacks; the groups are unchanged six, and every kind keeps one", () => {
  compose();
  assert.ok(Object.isFrozen(CONNECTION_DIMENSIONS));
  assert.deepEqual([...CONNECTION_DIMENSION_NAMES], ["people", "organizations", "money", "donations", "events", "documents", "law"]);
  const v = vocabulariesFor(null).connection_kinds;
  const reg = registry();
  assert.deepEqual(v.values, reg);
  for (const kind of reg) {
    assert.ok(Object.hasOwn(CONNECTION_DIMENSIONS, kind), `${kind} has an entry in the dimension map`);
    assert.equal(v.words[kind].dimension, CONNECTION_DIMENSIONS[kind], kind);
    if (isHunch(kind)) assert.equal(v.words[kind].dimension, null, `${kind}, a hunch, joins any two things`);
    else assert.ok(CONNECTION_DIMENSION_NAMES.includes(v.words[kind].dimension), `${kind}: ${v.words[kind].dimension}`);
    assert.ok(CONNECTION_GROUP_NAMES.includes(v.words[kind].group), `${kind} keeps a group`);
  }
  assert.deepEqual(Object.keys(CONNECTION_DIMENSIONS).filter((k) => !reg.includes(k)), [], "no stale key in the dimension map");
  assert.deepEqual(Object.keys(CONNECTION_GROUPS).filter((k) => !reg.includes(k)), [], "no stale key in the group map");
  assert.deepEqual([...CONNECTION_GROUP_NAMES], ["pos", "part", "money", "ment", "same", "step_source"]);
  /* every dimension is used */
  assert.deepEqual([...new Set(reg.map((k) => v.words[k].dimension).filter((d) => d !== null))].sort(), [...CONNECTION_DIMENSION_NAMES].sort());
});

test("R72: the money kinds, named_in and the line kinds have their dimensions and groups; an unmapped kind fails by name", () => {
  compose();
  const v = vocabulariesFor(null).connection_kinds;
  assert.equal(v.words.money_contribution.dimension, "donations");
  assert.equal(v.words.money_contribution.group, "money");
  for (const k of ["money_transfer", "money_payment", "money_revenue", "money_other"]) {
    assert.equal(v.words[k].dimension, "money", k);
    assert.equal(v.words[k].group, "money", k);
  }
  assert.equal(v.words.named_in.group, "ment");
  assert.equal(v.words.named_in.dimension, "documents");
  assert.equal(v.words.hunch.dimension, null);
  const LINE = ["line:related_to", "line:associate_of", "line:educated_at", "line:credentialed_by", "line:part_of", "line:post_in",
    "line:reports_to", "line:oversees", "line:appoints", "line:seat_on", "line:funds", "line:contracts_with", "line:acts_for",
    "line:responsible_for", "line:custodian_of", "line:successor_of", "line:belongs_to", "line:owns_interest_in", "line:party_to",
    "line:appeal_of", "line:consolidated_with", "line:remanded_to", "line:arises_from"];
  for (const k of LINE) {
    assert.ok(Object.hasOwn(CONNECTION_DIMENSIONS, k), `${k} in the dimension map`);
    assert.ok(Object.hasOwn(CONNECTION_GROUPS, k), `${k} in the group map`);
  }
  for (const k of registry().filter((k) => k.startsWith("line:holds:"))) assert.equal(CONNECTION_DIMENSIONS[k], "organizations", k);
  /* control: the same totality check over a registry with a kind the map lacks names that kind */
  const unmapped = [...registry(), "fixture_kind_x"].filter((k) => !Object.hasOwn(CONNECTION_DIMENSIONS, k));
  assert.deepEqual(unmapped, ["fixture_kind_x"]);
});

/* ============================================================ R73 */
const entries = (kind) => onwardFor(kind).map((x) => x.entry);
const WHO = ["who.money", "who.donations", "who.offices", "who.laws", "who.events", "who.docs", "who.rows", "conn"];
const OWN = { person: "people", donation: "donations", event: "events", document: "documents", fund: "organizations" };

test("R73: DIMENSION_ONWARD equals R73's list and the no-target answer carries it", () => {
  assert.ok(Object.isFrozen(DIMENSION_ONWARD));
  const e = (entry, dimension, op, also) => (also ? { entry, dimension, op, also } : { entry, dimension, op });
  const conn = e("conn", "connections", "explore");
  const who = [e("who.money", "money", "followfrom"), e("who.donations", "donations", "followfrom"),
    e("who.offices", "organizations", "followfrom"), e("who.laws", "law", "followfrom"), e("who.events", "events", "followfrom"),
    e("who.docs", "documents", "followfrom", "search"), e("who.rows", "registers", "registersearch"), conn];
  const money = [e("money.who", "people", "followfrom"), e("money.more", "money", "followfrom"), e("money.events", "events", "followfrom"),
    e("money.docs", "documents", "search"), e("rows.match", "registers", "registersearch"), conn];
  assert.deepEqual(JSON.parse(JSON.stringify(DIMENSION_ONWARD)), {
    person: who, organization: who,
    fund: who.filter((x) => !["who.offices", "who.laws", "who.donations"].includes(x.entry)),
    payment: money, donation: money,
    event: [e("event.who", "people", "followfrom"), e("event.money", "money", "followfrom"), e("event.docs", "documents", "search"),
      e("event.rows", "registers", "registersearch"), conn],
    document: [e("document.who", "people", "followfrom"), e("document.money", "money", "followfrom"),
      e("document.events", "events", "followfrom"), e("document.laws", "law", "followfrom"), e("rows.match", "registers", "registersearch"), conn],
  });
  assert.deepEqual(entries("person"), WHO);
  assert.deepEqual(entries("fund"), ["who.money", "who.events", "who.docs", "who.rows", "conn"]);
  for (const k of ["office", "ordinance", "contract", "place", "inquiry", undefined, null]) assert.deepEqual(entries(k), ["conn"], String(k));
  assert.equal(onwardFor("office"), ONWARD_OTHER);
  /* only who.docs names a second op */
  assert.deepEqual(Object.values(DIMENSION_ONWARD).flat().filter((x) => x.also).map((x) => `${x.entry}+${x.also}`).filter((v, i, a) => a.indexOf(v) === i),
    ["who.docs+search"]);
  /* every dimension is one of R72's seven, `registers` or `connections` */
  for (const x of Object.values(DIMENSION_ONWARD).flat())
    assert.ok([...CONNECTION_DIMENSION_NAMES, "registers", "connections"].includes(x.dimension), x.entry);
  /* R17 as R73 amends it: the no-target answer carries the table itself; a targeted answer does not */
  assert.equal(affordancesAnswer({ kinds: null, gate: null }).dimension_onward, DIMENSION_ONWARD);
  assert.equal(Object.hasOwn(affordancesAnswer({ target: "INFO-x", facts: { ok: true, object_type: "information" }, kinds: null, gate: null }),
    "dimension_onward"), false);
});

test("R73 control: on a person, an event, a document, a donation and a fund no entry points back into the item's own dimension but conn; "
   + "a table that did would be seen", () => {
  for (const [kind, own] of Object.entries(OWN))
    assert.deepEqual(onwardFor(kind).filter((x) => x.dimension === own).map((x) => x.entry), [], kind);
  const bad = { ...DIMENSION_ONWARD, person: [...DIMENSION_ONWARD.person, { entry: "who.people", dimension: "people", op: "followfrom" }] };
  assert.deepEqual(bad.person.filter((x) => x.dimension === "people").map((x) => x.entry), ["who.people"]);
});

/* ============================================================ R74, at this module's interface */
test("R74: named_in is carried in connection_kinds and an entity reaches its document by a named_in hop", () => {
  compose();
  const v = vocabulariesFor(null).connection_kinds;
  assert.equal(NAMED_IN_KIND, "named_in");
  assert.equal(v.values.filter((k) => k === "named_in").length, 1);
  const w0 = v.words.named_in;
  assert.equal(w0.class, "evidentiary");
  assert.equal(w0.owner, "connections");
  assert.equal(w0.group, "ment");
  assert.equal(w0.dimension, "documents");
  assert.ok(typeof w0.word === "string" && w0.word.length > 0);
  /* over connections' own world: an entity resolved in one capture of a document reaches the document; an unresolved one makes no hop */
  const w = connectionsWorld();
  w.member("alice");
  const E = "ENT-2026-0301", A = "INFO-2026-0301-a";
  w.entity(E, "The Board");
  w.entity("ENT-2026-0302", "Nobody");
  const [a1] = w.doc(A, ["alpha"]);
  w.resolve(a1, A, "the board", E, "B");
  const hops = w.k.neighbours({ at: "2026-10-01", scope: null, node: E, viewer: CV("alice") }).items.filter((i) => i.kind === NAMED_IN_KIND);
  assert.deepEqual(hops.map((i) => i.to), [A]);
  const none = w.k.neighbours({ at: "2026-10-01", scope: null, node: "ENT-2026-0302", viewer: CV("alice") }).items
    .filter((i) => i.kind === NAMED_IN_KIND);
  assert.deepEqual(none, []);
});

/* ============================================================ R75 */
test.todo("R75: a team with no profile registers a proceeding (court, number, kind typed by name) and the screen draws parties, register "
  + "and orders — the read half (`proceeding_kinds` `[]` with no profile, R67) is met; the write half is `entities`' (it refuses "
  + "PROCEEDING_KIND_UNKNOWN with no profile kind) and the screen's (`screens-investigate` R36, R47)");

/* ============================================================ ACT_HELP: the ai-account ops (the ux lane, 6 Nov) */
test("R48 R62: ACT_HELP holds aiaccountadd and aiaccountswitch, each answering its act.<op>.does word; control: no owed_ key for either", () => {
  assert.deepEqual([...T53_AI_ACCOUNT_OPS], ["aiaccountadd", "aiaccountswitch"]);
  for (const op of T53_AI_ACCOUNT_OPS) {
    assert.ok(hasWord(`act.${op}.does`), `${op}: the word list holds its text`);
    assert.equal(ACT_HELP_KEYS[op], `act.${op}.does`, op);
    assert.equal(ACT_HELP[op], word(`act.${op}.does`), op);
    assert.equal(Object.hasOwn(ACT_HELP, `owed_${op}`), false, op);
  }
  assert.equal(affordancesAnswer({ kinds: null, gate: null }).act_help.aiaccountadd, word("act.aiaccountadd.does"));
});

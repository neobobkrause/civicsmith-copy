/* store-assembly's copy of plane's test of this name (K624: by copy). store-assembly R20–R22 (T33-90): the modules T33 adds, composed on the object's storage. Each is built at its place, its
   tables made and declared through record-core, its start registrations held before the first request, handed the
   instances it reads (one per host), and its ops map spread into the route map; the content types registered into
   docprofile's registry (R21); and the registrations an earlier module cannot make of a later one (R22). Driven on the
   Durable Object class itself; each module's own behaviour is its own tests'. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { store, storage, assembleStore, disclosed } from "./fixture.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { schedulerOf } from "../../../src/scheduler/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { eventsOf, eventsOps } from "../../../src/events/index.mjs";
import { linesOf, linesOps } from "../../../src/lines/index.mjs";
import { moneyOf, moneyOps } from "../../../src/money/index.mjs";
import { moneyChecksOf, moneyChecksOps } from "../../../src/money-checks/index.mjs";
import { dutiesOf, dutiesOps } from "../../../src/duties/index.mjs";
import { peopleOf, peopleOps } from "../../../src/people/index.mjs";
import { exploreOps } from "../../../src/explore/index.mjs";
import { calculationsOf, calculationsOps } from "../../../src/calculations/index.mjs";
import { workbooksOf, workbooksOps } from "../../../src/workbooks/index.mjs";
import { legEarningOf, legEarningOps } from "../../../src/leg-earning/index.mjs";
import { hypothesesOf, hypothesesOps } from "../../../src/hypotheses/index.mjs";
import { answersOf, answersOps } from "../../../src/answers/index.mjs";
import { caseTensionsOf, caseTensionsOps } from "../../../src/case-tensions/index.mjs";
import { followingOf, followingOps } from "../../../src/following/index.mjs";
import { localFactsOf } from "../../../src/local-facts/index.mjs";
import { standardsOf } from "../../../src/standards/index.mjs";
import { inquiryOf } from "../../../src/inquiry/index.mjs";
import { defaultRegistry } from "../../../src/connection-grammar/index.mjs";
import { doctypes, registerDoctype } from "../../../../docprofile/registry.mjs";
import { DOCTYPES } from "../../../../doctypes/index.mjs";
import { legistar } from "../../../../legistar-reader/index.mjs";
import { ROSTER_TYPES } from "../../../../roster-reader/index.mjs";
import { COURT_TYPES } from "../../../../court-doctypes/index.mjs";
import { BUDGET_TYPES } from "../../../../budget-doctypes/index.mjs";
import { rosterSource, LEVEL_READ, LEVEL_NOT_READ } from "../../../../roster-reader/index.mjs";
import { registerReaders, rosterReads, ROSTER_CONTENT_TYPES, officePorts, dutiesFactOf, sheetRecompute, NO_ENGINE,
         retrievalTerms } from "../../../src/store-assembly/wiring.mjs";

const tableNames = (x) => [...x.ctx.storage.sql.exec(`SELECT name FROM sqlite_master WHERE type='table'`)].map((r) => r.name);
const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');

/* Every module that declared a table to purge, in declaration order (record-core R21), each named once. */
function declarers(x) {
  const rc = recordOf(x.ctx), out = [];
  for (const t of Object.keys(rc.purge().removed)) {
    const m = rc.declarePurge("zz-probe", [t]).declaredBy;
    if (!out.includes(m)) out.push(m);
  }
  return out;
}

/* R20's modules with tables, each with its own maps and the instance the plane built. */
const NEW = ["events", "lines", "money", "money-checks", "duties", "people", "calculations", "workbooks", "leg-earning",
             "hypotheses", "answers", "case-tensions", "following"];

test("R20: construction builds each module T33 adds, each declaring its tables through record-core under its own name, before the first request", async () => {
  const x = await store();
  const order = declarers(x);
  for (const m of [...NEW, "local-facts", "standards"]) assert.ok(order.includes(m), `${m} declared its tables: ${order.join()}`);
  /* a table of each is made, and declared under its owner's name */
  const rc = recordOf(x.ctx);
  for (const [t, m] of [["events", "events"], ["lines", "lines"], ["money_facts", "money"], ["duties", "duties"],
                        ["inquiry_basis", "leg-earning"]]) {
    assert.ok(tableNames(x).includes(t), `table ${t}`);
    assert.equal(rc.declarePurge("zz-probe", [t]).declaredBy, m, t);
  }
  /* negative control: a table no module declared is free to a probe */
  assert.equal(rc.declarePurge("zz-probe", ["zz_none"]).ok, true);
});

test("R20, R3: a store written before T33's modules opens with their tables, and a second construction changes nothing", async () => {
  const db = new DatabaseSync(":memory:");
  await store({ db });
  const dropped = ["events", "event_when_cache", "lines", "money_facts", "duties", "people_facts"]
    .filter((t) => [...db.prepare(`SELECT name FROM sqlite_master WHERE type='table' AND name=?`).all(t)].length);
  assert.ok(dropped.length >= 4, dropped.join());
  for (const t of dropped) db.exec(`DROP TABLE ${t}`);
  const old = await store({ db });
  for (const t of dropped) assert.ok(tableNames(old).includes(t), `table ${t} made again`);
  const shape = (x) => [...x.ctx.storage.sql.exec(`SELECT type, name, sql FROM sqlite_master ORDER BY type, name`)].map((r) => ({ ...r }));
  const was = shape(old);
  assert.deepEqual(shape(await store({ db })), was, "the second migration changes no table");
});

test("R20: before the first request each new module's start registrations are held: promotion steps, connection owners, and calculations' fills of money, duties and people", async () => {
  const x = await store();
  const p = promotionOf(x.ctx);
  for (const m of ["money", "hypotheses", "standards", "case-tensions"])
    assert.equal(p.registerStep(m, {}).ok, false, `${m}'s step is held`);
  /* the connection owners, each answering for this host */
  const owners = defaultRegistry.owners().map((o) => o.owner);
  for (const o of ["events", "lines", "money", "duties", "people", "hypotheses"]) assert.ok(owners.includes(o), `owner ${o}`);
  /* calculations filled its three registrations at creation (its R19, R20; money R23): a second is refused */
  assert.equal(moneyOf(x.ctx).onFactChanged("calculations", () => null).reason, "LISTENER_DECLARED");
  assert.equal(dutiesOf(x.ctx).registerOccurrenceEvidence("calculations", () => []).reason, "LISTENER_DECLARED");
  assert.equal(peopleOf(x.ctx).registerRosterSource("calculations", () => ({})).reason, "LISTENER_DECLARED");
  /* negative control: on a host the plane never built, the slot is free */
  assert.equal(moneyOf(storage().ctx).onFactChanged("calculations", () => null).ok, true);
});

test("R20 (scheduler R21): the scheduler reaches the six consumers' owners the plane built, one instance per host", async () => {
  const x = await store();
  const consumers = schedulerOf(x.ctx).consumers();
  for (const c of ["follow", "duty-transitions", "interest-checks", "money-detectors", "standing-questions", "dated-waits"])
    assert.ok(consumers.includes(c), `scheduler holds ${c}: ${consumers.join()}`);
  /* the owners it asks are the plane's instances (each factory answers the one instance per host) */
  const again = await Promise.all([dutiesOf(x.ctx), peopleOf(x.ctx), moneyChecksOf(x.ctx), answersOf(x.ctx), inquiryOf(x.ctx), followingOf(x.ctx)]);
  assert.ok(again.every(Boolean));
  assert.equal(dutiesOf(x.ctx), dutiesOf(x.ctx, { factOf: null }), "a later call's deps change nothing");
});

test("R20 (K1573): money is handed calculations' bindingOf as its port: a fact read from a table row asks the plane's calculations", async () => {
  const x = await store();
  const asked = [];
  let fact;
  const c = calculationsOf(x.ctx), was = c.bindingOf;
  c.bindingOf = (k) => { asked.push(k); return null; };
  try {
    const r = await moneyOf(x.ctx).recordFact(fact = { amount: "10.00", as_read: "$10.00", currency: "USD", sign: "+", precision: "exact",
      kind: "payment", phase: "actual", stage: "paid", basis: "cash", period: { from: "2026-01-01", to: "2026-01-31", precision: "day", zone: "America/Los_Angeles" },
      source: { table: "a".repeat(64), row: 1, binding: "BIND-zz" }, by: "member:ann" });
    assert.equal(r.ok, false);
    assert.deepEqual(asked, ["BIND-zz"], "the binding was asked of the plane's calculations");
    assert.doesNotMatch(JSON.stringify(r), /not wired here/);
  } finally { c.bindingOf = was; }
  /* negative control: money on a host the plane never built has no port, and says so */
  const bare = storage();
  recordOf(bare.ctx).migrate();
  const m = moneyOf(bare.ctx);
  m.migrate();
  const r = await m.recordFact(fact);
  assert.match(JSON.stringify(r), /not wired here/);
});

test("R20 (K1541): credentials holds the deployment's seal secret, so a member's reference is sealed; unbound, it is refused ACCOUNT_SEAL_UNAVAILABLE", async () => {
  const member = (x) => x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                                                 VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  /* R35 (T47): the disclosure first, as the assembled plane asks */
  const set = async (x) => { await disclosed(x.ctx); return credentialsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-test", by: "member:ann" }); };
  const sealed = await store({ env: { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-test-only" } });
  member(sealed);
  const ok = await set(sealed);
  assert.equal(ok.ok, true, JSON.stringify(ok));
  const unsealed = await store();
  member(unsealed);
  const no = await set(unsealed);
  assert.equal(no.ok, false);
  assert.equal(no.reason ?? no.code, "ACCOUNT_SEAL_UNAVAILABLE");
});

test("R20 (K1571, K1551): standards' keyed store is the sealed credentials, the deployment's environment and the governor, so the citation lookup reads the group's key", async () => {
  const env = { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-test-only", VERSION: "9.9.9" };
  const x = await store({ env });
  const s = standardsOf(x.ctx);
  const ks = typeof s.keyedStoreRef === "function" ? s.keyedStoreRef() : s.keyedStoreRef;
  assert.equal(ks.credentials, credentialsOf(x.ctx), "the one credentials instance, holding the seal");
  assert.equal(ks.env.VERSION, "9.9.9", "the deployment's environment");
  assert.equal(typeof ks.governor.governorAdmit, "function", "the host's governor");
  /* with no key set, the keyed service is off, never a failure (acquisition R35) */
  assert.equal((await ks.credentials.keyedServiceFor({ service: "courtlistener" })).ok, false);
});

test("R20 (K1563 (10), K1654): local-facts and conformance are handed the seeded offices' reads, which answer null until instance-setup answers them", () => {
  const ports = officePorts(() => ({ officeOf: (id, p) => (id === "ENT-1" ? { role: "Clerk", body: p } : null),
                                     officeEntityOf: (o) => (o.role === "Clerk" ? "ENT-1" : null) }));
  assert.deepEqual(ports.officeOf("ENT-1", "oak"), { role: "Clerk", body: "oak" });
  assert.equal(ports.officeOf("ENT-2", "oak"), null);
  assert.equal(ports.officeEntityOf({ role: "Clerk", body: "x" }), "ENT-1");
  /* negative controls: an instance-setup that answers neither, or throws, answers null (fails closed) */
  const none = officePorts(() => ({}));
  assert.equal(none.officeOf("ENT-1", "oak"), null);
  assert.equal(none.officeEntityOf({ role: "Clerk" }), null);
  const throws = officePorts(() => ({ officeOf: () => { throw new Error("x"); } }));
  assert.equal(throws.officeOf("ENT-1"), null);
});

test("R20 (K1569): duties' factOf answers a closure-list entry as the profile's list and an office-calendar entry from local-facts", async () => {
  const x = await store();
  const f = dutiesFactOf(() => localFactsOf(x.ctx));
  assert.deepEqual(f({ list: "court_days", year: 2026, days: [] }), { status: "profile_list" });
  const r = f({ profile: "zz-none", year: 2026, days: [] });
  assert.equal(typeof r.status, "string");
  assert.notEqual(r.status, "profile_list");
  /* negative control: no local-facts reachable */
  assert.equal(dutiesFactOf(() => null)({ year: 2026 }).status, "absent");
});

test("R20 (K1593): retrieval's providers answer the owners' rules: standards for a bundle's citations, lines' holder of each office on the bundle's date", () => {
  const asked = [];
  const t = retrievalTerms({
    standards: () => ({ standardsFor: (a) => { asked.push(["standardsFor", a.target]); return { ok: true, items: [{ standard: "STD-1" }, { standard: null }] }; } }),
    lines: () => ({ holderAt: (a) => { asked.push(["holderAt", a.office, a.at]); return a.office === "ENT-o" ? { holder: "ENT-p" } : { undetermined: "no line" }; } }),
    sql: () => ({ exec: () => [{ id: "ENT-o" }, { id: "ENT-q" }] }),
  });
  assert.deepEqual(t.standard({ bundleId: "B-1" }), ["STD-1"]);
  const files = [{ path: "bundle.md", text: "---\ncreated: \"2026-03-04T00:00:00Z\"\n---\n" }];
  assert.deepEqual(t.holder({ bundleId: "B-1", files }), ["ENT-p"], "only a holder lines determines");
  assert.deepEqual(asked.slice(1), [["holderAt", "ENT-o", "2026-03-04"], ["holderAt", "ENT-q", "2026-03-04"]]);
  /* negative control: no date of its own, no holder */
  assert.deepEqual(t.holder({ bundleId: "B-1", files: [] }), []);
});

test("R20 (K1570): workbooks recomputes through SHEET_WORKER with the object's namespace; none bound is 'no engine bound'", async () => {
  const calls = [];
  const env = { SHEET_WORKER: { fetch: async (u, init) => { calls.push([u, JSON.parse(init.body)]); return new Response(JSON.stringify({ ok: false, reason: "NOT_ENABLED" })); } } };
  const x = await store({ env });
  const w = workbooksOf(x.ctx);
  assert.equal(typeof w.engine, "function", "workbooks holds the plane's recompute");
  assert.deepEqual(await w.engine("ab".repeat(32)), { ok: false, reason: "NOT_ENABLED" });
  assert.deepEqual(calls, [["https://sheet-worker/recompute", { capture_sha: "ab".repeat(32), store: "bio" }]]);
  /* negative control: unbound, the refusal workbooks records as "not recomputed here" */
  assert.deepEqual(await sheetRecompute({}, () => "bio")("ab".repeat(32)), NO_ENGINE);
  const y = await store();
  assert.deepEqual(await workbooksOf(y.ctx).engine("ab".repeat(32)), NO_ENGINE);
});

test("R20, R6: every op of each new module's map is in the route map and answers through control-plane's door what its own map answers called directly", async () => {
  const u = new URL("http://do/");
  const maps = [["events", (c) => eventsOps(eventsOf(c), u, null)], ["lines", (c) => linesOps(linesOf(c), u, null)],
    ["money", (c) => moneyOps(moneyOf(c), u, null)], ["money-checks", (c) => moneyChecksOps(moneyChecksOf(c), u, null)],
    ["duties", (c) => dutiesOps(dutiesOf(c), u, null)], ["people", (c) => peopleOps(peopleOf(c), u, null)],
    ["explore", () => exploreOps(null, u, null)], ["calculations", (c) => calculationsOps(calculationsOf(c), u, null)],
    ["workbooks", (c) => workbooksOps(workbooksOf(c), u, null)], ["leg-earning", (c) => legEarningOps(legEarningOf(c), u)],
    ["hypotheses", (c) => hypothesesOps(hypothesesOf(c), u, null)], ["answers", (c) => answersOps(answersOf(c), u, null)],
    ["case-tensions", (c) => caseTensionsOps(caseTensionsOf(c), u, null)], ["following", (c) => followingOps(followingOf(c), u, null)]];
  const x = await store(), twin = await store();
  const map = Object.keys(x.s.routes(u, null));
  let n = 0;
  for (const [mod, f] of maps) {
    const ops = Object.keys(f(x.ctx));
    assert.ok(ops.length > 0, mod);
    for (const op of ops) assert.ok(map.includes(op), `the route map lacks ${mod}'s ${op}`);
    /* each read answers through the door as its own map answers on a twin */
    for (const op of ops) {
      const path = `${op}?viewer=member:nobody&id=X-none&entity=ENT-none&event=EVT-none`;
      const res = await x.fetch(`/${path}`);
      if (res.status !== 200) continue;
      const own = { events: eventsOps, lines: linesOps, money: moneyOps, duties: dutiesOps, people: peopleOps }[mod];
      if (!own) continue;
      const inst = { events: eventsOf, lines: linesOf, money: moneyOf, duties: dutiesOf, people: peopleOf }[mod](twin.ctx);
      let direct;
      try { direct = await own(inst, new URL(`http://do/${path}`), null)[op](); } catch { continue; }
      const body = JSON.parse(mask(await res.text()));
      if (body.ok !== true) continue;
      assert.deepEqual(body, JSON.parse(mask(JSON.stringify({ ok: true, result: direct ?? null }))), `${mod} ${op}`);
      n++;
    }
  }
  assert.ok(n >= 10, `${n} answers compared`);
});

test("R21 (T33-12; docprofile R36): the content types are registered into docprofile's registry in the stated order, once each, generic the fallback", async () => {
  await store();
  const keys = doctypes().map((t) => t.key);
  const want = [...DOCTYPES.map((t) => t.key), legistar.key, ...ROSTER_TYPES.map((t) => t.key), ...COURT_TYPES.map((t) => t.key),
                ...BUDGET_TYPES.map((t) => t.key)];
  for (const k of want) assert.ok(keys.includes(k), `registered: ${k}`);
  assert.equal(new Set(keys).size, keys.length, "each key once");
  /* doctypes' own types took their seeds' slots: the registry holds doctypes' objects */
  for (const t of DOCTYPES) assert.equal(doctypes().find((d) => d.key === t.key), t, t.key);
  /* the readers' keys follow in the stated order */
  const at = (k) => keys.indexOf(k);
  const tail = want.slice(DOCTYPES.length);
  for (let i = 1; i < tail.length; i++) assert.ok(at(tail[i - 1]) < at(tail[i]), `${tail[i - 1]} before ${tail[i]}`);
  /* generic is the one fallback */
  assert.deepEqual(doctypes().filter((t) => t.fallback).map((t) => t.key), ["generic"]);
  /* a second registration registers nothing new */
  const n = keys.length;
  registerReaders();
  assembleStore(storage().ctx, { STORE: { idFromName: (s) => s } });
  assert.equal(doctypes().length, n);
  /* the steps answer in the stated order, generic last */
  assert.deepEqual(registerReaders().map(([m]) => m), ["doctypes", "legistar-reader", "roster-reader", "court-doctypes", "budget-doctypes", "generic"]);
  assert.equal(registerDoctype({ key: "zz" }).ok, false, "negative control: a type with no detect is refused by the seam");
});

/* N633 (K1730; roster-reader R12): the held rosters of one organisation, seeded as the modules that own them hold them:
   bundles (record-core), extraction's placed reading and its text units, entities' resolutions, calculations' tables
   and the canonical bytes it keeps for a synchronous read. `hidden` is filed in a project ann is not on. */
const ORG = "ENT-2026-0001-org", OTHER = "ENT-2026-0002-other";
const CHART = "Records Division\nDirector Jane Doe\nManager\nJohn Roe";
function seedRosters(x) {
  const sql = x.ctx.storage.sql;
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  for (const [id, kind] of [[ORG, "organisation"], [OTHER, "organisation"]])
    sql.exec(`INSERT INTO entities (entity_id, kind, label) VALUES (?, ?, ?)`, id, kind, id);
  const bundle = (id, project = null) => sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state,
      created, last_updated, bundle_sha, project) VALUES (?, 'information', 'g', ?, 'collected', 't', 't', 'sha', ?)`, id, id, project);
  const capture = (sha, bid, type, text, entity) => {
    sql.exec(`INSERT INTO readings (capture_sha, bundle_id, content_type, reading) VALUES (?, ?, ?, '{}')`, sha, bid, type);
    text.split("\n").forEach((t, seq) => sql.exec(`INSERT INTO capture_text (capture_sha, bundle_id, extent_kind, extent, ref, seq,
        text, chain_kind) VALUES (?, ?, 'doc-para', ?, ?, ?, ?, 'text')`, sha, bid, String(seq), `para ${seq}`, seq, t));
    sql.exec(`INSERT INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, method) VALUES (?, ?, 'r', ?, 'B', 'm')`, sha, bid, entity);
  };
  const table = (sha, bid, capSha, header, rows) => {
    const csv = [header, ...rows].map((r) => r.join(",")).join("\r\n") + "\r\n";
    sql.exec(`INSERT INTO calc_tables (sha, bundle_id, source_json, schema_json, header_json, rows, bytes, undetermined_json,
        undetermined_count, declared_by, declared_at) VALUES (?, ?, ?, '{}', ?, ?, ?, '[]', 0, 'class:daemon', 't')`,
      sha, bid, JSON.stringify({ capture_sha: capSha }), JSON.stringify(header), rows.length, csv.length);
    sql.exec(`INSERT INTO calc_table_bytes (sha, seq, bundle_id, chunk) VALUES (?, 0, ?, ?)`, sha, bid, csv);
  };
  bundle("INFO-1"); bundle("INFO-2"); bundle("INFO-3"); bundle("INFO-4", "PROJ-2026-0001-closed");
  capture("c1", "INFO-1", "org_chart", CHART, ORG);                        /* read: placed as a chart, resolved to ORG */
  capture("c2", "INFO-2", "org_chart", CHART, OTHER);                      /* not ORG's */
  capture("c3", "INFO-2", "agenda", CHART, ORG);                           /* ORG's, not placed as a roster */
  capture("c4", "INFO-4", "staff_roster", CHART, ORG);                     /* ORG's, in a project ann is not on */
  capture("c5", "INFO-3", "budget", "Fund,Amount", ORG);                   /* the source of two tables below */
  table("t1", "INFO-3", "c5", ["Full Name", "Job Title", "Department", "Phone"],
        [["Ann Lee", "Chair", "Finance", "510-555-0101"], ["Bo Diaz", "Clerk", "Records", ""]]);
  table("t2", "INFO-3", "c5", ["Fund", "Amount"], [["General", "100"]]);   /* R6 names no roster: not handed */
  table("t3", "INFO-2", "c2", ["Full Name", "Job Title"], [["Cy Ng", "Chair"]]);   /* OTHER's */
}

test("R22 (K1505 (6); N633, K1730; roster-reader R12): people's roster-reader source reads the organisation's held rosters through the store's read: captures placed as a roster or chart resolving to it, and calculations' tables with R6's roles, each within the viewer's sight; registered once", async () => {
  const x = await store();
  seedRosters(x);
  const again = peopleOf(x.ctx).registerRosterSource("roster-reader", rosterSource(rosterReads({ sql: () => x.ctx.storage.sql })));
  assert.equal(again.ok, false);
  assert.equal(again.reason, "LISTENER_DECLARED", "the plane registered it at construction");
  const staffing = (viewer) => {
    const a = peopleOf(x.ctx).staffingAt({ organisation: ORG, at: "2026-01-01", viewer });
    assert.equal(a.ok, true, JSON.stringify(a).slice(0, 300));
    const r = a.rosters.find((s) => s.source === "roster-reader");
    assert.ok(r, JSON.stringify(a.rosters).slice(0, 300));
    return r.answer;
  };
  const ann = staffing("member:ann");
  assert.equal(ann.level, LEVEL_READ);
  assert.deepEqual(ann.rosters.map((r) => r.source), [{ capture_sha: "c1" }, { table: "t1" }],
                   "the chart placed and resolved to ORG and its roster table; nothing of OTHER, no agenda, no money table, nothing out of sight");
  assert.deepEqual(ann.rosters[0].rows.map((r) => [r.name, r.title]), [["Jane Doe", "Director"]], "the chart read by roster-reader R3");
  assert.deepEqual(ann.rosters[1].rows.map((r) => [r.name, r.title, r.unit]), [["Ann Lee", "Chair", "Finance"], ["Bo Diaz", "Clerk", "Records"]],
                   "the table read through R6's roles");
  assert.doesNotMatch(JSON.stringify(ann), /510-555/, "a contact column is never read (roster-reader R4)");
  assert.deepEqual(ROSTER_CONTENT_TYPES, ["staff_roster", "org_chart"]);
  /* the administrative class's whole read reaches the project's roster too; a viewer the gate does not know sees none */
  assert.deepEqual(staffing("class:admin").rosters.map((r) => r.source), [{ capture_sha: "c1" }, { capture_sha: "c4" }, { table: "t1" }]);
  /* D54 (K2408, K2442; N822): an administrator member neither invited to nor joined to the hidden project sees it only
     at EXISTENCE, so its roster is not read for her; the rest of her sight is ann's */
  x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  assert.deepEqual(staffing("member:ada").rosters.map((r) => r.source), [{ capture_sha: "c1" }, { table: "t1" }],
                   "the hidden project's roster is not hers to read");
  /* negative control: the store's read refuses or fails, and the source says it reads no held roster */
  const failing = rosterReads({ sql: () => { throw new Error("storage gone"); } })({ organisation: ORG, viewer: "class:admin" });
  assert.equal(failing.ok, false);
  const notRead = rosterSource(rosterReads({ sql: () => { throw new Error("storage gone"); } }))({ organisation: ORG, at: "2026-01-01" });
  assert.equal(notRead.level, LEVEL_NOT_READ);
  assert.deepEqual(rosterReads({ sql: () => x.ctx.storage.sql })({ organisation: ORG, viewer: "nobody" }), { items: [] }, "a viewer the gate does not know sees nothing");
  /* a bare people instance holds no roster-reader source */
  assert.equal(peopleOf(storage().ctx).registerRosterSource("roster-reader", rosterSource(() => [])).ok, true);
});

test("R22 (K1505 (3); publication R61): case-tensions holds publication's provider, registered once, and the route map's `caseflags` and `attribute` are case-tensions'", async () => {
  const x = await store();
  const ct = caseTensionsOf(x.ctx);
  assert.deepEqual(ct.publicationProvider(), { registered: true, module: "publication" });
  const u = new URL("http://do/caseflags?limit=5");
  const map = x.s.routes(u, null);
  assert.deepEqual(JSON.parse(JSON.stringify(await map.caseflags())), JSON.parse(JSON.stringify(await caseTensionsOps(ct, u, null).caseflags())));
  /* negative control: a second provider is refused, the plane's stands */
  assert.equal(ct.registerPublicationProvider("zz-probe", {}).ok, false);
});

test("R20 (queue R51; K1683): notice-producers is built over the plane's instances, and op=queue reads it beside queue-producers", async () => {
  const { noticeProducersOf } = await import("../../../src/notice-producers/index.mjs");
  const x = await store();
  x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                          VALUES ('bob', 'Cover bob', 'h_bob', 'member', 'active', '["contribute"]', 't', 't')`);
  const np = noticeProducersOf(x.ctx);
  /* its providers answer: none fails on the plane's host */
  const direct = np.noticeItems({ member: "bob", viewer: "member:bob", now: Date.now(), identity: "member:bob",
                                  homesOf: () => null, optionsOf: () => [] });
  assert.deepEqual(direct.facts.failed ?? [], [], JSON.stringify(direct.facts));
  /* through the door, queue asks the plane's instance */
  const asked = [];
  const was = np.noticeItems.bind(np);
  np.noticeItems = (a) => { asked.push(a.member); return was(a); };
  try {
    const r = await (await x.fetch("/queue?member=bob&viewer=member:bob")).json();
    assert.equal(r.ok, true, JSON.stringify(r));
    assert.deepEqual(asked, ["bob"], "queue read the plane's notice-producers");
  } finally { np.noticeItems = was; }
});

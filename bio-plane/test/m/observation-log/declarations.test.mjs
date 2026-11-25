/* observation-log at T33 (T33-30): the lead id's shape read from record-grammar's one id table (R34), and the module's
   three tables declared explicitly to record-core with their classes (R35), driven at the interface: the exported
   pattern against `idPattern`, and the declarations as `declaredTables()` and `purge` answer them. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, storage, V } from "./fixture.mjs";
import { LEAD_ID_RE, OBSERVATION_LOG_TABLES, observationLogOf } from "../../../src/observation-log/index.mjs";
import { ID_TABLE, idPattern } from "../../../src/record-grammar/ids.mjs";
import { recordOf, recordCoreOps, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";

const TAIL = /^[a-z0-9]+$/;

test("R34 LEAD_ID_RE is idPattern(\"LEAD\")'s core with the lead's tail composed after it: it accepts an id exactly when record-grammar's core accepts its core and the tail is the lead's, over every core and tail form; LEAD is ID_TABLE's, owned by observation-log; every lead minted, before T33 or now, stays valid", () => {
  const rows = ID_TABLE.filter((e) => e.prefix === "LEAD");
  assert.deepEqual(rows.map((e) => [e.prefix, e.owner]), [["LEAD", "observation-log"]], "one row, this module's");
  const core = idPattern("LEAD");
  assert.ok(core instanceof RegExp);
  /* Every shape a core and a tail take: the year's and the counter's widths, other prefixes, case, separators. */
  const cores = ["LEAD-2026-0927", "LEAD-2026-1231", "LEAD-2026-0101", "LEAD-2026-10000", "LEAD-1999-0000",
    "LEAD-2026-092", "LEAD-26-0927", "LEAD-20266-0927", "LEAD-2026-09-27", "lead-2026-0927", "LEADS-2026-0927",
    "ENT-2026-0927", "INFO-2026-0001", "LEAD-2026-", "LEAD--0927", "LEAD-2026-0927x", " LEAD-2026-0927", ""];
  const tails = ["aaaaaaaaaaaa", "0123456789ab", "000000000000", "abc", "a", "z9", "ABCDEF012345", "", "ab-cd",
    "ab_cd", "ab cd", "é", "aaaaaaaaaaaa\n"];
  let accepted = 0;
  for (const c of cores) for (const t of tails) {
    const id = `${c}-${t}`;
    const want = core.test(c) && TAIL.test(t);
    assert.equal(LEAD_ID_RE.test(id), want, JSON.stringify(id));
    if (want) accepted++;
  }
  assert.ok(accepted > 0);
  /* no id without a tail, and nothing but the whole string */
  for (const id of ["LEAD-2026-0927", "LEAD-2026-0927-", "xLEAD-2026-0927-abc", "LEAD-2026-0927-abc x"])
    assert.equal(LEAD_ID_RE.test(id), false, id);
  /* ids minted before T33 (R14's form), as this suite and the stores hold them */
  for (const id of ["LEAD-2026-0927-aaaaaaaaaaaa", "LEAD-2026-0101-000000000000", "LEAD-2026-0901-aaaaaaaaaaaa"])
    assert.equal(LEAD_ID_RE.test(id), true, id);
  /* and every lead minted now: R14's form, accepted by the pattern */
  const w = world({ now: "2026-12-31T23:59:59Z" });
  for (let i = 0; i < 50; i++) {
    const id = w.obs.lead({ words: `w${i}`, author: "alice" }).lead_id;
    assert.match(id, /^LEAD-2026-1231-[0-9a-f]{12}$/);
    assert.equal(LEAD_ID_RE.test(id), true, id);
    assert.equal(core.test(id.slice(0, -13)), true, "its core is idPattern's");
  }
  /* the exported pattern holds no state between calls (a sticky or global flag would) */
  assert.equal(LEAD_ID_RE.global || LEAD_ID_RE.sticky, false);
  assert.equal(LEAD_ID_RE.test("LEAD-2026-0927-abc"), true);
  assert.equal(LEAD_ID_RE.test("LEAD-2026-0927-abc"), true);
});

const CLASSES = ["purge", "expunge", "export", "sight", "derive", "version_chain"];

test("R35 R23 every table declared explicitly through record-core's declareTable with its classes: the log and the leads cleared by the whole store only, the shares in both forms by the project; version_chain for the log alone; sight never wider than R13 and R15; the rest declarePurge's default form", () => {
  const w = world();
  const mine = w.record.declaredTables().filter((d) => d.module === "observation-log");
  const pick = (d) => ({ name: d.name, keys: d.keys, ...Object.fromEntries(CLASSES.map((c) => [c, d[c]])) });
  const base = { purge: "clear", expunge: "none", export: "admin-only", derive: "stored" };
  assert.deepEqual(mine.map(pick), [
    { name: "lead_shares", keys: undefined, ...base, sight: "owner", version_chain: false },
    { name: "observation_log", keys: [], ...base, sight: "source", version_chain: true },
    { name: "leads", keys: [], ...base, sight: "owner", version_chain: false },
  ]);
  assert.deepEqual(OBSERVATION_LOG_TABLES.map((t) => t.name), mine.map((d) => d.name), "the exported declaration is the one made");
  for (const d of mine) for (const c of CLASSES) assert.ok(c in d, `${d.name} names its ${c} class explicitly`);
  assert.equal(w.record.declaredTables().filter((d) => ["observation_log", "leads", "lead_shares"].includes(d.name)).length, 3,
    "declared once, by this module alone");

  /* R23 through record-core's purge: a project's purge takes that project's shares only and leaves the log and the
     leads; the whole-store purge takes all three */
  w.project("PROJ-A"); w.participant("PROJ-A", "alice");
  w.project("PROJ-B"); w.participant("PROJ-B", "alice");
  const L = w.obs.lead({ words: "w", author: "alice" }).lead_id;
  for (const p of ["PROJ-A", "PROJ-B"])
    assert.equal(w.obs.leadShare({ lead: L, project: p, reason: "following it up", sharer: "alice", viewer: V("alice") }).ok, true);
  assert.equal(w.obs.leadLook({ lead: L, state: "LOOKED_ABSENT", detail: "asked the clerk", looker: "alice", viewer: V("alice") }).ok, true);
  const purge = (q) => recordCoreOps(w.record, new URL(`http://x/?op=purge${q}`), null).purge();
  assert.equal(purge("&bundleId=PROJ-A").ok, true);
  assert.deepEqual(w.rows(`SELECT bundle_id FROM lead_shares`).map((r) => r.bundle_id), ["PROJ-B"]);
  assert.deepEqual([w.count("observation_log"), w.count("leads")], [1, 1], "a bundle's purge leaves the log and the leads");
  assert.equal(purge("").ok, true);
  assert.deepEqual([w.count("observation_log"), w.count("leads"), w.count("lead_shares")], [0, 0, 0]);
});

test("R35 a declaration record-core refuses is a defect of the wiring: the factory throws, naming the refusal and the table", () => {
  const st = storage();
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const h1 = { storage: st };
  const record = recordOf(h1, { evidence: null, evidencePrefix: "bio/captures/" }); record.migrate();
  const membership = membershipOf(h1, { record }); membership.migrate();
  /* a table of this module's already declared by another: record-core answers TABLE_DECLARED */
  assert.equal(record.declareTable("someone-else", [{ name: "leads", ...OBSERVATION_LOG_TABLES[2], keys: [] }]).ok, true);
  assert.throws(() => observationLogOf(h1, { record, membership, provenance: null, extraction: null }),
    /refused its table declaration: TABLE_DECLARED \(leads\)/);
  assert.throws(() => observationLogOf(h1, { record, membership, provenance: null, extraction: null }), /TABLE_DECLARED/,
    "no instance is held after the refusal: a second call is refused the same way");
  assert.equal(record.declaredTables().filter((d) => d.module === "observation-log").length, 0, "the refused call declared nothing");
});

test("R35 R23 a store that never created this module's tables purges as it did before T33: a bundle's purge passes over the absent tables and clears what the store holds (K1589)", () => {
  const st = storage();
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const h = { storage: st };
  const record = recordOf(h, { evidence: null, evidencePrefix: "bio/captures/" }); record.migrate();
  const membership = membershipOf(h, { record }); membership.migrate();
  observationLogOf(h, { record, membership, provenance: null, extraction: null });   // declared, never migrated
  assert.equal(st.sql.exec(`SELECT COUNT(*) AS n FROM sqlite_master WHERE name IN ('observation_log', 'leads', 'lead_shares')`).one().n, 0);
  st.sql.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha)
               VALUES ('PROJ-A', 'project', 'g', 't', 'forming', 't', 't', 'sha')`);
  const r = recordCoreOps(record, new URL("http://x/?op=purge&bundleId=PROJ-A"), null).purge();
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(st.sql.exec(`SELECT COUNT(*) AS n FROM bundles WHERE bundle_id = 'PROJ-A'`).one().n, 0, "the bundle itself is purged");
});

/* record-core T33 (T33-19; S0-2, S0-3, B0.12; K1470, K1489, K1493): requirement-named tests at the module's interface
   for the ids minted from record-grammar's `ID_TABLE` (R1, R40, R62, R76), `declareTable` with its classes (R21, R46),
   the derived-cache convention (R77), the store gate (R78) and expunge with a tombstone (R79, R29). T34 (T34-9; N554,
   N593, K1728): `CALC` minted opaque (R62, R76), a derived-rebuildable table's `from` (R77), and the declaration's two
   older refusals with their rows (R80). T41 (T41-2a; K2431): `STP` and `GUD` minted opaque, each named by R62. T42
   (T42-2a; K2616, K2617): `ACD`, a case account draft, minted opaque by its form alone, its legacy sequential ids still
   read, and named by R62. Over `storage.mjs`, a fresh storage per test. No network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { ID_TABLE, idPattern } from "../../../src/record-grammar/index.mjs";
import { recordOf, RecordCore, mintExhausted, RECORD_CORE_CHECKS } from "../../../src/record-core/index.mjs";
import { storage } from "./storage.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
const mintDetail = (what) => localize("record-core.index.your_teams_civicsmith_could_not", "your team's Civicsmith could not find a free {what}: every one it drew was already taken. Nothing was written.", { what });

const fresh = () => { const s = storage(); const rc = recordOf({ storage: s }); rc.migrate(); return { s, rc }; };
const rows = (s, q, ...a) => [...s.sql.exec(q, ...a)];
const sha = (t) => createHash("sha256").update(t).digest("hex");
const put = (rc, id, snapKey, text = `x ${id} ${snapKey}`) =>
  rc.commit({ bundleId: id, type: "information", snapKey, files: [{ path: "bundle.md", text, bytes: Buffer.byteLength(text), sha256: sha(text) }] });
const dump = (s) => Object.fromEntries(
  rows(s, `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`)
    .map((r) => [r.name, JSON.stringify(rows(s, `SELECT * FROM ${r.name} ORDER BY rowid`))]));
const ledger = (s) => rows(s, `SELECT id, source FROM minted_ids ORDER BY rowid`).map((r) => [r.id, r.source]);

/* Drives crypto.getRandomValues through `values` (one value per call, into a one-element array), restoring it after. */
function draws(values, fn) {
  const orig = crypto.getRandomValues;
  let i = 0;
  crypto.getRandomValues = (u) => { if (i >= values.length) throw new Error("draws exhausted"); u[0] = values[i++]; return u; };
  try { return fn(() => i); } finally { crypto.getRandomValues = orig; }
}
const ALPHABET = "abcdefghijklmnopqrstuvwxyz0123456789";
/* The byte values that draw exactly `tail`, one accepted byte per character. */
const bytesFor = (tail) => [...tail].map((c) => ALPHABET.indexOf(c));

const SEQUENTIAL = ID_TABLE.filter((e) => e.form === "sequential").map((e) => e.prefix);
const OPAQUE = ID_TABLE.filter((e) => e.form === "opaque").map((e) => e.prefix);
const BUILD_FAULT = word("record-core.build_fault");

/* ---- R1, R76, R40, R62: ids from ID_TABLE ---- */

test("R1 (B0.12): the 10,000th id of every sequential prefix of ID_TABLE is allocated for real, …-10000, never cut, and its ID_TABLE pattern accepts it", () => {
  assert.ok(SEQUENTIAL.length >= 40, "the census of sequential prefixes is read whole from ID_TABLE");
  const { rc } = fresh();
  for (const p of SEQUENTIAL) {
    let last;
    rc.transact(() => { for (let i = 1; i <= 9999; i++) last = rc.allocId(p, "2026").id; return { ok: true }; });
    assert.equal(last, `${p}-2026-9999`, p);
    const tenThousandth = rc.allocId(p, "2026").id;
    assert.equal(tenThousandth, `${p}-2026-10000`, `${p}: no ceiling at the fourth digit`);
    assert.equal(rc.allocId(p, "2026").id, `${p}-2026-10001`, `${p}: and the counter keeps stepping`);
    const re = idPattern(p);
    for (const id of [`${p}-2026-0001`, last, tenThousandth]) assert.ok(re.test(id), `${id}: ID_TABLE's form accepts it`);
  }
  /* the controls: the pattern the tests read refuses what it should */
  assert.ok(!idPattern("ENT").test("ENT-2026-999"), "three digits are not a counter");
  assert.ok(idPattern("ENT").test("ENT-2026-10000"));
  /* a prefix the table does not hold is allocated as today: sequential */
  assert.equal(rc.allocId("XQZ", "2026").id, "XQZ-2026-0001");
});

test("R1 R2: the sequential step is the same inside a caller's transaction, and padding is to four digits, never cut", () => {
  const { s, rc } = fresh();
  s.sql.exec(`INSERT INTO seq (scope,next) VALUES ('INFO-2026', 99999)`);
  assert.equal(rc.allocId("INFO", "2026").id, "INFO-2026-99999");
  assert.equal(rc.transact(() => rc.allocId("INFO", "2026")).id, "INFO-2026-100000");
  assert.equal(rc.allocId("INFO", "2027").id, "INFO-2027-0001");
});

test("R76: allocId for every opaque prefix of ID_TABLE answers <prefix>-<year>-<16 of [a-z0-9]>, and allocIdOp the same; the counter is not stepped", () => {
  assert.deepEqual([...OPAQUE].sort(), ["ACD", "CALC", "EVT", "GUD", "IDC", "LIN", "MNY", "PFA", "STP"]);
  const { s, rc } = fresh();
  for (const p of OPAQUE) {
    const seen = new Set();
    for (let i = 0; i < 50; i++) {
      const { id } = rc.allocId(p, "2026");
      assert.match(id, new RegExp(`^${p}-2026-[a-z0-9]{16}$`));
      assert.ok(idPattern(p).test(id), "ID_TABLE's opaque form accepts it");
      seen.add(id);
    }
    assert.equal(seen.size, 50);
    const op = rc.allocIdOp(p, "2026");
    assert.ok(idPattern(p).test(op.id), "allocIdOp answers R76's id for an opaque prefix");
  }
  assert.deepEqual(rows(s, `SELECT scope FROM seq`), [], "no counter was read or stepped");
});

test("R76 (K1728): CALC, whose ID_TABLE row also carries legacy: 'sequential', is minted opaque by its form alone: its counter is neither read nor stepped, and its sequential ids minted before stay held and readable", () => {
  const row = ID_TABLE.find((e) => e.prefix === "CALC");
  assert.deepEqual([row.form, row.legacy], ["opaque", "sequential"], "the row this test turns on");
  const { s, rc } = fresh();
  /* a store that minted CALC off the counter before T34: its counter and a live sequential id */
  s.sql.exec(`INSERT INTO seq (scope,next) VALUES ('CALC-2026', 43)`);
  s.db.exec(`CREATE TABLE calculations (calc_id TEXT)`);
  s.sql.exec(`INSERT INTO calculations VALUES ('CALC-2026-0042')`);
  const seqBefore = JSON.stringify(rows(s, `SELECT * FROM seq ORDER BY scope`));
  for (const mint of [() => rc.allocId("CALC", "2026"), () => rc.allocIdOp("CALC", "2026"), () => rc.transact(() => rc.allocId("CALC", "2027"))]) {
    const { id } = mint();
    assert.match(id, /^CALC-\d{4}-[a-z0-9]{16}$/, "the opaque form, never the counter's");
    assert.ok(idPattern("CALC").test(id));
    assert.ok(ledger(s).some(([x, src]) => x === id && src === "opaque"), "recorded in the opaque-id ledger");
  }
  assert.equal(JSON.stringify(rows(s, `SELECT * FROM seq ORDER BY scope`)), seqBefore, "the CALC counter was neither stepped nor started");
  assert.ok(idPattern("CALC").test("CALC-2026-0042"), "a sequential CALC id minted before is still read as valid");
  assert.deepEqual(rows(s, `SELECT calc_id FROM calculations`).map((r) => r.calc_id), ["CALC-2026-0042"], "and still held");
  /* the controls: a purely sequential prefix still steps its counter; a draw of 64 hits answers R62 for CALC */
  assert.equal(rc.allocId("INFO", "2026").id, "INFO-2026-0001");
  const tail = "ffffffffffffffff";
  draws(bytesFor(tail), () => rc.allocId("CALC", "2026"));
  const r = draws(Array.from({ length: 64 }, () => bytesFor(tail)).flat(), () => rc.allocId("CALC", "2026"));
  assert.deepEqual(r, mintExhausted("CALC"));
});

test("R76: each tail character is drawn uniformly by rejection sampling over the CSPRNG: bytes of 252 and above are drawn again", () => {
  const { s, rc } = fresh();
  const tail = "a0z9mq7bk3x8ytc5";
  assert.equal(draws([252, 255, ...bytesFor(tail)], () => rc.allocId("EVT", "2026").id), `EVT-2026-${tail}`, "two rejected bytes, then the tail");
  /* uniformity: every accepted byte 0..251 maps onto one of the 36 characters, each exactly seven times; id k's
     character j is drawn from byte (k + 17j) mod 252, so each position sees every byte once. The ledger is emptied
     between draws, so a repeated tail is never redrawn */
  const tally = new Map();
  for (let k = 0; k < 252; k++) {
    const id = draws(Array.from({ length: 16 }, (_, j) => (k + 17 * j) % 252), () => rc.allocId("LIN", "2026").id);
    for (const c of id.slice(9)) tally.set(c, (tally.get(c) || 0) + 1);
    s.sql.exec(`DELETE FROM minted_ids`);
  }
  assert.equal(tally.size, 36);
  assert.ok([...tally.values()].every((n) => n === 7 * 16), "each character equally likely");
});

test("R76 R7 R8 R32: the id is recorded in the opaque-id ledger inside the caller's transaction: a rollback takes it back, a commit spends it for good, purge or not", () => {
  const { s, rc } = fresh();
  const t1 = "aaaaaaaaaaaaaaaa", t2 = "bbbbbbbbbbbbbbbb";
  assert.throws(() => rc.transact(() => { draws(bytesFor(t1), () => rc.allocId("MNY", "2026")); throw new Error("rolled"); }));
  assert.deepEqual(ledger(s), [], "a throw took it back");
  assert.equal(rc.transact(() => { draws(bytesFor(t1), () => rc.allocId("MNY", "2026")); return { ok: false }; }).ok, false);
  assert.deepEqual(ledger(s), [], "a refusal took it back");
  assert.equal(draws(bytesFor(t1), () => rc.allocId("MNY", "2026")).id, `MNY-2026-${t1}`, "the rolled-back id is free again");
  assert.deepEqual(ledger(s), [[`MNY-2026-${t1}`, "opaque"]], "recorded before it is returned");
  /* a hit on the ledger draws again: a collision is a retry, never a duplicate */
  assert.equal(draws([...bytesFor(t1), ...bytesFor(t2)], () => rc.allocId("MNY", "2026")).id, `MNY-2026-${t2}`);
  /* either form of purge, and both stay spent */
  put(rc, "INFO-2026-0001-a", "K1");
  rc.purge({ bundleId: "INFO-2026-0001-a" }); rc.purge({});
  const t3 = "cccccccccccccccc";
  assert.equal(draws([...bytesFor(t1), ...bytesFor(t2), ...bytesFor(t3)], () => rc.allocId("MNY", "2026")).id, `MNY-2026-${t3}`);
  /* the opaque minter (R6) and recordOpaqueId (R75) see the same ledger */
  rc.transact(() => { assert.equal(rc.recordOpaqueId(`MNY-2026-${t1}`).code, "OPAQUE_ID_SPENT"); return { ok: true }; });
});

test("R76 R62: after 64 hits in a row allocId answers MINT_EXHAUSTED for the prefix, naming its object, and nothing is written", () => {
  const { s, rc } = fresh();
  const tail = "dddddddddddddddd";
  draws(bytesFor(tail), () => rc.allocId("PFA", "2026"));
  const before = dump(s);
  const r = draws(Array.from({ length: 64 }, () => bytesFor(tail)).flat(), () => rc.allocId("PFA", "2026"));
  assert.deepEqual(r, mintExhausted("PFA"));
  assert.equal(r.detail, mintDetail("person fact id"));
  assert.deepEqual(dump(s), before);
  assert.equal(rc.allocIdOp("PFA", "2026").ok, undefined, "a fresh draw succeeds again");
});

test("R62 (K1728, K2431, K2617): mintExhausted names each opaque prefix's object, a calculation's, a step's, a reading guide's and a case account draft's among them, one fixed sentence per prefix", () => {
  const names = { EVT: "event", LIN: "line", MNY: "money fact", PFA: "person fact", IDC: "identity claim", CALC: "calculation",
                  STP: "step", GUD: "reading guide", ACD: "case account draft" };
  assert.deepEqual(Object.keys(names).sort(), [...OPAQUE].sort());
  for (const [p, what] of Object.entries(names)) {
    const r = mintExhausted(p);
    assert.deepEqual([r.ok, r.code, r.check, r.prefix], [false, "MINT_EXHAUSTED", "C-59.6", p]);
    assert.equal(r.detail, mintDetail(`${what} id`));
  }
  const all = [...Object.keys(names), ...RecordCore.GATED_ID_PREFIXES, "SRC"].map((p) => mintExhausted(p).detail);
  assert.equal(new Set(all).size, all.length, "one sentence per prefix, none shared");
});

test("R76 R62 (T41, K2431): STP and GUD are minted opaque, recorded in the ledger with no counter stepped, and after 64 hits answer MINT_EXHAUSTED naming a step or a reading guide; a prefix that only begins with their letters is named by no object", () => {
  for (const [p, what] of [["STP", "step"], ["GUD", "reading guide"]]) {
    assert.equal(ID_TABLE.find((e) => e.prefix === p)?.form, "opaque", `${p} is opaque in ID_TABLE (record-grammar R51, R53)`);
    const { s, rc } = fresh();
    const { id } = rc.allocId(p, "2026");
    assert.match(id, new RegExp(`^${p}-2026-[a-z0-9]{16}$`));
    assert.ok(idPattern(p).test(id));
    assert.deepEqual(ledger(s), [[id, "opaque"]], "recorded in the opaque-id ledger");
    assert.deepEqual(rows(s, `SELECT scope FROM seq`), [], "no counter was read or stepped");
    const tail = "eeeeeeeeeeeeeeee";
    draws(bytesFor(tail), () => rc.allocId(p, "2026"));
    const before = dump(s);
    const r = draws(Array.from({ length: 64 }, () => bytesFor(tail)).flat(), () => rc.allocId(p, "2026"));
    assert.deepEqual(r, mintExhausted(p));
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.prefix], [false, "MINT_EXHAUSTED", "MINT_EXHAUSTED", "C-59.6", p]);
    assert.equal(r.translation, RECORD_CORE_CHECKS.MINT_EXHAUSTED.translation);
    assert.equal(r.detail, mintDetail(`${what} id`));
    assert.deepEqual(dump(s), before, "nothing was written");
  }
  /* the negative control: a prefix that only begins with their letters is neither minted opaque nor named */
  for (const p of ["STPX", "GUDE"]) {
    const { rc } = fresh();
    assert.equal(rc.allocId(p, "2026").id, `${p}-2026-0001`, `${p} is not opaque: the counter mints it`);
    assert.equal(mintExhausted(p).detail, mintDetail("id"));
  }
});

test("R76 R62 (T42, K2616, K2617): ACD, opaque with legacy: 'sequential', is minted opaque by its form alone, recorded in the ledger with no counter read or stepped, its four-digit ids minted before still read; after 64 hits it answers MINT_EXHAUSTED naming a case account draft; a prefix that only begins with its letters is named by no object", () => {
  const row = ID_TABLE.find((e) => e.prefix === "ACD");
  assert.deepEqual([row.form, row.legacy], ["opaque", "sequential"], "the row this test turns on (record-grammar R55)");
  const { s, rc } = fresh();
  /* a store where case-authoring minted ACD's four random digits through mintOpaqueId since T41, and a stray counter */
  const legacy = rc.transact(() => rc.mintOpaqueId("ACD", "2026"));
  assert.match(legacy, /^ACD-2026-\d{4}$/);
  assert.ok(idPattern("ACD").test(legacy), "a four-digit ACD id minted before is still read as valid");
  s.sql.exec(`INSERT INTO seq (scope,next) VALUES ('ACD-2026', 7)`);
  const seqBefore = JSON.stringify(rows(s, `SELECT * FROM seq ORDER BY scope`));
  for (const mint of [() => rc.allocId("ACD", "2026"), () => rc.allocIdOp("ACD", "2026"), () => rc.transact(() => rc.allocId("ACD", "2027"))]) {
    const { id } = mint();
    assert.match(id, /^ACD-\d{4}-[a-z0-9]{16}$/, "the opaque form, never the counter's");
    assert.ok(idPattern("ACD").test(id));
    assert.ok(ledger(s).some(([x, src]) => x === id && src === "opaque"), "recorded in the opaque-id ledger");
  }
  assert.equal(JSON.stringify(rows(s, `SELECT * FROM seq ORDER BY scope`)), seqBefore, "the ACD counter was neither read into an id nor stepped");
  assert.ok(ledger(s).some(([x, src]) => x === legacy && src === "mint"), "and the legacy id stays spent");
  /* 64 hits in a row: R62's one answer, naming a case account draft, and nothing written */
  const tail = "gggggggggggggggg";
  draws(bytesFor(tail), () => rc.allocId("ACD", "2026"));
  const before = dump(s);
  const r = draws(Array.from({ length: 64 }, () => bytesFor(tail)).flat(), () => rc.allocId("ACD", "2026"));
  assert.deepEqual(r, mintExhausted("ACD"));
  assert.deepEqual([r.ok, r.reason, r.code, r.check, r.prefix], [false, "MINT_EXHAUSTED", "MINT_EXHAUSTED", "C-59.6", "ACD"]);
  assert.equal(r.translation, RECORD_CORE_CHECKS.MINT_EXHAUSTED.translation);
  assert.equal(r.detail, mintDetail("case account draft id"));
  assert.deepEqual(dump(s), before, "nothing was written");
  assert.deepEqual(mintExhausted("ACD", { draft: "x", detail: "mine" }).detail, r.detail, "extra never replaces the sentence");
  /* the negative controls: a prefix that only begins or ends with its letters is neither minted opaque nor named */
  for (const p of ["ACDX", "XACD", "acd"]) {
    const { rc: rc2 } = fresh();
    assert.equal(rc2.allocId(p, "2026").id, `${p}-2026-0001`, `${p} is not opaque: the counter mints it`);
    assert.equal(mintExhausted(p).detail, mintDetail("id"));
  }
});

test("R40 R28: seedMintLedger seeds both ID_TABLE forms: counters of any width, the counter's range past 9,999, and opaque tails", () => {
  const { s, rc } = fresh();
  s.db.exec(`CREATE TABLE events (id TEXT); CREATE TABLE cases (id TEXT)`);
  const evt = "EVT-2026-k3x9q2m8p0z7w1v4", evt15 = "EVT-2026-k3x9q2m8p0z7w1v";
  s.sql.exec(`INSERT INTO events VALUES (?), ('INFO-2026-0001')`, evt);
  s.sql.exec(`INSERT INTO cases VALUES ('CASE-2026-123456')`);
  s.sql.exec(`INSERT INTO seq (scope,next) VALUES ('CASE-2025', 10003)`);
  rc.seedMintLedger([["EVT", "events", "id"], ["CASE", "cases", "id"]]);
  const held = new Set(ledger(s).map(([id]) => id));
  assert.ok(held.has(evt), "an opaque id with its 16-character tail");
  assert.ok(!held.has(evt15) && !held.has("INFO-2026-0001"), "only the named prefix's ids");
  assert.ok(held.has("CASE-2026-123456"), "a sequential id of six digits");
  for (const id of ["CASE-2025-0001", "CASE-2025-9999", "CASE-2025-10000", "CASE-2025-10001", "CASE-2025-10002"])
    assert.ok(held.has(id), `${id}: the counter's whole range, no cap at 9,999`);
  assert.ok(!held.has("CASE-2025-10003"), "one the counter never issued is free");
  /* an opaque id it seeded is never allocated */
  assert.equal(draws([...bytesFor(evt.slice(9)), ...bytesFor("eeeeeeeeeeeeeeee")], () => rc.allocId("EVT", "2026")).id, "EVT-2026-eeeeeeeeeeeeeeee");
  rc.seedMintLedger([["EVT", "events", "id"], ["CASE", "cases", "id"]]);
  assert.equal(new Set(ledger(s).map(([id]) => id)).size, ledger(s).length, "idempotent");
});

/* ---- R21, R46: declareTable ---- */

const CLASSES = { purge: "clear", expunge: "none", export: "admin-only", sight: "bundle", derive: "stored", version_chain: false };
const entry = (name, more = {}) => ({ name, ...CLASSES, ...more });

test("R21: declareTable takes one entry per table with its six classes, and declaredTables answers each with its classes, in declaration order", () => {
  const { rc } = fresh();
  assert.deepEqual(rc.declareTable("events", [entry("events", { export: "yes", sight: "source", version_chain: true }),
    entry("event_people", { purge: "exempt", expunge: "tombstone", export: "never", sight: "owner" }),
    entry("when_cache", { derive: "derived-rebuildable", sight: "group", rebuild: () => [], key: ["event_id"] })]), { ok: true });
  const all = rc.declaredTables();
  const mine = all.filter((d) => d.module === "events");
  assert.deepEqual(mine, [
    { module: "events", name: "events", ...CLASSES, export: "yes", sight: "source", version_chain: true },
    { module: "events", name: "event_people", ...CLASSES, purge: "exempt", expunge: "tombstone", export: "never", sight: "owner" },
    { module: "events", name: "when_cache", ...CLASSES, derive: "derived-rebuildable", sight: "group", key: ["event_id"], from: null }]);
  assert.deepEqual(all.slice(-3).map((d) => d.name), ["events", "event_people", "when_cache"], "declaration order, after record-core's own");
  all[0].purge = "x"; assert.notEqual(rc.declaredTables()[0].purge, "x", "a fresh list each call");
});

test("R21: record-core declares its own tables with their classes", () => {
  const own = Object.fromEntries(fresh().rc.declaredTables().filter((d) => d.module === "record-core").map(({ module, name, ...c }) => [name, c]));
  const t = (purge, exp, sight, chain) => ({ purge, expunge: "none", export: exp, sight, derive: "stored", version_chain: chain });
  assert.deepEqual(own, {
    files: t("clear", "yes", "bundle", false), history: t("clear", "yes", "bundle", true), manifest: t("clear", "yes", "bundle", true),
    leases: t("clear", "never", "bundle", false), bundles: t("clear", "yes", "bundle", false),
    seq: t("exempt", "admin-only", "group", false), minted_ids: t("exempt", "never", "group", false),
    settings: t("exempt", "admin-only", "group", true), tombstones: t("exempt", "yes", "group", true),
    derived_stale: t("exempt", "never", "group", false), bookkeeping_tally: t("exempt", "never", "group", false) });
});

test("R21: an entry missing a class is TABLE_CLASS_MISSING, one outside it TABLE_CLASS_UNKNOWN, naming the table and the class; the call registers nothing", () => {
  const { rc } = fresh();
  const count = () => rc.declaredTables().length;
  const n0 = count();
  for (const cls of Object.keys(CLASSES)) {
    const missing = entry("t_missing"); delete missing[cls];
    const r = rc.declareTable("m", [entry("t_ok"), missing]);
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.table, r.class, r.module], [false, "TABLE_CLASS_MISSING", "TABLE_CLASS_MISSING", "C-102.21", "t_missing", cls, "m"], cls);
    assert.ok(r.detail.includes("t_missing") && r.detail.includes(cls));
    for (const bad of ["", "other", null, 1, cls === "version_chain" ? "true" : true]) {
      const u = rc.declareTable("m", [entry("t_ok"), entry("t_bad", { [cls]: bad })]);
      assert.deepEqual([u.ok, u.code, u.check, u.table, u.class], [false, "TABLE_CLASS_UNKNOWN", "C-102.22", "t_bad", cls], `${cls}=${String(bad)}`);
    }
  }
  assert.equal(count(), n0, "nothing registered, not even the well-formed entry beside the refused one");
  /* a derived-rebuildable entry names rebuild and its key columns */
  assert.deepEqual([rc.declareTable("m", [entry("d1", { derive: "derived-rebuildable", key: ["k"] })]).class,
                    rc.declareTable("m", [entry("d1", { derive: "derived-rebuildable", rebuild: () => [] })]).class,
                    rc.declareTable("m", [entry("d1", { derive: "derived-rebuildable", rebuild: () => [], key: [] })]).class], ["rebuild", "key", "key"]);
  /* every value of every class is accepted */
  const values = { purge: ["clear", "exempt"], expunge: ["tombstone", "none"], export: ["yes", "admin-only", "never"],
                   sight: ["group", "bundle", "source", "owner"], derive: ["stored", "derived-rebuildable"], version_chain: [true, false] };
  let i = 0;
  for (const [cls, vs] of Object.entries(values)) for (const v of vs)
    assert.deepEqual(rc.declareTable("m", [entry(`v${i++}`, { [cls]: v, rebuild: () => [], key: ["k"] })]), { ok: true }, `${cls}=${v}`);
  for (const code of ["TABLE_CLASS_MISSING", "TABLE_CLASS_UNKNOWN"]) assert.ok(RECORD_CORE_CHECKS[code].translation.endsWith(BUILD_FAULT));
});

test("R21 R80: a table declared twice or by two modules is TABLE_DECLARED, a bad name TABLE_NAME_INVALID, under declareTable and declarePurge alike; a refused declaration declares nothing", () => {
  const { rc } = fresh();
  assert.deepEqual(rc.declareTable("a", [entry("t1")]), { ok: true });
  const n = rc.declaredTables().length;
  assert.deepEqual(declaredRefusal(rc.declareTable("b", [entry("t1")])), { ...TABLE_DECLARED_SHAPE, table: "t1", module: "b", declaredBy: "a" });
  assert.deepEqual(declaredRefusal(rc.declarePurge("b", ["t1"])), { ...TABLE_DECLARED_SHAPE, table: "t1", module: "b", declaredBy: "a" });
  assert.deepEqual(rc.declarePurge("a", [], { exempt: ["t1"] }).declaredBy, "a");
  assert.deepEqual(declaredRefusal(rc.declareTable("c", [entry("t2"), entry("t2")])), { ...TABLE_DECLARED_SHAPE, table: "t2", module: "c", declaredBy: "c" });
  for (const bad of [entry("bad name"), entry("t3", { keys: ["x y"] }), entry("t3", { clears: "lead" }), entry("t3", { key: ["1x"] })])
    assert.equal(rc.declareTable("c", [bad]).reason, "TABLE_NAME_INVALID");
  assert.equal(rc.declarePurge("c", ["bad name"]).reason, "TABLE_NAME_INVALID");
  assert.equal(rc.declaredTables().length, n, "nothing more was declared");
});

/* ---- R80: the declaration's two older refusals, with their rows (N554, DEC-49) ---- */

const TABLE_DECLARED_SHAPE = { ok: false, reason: "TABLE_DECLARED", code: "TABLE_DECLARED", check: "C-102.27",
                               translation: RECORD_CORE_CHECKS.TABLE_DECLARED.translation, detail: "<sentence>" };
const TABLE_NAME_INVALID_SHAPE = { ok: false, reason: "TABLE_NAME_INVALID", code: "TABLE_NAME_INVALID", check: "C-102.26",
                                   translation: RECORD_CORE_CHECKS.TABLE_NAME_INVALID.translation, detail: "<sentence>" };
/* A refusal with its detail checked and set aside: one sentence naming the table and saying nothing was declared. */
function declaredRefusal(r) {
  assert.equal(typeof r.detail, "string");
  assert.ok(r.detail.includes(String(r.table)), `the detail names the table: ${r.detail}`);
  assert.match(r.detail, /nothing was declared\.$/);
  assert.equal(r.detail.split(". ").length, 1, "one sentence");
  return { ...r, detail: "<sentence>" };
}

test("R80: TABLE_NAME_INVALID (C-102.26) and TABLE_DECLARED (C-102.27) are this module's rows, beside C-102.21 and C-102.22, each where naming the declaration's region", () => {
  for (const [code, check] of [["TABLE_NAME_INVALID", "C-102.26"], ["TABLE_DECLARED", "C-102.27"]]) {
    const row = RECORD_CORE_CHECKS[code];
    assert.deepEqual([row.check, row.where], [check, "src/record-core/index.mjs #declare > is-table-declaration"], code);
    assert.ok(Object.isFrozen(row) && row.translation.endsWith(BUILD_FAULT), `${code}: a build fault, worded for a member`);
    assert.ok(!/TABLE_|C-102/.test(row.translation));
  }
  for (const [code, check] of [["TABLE_CLASS_MISSING", "C-102.21"], ["TABLE_CLASS_UNKNOWN", "C-102.22"]])
    assert.equal(RECORD_CORE_CHECKS[code].where, RECORD_CORE_CHECKS.TABLE_DECLARED.where, `${code} (${check}) is refused at the same site`);
  const checks = Object.values(RECORD_CORE_CHECKS).map((r) => r.check);
  assert.equal(new Set(checks).size, checks.length, "no number is held twice");
});

test("R80: every TABLE_NAME_INVALID answers {ok, reason, code, check, translation, detail, table, module}, under declareTable and declarePurge, for a name, keys, clears, key or from that is not a plain identifier; nothing is declared", () => {
  const { s, rc } = fresh();
  const n = rc.declaredTables().length;
  const derived = (more) => entry("d1", { derive: "derived-rebuildable", rebuild: () => [], key: ["k"], ...more });
  const cases = [
    ["bad name", () => rc.declareTable("m", [entry("t_ok"), entry("bad name")])],
    ["1x", () => rc.declareTable("m", [entry("1x")])],
    ["t; DROP", () => rc.declareTable("m", [entry("t; DROP")])],
    ["undefined", () => rc.declareTable("m", [entry(undefined)])],
    ["7", () => rc.declareTable("m", [entry(7)])],
    ["t3", () => rc.declareTable("m", [entry("t3", { keys: ["x y"] })])],
    ["t3", () => rc.declareTable("m", [entry("t3", { keys: [7] })])],
    ["t3", () => rc.declareTable("m", [entry("t3", { clears: "lead" })])],
    ["t3", () => rc.declareTable("m", [entry("t3", { clears: ["a", "b c"] })])],
    ["d1", () => rc.declareTable("m", [derived({ key: ["1x"] })])],
    ["d1", () => rc.declareTable("m", [derived({ from: [] })])],
    ["d1", () => rc.declareTable("m", [derived({ from: "events" })])],
    ["d1", () => rc.declareTable("m", [derived({ from: ["events", "bad table"] })])],
    ["d1", () => rc.declareTable("m", [derived({ from: [["events"]] })])],
    ["d1", () => rc.declareTable("m", [derived({ from: [7] })])],
    ["t4", () => rc.declareTable("m", [entry("t4", { from: ["x y"] })])],
    ["bad name", () => rc.declarePurge("m", ["t_ok2", "bad name"])],
    ["t5", () => rc.declarePurge("m", [{ name: "t5", keys: ["x y"] }])],
    ["t6", () => rc.declarePurge("m", [{ name: "t6", clears: ["bad col"] }])],
    ["bad name", () => rc.declarePurge("m", [], { exempt: ["bad name"] })],
  ];
  const before = JSON.stringify(rows(s, `SELECT name FROM sqlite_master ORDER BY name`));
  for (const [table, call] of cases)
    assert.deepEqual(declaredRefusal(call()), { ...TABLE_NAME_INVALID_SHAPE, table, module: "m" }, table);
  assert.equal(rc.declaredTables().length, n, "nothing declared, not even a well-formed entry beside the refused one");
  assert.equal(JSON.stringify(rows(s, `SELECT name FROM sqlite_master ORDER BY name`)), before, "and nothing written");
  assert.deepEqual(Object.keys(rc.declareTable("m", [entry("x y")])).sort(), ["check", "code", "detail", "module", "ok", "reason", "table", "translation"]);
  /* the controls: the same entries, plainly named, are declared */
  assert.deepEqual(rc.declareTable("m", [entry("t_ok"), entry("t3", { keys: ["x"], clears: ["a"] }), derived({ from: ["events", "event_people"] })]), { ok: true });
});

test("R80: every TABLE_DECLARED answers its row with table, module and declaredBy, whether the table is held by this module, another or named twice in one call; nothing is declared", () => {
  const { rc } = fresh();
  assert.deepEqual(rc.declareTable("events", [entry("ev")]), { ok: true });
  const n = rc.declaredTables().length;
  const cases = [
    [() => rc.declareTable("money", [entry("ev")]), { table: "ev", module: "money", declaredBy: "events" }],
    [() => rc.declareTable("events", [entry("ev")]), { table: "ev", module: "events", declaredBy: "events" }],
    [() => rc.declarePurge("money", ["ev"]), { table: "ev", module: "money", declaredBy: "events" }],
    [() => rc.declarePurge("money", [], { exempt: ["ev"] }), { table: "ev", module: "money", declaredBy: "events" }],
    [() => rc.declareTable("money", [entry("m1"), entry("bundles")]), { table: "bundles", module: "money", declaredBy: "record-core" }],
    [() => rc.declarePurge("money", ["minted_ids"]), { table: "minted_ids", module: "money", declaredBy: "record-core" }],
    [() => rc.declareTable("money", [entry("m2"), entry("m2")]), { table: "m2", module: "money", declaredBy: "money" }],
    [() => rc.declarePurge("money", ["m3"], { exempt: ["m3"] }), { table: "m3", module: "money", declaredBy: "money" }],
  ];
  for (const [call, named] of cases) {
    const r = call();
    assert.deepEqual(declaredRefusal(r), { ...TABLE_DECLARED_SHAPE, ...named }, JSON.stringify(named));
    assert.ok(r.detail.includes(named.declaredBy), "the detail names the holder");
  }
  assert.equal(rc.declaredTables().length, n, "nothing more was declared");
  assert.deepEqual(rc.declareTable("money", [entry("m1"), entry("m2"), entry("m3")]), { ok: true }, "the control: the refused calls held nothing");
});

/* ---- R77 (N593): a derived-rebuildable table's `from` ---- */

test("R77: declareTable keeps a derived-rebuildable table's from, and declaredTables answers it as given, a fresh list each call; one declared without it answers from: null; a stored table answers no from", () => {
  const { rc } = fresh();
  const given = ["events", "event_people"];
  assert.deepEqual(rc.declareTable("events", [entry("events"), entry("event_people"),
    entry("when_cache", { derive: "derived-rebuildable", rebuild: () => [], key: ["event_id"], from: given }),
    entry("bound_cache", { derive: "derived-rebuildable", rebuild: () => [], key: ["event_id"] }),
    entry("cluster", { derive: "derived-rebuildable", rebuild: () => [], key: ["k"], from: null }),
    entry("stored_with_from", { from: ["events"] })]), { ok: true });
  const by = Object.fromEntries(rc.declaredTables().filter((d) => d.module === "events").map((d) => [d.name, d]));
  assert.deepEqual(by.when_cache.from, ["events", "event_people"], "as given, in order");
  assert.deepEqual(by.bound_cache.from, null, "declared without one: null, not stated");
  assert.deepEqual(by.cluster.from, null, "an explicit null: not stated");
  for (const t of ["events", "event_people", "stored_with_from"]) assert.ok(!("from" in by[t]), `${t} is stored: no from`);
  assert.ok(rc.declaredTables().filter((d) => d.derive === "stored").every((d) => !("from" in d)), "no stored table, record-core's own included, answers from");
  /* kept as given: the caller's list changed afterwards, or the answer changed, moves nothing held */
  given.push("later"); by.when_cache.from.push("x");
  assert.deepEqual(rc.declaredTables().find((d) => d.name === "when_cache").from, ["events", "event_people"]);
  assert.notEqual(rc.declaredTables().find((d) => d.name === "when_cache").from, rc.declaredTables().find((d) => d.name === "when_cache").from, "a fresh list each call");
  /* the derived services are unchanged by it */
  assert.deepEqual(rc.declaredTables().find((d) => d.name === "when_cache"),
    { module: "events", name: "when_cache", ...CLASSES, derive: "derived-rebuildable", key: ["event_id"], from: ["events", "event_people"] });
});

test("R21 R46: declarePurge is declareTable's default form: purge by exempt, expunge none, export admin-only, derive stored, no chain, and sight bundle when keyed to a bundle, else group", () => {
  const { s, rc } = fresh();
  s.db.exec(`CREATE TABLE keyed (bundle_id TEXT); CREATE TABLE loose (k TEXT)`);
  assert.deepEqual(rc.declarePurge("m", ["keyed", "loose", "later", { name: "pairs", keys: ["a", "b"] }, { name: "reg", keys: [] }], { exempt: ["ident"] }), { ok: true });
  const got = Object.fromEntries(rc.declaredTables().filter((d) => d.module === "m").map(({ module, name, ...c }) => [name, c]));
  const d = (sight, purge = "clear", more = {}) => ({ ...more, purge, expunge: "none", export: "admin-only", sight, derive: "stored", version_chain: false });
  assert.deepEqual(got, { keyed: d("bundle"), loose: d("group"), later: d("group"), pairs: d("bundle", "clear", { keys: ["a", "b"] }),
                          reg: d("group", "clear", { keys: [] }), ident: d("group", "exempt") });
  s.db.exec(`CREATE TABLE later (bundle_id TEXT)`);
  assert.equal(rc.declaredTables().find((x) => x.name === "later").sight, "bundle", "decided when read, as purge decides keying");
});

test("R21 R22 R23 R46: purge clears every declared table whose purge is clear, keyed as R46 says under declareTable, and never an exempt one", () => {
  const { s, rc } = fresh();
  s.db.exec(`CREATE TABLE ev (bundle_id TEXT, v TEXT); CREATE TABLE pr (a TEXT, b TEXT); CREATE TABLE part (bundle_id TEXT, done INTEGER);
             CREATE TABLE ptr (k TEXT, lead TEXT); CREATE TABLE kept (bundle_id TEXT)`);
  assert.deepEqual(rc.declareTable("m", [entry("ev"), entry("pr", { keys: ["a", "b"] }), entry("part", { whole: "done IS NULL" }),
    entry("ptr", { keys: [], clears: ["lead"] }), entry("kept", { purge: "exempt" })]), { ok: true });
  for (const id of ["B1", "B2"]) {
    s.sql.exec(`INSERT INTO ev VALUES (?, 'x')`, id); s.sql.exec(`INSERT INTO part VALUES (?, NULL), (?, 1)`, id, id);
    s.sql.exec(`INSERT INTO kept VALUES (?)`, id); s.sql.exec(`INSERT INTO ptr VALUES (?, ?)`, `p${id}`, id);
  }
  s.sql.exec(`INSERT INTO pr VALUES ('X', 'B1'), ('Y', 'Z')`);
  const one = rc.purge({ bundleId: "B1" });
  assert.deepEqual([one.removed.ev, one.removed.pr, one.removed.part, one.removed.ptr, "kept" in one.removed], [1, 1, 2, 0, false]);
  assert.deepEqual(rows(s, `SELECT k, lead FROM ptr ORDER BY k`).map((r) => [r.k, r.lead]), [["pB1", null], ["pB2", "B2"]]);
  const all = rc.purge({});
  assert.deepEqual([all.removed.ev, all.removed.pr, all.removed.part, all.removed.ptr], [1, 1, 1, 2]);
  assert.equal(rows(s, `SELECT COUNT(*) AS n FROM kept`)[0].n, 2, "an exempt table is never cleared");
  assert.deepEqual(rows(s, `SELECT bundle_id, done FROM part`).map((r) => [r.bundle_id, r.done]), [["B2", 1]],
                   "the whole form clears only where `whole` holds");
});

/* ---- R77: the derived-cache convention ---- */

/* events' shape: a stored table and a derived cache over it, its rebuild a pure read of the stored rows. */
function derivedFixture() {
  const { s, rc } = fresh();
  s.db.exec(`CREATE TABLE ev (event_id TEXT PRIMARY KEY, start TEXT, end_ TEXT);
             CREATE TABLE when_cache (event_id TEXT PRIMARY KEY, lo TEXT, hi TEXT, days INTEGER)`);
  const rebuildRows = (scope) => rows(s, `SELECT event_id, start, end_ FROM ev ${scope ? "WHERE event_id = ?" : ""} ORDER BY event_id`,
                                      ...(scope ? [scope.event_id] : []))
    .map((r) => ({ event_id: r.event_id, lo: r.start, hi: r.end_, days: (Date.parse(r.end_) - Date.parse(r.start)) / 864e5 }));
  const asked = [];
  rc.declareTable("events", [entry("ev", { sight: "source" }),
    entry("when_cache", { derive: "derived-rebuildable", sight: "source", key: ["event_id"], rebuild: (scope) => { asked.push(scope); return rebuildRows(scope); } })]);
  for (const [id, a, b] of [["EVT-a", "2026-01-01", "2026-01-03"], ["EVT-b", "2026-02-01", "2026-02-11"]]) {
    s.sql.exec(`INSERT INTO ev VALUES (?,?,?)`, id, a, b);
    s.sql.exec(`INSERT INTO when_cache VALUES (?,?,?,?)`, id, a, b, (Date.parse(b) - Date.parse(a)) / 864e5);
  }
  return { s, rc, asked };
}

test("R77: rebuildAndCompare rebuilds into a scratch copy and answers {same: true} for held rows equal byte for byte, writing nothing", () => {
  const { s, rc, asked } = derivedFixture();
  const before = dump(s);
  assert.deepEqual(rc.rebuildAndCompare("events", "when_cache"), { same: true });
  assert.deepEqual(rc.rebuildAndCompare("events", "when_cache", { event_id: "EVT-b" }), { same: true });
  assert.deepEqual(asked, [null, { event_id: "EVT-b" }], "rebuild is asked with the scope");
  assert.deepEqual(dump(s), before, "nothing written: no scratch table left, the held table unchanged");
  /* inside a caller's transaction too, and that transaction's own rows stand */
  rc.transact(() => { rc.allocId("INFO", "2026"); assert.deepEqual(rc.rebuildAndCompare("events", "when_cache"), { same: true }); return { ok: true }; });
  assert.equal(rc.allocId("INFO", "2026").id, "INFO-2026-0002");
});

test("R77: rebuildAndCompare finds the first row that differs, byte for byte: a value, a type, a missing row and an extra one", () => {
  const cases = [
    [`UPDATE when_cache SET days=9 WHERE event_id='EVT-b'`, { event_id: "EVT-b" }, (h, r) => h.days === 9 && r.days === 10],
    [`UPDATE when_cache SET lo=CAST('2026-01-01' AS BLOB) WHERE event_id='EVT-a'`, { event_id: "EVT-a" },
     (h, r) => h.lo instanceof Uint8Array && Buffer.from(h.lo).toString() === r.lo, "the same bytes as a blob, not text"],
    [`DELETE FROM when_cache WHERE event_id='EVT-a'`, { event_id: "EVT-a" }, (h, r) => h === null && r.event_id === "EVT-a"],
    [`INSERT INTO when_cache VALUES ('EVT-c','x','y',0)`, { event_id: "EVT-c" }, (h, r) => h.event_id === "EVT-c" && r === null],
    [`UPDATE when_cache SET event_id='EVT-a2' WHERE event_id='EVT-a'`, { event_id: "EVT-a" }, (h, r) => h === null && r.event_id === "EVT-a"],
  ];
  for (const [sql, key, check] of cases) {
    const { s, rc } = derivedFixture();
    s.sql.exec(sql);
    const before = dump(s);
    const r = rc.rebuildAndCompare("events", "when_cache");
    assert.equal(r.same, false, sql);
    assert.deepEqual(r.first.key, key, sql);
    assert.ok(check(r.first.held, r.first.rebuilt), `${sql}: ${JSON.stringify(r.first)}`);
    assert.deepEqual(dump(s), before);
  }
});

test("R77: markStale marks a held row in the caller's transaction, and readDerived answers a stale or missing row as {stale: true}, never its value, until a rebuild clears it", () => {
  const { s, rc } = derivedFixture();
  assert.deepEqual(rc.readDerived("events", "when_cache", "EVT-a"), { stale: false, row: { event_id: "EVT-a", lo: "2026-01-01", hi: "2026-01-03", days: 2 } });
  assert.deepEqual(rc.readDerived("events", "when_cache", { event_id: "EVT-a" }).stale, false, "a key as a map, too");
  /* a source change and its mark, in one transaction: a rollback takes the mark back */
  assert.throws(() => rc.transact(() => { rc.markStale("events", "when_cache", "EVT-a"); throw new Error("rolled"); }));
  assert.equal(rc.readDerived("events", "when_cache", "EVT-a").stale, false);
  rc.transact(() => { s.sql.exec(`UPDATE ev SET end_='2026-01-05' WHERE event_id='EVT-a'`); return rc.markStale("events", "when_cache", "EVT-a"); });
  assert.deepEqual(rc.readDerived("events", "when_cache", "EVT-a"), { stale: true }, "marked: never the held value");
  assert.equal(rc.readDerived("events", "when_cache", "EVT-b").stale, false, "another row is untouched");
  assert.deepEqual(rc.readDerived("events", "when_cache", "EVT-none"), { stale: true }, "missing: stale");
  for (const bad of [null, undefined, {}, { event_id: "EVT-a", x: 1 }, { other: "EVT-a" }, ["EVT-a"], { event_id: {} }])
    assert.deepEqual(rc.readDerived("events", "when_cache", bad), { stale: true }, `fail closed on ${JSON.stringify(bad)}`);
  /* the rebuild of the row's scope rewrites it from the stored rows and clears the mark */
  assert.deepEqual(rc.rebuildDerived("events", "when_cache", { event_id: "EVT-a" }), { ok: true, rows: 1 });
  assert.deepEqual(rc.readDerived("events", "when_cache", "EVT-a"), { stale: false, row: { event_id: "EVT-a", lo: "2026-01-01", hi: "2026-01-05", days: 4 } });
  assert.deepEqual(rc.rebuildAndCompare("events", "when_cache"), { same: true });
  /* a whole rebuild clears every mark of the table, a row's that no longer exists included */
  rc.markStale("events", "when_cache", "EVT-b"); rc.markStale("events", "when_cache", "EVT-gone");
  assert.deepEqual(rc.rebuildDerived("events", "when_cache"), { ok: true, rows: 2 });
  assert.equal(rc.readDerived("events", "when_cache", "EVT-b").stale, false);
  assert.deepEqual(rows(s, `SELECT * FROM derived_stale`), []);
  /* a table that cannot be read: stale, never a throw */
  s.db.exec(`DROP TABLE when_cache`);
  assert.deepEqual(rc.readDerived("events", "when_cache", "EVT-b"), { stale: true });
});

test("R77: a rebuild that throws rolls back whole; a table not declared derived-rebuildable by the module, or a malformed key or scope, is the caller's TypeError", () => {
  const { s, rc } = derivedFixture();
  rc.declareTable("other", [entry("stored_t")]);
  for (const [m, t] of [["events", "ev"], ["other", "when_cache"], ["events", "nope"], ["other", "stored_t"]])
    for (const call of [() => rc.markStale(m, t, "k"), () => rc.readDerived(m, t, "k"), () => rc.rebuildDerived(m, t), () => rc.rebuildAndCompare(m, t)])
      assert.throws(call, TypeError, `${m}/${t}`);
  assert.throws(() => rc.markStale("events", "when_cache", { nope: 1 }), TypeError);
  assert.throws(() => rc.rebuildDerived("events", "when_cache", "EVT-a"), TypeError, "a scope is a map");
  /* a rebuild that throws or answers no list: the held rows and marks stand */
  const { s: s2, rc: r2 } = fresh();
  s2.db.exec(`CREATE TABLE c (k TEXT, v TEXT)`); s2.sql.exec(`INSERT INTO c VALUES ('a','1')`);
  let answer = () => { throw new Error("rebuild bug"); };
  r2.declareTable("m", [entry("c", { derive: "derived-rebuildable", key: ["k"], rebuild: () => answer() })]);
  r2.markStale("m", "c", "a");
  const before = dump(s2);
  assert.throws(() => r2.rebuildDerived("m", "c"), /rebuild bug/);
  answer = () => "rows"; assert.throws(() => r2.rebuildDerived("m", "c"), TypeError);
  answer = () => [{ "bad col": 1 }]; assert.throws(() => r2.rebuildDerived("m", "c"), TypeError);
  assert.deepEqual(dump(s2), before);
  void s;
});

/* ---- R78: the store gate ---- */

test("R78: storeGate runs the table's checks in registration order inside the write's transaction and answers the first refusal with its code, or null", () => {
  const { s, rc } = fresh();
  rc.declareTable("money", [entry("money_facts"), entry("money_notes")]);
  const ran = [];
  const noAmount = (row, { op }) => { ran.push(["noAmount", op]); return "amount" in row ? { code: "AMOUNT_IN_EVENT", field: "amount" } : null; };
  const noHyp = (row) => { ran.push(["noHyp"]); return /^HYP-/.test(row.source ?? "") ? { code: "HYPOTHESIS_IN_FACT", ok: true, reason: "spoof" } : undefined; };
  assert.deepEqual(rc.registerStoreGate("money", "money_facts", [noAmount, noHyp]), { ok: true, module: "money", table: "money_facts" });
  assert.equal(rc.storeGate("money", "money_facts", { source: "MNY-1" }, "insert"), null, "every check passed");
  assert.deepEqual(ran, [["noAmount", "insert"], ["noHyp"]], "in order, with {op}");
  ran.length = 0;
  assert.deepEqual(rc.storeGate("money", "money_facts", { amount: 1, source: "HYP-2026-0001" }, "update"),
                   { field: "amount", ok: false, reason: "AMOUNT_IN_EVENT", code: "AMOUNT_IN_EVENT" }, "the first refusal");
  assert.deepEqual(ran, [["noAmount", "update"]], "and no later check");
  assert.deepEqual(rc.storeGate("money", "money_facts", { source: "HYP-2026-0001" }, "insert"),
                   { ok: false, reason: "HYPOTHESIS_IN_FACT", code: "HYPOTHESIS_IN_FACT" }, "a refusal's own ok and reason never stand");
  assert.equal(rc.storeGate("money", "money_notes", { amount: 1 }, "insert"), null, "a table with no gate");
  /* a writer that gets a refusal writes nothing and answers it, inside its transaction */
  s.db.exec(`CREATE TABLE money_facts (source TEXT, amount INTEGER)`);
  const write = (row) => rc.transact(() => rc.storeGate("money", "money_facts", row, "insert")
    ?? (s.sql.exec(`INSERT INTO money_facts VALUES (?, ?)`, row.source, row.amount ?? null), { ok: true }));
  assert.equal(write({ source: "MNY-1", amount: 5 }).code, "AMOUNT_IN_EVENT");
  assert.deepEqual(write({ source: "MNY-1" }), { ok: true });
  assert.equal(rows(s, `SELECT COUNT(*) AS n FROM money_facts`)[0].n, 1);
  /* single-function form */
  rc.registerStoreGate("money", "money_notes", () => null);
  assert.equal(rc.storeGate("money", "money_notes", {}, "insert"), null);
});

test("R78: a check that throws, answers a promise or anything but null, undefined or a refusal is STORE_GATE_FAILED (C-102.25), never a pass; storeGate writes nothing and never throws", () => {
  const { s, rc } = fresh();
  const odd = [() => { throw new Error("check bug"); }, async () => null, () => true, () => false, () => "CODE", () => 0, () => ({ code: "" }), () => ({}),
               () => Object.defineProperty({}, "code", { get() { throw new Error("get"); } })];
  odd.forEach((f, i) => { rc.declareTable("m", [entry(`t${i}`)]); rc.registerStoreGate("m", `t${i}`, [() => null, f]); });
  const before = dump(s);
  odd.forEach((f, i) => {
    let r;
    assert.doesNotThrow(() => { r = rc.storeGate("m", `t${i}`, { a: 1 }, "insert"); });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation, r.module, r.table], [false, "STORE_GATE_FAILED", "STORE_GATE_FAILED", "C-102.25",
      RECORD_CORE_CHECKS.STORE_GATE_FAILED.translation, "m", `t${i}`], String(i));
  });
  assert.match(rc.storeGate("m", "t0", {}, "insert").detail, /check bug/);
  assert.deepEqual(dump(s), before);
  assert.equal(RECORD_CORE_CHECKS.STORE_GATE_FAILED.where, "src/record-core/index.mjs storeGate > is-store-gate-failed");
});

test("R78: a second registration for a table is STORE_GATE_DECLARED (C-102.23) naming the holder; no module, a table it did not declare or no function STORE_GATE_MALFORMED (C-102.24)", () => {
  const { rc } = fresh();
  rc.declareTable("events", [entry("events")]);
  rc.declareTable("money", [entry("money_facts")]);
  const f = () => null;
  for (const [m, t, c] of [["", "events", f], [null, "events", f], ["events", "nope", f], ["events", "money_facts", f], ["events", "events", null],
                           ["events", "events", []], ["events", "events", [f, 1]], ["events", 7, f]]) {
    const r = rc.registerStoreGate(m, t, c);
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, "STORE_GATE_MALFORMED", "STORE_GATE_MALFORMED", "C-102.24",
      RECORD_CORE_CHECKS.STORE_GATE_MALFORMED.translation], `${m} ${t}`);
  }
  assert.equal(rc.registerStoreGate("events", "money_facts", f).declaredBy, "money", "names whose table it is");
  assert.equal(rc.storeGate("events", "events", { amount: 1 }, "insert"), null, "a refused registration registered nothing");
  assert.equal(rc.registerStoreGate("events", "events", () => ({ code: "FIRST" })).ok, true);
  const twice = rc.registerStoreGate("events", "events", () => ({ code: "SECOND" }));
  assert.deepEqual([twice.ok, twice.code, twice.check, twice.heldBy, twice.table], [false, "STORE_GATE_DECLARED", "C-102.23", "events", "events"]);
  assert.equal(rc.storeGate("events", "events", {}, "insert").code, "FIRST", "the first still runs");
  /* a writer that is not the table's declarer is refused, gate or none */
  for (const t of ["events", "money_facts"]) {
    const r = rc.storeGate("money", t === "events" ? "events" : "events", {}, "insert");
    assert.deepEqual([r.ok, r.code, r.declaredBy], [false, "STORE_GATE_MALFORMED", "events"]);
  }
  for (const c of ["STORE_GATE_DECLARED", "STORE_GATE_MALFORMED"]) {
    assert.equal(RECORD_CORE_CHECKS[c].where, "src/record-core/index.mjs registerStoreGate > is-store-gate-registration");
    assert.ok(RECORD_CORE_CHECKS[c].translation.endsWith(BUILD_FAULT));
  }
});

/* ---- R79, R29: expunge with a tombstone ---- */

function expungeFixture() {
  const { s, rc } = fresh();
  s.db.exec(`CREATE TABLE person_facts (fact_id TEXT, person TEXT, value TEXT); CREATE TABLE claims (claim_id TEXT, v TEXT)`);
  rc.declareTable("people", [entry("person_facts", { expunge: "tombstone", sight: "owner" }), entry("claims")]);
  s.sql.exec(`INSERT INTO person_facts VALUES ('PFA-1','ENT-1','a home address'), ('PFA-2','ENT-1','a phone'), ('PFA-3','ENT-2','x')`);
  s.sql.exec(`INSERT INTO claims VALUES ('IDC-1','y')`);
  put(rc, "INFO-2026-0001-a", "K1"); put(rc, "INFO-2026-0001-a", "K2");
  return { s, rc };
}

test("R79: expunge removes the matching rows of a tombstone table in one transaction and records one tombstone holding none of the content", () => {
  const { s, rc } = expungeFixture();
  const r = rc.expunge({ module: "people", table: "person_facts", key: { person: "ENT-1" }, ground: "confidential", by: "member:iris" });
  assert.deepEqual({ ...r, tombstone: { ...r.tombstone, at: null } },
    { ok: true, table: "person_facts", removed: 2, tombstone: { table: "person_facts", key: { person: "ENT-1" }, ground: "confidential", by: "member:iris", at: null } });
  assert.ok(!Number.isNaN(Date.parse(r.tombstone.at)));
  assert.deepEqual(rows(s, `SELECT fact_id FROM person_facts`).map((x) => x.fact_id), ["PFA-3"]);
  const held = JSON.stringify(rows(s, `SELECT * FROM tombstones`));
  assert.ok(!/home address|a phone|PFA-1|PFA-2/.test(held), "the tombstone holds none of the removed content");
  /* every column of the key must match; each ground's own field is recorded with it alone */
  const co = rc.expunge({ module: "people", table: "person_facts", key: { fact_id: "PFA-3", person: "ENT-2" }, ground: "court_order", order: "DKT-2026-0001", demandKind: "ignored", by: "m2" });
  assert.deepEqual([co.removed, co.tombstone.order, "demandKind" in co.tombstone], [1, "DKT-2026-0001", false]);
  s.sql.exec(`INSERT INTO person_facts VALUES ('PFA-4','ENT-3','z')`);
  const ld = rc.expunge({ module: "people", table: "person_facts", key: { fact_id: "PFA-4" }, ground: "lawful_demand", demandKind: "cpra_7928_215", order: "x", by: "m3" });
  assert.deepEqual([ld.tombstone.demandKind, "order" in ld.tombstone], ["cpra_7928_215", false]);
  /* in one transaction: an outer rollback takes back the removal and its tombstone */
  s.sql.exec(`INSERT INTO person_facts VALUES ('PFA-5','ENT-4','w')`);
  const before = dump(s);
  assert.throws(() => rc.transact(() => { rc.expunge({ module: "people", table: "person_facts", key: { fact_id: "PFA-5" }, ground: "unlawful", by: "m" }); throw new Error("x"); }));
  assert.deepEqual(dump(s), before);
});

test("R79: refusals, each removing nothing, in order: EXPUNGE_GROUND_UNKNOWN, EXPUNGE_NOT_DECLARED, EXPUNGE_NOT_A_MEMBER, EXPUNGE_NOTHING (C-132.1–.4)", () => {
  const { s, rc } = expungeFixture();
  const ok = { module: "people", table: "person_facts", key: { fact_id: "PFA-1" }, ground: "unlawful", by: "member:iris" };
  const before = dump(s);
  const cases = [
    [{ ground: "because" }, "EXPUNGE_GROUND_UNKNOWN"], [{ ground: undefined }, "EXPUNGE_GROUND_UNKNOWN"], [{ ground: "court_order" }, "EXPUNGE_GROUND_UNKNOWN"],
    [{ ground: "court_order", order: " " }, "EXPUNGE_GROUND_UNKNOWN"], [{ ground: "lawful_demand" }, "EXPUNGE_GROUND_UNKNOWN"],
    [{ ground: "bad", table: "history", by: "token:x", key: {} }, "EXPUNGE_GROUND_UNKNOWN"],
    [{ table: "claims" }, "EXPUNGE_NOT_DECLARED"], [{ table: "history", module: "record-core" }, "EXPUNGE_NOT_DECLARED"],
    [{ table: "manifest", module: "record-core" }, "EXPUNGE_NOT_DECLARED"], [{ table: "tombstones", module: "record-core" }, "EXPUNGE_NOT_DECLARED"],
    [{ module: "events" }, "EXPUNGE_NOT_DECLARED"], [{ table: "undeclared" }, "EXPUNGE_NOT_DECLARED"],
    [{ table: "claims", by: "token:admin" }, "EXPUNGE_NOT_DECLARED"],
    [{ by: "token:admin" }, "EXPUNGE_NOT_A_MEMBER"], [{ by: "" }, "EXPUNGE_NOT_A_MEMBER"], [{ by: undefined }, "EXPUNGE_NOT_A_MEMBER"], [{ by: 7 }, "EXPUNGE_NOT_A_MEMBER"],
    [{ by: "token:x", key: {} }, "EXPUNGE_NOT_A_MEMBER"],
    [{ key: { fact_id: "PFA-9" } }, "EXPUNGE_NOTHING"], [{ key: {} }, "EXPUNGE_NOTHING"], [{ key: null }, "EXPUNGE_NOTHING"],
    [{ key: { nope: "PFA-1" } }, "EXPUNGE_NOTHING"], [{ key: { "fact_id; DROP": "PFA-1" } }, "EXPUNGE_NOTHING"], [{ key: { fact_id: { $ne: 1 } } }, "EXPUNGE_NOTHING"],
  ];
  const checks = { EXPUNGE_GROUND_UNKNOWN: "C-132.1", EXPUNGE_NOT_DECLARED: "C-132.2", EXPUNGE_NOT_A_MEMBER: "C-132.3", EXPUNGE_NOTHING: "C-132.4" };
  for (const [over, code] of cases) {
    const r = rc.expunge({ ...ok, ...over });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation], [false, code, code, checks[code], RECORD_CORE_CHECKS[code].translation], JSON.stringify(over));
    assert.equal(typeof r.detail, "string");
  }
  assert.deepEqual(dump(s), before, "nothing removed, no tombstone");
  for (const code of Object.keys(checks)) {
    assert.equal(RECORD_CORE_CHECKS[code].where, "src/record-core/index.mjs expunge > is-expunge-refused");
    assert.ok(!RECORD_CORE_CHECKS[code].translation.includes("fault in how"), `${code} is a member's refusal`);
  }
  assert.equal(rc.expunge(ok).ok, true, "the control: the same call with every condition met removes");
});

test("R79 R23: tombstones are append-only: purge in either form, and a later expunge, never remove one; tombstones() lists them in order with a cursor", () => {
  const { s, rc } = expungeFixture();
  rc.declareTable("money", [entry("money_parties", { expunge: "tombstone" })]);
  s.db.exec(`CREATE TABLE money_parties (k TEXT)`); s.sql.exec(`INSERT INTO money_parties VALUES ('p1'), ('p2')`);
  const ex = (table, key, module = "people") => rc.expunge({ module, table, key, ground: "unlawful", by: "member:iris" });
  ex("person_facts", { fact_id: "PFA-1" }); ex("money_parties", { k: "p1" }, "money"); ex("person_facts", { fact_id: "PFA-2" });
  const all = rc.tombstones({});
  assert.deepEqual(all.tombstones.map((t) => [t.seq, t.table, t.key]), [[1, "person_facts", { fact_id: "PFA-1" }], [2, "money_parties", { k: "p1" }],
                                                                      [3, "person_facts", { fact_id: "PFA-2" }]]);
  assert.equal(all.cursor, 3);
  assert.deepEqual(Object.keys(all.tombstones[0]).sort(), ["at", "by", "ground", "key", "seq", "table"]);
  assert.deepEqual(rc.tombstones({ table: "person_facts" }).tombstones.map((t) => t.seq), [1, 3]);
  const p1 = rc.tombstones({ limit: 2 });
  assert.deepEqual([p1.tombstones.map((t) => t.seq), p1.cursor], [[1, 2], 2]);
  assert.deepEqual(rc.tombstones({ after: p1.cursor }).tombstones.map((t) => t.seq), [3]);
  assert.deepEqual(rc.tombstones({ after: 3 }), { tombstones: [], cursor: null });
  const held = JSON.stringify(rows(s, `SELECT * FROM tombstones ORDER BY seq`));
  rc.purge({ bundleId: "INFO-2026-0001-a" }); rc.purge({});
  assert.equal(JSON.stringify(rows(s, `SELECT * FROM tombstones ORDER BY seq`)), held, "neither form of purge removes one");
  assert.equal(rc.expunge({ module: "record-core", table: "tombstones", key: { seq: 1 }, ground: "unlawful", by: "m" }).code, "EXPUNGE_NOT_DECLARED");
  assert.deepEqual(recordOf({ storage: storage({ schema: false }) }).tombstones({}), { tombstones: [], cursor: null }, "never throws");
});

test("R29: history and manifest are never expunged; expunge removes only from tables declared tombstone and leaves its tombstone", () => {
  const { s, rc } = expungeFixture();
  const hm = () => JSON.stringify([rows(s, `SELECT * FROM history ORDER BY rowid`), rows(s, `SELECT * FROM manifest ORDER BY rowid`)]);
  const before = hm();
  for (const table of ["history", "manifest", "files", "bundles"])
    for (const module of ["record-core", "people"])
      assert.equal(rc.expunge({ module, table, key: { bundle_id: "INFO-2026-0001-a" }, ground: "unlawful", by: "member:iris" }).code, "EXPUNGE_NOT_DECLARED", `${module} ${table}`);
  assert.equal(hm(), before);
  assert.ok(rc.declaredTables().filter((d) => ["history", "manifest"].includes(d.name)).every((d) => d.expunge === "none" && d.version_chain === true));
  const r = rc.expunge({ module: "people", table: "person_facts", key: { fact_id: "PFA-1" }, ground: "unlawful", by: "member:iris" });
  assert.equal(r.ok, true); assert.equal(rows(s, `SELECT COUNT(*) AS n FROM tombstones`)[0].n, 1);
  assert.equal(hm(), before, "an expunge elsewhere leaves history and manifest as they were");
});

test("R39: the T33 services are the instance's methods, and their registrations the instance's", () => {
  const { s, rc } = fresh();
  for (const m of ["declareTable", "declaredTables", "markStale", "readDerived", "rebuildDerived", "rebuildAndCompare", "registerStoreGate", "storeGate", "expunge", "tombstones"])
    assert.equal(typeof rc[m], "function", m);
  rc.declareTable("m", [entry("g")]); rc.registerStoreGate("m", "g", () => ({ code: "NO" }));
  assert.equal(recordOf({ storage: s }).storeGate("m", "g", {}, "insert").code, "NO");
  assert.equal(recordOf({ storage: storage() }).storeGate("m", "g", {}, "insert"), null);
  void RecordCore;
});

test("R31 (K1542): a table another module declared is reached only as its declaration says; an undeclared one never", () => {
  const { s, rc } = fresh();
  s.db.exec(`CREATE TABLE stored_t (bundle_id TEXT, k TEXT); CREATE TABLE undeclared_t (bundle_id TEXT, k TEXT);
             CREATE TABLE tomb_t (k TEXT); CREATE TABLE cache_t (k TEXT, v TEXT)`);
  rc.declareTable("m", [entry("stored_t"), entry("tomb_t", { expunge: "tombstone" }),
    entry("cache_t", { derive: "derived-rebuildable", key: ["k"], rebuild: () => [{ k: "a", v: "1" }] })]);
  for (const t of ["stored_t", "undeclared_t"]) s.sql.exec(`INSERT INTO ${t} VALUES ('B1', 'a')`);
  s.sql.exec(`INSERT INTO tomb_t VALUES ('a')`); s.sql.exec(`INSERT INTO cache_t VALUES ('a', '1')`);
  const snap = (t) => JSON.stringify(rows(s, `SELECT * FROM ${t}`));
  const before = { stored: snap("stored_t"), undeclared: snap("undeclared_t") };
  /* expunge reaches only a tombstone table; the derived services only a derived-rebuildable one */
  for (const table of ["stored_t", "undeclared_t", "cache_t"])
    assert.equal(rc.expunge({ module: "m", table, key: { k: "a" }, ground: "unlawful", by: "member:iris" }).code, "EXPUNGE_NOT_DECLARED", table);
  for (const table of ["stored_t", "undeclared_t", "tomb_t"]) {
    assert.throws(() => rc.rebuildDerived("m", table), TypeError);
    assert.throws(() => rc.readDerived("m", table, "a"), TypeError);
  }
  assert.equal(rc.storeGate("m", "undeclared_t", { k: "a" }, "insert"), null, "the gate reads no table at all");
  assert.equal(snap("stored_t"), before.stored); assert.equal(snap("undeclared_t"), before.undeclared);
  /* and each declared way does what its declaration says */
  assert.equal(rc.expunge({ module: "m", table: "tomb_t", key: { k: "a" }, ground: "unlawful", by: "member:iris" }).removed, 1);
  assert.deepEqual(rc.rebuildAndCompare("m", "cache_t"), { same: true });
  rc.purge({ bundleId: "B1" });
  assert.equal(rows(s, `SELECT COUNT(*) AS n FROM stored_t`)[0].n, 0, "purge clears the declared table by its keying");
  assert.equal(snap("undeclared_t"), before.undeclared, "and never the undeclared one");
});

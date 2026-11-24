/* bias R45: migrate(), this module's tables and columns at every boot, at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, S, WHY } from "./world.mjs";
import { viewerPredicate } from "../../../src/membership/index.mjs";
import { BIAS_TABLES, BIAS_ADDITIVE_COLUMNS } from "../../../src/bias/index.mjs";

/* The schema this module's tables and indexes stand at, and every row they hold: what a migration may change. */
const shape = (w) => JSON.stringify([
  w.rows(`SELECT type, name, tbl_name, sql FROM sqlite_master WHERE tbl_name LIKE 'bias%' ORDER BY type, name`),
  ...BIAS_TABLES.map((t) => [w.rows(`PRAGMA table_info(${t})`), w.rows(`SELECT * FROM ${t} ORDER BY rowid`)])]);
const columns = (w, t) => w.rows(`PRAGMA table_info(${t})`).map((c) => c.name);

test("R45: a bias_debts built without settled_kind, holding a settled debt, and a bias_adoptions built without reason (R12, DEC-88), holding an adoption, gain the columns (TEXT, nullable) and never fill them: biasDebt answers kind_state undetermined", async () => {
  const w = world({ biasSchema: "legacy" });
  await w.group();
  assert.equal(columns(w, "bias_debts").includes("settled_kind"), false, "the older store");
  w.sql.exec(`INSERT INTO bias_debts (run, context_type, context_id, moved_basis, lens_then, lens_now, recipients, raised, observed, cleared_at)
              VALUES ('RUN-OLD', 'inquiry', 'INQ-2026-0001-q', 'at_open', 'aa', 'bb', '[]', '2026-01-01T00:00:00Z', '2026-01-02T00:00:00Z', '2026-01-02T00:00:00Z')`);
  const held = w.row(`SELECT * FROM bias_debts`);
  w.sql.exec(`INSERT INTO bias_adoptions (scope_type, scope_id, bundle_id, bundle_sha, author, at)
              VALUES ('instance', '', 'BIAS-2026-0001-old', 'aa', 'admin', '2026-01-01T00:00:00Z')`);
  const adopted = w.row(`SELECT * FROM bias_adoptions`);
  assert.deepEqual(w.bias.migrate(), { ok: true, added: [["bias_debts", "settled_kind"], ["bias_adoptions", "reason"]] });
  const why = w.rows(`PRAGMA table_info(bias_adoptions)`).find((c) => c.name === "reason");
  assert.deepEqual([why.type, why.notnull, why.dflt_value, why.pk], ["TEXT", 0, null, 0]);
  assert.deepEqual(w.row(`SELECT * FROM bias_adoptions`), { ...adopted, reason: null },
    "an adoption made before its reason was required keeps none: never filled");
  const col = w.rows(`PRAGMA table_info(bias_debts)`).find((c) => c.name === "settled_kind");
  assert.deepEqual([col.type, col.notnull, col.dflt_value, col.pk], ["TEXT", 0, null, 0]);
  assert.deepEqual(w.row(`SELECT * FROM bias_debts`), { ...held, settled_kind: null }, "the debt already held: nothing filled, nothing else changed");
  /* read as a machine viewer: the debt's context is no held bundle, which since D54 (membership R43) only a machine
     viewer's gate admits; the founder's does not */
  const d = w.bias.biasDebt({ run: "RUN-OLD", viewer: "class:daemon" });
  assert.deepEqual([d.found, d.open, d.settled.settled, d.settled.kind, d.settled.kind_state], [true, false, true, null, "undetermined"]);
  assert.match(d.settled.stated, /before the record kept which act settled it/);
  assert.deepEqual(w.bias.settled({ gate: viewerPredicate("class:daemon"), since: "2026-01-01T00:00:00Z" }).debts.map((x) => [x.run, x.settled_kind]),
    [["RUN-OLD", null]]);
  /* the column is live: a debt settled after the migration records its kind */
  w.sql.exec(`INSERT INTO bias_debts (run, context_type, context_id, recipients, raised, observed) VALUES ('RUN-NEW', 'inquiry', 'INQ-2026-0001-q', '[]', 't', 't')`);
  assert.equal(w.bias.biasDebtResolve({ run: "RUN-NEW", reason: "Not bearing.", actor: "admin", viewer: "class:daemon" }).ok, true);
  assert.equal(w.bias.biasDebt({ run: "RUN-NEW", viewer: "class:daemon" }).settled.kind_state, "determined");
  assert.equal(w.row(`SELECT settled_kind FROM bias_debts WHERE run = 'RUN-OLD'`).settled_kind, null, "still never filled");
});

test("R45: migrate is idempotent — a second call changes nothing, on a store it migrated and on one the schema pass already made", async () => {
  const w = world({ biasSchema: "legacy" });
  await w.group();
  w.sql.exec(`INSERT INTO bias_debts (run, context_type, context_id, recipients, raised, observed, cleared_at) VALUES ('RUN-1','inquiry','x','[]','t','t','t')`);
  w.bias.migrate();
  const once = shape(w);
  assert.deepEqual(w.bias.migrate(), { ok: true, added: [] });
  assert.equal(shape(w), once);
  /* the host's boot runs it after the schema pass: a store whose schema text already ran is left exactly as it was */
  const v = world();
  const made = shape(v);
  assert.deepEqual(v.bias.migrate(), { ok: true, added: [] });
  assert.equal(shape(v), made);
});

test("R45: a fresh store gains all five tables with their indexes, from this module's own schema text, and bias_debts has settled_kind", async () => {
  const bare = world({ biasSchema: "none" });
  assert.deepEqual(bare.rows(`SELECT name FROM sqlite_master WHERE tbl_name LIKE 'bias%'`), [], "no bias table before");
  assert.deepEqual(bare.bias.migrate(), { ok: true, added: [] }, "no column to add to a table that was absent");
  assert.deepEqual(BIAS_TABLES, ["bias_statements", "bias_adoptions", "bias_debts", "bias_debt_sweeps", "bias_debt_settlements"]);
  for (const t of BIAS_TABLES) assert.ok(columns(bare, t).length > 0, t);
  assert.ok(columns(bare, "bias_debts").includes("settled_kind"));
  assert.ok(columns(bare, "bias_adoptions").includes("reason"));
  for (const [t, c] of BIAS_ADDITIVE_COLUMNS) assert.ok(columns(bare, t).includes(c), `${t}.${c}`);
  /* the same tables and indexes, statement for statement, as the schema pass makes */
  assert.equal(shape(bare), shape(world()));
  assert.deepEqual(bare.rows(`SELECT name FROM sqlite_master WHERE type = 'index' AND tbl_name LIKE 'bias%' AND sql IS NOT NULL ORDER BY name`)
    .map((r) => r.name), ["bias_adoptions_bundle", "bias_adoptions_scope", "bias_debt_settlements_run", "bias_statements_id", "bias_statements_subject"]);
  /* and the module works over them */
  await bare.group();
  bare.set("BIAS-2026-0001-a", [S("s1")], "adopted");
  assert.equal(bare.bias.biasAdopt({ reason: WHY, bundleId: "BIAS-2026-0001-a", author: "admin", identity: "member:admin", viewer: "admin" }).ok, true);
  assert.equal(bare.bias.biasManifest({ viewer: "admin" }).in_force, true);
});

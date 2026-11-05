/* Provider notice store-assembly:93 (PR 93: `assembleStore` gains the optional `catalogueKeys`, composes mail-door and
   registers, and registers extraction's owed-work hook inside the migration's blocked work; `deployGate` takes the serving
   account's entry; `admitOn`, `servingEntry` and `DECLARED_OPS` added). This module's use of store-assembly is R1's
   (`assembleStore(ctx, env, {deliver})` from the class's constructor) and R111's (`askOnObject`, `draftOnObject`, and the
   door's `askOp`, `actionDraftOp`, `ACTION_DRAFT_OPS`). Confirmed with no code change: the class hands `deliver` alone, so
   it hands no `catalogueKeys` (the copy keeps the product's catalogue keys and logs no refusal of test keys); the class's
   own construction, with no second assembly beside it, leaves the newly composed modules' tables in place; and a restart
   over the same storage writes no row the first start had not (the blocked work's new order). `deployGate`, `admitOn` and
   `servingEntry` are reached only inside `askOnObject` and `draftOnObject`, whose signatures are unchanged; the RPCs'
   answers are covered by t45, t46 and t48. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { Store, storage } from "./fixture.mjs";   /* answers `cloudflare:workers` */
import { MAIL_DOOR_EXEMPT_TABLES } from "../../../src/mail-door/index.mjs";
import { registersTables } from "../../../src/registers/index.mjs";
import { AI_RUNS_TABLES } from "../../../src/ai-runs/index.mjs";

/** The class alone, constructed over `db` and settled: no fixture assembly beside it. */
async function construct(db, env = {}) {
  const st = storage(db);
  const s = new Store(st.ctx, { STORE: { idFromName: (n) => n }, ...env });
  for (const p of st.blocked) await p;
  return s;
}
const tables = (db) => db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((r) => r.name);
const counts = (db) => Object.fromEntries(tables(db).filter((t) => !t.startsWith("sqlite_"))
  .map((t) => [t, db.prepare(`SELECT COUNT(*) AS n FROM "${t}"`).get().n]));

test("notice store-assembly:93 (R1): the class hands assembleStore no catalogueKeys (no CATALOGUE_TEST_KEYS_REFUSED, even where the env names a test instance), its own construction leaves mail-door's, registers' and ai-runs' Gate 1 tables, and a restart over the same storage writes no row the first start had not", async () => {
  const warned = [], was = console.warn;
  console.warn = (...a) => { warned.push(a.map(String).join(" ")); };
  const db = new DatabaseSync(":memory:");
  try {
    await construct(db);
    /* a test instance would honour catalogueKeys; the class hands none, so nothing is refused there either */
    await construct(new DatabaseSync(":memory:"), { INSTANCE_NAME: "t93", CIVICSMITH_TEST_INSTANCE: "t93" });
  } finally { console.warn = was; }
  assert.equal(warned.some((w) => w.includes("CATALOGUE_TEST_KEYS_REFUSED")), false, warned.join("\n"));
  const have = new Set(tables(db));
  const owed = [...MAIL_DOOR_EXEMPT_TABLES, ...registersTables(() => null).map((t) => t.name), ...AI_RUNS_TABLES];
  for (const t of owed) assert.ok(have.has(t), `the class's construction made ${t}`);
  /* control: the census reads real tables, not every name asked of it */
  assert.equal(have.has("no_such_table_93"), false);
  const first = counts(db);
  await construct(db);
  assert.deepEqual(counts(db), first, "a restart over the same storage writes no row the first start had not");
});

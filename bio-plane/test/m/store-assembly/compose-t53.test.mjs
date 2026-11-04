/* store-assembly R101 (registers composed), R47 and R83 (mail-door composed) over the assembled store. Each owner's ops are
   taken from its own map, never hand-listed (R43, R47). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { store, storage, assembleStore } from "./fixture.mjs";
import { registersOf, registersOps } from "../../../src/registers/index.mjs";
import { mailDoorOf, mailDoorOps } from "../../../src/mail-door/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { schedulerOf } from "../../../src/scheduler/index.mjs";

const u = new URL("http://do/x?viewer=member:nobody&by=nobody");

test("R101 (T53; N1259; K4403 (1)): registers is built on the object's storage at start, its row context held by content and its held-as reader by extraction before the first request (a second registration refused), its import consumer held by the scheduler, and every op of its own map reaches it through the route map; control: a storage no store was built on has another instance", async () => {
  const x = await store();
  const r = registersOf(x.ctx);
  assert.equal(contentOf(x.ctx).registerRowContext({ holds: () => false, rowAt: () => null }).reason, "LISTENER_DECLARED", "content holds registers' row context");
  const held = extractionOf(x.ctx).registerHeldAs?.("registers", { holds: () => false });
  assert.notEqual(held && held.ok, true, "extraction holds registers' held-as reader");
  assert.ok(schedulerOf(x.ctx, x.env).consumers().includes("register-import"), "the import's consumer is the scheduler's");
  const own = Object.keys(registersOps(r, u, {}));
  assert.ok(own.length > 0);
  const map = x.s.routes(u, {});
  for (const op of own) assert.ok(Object.hasOwn(map, op), `op=${op} is in the route map`);
  assert.equal(JSON.stringify(await map.registerlist()), JSON.stringify(await registersOps(r, u, {}).registerlist()), "answered by registers' own instance");
  assert.notEqual(registersOf(storage().ctx), r);
});

test("R101, R3: registers' tables exist on a fresh store and a second construction over the same storage changes no schema", async () => {
  const db = new DatabaseSync(":memory:");
  const st = storage(db), env = { STORE: { idFromName: (n) => n } };
  assembleStore(st.ctx, env);
  for (const p of st.blocked) await p;
  const schema = () => db.prepare("SELECT name, sql FROM sqlite_master ORDER BY name").all().map((t) => `${t.name}:${t.sql}`).join("\n");
  assert.ok(db.prepare("SELECT name FROM sqlite_master WHERE name = 'register_imports'").get(), "register_imports");
  const first = schema();
  const st2 = storage(db);
  assembleStore(st2.ctx, env);
  for (const p of st2.blocked) await p;
  assert.equal(schema(), first);
});

test("R47, R83 (mail-door R12): mail-door is composed after doorbell, each op of its own map reaches its one instance through the route map, and with no mail domain composed its door is off (MAIL_NOT_SET_UP), never guessed on", async () => {
  const x = await store();
  const d = mailDoorOf(x.ctx);
  const own = Object.keys(mailDoorOps(d, u, {}));
  assert.ok(own.length > 0);
  const map = x.s.routes(u, {});
  for (const op of own) assert.ok(Object.hasOwn(map, op), `op=${op} is in the route map`);
  x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                          VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  const made = await (await x.fetch("/mailaddress?by=ann&viewer=member:ann", { method: "POST", body: JSON.stringify({ act: "make" }) })).json();
  assert.equal(made.result?.reason ?? made.reason, "MAIL_NOT_SET_UP", JSON.stringify(made));
  const keys = Object.keys(map);
  const doorbellLast = keys.indexOf("pulledknocks");
  assert.ok(doorbellLast >= 0 && keys.indexOf(own[0]) > doorbellLast, "after doorbell's map");
});

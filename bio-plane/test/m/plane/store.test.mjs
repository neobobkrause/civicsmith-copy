/* plane: the Durable Object class (R1, R4, R9, R95, R111, R114), driven through its own interface: construction over a storage,
   its `fetch` (the store's one door), `alarm`/`onAlarm`/`schedAlarmAt`, the RPC methods, and what the assembled store holds. The
   composition itself (the modules' order, the migration pass, the route map) is `store-assembly`'s, tested there. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store, storage, Store } from "./fixture.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { schedulerOf } from "../../../src/scheduler/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";
const { ownMaps } = await import("./maps.mjs");   /* after the fixture: control-plane reaches `cloudflare:workers` */

const tables = (sql) => [...sql.exec(`SELECT type, name, sql FROM sqlite_master ORDER BY type, name`)].map((r) => ({ ...r }));
const json = async (res) => ({ status: res.status, body: await res.json() });

test("R1: construction starts instance-setup once per object: a second construction on the same object starts nothing, and its registrations stand once", async () => {
  const st = storage();
  const env = { STORE: { idFromName: (n) => n } };
  for (let i = 0; i < 2; i++) { new Store(st.ctx, env); for (const p of st.blocked) await p; }
  const again = await instanceSetupOf(st.ctx).start();
  assert.equal(again.started, false, "instance-setup had already started on this object");
  /* Its registrations were made once: the producing-group fact and the group-domain consumer refuse a second. */
  assert.equal(promotionOf(st.ctx).registerFact("producingGroup", "instance-setup", () => null).ok, false);
  assert.equal(schedulerOf(st.ctx).register("instance-setup", { name: "group-domain-recheck", key: "groupdomain",
    due: () => null, wake: () => null, tick: () => null }).reason, "CONSUMER_DECLARED");
});

test("R4: `alarm` and `onAlarm(now)` are scheduler's, answered as it answers; `schedAlarmAt` is its alarm read", async () => {
  const x = await store();
  const now = Date.now();
  const r = await x.s.onAlarm(now);
  assert.deepEqual(Object.keys(r).slice(0, 10),
    ["swept", "drained", "created", "folded", "refused", "waiting", "remaining", "rearmed", "nextAt", "probes"]);
  assert.equal(await x.s.schedAlarmAt(), await schedulerOf(x.ctx).alarmAt());
  assert.equal(await x.s.schedAlarmAt(), r.nextAt, "the alarm stands where the reconcile left it");
  await x.s.alarm();
  assert.equal(await x.s.schedAlarmAt(), await schedulerOf(x.ctx).alarmAt());
});


test("R9: the plane holds no route, no table and no answer of its own: every route is a module's, and every answer is a module's through the door", async () => {
  const x = await store();
  const url = new URL("http://do/x");
  const owners = new Map();
  for (const [mod, m] of ownMaps(x.ctx, url, null)) for (const op of Object.keys(m)) if (!owners.has(op)) owners.set(op, mod);
  for (const op of Object.keys(x.s.routes(url, null))) assert.ok(owners.has(op), `op=${op} is a module's`);
  /* The class answers nothing outside the frame: the unknown route's refusal is the frame's own sentence. */
  const r = await json(await x.fetch("/plane"));
  assert.deepEqual(r.body, { ok: false, error: "unknown op: plane" });
  /* No table is named for it. */
  assert.equal(tables(x.ctx.storage.sql).some((t) => /plane/i.test(t.name) && !/^(?:sqlite_)/.test(t.name)), false);
});

test("R1: the class holds no construction, route map or frame of its own: its methods are the RPCs, the alarm's and `fetch`, and a store request is answered by the assembled store's frame", async () => {
  assert.deepEqual(Object.getOwnPropertyNames(Store.prototype).filter((k) => k !== "constructor").sort(),
    ["alarm", "ask", "dispatchMemberRun", "draft", "fetch", "groupFields", "onAlarm", "schedAlarmAt", "watchdog"]);
  const x = await store();
  const res = await x.fetch("/membershiplist?viewer=member:nobody");
  assert.ok(res.status >= 200 && res.status < 500, "the frame answered");
  assert.ok(res.headers.get("server-timing").startsWith("object;dur="), "the class stamps its I/O time on the frame's answer");
});

test("R111: the RPCs `ask` and `draft` answer store-assembly's `askOnObject` and `draftOnObject` for the object they are called on, `draft` reading through the assembled store's `read`", async () => {
  const { askOnObject, draftOnObject } = await import("../../../src/store-assembly/index.mjs");
  const x = await store();
  const seen = async (res) => ({ status: res.status, body: await res.text() });
  for (const args of [{}, { member: "member:ann", question: "q" }])
    assert.deepEqual(await seen(await x.s.ask(args)), await seen(await askOnObject(x.ctx, x.env, args)), `ask ${JSON.stringify(args)}`);
  for (const args of [{}, { op: "textcheck", member: "ann", text: "a sentence" }, { op: "infractiondraft", member: "ann", matter: "m1", audience: "council" }])
    assert.deepEqual(await seen(await x.s.draft(args)),
      await seen(await draftOnObject(x.ctx, x.env, args, { read: (op, params) => x.s.read(op, params) })), `draft ${JSON.stringify(args)}`);
  /* control: no args at all is the empty request, not a throw */
  assert.equal(typeof (await x.s.ask(undefined)).status, "number");
  assert.equal(typeof (await x.s.draft(undefined)).status, "number");
});

test("R95, R111, R114: a retired room is inert: it builds nothing, answers 410 ROOM_RETIRED to a request and ROOM_RETIRED to each RPC, and deletes its alarm when it fires", async () => {
  const st = storage();
  let alarm = 99;
  st.ctx.storage.deleteAlarm = async () => { alarm = null; };
  st.ctx.id = { name: "bio~g2", equals: () => false, toString: () => "bio~g2" };
  const s = new Store(st.ctx, { STORE: { idFromName: (n) => n } });
  assert.equal(st.blocked.length, 0, "no migration or start was handed to the runtime");
  assert.deepEqual(tables(st.ctx.storage.sql), [], "nothing was written");
  const r = await s.fetch(new Request("http://do/membershiplist"));
  assert.equal(r.status, 410);
  assert.equal((await r.json()).reason, "ROOM_RETIRED");
  for (const m of ["ask", "draft"]) { const a = await s[m]({}); assert.equal(a.status, 410, m); }
  for (const m of ["dispatchMemberRun", "groupFields"]) assert.equal((await s[m]({})).reason, "ROOM_RETIRED", m);
  assert.equal(await s.schedAlarmAt(), null);
  await s.alarm();
  assert.equal(alarm, null, "the alarm was deleted when it fired");
  /* control: a suite's private instance (a name that is no room) is never retired */
  const p = storage(); p.ctx.id = { name: "private-suite", equals: () => false };
  new Store(p.ctx, { STORE: { idFromName: (n) => n } });
  assert.ok(p.blocked.length > 0, "a private instance is built");
});

test("R56 (T49; K3366; setup-words R11–R13): the class holds no member-facing English: a retired room's answers are codes and flags, never a sentence, and every key words-reads.json lists for plane is held by the words list", async () => {
  const { hasWord } = await import("../../../src/setup-words/index.mjs");
  const { readFileSync } = await import("node:fs");
  const st = storage();
  st.ctx.id = { name: "bio~g2", equals: () => false };
  const s = new Store(st.ctx, { STORE: { idFromName: (n) => n } });
  const answers = [await (await s.fetch(new Request("http://do/membershiplist"))).json(), await s.dispatchMemberRun({}), await s.groupFields({})];
  for (const a of answers) {
    assert.deepEqual(Object.keys(a).sort(), ["code", "ok", "reason", "retired"], "a code and flags only");
    for (const v of Object.values(a)) if (typeof v === "string") assert.ok(!/\s/.test(v), `${v} is a code, not a sentence`);
  }
  const reads = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8")).modules.plane.reads;
  for (const k of reads) assert.equal(hasWord(k), true, `${k} is held by the words list`);
  assert.equal(hasWord("zz.no.such.key"), false, "control: an unknown key is not held");
});

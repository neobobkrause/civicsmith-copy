/* store-assembly F1-F3 (attempt 10, START 7 Nov): the assembly's three found items against its providers' interfaces.
   F1: no `register-import` consumer of the assembly's own (scheduler R34 owns it); F2: `following` built with a keyed
   store (following R41); F3: `notice-producers` handed `importsEnded` beside `readingsEnded` (notice-producers R31).
   Every module is the real one over the assembled store. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";
import { noticeProducerFeeds } from "../../../src/store-assembly/assemble.mjs";
import { Scheduler, schedulerOf } from "../../../src/scheduler/index.mjs";
import { followingOf, ALERT_SERVICE, ALERT_PURPOSE } from "../../../src/following/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { registersOf } from "../../../src/registers/index.mjs";
import { keyedFetch } from "../../../src/acquisition/index.mjs";

test("F1 (R101; scheduler R34): the assembly registers no `register-import` consumer of its own; the scheduler's own consumer holds the name", async () => {
  const calls = [];
  const register = Scheduler.prototype.register;
  Scheduler.prototype.register = function (module, consumer) {
    const r = register.call(this, module, consumer);
    calls.push({ module, name: consumer && consumer.name, ok: r && r.ok, reason: r && r.reason });
    return r;
  };
  let x;
  try { x = await store(); } finally { Scheduler.prototype.register = register; }
  assert.deepEqual(calls.filter((c) => c.name === "register-import"), [], "no registration of register-import by the assembly");
  assert.deepEqual(calls.filter((c) => c.ok !== true), [], "every consumer the assembly registers is taken");
  const entry = schedulerOf(x.ctx, x.env).registry(null).find((r) => r.name === "register-import");
  assert.equal(entry && entry.module, "scheduler", "the consumer is the scheduler's own (R34)");
});

test("F2 (R41; following R41, R42): following is built with a keyed store over the object's own record, credentials and followStanding, so a docket's keyed check is asked of the group's credentials", async () => {
  const x = await store();
  const f = followingOf(x.ctx);
  const k = f.keyedOpt;
  assert.ok(k && k.store, "following holds a keyed store");
  assert.equal(k.store.core, recordOf(x.ctx));
  assert.equal(k.store.credentials, credentialsOf(x.ctx));
  assert.equal(await k.store.followStanding({ follow: "999", service: ALERT_SERVICE }), f.followStanding({ follow: "999", service: ALERT_SERVICE }));
  /* with no key held the keyed fetch is refused by the credentials (the service is off), never for want of a store */
  const a = await keyedFetch(k.store, { service: ALERT_SERVICE, purpose: ALERT_PURPOSE,
    request: { url: "https://www.courtlistener.com/api/rest/v4/docket-entries/?docket=1", method: "GET" }, viewer: "member:ann" });
  assert.equal(a.ok, false);
  assert.ok(["KEYED_SERVICE_OFF", "UNKNOWN_KEYED_SERVICE"].includes(a.reason), JSON.stringify(a));
});

test("F3 (R101; notice-producers R31): the ended feeds handed to notice-producers carry registers' `importsEnded` beside `readingsEnded`, each answering its owner's own read", async () => {
  const x = await store();
  const registers = registersOf(x.ctx);
  const pending = { readingsEnded: (q) => ({ asked: q }) };
  const feeds = noticeProducerFeeds({ pending, registers });
  assert.deepEqual(Object.keys(feeds).sort(), ["importsEnded", "readingsEnded"]);
  assert.deepEqual(feeds.importsEnded({ after: 0, limit: 5 }), registers.importsEnded({ after: 0, limit: 5 }));
  assert.deepEqual(feeds.readingsEnded({ after: 1 }), { asked: { after: 1 } });
});

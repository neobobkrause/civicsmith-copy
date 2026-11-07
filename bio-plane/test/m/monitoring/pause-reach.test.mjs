/* monitoring R81 (T53; N1259; K4403 (2), (7); amends R30): the administrator's pause, set through this module's
   `pause` and read through `sweepHost().paused()` (R65), also stops the later modules' daemon reads handed that host:
   `registers.importTick` (its R12, handed the host by `scheduler` R34) runs no slice, and `following`'s tick (its R13,
   where its keyed docket poll, R41, runs) reads nothing; resumed, both continue. Each later module is the real one,
   built by its own published test world; the host they are handed is this module's real one. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world as monitoringWorld } from "./fixture.mjs";
import { seeded, network, served, enc, csv, URL_, V } from "../registers/fixture.mjs";
import { world as followingWorld, MEMBER, T0, DAY } from "../following/fixture.mjs";

const ADMIN = "class:admin";
const START = (w) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P,
  author: V("bob"), viewer: V("bob"), holes: { table: "2025" } });

test("R81 paused by an administrator, a queued register import runs no slice and fetches nothing through monitoring's host; resumed, it continues from its cursor to its end; a pause asked by a member who is not an administrator is NOT_AN_ADMIN and stops nothing", async () => {
  const mw = monitoringWorld();
  const host = mw.m.sweepHost();
  const rw = seeded({ bounds: { INGEST_BATCH_ROWS: 25, INGEST_SLICE_BATCHES: 1 } });
  assert.equal(START(rw).ok, true);
  /* a member who is not an administrator: refused, nothing paused (control: the host still answers unpaused) */
  const refused = mw.m.pause({ paused: true, by: "nobody" });
  assert.equal(refused.reason, "NOT_AN_ADMIN");
  assert.deepEqual(host.paused(), { paused: false });
  assert.equal(rw.registers.importDue(rw.clock.ms, host), true, "unpaused, the queued import is due");
  /* paused: not due, and a tick runs no slice, says paused and makes zero requests */
  assert.equal(mw.m.pause({ paused: true, by: ADMIN }).ok, true);
  assert.equal(rw.registers.importDue(rw.clock.ms, host), false);
  const net = network({ [URL_]: served(enc(csv(120))) });
  let t;
  try { t = await rw.registers.importTick(rw.clock.ms, 5000, host); } finally { net.restore(); }
  assert.deepEqual([t.paused, t.done, t.import], [true, false, null]);
  assert.equal(net.seen.length, 0, "no request while paused");
  assert.equal(rw.sql(`SELECT state FROM register_imports`)[0].state, "queued");
  assert.equal(rw.count("register_cells"), 0);
  /* resumed: the import runs to its end under the same host */
  assert.equal(mw.m.pause({ paused: false, by: ADMIN }).ok, true);
  const { ticks } = await rw.drain({ [URL_]: served(enc(csv(120))) }, { hostArg: host });
  assert.ok(ticks.length > 1, "it ran in slices");
  assert.equal(ticks.at(-1).done, true);
  assert.equal(rw.count("register_cells"), 120);
});

test("R81 paused by an administrator, a due follow (where a docket poll is read) is not read and the tick says paused, with zero requests; resumed, it is read; control: unpaused it is read at once", async () => {
  const REG = (n) => `https://registry.ellery.example/r/${n}`;
  /* control: unpaused, a due follow is read */
  const c = followingWorld();
  c.f.followRegister({ address: REG(1), author: MEMBER, viewer: MEMBER });
  c.serve(REG(1), "a");
  assert.equal((await c.f.followTick(T0)).read.length, 1);

  const w = followingWorld();
  w.f.followRegister({ address: REG(1), author: MEMBER, viewer: MEMBER });
  w.serve(REG(1), "a");
  assert.equal(w.mon.pause({ paused: true, by: ADMIN }).ok, true);
  const p = await w.f.followTick(T0);
  assert.equal(p.paused.paused, true);
  assert.equal(p.paused.by, ADMIN);
  assert.equal(p.read.length + p.captured.length, 0);
  assert.equal(w.fetches.length, 0, "no request while paused");
  assert.equal(w.f.followDue(T0 + 1000), true, "still due after the paused tick");
  assert.equal(w.mon.pause({ paused: false, by: ADMIN }).ok, true);
  const r = await w.f.followTick(T0 + DAY);
  assert.equal(r.paused.paused, false);
  assert.equal(r.read.length, 1);
  assert.equal(w.fetches.length, 1);
});

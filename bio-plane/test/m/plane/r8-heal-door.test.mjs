/* plane R102 G93 (fix round 9; plan section 3, job 20; K4565, K4807 (2); diagnosis-R8-watchdog.md Finding 2 (a)): ANY REQUEST RE-ARMS. `heal` has no caller today, so a lost alarm waits for the next cron slot (up to five
   minutes; three slots were delivered hours late). On workerd under Miniflare, the plane's own Worker and `Store` with the REAL alarm (`r8-headofline-entry.mjs`, `Headline`: the plane's `Store` plus debug routes
   that read and delete the alarm and count the object's calls on the platform's alarm), through `plane.fetch` (the real door): a row is owed (a 4 MB text uploaded by a member; its reading is the ledger's), the alarm
   is DELETED by the test, then ONE ordinary read is made, and `getAlarm()` is set afterwards. Storage reads are counted, never timed inside the object (R-CLOCK); the 5 s of "once in five seconds" is the test's own
   clock outside the object, as the requirement states it.
   RED BY NAME until plane-2 (job 37) merges `Store.fetch`'s call of the scheduler's `heal(now)` (R102): today nothing calls it.
   - the founder's read (`op=owedwork`) re-arms; a member's read (`op=whoami`) re-arms as well;
   - a second read within 5 s makes no second look (the alarm calls counted do not move), a read after the 5 s does;
   - control: a request during a firing in progress changes nothing (no arm, no look beyond the firing's own). */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";

const ENTRY = fileURLToPath(new URL("./r8-headofline-entry.mjs", import.meta.url));
const TEXT_BYTES = 4_000_060;   /* deferred to the ledger (r8-headofline.test.mjs says why) */
const LINE = (i) => `line ${String(i).padStart(6, "0")} ` + "council-minutes ".repeat(5).padEnd(87, ".") + "\n";
const textBody = () => { const n = Math.floor((TEXT_BYTES - 60) / 100); const parts = []; for (let i = 0; i < n; i++) parts.push(LINE(i)); parts.push("ENDMARKER" + " ".repeat(TEXT_BYTES - n * 100 - 9)); return Buffer.from(parts.join("")); };
const clean = (sha) => ({ capture_sha: sha, tool: "clamav", engine: "clamav", engine_version: "1.0", signatures: { main: 62, daily: 27000, bytecode: 335, published: "2026-10-08T00:00:00Z" },
  scanned_at: new Date().toISOString(), result: "clean", findings: [], latency_ms: 1 });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const live = [];
after(() => Promise.all(live.map((m) => m.dispose().catch(() => {}))));

/** a world: the scanner answers `/scan` after `scanMs` and says when a scan is in flight */
async function world({ scanMs = 0 } = {}) {
  const flight = { scanning: false, scans: 0, down: false };
  const mf = new Miniflare({
    modules: true, modulesRoot: "/", scriptPath: ENTRY, script: readFileSync(ENTRY, "utf8"),
    modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
    compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
    durableObjects: { STORE: { className: "Headline", useSQLite: true } },
    r2Buckets: ["CAPTURES", "PUBLISHED"],
    bindings: { INSTANCE_NAME: "town", VERSION: "test", ADMIN_TOKEN: "adm-r8", DAEMON_TOKEN: "dmn-r8", PROBE_TOKEN: "prb-r8" },
    durableObjectsPersist: mkdtempSync(join(tmpdir(), "plane-r8-heal-")),
    serviceBindings: { FILE_SCANNER: async (req) => {
      const u = new URL(req.url), body = req.method === "POST" ? await req.json() : null;
      if (u.pathname === "/scan" && flight.down) return new Response("down", { status: 503 });   /* a scanner that is down: the scan stays owed */
      if (u.pathname === "/scan") {
        flight.scanning = true; flight.scans++;
        await sleep(scanMs);
        flight.scanning = false;
        return new Response(JSON.stringify({ ok: true, verdicts: body.targets.map((t) => clean(t.capture_sha)) }), { headers: { "content-type": "application/json" } });
      }
      return new Response(JSON.stringify({ ok: true, name: "file-scanner", version: "1.0.0" }), { headers: { "content-type": "application/json" } });
    } },
  });
  live.push(mf);
  const ns = await mf.getDurableObjectNamespace("STORE"), stub = ns.get(ns.idFromName("bio"));
  const get = async (path) => (await stub.fetch(`http://do/r8/${path}`)).json();
  const token = async (as) => (await get(`session?as=${as}`)).token;
  const door = async (tok, op) => { const r = await mf.dispatchFetch(`http://plane/api/?op=${op}`, { headers: { authorization: `Bearer ${tok}` } }); const j = await r.json(); return { status: r.status, body: j.result ?? j }; };
  const member = await token("member"), founder = await token("founder");
  const up = await mf.dispatchFetch(`http://plane/api?op=captureupload&statement=${encodeURIComponent("the clerk's minutes")}&name=minutes.txt&type=text%2Fplain`,
    { method: "POST", headers: { authorization: `Bearer ${member}`, "content-type": "application/octet-stream" }, body: textBody() });
  const uj = await up.json(); assert.equal(up.status, 200, JSON.stringify(uj).slice(0, 300));
  const doc = uj.result ?? uj;
  const filed = await (await stub.fetch("http://do/r8/file", { method: "POST", body: JSON.stringify({ document: doc.document, sha: doc.capture.sha256, bytes: doc.capture.bytes }) })).json();
  assert.equal(filed.ok, true, JSON.stringify(filed).slice(0, 300));
  return { mf, flight, get, door, member, founder, stub, sha: doc.capture.sha256 };
}
/** the first firing has ended (a row is owed and the alarm stands armed or spent): the starting position of a lost alarm */
/** the firing a request started has ended (its health says it is not running): the same-run signal the arm is read at */
async function firingEnded(w) {
  for (let i = 0; i < 480; i++) { const s = await w.get("rows"); if (!s.health || !s.health.running_since) return; await sleep(250); }
  assert.fail("the firing the read started did not end");
}
/* The first firing may read the whole text (the ledger reads 4 MB in one pass today), leaving nothing owed; a scan of the filed digest is then owed through the
   ledger's own registrar, as the door registers one, with the scanner down, so it stays owed and the lost alarm always has work behind it. */
async function settled(w) {
  for (let i = 0; i < 480; i++) {
    const s = await w.get("rows");
    if (s.health && s.health.last_run && !s.health.running_since) {
      if (s.pending.length) return s;
      w.flight.down = true;
      const owed = await (await w.stub.fetch("http://do/r8/owe", { method: "POST", body: JSON.stringify({ sha: w.sha, kind: "scan" }) })).json();
      assert.equal(owed.ok, true, "a scan is owed: " + JSON.stringify(owed));
      await firingEnded(w);
      const t = await w.get("rows");
      if (t.pending.length) return t;
    }
    await sleep(250);
  }   /* up to 120 s: a whole-directory run is loaded, and the first firing is slower there */
  assert.fail("the first firing did not end with a row owed");
}
async function lose(w) {   /* the alarm is lost: deleted, a row owed, and no firing in flight that re-arms it (K4787: a firing begun before the delete
                              sets the alarm again when it ends, so the delete is repeated until a quiet stretch shows the alarm stays lost) */
  const s = await settled(w);
  assert.ok(s.pending.length >= 1, "a row is owed");
  for (let i = 0; ; i++) {
    await w.get("kill-alarm");
    const before = await w.get("counters");
    await sleep(1_000);
    const after = await w.get("counters");
    if (after.alarm === null && after.setAlarm === before.setAlarm) break;
    assert.ok(i < 20, "the firings came to rest");
  }
  /* the setup's own requests (the upload) had the frame's one look of these five seconds: the test's clock, outside the object, lets them pass */
  await sleep(5_500);
  assert.equal((await w.get("counters")).alarm, null, "and nothing armed it meanwhile");
}

test("R102 G93 L: a row owed and the alarm deleted, one ordinary read by the founder (op=owedwork) through the real door sets the alarm", { timeout: 180_000 }, async () => {
  const w = await world();
  assert.equal((await w.get("counters")).wrapped, true, "the object's alarm calls are counted");
  await lose(w);
  const r = await w.door(w.founder, "owedwork");
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  await firingEnded(w);   /* the read starts the row's firing: while it runs the platform answers no alarm (scheduler R29), so the arm is read once it ends */
  const after = await w.get("counters");
  assert.ok(typeof after.alarm === "number", `getAlarm() is ${after.alarm}: the alarm is not set once the firing the read started has ended`);
  assert.ok(after.setAlarm >= 1, "the object armed it");
});

test("R102 G93 L: a member's ordinary read (op=whoami) re-arms a lost alarm as well", { timeout: 180_000 }, async () => {
  const w = await world();
  await lose(w);
  const r = await w.door(w.member, "whoami");
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  await firingEnded(w);   /* a read that starts a firing is read once it ends (scheduler R29) */
  /* B116: once the firing has ended with work owed, an alarm stands: read at the same instant, the store's own read (never recomputed). The scheduler
     keeps alarms for its always-due consumers too, so no alarm is not required of a store with no live row. */
  const rows = await w.get("rows"), alarm = (await w.get("counters")).alarm, live = rows.pending.length;
  if (live > 0) assert.notEqual(alarm, null, `${live} live row(s) and no alarm: ${JSON.stringify(rows.pending.map((p) => p.state)).slice(0, 200)}`);
});

test("R102 G93 L: a second read within five seconds makes no second look (the frame's calls on the platform's alarm do not move); a read after the five seconds looks again", { timeout: 180_000 }, async () => {
  const w = await world();
  await lose(w);
  const h0 = (await w.get("counters")).heals;
  await w.door(w.member, "whoami");                        /* the first look: re-armed */
  const first = await w.get("counters");
  assert.deepEqual([first.heals.looks - h0.looks, first.heals.arms - h0.arms], [1, 1], "the first read looked and armed");
  await w.door(w.member, "whoami");
  await w.door(w.founder, "whoami");
  const second = await w.get("counters");
  /* the frame is judged by its own calls: firings that the armed alarm now runs set the alarm beside it, which is no look of the frame's (K4787) */
  assert.equal(second.heals.calls - first.heals.calls, 2, "both requests passed the frame");
  assert.equal(second.heals.looks, first.heals.looks, "no second look inside five seconds: the frame asked getAlarm no more");
  assert.equal(second.heals.arms, first.heals.arms, "and armed nothing");
  await sleep(5_500);                                      /* the test's own clock, outside the object: the requirement's five seconds */
  await w.door(w.member, "whoami");
  const third = await w.get("counters");
  assert.equal(third.heals.looks - second.heals.looks, 1, "a read after the five seconds looks again");
});

test("R102 G93 L (control): a request during a firing in progress changes nothing: no arm, no look of its own", { timeout: 180_000 }, async () => {
  const w = await world({ scanMs: 12_000 });
  for (let i = 0; i < 80 && !w.flight.scanning; i++) await sleep(100);
  assert.equal(w.flight.scanning, true, "a firing is in progress (the scanner holds it)");
  const before = await w.get("counters");
  await w.door(w.member, "whoami");
  await w.door(w.founder, "whoami");
  const during = await w.get("counters");
  assert.equal(during.setAlarm, before.setAlarm, "nothing was armed during the firing");
  assert.equal(during.deleteAlarm, before.deleteAlarm);
  assert.equal(w.flight.scanning, true, "the firing was still in progress after the requests");
});

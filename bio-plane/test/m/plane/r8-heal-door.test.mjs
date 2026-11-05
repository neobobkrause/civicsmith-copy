/* plane R102 G93 (fix round 9; plan section 3, job 20; K4565, K4807 (2); diagnosis-R8-watchdog.md Finding 2 (a)): ANY REQUEST RE-ARMS. `heal` has no caller today, so a lost alarm waits for the next cron slot (up to five
   minutes; three slots were delivered hours late). On workerd under Miniflare, the plane's own Worker and `Store` with the REAL alarm (`r8-headofline-entry.mjs`, `Headline`: the plane's `Store` plus debug routes
   that read and delete the alarm and count the object's calls on the platform's alarm), through `plane.fetch` (the real door): a row is owed (a 4 MB text uploaded by a member; its reading is the ledger's), the alarm
   is DELETED by the test, then ONE ordinary read is made, and `getAlarm()` is set afterwards. Storage reads are counted, never timed inside the object (R-CLOCK); the 5 s of "once in five seconds" is the test's own
   clock outside the object, as the requirement states it.
   RED BY NAME until plane-2 (job 37) merges `Store.fetch`'s call of the scheduler's `heal(now)` (R102): today nothing calls it.
   - the founder's read (`op=owedwork`) re-arms; a member's read (`op=whoami`) re-arms as well;
   - a second read within 5 s makes no second look (the alarm calls counted do not move), a read after the 5 s does;
   - control: a request during a firing in progress changes nothing (no arm, no look beyond the firing's own).
   DETERMINISTIC (BOB, bob-120): no assertion follows a sleep or reads wall time against the platform. The row is owed by construction (the
   entry's `hold`: the reading owner answers NO_HOME, the ledger's uncounted wait), never by how fast a 4 MB reading runs; the frame's
   five-second window is crossed by the test's own clock (`clock?advance`), handed to `heal` in place of `Date.now()`; each assertion about
   the alarm follows a firing counted as ended (`fired`); and the control's firing is held by a scanner the test releases, not by a timer. */
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
async function world({ holdScan = false, hold = true } = {}) {
  let release; const gate = new Promise((r) => { release = r; });
  const flight = { scanning: false, scans: 0, release: () => release() };
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
      if (u.pathname === "/scan") {
        flight.scanning = true; flight.scans++;
        if (holdScan) await gate;   /* the control's firing is held until the test releases it */
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
  if (hold) await get("hold?on=1");      /* the row stays owed by construction (the reading owner answers NO_HOME) */
  await get("clock?freeze=1");            /* the frame's heal reads the test's clock from here on */
  const member = await token("member"), founder = await token("founder");
  const up = await mf.dispatchFetch(`http://plane/api?op=captureupload&statement=${encodeURIComponent("the clerk's minutes")}&name=minutes.txt&type=text%2Fplain`,
    { method: "POST", headers: { authorization: `Bearer ${member}`, "content-type": "application/octet-stream" }, body: textBody() });
  const uj = await up.json(); assert.equal(up.status, 200, JSON.stringify(uj).slice(0, 300));
  const doc = uj.result ?? uj;
  const filed = await (await stub.fetch("http://do/r8/file", { method: "POST", body: JSON.stringify({ document: doc.document, sha: doc.capture.sha256, bytes: doc.capture.bytes }) })).json();
  assert.equal(filed.ok, true, JSON.stringify(filed).slice(0, 300));
  return { mf, flight, get, door, member, founder, stub };
}
/* a condition polled until it holds, bounded by count: a wait for an event the object states, never an assertion after a sleep */
async function until(w, what, ok, tries = 1200) {
  for (let i = 0; i < tries; i++) { const v = await ok(); if (v) return v; await sleep(100); }
  assert.fail(`${what} did not happen`);
}
/** no firing in flight: every firing `alarm()` started has ended */
const quiet = async (w) => { const c = await w.get("counters"); return c.fired.started === c.fired.ended ? c : null; };
/** the firings the object ran have reached `n` ended, and none is in flight */
const fired = (w, n) => until(w, `firing ${n}`, async () => { const c = await quiet(w); return c && c.fired.ended >= n ? c : null; });
async function settled(w) {   /* the first firing has ended with the held row owed */
  await fired(w, 1);
  const s = await w.get("rows");
  assert.ok(s.pending.length >= 1, `a row is owed after the first firing: ${JSON.stringify(s.pending).slice(0, 200)}`);
  return s;
}
async function lose(w) {   /* the alarm is lost: deleted with a row owed and no firing in flight (a firing in flight would set it again as it ends) */
  await settled(w);
  for (let i = 0; ; i++) {
    await until(w, "a quiet object", () => quiet(w));
    await w.get("kill-alarm");
    const c = await quiet(w);
    if (c && c.alarm === null) break;
    assert.ok(i < 50, "the firings came to rest");
  }
  /* the setup's own requests had the frame's one look of these five seconds: the test's clock steps past them */
  await w.get("clock?advance=6000");
  assert.equal((await w.get("counters")).alarm, null, "and nothing armed it meanwhile");
}

test("R102 G93 L: a row owed and the alarm deleted, one ordinary read by the founder (op=owedwork) through the real door sets the alarm", { timeout: 180_000 }, async () => {
  const w = await world();
  assert.equal((await w.get("counters")).wrapped, true, "the object's alarm calls are counted");
  await lose(w);
  const before = await w.get("counters");
  const r = await w.door(w.founder, "owedwork");
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const read = await w.get("counters");
  assert.deepEqual([read.heals.looks - before.heals.looks, read.heals.arms - before.heals.arms], [1, 1], "the read looked and armed the lost alarm");
  /* the alarm it set demonstrably ran (a firing counted as ended), and the held row keeps it armed */
  const after = await fired(w, before.fired.ended + 1);
  assert.ok(typeof after.alarm === "number", `getAlarm() is ${after.alarm} once the firing the read armed has ended`);
  assert.ok(after.setAlarm > before.setAlarm, "the object armed it");
});

test("R102 G93 L: a member's ordinary read (op=whoami) re-arms a lost alarm as well", { timeout: 180_000 }, async () => {
  const w = await world();
  await lose(w);
  const before = await w.get("counters");
  const r = await w.door(w.member, "whoami");
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 200));
  const read = await w.get("counters");
  assert.deepEqual([read.heals.looks - before.heals.looks, read.heals.arms - before.heals.arms], [1, 1], "the member's read looked and armed");
  /* B116: once the firing it armed has ended with work owed, an alarm stands, read at the same instant */
  const after = await fired(w, before.fired.ended + 1);
  const rows = await w.get("rows");
  assert.ok(rows.pending.length >= 1, "the held row is still owed");
  assert.notEqual(after.alarm, null, `${rows.pending.length} live row(s) and no alarm`);
});

test("R102 G93 L: a second read within five seconds makes no second look (the frame's calls on the platform's alarm do not move); a read after the five seconds looks again", { timeout: 180_000 }, async () => {
  const w = await world();
  await lose(w);
  const h0 = (await w.get("counters")).heals;
  await w.door(w.member, "whoami");                        /* the first look: re-armed */
  const first = await w.get("counters");
  assert.deepEqual([first.heals.looks - h0.looks, first.heals.arms - h0.arms], [1, 1], "the first read looked and armed");
  await w.door(w.member, "whoami");                        /* the test's clock has not moved: inside the five seconds */
  await w.door(w.founder, "whoami");
  const second = await w.get("counters");
  /* the frame is judged by its own calls: firings that the armed alarm now runs set the alarm beside it, which is no look of the frame's (K4787) */
  assert.equal(second.heals.calls - first.heals.calls, 2, "both requests passed the frame");
  assert.equal(second.heals.looks, first.heals.looks, "no second look inside five seconds: the frame asked getAlarm no more");
  assert.equal(second.heals.arms, first.heals.arms, "and armed nothing");
  /* the alarm the first read armed has run (counted), none is in flight, and the test's clock steps past the five seconds */
  await fired(w, first.fired.ended + 1);
  await w.get("clock?advance=6000");
  await w.door(w.member, "whoami");
  const third = await w.get("counters");
  assert.equal(third.heals.looks - second.heals.looks, 1, "a read after the five seconds looks again");
});

test("R102 G93 L (control): a request during a firing in progress changes nothing: no arm, no look of its own", { timeout: 180_000 }, async () => {
  const w = await world({ holdScan: true, hold: false });
  try {
    await until(w, "a firing holding the scanner", () => w.flight.scanning);
    const before = await w.get("counters");
    assert.ok(before.fired.started > before.fired.ended, "a firing is in progress (the scanner holds it)");
    /* the test's clock steps past the five seconds, so the frame's window would let it look: only the firing in progress keeps it from looking */
    await w.get("clock?advance=6000");
    await w.door(w.member, "whoami");
    await w.door(w.founder, "whoami");
    const during = await w.get("counters");
    assert.equal(during.setAlarm, before.setAlarm, "nothing was armed during the firing");
    assert.equal(during.deleteAlarm, before.deleteAlarm);
    assert.equal(during.heals.looks, before.heals.looks, "and the frame looked at nothing");
    assert.equal(w.flight.scanning, true, "the firing was still in progress after the requests");
  } finally { w.flight.release(); }
});

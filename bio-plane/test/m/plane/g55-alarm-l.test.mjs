/* plane (T51 fix round 6, G55's residual; K4426 (4), K4726), the platform check L of G55 (5), run with the real alarm: on workerd under Miniflare, the plane's REAL `Store` (its scheduler and the `ingest`
   consumer `calculations` R14 offers), a real Durable Object with its own alarm, real DO SQLite and R2 (`g55-alarm-l-entry.mjs`). A signed-in member (a session row laid by the entry, then the real door:
   `POST /api?op=moneyingest` with a bearer token) ingests 25,000 resolving rows; no tick is fired by hand: the object's own alarm runs every slice until the record is `done`. Counts, never times (R-CLOCK):
   the wait is bounded by the alarm's firings. The second test kills the object after two slices (a fresh Miniflare over the persisted store): it re-arms its alarm by itself and finishes with no duplicate. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";
import { request } from "node:http";

const ENTRY = fileURLToPath(new URL("./g55-alarm-l-entry.mjs", import.meta.url));
const ROWS = 25_000;
const MAX_FIRINGS = 60;   /* 25,000 rows are 13 slices; the bound is on firings, never on a compute time */
const boot = (persist, gate) => new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: ENTRY, script: readFileSync(ENTRY, "utf8"),
  modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "G55Plane", useSQLite: true } },
  r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { INSTANCE_NAME: "g55alarm", VERSION: "test", ADMIN_TOKEN: "adm", MEMBER_TOKEN: "mem", PROBE_TOKEN: "prb", DAEMON_TOKEN: "dmn", ACCOUNT_SEAL_SECRET: "g55-seal",
    GOVERNOR_APPETITE_PER_MIN: "600000", CAPTURE_REQUEST_TICK_MS: "3600000", MONITOR_TICK_MS: "3600000", ...(gate === undefined ? {} : { G55_GATE: String(gate) }) },
  durableObjectsPersist: join(persist, "do"), r2Persist: join(persist, "r2"),
});
const live = [];
after(() => Promise.all(live.map((m) => m.dispose().catch(() => {}))));
/* Every request goes over its own new connection (`agent: false`), never a pooled keep-alive socket. Each ingest slice holds workerd's one thread for seconds; a request written
   during a slice to a socket that sat idle across earlier slices is dropped unread when the thread frees ("other side closed": Miniflare's proxy calls, `idFromName`, hit it). The
   object is the one the plane's door uses (`idFromName("bio")`), reached through the entry's `/g55/` route. */
const send = (base, path, { method = "GET", headers = {}, body } = {}) => new Promise((resolve, reject) => {
  const u = new URL(path, base), data = body === undefined ? undefined : Buffer.from(body);
  const req = request(u, { method, agent: false, headers: { ...headers, connection: "close", ...(data ? { "content-length": data.length } : {}) } }, (res) => {
    const parts = []; res.on("data", (d) => parts.push(d)); res.on("error", reject);
    res.on("end", () => resolve({ status: res.statusCode, text: Buffer.concat(parts).toString("utf8") }));
  });
  req.on("error", reject); req.end(data);
});
const world = (persist, gate) => {
  const mf = boot(persist, gate); live.push(mf);
  const step = async (name, body) => {
    const r = await send(await mf.ready, `/g55/${name}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}) });
    const j = JSON.parse(r.text); assert.equal(r.status, 200, j.error); return j;
  };
  const door = async (op, token, body, query = "") => {
    const r = await send(await mf.ready, `/api?op=${op}${query}`, { method: body ? "POST" : "GET", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    assert.equal(r.status, 200, r.text); return JSON.parse(r.text);
  };
  return { mf, step, door };
};
const until = async (fn, firings) => {
  for (let polls = 0; ; polls++) {
    const s = await fn();
    if (s.done) return s.state;
    assert.ok(s.state.firings <= firings, `the alarm fired more than ${firings} times: ${JSON.stringify(s.state.record)}`);
    assert.ok(polls < 600, `no progress: the alarm fired ${s.state.firings} times, the record is ${JSON.stringify(s.state.record)}`);   /* a guard against a hang, not a time bound */
    await new Promise((r) => setTimeout(r, 250));
  }
};
/* The plane's other consumers keep their own, later wakes (the daily passes, the watchdog), so the alarm is not empty in the whole plane: what scheduler R15 asks is that the ingest wants none. */
const assertIdle = (s, why) => {
  assert.ok(!s.ingestDue && s.ingestWake === null, `${why}: due ${s.ingestDue}, wake ${s.ingestWake}`);
  assert.ok(s.alarm === null || s.alarm > s.now + 30_000, `no alarm is armed for the ingest: the alarm is ${s.alarm === null ? "deleted" : `${s.alarm - s.now} ms off, another consumer's`}`);
};
const finished = (step) => async () => { const state = await step("state"); return { state, done: !!state.record && state.record.state === "done" }; };

test("R88 G55 L: 25,000 resolving rows started by a member through the door are run to the end by the object's own alarm, no tick fired by hand: 25,000 facts, no source row twice, the marker closed, the read complete, the viewer's done notice raised, the ingest wants no alarm", { timeout: 300_000 }, async () => {
  const persist = mkdtempSync(join(tmpdir(), "plane-g55-alarm-"));
  const { step, door } = world(persist);
  const { binding } = await step("seed", { rows: ROWS });
  const { token } = await step("session");
  const started = await door("moneyingest", token, { binding, rows: "all", reason: "check L, the real alarm" });
  const ing = started.result ?? started;
  console.log(`# G55 alarm L: the act answered ${JSON.stringify({ ok: ing.ok, state: ing.state, complete: ing.complete, rows_total: ing.rows_total, written_count: ing.written_count })}`);
  assert.equal(ing.ok, true, JSON.stringify(started).slice(0, 400));
  assert.equal(ing.state, "ingesting", "over the inline threshold the act answers started");
  assert.equal(ing.rows_total, ROWS);
  const end = await until(finished(step), MAX_FIRINGS);
  console.log(`# G55 alarm L: done by ${end.firings} alarm firings; facts ${end.facts}, record ${JSON.stringify(end.record)}, alarm ${end.alarm}`);
  assert.equal(end.facts, ROWS, "25,000 facts");
  assert.equal(end.distinctRows, ROWS, "no source.row twice");
  assert.equal(end.record.next_row >= ROWS, true, "the cursor is at the end");
  assert.ok(end.firings >= 2, `more than one slice was run, each by a firing (${end.firings})`);
  assert.equal(end.openMarkers, 0, "the partial marker is closed");
  assert.equal(end.markers, 1, "and it was opened once");
  assertIdle(end, "nothing of the ingest is due");
  const read = await door("moneyingestread", token, null, `&ingest=${encodeURIComponent(ing.ingest)}&kind=state`);
  const r = read.result ?? read;
  assert.equal(r.complete, true, JSON.stringify(read).slice(0, 300));
  assert.equal(r.written_count, ROWS);
  assert.deepEqual(end.notices.map((n) => n.id), [`FINDING::ingest-done::${ing.ingest}`], "notice-producers raised the viewer's done notice");
  const again = await until(finished(step), MAX_FIRINGS);
  await new Promise((rr) => setTimeout(rr, 1500));
  const quiet = (await step("state"));
  assert.deepEqual([quiet.firings, quiet.facts], [again.firings, ROWS], "control: once done, no further alarm fires and no fact is written");
});

test("R88 G55 L: an object killed after two slices is restarted over the same storage: it re-arms its alarm by itself and finishes, 25,000 facts and no source row twice", { timeout: 300_000 }, async () => {
  const persist = mkdtempSync(join(tmpdir(), "plane-g55-alarm-"));
  let w = world(persist, 3);   /* the first three firings go through (two of them run a slice, 4,000 facts: the run shows it); the fourth is held, so the kill lands between slices */
  const { binding } = await w.step("seed", { rows: ROWS });
  const { token } = await w.step("session");
  const started = await w.door("moneyingest", token, { binding, rows: "all", reason: "check L, the kill" });
  const ing = started.result ?? started;
  assert.equal(ing.state, "ingesting");
  let s;
  for (let polls = 0; polls < 600; polls++) { s = await w.step("state"); if (s.held >= 1) break; await new Promise((r) => setTimeout(r, 250)); }
  assert.ok(s.held >= 1, `the object reached the gate: ${JSON.stringify(s.record)}`);
  console.log(`# G55 alarm L kill: held after ${s.firings - s.held} slices run by the alarm; facts ${s.facts}, record ${JSON.stringify(s.record)}`);
  assert.equal(s.record.state, "ingesting", "killed mid-run");
  assert.ok(s.facts > 0 && s.facts < ROWS, `some slices committed, not all (${s.facts})`);
  assert.equal(s.distinctRows, s.facts, "no source row twice before the kill");
  await w.mf.dispose();   /* the kill */
  w = world(persist, 0);   /* a fresh runtime over the persisted store; its alarms are held so the re-arming can be seen */
  const back = await w.step("state");
  assert.equal(back.facts, s.facts, "the committed slices survived");
  assert.equal(back.record.state, "ingesting");
  let armed = back;
  for (let polls = 0; polls < 40 && !(armed.held >= 1 || Number.isFinite(armed.alarm)); polls++) { await new Promise((r) => setTimeout(r, 250)); armed = await w.step("state"); }
  assert.ok(armed.held >= 1 || Number.isFinite(armed.alarm), `the restarted object re-armed its alarm by itself (alarm ${armed.alarm}, firings ${armed.firings})`);
  await w.step("release");
  const end = await until(finished(w.step), MAX_FIRINGS);
  console.log(`# G55 alarm L kill: finished after the restart by ${end.firings} firings; facts ${end.facts}, record ${JSON.stringify(end.record)}`);
  assert.equal(end.facts, ROWS);
  assert.equal(end.distinctRows, ROWS, "no duplicate across the kill");
  assert.equal(end.openMarkers, 0);
  assertIdle(end, "nothing of the ingest is due");
  assert.deepEqual(end.notices.map((n) => n.id), [`FINDING::ingest-done::${ing.ingest}`]);
});

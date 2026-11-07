/* scheduler — T53 (R34, R35; N1259, N824): the consumers `register-import` (registers R12's import slices, one a firing, under
   monitoring's sweep host), `discard-clear` (doorbell R30) and `mail-clear` (mail-door R6), after `question-explore` and before
   G55's `ingest`, their answers under `registerfileimport`, `discardclear` and `mailclear`. Each drives the real provider over its
   own published test fixture (`test/m/registers/fixture.mjs`, `test/m/doorbell/fixture.mjs`, `test/m/mail-door/fixture.mjs`);
   the sweep host handed to registers is the registers fixture's own (monitoring is later than registers, so registers' tests
   carry the host's shape), offered as monitoring's `sweepHost()`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { SCHEDULER_ORDER, SCHEDULER_KEYS, RANKED, DAILY, ALWAYS_DUE, Scheduler } from "../../../src/scheduler/index.mjs";
import { storage, owners as standIns } from "./fixture.mjs";
import { seeded as registersWorld, V, served, csv, enc, URL_, network } from "../registers/fixture.mjs";
import { fresh as doorbellFresh, bucket as doorbellBucket } from "../doorbell/fixture.mjs";
import { fresh as mailFresh, addressFor, plain } from "../mail-door/fixture.mjs";

const T53 = ["register-import", "discard-clear", "mail-clear"];
const DAY = 86400000;

/* ---- the registry (R34, R35, R5, R2) ---- */

test("R34, R35, R5, R2: register-import, discard-clear and mail-clear stand after question-explore, in that order, and G55's ingest closes the registry; their keys are registerfileimport, discardclear and mailclear; none is ranked, daily or always due", () => {
  assert.deepEqual(SCHEDULER_ORDER.slice(SCHEDULER_ORDER.indexOf("question-explore")), ["question-explore", ...T53, "ingest"]);
  assert.deepEqual(T53.map((n) => SCHEDULER_KEYS[n]), ["registerfileimport", "discardclear", "mailclear"]);
  for (const n of T53) assert.deepEqual([RANKED.includes(n), DAILY.includes(n), ALWAYS_DUE.includes(n)], [false, false, false], n);
  const r = registersWorld(), db = doorbellFresh({ evidence: doorbellBucket() }), md = mailFresh();
  const s = new Scheduler({ storage: storage(), owners: { registers: () => r.registers, doorbell: () => db.c, mailDoor: () => md.d } });
  assert.deepEqual(s.consumers(), T53, "each present with its owner, in R5's order");
  assert.deepEqual(new Scheduler({ storage: storage(), owners: {} }).consumers(), [], "absent without their owners");
});

/* ---- R34: register-import over the real registers ---- */

const START = (w) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } });

/* a scheduler with registers and a monitoring owner whose sweep host is the registers fixture's (its other services idle stand-ins) */
function importWorld({ host = null, bounds = { INGEST_BATCH_ROWS: 25, INGEST_SLICE_BATCHES: 1 } } = {}) {
  const w = registersWorld({ bounds });
  const stand = standIns({ "archive-monitor": { due: null } });
  const sweep = host || w.sweep;
  const hosts = [];
  const monitoring = { ...stand.o.monitoring, sweepHost: () => { hosts.push(sweep); return sweep; } };
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { monitoring: () => monitoring, registers: () => w.registers } });
  const heard = s.listenTo({ registers: w.registers });
  return { w, s, st, sweep, hosts, heard };
}

test("R34: an idle instance has its alarm armed when an import is started (registers' onImportQueued) and deleted after the last slice; each firing runs one slice, under monitoring's sweep host, until the import answers done", async () => {
  const { w, s, st, sweep, hosts, heard } = importWorld();
  assert.deepEqual(heard.registers, { ok: true, module: "scheduler" }, "registered once with registers.onImportQueued");
  assert.deepEqual(s.faults(), []);
  assert.equal(await s.arm(w.clock.ms), null, "nothing queued: no alarm");
  assert.equal(START(w).ok, true);
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(typeof st.alarm, "number", "armed by the notice alone (at the import's wake, the instance clock's now)");
  const net = network({ [URL_]: served(enc(csv(120))) });
  const answers = [];
  try {
    for (let i = 0; i < 40 && st.alarm !== null; i++) {
      w.clock.ms = Math.max(w.clock.ms, st.alarm);
      const r = await s.onAlarm(w.clock.ms);
      if ("registerfileimport" in r) answers.push(r.registerfileimport);
      w.clock.ms += 1000;
    }
  } finally { net.restore(); }
  assert.ok(answers.length >= 5, `an import of several slices runs one a firing (${answers.length})`);
  assert.deepEqual(answers.map((a) => a.done), [...answers.slice(0, -1).map(() => false), true], "due again while done is false; the last answers done");
  assert.equal(w.sql(`SELECT state FROM register_imports`)[0].state, "indexed");
  assert.equal(w.count("register_cells"), 120);
  assert.equal(st.alarm, null, "the last import ended: no alarm (R15)");
  assert.ok(hosts.length > 0 && hosts.every((h) => h === sweep), "the host handed in is monitoring's sweepHost()");
});

test("R34, R3: a throwing importTick is answered {error} under registerfileimport and the other consumers still tick", async () => {
  const { w, s } = importWorld();
  START(w);
  w.registers.importTick = async () => { throw new Error("slice broke"); };
  const r = await s.onAlarm(w.clock.ms);
  assert.deepEqual(r.registerfileimport, { error: "slice broke" });
  assert.ok("monitor" in r || "monitorcadence" in r || r.swept !== undefined, "the rest of the firing ran");
});

test("R34: while the sweep host is paused no slice runs, the consumer is not due and holds no alarm", async () => {
  const pausedHost = { paused: () => ({ paused: true }), openEpoch: () => 1, claim: () => true, closeEpoch: () => {}, running: new Set() };
  const { w, s, st } = importWorld({ host: pausedHost });
  START(w);
  assert.ok(s.consumers().includes("register-import"), "the consumer is registered");
  const r = await s.onAlarm(w.clock.ms);
  assert.equal("registerfileimport" in r, false, "not due while paused");
  assert.equal(w.sql(`SELECT state FROM register_imports`)[0].state, "queued", "no slice ran");
  assert.equal(st.alarm, null, "no alarm fires again and again while paused");
});

test("R34 control: with no import queued the consumer is never due and wants no alarm", async () => {
  const { w, s, st } = importWorld();
  assert.ok(s.consumers().includes("register-import"), "the consumer is registered");
  for (const t of [0, DAY, 30 * DAY]) assert.equal("registerfileimport" in (await s.onAlarm(w.clock.ms + t)), false);
  assert.equal(st.alarm, null);
});

/* ---- R35: discard-clear and mail-clear over the real doorbell and mail-door ---- */

const NOW = Date.parse("2026-11-20T12:00:00Z");

async function clearWorld({ knock = true, mail = true, reader = () => false } = {}) {
  const db = doorbellFresh({ evidence: doorbellBucket(), env: { INSTANCE_NAME: "inst" } });
  if (reader) assert.equal(db.c.registerReader("litigation-hold", "actions", reader).ok, true);
  const md = mailFresh();
  let k = null, m = null;
  if (knock) {
    k = await db.c.knock({ content: "an old knock", sourceAddress: "9.9.1.2", now: NOW - 8 * DAY });
    assert.equal(k.ok, true, JSON.stringify(k));
    assert.equal(db.c.inboxResolve({ knockId: k.knockId, status: "discarded", by: "member:m1", reason: "kept for the test" }).ok, true);
  }
  if (mail) {
    const ann = await addressFor(md.d, "ann");
    m = await md.d.receiveMail({ raw: plain("old mail"), envelope_to: ann, now: NOW - 15 * DAY });
    assert.equal(m.ok, true, JSON.stringify(m));
  }
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { doorbell: () => db.c, mailDoor: () => md.d } });
  const inbox = () => db.rows(`SELECT knock_id FROM inbox WHERE status = 'discarded'`).length;
  const waiting = () => md.d.mailWaiting({ viewer: "member:ann", now: NOW }).mail?.length ?? 0;
  return { db, md, s, st, k, m, inbox, waiting };
}

test("R35: an instance with a discarded knock 8 days old and a waiting message 15 days old fires once and clears both, under discardclear and mailclear, naming the message's owner", async () => {
  const { s, st, inbox, waiting } = await clearWorld();
  assert.equal(await s.arm(NOW), Date.parse(new Date(NOW - DAY).toISOString()), "armed at the earliest owed instant (the knock's, a day ago)");
  const r = await s.onAlarm(NOW);
  assert.deepEqual([r.discardclear.ok, r.discardclear.cleared], [true, 1]);
  assert.deepEqual([r.mailclear.ok, r.mailclear.cleared], [true, 1]);
  assert.deepEqual(r.mailclear.owners.map((o) => [o.owner, o.count]), [["ann", 1]], "the owner is told through the clearing's owners");
  assert.deepEqual([inbox(), waiting()], [0, 0]);
  assert.equal(st.alarm, null, "nothing left: no alarm (R15)");
});

test("R35: an instance with neither is due at no firing and holds no alarm", async () => {
  const { s, st } = await clearWorld({ knock: false, mail: false });
  assert.deepEqual(s.consumers(), ["discard-clear", "mail-clear"], "both registered");
  assert.equal(await s.arm(NOW), null);
  const r = await s.onAlarm(NOW);
  assert.deepEqual(["discardclear" in r, "mailclear" in r], [false, false]);
  assert.equal(st.alarm, null);
});

test("R35, R3: a throwing mail-clear leaves discard-clear ticking", async () => {
  const { md, s, inbox } = await clearWorld();
  md.d.clearWaitingMail = async () => { throw new Error("mail broke"); };
  const r = await s.onAlarm(NOW);
  assert.deepEqual(r.mailclear, { error: "mail broke" });
  assert.equal(r.discardclear.cleared, 1);
  assert.equal(inbox(), 0);
});

test("R35, R15: while the doorbell may not clear (no litigation-hold reader, or a hold), discard-clear wants nothing, so a held knock keeps no alarm firing", async () => {
  for (const reader of [null, () => true]) {
    const { s, st, inbox } = await clearWorld({ mail: false, reader });
    assert.ok(s.consumers().includes("discard-clear"));
    assert.equal(await s.arm(NOW), null, String(reader));
    const r = await s.onAlarm(NOW);
    assert.equal("discardclear" in r, false);
    assert.equal(inbox(), 1, "the knock is kept");
    assert.equal(st.alarm, null);
  }
});

test("R35 control: a knock 6 days old and a message 13 days old are not yet due; the alarm is set at the knock's seventh day", async () => {
  const db = doorbellFresh({ evidence: doorbellBucket(), env: { INSTANCE_NAME: "inst" } });
  assert.equal(db.c.registerReader("litigation-hold", "actions", () => false).ok, true);
  const k = await db.c.knock({ content: "a young knock", sourceAddress: "9.9.3.4", now: NOW - 6 * DAY });
  db.c.inboxResolve({ knockId: k.knockId, status: "discarded", by: "member:m1", reason: "kept for the test" });
  const md = mailFresh();
  await md.d.receiveMail({ raw: plain("young"), envelope_to: await addressFor(md.d, "ann"), now: NOW - 13 * DAY });
  const st = storage();
  const s = new Scheduler({ storage: st, owners: { doorbell: () => db.c, mailDoor: () => md.d } });
  assert.deepEqual(s.consumers(), ["discard-clear", "mail-clear"], "both registered");
  const r = await s.onAlarm(NOW);
  assert.deepEqual(["discardclear" in r, "mailclear" in r], [false, false]);
  assert.equal(st.alarm, NOW + DAY);
});

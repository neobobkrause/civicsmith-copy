/* monitoring R74 (T47; N969): `monitorSet` (`op=monitorset`), a member's act setting a bundle's `monitoring.enabled`,
   driven at its interface over the real record, membership and promotion (fixture.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, serve, DAEMON, V, NOW_MS, infoMd } from "./fixture.mjs";
import { projectActNotParticipant } from "../promotion/fixtures.mjs";
import { monitoringOps, MONITOR_SET_CHECKS, MONITOR_AUTHOR } from "../../../src/monitoring/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const LOC = "https://records.example.org/set.txt";
const ALICE = V("alice");
const set = (w, o) => w.m.monitorSet({ author: ALICE, viewer: ALICE, ...o });
const tick = (w, id) => w.m.monitor({ bundleId: id, viewer: DAEMON, actorClass: "machine", actor: DAEMON });
/* What a refusal must leave untouched: the bundle's manifest and its document. */
const untouched = (w, id) => JSON.stringify([w.manifest(id).length, w.text(id)]);
const inPlan = (w, id) => w.m.schedule(NOW_MS).due.some((d) => d.bundle === id || (d.versions || []).includes(id));

test("R74 control: a member's enabled: true on a bundle with a public locator lands, and op=monitor on it is then not refused NOT_MONITORED; the plan reads it as monitored", async () => {
  const w = world();
  const id = "INFO-2026-0901-on";
  w.monitored(id, LOC, "set-v1", { enabled: false });
  assert.equal((await tick(w, id)).body.reason, "NOT_MONITORED", "before the act");
  assert.equal(inPlan(w, id), false);
  const before = w.text(id);
  const n = w.manifest(id).length;
  const r = await set(w, { bundleId: id, enabled: true });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual([r.bundleId, r.enabled, r.frequency, typeof r.revision], [id, true, null, "string"]);
  assert.equal(r.revision, w.record.head(id).bundleSha);
  /* one promotion, authored by the member, never mechanical */
  const m = w.manifest(id);
  assert.equal(m.length, n + 1);
  assert.equal(m.at(-1).author, ALICE);
  assert.notEqual(m.at(-1).writer, "mechanical");
  assert.notEqual(m.at(-1).author, MONITOR_AUTHOR);
  /* only monitoring.enabled and last_updated moved in the front matter; one Session Log entry added; files carried */
  const fb = parseFrontmatter(before).data, fa = w.fm(id);
  assert.equal(fa.monitoring.enabled, true);
  assert.deepEqual({ ...fa, monitoring: { ...fa.monitoring, enabled: false }, last_updated: fb.last_updated }, fb);
  const added = w.text(id).split("\n").filter((l) => !before.split("\n").includes(l));
  assert.ok(added.some((l) => /^### Session /.test(l)) && added.some((l) => /Monitoring set by alice/.test(l)), added.join("|"));
  assert.ok(added.every((l) => /^last_updated:|^  enabled: true$|^### Session |Monitoring set by alice|^$/.test(l)), added.join("|"));
  assert.ok(w.record.readFile(id, "data/provenance.json"), "the register is carried");
  /* nothing fetched, nothing ticked */
  assert.equal(w.net.seen.length, 0);
  assert.equal(w.looks().length, 0);
  /* from the next read */
  assert.equal(inPlan(w, id), true);
  w.net.routes[LOC] = serve("set-v1");
  const t = await tick(w, id);
  assert.notEqual(t.body.reason, "NOT_MONITORED");
  assert.equal(t.body.ok, true);
});

test("R74 the same act by a machine credential is refused MACHINE_CANNOT_SET_MONITORING (C-18.20) before every other condition, writing nothing; control: a member's lands", async () => {
  const w = world();
  const id = "INFO-2026-0902-machine";
  w.monitored(id, LOC, "m-v1", { enabled: false });
  const before = untouched(w, id);
  const row = MONITOR_SET_CHECKS.MACHINE_CANNOT_SET_MONITORING;
  for (const author of ["", "   ", null, DAEMON, "class:admin", "token:member", "claude", "daemon"]) {
    /* the rest of the request is wrong too: the author is asked first */
    const r = await w.m.monitorSet({ bundleId: null, enabled: "yes", frequency: "fortnightly", author, viewer: ALICE });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation],
      [false, "MACHINE_CANNOT_SET_MONITORING", "MACHINE_CANNOT_SET_MONITORING", "C-18.20", row.translation], String(author));
    assert.match(r.detail, /Nothing was written\.$/);
  }
  assert.equal(untouched(w, id), before);
  assert.equal((await set(w, { bundleId: id, enabled: true })).ok, true, "control: a member");
});

test("R74 enabled: false returns op=monitor to NOT_MONITORED and takes the bundle out of the plan", async () => {
  const w = world();
  const id = "INFO-2026-0903-off";
  w.monitored(id, LOC, "off-v1", { freq: "daily" });
  w.net.routes[LOC] = serve("off-v1");
  assert.equal((await tick(w, id)).body.ok, true, "monitored before the act");
  const r = await set(w, { bundleId: id, enabled: false });
  assert.deepEqual([r.ok, r.enabled, r.frequency], [true, false, "daily"]);
  assert.equal(w.fm(id).monitoring.enabled, false);
  assert.equal((await tick(w, id)).body.reason, "NOT_MONITORED");
  assert.equal(w.m.schedule(NOW_MS + 30 * 86400000).due.some((d) => d.bundle === id), false);
  assert.equal(w.m.monitoring({ viewer: DAEMON, now: NOW_MS }).items.some((x) => x.bundle === id), false);
});

test("R74 refusals, in order, each writing nothing: required bundleId (R1's), ABSENT for absent and unseen identically, MONITOR_SET_REFUSED (C-18.21) naming the field, NO_LOCATOR only with enabled: true", async () => {
  const w = world();
  w.inProject("PROJ-2026-0904-p", { owner: "carol" });
  const id = "INFO-2026-0904-doc";
  w.monitored(id, LOC, "r-v1", { enabled: false, lines: ["project: PROJ-2026-0904-p"] });
  const before = untouched(w, id);
  const CAROL = V("carol");
  /* 2: no bundleId, R1's required-argument refusal (the rest wrong too) */
  for (const bundleId of [null, "", 7]) {
    const r = await w.m.monitorSet({ bundleId, enabled: "yes", author: CAROL, viewer: CAROL });
    assert.deepEqual([r.ok, r.reason, r.argument, r.op], [false, "REQUIRED_ARGUMENT_MISSING", "bundleId", "monitorset"]);
  }
  /* 3: absent and unseen alike, before the shape is read */
  const absent = await w.m.monitorSet({ bundleId: "INFO-2026-0999-none", enabled: "yes", author: CAROL, viewer: CAROL });
  const unseen = await w.m.monitorSet({ bundleId: id, enabled: "yes", author: V("zed"), viewer: V("zed") });
  assert.deepEqual(absent, { ok: false, reason: "ABSENT", bundleId: "INFO-2026-0999-none" });
  assert.deepEqual(unseen, { ok: false, reason: "ABSENT", bundleId: id });
  /* 4: the shape, naming the field */
  const row = MONITOR_SET_CHECKS.MONITOR_SET_REFUSED;
  for (const [o, field] of [[{ enabled: "yes" }, "enabled"], [{}, "enabled"], [{ enabled: 1 }, "enabled"],
                            [{ enabled: null }, "enabled"], [{ enabled: true, frequency: "fortnightly" }, "frequency"],
                            [{ enabled: false, frequency: 3 }, "frequency"], [{ enabled: true, frequency: "" }, "frequency"]]) {
    const r = await w.m.monitorSet({ bundleId: id, ...o, author: CAROL, viewer: CAROL });
    assert.deepEqual([r.ok, r.reason, r.code, r.check, r.translation, r.field],
      [false, "MONITOR_SET_REFUSED", "MONITOR_SET_REFUSED", "C-18.21", row.translation, field], JSON.stringify(o));
    assert.match(r.detail, /Nothing was written\.$/);
  }
  /* 5: with enabled: true, a locator that is not public https (one code, one condition) */
  const http = "INFO-2026-0905-http";
  w.promote(http, infoMd(http, "http://records.example.org/x", { enabled: false }));
  const hb = untouched(w, http);
  /* the shape is asked before the locator: a malformed act on a bundle with no public locator is MONITOR_SET_REFUSED */
  assert.equal((await set(w, { bundleId: http, enabled: "yes" })).reason, "MONITOR_SET_REFUSED");
  const nl = await set(w, { bundleId: http, enabled: true });
  assert.deepEqual([nl.ok, nl.reason], [false, "NO_LOCATOR"]);
  assert.equal(untouched(w, http), hb);
  assert.equal(untouched(w, id), before);
  assert.equal(w.net.seen.length, 0);
  /* controls: enabled: false needs no locator; the project's owner sees and sets; a valid frequency lands */
  w.promote(http, infoMd(http, "http://records.example.org/x", { enabled: true }));
  assert.equal((await set(w, { bundleId: http, enabled: false })).ok, true);
  const ok = await w.m.monitorSet({ bundleId: id, enabled: true, frequency: "weekly", author: CAROL, viewer: CAROL });
  assert.deepEqual([ok.ok, ok.enabled, ok.frequency], [true, true, "weekly"]);
});

test("R74 a document already in the asked state answers {ok: true, existed: true} and writes nothing; a different frequency is written; control: a different state is written", async () => {
  const w = world();
  const id = "INFO-2026-0906-same";
  w.monitored(id, LOC, "s-v1", { freq: "weekly" });
  const before = untouched(w, id);
  for (const o of [{ enabled: true }, { enabled: true, frequency: "weekly" }, { enabled: true, frequency: null }]) {
    const r = await set(w, { bundleId: id, ...o });
    assert.deepEqual([r.ok, r.existed], [true, true], JSON.stringify(o));
    assert.equal(untouched(w, id), before, JSON.stringify(o));
  }
  const f = await set(w, { bundleId: id, enabled: true, frequency: "daily" });
  assert.deepEqual([f.ok, f.existed, f.frequency], [true, undefined, "daily"]);
  assert.equal(w.fm(id).monitoring.frequency, "daily");
  const plan = w.m.schedule(NOW_MS).due.find((d) => d.bundle === id);
  assert.deepEqual([plan.frequency, plan.frequency_source], ["daily", "authored"], "the plan reads the written frequency");
  const off = await set(w, { bundleId: id, enabled: false });
  assert.deepEqual([off.ok, off.existed, off.enabled], [true, undefined, false]);
});

test("R74 the monitoring block is added when the document has none", async () => {
  const w = world();
  const bare = "INFO-2026-0907-bare";
  const md = infoMd(bare, LOC).split("\n").filter((l) => !/^monitoring:|^  enabled:|^  last_checked:/.test(l)).join("\n");
  assert.equal(w.promote(bare, md).ok, true);
  assert.equal(w.fm(bare).monitoring, undefined);
  const r = await set(w, { bundleId: bare, enabled: true, frequency: "monthly" });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(w.fm(bare).monitoring, { enabled: true, frequency: "monthly" });
  assert.equal((await tick(w, bare)).body.reason !== "NOT_MONITORED", true);
});

test("R74 promotion's refusal of the member's revision is answered as promotion gives it, writing nothing", async () => {
  const w = world();
  const id = "INFO-2026-0909-refused";
  w.monitored(id, LOC, "p-v1", { enabled: false });
  const before = untouched(w, id);
  const real = w.promotion.promote;
  const refusal = projectActNotParticipant();
  const seen = [];
  w.promotion.promote = (pkg) => { seen.push(pkg); return refusal; };
  try {
    /* promotion's refusal is known only at the write (K3135): a malformed act, one without a public locator, and a
       no-op answer as R74 orders them first, and promotion is not asked */
    assert.equal((await set(w, { bundleId: id, enabled: "yes" })).reason, "MONITOR_SET_REFUSED");
    const same = await set(w, { bundleId: id, enabled: false });
    assert.deepEqual([same.ok, same.existed], [true, true]);
    assert.equal(seen.length, 0, "promotion not asked before the write");
    const r = await set(w, { bundleId: id, enabled: true });
    assert.deepEqual(r, refusal);
    assert.equal(seen.length, 1);
  } finally { w.promotion.promote = real; }
  assert.equal(untouched(w, id), before);
  /* control: the same act, promotion admitting it, lands */
  assert.equal((await set(w, { bundleId: id, enabled: true })).ok, true);
  assert.equal(w.fm(id).monitoring.enabled, true);
  /* the member's revision: authored and stamped by the member, never mechanical */
  assert.deepEqual([seen[0].author, seen[0].actorIdentity, seen[0].actorViewer, seen[0].actorMemberId, seen[0].writer],
    [ALICE, ALICE, ALICE, "alice", undefined]);
});

test("R74 op=monitorset: the author and viewer are the control plane's stamps from the query, never the body's", async () => {
  const w = world();
  const id = "INFO-2026-0910-route";
  w.monitored(id, LOC, "rt-v1", { enabled: false });
  const forged = await monitoringOps(w.m, new URL(`http://do/monitorset?author=${encodeURIComponent(DAEMON)}&viewer=${encodeURIComponent(DAEMON)}`),
    { bundleId: id, enabled: true, author: ALICE, viewer: ALICE }).monitorset();
  assert.equal(forged.reason, "MACHINE_CANNOT_SET_MONITORING");
  assert.equal(w.fm(id).monitoring.enabled, false);
  const ok = await monitoringOps(w.m, new URL(`http://do/monitorset?author=${encodeURIComponent(ALICE)}&viewer=${encodeURIComponent(ALICE)}`),
    { bundleId: id, enabled: true, frequency: "hourly", author: DAEMON }).monitorset();
  assert.deepEqual([ok.ok, ok.enabled, ok.frequency], [true, true, "hourly"]);
});

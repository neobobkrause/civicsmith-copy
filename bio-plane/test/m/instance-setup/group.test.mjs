/* The producing group (R1–R4) and the invariants over it (R26, R28–R30, R41), at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { boot, stubOver, doAnswer } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { TRANSLATIONS_CHECKS } from "../../../src/translations/checks.mjs";
import { GROUP_SLUG_RE, INSTANCE_SETUP_CHECKS, INSTANCE_SETUP_TABLES, NO_GROUP_RECORDED, instanceSetupOps } from "../../../src/setup.mjs";
import { wordRx } from "../../word-rx.mjs";

const post = async (m, path, body) => doAnswer(stubOver(m).fetch(new Request(`http://do/${path}`,
  { method: "POST", body: JSON.stringify(body) })));
const get = async (m, path) => doAnswer(stubOver(m).fetch(`http://do/${path}`));

test("R1 producingGroup: the recorded slug or null, registered with promotion as the fact producingGroup, read from the store only", async () => {
  const w = await boot({ env: { INSTANCE_NAME: "river-town" } });
  assert.equal(w.m.producingGroup(), "river-town");
  /* a second registration of the fact is promotion's STEP_DECLARED, naming the module that provides it */
  assert.equal(w.prov.promotion.registerFact("producingGroup", "another-module", () => null).module, "instance-setup");
  assert.equal(w.prov.promotion.fact("producingGroup").value, "river-town");
  /* the store only, never the binding: a later boot with the binding moved still reads the recorded slug */
  const again = await boot({ st: w.st, env: { INSTANCE_NAME: "other-town" } });
  assert.equal(again.m.producingGroup(), "river-town");
  assert.equal(again.prov.promotion.fact("producingGroup").value, "river-town");
  const none = await boot({ env: {} });
  assert.equal(none.m.producingGroup(), null);
  assert.equal(none.prov.promotion.fact("producingGroup").value, null);
});

test("R2 at the first boot INSTANCE_NAME in the grammar is recorded (bootstrap, recorded_by null); malformed or absent records nothing; no later boot records or changes it", async () => {
  const w = await boot({ env: { INSTANCE_NAME: "  river-town  " } });
  const g = w.m.instanceGroup();
  assert.deepEqual([g.group, g.source, g.recorded_by], ["river-town", "bootstrap", null]);
  assert.match(g.recorded_at, /^\d{4}-\d\d-\d\dT/);
  for (const bad of ["River-Town", "rt", "-river", "river_town", "x".repeat(41), ""]) {
    const b = await boot({ env: bad ? { INSTANCE_NAME: bad } : {} });
    assert.equal(b.m.instanceGroup().group, null, JSON.stringify(bad));
  }
  /* a later boot, even of a store that recorded nothing, records nothing whatever INSTANCE_NAME says */
  const blank = await boot({ env: {} });
  const later = await boot({ st: blank.st, env: { INSTANCE_NAME: "late-town" } });
  assert.equal(later.m.instanceGroup().group, null);
  const moved = await boot({ st: w.st, env: { INSTANCE_NAME: "moved-town" } });
  assert.equal(moved.m.instanceGroup().group, "river-town");
  assert.equal(moved.m.instanceGroup().recorded_at, g.recorded_at);
});

test("R3 instanceGroup answers the row or the stated absence; instanceGroupPublic answers {ok, group} or {ok, group: null, detail} and no other key", async () => {
  const none = await boot({ env: {} });
  assert.deepEqual(none.m.instanceGroup(), { ok: true, group: null, recorded_at: null, source: null, recorded_by: null,
                                             detail: NO_GROUP_RECORDED });
  assert.deepEqual(none.m.instanceGroupPublic(), { ok: true, group: null, detail: NO_GROUP_RECORDED });
  assert.match(NO_GROUP_RECORDED, wordRx("filings.why.producing_group_recorded"));
  const w = await boot({ env: { INSTANCE_NAME: "river-town" } });
  assert.deepEqual(Object.keys(w.m.instanceGroup()).sort(), ["group", "ok", "recorded_at", "recorded_by", "source"]);
  assert.deepEqual(w.m.instanceGroupPublic(), { ok: true, group: "river-town" });
  /* the same over the Durable Object's routes */
  assert.deepEqual((await get(w.m, "instancegrouppublic")).result, { ok: true, group: "river-town" });
  assert.equal((await get(w.m, "instancegroup")).result.source, "bootstrap");
});

test("R4 instanceGroupSeed: GROUP_SLUG_MALFORMED (C-64.2), GROUP_ALREADY_RECORDED (C-64.3) naming the held group, when and how; else recorded as seed by the stamped author", async () => {
  const w = await boot({ env: {} });
  for (const bad of [null, "", "Bad Slug", "ab", "-ab", "a".repeat(41), 7]) {
    const r = w.m.instanceGroupSeed({ slug: bad, author: "class:admin" });
    assert.equal(r.ok, false); assert.equal(r.reason, "GROUP_SLUG_MALFORMED"); assert.equal(r.check, "C-64.2");
    assert.equal(r.translation, INSTANCE_SETUP_CHECKS.GROUP_SLUG_MALFORMED.translation);
    assert.equal(w.m.instanceGroup().group, null);
  }
  const ok = w.m.instanceGroupSeed({ slug: " late-town ", author: "class:admin" });
  assert.deepEqual([ok.ok, ok.group, ok.source, ok.recorded_by], [true, "late-town", "seed", "class:admin"]);
  assert.equal(ok.note, word("setup.note.document_store_writes"));
  const anon = await boot({ env: {} });
  assert.equal(anon.m.instanceGroupSeed({ slug: "anon-town" }).recorded_by, null);
  const again = w.m.instanceGroupSeed({ slug: "other-town", author: "class:admin" });
  assert.deepEqual([again.ok, again.reason, again.check, again.group, again.source],
                   [false, "GROUP_ALREADY_RECORDED", "C-64.3", "late-town", "seed"]);
  assert.equal(again.recorded_at, ok.recorded_at);
  assert.equal(w.m.producingGroup(), "late-town");
  /* a store recorded at its first boot refuses a seed the same way */
  const b = await boot({ env: { INSTANCE_NAME: "river-town" } });
  assert.equal(b.m.instanceGroupSeed({ slug: "late-town", author: "x" }).source, "bootstrap");
});

test("R26 the slug is recorded once: no statement this module runs updates or deletes it, and a second value is refused", async () => {
  const w = await boot({ env: { INSTANCE_NAME: "river-town" } });
  w.m.instanceGroupSeed({ slug: "late-town", author: "x" });
  await boot({ st: w.st, env: { INSTANCE_NAME: "moved-town" } });
  const writes = w.st.statements.filter((q) => /instance_group/.test(q) && /^\s*(INSERT|UPDATE|DELETE|REPLACE)/i.test(q));
  assert.ok(writes.length > 0);
  for (const q of writes) assert.match(q, /^\s*INSERT INTO instance_group[\s\S]*ON CONFLICT\(id\) DO NOTHING/);
  assert.equal(w.m.producingGroup(), "river-town");
});

test("R28 R41 every table of INSTANCE_SETUP_TABLES (the seed ledgers apart) is declared to record-core exempt from purge, and a purge in either form clears none of them", async () => {
  const w = await boot({ env: { INSTANCE_NAME: "river-town" } });
  assert.equal(w.started.purge.ok, true);
  w.m.recordRuntimeObservation({ metric: "capture_work_bytes", ms: 10 });
  w.m.recordCpuProbeStep({ run: "r1", step: 1, elapsedMs: 5, iterations: 100000 });
  w.st.db.exec(`INSERT INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version)
                VALUES ('INFO-1', 'information', 'river-town', 't', 'collected', 'x', 'x', 'x', 1)`);
  const count = () => INSTANCE_SETUP_TABLES.map((t) => w.st.db.prepare(`SELECT count(*) n FROM ${t}`).get().n);
  const before = count();
  assert.ok(before[0] === 1 && before[3] === 1 && before[5] === 1);
  const whole = w.record.purge({});
  assert.equal(whole.ok, true);
  for (const t of INSTANCE_SETUP_TABLES) assert.equal(t in whole.removed, false, t);
  w.record.purge({ bundleId: "INFO-1" });
  assert.deepEqual(count(), before);
  /* the profiles setting is exempt as every setting is (record-core R25) */
  w.prov.admins.add("admin");
  w.m.profilesSet({ profiles: ["oakland-alameda"], by: "admin" });
  w.record.purge({});
  assert.deepEqual(w.m.profiles().profiles.map((p) => p.id), ["oakland-alameda"]);
});

test("R29 by, author and origin are the control plane's stamps: a body naming its own is overwritten by the query's", async () => {
  const w = await boot({ env: {} });
  const seeded = await post(w.m, "instancegroupseed?author=class:admin", { slug: "late-town", author: "someone-else" });
  assert.equal(seeded.result.recorded_by, "class:admin");
  w.prov.admins = new Set(["admin"]);
  const named = await post(w.m, "groupnameset?by=member:mallory", { name: "Late Town", by: "admin" });
  assert.equal(named.result.reason, "GROUP_IDENTITY_NOT_ADMIN");
  const dom = await post(w.m, "groupdomainset?by=admin&origin=https://late.example", { domain: "late.example.org", origin: "https://evil.example" });
  assert.equal(dom.result.instance_address, "https://late.example");
  const prof = await post(w.m, "profilesset?by=member:mallory", { profiles: [], by: "admin" });
  assert.equal(prof.result.reason, "PROFILES_NOT_ADMIN");
  /* every route that takes a stamp reads it from the query */
  const url = new URL("http://do/x?by=q-by&author=q-author&origin=https://q.example");
  const seen = {};
  const spy = new Proxy({}, { get: (_, k) => (arg) => { seen[k] = arg; return {}; } });
  const ops = instanceSetupOps(spy, url, { by: "b-by", author: "b-author", origin: "b-origin" });
  ops.instancegroupseed(); ops.groupnameset(); ops.groupdomainset(); ops.profilesset();
  assert.equal(seen.instanceGroupSeed.author, "q-author");
  assert.equal(seen.groupNameSet.by, "q-by");
  assert.deepEqual([seen.groupDomainSet.by, seen.groupDomainSet.origin], ["q-by", "https://q.example"]);
  assert.equal(seen.profilesSet.by, "q-by");
});

test("R30 C-64.2, C-64.3, C-64.5, C-64.6 and C-64.7 are this module's rows, each raised here with its check and translation, beside T34's C-64.8 (R60) and C-64.9, C-64.10 (R65), and T37's C-64.11–C-64.26 (R67–R73) but C-64.18, dropped and never reused (R75; T38, N793), T45's C-64.27 (R77), and T46's C-64.28, C-64.29 (R79; K2996), and T47's C-64.30 (R84), and T48's C-64.31–C-64.33 (R87, R90)", async () => {
  const rows = Object.values(INSTANCE_SETUP_CHECKS).filter((r) => r.check.startsWith("C-64."));
  assert.deepEqual(rows.map((r) => r.check).sort(), ["C-64.10", "C-64.2", "C-64.3", "C-64.5", "C-64.6", "C-64.7", "C-64.8", "C-64.9",
    "C-64.27", "C-64.28", "C-64.29", "C-64.30", "C-64.32", "C-64.33",
    /* T53's C-64.34, C-64.35 (R114: the mail domain and the switch) */
    "C-64.34", "C-64.35"].sort());
  for (const r of rows) {
    assert.match(r.where, /^src\/setup\.mjs /);
    /* BOB's drafts for T48's three rows (R87, R90) are shorter sentences; each still says what was not done */
    assert.ok(r.translation.split(/\s+/).length >= (/^C-64\.3[23]$/.test(r.check) ? 10 : 20), r.check);
    if (/^C-64\.3[23]$/.test(r.check)) assert.match(r.translation, /Nothing was recorded\.$/, r.check);
  }
  const w = await boot({ env: {} });
  w.prov.admins = new Set(["admin"]);
  const raised = [
    w.m.instanceGroupSeed({ slug: "!" }),
    (w.m.instanceGroupSeed({ slug: "late-town" }), w.m.instanceGroupSeed({ slug: "late-town" })),
    w.m.groupNameSet({ name: "x", by: "nobody" }),
    w.m.groupNameSet({ name: "", by: "admin" }),
    await w.m.groupDomainSet({ domain: "https://x.org/", by: "admin" }),
  ];
  assert.deepEqual(raised.map((r) => r.check), ["C-64.2", "C-64.3", "C-64.5", "C-64.6", "C-64.7"]);
  for (const r of raised) assert.equal(r.translation, INSTANCE_SETUP_CHECKS[r.reason].translation);
});

test("Terms: the slug grammar is 3 to 40 of a-z, 0-9 and '-', beginning and ending with a letter or digit", () => {
  const ok = ["abc", "a-b", "0ab", "a".repeat(40)];
  const bad = ["ab", "a".repeat(41), "-ab", "ab-", "Abc", "a_b", "a b", "ab\n"];
  for (const s of ok) assert.ok(GROUP_SLUG_RE.test(s), s);
  for (const s of bad) assert.ok(!GROUP_SLUG_RE.test(s), JSON.stringify(s));
});

test("R30 every row of this module's table that stays names, in its where, the function that holds its region, and the region inside it; no number is held twice and C-119.5 is held by none (T50: the translation workspace's rows are `translations`', R94)", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../src/setup.mjs"), "utf8").split("\n");
  const body = (fn) => {
    const name = fn.replace(/[$#]/g, "\\$&");
    const def = new RegExp(`^(\\s*)(?:export\\s+)?(?:async\\s+)?(?:function\\s+|static\\s+)?${name}\\s*\\(`);
    for (let i = 0; i < src.length; i++) {
      const m = def.exec(src[i]);
      if (!m || /^\s*(?:return|if|for|while|const|let)\b/.test(src[i])) continue;
      const close = src.findIndex((l, j) => j > i && l.startsWith(`${m[1]}}`));
      return close < 0 ? null : src.slice(i, close + 1);
    }
    return null;
  };
  /* the rows the workspace moved are `translations`' (R94, answer-envelope's catalogue lists its file) */
  const mine = Object.entries(INSTANCE_SETUP_CHECKS).filter(([code]) => !(code in TRANSLATIONS_CHECKS));
  for (const [code, row] of mine) {
    const m = /^src\/setup\.mjs (\S+) > (\S+)$/.exec(row.where);
    assert.ok(m, `${code}: ${row.where}`);
    const b = body(m[1]);
    assert.ok(b, `${code}: no function ${m[1]}`);
    const open = b.findIndex((l) => l.includes(`/* DEC-49 REGION ${m[2]} */`));
    const end = b.findIndex((l) => l.includes(`/* END DEC-49 REGION ${m[2]} */`));
    assert.ok(open >= 0 && end > open, `${code}: ${m[1]} holds no region ${m[2]}`);
  }
  const numbers = Object.values(INSTANCE_SETUP_CHECKS).map((r) => r.check);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.equal(numbers.includes("C-119.5"), false);
  assert.equal(mine.map(([, r]) => r.check).filter((n) => /^C-64\.(1[1-9]|2\d)$/.test(n)).length, 3, "C-64.27, .28 and .29 stay");
  assert.equal(numbers.includes("C-64.18"), false);
});

test("R4 instanceGroupSeed records its instant on the instance clock: pinned by env.BIO_NOW_MS it is that instant; unpinned, the wall clock", async () => {
  const pinned = Date.parse("2031-03-04T05:06:07.000Z");
  const w = await boot({ env: { BIO_NOW_MS: String(pinned) } });
  const seeded = w.m.instanceGroupSeed({ slug: "pinned-town", author: "class:admin" });
  assert.equal(seeded.recorded_at, "2031-03-04T05:06:07.000Z");
  assert.equal(w.m.instanceGroup().recorded_at, "2031-03-04T05:06:07.000Z");
  const before = Date.now();
  const free = await boot({ env: {} });
  const wall = free.m.instanceGroupSeed({ slug: "wall-town", author: "class:admin" });
  const at = Date.parse(wall.recorded_at);
  assert.ok(at >= before - 1000 && at <= Date.now() + 1000, wall.recorded_at);
});

test("R4 instanceGroupSeed takes its instant from the clock handed in before env.BIO_NOW_MS; none handed, env; none at all, the wall clock", async () => {
  const handed = Date.parse("2032-07-08T09:10:11.000Z");
  const pinned = Date.parse("2031-03-04T05:06:07.000Z");
  const h = await boot({ env: { BIO_NOW_MS: String(pinned) }, now: () => handed });
  assert.equal(h.m.instanceGroupSeed({ slug: "handed-town", author: "class:admin" }).recorded_at, "2032-07-08T09:10:11.000Z");
  const e = await boot({ env: { BIO_NOW_MS: String(pinned) } });
  assert.equal(e.m.instanceGroupSeed({ slug: "env-town", author: "class:admin" }).recorded_at, "2031-03-04T05:06:07.000Z");
  const before = Date.now();
  const w = await boot({ env: {} });
  const at = Date.parse(w.m.instanceGroupSeed({ slug: "free-town", author: "class:admin" }).recorded_at);
  assert.ok(at >= before - 1000 && at <= Date.now() + 1000);
});

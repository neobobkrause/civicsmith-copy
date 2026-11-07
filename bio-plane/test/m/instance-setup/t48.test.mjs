/* T48 (T48-62): the language a member reads in (R87), the daily update check (R88), the update notice and its three
   choices (R89, R90), their tables (R91), the member-facing `forgot` words (R47, K3240) and the re-point of the keep-away
   reads to `ai-accounts` (R53, R55; N996), at the module's interface. The notice is signed with a throwaway release
   key handed in as the module's list of release keys; the fetch, the governor and the clock are stand-ins that record
   what they were asked. Every refusal has a control (K874). */
import test from "node:test";
import { word } from "../../../src/setup-words/index.mjs";
import assert from "node:assert/strict";
import { boot, frame, providers } from "./fixture.mjs";
import { INSTANCE_SETUP_TABLES, INSTANCE_SETUP_TABLE_DECLARATIONS, INSTANCE_SETUP_CHECKS, RELEASE_NOTICE_ADDRESS,
         RELEASE_NOTICE_MAX_BYTES, INSTALLER_UPDATE_ADDRESS, UPDATE_CHECK_USER_AGENT, UPDATE_EARLIER_MAX } from "../../../src/setup.mjs";
import { HOSTING_CONTROL, FORGOT_HELP, HOSTING_RECOVERY_DEPLOYER, hostingControlBlock } from "../../../src/setup-fleet.mjs";
import { NS_RELEASE_NOTICE, NS_RELEASE, releaseNoticeStatement } from "../../../src/sshsig.mjs";
import { signSshsig, signerPublicLine } from "../../../scripts/sign-sshsig.mjs";

const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const SEED = (n) => `BIOKEY-RAW1.bio-release.${b64(new Uint8Array(32).map((_, i) => (i * n + 9) % 256))}`;
const ENV = SEED(41), OTHER_ENV = SEED(43);
const KEYS = [signerPublicLine(ENV)];
const MANIFEST = "9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08";
const notice = (version, over = {}) => ({ version, date: "2026-10-14", manifest: MANIFEST, security: false,
  notes: { members: "Searching is faster.", administrators: "You decide when to update.", must_do: "" }, ...over });
const feed = (n, { env = ENV, ns = NS_RELEASE_NOTICE, tamper = null } = {}) => {
  const sig = signSshsig(env, releaseNoticeStatement(n), ns);
  return { ...(tamper ? tamper(n) : n), sig, signer: KEYS[0] };
};
const T0 = Date.parse("2026-10-14T20:00:00Z");
const DAY = 86_400_000;
const ZONE_PROFILE = { id: "zone-profile", name: "Zone", time_zone: { value: "America/Los_Angeles" } };
const juris = { list: () => [ZONE_PROFILE], get: (id) => (id === ZONE_PROFILE.id ? ZONE_PROFILE : null), combine: () => ({ ok: true, conflicts: [] }) };

/* This module at VERSION `version`, a clock the test moves, two administrators and a hosting account held by `second`. */
async function world({ version = "0.84.0", env = {}, st = null, prov = null, zone = false, minute = 615 } = {}) {
  const clock = { t: T0 };
  const p = prov || providers({ admins: ["admin", "second"] });
  p.membership.hostingAccess = () => ({ ok: true, recorded: true, current: { holders: "Second, and the bank", note: null,
    recorded_by: "admin", at: "2026-10-01T00:00:00Z" }, history: [], limit: 1, truncated: false });
  const w = await boot({ st, prov: p, now: () => clock.t,
    env: { VERSION: version, INSTANCE_NAME: "river-town", ADMIN_TOKEN: "a-live-admin-token-0123456789", CLOUDFLARE_API_TOKEN: "cf-secret-0123456789", ...env },
    more: { releaseKeys: KEYS, drawMinute: () => minute, ...(zone ? { jurisdictions: juris } : {}) } });
  if (zone) w.record.setSetting("jurisdiction_profiles", [ZONE_PROFILE.id], "bootstrap");
  w.clock = clock;
  w.serve = (obj, status = 200) => { w.prov.answer = () => new Response(typeof obj === "string" ? obj : JSON.stringify(obj), { status }); };
  w.tick = () => w.m.updateCheckTick();
  w.consumer = () => w.prov.consumers.find((c) => c.name === "update-check");
  w.count = (t) => w.st.db.prepare(`SELECT COUNT(*) AS n FROM ${t}`).get().n;
  w.lastCheck = () => ({ ...w.st.db.prepare(`SELECT at, outcome, version, detail FROM update_checks ORDER BY seq DESC LIMIT 1`).get() });
  return w;
}
const found = async (w, n = notice("0.85.0"), opts) => { w.serve(feed(n, opts)); return w.tick(); };
const call = async (m, path, body) => (await frame(m, new Request(`http://do/${path}`,
  body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) }))).json();

/* ---- R88: the daily check ---- */

test("R88 at start this module registers one scheduler consumer, update-check, under its own key; it draws its minute of the day once and keeps it: a later start records no second draw, and the draw is never computed from the slug (control: many groups of one slug draw different minutes)", async () => {
  const w = await world();
  /* this module's own consumers are registered, each once; another module's beside them (instance-updates' health-send)
     is not pinned here. Control: one of them missing, or registered twice, fails the same reading. */
  const OWN = ["group-domain-recheck", "update-check"];
  const holdsOwn = (names) => OWN.every((n) => names.filter((x) => x === n).length === 1);
  const names = w.prov.consumers.map((c) => c.name);
  assert.equal(holdsOwn(names), true, JSON.stringify(names));
  for (const gone of OWN) assert.equal(holdsOwn(names.filter((n) => n !== gone)), false, gone);
  assert.equal(holdsOwn([...names, "update-check"]), false);
  assert.equal(holdsOwn([...names, "health-send"]), true);
  assert.equal(w.consumer().key, "updatecheck");
  assert.equal(w.started.updateCheck.ok, true);
  const slot = () => w.st.db.prepare(`SELECT minute, drawn_at FROM update_check_slot`).all().map((r) => ({ ...r }));
  assert.deepEqual(slot(), [{ minute: 615, drawn_at: "2026-10-14T20:00:00.000Z" }]);
  /* a later boot over the same storage, drawing something else, keeps the first */
  const later = await world({ st: w.st, minute: 100 });
  assert.deepEqual(later.st.db.prepare(`SELECT minute FROM update_check_slot`).all().map((r) => ({ ...r })), [{ minute: 615 }]);
  /* with no draw handed in the module draws at random: twenty groups of the one slug do not all draw one minute */
  const minutes = new Set();
  for (let i = 0; i < 20; i += 1) {
    const g = await boot({ env: { VERSION: "0.84.0", INSTANCE_NAME: "river-town" } });
    const m = g.st.db.prepare(`SELECT minute FROM update_check_slot`).get().minute;
    assert.ok(Number.isInteger(m) && m >= 0 && m < 1440);
    minutes.add(m);
  }
  assert.ok(minutes.size > 1, "the minute is not a function of the slug");
});

test("R88 the check is due once a day at the group's minute: the first run is the next occurrence of the minute after the draw, then one day after each run, wherever in the day the run fell", async () => {
  const w = await world();
  const at = (s) => Date.parse(s);
  assert.equal(w.consumer().due(), at("2026-10-15T10:15:00Z"));
  assert.equal(w.consumer().wake(), at("2026-10-15T10:15:00Z"));
  assert.equal(w.m.updateCheckWake(), at("2026-10-15T10:15:00Z"));
  w.serve("", 404);
  w.clock.t = at("2026-10-15T10:15:07Z");
  const out = await w.consumer().tick();
  assert.equal(out.updatecheck.outcome, "unreachable");
  assert.equal(w.consumer().due(), at("2026-10-16T10:15:00Z"));
  /* a run that came late (the alarm was lost) is followed a day after the run, not on the old schedule's next slot */
  w.clock.t = at("2026-10-16T23:00:00Z");
  await w.tick();
  assert.equal(w.consumer().due(), at("2026-10-17T10:15:00Z"));
  /* a run early in the day before the minute is due again at that day's minute */
  w.clock.t = at("2026-10-17T03:00:00Z");
  await w.tick();
  assert.equal(w.consumer().due(), at("2026-10-17T10:15:00Z"));
  assert.equal(w.count("update_checks"), 3);
});

test("R88 a notice signed by a release key in the list, newer than the running release, is stored and the check records found; the request is a plain GET of the fixed address that sends no cookie, credential, slug, member or setting: its address is the constant, its headers are accept and a fixed user agent, no body, no redirect followed", async () => {
  const w = await world();
  const out = await found(w);
  assert.deepEqual([out.updatecheck.outcome, out.updatecheck.version], ["found", "0.85.0"]);
  assert.equal(w.count("release_notices"), 1);
  assert.deepEqual(w.lastCheck(), { at: "2026-10-14T20:00:00.000Z", outcome: "found", version: "0.85.0", detail: null });
  assert.equal(w.prov.fetched.length, 1);
  const { url, init } = w.prov.fetched[0];
  assert.equal(url, RELEASE_NOTICE_ADDRESS);
  assert.equal(init.method, "GET");
  assert.equal(init.redirect, "manual");
  assert.deepEqual(Object.keys(init).sort(), ["headers", "method", "redirect"], "no body, no credentials option");
  assert.deepEqual(init.headers, { accept: "application/json", "user-agent": UPDATE_CHECK_USER_AGENT });
  const sent = JSON.stringify([url, init]);
  for (const secret of ["river-town", "a-live-admin-token-0123456789", "cf-secret-0123456789", "admin", "cookie", "authorization"])
    assert.equal(sent.toLowerCase().includes(secret.toLowerCase()), false, `the request carries ${secret}`);
  /* the host is asked of the governor, then the status reported to it */
  assert.deepEqual(w.prov.governed, [["admit", new URL(RELEASE_NOTICE_ADDRESS).host], ["report", new URL(RELEASE_NOTICE_ADDRESS).host, 200]]);
});

test("R88 controls: one character of the notes changed stores nothing and records BAD_SIGNATURE; an older correctly signed notice records NOT_NEWER; the release that runs records none; a notice signed in another namespace records NAMESPACE; by a key not in the list UNKNOWN_KEY; every outcome stores nothing and a later good notice is still found", async () => {
  const w = await world();
  const outcome = async (body) => { w.serve(body); const r = await w.tick(); return r.updatecheck.outcome; };
  const good = notice("0.85.0");
  assert.equal(await outcome(feed(good, { tamper: (n) => ({ ...n, notes: { ...n.notes, members: "Searching is faster!" } }) })), "BAD_SIGNATURE");
  assert.equal(await outcome(feed(notice("0.83.0"))), "NOT_NEWER", "an older release, correctly signed, is a replay");
  assert.equal(await outcome(feed(notice("0.84.0"))), "none", "the release that runs is nothing newer");
  assert.equal(await outcome(feed(good, { ns: NS_RELEASE })), "NAMESPACE");
  assert.equal(await outcome(feed(good, { env: OTHER_ENV })), "UNKNOWN_KEY");
  assert.equal(w.count("release_notices"), 0, "none of these stored a notice");
  assert.equal(w.count("update_checks"), 5, "each run recorded its outcome");
  assert.equal(await outcome(feed(good)), "found", "control: the untouched notice is found");
  assert.equal(w.count("release_notices"), 1);
});

test("R88 a notice no newer than one already held is not stored again, so a replayed older notice changes nothing: the same release records none, an older one NOT_NEWER, a newer one found", async () => {
  const w = await world();
  await found(w, notice("0.86.0"));
  assert.equal(w.count("release_notices"), 1);
  const outcome = async (n) => { w.serve(feed(n)); return (await w.tick()).updatecheck.outcome; };
  assert.equal(await outcome(notice("0.86.0")), "none");
  assert.equal(await outcome(notice("0.85.0")), "NOT_NEWER");
  assert.equal(w.count("release_notices"), 1, "nothing stored by the replays");
  assert.equal(w.m.updateNotice({ viewer: "admin" }).ready.version, "0.86.0", "the ready release is unmoved");
  assert.equal(await outcome(notice("0.87.0")), "found");
  assert.equal(w.count("release_notices"), 2);
});

test("R88 a notice that is no well-formed signed JSON object records MALFORMED and stores nothing: not JSON, an array, no signature, a field missing, a signature of nothing; a notice over 64 KiB is refused with no more than 64 KiB and a little read", async () => {
  const w = await world();
  const outcome = async (body) => { w.serve(body); return (await w.tick()).updatecheck.outcome; };
  const n = notice("0.85.0");
  assert.equal(await outcome("not json {"), "MALFORMED");
  assert.equal(await outcome("[1,2]"), "MALFORMED");
  assert.equal(await outcome({ ...n }), "MALFORMED", "no signature");
  assert.equal(await outcome({ ...feed(n), manifest: undefined }), "MALFORMED", "a field missing");
  assert.equal(await outcome({ ...feed(n), security: "yes" }), "MALFORMED", "a field of the wrong kind");
  assert.equal(await outcome({ ...n, sig: "" }), "MALFORMED");
  let pulls = 0;
  w.prov.answer = () => new Response(new ReadableStream({ pull(c) { pulls += 1; c.enqueue(new Uint8Array(16384).fill(120)); if (pulls > 400) c.close(); } }), { status: 200 });
  const big = await w.tick();
  assert.equal(big.updatecheck.outcome, "MALFORMED");
  assert.equal(big.updatecheck.detail, word("instance-setup.updates.detail.too_big", { bytes: RELEASE_NOTICE_MAX_BYTES }));
  assert.ok(pulls * 16384 <= RELEASE_NOTICE_MAX_BYTES + 3 * 16384, `read ${pulls * 16384} bytes of a body without end`);
  assert.equal(w.count("release_notices"), 0);
  /* control: a notice just inside the cap is read whole */
  const room = { members: "m".repeat(2000), administrators: "a".repeat(2000), must_do: "" };
  assert.equal(await outcome(feed(notice("0.85.0", { notes: room }))), "found");
});

test("R88 a failed fetch records unreachable, stores no notice and raises nothing: a fetch that throws, a 404, a 500, a redirect (never followed), the governor holding the host (nothing is asked); the next day's run tries again and finds the notice", async () => {
  const w = await world();
  const outcome = async () => (await w.tick()).updatecheck;
  w.prov.answer = () => { throw new Error("connection refused"); };
  assert.equal((await outcome()).outcome, "unreachable");
  w.serve("", 404);
  assert.equal((await outcome()).outcome, "unreachable");
  w.serve("", 500);
  assert.equal((await outcome()).outcome, "unreachable");
  w.prov.answer = () => new Response(null, { status: 302, headers: { location: "https://elsewhere.example/NOTICE.json" } });
  const redirected = await outcome();
  assert.equal(redirected.outcome, "unreachable");
  assert.equal(redirected.detail, word("instance-setup.updates.detail.redirected", { status: 302 }));
  assert.equal(w.prov.fetched.length, 4);
  assert.ok(w.prov.fetched.every((f) => f.url === RELEASE_NOTICE_ADDRESS), "the redirect target was never fetched");
  w.prov.governorHold = "too many asks";
  const held = await outcome();
  assert.equal(held.outcome, "unreachable");
  assert.equal(w.prov.fetched.length, 4, "a held host is not asked");
  w.prov.governorHold = null;
  assert.equal(w.count("release_notices"), 0);
  assert.equal(w.m.updateNotice({ viewer: "admin" }).ready, null, "nothing reached an administrator");
  w.clock.t = T0 + DAY;
  assert.equal((await found(w)).updatecheck.outcome, "found", "the next run finds it");
});

test("R88 the notes are held as plain text exactly as signed and never interpreted: markup, a link and a script in them come back as the same characters", async () => {
  const w = await world();
  const wild = { members: "<script>alert(1)</script> [click](https://evil.example) ![x](https://evil.example/p.png) <img src=x onerror=y>",
                 administrators: "## heading\n\n`code` & <b>bold</b>", must_do: "Run <a href=\"javascript:x\">this</a>." };
  await found(w, notice("0.85.0", { notes: wild }));
  assert.deepEqual(w.m.updateNotice({ viewer: "admin" }).ready.notes, wild);
  assert.equal(w.prov.fetched.length, 1, "no link or image in the notes was fetched");
});

test("R88 at each start, when VERSION differs from the last running version recorded, the release now running is recorded with the instant first seen; a start of the same version records nothing more", async () => {
  const w = await world();
  assert.deepEqual(w.started.running, { recorded: true, version: "0.84.0", first_seen_at: "2026-10-14T20:00:00.000Z" });
  const same = await world({ st: w.st });
  assert.deepEqual(same.started.running, { recorded: false, version: "0.84.0" });
  assert.equal(w.count("running_releases"), 1);
  const next = await world({ st: w.st, version: "0.85.0" });
  assert.equal(next.started.running.recorded, true);
  assert.deepEqual(w.st.db.prepare(`SELECT version FROM running_releases ORDER BY seq`).all().map((r) => r.version), ["0.84.0", "0.85.0"]);
  /* VERSION unset reads 0.0.0, as R17 does */
  const bare = await boot({ env: {} });
  assert.equal(bare.started.running.version, "0.0.0");
});

/* ---- R89: the reads ---- */

test("R89 updateNotice is an administrators' read: a member and a machine (class:admin, class:ai) and no one are refused NOT_AN_ADMIN (membership R84) and read nothing; control: an administrator is answered", async () => {
  const w = await world();
  for (const viewer of ["ruth", "class:admin", "class:ai", "", null, undefined]) {
    const r = w.m.updateNotice({ viewer });
    assert.deepEqual([r.ok, r.reason], [false, "NOT_AN_ADMIN"], String(viewer));
  }
  assert.equal(w.m.updateNotice({ viewer: "admin" }).ok, true);
  assert.equal(w.m.updateNotice().reason, "NOT_AN_ADMIN");
  /* over the route, the viewer is the control plane's stamp and never the body's */
  assert.equal((await call(w.m, "updatenotice?viewer=admin")).result.ok, true);
  assert.equal((await call(w.m, "updatenotice", { viewer: "admin" })).result.reason, "NOT_AN_ADMIN");
});

test("R89 before any notice the answer carries the running release, no last check and nothing ready; after a check it carries the last check, and a ready release with its signed notes, its date, its security mark, when it was found and its latest decision (null before any)", async () => {
  const w = await world();
  const before = w.m.updateNotice({ viewer: "admin" });
  assert.deepEqual(before.running, { version: "0.84.0", installed_at: "2026-10-14T20:00:00.000Z", allowed_by: null });
  assert.deepEqual([before.last_check, before.ready, before.earlier], [null, null, []]);
  w.clock.t = T0 + 3600_000;
  await found(w, notice("0.85.0", { security: true, date: "2026-10-13" }));
  const after = w.m.updateNotice({ viewer: "admin" });
  assert.deepEqual(after.last_check, { at: "2026-10-14T21:00:00.000Z", outcome: "found" });
  assert.deepEqual(after.ready, { version: "0.85.0", date: "2026-10-13", security: true,
    notes: { members: "Searching is faster.", administrators: "You decide when to update.", must_do: "" },
    signed: true, found_at: "2026-10-14T21:00:00.000Z", decision: null });
  assert.deepEqual(after.earlier, []);
  /* a newer release replaces an unanswered older one: one ready release, the older listed earlier, replaced */
  await found(w, notice("0.86.0"));
  const newer = w.m.updateNotice({ viewer: "second" });
  assert.equal(newer.ready.version, "0.86.0");
  assert.deepEqual(newer.earlier.map((e) => [e.version, e.replaced_by]), [["0.85.0", "0.86.0"]]);
});

test("R89 holder names who holds the group's hosting account as membership records it, and viewer_holds says whether the viewer is named in it: the viewer 'second' holds it, 'admin' does not; with none recorded holder is null and viewer_holds false; a membership that cannot answer leaves both unread (null), never a guess", async () => {
  const w = await world();
  const a = w.m.updateNotice({ viewer: "second" });
  assert.deepEqual(a.holder, { holders: "Second, and the bank", note: null, recorded_by: "admin", at: "2026-10-01T00:00:00Z" });
  assert.equal(a.viewer_holds, true);
  assert.equal(w.m.updateNotice({ viewer: "admin" }).viewer_holds, false);
  w.prov.membership.hostingAccess = () => ({ ok: true, recorded: false, current: null, history: [], limit: 1, truncated: false });
  const none = w.m.updateNotice({ viewer: "second" });
  assert.deepEqual([none.holder, none.viewer_holds], [null, false]);
  w.prov.membership.hostingAccess = () => { throw new Error("no answer"); };
  const silent = w.m.updateNotice({ viewer: "second" });
  assert.deepEqual([silent.ok, silent.holder, silent.viewer_holds], [true, null, null]);
});

test("R89 earlier lists each release offered before, newest first, at most 50 with the cut said: a release installed carries installed_at and allowed_by, a release skipped skipped_at, skipped_by and reason; control: fewer than the bound is not truncated", async () => {
  const w = await world({ version: "0.84.0" });
  await found(w, notice("0.85.0"));
  assert.equal(w.m.updateStart({ version: "0.85.0", by: "second" }).ok, true);
  await found(w, notice("0.86.0"));
  assert.equal(w.m.updateSkip({ version: "0.86.0", reason: "Not worth the disruption this month.", by: "admin" }).ok, true);
  /* the group installs 0.85.0 (a restart on that version), and 0.86.0 stays skipped */
  w.clock.t = T0 + DAY;
  const later = await world({ st: w.st, prov: providers({ admins: ["admin", "second"] }), version: "0.85.0" });
  later.clock.t = T0 + DAY;
  const r = later.m.updateNotice({ viewer: "admin" });
  assert.deepEqual([r.running.version, r.running.allowed_by], ["0.85.0", "second"]);
  assert.equal(r.running.installed_at, "2026-10-14T20:00:00.000Z", "first seen at the restart's instant");
  assert.equal(r.ready, null);
  assert.deepEqual(r.earlier.map((e) => e.version), ["0.86.0", "0.85.0"], "newest first");
  assert.deepEqual(r.earlier[0], { version: "0.86.0", date: "2026-10-14", security: false, skipped_at: r.earlier[0].skipped_at,
    skipped_by: "admin", reason: "Not worth the disruption this month." });
  assert.deepEqual(r.earlier[1], { version: "0.85.0", date: "2026-10-14", security: false,
    installed_at: r.running.installed_at, allowed_by: "second" });
  assert.deepEqual([r.earlier_limit, r.earlier_truncated], [UPDATE_EARLIER_MAX, false]);
  /* fifty-two releases held: fifty listed, the cut said */
  const many = await world();
  const ins = many.st.db.prepare(`INSERT INTO release_notices (version, date, manifest, security, notes, sig, found_at) VALUES (?, '2026-01-01', ?, 0, '{"members":"m","administrators":"a","must_do":""}', 's', '2026-01-01T00:00:00Z')`);
  for (let i = 1; i <= 52; i += 1) ins.run(`0.${i}.0`, MANIFEST);
  const m = many.m.updateNotice({ viewer: "admin" });
  assert.equal(m.earlier.length, UPDATE_EARLIER_MAX);
  assert.deepEqual([m.earlier[0].version, m.earlier_truncated], ["0.52.0", true]);
});

test("R89 updateNoticeState is the in-process read for the administrators' to-do: {running, ready, decisions} for the newest release ready, naming no viewer; ready null and no decisions when none; a skipped release is no longer ready", async () => {
  const w = await world();
  assert.deepEqual(w.m.updateNoticeState(), { ok: true, running: { version: "0.84.0", installed_at: "2026-10-14T20:00:00.000Z", allowed_by: null },
    ready: null, decisions: [] });
  await found(w);
  let s = w.m.updateNoticeState();
  assert.deepEqual([s.ready.version, s.ready.security, s.ready.found_at, s.ready.decision, s.decisions], ["0.85.0", false, "2026-10-14T20:00:00.000Z", null, []]);
  assert.equal("viewer" in s, false);
  w.m.updateLater({ version: "0.85.0", by: "admin" });
  s = w.m.updateNoticeState();
  assert.deepEqual(s.decisions.map((d) => [d.version, d.kind, d.by, d.until]), [["0.85.0", "later", "admin", new Date(T0 + 14 * DAY).toISOString()]]);
  assert.deepEqual(s.ready.decision, s.decisions[0], "ready.decision is the latest of the decisions (machinery-producers R11 reads both)");
  w.m.updateSkip({ version: "0.85.0", reason: "We wait for the next one.", by: "second" });
  assert.deepEqual([w.m.updateNoticeState().ready, w.m.updateNoticeState().decisions], [null, []]);
});

test("R89 a store that does not answer is the store's silence (R43): updateNotice and updateNoticeState answer STORE_DID_NOT_ANSWER, never a throw and never ready: null as if nothing were there", async () => {
  const w = await world();
  w.st.db.exec("DROP TABLE release_notices");
  for (const r of [w.m.updateNotice({ viewer: "admin" }), w.m.updateNoticeState()])
    assert.deepEqual([r.ok, r.reason, r.code], [false, "STORE_DID_NOT_ANSWER", "STORE_DID_NOT_ANSWER"]);
});

test("R89 the reads write nothing", async () => {
  const w = await world();
  await found(w);
  const mark = w.st.statements.length;
  for (let i = 0; i < 3; i += 1) { w.m.updateNotice({ viewer: "admin" }); w.m.updateNoticeState(); w.m.updateCheckWake(); }
  assert.deepEqual(w.st.statements.slice(mark).filter((q) => /^\s*(INSERT|UPDATE|DELETE|CREATE|DROP|ALTER)/i.test(q)), []);
});

/* ---- R90: the administrator's choice ---- */

test("R90 updateStart records the choice and answers the installer's update page set to that release and no other, carrying no credential, slug or member; nothing is installed and nothing is fetched by it; updateNotice then shows the decision with who and when", async () => {
  const w = await world();
  await found(w);
  const fetched = w.prov.fetched.length;
  w.clock.t = T0 + 5000;
  const r = w.m.updateStart({ version: "0.85.0", by: "second" });
  assert.deepEqual(r, { ok: true, version: "0.85.0", kind: "start", by: "second", at: "2026-10-14T20:00:05.000Z",
    address: `${INSTALLER_UPDATE_ADDRESS}?version=0.85.0`, note: r.note });
  const sent = JSON.stringify(r.address);
  for (const secret of ["river-town", "a-live-admin-token-0123456789", "second"]) assert.equal(sent.includes(secret), false, secret);
  assert.equal(w.prov.fetched.length, fetched, "nothing was fetched or installed");
  assert.deepEqual(w.m.updateNotice({ viewer: "admin" }).ready.decision, { version: "0.85.0", kind: "start", by: "second",
    by_name: "second", at: "2026-10-14T20:00:05.000Z", until: null, reason: null });
  /* the release stays ready until it is the one running, and a later choice stands in its place */
  assert.equal(w.m.updateNotice({ viewer: "admin" }).ready.version, "0.85.0");
  w.m.updateLater({ version: "0.85.0", by: "admin" });
  assert.equal(w.m.updateNotice({ viewer: "second" }).ready.decision.kind, "later");
  assert.equal(w.count("update_decisions"), 2, "the earlier decision is kept");
});

test("R90 updateStart refusals: a member and a machine NOT_AN_ADMIN first, before the version is looked at; an older, a newer, an unknown, an empty version and no release held UPDATE_NOT_READY; each writes nothing; control: the ready version is accepted", async () => {
  const w = await world();
  assert.equal(w.m.updateStart({ version: "0.85.0", by: "second" }).reason, "UPDATE_NOT_READY", "no release is held");
  await found(w);
  const before = w.count("update_decisions");
  for (const by of ["ruth", "class:admin", "class:ai", "", null])
    assert.equal(w.m.updateStart({ version: "0.85.0", by }).reason, "NOT_AN_ADMIN", String(by));
  assert.equal(w.m.updateStart({ version: "not-a-version", by: "ruth" }).reason, "NOT_AN_ADMIN", "NOT_AN_ADMIN is first");
  for (const version of ["0.84.0", "0.83.9", "0.86.0", "0.85.0 ", "", null, undefined, 85]) {
    const r = w.m.updateStart({ version, by: "admin" });
    if (version === "0.85.0 ") { assert.equal(r.ok, true, "the version is trimmed"); continue; }
    assert.deepEqual([r.ok, r.reason, r.code, r.check], [false, "UPDATE_NOT_READY", "UPDATE_NOT_READY", "C-64.32"], String(version));
    assert.equal(r.translation, word("refusal.UPDATE_NOT_READY"));
  }
  assert.equal(w.count("update_decisions"), before + 1, "only the control wrote");
});

test("R90 updateLater sets the release aside for 14 days; control: a later choice takes it back; a newer release replaces it at once (it is ready with no decision)", async () => {
  const w = await world();
  await found(w);
  const r = w.m.updateLater({ version: "0.85.0", by: "admin" });
  assert.deepEqual([r.ok, r.kind, r.until], [true, "later", new Date(T0 + 14 * DAY).toISOString()]);
  assert.equal(r.zone, undefined, "a release that is not a security release has no zone");
  assert.equal(w.m.updateNoticeState().decisions[0].until, r.until);
  assert.equal(w.m.updateLater({ version: "0.84.0", by: "admin" }).reason, "UPDATE_NOT_READY");
  assert.equal(w.m.updateLater({ version: "0.85.0", by: "ruth" }).reason, "NOT_AN_ADMIN");
  assert.equal(w.m.updateLater({ version: "0.85.0", by: "class:ai" }).reason, "NOT_AN_ADMIN");
  assert.equal(w.count("update_decisions"), 1, "the refusals wrote nothing");
  /* a newer release replaces it at once */
  await found(w, notice("0.86.0"));
  const s = w.m.updateNoticeState();
  assert.deepEqual([s.ready.version, s.decisions], ["0.86.0", []]);
  assert.equal(w.m.updateNotice({ viewer: "admin" }).ready.decision, null);
});

test("R90 updateLater on a security release sets it aside until the start of the next local day in the profile's zone: 20:00 UTC is 13:00 on the 14th in Los Angeles, so until 2026-10-15T07:00:00Z; with no profile's zone, until the next UTC midnight; control: the same release not marked security waits 14 days", async () => {
  const la = await world({ zone: true });
  await found(la, notice("0.85.0", { security: true }));
  const r = la.m.updateLater({ version: "0.85.0", by: "admin" });
  assert.deepEqual([r.until, r.zone], ["2026-10-15T07:00:00Z", "America/Los_Angeles"]);
  const utc = await world();
  await found(utc, notice("0.85.0", { security: true }));
  const u = utc.m.updateLater({ version: "0.85.0", by: "admin" });
  assert.deepEqual([u.until, u.zone], ["2026-10-15T00:00:00Z", "UTC"]);
  const plain = await world({ zone: true });
  await found(plain, notice("0.85.0", { security: false }));
  assert.equal(plain.m.updateLater({ version: "0.85.0", by: "admin" }).until, new Date(T0 + 14 * DAY).toISOString());
  /* the day is the profile's: just after its midnight the next start is a full day on */
  la.clock.t = Date.parse("2026-10-15T07:30:00Z");
  assert.equal(la.m.updateLater({ version: "0.85.0", by: "admin" }).until, "2026-10-16T07:00:00Z");
});

test("R90 updateSkip records the administrator's reason with who and when and the release is never ready again; the next release is offered as usual; control: updateskip without a reason (none, blank, over 1,000 characters, two lines) is refused UPDATE_SKIP_NO_REASON, nothing written", async () => {
  const w = await world();
  await found(w);
  const before = w.count("update_decisions");
  for (const reason of [undefined, null, "", "   ", "x".repeat(1001), "line one\nline two", 7]) {
    const r = w.m.updateSkip({ version: "0.85.0", reason, by: "admin" });
    assert.deepEqual([r.ok, r.reason, r.code, r.check], [false, "UPDATE_SKIP_NO_REASON", "UPDATE_SKIP_NO_REASON", "C-64.33"], JSON.stringify(reason));
    assert.equal(r.translation, word("refusal.UPDATE_SKIP_NO_REASON"));
  }
  assert.equal(w.count("update_decisions"), before);
  assert.equal(w.m.updateSkip({ version: "0.85.0", reason: "We freeze changes until the filing.", by: "ruth" }).reason, "NOT_AN_ADMIN");
  assert.equal(w.m.updateSkip({ version: "0.84.0", reason: "x", by: "admin" }).reason, "UPDATE_NOT_READY");
  assert.equal(w.count("update_decisions"), before);
  w.clock.t = T0 + 9000;
  const ok = w.m.updateSkip({ version: "0.85.0", reason: "  We freeze changes until the filing.  ", by: "admin" });
  assert.deepEqual(ok, { ok: true, version: "0.85.0", kind: "skip", by: "admin", at: "2026-10-14T20:00:09.000Z", reason: "We freeze changes until the filing." });
  assert.equal(w.m.updateNotice({ viewer: "second" }).ready, null, "never ready again");
  assert.equal(w.m.updateNoticeState().ready, null);
  assert.equal(w.m.updateStart({ version: "0.85.0", by: "admin" }).reason, "UPDATE_NOT_READY");
  /* a skipped release stays skipped when the feed is read again, and the next release is offered */
  assert.equal((await found(w)).updatecheck.outcome, "none");
  assert.equal(w.m.updateNotice({ viewer: "admin" }).ready, null);
  await found(w, notice("0.86.0"));
  assert.equal(w.m.updateNotice({ viewer: "admin" }).ready.version, "0.86.0");
  assert.equal(w.m.updateNotice({ viewer: "admin" }).earlier.find((e) => e.version === "0.85.0").reason, "We freeze changes until the filing.");
});

test("R90 R29 over the routes: updatenotice, updatestart, updatelater and updateskip read the control plane's stamps (viewer, by) from the query and never from the body", async () => {
  const w = await world();
  await found(w);
  assert.equal((await call(w.m, "updatestart?by=ruth", { version: "0.85.0", by: "admin" })).result.reason, "NOT_AN_ADMIN", "the body names no actor");
  assert.equal((await call(w.m, "updatelater", { version: "0.85.0", by: "admin" })).result.reason, "NOT_AN_ADMIN");
  assert.equal((await call(w.m, "updateskip", { version: "0.85.0", reason: "r", by: "admin" })).result.reason, "NOT_AN_ADMIN");
  assert.equal(w.count("update_decisions"), 0);
  assert.equal((await call(w.m, "updateskip?by=admin", { version: "0.85.0", reason: "r" })).result.ok, true);
  assert.equal((await call(w.m, "updatenotice?viewer=admin")).result.ready, null);
});

test("R90 C-64.32–C-64.33: the two update rows carry their words by key, each in this module's regions, and no row of this module names a copy, instance, plane or server; C-64.31 (LANGUAGE_NOT_SET) is `translations`' and held here by none", () => {
  const rows = ["UPDATE_NOT_READY", "UPDATE_SKIP_NO_REASON"].map((k) => INSTANCE_SETUP_CHECKS[k]);
  assert.deepEqual(rows.map((r) => r.check), ["C-64.32", "C-64.33"]);
  assert.equal("LANGUAGE_NOT_SET" in INSTANCE_SETUP_CHECKS, false);
  for (const r of rows) assert.doesNotMatch(r.translation, /\b(?:copy|copies|instance|plane|server)\b/i);
});

/* ---- R91: the tables ---- */

test("R91 the notices, checks, running releases, decisions and the check's slot are this module's own tables, declared to record-core exempt from purge, append-only (no statement updates or deletes a row), and a purge leaves them", async () => {
  const w = await world();
  const TABLES = ["update_check_slot", "release_notices", "update_checks", "running_releases", "update_decisions"];
  for (const t of TABLES) {
    assert.ok(INSTANCE_SETUP_TABLES.includes(t), t);
    const d = INSTANCE_SETUP_TABLE_DECLARATIONS.find((x) => x.name === t);
    assert.equal(d.purge, "exempt", t);
    assert.notEqual(d.export, "yes", t);
  }
  const declared = w.record.declaredTables().filter((d) => d.module === "instance-setup").map((d) => d.name);
  for (const t of TABLES) assert.ok(declared.includes(t), t);
  const mark = w.st.statements.length;
  await found(w);
  w.m.updateLater({ version: "0.85.0", by: "admin" });
  w.m.updateStart({ version: "0.85.0", by: "second" });
  await found(w, notice("0.86.0"));
  w.m.updateSkip({ version: "0.86.0", reason: "A reason.", by: "admin" });
  w.clock.t += DAY;
  await found(w, notice("0.86.0"));
  await world({ st: w.st, version: "0.85.0" });
  const touched = w.st.statements.slice(mark).filter((q) => /\b(UPDATE|DELETE)\b/i.test(q) && /update_|release_notices|running_releases/.test(q));
  assert.deepEqual(touched, []);
  const counts = () => TABLES.map((t) => w.count(t));
  assert.ok(counts().every((n) => n >= 1), `every table held a row: ${counts()}`);
  const n = counts();
  w.record.purge({});
  assert.deepEqual(counts(), n, "a purge leaves them");
});

test("R91 nothing here sends anything about the group and this module holds no credential that could deploy code: across every check and act, the only request is a GET of the notice's fixed address, and no secret of the environment is in any request", async () => {
  const w = await world({ env: { CLOUDFLARE_API_TOKEN: "cf-secret-0123456789", GITHUB_TOKEN: "gh-secret-0123456789", DEPLOY_KEY: "deploy-secret" } });
  await found(w);
  w.m.updateStart({ version: "0.85.0", by: "admin" });
  w.m.updateLater({ version: "0.85.0", by: "admin" });
  w.serve("", 500);
  await w.tick();
  assert.ok(w.prov.fetched.length >= 2);
  for (const f of w.prov.fetched) {
    assert.equal(f.url, RELEASE_NOTICE_ADDRESS);
    assert.equal(f.init.method, "GET");
    assert.equal(f.init.body, undefined);
    const text = JSON.stringify(f);
    for (const secret of ["cf-secret", "gh-secret", "deploy-secret", "a-live-admin-token", "river-town"]) assert.equal(text.includes(secret), false, secret);
  }
  assert.equal(w.prov.arms.length, 0);
});

/* ---- R47 (K3240): the words a member reads on forgot ---- */

test("R47 (T48; K3240) the member-facing forgot words say, in members' words, who can help (the group's administrators), and carry no developer language: no ADMIN_TOKEN, no worker's settings, nothing about replacing a value; control: the founder-only block is not among them", () => {
  const said = [FORGOT_HELP.heading, ...FORGOT_HELP.sentences].join(" ");
  assert.match(said, /administrators can help/);
  assert.doesNotMatch(said, /ADMIN_TOKEN|worker|setting|replace|Cloudflare|token|\bcopy\b|\binstance\b|\bplane\b|\bserver\b/i);
  assert.doesNotMatch(said, /Before you choose a password|who controls your group/);
  assert.ok(Object.isFrozen(FORGOT_HELP) && Object.isFrozen(FORGOT_HELP.sentences));
  /* control: the founder's block does carry who controls the group's Civicsmith */
  assert.match(HOSTING_CONTROL.heading, /^Before you choose a password: who controls your team's Civicsmith$/);
});

test("R47 (T48; K3240) the founder's block no longer carries the deployer's instruction: its last sentence says it in a founder's words, and the deployer's steps are kept apart for the installer's and DEPLOY.md's text, joined to the block only when asked (deployer: true); the block's other words and its guide are unchanged", () => {
  const all = [HOSTING_CONTROL.heading, ...HOSTING_CONTROL.sentences, HOSTING_CONTROL.guide.sentence].join(" ");
  assert.doesNotMatch(all, /ADMIN_TOKEN|worker's settings/);
  assert.match(HOSTING_CONTROL.sentences.at(-1), /^The same account is the way back in if the password you choose is lost: whoever holds it can open the way for your team's Civicsmith to be claimed again\.$/);
  assert.match(HOSTING_RECOVERY_DEPLOYER, /ADMIN_TOKEN/);
  assert.doesNotMatch(HOSTING_RECOVERY_DEPLOYER, /\b(?:copy|copies|instance|plane|server)\b/i);
  assert.equal(hostingControlBlock("notice").includes("ADMIN_TOKEN"), false);
  assert.equal(hostingControlBlock("notice", { deployer: true }).split("ADMIN_TOKEN").length - 1, 1, "once, after the sentences and before the guide");
  const withDeployer = hostingControlBlock("notice", { deployer: true });
  assert.ok(withDeployer.indexOf("ADMIN_TOKEN") < withDeployer.indexOf(word("setup-fleet.name.replace_time_password")));
  assert.equal(hostingControlBlock("notice", { deployer: false }), hostingControlBlock("notice"));
  assert.equal(HOSTING_CONTROL.sentences.length, 5);
});

/* ---- N996: the keep-away reads are ai-accounts' alone ---- */

test("R53 R55 (T48; N996) assistantState and assistantGate ask ai-accounts and never credentials: a credentials that throws on any call changes nothing; the disclosure read stays this module's to answer", async () => {
  const p = providers({ admins: ["admin"] });
  p.credentials = new Proxy({}, { get() { throw new Error("credentials was asked for the keep-away"); } });
  const w = await boot({ prov: p });
  assert.deepEqual(w.m.assistantState(), { ok: true, on: true, set_by: null, set_at: null, reason: null });
  assert.equal(w.m.assistantGate(), null);
  p.keepAway = { on: true, reason: "Kept here.", set_by: "admin", set_at: "2026-10-14T09:00:00Z" };
  assert.deepEqual(w.m.assistantState(), { ok: true, on: false, set_by: "admin", set_at: "2026-10-14T09:00:00Z", reason: "Kept here." });
  assert.equal(w.m.assistantGate().reason, "AI_KEPT_AWAY");
  /* control: an ai-accounts that does not answer is read as kept away, never open */
  const bare = await boot({ prov: { ...providers(), aiAccounts: {} } });
  assert.equal(bare.m.assistantState().on, false);
  assert.equal(bare.m.assistantGate().reason, "STORE_DID_NOT_ANSWER");
});

/* ---- R92 (T50; N1113): the update check is given its clock ---- */

test("R92 the update-check consumer's tick hands the alarm's now to the check: the recorded instant (update_checks.at) and the answered `at` are that now, not the clock's; control: a check run outside an alarm (no now handed) reads the clock as before", async () => {
  const w = await world();
  w.serve(feed(notice("0.85.0")));
  const alarm = T0 + 3 * DAY + 12_345;
  assert.notEqual(alarm, w.clock.t);
  const r = await w.consumer().tick(alarm);
  assert.equal(r.updatecheck.at, new Date(alarm).toISOString());
  assert.equal(w.lastCheck().at, new Date(alarm).toISOString());
  /* control: no now handed, the clock is read */
  w.clock.t = T0 + 5 * DAY;
  const r2 = await w.m.updateCheckTick();
  assert.equal(r2.updatecheck.at, new Date(T0 + 5 * DAY).toISOString());
  assert.equal(w.lastCheck().at, new Date(T0 + 5 * DAY).toISOString());
});

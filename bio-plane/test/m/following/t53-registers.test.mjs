/* following T53 (R37–R40, R43, R44, R46; N1259; K4403 (7), K4405): a register watched by a number a member names, the change
   in what that number's answer says, a project's stated interest watched automatically through the real `registers` (its R1,
   R32–R34, R44), what `follows` shows of each, the changes read the queue takes, and the sight and end of a watch. The test
   profile's registers and query templates, with templates added as test data for the filer, licence and docket schemes. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { world, testView, MEMBER, BOB, OUTSIDER, MACHINE, T0, DAY } from "./fixture.mjs";
import { FOLLOW_KINDS, followingOps } from "../../../src/following/index.mjs";

const FILER = (v) => `https://data.marlow-county.example/filer/${v}`;
const LICENCE = (v) => `https://board.trades.example/licence/${v}`;
const DOCKET = (v) => `https://board.marlow-county.example/proceeding/${v}/documents`;
/* the test profile's view, with query templates for three schemes and an unmeasured register, as test data */
function regView({ volatile = true } = {}) {
  const v = testView();
  v.query_templates = [
    { scheme: "filer", register: "town_filings", template: FILER("{value}"), basis: "TEST" },
    { scheme: "licence", register: "trades_licences", template: LICENCE("{value}"), basis: "TEST" },
    { scheme: "docket", register: "county_raw", template: DOCKET("{value}"), basis: "TEST" },
    ...v.query_templates.filter((t) => t.scheme === "company"),
    { scheme: "filer", register: "unmeasured", template: FILER("u/{value}"), basis: "TEST" }];
  v.registers = [...v.registers, { ...structuredClone(v.registers.find((r) => r.key === "town_filings")), key: "unmeasured", status: "not_measured" }];
  if (!volatile) for (const s of v.systems) delete s.volatile;
  return v;
}
const PRJ = "PRJ-2026-0001-a", HOME = "INFO-2026-0002-a";
function setup(opts = {}) {
  const w = world({ view: regView(opts), ...opts });
  w.project(PRJ);
  w.bundle(HOME, { project: PRJ });
  return w;
}
const q = (w, x = {}) => w.f.followRegisterQuery({ register: "town_filings", scheme: "filer", value: "F12345", home: HOME, author: MEMBER, viewer: MEMBER, ...x });
const follows = (w) => w.rows(`SELECT count(*) AS n FROM follows`)[0].n;

test("R37 followRegisterQuery follows one number at the address the profile's template composes; each refusal by name writes nothing and sends no request; a gated register fetches nothing; the tick reads that one address (control: followPersonQuery still follows)", async () => {
  const w = setup();
  assert.ok(FOLLOW_KINDS.includes("register-query"));
  const refused = [
    [q(w, { value: "Jane Doe" }), "QUERY_NOT_NAMED"],                        /* a name */
    [q(w, { value: "F123" }), "QUERY_NOT_NAMED"],                            /* a partial number */
    [q(w, { register: ["town_filings", "county_raw"] }), "QUERY_NOT_NAMED"], /* two registers */
    [q(w, { scheme: "licence" }), "QUERY_NOT_NAMED"],                        /* a scheme the profile does not list for it */
    [q(w, { value: "F1234*" }), "QUERY_NOT_NAMED"],                          /* a wildcard */
    [q(w, { value: ["F12345", "F12346"] }), "QUERY_NOT_NAMED"],              /* a list */
    [q(w, { name: "Jane Doe" }), "QUERY_NOT_NAMED"],                         /* by name */
    [q(w, { author: MACHINE }), "MACHINE_CANNOT_FOLLOW"],
    [q(w, { home: null }), "NO_SUCH_HOME"],
    [q(w, { register: "no_such" }), "NO_SUCH_REGISTER"],
    [q(w, { register: "company_officers", scheme: "company", value: "C1234567" }), "REGISTER_NOT_IN_ALPHA"],
    [q(w, { register: "unmeasured" }), "REGISTER_NOT_MEASURED"],
    [q(w, { entity: "ENT-2026-0999" }), "NO_SUCH_ENTITY"],
    [q(w, { cadence: "hourly" }), "BAD_FOLLOW_CADENCE"],
    [q(w, { ends: "2026-10-01" }), "WATCH_END_REFUSED"],
  ];
  for (const [r, code] of refused) assert.equal(r.reason, code, JSON.stringify(r));
  assert.equal(follows(w), 0, "nothing written");
  assert.equal(w.fetches.length, 0, "no request");
  /* a filer number of the scheme follows; the network sees exactly the composed address, and no link in the page */
  const f = q(w);
  assert.equal(f.ok, true, JSON.stringify(f));
  assert.equal(f.kind, "register-query");
  w.serve(FILER("F12345"), `<table><tr><td>F12345</td><td><a href="https://data.marlow-county.example/person/9">more</a></td></tr></table>`);
  const t = await w.f.followTick(T0);
  assert.deepEqual(w.fetches.map((o) => o.captureRequest.locator), [FILER("F12345")]);
  assert.equal(t.read.find((r) => r.follow === f.follow).outcome, "captured");
  /* a fee-bearing register is followed under R8: the tick records member_act_required and fetches nothing */
  const g = q(w, { register: "trades_licences", scheme: "licence", value: "L123456" });
  assert.equal(g.ok, true, JSON.stringify(g));
  w.serve(LICENCE("L123456"), "licence page");
  const t2 = await w.f.followTick(T0 + 1000);
  assert.deepEqual(t2.member_act_required.map((m) => [m.follow, m.gate]), [[g.follow, "fee"]]);
  assert.equal(w.fetches.length, 1, "nothing gated fetched");
  /* control: followPersonQuery with a listed identifier still follows, its own refusal kept */
  const p = w.f.followPersonQuery({ register: "ellery.licences", scheme: "ellery_licence", value: "L-00042", address: "https://licences.ellery.example/search?licence=L-00042",
    home: HOME, author: MEMBER, viewer: MEMBER });
  assert.equal(p.ok, true, JSON.stringify(p));
  assert.equal(w.f.followPersonQuery({ register: "ellery.licences", scheme: "ellery_licence", value: "Jane", address: "https://licences.ellery.example/search?licence=Jane",
    home: HOME, author: MEMBER, viewer: MEMBER }).reason, "PERSON_QUERY_NOT_NAMED");
});

/* the CPUC documents page court-doctypes reads (its captured fixture); its rows, and the page with its last row taken out */
const DOCS = readFileSync(new URL("../../../../court-doctypes/test/fixtures/cpuc-A2106021-documents-p1.html", import.meta.url), "utf8");
const ROWS = DOCS.match(/<tr >[\s\S]*?<\/tr>/g);
const LESS = DOCS.replace(ROWS[ROWS.length - 1], "");
/* a third page: two rows taken out (an answer that returns to bytes already held is landed by no second bundle) */
const FEWER = LESS.replace(ROWS[ROWS.length - 2], "");

test("R38 a docket whose second read adds one entry is one change with count 1, read by its content type's assess; an identical read is none; the change holds no sentence of meaning (control: a failed read is failed, not a change)", async () => {
  const w = setup();
  const f = q(w, { register: "county_raw", scheme: "docket", value: "D123456" }).follow;
  w.serve(DOCKET("D123456"), LESS);
  await w.f.followTick(T0);
  assert.equal(w.rows(`SELECT count(*) AS n FROM register_query_changes`)[0].n, 0, "a first read is no change");
  w.serve(DOCKET("D123456"), DOCS);
  const t = await w.f.followTick(T0 + DAY);
  const c = t.read.find((r) => r.follow === f).change;
  assert.equal(c.recorded, true, JSON.stringify(c));
  assert.deepEqual(c.counts, { added: 1, changed: 0, removed: 0, possibly_removed: 0 });
  assert.equal(c.basis, "assess");
  /* an identical read lands nothing new and records no change */
  await w.f.followTick(T0 + 2 * DAY);
  const rows = w.rows(`SELECT * FROM register_query_changes`);
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["after_sha", "at", "basis", "before_sha", "change_id", "counts", "follow_id", "home"]);
  /* control: a read that fails is a failed entry, never a change */
  w.served.delete(DOCKET("D123456"));
  const t3 = await w.f.followTick(T0 + 3 * DAY);
  assert.equal(t3.failed.length, 1);
  assert.equal(w.rows(`SELECT count(*) AS n FROM register_query_changes`)[0].n, 1);
});

test("R38 a volatile counter the profile names for the system makes no change; with no volatile named the system is volatility_unknown and any difference is a change", async () => {
  const page = (clock, row = "F12345") => `<table><tr><td>${row}</td></tr></table><p>generated at ${clock}</p>`;
  for (const [volatile, expect] of [[true, 0], [false, 1]]) {
    const w = setup({ volatile });
    const f = q(w).follow;
    w.serve(FILER("F12345"), page("10:01"));
    await w.f.followTick(T0);
    w.serve(FILER("F12345"), page("10:05"));
    const t = await w.f.followTick(T0 + DAY);
    assert.equal(w.rows(`SELECT count(*) AS n FROM register_query_changes`)[0].n, expect, `volatile ${volatile}`);
    assert.equal(t.read.find((r) => r.follow === f).change.basis, volatile ? "normalised" : "volatility_unknown");
    if (volatile) {
      /* a real difference beside the counter is still a change, counts null (no assess read it) */
      w.serve(FILER("F12345"), page("10:09", "F12345 amended"));
      await w.f.followTick(T0 + 2 * DAY);
      const r = w.rows(`SELECT counts, basis FROM register_query_changes`);
      assert.deepEqual(r.map((x) => [x.counts, x.basis]), [[null, "normalised"]]);
    }
  }
});

/* a stated interest on the town's filings, by a filer number (auto-watchable), stated by alice for her project */
const interest = (w, filter = { filer_ids: ["F10001"] }, x = {}) => w.registers.interestSet({ register: "town_filings", project: PRJ, filter, author: MEMBER, viewer: MEMBER, ...x });
const interestFollows = (w) => w.rows(`SELECT * FROM follows WHERE kind='register-interest'`);

test("R39 an interest stated with a number filter creates one register-interest follow; its tick asks registers' refreshImport and nothing else, once per cadence; a name interest creates none; forgetting the interest ends the follow (control: a gated register's tick is member_act_required)", async () => {
  const w = setup();
  assert.equal(w.f.interestsRegistered.ok, true, JSON.stringify(w.f.interestsRegistered));
  const i = interest(w);
  assert.equal(i.ok, true, JSON.stringify(i));
  const made = interestFollows(w);
  assert.equal(made.length, 1);
  assert.deepEqual(JSON.parse(made[0].subject), { kind: "register-interest", interest: i.interest.id, project: PRJ, register: "town_filings" });
  assert.equal(made[0].cadence, "daily", "the column keeps a word of FOLLOW_CADENCES");
  /* stating it again (a new version, still watched) makes no second follow */
  interest(w, { filer_ids: ["F10001", "F10002"] });
  assert.equal(interestFollows(w).length, 1);
  /* the tick asks registers to refresh; this module fetches nothing itself */
  const asked = [];
  const real = w.registers.refreshImport.bind(w.registers);
  w.registers.refreshImport = async (a) => { asked.push(a.interest); return real(a); };
  const t = await w.f.followTick(T0);
  assert.deepEqual(asked, [i.interest.id]);
  assert.equal(w.fetches.length, 0, "following fetched nothing");
  const r = t.read.find((x) => x.kind === "register-interest");
  assert.ok(["refreshed", "unchanged"].includes(r.outcome), JSON.stringify(r));
  /* not again within its cadence (the register's stated 24 hours, never more often than daily) */
  await w.f.followTick(T0 + 3600000);
  assert.equal(asked.length, 1);
  await w.f.followTick(T0 + DAY + 1000);
  assert.equal(asked.length, 2);
  /* a name interest is saved but not watched: no follow */
  const p2 = w.project("PRJ-2026-0002-a");
  w.registers.interestSet({ register: "town_filings", project: p2, filter: { names: ["Donor Eleven"] }, author: MEMBER, viewer: MEMBER });
  assert.equal(interestFollows(w).length, 1);
  /* a machine states no interest, so no follow is made by one */
  assert.equal(w.registers.interestSet({ register: "town_filings", project: p2, filter: { filer_ids: ["F10003"] }, author: MACHINE, viewer: MACHINE }).ok, false);
  assert.equal(interestFollows(w).length, 1);
  /* forgetting the interest ends the follow */
  w.registers.interestForget({ interest: i.interest.id, author: MEMBER, viewer: MEMBER });
  const ended = interestFollows(w)[0];
  assert.ok(ended.ended_at);
  assert.equal(ended.ended_reason, "interest_forgotten");
  assert.equal(w.f.followDue(T0 + 9 * DAY), false);
  /* control: on a gated register the tick records member_act_required and registers fetched nothing */
  const w2 = setup();
  w2.view.registers.find((x) => x.key === "town_filings").gate = "fee";
  interest(w2);
  const t2 = await w2.f.followTick(T0);
  assert.equal(t2.member_act_required.length, 1);
  assert.equal(t2.member_act_required[0].kind, "register-interest");
});

test("R39 a register stating a longer refresh cadence is read no faster than it (county_raw's 168 hours)", async () => {
  const w = setup();
  w.registers.interestSet({ register: "county_raw", project: PRJ, filter: { filer_ids: ["F10001"] }, author: MEMBER, viewer: MEMBER });
  const f = interestFollows(w);
  assert.equal(f.length, 1);
  await w.f.followTick(T0);
  assert.equal(w.f.followDue(T0 + 2 * DAY), false);
  assert.equal(w.f.followWake(T0 + 1000), T0 + 7 * DAY);
});

test("R40 follows shows a number's watch with register, scheme, value and watched by_number, and an interest's with its project, register, criteria and watched auto; changes_since_looked rises by one per change and returns to 0 after the member's look; a hidden project's follow is absent for a non-participant (control: no change shows 0)", async () => {
  const w = setup();
  const f = q(w, { register: "county_raw", scheme: "docket", value: "D123456" }).follow;
  const g = q(w).follow;
  const i = interest(w);
  const item = (id) => w.f.follows({ viewer: MEMBER }).items.find((x) => x.follow === id);
  assert.deepEqual([item(f).register, item(f).scheme, item(f).value, item(f).watched, item(f).changes_since_looked], ["county_raw", "docket", "D123456", "by_number", 0]);
  const auto = w.f.follows({ viewer: MEMBER }).items.find((x) => x.kind === "register-interest");
  assert.deepEqual([auto.project, auto.register, auto.interest, auto.watched], [PRJ, "town_filings", i.interest.id, "auto"]);
  assert.deepEqual(auto.criteria.filer_ids, ["F10001"]);
  assert.ok("ends" in auto && "next_due" in auto && "last_read" in auto);
  /* two changes, then a look */
  w.serve(DOCKET("D123456"), LESS);
  await w.f.followTick(T0);
  w.serve(DOCKET("D123456"), DOCS);
  await w.f.followTick(T0 + DAY);
  assert.equal(item(f).changes_since_looked, 1);
  w.serve(DOCKET("D123456"), FEWER);
  await w.f.followTick(T0 + 2 * DAY);
  assert.equal(item(f).changes_since_looked, 2);
  assert.equal(item(g).changes_since_looked, 0, "control: a follow with no change shows 0");
  w.t = T0 + 2 * DAY + 1000;
  const look = w.f.followChanges({ follow: f, viewer: MEMBER });
  assert.equal(look.changes.length, 2);
  assert.equal(item(f).changes_since_looked, 0, "the look resets it");
  assert.equal(w.f.followChanges({ follow: f, viewer: OUTSIDER }).reason, "NO_SUCH_FOLLOW");
  /* a gated register's watch says why it is not read */
  const gated = q(w, { register: "trades_licences", scheme: "licence", value: "L123456" }).follow;
  assert.equal(item(gated).not_read, "member_act_required");
  /* a hidden project's follow is absent for a non-participant */
  assert.equal(w.f.follows({ viewer: OUTSIDER }).items.some((x) => REGW.includes(x.kind)), false);
});
const REGW = ["register-query", "register-interest"];

test("R43 registerChanges: one entry per change, a docket change with its counts; ordered with a cursor; no cell, name or value; a watch ended before the change gives none; a hidden project's entry is absent for others (control: two changes give two entries)", async () => {
  const w = setup();
  const f = q(w, { register: "county_raw", scheme: "docket", value: "D123456" }).follow;
  const g = q(w, { value: "F54321" }).follow;
  w.serve(DOCKET("D123456"), LESS);
  w.serve(FILER("F54321"), "<p>one</p>");
  await w.f.followTick(T0);
  w.serve(DOCKET("D123456"), DOCS);
  await w.f.followTick(T0 + DAY);
  const one = w.f.registerChanges({ viewer: MEMBER });
  assert.equal(one.ok, true);
  assert.equal(one.changes.length, 1);
  assert.deepEqual(one.changes[0], { watch: f, kind: "register-query", register: "county_raw", at: one.changes[0].at,
                                      counts: { added: 1, changed: 0, removed: 0, possibly_removed: 0 }, total: 1 });
  assert.doesNotMatch(JSON.stringify(one), /D123456|F54321|<p>/, "no cell, name or value");
  /* control: a second change gives a second entry, and the cursor pages */
  w.serve(DOCKET("D123456"), FEWER);
  await w.f.followTick(T0 + 2 * DAY);
  const two = w.f.registerChanges({ viewer: MEMBER });
  assert.equal(two.changes.length, 2);
  const first = w.f.registerChanges({ viewer: MEMBER, limit: 1 });
  assert.equal(first.changes.length, 1);
  assert.ok(first.cursor);
  assert.equal(w.f.registerChanges({ viewer: MEMBER, after: first.cursor }).changes.length, 1);
  assert.equal(w.f.registerChanges({ viewer: MEMBER, since: "not a time" }).since_invalid, true);
  assert.equal(w.f.registerChanges({ viewer: MEMBER, since: T0 + 2 * DAY }).changes.length, 1);
  /* absent for a member outside the project */
  assert.equal(w.f.registerChanges({ viewer: OUTSIDER }).changes.length, 0);
  /* a watch ended gives none */
  w.f.registerWatchStop({ follow: f, author: MEMBER, viewer: MEMBER });
  assert.equal(w.f.registerChanges({ viewer: MEMBER }).changes.length, 0);
  assert.equal(g > 0, true);
});

test("R44 a machine never creates a watch and no tick searches for a person: the ops map holds no op fetching by name; no tick path of the module calls searchRows; a machine's follow is refused (control: a member's lands)", async () => {
  const w = setup();
  assert.equal(q(w, { author: MACHINE }).reason, "MACHINE_CANNOT_FOLLOW");
  assert.equal(q(w, { author: "class:ai" }).reason, "MACHINE_CANNOT_FOLLOW");
  assert.equal(q(w).ok, true, "control");
  const ops = Object.keys(followingOps(w.f, new URL("http://x/"), {}));
  assert.equal(ops.some((o) => /search|byname|name/i.test(o)), false, ops.join(","));
  const dir = new URL("../../../src/following/", import.meta.url);
  for (const file of readdirSync(dir)) {
    const src = readFileSync(new URL(file, dir), "utf8");
    assert.doesNotMatch(src, /searchRows\s*\(/, file);
  }
  /* the number's address is the template's, on the register's own host */
  const f = w.rows(`SELECT subject FROM follows WHERE kind='register-query'`).map((r) => JSON.parse(r.subject).address);
  assert.deepEqual(f, [FILER("F12345")]);
});

test("R46 after registerwatchstop no later read lands a change and earlier changes are kept; a former participant of the project sees none (control: before the stop the change is raised)", async () => {
  const w = setup();
  w.st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?, 'bob', 'joined', 0, '2026-01-02', '2026-01-02')`, PRJ);
  w.membership.reindexProjectSight?.(PRJ);
  const f = q(w, { register: "county_raw", scheme: "docket", value: "D123456" }).follow;
  w.serve(DOCKET("D123456"), LESS);
  await w.f.followTick(T0);
  w.serve(DOCKET("D123456"), DOCS);
  await w.f.followTick(T0 + DAY);
  assert.equal(w.f.registerChanges({ viewer: MEMBER }).changes.length, 1, "control: raised before the stop");
  const bobSaw = w.f.registerChanges({ viewer: BOB }).changes.length;
  assert.equal(w.f.registerWatchStop({ follow: f, author: BOB, viewer: BOB }).reason, "NOT_THE_AUTHOR");
  assert.equal(w.f.registerWatchStop({ follow: f, author: MACHINE }).reason, "MACHINE_CANNOT_FOLLOW");
  const stop = w.f.registerWatchStop({ follow: f, author: MEMBER, viewer: MEMBER });
  assert.equal(stop.ok, true);
  assert.equal(w.f.registerWatchStop({ follow: f, author: MEMBER, viewer: MEMBER }).existed, true);
  w.serve(DOCKET("D123456"), LESS);
  const before = w.fetches.length;
  await w.f.followTick(T0 + 2 * DAY);
  assert.equal(w.fetches.length, before, "an ended watch is not read");
  assert.equal(w.rows(`SELECT count(*) AS n FROM register_query_changes`)[0].n, 1, "the earlier change is kept");
  assert.equal(w.f.registerChanges({ viewer: MEMBER }).changes.length, 0, "none raised after the end");
  /* bob, who saw it while a participant, sees none after he leaves */
  assert.equal(bobSaw, 1);
  w.st.sql.exec(`DELETE FROM project_participants WHERE project_id=? AND member_id='bob'`, PRJ);
  w.membership.reindexProjectSight?.(PRJ);
  assert.equal(w.f.registerChanges({ viewer: BOB }).changes.length, 0);
});

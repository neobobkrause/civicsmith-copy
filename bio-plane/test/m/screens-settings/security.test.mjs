/* Settings › Security at the module's interface (R15). Over the world (store-request): the scanner is the real file-scanner handler behind
   its platform binding, the tools are added and tested by the real acts against the vendors' stub APIs (the outside world), the level is
   the real count of refused sign-ins, and every expectation is read back from the owners' answers. */
import test from "node:test";
import assert from "node:assert/strict";
import { acts, all, ancestor, day, has, lacks, open, panelOf, said, textOf, SCREENS } from "./kit.mjs";
import { env } from "./fixtures.mjs";
import { scannerTeam, burstTeam, handleOf } from "./seed-security.mjs";

const ops = (o) => [...new Set(acts(o.tree).map((b) => b.attrs["data-act"]))].sort();
const HOUR = 3600000;
const iso = (t) => new Date(t).toISOString();
/* the credentials the vendors' stub APIs accept, each value naming its field (file-scanner's test vendors) */
const KEY = { region: "de", client_id: "SENTINEL-intelix-client_id", client_secret: "SENTINEL-intelix-client_secret" };
const SOPHOS = { "sa-sophos-intelix-c-region": KEY.region, "sa-sophos-intelix-k-client_id": KEY.client_id, "sa-sophos-intelix-k-client_secret": KEY.client_secret, "sa-sophos-intelix-keep": true };
const catalogueOf = async (as) => (await as.read("securitytoolcatalogue")).offered;
/** The tool added by the real act, as the page sends it, and tested by the real act. */
async function addSophos(as) {
  const entry = (await catalogueOf(as)).find((e) => e.provider_id === "sophos-intelix");
  const added = await as.act("securitytooladd", { body: { providerId: entry.provider_id, config: { region: KEY.region }, credentials: { client_id: KEY.client_id, client_secret: KEY.client_secret },
    handlingDigest: entry.handling_digest, confirmRetention: true, use: "on_request" } });
  await as.act("securitytooltest", { body: { toolId: added.tool_id } });
  return { entry, toolId: added.tool_id };
}

test("R15 security: an administrator's screen; any other member is told only that it is administrators', and nothing is read", async () => {
  const { w, founder } = await scannerTeam();
  const dev = await w.signIn("dev");
  const m = await open("security", { world: w, as: dev });
  const admins = (await dev.read("memberlist")).members.filter((x) => x.role === "admin" && x.status === "active").map((x) => x.handle || said("member.founder.unnamed"));
  has(m, "screen.security.admins", { admins: admins.join(", ") });
  const OWN = Object.values(SCREENS.find((s) => s.id === "security").reads({ me: await founder.read("whoami") })).map((r) => r.op);
  assert.ok(OWN.length >= 6 && OWN.includes("securitymap"), "the reads the screen asks an administrator");
  assert.deepEqual(m.p.requests.filter((r) => OWN.includes(r.op)), [], "nothing of the screen's own is read");
  assert.deepEqual(m.p.requests.map((r) => r.op).filter((op) => !["assistantstate", "accountreference", "subscriptionsignin", "groupkeystate"].includes(op)), ["memberlist"], "only the roster, for who the administrators are");
  assert.deepEqual(ops(m), []);
});

test("R15 the level for the period chosen, by kind against its usual, naming no address, country, role or member", async () => {
  const s = await burstTeam({ signatures: HOUR });
  const a = await open("security", { world: s.w, as: s.founder });
  const q = a.p.requests.find((r) => r.op === "securitymap").query;
  assert.equal(Date.parse(q.to) - Date.parse(q.from), 7 * 86400000, "the last seven days by default");
  const level = await s.founder.read("securitymap", { query: q });
  has(a, "screen.security.level." + level.level.toLowerCase());
  for (const c of level.countries) assert.ok(!a.text.includes(c.country), "no country drawn");
  assert.ok(!a.text.includes("founder"), "no member drawn");
  // a period chosen: the days named, the last included, read again
  const days = (n) => iso(Date.now() - n * 86400000).slice(0, 10);
  const [from, to] = [days(9), days(1)];
  const end = iso(Date.parse(to + "T00:00:00Z") + 86400000);
  const r = await a.press("securitymap", { values: { "se-from": from, "se-to": to } });
  assert.deepEqual(r.sent[0].query, { from: from + "T00:00:00.000Z", to: end });
  const answered = await s.founder.read("securitymap", { query: r.sent[0].query });
  assert.deepEqual(a.p.requests.filter((x) => x.op === "securitymap").at(-1).query, { from: answered.from, to: answered.to }, "read again for that period, as the owner answered it");
  assert.deepEqual((await a.press("securitymap", { values: { "se-from": to, "se-to": from } })).sent, []);
});

test("R15 what is built in is said only as part_scanner and part_safe_view answer it", async () => {
  const held = await scannerTeam({ signatures: HOUR });
  const on = await open("security", { world: held.w, as: held.founder });
  // a scanner that is built in is said once, by the lead's sentence, never twice
  has(on, "screen.security.files.on");
  lacks(on, "instance.part.scanner.present");
  lacks(on, "instance.scanner.absent.step");
  const none = await scannerTeam({ scanner: "absent" });
  const off = await open("security", { world: none.w, as: none.founder });
  has(off, "instance.part.scanner.absent");
  has(off, "instance.scanner.absent.step");
  lacks(off, "instance.part.scanner.present");
  assert.ok(!off.text.includes(said("screen.security.queue", { queued: 3, held: 1 })), "no sentence of scanning while no scanner");
  const silent = await scannerTeam({ scanner: "unreachable" });
  const unread = await open("security", { world: silent.w, as: silent.founder });
  has(unread, "instance.part.unknown", { part: said("screen.security.part.scanner") });
});

test("R15 securitytooladd asks only the entry's config by its labels, its credentials in the body only, confirms the vendor's keeping, sends the handling's digest; then tests it and says whether it is on", async () => {
  const s = await scannerTeam({ signatures: HOUR });
  const cat = await catalogueOf(s.founder);
  const entry = cat.find((e) => e.provider_id === "sophos-intelix"), own = cat.find((e) => e.provider_id === "metadefender-core");
  assert.equal(entry.handling.sample_sharing, "vendor_internal_research", "a vendor that keeps samples to research");
  assert.equal(own.handling.on_own, true, "a tool on the organization's own servers");
  const a = await open("security", { world: s.w, as: s.founder });
  const panel = panelOf(a.tree, entry.provider_id);
  assert.ok(said("screen.security.h.files") && a.text.includes(entry.handling.file_retention));
  assert.equal(all(panel, (e) => e.tag === "input" && /^sa-sophos-intelix-c-/.test(e.attrs.id || "")).length, entry.config.length, "only what its config lists");
  assert.equal(all(panel, (e) => e.attrs.id === "sa-sophos-intelix-every").length, 0, "every file only for a tool on the organization's own servers");
  assert.equal(all(panelOf(a.tree, own.provider_id), (e) => e.attrs.id === "sa-metadefender-core-every").length, 1);
  // a field the entry needs, left empty: nothing is sent
  const missing = await a.press("securitytooladd", { data: { provider: entry.provider_id }, values: { "sa-sophos-intelix-c-region": "", "sa-sophos-intelix-k-client_id": "k", "sa-sophos-intelix-k-client_secret": "k" } });
  assert.deepEqual(missing.sent, []);
  const ownSent = await a.press("securitytooladd", { data: { provider: own.provider_id }, values: { "sa-metadefender-core-c-host": "mdcore.example.org", "sa-metadefender-core-k-api_key": "k", "sa-metadefender-core-every": true } });
  assert.equal(ownSent.sent[0].body.use, "routine");
  const r = await a.press("securitytooladd", { data: { provider: entry.provider_id }, values: SOPHOS });
  assert.deepEqual(r.sent[0].body, { providerId: entry.provider_id, config: { region: KEY.region }, credentials: { client_id: KEY.client_id, client_secret: KEY.client_secret }, handlingDigest: entry.handling_digest, confirmRetention: true, use: "on_request" });
  const held = (await s.founder.read("securitytools")).tools.find((t) => t.provider_id === entry.provider_id);
  assert.deepEqual(r.sent[1].op === "securitytooltest" && r.sent[1].body, { toolId: held.tool_id });
  has(a, "screen.security.tested.on");
  assert.equal(held.state, "on", "the owner holds it on");
  assert.ok(!a.html.includes(KEY.client_secret) && a.b.requests.filter((x) => JSON.stringify(x).includes(KEY.client_secret)).length === 1, "the credentials never drawn or sent again");
  // a key the vendor refuses: the test says why it stays off
  const f = await scannerTeam({ signatures: HOUR });
  const fails = await open("security", { world: f.w, as: f.founder });
  await fails.press("securitytooladd", { data: { provider: entry.provider_id }, values: { ...SOPHOS, "sa-sophos-intelix-k-client_secret": "the-wrong-secret" } });
  const failed = (await f.founder.read("securitytools")).tools.find((t) => t.provider_id === entry.provider_id);
  assert.equal(failed.state, "test_failed", "the owner holds it off");
  const again = await f.founder.act("securitytooltest", { body: { toolId: failed.tool_id } });
  assert.equal(again.passed, false);
  has(fails, "screen.security.tested.off", { detail: again.detail });
});

test("R15 securitytooltest and securitytoolremove from the tool's row panel; a refusal in file-safety's words", async () => {
  const s = await scannerTeam({ signatures: HOUR });
  const { toolId } = await addSophos(s.founder);
  const a = await open("security", { world: s.w, as: s.founder });
  for (const op of ["securitytooltest", "securitytoolremove"]) assert.ok(acts(panelOf(a.tree, toolId, toolId)).some((b) => b.attrs["data-act"] === op), op);
  // the scanner is taken away (a platform binding): the owner refuses the test in its own words
  const gone = s.w.env.FILE_SCANNER;
  delete s.w.env.FILE_SCANNER;
  const r = await open("security", { world: s.w, as: s.founder });
  await r.press("securitytooltest", { data: { tool: toolId } });
  assert.equal(r.refused.text, said("refusal.SCANNER_ABSENT"), "the owner's row's words");
  s.w.env.FILE_SCANNER = gone;
  // a code the list does not hold yet is drawn in its translation
  const t = await open("security", { world: s.w, as: s.founder, table: {
    // fixtures-generic: SOME_NEW_CODE
    securitytooltest: env({ ok: false, reason: "SOME_NEW_CODE", code: "SOME_NEW_CODE", translation: "file-safety's words" }) } });
  await t.press("securitytooltest", { data: { tool: toolId } });
  assert.equal(t.refused.text, "file-safety's words", "else its translation");
  assert.deepEqual((await a.press("securitytoolremove", { data: { tool: toolId } })).sent[0].body, { toolId });
  assert.ok(!(await s.founder.read("securitytools")).tools.some((x) => x.tool_id === toolId && x.state !== "removed"), "the owner holds it removed");
});

test("R62 security reads whose server from data: handling.on_own, never the recipient's words", async () => {
  const s = await scannerTeam({ signatures: HOUR });
  const cat = await catalogueOf(s.founder);
  const a = await open("security", { world: s.w, as: s.founder });
  // the every-file box is drawn for exactly the tools whose data says they run on the organization's own servers
  for (const e of cat.filter((x) => !x.template)) {
    const id = "sa-" + e.provider_id.replace(/[^A-Za-z0-9_-]/g, "_") + "-every";
    assert.equal(all(panelOf(a.tree, e.provider_id), (x) => x.attrs.id === id).length, e.handling.on_own === true ? 1 : 0, `${e.provider_id}: by its flag`);
  }
  const own = cat.find((e) => e.provider_id === "metadefender-core"), outside = cat.find((e) => e.provider_id === "scanii");
  const r = await a.press("securitytooladd", { data: { provider: own.provider_id }, values: { "sa-metadefender-core-c-host": "mdcore.example.org", "sa-metadefender-core-k-api_key": "k", "sa-metadefender-core-every": true } });
  assert.equal(r.sent[0].body.use, "routine");
  const c = await a.press("securitytooladd", { data: { provider: outside.provider_id }, values: { "sa-scanii-c-region": "eu1", "sa-scanii-k-api_key": "k", "sa-scanii-k-api_secret": "k", "sa-scanii-every": true } });
  assert.equal(c.sent[0].body.use, "on_request", "no every-file box for a tool that is not on the organization's own servers");
});

/* R43 (T50; U3; DEC-291; N1194): Security leads with how things stand, and a period may end today */
const lastDay = (q) => new Date(Date.parse(q.to) - 1).toISOString();

test("R43 an ordinary period leads with one sentence under its mark, the period named by its first and last day, the counts folded, and the catalogue of kinds only in the 'Add another checker' fold", async () => {
  const s = await burstTeam({ days: 0, n: 3, signatures: HOUR });   // three refused sign-ins in an hour: nothing unusual
  const a = await open("security", { world: s.w, as: s.founder });
  const q = a.p.requests.find((r) => r.op === "securitymap").query;
  assert.equal((await s.founder.read("securitymap", { query: q })).level, "Ordinary");
  has(a, "screen.security.ordinary.head");
  has(a, "screen.security.ordinary.line", { period: said("period.days", { first: day(q.from), last: day(lastDay(q)) }) });
  const mark = all(a.tree, (e) => /\bcs-risk\b/.test(e.attrs.class || ""))[0];
  assert.ok(mark && mark.attrs["data-tip"].includes(said("screen.security.risk.means.ordinary").slice(0, 30)), "the mark is explained");
  has(a, "screen.security.period", { from: day(q.from), to: day(lastDay(q)) });
  lacks(a, "screen.security.summary.signin", { when: day(q.to) });
  // the counts are folded
  const counts = all(a.tree, (e) => e.tag === "details" && e.attrs["data-fold"] === "counts")[0];
  assert.ok(counts && textOf(counts).includes(said("screen.security.counts.fold")) && all(counts, (e) => e.tag === "table").length === 1);
  const byKind = all(a.tree, (e) => e.tag === "table" && textOf(e).includes(said("screen.security.col.kind")));
  assert.ok(byKind.length === 1 && ancestor(byKind[0], (x) => x === counts), "the counts by kind only inside their fold");
  // the catalogue is drawn only inside the fold
  const vendor = (await catalogueOf(s.founder))[0].vendor;
  const add = all(a.tree, (e) => e.tag === "details" && e.attrs["data-fold"] === "add")[0];
  assert.ok(add && textOf(add).includes(said("screen.security.add.fold")) && textOf(add).includes(vendor));
  assert.ok(!all(a.tree, (e) => e.tag === "table" && e.attrs["data-table"] === "catalogue" && !ancestor(e, (x) => x === add)).length && !a.text.replace(textOf(add), "").includes(said("screen.security.does.scan")), "no list of outside-tool kinds outside the fold");
  // files are said once, while the scanner is built in
  assert.equal(a.text.split(said("screen.security.files.on")).length, 2);
});

test("R43 a raised or high period leads with what happened (a hard try at signing in) and that it was refused", async () => {
  const s = await burstTeam({ signatures: HOUR });
  const a = await open("security", { world: s.w, as: s.founder });
  const q = a.p.requests.find((r) => r.op === "securitymap").query;
  const m = await s.founder.read("securitymap", { query: q });
  has(a, "screen.security.level." + m.level.toLowerCase());
  assert.notEqual(m.level, "Ordinary");
  has(a, "screen.security.summary.signin", { when: day(m.levelAt) });
  // the detail is told from the owner's counts: the times the usual, from the first bucket above its usual to the last day
  const hard = m.buckets.filter((b) => b.counts.signin > b.usual.signin);
  const sum = (k, key) => m.buckets.reduce((n, b) => n + b[key][k], 0);
  assert.ok(hard.length && sum("signin", "usual") > 0, "the owner holds an unusual hour and a usual to compare it with");
  has(a, "screen.security.summary.detail", { times: Math.max(1, Math.round(sum("signin", "counts") / sum("signin", "usual"))), from: day(hard[0].start), to: day(lastDay(q)), highfrom: day(m.levelAt), highto: day(lastDay(q)) });
  lacks(a, "screen.security.ordinary.head");
  // control: a raised period with no usual to compare with says no more than the answers hold
  const q2 = await burstTeam({ days: 0, signatures: HOUR });
  const quiet = await open("security", { world: q2.w, as: q2.founder });
  const m2 = await q2.founder.read("securitymap", { query: quiet.p.requests.find((r) => r.op === "securitymap").query });
  assert.equal(m2.totals.usual.signin, 0);
  lacks(quiet, "screen.security.summary.detail", { times: 1, from: "", to: "", highfrom: "", highto: "" });
  assert.ok(!/\{\w+\}|undefined|NaN/.test(quiet.html));
});

test("R43 a period may end today: to is no later than the end of the present hour; the opening period asked again lands; a period ending yesterday sends the next midnight as before", async () => {
  const { w, founder } = await scannerTeam();
  const a = await open("security", { world: w, as: founder });
  const first = a.p.requests.find((r) => r.op === "securitymap").query;
  const today = iso(Date.now()).slice(0, 10), from = first.from.slice(0, 10);
  const presses = a.p.requests.filter((r) => r.op === "securitymap").length;
  const r = await a.press("securitymap", { values: { "se-from": from, "se-to": today } });
  const to = Date.parse(r.sent[0].query.to), nowHour = Date.parse(first.to);
  assert.ok(to <= nowHour + HOUR && to > nowHour - HOUR, "the end of the present hour at the latest");
  assert.equal(r.sent[0].query.from, from + "T00:00:00.000Z");
  const answered = await founder.read("securitymap", { query: r.sent[0].query });
  assert.ok(a.p.requests.filter((x) => x.op === "securitymap").length > presses && a.p.requests.filter((x) => x.op === "securitymap").at(-1).query.to === answered.to, "and it lands: read again for that period, as the owner answered it");
  lacks(a, "screen.security.period.bad");
  // the day before today: the next day's 00:00Z, as before
  const yesterday = new Date(Date.parse(today + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
  assert.equal((await a.press("securitymap", { values: { "se-from": from, "se-to": yesterday } })).sent[0].query.to, today + "T00:00:00.000Z");
});

test("R43 a start after the end sends nothing and draws the refusal in a fold, open, that is drawn only then; a member who does not administer reads only that the screen is administrators'", async () => {
  const { w, founder } = await scannerTeam();
  const a = await open("security", { world: w, as: founder });
  assert.equal(all(a.tree, (e) => e.attrs["data-state"] === "periodbad").length, 0, "the fold is not drawn otherwise");
  const before = a.p.requests.length;
  const r = await a.press("securitymap", { values: { "se-from": "2026-10-10", "se-to": "2026-10-01" } });
  assert.deepEqual(r.sent, []);
  a.redraw();
  assert.equal(a.p.requests.length, before, "nothing read");
  const fold = all(a.tree, (e) => e.tag === "details" && e.attrs["data-state"] === "periodbad")[0];
  assert.ok(fold && "open" in fold.attrs && textOf(fold).includes(said("screen.security.period.bad.summary")) && textOf(fold).includes(said("screen.security.period.bad")));
  // a good period afterwards clears it
  const days = (n) => iso(Date.now() - n * 86400000).slice(0, 10);
  await a.press("securitymap", { values: { "se-from": days(3), "se-to": days(2) } });
  assert.equal(all(a.tree, (e) => e.attrs["data-state"] === "periodbad").length, 0);
  const dev = await w.signIn("dev");
  const m = await open("security", { world: w, as: dev });
  has(m, "screen.security.admins", { admins: await handleOf(founder) });
  assert.deepEqual(ops(m), []);
});

test("R15 a tool in use is named by its provider's display name (vendor and product from the catalogue), never by its slug", async () => {
  const s = await scannerTeam({ signatures: HOUR });
  const { entry } = await addSophos(s.founder);
  const a = await open("security", { world: s.w, as: s.founder });
  const row = all(a.tree, (e) => e.tag === "tr" && textOf(e).includes(`${entry.vendor} · ${entry.product}`))[0];
  assert.ok(row, "named by vendor and product");
  assert.ok(!a.text.includes(entry.provider_id), "the slug is drawn nowhere");
  // with the catalogue unread the row says what it is by the column's word, still no slug
  const u = await open("security", { world: s.w, as: s.founder, table: { securitytoolcatalogue: "none" } });
  assert.ok(!u.text.includes(entry.provider_id));
});

/* ---- T51 FR-25: T-14 (R74), K4213 (R77) ---- */

test("R74 each credential field of a provider is labelled by its word (file-scanner.credential.<field>), never its raw name; the field sent stays the catalogue's; a field outside the four keeps its own name", async () => {
  const FOUR = ["client_id", "client_secret", "api_key", "api_secret"];
  const s = await scannerTeam({ signatures: HOUR });
  const cat = (await catalogueOf(s.founder)).filter((e) => !e.template);
  const a = await open("security", { world: s.w, as: s.founder });
  const label = (e, k) => textOf(all(a.tree, (x) => x.tag === "label" && x.attrs.for === `sa-${e.provider_id.replace(/[^A-Za-z0-9_-]/g, "_")}-k-${k}`)[0]);
  let outside = 0;
  for (const e of cat) for (const k of e.credentials) {
    if (FOUR.includes(k)) {
      assert.ok(label(e, k).includes(said("screen.security.field", { label: said("file-scanner.credential." + k) })), `${e.provider_id}: ${k}`);
      assert.ok(!label(e, k).includes(k), `${e.provider_id}: ${k}: no raw name`);
    } else {
      outside++;
      assert.ok(label(e, k).includes(said("screen.security.field", { label: k })), `${e.provider_id}: control: a field outside the four falls back to its own name`);
    }
  }
  assert.ok(outside >= 1, "the catalogue holds a field outside the four");
  // what is sent keeps the raw name the owner declares (the guard accepts it)
  const scanii = cat.find((e) => e.provider_id === "scanii"), halo = cat.find((e) => e.provider_id === "glasswall-halo");
  const r = await a.press("securitytooladd", { data: { provider: "scanii" }, values: { "sa-scanii-c-region": "eu1", "sa-scanii-k-api_key": "ID-1", "sa-scanii-k-api_secret": "SECRET-1" } });
  assert.deepEqual(r.sent[0].body.credentials, { api_key: "ID-1", api_secret: "SECRET-1" });
  assert.deepEqual(scanii.credentials, ["api_key", "api_secret"]);
  const h = await a.press("securitytooladd", { data: { provider: "glasswall-halo" }, values: { "sa-glasswall-halo-c-host": "halo.example.org", "sa-glasswall-halo-k-api_token": "T-1" } });
  assert.deepEqual(h.sent[0].body.credentials, { api_token: "T-1" });
  assert.deepEqual(halo.credentials, ["api_token"]);
});

const stateLines = (o, re) => all(o.tree, (e) => re.test(e.attrs["data-state"] || ""));
const refusedAt = (code) => (now) => ({ last_attempt: iso(now - 20 * HOUR), last_error: code });

test("R77 a scanner that holds no signatures is said so by the keys scanstatus answers, with the day and the reason; absent, nothing is drawn (control)", async () => {
  const lines = async (opts) => {
    const s = await scannerTeam(opts);
    const o = await open("security", { world: s.w, as: s.founder });
    return { s, o, ns: (await s.founder.read("scanstatus")).no_signatures };
  };
  const a = await lines({ state: refusedAt("REFUSED:main.cvd:403") });
  const first = stateLines(a.o, /^nosignatures$/)[0], second = stateLines(a.o, /^nosignatures-reason$/)[0];
  assert.equal(textOf(first), said(a.ns.key, { date: day(a.ns.since) }), "the key's word, its date filled");
  assert.equal(textOf(second), said(a.ns.reason_key, { status: "403" }), "its reason in words, the refusal's code filled");
  assert.equal(a.ns.reason_key, "file-safety.index.signatures_refused");
  assert.ok(!/waiting/i.test(textOf(first) + textOf(second)));
  // never signatures obtained, no date; an attempt that did not finish: the other keys
  const b = await lines({});
  assert.equal(b.ns.since, null);
  assert.equal(textOf(stateLines(b.o, /^nosignatures$/)[0]), said(b.ns.key));
  assert.equal(textOf(stateLines(b.o, /^nosignatures-reason$/)[0]), said(b.ns.reason_key));
  assert.equal(b.ns.reason_key, "file-safety.index.signatures_not_fetched");
  const c = await lines({ state: refusedAt("FAILED") });
  assert.equal(textOf(stateLines(c.o, /^nosignatures-reason$/)[0]), said(c.ns.reason_key));
  assert.equal(c.ns.reason_key, "file-safety.index.signatures_failed");
  // a key the list does not hold yet is the answer's own words (WORLD GAP: the owner gives only keys the list holds)
  const st = await a.s.founder.read("scanstatus");
  const d = await open("security", { world: a.s.w, as: a.s.founder, table: { scanstatus: env({ ...st, no_signatures: { ...st.no_signatures, key: "file-safety.index.no_such_row", words: "the plane's own words" } }) } });
  assert.equal(textOf(stateLines(d, /^nosignatures$/)[0]), "the plane's own words");
  // control: signatures held (no_signatures absent): nothing drawn
  const none = await lines({ signatures: HOUR });
  assert.equal(none.ns, undefined);
  assert.equal(stateLines(none.o, /^nosignatures/).length, 0);
});

/* ---- T51 fix round 2: C83 ---- */

test("R15, R77 C83: files are said to be checked only while signatures are held; a scanner with none draws that state with its date and reason and no checked sentence; control: signatures held draw the sentence", async () => {
  const s = await scannerTeam({ state: refusedAt("REFUSED:main.cvd:403") });
  const none = await open("security", { world: s.w, as: s.founder });
  const ns = (await s.founder.read("scanstatus")).no_signatures;
  lacks(none, "screen.security.files.on");
  assert.equal(stateLines(none, /^files$/).length, 0, "no checked sentence");
  assert.equal(textOf(stateLines(none, /^nosignatures$/)[0]), said(ns.key, { date: day(ns.since) }), "since when");
  assert.equal(textOf(stateLines(none, /^nosignatures-reason$/)[0]), said(ns.reason_key, { status: "403" }), "why, in words");
  assert.equal(stateLines(none, /^nosignatures-next$/).length, 0, "what an administrator can do is in the reason's own sentence, said once (C83, round 3)");
  // a scanner that did not answer, or none bound, claims nothing either
  for (const scanner of ["unreachable", "absent"]) {
    const t = await scannerTeam({ scanner });
    const o = await open("security", { world: t.w, as: t.founder });
    lacks(o, "screen.security.files.on");
  }
  // a scan state that could not be read claims nothing
  const unread = await open("security", { world: s.w, as: s.founder, table: { scanstatus: "none" } });
  lacks(unread, "screen.security.files.on");
  // control: signatures held
  const h = await scannerTeam({ signatures: HOUR });
  const held = await open("security", { world: h.w, as: h.founder });
  has(held, "screen.security.files.on");
  assert.equal(stateLines(held, /^nosignatures/).length, 0);
});

/* ---- T51 fix round 3: C83 (R15, R77), C84 (R15) ---- */

test("R15, R77 C83: the administrator's step is said once in each state of a scanner with no signatures; where no reason line is drawn it is drawn on its own; the other states draw none (control)", async () => {
  // a refusal with its status, an attempt never made, one that did not finish, a refusal with no status in it
  for (const opts of [{ state: refusedAt("REFUSED:main.cvd:403") }, {}, { state: refusedAt("FAILED") }, { state: refusedAt("MIRROR_REFUSED:exit 1: refused") }]) {
    const s = await scannerTeam(opts);
    const o = await open("security", { world: s.w, as: s.founder });
    assert.equal(stateLines(o, /^nosignatures-reason$/).length, 1, "the reason line holds the step");
    assert.equal(stateLines(o, /^nosignatures-next$/).length, 0, "no second line says it again");
  }
  // control: an answer with no reason line draws the step on its own, once (WORLD GAP: the owner always gives a reason line)
  const s = await scannerTeam({ state: refusedAt("FAILED") });
  const st = await s.founder.read("scanstatus");
  const { reason_key, reason_words, ...bareNs } = st.no_signatures;
  const bare = await open("security", { world: s.w, as: s.founder, table: { scanstatus: env({ ...st, no_signatures: bareNs }) } });
  assert.equal(stateLines(bare, /^nosignatures-reason$/).length, 0);
  assert.equal(textOf(stateLines(bare, /^nosignatures-next$/)[0]), said("screen.security.nosignatures.next"));
  assert.equal(stateLines(bare, /^nosignatures-next$/).length, 1);
  // control: signatures held, an unreachable scanner and none bound say none of it
  for (const opts of [{ signatures: HOUR }, { scanner: "unreachable" }, { scanner: "absent" }]) {
    const t = await scannerTeam(opts);
    const o = await open("security", { world: t.w, as: t.founder });
    assert.equal(stateLines(o, /^nosignatures/).length, 0);
  }
});

test("R15 C84: Security draws a button that checks for new signatures now, sends scanmirror once, draws that the run goes on, and reads the scanner's state again", async () => {
  const s = await scannerTeam();
  const a = await open("security", { world: s.w, as: s.founder });
  assert.equal(acts(a.tree).filter((b) => b.attrs["data-act"] === "scanmirror").length, 1, "the button is drawn");
  assert.equal(stateLines(a, /^mirror$/).length, 0, "nothing answered yet");
  const reads = () => a.p.requests.filter((r) => r.op === "scanstatus").length;
  const before = reads();
  const r = await a.press("scanmirror");
  assert.deepEqual(r.sent.filter((x) => x.op === "scanmirror").map((x) => x.body), [{}], "asked once, with no field");
  assert.equal(stateLines(a, /^mirror$/).length, 1, "what it answered is drawn");
  has(a, "screen.security.mirror.started");
  assert.ok(reads() > before, "the scanner's state is read again");
  assert.notEqual((await s.sigs()).last_error, null, "the owner's scanner began the run");
  // a refused run is not drawn as started: a check was made a few minutes ago
  const t = await scannerTeam({ state: (now) => ({ last_attempt: iso(now - 5 * 60000), last_error: "REFUSED:main.cvd:403" }) });
  const again = await open("security", { world: t.w, as: t.founder });
  const q = await again.press("scanmirror");
  assert.equal(q.sent.filter((x) => x.op === "scanmirror").length, 1);
  assert.equal(stateLines(again, /^mirror$/).length, 0, "a refused run is not drawn as started");
});

test("R15 C84: a run asked for inside the minimum gap, or with no scanner bound, is refused beside the button in file-safety's own words; no button where no scanner is built in, and none to a member who does not administer (control)", async () => {
  const t = await scannerTeam({ state: (now) => ({ last_attempt: iso(now - 5 * 60000), last_error: "REFUSED:main.cvd:403" }) });
  const recent = await open("security", { world: t.w, as: t.founder });
  await recent.press("scanmirror");
  assert.ok(recent.refused, "refused beside the button");
  assert.equal(recent.refused.key, "refusal.SIGNATURES_RUN_RECENT", "the refusal is drawn by its key, through the shell (K3810)");
  assert.equal(recent.refused.text, said("refusal.SIGNATURES_RUN_RECENT"), "the list's sentence, now that the list holds the code");
  // the binding is taken away after the page is drawn (a platform binding): the owner refuses in its own words
  const u = await scannerTeam();
  const absent = await open("security", { world: u.w, as: u.founder });
  delete u.w.env.FILE_SCANNER;
  await absent.press("scanmirror");
  assert.equal(absent.refused.text, said("refusal.SCANNER_ABSENT"), "the owner's row's words");
  // control: no scanner built in: no button; a member: no button
  const n = await scannerTeam({ scanner: "absent" });
  const none = await open("security", { world: n.w, as: n.founder });
  assert.ok(!ops(none).includes("scanmirror"));
  const dev = await t.w.signIn("dev");
  const m = await open("security", { world: t.w, as: dev });
  assert.deepEqual(ops(m), []);
});

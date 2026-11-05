/* stewards R1–R23, each at the module's interface: the Worker's `fetch` and `scheduled` driven with requests, its store
   the module's own Durable Object over SQLite, its mail binding a fake (fixture.mjs); `checkOpen` and the deploy script
   run as a deployer runs them. */
import { test, afterEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, writeFileSync, mkdtempSync, chmodSync, existsSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { worker, W, makeEnv, makeStore, call, report, signIn, ALICE, BOB, ADDRESS, REPORT, LOGS, OUTBOUND, SEEN, ORIGIN,
  shaHex, keyOf, clock, T0 } from "./fixture.mjs";
import { GROUP_SLUG_RE } from "../../bio-plane/src/setup-fleet.mjs";
import { parseJsonc } from "../src/config.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { GUIDE_TEXT, GUIDE_PARAGRAPHS, SERVICE_HOLDS, KIND_WORDS, RESPONSIBLE, STEWARDS, RECEIVED, NOT_YET_OPEN_HEADING, noticeSentences, noticeLines, esc, when } from "../src/ui.mjs";

const ROOT = new URL("..", import.meta.url).pathname;
const DAY = 86400e3, HOUR = 3600e3;
let clk = null;
afterEach(() => { clk?.reset(); clk = null; });
const reportsIn = (env) => env.STORE.db.prepare("SELECT COUNT(*) AS n FROM reports").get().n;
const decide = (env, cookie, body) => call(env, "/steward/decide", { method: "POST", body, cookie });
const OPEN = ["STEWARDS_ADDRESS", "REPORT_RETENTION_DAYS", "CONTACT_RETENTION_DAYS", "STEWARD_KEYS", "SOURCE_KEY"];
const MALFORMED = {
  STEWARDS_ADDRESS: ["", "not-an-address", "a@b.example, c@d.example", "a b@c.example", `${"a".repeat(250)}@b.example`],
  REPORT_RETENTION_DAYS: ["", "0", "3651", "90.5", "ninety", "-1"],
  CONTACT_RETENTION_DAYS: ["", "0", "3651", "1e2"],
  STEWARD_KEYS: ["", "nobody", `alice:${"0".repeat(63)}`, `${"n".repeat(65)}:${"0".repeat(64)}`, `a:${"0".repeat(64)}\na:${"1".repeat(64)}`],
  SOURCE_KEY: ["", "k".repeat(31)],
};

test("R1: not yet open while any of the five values is absent or malformed; the same request with all five is accepted", async () => {
  const cases = [];
  for (const name of OPEN) { cases.push([name, undefined]); for (const v of MALFORMED[name]) cases.push([name, v]); }
  for (const [name, value] of cases) {
    const env = makeEnv({ [name]: value });
    const page = await call(env, "/", { json: false });
    assert.equal(page.status, 200);
    assert.ok(page.text.includes(esc(NOT_YET_OPEN_HEADING)), `${name}: the page says the service is not yet open`);
    assert.doesNotMatch(page.text, /<form/);
    assert.ok(!page.text.includes(ADDRESS), `${name}: the page names no address`);
    const r = await report(env);
    assert.equal(r.status, 503, `${name}=${value}`);
    assert.equal(r.data.code, "NOT_YET_OPEN");
    assert.equal(reportsIn(env), 0);
    assert.equal(env.sent.length, 0);
    const guide = await call(env, "/guide", { json: false });
    assert.equal(guide.status, 200);
    assert.ok(!guide.text.includes(ADDRESS) && !/mailto:/.test(guide.text), "the guide has no contact line");
    for (const p of ["/withdrawals", "/steward/reports"]) assert.equal((await call(env, p)).status, 503);
  }
  const env = makeEnv();
  const ok = await report(env);
  assert.equal(ok.status, 200);
  assert.equal(ok.data.ok, true);
  for (const v of ["1", "3650"]) assert.equal((await report(makeEnv({ REPORT_RETENTION_DAYS: v, CONTACT_RETENTION_DAYS: v }))).status, 200);
});

const WRANGLER_OPEN = (over = {}) => JSON.stringify({ account_id: "20b533579290b9b93168345edd3b7f72",
  vars: { STEWARDS_ADDRESS: ADDRESS, REPORT_RETENTION_DAYS: "365", CONTACT_RETENTION_DAYS: "90", ...over } });

test("R2: checkOpen answers null only when the deploy configuration would open the service, else names each gap; the deploy script refuses and deploys nothing", () => {
  const secrets = ["STEWARD_KEYS", "SOURCE_KEY"];
  assert.equal(W.checkOpen({ wranglerJsonc: WRANGLER_OPEN(), secretNames: secrets }), null);
  const lacking = W.checkOpen({ wranglerJsonc: WRANGLER_OPEN({ STEWARDS_ADDRESS: undefined }), secretNames: secrets });
  assert.deepEqual(lacking.map((p) => p.name), ["STEWARDS_ADDRESS"]);
  assert.equal(lacking[0].problem, localize("stewards.config.address_not_set", "is not set: the stewards' contact address is missing"));
  for (const [over, sec, name] of [[{ REPORT_RETENTION_DAYS: "0" }, secrets, "REPORT_RETENTION_DAYS"], [{ CONTACT_RETENTION_DAYS: undefined }, secrets, "CONTACT_RETENTION_DAYS"],
    [{ STEWARDS_ADDRESS: "a@b.example,c@d.example" }, secrets, "STEWARDS_ADDRESS"], [{}, ["SOURCE_KEY"], "STEWARD_KEYS"], [{}, ["STEWARD_KEYS"], "SOURCE_KEY"],
    [{ SOURCE_KEY: "plain" }, secrets, "SOURCE_KEY"]]) {
    const p = W.checkOpen({ wranglerJsonc: WRANGLER_OPEN(over), secretNames: sec });
    assert.ok(p && p.some((x) => x.name === name && x.problem.length > 5), name);
  }
  /* The committed configuration: the address is Bob's, not yet named, so it is refused naming it. */
  const committed = readFileSync(join(ROOT, "wrangler.jsonc"), "utf8");
  assert.deepEqual(W.checkOpen({ wranglerJsonc: committed, secretNames: secrets }).map((p) => p.name), ["STEWARDS_ADDRESS"]);

  /* The deploy script, with a stand-in wrangler that records what it is asked. */
  const dir = mkdtempSync(join(tmpdir(), "stewards-deploy-"));
  const log = join(dir, "calls.log");
  const fake = join(dir, "wrangler");
  writeFileSync(fake, `#!/bin/sh\necho "$@" >> ${log}\nif [ "$1" = secret ]; then echo '[{"name":"STEWARD_KEYS","type":"secret_text"},{"name":"SOURCE_KEY","type":"secret_text"}]'; fi\n`);
  chmodSync(fake, 0o755);
  const run = (cfgText) => {
    const cfg = join(dir, "wrangler.jsonc");
    writeFileSync(cfg, cfgText);
    writeFileSync(log, "");
    const r = spawnSync(process.execPath, [join(ROOT, "scripts/deploy.mjs"), "--config", cfg], { env: { ...process.env, WRANGLER: fake }, encoding: "utf8" });
    return { status: r.status, out: r.stdout + r.stderr, calls: readFileSync(log, "utf8") };
  };
  const refused = run(WRANGLER_OPEN({ STEWARDS_ADDRESS: undefined }));
  assert.notEqual(refused.status, 0);
  assert.match(refused.out, /STEWARDS_ADDRESS/);
  assert.doesNotMatch(refused.calls, /^deploy/m, "nothing deployed");
  const elsewhere = run(JSON.stringify({ ...JSON.parse(WRANGLER_OPEN()), account_id: "0".repeat(32) }));
  assert.notEqual(elsewhere.status, 0);
  assert.match(elsewhere.out, /account_id/);
  assert.equal(elsewhere.calls, "", "an unpinned account is refused before wrangler is asked anything");
  const ok = run(WRANGLER_OPEN());
  assert.equal(ok.status, 0, ok.out);
  assert.match(ok.calls, /^deploy --config/m);
});

test("R3: the intake takes {kind, concerns, description, contact?} with no credential, refusing in order; each cap at its edge", async () => {
  const env = makeEnv();
  let n = 0;
  const ok = async (over, opts) => { const r = await report(env, over, { ip: `203.0.113.${++n}`, ...opts }); assert.equal(r.status, 200, JSON.stringify(over).slice(0, 80)); return r; };
  const no = async (over, code, opts) => { const before = reportsIn(env); const r = await report(env, over, { ip: `203.0.113.${++n}`, ...opts }); assert.equal(r.status, 400); assert.equal(r.data.code, code); assert.ok(r.data.field); assert.equal(reportsIn(env), before); };
  for (const kind of W.KINDS) await ok({ kind });
  assert.deepEqual([...W.KINDS], ["fabricated_evidence", "harassment", "impersonation", "other"]);
  await no({ kind: "spam" }, "REPORT_KIND_UNKNOWN");
  await no({ kind: undefined }, "REPORT_KIND_UNKNOWN");
  /* concerns: a slug, a group's or a case's https address; cap 2,048. */
  await ok({ concerns: "abc" });
  await ok({ concerns: "https://eastlake.example.workers.dev/" });
  const base = "https://cases.example/c/";
  await ok({ concerns: base + "a".repeat(2048 - base.length) });
  await no({ concerns: base + "a".repeat(2049 - base.length) }, "REPORT_CONCERNS_INVALID");
  for (const bad of ["", "AB", "http://x.example/", "ftp://x.example", "https://user:pw@x.example/", "not a slug", "-ab"]) await no({ concerns: bad }, "REPORT_CONCERNS_INVALID");
  assert.ok(GROUP_SLUG_RE.test("abc"));
  /* description 1–8,000; contact ≤ 254, optional. */
  await ok({ description: "x" });
  await ok({ description: "é".repeat(8000) });
  await no({ description: "x".repeat(8001) }, "REPORT_DESCRIPTION_INVALID");
  await no({ description: "" }, "REPORT_DESCRIPTION_INVALID");
  await ok({ contact: undefined });
  await ok({ contact: "c".repeat(254) });
  await no({ contact: "c".repeat(255) }, "REPORT_CONTACT_INVALID");
  /* order: the first failing field is named. */
  await no({ kind: "x", concerns: "", description: "", contact: "c".repeat(300) }, "REPORT_KIND_UNKNOWN");
  await no({ concerns: "", description: "", contact: "c".repeat(300) }, "REPORT_CONCERNS_INVALID");
  await no({ description: "", contact: "c".repeat(300) }, "REPORT_DESCRIPTION_INVALID");
  /* a body over 16 KiB, read no further; at 16 KiB it is read. */
  const padTo = (size) => { const b = { ...REPORT, pad: "" }; b.pad = "p".repeat(size - JSON.stringify(b).length); return JSON.stringify(b); };
  assert.equal((await call(env, "/report", { method: "POST", raw: padTo(16384), headers: { "content-type": "application/json" }, ip: "203.0.113.200" })).status, 200);
  const big = await call(env, "/report", { method: "POST", raw: padTo(16385), headers: { "content-type": "application/json" }, ip: "203.0.113.201" });
  assert.equal(big.status, 400);
  assert.equal(big.data.code, "REPORT_BODY_TOO_LARGE");
  /* as a form: a page with the reference and the reply line. */
  const form = await call(env, "/report", { method: "POST", form: { ...REPORT }, json: false, ip: "203.0.113.202" });
  assert.equal(form.status, 200);
  const ref = /id="ref">([^<]+)</.exec(form.text)[1];
  assert.ok(form.text.includes(esc(RECEIVED.withContact)), "a reply only by the contact given");
  assert.ok(!form.text.includes(esc(RECEIVED.withoutContact)));
  /* stored: the four fields and the received time, nothing else of the request. */
  const row = env.STORE.db.prepare("SELECT * FROM reports WHERE ref = ?").get(ref);
  assert.deepEqual(Object.keys(row).sort(), ["concerns", "contact", "description", "kind", "latest_act", "received", "ref", "state"]);
  assert.equal(row.contact, REPORT.contact);
  const dump = JSON.stringify(env.STORE.db.prepare("SELECT * FROM reports").all()) + JSON.stringify(env.STORE.db.prepare("SELECT * FROM counts").all());
  assert.ok(!dump.includes("203.0.113."), "no address stored");
  assert.ok(!dump.includes("Mozilla") && !dump.includes(ORIGIN));
  /* no account, sign-in or cookie needed; none set. */
  const plain = await report(env, {}, { ip: "203.0.113.203", origin: null });
  assert.equal(plain.status, 200);
  assert.equal(plain.headers.get("set-cookie"), null);
  assert.match(plain.data.ref, /^r-[a-z2-9]{16}$/);
});

test("R4: 5 per source per hour, 20 per day, 200 for the service per day, 1,000 undecided, failing closed; no address, fingerprint or count shown or logged", async () => {
  clk = clock();
  const env = makeEnv();
  for (let i = 0; i < 5; i++) assert.equal((await report(env, {}, { ip: "192.0.2.1" })).status, 200);
  const sixth = await report(env, {}, { ip: "192.0.2.1" });
  assert.equal(sixth.status, 429);
  assert.equal(sixth.data.code, "REPORT_RATE_LIMITED");
  assert.ok(Number.isInteger(sixth.data.retryAfter) && sixth.data.retryAfter > 0 && sixth.data.retryAfter <= 3600 + 600);
  assert.equal(reportsIn(env), 5);
  assert.equal(env.sent.length, 5);
  assert.equal((await report(env, {}, { ip: "192.0.2.2" })).status, 200, "another source is accepted");
  /* after retryAfter the source may send again */
  clk.tick(sixth.data.retryAfter * 1000);
  assert.equal((await report(env, {}, { ip: "192.0.2.1" })).status, 200);
  /* no stated address: one shared source */
  const env2 = makeEnv();
  for (let i = 0; i < 5; i++) assert.equal((await report(env2, {}, { ip: null })).status, 200);
  assert.equal((await report(env2, {}, { ip: null })).status, 429);
  /* the day: 20 per source in any day */
  const env3 = makeEnv();
  let accepted = 0;
  for (let h = 0; h < 30; h++) {
    for (let i = 0; i < 5; i++) if ((await report(env3, {}, { ip: "192.0.2.3" })).status === 200) accepted++;
    clk.tick(HOUR);
    if (h < 23) assert.ok(accepted <= 20);
  }
  const rows = env3.STORE.db.prepare("SELECT received FROM reports ORDER BY received").all().map((r) => r.received);
  for (let i = 0; i + 20 < rows.length; i++) assert.ok(rows[i + 20] - rows[i] > DAY, "never 21 in any day");
  for (let i = 0; i + 5 < rows.length; i++) assert.ok(rows[i + 5] - rows[i] > HOUR, "never 6 in any hour");
  /* the service: 200 in any day */
  const env4 = makeEnv();
  let ok = 0;
  for (let i = 0; i < 205; i++) { const r = await report(env4, {}, { ip: `10.0.${i >> 8}.${i & 255}` }); if (r.status === 200) ok++; else assert.equal(r.data.code, "REPORT_RATE_LIMITED"); }
  assert.equal(ok, 200);
  /* counts dropped once their window passes */
  clk.tick(2 * DAY);
  await report(env4, {}, { ip: "10.9.9.9" });
  assert.equal(env4.STORE.db.prepare("SELECT COUNT(*) AS n FROM counts WHERE bucket < ?").get(Math.floor((Date.now() - DAY) / HOUR) - 1).n, 0);
  /* 1,000 undecided: INTAKE_FULL, storing nothing */
  const env5 = makeEnv();
  const ins = env5.STORE.db.prepare("INSERT INTO reports (ref, kind, concerns, description, contact, received, latest_act, state) VALUES (?, 'other', 'abc', 'x', NULL, 0, NULL, 'undecided')");
  for (let i = 0; i < 999; i++) ins.run(`r-fill${i}`);
  assert.equal((await report(env5, {}, { ip: "10.1.1.1" })).status, 200);
  const full = await report(env5, {}, { ip: "10.1.1.2" });
  assert.equal(full.status, 503);
  assert.equal(full.data.code, "INTAKE_FULL");
  assert.equal(reportsIn(env5), 1000);
  /* a count that cannot be read or written refuses the report */
  const env6 = makeEnv({ STORE: makeStore({ broken: true }) });
  const closed = await report(env6, {}, { ip: "10.1.1.3" });
  assert.equal(closed.status, 503);
  assert.equal(closed.data.code, "INTAKE_UNAVAILABLE");
  assert.equal(env6.sent.length, 0);
  /* nothing shows or logs an address, fingerprint or count */
  const fps = env3.STORE.db.prepare("SELECT DISTINCT source FROM counts").all().map((r) => r.source).filter((s) => s !== "*");
  const out = SEEN.join("\n") + LOGS.join("\n");
  for (const s of ["192.0.2.1", "192.0.2.3", "10.1.1.3", ...fps]) assert.ok(!out.includes(s), s);
  assert.deepEqual(Object.keys(env3.STORE.db.prepare("SELECT * FROM counts LIMIT 1").get()).sort(), ["bucket", "n", "scope", "source"]);
});

test("R5: the open page's notice says what a report is for, the stewards' limits, the contact, what is kept and for how long, the address, no legal advice, and who is responsible", async () => {
  const env = makeEnv({ REPORT_RETENTION_DAYS: "365", CONTACT_RETENTION_DAYS: "90" });
  const { text, status } = await call(env, "/", { json: false });
  assert.equal(status, 200);
  const notice = text.slice(text.indexOf('id="notice"'), text.indexOf("<form"));
  assert.ok(text.indexOf('id="notice"') < text.indexOf("<form"), "the notice is before the form");
  /* each of the notice's seven sentences, in order: what a report is for, the stewards' limits, the contact, what is kept
     and for how long (as numbers), the address, no legal advice, who is responsible. */
  const sentences = noticeSentences({ contactDays: 90, reportDays: 365 });
  assert.equal(sentences.length, 7);
  const mail = `<a href="mailto:${esc(ADDRESS)}">${esc(ADDRESS)}</a>`;
  let at = 0;
  for (const x of sentences) {
    const shown = esc(x).replace("\u0001", () => mail);
    const i = notice.indexOf(shown, at);
    assert.ok(i >= at, `a notice sentence is missing or out of order: ${x.slice(0, 20)}`);
    at = i + shown.length;
  }
  assert.ok(sentences[3].includes("90") && sentences[3].includes("365"), "the periods as numbers");
  assert.ok(sentences[3].includes(STEWARDS) && sentences.at(-1) === RESPONSIBLE);
  assert.ok(sentences[4].includes("\u0001"), "the address sentence holds the address's place");
  for (const s of [ALICE.name, BOB.name]) assert.ok(!text.includes(s));
});

test("R6: any other path or method answers 404 or 405 with a plain page", async () => {
  const env = makeEnv();
  for (const p of ["/nope", "/report/x", "/admin", "/steward/other", "/.env"]) {
    const r = await call(env, p, { json: false });
    assert.equal(r.status, 404, p);
    assert.match(r.headers.get("content-type"), /text\/html/);
  }
  for (const [m, p] of [["POST", "/"], ["GET", "/report"], ["PUT", "/report"], ["DELETE", "/guide"], ["POST", "/withdrawals"], ["GET", "/steward/decide"], ["GET", "/steward/signin"]]) {
    const r = await call(env, p, { method: m, json: false, raw: m === "GET" ? undefined : "" });
    assert.equal(r.status, 405, `${m} ${p}`);
    assert.doesNotMatch(r.text, /<script/);
  }
});

test.todo("R7 (T46 amendment, not yet met: T47): the shared guide words are read from newgroup/README.md's third part, once installer R48 writes it (waits on the stewards' address Bob names, K2799, K2878); until then the interim copy stewards/guide.md stands");

test("R7: /guide serves the shared guide words byte for byte as stewards/guide.md, then what this service holds and who could be compelled, and no legal advice", async () => {
  const shared = readFileSync(join(ROOT, "guide.md"), "utf8");
  assert.equal(GUIDE_TEXT, shared);
  for (const env of [makeEnv(), makeEnv({ STEWARDS_ADDRESS: undefined })]) {
    const { text, status } = await call(env, "/guide", { json: false });
    assert.equal(status, 200);
    const section = /<section id="guide">([\s\S]*?)<\/section>/.exec(text)[1];
    const unesc = (s) => s.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    const words = [...section.matchAll(/<(h1|p)>([\s\S]*?)<\/\1>/g)].map((m) => unesc(m[2])).join("\n\n") + "\n";
    assert.equal(words, shared, "byte for byte");
    const service = /<section id="service">([\s\S]*?)<\/section>/.exec(text)[1];
    const [heading, ...second] = SERVICE_HOLDS;
    assert.equal(second.length, 3);
    assert.ok(service.includes(`<h2>${esc(heading)}</h2>${second.map((x) => `<p>${esc(x)}</p>`).join("")}`), "what this service holds, who could be compelled, no legal advice");
    assert.ok(text.indexOf('id="guide"') < text.indexOf('id="service"'));
  }
  /* the shared words are the guide's five paragraphs, heading first, and nothing else. */
  assert.equal(GUIDE_PARAGRAPHS.length, 5);
  assert.equal(`${GUIDE_PARAGRAPHS.join("\n\n")}\n`, shared);
});

test("R8: sign-in by name and key in the body sets a 12-hour HttpOnly, Secure, SameSite=Strict cookie on /steward; any wrong pair is one answer; 5 refusals per 15 minutes then limited even for a right key", async () => {
  clk = clock();
  const env = makeEnv();
  const ok = await signIn(env);
  assert.equal(ok.status, 200);
  for (const part of ["HttpOnly", "Secure", "SameSite=Strict", "Path=/steward", "Max-Age=43200"]) assert.ok(ok.set.includes(part), part);
  assert.match(ok.value, /^[0-9a-f]{64}$/);
  assert.equal((await call(env, "/steward/reports", { cookie: ok.cookie })).status, 200);
  clk.tick(12 * HOUR - 1000);
  assert.equal((await call(env, "/steward/reports", { cookie: ok.cookie })).status, 200);
  clk.tick(1000);
  assert.equal((await call(env, "/steward/reports", { cookie: ok.cookie })).status, 401, "ends 12 hours after sign-in");
  /* sign-out ends it */
  const s2 = await signIn(env);
  assert.equal((await call(env, "/steward/signout", { method: "POST", body: {}, cookie: s2.cookie })).status, 200);
  assert.equal((await call(env, "/steward/reports", { cookie: s2.cookie })).status, 401);
  /* wrong name, wrong key: the same answer */
  const a = await signIn(env, { name: "Nobody", key: ALICE.key }, { ip: "192.0.2.50" });
  const b = await signIn(env, { name: ALICE.name, key: "wrong" }, { ip: "192.0.2.51" });
  const c = await signIn(env, { name: ALICE.name, key: "" }, { ip: "192.0.2.52" });
  for (const r of [a, b, c]) { assert.equal(r.status, 401); assert.equal(r.data.code, "STEWARD_SIGNIN_REFUSED"); assert.equal(r.set, ""); }
  assert.deepEqual(a.data, b.data);
  /* the limit */
  for (let i = 0; i < 4; i++) assert.equal((await signIn(env, { name: "x", key: "y" }, { ip: "192.0.2.60" })).status, 401);
  assert.equal((await signIn(env, { name: "x", key: "y" }, { ip: "192.0.2.60" })).status, 401, "the fifth refusal");
  const limited = await signIn(env, ALICE, { ip: "192.0.2.60" });
  assert.equal(limited.status, 429);
  assert.equal(limited.data.code, "STEWARD_SIGNIN_LIMITED");
  assert.equal(limited.set, "");
  assert.equal((await signIn(env, ALICE, { ip: "192.0.2.61" })).status, 200, "another source signs in");
  clk.tick(limited.data.retryAfter * 1000);
  assert.equal((await signIn(env, ALICE, { ip: "192.0.2.60" })).status, 200, "after the window");
});

test("R9: no key or session in an address; cookie only; cross-origin state changes refused; a sentinel key and session appear in no output", async () => {
  const env = makeEnv();
  const s = await signIn(env);
  const before = env.STORE.calls.length;
  for (const p of [`/steward/signin?key=${ALICE.key}`, `/steward/reports?session=${s.value}`, `/steward?name=x`, `/steward/report/r-x?token=1`, "/steward/withdrawals?a"]) {
    for (const method of ["GET", "POST"]) {
      const r = await call(env, p, { method, body: method === "POST" ? { name: ALICE.name, key: ALICE.key } : undefined, cookie: s.cookie });
      assert.equal(r.status, 400, `${method} ${p}`);
      assert.equal(r.data.code, "CREDENTIAL_IN_ADDRESS");
    }
  }
  assert.equal(env.STORE.calls.length, before, "reading nothing");
  /* session from a header other than the cookie, or from the body, is not read */
  assert.equal((await call(env, "/steward/reports", { headers: { authorization: `Bearer ${s.value}` } })).status, 401);
  assert.equal((await call(env, "/steward/decide", { method: "POST", body: { session: s.value, ref: "r-x", decision: "dismiss", reason: "x" } })).status, 401);
  /* Origin */
  const ref = (await report(env)).data.ref;
  for (const origin of [null, "https://evil.example"]) {
    const r = await call(env, "/steward/decide", { method: "POST", body: { ref, decision: "dismiss", reason: "x" }, cookie: s.cookie, origin });
    assert.equal(r.status, 403);
    assert.equal(r.data.code, "ORIGIN_REFUSED");
    assert.equal((await call(env, "/steward/signin", { method: "POST", body: ALICE, origin })).status, 403);
  }
  assert.equal(env.STORE.db.prepare("SELECT COUNT(*) AS n FROM decisions").get().n, 0);
  /* the sentinels: the key, the session value, and their hashes in no page, log, error text or notification */
  const out = SEEN.join("\n") + LOGS.join("\n") + env.sent.map((m) => m.raw).join("\n");
  for (const secret of [ALICE.key, BOB.key, shaHex(ALICE.key), shaHex(BOB.key), shaHex(s.value)])
    assert.ok(!out.includes(secret), "a credential leaked");
  const withoutCookies = SEEN.map((x) => x.replace(/^set-cookie: .*$/gm, "")).join("\n") + LOGS.join("\n");
  assert.ok(!withoutCookies.includes(s.value), "the session appears only in its own Set-Cookie");
});

test("R10: STEWARD_KEYS is name:sha256 lines; the key is never held; acts record the name; a removed steward cannot sign in and her sessions end at next use", async () => {
  const env = makeEnv();
  const s = await signIn(env, BOB);
  const ref = (await report(env)).data.ref;
  const d = await decide(env, s.cookie, { ref, decision: "dismiss", reason: "not abuse" });
  assert.equal(d.status, 200);
  assert.equal(env.STORE.db.prepare("SELECT steward FROM decisions").get().steward, BOB.name);
  const dump = JSON.stringify(Object.fromEntries(["reports", "decisions", "sessions", "counts", "withdrawals"].map((t) => [t, env.STORE.db.prepare(`SELECT * FROM ${t}`).all()])));
  assert.ok(!dump.includes(BOB.key) && !dump.includes(ALICE.key));
  env.STEWARD_KEYS = `${ALICE.name}:${shaHex(ALICE.key)}`;
  assert.equal((await call(env, "/steward/reports", { cookie: s.cookie })).status, 401);
  assert.equal(env.STORE.db.prepare("SELECT COUNT(*) AS n FROM sessions").get().n, 0);
  env.STEWARD_KEYS = `${ALICE.name}:${shaHex(ALICE.key)}\n${BOB.name}:${shaHex(BOB.key)}`;
  assert.equal((await call(env, "/steward/reports", { cookie: s.cookie })).status, 401, "the ended session stays ended");
  env.STEWARD_KEYS = `${ALICE.name}:${shaHex(ALICE.key)}`;
  assert.equal((await signIn(env, BOB, { ip: "192.0.2.70" })).status, 401);
  /* names: 1 to 64 printable characters */
  const n64 = "n".repeat(64), k = keyOf();
  const env2 = makeEnv({ STEWARD_KEYS: `${n64}:${shaHex(k)}` });
  assert.equal((await signIn(env2, { name: n64, key: k })).status, 200);
  assert.equal((await report(makeEnv({ STEWARD_KEYS: `${"n".repeat(65)}:${shaHex(k)}` }))).data.code, "NOT_YET_OPEN");
  assert.equal((await report(makeEnv({ STEWARD_KEYS: `bad\u0007name:${shaHex(k)}` }))).data.code, "NOT_YET_OPEN");
});

test("R11: only a steward reads reports: newest first, 100 a page, with state; one with description, contact and decisions; unknown ref NO_SUCH_REPORT; nothing outside /steward/ reads one", async () => {
  clk = clock();
  const env = makeEnv();
  const refs = [];
  for (let i = 0; i < 205; i++) { refs.push((await report(env, { description: `d${i}` }, { ip: `10.2.${i >> 8}.${i & 255}` })).data.ref); clk.tick(1000); if (i % 150 === 149) clk.tick(2 * DAY); }
  assert.equal(refs.length, 205);
  for (const p of ["/steward/reports", `/steward/report/${refs[0]}`, "/steward/reports/2"]) {
    const r = await call(env, p);
    assert.equal(r.status, 401);
    assert.equal(r.data.code, "STEWARD_SESSION_REQUIRED");
  }
  const s = await signIn(env);
  const p1 = await call(env, "/steward/reports", { cookie: s.cookie });
  assert.equal(p1.data.reports.length, 100);
  assert.equal(p1.data.reports[0].ref, refs[204]);
  assert.deepEqual(Object.keys(p1.data.reports[0]).sort(), ["concerns", "kind", "received", "ref", "state"]);
  assert.equal(p1.data.reports[0].state, "undecided");
  assert.ok(p1.data.more);
  const p3 = await call(env, "/steward/reports/3", { cookie: s.cookie });
  assert.equal(p3.data.reports.length, 5);
  assert.equal(p3.data.reports.at(-1).ref, refs[0]);
  assert.equal(p3.data.more, false);
  const one = await call(env, `/steward/report/${refs[3]}`, { cookie: s.cookie });
  assert.equal(one.data.report.description, "d3");
  assert.equal(one.data.report.contact, REPORT.contact);
  assert.deepEqual(one.data.decisions, []);
  await decide(env, s.cookie, { ref: refs[3], decision: "dismiss", reason: "r" });
  const two = await call(env, `/steward/report/${refs[3]}`, { cookie: s.cookie });
  assert.equal(two.data.report.state, "dismissed");
  assert.equal(two.data.decisions[0].steward, ALICE.name);
  const html = await call(env, `/steward/report/${refs[3]}`, { cookie: s.cookie, json: false });
  assert.match(html.text, /d3/);
  const none = await call(env, "/steward/report/r-nosuchthing", { cookie: s.cookie });
  assert.equal(none.status, 404);
  assert.equal(none.data.code, "NO_SUCH_REPORT");
  /* outside /steward/: no description, ref or count */
  for (const p of ["/", "/guide", "/withdrawals"]) {
    const r = await call(env, p, { json: false });
    assert.ok(!r.text.includes("d3") && !refs.some((x) => r.text.includes(x)), p);
  }
});

test("R12: decisions dismiss or withdraw a shared service, with a reason; refusals in order writing nothing; appended, a later one is the state; already withdrawn", async () => {
  const env = makeEnv();
  const s = await signIn(env);
  const ref = (await report(env)).data.ref, ref2 = (await report(env, {}, { ip: "192.0.2.9" })).data.ref;
  const count = () => env.STORE.db.prepare("SELECT COUNT(*) AS n FROM decisions").get().n + env.STORE.db.prepare("SELECT COUNT(*) AS n FROM withdrawals").get().n;
  const refused = async (body, code, cookie = s.cookie) => { const r = await decide(env, cookie, body); assert.equal(r.data.code, code, JSON.stringify(body)); assert.equal(count(), 0); };
  await refused({ ref, decision: "dismiss", reason: "r" }, "STEWARD_SESSION_REQUIRED", null);
  await refused({ ref: "r-none", decision: "nope", reason: "" }, "NO_SUCH_REPORT");
  await refused({ ref, decision: "delete", reason: "" }, "DECISION_UNKNOWN");
  await refused({ ref, decision: "edit", reason: "r" }, "DECISION_UNKNOWN");
  await refused({ ref, decision: "dismiss", reason: "" }, "NO_REASON");
  await refused({ ref, decision: "dismiss", reason: "x".repeat(4001) }, "NO_REASON");
  await refused({ ref, decision: "withdraw", reason: "r" }, "WITHDRAW_TARGET_INVALID");
  for (const service of ["record", "bundle", "group", "member", "instance", "plane", "shared_profiles", ""])
    await refused({ ref, decision: "withdraw", reason: "r", withdraw: { service, item: "x" } }, "WITHDRAW_TARGET_INVALID");
  await refused({ ref, decision: "withdraw", reason: "r", withdraw: { service: "shared_profile", item: "" } }, "WITHDRAW_TARGET_INVALID");
  await refused({ ref, decision: "withdraw", reason: "r", withdraw: { service: "shared_profile", item: "i".repeat(513) } }, "WITHDRAW_TARGET_INVALID");
  assert.deepEqual([...W.DECISIONS], ["dismiss", "withdraw"]);
  assert.deepEqual([...W.SHARED_SERVICES], ["shared_profile", "template_library", "public_listing"]);
  /* accepted, at the caps */
  const d1 = await decide(env, s.cookie, { ref, decision: "dismiss", reason: "x".repeat(4000) });
  assert.equal(d1.status, 200);
  for (const service of W.SHARED_SERVICES) {
    const w = await decide(env, s.cookie, { ref, decision: "withdraw", reason: "fabricated", withdraw: { service, item: "i".repeat(512), ...(service === "public_listing" ? { rule_part: "3" } : {}) } });
    assert.equal(w.data.already, false);
  }
  const again = await decide(env, s.cookie, { ref: ref2, decision: "withdraw", reason: "same", withdraw: { service: "shared_profile", item: "i".repeat(512) } });
  assert.equal(again.status, 200);
  assert.equal(again.data.already, true);
  const one = (await call(env, `/steward/report/${ref}`, { cookie: s.cookie })).data;
  assert.equal(one.report.state, "withdrawn");
  assert.equal(one.decisions.length, 4);
  assert.equal(one.decisions[0].reason, "x".repeat(4000), "never edited");
  const d2 = await decide(env, s.cookie, { ref, decision: "dismiss", reason: "on reflection" });
  assert.equal(d2.status, 200);
  assert.equal((await call(env, `/steward/report/${ref}`, { cookie: s.cookie })).data.report.state, "dismissed");
  assert.equal(env.STORE.db.prepare("SELECT COUNT(*) AS n FROM withdrawals").get().n, 3);
  /* as a form, with withdraw_service and withdraw_item */
  const f = await call(env, "/steward/decide", { method: "POST", form: { ref: ref2, decision: "withdraw", reason: "form", withdraw_service: "public_listing", withdraw_item: "listing-9", withdraw_rule_part: "1" }, cookie: s.cookie, json: false });
  assert.equal(f.status, 303);
  assert.ok(env.STORE.db.prepare("SELECT 1 FROM withdrawals WHERE item = 'listing-9'").get());
});

test("R13: the register; reinstate with a reason ends a standing withdrawal (NO_REASON, NOT_WITHDRAWN); canonical JSON with its digest, no report detail", async () => {
  const env = makeEnv();
  const s = await signIn(env);
  const ref = (await report(env)).data.ref;
  await decide(env, s.cookie, { ref, decision: "withdraw", reason: "secret reason", withdraw: { service: "template_library", item: "tpl-7" } });
  const reg = await call(env, "/steward/withdrawals", { cookie: s.cookie });
  assert.equal(reg.status, 200);
  const { register, sha256 } = reg.data;
  assert.equal(register.length, 1);
  assert.deepEqual(Object.keys(register[0]).sort(), ["item", "kind", "ref", "service", "since"]);
  assert.equal(register[0].ref, ref);
  const canon = JSON.stringify(register.map((r) => Object.fromEntries(Object.keys(r).sort().map((k) => [k, r[k]]))));
  assert.equal(sha256, shaHex(canon));
  assert.equal(reg.text, `{"register":${canon},"sha256":"${sha256}"}`);
  for (const x of [REPORT.description, REPORT.contact, REPORT.concerns, "secret reason", ALICE.name]) assert.ok(!reg.text.includes(x));
  assert.equal((await call(env, "/steward/withdrawals")).status, 401);
  const re = (body) => call(env, "/steward/reinstate", { method: "POST", body, cookie: s.cookie });
  assert.equal((await re({ service: "template_library", item: "tpl-7", reason: "" })).data.code, "NO_REASON");
  assert.equal((await re({ service: "template_library", item: "tpl-8", reason: "r" })).data.code, "NOT_WITHDRAWN");
  assert.equal((await re({ service: "record", item: "tpl-7", reason: "r" })).data.code, "NOT_WITHDRAWN");
  const ok = await re({ service: "template_library", item: "tpl-7", reason: "restored" });
  assert.equal(ok.status, 200);
  assert.equal((await call(env, "/steward/withdrawals", { cookie: s.cookie })).data.register.length, 0);
  const ds = (await call(env, `/steward/report/${ref}`, { cookie: s.cookie })).data.decisions;
  assert.deepEqual(ds.map((d) => d.decision), ["withdraw", "reinstate"]);
  assert.equal(ds[1].steward, ALICE.name);
  assert.equal((await re({ service: "template_library", item: "tpl-7", reason: "again" })).data.code, "NOT_WITHDRAWN");
});

test("R14: one notice to the stewards' address per accepted report, with ref, kind, time and the stewards' page only; none unset; a failure leaves the answer; nothing to reporters or groups", async () => {
  clk = clock();
  LOGS.length = 0;
  const env = makeEnv();
  const contact = "reporter@example.org";
  const r = await report(env, { contact, description: "UNIQUE-DESCRIPTION", concerns: "https://case.example/c/9" });
  assert.equal(env.sent.length, 1);
  const m = env.sent[0];
  assert.equal(m.to, ADDRESS);
  assert.match(m.raw, new RegExp(`^To: <${ADDRESS}>`, "m"));
  const lines = noticeLines({ ref: r.data.ref, kind: "harassment", received: T0, stewardsPage: `${ORIGIN}/steward` });
  assert.ok(m.raw.endsWith(`\r\n\r\n${lines.join("\r\n")}\r\n`), "the notice's lines, in order, after the headers");
  for (const want of [r.data.ref, KIND_WORDS.harassment, `${ORIGIN}/steward`, when(T0)]) assert.ok(lines.join("\n").includes(want), want);
  assert.ok(m.raw.includes(`Subject: ${localize("stewards.index.notice_subject", "A report has arrived ({ref})", { ref: r.data.ref })}`));
  for (const not of [contact, "UNIQUE-DESCRIPTION", "case.example", "steward_session"]) assert.ok(!m.raw.includes(not), not);
  await report(env, {}, { ip: "192.0.2.8" });
  assert.equal(env.sent.length, 2);
  assert.ok(env.sent.every((x) => x.to === ADDRESS));
  /* refused reports send nothing */
  await report(env, { kind: "x" });
  assert.equal(env.sent.length, 2);
  /* unset address: nothing is sent (the report is refused, R1) */
  const unset = makeEnv({ STEWARDS_ADDRESS: undefined });
  await report(unset);
  assert.equal(unset.sent.length, 0);
  /* a failing binding: the answer is unchanged; logged by ref only */
  const failing = makeEnv({ NOTIFY: { send: async () => { throw new Error(`smtp down ${ADDRESS}`); } } });
  const f = await report(failing, { contact });
  assert.equal(f.status, 200);
  assert.equal(f.data.ok, true);
  const line = LOGS.find((l) => l.includes(f.data.ref));
  assert.ok(line);
  assert.ok(!line.includes(contact) && !line.includes(ADDRESS));
  const nofrom = makeEnv({ NOTIFY_FROM: undefined });
  assert.equal((await report(nofrom)).status, 200);
  assert.equal(nofrom.sent.length, 0);
  assert.deepEqual(OUTBOUND, []);
});

test("R15: the purge erases the contact and deletes the report on time, keeps a standing withdrawal's decision, never an undecided report, logs counts only; the committed periods are 90 and 365", async () => {
  clk = clock();
  const env = makeEnv({ CONTACT_RETENTION_DAYS: "90", REPORT_RETENTION_DAYS: "365" });
  const s = await signIn(env);
  const undecided = (await report(env, {}, { ip: "1.1.1.1" })).data.ref;
  const dismissed = (await report(env, {}, { ip: "1.1.1.2" })).data.ref;
  const withdrawn = (await report(env, {}, { ip: "1.1.1.3" })).data.ref;
  const reinstated = (await report(env, {}, { ip: "1.1.1.4" })).data.ref;
  await decide(env, s.cookie, { ref: dismissed, decision: "dismiss", reason: "r" });
  await decide(env, s.cookie, { ref: withdrawn, decision: "withdraw", reason: "r", withdraw: { service: "shared_profile", item: "p1" } });
  await decide(env, s.cookie, { ref: withdrawn, decision: "dismiss", reason: "second thought, kept standing" });
  await decide(env, s.cookie, { ref: reinstated, decision: "withdraw", reason: "r", withdraw: { service: "public_listing", item: "l1", rule_part: "1" } });
  const purge = async () => { LOGS.length = 0; await worker.scheduled({}, env); return LOGS.join("\n"); };
  const get = async (ref) => { const sess = await signIn(env, ALICE, { ip: "9.9.9.9" }); return call(env, `/steward/report/${ref}`, { cookie: sess.cookie }); };
  clk.tick(89 * DAY);
  await purge();
  assert.equal((await get(dismissed)).data.report.contact, REPORT.contact, "one day before: kept");
  clk.tick(2 * DAY);
  const line = await purge();
  assert.equal((await get(dismissed)).data.report.contact, null, "one day after: erased");
  assert.equal((await get(undecided)).data.report.contact, REPORT.contact, "undecided: never");
  assert.match(line, /erased 3 contacts and deleted 0 reports/);
  for (const r of [undecided, dismissed, withdrawn]) assert.ok(!line.includes(r));
  /* reinstate one at day 200 */
  clk.tick(109 * DAY);
  const sess = await signIn(env, ALICE, { ip: "9.9.9.8" });
  await call(env, "/steward/reinstate", { method: "POST", body: { service: "public_listing", item: "l1", reason: "fixed" }, cookie: sess.cookie });
  clk.tick(164 * DAY); /* day 364 since the decisions */
  await purge();
  assert.equal((await get(dismissed)).status, 200, "one day before: kept");
  clk.tick(2 * DAY);
  const l2 = await purge();
  assert.equal((await get(dismissed)).data.code, "NO_SUCH_REPORT", "one day after: gone");
  assert.match(l2, /deleted 1 reports/);
  const kept = (await get(withdrawn)).data;
  assert.equal(kept.report.description, "");
  assert.equal(kept.report.contact, null);
  assert.deepEqual(kept.decisions.map((d) => d.decision), ["withdraw"], "only the standing withdrawal's decision");
  assert.equal((await call(env, "/withdrawals")).data.length, 1);
  assert.equal((await get(undecided)).status, 200);
  assert.equal((await get(reinstated)).status, 200, "kept until 365 days after its reinstatement");
  clk.tick(200 * DAY);
  await purge();
  assert.equal((await get(reinstated)).data.code, "NO_SUCH_REPORT");
  assert.equal((await get(undecided)).status, 200);
  assert.ok(env.STORE.db.prepare("SELECT COUNT(*) AS n FROM purge_log").get().n >= 5);
  assert.deepEqual(Object.keys(env.STORE.db.prepare("SELECT * FROM purge_log LIMIT 1").get()).sort(), ["at", "contacts_erased", "reports_deleted"]);
  /* either value unset: nothing deleted */
  const env2 = makeEnv({ REPORT_RETENTION_DAYS: undefined });
  env2.STORE.db.prepare("INSERT INTO reports (ref, kind, concerns, description, contact, received, latest_act, state) VALUES ('r-old','other','abc','x','c',0,0,'dismissed')").run();
  await worker.scheduled({}, env2);
  assert.equal(env2.STORE.db.prepare("SELECT contact FROM reports WHERE ref = 'r-old'").get().contact, "c");
  const vars = parseJsonc(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")).vars;
  assert.equal(vars.CONTACT_RETENTION_DAYS, "90");
  assert.equal(vars.REPORT_RETENTION_DAYS, "365");
  assert.ok(parseJsonc(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8")).triggers.crons.length >= 1);
});

const SOURCES = () => readdirSync(join(ROOT, "src")).filter((f) => f.endsWith(".mjs")).map((f) => [f, readFileSync(join(ROOT, "src", f), "utf8")]);

test("R16: exactly the store, the mail binding, variables and two secrets; no outbound fetch but the notice; no route or vocabulary names a record, bundle, member or instance", async () => {
  const cfg = parseJsonc(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
  const BINDING_KEYS = ["durable_objects", "send_email", "vars", "services", "r2_buckets", "kv_namespaces", "d1_databases", "queues", "hyperdrive",
    "vectorize", "ai", "browser", "analytics_engine_datasets", "dispatch_namespaces", "mtls_certificates", "workflows", "secrets_store_secrets",
    "tail_consumers", "containers", "vpc_services", "images", "pipelines", "assets", "unsafe", "version_metadata", "logfwdr", "rate_limits"];
  assert.deepEqual(Object.keys(cfg).filter((k) => BINDING_KEYS.includes(k)).sort(), ["durable_objects", "send_email", "vars"]);
  assert.deepEqual(cfg.durable_objects.bindings, [{ name: "STORE", class_name: "StewardsStore" }]);
  assert.deepEqual(cfg.migrations, [{ tag: "v1", new_sqlite_classes: ["StewardsStore"] }]);
  assert.deepEqual(cfg.send_email.map((b) => b.name), ["NOTIFY"]);
  assert.deepEqual(Object.keys(cfg).sort(), ["$schema", "account_id", "compatibility_date", "durable_objects", "main", "migrations", "name", "observability", "send_email", "triggers", "vars"]);
  for (const v of Object.keys(cfg.vars)) assert.ok(!/TOKEN|KEY|SECRET|PASSWORD/.test(v), v);
  /* the code: no global fetch, no other env binding read */
  const envNames = new Set();
  for (const [f, src] of SOURCES()) {
    assert.ok(!/(^|[^.\w])fetch\s*\(/m.test(src.replace(/async fetch\s*\(/g, "")), `${f}: a global fetch`);
    assert.ok(!/\bconnect\s*\(|WebSocket|XMLHttpRequest/.test(src), f);
    for (const m of src.matchAll(/\benv\.([A-Z_]+)/g)) envNames.add(m[1]);
    for (const m of src.matchAll(/\benv\[/g)) assert.fail(`${f}: a computed binding read`);
  }
  assert.deepEqual([...envNames].sort(), ["CONTACT_RETENTION_DAYS", "LISTING_RULE_TEXT_VERSION", "NOTIFY", "NOTIFY_FROM", "REPORT_RETENTION_DAYS", "SOURCE_KEY", "STEWARDS_ADDRESS", "STEWARD_KEYS", "STORE"]);
  /* behaviour: a full run of every route makes no outbound request */
  const env = makeEnv();
  const s = await signIn(env);
  const ref = (await report(env)).data.ref;
  await decide(env, s.cookie, { ref, decision: "withdraw", reason: "r", withdraw: { service: "shared_profile", item: "p" } });
  for (const p of ["/", "/guide", "/withdrawals"]) await call(env, p);
  await worker.scheduled({}, env);
  assert.deepEqual(OUTBOUND, []);
  /* vocabulary and routes */
  const words = [...W.KINDS, ...W.DECISIONS, ...W.SHARED_SERVICES, ...W.ROUTE_PATHS].join(" ");
  assert.doesNotMatch(words, /record|bundle|member|instance|plane|group/i);
});

test("R17: no group's Civicsmith holds a route or binding to this service, and it reads nothing from one", () => {
  const plane = readFileSync(new URL("../../bio-plane/wrangler.jsonc", import.meta.url), "utf8");
  const pcfg = parseJsonc(plane);
  assert.ok(!JSON.stringify(pcfg.services || []).includes("stewards"));
  assert.ok(!/stewards\.[a-z0-9-]+\.workers\.dev/.test(plane));
  const scan = (dir) => readdirSync(dir, { withFileTypes: true }).flatMap((e) => e.isDirectory() ? scan(join(dir, e.name)) : e.name.endsWith(".mjs") ? [join(dir, e.name)] : []);
  /* The scan reads code: the generated artifacts that embed the word rows hold sentences, not routes or bindings, so they are skipped (rows.mjs, the review list, and case-checker's program.mjs, which embeds the rows, K4149). */
  const NAMES_SERVICE = /stewards\.[a-z0-9-]+\.workers\.dev|\/steward\/|STEWARDS_ADDRESS/;
  const GENERATED = /\/(setup-words\/(rows\.mjs|words-unreviewed\.json)|case-checker\/program\.mjs)$/;
  for (const f of scan(new URL("../../bio-plane/src", import.meta.url).pathname).filter((x) => !GENERATED.test(x)))
    assert.ok(!NAMES_SERVICE.test(readFileSync(f, "utf8")), f);
  /* Controls: a route or a binding naming the service in any other plane source still fails the scan. */
  for (const bad of ['fetch("https://stewards.acct.workers.dev/report")', 'const u = "/steward/reports"', "env.STEWARDS_ADDRESS"]) assert.ok(NAMES_SERVICE.test(bad), bad);
  assert.ok(!GENERATED.test("/x/bio-plane/src/other/rows.mjs") && GENERATED.test("/x/bio-plane/src/setup-words/rows.mjs"));
  assert.ok(!GENERATED.test("/x/bio-plane/src/case-checker/checks.mjs") && GENERATED.test("/x/bio-plane/src/case-checker/program.mjs"));  for (const [f, src] of SOURCES()) {
    assert.ok(!/bio-plane\/src\/(?!setup-fleet\.mjs|setup-words\/index\.mjs)/.test(src), `${f} imports only the slug grammar and the word list from a group's Civicsmith's code`);
  }
});

const PAGES = async () => {
  const env = makeEnv(), closed = makeEnv({ STEWARDS_ADDRESS: undefined });
  const s = await signIn(env);
  const ref = (await report(env, { description: `<script>alert(1)</script>"'&`, concerns: "abc", contact: "<img src=x>" })).data.ref;
  await decide(env, s.cookie, { ref, decision: "withdraw", reason: "<b>r</b>", withdraw: { service: "shared_profile", item: "<i>p</i>" } });
  const out = [];
  for (const [e, p, o] of [[env, "/"], [closed, "/"], [env, "/guide"], [closed, "/guide"], [env, "/withdrawals"], [env, "/nope"], [env, "/steward"],
    [env, "/steward", { cookie: s.cookie }], [env, "/steward/reports", { cookie: s.cookie }], [env, `/steward/report/${ref}`, { cookie: s.cookie }]])
    out.push([p, (await call(e, p, { json: false, ...(o || {}) })).text]);
  out.push(["form", (await call(env, "/report", { method: "POST", form: { ...REPORT }, json: false, ip: "4.4.4.4" })).text]);
  out.push(["refused", (await call(env, "/report", { method: "POST", form: { kind: "x" }, json: false, ip: "4.4.4.5" })).text]);
  return { out, env, s, ref };
};

test("R18: no page names a resource on another origin in any src, href, @import or url()", async () => {
  const { out } = await PAGES();
  for (const [p, text] of out) {
    for (const m of text.matchAll(/\b(?:src|href|action)\s*=\s*"([^"]*)"/g)) assert.ok(/^(\/|mailto:|#)/.test(m[1]) || m[1] === "", `${p}: ${m[1]}`);
    assert.doesNotMatch(text, /@import|url\(/, p);
    assert.doesNotMatch(text, /<script/i, p);
  }
});

test("R19: every page names Civicsmith, says \"a group's Civicsmith\", never copy, instance or plane; Believe in Oakland only as publisher", async () => {
  const { out } = await PAGES();
  const strip = (t) => t.replace(/<style>[\s\S]*?<\/style>/, "").replace(/<[^>]+>/g, " ");
  for (const [p, text] of out) {
    const words = strip(text);
    assert.match(words, /Civicsmith/, p);
    assert.doesNotMatch(words, /\b(instance|instances|plane|server)\b/i, p);
    /* "copy" only in its other meanings (a copy of a document), never as a name for a group's Civicsmith. */
    assert.doesNotMatch(words, /group(&#39;|')s (own )?cop(y|ies)|cop(y|ies) of (your |a )?(group(&#39;|')s )?Civicsmith|Civicsmith cop(y|ies)/i, p);
    const unesc = (x) => x.replace(/&#39;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
    assert.doesNotMatch(unesc(words).split(RESPONSIBLE).join(""), /Believe in Oakland/, `${p}: the publisher is named only inside the responsibility sentence`);
  }
  assert.match(out.find(([p]) => p === "/guide")[1], /your team&#39;s Civicsmith/);
});

test("R20: every text a reporter supplied is escaped wherever shown; no AI; the notice holds no report text", async () => {
  const { out, env } = await PAGES();
  for (const [p, text] of out) for (const raw of ["<script>alert(1)</script>", "<img src=x>", "<b>r</b>", "<i>p</i>"]) assert.ok(!text.includes(raw), `${p}: ${raw}`);
  const detail = out.find(([p]) => p.startsWith("/steward/report/"))[1];
  assert.ok(detail.includes("&lt;script&gt;alert(1)&lt;/script&gt;&quot;&#39;&amp;"));
  assert.ok(detail.includes("&lt;img src=x&gt;"));
  assert.ok(out.find(([p]) => p === "/withdrawals")[1].includes("&lt;i&gt;p&lt;/i&gt;"));
  assert.ok(!env.sent.some((m) => m.raw.includes("alert")));
  for (const [f, src] of SOURCES()) assert.doesNotMatch(src, /\b(env\.AI|anthropic|openai|ai-runs|agent)\b/i, f);
});

test("R21: the configuration pins the project's Cloudflare account", () => {
  const cfg = parseJsonc(readFileSync(join(ROOT, "wrangler.jsonc"), "utf8"));
  assert.equal(cfg.account_id, "20b533579290b9b93168345edd3b7f72");
  assert.equal(W.checkAccount(JSON.stringify(cfg)), null);
  assert.equal(W.checkAccount(JSON.stringify({ ...cfg, account_id: "x" })).name, "account_id");
  assert.equal(W.checkAccount(JSON.stringify({ ...cfg, account_id: undefined })).name, "account_id");
});

test("R22: /withdrawals serves anyone the standing withdrawals {service, item, since, kind}, newest first, page and canonical JSON; reinstated leave; dismissed never show; no report detail", async () => {
  clk = clock();
  const env = makeEnv();
  const s = await signIn(env);
  const a = (await report(env, { kind: "impersonation", description: "DESC-A", contact: "ca@x.example", concerns: "https://c.example/a" }, { ip: "5.5.5.1" })).data.ref;
  const b = (await report(env, { kind: "harassment" }, { ip: "5.5.5.2" })).data.ref;
  const c = (await report(env, { kind: "other" }, { ip: "5.5.5.3" })).data.ref;
  await decide(env, s.cookie, { ref: a, decision: "withdraw", reason: "REASON-A", withdraw: { service: "shared_profile", item: "prof-1" } });
  clk.tick(1000);
  await decide(env, s.cookie, { ref: b, decision: "withdraw", reason: "REASON-B", withdraw: { service: "template_library", item: "tpl-1" } });
  await decide(env, s.cookie, { ref: c, decision: "dismiss", reason: "REASON-C" });
  const j = await call(env, "/withdrawals", { headers: { accept: "application/json" } });
  assert.equal(j.status, 200);
  assert.deepEqual(j.data.map((r) => r.item), ["tpl-1", "prof-1"]);
  assert.deepEqual(j.data[1], { item: "prof-1", kind: "impersonation", service: "shared_profile", since: T0 });
  assert.equal(j.text, JSON.stringify(j.data.map((r) => ({ item: r.item, kind: r.kind, service: r.service, since: r.since }))), "canonical");
  const h = await call(env, "/withdrawals", { json: false });
  assert.match(h.text, /prof-1/);
  assert.ok(h.text.includes(esc(KIND_WORDS.impersonation)));
  for (const t of [j.text, h.text]) for (const x of [a, b, c, "DESC-A", "ca@x.example", "c.example/a", "REASON", ALICE.name]) assert.ok(!t.includes(x), x);
  await call(env, "/steward/reinstate", { method: "POST", body: { service: "shared_profile", item: "prof-1", reason: "ok" }, cookie: s.cookie });
  assert.deepEqual((await call(env, "/withdrawals")).data.map((r) => r.item), ["tpl-1"]);
  assert.equal((await call(makeEnv({ STEWARDS_ADDRESS: undefined }), "/withdrawals")).status, 503, "while open only");
});

test("R23: no page or answer outside /steward/ names a steward; the public pages say Civicsmith's stewards with Believe in Oakland responsible", async () => {
  const env = makeEnv();
  const s = await signIn(env, BOB);
  const ref = (await report(env)).data.ref;
  await decide(env, s.cookie, { ref, decision: "withdraw", reason: "r", withdraw: { service: "public_listing", item: "pl", rule_part: "1" } });
  const pub = [];
  for (const p of ["/", "/guide", "/withdrawals"]) for (const json of [true, false]) pub.push((await call(env, p, { json })).text);
  pub.push((await report(env, {}, { ip: "6.6.6.6" })).text, ...env.sent.map((m) => m.raw));
  for (const t of pub) for (const n of [BOB.name, ALICE.name]) assert.ok(!t.includes(n), n);
  for (const p of ["/", "/guide", "/withdrawals"]) {
    const t = (await call(env, p, { json: false })).text;
    assert.match(t, /Civicsmith&#39;s stewards/);
    assert.ok(t.includes(esc(RESPONSIBLE)), `${p}: who is responsible`);
  }
  assert.ok((await call(env, `/steward/report/${ref}`, { cookie: s.cookie })).text.includes(BOB.name), "shown to a signed-in steward");
});

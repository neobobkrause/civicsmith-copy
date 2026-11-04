/* journey-check F2, F4, F5, F6 (the walk of p3dev-t1 at 0.87.0, 4 Nov): the walk reruns on one development instance against
   pages we control, and fails only what is wrong.
   F2: a handle the store returned as content is a person's name, not a developer slug; a real instance or storage slug is still caught.
   F4: R9's project is titled for its run, so a second walk on one instance is not refused NAME_TAKEN.
   F5: capture by address walks against the Worker <slug>-testpage, whose deploy is held to the product's development account,
       a p3dev- name, no binding, no secret, no route, and no printed token; the walk setup hands its address to the walk, and with
       none the capture is noted as not walked, never passed.
   F6: R5's roles check excuses an act that is a person's own act on her own roster row, as op-declarations declares them. */
import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { pathToFileURL, fileURLToPath } from "node:url";
import { developerWords } from "../../../src/journey-check/design.mjs";
import { Walk, handlesIn } from "../../../src/journey-check/walker.mjs";
import { roleProblems, selfActs, liveCity, CITY_ENV } from "../../../src/journey-check/run.mjs";
import { walkAdministrator, NO_TESTPAGE, PROJECT_BASE, PROJECT_TITLE, projectTitle } from "../../../src/journey-check/investigation.mjs";
import { NOTICE_PATH, NOTICE_HTML, HEAT_PATH, HEAT_HTML } from "../../../src/journey-check/city.mjs";
import { testpageName, testpageSource } from "../../../src/journey-check/testpage/page.mjs";
import { plan, deploy, ACCOUNT, Refused, GUARD_LINE } from "../../../src/journey-check/testpage/deploy.mjs";
import { testpageAddress, walkEnv } from "../../../scripts/p3dev-walk-setup.mjs";

const SRC = fileURLToPath(new URL("../../../src/journey-check/", import.meta.url));
const found = (t, o) => developerWords(t, o).map((w) => `${w.what}: ${w.word}`);

test("F2: a handle the store returned as content is not a slug; control: the same word with no such handle, and the instance's own slug given as a handle, are still caught", () => {
  const text = "Signed in as jmember-4f2a1c. Founder jadmin-09bd3e invited you. Stored in bio-captures-p3dev-t1.";
  const handles = ["jmember-4f2a1c", "jadmin-09bd3e"];
  assert.deepEqual(found(text, { handles, slugs: ["p3dev-t1"] }), ["a slug: bio-captures-p3dev-t1"]);
  /* control: no handle returned, so each is a slug as before */
  assert.deepEqual(found(text, { slugs: ["p3dev-t1"] }), ["a slug: jmember-4f2a1c", "a slug: jadmin-09bd3e", "a slug: bio-captures-p3dev-t1"]);
  /* control: the instance's own short name is caught even when an answer names it as a handle */
  assert.deepEqual(found("Welcome to p3dev-t1", { handles: ["p3dev-t1"], slugs: ["p3dev-t1"] }), ["a slug: p3dev-t1"]);
});

test("F2: the walk keeps the handles the copy's own answers hold, at any depth, and only the copy's", async () => {
  assert.deepEqual(handlesIn({ ok: true, result: { handle: "jadmin-09bd3e", members: [{ handle: "jmember-4f2a1c" }], handles: ["mai-k2"] } }).sort(),
    ["jadmin-09bd3e", "jmember-4f2a1c", "mai-k2"]);
  const dir = mkdtempSync(join(tmpdir(), "jc-f2-"));
  try {
    const walk = new Walk({ out: dir, arm: "live" });
    walk.copyHost = "p3dev-t1.example.workers.dev";
    const handlers = [];
    walk.watch({ on: (ev, cb) => { if (ev === "response") handlers.push(cb); }, url: () => "" });
    const res = (url, body) => ({ url: () => url, status: () => 200, headers: () => ({ "content-type": "application/json" }), text: async () => JSON.stringify(body),
      request: () => ({ method: () => "POST", resourceType: () => "fetch" }) });
    for (const h of handlers) h(res("https://p3dev-t1.example.workers.dev/api/?op=memberlist", { ok: true, result: { members: [{ handle: "jmember-4f2a1c" }] } }));
    for (const h of handlers) h(res("https://elsewhere.example/api/?op=memberlist", { ok: true, result: { members: [{ handle: "outside-1x" }] } }));
    await Promise.all(walk.pending);
    assert.deepEqual([...walk.handles], ["jmember-4f2a1c"]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("F4: R9's project title is unique to the run, so a second walk on one instance starts a project of its own; control: it keeps the journey's title", () => {
  const run = () => execFileSync(process.execPath, ["--input-type=module", "-e",
    `import "${pathToFileURL(join(SRC, "..", "..", "test", "m", "screens-settings", "register.mjs")).href}"; const m = await import("${pathToFileURL(join(SRC, "investigation.mjs")).href}"); process.stdout.write(m.PROJECT_TITLE);`],
  { encoding: "utf8" });
  const first = run();
  const second = run();
  assert.notEqual(first, second, "two runs give two titles");
  assert.ok(first.startsWith(PROJECT_BASE + ", walk ") && second.startsWith(PROJECT_BASE + ", walk "), `${first} | ${second}`);
  assert.ok(PROJECT_TITLE.startsWith(PROJECT_BASE));
  assert.equal(projectTitle("001 002 003"), `${PROJECT_BASE}, walk 001 002 003`);
  /* the run's mark is not itself a developer word on the screen */
  assert.deepEqual(found(PROJECT_TITLE), []);
});

test("F5: the test page serves the walk's two notices at their paths and 404 elsewhere, from one module with no import", async () => {
  const src = testpageSource();
  assert.ok(!/\bimport\b/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "no import");
  const dir = mkdtempSync(join(tmpdir(), "jc-f5-"));
  try {
    const { writeFileSync } = await import("node:fs");
    const f = join(dir, "worker.mjs");
    writeFileSync(f, src);
    const w = (await import(pathToFileURL(f).href)).default;
    const get = (p, method = "GET") => w.fetch(new Request(`https://p3dev-t1-testpage.sub.workers.dev${p}`, { method }));
    const a = await get(NOTICE_PATH);
    assert.equal(a.status, 200);
    assert.match(a.headers.get("content-type"), /^text\/html/);
    assert.equal(await a.text(), NOTICE_HTML);
    assert.equal(await (await get(HEAT_PATH)).text(), HEAT_HTML);
    assert.equal((await get("/elsewhere")).status, 404);
    assert.equal((await get(NOTICE_PATH, "POST")).status, 404);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("F5: the test page's deploy acts in the product's account only, under a p3dev- name, with no binding, and prints no token; --dry-run calls nothing", async () => {
  assert.equal(testpageName("p3dev-t1"), "p3dev-t1-testpage");
  const p = plan("p3dev-t1", { CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "p3dev-t1" });
  assert.equal(p.account, ACCOUNT);
  assert.ok(p.name.startsWith("p3dev-"));
  assert.deepEqual(p.metadata.bindings, []);
  assert.deepEqual(Object.keys(p.metadata).sort(), ["bindings", "compatibility_date", "main_module"]);
  assert.throws(() => plan("p3dev-t1", { CIVICSMITH_TEST_INSTANCE: "p3dev-t1", CF_ACCT: "0123456789abcdef0123456789abcdef" }), (e) => e instanceof Refused && e.code === "WRONG_ACCOUNT");
  assert.throws(() => plan("p3dev-t1", { CIVICSMITH_TEST_INSTANCE: "p3dev-t1", CF_ACCT: ACCOUNT, CLOUDFLARE_ACCOUNT_ID: "0123456789abcdef0123456789abcdef" }), (e) => e.code === "WRONG_ACCOUNT");
  assert.throws(() => plan("p3dev-t1", { CIVICSMITH_TEST_INSTANCE: "p3dev-t2" }), (e) => e.code === "NOT_THE_COPY");
  assert.throws(() => plan("t1", { CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "t1" }), (e) => e.code === "NOT_A_P3DEV_NAME");
  assert.throws(() => plan("Bad Name", {}), (e) => e.code === "NOT_A_P3DEV_NAME");
  assert.throws(() => plan("p3dev-t1", { CF_ACCT: ACCOUNT }), (e) => e.code === "NOT_THE_COPY");
  assert.throws(() => plan("p3dev-t1", { CIVICSMITH_TEST_INSTANCE: "p3dev-t1" }), (e) => e.code === "WRONG_ACCOUNT");
  const calls = [], said = [];
  const token = "tok-" + "x".repeat(30);
  const fetchOf = async (url, init) => { calls.push({ url, method: init.method, body: init.body }); return new Response(JSON.stringify({ success: true }), { status: 200 }); };
  await deploy("p3dev-t1", { env: { CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "p3dev-t1", CF_TOKEN: token }, dryRun: true, fetchOf, log: (l) => said.push(l) });
  assert.equal(calls.length, 0, "a dry run calls nothing");
  await deploy("p3dev-t1", { env: { CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "p3dev-t1", CF_TOKEN: token }, fetchOf, log: (l) => said.push(l) });
  assert.deepEqual(calls.map((c) => `${c.method} ${c.url}`), [
    `PUT https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/p3dev-t1-testpage`,
    `POST https://api.cloudflare.com/client/v4/accounts/${ACCOUNT}/workers/scripts/p3dev-t1-testpage/subdomain`]);
  const meta = JSON.parse(await calls[0].body.get("metadata").text());
  assert.deepEqual(meta.bindings, []);
  assert.ok(!said.join("\n").includes(token), "no token printed");
  await assert.rejects(deploy("p3dev-t1", { env: { CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "p3dev-t1" }, fetchOf }), (e) => e.code === "NO_TOKEN");
});

test("F5: the walk setup hands the test page's address to the walk when it is deployed, and none when it is not", async () => {
  const asked = [];
  const deployed = async (name) => { asked.push(name); return { status: 200 }; };
  assert.equal(await testpageAddress("p3dev-t1", "civic7", deployed), "https://p3dev-t1-testpage.civic7.workers.dev");
  assert.deepEqual(asked, ["p3dev-t1-testpage"]);
  assert.equal(await testpageAddress("p3dev-t1", "civic7", async () => ({ status: 404 })), null);
  const creds = { P3DEV_BOOTSTRAP_TOKEN: "b", JOURNEY_ADMIN_HANDLE: "a", JOURNEY_ADMIN_PASSWORD: "p", JOURNEY_MEMBER_HANDLE: "m", JOURNEY_MEMBER_PASSWORD: "q" };
  assert.equal(walkEnv({}, creds, "https://p3dev-t1-testpage.civic7.workers.dev")[CITY_ENV], "https://p3dev-t1-testpage.civic7.workers.dev");
  assert.equal(walkEnv({ [CITY_ENV]: "https://stale.example" }, creds, null)[CITY_ENV], undefined);
  /* and the walk takes it, and only a page we control */
  assert.deepEqual(liveCity({ [CITY_ENV]: "https://p3dev-t1-testpage.civic7.workers.dev" }), { city: "https://p3dev-t1-testpage.civic7.workers.dev" });
  assert.deepEqual(liveCity({}), { city: null });
  for (const outside of ["https://www.oaklandca.gov", "http://p3dev-x-testpage.civic7.workers.dev", "https://p3dev-x-testpage.evil.example", "https://p3dev-t1.civic7.workers.dev/x"])
    assert.ok(liveCity({ [CITY_ENV]: outside }).problem, outside);
});

test("F5: with no test page, R9's capture by address and the steps resting on it are noted as not walked, never walked or passed; control: with one, step 5 is walked", async () => {
  const stub = () => {
    const w = { labels: [], notes: [], notWalked(n) { this.notes.push(n); }, async step(page, label) { this.labels.push(label); } };
    return w;
  };
  const none = stub();
  await walkAdministrator(none, null, { base: "https://p3dev-t1.civic7.workers.dev", founder: { password: "pw" }, city: null });
  assert.ok(none.notes.includes(NO_TESTPAGE), none.notes.join("\n"));
  assert.ok(!none.labels.some((l) => /^5 · capture by address/.test(l)), none.labels.join("\n"));
  assert.ok(!none.labels.some((l) => /^(?:6|7|8|12) · /.test(l)), none.labels.join("\n"));
  const some = stub();
  await walkAdministrator(some, null, { base: "https://p3dev-t1.civic7.workers.dev", founder: { password: "pw" }, city: "https://p3dev-t1-testpage.civic7.workers.dev" }).catch(() => {});
  assert.ok(some.labels.some((l) => /^5 · capture by address/.test(l)), some.labels.join("\n"));
  assert.ok(!some.notes.includes(NO_TESTPAGE));
});

test("F6: R5 does not fail an act that is the member's own on her own roster row (memberpairingset, read from op-declarations); control: any other act the administrator is not drawn still fails", () => {
  const own = selfActs();
  assert.ok(own.includes("memberpairingset"), own.join(", "));
  const acts = (admin, member) => ({ administrator: new Map(Object.entries(admin)), member: new Map(Object.entries(member)) });
  const founderAndMember = acts({ account: ["setpassword", "signout"], members: ["memberadd"] }, { account: ["memberpairingset", "setpassword", "signout"], members: [] });
  assert.deepEqual(roleProblems(founderAndMember), []);
  /* control: the same walk with an act that is not a person's own */
  const wrong = acts({ account: ["setpassword"], members: ["memberadd"] }, { account: ["memberpairingset", "setpassword", "groupnameset"], members: [] });
  assert.deepEqual(roleProblems(wrong), ["account: the member is drawn groupnameset, the administrator is not"]);
  /* control: the declared set is what excuses it, not the act's name */
  assert.deepEqual(roleProblems(founderAndMember, { own: [] }), ["account: the member is drawn memberpairingset, the administrator is not"]);
  /* control: an administrator drawn nothing the member is not still fails */
  assert.equal(roleProblems(acts({ account: ["signout"] }, { account: ["signout"] })).length, 1);
});

test("F5: the test page's deploy prints `p3dev guard: passed`, alone on its line, once its checks pass, in a dry run and a real one; control: never when a check fails", async () => {
  const DEPLOY = fileURLToPath(new URL("../../../src/journey-check/testpage/deploy.mjs", import.meta.url));
  const run = (env, args = ["--dry-run"]) => { try { return { code: 0, out: execFileSync(process.execPath, [DEPLOY, "p3dev-t1", ...args], { env: { PATH: process.env.PATH, ...env }, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }) }; }
    catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
  const ok = run({ CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "p3dev-t1" });
  assert.equal(ok.code, 0, ok.out);
  assert.equal(ok.out.split("\n").filter((l) => l === GUARD_LINE).length, 1, ok.out);
  assert.equal(GUARD_LINE, "p3dev guard: passed");
  for (const env of [{ CF_ACCT: "0123456789abcdef0123456789abcdef", CIVICSMITH_TEST_INSTANCE: "p3dev-t1" }, { CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "p3dev-t2" }, { CF_ACCT: ACCOUNT }]) {
    const r = run(env);
    assert.notEqual(r.code, 0, r.out);
    assert.ok(!r.out.includes(GUARD_LINE), r.out);
  }
  /* the real run prints it too, before its first call */
  const said = [];
  const fetchOf = async () => new Response(JSON.stringify({ success: true }), { status: 200 });
  await deploy("p3dev-t1", { env: { CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "p3dev-t1", CF_TOKEN: "t".repeat(32) }, fetchOf, log: (l) => said.push(l) });
  assert.equal(said.filter((l) => l === GUARD_LINE).length, 1, said.join("\n"));
  const refused = [];
  await assert.rejects(deploy("p3dev-t1", { env: { CF_ACCT: ACCOUNT, CIVICSMITH_TEST_INSTANCE: "p3dev-t9", CF_TOKEN: "t".repeat(32) }, fetchOf, log: (l) => refused.push(l) }));
  assert.ok(!refused.includes(GUARD_LINE));
});

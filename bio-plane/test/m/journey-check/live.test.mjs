/* journey-check R5, R6: the live arm against a fake plane over HTTP (fake-plane.mjs). R5: it reaches the instance
   directly, signs in as the administrator and as a member, and fails unless `whoami` answers each as that role; each role
   walks every working screen, the administrator drawn the acts only an administrator is. R6: each working screen, at 1280
   and 390 px, is paired with the design mock's drawing of it, and fails on the five limits. The mock is drawn at the
   checkout's own commit, whose `layouts.html` is the registry's (the interface's ASSETS_COMMIT is the release's). */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { spawn, execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { runLive, browser, directFetch } from "../../../src/journey-check/run.mjs";
import { FAIL, Walk } from "../../../src/journey-check/walker.mjs";
import { sweepScreens } from "../../../src/journey-check/screens.mjs";
import { developerWords, assetsCommit, designMock, WIDTHS } from "../../../src/journey-check/design.mjs";
import { fakePlane, PUBLISHED_PATH } from "./fake-plane.mjs";
import { STEP_NAMES, notReady } from "../../../src/journey-check/investigation.mjs";
import { ACTION_BLOCK_NOT_DRAWN } from "../../../src/journey-check/journeys.mjs";
import { NO_PUBLISHED_NOTE } from "../../../src/journey-check/published.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { wordRx } from "../../word-rx.mjs";

const SRC = join(import.meta.dirname, "..", "..", "..", "src", "journey-check");
const COMMIT = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
const ENV = { JOURNEY_ADMIN_HANDLE: "ada", JOURNEY_ADMIN_PASSWORD: "admin-password-x", JOURNEY_MEMBER_HANDLE: "mai", JOURNEY_MEMBER_PASSWORD: "member-password-x" };
const WORKING = sweepScreens().filter((s) => s.frame === "working" || s.frame === "dock");
const only = (...ids) => sweepScreens().filter((s) => ids.includes(s.id));
const kinds = (r) => r.walk.failures.map((f) => f.kind);

let dir;
before(() => { dir = mkdtempSync(join(tmpdir(), "jc-live-")); });
after(() => rmSync(dir, { recursive: true, force: true }));

async function walked(plane, opts = {}) {
  const fp = await fakePlane(plane);
  /* R5 and R6 are the sweeps' own: R12's journeys are walked by their own tests below */
  try { return await runLive({ base: fp.base, env: ENV, out: join(dir, String(Math.random()).slice(2)), commit: COMMIT, investigate: false, ...opts }); }
  finally { await fp.close(); }
}

/* the control of R5 and R6 at once: correct roles, a plane matching its design, every working screen */
let clean = null;
const cleanWalk = async () => (clean ||= await walked({ admins: { ada: true } }));

test("R5 control and R6 control: correct roles pass; each role walks every working screen, each paired with the design mock at 1280 and 390 px", { timeout: 900000 }, async () => {
  const r = await cleanWalk();
  assert.equal(r.ok, true, r.report);
  for (const role of ["administrator", "member"]) {
    const walkedScreens = r.walk.steps.filter((s) => s.journey === `as ${role}` && s.label.startsWith("screen ")).map((s) => s.label.slice(7));
    assert.deepEqual(walkedScreens, WORKING.map((s) => s.id), `the ${role} walked every working screen`);
    for (const s of WORKING) for (const w of WIDTHS) {
      const file = `pairs/${role}-${s.id}-${w}.png`;
      assert.ok(r.walk.pairs.includes(file), file);
      assert.ok(existsSync(join(r.walk.out, file)), file);
    }
  }
  assert.equal(r.walk.pairs.length, WORKING.length * WIDTHS.length * 2);
  assert.ok(r.report.includes(localize("journey-check.walker.length_pairs_live_beside_design", "{length} pairs, LIVE beside DESIGN, for BOB's comparison (R6):", { length: String(r.walk.pairs.length) })), "the pairs are listed for BOB");
  /* the walk keeps secret what is six characters or more (walker.keepSecret): a password; "mai" is a handle, and a word of a screen id */
  for (const v of Object.values(ENV).filter((x) => x.length >= 6)) assert.equal(r.report.includes(v), false, "a credential printed");
});

test("R5: a member credential given as the administrator fails the walk: whoami answers it administer: false", { timeout: 300000 }, async () => {
  const r = await walked({ admins: { ada: true } }, { env: { ...ENV, JOURNEY_ADMIN_HANDLE: "mai" }, screens: only("members") });
  assert.equal(r.ok, false);
  assert.deepEqual(kinds(r), [FAIL.ROLE]);
  assert.match(r.walk.failures[0].detail, /administrator's credential signs in a session whoami answers with administer: false/);
  /* and an administrator given as the member fails as well */
  const swapped = await walked({ admins: { ada: true, mai: true } }, { screens: only("members") });
  assert.deepEqual(kinds(swapped), [FAIL.ROLE]);
  assert.match(swapped.walk.failures[0].detail, /member's credential .* administer: true/);
});

test("R5: an administrator drawn no act the member is not drawn fails the walk (its walk did not administer); control: the clean walk's administrator is drawn memberadd on Members, the member is not", { timeout: 300000 }, async () => {
  const r = await walked({ admins: { ada: true }, adminActs: false }, { screens: only("members", "queue") });
  assert.deepEqual(kinds(r), [FAIL.ROLE]);
  assert.match(r.walk.failures[0].detail, /did not administer/);
  assert.equal((await cleanWalk()).ok, true);
});

test("R5: it reaches the instance directly: an environment proxy sees none of the walk's requests, Node's or Chromium's; control: Node's own fetch and a Chromium launched without it go through that proxy", { timeout: 300000 }, async () => {
  const hits = [];
  const proxy = createServer((req, res) => { hits.push(req.url); res.writeHead(502); res.end(); });
  await new Promise((ok) => proxy.listen(0, "127.0.0.1", ok));
  const fp = await fakePlane({ admins: { ada: true } });
  try {
    const P = `http://127.0.0.1:${proxy.address().port}`;
    /* a host that is not a loopback literal, so Chromium would send it to a proxy; the browser maps it to the fake plane */
    const host = `grp.test:${new URL(fp.base).port}`;
    const child = (direct) => new Promise((done) => {
      const code = `const { runLive, browser, directFetch } = await import(${JSON.stringify(pathToFileURL(join(SRC, "run.mjs")).href)});
const rule = ["--host-resolver-rules=MAP grp.test 127.0.0.1"];
const r = await runLive({ base: "http://${host}", env: ${JSON.stringify(ENV)}, out: ${JSON.stringify(join(dir, "proxy-" + direct))},
  commit: ${JSON.stringify(COMMIT)}, screens: [{ id: "members", frame: "working" }], investigate: false,
  fetchOf: (q) => directFetch(new Request(q.url.replace("grp.test", "127.0.0.1"), q)),
  launch: (o) => browser(${direct} ? { ...o, args: rule } : { args: rule }) });
const viaFetch = await fetch(${JSON.stringify(fp.base)} + "/api/?op=bootstrap").then((x) => x.status, () => "refused");
const viaDirect = await directFetch(new Request(${JSON.stringify(fp.base)} + "/api/?op=bootstrap")).then((x) => x.status);
console.log(JSON.stringify({ ok: r.ok, kinds: r.walk.failures.map((f) => f.kind), viaFetch, viaDirect }));`;
      const c = spawn(process.execPath, ["--input-type=module", "-e", code], { stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, NODE_USE_ENV_PROXY: "1", HTTP_PROXY: P, http_proxy: P, HTTPS_PROXY: P, https_proxy: P, NO_PROXY: "", no_proxy: "" } });
      let out = "", err = "";
      c.stdout.on("data", (d) => (out += d)); c.stderr.on("data", (d) => (err += d));
      c.on("exit", () => { try { done(JSON.parse(out.trim().split("\n").at(-1))); } catch { done({ err }); } });
    });
    const direct = await child(true);
    const directHits = hits.splice(0);
    assert.equal(direct.ok, true, JSON.stringify(direct));
    assert.equal(direct.viaDirect, 200);
    /* control: Node's own fetch follows the environment's proxy */
    assert.deepEqual(directHits, [`${fp.base}/api/?op=bootstrap`], "only the control's own fetch reached the proxy");
    const proxied = await child(false);
    assert.equal(proxied.ok, false, "a Chromium launched without the direct arguments reached the instance through the proxy");
    assert.ok(hits.some((h) => h.startsWith(`http://${host}/`)), JSON.stringify(hits));
  } finally { await fp.close(); proxy.close(); }
});

test("R6: a fixture page that overflows fails, and so does each other limit, on its own screen and width; control: the same plane without the flaw passes (the clean walk)", { timeout: 300000 }, async () => {
  const flaws = { members: "wide", queue: "tabs", home: "class", account: "band", capture: "words" };
  const r = await walked({ admins: { ada: true }, flaws }, { screens: only(...Object.keys(flaws)) });
  const at = (kind) => [...new Set(r.walk.failures.filter((f) => f.kind === kind).map((f) => f.detail.replace(/: .*/, "")))].sort();
  assert.deepEqual(at(FAIL.WIDER), ["members at 1280px", "members at 390px"]);
  assert.deepEqual(at(FAIL.TABS), ["queue at 390px"], "tabs not at the viewport's foot, judged at 390 px only");
  assert.deepEqual(at(FAIL.CLASS), ["home at 1280px", "home at 390px"]);
  assert.deepEqual(at(FAIL.BAND), ["account at 1280px", "account at 390px"]);
  assert.deepEqual(at(FAIL.WORDS), ["capture at 1280px", "capture at 390px"]);
  assert.match(r.walk.failures.find((f) => f.kind === FAIL.WORDS).detail, /a refusal code: NO_CALC/);
  assert.match(r.walk.failures.find((f) => f.kind === FAIL.CLASS).detail, /p\.cs-unstyled: no loaded stylesheet defines the class/);
  assert.equal(r.walk.failures.length, 2 * (2 + 1 + 2 + 2 + 2), r.report);
  assert.equal((await cleanWalk()).ok, true);
});

test("R6: a working screen the design mock does not draw fails; control: one it draws is paired", { timeout: 300000 }, async () => {
  const r = await walked({ admins: { ada: true } }, { screens: [{ id: "no-such-screen", frame: "working" }, ...only("members")] });
  const design = r.walk.failures.filter((f) => f.kind === FAIL.DESIGN).map((f) => f.detail);
  assert.ok(design.length >= 1 && design.every((d) => /^no-such-screen: the design mock at [0-9a-f]+ draws no such screen$/.test(d)), r.report);
  assert.ok(r.walk.pairs.includes("pairs/administrator-members-390.png"));
});

test("R6: each pair is one image, LIVE on the left and DESIGN on the right, the mock read from git at its commit", { timeout: 120000 }, async () => {
  const r = await cleanWalk();
  const png = readFileSync(join(r.walk.out, "pairs/administrator-members-1280.png"));
  const width = png.readUInt32BE(16);
  assert.ok(width > 1280 + 1180, `a pair holds both drawings side by side (${width}px)`);
  /* the mock at a commit is that commit's layouts.html, whatever the working copy holds */
  const b = await browser();
  try {
    const m = await designMock(b, { dir: join(dir, "mock"), commit: COMMIT });
    assert.equal(m.commit, COMMIT);
    assert.ok(readFileSync(join(dir, "mock", `layouts-${COMMIT}.html`)).equals(execFileSync("git", ["show", `${COMMIT}:docs/development/ux-substrate/layouts.html`], { maxBuffer: 64 << 20 })));
    assert.ok(await m.draw("members", 390));
    assert.equal(await m.draw("no-such-screen", 390), null);
    await m.close();
  } finally { await b.close(); }
  /* by default, the interface's ASSETS_COMMIT, a commit git holds */
  assert.match(assetsCommit(), /^[0-9a-f]{7,40}$/);
  assert.equal(execFileSync("git", ["cat-file", "-t", assetsCommit()], { encoding: "utf8" }).trim(), "commit");
});

test("R6: text a person must never read: a slug, a language tag, a record id, a refusal code; control: words, two-part compounds and addresses pass", () => {
  const found = (t, o) => developerWords(t, o).map((w) => `${w.what}: ${w.word}`);
  assert.deepEqual(found("Welcome to believe-in-oakland"), ["a slug: believe-in-oakland"]);
  assert.deepEqual(found("Group biosmoke7", { slugs: ["biosmoke7"] }), ["a slug: biosmoke7"]);
  assert.deepEqual(found("the key display_name"), ["a slug: display_name"]);
  assert.deepEqual(found("Language: en-US"), ["a language tag: en-US"]);
  assert.deepEqual(found("Spanish (es-419) or zh-Hant"), ["a language tag: es-419", "a language tag: zh-Hant"]);
  assert.deepEqual(found("by its record id PROJ-2026-0042"), ["a record id: PROJ-2026-0042"]);
  assert.deepEqual(found("ENT-2026-abcdefghij012345 was linked"), ["a record id: ENT-2026-abcdefghij012345"]);
  assert.deepEqual(found("Could not read this, because NO_CALC"), ["a refusal code: NO_CALC"]);
  /* control */
  assert.deepEqual(found("Sign in, kept signed in. A well-known step-by-step guide. Explain promptly. 0 TO DO. Page 3 of 7. Since 2026-10-14."), []);
  assert.deepEqual(found("Your address: https://believe-in-oakland.civic7.workers.dev/app, or mail ops-team-2@example.org", { slugs: ["believe-in-oakland"] }), []);
  assert.deepEqual(found("biosmoke7s is another word", { slugs: ["biosmoke7"] }), []);
});

/* R12: the live arm walks R9 and R10 through the real sign-in, whose code the person types (`codeOf`). Against the fake
   plane, which draws R9's steps 2 to 4 only, the walk reaches the sign-in and goes no further than the plane draws. */
async function investigated(codeOf, env = ENV) {
  const fp = await fakePlane({ admins: { ada: true }, assistantControls: true });
  try {
    const out = join(dir, String(Math.random()).slice(2));
    const r = await runLive({ base: fp.base, env, out, commit: COMMIT, screens: only("members"), codeOf, assistant: true });
    return { r, fp, printed: r.report + readFileSync(join(out, "report.json"), "utf8") };
  } finally { await fp.close(); }
}

test("R12 (with the assistant working, R20's switch set): with no sign-in completed, step 4 fails by name before any later act", { timeout: 300000 }, async () => {
  const asked = [];
  const { r, fp } = await investigated(async (role, address) => { asked.push([role, new URL(address).host]); return null; });
  const steps = r.walk.steps.filter((s) => s.journey === "R9 as administrator");
  assert.deepEqual(steps.map((s) => s.label.split(" · ")[0]), ["1", "2", "3", "4"], r.report);
  assert.deepEqual(steps.map((s) => s.ok), [true, true, true, false], r.report);
  const f = r.walk.failures.find((x) => x.step && x.step.startsWith("4 · connect"));
  assert.ok(f && /the sign-in was not completed/.test(f.detail), r.report);
  /* the person was asked as the administrator, on Anthropic's own page */
  assert.deepEqual(asked, [["administrator", "claude.ai"]]);
  assert.deepEqual(fp.codes, [], "nothing was sent as a code");
  assert.ok(!r.walk.steps.some((s) => /^(?:[5-9]|1[0-2]) · /.test(s.label)), "no later act");
});

test("R12 control (the switch set): the code the person types connects, and no token or code is in any output", { timeout: 300000 }, async () => {
  const CODE = "sentinel-code-" + "7".repeat(24) + "#state-sentinel";
  /* F5: the walk captures by address only from a test page of ours, which the walk setup names; with one, step 5 is walked */
  const { r, fp, printed } = await investigated(async () => CODE, { ...ENV, JOURNEY_CITY_ORIGIN: "https://p3dev-t1-testpage.civic7.workers.dev" });
  const four = r.walk.steps.find((s) => s.label.startsWith("4 · connect"));
  assert.ok(four && four.ok, r.report);
  assert.deepEqual(fp.codes, [CODE], "the code reached the plane once, as typed");
  assert.equal(printed.includes(CODE), false, "the code printed");
  assert.equal(printed.includes("sentinel-code"), false);
  for (const v of Object.values(ENV).filter((x) => x.length >= 6)) assert.equal(printed.includes(v), false, "a credential printed");
  /* the walk goes on to step 5, which this plane does not draw */
  assert.ok(r.walk.steps.some((s) => s.label.startsWith("5 · ")), r.report);
});

test("R20 (live arm): while the assistant does not work, R9's step 4 and all of R10 are reported as not walked, each with its screen's not-ready state asserted, and no step fails", { timeout: 300000 }, async () => {
  const fp = await fakePlane({ admins: { ada: true } });
  try {
    const out = join(dir, String(Math.random()).slice(2));
    const r = await runLive({ base: fp.base, env: ENV, out, commit: COMMIT, screens: only("members") });
    const ready = r.walk.steps.filter((s) => /^assistant not ready: /.test(s.label));
    assert.ok(ready.length >= 2 && ready.every((s) => s.ok), r.report);
    for (const n of [STEP_NAMES.connect, STEP_NAMES.memberConnect, STEP_NAMES.memberRun, STEP_NAMES.memberProjectai, STEP_NAMES.memberPlan, STEP_NAMES.memberAsk])
      assert.ok(r.walk.notes.includes(localize("journey-check.walker.name_not_walked_the_assistant", "{name}: not walked, the assistant does not work (K3717)", { name: n })), `${n}: ${r.walk.notes.join(" | ")}`);
    assert.ok(!r.walk.steps.some((s) => /^4 · connect/.test(s.label)), "the sign-in was not tried");
    assert.deepEqual(fp.codes, [], "nothing was sent as a code");
    assert.ok(r.walk.pairs.length > 0);
  } finally { await fp.close(); }
});

test("R20 control (live arm): connect's sign-in drawn while the assistant does not work is the assistant's own step (K4086): reported not walked, never failed", { timeout: 300000 }, async () => {
  const fp = await fakePlane({ admins: { ada: true }, assistantControls: true });
  try {
    const r = await runLive({ base: fp.base, env: ENV, out: join(dir, String(Math.random()).slice(2)), commit: COMMIT, screens: only("members") });
    assert.ok(!r.walk.failures.some((f) => /draws an assistant control that cannot work/.test(f.detail)), r.report);
    assert.ok(r.walk.notes.some((n) => n.startsWith(STEP_NAMES.connect)), r.report);
    assert.deepEqual(fp.codes, [], "the sign-in was not tried");
  } finally { await fp.close(); }
});

test("R22 (live arm): both dashboards are walked from Home's doors, drawn and not \"Nothing is here\"; control: a Home with no door, and a dashboard that draws \"Nothing is here\", fail by name", { timeout: 300000 }, async () => {
  const ok = await walked({ admins: { ada: true } }, { screens: only("members", "dash-project", "dash-action") });
  assert.ok(ok.walk.steps.filter((s) => /^dashboard dash-/.test(s.label)).length === 2 && ok.walk.steps.filter((s) => /^dashboard dash-/.test(s.label)).every((s) => s.ok), ok.report);
  assert.equal(ok.ok, true, ok.report);
  const none = await walked({ admins: { ada: true }, doors: false }, { screens: only("members") });
  assert.ok(none.walk.failures.some((f) => /Home draws no door to dash-project/.test(f.detail)), none.report);
  /* DEC-219 (3), K4146: a team holding no action has no Action block on Home; the walk notes it and opens dash-action by its address */
  const noAction = await walked({ admins: { ada: true }, doors: "project" }, { screens: only("members", "dash-project", "dash-action") });
  assert.equal(noAction.ok, true, noAction.report);
  assert.ok(noAction.walk.notes.includes(ACTION_BLOCK_NOT_DRAWN), noAction.report);
  assert.ok(noAction.walk.steps.filter((s) => /^dashboard dash-/.test(s.label)).length === 2 && noAction.walk.steps.filter((s) => /^dashboard dash-/.test(s.label)).every((s) => s.ok), noAction.report);
  assert.ok(!ok.walk.notes.includes(ACTION_BLOCK_NOT_DRAWN), "a Home that draws the Action block is not noted");
  /* control: an Action block drawn without its door is a fault, and is not excused by the address */
  const blockOnly = await walked({ admins: { ada: true }, doors: "blockonly" }, { screens: only("members") });
  assert.ok(blockOnly.walk.failures.some((f) => /Home draws the Action block without a door to dash-action/.test(f.detail)), blockOnly.report);
  const nothing = await walked({ admins: { ada: true }, dashNothing: true }, { screens: only("members") });
  assert.ok(nothing.walk.failures.some((f) => /dash-project draws "Nothing is here"/.test(f.detail)), nothing.report);
});

test("R25 (live arm): /sign answers 404 with the nothing-is-here page; control: a /sign that answers a form fails by name", { timeout: 300000 }, async () => {
  const ok = await walked({ admins: { ada: true } }, { screens: only("members") });
  const sign = ok.walk.steps.find((s) => /^sign: \/sign/.test(s.label));
  assert.ok(sign && sign.ok, ok.report);
  const bad = await walked({ admins: { ada: true }, signPage: true }, { screens: only("members") });
  assert.ok(bad.walk.failures.some((f) => /\/sign does not answer the interface's nothing-is-here page|\/sign holds a signing page/.test(f.detail)), bad.report);
});

test("R28 (live arm): a screen whose tab title is not the word of its screen fails by name; control: the clean walk passes the titles", { timeout: 300000 }, async () => {
  assert.equal((await cleanWalk()).walk.failures.filter((f) => f.kind === FAIL.DEC340).length, 0);
  const walk = (await cleanWalk()).walk;
  assert.ok(walk.steps.some((s) => s.journey === "R28 the public pages"), "the public pages are walked signed out");
});

test("R24 (live arm): the published case the environment names is walked signed out at both widths, a minimum set, a finding opened, Print the case pressed, and no request carries an Authorization header; control: with none named the note is written and nothing is walked", { timeout: 300000 }, async () => {
  const fp = await fakePlane({ admins: { ada: true }, published: true });
  try {
    const out = join(dir, String(Math.random()).slice(2));
    const r = await runLive({ base: fp.base, env: { ...ENV, JOURNEY_PUBLISHED_CASE: PUBLISHED_PATH }, out, commit: COMMIT, screens: only("members"), investigate: false });
    assert.deepEqual(r.walk.failures.filter((f) => /published/.test(f.step || "") || /published/.test(f.detail)), [], r.report);
    for (const w of WIDTHS) assert.ok(r.walk.pairs.includes(`pairs/published-${w}.png`), `pairs/published-${w}.png`);
    assert.ok(r.walk.steps.some((s) => wordRx("act.owed_pubprint.label.published").test(s.label) && s.ok), r.report);
    assert.ok(!r.walk.notes.includes(NO_PUBLISHED_NOTE));
    /* the arm signed in and swept as a person does, and the published case was opened with no session at all: the requests for it carry no credential */
    const forCase = fp.seen.filter((x) => x.includes(PUBLISHED_PATH));
    assert.ok(forCase.length >= 4 && forCase.every((x) => !/ AUTH$/.test(x)), JSON.stringify(forCase));
    const none = await runLive({ base: fp.base, env: ENV, out: join(dir, String(Math.random()).slice(2)), commit: COMMIT, screens: only("members"), investigate: false });
    assert.ok(none.walk.notes.includes(NO_PUBLISHED_NOTE), none.report);
    assert.ok(!none.walk.steps.some((s) => wordRx("act.owed_pubprint.label.published").test(s.label)));
  } finally { await fp.close(); }
});

test("R20 control: a screen that draws an assistant control while the assistant does not work fails by name, its step reported not walked; the same screen without it passes", { timeout: 300000 }, async () => {
  const stepOn = async (plane) => {
    const fp = await fakePlane(plane);
    const b = await browser();
    try {
      const walk = new Walk({ out: join(dir, String(Math.random()).slice(2)), arm: "live" });
      walk.copyHost = new URL(fp.base).host;
      const ctx = await b.newContext(); const page = walk.watch(await ctx.newPage());
      await notReady(walk, page, fp.base, { label: "assistant not ready: the Ask screen", path: "/app/answers", screen: "answers", names: [STEP_NAMES.ask] });
      await ctx.close();
      return walk;
    } finally { await b.close(); await fp.close(); }
  };
  const bad = await stepOn({ askControl: true });
  assert.ok(bad.failures.some((x) => x.kind === FAIL.STEP && /answers draws an assistant control that cannot work while the assistant does not: act ask/.test(x.detail)), JSON.stringify(bad.failures));
  assert.ok(bad.notes.includes(localize("journey-check.walker.name_not_walked_the_assistant", "{name}: not walked, the assistant does not work (K3717)", { name: STEP_NAMES.ask })));
  const good = await stepOn({});
  assert.deepEqual(good.failures, [], JSON.stringify(good.failures));
  assert.ok(good.steps.some((s) => s.label === "assistant not ready: the Ask screen" && s.ok));
});

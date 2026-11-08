/* journey-check R1: the walk run by `npm run journey`, in its two arms. The local arm is walked end to end, from the
   installer over its fake Cloudflare account through the hand-over into a plane under Miniflare, journey 28 and journey 3,
   then every registry screen; the live arm signs in with credentials read from the environment, never printed. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, mkdtempSync, rmSync, readdirSync } from "node:fs";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fakeAccount, AUTHORIZE, TOKEN, API } from "../../../src/journey-check/account.mjs";
import { runLocal, runLive } from "../../../src/journey-check/run.mjs";
import { FAIL } from "../../../src/journey-check/walker.mjs";
import { JOURNEY_29_ORDER } from "../../../src/journey-check/design.mjs";
import { RELEASE_MANIFEST } from "../../../../newgroup/src/release.mjs";
import { createHash } from "node:crypto";
import { planeOptions } from "../../../src/journey-check/local.mjs";
import { STEP_NAMES } from "../../../src/journey-check/investigation.mjs";
import { CARRIED_STATES } from "../../../src/journey-check/states.mjs";
import { LIVE_ARM, KNOWN_GAPS } from "../../../src/journey-check/reach.mjs";
import { stateKey } from "../../../src/journey-check/states.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const DIR = join(import.meta.dirname, "..", "..", "..", "src", "journey-check");

/* that `--live <address>` selects the live arm is run, not read, in entry.test.mjs (R4's control) */
test("R1: `npm run journey` runs the walk from its directory, on Playwright (Chromium) pinned exactly, with its lock", () => {
  const pkg = JSON.parse(readFileSync(join(DIR, "package.json"), "utf8"));
  assert.equal(pkg.scripts.journey, "node journey.mjs");
  const v = pkg.devDependencies["playwright-core"];
  assert.match(v, /^\d+\.\d+\.\d+$/, "an exact version");
  const lock = JSON.parse(readFileSync(join(DIR, "package-lock.json"), "utf8"));
  assert.equal(lock.packages["node_modules/playwright-core"].version, v);
});

test("R1 (a): the fake Cloudflare account grants a token only for the PKCE verifier its consent was asked with, keeps bindings by type across uploads, and names every call it does not answer", async () => {
  const uploads = [];
  const acct = fakeAccount({ onScript: async (name, s) => uploads.push([name, s.bindings.map((b) => b.name).sort()]) });
  const verifier = "v".repeat(43);
  const challenge = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier))).toString("base64url");
  const consent = await (await acct.handle(new Request(`${AUTHORIZE}?redirect_uri=${encodeURIComponent("https://i.test/callback")}&state=s1&code_challenge=${challenge}&code_challenge_method=S256&scope=a+b`))).text();
  const back = new URL(/href="([^"]+)"/.exec(consent)[1].replace(/&amp;/g, "&"));
  assert.equal(back.searchParams.get("state"), "s1");
  const exchange = (v) => acct.handle(new Request(TOKEN, { method: "POST", body: new URLSearchParams({ code: back.searchParams.get("code"), code_verifier: v, redirect_uri: "https://i.test/callback" }) }));
  /* control: a wrong verifier is refused, and the code stays spent */
  assert.equal((await exchange("w".repeat(43))).status, 400);
  const consent2 = await (await acct.handle(new Request(`${AUTHORIZE}?redirect_uri=${encodeURIComponent("https://i.test/callback")}&state=s2&code_challenge=${challenge}&code_challenge_method=S256`))).text();
  const back2 = new URL(/href="([^"]+)"/.exec(consent2)[1].replace(/&amp;/g, "&"));
  const tok = await (await acct.handle(new Request(TOKEN, { method: "POST", body: new URLSearchParams({ code: back2.searchParams.get("code"), code_verifier: verifier, redirect_uri: "https://i.test/callback" }) }))).json();
  assert.ok(tok.access_token);
  const auth = { authorization: "Bearer " + tok.access_token };
  const put = (meta) => { const fd = new FormData(); fd.append("metadata", new Blob([JSON.stringify(meta)])); fd.append("index.mjs", new Blob(["export default {}"]), "index.mjs");
    return acct.handle(new Request(`${API}/accounts/${acct.account}/workers/scripts/grp`, { method: "PUT", headers: auth, body: fd })); };
  assert.equal((await put({ bindings: [{ type: "secret_text", name: "ADMIN_TOKEN", text: "x" }, { type: "plain_text", name: "VERSION", text: "1" }] })).status, 200);
  assert.equal((await put({ bindings: [{ type: "plain_text", name: "VERSION", text: "2" }], keep_bindings: ["secret_text"] })).status, 200);
  assert.deepEqual(uploads.at(-1), ["grp", ["ADMIN_TOKEN", "VERSION"]], "the secret kept, the plain value restated");
  /* the lists the installer reads to know the account's copies and parts (installer R62, R69) are answered, not left unanswered */
  const get = async (path) => (await acct.handle(new Request(`${API}/accounts/${acct.account}${path}`, { headers: auth }))).json();
  assert.deepEqual((await get("/workers/scripts")).result.map((x) => x.id), ["grp"]);
  assert.equal((await acct.handle(new Request(`${API}/accounts/${acct.account}/r2/buckets`, { method: "POST", headers: auth, body: JSON.stringify({ name: "bio-captures-grp" }) }))).status, 200);
  assert.deepEqual((await get("/r2/buckets")).result.buckets, [{ name: "bio-captures-grp" }]);
  assert.deepEqual((await get("/containers/applications")).result, [], "the account runs no container application");
  /* a secret set on its own (installer R69): the script then holds it, restarted with it; one deleted is gone */
  const call = async (path, method, body) => acct.handle(new Request(`${API}/accounts/${acct.account}${path}`, { method, headers: auth, body: body && JSON.stringify(body) }));
  assert.equal((await call("/workers/scripts/grp/secrets", "PUT", { name: "ADMIN_TOKEN", text: "second", type: "secret_text" })).status, 200);
  assert.deepEqual(uploads.at(-1), ["grp", ["ADMIN_TOKEN", "VERSION"]]);
  assert.equal((await call("/workers/scripts/nobody/secrets", "PUT", { name: "X", text: "y" })).status, 404);
  assert.equal((await call("/workers/scripts/grp/secrets/ADMIN_TOKEN", "DELETE")).status, 200);
  assert.equal((await acct.handle(new Request(`${API}/accounts/${acct.account}/workers/scripts/grp`, { headers: { authorization: "Bearer nope" } }))).status, 403);
  assert.equal((await acct.handle(new Request(`${API}/accounts/${acct.account}/queues`, { headers: auth }))).status, 599);
  assert.deepEqual(acct.unanswered, [`GET ${API}/accounts/${acct.account}/queues`]);
});

test("R1 (a): the fake account answers the release's member addresses from the repository's committed release, whose bytes the installer's manifest signs; RELEASE.json and the plane's own asset stay unanswered; control: an address outside it is 404", async () => {
  const acct = fakeAccount();
  const at = (p) => acct.handle(new Request(`https://raw.githubusercontent.com/believeinoakland/bio/v${RELEASE_MANIFEST.version}/release/${p}`));
  for (const m of RELEASE_MANIFEST.fleet) {
    const r = await at(m.asset);
    assert.equal(r.status, 200, m.asset);
    assert.equal(createHash("sha256").update(Buffer.from(await r.arrayBuffer())).digest("hex"), m.sha256, `${m.member} as the installer verifies it`);
  }
  assert.equal((await at("RELEASE.json")).status, 404);
  assert.equal((await at("bio-plane.bundled.mjs")).status, 404);
  assert.equal((await at("../package.json")).status, 404);
  assert.equal((await at("no-such-member.bundled.mjs")).status, 404);
  /* the copy binds each capability member the upload gave it, to a worker that answers its version */
  const { opts } = planeOptions([{ type: "service", name: "PDF_WORKER", service: "pdf-worker-grp" }, { type: "plain_text", name: "VERSION", text: "9.9.9" }],
    { dir: "/tmp/x", name: "grp", outbound: () => new Response("") });
  assert.equal(opts.workers[0].serviceBindings.PDF_WORKER, "pdf-worker-grp");
  assert.ok(opts.workers.some((w) => w.name === "pdf-worker-grp" && /"pdf-worker"/.test(w.script) && /9\.9\.9/.test(w.script)));
});

/* The local arm walked once, end to end, shared by the tests that name what it walks (R1 (a), R7, R9–R11, R13, R14). It is
   the tranche's acceptance test: it passes only when every module it walks through does what its steps assert. */
let localRun = null;
const local = () => (localRun ||= (async () => {
  const out = mkdtempSync(join(tmpdir(), "jc-local-"));
  const r = await runLocal({ out });
  return { r, out, shots: readdirSync(out).filter((f) => f.endsWith(".png")) };
})());
after(async () => { if (localRun) rmSync((await localRun).out, { recursive: true, force: true }); });
const stepsOf = (r, journey) => r.walk.steps.filter((s) => s.journey === journey);
const numbered = (r, journey) => stepsOf(r, journey).filter((s) => /^\d+ · /.test(s.label));

const NOT_READY = /draws an assistant control that cannot work while the assistant does not/;
/* The coordinator's ruling (8 Nov; CR2-2, F10): R1 (a) is strict, a carried state the local arm does not reach failing it like any
   other; the states the local copy cannot draw are the live arm's (LIVE_ARM) or known gaps (KNOWN_GAPS), each noted with its
   reason, never failed. */
const noted = (r, name) => r.walk.notes.includes(localize("journey-check.walker.name_not_walked_the_assistant", "{name}: not walked, the assistant does not work (K3717)", { name }));
/* R20: the walk's steps that fail are only a screen that draws an assistant control that cannot work, by name */
const stepFailures = (r) => r.walk.failures.filter((f) => f.kind === FAIL.STEP);

test("R1 (a): the local arm, with no account: the installer over its fake account, the hand-over into a plane under Miniflare, journey 28, journey 3, the journeys to a conclusion and every registry screen drawn; each step screenshotted", { timeout: 2400000 }, async () => {
  const { r, shots } = await local();
  assert.deepEqual(r.walk.failures.filter((f) => !(f.kind === FAIL.STEP && NOT_READY.test(f.detail))), [], r.report);
  assert.equal(shots.length, r.walk.steps.length);
  const first = stepsOf(r, "journey 28").slice(0, 3).map((s) => s.label);
  assert.ok(/^civicsmith\.org: /.test(first[0]) && /^civicsmith\.org: /.test(first[1]) && /^install: /.test(first[2]), "journey 28 starts at civicsmith.org: " + first.join(" | "));
  for (const j of ["journey 28", "journey 3", "R9 as administrator", "R10 as member", "R7 as the founder, her handle held"]) assert.ok(stepsOf(r, j).length, j);
});

test("R21/F10: every carried state the local copy can draw is reached on the local arm and paired at both widths; those it cannot are noted, the live arm's with its means there and the known gaps (PD-10) with their reasons, never failed", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.STATE).map((f) => f.detail), [], r.report);
  const skipped = { ...LIVE_ARM, ...KNOWN_GAPS };
  assert.equal(r.walk.pairs.filter((p) => /^pairs\/state-/.test(p)).length, 2 * CARRIED_STATES.filter((s) => !Object.hasOwn(skipped, stateKey(s))).length, r.report);
  const named = (st) => r.walk.notes.find((n) => n.startsWith(`${st.screen}, `) && (n.includes(LIVE_ARM[stateKey(st)]?.means ?? "\u0000") || n.includes(KNOWN_GAPS[stateKey(st)] ?? "\u0000")));
  for (const st of CARRIED_STATES.filter((s) => Object.hasOwn(skipped, stateKey(s)))) assert.ok(named(st), `${stateKey(st)}: ${r.walk.notes.join(" | ")}`);
});

test.todo("R21/F10: the known gaps (reach.mjs KNOWN_GAPS, PD-10) drawn on an arm, or retired from the list", () => {});

test("R1 (a), G1: the local arm's install leaves the plane's script holding the watchdog cron its signed statement states; a plane without it fails the walk by name (red until the installer sets it and the release carries the statement)", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.STEP && /^install: the plane/.test(f.detail)), [], r.report);
});

test("R9: the local arm walks the journey as administrator through the screens' own controls; while the assistant does not work, steps 4, 9, 10 and 11 are not walked and the rest, 1 to 3, 5 to 8 and 12, each hold (R20)", { timeout: 2400000 }, async () => {
  const { r } = await local();
  const steps = [...numbered(r, "journey 28"), ...numbered(r, "R9 as administrator")];
  const n = [...new Set(steps.map((s) => Number(s.label.split(" · ")[0])))];
  assert.deepEqual(n, [1, 2, 3, 5, 6, 7, 8, 12], r.report);
  assert.deepEqual(steps.filter((s) => !s.ok).map((s) => s.label), [], r.report);
});

test("R20: the local arm reports R9's steps 4, 9, 10 and 11, all of R10 and journey 29's five assistant steps as not walked, each screen's not-ready state asserted; 13 of journey 29's 18 pairs are made; control: a screen that draws an assistant control that cannot work fails by name", { timeout: 2400000 }, async () => {
  const { r } = await local();
  for (const n of [STEP_NAMES.connect, STEP_NAMES.run, STEP_NAMES.read, STEP_NAMES.ask, STEP_NAMES.memberConnect, STEP_NAMES.memberRun, STEP_NAMES.memberProjectai, STEP_NAMES.memberPlan, STEP_NAMES.memberAsk])
    assert.ok(noted(r, n), `${n}: ${r.walk.notes.join(" | ")}`);
  assert.equal(r.walk.notes.filter((x) => /^journey 29 step \d+ /.test(x)).length, 5, "journey 29's five steps the design marks for the assistant");
  assert.equal(r.walk.pairs.filter((p) => /journey-29-step-/.test(p)).length, 13, r.report);
  const ready = r.walk.steps.filter((s) => /^assistant not ready: /.test(s.label));
  assert.ok(ready.length >= 4, ready.map((s) => s.label).join(" | "));
  /* the not-ready steps that hold are the question's dock and the Ask screen; one that fails names the control the screen still draws */
  for (const s of ready.filter((x) => !x.ok)) assert.ok(r.walk.failures.some((f) => f.step === s.label && NOT_READY.test(f.detail)), s.label);
  for (const f of stepFailures(r)) assert.match(f.detail, NOT_READY);
  assert.ok(!r.walk.steps.some((s) => /^(?:4|9|10|11) · /.test(s.label)), "no assistant step was tried");
});

test("R10: while the assistant does not work, the member's connection, run, projectai, planask and Ask are reported as not walked, with her connect screen's not-ready state asserted", { timeout: 2400000 }, async () => {
  const { r } = await local();
  const steps = stepsOf(r, "R10 as member");
  assert.ok(steps.some((s) => /^assistant not ready: her connect screen/.test(s.label)), r.report);
  for (const n of [STEP_NAMES.memberConnect, STEP_NAMES.memberRun, STEP_NAMES.memberProjectai, STEP_NAMES.memberPlan, STEP_NAMES.memberAsk]) assert.ok(noted(r, n), n);
});

test("R11: the local arm binds agent-worker, the runner's stand-in with the fake model, a stub city site and the test-instance mark, and walks R9's capture by address against the stub city", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.ok(numbered(r, "R9 as administrator").some((s) => s.label.startsWith("5 · capture by address") && s.ok), r.report);
});

/* R20's one switch: with the assistant working, the walk tries R9's step 4; the plane has no sign-in route (K3718 (2)), so it fails there by name */
const switched = async (opts) => {
  const out = mkdtempSync(join(tmpdir(), "jc-switch-"));
  try { return await runLocal({ out, parts: [], assistant: true, ...opts }); } finally { rmSync(out, { recursive: true, force: true }); }
};
const stopsOrFailsAtNine = (r) => {
  const nine = r.walk.steps.find((s) => s.label.startsWith("9 · run the assistant"));
  if (nine) { assert.equal(nine.ok, false, r.report); return nine; }
  assert.ok(r.walk.failures.length > 0, "a walk that stopped before step 9 says why: " + r.report);
  return null;
};

test("R20 control: with the switch set (the assistant working) the walk tries step 4 of R9, and a fault in it fails by name; with the switch unset the same step is noted and fails nothing", { timeout: 2400000 }, async () => {
  const on = await switched({});
  assert.ok(on.walk.steps.some((s) => /^4 · connect an assistant/.test(s.label)), on.report);
  assert.ok(!noted(on, STEP_NAMES.connect), "walked, not noted");
  const { r } = await local();
  assert.ok(noted(r, STEP_NAMES.connect) && !r.walk.steps.some((s) => /^4 · connect/.test(s.label)), "noted, not walked");
});

test("R11 control: with the switch set and no fake model bound, step 9 fails by name (or the walk says where it stopped before it)", { timeout: 2400000 }, async () => {
  const r = await switched({ model: false });
  const nine = stopsOrFailsAtNine(r);
  if (nine) assert.ok(r.walk.failures.some((f) => f.step === nine.label), r.report);
  /* the steps before it that were walked held: the sign-in answered without a model */
  assert.deepEqual(numbered(r, "R9 as administrator").filter((s) => Number(s.label.split(" · ")[0]) < 9 && !s.ok && !/^4 · /.test(s.label)).map((s) => s.label), [], r.report);
});

test("R7: the walk as stated: signed in as the founder, no screen draws admin as a person's name or handle", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.ok(r.walk.steps.some((s) => s.journey === "R7 as the founder, her handle held"), r.report);
  /* with none (K3380): swept while she had none, or, where the claim took her handle, noted as not walkable here */
  assert.ok(r.walk.steps.some((s) => s.journey === "R7 as the founder, with no handle")
    || r.walk.notes.includes("R7 with no handle: not walkable here (the claim took a handle)"), r.report);
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.ADMIN_NAME).map((f) => f.detail), []);
});

test("R13: the local arm pairs each step of design journey 29 the walk reaches with the mock's drawing of it (13 of 18 while the assistant does not work, R20)", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.equal(r.walk.pairs.filter((p) => /journey-29-step-/.test(p)).length, 13, r.report);
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.DESIGN).map((f) => f.detail), []);
});

test("R15: the local arm finds agent-worker's SEGMENTS binding present", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.ok(!r.walk.failures.some((f) => /SEGMENTS/.test(f.detail)), r.report);
});

test("R15 control: with the switch set and the binding removed, step 9 fails by name, not with a silent stop (or the walk says where it stopped before it)", { timeout: 2400000 }, async () => {
  const r = await switched({ segments: false });
  const nine = stopsOrFailsAtNine(r);
  if (nine) assert.ok(r.walk.failures.some((f) => f.step === nine.label && /no SEGMENTS binding \(R15\)/.test(f.detail)), r.report);
});

test("R16, R18: the local arm walks journey 29's search path with no assistant, to a conclusion on her own reading; R9's step 12 is made on the member's own reading too", { timeout: 2400000 }, async () => {
  const { r } = await local();
  const steps = r.walk.steps.filter((s) => s.journey.startsWith("R16 without the assistant"));
  assert.ok(steps.some((s) => /conclude on her own reading/.test(s.label) && s.ok), r.report);
  assert.deepEqual(steps.filter((s) => !s.ok).map((s) => s.label), [], r.report);
  assert.ok(r.walk.steps.some((s) => /sign out on this device/.test(s.label) && s.ok), r.report);
  assert.ok(r.walk.steps.some((s) => /^12 · conclude on her own reading/.test(s.label) && s.ok), r.report);
  assert.equal(r.walk.pairs.filter((p) => /journey-29-step-/.test(p)).length + r.walk.notes.filter((x) => /^journey 29 step \d+ /.test(x)).length, JOURNEY_29_ORDER.length, r.report);
});

test("R17: no page the walk serves says \"group\" for a team", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.GROUP).map((f) => f.detail), []);
});

test("R26: R17's scan over every page the walk serves (the installer's and the site's among them) finds none that says \"group\" for a team", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.GROUP).map((f) => `${f.step}: ${f.detail}`), []);
  assert.ok(r.walk.steps.some((s) => /^install: /.test(s.label)) && r.walk.steps.some((s) => /^civicsmith\.org: /.test(s.label)), "the installer's and the site's pages were scanned");
});

test("R22: both arms open dash-project and dash-action from Home's doors as working screens, drawn and not \"Nothing is here\"", { timeout: 2400000 }, async () => {
  const { r } = await local();
  const dash = r.walk.steps.filter((s) => /^dashboard dash-/.test(s.label));
  assert.equal(dash.length, 2, r.report);
  assert.deepEqual(dash.filter((s) => !s.ok).map((s) => s.label), [], r.report);
  for (const id of ["dash-project", "dash-action"]) assert.ok(r.walk.steps.some((s) => s.label === `screen ${id}` && s.ok), id);
});

test("R23: the first page of the document the walk captured reads Page 1, and no screen draws a page numbered 0", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.ok(r.walk.steps.some((s) => s.label === "document: its first page reads Page 1" && s.ok), r.report);
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.PAGE_ZERO).map((f) => f.detail), []);
});

test("R25: the walk requests /sign once on the copy and gets 404 with the interface's nothing-is-here page, no signing page", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.ok(r.walk.steps.some((s) => /^sign: \/sign/.test(s.label) && s.ok), r.report);
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.OLD_PAGE), []);
});

test("R27: the pseudo-locale walk draws every screen at both widths with the pseudo rows and reports any sentence that escaped the list", { timeout: 2400000 }, async () => {
  const { r } = await local();
  assert.ok(r.walk.steps.filter((s) => /^pseudo screen /.test(s.label)).length >= 70, r.report);
  assert.deepEqual(r.walk.failures.filter((f) => f.kind === FAIL.PSEUDO).map((f) => f.detail), []);
});

test("R1 (b): the live arm reads the administrator's and a member's credentials from the environment and never prints them; control: without them it refuses before any request", async () => {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    if (req.url.startsWith("/api/?op=bootstrap")) { res.setHeader("content-type", "application/json"); return res.end(JSON.stringify({ ok: true, test_instance: true })); }
    res.setHeader("content-type", "text/html");
    res.end(`<!doctype html><html><head><link rel="stylesheet" href="/app/assets/civicsmith.css"></head><body><main id="cs-main"><label>Handle <input name="h"></label><label>Password <input type="password" name="p"></label></main></body></html>`);
  });
  await new Promise((ok) => server.listen(0, "127.0.0.1", ok));
  const base = `http://127.0.0.1:${server.address().port}`;
  const out = mkdtempSync(join(tmpdir(), "jc-live-"));
  try {
    const none = await runLive({ base, env: {}, out });
    assert.match(none.walk.failures[0].detail, /NO_CREDENTIALS/);
    assert.deepEqual(seen, [], "nothing asked of the instance without credentials");
    const env = { JOURNEY_ADMIN_HANDLE: "ada-admin", JOURNEY_ADMIN_PASSWORD: "admin-secret-password", JOURNEY_MEMBER_HANDLE: "mai-k", JOURNEY_MEMBER_PASSWORD: "member-secret-password" };
    const r = await runLive({ base, env, out });
    assert.ok(seen.includes("GET /api/?op=bootstrap"), "the guard read bootstrap first");
    assert.equal(seen[0], "GET /api/?op=bootstrap");
    /* this stand-in draws no sign-in control, so the walk fails at it, and says so without the credentials */
    assert.equal(r.ok, false);
    assert.ok(r.walk.failures.some((f) => f.kind === FAIL.STEP && /control login|no field|screen/.test(f.detail)), r.report);
    const printed = r.report + readFileSync(join(out, "report.json"), "utf8");
    for (const v of Object.values(env)) if (v.includes("secret")) assert.equal(printed.includes(v), false, "a password printed");
  } finally { server.close(); rmSync(out, { recursive: true, force: true }); }
});

/* A child node process running `code` (an ES module, `RUN` and `LOCAL` the arm's modules); it must end by itself, with no
   open handles, within `deadline` ms. Answers whether it did, its exit code and what it printed. */
const RUN = pathToFileURL(join(DIR, "run.mjs")).href, LOCAL = pathToFileURL(join(DIR, "local.mjs")).href;
function ends(code, deadline) {
  return new Promise((done) => {
    const child = spawn(process.execPath, ["--input-type=module", "-e", `const RUN = ${JSON.stringify(RUN)}, LOCAL = ${JSON.stringify(LOCAL)};\n${code}`],
      { stdio: ["ignore", "pipe", "pipe"] });
    let out = "", err = "";
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    const t = setTimeout(() => child.kill("SIGKILL"), deadline);
    child.on("exit", (status, signal) => { clearTimeout(t); done({ ended: signal === null, status, out, err }); });
  });
}
const lastJson = (s) => JSON.parse(s.trim().split("\n").at(-1));
/* the local arm forced to fail as `opts` say; prints what it answered and the handles left once it returned */
const forced = (opts) => `const { runLocal } = await import(RUN);
const { localWorld } = await import(LOCAL);
const out = (await import("node:fs")).mkdtempSync((await import("node:path")).join((await import("node:os")).tmpdir(), "jc-dispose-"));
const r = await runLocal({ out, ${opts} });
(await import("node:fs")).rmSync(out, { recursive: true, force: true });
console.log(JSON.stringify({ ok: r.ok, failures: r.walk.failures, handles: process.getActiveResourcesInfo() }));`;
const DEADLINE = 60000;

test("R1 (a): every way the local arm can stop closes its world, browser and servers; control: a world left open keeps its process alive past the deadline", { timeout: 600000 }, async () => {
  /* control: the check sees open handles. A world started and never closed (its Miniflare instances running) does not end. */
  const leak = await ends(`const { localWorld } = await import(LOCAL); await localWorld(); console.log("started");`, DEADLINE);
  assert.equal(leak.ended, false, "a world left open was not caught: " + leak.err);
  assert.match(leak.out, /started/);

  /* playwright-core unloadable: the world is started, the browser cannot be, the arm says so and closes the world */
  const noPlaywright = await ends(forced(`launch: async () => { throw new Error("playwright-core cannot be loaded (forced)"); }`), DEADLINE);
  assert.equal(noPlaywright.ended, true, "the arm left handles open when the browser could not start: " + noPlaywright.err);
  const a = lastJson(noPlaywright.out);
  assert.equal(a.ok, false);
  assert.ok(a.failures.some((f) => f.kind === FAIL.STEP && /playwright-core cannot be loaded \(forced\)/.test(f.detail)), JSON.stringify(a.failures));

  /* a world that cannot start: nothing is left open, the arm says why */
  const noWorld = await ends(forced(`world: async () => { throw new Error("the world cannot start (forced)"); }`), DEADLINE);
  assert.equal(noWorld.ended, true, noWorld.err);
  assert.ok(lastJson(noWorld.out).failures.some((f) => /the world cannot start \(forced\)/.test(f.detail)));

  /* a walker step that throws: the world refuses every request of the browser, so civicsmith.org's first page fails;
     the browser, its pages and the world all close */
  const stepThrows = await ends(forced(`world: async () => { const w = await localWorld();
    return { ...w, route: (ctx, onForeign) => ctx.route("**/*", (r) => { onForeign(r.request().url()); return r.abort("blockedbyclient"); }) }; }`), DEADLINE);
  assert.equal(stepThrows.ended, true, "the arm left handles open after a step threw: " + stepThrows.err);
  const c = lastJson(stepThrows.out);
  assert.equal(c.ok, false);
  assert.ok(c.failures.some((f) => f.kind === FAIL.STEP && /^civicsmith\.org: /.test(f.step)), JSON.stringify(c.failures));
});

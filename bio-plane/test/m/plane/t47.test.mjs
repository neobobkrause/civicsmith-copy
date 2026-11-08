/* plane R43, R46, R48 (T47-66; N955, N993, N1002; K3147): the Store's `dispatchMemberRun` RPC takes no credential (R46); the
   plane's global scope is measured against bundler R31's budget (R43); the page the Worker serves is composed from the nine
   screen modules' screens (R48). Each drives the plane at its interface (the object's RPC, the built artifact, the
   Worker's page) and carries a negative control (K874). The composition tests of T47 are `store-assembly`'s. */
import { test } from "node:test";
import assert from "node:assert/strict";

import { relative } from "node:path";
import { store } from "./fixture.mjs";

import { aiRunsOf } from "../../../src/ai-runs/index.mjs";

import { interfaceScript, interfaceScriptHash } from "../../../src/interface-shell/index.mjs";

/* Instants and minted ids differ between two objects; everything else must not. */
const mask = (text) => text.replace(/\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d+)?Z/g, "<instant>").replace(/"(ms|feeds_ms)":[\d.]+/g, '"$1":"<n>"');
const member = (x, id, role = "member") => x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status,
  capabilities, created, updated) VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);

/* ===== R45, R48 (T47; N908, N961; op-declarations R57–R59, R61; tasks R19): the route map ===== */

/* T47's new ops are served by these owners' maps (op-declarations R57–R59, R61; tasks R19; R45's list): the ops are read from
   the owners' own maps (K3268), never listed here. `signintrace` is the Worker door's own (control-plane R87), never a store
   route. */

/* ===== R46 (T47; N955; ai-runs R18; credentials R63) ===== */

test("R46 (T47; N955; ai-runs R18, credentials R63): the Store's RPC dispatchMemberRun takes no credential: ai-runs is handed only run, by, viewer and at, so a sentinel `credential` in the args dispatches as a call without it and reaches no request the plane makes; control: the same call with no credential answers alike", async () => {
  const sent = [];
  const binding = { fetch: async (u, init) => { sent.push(String(u) + (init && init.body ? String(init.body) : "")); return new Response("{}"); } };
  const x = await store({ env: { AGENT_WORKER: binding, AGENT_RUNNER: binding } });
  const ai = aiRunsOf(x.ctx), was = ai.dispatchMemberRun.bind(ai), seen = [];
  ai.dispatchMemberRun = async (a) => { seen.push(a); return was(a); };
  try {
    const SENTINEL = "aik-sentinel-credential-t47";
    const args = { run: "RUN-2026-0009-none", by: "member:ann", viewer: "member:ann", at: "2026-10-14T00:00:00Z" };
    const r = await x.s.dispatchMemberRun({ ...args, credential: SENTINEL });
    assert.deepEqual(seen, [args], "ai-runs reached once, with no credential");
    const control = await x.s.dispatchMemberRun(args);
    assert.deepEqual(seen[1], args);
    assert.deepEqual(JSON.parse(mask(JSON.stringify(r))), JSON.parse(mask(JSON.stringify(control))), "dispatched as one without it");
    assert.equal(JSON.stringify(r).includes(SENTINEL), false);
    assert.equal(sent.some((s) => s.includes(SENTINEL)), false, "no request carries it");
    /* no args is ai-runs' own answer to none */
    await x.s.dispatchMemberRun();
    assert.deepEqual(seen.at(-1), {});
  } finally { ai.dispatchMemberRun = was; }
});

/* ===== R43 (T47; N993; bundler R31; K3147) ===== */

test("R43 (T47; N993; bundler R31; K3147): the plane's global scope is measured as bundler's fleetbundles measures it (a fresh import of the built artifact, five times) and printed beside R31's 500 ms budget, a time past it a warning (the cause named, PLANE #35 J1), never a failure; control: a run that cannot be measured fails", async () => {
  const { planeMember, buildMember, measureStart, startVerdict, BUDGET } = await import("../../../scripts/fleet-bundle.mjs");
  const { writeFileSync, mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  assert.equal(BUDGET.startWarnMs, 500, "R31's budget, never raised here");
  const m = planeMember();
  const dir = mkdtempSync(join(tmpdir(), "plane-r43-"));
  try {
    const out = join(dir, "bio-plane.bundled.mjs");
    writeFileSync(out, (await buildMember(m)).bytes);
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const r = await measureStart(m, { artifact: relative(m.abs, out) });
      assert.equal(r.measured, true, r.reason);
      runs.push(r.ms);
    }
    const median = [...runs].sort((a, b) => a - b)[2];
    const v = startVerdict(m, median, BUDGET);
    console.log(`R43: the plane's global scope, five fresh imports: ${runs.map((ms) => ms.toFixed(0)).join(", ")} ms; median `
      + `${median.toFixed(0)} ms, budget ${BUDGET.startWarnMs} ms: ${v.verdict}${v.warning ? ` (${v.warning})` : ""}`);
    assert.ok(runs.every((ms) => ms > 1), "a fresh import evaluates the artifact, never a cached module");
    assert.ok(["ok", "warn"].includes(v.verdict), "past the budget is a warning, never a failure (R31)");
    /* control: an artifact that cannot be read is unmeasured, which is a failure */
    const none = await measureStart(m, { artifact: relative(m.abs, join(dir, "absent.mjs")) });
    assert.equal(none.measured, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* ===== R48 (T47; N1002; DEC-201; control-plane R81, R82; interface-shell R28): the composed page ===== */

/* The nine screen modules whose `SCREENS` the page the plane serves is composed from (`screens-entry` among them), and,
   since control-plane's land 25c1342cbc (BOB's found mark, 7 Nov; screens-ai PR 881), screens-ai's AI screens after them:
   screens-settings and screens-inquiry link to them. The order is the page's, so the shell's script hash matches. */
const SCREEN_MODULES = ["screens-entry", "screens-settings", "screens-intake", "screens-daily", "screens-inquiry",
                        "screens-wizards", "screens-investigate", "screens-publish", "screens-action", "screens-ai"];

test("R48 (T47; N1002; DEC-201; control-plane R81, R82): the page the plane's Worker serves at /app and at / is composed from the nine screen modules' screens, screens-entry among them, and screens-ai's after them: every screen of each is drawn by the page (its render carried in the page's script); control: a screen of no module is not", async () => {
  const worker = (await import("../../../src/plane/index.mjs")).default;
  const env = { STORE: { idFromName: (n) => n, get: () => ({}) }, VERSION: "t47" };
  const pages = {};
  for (const path of ["/app", "/"]) {
    const res = await worker.fetch(new Request(`https://bio.example.workers.dev${path}`), env, {});
    assert.equal(res.status, 200, path);
    assert.match(res.headers.get("content-type") || "", /^text\/html/, path);
    pages[path] = await res.text();
  }
  /* interface-shell R1, R2: the page loads the shell's script from one external element, its integrity the hash of that script;
     the renders are drawn by that script, so they are looked for in it (answer-envelope R6 may stamp the element with a nonce) */
  const all = [];
  let WIZARD_GUIDE;   /* the wizards' guide, read with their screens, as the composed page reads it (control-plane's APP_OPTIONS) */
  for (const mod of SCREEN_MODULES) {
    let SCREENS, GUIDE;
    try { ({ SCREENS, GUIDE } = await import(`../../../src/${mod}/index.mjs`)); } catch (e) { assert.fail(`${mod}: ${String(e && e.message).split("\n")[0]}`); }
    if (mod === "screens-wizards") WIZARD_GUIDE = GUIDE;
    assert.ok(Array.isArray(SCREENS) && SCREENS.length > 0, `${mod} offers screens`);
    all.push(...SCREENS);
  }
  const script = interfaceScript(all, { guide: WIZARD_GUIDE });
  const hash = interfaceScriptHash(all, { guide: WIZARD_GUIDE });
  for (const [path, page] of Object.entries(pages)) {
    const tags = [...page.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
    assert.equal(tags.length, 1, `${path}: one script element`);
    assert.match(tags[0], /^<script (nonce="[^"]*" )?src="\/app\/shell-[^"]+\.js" integrity="sha256-[A-Za-z0-9+/=]+">$/, path);
    assert.ok(page.includes(`integrity="${hash}"`), `${path}: the page's script is the shell's script over these screens`);
  }
  let screens = 0;
  for (const s of all) {
    screens++;
    assert.ok(script.includes(String(s.render)), `${s.id}'s render is not in the shell's script the page loads`);
  }
  assert.ok(screens >= SCREEN_MODULES.length);
  /* negative control: a render no module offers is not in the shell's script */
  const probe = function render() { return "zz-probe-screen-t47"; };
  assert.equal(script.includes(String(probe)), false);
});


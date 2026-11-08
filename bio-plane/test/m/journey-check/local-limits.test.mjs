/* journey-check PD-11 (R6, R28 on the local arm): the local arm's last sweep (`localSweep`, run by `runLocal` as the founder with
   her handle held) measures each drawn screen as the live arm does, at 1280 and 390 px, against the page's limits (`pageLimits`,
   an element whose class no loaded stylesheet defines among them) and DEC-340's (`dec340Limits`), then walks the named public pages
   signed out (`publicPass`), through the arm's own route. Here the copy is the fake plane over HTTP, as the local world serves the
   installed copy to the browser. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { localSweep, browser, ABSENT_TITLE_NOTE } from "../../../src/journey-check/run.mjs";
import { FAIL, Walk } from "../../../src/journey-check/walker.mjs";
import { sweepScreens } from "../../../src/journey-check/screens.mjs";
import { open, act, requireDrawn } from "../../../src/journey-check/journeys.mjs";
import { fakePlane } from "./fake-plane.mjs";

const only = (...ids) => sweepScreens().filter((s) => ids.includes(s.id));
let dir, b;
before(async () => { dir = mkdtempSync(join(tmpdir(), "jc-local-limits-")); b = await browser(); });
after(async () => { await b?.close().catch(() => {}); rmSync(dir, { recursive: true, force: true }); });

/* the founder signed in on the copy, then the local arm's last sweep over `screens`; the arm's route serves only the copy */
async function swept(plane, screens) {
  const fp = await fakePlane({ admins: { ada: true }, ...plane });
  const walk = new Walk({ out: join(dir, String(Math.random()).slice(2)), arm: "local" });
  walk.copyHost = new URL(fp.base).host;
  const route = (ctx) => ctx.route("**/*", (r) => (new URL(r.request().url()).host === walk.copyHost ? r.continue()
    : (walk.foreign(r.request().url()), r.abort("blockedbyclient"))));
  const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } });
  try {
    await route(ctx);
    const page = walk.watch(await ctx.newPage());
    await walk.step(page, "the founder signs in", async (p) => {
      await open(walk, p, fp.base, "/", "front");
      await act(p, "login", { fields: { "fs-handle": "ada", "fs-pw": "founder-password-x" } });
      await p.waitForFunction(() => location.pathname === "/app", null, { timeout: 15000 });
      await requireDrawn(walk, p, "home");
    });
    await localSweep(walk, b, page, fp.base, { handle: "ada", route, screens });
    return walk;
  } finally { await ctx.close().catch(() => {}); await fp.close(); }
}

test("PD-11: a local-arm page drawing a class no loaded stylesheet defines fails the walk at both widths, by screen; control: the same page without it passes", { timeout: 300000 }, async () => {
  const flawed = await swept({ flaws: { home: "class" } }, only("home", "members"));
  const at = [...new Set(flawed.failures.filter((f) => f.kind === FAIL.CLASS).map((f) => f.detail.replace(/: .*/, "")))].sort();
  assert.deepEqual(at, ["home at 1280px", "home at 390px"], JSON.stringify(flawed.failures));
  assert.match(flawed.failures.find((f) => f.kind === FAIL.CLASS).detail, /p\.cs-unstyled: no loaded stylesheet defines the class/);
  assert.equal(flawed.failures.length, 2, JSON.stringify(flawed.failures));
  const clean = await swept({}, only("home", "members"));
  assert.deepEqual(clean.failures, []);
  /* the sweep is R7's as the founder with her handle held, and the public pages follow it, signed out */
  assert.ok(clean.steps.some((s) => s.journey === "R7 as the founder, her handle held" && s.label === "screen home"));
  assert.ok(clean.steps.some((s) => s.journey === "R28 the public pages"), clean.steps.map((s) => s.label).join(" | "));
});

test("PD-11: a local-arm screen whose tab title is not its screen's word fails DEC-340 by name; control: the clean sweep passes the titles", { timeout: 300000 }, async () => {
  const walk = await swept({ flaws: { members: "title" } }, only("members"));
  const dec = walk.failures.filter((f) => f.kind === FAIL.DEC340);
  assert.deepEqual([...new Set(dec.map((f) => f.detail.replace(/: .*/, "")))].sort(), ["members at 1280px", "members at 390px"], JSON.stringify(walk.failures));
});

test("PD-11, BOB 8 Nov: a screen that draws its absence state at its bare address (\"Can't open this\") is not failed on its tab title, and the skip is noted; control: a screen that draws its subject with a wrong title still fails (above)", { timeout: 300000 }, async () => {
  const walk = await swept({ flaws: { members: "absent" } }, only("members"));
  assert.deepEqual(walk.failures.filter((f) => f.kind === FAIL.DEC340), [], JSON.stringify(walk.failures));
  assert.ok(walk.notes.includes(ABSENT_TITLE_NOTE("members")), walk.notes.join(" | "));
  const titled = await swept({ flaws: { members: "title" } }, only("members"));
  assert.ok(titled.failures.some((f) => f.kind === FAIL.DEC340 && /^members at 1280px: title/.test(f.detail)), JSON.stringify(titled.failures));
  assert.ok(!titled.notes.includes(ABSENT_TITLE_NOTE("members")));
});

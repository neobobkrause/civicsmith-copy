/* journey-check R13 (N1099, N1100; DEC-241, DEC-245; amends R6): R6's comparison covers design journey 29 step by step,
   each LIVE step beside the mock's drawing of it, and `/app/more` at 390 px. The mock is the checkout's own `layouts.html`,
   which holds journey 29. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative } from "node:path";
import { Walk, FAIL } from "../../../src/journey-check/walker.mjs";
import { designMock, journeyPairs, JOURNEY_29, JOURNEY_29_ORDER } from "../../../src/journey-check/design.mjs";
import { journey29Live, JOURNEY_29_STEPS } from "../../../src/journey-check/investigation.mjs";
import { sweepScreens } from "../../../src/journey-check/screens.mjs";
import { browser } from "../../../src/journey-check/run.mjs";

let B, dir, mock, shot;
before(async () => {
  B = await browser(); dir = mkdtempSync(join(tmpdir(), "jc-j29-"));
  mock = await designMock(B, { dir: join(dir, "design") });
  const ctx = await B.newContext(); const p = await ctx.newPage(); await p.setContent("<p>a live step</p>");
  shot = join(dir, "live.png"); await p.screenshot({ path: shot }); await ctx.close();
});
after(async () => { await mock?.close(); await B?.close(); rmSync(dir, { recursive: true, force: true }); });

test("R13, R18: a pair is made for each of journey 29's 18 steps, in the design file's order, LIVE beside DESIGN", { timeout: 300000 }, async () => {
  const steps = await mock.allSteps(JOURNEY_29);
  assert.equal(steps.length, 18, `${steps.length} steps`);
  assert.deepEqual(steps.map((x) => [x.s, x.v, x.act]), JOURNEY_29_ORDER.map((x) => [x.s, x.v, x.act]), "R18's order is the design's");
  const walk = new Walk({ out: join(dir, "a"), arm: "local" });
  const seen = [];
  const files = await journeyPairs(walk, B, mock, { out: walk.out, liveOf: (st, k) => { seen.push(k); return shot; } });
  assert.deepEqual(walk.failures, []);
  assert.deepEqual(seen, [...Array(18).keys()], "each step visited once, in order");
  assert.equal(files.length, 18);
  for (const [i, f] of files.entries()) assert.ok(existsSync(f) && relative(walk.out, f).startsWith(`pairs/journey-29-step-${String(i + 1).padStart(2, "0")}-`), f);
});

test("R13, R18 control: a step with no LIVE screenshot fails by its number: a missing pair is a failure", { timeout: 300000 }, async () => {
  const walk = new Walk({ out: join(dir, "b"), arm: "local" });
  const files = await journeyPairs(walk, B, mock, { out: walk.out, liveOf: (st, i) => (i === 3 ? null : shot) });
  const steps = await mock.allSteps(JOURNEY_29);
  assert.equal(files.length, steps.length - 1);
  assert.deepEqual(walk.failures.map((f) => f.kind), [FAIL.DESIGN]);
  assert.match(walk.failures[0].detail, new RegExp(`^journey 29 step 4 \\(${steps[3].s}.*\\): no LIVE screenshot of it, so no pair$`));
});

test("R18 control: a step the design's file does not hold fails by its number", { timeout: 300000 }, async () => {
  const walk = new Walk({ out: join(dir, "c"), arm: "local" });
  const real = await mock.allSteps(JOURNEY_29);
  /* the file without its seventh step (projects, empty, promote) */
  const fake = { commit: mock.commit, allSteps: async () => real.filter((_, i) => i !== 6), drawStepAt: (j, k, w) => mock.drawStepAt(j, k, w) };
  await journeyPairs(walk, B, fake, { out: walk.out, liveOf: () => shot });
  assert.ok(walk.failures.length >= 1 && walk.failures.every((f) => f.kind === FAIL.DESIGN));
  assert.match(walk.failures[0].detail, /^journey 29 step 7 \(projects, empty, promote\): the design's file holds no such step there$/);
});

test("R18 (K3747): where the assistant does not work, a step the design marks for it is reported as not walked, never failed; control: reported nowhere else", { timeout: 300000 }, async () => {
  const steps = await mock.allSteps(JOURNEY_29);
  const ai = steps.map((x, i) => (x.only === "ai" ? i : -1)).filter((i) => i >= 0);
  assert.ok(ai.length >= 4, "the design marks the assistant's steps");
  const walk = new Walk({ out: join(dir, "d"), arm: "live" });
  const files = await journeyPairs(walk, B, mock, { out: walk.out, notWalked: true, liveOf: (st, i) => (ai.includes(i) ? null : shot) });
  assert.deepEqual(walk.failures, []);
  assert.equal(files.length, 18 - ai.length);
  assert.equal(walk.notes.length, ai.length);
  assert.ok(walk.notes.every((n) => /not walked, the assistant does not work \(K3717\)$/.test(n)));
  /* control: a step the design marks for no one, or for no assistant, with no LIVE screenshot is still a failure */
  const none = steps.findIndex((x) => x.only === "noai");
  const walk2 = new Walk({ out: join(dir, "e"), arm: "live" });
  await journeyPairs(walk2, B, mock, { out: walk2.out, notWalked: true, liveOf: (st, i) => (i === none ? null : shot) });
  assert.deepEqual(walk2.failures.map((f) => f.kind), [FAIL.DESIGN]);
});

test("R13, R18: each step of journey 29 is walked by a step of the walk, whose screenshot is its LIVE half", async () => {
  const steps = await mock.allSteps(JOURNEY_29);
  const labels = ["install: the installer's first page", "install: each step finishes, the checks pass", "1 · setup: claim with her own handle; she is the team's first administrator",
    "4 · connect an assistant by her own Claude subscription", "home: a new team's home, inviting members and saying who it is", "security: a first look at Security",
    "2 · start a project with a title, and open it", "3 · open a question in it", "9 · run the assistant on the question from the dock",
    "10 · read its run's answer and its suggested reading", "no assistant · search: look for a source the team already holds",
    "no assistant · capture by address, from the question's \"Add a document\"", "no assistant · see it held, and vouch for it", "no assistant · cite it with a role (supports)",
    "no assistant · conclude on her own reading"];
  const walk = { out: "/w", steps: labels.map((label, i) => ({ label, screenshot: `${i}.png` })) };
  for (const st of steps) assert.ok(journey29Live(walk, st), `journey 29's ${st.s} (${st.v}, ${st.act}) has no walked step`);
  /* control: a walk that did not reach a step gives it no LIVE half */
  assert.equal(journey29Live({ out: "/w", steps: [] }, steps[0]), null);
  assert.equal(Object.keys(JOURNEY_29_STEPS).length, 18);
});

test("R13: `/app/more` is a working screen the live arm pairs at 390 px (DEC-241)", () => {
  assert.ok(sweepScreens().some((s) => s.id === "more" && s.frame === "working"));
});

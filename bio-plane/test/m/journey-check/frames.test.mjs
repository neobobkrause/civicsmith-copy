/* journey-check R21 (the carried states beside the design's), R24 (the published frame): over the design mock at the checkout's own
   commit, and a fixture instance, each with a control that holds. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, existsSync } from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { browser } from "../../../src/journey-check/run.mjs";
import { Walk, FAIL } from "../../../src/journey-check/walker.mjs";
import { designMock, WIDTHS } from "../../../src/journey-check/design.mjs";
import { CARRIED_STATES, walkStates } from "../../../src/journey-check/states.mjs";
import { stateKey, unreachedOnLocal } from "../../../src/journey-check/states.mjs";
import { localReach, UNREACHABLE, overlappingZip } from "../../../src/journey-check/reach.mjs";
import { walkPublished, NO_PUBLISHED_NOTE } from "../../../src/journey-check/published.mjs";
import { walkDashboards } from "../../../src/journey-check/journeys.mjs";
import { fakePlane, publishedPage } from "./fake-plane.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { wordRx } from "../../word-rx.mjs";

const COMMIT = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8" }).trim();
let B, dir, mock;
before(async () => { B = await browser(); dir = mkdtempSync(join(tmpdir(), "jc-frames-")); mock = await designMock(B, { dir: join(dir, "design"), commit: COMMIT }); });
after(async () => { await mock?.close(); await B?.close(); rmSync(dir, { recursive: true, force: true }); });

test("R21: the design mock offers every carried state the walk pairs, drawn by its own control at both widths; control: a state the mock does not offer fails by its name", { timeout: 300000 }, async () => {
  for (const st of CARRIED_STATES) for (const w of WIDTHS) {
    const d = await mock.drawState(st.screen, st.control, st.option, w);
    assert.ok(d.png, `${st.screen}, ${st.state} at ${w}px: ${d.why}`);
  }
  const walk = new Walk({ out: join(dir, "a"), arm: "live" });
  await walkStates(walk, B, mock, { out: walk.out, states: [{ screen: "document", state: "compare", control: "mk-dst", option: "compare" }] });
  assert.deepEqual(walk.failures.map((f) => f.kind), [FAIL.DESIGN]);
  assert.match(walk.failures[0].detail, /^document, compare: the mock's mk-dst offers no state like \/compare\//);
});

test("R21: a state the live screen reaches is paired at both widths; control: a state the live instance does not hold is a note, never a pass and never a failure", { timeout: 300000 }, async () => {
  const walk = new Walk({ out: join(dir, "b"), arm: "live" });
  const ctx = await B.newContext(); const page = await ctx.newPage();
  const states = CARRIED_STATES.filter((s) => s.screen === "project").slice(0, 2);
  const written = await walkStates(walk, B, mock, { out: walk.out, page, base: "http://x", states,
    reach: { [`${states[0].screen}, ${states[0].state}`]: async (p) => { await p.setContent("<main>the live state</main>"); return true; } } });
  await ctx.close();
  assert.equal(written.length, 2, "one state, two widths");
  for (const f of written) assert.ok(existsSync(join(walk.out, f)), f);
  assert.deepEqual(walk.failures, []);
  assert.deepEqual(walk.notes, [localize("journey-check.states.name_not_reached_on_this_instance", "{name}: not reached on this instance", { name: `${states[1].screen}, ${states[1].state}` })]);
});

test("R21: on the local arm a state that cannot be reached fails by its name, on the live arm it is a note; a reached state passes on both", { timeout: 300000 }, async () => {
  const states = CARRIED_STATES.filter((s) => s.screen === "project").slice(0, 2);
  const name = (st) => `${st.screen}, ${st.state}`;
  const ctx = await B.newContext(); const page = await ctx.newPage();
  const reach = { [name(states[0])]: async (p) => { await p.setContent("<main>the state</main>"); return true; } };
  const local = new Walk({ out: join(dir, "c"), arm: "local" });
  const wrote = await walkStates(local, B, mock, { out: local.out, page, base: "http://x", states, reach });
  const live = new Walk({ out: join(dir, "d"), arm: "live" });
  await walkStates(live, B, mock, { out: live.out, page, base: "http://x", states, reach });
  await ctx.close();
  assert.equal(wrote.length, 2, "the reached state is paired at both widths");
  assert.deepEqual(local.failures.map((f) => f.kind), [FAIL.STATE]);
  assert.ok(local.failures[0].detail.startsWith(name(states[1])), "the failure names the state");
  assert.deepEqual(local.notes, []);
  assert.deepEqual(live.failures, []);
  assert.equal(live.notes.length, 1);
});

test("R21, F10: a reach entry keyed by its state is walked on its own page as a named step of each width, in the order of its rank, and puts back what it changed; a reach that cannot draw its state fails the state by name and says why; control: a reached state is paired", { timeout: 300000 }, async () => {
  const states = CARRIED_STATES.filter((s) => s.screen === "project").slice(0, 3);
  const order = [], undone = [];
  const ctx = await B.newContext(); const founder = await ctx.newPage(); const other = await ctx.newPage();
  const reach = {
    [stateKey(states[0])]: { reach: async (p) => { order.push(0); await p.setContent("<main>the first state</main>"); return true; }, after: async (p) => undone.push(p === other) , page: () => other },
    [stateKey(states[1])]: { rank: -1, reach: async () => { order.push(1); throw new Error("the second state's setup refused"); } },
    [stateKey(states[2])]: { reach: async (p) => { order.push(2); await p.setContent("<main>the third state</main>"); return true; } },
  };
  const walk = new Walk({ out: join(dir, "f10"), arm: "local" });
  const wrote = await walkStates(walk, B, mock, { out: walk.out, page: founder, base: "http://x", states, reach });
  await ctx.close();
  assert.deepEqual(order, [1, 0, 0, 2, 2], "rank -1 first, then the list's order, once per width (the failed one stops at its first)");
  assert.deepEqual(undone, [true], "after ran once, on the state's own page");
  assert.equal(wrote.length, 4, "two states reached, each at both widths");
  const name1 = `${states[1].screen}, ${states[1].state}`;
  assert.ok(walk.steps.some((s) => s.label === `R21 ${name1} at 1280px` && !s.ok), walk.steps.map((s) => s.label).join(" | "));
  assert.ok(walk.failures.some((f) => f.kind === FAIL.STEP && /the second state's setup refused/.test(f.detail)), "the step says why");
  assert.ok(walk.failures.some((f) => f.kind === FAIL.STATE && f.detail === unreachedOnLocal(name1)), "the state fails by name");
  assert.equal(walk.failures.length, 2, JSON.stringify(walk.failures));
});

test("R21, F10: the local arm has a reach for every carried state but those the local copy cannot draw, each of which says why; the crafted archive's directory lists one entry twice over the same bytes", () => {
  const R = localReach({ walk: {}, base: "http://x/", who: { founder: {}, member: {}, newcomer: {} },
    made: { project: "http://x/app/project/P", question: "http://x/app/question/Q" }, own: { project: "http://x/app/project/O", question: "http://x/app/question/O" } });
  const keys = CARRIED_STATES.map(stateKey);
  for (const k of [...Object.keys(R), ...Object.keys(UNREACHABLE)]) assert.ok(keys.includes(k), `${k} is no carried state`);
  for (const k of keys) assert.ok(Object.hasOwn(R, k) !== Object.hasOwn(UNREACHABLE, k), `${k}: a reach or a reason, exactly one`);
  for (const why of Object.values(UNREACHABLE)) assert.ok(why.length > 20);
  const z = overlappingZip();
  const end = z.length - 22;
  assert.equal(z.readUInt32LE(end), 0x06054b50);
  assert.equal(z.readUInt16LE(end + 10), 2, "two entries listed");
  const dir0 = z.readUInt32LE(end + 16), size = z.readUInt32LE(end + 12);
  assert.deepEqual(z.subarray(dir0, dir0 + size / 2), z.subarray(dir0 + size / 2, dir0 + size), "the same entry twice");
});

/* a fixture instance holding a published case (fake-plane.mjs `publishedPage`, drawn as the screen draws it); `bad` makes the minimum a request */
function publishedInstance({ bad = false } = {}) {
  const seen = [];
  const server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}${req.headers.authorization ? " AUTH" : ""}`);
    const send = (s, t, b) => { res.writeHead(s, { "content-type": t }); res.end(b); };
    if (req.url.startsWith("/app/assets/")) return send(200, "text/css", "main{}");
    if (req.url.startsWith("/api/")) return send(200, "application/json", '{"ok":true}');
    if (req.url.includes("/finding/")) return send(200, "text/html", publishedPage().replace(/<main[\s\S]*<\/main>/, '<main id="cs-main" data-screen="published"><h1>Finding 1</h1></main>'));
    return send(200, "text/html", publishedPage({ bad }));
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ base: `http://127.0.0.1:${server.address().port}`, seen, close: () => server.close() })));
}

test("R24: with a published case on the instance, the live arm opens it signed out at both widths, pairs it, sets a minimum, opens a finding's page and presses Print the case with print stubbed; it sends no Authorization header", { timeout: 300000 }, async () => {
  const inst = await publishedInstance();
  try {
    const walk = new Walk({ out: join(dir, "c"), arm: "live" });
    walk.copyHost = new URL(inst.base).host;
    await walkPublished(walk, B, inst.base, mock, { path: "/app/published/c1", out: walk.out });
    assert.deepEqual(walk.failures, [], walk.failures.map((f) => f.detail).join(" | "));
    assert.equal(walk.pairs.filter((p) => /^pairs\/published-(1280|390)\.png$/.test(p)).length, 2);
    assert.ok(walk.steps.some((s) => wordRx("act.owed_pubprint.label.published").test(s.label) && s.ok));
    assert.ok(!inst.seen.some((x) => /AUTH$/.test(x)), "no request carried an Authorization header");
  } finally { inst.close(); }
});

test("R24 control: a page that sets a minimum by a request fails; with no case the note is written and nothing is walked", { timeout: 300000 }, async () => {
  const inst = await publishedInstance({ bad: true });
  try {
    const walk = new Walk({ out: join(dir, "d"), arm: "live" });
    walk.copyHost = new URL(inst.base).host;
    await walkPublished(walk, B, inst.base, mock, { path: "/app/published/c1", out: walk.out });
    assert.ok(walk.failures.some((f) => /setting a minimum strength sent a request/.test(f.detail)), JSON.stringify(walk.failures));
  } finally { inst.close(); }
  const none = new Walk({ out: join(dir, "e"), arm: "live" });
  await walkPublished(none, B, "http://127.0.0.1:9", mock, { path: "", out: none.out });
  assert.deepEqual(none.notes, [NO_PUBLISHED_NOTE]);
  assert.deepEqual(none.steps, []);
});

test("R22: each dashboard is paired with the design's drawing at both widths where the arm gives the mock (the local arm); control: a mock that draws neither fails each by name", { timeout: 300000 }, async () => {
  const fp = await fakePlane({});
  try {
    const walk = new Walk({ out: join(dir, "f"), arm: "local" });
    walk.copyHost = new URL(fp.base).host;
    const ctx = await B.newContext(); const page = walk.watch(await ctx.newPage());
    try { await walkDashboards(walk, page, fp.base, { mock, b: B, out: walk.out }); } finally { await ctx.close(); }
    assert.deepEqual(walk.failures, [], JSON.stringify(walk.failures));
    for (const id of ["dash-project", "dash-action"]) for (const w of WIDTHS) {
      const file = `pairs/dashboard-${id}-${w}.png`;
      assert.ok(walk.pairs.includes(file), file);
      assert.ok(existsSync(join(walk.out, file)), file);
    }
    const bare = new Walk({ out: join(dir, "g"), arm: "local" });
    bare.copyHost = walk.copyHost;
    const ctx2 = await B.newContext(); const page2 = bare.watch(await ctx2.newPage());
    try { await walkDashboards(bare, page2, fp.base, { mock: { commit: "none", draw: async () => null }, b: B, out: bare.out }); } finally { await ctx2.close(); }
    assert.deepEqual([...new Set(bare.failures.map((f) => f.kind))], [FAIL.DESIGN]);
    assert.deepEqual(bare.pairs, []);
  } finally { await fp.close(); }
});

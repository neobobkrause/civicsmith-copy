/* link-sweep R4–R8, R10, R12: the link sweep's run, driven at the module's interface (`sweepDue`, `sweepWake`,
   `sweepTick`, `sweeps`, `sweepConditions`, the registered scope check) over the real record, promotion, provenance,
   observation log and capture, under monitoring's seam (its R65). Capture's
   `acquire` is the real module's method replaced on the instance by a scripted site in its answer shape (the bytes held
   in the evidence bucket, the document carrying the origin the caller declared). Moved from monitoring's
   `sweep-run.test.mjs` (its R56–R60, R62, R64). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { listWorld, sweepDef, NOW_MS, DAY, WEEK, site, SEED, U, page, runsOf, filedBundles } from "./fixture.mjs";
import { SWEEP_TICK_BATCH, SWEEP_ACTOR } from "../../../src/link-sweep/index.mjs";
import { listFormats } from "../../../src/formats.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { normalizeAddress } from "../../../src/subresources.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const PROJ = "PROJ-2026-0950-sweep";
const LIST = "INFO-2026-0950-list";
const NAME = `${LIST}#minutes`;
const runs = runsOf;

/* The list bundle in PROJ (alice owns it), carrying `sweeps` and `daemon`, written by alice. */
function sweepWorld({ sweeps = [sweepDef()], daemon = undefined, capture = undefined } = {}) {
  const { w, write } = listWorld({ list: LIST, project: PROJ, sweeps, daemon, opts: capture === undefined ? {} : { captureRequests: capture } });
  return { w, write: (sw, d = daemon) => write(sw, { d }) };
}

test("R6 R7 R10 (monitoring R29) a ratified sweep's run: the seed read, one hop to the links its match admits in scope, each filed as its own Information bundle at collected in the list's project, its origin the sweep's, the seed capture named; one look per fetch", async () => {
  const { w } = sweepWorld({ sweeps: [sweepDef({ match: { terms: ["minutes"], paths: [U("m/")] } })] });
  const calls = site(w, {
    [SEED]: { body: page([[U("m/2026-09.html"), "Minutes, September"], [U("m/2026-08.html"), "Minutes, August"],
                          [U("agenda.html"), "Agenda"], [U("x/minutes.html"), "Minutes elsewhere"],
                          ["https://other.example.org/council/m/1.html", "Minutes off-site"], [U("m/2026-09.html#top"), "Minutes again"]]) },
    [U("m/2026-09.html")]: { body: "<html>September minutes</html>" },
    [U("m/2026-08.html")]: { body: "<html>August minutes</html>" },
    [U("m/2026-08.html") + "/next"]: { body: "never fetched: one hop" },
  });
  assert.equal(w.s.sweepDue(NOW_MS), NOW_MS, "never run: due");
  const t = await w.s.sweepTick(NOW_MS);
  assert.deepEqual(t.ran.map((r) => [r.sweep, r.fetched, r.filed]), [[NAME, 3, 2]]);
  assert.deepEqual(calls.map((c) => c.locator), [SEED, U("m/2026-09.html"), U("m/2026-08.html")], "one hop, seed order then link order");
  /* R5's origin and scope on every fetch */
  for (const c of calls) {
    assert.deepEqual(c.opts.captureRequest.origin, { kind: "sweep", matched_sweep: NAME, deeming_actor: SWEEP_ACTOR });
    assert.deepEqual(c.opts.captureRequest.scope, ["https://records.example.org/council"]);
    assert.equal(c.opts.cls, "daemon");
  }
  /* R7: filed at collected, in the list's project, origin as R5, the seed capture named */
  const filed = filedBundles(w);
  assert.equal(filed.length, 2);
  for (const f of filed) {
    assert.deepEqual([f.current_state, f.project], ["collected", PROJ]);
    const prov = w.record.readFile(f.bundle_id, "data/provenance.json");
    assert.ok(prov && "text" in prov, "the register is held inline");
    const reg = JSON.parse(prov && "text" in prov ? prov.text : "null");
    assert.deepEqual(reg.documents[0].origin, { kind: "sweep", matched_sweep: NAME, deeming_actor: SWEEP_ACTOR });
    const notes = w.text(f.bundle_id).split("## Provenance Notes")[1];
    const seedSha = runs(w)[0].detail.seeds[0].sha;
    assert.ok(notes.includes(seedSha) && notes.includes(SEED), "the seed capture that listed it");
  }
  const d = runs(w)[0].detail;
  assert.deepEqual([d.candidates, d.matched], [5, 2], "the same address twice is one candidate; only in-scope, in-path, term-matching ones match");
  /* R10: one look per fetch, authority the sweep, PRESENT referring to the capture */
  const looks = w.looks().filter((l) => l.authority === NAME);
  assert.equal(looks.length, 3);
  assert.ok(looks.every((l) => l.authority_kind === "sweep" && l.level === "document" && l.state === "PRESENT" && /^[0-9a-f]{64}$/.test(l.result_ref)));
  /* R5: the seed's capture filed in the list bundle as a monitor snapshot, by a mechanical sweep promotion */
  assert.ok((w.record.livePaths(LIST) ?? []).some((p) => p.startsWith(`snapshots/monitor-${d.seeds[0].sha.slice(0, 12)}-index.html`)));
  assert.equal(w.manifest(LIST).at(-1).operation, "sweep");
  /* R4: not due again until its cadence passes */
  assert.equal(w.s.sweepDue(NOW_MS + DAY), null);
  assert.equal(w.s.sweepWake(NOW_MS + DAY), NOW_MS + WEEK);
  assert.equal(w.s.sweepDue(NOW_MS + WEEK), NOW_MS + WEEK);
});

test("R6 the skips: already_swept, already_held and budget_spent, the budget counted with the seeds; R12 a request filed under the sweep counts toward per_run on its next run", async () => {
  const { w, write } = sweepWorld({ sweeps: [sweepDef({ budget: { per_run: 3, backlog: 50 }, seeds: [SEED, U("feed.xml")] })] });
  const docs = ["a", "b", "c", "d"].map((x) => U(`minutes-${x}.html`));
  site(w, { [SEED]: { body: page(docs.map((u, i) => [u, `Minutes ${i}`])) },
            [U("feed.xml")]: { body: `<rss><channel><item><title>Minutes feed</title><link>${docs[0]}</link></item></channel></rss>` },
            ...Object.fromEntries(docs.map((u) => [u, { body: `<p>${u}</p>` }])) });
  /* already held: the record holds a capture at docs[1] */
  const held = w.held("INFO-2026-0951-held", docs[1], "held-bytes");
  w.capture.provenance.recordReceipt({ address: docs[1], addressNorm: normalizeAddress(docs[1]), captureSha: held.cap,
    retrieved: "2026-09-20T00:00:00Z", via: "direct", context: { authorityKind: "sweep", authority: "x", actorClass: "plane", actor: null, observe: false } });
  const t = await w.s.sweepTick(NOW_MS);
  let d = runs(w)[0].detail;
  assert.deepEqual([t.ran[0].fetched, t.ran[0].filed], [3, 1], "two seeds and one candidate: the budget counts seeds");
  assert.deepEqual(d.skipped, { already_swept: 0, already_held: 1, budget_spent: 2 });
  /* next run: the filed one is already_swept; a request capture-requests filed under the sweep since spends one */
  w.held("INFO-2026-0952-req", docs[3], "requested-bytes", { row: { retrieved: new Date(NOW_MS + WEEK - 1000).toISOString(),
    origin: { kind: "sweep", matched_sweep: NAME, deeming_actor: "run:RUN-1" } } });
  w.clock.ms = NOW_MS + WEEK;
  await w.s.sweepTick(NOW_MS + WEEK);
  d = runs(w)[1].detail;
  assert.equal(d.budget.requests, 1, "R12: the request is counted");
  assert.equal(runs(w)[1].fetched, 2, "per_run 3, less the request: two fetches (the seeds)");
  assert.equal(d.seeds.filter((s) => s.outcome === "unchanged").length, 2, "R5: bytes equal to the last capture are unchanged");
  assert.deepEqual(d.skipped, { already_swept: 1, already_held: 1, budget_spent: 2 });
  /* daemon.sweep_budget 0: no fetch, and the run says so */
  write([sweepDef({ budget: { per_run: 3, backlog: 50 }, seeds: [SEED, U("feed.xml")] })], { enabled: true, sweep_budget: 0 });
  await w.s.sweepTick(NOW_MS + 2 * WEEK);
  const z = runs(w)[2];
  assert.equal(z.fetched, 0);
  assert.match(z.detail.note, /sweep_budget allows no fetch/);
});

test("R5 R10 the seeds: one that fails is recorded with capture's reachability and the run goes on; one redirected out of scope is recorded with its target; a governed fetch is marked governed; each writes its look", async () => {
  const { w } = sweepWorld({ sweeps: [sweepDef({ seeds: [U("gone.html"), U("moved.html"), U("slow.html"), SEED] })] });
  const calls = site(w, { [U("gone.html")]: { fail: 503 }, [U("moved.html")]: { redirect: "https://elsewhere.example.org/x" },
                          [U("slow.html")]: { governed: true }, [SEED]: { body: page([]) } });
  await w.capture.recordSourceOutcome({ addressNorm: U("gone.html"), outcome: "fetch_failed", at: "2026-09-20T00:00:00Z" });
  await w.s.sweepTick(NOW_MS);
  const d = runs(w)[0].detail;
  assert.deepEqual(d.seeds.map((s) => s.outcome), ["failed", "out_of_scope_redirect", "governed", "captured"]);
  assert.ok(d.seeds[0].reachability && typeof d.seeds[0].reachability === "object", "capture's reachability (its R8)");
  assert.equal(d.seeds[1].target, "https://elsewhere.example.org/x");
  assert.deepEqual(d.redirected, [{ address: U("moved.html"), target: "https://elsewhere.example.org/x" }]);
  assert.equal(calls.length, 4);
  const looks = w.looks().filter((l) => l.authority === NAME);
  assert.deepEqual(looks.map((l) => [l.state, l.governed]), [["LOOKED_INDETERMINATE", 0], ["LOOKED_INDETERMINATE", 0],
                                                              ["LOOKED_INDETERMINATE", 1], ["PRESENT", 0]]);
  assert.match(looks[1].detail, /out_of_scope_redirect/);
});

test("R7 R10 a fetched document of a format not in match.formats is not filed (format_excluded), its fetch still counted and looked at; a skipped candidate writes no look", async () => {
  assert.ok(listFormats().includes("pdf") && listFormats().includes("html"));
  const { w } = sweepWorld({ sweeps: [sweepDef({ match: { terms: ["minutes"], formats: ["pdf"] }, budget: { per_run: 2, backlog: 20 } })] });
  site(w, { [SEED]: { body: page([[U("m1.html"), "minutes 1"], [U("m2.pdf"), "minutes 2"], [U("m3.pdf"), "minutes 3"]]) },
            [U("m1.html")]: { body: "<!DOCTYPE html><html><body>minutes</body></html>" } });
  await w.s.sweepTick(NOW_MS);
  const r = runs(w)[0];
  assert.deepEqual([r.fetched, r.filed], [2, 0]);
  assert.deepEqual(r.detail.excluded, [{ address: U("m1.html"), format: "html" }]);
  assert.equal(r.detail.skipped.budget_spent, 2);
  const looks = w.looks().filter((l) => l.authority === NAME);
  assert.equal(looks.length, 2, "the seed and the excluded fetch; the skipped candidates wrote nothing");
  assert.match(looks[1].detail, /format_excluded/);
  assert.equal(filedBundles(w).length, 0);
});

test("R4 due only when ratified, not paused, daemon enabled, its project not closed and not held; at most 5 a tick, longest-overdue first then by name, the rank's order given one; claims and re-entrance", async () => {
  const many = Array.from({ length: 7 }, (_, i) => sweepDef({ id: `s${i}`, seeds: [U(`s${i}.html`)] }));
  const { w, write } = sweepWorld({ sweeps: many });
  site(w, Object.fromEntries(many.map((s) => [s.seeds[0], { body: page([]) }])));
  const t = await w.s.sweepTick(NOW_MS);
  assert.equal(SWEEP_TICK_BATCH, 5);
  assert.deepEqual(t.ran.map((r) => r.sweep), ["s0", "s1", "s2", "s3", "s4"].map((x) => `${LIST}#${x}`));
  assert.equal(w.s.sweepWake(NOW_MS), NOW_MS + 1000, "two still due");
  /* the rank: offered as {kind: "sweep", id, waitingSince}, run in its order */
  const seen = [];
  const t2 = await w.s.sweepTick(NOW_MS + 1, (items) => { seen.push(items); return [...items].reverse(); });
  assert.deepEqual(seen[0].map((x) => [x.kind, x.id, x.waitingSince]), [["sweep", `${LIST}#s5`, null], ["sweep", `${LIST}#s6`, null]]);
  assert.deepEqual(t2.ran.map((r) => r.sweep), [`${LIST}#s6`, `${LIST}#s5`]);
  assert.equal(w.s.sweepDue(NOW_MS + 2), null);
  /* longest-overdue first: s6 ran last, so after a week s0..s4 are older */
  /* not ratified, disabled, paused, closed: never due */
  const due = (now) => w.s.sweepDue(now) !== null;
  assert.equal(write([sweepDef({ ratified: false, seeds: [U("s0.html")] })]).ok, true);
  assert.equal(due(NOW_MS + 2 * WEEK), false, "not ratified");
  write([sweepDef({ seeds: [U("s0.html")] })], { enabled: false });
  assert.equal(due(NOW_MS + 2 * WEEK), false, "daemon.enabled false");
  write([sweepDef({ seeds: [U("s0.html")] })], { enabled: true });
  assert.equal(due(NOW_MS + 2 * WEEK), true, "the negative control");
  w.stages[PROJ] = "closed";
  assert.equal(due(NOW_MS + 2 * WEEK), false, word("link-sweep.no.project_closed"));
  assert.equal(w.s.sweeps({ viewer: "member:alice", now: NOW_MS + 2 * WEEK }).sweeps[0].why, word("link-sweep.no.project_closed"));
  w.stages[PROJ] = "matured";
  w.pause(true);
  assert.equal(due(NOW_MS + 2 * WEEK), false, "paused");
  assert.equal(w.s.sweepWake(NOW_MS + 2 * WEEK), NOW_MS + 2 * WEEK + 3600000, "a pause is looked at again one interval on");
  const p = await w.s.sweepTick(NOW_MS + 2 * WEEK);
  assert.deepEqual([p.paused.paused, p.ran.length], [true, 0]);
  w.pause(false);
  /* re-entrance (monitoring R22) and a claim an unfinished tick holds (monitoring R21) */
  let release;
  const hold = new Promise((r) => { release = r; });
  const real = w.capture.acquire;
  w.capture.acquire = async (...a) => { await hold; return real(...a); };
  const first = w.s.sweepTick(NOW_MS + 2 * WEEK);
  const second = await w.s.sweepTick(NOW_MS + 2 * WEEK);
  assert.equal(second.busy, true);
  release();
  assert.equal((await first).ran.length, 1);
});

test("R8 held: at or over budget.backlog the sweep does not run and every read says held: backlog; a backlog capture cannot read (null) holds it too; the scope check refuses a held sweep", async () => {
  const { w } = sweepWorld({ sweeps: [sweepDef({ budget: { per_run: 10, backlog: 2 } })] });
  site(w, { [SEED]: { body: page([[U("m1.html"), "minutes"], [U("m2.html"), "minutes"]]) },
            [U("m1.html")]: { body: "one" }, [U("m2.html")]: { body: "two" } });
  await w.s.sweepTick(NOW_MS);
  assert.equal(w.capture.heldCount({ sweep: NAME }), 2, "two documents still at collected (capture R82)");
  const s = w.s.sweeps({ viewer: "member:alice", now: NOW_MS + WEEK }).sweeps[0];
  assert.deepEqual([s.held, s.backlog, s.backlog_limit, s.due], ["backlog", 2, 2, false]);
  assert.equal(w.s.sweepDue(NOW_MS + WEEK), null);
  assert.equal(w.s.sweepWake(NOW_MS + WEEK), NOW_MS + WEEK + 3600000, "a held sweep is looked at again one interval on");
  /* below the ceiling it runs: the negative control */
  const real = w.capture.heldCount.bind(w.capture);
  w.capture.heldCount = () => 1;
  assert.equal(w.s.sweepDue(NOW_MS + WEEK), NOW_MS + WEEK);
  /* K1129: null is held, never 0 */
  w.capture.heldCount = () => null;
  assert.equal(w.s.sweepDue(NOW_MS + WEEK), null);
  assert.equal(w.s.sweeps({ viewer: "member:alice", now: NOW_MS + WEEK }).sweeps[0].held, "backlog");
  const check = w.captureRequests.registered[0].fn;
  assert.deepEqual(await check({ sweep: NAME, locators: [U("x")] }), { ok: false, reason: "held", detail: localize("link-sweep.sweep.the_sweep_s_backlog_is", "the sweep's backlog is at or over its limit") });
  w.capture.heldCount = real;
});

/* A sweep whose runs file `yields` documents in turn, one run a week; answers each run's row. */
async function yields(list) {
  const { w } = sweepWorld({ sweeps: [sweepDef({ match: {}, budget: { per_run: 100, backlog: 1000 } })] });
  let n = 0;
  const out = [];
  for (let i = 0; i < list.length; i++) {
    const links = Array.from({ length: list[i] }, () => { n++; return [U(`d${n}.html`), "doc"]; });
    site(w, { [SEED]: { body: page(links) + `<!-- run ${i} -->` }, ...Object.fromEntries(links.map(([u]) => [u, { body: u }])) });
    w.clock.ms = NOW_MS + i * WEEK;
    await w.s.sweepTick(NOW_MS + i * WEEK);
    out.push(runs(w).at(-1));
  }
  assert.deepEqual(out.map((r) => r.filed), list, "each run filed what it was offered");
  return { w, out };
}

test("R8 the anomaly once 4 runs exist: more than three times the median of the last 8 runs and more than 5, or 0 against a median of at least 2; at the edges; kept on the run and changing nothing else", async () => {
  const anomalies = async (list) => (await yields(list)).out.map((r) => (r.anomaly ? JSON.parse(r.anomaly) : null));
  assert.deepEqual((await anomalies([2, 2, 2, 7])).at(-1), { kind: "surge", filed: 7, median: 2 });
  assert.equal((await anomalies([2, 2, 2, 6])).at(-1), null, "6 is not more than three times 2");
  assert.equal((await anomalies([1, 1, 1, 5])).at(-1), null, "5 is not more than 5");
  assert.deepEqual((await anomalies([2, 3, 2, 0])).at(-1), { kind: "dry", filed: 0, median: 2 });
  assert.equal((await anomalies([1, 2, 1, 0])).at(-1), null, "0 against a median of 1");
  assert.deepEqual(await anomalies([2, 2, 9]), [null, null, null], "3 runs: no anomaly, whatever was filed");
  assert.equal((await anomalies([2, 2, 0])).at(-1), null);
});

test("R8 R11 silent: a sweep whose last 4 runs filed nothing, not held, at the edge of 3 and 4", async () => {
  const three = (await yields([1, 0, 0, 0])).w;
  assert.equal(three.s.sweeps({ viewer: "member:alice" }).sweeps[0].silent, false, "the last 4 runs include one that filed");
  const { w } = await yields([0, 0, 0, 0]);
  assert.equal(w.s.sweeps({ viewer: "member:alice" }).sweeps[0].silent, true);
  assert.deepEqual(w.s.sweepConditions({ viewer: "member:alice" }).conditions.map((c) => c.kind), ["sweep-silent"]);
  w.capture.heldCount = () => null;
  assert.equal(w.s.sweeps({ viewer: "member:alice" }).sweeps[0].silent, false, "a held sweep is not silent");
});

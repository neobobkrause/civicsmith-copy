/* ai-runs R42–R44: the one hidden-run predicate, the post-write notice when a run opens, and the one deployment order. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, OPEN, INQ, PROJ, ORG, T0 } from "./world.mjs";
import { hiddenRuns } from "../../../src/ai-runs/index.mjs";
import { MODULE_ORDER, hiddenBundles } from "../../../src/membership/index.mjs";
import { MACHINE_CLASS_PREFIX } from "../../../src/record-grammar/index.mjs";

const HIDDEN = "PROJ-2026-0009", SHOWN = "PROJ-2026-0010";

/** Runs over every kind of context sight can turn on, each with one log row, and rows no run wrote. */
async function hiddenWorld() {
  const w = world();
  await w.group("ann", "bob", "dan");
  w.bundle(INQ);
  w.project(PROJ, "ann", { joined: ["bob"] });
  w.project(HIDDEN, "ann");
  /* D54's control: a discoverable project, which an administrator outside it still sees */
  w.project(SHOWN, "ann", { discoverable: true });
  const look = { level: "document", subject: "https://example.org/x", state: "LOOKED_ABSENT", detail: "no" };
  const opened = [
    ["RI", {}],
    ["RP", { contextType: "project", contextId: PROJ, actor: "bob", viewer: "member:bob", principalPlane: "member:bob" }],
    ["RH", { contextType: "project", contextId: HIDDEN, actor: "ann", viewer: "member:ann", principalPlane: "member:ann" }],
    ["RD", { contextType: "project", contextId: SHOWN, actor: "ann", viewer: "member:ann", principalPlane: "member:ann" }],
  ];
  for (const [run, o] of opened) {
    assert.equal((await w.runs.open(OPEN({ run, ...o }))).started, true, run);
    const p = o.principalPlane ?? ORG;
    await w.runs.tick({ run, viewer: o.viewer ?? "admin", caller: p, actor: o.actor ?? "", log: [look] });
  }
  /* a run stored before REC-153, over a context bundle this record does not hold, and a row naming no run at all */
  w.sql.exec(`INSERT INTO ai_runs (run, status, context_type, context_id, principal_plane, principal_ai, created, updated,
              expires, state) VALUES ('RX', 'running', 'inquiry', 'INQ-2026-0404', ?, 'instance', ?, ?, ?, '{}')`, ORG, T0, T0, T0);
  const copy = (authorityKind, authority) => w.sql.exec(
    `INSERT INTO observation_log (at, actor_class, actor, authority_kind, authority, level, subject_kind, subject, state,
       governed, terminal, detail) SELECT at, actor_class, actor, ?, ?, level, subject_kind, subject, state, governed,
       terminal, detail FROM observation_log WHERE authority = 'RI'`, authorityKind, authority);
  copy("run", "RX"); copy("run", "R-PURGED"); copy("run", null);
  /* rows that are not a run's, one of them spelled like a hidden run's id: never touched */
  copy("sweep", "RH"); copy("lead", "RP"); copy("link", null);
  return w;
}

test("R42: hiddenRuns(viewer) is the one tail over the run id that leaves out exactly the runs R19 answers found: false — for every viewer kind and every run — an empty tail for a machine credential, every run for an absent or unrecognised viewer, and never a row that is not a run's", async () => {
  const w = await hiddenWorld();
  const runs = [...new Set(w.rows(`SELECT authority FROM observation_log WHERE authority_kind = 'run'`).map((r) => r.authority))];
  const others = w.rows(`SELECT seq FROM observation_log WHERE authority_kind <> 'run' ORDER BY seq`).map((r) => r.seq);
  const viewers = ["admin", "member:ann", "member:bob", "member:dan", "member:second", "member:nobody",
                   `${MACHINE_CLASS_PREFIX}daemon`, `${MACHINE_CLASS_PREFIX}ai`, "who-knows", "", null, undefined, 7];
  for (const viewer of viewers) {
    const t = hiddenRuns(viewer);
    assert.deepEqual(Object.keys(t), ["sql", "args"], String(viewer));
    const kept = w.rows(`SELECT seq, authority_kind, authority FROM observation_log WHERE 1=1${t.sql} ORDER BY seq`, ...t.args);
    /* every row that is not a run's is kept, whoever asks */
    assert.deepEqual(kept.filter((r) => r.authority_kind !== "run").map((r) => r.seq), others, String(viewer));
    /* D54 (K2442): the founder's viewer is no longer a see-all; only a machine credential has no person behind it */
    const machine = typeof viewer === "string" && viewer.startsWith(MACHINE_CLASS_PREFIX);
    if (machine) assert.deepEqual(t, { sql: "", args: [] }, `${viewer}: no person behind it, the empty tail`);
    for (const run of runs) {
      const found = run != null && (await w.runs.read({ run, viewer })).found === true;
      const rowsKept = kept.some((r) => r.authority_kind === "run" && r.authority === run);
      /* a machine's empty tail keeps even a row naming no held run: it is the tail R42 names for it */
      assert.equal(rowsKept, machine || found, `${String(viewer)} × ${run}`);
    }
  }
  /* the cases spelled out */
  const sees = (viewer) => { const t = hiddenRuns(viewer);
    return [...new Set(w.rows(`SELECT authority FROM observation_log WHERE authority_kind = 'run'${t.sql}`, ...t.args).map((r) => r.authority))].sort(); };
  assert.deepEqual(sees("member:dan"), ["RI"], "neither project is dan's, and RX's context is held by nothing");
  assert.deepEqual(sees("member:bob"), ["RI", "RP"]);
  assert.deepEqual(sees("member:ann"), ["RD", "RH", "RI", "RP"]);
  /* D54 (K2442): an administrator, the founder included, neither invited nor joined, sees a hidden project at EXISTENCE
     only, never its runs; a discoverable one (control) as before */
  assert.deepEqual(sees("member:second"), ["RD", "RI"], "D54: an active administrator sees no hidden project's runs");
  assert.deepEqual(sees("admin"), ["RD", "RI"], "D54: nor does the founder");
  assert.notDeepEqual(hiddenRuns("admin"), { sql: "", args: [] }, "D54: the founder's tail is not the machine's empty one");
  for (const v of [undefined, null, "", "who-knows"]) assert.deepEqual(sees(v), [], `${String(v)}: fail closed`);
  /* pure over its argument and never throws */
  assert.deepEqual(hiddenRuns("member:dan"), hiddenRuns("member:dan"));
  assert.doesNotThrow(() => hiddenRuns({ toString() { throw new Error("x"); } }));
  assert.deepEqual(sees({ toString() { throw new Error("x"); } }), []);
});

test("R42 (K333): hiddenRuns(viewer, column) is the same predicate over a column naming a run id — it keeps exactly the rows R19 answers found: true for, for every viewer kind; the column a plain identifier, anything else refused by the tail that keeps nothing and never interpolated", async () => {
  const w = await hiddenWorld();
  /* ai_run_bounds, which this module's own counts read through the column form (R38), with one row per run plus one naming no held run and one naming none */
  for (const run of ["RI", "RP", "RH", "RX", "R-PURGED"])
    w.sql.exec(`INSERT OR IGNORE INTO ai_run_bounds (run, bound, allowed, consumed) VALUES (?, 'fetches', 3, 0)`, run);
  w.sql.exec(`CREATE TABLE side (run TEXT)`);
  w.sql.exec(`INSERT INTO side (run) VALUES (NULL), ('RI'), ('RH')`);
  const viewers = ["admin", "member:ann", "member:bob", "member:dan", "member:second", `${MACHINE_CLASS_PREFIX}ai`,
                   "who-knows", "", null, undefined];
  for (const viewer of viewers) {
    const t = hiddenRuns(viewer, "run");
    assert.deepEqual(Object.keys(t), ["sql", "args"]);
    const machine = typeof viewer === "string" && viewer.startsWith(MACHINE_CLASS_PREFIX);
    const kept = w.rows(`SELECT run FROM ai_run_bounds WHERE 1=1${t.sql} ORDER BY run`, ...t.args).map((r) => r.run);
    const want = [];
    for (const run of w.rows(`SELECT run FROM ai_run_bounds ORDER BY run`).map((r) => r.run))
      if (machine || (await w.runs.read({ run, viewer })).found === true) want.push(run);
    assert.deepEqual(kept, want, String(viewer));
    /* the same args as the observation_log form: one predicate */
    assert.deepEqual(t.args, hiddenRuns(viewer).args, String(viewer));
    const side = w.rows(`SELECT run FROM side WHERE 1=1${t.sql} ORDER BY run`, ...t.args).map((r) => r.run);
    assert.deepEqual(side, machine ? [null, "RH", "RI"] : want.filter((r) => ["RI", "RH"].includes(r)), `NULL names no run: ${String(viewer)}`);
  }
  assert.deepEqual(w.rows(`SELECT run FROM ai_run_bounds WHERE 1=1${hiddenRuns("member:dan", "run").sql} ORDER BY run`,
    ...hiddenRuns("member:dan", "run").args).map((r) => r.run), ["RI"]);
  /* a column that is not a plain identifier is refused: nothing kept, whoever asks, and never written into the SQL */
  for (const column of ["b.run", "run; DROP TABLE ai_runs", "1run", "", " run", null, 7, {}, ["run"]]) {
    for (const viewer of ["admin", "member:ann"]) {
      const t = hiddenRuns(viewer, column);
      assert.deepEqual(t, { sql: " AND 0=1", args: [] }, `${JSON.stringify(column)} ${viewer}`);
      assert.deepEqual(w.rows(`SELECT run FROM ai_run_bounds WHERE 1=1${t.sql}`, ...t.args), []);
    }
  }
  assert.equal(w.count("ai_runs"), 5, "nothing was dropped");
});

test("R38, R42 (D-113, D-486): the figures of this module's tables are registered with record-core (its R63) and taken through the caller's sight — aiRunBounds and aiRunLog keep exactly the rows R42's tail keeps, aiRuns and inquiryRunSurfacings drop the rows naming a hidden bundle, and no sight (hid null) counts whole", async () => {
  const w = await hiddenWorld();
  for (const run of ["RI", "RP", "RH", "RX", "R-PURGED"])
    w.sql.exec(`INSERT OR IGNORE INTO ai_run_bounds (run, bound, allowed, consumed) VALUES (?, 'fetches', 3, 0)`, run);
  for (const [q, run] of [[INQ, "RI"], [HIDDEN, "RH"], ["INQ-2026-0404", "RX"]])
    w.sql.exec(`INSERT INTO inquiry_run_surfacings (bundle_id, run, principal, at) VALUES (?, ?, ?, ?)`, q, run, ORG, T0);
  const KEYS = ["aiRuns", "aiRunBounds", "inquiryRunSurfacings", "aiRunLog"];
  const mine = (all) => Object.fromEntries(KEYS.map((k) => [k, all[k]]));
  const c = (q, ...a) => w.row(q, ...a).c;
  const whole = { aiRuns: 5, aiRunBounds: 5, inquiryRunSurfacings: 3, aiRunLog: c(`SELECT count(*) c FROM observation_log WHERE authority_kind = 'run'`) };
  assert.deepEqual(mine(w.record.counts(null)), whole, "no sight: whole");
  assert.deepEqual(Object.keys(w.record.counts(null)).filter((k) => KEYS.includes(k)), KEYS, "registered, in this order");
  for (const viewer of ["admin", "member:ann", "member:bob", "member:dan", "member:second", "member:nobody",
                        `${MACHINE_CLASS_PREFIX}ai`, "who-knows", "", null, 7]) {
    const hid = hiddenBundles(viewer);
    const got = mine(w.record.counts(hid));
    assert.deepEqual(got, mine(w.runs.counts(hid)), String(viewer));
    const runs = hiddenRuns(viewer, "run"), log = hiddenRuns(viewer);
    const hidden = (col) => (hid ? [` AND COALESCE(${col}, '') NOT IN ${hid.sql}`, hid.args] : ["", []]);
    const [rs, ra] = hidden("context_id"), [ss, sa] = hidden("bundle_id");
    assert.deepEqual(got, {
      aiRuns: c(`SELECT count(*) c FROM ai_runs WHERE 1=1${rs}`, ...ra),
      aiRunBounds: c(`SELECT count(*) c FROM ai_run_bounds WHERE 1=1${runs.sql}`, ...runs.args),
      inquiryRunSurfacings: c(`SELECT count(*) c FROM inquiry_run_surfacings WHERE 1=1${ss}`, ...sa),
      aiRunLog: c(`SELECT count(*) c FROM observation_log WHERE authority_kind = 'run'${log.sql}`, ...log.args),
    }, String(viewer));
  }
  /* the cases spelled out: dan sees neither project; RX's context is held by nothing, so only aiRuns counts it */
  assert.deepEqual(mine(w.record.counts(hiddenBundles("member:dan"))), { aiRuns: 2, aiRunBounds: 1, inquiryRunSurfacings: 2,
    aiRunLog: c(`SELECT count(*) c FROM observation_log WHERE authority_kind = 'run' AND authority = 'RI'`) });
  assert.deepEqual(mine(w.record.counts(hiddenBundles(""))), { aiRuns: 1, aiRunBounds: 0, inquiryRunSurfacings: 1, aiRunLog: 0 },
    "a refused viewer sees no run (fail closed)");
  const again = w.record.registerCounts("ai-runs", ["aiRuns"], () => ({}));
  assert.equal(again.code, "COUNTS_DECLARED");
});

test("R43: onRunOpened — one registration per module, a malformed or second one refused by membership's listenerRefusal; after each successful open commits every listener is called once, in the modules' total order, with {run, contextType, contextId, expires}; a listener that throws or rejects changes neither the run nor the answer", async () => {
  const w = world();
  await w.group("ann");
  w.bundle(INQ);
  const heard = [];
  for (const [m, f] of [["", () => {}], [null, () => {}], ["scheduler", null], ["scheduler", "fn"]]) {
    const r = w.runs.onRunOpened(m, f);
    assert.deepEqual([r.ok, r.code, r.reason], [false, "LISTENER_MALFORMED", "LISTENER_MALFORMED"], String(m));
  }
  /* registered out of order, heard in MODULE_ORDER: monitoring before scheduler before tasks */
  assert.deepEqual(w.runs.onRunOpened("tasks", (e) => { heard.push(["tasks", e]); throw new Error("boom"); }), { ok: true, module: "tasks" });
  assert.deepEqual(w.runs.onRunOpened("scheduler", async (e) => {
    /* committed before the notice: the run is readable from inside the listener */
    heard.push(["scheduler", e, (await w.runs.read({ run: e.run, viewer: "admin" })).found]);
    throw new Error("rejected");
  }), { ok: true, module: "scheduler" });
  assert.deepEqual(w.runs.onRunOpened("monitoring", (e) => heard.push(["monitoring", e])), { ok: true, module: "monitoring" });
  const again = w.runs.onRunOpened("scheduler", () => {});
  assert.deepEqual([again.ok, again.code, again.module], [false, "LISTENER_DECLARED", "scheduler"]);
  assert.ok(MODULE_ORDER.indexOf("monitoring") < MODULE_ORDER.indexOf("scheduler")
    && MODULE_ORDER.indexOf("scheduler") < MODULE_ORDER.indexOf("tasks"));
  /* a refused open notifies nobody */
  assert.equal((await w.runs.open(OPEN({ skillVersion: "3" }))).started, false);
  assert.deepEqual(heard, []);
  /* a successful one: each listener once, in order, with the four fields; the answer and the run are as without them */
  const quiet = world();
  await quiet.group("ann");
  quiet.bundle(INQ);
  const plain = await quiet.runs.open(OPEN({ leaseMs: 60000 }));
  const r = await w.runs.open(OPEN({ leaseMs: 60000 }));
  assert.deepEqual(r, plain, "the answer is the answer without listeners");
  const event = { run: "R1", contextType: "inquiry", contextId: INQ, expires: "2026-07-01T00:01:00Z" };
  assert.deepEqual(heard, [["monitoring", event], ["scheduler", event, true], ["tasks", event]]);
  assert.equal(r.expires, event.expires);
  assert.equal(w.row(`SELECT status FROM ai_runs WHERE run = 'R1'`).status, "running");
  /* the next open is heard again, once each */
  await w.runs.open(OPEN({ run: "R2" }));
  assert.deepEqual(heard.slice(3).map(([m, e]) => [m, e.run]), [["monitoring", "R2"], ["scheduler", "R2"], ["tasks", "R2"]]);
});

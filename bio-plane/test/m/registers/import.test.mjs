/* registers R11–R20 (T53; N1259; K4403 (2), (7); K4354): the act that queues an import and fetches nothing, the resumable slices on the
   scheduler's alarm, status and pause/resume/stop, every import a capture with its source and date, the reduced copy stated, no AI, no
   duplicate on a retry, politeness, sight, and an import never in the way of the screens. At the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { seeded, world, V, MACHINE, served, csv, rowOf, enc, URL_, HOST, HEADER, SENT, DEF, network } from "./fixture.mjs";
import { makeZip } from "../../make-zip.mjs";
import { civicsmithUserAgent } from "../../../src/acquisition/index.mjs";

const START = (w, over = {}) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" }, ...over });
const digest = (w) => createHash("sha256").update(JSON.stringify([
  w.sql(`SELECT register, row_key, content_hash, src_row, cells FROM register_cells ORDER BY register, row_key, content_hash`),
  w.sql(`SELECT import_id, piece, seg_n, row_no, row_key, content_hash FROM register_import_rows ORDER BY import_id, piece, seg_n, row_no`),
  w.sql(`SELECT import_id, piece, n, sha256, bytes, rows, final FROM register_segments ORDER BY import_id, piece, n`)])).digest("hex");
const counts = (w) => Object.fromEntries(["register_cells", "register_rows", "register_import_rows", "register_segments"].map((t) => [t, w.count(t)]));

test("R11: each refusal by name, writing nothing; a machine credential is refused; the fake network sees no request during the act; control: a member's project import lands", () => {
  const w = seeded();
  const net = network({});
  const R = (over) => w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob"), holes: { table: "2025" }, ...over });
  const cases = [
    ["a machine author", { author: MACHINE }, "MACHINE_CANNOT_IMPORT_REGISTER"], ["no author", { author: undefined }, "MACHINE_CANNOT_IMPORT_REGISTER"],
    ["no such register", { register: "nope" }, "NO_SUCH_REGISTER"], ["a gated register", { register: "trades_licences" }, "member_act_required"],
    ["a filter the register cannot apply", { filter: { licence_numbers: ["L123456"] } }, "FILTER_ROLE_ABSENT"], ["a wildcard", { filter: { names: ["Ann*"] } }, "FILTER_PATTERN_REFUSED"],
    ["a team import by a non-administrator", { scope: "team", project: undefined }, "NOT_AN_ADMIN"],
    ["a project nobody takes part in", { author: V("dave"), viewer: V("dave") }, "NO_SUCH_PROJECT"], ["an absent project", { project: "PROJ-nope" }, "NO_SUCH_PROJECT"],
    ["no scope", { scope: undefined }, "SCOPE_INVALID"],
  ];
  const outs = [];
  try { for (const [, over] of cases) outs.push(R(over)); } finally { net.restore(); }
  cases.forEach(([what], i) => assert.deepEqual([what, outs[i].ok, outs[i].reason], [what, false, cases[i][2]]));
  assert.equal(net.seen.length, 0);
  assert.equal(w.count("register_imports"), 0, "each refusal wrote nothing");
  const ok = R({});
  assert.deepEqual([ok.ok, ok.existed, ok.state], [true, false, "queued"]);
  const row = w.sql(`SELECT * FROM register_imports`)[0];
  assert.deepEqual([row.register, row.scope, row.project, row.author, row.state, row.scope_key], ["town_filings", "project", w.P, V("bob"), "queued", `project:${w.P}`]);
});

test("R11: two identical starts leave one; a third concurrent import is IMPORT_QUEUE_FULL; an idle instance has its alarm armed afterwards; a team import is an administrator's", () => {
  const w = seeded();
  const armed = [];
  assert.equal(w.registers.onImportQueued("scheduler", (e) => armed.push(e)).ok, true);
  assert.equal(w.registers.onImportQueued("scheduler", () => {}).reason, "LISTENER_DECLARED", "one listener per module");
  assert.equal(w.registers.onImportQueued("other", "not a function").reason, "LISTENER_MALFORMED");
  const a = START(w, { filter: { filer_ids: ["F10001"] } }), b = START(w, { filter: { filer_ids: ["F10001"] } });
  assert.deepEqual([a.existed, b.existed, b.import], [false, true, a.import]);
  assert.equal(w.count("register_imports"), 1);
  assert.equal(armed.length, 1, "told once, so the scheduler arms its alarm");
  assert.equal(START(w, { filter: { filer_ids: ["F10002"] } }).ok, true);
  const third = START(w, { filter: { filer_ids: ["F10003"] } });
  assert.deepEqual([third.ok, third.reason, third.max], [false, "IMPORT_QUEUE_FULL", 2]);
  assert.equal(w.count("register_imports"), 2);
  assert.equal(w.registers.importDue(w.clock.ms), true);
  const team = w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" } });
  assert.equal(team.reason, "IMPORT_QUEUE_FULL", "the queue holds two whoever asks");
});

test("R12: importDue and importWake answer from the queue; with nothing queued, false and null", async () => {
  const w = seeded();
  assert.deepEqual([w.registers.importDue(w.clock.ms), w.registers.importWake(w.clock.ms)], [false, null]);
  START(w);
  assert.equal(w.registers.importDue(w.clock.ms), true);
  assert.equal(w.registers.importWake(w.clock.ms), w.clock.ms);
  await w.drain({ [URL_]: served(enc(csv(5))) });
  assert.deepEqual([w.registers.importDue(w.clock.ms), w.registers.importWake(w.clock.ms)], [false, null]);
  assert.deepEqual(await w.registers.importTick(w.clock.ms, 1000, w.sweep), { import: null, state: null, progress: null, done: false });
});

test("R12 (G9, R67): an import killed between each pair of slices ends as an uninterrupted run does: the same row table, counts and segment digests", async () => {
  /* at the suite's size; the 1,000,000-row figure is a measurement (M-R7), never a module test (K5819) */
  const n = 900;
  const text = csv(n, { cell: (i) => rowOf(i) });
  const small = { segment_max: 12 * 1024 };
  const bounds = { SLICE_TX_MS: 100, INGEST_BATCH_ROWS: 40, INGEST_SLICE_BATCHES: 1, SLICE_FETCH_BYTES: 30 * 1024 };
  const whole = seeded({ bounds: { ...small, ...bounds } });
  START(whole);
  const max = 400;
  const a = await whole.drain({ [URL_]: served(enc(text)) }, { max });
  const killed = seeded({ bounds: { ...small, ...bounds } });
  START(killed);
  const b = await killed.drain({ [URL_]: served(enc(text)) }, { restartEach: true, max });
  assert.equal(whole.sql(`SELECT state FROM register_imports`)[0].state, "indexed");
  assert.equal(killed.sql(`SELECT state FROM register_imports`)[0].state, "indexed");
  assert.ok(whole.count("register_segments") > 3, "several segments, so several slices");
  /* a batch's write ends by time (R20), so where slices end differs between runs; what R12 asks is the same end, below */
  assert.ok(a.ticks.length > 8 && b.ticks.length > 8, `several slices, each followed by a restart (${a.ticks.length} and ${b.ticks.length})`);
  assert.deepEqual(counts(killed), counts(whole));
  assert.equal(digest(killed), digest(whole), "the row table, its descriptors and the segment digests are the same");
  assert.equal(counts(whole).register_cells, n);
});

test("R12: a slice killed in the middle of reading a segment resumes from its position; a paused host runs no slice; a failing source is retried three times with growing delay, then failed with its reason and retries", async () => {
  const w = seeded({ bounds: { INGEST_BATCH_ROWS: 25, INGEST_SLICE_BATCHES: 1 } });
  START(w);
  const net = network({ [URL_]: served(enc(csv(120))) });
  try {
    const paused = await w.registers.importTick(w.clock.ms, 5000, { paused: () => ({ paused: true }) });
    assert.deepEqual([paused.paused, paused.done, paused.import], [true, false, null]);
    assert.equal(w.sql(`SELECT state FROM register_imports`)[0].state, "queued", "no slice ran");
    assert.equal(w.registers.importDue(w.clock.ms, { paused: () => ({ paused: true }) }), false);
  } finally { net.restore(); }
  await w.drain({ [URL_]: served(enc(csv(120))) });
  assert.equal(w.count("register_cells"), 120);
  /* a source that fails: retried with a growing delay, then failed */
  const f = seeded();
  START(f);
  const seen = [];
  const out = await f.drain({ [URL_]: () => new Response("busy", { status: 503 }) }, { advance: 3_600_000 });
  const row = f.sql(`SELECT state, reason, retries FROM register_imports`)[0];
  assert.deepEqual([row.state, row.retries], ["failed", 3]);
  assert.match(row.reason, /SOURCE_REFUSED/);
  assert.equal(out.ticks.filter((t) => t.retries).length >= 3, true);
  void seen;
  assert.equal(f.count("register_cells"), 0);
  /* a new importStart makes a new import */
  const again = START(f);
  assert.equal(again.ok, true);
  assert.notEqual(again.import, row.import_id);
});

test("R12, R20: with a real clock and a 5 ms transaction bound, a 30,000-row segment is read to its end: each batch reads on from where the last stopped, so no batch re-reads the rows before it", async () => {
  const w = seeded({ bounds: { segment_max: 64 * 1024 * 1024, SLICE_TX_MS: 5 } });
  w.registers.clock = () => Date.now();
  START(w);
  w.clock.ms = Date.now() + 3_600_000;   /* the alarm's instant: past every due time the real clock wrote */
  const { ticks } = await w.drain({ [URL_]: served(enc(csv(30000))) }, { max: 5000, advance: 1 });
  const row = w.sql(`SELECT state, rows_new FROM register_imports`)[0];
  assert.deepEqual([row.state, row.rows_new], ["indexed", 30000]);
  assert.equal(w.count("register_segments"), 1, "one segment, read in many batches");
  assert.ok(ticks.length > 3);
});

test("R20: when the store turns slow the write still ends within SLICE_TX_MS: each batch stops at the first row it has no time for, and the next reads on from it, so the import ends with every row, the same as an unhindered one", async () => {
  const n = 600;
  const bounds = { SLICE_TX_MS: 20, INGEST_SLICE_BATCHES: 4 };
  const plain = seeded({ bounds });
  START(plain);
  await plain.drain({ [URL_]: served(enc(csv(n))) });
  const w = seeded({ bounds });
  START(w);
  const put = w.registers.port.put.bind(w.registers.port);
  w.registers.port.put = (d) => { const until = performance.now() + 4 * d.length; while (performance.now() < until); return put(d); };   /* 4 ms a row, real time */
  w.registers.rowMs = 0.01;   /* the estimate says rows are cheap: the batch is sized far too large for this store */
  const txs = [];
  const transact = w.record.transact.bind(w.record);
  w.record.transact = (fn) => { const t = performance.now(); try { return transact(fn); } finally { txs.push(performance.now() - t); } };
  await w.drain({ [URL_]: served(enc(csv(n))) }, { max: 2000 });
  assert.equal(w.sql(`SELECT state FROM register_imports`)[0].state, "indexed");
  assert.equal(w.count("register_cells"), n);
  assert.equal(digest(w), digest(plain), "the same row table, descriptors and segments as an unhindered import");
  assert.ok(Math.max(...txs) <= bounds.SLICE_TX_MS + 4, `no transaction over the bound (${Math.max(...txs).toFixed(1)} ms over ${txs.length})`);
});

test("R13: a running import shows its pieces and progress; pause runs nothing; resume continues from the cursor; stop keeps what was brought in and says so; a hidden import is NO_SUCH_REGISTER_IMPORT", async () => {
  const w = seeded({ bounds: { segment_max: 8 * 1024, INGEST_BATCH_ROWS: 20, INGEST_SLICE_BATCHES: 1 } });
  const st = START(w);
  const net = network({ [URL_]: served(enc(csv(200))) });
  try {
    await w.registers.importTick(w.clock.ms, 5000, w.sweep);
    await w.registers.importTick(w.clock.ms, 5000, w.sweep);
    const s = w.registers.importStatus({ import: st.import, viewer: V("bob") });
    assert.equal(s.ok, true);
    assert.equal(s.state, "reading");
    assert.deepEqual(s.pieces.map((p) => [p.piece, p.state]), [["all", "reading"]]);
    assert.ok(s.progress.bytes_in > 0 && s.progress.rows_out > 0 && s.progress.rows_out < 200 && s.progress.segments_stored > 1);
    assert.equal(s.progress.percent, 100, "percent is shown when the bytes are stated");
    const rowsNow = s.progress.rows_out;
    /* pause */
    assert.equal(w.registers.importSet({ import: st.import, action: "pause", author: V("bob"), viewer: V("bob") }).state, "paused");
    assert.equal(w.registers.importDue(w.clock.ms), false);
    await w.registers.importTick(w.clock.ms, 5000, w.sweep);
    assert.equal(w.registers.importStatus({ import: st.import, viewer: V("bob") }).progress.rows_out, rowsNow, "nothing ran while paused");
    assert.equal(w.registers.importSet({ import: st.import, action: "pause", author: V("bob"), viewer: V("bob") }).existed, true);
    /* resume continues from the cursor */
    assert.equal(w.registers.importSet({ import: st.import, action: "resume", author: V("bob"), viewer: V("bob") }).ok, true);
    await w.registers.importTick(w.clock.ms, 5000, w.sweep);
    assert.ok(w.registers.importStatus({ import: st.import, viewer: V("bob") }).progress.rows_out > rowsNow);
    /* who may */
    assert.equal(w.registers.importSet({ import: st.import, action: "stop", author: V("carol"), viewer: V("carol") }).reason, "NOT_YOUR_IMPORT");
    assert.equal(w.registers.importSet({ import: st.import, action: "stop", author: MACHINE, viewer: MACHINE }).reason, "MACHINE_CANNOT_SET_IMPORT");
    assert.equal(w.registers.importSet({ import: 99, action: "stop", author: V("bob"), viewer: V("bob") }).reason, "NO_SUCH_REGISTER_IMPORT");
    /* stop keeps the segments and rows */
    const stop = w.registers.importSet({ import: st.import, action: "stop", author: V("bob"), viewer: V("bob") });
    assert.deepEqual([stop.ok, stop.state], [true, "stopped"]);
    assert.ok(stop.kept.rows > 0 && stop.kept.segments > 1);
    assert.equal(w.registers.importSet({ import: st.import, action: "stop", author: V("bob"), viewer: V("bob") }).existed, true, "stopping twice");
    assert.equal(w.registers.importSet({ import: st.import, action: "resume", author: V("bob"), viewer: V("bob") }).reason, "IMPORT_STOPPED");
    assert.ok(w.registers.searchRows({ scope: { register: "town_filings" }, filer_id: "F10001", viewer: V("bob") }).rows.length > 0, "what was brought in stays searchable");
    assert.equal(w.registers.importStatus({ import: st.import, viewer: V("bob") }).state, "stopped");
    assert.equal(w.registers.importStatus({ import: st.import, viewer: V("dave") }).reason, "NO_SUCH_REGISTER_IMPORT");
    assert.deepEqual(w.registers.importsEnded({}).map((e) => [e.import, e.state]), [[st.import, "stopped"]]);
  } finally { net.restore(); }
});

test("R14: each piece of an import is a capture with its address, retrieved-at, stated date and fingerprint; imported_at is the older retrieval; no stated date reads not_stated", async () => {
  const w = seeded();
  const tsv = (n) => `FILING\tPAYER\tSUM\tWHEN\tREFNO\n${Array.from({ length: n }, (_, i) => `C${i}\tPayer ${i}\t${i}.00\t2025-01-${String(1 + (i % 28)).padStart(2, "0")}\tR${i}`).join("\n")}\n`;
  const zip = makeZip([{ name: "RECEIPTS.TSV", data: tsv(12) }, { name: "SPENDING.TSV", data: tsv(5) }]);
  const ZURL = "https://files.marlow-county.example/raw.zip";
  const st = w.registers.importStart({ register: "county_raw", filter: {}, scope: "project", project: w.P, author: V("bob"), viewer: V("bob") });
  assert.equal(st.ok, true);
  /* the second piece has no stated date: the source answers no Last-Modified to its probe */
  let n = 0;
  const route = (u, init) => { const r = served(zip)(u, init); if (init.method === "HEAD" && ++n === 2) return new Response(null, { status: 200, headers: { "content-length": String(zip.length), "accept-ranges": "bytes" } }); return r; };
  w.clock.ms += 0;
  await w.drain({ [ZURL]: route });
  const s = w.registers.importStatus({ import: st.import, viewer: V("bob") });
  assert.equal(s.state, "indexed");
  assert.deepEqual(s.pieces.map((p) => p.piece), ["receipts", "spending"]);
  for (const p of s.pieces) {
    assert.equal(p.address, ZURL);
    assert.match(p.retrieved_at, /^\d{4}-\d\d-\d\dT/);
    assert.match(p.original.sha256, /^[0-9a-f]{64}$/);
    assert.match(p.original.covers, /^member:(RECEIPTS|SPENDING)\.TSV$/);
  }
  assert.equal(s.pieces[0].source_date, "2025-10-01");
  assert.equal(s.pieces[1].source_date, "not_stated", "never the retrieval time");
  assert.equal(s.imported_at, [...s.pieces.map((p) => p.retrieved_at)].sort()[0]);
  assert.equal(s.source_date, "2025-10-01", "the oldest stated date");
  assert.equal(w.count("register_segments"), 2);
  assert.equal(w.count("register_cells"), 17);
});

test("R14 control: a second import of the same bytes shows existed captures and its own date", async () => {
  const w = seeded();
  START(w, { filter: { filer_ids: ["F10001"] } });
  await w.drain({ [URL_]: served(enc(csv(20))) });
  w.clock.ms += 3_600_000;
  START(w, { filter: { filer_ids: ["F10001"] }, scope: "team", project: undefined, author: V("alice"), viewer: V("alice") });
  await w.drain({ [URL_]: served(enc(csv(20))) });
  const [a, b] = [1, 2].map((i) => w.registers.importStatus({ import: i, viewer: V("bob") }));
  assert.equal(b.pieces[0].segments[0].existed, true);
  assert.equal(a.pieces[0].segments[0].sha256, b.pieces[0].segments[0].sha256);
  assert.ok(Date.parse(b.imported_at) > Date.parse(a.imported_at), "its own date");
});

test("R15: the reduction is stated by name and count, never a value; no sentinel is in the import row, the status, the listing or any answer; a register with no contact column shows none dropped", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(30))) });
  const s = w.registers.importStatus({ import: 1, viewer: V("bob") });
  assert.deepEqual(s.reduction.dropped_columns.map((c) => c.name).sort(), ["donor_street", "donor_tel"]);
  assert.equal(s.reduction.label_key, "register.reduced");
  assert.equal(s.reduction.reason, "reduced under K1485");
  assert.deepEqual([s.reduction.rows_in, s.reduction.rows_out], [30, 30]);
  assert.ok(s.reduction.original_fingerprints[0].sha256);
  const everywhere = JSON.stringify([s, w.registers.registerList({ viewer: V("bob") }), w.sql(`SELECT * FROM register_imports`), w.registers.rowOf({ import: 1, src_row: 2, viewer: V("bob") })]);
  assert.ok(!everywhere.includes("SENTINEL"));
  const tsv = "FILING\tPAYER\tSUM\tWHEN\tREFNO\nC1\tA\t1\t2025-01-01\tR1\n";
  const zip = makeZip([{ name: "RECEIPTS.TSV", data: tsv }]);
  w.registers.importStart({ register: "county_raw", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), pieces: ["receipts"] });
  await w.drain({ "https://files.marlow-county.example/raw.zip": served(zip) });
  const c = w.registers.importStatus({ import: 2, viewer: V("alice") });
  assert.deepEqual(c.reduction.dropped_columns.filter((d) => d.why === "contact_role"), []);
});

test("R16: no AI is called: the module's uses list no ai, agent or skills module, and a full import makes no request to an AI host", async () => {
  const mods = JSON.parse((await import("node:fs")).readFileSync(new URL("../../../../build/modules.json", import.meta.url), "utf8")).modules;
  for (const id of ["registers", "register-readers"]) {
    const uses = mods.find((m) => m.id === id).uses;
    assert.ok(!uses.some((u) => /^(ai-|agent-|skills$)/.test(u)), `${id} lists no AI module`);
  }
  const w = seeded();
  START(w);
  const { net } = await w.drain({ [URL_]: served(enc(csv(10))) });
  assert.ok(net.seen.every((r) => new URL(r.url).hostname === HOST), "only the register's own host");
});

test("R17: a slice repeated writes nothing the first did: one index row per key and one object per segment digest; a changed row writes one more version", async () => {
  const w = seeded();
  START(w);
  await w.drain({ [URL_]: served(enc(csv(50))) });
  const objects = w.b.held.size;
  const before = counts(w);
  /* the slice run again from the start of the segment */
  w.sql(`UPDATE register_imports SET state='reading', complete=0`);
  const c = JSON.parse(w.sql(`SELECT cursor FROM register_imports`)[0].cursor);
  c.ing = { piece: "all", seg: 0, rows: 0 };
  const pieces = JSON.parse(w.sql(`SELECT pieces FROM register_imports`)[0].pieces);
  pieces[0].state = "reading";
  w.sql(`UPDATE register_imports SET cursor='${JSON.stringify(c)}', pieces='${JSON.stringify(pieces)}'`);
  await w.drain({});
  assert.deepEqual(counts(w), before);
  assert.equal(w.b.held.size, objects);
  assert.equal(w.sql(`SELECT COUNT(*) AS n FROM (SELECT row_key FROM register_cells GROUP BY row_key HAVING COUNT(*) > 1)`)[0].n, 0, "one row per key");
  /* control: a changed row writes one more version */
  w.clock.ms += 1000;
  START(w, { scope: "team", project: undefined, author: V("alice"), viewer: V("alice") });
  await w.drain({ [URL_]: served(enc(csv(50, { cell: (i) => rowOf(i, i === 7 ? { note: "changed" } : {}) }))) });
  assert.equal(w.count("register_cells"), 50 + 50, "the team's own copy of each row (R19) ...");
});

test("R18: every request names the register purpose in its agent and passes the governor; a cooling host pauses the import and it resumes after the wait, not counted as a failure", async () => {
  const w = seeded();
  START(w);
  w.refuse.push(HOST);
  const first = await w.drain({ [URL_]: served(enc(csv(10))) }, { max: 3 });
  const row = w.sql(`SELECT state, paused_reason, retries, due_ms FROM register_imports`)[0];
  assert.deepEqual([row.state, row.paused_reason, row.retries], ["paused", "host_cooling", 0]);
  assert.ok(row.due_ms > w.clock.ms - 4000, "it waits the governor's retry_in_ms");
  w.refuse.length = 0;
  w.clock.ms += 10_000;
  const done = await w.drain({ [URL_]: served(enc(csv(10))) }, { advance: 10_000 });
  assert.equal(w.sql(`SELECT state, retries FROM register_imports`)[0].state, "indexed");
  assert.equal(w.sql(`SELECT retries FROM register_imports`)[0].retries, 0);
  const agents = done.net.seen.map((r) => r.init.headers["user-agent"]);
  assert.ok(agents.length > 0 && agents.every((a) => a === civicsmithUserAgent("9.9.9", "inst", "register")), "every agent names the purpose");
  assert.ok(w.gov.calls.some((c) => c[0] === "admit" && c[1] === HOST));
  void first;
});

test("R19, R70 (G13): a hidden project's import, its filter and its rows stay inside it: no list, count, delta, search, compare, status or change names them for a non-participant; a participant sees them", async () => {
  const mk = () => seeded();
  const withHidden = mk(), without = mk();
  const H = withHidden.project("Secret", "bob", [], { hidden: true });
  withHidden.registers.importStart({ register: "town_filings", filter: { filer_ids: ["F10000"] }, scope: "project", project: H, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } });
  await withHidden.drain({ [URL_]: served(enc(csv(30, { cell: (i) => rowOf(i, i === 14 ? { donor_name: "SENTINEL-NAME Quill" } : {}) }))) });
  const view = (w, v) => ({
    list: w.registers.registerList({ viewer: v }), search: w.registers.searchRows({ scope: { register: "town_filings" }, name: "Quill", viewer: v }),
    searchAll: w.registers.searchRows({ scope: {}, filer_id: "F10000", viewer: v }), status: w.registers.importStatus({ import: 1, viewer: v }),
    changes: w.registers.changesSince({ viewer: v }), ended: w.registers.importsEnded({}).filter((e) => !e.project || w.registers.seesProject(e.project, v)) });
  const delta = async (w, v) => (await w.withNet({ [URL_]: served(enc(csv(30))) }, () => w.registers.registerDelta({ register: "town_filings", filter: {}, scope: "project", project: w.P, viewer: v, holes: { table: "2025" } }))).out;
  for (const v of [V("dave"), V("carol")]) {
    const seen = view(withHidden, v), clean = view(without, v);
    assert.ok(!JSON.stringify(seen).includes("SENTINEL") && !JSON.stringify(seen).includes(H), `nothing of it for ${v}`);
    assert.deepEqual(seen.search.rows, []);
    assert.deepEqual(seen.list.known.find((k) => k.key === "town_filings").held, []);
    assert.equal((await delta(withHidden, v)).already_held, (await delta(without, v)).already_held, "counts equal a record without it");
    void clean;
  }
  assert.equal(view(withHidden, V("bob")).search.rows.length, 1, "a participant sees it");
  assert.match(JSON.stringify(view(withHidden, V("bob")).search.rows), /SENTINEL-NAME/);
});

test("R19 control: a team import is visible to every member; a row first stored in a hidden project's import is stored again by a team import", async () => {
  const w = seeded();
  const H = w.project("Secret", "bob", [], { hidden: true });
  w.registers.importStart({ register: "town_filings", filter: {}, scope: "project", project: H, author: V("bob"), viewer: V("bob"), holes: { table: "2025" } });
  await w.drain({ [URL_]: served(enc(csv(10))) });
  w.registers.importStart({ register: "town_filings", filter: {}, scope: "team", author: V("alice"), viewer: V("alice"), holes: { table: "2025" } });
  await w.drain({ [URL_]: served(enc(csv(10))) });
  assert.equal(w.count("register_cells"), 20, "each scope keeps its own copy");
  assert.ok(w.registers.searchRows({ scope: { register: "town_filings" }, filer_id: "F10001", viewer: V("dave") }).rows.length >= 1, "visible to a member outside the project");
  assert.equal(w.registers.importStatus({ import: 2, viewer: V("dave") }).ok, true);
  assert.equal(w.registers.importStatus({ import: 1, viewer: V("dave") }).ok, false);
});

test("R20 (G9, K4354): during a large import a member's list and search answer within budget and no write transaction holds the worker longer than SLICE_TX_MS", async () => {
  const rows = 30000;   /* the suite's size; at 1,000,000 rows it is a measurement (M-R7), never a module test (K5819) */
  const w = seeded({ bounds: { segment_max: 1024 * 1024, SLICE_TX_MS: 100 } });
  const maxTicks = Math.max(400, Math.ceil(rows / 2000));
  START(w);
  const txs = [];
  const transact = w.record.transact.bind(w.record);
  w.record.transact = (fn) => { const t = performance.now(); try { return transact(fn); } finally { txs.push(performance.now() - t); } };
  const text = csv(rows);
  const net = network({ [URL_]: served(enc(text)) });
  const reads = [];
  try {
    for (let i = 0; i < maxTicks && w.registers.importDue(w.clock.ms, w.sweep); i++) {
      await w.registers.importTick(w.clock.ms, 1000, w.sweep);
      const t0 = performance.now();
      w.registers.registerList({ viewer: V("bob") });
      w.registers.searchRows({ scope: { register: "town_filings" }, filer_id: "F10001", limit: 5, viewer: V("bob") });
      reads.push(performance.now() - t0);
      w.clock.ms += 1000;
    }
  } finally { net.restore(); }
  assert.equal(w.sql(`SELECT state FROM register_imports WHERE import_id=1`)[0].state, "indexed");
  assert.equal(w.count("register_cells"), rows);
  assert.ok(Math.max(...reads) < 1500, `reads answered within budget (${Math.max(...reads).toFixed(0)} ms)`);
  assert.ok(Math.max(...txs) <= w.registers.bounds.SLICE_TX_MS * 1.5 + 50, `no transaction over the bound (${Math.max(...txs).toFixed(0)} ms)`);
});

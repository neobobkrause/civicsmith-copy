/* store-jobs R24 (T53; N824; C9 (2)): THE JOB TABLE GAINS THE KIND `member`, KEYED BY CAPTURE SESSION. At the module's interface (`registerJob`, `jobRow`,
   `owedwork`, the ledger's alarm tick), over the assembled store on the suite's storage (store-assembly's `alarmed-store.mjs`), every module real: the rows
   are written by acquisition's own `acquire` of a ZIP (its R38 registers a `member` row for each entry) and run by acquisition's own `fileMember` (R136). */
import "../../../src/store-assembly/register.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { store } from "../store-assembly/alarmed-store.mjs";
import { bucketStandIn } from "../case-carriage/fixture.mjs";
import { makeZip } from "../../make-zip.mjs";
import { captureOf } from "../../../src/capture/index.mjs";
import { memberRow } from "../../../src/acquisition/index.mjs";
import { pendingOf, pendingOps, JOB_KINDS, PENDING_KINDS } from "../../../src/store-assembly/pending.mjs";

const sha = (b) => createHash("sha256").update(b).digest("hex");
const C = sha("a container");
const SESSION = `${C}!0`;
const world = async () => { const x = await store({ env: { CAPTURES: bucketStandIn() } }); x.jobs = pendingOf(x.ctx); return x; };
const rowsOf = (x, kind) => [...x.ctx.storage.sql.exec(`SELECT * FROM keeps_pending WHERE kind=? ORDER BY sha`, kind)];

test("R24: `member` is a kind of the table, last; the ten other kinds stay in their order", () => {
  assert.deepEqual([...JOB_KINDS], ["keep", "reading", "ocr", "subresources", "unpack", "fetch", "scan", "safe_view", "grade", "ingest", "member"]);
  assert.equal(PENDING_KINDS, JOB_KINDS);
});

test("R24: a `member` registration keyed by its session answers {ok, existed: false, state: 'queued'}; a second leaves one row; no session, or only a sha, is JOB_SESSION_MISSING", async () => {
  const x = await world();
  const detail = { container: C, container_kind: "archive", index: 0, project: null, within: 0 };
  assert.deepEqual(x.jobs.registerJob({ kind: "member", session: SESSION, detail }), { ok: true, existed: false, state: "queued" });
  assert.deepEqual(x.jobs.registerJob({ kind: "member", session: SESSION, detail }), { ok: true, existed: true, state: "queued" });
  assert.equal(rowsOf(x, "member").length, 1, "one row for the session");
  assert.deepEqual(x.jobs.registerJob({ kind: "member", sha: C }), { ok: false, reason: "JOB_SESSION_MISSING" }, "a sha and no session is refused as fetch's is");
  assert.deepEqual(x.jobs.registerJob({ kind: "member", session: "" }), { ok: false, reason: "JOB_SESSION_MISSING" });
  assert.deepEqual(x.jobs.registerJob({ kind: "member" }), { ok: false, reason: "JOB_SESSION_MISSING" });
  assert.equal(rowsOf(x, "member").length, 1, "no refusal wrote a row");
});

test("R24: acquisition's own row (`memberRow`) reads back every column R74 names; `jobrow` and `owedwork&sha=` answer it by its session key", async () => {
  const x = await world();
  const entry = memberRow({ container: C, container_kind: "message", index: 2, name_stated: "a.pdf" });
  assert.equal(entry.session, `${C}!2`);
  assert.deepEqual(x.jobs.registerJob({ ...entry, member: "member:ann" }), { ok: true, existed: false, state: "queued" });
  const row = x.jobs.jobRow({ sha: entry.session, kind: "member" });
  for (const col of ["state", "verdict", "cursor", "written", "skipped", "owed", "failed", "failed_why", "last_progress_at", "rate_per_s", "carrier", "reader_version", "priority"])
    assert.ok(Object.hasOwn(row, col), col);
  assert.equal(row.state, "queued");
  assert.equal(row.detail.container_kind, "message");
  const via = (await x.call(`/jobrow?sha=${encodeURIComponent(entry.session)}&kind=member`));
  assert.equal(via.ok, true);
  assert.equal(via.row.state, "queued");
  const owed = await pendingOps(x.jobs, new URL(`http://do/owedwork?sha=${encodeURIComponent(entry.session)}&viewer=member:ann`), { health: async () => ({}), administers: () => false }).owedwork();
  const listed = (owed.owed || []).filter((e) => e.kind === "member");
  assert.equal(listed.length, 1, JSON.stringify(owed).slice(0, 400));
});

test("R24: the real `acquire` of a ZIP registers a `member` row for each entry in the table; the alarm runs them with the light kinds by acquisition's `fileMember`, and each ends `finished`", async () => {
  const x = await world();
  const z = makeZip([{ name: "a.txt", data: "alpha" }, { name: "b.txt", data: "beta" }]);
  const real = globalThis.fetch;
  globalThis.fetch = async () => new Response(z, { headers: { "content-type": "application/zip" } });
  try {
    const out = await captureOf(x.ctx).acquire({ locator: "https://files.example/b.zip" }, { cls: "member", member: true, sessMember: "member:ann", storeName: "bio" });
    assert.equal(out.status, 200, JSON.stringify(out.body).slice(0, 300));
  } finally { globalThis.fetch = real; }
  const rows = rowsOf(x, "member");
  assert.deepEqual(rows.map((r) => r.sha), [`${sha(z)}!0`, `${sha(z)}!1`], "one row for each entry, keyed by its session");
  for (let i = 0; i < 4 && rowsOf(x, "member").some((r) => r.state !== "finished"); i++) await x.s.onAlarm(Date.now() + 3_600_000 * (i + 1));
  assert.deepEqual(rowsOf(x, "member").map((r) => [r.sha, r.state]), [[`${sha(z)}!0`, "finished"], [`${sha(z)}!1`, "finished"]], JSON.stringify(rowsOf(x, "member")).slice(0, 600));
});

test("R24 (R76 (3)): a member refusal on the row's own facts (`BAD_MEMBER`) ends the row `final` with that code, in one tick; a container not held stays owed", async () => {
  const x = await world();
  x.jobs.registerJob({ kind: "member", session: `${C}!7`, detail: { container: C, container_kind: "tar", index: 7 } });
  x.jobs.registerJob(memberRow({ container: sha("held nowhere"), container_kind: "message", index: 0 }));
  await x.s.onAlarm(Date.now() + 1000);
  const bad = x.jobs.jobRow({ sha: `${C}!7`, kind: "member" });
  assert.equal(bad.state, "final", JSON.stringify(bad).slice(0, 300));
  assert.match(JSON.stringify(bad), /BAD_MEMBER/);
  const waiting = x.jobs.jobRow({ sha: `${sha("held nowhere")}!0`, kind: "member" });
  assert.ok(!["finished", "final", "refused"].includes(waiting.state), `stays owed: ${waiting.state}`);
});

test("R24: a source-text check that the kind lists agree: `member` is in JOB_KINDS, SESSION_KEYED and RANK and is not HEAVY", () => {
  const src = readFileSync(new URL("../../../src/store-assembly/pending.mjs", import.meta.url), "utf8");
  const list = (name) => JSON.parse(src.match(new RegExp(`const ${name} = Object\\.freeze\\((\\[[^\\]]*\\])\\)`))[1]);
  assert.ok(list("JOB_KINDS").includes("member"));
  assert.deepEqual(list("SESSION_KEYED"), ["subresources", "fetch", "member"]);
  assert.ok(!list("HEAVY").includes("member"), "a member runs with the light kinds");
  const rank = src.match(/const RANK = \{([^}]*)\}/)[1];
  assert.deepEqual(rank.match(/(\w+):/g).map((s) => s.slice(0, -1)), list("JOB_KINDS"), "RANK names every kind, in JOB_KINDS' order");
});

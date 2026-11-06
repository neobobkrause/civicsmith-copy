// Copied from control-plane's suite (test/m/control-plane/r124-owed-render.test.mjs) when control-plane-door-reading took this requirement by copy (5 Nov 2026); it proves the requirement at this module's interface.
/* control-plane R124 (fix round 4b, F5; K4492, K4493; acquisition R100, plane R77): THE ALARM'S DELIVERY OF AN OWED RENDER. `deliverOwedRender({ctx, env,
   storeName, answer, session})` is what the plane hands acquisition's `owedRun` as `deliver`: it promotes the rendered document as the capture screen
   promotes an acquired one (screens-intake's own `promoteDocument`, run through the record's `promote`), filed under the project of the shell document (the
   capture session's primary) with the session's opener as author, and R123's read follows: inline when it fits, else written down (`pendingadd`) with
   `reading_pending`. Driven over a real record (`record.mjs`): the shell is promoted first as the screen promotes it. Controls throughout (K874). */
import "../../sandbox.mjs";
import "../control-plane/harness.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
/* the sources are loaded after the harness has registered the declared ops (its top-level await), as the other suites do */
const { CAPTURE_SCREEN } = await import("../../../src/screens-intake/capture.mjs");
const { deliverOwedRender } = await import("../../../src/control-plane/index.mjs");
const { captureOf } = await import("../../../src/capture/index.mjs");
const { extractionOf } = await import("../../../src/extraction/index.mjs");
const { recordOf } = await import("../../../src/record-core/index.mjs");
const { promotionOf } = await import("../../../src/promotion/index.mjs");
const { record } = await import("../control-plane/record.mjs");

const hex = (b) => createHash("sha256").update(b).digest("hex");
const MB = 1024 * 1024;

/* the screen's own composition, in process: what `cs.call` does for `promoteDocument`, as the door's delivery does it */
const screen = (ctx, who = { author: "ann", actorMemberId: "ann", actorIdentity: "member:ann", actorViewer: "member:ann" }) => ({
  now: () => Date.now(), digest: async (t) => hex(t), w: (k) => k, date: (d) => d,
  call: async (op, { query = {}, body } = {}) => (op === "allocid" ? { ok: true, ...recordOf(ctx).allocId(query.prefix, query.year) } : promotionOf(ctx).promote({ ...body, ...who })) });
const docOf = (bytes, file, extra = {}) => ({ file, locator: `https://example.org/${file}`, retrieved: "2026-10-22T00:00:00Z", profile: { format: { format: "html" } },
  authority_state: "undetermined", authority_basis: "rendered from a page", origin: { kind: "named_request" },
  capture: { sha256: hex(bytes), bytes: bytes.length, content_type: "text/html", method: "rendered", grade: "C", actor_class: "member", encoding: "binary" }, ...extra });

/* a record holding a shell page, promoted as the screen promotes it (under `project`), and a capture session begun by `opener` over it */
async function owing({ opener = "ann", project = "" } = {}) {
  const r = await record();
  /* the opener takes part in the shell's project, as one who captured into it does */
  if (project) r.ctx.storage.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?, ?, 'active', 0, '2026-10-22T00:00:00Z', '2026-10-22T00:00:00Z')`, project, opener.replace(/^member:/, "").replace(/@.*$/, ""));
  const shellBytes = new TextEncoder().encode(`<html><body>the shell page ${Math.random()}</body></html>`);
  r.objects.set(`bio/captures/${hex(shellBytes)}`, shellBytes);
  const shell = docOf(shellBytes, "shell.html");
  const made = await CAPTURE_SCREEN.parts.promoteDocument(screen(r.ctx), { doc: shell, title: "The shell", locator: shell.locator, project });
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 300));
  const session = `sess-${Math.random().toString(16).slice(2)}`;
  const state = { opened_by: opener, queue: [], render_pending: { body: {} } };
  captureOf(r.ctx).saveCaptureSession({ session, locator: shell.locator, primarySha: shell.capture.sha256, primaryFile: shell.file, base: shell.locator, state });
  const added = [];
  const env = { ...r.env, STORE: { idFromName: (n) => n, get: () => ({ fetch: async (req) => { added.push(new URL(req.url ?? req)); return new Response(JSON.stringify({ ok: true, result: { ok: true } })); } }) } };
  return { ...r, shell, shellBundle: made.bundleId, session, env, added };
}
const rendered = (r, text = "the rendered page of the shell") => {
  const bytes = new TextEncoder().encode(`<html><body>${text} ${Math.random()}</body></html>`);
  r.objects.set(`bio/captures/${hex(bytes)}`, bytes);
  return docOf(bytes, "rendered.html");
};
const bundleRow = (r, id) => [...r.ctx.storage.sql.exec(`SELECT bundle_id, project FROM bundles WHERE bundle_id = ?`, id)][0];

test("R124: the rendered document is promoted beside its shell, filed under the shell's project, by the session's opener, and its reading is made at once when it fits", async () => {
  const r = await owing();
  const doc = rendered(r);
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.reading_pending, undefined, "a page fits: read at once");
  assert.ok(bundleRow(r, out.bundleId), "the rendered document is a bundle of the record");
  assert.notEqual(out.bundleId, r.shellBundle, "beside the shell, not over it");
  assert.equal(extractionOf(r.ctx).readingFor(doc.capture.sha256, "class:admin").found, true, "its reading exists");
  assert.equal(r.added.length, 0, "nothing was written down");
});

test("R124: the rendered document lands in the shell document's project, not another (the project the opener sees the shell under)", async () => {
  /* a project is a bundle; the shell is filed in it, and the delivery reads that home from the record */
  const r = await owing({ project: "INQ-2026-0001" });
  const doc = rendered(r, "filed with its shell");
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(bundleRow(r, r.shellBundle).project, "INQ-2026-0001", "the shell is filed in its project");
  assert.equal(bundleRow(r, out.bundleId).project, "INQ-2026-0001", "the same project as the shell");
});

test("R124 (R123): a rendered document too large to read inline is written down for the alarm and the delivery says `reading_pending`", async () => {
  const r = await owing();
  const doc = rendered(r, "a very large render");
  doc.capture.bytes = 3 * MB; doc.capture.content_type = "application/pdf"; doc.profile = { format: { format: "pdf" } };
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.reading_pending, true);
  assert.deepEqual(r.added.map((u) => [u.pathname, u.searchParams.get("kind"), u.searchParams.get("sha")]), [["/pendingadd", "reading", doc.capture.sha256]]);
  assert.equal(extractionOf(r.ctx).readingFor(doc.capture.sha256, "class:admin").found, false, "not read inline");
});

test("R124 (controls): a session that is gone, one with no opener, an answer with no document and a refused promotion deliver nothing and say why; nothing is thrown", async () => {
  const r = await owing();
  const doc = rendered(r);
  const go = (over) => deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session, ...over });
  assert.deepEqual(await go({ session: "no-such-session" }), { ok: false, reason: "NO_SUCH_SESSION" });
  assert.deepEqual(await go({ answer: { ok: true } }), { ok: false, reason: "NO_RENDERED_DOCUMENT" });
  const ghost = `ghost-${Math.random().toString(16).slice(2)}`;
  captureOf(r.ctx).saveCaptureSession({ session: ghost, locator: r.shell.locator, primarySha: r.shell.capture.sha256, primaryFile: r.shell.file, base: r.shell.locator, state: { queue: [] } });
  assert.deepEqual(await go({ session: ghost }), { ok: false, reason: "NO_OPENER" });
  const bad = await go({ answer: { ok: true, document: { ...doc, file: undefined } } });
  assert.equal(bad.ok, false, "a document the promotion cannot take is refused, not thrown");
  assert.equal(typeof bad.reason, "string");
});

/* ---- fix round 6, G2 (K4562): the plane's `fetch` entry hands its finished document to the same delivery ---- */
/* a session parked for a large fetch: its primary is not a held copy (the document does not exist until the fetch ends), and its state carries the opener
   and the project the member's act named */
async function owingFetch({ opener = "ann", project = "INQ-2026-0002" } = {}) {
  const r = await record();
  if (project) r.ctx.storage.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?, ?, 'active', 0, '2026-10-22T00:00:00Z', '2026-10-22T00:00:00Z')`, project, opener.replace(/^member:/, ""));
  const session = `fetch-${Math.random().toString(16).slice(2)}`;
  const locator = "https://www.example.gov/files/BUDGET.pdf";
  captureOf(r.ctx).saveCaptureSession({ session, locator, primarySha: "f".repeat(64), primaryFile: "snapshots/BUDGET.pdf", base: locator,
    state: { queue: [{ fetch: true }], opened_by: opener, ...(project ? { project } : {}), fetch_pending: { since: "2026-10-22T00:00:00Z", declared_bytes: 15932155, why: "LARGE" } } });
  const added = [];
  const env = { ...r.env, STORE: { idFromName: (n) => n, get: () => ({ fetch: async (req) => { added.push(new URL(req.url ?? req)); return new Response(JSON.stringify({ ok: true, result: { ok: true } })); } }) } };
  return { ...r, session, env, added };
}
const fetched = (r, bytes, type = "text/html") => {
  const body = new TextEncoder().encode(`<html><body>the fetched large page ${Math.random()}</body></html>`);
  r.objects.set(`bio/captures/${hex(body)}`, body);
  return { ...docOf(body, "BUDGET.html"), capture: { ...docOf(body, "BUDGET.html").capture, bytes, content_type: type } };
};

test("R124 (G2): a document a large fetch finished is promoted under the project the member's act named, by the session's opener, and a PDF too large to read inline is written down for the alarm", async () => {
  const r = await owingFetch();
  const doc = fetched(r, 15932155, "application/pdf");
  doc.profile = { format: { format: "pdf" } };
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(bundleRow(r, out.bundleId).project, "INQ-2026-0002", "filed in the project the session carries");
  assert.equal(out.reading_pending, true);
  assert.deepEqual(r.added.map((u) => [u.pathname, u.searchParams.get("kind"), u.searchParams.get("sha")]), [["/pendingadd", "reading", doc.capture.sha256]]);
});

test("R124, R125 (G2, G5): a 12 MB text a large fetch finished is owed to the alarm as well (the size rule is by format class); a 1 MB page is read at once", async () => {
  const big = await owingFetch();
  const text = fetched(big, 12000060, "text/plain");
  text.profile = { format: { format: "text" } };
  const out = await deliverOwedRender({ ctx: big.ctx, env: big.env, storeName: "bio", answer: { ok: true, document: text }, session: big.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(out.reading_pending, true);
  assert.equal(big.added.length, 1);
  const small = await owingFetch();
  const page = fetched(small, 1 * MB);
  const ok = await deliverOwedRender({ ctx: small.ctx, env: small.env, storeName: "bio", answer: { ok: true, document: page }, session: small.session });
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.equal(ok.reading_pending, undefined);
  assert.equal(small.added.length, 0);
});

test("R124 (G2 control): a fetch session that names no project files the document under none; a render session still files beside its shell", async () => {
  const none = await owingFetch({ project: "" });
  const doc = fetched(none, 100);
  const out = await deliverOwedRender({ ctx: none.ctx, env: none.env, storeName: "bio", answer: { ok: true, document: doc }, session: none.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.ok([null, ""].includes(bundleRow(none, out.bundleId).project), `no project: ${bundleRow(none, out.bundleId).project}`);
});

test("R124 (G2; CAPTURE #48): a finished fetch is recorded through capture's `recordFetchDone({session, document, opener, project, at})`, once; a render's delivery records none; a record that throws never undoes the filing", async () => {
  const r = await owingFetch();
  const seen = [];
  captureOf(r.ctx).recordFetchDone = async (a) => { seen.push(a); return { ok: true }; };
  const doc = fetched(r, 100);
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.equal(seen.length, 1);
  assert.deepEqual([seen[0].session, seen[0].opener, seen[0].project, seen[0].document],
                   [r.session, "member:ann", "INQ-2026-0002", out.bundleId]);
  assert.match(seen[0].at, /^\d{4}-\d\d-\d\dT/);
  const bad = await owingFetch();
  captureOf(bad.ctx).recordFetchDone = async () => { throw new Error("boom"); };
  assert.equal((await deliverOwedRender({ ctx: bad.ctx, env: bad.env, storeName: "bio", answer: { ok: true, document: fetched(bad, 100) }, session: bad.session })).ok, true);
  const render = await owing();
  const spy = [];
  captureOf(render.ctx).recordFetchDone = async (a) => { spy.push(a); };
  await deliverOwedRender({ ctx: render.ctx, env: render.env, storeName: "bio", answer: { ok: true, document: rendered(render) }, session: render.session });
  assert.equal(spy.length, 0, "a render is not a fetch");
});

test("R124 (G2, CAPTURE #48 merged): with the real capture the delivery leaves one `fetch_done` row for the session: the document's bundle id, the opener and the project; a render's delivery leaves none", async () => {
  const r = await owingFetch();
  const doc = fetched(r, 100);
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  const rows = [...r.ctx.storage.sql.exec(`SELECT session, document, opener, project FROM fetch_done`)];
  assert.deepEqual(rows.map((x) => ({ ...x })), [{ session: r.session, document: out.bundleId, opener: "member:ann", project: "INQ-2026-0002" }]);
  const render = await owing();
  await deliverOwedRender({ ctx: render.ctx, env: render.env, storeName: "bio", answer: { ok: true, document: rendered(render) }, session: render.session });
  assert.equal([...render.ctx.storage.sql.exec(`SELECT 1 FROM fetch_done`)].length, 0);
});

/* ---- fix round 9, P25 (K4855; screens-intake R49): an owed fetch whose `acquire` answered `existed: true` follows the inline path ---- */
const heldBefore = async (r, doc, { project = "INQ-2026-0002", who } = {}) => {
  const made = await CAPTURE_SCREEN.parts.promoteDocument(screen(r.ctx, who), { doc, title: "Held already", locator: doc.locator, project });
  assert.equal(made.refused, undefined, JSON.stringify(made).slice(0, 300));
  return made.bundleId;
};
const bundleCount = (r) => [...r.ctx.storage.sql.exec(`SELECT bundle_id FROM bundles`)].length;

test("R124 (P25): a large fetch whose bytes a document the opener sees already holds ends done and linked to it: no second document, the fetch recorded done naming the holder", async () => {
  const r = await owingFetch();
  const doc = fetched(r, 15932155, "application/pdf");
  doc.profile = { format: { format: "pdf" } };
  const holder = await heldBefore(r, doc);
  const before = bundleCount(r);
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, existed: true, document: doc }, session: r.session });
  assert.deepEqual([out.ok, out.bundleId, out.existed], [true, holder, true], JSON.stringify(out));
  assert.equal(bundleCount(r), before, "no second document was promoted");
  const rows = [...r.ctx.storage.sql.exec(`SELECT session, document, opener FROM fetch_done`)].map((x) => ({ ...x }));
  assert.deepEqual(rows, [{ session: r.session, document: holder, opener: "member:ann" }], "the fetch is recorded done naming the holder");
});

test("R124 (P25 control): `existed: true` with no document the opener sees promotes as before; the bytes held by a document she cannot see end `CAPTURE_HELD_BY_ANOTHER_BUNDLE` with the holder named, never a bare `PROMOTE_REFUSED`", async () => {
  const fresh = await owingFetch();
  const doc = fetched(fresh, 100);
  const out = await deliverOwedRender({ ctx: fresh.ctx, env: fresh.env, storeName: "bio", answer: { ok: true, existed: true, document: doc }, session: fresh.session });
  assert.equal(out.ok, true, JSON.stringify(out));
  assert.notEqual(out.existed, true, "a promotion, not a link");
  assert.equal(bundleRow(fresh, out.bundleId).project, "INQ-2026-0002");
  /* held under another member's project: the one-home rule refuses, and the answer names the holder */
  const r = await owingFetch();
  const other = fetched(r, 100);
  r.ctx.storage.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?, ?, 'active', 0, '2026-10-22T00:00:00Z', '2026-10-22T00:00:00Z')`, "INQ-2026-0009", "bea");
  const holder = await heldBefore(r, other, { project: "INQ-2026-0009", who: { author: "bea", actorMemberId: "bea", actorIdentity: "member:bea", actorViewer: "member:bea" } });
  const refused = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, existed: true, document: other }, session: r.session });
  assert.equal(refused.ok, false, JSON.stringify(refused));
  assert.equal(refused.reason, "CAPTURE_HELD_BY_ANOTHER_BUNDLE");
  assert.ok("holder" in refused, "the holder field is stated (a name where the record names it, else null)");
  assert.ok(holder);
  /* G160 (K4980): the refusal carries the facts as provenance answered them: the digest, its `kind` and the holder (null where provenance does not name it to this caller, D-15:
     the opener shares no project with the holder's), at the top and in `detail`, the form the plane's job row reads (plane R97) */
  assert.deepEqual([refused.capture_sha, refused.kind, refused.holder], [other.capture.sha256, "whole", null], JSON.stringify(refused));
  assert.deepEqual(refused.detail, { capture_sha: other.capture.sha256, kind: "whole", holder: null }, "and the plane's row finds them in `detail`");
});

/* ---- THE CONTRACT `deliver-owed` (FIX-L; K4995, K5044 (5)). acquisition's tests hand its `owedRun` a `deliver` that answers by hand (`{ok: true}`, `{ok: false}`,
   a throw). This is what the real delivery answers, as data; each hand-built answer of theirs equals the shape here, and where the real one differs the real
   one wins. Run below against the real code: a delivery that completes, one that throws, one promotion refuses as held. */
// fixtures-run: acquisition deliver-owed
const DELIVER_OWED = {
  completes: { ok: true, keys: ["bundleId", "ok"], bundleId: "string" },
  throws: { ok: false, reason: "DELIVERY_FAILED", keys: ["detail", "ok", "reason"] },
  heldByAnother: { ok: false, reason: "CAPTURE_HELD_BY_ANOTHER_BUNDLE", keys: ["capture_sha", "detail", "holder", "kind", "ok", "reason"], kind: "whole", holder: null },
};
const shapeOf = (a) => Object.keys(a).sort();

test("R124 (contract deliver-owed, acquisition): a delivery that completes answers {ok: true, bundleId}; one that throws answers {ok: false, reason: DELIVERY_FAILED, detail} and throws nothing; one promotion refuses as held relays CAPTURE_HELD_BY_ANOTHER_BUNDLE with kind, capture_sha and holder (null where not named) at the top and in detail", async () => {
  const c = DELIVER_OWED.completes;
  const r = await owing();
  const done = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: rendered(r) }, session: r.session });
  assert.deepEqual([done.ok, shapeOf(done), typeof done.bundleId], [c.ok, c.keys, c.bundleId], JSON.stringify(done));
  /* reading_pending is the one optional key, and only when true (the read was written down) */
  const big = await owing();
  const bigDoc = rendered(big);
  bigDoc.capture.bytes = 40 * MB;
  const pending = await deliverOwedRender({ ctx: big.ctx, env: big.env, storeName: "bio", answer: { ok: true, document: bigDoc }, session: big.session });
  assert.ok(pending.ok === true && (pending.reading_pending === undefined || pending.reading_pending === true), JSON.stringify(pending));
  /* a throw inside the delivery is caught: the answer is a refusal, the render stays owed */
  const t = DELIVER_OWED.throws;
  const bad = await deliverOwedRender({ ctx: { get storage() { throw new Error("the record is gone"); } }, env: r.env, storeName: "bio", answer: { ok: true, document: rendered(r) }, session: r.session });
  assert.deepEqual([bad.ok, bad.reason, shapeOf(bad)], [t.ok, t.reason, t.keys], JSON.stringify(bad));
  assert.equal(typeof bad.detail, "string");
  /* promotion refuses the bytes as held by another bundle (the case of the test above, driven as the contract's data) */
  const h = DELIVER_OWED.heldByAnother;
  const f = await owingFetch();
  const other = fetched(f, 100);
  f.ctx.storage.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated) VALUES (?, ?, 'active', 0, '2026-10-22T00:00:00Z', '2026-10-22T00:00:00Z')`, "INQ-2026-0009", "bea");
  await heldBefore(f, other, { project: "INQ-2026-0009", who: { author: "bea", actorMemberId: "bea", actorIdentity: "member:bea", actorViewer: "member:bea" } });
  const held = await deliverOwedRender({ ctx: f.ctx, env: f.env, storeName: "bio", answer: { ok: true, existed: true, document: other }, session: f.session });
  assert.deepEqual([held.ok, held.reason, shapeOf(held), held.kind, held.holder, held.capture_sha], [h.ok, h.reason, h.keys, h.kind, h.holder, other.capture.sha256], JSON.stringify(held));
  assert.deepEqual(held.detail, { capture_sha: held.capture_sha, kind: h.kind, holder: h.holder });
});

/* ---- the member's exact case (K5258; STORE-REQUEST #8): acquisition writes a session's opener as the BARE member id, the store answers `heldat` for a viewer spelling ---- */
test("R124 (K5258): a render a member opened (opener the bare id, as acquisition writes it) is filed under its shell's project when the alarm delivers it, whichever spelling the opener has", async () => {
  for (const opener of ["ann", "member:ann", "member:ann@INQ-2026-0001"]) {
    const r = await owing({ opener, project: "INQ-2026-0001" });
    const doc = rendered(r, `delivered for ${opener}`);
    const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session });
    assert.equal(out.ok, true, `${opener}: ${JSON.stringify(out)}`);
    assert.equal(bundleRow(r, out.bundleId).project, "INQ-2026-0001", `${opener}: filed under the shell's project, not under none`);
  }
  /* control: another member's session over the same shell does not find the project (the shell is not hers to see) */
  const r = await owing({ opener: "ann", project: "INQ-2026-0001" });
  r.ctx.storage.sql.exec(`UPDATE project_participants SET member_id = 'bea'`);
  const doc = rendered(r, "delivered for a stranger");
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, document: doc }, session: r.session });
  assert.notEqual(out.ok && bundleRow(r, out.bundleId).project, "INQ-2026-0001", "an opener who is not a participant gets no project");
});

test("R124 (K5258): a render whose bytes a document the member holds already carries is linked, not promoted again, for the bare-id opener acquisition writes", async () => {
  const r = await owing({ opener: "ann", project: "INQ-2026-0001" });
  const doc = rendered(r, "held already");
  const holder = await heldBefore(r, doc, { project: "INQ-2026-0001" });
  const before = bundleCount(r);
  const out = await deliverOwedRender({ ctx: r.ctx, env: r.env, storeName: "bio", answer: { ok: true, existed: true, document: doc }, session: r.session });
  assert.deepEqual([out.ok, out.bundleId, out.existed], [true, holder, true], JSON.stringify(out));
  assert.equal(bundleCount(r), before, "no second document was promoted");
});

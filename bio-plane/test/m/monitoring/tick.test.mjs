/* monitoring R1–R10: the tick (`monitor`, the Durable Object service `op=monitor` forwards to), driven at its
   interface over the real record, promotion, provenance, observation log and capture (fixture.mjs). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, serve, sha, DAEMON, V, infoMd } from "./fixture.mjs";
// fixtures-contract: plane job-registrar
import { jobRegistrarStub } from "../../job-registrar-stub.mjs";
import { staleBaseRefusal } from "../promotion/fixtures.mjs";
import { monitorOp, monitoringOps, MONITOR_AUTHOR, DRIVE_TICK_CHECKS } from "../../../src/monitoring/index.mjs";
import { identify } from "../../../../docprofile/registry.mjs";
import { substanceDigests, DRIVE_CAPTURE_CHECKS, profileOf, profileView, firstHopWho } from "../../../src/acquisition/index.mjs";
import { registerChecks } from "../../../src/provenance/register-checks.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const LOC = "https://records.example.org/minutes.txt";
const DOC = "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit";
const EXPORT = "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/export?format=odt";
const tick = (w, id, o = {}) => w.m.monitor({ bundleId: id, viewer: DAEMON, actorClass: "machine", actor: DAEMON, ...o });
/* An empty frame site-profiles identifies CERTAIN (R2, G140): a mount point, a framework state and no readable text. */
const certainShell = (n) => `<html><head><script src="/app.${n}.js"></script></head><body><div id="root"></div><script>window.__INITIAL_STATE__={}</script><!--${"x".repeat(2400)}--></body></html>`;
/* What a refusal must leave untouched: the manifest, the looks, the reachability. */
const untouched = (w, id) => ({ manifest: w.manifest(id).length, looks: w.looks().length,
  reach: w.rows(`SELECT count(*) c FROM source_reachability`)[0].c });

test("R1 refusals, in order, each writing nothing; a store silence is named, never ABSENT", async () => {
  const w = world();
  const id = "INFO-2026-0001-doc";
  w.monitored(id, LOC, "v1", { freq: "daily" });
  const before = untouched(w, id);
  const none = await w.m.monitor({ viewer: DAEMON });
  assert.equal(none.status, 400);
  assert.equal(none.body.reason, "REQUIRED_ARGUMENT_MISSING");
  const absent = await tick(w, "INFO-2026-0999-none");
  assert.deepEqual([absent.status, absent.body.reason], [404, "ABSENT"]);
  /* invisible is ABSENT, identically */
  const unseen = await tick(w, id, { viewer: "nobody" });
  assert.deepEqual(unseen, { status: 404, body: { ok: false, reason: "ABSENT", bundleId: id } });
  assert.deepEqual(absent.body, { ok: false, reason: "ABSENT", bundleId: "INFO-2026-0999-none" });
  const off = "INFO-2026-0002-off";
  w.monitored(off, LOC, "v1-off", { enabled: false });
  const nm = await tick(w, off);
  assert.deepEqual([nm.status, nm.body.reason], [409, "NOT_MONITORED"]);
  assert.equal(nm.body.detail, "this record does not ask to be monitored", "member-read text says record (K899 (1))");
  const bad = "INFO-2026-0003-http";
  w.promote(bad, infoMd(bad, "http://records.example.org/x"));
  const nl = await tick(w, bad);
  assert.deepEqual([nl.status, nl.body.reason], [409, "NO_LOCATOR"]);
  for (const [n, addr, code] of [[4, "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUvWxYz01", "DRIVE_FOLDER_NOT_A_DOCUMENT"],
                                 [5, "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOpQrStUvWxYz01/view", "DRIVE_KIND_UNDETERMINED"],
                                 [6, "https://docs.google.com/zzz/abc", "DRIVE_SHAPE_UNRECOGNISED"]]) {
    const did = `INFO-2026-000${n}-drive`;
    w.promote(did, infoMd(did, addr));
    const b4 = untouched(w, did);
    const r = await tick(w, did);
    assert.equal(r.status, 422);
    assert.equal(r.body.reason, code);
    assert.equal(r.body.check, DRIVE_CAPTURE_CHECKS[code].check);
    assert.equal(r.body.translation, DRIVE_CAPTURE_CHECKS[code].translation);
    assert.deepEqual(untouched(w, did), b4);
  }
  assert.deepEqual(untouched(w, id), before);
  assert.equal(w.net.seen.length, 0, "no refusal fetched anything");
  /* a store that does not answer is named as silent (the control plane's envelope), never ABSENT */
  const json = (b, s = 200) => ({ b, s });
  const silent = (op) => ({ silent: op });
  const reqArg = (op, a) => ({ reason: "REQUIRED_ARGUMENT_MISSING", op, argument: a });
  const req = () => new Request("https://x/api/?op=monitor", { method: "POST", body: JSON.stringify({ bundleId: id }) });
  /* N278, N247, N313: the control plane's `doAnswer` (its rule, stood in here: `answered` exactly when the envelope
     says `ok: true`) is handed in, and the envelope is opened through it and nowhere else */
  const opened = [];
  const doAnswer = async (res) => { opened.push(1); let o = null; try { o = await (await res).json(); } catch { o = null; }
    return o && o.ok === true ? { answered: true, result: o.result } : { answered: false, result: undefined }; };
  const deadStore = { fetch: async () => { throw new Error("gone"); } };
  assert.deepEqual(await monitorOp(req(), deadStore, { json, storeSilent: silent, requiredArgument: reqArg, doAnswer }), { silent: "monitor" });
  const notOk = { fetch: async () => new Response(JSON.stringify({ ok: false }), { status: 500 }) };
  assert.deepEqual(await monitorOp(req(), notOk, { json, storeSilent: silent, requiredArgument: reqArg, doAnswer }), { silent: "monitor" });
  assert.equal(opened.length, 2, "each envelope was opened by the control plane's rule");
  const noArg = await monitorOp(new Request("https://x/", { method: "POST", body: "{}" }), deadStore,
                                { json, storeSilent: silent, requiredArgument: reqArg, doAnswer });
  assert.equal(noArg.s, 400);
  assert.equal(noArg.b.reason, "REQUIRED_ARGUMENT_MISSING");
  /* and a store that answers is relayed with its status, the verdict the store's, declared first */
  const live = { fetch: async (r) => { const u = new URL(r.url); const body = await r.json();
    return new Response(JSON.stringify({ ok: true, result: await monitoringOps(w.m, u, body).monitor() })); } };
  const relayed = await monitorOp(req(), live, { json, storeSilent: silent, requiredArgument: reqArg, doAnswer, viaSession: true, sessViewer: "nobody", storeName: "s", cls: "daemon" });
  assert.deepEqual([relayed.s, relayed.b.ok, relayed.b.reason, relayed.b.store, relayed.b.tokenClass], [404, false, "ABSENT", "s", "daemon"]);
  assert.equal(Object.keys(relayed.b)[0], "ok", "the verdict is declared first");
  const via = await monitorOp(req(), live, { json, storeSilent: silent, requiredArgument: reqArg, doAnswer, storeName: "s", cls: "daemon" });
  assert.deepEqual([opened.length, via.s, via.b.ok, via.b.store], [4, 200, true, "s"]);
  assert.equal(Object.keys(via.b)[0], "ok", "the verdict is declared first");
  /* N313: this module holds no reading of the envelope of its own: handed no `doAnswer`, it cannot read an answer, so
     the store is not asked and its answer is named silent, whatever the store would have said */
  let asked = 0;
  const counted = { fetch: async (r) => { asked++; return live.fetch(r); } };
  const manifest = w.manifest(id).length;
  assert.deepEqual(await monitorOp(req(), counted, { json, storeSilent: silent, requiredArgument: reqArg, cls: "daemon" }), { silent: "monitor" });
  assert.deepEqual([asked, w.manifest(id).length], [0, manifest], "the store was not asked and nothing was written");
  /* an envelope that answered with no status is no answer either */
  const bare = { fetch: async () => new Response(JSON.stringify({ ok: true, result: { body: {} } })) };
  assert.deepEqual(await monitorOp(req(), bare, { json, storeSilent: silent, requiredArgument: reqArg, doAnswer }), { silent: "monitor" });
});

test("R1 from the Worker, the stamps are composed from what the door decided, never read from the request: a session's member is the viewer and actor, of class member; a credential is class:<cls>, of class machine", async () => {
  const w = world();
  const id = "INFO-2026-0004-stamps";
  w.monitored(id, LOC, "s1", { freq: "daily" });
  w.net.routes[LOC] = serve("s1");
  const json = (b, s = 200) => ({ b, s });
  const doAnswer = async (res) => { let o = null; try { o = await (await res).json(); } catch { o = null; }
    return o && o.ok === true ? { answered: true, result: o.result } : { answered: false, result: undefined }; };
  const asked = [];
  const live = { fetch: async (r) => { const u = new URL(r.url); asked.push(Object.fromEntries(u.searchParams));
    return new Response(JSON.stringify({ ok: true, result: await monitoringOps(w.m, u, await r.json()).monitor() })); } };
  /* the body's own viewer or actor never wins */
  const req = () => new Request("https://x/api/?op=monitor&viewer=class:admin", { method: "POST",
    body: JSON.stringify({ bundleId: id, viewer: "class:admin", actor: "forged", actorClass: "member" }) });
  const H = { json, storeSilent: (op) => ({ silent: op }), requiredArgument: () => ({}), doAnswer, storeName: "s" };
  const viaCred = await monitorOp(req(), live, { ...H, cls: "daemon" });
  assert.deepEqual(asked.at(-1), { viewer: DAEMON, actorClass: "machine", actor: DAEMON });
  assert.deepEqual([viaCred.s, viaCred.b.ok, viaCred.b.tokenClass], [200, true, "daemon"]);
  assert.deepEqual([w.looks().at(-1).actor_class, w.looks().at(-1).actor], ["machine", DAEMON]);
  const viaSession = await monitorOp(req(), live, { ...H, cls: "member", viaSession: true, sessViewer: "nobody" });
  assert.deepEqual(asked.at(-1), { viewer: "nobody", actorClass: "member", actor: "nobody" });
  assert.deepEqual([viaSession.s, viaSession.b.reason], [404, "ABSENT"], "a session reads at its member's sight");
});

test("R2 the tick fetches the Drive export or the locator, through the host governor; a governed refusal writes a governed look and nothing else", async () => {
  const w = world();
  const id = "INFO-2026-0010-plain";
  w.monitored(id, LOC, "v1");
  w.net.routes[LOC] = serve("v1");
  await tick(w, id);
  assert.deepEqual(w.net.seen, [LOC]);
  assert.ok(w.gov.calls.some((c) => c[0] === "admit" && c[1] === "records.example.org"));
  const d = "INFO-2026-0011-drive";
  w.monitored(d, DOC, "odt-bytes", { row: { locator: EXPORT } });
  w.net.routes[EXPORT] = serve("odt-bytes", "application/vnd.oasis.opendocument.text");
  const r = await tick(w, d);
  assert.equal(w.net.seen.at(-1), EXPORT);
  assert.equal(r.body.fetched_address, EXPORT);
  assert.equal(r.body.drive.export_address, EXPORT);
  /* governed */
  const g = "INFO-2026-0012-gov";
  w.monitored(g, "https://held.example.org/a.txt", "v1-gov");
  w.gov.refuse.push("held.example.org");
  const before = { manifest: w.manifest(g).length, looks: w.looks().length, fetched: w.net.seen.length };
  const gr = await tick(w, g);
  assert.equal(gr.status, 429);
  assert.equal(gr.body.reason, "HOST_COOLING_OFF");
  assert.equal(gr.body.retry_in_ms, 5000);
  assert.equal(w.manifest(g).length, before.manifest, "the document is untouched");
  assert.equal(w.net.seen.length, before.fetched, "nothing was fetched");
  const look = w.looks().at(-1);
  assert.equal(w.looks().length, before.looks + 1);
  assert.deepEqual([look.state, look.governed, look.condition], ["LOOKED_INDETERMINATE", 1, "source-unreachable-governed"]);
});

test("R3 the baseline: the Drive export row, else the locator's row, else the archive hop naming this address; rendered is the shell digest or none; an unparsable register gives none", async () => {
  const w = world();
  /* Drive: the export row is preferred over a document-address row */
  const d = "INFO-2026-0020-drive";
  const md = infoMd(d, DOC);
  const shellSha = w.hold("app-shell"), odtSha = w.hold("the-odt");
  const row = (locator, cap) => ({ file: `snapshots/${cap.slice(0, 6)}`, locator, retrieved: "2026-09-20T00:00:00Z",
    authority: "Town Clerk", origin: { kind: "named_request" }, attestation_attempts: [],
    capture: { sha256: cap, method: "direct", grade: "B", actor_class: "daemon", encoding: "binary", bytes: 9, content_type: "text/plain" } });
  const files = (caps) => caps.map((c) => ({ path: `snapshots/${c.slice(0, 6)}`, blobSha: c, sha256: c, bytes: 9 }));
  const reg = (caps) => caps.map((c) => ({ sha256: c, path: `snapshots/${c.slice(0, 6)}`, encoding: "binary", bytes: 9 }));
  assert.equal(w.promote(d, md, { reg: [row(DOC, shellSha), row(EXPORT, odtSha)], files: files([shellSha, odtSha]), register: reg([shellSha, odtSha]) }).ok, true);
  w.net.routes[EXPORT] = serve("the-odt", "application/vnd.oasis.opendocument.text");
  assert.equal((await tick(w, d)).body.baseline, odtSha);
  /* the locator's row */
  const p = "INFO-2026-0021-plain";
  const b = w.monitored(p, LOC, "plain-v1");
  w.net.routes[LOC] = serve("plain-v1");
  assert.equal((await tick(w, p)).body.baseline, b.cap);
  /* the archive hop's row, only when no direct row is held */
  const a = "INFO-2026-0022-archive";
  const aloc = "https://gone.example.org/page.txt";
  const arch = w.monitored(a, aloc, "archived", { row: { locator: "https://web.archive.org/web/2026id_/https://gone.example.org/page.txt",
    provenance_chain: [{ via: "archive.org", document_address: "https://GONE.example.org/page.txt" }] } });
  w.net.routes[aloc] = serve("archived");
  assert.equal((await tick(w, a)).body.baseline, arch.cap);
  /* rendered: the shell digest, never the rendered one; none named is none, stated */
  const r = "INFO-2026-0023-rendered";
  const rloc = "https://app.example.org/view";
  const shell = sha("<html>shell</html>");
  const ren = w.monitored(r, rloc, "rendered-doc", { row: { capture: { method: "rendered" }, pair: { primary: "rendered", shell: { sha256: shell } } } });
  w.net.routes[rloc] = serve("<html>shell</html>", "text/html");
  const rr = await tick(w, r);
  assert.equal(rr.body.baseline, shell);
  assert.notEqual(rr.body.baseline, ren.cap);
  const r2 = "INFO-2026-0024-rendered-noshell";
  w.monitored(r2, rloc, "rendered-doc2", { row: { pair: { primary: "rendered" } } });
  const rr2 = await tick(w, r2);
  assert.equal(rr2.body.baseline, null);
  assert.match(rr2.body.note, /names no shell digest/);
  /* an unparsable register gives no baseline */
  const u = "INFO-2026-0025-unparsable";
  w.promote(u, infoMd(u, LOC), { files: [{ path: "data/provenance.json", text: "{nope", bytes: 5, sha256: sha("{nope") }] });
  const ur = await tick(w, u);
  assert.equal(ur.body.baseline, null);
  assert.equal(ur.body.note, word("monitoring.note.captured_baseline_compare"));
});

test("R3 the tick's Drive export row, else locator row, is the row capture-sources R45 chooses, the one the Drive shell sweep (R26) judges; the archive hop is only the tick's fallback after it", async () => {
  const w = world();
  const docOf = (n) => `https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ab${n}/edit`;
  const exportOf = (n) => `https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789ab${n}/export?format=odt`;
  const row = (locator, cap, extra = {}) => ({ file: `snapshots/${cap.slice(0, 8)}`, locator, retrieved: "2026-09-20T00:00:00Z",
    authority: "Town Clerk", origin: { kind: "named_request" }, attestation_attempts: [],
    capture: { sha256: cap, method: "direct", grade: "B", actor_class: "daemon", encoding: "binary", bytes: 9, content_type: "text/plain" },
    ...extra });
  /* Each case: a Drive document whose register holds `rows` (built over fresh captures), and the row R3 names. */
  const make = (n, rowsOf) => {
    const id = `INFO-2026-002${n}-r45`;
    const caps = [0, 1, 2].map((k) => w.hold(`r45 case ${n} capture ${k}`));
    const rows = rowsOf(caps, docOf(n), exportOf(n));
    const held = [...new Set(rows.map((r) => r.capture.sha256))];
    assert.equal(w.promote(id, infoMd(id, docOf(n)), { reg: rows,
      files: held.map((c) => ({ path: `snapshots/${c.slice(0, 8)}`, blobSha: c, sha256: c, bytes: 9 })),
      register: held.map((c) => ({ sha256: c, path: `snapshots/${c.slice(0, 8)}`, encoding: "binary", bytes: 9 })) }).ok, true, id);
    w.net.routes[exportOf(n)] = serve("odt", "application/vnd.oasis.opendocument.text");
    return { id, caps };
  };
  const archived = (doc) => ({ provenance_chain: [{ via: "archive.org", document_address: doc }] });
  const cases = [
    /* the export row, though the document-address row is listed first */
    [make(1, ([a, b], doc, exp) => [row(doc, a), row(exp, b)]), 1],
    /* the export row alone */
    [make(2, ([a], doc, exp) => [row(exp, a)]), 0],
    /* the document-address row, with no export row */
    [make(3, ([a], doc) => [row(doc, a)]), 0],
    /* the document-address row over an archive hop naming the document, listed before it */
    [make(4, ([a, b], doc) => [row(`https://web.archive.org/web/2026id_/${doc}`, a, archived(doc)), row(doc, b)]), 1],
    /* a row at another address chooses nothing */
    [make(5, ([a]) => [row("https://records.example.org/elsewhere", a)]), null],
  ];
  const sweep = w.m.driveShells({ viewer: DAEMON });
  const judged = new Map([...sweep.shells, ...sweep.export, ...sweep.undetermined, ...sweep.no_baseline].map((e) => [e.bundle, e]));
  for (const [{ id, caps }, at] of cases) {
    const want = at === null ? null : caps[at];
    const tick = (await w.m.monitor({ bundleId: id, viewer: DAEMON, actorClass: "machine", actor: DAEMON })).body;
    assert.equal(tick.baseline, want, `${id}: the tick's baseline`);
    const e = judged.get(id);
    assert.ok(e, `${id} is swept`);
    assert.equal(e.baseline ? e.baseline.sha256 : null, want, `${id}: the sweep judges the same row`);
  }
  /* with no export or locator row, the archive hop naming the document is the tick's baseline (the sweep has none) */
  const { id, caps } = make(6, ([a], doc) => [row(`https://web.archive.org/web/2026id_/${doc}`, a, archived(doc))]);
  assert.equal((await w.m.monitor({ bundleId: id, viewer: DAEMON, actorClass: "machine", actor: DAEMON })).body.baseline, caps[0]);
  const late = w.m.driveShells({ viewer: DAEMON }).no_baseline.find((e) => e.bundle === id);
  assert.deepEqual([late && late.verdict, late && late.baseline], ["no_baseline", null]);
});

test("R4 removed, unreachable, and the Drive shell refusals (C-48.8, C-48.9), each shell writing an unreachable look and leaving the document untouched", async () => {
  const w = world();
  for (const [n, st] of [[1, 404], [2, 410]]) {
    const id = `INFO-2026-003${n}-gone`;
    const loc = `https://records.example.org/gone${n}`;
    w.monitored(id, loc, `v1-gone-${n}`);
    w.net.routes[loc] = serve("gone", "text/plain", st);
    assert.equal((await tick(w, id)).body.status, null, "R4: the first 404 or 410 is unconfirmed (outcomes.test.mjs)");
    w.clock.ms += 24 * 3600e3;
    const r = await tick(w, id);
    assert.equal(r.body.status, "removed");
    assert.equal(w.looks().at(-1).state, "LOOKED_ABSENT");
  }
  const e = "INFO-2026-0033-err";
  w.monitored(e, "https://records.example.org/err", "v1-err");
  w.net.routes["https://records.example.org/err"] = serve("oops", "text/plain", 503);
  const er = await tick(w, e);
  assert.equal(er.body.status, null);
  assert.equal(er.body.note, "the source answered 503");
  assert.equal(w.looks().at(-1).state, "LOOKED_INDETERMINATE");
  const t = "INFO-2026-0034-throw";
  w.monitored(t, "https://records.example.org/throw", "v1-throw");
  w.net.routes["https://records.example.org/throw"] = new Error("connection reset");
  const tr = await tick(w, t);
  assert.equal(tr.body.status, null);
  assert.match(tr.body.note, /^the source could not be reached: connection reset/);
  /* Drive: declared text/html */
  const d = "INFO-2026-0035-drive";
  w.monitored(d, DOC, "odt", { row: { locator: EXPORT } });
  w.net.routes[EXPORT] = serve("<html>sign in</html>", "text/html; charset=utf-8");
  const m0 = w.manifest(d).length, l0 = w.looks().length;
  const dr = await tick(w, d);
  assert.deepEqual([dr.status, dr.body.reason, dr.body.check], [502, "DRIVE_TICK_EXPORT_IS_THE_SHELL", "C-48.8"]);
  assert.equal(dr.body.translation, DRIVE_TICK_CHECKS.DRIVE_TICK_EXPORT_IS_THE_SHELL.translation);
  assert.equal(w.manifest(d).length, m0);
  assert.equal(w.looks().length, l0 + 1);
  assert.equal(w.looks().at(-1).state, "LOOKED_INDETERMINATE");
  assert.match(w.looks().at(-1).detail, /^unreachable; the Drive export address answered `text\/html`/);
  /* Drive: bytes sniff as HTML under another declared type */
  w.net.routes[EXPORT] = serve("<!DOCTYPE html><html><head><title>x</title></head><body>app</body></html>", "application/vnd.oasis.opendocument.text");
  const br = await tick(w, d);
  assert.deepEqual([br.status, br.body.reason, br.body.check], [502, "DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL", "C-48.9"]);
  assert.equal(br.body.translation, DRIVE_TICK_CHECKS.DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL.translation);
  assert.equal(w.manifest(d).length, m0);
  assert.equal(w.looks().at(-1).state, "LOOKED_INDETERMINATE");
  assert.equal(w.fm(d).monitoring.last_checked, null, "the document's last_checked is left as it was");
});

test("R5 comparison: rendered frame, no baseline, evidentiary only when both sides earned it, else raw; `compared` and `compared_basis`", async () => {
  const w = world();
  /* rendered: equal is frame unchanged with no status; different is modified about the frame; content undetermined */
  const r = "INFO-2026-0040-rendered";
  const rloc = "https://app.example.org/r";
  const shell = sha("<html>shell-a</html>");
  w.monitored(r, rloc, "rendered", { row: { pair: { primary: "rendered", shell: { sha256: shell } } } });
  w.net.routes[rloc] = serve("<html>shell-a</html>", "text/html");
  const eq = await tick(w, r);
  assert.deepEqual([eq.body.frame, eq.body.status, eq.body.compared, eq.body.content], ["unchanged", null, "shell", "undetermined"]);
  w.net.routes[rloc] = serve("<html>shell-b</html>", "text/html");
  const ne = await tick(w, r);
  assert.deepEqual([ne.body.frame, ne.body.status, ne.body.compared, ne.body.content], ["changed", "modified", "shell", "undetermined"]);
  assert.equal(ne.body.undetermined.length, 1);
  /* no baseline: nothing compared, the check recorded */
  const n = "INFO-2026-0041-nobase";
  w.monitored(n, LOC, null);
  w.net.routes[LOC] = serve("anything");
  const nb = await tick(w, n);
  assert.deepEqual([nb.body.compared, nb.body.status, nb.body.ok], [null, null, true]);
  /* raw: the baseline recorded no determined evidentiary digest */
  const p = "INFO-2026-0042-raw";
  w.monitored(p, LOC, "raw-v1");
  w.net.routes[LOC] = serve("raw-v1");
  const raw = await tick(w, p);
  assert.deepEqual([raw.body.compared, raw.body.status], ["raw", "unchanged"]);
  assert.equal(raw.body.compared_basis, word("monitoring.captured_baseline_recorded"));
  /* evidentiary: an ASP.NET page whose machinery moved, whose substance did not */
  const aloc = "https://agendas.example.org/Agenda.aspx";
  const page = (vs, body) => `<!DOCTYPE html><html><head><title>Agenda</title></head><body><form method="post" action="./Agenda.aspx" id="form1"><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${vs}" /><input type="hidden" name="__EVENTVALIDATION" id="__EVENTVALIDATION" value="${vs}x" /><div id="content"><h1>Agenda</h1><p>${body}</p></div></form></body></html>`;
  const H = { "content-type": "text/html; charset=utf-8", "x-aspnet-version": "4.0.30319", "x-powered-by": "ASP.NET" };
  const profileOf = async (t) => {
    const ctx = { headers: H, locator: aloc, content_type: H["content-type"], text: t };
    const id = identify(ctx);
    const d = await substanceDigests(new TextEncoder().encode(t), id, ctx, sha(t), false, null);
    return { handler: id.handler.key, handler_version: id.handler.version, digests: d };
  };
  const base = page("AAAA", "Item one");
  const e = "INFO-2026-0043-aspnet";
  w.monitored(e, aloc, base, { row: { profile: await profileOf(base) } });
  const at = (t) => () => new Response(t, { headers: H });
  w.net.routes[aloc] = at(page("BBBB", "Item one"));
  const ev = await tick(w, e);
  assert.deepEqual([ev.body.compared, ev.body.status], ["evidentiary", "unchanged"]);
  assert.match(ev.body.compared_basis, /^the evidentiary digests were compared, both normalised under aspnet_webforms v1 \(certain\)$/);
  assert.notEqual(ev.body.seen, ev.body.baseline);
  w.net.routes[aloc] = at(page("CCCC", "Item two"));
  const ch = await tick(w, e);
  assert.deepEqual([ch.body.compared, ch.body.status, ch.body.note], ["evidentiary", "modified", word("monitoring.note.substance_source_differs")]);
  /* a handler mismatch compares raw, and says why */
  const e2 = "INFO-2026-0044-mismatch";
  const base2 = page("AAAB", "Item one");
  w.monitored(e2, aloc, base2, { row: { profile: { ...(await profileOf(base2)), handler_version: 99 } } });
  w.net.routes[aloc] = at(page("DDDD", "Item one"));
  const mm = await tick(w, e2);
  assert.equal(mm.body.compared, "raw");
  assert.match(mm.body.compared_basis, /but the baseline was normalised under aspnet_webforms v99, so the raw bytes were compared$/);
  /* a digest taken over a different member compares raw */
  const e3 = "INFO-2026-0045-over";
  const base3 = page("AAAC", "Item one");
  const prof3 = await profileOf(base3);
  w.monitored(e3, aloc, base3, { row: { profile: { ...prof3, digests: { ...prof3.digests, over: "content.xml" } } } });
  const ov = await tick(w, e3);
  assert.equal(ov.body.compared, "raw");
  assert.match(ov.body.compared_basis, /^the baseline's evidentiary digest was taken over content.xml but the fetched bytes' over the normalised text/);
});

test("R6 assess over the baseline's own bytes, verified by hash; each way it cannot run is a named basis; the fetched type and contract are read; the cadence by R14", async () => {
  const w = world();
  const id = "INFO-2026-0050-assess";
  const b = w.monitored(id, LOC, "baseline text", { freq: "weekly" });
  w.net.routes[LOC] = serve("baseline text");
  const ok = await tick(w, id);
  assert.ok(ok.body.assessment, "assess ran");
  assert.equal(ok.body.assessment.verdict, "identical");
  assert.match(ok.body.assessment_basis, /^assessed against the baseline's own bytes \(/);
  assert.equal(ok.body.cadence.frequency, "weekly");
  assert.equal(ok.body.cadence.source, "authored");
  assert.ok(ok.body.cadence.contract, "the fetched document's contract is read");
  /* the bytes held under the key do not hash to the baseline */
  w.bkt.held.set(`bio/captures/${b.cap}`, new TextEncoder().encode("tampered"));
  const bad = await tick(w, id);
  assert.equal(bad.body.assessment, null);
  assert.equal(bad.body.assessment_basis, word("monitoring.why.bytes_held_baseline"));
  /* not held */
  w.bkt.held.delete(`bio/captures/${b.cap}`);
  assert.equal((await tick(w, id)).body.assessment_basis, word("monitoring.why.baseline_bytes_held"));
  /* not text */
  w.net.routes[LOC] = serve(new Uint8Array([0, 1, 2, 3]), "application/octet-stream");
  assert.equal((await tick(w, id)).body.assessment_basis, word("monitoring.why.fetched_document_read"));
  /* no document served */
  w.net.routes[LOC] = serve("x", "text/plain", 500);
  assert.equal((await tick(w, id)).body.assessment_basis, word("monitoring.why.source_served_document"));
  /* no baseline */
  const n = "INFO-2026-0051-nobase";
  w.monitored(n, LOC, null);
  w.net.routes[LOC] = serve("hello");
  const nb = await tick(w, n);
  assert.equal(nb.body.assessment_basis, word("monitoring.why.captured_baseline_compare"));
  assert.equal(nb.body.cadence.source, "contract");
  /* no capture store on the instance */
  const x = world({ evidence: false });
  x.monitored("INFO-2026-0052-nostore", LOC, null);
  x.promote("INFO-2026-0053-reg", infoMd("INFO-2026-0053-reg", LOC), {
    reg: [{ file: "snapshots/a", locator: LOC, retrieved: "2026-09-20T00:00:00Z", authority: "Town Clerk", origin: { kind: "named_request" },
            attestation_attempts: [], capture: { sha256: sha("zz"), method: "direct", grade: "B", actor_class: "daemon", encoding: "binary", bytes: 2, content_type: "text/plain" } }],
    files: [{ path: "snapshots/a", blobSha: sha("zz"), sha256: sha("zz"), bytes: 2 }],
    register: [{ sha256: sha("zz"), path: "snapshots/a", encoding: "binary", bytes: 2 }] });
  x.net.routes[LOC] = serve("zz");
  assert.equal((await tick(x, "INFO-2026-0053-reg")).body.assessment_basis,
    "R2 is not configured on this instance, so the baseline's bytes are not reachable");
});

test("R7 a shell captured as the document grades no change: the status withdrawn, the look indeterminate; removed is not affected", async () => {
  const w = world();
  const id = "INFO-2026-0060-shell";
  const loc = "https://spa.example.org/app";
  const shellPage = certainShell;
  assert.equal(identify({ locator: loc, address: loc, content_type: "text/html", text: shellPage("aaaa") }).shell, true, "the control is a CERTAIN shell");
  w.monitored(id, loc, shellPage("aaaa"));
  w.net.routes[loc] = serve(shellPage("bbbb"), "text/html");
  const r = await tick(w, id);
  assert.equal(r.body.status, null);
  assert.match(r.body.note, /unmonitorable/);
  assert.equal(r.body.reeval_raised, false);
  assert.equal(w.looks().at(-1).state, "LOOKED_INDETERMINATE");
  assert.match(w.looks().at(-1).detail, /^unmonitorable;/);
  w.net.routes[loc] = serve(shellPage("cccc"), "text/html", 404);
  await tick(w, id);                                /* R4: the first 404 is unconfirmed; a look a day on confirms it */
  w.clock.ms += 24 * 3600e3;
  const g = await tick(w, id);
  assert.equal(g.body.status, "removed");
  assert.equal(g.body.reeval_raised, true);
});

test("R7 only a CERTAIN client-rendered match is an empty frame: a POSSIBLE one, a CSV and plain prose are judged by their document type and contract (G140)", async () => {
  const w = world();
  const weak = (n) => `<!DOCTYPE html><html><head><title>Minutes</title><script src="/static/js/main.${n}.js"></script></head><body><h1>Minutes</h1><p>${"The council met and discussed the budget. ".repeat(20)}</p><div id="root"></div></body></html>`;
  const weakLoc = "https://records.example.org/minutes-page";
  assert.equal(identify({ locator: weakLoc, address: weakLoc, content_type: "text/html", text: weak("aaaa") }).shell, undefined,
    "the fixture is a weak client-rendered match, not a certain one");
  const cases = [
    ["INFO-2026-0061-weak", weakLoc, weak("aaaa"), weak("bbbb"), "text/html"],
    ["INFO-2026-0062-csv", "https://records.example.org/budget.csv", "name,amount\nfoo,1\n", "name,amount\nfoo,1\nbar,2\n", "text/csv"],
    ["INFO-2026-0063-prose", "https://records.example.org/notes.txt", "The council met on Tuesday and discussed the budget at length.\n",
      "The council met on Tuesday and discussed the budget at length. It adjourned late.\n", "text/plain"],
  ];
  for (const [id, loc, was, now, type] of cases) {
    w.monitored(id, loc, was);
    w.net.routes[loc] = serve(now, type);
    const r = await tick(w, id);
    const held = w.rows(`SELECT content_type, contract FROM monitor_address_type WHERE address = ?`, loc)[0];
    assert.ok(held && held.content_type, `${id} states its document type`);
    assert.notEqual(held.contract, "unmonitorable", `${id} is not an empty frame`);
    assert.doesNotMatch(String(r.body.note), /unmonitorable/, id);
    assert.doesNotMatch(String(w.looks().at(-1).detail), /^unmonitorable;/, id);
  }
});

test("R8 one mechanical promotion changing only the permitted fields, with a Session Log entry; every other file carried unchanged; the flag rule", async () => {
  const w = world();
  const id = "INFO-2026-0070-write";
  const b = w.monitored(id, LOC, "same bytes", { freq: "daily" });
  const liveBefore = w.text(id);
  const filesBefore = w.rows(`SELECT path, sha256 FROM files WHERE bundle_id=? AND path<>'bundle.md' ORDER BY path`, id);
  w.net.routes[LOC] = serve("same bytes");
  const r = await tick(w, id);
  assert.equal(r.body.ok, true);
  const m = w.manifest(id).at(-1);
  assert.deepEqual([m.writer, m.operation, m.author, m.base], ["mechanical", "monitor-tick", MONITOR_AUTHOR, sha(liveBefore)]);
  const after = w.text(id);
  const fmB = parseFrontmatter(liveBefore).data, fmA = parseFrontmatter(after).data;
  assert.equal(fmA.monitoring.last_checked, r.body.checked);
  assert.equal(fmA.last_updated, r.body.checked);
  assert.equal(fmA.source_status, "unchanged");
  assert.equal(fmA.reeval_pending.flag, false);
  for (const k of Object.keys(fmB)) if (!["last_updated", "monitoring", "source_status", "reeval_pending"].includes(k))
    assert.deepEqual(fmA[k], fmB[k], `${k} unchanged`);
  assert.match(after, /### Session 2026-09-28T12:00:00Z\n\nMonitor tick: the source still serves the captured bytes \(compared raw\)/);
  assert.deepEqual(w.rows(`SELECT path, sha256 FROM files WHERE bundle_id=? AND path<>'bundle.md' ORDER BY path`, id), filesBefore);
  assert.equal(r.body.reeval_raised, false);
  /* last_checked is added when absent */
  const a = "INFO-2026-0071-nolast";
  const md = infoMd(a, LOC).replace("  last_checked: null\n", "");
  w.promote(a, md);
  const ar = await tick(w, a);
  assert.equal(w.fm(a).monitoring.last_checked, ar.body.checked);
  /* flagged: modified unless assess settled it; removed */
  w.net.routes[LOC] = serve("different bytes");
  const f = await tick(w, id);
  assert.equal(f.body.status, "modified");
  assert.equal(f.body.reeval_raised, true);
  const ff = w.fm(id);
  assert.deepEqual([ff.reeval_pending.flag, ff.reeval_pending.since, ff.reeval_pending.source], [true, f.body.checked, "source_status"]);
  assert.equal(ff.source_status, "modified");
  assert.ok(b.cap);
});

test("R8 a change assess settles as routine or restyled raises no flag", async () => {
  const w = world();
  const aloc = "https://agendas.example.org/List.aspx";
  const page = (vs, extra) => `<!DOCTYPE html><html><head><title>Agenda</title></head><body><form method="post" action="./List.aspx" id="form1"><input type="hidden" name="__VIEWSTATE" id="__VIEWSTATE" value="${vs}" /><div id="content"><h1>Agenda</h1><p>Item one</p></div>${extra}</form></body></html>`;
  const H = { "content-type": "text/html; charset=utf-8", "x-aspnet-version": "4.0.30319", "x-powered-by": "ASP.NET" };
  const id = "INFO-2026-0072-settled";
  w.monitored(id, aloc, page("AAAA", ""));
  w.net.routes[aloc] = () => new Response(page("BBBB", ""), { headers: H });
  const r = await tick(w, id);
  assert.equal(r.body.status, "modified", "the raw bytes differ");
  assert.ok(["identical", "unchanged", "restyled", "routine"].includes(r.body.assessment.verdict), r.body.assessment.verdict);
  assert.equal(r.body.reeval_raised, false);
  assert.equal(w.fm(id).reeval_pending.flag, false);
});

test("R9 a non-rendered modified tick captures what it fetched, files it with a register row, and says why whenever it cannot", async () => {
  const w = world();
  const id = "INFO-2026-0080-cap";
  w.monitored(id, LOC, "v1 bytes");
  w.net.routes[LOC] = serve("v2 bytes");
  const r = await tick(w, id);
  const s2 = sha("v2 bytes");
  const c = r.body.capture;
  assert.deepEqual(Object.keys(c).sort(), ["bytes", "content_type", "existed", "fetched_address", "file", "held", "registered", "retrieved", "sha256", "taken_by", "why"].sort());
  assert.deepEqual([c.sha256, c.held, c.existed, c.registered, c.why, c.bytes], [s2, true, false, true, null, 8]);
  assert.equal(c.file, `snapshots/monitor-${s2.slice(0, 12)}-minutes.txt`);
  assert.ok(w.bkt.held.has(`bio/captures/${s2}`));
  assert.equal(w.row(`SELECT bundle_id FROM register WHERE capture_sha=?`, s2).bundle_id, id);
  assert.ok(w.row(`SELECT 1 x FROM files WHERE bundle_id=? AND path=?`, id, c.file));
  /* held already: existed */
  const id2 = "INFO-2026-0081-cap2";
  w.monitored(id2, "https://records.example.org/other.txt", "o1");
  w.hold("o2");
  w.net.routes["https://records.example.org/other.txt"] = serve("o2");
  const r2 = await tick(w, id2);
  assert.equal(r2.body.capture.existed, true);
  /* refused with them (one capture, one home): retried without, the refusal kept as why */
  const id3 = "INFO-2026-0082-cap3";
  w.monitored(id3, "https://records.example.org/third.txt", "t1");
  w.net.routes["https://records.example.org/third.txt"] = serve("v2 bytes");
  const r3 = await tick(w, id3);
  assert.equal(r3.body.ok, true, "the tick is still recorded");
  assert.equal(r3.body.capture.registered, false);
  assert.equal(r3.body.capture.file, null);
  assert.match(r3.body.capture.why, /^the promotion filing them was refused \(/);
  assert.match(w.text(id3), /were not filed: the promotion filing them was refused/);
  /* no capture store is a stated why */
  const x = world({ evidence: false });
  x.promote("INFO-2026-0083-nostore", infoMd("INFO-2026-0083-nostore", LOC), {
    reg: [{ file: "snapshots/a", locator: LOC, retrieved: "2026-09-20T00:00:00Z", authority: "Town Clerk", origin: { kind: "named_request" },
            attestation_attempts: [], capture: { sha256: sha("zz"), method: "direct", grade: "B", actor_class: "daemon", encoding: "binary", bytes: 2, content_type: "text/plain" } }],
    files: [{ path: "snapshots/a", blobSha: sha("zz"), sha256: sha("zz"), bytes: 2 }],
    register: [{ sha256: sha("zz"), path: "snapshots/a", encoding: "binary", bytes: 2 }] });
  x.net.routes[LOC] = serve("zz2");
  const r4 = await tick(x, "INFO-2026-0083-nostore");
  assert.deepEqual([r4.body.capture.held, r4.body.capture.registered], [false, false]);
  assert.equal(r4.body.capture.why, "R2 is not configured on this instance, so the served bytes could not be held");
});

test("R79 a copy the tick files carries its provenance document entry and owes a reading through the capture's registrar", async () => {
  const w = world();
  // fixtures-contract: plane job-registrar
  const jobs = jobRegistrarStub();
  w.capture.registerJob = jobs.registerJob;
  w.capture.armJobs = jobs.armJobs;
  const owed = { get length() { return jobs.rows().length; } };
  const docsOf = (id) => JSON.parse(w.record.readFile(id, "data/provenance.json").text).documents;
  const id = "INFO-2026-0090-owes";
  w.monitored(id, LOC, "v1 bytes");
  w.net.routes[LOC] = serve("v2 bytes");
  const r = await tick(w, id);
  const s2 = sha("v2 bytes"), file = r.body.capture.file;
  assert.equal(r.body.capture.registered, true);
  assert.deepEqual(jobs.rows().map((j) => [j.kind, j.sha, j.carrier]), [["reading", s2, file]], "one reading job, for the new digest");
  assert.equal(jobs.armed(), true, "the alarm is armed after the row is written");
  /* the provenance names the new digest: locator, content type, digest, and the file that holds it */
  const docs = docsOf(id);
  assert.equal(docs.length, 2, "the baseline's entry stays");
  const mine = docs.filter((d) => d.capture.sha256 === s2);
  assert.equal(mine.length, 1);
  assert.deepEqual([mine[0].locator, mine[0].file, mine[0].capture.content_type, mine[0].capture.bytes], [LOC, file, "text/plain", 8]);
  assert.equal(docs.filter((d) => d.capture.sha256 === sha("v1 bytes")).length, 1);
  /* what a read of that digest looks up: the register's home is this bundle and the bundle's entry names the digest */
  assert.equal(w.prov.homeOf(s2).bundleId, id);
  /* the same new bytes seen again file nothing twice and owe nothing twice */
  w.clock.ms += 3600000;
  await tick(w, id);
  assert.equal(owed.length, 1);
  assert.equal(docsOf(id).length, 2);
  /* an unregistered copy (one capture, one home: the promotion is refused with it) owes nothing and files no entry */
  const id3 = "INFO-2026-0091-refused";
  w.monitored(id3, "https://records.example.org/third.txt", "t1");
  w.net.routes["https://records.example.org/third.txt"] = serve("v2 bytes");
  const r3 = await tick(w, id3);
  assert.equal(r3.body.capture.registered, false);
  assert.equal(owed.length, 1);
  assert.equal(docsOf(id3).filter((d) => d.capture.sha256 === s2).length, 0);
  /* a tick that found nothing new owes nothing */
  const id4 = "INFO-2026-0092-same";
  w.monitored(id4, "https://records.example.org/same.txt", "same");
  w.net.routes["https://records.example.org/same.txt"] = serve("same");
  await tick(w, id4);
  assert.equal(owed.length, 1);
  /* a registrar that refuses is stated in the answer, never swallowed */
  // fixtures-contract: plane job-registrar
  w.capture.registerJob = () => ({ ok: false, reason: "REGISTRAR_REFUSED" });
  const id5 = "INFO-2026-0093-refuses";
  w.monitored(id5, "https://records.example.org/fifth.txt", "f1");
  w.net.routes["https://records.example.org/fifth.txt"] = serve("f2");
  const r5 = await tick(w, id5);
  assert.equal(r5.body.capture.registered, true, "the copy is still filed");
  assert.match(r5.body.note, /reading/);
  assert.match(r5.body.note, /REGISTRAR_REFUSED/);
});

test("R80 the copy's document entry carries acquisition's first-hop provenance_chain and the capture's profile, so the register files a vouched copy and a textual copy is read as text", async () => {
  const w = world({ env: { INSTANCE_NAME: "Oakland", VERSION: "1.2.3" } });
  const docsOf = (id) => JSON.parse(w.record.readFile(id, "data/provenance.json").text).documents;
  const refusals = (id, docs) => registerChecks({ files: { "data/provenance.json": JSON.stringify({ ...JSON.parse(w.record.readFile(id, "data/provenance.json").text), documents: docs }) },
    fm: { current_state: "verified" } }).filter((f) => /documents\[1\]/.test(JSON.stringify(f)) && /C-18\.9/.test(JSON.stringify(f)));
  const ev = w.record.evidenceStore();
  /* a textual copy: one hop, the monitor tick's fetch, by the first hop's one spelling; the profile is acquisition's own over the same bytes */
  const id = "INFO-2026-0094-chain";
  w.monitored(id, LOC, "v1 bytes");
  w.net.routes[LOC] = serve("v2 bytes");
  const r = await tick(w, id);
  const s2 = sha("v2 bytes");
  assert.equal(r.body.capture.registered, true);
  const mine = docsOf(id).find((d) => d.capture.sha256 === s2);
  assert.equal(mine.provenance_chain.length, 1);
  const hop = mine.provenance_chain[0];
  assert.deepEqual([hop.who, hop.bound, hop.via], [firstHopWho("Oakland", "1.2.3"), false, "direct"]);
  assert.ok(hop.asserts.includes(LOC) && hop.asserts.includes(mine.retrieved), "the hop says which address and when");
  assert.ok(typeof hop.evidence === "string" && hop.evidence.length > 0);
  const want = await profileOf({ ev, sha: s2, ct: "text/plain", total: 8, headers: { "content-type": "text/plain" }, locator: LOC,
    view: profileView(w.record), retrieved: mine.retrieved, origin: "fetch", name: "minutes.txt", declaredType: "text/plain" });
  assert.deepEqual(mine.profile, want);
  assert.equal(mine.profile.profiled_from_text, true, "a text/plain copy is read as text (reading-pipeline R2)");
  assert.deepEqual(refusals(id, docsOf(id)), [], "the register finds a chain for the copy at or past verified");
  /* a binary copy: its profile is the bytes' own, not read as text, and the chain is there all the same */
  const pdf = (n) => new TextEncoder().encode(`%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\n% ${n}\n%%EOF\n`);
  const bid = "INFO-2026-0095-binary", BLOC = "https://records.example.org/agenda.pdf";
  w.monitored(bid, BLOC, "b1");
  w.net.routes[BLOC] = serve(pdf("two"), "application/pdf");
  const rb = await tick(w, bid);
  assert.equal(rb.body.capture.registered, true);
  const bm = docsOf(bid).find((d) => d.capture.sha256 === rb.body.capture.sha256);
  assert.equal(bm.provenance_chain.length, 1);
  assert.equal(bm.profile.profiled_from_text, false);
  assert.equal(bm.profile.format.format, "pdf");
  assert.equal(bm.profile.source_content_type, "application/pdf");
  assert.deepEqual(refusals(bid, docsOf(bid)), []);
  /* control: the baseline's entry stays first and unchanged, and an entry already naming the digest is not added twice */
  assert.equal(docsOf(id).length, 2);
  w.clock.ms += 3600000;
  await tick(w, id);
  assert.equal(docsOf(id).length, 2);
});

test("R10 the answer's fields, and a promotion that does not answer is named as silent, never reported as recorded", async () => {
  const w = world();
  const id = "INFO-2026-0090-answer";
  w.monitored(id, LOC, "a1");
  w.net.routes[LOC] = serve("a1");
  const r = await tick(w, id);
  for (const k of ["ok", "checked", "status", "note", "baseline", "seen", "compared", "compared_basis", "assessment",
                   "assessment_basis", "cadence", "observation", "capture", "reeval_raised", "revision"])
    assert.ok(Object.prototype.hasOwnProperty.call(r.body, k), k);
  assert.equal(r.body.revision, w.record.head(id).bundleSha);
  /* a refused promotion answers its reason and detail, and ok false */
  const v = world();
  const vid = "INFO-2026-0091-refused";
  v.monitored(vid, LOC, "a1");
  v.net.routes[LOC] = serve("a1");
  const orig = v.promotion.promote.bind(v.promotion);
  v.promotion.promote = (pkg) => (pkg.author === MONITOR_AUTHOR ? staleBaseRefusal() : orig(pkg));
  const rr = await tick(v, vid);
  const stale = staleBaseRefusal();
  assert.deepEqual([rr.status, rr.body.ok, rr.body.reason, rr.body.detail], [409, false, stale.reason, stale.detail]);
  assert.equal(rr.body.revision, undefined);
  /* a promotion that does not answer: the service fails, so the store does not answer and the control plane names it silent */
  v.promotion.promote = () => { throw new Error("storage went away"); };
  await assert.rejects(() => tick(v, vid));
  const json = (b, s = 200) => ({ b, s });
  const failing = { fetch: async (req) => { try { await monitoringOps(v.m, new URL(req.url), await req.json()).monitor(); }
    catch { return new Response(JSON.stringify({ ok: false }), { status: 500 }); } } };
  const doAnswer = async (res) => { let o = null; try { o = await (await res).json(); } catch { o = null; }
    return o && o.ok === true ? { answered: true, result: o.result } : { answered: false, result: undefined }; };
  const out = await monitorOp(new Request("https://x/", { method: "POST", body: JSON.stringify({ bundleId: vid }) }), failing,
    { json, storeSilent: (op) => ({ silent: op }), requiredArgument: () => ({}), doAnswer, cls: "daemon" });
  assert.deepEqual(out, { silent: "monitor" });
  assert.ok(V);
});

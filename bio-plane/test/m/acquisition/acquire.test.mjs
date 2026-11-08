/* acquisition: the acquisition act at the module's interface, `acquire(store, body, opts)` and `archiveLookup(store,
   args)`, over a scripted network, an evidence bucket, and the store handed in (fixture.mjs). Carried from capture's
   tests of the moved Rs (capture R1–R7, R9–R14, R16–R20, R33–R36, R41, R42, R60–R62), each renamed to this module's id.
   Each test names the requirement ids it checks in its title. */
import { test, mock } from "node:test";
import { inspect } from "node:util";
import assert from "node:assert/strict";
import { world, run, lookup, network, sha, HTML, page, text, wayback, WB, eligible, rendererEnv } from "./fixture.mjs";
import { RENDER_DEFAULTS, renderLocaleFor } from "../../../src/render.mjs";
import { EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE } from "../../../src/record-grammar/index.mjs";
import { ARCHIVE_CAPTURE_GRADE, REWRITTEN_REPLAY_GRADE } from "../../../src/provenance/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { DRIVE_CAPTURE_CHECKS, RENDER_CAPTURE_CHECKS, CAPTURE_REQUEST_ARM_CHECKS, acquireGradeNote, ACQUIRE_GRADE_NOTE,
         civicsmithUserAgent, CAPTURE_MAX, MULTIPART_KEEP_MAX } from "../../../src/acquisition/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";
import { boundOf } from "../../../src/read-bounds.mjs";
import { renderFailure } from "../capture-sources/fixtures.mjs";

const ROW = (table, code) => [table[code].check, table[code].translation];

test("R1: a daemon is refused except on the archive and capture-request arms; the archive arm is admin, probe and daemon only; capture-request from outside is C-28.13", async () => {
  const w = world();
  const d = await run(w, {}, { locator: "https://a.example/x" }, { cls: "daemon", member: false });
  assert.deepEqual([d.status, d.body.reason, d.net.seen.length], [403, "NOT_PERMITTED", 0]);
  for (const cls of ["member", "operator", null]) {
    const m = await run(w, {}, { via: "archive.org", address: "https://a.example/x" }, { cls });
    assert.deepEqual([m.status, m.body.reason, m.net.seen.length], [403, "NOT_PERMITTED", 0], String(cls));
  }
  for (const cls of ["admin", "probe", "daemon", "member"]) {
    const r = await run(w, {}, { via: "capture-request", request: "CR-1", locator: "https://a.example/x" }, { cls });
    assert.deepEqual([r.status, r.body.reason, r.body.code, r.body.check, r.body.translation],
                     [403, "CAPTURE_NOT_DRAINING", "CAPTURE_NOT_DRAINING", ...ROW(CAPTURE_REQUEST_ARM_CHECKS, "CAPTURE_NOT_DRAINING")]);
    assert.equal(r.body.request, "CR-1");
    assert.equal(r.net.seen.length, 0);
  }
  /* the daemon's two arms admit it: the archive arm (reaching its eligibility fence) and the trusted in-process arm,
     where everything that leaves comes from the row */
  const arch = await run(w, {}, { via: "archive.org", address: "https://a.example/x" }, { cls: "daemon", member: false });
  assert.equal(arch.body.reason, "NOT_ELIGIBLE", "the daemon passes the class fence on the archive arm");
  const inproc = await run(w, { "https://row.example/doc": text("row bytes") },
    { locator: "https://evil.example/", render: true }, { cls: "daemon", member: false,
      captureRequest: { locator: "https://row.example/doc", purpose: "investigation", agent: "Mozilla/5.0 Member", render: false } });
  assert.equal(inproc.status, 200);
  assert.deepEqual(inproc.net.seen.map((x) => x.url), ["https://row.example/doc"]);
  assert.equal(inproc.net.seen[0].init.headers["user-agent"], "Mozilla/5.0 Member", "the delegated agent the row named");
  assert.match(inproc.body.document.provenance_chain[0].asserts, /row\.example/);
  /* negative control: a member's direct capture is not refused by R1 */
  const mem = await run(w, { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.equal(mem.status, 200);
});

test("R2 R27: the fetched address must be a public locator, and no caller-supplied hop, locator, export fact, grade or receipt reaches the answer", async () => {
  const w = world();
  for (const bad of ["http://a.example/x", "https://127.0.0.1/x", "https://localhost/x", "https://u:p@a.example/x", "https://intranet/x", 42, undefined]) {
    const r = await run(w, {}, { locator: bad });
    assert.deepEqual([r.status, r.body.reason], [400, "BAD_LOCATOR"], String(bad));
    assert.equal(r.net.seen.length, 0);
  }
  /* N998: a capture reads the wall clock many times (retrieved, and each attestation attempt's own instant), so two
     captures compared under a running clock differ wherever a read crosses a second. The clock is pinned to one instant
     for both captures (Date only; timers stay real), and the comparison below is then exact, with nothing normalised. */
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-04T05:06:07.500Z") });
  let r, plain;
  try {
    r = await run(w, { "https://a.example/x": text("bytes") },
      { locator: "https://a.example/x", provenance_chain: [{ who: "me" }], grade: "A", capture: { grade: "A" }, retrieval_locator: "https://evil/",
        receipt: {}, document: { file: "x" }, retrieved: "1999-01-01T00:00:00Z", transport: {} });
    plain = await run(world(), { "https://a.example/x": text("bytes") }, { locator: "https://a.example/x" });
  } finally { mock.timers.reset(); }
  assert.equal(r.status, 200);
  const d = r.body.document;
  assert.equal(d.provenance_chain.length, 1);
  assert.match(d.provenance_chain[0].who, /^instance inst/);
  assert.equal(d.capture.grade, EARNED_CAPTURE_CEILING);
  assert.equal(d.retrieved, "2026-03-04T05:06:07Z", "the instance's own clock, never the caller's");
  assert.equal(d.capture.transport.requested, "https://a.example/x");
  assert.equal(w.prov.receipts[0].retrievalLocator, "https://a.example/x");
  assert.ok(!JSON.stringify(r.body).includes("evil"), "the caller's retrieval locator is nowhere");
  /* over-strictness: the same capture with no supplied facts answers the same document, byte for byte */
  assert.equal(JSON.stringify(d), JSON.stringify(plain.body.document));
  /* the archive arm: a caller's locator is never the retrieval locator */
  const arch = await run(w, {}, { via: "archive.org", locator: "https://web.archive.org/web/1id_/https://a.example/x" }, { cls: "admin" });
  assert.equal(arch.body.reason, "BAD_ADDRESS");
  const drive = await run(w, {}, { locator: "https://docs.google.com/document/d/abcdefghijk/edit", export_address: "https://evil/" });
  assert.equal(drive.body.reason, "DRIVE_HOP_FACT_SUPPLIED");
});

test("R3 R32: the archive arm needs an eligible address, finds a memento through the TimeGate and TimeMap via the governor at 24 a minute, and files the chosen memento's raw bytes under its original with the archive's hop", async () => {
  const w = world();
  const addr = "https://gone.example/doc";
  const replay = `${WB}20250101000000id_/${addr}`;
  const bad = await run(w, {}, { via: "archive.org", locator: addr }, { cls: "admin" });
  assert.deepEqual([bad.status, bad.body.reason], [400, "BAD_ADDRESS"]);
  const ne = await run(w, {}, { via: "archive.org", address: addr }, { cls: "admin" });
  assert.deepEqual([ne.status, ne.body.reason, ne.body.reachability.fallback_eligible, ne.net.seen.length], [409, "NOT_ELIGIBLE", false, 0]);
  await eligible(w);
  /* the newest memento is of a redirect: refused by selectCapture's words, the TimeMap's next one is filed */
  const routes = wayback([{ ts: "20250101000000" }, { ts: "20250601000000", status: 301, body: "moved" }]);
  const r = await run(w, routes, { via: "archive.org", address: addr }, { cls: "admin", member: false });
  assert.equal(r.status, 200);
  assert.deepEqual(w.gov.configured, [{ host: "web.archive.org", appetite_per_min: 24 }]);
  assert.equal(w.gov.calls.filter((c) => c[0] === "admit" && c[1] === "web.archive.org").length, r.net.seen.length, "every request through the governor");
  assert.deepEqual(r.net.seen.map((x) => x.url), [`${WB}${addr}`, `${WB}20250601000000id_/${addr}`, `${WB}timemap/link/${addr}`, replay]);
  assert.match(r.net.seen[0].init.headers["accept-datetime"], /^[A-Z][a-z]{2}, \d\d [A-Z][a-z]{2} \d{4} \d\d:\d\d:\d\d GMT$/, "the TimeGate is asked with Accept-Datetime");
  assert.ok(r.net.seen.every((x) => x.init.redirect === "manual"), "a redirect is an answer, never followed silently");
  assert.equal(w.prov.receipts[0].address, addr, "document address is the memento's rel=original");
  assert.equal(w.prov.receipts[0].via, "archive.org");
  assert.equal(w.prov.receipts[0].retrievalLocator, replay);
  const chain = r.body.document.provenance_chain;
  assert.equal(chain.length, 2); assert.equal(chain[1].via, "archive.org"); assert.equal(chain[1].who, word("capture-sources.name.internet_archive_wayback"));
  assert.equal(chain[1].document_address, addr);
  assert.ok(chain[1].evidence.includes(localize("capture-sources.memento.sha_256_digest_computed_by", "SHA-256 {digest}, computed by your team's Civicsmith over the bytes it received, not a digest the archive stated", { digest: sha("archived bytes") })));
  assert.equal(r.body.document.capture.authority, "Internet Archive");
  /* attestation R4 (K59, K1224): the instance signs its receipt through the attestation instance handed in */
  assert.deepEqual(w.signed().map((x) => [x.capture_sha, x.retrieval_locator]), [[sha("archived bytes"), replay]], "the receipt is signed");
  const sig = r.body.receipt_signature;
  assert.deepEqual([sig.ok, sig.key_id, sig.statement], [true, w.signed()[0].key_id,
    `bio-receipt/1\ninstance: inst\nfetched: ${r.body.document.retrieved}\nlocator: ${replay}\nsha256: ${sha("archived bytes")}\n`]);
  assert.deepEqual((await w.att.signedReceipts(sha("archived bytes"))).map((x) => x.verified), [true], "verifiable against the key it was signed with");
  /* no key bound: the capture is filed and the answer says the receipt was not signed */
  const nk = world({ signingKey: null }); await eligible(nk);
  const unsigned = await run(nk, routes, { via: "archive.org", address: addr }, { cls: "admin", member: false });
  assert.deepEqual([unsigned.status, unsigned.body.receipt_signature.ok, unsigned.body.receipt_signature.reason, nk.signed().length],
                   [200, false, "RECEIPT_NO_KEY", 0]);
  assert.equal(unsigned.body.document.capture.sha256, sha("archived bytes"));
  /* over-strictness: a direct capture signs no receipt and answers no signature */
  const direct = await run(w, { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.deepEqual([direct.status, "receipt_signature" in direct.body, w.signed().length], [200, false, 1]);
  /* the named failures */
  await eligible(w);
  const thrown = await run(w, () => new Error("dns"), { via: "archive.org", address: addr }, { cls: "admin" });
  assert.deepEqual([thrown.status, thrown.body.reason], [502, "ARCHIVE_UNREACHABLE"]);
  const refused = await run(w, () => new Response("no", { status: 503 }), { via: "archive.org", address: addr }, { cls: "admin" });
  assert.deepEqual([refused.status, refused.body.reason, refused.body.status], [502, "ARCHIVE_REFUSED", 503]);
  const none = await run(w, wayback([{ ts: "20250101000000", status: 404, body: "gone" }]), { via: "archive.org", address: addr }, { cls: "admin" });
  assert.deepEqual([none.status, none.body.reason, none.body.considered.length], [404, "NO_USABLE_CAPTURE", 1], "every memento considered is named");
  const cool = world({ gov: { refuse: ["web.archive.org"] } }); await eligible(cool);
  const c2 = await run(cool, routes, { via: "archive.org", address: addr }, { cls: "admin" });
  assert.deepEqual([c2.status, c2.body.reason, c2.net.seen.length], [429, "HOST_COOLING_OFF", 0]);
  /* archiveLookup decides and reports the same, without capturing: the memento's bytes are hashed and kept nowhere */
  const lw = world(); await eligible(lw);
  const look = await lookup(lw, routes, { address: addr });
  assert.equal(look.status, 200);
  assert.equal(look.body.retrieval_locator, replay);
  assert.equal(look.body.provenance_hop.via, "archive.org");
  assert.equal(look.body.chosen.original, addr);
  assert.equal(look.body.chosen.digest, sha("archived bytes"), "the row is over the bytes received");
  assert.ok(Array.isArray(look.body.rejected) && look.body.rejected.length === 1, "the refused memento is named");
  assert.deepEqual([lw.prov.receipts.length, lw.b.calls.filter((c) => c[0] === "put").length], [0, 0], "nothing captured or stored");
  assert.equal((await lookup(w, routes, { address: "https://fresh.example/" })).body.reason, "NOT_ELIGIBLE");
  assert.equal((await lookup(w, routes, { address: "ftp://x" })).body.reason, "BAD_ADDRESS");
});

test("R4 R29: the Drive arm refuses hop facts, folders, undetermined kinds and unknown shapes, fetches the composed export, never files the shell, and keeps the link", async () => {
  const w = world();
  const link = "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit";
  const exp = "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/export?format=odt";
  const row = (code) => ROW(DRIVE_CAPTURE_CHECKS, code);
  const cases = [["https://drive.google.com/drive/folders/1AbCdEfGhIjK", "DRIVE_FOLDER_NOT_A_DOCUMENT"],
                 ["https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view", "DRIVE_KIND_UNDETERMINED"],
                 ["https://docs.google.com/weird/path", "DRIVE_SHAPE_UNRECOGNISED"]];
  for (const [loc, code] of cases) {
    const r = await run(w, {}, { locator: loc });
    assert.deepEqual([r.status, r.body.reason, r.body.check, r.body.translation], [422, code, ...row(code)]);
    assert.equal(r.net.seen.length, 0);
  }
  const hop = await run(w, {}, { locator: "https://a.example/x", producer: "me" });
  assert.deepEqual([hop.status, hop.body.reason, hop.body.supplied], [400, "DRIVE_HOP_FACT_SUPPLIED", ["producer"]], "whatever its address");
  assert.deepEqual([hop.body.check, hop.body.translation], row("DRIVE_HOP_FACT_SUPPLIED"));
  const unreach = await run(w, { [exp]: new Response("no", { status: 403 }) }, { locator: link });
  assert.deepEqual([unreach.status, unreach.body.reason, unreach.body.check, unreach.body.translation], [502, "DRIVE_EXPORT_UNREACHABLE", ...row("DRIVE_EXPORT_UNREACHABLE")]);
  assert.deepEqual(unreach.net.seen.map((x) => x.url), [exp], "the application page is never fetched in its place");
  let bodyRead = false;
  const shellBody = new ReadableStream({ pull(c) { bodyRead = true; c.enqueue(new TextEncoder().encode("<html>")); c.close(); } }, { highWaterMark: 0 });
  const shell = await run(w, { [exp]: () => new Response(shellBody, { headers: { "content-type": "text/html" } }) }, { locator: link });
  assert.deepEqual([shell.status, shell.body.reason, shell.body.check, shell.body.translation], [502, "DRIVE_EXPORT_IS_THE_SHELL", ...row("DRIVE_EXPORT_IS_THE_SHELL")]);
  assert.equal(bodyRead, false, "the shell's body is never read");
  const sniffed = await run(w, { [exp]: new Response("<!doctype html><html><body>app</body></html>", { headers: { "content-type": "application/vnd.oasis.opendocument.text" } }) }, { locator: link });
  assert.deepEqual([sniffed.status, sniffed.body.reason, sniffed.body.check, sniffed.body.translation], [502, "DRIVE_EXPORT_BYTES_ARE_THE_SHELL", ...row("DRIVE_EXPORT_BYTES_ARE_THE_SHELL")]);
  assert.equal(w.b.calls.filter((c) => c[0] === "put").length, 0, "nothing filed for any of them");
  assert.equal(w.prov.receipts.length, 0);
  const odt = new Uint8Array([0x50, 0x4b, 0x03, 0x04, ...new TextEncoder().encode("mimetypeapplication/vnd.oasis.opendocument.text rest")]);
  const ok = await run(w, { [exp]: new Response(odt, { headers: { "content-type": "application/vnd.oasis.opendocument.text" } }) }, { locator: link });
  assert.equal(ok.status, 200);
  assert.deepEqual(ok.net.seen.map((x) => x.url), [exp], "the composed export, and only it");
  assert.equal(w.prov.receipts.at(-1).address, link, "the Drive link as given");
  assert.equal(w.prov.receipts.at(-1).retrievalLocator, exp);
  const g = ok.body.document.provenance_chain[1];
  assert.equal(g.who, "Google Drive (Google Drive export)"); assert.equal(g.bound, false); assert.equal(g.export_address, exp);
  /* negative controls: a published Drive page and an ordinary host are not the Drive arm */
  const pub = "https://docs.google.com/document/d/e/2PACX-1vAbCdEfGhIjKlMnOp/pub";
  const p = await run(w, { [pub]: page(HTML("<p>published</p>")) }, { locator: pub });
  assert.deepEqual([p.status, p.body.document.provenance_chain.length], [200, 1], "publish-to-web is left alone");
  const plain = await run(w, { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.equal(plain.status, 200);
});

const renderAnswer = { ok: true, html: HTML("<p>rendered</p>"), elapsed_ms: 1234, engine: "Chrome", engine_version: "1", viewport: { width: 1280, height: 800 },
  dpr: 1, locale: "en-US", timezone: "UTC", navigated_to: "https://r.example/page", status: 200, requests: [], scripts: [],
  wait: { asked: RENDER_DEFAULTS.wait, fired: "networkidle" } };

test("R5 R6 R7 R29: the render arm refuses before any fetch, admits against the allowance, files a pair, releases what it reserved, and asks the view's locale", async () => {
  const w = world();
  const row = (code) => ROW(RENDER_CAPTURE_CHECKS, code);
  for (const v of ["yes", 1, null, {}]) {
    const r0 = await run(w, {}, { locator: "https://r.example/page", render: v });
    assert.deepEqual([r0.status, r0.body.reason, r0.body.check, r0.body.translation, r0.net.seen.length], [400, "RENDER_FLAG_MALFORMED", ...row("RENDER_FLAG_MALFORMED"), 0], JSON.stringify(v));
  }
  await eligible(w, "https://r.example/page");
  for (const b of [{ via: "archive.org", address: "https://r.example/page" }, { locator: "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit" }, { locator: "https://r.example/page", continue: "cs_x" }]) {
    const r = await run(w, wayback([{ ts: "20250101000000" }], { address: "https://r.example/page" }), { ...b, render: true }, { cls: "admin" });
    assert.deepEqual([r.status, r.body.reason, r.body.check, r.body.translation], [400, "RENDER_ARM_CONFLICT", ...row("RENDER_ARM_CONFLICT")], JSON.stringify(b));
    assert.equal(r.net.seen.length, 0, "nothing is asked, the archive included");
  }
  const none = await run(w, {}, { locator: "https://r.example/page", render: true });
  assert.deepEqual([none.status, none.body.reason, none.body.check, none.body.translation, none.net.seen.length], [501, "RENDER_NO_RENDERER", ...row("RENDER_NO_RENDERER"), 0]);
  const unbound = await run(world({ env: { BROWSER: {} } }), {}, { locator: "https://r.example/page", render: true });
  assert.deepEqual([unbound.status, unbound.body.reason, unbound.body.renderer], [501, "RENDER_NO_RENDERER", "browser-binding-without-driver"]);
  const env = rendererEnv(renderAnswer);
  const cool = world({ env, gov: { refuse: ["r.example"] } });
  const c = await run(cool, {}, { locator: "https://r.example/page", render: true });
  assert.deepEqual([c.status, c.body.reason, c.body.check, c.body.translation, c.body.retry_in_ms, c.net.seen.length], [429, "RENDER_HOST_COOLING_OFF", ...row("RENDER_HOST_COOLING_OFF"), 5000, 0]);
  assert.equal(cool.store.state.admits.length, 0, "the governor is asked before the allowance");
  const full = world({ env });
  for (let i = 0; i < 10; i++) full.store.renderAdmit({ allowanceMs: 1e12, reserveMs: 1000, cap: 10 });
  const capd = await run(full, {}, { locator: "https://r.example/page", render: true });
  assert.deepEqual([capd.status, capd.body.reason, capd.body.check, capd.body.translation, capd.body.render.state, capd.net.seen.length],
                   [429, "RENDER_AT_CAPACITY", ...row("RENDER_AT_CAPACITY"), "waiting", 0]);
  assert.equal(full.store.state.admits.at(-1).cap, 10, "the concurrency cap is capture-sources' own (R6's default)");
  const spent = world({ env: { ...env, RENDER_DAILY_ALLOWANCE_MS: "1" } });
  const def = await run(spent, {}, { locator: "https://r.example/page", render: true });
  assert.deepEqual([def.status, def.body.reason, def.body.check, def.body.translation, def.body.render.state, def.net.seen.length],
                   [429, "RENDER_DEFERRED", ...row("RENDER_DEFERRED"), "deferred", 0]);
  const unread = world({ env });
  unread.store.renderAdmit = () => { throw new Error("down"); };
  const ur = await run(unread, {}, { locator: "https://r.example/page", render: true });
  assert.deepEqual([ur.body.reason, ur.net.seen.length], ["RENDER_DEFERRED", 0], "an unreadable allowance defers, never runs unmetered");
  /* not a page: released at no charge */
  const w2 = world({ env });
  const nap = await run(w2, { "https://r.example/doc.pdf": new Response("%PDF-1.4", { headers: { "content-type": "application/pdf" } }) }, { locator: "https://r.example/doc.pdf", render: true });
  assert.deepEqual([nap.status, nap.body.reason, nap.body.check, nap.body.translation], [422, "RENDER_NOT_A_PAGE", ...row("RENDER_NOT_A_PAGE")]);
  assert.deepEqual([w2.store.state.render.spent_ms, w2.store.state.render.reserved_ms, w2.store.state.spends[0].ms], [0, 0, 0]);
  assert.equal(env.calls.length, 0, "no renderer was asked");
  assert.equal(w2.prov.receipts.length, 0);
  /* failed render: nothing filed */
  const w3 = world({ env: rendererEnv(await renderFailure({ class: "no_session" })) });
  const fail = await run(w3, { "https://r.example/page": page(HTML()) }, { locator: "https://r.example/page", render: true });
  assert.deepEqual([fail.status, fail.body.reason, fail.body.check, fail.body.translation, fail.body.filed], [502, "RENDER_FAILED", ...row("RENDER_FAILED"), false]);
  assert.equal(w3.prov.receipts.length, 0);
  assert.deepEqual([w3.store.state.spends.length, w3.store.state.spends[0].releaseMs > 0, w3.store.state.slots.size], [1, true, 0],
                   "the spend is reported with its reservation and the slot freed (capture R40 keeps an unreported render charged)");
  /* the pair, with the view's locale asked (R7) */
  const w4 = world({ env });
  w4.core.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:admin");
  const ok = await run(w4, { "https://r.example/page": page(HTML("<div id=app></div>")) }, { locator: "https://r.example/page", render: true });
  assert.equal(ok.status, 200);
  const d = ok.body.document;
  const shellSha = sha(HTML("<div id=app></div>"));
  assert.equal(d.capture.method, "rendered");
  assert.equal(d.capture.sha256, sha(renderAnswer.html)); assert.notEqual(d.capture.sha256, shellSha);
  assert.deepEqual(d.pair, { primary: "rendered", rendered: { file: d.file, sha256: d.capture.sha256 }, shell: { file: `${d.file}.shell.html`, sha256: shellSha } });
  assert.equal(d.render.of, shellSha); assert.equal(d.shell.sha256, shellSha);
  assert.ok(w4.held(shellSha) && w4.held(d.capture.sha256), "both held under their own digests");
  assert.equal(ok.body.files[`${d.file}.shell.html`], shellSha);
  assert.equal(d.capture.transport, undefined, "the HTTP exchange belongs to the shell");
  assert.ok(d.shell.transport, "and is recorded on it");
  assert.ok(d.authority_state, "content authority is renderedAuthority's");
  assert.deepEqual([w4.store.state.render.spent_ms, w4.store.state.render.reserved_ms], [1234, 0], "released with the render's elapsed time");
  const view = combine(["test-port-ellery"]).view;
  assert.equal(env.calls.at(-1).locale, renderLocaleFor(view), "R7: the locale renderLocaleFor answers for R17's view");
  assert.equal(env.calls.at(-1).timezone, "UTC");
  /* negative control: render: false (or absent) is the plain capture */
  for (const b of [{ render: false }, {}]) {
    const plain = await run(world({ env }), { "https://r.example/page": page(HTML("<div id=app></div>")) }, { locator: "https://r.example/page", ...b });
    assert.equal(plain.status, 200); assert.equal(plain.body.document.capture.sha256, shellSha); assert.equal(plain.body.document.pair, undefined);
  }
});

test("R6: every subresource the renderer handed over is hashed by this instance and kept", async () => {
  const body = Buffer.from("body{}").toString("base64");
  const env = rendererEnv({ ...renderAnswer, requests: [{ url: "https://r.example/s.css", type: "stylesheet", outcome: "completed", status: 200, body_base64: body, body_as: "bytes" }] });
  const w = world({ env });
  const ok = await run(w, { "https://r.example/page": page(HTML()) }, { locator: "https://r.example/page", render: true });
  const sub = ok.body.document.render.subresources[0];
  assert.deepEqual([sub.sha256, sub.digest_by], [sha("body{}"), "plane"]);
  assert.ok(w.held(sha("body{}")), "kept under its own digest");
});

test("R9 R28: every outbound fetch goes through the governor under a legible agent; a refusal is HOST_COOLING_OFF 429 with retry_in_ms", async () => {
  const w = world();
  const r = await run(w, { "https://a.example/x": text("bytes", { "retry-after": "7" }) }, { locator: "https://a.example/x" });
  assert.equal(r.status, 200);
  assert.deepEqual(w.gov.calls.slice(0, 2), [["admit", "a.example"], ["report", "a.example", 200, 7000]]);
  assert.equal(r.net.seen[0].init.headers["user-agent"], civicsmithUserAgent("9.9.9", "inst", "acquire"), "R24's one spelling, naming the instance and purpose");
  const cool = world({ gov: { refuse: ["a.example"] } });
  const c = await run(cool, {}, { locator: "https://a.example/x" });
  assert.deepEqual([c.status, c.body.reason, c.body.retry_in_ms, c.net.seen.length], [429, "HOST_COOLING_OFF", 5000, 0]);
  assert.deepEqual(cool.store.state.outcomes.map((o) => o.outcome), ["governed"], "capture R8: governed, counted apart");
  /* the capture-request arm's purpose names the agent's purpose */
  const cr = await run(w, { "https://a.example/y": text("y") }, {}, { cls: "daemon", member: false,
    captureRequest: { locator: "https://a.example/y", purpose: "investigation", agent: null, render: false } });
  assert.equal(cr.net.seen[0].init.headers["user-agent"], civicsmithUserAgent("9.9.9", "inst", "investigation"));
  /* with no instance name or version, R24's defaults */
  const bare = world({ env: { INSTANCE_NAME: "", VERSION: "" } });
  const b = await run(bare, { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.equal(b.net.seen[0].init.headers["user-agent"], civicsmithUserAgent("0.0.0", "unnamed", "acquire"));
});

test("R10: CAPTURE_MAX, the one exported limit, is READ_BOUNDS' archive.uploaded_bytes and is the limit R10 enforces: a body of exactly CAPTURE_MAX bytes is filed, one byte more is TOO_LARGE naming it as maxBytes, the stream cancelled", async () => {
  assert.equal(CAPTURE_MAX, boundOf("archive", "uploaded_bytes"));   // T53-527: the statement's figure, never a number
  const CHUNK = 4 * 1024 * 1024;
  const body = (total, onCancel = () => {}) => {
    let sent = 0;
    return new ReadableStream({
      pull(c) { if (sent >= total) { c.close(); return; } const n = Math.min(CHUNK, total - sent); sent += n; c.enqueue(new Uint8Array(n)); },
      cancel() { onCancel(); },
    }, { highWaterMark: 0 });
  };
  const w = world();
  const at = await run(w, { "https://a.example/at": () => new Response(body(CAPTURE_MAX), { headers: { "content-type": "application/octet-stream" } }) },
                       { locator: "https://a.example/at" });
  assert.equal(at.status, 200, "exactly the limit is taken");
  assert.equal(at.body.document.capture.bytes, CAPTURE_MAX);
  let cancelled = false;
  const over = await run(w, { "https://a.example/over": () => new Response(body(CAPTURE_MAX + 1, () => { cancelled = true; })) },
                         { locator: "https://a.example/over" });
  assert.deepEqual([over.status, over.body.reason, over.body.maxBytes, cancelled], [413, "TOO_LARGE", CAPTURE_MAX, true], "one byte past it is refused");
});

test("R10: hashed as it arrives, stored in parts of 8 MiB; each refusal named; every attempt recorded against the document address", async () => {
  const w = world();
  const ft = await run(w, { "https://a.example/t": new Error("reset") }, { locator: "https://a.example/t" });
  assert.deepEqual([ft.status, ft.body.reason], [502, "FETCH_FAILED"]);
  const sr = await run(w, { "https://a.example/r": new Response("no", { status: 410 }) }, { locator: "https://a.example/r" });
  assert.deepEqual([sr.status, sr.body.reason, sr.body.status], [502, "SOURCE_REFUSED", 410]);
  const em = await run(w, { "https://a.example/e": new Response(new Uint8Array(0)) }, { locator: "https://a.example/e" });
  assert.deepEqual([em.status, em.body.reason], [502, "EMPTY"]);
  const nb = await run(w, { "https://a.example/n": () => ({ ok: true, status: 200, url: "", headers: new Headers(), body: null }) }, { locator: "https://a.example/n" });
  assert.deepEqual([nb.status, nb.body.reason], [502, "NO_BODY"]);
  const outcome = (a) => w.store.state.outcomes.filter((o) => o.addressNorm === a).map((o) => o.outcome);
  assert.deepEqual(outcome("https://a.example/t"), ["fetch_failed"]);
  assert.deepEqual(outcome("https://a.example/r"), ["source_refused"]);
  assert.equal(w.prov.receipts.length, 0, "no refusal files anything");
  /* multipart: 8 MiB parts, each under its own digest and with its checksum */
  const big = new Uint8Array(8 * 1024 * 1024 + 10).fill(7);
  const mp = await run(w, { "https://a.example/big": () => new Response(big, { headers: { "content-type": "application/octet-stream" } }) }, { locator: "https://a.example/big" });
  assert.equal(mp.status, 200);
  assert.equal(mp.body.document.capture.sha256, sha(big));
  assert.equal(mp.body.parts, 2);
  for (const p of mp.body.document.parts) { assert.ok(w.held(p.sha256)); assert.equal(sha(w.bytesOf(p.sha256)), p.sha256); }
  assert.deepEqual(mp.body.document.parts.map((p) => p.bytes), [8 * 1024 * 1024, 10], "parts of 8 MiB, whatever the chunking");
  assert.deepEqual(mp.body.document.parts.map((p) => p.file), ["snapshots/big.part000", "snapshots/big.part001"]);
  assert.ok(w.b.calls.filter((c) => c[0] === "put").every((c) => c[2] && c[2].sha256), "each part stored with its checksum");
  /* T51 (C5): a multipart capture is also kept whole, under its own digest, so every reader finds it as it finds a single part;
     the parts stay named and held (provenance R7 reads a capture past MULTIPART_KEEP_MAX by them). */
  assert.equal(w.held(sha(big)), true, "the whole is kept under its own hash (fix2-t51.test.mjs holds the rest of it)");
  assert.equal(sha(w.bytesOf(sha(big))), sha(big));
  assert.deepEqual(outcome("https://a.example/big"), ["success"]);
  /* over the limit: TOO_LARGE, the stream cancelled */
  let cancelled = false, sent = 0;
  const huge = new ReadableStream({ pull(c) { if (sent > boundOf("archive", "uploaded_bytes") + 64 * 1024 * 1024) { c.close(); return; } sent += 4 * 1024 * 1024; c.enqueue(new Uint8Array(4 * 1024 * 1024)); }, cancel() { cancelled = true; } }, { highWaterMark: 0 });
  const tl = await run(w, { "https://a.example/huge": () => new Response(huge) }, { locator: "https://a.example/huge" });
  assert.deepEqual([tl.status, tl.body.reason, tl.body.maxBytes, cancelled], [413, "TOO_LARGE", boundOf("archive", "uploaded_bytes"), true]);
  /* a single part whose digest differs from the running hash */
  const orig = crypto.subtle.digest.bind(crypto.subtle);
  crypto.subtle.digest = async (alg, data) => { const d = new Uint8Array(await orig(alg, data)); d[0] ^= 1; return d.buffer; };
  try {
    const hd = await run(w, { "https://a.example/h": text("abc") }, { locator: "https://a.example/h" });
    assert.deepEqual([hd.status, hd.body.reason], [500, "HASH_DISAGREEMENT"]);
  } finally { crypto.subtle.digest = orig; }
});

test("R11: existed for one part is whether it was held before this call; for several, true only when registered, else null with the stated reason", async (t) => {
  /* N998: the clock pinned for the whole test (Date only; timers stay real), so the two captures compared below are
     compared exactly, with nothing normalised */
  t.mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-04T12:00:00.000Z") });
  const w = world();
  const route = { "https://a.example/x": () => text("same bytes") };
  const first = await run(w, route, { locator: "https://a.example/x" });
  assert.equal(first.body.existed, false);
  const again = await run(w, route, { locator: "https://a.example/x" });
  assert.equal(again.body.existed, true);
  assert.equal(again.body.existed_undetermined, undefined);
  const big = new Uint8Array(8 * 1024 * 1024 + 1).fill(1);
  const mr = { "https://a.example/big": () => new Response(big) };
  const m1 = await run(w, mr, { locator: "https://a.example/big" });
  assert.equal(m1.body.existed, null);
  assert.equal(m1.body.existed_undetermined, word("acquisition.text.document_captured_parts", { parts: 2, held_parts: 0 }), "T53-101: read from the word table; what was and was not asked, and how many parts were held");
  assert.doesNotMatch(m1.body.existed_undetermined, /\bbundle\b/, "N458: the member's word is record");
  const m2 = await run(w, mr, { locator: "https://a.example/big" });
  assert.equal(m2.body.existed, null, "several parts never answer false, even when every part was held");
  assert.equal(m2.body.existed_undetermined, word("acquisition.text.document_captured_parts", { parts: 2, held_parts: 2 }));
  const reg = world({ provOpts: { registered: [sha(big)] } });
  const rr = await run(reg, mr, { locator: "https://a.example/big" });
  assert.deepEqual([rr.body.existed, rr.body.existed_undetermined], [true, undefined]);
  const silent = world({ prov: { recordReceipt() {}, registerHolds() { throw new Error("down"); } } });
  const s = await run(silent, mr, { locator: "https://a.example/big" });
  assert.equal(s.body.existed, null); assert.equal(s.body.existed_undetermined, word("acquisition.text.document_captured_parts_store", { parts: 2, held_parts: 0 }), "the register could not be asked, and the answer says so");
  /* over-strictness: the document a capture files does not depend on what existed, byte for byte */
  assert.equal(JSON.stringify(first.body.document), JSON.stringify(again.body.document));
});

test("R12: a continuation resumes the session's outstanding files against the session's own primary and never fetches the primary again", async () => {
  const w = world();
  w.store.recordCaptureLimit({ runtime: "subrequests", observed: 7 });
  const many = Array.from({ length: 6 }, (_, i) => `<link rel="stylesheet" href="/c${i}.css">`).join("");
  const routes = (u) => u === "https://s.example/p" ? page(HTML(many)) : u.endsWith(".css") ? new Response("a{}", { headers: { "content-type": "text/css" } }) : null;
  const first = await run(w, routes, { locator: "https://s.example/p", subresources: true });
  const cont = first.body.snapshot.continuation;
  assert.ok(cont && cont.session, "the walk was cut short by the observed ceiling and parked");
  assert.equal(w.store.state.sessionSaves[0].primarySha, first.body.document.capture.sha256);
  const primary = first.body.document.capture.sha256;
  const receipts = w.prov.receipts.length;
  const second = await run(w, routes, { locator: "https://s.example/p", subresources: true, continue: cont.session });
  assert.equal(second.status, 200);
  assert.ok(!second.net.seen.some((x) => x.url === "https://s.example/p"), "the primary is not fetched again");
  assert.ok(second.net.seen.length >= 1, "the outstanding files are");
  assert.equal(second.body.continued.primary.sha256, primary, "against the session's own primary");
  assert.equal(second.body.document, undefined, "a continuation writes no document");
  assert.equal(w.prov.receipts.length, receipts, "and writes no receipt");
});

test("R13: one receipt per filed capture under the document address (the resolved address for a direct fetch), via and retrieval locator; a failed write fails nothing", async () => {
  const w = world();
  for (const [ct, body] of [["application/pdf", "%PDF-1.4"], ["text/plain", "t"], ["application/octet-stream", "b"]]) {
    await run(w, { "https://a.example/x": new Response(body, { headers: { "content-type": ct } }) }, { locator: "https://a.example/x" });
  }
  assert.equal(w.prov.receipts.length, 3, "whatever its content type");
  assert.deepEqual([w.prov.receipts[0].address, w.prov.receipts[0].addressNorm, w.prov.receipts[0].via, w.prov.receipts[0].retrievalLocator, w.prov.receipts[0].captureSha],
                   ["https://a.example/x", "https://a.example/x", "direct", "https://a.example/x", sha("%PDF-1.4")]);
  assert.match(w.prov.receipts[0].retrieved, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  /* a direct fetch that redirected: the address it resolved to */
  const redirected = () => { const r = text("moved"); Object.defineProperty(r, "url", { value: "https://a.example/final" }); return r; };
  const rd = await run(w, { "https://a.example/old": redirected }, { locator: "https://a.example/old" });
  assert.equal(rd.status, 200);
  assert.deepEqual([w.prov.receipts.at(-1).address, w.prov.receipts.at(-1).retrievalLocator], ["https://a.example/final", "https://a.example/old"]);
  /* whether or not its supporting files were captured */
  await run(w, { "https://s.example/p": page(HTML()) }, { locator: "https://s.example/p", subresources: true });
  assert.equal(w.prov.receipts.at(-1).address, "https://s.example/p");
  /* a failed receipt write does not fail the capture, and the capture is the same */
  const failing = world({ prov: { recordReceipt() { throw new Error("down"); }, registerHolds: () => ({}) } });
  /* N998: the clock pinned for both captures (as in R2's), so the comparison is exact, with nothing normalised */
  mock.timers.enable({ apis: ["Date"], now: Date.parse("2026-03-04T05:06:07.500Z") });
  let f, plain;
  try {
    f = await run(failing, { "https://a.example/x": text("b") }, { locator: "https://a.example/x" });
    plain = await run(world({ prov: { recordReceipt() {}, registerHolds: () => ({}) } }), { "https://a.example/x": text("b") }, { locator: "https://a.example/x" });
  } finally { mock.timers.reset(); }
  assert.equal(f.status, 200);
  assert.equal(JSON.stringify(f.body.document), JSON.stringify(plain.body.document), "over-strictness: the capture unchanged");
});

test("R14 R16 R31: transport, the chain, the capture block, the origin and the file", async () => {
  const w = world();
  const r = await run(w, { "https://a.example/dir/report.txt": text("body text", { "content-type": "text/plain; charset=utf-8", "x-a": "1", "etag": "e" }) },
                      { locator: "https://a.example/dir/report.txt", matchedSweep: "SWEEP-1" }, { cls: "member", member: true, sessMember: "m1" });
  const d = r.body.document;
  assert.deepEqual(Object.keys(d.capture.transport).sort(), ["http_headers", "peer_address", "peer_address_unavailable", "redirected", "requested", "resolved", "status"]);
  assert.equal(d.capture.transport.peer_address, null); assert.equal(d.capture.transport.peer_address_unavailable, word("acquisition.index.the_workers_runtime_does_not"));
  assert.ok(d.capture.transport.http_headers.some(([k, v]) => k === "etag" && v === "e"));
  assert.ok(d.capture.transport.http_headers.some(([k, v]) => k === "x-a" && v === "1"), "every header");
  assert.deepEqual([d.capture.transport.requested, d.capture.transport.resolved, d.capture.transport.status, d.capture.transport.redirected],
                   ["https://a.example/dir/report.txt", "https://a.example/dir/report.txt", 200, false]);
  const hop = d.provenance_chain[0];
  assert.equal(hop.who, "instance inst (Civicsmith/9.9.9)", "R16 (DEC-124): this instance, Civicsmith and its version");
  assert.equal(hop.asserts, `these bytes were served for https://a.example/dir/report.txt at ${d.retrieved}`);
  assert.deepEqual([hop.bound, hop.via], [false, "direct"]);
  assert.deepEqual([d.capture.method, d.capture.actor_class, d.capture.actor, d.capture.encoding, d.capture.bytes, d.capture.content_type],
                   [localize("acquisition.index.bio_plane_acquire_hashed_at_receipt", "bio-plane acquire, https fetch, hashed at receipt"), "member", "m1", "binary", 9, "text/plain"]);
  assert.equal(d.capture.sha256, sha("body text"));
  assert.deepEqual(d.origin, { kind: "named_request" }, "R31 (K1126): a body's matchedSweep is ignored");
  assert.deepEqual(d.attestation_attempts.length > 0, true);
  assert.equal(d.file, "snapshots/report.txt"); assert.equal(d.locator, "https://a.example/dir/report.txt");
  assert.match(d.retrieved, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/);
  assert.deepEqual(w.store.state.actors.map((a) => [a.captureSha, a.actor]), [[sha("body text"), "m1"]], "capture R69: the actor is recorded");
  const probe = await run(w, { "https://a.example/y": text("y") }, { locator: "https://a.example/y", file: "named/ file" }, { cls: "probe", member: false });
  assert.deepEqual([probe.body.document.capture.actor_class, probe.body.document.capture.actor], ["session", null]);
  assert.equal(probe.body.document.file, "snapshots/named--file");
  assert.deepEqual(probe.body.document.origin, { kind: "named_request" });
  const admin = await run(w, { "https://a.example/z": text("z") }, { locator: "https://a.example/z", matchedSweep: "S-2" }, { cls: "admin", member: false, sessMember: null });
  assert.equal(admin.body.document.capture.actor_class, "daemon");
  assert.deepEqual(admin.body.document.origin, { kind: "named_request" }, "R31 (K1126): ignored whatever the class");
  /* a redirect is recorded */
  const redirected = () => { const x = text("moved"); Object.defineProperty(x, "url", { value: "https://a.example/final" }); return x; };
  const rd = await run(w, { "https://a.example/old": redirected }, { locator: "https://a.example/old" });
  assert.deepEqual([rd.body.document.capture.transport.resolved, rd.body.document.capture.transport.redirected], ["https://a.example/final", true]);
  /* multipart: the method says so and the parts are named */
  const big = new Uint8Array(8 * 1024 * 1024 + 1).fill(2);
  const mp = await run(w, { "https://a.example/big": () => new Response(big) }, { locator: "https://a.example/big" });
  assert.equal(mp.body.document.capture.method, "bio-plane acquire, https fetch, streamed in 2 parts, hashed at receipt");
});

test("R15: an asserted authority is determined with a dated basis; none is undetermined and enqueues one event per digest; a failed enqueue fails nothing", async () => {
  const w = world();
  const route = { "https://a.example/x": () => text("x") };
  const det = await run(w, route, { locator: "https://a.example/x", authority: " City Clerk " });
  assert.deepEqual([det.body.document.authority, det.body.document.authority_state], ["City Clerk", "determined"]);
  assert.equal(det.body.document.authority_basis, word("acquisition.authority_basis.asserted_capturing_intake", { caller: "member", retrieved: det.body.document.retrieved }));
  assert.equal(w.store.state.events.length, 0);
  const caller = await run(w, route, { locator: "https://a.example/x", authority: "Clerk" }, { cls: "admin", member: false });
  assert.equal(caller.body.document.authority_basis, word("acquisition.authority_basis.asserted_capturing_intake", { caller: "caller", retrieved: caller.body.document.retrieved }));
  for (const a of [undefined, "", "   ", 7]) {
    const un = await run(w, route, { locator: "https://a.example/x", authority: a });
    assert.equal(un.status, 200, "never refused");
    assert.equal(un.body.document.authority_state, "undetermined"); assert.equal(un.body.document.authority_basis, word("acquisition.authority_basis.assertion_supplied_mechanical", { retrieved: un.body.document.retrieved }));
  }
  assert.equal(w.store.state.events.length, 1, "one per capture digest");
  assert.deepEqual([w.store.state.events[0].kind, w.store.state.events[0].subject, w.store.state.events[0].captureSha],
                   ["authority-undetermined", "https://a.example/x", sha("x")]);
  const link = "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit";
  const odt = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 1, 2, 3]);
  await run(w, { "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/export?format=odt": new Response(odt) }, { locator: link });
  assert.equal(w.store.state.events.find((e) => e.captureSha === sha(odt)).subject, link, "the Drive link for a Drive export");
  const failing = world();
  failing.store.taskEnqueue = async () => { throw new Error("queue down"); };
  assert.equal((await run(failing, route, { locator: "https://a.example/x" })).status, 200);
});

test("R17: the profile is docprofile's over what was fetched, under the combined view of the active profiles, with the format and the digests", async () => {
  const w = world();
  w.core.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:admin");
  const r = await run(w, { "https://a.example/p": page(HTML("<p>minutes</p>")) }, { locator: "https://a.example/p" });
  const p = r.body.document.profile;
  for (const k of ["handler", "handler_label", "handler_version", "confidence", "signals", "document_kind", "at", "content_type", "content_type_label",
                   "content_type_version", "content_type_confidence", "content_type_signals", "contract", "normalised", "boundary", "format", "digests"])
    assert.ok(k in p, k);
  assert.deepEqual(p.jurisdiction_view, ["test-port-ellery"], "the view the content type was judged under");
  assert.equal(p.at, r.body.document.retrieved);
  assert.equal(p.format.format, "html"); assert.equal(p.profiled_from_text, true); assert.equal(p.source_content_type, "text/html");
  assert.equal(typeof p.digests.determined, "boolean"); assert.ok(p.digests.basis);
  const pdf = await run(w, { "https://a.example/d.pdf": new Response("%PDF-1.7 rest", { headers: { "content-type": "application/octet-stream" } }) }, { locator: "https://a.example/d.pdf" });
  assert.equal(pdf.body.document.profile.format.format, "pdf", "detected from the bytes read back, not the declared type");
  assert.equal(pdf.body.document.profile.profiled_from_text, false);
  assert.equal(pdf.body.document.profile.digests.determined, false);
  const none = world();
  const n = await run(none, { "https://a.example/p": page(HTML()) }, { locator: "https://a.example/p" });
  assert.equal(n.body.document.profile.jurisdiction_view, null, "no setting: no view is claimed");
  /* a multipart primary is not read back; its format falls back to the declared type with the absence stated */
  const big = new Uint8Array(8 * 1024 * 1024 + 1).fill(65);
  const mp = await run(none, { "https://a.example/big": () => new Response(big, { headers: { "content-type": "application/pdf" } }) }, { locator: "https://a.example/big" });
  assert.equal(mp.body.document.profile.profiled_from_text, false);
  assert.equal(mp.body.document.profile.format.format, "pdf");
  assert.equal(mp.body.document.profile.format.confidence, "likely", "the declared type, not a byte signature");
  /* an unreadable primary is stated, never a failed capture */
  const gone = world();
  gone.b.get = async () => { throw new Error("gone"); };
  const g = await run(gone, { "https://a.example/p": page(HTML()) }, { locator: "https://a.example/p" });
  assert.equal(g.status, 200); assert.equal(g.body.document.profile.profiled_from_text, false);
});

test("R18 F1 (BD-18): the grade is the ceiling for a direct fetch; on the archive arm a raw replay is the archive letter via archive and a rewritten replay the rewritten letter, reference only, each read from its one definition", async () => {
  const w = world();
  const d = await run(w, { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.equal(d.body.document.capture.grade, EARNED_CAPTURE_CEILING);
  assert.ok(!("via_archive" in d.body.document.capture) && !("reference_only" in d.body.document.capture), "a direct fetch states neither");
  await eligible(w);
  const addr = "https://gone.example/doc";
  /* a raw replay: the `id_` form, the publisher's response unmodified */
  const a = await run(w, wayback([{ ts: "20250101000000", body: "a" }]), { via: "archive.org", address: addr }, { cls: "admin" });
  assert.equal(a.status, 200);
  const ac = a.body.document.capture;
  assert.equal(ac.grade, ARCHIVE_CAPTURE_GRADE, "provenance's one definition");
  assert.deepEqual([ac.via_archive, ac.custodian, ac.fetched_at, "reference_only" in ac],
                   [true, "web.archive.org", "2025-01-01T00:00:00Z", false], "via archive, the snapshot its fetch date, the archive its custodian");
  assert.equal(w.prov.receipts.at(-1).retrievalLocator, `${WB}20250101000000id_/${addr}`);
  /* a rewritten replay: the archive answers the raw form with a redirect to its rewritten page, and that is what is served */
  await eligible(w);
  const rewritten = `${WB}20250101000000/${addr}`;
  const r = await run(w, wayback([{ ts: "20250101000000", body: "a" }], { over: {
    [`${WB}20250101000000id_/${addr}`]: () => new Response("", { status: 302, headers: { location: rewritten } }),
    [rewritten]: () => new Response("<html>toolbar a</html>", { headers: { "content-type": "text/html", "memento-datetime": "Wed, 01 Jan 2025 00:00:00 GMT",
                                                                            link: `<${addr}>; rel="original"` } }) } }),
    { via: "archive.org", address: addr }, { cls: "admin" });
  assert.equal(r.status, 200, JSON.stringify(r.body));
  const rc = r.body.document.capture;
  assert.equal(rc.grade, REWRITTEN_REPLAY_GRADE, "provenance's one definition of a rewritten replay");
  assert.notEqual(REWRITTEN_REPLAY_GRADE, ARCHIVE_CAPTURE_GRADE);
  assert.deepEqual([rc.via_archive, rc.reference_only, "custodian" in rc, "fetched_at" in rc], [true, true, false, false]);
  assert.equal(w.prov.receipts.at(-1).retrievalLocator, rewritten);
});

test("R18 (N80): every success answer carries the note composed from the enforced ceiling and the letter above it; no refusal carries one; the composer refuses a sentence it cannot make true", async () => {
  const w = world();
  assert.equal(ACQUIRE_GRADE_NOTE, acquireGradeNote(EARNED_CAPTURE_CEILING, UNREACHABLE_CAPTURE_GRADE), "composed from the one definitions");
  assert.equal(ACQUIRE_GRADE_NOTE, word("acquisition.text.grade_bytes_fetched", { ceiling: String(EARNED_CAPTURE_CEILING), unreachable: String(UNREACHABLE_CAPTURE_GRADE) }));
  assert.match(acquireGradeNote("C", "B"), /^Grade C: .* Grade B needs .* raises C toward/, "the letters are the arguments, never typed");
  for (const [c, u] of [[null, "A"], ["B", null], [undefined, undefined]]) assert.throws(() => acquireGradeNote(c, u), /cannot be composed truthfully/);
  const d = await run(w, { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.deepEqual([d.status, d.body.note], [200, ACQUIRE_GRADE_NOTE], "a filed capture");
  assert.equal(d.body.document.capture.grade, EARNED_CAPTURE_CEILING, "beside the grade it states");
  w.store.recordCaptureLimit({ runtime: "subrequests", observed: 7 });
  const many = Array.from({ length: 6 }, (_, i) => `<link rel="stylesheet" href="/c${i}.css">`).join("");
  const routes = (u) => u === "https://s.example/p" ? page(HTML(many)) : u.endsWith(".css") ? new Response("a{}", { headers: { "content-type": "text/css" } }) : null;
  const first = await run(w, routes, { locator: "https://s.example/p", subresources: true });
  assert.equal(first.body.note, ACQUIRE_GRADE_NOTE);
  const cont = await run(w, routes, { locator: "https://s.example/p", subresources: true, continue: first.body.snapshot.continuation.session });
  assert.deepEqual([cont.status, cont.body.continued ? "continued" : null, cont.body.note], [200, "continued", ACQUIRE_GRADE_NOTE]);
  for (const [routesR, body] of [[{}, { locator: "http://a.example/x" }], [{ "https://a.example/r": new Response("no", { status: 410 }) }, { locator: "https://a.example/r" }],
                                 [{}, { locator: "https://drive.google.com/drive/folders/1AbCdEfGhIjK" }]]) {
    const r = await run(w, routesR, body);
    assert.equal(r.body.ok, false); assert.equal("note" in r.body, false, r.body.reason);
  }
});

const SITE = (links) => HTML(`<link rel="stylesheet" href="/s.css"><img src="/i.png"><nav><a href="/about">About</a></nav>${links || ""}`);
const siteRoutes = { "https://s.example/p": () => page(SITE('<a href="https://t.example/x">x</a>')), "https://s.example/s.css": () => new Response("body{}", { headers: { "content-type": "text/css" } }),
                     "https://s.example/i.png": () => new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "content-type": "image/png" } }) };

test("R19: the walk of a single HTML page's supporting files, its bookkeeping through the store, the governor's cool-off, the skips, and the compute measurement", async () => {
  const w = world();
  const r = await run(w, siteRoutes, { locator: "https://s.example/p", subresources: true });
  assert.equal(r.status, 200);
  assert.ok(Array.isArray(r.body.subresources) && r.body.subresources.length >= 2);
  const snap = r.body.snapshot;
  for (const k of ["manifest_sha256", "render_sha256", "discovered", "attempted", "complete", "outstanding", "platform", "reuse", "part_fetch_spread", "compute"]) assert.ok(k in snap, k);
  assert.equal(snap.continuation, undefined, "complete: nothing parked");
  assert.deepEqual(Object.keys(r.body.files).sort(), ["data/snapshot-manifest.json", "snapshots/p.render.html"]);
  assert.ok(w.held(snap.manifest_sha256) && w.held(snap.render_sha256));
  const st = w.store.state;
  assert.deepEqual(st.emitted.map(([e, m]) => [e, m.metric, m.value]), [["compute", "capture_work_bytes", snap.compute.work_bytes]], "capture R55: handed to the listeners");
  assert.match(st.emitted[0][1].detail, /compute calls over \d+ bytes; \d+ fetched, \d+ discovered/);
  assert.equal(st.links.length, 1);
  assert.equal(st.links[0].sourceCapture, r.body.document.capture.sha256);
  assert.ok(st.links[0].links.some((l) => l.address_norm === "https://t.example/x" && l.chrome === false), "capture R27: the links, with containment");
  assert.ok(st.links[0].links.some((l) => l.address_norm === "https://s.example/about" && l.chrome === true));
  assert.equal(st.siteRecords.length, 1); assert.equal(st.siteRecords[0].host, "s.example");
  assert.ok(st.siteRecords[0].observations.length >= 1, "capture R25: the site observations");
  assert.ok(w.gov.calls.some((c) => c[0] === "report" && c[1] === "s.example" && c[2] === 200), "every subresource outcome reported");
  const subFetches = r.net.seen.filter((x) => x.url !== "https://s.example/p");
  assert.ok(subFetches.length >= 1 && subFetches.every((x) => /^Civicsmith\//.test(x.init.headers["user-agent"])));
  /* the ceiling: a probe is due, so the observed one is not used; a known one is */
  const limited = world(); limited.store.recordCaptureLimit({ runtime: "subrequests", observed: 7 });
  const many = Array.from({ length: 6 }, (_, i) => `<link rel="stylesheet" href="/c${i}.css">`).join("");
  const lr = await run(limited, (u) => u === "https://s.example/p" ? page(HTML(many)) : u.endsWith(".css") ? new Response("a{}", { headers: { "content-type": "text/css" } }) : null,
                       { locator: "https://s.example/p", subresources: true });
  assert.equal(lr.body.snapshot.complete, false); assert.ok(lr.body.snapshot.continuation.session);
  assert.equal(limited.store.state.sessions.size, 1, "capture R22: parked when anything is outstanding");
  /* each tick takes what the observed ceiling allows; the session is continued until nothing is outstanding */
  let fin = lr, ticks = 0;
  while (!fin.body.snapshot.complete && ticks < 10) {
    const outstanding = fin.body.snapshot.outstanding;
    fin = await run(limited, (u) => u.endsWith(".css") ? new Response("a{}", { headers: { "content-type": "text/css" } }) : null,
                    { locator: "https://s.example/p", subresources: true, continue: lr.body.snapshot.continuation.session });
    ticks++;
    if (!fin.body.snapshot.complete) {
      assert.ok(fin.body.snapshot.outstanding < outstanding, "each continuation makes progress");
      assert.equal(limited.store.state.sessions.size, 1, "still parked while anything is outstanding");
    }
  }
  assert.equal(fin.body.snapshot.complete, true, "the continuations finish the walk");
  assert.deepEqual([limited.store.state.sessions.size, limited.store.state.sessionDrops.length], [0, 1], "dropped when complete");
  /* the stagger is the store's setting */
  const slow = world(); slow.store.staggerMs = 60;
  const t0 = Date.now();
  await run(slow, siteRoutes, { locator: "https://s.example/p", subresources: true });
  assert.ok(Date.now() - t0 >= 60, "each supporting fetch waits the stagger");
  /* a host cooling off stops the rest */
  const cw = world({ gov: { held: ["s.example"] } });
  const c = await run(cw, siteRoutes, { locator: "https://s.example/p", subresources: true });
  assert.ok(c.body.subresources.some((s) => s.reason === "HOST_COOLING_OFF" || s.status === 0));
  assert.ok(!c.net.seen.some((x) => x.url === "https://s.example/s.css"), "nothing fetched from a host cooling off");
  /* the skips: the capture is unaffected */
  const nh = await run(w, { "https://s.example/t.txt": text("t") }, { locator: "https://s.example/t.txt", subresources: true });
  assert.deepEqual([nh.status, nh.body.subresources_skipped.reason], [200, "NOT_HTML"]);
  const big = "x".repeat(8 * 1024 * 1024 + 1);
  const tl = await run(w, { "https://s.example/big": page(big) }, { locator: "https://s.example/big", subresources: true });
  assert.deepEqual([tl.status, tl.body.subresources_skipped.reason], [200, "TOO_LARGE_TO_PARSE"]);
  const gone = world();
  const origGet = gone.b.get; gone.b.get = async (k) => (k.includes("/captures/") ? null : origGet.call(gone.b, k));
  const pu = await run(gone, siteRoutes, { locator: "https://s.example/p", subresources: true });
  assert.deepEqual([pu.status, pu.body.subresources_skipped.reason], [200, "PRIMARY_UNREADABLE"]);
  const ns = await run(w, siteRoutes, { locator: "https://s.example/p", subresources: true, continue: "cs_none" });
  assert.deepEqual([ns.status, ns.body.subresources_skipped.reason], [200, "NO_SUCH_SESSION"]);
  assert.ok(ns.body.document, "an unreadable session: the capture proceeds as an ordinary one");
  /* a non-2xx supporting file is SOURCE_REFUSED */
  const refusing = await run(world(), { ...siteRoutes, "https://s.example/s.css": () => new Response("no", { status: 404 }) }, { locator: "https://s.example/p", subresources: true });
  assert.ok(refusing.body.subresources.some((s) => s.reason === "SOURCE_REFUSED" && s.status === 404));
  /* a failed bookkeeping write never fails the capture */
  const bk = world();
  for (const k of ["recordLinks", "recordSiteAssets", "recordCaptureLimit", "saveCaptureSession", "emit"]) bk.store[k] = () => { throw new Error("x"); };
  bk.store.captureLimit = () => { throw new Error("x"); };
  assert.equal((await run(bk, siteRoutes, { locator: "https://s.example/p", subresources: true })).status, 200);
  /* without `subresources: true` nothing is walked */
  const plain = await run(world(), siteRoutes, { locator: "https://s.example/p" });
  assert.deepEqual([plain.body.subresources, plain.body.snapshot, plain.net.seen.length], [undefined, undefined, 1]);
});

/* A granted RFC 3161 TimeStampResp whose token carries the digest's raw bytes (what attestation's `attest` binds a
   token on, its R2); the bytes are this file's. */
function granted(digestHex) {
  const der = (tag, body) => {
    const n = body.length;
    return Buffer.concat([Buffer.from([tag, ...(n < 128 ? [n] : n < 256 ? [0x81, n] : [0x82, n >> 8, n & 255])]), body]);
  };
  const status = der(0x30, der(0x02, Buffer.from([0])));
  const token = der(0x30, Buffer.concat([der(0x06, Buffer.from([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x07, 0x02])),
                                          der(0x04, Buffer.from(digestHex, "hex"))]));
  return der(0x30, Buffer.concat([status, token]));
}

test("R20 R28: every capture asks attestation's attest for a timestamp and, wherever the source permits, a co-archive, each through the governor under the attest agent, recording every attempt in the register's shape; a failure is an attempt, never a failed capture", async () => {
  /* no authority answers: every authority is asked, then the co-archive of the document's own address */
  const w = world();
  const d = await run(w, { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.equal(d.status, 200);
  const asked = d.net.attest;
  const posts = asked.filter((x) => x.init.method === "POST"), gets = asked.filter((x) => x.init.method !== "POST");
  assert.ok(posts.length >= 1, "the timestamp authorities were asked");
  assert.deepEqual(gets.map((x) => x.url.endsWith("https://a.example/x")), [true], "one co-archive, of the locator");
  for (const x of asked) {
    assert.equal(x.init.headers["user-agent"], civicsmithUserAgent("9.9.9", "inst", "attest"));
    assert.ok(w.gov.calls.some((c) => c[0] === "admit" && c[1] === new URL(x.url).host), `${x.url} through the governor`);
  }
  const at = d.body.document.attestation_attempts;
  assert.equal(at.length, asked.length, "every request is an attempt, recorded");
  assert.ok(at.every((a) => typeof a.service === "string" && a.service && a.attempted === true && a.ok === false && /^http 404$/.test(a.note)
                          && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(a.at)), JSON.stringify(at));
  /* the first authority grants: its token is kept under its own digest and no later authority is asked */
  const g = world();
  const ok = await run(g, (u, init) => u === "https://a.example/x" ? text("x")
    : init.method === "POST" ? new Response(granted(sha("x"))) : new Response("archived", { status: 200 }), { locator: "https://a.example/x" });
  /* R20 (fix round 3, C12): no set time is waited for the timestamp, so a grant that takes more than a tick to read is recorded
     against the capture when it ends (capture R68), not in the document the answer carried; either way the attempt is this one */
  let first = ok.body.document.attestation_attempts[0];
  if (first.pending) {
    let late = null;
    for (let i = 0; i < 500 && !(late = g.store.state.late[0]); i++) await new Promise((r) => setTimeout(r, 10));
    assert.ok(late, "the attempt is recorded when it ends");
    first = late.attempts[0];
  }
  assert.deepEqual([first.ok, first.kind, first.attempted, ok.net.attest.filter((x) => x.init.method === "POST").length], [true, "rfc3161", true, 1]);
  assert.ok(g.held(first.token_sha256), "the token is held under its own digest");
  /* the archive arm's locator is itself an archive replay, so no co-archive is asked of it */
  const a = world(); await eligible(a);
  const arch = await run(a, wayback([{ ts: "20250101000000", body: "a" }]), { via: "archive.org", address: "https://gone.example/doc" }, { cls: "admin" });
  assert.equal(arch.status, 200);
  assert.ok(arch.net.attest.length >= 1 && arch.net.attest.every((x) => x.init.method === "POST"), "timestamps only");
  /* a capture in parts: no object under the whole's hash (past MULTIPART_KEEP_MAX the whole is not kept, C5), so attest asks the register, and this plane's receipt lets it proceed */
  const mp = world();
  const big = new Uint8Array(MULTIPART_KEEP_MAX + 1).fill(3);
  const m = await run(mp, { "https://a.example/big": () => new Response(big) }, { locator: "https://a.example/big" });
  assert.deepEqual([m.status, mp.prov.holds.includes(sha(big))], [200, true]);
  assert.ok(m.body.document.attestation_attempts.every((x) => x.attempted === true), "asked, on the receipt's strength");
  /* the register cannot be asked: attest names what it could not do, recorded as an attempt not made; the capture stands */
  const silent = world({ prov: { recordReceipt() {}, registerHolds() { throw new Error("down"); } } });
  const s = await run(silent, { "https://a.example/big": () => new Response(big) }, { locator: "https://a.example/big" });
  assert.equal(s.status, 200);
  assert.deepEqual(s.body.document.attestation_attempts.map((x) => [x.service, x.attempted, x.ok, x.note]), [["attest", false, false, "NO_SUCH_CAPTURE"]]);
  assert.equal(s.net.attest.length, 0, "no authority asked over bytes it could not find");
  /* an authority that throws is an attempt too */
  const t = world();
  const th = await run(t, (u) => (u === "https://a.example/x" ? text("x") : new Error("tsa down")), { locator: "https://a.example/x" });
  assert.equal(th.status, 200);
  assert.ok(th.body.document.attestation_attempts.every((x) => x.ok === false && /tsa down/.test(x.note)));
});

test("R8 R25 R26: acquire writes no bundle or register row, keeps the raw bytes under their own digest beside separate derived artifacts, and answers no reading", async () => {
  const w = world();
  const count = () => w.rows(`SELECT (SELECT count(*) FROM bundles) b, (SELECT count(*) FROM files) f, (SELECT count(*) FROM history) h, (SELECT count(*) FROM manifest) m, (SELECT count(*) FROM register) r`)[0];
  const before = { ...count() };
  const routes = { "https://s.example/p": () => page(SITE()), "https://s.example/s.css": () => new Response("x{}", { headers: { "content-type": "text/css" } }) };
  const r = await run(w, routes, { locator: "https://s.example/p", subresources: true });
  assert.deepEqual({ ...count() }, before, "no bundle, file, history, manifest or register row");
  const d = r.body.document;
  assert.ok(w.held(d.capture.sha256));
  assert.equal(sha(w.bytesOf(d.capture.sha256)), d.capture.sha256, "the raw bytes as served");
  assert.equal(Buffer.from(w.bytesOf(d.capture.sha256)).toString(), SITE(), "never rewritten");
  assert.notEqual(r.body.snapshot.render_sha256, d.capture.sha256, "the companion is separate");
  assert.ok(d.renditions && d.renditions.length === 2);
  for (const k of ["reading", "text_units"]) { assert.equal(k in d, false); assert.equal(k in r.body, false); }
  const t = await run(w, { "https://a.example/t": text("some words") }, { locator: "https://a.example/t" });
  for (const k of ["reading", "text_units", "text"]) assert.equal(k in t.body, false);
});

test("R29 R30: each refusal carries its row, and nothing in the answers names a place", async () => {
  const w = world();
  const answers = [];
  for (const b of [{ locator: "https://drive.google.com/drive/folders/1AbCdEfGhIjK" }, { locator: "https://r.example/p", render: "x" },
                   { via: "capture-request", request: "r" }, { locator: "https://a.example/x" }, { locator: "https://a.example/p" }])
    answers.push((await run(w, { "https://a.example/x": text("x"), "https://a.example/p": page(HTML("<p>Council minutes</p>")) }, b)).body);
  for (const a of answers.slice(0, 3)) assert.ok(a.check && a.translation, `${a.reason} carries its row`);
  assert.ok(!/oakland|alameda/i.test(JSON.stringify(answers)), "with no profile active, no place");
  /* with a profile active, a place reaches the answer only through the profile view it names */
  w.core.setSetting("jurisdiction_profiles", ["test-port-ellery"], "member:admin");
  const v = await run(w, { "https://a.example/p": page(HTML("<p>Council minutes</p>")) }, { locator: "https://a.example/p" });
  assert.deepEqual(v.body.document.profile.jurisdiction_view, ["test-port-ellery"]);
  assert.ok(!/oakland|alameda/i.test(JSON.stringify(v.body)));
});

/* The drain's in-process arm (K58), as capture-requests fires it. */
const arm = (w, routes, captureRequest, body = {}) => run(w, routes, body, { cls: "daemon", member: false, sessMember: null,
  captureRequest: { locator: "https://a.example/doc", purpose: "investigate", agent: null, render: false, ...captureRequest } });

test("R21 R31: the capture-request arm files the drain's own origin as a sweep, never a body's; without one it is a named request", async () => {
  const w = world();
  const routes = { "https://a.example/doc": () => text("<p>d</p>") };
  const actor = { run: "RUN-1", plane: "member:m1", claude: "acct-1" };
  const sw = await arm(w, routes, { origin: { matched_sweep: "INQ-2026-0001", deeming_actor: actor } }, { matchedSweep: "FORGED" });
  assert.equal(sw.status, 200);
  assert.deepEqual(sw.body.document.origin, { kind: "sweep", matched_sweep: "INQ-2026-0001", deeming_actor: actor });
  const noActor = await arm(w, routes, { origin: { matched_sweep: "INQ-2026-0002" } });
  assert.deepEqual(noActor.body.document.origin, { kind: "sweep", matched_sweep: "INQ-2026-0002", deeming_actor: null });
  const plain = await arm(w, routes, {}, { matchedSweep: "FORGED" });
  assert.deepEqual(plain.body.document.origin, { kind: "named_request" }, "the body's matchedSweep is ignored on this arm");
  const empty = await arm(w, routes, { origin: { deeming_actor: actor } });
  assert.deepEqual(empty.body.document.origin, { kind: "named_request" }, "an origin naming no sweep is not a sweep");
  const member = await run(w, routes, { locator: "https://a.example/doc", matchedSweep: "SWEEP-1" });
  assert.deepEqual(member.body.document.origin, { kind: "named_request" }, "R31 (K1126): the body's matchedSweep is ignored on every arm");
  /* the arm renders exactly when the row says so */
  const env = rendererEnv(renderAnswer);
  const rw = world({ env });
  const rr = await arm(rw, { "https://a.example/doc": () => page(HTML("<div id=app></div>")) }, { render: true }, { render: false });
  assert.equal(rr.body.document.capture.method, "rendered", "the row's render flag, never the body's");
  const nr = await arm(rw, { "https://a.example/doc": () => page(HTML("<div id=app></div>")) }, { render: false }, { render: true });
  assert.equal(nr.body.document.capture.method, localize("acquisition.index.bio_plane_acquire_hashed_at_receipt", "bio-plane acquire, https fetch, hashed at receipt"));
});

test("R22: with the held capture's digest the arm fetches conditionally on the validators its own fetch recorded; a 304 files nothing and writes no receipt; without validators, identical bytes answer held", async () => {
  const w = world();
  const LM = "Wed, 01 Jul 2026 00:00:00 GMT";
  const doc = (extra = {}) => text("the document", { etag: '"v1"', "last-modified": LM, ...extra });
  const first = await run(w, { "https://a.example/doc": () => doc() }, { locator: "https://a.example/doc" });
  const heldSha = first.body.document.capture.sha256;
  assert.deepEqual(w.store.validatorsOf({ addressNorm: "https://a.example/doc", captureSha: heldSha }), { etag: '"v1"', lastModified: LM },
                   "recorded on every filed direct capture");
  const puts = () => w.b.calls.filter((c) => c[0] === "put").length;
  const [p0, r0] = [puts(), w.prov.receipts.length];
  const nm = await arm(w, { "https://a.example/doc": () => new Response(null, { status: 304 }) }, { heldSha });
  const sent = nm.net.seen[0].init.headers;
  assert.deepEqual([sent["if-none-match"], sent["if-modified-since"]], ['"v1"', LM]);
  assert.equal(nm.status, 200);
  assert.deepEqual([nm.body.ok, nm.body.existed, nm.body.unchanged, nm.body.capture], [true, true, true, { sha256: heldSha }]);
  assert.match(nm.body.basis, /304/); assert.equal(nm.body.document, undefined);
  assert.deepEqual([puts(), w.prov.receipts.length], [p0, r0], "no capture filed, no receipt written");
  const last = w.store.state.outcomes.at(-1);
  assert.deepEqual([last.addressNorm, last.outcome, last.status], ["https://a.example/doc", "success", 304], "capture R8: a success of the source");
  /* the source ignores the condition: the same bytes are the held capture */
  const same = await arm(w, { "https://a.example/doc": () => doc() }, { heldSha });
  assert.deepEqual([same.body.held, same.body.existed, same.body.document.capture.sha256], [true, true, heldSha]);
  /* no validators recorded for the pair: unconditional, and identical bytes answer held */
  const w2 = world();
  const bare = await arm(w2, { "https://a.example/doc": () => text("the document") }, {});
  const h2 = bare.body.document.capture.sha256;
  const again = await arm(w2, { "https://a.example/doc": () => text("the document") }, { heldSha: h2 });
  assert.equal(again.net.seen[0].init.headers["if-none-match"], undefined);
  assert.equal(again.net.seen[0].init.headers["if-modified-since"], undefined);
  assert.deepEqual([again.body.held, again.body.existed], [true, true]);
  const changed = await arm(w2, { "https://a.example/doc": () => text("new bytes") }, { heldSha: h2 });
  assert.equal(changed.body.held, undefined, "other bytes are a new capture");
  /* a heldSha that is not 64 hex is ignored; a 304 nobody asked for is the source refusing */
  const junk = await arm(w, { "https://a.example/doc": () => new Response(null, { status: 304 }) }, { heldSha: heldSha.toUpperCase() });
  assert.equal(junk.net.seen[0].init.headers["if-none-match"], undefined);
  assert.deepEqual([junk.status, junk.body.reason, junk.body.status], [502, "SOURCE_REFUSED", 304]);
  const other = await arm(w, { "https://a.example/other": () => new Response(null, { status: 304 }) }, { heldSha, locator: "https://a.example/other" });
  assert.equal(other.net.seen[0].init.headers["if-none-match"], undefined, "validators are the held capture's at THIS address");
  /* a render fetches its shell unconditionally, and records no validators */
  const rw = world({ env: rendererEnv(renderAnswer) });
  const rs = await run(rw, { "https://a.example/doc": () => page(HTML(), { etag: '"r"' }) }, { locator: "https://a.example/doc", render: true });
  assert.equal(rw.store.state.validators.size, 0, "a rendered capture's validators are not the rendered document's");
  assert.equal(rs.status, 200);
});

test("R23: a supplied credential rides the fetch to its own host only, as its kind says; the capture records whose it was and that the public cannot reproduce it, and never the secret", async () => {
  const w = world();
  const SECRET = "alice:s3cret-pass";
  const cred = (kind, secret = SECRET) => ({ credential: "CRED-1", kind, secret, supplied_by: "m1", scope: "project", project: "PROJ-1" });
  const routes = (u) => u === "https://a.example/doc" ? new Response(null, { status: 302, headers: { location: "/login-done" } })
    : u === "https://a.example/login-done" ? new Response(null, { status: 301, headers: { location: "https://cdn.example/file" } })
    : u === "https://cdn.example/file" ? text("members only") : null;
  const r = await arm(w, routes, { credential: cred("login") });
  assert.equal(r.status, 200);
  const hops = r.net.seen.map((x) => [x.url, x.init.headers.authorization ?? null, x.init.redirect]);
  const basic = `Basic ${Buffer.from(SECRET).toString("base64")}`;
  assert.deepEqual(hops, [["https://a.example/doc", basic, "manual"], ["https://a.example/login-done", basic, "manual"],
                          ["https://cdn.example/file", null, "manual"]], "followed by hand; another host gets no credential");
  assert.deepEqual(r.body.document.capture.credentialed, { credential: "CRED-1", kind: "login", supplied_by: "m1", scope: "project", project: "PROJ-1" });
  assert.equal(r.body.document.capture.reproducible_by_public, false);
  const everything = JSON.stringify([r.body, w.prov.receipts, w.store.state.outcomes, w.store.state.events]);
  assert.ok(!everything.includes(SECRET) && !everything.includes(Buffer.from(SECRET).toString("base64")), "the secret is nowhere");
  /* T50 (N1064): and in no table of the store, the tables read from the store's own list (never a hand list), nor in the store
     handed in (every outcome, event, session, validator and record it kept), nor in any object held in the evidence bucket */
  const b64 = Buffer.from(SECRET).toString("base64");
  const clean = (what, v) => { const d = inspect(v, { depth: null, maxArrayLength: null, maxStringLength: null, breakLength: Infinity });
                               assert.ok(!d.includes(SECRET) && !d.includes(b64), `${what} holds the secret`); };
  const tables = w.rows("SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' ORDER BY name").map((r) => r.name);
  assert.ok(tables.includes("bundles") && tables.includes("archive_entries") && tables.includes("captured_locators"), "the list is the store's own, and holds this module's tables");
  for (const t of tables) clean(`table ${t}`, w.rows(`SELECT * FROM "${t}"`));
  clean("the store handed in", w.store.state);
  for (const [k, v] of w.b.held) clean(`object ${k}`, Buffer.from(v).toString("latin1"));
  clean("the receipts", w.prov.receipts);
  const plainRoutes = { "https://a.example/doc": () => text("d") };
  const ua = await arm(w, plainRoutes, { credential: cred("user-agent", "Mozilla/5.0 (member's own)") });
  assert.equal(ua.net.seen[0].init.headers["user-agent"], "Mozilla/5.0 (member's own)");
  assert.equal(ua.net.seen[0].init.headers.authorization, undefined);
  assert.equal(ua.body.document.capture.credentialed.kind, "user-agent");
  assert.ok(!JSON.stringify(ua.body).includes("member's own"), "an agent secret is not recorded either");
  const other = await arm(w, plainRoutes, { credential: cred("other", "Bearer tok-123") });
  assert.equal(other.net.seen[0].init.headers.authorization, "Bearer tok-123");
  assert.match(other.net.seen[0].init.headers["user-agent"], /^Civicsmith\//, "R9's agent stays when the credential is not an agent");
  /* a thrown fetch carries no message when a credential rode it */
  const boom = await arm(w, () => new Error(`refused for ${SECRET}`), { credential: cred("login") });
  assert.equal(boom.body.reason, "FETCH_FAILED"); assert.ok(!JSON.stringify(boom.body).includes(SECRET));
  const bare = await arm(w, () => new Error("plain failure"), {});
  assert.match(bare.body.detail, /plain failure/, "without a credential the error is carried as before");
  /* R28: a hop followed by hand never leaves for an address that is not a public locator */
  const inward = await arm(w, (u) => u === "https://a.example/doc" ? new Response(null, { status: 302, headers: { location: "https://127.0.0.1/x" } }) : text("inside"),
                           { credential: cred("login") });
  assert.deepEqual(inward.net.seen.map((x) => x.url), ["https://a.example/doc"]);
  assert.deepEqual([inward.status, inward.body.reason, inward.body.status], [502, "SOURCE_REFUSED", 302]);
  /* without a credential, or with a malformed one, nothing is marked and the runtime follows redirects */
  for (const c of [undefined, { kind: "password", secret: "x" }, { kind: "login", secret: "" }, { kind: "login" }]) {
    const n = await arm(w, plainRoutes, c ? { credential: c } : {});
    assert.equal(n.body.document.capture.credentialed, undefined);
    assert.equal(n.body.document.capture.reproducible_by_public, undefined);
    assert.equal(n.net.seen[0].init.redirect, "follow"); assert.equal(n.net.seen[0].init.headers.authorization, undefined);
  }
});

test("R28: every outbound request of a capture is to a public locator, through the governor, under an agent naming the instance and purpose", async () => {
  const w = world();
  const routes = { ...siteRoutes, "https://s.example/p": () => page(SITE('<img src="http://s.example/plain.png"><link rel="stylesheet" href="https://127.0.0.1/x.css">')) };
  const r = await run(w, (u) => (routes[u] ? routes[u]() : new Response("no", { status: 503 })), { locator: "https://s.example/p", subresources: true });
  assert.equal(r.status, 200);
  for (const x of r.net.seen) {
    const u = new URL(x.url);
    assert.equal(u.protocol, "https:", x.url);
    assert.ok(!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname) && u.hostname !== "localhost", x.url);
    assert.match(x.init.headers["user-agent"], /^Civicsmith\/9\.9\.9 \(\+https:\/\/\S+; instance inst; (acquire|attest)\)$/);
  }
  const hosts = new Set(r.net.seen.map((x) => new URL(x.url).host));
  for (const h of hosts) assert.ok(w.gov.calls.some((c) => (c[0] === "admit" || c[0] === "isHeld") && c[1] === h), `${h} asked of the governor`);
});

test("R9 R16 (DEC-124): on every arm each outbound request names Civicsmith, the instance and the purpose, and the first hop's who is the instance with Civicsmith and its version; CivicOS is sent and written nowhere", async () => {
  const agentOk = (ua) => /^Civicsmith\/9\.9\.9 \(\+https:\/\/github\.com\/believeinoakland\/bio; instance inst; (acquire|attest|investigate|archive-lookup)\)$/.test(ua);
  const WHO = "instance inst (Civicsmith/9.9.9)";
  /* the direct arm, with its supporting files and co-attestation */
  const d = await run(world(), siteRoutes, { locator: "https://s.example/p", subresources: true });
  /* the archive arm */
  const a = world(); await eligible(a);
  const arch = await run(a, wayback([{ ts: "20250101000000", body: "archived" }]), { via: "archive.org", address: "https://gone.example/doc" }, { cls: "admin", member: false });
  /* the render arm (its shell fetch) */
  const r = await run(world({ env: rendererEnv(renderAnswer) }), { "https://r.example/page": page(HTML("<div id=app></div>")) }, { locator: "https://r.example/page", render: true });
  /* the capture-request arm with no delegated agent */
  const c = await arm(world(), { "https://a.example/doc": () => text("d") }, {});
  for (const [what, x] of [["direct", d], ["archive", arch], ["render", r], ["capture-request", c]]) {
    assert.equal(x.status, 200, what);
    const sent = [...x.net.seen, ...x.net.attest];
    assert.ok(sent.length >= 1, what);
    for (const s of sent) assert.ok(agentOk(s.init.headers["user-agent"]), `${what}: ${s.url} sent ${s.init.headers["user-agent"]}`);
    assert.equal(x.body.document.provenance_chain[0].who, WHO, `${what}: R16's first hop`);
    assert.ok(!JSON.stringify(x.body).includes("CivicOS"), `${what}: the old name is in no answer`);
  }
  /* the version and instance come from the instance; absent, R24's defaults */
  const bare = await run(world({ env: { INSTANCE_NAME: "", VERSION: "" } }), { "https://a.example/x": text("x") }, { locator: "https://a.example/x" });
  assert.equal(bare.body.document.provenance_chain[0].who, "instance unnamed (Civicsmith/0.0.0)");
  /* negative control: a delegated agent is sent verbatim, and the who is still this instance's */
  const del = await arm(world(), { "https://a.example/doc": () => text("d") }, { agent: "Mozilla/5.0 Member" });
  assert.equal(del.net.seen[0].init.headers["user-agent"], "Mozilla/5.0 Member");
  assert.equal(del.body.document.provenance_chain[0].who, WHO);
});

/* journey-check R2: the walk's failures, each driven at the walker's interface in a real browser over a small world of
   pages (the copy's address, a foreign address, legacy-ui's), each with a control that holds. */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Walk, FAIL, INTERFACE_MARK, SETUP_PAGE_TITLE, LEGACY_UI_WORKER, documentKind, refusalsIn } from "../../../src/journey-check/walker.mjs";
import { drawnState, sweepScreens, registryScreens, EXCEPTED, INSTALLER_SCREENS } from "../../../src/journey-check/screens.mjs";
import { browser } from "../../../src/journey-check/run.mjs";
import { ABSENCE } from "../../../src/journey-check/journeys.mjs";
import { assertDeclared, assertGiven } from "./tables.mjs";

const COPY = "https://grp.test.workers.dev";
const page = (body, title = "Civicsmith") => `<!doctype html><html><head><title>${title}</title><link rel="stylesheet" href="${INTERFACE_MARK}"></head><body>${body}</body></html>`;
const SECRET = "the-member-password-123";
const [SHA_A, SHA_B, SHA_C, SHA_D] = ["a", "b", "c", "d"].map((c) => c.repeat(64));
const WORLD = {
  "/app": page(`<main id="cs-main"><p>home</p><script>fetch("/api/?op=queue")</script></main>`),
  "/app/refused": page(`<main id="cs-main"><script>fetch("/api/?op=enroll")</script></main>`),
  "/app/missing": page(`<main id="cs-main"><script>fetch("/gone.png")</script></main>`),
  "/app/throws": page(`<main id="cs-main"><script>null.f()</script></main>`),
  "/app/foreign": page(`<main id="cs-main"><img src="https://elsewhere.example/x.png"></main>`),
  "/app/legacy": page(`<main id="cs-main"><img src="https://civicos.grp.workers.dev/app.html"></main>`),
  /* R8: the walk's D1, D3 and D5, each a refusal carried inside an HTTP 200 */
  "/app/d1": page(`<main id="cs-main"><script>fetch("/api/?op=aiownadd")</script></main>`),
  "/app/d3": page(`<main id="cs-main"><script>fetch("/api/?op=airunopen")</script></main>`),
  "/app/d5": page(`<main id="cs-main"><script>fetch("/api/?op=planask")</script></main>`),
  /* R8: a refusal in a stream of JSON lines (an ask's answer) */
  "/app/stream": page(`<main id="cs-main"><script>fetch("/api/?op=ask")</script></main>`),
  /* R8: a reading read while the record states it pending (RC-R1): an upload answered `reading_pending` for SHA_A, then the reading of that digest read */
  "/app/pending": page(`<main id="cs-main"><script>fetch("/api/?op=captureupload&sha=${SHA_A}").then(() => fetch("/api/?op=reading&sha256=${SHA_A}"))</script></main>`),
  "/app/pending-other": page(`<main id="cs-main"><script>fetch("/api/?op=captureupload&sha=${SHA_A}").then(() => fetch("/api/?op=reading&sha256=${SHA_B}"))</script></main>`),
  "/app/pending-none": page(`<main id="cs-main"><script>fetch("/api/?op=reading&sha256=${SHA_A}")</script></main>`),
  "/app/pending-ended": page(`<main id="cs-main"><script>fetch("/api/?op=captureupload&sha=${SHA_C}").then(() => fetch("/api/?op=reading&sha256=${SHA_C}")).then(() => fetch("/api/?op=reading&sha256=${SHA_C}"))</script></main>`),
  /* R8: a member's own testimony, recorded by the step (`testify` answering `authored: true` for SHA_D), is never read in: its reading read */
  "/app/testified": page(`<main id="cs-main"><script>fetch("/api/?op=testify", { method: "POST" }).then(() => fetch("/api/?op=reading&sha256=${SHA_D}"))</script></main>`),
  "/app/testified-other": page(`<main id="cs-main"><script>fetch("/api/?op=testify", { method: "POST" }).then(() => fetch("/api/?op=reading&sha256=${SHA_B}"))</script></main>`),
  "/app/testified-none": page(`<main id="cs-main"><script>fetch("/api/?op=reading&sha256=${SHA_D}")</script></main>`),
  "/": `<!doctype html><html><head><title>${SETUP_PAGE_TITLE}</title></head><body>setup</body></html>`,
  "/other": `<!doctype html><html><head><title>x</title></head><body>an old page</body></html>`,
};
// fixtures-own: input a route map and answers handed to the walker's own dispatch (K5060), which reads them opaquely
const API = { queue: { ok: true, items: [] }, enroll: { ok: false, code: "HANDLE_TAKEN" },
  /* D1: the own key refused, inside a 200 (`aiownadd`, which replaced `accountreferenceset` in T53, ai-accounts R35) */
  aiownadd: { ok: true, result: { ok: false, code: "NOT_YOUR_ACCOUNT", check: "C-29.14" } },
  // fixtures-own: input a route map and answers handed to the walker's own dispatch (K5060), which reads them opaquely
  /* D3: the dock's run not started, said as `started: false` */
  airunopen: { ok: true, result: { started: false, code: "AI_RUN_BOUND_NO_ALLOWANCE", check: "C-22.16" } },
  // fixtures-own: platform a fake-network answer for the walker's browser context, the platform double of its page (K5060)
  /* D5: planning help refused, deeper in the answer */
  planask: { ok: true, result: { plan: { help: { ok: false, reason: "AI_RUN_NOT_PROJECT_MEMBER" } } } } };

let B, dir;
const readOnce = new Set();
before(async () => { B = await browser(); dir = mkdtempSync(join(tmpdir(), "jc-walker-")); });
after(async () => { await B?.close(); rmSync(dir, { recursive: true, force: true }); });

async function walked(path, { expect = [] } = {}) {
  const walk = new Walk({ out: join(dir, String(Math.random()).slice(2)), arm: "local" });
  walk.copyHost = new URL(COPY).host;
  walk.keepSecret(SECRET);
  const ctx = await B.newContext();
  await ctx.route("**/*", async (r) => {
    const u = new URL(r.request().url());
    if (u.origin !== COPY) { walk.foreign(u.href); return r.abort("blockedbyclient"); }
    if (u.pathname === "/api/" && u.searchParams.get("op") === "ask")
      return r.fulfill({ status: 200, contentType: "application/x-ndjson", body: '{"ok":true,"stage":"reading"}\n{"ok":false,"code":"ASK_REFUSED"}\n' });
    /* RC-R1: the upload says its reading is pending for the digest it names; a reading of SHA_C is there on its first read, then gone (a record that ended its pending state and lost the reading) */
    if (u.pathname === "/api/" && u.searchParams.get("op") === "captureupload")
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { ok: true, reading_pending: true, document: { capture: { sha256: u.searchParams.get("sha") } } } }) });
    /* provenance's `testify` answer: an authored document and the digest of its bytes */
    if (u.pathname === "/api/" && u.searchParams.get("op") === "testify")
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { ok: true, bundle_id: "INF-1", capture_sha: SHA_D, authored: true, origin: "member" } }) });
    if (u.pathname === "/api/" && u.searchParams.get("op") === "reading") {
      const sha = u.searchParams.get("sha256");
      /* extraction's `readingFor` for a digest whose reading is not held: `found: false` at the answer's own top */
      if (sha === SHA_D)
        return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: { ok: true, found: false, capture_sha: sha, reading: null } }) });
      const there = sha === SHA_C && !readOnce.has(sha) && readOnce.add(sha);
      return r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ ok: true, result: there ? { ok: true, reading: { found: true } } : { ok: true, reading: { found: false, capture_sha: sha } } }) });
    }
    if (u.pathname === "/api/") { const j = API[u.searchParams.get("op")]; return r.fulfill({ status: j.ok ? 200 : 409, contentType: "application/json", body: JSON.stringify(j) }); }
    if (u.pathname === INTERFACE_MARK) return r.fulfill({ status: 200, contentType: "text/css", body: "main{}" });
    if (WORLD[u.pathname]) return r.fulfill({ status: 200, contentType: "text/html", body: WORLD[u.pathname] });
    return r.fulfill({ status: 404, body: "not found" });
  });
  const p = walk.watch(await ctx.newPage());
  await walk.step(p, `open ${path} (${SECRET})`, async (pg) => { await pg.goto(COPY + path); }, { expect }).catch(() => {});
  await ctx.close();
  return walk;
}
const kinds = (w) => w.failures.map((f) => f.kind);

test("R2: a clean step passes and is screenshotted into the output directory; its report is written beside it", async () => {
  const w = await walked("/app");
  assert.deepEqual(w.failures, []);
  assert.equal(w.steps.length, 1);
  assert.ok(w.steps[0].ok);
  assert.ok(existsSync(join(w.out, w.steps[0].screenshot)), "the screenshot is on disk");
  w.report();
  assert.ok(existsSync(join(w.out, "report.txt")));
});

test("R2: an `ok: false` the step does not expect fails the walk; control: the same refusal, expected by the step, does not", async () => {
  const w = await walked("/app/refused");
  assert.deepEqual(kinds(w), [FAIL.REFUSED]);
  assert.match(w.failures[0].detail, /op=enroll answered ok: false \(HANDLE_TAKEN, HTTP 409\)/);
  assert.deepEqual((await walked("/app/refused", { expect: ["HANDLE_TAKEN"] })).failures, []);
  /* a pattern names a family of codes; control: one that does not match still fails */
  assert.deepEqual((await walked("/app/refused", { expect: [/^HANDLE_/] })).failures, []);
  assert.deepEqual(kinds(await walked("/app/refused", { expect: [ABSENCE] })), [FAIL.REFUSED]);
});

test("R8 (D29): a refusal carried inside an HTTP 200 fails the step: fixtures of D1's, D3's and D5's answers each fail; control: the step that expects that refusal passes", async () => {
  for (const [path, code, how] of [["/app/d1", "NOT_YOUR_ACCOUNT", "ok: false at result"], ["/app/d3", "AI_RUN_BOUND_NO_ALLOWANCE", "started: false at result"],
    ["/app/d5", "AI_RUN_NOT_PROJECT_MEMBER", "ok: false at result.plan.help"]]) {
    const w = await walked(path);
    assert.deepEqual(kinds(w), [FAIL.REFUSED], path);
    assert.ok(w.failures[0].detail.includes(`${how} (${code}, HTTP 200)`), w.failures[0].detail);
    assert.equal(w.steps[0].ok, false);
    /* control: the expected refusal is excused by its code wherever it sits */
    assert.deepEqual((await walked(path, { expect: [code] })).failures, [], path);
  }
});

test("R8: a refusal on any line of a stream of JSON lines fails the step; control: expected, it passes", async () => {
  const w = await walked("/app/stream");
  assert.deepEqual(kinds(w), [FAIL.REFUSED]);
  assert.match(w.failures[0].detail, /op=ask answered ok: false at \[1\] \(ASK_REFUSED, HTTP 200\)/);
  assert.deepEqual((await walked("/app/stream", { expect: ["ASK_REFUSED"] })).failures, []);
});

test("R8: an expected refusal is excused where the step names it, `{at, code}`, and nowhere else", async () => {
  /* D5's refusal sits at result.plan.help: expected there, it passes; expected elsewhere, it still fails */
  assert.deepEqual((await walked("/app/d5", { expect: [{ at: /\.help$/, code: "AI_RUN_NOT_PROJECT_MEMBER" }] })).failures, []);
  assert.deepEqual(kinds(await walked("/app/d5", { expect: [{ at: /^result$/, code: "AI_RUN_NOT_PROJECT_MEMBER" }] })), [FAIL.REFUSED]);
});

test("R8: every sign of a refusal, at any depth: ok, started, dispatched or found false, and a non-empty withheld; control: an answer that holds none, and an empty withheld, carry none", () => {
  const codes = (b) => refusalsIn(b).map((r) => `${r.at}=${r.code}`);
  assert.deepEqual(codes({ ok: false, code: "A" }), ["=A"]);
  assert.deepEqual(codes({ ok: true, result: { dispatched: false } }), ["result=dispatched: false"]);
  assert.deepEqual(codes({ ok: true, result: { items: [{ found: false, reason: "GONE" }] } }), ["result.items[0]=GONE"]);
  assert.deepEqual(codes({ ok: true, result: { withheld: ["text"] } }), ["result=withheld"]);
  assert.deepEqual(codes({ ok: true, result: { started: true, found: true, withheld: [], items: [{ ok: true }] } }), []);
  /* one object, one refusal, under its first sign */
  assert.deepEqual(codes({ ok: false, started: false, code: "B" }), ["=B"]);
});

test("R8: a reading read as `found: false` is excused for the digest of a testimony the step itself recorded, which is never read in; control: another digest's, or with no testimony recorded, stays a refusal", async () => {
  assert.deepEqual((await walked("/app/testified")).failures, [], "the testimony's own digest");
  const other = await walked("/app/testified-other");
  assert.deepEqual(kinds(other), [FAIL.REFUSED], "another digest");
  assert.match(other.failures[0].detail, /op=reading answered found: false/);
  assert.deepEqual(kinds(await walked("/app/testified-none")), [FAIL.REFUSED], "no testimony recorded");
});

test("R8 (K4473): a reading read as `found: false` is excused only while the record states it pending for a capture the step itself made; control: any other `found: false` stays a refusal", async () => {
  assert.deepEqual((await walked("/app/pending")).failures, [], "the digest the upload said pending");
  const other = await walked("/app/pending-other");
  assert.deepEqual(kinds(other), [FAIL.REFUSED], "a digest no upload of the step made");
  assert.match(other.failures[0].detail, /op=reading answered found: false at result.reading/);
  assert.deepEqual(kinds(await walked("/app/pending-none")), [FAIL.REFUSED], "no capture of the step at all");
  /* once the reading is there the pending state has ended: a later `found: false` for it is a refusal */
  assert.deepEqual(kinds(await walked("/app/pending-ended")), [FAIL.REFUSED]);
});

test("R8 (K4486): a reading's own `found` (whether the reader found entities) is data, never a refusal; `found: false` still names a refusal at the answer's top or its `result`", () => {
  /* the answer the plane gave for the page captured by address (d480cc23…): the op found its reading; the generic reader found no entities in the stub page */
  const answer = { ok: true, result: { ok: true, found: true, capture_sha: "d".repeat(64), reader_found: false, entity_count: 0,
    reading: { content_type: "generic", reader_version: 1, read_from_text: true, found: false, entities: [], facts: {}, words_total: 76, words_read: 76,
      basis: "the generic reader found no entities in this document; recorded as an empty reading, never an emptied document" } } };
  assert.deepEqual(refusalsIn(answer), []);
  /* controls: the op found nothing, at the answer's top or its result; and an object that is not a reading keeps its `found: false` */
  assert.deepEqual(refusalsIn({ ok: true, found: false, capture_sha: "e".repeat(64), reading: null }).map((r) => r.how), ["found: false"]);
  assert.deepEqual(refusalsIn({ ok: true, result: { found: false, capture_sha: "e".repeat(64), reading: null } }).map((r) => `${r.at}=${r.code}`), ["result=found: false"]);
  assert.deepEqual(refusalsIn({ ok: true, result: { reading: { found: false } } }).map((r) => r.at), ["result.reading"], "not shaped as a reading: still a refusal");
  /* a refusal inside a reading is still seen */
  // fixtures-own: input a literal answer handed to the walker's own refusal reader (K5060), which reads it opaquely
  assert.deepEqual(refusalsIn({ ok: true, result: { reading: { reader_version: 1, entities: [], found: false, steps: [{ ok: false, code: "STEP" }] } } }).map((r) => r.code), ["STEP"]);
});

test("R2: any 4xx or 5xx fails the walk; control: a status the step expects does not", async () => {
  const w = await walked("/app/missing");
  assert.deepEqual(kinds(w), [FAIL.HTTP]);
  assert.match(w.failures[0].detail, /gone\.png answered HTTP 404/);
  assert.deepEqual((await walked("/app/missing", { expect: [404] })).failures, []);
});

test("R2: a page whose script throws fails the walk", async () => {
  const w = await walked("/app/throws");
  assert.deepEqual(kinds(w), [FAIL.SCRIPT]);
});

test("R2: the setup page or any other document that is not the interface, reached on the copy, fails as an old page; legacy-ui's address fails as one; any other address outside the walk fails", async () => {
  const setup = await walked("/");
  assert.deepEqual(kinds(setup), [FAIL.OLD_PAGE]);
  assert.match(setup.failures[0].detail, /is the setup page/);
  const other = await walked("/other");
  assert.deepEqual(kinds(other), [FAIL.OLD_PAGE]);
  assert.match(other.failures[0].detail, /is not the interface page/);
  const legacy = await walked("/app/legacy");
  assert.deepEqual(kinds(legacy), [FAIL.OLD_PAGE]);
  assert.match(legacy.failures[0].detail, /legacy-ui/);
  const foreign = await walked("/app/foreign");
  assert.deepEqual(kinds(foreign), [FAIL.ADDRESS]);
  /* control: the interface page itself is no old page */
  assert.equal(documentKind(WORLD["/app"]), "interface");
  assert.equal(documentKind(WORLD["/"]), "setup-page");
});

test("R2: no failure, step label or report carries a secret the walk holds", async () => {
  const w = await walked("/app/refused");
  const text = w.report() + readFileSync(join(w.out, "report.json"), "utf8");
  assert.equal(text.includes(SECRET), false);
  assert.ok(text.includes("[secret]"), "control: the label's secret is replaced, not dropped");
});

test("R2: the output directory is generated and never committed (ignored by git)", () => {
  const root = join(import.meta.dirname, "..", "..", "..", "..");
  const ignored = execFileSync("git", ["-C", root, "check-ignore", "bio-plane/src/journey-check/out/local/01-x.png"], { encoding: "utf8" });
  assert.match(ignored, /out\/local\/01-x\.png/);
});

/* ---- a registry screen not drawn ---- */

const DRAWS = {
  drawn: `<main id="cs-main"><nav class="cs-crumbs"><ol><li><a href="/app">Home</a></li><li><span aria-current="page">Members</span></li></ol></nav><h1 class="t-title">Members</h1><table><tr><td>ann</td></tr></table></main>`,
  unknown: `<main id="cs-main"><nav class="cs-crumbs"><ol><li><span aria-current="page">Nothing here</span></li></ol></nav><p class="cs-state" data-state="empty">Nothing here</p></main>`,
  later: `<main id="cs-main"><nav class="cs-crumbs"><ol><li><span aria-current="page">People</span></li></ol></nav><h1 class="t-title">People</h1><p class="cs-state" data-state="empty">People comes later.</p></main>`,
  failed: `<main id="cs-main"><nav class="cs-crumbs"><ol><li>x</li></ol></nav><p class="cs-state" data-state="failed">Failed</p></main>`,
  blank: `<main id="cs-main"></main>`,
  marked: `<main id="cs-main" data-screen="members"><p>x</p></main>`,
};
async function drawn(html, id) {
  const ctx = await B.newContext();
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><html><head><link rel="stylesheet" href="${INTERFACE_MARK}"></head><body>${html}</body></html>`);
  const st = await drawnState(p, id);
  await ctx.close();
  return st;
}

test("R2: a registry screen the shell does not draw fails: its \"Nothing here\" for a screen it does not hold, a place that comes later, a failed draw, a blank page; control: a drawn screen holds", async () => {
  assert.equal((await drawn(DRAWS.drawn, "members")).drawn, true);
  for (const k of ["unknown", "later", "failed", "blank"]) assert.equal((await drawn(DRAWS[k], "members")).drawn, false, k);
  /* the frame's own mark decides when it is drawn */
  assert.equal((await drawn(DRAWS.marked, "members")).drawn, true);
  assert.equal((await drawn(DRAWS.marked, "account")).drawn, false);
  /* a page that is not the interface draws no screen, whatever it holds */
  const ctx = await B.newContext();
  const p = await ctx.newPage();
  await p.setContent(`<!doctype html><html><body>${DRAWS.drawn}</body></html>`);
  assert.equal((await drawnState(p, "members")).drawn, false);
  await ctx.close();
});

test("R2 (K3137), R22: the sweep opens every registry screen but `site` (and the installer's own two pages, walked in the journey); `dash-action` and `dash-project` are swept", () => {
  const all = registryScreens().map((s) => s.id);
  const swept = sweepScreens().map((s) => s.id);
  assert.deepEqual(EXCEPTED, ["site"]);
  /* exactly those the registry lists of the excepted and the installer's (R22: `dash-action` and `dash-project` are drawn and walked) */
  const held = [...EXCEPTED, ...INSTALLER_SCREENS].filter((id) => all.includes(id)).sort();
  assert.deepEqual(all.filter((id) => !swept.includes(id)).sort(), held);
  for (const id of ["site", "install", "update"]) assert.ok(held.includes(id), id);
  for (const id of ["front", "setup", "join", "home", "members", "account", "capture", "doorbell", "published", "dash-action", "dash-project"]) assert.ok(swept.includes(id), id);
});

test("R2 (interface-shell R35): the sweep expects only the absence answers the shell draws as \"Nothing is here\" or \"You can't open this\"", () => {
  for (const c of ["NOT_FOUND", "NO_SUCH_CASE", "PROJECT_NOT_FOUND", "NOT_VISIBLE", "NOT_A_PARTICIPANT"]) assert.ok(ABSENCE.test(c), c);
  for (const c of ["NO_REVIEW_COPY", "REQUIRED_ARGUMENT_MISSING", "SESSION_LOCKED", "NOT_FOUNDED"]) assert.equal(ABSENCE.test(c), false, c);
});

test("R25: the old pages stay failures after the old interface is deleted: the setup page's title and a document from a host named civicos fail as OLD_PAGE with the same messages; control: the interface passes", async () => {
  assert.equal(LEGACY_UI_WORKER, "civicos");
  assert.equal(SETUP_PAGE_TITLE, "Your accountability record");
  const setup = await walked("/");
  assert.deepEqual(kinds(setup), [FAIL.OLD_PAGE]);
  assert.match(setup.failures[0].detail, /is the setup page/);
  const legacy = await walked("/app/legacy");
  assert.deepEqual(kinds(legacy), [FAIL.OLD_PAGE]);
  assert.match(legacy.failures[0].detail, /civicos\.grp\.workers\.dev is legacy-ui/);
  assert.deepEqual((await walked("/app")).failures, []);
});

test("R8 (K5062): the ops and codes of the walker's modelled answers (D1, D3, D5) are the plane's: every op is declared and every code and check is given by a product file", () => {
  assertDeclared(API, "the walker's answers");
  const codes = JSON.stringify(API).match(/"(?:code|reason|check)":"([^"]+)"/g).map((m) => m.replace(/^"[a-z]+":"|"$/g, ""));
  assert.ok(codes.length >= 4, codes.join(", "));
  assertGiven(codes, "the walker's answers");
  /* every route the pages fetch is an op of the table or a declared op */
  assertDeclared(["captureupload", "reading", "ask"], "the walker's pages");
});

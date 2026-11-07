/* capture-requests in the running plane (Miniflare, the Durable Object the product runs in): the ops' admission (R30),
   and the spine end to end through them (R16, R31): a member's run requests, only the drain fetches, and `op=acquire`
   refuses the capture-request arm from every caller. The ops' routing, classes and stamps are the control plane's
   (K3); this test measures that the module's ops are reached exactly as R30 states. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { civicsmithUserAgent } from "../../../src/acquisition/index.mjs";
import { planeEntry, PLANE_BINDINGS } from "./plane-world.mjs";
import { PLANS, HOSTS } from "../ai-accounts/catalogue.mjs";
import { CAPTURE_REQUEST_CHECKS } from "../../../src/capture-requests/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const CAPTURE_FETCH_FAILED_CHECK = CAPTURE_REQUEST_CHECKS.CAPTURE_FETCH_FAILED.check;

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "src");
const sha = (v) => createHash("sha256").update(v).digest("hex");
const SEEN = [], AGENTS = new Map();
const HELD = ["https://src.example.org/a.pdf", "https://spine.example.org/spine.pdf", "https://down.example.org/gone.pdf",
              "https://up.example.org/doc.pdf", "https://up.example.org/member-browser.pdf",
              "https://up.example.org/held-for.pdf"];
/* B4 (K2514): the plane as `src/` builds it, its Civicsmith set holding one matter and a passing test bar held on it
   (run-rules R19 as amended), `plane-world.mjs` */
const PLANE = planeEntry();
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: PLANE.entry,
  script: readFileSync(PLANE.entry, "utf8"), modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: "adm-cr", MEMBER_TOKEN: "mem-cr", PROBE_TOKEN: "prb-cr", DAEMON_TOKEN: "dmn-cr",
              VERSION: "1.0.0", INSTANCE_NAME: "cr-plane", GOVERNOR_APPETITE_PER_MIN: "600000",
              CAPTURE_REQUEST_TICK_MS: "3600000", MONITOR_TICK_MS: "3600000",
              /* N585 (K1614): the seal secret the opener's account reference is kept under (credentials R23) */
              ACCOUNT_SEAL_SECRET: "cr-plane-seal-secret",
              /* F1: the plane trusts its development catalogue key and holds the test catalogue (plane-world.mjs); and it is a
                 test instance (store-assembly's testInstanceOf), so a run served on the catalogue's entry is admitted by
                 run-rules R29's test-instance exception, Gate 1 recording no verdict for it here (ai-runs R78) */
              ...PLANE_BINDINGS, CIVICSMITH_TEST_INSTANCE: "cr-plane" },
  outboundService(request) {
    SEEN.push(request.url);
    AGENTS.set(request.url, request.headers.get("User-Agent"));
    /* R49 (T35): the page a member captures first, whose outbound links are the addresses the runs below ask for, so
       each is an address the record already holds (capture R27's links) */
    if (new URL(request.url).host === "index.example.org")
      return new Response(`<!doctype html><html><head><title>Index</title></head><body>${HELD.map((u) =>
        `<a href="${u}">${u}</a>`).join(" ")}</body></html>`, { headers: { "content-type": "text/html; charset=utf-8" } });
    /* a 500, held (R19) and not a cool-off (host-governor cools off on 429, 403 and 503): every later tick, the alarm's
       included, judges the row the same way, so its code stays the source's (K3065, B3) */
    if (new URL(request.url).host === "down.example.org") return new Response("unavailable", { status: 500 });
    if (new URL(request.url).host === "up.example.org")
      return new Response(new TextEncoder().encode(`%PDF-1.4 a document of its own at ${request.url}`), { headers: { "content-type": "application/pdf" } });
    return new Response(new Uint8Array(512).map((_, i) => i % 251), { headers: { "content-type": "application/pdf" } });
  },
});
after(async () => { await mf.dispose(); PLANE.dispose(); });

/* Coordinator ruling 5 Nov 17:24 (attempt 5): no running plane holds an AI catalogue that lists a plan, so `op=aiownadd`
   answers CATALOGUE_UNAVAILABLE and `world()` opens no run; every case below then fails on the plane, not on this module.
   That gap is store-assembly's and ai-catalogue's (found marks in BOB's PR bob/found-marks-1720; ai-catalogue F2 names
   these tests). Each case is a test.todo naming those marks, its text and body kept, until a plane holds such a catalogue.
   The requirements these cases measure are met in process by this module's other tests (door, drain, reads, retry,
   t47, t50 and member-only), but R30 (the ops' classes through the control plane), which only the plane measures. */
const AWAITS = " (todo: awaits store-assembly's and ai-catalogue's found marks, a plane catalogue listing a plan; ai-catalogue F2)";

const unwrap = (r) => (r && typeof r === "object" && "result" in r ? r.result : r);
/* admission R20 (T36-36, K2166; C-38.10): a credential is read only from the Authorization header or the body, never
   the address, so the helper sends it as `Authorization: Bearer …` (as membership's members.test.mjs, K2182) */
const call = async (op, tok, body, extra = {}) => {
  const headers = tok === undefined ? { ...extra } : { ...extra, authorization: `Bearer ${tok}` };
  const r = await mf.dispatchFetch(`http://x/api/?op=${op}`,
    body === undefined ? { headers } : { method: "POST", body: JSON.stringify(body), headers });
  return { status: r.status, body: unwrap(await r.json()) };
};
const forbidden = (r) => r.status === 403 && r.body && r.body.reason === "CLASS_FORBIDDEN";

/* K3065 (CAPTURE #30 J1 (b)): WHY "R48 in the plane" FAILED ABOUT ONE RUN IN FOUR UNDER A LOADED SUITE. Filing a request
   tells the scheduler (this module's R44, scheduler R9), whose reconcile arms the Durable Object's alarm AT ONCE while a
   request waits (its `capture-request-drain` consumer is due now whenever R37's `drainPending` is above 0). The alarm
   runs this same drain (actor `alarm`), so the test's `op=capturerequestdrain` raced it: with the alarm's tick out, the
   op answered `busy` (R11, not re-entrant); with the alarm's tick done, the op found the row already captured. Either
   way the op's answer did not list the request. Which tick drains a row is not what these tests measure, so each drives
   the op until the row it filed has been judged (bounded), and reads the outcome from the row (R23, R24) and the record,
   never from one tick's answer. */
const rowOf = async (tok, request) =>
  (await call("capturerequests&run=RUN-CR-1&limit=1000", tok)).body.requests.find((r) => r.request === request);
/* Judged: terminal, or held `requested` under a code. Never `draining`: that is a tick (the alarm's, or ours) still
   out with the fetch, and its outcome is not yet written (B3: R48 read `draining` once in five). */
async function drained(tok, request, judged = (r) => ["captured", "refused", "expired"].includes(r.state)
                                                     || (r.state === "requested" && !!r.code)) {
  for (let i = 0; i < 200; i++) {   /* at most ~10 s of rounds: a loaded run's fetch can stay out a while */
    await call("capturerequestdrain", "dmn-cr", {});
    const r = await rowOf(tok, request);
    if (r && judged(r)) return r;
    await new Promise((res) => setTimeout(res, 50));
  }
  assert.fail(`${request} was not judged by any drain: ${JSON.stringify(await rowOf(tok, request))}`);
}
/** The held row (capture R77, R83) a drained request's capture was promoted into, read by its digest. */
const heldOf = async (tok, sha256) =>
  ((await call("heldcaptures&limit=1000", tok)).body.held || []).find((r) => r.capture && r.capture.sha256 === sha256);

/* credentials R66, R71 (2): connecting Claude asks for the password again; the member's session re-authenticates
   (`op=reauth`, the session the control plane stamps) just before it, its window being 5 minutes */
const reauth = async (tok, id) => {
  const r = (await call("reauth", tok, { password: `${id}-passphrase-1` })).body;
  assert.equal(r && r.ok, true, JSON.stringify(r));
};
const MEMBER_UA = "Mozilla/5.0 (X11; Linux x86_64; rv:140.0) Gecko/20100101 Firefox/140.0";
let setup = null;
async function world() {
  if (setup) return setup;
  const enrol = async (id, role, capabilities) => {
    const add = (await call("memberadd", "adm-cr", { memberId: id, cover: `c-${id}`, role, capabilities })).body;
    await call("enroll", undefined, { invite: add.invite, handle: id, password: `${id}-passphrase-1` });
    /* credentials R67 (N1052): a member signs in by the handle they enrolled under */
    return (await call("login", undefined, { handle: id, password: `${id}-passphrase-1` })).body.token;
  };
  const RUTH = await enrol("ruth", "admin", ["contribute", "publish"]);
  await enrol("sam", "admin", ["contribute"]);
  /* admission R5 (T36-36, K2166; C-38.11): the shared member token `mem-cr` is retired, so the member class is tested
     through an enrolled member's own session, one with `contribute` and one without (as K2182 read membership's) */
  const MEMBER = await enrol("mel", "member", ["contribute"]);
  const NOCON = await enrol("nocon", "member", []);
  const md = (id) => ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", 'title: "What?"',
    "current_state: open", "prior_state: null", 'created: "2026-07-01T00:00:00Z"', 'last_updated: "2026-07-01T00:00:00Z"',
    "produced_by:", "  mode: agent", "  capability_tier: high", "group: g", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
    "surfaced_by: agent", 'disposition_reason: ""', "---", "", "## Question", "", "What?", "",
    word("conformance.rests"), "", "## Conclusion", "", word("conformance.falsify"), "", "## Session Log", "",
    "## Review Notes", ""].join("\n");
  const create = async (id, headers) => {
    const text = md(id);
    const p = (await call("promote", RUTH, { bundleId: id, base: null, snapKey: `${id}-000001`,
      files: [{ path: "bundle.md", text, bytes: text.length, sha256: sha(text) }], register: [],
      meta: { object_type: "inquiry", group: "g", current_state: "open", created: "2026-07-01T00:00:00Z",
              last_updated: "2026-07-01T00:00:00Z" } }, headers)).body;
    assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
  };
  await create("INQ-2026-9000-cr");
  /* N295: an inquiry created through a member's session, whose browser agent the control plane stamps (inquiry R44) */
  await create("INQ-2026-9001-ua", { "User-Agent": MEMBER_UA });
  /* N585 (K1614; ai-runs R52): a run carries the account of the member whose act opened it, so the opener connects
     their own account first, through the op the control plane routes (ai-accounts R1, which was credentials R22), the member named by the stamp */
  /* instance-setup R54, ai-accounts R23: the disclosure of what connecting means is shown and recorded first, at the
     version the plane answers (`op=disclosureof`), by her own session */
  const version = (await call("disclosureof", RUTH, { member: "member:ruth" })).body.version;
  const shown = (await call("disclosureshown", RUTH, { member: "member:ruth", version })).body;
  assert.deepEqual([shown.ok, shown.shown], [true, true], JSON.stringify(shown));
  await reauth(RUTH, "ruth");
  /* ai-accounts T53: her own account, connected by her own session (`aiownadd`; accountreferenceset is retired), on a
     member plan the catalogue lists (F1: the plane's catalogue is ai-accounts' test catalogue, plane-world.mjs) */
  const acct = (await call("aiownadd", RUTH, { provider: PLANS.provider, plan: PLANS.memberApi, means: "sealed", secret: "sk-ant-zz-cr-plane-0123456789" })).body;
  assert.equal(acct.ok, true, JSON.stringify(acct));
  /* ai-accounts R38, R51 (as store-assembly's plane-green): the account switched on, and its recipient's notice seen */
  const on = (await call("aiaccountswitch", RUTH, { account_id: acct.account_id, on: true })).body;
  assert.equal(on.ok, true, JSON.stringify(on));
  const seen = (await call("aisend", RUTH, { provider: PLANS.provider, host: HOSTS.main })).body;
  assert.equal(seen.ok, true, JSON.stringify(seen));
  /* ai-runs R9 (T53; notice ai-runs:96): the run names its paying principal `principalAi` and its member `principalAiRef` */
  const run = (await call("airunopen", RUTH, { run: "RUN-CR-1", contextType: "inquiry", contextId: "INQ-2026-9000-cr",
    label: "cr", mode: "check", principalAi: "member:ruth", principalAiRef: "ruth",
    skillVersion: "investigative-session@1", biasManifest: null, bounds: [{ bound: "fetches", allowed: 5, unit: "requests" }],
    leaseMs: 900000 })).body;
  assert.equal(run.started, true, JSON.stringify(run));
  /* R49 (T35): a member captures the index page, so every address it links to is one the record already holds */
  const idx = (await call("acquire", RUTH, { locator: "https://index.example.org/list.html", subresources: true })).body;
  assert.equal(idx.ok, true, JSON.stringify(idx).slice(0, 400));
  setup = { RUTH, MEMBER, NOCON };
  return setup;
}

test.todo("R30 capturerequest: admin, member with contribute and probe; capturerequestdrain: admin, probe and daemon, no member class; capturerequests: admin, member and probe; the daemon reaches no read of the queue; no op admits the ai class by name" + AWAITS, async () => {
  const { RUTH, MEMBER, NOCON } = await world();
  /* the ai credential is minted here, not in `world()`, and its mint is asserted, so an arm below never runs with no
     credential at all and passes for the wrong reason (the mint waits on credentials' T37-33, plan rule 4) */
  const minted = (await call("aicredentialmint", RUTH, { tokenId: "no-writes", principalKind: "member", principalMember: "ruth",
    taskScope: "investigative", writes: [], note: "reads only" })).body;
  const AI = minted && minted.token;
  assert.equal(typeof AI, "string", JSON.stringify(minted).slice(0, 300));
  const ask = { run: "RUN-CR-1", address: "https://src.example.org/a.pdf", target: "INQ-2026-9000-cr", purpose: "investigate" };
  /* capturerequest */
  for (const tok of ["adm-cr", MEMBER, "prb-cr", RUTH]) assert.equal(forbidden(await call("capturerequest", tok, ask)), false, tok);
  assert.equal(forbidden(await call("capturerequest", "dmn-cr", ask)), true, "daemon");
  const nocon = await call("capturerequest", NOCON, ask);
  assert.equal(nocon.status, 403, "a member session without contribute");
  /* capturerequestdrain */
  for (const tok of ["adm-cr", "prb-cr", "dmn-cr"]) assert.equal(forbidden(await call("capturerequestdrain", tok, {})), false, tok);
  /* the member class reaches the drain only through a member's session now (admission R5), and a session is refused
     the unattended path before its class is weighed (C-38.3): refused, nothing drained, for either role */
  for (const [tok, who] of [[MEMBER, "the member class"], [RUTH, "a member's session"]]) {
    const r = await call("capturerequestdrain", tok, {});
    assert.deepEqual([r.status, r.body.reason, "configured" in r.body, "drained" in r.body],
      [403, "MACHINE_CREDENTIAL_REQUIRED", false, false], who);
  }
  /* capturerequests */
  for (const tok of ["adm-cr", MEMBER, "prb-cr", RUTH]) assert.equal(forbidden(await call("capturerequests", tok)), false, tok);
  assert.equal(forbidden(await call("capturerequests", "dmn-cr")), true, "the daemon reaches no read of the queue");
  /* an ai credential reaches an op only through the writes its record declares (D-199), never as a class the OPS row
     names: one that declares no writes reaches neither mutating op */
  for (const op of ["capturerequest", "capturerequestdrain"])
    assert.equal((await call(op, AI, ask)).status, 403, `ai ${op}`);
});

test.todo("R16 R31 R14 the spine in the plane: the member's run requests (as civicsmith by default) and nothing is fetched; op=acquire refuses the capture-request arm from every caller; only the daemon's drain fetches, with the Civicsmith agent, and the capture lands" + AWAITS, async () => {
  const { RUTH } = await world();
  const a = (await call("capturerequest", RUTH, { run: "RUN-CR-1", address: "https://spine.example.org/spine.pdf",
                                                target: "INQ-2026-9000-cr", purpose: "investigate" })).body;
  assert.equal(a.ok, true, JSON.stringify(a));
  /* the door's fetching nothing is R9's test (door.test.mjs): here the alarm's drain may already be out (K3065) */
  for (const tok of ["adm-cr", "prb-cr", "dmn-cr", RUTH]) {
    const r = await call("acquire", tok, { via: "capture-request", request: a.request, locator: "https://spine.example.org/spine.pdf" });
    assert.equal(r.body.code ?? r.body.reason, r.status === 403 && r.body.reason === "CLASS_FORBIDDEN" ? "CLASS_FORBIDDEN" : "CAPTURE_NOT_DRAINING", tok);
  }
  const d = (await call("capturerequestdrain", "dmn-cr", {})).body;
  assert.equal(d.configured, true);
  const row = await drained(RUTH, a.request);
  assert.equal(row.state, "captured", JSON.stringify(row));
  assert.equal(row.attribution.actor, "token:daemon");
  assert.equal(SEEN.filter((u) => u.startsWith("https://spine.example.org/")).length, 1,
    "fetched once, by a drain: no op=acquire made the plane fetch it");
  assert.equal(a.ua_mode, "civicsmith");
  assert.equal(AGENTS.get("https://spine.example.org/spine.pdf"), civicsmithUserAgent("1.0.0", "cr-plane", "investigate"),
    "the agent that left the instance is acquisition's Civicsmith agent");
});

test.todo("R19 R42 R38 in the plane: a source's 500 holds the row under CAPTURE_FETCH_FAILED (C-28.17), read back through op=capturerequests; op=capturerequestretry refuses it CAPTURE_REQUEST_NOT_RETRYABLE (C-28.18) and writes nothing; a new capture drained is promoted" + AWAITS, async () => {
  const { RUTH } = await world();
  const ask = (address) => call("capturerequest", RUTH, { run: "RUN-CR-1", address, target: "INQ-2026-9000-cr", purpose: "investigate" });
  const down = (await ask("https://down.example.org/gone.pdf")).body;
  const up = (await ask("https://up.example.org/doc.pdf")).body;
  assert.equal(down && down.ok, true, String(JSON.stringify(down)));
  const row = await drained(RUTH, down.request);
  assert.deepEqual([row.state, row.code, row.source_reason], ["requested", "CAPTURE_FETCH_FAILED", "other"]);
  assert.equal(CAPTURE_FETCH_FAILED_CHECK, "C-28.17");
  const r = (await call("capturerequestretry", RUTH, { request: down.request })).body;
  assert.deepEqual([r.ok, r.code, r.check], [false, "CAPTURE_REQUEST_NOT_RETRYABLE", "C-28.18"], JSON.stringify(r));
  /* what a retry writes (R42: `state` back to requested, `expires` now + 24 h), compared, and nothing else: a later alarm
     tick may judge the held row again, and judge it again, so only what a retry would write is
     this assertion's (K3065). Read once no tick is out with it (never `draining`), driving no drain. */
  let again = await rowOf(RUTH, down.request);
  for (let i = 0; i < 200 && again.state === "draining"; i++) {
    await new Promise((res) => setTimeout(res, 50));
    again = await rowOf(RUTH, down.request);
  }
  const wrote = (x) => [x.state, x.expires];
  assert.deepEqual(wrote(again), wrote(row), "nothing written");
  const upRow = await drained(RUTH, up.request);
  assert.equal(upRow.state, "captured", JSON.stringify(upRow));
  const promoted = await heldOf(RUTH, upRow.capture_sha);
  assert.ok(promoted, "the new capture was promoted");
  assert.match(promoted.bundle_id, /^INFO-\d{4}-\d{4}-requested$/);
});

test.todo("R14 in the plane (N295): a member-browser request under an inquiry created through a member's session is fetched with the agent the control plane stamped and inquiry records (its R44), not refused CAPTURE_CONDUCT_UA_UNRECORDED" + AWAITS, async () => {
  const { RUTH } = await world();
  const address = "https://up.example.org/member-browser.pdf";
  const a = (await call("capturerequest", RUTH, { run: "RUN-CR-1", address, target: "INQ-2026-9001-ua",
                                                purpose: "investigate", ua_mode: "member-browser" })).body;
  assert.equal(a.ok, true, JSON.stringify(a));
  const row = await drained(RUTH, a.request);
  assert.deepEqual([row.state, row.code], ["captured", null], JSON.stringify(row));
  assert.equal(AGENTS.get(address), MEMBER_UA, "the member's own agent left the instance, verbatim");
});

test.todo("R48 in the plane: a requested capture, drained and promoted, is listed by capture's op=heldcaptures with the question it was captured for and its asker, read through the reader this module registered (capture R77, R83)" + AWAITS, async () => {
  const { RUTH } = await world();
  const address = "https://up.example.org/held-for.pdf";
  const a = (await call("capturerequest", RUTH, { run: "RUN-CR-1", address, target: "INQ-2026-9000-cr", purpose: "investigate" })).body;
  assert.equal(a.ok, true, JSON.stringify(a));
  const req = await drained(RUTH, a.request);
  assert.equal(req.state, "captured", JSON.stringify(req));
  const row = await heldOf(RUTH, req.capture_sha);
  assert.ok(row, `no held row for ${req.capture_sha}`);
  assert.match(row.bundle_id, /^INFO-\d{4}-\d{4}-requested$/, "the drained capture, promoted");
  assert.equal(row.captured_for && row.captured_for.withheld, null, JSON.stringify(row));
  assert.deepEqual(row.captured_for.questions.map((q) => [q.question, q.title]), [["INQ-2026-9000-cr", "What?"]]);
  assert.ok(typeof row.captured_for.questions[0].asker === "string" && row.captured_for.questions[0].asker.length > 0);
});

/** A capture a member acquired, held: promoted at `collected` as an information bundle the register files it under, as the
 *  drain's own promotion does (R38), so capture's op=heldcaptures lists it. */
async function holdAcquired(tok, locator, over = {}) {
  const got = (await call("acquire", tok, { locator, ...over })).body;
  assert.equal(got.ok, true, JSON.stringify(got).slice(0, 400));
  const doc = got.document, cap = doc.capture;
  const id = `INFO-2026-${String(Math.floor(Math.random() * 9000) + 1000)}-acq`;
  const md = ["---", `id: ${id}`, "object_type: information", "schema: information@2", 'title: "Acquired"',
    "current_state: collected", "prior_state: null", 'created: "2026-07-01T00:00:00Z"', 'last_updated: "2026-07-01T00:00:00Z"',
    "produced_by:", "  mode: agent", "  capability_tier: session", "group: g", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
    "criticality: supporting", "source_status: unchanged", "source:", `  locator: ${JSON.stringify(locator)}`,
    "  retrieved: 2026-07-01T00:00:00Z", "monitoring:", "  enabled: false", "  frequency: none", "---", "", "## Summary", "", "x", ""].join("\n");
  const p = (await call("promote", tok, { bundleId: id, base: null, snapKey: `${id}-000001`,
    files: [{ path: "bundle.md", text: md, bytes: md.length, sha256: sha(md) },
            { path: doc.file, blobSha: cap.sha256, sha256: cap.sha256, bytes: cap.bytes }],
    register: [{ sha256: cap.sha256, path: doc.file, encoding: "binary", bytes: cap.bytes }],
    meta: { object_type: "information", group: "g", title: "Acquired", current_state: "collected",
            created: "2026-07-01T00:00:00Z", last_updated: "2026-07-01T00:00:00Z", criticality: "supporting" } })).body;
  assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
  return cap.sha256;
}

test.todo("R48 in the plane (T50): a capture a member made with acquire's `for` and no request is listed by op=heldcaptures with the question and its asker, read through this module's reader and capture's asks (capture R83, R94); a `for` naming no question is refused BAD_FOR (control-plane R105, acquisition R47) before any fetch, and nothing is held for it; a capture with no `for` answers questions: []" + AWAITS, async () => {
  const { RUTH } = await world();
  const row = await heldOf(RUTH, await holdAcquired(RUTH, "https://up.example.org/for-ask.pdf", { for: "INQ-2026-9000-cr" }));
  assert.ok(row, "no held row for the acquired capture");
  assert.equal(row.captured_for && row.captured_for.withheld, null, JSON.stringify(row.captured_for));
  assert.deepEqual(row.captured_for.questions.map((q) => [q.question, q.title, q.asker]), [["INQ-2026-9000-cr", "What?", "ruth"]]);
  /* R105 (T50; acquisition R47): a member's `for` must name a question she may see, so a question no inquiry answers to
     never reaches the record through acquire: refused before any fetch, nothing filed. The reader's withheld answer for a
     question not held is asserted at unit level (t50.test.mjs, R48: a question not held). */
  const ghost = "https://up.example.org/for-ghost.pdf";
  const refused = (await call("acquire", RUTH, { locator: ghost, for: "INQ-2026-9999-none" })).body;
  assert.deepEqual([refused.ok, refused.code, refused.check], [false, "BAD_FOR", "C-139.21"], JSON.stringify(refused));
  assert.equal(SEEN.filter((u) => u === ghost).length, 0, "no fetch was made for the refused `for`");
  /* Control: no `for`, no request */
  const n = await heldOf(RUTH, await holdAcquired(RUTH, "https://up.example.org/for-none.pdf"));
  assert.deepEqual(n.captured_for, { questions: [], withheld: null });
});

test.todo("R56 in the plane: a member's session asks for an address with no run (\"Ask for this later\"); the request is hers, drained by the daemon as any is; the same ask through an ai credential is refused CAPTURE_REQUEST_NO_RUN" + AWAITS, async () => {
  const { RUTH } = await world();
  const address = "https://up.example.org/later.pdf";
  const a = (await call("capturerequest", RUTH, { address })).body;
  assert.equal(a.ok, true, JSON.stringify(a));
  assert.deepEqual([a.run, a.target, a.purpose, a.drains, a.principals], [null, null, "acquire", true,
                   { plane: "member:ruth", claude: null }]);
  let row = null;
  for (let i = 0; i < 200 && !(row && row.state === "captured"); i++) {
    await call("capturerequestdrain", "dmn-cr", {});
    row = (await call("capturerequests&limit=1000", RUTH)).body.requests.find((r) => r.request === a.request);
    await new Promise((res) => setTimeout(res, 50));
  }
  assert.equal(row && row.state, "captured", JSON.stringify(row));
  assert.equal(row.attribution.statement, "the daemon captured this, at the request of member:ruth");
  assert.equal(SEEN.filter((u) => u === address).length, 1);
  /* Control: an ai credential the member minted is not her own act */
  const minted = (await call("aicredentialmint", RUTH, { tokenId: "later-ai", principalKind: "member", principalMember: "ruth",
    taskScope: "investigative", writes: ["capturerequest"], note: "R56 control" })).body;
  assert.equal(typeof (minted && minted.token), "string", JSON.stringify(minted).slice(0, 300));
  const x = (await call("capturerequest", minted.token, { address: "https://up.example.org/later-ai.pdf" })).body;
  assert.deepEqual([x.ok, x.code, x.check], [false, "CAPTURE_REQUEST_NO_RUN", "C-28.1"], JSON.stringify(x).slice(0, 300));
  /* Control: another member does not see her request with no target (R23 as R56 amends it) */
  const { MEMBER } = await world();
  const other = (await call("capturerequests&limit=1000", MEMBER)).body.requests || [];
  assert.equal(other.some((r) => r.request === a.request), false);
});

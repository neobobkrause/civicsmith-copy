/* R139, R140, R74: the routing (`routing.mjs`: `publicOp`, `gatedOp`) at this module, through `makeFetch` handed the real routing (`real-door.mjs`) over store-request's world: which owner's
   handler answers each op, with the stamps it hands. Nothing here re-makes the routing (K4990): the hooks are the real ones, and where a test sets what the door decides (whether an
   acquire's reading is deferred) it hands that one value into the real `gatedOp` and nothing else. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { realDoor } from "./real-door.mjs";
import { publicOp, gatedOp } from "../../../src/control-plane/routing.mjs";

/* One world for the file: a member `ann`, the founder `admin`, and an `ai` credential the founder minted (principal `member:admin`, no writes). `defer`, when set, is the door's
   `deferReading` verdict handed into the real `gatedOp`; the world's network serves a small page at any address on `*.example.gov`, and nothing else. */
let defer = null;
/* the instance's governor set to pace no host (as the seam kit sets it), so the attestation's calls after an acquire add no waits to the run */
const d = await realDoor({ env: { GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" },
                          hooks: (real) => ({ publicOp: real.publicOp, gatedOp: (ctx) => real.gatedOp(defer ? { ...ctx, deferReading: defer } : ctx) }) });
d.world.script((req) => new URL(req.url).hostname.endsWith(".example.gov"), (req) => new Response(`<html><head><title>T</title></head><body><p>The count at ${new URL(req.url).pathname} was 412.</p></body></html>`,
  { headers: { "content-type": "text/html" } }));
const ann = await d.world.signIn("ann");
const admin = await d.world.signIn("admin");
const minted = await admin.act("aicredentialmint", { body: { tokenId: "routing-reader", principalKind: "member", writes: [] } });
const AS = { ann: { authorization: `Bearer ${ann.token}` }, ai: { authorization: `Bearer ${minted.token}` }, adminToken: { authorization: `Bearer ${d.env.ADMIN_TOKEN}` } };
const SHA = "a".repeat(64);
const FORGED = "member:forged";

async function ask(path, { as = null, method = "GET", body } = {}) {
  d.sent.length = 0;
  const res = await d.plane(path, { method, headers: { ...(as || {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
                                    ...(body === undefined ? {} : { body: typeof body === "string" ? body : JSON.stringify(body) }) });
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch { json = null; }
  return { status: res.status, json, timing: res.headers.get("server-timing") || "", sent: d.sent.map((s) => s.url) };
}
const routeOf = (r, name) => r.sent.filter((u) => u.pathname === `/${name}`);

/* ---------------------------------------------------------------- R140 */

test("R140: `op=knock` with no token is answered by doorbell's public op: the knock is taken (200) and reaches only the doorbell's own store routes", async () => {
  const r = await ask("/api/?op=knock", { method: "POST", body: { contentText: "a file for the team" } });
  assert.equal(r.status, 200, JSON.stringify(r.json));
  assert.equal(r.json.ok, true);
  assert.match(r.json.knockId, /^KNOCK-/);
  assert.deepEqual(r.sent.map((u) => u.pathname), ["/doorwindow", "/knock"], "the doorbell's window and its knock, nothing of capture's");
});

test("R140: a GET of `op=knock` is answered 405 by doorbell's public op, and an empty knock is refused KNOCK_EMPTY (C-85.5) with nothing filed", async () => {
  const get = await ask("/api/?op=knock");
  assert.equal(get.status, 405);
  assert.equal(get.json.ok, false);
  assert.equal(routeOf(get, "knock").length, 0, "a GET files nothing");
  const empty = await ask("/api/?op=knock", { method: "POST", body: { contentText: "" } });
  assert.equal(empty.status, 400);
  assert.equal(empty.json.reason, "KNOCK_EMPTY");
  assert.equal(empty.json.check, "C-85.5");
  assert.equal(routeOf(empty, "knock").length, 0, "an empty knock files nothing");
  /* control: a knock that names no content at all is doorbell's required-argument refusal, not KNOCK_EMPTY */
  const none = await ask("/api/?op=knock", { method: "POST", body: {} });
  assert.equal(none.status, 400);
  assert.equal(none.json.reason, "REQUIRED_ARGUMENT_MISSING");
});

/* ---------------------------------------------------------------- R74 */

test("R74, R29: `op=pagetranscribe` from a member's session reaches extraction's handler with the session's stamps, `sha256` and `project` from the address, and the door's trace and member ref; stamps the caller sends are deleted; the owner's answer is relayed as given", async () => {
  const r = await ask(`/api/?op=pagetranscribe&sha256=${SHA}&project=P-1&author=${FORGED}&viewer=${FORGED}&by=${FORGED}&cls=admin`,
                      { as: AS.ann, method: "POST", body: { author: FORGED, viewer: FORGED, by: FORGED, account: "key", grant: "g", page: 1 } });
  const [sent] = routeOf(r, "pagetranscribe");
  assert.ok(sent, "the store's pagetranscribe route is asked: " + JSON.stringify(r.sent.map((u) => u.pathname)));
  const q = Object.fromEntries(sent.searchParams);
  assert.equal(q.sha256, SHA);
  assert.equal(q.project, "P-1");
  assert.equal(q.cls, "member");
  assert.equal(q.session, "1");
  assert.equal(q.viewer, "member:ann");
  assert.equal(q.author, "ann");
  assert.equal(q.store, "bio");
  assert.match(q.trace, /^[0-9a-f-]{36}$/, "the door's trace (R93)");
  assert.ok(q.memberRef && q.memberRef !== "ann", "the door's member ref, never the handle (R93)");
  /* it passes no account, key, grant or page to the owner: the request names only these */
  assert.deepEqual(Object.keys(q).sort(), ["author", "caps", "cls", "memberRef", "project", "session", "sha256", "store", "trace", "viewer"]);
  /* every refusal and answer is extraction's: here, the transcriber that has not passed its bar */
  assert.equal(r.status, 501);
  assert.equal(r.json.reason, "TRANSCRIBE_NOT_DEPLOYED");
  assert.equal(r.json.sha256, SHA);
});

test("R74: `op=pagetranscribe` is refused to every caller not arriving by a member's session, with nothing asked of extraction's route", async () => {
  const binding = await ask(`/api/?op=pagetranscribe&sha256=${SHA}`, { as: AS.adminToken, method: "POST", body: {} });
  assert.equal(binding.status, 403);
  assert.equal(binding.json.reason, "CLASS_FORBIDDEN");
  const ai = await ask(`/api/?op=pagetranscribe&sha256=${SHA}`, { as: AS.ai, method: "POST", body: {} });
  assert.equal(ai.status, 403);
  assert.equal(ai.json.reason, "AI_BEYOND_TASK_SCOPE");
  const nobody = await ask(`/api/?op=pagetranscribe&sha256=${SHA}`, { method: "POST", body: {} });
  assert.equal(nobody.status, 401);
  assert.equal(nobody.json.reason, "NOT_AUTHENTICATED");
  for (const r of [binding, ai, nobody]) assert.equal(routeOf(r, "pagetranscribe").length, 0, "nothing reaches the owner");
  /* control: a member's request with a malformed digest is extraction's own refusal, named by its argument */
  const bad = await ask("/api/?op=pagetranscribe&sha256=nothex", { as: AS.ann, method: "POST", body: {} });
  assert.equal(bad.status, 400);
  assert.equal(bad.json.reason, "REQUIRED_ARGUMENT_MISSING");
  assert.equal(bad.json.argument, "sha256");
  assert.equal(routeOf(bad, "pagetranscribe").length, 0);
});

/* ---------------------------------------------------------------- R139 */

test("R139: an `ai` caller's stamps on a gated op are its principal as viewer and `class:ai/<tokenId>` as author, never `class:ai` alone; a member's session gives her member and viewer", async () => {
  const ai = await ask(`/api/?op=pdfstructure&sha256=${SHA}&author=${FORGED}&viewer=${FORGED}`, { as: AS.ai });
  const [aiSent] = routeOf(ai, "pdfstructure");
  assert.ok(aiSent, "extraction's route is asked for the ai caller");
  assert.equal(aiSent.searchParams.get("cls"), "ai");
  assert.equal(aiSent.searchParams.get("session"), "0");
  assert.equal(aiSent.searchParams.get("viewer"), "member:admin");
  assert.equal(aiSent.searchParams.get("author"), "class:ai/routing-reader");
  assert.equal(ai.json.tokenClass, "ai");
  /* control: the same op by a member's session is stamped with her own member, the forged stamps deleted */
  const member = await ask(`/api/?op=pdfstructure&sha256=${SHA}&author=${FORGED}&viewer=${FORGED}`, { as: AS.ann });
  const [memberSent] = routeOf(member, "pdfstructure");
  assert.equal(memberSent.searchParams.get("author"), "ann");
  assert.equal(memberSent.searchParams.get("viewer"), "member:ann");
  assert.equal(memberSent.searchParams.get("cls"), "member");
  /* the owner's answer is relayed as given: no copy is held under this digest */
  assert.equal(member.status, 404);
  assert.equal(member.json.reason, "EVIDENCE_NOT_HELD");
});

test("R139: an acquire the door does not defer is read in the request; one it defers is answered `reading_pending: true` with no reading; a deferral that rejects defers nothing", async () => {
  /* each from its own host, so the host governor's pacing of one host never enters the test's time */
  const acquire = (name) => ask("/api/?op=acquire", { as: AS.ann, method: "POST", body: { locator: `https://${name}.example.gov/page.html` } });
  try {
    defer = null;
    const read = await acquire("undeferred");
    assert.equal(read.status, 200, JSON.stringify(read.json).slice(0, 300));
    assert.equal(read.json.existed, false);
    assert.ok(read.json.document.reading, "the reading is in the answer");
    assert.notEqual(read.json.reading_pending, true);
    assert.equal(routeOf(read, "extractread").length, 1, "the read step ran");

    const asked = [];
    defer = async (document) => { asked.push(document && document.locator); return true; };
    const deferred = await acquire("deferred");
    assert.equal(deferred.status, 200, JSON.stringify(deferred.json).slice(0, 300));
    assert.deepEqual(asked, ["https://deferred.example.gov/page.html"], "the door's verdict is asked of the document just filed");
    assert.equal(deferred.json.reading_pending, true);
    assert.equal(deferred.json.document.reading, undefined, "no reading");
    assert.equal(routeOf(deferred, "extractread").length, 0, "the read step was skipped");

    defer = async () => { throw new Error("the verdict failed"); };
    const rejected = await acquire("rejected");
    assert.ok(rejected.json.document.reading, "a rejected verdict defers nothing: the reading is in the answer");
    assert.equal(routeOf(rejected, "extractread").length, 1);

    /* control: a verdict that is not exactly `true` defers nothing */
    defer = async () => "yes";
    const truthy = await acquire("truthy");
    assert.ok(truthy.json.document.reading);
  } finally { defer = null; }
});

test("R139: the door's `stateTiming` reaches the handler's context: the bootstrap report states `fleet` and `facts` in the answer's Server-Timing; with none given the handler answers alike", async () => {
  const r = await ask("/api/?op=bootstrap");
  assert.equal(r.status, 200);
  assert.equal(r.json.service, "bio-plane");
  assert.match(r.timing, /(^|, )fleet;dur=\d+/);
  assert.match(r.timing, /(^|, )facts;dur=\d+/);
  /* the same handler through the real `publicOp` with a recording sink, and with none: the sink is told, and its absence changes nothing the handler answers */
  const ctx = (stateTiming) => ({ req: new Request("https://group.example/api/?op=bootstrap"), url: new URL("https://group.example/api/?op=bootstrap"), env: d.env,
    op: "bootstrap", stub: d.env.STORE.get(), fp: null, presentedAi: { cred: null }, credential: null, country: null, stateTiming });
  const told = [];
  const withSink = await publicOp(ctx((name, ms) => told.push([name, ms])));
  const without = await publicOp(ctx(null));
  assert.ok(told.some(([n]) => n === "fleet") && told.some(([n]) => n === "facts"), JSON.stringify(told));
  assert.equal(withSink.status, without.status);
  assert.deepEqual(Object.keys(await withSink.json()).sort(), Object.keys(await without.json()).sort());
});

test("R139: an op whose owner has no arm in the routing is left to the door's generic forward (`gatedOp` answers nothing), and an op with an arm is answered by its owner", async () => {
  /* `whoami` has no arm: the real `gatedOp` answers nothing (null) and the door answers it itself */
  const none = await gatedOp({ req: new Request("https://group.example/api/?op=whoami"), url: new URL("https://group.example/api/?op=whoami"), env: d.env, op: "whoami",
    cls: "member", viaSession: true, sessMember: "ann", sessViewer: "member:ann", sessIdentity: "member:ann", sessRights: {}, sessCaps: new Set(), aiCred: null,
    storeName: "bio", stub: d.env.STORE.get(), grantMember: null });
  assert.equal(none, null, "no arm answers: the door's own forward follows");
  const who = await ask("/api/?op=whoami", { as: AS.ann });
  assert.equal(who.status, 200);
  assert.equal(who.json.result?.member ?? who.json.member, "ann");
  /* control: `queue` has an arm (queue's own door), stamped with the session's viewer and member */
  const queue = await ask("/api/?op=queue", { as: AS.ann });
  assert.equal(queue.status, 200);
  const [sent] = routeOf(queue, "queue");
  assert.equal(sent.searchParams.get("viewer"), "member:ann");
  assert.equal(sent.searchParams.get("member"), "ann");
});

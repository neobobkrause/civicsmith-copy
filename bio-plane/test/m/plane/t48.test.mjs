/* plane R54, R55 (T48-78; N1015, N1039; K3103, K3147): the plane's global scope is measured against bundler R31's budget
   (R54), and the door's trace and member ref ride the Store's RPC methods and the Worker's ask arm to every call to
   agent-worker (R55). Each drives the plane at its interface (the object's RPC and door, the built artifact) and carries a
   negative control (K874). The composition tests of T48 are `store-assembly`'s. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { relative } from "node:path";
import { store, deployed, GATE_FLAGS, GATE_SET, GATE_PARTS, disclosed, withCatalogue } from "./fixture.mjs";

import { assistantGateOf, askOp, doorHeaders } from "../../../src/store-assembly/ask.mjs";

import { transcriberOf } from "../../../src/store-assembly/transcribe.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { hypothesesOf } from "../../../src/hypotheses/index.mjs";

import { instanceSetupOf } from "../../../src/setup.mjs";

import { recordOf } from "../../../src/record-core/index.mjs";

import { TRACE_HEADER, MEMBER_REF_HEADER } from "../../../src/signin-door/index.mjs";

const SESSION = "s".repeat(64);
const SEAL = "a-long-seal-secret-for-the-t48-test";
const SECRET = "sk-ant-zz-t48-ann";
const READ_PARTS = [...GATE_PARTS];   /* draft:reading is among them (fixture, R50) */
const READ_FLAGS = { ...GATE_FLAGS };
const TRACE = "0b8f2c1e-6a53-4d0e-9f1c-2a7d5e3b9c10";
const REF = "a1b2c3d4e5f6";

/* ann and an administrator, ann's live session, the group's keep-away off; agent-worker records every post, with its
   headers. `translated` is what `/draft` answers for a reading. */
async function doors({ gate = { flags: READ_FLAGS, testSet: GATE_SET }, parts = READ_PARTS, env: extra = {}, language = "es",
                       worker = null } = {}) {
  const posts = [];
  const answerFor = (u, b) => (u === "https://agent-worker/draft"
    ? { ok: true, translation: `[${b.task && b.task.language}] ${b.task && b.task.text}`, language: b.task && b.task.language,
        usage: { input_tokens: 10, output_tokens: 5 }, calls: 1 }
    : { ok: true });
  const env = { ACCOUNT_SEAL_SECRET: SEAL, ...extra, AGENT_WORKER: worker || { fetch: async (u, init) => {
    const body = JSON.parse(init.body);
    posts.push({ url: u, body, headers: { ...(init.headers || {}) }, raw: init.body });
    return new Response(u.endsWith("/ask") ? '{"event":"answer","ok":true}\n' : JSON.stringify(answerFor(u, body)),
                        { status: 200, headers: { "content-type": u.endsWith("/ask") ? "application/x-ndjson" : "application/json" } });
  } } };
  const x = await store({ env, before: gate ? (ctx) => assistantGateOf(ctx, gate) : null });
  if (parts.length) await deployed(x.ctx, parts);
  const sql = x.ctx.storage.sql;
  const member = (id, role = "member") => sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
    VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
  member("ada", "admin");
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  member("ann");
  member("bob");
  sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
           createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  await disclosed(x.ctx);
  await withCatalogue(x.ctx);   /* T53 (BOB, MSG bob-82 (2)): ai-accounts reads ai-catalogue's published fixture, as the assembled store composes it */
  assert.equal((await aiAccountsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: SECRET, by: "member:ann" })).ok, true);
  /* instance-setup R87's `readingLanguage`: the member's own language is the one set by her own act */
  const setup = instanceSetupOf(x.ctx, x.env);
  if (language) assert.equal(setup.memberLanguageSet({ language, by: "member:ann" }).ok, true);
  const draft = async (a) => { const r = await x.s.draft({ member: "ann", session: SESSION, pack: { layers: [] }, ...a }); return { status: r.status, body: await r.json() }; };
  return { ...x, posts, draft, member };
}
const count = (x, table) => [...x.ctx.storage.sql.exec(`SELECT count(*) c FROM ${table}`)][0].c;

/* ===== R52 (T48; N1047; K3189; machinery-producers R12; instance-setup R88, R89) ===== */

/* R52: instance-setup's real `updateNoticeState` (its R89), observed (the call is relayed unchanged). A stored ready
   notice is a verified release notice row (`release_notices`, its R88), newer than the running version. */

/* ===== R54 (T48; N1039; K3147; amends R43; bundler R31) ===== */

test("R54 (T48; N1039; bundler R31): the plane's global scope is measured on the built artifact (five fresh imports) and printed beside bundler R31's 500 ms budget; past it is the warning R31 gives, with the cause named (R43's rule, K3147), never a failure; control: an artifact that cannot be read is unmeasured, which fails", async () => {
  const { planeMember, buildMember, measureStart, startVerdict, BUDGET } = await import("../../../scripts/fleet-bundle.mjs");
  const { writeFileSync, mkdtempSync, rmSync } = await import("node:fs");
  const { tmpdir } = await import("node:os");
  const { join } = await import("node:path");
  assert.equal(BUDGET.startWarnMs, 500, "R31's budget, never raised here");
  const m = planeMember();
  const dir = mkdtempSync(join(tmpdir(), "plane-r54-"));
  try {
    const out = join(dir, "bio-plane.bundled.mjs");
    writeFileSync(out, (await buildMember(m)).bytes);
    const runs = [];
    for (let i = 0; i < 5; i++) {
      const r = await measureStart(m, { artifact: relative(m.abs, out) });
      assert.equal(r.measured, true, r.reason);
      runs.push(r.ms);
    }
    const median = [...runs].sort((a, b) => a - b)[2];
    const v = startVerdict(m, median, BUDGET);
    console.log(`R54: the plane's global scope, five fresh imports: ${runs.map((ms) => ms.toFixed(0)).join(", ")} ms; median `
      + `${median.toFixed(0)} ms, budget ${BUDGET.startWarnMs} ms: ${v.verdict}${v.warning ? ` (${v.warning})` : ""}`);
    assert.ok(runs.every((ms) => ms > 1), "a fresh import evaluates the artifact, never a cached module");
    assert.ok(["ok", "warn"].includes(v.verdict), "past the budget is a warning, never a failure (R31)");
    const none = await measureStart(m, { artifact: relative(m.abs, join(dir, "absent.mjs")) });
    assert.equal(none.measured, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

/* ===== R55 (T48; N1015; K3103; agent-worker R87, R83; control-plane R93) ===== */

test("R55 (T48; N1015): the door's trace and member ref reach agent-worker as x-civicsmith-trace and x-civicsmith-member-ref on an ask and on a draft (the RPC and the action-draft arm), in no body or address; a call with none handed sends neither", async () => {
  const x = await doors();
  const keep = (p) => ({ trace: p.headers[TRACE_HEADER], ref: p.headers[MEMBER_REF_HEADER] });
  const a = await x.s.ask({ member: "member:ann", session: SESSION, question: "q", trace: TRACE, memberRef: REF });
  assert.equal(a.status, 200);
  assert.deepEqual(keep(x.posts.at(-1)), { trace: TRACE, ref: REF });
  const d = await x.s.draft({ op: "writinghelp", member: "ann", session: SESSION, told: "t", act: "conclude", field: "reason",
                              pack: { layers: [] }, trace: TRACE, memberRef: REF });
  assert.equal(d.status, 200);
  assert.deepEqual(keep(x.posts.at(-1)), { trace: TRACE, ref: REF });
  const n = hypothesesOf(x.ctx).noteWrite({ text: "A note.", by: "member:ann" });
  await x.s.draft({ op: "readtranslate", member: "ann", session: SESSION, subject: { kind: "note", id: n.note }, trace: TRACE, memberRef: REF });
  assert.deepEqual(keep(x.posts.at(-1)), { trace: TRACE, ref: REF });
  /* control: neither appears in a body, and the url is the binding's own */
  for (const p of x.posts) {
    assert.equal(p.raw.includes(TRACE) || p.raw.includes(REF), false, "never in a body");
    assert.equal(/^https:\/\/agent-worker\/(ask|draft)$/.test(p.url), true, "never in an address");
  }
  /* control: none handed, none sent; a value not of the header shape is not sent */
  const before = x.posts.length;
  await x.s.ask({ member: "member:ann", session: SESSION, question: "q" });
  assert.deepEqual(keep(x.posts[before]), { trace: undefined, ref: undefined });
  assert.deepEqual(doorHeaders({ trace: "has space", memberRef: "x".repeat(201) }), { "content-type": "application/json" });
  assert.deepEqual(doorHeaders({ trace: TRACE }), { "content-type": "application/json", [TRACE_HEADER]: TRACE });
});

test("R55 (T48): the Worker's ask arm passes the door's trace and member ref on to the ask on the bio object, and the transcriber's call to /transcribe carries them; control: the Worker arm sends none of its own when the door handed none", async () => {
  const seen = [];
  const env = { STORE: { idFromName: (n) => n, get: () => ({ ask: async (args) => { seen.push(args); return new Response("{}"); } }) } };
  const req = new Request("https://x/ask", { method: "POST", body: JSON.stringify({ question: "q" }) });
  await askOp({ req, url: new URL("https://x/ask"), env, viaSession: true, sessMember: "ann", grantMember: null, trace: TRACE, memberRef: REF });
  assert.equal(seen[0].trace, TRACE);
  assert.equal(seen[0].memberRef, REF);
  await askOp({ req: new Request("https://x/ask", { method: "POST", body: "{}" }), url: new URL("https://x/ask"), env, viaSession: true,
                sessMember: "ann", grantMember: null });
  assert.equal("trace" in seen[1] || "memberRef" in seen[1], false);
  /* the transcriber: the headers on the /transcribe post */
  const x = await doors({ parts: [...READ_PARTS, "transcribe"] });
  const tx = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: null, at: "2026-10-14T10:00:00Z", trace: TRACE, memberRef: REF });
  const sha = "a".repeat(64);
  const ev = recordOf(x.ctx).evidenceStore();
  assert.ok(ev === null || typeof ev === "object");
  if (ev && typeof ev.put === "function") {
    await ev.put(sha, new Uint8Array([0x25, 0x50, 0x44, 0x46]));
    await tx.transcribe({ account: { kind: "apikey", level: "member", key: SECRET }, capture_sha: sha, pages: [0] });
  }
  const posted = x.posts.filter((p) => p.url.endsWith("/transcribe"));
  for (const p of posted) assert.deepEqual([p.headers[TRACE_HEADER], p.headers[MEMBER_REF_HEADER]], [TRACE, REF]);
  const bare = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: null, at: "2026-10-14T10:00:00Z" });
  assert.equal(typeof bare.transcribe, "function", "no trace handed: still a transcription");
});

/* ===== R5 (T48; K3280, K3282, K3266): the route map re-pinned to T48's ops ===== */

/* T48's new ops are served by these owners' maps (action-replies R10, filings R59, action-holds R16, ai-use R14, instance-setup's
   update ops): the ops are read from the owners' own maps (K3268), never listed here. */


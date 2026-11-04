/* store-request R26–R28 (K5162; copies of control-plane R41, R57, R77, R80, R90, R93): `agentpack`, `airundispatch`, `textcheck` and
   `readtranslate`, each answered as control-plane's door answers it today, at the module's interface and through the world.
   The object's RPCs (`draft`, `dispatchMemberRun`) are plane's Store methods, a later module: where a test hands one, it hands a
   double that answers the plane's documented shape, and the real object answers through the world. */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "./fixtures.mjs";
import { agentPackOp, airunDispatchOp, draftCheckOp, TEXT_CHECK, READ_TRANSLATE } from "../../../src/store-request/door-ops.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { draftOnObject } from "../../../src/store-assembly/index.mjs";

const body = async (res) => ({ status: res.status, json: await res.json() });
const STAMPS = { env: {}, cls: "member", viaSession: true, sessMember: "ann", sessViewer: "member:ann", storeName: "bio", stub: {} };
const jsonRes = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });

test("R26: agentpack asks the untargeted affordances handler with the door's stamps and no target, and answers {ok, fences, pack} for its answer", async () => {
  const asked = [];
  const gatedOp = async (a) => { asked.push(a); return jsonRes({ ok: true, result: { catalog: [], vocabularies: {}, capture_acts: [] } }); };
  const res = await agentPackOp({ url: "http://h/api/?op=agentpack&target=BUNDLE-1&x=1", headers: new Headers({ authorization: "Bearer t" }), gatedOp, stamps: STAMPS });
  const { status, json } = await body(res);
  assert.equal(status, 200); assert.equal(json.ok, true); assert.equal(json.store, "bio"); assert.equal(json.tokenClass, "member");
  assert.ok(Array.isArray(json.fences) || typeof json.fences === "object");
  assert.ok(json.pack === null ? typeof json.pack_absent === "string" : typeof json.pack === "object", "a pack, or none with its reason");
  assert.equal(asked.length, 1);
  const u = asked[0].url;
  assert.equal(u.searchParams.get("op"), "affordances"); assert.equal(u.searchParams.has("target"), false); assert.equal(u.searchParams.get("x"), "1");
  assert.equal(asked[0].req.method, "GET"); assert.equal(asked[0].req.headers.get("authorization"), "Bearer t");
  assert.equal(asked[0].op, "affordances"); assert.equal(asked[0].sessMember, "ann");
});

test("R26: a refusal or an answer that is not ok is answered as the handler gives it; no hook or no answer is the store's silence", async () => {
  const w = await storeWorld();
  const ruth = await w.signIn("ruth", { capabilities: ["contribute"] });
  const real = await w.door({ url: "/api/?op=publishcheck", init: { method: "POST", headers: { "content-type": "application/json" }, body: "{}" } }, ruth);
  assert.equal(real.status, 403);
  const refused = jsonRes(real.json, real.status);   /* the real refusal of the world's door, as the hook gives it */
  const got = await agentPackOp({ url: "http://h/?op=agentpack", headers: new Headers(), gatedOp: async () => refused, stamps: STAMPS });
  assert.equal(got, refused);
  for (const gatedOp of [undefined, async () => undefined]) {
    const silent = await body(await agentPackOp({ url: "http://h/?op=agentpack", headers: new Headers(), gatedOp, stamps: STAMPS }));
    assert.equal(silent.json.ok, false); assert.ok(silent.status >= 500);
  }
});

test("R26: through the world, agentpack answers the fences and the pack the untargeted affordances answer renders", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const r = await w.door({ url: "/api/?op=agentpack&target=NOT-READ", init: { method: "GET" } }, f);
  assert.equal(r.status, 200); assert.equal(r.json.ok, true);
  assert.ok(r.json.fences && typeof r.json.fences === "object");
  assert.ok(r.json.pack && typeof r.json.pack === "object" || typeof r.json.pack_absent === "string");
  assert.equal(r.json.store, "bio");
});

test("R27: airundispatch hands run, by, viewer, at, trace and memberRef to the object and nothing else; a refusal by code is 403 for the two principal codes and 400 otherwise; a dispatch is 200", async () => {
  const calls = [];
  const stub = (out) => ({ dispatchMemberRun: async (a) => { calls.push(a); if (out instanceof Error) throw out; return out; } });
  const ask = (s, reqBody = { run: "RUN-1", credential: "SENTINEL" }) => airunDispatchOp({ stub: s, reqBody, who: "member:ann", at: "2026-10-01T12:00:00.000Z",
    trace: "tr-1", memberRef: "ref-1", storeName: "bio", cls: "member" }).then(body);
  const ok = await ask(stub({ ok: true, dispatched: true }));
  assert.deepEqual(ok, { status: 200, json: { ok: true, result: { ok: true, dispatched: true }, store: "bio", tokenClass: "member" } });
  assert.deepEqual(calls[0], { run: "RUN-1", by: "member:ann", viewer: "member:ann", at: "2026-10-01T12:00:00.000Z", trace: "tr-1", memberRef: "ref-1" });
  assert.equal(JSON.stringify(calls).includes("SENTINEL"), false, "a credential in the body reaches nothing");
  for (const [code, status] of [["AI_RUN_NOT_PRINCIPAL", 403], ["MEMBER_RUN_MODE_NOT_ADMITTED", 403], ["AI_KEPT_AWAY", 400]]) {
    const r = await ask(stub({ code, detail: "d" }));
    assert.deepEqual([r.status, r.json.result.ok, r.json.result.reason, r.json.result.detail, r.json.ok], [status, false, code, "d", true], code);
  }
  assert.equal((await ask(stub({ ok: true }), { run: 5 })).status, 200);
  assert.equal(calls.at(-1).run, null, "a run that is no string is none");
  for (const bad of [null, [1], "x", new Error("boom")]) assert.equal((await ask(stub(bad))).json.ok, false, "silent");
  const unbound = await airunDispatchOp({ stub: {}, reqBody: {}, who: "w", at: "t", storeName: "bio", cls: "member" }).then(body);
  assert.deepEqual([unbound.status, unbound.json.reason, unbound.json.detail], [503, "AGENT_WORKER_UNBOUND", word("refusal.AGENT_WORKER_UNBOUND")]);
});

test("R27: through the world, a member's airundispatch of an absent run is the owner's own answer (no such run)", async () => {
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const r = await w.door({ url: "/api/?op=airundispatch", init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ run: "RUN-none" }) } }, f);
  assert.equal(r.status, 200);
  assert.deepEqual([r.json.ok, r.json.result.run, r.json.result.found], [true, "RUN-none", false]);
});

const drafter = (answer, status = 200) => { const seen = { drafts: [], usage: [] };
  return { seen, stub: { draft: async (a) => { seen.drafts.push(a); return jsonRes(answer, status); },
    fetch: async (req) => { seen.usage.push({ url: req.url, body: await req.json() }); return jsonRes({ ok: true }); } } }; };
const draftAsk = (op, d, over = {}) => draftCheckOp({ op, stub: d.stub, viaSession: true, sessMember: "ann", session: "SESS", reqBody: { text: "hello", subject: "S-1", language: "es", answers: "NO" },
  trace: "tr-2", memberRef: "ref-2", by: "member:ann", viewer: "member:ann", store: async () => ({ answered: true }), storeName: "bio", cls: "member", ...over }).then(body);

test("R28: textcheck asks the object with the body's text alone; the labelled draft is answered in the owner's envelope and the draft counted to her day", async () => {
  const d = drafter({ ok: true, draft: "Hello.", label: "drafted by the assistant", grant: "G", usage: { in: 1 }, calls: 2, untested: { band: "test" } });
  const r = await draftAsk(TEXT_CHECK, d);
  assert.deepEqual(r, { status: 200, json: { ok: true, result: { ok: true, draft: "Hello.", label: "drafted by the assistant", untested: { band: "test" } }, store: "bio", tokenClass: "member" } });
  assert.deepEqual(d.seen.drafts[0], { op: "textcheck", member: "ann", session: "SESS", text: "hello", trace: "tr-2", memberRef: "ref-2" });
  assert.equal(d.seen.usage.length, 1);
  assert.equal(d.seen.usage[0].url, "http://do/askusage?viewer=member%3Aann");
  assert.deepEqual(d.seen.usage[0].body, { mode: "draft", usage: { in: 1 }, calls: 2 });
  assert.equal(JSON.stringify(r).includes('"G"'), false, "the grant is never answered");
});

test("R28: readtranslate asks with subject and language alone and answers the plane's labelled translation less what is internal", async () => {
  const d = drafter({ ok: true, text: "Hola", label: "machine translation", grant: "G", suggestions: true, read: ["x"], usage: {}, calls: 1 });
  const r = await draftAsk(READ_TRANSLATE, d);
  assert.deepEqual(r.json.result, { ok: true, text: "Hola", label: "machine translation" });
  assert.deepEqual(d.seen.drafts[0], { op: "readtranslate", member: "ann", session: "SESS", subject: "S-1", language: "es", trace: "tr-2", memberRef: "ref-2" });
});

test("R28: a refusal of the object is answered as given at its status (a status under 400 is 502), grant dropped, nothing counted; an unreadable answer is silence; a caller with no session, or a store with no draft, is unbound", async () => {
  const d = drafter({ ok: false, reason: "AI_PART_NOT_DEPLOYED", grant: "G" }, 403);
  const r = await draftAsk(TEXT_CHECK, d);
  assert.deepEqual([r.status, r.json.ok, r.json.reason, "grant" in r.json, d.seen.usage.length], [403, false, "AI_PART_NOT_DEPLOYED", false, 0]);
  assert.equal((await draftAsk(TEXT_CHECK, drafter({ ok: false, reason: "AI_PART_NOT_DEPLOYED" }, 200))).status, 502);
  const mute = { draft: async () => new Response("not json", { status: 200 }) };
  assert.equal((await draftAsk(TEXT_CHECK, { stub: mute, seen: {} })).json.ok, false);
  for (const over of [{ viaSession: false }, { stub: {} }]) {
    const u = await draftAsk(TEXT_CHECK, drafter({ ok: true }), over);
    assert.deepEqual([u.status, u.json.reason, u.json.detail], [503, "AGENT_WORKER_UNBOUND", word("refusal.AGENT_WORKER_UNBOUND")]);
  }
});

test("R28 (notice store-assembly:93): through the world, textcheck and readtranslate reach the plane's draft door and answer its own refusal, as the owner's draftOnObject answers that member", async () => {
  /* store-assembly PR 93: the draft door's first check is its `deployGate` on the serving account's entry (`servingEntry`), so
     each kind answers the refusal its own gate reaches: textcheck's kind is not switched on in a world, while reading's is
     and, with no account to admit, goes on to the Worker's agent the world does not bind. The door relays it as given. */
  const w = await storeWorld();
  const f = await w.signIn("admin");
  const seen = {};
  for (const [op, b] of [["textcheck", { text: "a sentence" }], ["readtranslate", { subject: "S-1", language: "es" }]]) {
    const r = await w.door({ url: `/api/?op=${op}`, init: { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) } }, f);
    const own = await draftOnObject(w.ctx, w.env, { op, member: f.member, ...b }, { read: (o, params) => w.store.read(o, params) });
    const owned = await own.json();
    assert.equal(r.json.ok, false, op);
    assert.deepEqual([r.status, r.json.reason], [own.status, owned.reason], `${op}: the owner's own refusal, relayed`);
    seen[op] = r.json.reason;
  }
  assert.deepEqual(seen, { textcheck: "AI_RUN_MODE_NOT_DEPLOYED", readtranslate: "AGENT_WORKER_UNBOUND" });
});

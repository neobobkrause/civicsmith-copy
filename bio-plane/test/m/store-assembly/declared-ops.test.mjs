/* store-assembly's copy of plane's test. plane R72 -> R84 (T51 fix round; K4168, K4202): the two ops the assembly answers itself, `ask` (the door's arm) and `readtranslate`
   (the draft path), each held true by `test-support`'s `declaredOpHolds` against the op as the door runs it: only its
   requires raise no refusal naming a declared field, a call without each required entry is refused naming it, and a field
   outside `accepts` is dropped or refused naming it. The rows are also the hand rows' (R83's registration refused no row). */
import "../../../src/store-assembly/register.mjs";   /* the start's registration first */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { store, deployed, GATE_FLAGS, GATE_SET, disclosed } from "./fixture.mjs";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS } from "../../../src/store-assembly/declared.mjs";
import { OWNERS } from "../../../src/store-assembly/declarations.mjs";
import { askOp, assistantGateOf } from "../../../src/store-assembly/ask.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { hypothesesOf } from "../../../src/hypotheses/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";
import { declaredFields, OPS } from "../../../src/op-declarations/index.mjs";

const SESSION = "s".repeat(64);
const SEAL = "a-long-seal-secret-for-the-declared-ops-test";
const SECRET = "sk-ant-zz-declared-ann";

/* ann: a live session and an API key of her own; an administrator who keeps no material away; agent-worker answers an ask's
   stream and a reading's translation. Every call a test makes is asked of this one object. */
async function world() {
  const posts = [];
  const env = { ACCOUNT_SEAL_SECRET: SEAL, AGENT_WORKER: { fetch: async (u, init) => {
    const body = JSON.parse(init.body);
    posts.push([u, body]);
    return u === "https://agent-worker/draft"
      ? new Response(JSON.stringify({ ok: true, translation: `[${body.task.language}] ${body.task.text}`, language: body.task.language,
                                      usage: { input_tokens: 1, output_tokens: 1 }, calls: 1 }), { status: 200, headers: { "content-type": "application/json" } })
      : new Response('{"event":"answer","ok":true}\n', { status: 200, headers: { "content-type": "application/x-ndjson" } });
  } } };
  const x = await store({ env, before: (ctx) => assistantGateOf(ctx, { flags: GATE_FLAGS, testSet: GATE_SET }) });
  await deployed(x.ctx);
  const sql = x.ctx.storage.sql;
  const member = (id, role = "member") => sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
    VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
  member("ada", "admin");
  assert.equal(credentialsOf(x.ctx).aiKeepAwaySet({ on: false, by: "ada" }).ok, true);
  member("ann");
  sql.exec(`INSERT INTO sessions (token_sha, role, expires, created) VALUES (?, 'member:ann', ?, 'x')`,
           createHash("sha256").update(SESSION).digest("hex"), Date.now() + 3600e3);
  await disclosed(x.ctx);
  assert.equal((await aiAccountsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: SECRET, by: "member:ann" })).ok, true);
  assert.equal(instanceSetupOf(x.ctx, x.env).memberLanguageSet({ language: "es", by: "member:ann" }).ok, true);
  const note = hypothesesOf(x.ctx).noteWrite({ text: "Meeting notes: the vote is Tuesday.", by: "member:ann" });
  assert.equal(note.ok, true, JSON.stringify(note));
  return { ...x, posts, note: note.note };
}

/* a call as the door runs it: `ask` through the Worker's arm over the object's RPC, with the credential in the header;
   `readtranslate` through the draft path of the object's RPC, with her session */
const asking = (x) => async (fields) => {
  const { store: named, ...body } = fields;
  const url = new URL(`http://plane/ask${named ? `?store=${encodeURIComponent(named)}` : ""}`);
  const req = new Request(url, { method: "POST", headers: { authorization: `Bearer ${SESSION}` }, body: JSON.stringify(body) });
  const env = { STORE: { idFromName: (n) => n, get: () => ({ ask: (a) => x.s.ask(a) }) } };
  return askOp({ req, url, env, viaSession: true, sessMember: "ann" });
};
const reading = (x) => async (fields) =>
  x.s.draft({ op: "readtranslate", member: "ann", session: SESSION, pack: { layers: [] }, ...fields });
/* the same answer whatever the grant or instant a call minted */
const sameAnswer = (a, b) => JSON.stringify({ ...a, grant: null }) === JSON.stringify({ ...b, grant: null });

test("R84 the assembly declares ask: its requires (none) raise no refusal naming a field, and a field outside accepts is dropped or refused naming it", async () => {
  const x = await world();
  assert.deepEqual(DECLARED_OPS.ask.fields.requires, [], "the plane's arm refuses nothing for a missing field; the assistant's own refusal is agent-worker's");
  await declaredOpHolds({ op: "ask", declaration: DECLARED_OPS.ask, call: asking(x), same: sameAnswer });
  /* control: a field it does accept reaches the assistant (the question), so the call is the ask the door runs */
  await asking(x)({ question: "Who holds the clerk's office?" });
  assert.equal(x.posts.at(-1)[0], "https://agent-worker/ask");
  assert.equal(x.posts.at(-1)[1].question, "Who holds the clerk's office?");
});

test("R84 the assembly declares readtranslate: its requires alone raise no refusal naming a field, a call without subject is refused naming it, and a field outside accepts is dropped or refused naming it", async () => {
  const x = await world();
  await declaredOpHolds({ op: "readtranslate", declaration: DECLARED_OPS.readtranslate, call: reading(x),
    values: { subject: { kind: "note", id: x.note }, language: "es" }, same: sameAnswer });
  /* control: with its subject the reading is made, so the refusal above was for the missing field alone */
  const ok = await (await reading(x)({ subject: { kind: "note", id: x.note } })).json();
  assert.equal(ok.ok, true, JSON.stringify(ok));
  assert.deepEqual(ok.label, { kind: "machine" });
});

test("R84 the two declarations are the assembly's own in the assembly, agree with the hand rows, and carry the fields the arms read", () => {
  for (const op of Object.keys(DECLARED_OPS)) assert.equal(OWNERS["store-assembly"][op], DECLARED_OPS[op], `${op}: the assembly holds store-assembly's own row (under the module 'store-assembly', not 'plane')`);
  assert.equal(Object.hasOwn(OWNERS, "plane"), false, "plane is no owner in this assembly");
  for (const op of Object.keys(DECLARED_OPS)) {
    const d = DECLARED_OPS[op];
    assert.deepEqual(declaredFields(op), d.fields, `${op}: the assembled fields are the declared ones`);
    assert.deepEqual([OPS[op].classes, OPS[op].machineClasses, OPS[op].mutating], [d.classes, d.machineClasses, d.mutating],
      `${op}: copied from the hand row, never chosen`);
  }
  assert.deepEqual(DECLARED_OPS.ask.fields.accepts, ["question", "conversation", "project", "store", "token"]);
  assert.deepEqual(DECLARED_OPS.readtranslate.fields, { accepts: ["subject", "language"], requires: ["subject"] });
});

/* agent-worker over agent-drafts PR 570 (its source only, no requirement text): every draft path `agent-drafts` keeps
 * in this member (`handleDraft` for `writinghelp`, `translationDraft`, `readingDraft` for `readtranslate`, and
 * `actionDraft` for `textcheck`) now calls `converse` without a `runner`. This member's answer is F5's gate, already in
 * `index.mjs` (`DRAFT_DEPS`): the draft paths' `assistantReady` is asked with no runner, so with `RUNNER` bound a
 * sign-in account's draft is still refused 503 `ASSISTANT_REMOTE_NOT_READY` (`why: "absent"`) before any model call, on
 * every one of the four paths, and never reaches the model without a runner. Confirmed, no code change; F5's own test
 * drives `writinghelp` only, so this one drives all four. With `DRAFT_DEPS` reverted to `ASK_DEPS` each draft is let
 * through with the runner bound and calls the model. Control: an API-key draft with the runner bound is not refused by
 * the gate, and a sign-in on `/signin` with the runner bound reaches the member's own instance. */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "../src/index.mjs";

const MEMBER = "member:ruth";
const SIGNIN = { kind: "signin", level: "member", member: MEMBER, secret: "held-token-n570-fixture" };
const APIKEY = { kind: "apikey", level: "member", member: MEMBER, secret: "sk-ant-n570-fixture-never-echoed" };
const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
const PACK = { id: "investigative-session", version: "pack@n570",
  resident: { objective: { text: "answer from the record" }, disclosable: [] },
  disclosed: { ask: LAYER("closed book"), suggestions: LAYER("S"), writing_help: LAYER("W"),
               interface_translation: LAYER("T"), reading_translation: LAYER("RT"), action_drafting: LAYER("AD") } };
const TASKS = {
  writinghelp: { task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the vote." },
  translationdraft: { task: { op: "translationdraft", direction: "to_language", language: "es-MX",
                              words: [{ key: "screen.word1", en: "Word", note: null, means: null, protected: false }] } },
  readtranslate: { task: { op: "readtranslate", language: "es", text: "The group meets on Tuesdays." } },
  textcheck: { task: { op: "textcheck", text: "The clerk broke the law." } },
};
const PLANE = { async fetch() { return Response.json({ ok: false }, { status: 500 }); } };

/** `RUNNER` as a Durable Object namespace: records each instance named; any request is answered `{ok: true}`. */
function runnerNamespace() {
  const named = [];
  return { named, idFromName: (n) => { named.push(n); return n; },
           get: () => ({ fetch: async () => Response.json({ ok: true }) }) };
}

/** One `/draft` of `op` for `account`, with `RUNNER` bound; answers its status, its body and the model calls made. */
async function draft(op, account) {
  const RUNNER = runnerNamespace();
  const real = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async () => { calls += 1; return Response.json({ error: "no model in this test" }, { status: 500 }); };
  try {
    const res = await worker.fetch(new Request("http://agent-worker/draft", { method: "POST",
      body: JSON.stringify({ ...TASKS[op], account, pack: PACK }) }), { VERSION: "t", PLANE, RUNNER });
    return { status: res.status, out: await res.json(), calls, named: RUNNER.named };
  } finally { globalThis.fetch = real; }
}

for (const op of Object.keys(TASKS)) {
  test(`notice agent-drafts:570 (F5): ${op}, RUNNER bound, a sign-in draft is refused ASSISTANT_REMOTE_NOT_READY before any model call`, async () => {
    const r = await draft(op, SIGNIN);
    assert.equal(r.status, 503, JSON.stringify(r.out).slice(0, 300));
    assert.equal(r.out.code, "ASSISTANT_REMOTE_NOT_READY");
    assert.equal(r.out.why, "absent");
    assert.deepEqual([r.calls, r.named], [0, []], "no model call, no instance named");
    assert.ok(!JSON.stringify(r.out).includes(SIGNIN.secret), "the secret is in no answer");
  });
}

test("notice agent-drafts:570 (control, F5): RUNNER bound, an API-key draft is not refused by the gate", async () => {
  for (const op of Object.keys(TASKS)) {
    const r = await draft(op, APIKEY);
    assert.notEqual(r.out.code, "ASSISTANT_REMOTE_NOT_READY", op);
    assert.ok(r.calls > 0, `${op}: the draft went on to the model`);
    assert.ok(!JSON.stringify(r.out).includes(APIKEY.secret), "the secret is in no answer");
  }
});

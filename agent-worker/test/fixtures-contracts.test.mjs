/* agent-worker — THE CONTRACTS ITS USERS HAND-BUILD (fix round 10; K4990, K4993, K4995, K5044). The users of this module's
 * answers are earlier in the order than it, so they cannot import it: each states the value it relies on and marks it
 * `fixtures-contract: agent-worker <id>`. Each contract is stated below as data and driven against the real worker through
 * the default export `fetch(request, env)`; the users' hand-built values must equal it. Where the real answer differs from
 * a user's value, the real one wins and the user changes (see the record's report). A member's sentence (`detail`) is
 * checked as present, never copied (K3810). */
import worker from "../src/index.mjs";
import { MEMBER } from "./account.mjs";

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const section = (s) => console.log(`\n--- ${s} ---`);

const SHA = "a".repeat(64);
const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from("page")]).toString("base64");
const PAGES = [{ page: 1, media_type: "image/png", data: PNG }];
const ACCOUNT = { kind: "apikey", level: "member", secret: "sk-ant-contract-fixture-never-echoed", member: MEMBER, suggestions: false };

/** One POST to the real worker; the model API answers `model` (a scripted global fetch), the plane is never to be called. */
async function call(path, body, model = async () => new Response("<html>", { status: 502 })) {
  const planeCalls = [];
  const saved = globalThis.fetch;
  globalThis.fetch = model;
  try {
    const res = await worker.fetch(new Request(`http://agent-worker/${path}`, { method: "POST", body: typeof body === "string" ? body : JSON.stringify(body) }),
      { PLANE: { fetch: async (u) => { planeCalls.push(String(u)); return Response.json({ ok: false }, { status: 500 }); } } });
    return { status: res.status, body: await res.json(), planeCalls };
  } finally { globalThis.fetch = saved; }
}
/** The wire shape of a refusal: its status, its code and the keys it carries, its `detail` only as a non-empty sentence. */
const shape = (r) => ({ status: r.status, ok: r.body.ok, reason: r.body.reason, code: r.body.code, worker: r.body.worker,
                        detail: typeof r.body.detail === "string" && r.body.detail.length > 0, extra: Object.keys(r.body).filter((k) => !["ok", "reason", "code", "detail", "worker"].includes(k)).sort() });

/* ---------------------------------------------------------------------------------------------- dispatch-refusal */

section("dispatch-refusal (ai-runs) · R2, R94 · a 4xx refusal body of POST /run, with a real code");
{
  // fixtures-run: ai-runs dispatch-refusal
  const CONTRACT = [
    ["a body that is not JSON", "{oops", { status: 400, ok: false, reason: "BAD_BODY", code: "BAD_BODY", worker: "agent-worker", detail: true, extra: [] }],
    ["a credential of the wrong shape", { run_id: "RUN-contract", store: "scratch", credential: "hunter2" },
      { status: 400, ok: false, reason: "BAD_CREDENTIAL_SHAPE", code: "BAD_CREDENTIAL_SHAPE", worker: "agent-worker", detail: true, extra: [] }],
  ];
  for (const [label, body, want] of CONTRACT) {
    const r = await call("run", body);
    t(`dispatch-refusal: ${label} -> ${want.status} ${want.code}, {ok, reason, code, detail, worker}, no plane call`, [shape(r), r.planeCalls.length], [want, 0]);
  }
}

/* ---------------------------------------------------------------------------------------------- transcribe-refusal */

section("transcribe-refusal (extraction) · R72 · the worker's refusal bodies {ok:false, reason, code, detail, worker}");
{
  const good = { capture_sha: SHA, pages: PAGES, account: ACCOUNT };
  // fixtures-run: extraction transcribe-refusal
  const CONTRACT = [
    ["BAD_BODY", 400, [], "{oops"],
    ["BAD_SHA", 400, [], { ...good, capture_sha: "x" }],
    ["BAD_PAGES", 400, [], { ...good, pages: [] }],
    ["NO_ACCOUNT", 409, ["capability"], { ...good, account: undefined }],
    ["BAD_ACCOUNT", 400, ["field"], { ...good, account: { ...ACCOUNT, kind: "subscription" } }],
  ];
  for (const [code, status, extra, body] of CONTRACT) {
    const r = await call("transcribe", body);
    t(`transcribe-refusal: ${code} -> ${status}, the body's own keys beside {ok, reason, code, detail, worker}, nothing called`,
      [shape(r), r.planeCalls.length], [{ status, ok: false, reason: code, code, worker: "agent-worker", detail: true, extra }, 0]);
  }
  const needsKey = await call("transcribe", { ...good, account: { kind: "signin", level: "member", member: MEMBER, secret: "sk-ant-oat-x", suggestions: false } });
  t("transcribe-refusal: TRANSCRIBE_NEEDS_API_KEY is no longer answered (T46, N852): a sign-in's account is not refused for its kind",
    [needsKey.body.code === "TRANSCRIBE_NEEDS_API_KEY", needsKey.planeCalls.length], [false, 0]);
}

/* ---------------------------------------------------------------------------------------------- transcribe-declined */

section("transcribe-declined (extraction) · R72, R74 · the worker's answer when the AI declines, and when the model is silent");
{
  const good = { capture_sha: SHA, pages: PAGES, account: ACCOUNT };
  // the worker's answers when the AI declines and when it is silent (extraction's t44/t46 take them from its own fixtures; K5146)
  const declined = await call("transcribe", good, async () => Response.json({ type: "error", error: { type: "overloaded_error", message: "busy" } }, { status: 529 }));
  t("transcribe-declined: every page declined -> 502 MODEL_REFUSED, ending refused, the provider's own type and status beside it",
    [declined.status, declined.body.ok, declined.body.reason, declined.body.code, declined.body.worker, declined.body.ending, declined.body.model_error, declined.body.model_status],
    [502, false, "MODEL_REFUSED", "MODEL_REFUSED", "agent-worker", "refused", "overloaded_error", 529]);
  const silent = await call("transcribe", good);
  t("transcribe-declined: the model silent -> 502 MODEL_SILENT, ending silent",
    [silent.status, silent.body.ok, silent.body.reason, silent.body.code, silent.body.worker, silent.body.ending], [502, false, "MODEL_SILENT", "MODEL_SILENT", "agent-worker", "silent"]);
  t("transcribe-declined: neither answer is `{ok:false, reason:\"busy\"}`, and neither carries AGENT_WORKER_SILENT (the plane's own word for a worker that did not answer)",
    [declined.body.reason === "busy", silent.body.reason === "busy", declined.body.reason === "AGENT_WORKER_SILENT", silent.body.reason === "AGENT_WORKER_SILENT"], [false, false, false, false]);
}

/* ---------------------------------------------------------------------------------------------- transcribe-not-sent */

section("transcribe-not-sent (extraction) · R72 · AGENT_WORKER_UNBOUND, EVIDENCE_ABSENT, NO_PAGE_RENDERED are not the worker's");
{
  const good = { capture_sha: SHA, pages: PAGES, account: ACCOUNT };
  // the three codes extraction gives before any post are none of the worker's answers (K5146)
  const NOT_SENT = ["AGENT_WORKER_UNBOUND", "EVIDENCE_ABSENT", "NO_PAGE_RENDERED"];
  const answers = [await call("transcribe", "{oops"), await call("transcribe", { ...good, capture_sha: "x" }), await call("transcribe", { ...good, pages: [] }),
    await call("transcribe", { ...good, account: undefined }), await call("transcribe", { ...good, account: null }),
    await call("transcribe", good), await call("transcribe", { ...good, pages: [{ ...PAGES[0], media_type: "image/jpeg" }] })];
  t("transcribe-not-sent: none of the worker's answers over its refusal paths gives any of the three (they are the plane's, before a post is made)",
    answers.map((r) => NOT_SENT.includes(r.body.code) || NOT_SENT.includes(r.body.reason)), answers.map(() => false));
}

console.log(`\nfixtures-contracts: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

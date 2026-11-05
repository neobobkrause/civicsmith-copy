/* agent-drafts — T53 (BR29; agent-worker R122): every draft answer's `label` is `{kind: "machine", ai}`, `ai` the label
 * `agent-model`'s `converse` answered from the served identity (its R21, R26), never read from the request.
 *
 * R1 (writinghelp, groupdescriptiondraft), R4 (translationdraft) and R7 (readtranslate) are driven at the member's
 * interface, the default export `fetch(request, env)`, with the global `fetch` replaced by a scripted model API (as the
 * agent-worker suites drive it). `converse`'s label is the stub adapter's: `agent-model`'s own adapters are not on this
 * tree, so a child process replaces `agent-model/src/model.mjs` with its real exports, `converse` running the real
 * conversation and its answer carrying the label a stub adapter states (the pattern `skills`' pack test uses). Two stub
 * adapters stating different labels give answers carrying exactly those; a `label` in the request body is ignored. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
const MODEL = join(ROOT, "agent-model/src/model.mjs");

const ADAPTER_A = { provider: "stub-a", host: "a.stub.test", model_version: "stub-a-1", effort: "medium", account_level: "member", owner: "member:ruth" };
const ADAPTER_B = { provider: "stub-b", host: "b.stub.test", model_version: "stub-b-7", effort: "low", account_level: "group", owner: "group" };
const PLANTED = { provider: "planted", host: "planted.test", model_version: "planted-0", effort: "high", account_level: "group", owner: "planted" };

const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
const PACK = { id: "investigative-session", version: "pack@agent-drafts-label",
  resident: { objective: { text: "answer from the record" }, disclosable: [] },
  disclosed: { ask: LAYER("closed book"), suggestions: LAYER("S"), writing_help: LAYER("W"),
               interface_translation: LAYER("T"), reading_translation: LAYER("RT") } };
const TASKS = {
  writinghelp: { body: { task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the vote." },
                 answer: { text: "drafted" } },
  groupdescriptiondraft: { body: { task: { op: "groupdescriptiondraft" }, told: [{ question: "What do you watch?", text: "the council" }] },
                           answer: { focus: "the council", purpose: "to watch it" } },
  translationdraft: { body: { task: { op: "translationdraft", direction: "to_language", language: "es-MX",
                                      words: [{ key: "screen.word1", en: "Word", note: null, means: null, protected: false }] } },
                      answer: { words: [{ key: "screen.word1", text: "Palabra" }] } },
  readtranslate: { body: { task: { op: "readtranslate", language: "es", text: "The group meets on Tuesdays." } },
                   answer: { text: "El grupo se reúne los martes.", from_language: "en" } },
};

/** Drives one `/draft` in a child whose `converse` answers `adapterLabel`; `extra` is merged into the body. */
function drive(op, adapterLabel, extra = {}) {
  const t = TASKS[op];
  const body = { ...t.body, account: { kind: "apikey", level: "member", secret: "sk-ant-agent-drafts-label-fixture", member: "member:ruth" },
                 pack: PACK, ...extra };
  const script = `
    import { mock } from "node:test";
    const real = { ...(await import(${JSON.stringify(MODEL + "?real")})) };
    const label = ${JSON.stringify(adapterLabel)};
    mock.module(${JSON.stringify("file://" + MODEL)}, { namedExports: { ...real,
      converse: async (args) => { const out = await real.converse(args); return out && "answer" in out ? { ...out, label } : out; } } });
    const { remoteBindings } = await import(${JSON.stringify("file://" + join(ROOT, "agent-worker/test/remote.mjs"))});
    const { default: worker } = await import(${JSON.stringify("file://" + join(ROOT, "agent-worker/src/index.mjs"))});
    const runner = { idFromName: (n) => ({ name: n }), newUniqueId: () => ({ name: "u" }), get: () => ({ fetch: async () => Response.json({ ok: true }) }) };
    const planeCalls = [];
    const PLANE = { async fetch(u) { planeCalls.push(String(u)); return Response.json({ ok: false }, { status: 500 }); } };
    globalThis.fetch = async () => Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "u1", name: "draft", input: ${JSON.stringify(t.answer)} }], usage: { input_tokens: 3, output_tokens: 2 } });
    for (const k of ["log", "info", "warn", "error", "debug"]) console[k] = () => {};
    const res = await worker.fetch(new Request("http://agent-worker/draft", { method: "POST", body: ${JSON.stringify(JSON.stringify(body))} }),
      { VERSION: "t", PLANE, ...remoteBindings(runner) });
    process.stdout.write("OUT " + JSON.stringify({ status: res.status, out: await res.json(), planeCalls }) + "\\n");`;
  const out = execFileSync(process.execPath, ["--experimental-test-module-mocks", "--no-warnings",
    "--input-type=module", "-e", script], { encoding: "utf8" });
  const m = /^OUT (.*)$/m.exec(out);
  assert.ok(m, `the child answered: ${out}`);
  return JSON.parse(m[1]);
}

/** Two stub adapters stating different labels: each answer's label is exactly `{kind: "machine", ai}` of its adapter. */
function carriesAdapterLabel(op) {
  for (const adapter of [ADAPTER_A, ADAPTER_B]) {
    const r = drive(op, adapter);
    assert.equal(r.status, 200, JSON.stringify(r.out));
    assert.equal(r.out.ok, true);
    assert.deepEqual(r.out.label, { kind: "machine", ai: adapter });
  }
}
/** A planted `label` in the body is ignored: the answer carries the adapter's. */
function ignoresBodyLabel(op) {
  const r = drive(op, ADAPTER_A, { label: { kind: "machine", ai: PLANTED } });
  assert.equal(r.status, 200, JSON.stringify(r.out));
  assert.deepEqual(r.out.label, { kind: "machine", ai: ADAPTER_A });
}

test("R1 writinghelp: the label is the stub adapter's, for two adapters", () => carriesAdapterLabel("writinghelp"));
test("R1 writinghelp control: a request-body label is ignored", () => ignoresBodyLabel("writinghelp"));
test("R1 groupdescriptiondraft: the label is the stub adapter's, for two adapters", () => carriesAdapterLabel("groupdescriptiondraft"));
test("R1 groupdescriptiondraft control: a request-body label is ignored", () => ignoresBodyLabel("groupdescriptiondraft"));
test("R4 translationdraft: the label is the stub adapter's, for two adapters", () => carriesAdapterLabel("translationdraft"));
test("R4 translationdraft control: a request-body label is ignored", () => ignoresBodyLabel("translationdraft"));
test("R7 readtranslate: the label is the stub adapter's, for two adapters", () => carriesAdapterLabel("readtranslate"));
test("R7 readtranslate control: a request-body label is ignored", () => ignoresBodyLabel("readtranslate"));

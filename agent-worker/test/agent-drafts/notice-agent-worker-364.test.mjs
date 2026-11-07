/* agent-drafts — notice agent-worker:364 (agent-worker changed its source, PR 364: `remoteOf` answers null for every
 * environment, its F2, and the shell's deps wrap `converse` in the agent-model circuit, its F3). This module's answer:
 * no draft names a runner, so `converse` is called without a `runner` key on every draft path — `handleDraft`
 * (writinghelp), `translationDraft` (translationdraft), `readingDraft` (readtranslate) and `actionDraft` (textcheck).
 * Driven at the member's interface, the default export `fetch(request, env)`, in a child whose `agent-model` `converse`
 * is the real one wrapped to record its arguments, with the remote bindings still present in the environment; with the
 * change reverted each path passes `runner: remoteOf(env)` and the key is there. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { join, dirname } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, "../../..");
const MODEL = join(ROOT, "agent-model/src/model.mjs");

const LAYER = (body) => ({ load_when: "when asked", sourcing: "authored", body });
const PACK = { id: "investigative-session", version: "pack@agent-drafts-364",
  resident: { objective: { text: "answer from the record" }, disclosable: [] },
  disclosed: { ask: LAYER("closed book"), suggestions: LAYER("S"), writing_help: LAYER("W"),
               interface_translation: LAYER("T"), reading_translation: LAYER("RT"), action_drafting: LAYER("AD") } };
const TASKS = {
  writinghelp: { body: { task: { op: "writinghelp", act: "noteadd", field: "text" }, told: "I saw the vote." },
                 answer: { text: "drafted" } },
  translationdraft: { body: { task: { op: "translationdraft", direction: "to_language", language: "es-MX",
                                      words: [{ key: "screen.word1", en: "Word", note: null, means: null, protected: false }] } },
                      answer: { words: [{ key: "screen.word1", text: "Palabra" }] } },
  readtranslate: { body: { task: { op: "readtranslate", language: "es", text: "The group meets on Tuesdays." } },
                   answer: { text: "El grupo se reúne los martes.", from_language: "en" } },
  textcheck: { body: { task: { op: "textcheck", text: "The clerk broke the law." } },
               answer: { sentences: [{ index: 0, quote: "The clerk broke the law.", reads_as: "assertion", why: "it asserts a breach" }] } },
};

/** Drives one `/draft`; answers its status and, for each `converse` call, whether its arguments carried `runner`. */
function drive(op) {
  const t = TASKS[op];
  const body = { ...t.body, account: { kind: "apikey", level: "member", secret: "sk-ant-agent-drafts-364-fixture", member: "member:ruth" },
                 pack: PACK };
  const script = `
    import { mock } from "node:test";
    const real = { ...(await import(${JSON.stringify(MODEL + "?real")})) };
    const seen = [];
    mock.module(${JSON.stringify("file://" + MODEL)}, { namedExports: { ...real,
      converse: async (args) => { seen.push({ hasRunner: Object.hasOwn(args, "runner"), runner: args.runner ?? null }); return real.converse(args); } } });
    const { remoteBindings } = await import(${JSON.stringify("file://" + join(ROOT, "agent-worker/test/remote.mjs"))});
    const { default: worker } = await import(${JSON.stringify("file://" + join(ROOT, "agent-worker/src/index.mjs"))});
    const runner = { idFromName: (n) => ({ name: n }), newUniqueId: () => ({ name: "u" }), get: () => ({ fetch: async () => Response.json({ ok: true }) }) };
    const PLANE = { async fetch() { return Response.json({ ok: false }, { status: 500 }); } };
    globalThis.fetch = async () => Response.json({ id: "m", type: "message", role: "assistant", stop_reason: "tool_use",
      content: [{ type: "tool_use", id: "u1", name: "draft", input: ${JSON.stringify(t.answer)} }], usage: { input_tokens: 3, output_tokens: 2 } });
    for (const k of ["log", "info", "warn", "error", "debug"]) console[k] = () => {};
    const res = await worker.fetch(new Request("http://agent-worker/draft", { method: "POST", body: ${JSON.stringify(JSON.stringify(body))} }),
      { VERSION: "t", PLANE, ...remoteBindings(runner) });
    const out = await res.json();
    process.stdout.write("OUT " + JSON.stringify({ status: res.status, ok: out.ok, seen }) + "\\n");`;
  const out = execFileSync(process.execPath, ["--experimental-test-module-mocks", "--no-warnings",
    "--input-type=module", "-e", script], { encoding: "utf8" });
  const m = /^OUT (.*)$/m.exec(out);
  assert.ok(m, `the child answered: ${out}`);
  return JSON.parse(m[1]);
}

function namesNoRunner(op) {
  const r = drive(op);
  assert.equal(r.status, 200, JSON.stringify(r));
  assert.equal(r.ok, true);
  assert.ok(r.seen.length >= 1, "converse was called");
  for (const call of r.seen) assert.deepEqual(call, { hasRunner: false, runner: null });
}

test("notice agent-worker:364 writinghelp (handleDraft): converse is called without a runner", () => namesNoRunner("writinghelp"));
test("notice agent-worker:364 translationdraft: converse is called without a runner", () => namesNoRunner("translationdraft"));
test("notice agent-worker:364 readtranslate: converse is called without a runner", () => namesNoRunner("readtranslate"));
test("notice agent-worker:364 textcheck (actionDraft): converse is called without a runner", () => namesNoRunner("textcheck"));

/* plane R36 (the AI path of the transcriber), the provider's run of the `transcribe-answer` contract (fix round 10; K5202, plan item 101 (4)(a)): the users'
   hand-built `transcribe` answers (extraction, reading-pipeline) are stated as data, `{ok: true, engine, version, pages: [{page, text}]}`, and this test runs
   that contract against the REAL AI path: `transcriberOf(...).transcription(...).transcribe`, the function a caller is handed, over a held scan, with
   agent-worker's `/transcribe` answering the shape the users state. The path's answer is the users' answer plus what it adds (`asked`, `sent`, `owed`), and each
   field the users read is checked on what the path answers. */
import "../../../src/store-assembly/register.mjs";   /* R68: the start's registration before any op table is read */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { store, admitPart } from "./fixture.mjs";
import { ENTRIES } from "../ai-accounts/catalogue.mjs";   /* the account serves on a catalogue fixture entry (ai-runs R78) */
import { transcriberOf } from "../../../src/store-assembly/transcribe.mjs";

const SCAN = new Uint8Array(readFileSync(fileURLToPath(new URL("../../../../pdf-worker/test/fixtures/scan-dct-page.pdf", import.meta.url))));
const SENTINEL = "sk-ant-SENTINEL-R36-TRANSCRIBE-ANSWER";
const shaOf = (b) => createHash("sha256").update(b).digest("hex");

/* the evidence bucket (`CAPTURES`), in memory: the scan held as its digest's object */
function bucket() {
  const held = new Map();
  const object = (k, b) => ({ key: k, size: b.length, arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.length) });
  return { held,
    async put(k, v) { const b = v instanceof Uint8Array ? v : new TextEncoder().encode(String(v)); held.set(k, b); return { key: k, size: b.length }; },
    async get(k) { return held.has(k) ? object(k, held.get(k)) : null; },
    async head(k) { return held.has(k) ? { key: k, size: held.get(k).length } : null; },
    async delete(k) { held.delete(k); },
    async list() { return { objects: [...held.keys()].map((key) => ({ key })), truncated: false }; } };
}

/* agent-worker's `/transcribe`, answering the shape the users state: one text per page asked */
function worker() {
  const seen = [];
  return { seen, fetch: async (u, init) => {
    const body = JSON.parse(init.body);
    seen.push(body);
    const answer = { ok: true, engine: "claude-test", version: "2026-01", pages: body.pages.map((p) => ({ page: p.page, text: `AI text of page ${p.page}` })),
      not_transcribed: [], usage: { input_tokens: 1, output_tokens: 1, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: 0 }, calls: body.pages.length };
    return new Response(JSON.stringify(answer), { status: 200, headers: { "content-type": "application/json" } });
  } };
}

/* the users' answer, as they state it: `transcribe({account, capture_sha, pages})` answers `{ok, engine, version, pages}`, the pages by number */
async function answerOf(pages) {
  const evidence = bucket(), w = worker();
  const x = await store({ env: { CAPTURES: evidence, AGENT_WORKER: w } });
  await admitPart(x.ctx, "transcribe");   /* ai-runs R78 (T53): transcription admitted on the catalogue fixture's entries */
  const d = shaOf(SCAN);
  await evidence.put(`bio/captures/${d}`, SCAN);
  const tx = transcriberOf(x.ctx, x.env).transcription({ member: "member:ann", project: null, at: "2026-10-25T00:00:00Z" });
  const answer = await tx.transcribe({ account: { ok: true, kind: "apikey", level: "member", key: SENTINEL, entry_id: ENTRIES.a }, capture_sha: d, pages });
  return { answer, seen: w.seen, d };
}

test("R36 (the transcribe-answer contract, extraction and reading-pipeline): the AI path answers `{ok: true, engine, version, pages: [{page, text}]}` for the pages asked, the users' shape, with the pages sent and owed named", async () => {
  const { answer, seen, d } = await answerOf([0]);
  assert.equal(answer.ok, true, JSON.stringify(answer));
  assert.equal(typeof answer.engine, "string", "the engine is named");
  assert.ok(answer.engine.length > 0);
  assert.equal(typeof answer.version, "string", "the version is named");
  assert.ok(Array.isArray(answer.pages) && answer.pages.length === 1, "one text per page sent");
  for (const p of answer.pages) {
    assert.deepEqual(Object.keys(p).sort(), ["page", "text"], "each page is {page, text}, nothing more");
    assert.equal(typeof p.page, "number", "the page is a number, as the users ask it");
    assert.equal(typeof p.text, "string");
  }
  assert.deepEqual(answer.pages.map((p) => p.page), [0]);
  assert.deepEqual(answer.sent, [0], "the page the path sent is the page asked");
  assert.deepEqual(answer.asked, [0]);
  assert.deepEqual(answer.owed, []);
  assert.equal(seen.length, 1, "one post to agent-worker");
  assert.equal(seen[0].capture_sha, d);
});

test("R36 (the transcribe-answer contract): the answer's pages follow the pages asked, in order, and a page the scan does not have is named, never answered", async () => {
  const { answer } = await answerOf([0, 0]);
  assert.equal(answer.ok, true);
  assert.deepEqual(answer.pages.map((p) => p.page), [0], "a page asked twice is answered once");
  const { answer: missing } = await answerOf([1]);
  assert.equal(missing.ok, false, "a page the scan does not have is not answered as text");
  assert.equal(missing.pages, undefined);
});

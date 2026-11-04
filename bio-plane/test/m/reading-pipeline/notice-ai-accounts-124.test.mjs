/* reading-pipeline, provider notice ai-accounts:124 (PR 124: `accountFor`, `accountUses`, `accountUsesOf` and `accountUsesSet`
   changed; the F1 compatibility names added). This module reads one of them, `accountFor` (its R7, R11), handed in as
   `transcription.accounts` (R29, R31), and reads of its answer only `ok`, `level` and `project`, handing the whole answer to the
   caller's `transcribe` and nothing of it into the reading. Confirmed with no code change: the account is asked of ai-accounts'
   real code through its published fixtures (`test/m/ai-accounts/fixtures.mjs`, K4990), never a hand-built answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as rp from "../../../src/reading-pipeline/index.mjs";
import { accountsServing } from "../ai-accounts/fixtures.mjs";
import { bucket, evidenceStore, hold, doc, withEntry, i2, noText } from "./fixture.mjs";

/* a PDF whose page 1 is a scan Civicsmith's own recognition could not read (tier 3 is not bound) */
const PAGES = [{ page: 0, text: "Staff report on the capital plan" }, { page: 1, text: "", undetermined: [noText(1)] }];
const scanEntry = () => ({ format: "pdf", structure: async () => ({ ok: true, text: i2(PAGES), pages: PAGES.length, notes: [] }) });
async function readWith(transcription) {
  const b = bucket();
  const d = await hold(b, "%PDF notice ai-accounts 124");
  const document = doc({ digest: d, format: "pdf", ct: "application/pdf", locator: "https://records.example.gov/report.pdf" });
  return withEntry(scanEntry(), () => rp.read(document, { evidence: evidenceStore(b), env: {}, storeName: "bio", transcription }));
}
const recorder = (answer) => { const calls = []; return { calls, fn: async (q) => { calls.push(q); return answer(q); } }; };

test("notice ai-accounts:124 R31 R29: the account ai-accounts' changed accountFor answers for a member's transcribe act is the one the reading's AI path is handed, its owner spelled from the answer's level; the key reaches the AI alone", async () => {
  const served = await accountsServing({ member: "ann" });
  const asked = await served.accountFor({ member: "ann", act: { kind: rp.TRANSCRIBE_USE, member: "ann" } });
  const limit = recorder(() => null);
  const ai = recorder((q) => ({ ok: true, engine: "vision-model", version: "3", pages: q.pages.map((p) => ({ page: p, text: `the AI read page ${p}` })) }));
  const out = await readWith({ member: "ann", accounts: served.accounts, useCheck: limit.fn, transcribe: ai.fn, at: "2026-11-04T12:00:00Z" });
  assert.equal(asked.ok, true, "ai-accounts serves ann's own key for a transcribe act");
  /* the answer is the one handed to the AI, the limit asked for the owner R29 spells from `level` */
  assert.equal(ai.calls.length, 1);
  assert.equal(ai.calls[0].account.account_id, asked.account_id);
  assert.equal(ai.calls[0].account.level, asked.level);
  assert.deepEqual(ai.calls[0].pages, [1]);
  assert.deepEqual(limit.calls, [{ owner: "member:ann", member: "ann", use: rp.TRANSCRIBE_USE, at: "2026-11-04T12:00:00Z" }]);
  assert.deepEqual(out.reading.ai_transcription.pages, [1]);
  assert.equal(JSON.stringify(out).includes(served.key), false, "the key is in no part of the reading");
});

test("notice ai-accounts:124 R31 (control): an account ai-accounts refuses sends nothing to the AI and no limit is asked; the reading carries no AI pages", async () => {
  const served = await accountsServing({ member: "ann" });
  const limit = recorder(() => null);
  const ai = recorder(() => ({ ok: true, engine: "vision-model", version: "3", pages: [] }));
  /* `bob` is enrolled nowhere in ann's world: ai-accounts' real accountFor refuses his act */
  const refused = await served.accountFor({ member: "bob", act: { kind: rp.TRANSCRIBE_USE, member: "bob" } });
  assert.notEqual(refused && refused.ok, true);
  const out = await readWith({ member: "bob", accounts: served.accounts, useCheck: limit.fn, transcribe: ai.fn });
  assert.equal(ai.calls.length, 0);
  assert.equal(limit.calls.length, 0);
  assert.equal("ai_transcription" in out.reading, false);
});

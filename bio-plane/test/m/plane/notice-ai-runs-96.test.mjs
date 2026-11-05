/* Provider notice ai-runs:96 (PR 96: ai-runs T53, its `dispatchMemberRun` dispatching on any account that serves the
   member and no longer taking the account's kind or secret). The plane's use is the Store's RPC (R114, R46, R55):
   `dispatchMemberRun(args)` calls ai-runs' `dispatchMemberRun` in the object addressed. Confirmed with no code change:
   the RPC hands ai-runs only `run`, `by`, `viewer`, `at` and the door's `trace` and `memberRef`, the arguments ai-runs'
   T53 path reads, so an account, its kind, a secret or a credential in the args never reaches ai-runs nor any answer: which
   account serves the run is ai-runs' to choose. Control: ai-runs' own answer to the same run is the RPC's answer. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";   /* answers `cloudflare:workers` */
import { aiRunsOf } from "../../../src/ai-runs/index.mjs";

test("notice ai-runs:96 (R114, R46, R55): the Store's RPC dispatchMemberRun hands ai-runs only run, by, viewer, at, trace and memberRef; an account, kind, secret or credential in the args is neither passed nor answered; control: the answer is ai-runs' own", async () => {
  const x = await store();
  const ai = aiRunsOf(x.ctx), was = ai.dispatchMemberRun.bind(ai), seen = [];
  ai.dispatchMemberRun = async (a) => { seen.push(a); return was(a); };
  try {
    const plain = { run: "RUN-2026-0096-none", by: "member:ann", viewer: "member:ann", at: "2026-11-04T00:00:00Z",
      trace: "tr-96", memberRef: "mr-96" };
    const SENT = "sentinel-96-secret";
    const r = await x.s.dispatchMemberRun({ ...plain, account: "acct-96", kind: "apikey", secret: SENT, credential: SENT });
    assert.deepEqual(seen, [plain]);
    assert.equal(JSON.stringify(r).includes(SENT), false);
    assert.deepEqual(r, await was(plain), "ai-runs' own answer");
    assert.equal(r.found, false);
  } finally { ai.dispatchMemberRun = was; }
});

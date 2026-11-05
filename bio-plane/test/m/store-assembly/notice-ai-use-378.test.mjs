/* store-assembly R86 (notice ai-use:378; ai-use R10, PR 378): `useEstimate` gained the entry fallback: with too few measured
   acts and an `entry_id`, the range is the entry's for the part. The owner map's `aiestimate` arm hands the request's
   `entry_id` to ai-use, so through the door an estimate naming an entry is ai-use's entry-named answer. The store is the real
   assembled one; the answer is ai-use's own. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { storage, assembleStore } from "./fixture.mjs";

async function plane() {
  const st = storage();
  const s = assembleStore(st.ctx, { STORE: { idFromName: (n) => n } });
  for (const p of st.blocked) await p;
  st.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                           VALUES ('ada', 'Cover ada', 'h_ada', 'admin', 'active', '["contribute"]', 't', 't')`);
  return s;
}
const estimate = async (s, body) => {
  const r = await s.dispatch(new Request("http://do/aiestimate?by=ada&viewer=member:ada", { method: "POST", body: JSON.stringify(body) }));
  const b = await r.json();
  return b.result ?? b;
};

test("R86 (ai-use R10, notice 378): `aiestimate` hands the body's `entry_id` to ai-use, which answers the entry-named estimate; control: without one the answer names no entry", async () => {
  const s = await plane();
  const named = await estimate(s, { owner: "member:ada", use: "run", mode: "investigate", entry_id: "p3-entry" });
  assert.equal(named.entry_id, "p3-entry", JSON.stringify(named));
  const plain = await estimate(s, { owner: "member:ada", use: "run", mode: "investigate" });
  assert.equal("entry_id" in plain, false, JSON.stringify(plain));
  const bad = await estimate(s, { owner: "member:ada", use: "run", mode: "investigate", entry_id: "not an entry!" });
  assert.equal(bad.ok, false, "a malformed entry_id is ai-use's refusal, so the field reached it");
});

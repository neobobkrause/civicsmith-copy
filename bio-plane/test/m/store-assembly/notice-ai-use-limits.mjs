/* The store-assembly world the notices answers:197 and ai-runs:213 are confirmed on: the assembled store (a test instance, so
   ai-runs admits the run mode on its exception), ann holding her own account of the catalogue fixture's API plan, and her
   project. `limitOn(account_id)` records ai-use's provider limit (its R18) on that account and its entry, as a provider's
   refusal would. */
import { createHash } from "node:crypto";
import { store, disclosed } from "./fixture.mjs";
import { aiAccountsOf } from "../../../src/ai-accounts/index.mjs";
import { aiUseOf } from "../../../src/ai-use/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";

export const T0 = "2026-11-02T00:00:00Z";
export const PROJ = "PROJ-2026-0042-limits";
const sha = (t) => createHash("sha256").update(t).digest("hex");

export async function limitsWorld() {
  const x = await store({ env: { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-limits-test", CIVICSMITH_TEST_INSTANCE: "t-lim", INSTANCE_NAME: "t-lim" } });
  x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                          VALUES ('ann', 'Cover ann', 'h_ann', 'member', 'active', '["contribute"]', 't', 't')`);
  await disclosed(x.ctx);
  const set = await aiAccountsOf(x.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ant-zz-ann-limits", by: "member:ann" });
  if (!set.ok) throw new Error(JSON.stringify(set));
  const record = recordOf(x.ctx), text = `---\nid: ${PROJ}\n---\n`;
  record.transact(() => record.commit({ bundleId: PROJ, type: "project", title: PROJ, project: null, snapKey: "lim1", kind: "promotion",
    base: sha(""), author: "x", writer: null, operation: null, files: [{ path: "bundle.md", text, sha256: sha(text), bytes: text.length }],
    state: "forming", priorState: null, group: "test-group", created: T0, lastUpdated: T0, criticality: null, at: T0 }));
  membershipOf(x.ctx).projectClaimOwner({ projectId: PROJ, memberId: "ann" });
  membershipOf(x.ctx).reindexProjectSight(PROJ);
  const served = aiAccountsOf(x.ctx).accountServing({ member: "member:ann", use: "ask" });
  const limitOn = (account_id, entry_id = served.entry_id) => aiUseOf(x.ctx).recordProviderLimit({ owner: "member:ann", account_id, entry_id,
    kind: "spend", scope: "account", resets_at: "2027-01-01T00:00:00Z", at: "2026-11-01T00:00:00Z" });
  return { ...x, account_id: set.account_id, served, limitOn };
}

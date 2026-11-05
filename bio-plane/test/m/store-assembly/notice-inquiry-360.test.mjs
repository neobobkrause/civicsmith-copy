/* store-assembly: the provider notice inquiry:360 (PR 360; inquiry R87 to R90: `setSubject`, `subjectHistory`, the subject's
   private-person warning, a part's subject change). Confirmed, no code change. Triage pointed at R3's additive column
   `bundles.inquiry_subject_entity` (assemble.mjs, REC-18), the projection a store written before T19 held, which `setSubject`
   now changes. That column is inert: inquiry keeps the subject in its own `inquiry_bundle_facts` (its R36, R40) and copies
   the old column once, on the boot that gives its table the column, never again. So the assembly's migration (R3: the
   column first, then each owner's `migrate()` in R2's order) run again over a store whose question's subject `setSubject`
   changed keeps the new subject and its history, and never brings back the stale value left on `bundles`. Driven on the
   assembled store's own instances (inquiry, promotion, entities, membership); the question is created by the real promotion. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";
import { inquiryMd, V } from "../inquiry/fixture.mjs";
import { inquiryOf, BUNDLE_FACTS, SUBJECT_COLUMN } from "../../../src/inquiry/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { instanceSetupOf } from "../../../src/setup.mjs";

const Q = "INQ-2026-3601-q", E1 = "ENT-2026-3601", E2 = "ENT-2026-3602", STALE = "ENT-2026-3699";

async function changed() {
  const x = await store();
  const sql = x.ctx.storage.sql;
  instanceSetupOf(x.ctx).instanceGroupSeed({ slug: "test-group", author: "admin" });
  sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
            VALUES ('alice', 'Cover alice', 'h_alice', 'member', 'active', '["contribute"]', 't', 't')`);
  for (const [id, label] of [[E1, "Harbor Board"], [E2, "Paving Office"], [STALE, "Old Office"]])
    sql.exec(`INSERT OR IGNORE INTO entities (entity_id, kind, label, at) VALUES (?, 'body', ?, '2026-09-27T00:00:00Z')`, id, label);
  const made = promotionOf(x.ctx).promote({ bundleId: Q, base: null, snapKey: "k-q", author: V("alice"),
    files: [{ path: "bundle.md", text: inquiryMd(Q, { subject: E1 }) }], meta: { object_type: "inquiry" } });
  assert.equal(made.ok, true, JSON.stringify(made).slice(0, 400));
  /* the inert copy an older store left on record-core's `bundles` (R3's additive column) */
  sql.exec(`UPDATE bundles SET inquiry_subject_entity=? WHERE bundle_id=?`, STALE, Q);
  const set = inquiryOf(x.ctx).setSubject({ target: Q, subject: E2, reason: "the office let the contract", viewer: "admin", author: V("alice") });
  assert.equal(set.ok, true, JSON.stringify(set).slice(0, 400));
  assert.deepEqual([set.subject, set.previous], [E2, E1]);
  return x;
}

test("notice inquiry:360 (R3, R2): a question whose subject setSubject changed keeps the new subject and its history when the store is assembled again over the same database; the stale value on bundles' additive column is not brought back", async () => {
  const x = await changed();
  const before = inquiryOf(x.ctx).subjectHistory({ id: Q, viewer: "admin" });
  assert.equal(before.ok, true, JSON.stringify(before).slice(0, 300));
  const again = await store({ db: x.db });
  const k = inquiryOf(again.ctx);
  assert.equal(k.subjectEntityOf(Q), E2);
  const h = k.subjectHistory({ id: Q, viewer: "admin" });
  assert.equal(h.subject.entity_id, E2);
  assert.deepEqual(h.changes, before.changes, "the history is the same after the second migration");
  assert.deepEqual(h.changes.map((c) => [c.act, c.from, c.to, c.part]).at(-1), ["changed", E1, E2, null]);
  const sql = again.ctx.storage.sql;
  assert.equal([...sql.exec(`SELECT ${SUBJECT_COLUMN} AS s FROM ${BUNDLE_FACTS} WHERE bundle_id=?`, Q)][0].s, E2);
  assert.equal([...sql.exec(`SELECT inquiry_subject_entity AS s FROM bundles WHERE bundle_id=?`, Q)][0].s, STALE,
    "control: the additive column is left as it was, inert; nothing in the assembly writes or reads it");
});

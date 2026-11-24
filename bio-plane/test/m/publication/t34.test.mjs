/* publication — T34 (T34-44, T34-79): this module no longer spreads case-tensions' ops (N597); the set-wide read of the
   court-order stamps (R64; N598, K1644); the group's self-description as the public is told it (R65; DEC-132 (3)); and
   when a published edition was signed and published (R70, K1826). Publishing at a set time (was R66–R69, R71 and R21's
   waiting clause here) moved with its tests to `publish-schedule` (its R1–R6; T41, K2438); R21's and R70's reads of a
   waiting edition through R77 are `t41.test.mjs`'s. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world } from "./fixture.mjs";
import { publicationOps } from "../../../src/publication/index.mjs";
import { migratePublication } from "../../../src/publication/schema.mjs";
import { caseTensionsOps } from "../../../src/case-tensions/index.mjs";

const F = "INQ-2026-0001", CASE = "CASE-2026-0001", CASE2 = "CASE-2026-0002";

/* olive owns the project; ann is an administrator; zed a member of nothing. A case edition prepared over F. */
function base({ cases = [CASE] } = {}) {
  const w = world();
  w.member("olive"); w.member("ann", { role: "admin" }); w.member("zed");
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  const roles = [{ target: F, version_sha: w.head(F) }];
  for (const c of cases) w.prepare(c, 1, { project: proj, roles });
  return { w, proj, roles };
}

/* ---------------------------------------------------------------- N597, R64, R65 */

test("N597 this module's op map no longer spreads case-tensions' ops (the plane's op map spreads them itself since T33-90)", () => {
  const { w } = base();
  const url = new URL("http://do/x");
  const mine = Object.keys(publicationOps(w.p, url, null));
  const theirs = Object.keys(caseTensionsOps(w.p.caseTensionsModule, url, null));
  assert.ok(theirs.includes("caseflags") && theirs.includes("attribute"), "the control: case-tensions' own ops");
  assert.deepEqual(mine.filter((k) => theirs.includes(k)), [], "none of case-tensions' ops is this module's");
  assert.ok(mine.includes("casedocument"), "the control: this module's own map");
  /* T41 (K2438): the three ops of publishing at a set time are publish-schedule's, no longer in this map */
  for (const op of ["publishatmove", "publishatcancel", "publishschedule"]) assert.equal(mine.includes(op), false, op);
});

test("R64 stampedEditions answers, in one read, every stamped edition in case and edition order, each edition's stamps exactly as stampsOf answers them; none stamped, editions []; it writes nothing and never throws", () => {
  const { w, proj, roles } = base({ cases: [CASE, CASE2] });
  assert.deepEqual(w.p.stampedEditions(), { ok: true, editions: [] });
  for (const c of [CASE, CASE2]) assert.equal(w.signCase(c, 1, { project: proj, roster: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha })) }).ok, true);
  w.prepare(CASE, 2, { project: proj, roles });
  w.signCase(CASE, 2, { project: proj, roster: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha })) });
  const orders = { [`${CASE2}#7`]: { seq: 7, effect: "seal" }, [`${CASE}#3`]: { seq: 3, effect: "seal" },
                   [`${CASE}#4`]: { seq: 4, effect: "unseal" }, [`${CASE}#5`]: { seq: 5, effect: "redact" } };
  w.p.registerOrderSource("docket", { courtOrderOf: (c, e) => orders[`${c}#${e}`] || null });
  /* made out of key order: CASE2 first, then CASE edition 2 before edition 1 */
  w.record.transact(() => w.p.stampEdition({ case: CASE2, editions: [1], entry: 7, effect: "seal" }));
  w.record.transact(() => w.p.stampEdition({ case: CASE, editions: [2], entry: 5, effect: "redact", parts: ["bundle.md"] }));
  w.record.transact(() => w.p.stampEdition({ case: CASE, editions: [1], entry: 4, effect: "unseal" }));
  w.record.transact(() => w.p.stampEdition({ case: CASE, editions: "all", entry: 3, effect: "seal" }));
  const before = w.snapshot();
  const all = w.p.stampedEditions();
  assert.deepEqual(w.snapshot(), before, "writes nothing");
  assert.deepEqual(all.editions.map((e) => [e.case, e.edition]), [[CASE, 1], [CASE, 2], [CASE2, 1]]);
  for (const e of all.editions)
    assert.deepEqual(e.stamps, w.p.stampsOf({ case: e.case, edition: e.edition }).stamps, `${e.case} ${e.edition}`);
  assert.deepEqual(all.editions[0].stamps.map((s) => s.entry), [4, 3], "in the order made");
  w.prepare(CASE2, 2, { project: proj, roles });
  assert.equal(all.editions.some((e) => e.case === CASE2 && e.edition === 2), false, "an edition with no stamp is not listed");
  w.st.db.exec(`DROP TABLE edition_stamps`);
  assert.doesNotThrow(() => w.p.stampedEditions());
});

test("R65 publicGroupDescription answers the public exactly membership R110's public answer: the four texts only while the latest visibility is public, else null; never the history, who or when; it writes nothing and never throws", () => {
  const { w } = base();
  assert.deepEqual(w.p.publicGroupDescription(), { description: null }, "none recorded");
  const set = (visibility) => assert.equal(w.membership.groupDescriptionSet({ kinds: ["issue", "other"], otherKind: "Tenants",
    focus: "Rents", purpose: "Fair rents", visibility, by: "ann" }).ok, true);
  set("members");
  assert.deepEqual(w.p.publicGroupDescription(), { description: null }, "kept to members");
  set("public");
  const before = w.snapshot();
  const pub = w.p.publicGroupDescription();
  assert.deepEqual(w.snapshot(), before, "writes nothing");
  assert.deepEqual(pub, { description: { kinds: ["issue", "other"], otherKind: "Tenants", focus: "Rents", purpose: "Fair rents" } });
  assert.deepEqual(pub, w.membership.groupDescription({ viewer: null }), "membership R110's public answer, exactly");
  assert.equal(/history|"by"|"at"|visibility|ann/.test(JSON.stringify(pub)), false, "no history, who or when");
  set("members");
  assert.deepEqual(w.p.publicGroupDescription(), { description: null }, "the latest choice rules");
  const real = w.p.membership;
  w.p.membership = { groupDescription() { throw new Error("down"); } };
  try { assert.deepEqual(w.p.publicGroupDescription(), { description: null }); } finally { w.p.membership = real; }
});

/* ---------------------------------------------------------------- R70 */

test("R70 R40 every published case edition answers signed_at and published_at in R53's document and R1's answer, held on its published_cases row and never null: one instant for an edition published at signing or committed before T34", () => {
  const { w, proj, roles } = base({ cases: [CASE] });
  const roster = roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha }));
  /* published at signing (no source of waiting editions registered: R77) */
  w.signCase(CASE, 1, { project: proj, roster, at: "2026-09-28T02:00:00Z" });
  w.signFinding(F);
  const d1 = w.p.caseEditionState(CASE, 1).document;
  assert.deepEqual([d1.signed_at, d1.published_at, d1.ratified_at], ["2026-09-28T02:00:00Z", "2026-09-28T02:00:00Z", "2026-09-28T02:00:00Z"]);
  const r1 = w.p.caseDocument(CASE, 1, null);
  assert.deepEqual([r1.signed_at, r1.published_at], ["2026-09-28T02:00:00Z", "2026-09-28T02:00:00Z"]);
  assert.deepEqual(w.rows(`SELECT case_id, signed_at, published_at FROM published_cases ORDER BY case_id`),
                   [{ case_id: CASE, signed_at: "2026-09-28T02:00:00Z", published_at: "2026-09-28T02:00:00Z" }]);
  /* an unsigned preparation answers neither */
  w.prepare(CASE2, 1, { project: proj, roles });
  assert.deepEqual([w.p.caseDocument(CASE2, 1, "class:daemon").signed_at, w.p.caseDocument(CASE2, 1, "class:daemon").published_at], [null, null]);
  /* committed before T34: the migration fills its row with its ratification instant in both */
  w.prepare(CASE, 2, { project: proj, roles });
  w.signLegacy(CASE, 2, { project: proj, roster, at: "2026-01-01T00:00:00Z" });
  w.st.sql.exec(`UPDATE published_cases SET ratified_at=? WHERE case_id=? AND edition=2`, "2026-01-02T00:00:00Z", CASE);
  assert.deepEqual(w.row(`SELECT signed_at, published_at FROM published_cases WHERE case_id=? AND edition=2`, CASE),
                   { signed_at: null, published_at: null }, "the control: as an old store holds it");
  migratePublication(w.st.sql);
  assert.deepEqual(w.row(`SELECT signed_at, published_at FROM published_cases WHERE case_id=? AND edition=2`, CASE),
                   { signed_at: "2026-01-02T00:00:00Z", published_at: "2026-01-02T00:00:00Z" });
  const d3 = w.p.caseDocument(CASE, 2, null);
  assert.deepEqual([d3.signed_at, d3.published_at], ["2026-01-02T00:00:00Z", "2026-01-02T00:00:00Z"]);
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM published_cases WHERE signed_at IS NULL OR published_at IS NULL`).n, 0);
  migratePublication(w.st.sql);
  assert.deepEqual(w.p.caseDocument(CASE, 2, null), d3, "every later boot changes nothing");
});

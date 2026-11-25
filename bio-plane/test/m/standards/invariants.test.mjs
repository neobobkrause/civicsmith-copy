/* standards: its invariants (R11–R15). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, world, V, MACHINE, BYLAW, REASON } from "./fixture.mjs";
import { STANDARDS_CHECKS, STANDARD_KINDS, STANDARDS_TABLES } from "../../../src/standards/index.mjs";
import { get as profileOf } from "../../../../jurisdictions/index.mjs";

const TABLES = ["standards", "standard_texts", "standard_proposals", "standard_adoptions", "standard_forces",
                "standard_force_withdrawals", "standard_force_proposals", "standard_overrides", "standard_releases",
                "standard_body_adoptions", "standard_impositions", "standard_benchmarks", "standard_in_force_through",
                "standard_in_force_through_withdrawals"];

test("R11 nothing a machine writes is a standard: R1 and R10 by a member are its only writers; a raw promotion of a standard, by a member or a machine, and any revision of one are refused STANDARD_WRITTEN_ELSEWHERE; a replay is admitted", () => {
  const w = seeded();
  const text = w.passage().contentId;
  assert.equal(w.s.standardDeclare({ cite: BYLAW, kind: "ordinance", issuer: "S", reason: REASON, text, author: MACHINE }).reason, "MACHINE_CANNOT_DECLARE_STANDARD");
  const p = w.s.standardPropose({ cite: BYLAW, why: "w", proposer: MACHINE });
  assert.equal(p.ok, true, "a machine proposes");
  assert.equal(w.s.standardAdopt({ proposal: p.proposal.id, reason: REASON, author: MACHINE }).reason, "MACHINE_CANNOT_DECLARE_STANDARD");
  assert.equal(w.count("standards"), 0);
  const r = w.declare();
  const doc = w.record.readFile(r.id, "bundle.md").text;
  /* a raw creation of a standard, by a member and by a machine */
  for (const author of [V("bob"), MACHINE]) {
    const raw = w.promotion.promote({ bundleId: "STD-2026-0099-ordinance", base: null, snapKey: `raw-${author}`, author,
      files: [{ path: "bundle.md", text: doc.replaceAll(r.id, "STD-2026-0099-ordinance") }], meta: {} });
    assert.equal(raw.reason, "STANDARD_WRITTEN_ELSEWHERE", author);
    assert.equal(raw.check, STANDARDS_CHECKS.STANDARD_WRITTEN_ELSEWHERE.check);
  }
  assert.equal(w.record.head("STD-2026-0099-ordinance"), null);
  /* a revision, even one that changes nothing but the date */
  const head = w.record.head(r.id);
  const rev = w.promotion.promote({ bundleId: r.id, base: head.bundleSha, snapKey: "rev", author: V("bob"),
                                    files: [{ path: "bundle.md", text: doc }], meta: {} });
  assert.equal(rev.reason, "STANDARD_WRITTEN_ELSEWHERE");
  assert.equal(w.record.head(r.id).bundleSha, head.bundleSha);
  /* a replay (a restore of the record's own history) is admitted */
  const replay = w.promotion.promote({ bundleId: "STD-2026-0098-ordinance", base: null, snapKey: "replay", author: V("bob"),
    replay: true, files: [{ path: "bundle.md", text: doc.replaceAll(r.id, "STD-2026-0098-ordinance") }], meta: {} });
  assert.equal(replay.ok, true, JSON.stringify(replay).slice(0, 300));
  /* the check governs standards only */
  assert.equal(w.passage().contentId.length, 64, "other types are untouched");
});

test("R12 no service accepts or answers a judgment of a standard's merit: a field outside each act's own is refused STANDARD_FIELD_UNKNOWN by name, the seven kinds are the whole vocabulary, and no answer carries a judgment", () => {
  const w = seeded();
  const text = w.passage().contentId;
  const good = { cite: BYLAW, kind: "ordinance", issuer: "S", reason: REASON, text, author: V("bob") };
  for (const extra of [{ merit: "strong" }, { desirable: true }, { rating: 3 }, { weight: 1 }]) {
    const r = w.s.standardDeclare({ ...good, ...extra });
    assert.equal(r.reason, "STANDARD_FIELD_UNKNOWN", Object.keys(extra)[0]);
    assert.deepEqual(r.rejected, Object.keys(extra));
    assert.equal(r.check, STANDARDS_CHECKS.STANDARD_FIELD_UNKNOWN.check);
  }
  const p = w.s.standardPropose({ cite: BYLAW, why: "w", proposer: V("carol") }).proposal;
  assert.equal(w.s.standardAdopt({ proposal: p.id, author: V("bob"), reason: REASON, merit: "high" }).reason, "STANDARD_FIELD_UNKNOWN");
  assert.deepEqual(STANDARD_KINDS, ["statute", "regulation", "ordinance", "court", "policy", "commitment", "standard"]);
  const r = w.s.standardDeclare(good);
  const keys = new Set(["ok", "id", "cite", "kind", "issuer", "reason", "text", "period", "source", "declared_by", "declared_at",
                        "supersedes", "superseded_by", "proposal", "bundleSha", "texts", "says", "instrument", "portion",
                        "requires", "copy", "current_through", "period_basis", "requires_quoted", "family", "owner", "held",
                        "version_basis", "overrides", "force_source", "designation", "edition", "designation_read", "edition_read", "access", "target", "question",
                        "sight", "in_force_through", "bindings"]);
  for (const answer of [r, w.s.standardRead({ id: r.id, viewer: V("carol") }), w.s.standardsIn({ viewer: V("carol") }).items[0]])
    for (const k of Object.keys(answer)) assert.ok(keys.has(k), `an answer carries only what the record holds: ${k}`);
  const words = /\b(merit|desirab|good law|bad law|unjust|fair|rating|score)\w*/i;
  const outward = [...Object.values(STANDARDS_CHECKS).map((c) => c.translation), w.s.standardRead({ id: r.id, viewer: V("carol") }).says.note];
  /* the only mentions are the two that say the record holds none */
  const denials = /never whether it is a good one|never a view of its merit/g;
  for (const t of outward) assert.ok(!words.test(t.replace(denials, "")), t);
});

test("R13 a fact the profile does not supply is undetermined, never a default; no place is named in this module's behaviour or outward text; the tests run against the test profile", () => {
  const w = seeded({ profiles: null });
  const r = w.declare({ cite: "Any Code § 1" });
  assert.deepEqual([r.source.state, typeof r.source.why], ["undetermined", "string"]);
  assert.equal(r.source.level, undefined, "no level is invented");
  const t = seeded();
  const m = t.declare();
  assert.equal(m.source.profile, "test-port-ellery", "the facts come from the test profile's data");
  /* no place in the module's outward text: its translations, its sentences and every why it composes */
  const places = profileOf("oakland-alameda").covers.flatMap((c) => c.split(/[ ,]+/)).filter((x) => x.length > 3);
  const u = t.declare({ cite: "Unmatched § 9" });
  const texts = [...Object.values(STANDARDS_CHECKS).map((c) => c.translation), u.source.why,
                 t.s.standardRead({ id: m.id, viewer: V("carol") }).says.note, t.s.inForce(m.id, "2021-01-01").why,
                 t.s.standardPropose({ cite: BYLAW, why: "w", proposer: V("carol") }).says];
  for (const s of texts) for (const place of [...places, "Oakland", "Alameda"]) assert.ok(!s.includes(place), `${place} in: ${s}`);
});

test("R14 declarations, supersessions, proposals and adoptions are append-only, and each table is declared to record-core's purge", () => {
  const w = seeded();
  const text = w.passage().contentId;
  const mine = () => Object.fromEntries(TABLES.map((t) => [t, w.rows(`SELECT * FROM ${t}`)]));
  const acts = [
    () => w.declare({ text }),
    () => w.declare({ text, supersedes: w.rows("SELECT standard_id FROM standards")[0].standard_id }),
    () => w.s.standardPropose({ cite: BYLAW, why: "w", proposer: MACHINE }),
    () => w.s.standardAdopt({ proposal: w.rows("SELECT proposal_id FROM standard_proposals")[0].proposal_id, author: V("bob"),
                              kind: "ordinance", issuer: "S", reason: REASON, text }),
    () => w.s.standardRead({ id: w.rows("SELECT standard_id FROM standards")[0].standard_id, viewer: V("carol") }),
    () => w.s.standardsIn({ viewer: V("carol"), at: "2021-01-01" }),
  ];
  let prev = mine();
  for (const act of acts) {
    assert.notEqual(act().ok, false);
    const now = mine();
    for (const t of TABLES) assert.deepEqual(now[t].slice(0, prev[t].length), prev[t], `${t}: an earlier row is unchanged`);
    prev = now;
  }
  assert.deepEqual(TABLES.map((t) => prev[t].length), [3, 3, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  /* a single-bundle purge clears one standard's rows; the whole-store form every row */
  const id = prev.standards[0].standard_id;
  const one = w.record.purge({ bundleId: id });
  assert.deepEqual([one.removed.standards, one.removed.standard_texts], [1, 1]);
  const all = w.record.purge({});
  for (const t of TABLES) assert.ok(t in all.removed, `${t} is declared`);
  for (const t of TABLES) assert.equal(w.count(t), 0);
  assert.deepEqual(STANDARDS_TABLES.map((t) => t.name), TABLES);
});

test("R15 a standard is a record object of its own type: promoted through promotion outside any project, with history, audit and export like an inquiry; a correction is a new standard that supersedes it", async () => {
  const w = seeded();
  const r = w.declare();
  assert.match(r.id, /^STD-2026-\d{4}-ordinance$/);
  assert.deepEqual(w.record.bundleInfo(r.id), { id: r.id, type: "standard", title: BYLAW, project: null },
                   "a bundle of type standard, outside any project (K171 (12))");
  const fm = w.fm(r.id);
  assert.deepEqual([fm.object_type, fm.current_state, fm.kind, fm.author], ["standard", "recorded", "ordinance", V("bob")]);
  /* history and export: the manifest records the promotion, the image carries the document */
  const img = w.record.readImage(r.id);
  const manifest = JSON.parse(img["_history/manifest.json"]);
  assert.equal(manifest.entries.length, 1);
  assert.equal(manifest.entries[0].author, V("bob"));
  assert.match(img["bundle.md"].text ?? img["bundle.md"], /## Citation\n\nPEBL § 12/);
  /* the audit runs the catalogue over it, clean */
  const audit = await w.record.auditPass({ after: "STD-", limit: 10, visible: () => true });
  assert.deepEqual(audit.page, [r.id]);
  assert.equal(audit.clean, 1, JSON.stringify(audit.offenders));
  /* seen as every member sees a bundle outside a project */
  assert.equal(w.membership.inSight(r.id, V("carol")), true);
  /* a correction is a new standard naming it */
  const fix = w.declare({ supersedes: r.id });
  assert.equal(w.fm(fix.id).supersedes, r.id);
  assert.equal(w.record.head(r.id).rowVersion, 1, "the first is never revised");
});

test("R16 constructing the instance creates every table it declares to purge, so every service and record-core's purge succeed after construction with no caller calling migrate()", () => {
  const w = world({ construct: false });
  w.member("bob");
  w.member("carol");
  const tables = () => new Set(w.rows(`SELECT name FROM sqlite_master WHERE type='table'`).map((r) => r.name));
  for (const t of TABLES) assert.ok(!tables().has(t), `${t} is not there before construction`);
  const s = w.build();
  for (const t of STANDARDS_TABLES.map((x) => x.name)) assert.ok(tables().has(t), `${t} exists once constructed`);
  /* the purge record-core runs over the declared tables succeeds, and so does every service */
  const empty = w.record.purge({});
  assert.notEqual(empty.ok, false, JSON.stringify(empty).slice(0, 300));
  for (const t of TABLES) assert.ok(t in empty.removed, `${t} is purged`);
  const text = w.passage().contentId;
  const r = s.standardDeclare({ cite: BYLAW, kind: "ordinance", issuer: "S", reason: REASON, text, author: V("bob"), viewer: V("bob") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.equal(s.standardRead({ id: r.id, viewer: V("carol") }).ok, true);
  assert.equal(s.inForce(r.id, "2021-01-01").ok, true);
  assert.equal(s.standardsIn({ viewer: V("carol") }).count, 1);
  const p = s.standardPropose({ cite: BYLAW, why: "w", proposer: MACHINE });
  assert.equal(p.ok, true);
  assert.equal(s.standardAdopt({ proposal: p.proposal.id, author: V("bob"), kind: "ordinance", issuer: "S", reason: REASON, text }).ok, true);
  const one = w.record.purge({ bundleId: r.id });
  assert.notEqual(one.ok, false);
  assert.equal(one.removed.standards, 1);
  assert.notEqual(w.record.purge({}).ok, false);
  /* the one instance per host: a later call answers it, and an explicit migrate() still changes nothing */
  assert.equal(w.build(), s);
  s.migrate();
  assert.deepEqual([...tables()].filter((t) => TABLES.includes(t)).sort(), [...TABLES].sort());
});

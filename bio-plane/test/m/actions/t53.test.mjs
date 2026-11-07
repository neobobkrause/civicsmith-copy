/* actions' T53 entry at its interface (N1257; DEC-404; K5458; `jurisdictions` R118's test forest, R121's resolution of a
   stored name): R112 an action's clock is read in the office's zone, else its layer's, else the team's, and says which;
   R113 a governing law is stored with its layer; R114 a records request's law is read in its layer; R115 an addressed
   office is stored with its layer; R116 a move to `resolved` names its resolution. The layers are `jurisdictions`' own
   published forest (its R118), each copied and given what a test needs (a second office or law of one name), and handed
   to `actions` through its profile reader; the setting names them by id, as it names held profiles. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, actionMd } from "./fixture.mjs";
import { FOREST, forestCopy } from "../../../../jurisdictions/test/fixtures/forest.mjs";
import * as grammar from "../../../src/action-grammar/index.mjs";

const M = V("alice");
const R = "TEST";
const [FED, STATE, COUNTY_A, COUNTY_B, CITY_A, CITY_B] =
  ["forest-federal", "forest-state", "forest-county-a", "forest-county-b", "forest-city-a", "forest-city-b"];

/** The forest's layers by id, each a copy a test may change. */
function forest(change = {}) {
  const by = new Map(forestCopy(FOREST.all).map((l) => [l.id, l]));
  for (const [id, f] of Object.entries(change)) f(by.get(id));
  return by;
}
/** A world whose setting names `ids`, read through the forest `by` (and the held profiles for any other id). */
function forestWorld(by, ids, extra = {}) {
  return world({ profiles: ids, deps: { profiles: (id) => by.get(id) ?? null }, ...extra });
}
const office = (role, body, more = []) => ["counterparty:", "  state: named", `  role: ${role}`, `  body: "${body}"`, ...more];
const created = (md, at) => md.replace('created: "2026-09-01T00:00:00Z"', `created: "${at}"`);
const addClerk = (l) => { (l.counterparties ||= []).push({ role: "Clerk", body: "City", level: "city", elected: false, basis: R }); };

/* ------------------------------------------------------------------------------------------------ R112, R115: the zone */

const ZONED = forest({
  [FED]: (l) => { l.counterparties = [{ role: "Records Officer", body: "Fed Records Office", level: "federal", elected: false, basis: R }]; },
  [CITY_A]: (l) => { addClerk(l); l.counterparties[0].time_zone = { value: "America/Denver", status: "researched", basis: R }; },
  [CITY_B]: (l) => { addClerk(l); l.time_zone = { value: "America/New_York", status: "researched", basis: R }; },
});
const ZONE_IDS = [FED, STATE, COUNTY_A, COUNTY_B, CITY_A, CITY_B];

test("R112 R115 the clock is read in the office's own zone, else its layer's (on its branch), else the team's, and the read says which", () => {
  const w = forestWorld(ZONED, ZONE_IDS);
  w.record.setSetting("team_time_zone", "America/Phoenix", V("admin"));
  const zone = (id, cp) => {
    const r = w.promote(id, actionMd(id, [...cp, "action_kind: records_request"]));
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    return w.a.actionRead({ id, viewer: M }).clock_zone;
  };
  const pick = (z) => [z.zone, z.from, z.layer, z.why];
  /* the Mayor's office states its own zone */
  assert.deepEqual(pick(zone("ACTN-2026-0001-a", office("Mayor", "Aburg Mayor's Office"))),
    ["America/Denver", "office", CITY_A, "actions.zone.office"]);
  /* the county clerk states none: its layer's branch does (the state-like layer's) */
  assert.deepEqual(pick(zone("ACTN-2026-0002-a", office("Clerk", "Aville County Clerk"))),
    ["America/Chicago", "layer", COUNTY_A, "actions.zone.layer"]);
  /* R115: the second city's clerk, its layer stated, is read in the second city's zone */
  assert.deepEqual(pick(zone("ACTN-2026-0003-a", office("Clerk", "City", [`  layer: ${CITY_B}`]))),
    ["America/New_York", "layer", CITY_B, "actions.zone.layer"]);
  /* a federal office states no zone, nor does its layer: the team's zone, and the read says so */
  const fed = zone("ACTN-2026-0004-a", office("Records Officer", "Fed Records Office"));
  assert.deepEqual(pick(fed), ["America/Phoenix", "team", FED, "actions.zone.team"]);
  assert.ok(typeof fed.says === "string" && fed.says.includes("America/Phoenix"));
});

test("R115 an office two active layers give, with no layer stated, is NAME_AMBIGUOUS and its zone undetermined, never the first's", () => {
  const w = forestWorld(ZONED, ZONE_IDS);
  w.record.setSetting("team_time_zone", "America/Phoenix", V("admin"));
  const A = "ACTN-2026-0005-a";
  assert.equal(w.promote(A, actionMd(A, [...office("Clerk", "City"), "action_kind: records_request",
    "clock:", '  - text: "t"', '    description: "d"', "    date: 2020-01-01", "    basis: s", "    status: pending"])).ok, true);
  const read = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual([read.clock_zone.zone, read.clock_zone.from, read.clock_zone.why], [null, null, "actions.zone.ambiguous"]);
  assert.equal(read.clock_zone.ambiguous.reason, "NAME_AMBIGUOUS");
  assert.deepEqual(read.clock_zone.ambiguous.layers.map((l) => l.layer), [CITY_A, CITY_B]);
  assert.equal(read.clock_overdue, null, "a past pending date is undetermined with no zone, never the team's or UTC");
  /* control: the same office with its layer stated reads that layer's zone, and is overdue */
  const B = "ACTN-2026-0006-a";
  assert.equal(w.promote(B, actionMd(B, [...office("Clerk", "City", [`  layer: ${CITY_A}`]), "action_kind: records_request",
    "clock:", '  - text: "t"', '    description: "d"', "    date: 2020-01-01", "    basis: s", "    status: pending"])).ok, true);
  const b = w.a.actionRead({ id: B, viewer: M });
  assert.deepEqual([b.clock_zone.zone, b.clock_zone.layer, b.clock_overdue], ["America/Chicago", CITY_A, true]);
});

test("R112 control: with no zone held anywhere (no office's, no layer's, no team's) the day is undetermined", () => {
  const w = forestWorld(ZONED, [FED]);
  const A = "ACTN-2026-0007-a";
  assert.equal(w.promote(A, actionMd(A, [...office("Records Officer", "Fed Records Office"), "action_kind: records_request",
    "clock:", '  - text: "t"', '    description: "d"', "    date: 2020-01-01", "    basis: s", "    status: pending"])).ok, true);
  const read = w.a.actionRead({ id: A, viewer: M });
  assert.deepEqual([read.clock_zone.zone, read.clock_zone.from, read.clock_zone.why, read.clock_overdue],
    [null, null, "actions.zone.undetermined", null]);
});

test("R115 an office arm carries its layer by id; another arm carrying one, or a malformed one, is COUNTERPARTY_REFUSED; an office written without one keeps its bytes", () => {
  const w = forestWorld(ZONED, ZONE_IDS);
  const at = (id, cp) => w.promote(id, actionMd(id, [...cp, "action_kind: records_request"]));
  const ok = at("ACTN-2026-0011-a", office("Clerk", "City", [`  layer: ${CITY_B}`]));
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.equal(w.fm("ACTN-2026-0011-a").counterparty.layer, CITY_B);
  const press = at("ACTN-2026-0012-a", ["counterparty:", "  state: named", "  kind: press", "  role: Reporter",
    "  organisation: The Daily", `  layer: ${CITY_B}`]);
  assert.equal(press.reason, "COUNTERPARTY_REFUSED");
  assert.match(press.findings[0].detail, /arm: layer/);
  assert.equal(at("ACTN-2026-0013-a", office("Clerk", "City", [`  layer: "${"x".repeat(grammar.LAW_LAYER_MAX + 1)}"`])).reason,
    "COUNTERPARTY_REFUSED");
  /* control: an office addressed with no layer keeps its counterparty bytes, and one layer giving it reads that layer */
  const plain = at("ACTN-2026-0014-a", office("Mayor", "Aburg Mayor's Office"));
  assert.equal(plain.ok, true);
  assert.deepEqual(w.fm("ACTN-2026-0014-a").counterparty, { state: "named", role: "Mayor", body: "Aburg Mayor's Office" });
  assert.equal(w.a.actionRead({ id: "ACTN-2026-0014-a", viewer: M }).clock_zone.layer, CITY_A);
});

/* ------------------------------------------------------------------------------------------------ R113: governing laws */

/* the second county-like layer gives the first's law under the same citation */
const TWO_COUNTIES = forest({ [COUNTY_B]: (l) => {
  l.records_laws.push({ ...structuredClone(FOREST.chain[2].records_laws[0]), response: l.records_laws[0].response });
} });
const LAW_IDS = [FED, STATE, COUNTY_A, COUNTY_B];
const AVILLE = FOREST.chain[2].records_laws[0].citation;

test("R113 a governing law whose citation two active layers give at its level is NAME_AMBIGUOUS naming both until its layer is sent; sent, the document holds it", () => {
  const w = forestWorld(TWO_COUNTIES, LAW_IDS);
  const A = "ACTN-2026-0021-a";
  w.action(A);
  const L = (laws) => w.a.actionLaws({ target: A, laws, viewer: M, author: M });
  const amb = L([{ level: "county", citation: AVILLE }]);
  assert.deepEqual([amb.ok, amb.reason, amb.index], [false, "NAME_AMBIGUOUS", 0]);
  assert.deepEqual(amb.layers.map((l) => l.layer), [COUNTY_A, COUNTY_B]);
  assert.equal(w.fm(A).governing_laws, undefined, "nothing was written");
  const set = L([{ level: "county", citation: AVILLE, layer: COUNTY_B }]);
  assert.equal(set.ok, true, JSON.stringify(set));
  assert.equal(set.laws[0].layer, COUNTY_B);
  assert.equal(w.fm(A).governing_laws[0].layer, COUNTY_B);
  assert.deepEqual(grammar.governingLawsOf(w.fm(A)).laws, [{ level: "county", citation: AVILLE, layer: COUNTY_B }]);
});

test("R113 the refusals in order: BAD_LAW_LEVEL first, then NAME_AMBIGUOUS before the rest of the entry's shape; a layer not at the entry's level is BAD_LAW_LEVEL naming the index", () => {
  const w = forestWorld(TWO_COUNTIES, LAW_IDS);
  const A = "ACTN-2026-0022-a";
  w.action(A);
  const L = (laws) => w.a.actionLaws({ target: A, laws, viewer: M, author: M });
  assert.equal(L([{ level: "county", citation: AVILLE }, { level: "local", citation: "x" }]).reason, "BAD_LAW_LEVEL");
  const before = L([{ level: "county", citation: AVILLE }, { level: "city", citation: "" }]);
  assert.deepEqual([before.reason, before.index], ["NAME_AMBIGUOUS", 0], "before BAD_CITATION");
  const city = L([{ level: "state", citation: "State Records Act § 1" }, { level: "county", citation: AVILLE, layer: CITY_A }]);
  assert.deepEqual([city.reason, city.index, city.layer, city.check], ["BAD_LAW_LEVEL", 1, CITY_A, grammar.GOVERNING_LAW_CHECKS.BAD_LAW_LEVEL.check]);
  assert.deepEqual([L([{ level: "county", citation: AVILLE, layer: "nowhere" }]).reason,
                    L([{ level: "county", citation: AVILLE, layer: 'a"b' }]).reason], ["BAD_LAW_LEVEL", "BAD_LAW_LEVEL"]);
});

test("R113 R2 control: a list written without a layer reads, compares and replays byte-identically with none; a layer added outside the act is GOVERNING_LAWS_REWRITTEN", () => {
  const w = forestWorld(TWO_COUNTIES, LAW_IDS);
  const A = "ACTN-2026-0023-a";
  w.action(A);
  /* beside the refused case: the ambiguous citation with no layer writes nothing */
  assert.equal(w.a.actionLaws({ target: A, laws: [{ level: "county", citation: AVILLE }], viewer: M, author: M }).reason, "NAME_AMBIGUOUS");
  const set = w.a.actionLaws({ target: A, laws: [{ level: "state", citation: "State Records Act § 1" }], viewer: M, author: M });
  assert.equal(set.ok, true, JSON.stringify(set));
  assert.deepEqual(set.laws, [{ level: "state", citation: "State Records Act § 1" }], "one layer gives it: written with no layer");
  const text = w.text(A);
  assert.doesNotMatch(text, /^\s+layer:/m);
  assert.deepEqual(w.fm(A).governing_laws, [{ level: "state", citation: "State Records Act § 1" }]);
  assert.deepEqual(grammar.governingLawsOf(w.fm(A)).laws, [{ level: "state", citation: "State Records Act § 1", layer: null }]);
  /* a revision carrying the block forward lands; one adding the layer outside the act is refused */
  assert.equal(w.promote(A, text.replace("title: ", "title: again ")).ok, true);
  const added = w.promote(A, w.text(A).replace('citation: "State Records Act § 1"', `citation: "State Records Act § 1"\n    layer: "${STATE}"`));
  assert.equal(added.reason, "GOVERNING_LAWS_REWRITTEN");
});

/* ------------------------------------------------------------------------------------------------ R114: the records law */

/* the first city's law lists two stages; a second city later gives a law of the same name listing one */
const SUNSHINE = FOREST.chain[3].records_laws[0].name;
const STAGED = forest({
  [CITY_A]: (l) => { l.records_laws[0].stages.push({ stage: "fee_waiver_request", label: "fee waiver", citation: "Aburg Sunshine Rule § 5" }); },
  [CITY_B]: (l) => { l.records_laws.push({ ...structuredClone(FOREST.chain[3].records_laws[0]), citation: "Bburg copy § 1",
    response: l.records_laws[0].response }); },
});

test("R114 a request's law is read in its law_layer, and with none in the layers active on its creation date; two of one name then are undetermined with NAME_AMBIGUOUS, never the first", () => {
  const w = forestWorld(STAGED, [FED, STATE, COUNTY_A, CITY_A]);
  w.record.setSetting("jurisdiction_profiles", [FED, STATE, COUNTY_A, COUNTY_B, CITY_A, CITY_B], V("admin"));
  /* the first set was in force from August, the second from October (record-core R92 reads them by date) */
  const rows = w.rows(`SELECT rowid FROM settings WHERE name='jurisdiction_profiles' ORDER BY rowid`).map((r) => r.rowid);
  w.st.db.prepare(`UPDATE settings SET set_at=? WHERE rowid=?`).run("2026-08-01T00:00:00.000Z", rows[0]);
  w.st.db.prepare(`UPDATE settings SET set_at=? WHERE rowid=?`).run("2026-10-01T00:00:00.000Z", rows[1]);
  const req = (id, lines, at) => {
    const r = w.promote(id, created(actionMd(id, [...office("Mayor", "Aburg Mayor's Office"), "action_kind: records_request",
      `law: "${SUNSHINE}"`, ...lines]), at));
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  };
  const c = (id, x) => w.a.actionCorrespond({ target: id, direction: "sent", at: "2026-10-20", account: "asked", viewer: M, author: M, ...x });
  const A = "ACTN-2026-0031-a", B = "ACTN-2026-0032-a", C = "ACTN-2026-0033-a", D = "ACTN-2026-0034-a";
  req(A, [`law_layer: ${CITY_A}`], "2026-10-15T00:00:00Z");
  req(B, [], "2026-09-01T00:00:00Z");
  req(C, [], "2026-10-15T00:00:00Z");
  req(D, [`law_layer: ${CITY_B}`], "2026-10-15T00:00:00Z");
  /* its layer stated: the first city's stages, after the second city gives a law of that name */
  assert.equal(c(A, { stage: "request" }).ok, true);
  assert.equal(c(A, { stage: "fee_waiver_request", follows: "0" }).ok, true);
  /* the second city's request names its own law, which lists one stage */
  assert.equal(c(D, { stage: "request" }).ok, true);
  assert.deepEqual(c(D, { stage: "fee_waiver_request", follows: "0" }).reason, "STAGE_NOT_IN_LAW");
  /* none stated, made in October: two layers give the name, so undetermined with NAME_AMBIGUOUS and both layers */
  assert.equal(c(C, { stage: "request" }).ok, true);
  const amb = w.a.actionRead({ id: C, viewer: M }).entries[0];
  assert.deepEqual([amb.stage_in_law, amb.law_ambiguous.reason, amb.law_ambiguous.layers.map((l) => l.layer)],
    ["undetermined", "NAME_AMBIGUOUS", [CITY_A, CITY_B]]);
  /* control: none stated, made in September: the one city of then, the same stages as before; its document not rewritten */
  const bytes = w.text(B);
  assert.equal(c(B, { stage: "request" }).ok, true);
  assert.equal(c(B, { stage: "fee_waiver_request", follows: "0" }).ok, true);
  assert.deepEqual(w.a.actionRead({ id: B, viewer: M }).entries.map((e) => e.stage_in_law), ["in_law", "in_law"]);
  assert.equal(w.fm(B).law_layer, undefined);
  assert.equal(bytes.includes("law_layer"), false);
  assert.equal(w.a.actionRead({ id: A, viewer: M }).records_law.law_layer, CITY_A);
});

test("R114 R5 law_layer is a member's, with the law: a machine may not state or change it; one with no law, or malformed, is RECORDS_LAW_REFUSED", () => {
  const w = forestWorld(STAGED, [FED, STATE, COUNTY_A, CITY_A]);
  const md = (id, lines) => actionMd(id, [...office("Mayor", "Aburg Mayor's Office"), "action_kind: records_request", ...lines]);
  const A = "ACTN-2026-0035-a";
  assert.equal(w.promote(A, md(A, [`law: "${SUNSHINE}"`])).ok, true);
  const machine = w.promote(A, md(A, [`law: "${SUNSHINE}"`, `law_layer: ${CITY_A}`]), { author: "class:daemon" });
  assert.equal(machine.reason, "MACHINE_CANNOT_STATE_RECORDS_LAW");
  assert.equal(w.promote(A, md(A, [`law: "${SUNSHINE}"`, `law_layer: ${CITY_A}`])).ok, true, "a member states it");
  assert.equal(w.promote(A, md(A, [`law: "${SUNSHINE}"`, `law_layer: ${CITY_B}`]), { author: "class:daemon" }).reason,
    "MACHINE_CANNOT_STATE_RECORDS_LAW", "nor change it");
  assert.equal(w.promote("ACTN-2026-0036-a", md("ACTN-2026-0036-a", [`law_layer: ${CITY_A}`])).reason, "RECORDS_LAW_REFUSED");
  assert.equal(w.promote("ACTN-2026-0037-a", md("ACTN-2026-0037-a", [`law: "${SUNSHINE}"`,
    `law_layer: "${"x".repeat(grammar.LAW_LAYER_MAX + 1)}"`])).reason, "RECORDS_LAW_REFUSED");
});

/* ------------------------------------------------------------------------------------------------ R116: resolved */

test("R116 a move to resolved with no resolution is refused naming the resolution; none is defaulted; with one it records it", () => {
  const w = world();
  const A = "ACTN-2026-0041-a";
  w.action(A);
  const mv = (x) => w.a.actionMove({ target: A, to: "active", reason: "go", viewer: M, author: M, ...x });
  assert.equal(mv({}).ok, true);
  for (const resolution of [undefined, "", "  ", "done"]) {
    const no = mv({ to: "resolved", resolution });
    assert.deepEqual([no.ok, no.reason, no.legal], [false, "NO_RESOLUTION", [...grammar.RESOLUTIONS]], String(resolution));
    assert.match(no.detail, /resolved/);
  }
  assert.equal(w.fm(A).current_state, "active", "nothing moved");
  assert.equal(w.fm(A).resolution, undefined, "none defaulted");
  const done = mv({ to: "resolved", resolution: "withdrawn" });
  assert.deepEqual([done.ok, done.resolution], [true, "withdrawn"]);
  assert.deepEqual([w.fm(A).current_state, w.fm(A).resolution], ["resolved", "withdrawn"]);
});

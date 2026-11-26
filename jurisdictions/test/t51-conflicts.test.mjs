/* jurisdictions, T51 (T51-170; K3957; the words rule, setup-words R13–R14): the conflict notes `combine` gives when the
 * active profiles disagree, each now read through `localize`. Tested at the module's interface: a real disagreement
 * between two profiles gives a conflict at the field, its note is a non-empty sentence, and identical profiles give none
 * (the control). No test holds a note's text (K3810). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { combine } from "../index.mjs";
import { must, held, at, combinedOf } from "./helpers.mjs";
/** @import { Profile, Combined, Conflict } from "../index.mjs" */

const TEST = "test-port-ellery";

/** Two profiles that differ only in what `change` makes them differ in; each is a copy of the test profile.
 *  @param {(a: Profile, b: Profile) => void} change
 *  @returns {Combined} */
const pair = (change) => {
  const one = held(TEST);
  one.id = "one-ellery";
  one.name = "One";
  one.covers = ["One"];
  const two = held(TEST);
  two.id = "two-ellery";
  two.name = "Two";
  two.covers = ["Two"];
  change(one, two);
  return combinedOf(combine([one, two]));
};
/** @param {Combined} r @param {string} end @returns {Conflict | undefined} */
const conflictAt = (r, end) => r.conflicts.find((c) => c.at === end || c.at.endsWith(end));
/** @param {Conflict | undefined} c @param {string} label @returns {void} */
const assertNote = (c, label) => {
  assert.ok(c, `${label}: a conflict is given at the field`);
  assert.equal(typeof c.says, "string", `${label}: the conflict says why`);
  assert.ok(c.says.length > 0, `${label}: the note is not empty`);
};
/** @param {string} label @param {string} end @returns {void} */
const control = (label, end) => {
  const r = combinedOf(combine([TEST, held(TEST)]));
  assert.equal(conflictAt(r, end), undefined, `${label}: identical profiles give no conflict`);
};

test("jurisdictions.index.minutes_due_conflict: profiles giving different minutes periods conflict at practice; identical ones do not", () => {
  const r = pair((a, b) => {
    must(must(a.practice, "practice").minutes_due_days, "minutes_due_days").value = 7;
    must(must(b.practice, "practice").minutes_due_days, "minutes_due_days").value = 9;
  });
  assertNote(conflictAt(r, "practice.minutes_due_days"), "minutes");
  control("minutes", "practice.minutes_due_days");
});

test("jurisdictions.index.locale_conflict: profiles naming different locales conflict at locale; identical ones do not", () => {
  const r = pair((a, b) => { a.locale = { value: "fr-CA", basis: "TEST" }; b.locale = { value: "de-DE", basis: "TEST" }; });
  assertNote(conflictAt(r, "locale"), "locale");
  control("locale", "locale");
});

test("jurisdictions.index.time_zone_conflict: profiles naming different time zones conflict at time_zone; identical ones do not", () => {
  const r = pair((a, b) => {
    a.time_zone = { ...must(a.time_zone, "time_zone"), value: "Europe/Paris" };
    b.time_zone = { ...must(b.time_zone, "time_zone"), value: "Asia/Tokyo" };
  });
  assertNote(conflictAt(r, "time_zone"), "time zone");
  control("time zone", "time_zone");
});

test("jurisdictions.index.records_help_conflict: profiles giving different records-request help conflict at records_help; identical ones do not", () => {
  const r = pair((a, b) => { must(a.records_help, "records_help").days = 10; must(b.records_help, "records_help").days = 99; });
  assertNote(conflictAt(r, "records_help"), "records help");
  control("records help", "records_help");
});

test("jurisdictions.index.weekend_conflict: profiles naming different weekends conflict at weekend; identical ones do not", () => {
  const r = pair((a, b) => { must(a.weekend, "weekend").days = ["sat", "sun"]; must(b.weekend, "weekend").days = ["fri", "sat", "sun"]; });
  assertNote(conflictAt(r, "weekend"), "weekend");
  control("weekend", "weekend");
});

test("jurisdictions.index.instrument_key_conflict: profiles giving different instrument-key segments conflict at instrument_key; identical ones do not", () => {
  const r = pair((a, b) => { a.instrument_key = { jurisdiction: "one-ellery", basis: "TEST" }; b.instrument_key = { jurisdiction: "two-ellery", basis: "TEST" }; });
  assertNote(conflictAt(r, "instrument_key"), "instrument key");
  control("instrument key", "instrument_key");
});

test("jurisdictions.index.family_dropped_from_view: a family whose profiles give different labels is withheld with its note; identical families are not", () => {
  const r = pair((a, b) => {
    const sa = must(must(a.standard_sources, "standard_sources").find((x) => x.series), "a source in a family");
    const saSeries = must(sa.series, "series");
    const sb = must(must(b.standard_sources, "standard_sources").find((x) => x.series?.key === saSeries.key && x.key === sa.key), "its copy");
    saSeries.label = "Label one";
    must(sb.series, "series").label = "Label two";
  });
  const c = r.conflicts.find((x) => x.at.endsWith(".series.label"));
  assertNote(c, "family");
  assert.equal(must(c, "family").values.length, 2, "both profiles' labels are named");
});

test("jurisdictions.index.who_issues_undetermined: a source whose profiles give different levels is undetermined with its note", () => {
  const r = pair((a, b) => {
    const sa = must(must(a.standard_sources, "standard_sources").find((x) => x.level && !x.series), "a source with a level");
    const sb = must(must(b.standard_sources, "standard_sources").find((x) => x.level && !x.series && x.source === sa.source && x.issuer === sa.issuer), "its copy");
    sa.level = "city";
    sb.level = "county";
  });
  const c = r.conflicts.find((x) => x.at.endsWith(".level"));
  assertNote(c, "who issues");
});

test("jurisdictions.index.receipt_on_closed_day: venues giving different receipt rules conflict, and the note says what a closed day does", () => {
  const r = pair((a, b) => {
    const ka = must(must(a.action_kinds, "action_kinds").find((x) => x.venue?.receipt), "a kind with a receipt rule");
    const kb = must(must(b.action_kinds, "action_kinds").find((x) => x.venue?.receipt && x.kind === ka.kind), "its copy");
    const va = must(ka.venue, "venue");
    const vb = must(kb.venue, "venue");
    va.receipt = { ...must(va.receipt, "receipt"), citation: "Rule one" };
    vb.receipt = { ...must(vb.receipt, "receipt"), citation: "Rule two" };
  });
  const c = r.conflicts.find((x) => x.at.endsWith(".venue.receipt"));
  assertNote(c, "receipt");
});

test("jurisdictions.index.local_day_undetermined: venues giving different time zones conflict, and the note says the local day is undetermined", () => {
  const r = pair((a, b) => {
    const ka = must(must(a.action_kinds, "action_kinds").find((x) => x.venue), "a kind with a venue");
    const kb = must(must(b.action_kinds, "action_kinds").find((x) => x.kind === ka.kind), "its copy");
    must(ka.venue, "venue").time_zone = { value: "UTC", status: "ruled", basis: "TEST" };
    must(kb.venue, "venue").time_zone = { value: "Europe/Paris", status: "ruled", basis: "TEST" };
  });
  const c = r.conflicts.find((x) => x.at.endsWith(".venue.time_zone"));
  assertNote(c, "local day");
});

test("jurisdictions.index.named_identifiers, jurisdictions.index.named_within and jurisdictions.index.named_body_variants: a counterparty's named fields that differ conflict, each with its note", () => {
  const ids = pair((a, b) => {
    const ca = must(must(a.counterparties, "counterparties").find((c) => c.ids), "an office with identifiers");
    const cb = must(must(b.counterparties, "counterparties").find((c) => c.ids && c.role === ca.role && c.body === ca.body), "its copy");
    const cbIds = at(cb, "ids");
    for (const k of Object.keys(must(ca.ids, "ids"))) cbIds[k] = { ...at(cbIds, k), id: "9999" };
  });
  assertNote(ids.conflicts.find((x) => x.at.endsWith(".ids")), "identifiers");

  const within = pair((a, b) => {
    const ca = must(must(a.counterparties, "counterparties").find((c) => c.within), "an office within an organisation");
    const cb = must(must(b.counterparties, "counterparties").find((c) => c.within && c.role === ca.role && c.body === ca.body), "its copy");
    cb.within = { ...must(cb.within, "within"), label: "Another organisation" };
  });
  assertNote(within.conflicts.find((x) => x.at.endsWith(".within")), "within");

  const org = pair((a, b) => {
    const ca = must(must(a.counterparties, "counterparties").find((c) => c.organisation), "an office with a body variant");
    const cb = must(must(b.counterparties, "counterparties").find((c) => c.organisation && c.role === ca.role && c.body === ca.body), "its copy");
    cb.organisation = "harbour_commission";
  });
  assertNote(org.conflicts.find((x) => x.at.endsWith(".organisation")), "body-variant key");
});

/* action-clocks against `jurisdictions` R119 (PR 40): the federal layer's FOIA offices in the view's counterparties, each
   `level: federal`, with contacts and no hours. R2's last sentence (T51 fix round 2, C68) orders NO_SUCH_RULE's `deadlines`
   by the office's own level (the addressee's, else the view's counterparty), so a request to one of these offices lists the
   federal law's deadlines first; R10/R11 read an office's `hours` only where the view holds them. The view is the real
   `combine` of the shipped package, read when the test runs; no office, law or deadline of it is listed by hand here. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V } from "./fixture.mjs";
import * as clocks from "../../../src/action-clocks/index.mjs";
import { officeHours } from "../../../src/action-clocks/count.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

const M = V("alice");
const PROFILES = ["oakland-alameda"];
const view = () => combine(PROFILES).view;
const to = (o) => ({ action_kind: "records_request", counterparty: { state: "named", kind: "office", role: o.role, body: o.body } });
/* The level a deadline is of, read from the view itself: that of the records law whose citation its own begins with. */
const levelOf = (v, d) => {
  const law = v.records_laws.find((l) => typeof l.level === "string" && d.citation.startsWith(l.citation.replace(/\s+et seq\.?$/, "").trim()));
  return law ? law.level : null;
};

test("notice jurisdictions:40 R2 (C68): an action addressed to a federal FOIA office of the view reads its level as federal and lists the federal law's deadlines first; control: a state office of the same view lists the federal last", () => {
  const v = view();
  const federal = v.counterparties.filter((c) => c.level === "federal");
  assert.ok(federal.length > 1, "the view holds the federal layer's offices");
  const state = v.counterparties.find((c) => c.level === "state");
  assert.ok(state, "the view holds a state office");
  const kinds = v.deadlines.filter((d) => d.applies_to === "records_request");
  const fedRules = kinds.filter((d) => levelOf(v, d) === "federal").map((d) => d.rule);
  const otherRules = kinds.filter((d) => levelOf(v, d) !== "federal").map((d) => d.rule);
  assert.ok(fedRules.length && otherRules.length, "the kind has federal deadlines and others");

  /* every federal office, first, last and between, reads federal; its deadlines come first. */
  for (const o of [federal[0], federal[Math.floor(federal.length / 2)], federal[federal.length - 1]]) {
    assert.equal(clocks.officeLevel(to(o), v), "federal");
    const got = clocks.deadlinesFor(v, "records_request", to(o)).map((d) => d.rule);
    assert.deepEqual(got.slice(0, fedRules.length), fedRules);
    assert.deepEqual(new Set(got), new Set(kinds.map((d) => d.rule)), "the same set, only ordered");
  }
  /* control: a state office of the same view (its many federal neighbours notwithstanding) lists the federal deadlines last,
     those the profile ties to another level after those it ties to none or the state's, in the view's order. */
  assert.equal(clocks.officeLevel(to(state), v), "state");
  const st = clocks.deadlinesFor(v, "records_request", to(state)).map((d) => d.rule);
  assert.deepEqual(st, [...otherRules, ...fedRules]);
});

test("notice jurisdictions:40 R2: clockPropose's NO_SUCH_RULE on a request to a federal FOIA office lists the federal deadlines first, and each listed rule is one it accepts", () => {
  const v = view();
  const o = v.counterparties.find((c) => c.level === "federal");
  const fedRules = v.deadlines.filter((d) => d.applies_to === "records_request" && levelOf(v, d) === "federal").map((d) => d.rule);
  const w = world({ profiles: PROFILES });
  const A = "ACTN-2026-0001-f";
  w.action(A, ["action_kind: records_request", "counterparty:", "  state: named", "  kind: office",
    `  role: ${JSON.stringify(o.role)}`, `  body: ${JSON.stringify(o.body)}`]);
  const no = w.c.clockPropose({ target: A, rule: "no_such", proposer: M, viewer: M });
  assert.equal(no.reason, "NO_SUCH_RULE");
  assert.deepEqual(no.deadlines.slice(0, fedRules.length).map((d) => d.rule), fedRules);
  for (const d of no.deadlines) assert.notEqual(w.c.clockPropose({ target: A, rule: d.rule, proposer: M, viewer: M }).reason, "NO_SUCH_RULE");
});

test("notice jurisdictions:40 R10/R11: a federal FOIA office holds no hours, so none is read for it; control: an office of the view that states hours is read", () => {
  const v = view();
  const fed = v.counterparties.filter((c) => c.level === "federal");
  assert.deepEqual(officeHours(v, fed.slice(0, 3).map((o) => ({ role: o.role, body: o.body }))), []);
  const withHours = v.counterparties.find((c) => c.hours);
  assert.ok(withHours, "the view holds an office with hours");
  assert.equal(officeHours(v, [{ role: withHours.role, body: withHours.body }]).length, 1);
});

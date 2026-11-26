/* jurisdictions, T51 fix round 10 (walk-final 08-law D1, D15; K5148): R51 and R93 on the shipped first profile. Tested at the
 * module's interface: `get`, `validate`, `combine`. Seen red on the profile as it stood (no proceeding_kinds, forums or
 * records_help), so no proceeding could be registered and the records help page contradicted itself. The earlier tests used
 * the test profile alone, whose block is always present: that is why they missed it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { validate, combine, FORUM_KINDS, RECORDS_HELP_CITATIONS } from "../index.mjs";
import { must, held, viewOf, at, drop } from "./helpers.mjs";

const FIRST = "oakland-alameda";
/** @param {string} b @returns {boolean} */
const dated = (b) => String(b).split(/, |; /).every((x) => /^\d{4}-\d{2}-\d{2}( \S+)?$/.test(x));

test("R51 the first profile holds the four kinds of proceeding, each with a forum_kind, a sourced basis, and a forum of that kind", () => {
  const f = held(FIRST);
  const proceedingKinds = must(f.proceeding_kinds, "proceeding_kinds");
  assert.deepEqual(proceedingKinds.map((k) => k.kind).sort(), ["appeal", "civil", "complaint", "writ"]);
  for (const k of proceedingKinds) {
    assert.ok(FORUM_KINDS.includes(k.forum_kind), k.kind);
    assert.ok(k.label && dated(k.basis), `${k.kind}: ${k.basis}`);
    assert.ok((f.forums || []).some((x) => x.forum_kind === k.forum_kind), `no forum for ${k.kind}`);
  }
  assert.equal(must(proceedingKinds.find((k) => k.kind === "complaint"), "complaint").forum_kind, "commission");
  for (const k of ["civil", "writ", "appeal"]) assert.equal(must(proceedingKinds.find((x) => x.kind === k), k).forum_kind, "court");
  assert.ok(validate(f).ok, JSON.stringify(validate(f).errors));
});

test("R51 every flow is for a kind of the profile, once, with ordered stages reached by event kinds and a citation", () => {
  const f = held(FIRST), kinds = new Set(must(f.proceeding_kinds, "proceeding_kinds").map((k) => k.kind));
  const flows = must(f.proceeding_flows, "proceeding_flows");
  assert.ok(flows.length >= 1);
  /** @type {Set<string>} */
  const seen = new Set();
  for (const fl of flows) {
    assert.ok(kinds.has(fl.kind) && !seen.has(fl.kind), fl.kind); seen.add(fl.kind);
    assert.ok(fl.citation && dated(fl.basis));
    assert.ok(fl.stages.length >= 2);
    for (const s of fl.stages) assert.ok(s.label && s.reached_by.length);
  }
  const bad = structuredClone(f); at(bad, "proceeding_flows[0]").kind = "nonesuch";
  assert.ok(validate(bad).errors.some((e) => e.code === "FLOW_INVALID"));
});

test("R51 the first profile's forums include the county's Superior Court and the body a complaint goes to; each once, with a basis", () => {
  const f = held(FIRST), forums = must(f.forums, "forums"), labels = forums.map((x) => x.label);
  assert.ok(forums.some((x) => x.forum_kind === "court" && /Superior/.test(x.label) && /Alameda/.test(x.label)));
  assert.ok(forums.some((x) => x.forum_kind === "commission"));
  assert.equal(new Set(labels).size, labels.length);
  for (const x of forums) assert.ok(dated(x.basis), x.label);
  const c = combine([FIRST, FIRST]);
  assert.equal(must(viewOf(c).proceeding_kinds, "proceeding_kinds").length, 4);
});

test("R93 the first profile carries a records_help block read from the statute, valid, with every citation naming a section", () => {
  const h = held(FIRST).records_help;
  assert.ok(h, "records_help present");
  assert.equal(h.law, "California Public Records Act");
  assert.equal(h.days, 10); assert.equal(h.extra_days, 14);
  assert.equal(h.status, "researched"); assert.ok(dated(h.basis));
  assert.ok(h.extension_reasons.length === 6);
  for (const r of h.extension_reasons) assert.match(r.citation, /§ 7922\.535\(c\)\(\d\)/);
  const citations = at(h, "citations");
  for (const k of RECORDS_HELP_CITATIONS) assert.match(String(citations[k]), /§/, k);
  assert.match(must(h.portal, "portal").url, /^https:\/\/oaklandca\.nextrequest\.com\/?$/);
  assert.equal(must(h.faster, "faster").citation, "Oakland Mun. Code § 2.20.230(A)");
  assert.ok(validate(held(FIRST)).ok);
  const broken = structuredClone(held(FIRST)); drop(broken, "records_help.days");
  assert.ok(validate(broken).errors.some((e) => e.path === "records_help.days"));
});

test("R93 the first profile's block agrees with its records_response deadline and its records_laws entry", () => {
  const f = held(FIRST), h = must(f.records_help, "records_help");
  const rule = must(must(f.deadlines, "deadlines").find((d) => d.rule === "records_response"), "records_response");
  assert.equal(h.days, rule.amount); assert.equal(h.extra_days, must(rule.extension, "extension").days);
  assert.ok(must(f.records_laws, "records_laws").some((l) => l.name === h.law));
  const c = combine([FIRST, FIRST]);
  assert.deepEqual(must(viewOf(c).records_help, "records_help").days, 10);
});

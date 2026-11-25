/* jurisdictions, T51 fix round 3 (C64): the federal records law in the first profile (R95), read live on the official text
 * (`fixtures/foia-text.mjs`). Tested at the module's interface: get, validate. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { get, validate } from "../index.mjs";
import { RETRIEVED, FOIA_SOURCE, FOIA_QUOTES } from "./fixtures/foia-text.mjs";

const FIRST = "oakland-alameda";
const M = `${RETRIEVED} foia-text`;
const foia = () => get(FIRST).records_laws.find((l) => l.level === "federal" && l.citation === "5 U.S.C. § 552");
const hasError = (r, code, path) => r.errors.some((e) => e.code === code && (path == null || e.path === path));
/** The subsections a citation names: "5 U.S.C. § 552(a)(3)(A), (E)" names (a)(3)(A) and, the last group replaced, (a)(3)(E). */
const subsections = (c) => {
  const [head, ...tails] = c.slice("5 U.S.C. § 552".length).split(", ");
  return [head, ...tails.map((t) => head.replace(/\([^()]*\)$/, "") + t)];
};

test("R95 the federal Freedom of Information Act is in the first profile, with its stages and requesters read on the official text", () => {
  const f = foia();
  assert.ok(f, "5 U.S.C. § 552 is a records_laws entry at level federal");
  assert.equal(f.name, "Freedom of Information Act");
  assert.equal(f.basis, M, "the law rests on the 2026-10-21 reading of the official text");
  assert.deepEqual(f.stages.map((s) => s.stage),
    ["request", "fee_waiver_request", "extension_notice", "production", "denial", "appeal", "appeal_decision", "court_filing"]);
  assert.deepEqual([f.requesters.status, f.requesters.basis], ["researched", M]);
  assert.ok(FOIA_SOURCE.url.startsWith("https://www.govinfo.gov/") || FOIA_SOURCE.url.startsWith("https://uscode.house.gov/"), "the official text");
  assert.match(FOIA_SOURCE.sha256, /^[0-9a-f]{64}$/);
  /* every citation names a subsection the source's quotes hold */
  for (const c of [...f.stages.map((s) => s.citation), f.requesters.citation]) {
    assert.ok(c.startsWith("5 U.S.C. § 552("), c);
    for (const sub of subsections(c)) assert.ok(FOIA_QUOTES[sub], `${c}: ${sub} is read in the source`);
  }
  assert.equal(f.stages.find((s) => s.stage === "appeal").citation, "5 U.S.C. § 552(a)(6)(A)(i)", "the right to appeal is stated in clause (i)'s notice of an adverse determination");
});

test("R95 the first profile with the federal law validates, and a law it does not list is still refused", () => {
  assert.equal(validate(get(FIRST)).ok, true);
  const named = (law) => { const p = get(FIRST); p.action_kinds[0].laws = [law]; return validate(p); };
  assert.equal(named("Freedom of Information Act").ok, true, "a kind may name the federal law");
  const bad = named("Freedom of Information Act (unlisted)");
  assert.ok(hasError(bad, "LAW_UNKNOWN", "action_kinds[0].laws[0]"), "control: an unlisted law is refused");
  assert.ok([foia().basis, foia().requesters.basis].every((b) => b !== "UNMEASURED"));
});

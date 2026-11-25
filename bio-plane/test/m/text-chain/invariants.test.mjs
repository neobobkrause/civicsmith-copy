/* text-chain: requirement-named tests for the module's invariants (build/requirements/text-chain.md
 * R82-R86), driven over every exported service with well-formed and malformed inputs. */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as tc from "../../../src/textchain.mjs";

const { TEXT_CHAIN_CHECKS } = tc;

const JUNK = [undefined, null, 0, -1, 1.5, NaN, "", "x", "ocr", true, [], [null], [{}], {}, { page: -1 },
  { kind: "pages", pages: [] }, { step: "ocr" }, [{ step: "layer", extent: "x" }], Symbol.for("s"), () => 1,
  Object.create(null)];
const GOOD = [
  [{ step: "layer", cap: null, extent: { kind: "pages", pages: [0] } }, { step: "pixels", extent: { kind: "pages", pages: [1] } },
    { step: "ocr", engine: "e", cap: "C", extent: { kind: "pages", pages: [1] } }, { step: "attested", member: "m", at: "d", extent: { kind: "document" } }],
  { page: 1, rect: [0, 0, 1, 1] }, { kind: "pdf-page", ref: "r", page: 0, rect: [0, 0, 5, 5] },
  { document: "a", pages: [{ page: 0, text: "a", undetermined: [{ count: 1 }] }] }, { basis: "engine", value: 0.5 },
];
const SERVICES = Object.entries(tc).filter(([, v]) => typeof v === "function");
const inputs = [...JUNK, ...GOOD];

/* Every service over every pair of inputs, plus a third drawn from the same set. */
function* calls() {
  for (const [name, fn] of SERVICES)
    for (const a of inputs) for (const b of inputs) yield [name, fn, [a, b, GOOD[0]]];
}

test("R82: pure — the same inputs always give the same answer, with no clock, network or store reached", () => {
  const realNow = Date.now, realFetch = globalThis.fetch, RealDate = globalThis.Date;
  const reached = [];
  Date.now = () => { reached.push("clock"); return 0; };
  globalThis.fetch = () => { reached.push("network"); return Promise.reject(new Error("no")); };
  globalThis.Date = new Proxy(RealDate, { construct: (T, a) => { reached.push("clock"); return new T(...a); } });
  try {
    for (const [name, fn, args] of calls()) {
      let one, two;
      try { one = fn(...args); } catch { continue; } // R83 is asserted below
      try { two = fn(...args); } catch { continue; }
      assert.deepEqual(one, two, `${name} is not deterministic`);
    }
  } finally { Date.now = realNow; globalThis.fetch = realFetch; globalThis.Date = RealDate; }
  assert.deepEqual(reached, []);
});

test("R83: no service throws on any input, and a bad extent or position never reads as covering everything", () => {
  const thrown = [];
  for (const [name, fn, args] of calls()) {
    try { fn(...args); } catch (e) { thrown.push(`${name}(${args.map((a) => typeof a).join(",")}): ${e.message}`); }
  }
  assert.deepEqual(thrown, []);
  for (const bad of [{ kind: "pages", pages: [] }, { kind: "x" }, "all", 3])
    assert.equal(tc.derivationCap([{ step: "ocr", engine: "e", cap: "A", extent: bad }], { page: 0 }), null);
  for (const bad of JUNK) {
    assert.equal(tc.extentCovers(bad, { page: 0, rect: [0, 0, 1, 1] }), false);
    for (const k of ["pdf-page", "sheet-cell", "sheet-range", "doc-para", "slide-shape"])
      assert.equal(tc.readingPositionInExtent(bad, k, bad), false);
  }
});

test("R84: no place is named in anything the module answers", () => {
  const PLACES = /oakland|alameda|california|berkeley|san francisco/i;
  const said = [];
  const collect = (v, depth = 0) => {
    if (typeof v === "string") said.push(v);
    else if (v && typeof v === "object" && depth < 6) for (const x of Object.values(v)) collect(x, depth + 1);
  };
  collect(tc.STEP_KINDS); collect(tc.TIER_RULE);
  for (const [, fn, args] of calls()) { try { collect(fn(...args)); } catch { /* R83 */ } }
  for (const [code, row] of Object.entries(TEXT_CHAIN_CHECKS)) said.push(code, row.check, row.where, row.translation);
  assert.ok(said.length > 1000);
  assert.deepEqual(said.filter((s) => PLACES.test(s)), []);
});

test("R85: rule 2 is computed from the chain, never taken from a caller's claim", () => {
  const chain = [{ step: "ocr", engine: "e", cap: "C" }];
  /* A caller-supplied claim anywhere on the chain or the step changes nothing. */
  const claims = { derivation_cap: "A", chainCap: "A", strengthens: false, allow: true, verified: true };
  const r = tc.appendStep(Object.assign([...chain], claims), { step: "ai", engine: "m", cap: "A", ...claims });
  assert.equal(r.code, "TEXT_CHAIN_STRENGTHENS");
  const c = tc.convertedChain({ step: "convert", engine: "h", format: "odt", cap: "D", calibration: "k", ...claims }, [{ step: "layer", cap: "B", ...claims }]);
  assert.equal(c.code, "TEXT_CHAIN_STRENGTHENS");
  /* The cap is the chain's weakest link, whatever a step says of itself beyond its own cap. */
  assert.equal(tc.derivationCap([{ step: "ocr", engine: "e", cap: "C" }, { step: "ai", engine: "m", cap: "D", chain_cap: "A" }]), "D");
});

test("R86: every refusal says which kind of no, with its catalogue check and translation", () => {
  const refusals = [];
  for (const [, fn, args] of calls()) {
    let r; try { r = fn(...args); } catch { continue; }
    if (r && r.ok === false && r.code) refusals.push(r);
  }
  const codes = new Set(refusals.map((r) => r.code));
  for (const code of ["TEXT_CHAIN_COLLAPSED", "TEXT_CHAIN_EMPTY", "TEXT_CHAIN_STEP_SHAPE", "TEXT_CHAIN_STEP_UNNAMED",
    "TEXT_CONFIDENCE_SHAPE", "TEXT_ANCHOR_MISSING", "TEXT_ATTEST_MACHINE"]) assert.ok(codes.has(code), code);
  for (const r of refusals) {
    assert.ok(Object.hasOwn(TEXT_CHAIN_CHECKS, r.code), r.code);
    assert.equal(r.check, TEXT_CHAIN_CHECKS[r.code].check);
    assert.match(r.check, /^C-35\.\d+$/);
    assert.equal(r.translation, TEXT_CHAIN_CHECKS[r.code].translation);
    assert.ok(typeof r.detail === "string" && r.detail.trim().length > 0);
  }
  /* The undetermined region says why; the tier-2 refusal says why. */
  const fl = tc.applyConfidenceFloor([{ confidence: { basis: "engine", value: 0 } }], 0.5).regions[0];
  assert.ok(fl.undetermined === true && typeof fl.why === "string" && fl.why.length > 0);
  const m = tc.mergeTier2Text({ document: "held" }, {});
  assert.ok(m.ok === false && typeof m.why === "string" && m.why.length > 0);
});

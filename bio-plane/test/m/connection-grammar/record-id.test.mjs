/* connection-grammar at its interface: isRecordId (R21), the one test of a record id that checkConnection reads `from`
   and `to` by (R1). Every prefix of record-grammar's ID_TABLE is checked in its own form (and its legacy form), alone and
   with a slug, against the controls. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { isRecordId, createRegistry } from "../../../src/connection-grammar/index.mjs";
import { ID_TABLE } from "../../../src/record-grammar/index.mjs";
import { tie, KINDS, NODE } from "./fixtures/owner.mjs";

const SEQ = ["0001", "9999", "10000", "123456789"];
const OPAQUE = ["abcdefgh01234567", "0123456789abcdef", "zzzzzzzzzzzzzzzz"];
const SLUGS = ["a", "a-rule", "x1-2y-zz9", "0"];
/** Every core a row's form accepts, its legacy form's included. */
const cores = (row) => [row.form, row.legacy].filter(Boolean).flatMap((f) => (f === "opaque" ? OPAQUE : SEQ).map((t) => `${row.prefix}-2026-${t}`));
/** Cores of a row's prefix in no form it holds. */
const wrongCores = (row) => {
  const forms = new Set([row.form, row.legacy].filter(Boolean));
  const out = [`${row.prefix}-2026-999`, `${row.prefix}-26-0001`, `${row.prefix}-2026-`, `${row.prefix}-2026`, `${row.prefix}`,
    `${row.prefix}-2026-abcdefgh0123456`, `${row.prefix}-2026-abcdefgh012345678`, `${row.prefix}-2026-ABCDEFGH01234567`,
    `${row.prefix}-2026-abcdefgh_1234567`, ` ${row.prefix}-2026-0001`, `${row.prefix}-2026-0001 `, `${row.prefix.toLowerCase()}-2026-0001`];
  if (!forms.has("opaque")) out.push(`${row.prefix}-2026-abcdefgh01234567`);
  if (!forms.has("sequential")) out.push(`${row.prefix}-2026-0001`);
  return out;
};

const reg = createRegistry();
reg.registerOwner({ owner: "sample", kinds: KINDS, neighbours: () => ({ items: [] }) });
/**
 * Whether checkConnection reads `v` as a record id at both ends (R1, R21: the same test).
 * @param {string} v
 * @returns {boolean}
 */
const endsAccepted = (v) => {
  const res = reg.checkConnection(tie("c-1", v, v));
  return res.ok || !(res.errors ?? []).some((e) => e.field === "from" || e.field === "to");
};

test("R21 isRecordId is true for every ID_TABLE prefix's id core in its form, a legacy form included, alone or followed by a slug", () => {
  assert.ok(ID_TABLE.length > 0);
  for (const row of ID_TABLE) {
    for (const core of cores(row)) {
      assert.equal(isRecordId(core), true, core);
      for (const slug of SLUGS) assert.equal(isRecordId(`${core}-${slug}`), true, `${core}-${slug}`);
    }
  }
  // A legacy form is read: CALC and ACD, opaque now, still read their earlier sequential cores.
  for (const row of ID_TABLE.filter((r) => r.legacy)) assert.equal(isRecordId(`${row.prefix}-2026-0001-a-slug`), true, row.prefix);
  assert.ok(ID_TABLE.some((r) => r.legacy), "the table holds a legacy form to read");
});

test("R21 isRecordId is false for a core outside its prefix's form, an empty or malformed slug, an unknown prefix, any other text", () => {
  for (const row of ID_TABLE) {
    for (const v of wrongCores(row)) {
      assert.equal(isRecordId(v), false, v);
      assert.equal(isRecordId(`${v}-a-slug`), false, `${v}-a-slug`);
    }
    const core = cores(row)[0];
    for (const bad of ["", "-", "-a", "a-", "a--b", "A", "a-Rule", "a_b", "a b", "é", "a.b", "a/b"]) {
      assert.equal(isRecordId(`${core}-${bad}`), false, `${core}-${bad}`);
    }
    assert.equal(isRecordId(`${core}${core}`), false);
  }
  const prefixes = new Set(ID_TABLE.map((r) => r.prefix));
  for (const p of ["XYZ", "ZZZZ", "ent", "Ent", "", "__proto__", "constructor", "toString", "hasOwnProperty"]) {
    assert.ok(!prefixes.has(p), p);
    for (const v of [`${p}-2026-0001`, `${p}-2026-abcdefgh01234567`, `${p}-2026-0001-a-slug`]) assert.equal(isRecordId(v), false, v);
  }
  for (const v of ["", "nobody", "2026-0001", "-ENT-2026-0001", "ENT--2026-0001", "ENT-2026-0001\n", "ENT-2026-0001-a\nb", "INFO-2026-0001-a-source.ann-20260101T000000Z-x"]) {
    assert.equal(isRecordId(v), false, JSON.stringify(v));
  }
});

test("R21 isRecordId is false for a non-string and never throws, whatever it is given", () => {
  const hostile = { toString() { throw new Error("boom"); }, [Symbol.toPrimitive]() { throw new Error("boom"); } };
  for (const v of [undefined, null, 0, 1, NaN, true, 10n, Symbol("ENT-2026-0001"), [], ["ENT-2026-0001"], {}, { id: "ENT-2026-0001" },
    new String("ENT-2026-0001"), () => "ENT-2026-0001", hostile, { __proto__: null }]) {
    assert.equal(isRecordId(v), false, typeof v);
  }
});

test("R21 R1 checkConnection reads `from` and `to` by isRecordId: it accepts exactly the ends isRecordId accepts", () => {
  /** @type {string[]} */
  const vs = [NODE];
  for (const row of ID_TABLE) {
    const core = cores(row)[0];
    assert.ok(core, row.prefix);
    vs.push(core, `${core}-a-slug`, `${core}-`, `${core}-A`, ...wrongCores(row).slice(0, 3));
  }
  vs.push("XYZ-2026-0001", "nobody", "");
  for (const v of vs) assert.equal(endsAccepted(v), isRecordId(v), v);
});

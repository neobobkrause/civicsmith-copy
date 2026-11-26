/* connection-grammar at its interface: the connection shape (R1) and the derived id (R11). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createRegistry, derivedId, DECLARED_LABEL, HUNCH_LABEL } from "../../../src/connection-grammar/index.mjs";
import { canonicalJson, BASIS_GRADES } from "../../../src/record-grammar/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { KINDS, tie, mention, said, guess, valid, NODE } from "./fixtures/owner.mjs";
/** @import { FieldError } from "../../../src/connection-grammar/shape.mjs" */

/** A registry with the sample owner registered. */
const reg = () => {
  const r = createRegistry();
  const res = r.registerOwner({ owner: "sample", kinds: KINDS, neighbours: () => ({ items: [] }) });
  assert.equal("ok" in res && res.ok, true);
  return r;
};
/**
 * The fields a check's errors name; none for a connection it accepts.
 * @param {{errors: FieldError[], ok: boolean} | {errors?: undefined, ok: boolean}} res
 * @returns {string[]}
 */
const fields = (res) => (res.errors ?? []).map((e) => e.field);
/** The five fields of a derived id. @type {("kind" | "from" | "to" | "as_of" | "method")[]} */
const FIVE = ["kind", "from", "to", "as_of", "method"];

test("R1 checkConnection accepts a well-formed connection of every class", () => {
  const r = reg();
  for (const c of [tie("c-1", NODE, "ENT-2026-0002"), mention(NODE, "LIN-2026-abcdefgh01234567"), said("c-2", NODE, "STD-2026-0001-a-rule"),
    guess("c-3", "EVT-2026-abcdefgh01234567", NODE)]) assert.deepEqual(r.checkConnection(c), { ok: true }, c.kind);
  // Each bound form: null (not stated), a value of the precision, an event bound.
  assert.deepEqual(r.checkConnection(tie("c-4", NODE, "ENT-2026-0002", valid(null, { event: "EVT-2026-abcdefgh01234567", edge: "end" }))), { ok: true });
  assert.deepEqual(r.checkConnection(tie("c-5", NODE, "ENT-2026-0002", { from: "2026-01-01T09:30", to: null, precision: "minute", zone: "UTC" })), { ok: true });
});

test("R1 checkConnection refuses a missing or malformed field, naming the field", () => {
  const r = reg();
  const good = tie("c-1", NODE, "ENT-2026-0002");
  for (const f of ["id", "from", "to", "kind", "owner", "valid", "evidence", "grade", "derived"]) {
    /** @type {[string, unknown][]} */
    const entries = [["id", good.id], ["from", good.from], ["to", good.to], ["kind", good.kind], ["owner", good.owner],
      ["valid", good.valid], ["evidence", good.evidence], ["grade", good.grade], ["derived", good.derived]];
    const c = Object.fromEntries(entries.filter(([k]) => k !== f));
    assert.ok(fields(r.checkConnection(c)).includes(f), `absent ${f}`);
  }
  /** @type {[object, string][]} */
  const cases = [
    [{ id: "" }, "id"], [{ from: "nobody" }, "from"], [{ to: "ENT-2026-999" }, "to"], [{ from: "XYZ-2026-0001" }, "from"],
    [{ to: "EVT-2026-ABCDEFGH01234567" }, "to"], [{ kind: "unheld" }, "kind"], [{ owner: "another" }, "kind"], [{ owner: "" }, "owner"],
    [{ valid: null }, "valid"], [{ valid: { ...good.valid, precision: "hour" } }, "valid"], [{ valid: { ...good.valid, zone: "" } }, "valid"],
    [{ valid: { ...good.valid, from: "2026-1-1" } }, "valid"], [{ valid: { precision: "day", zone: "UTC", to: null } }, "valid"],
    [{ valid: { ...good.valid, to: { event: "EVT-2026-abcdefgh01234567", edge: "end", value: "2026-01-01" } } }, "valid"],
    [{ valid: { ...good.valid, to: { event: "EVT-2026-abcdefgh01234567" } } }, "valid"],
    [{ evidence: "INFO" }, "evidence"], [{ evidence: [{}] }, "evidence"], [{ grade: { assertion: "E", ends: ["A", "A"] } }, "grade"],
    [{ grade: { assertion: "A", ends: ["A"] } }, "grade"], [{ grade: null }, "grade"], [{ derived: { method: "x", inputs: [], as_of: "2026" } }, "derived"],
    [{ label: DECLARED_LABEL }, "label"],
  ];
  for (const [patch, field] of cases) {
    const res = r.checkConnection({ ...good, ...patch });
    assert.equal(res.ok, false, JSON.stringify(patch));
    assert.ok((res.errors ?? []).some((e) => e.field === field && typeof e.why === "string" && e.why.length), `${JSON.stringify(patch)} names ${field}`);
  }
});

test("R1 each class's own rules: evidence, derived, declared, hunch", () => {
  const r = reg();
  assert.ok(fields(r.checkConnection({ ...tie("c", NODE, "ENT-2026-0002"), evidence: [] })).includes("evidence"), "evidentiary without a source");
  const m = mention(NODE, "ENT-2026-0006");
  assert.ok(fields(r.checkConnection({ ...m, derived: null })).includes("derived"));
  assert.ok(fields(r.checkConnection({ ...m, derived: { method: "co-mention", inputs: "x", as_of: "2026-02-01" } })).includes("derived"));
  assert.ok(fields(r.checkConnection({ ...m, id: "c-not-derived" })).includes("id"));
  assert.ok(fields(r.checkConnection({ ...m, derived: { ...m.derived, as_of: "2026-02-02" } })).includes("id"), "a changed field changes the id");
  const s = said("c", NODE, "ENT-2026-0007");
  assert.ok(fields(r.checkConnection({ ...s, label: undefined })).includes("label"));
  assert.ok(fields(r.checkConnection({ ...s, grade: { assertion: "C", ends: ["B", "B"] } })).includes("grade"), "declared at the lowest grade");
  const g = guess("c", NODE, "ENT-2026-0008");
  assert.ok(fields(r.checkConnection({ ...g, label: DECLARED_LABEL })).includes("label"));
  assert.ok(fields(r.checkConnection({ ...g, grade: { assertion: "D", ends: ["D", "D"] } })).includes("grade"), "a hunch carries no grade");
  assert.ok(fields(r.checkConnection({ ...g, scope: undefined })).includes("scope"));
  assert.ok(fields(r.checkConnection({ ...tie("c", NODE, "ENT-2026-0002"), label: HUNCH_LABEL })).includes("label"));
});

test("R1 checkConnection never throws, whatever it is given", () => {
  const r = reg();
  const hostile = { get kind() { throw new Error("boom"); } };
  for (const v of [undefined, null, 1, "x", [], () => 1, hostile, { __proto__: null }, { ...tie("c", NODE, "ENT-2026-0002"), valid: [] }]) {
    const res = r.checkConnection(v);
    assert.equal(res.ok, false);
    const errors = res.errors ?? [];
    assert.ok(errors.length && errors.every((e) => typeof e.field === "string" && typeof e.why === "string"));
  }
});

test("R1 the declared label and the grade's shape are read by connection-grammar.shape.label_declared and connection-grammar.shape.grade_shape", () => {
  assert.equal(DECLARED_LABEL, localize("connection-grammar.shape.label_declared", "declared, not evidenced"));
  const res = reg().checkConnection({ ...tie("c-1", NODE, "ENT-2026-0002"), grade: { assertion: "E", ends: ["A", "A"] } });
  assert.equal((res.errors ?? []).find((e) => e.field === "grade")?.why, localize("connection-grammar.shape.grade_shape",
    "grade is not {shape} in the letters {letters}", { shape: "{assertion, ends: [from_grade, to_grade]}", letters: BASIS_GRADES.join(" ") }));
});

test("R11 derivedId is the SHA-256 of the canonical JSON of the five fields, the same five giving the same id", () => {
  const f = { kind: "sample_mention", from: NODE, to: "ENT-2026-0006", as_of: "2026-02-01", method: "co-mention" };
  /** @type {string} */
  const canonical = canonicalJson(f);
  const want = createHash("sha256").update(canonical).digest("hex");
  assert.equal(derivedId(f), want);
  assert.match(derivedId(f), /^[0-9a-f]{64}$/);
  assert.equal(derivedId({ method: f.method, as_of: f.as_of, to: f.to, from: f.from, kind: f.kind }), want, "key order does not matter");
  const withExtra = { ...f, extra: "ignored" };
  assert.equal(derivedId(withExtra), want, "only the five fields count");
  for (const k of FIVE) assert.notEqual(derivedId({ ...f, [k]: f[k] + "x" }), want, k);
  for (const k of FIVE) assert.throws(() => derivedId({ ...f, [k]: undefined }), { name: "TypeError", message: new RegExp(k) });
  assert.throws(() => derivedId(null), TypeError);
});

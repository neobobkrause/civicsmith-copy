/* record-grammar at its interface: the restricted front-matter parser (R6–R11) and the core fields and forbidden
   aliases it recovers buried keys by. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { localize } from "../../../src/setup-words/index.mjs";
import { parseFrontmatter, CORE_FIELDS, FORBIDDEN_ALIASES } from "../../../src/record-grammar/index.mjs";
/** @import { Frontmatter, Finding } from "../../../src/record-grammar/frontmatter.mjs" */

/** @param {...string} fm @returns {string} */
const doc = (...fm) => ["---", ...fm, "---", "body line 1", "body line 2"].join("\n");
/** The data of a parse with no finding. @param {{data: Frontmatter | null, findings: Finding[]}} r @returns {Frontmatter} */
const only = (r) => { assert.deepEqual(r.findings, []); const data = r.data; assert.ok(data); return data; };
/** Every finding has exactly the R11 shape. @param {Finding[]} findings @returns {Finding[]} */
function shaped(findings) {
  for (const x of findings) {
    const keys = Object.keys(x).sort();
    const repairs = x.repairs;
    if ("repairs" in x) {
      assert.deepEqual(keys, ["check", "message", "repairable", "repairs", "severity"]);
      assert.equal(x.repairable, true);
      assert.ok(Array.isArray(repairs) && repairs.length > 0 && repairs.every((r) => typeof r === "string"));
    } else assert.deepEqual(keys, ["check", "message", "severity"]);
    assert.equal(typeof x.message, "string");
  }
  return findings;
}

test("R6 no opening fence, or a fence never closed: data null, one C-2.1 error, body the whole text", () => {
  for (const text of ["", "title: x", " ---\na: 1\n---\n", "----\na: 1\n---", "--- \na: 1\n---", "---", "---\na: 1",
    "---\na: 1\n --- \n", "---\r\na: 1\r\n", "x\n---\na: 1\n---\n"]) {
    const r = parseFrontmatter(text);
    assert.equal(r.data, null, JSON.stringify(text));
    assert.equal(r.body, text);
    assert.equal(r.findings.length, 1);
    assert.deepEqual(shaped(r.findings).map((x) => [x.check, x.severity]), [["C-2.1", "error"]]);
  }
});

test("R6 R7 lines split on \\n or \\r\\n; body is the text after the closing fence", () => {
  const r = parseFrontmatter("---\r\ntitle: x\r\n---\r\nb1\r\nb2");
  assert.deepEqual(only(r), { title: "x" });
  assert.equal(r.body, "b1\nb2");
  assert.equal(parseFrontmatter("---\n---").body, "");
  assert.equal(parseFrontmatter("---\n---\n").body, "");
  assert.equal(parseFrontmatter("---\na: 1\n---\n---\nz").body, "---\nz");
  assert.deepEqual(only(parseFrontmatter("---\n---\nrest")), {});
});

test("R7 the grammar: top-level keys, map blocks, array blocks of scalars and of objects, an empty block is []", () => {
  const r = parseFrontmatter(doc(
    "id: INFO-2026-0001-a",
    "group:",
    "  name: g",
    "  size: 3",
    "tags:",
    "  - one",
    "  - 2",
    "state_history:",
    "  - from_state: a",
    "    to_state: b",
    "    at: t",
    "  - from_state: b",
    "  - plain",
    "references:",
    "visuals:",
    "last: z"));
  assert.deepEqual(only(r), {
    id: "INFO-2026-0001-a", group: { name: "g", size: 3 }, tags: ["one", 2],
    state_history: [{ from_state: "a", to_state: "b", at: "t" }, { from_state: "b" }, "plain"],
    references: [], visuals: [], last: "z" });
  assert.equal(r.body, "body line 1\nbody line 2");
  /* A `- key:` item with no value is a scalar element, not an object. */
  assert.deepEqual(only(parseFrontmatter(doc("a:", "  - k:"))), { a: ["k:"] });
  /* A key literally named after an Object.prototype member is an own key like any other. */
  const p = only(parseFrontmatter(doc("__proto__: x", "constructor:", "  toString: y")));
  assert.ok(Object.hasOwn(p, "__proto__"));
  assert.equal(p["__proto__"], "x");
  assert.equal(Reflect.getPrototypeOf(p), Object.prototype);
  assert.deepEqual(Object.keys(p), ["__proto__", "constructor"]);
  const ctor = Object.entries(p).find(([k]) => k === "constructor")?.[1];
  assert.ok(ctor !== null && typeof ctor === "object" && !Array.isArray(ctor) && Object.hasOwn(ctor, "toString"));
  assert.equal(Object.entries(ctor).find(([k]) => k === "toString")?.[1], "y");
});

test("R8 scalars: blank, null, ~, booleans, quotes, inline arrays, integers, floats, strings; comments", () => {
  /** @type {[string, unknown][]} */
  const cases = [
    ["", ""], ["   ", ""], ["null", null], ["~", null], ["true", true], ["false", false], ["True", "True"], ["NULL", "NULL"],
    ['"a b"', "a b"], ["'a b'", "a b"], ['"a\\nb"', "a\\nb"], ['"it\'s"', "it's"], ['""', ""], ["''", ""], ['"', '"'], ["'", "'"],
    ['"a\'', '"a\''], ["[]", []], ["[ ]", []], ["[a, b]", ["a", "b"]], ["[1, 'x', true, null]", [1, "x", true, null]],
    ["42", 42], ["-7", -7], ["007", 7], ["3.25", 3.25], ["-0.5", -0.5], ["1.", "1."], [".5", ".5"], ["1e3", "1e3"],
    ["+1", "+1"], ["  spaced out  ", "spaced out"], ["a # note", "a"], ["a#b", "a#b"], ['"a # b"', "a # b"],
    ["'a # b' # c", "a # b"], ["# all comment", ""], ["x: y", "x: y"],
  ];
  for (const [raw, want] of cases) {
    const r = parseFrontmatter(`---\nk: ${raw}\n---\n`);
    assert.deepEqual(only(r).k, raw.trim() === "" || raw.trim().startsWith("#") ? [] : want, raw);
  }
  /* Blank and whole-line-comment lines are skipped, wherever they fall. */
  assert.deepEqual(only(parseFrontmatter(doc("", "# c", "a:", "", "  # c", "  - 1", "   ", "b: 2"))), { a: [1], b: 2 });
  /* A value that is only blank opens a block (R7), so the blank scalar is seen in an item and a map value. */
  assert.deepEqual(only(parseFrontmatter(doc("a:", "  x: ", "b:", "  - ''"))), { a: { x: "" }, b: [""] });
});

test("R9 every line outside the grammar is a C-2.1 error naming its line, and parsing continues", () => {
  const r = parseFrontmatter(doc(
    "a: 1",          // line 2
    "a: 2",          // 3 duplicate: the later value wins
    "  - stray",     // 4 array item outside any block (a: has a value)
    "b:",            // 5
    "    - deep",    // 6 not at indent 2 (still taken)
    "c:",            // 7
    "  k: v",        // 8
    "  - item",      // 9 item inside a map block
    "      odd: 1",  // 10 unfit indented key
    "not a line",    // 11 unparseable
    "d: ok"));       // 12
  shaped(r.findings);
  assert.deepEqual(r.findings.map((x) => [x.check, x.severity, (x.message.match(/line (\d+)/) || [])[1]]), [
    ["C-2.1", "error", "3"], ["C-2.1", "error", "4"], ["C-2.1", "error", "6"], ["C-2.1", "error", "9"],
    ["C-2.1", "error", "10"], ["C-2.1", "error", "11"]]);
  assert.deepEqual(r.data, { a: 2, b: ["deep"], c: { k: "v" }, d: "ok" });
  assert.equal(r.findings[0]?.message, localize("record-grammar.frontmatter.duplicate_top_level_key_key", "duplicate top-level key '{key}' at line {v1}", { key: "a", v1: "3" }));
  assert.equal(r.findings[1]?.message, localize("record-grammar.frontmatter.array_item_outside_any_block", "array item outside any block at line {v1}", { v1: "4" }));
  assert.equal(r.findings[2]?.message, localize("record-grammar.frontmatter.array_item_indented_indent_expected", "array item indented {indent} (expected 2) at line {v1}", { indent: "4", v1: "6" }));
  assert.equal(r.findings[3]?.message, localize("record-grammar.frontmatter.array_item_inside_a_map", "array item inside a map block '{topKey}' at line {v1}", { topKey: "c", v1: "9" }));
  assert.equal(r.findings[4]?.message, localize("record-grammar.frontmatter.key_key_indented_indent_does", "key '{key}' indented {indent} does not fit the restricted grammar at line {v1}", { key: "odd", indent: "6", v1: "10" }));
  assert.equal(r.findings[5]?.message, localize("record-grammar.frontmatter.line_v1_does_not_fit", "line {v1} does not fit the restricted grammar: {line}", { v1: "11", line: "not a line" }));
  /* An object element's key at the wrong indent, and a key under a scalar element, are unfit keys too. */
  const s = parseFrontmatter(doc("x:", "  - k: v", "   j: 1", "y:", "  - plain", "    j: 2"));
  assert.deepEqual(s.findings.map((x) => x.check), ["C-2.1", "C-2.1"]);
  assert.deepEqual(s.data, { x: [{ k: "v" }], y: ["plain"] });
});

test("R10 a buried core field or forbidden alias is C-2.4, repairable, and recovered at top level", () => {
  const names = [...CORE_FIELDS, ...Object.keys(FORBIDDEN_ALIASES)];
  assert.deepEqual(CORE_FIELDS, ["id", "object_type", "schema", "title", "current_state", "prior_state", "created",
    "last_updated", "produced_by", "group", "references", "state_history", "annotations_open", "reeval_pending", "visuals"]);
  assert.deepEqual(FORBIDDEN_ALIASES, { status: "current_state", state: "current_state", pipeline_state: "current_state",
    verdict: "current_state", type: "object_type", updated: "last_updated", modified: "last_updated" });
  for (const key of names) {
    const r = parseFrontmatter(doc("a: 1", `   ${key}: v`));
    assert.deepEqual(shaped(r.findings), [{ check: "C-2.4", severity: "error",
      message: `top-level key '${key}' is buried by stray indentation at line 3 and will not register`,
      repairable: true, repairs: [`re-indent '${key}' to column 0`] }], key);
    assert.deepEqual(r.data, { a: 1, [key]: "v" }, key);
  }
  /* A key that fits a slot is not buried; a non-core unfit key, and an inherited name, stay C-2.1. */
  assert.deepEqual(only(parseFrontmatter(doc("m:", "  status: x"))), { m: { status: "x" } });
  for (const key of ["other", "constructor", "toString", "hasOwnProperty"]) {
    const r = parseFrontmatter(doc("a: 1", `   ${key}: v`));
    assert.deepEqual(r.findings.map((x) => x.check), ["C-2.1"], key);
    assert.deepEqual(r.data, { a: 1 });
  }
});

test("R11 findings carry {check, severity, message}, repairs only when named; throws only for a non-string", () => {
  shaped(parseFrontmatter(doc("  status: x", "a: 1", "a: 2", "junk")).findings);
  for (const bad of [undefined, null, 1, {}, [], { split() { return ["---", "---"]; } }, new String("---\n---")])
    assert.throws(() => parseFrontmatter(bad), TypeError);
  /* Any string at all answers, never throws. */
  const noise = ["---\n" + "\u0000\uffff\ud800:".repeat(50) + "\n---", "---\n" + "- ".repeat(1000) + "\n---",
    "---\n" + "a:\n".repeat(500) + "---", "\n".repeat(100), "---\n  - x\n    y: 1\n---"];
  for (const t of noise) { const r = parseFrontmatter(t); shaped(r.findings); assert.equal(typeof r.body, "string"); }
});

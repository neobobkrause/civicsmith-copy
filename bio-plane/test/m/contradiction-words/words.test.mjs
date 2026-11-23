/* contradiction-words R1–R4 and R20, driven at the module's interface files. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { CONTRADICTION_LABELS, JUDGEMENT_PROMPT, JUDGEMENT_PROMPT_SHA256, judgementSide, renderJudgementInput }
  from "../../../src/contradiction.mjs";
import { CONTRADICTION_PAIR_CHECKS, CONTRADICTION_CANDIDATE_CHECKS } from "../../../src/contradiction/checks.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");

test("R1: the labels are exactly world, record, precision, unrelated, undetermined, in that order, and frozen", () => {
  assert.deepEqual([...CONTRADICTION_LABELS], ["world", "record", "precision", "unrelated", "undetermined"]);
  assert.ok(Object.isFrozen(CONTRADICTION_LABELS));
  assert.throws(() => { CONTRADICTION_LABELS.push("finding"); }, TypeError);
});

test("R2: sha256 of the judgement prompt is its pinned digest, the one M-162 measured", () => {
  assert.match(JUDGEMENT_PROMPT_SHA256, /^[0-9a-f]{64}$/);
  assert.equal(sha(JUDGEMENT_PROMPT), JUDGEMENT_PROMPT_SHA256);
  assert.equal(JUDGEMENT_PROMPT_SHA256, "aad3ac9e557fba904331c788a946d42e7b5c59b3d13e17972f4b45422716d08c");
});

test("R3: judgementSide keeps only text, doctype, date and role, omits null or absent, never fills, never throws", () => {
  const full = { text: "t", doctype: "agenda", date: "2026-03-01", role: "supports", kind: "passage", claim: "c", ref: "p. 1" };
  assert.deepEqual(judgementSide(full), { text: "t", doctype: "agenda", date: "2026-03-01", role: "supports" });
  assert.deepEqual(Object.keys(judgementSide(full)), ["text", "doctype", "date", "role"]);
  assert.deepEqual(judgementSide({ text: "t", doctype: null, date: undefined }), { text: "t" });
  assert.deepEqual(judgementSide({ doctype: "", date: 0, role: false }), { doctype: "", date: 0, role: false });
  /* a stance with no text of its own is shown as the claim its project adopted; with no claim, as nothing */
  assert.deepEqual(judgementSide({ kind: "stance", text: null, claim: "the fee rose" }), { text: "the fee rose" });
  assert.deepEqual(judgementSide({ kind: "stance", claim: null }), {});
  assert.deepEqual(judgementSide({ kind: "claim", claim: "x" }), {});
  for (const v of [null, undefined, "x", 3, [], {}]) assert.deepEqual(judgementSide(v), {});
});

test("R4: the input is the prompt, PAIRS:, then each pair numbered from 1 with its key, its context when it has one, and sides A and B through R3", () => {
  const pairs = [
    { key: "K3", context: "the passage", a: { text: "a1", ref: "hidden" }, b: { text: "b1", date: null } },
    { key: "K1", a: { text: "a2", doctype: "minutes" }, b: { text: "b2" } },
  ];
  assert.equal(renderJudgementInput(pairs), `${JUDGEMENT_PROMPT}\nPAIRS:\n\n`
    + `PAIR 1 · key K3\n  context (the source passage both claims rest on): "the passage"\n  A: {"text":"a1"}\n  B: {"text":"b1"}\n\n`
    + `PAIR 2 · key K1\n  A: {"text":"a2","doctype":"minutes"}\n  B: {"text":"b2"}\n`);
  for (const v of [null, undefined, {}, "pairs", 7, []]) assert.equal(renderJudgementInput(v), `${JUDGEMENT_PROMPT}\nPAIRS:\n\n\n`);
});

test("R20: every refusal row of the pairing read (C-60) and the candidate door (C-93) has its number, its place and its translation", () => {
  const rows = [...Object.entries(CONTRADICTION_PAIR_CHECKS), ...Object.entries(CONTRADICTION_CANDIDATE_CHECKS)];
  for (const [, r] of Object.entries(CONTRADICTION_PAIR_CHECKS)) assert.match(r.check, /^C-60\.\d+$/);
  for (const [, r] of Object.entries(CONTRADICTION_CANDIDATE_CHECKS)) assert.match(r.check, /^C-93\.\d+$/);
  const nums = rows.map(([, r]) => r.check);
  assert.equal(new Set(nums).size, nums.length, "no two rows share a check number");
  for (const n of ["C-60.1", "C-60.2", "C-60.3", ...Array.from({ length: 39 }, (_, i) => `C-93.${i + 1}`)])
    assert.ok(nums.includes(n), `${n} has a row`);
  for (const [code, r] of rows) {
    assert.deepEqual(Object.keys(r).sort(), ["check", "translation", "where"], code);
    assert.match(code, /^[A-Z][A-Z_]+$/);
    assert.match(r.where, /^src\/contradiction\/index\.mjs \S+ > is-[a-z-]+$/, code);
    assert.equal(typeof r.translation, "string");
    assert.ok(r.translation.trim().length > 0, code);
  }
  /* rows whose words are kept in the word table answer with that row */
  for (const code of ["CONTRADICTION_KEY_UNKNOWN", "CANDIDATES_NO_SUBJECT", "TENSIONS_TOO_MANY"])
    assert.equal(CONTRADICTION_PAIR_CHECKS[code].translation, word(`refusal.${code}`));
  assert.match(CONTRADICTION_PAIR_CHECKS.TENSIONS_TOO_MANY.translation, /200/);
  assert.match(CONTRADICTION_CANDIDATE_CHECKS.NO_SUCH_CANDIDATE.translation, /exactly as one that does not exist/);
});

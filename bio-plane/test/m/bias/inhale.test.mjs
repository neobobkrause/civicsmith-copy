/* bias R19–R21: reading an outside policy into a proposal, never installing it. */
import test from "node:test";
import assert from "node:assert/strict";
import { world } from "./world.mjs";
import { BIAS_INHALE_SENTENCES_MAX } from "../../../src/bias/index.mjs";

const POLICY = [
  "Stories require more than one source before they are published.",
  "Everything from the ministry's press office is false.",
  "A single anonymous tip does not mean the allegation is true.",
  "Reporters should verify every figure against a primary record.",
  "The agency routinely buries bad news in holiday releases, and we cover that.",
  "Our reporters are kind to one another and value the craft.",
  "Short one.",
].join("\n\n");

const tables = (w) => w.rows(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
  .map((r) => JSON.stringify(w.rows(`SELECT * FROM ${r.name}`))).join("\n");

test("R19: any truthy adopt is BIAS_INHALE_CANNOT_ADOPT (C-26.8); the method writes nothing, ever", () => {
  const w = world();
  const before = tables(w);
  for (const adopt of [true, "true", 1, "1", "yes", {}]) {
    const r = w.bias.biasInhale({ policy: POLICY, adopt });
    assert.deepEqual([r.ok, r.reason, r.check], [false, "BIAS_INHALE_CANNOT_ADOPT", "C-26.8"], String(adopt));
    assert.equal(typeof r.translation, "string");
  }
  for (const adopt of [false, 0, "", null, undefined]) assert.equal(w.bias.biasInhale({ policy: POLICY, adopt }).ok, true, String(adopt));
  const op = w.ops("", { policy: POLICY, adopt: false }).biasinhale();
  assert.equal(op.ok, true);
  assert.equal(tables(w), before, "no row of any table was written, by any inhale");
});

test("R20: split at blank lines and after . ; :, short sentences dropped, at most 500 read with coverage; bars, verdicts, inference, scrutiny, residue — never pattern", () => {
  const w = world();
  const r = w.bias.biasInhale({ policy: POLICY });
  assert.deepEqual(r.bars.map((b) => [b.text, b.construct]), [[POLICY.split("\n\n")[0], "required_strength"]]);
  assert.deepEqual(r.statements.map((s) => [s.kind, s.text]), [
    ["inference", "A single anonymous tip does not mean the allegation is true."],
    ["scrutiny", "Reporters should verify every figure against a primary record."]]);
  assert.deepEqual(r.residue.map((x) => [x.text.slice(0, 20), x.check]), [
    ["Everything from the ", "C-26.5"], ["The agency routinely", null], ["Our reporters are ki", null]]);
  assert.ok(r.statements.every((s) => s.kind !== "pattern"));
  assert.deepEqual(r.coverage.sentences_read, 6, "'Short one.' (10 characters) is dropped");
  /* the split after ; and : */
  const parts = w.bias.biasInhale({ policy: "Reporters verify each claim carefully; editors confirm the figures twice: the desk checks again later." });
  assert.equal(parts.coverage.sentences_total, 3);
  /* a bar that also reads as scrutiny is a bar first */
  const both = w.bias.biasInhale({ policy: "Stories require at least two sources, and each source must be verified." });
  assert.deepEqual([both.bars.length, both.statements.length], [1, 0]);
  /* the input bound */
  const long = Array.from({ length: BIAS_INHALE_SENTENCES_MAX + 7 }, (_, i) => `Sentence number ${i} says nothing mechanisable.`).join(" ");
  const cut = w.bias.biasInhale({ policy: long });
  assert.deepEqual([cut.coverage.sentences_read, cut.coverage.sentences_total, cut.coverage.input_truncated, cut.coverage.input_limit],
    [500, 507, true, 500]);
  assert.equal(cut.coverage.mechanised + cut.coverage.not_mechanised, 500);
});

test("R21: installed false, adopted false, writes 0, what a member does next; each list capped (200 default, at most 1,000) with its count; the pin echoed; truncated", () => {
  const w = world();
  const r = w.bias.biasInhale({ policy: POLICY, source: "https://example.org/policy", retrieved: "2026-07-01" });
  assert.deepEqual([r.installed, r.adopted, r.writes], [false, false, 0]);
  assert.match(r.proposes, /adopts it with their name on it/);
  assert.ok(r.statements.every((s) => s.proposed === true && s.authored === false));
  assert.deepEqual([r.bars_count, r.statements_count, r.residue_count, r.limit, r.truncated], [1, 2, 3, 200, false]);
  assert.deepEqual(r.pin, { source_url: "https://example.org/policy", retrieved: "2026-07-01" });
  const many = Array.from({ length: 450 }, (_, i) => `Reporters must verify claim ${i} with a record.`).join(" ");
  const d = w.bias.biasInhale({ policy: many });
  assert.deepEqual([d.statements.length, d.statements_count, d.truncated], [200, 450, true]);
  const max = w.bias.biasInhale({ policy: many, limit: 5000 });
  assert.deepEqual([max.limit, max.statements.length, max.truncated], [1000, 450, false]);
  const one = w.bias.biasInhale({ policy: many, limit: 1 });
  assert.deepEqual([one.statements.length, one.truncated], [1, true]);
  assert.deepEqual(w.bias.biasInhale({}).pin, { source_url: null, retrieved: null });
});

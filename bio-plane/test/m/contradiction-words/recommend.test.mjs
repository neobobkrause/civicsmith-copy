/* contradiction-words R41: the recommender's prompt is pinned by the digest its blind fixture of dissolved pairs was
   measured under, and the record of that measurement is kept here, beside the fixture and its runs. */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { RECOMMEND_PROMPT, RECOMMEND_PROMPT_SHA256 } from "../../../src/contradiction.mjs";
import { DISSOLVED_PAIRS, RESPECTS, renderRecommendInput } from "./recommend-fixture.mjs";
import { RUNS, PROMPT_SHA256, INPUT_SHA256 } from "./recommend-recorded.mjs";
import { score } from "./recommend-score.mjs";

const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
const RECORD = readFileSync(new URL("./MEASUREMENT.md", import.meta.url), "utf8");

/* The figures MEASUREMENT.md states, run by run. */
const FIGURES = {
  R1: { answered: 14, of: 14, out_of_list: 0, no_reason: 0, verdict_words: 0, hit: 14, named: 20, named_gold: 16, empty: 0 },
  R2: { answered: 14, of: 14, out_of_list: 0, no_reason: 0, verdict_words: 0, hit: 14, named: 18, named_gold: 15, empty: 0 },
  R3: { answered: 14, of: 14, out_of_list: 0, no_reason: 0, verdict_words: 0, hit: 12, named: 16, named_gold: 13, empty: 1 },
};

test("R41: sha256 of the recommender's prompt is its pinned digest, the one the recorded runs read", () => {
  assert.notEqual(RECOMMEND_PROMPT_SHA256, null, "a null digest says the prompt passed no measurement");
  assert.match(String(RECOMMEND_PROMPT_SHA256), /^[0-9a-f]{64}$/);
  assert.equal(sha(RECOMMEND_PROMPT), RECOMMEND_PROMPT_SHA256);
  assert.equal(RECOMMEND_PROMPT_SHA256, PROMPT_SHA256);
  assert.ok(RECORD.includes(RECOMMEND_PROMPT_SHA256), "the record names the digest it measured");
});

test("R41: the runs read exactly the fixture's rendered input, which carries no gold respect, pair id or reason", () => {
  const input = renderRecommendInput(DISSOLVED_PAIRS);
  assert.equal(sha(input), INPUT_SHA256);
  assert.ok(input.startsWith(`${RECOMMEND_PROMPT}\nPAIRS:\n\n`));
  assert.equal(input.match(/^PAIR \d+ · key K[1-5]$/gm).length, DISSOLVED_PAIRS.length);
  for (const p of DISSOLVED_PAIRS) {
    assert.ok(!input.includes(p.id), p.id);
    assert.ok(!input.includes(p.why), p.id);
    assert.ok(p.gold.length > 0 && p.gold.every((g) => RESPECTS[p.key].includes(g)), `${p.id}: gold is in its own list`);
  }
  assert.ok(!/"(gold|why|id|kind|claim)"/.test(input));
  /* every key is in the fixture, and the K1–K4 and K5 lists are the prompt's own */
  assert.deepEqual([...new Set(DISSOLVED_PAIRS.map((p) => p.key))].sort(), ["K1", "K2", "K3", "K4", "K5"]);
  const flat = RECOMMEND_PROMPT.replace(/\s+/g, " ");
  for (const k of Object.keys(RESPECTS)) assert.ok(flat.includes(RESPECTS[k].join(", ")), k);
});

test("R41: the recorded runs score as the record states: every pair answered, only listed respects, a reason each, no verdict", () => {
  assert.deepEqual(Object.keys(RUNS), ["R1", "R2", "R3"]);
  for (const [run, answer] of Object.entries(RUNS)) {
    const s = score(answer);
    assert.deepEqual(s, FIGURES[run], run);
    assert.equal(s.answered, s.of, run);
    assert.equal(s.out_of_list + s.no_reason + s.verdict_words, 0, run);
    assert.ok(RECORD.includes(`| ${run} |`), `the record has ${run}'s row`);
  }
});

test("R41's scoring, at its bounds: a missing, foreign, unreasoned or verdict answer is counted, never passed over", () => {
  const two = DISSOLVED_PAIRS.slice(0, 2);
  assert.deepEqual(score(null, two), { answered: 0, of: 2, out_of_list: 0, no_reason: 0, verdict_words: 0, hit: 0, named: 0, named_gold: 0, empty: 0 });
  const s = score([
    { n: 1, coordinates: [{ coordinate: "standard", reason: "r" }, { coordinate: "time_or_occasion", reason: "Side B is wrong." }] },
    { n: 2, coordinates: [{ coordinate: "scope", reason: " " }] },
    { n: 3, coordinates: [] },
  ], two);
  assert.deepEqual(s, { answered: 2, of: 2, out_of_list: 1, no_reason: 1, verdict_words: 1, hit: 2, named: 3, named_gold: 2, empty: 0 });
  assert.equal(score([{ n: 1, coordinates: "scope" }, { n: 2 }], two).answered, 0);
});

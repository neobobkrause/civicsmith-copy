/* docprofile — G48 control (fix round 6): `readText` over every fixture reading answers byte for byte what the tranche tip
 * answered (`fixtures/g48-answers.json`, recorded by `make-g48-answers.mjs` BEFORE the change), and `doctypeFor`'s `also`
 * is the independent pass's on every one of them. Nothing here is a text over the bound, so no answer carries
 * `classified_over` (R19, R38). Fix round 9 changes by definition: the `shell` reading's `stack.shell: true` (site-profiles R2, K4860: a CERTAIN match answers it) and two fields: `chars` (glyphs, R18) and `doctype.work` (R40). */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { READINGS, registerCorpusTypes } from "./g48-readings.mjs";
import { readText, flattenText, identify, doctypeFor, alsoFor } from "../registry.mjs";

/**
 * A recorded readText answer in its JSON form, as far as this test reads it: the glyph count; the rest is compared whole.
 * @typedef {{ chars: number }} AnswerJson
 */
/**
 * This module's own record, `fixtures/g48-answers.json` (written by `make-g48-answers.mjs`): each reading's answer by its id.
 * @typedef {{ readings: { [id: string]: AnswerJson } }} RecordedAnswers
 */

registerCorpusTypes();
const recorded = /** @type {RecordedAnswers} */ (JSON.parse(fs.readFileSync(new URL("./fixtures/g48-answers.json", import.meta.url), "utf8"))).readings;

test("R38 R19 readText of every fixture reading equals the answer recorded on the tip, with no classified_over", () => {
  assert.deepEqual(Object.keys(recorded), READINGS.map(([id]) => id));
  for (const [id, supplied, ctx] of READINGS) {
    const answer = readText(supplied, ctx);
    /** @type {object} */
    const got = JSON.parse(JSON.stringify(answer));
    assert.equal("classified_over" in got, false, id);
    // fix round 9: `chars` counts glyphs (R18) and the doctype answer carries its `work` (R40); every other field is the tip's.
    // The answer's members are read as answered and compared in their JSON form, as the record holds them.
    const gotDoctype = answer.determined ? answer.doctype : undefined;
    const { work, ...doctype } = gotDoctype || { work: undefined };
    if (gotDoctype) assert.equal(gotDoctype.work.stopped_before, null, id);
    const { chars, ...rest } = answer, { chars: was, ...wasRest } = recorded[id];
    // `why` states the same count (glyphs): read it back as the recorded trimmed length
    /** @type {unknown} */
    const compared = JSON.parse(JSON.stringify({ ...rest, ...(gotDoctype ? { doctype } : {}), why: rest.why.replace(`(${chars} characters)`, `(${was} characters)`).replace(`beside ${chars} decoded`, `beside ${was} decoded`) }));
    assert.deepEqual(compared, wasRest, id);
    assert.ok(chars <= was, `${id}: a glyph count never passes the trimmed length`);
  }
});

test("R5 doctypeFor's also is alsoFor's on every fixture reading, in registration order, errors included", () => {
  let withAlso = 0, withError = 0;
  for (const [id, supplied, ctx] of READINGS) {
    const flat = flattenText(supplied);
    if (!flat.chars) continue;
    const dctx = { ...ctx, text: flat.text, pages: Array.isArray(supplied && supplied.pages) ? supplied.pages : [] };
    const stack = identify(dctx);
    const d = doctypeFor({ ...dctx, handler: stack.handler, kind: stack.kind });
    assert.deepEqual(d.also, alsoFor({ ...dctx, handler: stack.handler, kind: stack.kind }, d.type.key), id);
    withAlso += d.also.length ? 1 : 0;
    withError += d.also.some((x) => ("error" in x ? x.error : undefined)) ? 1 : 0;
  }
  assert.ok(withAlso >= 3 && withError >= 1, "the corpus holds readings with an also, and one with an error entry");
});

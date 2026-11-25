/* reading-pipeline: the pure rules of `readingprov.mjs`, `readingProvenance` (R18) and `compareProvenance` (R19), at the
   module's interface. Moved from `extraction`'s rules.test.mjs (N513; its R25, R26), assertions unchanged. Each test
   names the requirement ids it checks in its title. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readingProvenance, compareProvenance, describePages, PROVENANCE_SCHEME } from "../../../src/reading-pipeline/index.mjs";
import { mergedChain, layerChain } from "../../../src/textchain.mjs";
import { flattenText } from "../../../../docprofile/registry.mjs";

const hex = (s) => createHash("sha256").update(s).digest("hex");

test("R18: readingProvenance digests docprofile's flattened text, credits pages by the chain first, the page's stamp, then the document's tier, names the member per tier, and lists empty pages undigested", async () => {
  const chain = mergedChain([{ pages: [0], chain: layerChain({ tier: 1, container: "pdf", cap: null, measured_by: "u" }) },
                             { pages: [1], chain: [{ step: "pixels", cap: "C", measured_by: "m", calibration: null },
                                                   { step: "ocr", engine: "tess", version: "5", cap: "C", measured_by: "m", calibration: null }] }]);
  const text = { document: "zero\none", pages: [{ page: 0, text: "zero" }, { page: 1, text: "one" }, { page: 2, text: "", tier: 2 }] };
  const p = await readingProvenance({ text, chain, tier: 3, container: "pdf", planeVersion: "9" });
  assert.equal(p.scheme, PROVENANCE_SCHEME);
  assert.equal(p.text_sha256, hex(flattenText(text).text));
  assert.deepEqual(p.pages.map((x) => [x.page, x.tier, x.member, x.text_sha256 ? "d" : null]),
                   [[0, 1, "plane", "d"], [1, 3, "ocr-worker", "d"], [2, 2, "pdf-worker", null]]);
  assert.ok(p.producers.some((x) => x.member === "ocr-worker" && x.engine === "tess 5"));
  assert.ok(p.producers.some((x) => x.member === "plane" && x.version === "9"));
  const none = await readingProvenance({ text: null });
  assert.equal(none.text_sha256, null);
  assert.ok(none.why);
  const flat = await readingProvenance({ text: "a bare string", tier: null, member: "plane" });
  assert.equal(flat.producers[0].member, "plane");
  assert.match(flat.pages_why, /no per-page grain/);
  const empty = await readingProvenance({ text: "" });
  assert.equal(empty.text_sha256, null);
});

test("R19: compareProvenance answers agrees, differs with the pages grouped by tier and member and its sentence, undetermined when either side carries none, no_text when neither digested; describePages numbers from 1 and folds runs", async () => {
  const mk = (pages) => readingProvenance({ text: { document: pages.map((p) => p.text).join("\n"), pages }, tier: 3, container: "pdf" });
  const a = await mk([{ page: 0, text: "a", tier: 3 }, { page: 1, text: "b", tier: 3 }]);
  const b = await mk([{ page: 0, text: "a", tier: 3 }, { page: 1, text: "B", tier: 3 }]);
  assert.equal(compareProvenance(a, a).state, "agrees");
  const d = compareProvenance(a, b);
  assert.equal(d.state, "differs");
  assert.deepEqual(d.changed[0].pages, [1]);
  assert.equal(d.says, "tier 3 on ocr-worker returned different text for page 2");
  assert.equal(compareProvenance(null, b).state, "undetermined");
  assert.equal(compareProvenance(await readingProvenance({ text: null }), await readingProvenance({ text: null })).state, "no_text");
  assert.equal(describePages([0, 1, 2, 4]), "pages 1-3, 5");
  assert.equal(describePages([3]), "page 4");
});

test("R18: text_sha256 is null with `why` both for absent text and for empty text, and a text that holds a character is digested with no `why`", async () => {
  const absent = await readingProvenance({ text: null });
  assert.equal(absent.text_sha256, null);
  assert.equal(typeof absent.why, "string");
  for (const empty of ["", { document: "", pages: [], counts: { chars: 0, undetermined: 0 } }]) {
    const p = await readingProvenance({ text: empty, tier: 1 });
    assert.equal(p.text_sha256, null);
    assert.equal(p.text_chars, 0);
    assert.ok(typeof p.why === "string" && p.why.length > 0, "empty text says why it is not digested");
  }
  const held = await readingProvenance({ text: "a", tier: 1 });
  assert.equal(held.text_sha256, hex(flattenText("a").text));
  assert.equal("why" in held, false);
});

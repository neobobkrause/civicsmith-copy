/* pdf-reader: the fixtures this module publishes (fixtures.mjs) answer what the module answers, at its interface. A test
 * that uses a published fixture checks the real answer here, so a user's test never stands on a value this module does
 * not give. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { notAPdf, rangedNotes } from "./fixtures.mjs";

test("R1: the published fixture notAPdf answers NOT_A_PDF, from the module's real code", async () => {
  assert.deepEqual(await notAPdf(), { ok: false, container: "pdf", reason: "NOT_A_PDF" });
});

test("R50: the published fixture rangedNotes answers what the module answers (damaged, cut and intact)", async () => {
  const got = await rangedNotes();
  for (const g of [got.intact, got.damaged, got.cut]) {
    assert.deepEqual(g.open, g.whole.filter((n) => n !== "content_stream_undecodable"));
    for (const ranges of [...g.ranges, g.direct]) assert.deepEqual(ranges, g.open);
  }
  assert.deepEqual(got.intact.open, []);
  assert.deepEqual(got.damaged.open, ["xref_reconstructed"]);
  assert.ok(got.cut.open.includes("xref_reconstructed") && got.cut.open.some((n) => n.startsWith("pages_missing:")));
});

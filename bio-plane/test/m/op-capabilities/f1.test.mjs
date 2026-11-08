/* op-capabilities F1 (BD-1; corpus-export R17, R18): the whole-record export's two rows, founder-only as `export` is. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { needsRows } from "../../../src/op-capabilities/index.mjs";

test("F1: exportwhole and exportwholepart each have a present null row — no working capability, an administrator's act as export is — so the census finds a row for each and no capability lets a member through", () => {
  const rows = needsRows();
  for (const op of ["exportwhole", "exportwholepart"]) {
    assert.equal(Object.hasOwn(rows, op), true, `${op}: no row`);
    assert.equal(rows[op], null, op);
  }
  /* control: an op with no row has no key, which is not the same as a stated null */
  assert.equal(Object.hasOwn(rows, "exportwholenosuch"), false);
});

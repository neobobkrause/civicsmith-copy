/* G76 (fix round 7): a CSV or plain text is not a client-rendered shell. Reached through
 * `identify` and `profileRecord` at the module's interface, on the sizes the walker met.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { identify, profileRecord, CONFIDENCE } from "../index.mjs";
import { shellHtml } from "./fixtures.mjs";

const csv = (/** @type {number} */ bytes) => {
  const row = "INFO-2026-0177,2026-03-20,Oakland,Public Works,12345.67,paid\n";
  return "id,date,city,dept,amount,status\n" + row.repeat(Math.ceil(bytes / row.length));
};
const prose = (/** @type {number} */ bytes) => "The harbor reopened today after the council voted. ".repeat(Math.ceil(bytes / 50));

const SIZES = [20 * 1024, 1024 * 1024, 9 * 1000 * 1000];

test("R1 R2 R19 a CSV or plain text, with its type or none, is never taken for a client-rendered shell", () => {
  for (const size of SIZES) {
    for (const text of [csv(size), prose(size)]) {
      for (const content_type of ["text/csv", "text/plain", undefined]) {
        const id = identify({ text, content_type, locator: "https://r.test/file" });
        assert.notEqual(id.handler.key, "client_rendered", `size ${size} type ${content_type}`);
        assert.notEqual(id.kind, "shell");
        const rec = profileRecord(id, { now: "2026-03-20T12:00:00Z" });
        assert.notEqual(rec.handler, "client_rendered");
        assert.ok(!rec.signals.some((s) => /no links/.test(s)), "no shell signal on plain text");
      }
    }
  }
});

test("R1 R2 control: an HTML shell with no prose still matches client_rendered at CERTAIN", () => {
  const id = identify({ text: shellHtml(), content_type: "text/html" });
  assert.equal(id.handler.key, "client_rendered");
  assert.equal(id.confidence, CONFIDENCE.CERTAIN);
  assert.equal(id.kind, "shell");
  const tags = "<span></span>".repeat(300);
  const bare = identify({ text: tags + "x".repeat(2400) });
  assert.equal(bare.handler.key, "client_rendered", "dense markup with no prose is still a shell");
});

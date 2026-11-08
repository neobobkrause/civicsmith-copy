/* screens-publish T53 (JOURNEYS): an import that imported nothing names what is wrong (R103), over case-import's real refusal. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { open, ok, choose, press, main, word, norm } from "./fixtures.mjs";

/** case-import's own answer to a file that is not a case file, made by its real code (`importCaseFile`, R1) */
async function notACaseFile() {
  const { importedWorld } = await import("../case-import/fixtures.mjs");
  const u = await importedWorld();
  return u.ci.importCaseFile({ parts: [new TextEncoder().encode("a plain note, not a case file")], by: "member:alice", viewer: "member:alice" });
}

test("R103 an import refused as not a case file names each way it departs from the format, after the refusal's sentence", async () => {
  const r = await notACaseFile();
  assert.equal(r.reason, "IMPORT_NOT_A_CASE_FILE");
  assert.ok(Array.isArray(r.departures) && r.departures.length > 0, "the provider names its departures");
  const p = await open("/app/imported", { plane: { caseimport: ok(r) } });
  choose(p, "im-file", new TextEncoder().encode("a plain note, not a case file"), "note.txt", "text/plain");
  await press(p, "caseimport", { reason: "R103" });
  const said = main(p).querySelector('[data-gap="refused"]');
  assert.ok(said && norm(said.textContent).includes(norm(word("refusal.IMPORT_NOT_A_CASE_FILE"))), "the refusal's sentence");
  const named = [...said.querySelectorAll("[data-departure]")].map((x) => norm(x.textContent));
  assert.deepEqual(named, r.departures.map(norm), "each departure, in order");
});

test("R103 control: a refusal that names no departure draws its sentence alone", async () => {
  const p = await open("/app/imported", { plane: { caseimport: ok({ ok: false, reason: "IMPORT_PART_TOO_LARGE", code: "IMPORT_PART_TOO_LARGE", part: 0, bytes: 9, bound: 1 }) } });
  choose(p, "im-file", new Uint8Array([1, 2, 3]));
  await press(p, "caseimport", { reason: "R103" });
  assert.equal(main(p).querySelector("[data-departure]"), null);
});

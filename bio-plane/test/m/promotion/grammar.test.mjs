/* promotion's information@2 register grammar (R55, K773): C-18.6 and C-18.7, moved from the catalogue and registered
 * with record-core into record-grammar R28's slot, so the gate (R27) and the audit judge them alike and in order. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { INFO2_GRAMMAR, checkInfo2Contract, promotionOf } from "../../../src/promotion/index.mjs";
import { checkBundle, EXTENSION_ARMS, parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { makeRecord, makeMembership, makePromotion } from "./fixtures.mjs";

const ID = "INFO-2026-0001-report";
const hex = (v) => createHash("sha256").update(typeof v === "string" ? Buffer.from(v, "utf8") : Buffer.from(v)).digest("hex");
const T = "2026-08-01T10:00:00Z";
const md = ({ schema = "information@2", released = false } = {}) => ["---", `id: ${ID}`, "object_type: information",
  `schema: ${schema}`, 'title: "A report"', `current_state: ${released ? "verified" : "collected"}`,
  `prior_state: ${released ? "collected" : "null"}`, 'created: "2026-07-01T00:00:00Z"', `last_updated: "${T}"`,
  ...(released ? ["state_history:", `  - timestamp: "${T}"`, "    from_state: collected", "    to_state: verified",
                  '    blurb: "released"', "    author: member:ann"] : ["state_history: []"]),
  "---", "", "## Summary", "", "x", "", "## Session Log", ""].join("\n");
const CAP = "the captured bytes";
/* A register naming one capture: `stored` is what the bundle holds at `data/cap.txt`, `sha` what the register records. */
const image = ({ stored = CAP, sha = hex(CAP), encoding = "utf8", released = false, signed = false, schema, parts } = {}) => {
  const doc = { file: "data/cap.txt", capture: { sha256: sha, encoding }, ...(parts ? { parts } : {}) };
  const reg = { documents: [doc], releases: signed ? [{ transition: T, signature_file: "data/r.sig", signer: "member:ann" }] : [] };
  return { "bundle.md": md({ released, schema }), "data/provenance.json": JSON.stringify(reg), ...(stored === null ? {} : { "data/cap.txt": stored }) };
};
const ctxOf = (img) => {
  const files = new Map(Object.entries(img));
  return { folderName: ID, files, fm: parseFrontmatter(img["bundle.md"]).data, sha256: async (v) => hex(v) };
};
const arm = async (img) => { const found = []; await checkInfo2Contract(ctxOf(img), found); return found; };

test("R55: the grammar claims C-18.6 and C-18.7, the whole of record-grammar R28's slot", () => {
  assert.deepEqual([...INFO2_GRAMMAR.ids], ["C-18.6", "C-18.7"]);
  assert.ok(Object.isFrozen(INFO2_GRAMMAR) && Object.isFrozen(INFO2_GRAMMAR.ids));
  assert.equal(INFO2_GRAMMAR.arm, checkInfo2Contract);
  const slot = EXTENSION_ARMS.find((a) => a.ids.includes("C-18.6"));
  assert.deepEqual([...slot.ids].sort(), [...INFO2_GRAMMAR.ids].sort());
});

test("R55: promotion registers the grammar with record-core once per record, when it is first reached; a refused registration throws, never leaves it unrun", () => {
  const record = makeRecord();
  const calls = [];
  record.registerGrammar = (module, g) => { calls.push([module, g]); return { ok: true, module, ids: [...g.ids] }; };
  const host = {};
  const p = promotionOf(host, { record, membership: makeMembership() });
  assert.equal(promotionOf(host), p);
  assert.deepEqual(calls, [["promotion", INFO2_GRAMMAR]]);
  /* A second host whose promotion runs over the same record does not register it again. */
  promotionOf({}, { record, membership: makeMembership() });
  assert.deepEqual(calls, [["promotion", INFO2_GRAMMAR]]);
  /* Another record (another host): its own registration. */
  const other = makeRecord();
  promotionOf({}, { record: other, membership: makeMembership() });
  assert.deepEqual(other.grammarList.map((g) => [g.module, [...g.ids]]), [["promotion", ["C-18.6", "C-18.7"]]]);
  /* A record that holds the slot already refuses: the wiring is wrong, and it is said, not swallowed. */
  const held = makeRecord();
  held.registerGrammar = () => ({ ok: false, reason: "GRAMMAR_DECLARED", heldBy: "someone" });
  assert.throws(() => promotionOf({}, { record: held, membership: makeMembership() }), /GRAMMAR_DECLARED \(held by someone\)/);
});

test("R55: C-18.6 — a registered capture's stored bytes must hash to the recorded digest (error); C-18.7 — a release with no signed record (warning); information@2 only", async () => {
  assert.deepEqual(await arm(image()), []);
  const bad = await arm(image({ stored: "other bytes" }));
  assert.deepEqual(bad.map((x) => [x.check, x.severity]), [["C-18.6", "error"]]);
  assert.match(bad[0].message, /^provenance documents\[0\]: stored bytes hash .* but the register records .*silent content mutation fails the gate \(@2\)$/);
  assert.deepEqual([bad[0].repairable, bad[0].repairs.length], [true, 2]);
  /* base64 decodes before hashing; parts hash in order. */
  assert.deepEqual(await arm(image({ stored: Buffer.from(CAP).toString("base64"), encoding: "base64" })), []);
  const parts = [{ file: "data/p1" }, { file: "data/p2" }];
  const split = { ...image({ parts }), "data/p1": CAP.slice(0, 5), "data/p2": CAP.slice(5) };
  assert.deepEqual(await arm(split), []);
  assert.deepEqual((await arm({ ...split, "data/p2": "zzz" })).map((x) => x.check), ["C-18.6"]);
  const mixed = { ...image({ parts, encoding: "binary" }), "data/p1": CAP.slice(0, 5), "data/p2": new TextEncoder().encode(CAP.slice(5)) };
  assert.match((await arm(mixed))[0].message, /could not be decoded for hash verification \(parts mix text and binary storage\)/);
  /* Nothing to judge: not information@2, no register, an unreadable one, an unstated digest. */
  assert.deepEqual(await arm(image({ stored: "other", schema: "information@1" })), []);
  assert.deepEqual(await arm({ "bundle.md": md() }), []);
  assert.deepEqual(await arm({ "bundle.md": md(), "data/provenance.json": "{" }), []);
  assert.deepEqual(await arm(image({ stored: "other", sha: "not-a-digest" })), []);
  /* C-18.7: a release with no signed record warns; a signed one does not. */
  const unsigned = await arm(image({ released: true }));
  assert.deepEqual(unsigned.map((x) => [x.check, x.severity]), [["C-18.7", "warn"]]);
  assert.match(unsigned[0].message, new RegExp(`collected -> verified transition at ${T} has no signed release record`));
  assert.deepEqual(await arm(image({ released: true, signed: true })), []);
});

test("R55: the gate (R27) and the audit judge with the registered grammar in its slot, in today's order: the findings are record-grammar's checkBundle's with the slot filled", async () => {
  const { p, record } = makePromotion();
  assert.deepEqual(record.grammarList.map((g) => g.module), ["promotion"]);
  const img = image({ stored: "other bytes", released: true });
  const gated = await p.runGate({ bundleId: ID, image: img, knownIds: new Set([ID]), hasCapture: async () => ({ present: true }), registers: [] });
  assert.equal(gated.ok, false);
  const c186 = gated.findings.filter((x) => x.check === "C-18.6");
  assert.equal(c186.length, 1);
  /* What the slot answers, run where record-grammar runs it among the structural arms: the same errors, in the same order. */
  const { findings } = await checkBundle({ folderName: ID, files: new Map(Object.entries(img)), elidedPaths: new Set(),
    sha256: async (v) => hex(v), sha512: async (b) => new Uint8Array(createHash("sha512").update(b).digest()),
    resolveTarget: (id) => id === ID, releaseRegistry: null, publishedRegistry: null, publishedCaseRegistry: null, earnedRegistry: null },
    { grammars: [{ module: "promotion", ...INFO2_GRAMMAR }] });
  const errors = findings.filter((x) => x.severity === "error").map((x) => [x.check, x.message]);
  assert.deepEqual(gated.findings.filter((x) => x.check.startsWith("C-") && !["C-4.2", "C-17.2", "C-18.8", "C-20.1"].includes(x.check))
                     .map((x) => [x.check, x.detail]), errors);
  assert.equal(gated.warnings >= 1, true, "C-18.7's warning is counted");
  /* With no grammar registered in the slot, nothing judges C-18.6: no copy is held elsewhere to fall back on. */
  record.grammarList = [];
  const unjudged = await p.runGate({ bundleId: ID, image: img, knownIds: new Set([ID]), hasCapture: async () => ({ present: true }), registers: [] });
  assert.equal(unjudged.findings.some((x) => x.check === "C-18.6"), false);
});

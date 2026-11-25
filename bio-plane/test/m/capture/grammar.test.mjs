/* capture R89 (C-2.7; K585 (3)): the information grammar, registered through record-core's grammar seam (its R67), at
   the module's interface: what `captureOf` registers, that another module's claim on the same slot runs beside it
   (record-core R67 as worded, K766, K783), and what a bundle is judged to be by record-grammar's `checkBundle` given
   `record.grammars()` (what promotion's gate passes, its R27) and by record-core's audit (its R18), with capture's
   grammar and without it: each C-2.7 finding stated case by case (K785: no capture file names the catalogue), every
   other finding unchanged. A fresh store per test; no network. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { storage, provenance } from "./fixture.mjs";
import { captureOf, MONITOR_FREQ, INFORMATION_GRAMMAR, checkInformationExtension } from "../../../src/capture/index.mjs";
import { recordOf } from "../../../src/record-core/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { checkBundle, canonicalJson } from "../../../src/record-grammar/index.mjs";

const hex = (v) => createHash("sha256").update(typeof v === "string" ? Buffer.from(v, "utf8") : Buffer.from(v)).digest("hex");
const T0 = "2026-07-01T00:00:00Z";

/* An information item's `bundle.md`: the core fields, then the information fields, each over-ridable (`undefined`
   drops a field), and the nested `source` and `monitoring` blocks unless a raw block is given. */
function infoDoc(id, over = {}) {
  const fields = { id, object_type: "information", schema: "information@1", title: "A report", current_state: "collected",
    prior_state: null, created: T0, last_updated: T0, group: "test-group", criticality: "supporting", source_status: "unchanged",
    ...over };
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined || k === "source" || k === "monitoring") continue;
    lines.push(`${k}: ${v === null ? "null" : typeof v === "string" && /[:#"]/.test(v) ? JSON.stringify(v) : v}`);
  }
  const block = (name, dflt) => {
    const b = name in over ? over[name] : dflt;
    if (b === undefined) return;
    if (typeof b === "string") { lines.push(`${name}: ${b}`); return; }
    lines.push(`${name}:`);
    for (const [k, v] of Object.entries(b)) lines.push(`  ${k}: ${typeof v === "string" && /[:#"]/.test(v) ? JSON.stringify(v) : v}`);
  };
  block("source", { locator: "https://docs.example.org/report.pdf", authority: "publisher", retrieved: T0 });
  block("monitoring", { enabled: true, frequency: "weekly" });
  lines.push("---", "\n## Session Log\n");
  return lines.join("\n");
}

const dataset = JSON.stringify({ rows: [{ a: 1, b: "two" }] });
const goodHash = `sha256:${hex(canonicalJson(JSON.parse(dataset)))}`;
/* One bundle per arm of the grammar, and bundles it passes or does not judge. */
const CASES = {
  "INFO-2026-0001-clean": { "bundle.md": infoDoc("INFO-2026-0001-clean") },
  "INFO-2026-0002-enums": { "bundle.md": infoDoc("INFO-2026-0002-enums", { criticality: "vital", source_status: "gone" }) },
  "INFO-2026-0003-nosource": { "bundle.md": infoDoc("INFO-2026-0003-nosource", { source: undefined }) },
  "INFO-2026-0004-halfsource": { "bundle.md": infoDoc("INFO-2026-0004-halfsource", { source: { locator: "https://docs.example.org/r" } }) },
  "INFO-2026-0005-monitoring": { "bundle.md": infoDoc("INFO-2026-0005-monitoring", { monitoring: { enabled: "sometimes", frequency: "fortnightly" } }) },
  "INFO-2026-0006-nomonitoring": { "bundle.md": infoDoc("INFO-2026-0006-nomonitoring", { monitoring: undefined }) },
  "INFO-2026-0007-badhash": { "bundle.md": infoDoc("INFO-2026-0007-badhash", { content_hash: "md5:abc" }) },
  "INFO-2026-0008-mismatch": { "bundle.md": infoDoc("INFO-2026-0008-mismatch", { content_hash: `sha256:${"0".repeat(64)}` }),
                               "data/dataset.json": dataset },
  "INFO-2026-0009-hashok": { "bundle.md": infoDoc("INFO-2026-0009-hashok", { content_hash: goodHash }), "data/dataset.json": dataset },
  "INFO-2026-0010-verified": { "bundle.md": infoDoc("INFO-2026-0010-verified", { current_state: "verified", prior_state: "collected" }) },
  "INFO-2026-0011-changes": { "bundle.md": infoDoc("INFO-2026-0011-changes"),
                              "data/changes.json": JSON.stringify({ records: [{ detected: "yesterday", kind: "moved" }] }) },
  "INFO-2026-0012-changeshape": { "bundle.md": infoDoc("INFO-2026-0012-changeshape"), "data/changes.json": JSON.stringify([1, 2]) },
  "PROJ-2026-0001-notinfo": { "bundle.md": infoDoc("PROJ-2026-0001-notinfo", { object_type: "project", schema: "project@1",
                                                                               criticality: "vital", source: undefined }) },
};

/* What C-2.7 says of each case, in order: `[severity, message, repairs?]` (the information grammar's own words). */
const EXPECTED = {
  "INFO-2026-0001-clean": [],
  "INFO-2026-0002-enums": [["error", "criticality 'vital' is not one of: crucial, supporting"], ["error", "source_status 'gone' is not one of: unchanged, modified, removed"]],
  "INFO-2026-0003-nosource": [["error", "source block is missing"]],
  "INFO-2026-0004-halfsource": [["error", "source.authority is missing"], ["error", "source.retrieved is missing"]],
  "INFO-2026-0005-monitoring": [["error", "monitoring.enabled 'sometimes' is not boolean"], ["error", "monitoring.frequency 'fortnightly' is not one of: hourly, daily, weekly, monthly, per_meeting, none"]],
  "INFO-2026-0006-nomonitoring": [["error", "monitoring block is missing"]],
  "INFO-2026-0007-badhash": [["error", "content_hash 'md5:abc…' is not sha256:<64 hex>"]],
  "INFO-2026-0008-mismatch": [["error", "content_hash does not match the canonicalized data/dataset.json (declared 000000000000…, actual eb51f16c324f…)", ["refresh content_hash and append a change record", "restore data/dataset.json from history"]]],
  "INFO-2026-0009-hashok": [],
  "INFO-2026-0010-verified": [["error", "verified state requires a well-formed content_hash"], ["error", "verified state requires data/dataset.json"], ["error", localize("capture.grammar.verified_needs_snapshot", "verified state requires at least one file in snapshots/")]],
  "INFO-2026-0011-changes": [["error", "changes.json records[0] lacks detected/kind/summary in the required shape"]],
  "INFO-2026-0012-changeshape": [["error", "data/changes.json must be {\"records\": [...]}"]],
  "PROJ-2026-0001-notinfo": [],
};
const c27 = (findings) => findings.filter((f) => f.check === "C-2.7")
  .map((f) => (f.repairs ? [f.severity, f.message, f.repairs, f.repairable] : [f.severity, f.message]));
const want = (id) => EXPECTED[id].map((e) => (e.length > 2 ? [...e, true] : e));

const judge = async (id, image, grammars) => {
  const files = new Map(Object.entries(image));
  const { findings } = await checkBundle({ folderName: id, files, elidedPaths: new Set(), sha256: async (v) => hex(v),
    sha512: async (b) => new Uint8Array(createHash("sha512").update(b).digest()), resolveTarget: (t) => t in CASES,
    releaseRegistry: null, publishedRegistry: null, publishedCaseRegistry: null, earnedRegistry: null }, { grammars });
  return findings;
};

function world() {
  const ctx = { storage: storage() };
  const record = recordOf(ctx);
  record.migrate();
  return { ctx, record };
}

/* A store with capture reached (its grammar registered) or not (C-2.7's slot left free, so nothing runs there). */
function hosted({ capture }) {
  const w = world();
  if (capture) captureOf(w.ctx, { record: w.record, provenance: provenance(w.ctx.storage) });
  return w;
}

test("R89 (C-2.7): captureOf registers the information grammar with record-core once per storage, claiming C-2.7 whole; MONITOR_FREQ is the grammar's cadence list", () => {
  const { ctx, record } = world();
  assert.deepEqual(record.grammars(), [], "nothing before capture is reached");
  const c = captureOf(ctx, { record, provenance: provenance(ctx.storage) });
  const g = record.grammars();
  assert.deepEqual(g.map((x) => [x.module, [...x.ids]]), [["capture", ["C-2.7"]]]);
  assert.equal(g[0].arm, checkInformationExtension, "the arm is this module's own");
  assert.deepEqual([[...INFORMATION_GRAMMAR.ids], INFORMATION_GRAMMAR.arm], [["C-2.7"], checkInformationExtension]);
  assert.equal(captureOf(ctx), c);
  assert.equal(record.grammars().length, 1, "reaching the instance again registers nothing more");
  assert.deepEqual([...MONITOR_FREQ], ["hourly", "daily", "weekly", "monthly", "per_meeting", "none"]);
  assert.ok(Object.isFrozen(MONITOR_FREQ));
});

test("R89 (C-2.7; record-core R67, K766): another module's grammar may claim C-2.7's slot too; capture's registration is accepted beside it and both arms run in the slot, in registration order; a refusal R67 still makes is loud, never a grammar silently unrun", async () => {
  const { ctx, record } = world();
  const ran = [];
  assert.equal(record.registerGrammar("elsewhere", { ids: ["C-2.7"], arm: () => { ran.push("elsewhere"); } }).ok, true);
  captureOf(ctx, { record, provenance: provenance(ctx.storage) });
  const g = record.grammars();
  assert.deepEqual(g.map((x) => [x.module, [...x.ids]]), [["elsewhere", ["C-2.7"]]], "one entry for the slot, at its first claimant's place");
  const id = "INFO-2026-0002-enums";
  const findings = await judge(id, CASES[id], g);
  assert.deepEqual(ran, ["elsewhere"], "the other claimant's arm ran in the slot, once");
  const alone = await judge(id, CASES[id], [{ module: "capture", ...INFORMATION_GRAMMAR }]);
  assert.ok(alone.some((f) => f.check === "C-2.7"));
  assert.deepEqual(findings.filter((f) => f.check === "C-2.7"), alone.filter((f) => f.check === "C-2.7"),
                   "capture's arm ran in the slot beside the other claimant");
  /* capture registering twice on one record (a second storage's instance over a shared record) is R67's GRAMMAR_DECLARED */
  const twice = world();
  assert.equal(twice.record.registerGrammar("capture", INFORMATION_GRAMMAR).ok, true);
  assert.throws(() => captureOf(twice.ctx, { record: twice.record, provenance: provenance(twice.ctx.storage) }),
                /refused the information grammar: GRAMMAR_DECLARED \(held by capture\)/);
  /* a record with no seam (a stand-in) is left alone */
  const bare = { storage: storage() };
  const stand = { declarePurge() {}, transact: (fn) => fn() };
  assert.ok(captureOf(bare, { record: stand, governor: {}, provenance: provenance(bare.storage) }));
});

test("R89 (C-2.7): with the grammar registered, record-grammar's checkBundle given record.grammars() (the gate's list) raises exactly C-2.7's findings for each case, in order, and every other finding is what it is without the grammar", async () => {
  const mine = hosted({ capture: true }), none = hosted({ capture: false });
  assert.deepEqual(mine.record.grammars().map((g) => [g.module, [...g.ids]]), [["capture", ["C-2.7"]]]);
  assert.deepEqual(none.record.grammars(), []);
  let judged = 0;
  for (const [id, image] of Object.entries(CASES)) {
    const registered = await judge(id, image, mine.record.grammars());
    const without = await judge(id, image, none.record.grammars());
    assert.deepEqual(c27(registered), want(id), id);
    assert.deepEqual(c27(without), [], `${id}: an unclaimed slot runs nothing`);
    assert.deepEqual(registered.filter((f) => f.check !== "C-2.7"), without, `${id}: no other finding moves`);
    if (EXPECTED[id].length) judged++;
  }
  assert.ok(judged >= 10, `the cases exercise the grammar (${judged} bundles carry a C-2.7 finding)`);
  /* the registered arm is the one that runs: a grammar standing in its place changes the findings */
  const decoy = [{ module: "decoy", ids: ["C-2.7"], arm: () => {} }];
  assert.deepEqual(c27(await judge("INFO-2026-0002-enums", CASES["INFO-2026-0002-enums"], decoy)), []);
});

test("R89 (C-2.7): record-core's audit over the same bundles tallies exactly the grammar's findings with capture's grammar registered, and is otherwise the report it makes without it", async () => {
  const report = async (register) => {
    const { record } = hosted({ capture: register });
    for (const [id, image] of Object.entries(CASES))
      record.transact(() => record.commit({ bundleId: id, type: id.startsWith("PROJ") ? "project" : "information", title: "t",
        snapKey: "k1", kind: "creation", author: "member:ann", state: "collected", group: "test-group", created: T0, lastUpdated: T0, at: T0,
        files: Object.entries(image).map(([path, text]) => ({ path, text, sha256: hex(text) })) }));
    assert.equal(record.grammars().length, register ? 1 : 0);
    return record.auditPass({ limit: 50 });
  };
  const withGrammar = await report(true), without = await report(false);
  assert.equal(withGrammar.checked, Object.keys(CASES).length);
  const expected = Object.values(EXPECTED).reduce((n, list) => n + list.length, 0);
  assert.equal(withGrammar.tally["C-2.7"], expected, JSON.stringify(withGrammar.tally));
  assert.equal(without.tally["C-2.7"], undefined, "an unclaimed slot raises nothing in the audit");
  const drop = (t) => Object.fromEntries(Object.entries(t || {}).filter(([k]) => !k.startsWith("C-2.7")));
  assert.deepEqual(drop(withGrammar.tally), drop(without.tally), "every other check tallies alike");
  assert.deepEqual(drop(withGrammar.tallyDetail), drop(without.tallyDetail));
  const flagged = Object.keys(CASES).filter((id) => EXPECTED[id].length);
  const otherErrors = new Set((without.offenders || []).map((o) => o.bundleId ?? o.id ?? o));
  const offenders = new Set((withGrammar.offenders || []).map((o) => o.bundleId ?? o.id ?? o));
  for (const id of flagged) assert.ok(offenders.has(id), `${id} is an offender with the grammar`);
  assert.equal(withGrammar.withErrors, new Set([...flagged, ...otherErrors]).size);
  assert.equal(withGrammar.clean + withGrammar.withErrors, without.clean + without.withErrors);
});

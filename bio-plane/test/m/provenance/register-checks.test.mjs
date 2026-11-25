/* provenance: the C-18 register arms (R42–R46): each keeps its catalogue id and severity, refuses at the write through
   the module's registered check, and still runs at the gate (`withRegisterChecks`) and in the audit (its registered
   audit check, record-core R59; N92). C-18.6 (R45) hashes stored bytes at the gate (K72 (4)): since T19 promotion's
   information@2 grammar, registered with record-core into record-grammar's checkBundle (promotion R55, K781). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, sha, provDoc, infoMd } from "./fixture.mjs";
import * as provenance from "../../../src/provenance/index.mjs";
import { registerChecks, withRegisterChecks } from "../../../src/provenance/index.mjs";
import { PROVENANCE_ACT_CHECKS } from "../../../src/provenance/checks.mjs";
import { checkBundle, parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const run = (docs, { md = infoMd("INFO-2026-0001-x"), files = {}, reg = null } = {}) => registerChecks({
  files: new Map([["bundle.md", md], ["data/provenance.json", reg ?? JSON.stringify({ documents: docs })], ...Object.entries(files)]),
  fm: parseFrontmatter(md).data });
const cap = { path: "snapshots/a.txt", text: "bytes of a" };
const good = provDoc(cap);
const ids = (f) => f.map((x) => `${x.check}/${x.severity}`);

test("R42: C-18.1, the register's shape, release authority and the sweep fence, as errors", () => {
  assert.deepEqual(run([good], { files: { [cap.path]: cap.text } }), []);
  assert.deepEqual(ids(run([], { reg: JSON.stringify({ nope: 1 }) })), ["C-18.1/error"]);
  const bad = run([{ ...good, file: "missing.txt", locator: "", authority: undefined, authority_state: "sometimes",
                     capture: { grade: "A+", actor_class: "robot" }, origin: { kind: "sweep" } }]);
  const msgs = bad.map((x) => x.message).join("\n");
  for (const m of [/missing 'locator'/, /authority_state 'sometimes'/, /names 'missing.txt'/, /capture missing 'method'/,
                   /grade 'A\+'/, /actor_class 'robot'/, /matched_sweep/, /deeming_actor/]) assert.match(msgs, m);
  assert.equal(bad.every((x) => x.check === "C-18.1" && x.severity === "error"), true);
  /* Undetermined authority needs a basis; determined needs one too. */
  assert.match(run([{ ...good, authority: undefined, authority_state: "undetermined", authority_basis: "" }],
                   { files: { [cap.path]: cap.text } })[0].message, /names no authority_basis/);
  /* An authored observation: no capture grade, actor and origin member. */
  const authored = run([{ ...good, authored: true, capture: { ...good.capture, grade: "B", actor_class: "session" }, origin: { kind: "named_request" } }],
                       { files: { [cap.path]: cap.text } }).map((x) => x.message).join("\n");
  assert.match(authored, /carries capture.grade 'B'/);
  assert.match(authored, /actor_class is 'session', not 'member'/);
  assert.match(authored, /origin.kind is 'named_request', not 'member'/);
  /* A collected -> verified release by a machine; a sweep intake verified without a member's release. */
  const hist = `  - timestamp: "2026-09-20T00:00:00Z"\n    from_state: collected\n    to_state: verified\n    author: token:member`;
  const md = infoMd("INFO-2026-0001-x", { state: "verified", history: hist });
  const machine = run([{ ...good, provenance_chain: [{ who: "x" }], origin: { kind: "sweep", matched_sweep: "s", deeming_actor: "d" } }],
                      { md, files: { [cap.path]: cap.text } });
  assert.equal(machine.some((x) => /release is a named member's decision/.test(x.message)), true);
  assert.equal(machine.some((x) => /sweep-origin intake lands at collected/.test(x.message)), true);
  /* information@2: the register's @2 shapes (encoding, custody, parts, derived, renditions, releases). */
  const md2 = infoMd("INFO-2026-0002-y").replace("schema: information@1", "schema: information@2");
  const at2 = run([{ ...good, capture: { ...good.capture, encoding: "rot13" }, parts: [], derived: {}, renditions: "x" }],
                  { md: md2, files: { [cap.path]: cap.text } }).map((x) => x.message).join("\n");
  for (const m of [/capture.encoding 'rot13'/, /parts must be a nonempty array/, /derived lacks/, /renditions must be an array/])
    assert.match(at2, m);
  assert.deepEqual(ids(registerChecks({ files: new Map([["bundle.md", md2]]), fm: parseFrontmatter(md2).data })), ["C-18.1/error"],
                   "information@2 requires the register");
  /* At the write: refused, naming the findings. */
  const w = world();
  const r = w.promoteInfo("INFO-2026-0003-z", { captures: [cap], docs: [{ ...good, capture: { ...good.capture, method: "" } }] });
  assert.deepEqual([r.ok, r.reason, r.findings[0].check], [false, "PROVENANCE_REGISTER_REFUSED", "C-18.1"]);
  assert.deepEqual([r.code, r.check, r.translation], ["PROVENANCE_REGISTER_REFUSED", "C-103.1",
                   PROVENANCE_ACT_CHECKS.PROVENANCE_REGISTER_REFUSED.translation], "the act's own catalogue row");
  assert.equal(w.head("INFO-2026-0003-z"), null, "nothing written");
});

test("R42: at the write, a revision is refused only for a violation it adds; a replay is exempt", () => {
  const w = world();
  const a = { ...cap };
  /* A bundle held with an inherited violation (written as a replay, as history is). */
  const old = { ...provDoc(a), authority: undefined, authority_state: undefined };
  const r0 = w.promoteInfo("INFO-2026-0001-x", { captures: [a], docs: [old], pkg: { replay: true } });
  assert.equal(r0.ok, true, JSON.stringify(r0));
  /* A revision that keeps the inherited violation and adds nothing is accepted: correction moves forward. */
  const r1 = w.promoteInfo("INFO-2026-0001-x", { captures: [a], docs: [old], base: w.head("INFO-2026-0001-x").bundleSha });
  assert.equal(r1.ok, true, JSON.stringify(r1));
  /* One that adds a violation is refused, naming only the added one. */
  const r2 = w.promoteInfo("INFO-2026-0001-x", { captures: [a], docs: [{ ...old, locator: "" }], base: w.head("INFO-2026-0001-x").bundleSha });
  assert.equal(r2.reason, "PROVENANCE_REGISTER_REFUSED");
  assert.deepEqual(r2.findings.map((f) => f.detail), ["provenance documents[0] missing 'locator'"]);
  /* A bundle that is not information, or carries no register, is not asked. */
  const w2 = world();
  const q = w2.promotion.promote({ bundleId: "INFO-2026-0002-n", base: null, snapKey: "n", author: "member:a",
    meta: { object_type: "information" }, files: [{ path: "bundle.md", text: infoMd("INFO-2026-0002-n") }] });
  assert.equal(q.ok, true);
});

test("R43: C-18.3, one capture once in a register, raw or by determined evidentiary digest", () => {
  const b = { path: "snapshots/b.txt", text: "bytes of b" };
  const files = { [cap.path]: cap.text, [b.path]: b.text };
  assert.deepEqual(ids(run([good, provDoc(cap)], { files })), ["C-18.3/error"]);
  const dg = (e, determined = true) => ({ profile: { digests: { determined, evidentiary: e } } });
  assert.deepEqual(ids(run([{ ...good, ...dg("e1") }, { ...provDoc(b), ...dg("e1") }], { files })), ["C-18.3/error"]);
  assert.deepEqual(run([{ ...good, ...dg(null, false) }, { ...provDoc(b), ...dg(null, false) }], { files }), [],
                   "an undetermined digest is never compared");
  const w = world();
  const r = w.promoteInfo("INFO-2026-0001-x", { captures: [cap], docs: [good, provDoc(cap)] });
  assert.equal(r.findings[0].check, "C-18.3");
});

test("R44: C-18.4, a crucial document with neither co-archive nor timestamp is flagged as a warning, never refused", () => {
  const md = infoMd("INFO-2026-0001-x", { criticality: "crucial" });
  const f = run([good], { md, files: { [cap.path]: cap.text } });
  assert.deepEqual(ids(f), ["C-18.4/warn"]);
  assert.deepEqual(run([{ ...good, timestamp: { authority: "t" } }], { md, files: { [cap.path]: cap.text } }), []);
  assert.deepEqual(run([{ ...good, co_archive: { locator: "x" } }], { md, files: { [cap.path]: cap.text } }), []);
  const w = world();
  assert.equal(w.promoteInfo("INFO-2026-0002-c", { captures: [cap], criticality: "crucial" }).ok, true);
});

test("R45: C-18.6, every registered capture's stored bytes hash to the recorded digest, at the gate", async () => {
  const md = infoMd("INFO-2026-0001-x").replace("schema: information@1", "schema: information@2");
  const hash = async (v) => sha(typeof v === "string" ? v : Buffer.from(v));
  /* The gate runs record-grammar's checkBundle with the grammars the record holds (promotion R27); C-18.6 is
     promotion's, registered with record-core once per record when promotion is built (its R55, K781). */
  const w = world();
  const grammars = w.record.grammars();
  assert.deepEqual(grammars.filter((g) => g.ids.includes("C-18.6")).map((g) => [g.module, [...g.ids].sort()]),
                   [["promotion", ["C-18.6", "C-18.7"]]], "C-18.6 is registered, by promotion, with C-18.7");
  const run = (docs, files, opts) => checkBundle({ folderName: "INFO-2026-0001-x", sha256: hash,
    files: new Map([["bundle.md", md], ["data/provenance.json", JSON.stringify({ documents: docs })], ...Object.entries(files)]) }, opts);
  const gate = async (docs, files) => (await run(docs, files, { grammars })).findings.filter((x) => x.check === "C-18.6");
  const doc = { ...good, capture: { ...good.capture, sha256: sha(cap.text), encoding: "utf8" } };
  assert.deepEqual(await gate([doc], { [cap.path]: cap.text }), []);
  const moved = await gate([doc], { [cap.path]: "mutated bytes" });
  assert.deepEqual(moved.map((x) => x.severity), ["error"]);
  assert.match(moved[0].message, /silent content mutation/);
  /* Parts stream in order; a base64 capture decodes first; undecodable bytes are refused with the reason. */
  const p1 = "first half ", p2 = "second half";
  const partsDoc = { ...doc, capture: { ...doc.capture, sha256: sha(p1 + p2) },
                     parts: [{ file: "p0", sha256: sha(p1), bytes: p1.length }, { file: "p1", sha256: sha(p2), bytes: p2.length }] };
  assert.deepEqual(await gate([partsDoc], { p0: p1, p1: p2 }), []);
  assert.equal((await gate([partsDoc], { p0: p2, p1: p1 })).length, 1, "order matters");
  const b64 = { ...doc, capture: { ...doc.capture, encoding: "base64", sha256: sha(cap.text) } };
  assert.deepEqual(await gate([b64], { [cap.path]: Buffer.from(cap.text).toString("base64") }), []);
  const undecodable = await gate([b64], { [cap.path]: "***not base64***" });
  assert.match(undecodable[0].message, /could not be decoded/);
  /* The slot is filled by the registration alone: with no grammar, nothing hashes the bytes. */
  assert.deepEqual((await run([doc], { [cap.path]: "mutated bytes" }, {})).findings.filter((x) => x.check === "C-18.6"), []);
});

test("R46: C-18.9, at or past verified every document records a chain whose hops name their attestors, and its authority", () => {
  const md = infoMd("INFO-2026-0001-x", { state: "verified" });
  const f = (d) => run([d], { md, files: { [cap.path]: cap.text } }).filter((x) => x.check === "C-18.9");
  const absent = f(good);
  assert.deepEqual([absent.length, absent[0].code, absent[0].severity], [1, "chain-absent", "error"]);
  assert.equal(f({ ...good, provenance_chain: null })[0].code, "chain-not-an-array");
  assert.equal(f({ ...good, provenance_chain: [] })[0].code, "chain-empty");
  assert.match(f({ ...good, provenance_chain: [{ who: " " }] })[0].message, /names no attestor/);
  assert.deepEqual(f({ ...good, provenance_chain: [{ who: "instance x" }] }), []);
  assert.match(f({ ...good, provenance_chain: [{ who: "x" }], authority: undefined, authority_state: "undetermined", authority_basis: "" })[0].message,
               /states no authority_basis/);
  assert.match(f({ ...good, provenance_chain: [{ who: "x" }], authority: "", authority_state: "determined" })[0].message,
               /no authority named/);
  /* Below verified the arm does not apply. */
  assert.deepEqual(run([good], { files: { [cap.path]: cap.text } }).filter((x) => x.check === "C-18.9"), []);
});

test("R42–R46: the arms still run at the gate and in the audit, so moving them lost none", async () => {
  const md = infoMd("INFO-2026-0001-x", { state: "verified" });
  const image = { "bundle.md": md, "data/provenance.json": JSON.stringify({ documents: [good] }), [cap.path]: cap.text };
  const gated = withRegisterChecks(image, { gateVersion: "g", ok: true, findings: [], warnings: 0 });
  assert.deepEqual([gated.ok, gated.findings.map((x) => x.check)], [false, ["C-18.9"]]);
  const clean = withRegisterChecks({ ...image, "bundle.md": infoMd("INFO-2026-0001-x") }, { gateVersion: "g", ok: true, findings: [], warnings: 2 });
  assert.deepEqual([clean.ok, clean.warnings], [true, 2]);
  /* The audit (N92): the arms are provenance's registered audit check (record-core R59), so record-core's own pass
     over a page counts a bundle held with a C-18 violation (a replay) with errors, once, tallied under its check;
     no wrapper of this module's stands between the audit and the pass. */
  assert.equal("provenanceAudit" in provenance, false, "the wrapper is gone");
  const w = world();
  w.promoteInfo("INFO-2026-0001-x", { captures: [cap], state: "verified", pkg: { replay: true } });
  w.promoteInfo("INFO-2026-0002-y", { captures: [{ path: "snapshots/y.txt", text: "bytes of y" }] });
  const pass = await w.record.auditPass({ after: "", limit: 10, visible: () => true });
  assert.equal(pass.tally["C-18.9"], 1, JSON.stringify(pass.tally));
  assert.equal(pass.tallyDetail["C-18.9/chain-absent"], 1);
  assert.deepEqual(Object.keys(pass.tally).filter((k) => k.startsWith("C-18.")), ["C-18.9"],
                   "the violating bundle's one finding, and nothing from the conformant register");
  /* The fixture's bundle.md also carries catalogue findings (C-2.2), so both bundles are offenders; the one that also
     breaks C-18 is still one bundle with errors, never two. */
  assert.deepEqual([pass.checked, pass.clean, pass.withErrors, pass.offenders.length], [2, 0, 2, 2], "each bundle judged once, whole");
  /* Registered once: a second registration by this module is refused by record-core. */
  assert.equal(w.record.registerAuditCheck("provenance", () => []).reason, "AUDIT_CHECK_DECLARED");
});

/* N381 (K560): capture R65's pulled-knock document, field for field as `capture.pullKnock` writes it (its
   `#pulledDocument`; control-plane R36's provisional document is the same shape less `profile`, `provenance_chain` and
   `knocker_note`). Copied, not imported: `capture` is later in the order than this module, so its tests cannot load it
   (P4); control-plane's end-to-end filing runs this module and capture together (its R36). `profile` is capture's own
   and the register arms read only its `digests` (C-18.3), so it carries what an undetermined profile carries. */
function pulledKnock({ knockId = "KNOCK-20260930-0a1b2c3d", bytes = "knock bytes", by = "member:ruth",
                       at = "2026-09-30T12:00:00Z", received = "2026-09-30T11:00:00Z" } = {}) {
  const locator = `knock:${knockId}`;
  return {
    file: `snapshots/${knockId}`, locator, retrieved: at,
    profile: { digests: { determined: false, evidentiary: null } },
    authority_state: "undetermined",
    authority_basis: word("doorbell.authority_basis", { at: String(at) }),
    provenance_chain: [{
      who: "instance test-instance (CivicOS/0.0.0)",
      asserts: `knock ${knockId} was received at ${received} and filed by ${by} at ${at}`,
      evidence: `knock receipt ${knockId}: digest and instant`,
      bound: false, via: "doorbell",
    }],
    capture: {
      method: "knock-received-fixture",
      grade: null, grade_basis: "CAPTURE_RECEIVED_NOT_FETCHED",
      actor_class: "member", actor: by,
      sha256: sha(bytes), encoding: "binary", bytes: Buffer.byteLength(bytes),
    },
    source: { kind: "knocker", named: false, pseudonym: null,
              receipt: { knock_id: knockId, sha256: sha(bytes), bytes: Buffer.byteLength(bytes), received } },
    knocker_note: { text: "about the budget", words_of: "the knocker", evidence_of_truth: false },
    origin: { kind: "doorbell", knock_id: knockId },
    attestation_attempts: [],
  };
}
const at2 = (id, opts) => infoMd(id, opts).replace("schema: information@1", "schema: information@2");
/* The arms over a pulled knock's bundle, its bytes held as a blob at the document's own `file`, as the pull files it. */
const runPulled = (docs, md = at2("INFO-2026-0001-knock")) => registerChecks({
  files: new Map([["bundle.md", md], ["data/provenance.json", JSON.stringify({ documents: docs })]]),
  elided: docs.map((d) => d.file), fm: parseFrontmatter(md).data });

test("R42, R51 (N381): C-18.1 admits capture R65's pulled-knock document: no letter on the doorbell basis, origin doorbell", () => {
  const doc = pulledKnock();
  assert.equal(provenance.RECEIVED_NOT_FETCHED, "CAPTURE_RECEIVED_NOT_FETCHED", "the one spelling of R51's basis");
  assert.equal(provenance.DOORBELL_ORIGIN, "doorbell");
  /* The document as the pull writes it passes every arm, at information@1 and @2, collected and verified (a named
     member's release; its chain names its attestor, C-18.9). */
  assert.deepEqual(runPulled([doc]), []);
  assert.deepEqual(runPulled([doc], infoMd("INFO-2026-0001-knock")), []);
  const hist = `  - timestamp: "2026-09-30T13:00:00Z"\n    from_state: collected\n    to_state: verified\n    author: member:sam`;
  assert.deepEqual(runPulled([doc], at2("INFO-2026-0001-knock", { state: "verified", history: hist })), []);
  /* `grade: null` stated, or absent: both are no letter. */
  const { grade: _g, ...noGrade } = doc.capture;
  assert.deepEqual(runPulled([{ ...doc, capture: noGrade }]), []);
  /* Negative controls, each the one finding the rule names. A letter on received material; the basis absent or
     another; a kind the register does not know. */
  const one = (d) => { const f = runPulled([d]); assert.equal(f.length, 1, JSON.stringify(f)); assert.deepEqual(ids(f), ["C-18.1/error"]); return f[0].message; };
  for (const g of ["B", "A", "C", "D", ""])
    assert.match(one({ ...doc, capture: { ...doc.capture, grade: g } }), new RegExp(`received through the doorbell and carries capture.grade '${g}'`));
  assert.match(one({ ...doc, capture: { ...doc.capture, grade_basis: undefined } }), /grade_basis is 'undefined', not 'CAPTURE_RECEIVED_NOT_FETCHED'/);
  assert.match(one({ ...doc, capture: { ...doc.capture, grade_basis: "CAPTURE_ROUTE_UNRECORDED" } }), /not 'CAPTURE_RECEIVED_NOT_FETCHED'/);
  /* A kind the register does not know is no doorbell document either, so it also owes a letter. */
  assert.deepEqual(runPulled([{ ...doc, origin: { kind: "knocked" } }]).map((x) => x.message),
    ["provenance documents[0].capture.grade 'null' is not one of: A, B, C",
     "provenance documents[0].origin.kind must be one of: named_request, sweep, member, doorbell, upload"]);
  /* The doorbell basis excuses only a doorbell document: a fetched one stating it still owes a letter. */
  assert.match(one({ ...doc, origin: { kind: "named_request" } }), /capture.grade 'null' is not one of: A, B, C/);
  /* Received material is not a member's authored observation: an authored claim keeps the authored arm's rules. */
  assert.match(runPulled([{ ...doc, authored: true }]).map((x) => x.message).join("\n"), /origin.kind is 'doorbell', not 'member'/);
  /* A fetched document is judged as before. */
  assert.deepEqual(run([good], { files: { [cap.path]: cap.text } }), []);
});

test("R42, R51 (N381): at the write, a pulled knock's bundle is filed with its register row; a letter on it is refused", () => {
  const w = world();
  const bytes = "knock bytes";
  const id = "INFO-2026-0001-doorbell-knock";
  const file = (doc) => ({
    bundleId: id, base: null, snapKey: `k${Math.random().toString(16).slice(2)}`, author: "member:ruth",
    meta: { object_type: "information" },
    files: [{ path: "bundle.md", text: at2(id) }, { path: "data/provenance.json", text: JSON.stringify({ documents: [doc] }, null, 2) },
            { path: doc.file, blobSha: sha(bytes), sha256: sha(bytes), bytes: Buffer.byteLength(bytes) }],
    register: [{ sha256: sha(bytes), path: doc.file, encoding: "binary", bytes: Buffer.byteLength(bytes) }] });
  /* A letter is refused, naming the finding, with nothing written. */
  const before = w.snapshot();
  const lettered = pulledKnock({ bytes });
  const refused = w.promotion.promote(file({ ...lettered, capture: { ...lettered.capture, grade: "B" } }));
  assert.deepEqual([refused.ok, refused.reason, refused.findings.map((x) => x.check)], [false, "PROVENANCE_REGISTER_REFUSED", ["C-18.1"]]);
  assert.match(refused.findings[0].detail, /received through the doorbell/);
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* The document as the pull writes it is filed, and its capture registered to the bundle. */
  const doc = pulledKnock({ bytes });
  const r = w.promotion.promote(file(doc));
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.equal(w.prov.homeOf(sha(bytes)).bundleId, id);
  /* With the pull's receipt, the capture's grade is R51's: no fetched letter, on the same basis the document states. */
  w.prov.recordReceipt({ address: doc.locator, addressNorm: doc.locator, captureSha: sha(bytes), retrieved: doc.retrieved, via: "doorbell" });
  const g = w.prov.captureGrade(sha(bytes));
  assert.deepEqual([g.grade, g.route, g.basis], [null, "doorbell", doc.capture.grade_basis]);
});

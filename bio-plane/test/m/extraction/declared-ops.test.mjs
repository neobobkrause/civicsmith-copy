/* extraction R79 (T51; K4168): each op this module declares in DECLARED_OPS is held true against the op as the door runs it
   (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one is refused
   naming it, and a field outside accepts is dropped or refused naming it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { DECLARED_OPS, extractionOps } from "../../../src/extraction/index.mjs";
import { fresh, bundle, hold, homesOver } from "./fixture.mjs";
import { keptAwayProject } from "../ai-accounts/fixtures.mjs";
/* the composition root's transcriber, as pagetranscribe.test.mjs restates it: the bar of run-rules R19 held on a one-matter set, the capture's project kept away from the AI */
const ONE_MATTER = { id: "t-set", version: 2, matters: [{ id: "m1" }] };
const PASSED = { part: "transcribe", set: "t-set", set_version: 2, false_alarm_rate: 0, passed: true, graded_by: "harness", at: "2026-10-01" };
const KEPT = (await keptAwayProject({ project: "PROJ-H", use: "transcribe" })).aiKeptAway;
const transcriber = { deployable: () => ONE_MATTER.matters.length > 0 && PASSED.passed === true && PASSED.set === ONE_MATTER.id && PASSED.set_version === ONE_MATTER.version,
  keptAway: () => KEPT, transcription: () => { throw new Error("a kept-away capture reaches no account"); } };
/* a store holding one stored reading of a capture filed in a project, and the transcriber registered */
const mkRead = async () => {
  const w = fresh();
  bundle(w.s, "B-1", { project: "PROJ-1", type: "information" });
  const d = await hold(w.evidence, "%PDF-1.7 declared");
  w.x.writeReading({ bundleId: "B-1", captureSha: d, reading: { content_type: "generic", reader_version: 1, read_from_text: false, found: false,
    entities: [], facts: {}, at: "2026-09-01T00:00:00Z", basis: "b", text_source: null, page_count: 3, container_extent: { container: "pdf", levels: ["images"], images: [] } } });
  assert.equal(w.x.registerTranscriber("plane", transcriber).ok, true);
  return { ...w, d };
};
const stored = (fields, env) => ({ ...fields, ...("sha256" in fields ? { sha256: env.d } : {}) });
/* the answer is {status, body}; a refusal names the digest by the code that says no reading of it is held, the flag by its own */
const sameAnswer = (x, y) => x && y && x.status === y.status && x.body?.ok === y.body?.ok && x.body?.reason === y.body?.reason;
const namedByCode = (answer, field) => {
  const reason = answer && answer.body && answer.body.reason;
  return (field === "sha256" && (reason === "REEXTRACT_NOT_READ" || reason === "EVIDENCE_NOT_HELD")) || (field === "ocr" && reason === "REEXTRACT_FLAG_MALFORMED");
};

/* a refusal names a field by its code (the table) or, as the default does, by the field as a whole word of its code or detail */
const words = (v) => (v == null ? "" : typeof v === "string" ? v : JSON.stringify(v));
const named = (codes, strict = false) => (answer, field) => {
  if (!answer || typeof answer !== "object") return false;
  if ((codes[field] || []).some((c) => answer.code === c || answer.reason === c || answer.error === c)) return true;
  return !strict && new RegExp(`(^|[^\\w])${field}($|[^\\w])`).test([answer.code, answer.detail].map(words).join(" "));
};
/* the call as the door runs it: the stamps and every field in the address, the fields as the body, the arm asked of a fresh owner */
const mk = (op, stamps = {}, setup = null, invoke = null, adapt = null) => async (given) => {
  const env = setup ? await setup() : await (mkRead());
  const fields = adapt ? adapt(given, env) : given;
  const q = new URLSearchParams({ op, ...stamps, ...Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, typeof v === "string" ? v : JSON.stringify(v)])) });
  const url = new URL("http://x/?" + q);
  return invoke ? await invoke(url, fields, env, op) : await (extractionOps(env.x, url, fields, {})[op]());
};

test("R79 extraction declares pagetranscribe: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "pagetranscribe", declaration: DECLARED_OPS["pagetranscribe"], call: mk("pagetranscribe", {"cls":"member","session":"1","caps":"contribute","viewer":"class:admin","author":"member:m1"}, null, null, (fields, env) => (stored(fields, env))),
    refusedNaming: namedByCode, same: sameAnswer });
});

test("R79 extraction declares pdfstructure: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "pdfstructure", declaration: DECLARED_OPS["pdfstructure"], call: mk("pdfstructure", {"cls":"member","session":"1","caps":"contribute","viewer":"class:admin","author":"member:m1"}, null, null, (fields, env) => (stored(fields, env))),
    refusedNaming: namedByCode, same: sameAnswer });
});

/* a record stored unread (a home the register names, its whole held, no reading), and `op=readheld` asked of it */
test("R79 R80 extraction declares readheld: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  const setup = async () => {
    const rows = new Map();
    const w = fresh({ provenance: homesOver(rows) });
    bundle(w.s, "INFO-80");
    const d = await hold(w.evidence, "%PDF-1.7 declared readheld");
    rows.set(d, { bundleId: "INFO-80", path: "a.pdf", encoding: "binary", bytes: 26, registered: "t", authored: false });
    return { ...w, d };
  };
  await declaredOpHolds({ op: "readheld", declaration: DECLARED_OPS["readheld"],
    call: mk("readheld", { viewer: "class:admin" }, setup, null, (fields, env) => ("sha" in fields ? { ...fields, sha: env.d } : fields)),
    refusedNaming: (a, f) => f === "sha" && !!a && a.reason === "NO_SHA",
    same: (x, y) => !!x && !!y && x.ok === y.ok && x.reason === y.reason });
});

/* R79 R76 (fix round 6, G13; K4577): `reading` takes `after`, a unit's seq, beside the digest it requires. */
test("R79 R76 extraction declares reading: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  const setup = async () => {
    const w = fresh();
    bundle(w.s, "B-1", { type: "information" });
    const d = await hold(w.evidence, "a declared reading");
    w.x.writeReading({ bundleId: "B-1", captureSha: d, reading: { found: false, entities: [], basis: "b" }, composed: true });
    return { ...w, d };
  };
  await declaredOpHolds({ op: "reading", declaration: DECLARED_OPS["reading"],
    call: mk("reading", { viewer: "class:admin" }, setup, async (url, fields, env) => extractionOps(env.x, url, fields, {}).reading(),
      (fields, env) => (fields && "sha256" in fields ? { ...fields, sha256: env.d } : fields)),
    refusedNaming: (a, f) => f === "sha256" && !!a && a.reason === "NO_SHA",
    same: (x, y) => !!x && !!y && x.ok === y.ok && x.reason === y.reason });
});

/* F1 (surface-declarations R17, F1; BOB's grade, 5 Nov): the interpretation ops, interpretPart (R114) as `interpretmark` and
   interpretationWithdraw (R118), are declared reversible, mutating and refused to a machine. No door arm serves either yet, so the
   row is held against the grade, and against the service's own refusal of a machine identity (R114, R118: MEMBER_SESSION_REQUIRED). */
test("F1 extraction declares interpretmark and interpretationwithdraw reversible, mutating and refused to a machine", async () => {
  for (const op of ["interpretmark", "interpretationwithdraw"]) {
    const d = DECLARED_OPS[op];
    assert.ok(d, `${op} is declared`);
    assert.equal(d.weight, "reversible", op);
    assert.equal(d.mutating, true, op);
    assert.deepEqual(d.machineClasses, [], op);
    assert.equal(typeof d.description, "string", op);
    assert.ok(d.description.length > 0, op);
    for (const f of d.fields.requires) assert.ok(d.fields.accepts.includes(f), `${op}: ${f} required and accepted`);
  }
  assert.deepEqual(DECLARED_OPS.interpretmark.fields.requires, ["capture","part","project","how"]);
  assert.deepEqual(DECLARED_OPS.interpretationwithdraw.fields.requires, ["id"]);
  const w = fresh();
  const machine = "class:admin";
  assert.equal((await w.x.interpretPart({ capture: "a".repeat(64), part: { kind: "sheet-range", sheet: "S", from_row: 1, to_row: 2 }, project: "P", how: "opened", by: machine })).reason ?? null, "MEMBER_SESSION_REQUIRED");
  assert.equal((w.x.interpretationWithdraw({ id: "I-1", by: machine })).reason ?? null, "MEMBER_SESSION_REQUIRED");
});

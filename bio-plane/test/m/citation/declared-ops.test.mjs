/* citation R18, R19 (T51; K4168, K4202): each op this module declares in DECLARED_OPS is held true against the op as the door
   runs it (test-support R15): only its requires raise no refusal naming a declared field, a call without each required one
   is refused naming it, and a field outside accepts is dropped or refused naming it. Every call is a fresh world, so a call
   that writes leaves the next one a clean start. */
import test from "node:test";
import assert from "node:assert/strict";
import { declaredOpHolds } from "../../declared-ops.mjs";
import { world, V } from "./fixture.mjs";
import { DECLARED_OPS, citationOps } from "../../../src/citation/index.mjs";
import { acceptedWorkOf } from "../../../src/accepted-work/index.mjs";
import { importedFindingRef } from "../../../src/inquiry-grammar/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";

const IMP = "c".repeat(64), FIND = "INFO-2026-0007-x", REF = importedFindingRef(IMP, FIND);
const Q = "INQ-2026-0001-q", DOC = "INFO-2026-0001-doc";
const ANN = { viewer: V("ann"), author: V("ann"), identity: V("ann"), owner: "o" };
const sameCode = (x, y) => x && y && x.ok === y.ok && (x.code ?? x.reason) === (y.code ?? y.reason);

/* a refusal names a field by the codes the table lists for it (an answer's `code` or `reason`) */
const named = (codes) => (answer, field) => !!answer && typeof answer === "object"
  && (codes[field] || []).some((c) => answer.code === c || answer.reason === c);

/* a world with a question, a document, an accepted edition 3 of another team's finding, a case and a selection of the document */
async function mkWorld({ cited = false, severed = false, imported = false } = {}) {
  const w = world({ inquiry: true });
  w.inquiry(Q);
  w.info(DOC);
  acceptedWorkOf(w.host).registerAcceptedWork("case-import", {
    finding: ({ ref, edition }) => (ref === REF && edition === 3
      ? { ref, import: IMP, group: "g2", case: "C-1", edition: 3, finding: FIND, pair: { capture: "B", connection: "C" },
          acceptance: { by: "member:zed", at: "2026-09-27T10:00:00Z", reason: "held", checked: [], gaps: [] } } : null),
    openFlags: () => ({ flags: [], complete: true }), withdrawals: () => ({ withdrawals: [], cursor: null }) });
  w.p = w.project("A case", "ann");
  w.handle = await w.select([DOC]);
  if (cited) assert.equal(w.cit.cite({ project: w.p, handle: w.handle, ...ANN }).ok, true);
  if (severed) assert.equal(w.cit.sever({ project: w.p, handle: w.handle, ...ANN, reason: "wrong" }).ok, true);
  if (imported) assert.equal(w.cit.citeImported({ inquiry: Q, import: IMP, finding: FIND, edition: 3, role: "supports", ...ANN }).ok, true);
  return w;
}

/* the call as the door runs it: every field in the address, the stamps beside them; the sample ids stand for the world's */
const mk = (op, setup, stamps = ANN) => async (given) => {
  const w = await mkWorld(setup);
  const real = { ...given };
  if (real.project !== undefined) real.project = op === "cite" || op === "drawquestion" || op === "sever" || op === "reinstate" ? w.p : real.project;
  if (real.handle !== undefined) real.handle = w.handle;
  if (real.inquiry !== undefined) real.inquiry = Q;
  /* C31: `cite` is a write, so its fields travel in the body; the other ops' stay in the address */
  const fields = Object.fromEntries(Object.entries(real).map(([k, v]) => [k, String(v)]));
  const inBody = op === "cite";
  const q = new URLSearchParams({ ...stamps, ...(inBody ? {} : fields) });
  return citationOps(w.cit, new URL(`http://x/?${q}`), inBody ? fields : null)[op]();
};

test("R18 citation declares citeimported: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "citeimported", declaration: DECLARED_OPS.citeimported, call: mk("citeimported", {}),
    refusedNaming: named({ inquiry: ["NO_SUCH_PROJECT"], import: ["IMPORTED_REF_MALFORMED"], finding: ["IMPORTED_REF_MALFORMED"],
                           edition: ["IMPORTED_EDITION_MALFORMED"], role: ["NO_ROLE"] }),
    values: { inquiry: Q, import: IMP, finding: FIND, edition: "3", role: "supports" }, same: sameCode });
});

test("R18 citation declares withdrawimported: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "withdrawimported", declaration: DECLARED_OPS.withdrawimported, call: mk("withdrawimported", { imported: true }),
    refusedNaming: named({ inquiry: ["NO_SUCH_PROJECT"], import: ["NOT_CITED"], finding: ["NOT_CITED"], reason: ["NO_REASON"] }),
    values: { inquiry: Q, import: IMP, finding: FIND, reason: "the case was re-opened" }, same: sameCode });
});

test("R19 citation declares cite: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "cite", declaration: DECLARED_OPS.cite, call: mk("cite", {}),
    refusedNaming: named({ project: ["NO_SUCH_PROJECT"], handle: ["CITE_ONE_SOURCE"], found: ["CITE_ONE_SOURCE"] }),
    values: { project: "sample", handle: "sample" }, same: sameCode });
});

test("R19 citation declares drawquestion: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "drawquestion", declaration: DECLARED_OPS.drawquestion, call: mk("drawquestion", {}),
    refusedNaming: named({ project: ["NO_SUCH_PROJECT"], inquiry: ["NO_SUCH_QUESTION"] }),
    values: { project: "sample", inquiry: Q }, same: sameCode });
});

test("R19 citation declares sever: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "sever", declaration: DECLARED_OPS.sever, call: mk("sever", { cited: true }),
    refusedNaming: named({ project: ["NO_SUCH_PROJECT"], handle: ["NO_SUCH_SELECTION", "SELECTION_NOT_FOUND", "HANDLE_UNKNOWN", "NO_SELECTION"], reason: ["NO_REASON"] }),
    values: { project: "sample", handle: "sample", reason: "wrong edition" }, same: sameCode });
});

test("R19 citation declares reinstate: its requires alone raise no refusal naming a field, each missing one is refused naming it, and a field outside accepts is dropped or refused", async () => {
  await declaredOpHolds({ op: "reinstate", declaration: DECLARED_OPS.reinstate, call: mk("reinstate", { cited: true, severed: true }),
    refusedNaming: named({ project: ["NO_SUCH_PROJECT"], handle: ["NO_SUCH_SELECTION", "SELECTION_NOT_FOUND", "HANDLE_UNKNOWN", "NO_SELECTION"], reason: ["NO_REASON"] }),
    values: { project: "sample", handle: "sample", reason: "the edition was right" }, same: sameCode });
});

test("R18, R19: the declaration is whole: each op names its class, weight and description, the new ops refuse a machine session by class, and every sentence is read by key", () => {
  assert.deepEqual(Object.keys(DECLARED_OPS), ["cite", "drawquestion", "sever", "reinstate", "leggrade", "citeimported", "withdrawimported"]);
  for (const [op, row] of Object.entries(DECLARED_OPS)) {
    assert.equal(row.mutating, true, op);
    assert.ok(["reversible", "reasoned"].includes(row.weight), op);
    assert.ok(typeof row.description === "string" && row.description.length > 20, op);
    assert.ok(Array.isArray(row.fields.accepts) && Array.isArray(row.fields.requires), op);
    for (const r of row.fields.requires.flat()) assert.ok(row.fields.accepts.includes(r), `${op}: requires ${r} is accepted`);
  }
  for (const op of ["leggrade", "citeimported", "withdrawimported"]) {
    assert.deepEqual(DECLARED_OPS[op].classes, ["admin", "member"], op);
    assert.deepEqual(DECLARED_OPS[op].machineClasses, [], op);
  }
  assert.equal(DECLARED_OPS.citeimported.weight, "reversible");
  assert.equal(DECLARED_OPS.withdrawimported.weight, "reasoned");
  assert.deepEqual(DECLARED_OPS.citeimported.fields, { accepts: ["inquiry", "import", "finding", "edition", "role", "note"], requires: ["inquiry", "import", "finding", "edition", "role"] });
  assert.deepEqual(DECLARED_OPS.withdrawimported.fields, { accepts: ["inquiry", "import", "finding", "reason"], requires: ["inquiry", "import", "finding", "reason"] });
  /* B5 (K4210): cite requires a project and a handle or a found passage; role is accepted, not required (a case's cite refuses one) */
  assert.deepEqual(DECLARED_OPS.cite.fields.requires, ["project", ["handle", "found"]]);
  assert.ok(DECLARED_OPS.cite.fields.accepts.includes("role"));
  assert.ok(!DECLARED_OPS.cite.fields.requires.flat().includes("role"));
  /* the door's stamps are not fields */
  for (const row of Object.values(DECLARED_OPS)) for (const stamp of ["viewer", "owner", "author", "identity"]) assert.ok(!row.fields.accepts.includes(stamp), stamp);
  /* the descriptions are read by key: the sentence a key answers is the one the declaration holds */
  assert.equal(DECLARED_OPS.drawquestion.description, localize("citation.declared.drawquestion", "project-directed: keyed by a project and one question; draws the question into the project as a confirmed `cites` edge and promotes the project; moves the project's bundle"));
});

test("R18: both imported ops declare the stamps the door sets from the session, `author` and `viewer`, so a joined member's act names a member (K5131)", () => {
  for (const op of ["leggrade", "citeimported", "withdrawimported"]) assert.deepEqual([...(DECLARED_OPS[op].stamps ?? [])].sort(), ["author", "viewer"], op);
});

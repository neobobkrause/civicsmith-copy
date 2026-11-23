/* public-read — R45 (T51 fix round 10; K5186; amends R3, R39; `case-grammar` R34): `op=publishedcase` serves each finding's
   basis version, its name and identity, read from the signed case document only, and the case's header list (DEC-34)
   names it. The document's two lines on each member's `case_roles:` row are written with `case-grammar`'s own line
   builder, as `case-authoring` R87 writes them at prepare. Driven at the interface: the store op and the Worker's route.
   Controls: a project that stated no version answers both null and recorded; a document written before R34 answers
   undetermined, never filled; a document withheld by a court order answers nothing of it; no case-level version. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, caseDoc, stubOf, bucket, V, NOW } from "./fixture.mjs";
import { memberBasisVersionLines } from "../../../src/case-grammar/index.mjs";
import { bindPublishedPlane, publishedRoutes } from "../../../src/publication/worker.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
bindPublishedPlane({
  json, STORE_SILENT_REASON: "STORE_DID_NOT_ANSWER", STORE_SILENT_DETAIL: "silent", PUBLISHED_STORE: "bio",
  doAnswer: async (res) => { let out = null; try { out = await (await res).json(); } catch { out = null; }
                             return out && out.ok === true ? { answered: true, result: out.result } : { answered: false }; },
  storeSilent: (op) => json({ ok: false, reason: "STORE_DID_NOT_ANSWER", op }, 502),
  requiredArgument: (op, argument, shape, error) => ({ ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, error }),
});

const CASE = "CASE-2026-0001", F = "INQ-2026-0001", G = "INQ-2026-0002";
const SPRING = { name: "Spring account", identity: "e".repeat(64) };

/* A published `/6` edition whose members F and G carry, on their `case_roles:` rows, the basis-version lines `versions`
   names (`undefined`: no lines at all, a document written before R34); `edit` changes the text before it is signed. */
function published(versions, edit = (d) => d) {
  const w = world();
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.inquiry(F);
  w.inquiry(G);
  const pins = { [F]: w.head(F), [G]: w.head(G) };
  const text = caseDoc(CASE, 1, { format: "bio-case-document/6", project: proj,
    method: { grading: "bio-grading/1", checks: "1.57.0" }, materials: [], attestations: [],
    roles: [{ target: F, version_sha: pins[F], role: "load_bearing" }, { target: G, version_sha: pins[G], role: "supporting" }],
    strength: [{ target: F, axis: "capture", grade: "A" }, { target: F, axis: "connection", grade: "B" },
               { target: G, axis: "capture", grade: "C" }, { target: G, axis: "connection", grade: "C" }] });
  /* each role row ends at its `role:` line; the two lines follow it, indented as the row's other fields */
  let target = null;
  const doc = edit(text.split("\n").flatMap((l) => {
    const t = /^ {2}- target: (\S+)$/.exec(l);
    if (t) target = t[1];
    return /^ {4}role: /.test(l) && target && versions && Object.hasOwn(versions, target)
      ? [l, ...memberBasisVersionLines(versions[target])] : [l];
  }).join("\n"));
  const stored = w.p.storeCaseDocument({ case: CASE, edition: 1, text: doc, author: V("olive"), at: NOW });
  assert.equal(stored.ok, true, JSON.stringify(stored));
  const signed = w.signCase(CASE, 1, { project: proj, roster: [{ bundle_id: F, version_sha: pins[F], role: "load_bearing" },
                                                               { bundle_id: G, version_sha: pins[G], role: "supporting" }] });
  assert.equal(signed.ok, true, JSON.stringify(signed).slice(0, 300));
  assert.equal(w.signFinding(F).ok, true);
  assert.equal(w.signFinding(G).ok, true);
  const env = { PUBLISHED: bucket() };
  for (const id of [F, G]) env.PUBLISHED.m.set(`bio/published/${w.head(id)}`, new TextEncoder().encode(w.text(id)));
  return { w, env, doc };
}
const memberOf = (c, id) => c.findings.find((f) => f.bundle_id === id);
const viaWorker = async (s) => {
  const url = new URL(`https://plane/?op=publishedcase&id=${CASE}`);
  const res = await publishedRoutes({ op: "publishedcase", url, env: s.env, stub: stubOf(s.w) });
  assert.equal(res.status, 200);
  return res.json();
};

test("R45 each finding answers its basis version, name and identity, as the signed document states it; the case's header list names it", async () => {
  const s = published({ [F]: SPRING, [G]: null });
  assert.match(s.doc, /basis_version: "Spring account"/, "the signed document states the version");
  const c = s.w.read("publishedcase", { id: CASE });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 300));
  assert.deepEqual(memberOf(c, F).basis_version, { recorded: true, name: "Spring account", identity: SPRING.identity });
  /* a project that stated none is recorded as none, both null, never a filled guess (`case-grammar` R34) */
  assert.deepEqual(memberOf(c, G).basis_version, { recorded: true, name: null, identity: null });
  /* DEC-34's header list: one row per member, in the findings' order, naming the version beside the finding */
  assert.deepEqual(c.basis_versions, [
    { bundle_id: F, recorded: true, name: "Spring account", identity: SPRING.identity },
    { bundle_id: G, recorded: true, name: null, identity: null }]);
  /* R11, DEC-44: a version is per finding; nothing is composed for the case */
  assert.equal(Object.hasOwn(c, "basis_version"), false, "no case-level basis version");
  /* the op the page draws (`screens-publish` R6), through the Worker: the same fields, unchanged */
  const r = await viaWorker(s);
  assert.deepEqual(r.findings.map((f) => f.basis_version), c.findings.map((f) => f.basis_version));
  assert.deepEqual(r.basis_versions, c.basis_versions);
});

test("R45 controls: a document written before R34 answers each version undetermined, never filled; a half-stated pair is undetermined too", () => {
  const old = published(undefined).w.read("publishedcase", { id: CASE });
  for (const id of [F, G]) assert.deepEqual(memberOf(old, id).basis_version, { recorded: false, name: null, identity: null }, id);
  assert.deepEqual(old.basis_versions.map((r) => r.recorded), [false, false]);
  /* a row stating a name with no valid identity is no statement of a version (`case-grammar` R34's reading); the other
     member's row is read as stated */
  const half = published({ [F]: SPRING, [G]: null },
    (d) => d.replace(`basis_version_identity: ${SPRING.identity}`, "basis_version_identity: nothex")).w.read("publishedcase", { id: CASE });
  assert.deepEqual(memberOf(half, F).basis_version, { recorded: false, name: null, identity: null });
  assert.deepEqual(memberOf(half, G).basis_version, { recorded: true, name: null, identity: null });
});

test("R45 a court order withholding the edition withholds its basis versions with the document; the read is the same bytes for every caller", () => {
  const s = published({ [F]: SPRING, [G]: null });
  const first = JSON.stringify(s.w.read("publishedcase", { id: CASE }));
  assert.equal(JSON.stringify(s.w.read("publishedcase", { id: CASE })), first, "two reads, one answer");
  s.w.stamps.stamp({ case: CASE, editions: [1], entry: { seq: 7, digest: "d".repeat(64) }, effect: "remove" });
  const c = s.w.read("publishedcase", { id: CASE });
  assert.equal(c.withheld.document, true);
  assert.equal(c.basis_versions, null, "read from the withheld document, so not served");
  for (const f of c.findings) assert.equal(f.basis_version, null, f.bundle_id);
  assert.doesNotMatch(JSON.stringify(c), /Spring account/, "the name appears nowhere in the answer");
});

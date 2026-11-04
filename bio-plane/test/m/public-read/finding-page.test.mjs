/* public-read — R39 one finding's page data, the `publishedcase` op's per-finding answer (T51-75; DEC-330 A76): the
   entry of `findings` whose `bundle_id` is the id asked, as the Worker's route serves it over this module's op map. The
   behaviour was served before it was stated; each arm here names the id and checks the whole of what the requirement
   lists for that entry. Words people read are never copied (K3810): refusals are read by their code and check. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, stubOf, bucket, SIG, KEY } from "./fixture.mjs";
import { publishedGraphEdges } from "../../../src/case-grammar/index.mjs";
import { rowOf } from "../../../src/public-read/checks.mjs";
import { bindPublishedPlane, publishedRoutes } from "../../../src/publication/worker.mjs";

const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { "content-type": "application/json" } });
bindPublishedPlane({
  json, STORE_SILENT_REASON: "STORE_DID_NOT_ANSWER", STORE_SILENT_DETAIL: "silent", PUBLISHED_STORE: "bio",
  doAnswer: async (res) => { let out = null; try { out = await (await res).json(); } catch { out = null; }
                             return out && out.ok === true ? { answered: true, result: out.result } : { answered: false }; },
  storeSilent: (op) => json({ ok: false, reason: "STORE_DID_NOT_ANSWER", op }, 502),
  requiredArgument: (op, argument, shape, error) => ({ ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, error }),
});
const call = async (w, env, q, stub = stubOf(w)) => {
  const url = new URL("https://plane/?op=publishedcase");
  for (const [k, v] of Object.entries(q)) url.searchParams.set(k, String(v));
  return publishedRoutes({ op: "publishedcase", url, env, stub });
};
const pubKey = (s) => `bio/published/${s}`;
const enc = (t) => new TextEncoder().encode(t);

const CASE = "CASE-2026-2300", F = "INQ-2026-2300-case", PARENT = "INQ-2026-2300-mixed", SIB = "INQ-2026-2300-signature";
const DOC_PUB = "INFO-2026-2300-published", DOC_WORK = "INFO-2026-2300-working";
const T1 = "2026-09-28T01:00:00Z";
const BAR = { declared: true, capture: "B", connection: "C" };

/* CASE over F (load-bearing), F resting on two documents (one published as evidence, one working material) and naming a
   division parent and a sibling; F's bytes in the published bucket. */
function published({ legs = [{ target: DOC_WORK }, { target: DOC_PUB }], putBytes = true } = {}) {
  const w = world();
  w.member("olive");
  const proj = w.project("Sewer transfer", "olive");
  for (const d of [DOC_PUB, DOC_WORK]) w.doc(d);
  w.inquiry(PARENT);
  w.inquiry(SIB);
  assert.equal(w.signFinding(DOC_PUB, { title: "Published evidence", sig: SIG(21), at: T1 }).ok, true);
  w.inquiry(F, { question: "Was the sewer transfer authorised?", legs });
  const pin = w.head(F);
  w.prepare(CASE, 1, { format: "bio-case-document/5", project: proj, roles: [{ target: F, version_sha: pin, role: "load_bearing" }],
    strength: [{ target: F, axis: "capture", grade: "B" }, { target: F, axis: "connection", grade: "C" }] });
  assert.equal(w.signCase(CASE, 1, { project: proj, roster: [{ bundle_id: F, version_sha: pin, role: "load_bearing" }],
                                     bar: BAR, sig: SIG(1), at: T1 }).ok, true);
  const edges = publishedGraphEdges({ ...w.fm(F), division_parent: PARENT, division_siblings: [SIB] });
  const text = w.text(F);
  assert.equal(w.signFinding(F, { title: "Finding F", sig: SIG(11), at: T1, edges,
    shas: [{ sha256: pin, path: "bundle.md", kind: "bundle", bytes: Buffer.byteLength(text) }] }).ok, true);
  const env = { PUBLISHED: bucket() };
  if (putBytes) env.PUBLISHED.m.set(pubKey(pin), enc(text));
  return { w, env, pin, proj, text };
}

test("R39 the finding's entry names its identity and signing, its frozen pair with its standing, its parts and the address of its bytes", async () => {
  const { w, env, pin, text } = published();
  const c = await (await call(w, env, { id: F })).json();
  assert.deepEqual([c.ok, c.caseId, c.asked], [true, CASE, F], "the page of one finding is the op asked by that finding's id");
  const f = c.findings.find((x) => x.bundle_id === F);
  assert.deepEqual([f.title, f.edition, f.bundle_sha, f.version_sha, f.role, f.ratified_at, f.gate_version],
                   ["Finding F", 1, pin, pin, "load_bearing", T1, "plane-gate/test"]);
  assert.deepEqual(f.attestor, { member: "h_olive", key_b64: KEY }, "the signer, named by her handle (R41)");
  assert.deepEqual(f.delivered_by, { kind: "member", member: "h_olive" }, "the deliverer is a fact apart from the signer (R12)");
  assert.deepEqual(f.strength.map((a) => [a.axis, a.grade]), [["capture", "B"], ["connection", "C"]], "its frozen pair, per axis");
  assert.ok(f.standing != null && typeof f.standing === "object", "its standing (R22)");
  assert.equal(f.tensions, null, "its tensions as R3 states them: none disclosed in a /5 document");
  assert.deepEqual(f.parts.map((p) => [p.path, p.sha256, p.kind, p.bytes]), [["bundle.md", pin, "bundle", Buffer.byteLength(text)]]);
  assert.equal(f.bytes, `op=publishedbytes&sha256=${pin}`, "the address of its published bytes");
  assert.equal("strength" in c, false, "and there is no strength at the case's altitude (R11)");
});

test("R39 the body is read from the finding's published bytes by its hash, never the working record; the override is {by, at} or null and never absent", async () => {
  const { w, env, pin, text } = published();
  const body = (await (await call(w, env, { id: F })).json()).findings[0].body;
  assert.deepEqual([body.state, body.from_sha], ["published", pin]);
  assert.deepEqual(Object.keys(body).filter((k) => k !== "detail").sort(),
                   ["authored", "conclusion", "excludes", "excludes_from", "falsifies", "from_sha", "question", "state"]);
  assert.match(body.question, /Was the sewer transfer authorised\?/);
  assert.equal(body.excludes_from, "case_document", "a member published under a case document prints the case's words, and says so");
  assert.deepEqual(Object.keys(body.authored).sort(), ["conclusion", "falsifier", "falsifier_override"]);
  assert.equal(body.authored.falsifier_override, null, "an unused override is null, never absent");
  /* the bytes the hash names are what is shown, not whatever the working record holds now */
  const worked = text.replace("Was the sewer transfer authorised?", "A question asked later, in the working record.");
  w.inquiry(F, { question: "A question asked later, in the working record.", legs: [{ target: DOC_WORK }, { target: DOC_PUB }] });
  assert.notEqual(w.head(F), pin, "fixture: the working record has moved");
  assert.equal((await (await call(w, env, { id: F })).json()).findings[0].body.question.includes("asked later"), false);
  assert.equal(worked.includes("asked later"), true);
  /* an override recorded in the signed bytes travels as {by, at} */
  const lines = text.split("\n");
  env.PUBLISHED.m.set(pubKey(pin), enc([lines[0], "falsifier_override_by: olive", "falsifier_override_at: 2026-09-20T00:00:00Z",
                                         ...lines.slice(1)].join("\n")));
  const o = (await (await call(w, env, { id: F })).json()).findings[0].body.authored.falsifier_override;
  assert.deepEqual(o, { by: "olive", at: "2026-09-20T00:00:00Z" });
});

test("R39 a body whose bytes cannot be handed over states `unavailable` with its row: no store bound is NO_PUBLISHED_STORE, a store without the object is OBJECT_MISSING", async () => {
  const { w, pin } = published({ putBytes: false });
  const missing = (await (await call(w, { PUBLISHED: bucket() }, { id: F })).json()).findings[0].body;
  assert.deepEqual([missing.state, missing.from_sha, missing.reason, missing.check, missing.translation],
                   ["unavailable", pin, "OBJECT_MISSING", "C-98.2", rowOf("OBJECT_MISSING").translation]);
  const absent = (await (await call(w, {}, { id: F })).json()).findings[0].body;
  assert.deepEqual([absent.state, absent.reason, absent.check, absent.translation],
                   ["unavailable", "NO_PUBLISHED_STORE", "C-68.5", rowOf("NO_PUBLISHED_STORE").translation]);
  assert.equal("question" in missing || "question" in absent, false, "nothing is read from the working record in its place");
});

test("R39 a body an order withholds states `withheld` with its orders, and no basis is read from bytes that are not served", async () => {
  const { w, env, pin } = published();
  w.stamps.stamp({ case: CASE, editions: [1], entry: { seq: 6 }, effect: "remove", parts: [pin] });
  const f = (await (await call(w, env, { id: F })).json()).findings[0];
  assert.equal(f.body.state, "withheld");
  assert.ok(Array.isArray(f.body.orders) && f.body.orders.length > 0, "its orders are stated");
  assert.deepEqual([f.basis, f.object_type, f.bytes], [[], null, `op=publishedbytes&sha256=${pin}`]);
});

test("R39 each leg of the signed bytes is a basis entry: served only where its target is a published finding, at the edition it names or the latest; a leg on working material is named, served false, and nothing of it is handed over", async () => {
  const { w, env } = published();
  const f = (await (await call(w, env, { id: F })).json()).findings[0];
  assert.deepEqual(f.basis.map((l) => [l.target, l.served]), [[DOC_WORK, false], [DOC_PUB, true]]);
  for (const l of f.basis)
    /* R47 (T53) amends R39: each entry also states `ungraded` (null for a document before `/10`) */
    assert.deepEqual(Object.keys(l).sort(), ["cited_edition", "detail", "document", "grade", "grade_axis", "grade_source", "role", "served", "target", "target_edition", "ungraded"]);
  const [named, served] = f.basis;
  assert.equal(named.cited_edition, null, "nothing of a named leg is handed over");
  assert.deepEqual(Object.keys(served.cited_edition).sort(), ["bundle_sha", "capture", "case_id", "connection", "edition", "ratified_at", "title"]);
  assert.deepEqual([served.cited_edition.edition, served.cited_edition.title, served.cited_edition.bundle_sha, served.cited_edition.case_id],
                   [1, "Published evidence", w.head(DOC_PUB), null], "the latest edition, the leg naming none");
  assert.notEqual(served.detail, named.detail, "a served leg and a named one are told apart in words");
  assert.equal(JSON.stringify(f).includes(w.head(DOC_WORK)), false, "the working document's hash appears nowhere");
});

test("R39 a leg naming an edition is served at that edition, not at the latest; one naming an edition nothing published holds is named, not served", async () => {
  const { w, env, pin, text } = published({ legs: [{ target: DOC_PUB }] });
  const naming = (n) => text.replace(`basis:\n  - target: ${DOC_PUB}\n`, `basis:\n  - target: ${DOC_PUB}\n    target_edition: ${n}\n`);
  assert.notEqual(naming(1), text, "fixture: the leg is rewritten");
  env.PUBLISHED.m.set(pubKey(pin), enc(naming(1)));
  const l = (await (await call(w, env, { id: F })).json()).findings[0].basis[0];
  assert.deepEqual([l.target_edition, l.served, l.cited_edition.edition], [1, true, 1]);
  env.PUBLISHED.m.set(pubKey(pin), enc(naming(7)));
  const n = (await (await call(w, env, { id: F })).json()).findings[0].basis[0];
  assert.deepEqual([n.target_edition, n.served, n.cited_edition], [7, false, null]);
});

test("R39 the graph and the division: a divided question's parent and siblings are named in `division`, absent from `serves`, never served", async () => {
  const { w, env } = published();
  const f = (await (await call(w, env, { id: F })).json()).findings[0];
  assert.deepEqual([f.division.parent, f.division.siblings, typeof f.division.detail], [PARENT, [SIB], "string"]);
  assert.deepEqual(f.serves.map((e) => e.to), [DOC_PUB]);
  assert.deepEqual(f.names, [{ to: PARENT, kind: "division_parent" }, { to: SIB, kind: "division_sibling" }]);
  assert.deepEqual(f.unresolved, []);
  assert.equal(f.serves.some((e) => e.to === PARENT || e.to === SIB), false);
  assert.equal([PARENT, SIB].every((id) => w.read("publishedcase", { id }).reason === "NOT_PUBLISHED"), true,
               "naming them bought the reader nothing of them");
});

test("R39 a finding with no legs answers `basis: []`; the answer carries `verification`: the container, the manifest and each finding's bytes by address", async () => {
  const { w, env, pin } = published({ legs: [] });
  const c = await (await call(w, env, { id: F })).json();
  assert.deepEqual(c.findings[0].basis, []);
  assert.deepEqual(Object.keys(c.verification).sort(), ["case_file", "container", "detail", "findings", "manifest"]);   // G54: beside the addresses, the case file's state
  assert.deepEqual(c.verification.findings, [{ bundle_id: F, bytes: `op=publishedbytes&sha256=${pin}` }]);
  assert.equal(typeof c.verification.detail, "string");
  /* before a container is assembled the case has no manifest: the addresses say so, never point at nothing */
  assert.deepEqual([c.manifest_sha, c.verification.container, c.verification.manifest], [null, null, null]);
});

test("R39 when the store does not answer the lookup that classifies a finding's legs, the whole read is refused as a silence, never answered with every leg named and none served", async () => {
  const { w, env } = published();
  const base = stubOf(w);
  const down = { fetch: async (req, init) => {
    const u = typeof req === "string" ? req : req.url;
    return u.includes("/publishedtargets") ? new Response("down", { status: 500 }) : base.fetch(req, init);
  } };
  const r = await call(w, env, { id: F }, down);
  const body = await r.json();
  assert.deepEqual([r.status, body.ok, body.reason], [502, false, "STORE_DID_NOT_ANSWER"]);
  assert.equal("findings" in body, false, "no partly rendered case");
  /* and a finding with no legs asks the registry nothing, so the same silence leaves it answered */
  const none = published({ legs: [] });
  const b2 = stubOf(none.w);
  const down2 = { fetch: async (req, init) => (String(typeof req === "string" ? req : req.url).includes("/publishedtargets")
    ? new Response("down", { status: 500 }) : b2.fetch(req, init)) };
  assert.equal((await call(none.w, none.env, { id: F }, down2)).status, 200);
});

test("R39 a finding several cases pin is asked with the case that reads it: the id alone is FINDING_IN_SEVERAL_CASES, and `caseId` reads its entry", async () => {
  const { w, env, pin, proj } = published();
  w.prepare("CASE-2026-2301", 1, { format: "bio-case-document/5", project: proj, roles: [{ target: F, version_sha: pin, role: "load_bearing" }],
    strength: [{ target: F, axis: "capture", grade: "D" }] });
  assert.equal(w.signCase("CASE-2026-2301", 1, { project: proj, roster: [{ bundle_id: F, version_sha: pin, role: "load_bearing" }], sig: SIG(2) }).ok, true);
  const both = await call(w, env, { id: F });
  const refused = await both.json();
  assert.deepEqual([both.status, refused.ok, refused.reason, refused.check, refused.cases], [404, false, "FINDING_IN_SEVERAL_CASES", "C-44.2", [CASE, "CASE-2026-2301"]]);
  const second = await (await call(w, env, { id: F, caseId: "CASE-2026-2301" })).json();
  const first = await (await call(w, env, { id: F, caseId: CASE })).json();
  assert.deepEqual([first.caseId, second.caseId, first.asked, second.asked], [CASE, "CASE-2026-2301", F, F]);
  assert.deepEqual(second.findings[0].strength.map((a) => [a.axis, a.grade]), [["capture", "D"]], "each case reads the finding at its own pair");
  assert.deepEqual(first.findings[0].strength.map((a) => a.grade), ["B", "C"]);
});

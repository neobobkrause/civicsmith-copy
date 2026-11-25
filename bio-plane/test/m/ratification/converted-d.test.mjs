/* CONVERTED (T18, K619): ratification's share of four old suites, restated as module tests at this module's interface —
   `test/ratify.test.mjs`, `test/deliverer.test.mjs`, `test/grounds.test.mjs` and `test/multifinding.test.mjs`. The old
   suites were not deleted by this job (K619); this file converts ONLY the behaviour they assert that is
   ratification's (T17's `legacy-tests.md` rows, read against `build/requirements/ratification.md`). What they assert of
   publication, public-read, case-authoring, strength, inquiry or membership is those modules' share and is not here.

   Every test drives the module at its interface: the store half (`ratificationOf` through the fixture's world,
   `w.r.publish`, `w.r.ratifyCaseDocument`), the Worker half (`ratifyOp`, `caseRatifyOp`, with `plane(w)`), and the
   pure catalogue (`checkCaseDocument`). Nothing reads source text. The old suites' signatures came from stock
   ssh-keygen; here they are the fixture's real SSHSIG over the same statements, verified by the same `verifySshsig`.

   Where an old suite made a case document through `op=publish` (case-authoring, which ratification does not use), an
   equivalent `bio-case-document/5` is built by hand with the fixture's `cleanCase`/`fmText`/`caseMd` helpers, and said
   so at the site. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, plane, newKey, signBundle, signCase, cleanInfoMd, cleanCase, caseMd, fmText, CASE_BODY, sha, V }
  from "./fixture.mjs";
import { ratifyOp, caseRatifyOp } from "../../../src/ratification/ops.mjs";
import { caseConclusionRowLines, checkCaseDocument } from "../../../src/ratification/index.mjs";
import { GATE_VERSION, CATALOG_VERSION } from "../../../src/promotion/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const CASE = "CASE-2026-0001";
const OWN = { version: "first", claim: "the transfer was authorised", falsifier: "an adopted resolution forbidding it",
              falsifier_override: null, by: "member:iris", at: "2026-09-27T10:00:00Z" };
const hex = (bytes) => sha(Buffer.from(bytes));

/* A revision of a held bundle, as the fixture's `w.promote` writes one, but under a snapshot key of the shape the
   catalogue maps history to (`<YYYYMMDDTHHMMSSZ>_<8 hex>`, C-12.2): a revised bundle's `_history/` files must map to a
   manifest entry, or the gate refuses the image for that alone. */
let snapSeq = 0;
function revise(w, id, text, type = "inquiry") {
  const head = w.record.head(id);
  const n = ++snapSeq;
  const r = w.promotion.promote({ bundleId: id, base: head ? head.bundleSha : null,
    snapKey: `20260724T${String(100000 + n).slice(-6)}Z_${sha(`${id}#${n}`).slice(0, 8)}`, author: V("iris"),
    files: [{ path: "bundle.md", text }], meta: { object_type: type } });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  return r.bundleSha;
}

/* A catalogue-clean inquiry bundle.md: the gate (promotion.runGate over the catalogue) draws no finding over it. */
function cleanInqMd(id, { extra = [], question = `Was the transfer ${id} authorised?` } = {}) {
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "${question}"`,
    "current_state: open", "prior_state: null", `created: "2026-07-01T00:00:00Z"`, `last_updated: "2026-07-01T00:00:00Z"`,
    "produced_by:", "  mode: human", "  capability_tier: none", "group: test-group", "references: []",
    "state_history: []", "annotations_open: 0", "reeval_pending: false", "visuals: []", "surfaced_by: human",
    "recheck_triggers:", "  - text: Revisit after the next budget cycle",
    "    description: The adopted budget may restate the transfer basis.",
    ...extra, "---", "", "## Question", "", question, "", word("conformance.rests"), "", "## Conclusion", "",
    word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
}

/* iris owns the project and holds the registered key; gus joined it and holds none; vera is a member of no project. */
async function people() {
  const w = world();
  const iris = await newKey(), stranger = await newKey();
  w.member("iris", { signer: iris }); w.member("gus"); w.member("vera");
  const P = w.project("Team", "iris", { joined: ["gus"] });
  return { w, P, iris, stranger };
}
const as = (who) => ({ session: { role: `member:${who}` }, viewer: V(who) });
/* The founder's session row is `admin`; the viewer string the control plane folds it to is not what names the
   deliverer (deliverer.test's arm (d)), so it is given the folded spelling on purpose. */
const FOUNDER = { session: { role: "admin" }, viewer: "member:admin" };
const ratify = async (w, p, bundleId, expectedSha, sig) =>
  ratifyOp(p.request({ bundleId, expectedSha, sig }), p.stub, p.ctx);

/* ================================================================= test/ratify.test.mjs
   T17 row: ratification R6 (a multi-part bundle copies every part, each part's sha verifying), R6 (a bundle in no
   case gets no container and no caseId), R4/R6 (the answer's gateVersion is the catalogue stamp). Converted beside
   them, as R4's and R5's: the refusals before anything publishes, convergence and the append-only promise, the gate's
   refusal of a broken image, revocation, and the operator's bearer token. Not converted: signer registration
   (membership's) and `op=verify` (publication's read, no ratification requirement); its "the published bytes verify"
   is asserted here as what R6 provides, each copy held under its own sha. */

const ID = "INFO-2026-7001-ratify-target";
const CAP = new Uint8Array(2048).map((_, i) => (i * 7) % 256);
const CAP_SHA = hex(CAP);
const DATA = JSON.stringify({ probe: true }, null, 1);
const infoRev = (n) => cleanInfoMd(ID).replace("A document.", `revision ${n}`);

/* The target: an information bundle with an inline data file and a registered capture, made the evidence a ratified
   case's finding rests on (Publication rule 2, D-431), as the old suite made it. */
async function target() {
  const s = await people();
  const { w, P } = s;
  let n = 0;
  s.reviseTarget = (text) => {
    const head = w.record.head(ID);
    const r = w.promotion.promote({ bundleId: ID, base: head ? head.bundleSha : null,
      snapKey: `20260724T${String(200000 + ++n).slice(-6)}Z_${sha(`${ID}#${n}`).slice(0, 8)}`, author: V("iris"),
      files: [{ path: "bundle.md", text }, { path: "data/probe.json", text: DATA },
              { path: "snapshots/evidence.bin", blobSha: CAP_SHA, sha256: CAP_SHA, bytes: CAP.length }],
      register: [{ sha256: CAP_SHA, path: "snapshots/evidence.bin", encoding: "binary", bytes: CAP.length }],
      meta: { object_type: "information" } });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
    return r.bundleSha;
  };
  s.v1 = s.reviseTarget(infoRev(1));
  s.live = s.reviseTarget(infoRev(2));
  w.registers.set(ID, [{ capture_sha: CAP_SHA, path: "snapshots/evidence.bin", bytes: CAP.length }]);
  w.evidence.set(`bio/captures/${CAP_SHA}`, CAP);
  w.pub.resting.set(ID, [{ case_id: CASE, finding: "INQ-2026-7003-finding", project: P }]);
  s.plane = (o = as("iris")) => { const p = plane(w, o); p.captures.set(`s/captures/${CAP_SHA}`, CAP); return p; };
  return s;
}

test("R4, R6 (ratify): a multi-part bundle — its bundle.md, a data file and a registered capture — crosses whole: every part is copied to the published store under its own sha, and each copy hashes to that sha", async () => {
  const { w, iris, live, v1, plane: mk } = await target();
  const p = mk();
  assert.equal(p.published.size, 0, "negative control: nothing is published before the act");
  const r = await ratify(w, p, ID, live, await signBundle(iris, ID, live));
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual([r.body.ok, r.body.attestor], [true, "iris"]);
  assert.deepEqual(r.body.published, { shas: 3, copied: 3, alreadyPresent: 0, r2: "ok" });
  const md = w.record.readFile(ID, "bundle.md").text;
  const want = [live, sha(DATA), CAP_SHA];
  assert.equal(sha(md), live, "the bundle's sha is its bundle.md's");
  assert.deepEqual([...p.published.keys()].sort(), want.map((s) => `s/published/${s}`).sort());
  for (const [k, bytes] of p.published) assert.equal(hex(bytes), k.slice("s/published/".length), `${k} hashes to its own name`);
  assert.equal(p.published.has(`s/published/${v1}`), false, "an unratified earlier revision is not published");
  const [, a] = w.calls.find((c) => c[0] === "commitEdition");
  assert.deepEqual(a.shas.map((s) => [s.path, s.kind, s.sha256]).sort(),
    [["bundle.md", "bundle", live], ["data/probe.json", "file", sha(DATA)], ["snapshots/evidence.bin", "capture", CAP_SHA]].sort(),
    "every part's hash is handed to the commit");
});

test("R6 (ratify): a bundle in no case publishes exactly its own parts at edition 1 — no container is assembled or named, and the answer names no case", async () => {
  const { w, iris, live, plane: mk } = await target();
  const p = mk();
  const r = await ratify(w, p, ID, live, await signBundle(iris, ID, live));
  assert.equal(r.status, 200);
  assert.deepEqual([r.body.container, "caseId" in r.body, "case" in r.body, r.body.edition], [null, false, false, 1]);
  assert.deepEqual(p.assembled, [], "the one assembly was not called");
});

test("R4, R6 (ratify): the answer's gateVersion is the catalogue's stamp — `plane-gate/1.0 (bio-checks <CATALOG_VERSION>)`, never the gate's own name alone — and it is the one the commit records", async () => {
  const { w, iris, live, plane: mk } = await target();
  assert.match(CATALOG_VERSION, /^\d+\.\d+\.\d+$/, "the catalogue version is a real three-part version");
  const r = await ratify(w, mk(), ID, live, await signBundle(iris, ID, live));
  assert.equal(r.body.gateVersion, `plane-gate/1.0 (bio-checks ${CATALOG_VERSION})`);
  assert.equal(r.body.gateVersion, GATE_VERSION);
  assert.notEqual(r.body.gateVersion, "plane-gate/1.0");
  const [, a] = w.calls.find((c) => c[0] === "commitEdition");
  assert.equal(a.gateVersion, r.body.gateVersion);
  assert.equal(w.row(`SELECT gate_version FROM published_bundles WHERE bundle_id=?`, ID).gate_version, r.body.gateVersion);
});

test("R4 (ratify): before anything publishes — no signature is MALFORMED, an absent bundle ABSENT, a stale sha RATIFY_STALE, an unregistered key SIG_UNKNOWN_KEY, a signature over another statement SIG_BAD_SIGNATURE; none publishes, and the right signature then does", async () => {
  const { w, iris, stranger, live, v1, plane: mk } = await target();
  const p = mk();
  const none = "INFO-2026-9999-none";
  const cases = [
    [{ bundleId: ID, expectedSha: live }, 400, "MALFORMED"],
    [{ bundleId: none, expectedSha: live, sig: await signBundle(iris, none, live) }, 404, "ABSENT"],
    [{ bundleId: ID, expectedSha: v1, sig: await signBundle(iris, ID, v1) }, 409, "RATIFY_STALE"],
    [{ bundleId: ID, expectedSha: live, sig: await signBundle(stranger, ID, live) }, 403, "SIG_UNKNOWN_KEY"],
    [{ bundleId: ID, expectedSha: live, sig: await signBundle(iris, ID, v1) }, 403, "SIG_BAD_SIGNATURE"],
  ];
  for (const [body, status, reason] of cases) {
    const r = await ratifyOp(p.request(body), p.stub, p.ctx);
    assert.deepEqual([r.status, r.body.ok, r.body.reason], [status, false, reason], reason);
  }
  assert.equal(p.published.size, 0);
  assert.equal(w.count("published_bundles"), 0);
  assert.equal(w.calls.some((c) => c[0] === "commitEdition"), false, "the commit was never asked");
  const ok = await ratify(w, p, ID, live, await signBundle(iris, ID, live));
  assert.equal(ok.body.ok, true, "negative control: the same bundle, signed over its live sha by the registered key, crosses");
});

test("R5, R6, R10 (ratify): re-ratifying the same sha converges — existed, nothing re-copied; a newer revision ratifies as the next edition and the published bytes of the older one stay published, unchanged", async () => {
  const { w, iris, live, reviseTarget, plane: mk } = await target();
  const p = mk();
  const first = await ratify(w, p, ID, live, await signBundle(iris, ID, live));
  assert.deepEqual([first.body.ok, first.body.existed, first.body.edition], [true, false, 1]);
  const row1 = w.row(`SELECT * FROM published_bundles WHERE bundle_id=? AND edition=1`, ID);
  const again = await ratify(w, p, ID, live, await signBundle(iris, ID, live));
  assert.deepEqual([again.body.ok, again.body.existed, again.body.published.copied, again.body.published.alreadyPresent],
    [true, true, 0, 3]);
  const v3 = reviseTarget(infoRev(3));
  const third = await ratify(w, p, ID, v3, await signBundle(iris, ID, v3));
  assert.deepEqual([third.body.ok, third.body.existed, third.body.edition], [true, false, 2]);
  assert.equal(third.body.published.copied, 1, "only the new bundle.md is new; the data file and capture are present");
  assert.equal(hex(p.published.get(`s/published/${live}`)), live, "the OLD published sha is still held, under its own hash");
  assert.ok(p.published.has(`s/published/${v3}`), "and the new one beside it");
  assert.deepEqual(w.row(`SELECT * FROM published_bundles WHERE bundle_id=? AND edition=1`, ID), row1,
    "edition 1's row is not changed by edition 2");
});

test("R4 (ratify): the gate refuses a broken image — a reference to a bundle that does not exist — naming exactly its check (C-6.2), and nothing publishes", async () => {
  const { w, iris, P, plane: mk } = await target();
  const BAD = "INFO-2026-7002-bad";
  const dangling = cleanInfoMd(BAD).replace("references: []",
    ["references:", "  - rel: cites", "    target: INFO-2026-0000-does-not-exist", "    status: confirmed", '    note: ""'].join("\n"));
  w.promote(BAD, dangling, "information");
  w.pub.resting.set(BAD, [{ case_id: CASE, finding: "INQ-2026-7003-finding", project: P }]);
  const s = w.sha(BAD);
  const p = mk();
  const r = await ratify(w, p, BAD, s, await signBundle(iris, BAD, s));
  assert.deepEqual([r.status, r.body.reason], [409, "GATE_REFUSED"]);
  assert.deepEqual(r.body.findings.map((f) => f.check).sort(), ["C-6.2"]);
  assert.equal(p.published.size, 0);
  assert.equal(w.count("published_bundles"), 0);
  const CLEAN = "INFO-2026-7004-clean";
  w.promote(CLEAN, cleanInfoMd(CLEAN), "information");
  w.pub.resting.set(CLEAN, [{ case_id: CASE, finding: "INQ-2026-7003-finding", project: P }]);
  const c = await ratify(w, p, CLEAN, w.sha(CLEAN), await signBundle(iris, CLEAN, w.sha(CLEAN)));
  assert.equal(c.body.ok, true, "negative control: the same bundle without the dangling reference crosses");
});

test("R4, R19 (ratify): a revoked key cannot ratify — NO_SIGNERS when it was the only one, SIG_UNKNOWN_KEY beside another active key — and nothing publishes; reactivated, it ratifies", async () => {
  const { w, iris, live, plane: mk } = await target();
  const p = mk();
  const sig = await signBundle(iris, ID, live);
  w.st.sql.exec(`UPDATE signers SET status='revoked' WHERE key_b64=?`, iris.keyB64);
  assert.deepEqual([(await ratify(w, p, ID, live, sig)).body.reason], ["NO_SIGNERS"]);
  const other = await newKey();
  w.st.sql.exec(`INSERT INTO signers (key_b64, member_id, status, added) VALUES (?, 'gus', 'active', 't')`, other.keyB64);
  const r = await ratify(w, p, ID, live, sig);
  assert.deepEqual([r.status, r.body.reason], [403, "SIG_UNKNOWN_KEY"]);
  assert.equal(w.count("published_bundles"), 0);
  w.st.sql.exec(`UPDATE signers SET status='active' WHERE key_b64=?`, iris.keyB64);
  const back = await ratify(w, p, ID, live, sig);
  assert.deepEqual([back.body.ok, back.body.attestor], [true, "iris"]);
});

test("R4, R12 (ratify): the operator's bearer token carrying a member's VALID signature is refused C-32.14 naming its class, and publishes nothing; the member's own session carrying it crosses, and the record names the key's member as signer", async () => {
  const { w, iris, live, plane: mk } = await target();
  const sig = await signBundle(iris, ID, live);
  const tok = mk({ viaSession: false, cls: "admin" });
  const refused = await ratify(w, tok, ID, live, sig);
  assert.deepEqual([refused.status, refused.body.reason, refused.body.check, refused.body.tokenClass],
    [403, "OPERATOR_TOKEN_CANNOT_RATIFY", "C-32.14", "admin"]);
  assert.deepEqual([tok.fetched, tok.published.size, w.count("published_bundles")], [[], 0, 0]);
  const ok = await ratify(w, mk(), ID, live, sig);
  assert.equal(ok.body.ok, true);
  assert.equal(w.row(`SELECT attestor_member FROM published_bundles WHERE bundle_id=?`, ID).attestor_member, "iris");
});

/* ================================================================= test/deliverer.test.mjs
   T17 row: ratification R2/R4/R12 — a founder session delivering at caseratify and at ratify is recorded as the
   founder, deliveredBy is in both answers, and a member of no project delivering a valid signature gets
   NO_CASE_DOCUMENT; the founder's delivery of a loose (evidence) bundle. Converted beside them: gus (a joined member)
   delivering iris's signature on a finding (R4, R12), and the legacy arm at the committers — a commit handed no
   deliverer records none, never the signer (R12, R13). Not converted: the founder's standing to READ an unsigned case
   (publication R1), the read-backs through op=casedocument, publishedlist, publishededitions, publishedcase and the /6
   container (publication R9, R10, R15, R28), and the two STRUCTURE arms, which read source text. The liar those arms
   named (the deliverer taken from the signature, or from the folded viewer string) is driven here instead: iris
   signs, somebody else always delivers, and the founder's viewer is given the folded spelling `member:admin`. */

/* A two-finding case, its /5 document built by hand (op=publish is case-authoring's) with each member's recorded
   conclusion written by this module's one writer, stored unsigned. `steered` puts its facts in the fixture's map. */
async function caseWorld({ members: ids = ["INQ-2026-9128-lead", "INQ-2026-9128-second"], steered = true } = {}) {
  const s = await people();
  const { w, P } = s;
  for (const q of ids) { w.promote(q, cleanInqMd(q)); w.bv.conc.set(w.key(P, q), OWN); }
  const members = ids.map((id) => ({ id, pin: w.sha(id) }));
  const conc = ids.flatMap((q) => caseConclusionRowLines(q, w.r.caseConclusionFor(P, q, V("iris"), "open")));
  const text = fmText(cleanCase({ caseId: CASE, edition: 1, project: P, members }),
                      { raw: ["case_conclusions:", ...conc], body: CASE_BODY });
  const docSha = w.caseDoc(CASE, 1, text, { owner: P });
  if (steered)
    w.pub.facts.set(`${CASE}#1`, { ok: true, doc: { case_id: CASE, edition: 1, doc_sha: docSha, text },
      attribution: { reached: [], legacy: [], stated: [], current: [] }, signers: w.credentials.attestingKeys(),
      memberBasis: null, priorCase: null });
  const sig = await signCase(s.iris, CASE, 1, docSha);
  const caseRatify = async (o, body = { caseId: CASE, edition: 1, expectedSha: docSha, sig }) => {
    const p = plane(w, o);
    return { ...(await caseRatifyOp(p.request(body), p.stub, p.ctx)), p };
  };
  return { ...s, ids, members, text, docSha, sig, caseRatify };
}

test("R2, R12 (deliverer): iris SIGNS and the FOUNDER's session DELIVERS at op=caseratify — the answer names iris as signer and the founder as deliverer, and the commit is handed each from its own source", async () => {
  const { w, caseRatify } = await caseWorld();
  const r = await caseRatify(FOUNDER);
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual([r.body.ok, r.body.attestor.member, r.body.deliveredBy], [true, "iris", { kind: "founder", member: null }]);
  const [a] = w.pub.committed;
  assert.deepEqual([a.attestorMember, a.deliveredBy], ["iris", "founder"],
    "the founder, from the session row — not member:admin (the folded viewer) and not iris (the signature)");
});

test("R2, R12 (deliverer): a member of NO project carrying iris's valid signature at op=caseratify is answered NO_CASE_DOCUMENT exactly as for a case that does not exist, and nothing is committed; the owner's session carrying it commits", async () => {
  const { w, caseRatify, docSha, sig } = await caseWorld({ steered: false });
  delete w.publication.caseDocumentFacts;   /* publication's real facts read, which answers only to standing */
  const vera = await caseRatify(as("vera"));
  assert.deepEqual([vera.status, vera.body.ok, vera.body.reason], [404, false, "NO_CASE_DOCUMENT"]);
  const never = await caseRatify(as("vera"), { caseId: "CASE-2026-0404", edition: 1, expectedSha: docSha, sig });
  assert.equal(JSON.stringify(vera.body).replaceAll(CASE, "X"), JSON.stringify(never.body).replaceAll("CASE-2026-0404", "X"),
    "byte-identical to a case never minted");
  assert.deepEqual([w.pub.committed.length, w.count("published_cases")], [0, 0]);
  const owner = await caseRatify(as("iris"));
  assert.equal(owner.status, 200, JSON.stringify(owner.body).slice(0, 600));
  assert.deepEqual([w.pub.committed.length, w.pub.committed[0].deliveredBy], [1, V("iris")]);
});

test("R4, R12 (deliverer): iris SIGNS and GUS's session DELIVERS at op=ratify, on a finding the ratified case pins — the answer names iris and gus apart, and the commit is handed each from its own source; the founder delivering the case's evidence is named the founder", async () => {
  const { w, P, iris, ids, caseRatify } = await caseWorld();
  assert.equal((await caseRatify(as("iris"))).status, 200);
  const LEAD = ids[0], s = w.sha(LEAD);
  const p = plane(w, as("gus"));
  const r = await ratify(w, p, LEAD, s, await signBundle(iris, LEAD, s));
  assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 400));
  assert.deepEqual([r.body.attestor, r.body.deliveredBy, r.body.caseId], ["iris", { kind: "member", member: "gus" }, CASE]);
  const handed = () => w.calls.filter((c) => c[0] === "commitEdition").map(([, a]) => [a.bundleId, a.attestorMember, a.deliveredBy]);
  assert.deepEqual(handed(), [[LEAD, "iris", V("gus")]]);
  /* the case's evidence, in no case itself (the old suite's loose bundle), delivered by the founder */
  const INFO = "INFO-2026-9128-memo";
  w.promote(INFO, cleanInfoMd(INFO), "information");
  w.pub.resting.set(INFO, [{ case_id: CASE, finding: LEAD, project: P }]);
  const e = await ratify(w, plane(w, FOUNDER), INFO, w.sha(INFO), await signBundle(iris, INFO, w.sha(INFO)));
  assert.equal(e.status, 200, JSON.stringify(e.body).slice(0, 400));
  assert.deepEqual([e.body.attestor, e.body.deliveredBy], ["iris", { kind: "founder", member: null }]);
  assert.deepEqual(handed()[1], [INFO, "iris", "founder"]);
  assert.deepEqual(w.st.sql.exec(`SELECT bundle_id, attestor_member, delivered_by FROM published_bundles ORDER BY bundle_id`),
    [{ bundle_id: INFO, attestor_member: "iris", delivered_by: "founder" },
     { bundle_id: LEAD, attestor_member: "iris", delivered_by: V("gus") }],
    "THE TABLE: no deliverer recorded equals its signer");
});

test("R3, R5, R12, R13 (deliverer, legacy): the store's committers called as a plane before REC-128 called them — a signer and no deliverer — commit the deliverer null, never the signer", async () => {
  const { w, P, iris, docSha, sig } = await caseWorld();
  const c = await w.r.ratifyCaseDocument({ caseId: CASE, edition: 1, docSha, sigArmored: sig, attestorKey: iris.keyB64,
                                     attestorMember: "iris", gateVersion: "legacy" });
  assert.equal(c.ok, true, JSON.stringify(c).slice(0, 400));
  assert.deepEqual([w.pub.committed[0].attestorMember, w.pub.committed[0].deliveredBy], ["iris", null]);
  const OLD = "INFO-2026-9128-memo2";
  w.promote(OLD, cleanInfoMd(OLD), "information");
  w.pub.resting.set(OLD, [{ case_id: CASE, finding: "INQ-2026-9128-lead", project: P }]);
  const r = w.r.publish({ bundleId: OLD, bundleSha: w.sha(OLD), attestorKey: iris.keyB64, attestorMember: "iris",
                          gateVersion: "legacy", sigArmored: sig, shas: [] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 400));
  assert.deepEqual(w.row(`SELECT attestor_member, delivered_by FROM published_bundles WHERE bundle_id=?`, OLD),
    { attestor_member: "iris", delivered_by: null });
});

/* ================================================================= test/grounds.test.mjs
   T17 row: case-authoring R14 / ratification R8 — a grouped member's case_strength_grounds rows are in the case
   document (none in the finding), and the case gate refuses the document stripped of them. Ratification's share is
   the gate: `checkCaseDocument` over the document, with each member's basis at its pin, at the pure function and at
   op=caseratify's gate. The rows were authored by op=publish (case-authoring's); here the /5 document states them by
   hand, as op=publish writes them (one row per ground per axis, each naming its member). Not converted: the grounds
   arithmetic (strength R2, R4), the grounds gate at the write (inquiry R8), and the op's redaction (strength R6). */

const GQ = "INQ-2026-1015-case", PLAIN = "INQ-2026-1016-plain";
const CH_CAP = "INFO-2026-1000-charter-cap", CH_CON = "INFO-2026-1000-charter-con";
const CO_CAP = "INFO-2026-1000-code-cap", CO_CON = "INFO-2026-1000-code-con";
const leg = (target, grade, axis, ground) => ({ target, role: "supports", grade, grade_axis: axis,
  grade_source: axis === "capture" ? "capture" : "resolution", ...(ground ? { ground } : {}) });
const GROUNDED = [leg(CH_CAP, "B", "capture", "charter"), leg(CH_CON, "C", "connection", "charter"),
                  leg(CO_CAP, "C", "capture", "code"), leg(CO_CON, "A", "connection", "code")];
const FLAT = GROUNDED.map(({ ground, ...l }) => l);
const GROUND_ROWS = [
  { target: GQ, axis: "capture", ground: "charter", state: "graded", grade: "B" },
  { target: GQ, axis: "capture", ground: "code", state: "graded", grade: "C" },
  { target: GQ, axis: "connection", ground: "charter", state: "graded", grade: "C" },
  { target: GQ, axis: "connection", ground: "code", state: "graded", grade: "A" },
];
function groundsDoc() {
  const d = cleanCase({ caseId: CASE, edition: 1, project: "PROJ-2026-4200-grounds",
                        members: [{ id: GQ, pin: "a".repeat(64) }, { id: PLAIN, pin: "b".repeat(64) }] });
  d.case_strength = [
    { target: GQ, axis: "capture", state: "graded", grade: "B" }, { target: GQ, axis: "connection", state: "graded", grade: "A" },
    { target: PLAIN, axis: "capture", state: "graded", grade: "C" }, { target: PLAIN, axis: "connection", state: "graded", grade: "C" }];
  d.case_strength_grounds = GROUND_ROWS;
  return d;
}
const GCTX = { caseId: CASE, edition: 1, body: CASE_BODY, memberBasis: { [GQ]: GROUNDED, [PLAIN]: FLAT } };
const errors = (fm, ctx = GCTX) => checkCaseDocument(fm, ctx).filter((x) => x.severity === "error");

test("R8 (grounds): a case document stating a grouped member's per-ground rows passes the case gate over the member's grounded basis; an unstructured member needs no row", async () => {
  assert.deepEqual(errors(groundsDoc()).map((x) => `${x.check}: ${x.message}`), []);
  assert.equal(groundsDoc().case_strength_grounds.filter((r) => r.target === PLAIN).length, 0,
    "the unstructured member states no branch row, and the document audits clean without one");
});

test("R8 (grounds): stripped of the grouped member's rows the case document draws C-2.8 naming published_strength_grounds, for that member; a missing ground's row is named; with no member basis the arm is unasked", async () => {
  const stripped = { ...groundsDoc(), case_strength_grounds: [] };
  const errs = errors(stripped);
  assert.deepEqual(errs.map((x) => x.check), ["C-2.8"]);
  assert.match(errs[0].message, new RegExp(`^case document, member ${GQ}: a case member requires published_strength_grounds when the basis names grounds`));
  const half = { ...groundsDoc(), case_strength_grounds: GROUND_ROWS.filter((r) => r.ground !== "code") };
  assert.deepEqual(errors(half).map((x) => [x.check, /names no row for ground 'code'/.test(x.message)]), [["C-2.8", true]]);
  assert.deepEqual(errors(stripped, { ...GCTX, memberBasis: null }), [], "an absent member basis leaves the arm unasked");
});

test("R2, R8 (grounds): op=caseratify's gate runs the same arm over the document at the signed sha with each member's basis at its pin — the stripped document is GATE_REFUSED by it, the whole one commits", async () => {
  for (const strip of [true, false]) {
    const { w, P, iris } = await people();
    w.promote(GQ, cleanInqMd(GQ)); w.bv.conc.set(w.key(P, GQ), OWN);
    const d = cleanCase({ caseId: CASE, edition: 1, project: P, members: [{ id: GQ, pin: w.sha(GQ) }] });
    d.case_strength = [{ target: GQ, axis: "capture", state: "graded", grade: "B" }, { target: GQ, axis: "connection", state: "graded", grade: "A" }];
    d.case_strength_grounds = strip ? [] : GROUND_ROWS;
    const text = fmText(d, { raw: ["case_conclusions:", ...caseConclusionRowLines(GQ, w.r.caseConclusionFor(P, GQ, V("iris"), "open"))],
                             body: CASE_BODY });
    const docSha = w.caseDoc(CASE, 1, text);
    w.pub.facts.set(`${CASE}#1`, { ok: true, doc: { case_id: CASE, edition: 1, doc_sha: docSha, text },
      attribution: { reached: [], legacy: [], stated: [], current: [] }, signers: w.credentials.attestingKeys(),
      memberBasis: { [GQ]: GROUNDED }, priorCase: null });
    const p = plane(w, as("iris"));
    const r = await caseRatifyOp(p.request({ caseId: CASE, edition: 1, expectedSha: docSha, sig: await signCase(iris, CASE, 1, docSha) }),
                                 p.stub, p.ctx);
    if (strip) {
      assert.deepEqual([r.status, r.body.reason], [409, "GATE_REFUSED"]);
      assert.ok(r.body.findings.some((x) => x.check === "C-2.8" && /requires published_strength_grounds/.test(x.detail)),
        JSON.stringify(r.body.findings).slice(0, 400));
      assert.equal(w.pub.committed.length, 0);
    } else {
      assert.equal(r.status, 200, JSON.stringify(r.body).slice(0, 600));
      assert.equal(w.pub.committed.length, 1);
    }
  }
});

/* ================================================================= test/multifinding.test.mjs
   T17 row: ratification R6 / publication R10 — the two-member lifecycle: the first member ratifies and its edition is
   incomplete with no container, the last assembles it (over both findings); inquiry R38 / ratification R9 — C-2.8
   refuses a finding whose bytes name a case, at op=ratify's gate. Converted beside them as R5's: an edited member
   leaves its case (its new sha is pinned by no ratified case) and restored bytes re-match the pin (block 2b (c),
   (c3)); and REC-58's arms, the answer's `case` block carrying `complete` and `awaiting` and never `opened` (R6's
   answer). The case document is built by hand (`caseMd`, a /5 document) where the old suite had op=publish author it.
   Not converted: op=publish's own refusals and answer (case-authoring), the container's contents, namespacing and
   public reads (public-read, publication R10, R11, R15, R26), C-21.1/C-21.2 at op=publish (inquiry R7, case-authoring).
   The container's "2 findings, 3 parts" is public-read's assembly; what is ratification's is that it is called once,
   when the last member lands, over the complete edition naming both. */

const FIND_A = "INQ-2026-0001-first", FIND_B = "INQ-2026-0002-second";

async function twoFindingCase() {
  const s = await people();
  const { w, P, iris } = s;
  for (const q of [FIND_A, FIND_B]) { w.promote(q, cleanInqMd(q)); w.bv.conc.set(w.key(P, q), OWN); }
  const members = [{ id: FIND_A, pin: w.sha(FIND_A) }, { id: FIND_B, pin: w.sha(FIND_B), role: "supporting" }];
  const rows = members.map((m) => [m.id, w.r.caseConclusionFor(P, m.id, V("iris"), "open")]);
  const text = caseMd({ caseId: CASE, edition: 1, project: P, members, conclusions: rows, rowLines: caseConclusionRowLines });
  const docSha = w.caseDoc(CASE, 1, text);
  const c = await w.r.ratifyCaseDocument({ caseId: CASE, edition: 1, docSha, sigArmored: await signCase(iris, CASE, 1, docSha),
                                     attestorKey: iris.keyB64, attestorMember: "iris", gateVersion: GATE_VERSION,
                                     deliveredBy: V("iris") });
  assert.deepEqual([c.ok, c.awaiting], [true, [FIND_A, FIND_B]], JSON.stringify(c).slice(0, 300));
  s.members = members;
  s.ratifyAs = async (id, o = as("iris")) => {
    const p = plane(w, o), at = w.sha(id);
    return { ...(await ratify(w, p, id, at, await signBundle(iris, id, at))), p };
  };
  return s;
}

test("R6 (multifinding): the first member ratifies on its own bytes and its case edition answers INCOMPLETE, awaiting the other, with no container; the last completes it and the container is assembled then, once, over both findings", async () => {
  const { w, ratifyAs } = await twoFindingCase();
  const r1 = await ratifyAs(FIND_A);
  assert.equal(r1.status, 200, JSON.stringify(r1.body).slice(0, 400));
  assert.deepEqual([r1.body.caseId, r1.body.edition, r1.body.case.complete, r1.body.case.awaiting, r1.body.case.findings, r1.body.container],
    [CASE, 1, false, [FIND_B], [FIND_A], null]);
  assert.deepEqual(r1.p.assembled, [], "not before the last member lands");
  const r2 = await ratifyAs(FIND_B);
  assert.equal(r2.status, 200, JSON.stringify(r2.body).slice(0, 400));
  assert.deepEqual([r2.body.case.complete, r2.body.case.awaiting, r2.body.case.findings], [true, [], [FIND_A, FIND_B]]);
  assert.equal(r2.p.assembled.length, 1, "assembled once");
  const { cs, via } = r2.p.assembled[0];
  assert.deepEqual([via, cs.case_id ?? cs.caseId, cs.edition, cs.complete, (cs.findings || []).map((f) => f.bundle_id)],
    ["ratify", CASE, 1, true, [FIND_A, FIND_B]]);
  assert.deepEqual(r2.body.container, { manifest_sha: "m".repeat(64), zip: "z" }, "the answer carries the container");
  assert.equal(w.count("published_bundles"), 2);
});

test("R6 (multifinding, REC-58): op=ratify's `case` block carries `complete` and `awaiting` on the incomplete and the complete edition, and never `opened`", async () => {
  const { ratifyAs } = await twoFindingCase();
  const r1 = await ratifyAs(FIND_A), r2 = await ratifyAs(FIND_B);
  for (const r of [r1, r2]) {
    assert.deepEqual(Object.keys(r.body.case).sort(), ["awaiting", "complete", "detail", "edition", "findings"]);
    assert.equal("opened" in r.body.case, false);
  }
  assert.deepEqual([r1.body.case.complete, r2.body.case.complete], [false, true]);
});

test("R4, R9 (multifinding): a finding whose own bytes name a case — its id, edition, scope, acknowledgement and roster — is GATE_REFUSED by C-2.8 naming EVERY key it found, and saying where those facts live; nothing crosses and the case is unmoved", async () => {
  const { w, members, ratifyAs } = await twoFindingCase();
  const clean = w.record.readFile(FIND_A, "bundle.md").text;
  const lie = clean.replace(/^(---\n)/, ["$1" + `case_id: ${CASE}`, "case_edition: 1",
    `case_scope: "whether the permits were issued as the minutes say"`, `bias_acknowledgement: "we expected the permits were late"`,
    `case_findings: [${FIND_A}, ${FIND_B}]`, ""].join("\n"));
  revise(w, FIND_A, lie);
  const r = await ratifyAs(FIND_A);
  assert.deepEqual([r.status, r.body.reason], [409, "GATE_REFUSED"]);
  const named = r.body.findings.filter((x) => x.check === "C-2.8" && /a finding's bytes name a case/.test(x.detail));
  assert.deepEqual(named.map((x) => /name a case \((\w+)\)/.exec(x.detail)[1]).sort(),
    ["bias_acknowledgement", "case_edition", "case_findings", "case_id", "case_scope"]);
  assert.match(named[0].detail, /CASE DOCUMENT a member reviews and ratifies/);
  assert.equal(w.count("published_bundles"), 0);
  assert.deepEqual(w.publication.pinnedCaseEditionsOf(FIND_A, members[0].pin).map((x) => x.case_id), [CASE],
    "the case still pins the version it froze");
  revise(w, FIND_A, clean);
  const back = await ratifyAs(FIND_A);
  assert.deepEqual([back.status, back.body.caseId], [200, CASE], "negative control: the honest bytes cross into the case");
});

test("R5 (multifinding): a member that edits its own bytes after its case pinned them LEAVES the case — at the new sha no ratified case pins it, C-58.2, and nothing crosses; restoring the content restores the sha, the pin names it again and it crosses into the case", async () => {
  const { w, members, ratifyAs } = await twoFindingCase();
  const [pinA] = members;
  const clean = w.record.readFile(FIND_A, "bundle.md").text;
  revise(w, FIND_A, clean.replace("## Question\n\n", "## Question\n\nEdited after its case pinned it. "));
  assert.notEqual(w.sha(FIND_A), pinA.pin);
  const edited = await ratifyAs(FIND_A);
  assert.deepEqual([edited.status, edited.body.reason, edited.body.check], [409, "RATIFY_FINDING_NOT_IN_A_RATIFIED_CASE", "C-58.2"]);
  assert.equal(w.count("published_bundles"), 0);
  revise(w, FIND_A, clean);
  assert.equal(w.sha(FIND_A), pinA.pin, "the pin is a statement about bytes: the same content is the same sha");
  const restored = await ratifyAs(FIND_A);
  assert.deepEqual([restored.status, restored.body.caseId, restored.body.case.awaiting], [200, CASE, [FIND_B]]);
});

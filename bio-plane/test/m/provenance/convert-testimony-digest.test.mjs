/* provenance: this module's share of three old suites, converted to module tests at the interface —
   `testify.test.mjs` (R28 body-author synonyms as they reach `testify({claimedAuthor})`; R3 the liar, member uploads
   and `authored: false`, C-53.9 on a dropped data/provenance.json; R42 the whole catalogue clean over testify's
   bundle), `mk6-bundle-names-no-author.test.mjs` (R28: no publishable file names the member; observer:<id> in the
   chain and the Session Log; a second observation unlinkable) and `framework-digest-audit.test.mjs` (R43: distinct
   determined evidentiary digests are not folded; the write's refusal names C-18.3 alone; the audit tallies it). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, webcrypto } from "node:crypto";
import { world, sha, V, provDoc } from "./fixture.mjs";
import { observerRef, registerChecks } from "../../../src/provenance/index.mjs";
import { TESTIMONY_CHECKS, PROVENANCE_ACT_CHECKS } from "../../../src/provenance/checks.mjs";
import { checkBundle, parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

/* A refusal's code, catalogue id and translation, and what its row says they are. */
const refused = (r) => [r && r.ok, r && r.reason, r && r.check, r && r.translation];
const row = (code, table = TESTIMONY_CHECKS) => [false, code, table[code].check, table[code].translation];

/* Every live file of a bundle: the files a publication can carry (the record's promotion history is its own table,
   never a file of the bundle). */
const image = (w, id) => new Map(w.record.livePaths(id).map((p) => [p, w.record.readFile(id, p).text]));

/* ===================================================================== testify.test.mjs */

test("R28: a request that names an author, under whatever spelling reached claimedAuthor, is refused C-53.2 and spends nothing", () => {
  const w = world();
  /* The control plane collects every body synonym (author, observer, authoredBy, …) into `claimedAuthor`; what this
     module decides is that any value there is a claim: another name, a real member, the stamped member themself. */
  const claims = ["mallory", "ruth", V("ruth"), V("sam"), { memberId: "ruth" }, ["ruth"]];
  for (const claimedAuthor of claims) {
    const r = w.prov.testify({ words: "I saw it myself.", observedAt: "2026-09-20", author: V("sam"), claimedAuthor });
    assert.deepEqual(refused(r), row("TESTIMONY_AUTHOR_SUPPLIED"), JSON.stringify(claimedAuthor));
  }
  assert.deepEqual([w.count("bundles"), w.count("register")], [0, 0], "nothing written");
  /* No claim (the field absent, or null as the plane sends when no synonym is present) is not refused, and the
     refused attempts spent no id. */
  for (const claimedAuthor of [undefined, null]) {
    const ok = w.prov.testify({ words: `Seen ${claimedAuthor}.`, observedAt: "2026-09-20", author: V("sam"), claimedAuthor });
    assert.equal(ok.ok, true, JSON.stringify(ok));
    assert.equal(ok.author, V("sam"), "the author is the stamp");
    assert.equal(w.row(`SELECT author FROM register WHERE capture_sha=?`, ok.capture_sha).author, V("sam"));
  }
  assert.match(w.prov.testify({ words: "again", observedAt: "2026-09-20", author: V("sam") }).bundle_id,
               /^INFO-\d{4}-0003-observation$/, "the six refusals spent no id");
});

test("R3: the liar — a promotion claiming authored in the document, its register entry and the package — is refused C-53.8, nothing written", () => {
  const w = world();
  const t = w.prov.testify({ words: "I counted.", observedAt: "2026-09-21", author: V("sam") });
  assert.equal(t.ok, true);
  const upload = (c, extra = {}) => provDoc(c, { capture: { ...provDoc(c).capture, method: word("leg-earning.freeze.uploaded_member"), grade: "C",
                                                            actor_class: "member" }, origin: { kind: "member" }, ...extra });
  const s0 = w.snapshot();
  const c = w.cap("forged");
  const liar = w.promoteInfo("INFO-2026-0101-forged", {
    captures: [c], docs: [upload(c, { authored: true, author: "sam", observed_at: "2026-09-21" })],
    pkg: { authored: true, testimony: true,
           register: [{ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text), authored: true }] } });
  assert.deepEqual(refused(liar), row("TESTIMONY_AUTHORED_UNEARNED"));
  assert.equal(w.head("INFO-2026-0101-forged"), null, "the forged bundle does not exist");
  assert.deepEqual(w.snapshot(), s0, "nothing written");
  /* The flag in any truthy spelling is the claim. */
  for (const [i, authored] of ["yes", "true", 1, {}, []].entries()) {
    const x = w.cap(`truthy-${i}`);
    const r = w.promoteInfo(`INFO-2026-020${i}-truthy`, { captures: [x], docs: [upload(x, { authored })] });
    assert.deepEqual(refused(r), row("TESTIMONY_AUTHORED_UNEARNED"), JSON.stringify(authored));
    assert.equal(w.head(`INFO-2026-020${i}-truthy`), null);
  }
  assert.deepEqual(w.snapshot(), s0, "no refused claim wrote anything");
});

test("R3: a member-uploaded document (origin member, not authored) and `authored: false` are accepted, and neither is authored", () => {
  const w = world();
  const upload = (c, extra = {}) => provDoc(c, { capture: { ...provDoc(c).capture, method: word("leg-earning.freeze.uploaded_member"), grade: "C",
                                                            actor_class: "member" }, origin: { kind: "member" }, ...extra });
  const u = w.cap("upload"), f = w.cap("upload-false");
  const up = w.promoteInfo("INFO-2026-0301-upload", { captures: [u], docs: [upload(u)] });
  const upF = w.promoteInfo("INFO-2026-0302-upload-false", { captures: [f], docs: [upload(f, { authored: false })] });
  assert.equal(up.ok, true, JSON.stringify(up));
  assert.equal(upF.ok, true, JSON.stringify(upF));
  for (const [id, c] of [["INFO-2026-0301-upload", u], ["INFO-2026-0302-upload-false", f]]) {
    const r = w.row(`SELECT * FROM register WHERE capture_sha=?`, c.sha);
    assert.deepEqual([r.bundle_id, r.authored, r.author, r.observed_at], [id, 0, null, null], id);
  }
});

test("R3: a revision of an authored bundle that drops data/provenance.json, declared, is refused C-53.9, nothing written", () => {
  const w = world();
  const t = w.prov.testify({ words: "Exactly these words.", observedAt: "2026-09-21", author: V("ruth") });
  const head = w.head(t.bundle_id);
  const live = (p) => w.record.readFile(t.bundle_id, p).text;
  const s0 = w.snapshot();
  const gone = w.promotion.promote({ bundleId: t.bundle_id, base: head.bundleSha, snapKey: "drop", author: V("ruth"),
    meta: { object_type: "information" }, drop: ["data/provenance.json"],
    files: [{ path: "bundle.md", text: live("bundle.md") }, { path: "data/dataset.json", text: live("data/dataset.json") },
            { path: t.file, text: live(t.file) }] });
  assert.deepEqual(refused(gone), row("TESTIMONY_AUTHORED_DROPPED"));
  assert.deepEqual(w.snapshot(), s0, "nothing written");
  assert.equal(w.head(t.bundle_id).bundleSha, head.bundleSha);
  assert.equal(JSON.parse(live("data/provenance.json")).documents[0].authored, true);
  assert.equal(w.row(`SELECT authored FROM register WHERE capture_sha=?`, t.capture_sha).authored, 1);
});

test("R42: the whole catalogue (record-grammar's checkBundle with every grammar the record registers, and this module's registerChecks) finds no error in the bundle testify wrote", async () => {
  const w = world();
  const runs = [w.prov.testify({ words: "The agenda was posted at 4:55 pm.", observedAt: "2026-09-10", title: "Agenda posted late",
                                 author: V("ruth") }),
                w.prov.testify({ words: "Line one.\n\nLine two, é.", observedAt: "2026-09-10T14:05Z", author: V("sam") })];
  for (const t of runs) {
    assert.equal(t.ok, true, JSON.stringify(t));
    const files = image(w, t.bundle_id);
    assert.deepEqual([...files.keys()].sort(), ["bundle.md", "data/dataset.json", "data/provenance.json", t.file].sort(), "the whole bundle");
    const { findings: cat } = await checkBundle({ folderName: t.bundle_id, files,
      sha256: async (v) => createHash("sha256").update(typeof v === "string" ? Buffer.from(v, "utf8") : Buffer.from(v)).digest("hex"),
      sha512: async (b) => new Uint8Array(await webcrypto.subtle.digest("SHA-512", b)),
      resolveTarget: () => true }, { grammars: w.record.grammars() });
    const reg = registerChecks({ files, fm: parseFrontmatter(files.get("bundle.md")).data });
    const errors = [...cat, ...reg].filter((x) => x && x.severity === "error").map((x) => `${x.check}: ${x.message}`);
    assert.deepEqual(errors, [], t.bundle_id);
  }
});

/* ===================================================================== mk6-bundle-names-no-author.test.mjs */

/* An enrolled member whose id, handle and cover are three distinct strings found nowhere else in the fixture, so a
   hit on any of them in a file is theirs. */
async function observerWorld() {
  const w = world();
  /* The founder's claim is credentials' (its R1, R17), which membership reads (its R94). */
  assert.equal((await w.credentials.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" })).ok, true);
  const second = await w.membership.memberAdd({ memberId: "second", cover: "c2", role: "admin", by: "admin" });
  await w.membership.enroll({ invite: second.invite, handle: "second", password: "second-passphrase-x" });
  const add = await w.membership.memberAdd({ memberId: "mk6memberid", cover: "the mk6coverword volunteer", role: "member", by: "admin" });
  assert.equal(add.ok, true, JSON.stringify(add));
  assert.equal((await w.membership.enroll({ invite: add.invite, handle: "mk6handle", password: "mk6-passphrase-x" })).ok, true);
  const facts = w.membership.memberFacts("mk6memberid");
  assert.deepEqual([facts.handle, facts.cover, facts.status], ["mk6handle", "the mk6coverword volunteer", "active"]);
  return { w, author: V("mk6memberid"), needles: { member_id: "mk6memberid", handle: "mk6handle", cover: "mk6coverword" } };
}

test("R28: no file of an observation holds the member's id, handle or cover; the chain's every hop and the Session Log name observer:<id>", async () => {
  const { w, author, needles } = await observerWorld();
  const t = w.prov.testify({ words: "MK6-WORDS: the deputy clerk stamped the contract RECEIVED before the vote.",
                             observedAt: "2026-09-10", title: "Stamped before the vote", author });
  assert.equal(t.ok, true, JSON.stringify(t));
  assert.equal(t.author, author, "the answer to its author names the stamp");
  assert.equal(w.row(`SELECT author FROM register WHERE capture_sha=?`, t.capture_sha).author, author, "the register resolves it");
  const ref = observerRef(t.bundle_id);
  assert.equal(ref, `observer:${t.bundle_id}`);
  const files = image(w, t.bundle_id);
  assert.deepEqual([...files.keys()].sort(), ["bundle.md", "data/dataset.json", "data/provenance.json", t.file].sort(), "the corpus is the bundle");
  const hits = Object.fromEntries(Object.entries(needles).map(([k, n]) => [k, [...files].filter(([, v]) => v.includes(n)).map(([p]) => p)]));
  assert.deepEqual(hits, { member_id: [], handle: [], cover: [] });
  /* data/provenance.json: its author and every hop of every document's chain name the reference. */
  const docs = JSON.parse(files.get("data/provenance.json")).documents;
  assert.equal(docs.length, 1);
  for (const d of docs) {
    assert.equal(d.author, ref);
    assert.equal(Array.isArray(d.provenance_chain) && d.provenance_chain.length > 0, true);
    assert.equal(d.provenance_chain[0].who, ref);
    for (const hop of d.provenance_chain) assert.equal(hop.who, ref);
  }
  /* bundle.md's Session Log: every session heading names the reference as its actor. */
  const md = files.get("bundle.md");
  const log = md.slice(md.indexOf("## Session Log"));
  const sessions = [...log.matchAll(/^### Session \S+ \| ([^|]+) \| (.*)$/gm)];
  assert.equal(sessions.length > 0, true, "the Session Log records the authoring");
  assert.deepEqual(sessions.map((m) => [m[1].trim(), m[2].trim()]), [["Authored", ref]]);
});

test("R28: the same member's second observation is unlinkable to the first: each names only its own reference, and neither the other", async () => {
  const { w, author, needles } = await observerWorld();
  const t1 = w.prov.testify({ words: "MK6-WORDS: a first thing I saw.", observedAt: "2026-09-10", author });
  const t2 = w.prov.testify({ words: "MK6-WORDS-2: a second thing I saw.", observedAt: "2026-09-11", author });
  assert.equal(t1.ok && t2.ok, true);
  const refs = (id) => new Set([...image(w, id).values()].flatMap((v) => v.match(/observer:[^\s"'|,)\]]+/g) ?? []));
  const [r1, r2] = [refs(t1.bundle_id), refs(t2.bundle_id)];
  assert.deepEqual([...r1], [observerRef(t1.bundle_id)]);
  assert.deepEqual([...r2], [observerRef(t2.bundle_id)]);
  assert.notEqual(observerRef(t1.bundle_id), observerRef(t2.bundle_id));
  /* No shared reference: neither bundle's files name the other bundle, or the member by any needle. */
  for (const [id, other] of [[t1.bundle_id, t2.bundle_id], [t2.bundle_id, t1.bundle_id]])
    for (const [p, v] of image(w, id)) {
      assert.equal(v.includes(other), false, `${id} ${p} names ${other}`);
      for (const n of Object.values(needles)) assert.equal(v.includes(n), false, `${id} ${p} names ${n}`);
    }
});

/* ===================================================================== framework-digest-audit.test.mjs */

const digests = (evidentiary, determined = true) => ({ profile: { digests: { determined, evidentiary } } });

test("R43: two documents whose determined evidentiary digests differ are not folded, in the arms or at the write", () => {
  const w = world();
  const a = w.cap("a"), b = w.cap("b");
  const docs = [{ ...provDoc(a), ...digests(sha("substance one")) }, { ...provDoc(b), ...digests(sha("substance two")) }];
  const files = new Map([["bundle.md", "x"], ["data/provenance.json", JSON.stringify({ documents: docs })], [a.path, a.text], [b.path, b.text]]);
  assert.deepEqual(registerChecks({ files, fm: { object_type: "information" } }).filter((x) => x.check === "C-18.3"), []);
  const r = w.promoteInfo("INFO-2026-0001-distinct", { captures: [a, b], docs });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(w.rows(`SELECT capture_sha FROM register WHERE bundle_id=? ORDER BY capture_sha`, "INFO-2026-0001-distinct")
                    .map((x) => x.capture_sha), [a.sha, b.sha].sort(), "both registered, each its own capture");
  /* Two undetermined digests land too: absents are never equal. */
  const c = w.cap("c"), d = w.cap("d");
  const u = w.promoteInfo("INFO-2026-0002-undetermined", { captures: [c, d],
    docs: [{ ...provDoc(c), ...digests(null, false) }, { ...provDoc(d), ...digests(null, false) }] });
  assert.equal(u.ok, true, JSON.stringify(u));
});

test("R43: the register refusal at the write names C-18.3 alone, raw or by determined evidentiary digest, and writes nothing", () => {
  const w = world();
  const a = w.cap("a"), b = w.cap("b");
  const s0 = w.snapshot();
  const cases = {
    "INFO-2026-0001-raw": { captures: [a], docs: [provDoc(a), provDoc(a)] },
    "INFO-2026-0002-evidentiary": { captures: [a, b],
      docs: [{ ...provDoc(a), ...digests(sha("one substance")) }, { ...provDoc(b), ...digests(sha("one substance")) }] },
  };
  for (const [id, opts] of Object.entries(cases)) {
    const r = w.promoteInfo(id, opts);
    assert.deepEqual(refused(r), row("PROVENANCE_REGISTER_REFUSED", PROVENANCE_ACT_CHECKS), id);
    assert.deepEqual(r.findings.map((f) => f.check), ["C-18.3"], id);
    assert.equal(w.head(id), null, id);
  }
  assert.deepEqual(w.snapshot(), s0, "nothing written");
});

test("R43: record-core's auditPass tallies C-18.3 for a folded register held as history, and not for one it does not fold", async () => {
  const w = world();
  const [a, b, c, d, e, f] = ["a", "b", "c", "d", "e", "f"].map((n) => w.cap(n));
  /* Two registers C-18.3 does not fold, written as creations. */
  assert.equal(w.promoteInfo("INFO-2026-0001-distinct", { captures: [a, b],
    docs: [{ ...provDoc(a), ...digests(sha("one")) }, { ...provDoc(b), ...digests(sha("two")) }] }).ok, true);
  assert.equal(w.promoteInfo("INFO-2026-0002-undetermined", { captures: [c, d],
    docs: [{ ...provDoc(c), ...digests(null, false) }, { ...provDoc(d), ...digests(null, false) }] }).ok, true);
  /* A register the evidentiary arm folds, held as history (a replay, exempt at the write). */
  assert.equal(w.promoteInfo("INFO-2026-0003-folded", { captures: [e, f], pkg: { replay: true },
    docs: [{ ...provDoc(e), ...digests(sha("same")) }, { ...provDoc(f), ...digests(sha("same")) }] }).ok, true);
  const page = (after, limit) => w.record.auditPass({ after, limit, visible: () => true });
  const clean = await page("", 2);
  assert.equal(clean.checked, 2);
  assert.equal("C-18.3" in clean.tally, false, JSON.stringify(clean.tally));
  const folded = await page("INFO-2026-0002-undetermined", 1);
  assert.equal(folded.checked, 1);
  assert.equal(folded.tally["C-18.3"], 1, JSON.stringify(folded.tally));
  assert.deepEqual(folded.offenders.map((o) => o.bundleId), ["INFO-2026-0003-folded"]);
  const whole = await page("", 10);
  assert.equal(whole.tally["C-18.3"], 1, "across the record, the one folded register");
});

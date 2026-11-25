/* ratification R20–R27: the bulk release (`release`, `op=release`'s store half), at the module's interface, over the real
   record-core, membership, promotion and retrieval (its selections, R19) on retrieval's fixture world. Converted from
   the old battery's `release.test.mjs` (N400, K636), which states these Rs, and from `refuse-gate`'s release arm
   (K674 (4)): a query selection swapped at a constant count is refused SET_MOVED and moves nothing; a fresh selection
   over the same criterion releases. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world as retrievalWorld, V, sha, infoMd } from "../retrieval/fixture.mjs";
import { staleBaseRefusal } from "../promotion/fixtures.mjs";
import { Ratification, ratificationOf, ratificationOps, RELEASE_ACK_MAX,
         RELEASE_CHECKS } from "../../../src/ratification/index.mjs";
import { parseFrontmatter, canonicalJson } from "../../../src/record-grammar/index.mjs";
import { contradictionOf } from "../../../src/contradiction/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const OWNER = "o";
const WHO = V("ann");
const ACK = "Batch of public jobs-board postings, uniform in kind; bulk-release risks weighed.";
const MIT = "Sampled 12 of 40; checked sender domains and posting dates against the board.";
const DATASET = JSON.stringify({ v: 1 });
const HASH = `sha256:${sha(canonicalJson(JSON.parse(DATASET)))}`;
const FULL = [{ path: "data/dataset.json", text: DATASET }, { path: "snapshots/capture.html", text: "<html/>" }];
const BODY = "\n## Summary\n\nA posting.\n\n## Session Log\n\n### Session 2026-07-02T00:00:00Z | Formation | assisted\n"
  + "Trigger: intake\nChanges: created.\n\n## Review Notes\n";

/* A world: retrieval's, with this module over its record, membership, promotion and retrieval, and contradiction's
   tables created as the plane's boot creates them (R22's contested arm reads `candidatesFor`). `promotion` may be
   wrapped by a test (R25's arms); `contradiction` may be a test's own (R22's contested arm, R34). */
function setup({ promotion, contradiction } = {}) {
  const w = retrievalWorld();
  contradictionOf(w.host).migrate();
  const r = ratificationOf(w.host, { storage: w.st, record: w.record, membership: w.membership,
                                     promotion: w.promotion, retrieval: w.retrieval, publication: {} });
  w.r = promotion || contradiction
    ? new Ratification({ storage: w.st, record: w.record, membership: w.membership,
                         promotion: promotion ? promotion(w.promotion) : w.promotion, retrieval: w.retrieval,
                         host: w.host, ...(contradiction ? { contradiction } : {}) })
    : r;
  /** A collected Information document carrying every entry requirement unless `files`, `fields` or `body` say
   *  otherwise, promoted as the control plane promotes one: the envelope's criticality is the document's unless
   *  `criticality` says otherwise. `replay` holds bytes the promotion checks would refuse today (legacy bytes). */
  let k = 0;
  w.info = (id, { fields = {}, files = FULL, body = BODY, criticality, replay = false } = {}) => {
    const fm = { content_hash: HASH, ...fields };
    const text = infoMd(id, fm).replace(/\n## Summary[\s\S]*$/, body);
    const head = w.record.head(id);
    const res = w.promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `r${++k}`, author: WHO,
      replay, files: [{ path: "bundle.md", text }, ...files],
      meta: { object_type: "information", criticality: criticality === undefined ? fm.criticality ?? "supporting" : criticality } });
    if (!res.ok) throw new Error(`fixture promote refused: ${JSON.stringify(res).slice(0, 400)}`);
    return res;
  };
  w.select = async (ids) => (await w.retrieval.selectionCreate({ owner: OWNER, viewer: WHO, ids })).handle;
  w.query = (q) => w.retrieval.selectionCreate({ owner: OWNER, viewer: WHO, q });
  w.release = (handle, o = {}) => w.r.release({ handle, acknowledgment: ACK, mitigation: MIT, viewer: WHO,
                                                owner: OWNER, author: WHO, ...o });
  w.state = (id) => w.record.head(id)?.currentState ?? null;
  w.md = (id) => w.record.readFile(id, "bundle.md")?.text ?? null;
  return w;
}
const row = (code) => ({ code, check: RELEASE_CHECKS[code].check, translation: RELEASE_CHECKS[code].translation });

/* ---- R20 ---- */

test("R20: an absent, blank or machine author is MACHINE_CANNOT_RELEASE (C-32.1) before anything else is read", async () => {
  const w = setup();
  w.info("INFO-2026-0500");
  const h = await w.select(["INFO-2026-0500"]);
  const asked = [];
  const spy = new Ratification({ storage: w.st, record: w.record, membership: w.membership, promotion: w.promotion,
    host: w.host, retrieval: { selectionResolve: (a) => { asked.push(a); return w.retrieval.selectionResolve(a); } } });
  for (const author of [undefined, null, "", "   ", "member", "token:member", "class:member", "class:ai/t1", "agent"]) {
    const r = spy.release({ handle: "no-such-handle", acknowledgment: "", mitigation: "", viewer: WHO, owner: OWNER, author });
    assert.deepEqual([r.ok, r.reason], [false, "MACHINE_CANNOT_RELEASE"], String(author));
    assert.deepEqual({ code: r.code, check: r.check, translation: r.translation }, row("MACHINE_CANNOT_RELEASE"));
    assert.match(r.detail, /named member's decision/);
  }
  assert.equal(asked.length, 0, "the selection is never read for a machine");
  assert.equal(w.state("INFO-2026-0500"), "collected");
  assert.equal(spy.release({ handle: h, acknowledgment: ACK, mitigation: MIT, viewer: WHO, owner: OWNER, author: WHO }).ok,
               true, "a member releases");
});

test("R20: an empty acknowledgment is NO_ACKNOWLEDGMENT (C-33.10), then an empty mitigation NO_MITIGATION (C-33.11), each trimmed; nothing moves", async () => {
  const w = setup();
  w.info("INFO-2026-0501");
  const h = await w.select(["INFO-2026-0501"]);
  for (const acknowledgment of ["", "   ", null, undefined]) {
    const r = w.release(h, { acknowledgment, mitigation: "" });
    assert.deepEqual({ reason: r.reason, code: r.code, check: r.check, translation: r.translation },
                     { reason: "NO_ACKNOWLEDGMENT", ...row("NO_ACKNOWLEDGMENT") }, String(acknowledgment));
  }
  for (const mitigation of ["", " \t ", null]) {
    const r = w.release(h, { mitigation });
    assert.deepEqual({ reason: r.reason, code: r.code, check: r.check, translation: r.translation },
                     { reason: "NO_MITIGATION", ...row("NO_MITIGATION") });
  }
  assert.equal(w.state("INFO-2026-0501"), "collected", "nothing moved while the paperwork was wrong");
});

test("R20: an acknowledgment, then a mitigation, over RELEASE_ACK_MAX or holding a quote, a backslash, a CR or a newline is BAD_ACKNOWLEDGMENT or BAD_MITIGATION, naming the bound and the characters; the bound itself passes", async () => {
  assert.equal(RELEASE_ACK_MAX, 500);
  const w = setup();
  for (const n of [1, 2, 3]) w.info(`INFO-2026-050${n + 1}`);
  const h = await w.select(["INFO-2026-0502"]);
  for (const bad of ["x".repeat(501), 'has "quotes"', "back\\slash", "cr\rhere", "new\nline"]) {
    const a = w.release(h, { acknowledgment: bad, mitigation: bad });
    assert.equal(a.reason, "BAD_ACKNOWLEDGMENT", JSON.stringify(bad));
    assert.equal(a.detail, "acknowledgment is at most 500 characters and cannot contain a quote, a backslash, or a newline");
    const m = w.release(h, { mitigation: bad });
    assert.equal(m.reason, "BAD_MITIGATION", JSON.stringify(bad));
    assert.equal(m.detail, "mitigation is at most 500 characters and cannot contain a quote, a backslash, or a newline");
  }
  assert.equal(w.state("INFO-2026-0502"), "collected");
  const at = w.release(h, { acknowledgment: `  ${"a".repeat(500)}  `, mitigation: "m".repeat(500) });
  assert.deepEqual([at.ok, at.acknowledgment.length, at.mitigation.length], [true, 500, 500], "trimmed, then bounded");
});

/* ---- R21 ---- */

test("R21: the selection's refusal is answered as retrieval's refuse-weight resolve gives it: NO_SUCH_SELECTION, SELECTION_NOT_YOURS", async () => {
  const w = setup();
  w.info("INFO-2026-0503");
  const h = await w.select(["INFO-2026-0503"]);
  const none = w.release("sel_nope");
  assert.equal(none.reason, "NO_SUCH_SELECTION");
  assert.deepEqual(none, w.retrieval.selectionResolve({ handle: "sel_nope", viewer: WHO, owner: OWNER, weight: "refuse" }));
  const theirs = w.release(h, { owner: "someone-else" });
  assert.equal(theirs.reason, "SELECTION_NOT_YOURS");
  assert.deepEqual(theirs, w.retrieval.selectionResolve({ handle: h, viewer: WHO, owner: "someone-else", weight: "refuse" }));
  assert.equal(w.state("INFO-2026-0503"), "collected");
});

test("R21, R27 (refuse-gate, K674 (4)): a query selection whose answer swapped at a constant count is refused SET_MOVED and moves nothing; a fresh selection over the same criterion releases", async () => {
  const w = setup();
  for (const n of [1, 2, 3]) w.info(`INFO-2026-060${n}`, { fields: { title: `swapfixture ${n}` } });
  const held = await w.query("swapfixture");
  assert.deepEqual([held.kind, held.n], ["query", 3]);
  w.record.purge({ bundleId: "INFO-2026-0601" });
  w.info("INFO-2026-0604", { fields: { title: "swapfixture 4" } });
  const report = w.retrieval.selectionResolve({ handle: held.handle, viewer: WHO, owner: OWNER, weight: "report" });
  assert.deepEqual([report.n, report.moved, report.drift.added, report.drift.removed, report.drift.digestChanged],
                   [3, false, 0, 0, true], "the count is the same and the answer is not");
  const r = w.release(held.handle);
  assert.deepEqual([r.ok, r.reason], [false, "SET_MOVED"]);
  assert.deepEqual(r, w.retrieval.selectionResolve({ handle: held.handle, viewer: WHO, owner: OWNER, weight: "refuse" }),
                   "answered as it stands");
  for (const id of ["INFO-2026-0602", "INFO-2026-0603", "INFO-2026-0604"]) assert.equal(w.state(id), "collected", id);
  const fresh = await w.query("swapfixture");
  const ok = w.release(fresh.handle);
  assert.deepEqual([ok.ok, ok.released, ok.weight], [true, ["INFO-2026-0602", "INFO-2026-0603", "INFO-2026-0604"], "refuse"]);
  assert.equal(w.state("INFO-2026-0604"), "verified");
});

test("R21: a selection resolving to no members is EMPTY_SELECTION with its handle and drift", async () => {
  const w = setup();
  w.info("INFO-2026-0504");
  const h = await w.select(["INFO-2026-0504"]);
  w.record.purge({ bundleId: "INFO-2026-0504" });
  const hEmpty = await w.select(["INFO-2026-9999"]);
  const r = w.release(hEmpty);
  const sel = w.retrieval.selectionResolve({ handle: hEmpty, viewer: WHO, owner: OWNER, weight: "refuse" });
  assert.deepEqual([r.ok, r.reason, r.handle], [false, "EMPTY_SELECTION", hEmpty]);
  assert.deepEqual(r.drift, sel.drift);
  assert.match(r.detail, /nothing to release/);
  assert.ok(h);
});

/* ---- R22, R23, R27 ---- */

test("R22, R27: the set is refused whole by the first non-empty class — NOT_INFORMATION, ILLEGAL_TRANSITION, CRUCIAL_IN_BATCH, ENTRY_REQUIREMENTS (C-33.12) — each member counted under the first class it fails; nothing moves", async () => {
  const w = setup();
  const P = w.project("Team");
  w.info("INFO-2026-0510-ok");
  w.info("INFO-2026-0511-verified");
  assert.equal(w.release(await w.select(["INFO-2026-0511-verified"])).ok, true);
  w.info("INFO-2026-0512-crucial", { fields: { criticality: "crucial" } });
  w.info("INFO-2026-0513-crucialbare", { fields: { criticality: "crucial" }, files: [] });
  w.info("INFO-2026-0514-bare", { files: [] });
  w.info("INFO-2026-0515-bare", { files: [FULL[0]] });
  const all = ["INFO-2026-0515-bare", "INFO-2026-0514-bare", "INFO-2026-0513-crucialbare", "INFO-2026-0512-crucial",
               "INFO-2026-0511-verified", "INFO-2026-0510-ok"];
  const moved = () => all.filter((id) => id !== "INFO-2026-0511-verified" && w.state(id) !== "collected");

  const a = w.release(await w.select([...all, P]));
  assert.deepEqual([a.reason, a.offenders], ["NOT_INFORMATION", [P]]);
  const b = w.release(await w.select(all));
  assert.deepEqual([b.reason, b.to, b.offenders], ["ILLEGAL_TRANSITION", "verified", [{ id: "INFO-2026-0511-verified", from: "verified" }]]);
  const c = w.release(await w.select(all.filter((x) => x !== "INFO-2026-0511-verified")));
  assert.deepEqual([c.reason, c.offenders], ["CRUCIAL_IN_BATCH", ["INFO-2026-0512-crucial", "INFO-2026-0513-crucialbare"]],
    "a crucial member lacking entry requirements is counted as crucial, its first class");
  const d = w.release(await w.select(["INFO-2026-0515-bare", "INFO-2026-0510-ok", "INFO-2026-0514-bare"]));
  assert.deepEqual({ reason: d.reason, code: d.code, check: d.check, translation: d.translation },
                   { reason: "ENTRY_REQUIREMENTS", ...row("ENTRY_REQUIREMENTS") });
  assert.deepEqual(d.offenders, [{ id: "INFO-2026-0514-bare", missing: ["data/dataset.json", "a file in snapshots/"] },
                                 { id: "INFO-2026-0515-bare", missing: ["a file in snapshots/"] }], "sorted by id");
  assert.deepEqual(moved(), [], "no document moved before every member passed");
  assert.equal(w.release(await w.select(["INFO-2026-0510-ok"])).ok, true, "the well-provisioned one alone releases");
});

test("R22, R27: a member is crucial when the record's criticality or the document's own says so; neither rides a batch", async () => {
  const w = setup();
  w.info("INFO-2026-0525-declared", { fields: { criticality: "crucial" }, criticality: "supporting" });
  w.info("INFO-2026-0526-column", { fields: { criticality: "supporting" }, criticality: "crucial" });
  w.info("INFO-2026-0527-plain");
  /* K781 (4): since N425 (promotion R39) a document stating `criticality: crucial` is recorded crucial whatever its
     envelope said, so the record and the document disagree only for a row written before N425. That row is set here as
     such a promotion left it, the column `supporting` under a document that says crucial; the verdict is unchanged. */
  assert.equal(w.row(`SELECT criticality FROM bundles WHERE bundle_id=?`, "INFO-2026-0525-declared").criticality, "crucial",
    "N425: the document's own criticality is recorded");
  w.st.sql.exec(`UPDATE bundles SET criticality='supporting' WHERE bundle_id=?`, "INFO-2026-0525-declared");
  const r = w.release(await w.select(["INFO-2026-0527-plain", "INFO-2026-0526-column", "INFO-2026-0525-declared"]));
  assert.deepEqual([r.reason, r.offenders], ["CRUCIAL_IN_BATCH", ["INFO-2026-0525-declared", "INFO-2026-0526-column"]]);
  assert.equal(w.state("INFO-2026-0527-plain"), "collected");
});

test("R22: a member no longer held is NOT_INFORMATION; each class's offenders are sorted", async () => {
  const w = setup();
  for (const id of ["INFO-2026-0522", "INFO-2026-0521"]) w.info(id, { fields: { criticality: "crucial" } });
  const c = w.release(await w.select(["INFO-2026-0522", "INFO-2026-0521"]));
  assert.deepEqual(c.offenders, ["INFO-2026-0521", "INFO-2026-0522"]);
  for (const id of ["INFO-2026-0524", "INFO-2026-0523"]) { w.info(id); w.release(await w.select([id])); }
  const i = w.release(await w.select(["INFO-2026-0524", "INFO-2026-0523"]));
  assert.deepEqual(i.offenders.map((x) => x.id), ["INFO-2026-0523", "INFO-2026-0524"]);
  /* a member the record no longer holds, met by a resolve that did not drop it */
  w.info("INFO-2026-0528");
  const gone = new Ratification({ storage: w.st, record: w.record, membership: w.membership, promotion: w.promotion,
    retrieval: { selectionResolve: () => ({ ok: true, members: ["INFO-2026-0528", "INFO-2026-0404"], drift: {} }) } });
  const n = gone.release({ handle: "h", acknowledgment: ACK, mitigation: MIT, viewer: WHO, owner: OWNER, author: WHO });
  assert.deepEqual([n.reason, n.offenders], ["NOT_INFORMATION", ["INFO-2026-0404"]]);
  assert.equal(w.state("INFO-2026-0528"), "collected");
});

test("R23: a member's `missing` names, in order, a malformed content_hash, data/dataset.json, a file in snapshots/, and each register document without a provenance_chain (C-18.9)", async () => {
  const w = setup();
  const prov = (docs) => ({ path: "data/provenance.json", text: JSON.stringify({ documents: docs }) });
  const chain = [{ who: "observer:x", what: "fetched" }];
  w.info("INFO-2026-0530", { fields: { content_hash: "sha256:ABC" }, replay: true, files: [
    prov([{ provenance_chain: chain }, { provenance_chain: [] }, {}, { provenance_chain: "x" }, null])] });
  w.info("INFO-2026-0531", { files: [...FULL, prov([{ provenance_chain: chain }])], replay: true });
  w.info("INFO-2026-0532", { files: [...FULL, { path: "data/provenance.json", text: "{ not json" }], replay: true });
  w.info("INFO-2026-0533", { fields: { content_hash: undefined } });
  const r = w.release(await w.select(["INFO-2026-0530", "INFO-2026-0531", "INFO-2026-0532", "INFO-2026-0533"]));
  assert.equal(r.reason, "ENTRY_REQUIREMENTS");
  assert.deepEqual(r.offenders, [
    { id: "INFO-2026-0530", missing: ["well-formed content_hash", "data/dataset.json", "a file in snapshots/",
                                      "a provenance_chain for documents[1], documents[2], documents[3], documents[4] (C-18.9)"] },
    { id: "INFO-2026-0533", missing: ["well-formed content_hash"] }]);
  for (const bad of ["sha256:" + "a".repeat(63), "sha256:" + "A".repeat(64), "md5:" + "a".repeat(64), "a".repeat(64)]) {
    const v = setup();
    v.info("INFO-2026-0534", { fields: { content_hash: bad } });
    assert.deepEqual(v.release(await v.select(["INFO-2026-0534"])).offenders, [{ id: "INFO-2026-0534", missing: ["well-formed content_hash"] }], bad);
  }
});

/* ---- R24, R26 ---- */

test("R24, R26: every member is released as a new version authored by the member, at one instant, its history, states and Session Log recording the batch; the answer is the sorted ids, the trimmed account, the weight and the drift", async () => {
  const w = setup();
  const ids = ["INFO-2026-0542", "INFO-2026-0540", "INFO-2026-0541"];
  for (const id of ids) w.info(id);
  const before = Object.fromEntries(ids.map((id) => [id, w.record.head(id)]));
  const files = (id) => w.rows(`SELECT path, sha256 FROM files WHERE bundle_id=? AND path<>'bundle.md' ORDER BY path`, id);
  const carried = Object.fromEntries(ids.map((id) => [id, files(id)]));
  const h = await w.select(ids);
  const sel = w.retrieval.selectionResolve({ handle: h, viewer: WHO, owner: OWNER, weight: "report" });
  const r = w.release(h, { acknowledgment: `  ${ACK} `, mitigation: ` ${MIT}` });
  assert.deepEqual(Object.keys(r), ["ok", "handle", "released", "acknowledgment", "mitigation", "weight", "drift"]);
  assert.deepEqual([r.ok, r.handle, r.released, r.acknowledgment, r.mitigation, r.weight],
                   [true, h, [...ids].sort(), ACK, MIT, "refuse"]);
  assert.deepEqual(r.drift, sel.drift);
  const instants = new Set();
  for (const id of ids) {
    const text = w.md(id);
    const fm = parseFrontmatter(text).data;
    instants.add(fm.last_updated);
    assert.match(fm.last_updated, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, "to the second");
    assert.deepEqual([fm.current_state, fm.prior_state, fm.criticality], ["verified", "collected", "supporting"]);
    assert.deepEqual(fm.state_history, [{ timestamp: fm.last_updated, from_state: "collected", to_state: "verified",
      blurb: word("ratification.blurb", { handle: String(h) }), author: WHO }]);
    const log = text.slice(text.indexOf("## Session Log"), text.indexOf("## Review Notes"));
    assert.ok(log.endsWith(`### Session ${fm.last_updated} | Released (batch) | ${WHO}\nTrigger: selection ${h}\n`
      + `Changes: state collected to verified.\nAcknowledgment: ${ACK}\nMitigation: ${MIT}\n\n`), log);
    assert.ok(log.startsWith("## Session Log\n\n### Session 2026-07-02T00:00:00Z | Formation"), "placed at the section's end");
    const head = w.record.head(id);
    assert.deepEqual([head.currentState, head.priorState, head.rowVersion], ["verified", "collected", before[id].rowVersion + 1]);
    assert.deepEqual(files(id), carried[id], "every other file carried unchanged");
    assert.equal(w.row(`SELECT criticality FROM bundles WHERE bundle_id=?`, id).criticality, "supporting");
    assert.equal(w.row(`SELECT author FROM manifest WHERE bundle_id=? ORDER BY created DESC, rowid DESC LIMIT 1`, id).author, WHO);
  }
  assert.equal(instants.size, 1, "one instant for the whole batch");
});

test("R24: a document with no Session Log gains the section at its end; one whose state_history is populated keeps its entries first", async () => {
  const w = setup();
  w.info("INFO-2026-0550", { body: "\n## Summary\n\nNo log here.\n" });
  const r = w.release(await w.select(["INFO-2026-0550"]));
  assert.equal(r.ok, true);
  const text = w.md("INFO-2026-0550");
  assert.match(text, /\n## Summary\n\nNo log here\.\n\n## Session Log\n\n### Session \S+ \| Released \(batch\) \| member:ann\n/);
  assert.ok(text.endsWith(`Mitigation: ${MIT}\n`));
  const v = setup();
  v.info("INFO-2026-0551");
  const t = v.md("INFO-2026-0551").replace("---\n\n## Summary", `state_history:\n  - timestamp: "2026-07-01T00:00:00Z"\n    from_state: null\n    to_state: collected\n    blurb: "intake"\n    author: ${WHO}\n---\n\n## Summary`);
  v.promotion.promote({ bundleId: "INFO-2026-0551", base: v.record.head("INFO-2026-0551").bundleSha, snapKey: "kx", author: WHO,
    files: [{ path: "bundle.md", text: t }, ...FULL], meta: { object_type: "information" } });
  assert.equal(v.release(await v.select(["INFO-2026-0551"])).ok, true);
  const h = parseFrontmatter(v.md("INFO-2026-0551")).data.state_history;
  assert.deepEqual(h.map((x) => x.to_state), ["collected", "verified"], "chronological");
});

/* ---- R25 ---- */

test("R25: a member whose bundle.md is gone at its turn is NO_DOCUMENT, one whose state_history cannot be extended UNSPLICEABLE_STATE_HISTORY, and a refusal from promote is answered as promote gave it; each names bundleId and releasedSoFar, and the members already released stay released", async () => {
  const ids = ["INFO-2026-0560", "INFO-2026-0561"];
  /* After the first member's promotion, `after(w)` changes the second as the pre-flight has already passed it. */
  const drive = async (after, refuse = null) => {
    let n = 0, world = null;
    const w = setup({ promotion: (p) => ({ promote: (pkg) => {
      if (refuse && n === 1) { n++; return refuse; }
      const out = p.promote(pkg);
      if (n++ === 0) after(world);
      return out;
    } }) });
    world = w;
    for (const id of ids) w.info(id);
    return { w, r: w.release(await w.select(ids)) };
  };
  const gone = await drive((w) => w.st.sql.exec(`UPDATE files SET content=NULL, blob_sha='b' WHERE bundle_id=? AND path='bundle.md'`, ids[1]));
  assert.deepEqual(gone.r, { ok: false, reason: "NO_DOCUMENT", bundleId: ids[1], releasedSoFar: [ids[0]] });
  assert.deepEqual([gone.w.state(ids[0]), gone.w.state(ids[1])], ["verified", "collected"]);
  const unsplice = await drive((w) => w.st.sql.exec(`UPDATE files SET content=replace(content, 'current_state:', 'state_history: odd\ncurrent_state:') WHERE bundle_id=? AND path='bundle.md'`, ids[1]));
  assert.deepEqual([unsplice.r.reason, unsplice.r.bundleId, unsplice.r.releasedSoFar], ["UNSPLICEABLE_STATE_HISTORY", ids[1], [ids[0]]]);
  assert.match(unsplice.r.detail, /C-4\.2/);
  assert.equal(unsplice.w.state(ids[0]), "verified");
  const stale = staleBaseRefusal();
  const refused = await drive(() => {}, stale);
  assert.deepEqual(refused.r, { ...stale, bundleId: ids[1], releasedSoFar: [ids[0]] });
  assert.equal(refused.w.state(ids[0]), "verified");
});

/* ---- the op ---- */

test("R20, R26: the store half's `release` op reads the handle, the account and the control plane's stamps from the query", async () => {
  const w = setup();
  w.info("INFO-2026-0570");
  const h = await w.select(["INFO-2026-0570"]);
  const url = (q) => new URL(`http://do/release?${new URLSearchParams(q)}`);
  const machine = ratificationOps(w.r, url({ handle: h, acknowledgment: ACK, mitigation: MIT, viewer: WHO, owner: OWNER }), null).release();
  assert.equal(machine.reason, "MACHINE_CANNOT_RELEASE", "no author stamp");
  const ok = ratificationOps(w.r, url({ handle: h, acknowledgment: ACK, mitigation: MIT, viewer: WHO, owner: OWNER, author: WHO }), null).release();
  assert.deepEqual([ok.ok, ok.released], [true, ["INFO-2026-0570"]]);
});

test("R51: release reads its handle, acknowledgment and mitigation from the body, else the query: a body carrying them answers as the same fields in the query do, never NO_ACKNOWLEDGMENT or NO_MITIGATION; a body carrying author, viewer or owner changes no stamp", async () => {
  const url = (q) => new URL(`http://do/release?${new URLSearchParams(q)}`);
  const stamps = { viewer: WHO, owner: OWNER, author: WHO };
  const drive = async (where) => {
    const w = setup();
    w.info("INFO-2026-0575");
    const h = await w.select(["INFO-2026-0575"]);
    const fields = { handle: h, acknowledgment: ` ${ACK} `, mitigation: MIT };
    const r = where === "body"
      ? ratificationOps(w.r, url(stamps), { ...fields, author: V("mallory"), viewer: V("mallory"), owner: "someone-else" }).release()
      : ratificationOps(w.r, url({ ...stamps, ...fields }), null).release();
    return { w, r: { ...r, handle: r.handle === h ? "<h>" : r.handle } };
  };
  const body = await drive("body"), query = await drive("query");
  assert.deepEqual(body.r, query.r, "answered alike");
  assert.deepEqual([body.r.ok, body.r.released, body.r.acknowledgment, body.r.mitigation], [true, ["INFO-2026-0575"], ACK, MIT]);
  for (const x of [body, query]) {
    assert.equal(x.w.state("INFO-2026-0575"), "verified");
    assert.equal(parseFrontmatter(x.w.md("INFO-2026-0575")).data.state_history.at(-1).author, WHO,
                 "the author is the query's stamp, never the body's");
  }
  /* controls: a body with no author stamp in the query is still a machine's release; the body's own field wins; a field
     the body does not state as a string is the query's */
  const w = setup();
  w.info("INFO-2026-0576");
  const h = await w.select(["INFO-2026-0576"]);
  const machine = ratificationOps(w.r, url({ viewer: WHO, owner: OWNER }),
                                  { handle: h, acknowledgment: ACK, mitigation: MIT, author: WHO }).release();
  assert.equal(machine.reason, "MACHINE_CANNOT_RELEASE", "an author in the body is no stamp");
  const noAck = ratificationOps(w.r, url({ ...stamps, handle: h, acknowledgment: ACK, mitigation: MIT }), { acknowledgment: "" }).release();
  assert.equal(noAck.reason, "NO_ACKNOWLEDGMENT", "the body's own (empty) acknowledgment is the one read");
  const noMit = ratificationOps(w.r, url({ ...stamps, handle: h, acknowledgment: ACK, mitigation: MIT }), { mitigation: " " }).release();
  assert.equal(noMit.reason, "NO_MITIGATION");
  assert.equal(w.state("INFO-2026-0576"), "collected");
  const odd = ratificationOps(w.r, url({ ...stamps, handle: "nope", acknowledgment: ACK, mitigation: MIT }),
                              { handle: h, acknowledgment: null, mitigation: 3 }).release();
  assert.deepEqual([odd.ok, odd.released, odd.mitigation], [true, ["INFO-2026-0576"], MIT], "non-string fields in the body are not read");
});

test("R15: no place is named in the release's answers", async () => {
  const w = setup();
  w.info("INFO-2026-0580", { files: [] });
  const h = await w.select(["INFO-2026-0580"]);
  const said = [w.release(h, { author: "" }), w.release(h, { acknowledgment: "" }), w.release(h, { mitigation: "" }),
                w.release(h, { acknowledgment: '"' }), w.release(h), w.release("nope"), RELEASE_CHECKS];
  assert.doesNotMatch(JSON.stringify(said), /oakland|alameda|california|berkeley/i);
});

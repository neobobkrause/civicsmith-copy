/* ratification R28–R33: the bulk retirement (`retire`, `op=retire`'s store half), at the module's interface, over the real
   record-core, membership, promotion and retrieval (its selections) on retrieval's fixture world, with connections'
   `citesInto` (its R22) answered by a provider the test sets, as `ratificationOf`'s deps take one. Documents reach
   `verified` through this module's own release (R20–R26), the only legal route into retire's state. The refuse-gate
   suite's retire arm (K674 (4)), converted at legacy-store's interface in T18 (`test/m/legacy-store/retire.test.mjs`,
   K720), is restated here at this module's: a query selection swapped at a constant count is refused SET_MOVED and
   moves nothing; a fresh selection over the same criterion retires. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world as retrievalWorld, V, sha, infoMd } from "../retrieval/fixture.mjs";
import { staleBaseRefusal } from "../promotion/fixtures.mjs";
import { Ratification, ratificationOf, ratificationOps, EDGE_REASON_MAX } from "../../../src/ratification/index.mjs";
import { RETIRE_CITED_DETAIL } from "../../../src/promotion/index.mjs";
import { parseFrontmatter, canonicalJson } from "../../../src/record-grammar/index.mjs";
import { contradictionOf } from "../../../src/contradiction/index.mjs";

const OWNER = "o";
const WHO = V("ann");
const ACK = "Batch of public jobs-board postings, uniform in kind; bulk-release risks weighed.";
const MIT = "Sampled 12 of 40; checked sender domains and posting dates against the board.";
const WHY = "superseded by the consolidated record";
const DATASET = JSON.stringify({ v: 1 });
const HASH = `sha256:${sha(canonicalJson(JSON.parse(DATASET)))}`;
const FULL = [{ path: "data/dataset.json", text: DATASET }, { path: "snapshots/capture.html", text: "<html/>" }];
const BODY = "\n## Summary\n\nA posting.\n\n## Session Log\n\n### Session 2026-07-02T00:00:00Z | Formation | assisted\n"
  + "Trigger: intake\nChanges: created.\n\n## Review Notes\n";

/* A world: retrieval's, with this module over its record, membership, promotion and retrieval, and connections'
   `citesInto` answering from `w.cites` (id -> {confirmed, severed}; none by default). `promotion` and `retrieval` may be
   wrapped by a test. */
function setup({ promotion, retrieval } = {}) {
  const w = retrievalWorld();
  contradictionOf(w.host).migrate();   /* the plane's boot creates contradiction's tables (R22's contested arm reads them) */
  w.cites = new Map();
  w.citesAsked = [];
  const connections = { citesInto: (id) => { w.citesAsked.push(id); return w.cites.get(id) ?? { confirmed: [], severed: [] }; } };
  const r = ratificationOf(w.host, { storage: w.st, record: w.record, membership: w.membership,
                                     promotion: w.promotion, retrieval: w.retrieval, connections, publication: {} });
  w.r = promotion || retrieval
    ? new Ratification({ storage: w.st, record: w.record, membership: w.membership,
                         promotion: promotion ? promotion(w.promotion) : w.promotion,
                         retrieval: retrieval ? retrieval(w.retrieval) : w.retrieval, connections, host: w.host })
    : r;
  let k = 0;
  /** A collected Information document carrying every entry requirement unless `files` or `body` say otherwise. */
  w.info = (id, { fields = {}, files = FULL, body = BODY } = {}) => {
    const text = infoMd(id, { content_hash: HASH, ...fields }).replace(/\n## Summary[\s\S]*$/, body);
    const head = w.record.head(id);
    const res = w.promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `r${++k}`, author: WHO,
      files: [{ path: "bundle.md", text }, ...files], meta: { object_type: "information", criticality: "supporting" } });
    if (!res.ok) throw new Error(`fixture promote refused: ${JSON.stringify(res).slice(0, 400)}`);
    return res;
  };
  w.select = async (ids) => (await w.retrieval.selectionCreate({ owner: OWNER, viewer: WHO, ids })).handle;
  w.query = (q) => w.retrieval.selectionCreate({ owner: OWNER, viewer: WHO, q });
  /** `ids` made `verified` through the release (R24): collected Information carrying every entry requirement. */
  w.verified = async (...ids) => {
    for (const id of ids) if (!w.record.head(id)) w.info(id);
    const rel = w.r.release({ handle: await w.select(ids), acknowledgment: ACK, mitigation: MIT, viewer: WHO,
                              owner: OWNER, author: WHO });
    assert.equal(rel.ok, true, `fixture release: ${JSON.stringify(rel).slice(0, 300)}`);
  };
  w.retire = (handle, o = {}) => w.r.retire({ handle, reason: WHY, viewer: WHO, owner: OWNER, author: WHO, ...o });
  w.state = (id) => w.record.head(id)?.currentState ?? null;
  w.md = (id) => w.record.readFile(id, "bundle.md")?.text ?? null;
  return w;
}

/* ---- R28 ---- */

test("R28: the trimmed reason — empty is NO_REASON, over EDGE_REASON_MAX or holding a quote, a backslash, a CR or a newline BAD_REASON naming the bound and the characters — asked before anything else is read; the bound itself passes", async () => {
  assert.equal(EDGE_REASON_MAX, 160);
  const asked = [];
  const w = setup({ retrieval: (real) => ({ selectionResolve: (a) => { asked.push(a); return real.selectionResolve(a); } }) });
  await w.verified("INFO-2026-0700");
  const h = await w.select(["INFO-2026-0700"]);
  asked.length = 0;   /* the fixture's release read its own selection */
  for (const reason of ["", "   ", null, undefined, " \t "]) {
    const r = w.retire("no-such-handle", { reason });
    assert.deepEqual([r.ok, r.reason], [false, "NO_REASON"], String(reason));
    assert.match(r.detail, /records WHY/);
  }
  for (const bad of ["x".repeat(161), 'has "quotes"', "back\\slash", "cr\rhere", "new\nline"]) {
    const r = w.retire("no-such-handle", { reason: bad });
    assert.deepEqual([r.ok, r.reason, r.detail], [false, "BAD_REASON",
      "a reason is at most 160 characters and cannot contain a quote, a backslash, or a newline"], JSON.stringify(bad));
  }
  assert.deepEqual([asked.length, w.citesAsked.length], [0, 0], "neither the selection nor a citation was read");
  assert.equal(w.state("INFO-2026-0700"), "verified");
  const at = w.retire(h, { reason: `  ${"r".repeat(160)}  ` });
  assert.deepEqual([at.ok, at.reason], [true, "r".repeat(160)], "trimmed, then bounded: 160 characters pass");
});

/* ---- R29, R33 ---- */

test("R29: the selection's refusal is answered as retrieval's refuse-weight resolve gives it: NO_SUCH_SELECTION, SELECTION_NOT_YOURS; nothing moves", async () => {
  const w = setup();
  await w.verified("INFO-2026-0701");
  const h = await w.select(["INFO-2026-0701"]);
  const none = w.retire("sel_nope");
  assert.equal(none.reason, "NO_SUCH_SELECTION");
  assert.deepEqual(none, w.retrieval.selectionResolve({ handle: "sel_nope", viewer: WHO, owner: OWNER, weight: "refuse" }));
  const theirs = w.retire(h, { owner: "someone-else" });
  assert.equal(theirs.reason, "SELECTION_NOT_YOURS");
  assert.deepEqual(theirs, w.retrieval.selectionResolve({ handle: h, viewer: WHO, owner: "someone-else", weight: "refuse" }));
  assert.equal(w.state("INFO-2026-0701"), "verified");
});

test("R29, R33 (refuse-gate, K674 (4), K720): a query selection whose answer swapped at a constant count is refused SET_MOVED and moves nothing; a fresh selection over the same criterion retires every member", async () => {
  const w = setup();
  const id = (n) => `INFO-2026-061${n}-retirefixture`;
  for (const n of [1, 2, 3, 4, 5]) w.info(id(n), { fields: { title: `retirefixture ${n}` } });
  await w.verified(...[1, 2, 3, 4].map(id));
  const held = await w.query("state:verified retirefixture");
  assert.deepEqual([held.kind, held.n], ["query", 4]);
  /* the swap, at a constant count: one leaves the answer, one joins it */
  w.record.purge({ bundleId: id(1) });
  await w.verified(id(5));
  const report = w.retrieval.selectionResolve({ handle: held.handle, viewer: WHO, owner: OWNER, weight: "report" });
  assert.deepEqual([report.n, report.moved, report.drift.added, report.drift.removed, report.drift.digestChanged],
                   [4, false, 0, 0, true], "the count is the same and the answer is not");
  const r = w.retire(held.handle);
  assert.deepEqual([r.ok, r.reason], [false, "SET_MOVED"]);
  assert.deepEqual(r, w.retrieval.selectionResolve({ handle: held.handle, viewer: WHO, owner: OWNER, weight: "refuse" }),
                   "answered as it stands");
  for (const n of [2, 3, 4, 5]) assert.equal(w.state(id(n)), "verified", `${id(n)} did not move`);
  const fresh = await w.query("state:verified retirefixture");
  const done = w.retire(fresh.handle);
  assert.deepEqual([done.ok, done.weight, done.retired], [true, "refuse", [2, 3, 4, 5].map(id)]);
  for (const n of [2, 3, 4, 5]) assert.equal(w.state(id(n)), "retired", `${id(n)} is retired`);
});

test("R29: a selection resolving to no members is EMPTY_SELECTION with its handle and drift", async () => {
  const w = setup();
  const h = await w.select(["INFO-2026-9999"]);
  const r = w.retire(h);
  const sel = w.retrieval.selectionResolve({ handle: h, viewer: WHO, owner: OWNER, weight: "refuse" });
  assert.deepEqual([r.ok, r.reason, r.handle], [false, "EMPTY_SELECTION", h]);
  assert.deepEqual(r.drift, sel.drift);
  assert.match(r.detail, /nothing to retire/);
});

test("R29, R33: the set is refused whole by the first non-empty class — NOT_INFORMATION, ILLEGAL_TRANSITION to retired, CITED with promotion's RETIRE_CITED_DETAIL — each member counted under the first class it fails, offenders sorted; nothing moves", async () => {
  const w = setup();
  const P = w.project("Team");
  await w.verified("INFO-2026-0712-ok", "INFO-2026-0713-cited", "INFO-2026-0714-cited", "INFO-2026-0716-retired");
  w.info("INFO-2026-0711-collected");
  w.info("INFO-2026-0715-collected-cited");
  assert.equal(w.retire(await w.select(["INFO-2026-0716-retired"])).ok, true);
  w.cites.set("INFO-2026-0714-cited", { confirmed: ["PROJ-2026-0002-b", "INQ-2026-0001-a"].sort(), severed: [] });
  w.cites.set("INFO-2026-0713-cited", { confirmed: ["INQ-2026-0003-c"], severed: ["INQ-2026-0004-d"] });
  w.cites.set("INFO-2026-0715-collected-cited", { confirmed: ["INQ-2026-0005-e"], severed: [] });
  const all = ["INFO-2026-0716-retired", "INFO-2026-0715-collected-cited", "INFO-2026-0714-cited",
               "INFO-2026-0713-cited", "INFO-2026-0712-ok", "INFO-2026-0711-collected"];
  const states = () => Object.fromEntries(all.map((id) => [id, w.state(id)]));
  const before = states();

  const a = w.retire(await w.select([...all, P]));
  assert.deepEqual([a.ok, a.reason, a.offenders], [false, "NOT_INFORMATION", [P]]);
  assert.match(a.detail, /refused whole rather than narrowed/);
  const b = w.retire(await w.select(all));
  assert.deepEqual([b.reason, b.to, b.offenders], ["ILLEGAL_TRANSITION", "retired", [
    { id: "INFO-2026-0711-collected", from: "collected" },
    { id: "INFO-2026-0715-collected-cited", from: "collected" },
    { id: "INFO-2026-0716-retired", from: "retired" }]], "a collected member a live edge cites is counted under its first class");
  const c = w.retire(await w.select(["INFO-2026-0714-cited", "INFO-2026-0712-ok", "INFO-2026-0713-cited"]));
  assert.deepEqual([c.reason, c.offenders, c.detail], ["CITED", [
    { id: "INFO-2026-0713-cited", citedBy: ["INQ-2026-0003-c"] },
    { id: "INFO-2026-0714-cited", citedBy: ["INQ-2026-0001-a", "PROJ-2026-0002-b"] }], RETIRE_CITED_DETAIL],
    "the citers are the confirmed ids; a severed edge is not one; the detail is promotion R16's own words");
  assert.equal("to" in c, false);
  assert.deepEqual(states(), before, "no document moved before every member passed");
  const ok = w.retire(await w.select(["INFO-2026-0712-ok"]));
  assert.deepEqual([ok.ok, ok.retired], [true, ["INFO-2026-0712-ok"]], "negative control: the uncited verified one alone retires");
});

test("R29: a member the record no longer holds, met by a resolve that did not drop it, is NOT_INFORMATION, offenders sorted; nothing moves", async () => {
  const w = setup({ retrieval: () => ({ selectionResolve: () => ({ ok: true, drift: {},
    members: ["INFO-2026-0718", "INFO-2026-0404", "INFO-2026-0403"] }) }) });
  w.info("INFO-2026-0718");
  w.st.sql.exec(`UPDATE bundles SET current_state='verified' WHERE bundle_id=?`, "INFO-2026-0718");
  const n = w.retire("h");
  assert.deepEqual([n.reason, n.offenders], ["NOT_INFORMATION", ["INFO-2026-0403", "INFO-2026-0404"]]);
  assert.equal(w.state("INFO-2026-0718"), "verified");
});

test("R29, R33: an edge severed with a reason does not block — the citers are only the confirmed ids connections answers", async () => {
  const w = setup();
  await w.verified("INFO-2026-0720");
  w.cites.set("INFO-2026-0720", { confirmed: [], severed: ["INQ-2026-0001-a", "INQ-2026-0002-b"] });
  const r = w.retire(await w.select(["INFO-2026-0720"]));
  assert.deepEqual([r.ok, r.retired], [true, ["INFO-2026-0720"]]);
  assert.deepEqual(w.citesAsked, ["INFO-2026-0720"], "connections' citesInto was asked of the member");
});

/* ---- R30, R31 ---- */

test("R30, R31: every member is retired as a new version authored by the stamped author, at one instant, its history, states and Session Log recording the reason; the answer is the trimmed reason, the handle, the sorted ids, the weight and the drift", async () => {
  const w = setup();
  const ids = ["INFO-2026-0732", "INFO-2026-0730", "INFO-2026-0731"];
  await w.verified(...ids);
  const before = Object.fromEntries(ids.map((id) => [id, w.record.head(id)]));
  const files = (id) => w.rows(`SELECT path, sha256 FROM files WHERE bundle_id=? AND path<>'bundle.md' ORDER BY path`, id);
  const carried = Object.fromEntries(ids.map((id) => [id, files(id)]));
  const h = await w.select(ids);
  const sel = w.retrieval.selectionResolve({ handle: h, viewer: WHO, owner: OWNER, weight: "report" });
  const r = w.retire(h, { reason: `  ${WHY} ` });
  assert.deepEqual(Object.keys(r), ["ok", "reason", "handle", "retired", "weight", "drift"]);
  assert.deepEqual([r.ok, r.reason, r.handle, r.retired, r.weight], [true, WHY, h, [...ids].sort(), "refuse"]);
  assert.deepEqual(r.drift, sel.drift);
  const instants = new Set();
  for (const id of ids) {
    const text = w.md(id);
    const fm = parseFrontmatter(text).data;
    instants.add(fm.last_updated);
    assert.match(fm.last_updated, /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/, "to the second");
    assert.deepEqual([fm.current_state, fm.prior_state, fm.criticality], ["retired", "verified", "supporting"]);
    assert.deepEqual(fm.state_history.at(-1), { timestamp: fm.last_updated, from_state: "verified", to_state: "retired",
                                                blurb: WHY, author: WHO });
    assert.deepEqual(fm.state_history.map((x) => x.to_state), ["verified", "retired"], "appended after the release's");
    const log = text.slice(text.indexOf("## Session Log"), text.indexOf("## Review Notes"));
    assert.ok(log.endsWith(`### Session ${fm.last_updated} | Retired | ${WHO}\nTrigger: selection ${h}\n`
      + `Changes: state verified to retired. Reason: ${WHY}.\n\n`), log);
    assert.ok(log.startsWith("## Session Log\n\n### Session 2026-07-02T00:00:00Z | Formation"), "placed at the section's end");
    const head = w.record.head(id);
    assert.deepEqual([head.currentState, head.priorState, head.rowVersion], ["retired", "verified", before[id].rowVersion + 1]);
    assert.deepEqual(files(id), carried[id], "every other file carried unchanged");
    assert.equal(w.row(`SELECT criticality FROM bundles WHERE bundle_id=?`, id).criticality, "supporting");
    assert.equal(w.row(`SELECT author FROM manifest WHERE bundle_id=? ORDER BY created DESC, rowid DESC LIMIT 1`, id).author, WHO);
  }
  assert.equal(instants.size, 1, "one instant for the whole call");
});

test("R30: with no author stamped the retirement is authored `member`; a document with no Session Log gains the section at its end", async () => {
  const w = setup();
  await w.verified("INFO-2026-0740");
  /* a verified revision carrying no Session Log (the release wrote one; this revision is a member's own edit) */
  const live = w.md("INFO-2026-0740");
  const bare = live.slice(0, live.indexOf("\n## Session Log")) + "\n";
  const rev = w.promotion.promote({ bundleId: "INFO-2026-0740", base: w.record.head("INFO-2026-0740").bundleSha, snapKey: "kv",
    author: WHO, files: [{ path: "bundle.md", text: bare }, ...FULL], meta: { object_type: "information" } });
  assert.equal(rev.ok, true, JSON.stringify(rev).slice(0, 300));
  assert.deepEqual([w.state("INFO-2026-0740"), w.md("INFO-2026-0740").includes("## Session Log")], ["verified", false]);
  const r = w.retire(await w.select(["INFO-2026-0740"]), { author: null });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  const text = w.md("INFO-2026-0740");
  const fm = parseFrontmatter(text).data;
  assert.equal(fm.state_history.at(-1).author, "member");
  assert.ok(text.endsWith(`\n## Session Log\n\n### Session ${fm.last_updated} | Retired | member\nTrigger: selection `
    + `${r.handle}\nChanges: state verified to retired. Reason: ${WHY}.\n`), text.slice(-300));
  assert.equal(w.row(`SELECT author FROM manifest WHERE bundle_id=? ORDER BY created DESC, rowid DESC LIMIT 1`,
                     "INFO-2026-0740").author, "member");
});

test("R30, R33: a member whose bundle.md is gone at its turn is NO_DOCUMENT, one whose state_history cannot be extended UNSPLICEABLE_STATE_HISTORY, and a refusal from promote is answered as promote gave it; each names bundleId and retiredSoFar, and the members already retired stay retired", async () => {
  const ids = ["INFO-2026-0750", "INFO-2026-0751"];
  /* After the first member's retirement, `after(w)` changes the second as the examination has already passed it. */
  const drive = async (after, refuse = null) => {
    let n = 0, armed = false, world = null;
    const w = setup({ promotion: (p) => ({ promote: (pkg) => {
      if (!armed) return p.promote(pkg);
      if (refuse && n === 1) { n++; return refuse; }
      const out = p.promote(pkg);
      if (n++ === 0) after(world);
      return out;
    } }) });
    world = w;
    await w.verified(...ids);
    armed = true;
    return { w, r: w.retire(await w.select(ids)) };
  };
  const gone = await drive((w) => w.st.sql.exec(`UPDATE files SET content=NULL, blob_sha='b' WHERE bundle_id=? AND path='bundle.md'`, ids[1]));
  assert.deepEqual(gone.r, { ok: false, reason: "NO_DOCUMENT", bundleId: ids[1], retiredSoFar: [ids[0]] });
  assert.deepEqual([gone.w.state(ids[0]), gone.w.state(ids[1])], ["retired", "verified"]);
  const unsplice = await drive((w) => w.st.sql.exec(`UPDATE files SET content=replace(content, 'current_state:', 'state_history: odd\ncurrent_state:') WHERE bundle_id=? AND path='bundle.md'`, ids[1]));
  assert.deepEqual([unsplice.r.reason, unsplice.r.bundleId, unsplice.r.retiredSoFar], ["UNSPLICEABLE_STATE_HISTORY", ids[1], [ids[0]]]);
  assert.match(unsplice.r.detail, /C-4\.2/);
  assert.equal(unsplice.w.state(ids[0]), "retired");
  const stale = staleBaseRefusal();
  const refused = await drive(() => {}, stale);
  assert.deepEqual(refused.r, { ...stale, bundleId: ids[1], retiredSoFar: [ids[0]] });
  assert.equal(refused.w.state(ids[0]), "retired");
});

/* ---- R32: the op ---- */

test("R32: the ops map answers retire beside the other nine, reading the control plane's stamps from the query, never from the body", async () => {
  const w = setup();
  await w.verified("INFO-2026-0760");
  const h = await w.select(["INFO-2026-0760"]);
  const url = (q) => new URL(`http://do/retire?${new URLSearchParams(q)}`);
  assert.deepEqual(Object.keys(ratificationOps(w.r, url({}), null)).sort(),
    ["caseapproval", "casegate", "caseratify", "casetestimony", "gatefacts", "publish", "publishat", "ratifygate", "release", "retire"]);
  const stamps = { viewer: WHO, owner: OWNER, author: WHO };
  const fromBody = ratificationOps(w.r, url({ handle: h, reason: WHY }), stamps).retire();
  assert.equal(fromBody.ok, false, "stamps in the body are not read");
  assert.equal(w.state("INFO-2026-0760"), "verified");
  const theirs = ratificationOps(w.r, url({ handle: h, reason: WHY, viewer: WHO, owner: "someone-else", author: WHO }), stamps).retire();
  assert.equal(theirs.reason, "SELECTION_NOT_YOURS", "the owner stamp is the query's");
  const ok = ratificationOps(w.r, url({ handle: h, reason: WHY, viewer: WHO, owner: OWNER, author: V("vera") }), stamps).retire();
  assert.deepEqual([ok.ok, ok.retired, ok.reason], [true, ["INFO-2026-0760"], WHY]);
  assert.equal(parseFrontmatter(w.md("INFO-2026-0760")).data.state_history.at(-1).author, V("vera"), "the author stamp is the query's");
});

test("R51: retire reads its handle and reason from the body, else the query: a body carrying them answers as the same fields in the query do, never NO_REASON; a body carrying author, viewer or owner changes no stamp", async () => {
  const url = (q) => new URL(`http://do/retire?${new URLSearchParams(q)}`);
  const stamps = { viewer: WHO, owner: OWNER, author: WHO };
  const drive = async (where) => {
    const w = setup();
    await w.verified("INFO-2026-0765");
    const h = await w.select(["INFO-2026-0765"]);
    const fields = { handle: h, reason: `  ${WHY} ` };
    const r = where === "body"
      ? ratificationOps(w.r, url(stamps), { ...fields, author: V("mallory"), viewer: V("mallory"), owner: "someone-else" }).retire()
      : ratificationOps(w.r, url({ ...stamps, ...fields }), null).retire();
    return { w, r: { ...r, handle: r.handle === h ? "<h>" : r.handle } };
  };
  const body = await drive("body"), query = await drive("query");
  assert.deepEqual(body.r, query.r, "answered alike");
  assert.deepEqual([body.r.ok, body.r.reason, body.r.retired], [true, WHY, ["INFO-2026-0765"]]);
  for (const x of [body, query]) {
    assert.equal(x.w.state("INFO-2026-0765"), "retired");
    assert.equal(parseFrontmatter(x.w.md("INFO-2026-0765")).data.state_history.at(-1).author, WHO,
                 "the author is the query's stamp, never the body's");
  }
  /* controls: the body's field wins over the query's; a field the body does not state as a string is the query's */
  const w = setup();
  await w.verified("INFO-2026-0766");
  const h = await w.select(["INFO-2026-0766"]);
  const empty = ratificationOps(w.r, url({ ...stamps, handle: h, reason: WHY }), { reason: "  " }).retire();
  assert.deepEqual([empty.ok, empty.reason], [false, "NO_REASON"], "the body's own (empty) reason is the one read");
  const odd = ratificationOps(w.r, url({ ...stamps, handle: "nope", reason: WHY }), { handle: h, reason: 7 }).retire();
  assert.deepEqual([odd.ok, odd.reason, odd.retired], [true, WHY, ["INFO-2026-0766"]], "a non-string reason in the body is not read");
});

test("R15: no place is named in the retirement's answers", async () => {
  const w = setup();
  await w.verified("INFO-2026-0770");
  w.info("INFO-2026-0771");
  const said = [w.retire("nope", { reason: "" }), w.retire("nope", { reason: '"' }), w.retire("nope"),
                w.retire(await w.select(["INFO-2026-0771"])), w.retire(await w.select(["INFO-2026-9998"]))];
  w.cites.set("INFO-2026-0770", { confirmed: ["INQ-2026-0001-a"], severed: [] });
  said.push(w.retire(await w.select(["INFO-2026-0770"])));
  assert.doesNotMatch(JSON.stringify(said), /oakland|alameda|california|berkeley/i);
});

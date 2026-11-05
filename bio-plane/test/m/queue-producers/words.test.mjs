/* R43 (T51; N1231; DEC-329 (10); K3766, K3806): every older producer's sentences are read by key through setup-words and
   never composed here. For each producer a fixture raises its item and the `summary` and `detail` are checked against
   `word(key, vars)` for the keys R43 names with the fills the fixture's facts give; every key is asserted with `hasWord`; an
   optional fact's sentence is absent without the fact and present with it; a count of 1 reads `.one` and 2 `.other`; and no
   item has an unfilled `{placeholder}` or a doubled space. No test holds a sentence's English (K3810): each compares with
   `word`. The fills a provider states as a bare code the word list holds no key for (R43's control) are left empty, named in
   the job's REPORT, and the item is still raised. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, byId, NOW, iso, said, dayWord, atWord, MONITORING, DOCKET } from "./world.mjs";
import { busy, everyKind } from "./every.mjs";
import { hasWord, word } from "../../../src/setup-words/index.mjs";

const DAY = 86400000;
const K = (kind) => `queue.${kind}`;
const find = (r, kind) => r.items.filter((i) => i.kind === kind);

/* The kinds R43 amends (R1, R2, R4–R7, R9, R14, R23, R30–R35, R37–R40); the rest of `facts` and the items of the moved
   producers are other modules' and carry no key here. */
const KEYED = ["bias-debt", "missing_predecessor", "overdue_successor", "cardinality_exceeded", "out-of-inquiry-lead",
  "stance-changed-here-not-elsewhere", "new-version-arrived-from-another-team", "shared-inquiry-concluded-by-another-project",
  "export-performed", "newer-capture-affects-reference", "objective-gap", "source-modified", "source-removed",
  "contradiction-duty", "contradiction-plurality", "contradiction-lead", "contradiction-duty-unseen", "contradiction-plurality-unseen",
  "side-corrected", "tension-after-publication", "signer-self-registered", "attribution-unchosen", "docket-core-due", "edition-withdrawn",
  "edition-contested", "cited-newer-edition", "cited-edition-withdrawn", "followed-case-entry", "cited-docket-entry-refused",
  "cited-docket-unreadable", "wizard-withdrawn", "wizard-restored", "wizard-approval-requested", "edition-scheduled",
  "edition-published-as-scheduled", "scheduled-edition-stopped", "place-profile-arrived", "wizard-base-updated"];

test("R43: every item of a kind R43 amends answers its summary_key and detail_key, both held by the word list, with a filled sentence: no {placeholder}, no doubled space, no space before a stop", () => {
  const r = everyKind().read("alice");
  const kinds = new Set(r.items.map((i) => i.kind));
  const seen = [];
  for (const it of r.items) {
    if (!KEYED.includes(it.kind)) continue;
    seen.push(it.kind);
    for (const [text, key] of [[it.summary, it.summary_key], [it.detail, it.detail_key]]) {
      assert.equal(typeof key, "string", `${it.id} answers its key`);
      assert.ok(hasWord(key), `${it.id}: ${key} is a word of the list`);
      assert.equal(typeof text, "string", it.id);
      assert.ok(text.length > 0, `${it.id}: ${key} says something`);
      assert.doesNotMatch(text, /\{[A-Za-z0-9_]+\}/, `${it.id}: no unfilled placeholder`);
      assert.doesNotMatch(text, /  /, `${it.id}: no doubled space`);
      assert.doesNotMatch(text, / [.,;:]/, `${it.id}: no space before a stop`);
      assert.doesNotMatch(text, /\bundefined\b|\bnull\b|\[object/, `${it.id}: no unfilled fact`);
    }
  }
  /* the world is live: it raises most of the kinds (the proposals' two and the unreadable stages come from their own tests) */
  assert.ok(new Set(seen).size >= 33, `the fixture raises the kinds R43 names (${[...kinds].sort().join(", ")})`);
});

test("R43 (R1): a bias debt answers queue.bias-debt.summary and .detail, which it carried as null before; basis.stated is unchanged", () => {
  const it = byId(busy().read("alice"))["OBLIGATION::bias-debt::r1"];
  assert.equal(it.summary, word(`${K("bias-debt")}.summary`));
  assert.equal(it.detail, word(`${K("bias-debt")}.detail`));
  assert.deepEqual([it.summary_key, it.detail_key], [`${K("bias-debt")}.summary`, `${K("bias-debt")}.detail`]);
  assert.equal(typeof it.basis.stated, "string");
});

test("R43 (R2, R9): out-of-inquiry-lead names the question by its title else its id, and the capture's attribution statement as the capture-requests module states it", () => {
  const w = busy();
  w.bundle("INQ-T", "inquiry", { title: "Was the contract bid?" });
  w.fakes.captureRequests.leads = () => ({ requests: [{ request: "CR-T", run: "r", target: "INQ-A", lead_inquiry: "INQ-T", address: "https://x.example/d",
    host: "x.example", purpose: "investigate", ua_mode: "civicos", capture_sha: null, captured_at: iso(NOW),
    attribution: { ok: true, statement: "the daemon captured this at a request" } }] });
  const it = byId(w.read("alice"))["FINDING::out-of-inquiry-lead::CR-T"];
  assert.equal(it.summary, word(`${K("out-of-inquiry-lead")}.summary`, { question: "Was the contract bid?" }));
  assert.equal(it.detail, word(`${K("out-of-inquiry-lead")}.detail`, { address: "https://x.example/d", target: "INQ-A", question: "Was the contract bid?",
    statement: "the daemon captured this at a request" }));
  assert.ok(!it.detail.includes("INQ-T"), "the title, not the id");
});

test("R43 (R2): export-performed counts its records and files by .one and .other and names its note else says there was none; a rendering reads its own words with its format through queue.fill.format.<code>", () => {
  const w = busy({ corpusExport: { exportLog: () => ({ ok: true, limit: 200, truncated: false, exports: [
    { seq: 1, at: iso(NOW), scope: "working-corpus", bundles: 1, files: 1, note: null },
    { seq: 2, at: iso(NOW - 3 * DAY), scope: "working-corpus", bundles: 2, files: 5, note: "for the audit" },
    { seq: 3, at: iso(NOW - DAY), scope: "rendering", bundles: 0, files: 0, note: null, format: "ocel2" },
    { seq: 4, at: iso(NOW - DAY), scope: "rendering", bundles: 0, files: 0, note: null, format: "novel" }] }) } });
  const m = byId(w.read("alice"));
  const E = K("export-performed"), one = m["FINDING::export-performed::1"], two = m["FINDING::export-performed::2"];
  assert.equal(one.summary, word(`${E}.summary`, { date: dayWord("2026-09-01"), records: word(`${E}.records.one`), files: word(`${E}.files.one`) }));
  assert.equal(two.summary, word(`${E}.summary`, { date: dayWord("2026-08-29"), records: word(`${E}.records.other`, { n: 2 }), files: word(`${E}.files.other`, { n: 5 }) }));
  assert.equal(one.detail, [word(`${E}.detail`), word(`${E}.detail.nonote`)].join(" "));
  assert.equal(two.detail, [word(`${E}.detail`), word(`${E}.detail.note`, { note: "for the audit" })].join(" "));
  const r = m["FINDING::export-performed::3"];
  assert.equal(r.summary, word(`${E}.rendering.summary`, { format: word("queue.fill.format.ocel2"), date: dayWord("2026-08-31") }));
  assert.equal(r.detail, word(`${E}.rendering.detail`, { format: word("queue.fill.format.ocel2") }));
  assert.deepEqual([r.summary_key, r.detail_key], [`${E}.rendering.summary`, `${E}.rendering.detail`]);
  assert.equal(m["FINDING::export-performed::4"].summary, said(`${E}.rendering.summary`, { format: "", date: dayWord("2026-08-31") }), "a format the list lacks: empty, never the code");
});

test("R43 (R2): newer-capture-affects-reference names its target by title and its holder (untitled when it has none), the grade through queue.fill.grade.<letter> and what it affects through queue.fill.affects.<code> in .detail.affects, and reads .detail.unseen when the viewer cannot see the capture", () => {
  const notice = (n, target, over = {}) => ({ notice: n, holder: "INQ-S", target, grade: "C", affects: "affected", raised_at: iso(NOW), state: "open", ...over });
  const w = busy({ reevaluation: { notices: () => ({ ok: true, limit: 1000, truncated: false, notices: [notice("RN-T", "INF-T"), notice("RN-U", null),
      notice("RN-X", "INF-T", { grade: null, affects: null }), notice("RN-Z", "INF-T", { grade: "Z", affects: "novel" })] }),
    docketDependents: () => ({ ok: true, entries: [], truncated: false, cursor: null }),
    citedCaseDependents: () => ({ ok: true, entries: [], truncated: false, cursor: null }) } });
  w.bundle("INF-T", "information", { title: "Water Quality Report" });
  const m = byId(w.read("alice"));
  const N = K("newer-capture-affects-reference"), g = (x) => `${N}.${x}`;
  const t = m["FINDING::newer-capture-affects-reference::RN-T"], u = m["FINDING::newer-capture-affects-reference::RN-U"];
  assert.equal(t.summary, word(g("summary"), { target: "Water Quality Report", holder: "INQ-S" }));
  assert.equal(u.summary, word(g("summary.untitled"), { holder: "INQ-S" }));
  assert.equal(t.detail, [word(g("detail"), { grade: word("queue.fill.grade.c") }), word(g("detail.affects"), { affects: word("queue.fill.affects.affected") })].join(" "));
  const x = m["FINDING::newer-capture-affects-reference::RN-X"];
  assert.equal(x.detail, word(g("detail.unseen")));
  assert.equal(x.detail_key, g("detail.unseen"));
  assert.equal(m["FINDING::newer-capture-affects-reference::RN-Z"].detail, said(g("detail"), { grade: "" }), "a code the list lacks: empty, and no affects sentence");
});

test("R43 (R2): objective-gap reads .summary with what the gap says else .summary.gap, and .detail.stages for missing stages else .detail.grade", () => {
  const w = busy({ intent: { gaps: ({ project }) => ({ ok: true, gaps: project !== "PRJ-A" ? [] : [
    { key: "intent::PRJ-A::p::E1", basis: { project, stages_missing: ["award", "contract"], says: "request the award" } },
    { key: "intent::PRJ-A::p::E2", basis: { project, grade_reached: "C", grade_required: "B" } }] }) } });
  const m = byId(w.read("alice"));
  const a = m["FINDING::objective-gap::intent::PRJ-A::p::E1"], b = m["FINDING::objective-gap::intent::PRJ-A::p::E2"];
  assert.equal(a.summary, word(`${K("objective-gap")}.summary`, { project: "PRJ-A", says: "request the award" }));
  assert.equal(a.detail, word(`${K("objective-gap")}.detail.stages`, { stages: "award, contract" }));
  assert.equal(b.summary, word(`${K("objective-gap")}.summary.gap`, { project: "PRJ-A" }));
  assert.equal(b.detail, word(`${K("objective-gap")}.detail.grade`, { reached: "C", required: "B" }));
  assert.deepEqual([a.detail_key, b.detail_key], [`${K("objective-gap")}.detail.stages`, `${K("objective-gap")}.detail.grade`]);
});

test("R43 (R2, R40): source-modified and source-removed read the document's title, else queue.source.untitled with the local day of its earliest capture's retrieval; with no capture day readable the fill is left empty; the detail is queue.source.detail", () => {
  /* monitoring's real flagged read (its published fixture): one document found modified, one removed */
  const F = MONITORING.seeded, MOD = F.bundles.modified, REM = F.bundles.removed;
  const read = (w) => byId(w.read("alice", "member:alice", { now: F.now }));
  const titled = busy();
  titled.bundle(MOD, "information", { title: "Water Quality Report" }); titled.bundle(REM, "information", { title: "Zoning Memo" });
  const m = read(titled);
  const w = busy();
  w.bundle(MOD, "information", { title: null }); w.bundle(REM, "information", { title: null });
  w.run(`INSERT INTO register (capture_sha, bundle_id, path, encoding, registered, bytes) VALUES ('sha-1',?,'p','utf8',?,1), ('sha-2',?,'p','utf8',?,1)`, MOD, iso(NOW), MOD, iso(NOW));
  w.run(`INSERT INTO captured_locators (address_norm, address, capture_sha, first_retrieved, last_retrieved) VALUES
         ('a','a','sha-1',?,?), ('b','b','sha-2',?,?)`, iso(NOW - 10 * DAY), iso(NOW), iso(NOW - 20 * DAY), iso(NOW));
  const u = read(w);
  const S = (kind, title) => said(`${K(kind)}.summary`, { title });
  assert.equal(m[`FINDING::source-modified::${MOD}`].summary, S("source-modified", "Water Quality Report"));
  assert.equal(m[`FINDING::source-removed::${REM}`].summary, S("source-removed", "Zoning Memo"));
  assert.equal(u[`FINDING::source-modified::${MOD}`].summary,
    S("source-modified", word(`${K("source")}.untitled`, { date: dayWord("2026-08-12") })), "the earliest of its captures' retrievals");
  assert.equal(u[`FINDING::source-removed::${REM}`].summary, S("source-removed", said(`${K("source")}.untitled`, { date: "" })), "none readable: the fill is empty");
  for (const it of [...Object.values(m), ...Object.values(u)].filter((i) => /^source-/.test(i.kind))) {
    assert.equal(it.detail, word(`${K("source")}.detail`));
    assert.deepEqual([it.summary_key, it.detail_key], [`${K(it.kind)}.summary`, `${K("source")}.detail`]);
  }
  assert.equal(u[`FINDING::source-modified::${MOD}`].title, null, "R40: the title stays null");
});

test("R43 (R4–R7): contradiction items read .detail.open, .taken_up and .explained_not_shown by the candidate's state; the unseen notices read their own .detail, not the notice's fixed sentence; side-corrected reads .detail.reason only when the correction states one; tension-after-publication reads .summary.unnumbered with no edition", () => {
  const side = (inquiry) => ({ kind: "claim", inquiry });
  const w = everyKind();
  w.fakes.contradiction.candidatesFor = ({ on }) => ({ ok: true, truncated: false, cursor: null, candidates: on.project !== "PRJ-A" ? [] : [
    { candidate: "CC-O", weight: "duty", state: "open", a: side("INQ-S"), b: side("INQ-A"), between_projects: [] },
    { candidate: "CC-T", weight: "duty", state: "taken_up", a: side("INQ-S"), b: side("INQ-A"), between_projects: [] },
    { candidate: "CC-E", weight: "duty", state: "explained_not_shown", a: side("INQ-S"), b: side("INQ-A"), between_projects: [] },
    { candidate: "CC-P", weight: "plurality", state: "open", a: side("INQ-S"), b: side("INQ-A"), between_projects: [] },
    { candidate: "CC-L", weight: "lead", state: "open", a: side("INQ-S"), b: side("INQ-A"), between_projects: [] }] });
  w.fakes.reevaluation.correctedDependents = () => ({ ok: true, truncated: false, cursor: null, entries: [
    { dependent: "INQ-S", candidate: "CC-O", reason: "named wrong", since: iso(NOW) }, { dependent: "INQ-A", candidate: "CC-T", since: iso(NOW) }] });
  w.fakes.caseTensions.caseTensions = () => ({ ok: true, cursor: null, cases: [
    { case: "CASE-1", edition: 2, project: "PRJ-A", tensions: [{ candidate: "CC-O", member: "INF-1", state: "open", depth: 1 }] },
    { case: "CASE-2", project: "PRJ-A", tensions: [{ candidate: "CC-O", member: "INF-1", state: "open", depth: 1 }] }] });
  const m = byId(w.read("alice"));
  const C = (kind) => K(kind);
  assert.equal(m["OBLIGATION::contradiction::CC-O"].summary, word(`${C("contradiction-duty")}.summary`));
  assert.equal(m["OBLIGATION::contradiction::CC-O"].detail, word(`${C("contradiction-duty")}.detail.open`));
  assert.equal(m["OBLIGATION::contradiction::CC-T"].detail, word(`${C("contradiction-duty")}.detail.taken_up`));
  assert.equal(m["OBLIGATION::contradiction::CC-E"].detail, word(`${C("contradiction-duty")}.detail.explained_not_shown`));
  assert.equal(m["OBLIGATION::contradiction::CC-E"].detail_key, `${C("contradiction-duty")}.detail.explained_not_shown`);
  assert.equal(m["FINDING::contradiction::CC-P"].summary, word(`${C("contradiction-plurality")}.summary`));
  assert.equal(m["FINDING::contradiction::CC-P"].detail, word(`${C("contradiction-plurality")}.detail`));
  assert.equal(m["FINDING::contradiction::CC-L"].summary, word(`${C("contradiction-lead")}.summary`));
  assert.equal(m["FINDING::contradiction::CC-L"].detail, word(`${C("contradiction-lead")}.detail`));
  /* the unseen pair: the keyed sentences replace the notice's `says`, which stays on the basis */
  const du = m["OBLIGATION::contradiction-unseen::CN-D"], pu = m["FINDING::contradiction-unseen::CN-P"];
  assert.deepEqual([du.summary, du.detail], [word(`${C("contradiction-duty-unseen")}.summary`), word(`${C("contradiction-duty-unseen")}.detail`)]);
  assert.deepEqual([pu.summary, pu.detail], [word(`${C("contradiction-plurality-unseen")}.summary`), word(`${C("contradiction-plurality-unseen")}.detail`)]);
  assert.equal(du.basis.says, "a record you cannot see conflicts");
  /* side-corrected: with and without a stated reason */
  assert.equal(m["FINDING::side-corrected::INQ-S::CC-O"].summary, word(`${C("side-corrected")}.summary`, { name: "INQ-S" }));
  assert.equal(m["FINDING::side-corrected::INQ-S::CC-O"].detail, word(`${C("side-corrected")}.detail.reason`, { reason: "named wrong" }));
  assert.equal(m["FINDING::side-corrected::INQ-A::CC-T"].detail, word(`${C("side-corrected")}.detail`), "no stated reason: the base sentence, never one with a blank");
  assert.equal(m["FINDING::side-corrected::INQ-A::CC-T"].detail_key, `${C("side-corrected")}.detail`);
  /* tension-after-publication: numbered else unnumbered */
  assert.equal(m["FINDING::tension-after-publication::CASE-1::CC-O"].summary, word(`${C("tension-after-publication")}.summary`, { case: "CASE-1", edition: 2 }));
  assert.equal(m["FINDING::tension-after-publication::CASE-2::CC-O"].summary, word(`${C("tension-after-publication")}.summary.unnumbered`, { case: "CASE-2" }));
  assert.equal(m["FINDING::tension-after-publication::CASE-2::CC-O"].detail, word(`${C("tension-after-publication")}.detail`));
});

test("R43, R57 (R14 as R56 amends it): signer-self-registered reads .summary or .summary.unnamed by whether a member is named, and .detail; the comment travels on its key's line", () => {
  /* credentials is a fake here: its real rows always name a member, and the unnamed forms are for a row that names none */
  const keys = [{ key_b64: "KEY-1", member_id: "kim", registered_by: "kim", comment: "laptop", status: "active", origin: "self", added: iso(NOW) },
                { key_b64: "KEY-3", member_id: "", registered_by: "not recorded", comment: null, status: "active", origin: "self", added: iso(NOW) }];
  const w = busy({ credentials: { signerList: () => ({ ok: true, signers: keys }) } });
  const m = byId(w.read("alice"));
  const S = (key) => `${K("signer-self-registered")}.${key}`;
  const kim = m["OBLIGATION::signer-self-registered::kim"];
  assert.equal(kim.summary, word(S("summary"), { member: "kim" }));
  assert.equal(kim.summary_key, S("summary"));
  assert.equal(kim.detail, word(S("detail")));
  assert.equal(kim.lines[0].comment, "laptop");
  assert.equal(m["OBLIGATION::signer-self-registered::"].summary, word(S("summary.unnamed")));
});

test("R43 (R23): attribution-unchosen names the case and the observation by its title else its id, and the edition in its detail", () => {
  const w = everyKind();
  const it = byId(w.read("alice"))["OBLIGATION::attribution-unchosen::CASE-1@1::OBS-1"];
  assert.equal(it.summary, word(`${K("attribution-unchosen")}.summary`, { case: "CASE-1", observation: "OBS-1" }));
  assert.equal(it.detail, word(`${K("attribution-unchosen")}.detail`, { edition: 1 }));
});

test("R43 (R30): docket-core-due reads the item's own sentence by its kind and .detail.tail, and .summary.edition only when an edition is stated; a kind the list holds no `what` for is raised with an empty fill", () => {
  /* docket's real response item (its published fixture) beside a kind it does not publish, a kind this module has no `what` for */
  const CD = DOCKET.case, R = DOCKET.due.items[0];
  // fixtures-own: synthetic a kind docket never publishes, the test's own control that a kind this module has no `what` for is raised with an empty fill
  const w = busy({ docket: { coreDue: () => ({ ok: true, count: 2, wrote: false, items: [
    R,
    { case: CD, kind: "novel", ref: "N-1", since: iso(NOW - DAY) }] }) } });
  const m = byId(w.read("alice"));
  const D = (k) => `${K("docket-core-due")}.${k}`, tail = word(D("detail.tail"));
  const a = m[`OBLIGATION::docket-core-due::${CD}::response::${R.ref}`], c = m[`OBLIGATION::docket-core-due::${CD}::novel::N-1`];
  assert.equal(a.summary, word(D("summary.edition"), { case: CD, what: word(D("what.response")), edition: R.edition }));
  assert.equal(a.detail, `${word(D("detail.response"))} ${tail}`);
  assert.equal(c.summary, said(D("summary"), { case: CD, what: "" }), "an unknown kind: the fill left empty, the item still raised");
  assert.equal(c.detail, tail);
});

test("R43 (R31): edition-withdrawn reads .detail with no edition named, .detail.one with one and .detail.other with several; edition-contested reads .detail with no edition named; a case unnamed reads queue.docket-case.unnamed", () => {
  const entries = [
    { dependent: "INQ-S", entry: "E-0", kind: "withdrawal", case: "CASE-W", since: iso(NOW), withdrawn_editions: [], legs: [] },
    { dependent: "INQ-S", entry: "E-1", kind: "withdrawal", case: "CASE-W", since: iso(NOW), withdrawn_editions: [3], legs: [] },
    { dependent: "INQ-S", entry: "E-2", kind: "withdrawal", case: "CASE-W", since: iso(NOW), withdrawn_editions: [1, 2], legs: [] },
    { dependent: "INF-1", entry: "E-3", kind: "contested", case: null, since: iso(NOW), legs: [] }];
  const w = busy({ reevaluation: { notices: () => ({ ok: true, limit: 1000, truncated: false, notices: [] }),
    docketDependents: () => ({ ok: true, truncated: false, cursor: null, entries }),
    citedCaseDependents: () => ({ ok: true, entries: [], truncated: false, cursor: null }) } });
  const m = byId(w.read("alice"));
  const named = word("queue.docket-case.named", { case: "CASE-W" });
  assert.equal(m["FINDING::edition-withdrawn::INQ-S::E-0"].detail, word(`${K("edition-withdrawn")}.detail`, { case: named }));
  assert.equal(m["FINDING::edition-withdrawn::INQ-S::E-1"].detail, word(`${K("edition-withdrawn")}.detail.one`, { case: named, editions: "3" }));
  assert.equal(m["FINDING::edition-withdrawn::INQ-S::E-2"].detail, word(`${K("edition-withdrawn")}.detail.other`, { case: named, editions: "1, 2" }));
  const ct = m["FINDING::edition-contested::INF-1::E-3"];
  assert.equal(ct.summary, word(`${K("edition-contested")}.summary`, { case: word("queue.docket-case.unnamed"), name: "INF-1" }));
  assert.equal(ct.detail, word(`${K("edition-contested")}.detail`, { case: word("queue.docket-case.unnamed") }));
});

test("R43 (R34): cited-newer-edition and cited-edition-withdrawn read the cited editions by .one, .other and .none, the case by queue.cited-case.both|case|group|none, and the unnumbered sentences when the edition is not named", () => {
  const IMP = "d".repeat(64);
  const mv = (seq, kind, over = {}) => ({ dependent: "INQ-S", move: `IMM-${seq}`, import: IMP, group: "g2", case: "CASE-I", kind, edition: 4, seq,
    date: null, since: iso(NOW), key_listed: true, taken_back: null, legs: [{ cited_edition: 1 }, { cited_edition: 3 }], ...over });
  const entries = [mv(1, "edition"), mv(2, "edition", { edition: null, legs: [{ cited_edition: 2 }], group: null }),
    mv(3, "withdrawal", { edition: undefined, legs: [], case: null }), mv(4, "withdrawal", { edition: "all", legs: [{ cited_edition: 5 }] })];
  const w = busy({ reevaluation: { notices: () => ({ ok: true, limit: 1000, truncated: false, notices: [] }),
    docketDependents: () => ({ ok: true, entries: [], truncated: false, cursor: null }), citedCaseDependents: () => ({ ok: true, entries, truncated: false, cursor: null }) } });
  const m = byId(w.read("alice"));
  const at = (seq, kind) => m[`FINDING::${kind}::INQ-S::${IMP}#${seq}`];
  const tail = word("queue.cited-docket.detail.tail");
  const both = word("queue.cited-case.both", { case: "CASE-I", group: "g2" });
  const many = word("queue.cited-editions.other", { list: "1, 3" });
  assert.equal(at(1, "cited-newer-edition").summary, word("queue.cited-newer-edition.summary", { name: "INQ-S", cited: many, whose: both, edition: 4 }));
  assert.equal(at(1, "cited-newer-edition").detail, `${word("queue.cited-newer-edition.detail.numbered", { whose: both, edition: 4, cited: many })} ${tail}`, "no date, no quote: the base and the tail");
  /* an edition not named, one cited edition, the group withheld */
  assert.equal(at(2, "cited-newer-edition").summary, word("queue.cited-newer-edition.summary.unnumbered", { name: "INQ-S",
    cited: word("queue.cited-editions.one", { list: "2" }), whose: word("queue.cited-case.case", { case: "CASE-I" }) }));
  assert.equal(at(2, "cited-newer-edition").detail_key, "queue.cited-newer-edition.detail.unnumbered");
  /* no cited edition read, the case withheld, the edition not named: the unnumbered withdrawal */
  assert.equal(at(3, "cited-edition-withdrawn").summary, word("queue.cited-edition-withdrawn.summary", { name: "INQ-S",
    cited: word("queue.cited-editions.none"), whose: word("queue.cited-case.group", { group: "g2" }) }));
  assert.equal(at(3, "cited-edition-withdrawn").detail_key, "queue.cited-edition-withdrawn.detail.unnumbered");
  assert.equal(at(4, "cited-edition-withdrawn").detail_key, "queue.cited-edition-withdrawn.detail.all");
  assert.equal(word("queue.cited-case.none"), word("queue.cited-case.none"), "the fourth form is held");
  assert.ok(["queue.cited-case.none", "queue.cited-editions.none"].every(hasWord));
});

test("R43 (R35): followed-case-entry reads its summary by kind and edition and each optional sentence only when the fact exists; cited-docket-entry-refused reads .one for one failed check and .other for more, its unnumbered form when no number is readable, and a refused entry whose check is named by no code leaves {checks} empty", () => {
  const IMP = "e".repeat(64);
  const head = (seq, over = {}) => ({ import: IMP, group: "g2", case: "CASE-I", set_by: "alice", seq, seen_at: iso(NOW - DAY), ...over });
  const answer = { entries: [
    { ...head(1), kind: "edition", edition: null, date: null, key_listed: true, move: true, taken_back: null },
    { ...head(2), kind: "withdrawal", edition: 3, date: null, key_listed: true, move: true, taken_back: { seq: null, date: null } },
    { ...head(3), kind: "withdrawal", edition: null, date: null, key_listed: true, move: true, taken_back: { seq: 8, date: null } },
    { ...head(4), kind: "reaction", edition: null, date: "2026-08-20", key_listed: false, move: false, taken_back: { seq: null, date: "2026-08-22" } }],
    refused: [{ ...head(5), failed: "digest" }, { ...head(6), failed: "digest" }, { ...head(6), failed: "signature" },
              { ...head(null), failed: "form" }, { ...head(7), failed: null }],
    unreadable: [{ import: IMP, group: "g2", case: "CASE-I", set_by: "alice", docket: "d", reason: null, at: null }] };
  const w = busy({ caseImport: { watchItems: () => answer } });
  const m = byId(w.read("alice"));
  const F = (k) => `queue.followed-case-entry.${k}`, whose = word("queue.cited-case.both", { case: "CASE-I", group: "g2" });
  const f = (seq) => m[`FINDING::followed-case-entry::${IMP}#${seq}`];
  assert.equal(f(1).summary, word(F("summary.edition.unnumbered"), { whose }));
  assert.equal(f(1).detail, [word(F("detail"), { seq: 1 }), word(F("detail.keyed")), word(F("detail.moves"))].join(" "), "no date: no date sentence");
  assert.equal(f(2).summary, word(F("summary.withdrawal.numbered"), { whose, edition: 3 }));
  assert.ok(f(2).detail.includes(word("queue.docket-entry.taken-back.unnumbered")), "taken back, no number, no date");
  assert.equal(f(3).summary, word(F("summary.withdrawal.unnumbered"), { whose }));
  assert.ok(f(3).detail.includes(word("queue.docket-entry.taken-back", { seq: 8 })));
  assert.equal(f(4).summary, word(F("summary.other"), { whose }));
  assert.equal(f(4).detail, [word(F("detail"), { seq: 4 }), word(F("detail.date"), { date: dayWord("2026-08-20") }), word(F("detail.unkeyed")),
    word("queue.docket-entry.taken-back.unnumbered.dated", { date: dayWord("2026-08-22") }), word(F("detail.nomoves"))].join(" "));
  const R = (k) => `queue.cited-docket-entry-refused.${k}`;
  const rf = (seq) => m[`FINDING::cited-docket-entry-refused::${IMP}#${seq}`];
  assert.equal(rf(5).summary, word(R("summary"), { whose }));
  assert.equal(rf(5).detail, word(R("detail.one"), { seq: 5, checks: word("queue.fill.check.digest") }));
  assert.equal(rf(6).detail, word(R("detail.other"), { seq: 6, checks: `${word("queue.fill.check.digest")}, ${word("queue.fill.check.signature")}` }), "two checks failed: .other");
  assert.equal(rf("unnumbered").detail, word(R("detail.unnumbered.one"), { checks: word("queue.fill.check.form") }));
  assert.equal(rf(7).detail, word(R("detail.one"), { seq: 7, checks: word("queue.fill.check.undetermined") }), "named by no code: the undetermined check");
  assert.deepEqual(rf(7).basis.failed, []);
  const un = m[`CONDITION::cited-docket-unreadable::${IMP}`], U = (k) => `queue.cited-docket-unreadable.${k}`;
  assert.equal(un.summary, word(U("summary"), { whose }));
  assert.equal(un.detail, word(U("detail")), "no reason and no last try: the base sentence alone");
  w.fakes.caseImport.watchItems = () => ({ entries: [], refused: [], unreadable: [{ ...answer.unreadable[0], reason: "http_503", at: iso(NOW - 2 * DAY) }] });
  assert.equal(byId(w.read("alice"))[`CONDITION::cited-docket-unreadable::${IMP}`].detail,
    [word(U("detail")), word(U("detail.reason"), { reason: word("queue.fill.reason.http", { status: "503" }) }), word(U("detail.at"), { date: dayWord("2026-08-30") })].join(" "));
});

test("R43 (R38): place-profile-arrived reads .unnamed with no place named and .detail.covers only when coverage is stated", () => {
  const w = world();
  w.member("ada", { role: "admin" });
  w.p.registerPlaceArrivals(() => ({ ok: true, arrivals: [{ name: "  ", profile: "us-xx-b", profile_name: "B County", covers: [], found_at: iso(NOW) },
    { name: "Riverton", profile: "us-xx-r", profile_name: "City of Riverton", covers: ["Riverton", "Riverton County"], found_at: iso(NOW) }] }));
  const m = byId(w.read("ada"));
  const bare = m["CONDITION::place-profile-arrived::us-xx-b"], named = m["CONDITION::place-profile-arrived::us-xx-r"], P = "queue.place-profile-arrived";
  assert.equal(bare.summary, word(`${P}.summary.unnamed`, { profile: "B County" }));
  assert.equal(bare.detail, word(`${P}.detail.unnamed`, { profile: "B County" }), "no coverage stated: no coverage sentence");
  assert.equal(bare.detail_key, `${P}.detail.unnamed`);
  assert.equal(named.summary, word(`${P}.summary`, { place: "Riverton", profile: "City of Riverton" }));
  assert.equal(named.detail, [word(`${P}.detail`, { place: "Riverton", profile: "City of Riverton" }), word(`${P}.detail.covers`, { covers: "Riverton, Riverton County" })].join(" "));
});

test("R43 (R32, R33, R37, R39): wizard-withdrawn names the first refusal only when one is stated; wizard-approval-requested reads .summary.unnamed with no author; edition-published-as-scheduled reads .detail.nopublished with no instant published; scheduled-edition-stopped reads .detail.noreason and .reason.unrecorded; edition-scheduled reads .detail.moved.other for several moves; wizard-base-updated reads .base.unnamed and .detail", () => {
  const ed = (c, state, over = {}) => ({ case: c, edition: 1, project: "PRJ-A", state, signer: "K", set_by: "alice", signed_at: iso(NOW - DAY),
    at: { date: "2026-09-03", time: "17:05", zone: "UTC" }, publish_at: "2026-09-03T17:05:00Z", moves: [], outcome_at: null, reasons: null, ...over });
  const w = busy({ wizardScripts: {
    brokenScripts: () => ({ ok: true, cursor: null, truncated: false, entries: [{ script: "WIZ-9", version: 1, kind: "withdrawn", at: iso(NOW - 6), name: "File", project: "PRJ-A", author: "alice", refusal: null }] }),
    submittedFor: () => ({ ok: true, cursor: null, truncated: false, entries: [{ script: "WIZ-8", version: 1, owner: "alice", name: "Comment", author: null, submitted_at: iso(NOW - 4), project: "PRJ-A" }] }) } });
  w.fakes.wizardScripts.baseUpdates = () => ({ ok: true, cursor: null, truncated: false, entries: [{ copy: "WIZ-C", name: "Copy", project: "PRJ-A", base: "WIZ-1",
    base_name: null, based_on: null, base_version: "WIZ-1@2", found_at: iso(NOW - 3), recipients: ["alice"] }] });
  w.fakes.publishSchedule.scheduledEditions = () => ({ ok: true, limit: 500, cursor: null, editions: [
    ed("CASE-W", "waiting", { moves: [{ by: "alice" }, { by: "alice" }, { by: "alice" }] }), ed("CASE-P", "published", { outcome_at: null }),
    ed("CASE-S", "stopped", { outcome_at: iso(NOW), reasons: [] }),
    ed("CASE-U", "stopped", { outcome_at: iso(NOW), reasons: [{ code: "X", translation: null }, { code: "Y", translation: "A source changed." }] })] });
  const m = byId(w.read("alice"));
  const wd = m["FINDING::wizard-withdrawn::WIZ-9@1::" + iso(NOW - 6)];
  assert.equal(wd.detail, word("queue.wizard-withdrawn.detail"), "no refusal stated: the base sentence, no reason clause");
  assert.equal(wd.detail_key, "queue.wizard-withdrawn.detail");
  assert.equal(m["OBLIGATION::wizard-approval-requested::WIZ-8@1::alice"].summary, word("queue.wizard-approval-requested.summary.unnamed", { name: "Comment" }));
  const when = atWord("2026-09-03", 17, 5);
  assert.equal(m["CONDITION::edition-scheduled::CASE-W@1"].detail, [word("queue.edition-scheduled.detail", { when }),
    word("queue.edition-scheduled.detail.zone", { zone: "UTC" }), word("queue.edition-scheduled.detail.moved.other", { n: 3 })].join(" "));
  const pub = m["FINDING::edition-published-as-scheduled::CASE-P@1"];
  assert.equal(pub.detail, word("queue.edition-published-as-scheduled.detail.nopublished", { when }));
  assert.equal(pub.detail_key, "queue.edition-published-as-scheduled.detail.nopublished");
  assert.equal(m["FINDING::scheduled-edition-stopped::CASE-S@1"].detail, word("queue.scheduled-edition-stopped.detail.noreason"));
  assert.equal(m["FINDING::scheduled-edition-stopped::CASE-U@1"].detail, word("queue.scheduled-edition-stopped.detail",
    { reasons: `${word("queue.scheduled-edition-stopped.reason.unrecorded")} A source changed.` }));
  const bu = m["FINDING::wizard-base-updated::WIZ-C::WIZ-1@2::alice"];
  assert.equal(bu.summary, word("queue.wizard-base-updated.summary", { base: word("queue.wizard-base-updated.base.unnamed"), version: "WIZ-1@2", name: "Copy" }));
  assert.equal(bu.detail, word("queue.wizard-base-updated.detail", { name: "Copy", base: word("queue.wizard-base-updated.base.unnamed"), version: "WIZ-1@2" }));
});

test("R43 (R37, R36): a set time is read as `time.at` in the group's zone as publish-schedule carries it, the 12-hour clock of `time.clock` (DEC-335) with am and pm by key; a day outside the current local year names its year", () => {
  const at = (date, time) => ({ date, time, zone: "UTC" });
  const ed = (c, a) => ({ case: c, edition: 1, project: "PRJ-A", state: "waiting", signer: "K", set_by: "alice", signed_at: iso(NOW - DAY), at: a,
    publish_at: null, moves: [], outcome_at: null, reasons: null });
  const w = busy();
  w.fakes.publishSchedule.scheduledEditions = () => ({ ok: true, limit: 500, cursor: null, editions: [
    ed("CASE-A", at("2026-09-03", "00:05")), ed("CASE-B", at("2026-09-03", "12:00")), ed("CASE-C", at("2026-09-03", "23:59")),
    ed("CASE-D", at("2027-01-09", "13:30"))] });
  const m = byId(w.read("alice"));
  const sum = (c) => m[`CONDITION::edition-scheduled::${c}@1`].summary;
  assert.equal(sum("CASE-A"), said("queue.edition-scheduled.summary", { when: atWord("2026-09-03", 0, 5), case: "CASE-A", edition: 1 }));
  assert.ok(sum("CASE-A").includes(word("time.am")) && sum("CASE-B").includes(word("time.pm")), "12 AM and noon");
  assert.equal(sum("CASE-C"), said("queue.edition-scheduled.summary", { when: atWord("2026-09-03", 23, 59), case: "CASE-C", edition: 1 }));
  assert.equal(sum("CASE-D"), said("queue.edition-scheduled.summary", { when: atWord("2027-01-09", 13, 30, true), case: "CASE-D", edition: 1 }),
    "outside the current local year: date.daymonthyear");
  assert.doesNotMatch(sum("CASE-A"), /\d{4}-\d{2}-\d{2}|T\d{2}:|\bISO\b/, "never ISO text");
});

test("R43 (R2): the amended proposals' and cardinality items answer their keys, `.one` for one instance and `.other` for two or more", () => {
  const prop = (n, over = {}) => ({ key: "p::s", progression_key: "p", progression_label: "Flow", stage_key: "s", stage_label: "Stage", required: "always",
    definition_version: 1, n, kinds: ["missing_predecessor"], grade: "B", grade_determined: true, overdue: false, overdue_count: 0, surfaced_by: "machine",
    prior_disposition: null, instances: Array.from({ length: n }, (_, i) => ({ progression_key: "p", entity_id: `E${i}`, grade: "B", grade_determined: true, overdue: false })), ...over });
  const run = (n) => {
    const w = world({ progressions: { proposalsFeed: () => ({ instances: [], dispositions: [], proposals: [prop(n)] }) } });
    w.member("alice"); w.bundle("INF-1");
    for (let i = 0; i < n; i += 1) w.run(`INSERT INTO progression_instances VALUES ('p','E${i}','s','c${i}','INF-1')`);
    return byId(w.read("alice"))["FINDING::p::s"];
  };
  assert.equal(run(1).detail, word("queue.missing_predecessor.detail.one", { stage: "Stage" }));
  assert.equal(run(2).detail, word("queue.missing_predecessor.detail.other", { stage: "Stage", n: 2 }));
  assert.deepEqual([run(1).detail_key, run(2).detail_key], ["queue.missing_predecessor.detail.one", "queue.missing_predecessor.detail.other"]);
  assert.equal(run(1).summary, word("queue.missing_predecessor.summary", { progression: "Flow", stage: "Stage" }));
});

test("R43 (R2): stance, new-version and concluded items leave their optional sentences out without the fact: no date, no author, no hidden mark", () => {
  const drawing = (list) => Object.assign(list, { bound: 32, truncated: false });
  const w = world({ basisVersions: {
    projectsDrawingOn: () => drawing([{ id: "PRJ-A", title: "A", current: { version: "v1", at: null, by: null } },
                                      { id: "PRJ-B", title: "B", current: { version: "v2", at: iso(NOW), by: null } },
                                      { id: "PRJ-C", title: "C", current: null }]),
    basisVersions: () => ({ ok: true, truncated: false, versions: [{ name: "v3", state: "suggested", hidden: false, run: "RUN-A", author: null, at: null }] }),
    conclusionOf: (p) => (p === "PRJ-A" ? { version: "v1", claim: "c", by: null, at: null } : null) },
    aiRuns: { runFor: (run) => (run === "RUN-A" ? { run, context_type: "project", context_id: "PRJ-A" } : null) } });
  w.bundle("INQ-S", "inquiry", { title: "the question" }); for (const p of ["PRJ-A", "PRJ-B", "PRJ-C"]) w.bundle(p, "project", { title: p.slice(4) });
  for (const p of ["PRJ-A", "PRJ-B", "PRJ-C"]) w.cite(p, "INQ-S");
  const m = byId(w.read(null, "class:admin"));
  const S = "queue.stance-changed-here-not-elsewhere";
  const a = m[`FINDING::${S.slice(6)}::INQ-S::PRJ-A`], b = m[`FINDING::${S.slice(6)}::INQ-S::PRJ-B`];
  assert.equal(a.summary, word(`${S}.summary.other`, { project: "A", version: "v1" }), "two other projects stand elsewhere: .other");
  assert.equal(a.detail, word(`${S}.detail`, { question: "the question", n: 3, project: "A", version: "v1" }), "no date and no author: the base sentence");
  assert.equal(b.detail, [word(`${S}.detail`, { question: "the question", n: 3, project: "B", version: "v2" }), word(`${S}.detail.at`, { date: dayWord("2026-09-01") })].join(" "));
  const V = "queue.new-version-arrived-from-another-team";
  assert.equal(m["FINDING::new-version-arrived-from-another-team::INQ-S::v3"].detail, [word(`${V}.detail`, { question: "the question", n: 3, project: "A", version: "v3" }),
    word(`${V}.detail.state`, { state: word("queue.fill.state.suggested") })].join(" "));
  const C = "queue.shared-inquiry-concluded-by-another-project";
  assert.equal(m["FINDING::shared-inquiry-concluded-by-another-project::INQ-S::PRJ-A"].detail, word(`${C}.detail`, { question: "the question", n: 3, project: "A", version: "v1" }));
});

test("R43 (control): a source that states a fill no key holds is raised with that fill empty and the item is still raised, with no field added to facts for it", () => {
  const r = everyKind().read("alice");
  assert.deepEqual(Object.keys(r.facts).sort(), ["absent", "action", "contradiction", "dispositions", "failed", "ms", "objective_gap", "unattributed"],
    "R45's two keys and R51's `ms` are the only ones added; none for a fill");
  /* this world's administrator has no update read, which machinery-producers names in its own facts (R45: carried as `partial`) */
  assert.deepEqual(r.facts.failed, [{ feed: "machinery", reason: "partial" }]);
  const exp = byId(r)["FINDING::export-performed::1"];
  assert.doesNotMatch(exp.summary, /working-corpus|\{/);
  assert.ok(exp.summary.length > 0);
});

test("R43, R11: a title the viewer may not see is never written into a sentence: the lead names the run's own question by its id when it is hidden from her, and a newer-capture notice whose pinned document is hidden reads .summary.untitled", () => {
  const w = world({
    captureRequests: { leads: () => ({ requests: [{ request: "CR-H", run: "r", target: "INQ-HIDDEN", lead_inquiry: "INQ-SEEN", address: "https://x.example/d",
      host: "x.example", purpose: "investigate", ua_mode: "civicos", capture_sha: null, captured_at: iso(NOW),
      attribution: { ok: true, statement: "the daemon captured this" } }] }) },
    reevaluation: { notices: () => ({ ok: true, limit: 1000, truncated: false, notices: [
      { notice: "RN-H", holder: "INQ-SEEN", target: "DOC-HIDDEN", grade: "affected", raised_at: iso(NOW), state: "open" }] }) } });
  w.member("alice"); w.member("hank");
  w.bundle("PRJ-H", "project"); w.join("PRJ-H", "hank", { owner: true });
  w.bundle("INQ-SEEN", "inquiry", { title: "Was the contract bid?" });
  w.bundle("INQ-HIDDEN", "inquiry", { title: "The secret title" }); w.bundle("DOC-HIDDEN", "information", { title: "The hidden document" });
  w.run(`UPDATE bundles SET project='PRJ-H' WHERE bundle_id IN ('INQ-HIDDEN','DOC-HIDDEN')`);
  const m = byId(w.read("alice"));
  const lead = m["FINDING::out-of-inquiry-lead::CR-H"], note = m["FINDING::newer-capture-affects-reference::RN-H"];
  assert.ok(lead && note, "both are raised");
  assert.ok(lead.detail.includes("INQ-HIDDEN") && !JSON.stringify(m).includes("The secret title"), "the id, not the hidden title");
  assert.equal(note.summary, word("queue.newer-capture-affects-reference.summary.untitled", { holder: "Was the contract bid?" }));
  assert.ok(!JSON.stringify(m).includes("The hidden document"));
  /* the control: a member of the project reads the titles */
  const hank = byId(w.read("hank"));
  assert.ok(hank["FINDING::out-of-inquiry-lead::CR-H"].detail.includes("The secret title"));
  assert.equal(hank["FINDING::newer-capture-affects-reference::RN-H"].summary,
    word("queue.newer-capture-affects-reference.summary", { target: "The hidden document", holder: "Was the contract bid?" }));
});

test("R43 (R213; WALK-FINAL-10B C7): a newer-capture notice whose holder is a published case names the case by its scope, the newest edition that states one, and never by its CASE- id; a question holder is still named by its title", () => {
  const CASE = "CASE-2026-4006";
  const w = world({
    reevaluation: { notices: () => ({ ok: true, limit: 1000, truncated: false, notices: [
      { notice: "RN-C", holder: CASE, target: "DOC-T", grade: "affected", raised_at: iso(NOW), state: "open" },
      { notice: "RN-Q", holder: "INQ-Q", target: "DOC-T", grade: "affected", raised_at: iso(NOW), state: "open" },
      { notice: "RN-N", holder: "CASE-2026-4007", target: null, grade: "affected", raised_at: iso(NOW), state: "open" }] }) } });
  w.member("alice");
  w.bundle("PRJ-C", "project"); w.join("PRJ-C", "alice", { owner: true });
  w.bundle("DOC-T", "information", { title: "Council notice" });
  w.bundle("INQ-Q", "inquiry", { title: "Did the clerk stamp the contract?" });
  w.run(`INSERT INTO cases (case_id, project_id) VALUES (?, 'PRJ-C'), ('CASE-2026-4007', 'PRJ-C')`, CASE);
  w.run(`INSERT INTO published_cases (case_id, edition, scope) VALUES (?, 1, 'Old scope'), (?, 2, 'Port lease revenue'), (?, 3, NULL)`, CASE, CASE, CASE);
  const m = byId(w.read("alice"));
  const c = m["FINDING::newer-capture-affects-reference::RN-C"], q = m["FINDING::newer-capture-affects-reference::RN-Q"],
    n = m["FINDING::newer-capture-affects-reference::RN-N"];
  assert.ok(c && q && n, "the three notices are raised");
  assert.equal(c.summary, word("queue.newer-capture-affects-reference.summary", { target: "Council notice", holder: "Port lease revenue" }));
  assert.ok(!c.summary.includes("CASE-"), "no case id in the sentence");
  assert.equal(q.summary, word("queue.newer-capture-affects-reference.summary", { target: "Council notice", holder: "Did the clerk stamp the contract?" }));
  assert.ok(q.summary.includes("Did the clerk stamp the contract?"), "a question holder still by its title");
  /* the control: a case that states no scope anywhere keeps its id, the only name it has */
  assert.ok(n.summary.includes("CASE-2026-4007"));
});

test("R43 (R35, R2): the plural forms are read too: an unnumbered refused entry that failed two checks reads .detail.unnumbered.other, and a cardinality group of two instances under an at-most-one bound reads .detail.atmost.other", () => {
  const IMP = "f".repeat(64);
  const h = { import: IMP, group: "g2", case: "CASE-I", set_by: "alice", seq: null, seen_at: iso(NOW - DAY) };
  const w = busy({ caseImport: { watchItems: () => ({ entries: [], unreadable: [], refused: [{ ...h, failed: "form" }, { ...h, failed: "chain" }] }) } });
  const rf = byId(w.read("alice"))[`FINDING::cited-docket-entry-refused::${IMP}#unnumbered`];
  assert.equal(rf.detail, word("queue.cited-docket-entry-refused.detail.unnumbered.other", { checks: `${word("queue.fill.check.form")}, ${word("queue.fill.check.chain")}` }));
  assert.equal(rf.detail_key, "queue.cited-docket-entry-refused.detail.unnumbered.other");
  const card = (e) => ({ progression_key: "p", progression_label: "Flow", definition_version: 1, entity_id: e,
    findings: [{ kind: "cardinality_exceeded", stage_key: "c", stage_label: "Cap", cardinality: "0..1", document_count: 3, grade: "B", grade_determined: true }] });
  const p = world({ progressions: { proposalsFeed: () => ({ proposals: [], dispositions: [], instances: [card("E1"), card("E2")] }) } });
  p.member("alice"); p.bundle("INF-1");
  p.run(`INSERT INTO progression_instances VALUES ('p','E1','c','s1','INF-1'), ('p','E2','c','s2','INF-1')`);
  const it = byId(p.read("alice"))["FINDING::p::c"];
  assert.equal(it.detail, word("queue.cardinality_exceeded.detail.atmost.other", { stage: "Cap", n: 2, documents: 6 }));
  assert.equal(it.detail_key, "queue.cardinality_exceeded.detail.atmost.other");
});

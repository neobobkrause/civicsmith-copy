/* Inquiry's shares of four retired suites, converted to module tests (T18; build/jobs/T17/legacy-tests.md's rows):
   - `test/inquiry.test.mjs`: the entry requirements over inquiry@1 and over legacy PROB/focus documents, each judged by
     the vocabulary it was written under (R2, Terms); a legacy `surfaced` problem treated as an inquiry by this module's
     acts and projection (R1, R20, R21, R12); the title rule over the question (R10). The catalogue's `checkBundle`
     rows, promotion's `bundles.title`, retrieval's type filter and facet, instance-setup's page and the boot normaliser
     legacy-store held were not inquiry's and are not here.
   - `test/rec173-migration-replay.test.mjs`: the migration-replay row a creation admitted as a replay records, and none
     for a surfacing or a revision (R12), read back as the migrated arm of `surfaced_in` (R49). The replay verification
     is control-plane's; the surfacing row is ai-runs'.
   - `test/meaningquery.test.mjs`: legs written by a real promotion are what `leg:` finds (R12's projection, R40's
     read contract), and a revision re-derives them. The compiler, its vocabulary and its gate are query-language's and
     retrieval's.
   - `test/reevaluation.test.mjs`: what this module's acts answer about the re-evaluation obligation through `onRaised`
     (a deferral, a division; R21, R25, R42) and the CITED refusals that stand where the obligation cannot be raised
     (R20, R23), over `restingOn` and `restsOnLive` (R16, R17). The obligation read (`op=reevaluations`), a reopening
     and a new edition are reevaluation's, promotion's and publication's.
   Driven through the real promotion, record-core, connections and (for `leg:`) retrieval, as the fixture builds them. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, inquiryMd, V } from "./fixture.mjs";
import { checkInquiryEntry, deriveInquiryTitle, inquiryQuestionOf, INQUIRY_TABLES } from "../../../src/inquiry/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const A = "INFO-2026-0001-a", B = "INFO-2026-0002-b";

/* The canonical inquiry@1 document in the whole shape the catalogue asks of it (the old suite's), the question its one
   authored field and the title its derived rendering. */
const QUESTION = "Where does the sewer fund transfer basis come from?";
const LONG = "Why does the adopted budget restate the sewer fund transfer basis three different ways across the operating "
  + "summary, the capital appendix and the reconciliation schedule without one of them citing the ordinance?";
const fullInquiryMd = (id, { question = QUESTION, state = "open" } = {}) => ["---",
  `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "${deriveInquiryTitle(question)}"`,
  `current_state: ${state}`, "prior_state: null", 'created: "2026-07-01T00:00:00Z"', 'last_updated: "2026-07-02T00:00:00Z"',
  "produced_by:", "  mode: agent", "  capability_tier: high", "group: test-group", "references: []", "state_history: []",
  "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
  "surfaced_by: agent", 'disposition_reason: ""', "recheck_triggers:", "  - text: Revisit after the next budget cycle",
  "    description: The adopted budget may restate the transfer basis.",
  "---", "", "## Question", "", question, "", word("conformance.rests"), "", "## Conclusion", "", word("conformance.falsify"), "",
  "## Session Log", "", "### Session 2026-07-02T00:00:00Z | Formation | agent", "Trigger: surfacing", "Changes: created.", "",
  "## Review Notes", ""].join("\n");

/* The legacy document exactly as the Drive era wrote it: the focus headings, the focus machine, either legacy spelling. */
const focusMd = (id, { type = "focus", schema = "focus@1", state = "surfaced", refs = [], legs = [] } = {}) => ["---",
  `id: ${id}`, `object_type: ${type}`, `schema: ${schema}`, `title: "Focus ${id}"`, `current_state: ${state}`,
  "prior_state: null", 'created: "2026-07-01T00:00:00Z"', 'last_updated: "2026-07-02T00:00:00Z"',
  "produced_by:", "  mode: agent", "  capability_tier: high", "group: test-group",
  ...(refs.length ? ["references:", ...refs.flatMap((t) => [`  - target: ${t}`, "    rel: cites", "    status: confirmed"])]
                  : ["references: []"]),
  "state_history: []", "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null",
  "visuals: []", "surfaced_by: agent", 'disposition_reason: ""', "recheck_triggers:",
  "  - text: Revisit after the next budget cycle", "    description: The adopted budget may restate the transfer basis.",
  ...(legs.length ? ["basis:", ...legs.flatMap((t) => [`  - target: ${t}`, "    role: supports"])] : []),
  "---", "", "## Statement", "", "The transfer basis is unstated.", "", "## Why It Matters", "",
  "It decides the remediation options.", "", "## Open Questions", "", "## Session Log", "",
  "### Session 2026-07-02T00:00:00Z | Formation | agent", "Trigger: surfacing", "Changes: created.", "", "## Review Notes", ""].join("\n");

const checks = (findings) => findings.map((f) => f.check);

test("R2 the entry requirements judge inquiry@1 and the legacy PROB/focus spellings each by the vocabulary it was written under", async () => {
  const w = world();
  const docs = {
    "INQ-2026-0700-canon": fullInquiryMd("INQ-2026-0700-canon"),
    /* the immutable-id case: a PROB- id whose frontmatter modernised to focus */
    "PROB-2026-0710-modern": focusMd("PROB-2026-0710-modern"),
    /* the untouched history, spelled entirely the old way */
    "PROB-2026-0711-legacy": focusMd("PROB-2026-0711-legacy", { type: "problem", schema: "problem@1" }),
    /* the focus rename's own shape, now itself legacy: the old headings in the old machine's `surfaced` */
    "FOCUS-2026-0712-legacy": focusMd("FOCUS-2026-0712-legacy"),
  };
  for (const [id, md] of Object.entries(docs)) {
    assert.deepEqual(await checkInquiryEntry(md), [], id);
    assert.deepEqual(await w.k.checkEntry(md), [], `${id}, through the instance as promotion's gate judges it`);
  }
  /* negative controls: each vocabulary still bites */
  const focusOpen = await checkInquiryEntry(focusMd("FOCUS-2026-0712-legacy", { state: "open" }));
  assert.deepEqual(checks(focusOpen), ["C-4.1"], "`open` is the inquiry machine's word, not focus's");
  assert.match(focusOpen[0].message, /current_state 'open' is not legal for focus \(legal: surfaced, elevated, deferred, dismissed\)/);
  const robot = await w.k.checkEntry(focusMd("PROB-2026-0711-legacy", { type: "problem", schema: "problem@1" })
    .replace("surfaced_by: agent", "surfaced_by: robot"));
  assert.deepEqual(checks(robot), ["C-2.8"]); assert.match(robot[0].message, /surfaced_by 'robot' is not one of: agent, human/);
  /* inquiry@1's headings under the focus spelling are judged by focus's heading set, not passed as an inquiry's */
  const crossed = await checkInquiryEntry(fullInquiryMd("FOCUS-2026-0713-crossed").replace("object_type: inquiry", "object_type: focus")
    .replace("schema: inquiry@1", "schema: focus@1"));
  assert.ok(crossed.some((f) => f.check === "C-3.1" && /required heading '## Statement' is missing/.test(f.message)), JSON.stringify(crossed));
  assert.ok(crossed.some((f) => f.check === "C-3.1" && /heading '## Question' is not in the canonical set for focus/.test(f.message)));
  assert.ok(crossed.some((f) => f.check === "C-4.1"));
  /* and the canonical document with a legacy heading set is refused as an inquiry */
  const inqWithFocusHeadings = await checkInquiryEntry(focusMd("INQ-2026-0714-heads", { state: "open" })
    .replace("object_type: focus", "object_type: inquiry").replace("schema: focus@1", "schema: inquiry@1"));
  assert.ok(inqWithFocusHeadings.some((f) => f.check === "C-3.1" && /## Question/.test(f.message)), JSON.stringify(inqWithFocusHeadings));
});

test("R1 R20 R21 R2 dispose moves inquiry@1 and a legacy surfaced problem alike: surfaced is open's alias, and each stays conformant after", async () => {
  const w = world(); w.listen();
  const CANON = "INQ-2026-0700-canon", LEGACY = "PROB-2026-0720-proj";
  assert.equal(w.promote(CANON, fullInquiryMd(CANON)).ok, true);
  assert.equal(w.promote(LEGACY, focusMd(LEGACY, { type: "problem", schema: "problem@1" })).ok, true);
  /* the canonical question disposes like the construct it is (open -> dismissed), and is still conformant dismissed */
  w.select("c", [CANON]);
  const d = w.k.dispose({ handle: "c", to: "dismissed", reason: "out of scope", viewer: "admin", owner: "o", author: V("alice") });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300)); assert.deepEqual(d.disposed, [CANON]);
  assert.deepEqual([w.fm(CANON).prior_state, w.fm(CANON).current_state], ["open", "dismissed"]);
  assert.deepEqual(await w.k.checkEntry(w.text(CANON)), [], "dismissed, it still meets its entry requirements");
  /* the legacy document: an inquiry to this act (not NOT_INQUIRIES), moved through the one machine, surfaced -> deferred */
  w.select("l", [LEGACY]);
  const r = w.k.dispose({ handle: "l", to: "deferred", reason: "next cycle", viewer: "admin", owner: "o", author: V("alice") });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300)); assert.deepEqual(r.disposed, [LEGACY]);
  const fm = w.fm(LEGACY);
  assert.deepEqual([fm.object_type, fm.prior_state, fm.current_state, fm.disposition_reason], ["problem", "surfaced", "deferred", "next cycle"],
    "the document keeps the spelling it was written under");
  assert.deepEqual([fm.state_history.at(-1).from_state, fm.state_history.at(-1).to_state], ["surfaced", "deferred"]);
  assert.deepEqual(await w.k.checkEntry(w.text(LEGACY)), [], "and it is judged conformant under its own vocabulary afterwards");
  assert.deepEqual(w.raisedCalls.map((c) => [c.target, c.cause]), [[LEGACY, "deferred"]], "the deferral raises for it as for any inquiry");
  /* negative controls: deferred -> deferred is not an edge; a document that is not an inquiry is still refused */
  w.select("l-again", [LEGACY]);   /* the first selection moved with the act (retrieval R20) */
  const again = w.k.dispose({ handle: "l-again", to: "deferred", reason: "later", viewer: "admin", owner: "o", author: V("alice") });
  assert.equal(again.reason, "ILLEGAL_TRANSITION"); assert.deepEqual(again.offenders.map((o) => o.id), [LEGACY]);
  w.doc(A); w.select("x", [A]);
  const ni = w.k.dispose({ handle: "x", to: "deferred", reason: "later", viewer: "admin", owner: "o", author: V("alice") });
  assert.equal(ni.reason, "NOT_INQUIRIES"); assert.deepEqual(ni.offenders, [A]);
});

test("R12 a legacy focus document's basis is projected as an inquiry's: its legs are read back and rested on", () => {
  const w = world(); w.doc(A);
  const F = "FOCUS-2026-0713-legs";
  assert.equal(w.promote(F, focusMd(F, { refs: [A], legs: [A] })).ok, true);
  const b = w.k.basisFor(F);
  assert.equal(b.ok, true);
  assert.deepEqual(b.legs.map((l) => [l.ord, l.target_id, l.target_type, l.role]), [[0, A, "information", "supports"]]);
  assert.deepEqual(w.k.restingOn(A).dependents.map((d) => [d.bundle_id, d.ord, d.status]), [[F, 0, "confirmed"]]);
  /* negative control: the projection is re-derived from the legacy document's bytes, so a revision with no basis holds none */
  const noBasis = w.text(F).replace("basis:\n  - target: INFO-2026-0001-a\n    role: supports\n", "");
  assert.notEqual(noBasis, w.text(F));
  assert.equal(w.promote(F, noBasis).ok, true);
  assert.deepEqual(w.k.basisFor(F).legs, []);
  assert.deepEqual(w.k.restingOn(A).dependents, []);
});

test("R10 the title is derived from the question's first non-empty line, cut at a word under 120 characters with a visible ellipsis", () => {
  const w = world();
  const Q1 = "INQ-2026-0701-derived", Q2 = "INQ-2026-0702-long", P = "PROB-2026-0703-title";
  assert.equal(w.promote(Q1, fullInquiryMd(Q1)).ok, true);
  assert.equal(w.promote(Q2, fullInquiryMd(Q2, { question: LONG })).ok, true);
  /* the question is read from the promoted document's `## Question`, and the title is its rendering */
  assert.equal(inquiryQuestionOf(w.text(Q1)).trim(), QUESTION);
  assert.equal(deriveInquiryTitle(inquiryQuestionOf(w.text(Q1))), QUESTION, "the question itself when it fits");
  const lt = deriveInquiryTitle(inquiryQuestionOf(w.text(Q2)));
  assert.equal(lt, "Why does the adopted budget restate the sewer fund transfer basis three different ways across the operating summary,…");
  assert.ok(lt.endsWith("…")); assert.ok(lt.length <= 121);
  assert.equal(deriveInquiryTitle("Short question?\nA much longer elaboration that should never become the title."), "Short question?",
    "only the first line titles the record");
  assert.equal(deriveInquiryTitle("  A   question\nwith noise  "), "A question", "whitespace folded");
  assert.equal(deriveInquiryTitle("x".repeat(200) + " tail"), "x".repeat(120) + "…", "no word boundary: cut at 120");
  assert.equal(deriveInquiryTitle("\n  \n"), null); assert.equal(deriveInquiryTitle(null), null);
  /* a legacy document has no `## Question`: '' and so no derived title, never one invented from nothing */
  assert.equal(w.promote(P, focusMd(P, { type: "problem", schema: "problem@1" })).ok, true);
  assert.equal(inquiryQuestionOf(w.text(P)), "");
  assert.equal(deriveInquiryTitle(inquiryQuestionOf(w.text(P))), null);
  assert.equal(inquiryQuestionOf(null), "");
});

test("R12 R49 a creation admitted as a migration replay records its capture and promotion key; a surfacing, a revision or a document records none", async () => {
  const w = world({ realRetrieval: true }); w.doc(A);
  const M = "PROB-2026-9173-drive-question", CAP = "c".repeat(64);
  assert.ok(INQUIRY_TABLES.includes("inquiry_migration_replays"));
  const before = w.count("inquiry_migration_replays");
  assert.equal(before, 0);
  const x = w.promote(M, inquiryMd(M), null, { replay: true, migrationReplay: { capture: CAP, promotion: "20260707T010000Z_rec17300" } });
  assert.equal(x.ok, true, JSON.stringify(x).slice(0, 300));
  assert.deepEqual({ ...x.migration_replay, at: typeof x.migration_replay.at },
    { capture: CAP, promotion: "20260707T010000Z_rec17300", at: "string" }, "the answer names the capture and the Drive promotion");
  assert.equal(Object.hasOwn(x, "surfaced_in"), false, "and carries no run");
  assert.equal(w.count("inquiry_migration_replays"), 1, "one migration-replay row");
  const m = w.k.migratedSurfacing(M);
  assert.deepEqual([m.recorded, m.stated, m.run, m.lens, m.migrated.capture, m.migrated.promotion, m.migrated.at],
    [false, word("inquiry.stated.recorded_migrated_drive"), null, null, CAP, "20260707T010000Z_rec17300", x.migration_replay.at]);
  const p = await w.retrieval.projection({ bundleId: M, viewer: "admin" });
  assert.deepEqual([p.surfaced_in.recorded, p.surfaced_in.stated, p.surfaced_in.run, p.surfaced_in.lens, p.surfaced_in.migrated.capture],
    [false, word("inquiry.stated.recorded_migrated_drive"), null, null, CAP], "the read says it in words and names the capture");
  /* a replay whose promotion key is absent still records the capture, the key null */
  const K = "PROB-2026-9173-no-key";
  assert.equal(w.promote(K, inquiryMd(K), null, { replay: true, migrationReplay: { capture: "d".repeat(64) } }).migration_replay.promotion, null);
  assert.equal(w.k.migratedSurfacing(K).migrated.promotion, null);
  /* negative controls: none of these writes a row */
  const S = "INQ-2026-9173-surfaced";
  const s = w.promote(S, inquiryMd(S), null, { assistantPrincipal: "class:ai", migrationReplay: { capture: CAP, promotion: "P" } });
  assert.equal(s.ok, true, JSON.stringify(s).slice(0, 300));
  assert.equal(Object.hasOwn(s, "migration_replay"), false, "a creation that is a surfacing is never a replay");
  assert.equal(w.k.migratedSurfacing(S), null);
  const rev = w.promote(M, inquiryMd(M, { question: "Did it happen twice?" }), undefined, { migrationReplay: { capture: "e".repeat(64), promotion: "P2" } });
  assert.equal(rev.ok, true); assert.equal(Object.hasOwn(rev, "migration_replay"), false, "a revision records none");
  assert.equal(w.k.migratedSurfacing(M).migrated.capture, CAP, "and the creation's row is not overwritten");
  const D = "INFO-2026-9173-doc";
  w.doc(D);
  const plain = "INQ-2026-9173-plain";
  const pr = w.promote(plain, inquiryMd(plain));
  assert.equal(pr.ok, true); assert.equal(Object.hasOwn(pr, "migration_replay"), false, "no stamp, no row");
  for (const bad of [{ capture: "" }, { capture: 7 }, "a string"]) {
    const id = `INQ-2026-9174-bad${typeof bad === "string" ? "s" : typeof bad.capture}${bad.capture === "" ? "e" : ""}`;
    const r = w.promote(id, inquiryMd(id), null, { migrationReplay: bad });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200));
    assert.equal(Object.hasOwn(r, "migration_replay"), false, JSON.stringify(bad));
    assert.equal(w.k.migratedSurfacing(id), null);
  }
  assert.equal(w.k.migratedSurfacing(D), null);
  assert.equal(w.count("inquiry_migration_replays"), 2, "only the two replays hold a row");
});

test("R12 R40 legs written by a real promotion are what `leg:` finds, as a partition of the inquiries; a revision re-derives them", () => {
  const w = world({ realRetrieval: true }); w.doc(A); w.doc(B);
  const HUNCH_1 = "INQ-2026-0900-transfer", HUNCH_2 = "INQ-2026-0900-vendor";
  const CLEAN_1 = "INQ-2026-0900-earned", CLEAN_2 = "INQ-2026-0900-testimony", LEGLESS = "INQ-2026-0900-legless";
  const FIXTURE = [
    { id: HUNCH_1, legs: [{ target: A, grade: "B", grade_axis: "connection", grade_source: "hunch", author: "member:casey", date: "2026-08-03" },
                          { target: B }] },
    { id: HUNCH_2, legs: [{ target: A, role: "cuts_against", grade: "C", grade_axis: "connection", grade_source: "hunch",
                            author: "member:dana", date: "2026-08-04" }] },
    { id: CLEAN_1, legs: [{ target: A, ground: "charter" }, { target: B, ground: "code" }],
      grounds: [{ ground: "charter", asserted_by: "member:carol", at: "2026-08-01T00:00:00Z" },
                { ground: "code", asserted_by: "member:carol", at: "2026-08-01T00:00:00Z" }] },
    { id: CLEAN_2, legs: [{ target: B, role: "cuts_against", grade: "D", grade_axis: "connection", grade_source: "testimony" }] },
    { id: LEGLESS, legs: [] },
  ];
  for (const f of FIXTURE) w.inquiry(f.id, { legs: f.legs, grounds: f.grounds ?? null });
  const ids = (q) => w.retrieval.search({ q, viewer: "admin", mode: "ids", facets: false }).ids.slice().sort();
  /* ground truth from the fixture definitions, never from the compiler */
  const withLeg = (pred) => FIXTURE.filter((f) => f.legs.some((l) => pred({ role: "supports", ...l }))).map((f) => f.id).sort();
  const ALL = FIXTURE.map((f) => f.id).sort();
  const hunch = withLeg((l) => l.grade_source === "hunch");
  assert.deepEqual(hunch, [HUNCH_1, HUNCH_2].sort());
  assert.deepEqual(ids("leg:hunch"), hunch);
  const rest = ids("type:inquiry -leg:hunch");
  assert.deepEqual(rest, ALL.filter((id) => !hunch.includes(id)));
  assert.deepEqual([...ids("leg:hunch"), ...rest].sort(), ALL, "the partition: hunch debt plus the rest is every inquiry, none twice");
  assert.deepEqual(ids("leg:cuts_against"), withLeg((l) => l.role === "cuts_against"));
  assert.deepEqual(ids("leg:source=testimony"), [CLEAN_2]);
  assert.deepEqual(ids("leg:ground=*"), [CLEAN_1]);
  assert.deepEqual(ids("has:leg"), ALL.filter((id) => id !== LEGLESS), "every inquiry resting on anything, and the legless one is not among them");
  assert.deepEqual(ids("leg:grade=B"), [HUNCH_1]);
  assert.deepEqual(ids("leg:grade=D"), [CLEAN_2]);
  assert.deepEqual(ids("leg:axis=connection"), withLeg((l) => l.grade_axis === "connection"));
  assert.deepEqual(ids(`leg:target=${B}`), withLeg((l) => l.target === B));
  assert.deepEqual(ids("leg:hunch state:open"), hunch);
  assert.deepEqual(ids("leg:hunch state:concluded"), [], "a filter that excludes it");
  assert.deepEqual(ids("(leg:hunch OR leg:source=testimony) -leg:cuts_against"), [HUNCH_1]);
  /* a revision re-derives the legs in the same promotion: HUNCH_1 drops its hunch, LEGLESS gains one */
  assert.equal(w.promote(HUNCH_1, inquiryMd(HUNCH_1, { legs: [{ target: B }] })).ok, true);
  assert.equal(w.promote(LEGLESS, inquiryMd(LEGLESS, { legs: [{ target: B, grade: "C", grade_axis: "connection", grade_source: "hunch",
                                                                    author: "member:erin", date: "2026-08-05" }] })).ok, true);
  assert.deepEqual(ids("leg:hunch"), [HUNCH_2, LEGLESS].sort());
  assert.deepEqual(ids("leg:grade=B"), [], "the old leg's grade is gone with it");
  assert.deepEqual(ids("has:leg"), ALL);
  /* negative control: a leg the promotion refuses is never projected (a hunch naming no author, R4) */
  const X = "INQ-2026-0900-refused";
  const bad = w.promote(X, inquiryMd(X, { legs: [{ target: A, grade: "C", grade_axis: "connection", grade_source: "hunch" }] }));
  assert.equal(bad.ok, false); assert.equal(bad.reason, "BASIS_REFUSED");
  assert.deepEqual(ids("leg:hunch"), [HUNCH_2, LEGLESS].sort());
  assert.equal(w.row(`SELECT COUNT(*) AS n FROM inquiry_basis WHERE bundle_id=?`, X).n, 0);
});

/* A listener in reevaluation's shape: the dependents it raises are the legs resting on the target, read from this
   module's `restingOn` (R16), as reevaluation reads them. */
function listenLikeReevaluation(w) {
  const calls = [];
  const r = w.k.onRaised("reevaluation", ({ target, cause, since }) => {
    calls.push({ target, cause, since });
    return w.k.restingOn(target).dependents.map((d) => ({ bundle_id: d.bundle_id, ord: d.ord, status: d.status }));
  });
  assert.equal(r.ok, true);
  return calls;
}

const MOVED = "INQ-2026-1700-moved", CASE = "INQ-2026-1700-case";
const BLOCKED = "INQ-2026-1700-blocked", WORKING = "INQ-2026-1700-working";
const KID_A = "INQ-2026-1700-authority", KID_B = "INQ-2026-1700-signature";
const X = "INFO-2026-1700-transfer-memo";
function obligationWorld() {
  const caseMembers = new Set([CASE]);
  const w = world({ caseMembers }); w.doc(A); w.doc(X);
  w.inquiry(MOVED, { legs: [{ target: X }] });
  /* the published case rests on two documents and, at ord 2, on the question that moves */
  w.inquiry(CASE, { legs: [{ target: A }, { target: X }, { target: MOVED }] });
  w.inquiry(BLOCKED, { legs: [{ target: X }] });
  w.inquiry(WORKING, { legs: [{ target: X }, { target: BLOCKED }] });
  const calls = listenLikeReevaluation(w);
  return { w, calls, caseMembers };
}
const disp = (w, ids, to, reason) => { w.select(`h-${ids.join()}-${to}`, ids);
  return w.k.dispose({ handle: `h-${ids.join()}-${to}`, to, reason, viewer: "admin", owner: "o", author: V("pilar") }); };

test("R20 R21 R42 dismissing a question a published case rests on is refused CITED, naming the leg; deferring it raises the obligation on that leg", () => {
  const { w, calls } = obligationWorld();
  const sha = w.record.head(MOVED).bundleSha;
  const dis = disp(w, [MOVED], "dismissed", "we are not pursuing this");
  assert.deepEqual([dis.ok, dis.reason], [false, "CITED"]);
  assert.deepEqual(dis.offenders.map((o) => [o.id, o.citedBy.map((c) => [c.bundle_id, c.ord])]), [[MOVED, [[CASE, 2]]]],
    "the offender named down to the leg's ordinal");
  assert.match(dis.detail, /sever the citation with a reason/); assert.match(dis.detail, /DEFER instead/);
  assert.equal(w.record.head(MOVED).bundleSha, sha, "nothing moved"); assert.equal(w.fm(MOVED).current_state, "open");
  assert.deepEqual(calls, [], "a refused act raises nothing");
  /* the reversible act raises it instead */
  w.clock.now = "2026-09-28T02:00:00Z";
  const def = disp(w, [MOVED], "deferred", "waiting on the records request");
  assert.equal(def.ok, true); assert.equal(w.fm(MOVED).current_state, "deferred");
  assert.deepEqual(calls.map((c) => [c.target, c.cause]), [[MOVED, "deferred"]]);
  assert.equal(def.reevaluation.source, "deferred"); assert.equal(def.reevaluation.since, calls[0].since);
  assert.equal(typeof def.reevaluation.since, "string"); assert.ok(def.reevaluation.since.length > 0);
  assert.deepEqual(def.reevaluation.raised, [{ bundle_id: CASE, ord: 2, status: "confirmed", target: MOVED }],
    "the act names what it put a second look on, each dependent with the member that raised it");
  assert.equal(Object.hasOwn(def, "reevaluation_absent"), false);
  /* the case's leg is not moved for anybody */
  assert.deepEqual(w.fm(CASE).basis.map((l) => l.target), [A, X, MOVED]);
});

test("R23 R20 a working dependent blocks division and dismissal alike, by name; deferring it raises the obligation on the working dependent", () => {
  const { w, calls } = obligationWorld();
  const div = w.k.divide({ target: BLOCKED, reason: "This was two questions and mixing them held both down.", viewer: "admin", author: V("rosa"),
    children: [{ id: KID_A, question: "Who held the delegation?", legs: [0] }, { id: KID_B, question: "Who signed the memo itself?", legs: [0] }] });
  assert.deepEqual([div.ok, div.reason], [false, "CITED"]);
  assert.deepEqual(div.offenders.map((o) => [o.bundle_id, o.ord, o.state]), [[WORKING, 1, "open"]], "the leg's ordinal and its state");
  assert.match(div.detail, /sever the citation with a reason/);
  assert.deepEqual([w.record.head(KID_A), w.record.head(KID_B), w.fm(BLOCKED).current_state], [null, null, "open"], "nothing was written");
  const dis = disp(w, [BLOCKED], "dismissed", "not our fight");
  assert.deepEqual([dis.ok, dis.reason, dis.offenders[0].citedBy.map((c) => c.bundle_id)], [false, "CITED", [WORKING]], "by the same predicate");
  assert.deepEqual(calls, []);
  const def = disp(w, [BLOCKED], "deferred", "waiting on the delegation file");
  assert.equal(def.ok, true);
  assert.deepEqual(def.reevaluation.raised.map((x) => x.bundle_id), [WORKING]);
  assert.deepEqual(calls.map((c) => [c.target, c.cause]), [[BLOCKED, "deferred"]]);
});

test("R23 R25 R42 a question whose only dependent is a published case divides, and the division raises the obligation on that case, cause supersession", () => {
  const { w, calls } = obligationWorld();
  assert.deepEqual(w.k.restsOnLive(MOVED).frozen.map((l) => [l.bundle_id, l.ord]), [[CASE, 2]]);
  assert.deepEqual(w.k.restsOnLive(MOVED).confirmed, [], "a published dependent is frozen, not working");
  w.clock.now = "2026-09-28T03:00:00Z";
  const div = w.k.divide({ target: MOVED, reason: "This was two questions: whether it was authorised, and who signed it.",
    viewer: "admin", author: V("rosa"),
    children: [{ id: KID_A, question: "Was the FY2024 transfer authorised by anyone?", legs: [0] },
               { id: KID_B, question: "Did anyone with delegated authority sign it?", legs: [0] }] });
  assert.equal(div.ok, true, JSON.stringify(div).slice(0, 400));
  assert.equal(w.fm(MOVED).current_state, "divided");
  assert.deepEqual(calls.map((c) => [c.target, c.cause, c.since]), [[MOVED, "supersession", div.at]]);
  assert.deepEqual(div.reevaluation, { source: "supersession", since: div.at, raised: [{ bundle_id: CASE, ord: 2, status: "confirmed" }] });
  assert.deepEqual(w.k.supersededBy(MOVED), [KID_A, KID_B], "both children, from the index");
  assert.deepEqual(w.fm(CASE).basis.map((l) => l.target), [A, X, MOVED], "the case's own leg still names the parent, re-pointed for nobody");
  /* negative control: with no module registered, the division answers without the field and says so */
  const w2 = world(); w2.doc(X);
  w2.inquiry(MOVED, { legs: [{ target: X }] });
  const d2 = w2.k.divide({ target: MOVED, reason: "two", viewer: "admin", author: V("rosa"),
    children: [{ id: KID_A, question: "A?", legs: [0] }, { id: KID_B, question: "B?", legs: [0] }] });
  assert.equal(d2.ok, true); assert.equal(d2.reevaluation, undefined); assert.match(d2.reevaluation_absent, /no module/);
});

test("R42 a severed dependent still receives the obligation, marked severed; only the exact recorded withdrawal narrows", () => {
  const w = world(); w.doc(X);
  const T = "INQ-2026-1700-target", DEP = "INQ-2026-1700-depends", SEV = "INQ-2026-1700-severed", ODD = "INQ-2026-1700-oddcase";
  w.inquiry(T, { legs: [{ target: X }] });
  w.inquiry(DEP, { legs: [{ target: T }] });
  w.inquiry(SEV, { legs: [{ target: T }], refs: [{ target: T, rel: "cites", status: "severed" }] });
  w.inquiry(ODD, { legs: [{ target: T }], refs: [{ target: T, rel: "cites", status: "Severed" }] });
  const calls = listenLikeReevaluation(w);
  const def = disp(w, [T], "deferred", "later");
  assert.equal(def.ok, true);
  assert.deepEqual(calls.map((c) => c.target), [T]);
  assert.deepEqual(def.reevaluation.raised.map((x) => [x.bundle_id, x.ord, x.status]),
    [[DEP, 0, "confirmed"], [ODD, 0, "confirmed"], [SEV, 0, "severed"]],
    "severance discharges support, never connection: the severed leg is named, not filtered out; `Severed` is not the recorded word");
});

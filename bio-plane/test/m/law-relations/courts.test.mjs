/* law-relations: court links and treatment rows as data, whether a decision still stands, and the citation resolver
   (R4, R5, R6, R8, R20; COURTS C1, L4; D134, K1449). Moved from standards' law.test.mjs and reads.test.mjs (its R25–R27,
   R44), driven over the test's host. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, MACHINE, REASON, codeOf } from "./fixture.mjs";
import { COURT_LINKS, TREATMENTS, LINK_TARGET_KINDS, CONNECTION_KINDS, LAW_RELATIONS_CHECKS } from "../../../src/law-relations/index.mjs";

const rowOf = (r, code) => assert.deepEqual([r.check, r.translation], [LAW_RELATIONS_CHECKS[code].check,
                                                                       LAW_RELATIONS_CHECKS[code].translation], code);

test("R5 R8 R20 courtLink records interprets, applies, holds_invalid or requires from an extent of a court standard's text to a portion of a held statute, regulation, ordinance or policy, by a member; refusals in order MACHINE_CANNOT_RELATE, STANDARD_FIELD_UNKNOWN, LAW_RELATION_UNKNOWN naming the link types, NO_SUCH_STANDARD, NOT_A_COURT_STANDARD for a from of another kind, COURT_LINK_TARGET_NOT_LAW, PORTION_UNKNOWN, LAW_RELATION_NO_CITATION, STANDARD_NO_REASON, each writing nothing; a machine's suggestion is a proposal", () => {
  assert.deepEqual(COURT_LINKS, ["interprets", "applies", "holds_invalid", "requires"]);
  assert.deepEqual(LINK_TARGET_KINDS, ["statute", "regulation", "ordinance", "policy"]);
  assert.deepEqual(CONNECTION_KINDS.filter((k) => k.kind.startsWith("court_")).map((k) => [k.kind, k.word]),
                   [["court_interprets", "interprets"], ["court_applies", "applies"], ["court_holds_invalid", "holds invalid"], ["court_requires", "requires"]]);
  const w = seeded();
  const court = w.standard({ kind: "court" });
  const targets = Object.fromEntries(["statute", "regulation", "ordinance", "policy"].map((kind) => [kind, w.standard({ kind, portion: "12(a)" }).id]));
  const commitment = w.standard({ kind: "commitment" }).id, other = w.standard({ kind: "court" }).id;
  const good = { type: "interprets", from: court.id, to: { standard: targets.statute, portion: "12(a)" }, citation: court.t, reason: REASON,
                 author: V("bob"), viewer: V("bob") };
  for (const type of COURT_LINKS) for (const [kind, id] of Object.entries(targets)) {
    const r = w.law.courtLink({ ...good, type, to: { standard: id, portion: "12(a)" } });
    assert.equal(r.ok, true, `${type} → ${kind}: ${JSON.stringify(r).slice(0, 300)}`);
    assert.match(r.link.id, /^clink-[0-9a-f]{24}$/);
    assert.deepEqual([r.link.type, r.link.from, r.link.to, r.link.citation, r.link.by, r.link.withdrawn],
                     [type, { standard: court.id }, { standard: id, portion: "12(a)" }, court.t, V("bob"), null]);
  }
  assert.equal(w.law.courtLink({ ...good, to: targets.policy, type: "requires" }).ok, true, "a whole policy");
  const before = w.snapshot();
  const call = { ...good, author: MACHINE, x: 1, type: "overrules", from: "STD-2026-9999-x", to: commitment, citation: "", reason: "" };
  for (const [fix, code] of [[() => (call.author = V("bob")), "MACHINE_CANNOT_RELATE"], [() => delete call.x, "STANDARD_FIELD_UNKNOWN"],
                             [() => (call.type = "interprets"), "LAW_RELATION_UNKNOWN"], [() => (call.from = targets.statute), "NO_SUCH_STANDARD"],
                             [() => (call.from = court.id), "NOT_A_COURT_STANDARD"], [() => (call.to = { standard: targets.policy, portion: "9" }), "COURT_LINK_TARGET_NOT_LAW"],
                             [() => (call.to = good.to), "PORTION_UNKNOWN"], [() => (call.citation = court.t), "LAW_RELATION_NO_CITATION"],
                             [() => (call.reason = REASON), "STANDARD_NO_REASON"]]) {
    const r = w.law.courtLink(call);
    assert.equal(codeOf(r), code, `${code}: ${JSON.stringify(r).slice(0, 200)}`);
    if (LAW_RELATIONS_CHECKS[code]) rowOf(r, code); else assert.equal(r.host, true);
    if (code === "LAW_RELATION_UNKNOWN") assert.deepEqual(r.types, [...COURT_LINKS]);
    if (code === "NOT_A_COURT_STANDARD") assert.deepEqual([r.end, r.kind], ["from", "statute"]);
    if (code === "COURT_LINK_TARGET_NOT_LAW") assert.deepEqual([r.standard, r.kind], [commitment, "commitment"]);
    fix();
  }
  assert.deepEqual(w.snapshot(), before, "each refusal writes nothing");
  assert.equal(codeOf(w.law.courtLink({ ...good, to: other })), "COURT_LINK_TARGET_NOT_LAW", "a court is not a link's target");
  assert.equal(codeOf(w.law.courtLink({ ...good, citation: w.standards.get(targets.statute).texts[0] })), "LAW_RELATION_NO_CITATION", "the target's words are not the court's");
  assert.equal(w.law.courtLink(call).ok, true);
  /* a proposal, adopted by a member's act */
  const p = w.law.lawPropose({ what: "link", type: "requires", from: court.id, to: targets.policy, citation: court.t, why: "Paragraph 41 requires the policy.", proposer: MACHINE });
  const n = w.count("court_links");
  assert.equal(w.count("court_links"), n, "a proposal records no link");
  const adopted = w.law.courtLink({ proposal: p.proposal.id, reason: REASON, author: V("carol"), viewer: V("carol") });
  assert.deepEqual([adopted.ok, adopted.link.type, adopted.link.proposal, adopted.adopted.proposal], [true, "requires", p.proposal.id, p.proposal.id]);
  assert.equal(codeOf(w.law.courtLink({ proposal: p.proposal.id, reason: REASON, author: V("carol") })), "STANDARD_PROPOSAL_ADOPTED");
});

test("R6 R20 courtTreat records reversed, vacated, depublished, overruled or affirmed, citing the later decision's extent; refusals in order MACHINE_CANNOT_RELATE, STANDARD_FIELD_UNKNOWN, TREATMENT_UNKNOWN before reading its ends, NO_SUCH_STANDARD, NOT_A_COURT_STANDARD for either decision naming which, LAW_RELATION_SELF, LAW_RELATION_NO_CITATION, STANDARD_NO_REASON, each writing nothing", () => {
  assert.deepEqual(TREATMENTS, ["reversed", "vacated", "depublished", "overruled", "affirmed"]);
  const w = seeded();
  const lower = w.standard({ kind: "court", from: "2010-05-01", to: null }), later = w.standard({ kind: "court", from: "2012-01-01", to: null });
  const statute = w.standard();
  const good = { decision: lower.id, treatment: "affirmed", by_decision: later.id, citation: later.t, reason: REASON, author: V("bob"), viewer: V("bob") };
  for (const treatment of TREATMENTS) {
    const r = w.law.courtTreat({ ...good, treatment });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    assert.match(r.treatment.id, /^ctreat-[0-9a-f]{24}$/);
    assert.deepEqual([r.treatment.decision, r.treatment.treatment, r.treatment.by_decision, r.treatment.citation, r.treatment.by],
                     [lower.id, treatment, later.id, later.t, V("bob")]);
  }
  const before = w.snapshot();
  assert.equal(codeOf(w.law.courtTreat({ ...good, treatment: "criticised", decision: "STD-2026-9999-x", by_decision: "nope" })), "TREATMENT_UNKNOWN",
               "the treatment is asked before either end is read");
  const call = { ...good, author: "", merit: "bad", treatment: "criticised", decision: "STD-2026-9999-x", by_decision: statute.id, citation: lower.t, reason: " " };
  for (const [fix, code] of [[() => (call.author = V("bob")), "MACHINE_CANNOT_RELATE"], [() => delete call.merit, "STANDARD_FIELD_UNKNOWN"],
                             [() => (call.treatment = "reversed"), "TREATMENT_UNKNOWN"], [() => (call.decision = statute.id), "NO_SUCH_STANDARD"],
                             [() => (call.decision = lower.id), "NOT_A_COURT_STANDARD"], [() => (call.by_decision = lower.id), "NOT_A_COURT_STANDARD"],
                             [() => (call.by_decision = later.id), "LAW_RELATION_SELF"], [() => (call.citation = later.t), "LAW_RELATION_NO_CITATION"],
                             [() => (call.reason = REASON), "STANDARD_NO_REASON"]]) {
    const r = w.law.courtTreat(call);
    assert.equal(codeOf(r), code, `${code}: ${JSON.stringify(r).slice(0, 200)}`);
    if (LAW_RELATIONS_CHECKS[code]) rowOf(r, code); else assert.equal(r.host, true);
    if (code === "NOT_A_COURT_STANDARD") assert.equal(r.end, call.decision === statute.id ? "decision" : "by_decision", "names which");
    if (code === "TREATMENT_UNKNOWN") assert.deepEqual(r.treatments, [...TREATMENTS]);
    fix();
  }
  assert.deepEqual(w.snapshot(), before, "each refusal writes nothing");
  assert.equal(w.law.courtTreat(call).ok, true);
});

test("R6 R20 stillStanding answers not_standing on a held reversed, vacated, depublished or overruled treatment effective (the later decision's stated period start) on or before the date, standing on an affirmance so effective, and undetermined where the later history is not read or an ending treatment's date is not stated, saying so, never a default of standing; withdrawn treatments and ones whose passage the viewer may not read are not read; its refusals STANDARD_NO_ID, STANDARD_DATE_INVALID, NO_SUCH_STANDARD (the host's) and NOT_A_COURT_STANDARD; it writes nothing", () => {
  const w = seeded();
  const d = (from) => w.standard({ kind: "court", from, to: null });
  const lower = d("2010-05-01"), appeal = d("2012-03-01"), undated = d(null), affirm = d("2011-01-01");
  const ask = (decision, date, viewer = V("carol")) => w.law.stillStanding({ decision, date, viewer });
  const none = ask(lower.id, "2020-01-01");
  assert.deepEqual([none.ok, none.state, none.by, none.treatments], [true, "undetermined", [], []], "no later history held");
  assert.match(none.why, /later history is not read/);
  const good = { decision: lower.id, treatment: "affirmed", by_decision: affirm.id, citation: affirm.t, reason: REASON, author: V("bob") };
  const aff = w.law.courtTreat(good).treatment.id;
  assert.deepEqual(["2010-12-31", "2011-01-01", "2011-06-01"].map((date) => ask(lower.id, date).state), ["undetermined", "standing", "standing"]);
  for (const t of ["reversed", "vacated", "depublished", "overruled"]) {
    const x = seeded();
    const lo = x.standard({ kind: "court", from: "2010-05-01", to: null }), hi = x.standard({ kind: "court", from: "2012-03-01", to: null });
    x.law.courtTreat({ decision: lo.id, treatment: t, by_decision: hi.id, citation: hi.t, reason: REASON, author: V("bob") });
    assert.deepEqual(["2012-02-29", "2012-03-01"].map((date) => x.law.stillStanding({ decision: lo.id, date, viewer: V("carol") }).state),
                     ["undetermined", "not_standing"], t);
  }
  const rev = w.law.courtTreat({ ...good, treatment: "reversed", by_decision: appeal.id, citation: appeal.t }).treatment.id;
  const before = w.snapshot();
  const s = ask(lower.id, "2013-01-01");
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  assert.deepEqual([s.state, s.by, s.treatments.length, s.treatments.find((t) => t.id === rev).effective], ["not_standing", [rev], 2, "2012-03-01"]);
  assert.match(s.why, new RegExp(`${appeal.id} reversed it, effective 2012-03-01`));
  assert.equal(ask(lower.id, "2012-02-29").state, "standing", "before the reversal took effect");
  /* an ending treatment whose later decision states no date: undetermined, never standing */
  const v = w.law.courtTreat({ ...good, decision: affirm.id, treatment: "vacated", by_decision: undated.id, citation: undated.t }).treatment.id;
  const u = ask(affirm.id, "2030-01-01");
  assert.deepEqual([u.state, u.by], ["undetermined", [v]]);
  assert.match(u.why, /does not state when/);
  /* a treatment whose passage the viewer may not read is not read */
  const P = w.project("alice");
  const hidden = w.passage({ project: P });
  const sealed = w.standard({ kind: "court", from: "2015-01-01", to: null, texts: [hidden] });
  const plain = d("2014-01-01");
  w.law.courtTreat({ decision: plain.id, treatment: "overruled", by_decision: sealed.id, citation: hidden, reason: REASON, author: V("alice") });
  assert.equal(ask(plain.id, "2020-01-01").state, "undetermined", "carol does not read it");
  assert.equal(ask(plain.id, "2020-01-01", V("alice")).state, "not_standing");
  /* withdrawn: it no longer bears */
  w.law.lawWithdraw({ relation: aff, reason: "a different case", author: V("bob") });
  assert.equal(ask(lower.id, "2011-06-01").state, "undetermined");
  /* refusals */
  for (const [args, code] of [[{ decision: "", date: "2020-01-01" }, "STANDARD_NO_ID"], [{ decision: lower.id, date: "x" }, "STANDARD_DATE_INVALID"],
                              [{ decision: lower.id, date: "2021-02-30" }, "STANDARD_DATE_INVALID"], [{ decision: lower.id, date: null }, "STANDARD_DATE_INVALID"],
                              [{ decision: "STD-2026-9999-x", date: "2020-01-01" }, "NO_SUCH_STANDARD"],
                              [{ decision: lower.id, date: "2020-01-01", viewer: "nobody" }, "NO_SUCH_STANDARD"],
                              [{ decision: w.standard().id, date: "2020-01-01" }, "NOT_A_COURT_STANDARD"]]) {
    const r = w.law.stillStanding({ viewer: V("carol"), ...args });
    assert.equal(codeOf(r), code, code);
    if (code === "STANDARD_NO_ID") assert.equal(r.op, "stillstanding");
  }
});

test("R4 R20 resolveCourtCitation answers verified only when a held capture the viewer may see states the citation (a court standard's text stating volume, reporter and page), naming the capture and extent; otherwise not verified, refusing nothing; with lookup and the keyed service on it adds the service's matches labelled as the service's and never verified, switched off it says so; it reads at most 2,000 court standards, saying so past it; it writes nothing", async () => {
  const w = seeded({ lookup: (a) => (w.on ? { ok: true, service: "courtlistener", label: "the service's answer",
                                              citations: [{ citation: a.text, matches: [{ case_name: "A v. B" }], verified: false }] }
                                           : { ok: false, reason: "KEYED_SERVICE_OFF" }) });
  const opinion = w.passage({ words: "The court so held. Reported at 5 Cal. 4th 100." });
  const std = w.standard({ kind: "court", texts: [opinion] }).id;
  const P = w.project("alice");
  w.standard({ kind: "court", texts: [w.passage({ words: "See 410 U.S. 113.", project: P })] });
  w.standard({ kind: "statute", texts: [w.passage({ words: "Compare 9 Cal. 4th 9." })] });
  w.standard({ kind: "court", texts: [w.passage()] });
  const before = w.snapshot();
  const v = await w.law.resolveCourtCitation({ citation: "5 Cal. 4th 100", viewer: V("carol") });
  const row = w.content.contentRow(opinion);
  assert.deepEqual([v.ok, v.state, v.verified, v.citation, v.held.map((h) => [h.standard, h.content_id, h.capture_sha, h.bundle_id, h.extent.kind])],
                   [true, "verified", true, { volume: 5, reporter: "Cal.", page: 100 }, [[std, opinion, row.capture_sha, row.bundle_id, "pdf-page"]]]);
  assert.ok(Number.isInteger(v.held[0].at.start) && v.held[0].at.end > v.held[0].at.start, "the extent of the citation in the passage");
  assert.equal(v.lookup, null, "no lookup asked");
  assert.equal((await w.law.resolveCourtCitation({ citation: { volume: 5, reporter: "Cal.", page: 100 }, viewer: V("carol") })).state, "verified",
               "a citation as id-spaces reads it");
  const no = await w.law.resolveCourtCitation({ citation: "6 Cal. 4th 100", viewer: V("carol") });
  assert.deepEqual([no.ok, no.state, no.verified, no.held], [true, "not verified", false, []], "refusing nothing");
  assert.equal((await w.law.resolveCourtCitation({ citation: "410 U.S. 113", viewer: V("carol") })).state, "not verified", "a capture the viewer may not see");
  assert.equal((await w.law.resolveCourtCitation({ citation: "410 U.S. 113", viewer: V("alice") })).state, "verified");
  assert.equal((await w.law.resolveCourtCitation({ citation: "9 Cal. 4th 9", viewer: V("carol") })).state, "not verified", "a statute's text is not a court's capture");
  for (const citation of ["no citation here", "", null, 7, {}])
    assert.deepEqual((await w.law.resolveCourtCitation({ citation, viewer: V("carol") })).state, "not verified", JSON.stringify(citation));
  assert.match((await w.law.resolveCourtCitation({ citation: "no citation here", viewer: V("carol") })).why, /no court citation/);
  /* the keyed lookup */
  w.on = false;
  const off = await w.law.resolveCourtCitation({ citation: "6 Cal. 4th 100", viewer: V("carol"), lookup: true });
  assert.deepEqual([off.state, off.lookup.on, off.lookup.reason], ["not verified", false, "KEYED_SERVICE_OFF"]);
  assert.match(off.lookup.says, /stands without it/);
  w.on = true;
  const on = await w.law.resolveCourtCitation({ citation: "6 Cal. 4th 100", viewer: V("carol"), lookup: true });
  assert.deepEqual([on.state, on.verified, on.lookup.on, on.lookup.verified, on.lookup.service, on.lookup.citations[0].matches[0].case_name],
                   ["not verified", false, true, false, "courtlistener", "A v. B"], "the service's matches never verify");
  const onv = await w.law.resolveCourtCitation({ citation: "5 Cal. 4th 100", viewer: V("carol"), lookup: true });
  assert.deepEqual([onv.state, onv.lookup.verified], ["verified", false], "verified by the capture, never by the service");
  assert.deepEqual(w.calls.lookup.at(-1), { text: "5 Cal. 4th 100", viewer: V("carol") }, "asked with the member viewer (K1551)");
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  /* the cap: 2,000 court standards read, and said so past it */
  const x = seeded();
  for (let i = 0; i < 2000; i++) x.standards.set(`STD-2026-${String(i).padStart(5, "0")}-court`, { id: `STD-2026-${String(i).padStart(5, "0")}-court`, kind: "court", texts: [] });
  const at = await x.law.resolveCourtCitation({ citation: "5 Cal. 4th 100", viewer: V("carol") });
  assert.doesNotMatch(at.why, /only the first/);
  x.standards.set("STD-2026-99999-court", { id: "STD-2026-99999-court", kind: "court", texts: [] });
  const past = await x.law.resolveCourtCitation({ citation: "5 Cal. 4th 100", viewer: V("carol") });
  assert.match(past.why, /only the first 2000 court standards were read/);
});

test("R4 a lookup that throws is answered as a lookup that did not answer, and the resolver's own answer stands", async () => {
  const w = seeded({ lookup: () => { throw new Error("down"); } });
  const r = await w.law.resolveCourtCitation({ citation: "6 Cal. 4th 100", viewer: V("carol"), lookup: true });
  assert.deepEqual([r.ok, r.state, r.lookup.on, r.lookup.reason], [true, "not verified", false, "LOOKUP_FAILED"]);
  const none = await w.law.resolveCourtCitation({ citation: null, viewer: V("carol"), lookup: true });
  assert.deepEqual([none.lookup.on, none.lookup.reason], [false, "NO_TEXT"]);
});

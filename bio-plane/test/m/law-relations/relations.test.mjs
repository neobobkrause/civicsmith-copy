/* law-relations: law relations recorded by members, the read over them, proposals and withdrawals (R1, R2, R9, R11,
   R14, R20; D192, K1443). Moved from standards' law.test.mjs and t34.test.mjs (its R22, R23, R30, R40's sentence),
   driven over the test's host. */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, MACHINE, REASON, codeOf } from "./fixture.mjs";
import { LAW_RELATIONS, LAW_RELATIONS_CHECKS, EDITION_MAX } from "../../../src/law-relations/index.mjs";
import { proposalLabel } from "../../../src/record-grammar/labels.mjs";

/* Two statutes with a portion each. */
function two(w, extra = {}) {
  const a = w.standard({ portion: "10(a)", key: "/eli/x/1/10", ...extra });
  const b = w.standard({ portion: "20(b)", key: "/eli/x/1/20", ...extra });
  return { a: a.id, b: b.id, at: a.t, bt: b.t };
}
const rowOf = (r, code) => assert.deepEqual([r.check, r.translation], [LAW_RELATIONS_CHECKS[code].check,
                                                                       LAW_RELATIONS_CHECKS[code].translation], code);

test("R1 R9 the relation types are two closed sets, temporal and referential (incorporates among the referential), exported frozen, kept apart and never mixed in one list or read", () => {
  assert.deepEqual(LAW_RELATIONS, { temporal: ["amends", "repeals", "renumbers", "recodifies"],
                                    referential: ["refers_to", "defines", "excepts", "implements", "incorporates"] });
  assert.ok(Object.isFrozen(LAW_RELATIONS) && Object.isFrozen(LAW_RELATIONS.temporal) && Object.isFrozen(LAW_RELATIONS.referential));
  assert.deepEqual(LAW_RELATIONS.temporal.filter((t) => LAW_RELATIONS.referential.includes(t)), []);
  const w = seeded();
  const { a, b, at } = two(w);
  for (const type of [...LAW_RELATIONS.temporal, ...LAW_RELATIONS.referential]) {
    const r = w.law.lawRelate({ type, from: a, to: b, citation: at, ...(LAW_RELATIONS.temporal.includes(type) ? { effective: "2021-01-01" } : {}),
                                ...(type === "incorporates" ? { edition: "2020 edition" } : {}), reason: REASON, author: V("bob"), viewer: V("bob") });
    assert.equal(r.ok, true, `${type}: ${JSON.stringify(r).slice(0, 200)}`);
  }
  const read = w.law.lawRelationsOf({ standard: b, viewer: V("carol") });
  assert.deepEqual(Object.keys(read).sort(), ["ok", "referential", "says", "standard", "temporal", "truncated"]);
  assert.deepEqual(read.temporal.map((r) => r.type).sort(), [...LAW_RELATIONS.temporal].sort());
  assert.deepEqual(read.referential.map((r) => r.type).sort(), [...LAW_RELATIONS.referential].sort());
  assert.ok(read.temporal.every((r) => r.class === "temporal" && r.effective) && read.referential.every((r) => r.class === "referential" && r.effective === null));
  assert.match(read.says, /kept apart/);
});

test("R9 an incorporates relation carries the edition incorporated (at most 50 characters), recorded by lawRelate like the others and read back with it; none, a blank one or one over 50 characters is refused LAW_RELATION_NO_EDITION (this module's row) after LAW_RELATION_NO_CITATION, as is an edition on any other relation; CONNECTION_KINDS holds law_incorporates, word incorporates", async () => {
  const { CONNECTION_KINDS } = await import("../../../src/law-relations/index.mjs");
  assert.deepEqual(CONNECTION_KINDS.find((k) => k.kind === "law_incorporates"), { kind: "law_incorporates", word: "incorporates", class: "evidentiary" });
  assert.equal(EDITION_MAX, 50);
  const w = seeded();
  const { a, b, at, bt } = two(w);
  const good = { type: "incorporates", from: a, to: b, citation: at, edition: "2020 edition", reason: REASON, author: V("bob"), viewer: V("bob") };
  const before = w.snapshot();
  for (const edition of [undefined, null, "", "  ", "x".repeat(51), "😀".repeat(51), 2020, ["2020"]]) {
    const r = w.law.lawRelate({ ...good, edition });
    assert.equal(codeOf(r), "LAW_RELATION_NO_EDITION", JSON.stringify(edition));
    rowOf(r, "LAW_RELATION_NO_EDITION");
  }
  assert.equal(codeOf(w.law.lawRelate({ ...good, edition: undefined, citation: bt })), "LAW_RELATION_NO_CITATION", "after the citation");
  for (const type of ["refers_to", "amends"])
    assert.equal(codeOf(w.law.lawRelate({ ...good, type, effective: "2021-01-01" })), "LAW_RELATION_NO_EDITION", `${type} carries none`);
  assert.equal(codeOf(w.law.lawRelate({ ...good, edition: "2020", reason: "" })), "STANDARD_NO_REASON", "the edition before the reason");
  assert.deepEqual(w.snapshot(), before, "each refusal writes nothing");
  for (const edition of ["2020 edition", "x".repeat(50), "😀".repeat(50), "  NFPA 1710 (2020)  "]) {
    const r = w.law.lawRelate({ ...good, edition });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 200));
    assert.equal(r.relation.edition, edition.trim());
    const back = w.law.lawRelationsOf({ standard: b, viewer: V("carol") }).referential.find((x) => x.id === r.relation.id);
    assert.equal(back.edition, edition.trim(), "read back with it");
  }
  const other = w.law.lawRelate({ ...good, type: "refers_to", edition: undefined });
  assert.equal(other.ok, true);
  assert.equal("edition" in other.relation, false, "only an incorporation answers an edition");
  /* a proposal carries it, and the member's act takes it */
  const p = w.law.lawPropose({ what: "relation", type: "incorporates", from: a, to: b, citation: at, edition: "2018 edition",
                               why: "Section 3 adopts the code by reference.", proposer: MACHINE });
  const adopted = w.law.lawRelate({ proposal: p.proposal.id, reason: REASON, author: V("carol"), viewer: V("carol") });
  assert.deepEqual([adopted.ok, adopted.relation.edition, adopted.adopted.from_proposal.includes("edition")], [true, "2018 edition", true]);
});

test("R2 R20 lawRelate records one relation by a member's act, refusing in order MACHINE_CANNOT_RELATE, STANDARD_FIELD_UNKNOWN (the host's), LAW_RELATION_UNKNOWN, NO_SUCH_STANDARD (the host's) naming the end, PORTION_UNKNOWN (the host's), LAW_RELATION_SELF, LAW_RELATION_NO_CITATION (a passage of the from standard's text the viewer may read), LAW_RELATION_NO_EFFECTIVE (temporal), STANDARD_NO_REASON (the host's); each this module's through its row and the host's as the host gives it, with nothing written", () => {
  const w = seeded();
  const { a, b, at, bt } = two(w);
  const good = { type: "amends", from: { standard: a, portion: "10(a)" }, to: { standard: b, portion: "20(b)" }, citation: at,
                 effective: "2021-01-01", reason: REASON, author: V("bob"), viewer: V("bob") };
  const bad = { type: "supersedes", from: { standard: "STD-2026-9999-x", portion: "9" }, to: { standard: a, portion: "9" },
                citation: bt, effective: "soon", reason: " ", author: MACHINE, viewer: V("bob"), merit: "good" };
  const order = [["author", "MACHINE_CANNOT_RELATE"], ["merit", "STANDARD_FIELD_UNKNOWN"], ["type", "LAW_RELATION_UNKNOWN"],
                 ["from", "NO_SUCH_STANDARD"], ["to", "PORTION_UNKNOWN"], ["*to", "LAW_RELATION_SELF"], ["citation", "LAW_RELATION_NO_CITATION"],
                 ["effective", "LAW_RELATION_NO_EFFECTIVE"], ["reason", "STANDARD_NO_REASON"]];
  const before = w.snapshot();
  const call = { ...bad };
  for (const [field, code] of order) {
    if (field === "*to") call.to = { standard: a, portion: "10(a)" };
    const r = w.law.lawRelate(call);
    assert.equal(codeOf(r), code, `${field}: expected ${code}, got ${JSON.stringify(r).slice(0, 200)}`);
    if (LAW_RELATIONS_CHECKS[code]) rowOf(r, code); else assert.equal(r.host, true, `${code} is the host's`);
    if (field === "from") assert.equal(r.end, "from", "names the end");
    if (field === "merit") delete call.merit;
    else if (field === "*to") call.to = good.to;
    else call[field] = good[field];
  }
  assert.deepEqual(w.snapshot(), before, "a refused relation writes nothing");
  const ok = w.law.lawRelate(call);
  assert.equal(ok.ok, true, JSON.stringify(ok).slice(0, 300));
  assert.match(ok.relation.id, /^lrel-[0-9a-f]{24}$/);
  assert.deepEqual([ok.relation.class, ok.relation.by, ok.relation.effective, ok.relation.from, ok.relation.to, ok.relation.withdrawn, ok.relation.citation],
                   ["temporal", V("bob"), { date: "2021-01-01" }, { standard: a, portion: "10(a)" }, { standard: b, portion: "20(b)" }, null, at]);
  assert.equal(LAW_RELATIONS_CHECKS.LAW_RELATION_UNKNOWN.check, "C-112.24");
  /* each condition's edges */
  for (const author of ["", null, undefined, "class:daemon", "token:x"]) assert.equal(codeOf(w.law.lawRelate({ ...good, author })), "MACHINE_CANNOT_RELATE");
  assert.deepEqual(w.law.lawRelate({ ...good, type: "x" }).types, [...LAW_RELATIONS.temporal, ...LAW_RELATIONS.referential]);
  assert.equal(w.law.lawRelate({ ...good, to: "STD-2026-9999-x" }).end, "to");
  assert.equal(codeOf(w.law.lawRelate({ ...good, viewer: "nobody" })), "NO_SUCH_STANDARD", "a viewer naming no member reads none");
  assert.equal(codeOf(w.law.lawRelate({ ...good, from: a, to: b })), "ok", "ends as bare ids");
  assert.equal(codeOf(w.law.lawRelate({ ...good, from: a, to: a })), "LAW_RELATION_SELF", "both whole standards");
  assert.equal(codeOf(w.law.lawRelate({ ...good, from: { standard: a, portion: "10(a)" }, to: a })), "ok", "a portion and its whole are two ends");
  assert.equal(codeOf(w.law.lawRelate({ ...good, citation: bt })), "LAW_RELATION_NO_CITATION", "the to standard's passage is not the amending words");
  assert.equal(codeOf(w.law.lawRelate({ ...good, citation: "" })), "LAW_RELATION_NO_CITATION");
  for (const effective of [undefined, "2021-02-30", { event: "EVT-2026-x", edge: "start" }, { event: "EVT-2026-abcdefghijklmnop", edge: "mid" },
                           { date: "2021-01-01", event: "EVT-2026-abcdefghijklmnop", edge: "start" }])
    assert.equal(codeOf(w.law.lawRelate({ ...good, effective })), "LAW_RELATION_NO_EFFECTIVE", JSON.stringify(effective));
  const byEvent = w.law.lawRelate({ ...good, effective: { event: "EVT-2026-abcdefghijklmnop", edge: "start" } });
  assert.deepEqual(byEvent.relation.effective, { event: "EVT-2026-abcdefghijklmnop", edge: "start" }, "an event is checked for form only");
  assert.deepEqual(w.law.lawRelate({ ...good, effective: { date: "2022-03-04" } }).relation.effective, { date: "2022-03-04" });
  assert.equal(w.law.lawRelate({ ...good, type: "refers_to", effective: undefined }).ok, true, "a referential relation needs no effective date");
  for (const reason of ["", "  ", null, 7, "x".repeat(2001)]) assert.equal(codeOf(w.law.lawRelate({ ...good, reason })), "STANDARD_NO_REASON");
  assert.equal(w.law.lawRelate({ ...good, reason: "x".repeat(2000) }).ok, true);
  /* a passage of a document the viewer may not see is not a citation for that viewer (one answer) */
  const P = w.project("alice");
  const hidden = w.passage({ project: P });
  const c = w.standard({ texts: [hidden] }).id;
  assert.equal(codeOf(w.law.lawRelate({ ...good, from: c, to: b, citation: hidden })), "LAW_RELATION_NO_CITATION");
  assert.equal(w.law.lawRelate({ ...good, from: c, to: b, citation: hidden, author: V("alice"), viewer: V("alice") }).ok, true);
});

test("R2 R14 R20 a machine's suggestion is a proposal labelled through record-grammar's proposalLabel(proposer, \"law_relation\"), never the standard subject, stored apart and moving no answer until a member records the row naming it; the act takes each field the member does not state from it and answers which; a proposal is adopted at most once; lawPropose's refusals", () => {
  const w = seeded();
  const { a, b, at } = two(w);
  const court = w.standard({ kind: "court" });
  const asks = [
    { what: "relation", type: "repeals", from: a, to: b, citation: at, effective: "2021-01-01" },
    { what: "link", type: "applies", from: court.id, to: a, citation: court.t },
    { what: "treatment", decision: court.id, treatment: "affirmed" },
  ];
  for (const proposer of [MACHINE, V("bob")]) {
    const want = proposalLabel(proposer, "law_relation");
    assert.notEqual(want.says, proposalLabel(proposer, "standard").says, "the two subjects say different things");
    for (const ask of asks) {
      const p = w.law.lawPropose({ ...ask, why: "Read in the minutes.", proposer });
      assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
      assert.match(p.proposal.id, /^lprop-[0-9a-f]{24}$/);
      assert.deepEqual([p.proposal.by, p.proposal.state, p.proposal.machine_work, p.proposal.label, p.recorded, p.proposal.what],
                       [want.by, want.state, want.machine_work, want.says, false, ask.what], `${ask.what} by ${proposer}`);
    }
  }
  assert.equal(w.count("law_relations") + w.count("court_links") + w.count("court_treatments"), 0, "a proposal records nothing");
  assert.equal(w.law.lawRelationsOf({ standard: b, viewer: V("carol") }).temporal.length, 0, "and moves no answer");
  assert.deepEqual(w.law.boundsOn(b), [], "nor the bound");
  /* the member's act naming it */
  const p = w.law.lawPropose({ ...asks[0], why: "Its section 4 repeals the older bylaw.", proposer: MACHINE });
  assert.equal(codeOf(w.law.lawRelate({ proposal: p.proposal.id, author: MACHINE })), "MACHINE_CANNOT_RELATE");
  const adopted = w.law.lawRelate({ proposal: p.proposal.id, effective: "2021-06-01", reason: REASON, author: V("bob"), viewer: V("bob") });
  assert.equal(adopted.ok, true, JSON.stringify(adopted).slice(0, 300));
  assert.deepEqual([adopted.relation.proposal, adopted.relation.effective, adopted.adopted.from_proposal.sort()],
                   [p.proposal.id, { date: "2021-06-01" }, ["citation", "from", "to", "type"]], "the member's own field stands");
  assert.equal(w.law.boundsOn(b).length, 1, "the member's act moves it");
  assert.equal(codeOf(w.law.lawRelate({ proposal: p.proposal.id, reason: REASON, author: V("carol"), viewer: V("carol") })), "STANDARD_PROPOSAL_ADOPTED");
  assert.equal(w.law.lawRelate({ proposal: p.proposal.id, reason: REASON, author: V("carol") }).adopted_as, adopted.relation.id);
  assert.equal(codeOf(w.law.lawRelate({ proposal: "lprop-0", reason: REASON, author: V("carol") })), "STANDARD_NO_SUCH_PROPOSAL");
  const link = w.law.lawPropose({ ...asks[1], why: "w", proposer: MACHINE });
  assert.equal(codeOf(w.law.lawRelate({ proposal: link.proposal.id, reason: REASON, author: V("carol") })), "STANDARD_NO_SUCH_PROPOSAL", "a proposal of another kind");
  const before = w.snapshot();
  for (const [args, code] of [[{ what: "relation", why: "", proposer: MACHINE }, "STANDARD_WHY_INVALID"],
                              [{ what: "relation", why: "x".repeat(241), proposer: MACHINE }, "STANDARD_WHY_INVALID"],
                              [{ what: "relation", why: "w", proposer: "" }, "STANDARD_PROPOSER_UNNAMED"],
                              [{ what: "opinion", why: "w", proposer: MACHINE }, "LAW_RELATION_UNKNOWN"],
                              [{ why: "w", proposer: MACHINE }, "LAW_RELATION_UNKNOWN"],
                              [{ what: "relation", why: "w", proposer: MACHINE, merit: 1 }, "STANDARD_FIELD_UNKNOWN"],
                              [{ what: "treatment", why: "w", proposer: MACHINE, edition: "x" }, "STANDARD_FIELD_UNKNOWN"]]) {
    const r = w.law.lawPropose(args);
    assert.equal(codeOf(r), code, code);
    if (code === "LAW_RELATION_UNKNOWN") { rowOf(r, code); assert.deepEqual(r.types, ["relation", "link", "treatment"]); }
  }
  assert.equal(w.law.lawPropose({ what: "relation", why: "x".repeat(240), proposer: MACHINE }).ok, true);
  assert.equal(w.count("law_proposals"), before.law_proposals.length + 1, "each refusal writes nothing");
});

test("R2 R20 lawWithdraw withdraws a relation, link or treatment, kept with who, when and why; it refuses MACHINE_CANNOT_RELATE, NO_SUCH_LAW_ITEM and the host's STANDARD_NO_REASON, writing nothing; a second withdrawal answers already with the first; the row stays and is read as withdrawn", () => {
  const w = seeded();
  const { a, b, at } = two(w);
  const court = w.standard({ kind: "court" }), later = w.standard({ kind: "court" });
  const rel = w.law.lawRelate({ type: "amends", from: a, to: b, citation: at, effective: "2021-01-01", reason: REASON, author: V("bob"), viewer: V("bob") }).relation.id;
  const link = w.law.courtLink({ type: "applies", from: court.id, to: a, citation: court.t, reason: REASON, author: V("bob") }).link.id;
  const treat = w.law.courtTreat({ decision: court.id, treatment: "affirmed", by_decision: later.id, citation: later.t, reason: REASON, author: V("bob") }).treatment.id;
  const before = w.snapshot();
  for (const [args, code] of [[{ relation: rel, reason: "wrong", author: MACHINE }, "MACHINE_CANNOT_RELATE"],
                              [{ relation: rel, reason: "wrong", author: "" }, "MACHINE_CANNOT_RELATE"],
                              [{ relation: "lrel-000", reason: "wrong", author: V("bob") }, "NO_SUCH_LAW_ITEM"],
                              [{ relation: "", reason: "wrong", author: V("bob") }, "NO_SUCH_LAW_ITEM"],
                              [{ relation: "STD-2026-0001-statute", reason: "wrong", author: V("bob") }, "NO_SUCH_LAW_ITEM"],
                              [{ relation: rel, reason: "", author: V("bob") }, "STANDARD_NO_REASON"]]) {
    const r = w.law.lawWithdraw(args);
    assert.equal(codeOf(r), code, code);
    if (LAW_RELATIONS_CHECKS[code]) rowOf(r, code);
  }
  assert.deepEqual(w.snapshot(), before, "each refusal writes nothing");
  for (const id of [rel, link, treat]) {
    const wd = w.law.lawWithdraw({ relation: id, reason: "It cites the wrong section.", author: V("carol") });
    assert.deepEqual([wd.ok, wd.relation, wd.withdrawn.by, wd.withdrawn.reason, typeof wd.withdrawn.at], [true, id, V("carol"), "It cites the wrong section.", "string"]);
    const again = w.law.lawWithdraw({ relation: id, reason: "again", author: V("bob") });
    assert.deepEqual([again.already, again.withdrawn], [true, wd.withdrawn], "the first withdrawal answers");
  }
  assert.equal(w.count("law_withdrawals"), 3);
  const kept = w.law.lawRelationsOf({ standard: a, viewer: V("bob") }).temporal.find((r) => r.id === rel);
  assert.deepEqual([kept.withdrawn.by, kept.type], [V("carol"), "amends"], "withdrawn, never deleted");
  assert.deepEqual(w.law.boundsOn(b), [], "a withdrawn relation bounds nothing");
});

test("R11 lawRelationsOf answers the relations a standard is an end of, in relation id order, temporal and referential in two lists, each with direction out or in; a relation whose citation passage the viewer may not read is neither answered nor counted; a withdrawn one is answered with its withdrawal; at most 2,000 read, truncated measured by reading one past; refusals STANDARD_NO_ID (op lawrelations) and NO_SUCH_STANDARD, the host's; it writes nothing", () => {
  const w = seeded();
  const { a, b, at, bt } = two(w);
  const out = w.law.lawRelate({ type: "refers_to", from: a, to: b, citation: at, reason: REASON, author: V("bob") }).relation.id;
  const inn = w.law.lawRelate({ type: "defines", from: b, to: a, citation: bt, reason: REASON, author: V("bob") }).relation.id;
  const P = w.project("alice");
  const hidden = w.passage({ project: P });
  const c = w.standard({ texts: [at, hidden] }).id;
  const fenced = w.law.lawRelate({ type: "excepts", from: c, to: a, citation: hidden, reason: REASON, author: V("alice") }).relation.id;
  const before = w.snapshot();
  const r = w.law.lawRelationsOf({ standard: a, viewer: V("carol") });
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  assert.deepEqual(r.referential.map((x) => [x.id, x.direction]), [[out, "out"], [inn, "in"]].sort((x, y) => (x[0] < y[0] ? -1 : 1)));
  assert.equal(r.truncated, false);
  assert.ok(!r.referential.some((x) => x.id === fenced), "a passage carol may not read: neither answered nor counted");
  assert.ok(w.law.lawRelationsOf({ standard: a, viewer: V("alice") }).referential.some((x) => x.id === fenced));
  assert.ok(w.law.lawRelationsOf({ standard: a }).referential.some((x) => x.id === fenced), "an internal read, no viewer sent, reads it");
  for (const standard of ["", "  ", null, undefined]) {
    const x = w.law.lawRelationsOf({ standard, viewer: V("carol") });
    assert.deepEqual([x.reason, x.host, x.op], ["STANDARD_NO_ID", true, "lawrelations"]);
  }
  assert.equal(codeOf(w.law.lawRelationsOf({ standard: "STD-2026-9999-x", viewer: V("carol") })), "NO_SUCH_STANDARD");
  assert.equal(codeOf(w.law.lawRelationsOf({ standard: a, viewer: "nobody" })), "NO_SUCH_STANDARD", "a standard the viewer may not read");
  /* the cap: exactly 2,000 read is not truncated; one past is, and the first 2,000 in id order are answered */
  const d = w.standard(), e = w.standard();
  for (let i = 0; i < 2000; i++) assert.equal(w.law.lawRelate({ type: "refers_to", from: d.id, to: e.id, citation: d.t, reason: REASON, author: V("bob") }).ok, true);
  const full = w.law.lawRelationsOf({ standard: e.id, viewer: V("bob") });
  assert.deepEqual([full.referential.length, full.truncated], [2000, false]);
  w.law.lawRelate({ type: "amends", from: d.id, to: e.id, citation: d.t, effective: "2020-01-01", reason: REASON, author: V("bob") });
  const cut = w.law.lawRelationsOf({ standard: e.id, viewer: V("bob") });
  const ids = w.rows(`SELECT relation_id FROM law_relations WHERE to_standard=? ORDER BY relation_id`, e.id).map((x) => x.relation_id);
  assert.deepEqual([cut.referential.length + cut.temporal.length, cut.truncated], [2000, true]);
  assert.deepEqual([...cut.temporal, ...cut.referential].map((x) => x.id).sort(), ids.slice(0, 2000));
});

test("R14 no law relation, court link or treatment row is written by a machine: each act and the withdrawal refuse a machine or empty author through MACHINE_CANNOT_RELATE's row, and an AI's reading reaches a member only as a proposal, stored apart and labelled machine work", () => {
  const w = seeded();
  const { a, b, at } = two(w);
  const court = w.standard({ kind: "court" });
  for (const author of [MACHINE, "class:daemon", "class:session", "token:abc", "", null, undefined, "  "]) {
    for (const r of [w.law.lawRelate({ type: "refers_to", from: a, to: b, citation: at, reason: REASON, author }),
                     w.law.courtLink({ type: "applies", from: court.id, to: a, citation: court.t, reason: REASON, author }),
                     w.law.courtTreat({ decision: court.id, treatment: "affirmed", by_decision: court.id, citation: court.t, reason: REASON, author }),
                     w.law.lawWithdraw({ relation: "lrel-x", reason: "r", author })]) {
      assert.equal(codeOf(r), "MACHINE_CANNOT_RELATE", String(author));
      rowOf(r, "MACHINE_CANNOT_RELATE");
    }
  }
  assert.deepEqual(["law_relations", "court_links", "court_treatments", "law_withdrawals"].map((t) => w.count(t)), [0, 0, 0, 0]);
  const p = w.law.lawPropose({ what: "treatment", decision: court.id, treatment: "affirmed", why: "Read in a news report.", proposer: MACHINE });
  assert.deepEqual([p.proposal.machine_work, p.proposal.by, w.count("law_proposals"), w.count("court_treatments")], [true, MACHINE, 1, 0]);
});

test("R21 machineRelate() and refuseNoCitation() are exported, the one site each of MACHINE_CANNOT_RELATE and LAW_RELATION_NO_CITATION, answering exactly what lawRelate answers for each code", async () => {
  const { machineRelate, refuseNoCitation } = await import("../../../src/law-relations/index.mjs");
  const w = seeded();
  const { a, b, at, bt } = two(w);
  const good = { type: "refers_to", from: a, to: b, citation: at, reason: REASON, author: V("bob"), viewer: V("bob") };
  for (const author of [MACHINE, "class:daemon", "token:x", "", null, undefined, "  "]) {
    const m = machineRelate(author);
    assert.deepEqual(m, w.law.lawRelate({ ...good, author }), String(author));
    rowOf(m, "MACHINE_CANNOT_RELATE");
  }
  for (const author of [V("bob"), "admin", "carol"]) assert.equal(machineRelate(author), null, author);
  for (const citation of [bt, "", null, 7, "x".repeat(200), " nope "]) {
    const r = refuseNoCitation(a, citation);
    assert.deepEqual(r, w.law.lawRelate({ ...good, citation }), JSON.stringify(citation));
    rowOf(r, "LAW_RELATION_NO_CITATION");
    assert.equal(r.standard, a);
  }
  assert.equal(w.count("law_relations"), 0, "neither writes");
});

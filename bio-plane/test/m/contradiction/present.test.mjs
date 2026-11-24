/* contradiction R24–R29, R42, R43, R45 (N345, PRESENT): what a candidate is at a read — its weight, its state, the
   candidates a viewer is shown, the marks on a side, the facts on each coordinate and what a case must disclose —
   driven at the module's interface over candidates the module's own doors wrote. */
import test from "node:test";
import assert from "node:assert/strict";
import { MACHINE, sha } from "./fixture.mjs";
import { seeded, cand, recommend, refusedWith, IQ, INFO, CID, M1, M2, OUT } from "./seed.mjs";
import { CONTRADICTION_PAIR_CHECKS, CONTRADICTION_CANDIDATE_CHECKS, PAGE_MAX, TENSIONS_REFERENTS_MAX,
         REACH_PROJECTS_MAX, REACH_INQUIRIES_MAX, UNRESOLVED_MAX, TENSIONS_CANDIDATES_MAX,
         FACTS_ENTITIES_MAX } from "../../../src/contradiction/index.mjs";

const ROWS = { ...CONTRADICTION_PAIR_CHECKS, ...CONTRADICTION_CANDIDATE_CHECKS };
const one = (w, id, viewer = M1) => w.c.candidatesFor({ on: { candidate: id }, viewer }).candidates[0] ?? null;
const claimRef = (inquiry, claim, version = "v1") => ({ ref: `${inquiry}|${version}`, version: sha(claim) });
const partRef = (cid, cap) => ({ ref: cid, version: cap });
const marks = (w, ref, viewer = M1) => w.c.tensionsOn({ referents: [ref], viewer }).referents[0].marks;

/* K3 material on top of the seed: both claims rest on passage a. */
function withK3(w) {
  w.versionLeg(IQ.a, "v1", 0, { content: CID.a, target: INFO.a });
  w.versionLeg(IQ.b, "v1", 0, { content: CID.a, target: INFO.a });
  return w;
}

test("R24: a weight comes from the label and the key, never stored: precision and unrelated not shown, world and undetermined a lead, record a duty on K1–K4", () => {
  const want = { world: "lead", undetermined: "lead", record: "duty", precision: null, unrelated: null };
  for (const key of ["K1", "K2", "K3", "K4"]) for (const [label, weight] of Object.entries(want)) {
    const w = withK3(seeded());
    const id = cand(w, key, label);
    const c = one(w, id);
    if (weight === null) assert.equal(c, null, `${key} ${label} is never shown`);
    else assert.equal(c.weight, weight, `${key} ${label}`);
    /* never stored: no column of the candidate carries a weight */
    assert.ok(!("weight" in w.one(`SELECT * FROM contradiction_candidates WHERE candidate=?`, id)));
  }
});

test("R24: a duty is held for the joined participants of every project drawing on either side, 32 per inquiry and 32 inquiries per row, with truncated", () => {
  const w = seeded();
  for (const p of ["PROJ-2026-0001-a", "PROJ-2026-0002-b", "PROJ-2026-0003-c"]) w.project(p, ["m1"]);
  w.draws(IQ.a, "PROJ-2026-0001-a"); w.draws(IQ.b, "PROJ-2026-0002-b"); w.draws(IQ.c, "PROJ-2026-0003-c");
  /* a claim side reaches the projects drawing on its inquiry */
  const k2 = one(w, cand(w, "K2", "record"));
  assert.deepEqual(k2.reach, { projects: ["PROJ-2026-0001-a", "PROJ-2026-0002-b"], truncated: false });
  /* an extent side reaches the projects drawing on each inquiry with a leg on its content row */
  const k4 = one(w, cand(w, "K4", "record"));
  assert.deepEqual(k4.reach, { projects: ["PROJ-2026-0003-c"], truncated: false });
  /* a leg side, the projects drawing on its inquiry */
  assert.deepEqual(one(w, cand(w, "K1", "record")).reach, { projects: ["PROJ-2026-0003-c"], truncated: false });
  /* the bounds */
  assert.equal(REACH_PROJECTS_MAX, 32); assert.equal(REACH_INQUIRIES_MAX, 32);
  const many = seeded();
  for (let i = 0; i < 33; i++) { const p = `PROJ-2026-${String(100 + i).padStart(4, "0")}-p`; many.project(p, ["m1"]); many.draws(IQ.a, p); }
  const cut = one(many, cand(many, "K2", "record"));
  assert.equal(cut.reach.truncated, true);
  assert.equal(cut.reach.projects.length, 32);
  const rows = seeded();
  for (let i = 0; i < 33; i++) { const q = `INQ-2026-${String(100 + i).padStart(4, "0")}-q`; rows.inquiry(q); rows.leg(q, 0, "supports", { content: CID.a, target: INFO.a }); }
  assert.equal(one(rows, cand(rows, "K4", "record")).reach.truncated, true);
});

test("R24, R25, R19 (N366): a duty's reach names only the projects the viewer may see, and neither counts nor bounds on the rest; {project} for a project the viewer may not see answers as an absent one", () => {
  const PV = "PROJ-2026-0001-seen", PH1 = "PROJ-2026-0002-hid", PH2 = "PROJ-2026-0003-hid", PX = "PROJ-2026-0404-none";
  const HQ = "PROJ-2026-0004-hq";                   /* a hidden project-typed bundle whose leg cites passage a */
  /* m1 sees PV only; m2 takes part in the two hidden projects; each hidden project draws on a seen side */
  const build = (hidden) => {
    const w = seeded();
    w.project(PV, ["m1"]);
    w.draws(IQ.a, PV); w.draws(IQ.c, PV);
    if (hidden) {
      w.project(PH1, ["m2"]); w.project(PH2, ["m2"]);
      w.draws(IQ.a, PH1); w.draws(IQ.b, PH2); w.draws(IQ.c, PH2);
      w.project(HQ, ["m2"]); w.leg(HQ, 0, "supports", { content: CID.a, target: INFO.a }); w.draws(HQ, PH1);
      /* enough hidden projects and hidden citing questions to fill every bound, were they counted */
      for (let i = 0; i < 33; i++) {
        const p = `PROJ-2026-${String(100 + i).padStart(4, "0")}-h`; w.project(p, ["m2"]); w.draws(IQ.a, p);
        const q = `PROJ-2026-${String(200 + i).padStart(4, "0")}-q`; w.project(q, ["m2"]); w.leg(q, 0, "supports", { content: CID.a, target: INFO.a });
      }
    }
    return { w, k2: cand(w, "K2", "record"), k4: cand(w, "K4", "record"), k1: cand(w, "K1", "record") };
  };
  const bare = build(false), two = build(true);
  const ask = (x, on, viewer = M1) => x.w.c.candidatesFor({ on, viewer });
  /* the viewer outside both hidden projects is shown only the project they see, never truncated by the hidden ones */
  for (const id of ["k2", "k4", "k1"]) {
    const c = ask(two, { candidate: two[id] }).candidates[0];
    assert.deepEqual(c.reach, { projects: [PV], truncated: false }, id);
    const bytes = JSON.stringify(ask(two, { candidate: two[id] }));
    for (const leak of [PH1, PH2, HQ, "-h\"", "-q\""]) assert.ok(!bytes.includes(leak), `${id} ${leak}`);
    /* R55's parity: the answer is the same bytes with the hidden projects and without them */
    assert.equal(bytes, JSON.stringify(ask(bare, { candidate: bare[id] })), id);
  }
  /* a participant of the hidden projects is shown the ones they see (and the reach is cut where they see 33) */
  const seen2 = ask(two, { candidate: two.k2 }, M2).candidates[0].reach;
  assert.ok(seen2.projects.includes(PH1) && seen2.projects.includes(PH2) && !seen2.projects.includes(PV));
  /* {project}: hidden, or seen at existence only, answers exactly as an id that names nothing */
  const norm = (r, id) => JSON.stringify(r).replaceAll(id, "ID");
  const absent = norm(ask(two, { project: PX }), PX);
  assert.equal(JSON.parse(absent).empty.level, "none_judged");
  assert.equal(norm(ask(two, { project: PH1 }), PH1), absent);
  assert.equal(norm(ask(two, { project: PH2 }), PH2), absent);
  two.w.st.sql.exec(`INSERT INTO project_visibility (project_id, setting, reason, set_by, at) VALUES (?, 'discoverable', 'r', 'm2', '2026-01-01')`, PH1);
  two.w.st.sql.exec(`INSERT OR REPLACE INTO project_sight (project_id, setting) VALUES (?, 'discoverable')`, PH1);
  assert.equal(two.w.membership.sight(PH1, M1), "existence");
  assert.equal(norm(ask(two, { project: PH1 }), PH1), absent);
  /* the project's own participant is answered its candidates; the seen project answers the viewer */
  assert.deepEqual(ask(two, { project: PH1 }, M2).candidates.map((c) => c.candidate).sort(), [two.k2, two.k4].sort());
  assert.deepEqual(ask(two, { project: PV }).candidates.map((c) => c.candidate).sort(), [two.k1, two.k2, two.k4].sort());
});

test("R24 (K5): any shown label on K5 is plurality until no_difference, then duty", { todo: "K5 is unshown until its gate arm is measured, and no model is reachable here to measure it (K488; draft-T15 point 5)" }, () => {});

test("R25: exactly one subject, else C-60.2; each of the six subjects answers the candidates naming it", () => {
  const w = seeded();
  w.project("PROJ-2026-0001-a", ["m1"]); w.draws(IQ.a, "PROJ-2026-0001-a");
  const k2 = cand(w, "K2", "record"), k4 = cand(w, "K4", "world");
  for (const on of [null, undefined, {}, { inquiry: "" }, { inquiry: IQ.a, content: CID.a }, "INQ", [IQ.a]])
    refusedWith(assert, ROWS, w.c.candidatesFor({ on, viewer: M1 }), "CANDIDATES_NO_SUBJECT");
  /* N458: the member reads "record", and the argument keeps its name `bundle` (N71). */
  assert.match(w.c.candidatesFor({ on: {}, viewer: M1 }).detail, /a record \(bundle\)/);
  const ids = (on) => w.c.candidatesFor({ on, viewer: M1 }).candidates.map((c) => c.candidate).sort();
  assert.deepEqual(ids({ candidate: k2 }), [k2]);
  assert.deepEqual(ids({ inquiry: IQ.a }), [k2]);
  assert.deepEqual(ids({ content: CID.a }), [k4]);
  assert.deepEqual(ids({ entity: "E1" }), [k2, k4].sort());
  assert.deepEqual(ids({ bundle: INFO.b }), [k4]);
  assert.deepEqual(ids({ bundle: IQ.b }), [k2]);
  assert.deepEqual(ids({ project: "PROJ-2026-0001-a" }), [k2]);     /* its duty reaches the project; K4's lead does not */
  assert.deepEqual(ids({ project: "PROJ-2026-0404-x" }), []);
});

test("R25: each candidate carries its key, why, both sides verbatim with source, date, doctype and capture, the machine's label and reason labelled, weight, state, resolution, recommendations, reach and default_question", () => {
  const w = seeded();
  const id = cand(w, "K4", "world", { reason: "one rule, one act" });
  recommend(w, id, [{ coordinate: "time_or_occasion", reason: "different dates" }]);
  const c = one(w, id);
  assert.equal(c.key, "K4");
  assert.match(c.why, /different kinds/);
  const sides = [c.a, c.b].sort((x, y) => (x.content_id < y.content_id ? -1 : 1));
  const byCid = (cid) => sides.find((s) => s.content_id === cid);
  assert.deepEqual([byCid(CID.a).capture_sha, byCid(CID.a).doctype, byCid(CID.a).date, byCid(CID.a).source.bundle],
                   ["capA", "rule", "2026-01-01", INFO.a]);
  assert.deepEqual([byCid(CID.b).capture_sha, byCid(CID.b).doctype, byCid(CID.b).date, byCid(CID.b).source.bundle],
                   ["capB", "act", "2026-03-01", INFO.b]);
  assert.deepEqual([c.machine.label, c.machine.reason, c.machine.origin, c.machine.machine_work], ["world", "one rule, one act", "machine", true]);
  assert.deepEqual([c.weight, c.state, c.resolution, c.inquiry], ["lead", "open", null, null]);
  assert.equal(c.recommendations.length, 1);
  assert.deepEqual([c.recommendations[0].coordinate, c.recommendations[0].machine_work], ["time_or_occasion", true]);
  assert.match(c.recommendations[0].says, /not a member's choice/);
  assert.deepEqual(c.reach, { projects: [], truncated: false });
  assert.equal(typeof c.default_question, "string");
  assert.ok(c.default_question.length > 0 && c.default_question.length <= 500);
  /* a resolution carries the member who made it */
  w.c.clarify({ candidate: cand(w, "K2", "record"), choice: "one_wrong", wrongSide: "a", reason: "misread", viewer: M1, author: M1 });
  const r = w.c.candidatesFor({ on: { inquiry: IQ.a }, viewer: M1 }).candidates[0];
  assert.deepEqual([r.state, r.resolution.kind, r.resolution.member, r.resolution.wrong_side], ["resolved", "corrected", M1, "a"]);
});

test("R25 (T51, B5): a candidate taken up carries taken_up {member, at, words} from its take_up act, and so does it once resolved; an open one, and one resolved without a take-up, carry none", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const absent = (c) => assert.ok(!("taken_up" in c), JSON.stringify(c.taken_up));
  absent(one(w, duty));
  const up = w.c.takeUp({ candidate: duty, question: "Which fee holds?", frame: "b", viewer: M1, author: M1 });
  assert.equal(up.ok, true);
  const want = { member: M1, at: up.act.at, words: "Which fee holds?" };
  assert.equal(one(w, duty).state, "taken_up");
  assert.deepEqual(one(w, duty).taken_up, want);
  /* the same under the same sight: another member who sees both sides reads the same take-up */
  assert.deepEqual(one(w, duty, M2).taken_up, want);
  assert.deepEqual(w.c.candidatesFor({ on: { inquiry: IQ.a }, viewer: M2 }).candidates[0].taken_up, want);
  /* later: resolved through the inquiry's conclusion, it still says who took it up and how it was worded */
  const done = w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, conclusion: "both fees are in the record",
                            viewer: M2, author: M2 });
  assert.equal(done.ok, true, JSON.stringify(done).slice(0, 400));
  assert.equal(one(w, duty).state, "resolved");
  assert.deepEqual(one(w, duty).taken_up, want);
  /* control: a candidate resolved by an act alone was never taken up */
  const other = cand(w, "K4", "record");
  w.c.clarify({ candidate: other, choice: "one_wrong", wrongSide: "a", reason: "misread", viewer: M1, author: M1 });
  assert.equal(one(w, other).state, "resolved");
  absent(one(w, other));
  /* control: a viewer who may not see both sides is not answered the candidate, so nothing of the take-up either */
  assert.equal(one(w, duty, null), null);
});

test("R25, R45: empty answers name their level — none_judged, or none_shown counting precision and unrelated — never a bare list; filters, page, cursor", () => {
  const w = seeded();
  const none = w.c.candidatesFor({ on: { inquiry: IQ.a }, viewer: M1 });
  assert.deepEqual([none.ok, none.candidates, none.empty.level], [true, [], "none_judged"]);
  cand(w, "K2", "precision");
  const hidden = w.c.candidatesFor({ on: { inquiry: IQ.a }, viewer: M1 });
  assert.deepEqual([hidden.candidates, hidden.empty.level, hidden.empty.not_shown], [[], "none_shown", { precision: 1, unrelated: 0 }]);
  assert.deepEqual(hidden.not_shown, { precision: 1, unrelated: 0 });
  /* filters, page and cursor, newest first */
  const p = seeded();
  const lead = cand(p, "K4", "world"), duty = cand(p, "K2", "record"), k1 = cand(p, "K1", "undetermined");
  const all = p.c.candidatesFor({ on: { entity: "E1" }, viewer: M1 });
  assert.equal(all.candidates.length, 2);
  const byBundle = p.c.candidatesFor({ on: { bundle: INFO.a }, viewer: M1 });
  assert.deepEqual(byBundle.candidates.map((c) => c.candidate), [k1, lead]);     /* newest first */
  assert.deepEqual(p.c.candidatesFor({ on: { bundle: INFO.a }, weight: "duty", viewer: M1 }).candidates, []);
  assert.deepEqual(p.c.candidatesFor({ on: { bundle: INFO.a }, label: "world", viewer: M1 }).candidates.map((c) => c.candidate), [lead]);
  assert.deepEqual(p.c.candidatesFor({ on: { inquiry: IQ.a }, state: "open", viewer: M1 }).candidates.map((c) => c.candidate), [duty]);
  const page1 = p.c.candidatesFor({ on: { bundle: INFO.a }, limit: 1, viewer: M1 });
  assert.deepEqual([page1.candidates.length, page1.truncated, page1.cursor, page1.limit], [1, true, k1, 1]);
  const page2 = p.c.candidatesFor({ on: { bundle: INFO.a }, limit: 1, after: page1.cursor, viewer: M1 });
  assert.deepEqual([page2.candidates.map((c) => c.candidate), page2.truncated], [[lead], false]);
  assert.equal(PAGE_MAX, 50);
  for (const limit of [null, "x", 0, 999]) assert.equal(p.c.candidatesFor({ on: { bundle: INFO.a }, limit, viewer: M1 }).limit, 50);
  const filtered = p.c.candidatesFor({ on: { bundle: INFO.a }, label: "record", viewer: M1 });
  assert.equal(filtered.empty.level, "none_matching");
});

test("R25: {entity} answers in the stated date of the earlier-dated side, undated last and counted", () => {
  const w = seeded();
  const k4 = cand(w, "K4", "world");       /* dated: 2026-01-01 */
  const k2 = cand(w, "K2", "record");      /* claims state no date */
  const r = w.c.candidatesFor({ on: { entity: "E1" }, viewer: M1 });
  assert.deepEqual(r.candidates.map((c) => c.candidate), [k4, k2]);
  assert.equal(r.undated, 1);
});

test("R25, R10, R19: a candidate with a side the viewer may not see is not answered, nor counted; an absent viewer sees none", () => {
  const w = seeded();
  w.inquiry("PROJ-2026-0009-h", { subject: "E1", project: true });
  w.version("PROJ-2026-0009-h", "v1", { claim: "the fee held" });
  const pairs = w.c.pairs({ key: "K2", viewer: MACHINE }).pairs;
  const hid = pairs.find((p) => p.a.inquiry === "PROJ-2026-0009-h" || p.b.inquiry === "PROJ-2026-0009-h");
  const id = w.c.propose({ run: "RUN-2026-0001", proposedBy: "class:ai/t", viewer: MACHINE, caller: "member:m1",
                           proposals: [{ key: "K2", a: hid.a, b: hid.b, label: "precision", reason: "r" }] }).candidates[0].candidate;
  assert.equal(w.c.candidatesFor({ on: { candidate: id }, viewer: M1 }).empty.level, "none_shown");
  const out = w.c.candidatesFor({ on: { candidate: id }, viewer: OUT });
  assert.deepEqual([out.candidates, out.empty.level, out.not_shown], [[], "none_judged", { precision: 0, unrelated: 0 }]);
  for (const viewer of [null, "", "somebody"]) assert.deepEqual(w.c.candidatesFor({ on: { inquiry: IQ.a }, viewer }).candidates, []);
});

test("R25: it writes nothing and never throws", () => {
  const w = seeded();
  const id = cand(w, "K2", "record");
  const before = JSON.stringify(["contradiction_candidates", "contradiction_acts", "contradiction_recommendations",
    "contradiction_optins", "contradiction_responses"].map((t) => w.rows(`SELECT * FROM ${t}`)));
  for (const on of [{ candidate: id }, { inquiry: 7 }, { entity: "E1" }, { project: "P" }]) w.c.candidatesFor({ on, viewer: M1 });
  assert.equal(JSON.stringify(["contradiction_candidates", "contradiction_acts", "contradiction_recommendations",
    "contradiction_optins", "contradiction_responses"].map((t) => w.rows(`SELECT * FROM ${t}`))), before);
  assert.doesNotThrow(() => w.c.candidatesFor({ on: { candidate: id }, label: {}, weight: [], state: 3, after: {}, limit: {}, viewer: {} }));
});

test("R26: a state is derived at every read, by acts alone: open, explained_not_shown, resolved (dissolved, corrected), dismissed, taken_up, and taken_up again when the inquiry reopens", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  const state = (id) => one(w, id).state;
  assert.equal(state(duty), "open");
  assert.equal(w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "different fees", viewer: M1, author: M1 }).ok, true);
  assert.equal(state(duty), "explained_not_shown");
  /* a later act on an explained candidate moves it on */
  assert.equal(w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "shown", evidence: [{ fact: "subject" }], viewer: M1, author: M1 }).ok, true);
  assert.deepEqual([state(duty), one(w, duty).resolution.kind], ["resolved", "dissolved"]);
  const lead = cand(w, "K4", "world");
  w.c.dismiss({ candidate: lead, reason: "not_same_matter", viewer: M1, author: M1 });
  assert.equal(state(lead), "dismissed");
  const k1 = cand(w, "K1", "record");
  w.c.clarify({ candidate: k1, choice: "one_wrong", wrongSide: "b", reason: "misquoted", viewer: M1, author: M1 });
  assert.deepEqual([state(k1), one(w, k1).resolution.kind], ["resolved", "corrected"]);
  /* taken up, then its inquiry's conclusion is the resolution, and a reopened inquiry makes it taken_up again */
  const t = seeded();
  const d = cand(t, "K2", "record");
  const up = t.c.takeUp({ candidate: d, question: "Did the fee rise or fall?", frame: "a", viewer: M1, author: M1 });
  assert.equal(up.ok, true, JSON.stringify(up).slice(0, 600));
  assert.equal(one(t, d).state, "taken_up");
  assert.equal(one(t, d).inquiry, up.inquiry);
  const res = t.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, conclusion: "both conclusions stand",
                            viewer: M1, author: M1 });
  assert.equal(res.ok, true, JSON.stringify(res).slice(0, 600));
  assert.deepEqual([one(t, d).state, one(t, d).resolution.kind], ["resolved", "irreconcilable"]);
  const head = t.record.head(up.inquiry);
  const text = t.text(up.inquiry).replace(/^current_state: .*$/m, "current_state: open").replace(/^prior_state: .*$/m, "prior_state: concluded");
  const reopened = t.promotion.promote({ bundleId: up.inquiry, base: head.bundleSha, snapKey: "reopen1", author: M1,
                                         files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" } });
  assert.equal(reopened.ok, true, JSON.stringify(reopened).slice(0, 600));
  assert.equal(one(t, d).state, "taken_up");
});

test("R27: each mark over a claim, a leg and an extent — in_tension, lead, softened, stale, qualified, held_irreconcilable — each carrying its candidate", () => {
  /* in_tension on a claim (an open duty) and lead on a leg and an extent (an open lead) */
  const w = seeded();
  const duty = cand(w, "K2", "record");
  assert.deepEqual(marks(w, claimRef(IQ.a, "the fee rose")), [{ mark: "in_tension", candidate: duty }]);
  assert.deepEqual(marks(w, { kind: "claim", inquiry: IQ.b, version: "v1", claim: "the fee fell" }), [{ mark: "in_tension", candidate: duty }]);
  const lead1 = cand(w, "K1", "world"), lead4 = cand(w, "K4", "undetermined");
  const onA = marks(w, partRef(CID.a, "capA"));
  assert.deepEqual(onA.map((m) => [m.mark, m.candidate]).sort(), [["lead", lead1], ["lead", lead4]].sort());
  /* a changed referent is a different one: nothing on the claim at other text */
  assert.deepEqual(marks(w, claimRef(IQ.a, "the fee rose sharply")), []);
  /* softened: explained without evidence */
  w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "one is the base fee",
                qualifiers: { a: "the base fee", b: "the total" }, viewer: M1, author: M1 });
  const s = marks(w, claimRef(IQ.a, "the fee rose"))[0];
  assert.deepEqual([s.mark, s.candidate, s.explanation, s.member, s.coordinates, s.qualifier, s.qualifier_standing],
                   ["softened", duty, "one is the base fee", M1, ["scope"], "the base fee", "hypothesis"]);
  /* qualified: dissolved with evidence */
  w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "shown", evidence: [{ fact: "subject" }],
                qualifiers: { b: "the total" }, viewer: M1, author: M1 });
  const q = marks(w, claimRef(IQ.b, "the fee fell"))[0];
  assert.deepEqual([q.mark, q.coordinates, q.qualifier, q.explanation, q.qualifier_standing], ["qualified", ["scope"], "the total", "shown", "evidenced"]);
  /* stale: the side named wrong, and only that side; it still resolves and says it was corrected */
  const k1 = seeded();
  const c1 = cand(k1, "K1", "record");
  const r = k1.c.clarify({ candidate: c1, choice: "one_wrong", wrongSide: "a", reason: "misquoted", viewer: M1, author: M1 });
  const cands = k1.c.candidatesFor({ on: { candidate: c1 }, viewer: M1 }).candidates[0];
  const wrongRef = partRef(cands.a.content_id, cands.a.capture_sha), rightRef = partRef(cands.b.content_id, cands.b.capture_sha);
  const st = marks(k1, wrongRef)[0];
  assert.deepEqual([st.mark, st.candidate, st.reason, st.member, st.at, st.act, st.corrected],
                   ["stale", c1, "misquoted", M1, r.act.at, r.act.act_id, true]);
  assert.match(st.says, /still resolves/);
  assert.deepEqual(marks(k1, rightRef), []);
  /* held_irreconcilable, through the contradiction inquiry's conclusion */
  const h = seeded();
  const c2 = cand(h, "K2", "record");
  const up = h.c.takeUp({ candidate: c2, question: "Which holds?", frame: "b", viewer: M1, author: M1 });
  h.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, conclusion: "both conclusions stand", viewer: M1, author: M1 });
  assert.deepEqual(marks(h, claimRef(IQ.a, "the fee rose")), [{ mark: "held_irreconcilable", candidate: c2, inquiry: up.inquiry }]);
});

test("R27: a CORRECTED resolution through the inquiry marks its wrong side stale with R36's concluding member and instant (N359); a taken-up duty stays in tension", () => {
  const w = seeded();
  const id = cand(w, "K2", "record");
  const up = w.c.takeUp({ candidate: id, question: "Which is right?", frame: "a", viewer: M1, author: M1 });
  assert.deepEqual(marks(w, claimRef(IQ.a, "the fee rose")), [{ mark: "in_tension", candidate: id, inquiry: up.inquiry }]);
  const r = w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "misquote", wrong_side: "b", reason: "the minutes misquote it" },
                          conclusion: "the fee rose", viewer: M1, author: M1 });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 500));
  const s = marks(w, claimRef(IQ.b, "the fee fell"))[0];
  assert.deepEqual([s.mark, s.kind, s.reason, s.inquiry], ["stale", "misquote", "the minutes misquote it", up.inquiry]);
  assert.deepEqual(marks(w, claimRef(IQ.a, "the fee rose")), []);
  /* N359: R36's concluding member and the conclusion's instant, from its resolve act, never null */
  assert.deepEqual([s.member, s.at, s.act, s.why], [M1, r.act.at, r.act.act_id, undefined]);
  assert.equal(r.act.act, "resolve");
  /* concluded by another member at another instant: the latest concluding act is the one read */
  const t = seeded();
  const id2 = cand(t, "K2", "record");
  const up2 = t.c.takeUp({ candidate: id2, question: "Which is right?", frame: "a", viewer: M1, author: M1 });
  t.clock.now = "2026-09-29T12:00:00Z";
  const r2 = t.c.resolve({ inquiry: up2.inquiry, resolution: { kind: "superseded_version", wrong_side: "a", reason: "an older text" },
                           conclusion: "the fee fell", viewer: M2, author: M2 });
  assert.equal(r2.ok, true, JSON.stringify(r2).slice(0, 500));
  const s2 = marks(t, claimRef(IQ.a, "the fee rose"))[0];
  assert.deepEqual([s2.mark, s2.member, s2.at, s2.act], ["stale", M2, "2026-09-29T12:00:00Z", r2.act.act_id]);
  /* a conclusion reached only by basis-versions' own door has no concluding act here: null, and says why */
  const o = seeded();
  const id3 = cand(o, "K2", "record");
  const up3 = o.c.takeUp({ candidate: id3, question: "Which is right?", frame: "a", viewer: M1, author: M1 });
  const head = o.record.head(up3.inquiry);
  const text = o.text(up3.inquiry).replace(/^current_state: .*$/m, "current_state: concluded").replace(/^prior_state: .*$/m, "prior_state: open")
    .replace(/\n---\n/, `\nconclusion: "the fee rose"\nfalsifier: "none"\nresolution:\n  kind: "misquote"\n  wrong_side: "b"\n  reason: "misquoted"\n---\n`);
  const pr = o.promotion.promote({ bundleId: up3.inquiry, base: head.bundleSha, snapKey: "other-door", author: M1,
                                   files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" } });
  assert.equal(pr.ok, true, JSON.stringify(pr).slice(0, 600));
  const s3 = marks(o, claimRef(IQ.b, "the fee fell"))[0];
  assert.deepEqual([s3.mark, s3.inquiry, s3.member, s3.at, s3.act], ["stale", up3.inquiry, null, null, undefined]);
  assert.match(s3.why, /basis-versions' own door/);
});

test("R27: plurality marks an open K5 candidate before no_difference", { todo: "K5 is unshown until its gate arm is measured (K488)" }, () => {});

test("R27, R45: not_shown candidates put no mark; more than 200 referents is C-60.3; it writes nothing and never throws", () => {
  const w = seeded();
  cand(w, "K2", "precision");
  assert.deepEqual(marks(w, claimRef(IQ.a, "the fee rose")), []);
  assert.equal(TENSIONS_REFERENTS_MAX, 200);
  const many = Array.from({ length: 201 }, (_, i) => ({ ref: `r${i}`, version: "v" }));
  refusedWith(assert, ROWS, w.c.tensionsOn({ referents: many, viewer: M1 }), "TENSIONS_TOO_MANY");
  assert.equal(w.c.tensionsOn({ referents: many.slice(0, 200), viewer: M1 }).referents.length, 200);
  assert.doesNotThrow(() => w.c.tensionsOn({ referents: [null, 3, {}, "x"], viewer: M1 }));
  assert.deepEqual(w.c.tensionsOn({ referents: "x", viewer: M1 }).referents, []);
});

test("R27 (N368): each referent's marks are read from at most 200 candidates (TENSIONS_CANDIDATES_MAX), and past it the referent says truncated", () => {
  assert.equal(TENSIONS_CANDIDATES_MAX, 200);
  /* one claim paired with 201 others on its subject, proposed 50 at a time (the pairing's bound): each batch's other
     versions are then pruned (hidden), so the next batch forms; the candidates stay */
  const w = seeded();
  const A = "INQ-2026-0000-anchor";
  w.inquiry(A, { subject: "E9" }); w.version(A, "v1", { claim: "the anchor" });
  const others = Array.from({ length: 201 }, (_, i) => `INQ-2026-${String(1000 + i)}-o`);
  for (const o of others) { w.inquiry(o, { subject: "E9" }); w.version(o, "v1", { claim: `other ${o}` }); }
  let made = 0;
  while (made < 201) {
    const pairs = w.c.pairs({ key: "K2", viewer: MACHINE }).pairs.filter((p) => p.a.inquiry === A || p.b.inquiry === A);
    const r = w.c.propose({ run: "RUN-2026-0001", proposedBy: "class:ai/t", viewer: MACHINE, caller: M1,
                            proposals: pairs.map((p) => ({ key: "K2", a: p.a, b: p.b, label: "record", reason: "r" })) });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    made += r.written;
    for (const p of pairs) { const o = p.a.inquiry === A ? p.b.inquiry : p.a.inquiry; w.st.sql.exec(`UPDATE inquiry_basis_versions SET hidden=1 WHERE bundle_id=?`, o); }
  }
  const ref = claimRef(A, "the anchor");
  const cut = w.c.tensionsOn({ referents: [ref], viewer: M1 });
  assert.deepEqual([cut.referents[0].marks.length, cut.referents[0].truncated, cut.truncated, cut.limit], [200, true, true, 200]);
  assert.ok(cut.referents[0].marks.every((m) => m.mark === "in_tension"));
  /* at the bound, whole: one candidate fewer on the referent (its other side's bundle purged) */
  w.record.purge({ bundleId: others[200] });
  const whole = w.c.tensionsOn({ referents: [ref, claimRef(IQ.b, "the fee fell")], viewer: M1 });
  assert.deepEqual([whole.referents[0].marks.length, whole.referents[0].truncated, whole.referents[1].truncated, whole.truncated],
                   [200, false, false, false]);
});

test("R28 (N368): each side's resolved entities are at most 500 (FACTS_ENTITIES_MAX), and past it that fact says truncated", () => {
  assert.equal(FACTS_ENTITIES_MAX, 500);
  const w = seeded();
  for (let i = 0; i < 500; i++) w.resolution("capA", INFO.a, `E-${String(i).padStart(4, "0")}`, { ref: `ref:${i}` });
  const id = cand(w, "K4", "world");
  const f = (r) => r.facts.find((x) => x.fact === "resolved_entities");
  const cut = w.c.contextFacts({ candidate: id, viewer: M1 });
  const [capASide, capBSide] = one(w, id).a.capture_sha === "capA" ? ["a", "b"] : ["b", "a"];
  const ents = f(cut);
  assert.deepEqual([ents[capASide].length, ents.truncated, ents[`${capASide}_truncated`], ents[`${capBSide}_truncated`], ents.limit, cut.truncated],
                   [500, true, true, undefined, 500, true]);
  assert.deepEqual(ents[capBSide], ["E1"]);
  /* at the bound, whole */
  w.st.sql.exec(`DELETE FROM resolutions WHERE capture_sha='capA' AND entity_id='E-0499'`);
  const whole = w.c.contextFacts({ candidate: id, viewer: M1 });
  assert.deepEqual([f(whole)[capASide].length, f(whole).truncated, whole.truncated], [500, undefined, false]);
});

test("R28: the facts on each coordinate, each the record's and never machine work, an unstated one undetermined with why; an absent or invisible candidate is C-93.9", () => {
  const w = seeded();
  const k4 = w.c.contextFacts({ candidate: cand(w, "K4", "world"), viewer: M1 });
  assert.equal(k4.ok, true);
  const f = (name) => k4.facts.find((x) => x.fact === name);
  assert.deepEqual([f("stated_date").coordinate, f("doctype").coordinate, f("capture").coordinate, f("resolved_entities").coordinate],
                   ["time_or_occasion", "observer_or_method", "observer_or_method", "subject"]);
  assert.deepEqual([f("stated_date").a, f("stated_date").b].sort(), ["2026-01-01", "2026-03-01"]);
  assert.deepEqual([f("resolved_entities").a, f("resolved_entities").b], [["E1"], ["E1"]]);
  for (const x of k4.facts) { assert.equal(x.machine_work, false); assert.equal(x.source, "record"); assert.equal(x.undetermined, undefined); }
  const k2 = w.c.contextFacts({ candidate: cand(w, "K2", "record"), viewer: M1 });
  const date = k2.facts.find((x) => x.fact === "stated_date");
  assert.deepEqual([date.undetermined, date.a, date.b], [true, null, null]);
  assert.match(date.why, /states no document date/);
  assert.deepEqual(k2.facts.find((x) => x.fact === "resolved_entities").a, ["E1"]);
  for (const candidate of [null, "", "nope", sha("x")])
    refusedWith(assert, ROWS, w.c.contextFacts({ candidate, viewer: M1 }), "NO_SUCH_CANDIDATE");
  refusedWith(assert, ROWS, w.c.contextFacts({ candidate: cand(w, "K1", "world"), viewer: null }), "NO_SUCH_CANDIDATE");
});

test("R29: a case pinning a finding at its bytes discloses each standing duty on what it holds one level deep, with depth 1; resolved ones but irreconcilable are not", () => {
  const w = seeded();
  /* the finding: IQ.c promoted with an accepted claimed version, a document leg naming passage a, and an inquiry leg on IQ.a */
  w.bundle(INFO.a);
  const finding = "INQ-2026-0100-finding";
  const md = ["---", `id: ${finding}`, "object_type: inquiry", "schema: inquiry@1", `title: "Finding"`, "current_state: open",
    "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`, "surfaced_by: human",
    "references:", `  - target: ${INFO.a}`, "    rel: cites", "    status: confirmed", `  - target: ${IQ.a}`, "    rel: cites", "    status: confirmed",
    "state_history: []", "basis:", `  - target: ${INFO.a}`, "    role: supports", `    content_id: ${CID.a}`,
    `  - target: ${IQ.a}`, "    role: supports", "---", "", "## Question", "", "Q?", "", "## Session Log", ""].join("\n");
  const p = w.promotion.promote({ bundleId: finding, base: null, snapKey: "f1", author: M1, files: [{ path: "bundle.md", text: md }],
                                  meta: { object_type: "inquiry" } });
  assert.equal(p.ok, true, JSON.stringify(p).slice(0, 600));
  const duty2 = cand(w, "K2", "record");          /* on IQ.a's claim: an inquiry leg's accepted claim */
  const duty4 = cand(w, "K4", "record");          /* on passage a: a document leg's content row */
  const lead = cand(w, "K1", "world");            /* a lead is not disclosed */
  const r = w.c.unresolvedRecordOn({ finding, sha: p.bundleSha });
  assert.equal(r.ok, true);
  assert.deepEqual(r.candidates.map((c) => c.candidate).sort(), [duty2, duty4].sort());
  for (const c of r.candidates) { assert.equal(c.depth, 1); assert.equal(c.state, "open"); assert.ok(c.a && c.b); }
  assert.match(r.says, /deeper findings disclose their own/);
  assert.equal(UNRESOLVED_MAX, 200);
  /* dissolved is no longer disclosed; irreconcilable is */
  w.c.clarify({ candidate: duty4, choice: "differs", coordinates: ["time_or_occasion"], explanation: "dates", evidence: [{ fact: "time_or_occasion" }], viewer: M1, author: M1 });
  assert.deepEqual(w.c.unresolvedRecordOn({ finding, sha: p.bundleSha }).candidates.map((c) => c.candidate), [duty2]);
  const up = w.c.takeUp({ candidate: duty2, question: "Which?", frame: "a", viewer: M1, author: M1 });
  const taken = w.c.unresolvedRecordOn({ finding, sha: p.bundleSha }).candidates[0];
  assert.deepEqual([taken.state, taken.inquiry], ["taken_up", up.inquiry]);
  w.c.resolve({ inquiry: up.inquiry, resolution: { kind: "irreconcilable" }, conclusion: "both conclusions stand", viewer: M1, author: M1 });
  assert.deepEqual(w.c.unresolvedRecordOn({ finding, sha: p.bundleSha }).candidates.map((c) => [c.candidate, c.kind]), [[duty2, "irreconcilable"]]);
  void lead;
  /* bytes no text answers: undetermined */
  assert.equal(w.c.unresolvedRecordOn({ finding, sha: "0".repeat(64) }).undetermined, true);
  assert.equal(w.c.unresolvedRecordOn({}).undetermined, true);
});

test("R29 (DEC-85): a candidate with a side the stated viewer may not see answers unseen_other_side with its seen side only, withholding its explanation and inquiry", () => {
  const w = seeded();
  const hiddenInfo = "PROJ-2026-0009-h";
  w.project(hiddenInfo, ["m2"]);
  const hid = sha("hidden passage");
  w.content(hid, "capH", hiddenInfo);
  w.leg(IQ.c, 2, "cuts_against", { content: hid, target: INFO.b });
  w.resolution("capH", hiddenInfo, "E1");
  w.reading("capH", hiddenInfo, { contentType: "minutes", date: "2026-02-01" });
  const pair = w.c.pairs({ key: "K1", viewer: MACHINE }).pairs.find((p) => p.b.content_id === hid);
  const id = w.c.propose({ run: "RUN-2026-0001", proposedBy: "class:ai/t", viewer: MACHINE, caller: "member:m1",
                           proposals: [{ key: "K1", a: pair.a, b: pair.b, label: "record", reason: "r" }] }).candidates[0].candidate;
  w.c.clarify({ candidate: id, choice: "differs", coordinates: ["scope"], explanation: "the hidden minutes say otherwise", viewer: "member:m2", author: "member:m2" });
  const finding = "INQ-2026-0101-finding";
  const md = ["---", `id: ${finding}`, "object_type: inquiry", "schema: inquiry@1", `title: "Finding"`, "current_state: open",
    "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`, "surfaced_by: human",
    "references:", `  - target: ${INFO.a}`, "    rel: cites", "    status: confirmed",
    "state_history: []", "basis:", `  - target: ${INFO.a}`, "    role: supports", `    content_id: ${CID.a}`,
    "---", "", "## Question", "", "Q?", ""].join("\n");
  const p = w.promotion.promote({ bundleId: finding, base: null, snapKey: "f2", author: M1, files: [{ path: "bundle.md", text: md }], meta: { object_type: "inquiry" } });
  assert.equal(p.ok, true, JSON.stringify(p).slice(0, 500));
  const whole = w.c.unresolvedRecordOn({ finding, sha: p.bundleSha });
  assert.equal(whole.candidates[0].explanation, "the hidden minutes say otherwise");
  const half = w.c.unresolvedRecordOn({ finding, sha: p.bundleSha, viewer: M1 }).candidates[0];
  assert.equal(half.unseen_other_side, true);
  assert.equal(half.side.content_id, CID.a);
  const bytes = JSON.stringify(half);
  for (const leak of [hid, "capH", hiddenInfo, "minutes", "hidden", "explanation"]) assert.ok(!bytes.includes(leak), leak);
  assert.deepEqual(Object.keys(half).sort(), ["candidate", "depth", "side", "state", "unseen_other_side"]);
});

test("R42: state, weight and marks are derived at the read; the tables hold only what was done, append-only", () => {
  const w = seeded();
  const id = cand(w, "K2", "record");
  w.c.clarify({ candidate: id, choice: "differs", coordinates: ["scope"], explanation: "x", viewer: M1, author: M1 });
  const row = w.one(`SELECT * FROM contradiction_candidates WHERE candidate=?`, id);
  assert.equal(row.state, "proposed");                    /* never moved in place */
  for (const t of ["contradiction_acts", "contradiction_recommendations", "contradiction_optins", "contradiction_responses"])
    for (const col of ["weight", "mark"]) assert.ok(!w.rows(`SELECT name FROM pragma_table_info(?)`, t).some((c) => c.name === col), `${t}.${col}`);
  assert.equal(w.count("contradiction_acts"), 1);
  assert.equal(one(w, id).state, "explained_not_shown");
});

test("R43: a duty is never dismissed and leaves only by resolution; a lead becomes no duty without a member's act", () => {
  const w = seeded();
  const duty = cand(w, "K2", "record");
  refusedWith(assert, ROWS, w.c.dismiss({ candidate: duty, reason: "not_same_matter", viewer: M1, author: M1 }), "RECORD_CANNOT_BE_DISMISSED");
  w.c.clarify({ candidate: duty, choice: "differs", coordinates: ["scope"], explanation: "x", viewer: M1, author: M1 });
  assert.equal(one(w, duty).weight, "duty");               /* explained: the duty stays */
  const lead = cand(w, "K4", "world");
  recommend(w, lead, [{ coordinate: "scope", reason: "r" }]);
  w.c.tensionsOn({ referents: [partRef(CID.a, "capA")], viewer: M1 });
  assert.equal(one(w, lead).weight, "lead");
  const up = w.c.takeUp({ candidate: lead, question: "Which?", frame: "a", viewer: M1, author: M1 });
  assert.deepEqual([one(w, lead).weight, one(w, lead).state, !!up.inquiry], ["lead", "taken_up", true]);
});

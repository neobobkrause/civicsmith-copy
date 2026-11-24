/* publication — T35 (T35-54): the published criteria (R72; N649, K1723, K1739, K2002). The waiting edition read
   `case-authoring` calls (was R74) and the row of a stop no publisher could check (was R33's C-122.5) moved with their
   tests to `publish-schedule` (its R7, R9; T41, K2438). `standards` and `entities` are stand-ins answering exactly the shapes of `standards.standardRead` (its R5),
   `standards.bindsAt` (its R43) and `entities.readEntity` (its R5); every call they receive is kept. A member's pinned
   bytes are written as a document bundle stating its `subject_entity` and `basis` legs, since R72 reads only the
   front matter at the pin (a real inquiry naming a standard would need the standard held for inquiry's own checks).
   R61's T35 clause and R73 are in `t33.test.mjs` and `door.test.mjs`. Driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { planeWorld as world, infoMd, V, SIG, NOW, MACHINE, absentStandard } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const CASE = "CASE-2026-0001";
const A = "STD-2026-0001-policy", B = "STD-2026-0002-standard", GONE = "STD-2026-0003-ordinance";
const CLERK = "ENT-2026-0001", BOARD = "ENT-2026-0002";
const c = (n) => String(n).repeat(32);
const C1 = c("a1"), C2 = c("b2"), C3 = c("c3"), C4 = c("d4"), C5 = c("e5"), CX = c("f9");
const DAY = NOW.slice(0, 10);

/* `standards`, as held: A a free policy whose text holds C1–C3, its `requires` C1 and C3 (C3's words not quoted); B a
   paywalled standard whose text holds C4 and C5, its `requires` C4. A binds the clerk; nothing else binds anybody. */
function standardsOf(held = null) {
  const calls = [];
  const table = held || {
    [A]: { designation: "AI 4.12", edition: "2024", issuer: "ENT-2026-0009", owner: { label: "Public Works" }, cite: "AI 4.12 §3",
           access: "free", texts: [C1, C2, C3], requires: [C1, C3], quoted: { [C1]: "Each request is logged." } },
    [B]: { designation: "NFPA 1710", edition: "2020 edition", issuer: "NFPA", owner: { label: "NFPA" }, cite: "NFPA 1710 (2020)",
           access: "paywalled", texts: [C4, C5], requires: [C4], quoted: { [C4]: "Turnout within 80 seconds." } },
  };
  const binding = { [`${A}|${CLERK}`]: "binds", [`${A}|${BOARD}`]: "benchmark", [`${B}|${CLERK}`]: "benchmark" };
  return {
    calls, table, binding,
    standardRead({ id, viewer }) {
      calls.push(["standardRead", id, viewer]);
      const s = table[id];
      if (s === "throw") throw new Error("down");
      if (!s) return absentStandard(id, viewer);
      return { ok: true, id, cite: s.cite, kind: "policy", issuer: s.issuer, designation: s.designation, edition: s.edition,
               access: s.access, owner: { issuer: s.issuer, label: s.owner.label }, requires: s.requires,
               texts: s.texts.map((t) => ({ content_id: t, standing: null, newer: null })),
               requires_quoted: s.requires.map((t) => ({ content_id: t, text: s.quoted[t] ?? null })), says: {} };
    },
    bindsAt({ standard, body, date, viewer }) {
      calls.push(["bindsAt", standard, body, date, viewer]);
      return { ok: true, standard, body, date, state: binding[`${standard}|${body}`] || "undetermined", why: "", rests_on: [] };
    },
  };
}
const ENTITIES = { [CLERK]: "City Clerk", [BOARD]: "Water Board" };
const entitiesOf = () => ({ readEntity: ({ entityId }) => (ENTITIES[entityId]
  ? { ok: true, found: true, entity: { entity_id: entityId, label: ENTITIES[entityId] } }
  : { ok: true, found: false, entity_id: entityId, entity: null }) });

/* A member: a document bundle whose pinned bytes state `subject` and `legs` ({target, portion?, content?}). */
function member(w, id, { subject = null, legs = [] } = {}) {
  const lines = [...(subject ? [`subject_entity: ${subject}`] : []), "basis:",
    ...legs.flatMap((l) => [`  - target: ${l.target}`, "    role: supports", ...(l.portion ? [`    target_portion: "${l.portion}"`] : []),
                            ...(l.content ? [`    content_id: ${l.content}`] : [])])];
  const r = w.promote(id, infoMd(id).replace("references: []", [...lines, "references: []"].join("\n")), "information");
  assert.equal(r.ok, true, JSON.stringify(r));
  return { target: id, version_sha: r.bundleSha };
}

function base({ standards = standardsOf() } = {}) {
  const w = world({ standards, entities: entitiesOf() });
  w.member("olive");
  const proj = w.project("Parks", "olive");
  w.doc("INFO-2026-0001-minutes");
  return { w, proj, standards };
}
const sign = (w, proj, roles, extra = {}) => {
  w.prepare(CASE, extra.edition ?? 1, { project: proj, roles, ...(extra.format ? { format: extra.format } : {}) });
  return w.signCase(CASE, extra.edition ?? 1, { project: proj, roster: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha })),
                                                ...(extra.signer !== undefined ? { signer: extra.signer } : {}) });
};

/* ---------------------------------------------------------------- R72 */

test("R72 at a case edition's commit the criteria are one row per distinct (standard, portion, body) a member's legs target at its pinned bytes, in member then leg order, read from standards as the signer on the commit's day: designation, edition, issuer, citation, access, body, binds, only the passages relied on, the label and the access words; R53 answers them, frozen", () => {
  const { w, proj, standards } = base();
  const roles = [
    member(w, "INFO-2026-0101-first", { subject: CLERK, legs: [
      { target: A, portion: "s.3", content: C1 },          /* a passage of A's text */
      { target: "INFO-2026-0001-minutes" },                /* not a standard: no row */
      { target: A, portion: "s.3", content: CX },          /* not among A's text: no passage */
      { target: A, portion: "s.3", content: C2 },          /* the same row, a second passage, its words not quoted */
      { target: B }] }),                                   /* no passage named: B's requires passages */
    member(w, "INFO-2026-0102-second", { subject: BOARD, legs: [
      { target: A, portion: "s.3", content: C1 },          /* the same portion, another body: its own row */
      { target: GONE, portion: "s.1" }] }),                /* a standard standards no longer answers */
    member(w, "INFO-2026-0103-third", { legs: [{ target: B, content: C4 }] }),   /* no body */
  ];
  const r = sign(w, proj, roles);
  assert.equal(r.ok, true, JSON.stringify(r));
  const criteria = w.p.caseEditionState(CASE, 1).criteria;
  const row = (o) => ({ standard: null, portion: null, designation: null, edition: null, issuer: null, citation: null, access: null,
                        body: null, binds: null, passages: null, label: null, access_words: null,
                        captures: o.stated ? null : [], ...o });   /* T37: the edition carries no material, so no capture */
  assert.deepEqual(criteria, [
    row({ standard: A, portion: "s.3", designation: "AI 4.12", edition: "2024", issuer: "Public Works", citation: "AI 4.12 §3",
          access: "free", body: CLERK, binds: true,
          passages: [{ content: C1, text: "Each request is logged." }, { content: C2, text: null }],
          label: word("standard.binding.binds", { body: "City Clerk" }), access_words: word("label.standardaccess.free") }),
    row({ standard: B, designation: "NFPA 1710", edition: "2020 edition", issuer: "NFPA", citation: "NFPA 1710 (2020)",
          access: "paywalled", body: CLERK, binds: false, passages: [{ content: C4, text: "Turnout within 80 seconds." }],
          label: word("standard.binding.benchmark", { body: "City Clerk" }), access_words: word("label.standardaccess.paywalled") }),
    row({ standard: A, portion: "s.3", designation: "AI 4.12", edition: "2024", issuer: "Public Works", citation: "AI 4.12 §3",
          access: "free", body: BOARD, binds: false, passages: [{ content: C1, text: "Each request is logged." }],
          label: word("standard.binding.benchmark", { body: "Water Board" }), access_words: word("label.standardaccess.free") }),
    row({ standard: GONE, portion: "s.1", stated: "not held" }),
    row({ standard: B, designation: "NFPA 1710", edition: "2020 edition", issuer: "NFPA", citation: "NFPA 1710 (2020)",
          access: "paywalled", body: null, binds: false, passages: [{ content: C4, text: "Turnout within 80 seconds." }],
          label: word("publication.label.benchmark_binding"), access_words: word("label.standardaccess.paywalled") }),
  ]);
  /* a paywalled standard carries nothing of its text but the passages relied on: its other text never reaches a row */
  assert.deepEqual(criteria.filter((x) => x.standard === B).map((x) => x.passages.map((q) => q.content)), [[C4], [C4]],
                   "C5, B's other text, is in no row");
  /* every read as the signer, on the commit's day; a body of null is never asked about */
  assert.ok(standards.calls.every((x) => (x[0] === "standardRead" ? x[2] : x[4]) === V("olive")), "the signer reads");
  assert.deepEqual(standards.calls.filter((x) => x[0] === "bindsAt").map((x) => [x[1], x[2], x[3]]),
                   [[A, CLERK, DAY], [B, CLERK, DAY], [A, BOARD, DAY]]);
  /* frozen with the edition: a later change to the standard reaches it only through a later edition */
  standards.binding[`${A}|${BOARD}`] = "binds";
  standards.table[A].edition = "2026";
  assert.deepEqual(w.p.caseEditionState(CASE, 1).criteria, criteria);
  assert.deepEqual(JSON.parse(w.row(`SELECT criteria FROM published_cases WHERE case_id=? AND edition=1`, CASE).criteria), criteria,
                   "held on the edition's published_cases row (R40)");
  const kept = w.snapshot(["published_cases"]);
  w.record.purge({});
  assert.deepEqual(w.snapshot(["published_cases"]), kept, "exempt from purge, as the row is");
  /* a retry of the signed edition writes nothing and reads no standard */
  const n = standards.calls.length, snap = w.snapshot();
  assert.equal(w.signCase(CASE, 1, { project: proj, roster: roles.map((x) => ({ bundle_id: x.target, version_sha: x.version_sha })) }).existed, true);
  assert.deepEqual([w.snapshot(), standards.calls.length], [snap, n]);
});

test("R72 (K2483, D54) a commit no member signs reads as a machine viewer, never the founder's `admin`; members targeting no standard give criteria []; a standards read that throws is a row stated not held and never refuses the commit; a refused commit records nothing; an edition committed before T35 answers criteria null, stated as not recorded, never filled", () => {
  const { w, proj, standards } = base({ standards: standardsOf({ [A]: "throw" }) });
  const roles = [member(w, "INFO-2026-0101-first", { subject: CLERK, legs: [{ target: A, content: C1 }] })];
  const r = sign(w, proj, roles, { signer: null });
  assert.equal(r.ok, true, JSON.stringify(r));
  assert.deepEqual(w.p.caseEditionState(CASE, 1).criteria, [{ standard: A, portion: null, designation: null, edition: null,
    issuer: null, citation: null, access: null, body: null, binds: null, passages: null, label: null, access_words: null,
    stated: "not held", captures: null }]);
  assert.deepEqual(standards.calls, [["standardRead", A, MACHINE]], "no member signs: a machine viewer reads");
  /* members whose legs name no standard */
  const plain = [member(w, "INFO-2026-0104-plain", { subject: CLERK, legs: [{ target: "INFO-2026-0001-minutes" }] })];
  w.prepare("CASE-2026-0002", 1, { project: proj, roles: plain });
  assert.equal(w.signCase("CASE-2026-0002", 1, { project: proj, roster: plain.map((x) => ({ bundle_id: x.target, version_sha: x.version_sha })) }).ok, true);
  const none = w.p.caseEditionState("CASE-2026-0002", 1);
  assert.deepEqual([none.criteria, "criteria_detail" in none], [[], false]);
  /* a refused commit (a pre-/6 preparation) reads no standard and records nothing */
  const { w: w2, proj: p2, standards: s2 } = base();
  const r2 = [member(w2, "INFO-2026-0101-first", { subject: CLERK, legs: [{ target: A, content: C1 }] })];
  assert.equal(sign(w2, p2, r2, { format: "bio-case-document/5" }).reason, "CASE_FORMAT_SUPERSEDED");
  assert.deepEqual([s2.calls, w2.count("published_cases")], [[], 0]);
  /* committed before T35: null, stated, and a later boot never fills it */
  w2.prepare(CASE, 2, { project: p2, roles: r2 });
  w2.signLegacy(CASE, 2, { project: p2, roster: r2.map((x) => ({ bundle_id: x.target, version_sha: x.version_sha })) });
  const old = w2.p.caseEditionState(CASE, 2);
  assert.equal(old.criteria, null);
  assert.match(old.criteria_detail, /not recorded/);
  w2.p.migrate();
  assert.equal(w2.p.caseEditionState(CASE, 2).criteria, null, "never filled");
  assert.deepEqual(s2.calls, [], "no standard read for an older edition");
});

/* ---------------------------------------------------------------- R75 (T36; N717, K2129) */

/* The roster of R72's first test: every kind of row (a binding standard with two passages, a benchmark by its requires
   passages, the same portion for another body, a standard no longer held, and a member stating no body). */
function everyKind(w) {
  return [
    member(w, "INFO-2026-0101-first", { subject: CLERK, legs: [{ target: A, portion: "s.3", content: C1 },
      { target: "INFO-2026-0001-minutes" }, { target: A, portion: "s.3", content: CX }, { target: A, portion: "s.3", content: C2 },
      { target: B }] }),
    member(w, "INFO-2026-0102-second", { subject: BOARD, legs: [{ target: A, portion: "s.3", content: C1 }, { target: GONE, portion: "s.1" }] }),
    member(w, "INFO-2026-0103-third", { legs: [{ target: B, content: C4 }] }),
  ];
}
const asMembers = (roles) => roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha }));

test("R75 criteriaFor answers {rows}, exactly the criteria R72's commit records for the same members, signer and UTC day: one row per distinct (standard, portion, body), binds, access, passages, label and access words, a standard no longer held stated not held; read as the signer on the day of `at`; it writes nothing", () => {
  const { w, proj, standards } = base();
  const roles = everyKind(w);
  const at = "2026-09-28T23:59:00Z";
  const before = w.snapshot();
  const pre = w.p.criteriaFor({ members: asMembers(roles), signer: "olive", at });
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
  assert.equal(pre.rows.length, 5);
  assert.deepEqual(standards.calls.filter((x) => x[0] === "bindsAt").map((x) => x[3]), [DAY, DAY, DAY], "the UTC day of `at`");
  assert.ok(standards.calls.every((x) => (x[0] === "standardRead" ? x[2] : x[4]) === V("olive")), "read as the signer");
  /* the commit by the same signer on the same day records exactly these rows */
  assert.equal(sign(w, proj, roles).ok, true);
  /* T37 (R72's `captures`): the commit adds each row's carried captures beside R75's row, which states none */
  const bare = (rows) => rows.map(({ captures, ...rest }) => rest);
  assert.ok(pre.rows.every((r) => !("captures" in r)));
  assert.deepEqual(bare(w.p.caseEditionState(CASE, 1).criteria), pre.rows, "a preparation and its commit cannot disagree");
  assert.deepEqual(Object.keys(pre), ["rows"]);
  /* a change in the record between them is the one way they differ: the read follows the record, the edition stays frozen */
  standards.binding[`${A}|${BOARD}`] = "binds";
  const later = w.p.criteriaFor({ members: asMembers(roles), signer: "olive", at });
  assert.deepEqual(later.rows.find((r) => r.body === BOARD && r.standard === A).binds, true);
  assert.deepEqual(bare(w.p.caseEditionState(CASE, 1).criteria), pre.rows);
  /* another day is read on that day */
  standards.calls.length = 0;
  w.p.criteriaFor({ members: asMembers(roles), signer: "olive", at: "2027-01-02T00:00:00Z" });
  assert.ok(standards.calls.filter((x) => x[0] === "bindsAt").every((x) => x[3] === "2027-01-02"));
});

test("R75 (K2483, D54) with no signer the reads are a machine viewer's, never the founder's `admin`; members targeting no standard answer rows []; a member whose bytes cannot be read contributes no row; a standards read that throws is a row stated not held; malformed arguments never throw", () => {
  const { w, standards } = base({ standards: standardsOf({ [A]: "throw" }) });
  const roles = [member(w, "INFO-2026-0101-first", { subject: CLERK, legs: [{ target: A, content: C1 }] })];
  const r = w.p.criteriaFor({ members: asMembers(roles), signer: null, at: NOW });
  assert.deepEqual(r.rows, [{ standard: A, portion: null, designation: null, edition: null, issuer: null, citation: null, access: null,
    body: null, binds: null, passages: null, label: null, access_words: null, stated: "not held" }]);
  assert.deepEqual(standards.calls, [["standardRead", A, MACHINE]], "no signer: a machine viewer reads");
  const plain = [member(w, "INFO-2026-0104-plain", { subject: CLERK, legs: [{ target: "INFO-2026-0001-minutes" }] })];
  assert.deepEqual(w.p.criteriaFor({ members: asMembers(plain), signer: "olive", at: NOW }), { rows: [] });
  /* unreadable bytes: a sha nobody holds, a bundle nobody holds, a member with no id; the readable member still answers */
  const { w: w2 } = base();
  const ok = everyKind(w2).slice(2);
  const unreadable = [{ bundle_id: ok[0].target, version_sha: "0".repeat(64) }, { bundle_id: "INFO-2026-0999-none", version_sha: null },
                      { version_sha: ok[0].version_sha }, null, "x"];
  const mixed = w2.p.criteriaFor({ members: [...unreadable, ...asMembers(ok)], signer: "olive", at: NOW });
  assert.deepEqual(mixed, w2.p.criteriaFor({ members: asMembers(ok), signer: "olive", at: NOW }));
  assert.equal(mixed.rows.length, 1);
  assert.deepEqual(w2.p.criteriaFor({ members: unreadable, signer: "olive", at: NOW }), { rows: [] });
  for (const bad of [undefined, null, {}, { members: "x" }, { members: [{}] }, 7])
    assert.deepEqual(w2.p.criteriaFor(bad), { rows: [] }, JSON.stringify(bad));
  /* a record that throws is no row and no throw */
  w2.record.textAtSha = () => { throw new Error("down"); };
  assert.deepEqual(w2.p.criteriaFor({ members: asMembers(ok), signer: "olive", at: NOW }), { rows: [] });
});

/* ---------------------------------------------------------------- K2483 (D54): an internal read is no founder's */

test("R72 R75 (K2483, D54) with no member signing, the criteria are read as a machine viewer, so a standard filed in a hidden project is still read (the founder's `admin` no longer sees it); a member's own read stays fenced: a signer outside the hidden project reads it as not held", () => {
  /* `standards`, a stand-in whose standard A is filed in a hidden project: answered only to a viewer membership R43 lets
     see that project (standards R37's sight), every other viewer as for an absent standard */
  let w;
  const held = standardsOf();
  const hidden = { ...held, calls: held.calls,
    standardRead(a) { return w.membership.inSight(HIDDEN, a.viewer) ? held.standardRead(a)
      : (held.calls.push(["standardRead", a.id, a.viewer]), absentStandard(a.id, a.viewer)); } };
  let HIDDEN;
  ({ w } = base({ standards: hidden }));
  w.member("ivy"); w.member("zed");
  HIDDEN = w.project("Filed", "ivy");
  assert.equal(w.membership.visibilityOf(HIDDEN), "hidden", "(fixture) hidden");
  assert.equal(w.membership.inSight(HIDDEN, "admin"), false, "(D54) the founder, in no project, does not see it");
  assert.equal(w.membership.inSight(HIDDEN, MACHINE), true, "(R43) a machine viewer does");
  const roles = [member(w, "INFO-2026-0101-first", { subject: CLERK, legs: [{ target: A, content: C1 }] })];
  const read = (signer) => w.p.criteriaFor({ members: asMembers(roles), signer, at: NOW }).rows[0];
  /* no signer: a machine viewer reads the standard */
  held.calls.length = 0;
  const machine = read(null);
  assert.equal(machine.stated, undefined, "held, read");
  assert.equal(machine.designation, "AI 4.12");
  assert.deepEqual(held.calls.filter((x) => x[0] === "standardRead"), [["standardRead", A, MACHINE]]);
  /* negative control: a member outside the hidden project signs; their own read is still fenced */
  held.calls.length = 0;
  assert.equal(read("zed").stated, "not held", "zed does not see the hidden project's standard");
  assert.deepEqual(held.calls.filter((x) => x[0] === "standardRead"), [["standardRead", A, V("zed")]]);
  /* and the commit records what R75 answers: with no signer, the machine viewer's row */
  assert.equal(sign(w, w.project("Parks2", "olive"), roles, { signer: null }).ok, true);
  assert.equal(w.p.caseEditionState(CASE, 1).criteria[0].designation, "AI 4.12");
});

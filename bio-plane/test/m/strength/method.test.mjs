/* The grading method and its recomputation (R31, R32; DEC-112 (2)(3)(6), Publication §5C "each grade recomputes the
   same by the stated method version"), with R33's and R34's arms as `recomputePair` reads them from a case file's facts.
   The round trip is driven against the live pair over the same legs: the facts a case file would state for each leg,
   recomputed with nothing else, give the same state and grade on every axis, the same member setting it. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { world, MACHINE } from "./fixture.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { GRADING_METHOD_VERSION, GRADING_METHOD_VERSIONS, gradingMethodText, recomputePair, STRENGTH_AXES,
         DEPTH_BOUND, PRODUCT_NAME } from "../../../src/strength/index.mjs";

const V = GRADING_METHOD_VERSION;
/* The version T28 published, before the calculation, standard and occurrence legs (R36–R38). */
const V1 = "bio-grading/1";
/* The version T33 published, with the word "group" for the team. */
const V2 = "bio-grading/2";
/* The version T51-54 published, with the word "team" for the group that holds the case. */
const V3 = "bio-grading/3";
/* The version T51 published (K4213), with a cutting leg kept out of the parts (R42). */
const V4 = "bio-grading/4";
const axesOf = (p) => STRENGTH_AXES.map((a) => [a, p[a].state, p[a].grade, p[a].weakest ? p[a].weakest.target_id : null]);

test("R31: GRADING_METHOD_VERSION names the method; gradingMethodText answers it in plain words, null for an unknown version, and never throws", () => {
  assert.equal(V, "bio-grading/5", "T53's typed-passage rule (R47) changed the method, so its version moved");
  assert.deepEqual([...GRADING_METHOD_VERSIONS], [V1, V2, V3, V4, V]);
  assert.ok(Object.isFrozen(GRADING_METHOD_VERSIONS));
  const text = gradingMethodText(V);
  assert.equal(typeof text, "string");
  assert.ok(text.includes(V), "the text names its version");
  /* Complete enough to recompute by hand: every rule of R1–R5, R29, R30, R33 and R34 is stated. */
  for (const [rule, re] of [
    ["two strengths, never combined (R18)", /never combined into one figure/],
    ["a leg counts for the strength its grade names (R1)", /counts only for the strength its grade names/],
    ["the capture ceiling (R1)", /capture grade is never above what the record holds/],
    ["testimony is D (R1)", /testimony grade is always D/],
    ["ungraded and hunch legs are inert (R3, R5)", /no grade, or one marked as a hunch, is listed and counts for nothing/],
    ["inquiry legs to six steps (R2)", /up to six steps down/],
    ["undetermined is unknown, not low (R2)", /unknown, not low/],
    ["another group's accepted edition (R33)", /strengths that accepted edition published for that finding, never more/],
    ["withdrawal changes nothing (R33)", /Withdrawing the acceptance later changes no grade/],
    ["unsorted legs: the weakest (R4)", /only\s+as strong as the weakest of them/],
    ["sets: the strongest (R4)", /the strongest set is what counts/],
    ["the weaker of the two parts (R4)", /the weaker of the legs needed by every set and that strongest set/],
    ["undetermined only when a needed part is (R4)", /undetermined only when something it needs is unknown/],
    ["unrated (R3)", /unrated, and says it rests on nothing established/],
    ["anonymous testimony and evidence need an independent leg (R29, R34)", /counts only when something independent beside it\s+bears it out/],
    ["what bears it out (R30, R12)", /shares no origin with it \(not the same document, not the same capture, not the same web address\)/],
    ["the hunch count (R5)", /how many hunches it left out/],
    ["a calculation: the weakest input capture (R36)", /at the\s+weakest of its inputs' capture strengths/],
    ["recipe arithmetic does not weaken (R36)", /arithmetic of the recipe never weakens it/],
    ["an unbound value is testimony (R36)", /typed in with no captured source is\s+testimony, D/],
    ["another program's value is unknown until measured (R36)", /unknown until that program's agreement has been measured/],
    ["the method disclosed, not graded (R36)", /method\s+is stated beside the grade and is not graded/],
    ["not accepted: undetermined (R36)", /not accepted, or an input\s+that cannot be read, makes the strength undetermined/],
    ["a held standard's text at its version (R37)", /held standard counts for the capture strength only, no stronger than the record holds for the text/],
    ["no text: undetermined (R37)", /holds no text at that version, the strength is undetermined/],
    ["an occurrence: the weaker of the rule's text and the trigger's record (R38)", /weaker of the text of the\s+rule in force and the record of the date that started it/],
    ["the occurrence's state never grades it (R38)", /met, late or overdue is stated beside\s+the grade and never changes it/],
    ["the cutting leg (R42)", /never counted toward its strength/],
    ["a typed passage: the typist's word, one step more once checked (R46, R47)", /the typist's word, D, or one step more, C, once a second member\s+has checked/],
  ]) assert.match(text, re, rule);
  assert.equal(text.split("\n").at(-1).slice(0, 4), "13. ", "what is named stays last");
  /* Version 1's words do not state the new legs: they are version 2's. */
  assert.doesNotMatch(gradingMethodText(V1), /calculation|held standard|obligation/);
  for (const bad of [undefined, null, "", "bio-grading/0", "bio-grading/6", 1, {}, [V], "toString", "__proto__"])
    assert.equal(gradingMethodText(bad), null, String(bad));
  assert.equal(gradingMethodText(V), text, "the same version always the same words");
});

/* R31 (DEC-124; K1365 (1)): the words `gradingMethodText(GRADING_METHOD_VERSION)` answered before T31, as SHA-256 of
   their UTF-8 bytes (3,085 characters, measured on `job/T31/strength` before the change). */
const PRE_T31_SHA256 = "85cac7dd2794e8d0970f7f9aa6846b61523775bb6a258597132d5b86c9e77c08";
const sha = (t) => createHash("sha256").update(t, "utf8").digest("hex");

test("R31: with \"CivicOS\" gradingMethodText answers byte for byte the text version 1 answered before T31; with no product it names Civicsmith; the name is the only difference, so either name states the same method", () => {
  const old = gradingMethodText(V1, "CivicOS");
  assert.equal(sha(old), PRE_T31_SHA256, "a bio-case-document/6 edition re-renders byte for byte");
  assert.equal(old.length, 3085);
  assert.equal(old.split("\n")[0], `How CivicOS grades a finding (method ${V1}).`);
  assert.equal(PRODUCT_NAME, "Civicsmith");
  const now = gradingMethodText(V);
  assert.equal(now.split("\n")[0], `How Civicsmith grades a finding (method ${V}).`);
  assert.equal(gradingMethodText(V, "Civicsmith"), now);
  /* A missing product, or one that is not a name, is read as "Civicsmith"; it never throws. */
  for (const missing of [undefined, null, "", "   ", 7, {}, ["CivicOS"], true])
    assert.equal(gradingMethodText(V, missing), now, String(missing));
  /* The name given is used as given, and is the only thing that differs: the method is the same. */
  assert.equal(gradingMethodText(V, "Another Name").split("\n")[0], `How Another Name grades a finding (method ${V}).`);
  const body = (t) => t.split("\n").slice(1).join("\n");
  for (const name of ["CivicOS", "Another Name", undefined]) assert.equal(body(gradingMethodText(V, name)), body(now), String(name));
  assert.notEqual(gradingMethodText(V1), old, "negative control: the two names render different words");
  assert.equal(gradingMethodText(V1, "Civicsmith").split("\n").slice(1).join("\n"), old.split("\n").slice(1).join("\n"));
  assert.notEqual(sha(now), PRE_T31_SHA256);
  /* An unknown version answers null whatever name is given. */
  for (const bad of [undefined, "bio-grading/6", "toString"]) {
    assert.equal(gradingMethodText(bad, "CivicOS"), null);
    assert.equal(gradingMethodText(bad, "Civicsmith"), null);
  }
});

/* T51-54: the words of versions 1 and 2, as SHA-256 of their UTF-8 bytes under each name, measured on `job/T51/strength`
   before version 3 was added. Version 3 is the only version whose words say "team". */
const PINNED_WORDS = [
  [V1, "CivicOS", "85cac7dd2794e8d0970f7f9aa6846b61523775bb6a258597132d5b86c9e77c08"],
  [V2, "CivicOS", "6b6dc9ce150a8056e64bb1e7d9a5613ce96649a7ea85278a4ab2dd3764e8a5e4"],
  [V2, "Civicsmith", "1890017737cf2b4e5455771894238bab3ada1a84eeb3b11775e09a2b8dd25420"],
  /* Version 4's words, measured on `job/strength` before version 5 was added (T53, R47). */
  [V4, "CivicOS", "4b7f2fa4acc803cb2c8f262363ce451efe97ac25d1e214ac04b48ea1ac183f49"],
  [V4, "Civicsmith", "cf146d07359a94c580a5526e8530976f6369e44762f7f0c64a9a9e36b5e05609"],
];
test("R31 (T51-54): versions 1 and 2 keep their words byte for byte; version 3 is version 2 with the team named \"team\" and nothing else changed", () => {
  for (const [version, product, hash] of PINNED_WORDS)
    assert.equal(sha(gradingMethodText(version, product)), hash, `${version} under ${product}`);
  const words3 = gradingMethodText(V3, "CivicOS");
  assert.equal(words3.split("\n")[0], `How CivicOS grades a finding (method ${V3}).`);
  assert.match(words3, /another team's case that this team has accepted/);
  assert.match(words3, /credited only to the team or the project/);
  assert.doesNotMatch(words3, /\bgroup\b/, "the words name the team, not the group");
  /* Put back the version 2 header and the word "group", and version 3 is version 2's words exactly. */
  const asV2 = words3.replace(`(method ${V3})`, `(method ${V2})`).replace(/\bteam\b/g, "group");
  assert.equal(asV2, gradingMethodText(V2, "CivicOS"));
  assert.notEqual(words3, gradingMethodText(V2, "CivicOS"), "negative control: the words did change");
});

test("R31 (T51; K4213): version 4 is version 3's words with the cutting-leg rule added as 11, and what is named is 12", () => {
  const words4 = gradingMethodText(V4, "CivicOS");
  assert.equal(words4.split("\n")[0], `How CivicOS grades a finding (method ${V4}).`);
  const rule = words4.match(/^11\. Legs that cut against the finding\..*$/m);
  assert.ok(rule, "rule 11 states the cutting-leg rule");
  assert.match(rule[0], /never counted toward its strength/);
  /* Take version 4's new rule out, renumber what is named back to 11, and version 3's words stand. */
  const asV3 = words4.replace(`(method ${V4})`, `(method ${V3})`).replace(`${rule[0]}\n`, "").replace(/^12\. /m, "11. ");
  assert.equal(asV3, gradingMethodText(V3, "CivicOS"));
  assert.notEqual(words4, gradingMethodText(V3, "CivicOS"), "negative control: the words did change");
});

test("R32: any version this module has not published is UNKNOWN_METHOD_VERSION, naming the versions it holds; it never throws on any input", () => {
  for (const version of [undefined, null, "", "bio-grading/6", 1, {}]) {
    const r = recomputePair({ legs: [], version });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "UNKNOWN_METHOD_VERSION", String(version));
    assert.deepEqual(r.versions, [V1, V2, V3, V4, V]);
  }
  assert.equal(recomputePair().reason, "UNKNOWN_METHOD_VERSION");
  for (const legs of [null, "x", [null, 1, "a", {}, { target: 5, grade: "Z", grade_axis: "nowhere" }], [{ kind: "inquiry", target: "INQ-1" }]]) {
    const r = recomputePair({ legs, version: V, levels: "nonsense" });
    assert.equal(r.ok, true, JSON.stringify(legs));
    for (const a of STRENGTH_AXES) assert.ok(["graded", "unrated", "undetermined"].includes(r[a].state));
  }
});

/* The facts a case file states for one leg of a live basis, as the record holds them at the act: the resolved grade, the
   axis, the source, the ground, and for a question its recorded answer. */
function factsOf(w, legs) {
  return legs.map((l) => {
    const kind = l.target_id.startsWith("INQ-") ? "inquiry" : "document";
    const own = { target: l.target_id, kind, role: l.role, grade: l.grade, grade_axis: l.grade_axis,
                  grade_source: l.grade_source, ground: l.ground };
    if (kind !== "inquiry") {
      const c = l.grade_axis === "capture" && w.ceilings.get(l.target_id);
      const g = c && c.grade && "ABCD".indexOf(l.grade) < "ABCD".indexOf(c.grade) ? c.grade : l.grade;
      return { ...own, grade: c && c.grade === null ? null : g };
    }
    const s = w.s.strengthOf(l.target_id);
    return { ...own, answer: Object.fromEntries(STRENGTH_AXES.map((a) => [a, s[a]])) };
  });
}

test("R32: from the facts a case file states, recomputePair gives the live pair's state, grade and setter on every axis, reading nothing else", () => {
  const w = world();
  w.ceilings.set("INFO-2026-0001-a", { grade: "C", why: "measured" });
  w.inquiry("INQ-2026-0002-a", [{ target: "INFO-2026-0009-a", grade: "B", axis: "connection", source: "resolution" }]);
  w.inquiry("INQ-2026-0008-a", [{ target: "INQ-2026-0007-a" }]);
  w.inquiry("INQ-2026-0007-a", [{ target: "INQ-2026-0008-a" }]);
  const shapes = {
    "one part": [{ target: "INFO-2026-0003-a", grade: "B", axis: "connection", source: "resolution" }],
    "capped capture, testimony read at D, a hunch, an ungraded leg": [
      { target: "INFO-2026-0001-a", grade: "A", axis: "capture", source: "capture" },
      { target: "INFO-2026-0004-a", grade: "B", axis: "testimony", source: "testimony" },
      { target: "INFO-2026-0005-a", grade: "A", axis: "connection", source: "hunch" },
      { target: "INFO-2026-0006-a" }],
    "sets of reasons and a needed leg": [
      { target: "INFO-2026-0003-a", grade: "A", axis: "connection", source: "resolution", ground: "P1" },
      { target: "INFO-2026-0004-a", grade: "C", axis: "connection", source: "resolution", ground: "P1" },
      { target: "INFO-2026-0005-a", grade: "B", axis: "connection", source: "resolution", ground: "P2" },
      { target: "INFO-2026-0006-a", grade: "C", axis: "connection", source: "resolution" }],
    "an inquiry leg's answer": [{ target: "INQ-2026-0002-a" }, { target: "INFO-2026-0003-a", grade: "A", axis: "connection", source: "resolution" }],
    "an undetermined inquiry beside a graded set": [
      { target: "INQ-2026-0008-a", ground: "P1" },
      { target: "INFO-2026-0003-a", grade: "C", axis: "connection", source: "resolution", ground: "P2" }],
    "an undetermined needed leg": [{ target: "INQ-2026-0008-a" }],
    "nothing": [],
  };
  let k = 10;
  for (const [name, legs] of Object.entries(shapes)) {
    const id = `INQ-2026-00${k++}-a`;
    w.inquiry(id, legs);
    const live = w.s.strengthOf(id);
    const facts = factsOf(w, w.basis.get(id));
    const before = JSON.stringify(facts);
    const r = recomputePair({ legs: facts, version: V });
    assert.equal(r.ok, true, name);
    assert.equal(r.version, V);
    assert.equal(r.depth_bound, DEPTH_BOUND);
    assert.deepEqual(axesOf(r), axesOf(live), name);
    assert.equal(r.hunches_left_out, live.hunches_left_out, name);
    assert.equal(JSON.stringify(facts), before, "reads its facts, never changes them");
    assert.deepEqual(recomputePair({ legs: facts, version: V }), r, "the same facts, the same answer");
  }
});

test("R32, R33: a leg on another group's finding recomputes from the accepted_work row's pair, named as another group's, never above it", () => {
  const ag = { group: "other-group", case: "CASE-1", edition: 2, finding: "INQ-2026-0500-a" };
  const ref = `imported:${"b".repeat(64)}/INQ-2026-0500-a`;
  const r = recomputePair({ version: V, legs: [
    { target: ref, kind: "imported", answer: { capture: "B", connection: { state: "graded", grade: "C" } }, another_groups: ag },
    { target: "INFO-2026-0001-a", kind: "document", grade: "A", grade_axis: "connection", grade_source: "resolution" }] });
  assert.equal(r.capture.grade, "B");
  assert.equal(r.connection.grade, "C");
  assert.equal(r.connection.weakest.target_id, ref);
  assert.deepEqual(r.connection.weakest.another_groups, ag);
  assert.equal(r.testimony.state, "unrated");
  /* With no answer stated: undetermined on every axis, said why. */
  const none = recomputePair({ version: V, legs: [{ target: ref, kind: "imported" }] });
  for (const a of STRENGTH_AXES) {
    assert.equal(none[a].state, "undetermined");
    assert.equal(none[a].undetermined_at[0].why, word("strength.stopped.case_file_states"));
  }
  /* The same as the live pair over the same leg. */
  const w = world();
  w.acceptedFinding(ref, 2, { pair: { capture: "B", connection: "C" }, ...ag, caseId: ag.case });
  w.inquiry("INQ-2026-0001-a", [{ target: ref, edition: 2 }]);
  const live = w.s.strengthOf("INQ-2026-0001-a");
  const rec = recomputePair({ version: V, legs: [{ target: ref, kind: "imported", answer: { capture: "B", connection: "C" }, another_groups: ag }] });
  assert.deepEqual(axesOf(rec), axesOf(live));
});

test("R32, R29, R34: given levels, recomputePair judges anonymous legs from the stated origins, captures and author keys; a fact not stated bears nothing out", () => {
  const obs = { target: "INFO-2026-0001-observation", kind: "observation", grade: "D", grade_axis: "testimony",
                grade_source: "testimony", origins: ["bundle:o", "capture:o"], origins_complete: true, author_key: "k1" };
  const doc = { target: "INFO-2026-0002-a", kind: "document", grade: "B", grade_axis: "connection", grade_source: "resolution",
                origins: ["bundle:d", "capture:d"], origins_complete: true };
  const levels = { "INFO-2026-0001-observation": "group" };
  assert.equal(recomputePair({ version: V, levels, legs: [obs] }).testimony.state, "unrated");
  assert.equal(recomputePair({ version: V, levels, legs: [obs, doc] }).testimony.grade, "D");
  assert.equal(recomputePair({ version: V, levels, legs: [obs, { ...doc, origins: ["capture:o"] }] }).testimony.state, "unrated", "a shared origin");
  assert.equal(recomputePair({ version: V, levels, legs: [obs, { ...doc, origins_complete: false }] }).testimony.state, "unrated", "an origin list cut short");
  assert.equal(recomputePair({ version: V, levels, legs: [obs, { ...doc, origins: undefined }] }).testimony.state, "unrated", "no origins stated");
  /* A named observation by another member's key bears it out; by the same key it does not. */
  const named = { ...obs, target: "INFO-2026-0003-observation", origins: ["bundle:n"], author_key: "k2" };
  const lv2 = { ...levels, "INFO-2026-0003-observation": "cover" };
  const anonInert = (r) => r.testimony.not_load_bearing.some((m) => m.target_id === obs.target && /credited anonymously/.test(m.why));
  assert.equal(anonInert(recomputePair({ version: V, levels: lv2, legs: [obs, named] })), false);
  assert.equal(anonInert(recomputePair({ version: V, levels: lv2, legs: [obs, { ...named, author_key: "k1" }] })), true);
  assert.equal(anonInert(recomputePair({ version: V, levels: lv2, legs: [obs, { ...named, author_key: undefined }] })), true, "no key stated");
  /* R34: a document whose stated capture is anonymous. */
  const knock = { ...doc, target: "INFO-2026-0004-a", origins: ["bundle:k", "capture:knock"], captures: ["knock"] };
  const lv3 = { knock: "project" };
  const alone = recomputePair({ version: V, levels: lv3, legs: [knock] });
  assert.equal(alone.connection.state, "unrated");
  assert.equal(alone.connection.not_load_bearing[0].why, word("strength.uncorroborated_evidence_why"));
  assert.equal(recomputePair({ version: V, levels: lv3, legs: [knock, doc] }).connection.grade, "B");
  assert.deepEqual(recomputePair({ version: V, levels: lv3, legs: [knock] }).levels, lv3);
});

/* R35's world: every arm the walk resolves against the record, in one basis. */
function rich() {
  const w = world();
  const REF = `imported:${"d".repeat(64)}/INQ-2026-0500-a`;
  w.acceptedFinding(REF, 2, { pair: { capture: "B", connection: "C" } });
  w.ceilings.set("INFO-2026-0001-a", { grade: "C", why: "measured" });
  w.ceilings.set("INFO-2026-0006-a", { grade: null, why: "unmeasured", undetermined_because: "unmeasured" });
  for (const id of ["INFO-2026-0001-a", "INFO-2026-0002-a", "INFO-2026-0003-a", "INFO-2026-0006-a"]) w.bundle(id);
  w.capture("knock", "INFO-2026-0003-a", "https://example.test/knock");
  w.capture("doc2", "INFO-2026-0002-a", "https://example.test/two");
  w.observation("INFO-2026-0004-observation", "member-ann");
  w.observation("INFO-2026-0005-observation", "member-bo");
  w.inquiry("INQ-2026-0002-a", [{ target: "INFO-2026-0002-a", grade: "B", axis: "connection", source: "resolution" }]);
  w.inquiry("INQ-2026-0001-a", [
    { target: "INFO-2026-0001-a", grade: "A", axis: "capture", source: "capture", ground: "P1" },
    { target: "INFO-2026-0006-a", grade: "B", axis: "capture", source: "capture", ground: "P1" },
    { target: "INFO-2026-0002-a", grade: "B", axis: "connection", source: "resolution", ground: "P1" },
    { target: "INFO-2026-0003-a", grade: "A", axis: "connection", source: "resolution", ground: "P2" },
    { target: "INFO-2026-0004-observation", grade: "D", axis: "testimony", source: "testimony", ground: "P2" },
    { target: "INFO-2026-0005-observation", grade: "D", axis: "testimony", source: "testimony", ground: "P2" },
    { target: "INFO-2026-0002-a", grade: "A", axis: "connection", source: "hunch", ground: "P2" },
    { target: "INQ-2026-0002-a", ground: "P1" },
    { target: REF, edition: 2, ground: "P2" },
  ], "ENT-1");
  return { w, REF };
}

test("R35: recomputePair over gradingFacts answers the pair strengthOf answers, with and without levels (R29, R34), every arm resolved from the record", () => {
  const { w, REF } = rich();
  for (const levels of [null, { "INFO-2026-0004-observation": "group", knock: "project", "INFO-2026-0005-observation": "cover" },
                        { "INFO-2026-0004-observation": "project", "INFO-2026-0005-observation": "group" }, { knock: "group" }]) {
    const live = w.s.strengthOf("INQ-2026-0001-a", { levels });
    const f = w.s.gradingFacts({ inquiry: "INQ-2026-0001-a", levels, viewer: MACHINE });
    assert.equal(f.ok, true, JSON.stringify(f).slice(0, 300));
    assert.equal(f.method, V);
    assert.equal(f.wrote, false);
    const r = recomputePair({ legs: JSON.parse(JSON.stringify(f.legs)), levels, version: f.method });
    assert.deepEqual(axesOf(r), axesOf(live), JSON.stringify(levels));
    for (const a of STRENGTH_AXES) assert.deepEqual(r[a].grounds?.map((g) => [g.ground, g.state, g.grade]),
                                                    live[a].grounds?.map((g) => [g.ground, g.state, g.grade]), a);
    assert.equal(r.hunches_left_out, live.hunches_left_out);
  }
  const f = w.s.gradingFacts({ inquiry: "INQ-2026-0001-a", viewer: MACHINE });
  const by = Object.fromEntries(f.legs.map((l, i) => [i, l]));
  assert.equal(by[0].grade, "C", "a capture letter under its ceiling");
  assert.equal(by[1].grade, null, "an undetermined ceiling: the leg claims nothing, as the walk counts it");
  assert.equal(by[4].kind, "observation");
  assert.deepEqual([by[4].author_key, by[5].author_key], ["a1", "a2"], "opaque, equal only for the same member");
  assert.ok(!JSON.stringify(f).includes("member-ann") && !JSON.stringify(f).includes("member-bo"), "never an account");
  assert.deepEqual(by[3].captures, ["knock"]);
  assert.equal(by[3].origins_complete, true);
  assert.ok(by[3].origins.includes("address:https://example.test/knock"));
  assert.equal(by[7].kind, "inquiry");
  assert.equal(by[7].answer.connection.grade, "B");
  assert.deepEqual([by[8].kind, by[8].target, by[8].target_edition, by[8].answer.connection], ["imported", REF, 2, "C"]);
  assert.equal(by[8].another_groups.case, "CASE-1");
});

test("R35: over a named version, recomputePair answers versionStrength's pair; refusals as R30's", () => {
  const { w } = rich();
  w.connection.set("ENT-1|INFO-2026-0002-a", "B");
  w.ceilings.set("INFO-2026-0009-a", { grade: "B", why: "held" });
  w.version("INQ-2026-0001-a", "v1", "accepted", [
    { target: "INFO-2026-0002-a", grade: "D", axis: "connection", source: "resolution", ground: "" },
    { target: "INFO-2026-0009-a", grade: "A", axis: "capture", source: "capture", ground: "" },
    { target: "INQ-2026-0002-a", ground: "" }]);
  const v = w.s.versionStrength({ id: "INQ-2026-0001-a", version: "v1", viewer: MACHINE });
  const f = w.s.gradingFacts({ inquiry: "INQ-2026-0001-a", version: "v1", viewer: MACHINE });
  assert.equal(f.version, "v1");
  assert.deepEqual(axesOf(recomputePair({ legs: f.legs, version: V })), axesOf(v.pair));
  const g = (a) => w.s.gradingFacts({ viewer: MACHINE, ...a });
  assert.equal(g({}).reason, "NO_ID");
  assert.deepEqual(g({ inquiry: "INQ-2026-0099-a" }), { ok: false, reason: "NO_SUCH_BUNDLE", target: "INQ-2026-0099-a" });
  assert.deepEqual(g({ inquiry: "INQ-2026-0001-a", viewer: "nobody" }), { ok: false, reason: "NO_SUCH_BUNDLE", target: "INQ-2026-0001-a" });
  assert.equal(g({ inquiry: "INFO-2026-0001-a" }).reason, "NOT_AN_INQUIRY");
  const nv = g({ inquiry: "INQ-2026-0001-a", version: "nope" });
  assert.deepEqual([nv.reason, nv.check], ["VERSION_STRENGTH_NO_SUCH_VERSION", "C-30.4"]);
});

test("R35: a leg the viewer may not see is withheld whole and out_of_view says so; it writes nothing", () => {
  const w = world();
  w.member("alice"); w.member("carol");
  w.bundle("INFO-2026-0001-a");
  w.project("PROJ-2026-0042-hid", ["alice"]);
  w.inquiry("INQ-2026-0001-a", [{ target: "INFO-2026-0001-a", grade: "B", axis: "connection", source: "resolution" },
                                { target: "PROJ-2026-0042-hid", grade: "C", axis: "connection", source: "resolution" }]);
  const dump = () => JSON.stringify(w.rows(`SELECT name FROM sqlite_master ORDER BY name`)) + JSON.stringify(w.rows(`SELECT * FROM bundles`));
  const before = dump();
  const carol = w.s.gradingFacts({ inquiry: "INQ-2026-0001-a", viewer: "member:carol" });
  assert.deepEqual(carol.legs.map((l) => l.target), ["INFO-2026-0001-a"]);
  assert.equal(carol.out_of_view, true);
  assert.ok(!JSON.stringify(carol).includes("PROJ-2026-0042-hid"));
  const alice = w.s.gradingFacts({ inquiry: "INQ-2026-0001-a", viewer: "member:alice" });
  assert.equal(alice.legs.length, 2);
  assert.equal(alice.out_of_view, undefined);
  assert.equal(dump(), before);
});

/* inquiry-grammar's test corpus: the documents, legs and registries every parity test drives, one per arm of the
   grammar and the documents it does not judge. `golden.json` beside it holds what the check catalogue answered for
   each, recorded once before the move (T19 layer 6, K585 (2), K640) by INQUIRY-GRAMMAR #1 on `job/T19/inquiry-grammar`
   with the catalogue as `tranche/T19` held it: the catalogue's `checkInquiryBasis`, `checkLegExtentGrammar`,
   `supersedesEdgeFindings`, `divisionDisclosureFindings`, `leadLegFindings` and `basisVersionFindings` over these cases,
   and record-grammar's `checkBundle` over each bundle with the catalogue's C-6.1, C-15.1 and C-2.8 `LEGACY_GRAMMARS`
   entries (and with none). The module's tests compare against it and never read the catalogue (rule 1). A case added
   or changed here needs its golden entry recorded the same way, from the catalogue as it stood before the move
   (branch `snapshot/pre-refactor-2026-09-25`, or `tranche/T19` before this job's merge). Re-pinned once since, at T35
   (INQUIRY-GRAMMAR #8; K1972): `content`'s C-2.8 `CONTENT_EXTENT_NO_PRODUCER` sentence reads "Nothing produces a dom
   address yet" (DEC-149's wording, T35-26), the only difference from the findings as recorded. */

const T0 = "2026-07-01T00:00:00Z";
export const INFO = "INFO-2026-0001-a", INFO2 = "INFO-2026-0002-b", INFO3 = "INFO-2026-0003-obs";
export const INQ = "INQ-2026-0003-c", PUB = "INQ-2026-0004-pub", SELF = "INQ-2026-0009-z";
export const PROJ = "PROJ-2026-0001-p";
const LEAD = "LEAD-2026-0101-abc123", THEME = "THEME-2026-0101-abc123";
const CID = "a".repeat(64);

/* ---- the restricted front-matter grammar, written (record-grammar R7, R8) ---- */
const scalar = (v) => {
  if (v === null) return "null";
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return `[${v.join(", ")}]`;
  const s = String(v);
  return s === "" || /[:#"'\[\]{},]|^\s|\s$|^(null|true|false|~|-?\d+(\.\d+)?)$/.test(s) ? JSON.stringify(s) : s;
};
function frontmatter(fields) {
  const lines = ["---"];
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue;
    if (Array.isArray(v) && v.length && v.every((x) => x && typeof x === "object" && !Array.isArray(x))) {
      lines.push(`${k}:`);
      for (const item of v) {
        Object.entries(item).filter(([, x]) => x !== undefined).forEach(([ik, iv], j) =>
          lines.push(`${j === 0 ? "  - " : "    "}${ik}: ${scalar(iv)}`));
      }
    } else if (Array.isArray(v) && v.length === 0) {
      lines.push(`${k}:`);
    } else if (v && typeof v === "object" && !Array.isArray(v)) {
      lines.push(`${k}:`);
      for (const [ik, iv] of Object.entries(v)) if (iv !== undefined) lines.push(`  ${ik}: ${scalar(iv)}`);
    } else lines.push(`${k}: ${scalar(v)}`);
  }
  lines.push("---");
  return lines.join("\n");
}

const INQ_BODY = "\n## Question\n\nIs it?\n\n## What It Rests On\n\n## Conclusion\n\n## What Would Falsify This\n\n"
  + "## Session Log\n\n## Review Notes\n";
const refsTo = (...ids) => ids.map((target) => ({ target, rel: "cites", status: "confirmed" }));

/** An inquiry's `bundle.md`: the core and inquiry fields, each over-ridable (`undefined` drops one). */
export function inquiryDoc(id, over = {}) {
  const legs = over.basis;
  const targets = Array.isArray(legs) ? [...new Set(legs.filter((l) => l && typeof l === "object" && typeof l.target === "string"
    && /^(INFO|INQ)-/.test(l.target)).map((l) => l.target))] : [];
  return frontmatter({ id, object_type: "inquiry", schema: "inquiry@1", title: "A question", current_state: "open",
    prior_state: null, created: T0, last_updated: T0, group: "test-group", surfaced_by: "human",
    references: targets.length ? refsTo(...targets) : undefined,
    recheck_triggers: [{ text: "when the audit lands", description: "the controller's audit is due" }],
    ...over }) + INQ_BODY;
}
const infoDoc = (id, over = {}) => frontmatter({ id, object_type: "information", schema: "information@1", title: "A report",
  current_state: "collected", prior_state: null, created: T0, last_updated: T0, group: "test-group",
  criticality: "supporting", source_status: "unchanged",
  source: { locator: "https://docs.example.org/report.pdf", authority: "publisher", retrieved: T0 },
  monitoring: { enabled: true, frequency: "weekly" }, ...over })
  + "\n## Summary\n\n## Provenance Notes\n\n## Session Log\n\n## Review Notes\n";
const projDoc = (id, over = {}) => frontmatter({ id, object_type: "project", schema: "project@1", title: "A project",
  current_state: "forming", prior_state: null, created: T0, last_updated: T0, group: "test-group", ...over })
  + "\n## Thesis Summary\n\n## Open Questions\n\n## Ruled Out\n\n## Session Log\n\n## Review Notes\n";

/* ---- the registries a real caller injects (record-grammar R39) ---- */
export const PUBLISHED = {
  [PUB]: { object_type: "inquiry", latest: 2, editions: {
    1: { edition: 1, capture: { state: "graded", grade: "B" }, connection: { state: "graded", grade: "C" },
         testimony: { state: "unrated" } },
    2: { edition: 2, capture: { state: "undetermined" }, connection: { state: "graded", grade: "B" } } } },
  [INFO2]: { object_type: "information", latest: 1, editions: { 1: { edition: 1 } } },
};
export const EARNED = {
  subject_entity: "ENT-2026-0001", subject_label: "The Port",
  earned: {
    connection: { [INFO]: { grade: "B", mode: "value", why: "resolved at B to the subject." } },
    capture: { [INFO]: { grade: "B", mode: "ceiling", why: "captured directly.", ceiling: "A is not reachable here." },
               [INFO2]: { grade: null, mode: "ceiling", why: "an unmeasured OCR engine read it." },
               [INFO3]: { grade: null, mode: "ceiling", undetermined_because: "CAPTURE_AXIS_AUTHORED", why: "authored." } },
    testimony: { [INFO3]: { grade: "D", why: "a member's own observation." } },
  },
};
const EARNED_NO_SUBJECT = { ...EARNED, subject_entity: null };

/* ---- legs: one per arm of the leg grammar (R4, R5) ---- */
const g = (grade, grade_axis, grade_source, more = {}) => ({ grade, grade_axis, grade_source, ...more });
export const LEG_CASES = {
  "clean": [{ target: INFO, role: "supports" }],
  "two-legs-one-target": [{ target: INFO, role: "supports" }, { target: INFO, role: "cuts_against" }],
  "leg-not-object": ["INFO-2026-0001-a", null, 7],
  "lead-target": [{ target: LEAD, role: "supports" }],
  "lead-content-id": [{ target: INFO, content_id: ` ${LEAD} `, role: "supports" }],
  "theme-target": [{ target: THEME, role: "supports" }],
  "theme-key": [{ target: INFO, role: "supports", theme: "maintenance" }],
  "bad-target": [{ target: "not-an-id", role: "supports" }, { target: 12, role: "supports" }, { role: "supports" }],
  "project-target": [{ target: PROJ, role: "supports" }],
  "not-referenced": [{ target: INFO, role: "supports" }],
  "inquiry-target": [{ target: INQ, role: "supports" }],
  "bad-role": [{ target: INFO, role: "maybe" }, { target: INFO }],
  "bad-vocab": [{ target: INFO, role: "supports", ...g("E", "smell", "guess") }],
  "graded-no-axis-source": [{ target: INFO, role: "supports", grade: "C" }],
  "capture-on-inquiry": [{ target: INQ, role: "supports", ...g("B", "capture", "capture") },
                         { target: INQ, role: "supports", ...g("B", "capture", "inherited") }],
  "testimony-on-inquiry": [{ target: INQ, role: "supports", ...g("D", "testimony", "testimony") }],
  "capture-authored": [{ target: INFO, role: "supports", ...g("B", "capture", "testimony") },
                       { target: INFO, role: "supports", ...g("B", "capture", "hunch", { author: "member:a", date: "2026-07-01" }) }],
  "hunch": [{ target: INFO, role: "supports", ...g("B", "connection", "hunch") },
            { target: INFO, role: "supports", ...g("B", "connection", "hunch", { author: " ", date: "July" }) },
            { target: INFO, role: "supports", ...g("A", "connection", "hunch", { author: "member:a", date: "2026-07-01" }) }],
  "testimony-not-d": [{ target: INFO, role: "supports", ...g("B", "connection", "testimony") }],
  "source-no-grade": [{ target: INFO, role: "supports", grade_source: "testimony" },
                      { target: INFO, role: "supports", grade_source: "resolution" },
                      { target: INFO, role: "supports", grade_source: "capture", grade: null }],
  "note": [{ target: INFO, role: "supports", note: 5 }, { target: INFO, role: "supports", note: "fine" }],
  "extent-dom": [{ target: INFO, role: "supports", extent_kind: "dom" }],
  "extent-unknown": [{ target: INFO, role: "supports", extent_kind: "pdf-pge", extent_page: 1 }],
  "extent-page": [{ target: INFO, role: "supports", extent_kind: "pdf-page", extent_page: 0 }],
  "content-id-bad": [{ target: INFO, role: "supports", content_id: "abc" }, { target: INFO, role: "supports", content_id: 9 }],
  "content-id-and-extent": [{ target: INFO, role: "supports", content_id: CID, extent_kind: "pdf-page", extent_page: 0 }],
  "content-id-ok": [{ target: INFO, role: "supports", content_id: CID }],
  "testimony-capture-graded": [{ target: INFO3, role: "supports", ...g("C", "capture", "capture") }],
  "testimony-axis-letter": [{ target: INFO3, role: "supports", ...g("C", "testimony", "testimony") }],
  "testimony-axis-source": [{ target: INFO3, role: "supports", ...g("D", "testimony", "resolution") }],
  "testimony-axis-ok": [{ target: INFO3, role: "supports", ...g("D", "testimony", "testimony") }],
  "testimony-not-authored": [{ target: INFO, role: "supports", ...g("D", "testimony", "testimony") }],
  "earned-wrong-axis": [{ target: INFO, role: "supports", ...g("B", "capture", "resolution") },
                        { target: INFO, role: "supports", ...g("B", "connection", "capture") }],
  "earned-resolution-inquiry": [{ target: INQ, role: "supports", ...g("B", "connection", "resolution") }],
  "earned-value": [{ target: INFO, role: "supports", ...g("B", "connection", "resolution") },
                   { target: INFO, role: "supports", ...g("A", "connection", "resolution") }],
  "earned-none": [{ target: INFO2, role: "supports", ...g("B", "connection", "resolution") },
                  { target: "INFO-2026-0099-none", role: "supports", ...g("C", "capture", "capture") }],
  "earned-ceiling": [{ target: INFO, role: "supports", ...g("A", "capture", "capture") },
                     { target: INFO, role: "supports", ...g("C", "capture", "capture") }],
  "earned-undetermined": [{ target: INFO2, role: "supports", ...g("C", "capture", "capture") }],
  "earned-authored-silent": [{ target: INFO3, role: "supports", ...g("D", "capture", "capture") }],
  "inherited-not-published": [{ target: INQ, role: "supports", ...g("C", "connection", "inherited", { target_edition: 1 }) }],
  "inherited-on-evidence": [{ target: INFO2, role: "supports", ...g("B", "capture", "inherited", { target_edition: 1 }) }],
  "published-ungraded": [{ target: PUB, role: "supports", grade_source: "inherited" }, { target: PUB, role: "supports" }],
  "published-own-grade": [{ target: PUB, role: "supports", ...g("C", "connection", "hunch", { author: "member:a", date: "2026-07-01" }) }],
  "inherited-no-edition": [{ target: PUB, role: "supports", ...g("C", "connection", "inherited") }],
  "inherited-no-such-edition": [{ target: PUB, role: "supports", ...g("C", "connection", "inherited", { target_edition: 3 }) }],
  "inherited-axis-state": [{ target: PUB, role: "supports", ...g("D", "testimony", "inherited", { target_edition: 1 }) },
                           { target: PUB, role: "supports", ...g("C", "capture", "inherited", { target_edition: 2 }) },
                           { target: PUB, role: "supports", ...g("C", "testimony", "inherited", { target_edition: 2 }) }],
  "inherited-stronger": [{ target: PUB, role: "supports", ...g("B", "connection", "inherited", { target_edition: 1 }) },
                         { target: PUB, role: "supports", ...g("C", "connection", "inherited", { target_edition: 1 }) }],
  "inherited-bad-axis": [{ target: PUB, role: "supports", ...g("C", "smell", "inherited", { target_edition: 1 }) }],
};

/* The registries each leg case runs under: `[publishedRegistry, earnedRegistry]`; every case also runs with both null. */
export const REGISTRY_VARIANTS = {
  both: [PUBLISHED, EARNED],
  nosubject: [PUBLISHED, EARNED_NO_SUBJECT],
  none: [null, null],
};

/* The front matter a leg case is judged in: its legs, and references to every well-formed target. */
export function legFm(name, legs) {
  const targets = [...new Set(legs.filter((l) => l && typeof l === "object" && typeof l.target === "string"
    && /^(INFO|INQ)-\d/.test(l.target)).map((l) => l.target))];
  return { id: SELF, object_type: "inquiry", references: name === "not-referenced" ? [] : refsTo(...targets), basis: legs };
}

/* ---- grounds (DEC-32): front matter beside the legs ---- */
const AT = "2026-07-01T00:00:00Z";
export const GROUND_CASES = {
  "no-basis-no-grounds": { basis: undefined },
  "no-basis-with-grounds": { basis: undefined, grounds: [{ ground: "a", asserted_by: "member:a", at: AT }] },
  "basis-not-array": { basis: "INFO-2026-0001-a" },
  "labels-no-block": { basis: [{ target: INFO, role: "supports", ground: "a" }, { target: INFO2, role: "supports", ground: "b" }] },
  "bad-label": { basis: [{ target: INFO, role: "supports", ground: "a:b" }], grounds: [] },
  "grounds-not-array": { basis: [{ target: INFO, role: "supports", ground: "a" }], grounds: "a" },
  "rows": { basis: [{ target: INFO, role: "supports", ground: "a" }, { target: INFO2, role: "supports", ground: "b" }],
            grounds: [{ ground: "a", asserted_by: "class:daemon", at: "yesterday", statement: 5 },
                      { ground: "a", asserted_by: "member:a", at: AT }, { ground: "c d", asserted_by: "member:a", at: AT },
                      { ground: "bad:label" }] },
  "row-not-object": { basis: [{ target: INFO, role: "supports", ground: "a" }], grounds: ["a"] },
  "partial": { basis: [{ target: INFO, role: "supports", ground: "a" }, { target: INFO2, role: "supports" }],
               grounds: [{ ground: "a", asserted_by: "member:a", at: AT, statement: "on its own" }] },
  "clean": { basis: [{ target: INFO, role: "supports", ground: "a" }, { target: INFO2, role: "supports", ground: "a" }],
             grounds: [{ ground: "a", asserted_by: "member:a", at: AT }] },
};

/* ---- supersession and the division disclosure (C-6.1) ---- */
export const SUPERSEDE_CASES = {
  "none": { id: SELF, object_type: "inquiry" },
  "edge-no-reason": { id: SELF, object_type: "inquiry", references: [{ target: INQ, rel: "supersedes" }],
                      division_parent: INQ, division_siblings: ["INQ-2026-0011-b"] },
  "edge-bad-target": { id: SELF, object_type: "inquiry", references: [{ target: "INQ-1", rel: "supersedes", reason: "x" }] },
  "edge-no-parent": { id: SELF, object_type: "inquiry", references: [{ target: INQ, rel: "supersedes", reason: "x" }] },
  "parent-no-edge": { id: SELF, object_type: "inquiry", division_parent: INQ, division_siblings: ["INQ-2026-0011-b"] },
  "parent-null-string": { id: SELF, object_type: "inquiry", division_parent: "null" },
  "no-siblings": { id: SELF, object_type: "inquiry", references: [{ target: INQ, rel: "supersedes", reason: "x" }], division_parent: INQ },
  "empty-siblings": { id: SELF, object_type: "inquiry", references: [{ target: INQ, rel: "supersedes", reason: "x" }],
                      division_parent: INQ, division_siblings: [] },
  "bad-siblings": { id: SELF, object_type: "inquiry", references: [{ target: INQ, rel: "supersedes", reason: "x" }],
                    division_parent: INQ, division_siblings: ["nope", INQ, SELF, "INQ-2026-0011-b"] },
  "clean": { id: SELF, object_type: "inquiry", references: [{ target: INQ, rel: "supersedes", reason: "x" }],
             division_parent: INQ, division_siblings: ["INQ-2026-0011-b"] },
  "info-supersedes-info": { id: INFO, object_type: "information", references: [{ target: INFO2, rel: "supersedes" }] },
  "problem-alias": { id: "PROB-2026-0001-q", object_type: "problem", references: [{ target: "FOCUS-2026-0001-f", rel: "supersedes", reason: "x" }] },
  "refs-not-list": { id: SELF, object_type: "inquiry", references: "INQ-2026-0003-c", division_parent: INQ },
  "no-fm": null,
};

/* ---- whole bundles, judged by record-grammar's `checkBundle` (R1–R3, R6) ---- */
const div = (over = {}) => ({ reason: "two questions", apportioned_by: "member:alice", at: AT,
  into: ["INQ-2026-0010-a", "INQ-2026-0011-b"], ...over });
const twoLegs = [{ target: INFO, role: "supports" }, { target: INFO2, role: "cuts_against" }];
const rows = [{ ord: 0, target: INFO, role: "supports", to: "INQ-2026-0010-a" },
              { ord: 1, target: INFO2, role: "cuts_against", to: "INQ-2026-0011-b" }];
const concluded = (over) => ({ current_state: "concluded", prior_state: "open", conclusion: "it is", falsifier: "a ledger",
  basis: [{ target: INFO, role: "supports" }], ...over });
const VERSIONS = { basis_versions: [{ name: "first", relationship: "and", state: "suggested" }],
  basis_version_legs: [{ version: "first", target: INFO, role: "supports" }] };

export const BUNDLE_CASES = {
  "INQ-2026-0100-clean": {},
  "INQ-2026-0101-surfacedby": { surfaced_by: "robot" },
  "INQ-2026-0102-deferred": { current_state: "deferred", prior_state: "open", disposition_reason: "" },
  "INQ-2026-0103-dismissed": { current_state: "dismissed", prior_state: "open" },
  "INQ-2026-0104-concluded": concluded({}),
  "INQ-2026-0105-noconclusion": concluded({ conclusion: "" }),
  "INQ-2026-0106-nofalsifier": concluded({ falsifier: "" }),
  "INQ-2026-0107-halfoverride": concluded({ falsifier: "", falsifier_override_by: "member:alice" }),
  "INQ-2026-0108-halfoverride-at": concluded({ falsifier: undefined, falsifier_override_at: AT }),
  "INQ-2026-0109-override": concluded({ falsifier: "", falsifier_override_by: "member:alice", falsifier_override_at: AT }),
  "INQ-2026-0110-both": concluded({ falsifier_override_by: "member:alice", falsifier_override_at: AT }),
  "INQ-2026-0111-nolegs": concluded({ basis: undefined }),
  "INQ-2026-0112-casefields": { case_id: "CASE-1", case_edition: 2, bias_acknowledgement: "null", required_strength: "" },
  "INQ-2026-0113-subject": { subject_entity: "ENT-26-1" },
  "INQ-2026-0114-subject-ok": { subject_entity: "ENT-2026-0001", basis: [{ target: INFO, role: "supports", grade: "B", grade_axis: "connection", grade_source: "resolution" }] },
  "INQ-2026-0115-divided-noblock": { current_state: "divided", prior_state: "open", basis: twoLegs },
  "INQ-2026-0116-divided": { current_state: "divided", prior_state: "open", basis: twoLegs, division: div(), division_apportionment: rows },
  "INQ-2026-0117-divided-bad": { current_state: "divided", prior_state: "open", basis: twoLegs,
    division: div({ reason: "", apportioned_by: "class:daemon", at: "today", into: ["INQ-2026-0010-a", "INQ-2026-0010-a", "x"] }) },
  "INQ-2026-0118-divided-one": { current_state: "divided", prior_state: "open", basis: twoLegs, division: div({ into: "INQ-2026-0010-a" }),
    division_apportionment: rows },
  "INQ-2026-0119-divided-rows": { current_state: "divided", prior_state: "open",
    basis: [...twoLegs, { target: INFO, role: "cuts_against" }], division: div({ into: ["INQ-2026-0010-a", "INQ-2026-0011-b", "INQ-2026-0012-c"] }),
    division_apportionment: [{ ord: 0, target: INFO2, to: "INQ-2026-0010-a" }, { ord: 7, to: "INQ-2026-0010-a" },
                             { ord: 1, to: "INQ-2026-0099-z" }, { ord: 0, to: "INQ-2026-0011-b" }] },
  "INQ-2026-0120-divided-norows": { current_state: "divided", prior_state: "open", basis: twoLegs, division: div({ apportioned_by: "" }) },
  "INQ-2026-0121-recheck-none": { recheck_triggers: undefined },
  "INQ-2026-0122-recheck-empty": { recheck_triggers: [] },
  "INQ-2026-0123-recheck-bad": { recheck_triggers: [{ text: "x" }, { text: "x", description: "y", date: "July" },
                                                   { text: "x", description: "y", date: "2026-07-01" }] },
  "INQ-2026-0124-recheck-scalar": { recheck_triggers: "soon", current_state: "dismissed", prior_state: "open", disposition_reason: "settled" },
  "INQ-2026-0125-supersedes": { references: [...refsTo(INFO), { target: INQ, rel: "supersedes" }], basis: [{ target: INFO, role: "supports" }],
                                division_siblings: [SELF] },
  "INQ-2026-0126-legs": { basis: [{ target: LEAD, role: "supports" }, { target: THEME, role: "supports" }, { target: "x", role: "y" },
                                  { target: INFO, role: "supports", extent_kind: "dom" }, { target: INFO, role: "supports", grade: "B" }] },
  "INQ-2026-0127-grounds": { basis: [{ target: INFO, role: "supports", ground: "a" }, { target: INFO2, role: "supports" }],
                             grounds: [{ ground: "b", asserted_by: "class:daemon", at: "x" }] },
  "INQ-2026-0128-earned": { subject_entity: "ENT-2026-0001",
    basis: [{ target: INFO, role: "supports", grade: "A", grade_axis: "connection", grade_source: "resolution" },
            { target: PUB, role: "supports", grade: "B", grade_axis: "connection", grade_source: "inherited", target_edition: 1 },
            { target: INFO3, role: "supports", grade: "C", grade_axis: "testimony", grade_source: "testimony" }] },
  "INQ-2026-0129-versions": { ...VERSIONS },
  "INQ-2026-0130-versions-entry": { surfaced_by: "robot", subject_entity: "nope", ...VERSIONS,
                                    basis: [{ target: INFO, role: "maybe", ground: "a" }] },
  "INQ-2026-0131-versions-bad": { basis_versions: [{ name: "", relationship: "xor" }], basis_version_legs: [{ version: "zz", target: LEAD }] },
  /* R19 (T51; N1216): a version name outside the form (65 characters) is VERSION_NAME_MALFORMED, not a duplicate; a name
     another version of the question already carries is VERSION_NAME_NOT_UNIQUE, and a valid unique name (0129) neither. */
  "INQ-2026-0133-version-name-long": { basis_versions: [{ name: "n".repeat(65), relationship: "and", state: "suggested" }],
    basis_version_legs: [{ version: "n".repeat(65), target: INFO, role: "supports" }] },
  "INQ-2026-0134-version-name-twice": { basis_versions: [{ name: "first", relationship: "and", state: "suggested" },
    { name: "first", relationship: "and", state: "suggested" }],
    basis_version_legs: [{ version: "first", target: INFO, role: "supports" }] },
  "INQ-2026-0132-unreferenced": { references: refsTo(INFO2), basis: [{ target: INFO, role: "supports" }, { target: INFO2, role: "supports" }] },
  "PROB-2026-0001-legacy-type": { object_type: "problem", schema: "problem@1", current_state: "surfaced", surfaced_by: "agent" },
  [INFO]: "info",
  "INFO-2026-0005-supersedes": "info-supersedes",
  [PROJ]: "project",
};

/* ---- legs on another group's finding (R11; N522): new at T28, so no golden entry; their tests state findings by hand ---- */
export const IMPORT = "f".repeat(64);
export const REF = `imported:${IMPORT}/INQ-2026-0042-src`;
export const IMPORTED_BUNDLE_CASES = {
  "INQ-2026-0200-imported-clean": { current_state: "concluded", prior_state: "open", conclusion: "it is", falsifier: "a ledger",
    references: refsTo(INFO), basis: [{ target: REF, role: "supports", target_edition: 2 }, { target: INFO, role: "cuts_against" }] },
  "INQ-2026-0201-imported-bad": { references: [...refsTo(INFO), { target: REF, rel: "cites", status: "confirmed" }],
    basis: [{ target: REF, role: "maybe", grade: "B", grade_axis: "connection", grade_source: "inherited", content_id: CID }] },
};

/** The files of a bundle case. */
export function bundleFiles(id) {
  const c = BUNDLE_CASES[id] ?? IMPORTED_BUNDLE_CASES[id];
  if (c === "info") return new Map([["bundle.md", infoDoc(id)]]);
  if (c === "info-supersedes") return new Map([["bundle.md", infoDoc(id, { references: [{ target: INFO2, rel: "supersedes" }] })]]);
  if (c === "project") return new Map([["bundle.md", projDoc(id, { surfaced_by: "robot", recheck_triggers: undefined })]]);
  return new Map([["bundle.md", inquiryDoc(id, c)]]);
}

/* ---- the lead checker's own cases (R5) ---- */
export const LEAD_LEG_CASES = {
  "target": { target: LEAD }, "target-spaced": { target: `  ${LEAD}  ` }, "content-id": { target: INFO, content_id: LEAD },
  "both": { target: LEAD, content_id: LEAD }, "near": { target: "LEAD-2026-01-abc" }, "upper": { target: "LEAD-2026-0101-ABC" },
  "number": { target: 5 }, "null": null, "string": LEAD, "array": [LEAD], "info": { target: INFO }, "empty": {},
};

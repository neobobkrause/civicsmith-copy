/* case-grammar at its interface: R2, the attribution run's spelling, and R3, the sections a later act re-authors and
   where each is in a document's lines. Copied from publication's `attribution` and `casedoc` suites' renderer and
   `REAUTHORABLE_SECTIONS` arms (K651), driven on the bytes alone. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { ATTRIBUTION_LEVELS, ATTRIBUTION_PROSE_HEAD, attributionFrontmatterLines, attributionBodyLines, fmSafe,
         SECTIONS, REAUTHORABLE_SECTIONS, materialsLines, materialAttestationLines, SENTENCES } from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const WHY = "WHY";
const OBS = "INFO-2026-0099-observation";
const OBS2 = "INFO-2026-0098-observation";

test("R2 the attribution levels, most protective first, and the prose head", () => {
  assert.deepEqual([...ATTRIBUTION_LEVELS], ["group", "project", "cover", "name"]);
  assert.equal(Object.isFrozen(ATTRIBUTION_LEVELS), true);
  assert.equal(ATTRIBUTION_PROSE_HEAD, "## Whose Words These Are");
});

test("R2 fmSafe writes a value on one front-matter line: line breaks folded to a space, double quotes and backslashes made apostrophes, trimmed", () => {
  assert.equal(fmSafe('He said "x"'), "He said 'x'");
  assert.equal(fmSafe("a\\b"), "a'b");
  assert.equal(fmSafe("one\r\ntwo\n\nthree\rfour"), "one two three four");
  assert.equal(fmSafe("  padded \n"), "padded");
  assert.equal(fmSafe(null), "");
  assert.equal(fmSafe(undefined), "");
  assert.equal(fmSafe(7), "7");
});

test("R2 attributionFrontmatterLines: the run observation_attributions: with each row's observation, level (null when none), shown (quoted, or null) and chosen_at_edition", () => {
  assert.deepEqual(attributionFrontmatterLines([{ observation: OBS, level: "name", shown: 'He said "x"\nthen', chosen_at_edition: 2 },
                                                { observation: OBS2, level: null, shown: null, chosen_at_edition: null, why: "w" }]),
    ["observation_attributions:",
     `  - observation: ${OBS}`, "    level: name", "    shown: \"He said 'x' then\"", "    chosen_at_edition: 2",
     `  - observation: ${OBS2}`, "    level: null", "    shown: null", "    chosen_at_edition: null"]);
  assert.deepEqual(attributionFrontmatterLines([{ observation: OBS }]),
    ["observation_attributions:", `  - observation: ${OBS}`, "    level: null", "    shown: null", "    chosen_at_edition: null"]);
  assert.deepEqual(attributionFrontmatterLines([]), ["observation_attributions:"]);
  for (const odd of [null, undefined, 7, "x", {}, [null, 7]])
    assert.deepEqual(attributionFrontmatterLines(odd), ["observation_attributions:"], "never throws");
});

test("R2 attributionBodyLines: the head, the count of firsthand observations, the sentence that each is its member's own choice for this edition, and one line per observation, a missing level stated with why and that the edition cannot be signed", () => {
  const rows = [
    { observation: OBS, level: "group", shown: "test-group", chosen_at_edition: 1 },
    { observation: "INFO-2026-0097-o", level: "project", shown: "Parks", chosen_at_edition: 1 },
    { observation: "INFO-2026-0096-o", level: "cover", shown: "heron", chosen_at_edition: 2 },
    { observation: "INFO-2026-0095-o", level: "name", shown: "olive", chosen_at_edition: 3 },
    { observation: "INFO-2026-0094-o", level: "group", shown: null, chosen_at_edition: 1 },
    { observation: OBS2, level: null, why: WHY },
  ];
  const lines = attributionBodyLines(rows, "bio-case-document/7");
  assert.equal(lines[0], ATTRIBUTION_PROSE_HEAD);
  assert.equal(lines[1], "");
  assert.match(lines[2], /^This case rests, directly or through another finding, on 6 firsthand observations recorded by a member of this group\./);
  assert.match(lines[2], /What it shows of who SAID each one is that member's own choice, made for this edition and never filled in for them/);
  assert.equal(lines[3], "");
  assert.deepEqual(lines.slice(4), [
    `- **${OBS}** — attributed to the group that publishes this case: test-group — level \`group\`, chosen at edition 1.`,
    "- **INFO-2026-0097-o** — attributed to the project that produced it: Parks — level `project`, chosen at edition 1.",
    "- **INFO-2026-0096-o** — attributed to the cover the group knows its author by: heron — level `cover`, chosen at edition 2.",
    "- **INFO-2026-0095-o** — attributed to the name its author chose to appear under: olive — level `name`, chosen at edition 3.",
    "- **INFO-2026-0094-o** — attributed to the group that publishes this case (this record names no producing group, so none "
      + "is printed) — level `group`, chosen at edition 1.",
    SENTENCES.noLevel(OBS2, WHY),
    ""]);
  assert.match(attributionBodyLines([rows[0]])[2], / on 1 firsthand observation recorded /, "singular for one");
  for (const odd of [null, undefined, 7, {}, [null]])
    assert.match(attributionBodyLines(odd)[2], / on 0 firsthand observations /, "never throws");
});

/* A document with both sections, as case-authoring writes it (publication's fixture `caseDoc` with `ack` and
   `attributions`). */
const DOC = ["---", "format: bio-case-document/5", "case_id: CASE-2026-0001", "completeness:", "  author: member:olive",
  "  statement_sha: abc", "  acknowledged: 0", "completeness_excluded:", ...attributionFrontmatterLines([{ observation: OBS }]),
  "case_citations: []", "---", "", "## Scope", "", "The question.", "", "**Who else read this statement.** Nobody yet.", "",
  ...attributionBodyLines([{ observation: OBS, level: null, why: "none" }]), "## What This Excludes", "", "Nothing.", "",
  "## What Was Searched", "", "Everything.", ""];
const at = (s) => DOC.indexOf(s);

test("R3 the re-authorable sections are attribution, acknowledgements and attestations, each located as a front-matter run and a prose run", () => {
  assert.deepEqual([...REAUTHORABLE_SECTIONS], ["attribution", "acknowledgements", "attestations"]);
  assert.deepEqual(Object.keys(SECTIONS), [...REAUTHORABLE_SECTIONS]);
  assert.equal(Object.isFrozen(SECTIONS), true);
  assert.equal(Object.isFrozen(REAUTHORABLE_SECTIONS), true);
  /* attribution: `observation_attributions:` to the next top-level key; R2's head to the next `## ` heading */
  assert.deepEqual(SECTIONS.attribution(DOC), { f0: at("observation_attributions:"), f1: at("case_citations: []"),
                                                b0: at(ATTRIBUTION_PROSE_HEAD), b1: at("## What This Excludes") });
  /* acknowledgements: from `  statement_sha: ` to `completeness_excluded:`, and from the Who-else line to the blank
     line before `## What Was Searched` */
  assert.deepEqual(SECTIONS.acknowledgements(DOC), { f0: at("  statement_sha: abc"), f1: at("completeness_excluded:"),
    b0: at("**Who else read this statement.** Nobody yet."), b1: at("## What Was Searched") - 1 });
  assert.equal(DOC[SECTIONS.acknowledgements(DOC).b1], "");
  /* splicing each run leaves the rest of the document as it was */
  const { f0, f1, b0, b1 } = SECTIONS.attribution(DOC);
  const spliced = [...DOC.slice(0, f0), "observation_attributions:", "  - observation: X", ...DOC.slice(f1, b0),
                   ATTRIBUTION_PROSE_HEAD, "", "new", "", ...DOC.slice(b1)];
  assert.deepEqual(SECTIONS.attribution(spliced), { f0, f1: f0 + 2, b0: b0 - 3, b1: b0 + 1 });
});

test("R3 a document carrying no such run answers null for it, and a locator never throws", () => {
  const without = (drop) => DOC.filter((l) => !drop.some((d) => l.startsWith(d)));
  assert.equal(SECTIONS.attribution(without(["observation_attributions:"])), null, "no front-matter run");
  assert.equal(SECTIONS.attribution(without([ATTRIBUTION_PROSE_HEAD])), null, "no prose run");
  assert.equal(SECTIONS.attribution(DOC.slice(0, at("## What This Excludes"))), null, "a prose run no heading closes");
  assert.equal(SECTIONS.acknowledgements(without(["  statement_sha: "])), null);
  assert.equal(SECTIONS.acknowledgements(without(["completeness_excluded:"])), null);
  assert.equal(SECTIONS.acknowledgements(without([SENTENCES.whoElse])), null);
  assert.equal(SECTIONS.acknowledgements(without(["## What Was Searched"])), null);
  for (const odd of [null, undefined, 7, "text", {}, [], [null, 7]])
    for (const s of REAUTHORABLE_SECTIONS) assert.equal(SECTIONS[s](odd), null);
});

test("R2 K1315 an off-the-record capture's attesting member is a row keyed capture, the capture's SHA-256, in place of observation, in both renderings", () => {
  const CAP = "a".repeat(64);
  assert.deepEqual(attributionFrontmatterLines([{ capture: CAP, level: "group", shown: "g", chosen_at_edition: 2 },
                                                { observation: OBS, capture: CAP, level: null }]),
    ["observation_attributions:", `  - capture: ${CAP}`, "    level: group", '    shown: "g"', "    chosen_at_edition: 2",
     `  - observation: ${OBS}`, "    level: null", "    shown: null", "    chosen_at_edition: null"],
    "an observation keeps its key; a capture takes it only in the observation's place");
  const fm = parseFrontmatter(["---", "format: bio-case-document/6", ...attributionFrontmatterLines([{ capture: CAP, level: "name", shown: "olive", chosen_at_edition: 1 }]), "---", ""].join("\n"));
  assert.deepEqual([fm.findings, fm.data.observation_attributions], [[], [{ capture: CAP, level: "name", shown: "olive", chosen_at_edition: 1 }]]);
  const body = attributionBodyLines([{ capture: CAP, level: "name", shown: "olive", chosen_at_edition: 1 }, { capture: CAP, level: null, why: "not chosen" }]);
  assert.equal(body[4], `- **${CAP}** — attributed to the name its author chose to appear under: olive — level \`name\`, chosen at edition 1.`);
  assert.equal(body[5], SENTENCES.noLevel(CAP, "not chosen"));
});

test("R3 K1317 attestations: from material_attestations: to the next top-level key, with no prose run, so re-writing it leaves every other line as it was", () => {
  const rows = [{ ref: "INFO-2026-0001-m", by_kind: "member", level: null, at: "2026-10-01T00:00:00Z" },
                { ref: "INFO-2026-0001-m", by_kind: "group", by: "lakeshore-tenants" }];
  const lines = ["---", "format: bio-case-document/6", ...materialsLines([{ ref: "INFO-2026-0001-m", kind: "document" }]),
                 ...materialAttestationLines(rows), "case_citations: []", "---", "", "## Scope", "", "x", ""];
  const f0 = lines.indexOf("material_attestations:");
  const at = SECTIONS.attestations(lines);
  assert.deepEqual(at, { f0, f1: lines.indexOf("case_citations: []"), b0: lines.length, b1: lines.length });
  /* the member chooses name: the run is re-written whole by the one writer, and nothing else moves */
  const chosen = materialAttestationLines([{ ...rows[0], level: "name", by: "member:olive", signature: "SIG" }, rows[1]]);
  const spliced = [...lines.slice(0, at.f0), ...chosen, ...lines.slice(at.f1, at.b0), ...lines.slice(at.b1)];
  assert.deepEqual(spliced.filter((l, i) => i < at.f0 || i >= at.f0 + chosen.length),
                   lines.filter((l, i) => i < at.f0 || i >= at.f1));
  assert.deepEqual(parseFrontmatter(spliced.join("\n")).data.material_attestations[0],
                   { ref: "INFO-2026-0001-m", by_kind: "member", by: "member:olive", level: "name", at: "2026-10-01T00:00:00Z",
                     signature: "SIG", recorded_in: null });
  /* an empty block is located too, and a document without it answers null */
  const empty = ["---", ...materialAttestationLines([]), "x: 1", "---"];
  assert.deepEqual(SECTIONS.attestations(empty), { f0: 1, f1: 2, b0: 4, b1: 4 });
  assert.equal(SECTIONS.attestations(lines.filter((l) => !l.startsWith("material_attestations"))), null);
  for (const odd of [null, undefined, 7, "x", {}, [null]]) assert.equal(SECTIONS.attestations(odd), null);
});

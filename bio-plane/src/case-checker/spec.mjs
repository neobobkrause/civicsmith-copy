/* case-checker — the readable specification of each case-file format version (requirements:
 * `build/requirements/case-checker.md` R14, R15; K1134 (1); DEC-112 (3) "an open specification").
 *
 * Written from `case-grammar` R11–R13 (the case document's `method:`, `materials:` and `material_attestations:` blocks
 * and the case file) and from what this checker checks (R1–R11, R18, R20, R22), so that anyone can write a checker of their own
 * from it. Each version's text is held here whole and served by `casefilespec` (R15). Its version names the format it
 * specifies. No place is named in it (R17). */

import { NONCONFORMING_WORDS } from "./standards.mjs";

const V1 = `# The case file, format bio-case-file/1

This document specifies version 1 of the case file: the one file (or set of parts) that carries a published case whole, so that anybody can check it and recreate its findings without a copy of Civicsmith. It states every field, kind and rule a checker needs. A checker built from this text alone, given the same case file, answers the same as the checker Civicsmith runs.

Recreating a case shows that what it carries is intact and consistent with what it states. It does not show that the case is true, and it is not an endorsement of it.

## 1. Parts

A case file is one or more parts. Each part is a ZIP archive whose every entry is stored, not compressed, with fixed timestamps (1980-01-01 00:00:00), names in UTF-8, and no encryption. A case file too large for one part (64 MiB) is split into several; nothing is left out for size.

Every part carries the same manifest, byte for byte, as the entry \`manifest.json\` at the archive's root. Every other entry is a file the manifest lists in that part, at its \`path\` from the archive's root. A part carries no entry the manifest does not list.

## 2. The manifest

The manifest is a JSON object with exactly these fields:

- \`format\`: \`bio-case-file/1\`.
- \`group\`: the slug of the team that published the case.
- \`case\`, \`edition\`: the case's id and its edition (a whole number from 1).
- \`case_document_sha\`: the SHA-256 (64 lowercase hex) of the case document's bytes.
- \`keys\`: the signing keys, at least one, each \`{key, fingerprint}\`. \`key\` is an OpenSSH \`ssh-ed25519\` public key on one line; \`fingerprint\` is its OpenSSH fingerprint, \`SHA256:\` followed by the unpadded base64 of the SHA-256 of the key's wire bytes.
- \`parts\`: each part, \`{index, sha256, bytes}\`, numbered from 1 in order. A part's \`sha256\` is the SHA-256 of one line per file of the part, in path order, each \`<path> <sha256> <bytes>\` and a newline (UTF-8), and its \`bytes\` the sum of those files' sizes. (The manifest sits inside every part, so it cannot list a digest of a whole part's archive.)
- \`files\`: every file, in path order, each \`{path, sha256, bytes, part, kind}\`: its path, the SHA-256 and size of its bytes, the part that carries it, and its kind.

## 3. The kinds of file, and their paths

Each kind is carried at one path, so a file's path says which finding or material it belongs to:

- \`case_document\` at \`case.md\`: the signed case document (section 4). Exactly one.
- \`case_signature\` at \`case.md.sig\`: the case document's signature, an armored SSH signature (section 5). Exactly one.
- \`complete_edition\` at \`complete-edition.html\`: the complete edition (section 6). Exactly one.
- \`finding\` at \`findings/<finding>/finding.md\`: one finding's published bytes.
- \`finding_signature\` at \`findings/<finding>/finding.md.sig\`: a member finding's signature.
- \`grading_facts\` at \`findings/<finding>/grading-facts.json\`: one finding's grading facts as recorded at the act, JSON \`{legs}\`. Each leg is \`{target, kind, role, grade, grade_axis, grade_source, ground, target_edition?, answer?, origins?, origins_complete?, captures?, author_key?, undetermined?}\`: \`kind\` is \`document\`, \`observation\`, \`inquiry\` (another finding), \`imported\` (another team's finding), or a leg counted on the capture axis only (\`calculation\`, whose \`target\` names a \`calculations:\` row by its \`calc\`, a held \`standard\`, or an \`occurrence\`); \`undetermined\`, on such a leg, the reason its capture grade is undetermined, or null (a row written before the field reads it null); \`grade_axis\` one of \`capture\`, \`connection\`, \`testimony\`; \`answer\`, for an \`inquiry\` leg, the pair the finding it rests on answered, per axis \`{state, grade}\`; \`captures\` the SHA-256 of each capture a document leg rests on.
- \`passages\` at \`findings/<finding>/passages.json\`: one finding's relied-on passages, a JSON list of \`{content_id, capture_sha, extent, chain, quoted}\`: \`extent\` in the extent grammar's canonical form (section 7), \`chain\` the text chain the passage was read through, or null.
- \`document\` at \`materials/<ref>/document\`: a captured document's bytes, whole.
- \`extracted_text\` at \`materials/<ref>/extracted.txt\`: a document's extracted text, the canonical JSON of its reading's units in order, each \`{extent, ref, text}\`. Its SHA-256 is the material's \`text_sha\`.
- \`observation\` at \`materials/<ref>/observation.md\`: an observation's text, whole.
- \`attestation\` at \`attestations/<ref>/<name>\`: a signed account, a timestamp token or a co-archive record.
- \`calculation\`, at three paths, one kind: \`calculations/<calc>/calculation.json\`, one calculation a member's chain reaches, its \`calculations:\` row (section 4) as canonical JSON, which must be what the signed row states; \`calculations/<calc>/inputs/<sha256>\`, each input the row names, as the canonical JSON the calculation engine evaluates (a table \`{fields, rows}\` or a figure), named by its SHA-256 (the manifest lists it with that SHA-256, or it departs: the input_sha rule); and \`calculations/prov.jsonld\`, once, the calculations rendered as W3C PROV-O in JSON-LD, which must be the rendering of the signed rows.

\`<finding>\` is a finding's id, \`<ref>\` a material's \`ref\` and \`<calc>\` a calculation's \`calc\` (section 4).

## 4. The case document

The case document is text: a front matter between two lines \`---\`, in the record's restricted grammar (top-level keys; a key whose value is a block holds a map or a list of flat maps; scalars are \`null\`, \`true\`, \`false\`, integers, decimals, double- or single-quoted strings, or bare words), then a Markdown body. Its format is \`bio-case-document/9\`, \`bio-case-document/8\`, \`bio-case-document/7\` or \`bio-case-document/6\`, which are identical in fields except the optional attestation \`sha\` that \`/9\` declares (\`/5\` to \`/1\` are older). They differ otherwise only in the words the complete edition renders (section 6). A document is \`/9\` when any of its attestation rows carries a \`sha\`; a document without one keeps \`/8\`. A checker reads these fields:

- \`case_id\`, \`case_edition\`, \`case_findings\` (the members), \`case_roles\` (per member \`{target, role, version_sha, edition}\`, \`role\` \`load_bearing\` or \`supporting\`, \`version_sha\` the SHA-256 of the member's published bytes).
- \`case_strength\`: each member's frozen pair, one row per member and axis \`{target, axis, state, grade, …}\`. A case has no strength of its own.
- \`required_strength\`: the bar, \`{declared, capture, connection, …}\`; an axis with a grade is declared.
- \`method:\` \`{grading, checks}\`: the grading method's version and the catalogue version the document was checked under.
- \`materials:\` one row per document or observation any member's chain reaches, \`{ref, kind, sha, text_sha, origin, archived_copy, included, rests_under}\`. \`included\` is true when the material travels whole. Material whose source's identity is withheld is listed like any other.
- \`material_attestations:\` one row per attestation, \`{ref, by_kind, by, level, at, signature, recorded_in}\`, and, in a \`bio-case-document/9\` document, an optional \`sha\`: the SHA-256 of the one capture of \`ref\` the row attests. A source captured more than once has one material row for each capture, all with the same \`ref\`; a row with a \`sha\` belongs to the material whose \`ref\` and \`sha\` it names, and a row without one (every earlier document) belongs to the materials of its \`ref\`. \`by_kind\` is \`member\` (a capturing member's signed account, or an observation's author; at \`group\` or \`project\` level it carries no handle, key or signature), \`co_attestation\` (a trusted timestamp or a co-archive), \`project\` (the project's record holds the material) or \`group\` (\`signature\` is the literal \`case\`: the case document's signature covers it).
- \`capture_accounts:\` each signed account \`{capture, by, at, text_b64, signature_b64}\`: the account's text and its signature, each base64.
- \`observation_attributions:\` per observation (or attested capture, by its SHA-256 as \`capture\`) the attribution \`level\` in force, which the grading method reads.
- \`grading_facts:\` one row per leg of each finding a member's chain reaches, \`{finding, ord}\` and the leg's fields (section 3), and \`passages:\` one row per relied-on passage, \`{finding, ord, content_id, capture_sha, extent, chain, quoted}\`. Each value that is not null, a number or a boolean is its canonical JSON in one single-quoted value. These blocks are what a grade is recomputed from and where a passage is said to be: the manifest is not signed, so a finding's \`grading_facts\` and \`passages\` files must say the same, row for row in \`ord\` order.
- \`calculations:\` one row per calculation any member's chain reaches, \`{calc, recipe, inputs, method_version, results, result_key, recompute, disclosed}\`: \`recipe\` the recipe in the closed grammar \`bio-calc/1\` (its canonical JSON in one single-quoted value); \`inputs\` each input's name and SHA-256; \`method_version\` the engine's version; \`results\` the stored results by key; \`result_key\` the SHA-256 of the canonical JSON of \`{recipe, inputs, method_version}\`; \`recompute\` the status recorded at the act (\`agrees\`, \`differs\` or \`unbound\`; a workbook row, whose \`calc\` is its capture's SHA-256, with no recipe, no inputs and a null \`result_key\`, may state \`not_recomputed\`); \`disclosed\` the publisher's disclosure of a differing or unbound calculation, or null. A grading leg of kind \`calculation\` names its row by \`calc\`.
- \`timeline:\` the published timeline, one row per item, \`{lane, ord, when, label, ref, source}\`: \`lane\` \`they_did\` (the world's events concerning the case's findings) or \`we_did\` (the team's own acts), every \`they_did\` row first, the two lanes never mixed; \`ord\` its place in its lane; \`when\` the item's when as held; \`source\` what it rests on (an item without one is not an item). The complete edition prints it.
- \`accepted_work:\` one row per member and leg resting on another team's finding, \`{member, leg_of, ref, team, case, edition, finding, manifest_sha, pair, result, gaps, accepted_by, accepted_at, reason}\`.

## 5. Signatures

Every signature is an armored SSH signature (SSHSIG) by an \`ssh-ed25519\` key, in the namespace \`bio-ratify\`, over the exact bytes of one statement:

- the case document: \`bio-ratify-case <case_id> <case_edition> <case_document_sha>\` and a newline;
- a member finding: \`bio-ratify <finding id> <version_sha>\` and a newline;
- a member's account of a capture: \`bio-capture-account <capture sha>\`, a newline, then the account's text.

The key a signature embeds must be among the manifest's \`keys\`. A checker given the team's published keys also says whether each signing key is among them; a checker given none says the keys were not checked against that list.

## 6. The complete edition

The complete edition is one HTML file rendered from the case file's other files, with every style inline, no script and no external reference. The same case file always renders the same bytes, so a checker renders it and compares. The product's name in its words (the credit at its foot, the line saying the case can be checked without the product, and the grading method's text) follows the case document's format: a \`bio-case-document/6\` document, or an earlier one, renders \`CivicOS\`, and a \`bio-case-document/7\` document renders \`Civicsmith\`. A \`bio-case-document/8\` document renders \`Civicsmith\` too, and says \`team\` where the earlier formats say \`group\` in the sentences of the edition that name the body publishing the case; identifiers (a manifest's \`group\` slug, a row's \`group\` value) stay as they are. A checker renders each document in its own format's words. So a case file published before \`/7\` still renders its own carried edition byte for byte.

## 7. Canonical JSON, and the canonical extent

Canonical JSON is JSON with every object's keys sorted by code unit, no whitespace, a member that JSON cannot hold left out, and strings and numbers as \`JSON.stringify\` writes them.

An extent names a place in one document. Its canonical form is an object with fixed fields per \`kind\`, an absent field written null: an integer field that is not an integer is null; a string field is trimmed, and null when empty; a rectangle \`rect\` is four finite numbers reordered to \`[min x, min y, max x, max y]\`, else null; a cell is A1 notation (up to three letters and seven digits) with \`$\` removed and in upper case, else null; a range is two such cells, the top-left first, always written \`A1:B2\` (one cell \`B3\` is \`B3:B3\`), else null.

- \`document\` (the whole document): \`{kind}\`.
- \`pdf-page\`: \`{kind, page, rect}\` (\`page\` from 0).
- \`sheet-cell\`: \`{kind, sheet, cell}\` (the sheet's name as written, trimmed).
- \`sheet-range\`: \`{kind, sheet, range}\`.
- \`slide-shape\`: \`{kind, slide, shape}\`.
- \`doc-para\`: \`{kind, para, run}\`.
- \`doc-table\`: \`{kind, table, cell}\`.
- \`image\`: \`{kind, cited_as, part, page, rect}\`: \`cited_as\` as written, else \`bytes\`; \`part\` trimmed and in lower case.
- \`envelope\`: \`{kind, cited_as, item, part, at, name, n}\`: \`cited_as\` as written, else \`envelope\`; \`at\` the canonical form of the anchoring extent, or null; \`n\` an integer or null.
- any other kind: \`{kind, fields}\`.

Two extents of one document overlap when they are the same place, or one lies inside the other: anything lies inside \`document\`; otherwise the kinds are equal and the coarse field is equal (\`page\`, \`para\`, \`slide\`, \`sheet\`), and the fine field (\`rect\`, \`run\`, \`shape\`, \`cell\`) is absent on the outer one, equal, or (a rectangle) contained in the outer one.

## 8. Checking a case file

A checker answers, for each finding (a member, or a finding a member's chain reaches through its \`inquiry\` legs), one result: \`recreated\` (nothing missing, nothing differs), \`recreated_in_part\` (something is missing and nothing differs) or \`did_not_recreate\` (something differs). A check of the whole case that finds something missing or differing counts for every finding. Each entry names what is missing or what differs in words a reader can act on, such as a document to fetch with its fingerprint and origin.

1. Integrity. The manifest follows section 2. Every file's SHA-256 and length match its row; every part's files recompute its \`sha256\`. Since only the case document is signed, each material's carried bytes must also match the signed \`materials:\` row (\`sha\` for a document or an observation, \`text_sha\` for extracted text), a member's published bytes its \`version_sha\`, and each finding's grading facts and passages files the signed blocks. An absent file is missing for each finding that needs it; one that does not match differs.
2. Signatures. Each signature is verified as section 5 says; one that fails differs, for the case and every finding it covers. Each \`material_attestations:\` row is checked by its kind: a \`member\` row with a signature is verified over its account; a \`group\` row is the case document's signature; a \`project\` or \`co_attestation\` row must name a material the manifest lists. A failed row differs for each finding whose chain reaches that material; a failed row with a \`sha\` differs only for the finding whose chain reaches that capture, and its entry names the \`sha\`.
3. Passages. Each passage's quoted text occurs (whitespace compared as single spaces) in its document's extracted text at its extent (the text of every unit whose extent overlaps the passage's, in order, joined by newlines; for an observation, its text), and its \`content_id\` is the SHA-256 (of the UTF-8 bytes) of the canonical JSON of \`{v: 1, capture_sha, extent, chain}\`, where \`extent\` is a string holding the canonical JSON of the extent in its canonical form, and \`chain\` a string holding the canonical JSON of the chain, or null. Not found differs; extracted text not carried is missing.
4. Grades. Each finding's pair is recomputed from its grading facts by the grading method the case states (\`method.grading\`), whose text is published with the case's complete edition. A recomputed grade unlike the recorded one differs; a method version the checker does not hold is missing.
5. The bar. A load-bearing member reaches the recorded bar on every declared axis, or differs naming each axis. A supporting member is not asked; a case with no bar has none to meet.
6. Publication checks. The case document passes the publication checks of the catalogue; a check that needs the publishing copy's record is named as not asked. When the case states another catalogue version than the checker's, the answer says the checks ran at the checker's version.
7. Presentability. Every material a load-bearing member's chain reaches is listed in \`materials:\` as \`included: true\` and carried whole (its bytes and extracted text, or an observation's text). Not carried is missing; not listed, or listed as not included, differs.
8. Completion. Bytes supplied later whose SHA-256 is a missing file's fingerprint fill that gap. Bytes whose SHA-256 is a calculation input's stated SHA-256, where the case file lacks that input (absent, or carried with other bytes), fill that input: the calculation is recomputed with them (rule 11), and every finding resting on it takes its new entries. Other bytes are named and never used.
9. The complete edition. The carried complete edition equals the one rendered from the rest of the case file, or differs.
10. Another team's work. A leg on another team's finding (\`imported\`) is recreated up to that leg: its grade is the \`accepted_work:\` row's \`pair\`, passages and material are not followed past it, it adds nothing missing, and the answer names that team's case file (team, case, edition, finding and manifest SHA-256) as the place to check it.
11. Calculations. Each \`calculations:\` row is recomputed by the \`bio-calc/1\` engine over the inputs the case file carries, each first checked against its SHA-256, at the method version the row states, and answered \`agrees\`, \`differs\` or \`not_recomputed\`. A result or result key that recomputes differently differs, naming the result, the stated and the recomputed value; an input absent or unlike its hash, or a method version the checker does not hold, is missing. A row the document discloses as differing or unbound is answered with that disclosure, and is not counted as differing for being so. A workbook, or a value from another engine, is answered \`not_recomputed\`, recomputed by the publishing copy's engine, never as agreeing. A finding whose chain rests on a calculation takes its entries.
`;

/* R14 (T36; N717, K2129): version 2 is version 1 with the kinds `case-grammar` R13 adds (`archive`, `container`,
   `criteria`), the member's subject (its R22) and the check of the standards' use over the criteria (R22, through R21).
   Each change names the text of version 1 it replaces; `edit` keeps the text unchanged where it does not find it, and
   the specification's test reads every addition in version 2, so a change that does not land is seen there. */
const edit = (text, changes) => changes.reduce((t, [from, to]) => t.replace(from, to), text);
const words = NONCONFORMING_WORDS.map((w) => `\`${w}\``);
const V2 = edit(V1, [
  ["# The case file, format bio-case-file/1\n\nThis document specifies version 1 of the case file:",
   "# The case file, format bio-case-file/2\n\nThis document specifies version 2 of the case file:"],
  ["answers the same as the checker Civicsmith runs.\n",
   "answers the same as the checker Civicsmith runs.\n\nVersion 2 adds three kinds of file to version 1 (`archive`, `container` and "
   + "`criteria`, section 3) and one check (rule 12, section 8). A `bio-case-file/1` case file is read as written, by its own "
   + "specification, which is held beside this one: its manifest names none of the kinds version 2 adds, and a `bio-case-file/1` "
   + "manifest naming one departs from its format.\n"],
  ["- `format`: `bio-case-file/1`.", "- `format`: `bio-case-file/2`."],
  ["which must be the rendering of the signed rows.\n",
   "which must be the rendering of the signed rows.\n"
   + "- `archive` at `materials/<ref>/archives/<sha256>`: the captured bytes, whole, of the archive a carried document was unpacked "
   + "from, named by their SHA-256; and `container` at `materials/<ref>/containers/<sha256>.json`: that document's container record, "
   + "the canonical JSON (section 7) naming the document and its archive by SHA-256, named by the document's SHA-256. Each is carried "
   + "under the `ref` of the material whose chain it belongs to, and the same pair again for that archive's own archive, outward to "
   + "the outermost. An `archive` or `container` file under a `ref` that carries no `document` departs. The archive's timestamp "
   + "tokens travel as `attestation`. Their fingerprints are checked like any file's (rule 1); recreating a finding does not need "
   + "them.\n"
   + "- `criteria` at `criteria.json`, at most once: the criteria the case edition measures against, as the publishing copy froze "
   + "them when it committed the edition, a JSON list in canonical JSON. There is one row for each distinct standard, portion and "
   + "body that a leg of a member finding targets, each `{standard, portion, designation, edition, issuer, citation, access, body, "
   + "binds, passages, label, access_words}`: `access` is `free`, `reading_room` or `paywalled`; `body` the entity the member "
   + "finding's subject is, or null; `binds` true only when the standard, at that edition, binds that body, else false (a "
   + "benchmark); `passages` the passages of the standard's text the members' legs target, each `{content, text}`, `content` a "
   + "passage's content id and `text` its quoted words or null. A standard whose `access` is not `free` carries nothing of its "
   + "text but those passages. A standard no longer held is a row with its `standard` and `portion`, every other field null, and "
   + "`stated: \"not held\"`. A case edition committed before criteria were recorded carries no criteria file.\n"],
  ["`case_roles` (per member `{target, role, version_sha, edition}`, `role` `load_bearing` or `supporting`, `version_sha` the SHA-256 of the member's published bytes).",
   "`case_roles` (per member `{target, role, version_sha, edition, subject_entity}`, `role` `load_bearing` or `supporting`, "
   + "`version_sha` the SHA-256 of the member's published bytes, `subject_entity` the entity the member's pinned bytes state as "
   + "their subject, or null; a row may leave it out).\n- `case_conclusions:` per member `{target, claim, claim_detail, "
   + "subject_entity, …}`: what the member concludes, as the case states it. A member's subject is its `case_roles:` row's "
   + "`subject_entity`, else its `case_conclusions:` row's, else none.\n- `case_scope` and the `completeness:` block's "
   + "`statement`: the case's own statement of what it covers and what it does not."],
  [/\n$/, "\n12. Standards' use. When the case file carries a `criteria` file, the checker judges how the case uses the standards it "
   + "measures against, beside the results: it changes no finding's result. A row stated `not held` is not judged, and is named. "
   + "Every departure is named, never only the first:\n"
   + "   - A standard whose `access` is not `free` travels only as the passages a finding relies on. A `materials:` row listed "
   + "`included: true` whose `sha` is one of the captures holding that standard's text departs (`COPYRIGHTED_TEXT_CARRIED`). The "
   + "case file does not carry which captures hold a standard's text, so this is not judged offline: each such row is named as "
   + "not judged for this check.\n"
   + "   - A passage of such a standard that no finding relies on departs (`COPYRIGHTED_PASSAGE_UNRELIED`): one of its row's "
   + "`passages` whose `content` is the `content_id` of no `passages:` row.\n"
   + `   - A member finding whose rows are all \`binds: false\` (it rests on no standard that binds its body) never uses the words ${words.slice(0, -1).join(", ")} `
   + `or ${words[words.length - 1]}, as whole words in any letter case, in its \`case_conclusions:\` \`claim\` or \`claim_detail\`, or in the `
   + "case's `case_scope` or `completeness:` `statement` (`BENCHMARK_CALLED_NONCONFORMING`). A member's rows are those of the "
   + "standards its own `standard` legs in `grading_facts:` target whose `body` is the member's subject, or every row of those "
   + "standards when the case states no subject; a member with no such row is not judged. The case document's body is not read: it "
   + "prints quoted passages, whose own words may say otherwise.\n"],
]);

/* R14 (T37; N757, N763; K2206; DEC-180 (4)): version 3 is version 2 with the `obscured` kind and the `materials:` row's
   `obscured` field (`case-grammar` R12, R13), the presentability of a photo carried as its copy (R8), and the criteria
   rows' `captures` (`publication` R72), over which R22 judges the copyrighted standards' arms offline. Built as version 2
   is, by named changes; the specification's test reads every addition. (T39; N806; K2333, K2343) The `obscured` kind also
   carries a member document's cleaned copy (`case-carriage` R15) beside a photo's: words only, the format unchanged. (T40;
   N798; DEC-185 (1); K2394) An unmarked photo's copy is labeled published (`case-carriage`'s `PUBLISHED_LABEL`), told
   from a marked one by `obscured_marked` (`case-grammar` R12), by its label when absent: words only, the format unchanged. */
const V3 = edit(V2, [
  ["# The case file, format bio-case-file/2\n\nThis document specifies version 2 of the case file:",
   "# The case file, format bio-case-file/3\n\nThis document specifies version 3 of the case file:"],
  [/\nVersion 2 adds three kinds of file to version 1 [^\n]*\n/,
   "\nVersion 2 added three kinds of file to version 1 (`archive`, `container` and `criteria`, section 3) and one check (rule 12, "
   + "section 8). Version 3 adds one kind of file to version 2 (`obscured`, section 3), the `obscured` fields of a `materials:` "
   + "row (section 4) and their checks (rules 1 and 7), and the criteria rows' `captures` (section 3, rule 12). A `bio-case-file/2` "
   + "or `bio-case-file/1` case file is read as written, by its own specification, each held beside this one: a `bio-case-file/2` "
   + "manifest names no `obscured` file, a `bio-case-file/1` manifest none of the kinds versions 2 and 3 add, and a manifest naming "
   + "a kind its format lacks departs from its format.\n"],
  ["- `format`: `bio-case-file/2`.", "- `format`: `bio-case-file/3`."],
  ["binds, passages, label, access_words}`:", "binds, passages, captures, label, access_words}`:"],
  ["A standard whose `access` is not `free` carries nothing of its text but those passages.",
   "A standard whose `access` is not `free` carries nothing of its text but those passages. `captures` is the SHA-256 of each "
   + "capture holding one of the row's `passages` that the edition's `materials:` lists `included: true`, each once, in the order "
   + "first met: a capture the edition does not carry is never stated. A row recorded before captures were (a case edition "
   + "committed before them) has no `captures` field, and it is never filled."],
  ["`stated: \"not held\"`. A case edition committed before criteria were recorded carries no criteria file.\n",
   "`stated: \"not held\"` (its `captures` null). A case edition committed before criteria were recorded carries no criteria file.\n"
   + "- `obscured` at `materials/<ref>/obscured`: the copy of a material carried in place of its original: a photo's copy, "
   + "carrying nothing of the original but its pixels, its marked areas, if any, covered solid; or a member document's cleaned "
   + "copy, every picture in it and the document itself carrying none of their details (who made it, with what, when). Its bytes "
   + "are whole at the SHA-256 the material's `materials:` row names as `obscured_copy` (section 4), under that row's `ref`, at "
   + "most one per `ref`. An `obscured` file no row names, a row naming a copy no file carries at that SHA-256, and, for "
   + "a row stating `obscured_copy`, a `document`, `extracted_text`, `archive` or `container` file under its `ref` at the "
   + "original's fingerprints (the original never travels) each depart (rule 1).\n"],
  ["Material whose source's identity is withheld is listed like any other.\n",
   "Material whose source's identity is withheld is listed like any other. A `document` row may state `obscured_copy` and "
   + "`obscured_label`: the material travels as its copy, never whole: a photo with the areas a member marked obscured, or a "
   + "document a member supplied with the details of who made it, and of its pictures, removed. A published case states it for "
   + "every photo it carries and for every member document it carries as its copy. The row then states `included: false`, and "
   + "its `sha`, `text_sha`, `origin` and `archived_copy` stay the original's; `obscured_copy` is the SHA-256 of the copy and "
   + "`obscured_label` the sentence the published case shows beside the material: a member document's copy is labeled cleaned, "
   + "a photo's copy with marked areas covered is labeled obscured, and an unmarked photo's copy (nothing covered, no metadata) "
   + "is labeled published, so every photo a case carries is labeled. The row may also state `obscured_marked`, whether the "
   + "photo's copy covers areas a member marked, which tells a marked copy from an unmarked one; a row without it is read by its "
   + "label (a label stated, marked; none, unmarked, as in an edition signed before unmarked copies were labeled). A row without "
   + "them travels as before.\n"],
  ["So a case file published before `/7` still renders its own carried edition byte for byte.\n",
   "So a case file published before `/7` still renders its own carried edition byte for byte. A material carried as its copy (a "
   + "photo, or a member document's cleaned copy) is listed with the original's fingerprint, the copy's fingerprint and its label, "
   + "word for word, when it has one; an edition stating no copy renders as it did before version 3.\n"],
  ["Not carried is missing; not listed, or listed as not included, differs.\n",
   "Not carried is missing; not listed, or listed as not included, differs. A row stating `obscured_copy` (a photo or a member "
   + "document carried as its copy) is presentable when the case file carries an `obscured` file at that SHA-256 under its "
   + "`ref`, whose bytes rule 1 checks; else the copy is missing, for each finding whose chain reaches it. Its extracted text and the original's bytes are "
   + "not asked, since the original never travels, so a passage relied on in such material cannot be found and is missing (rule "
   + "3). The answer lists each such row, `{ref, sha, copy, label}`, in the document's order, so its label is stated beside it.\n"],
  ["The case file does not carry which captures hold a standard's text, so this is not judged offline: each such row is named as "
   + "not judged for this check.\n",
   "Those captures are its row's `captures`. A row with no `captures` field (recorded before them) is not judged for this check, "
   + "and its standard is named as not judged for it.\n"],
  ["one of its row's `passages` whose `content` is the `content_id` of no `passages:` row.\n",
   "one of its row's `passages` whose `content` is the `content_id` of no `passages:` row, or a `passages:` row whose "
   + "`capture_sha` is one of its row's `captures` and on which no finding relies (every `passages:` row a case file carries "
   + "is a finding's, so offline only the first can depart).\n"],
]);

/* R14 (fix round 6, G50; K4688): version 4 is version 3 with the path of a material's files when one `ref` is on several rows
   of the `materials:` block (`case-grammar` R13): `materials/<ref>/<sha>/<leaf>`, the row's capture a segment of the path, and
   the five departures that keep the spelling and the format together. No kind and no field is added. A case file with no such
   path stays `bio-case-file/3`. Built as version 3 is, by named changes; the specification's test reads every addition. */
const V4 = edit(V3, [
  ["# The case file, format bio-case-file/3\n\nThis document specifies version 3 of the case file:",
   "# The case file, format bio-case-file/4\n\nThis document specifies version 4 of the case file:"],
  [/\nVersion 2 added three kinds of file to version 1 [^\n]*\n/,
   "\nVersion 2 added three kinds of file to version 1 (`archive`, `container` and `criteria`, section 3) and one check (rule 12, "
   + "section 8). Version 3 added one kind of file to version 2 (`obscured`, section 3), the `obscured` fields of a `materials:` "
   + "row (section 4) and their checks (rules 1 and 7), and the criteria rows' `captures` (section 3, rule 12). Version 4 adds "
   + "no kind and no field: it spells the path of a material's files differently when one `ref` is on several rows of the "
   + "`materials:` block, a source captured more than once (section 3), and adds the departures that keep that spelling and the "
   + "format together (rule 1). A case file is `bio-case-file/4` when at least one of its paths states a capture, and keeps "
   + "`bio-case-file/3` otherwise. A `bio-case-file/3`, `/2` or `/1` case file is read as written, by its own specification, each "
   + "held beside this one, and never by this one's spelling of a path: a `/3` manifest with a path that states a capture departs "
   + "from its format, and a checker meeting a format it does not hold departs at `format`.\n"],
  ["- `format`: `bio-case-file/3`.", "- `format`: `bio-case-file/4`."],
  ["`<finding>` is a finding's id, `<ref>` a material's `ref` and `<calc>` a calculation's `calc` (section 4).\n",
   "`<finding>` is a finding's id, `<ref>` a material's `ref` and `<calc>` a calculation's `calc` (section 4).\n\n"
   + "**One `ref` on several rows.** A source captured more than once is several rows of the `materials:` block with one `ref` "
   + "(section 4), counted over all its rows, carried or not. For such a `ref`, each file of the kinds `document`, "
   + "`extracted_text`, `observation` and `obscured` takes its row's capture as a segment of its path: "
   + "`materials/<ref>/<sha>/<leaf>`, where `<sha>` is the row's `sha`, in lower case, 64 hex (for a row carried as its copy, the "
   + "original's), and `<leaf>` is that kind's leaf in the paths above (`document`, `extracted.txt`, `observation.md`, `obscured`). "
   + "A `ref` on one row keeps its path as above, and so does every case file whose `ref`s are each on one row. The `archive` and "
   + "`container` kinds are already named by a digest and keep their paths (`materials/<ref>/archives/<sha256>`, "
   + "`materials/<ref>/containers/<sha256>.json`); a path of four segments is read as such a file when its third segment is "
   + "`archives` or `containers`, and as a file of a capture when its third segment is 64 lower-case hex and its fourth is a "
   + "material leaf. An `attestation` keeps its path. A checker decides the spelling from the manifest's format, never from the "
   + "rows alone: the spelling is `bio-case-file/4`'s alone.\n"],
  ["under that row's `ref`, at most one per `ref`. An `obscured` file no row names,",
   "under that row's `ref`, at `materials/<ref>/obscured` for a `ref` on one row and, for a `ref` on several rows, one for each "
   + "row at `materials/<ref>/<sha>/obscured`. An `obscured` file no row names,"],
  ["under its `ref` at the original's fingerprints (the original never travels) each depart (rule 1).",
   "under its `ref` at the original's fingerprints (the original never travels) each depart (rule 1); for a `ref` on several "
   + "rows the departure is judged for the row whose capture the path states, and for `archive` and `container` only when every "
   + "row of that `ref` is a copy."],
  ["Every file's SHA-256 and length match its row; every part's files recompute its `sha256`.",
   "Every file's SHA-256 and length match its row; every part's files recompute its `sha256`. A `bio-case-file/4` manifest "
   + "departs when: a path states a capture and the manifest's format is not `/4` (`path_format`); its format is `/4` and no path "
   + "states a capture (`format_unused`); given the case document's rows, a plain path of a material's file stands under a `ref` on "
   + "several rows (`capture_missing`), a path stating a capture stands under a `ref` on one row (`capture_needless`), or a path "
   + "states a capture that no row of that `ref` names, `sha` compared in lower case (`capture_unnamed`). No path repeats in any "
   + "format (`path_twice`)."],
  ["is presentable when the case file carries an `obscured` file at that SHA-256 under its `ref`, whose bytes rule 1 checks;",
   "is presentable when the case file carries an `obscured` file at that SHA-256 under its `ref` (for a `ref` on several rows, under "
   + "the row's capture), whose bytes rule 1 checks;"],
  ["Not carried is missing; not listed, or listed as not included, differs. A row stating",
   "Not carried is missing; not listed, or listed as not included, differs. For a `ref` on several rows, each row is asked for "
   + "the files of its own capture, and a passage in a capture is found in that capture's text. A row stating"],
]);

/** R14: every specification held, by the format it specifies. */
export const CASE_FILE_SPECS = Object.freeze({ "bio-case-file/1": V1, "bio-case-file/2": V2, "bio-case-file/3": V3, "bio-case-file/4": V4 });
/** R15: the versions held, oldest first. */
export const CASE_FILE_SPEC_VERSIONS = Object.freeze(Object.keys(CASE_FILE_SPECS));

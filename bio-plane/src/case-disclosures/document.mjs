/* The disclosures' lines in the case document (requirements: `build/requirements/case-disclosures.md`, R1, R3, R5, R7,
 * R10, R13, R14; K1333). Pure: nothing here touches a table. Moved from `case-authoring/document.mjs` unchanged, one
 * spelling (P15): `case-authoring`'s `caseDocumentText` imports these and keeps no copy, so a case document is byte
 * for byte what it was before the split (N529). The comments moved with them, their requirement ids re-pointed to
 * this module's.
 *
 * THE GRAMMAR IS THE RESTRICTED FRONTMATTER GRAMMAR: scalars, a map of scalars, or an array of flat objects, never a
 * map holding an array; a quote, a backslash or a line break in a derived string is sanitised by `case-grammar`'s
 * `fmSafe`. */

import { EARNED_CAPTURE_CEILING } from "../record-grammar/index.mjs";
import { fmSafe, pairLine, ANONYMOUS_ATTESTATION_LEVELS, ungradedPassagesLines } from "../case-grammar/index.mjs";
import { word, localize } from "../setup-words/index.mjs";

/* ===========================================================================
 * EACH DOCUMENT'S GRADE AND CO-ATTESTATION, AND ITS SOURCE (R2–R4; N364: DEC-81 items 1 and 3, DEC-78 item 5). The
 * `/5` blocks `captures:`, `capture_accounts:` and `sources:` are publication's spelling (its R20; K549, K552, K553),
 * written only through its line builders, so the bytes are written one way and read one way. The body, which a person
 * reads, is this module's: each capture's grade and co-attestation in words, and each signed account's text and
 * armored signature verbatim.
 * =========================================================================== */

/** R3: DEC-81 item 3's reader sentence, verbatim, carried by every self-attested document's block. */
export const SELF_ATTESTED_SENTENCE = word("case-disclosures.without_attestation_outsider");
const BASIS_WORDS = Object.freeze({ consent: word("case-disclosures.stated_source_consent"),
  public_elsewhere: word("case-disclosures.stated_already_public") });

const BASIS_NOT_STATED = localize("case-disclosures.document.basis_not_stated", "basis not stated");
const NO_SIGNATURE = localize("case-disclosures.document.no_signature_held", "(none held)");

/** R2: a capture's grade and its basis, or that it earned no letter. */
const gradeWords = (c) => (c.grade
  ? localize("case-disclosures.document.grade_basis", "grade {grade} ({grade_basis})", { grade: String(c.grade), grade_basis: String(c.grade_basis ?? BASIS_NOT_STATED) })
  : word("case-disclosures.capture_letter", { grade_basis: String(c.grade_basis ?? BASIS_NOT_STATED) }));

/** R2: whether a capture is co-attested, as the body states it: a timestamp and a co-archive both held (obtained late, said
 *  so), else NOT CO-ATTESTED and what it does hold. */
function attestationWords(c) {
  if (c.co_attested) {
    const held = c.timestamp_at
      ? localize("case-disclosures.document.co_attested_timestamp", "; co-attested: a timestamp at {timestamp_at} and a co-archive at {co_archive}", { timestamp_at: String(c.timestamp_at), co_archive: String(c.co_archive) })
      : localize("case-disclosures.document.co_attested_untimed", "; co-attested: a timestamp and a co-archive at {co_archive}", { co_archive: String(c.co_archive) });
    return c.late ? `${held}, ${word("case-disclosures.obtained_late_proves")}` : held;
  }
  return [localize("case-disclosures.document.not_co_attested", "; NOT CO-ATTESTED"),
    c.timestamp_at ? word("case-disclosures.timestamp_archive", { timestamp_at: String(c.timestamp_at) }) : "",
    c.co_archive ? word("case-disclosures.archive_timestamp", { co_archive: String(c.co_archive) }) : ""].filter(Boolean).join(" ");
}

export function captureBodyLines(captures, sources) {
  const byCapture = new Map();
  for (const c of captures) if (!byCapture.has(c.capture)) byCapture.set(c.capture, { ...c, members: [], accounts: [] });
  for (const c of captures) {
    const held = byCapture.get(c.capture);
    held.members.push(c.member);
    if (Array.isArray(c.accounts)) held.accounts.push(...c.accounts);
  }
  return [word("case-disclosures.document_grade_attestation"), "",
    ...(byCapture.size
      ? [localize("case-disclosures.document.each_document_this_cases_findings", "Each document this case's findings rest on, one level deep, with the grade its capture earns and whether a trusted timestamp and a third party's co-archive attest it. A co-attested Grade {EARNED_CAPTURE_CEILING} document is enough to publish on; one that is not is published only as self-attested, by the owner's stated acknowledgement.", { EARNED_CAPTURE_CEILING: String(EARNED_CAPTURE_CEILING) }), "",
         ...[...byCapture.values()].flatMap((c) => [
           localize("case-disclosures.document.capture_under_members_v1_v2", "- {capture} (under {members}): {v1}{v2}.", { capture: String(c.capture), members: String(c.members.join(", ")), v1: gradeWords(c), v2: attestationWords(c) }),
           ...(c.grade_why ? [`  - ${c.grade_why}`] : []),
           ...(c.self_attested_only
             ? [`  ${word("case-disclosures.self_attested_acknowledged", { acknowledged_by: String(c.acknowledgement.acknowledged_by), at: String(c.acknowledgement.at), reason: String(c.acknowledgement.reason) })}`, `  - ${SELF_ATTESTED_SENTENCE}`]
             : []),
           ...c.accounts.flatMap((a, k) => (a.by === null && a.signature === null
             /* R10: an off-the-record capture's attesting member not named: the account's words, nothing of who. */
             ? [`  ${word("case-disclosures.attesting_member_account", { key: String(k + 1), at: String(a.at) })}`, "", "```", a.text, "```", ""]
             : [`  ${word("case-disclosures.capturing_member_signed", { key: String(k + 1), by: String(a.by), at: String(a.at) })}`, "",
                "```", a.text, "```", "", `    ${word("case-disclosures.signature")}`, "", "```", a.signature ?? NO_SIGNATURE, "```", ""]))])]
      : [word("case-disclosures.case_findings_rest")]),
    "",
    word("case-disclosures.sources_material_given"),
    "",
    ...(sources.length
      ? [word("case-disclosures.said_whoever_gave"), "",
         ...sources.map((x) => `- ${x.capture}: ${x.stated}` + (x.basis ? `, ${BASIS_WORDS[x.basis] ?? x.basis}.` : "."))]
      : [word("case-disclosures.document_case_rests")]),
    ""];
}

/* ===========================================================================
 * WHAT THE CASE CARRIES (R5, R7, R10; DEC-112 (3)(4)(5), DEC-119) AND ANOTHER GROUP'S WORK IT RESTS ON (R13, R14;
 * DEC-96 item 4). The blocks are case-grammar's spelling (its R11, R12, R16), written only through its line builders;
 * the body, which a person reads, is this module's, in plain sentences until the UX design stream gives the words.
 * =========================================================================== */

const MATERIAL_KIND_WORDS = Object.freeze({ document: localize("case-disclosures.document.a_document", "a document"),
  observation: word("case-disclosures.member_firsthand_observation") });
const TIME_NOT_STATED = localize("case-disclosures.document.a_time_not_stated", "a time not stated");
const NOT_STATED = localize("case-disclosures.document.not_stated", "not stated");
const NOT_STATED_BRACKETED = localize("case-disclosures.document.not_stated_bracketed", "(not stated)");

/* R10: who attests a material, as the row states them, never more. */
function attesterWords(a, group) {
  if (a.by_kind === "group") return word("case-disclosures.vouches_signing_case", { group: String(group ?? localize("case-disclosures.document.the_team", "the team")) });
  if (a.by_kind === "project") return word("case-disclosures.record_holds_registered", { by: String(a.by), at: String(a.at ?? word("case-disclosures.time_stated")), recorded_in: String(a.recorded_in) });
  if (a.by_kind === "co_attestation")
    return a.by === "timestamp" ? word("case-disclosures.trusted_timestamp", { at: String(a.at ?? TIME_NOT_STATED) }) : word("case-disclosures.third_party_archive", { by: String(a.by) });
  if (ANONYMOUS_ATTESTATION_LEVELS.includes(a.level))
    return word("case-disclosures.member_named_chose", { level: String(a.level) });
  if (!a.level && !a.by) return word("case-disclosures.member_chosen_credited");
  return [String(a.by), a.level ? word("case-disclosures.credited_level_chose", { level: String(a.level) }) : "",
    a.at ? localize("case-disclosures.document.attested_on", "on {at}", { at: String(a.at) }) : "",
    a.signature ? word("case-disclosures.with_their_signature") : ""].filter(Boolean).join(", ");
}

/* R7 (T41; K2541; DEC-185 (1)): a material R6 carries as its copy (`obscured`, a photo's or a member document's) travels
   with the case as that copy, printed with the copy's fingerprint and, word for word, the label shown beside it; never
   as "NOT INCLUDED". Only a row stating `obscured` prints so, so every row without it renders byte for byte as before. */
const copyCarried = (o) => !!o && typeof o === "object" && typeof o.copy === "string" && o.copy !== "";
const copyWords = (o) => word("case-disclosures.travels_case_copy", { copy: String(o.copy), label: String(typeof o.label === "string" && o.label ? `, ${word("case-disclosures.shown_label", { label: String(o.label) })}` : "") });

/** R7: what a material row says of what travels. */
const travelsAs = (m) => (m.included ? word("case-disclosures.travels_whole_case")
  : copyCarried(m.obscured) ? copyWords(m.obscured)
  : word("case-disclosures.included_fingerprint_origin"));

/* R7 (G47): an attestation that states a `sha` belongs to that capture's row alone (captures of one source share a `ref`);
   one that states none belongs to every row of its `ref`, as before. */
export function carriesBodyLines(method, materials, group) {
  const rows = materials && Array.isArray(materials.rows) ? materials.rows : [];
  const att = materials && Array.isArray(materials.attestations) ? materials.attestations : [];
  return [word("case-disclosures.case_graded_checked"), "",
    word("case-disclosures.grade_case_reached", { method: String(method ? method.grading ?? NOT_STATED_BRACKETED : NOT_STATED_BRACKETED), method_2: String(method ? method.checks ?? NOT_STATED_BRACKETED : NOT_STATED_BRACKETED) }), "",
    word("case-disclosures.case_carries"), "",
    ...(rows.length
      ? [word("case-disclosures.document_observation_case"), "",
         ...rows.flatMap((m) => [
           word("case-disclosures.fingerprint_relied_finding", { ref: String(m.ref), material_kind_words: String(MATERIAL_KIND_WORDS[m.kind] ?? m.kind), sha: String(m.sha), rests_under: travelsAs(m), origin: String(m.rests_under === "load_bearing" ? localize("case-disclosures.document.a_load_bearing", "a load-bearing") : localize("case-disclosures.document.only_a_supporting", "only a supporting")), archived_copy: String(m.origin ?? NOT_STATED), text_sha: String(m.archived_copy ?? localize("case-disclosures.document.none_held", "none held")), first: String(m.text_sha ? localize("case-disclosures.document.extracted_text_sha", "; extracted text {text_sha}", { text_sha: String(m.text_sha) }) : "") }),
           ...att.filter((a) => (a.sha ? a.sha === m.sha : a.ref === m.ref)).map((a) => localize("case-disclosures.document.attested_by", "  - Attested: {attester}.", { attester: attesterWords(a, group) }))])]
      : [word("case-disclosures.case_findings_reach")]),
    ""];
}

/* N535: a member's words (an acceptance's reason and gaps, a flag's issue, the owner's words on it) closed as a
   sentence, its full stop added only when the words do not already end one (a reason "We recreated it whole."
   printed "whole.." before). The words are otherwise printed as given. An edition written before N535 keeps its
   bytes as signed: nothing re-renders a published edition. */
const sentence = (words) => {
  const s = String(words);
  return /[.!?…]$/.test(s) ? s : `${s}.`;
};

export function acceptedBodyLines(accepted) {
  const rows = accepted && Array.isArray(accepted.rows) ? accepted.rows : [];
  const flags = accepted && Array.isArray(accepted.flags) ? accepted.flags : [];
  if (!rows.length) return [];
  return [word("case-disclosures.group_work_case"), "",
    word("case-disclosures.finding_case_rests"), "",
    ...rows.map((r) => word("case-disclosures.rests_through_case", { member: String(r.member), leg_of: String(r.leg_of), finding: String(r.finding), group: String(r.group ?? localize("case-disclosures.document.another_team", "another team")), case: String(r.case ?? NOT_STATED_BRACKETED), edition: String(r.edition), accepted_by: String(r.accepted_by), accepted_at: String(r.accepted_at), reason: String(sentence(r.reason)), result: String(String(r.result ?? localize("case-disclosures.document.not_recorded", "not recorded")).replace(/_/g, " ")), gaps: String(r.gaps ? `, ${word("case-disclosures.gaps_stated", { gaps: String(sentence(r.gaps)) })}` : "."), pair: String(pairLine(r.pair)), manifest_sha: String(r.manifest_sha ?? NOT_STATED) })),
    ...(flags.length
      ? ["", localize("case-disclosures.document.each_open_flag_on_that", "Each open flag on that work is disclosed here, and never blocks the case (DEC-96 item 4):"), "",
         ...flags.map((f) => word("case-disclosures.flag_edition_raised", { flag: String(f.flag), ref: String(f.ref), edition: String(f.edition), flagged_at: String(f.flagged_at ?? word("case-disclosures.time_stated")), words: String(sentence(f.issue)), acknowledged_by: String(f.words ? ` ${word("case-disclosures.owner_words", { words: String(sentence(f.words)) })}` : ""), acknowledged_at: String(f.acknowledged_by), value: String(f.acknowledged_at) }))]
      : ["", word("case-disclosures.flag_open_work")]),
    ""];
}

/* ===========================================================================
 * THE PASSAGES PUBLISHED WITHOUT A GRADE (R36; T53; DEC-461). The rows are R35's entries and nothing else (R20), written
 * once through `case-grammar`'s block writer (its R36); the body states it in one fixed sentence, by its key. Nothing is
 * written for an empty list, so a case with every passage graded keeps the bytes of an earlier-format document there.
 * =========================================================================== */

/** R36: the key of the one body sentence (words the UX stream's). */
export const UNGRADED_BODY_KEY = "case-disclosures.document.ungraded_body";
const ungradedRows = (entries) => (Array.isArray(entries) ? entries : [])
  .filter((e) => e && typeof e === "object" && !Array.isArray(e))
  .map((e) => ({ finding: e.finding, ord: e.ord, content_id: e.content_id }));

/** R36: the `ungraded_passages:` block, R35's entries as `{finding, ord, content_id}` rows in their order; none for none. */
export function ungradedLines(entries) {
  const rows = ungradedRows(entries);
  return rows.length ? ungradedPassagesLines(rows) : [];
}

/** R36: the body's one fixed sentence that this edition was published with these passages not graded by the team, then a
 *  blank line; none for none. */
export function ungradedBodyLines(entries) {
  if (!ungradedRows(entries).length) return [];
  return [localize("case-disclosures.document.ungraded_body", "This edition was published with the passages listed in its frontmatter not graded by the team."), ""];
}

/* ===========================================================================
 * THE TENSIONS DISCLOSED (R1, R17; N345: DEC-76 item 4, DEC-84 items 11–13, DEC-85). Fixed words: the templates a
 * member's block carries per tension, the highlight's sentence in the document, and the words a refusal names a
 * half-seen conflict with (the ceremony's sentence before the act stays `case-authoring`'s, its R32). A side the
 * publisher could not see has no field here to be written into: every entry that is highlighted carries its seen side
 * only.
 * =========================================================================== */

/** R1: the member block's sentence per tension, by the candidate's standing (`template`). */
export const TENSION_TEMPLATES = Object.freeze({
  in_tension: `${word("case-disclosures.tension_resolved")} `,
  explained: `${word("case-disclosures.explained_shown")} `,
  irreconcilable: `${word("case-disclosures.held_irreconcilable_group")} `,
  unseen: `${word("case-disclosures.rests_side_conflict")} `,
});
/** R1 (DEC-85): the highlighted entry's fixed sentence. */
export const HIGHLIGHT_SENTENCE = word("case-disclosures.finding_rests_side");
/** R1 (C-120.1): how a refusal names a candidate whose other side the owner may not see. */
export const NOT_SHOWN_WORDS = word("case-disclosures.conflict_record_shown");
/** R1, from `contradiction` R29: the disclosure reaches one level (DEC-84 item 12). */
export const TENSIONS_DEPTH_STATED = word("case-disclosures.conflict_disclosed_something");

/** A side as the document states it: its text verbatim (a claim's or stance's claim, a leg's note or reference, an
 *  extent's reference), its source, stated date, doctype and capture, each null where the record states none. */
export function tensionSide(side) {
  const s = side && typeof side === "object" ? side : {};
  const src = s.source && typeof s.source === "object" ? s.source : {};
  const text = s.text ?? s.claim ?? s.note ?? s.ref ?? s.content_id ?? null;
  return { kind: s.kind ?? null, text: text == null ? null : String(text),
           source: src.inquiry ?? src.bundle ?? s.inquiry ?? s.target ?? null,
           date: s.date ?? null, doctype: s.doctype ?? null, capture: s.capture_sha ?? null };
}

/** R1: which template a disclosed entry's member block carries. A highlighted entry carries the last one, and not its
 *  state's own sentence. */
export function tensionTemplate(t) {
  if (t.unseen_other_side) return "unseen";
  if (t.state === "resolved" && t.kind === "irreconcilable") return "irreconcilable";
  if (t.state === "explained_not_shown") return "explained";
  return "in_tension";
}

const quoted = (x) => (x.text == null ? word("case-disclosures.text_stated") : `'${x.text}'`) + (x.source ? ` (${x.source})` : "");

/** R1: the member block's sentence for one disclosed entry, from its template, attributed to who disclosed it. It names
 *  nothing of a side not seen (R17). */
export function tensionSentence(t) {
  const k = tensionTemplate(t);
  const what = k === "unseen" ? quoted(t.side)
    : k === "explained"
      ? localize("case-disclosures.document.explanation_against", "{explanation} — {a} against {b}", { explanation: String(t.explanation ?? word("case-disclosures.explanation_stated")), a: quoted(t.a), b: quoted(t.b) })
    : localize("case-disclosures.document.a_against_b", "{a} against {b}", { a: quoted(t.a), b: quoted(t.b) });
  return word("case-disclosures.conflict_disclosed", { tension_templates: String(TENSION_TEMPLATES[k]), what: String(what), candidate: String(t.candidate), acknowledged_by: String(t.acknowledged_by), acknowledged_at: String(t.acknowledged_at) });
}

const STATE_WORDS = Object.freeze({ open: localize("case-disclosures.document.state_open", "open"), explained_not_shown: word("case-grammar.explained_not_shown"),
  taken_up: word("case-disclosures.taken_question"), resolved: word("case-disclosures.held_irreconcilable_reopened") });

/** R18: a leg a conflict could not be looked for on (it names no content row), stated per member, never filled. */
export function tensionsUnreadStated(unread) {
  return unread.map((u) => word("case-disclosures.leg_name_passage", { legs: String(u.legs), finding: String(u.finding) })).join(" ");
}

export function tensionFrontmatterLines(tensions, unread = []) {
  const q = (v) => (v == null ? "null" : `"${fmSafe(v)}"`);
  const sideLines = (prefix, x) => [
    `    ${prefix}_kind: ${x.kind ?? "null"}`, `    ${prefix}_text: ${q(x.text)}`, `    ${prefix}_source: ${q(x.source)}`,
    `    ${prefix}_date: ${q(x.date)}`, `    ${prefix}_doctype: ${q(x.doctype)}`, `    ${prefix}_capture: ${x.capture ?? "null"}`];
  return [
    `tensions_disclosed: ${tensions.length}`,
    `tensions_highlighted: ${tensions.filter((t) => t.unseen_other_side).length}`,
    `tensions_depth_stated: "${fmSafe(TENSIONS_DEPTH_STATED)}"`,
    "case_tensions_unread:",
    ...unread.flatMap((u) => [`  - target: ${u.finding}`, `    legs: ${u.legs}`]),
    "case_tensions:",
    ...tensions.flatMap((t) => [
      `  - candidate: ${t.candidate}`,
      `    finding: ${t.finding}`,
      `    state: ${t.state}`,
      `    kind: ${t.kind ?? "null"}`,
      `    unseen_other_side: ${!!t.unseen_other_side}`,
      "    depth: 1",
      `    acknowledged_by: ${t.acknowledged_by}`,
      `    acknowledged_at: "${t.acknowledged_at}"`,
      `    words: ${q(t.words)}`,
      ...(t.unseen_other_side
        ? [...sideLines("side", t.side), `    highlight: "${fmSafe(HIGHLIGHT_SENTENCE)}"`]
        : [`    explanation: ${q(t.explanation)}`, ...sideLines("a", t.a), ...sideLines("b", t.b)])]),
    "case_tension_sentences:",
    ...tensions.flatMap((t) => [
      `  - target: ${t.finding}`,
      `    candidate: ${t.candidate}`,
      `    template: ${tensionTemplate(t)}`,
      `    sentence: "${fmSafe(tensionSentence(t))}"`])];
}

export function tensionBodyLines(tensions, unread = []) {
  const notStated = localize("case-disclosures.document.not_stated", "not stated");
  const side = (label, x) => localize("case-disclosures.document.label_v1_source_v2_dated", "  - {label}: {v1} — source {v2}, dated {v3}, {v4}{v5}", { label: String(label), v1: String(x.text == null ? word("case-disclosures.text_stated") : x.text), v2: String(x.source ?? notStated), v3: String(x.date ?? notStated), v4: String(x.doctype ?? localize("case-disclosures.document.doctype_not_stated", "doctype not stated")), v5: String(x.capture ? localize("case-disclosures.document.capture_stated", ", capture {capture}", { capture: String(x.capture) }) : "") });
  return [localize("case-disclosures.document.tensions_disclosed_heading", "## Tensions Disclosed"), "",
    ...(tensions.length
      ? [localize("case-disclosures.document.each_unresolved_conflict_the_record", "Each unresolved conflict the record holds on what this case's findings rest on, disclosed by the publisher. A case is published with its conflicts disclosed, and never refused because one exists (DEC-76 item 4)."), "",
         ...tensions.flatMap((t) => [
           localize("case-disclosures.document.tension_entry", "- **{finding}**, conflict {candidate}: {state}{highlighted}.", { finding: String(t.finding), candidate: String(t.candidate), state: String(STATE_WORDS[t.state] ?? t.state), highlighted: String(t.unseen_other_side ? localize("case-disclosures.document.highlighted", " — HIGHLIGHTED") : "") }),
           ...(t.unseen_other_side
             ? [side(word("case-disclosures.side_case_rests"), t.side), `  - ${HIGHLIGHT_SENTENCE}`]
             : [side(localize("case-disclosures.document.one_side", "one side"), t.a), side(word("case-disclosures.side"), t.b),
                ...(t.explanation != null ? [`  ${word("case-disclosures.explanation_recorded", { explanation: String(t.explanation) })}`] : [])]),
           ...(t.words != null ? [`  - ${word("case-disclosures.owner_words", { words: String(t.words) })}`] : []),
           `  ${word("case-disclosures.acknowledged", { acknowledged_by: String(t.acknowledged_by), acknowledged_at: String(t.acknowledged_at) })}`]),
         "", TENSIONS_DEPTH_STATED]
      : [word("case-disclosures.record_held_unresolved", { value: String(TENSIONS_DEPTH_STATED) })]),
    ...(unread.length ? ["", tensionsUnreadStated(unread)] : []),
    ""];
}

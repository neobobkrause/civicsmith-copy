/* wizard-scripts: writing help in a member's own words (requirements: `build/requirements/wizard-scripts.md`, R24, R25;
 * DEC-152, DEC-153; the Roles canon's rules 1, 7 and 9; K1818, K1837, K1841). Pure: where the assistant may help word a
 * field (R24), and the check every draft it words passes before a member sees it (R25). Nothing here writes, calls a
 * model or throws. The draft itself is the assistant's model turn, layer 6's (N686, T35); until then `op=writinghelp`
 * answers `ASSISTANT_DRAFT_UNAVAILABLE` past every refusal (R27, in `index.mjs`). */

/** R24 item 2: the acts DEC-153 (4) names, the assistant never helping word them. */
export const HELP_NAMED_REFUSED = Object.freeze(["release", "conclude", "withdrawconclusion", "reopen", "caseratify", "publish",
                                                 "personexpunge", "bootstrap"]);
/** R24 item 2: the acts of publishing at a set time, which their owners refuse a machine by name (`ratification` C-32.13,
 *  `publication` R68, `affordances` R42), and `groupdescriptionset`, which keeps its own guided draft (`instance-setup`
 *  R65; DEC-153 (4)). */
export const HELP_SET_TIME_REFUSED = Object.freeze(["publishat", "publishatmove", "publishatcancel", "groupdescriptionset"]);
/** R24 item 2: this module's named list, frozen: DEC-153 (4)'s acts, then the set-time publishing acts and
 *  `groupdescriptionset` (B3, K1861 (1): affordances R44 reads it through `writingHelpRefused`). */
export const WRITING_HELP_NAMED = Object.freeze([...HELP_NAMED_REFUSED, ...HELP_SET_TIME_REFUSED]);
/** R25: the acts whose field records what the member saw, where the draft words only what the member told it (DEC-153
 *  (2): "testimony stays the witness's"). The registry's capture and calculation screens hold one such act today. */
export const FIRSTHAND_ACTS = Object.freeze(["testify"]);
/** R27: the most a member tells the assistant in one request. */
export const TOLD_MAX = 4000;

const nameSet = (v) => new Set(v instanceof Set ? [...v] : Array.isArray(v) ? v.filter((x) => typeof x === "string")
  : v && typeof v === "object" ? Object.keys(v) : []);

/** R24 item 2: every act the assistant never helps word, from a registration's `machineRefused` and `irreversible` (read
 *  as registered) and this module's named lists. */
export function helpRefusedActs({ machineRefused = [], irreversible = [] } = {}) {
  return new Set([...nameSet(machineRefused), ...nameSet(irreversible), ...WRITING_HELP_NAMED]);
}

/** R24 item 3: whether `field` is where an act sends the member's reason (the `reason` a reasoned act requires, or any
 *  field named for a reason). The machine never words a member's reason (the Roles canon's rule 1; K1841 (1)). */
export function isReasonField(field) {
  return typeof field === "string" && /reason$/i.test(field.trim());
}

/** R24 item 1 (T37; N765, K231, K2175): the code of a keep-away as `ai-accounts.aiKeptAway()` answers it (its R7, the
 *  one site that mints it): `away` null while the group does not keep its material away; its refusal otherwise, also
 *  when the setting cannot be read; anything else (ai-accounts not reached) is read as kept away, failing closed as
 *  that service does. */
export const KEPT_AWAY = "AI_KEPT_AWAY";
const keptAwayCode = (away) => (away === null ? null : KEPT_AWAY);

/** R24 (pure): `{offered: true}` or `{offered: false, code}` for one field of `op`, in R24's order: the group keeping its
 *  material away from AI (`away`, `ai-accounts.aiKeptAway()`'s answer read at the call; never `assistant.on`, a copy
 *  of the condition) or no account serving the viewer; an act the assistant is refused or that cannot be undone; a
 *  field stating the member's reason; a labelled draft already in the field. `refused` is `helpRefusedActs` of the
 *  registration; an `away` not given is not a reading, and fails closed. */
export function writingHelpAt(args = {}, refused = helpRefusedActs(), away = undefined) {
  try {
    const { op = null, field = null, draftHeld = false, assistant = null } = args && typeof args === "object" ? args : {};
    const a = assistant && typeof assistant === "object" ? assistant : {};
    const kept = keptAwayCode(away);
    if (kept) return { offered: false, code: kept };
    if (!a.account) return { offered: false, code: "AI_NO_ACCOUNT" };
    /* DEC-49 REGION is-writing-help */
    if (typeof op !== "string" || !op.trim() || refused.has(op.trim())) return { offered: false, code: "WRITING_HELP_REFUSED" };
    if (isReasonField(field)) return { offered: false, code: "WRITING_HELP_REASON_FIELD" };
    if (draftHeld === true || (draftHeld && typeof draftHeld === "object")) return { offered: false, code: "WRITING_HELP_DRAFT_HELD" };
    /* END DEC-49 REGION is-writing-help */
    return { offered: true };
  } catch { return { offered: false, code: "WRITING_HELP_REFUSED" }; }
}

/* ---------------------------------------------------------------- R25: the no-added-fact check */

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november",
                "december", "jan", "feb", "mar", "apr", "jun", "jul", "aug", "sep", "sept", "oct", "nov", "dec", "monday", "tuesday",
                "wednesday", "thursday", "friday", "saturday", "sunday"];
const MONTH_RE = new RegExp(`\\b(${MONTHS.join("|")})\\b`, "gi");
const FIGURE_RE = /\d(?:[\d,.]*\d)?/g;
const QUOTE_RE = /"([^"]+)"|“([^”]+)”/g;
const WORD_RE = /[A-Za-zÀ-ɏ][A-Za-zÀ-ɏ'’-]*/g;
const flat = (s) => s.toLowerCase().replace(/\s+/g, " ").trim();
const figure = (s) => s.replace(/,/g, "").replace(/\.$/, "");

/** R25: the sentences of a text, each whole. */
export function sentencesOf(text) {
  return String(text).split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
}

/** R25: what a sentence states that must come from what the member told or what the group holds: each figure, each date
 *  word (a month or a weekday), each quotation, and each name (a capitalised word that is not the sentence's first, or
 *  a first word that a second capitalised word follows; "I" is no name). */
export function factsOf(sentence) {
  const s = String(sentence);
  const facts = [];
  for (const m of s.matchAll(QUOTE_RE)) facts.push({ kind: "quotation", value: m[1] ?? m[2] });
  const bare = s.replace(QUOTE_RE, " ");
  for (const m of bare.matchAll(FIGURE_RE)) facts.push({ kind: "figure", value: figure(m[0]) });
  for (const m of bare.matchAll(MONTH_RE)) facts.push({ kind: "date", value: m[1].toLowerCase() });
  const words = [...bare.matchAll(WORD_RE)].map((m) => m[0]);
  words.forEach((w, i) => {
    if (!/^[A-ZÀ-Þ]/.test(w) || w === "I" || MONTHS.includes(w.toLowerCase())) return;
    if (i === 0 && !(words[1] && /^[A-ZÀ-Þ]/.test(words[1]) && words[1] !== "I")) return;
    facts.push({ kind: "name", value: w.replace(/['’]s$/, "") });
  });
  return facts;
}

/* Whether a fact is in the sources (what the member told, what the record read holds). */
function heldIn(fact, sources) {
  const text = sources.join("\n");
  if (fact.kind === "quotation") return flat(text).includes(flat(fact.value));
  if (fact.kind === "figure") return [...text.matchAll(FIGURE_RE)].some((m) => figure(m[0]) === fact.value);
  if (fact.kind === "date") return [...text.matchAll(MONTH_RE)].some((m) => m[1].toLowerCase() === fact.value);
  return new RegExp(`(^|[^A-Za-z\\u00C0-\\u024F])${fact.value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?![a-z\\u00DF-\\u024F])`).test(text);
}

const asTexts = (v) => (typeof v === "string" ? [v] : Array.isArray(v) ? v.map((x) => (typeof x === "string" ? x
  : x && typeof x === "object" && typeof x.text === "string" ? x.text : null)).filter((x) => typeof x === "string") : []);

/** R25 (pure; `answers` R4's form): `{ok: true, text, withheld, label}` or `{ok: false, code}`. A read is refused while
 *  the serving account's suggestions switch is off (`WRITING_HELP_SUGGESTIONS_OFF`) and on a firsthand field
 *  (`WRITING_HELP_FIRSTHAND_READ`); otherwise each sentence stating a figure, a date, a name or a quotation that is in
 *  neither `told` nor `readLog` is withheld whole (`WRITING_HELP_FACT_ADDED`), never rewritten. The text is answered
 *  with its label `{kind: "machine", asked_by}` and is never stored. Writes nothing; never throws. */
export function checkDraft(text, opts = {}) {
  try {
    const { told = [], readLog = [], firsthand = false, suggestions = false, askedBy = null } = opts && typeof opts === "object" ? opts : {};
    const read = asTexts(readLog);
    const sources = [...asTexts(told), ...read];
    const kept = [], withheld = [];
    /* DEC-49 REGION is-writing-help-check */
    if (read.length && suggestions !== true) return { ok: false, code: "WRITING_HELP_SUGGESTIONS_OFF" };
    if (read.length && firsthand === true) return { ok: false, code: "WRITING_HELP_FIRSTHAND_READ" };
    for (const sentence of typeof text === "string" ? sentencesOf(text) : []) {
      if (factsOf(sentence).every((f) => heldIn(f, sources))) kept.push(sentence);
      else withheld.push({ sentence, code: "WRITING_HELP_FACT_ADDED" });
    }
    /* END DEC-49 REGION is-writing-help-check */
    return { ok: true, text: kept.join(" "), withheld, label: { kind: "machine", asked_by: typeof askedBy === "string" ? askedBy : null } };
  } catch { return { ok: false, code: "WRITING_HELP_FACT_ADDED" }; }
}

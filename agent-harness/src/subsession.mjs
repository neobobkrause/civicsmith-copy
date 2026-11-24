/* agent-harness (T33-54): copied from `agent-worker/src/subsession.mjs` with no change of meaning (agent-harness R5, R7,
 * R8, R9). The suites this header names are agent-worker's. */
/* FL-5 / IS-9(a) — THE SUB-SESSION CONTRACTS: WHAT GOES OUT, AND WHAT MAY COME
 * BACK. Pure, for the same recorded reason `harness.mjs` is pure.
 *
 * `INVESTIGATIVE-SESSION.md` §14b.1 is the whole item, and it is a MEMORY MODEL
 * rather than a speed optimisation:
 *
 *   *"Sub-sessions return REPORTS, not their reading. A search sub-session reads
 *    widely in its own context and hands back what it found — never the
 *    documents. This is why §14a's fan-out is not merely a speed optimisation:
 *    it is the memory model. Without it a run drowns in its own evidence."*
 *
 *   *"The consequence for the fan-out is a RULE, not a preference: a sub-session
 *    that returns documents rather than reports HAS DEFEATED THE ARCHITECTURE.
 *    Its contract is a REPORT with a citation, and the parent re-reads by address
 *    if it needs the bytes. The same contract is where §14's fence lands: the
 *    spawn payload carries no bias manifest, BY CONSTRUCTION."*
 *
 * ---------------------------------------------------------------------------
 * WHY THIS IS AN EXACT KEY SET AND NOT A LIST OF BANNED FIELDS
 * ---------------------------------------------------------------------------
 *
 * The obvious spelling of "never documents" is a denylist — refuse `bytes`,
 * `body`, `text`, `html`, `pdf`, `base64`. **That is the defect WORKER.md names
 * in its own words: invert, do not lengthen a list. A list of spellings goes
 * stale the moment a fourth is written**, and the fourth here is free — a
 * sub-session returning `{ raw: <the whole document> }` passes a denylist of
 * three and has defeated the architecture exactly as thoroughly.
 *
 * So the rule is inverted and it is TWO structural properties, neither of which
 * knows any field name a document might arrive under:
 *
 *   1. **AN EXACT KEY SET.** A REPORT carries `REPORT_KEYS` and nothing else; a
 *      citation carries `CITATION_KEYS` and nothing else. An unrecognised key is
 *      REFUSED AND NAMED — never dropped, because a caller told its input was
 *      silently discarded learns nothing and will send it again.
 *   2. **A BOUND ON THE PROSE.** A key set alone does not close it: a whole
 *      document fits inside a field named `summary`. Every free-text field
 *      carries a ceiling, the citation list carries a count, and the report's
 *      whole canonical size is checked against a bound COMPUTED from those parts
 *      rather than typed — so a key added here tomorrow widens the arithmetic
 *      instead of escaping it.
 *
 * What that pair CANNOT see, stated plainly because the next reader needs it:
 * it cannot tell a truthful 400-character summary from a fabricated one, and it
 * cannot stop a sub-session splitting a document across many runs. It closes the
 * SHAPE, which is what "returns documents" means as a contract; it is not a
 * truthfulness check and nothing here should be read as one.
 *
 * ---------------------------------------------------------------------------
 * WHY AN ABSENCE IS NOT REQUIRED TO CITE ANYTHING
 * ---------------------------------------------------------------------------
 *
 * "A REPORT with a citation" is the contract for a report that FOUND something.
 * D-129's vocabulary makes four other claims possible, and only `PRESENT` and
 * `partial` are claims that something is there. An absence has nothing to cite,
 * and requiring a citation from it would be `CLAUDE.md`'s own named bug: *"a gate
 * that pressures someone into inventing one is a bug in the gate."* A
 * `LOOKED_ABSENT` report that cited a document to prove the document was not
 * there is precisely the invented attribution the record's rules exist to refuse.
 *
 * What IS required of every report that looked is an OBSERVATION ADDRESS
 * (`observed_at`) — where in the run's own log the search that establishes this
 * claim was written. That is not a citation of evidence; it is what makes the
 * claim CHECKABLE by someone who was not there, which is §11's whole argument for
 * the log, and PL-3 refuses §9's `level-empty` kind without it.
 *
 * ---------------------------------------------------------------------------
 * D-164, AND WHY A CITATION HAS EXACTLY ONE FIELD
 * ---------------------------------------------------------------------------
 *
 * §14b.2 declares the precondition rather than discovering it: legs are
 * DOCUMENT-GRAIN today, *"versions compose document-grain legs, the passage lives
 * in the version's description, and the record cannot yet cite the sentence."*
 * So a citation here is an ADDRESS and nothing else. An `extent` field would be a
 * field for a grain the record cannot express — a shape that reads as coverage
 * and carries none, which is the false-coverage hazard this project keeps
 * meeting. The passage goes in `summary`, exactly where §14b.2 puts it, and when
 * D-164 lands the extent belongs on the LEG and arrives here as a second field
 * with a suite behind it rather than as a hole somebody filled in.
 *
 * ---------------------------------------------------------------------------
 * NO DEC-49 FAMILY IS OWED HERE, and it is the same decision `index.mjs` records
 * ---------------------------------------------------------------------------
 *
 * DEC-49's reach is "every code a SURFACE can receive". No member receives these:
 * this Worker has no member-facing surface and its only caller is the plane (the
 * DEC-49 guard that walked the plane's codes,
 * never walked the fleet, and was deleted with the old battery in T20). The
 * convention — a code as a STRING LITERAL at its site through a helper named
 * `refusal` — is followed anyway, because it costs nothing and it is what a check
 * that reads these codes would need the day one is owed.
 * ========================================================================= */

import { LEVELS } from "./harness.mjs";
/* R11 (R085-11): the record's condition vocabulary, which `checkCondition` checks a report's `condition` against. Read
   from observation-log, its owner (modules.json `uses`, K3491), so the kinds offered to a sub-session are the kinds the
   plane admits. */
import { CONDITION_KINDS } from "../../bio-plane/src/observation-log/vocabulary.mjs";
import { word, localize } from "../../bio-plane/src/setup-words/index.mjs";

/* D-129's five, and this is a COPY of the plane's `OBSERVATION_STATES`, pinned
   to run-rules' export in `test/fanout.test.mjs` and the requirements suite (R44) — the same
   decision `harness.mjs` records for `LEVELS`, for the same two reasons: a fleet
   member ships alone, and the plane publishes no op that names them. A sixth
   state added there fails this member's suite rather than silently arriving in a
   report nothing can classify.

   AND THE SPELLING IS NOT WHAT THIS FILE VALIDATES. `checkCondition` (C-22.4) is
   the plane's and stays the plane's: a report's `condition` travels through this
   member UNREAD, because a second copy of the record's condition vocabulary here
   would be a rule with two implementations, which run-rules already records as
   a control that proves nothing about either. */
export const REPORT_STATES = {
  NEVER_LOOKED:         "nobody looked at this level for this subject",
  LOOKED_ABSENT:        "we looked and it is positively not there",
  LOOKED_INDETERMINATE: "we looked and could not tell",
  PRESENT:              "we looked and it is there",
  partial:              word("observation-log.partial.looked_got_part"),
};

/* THE TWO STATES THAT CLAIM SOMETHING IS THERE, and therefore the two that owe a
   citation. Named as a set rather than tested at each site, so a sixth state
   added above inherits the rule or fails loudly — run-rules' DEFINITIVE_STATES
   reasoning, one contract over. Note this set is NOT that one: `LOOKED_ABSENT` is
   definitive about the world and cites nothing, because there is nothing to
   cite. */
export const FOUND_STATES = new Set(["PRESENT", "partial"]);

/* A state that LOOKED owes the address of the search that establishes it. Only
   `NEVER_LOOKED` is exempt, because nobody looked and there is no observation to
   point at — an unrun search is not an absence (§9, and `emptyLevelCandidates`
   turns on exactly this distinction). */
export const LOOKED_STATES = new Set(
  Object.keys(REPORT_STATES).filter((s) => s !== "NEVER_LOOKED"));

/* ------------------------------------------------------------ THE BOUNDS
 *
 * `SUMMARY_MAX` is a CEILING and not a measured optimum, and saying so is the
 * point: its job is that the field cannot BECOME the document. 500 is this
 * member's existing figure for one bounded prose field — `stepLog` already cuts
 * an observation entry's `detail` at 500 — so the run carries one number rather
 * than two that drift.
 *
 * `REPORT_MAX_BYTES` is COMPUTED from the parts, never typed. A key added to
 * `REPORT_KEYS` tomorrow widens this arithmetic instead of escaping it, and the
 * whole-report check is the belt that catches a field nobody thought to bound. */
export const SUMMARY_MAX = 500;
export const ADDRESS_MAX = 200;
export const CITATIONS_MAX = 20;

/* THE REPORT, AS AN EXACT KEY SET. `true` marks the keys a report must carry;
   the rest are optional and everything absent from this object is REFUSED. */
export const REPORT_KEYS = {
  level:      true,   /* which of the four this sub-session searched */
  state:      true,   /* D-129 — what the search ESTABLISHED, never a boolean */
  observed_at: false, /* the observation-log address, owed by anything that looked */
  summary:    false,  /* the conclusion, in prose, BOUNDED. §14b.2's "the passage" */
  citations:  false,  /* addresses the parent can re-read. NEVER the bytes */
  governed:   false,  /* D-104 — our governor holding a host is a fact about US */
  condition:  false,  /* the record's condition vocabulary. Validated by the PLANE */
};

/* A CITATION IS AN ADDRESS. One field, for D-164's reason above. */
export const CITATION_KEYS = { address: true };

/* WHAT A SEARCH SUB-SESSION MAY NAME, AND IT IS A READ SET WITH NO WRITE IN IT.
 *
 * "The parent holds the only write and the only manifest" is the plan row's
 * sentence, and this is the half of it a suite can measure: every op here must be
 * one `agent-worker`'s `PLANE_OPS` (its `ops.mjs`) declares `mutating: false`,
 * checked by its `test/fanout.test.mjs` rather than against this comment, and
 * control-plane pins that declaration op by op to the plane's own table (N402). An
 * op that turns mutating fails a suite rather than a sub-session quietly gaining a
 * write.
 *
 * IT GRANTS NOTHING, exactly as `PLANE_OPS` grants nothing (D-199 (2)): what a
 * credential may reach is a row a MEMBER authored, read at the plane's gate by
 * `aiTaskScope`. This is a DECLARATION of what a sub-session's brief says it is
 * for, so the suite can pin it — floor and ceiling both.
 *
 * WHY THE INTERNET LEVEL IS NOT AN EXCEPTION. `capturerequest` is mutating and is
 * NOT here: a sub-session that could ask the record to acquire something would be
 * a second party spending the run's fetch budget and writing to PL-4's table. The
 * internet level's sub-session REPORTS what it would need; the PARENT requests
 * acquisition, which is the same division the harness already drives. */
export const SUBSESSION_OPS = ["meaningrows"];

/* THE SPAWN CONTRACT'S EXACT KEYS. Built as an explicit literal in
   `spawnContract` — never by spreading the plane's payload and deleting fields,
   because a delete-list is a list that falls behind the thing it lists (D-113's
   lesson, and `store.mjs` writes the payload itself the same way for the same
   reason). THIS IS WHAT "BY CONSTRUCTION" MEANS HERE: there is no field for a
   manifest to arrive in, under ANY spelling, because the object's keys are these
   and are written out one by one. */
export const SPAWN_KEYS = ["level", "run", "context", "mode", "skill",
                           "standard_pair", "standard", "scope", "subjects", "arms", "returns"];

/* R12: the most subjects one contract carries, the payload's and the level's targets together. */
export const SUBJECTS_MAX = 50;

function refusal(code, detail, extra) {
  return { ok: false, code, reason: code, detail, ...(extra || {}) };
}

/* --------------------------------------------------------------- THE SPAWN */

/** Deep-freeze, so a contract handed to one sub-session cannot become a channel
 *  to another. §14b.1's "sub-sessions share no state" is not a promise this
 *  member makes; it is a property of the objects it hands out. */
function deepFreeze(value) {
  if (value === null || typeof value !== "object") return value;
  for (const k of Object.keys(value)) deepFreeze(value[k]);
  return Object.freeze(value);
}

/** R12: the subjects a level's sub-session is briefed with — the payload's `subjects.items` (each read key by key,
 *  `{id, extent, kind}`), then the level's `targets` (each `{id, extent}` as given, `kind: "target"`). Deduplicated
 *  by `id` and `extent` (the first occurrence stays), at most SUBJECTS_MAX. An absent list gives none. */
function subjectsFor(payload, targets) {
  const items = Array.isArray(payload.subjects?.items) ? payload.subjects.items : [];
  const listed = Array.isArray(targets) ? targets : [];
  const seen = new Set();
  const out = [];
  const add = (id, extent, kind) => {
    const key = JSON.stringify([id, extent]);
    if (seen.has(key) || out.length >= SUBJECTS_MAX) return;
    seen.add(key);
    out.push({ id, extent, kind });
  };
  for (const item of items) add(item?.id ?? null, item?.extent ?? null, item?.kind ?? null);
  for (const target of listed) add(target?.id ?? null, target?.extent ?? null, "target");
  return out;
}

/** THE SPAWN CONTRACT for ONE level's sub-session.
 *
 *  `payload` is the PLANE's search-half payload (`op=airunspawn`, PL-12). It is
 *  read key by key and never spread. `targets` is the level's targets the plan
 *  judgement named, and `arms` the meaning arms the caller passes (R12).
 *
 *  AND THE SECOND WITNESS. A search payload that arrives CARRYING a manifest is
 *  refused here rather than merely ignored, and that is the difference between a
 *  fence and a habit: PL-12's fence is asserted in the plane's own suite, and a
 *  fence proved only at its own site is a fence with one witness. This member is
 *  the party that would be harmed if it failed, so it checks — and it REFUSES,
 *  because a search half that has been handed the lens has already been handed
 *  it, and continuing would mean the run searched under a bias nobody can now
 *  prove it did not use. */
export function spawnContract({ level, payload, arms, targets } = {}) {
  if (!LEVELS.includes(String(level)))
    return refusal("SPAWN_LEVEL_UNKNOWN",
      localize("agent-harness.subsession.string_is_not_one_of", "'{String}' is not one of the four levels a run searches: {LEVELS}. A fan-out that spawned a level nobody declared would be searching somewhere the observation log has no word for.", { String: String(String(level)), LEVELS: String(LEVELS.join(", ")) }));

  if (payload == null || typeof payload !== "object")
    return refusal("SPAWN_PAYLOAD_MISSING",
      localize("agent-harness.subsession.the_plane_returned_no_search", "the plane returned no search-half payload for this run, and this member composes none of its own: a run's conditions are the record's. There is nothing to brief a sub-session with."));

  /* THE LENS, REFUSED BY NAME AND BY SHAPE. `bias` is the key the plane's
     composing half uses, so it is named — but the arm that actually protects the
     contract is the EXACT KEY SET below, which admits no unnamed field at all. */
  if (Object.prototype.hasOwnProperty.call(payload, "bias"))
    return refusal("SPAWN_PAYLOAD_CARRIES_LENS",
      localize("agent-harness.subsession.the_search_half_payload_arrived", "the search-half payload arrived carrying the run's bias manifest. §14: the search half never receives the lens — bias never shapes what is captured or searched, only how conclusions are weighed — and the spawn contract omits it BY CONSTRUCTION, so there should be no field here to read. This member refuses rather than ignoring it: a search half that has been handed the lens has been handed it, and a run that continued could not later prove it did not use it."));

  const contract = deepFreeze({
    /* THE ONE THING THAT DIFFERS BETWEEN THE FOUR, and the reason each
       sub-session searches somewhere rather than everywhere. */
    level: String(level),
    run: payload.run ?? null,
    /* BUILT FRESH, not aliased: two contracts sharing one `context` object would
       be two sub-sessions sharing state through the parent's own brief. */
    context: { type: payload.context?.type ?? null, id: payload.context?.id ?? null },
    mode: payload.mode ?? null,
    skill: payload.skill ?? null,
    /* THE BAR TRAVELS AND THE LENS DOES NOT, and that distinction is DEC-54 (a):
       a standard pair tells the search what strength the work must reach, which
       is not the coupling §14 forbids. Both spellings the plane publishes are
       carried — the column verbatim and REC-74's judged block — because a caller
       receiving a bare `null` cannot tell "no bar was in force" from "this reader
       does not publish the fact". */
    standard_pair: payload.standard_pair ?? null,
    /* READ KEY BY KEY, AND THE FIRST DRAFT OF THIS LINE SPREAD THE BLOCK —
       CAUGHT BY THIS ITEM'S OWN KEY-TREE ARM ON ITS FIRST RUN, not by review. A
       spread here would have been the delete-list defect wearing the other
       costume: whatever the plane adds to `#standardForRun`'s return tomorrow
       would ride into a sub-session's brief, which is precisely the property
       "by construction" is supposed to deny. The four keys are the plane's own
       and they are named. */
    standard: payload.standard == null ? null : {
      in_force: payload.standard.in_force ?? null,
      basis: payload.standard.basis ?? null,
      stated: payload.standard.stated ?? null,
      pair: payload.standard.pair ?? null,
    },
    /* NO WRITE. See SUBSESSION_OPS. */
    scope: [...SUBSESSION_OPS],
    /* R12: what the sub-session looks at, built fresh from the payload and the targets (never aliased). */
    subjects: subjectsFor(payload, targets),
    arms: (Array.isArray(arms) ? arms : []).map((arm) => String(arm)),
    /* THE RETURN CONTRACT TRAVELS WITH THE BRIEF. A sub-session that is told what
       it may return is a sub-session whose violation is a defect rather than a
       misunderstanding — and the parent validates it on the way back regardless,
       because a contract enforced only by telling somebody about it is a skill
       and not a fence (§14b.4). */
    returns: {
      keys: Object.keys(REPORT_KEYS),
      required: Object.keys(REPORT_KEYS).filter((k) => REPORT_KEYS[k]),
      citation_keys: Object.keys(CITATION_KEYS),
      states: Object.keys(REPORT_STATES),
      summary_max: SUMMARY_MAX,
      /* R11: the condition kinds the plane admits, in the vocabulary's fixed order. */
      conditions: Object.keys(CONDITION_KINDS),
      citations_max: CITATIONS_MAX,
      address_max: ADDRESS_MAX,
      rule: localize("agent-harness.subsession.return_a_report_with_a", "return a REPORT with a citation, never documents. The parent re-reads by address."),
    },
  });

  return { ok: true, contract };
}

/** THE WHOLE FAN-OUT: one contract per level, all four, in LEVELS order.
 *
 *  The count is the TABLE's and not a judgement's — a run that searched three
 *  levels and reported on four is the false-coverage hazard, and taking the count
 *  from `LEVELS` is what makes it uncountable any other way. */
export function spawnContracts(payload) {
  const contracts = [];
  for (const level of LEVELS) {
    const made = spawnContract({ level, payload });
    if (!made.ok) return made;
    contracts.push(made.contract);
  }
  return { ok: true, contracts };
}

/* -------------------------------------------------------------- THE RETURN */

const size = (v) => JSON.stringify(v ?? null).length;

/** THE RETURN CONTRACT — IS-9(a), AND THE ITEM'S NAMED NEGATIVE CONTROL LIVES ON
 *  THIS FUNCTION. Neuter it and a document-returning sub-session must fail an
 *  assertion, because a sub-session that returns documents has defeated the
 *  architecture.
 *
 *  Returns `null` when the report honours the contract, or a refusal naming what
 *  broke. NULL-TOLERANT THROUGHOUT, on run-rules' recorded reason: a check
 *  that throws cannot NAME what it broke and takes every arm behind it with it. */
export function checkReport(report) {
  if (report == null || typeof report !== "object" || Array.isArray(report))
    return refusal("REPORT_NOT_AN_OBJECT",
      localize("agent-harness.subsession.a_sub_session_returns_a", "a sub-session returns a REPORT object. What arrived is not one."));

  /* (1) THE EXACT KEY SET. This is the arm that makes "never documents"
     independent of what a document is called: `bytes`, `body`, `raw`, `pdf`,
     `text`, or a spelling nobody has written yet are all simply not keys of a
     REPORT, and every one is refused by the same rule and NAMED. */
  const unknown = Object.keys(report).filter((k) => !(k in REPORT_KEYS));
  if (unknown.length)
    return refusal("REPORT_UNKNOWN_FIELD",
      localize("agent-harness.subsession.a_report_carries_exactly_keys", "a REPORT carries exactly {keys} — {unknown} {v1}. §14b.1: a sub-session hands back what it FOUND and never the documents; the parent re-reads by address. The contract is an exact key set rather than a list of banned spellings, because a list of spellings goes stale the moment a fourth is written.", { keys: String(Object.keys(REPORT_KEYS).join(", ")), unknown: String(unknown.join(", ")), v1: unknown.length === 1 ? localize("agent-harness.subsession.is_not_one_of_them", "is not one of them") : localize("agent-harness.subsession.are_not_among_them", "are not among them") }),
      { fields: unknown });

  const missing = Object.keys(REPORT_KEYS).filter((k) => REPORT_KEYS[k]
    && (report[k] == null || report[k] === ""));
  if (missing.length)
    return refusal("REPORT_INCOMPLETE",
      localize("agent-harness.subsession.a_report_must_name_missing", "a REPORT must name {missing}: which level was searched and what the search ESTABLISHED are the two things a parent cannot derive for itself.", { missing: String(missing.join(" and ")) }), { fields: missing });

  if (!LEVELS.includes(String(report.level)))
    return refusal("REPORT_LEVEL_UNKNOWN",
      localize("agent-harness.subsession.string_is_not_one_of_2", "'{String}' is not one of {LEVELS}. Absence at one level is not evidence of absence at the next, so a report that cannot say which level it is about establishes nothing at any of them.", { String: String(String(report.level)), LEVELS: String(LEVELS.join(", ")) }));

  if (!Object.prototype.hasOwnProperty.call(REPORT_STATES, String(report.state)))
    return refusal("REPORT_STATE_UNKNOWN",
      localize("agent-harness.subsession.string_is_not_one_of_3", "'{String}' is not one of {keys} (D-129). A report that cannot say what it ESTABLISHED is a report a later reader cannot check.", { String: String(String(report.state)), keys: String(Object.keys(REPORT_STATES).join(", ")) }));

  /* (2) WHERE THE SEARCH WAS WRITTEN DOWN. Not a citation of evidence — the
     address in the run's own log that lets somebody who was not there check the
     claim (§11), and what PL-3 requires before §9's `level-empty` kind. */
  if (LOOKED_STATES.has(String(report.state))
      && !(typeof report.observed_at === "string" && report.observed_at.trim() !== ""))
    return refusal("REPORT_UNLOCATED",
      localize("agent-harness.subsession.a_string_report_claims_something", "a '{String}' report claims something about the world and must say WHERE the search that establishes it was written in the run's observation log. A claim nobody can locate is a claim nobody can check, which is the whole reason the log exists (§11).", { String: String(String(report.state)) }));

  const cites = report.citations == null ? [] : report.citations;
  if (!Array.isArray(cites))
    return refusal("REPORT_CITATIONS_NOT_A_LIST",
      localize("agent-harness.subsession.citations_is_a_list_of", "`citations` is a list of addresses the parent can re-read. What arrived is not a list."));

  /* (3) A REPORT THAT FOUND SOMETHING OWES AN ADDRESS — and one that found
     NOTHING owes none, because an absence has nothing to cite and a gate that
     pressured it into inventing one would be a bug in the gate. */
  if (FOUND_STATES.has(String(report.state)) && cites.length === 0)
    return refusal("REPORT_NO_CITATION",
      localize("agent-harness.subsession.a_string_report_says_something", "a '{String}' report says something IS there and must cite where, by address. §14b.1: the contract is a REPORT with a citation and the parent re-reads by address. An absence cites nothing and is not held to this, because there would be nothing to cite.", { String: String(String(report.state)) }));

  if (cites.length > CITATIONS_MAX)
    return refusal("REPORT_OVER_BOUND",
      localize("agent-harness.subsession.length_citations_exceed_the_citations", "{length} citations exceed the {CITATIONS_MAX} a single report may carry. A report is a conclusion with addresses, and a list long enough to be the reading itself is the reading.", { length: String(cites.length), CITATIONS_MAX: String(CITATIONS_MAX) }),
      { bound: "citations", limit: CITATIONS_MAX, got: cites.length });

  for (const c of cites) {
    if (c == null || typeof c !== "object" || Array.isArray(c))
      return refusal("REPORT_CITATION_NOT_AN_ADDRESS",
        localize("agent-harness.subsession.a_citation_is_an_object", "a citation is an object carrying the address the parent re-reads by. What arrived is not one."));
    const extra = Object.keys(c).filter((k) => !(k in CITATION_KEYS));
    if (extra.length)
      return refusal("REPORT_CITATION_NOT_AN_ADDRESS",
        localize("agent-harness.subsession.a_citation_carries_exactly_keys", "a citation carries exactly {keys} — {extra} is not part of it. The parent re-reads BY ADDRESS; a citation that carried the content would be the document arriving inside the thing that exists to replace it.", { keys: String(Object.keys(CITATION_KEYS).join(", ")), extra: String(extra.join(", ")) }),
        { fields: extra });
    if (!(typeof c.address === "string" && c.address.trim() !== ""))
      return refusal("REPORT_CITATION_NOT_AN_ADDRESS",
        localize("agent-harness.subsession.a_citation_must_carry_a", "a citation must carry a non-empty address. An address the parent cannot re-read by is not a citation, it is a claim."));
    if (c.address.length > ADDRESS_MAX)
      return refusal("REPORT_OVER_BOUND",
        localize("agent-harness.subsession.an_address_of_length_characters", "an address of {length} characters exceeds {ADDRESS_MAX}. An address is how the parent re-reads; something this long is content wearing an address's field.", { length: String(c.address.length), ADDRESS_MAX: String(ADDRESS_MAX) }),
        { bound: "address", limit: ADDRESS_MAX, got: c.address.length });
  }

  /* (4) THE PROSE BOUND. The key set alone does not close the rule: a whole
     document fits inside a field called `summary`. */
  if (report.summary != null && typeof report.summary !== "string")
    return refusal("REPORT_SUMMARY_NOT_PROSE",
      localize("agent-harness.subsession.summary_is_what_the_sub", "`summary` is what the sub-session concluded, in prose. A structure here is the reading itself arriving under the field that exists to replace it."));
  if (typeof report.summary === "string" && report.summary.length > SUMMARY_MAX)
    return refusal("REPORT_OVER_BOUND",
      localize("agent-harness.subsession.a_summary_of_length_characters", "a summary of {length} characters exceeds {SUMMARY_MAX}. §14b.1: a sub-session hands back what it FOUND, never the documents — and a prose field with no ceiling is where a document arrives when every other door is shut.", { length: String(report.summary.length), SUMMARY_MAX: String(SUMMARY_MAX) }),
      { bound: "summary", limit: SUMMARY_MAX, got: report.summary.length });

  /* (5) THE WHOLE-REPORT BELT, computed from the parts above rather than typed,
     so a key added to REPORT_KEYS tomorrow widens the arithmetic instead of
     escaping it. */
  if (size(report) > REPORT_MAX_BYTES)
    return refusal("REPORT_OVER_BOUND",
      localize("agent-harness.subsession.this_report_serialises_to_size", "this report serialises to {size} bytes against a {REPORT_MAX_BYTES}-byte ceiling computed from the contract's own fields. Whatever it is carrying, it is not a conclusion.", { size: String(size(report)), REPORT_MAX_BYTES: String(REPORT_MAX_BYTES) }),
      { bound: "report", limit: REPORT_MAX_BYTES, got: size(report) });

  return null;
}

/* COMPUTED, NEVER TYPED. The citation list, the summary, and a fixed allowance
   for the small scalar fields and the JSON punctuation around them. */
export const REPORT_MAX_BYTES =
  SUMMARY_MAX + (CITATIONS_MAX * (ADDRESS_MAX + 20)) + 400;

/** THE FAN-IN. Every return is judged; the ones that honour the contract are
 *  TAKEN and the ones that do not are REFUSED AND NAMED.
 *
 *  A REFUSED RETURN DOES NOT BECOME AN ABSENCE, and that is the load-bearing
 *  half. The tempting shape is to drop the bad report and carry on, which would
 *  leave that level with no report at all — and a level with no report is
 *  indistinguishable from a level nobody searched. Worse, if a refused return
 *  could fall through to a `LOOKED_ABSENT`, a contract violation would MANUFACTURE
 *  an absence claim, and §9's empty-level kind would be written off a report the
 *  parent never accepted. So a refused level is UNDETERMINED, it is stated, and
 *  nothing downstream may read it as either an absence or a finding — which is
 *  `CLAUDE.md`'s "undetermined is first-class and must be STATED" applied at the
 *  one place a machine could quietly launder a defect into a claim. */
export function takeReports(returns) {
  const taken = [], refused = [];
  for (const r of Array.isArray(returns) ? returns : []) {
    const bad = checkReport(r);
    if (bad) refused.push({ level: r && typeof r === "object" ? (r.level ?? null) : null,
                            code: bad.code, detail: bad.detail, ...(bad.fields ? { fields: bad.fields } : {}) });
    else taken.push(r);
  }
  return { taken, refused };
}

/** THE ADDRESSES THE PARENT WILL RE-READ, in report order, deduplicated and
 *  bounded. §14b.1: *"the parent re-reads by address if it needs the bytes."*
 *  Which is a behaviour and not a promise — the driver performs the read, and
 *  the suite observes it arriving at the plane. */
export function citedAddresses(reports) {
  const out = [];
  for (const r of Array.isArray(reports) ? reports : [])
    for (const c of Array.isArray(r?.citations) ? r.citations : [])
      if (c && typeof c.address === "string" && c.address && !out.includes(c.address)) out.push(c.address);
  return out.slice(0, CITATIONS_MAX);
}

/* ---------------------------------------------------- D-220: WHAT THE RUN HOLDS
 *
 * `INVESTIGATIVE-SESSION.md` §3: *"AND IT MUST READ DOCUMENT VERSIONS AS VERSIONS
 * (D-220, Bob 2026-08-06). Sixty captures of one calendar are sixty document
 * versions of ONE document, not sixty documents. A run that counts them as sixty
 * has a distorted picture of what the record holds … The session is consumer (3)
 * on that row."*
 *
 * `citedAddresses` deduplicates by the STRING a sub-session wrote, so sixty
 * captures of one calendar, cited by their sixty bundles, are sixty addresses —
 * and `citations_reread` is a count of them. That count stays (it is a count of
 * READS, and says so); what this adds is the count of DOCUMENTS, which it could
 * never have been.
 *
 * THE DOCUMENT'S IDENTITY IS THE PLANE'S, NEVER THIS MEMBER'S. It is the
 * `address_norm` `op=versionchain` answers with: the normalised address the
 * record's own `captured_locators ⋈ register` join is keyed on (PL-10). This
 * function receives the plane's answers and GROUPS by that key. It compares no
 * title, no text and no bytes, because every one of those merges different
 * documents — two agendas can share a title, and two documents can share text —
 * and a title that agreed would be an equality that cost nothing (CLAUDE.md §5).
 * The suite's fixture carries two DIFFERENT documents sharing one title to hold
 * exactly that.
 *
 * FOUR OUTCOMES PER CITATION, AND ONLY ONE OF THEM IS A DOCUMENT:
 *
 *   chained       the plane answered a chain of one or more versions: the
 *                 citation is (a version of) THAT document, counted once however
 *                 many of its versions were cited.
 *   unchained     the plane answered, and holds no captured version at the
 *                 address the citation resolves to — or the cited bundle names no
 *                 source address at all. It is counted as ITSELF, once, and is
 *                 never merged with anything: no chain is not evidence of sameness.
 *   undetermined  the plane REFUSED a read this needed. Nothing is known about
 *                 which document it is, and it is counted as neither a document
 *                 nor an unchained item — `CLAUDE.md`: undetermined is first-class
 *                 and must be STATED (D-276's class, one field along).
 *   truncated     a chain the plane answered only in part. Its document is
 *                 counted — the chain's address is the identity, and the plane
 *                 answered it — but a cited bundle absent from the page may be a
 *                 version past it, so `cited_not_listed` is read beside
 *                 `truncated`: on a WHOLE chain it names a bundle whose source is
 *                 this address and which is not one of its captured versions.
 *
 * `resolved` is a list of `{ citation, bundle, address, chain, refused, reason }`
 * as the driver built it from the plane's answers (`index.mjs`, the `collect`
 * row). PURE, for `harness.mjs`'s reason: the suite can drive every outcome here
 * without a plane, and through the op with one. */
export function documentHoldings(resolved) {
  const documents = new Map();
  const unchained = [], undetermined = [];
  const list = Array.isArray(resolved) ? resolved : [];
  for (const r of list) {
    if (!r || typeof r !== "object") continue;
    if (r.refused) {
      undetermined.push({ citation: r.citation ?? null, at: r.refused.at ?? null,
                          code: r.refused.code ?? null, check: r.refused.check ?? null });
      continue;
    }
    const chain = r.chain && typeof r.chain === "object" ? r.chain : null;
    const key = chain && typeof chain.address_norm === "string" ? chain.address_norm : "";
    const held = chain ? Number(chain.total) || 0 : 0;
    if (!key || held < 1) {
      unchained.push({ citation: r.citation ?? null, address: r.address ?? null,
                       reason: r.reason ?? localize("agent-harness.subsession.the_record_holds_no_captured", "the record holds no captured version at this address") });
      continue;
    }
    const versions = Array.isArray(chain.versions) ? chain.versions : [];
    const inChain = new Set(versions.map((v) => v && v.bundle_id).filter(Boolean));
    let doc = documents.get(key);
    if (!doc) {
      doc = { address_norm: key, versions_held: held, truncated: chain.truncated === true,
              cited: [], versions_cited: [], cited_not_listed: [] };
      documents.set(key, doc);
    }
    doc.cited.push(r.citation ?? null);
    /* A citation that named a BUNDLE names a version — if the chain holds it. One
       that named the ADDRESS names the document and no particular version. */
    if (r.bundle) {
      if (inChain.has(r.bundle)) { if (!doc.versions_cited.includes(r.bundle)) doc.versions_cited.push(r.bundle); }
      else doc.cited_not_listed.push(r.bundle);
    }
  }
  const docs = [...documents.values()];
  return {
    /* THE COUNT A READER WILL TAKE AS COVERAGE, and it counts DOCUMENTS. */
    documents: docs.length,
    citations: list.length,
    versions_cited: docs.reduce((n, d) => n + d.versions_cited.length, 0),
    versions_held: docs.reduce((n, d) => n + d.versions_held, 0),
    unchained: unchained.length,
    undetermined: undetermined.length,
    by_document: docs,
    unchained_items: unchained,
    undetermined_items: undetermined,
    identity: "op=versionchain's address_norm — the record's captured_locators ⋈ register join (PL-10), "
            + "never a title, a text or a byte comparison",
  };
}

/** The sentence the `collect` row writes into the observation log. Three facts
 *  that must not read alike: documents counted once, items no chain names, and
 *  citations whose document is UNDETERMINED because the plane refused. */
export function holdingsNote(h) {
  if (!h) return "";
  let s = localize("agent-harness.subsession.documents_document_s_held_across", "{documents} document(s) held across {citations} citation(s), each counted ONCE with its versions ({versions_cited} of {versions_held} held version(s) cited, read through op=versionchain)", { documents: String(h.documents), citations: String(h.citations), versions_cited: String(h.versions_cited), versions_held: String(h.versions_held) });
  if (h.unchained) s += localize("agent-harness.subsession.unchained_cited_items_each_counted", "; {unchained} cited item(s) in no version chain, each counted as itself", { unchained: String(h.unchained) });
  if (h.undetermined) s += localize("agent-harness.subsession.undetermined_citations_the_plane_refused", "; {undetermined} citation(s) whose document is UNDETERMINED — the plane refused a read, so they are counted as neither a document nor an item", { undetermined: String(h.undetermined) });
  return s;
}

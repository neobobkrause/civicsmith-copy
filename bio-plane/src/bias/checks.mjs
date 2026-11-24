/* bias — the bias set's own checks and the C-26 family (requirements: `build/requirements/bias.md`, R1–R7, R29, R31).
 * Moved from the check catalogue at the module's extraction (T5-7, K64's pattern): the statement kinds, the verdict and
 * bar predicates, the set's checks and the C-26 rows. The one predicate for a member's statement and for the machine's
 * proposal (R31) is exported from here and nowhere else. The grammar it reads (`normalizeType`, `parseFrontmatter`) is
 * record-grammar's; C-26.12 is promotion's row, which it mints (its R15), joined to this family by reference (T19).
 */

import { normalizeType } from "../record-grammar/types.mjs";
import { parseFrontmatter } from "../record-grammar/frontmatter.mjs";
import { idPattern } from "../record-grammar/ids.mjs";
import { PROMOTION_ROW_CHECKS } from "../promotion/checks.mjs";
import { word, localize } from '../setup-words/index.mjs';

/* C-26.2's key shape (R3), a subject registry key: an `ENT-` id as record-grammar's `ID_TABLE` states it, read through
   its `idPattern` and never copied here (T33-38, S0-9), so `ENT-2026-10000` is a key and `ENT-2026-999` is not. */
const ENTITY_ID_RE = idPattern('ENT');

/* The catalogue's finding shape, `{check, severity, message, repairs?}`. */
function f(check, severity, message, repairs) {
  const out = { check, severity, message };
  if (repairs) { out.repairable = true; out.repairs = repairs; }
  return out;
}

function asText(v) {
  if (typeof v === 'string') return v;
  return new TextDecoder().decode(v);
}

/* PL-12 / D-84 — THE CLOSED SET OF THREE BIAS STATEMENT KINDS. Exported for
 * the reason ACTION_KINDS and RESOLUTIONS are: the check that judges a
 * statement, the store's own pre-flight refusal, and `op=affordances`'
 * publication must read ONE array, and a vocabulary written out twice is a
 * vocabulary that goes stale — measured on this project five times, most
 * recently as a hand-typed list two members short of the catalogue.
 *
 * WHY IT IS CLOSED, and why a fourth member is not a small addition. DEC-54:
 * "A standard of evidence is NOT one of the three bias kinds… A standard of
 * evidence is a BAR — how strong support must be before you assert — and BIO
 * already has that construct: DEC-17's required_strength." The two have
 * OPPOSITE mechanics: bias is DISCLOSED and refuses nothing (DEC-20), a bar
 * GATES and refuses at pre-flight. So the fourth kind anybody will reach for is
 * the one that breaks the gate/disclose distinction the whole doctrine rests
 * on, and C-26.6 exists because it will be reached for in a statement's TEXT
 * even when it is not reached for here. */
export const BIAS_STATEMENT_KINDS = ['scrutiny', 'inference', 'pattern'];

/* ===========================================================================
 * PL-12 / D-84 — THE BIAS BUNDLE'S STATEMENT ANATOMY, and DEC-54 (a) and (b)
 * where they bite on a DOCUMENT.
 *
 * `BIO_Declared_Bias_v0_1.md`, "Statement anatomy": each statement carries a
 * stable id within its bundle; its kind; its subject; the declarative text; a
 * REQUIRED justification; citations (required for kind=pattern); and, on
 * instance-level statements only, a lock flag.
 *
 * THE STATEMENTS LIVE IN FRONTMATTER (`statements[]`), not in the prose under
 * `## Statements`. That is D-21's rule — one place to state a fact — and it is
 * the same shape an inquiry's `basis[]` already takes, which is what lets the
 * store project them without inventing a second authority. The prose heading is
 * where a member writes for other members; the array is what the record checks
 * and what a manifest is computed from.
 *
 * WHAT THIS FUNCTION CANNOT DO, STATED RATHER THAN QUIETLY APPROXIMATED. The
 * doctrine's own safeguard 5 says it: "effect comparison is mechanical for
 * inference statements and largely mechanical for scrutiny statements; pattern
 * statements and artful language are not fully machine-judgeable, and the
 * design does not pretend otherwise. What the machine guarantees is that
 * nothing on a shared subject is QUIET." So the malformedness arms below are
 * NARROW ON PURPOSE — they catch the wholesale verdict the rule names in its
 * own words ("X lies", "everything from Y is false") and they let a strongly
 * worded, evidenced, justified statement through, because the ratification
 * review is where human judgment finishes the job. A wider predicate here would
 * refuse honest disclosures, and refusing a disclosure does not remove the
 * bias — it removes the declaration of it and pushes it into the unstated
 * priors, which is exactly the masking the five safeguards exist to defeat.
 * ======================================================================== */

/* The malformedness rule's two mechanical arms. ARM 1 is the wholesale-falsity
   form; ARM 2 is the speaker-as-liar form. Both are written to require a TRUTH
   VERDICT and not merely strong language, so that a scrutiny statement about a
   source's reliability — which is what this construct is FOR — passes. */
/* EXPORTED, and that is the whole point of them being here rather than beside
   the inhale that also uses them. DEC-54's constraint 2: "the malformedness rule
   binds the machine exactly as it binds a member" — so the predicate that
   refuses a member's statement and the predicate that keeps a machine's
   candidate out of a proposal must be ONE predicate. A second copy would agree
   at zero cost and then drift, which this project has measured five times. R31's
   test (`test/m/bias/checks.test.mjs`) holds the checks and the inhale to them. */
export const BIAS_VERDICT_WHOLESALE =
  /\b(everything|anything|all|every|each|nothing|none)\b[^.]{0,60}?\b(is|are)\b[^.]{0,30}?\b(false|untrue|lies|a lie|fabricated|fabrications?|invented|made up|propaganda|disinformation)\b/i;
export const BIAS_VERDICT_SPEAKER = [
  /\b(is|are)\s+(a\s+)?(liars?|dishonest|untrustworthy|not\s+credible|never\s+credible|not\s+to\s+be\s+believed)\b/i,
  /\b(always|habitually|invariably|systematically)\s+lies\b/i,
  /\bnever\s+tells\s+the\s+truth\b/i,
];

/* DEC-54 (a)'s textual arm: the BAR phrasings a newsroom policy actually uses.
   The ruling names AP's "more than one source" as the canonical example of a
   sentence that belongs in `required_strength` and NOT in a bias set, because
   "file a bar as bias and it stops gating; file bias as a bar and it starts
   refusing". These patterns require a THRESHOLD — a count of sources, or a
   named grade floor — so a statement that merely talks about sources without
   setting one is untouched. Reuters' "weigh the source's track record, position
   and motive" contains no threshold and is a clean kind=scrutiny statement; R6's
   test (`test/m/bias/checks.test.mjs`) holds it as an over-strictness arm. */
export const BIAS_BAR_PHRASING = [
  /\b(more than one|at least (one|two|three|\d+)|two or more|\d+\s+or\s+more)\s+(independent\s+)?sources?\b/i,
  /\b(requires?|must (reach|be at|meet)|no (lower|less) than)\b[^.]{0,30}\bgrade\s*[A-D]\b/i,
  /\brequired_strength\b/i,
];

/** PL-12 / D-84: the bias bundle's own checks. C-26.1 to C-26.7 fire here;
 *  C-26.8 fires in `biasInhale` (`./index.mjs`), where the inhale is. */
function checkBiasExtension(ctx, findings) {
  if (normalizeType(ctx.fm?.object_type) !== 'bias') return;
  const fm = ctx.fm;
  const state = fm.current_state;
  const statements = Array.isArray(fm.statements) ? fm.statements : null;

  if (statements === null) {
    findings.push(f('C-26.1', 'error',
      'a bias record carries its statements in frontmatter as statements[], and this one has none',
      ['add statements[] to bundle.md frontmatter, each with id, kind, subject, text and justification']));
    return;
  }

  const seen = new Set();
  for (let i = 0; i < statements.length; i++) {
    const s = statements[i];
    const at = `statements[${i}]`;
    if (!s || typeof s !== 'object') {
      findings.push(f('C-26.1', 'error', `${at} is not a statement object`));
      continue;
    }
    const id = typeof s.id === 'string' ? s.id.trim() : '';
    const text = typeof s.text === 'string' ? s.text.trim() : '';
    const kind = typeof s.kind === 'string' ? s.kind.trim() : '';

    /* A stable id WITHIN ITS BUNDLE is what an override names, and a project
       override "must name the instance statement id it nullifies" — so a
       missing or duplicated id makes safeguard 1 unenforceable rather than
       merely untidy. */
    if (!id) findings.push(f('C-26.1', 'error', `${at} has no id, and an id is what an override names`));
    else if (seen.has(id)) findings.push(f('C-26.1', 'error', `${at} repeats the statement id '${id}'; ids are stable and unique within a record`));
    else seen.add(id);

    /* THE CLOSED SET OF THREE. "Declared bias is a CLOSED SET: scrutiny,
       inference, pattern. All three govern HOW YOU REASON over what you hold"
       (DEC-54). A fourth kind is not a weaker statement; it is an ungoverned
       one, and it would be the door a bar walks through. */
    if (!BIAS_STATEMENT_KINDS.includes(kind)) {
      findings.push(f('C-26.1', 'error',
        `${at} kind '${kind || '(absent)'}' is not one of: ${BIAS_STATEMENT_KINDS.join(', ')}`,
        ['a standard of evidence is a BAR, not a bias kind — declare it as the project\'s required_strength (DEC-17, DEC-54 a)']));
    }

    /* SUBJECTS ARE REGISTRY ENTRIES, NOT FREE TEXT (safeguard 4). The registry
       is the same one the content framework's entity axis uses (D-83), and
       every kind it carries is a legal subject (DEC-6, 2026-08-01) — so there
       is NO kind whitelist here, deliberately, and the ruling says why: a
       narrow list "admits the doctrinally riskiest kind and refuses the safest.
       It protects nothing." What is checked is that the subject is a REGISTRY
       KEY at all, because prose subjects are what make a collision undetectable. */
    const subject = s.subject === undefined || s.subject === null ? '' : String(s.subject).trim();
    if (!subject || !ENTITY_ID_RE.test(subject)) {
      findings.push(f('C-26.2', 'error',
        `${at} subject '${subject.slice(0, 40) || '(absent)'}' is not a subject registry key (an ENT- id)`,
        ['point subject at an entry in the subject registry (op=entitycreate / op=entitybyalias)']));
    }

    /* A DECLARATIVE, unless this statement is a PURE NULLIFICATION.
       CORRECTED ON FIRST RUN and stated rather than quietly relaxed: the first
       version required text unconditionally, which made an override that only
       REMOVES an instance statement unwritable — and safeguard 1's whole
       mechanism is that such an override must exist, be named, and be visible
       as a diff. An override carrying `nullifies` AND text is a REPLACEMENT
       (the doctrine's word); carrying `nullifies` and no text it is a
       nullification. Both still need a JUSTIFICATION below, which is the arm
       that matters here — loosening an instance statement without saying why is
       exactly the masking safeguard 3 requires be loud. */
    const nullifies = typeof s.nullifies === 'string' ? s.nullifies.trim() : '';
    if (!text && !nullifies)
      findings.push(f('C-26.1', 'error', `${at} has no declarative text and nullifies nothing, so it says nothing at all`));

    /* A REQUIRED JUSTIFICATION, on every kind. This is the disclosure's whole
       point — "the author must declare and JUSTIFY their bias for the system to
       honor it" — and an unjustified statement is an undeclared prior with a
       form field around it. */
    const justification = typeof s.justification === 'string' ? s.justification.trim() : '';
    if (!justification) {
      findings.push(f('C-26.3', 'error', `${at} has no justification`,
        ['say why this lens is held; a bias the system honours is one its author justified']));
    }

    /* kind=pattern IS ANALYSIS by the epistemics ladder, so it must cite
       evidence in the record: "a pattern statement without at least one
       citation cannot leave draft". The gate is on LEAVING draft, exactly as
       the doctrine words it, so a set can be written before its citations are
       anchored and cannot become binding without them. */
    const citations = Array.isArray(s.citations) ? s.citations.filter((c) => c != null && String(c).trim() !== '') : [];
    if (kind === 'pattern' && citations.length === 0 && state !== 'draft') {
      findings.push(f('C-26.4', 'error',
        `${at} is a pattern statement with no citation, and a pattern statement cannot leave draft without one`,
        /* CORRECTED TWICE ON FIRST RUN, found by `repair-reachability.test.mjs`
           (a legacy suite, since deleted), which was the instrument working. The first version
           said "or return the bundle to draft" — a MOVE DIRECTIVE naming no
           edge (A2). The second named the edge as `proposed -> draft,
           op=promote` — legal, but A3 then measured that the plane offers NO
           ACT at `proposed` for a bias set, because the bias machine's
           transitions are ordinary promotions and this file's act registry has
           none for them. Both refusals are right. So this repair no longer
           directs a MOVE at all: it states the condition, which is what the
           doctrine actually says ("cannot leave draft without one"), and leaves
           the member's own write path to do what it already does. */
        ['cite the evidence in the record this pattern rests on',
         'or leave the set in draft until it can be cited — a pattern statement cannot leave draft without one']));
    }

    /* THE MALFORMEDNESS REFUSAL — DEC-54's fourth scope, and the doctrine's own
       words: "Declared bias may raise scrutiny, constrain inference, and assert
       evidenced patterns. It may never issue verdicts… The construct that
       fights undeclared distortion is held to a higher standard than the
       distortion." Refused no matter who declares it, and the same predicate
       runs over a MACHINE-PROPOSED statement (DEC-54's constraint 2: "the
       malformedness rule binds the machine exactly as it binds a member"). */
    if (text && (BIAS_VERDICT_WHOLESALE.test(text) || BIAS_VERDICT_SPEAKER.some((re) => re.test(text)))) {
      findings.push(f('C-26.5', 'error',
        `${at} pre-assigns a truth value wholesale to its subject, which is MALFORMED whoever declares it`,
        ['raise scrutiny on the source instead — say what checking its claims need before they bear load',
         'or block a named inference instead of issuing a verdict']));
    }

    /* DEC-54 (a) — SPLIT BARS FROM BIAS. Two arms, structural first: a
       statement carrying a required_strength field IS a bar wearing a
       statement's clothes, whatever its text says. The textual arm catches the
       phrasing the ruling names by example. Either way the refusal points at
       where the sentence BELONGS rather than merely refusing it, because the
       policy sentence is legitimate — it is filed in the wrong construct. */
    const carriesBar = s.required_strength !== undefined
      || (s.bar !== undefined && s.bar !== null)
      || (text && BIAS_BAR_PHRASING.some((re) => re.test(text)));
    if (carriesBar) {
      findings.push(f('C-26.6', 'error',
        `${at} states a BAR — how strong support must be before you assert — and a bar is not a lens`,
        ['declare it as the project\'s required_strength{capture, connection} (DEC-17)',
         'bias is DISCLOSED and refuses nothing; a bar GATES at pre-flight, and merging them breaks both']));
    }
  }

  /* DEC-54 (b) — THE UNENFORCEABLE RESIDUE IS A PUBLISHED OUTPUT. The heading
     is canonical for the type (see HEADINGS.bias), so C-3.1 already refuses a
     bundle that omits it. What THIS refuses is an ADOPTED bundle whose residue
     section is EMPTY: an empty heading is the checkbox, and the ruling's whole
     point is that "a case saying 'held to AP's standards' must ALSO say which
     of those standards this system does not check". A set that enforces its
     countable half while saying nothing about the rest delivers "enforcement of
     precisely the part that does not protect, wearing the authority of the
     whole policy". Draft and proposed sets are exempt, because the residue is
     authored as part of proposing rather than before it. */
  if (state === 'adopted') {
    const body = ctx.files.get('bundle.md');
    const md = body === undefined ? '' : asText(body);
    const m = /\n## What This Does Not Enforce[^\S\n]*\n([\s\S]*?)(?=\n## |$)/.exec('\n' + md);
    if (!m || m[1].trim() === '') {
      findings.push(f('C-26.7', 'error',
        'this bias set is adopted and says nothing under "## What This Does Not Enforce"',
        ['name what this lens does NOT check — the residue is a published output, not a log line (DEC-54 b)',
         'if every statement here is fully enforced, say that, and say it in the record']));
    }
  }
}

/** R1–R7: the findings for one bundle's front matter and files (a Map of path to text, or an object). A bundle whose
 *  type does not normalise to `bias` answers none. */
export function checkBiasSet(fm, files) {
  const findings = [];
  const map = files instanceof Map ? files : new Map(Object.entries(files || {}));
  checkBiasExtension({ fm: fm && typeof fm === "object" ? fm : {}, files: map }, findings);
  return findings;
}

/** R1–R7 over a gate's image (`{path: text | blob reference}`, or a Map of path to text): the findings of a bundle
 *  whose `bundle.md` is held as text. The audit (record-core R59) and the ratification gate (`withBiasChecks`). */
export function checkBiasImage(image) {
  const raw = image instanceof Map ? image.get("bundle.md") : image ? image["bundle.md"] : undefined;
  const md = typeof raw === "string" ? raw : raw instanceof Uint8Array ? asText(raw) : null;
  if (md === null) return [];
  const fm = parseFrontmatter(md).data;
  return fm && typeof fm === "object" ? checkBiasSet(fm, new Map([["bundle.md", md]])) : [];
}

/** The ratification gate's share: a `runGate` answer with C-26.1–C-26.7 added over the same image, in the gate's own
 *  shape (`ok` false exactly when an error finding exists). For the control plane to wrap the gate with. */
export function withBiasChecks(image, gate) {
  const errs = checkBiasImage(image).filter((x) => x.severity === "error")
    .map((x) => ({ check: x.check, detail: x.message, ...(x.repairs ? { repairs: x.repairs } : {}) }));
  if (!errs.length || !gate || typeof gate !== "object") return gate;
  return { ...gate, ok: false, findings: [...(Array.isArray(gate.findings) ? gate.findings : []), ...errs] };
}

/* =========================================================================
 * PL-12 / D-84 — THE BIAS OBJECT'S REFUSALS, and DEC-54's four scopes given
 * C-NUMBERS so that each is a MECHANISM rather than a paragraph.
 *
 * THE FAMILY IS C-26 AND NOT C-25, AND THE REASON IS RECORDED HERE RATHER THAN
 * ONLY IN A COMMIT MESSAGE, because a renumbering that leaves no note reads to
 * the next allocator as a family somebody skipped. This item allocated C-25.1
 * to C-25.10; **PL-1 (basis versions) landed on `main` while it was running and
 * allocated C-25.1 to C-25.18** for an entirely different family. Neither
 * session could see the other — they ran in separate worktrees off one base —
 * and CONDUCT found the collision at integration. Under the collision protocol
 * the EARLIER MERGE keeps its numbers, so this allocation moved wholesale to
 * C-26, verified free on `main` first (the only `C-26` strings anywhere in the
 * plane name item REC-26, which is not a check). 102 references moved by regex
 * on the NUMBER, so C-25.10 could not be mangled by a C-25.1 rule.
 *
 * WHAT THIS COSTS A READER OF OLD BYTES: nothing. No bias bundle has ever been
 * written under a C-25 number — the family had not left this branch — so there
 * is no history carrying the old spelling and no alias is owed. That is the one
 * question worth asking before renumbering anything in this repository, and it
 * is answered rather than assumed.
 *
 * SEVEN OF THESE JUDGE A DOCUMENT and fire in `checkBiasExtension` above;
 * the rest fire in the plane, at the acts a document cannot reach — the
 * inhale, the adoption, the promotion's envelope and the debt's resolve — and
 * each row's `where` names its site. The split follows AI_RUN_CHECKS' precedent
 * exactly: the catalogue is where a C-number is MINTED, and where the refusal
 * FIRES is a separate question.
 *
 * WHY THE ALLOCATION AND THE TRANSLATION ARE ONE ROW: DEC-49 (Bob, 2026-08-06;
 * QUEUE.md REC-64). Every refusable condition carries an error code with a
 * canned translation, the map is read from ONE place rather than copied, and an
 * untranslated code FAILS THE HARNESS rather than reaching a member.
 *
 * A NOTE ON TONE THAT IS NOT A NOTE ON TONE. Every translation here names
 * WHERE THE SENTENCE BELONGS rather than only refusing it. That is DEC-54 (a)'s
 * requirement, not politeness: a newsroom's "more than one source" is a
 * legitimate rule filed in the wrong construct, and a refusal that does not say
 * "declare it as your project's required_strength" leaves a member believing
 * BIO cannot express their standard — which is the failure that ends with the
 * standard being claimed and not followed, the exact gap Bob named when he
 * ruled the inhale ("claiming a standard you don't follow, and denying a bias
 * that you do have").
 * ========================================================================= */
export const BIAS_CHECKS = {
  /* Statement anatomy, the shape half: an id that an override can name, a kind
     in the closed set of three, and a declarative to apply. */
  BIAS_STATEMENT_MALFORMED_SHAPE: {
    check: 'C-26.1',
    where: 'src/bias/checks.mjs checkBiasSet, run at op=promote, in the audit and at the gate',
    translation: word('refusal.BIAS_STATEMENT_MALFORMED_SHAPE'),
  },
  /* Safeguard 4: subjects are registry entries, not free text. */
  BIAS_STATEMENT_SUBJECT_NOT_REGISTERED: {
    check: 'C-26.2',
    where: 'src/bias/checks.mjs checkBiasSet, run at op=promote, in the audit and at the gate',
    translation: word('refusal.BIAS_STATEMENT_SUBJECT_NOT_REGISTERED'),
  },
  /* The justification requirement, on every kind. */
  BIAS_STATEMENT_NO_JUSTIFICATION: {
    check: 'C-26.3',
    where: 'src/bias/checks.mjs checkBiasSet, run at op=promote, in the audit and at the gate',
    translation: localize('bias.checks.that_statement_does_not_say', 'That statement does not say why the lens is held. A declared bias the system honours is one its author justified; without that it is an unstated prior with a form around it.'),
  },
  /* kind=pattern IS analysis, so it cites or it stays in draft. */
  BIAS_PATTERN_UNCITED: {
    check: 'C-26.4',
    where: 'src/bias/checks.mjs checkBiasSet, run at op=promote, in the audit and at the gate',
    translation: word('refusal.BIAS_PATTERN_UNCITED'),
  },
  /* DEC-54 scope FOUR: the malformedness refusal. */
  BIAS_STATEMENT_ISSUES_A_VERDICT: {
    check: 'C-26.5',
    where: 'src/bias/checks.mjs checkBiasSet, run at op=promote, in the audit and at the gate',
    translation: word('refusal.BIAS_STATEMENT_ISSUES_A_VERDICT'),
  },
  /* DEC-54 scope ONE: split bars from bias. */
  BIAS_STATEMENT_IS_A_BAR: {
    check: 'C-26.6',
    where: 'src/bias/checks.mjs checkBiasSet, run at op=promote, in the audit and at the gate; '
         + 'and src/bias/index.mjs biasInhale, which routes the same sentences into bars[] instead',
    translation: word('refusal.BIAS_STATEMENT_IS_A_BAR'),
  },
  /* DEC-54 scope TWO: the unenforceable residue is a published output. */
  BIAS_RESIDUE_UNSTATED: {
    check: 'C-26.7',
    where: 'src/bias/checks.mjs checkBiasSet, run at op=promote, in the audit and at the gate',
    translation: word('refusal.BIAS_RESIDUE_UNSTATED'),
  },
  /* DEC-54 scope THREE: inhale proposes, never installs. */
  BIAS_INHALE_CANNOT_ADOPT: {
    check: 'C-26.8',
    where: 'src/bias/index.mjs biasInhale, reached from op=biasinhale',
    translation: localize('bias.checks.reading_a_policy_proposes_a', 'Reading a policy proposes a bias set; it never adopts one. Adopting is something a member does with their name on it, because otherwise a team could say it follows an organisation\'s standards without anybody in the team having agreed to anything.'),
  },
  /* The adoption's own two. A machine credential holds no name to put on an
     authored act (DEC-46, D-90, D-82), and an adoption of a set that was never
     proposed would reach `adopted` around the state machine. */
  BIAS_ADOPTION_NOT_AUTHORED: {
    check: 'C-26.9',
    where: 'src/bias/index.mjs biasAdopt, reached from op=biasadopt',
    translation: word('refusal.BIAS_ADOPTION_NOT_AUTHORED'),
  },
  /* THE WRITE PATH'S OWN REFUSAL, and it is here because VF-2's DEC-49 guard
     found it missing — which is the guard working exactly as its ruling
     intends. `promote` refuses a malformed bias set with `reason:
     "BIAS_REFUSED"` and a `findings[]` array in which EVERY entry already
     carries its own C-number, code and canned translation. That looked
     complete and was not: a surface renders a translation keyed on the code the
     plane SENT, and the code it sends FIRST — the one on the envelope — had no
     row at all. A member meeting it would meet machine vocabulary while the
     translations sat one level down in a list the surface had no reason to
     open. So the container gets a translation of its own, and it says the one
     thing the per-finding translations cannot: that NOTHING LANDED.
     ITS `where` NAMES THE PROMOTION STEP (`promotionCheck`) RATHER THAN THE
     CHECKS, unlike the seven set rows, because that is where it FIRES — and
     naming the site is what puts this code inside the guard's governed set
     (N242: it named the store's private `#promotionCheck` until T10). The seven
     above fire in `checkBiasExtension` and say so.
     NARROWED TO A REGION 2026-08-08 BY REC-71, AND PL-12'S REASONING ABOVE IS
     PRESERVED RATHER THAN OVERTURNED — only the GRAIN was wrong. This read
     `src/store.mjs promote`, and at whole-function granularity that claimed all
     ~960 other lines of `promote` for BIAS_CHECKS: **34 long-standing refusals
     were conscripted and the UI harness went red a second time within hours of
     the first, in the family next door.** BEING AN ENVELOPE IS A FACT ABOUT THE
     REFUSAL'S SHAPE — it wraps per-finding codes — AND SAYS NOTHING ABOUT ITS
     SPAN. This one fires at a single statement inside a single `if`: the region
     `bias-set-refusal` in `src/bias/index.mjs` `promotionCheck`. */
  BIAS_REFUSED: {
    check: 'C-26.11',
    where: 'src/bias/index.mjs promotionCheck > bias-set-refusal, reached from op=promote',
    translation: localize('bias.checks.that_bias_set_was_not', 'That bias set was not written. One or more of its statements is not something the record can honour, and each one is named below with what is wrong with it. Nothing was saved, so nothing needs undoing — correct the statements and write it again.'),
  },
  /* C-26.12, BIAS_ILLEGAL_TRANSITION, is promotion's (its R15, `bias-state-edge`): promotion mints it and holds its
     row, and cannot import this module; it joins this family by reference, below (R29, K586). */
  BIAS_ADOPTION_NOT_PROPOSED: {
    check: 'C-26.10',
    where: 'src/bias/index.mjs biasAdopt, reached from op=biasadopt',
    translation: word('refusal.BIAS_ADOPTION_NOT_PROPOSED'),
  },

  /* ---------------------------------------------------------------------------
     REC-207 — SETTLING A BIAS DEBT (BOB #32, 2026-09-23 23:42Z). Seven rows, in
     the EXISTING family rather than a new one, on SK-1's rule (made when a guard
     walked every `*_CHECKS` family, deleted at T20), because these refusals are
     bias's in the plainest sense —
     they are the conditions under which the record declines to record that a
     member has settled the obligation a lens change raised.

     TWO REGIONS, NOT ONE, and the split is the order of the answers rather than
     tidiness. `is-bias-debt-resolve-shape` holds the four conditions about the
     ACT — no run named, no member behind the call, a machine, no stated reason —
     and every one of them is answered BEFORE the record is read, so a caller who
     cannot see the run learns nothing from which refusal they get.
     `is-bias-debt-resolve-subject` holds the two about the DEBT, after the gated
     lookup, where an unseen debt and an absent one are deliberately ONE answer.
     --------------------------------------------------------------------------- */
  BIAS_DEBT_NO_RUN: {
    check: 'C-26.13',
    where: 'src/bias/index.mjs biasDebtResolve > is-bias-debt-resolve-shape, reached from op=biasdebtresolve',
    translation: word('refusal.BIAS_DEBT_NO_RUN'),
  },
  BIAS_DEBT_NO_ACTOR: {
    check: 'C-26.14',
    where: 'src/bias/index.mjs biasDebtResolve > is-bias-debt-resolve-shape, reached from op=biasdebtresolve',
    translation: localize('bias.checks.nothing_was_settled_because_this', 'Nothing was settled, because this request has no member behind it. Deciding that a change in the team\'s declared lens does not affect a piece of work is somebody\'s judgement, and the record keeps whose it was. Sign in and do it as yourself.'),
  },
  BIAS_DEBT_MACHINE_CANNOT_RESOLVE: {
    check: 'C-26.15',
    where: 'src/bias/index.mjs biasDebtResolve > is-bias-debt-resolve-shape, reached from op=biasdebtresolve',
    translation: localize('bias.checks.nothing_was_settled_this_was', 'Nothing was settled. This was asked by a machine credential, and saying that a lens change does not affect a finding is a person\'s judgement about the work — not something an automated account can decide on anyone\'s behalf. A machine may raise this and show it to you; answering it is yours.'),
  },
  BIAS_DEBT_NO_REASON: {
    check: 'C-26.16',
    where: 'src/bias/index.mjs biasDebtResolve > is-bias-debt-resolve-shape, reached from op=biasdebtresolve',
    translation: word('refusal.BIAS_DEBT_NO_REASON'),
  },
  BIAS_DEBT_REASON_TOO_LONG: {
    check: 'C-26.17',
    where: 'src/bias/index.mjs biasDebtResolve > is-bias-debt-resolve-shape, reached from op=biasdebtresolve',
    translation: localize('bias.checks.nothing_was_settled_because_the', 'Nothing was settled, because the reason given is longer than this record holds for one. Nothing about it was wrong — it is a size limit and not a judgement about what you wrote. Put the reasoning where it belongs in the work and give the short form of it here.'),
  },
  BIAS_DEBT_NO_SUCH_DEBT: {
    check: 'C-26.18',
    where: 'src/bias/index.mjs biasDebtResolve > is-bias-debt-resolve-subject, reached from op=biasdebtresolve',
    translation: word('refusal.BIAS_DEBT_NO_SUCH_DEBT'),
  },
  BIAS_DEBT_ALREADY_SETTLED: {
    check: 'C-26.19',
    where: 'src/bias/index.mjs biasDebtResolve > is-bias-debt-resolve-subject, reached from op=biasdebtresolve',
    translation: word('refusal.BIAS_DEBT_ALREADY_SETTLED'),
  },
  /* C-26.20 (BIAS_ADOPTION_NOT_AN_ADMINISTRATOR) is RETIRED and its number is not reused (N327, DEC-83): an
     instance-scope adoption by a non-administrator is membership's one condition, answered `NOT_AN_ADMIN` through
     `membership.notAnAdmin` (its R84, C-96.1), this row's next step riding as its `remedy` (R11). */
  /* DEC-88 (K1025): adopting a lens is an act that changes how the group reads evidence, and the record keeps the
     adopter's own words on why. Asked last, after authorship, the set's state and the scope's authority, so a caller
     who may not adopt learns that first; and on a re-adoption too, which replaces the reason with the row (R11). */
  BIAS_ADOPTION_NO_REASON: {
    check: 'C-26.21',
    where: 'src/bias/index.mjs biasAdopt, reached from op=biasadopt',
    translation: word('refusal.BIAS_ADOPTION_NO_REASON'),
  },
  BIAS_ILLEGAL_TRANSITION: PROMOTION_ROW_CHECKS.BIAS_ILLEGAL_TRANSITION,
};

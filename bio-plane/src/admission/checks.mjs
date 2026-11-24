/* admission's own refusal rows (R14; K6: each check is an invariant with its test). DEC-49: every refusal this module
 * answers carries its code, its row's check id and the member's translation, read from the one row here.
 *
 * Copied from `control-plane/checks.mjs` at the control-plane split (T18, K617, K624 (1)), each row keeping its check id
 * and its words, and each `where` naming its site in `src/admission/index.mjs`: the admission gate C-38 whole, the
 * namespaces C-78 whole, the agent credential's gate and declaration C-29.6–.10, the operator fence C-32.17 and the
 * group identity fence C-64.4. Control-plane's copies were deleted by its own T18 job, after this module merged
 * (K624 (1)), so each code has this one row; the stamp 1.49.0 (T19 layer 2) took them, each `where` re-pointed here
 * (N502, N469's rule). The reasons each row carries are stated beside it.
 *
 * T34-87 (DEC-149; K1811, K1821): seven translations call the group's Civicsmith by that name where they said "this
 * instance" or "this copy" — "your group's Civicsmith" to a member or a credential holder (C-38.3, C-38.8, C-78.1,
 * C-29.8, C-32.17, C-64.4, the last two worded as ratification R47), "this group's Civicsmith" to a caller who said
 * who they are not at all (C-38.1). Nothing else changed; the rows await promotion's T35 stamp.
 *
 * T35-71 (R14): two new rows, C-38.9 DOOR_RATE_LIMITED (R21) and C-29.30 AI_CREDENTIAL_EXPIRED (R10), each with its
 * test; both await promotion's stamp (T36; plan T35 accepted red 2).
 *
 * T36-36 (R14): two new rows, C-38.10 CREDENTIAL_IN_ADDRESS (R20; F1's tail, K2111, K2129: BOB's translation with its
 * protective sentence, the UX stream's to revise) and C-38.11 MEMBER_TOKEN_RETIRED (R5; N711, K1936 Q3), each with its
 * test; both await promotion's stamp (T37; plan T36 accepted red 4).
 *
 * T49-18 (R28; K3366, K3368; DEC-257, DEC-258): the rows hold no English. Each row is its check id and its site; the
 * member's sentence is the word `refusal.<CODE>` (words.json, read through setup-words' `word`), which `worded` below
 * gives each row as its `translation` and `rowOf` in index.mjs puts on each refusal. The comments below record why each
 * sentence said what it said; they bind no wording. */

import { word } from "../setup-words/index.mjs";

/* R28: a row's `translation` is the word `refusal.<CODE>`, read through setup-words' `word` each time it is read (the
   getter holds no sentence and keeps the row's `{check, translation}` shape for the readers of the families: the
   envelope's decoration, the door). DOOR_RATE_LIMITED's one placeholder is left as written, `{minutes}`, since a row
   knows no wait; the refusal itself (index.mjs `doorRateLimited`) fills it. */
function worded(rows) {
  for (const code of Object.keys(rows)) {
    const vars = code === "DOOR_RATE_LIMITED" ? { minutes: "{minutes}" } : {};
    Object.defineProperty(rows[code], "translation", { enumerable: true, get: () => word(`refusal.${code}`, vars) });
  }
  return rows;
}

/* C-38 · THE ADMISSION GATE (REC-79): every refusal a caller meets before their op runs. ADDITIVE ON THE WIRE: each
   refusal keeps its `error` sentence byte-identical beside the code (IC-REC-79). `MACHINE_CREDENTIAL_REQUIRED` is named
   for what it requires, not what it forbids, and does not match the doctrine pack's `MACHINE_CANNOT_` prefix. */
export const ADMISSION_CHECKS = worded({
  /* Absent identity, and it is the FIRST thing a stranger meets. It says what to
     do rather than what happened, because a person reading this has not yet done
     anything wrong — they have simply not said who they are. */
  NOT_AUTHENTICATED: {
    check: 'C-38.1',
    where: 'src/admission/index.mjs admit > is-admission',
  },
  /* WRONG CREDENTIAL, NOT INSUFFICIENT CREDENTIAL, and the difference is worth a
     sentence: this is not a rung on a ladder the caller can climb. A credential
     is issued for a purpose and this is not that purpose, so the honest advice
     is to use the right one rather than to ask for this one to be widened. */
  CLASS_FORBIDDEN: {
    check: 'C-38.2',
    where: 'src/admission/index.mjs admit > is-admission',
  },
  /* The mirror of the row above, and it exists separately because the two are
     opposite facts about the caller. This one is a PERSON asking for something
     only an unattended writer does; the row above is a credential of the wrong
     kind entirely. One refusal covering both would tell neither caller anything
     they could act on — DEC-49's own argument, and PL-18's.

     **NARROWED 2026-09-19 BY D-270, AND THE `where` MOVED WITH THE SITE.** This
     row is a DESIGN CLAIM — it tells a person that a verb is not for people —
     and BOB #17 ruled that the plane may make it ONLY where such a decision is
     recorded. Until D-270 this one sentence answered THREE different facts and
     was FALSE for two of them: it went to five ops an administrator's own
     browser performs, and to ops whose OPS rows say in as many words that they
     are a named member's judgement. The site is now `sessionOpGate`, which
     sends this row only for an op named in `UNATTENDED_BY_DECISION`, and the
     refusal carries the citation in `recorded`, so the claim and its warrant
     travel together. The rule's home is
     `docs/architecture/BIO_Membership_Architecture_v2.md` §4 (the §4.7 block). */
  MACHINE_CREDENTIAL_REQUIRED: {
    check: 'C-38.3',
    where: 'src/admission/index.mjs sessionOpGate > is-session-op-gate',
  },
  /* D-270 / BOB #17, 2026-09-19. THE SECOND OF THE SESSION GATE'S THREE
     OUTCOMES, and the one the plane could ALWAYS have said: it is about the
     CALLER rather than about the design, so it needs no recorded decision to be
     sayable. Five ops — `governorconfig`, `memberadd`, `memberset`, `signeradd`,
     `signerset` — were answered with the row above, which told a member to go
     and find a machine credential for an act an administrator performs from
     their own browser. There is no such credential to find. This sentence names
     the person to ask instead, because that is the action actually available.
     CORRECTED 2026-09-25 by REC-162 (Membership v2 §4.9, BOB #23): it read "but an
     administrator of this group, and this session is not one … ask an administrator".
     After REC-159 the one op it answers is `governorconfig`, which the FOUNDER'S session
     alone reaches — an enrolled administrator holds a member's session and was told they
     were not an administrator. The sentence now names the SESSION, as the refusal's own
     `reachedBy` does. */
  SESSION_ROLE_CANNOT_REACH_OP: {
    check: 'C-38.7',
    where: 'src/admission/index.mjs sessionOpGate > is-session-op-gate',
  },
  /* D-270 / BOB #17's THIRD SENTENCE, and it exists because the other two would
     otherwise have to cover a case neither is true of.

     **THE ARGUMENT, AND IT IS THIS ROW'S WHOLE REASON.** A false rationale
     SUPPRESSES ITS OWN BUG REPORT: a member told that an absence is a DECISION
     will not report it as a gap, so the sentence recruits the one person who
     could have caught it into believing there is nothing to catch. The measured
     case is D-136's — `adminendorse`, `adminremove` and `membercaps` WERE
     reachable by no session, and Membership Architecture §4.7 assigns that very
     vote to a person. **D-136 LANDED 2026-09-19 and discharged that case**: the
     three now hold `SESSION_OPS.admin` reach and a server-stamped `by`, so an
     administrator's session reaches them and a member's gets the ROLE sentence,
     not this one. The receipt stays in the past tense because it is the ARGUMENT
     for this row rather than a roster of its members — the gap was reported only
     because the plane declined to call it a decision, and deleting the evidence
     once the gap closes is how a rule outlives the reason it was made. `docs/archive/research/CAPABILITIES.md` (F-4) recorded
     independently that the old sentence told an administrator the act §4.9
     assigns them needs a credential §4.8 says somebody else holds, and that
     there is no action a member can take from it.

     SO THIS ROW STATES THE FACT AND INVENTS NO RATIONALE. It says what is true
     — no session route exists — and says plainly that the record holds no
     decision explaining it, which is an INVITATION to report the gap rather
     than a wall in front of it. A refusal may state only what the system can
     support. */
  SESSION_ROUTE_NOT_RECORDED: {
    check: 'C-38.8',
    where: 'src/admission/index.mjs sessionOpGate > is-session-op-gate',
  },
  /* Section 8.1. THE ONE PLACE IN THIS SYSTEM WHERE BEING THE FOUNDER IS NOT
     ENOUGH, and the translation says so, because a member refused here will
     otherwise read it as a bug in their own permissions. The security property
     is the point and a person who cannot get in deserves to know it is
     deliberate. */
  ROOT_OF_TRUST_REQUIRED: {
    check: 'C-38.4',
    where: 'src/admission/index.mjs admit > is-admission',
  },
  /* **THE LIVE DEFECT THIS ROW CLOSES, and it is why REC-79 chose this family.**
     the legacy interface hand-authored a sentence for this code:
     *"This credential cannot write to the record. Capturing needs a member
     holding contribute."* But this refusal is PLANE-WIDE — it is minted for
     whatever capability the op needed, and `create_projects` and `publish` are
     not `contribute`. So a surface had invented capture-specific wording for a
     refusal that is not about capture, and a member denied for `create_projects`
     was told about contributing. **That is precisely the drift a canned
     translation exists to stop** (found by PL-18; DEC-49's own argument for
     option (b) is that thirteen surfaces would otherwise each invent wording).
     The sentence here names no capability, because the plane already sends the
     one that was needed in `needs` and the surface renders that. */
  NOT_CAPABLE: {
    check: 'C-38.5',
    where: 'src/admission/index.mjs notCapable > is-not-capable',
  },
  /* A credential that MAY act, but not HERE. Distinct from every row above,
     which are all about whether the caller may act at all. */
  SCOPE_REFUSED: {
    check: 'C-38.6',
    where: 'src/admission/index.mjs admit > is-admission',
  },
  /* T35 (R21; F4, K1881): the one limit admission adds, a window per source over the operations anyone may call with
     no credential. It is a protective limit that refuses only abuse, so the sentence says it is about pace and not
     about the person, that waiting is the whole remedy, and that the bound and the wait are beside it; it names no
     address and says nothing of who the caller is, because the window knows neither. Awaiting promotion's stamp (T36). */
  DOOR_RATE_LIMITED: {
    check: 'C-38.9',
    where: 'src/admission/index.mjs doorRateLimited > is-door-window',
  },
  /* T36 (R20; F1, K1874, K2111, K2129): a credential or a secret sent in the web address. An address is kept in logs
     and browser history, so the request is refused rather than served; the sentence says where to send it instead and,
     because the value may already have been seen, what to do about it (K1881's protective sentence). It names neither
     the value nor its digest (R15). The code's one site (K231). Awaiting promotion's stamp (T37). */
  CREDENTIAL_IN_ADDRESS: {
    check: 'C-38.10',
    where: 'src/admission/index.mjs credentialAddressGate > is-credential-in-address',
  },
  /* T36 (R5; N711, K1936 Q3): the group's shared member key is retired; each member signs in as themselves. The
     sentence says the key is retired, not wrong, so its holder does not go looking for a newer one, and names the one
     way in. Awaiting promotion's stamp (T37). */
  MEMBER_TOKEN_RETIRED: {
    check: 'C-38.11',
    where: 'src/admission/index.mjs admit > is-admission',
  },
});

/* C-78 · A NAMESPACE (D-456, D-461, D-463). */
export const NAMESPACE_CHECKS = worded({
  NAMESPACE_UNKNOWN: {
    check: 'C-78.1',
    where: 'src/admission/index.mjs namespaceGate > is-namespace-gate',
  },
  /* D-461 (C-78.2): the scratch area named on a public operation that only ever answers from the record itself.
     Twelve such operations used to answer from the record while the caller believed it was in scratch — one of
     them, a knock, WROTE there. The sentence says nothing happened first and names no remedy but the true one. */
  NAMESPACE_PINNED: {
    check: 'C-78.2',
    where: 'src/admission/index.mjs pinnedNamespaceGate > is-pinned-namespace-gate',
  },
  /* D-463 (C-78.3): the credential itself is confined to the scratch area for its whole life, and this request
     named a different part of the record. C-78.1 and C-78.2 are both properties of the REQUEST — a name that
     does not exist, an operation that has no scratch version; this one is a property of the CALLER, which is
     why it is a third row and not a widening of either. Confinement is by REFUSAL and never by silent
     redirection when a store is NAMED (`scopeFor`'s rule for the probe class, and D-456's for everyone): a
     caller who believes it addressed the record must be told it did not. An ABSENT `store=` is not a refusal —
     the credential's own confinement is its default, which is the whole point of minting one. */
  NAMESPACE_CONFINED: {
    check: 'C-78.3',
    where: 'src/admission/index.mjs confinedNamespaceGate > is-confined-namespace-gate',
  },
});

/* C-29.6–.10 · AN AGENT CREDENTIAL'S REACH (PL-11 / IS-5, D-199): the gate on every call (.6, .7) and the declaration
   judged at the mint (.8–.10). The mint's and the revocation's rows are credentials'. */
export const AI_SCOPE_CHECKS = worded({
  /* ---- THE GATE. WHAT A DECLARED SCOPE ADMITS, ON EVERY CALL. ---- */

  /* D-199 (1)'s shape, reused from `scopeFor`: CLASS plus SCOPE, enforced at the
     gate BY REFUSING. It is one code because it answers one question — is this
     op within what the record declared for this credential — and the two ways
     of failing it (outside the member-reach floor, or not among the declared
     writes) are the same answer to the caller. */
  AI_BEYOND_TASK_SCOPE: {
    check: 'C-29.6',
    where: 'src/admission/index.mjs aiTaskScope > is-ai-task-scope',
  },
  AI_CREDENTIAL_REVOKED: {
    check: 'C-29.7',
    where: 'src/admission/index.mjs aiTaskScope > is-ai-task-scope',
  },
  /* T35 (R10; K1934 (5), credentials R42): an agent credential lives for the days it was minted with and is never
     renewed. Refused by name, as a withdrawn one is, so its holder is told the remedy (a new one) rather than met with
     a stranger's 401; the entry stays. The next free C-29 number after credentials' T35 rows (C-29.28, C-29.29).
     Awaiting promotion's stamp (T36). */
  AI_CREDENTIAL_EXPIRED: {
    check: 'C-29.30',
    where: 'src/admission/index.mjs aiTaskScope > is-ai-task-scope',
  },

  /* ---- THE DECLARATION. WHAT MAY BE AUTHORED IN THE FIRST PLACE. ---- */

  /* A scope naming something that is not an op is not a narrower scope: it is a
     sentence in the record that nothing enforces, which is precisely what
     D-199 (2) moved the scope out of a settings row to avoid. */
  AI_SCOPE_UNKNOWN_OP: {
    check: 'C-29.8',
    where: 'src/admission/index.mjs aiScopeDeclaration > is-ai-scope-declaration',
  },
  /* THE SHAPE FENCE, AND PL-4'S DELEGATED CONSTRAINT DISCHARGED. Not a list of
     forbidden ops — a property of the op: can a MEMBER reach it. The unattended
     verbs carry no member class by construction, so they are outside every
     scope anybody can write, today and after the next op lands. */
  AI_SCOPE_BEYOND_MEMBER_REACH: {
    check: 'C-29.9',
    where: 'src/admission/index.mjs aiScopeDeclaration > is-ai-scope-declaration',
  },
  /* D-463 (C-29.10) — THE CONFINEMENT, JUDGED BEFORE IT ENTERS THE RECORD.
     A credential may be minted confined to the scratch namespace for its whole life, and to NOTHING ELSE.
     `bio` is refused with the rest, and that is the decision rather than an omission: `bio` is where every
     unconfined credential already lands, so a row saying "confined to bio" would be a sentence in the record
     that reads like a fence and constrains nothing — D-199 (2)'s complaint about a settings row, arriving as
     a column. The value is matched EXACTLY — nothing trimmed, nothing case-folded — on D-456's rule one layer in,
     because a Durable Object name is an exact string and folding it would be the code guessing what a member meant.
     ABSENT (the field omitted, or null) is the ONLY silence, and it is the case every caller written before this item
     is in; a PRESENT empty string is a value and is refused with the rest, because an empty `store=` is one of the
     values D-456 measured addressing the real record. */
  AI_CONFINEMENT_NOT_SCRATCH: {
    check: 'C-29.10',
    where: 'src/admission/index.mjs aiConfinementDeclaration > is-ai-confinement-declaration',
  },
});

/* C-32.17 · THE OPERATOR FENCE ON SECTION 4 GOVERNANCE (D-136). */
export const OPERATOR_FENCE_CHECKS = worded({
  /* D-136 / C-32.17 — D-421's RULING APPLIED TO SECTION 4 GOVERNANCE, and it is
     the same doctrine rather than a new one: *the credential that delivers an
     act decides when the record changes, and the record names the actor.* A
     §4.7 vote is C-32.14's shape with the member's signature replaced by a
     roster position — an act the record attributes to a named administrator,
     which a bearer token held in the hosting account cannot be.
     ONE ROW FOR THE THREE OPS, on C-32.16's precedent rather than C-32.14's: the
     endorsement, the removal vote and the capability edit enter through ONE
     region and are refused by ONE predicate, so three rows would be one rule with
     three homes. The op is named in the answer, so a caller still learns which
     verb was refused, and the class is named in `tokenClass`, so an operator
     learns which of its credentials asked.
     THE PREDICATE IS `!viaSession` — how the caller ARRIVED, not which token it
     held — so it covers ADMIN, MEMBER and PROBE today and any binding added
     tomorrow, and no class list appears at the site to go stale. */
  OPERATOR_TOKEN_CANNOT_GOVERN: {
    check: 'C-32.17',
    where: 'src/admission/index.mjs bearerFence > is-operator-governance-act',
  },
});

/* C-64.4 · THE SAME FENCE FOR THE GROUP'S PUBLIC IDENTITY (REC-164). */
export const GROUP_IDENTITY_FENCE_CHECKS = worded({
  /* REC-164 — BIO_Publication_v0_1.md §7 points 2 and 3: the display name and the domain are set by an
     administrator's own signed-in session, and the record names who set each one. */
  GROUP_IDENTITY_NEEDS_SESSION: {
    check: 'C-64.4',
    where: 'src/admission/index.mjs bearerFence > is-group-identity-session',
  },
});

/* op-capabilities: the hand-written half of the op layer's capability table (R1). Data only: for each op whose
   family's kind gives no row, the one capability a session needs for it, or a stated null. `op-declarations` composes
   `needsRows()` into `NEEDS` (its R3) and `admission` reads that. The module imports nothing (R2), and the table is
   built on the first call, never at evaluation (R3). The rows and their comments are copied from `op-declarations`
   as it stood at T49's opening. */

/* ---- capabilities at the op layer. Membership Architecture v2 section 5 ----
 *
 * Capabilities gate a SESSION and nothing else. A token class has no member
 * behind it and therefore holds no capabilities: a machine credential is bounded
 * by OPS above and by admission's `scopeFor`, and asking a capability question about one
 * would mean inventing a member who does not exist.
 *
 * Section 5 says a capability a member does not hold is ABSENT from their
 * interface rather than present and refused. BOTH halves ship. setup.mjs builds
 * its controls from op=whoami so the control is not there, and this table
 * refuses the op anyway, because a hidden button is a courtesy and not a
 * boundary.
 *
 * STRUCTURAL, not a hand list. Every mutating op a SESSION can reach appears
 * here, including the ones that need no capability, written as an explicit null
 * with the reason. op-declarations' R3 test (test/m/op-declarations/tables.test.mjs)
 * reads SESSION_OPS and this table as exported and fails on any session-reachable
 * mutating op that is missing,
 * AND on anything named here that no session can reach, so the table cannot rot
 * in either direction. Standing lesson 2: a later addition must not pass by not
 * being mentioned.
 */

let rows;

export function needsRows() { return rows ??= build(); }

function build() {
  return Object.freeze({
  /* contribute: create and revise bundles in the working corpus (5). */
  promote:          "contribute",
  lease:            "contribute",
  allocid:          "contribute",
  capture:          "contribute",   // the PUT; its GET is a read and is exempted at the check
  linkproject:      "contribute",
  acquire:          "contribute",
  attest:           "contribute",
  /* CPDF-10: NO FIFTH CAPABILITY TOKEN, on REC-13's reasoning below exactly.
     Attesting that a transcription matches the image is a corpus write and
     rides `contribute` like every other one. The thing that makes it different
     from its siblings is not a permission — it is that a MACHINE cannot perform
     it, and that is enforced where machine-ness is decided (the store's
     `checkAttestation`, C-35.10), never by inventing a capability a group would
     have to be told about. */
  attesttext:       "contribute",
  /* SK-7: NO FIFTH CAPABILITY TOKEN, on `attesttext`'s reasoning immediately
     above. Marking a passage as citable puts a row in the corpus and rides
     `contribute` like every other corpus write — and a VIEW-ONLY member must
     not, because a row minted here is a durable address the record then carries
     with an author's name on it. What is special about this act is not a
     permission either: it is that a machine credential MAY perform it (§14.4's
     EXTRACT role) where it may never perform the one above, and that asymmetry
     lives in the OPS class cut and in C-35.10, not in a capability a group
     would have to be told about. */
  contentmint:      "contribute",
  /* SK-8: the same capability as the act they perform, for the reason written
     against `contentmint` above — a proposal is CONTRIBUTING and it is never
     publishing. Nothing either op writes is the group putting its name on
     anything: an uncited machine-minted row is a PROPOSAL (§7.3 (6)), and the
     act that makes one part of a finding is a member's citation. */
  extractpropose:   "contribute",
  extractproposals: "contribute",
  /* REC-86: NO FIFTH CAPABILITY TOKEN. Narrowing a citation writes a new reading
     into the working corpus and rides `contribute` like `cite`, the act that
     wrote the citation in the first place; the candidate read rides it too, on
     `extractproposals`' reasoning one line up. Nothing either writes is the
     group putting its name on anything — the new reading is born `suggested`. */
  narrow:           "contribute",
  narrowcandidates: "contribute",
  /* REC-122: choosing a connection's on-point mention rides `contribute`, on `narrow`'s
     reasoning — it is a member's judgment written into the working record, and nothing it
     writes is the group putting its name on anything. */
  connectionchoose: "contribute",
  /* T5-11 (K145): asserting a connection, storing an agenda's containments and judging one each write the working
     record's connections, `connectionchoose`'s capability and reason. */
  connectionassert:    "contribute",
  filemembershipstore: "contribute",
  filemembershipjudge: "contribute",
  /* REC-146: NO CAPABILITY. The pairing read takes none, on `op=content`'s and
     `op=transcription`'s reasoning: asking which of the record's own assertions are
     worth comparing is READING the record. It writes nothing into the working corpus
     and puts nobody's name on anything, so there is no contribution to gate — and a
     capability here would mean a member could be shown a question and refused the
     answer to "what else does this record say about it". */
  contradictionpairs: null,
  /* REC-147: `extractpropose`'s capability and for its reason — a proposal is CONTRIBUTING, never publishing, and
     nothing it writes puts the group's name on anything: a candidate is labelled machine work, state proposed. */
  contradictionpropose: "contribute",
  /* N345: each of contradiction's six acts appends a row in a member's name to the working record (and a take-up promotes
     an inquiry), and the run's recommendation is `contradictionpropose`'s kind of production — `contribute`, and NO fifth
     capability token (CAPABILITIES.md §4). Who may act on a candidate is the module's, asked of the stamped author. */
  contradictiondismiss:   "contribute",
  contradictionclarify:   "contribute",
  contradictiontakeup:    "contribute",
  contradictionresolve:   "contribute",
  contradictionoptin:     "contribute",
  contradictionrespond:   "contribute",
  contradictionrecommend: "contribute",
  /* N345 (K516): NO CAPABILITY for the five reads, on `contradictionpairs`' reasoning above: asking what the record's
     candidates, marks, facts, notices and responses say is READING the record, and it writes nothing. PRESENT, null,
     because affordances names each in NON_ACTS (its R7) and its totality guard reads a NON_ACTS key this table does not
     carry as stale (its R12). */
  contradictioncandidates: null,
  contradictiontensions:   null,
  contradictionfacts:      null,
  contradictionnotices:    null,
  contradictionresponses:  null,
  /* D-148: NO CAPABILITY, on `contradictionpairs`' reasoning: reading what a body
     quoted is READING the record, and it writes nothing. */
  actionquotes: null,
  /* D-394: NO CAPABILITY, on `op=content`'s reasoning — asking whether the document a
     citation rests on has a newer version is READING the record, and it writes nothing. */
  versionnotice: null,
  /* REC-87: NO FIFTH CAPABILITY TOKEN. Typing a portion's text writes a content
     row and its text into the working corpus, and attesting a typing is
     `attesttext`'s act on different text — both ride `contribute`, as
     `attesttext` does. Nothing either writes is the group putting its name on
     anything. The READ takes none, on `op=content`'s reasoning: resolving what a
     citation points at, including what a member typed, is reading the record. */
  transcribe:          "contribute",
  transcriptionattest: "contribute",
  transcription:       null,
  /* MK-1: an observation is written into the working corpus as an INFO bundle —
     `contribute`, as capturing a document is. Nothing it writes is the group
     putting its name on anything; attribution in a published case is MK-3's. */
  testify:             "contribute",
  /* MK-4: NO FIFTH CAPABILITY TOKEN, on `transcribe`'s reasoning. A lead and a
     look against it are writes into the record in a member's name and ride
     `contribute`; a VIEW-ONLY member must not, because either leaves a row
     carrying their name for as long as the record lasts. The read takes none. */
  lead:                "contribute",
  leadlook:            "contribute",
  leadshare:           "contribute",
  /* MK-7: NO FIFTH CAPABILITY TOKEN. §4.2: the act needs no `publish` capability — it is a decision about
     the member's own words, not about the case — so it rides `contribute`, the token that recorded them. */
  attribute:           "contribute",
  /* D-162: declaring a theme, placing in one and proposing a placement all write the working
     record's lens layer, `lead`'s capability. */
  themedeclare:        "contribute",
  themeplace:          "contribute",
  themepropose:        "contribute",
  /* T5-11 (connections R43): withdrawing from a theme writes the lens layer too, `themeplace`'s capability. */
  themewithdraw:       "contribute",
  leadread:            null,
  /* D-681: the lead list takes no capability, `leadread`'s posture; the store answers each viewer its own reach. */
  leadlist:            null,
  /* D-162: the theme read takes no capability, `leadread`'s posture; its placements are gated by the viewer. */
  themeread:           null,
  /* REC-203: the identifier judgement takes no capability; it reads, and its captures are gated by the viewer. */
  idmatch:             null,
  monitor:          "contribute",
  cite:             "contribute",
  sever:            "contribute",
  reinstate:        "contribute",
  dispose:          "contribute",
  retire:           "contribute",
  /* Release authority is the member's decision (Intake Doctrine 4); the
     SURFACE it rides is contribute, like its state-action siblings, and the
     named-member requirement is enforced by the store on the author stamp,
     not by a capability, because capabilities gate sessions and the rule here
     is about who a session IS. */
  release:          "contribute",
  /* REC-13: concluding rides `contribute` like every other corpus write, and
     NO FIFTH CAPABILITY TOKEN IS MINTED. CAPABILITIES.md §4 is explicit that a
     fifth would break the pattern and would need §5 reopened, and the strength
     of a claim is not a permission question — a group does not hold a
     "conclude" right distinct from the right to write the record. DEC-30 fixes
     the rest: no owner gate and no ballot, so any contribute holder may
     conclude and the act is attributed in the state_history and the Session
     Log. The named-member requirement is enforced by the store on the author
     stamp, exactly as release's is, because capabilities gate SESSIONS and the
     rule here is about who a session IS. */
  conclude:         "contribute",
  /* REC-136: withdrawing a conclusion rides `contribute` for conclude's reason
     — a group holds no separate right to change its mind — and the named-member
     requirement is the store's, on the author stamp. */
  withdrawconclusion: "contribute",
  /* REC-31: reopening rides `contribute` like every other corpus write, and
     mints no capability of its own. Disagreeing with a disposition is not a
     separate right a group grants — CAPABILITIES.md §4 is explicit that a
     fifth token would need §5 reopened — and DEC-30 fixes the rest: no owner
     gate, no ballot, the act attributed in the state_history and the Session
     Log. The named-member requirement is enforced by the store on the author
     stamp, as release's and conclude's are, because capabilities gate SESSIONS
     and the rule here is about who a session IS. */
  reopen:           "contribute",
  /* REC-16 / DEC-30, and this one is SETTLED rather than provisional: division
     is AUTHOR-SCOPED — any `contribute` holder, with the act attributed — and
     no fifth capability token is minted. The reasoning is Bob's and it is
     decisive: division is how a member escapes an overclaiming mix, so
     owner-only would let an owner hold another member's name against an
     overclaim that member can see, and DE-ESCALATION MUST NEVER REQUIRE
     PERMISSION FROM SOMEONE WHOSE INCENTIVE MAY RUN THE OTHER WAY. What bounds
     misuse is not a gate but R4's disclosure: nothing leaves the record, the
     sibling exists, and a published child must name it. The named-member
     requirement is enforced by the store on the author stamp, as release's,
     conclude's and reopen's are, because capabilities gate SESSIONS and the
     rule here is about who a session IS. */
  inquirydivide:    "contribute",
  /* REC-45: GROUPING RIDES `contribute` and NO NEW CAPABILITY TOKEN IS MINTED,
     which the item states and which the reasoning above already settles.
     Membership §5's four rights are the whole set and a fifth would need §5
     reopened; there is nothing here a fifth would express that `contribute`
     does not, because authoring the structure of a basis is a corpus write on a
     question and a view-only member does not perform one.

     THE ARGUMENT FOR A NARROWER GATE IS REAL AND IS REJECTED, and it is worth
     stating because this act raises a grade. One could argue that the act which
     makes a finding STRONGER deserves `publish`'s right, or an owner's. It
     would be the wrong mechanism twice over. First, `publish` gates the
     PUBLICATION, which is where a stronger grade actually reaches a reader, and
     it is untouched: a member may group their reasons all day and nothing
     leaves the record until somebody with `publish` authors a case. Second — and
     this is DEC-30's argument arriving from the other side — grouping is also
     the only route BACK to an ungrouped basis, so an owner-only gate would let
     an owner hold a structure in place that another member can see is an
     overclaim, and DE-ESCALATION MUST NEVER REQUIRE PERMISSION FROM SOMEONE
     WHOSE INCENTIVE MAY RUN THE OTHER WAY. What bounds misuse here is not a
     gate: it is the NAME on every group, the legs staying visible under it, and
     the frozen per-group breakdown a reader checks (DEC-32's three
     containments). The named-member requirement is enforced by the store on the
     author stamp, as release's, conclude's, reopen's and inquirydivide's are,
     because capabilities gate SESSIONS and the rule here is about who a session
     IS. */
  inquiryground:    "contribute",
  /* PL-2 / IS-2: the six version acts ride `contribute` like every other corpus
     write and mint NO fifth capability token. CAPABILITIES.md §4 is explicit
     that a fifth would break the pattern and would need §5 reopened, and what a
     group's record stands on is not a permission question — a group does not
     hold a "settle a reading" right distinct from the right to write the record.
     The NAMED-MEMBER requirement is enforced by the store on the author stamp,
     exactly as release's, conclude's and inquiryground's are, because
     capabilities gate SESSIONS and the rule here is about who a session IS.
     THIS IS FENCE LAYER 2 (see VERSION_ACTIONS above). A member session without
     `contribute` is refused here and never reaches the store — which is exactly
     why the negative control has to break this row with the other two layers
     standing, or the transition refusal absorbs it and proves nothing. */
  versionaccept:    "contribute",
  versionreject:    "contribute",
  versionconsider:  "contribute",
  versionrevert:    "contribute",
  versioncurrent:   "contribute",
  versionhide:      "contribute",
  /* REC-24: BOTH ACTION OPS RIDE `contribute`, and NO NEW CAPABILITY TOKEN is
     minted — the item says so and the reasoning is the one every act above
     already runs on. Membership §5's four rights are the whole set; a fifth
     would need §5 reopened, and there is nothing here a fifth would express
     that `contribute` does not: moving an action and recording what came back
     are corpus writes, and a view-only member does neither.
     It is tempting to argue the OUTWARD reach deserves its own right — an
     action touches people outside the system. It would be the wrong mechanism:
     what bounds that reach is the RISK TIER on the object and the counterparty
     that must be named or honestly undetermined (REC-23), both of which are
     properties of the act being composed. A capability is a property of the
     SESSION and could not see either. The named-member requirement is enforced
     by the store on the author stamp, as release's, conclude's and reopen's
     are, because capabilities gate sessions and this rule is about who a
     session IS. */
  actionmove:       "contribute",
  actioncorrespond: "contribute",
  actionlaws:       "contribute",
  actionrisktier:   "contribute",
  /* REC-195: proposing takes `contribute` beside the act it proposes to, and the capability is the only gate
     it has — who proposed is RECORDED and labelled rather than fenced (D-149: the machine may propose). */
  actionlawspropose: "contribute",
  /* T8 (actions R28): proposing a tier takes `actionlawspropose`'s capability, for its reason. */
  actionriskpropose: "contribute",
  /* T8 (layer 9): each of the action layer's acts writes the working record — a standard or a proposal, a
     determination or a comparison, a consequence or its addressing, a filing draft, approval or sending, a counsel
     packet or its export, an escalation's stage — so each rides `contribute`, `actioncorrespond`'s capability and the
     version acts' reason, and NO fifth capability token is minted (CAPABILITIES.md §4). Who may act — a named member,
     joined to the project — is the module's, asked of the stamped author: who a session IS, not a capability. */
  standarddeclare:     "contribute",
  standardpropose:     "contribute",
  standardadopt:       "contribute",
  determine:           "contribute",
  comparisonpropose:   "contribute",
  consequencerecord:   "contribute",
  consequencerevise:   "contribute",
  addressedrecord:     "contribute",
  filingprepare:       "contribute",
  filingapprove:       "contribute",
  filingsent:          "contribute",
  counselpacket:       "contribute",
  counselpacketexport: "contribute",
  theorypropose:       "contribute",
  escalationopen:      "contribute",
  escalationattach:    "contribute",
  escalationevaluate:  "contribute",
  escalationadvance:   "contribute",
  escalationdecline:   "contribute",
  escalationend:       "contribute",
  escalationsuspend:   "contribute",
  escalationresume:    "contribute",
  /* FW-6 / D-83: building the SUBJECT REGISTRY reshapes what the working corpus's
     statements MEAN — registering a subject, aliasing it, and declaring a
     constitutive relation between subjects (mechanical bias-statement equivalence
     extends exactly as far as the registry declares it, safeguard 4). That is a
     corpus-shaping act, the same surface as the state and edge actions, so it takes
     `contribute`: a view-only member does not reshape subject equivalences. The
     declaring member is stamped server-side, so who fixed a relation is in the
     record; the reads (entity/entitybyalias/relation) are ungated, like the other
     working-corpus reads. */
  entitycreate:     "contribute",
  entityalias:      "contribute",
  relationdeclare:  "contribute",
  /* T5-11 (entities R8): correcting the registry is the same corpus-shaping surface as building it. */
  aliaswithdraw:    "contribute",
  relationwithdraw: "contribute",
  /* N345 (entities R38): reporting a wrong subject match writes a row in the reporter's name, the registry's surface. */
  resolutiondefect: "contribute",
  /* FW-7: RESOLVING a reference to an entity, and TESTIFYING a grade-D connection,
     both write into the record what documents concern which subjects — a corpus-shaping
     act on the same surface as building the registry, so `contribute`: a view-only
     member does not resolve references or testify. The resolving member is stamped
     server-side. The reads (resolutions/concerns) are ungated, like the registry and
     working-corpus reads. */
  resolve:          "contribute",
  resolvetestify:   "contribute",
  /* FW-8: deriving a CONNECTION between two documents that concern one subject, and
     authoring a PROGRESSION DEFINITION, both write into the record how the corpus's
     documents relate and how the group expects its institutions to behave — a corpus-
     shaping act on the same surface as building the registry and resolving references, so
     `contribute`: a view-only member does not derive connections or define progressions.
     The declaring member is stamped server-side. The reads (connections/progression) are
     ungated, like the registry, recogniser and working-corpus reads. */
  connect:          "contribute",
  progressiondefine:"contribute",
  /* FW-9: threading REAL documents into a progression instance places evidence into the
     record's account of how a happening unfolded — a corpus-shaping act on the same surface
     as deriving connections and defining progressions, so `contribute`: a view-only member
     does not thread instances. The threading member is stamped server-side. The read
     (instance) is ungated, like connections/progression. */
  thread:           "contribute",
  /* FW-10: recording an exception document that DISCHARGES a lawful skip is likewise a
     corpus-shaping act — it changes what the record claims about a missing stage (a gap becomes
     a lawful recorded skip) — so `contribute`, stamped with the declaring member below. The read
     (exceptions) is ungated, like the other progression reads. */
  discharge:        "contribute",
  /* REC-7: deferring or dismissing a derived proposal ages the record's own question — it changes
     what the working corpus SURFACES as open (an aged finding stops appearing) — so it rides the
     same `contribute` surface as the other progression writes: a view-only member does not age the
     record's questions. It mints NO bundle (D-79: declining is not authoring); the deciding member
     is stamped server-side. op=proposals (the read) is ungated, like the other progression reads. */
  proposedispose:   "contribute",
  /* Dispositioning a knock decides what enters the working corpus, which is the
     contribute surface even though the row it writes is an inbox row. Reading
     the inbox is not gated; acting on it is. */
  inboxresolve:     "contribute",
  /* N364 (capture R65, R68, R69; R36): pulling a knock files a capture and a bundle, re-attesting asks a fresh
     timestamp over a held capture, and an account is appended in the capturer's name — each writes the working record,
     `inboxresolve`'s and `attest`'s capability, and NO fifth capability token (CAPABILITIES.md §4). */
  inboxpull:        "contribute",
  reattest:         "contribute",
  captureaccount:   "contribute",
  /* N364 (sources R2, R6, R7): a disclosure, a link claim, a consent and its withdrawal each append a row to a source's
     history in a member's name, `contribute`, NO fifth token. Who may read or state a value is the module's (R5). */
  sourcedisclose:        "contribute",
  sourcelink:            "contribute",
  sourceconsent:         "contribute",
  sourceconsentwithdraw: "contribute",
  /* N364: NO CAPABILITY for the reads, on `contradictionpairs`' reasoning (asking the record is reading it); PRESENT,
     null, so affordances names each in NON_ACTS (its R7, R12), K516's precedent. The ceremony's pre-flight is
     `publishtensions`' posture: it tells a publisher what publishing would do and writes nothing. */
  knocksof:          null,
  pulledknocks:      null,
  lateattestations:  null,
  captureaccounts:   null,
  sourceof:          null,
  sourcerung:        null,
  sourcereadlog:     null,
  sourcepublishable: null,
  publishpreflight:  null,
  /* N364 (membership R89, R90): a member's own attesting key carries NO working capability, `signeradd`'s reasoning:
     what bounds it is who the session IS, and membership asks the roster of the stamped `by`. */
  signerregister:    null,
  signerrevoke:      null,
  /* publish: ratify. The capability governs the SURFACE and the registered
     signing key governs the authority (5). Both exist because before this the
     key was doing the capability's job: a member with no publish reached
     op=ratify and was stopped only by not having a key. */
  ratify:           "publish",
  /* CASE-5b: ratifying the CASE DOCUMENT is the same surface as ratifying a
     finding — it is the act that commits what the group is publishing, one
     altitude up. A member who may not publish may not sign a case either. */
  caseratify:       "publish",
  /* T34 (R25): setting a publish time is the ceremony's last act, `caseratify`'s surface. */
  publishat:        "publish",
  /* REC-14: authoring a case carries the SAME capability as ratifying one, and
     deliberately not `contribute`. Concluding says what the record shows;
     publishing puts the group's name on it and states, in the group's voice,
     what it does not cover and whether it was put to its subject. That is the
     publication surface, and a member who may not publish may not author it
     either. No fifth capability token is minted (CAPABILITIES.md section 4). */
  publish:          "publish",
  /* REC-126 / DEC-31, as REC-133 builds `BIO_Publication_v0_1.md` §6A.2 (BOB #15).
     No fifth capability token is minted for any of the three.
     - ISSUING and REVOKING a grant ride `publish`, UNCHANGED: handing the group's
       unratified draft to a named outsider is the act that stands beside
       publishing, and a member who may not publish may not do it either; the store
       adds the OWNER, with no administrator bypass for either act (§6A.2 as
       corrected by BOB #15 the same day: administrators direct nothing).
     - AUTHORING a draft rides `contribute`: §6A.2 makes it the project's EDIT
       permission (*"editing needs project permissions and is the editor's act"*),
       and `contribute` is Membership v2 §5's *"create and revise bundles in the
       working corpus"* — the capability half; the store checks the positional half
       (an owner or a joined participant, §7.5). REC-126 had it at `publish`, so an
       owner holding `publish` WITHOUT `contribute` no longer authors a draft: that
       is the ruling applied, since such an owner may edit nothing in the corpus. */
  casedraft:        "contribute",
  reviewgrant:      "publish",
  reviewrevoke:     "publish",
  /* REC-198: NO CAPABILITY, on `reviewcopy`'s terms — the single read takes none, and the list is fenced exactly
     like it (BOB #32). Listing which drafts one's own project holds is reading; it writes nothing. */
  casedrafts:       null,
  /* N345 (case-authoring R32; K516): NO CAPABILITY, on `contradictionpairs`' reasoning — the ceremony's read tells a
     publisher what publishing will disclose and writes nothing; `publish` gates the act itself. Present, null, for the
     reason the contradiction reads are (affordances R7, R12). */
  publishtensions:  null,
  /* DEC-17: the group's declared bar is about what publishing REQUIRES, so it
     rides the publication surface too. Lowering your own bar is legitimate and
     is an authored, dated, on-the-record act; what it may not be is quiet. */
  strengthbar:      "publish",
  /* create_projects is deliberately absent, because no op creates a project. A
     project is created by promoting a bundle with no base whose object_type is
     `project`, so the check lives at that SHAPE, once, in the promote branch. */

  /* No capability, and the reason, so a later reader does not read the absence
     as an oversight. A selection is a server-side snapshot of what the caller
     themselves selected; it writes nothing about the corpus, and a member with
     view rights only still needs to build one in order to read (7.5). */
  select:           null,
  selectionrelease: null,
  /* The roster ops are governed by `administer`, which is not a working
     capability and moves only by the Section 4 process. What bounds them is
     SESSION_OPS.admin above, not section 5. */
  /* Participation is governed by section 7, not section 5, and the store
     enforces it: only an owner invites and removes (7.2, 7.7 as REVERSED in v2),
     and `by` is stamped server-side so the store judges the real caller. */
  projectinvite:    null,
  projectjoin:      null,
  projectleave:     null,
  projectremove:    null,
  projectowneradd:  null,
  projectownerremove: null,
  projectownerrescue: null,
  /* REC-149: §7.14's setting is an owner's act over participation-level policy, governed by §7 and not §5. */
  projectvisibilityset: null,
  /* REC-150: §7.14's request to join is participation, governed by §7 and not §5 — the same reason as the roster
     acts: asking to be added needs no working capability, and answering is an owner's position. */
  projectrequest: null,
  projectrequestwithdraw: null,
  projectrequestanswer: null,
  /* The one participation op that DOES carry a capability, because a fork
     creates a project. Without this any participant creates projects they were
     not trusted to create, which is create_projects defeated by a button. */
  projectfork:      "create_projects",
  /* No capability. Declaring what you hold is not a corpus write, and
     confirming one is an administrator act governed by the class ACL. Neither
     is section 5's business, and declared expertise gates nothing in the other
     direction either. */
  expertisedeclare: null,
  expertiseconfirm: null,
  /* REC-159: still NO working capability now that an enrolled administrator's
     session reaches these (and `signeradd`/`signerset` below): what bounds them is
     the ROSTER, asked by the store against the stamped `by` — D-136's reasoning
     for the three that follow, applied again. */
  memberadd:        null,
  memberset:        null,
  /* D-136: NO WORKING CAPABILITY, and the reason is §5's own rather than
     `memberadd`'s by proximity. The §4.7 vote and the §4.9 capability edit are
     custodial powers over MEMBERSHIP: what bounds them is `SESSION_OPS.admin`
     above — who a session IS — and section 4's process, not one of section 5's
     four working rights. Hanging `administer` here would be the wrong mechanism
     twice over: `administer` is not a working capability, it moves only by the
     section 4 process, and §5 says an administrator holds every working
     capability and their own field is not consulted at all — so a capability
     test here would be a test of a field the design says nobody reads.
     PRESENT rather than absent because both totality guards must SEE them: this
     module's R3 test fails on a session-reachable mutating op that is missing
     from this table, and `affordances.mjs` requires every NEEDS key to be an ACT
     or a NAMED non-act — all three are named there with their reasons. */
  membercaps:       null,
  adminendorse:     null,
  adminremove:      null,
  /* REC-164: NO WORKING CAPABILITY, on D-136's reasoning above: what bounds the two is who a session IS, and the
     store asks the roster for an ACTIVE ADMINISTRATOR (C-64.5), not one of section 5's four working rights. */
  groupnameset:     null,
  groupdomainset:   null,
  signeradd:        null,
  signerset:        null,
  /* N43: NO WORKING CAPABILITY, on D-136's reasoning above — what bounds each is who the session IS, asked of the
     roster by the store against the stamped `by` (membership R10, R11, R19). */
  adminresign:      null,
  hostingaccessset: null,
  memberpairingset: null,
  /* PL-11 / IS-5 / D-199: NO WORKING CAPABILITY, and NO FIFTH CAPABILITY TOKEN
     IS MINTED — CAPABILITIES.md §4's rule, which every act since REC-13 has
     followed. Creating or withdrawing an agent credential is instance-level
     governance in `memberadd`/`signeradd`'s family, bounded by the class ACL
     and by SESSION_OPS, not by section 5's four working rights. It would be
     tempting to hang it on `contribute` because the credential can go on to
     write; that would be the wrong mechanism for the reason `release` records
     one line of reasoning over — a capability is a property of the SESSION, and
     what bounds this act is who a session IS. */
  aicredentialmint:   null,
  aicredentialrevoke: null,
  /* D-103: setting a host's appetite is an operator act bounded by
     SESSION_OPS.admin, not a section-5 working capability. CORRECTED 2026-09-23
     by REC-159: this read "the same as the roster ops above", and REC-159 moved
     those into both session sets; governorconfig is the operator's (§4.9, BOB #23).
     governorstate is a read and needs no entry at all. */
  governorconfig:   null,
  /* K372 (monitoring R30): pausing the daemon is the root of trust's act over the instance's own fetching, bounded by
     its class and `SESSION_OPS.admin`, `governorconfig`'s reason: not a section-5 working capability. */
  monitorpause:     null,
  /* K407: setting the instance's profiles is an administrator's act asked of the roster, D-136's reasoning: no working
     capability. */
  profilesset:      null,
  /* REC-4 / D-98: forwarding or resolving a task carries NO working capability.
     The authorization is not "may this member contribute" but "is this THIS
     member's task" — an identity question the store's TASK-ACTOR FENCE answers
     (`taskResolve`/`taskForward` refuse a non-assignee, non-admin with NOT_YOURS,
     naming who it is with). Exactly the reasoning `release` records: the rule is
     about who a session IS, not a capability, so a view-only member holds these
     as much as a contributor does — an obligation is settled by whoever it was
     addressed to. */
  taskforward:      null,
  taskresolve:      null,
  /* REC-20: reading your own queue carries NO working capability, for the same
     reason taskforward/taskresolve carry none — the question is not "may this
     member contribute" but "what has this record put in front of THIS member",
     and a view-only member holds it exactly as a contributor does. It is
     non-mutating, so SESSION_OPS does not gate it either. The entry exists
     rather than being absent so REC-19's totality guard can see it: an op in
     NEEDS is either a published act or a NAMED non-act, and op=queue is named
     in NON_ACTS with its reason. */
  queue:            null,
  /* REC-34: reading the derived pair carries NO working capability, on op=queue's
     reasoning exactly — the question is not "may this member contribute" but "what
     does this question rest on", and a view-only member holds it precisely as a
     contributor does; weighing a case is what viewing IS. It is non-mutating, so
     SESSION_OPS does not gate it either, and what bounds it is the D-15 viewer
     stamp rather than section 5. The entry exists rather than being absent so
     REC-19's totality guard can SEE it: an op in NEEDS is either a published act
     or a NAMED non-act, and op=inquirystrength is named in NON_ACTS with its
     reason. (op=reevaluations' precedent — no entry at all — is the other legal
     shape for a read; this one is taken because the op is a SURFACE a member acts
     from, and a read that is silently absent from both registries is exactly how
     REC-25's six ungated reads accumulated.) */
  inquirystrength:  null,
  /* REC-18: NO CAPABILITY, on op=inquirystrength's reasoning exactly. Asking
     what the record already earned for a document is reading the record, not
     shaping it — the WRITE that puts the earned grade on a leg is op=promote,
     which carries `contribute` and is where the capability belongs. A view-only
     member weighing a case needs to see what its legs rest on precisely as a
     contributor does. Present rather than absent so REC-19's totality guard
     sees it; named in NON_ACTS with its reason. */
  earnedbasis:      null,
  /* REC-83: NO CAPABILITY, on op=earnedbasis' reasoning exactly. Resolving what
     a citation POINTS AT is reading the record; the acts that create or change
     the thing resolved carry their own gates (op=promote's projection mints it,
     op=attesttext attests it, REC-86's NARROW re-points a leg). A view-only
     member weighing a case needs to see what a leg actually cites precisely as
     a contributor does — and a fence here would mean a member could be shown a
     citation and never be told what part of the document it names. Present
     rather than absent so REC-19's totality guard SEES it, and named in
     NON_ACTS with its reason. */
  content:          null,
  /* D-419 (T5-11): NO CAPABILITY, on op=content's reasoning exactly — showing the picture a citation names is reading
     the record. Present rather than absent so REC-19's totality guard SEES it. */
  contentcrop:      null,
  /* REC-36: NO CAPABILITY, on op=earnedbasis' reasoning exactly. Asking which
     documents NAME a subject is reading the record; the write that acts on the
     answer is op=resolve, which carries its own gate and is where the capability
     belongs. A view-only member weighing a case needs to see what mentions their
     subject precisely as a contributor does. Present rather than absent so
     REC-19's totality guard SEES it — a read silently absent from both registries
     is how REC-25's six ungated reads accumulated — and named in NON_ACTS with
     its reason. (Its two siblings op=reading/op=readingref take the other legal
     shape, no entry at all; this op takes op=queue's because it is a SURFACE a
     member acts from: the candidate list a resolve is chosen out of.) */
  readingname:      null,
  /* REC-21 / D-125: NO CAPABILITY, and the reason IS the doctrine rather than a
     convenience. `contribute` is the corpus-shaping surface — it is what
     separates a member who may change what the record says from one who may only
     read it. A mute changes nothing the record says: it is one member deciding
     what they are told about their own attention, and requiring `contribute` for
     it would classify a personal preference as a corpus act, which is the exact
     collapse this item exists to prevent. It would also mean a view-only member
     could be notified and could never manage it — an attention surface they can
     receive and cannot answer. The `select` precedent is the same shape: a
     server-side snapshot of the caller's own state, writing nothing about the
     corpus, and needed by a view-only member in order to read at all.
     What DOES bound these is SESSION_OPS above (they are mutating, so a machine
     credential cannot reach them through a session route) and the store's own
     NO_MEMBER refusal — an identity question, like the task fence, not a
     capability one. */
  queuemute:        null,
  queuesnooze:      null,
  /* IS-6. Opening an investigative run rides the CONTRIBUTE surface, and the
     reasoning is the one op=proposedispose records two entries up rather than a
     new one: a run shapes what the working corpus surfaces as open — it will
     propose versions of an inquiry's basis and it spends the group's Claude
     budget against their account. A view-only member does not start work the
     group pays for and the record then carries. It is deliberately NOT
     `publish`: a run proposes and nothing it does is the group putting its name
     on anything (§1's suggesting / authoring / committing, kept apart).

     `airuntick` and `airunclose` carry the SAME capability rather than none.
     The alternative — gate the open and leave the tick free — would mean a
     credential that may not start a run may still spend its budget and close
     it, which is the fence in the wrong place. The two READS are ungated by
     capability and gated by VIEWER, like every other read here.

     ***** PL-18 / DEC-63, 2026-08-09: THESE THREE VALUES ARE NOW A FLOOR AND
     NO LONGER THE GATE, AND THE FLOOR IS THE SMALLER HALF. *****
     IS-6 shipped `contribute` as a PROVISIONAL and asked Bob which capability a
     run costs. He answered that it is not a capability question at all:
     *"AN INVESTIGATION CAN BE STARTED BY ANY MEMBER OF A PROJECT… the gate is
     PROJECT MEMBERSHIP, not a capability tier — participation in the project
     the inquiry belongs to is what licenses asking the system to look, and the
     spend rides on membership the group already governs."*
     So `contribute` STAYS HERE — unchanged, still enforced, and refusing in its
     own words with `needs` on the answer — while the real gate is participation
     in the project the run's context belongs to, checked in the store where the
     citation graph and the participation rows are, and refused with its own
     C-22.8 code and canned translation.
     **THE TWO REFUSALS ARE DELIBERATELY NOT ONE.** *You are not in this
     project* and *you lack contribute* are different facts about an account
     with different remedies — an owner of that project invites you, or an
     administrator grants a capability — and a single refusal covering both
     would tell a member nothing they can act on.
     The order is: this capability floor first (here, at the control plane),
     then participation (in the store). A member who fails both is told about
     the capability, because that is the refusal that fires first; neither
     answer is ever both. */
  airunopen:        "contribute",
  airuntick:        "contribute",
  airunclose:       "contribute",
  /* REC-207: NO CAPABILITY on either, and `op=taskresolve`'s entry above is the precedent rather than a
     new argument. Settling an obligation the record raised is answering something addressed to you; it is
     not the corpus-shaping surface `contribute` separates out, and a view-only member who is shown a
     bias-debt obligation and cannot answer it has been handed an item they can receive and never
     discharge. What DOES bound the act is its class list (no probe), the store's own machine refusal by
     shape, and the run's read gate — an identity question, like the task fence, not a capability one. */
  biasdebtresolve:  null,
  biasdebt:         null,
  /* PL-3 / IS-4. A suggestion is `contribute` and deliberately NOT `publish`:
     §1's three verbs are kept apart, and proposing a reading of the evidence is
     suggesting. Nothing this op writes is the group putting its name on
     anything — the version is born `suggested`, and every act that would make
     it the record's stance is a member act this credential cannot reach. */
  suggest:          "contribute",
  /* PL-4 / IS-4. Requesting a capture is `contribute` and deliberately NOT
     `publish`: it adds a document to the STORE and adds nothing to any case.
     Bob, 2026-08-05 — *"the capture is an entry of a document to the cache
     (store), but not an entry of the document into the leg of a claim"* — so a
     run that captures four hundred documents has changed the store and changed
     no conclusion. It is not NULL either, the way a personal mute is: this act
     sends traffic to somebody else's server with the group's name on it, which
     is corpus-shaping work and not a preference about one's own attention. */
  capturerequest:   "contribute",
  /* T6-13 (capture-requests R42): retrying a refused request sends the group's traffic to the source again, the
     request's own capability and reason. */
  capturerequestretry: "contribute",
  /* T6-13 (intent R2, R8–R11, R16, R18): each of intent's acts writes the working record — a project document's
     condition or adoption, a goal or aspiration document, a question, a triage row, a run — so each rides
     `contribute` and mints NO fifth capability token (CAPABILITIES.md §4). What bounds a GROUP aspiration to an
     administrator (R9) and an adoption to a joined member is the store's, asked of the stamped author: who a session
     IS, not a capability. */
  objectivecondition: "contribute",
  goaldeclare:        "contribute",
  goallink:           "contribute",
  goalclose:          "contribute",
  aspirationdeclare:  "contribute",
  aspirationdepart:   "contribute",
  aspirationdeadend:  "contribute",
  aspirationretire:   "contribute",
  triage:             "contribute",
  workobjective:      "contribute",
  /* T6-13 (intent R3–R6, R12–R15; B3, AFFORDANCES #1 J4.3): intent's seven READS take NO capability, op=queue's
     precedent and not op=reevaluations': each is a SURFACE a member acts from (progress and gaps, the goals and
     aspirations in force, the proposals a triage is chosen out of), so it is present here, null, where REC-19's totality
     guard SEES it and `affordances.mjs` names it in NON_ACTS with its reason. What bounds each is the viewer stamp. */
  objectiveprogress:  null,
  objectivegaps:      null,
  goal:               null,
  aspirations:        null,
  aspirationcontacts: null,
  pursuit:            null,
  intentproposals:    null,
  /* T6-13 (reevaluation R15, R16): adopting a newer version appends a basis version, keeping the earlier one and
     recording a re-evaluation write the working record — the version acts' capability and their reason. */
  versionadopt:       "contribute",
  versionkeep:        "contribute",
  reevaluationrecord: "contribute",
  /* PL-12 / D-84. Adopting a bias set is `contribute` and deliberately NOT
     `publish`: it is the group declaring the lens it works under, which is
     ordinary record work that every contributing member's own project managers
     do — and DEC-20 settles that declaring a bias never gates anything, so
     nothing downstream of this is a publication act. A view-only member does not
     put a lens over other people's work; the capability is what says so.
     `biasinhale` carries NONE, like every other read in this file, and it is a
     read precisely because it writes nothing. */
  biasadopt:        "contribute",
  /* REC-155 / §4.10: NO FIFTH CAPABILITY TOKEN. Repairing a provenance chain and recording a route marker are
     corrections to the working record in a member's name, and recording a calibration, an engine to probe or a
     vendor's announcement puts a row in the record — each rides `contribute`, as `attesttext` does, and a
     VIEW-ONLY member does neither. PROVISIONAL, and stated: `provenancechain`'s REPORT arm writes nothing, but
     this table gates an op rather than an arm (only `capture`'s GET is exempted, at the check), so a view-only
     member does not reach the report through a session either. §4.10 ruled reach and is silent on capability. */
  provenancechain:    "contribute",
  provenanceroute:    "contribute",
  calibrate:          "contribute",
  calibrationsubject: "contribute",
  calibrationsignal:  "contribute",
  /* T18 (N-A12, K705, K709, K711): the action layer's new acts write the working record — a communication draft or a
     template, an action's creation or a pressure mark on its correspondence, a plan, its subjects, options, proposals,
     dispositions, scenarios, checkpoint judgements, an option's start and a plan's close — so each rides `contribute`,
     T8's layer-9 acts' capability and reason, and NO fifth capability token is minted (CAPABILITIES.md §4). Who may act
     (a named member joined to the project) is each module's, asked of the stamped author: who a session IS. The
     proposal takes `actionlawspropose`'s capability, for its reason: proposing is contributing, never publishing. */
  communicationprepare: "contribute",
  templatesave:        "contribute",
  actioncreate:        "contribute",
  actionpressure:      "contribute",
  /* T20 (K902; actions R52): a hold statement is appended to the action's record in a member's name, `actionpressure`'s
     capability and reason. */
  actionhold:          "contribute",
  planopen:            "contribute",
  plansubjectadd:      "contribute",
  plansubjectremove:   "contribute",
  optionadd:           "contribute",
  optionrevise:        "contribute",
  optionpropose:       "contribute",
  optionadopt:         "contribute",
  optiondispose:       "contribute",
  scenarioset:         "contribute",
  checkpointrecord:    "contribute",
  optionstart:         "contribute",
  planclose:           "contribute",
  /* T18 (K704; action-clocks R4, R6; DEC-94): NO CAPABILITY, on `queuemute`'s reasoning (REC-21 / D-125) exactly. A
     reminder is one member asking when they are told about a deadline: it is a row of action-clocks' own table, never
     a field or a revision of the action, and changes nothing the record says. Requiring `contribute` would class a
     member's own attention as a corpus act, and leave a view-only member who can see a deadline unable to be reminded
     of it. What bounds the two is the module's: a machine refused by name, and only the member who set a reminder
     changes or answers it. Present, null, so the capability totality sees each. */
  reminderset:         null,
  reminderanswer:      null,
  /* T21 (K921, K927; op-declarations R8): the template library's member acts and the proposal write its rows in a
     member's name (or, for the proposal, a labelled machine's), `templatesave`'s capability and reason; confirming,
     correcting or disputing a profile fact writes local-facts' row in the member's name, the same. NO fifth capability
     token (CAPABILITIES.md §4): who may approve, retire or grant is the module's, asked of the stamped author. */
  templatedraft:       "contribute",
  templaterevise:      "contribute",
  templatesubmit:      "contribute",
  templatereviewgrant: "contribute",
  templategrantrevoke: "contribute",
  templateapprove:     "contribute",
  templateretire:      "contribute",
  templatepropose:     "contribute",
  factconfirm:         "contribute",
  /* NO CAPABILITY for the grant's two mutating doors: a recipient reaches them by the secret, with no session to hold a
     capability (`reviewcomment`'s posture), and a member's review or comment is judged by the module, asked of who may
     see the template. Nor for the five reads, on `contradictionpairs`' reasoning (asking the record is reading it).
     PRESENT, null, because affordances names all seven in NON_ACTS (its R30) and its totality reads a NON_ACTS key this
     table does not carry as stale (its R12), K516's precedent. */
  templatereview:      null,
  templatecomment:     null,
  templateread:        null,
  templatecomments:    null,
  templates:           null,
  factstatus:          null,
  factsdue:            null,
  /* T22 (K1019, K1023; op-declarations R9): declining to escalate appends to the escalation's record in a member's
     name, `escalationopen`'s capability and reason; setting a held capture aside or restoring it writes capture's row in
     the member's name, `inboxresolve`'s; an address's own frequency is a source owner's setting written to the record,
     the action layer's reason. Each `contribute`, NO fifth capability token (CAPABILITIES.md §4): who may act (a
     project's owner, a member who may see the capture) is the owning module's, asked of the stamped author. */
  declinetoescalate:   "contribute",
  /* T46 (R51; escalation R31, R33): stopping the pursuit and reopening append to the escalation's record in a member's
     name, `declinetoescalate`'s capability and reason. */
  escalationstoppursuing: "contribute",
  escalationreopen:    "contribute",
  heldsetaside:        "contribute",
  heldrestore:         "contribute",
  addressfrequencyset: "contribute",
  /* T47 (R55): drawing a question into a project writes its citation edges, `cite`'s capability; a project's own bar
     and a bundle's monitoring are written in a member's name, `contribute` as R55 states (a project's bar is its
     members' working setting, not the group's publication surface `strengthbar` rides). */
  drawquestion:        "contribute",
  projectbarset:       "contribute",
  monitorset:          "contribute",
  /* T47 (K3041): the review copy's two doors, now in both session sets, take NO WORKING CAPABILITY, as the template
     grant's doors (`templatereview`, `templatecomment`): a recipient reaches them by the secret with no session to hold
     one, and the owner judges a member's call. PRESENT, null, for R3's totality. */
  statementack:        null,
  reviewcomment:       null,
  /* NO CAPABILITY for capture's three reads, on `contradictionpairs`' reasoning (asking the record is reading it);
     PRESENT, null, as capture's other reads (`knocksof`, `lateattestations`), so affordances names each in NON_ACTS
     (its R7, R12). `escalationstatus` takes `escalationsdue`'s shape: no row. */
  heldcaptures:        null,
  gradenote:           null,
  doorbelltally:       null,
  /* T23 (op-declarations R10): a draft of what changed is a row in case-authoring's table in its proposer's name,
     `templatepropose`'s capability and reason (proposing is contributing, never publishing); a posted notice publishes an
     owner's signed revision in the project's name, a write of the record, `contribute` — NO fifth capability token
     (CAPABILITIES.md §4): who may post (an owner signed in as themselves) is network-notices', asked of the stamped `by`. */
  whatchangedpropose:    "contribute",
  noticepost:            "contribute",
  /* NO CAPABILITY for T23's reads, on `contradictionpairs`' reasoning (asking the record is reading it; preparing a
     notice writes nothing), nor for the three public reads, which answer every caller. PRESENT, null, because
     affordances names each in NON_ACTS (its R32) and its totality reads a NON_ACTS key this table does not carry as
     stale (its R12), K516's precedent — which is why `escalationreasondraft` has a row where `escalationstatus` has none.
     `directorysubmission` and `publicread`, named in no NON_ACTS, take `escalationstatus`' shape: no row. */
  escalationreasondraft: null,
  whatchangeddrafts:     null,
  sweeps:                null,
  noticeprepare:         null,
  notices:               null,
  activitymethod:        null,
  noticespublic:         null,
  groupkeyspublic:       null,
  /* T24 (op-declarations R11): NO CAPABILITY for the start preview, `publishpreflight`'s posture: it tells a member what
     starting would do and writes nothing, and `contribute` gates the start itself. PRESENT, null, because affordances
     names it in NON_ACTS (its R7) and its totality reads a NON_ACTS key this table does not carry as stale (its R12),
     K516's precedent. */
  optionstartpreview:    null,
  /* T27 (op-declarations R12; actions R56): releasing a hold appends a statement to the action's record in a member's
     name, `actionhold`'s capability and reason. NO CAPABILITY for the release's preview and the held-project read, the
     start preview's posture (each writes nothing; `contribute` gates the release itself): PRESENT, null, because
     affordances names both (its R33) in NON_ACTS and its totality reads a NON_ACTS key this table does not carry as stale
     (its R12), K516's precedent. */
  actionholdrelease:     "contribute",
  actionholdpreview:     null,
  projectholds:          null,
  /* T27 (op-declarations R13; docket R1, R2, R5, R7): filing to the record, marking a threat, posting a signed entry and
     declining a submission each write the docket in a member's name — `contribute`, NO fifth capability token
     (CAPABILITIES.md §4): who may post or decline (the case's manager) is docket's, asked of the stamped `by`. NO
     CAPABILITY for its reads (preparing writes nothing) nor its public reads, on `contradictionpairs`' reasoning: PRESENT,
     null, because affordances names each in NON_ACTS (its R34), K516's precedent. */
  docketfile:            "contribute",
  docketpressure:        "contribute",
  docketdecline:         "contribute",
  docketpost:            "contribute",
  docket:                null,
  docketprepare:         null,
  docketinvitation:      null,
  docketpublic:          null,
  docketfeed:            null,
  /* T28 (op-declarations R14; case-import R1, R5–R8): importing a case file, completing a missing document, accepting an
     edition or withdrawing the acceptance, and flagging or clearing a flag each write case-import's rows in a member's
     name — `contribute`, the house default for a member's act on the record, NO fifth capability token (CAPABILITIES.md
     §4): who may act (an active member) is case-import's, asked of the stamped `by`. NO CAPABILITY for its two reads nor
     case-checker's two public reads, on `contradictionpairs`' reasoning: PRESENT, null, because affordances names each
     (its R35) and its totality reads a NON_ACTS key this table does not carry as stale (its R12), K516's precedent. */
  caseimport:            "contribute",
  caseimportdocument:    "contribute",
  importaccept:          "contribute",
  importacceptwithdraw:  "contribute",
  importflag:            "contribute",
  importflagclear:       "contribute",
  importedcases:         null,
  importedcase:          null,
  casechecker:           null,
  casefilespec:          null,
  /* T31 (op-declarations R16; case-import R17): setting and lifting a watch write case-import's rows in a member's name,
     the import acts' capability and reason. */
  importwatch:           "contribute",
  importunwatch:         "contribute",
  /* T31 (op-declarations R15; wizard-scripts R3–R9): drafting, revising, submitting, approving and retiring a script each
     write wizard-scripts' rows in a member's name, `templatedraft`'s capability and reason, and the proposal
     `templatepropose`'s (proposing is contributing, never publishing) — NO fifth capability token (CAPABILITIES.md §4):
     who may approve or retire is the module's, asked of the stamped `by`. NO WORKING CAPABILITY for the editor's grant and
     revocation, on D-136's reasoning: an administrator's act over a member, bounded by the roster (NOT_AN_ADMIN, its R8),
     not one of section 5's working rights. NONE for the progress tally, on `queuemute`'s reasoning: it writes an
     unattributed count, nothing in anyone's name, and a view-only member runs wizards too (DEC-120 (1)). NONE for the six
     reads, on `contradictionpairs`' reasoning. Each PRESENT, because affordances names all fifteen (its R37) and its
     totality reads a NON_ACTS key this table does not carry as stale (its R12), K516's precedent. */
  wizarddraft:           "contribute",
  wizardrevise:          "contribute",
  wizardsubmit:          "contribute",
  wizardapprove:         "contribute",
  wizardretire:          "contribute",
  wizardpropose:         "contribute",
  wizardeditorgrant:     null,
  wizardeditorrevoke:    null,
  wizardprogress:        null,
  wizards:               null,
  wizardread:            null,
  wizardsat:             null,
  wizarduse:             null,
  wizardcandidates:      null,
  wizardcheck:           null,
  /* R18: the in-force read (standards R7's alias `standardinforce`), a present null as `inforceat`'s beside it. */
  standardinforce:       null,
  /* K1689: an export's page (`export`'s credential) and the detectors' run (the operator's, unattended by decision)
     take NO WORKING CAPABILITY — neither is a session's act — and are PRESENT, null, because affordances grades each
     (its R40: the page a NON_ACT, the run a substrate absence) and its totality reads a graded key this table lacks as
     stale (its R12), K516's precedent. */
  exportpage:            null,
  moneydetectorsrun:     null,
  /* T35 (K2038): the credit page and `recover` take NO WORKING CAPABILITY — each public, reached by every caller — and
     are PRESENT, null, because op-grades names both in NON_ACTS (its R22) and affordances' totality reads a NON_ACTS key
     this table does not carry as stale (its R12), K516's precedent. */
  credit:                null,
  recover:               null,
  /* T47 (R57; K3147): the reset link's use, public, takes NO WORKING CAPABILITY and is PRESENT, null, as `recover` is,
     because op-grades names it in NON_ACTS (its R37); the link's look and the group's languages are `publicread`s, whose
     kind gives the row. */
  passwordreset:         null,
  /* T36 (R32): the scheduler's four wakes over the files take NO WORKING CAPABILITY — none is a session's act — and are
     PRESENT, null, as `moneydetectorsrun`'s, because op-grades grades each (its R24) and affordances' totality reads a
     graded key this table lacks as stale (its R12), K516's precedent. */
  scanbatch:             null,
  renderbatch:           null,
  deeperbatch:           null,
  securityforward:       null,
  /* F1 (BD-1; corpus-export R17, R18): the whole-record export, its manifest and each of its parts, the founder's alone
     as `export` is. Each takes NO WORKING CAPABILITY, an administrator's act (D-136), and is PRESENT, null, as `export`'s
     row is: a session reaches it (the founder's), and the census reads a row for each mutating op a session reaches. A
     member is refused at the door because neither op is in the member's session set, never by a capability here. */
  exportwhole:           null,
  exportwholepart:       null,
  });
}

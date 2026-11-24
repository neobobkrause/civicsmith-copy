/* op-grades — R23–R25 (K2092, K2130; T36): THE OPS `op-declarations` R31–R33 DECLARES — standards' in-force-through
 * records and calculations' spot-check visit (K2092), the 23 ops of `file-safety` (N714, N707, N710; DEC-169, DEC-173)
 * and `credentials`' keep-away (N721; DEC-172) — graded by R5 and R3 with `affordances` R12's totality holding over
 * them, each grade read from its owner's requirements as R13, R17 and R22 do; and `openwithwarning`'s consequence
 * statement (DEC-173 (2)), published beside its ground as beside a rung. Data only: no op's behaviour is decided here
 * (P6). `./index.mjs` spreads the four tables into `RUNGS`, `RUNG_ABSENT`, `NON_ACTS` and `CONSEQUENCE_STATEMENTS`. This
 * file imports nothing, so the spread closes no cycle. None of these ops is in `MACHINE_REFUSALS`, which holds only
 * `affordances`' `ACTS` (R5, `affordances` R20): `standards` (`MACHINE_CANNOT_DECLARE_STANDARD`), `calculations`
 * (`MEMBER_ACT_ONLY`), `file-safety` (`MACHINE_CANNOT_RELEASE_HOLD`) and `credentials` (`NOT_AN_ADMIN`) refuse a machine
 * themselves. `securitycount` is a store-internal route with no spec (`op-declarations` R6) and takes no grade (R25). */

import { word } from "../setup-words/index.mjs";

const R = (s) => `read: ${s}; writes nothing`;
const STANDARD_THROUGH = "standard-directed: keyed by a standard's version, reached from the standard; records what a "
  + "checked source shows, with who, when and why; moves no bundle";
const FILE_ASKED = "file-directed: keyed by a capture's digest; asks the group's outside tools about this file; records "
  + "no one";
const SECURITY_TOOLS = "setting: the group's security tools, an administrator's act; moves no bundle";
const SECURITY_WAKES = "scheduler: the security wakes; name no member and move no bundle";

/* ---- the rungs (`affordances` R19's backing beside each) ---- */
export const T36_RUNGS = {
  /* R23 (K2092). standards R50: each refuses an absent reason STANDARD_NO_REASON; a record is withdrawn forward and kept,
     never erased */
  standardinforcethrough:         "reasoned", // STANDARD_NO_REASON (standards R50)
  standardinforcethroughwithdraw: "reasoned", // STANDARD_NO_REASON (standards R50: kept, shown withdrawn with who, when and why)
  /* calculations R38: the visit's testimony, the visitor's own firsthand words, is its reason, as testify's words are
     (affordances R19); a second visit is recorded beside the first, never replacing it */
  spotcheckvisit:                 "reasoned", // NOT_TESTIMONY (calculations R38)
  /* R24 (N714, N707). file-safety R17: one member's reasoned act of two; a release is corrected forward, a later finding
     placing a new hold (its R19) */
  releasescanhold:                "reasoned", // HOLD_NO_REASON (file-safety R17: empty, or over 2,000 characters)
  /* R25 (N721; DEC-172). credentials R51: `on: true` without a reason is refused `AI_KEEP_AWAY_NO_REASON` (C-29.32; T37,
     N755's follow-on: it answered NO_REASON before); a later set supersedes on read and the earlier is kept */
  aikeepaway:                     "reasoned", // AI_KEEP_AWAY_NO_REASON (credentials R51)
};

/* ---- the stated absences ---- */
export const T36_RUNG_ABSENT = {
  /* R35 (T47; N987; K3014): its one write is a verdict note naming no member, corrected forward by checking again
     (file-safety R3, R10, R13), and it asks no reason: `observational`, as deeperbatch, no longer `undetermined` */
  deepercheck:        { ground: "observational", is: "a member who may see a file asks for a deeper check of its bytes by the group's outside tools; its one write is a verdict note naming no member, corrected by checking again, and who asked is not kept (file-safety R3, R10, R13)" },
  /* R24. file-safety R33, on R3's rule: a member's request on a file asks no authored reason and no act takes it back;
     who asked is not kept (its R10) */
  safecopyrequest:    { ground: "undetermined", is: "a member who may see a file asks the group's safe-copy maker for a rebuilt, derived copy of it; asks no authored reason, no act takes it back, and who asked is not kept (file-safety R33, R10)" },
  /* file-safety R8, R10: each answers the original's bytes; its one write is the scan before first opening, an
     unattributed note naming no member */
  openoriginal:       { ground: "observational", is: "answers a file's original bytes to a member who may see it; its one write is the scan before first opening, a verdict note naming no member (file-safety R8, R10)" },
  openwithwarning:    { ground: "observational", is: "answers a high-risk file's original bytes after the member's two confirmations, never under a scan hold; its one write is the scan before first opening, a verdict note naming no member, and no confirmation is kept (file-safety R8, R10)" },
  /* file-safety R3, R4, R36: verdict notes, corrected by scanning again */
  scanbatch:          { ground: "observational", is: "the scheduler's daily scan of the files due, one verdict note per file and engine; a note is corrected by scanning again (file-safety R3, R4)" },
  deeperbatch:        { ground: "observational", is: "the scheduler's wake that starts queued deeper checks and collects each sandbox's verdict as a note (file-safety R3, R36)" },
  /* file-safety R12, R35: the scheduler's wake, as taskdrain */
  renderbatch:        { ground: "substrate", is: "the scheduler's wake that renders queued files' safe views, each stored apart as derived, never a capture (file-safety R12)" },
  securityforward:    { ground: "substrate", is: "the scheduler's hourly wake that forwards the period's security counts to the group's log tools, naming no file and no member (file-safety R35)" },
  /* file-safety R28, R30: a tool's credentials held or removed through credentials R29, as keyedserviceset, groupkeyset
     and groupkeyremove */
  securitytooladd:    { ground: "credential", is: "an administrator adds a security tool, its credentials held sealed through the keyed services and the tool off until tested (file-safety R28)" },
  securitytoolremove: { ground: "credential", is: "an administrator removes a security tool and its credentials, its notes kept and the tool never called again (file-safety R30)" },
  /* file-safety R29, as keyedserviceswitch: a passing test turns the tool on */
  securitytooltest:   { ground: "substrate", is: "an administrator tests a security tool; a passing test turns it on, and it moves no document, claim or grade (file-safety R29)" },
};

/* ---- every op's NON_ACTS reason (R5) ---- */
export const T36_NON_ACTS = {
  /* R23 */
  standardinforcethrough: STANDARD_THROUGH,
  standardinforcethroughwithdraw: STANDARD_THROUGH,
  spotcheckvisit: "draw-directed: keyed by a draw and one drawn item, reached from the spot-check; ties the visitor's own "
    + "testimony to the item; moves no bundle",
  inforcethroughof: R("every record that a standard's version is in force through a date, standing and withdrawn, with "
    + "its source, how it was checked, its author and time"),
  spotcheck: R("a spot-check's draw, its question and each drawn item with its visits and standing, the counts and the "
    + "estimates held over it"),
  /* R24: the 23 ops of file-safety */
  openoriginal: "file-directed: keyed by a capture's digest, reached from the safe view's one click; answers the "
    + "original's bytes to a member who may see it, a high-risk file only after a fresh clean deeper check (`override`); "
    + "records no one",
  openwithwarning: "file-directed: keyed by a capture's digest, reached from the warning before opening; answers a "
    + "high-risk original after the member's two confirmations, never under a scan hold; records no one and keeps no "
    + "confirmation",
  deepercheck: FILE_ASKED,
  safecopyrequest: FILE_ASKED,
  releasescanhold: "file-directed: keyed by a capture's digest under a scan hold, reached from the held file; one "
    + "member's reasoned act of two, never a machine's; moves no bundle",
  securitytooladd: SECURITY_TOOLS,
  securitytooltest: SECURITY_TOOLS,
  securitytoolremove: SECURITY_TOOLS,
  scanbatch: SECURITY_WAKES,
  renderbatch: SECURITY_WAKES,
  deeperbatch: SECURITY_WAKES,
  securityforward: SECURITY_WAKES,
  verdictnotes: R("a file's verdict notes, oldest first, each naming its tool, engine and version"),
  threatof: R("a file's threat grade, low or high, with each reason named, computed at the call"),
  originalstate: R("whether a file's original may open now and by which path, or the refusal opening it would give"),
  safeview: R("a file's safe view, a derived copy so labeled, with what opening the original would answer"),
  safecopy: R("a file's safe copy, rebuilt by the group's tool and so labeled, and its bytes"),
  scanstatus: R("the scanner's and renderer's state, the queue and what is overdue or held, to an administrator"),
  scanfindings: R("every found verdict in order, for the notices of a finding; names no member"),
  findingkind: R("a scanner's finding name explained in member words"),
  securitytools: R("the group's security tools, never their credentials, to an administrator"),
  securitytoolcatalogue: R("the security tools offered, refused or held, each with its stated handling, to an "
    + "administrator"),
  securitytoolevents: R("each security tool's adds, tests, removals and switches off, naming no file, to an "
    + "administrator"),
  /* R25 */
  aikeepaway: word("ai-accounts.declared.aikeepaway"),
  aikeepawaystate: R("whether the group keeps its material away from every assistant, with the reason, who set it and "
    + "when"),
};

/* ---- R24 (DEC-173 (2)): `openwithwarning`'s consequence entry, published beside its ground (`observational`) as a
   statement is beside a rung; no rung is added (R3). The file is high risk for the reasons the surface shows beside it
   (file-safety R6's, in its member words, R24); the two confirmations are `warned`'s two fields (file-safety R8); and who
   opens which file, and who confirmed, is never recorded (DEC-169 (5), DEC-173 (4); file-safety R10). (R44, T49) The
   entry holds the key of the sentence that says what opening risks, `screen.open-file.warn.ends`, never its English; the
   confirmations and the not-recorded line are the screen's own keys. ---- */
export const T36_CONSEQUENCE_STATEMENTS = Object.freeze({
  openwithwarning: Object.freeze({ friction: "dialog", key: "screen.open-file.warn.ends" }),
});

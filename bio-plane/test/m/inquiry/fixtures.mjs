/* inquiry's published fixtures (fix round 10; K4990, K4993, K4995, K5044): what the module answers, made by its real code
   over the real record, promotion, retrieval and membership each time a test calls one, never stored. A module that reads
   inquiry takes its answer from here and never builds one by hand. Each export returns the real answers together with the
   ids the real code was given. */
import { world, inquiryMd, V, MACHINE } from "./fixture.mjs";

const A = "INFO-2026-9001-a", B = "INFO-2026-9002-b";
const Q = "INQ-2026-9001-q", R = "INQ-2026-9002-r", S = "INQ-2026-9003-s", MIGRATED = "INQ-2026-9004-m";
const P = "INQ-2026-9010-p", C1 = "INQ-2026-9011-a", C2 = "INQ-2026-9012-b", E = "INQ-2026-9013-e", G = "INQ-2026-9014-g";
const must = (r, what) => {
  if (!r || r.ok !== true) throw new Error(`fixture ${what} refused: ${JSON.stringify(r).slice(0, 300)}`);
  return r;
};

/** R16 (leg-earning R4): `basisFor` asked for no question at all, which it cannot read (`NO_ID`), and for one the record
 *  does not hold, which it reads as a question resting on nothing. */
export function basisForUnread() {
  const w = world();
  return { inquiry: w.k, noId: w.k.basisFor(""), unheld: w.k.basisFor("INQ-2026-9099-x"), unheldId: "INQ-2026-9099-x" };
}

/** R11, R62: the refusals a promotion of an inquiry's basis is answered with, each from a real promote of a bad basis:
 *  `basisRefused` (a leg whose role is no role, with its `findings`), `selfBasis` (a leg resting on the
 *  question itself), `basisCycle` (a leg closing a cycle, with the whole `path`) and `machinePassageUnchecked` (the read
 *  that says whether a member may cite a machine's passage fails). `question` is the id the first, second and fourth name,
 *  `cycleQuestion` the one the third does. Nothing is written by any of them. */
export function basisRefusals() {
  const w = world(); w.member("alice"); w.doc(A); w.doc(B);
  const basisRefused = w.promote(Q, inquiryMd(Q, { legs: [{ target: A, role: "maybe" }] }), null, { author: V("alice") });
  const selfBasis = w.promote(Q, inquiryMd(Q, { legs: [{ target: Q }] }), null, { author: V("alice") });
  must(w.promote(R, inquiryMd(R, { legs: [{ target: A }] }), null, { author: V("alice") }), "question R");
  must(w.promote(S, inquiryMd(S, { legs: [{ target: R }] }), null, { author: V("alice") }), "question S");
  const basisCycle = w.promote(R, inquiryMd(R, { legs: [{ target: A }, { target: S }] }), undefined, { author: V("alice") });
  const m = world(); m.member("alice"); m.doc(A);
  m.k.onMachinePassage("run-productions", () => { throw new Error("the read is down"); });
  const machinePassageUnchecked = m.promote(Q, inquiryMd(Q, { legs: [{ target: A }] }), null, { author: V("alice") });
  return { world: w, machineWorld: m, question: Q, cycleQuestion: R, basisRefused, selfBasis, basisCycle, machinePassageUnchecked };
}

/** R20–R22 (`dispose`): the real act over a real selection and the real promotion. `done` is the answer of deferring two
 *  questions at once; `unknownSelection` and `notYours` the answers for a handle nothing holds and for a selection another
 *  owner made; `dispose(args)` makes the same act again over `handle` with the viewer, owner and author given. */
export function disposeAct({ to = "deferred", reason = "later", author = V("alice") } = {}) {
  const w = world(); w.member("alice");
  w.inquiry(Q); w.inquiry(R);
  w.select("pair", [Q, R]);
  const act = (args = {}) => w.k.dispose({ handle: "pair", to, reason, viewer: "admin", owner: "o", author, ...args });
  const notYours = act({ owner: "someone-else" });
  const unknownSelection = act({ handle: "sel-none" });
  const done = act();
  return { world: w, inquiry: w.k, ids: [Q, R], handle: "pair", to, reason, author, done, unknownSelection, notYours,
           dispose: act };
}

/** R55 (the dated waits notice-producers reads, K2480): one dated wait, `viewer`'s own, stated on a question by that viewer's
 *  promotion, and the real `datedWaits` answer to that viewer at `asOf` (its local midnight of `date`, 07:00Z in October,
 *  Los Angeles time: `due`), and at one second before it (`before`, `waiting`). `viewer` is a member stamp (`member:<id>`),
 *  `date` a day (`YYYY-MM-DD`). `answer` is the real answer as `datedWaits` gives it: its zone, its waits, each with its
 *  text, description, date, state and `set_by`. `admin` reads none of it. */
export function datedWaitOf({ viewer = V("alice"), date = "2026-10-10", asOf = `${date}T07:00:00Z` } = {}) {
  const w = world({ view: () => ({ time_zone: { value: "America/Los_Angeles" } }) });
  const member = viewer.slice("member:".length);
  w.member(member);
  const question = "INQ-2026-9005-w";
  must(w.promote(question, inquiryMd(question, { extra: ["recheck_triggers:", `  - text: "the auditor's reply"`,
    `    description: "from the City"`, `    date: "${date}"`] }), null, { author: viewer }), "dated-wait question");
  return { inquiry: w.k, question, viewer, date, asOf,
           answer: w.k.datedWaits({ member: viewer, asOf, viewer }),
           before: w.k.datedWaits({ member: viewer, asOf: `${date}T06:59:59Z`, viewer }),
           none: w.k.datedWaits({ member: viewer, asOf, viewer: "admin" }) };
}

/** R49 (`migratedSurfacing`): the surfacing a migration replay recorded for `migrated`, and null for `plain`, a question
 *  made on this plane. */
export function migratedSurfacing() {
  const w = world();
  must(w.promote(MIGRATED, inquiryMd(MIGRATED), null, { migrationReplay: { capture: "c".repeat(64), promotion: "P-1" } }), "migrated question");
  w.inquiry(Q);
  return { inquiry: w.k, migrated: MIGRATED, plain: Q, migratedAnswer: w.k.migratedSurfacing(MIGRATED),
           plainAnswer: w.k.migratedSurfacing(Q) };
}

/** R33, R65: the real refusals of a read of a question (`partitionOf`, `op=inquirypartition`): `NOT_AN_INQUIRY` for a
 *  bundle that is no question, and `NO_SUCH_BUNDLE`, one answer, for an id the record does not hold and for a question the
 *  viewer may not see (`hidden`, read by `outsider`, who is not in the project that holds it). */
export function readRefusals() {
  const w = world(); w.member("alice"); w.member("bob");
  w.doc(A); w.inquiry(Q); w.inquiry(R);
  const hidden = w.project("Bob's own", "bob");
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, hidden, Q);
  return { inquiry: w.k, question: Q, visibleQuestion: R, document: A, absentId: "INQ-2026-9099-x", outsider: V("alice"),
           notAnInquiry: w.k.partitionOf({ id: A, viewer: "admin" }),
           absent: w.k.partitionOf({ id: "INQ-2026-9099-x", viewer: "admin" }),
           hiddenFromViewer: w.k.partitionOf({ id: Q, viewer: V("alice") }),
           visible: w.k.partitionOf({ id: R, viewer: V("alice") }) };
}

/** R55, R58 (K5130; the question's own screen reads it through `op=questionwaits`): the real `questionWaits` answer for a
 *  question with one document cited to it that another member sets aside with a reason, as the asker reads it
 *  (`answer`: `waits` the dated waits, none; `document_waits` that one wait `{document, by, reason, at}`; `history` its
 *  set-aside), then after a restore by the asker (`restored`: `document_waits` empty, `history` holding the set-aside and
 *  the restore), and as a viewer who may not see the document reads it (`hiddenFrom`: neither). `asker` and `setter` are
 *  member stamps (`member:<id>`). Made by the real capture module's set-aside and restore. */
export function questionWaitsSetAside({ asker = V("alice"), setter = V("bob"), reason = "Not needed yet.",
                                        restoreReason = "The question needs it after all." } = {}) {
  const w = world({ capture: true });
  const [askerId, setterId] = [asker, setter].map((v) => v.slice("member:".length));
  w.member(askerId); w.member(setterId);
  w.inquiry(Q); w.doc(A);
  w.held.registerReader("captured-for", "capture-requests", ({ document }) => ({ questions: document === A
    ? [{ question: Q, asker, title: "Is the question answered?", visible: true, waiting: true }] : [] }));
  const read = (viewer = asker) => w.k.questionWaits({ question: Q, viewer, asOf: "2026-10-10T12:00:00Z" });
  must(w.held.setAside({ ids: [A], reason, author: setter, viewer: setter }), "set-aside");
  const answer = read();
  const hidden = w.project("Setter's own", setterId);
  w.st.sql.exec(`UPDATE bundles SET project=? WHERE bundle_id=?`, hidden, A);
  const hiddenFrom = read();
  w.st.sql.exec(`UPDATE bundles SET project=NULL WHERE bundle_id=?`, A);
  must(w.held.restoreHeld({ ids: [A], reason: restoreReason, author: asker, viewer: asker }), "restore");
  return { inquiry: w.k, question: Q, document: A, asker, setter, reason, restoreReason, answer, hiddenFrom, restored: read() };
}

/** R23–R25 (`op=inquirydivide`): the real division of a question of two supporting legs into two children, as the answer
 *  a screen reads it (`divided`: `into`, `children`, `apportionment`), and each refusal the screens build by hand, from the
 *  real act over this world: `childExists` (a child's id names a record already: `CHILD_EXISTS`), `noHome` (both children
 *  take leg 0, so leg 1 is no child's: `NO_APPORTIONMENT`, its `orphans` naming it), `noReason` (`NO_REASON`), `notAnInquiry`
 *  (a document: `NOT_AN_INQUIRY`), `absent` (`NO_SUCH_BUNDLE`) and `machine` (a machine's author: `MACHINE_CANNOT_DIVIDE`,
 *  with its row). A refusal writes nothing, so each is asked before the division that lands. */
export function divideAnswers() {
  const w = world(); w.member("alice"); w.doc(A); w.doc(B);
  w.inquiry(P, { legs: [{ target: A }, { target: B }] });
  w.inquiry(E);
  const kids = (a, b) => [{ id: C1, question: "First half?", legs: a }, { id: C2, question: "Second half?", legs: b }];
  const act = (extra = {}) => w.k.divide({ target: P, reason: "two questions", children: kids([0], [1]), viewer: "admin",
                                            author: V("alice"), ...extra });
  const childExists = w.k.divide({ target: P, reason: "two questions", viewer: "admin", author: V("alice"),
    children: [{ id: E, question: "First half?", legs: [0] }, { id: C2, question: "Second half?", legs: [1] }] });
  const noHome = act({ children: kids([0], [0]) });
  const noReason = act({ reason: "" });
  const notAnInquiry = act({ target: A });
  const absent = act({ target: "INQ-2026-9099-x" });
  const machine = act({ author: MACHINE });
  const divided = act();
  return { world: w, parent: P, children: [C1, C2], existing: E, document: A, childExists, noHome, noReason, notAnInquiry,
           absent, machine, divided };
}

/** R27, R85 (`op=inquiryground`): the real partition of a question with a supporting and a cutting leg, as the answer a
 *  screen reads it (`authored`), its restructure (`restructured`: the empty partition, with a reason), and each refusal the
 *  screens build by hand: `noPartition` (`NO_PARTITION`), `notAnInquiry` (`NOT_AN_INQUIRY`), `absent` (`NO_SUCH_BUNDLE`),
 *  `cutsAgainst` (a partition naming the cutting leg: `BASIS_REFUSED`, its finding naming the leg) and `noReason` (a
 *  restructure without its reason: `NO_REASON`). `heldAfterAuthored` and `heldAfterRefusals` are the question's bytes
 *  after the authored act and after every refusal: a refusal writes nothing, so they are equal. */
export function groundAnswers() {
  const w = world(); w.member("alice"); w.doc(A); w.doc(B);
  w.inquiry(G, { legs: [{ target: A }, { target: B, role: "cuts_against" }] });
  const ground = (grounds, extra = {}) => w.k.ground({ target: G, grounds, viewer: "admin", author: V("alice"), ...extra });
  const noPartition = ground(undefined);
  const notAnInquiry = ground([], { target: A });
  const absent = ground([], { target: "INQ-2026-9099-x" });
  const cutsAgainst = ground([{ ground: "g1", legs: [0, 1] }]);
  const authored = ground([{ ground: "g1", legs: [0] }]);
  const heldAfterAuthored = w.text(G);
  const noReason = ground([{ ground: "g2", legs: [0] }], { reason: "" });
  const heldAfterRefusals = w.text(G);
  const restructured = ground([], { reason: "no grouping after all" });
  return { world: w, question: G, document: A, noPartition, notAnInquiry, absent, cutsAgainst, authored, noReason,
           restructured, heldAfterAuthored, heldAfterRefusals };
}

/** R55, R58 (`op=questionwaits`): the real `questionWaits` answer for a question nobody has made a wait on, read by its
 *  asker: no dated wait, no set-aside, nothing in its history. The world holds `capture`, which the set-asides are read
 *  from: without it the answer says the set-asides could not be read, which is not what the screen is shown. */
export function questionWaitsNone() {
  const w = world({ capture: true }); w.member("alice");
  w.inquiry(Q);
  return { inquiry: w.k, question: Q, answer: w.k.questionWaits({ question: Q, viewer: V("alice"), asOf: "2026-10-10T12:00:00Z" }) };
}

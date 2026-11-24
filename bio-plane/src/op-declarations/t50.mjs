/* op-declarations R73 (T50; K3643, K3627, K3637; `op-grades` R45, `affordances` R65): T50'S 15 NEW OPS IN THE OWNERS'
   FAMILIES, held apart from `index.mjs` for size, as `t45.mjs` to `t49.mjs` hold the earlier tranches'. Each op is named
   under its owner with the kind `index.mjs`' `OP_KINDS` gives it, read from the owner's merged requirement. `index.mjs`'
   `family()` merges each share into its owner's family, and builds each of `T50_FAMILIES` as it builds `T45_FAMILIES`.
   The kinds, each as R73 states it:
   - `own` (a member's act on her own attention, a session's only, no working capability): `watchitem`;
   - `member` (an act its owner refuses a machine by name, `contribute`): `secondlook`, `secondlookclear`,
     `actionstake`, `actioninquiry`;
   - `owners` (a project's setting decided by its owner's own predicate, no working capability): `projectstakeset`;
   - `ownread` (a read for a session only): `lookedat`, `opencaptures` (each `by` stamped, never a request field),
     `projectstake`, `projectownersgone`;
   - `read` (admin, member, probe): `browse`, `capturegrade`, `inquirypartition`, `instances`, `stakeatpreparation`.
   Each is stamped `viewer` beside the stamp its family names; `projectId`, `item`, `on`, `target`, `stake`, `action`,
   `question`, `note`, `flag`, `kinds`, `only`, `since`, `after`, `limit`, `captureSha`, `id`, `set` are request fields,
   never stamps. This file is data only (R5, R7). */

const QUERY = (key) => Object.freeze({ key, at: "query" });

const T50_SHARES = Object.freeze({
  /* following R32, R33 (R73): an item watched by the member for herself, and a second look asked of an item, kept and
     cleared by a member (MACHINE_CANNOT_FOLLOW); `by` from the query, `item`, `on`, `note` and `flag` the body's. */
  following: Object.freeze({ cite: "following R32, R33; R73", ops: Object.freeze({
    watchitem: "own", secondlook: "member", secondlookclear: "member" }) }),
  /* membership R148 (R73): the instant a member last looked at Home, read back, a session's own read; `by` is the
     session's member, never a request field. */
  membership: Object.freeze({ cite: "membership R148; R73", extra: Object.freeze({ lookedat: Object.freeze(["by"]) }),
    ops: Object.freeze({ lookedat: "ownread" }) }),
  /* acquisition R46 (R73): the captures still open for the member, a session's read, `by` stamped and no instant taken
     from the request. */
  acquisition: Object.freeze({ cite: "acquisition R46; R73", extra: Object.freeze({ opencaptures: Object.freeze(["by"]) }),
    ops: Object.freeze({ opencaptures: "ownread" }) }),
  /* project-roster R31–R33 (R73): a project's stake set by its owners under their own predicate, and the stake and the
     owners who have gone read back by a member's session; `projectId` the request's. */
  "project-roster": Object.freeze({ cite: "project-roster R31, R32, R33; R73", ops: Object.freeze({
    projectstakeset: "owners", projectstake: "ownread", projectownersgone: "ownread" }) }),
  /* retrieval R85, capture R95, inquiry R65, filings R62 (R73): reads by the viewer's sight, every parameter the query's. */
  retrieval: Object.freeze({ cite: "retrieval R85; R73", ops: Object.freeze({ browse: "read" }) }),
  capture: Object.freeze({ cite: "capture R95; R73", ops: Object.freeze({ capturegrade: "read" }) }),
  inquiry: Object.freeze({ cite: "inquiry R65; R73", ops: Object.freeze({ inquirypartition: "read" }) }),
  filings: Object.freeze({ cite: "filings R62; R73", ops: Object.freeze({ stakeatpreparation: "read" }) }),
});

const T50_FAMILIES = Object.freeze([
  /* action-records R17, R19 (R73): a stake recorded on an action and an inquiry opened on one, a joined member's acts
     (the owner refuses a machine by name), `author` from the query beside the viewer, `target`, `stake` and `action`,
     `question` the body's. */
  Object.freeze({ owner: "action-records", cite: "action-records R17, R19; R73", actor: QUERY("author"), ops: Object.freeze({
    actionstake: "member", actioninquiry: "member" }) }),
  /* progressions R44 (R73): the instances of a progression, a read by the viewer's sight; `set`, `limit` and `after`
     the query's. */
  Object.freeze({ owner: "progressions", cite: "progressions R44; R73", ops: Object.freeze({ instances: "read" }) }),
]);

export { T50_SHARES, T50_FAMILIES };

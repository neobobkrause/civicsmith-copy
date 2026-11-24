/* op-declarations R55, R57, R59, R61 (T47; N969, N972, N974–N977, K3041, K3061 D3, K3084, K3104; DEC-201, DEC-205,
   DEC-207 (8); N1001): T47'S OPS IN THE OWNERS' FAMILIES, held apart from `index.mjs` for size, as `t45.mjs` and
   `t46.mjs` hold T45's and T46's. Each op is named under its owner with the kind `index.mjs`' `OP_KINDS` gives it, read
   from the owner's merged requirement and, where the owner serves it, its ops map's arm. The ops T47 adds to an act
   list of `index.mjs` (`drawquestion` as `cite`, `projectbarset` as `strengthbar`, `monitorset` as
   `addressfrequencyset`), whose stamps they take, are declared there, not here. `REAUTH_ACTS` (R58) is here too.
   This file is data only (R5, R7): `index.mjs`' `family()` merges each share into its owner's family, as it merges
   `T45_SHARES` and `T46_SHARES`, and builds each of `T47_FAMILIES` as it builds `T45_FAMILIES`. */

const T47_SHARES = Object.freeze({
  /* credentials R65, R66, R69, R71 (R57; K3084): a locked session unlocked and a session's password asked again, each a
     session's own end (`signout`'s kind: a session's only, no working capability), stamped with the presenting
     `session` and with `source` and `country` (admission R21, as `login`'s), `password` the body's only; a reset link
     made for a member by an administrator (NOT_AN_ADMIN), `by` the query's, `member` the body's; the link looked at (a
     public read with a present null row, `handlecheck`'s kind, K3147) and used, credential-free as `recover` is, `link` and `password` the body's only, `source` and `country` stamped. */
  credentials: Object.freeze({ cite: "credentials R65, R66, R69, R71; R57; K3084",
    extra: Object.freeze({ unlock: Object.freeze(["session", "source", "country"]),
                           reauth: Object.freeze(["session", "source", "country"]),
                           passwordresetlook: Object.freeze(["source", "country"]),
                           passwordreset: Object.freeze(["source", "country"]) }),
    ops: Object.freeze({ unlock: "sessionend", reauth: "sessionend", passwordresetlink: "admin",
                         passwordresetlook: "publicread", passwordreset: "door" }) }),
  /* people R37 (R61; K3104): the people directory, a member's read by the viewer's sight, every field the query's. */
  people: Object.freeze({ cite: "people R37; R61; K3104", ops: Object.freeze({ peopledirectory: "ownread" }) }),
  /* project-roster R26 (R55; N972): the projects a member may see, with their stage, a read as `projectdirectory`'s,
     `limit` the query's. */
  "project-roster": Object.freeze({ cite: "project-roster R26; R55; N972", ops: Object.freeze({ projectlist: "read" }) }),
  /* instance-setup R84, R85 (R59; DEC-205, DEC-201 (8)): the group's logo and its languages set by an administrator
     (NOT_AN_ADMIN), `by` the query's, `image` and `languages` the body's; the languages read by every caller, a public read
     with a present null row (K3147). */
  "instance-setup": Object.freeze({ cite: "instance-setup R84, R85; R59; DEC-205", ops: Object.freeze({
    grouplogoset: "admin", grouplanguagesset: "admin", grouplanguages: "publicread" }) }),
  /* tasks R19 (R59; DEC-207 (8)): a member asked to sign a case's edition, a member's act (MACHINE_CANNOT_ASK_SIGN),
     `by` the query's beside the viewer. */
  tasks: Object.freeze({ cite: "tasks R19; R59; DEC-207 (8)", ops: Object.freeze({ signrequest: "member" }) }),
});

const T47_FAMILIES = Object.freeze([
  /* basis-versions R50 (R55; N974): a project's questions, a read by the viewer's sight, `project`, `after` and `limit`
     the query's. */
  Object.freeze({ owner: "basis-versions", cite: "basis-versions R50; R55; N974", ops: Object.freeze({
    projectquestions: "read" }) }),
  /* signin-door R5 (R59; N1001; connect §3): the test instance's sign-in trace, read from an administrator's session
     (the door answers SIGNINTRACE_NOT_TEST off a test instance); its handler is the door's route. */
  Object.freeze({ owner: "signin-door", cite: "signin-door R5; R59; N1001", ops: Object.freeze({ signintrace: "ownread" }) }),
]);

/* R58, R62, R63 (K3061 D3, K3143, K3144; credentials R66): THE ACTS THAT ASK THE PASSWORD AGAIN, imported by admission
   (its R25). Each op maps to `null` (every call asks it) or to `{field, values}`: the body's `field`, else the query's,
   being one of `values`, or, with `values: null`, the field present at all. `memberset` is `{field: "role", values:
   null}`, wider than "a role to or from admin", since admission cannot read a member's present role (R62). Frozen data
   (R5). */
const REAUTH_ACTS = Object.freeze({
  caseratify: null, publishat: null, publishatmove: null, ratify: null, docketpost: null,
  adminendorse: null, adminremove: null,
  memberset: Object.freeze({ field: "role", values: null }),
  memberadd: Object.freeze({ field: "role", values: Object.freeze(["admin"]) }),
  subscriptionsignin: Object.freeze({ field: "step", values: Object.freeze(["start"]) }),
  accountreferenceset: null, groupkeyset: null, projectkeyset: null, projectsigninset: null,
});

export { T47_SHARES, T47_FAMILIES, REAUTH_ACTS };

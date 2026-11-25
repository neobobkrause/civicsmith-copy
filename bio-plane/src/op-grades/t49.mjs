/* op-grades — R43 (T49; R32's pattern; N1072, N1091; K3333; `op-declarations` R71, R72; `membership` R144, R129;
 * `project-roster` R30): THE TWO OPS T49'S OWNERS ADD, graded by R5 and R3 with `affordances` R12's totality holding over
 * them, each grade read from its owner's requirements as R13, R17, R22–R37 and R38–R41 do. Data only: no op's behaviour
 * is decided here (P6).
 *
 * `./index.mjs` spreads the tables into `RUNG_ABSENT` and `NON_ACTS`. This file imports nothing, so the spread closes no
 * cycle. Neither op is in `MACHINE_REFUSALS` (`membership` refuses any `by` but the founder's, `FOUNDER_HANDLE_NOT_FOUNDER`;
 * `projectownervotes` is a read), takes a `CONSEQUENCE_STATEMENTS` entry or joins `IRREVERSIBLE_WEIGHT`. By R18 `phone`
 * follows the ground: `founderhandleset` answers true (advisory; nothing refuses by device). R3's tally of `undetermined`
 * ops is unchanged: `founderhandleset` is `caller-owned`. */

/* ---- the stated absences ---- */
export const T49_RUNG_ABSENT = {
  /* R43, as `handlechange` (R29, R34) and `setpassword` (R27): the founder's own handle asks no reason, and no published act
     takes it back — a second set is refused HANDLE_FIXED, and so is every `handlechange` (membership R129) — so by R3 it is
     neither `reversible` nor `reasoned` (K3333: not the plan's `reversible`) */
  founderhandleset: { ground: "caller-owned", is: "the founder's own handle, the one she signs in and is known by, chosen once and never changed: a second set is refused HANDLE_FIXED, as every handlechange is (membership R144, R129)" },
};

/* ---- every op's NON_ACTS reason (R5) ---- */
export const T49_NON_ACTS = {
  founderhandleset: "member-directed: the founder's own handle, the one she signs in and is known by, chosen once and never "
    + "changed (`HANDLE_FIXED`); writes no record and moves no bundle",
  projectownervotes: "read: the owner changes of a project still waiting on agreement, who has agreed and who is awaited, "
    + "answered only to a viewer who sees the project whole",
};

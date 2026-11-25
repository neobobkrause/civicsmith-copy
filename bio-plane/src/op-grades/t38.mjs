/* op-grades — R28 (N788; DEC-183 (2); K2300; T38): THE WITHDRAWAL OF A MARK ON A PHOTO (`case-carriage` R14, declared by
 * `op-declarations` R40), graded by R5 and R3 with `affordances` R12's totality holding over it, its grade read from its
 * owner's requirements as R13, R17 and R22–R27 do; and `obscuremark` (R27) moved to `RUNGS` now that a published act
 * takes a mark back. Data only: no op's behaviour is decided here (P6). `./index.mjs` spreads the two tables into `RUNGS`
 * and `NON_ACTS`; `obscuremark`'s reason stays in `./t37.mjs` beside its other T37 ops. This file imports nothing, so the
 * spread closes no cycle. Neither op is in `MACHINE_REFUSALS`, which holds only `affordances`' `ACTS` (R5, `affordances`
 * R20): `case-carriage` refuses a machine itself (`MACHINE_CANNOT_MARK_PHOTO` at the mark, C-141.1;
 * `MACHINE_CANNOT_WITHDRAW_MARK` at the withdrawal, C-141.7). No consequence statement, vocabulary or prompt is added. */

/* ---- the rungs (`affordances` R19's backing beside each) ---- */
export const T38_RUNGS = {
  /* case-carriage R14: refused without a reason WITHDRAW_NO_REASON (C-141.10); the withdrawal is its own row beside the
     mark, never erased (its R12) */
  obscuremarkwithdraw: "reasoned",   // WITHDRAW_NO_REASON (case-carriage R14, C-141.10)
  /* case-carriage R9, R14, on R3's rule: a mark asks no authored reason, and a published act (obscuremarkwithdraw) takes
     it back; the mark is kept beside its withdrawal (its R12). It left RUNG_ABSENT (R27's `undetermined`) in T38. */
  obscuremark:         "reversible", // obscuremarkwithdraw takes it back
};

/* ---- every op's NON_ACTS reason (R5) ---- */
export const T38_NON_ACTS = {
  obscuremarkwithdraw: "photo-directed: keyed by a photo's capture and one mark, reached from the Photos step; a member's "
    + "reasoned withdrawal of a mark, recorded beside it, never erased; moves no bundle",
};

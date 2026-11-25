/* op-grades — R31 (T42; N832; `op-declarations` R47; K2611, K2613): `pagetranscribe` (`extraction` R71), the member's act
 * by which the AI reads the pages Civicsmith could not, graded by R5 and R3 with `affordances` R12's totality holding over
 * it, its grade read from its owner's requirements as R13, R17 and R22–R30 do. Data only: no op's behaviour is decided
 * here (P6).
 *
 * `./index.mjs` spreads the two tables into `RUNG_ABSENT` and `NON_ACTS`. This file imports nothing, so the spread closes
 * no cycle. It is not in `MACHINE_REFUSALS`, which holds only `affordances`' `ACTS` (R5, `affordances` R20): `extraction`
 * refuses an agent by its own code (C-51.2). By R18 it answers `phone: true` (ground `undetermined`). Its reason does not
 * begin `capture-directed:`, which R5 reserves for `affordances`' `CAPTURE_ACTS`. No consequence statement, vocabulary or
 * prompt is added. (`transcribe` is content R23's typing, graded `reasoned` in `./index.mjs`; K2613.) */

/* ---- the stated absence ---- */
export const T42_RUNG_ABSENT = {
  /* on R3's rule, as captureupload (R30): it writes a reading that a later re-read or an attestation corrects forward,
     asks no reason, and no published act takes it back */
  pagetranscribe: { ground: "undetermined", is: "at a member's act, the AI reads the pages of a capture Civicsmith could not read, on the account that pays and within its limits; the text is kept labeled the AI's reading and undetermined, the earlier reading kept, and a later re-read or an attestation corrects it forward (extraction R71, R72)" },
};

/* ---- its NON_ACTS reason (R5) ---- */
export const T42_NON_ACTS = {
  pagetranscribe: "reading-directed: keyed by a capture; at a member's act, the AI reads the pages Civicsmith could not, "
    + "on the account that pays and within its limits; the text is labeled the AI's reading and undetermined; moves no "
    + "bundle",
};

/* store-door: THE PROMOTION STEP (R5, was control-plane R42; K764, K846, K861 (3), (4), K874, K923; copied whole at the
   split, K1974). The step `legacy-store` once registered with promotion, now this module's export: provenance's
   testimony slot (its R52) and membership's sight index (D-497),
   which membership cannot register because it does not use promotion. This module registers nothing itself: `plane`
   registers `promotionStep(host)` under this module's name (plane R10), at the rank `legacy-store`'s step had in its
   `STEP_ORDER` (after every module of layers 1-10, before every module of layer 11; N548), so every step's checks and
   projections, every answer and the order of refusals are as they were. */
import { stepContext } from "../promotion/index.mjs";
import { provenanceOf } from "../provenance/index.mjs";
import { membershipOf } from "../membership/index.mjs";

/** R5: the step, `{check, project}` for `promotion.registerStep` (promotion R39), over `host`'s record. `check` is the
 *  testimony slot's check (a refusal refuses the promotion); `project`, run after the commit in the same transaction,
 *  re-derives the promoted bundle's sight row and runs the slot's projection, whose refusal throws so the whole promotion
 *  rolls back, and answers `{testimony}` on the testimony path only, else null. The keys promotion's own answer carries
 *  (`bundleId`, `bundleSha`, `rowVersion`, `owner`, `visibility`) are promotion's, so the step adds none of them. */
export function promotionStep(host) {
  return {
    check: (c) => provenanceOf(host).testimonySlot().check(c),
    project: (c) => {
      const { bundleId } = stepContext(c);
      /* D-497: the SIGHT INDEX follows the bundle row that decides whether this is a project at all. One call covers all
         three arrivals: a project created here gains a row carrying the derivation's default, a bundle promoted into a
         project gains one, and a bundle promoted out of `project` loses its row. It is a derivation, so a revision that
         changes neither recomputes the same row. */
      membershipOf(host).reindexProjectSight(bundleId);
      /* MK-1 / D-184: the testimony path's own writes (extraction's index, content's row, observation-log's look), in
         this transaction, so an authored record never exists without the content its readers expect. A refusal throws to
         roll the whole promotion back rather than return a half. */
      const slot = provenanceOf(host).testimonySlot().project(c);
      if (slot && slot.ok === false)
        throw new Error(`MK-1: the observation's testimony work was refused: ${slot.code || slot.reason}`);
      /* MK-1: present only on the testimony path, so no other caller's answer gains a key. */
      return slot && slot.testimony ? { testimony: slot.testimony } : null;
    },
  };
}

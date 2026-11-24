/* plane R35, R74 (K2585; K4389; K4435): THE GETTERS THE DOOR'S OWNER MAP IS HANDED. `control-plane`'s `controlPlaneOwnerOps` serves the
   ops of the owners that export a service and no arm (its R71, R72, R110, R117, R118), each over the owner's one instance on this
   storage, asked only when its op is served. The list is made here once, so the route map and the tests' model of it read the same
   getters and an owner added to it stales neither (K3268). */
import { aiUseOf } from "../ai-use/index.mjs";
import { aiRunsOf } from "../ai-runs/index.mjs";
import { caseAccountOf } from "../case-account/index.mjs";
import { reviewOf } from "../review/index.mjs";
import { legEarningOf } from "../leg-earning/index.mjs";
import { captureOf } from "../capture/index.mjs";
import { stepsOf } from "../steps/index.mjs";
import { investigationOf } from "../investigation/index.mjs";
import { questionExplorerOf } from "../question-explorer/index.mjs";
import { actionClocksOf } from "../action-clocks/index.mjs";
import { filingsOf } from "../filings/index.mjs";
import { actionPlansOf } from "../action-plans/index.mjs";
import { extractionOf } from "../extraction/index.mjs";
import { projectRosterOf } from "../project-roster/index.mjs";

/** The getters of `ctx`'s one instances, for `controlPlaneOwnerOps(of, url, body)`. */
export const ownerGettersOf = (ctx, env) => ({
  aiUse: () => aiUseOf(ctx), aiRuns: () => aiRunsOf(ctx, env),
  /* (T42; N839; K2656) the plane's one case-account instance (R38), for control-plane R71's account ops; never case-authoring's pass-through */
  caseAccount: () => caseAccountOf(ctx),
  review: () => reviewOf(ctx), legEarning: () => legEarningOf(ctx), capture: () => captureOf(ctx),
  steps: () => stepsOf(ctx), investigation: () => investigationOf(ctx), questionExplorer: () => questionExplorerOf(ctx),
  /* (T47; K3150; control-plane R71) `clockpropose`, served through action-clocks' one instance */
  actionClocks: () => actionClocksOf(ctx),
  /* (T51; K4098; control-plane R110) `approvedunsent` (filings R53) and `checkpointsdue` (action-plans R17) */
  filings: () => filingsOf(ctx), actionPlans: () => actionPlansOf(ctx),
  /* (T51 fix round 3; K4389; control-plane R117, R118; R74) `readHeld` (extraction R80) and `projectList`'s `sharedDraftsOf`
     (project-roster R42), each asked only when its op is served */
  extraction: () => extractionOf(ctx), projectRoster: () => projectRosterOf(ctx),
});

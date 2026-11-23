/* control-plane (fix round 9; K4837; R-SEAM, R-ONE, R-CLOCK, R-NOLOAD): THE ROUND'S CASES THROUGH THE REAL PLANE, in ONE file. Sections 1-3 and 9 are `r9-seam-reading.mjs`, 4-8 `r9-seam-documents.mjs`,
   14-15 `r9-seam-limits.mjs` (job 38); 10-13 `r9-seam-parts.mjs` and 16-17 `r9-seam-safety.mjs` and 18 `r9-seam-hostile.mjs` (job 43). Heavy: run alone, five runs, and the 40 s scanner case on one core too (R-NOLOAD). */
import "../../sandbox.mjs";
import "../../../src/store-assembly/register.mjs";   /* the assembly registers every owner's declarations first (R81); the kit then lets that one refusal pass, and the §14b test builds a store (store-assembly's registrar) in this process */
import { after } from "node:test";
import { makeKit } from "./r8-kit.mjs";
import { sections as reading } from "./r9-seam-reading.mjs";
import { sections as documents } from "./r9-seam-documents.mjs";
import { sections as limits } from "./r9-seam-limits.mjs";
import { sections as parts } from "./r9-seam-parts.mjs";
import { sections as safety } from "./r9-seam-safety.mjs";
import { sections as hostile } from "./r9-seam-hostile.mjs";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

/* §18 boots the pdf-worker from its bundle, which is never committed (ARCH, "Committed built files"): built here from source,
   by the member's own build script, before any section runs. */
execFileSync(process.execPath, [fileURLToPath(new URL("../../../../pdf-worker/scripts/build.mjs", import.meta.url))], { stdio: "ignore" });

const kit = makeKit({ tag: "r9seam" });
const counting = makeKit({ tag: "r9seamc", counting: true });
after(() => { kit.mf.dispose(); counting.mf.dispose(); });
reading(kit, counting);
documents(kit, counting);
limits(kit, counting);
parts(kit, counting);
safety(kit, counting);
hostile(kit, counting);

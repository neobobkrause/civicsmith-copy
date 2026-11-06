import { localize } from "../setup-words/index.mjs";
/* investigation's ops map (requirements: `build/requirements/investigation.md` R25; T51, K4168). The module's other acts and
 * reads are routed by `control-plane/owner-ops.mjs`; the op added here is served from its owner, and `plane` spreads this
 * map. A field comes from the body, else the address; the actor `by` is the control plane's stamp in the query, never the
 * body's, and the founder's `admin` is handed as its positional identity, `member:admin`, as the other acts' arms hand it.
 * Which credential reaches the op is `op-declarations`' and `control-plane`'s, never this map's. */

/** R25: the op names this module's arms answer. */
export const INVESTIGATION_OP_NAMES = Object.freeze(["projectclose"]);

/** R25: the module's route arms, keyed by op name, each a function of no arguments answering what its service answers. */
export function investigationOps(investigation, url, body) {
  const q = (k) => url.searchParams.get(k);
  const b = body && typeof body === "object" && !Array.isArray(body) ? body : {};
  const f = (k) => (b[k] !== undefined ? b[k] : q(k));
  const by = () => (q("by") === "admin" ? "member:admin" : q("by") ?? null);
  return {
    /* R24 (C65): a project closed at its owner's choice, whether or not its work has gone quiet. */
    projectclose: () => investigation.projectClose({ project: f("project"), reason: f("reason"),
                                                     ...(f("note") === null || f("note") === undefined ? {} : { note: f("note") }), by: by() }),
  };
}

/* R25 (T51; K4168; op-declarations R80, op-grades R49): the op this module serves that a screen sends or this tranche adds,
   declared by its owner beside the ops map: a new op, so no hand row holds it; its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  projectclose: { classes: ["admin","member"], machineClasses: [], mutating: true, stamps: ["viewer","by"], needs: "contribute", weight: "reasoned", refusal: "CLOSE_BAD_REASON",
    description: localize("investigation.declared.projectclose", "project-directed: an owner closes a project now, whether or not its work has gone quiet, with a reason (resolved, superseded or abandoned) and an optional note, keyed by project; the gaps read at the close are kept beside it"),
    fields: { accepts: ["project","reason","note"], requires: ["project","reason"] } },
});

/* registers' ops map and declarations (requirements: R38, R40, R27, R36; N1259-e §1). One route arm per op, as entries of the plane's one
 * op map, which the control plane appends in one place and stamps. A read takes `viewer` from the URL (the control plane's stamp, never the
 * body's); an act takes its fields from the body, where the control plane stamps `author` (or `by`). Which credential reaches each op is
 * `op-declarations`' and `control-plane`'s, never this map's. The map holds no op that fetches by name, exports rows or sends them (R27, R36). */
import { localize } from "../setup-words/index.mjs";
import { refusal } from "./core.mjs";

/* no op is a machine credential's: the module refuses a machine author itself, and op-declarations is told so (`machineClasses: []`) */
const MEMBER = ["admin", "member"];
const ADMIN = ["admin", "member"];

/* op: [arm kind, classes, mutating, weight, ms, accepts, requires, description] */
const TABLE = {
  registerlist:         ["read", MEMBER, false, "read", 500, [], [], localize("registers.declared.registerlist", "lists the registers known, the team's own and its proposals, each figure with its basis")],
  registerfilter:       ["read", MEMBER, false, "read", 1000, ["register", "project"], ["register"], localize("registers.declared.registerfilter", "the filter prefilled from a project, said so; saved nowhere")],
  registerimportstatus: ["read", MEMBER, false, "read", 500, ["import"], ["import"], localize("registers.declared.registerimportstatus", "an import's state, pieces and progress")],
  registerrow:          ["read", MEMBER, false, "read", 500, ["import", "row_key", "src_row"], ["import", ["row_key", "src_row"]], localize("registers.declared.registerrow", "one row of an import, its kept cells and their origin")],
  registerproposals:    ["read", ADMIN, false, "read", 500, [], [], localize("registers.declared.registerproposals", "the held proposals, for an administrator to send on")],
  registerdelta:        ["read", MEMBER, false, "read", 2000, ["register", "filter", "scope", "project", "budget_ms", "holes"], ["register"], localize("registers.declared.registerdelta", "what an import would add, counted or estimated, before anything is brought in")],
  registersearch:       ["read", MEMBER, false, "read", 1500, ["scope", "name", "organization", "amount", "date", "filer_id", "form", "limit", "after", "budget_ms"], [], localize("registers.declared.registersearch", "rows by person, organization, amount and date, from the held rows only; never logged")],
  registercompare:      ["read", MEMBER, false, "read", 1500, ["import_a", "import_b", "limit", "after", "budget_ms"], ["import_a", "import_b"], localize("registers.declared.registercompare", "rows added, removed or changed between two imports of one register, never a finding")],
  registerpropose:      ["act", MEMBER, true, "reversible", 500, ["name", "url", "publisher", "note", "withdraw", "id"], ["name", "url", "publisher"], localize("registers.declared.registerpropose", "a team proposes a register not on the list; nothing is brought in")],
  registerfileimport:   ["act", MEMBER, true, "reversible", 1000, ["register", "filter", "scope", "project", "holes", "pieces", "file"], ["register", "scope"], localize("registers.declared.registerfileimport", "queues a background import of a register for a project; fetches nothing itself")],
  registerpreread:      ["act", ADMIN, true, "reversible", 1000, ["register", "filter", "holes", "pieces", "file"], ["register"], localize("registers.declared.registerpreread", "queues a team pre-read of a register, an administrator's act")],
  registerimportset:    ["act", MEMBER, true, "reversible", 500, ["import", "action"], ["import", "action"], localize("registers.declared.registerimportset", "pauses, resumes or stops an import")],
  registerrowcite:      ["act", MEMBER, true, "reversible", 1000, ["import", "row_key"], ["import", "row_key"], localize("registers.declared.registerrowcite", "cites a row as a labelled extract")],
  registerinterest:     ["act", MEMBER, true, "reversible", 500, ["register", "project", "filter", "watch", "forget", "interest"], ["register", "project"], localize("registers.declared.registerinterest", "a project states the filter its watching looks for, or forgets it (forget: true), its history kept")],
  registerinterests:    ["read", MEMBER, false, "read", 500, ["project", "register"], ["project"], localize("registers.declared.registerinterests", "a project's stated interests and their history")],
  registerrefresh:      ["act", MEMBER, true, "reversible", 1000, ["interest", "import", "force"], [["interest", "import"]], localize("registers.declared.registerrefresh", "a member's own re-check of an interest or an import")],
  registerwatch:        ["act", MEMBER, true, "reversible", 1000, ["interest"], ["interest"], localize("registers.declared.registerwatch", "switches a stated interest's watch on, when its filter is by a number")],
  registerwatchstop:    ["act", MEMBER, true, "reversible", 500, ["interest"], ["interest"], localize("registers.declared.registerwatchstop", "switches a stated interest's watch off; the interest and its history stay")],
  registerdefine:       ["act", MEMBER, true, "reasoned", 1000, ["proposal", "key", "definition"], ["definition"], localize("registers.declared.registerdefine", "completes a proposal into the team's own register definition")],
  rowexpunge:           ["act", ADMIN, true, "reasoned", 1000, ["register", "row_key", "ground", "reason", "order", "demandKind"], ["register", "row_key", "ground", "reason"], localize("registers.declared.rowexpunge", "removes a row, leaving a tombstone; irreversible")],
  registerofficers:     ["read", MEMBER, false, "read", 2000, ["query"], ["query"], localize("registers.declared.registerofficers", "looks up a company by its number in the state's own service, on the team's own key")],
};

/** R38: every op the module serves, declared, each held true by calling it as the door does. */
export const DECLARED_OPS = Object.freeze(Object.fromEntries(Object.entries(TABLE).map(([op, [, classes, mutating, weight, ms, accepts, requires, description]]) => [op, {
  classes: [...classes], machineClasses: [], mutating, weight, stamps: ["viewer", "by"], needs: "contribute",
  description, budget_ms: ms,
  fields: { accepts: [...accepts], requires: requires.map((r) => (Array.isArray(r) ? [...r] : r)) } }])));

export const REGISTERS_OPS = Object.freeze(Object.keys(TABLE));

const asList = (v) => (Array.isArray(v) ? v : [v]);

/** The route arms, each a function of no arguments answering what its service answers. */
export function registersOps(registers, url, body) {
  const b = body && typeof body === "object" ? body : {};
  const q = (k) => { const v = url.searchParams.get(k); return v === null ? undefined : v; };
  const read = (name) => { const v = b[name] !== undefined ? b[name] : q(name); if (typeof v !== "string") return v; try { const j = JSON.parse(v); return j !== null && typeof j === "object" ? j : v; } catch { return v; } };
  const num = (name) => { const v = read(name); return typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v)) ? Number(v) : v; };
  const who = () => ({ author: b.author ?? b.by ?? q("author") ?? q("by"), viewer: q("viewer") ?? b.viewer });
  const field = (name) => (["limit", "budget_ms", "src_row", "id"].includes(name) ? num(name) : ["force", "watch", "withdraw", "forget"].includes(name) ? (read(name) === true || read(name) === "true" ? true : read(name) === "false" ? false : undefined) : read(name));
  const picked = (op) => Object.fromEntries(DECLARED_OPS[op].fields.accepts.map((f) => [f, field(f)]).filter(([, v]) => v !== undefined));
  const missing = (op) => {
    for (const r of DECLARED_OPS[op].fields.requires) {
      const alts = asList(r);
      if (!alts.some((f) => { const v = field(f); return v !== undefined && v !== null && v !== ""; }))
        return refusal("MISSING_FIELD", localize("registers.refusal.MISSING_FIELD", "this needs {field}", { field: alts.join(" or ") }), { field: alts[0] });
    }
    return null;
  };
  const arm = (op, run) => async () => missing(op) ?? run(picked(op));
  return {
    registerlist: arm("registerlist", () => registers.registerList({ viewer: who().viewer })),
    registerfilter: arm("registerfilter", (a) => registers.registerFilter({ ...a, viewer: who().viewer })),
    registerimportstatus: arm("registerimportstatus", (a) => registers.importStatus({ import: a.import, viewer: who().viewer })),
    registerrow: arm("registerrow", (a) => registers.rowOf({ import: a.import, row_key: a.row_key, src_row: a.src_row, viewer: who().viewer })),
    registerproposals: arm("registerproposals", () => registers.proposalsForUpstream({ viewer: who().viewer })),
    registerdelta: arm("registerdelta", (a) => registers.registerDelta({ ...a, viewer: who().viewer })),
    registersearch: arm("registersearch", (a) => registers.searchRows({ ...a, viewer: who().viewer })),
    registercompare: arm("registercompare", (a) => registers.compare({ ...a, viewer: who().viewer })),
    registerpropose: arm("registerpropose", (a) => registers.registerPropose({ ...a, ...who() })),
    registerfileimport: arm("registerfileimport", (a) => registers.importStart({ ...a, ...who() })),
    registerpreread: arm("registerpreread", (a) => registers.importStart({ ...a, scope: "team", ...who() })),
    registerimportset: arm("registerimportset", (a) => registers.importSet({ ...a, ...who() })),
    registerrowcite: arm("registerrowcite", (a) => registers.citeRow({ ...a, ...who() })),
    registerinterest: arm("registerinterest", (a) => (a.forget === true ? registers.interestForget({ interest: a.interest, project: a.project, register: a.register, ...who() })
      : registers.interestSet({ ...a, ...who() }))),
    registerinterests: arm("registerinterests", (a) => registers.interestOf({ project: a.project, register: a.register, viewer: who().viewer })),
    registerrefresh: arm("registerrefresh", (a) => registers.registerRefresh({ ...a, ...who() })),
    registerwatch: arm("registerwatch", (a) => registers.watchSet({ interest: a.interest, watch: true, ...who() })),
    registerwatchstop: arm("registerwatchstop", (a) => registers.watchSet({ interest: a.interest, watch: false, ...who() })),
    registerdefine: arm("registerdefine", (a) => registers.registerDefine({ ...a, ...who() })),
    rowexpunge: arm("rowexpunge", (a) => registers.rowExpunge({ ...a, ...who() })),
    registerofficers: arm("registerofficers", (a) => registers.officersLookup({ query: a.query, ...who() })),
  };
}

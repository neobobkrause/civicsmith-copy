/* wizard-scripts: the front door's routes and the assistant's proposal of one (requirements:
 * `build/requirements/wizard-scripts.md`, R23, R28; DEC-129 (7), (2); N820, N821; D52, D53; K2418). Pure: nothing here
 * writes, calls a model or throws. The door's words are the design stream's (`FRONT_DOORS`, N821) and its screens the
 * UX stream's: no route here carries words, a place or a law. */

/** R23 (D52, D53): the six places a first message leads to, by the member's choice: a new project (a member's own
 *  matter with a public body goes to a hidden project of hers, `project-roster` creation with visibility `hidden`); an
 *  existing question or project (found at the door, R23's `matches`); a lead, optionally watched (`following`), which
 *  may become a project later; a step for understanding (`steps` R1, placed in the group or a project); an action; or
 *  "not Civicsmith's", with a pointer (profile data, handed in at registration, never named here). */
export const START_ROUTES = Object.freeze([
  Object.freeze({ route: "project", own_matter: Object.freeze({ visibility: "hidden" }) }),
  Object.freeze({ route: "existing", finds: Object.freeze(["question", "project"]) }),
  Object.freeze({ route: "lead", watch: "optional", becomes: Object.freeze(["project"]) }),
  Object.freeze({ route: "step", placed: Object.freeze(["group", "project"]) }),
  Object.freeze({ route: "action" }),
  Object.freeze({ route: "elsewhere" }),
]);
/** R23: the kinds of existing work the door shows as matching a message. */
export const MATCH_KINDS = Object.freeze(["question", "project", "step"]);
/** R23: the most matches the door shows. */
export const MATCHES_MAX = 20;
/** R28: the most parts of one message read. */
export const PARTS_MAX = 50;

import { word } from "../setup-words/index.mjs";
import { rowOf } from "./checks.mjs";

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const line = (v, max = 200) => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

/** R23: existing work as the registered finder answered it, each `{kind, id, name}` of a kind the door shows, at most
 *  `MATCHES_MAX`, each id once; anything else dropped. */
export function matchesOf(found) {
  const out = [], seen = new Set();
  for (const m of Array.isArray(found) ? found : []) {
    if (!isObj(m) || !MATCH_KINDS.includes(m.kind) || !line(m.id) || seen.has(`${m.kind}:${line(m.id)}`)) continue;
    seen.add(`${m.kind}:${line(m.id)}`);
    out.push({ kind: m.kind, id: line(m.id), name: line(m.name) });
    if (out.length === MATCHES_MAX) break;
  }
  return out;
}

/** R28 (pure; D52 detail): the assistant's proposal for a message it reads as tangled, from its reading `parts`, each
 *  `{text, subject, rumour}`: every rumour part proposed as a lead, never as a question (so never as one aimed at a
 *  person); the other parts grouped by subject (compared without case or surrounding space), one project for each
 *  subject with one question per part, so parts that share a subject are one project with several questions and parts
 *  that do not are separate projects (a part with no subject its own). Parts are named by their place in `parts`, from
 *  0. A proposal, labelled the machine's: the member decides; it writes nothing. */
export function proposeStart({ parts = [] } = {}) {
  const list = (Array.isArray(parts) ? parts : []).slice(0, PARTS_MAX);
  const projects = new Map(), leads = [];
  list.forEach((p, i) => {
    if (!isObj(p)) return;
    if (p.rumour === true) { leads.push({ route: "lead", part: i, watch: false }); return; }
    const subject = line(p.subject);
    const key = subject ? subject.toLowerCase().replace(/\s+/g, " ") : `\u0000${i}`;
    if (!projects.has(key)) projects.set(key, { route: "project", subject, questions: [] });
    projects.get(key).questions.push(i);
  });
  return { ok: true, proposals: [...projects.values(), ...leads], label: { kind: "machine" }, decides: "member" };
}

/** R28 (pure; K2574): the check the door runs on any proposal the assistant makes for a message, against its own reading
 *  `parts`: `{ok: true}`, or `START_RUMOUR_AS_QUESTION` naming the first rumour part a `project` proposal holds as one
 *  of its questions (a rumour is proposed as a lead, never as a question aimed at a person). A proposal that is not one
 *  answers `{ok: true}` with nothing to check; one that cannot be read through is refused (fail closed). Writes nothing;
 *  never throws. */
export function checkStartProposal({ proposal = null, parts = [] } = {}) {
  try {
    const list = Array.isArray(parts) ? parts : [];
    const proposals = isObj(proposal) && Array.isArray(proposal.proposals) ? proposal.proposals : Array.isArray(proposal) ? proposal : [];
    for (const p of proposals) {
      if (!isObj(p) || p.route !== "project" || !Array.isArray(p.questions)) continue;
      const i = p.questions.find((q) => Number.isInteger(q) && isObj(list[q]) && list[q].rumour === true);
      /* DEC-49 REGION is-start-rumour */
      if (i !== undefined) return rumourRefusal(i);
      /* END DEC-49 REGION is-start-rumour */
    }
    return { ok: true };
  } catch { return rumourRefusal(null); }
}
function rumourRefusal(part) {
  const row = rowOf("START_RUMOUR_AS_QUESTION");
  return { ok: false, reason: "START_RUMOUR_AS_QUESTION", code: "START_RUMOUR_AS_QUESTION", check: row.check, translation: row.translation,
           part, detail: word("wizard-scripts.refusal.rumor_as_lead") };
}

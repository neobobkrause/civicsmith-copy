/* screens-ai (T53; N1220; DEC-420, DEC-465, DEC-466, DEC-468, DEC-469, DEC-471, DEC-475, DEC-476): the AI screens of the beta, as
   screens of the member interface. Pure: every read and act is an op the plane serves, called through `interface-shell`'s screen
   contract (its R21) and kit; nothing here reads a table, writes, or keeps anything in the browser.

   `SCREENS`: per screen `{id, reads, render, acts, words, parts}` as interface-shell R21 states them. `words` lists the keys a screen
   draws (R12: this module holds no English; every key is a row of `setup-words`). `parts` holds `screens-settings`' shared render of an
   account's use over time, `aiUsageBars` (its R26), handed as `view.parts` (R15): this module holds no render of its own for it.

   Built today: `aiproviders`, `aimine`, `aiproject`. `aiconnect`, `aimoments`, `aitest` and `airesults` wait on ops their owners do not
   serve yet; `docs/requirements-notes/screens-ai.md` names each. */
import { aiUsageBars, PANEL_KEYS } from "../screens-settings/panel.mjs";
import { WORD_ROWS } from "../setup-words/index.mjs";
import { aiproviders } from "./aiproviders.mjs";
import { aimine } from "./aimine.mjs";
import { aiproject } from "./aiproject.mjs";

const KEYS = WORD_ROWS.map((r) => r[0]);
const own = (...prefixes) => KEYS.filter((k) => prefixes.some((p) => k.startsWith(p)));
const STATES = ["state.loading", "state.empty", "state.failed"];
/** The words of the seven checks, by the design's names for P1 to P7. */
const CHECKS = own("screen.aichecks.");
/** The drawer of an account's use over time (R15): its box and `aiUsageBars`' own words. */
const DRAWER = ["ai.usage.bars", ...PANEL_KEYS];

/** The keys each screen draws (interface-shell R5, R21; R12). */
export const WORDS = Object.freeze({
  aiproviders: [...STATES, "screen.aiproviders.name", ...own("screen.aiproviders."), ...CHECKS, ...DRAWER, "screen.aimine.use.nomoney", "shell.field.needed"],
  aimine: [...STATES, "screen.aimine.name", ...own("screen.aimine."), ...CHECKS, ...DRAWER,
    "screen.aiproviders.use.up", "screen.aiproviders.use.down", "screen.aiproviders.use.switchon", "screen.aiproviders.use.switchoff",
    "screen.aiproviders.status.on", "screen.aiproviders.status.off"],
  aiproject: [...STATES, "screen.aiproject.name", ...own("screen.aiproject."), ...CHECKS, ...DRAWER,
    "screen.project.notjoined", "projects.request.asked", "shell.unavailable.notyours.title", "shell.unavailable.notyours.says",
    "act.projectrequest.label.project", "act.projectjoin.label.project", "act.projectrequest.does", "act.projectjoin.does",
    "screen.aiproviders.use.switchoff", "screen.aiproviders.bymember.head", "screen.aiproviders.bymember.th.member", "screen.aiproviders.bymember.th.runs",
    "screen.aiproviders.bud.th.cost", "screen.aimine.use.nomoney", "shell.field.needed"],
});

const PARTS = Object.freeze({ aiUsageBars });
const freeze = (s) => Object.freeze({
  ...s,
  acts: Object.freeze(s.acts.map((a) => Object.freeze({ ...a }))),
  words: Object.freeze([...new Set(WORDS[s.id])]),
  parts: PARTS,
});

export const SCREENS = Object.freeze([aiproviders, aimine, aiproject].map(freeze));

/* screens-daily's tests' helper over interface-shell's harness (B7, K3007): the real page `interfacePage(SCREENS)` serves,
   run over the shell's document stand-in with a scripted plane, so every screen is drawn by the shell's own kit and every
   act runs through its friction, gate, refusals and re-reads. */
import { SCREENS } from "../../../src/screens-daily/index.mjs";
import { wordsOf } from "../../../src/interface-shell/index.mjs";
import { boot, ok, refused, refusedIn, settle, textNodes, MEMBER } from "../interface-shell/harness.mjs";
import { word, hasWord } from "../../../src/setup-words/index.mjs";

export { SCREENS, ok, refused, refusedIn, settle, textNodes, MEMBER, word, hasWord };
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
/** A day as the page draws it (R6 of interface-shell): by the date words, from an ISO day. */
export const dmy = (iso) => word("date.daymonthyear", { day: String(Number(iso.slice(8, 10))), month: word("date.month." + MONTHS[Number(iso.slice(5, 7)) - 1]), year: iso.slice(0, 4) });
/** True when each of `parts` is found in `hay`, one after the other (a screen's words read in their order). */
export const inOrder = (hay, parts) => { let at = 0; for (const x of parts) { const i = hay.indexOf(x, at); if (i < 0) return false; at = i + x.length; } return true; };
/** `casedrafts` for many projects in one read (review R19): `single(id)` is the answer the single read gives for that project; the batch holds each under its id. */
export const batched = (single) => (req) => ok({ ok: true, kind: "review-drafts-batch", count: String(req.query.projects || "").split(",").filter(Boolean).length, lists: Object.fromEntries(String(req.query.projects || "").split(",").filter(Boolean).map((id) => [id, single(id)])) });
/** The seven screens and a bare stand-in for each other screen named, so a reference to it is a link (the screen's page is another module's). */
export const withScreens = (...ids) => [...SCREENS, ...ids.map((id) => ({ id, reads: () => ({}), acts: [], render: () => "", words: [] }))];
export const screen = (id) => SCREENS.find((s) => s.id === id);

/** Opens `path` (`/app/<screen>[/<subject>]`) with the plane answering `plane`. */
export const open = (path, plane = {}, o = {}) => boot({ screens: SCREENS, plane, path, ...o });
/** The main area (the screen's own drawing, under its path). */
export const main = (p) => p.doc.getElementById("cs-main");
/** The text a member reads in the main area, its spaces collapsed. */
export const text = (p, el = main(p)) => (el ? el.textContent : "").replace(/\s+/g, " ").trim();
/** The acts drawn in the main area, each `[op, dataset]`, in reading order. */
export const acts = (p) => main(p).querySelectorAll("button[data-act]").map((b) => [b.getAttribute("data-act"), b.dataset]);
export const ops = (p) => acts(p).map(([op]) => op);
export const button = (p, op, nth = 0) => main(p).querySelectorAll(`button[data-act="${op}"]`)[nth] || null;
/** Fills fields by id (a checkbox by `true`/`false`). */
export function fill(p, values) {
  for (const [id, v] of Object.entries(values)) {
    const el = p.doc.getElementById(id);
    if (!el) throw new Error(`no field ${id}`);
    if (el.type === "checkbox" || el.type === "radio") el.checked = !!v; else el.value = v;
  }
}
/** Presses `op`'s `nth` button, answering a reasoned act's reason field with `reason` when the shell asks one, and a terminal act's dialog with `confirm`. */
export async function press(p, op, { nth = 0, values = {}, reason, confirm = false } = {}) {
  fill(p, values);
  const b = button(p, op, nth);
  if (!b) throw new Error(`no ${op} button`);
  await p.click(b);
  if (reason !== undefined) {
    const ai = b.getAttribute("data-ai");
    const ta = p.doc.getElementById("cs-reason-" + ai.replace(":", "-"));
    if (ta) { ta.value = reason; await p.click(p.root().querySelector(`[data-shell="reason-send"][data-for="${ai}"]`)); }
  }
  if (confirm) await p.click(p.root().querySelector(`[data-shell="confirm"][data-for="${b.getAttribute("data-ai")}"]`));
  await settle();
  return b;
}
/** The words beside an act after it was pressed (its refusal, R13). */
export const beside = (p, b) => text(p, p.root().querySelector(`[data-slot="${b.getAttribute("data-ai")}"]`));
/** The last request for `op`. */
export const last = (p, op) => p.byOp(op).at(-1);

/* R5: a drawn text node is a word (filled), a piece of one between its placeholders, or the record's own data. */
export function wordChecker(data = []) {
  const pats = [], pieces = new Set();
  for (const [, en] of wordsOf(SCREENS)) {
    const parts = en.split(/\{\w+\}/);
    if (!parts.some((x) => x.trim())) continue; // a word all placeholders draws only its fills: the record's data
    pats.push(new RegExp("^" + parts.map((x) => x.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[\\s\\S]*") + "$"));
    for (const x of parts) if (x.trim()) pieces.add(x.trim());
  }
  return (t) => data.includes(t) || pieces.has(t) || pats.some((re) => re.test(t)) || [...pieces].some((x) => x.length > 3 && x.includes(t));
}

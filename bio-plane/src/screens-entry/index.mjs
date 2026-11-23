/* screens-entry (T47-86; N999, N1002, N1005; DEC-201 (1), (2), (5), (6), (12); DEC-202 (1)–(4); DEC-205 (5); K3052,
   K3053, K3060 D2, D4, D7, K3061 D3): the screens drawn without a member session, the way in. In the public frame
   `front` (the group's page, with members' sign-in), `tour`, `forgot` and `reset`; in the setup frame `setup` (the
   founder's claim and the group's first settings) and `join` (an invitation or the group's join link). Pure: every read
   and act is an op the plane serves, through `interface-shell`'s screen contract (its R21) and kit; nothing here reads
   a table, writes, or keeps anything in the browser (R8).

   `SCREENS`: per screen `{id, reads, render, acts, words}` as interface-shell R21 states them, every function
   self-contained. `words` lists the keys a screen reads (R21: keys only, no English; `words.mjs`). `SCREEN_WORDS`, the
   screen contract's own rows (interface-shell R5), is empty: this module holds no member-facing English. */
import { front } from "./front.mjs";
import { tour } from "./tour.mjs";
import { forgot } from "./forgot.mjs";
import { reset } from "./reset.mjs";
import { setup } from "./setup.mjs";
import { join } from "./join.mjs";
import { READS } from "./words.mjs";

/**
 * One act a screen offers: an op the plane serves, sent through the shell (interface-shell R21, R11).
 * @typedef {Object} EntryAct
 * @property {string} op the op's name, one `op-declarations` holds and the registry lists for the screen
 * @property {string[]} [rereads] the screen's reads asked again once the act answers
 * @property {string} [reasonField] the field whose words are sent as the act's reason (interface-shell R11, DEC-88)
 * @property {Function} send (view, el, cs) answers `{body}` to send, or `{refuse: <key>}` to send nothing
 * @property {Function} [done] (view, answer, cs) after the plane answers
 * @property {Object<string, Function>} [refusals] per refusal code, (refusal, cs) answers the words drawn
 * @bound send's body holds every password, code and link this module sends; none goes in an address (R8)
 */
/**
 * One screen as interface-shell R21's screen contract states it; every function self-contained.
 * @typedef {Object} EntryScreen
 * @property {string} id the registry's screen id: front, tour, forgot, reset, setup or join
 * @property {Function} reads (view) answers the reads, by name: `{op, body?, empty?}`
 * @property {Function} render (cs, view) answers the screen's HTML, every sentence drawn by key
 * @property {Function} [closed] (cs, view) when the screen is left
 * @property {EntryAct[]} acts the screen's acts
 * @property {string[]} words every key the screen reads (R21, R24), no English
 * @bound words: keys only; every one held by setup-words' hasWord
 */

/** interface-shell R5's own rows: none (R21).
 * @type {string[]} frozen in place
 * @bound empty: this module holds no member-facing English
 */
export const SCREEN_WORDS = [];
Object.freeze(SCREEN_WORDS);

/** @type {(s: any) => EntryScreen} builds an EntryScreen, frozen */
const freeze = (s) => Object.freeze({
  ...s,
  acts: Object.freeze(s.acts.map((a) => Object.freeze({ ...a }))),
  words: Object.freeze([...new Set(READS[s.id])]),
});

/** The six screens, in this order: front, tour, forgot, reset, setup, join.
 * @type {EntryScreen[]} frozen in place, each screen and act frozen too
 */
export const SCREENS = [front, tour, forgot, reset, setup, join].map(freeze);
Object.freeze(SCREENS);

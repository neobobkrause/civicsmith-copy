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

/** interface-shell R5's own rows: none (R21). */
export const SCREEN_WORDS = Object.freeze([]);

const freeze = (s) => Object.freeze({
  ...s,
  acts: Object.freeze(s.acts.map((a) => Object.freeze({ ...a }))),
  words: Object.freeze([...new Set(READS[s.id])]),
});

export const SCREENS = Object.freeze([front, tour, forgot, reset, setup, join].map(freeze));

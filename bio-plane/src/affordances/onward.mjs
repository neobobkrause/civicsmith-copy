/* affordances — R73 (T53; N1260; DEC-410 menus; DEC-409 "any other dimension"; DEC-447 (1)-(4)): WHAT "FOLLOW FROM HERE" OFFERS ON EACH
 * KIND OF ITEM. A frozen table from item kind to an ordered list of entries `{entry, dimension, op, also?}`: `entry` is the key suffix of
 * the screen's word `screen.follow.<entry>` (the screen draws it; this module holds no English), `dimension` one of R72's seven or
 * `registers` or `connections`, `op` the op that answers it, and `also` a second op the screen sends (only `who.docs`). An item kind not
 * named here (an office, an ordinance, a contract, a place, an inquiry: any other record id the explorer accepts) is offered `conn` only
 * (`onwardFor`). Pure; writes nothing (R22). */

const e = (entry, dimension, op, also) => Object.freeze(also ? { entry, dimension, op, also } : { entry, dimension, op });

/* the connections entry every item kind ends with */
const CONN = e("conn", "connections", "explore");

/* a person's and an organization's menu (DEC-447 (2): `who.money` is payments made or received, donations apart) */
const WHO = Object.freeze([
  e("who.money", "money", "followfrom"),
  e("who.donations", "donations", "followfrom"),
  e("who.offices", "organizations", "followfrom"),
  e("who.laws", "law", "followfrom"),
  e("who.events", "events", "followfrom"),
  e("who.docs", "documents", "followfrom", "search"),
  e("who.rows", "registers", "registersearch"),
  CONN,
]);

/* a payment's and a donation's menu (an `MNY-` fact) */
const MONEY = Object.freeze([
  e("money.who", "people", "followfrom"),
  e("money.more", "money", "followfrom"),
  e("money.events", "events", "followfrom"),
  e("money.docs", "documents", "search"),
  e("rows.match", "registers", "registersearch"),
  CONN,
]);

/** R73: item kind to its ordered entries. */
export const DIMENSION_ONWARD = Object.freeze({
  person: WHO,
  organization: WHO,
  /* DEC-447 (4): a fund is the organization menu without its offices, laws and donations */
  fund: Object.freeze(WHO.filter((x) => !["who.offices", "who.laws", "who.donations"].includes(x.entry))),
  payment: MONEY,
  donation: MONEY,
  event: Object.freeze([
    e("event.who", "people", "followfrom"),
    e("event.money", "money", "followfrom"),
    e("event.docs", "documents", "search"),
    e("event.rows", "registers", "registersearch"),
    CONN,
  ]),
  document: Object.freeze([
    e("document.who", "people", "followfrom"),
    e("document.money", "money", "followfrom"),
    e("document.events", "events", "followfrom"),
    e("document.laws", "law", "followfrom"),
    e("rows.match", "registers", "registersearch"),
    CONN,
  ]),
});

/** R73: the entries offered for any other record id the explorer accepts: `conn` only. */
export const ONWARD_OTHER = Object.freeze([CONN]);

/** R73: the entries for an item kind; a kind the table does not name is offered `conn` only. Never throws. */
export const onwardFor = (kind) => (typeof kind === "string" && Object.hasOwn(DIMENSION_ONWARD, kind) ? DIMENSION_ONWARD[kind] : ONWARD_OTHER);

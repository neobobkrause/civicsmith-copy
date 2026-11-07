/* following — the register watches of T53 (requirements: `build/requirements/following.md` R37–R46; N1259; K4403 (7),
 * K4405, K5513). Pure helpers, no state: whether two reads of a number's answer differ (R38), and where a followed
 * CourtListener docket's entries are read (R41). What a change means is never said here (R16). */

import { COURT_TYPES, COURT_API_TYPES } from "../../../court-doctypes/index.mjs";

/** R41: the keyed service a docket alert reads, and the purpose its daily check names (`acquisition` R130). */
export const ALERT_SERVICE = "courtlistener";
export const ALERT_PURPOSE = "docket-entries";
export const ALERT_KINDS = Object.freeze(["courtlistener"]);
/** R41: CourtListener's own host, where its docket pages and its entries answer are (`acquisition` R36's service). */
const CL_HOST = "www.courtlistener.com";

/** R38: the counts a change carries, from the register diff's events (`court-doctypes` R10). */
export const NO_COUNTS = Object.freeze({ added: 0, changed: 0, removed: 0, possibly_removed: 0 });
export function countsOf(events) {
  const c = { added: 0, changed: 0, removed: 0, possibly_removed: 0 };
  for (const e of Array.isArray(events) ? events : []) {
    const t = e && e.type;
    if (t === "item_added") c.added++;
    else if (t === "delisted") c.removed++;
    else if (t === "possibly_delisted") c.possibly_removed++;
    else c.changed++;
  }
  return c;
}

const decode = (b) => (b ? new TextDecoder("utf-8", { fatal: false }).decode(b) : "");
const hostOf = (u) => { try { return new URL(u).host.toLowerCase(); } catch { return null; } };
const reOf = (p) => { try { return p && typeof p.re === "string" ? new RegExp(p.re, `${(p.flags || "").replace(/g/g, "")}g`) : null; } catch { return null; } };

/** R38: the profile's system serving an address (its host, and its path when it states one), or null. */
export function systemFor(view, address) {
  let u;
  try { u = new URL(address); } catch { return null; }
  return (Array.isArray(view && view.systems) ? view.systems : []).find((s) => {
    if (!s || !Array.isArray(s.hosts) || !s.hosts.map((h) => String(h).toLowerCase()).includes(u.host.toLowerCase())) return false;
    if (!s.path) return true;
    try { return new RegExp(s.path.re, s.path.flags || "").test(`${u.pathname}${u.search}`); } catch { return false; }
  }) || null;
}

/* R38: the court content type that reads the answer and compares two readings of it, with the readings' diff; null when no
   type reads it, or when a reading failed (the bytes are compared instead). */
function assessed(view, address, before, after, at) {
  const ctx = (text) => ({ text, view, locator: address, at });
  for (const type of [...COURT_TYPES, ...COURT_API_TYPES]) {
    let d;
    try { d = type.detect(ctx(after)); } catch { d = null; }
    if (!d || d.match !== true || typeof type.assess !== "function") continue;
    try {
      const a = type.assess(type.parse(ctx(before)), type.parse(ctx(after)));
      if (!a || (a.meaningful === null && !(Array.isArray(a.events) && a.events.length))) return null;
      return { type: type.key, events: Array.isArray(a.events) ? a.events : [] };
    } catch { return null; }
  }
  return null;
}

/** R38: whether a number's answer read twice changed: `{changed, counts, basis, type?}`. Read by a court type's `assess`
 *  when one reads it (`counts` its rows added, changed, removed); else its bytes compared after the profile's
 *  normalisation for its system (`systems[].volatile`, `jurisdictions` R132), or, for a system that names none,
 *  `volatility_unknown` and changed on any difference (`counts` null). Never throws; says nothing of meaning. */
export function answerChange({ view, address, before, after, at = null }) {
  const a = decode(before), b = decode(after);
  const read = assessed(view, address, a, b, at);
  if (read) return { changed: read.events.length > 0, counts: countsOf(read.events), basis: "assess", type: read.type };
  const sys = systemFor(view, address);
  const vol = sys && Array.isArray(sys.volatile) ? sys.volatile.map(reOf).filter(Boolean) : [];
  if (!vol.length) return { changed: a !== b, counts: null, basis: "volatility_unknown" };
  const norm = (t) => vol.reduce((s, re) => s.replace(re, ""), t);
  return { changed: norm(a) !== norm(b), counts: null, basis: "normalised" };
}

/** R41: whether an address is a CourtListener court docket's page, and its entries answer's address there; else null. */
export function docketEntriesAddress(address) {
  if (hostOf(address) !== CL_HOST) return null;
  let u;
  try { u = new URL(address); } catch { return null; }
  const m = /^\/docket\/(\d+)(?:\/|$)/.exec(u.pathname) || (/^\/api\/rest\/v\d+\/dockets\/(\d+)\/?$/.exec(u.pathname));
  return m ? `https://${CL_HOST}/api/rest/v4/docket-entries/?docket=${m[1]}` : null;
}

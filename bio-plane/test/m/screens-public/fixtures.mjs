/* screens-public's tests' kit: this module's five screens (`published`, `docket-public`, `doorbell`, `review-outside`, and the
 * parts they share) booted alone on interface-shell's served page (its tests' harness, `harness.mjs`), in the public frame with
 * no session, over a scripted plane. Each answer is in its owner's documented shape (public-read's `publishedcase` and
 * `docketpublic`, review's `reviewcopy`, instance-setup's `groupidentity`); a test overrides any op. A sentence is asserted by
 * its key (`word`), never by its English. */
import { word } from "../../../src/setup-words/index.mjs";
/* The plane registers every owner's declared ops before its first read (op-declarations R80, R81), and the harness reads the op
   tables when it loads: store-request's world, the plane as built, makes that registration when it is imported, so it comes
   first and the harness after it. No world is built and no one signs in: these screens are public. */
await import("../store-request/fixtures.mjs");
const { boot, ok } = await import("../interface-shell/harness.mjs");
import { PUBLISHED } from "../../../src/screens-publish/published.mjs";
import { DOCKET_PUBLIC } from "../../../src/screens-publish/docket-public.mjs";
import { DOORBELL } from "../../../src/screens-publish/doorbell.mjs";
import { REVIEW_OUTSIDE } from "../../../src/screens-publish/review-outside.mjs";

export { ok, word };
export const SCREENS = Object.freeze([PUBLISHED, DOCKET_PUBLIC, DOORBELL, REVIEW_OUTSIDE]);

export const GROUP = "Lakeshore Tenants";
export const C = "CASE-2026-0012";
export const SHA = "3b9f" + "0".repeat(56) + "c210";
export const E1 = "c41a" + "2".repeat(56) + "0f57";
export const SECRET = "SENTINEL-GRANT-9f2cb7e1";
/** The end of 20 October 2099 in Los Angeles (PDT, UTC-7). */
export const UNTIL = "2099-10-21T06:59:59Z";
export const ZONE = "America/Los_Angeles";

/** public-read's `publishedcase` answer for one edition: its findings, timeline, people, evidence and corrections; `o` over it. */
export const CASE = (o = {}) => ({ caseId: C, edition: 2, scope: "The Coliseum lease", signed_at: "2026-11-18T10:00:00Z", published_at: "2026-11-19T14:00:00Z",
  editions: [1, 2], manifest_sha: SHA,
  findings: [{ bundle_id: "FND-2026-0031", body: { conclusion: "The 2024 adjustments were made without the council vote the lease requires." },
    strength: [{ axis: "capture", grade: "B" }, { axis: "connection", grade: "C" }],
    standing: { role: "load_bearing", bar: { capture: "B", connection: "C" }, meets: true, short: [], line: "" } }],
  method: { timeline: [{ what: "Council approves amendment 1", at: "2024-01-12" }] },
  people: [{ shown: "The City Administrator", reason: "signed the March 2024 adjustment" }],
  captures: [{ title: "Council minutes, 12 January 2024", sha256: E1 }], corrections: { count: 0, last: null }, ...o });

/** What the case leaves out (`completeness`, public-read R3), with one reader who acknowledged it. */
export const LEFT_OUT = (acknowledgements = [{ recipient: "Prof. N. Iyer", at: "2026-09-15T09:00:00Z", reason: "The gap is fairly stated." }]) => ({
  statement: "This case does not examine the 2019 lease amendment.", statement_by: "mai", author: "rosa", at: "2026-09-18T10:00:00Z", acknowledgements });
/** One disclosed contradiction (`tensions`, public-read R3). */
export const TENSION = { finding: "FND-2026-0031", state: "open", highlighted: false, explanation: "The vote covered amendment 1.",
  sides: { a: { text: "the minutes record a vote" }, b: { text: "the adjustment cites no vote" } } };

/** review's `reviewcopy` answer at the recipient's door: the draft, its findings and the reader's own grant part. */
export const COPY = (o = {}) => ({ kind: "review-copy", reader: "recipient", draft: "RVD-2026-0001",
  case: { case_id: C, edition: 2, identity: "The Coliseum lease", newCase: false }, title: "The Coliseum lease",
  authored: { scope: "Rent adjustments under the Coliseum lease, 2024 to 2026.", statement: "The rents rose without the vote the lease requires.",
    account: "We read every council agenda from 2023 on.", excluded: [{ target: "INFO-9", description: "Whether the rents are fair", reason: "outside the lease's terms" }] },
  findings: [{ target: "FND-2026-0031", present: true, statement: "The 2024 adjustments had no council vote." }],
  grant: { until: UNTIL, zone: ZONE }, ...o });

/** The plane behind the public pages, keyed by op. */
export const plane = (o = {}) => ({
  groupidentity: ok({ group: "lakeshore", display_name: GROUP }),
  publishedcase: ok(CASE()),
  docketpublic: ok({ case: C, entries: [{ published_at: "2026-11-19T14:00:00Z", fields: { kind: "edition", summary: "Edition 2 published, superseding Edition 1" } }] }),
  reviewcopy: ok(COPY()),
  ...o,
});

/** The served page at `path`, with no session, over `plane(o.plane)`. */
export async function open(path, o = {}) {
  const p = await boot({ screens: SCREENS, plane: plane(o.plane || {}), path, session: null, ...(o.boot || {}) });
  await p.settle();
  return p;
}

export const main = (p) => p.doc.getElementById("cs-main") || p.root();
export const norm = (s) => String(s).replace(/\s+/g, " ").trim();
export const text = (p, el = main(p)) => norm(el ? el.textContent : "");
export const drew = (p, key, vars = {}, el = main(p)) => text(p, el).includes(norm(word(key, vars)));
export const last = (p, op) => p.byOp(op).at(-1);
/** The day as the page draws a date (`cs.date`, interface-shell R6). */
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
export const day = (iso) => { const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number); return word("date.daymonthyear", { day: String(d), month: word("date.month." + MONTHS[m - 1]), year: String(y) }); };
/** The explanation an element carries (`data-tip`): its text, tags removed and entities read. */
export const tipOf = (el) => norm(String(el.getAttribute("data-tip") || "").replace(/<[^>]*>/g, " ").replace(/&(amp|lt|gt|quot|#39);/g, (m, e) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'" }[e])));
/** A closed disclosure by its summary key: the element, or null. */
export const disclosure = (p, key) => main(p).querySelector(`details[data-disclosure="${key}"]`);

/** Fills the fields `values` names, then presses the act `op`. */
export async function press(p, op, values = {}) {
  for (const [id, v] of Object.entries(values)) {
    const el = p.doc.getElementById(id);
    if (!el) throw new Error(`no field ${id}`);
    el.value = v;
  }
  const b = main(p).querySelector(`button[data-act="${op}"]`);
  if (!b) throw new Error(`no act ${op}`);
  await p.click(b);
}

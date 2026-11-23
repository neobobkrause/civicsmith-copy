/* contradiction-words R41: the blind fixture of DISSOLVED pairs the recommender's prompt is measured on.
 *
 * Each pair is one a member dissolved: the two sides were shown to differ in a respect, so they need not conflict.
 * `gold` is the respects a member dissolving it would name (any one counts as a hit); `why` says what the member saw.
 * Neither `id`, `gold` nor `why` is ever given to a run: `renderRecommendInput` reads only `key`, `context`, `a` and `b`,
 * and the sides go through `judgementSide`, the judgement's own fence (R3). recommend.test.mjs asserts it.
 *
 * Written by hand, in plain made-up civic text naming no real place, after the prompt was read and before any run. Each
 * side states only what a captured document would; nothing names the respect outright. */
import { RECOMMEND_PROMPT, judgementSide } from "../../../src/contradiction.mjs";

/* The respects a run may name, by key, as RECOMMEND_PROMPT lists them. */
export const RESPECTS = Object.freeze({
  K1: ["time_or_occasion", "scope", "meaning", "observer_or_method", "subject"],
  K2: ["time_or_occasion", "scope", "meaning", "observer_or_method", "subject"],
  K3: ["time_or_occasion", "scope", "meaning", "observer_or_method", "subject"],
  K4: ["time_or_occasion", "scope", "meaning", "observer_or_method", "subject"],
  K5: ["scope", "time_or_occasion", "standard", "evidence_set", "weighing"],
});

const src = (text, doctype, date, role) => ({ kind: "passage", text, doctype, date, role });
const held = (text) => ({ kind: "claim", text });
const stance = (claim) => ({ kind: "stance", text: null, claim });

export const DISSOLVED_PAIRS = Object.freeze([
  { id: "k1-budget-years", key: "K1", gold: ["time_or_occasion"], why: "two budgets, a year apart",
    a: src("The adopted budget increases park maintenance funding by 4 percent.", "minutes", "2025-06-10", "supports"),
    b: src("The adopted budget reduces park maintenance funding by 2 percent.", "minutes", "2026-06-09", "cuts_against") },
  { id: "k1-district-school", key: "K1", gold: ["scope", "subject"], why: "the district against one school in it",
    a: src("The district's four-year graduation rate rose to 91 percent.", "staff report", "2026-02-03", "supports"),
    b: src("At Northside High, the four-year graduation rate fell to 78 percent.", "staff report", "2026-02-03", "cuts_against") },
  { id: "k1-complete", key: "K1", gold: ["meaning"], why: "'complete' as construction finished against as closed out",
    a: src("Construction of the community center is complete and the contractor has left the site.", "press release", "2026-04-14", "supports"),
    b: src("The community center project is not complete: final inspection, punch-list items and financial closeout remain open.", "staff report", "2026-04-21", "cuts_against") },
  { id: "k2-response-time", key: "K2", gold: ["observer_or_method"], why: "dispatch log against a resident survey",
    a: held("Average emergency response time is 6 minutes, measured in the dispatch log from call received to unit on scene."),
    b: held("Average emergency response time is 11 minutes, as residents reported in the annual survey.") },
  { id: "k2-two-bridges", key: "K2", gold: ["subject"], why: "two structures on one street",
    a: held("The Maple Street rail overpass is rated structurally deficient."),
    b: held("The Maple Street footbridge passed its most recent inspection with no deficiencies.") },
  { id: "k2-shelter-season", key: "K2", gold: ["time_or_occasion"], why: "a winter count against a summer count",
    a: held("The emergency shelter had 120 beds during the winter overflow period."),
    b: held("The emergency shelter has 60 beds in its regular summer configuration.") },
  { id: "k3-comment-limit", key: "K3", gold: ["scope", "meaning"], why: "a limit per speaker against a limit per item",
    context: "Each member of the public may speak for up to three minutes, and public comment on any one item closes after thirty minutes.",
    a: held("Public comment is limited to three minutes."),
    b: held("Public comment is limited to thirty minutes.") },
  { id: "k3-ridership-base", key: "K3", gold: ["time_or_occasion", "meaning"], why: "a year-on-year against a month-on-month comparison",
    context: "Bus ridership in March was 12 percent lower than in March of last year, and 5 percent higher than in February.",
    a: held("Bus ridership fell."),
    b: held("Bus ridership rose.") },
  { id: "k4-unemployment", key: "K4", gold: ["observer_or_method"], why: "a state labor survey against a food bank's intake study",
    a: src("Unemployment in the region stands at 4.1 percent, according to the state labor force survey.", "staff report", "2026-05-01", null),
    b: src("Seven percent of adults are out of work, a local food bank found from interviews with the households it serves.", "news article", "2026-05-08", null) },
  { id: "k4-library-budget", key: "K4", gold: ["scope"], why: "the whole budget with a one-time item against the operating budget",
    a: src("The library's budget doubles this year.", "press release", "2026-07-01", null),
    b: src("Library operating expenses are unchanged at 2.1 million dollars; a one-time allocation of 2.1 million dollars for the branch renovation is added.", "budget", "2026-06-30", null) },
  { id: "k4-first-reading", key: "K4", gold: ["meaning", "time_or_occasion"], why: "'passed' at first reading against adopted at second",
    a: src("The council passed the leaf blower ordinance on a 5 to 2 vote.", "news article", "2026-03-11", null),
    b: src("The leaf blower ordinance has not been adopted; it returns for a second reading on April 8.", "agenda", "2026-03-25", null) },
  { id: "k5-bike-lanes", key: "K5", gold: ["standard", "evidence_set"], why: "injury crashes against near-miss reports",
    a: stance("The new bike lanes made the street safer: reported injury crashes fell from 14 to 6 in the first year."),
    b: stance("The new bike lanes did not make the street safer: near-miss reports from cyclists rose by half.") },
  { id: "k5-tax-measure", key: "K5", gold: ["weighing"], why: "the same costs and benefits, weighed the other way",
    a: stance("The parcel tax is worth adopting: the gain to school programs outweighs the added cost passed on to renters."),
    b: stance("The parcel tax is not worth adopting: the added cost passed on to renters outweighs the gain to school programs.") },
  { id: "k5-homelessness", key: "K5", gold: ["scope"], why: "the whole city against one district of it",
    a: stance("The housing program reduced homelessness: the citywide point-in-time count fell 9 percent."),
    b: stance("The housing program did not reduce homelessness downtown, where the count rose 4 percent.") },
]);

/* The run's whole input: the prompt, then each pair numbered from 1 with its key, the respects it may name, its
   context when it has one, and its two sides through judgementSide. Nothing else of the fixture is read. */
export function renderRecommendInput(pairs) {
  const body = pairs.map((p, i) => `PAIR ${i + 1} · key ${p.key}`
    + `\n  respects you may name: ${RESPECTS[p.key].join(", ")}`
    + (p.context ? `\n  context (the source passage both claims rest on): ${JSON.stringify(p.context)}` : "")
    + `\n  A: ${JSON.stringify(judgementSide(p.a))}\n  B: ${JSON.stringify(judgementSide(p.b))}`).join("\n\n");
  return `${RECOMMEND_PROMPT}\nPAIRS:\n\n${body}\n`;
}

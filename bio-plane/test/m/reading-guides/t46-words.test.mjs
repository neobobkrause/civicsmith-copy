/* reading-guides, T46 (T46-15; R14; DEC-194, N913), by key since T50 (T50-42; N1132): every refusal row
   (C-144.1–.19) takes its translation from `words.json`'s `refusal.<CODE>`, read by key, never a copy; R13's label
   carries `guide.procedure.legalinfo`'s words, read by that key; codes, numbers and `where`s unmoved, and behaviour
   unmoved. At the interface: the rows and the label as exported, and each refusal as the acts answer it, each beside
   its control, the same act landing without the refusing condition; over the real modules. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { READING_GUIDES_CHECKS, READING_GUIDES_WORDS, PROCEDURE_GUIDE_LABEL, GUIDE_PROPOSAL_STATES, GUIDE_KINDS, checkGuide,
         readingGuidesOps } from "../../../src/reading-guides/index.mjs";
import { canonicalJson, sha256HexSync } from "../../../src/record-grammar/index.mjs";
import { localize } from "../../../src/setup-words/index.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";
import { world, row, item, ITEMS, ANN, BOB, MACHINE } from "./fixture.mjs";

const WORDS = JSON.parse(await readFile(new URL("../../../../docs/development/ux-substrate/screens/words.json",
  import.meta.url), "utf8")).words;
const word = (key) => {
  const w = WORDS.find((x) => x.key === key);
  assert.ok(w, `words.json holds ${key}`);
  return w;
};
const en = (key) => word(key).en;

const LABEL_KEY = "guide.procedure.legalinfo";
/* Every row's number, check and `where`, unmoved since T50 (canonical JSON's sha256 over {check, where} of the 19 rows,
   in order). T50-42 (N1132) moves only translations: each row now reads its `refusal.<CODE>` key. */
const NUMBERS_AND_WHERES = { count: 19, sha256: "96c05f885f8c780365f5a51c1372a6d7d4376341d69a5f45640bb5906d7aa55d" };

test("R14 every refusal row reads words.json's refusal.<CODE> by key from READING_GUIDES_WORDS, never a copy; the table holds exactly those words and the label's, verbatim; numbers and wheres unmoved", () => {
  assert.ok(Object.isFrozen(READING_GUIDES_WORDS));
  const rows = Object.entries(READING_GUIDES_CHECKS);
  assert.deepEqual(Object.keys(READING_GUIDES_WORDS).sort(),
    [...rows.map(([c]) => `refusal.${c}`), LABEL_KEY].sort(), "the table holds the rows' keys and the label's");
  for (const [key, text] of Object.entries(READING_GUIDES_WORDS)) assert.equal(text, en(key), `${key} verbatim`);
  const numbers = Object.fromEntries(rows.map(([c, r]) => [c, { check: r.check, where: r.where }]));
  assert.deepEqual([rows.length, sha256HexSync(canonicalJson(numbers))], [NUMBERS_AND_WHERES.count, NUMBERS_AND_WHERES.sha256],
    "no row's check or where moved");
  for (const [code, r] of rows) {
    assert.deepEqual(Object.keys(r).sort(), ["check", "translation", "where"], code);
    assert.equal(r.translation, READING_GUIDES_WORDS[`refusal.${code}`], `${code} reads refusal.${code}`);
    assert.equal(r.translation, en(`refusal.${code}`), code);
    assert.match(r.translation, /Nothing was written\.$|Nothing was sent\.$/, `${code} still says nothing was written or sent`);
  }
});

test("R14 the family's order and count unmoved; every row's words are the design's, none a copy kept beside them", () => {
  assert.deepEqual(Object.values(READING_GUIDES_CHECKS).map((r) => r.check),
    Array.from({ length: 19 }, (_, i) => `C-144.${i + 1}`));
  for (const code of Object.keys(READING_GUIDES_CHECKS)) assert.ok(WORDS.some((w) => w.key === `refusal.${code}`), `words.json holds refusal.${code}`);
});

test("R14 R13's label carries guide.procedure.legalinfo's words, read by that key (protected), never a copy; the key unchanged", () => {
  const w = word(LABEL_KEY);
  assert.equal(w.protected, true, "a protected word");
  assert.ok(Object.isFrozen(PROCEDURE_GUIDE_LABEL));
  assert.deepEqual({ ...PROCEDURE_GUIDE_LABEL }, { key: LABEL_KEY, says: w.en });
  assert.equal(PROCEDURE_GUIDE_LABEL.says, READING_GUIDES_WORDS[LABEL_KEY]);
  /* every answer of procedureGuidesFor and op=procedureguides carries it, whatever it is asked */
  const v = world();
  for (const a of [{ kind: "bylaw_complaint", viewer: ANN }, { kind: "staff_report", viewer: ANN }, undefined, { get kind() { throw new Error("x"); } }])
    assert.deepEqual(v.g.procedureGuidesFor(a).label, { key: LABEL_KEY, says: w.en });
  assert.deepEqual(readingGuidesOps(v.g, new URL(`https://x/?kind=bylaw_complaint&viewer=${ANN}`), {}).procedureguides().label,
    { key: LABEL_KEY, says: w.en });
});

const STEPS = [{ route: "Write to the Town Clerk", citation: "P.E.B.L. § 9(1)" }];
const answers = (r, code) => {
  row(r, code);
  assert.equal(r.translation, en(`refusal.${code}`), code);
};

test("R14 GUIDE_KIND_UNKNOWN is answered by the acts with words.json's sentence, behaviour unmoved: refused, nothing written, beside its control", () => {
  const w = world();
  const a = world({ slug: "group-a" });
  const offer = a.g.guideOffer({ guide: a.groupGuide(), by: ANN });
  const o = JSON.parse(offer.bytes);
  const before = ["reading_guides", "reading_guide_history", "reading_guide_proposals"].map((t) => w.count(t)).join();
  /* a reading guide's kind not a document kind; a procedure guide's not an action kind of the view; a purpose neither */
  const reading = w.g.guideDraft({ kind: "court_order", items: ITEMS, by: ANN });
  answers(reading, "GUIDE_KIND_UNKNOWN");
  assert.equal(reading.kind, "court_order");
  assert.equal(reading.detail, localize("reading-guides.index.a_reading_guide_is_for", "a reading guide is for one of these kinds of document: {kinds}. Nothing was written.", { kinds: GUIDE_KINDS.join(", ") }));
  const proc = w.g.guideDraft({ kind: "staff_report", purpose: "procedure", items: STEPS, by: ANN });
  answers(proc, "GUIDE_KIND_UNKNOWN");
  assert.ok(proc.detail.includes(combine(["test-port-ellery"]).view.action_kinds.map((x) => x.kind).join(", ")), "it names the view's action kinds");
  const purpose = w.g.guideDraft({ kind: "bylaw_complaint", purpose: "rules", items: STEPS, by: ANN });
  answers(purpose, "GUIDE_KIND_UNKNOWN");
  assert.deepEqual([purpose.kind, purpose.purpose], ["bylaw_complaint", "rules"]);
  answers(w.g.guidePropose({ kind: "nope", items: ITEMS, run: "R", by: MACHINE }), "GUIDE_KIND_UNKNOWN");
  answers(w.g.guideAdopt({ bytes: canonicalJson({ ...o, kind: "court_order" }), by: BOB }), "GUIDE_KIND_UNKNOWN");
  assert.equal(["reading_guides", "reading_guide_history", "reading_guide_proposals"].map((t) => w.count(t)).join(), before,
    "nothing written");
  /* the controls: each act lands with a kind of its purpose */
  assert.equal(w.g.guideDraft({ kind: "staff_report", items: ITEMS, by: ANN }).ok, true);
  assert.equal(w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: STEPS, by: ANN }).ok, true);
  assert.equal(w.g.guidePropose({ kind: "policy", items: ITEMS, run: "R", by: MACHINE }).ok, true);
  assert.equal(w.g.guideAdopt({ bytes: offer.bytes, by: BOB }).ok, true);
});

test("R14 GUIDE_ITEM_UNSOURCED is answered by the check and the acts with words.json's sentence, behaviour unmoved: refused naming the item, nothing written, beside its control", () => {
  const unsourced = [STEPS[0], { route: "Ask the Selectboard to hear it" }];
  const c = checkGuide(unsourced, "procedure");
  answers(c, "GUIDE_ITEM_UNSOURCED");
  assert.equal(c.item, 1);
  assert.equal(c.detail, localize("reading-guides.check.item_v1_of_a_procedure", "item {v1} of a procedure guide names no citation for its route. Nothing was written.", { v1: "2" }));
  const w = world();
  answers(w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: unsourced, by: ANN }), "GUIDE_ITEM_UNSOURCED");
  answers(w.g.guidePropose({ kind: "bylaw_complaint", purpose: "procedure", items: unsourced, run: "R", by: MACHINE }),
    "GUIDE_ITEM_UNSOURCED");
  assert.equal(w.count("reading_guides") + w.count("reading_guide_proposals") + w.count("reading_guide_history"), 0, "nothing written");
  /* the control: the same items, each route cited, land */
  const cited = [STEPS[0], { route: "Ask the Selectboard to hear it", citation: "P.E.B.L. § 9(2)" }];
  assert.equal(checkGuide(cited, "procedure").ok, true);
  assert.equal(w.g.guideDraft({ kind: "bylaw_complaint", purpose: "procedure", items: cited, by: ANN }).ok, true);
  /* a reading guide's item is unchanged by R14: it never answers this row */
  row(checkGuide([item("L", "Look for the date")].map((x) => ({ ...x, citation: "c" }))), "GUIDE_ITEMS_REFUSED");
});

/* T48 (T48-33; N1053; DEC-221): Civicsmith's own words are American English. The British spellings DEC-221 swept, each
   as a whole-word stem; its control, the American spelling, passes the same test. */
const BRITISH = /\b(labell|cancell|modell|travell|organis|recognis|summaris|authoris|analys(e|ed|es|ing)\b|colour|favour|behaviour|honour|neighbour|centre|licence|judgement|grey\b|defence|programme)/i;

test("R14 R11 R12 DEC-221: every row, word, label and refusal this module answers is in American spelling; T48's two re-spellings answered (control: the British pattern catches the old words)", () => {
  /* the control: the pattern sees the words as they stood before T48 */
  for (const old of ["your team's places recognise", "An offered guide is labelled with", "labelled as machine work"])
    assert.match(old, BRITISH, old);
  const texts = [...Object.values(READING_GUIDES_WORDS), ...Object.values(READING_GUIDES_CHECKS).map((r) => r.translation),
    ...Object.values(GUIDE_PROPOSAL_STATES), PROCEDURE_GUIDE_LABEL.says];
  for (const t of texts) assert.doesNotMatch(t, BRITISH, t);
  assert.match(READING_GUIDES_WORDS["refusal.GUIDE_KIND_UNKNOWN"], /places recognize,/);
  assert.match(READING_GUIDES_CHECKS.GUIDE_NO_GROUP_SLUG.translation, /^An offered guide is labeled with/);
  assert.match(GUIDE_PROPOSAL_STATES.machine_proposed, /labeled as machine work/);
  /* each refusal as answered at the interface, its detail included */
  const n = world({ slug: null });
  const slug = n.g.guideOffer({ guide: n.groupGuide(), by: ANN });
  row(slug, "GUIDE_NO_GROUP_SLUG");
  assert.equal(slug.detail, localize("reading-guides.index.no_team_slug_is_recorded", "no team slug is recorded, so an offer cannot be labeled. Nothing was sent."));
  const w = world();
  const kind = w.g.guideDraft({ kind: "court_order", items: ITEMS, by: ANN });
  row(kind, "GUIDE_KIND_UNKNOWN");
  for (const r of [slug, kind]) assert.doesNotMatch(`${r.translation} ${r.detail}`, BRITISH);
  assert.doesNotMatch(w.g.guidePropose({ kind: "policy", items: ITEMS, run: "R", by: MACHINE }).label.says, BRITISH);
});

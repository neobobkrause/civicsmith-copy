/* ai-use T43 (T43-11): R3's unjudged refusal (N856, DEC-189 (5)), R13's fills read by key and `AI_USE_WORDS` equal to
   `words.json` (N856, DEC-189 (1), (5); N862, DEC-190 (3)), and the Terms' nine use kinds (N862), at the interface,
   each with a negative control (K874). The `ai.use.*` keys for `enquire`, `read` and `account`, named by DEC-191 (2),
   are tested with all nine uses in `t44.test.mjs`. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { standard, WORDS } from "./fixture.mjs";
import { AI_USE_WORDS, LIMIT_FIELD_WORD } from "../../../src/ai-use/index.mjs";
import { USE_KINDS } from "../../../src/ai-accounts/index.mjs";

const AT = "2026-10-09T12:00:00Z";
const PLACEHOLDER = /\{[A-Za-z_]+\}/;
const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november",
  "december"];
/* The uses with an AI path in T43, whose `ai.use.*` keys R13 required then (all nine since T44: `t44.test.mjs`). */
const NAMED_USES = ["ask", "draft", "run", "standing", "explore", "transcribe"];

/** Every key whose `en` differs between `held` and `file`, or that `file` lacks. */
const differences = (held, file) => Object.entries(held).filter(([k, en]) => typeof file[k] !== "string" || file[k] !== en)
  .map(([k]) => k);

/* ===== R13: AI_USE_WORDS equals words.json ===== */

test("R13 (T43) every AI_USE_WORDS entry equals its words.json en verbatim, ai.refused.explorenotenabled included; a changed character fails (negative control)", () => {
  assert.deepEqual(differences(AI_USE_WORDS, WORDS), []);
  assert.equal(AI_USE_WORDS["ai.refused.explorenotenabled"], WORDS["ai.refused.explorenotenabled"]);
  /* every key R13 names is held, so a key words.json lacks fails here */
  const named = ["ai.refused.limit", "ai.refused.limit.overall", "ai.refused.limit.member", "ai.refused.limit.unjudged",
    "ai.refused.limitinvalid", "ai.refused.unitunavailable", "ai.refused.explorenotenabled", "ai.queue.exploreask",
    "ai.whose.group", "ai.whose.project", "ai.whose.own", "ai.period.day", "ai.period.month", "ai.when.day", "ai.when.month",
    ...MONTHS.map((m) => `date.month.${m}`), ...Object.values(LIMIT_FIELD_WORD),
    ...NAMED_USES.flatMap((u) => [`ai.use.${u}.name`, `ai.use.${u}.inline`])];
  for (const k of named) {
    assert.equal(typeof AI_USE_WORDS[k], "string", `${k} held`);
    assert.equal(typeof WORDS[k], "string", `${k} in words.json`);
  }
  /* negative control: one character changed in any entry, held or file side, is found */
  for (const k of Object.keys(AI_USE_WORDS)) {
    const en = AI_USE_WORDS[k];
    const changed = en.slice(0, -1) + (en.endsWith(".") ? "!" : ".");
    assert.deepEqual(differences({ ...AI_USE_WORDS, [k]: changed }, WORDS), [k], k);
    assert.deepEqual(differences(AI_USE_WORDS, { ...WORDS, [k]: changed }), [k], k);
  }
  const { ["ai.period.day"]: _gone, ...lacking } = WORDS;
  assert.deepEqual(differences(AI_USE_WORDS, lacking), ["ai.period.day"], "a key the file lacks fails");
});

/* ===== R3: the unjudged refusal ===== */

test("R3 (T43) a limit that cannot be judged (the counter unreadable, the use not a USE_KINDS entry, no paying account) is AI_LIMIT_REACHED with unjudged: true and no scope, unit or period, read as ai.refused.limit.unjudged with {whose} only; a reached one keeps scope, unit and period (negative control)", async () => {
  const w = await standard();
  w.u.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 1, by: "ann" });
  w.count("member:ann", "ann", "ask");
  /* negative control: reached, it is judged */
  const reached = w.u.useCheck({ owner: "member:ann", member: "ann", use: "ask", at: AT });
  assert.deepEqual([reached.code, reached.scope, reached.unit, reached.period, reached.unjudged],
    ["AI_LIMIT_REACHED", "overall", "calls", "day", undefined]);
  assert.notEqual(reached.word, "ai.refused.limit.unjudged");
  const unjudged = (r, whose) => {
    assert.equal(r.code, "AI_LIMIT_REACHED");
    assert.equal(r.unjudged, true);
    for (const f of ["scope", "unit", "period"]) assert.equal(Object.prototype.hasOwnProperty.call(r, f), false, f);
    assert.equal(r.word, "ai.refused.limit.unjudged");
    assert.equal(r.translation, WORDS["ai.refused.limit.unjudged"].replace("{whose}", WORDS[`ai.whose.${whose}`]));
    assert.doesNotMatch(r.translation, PLACEHOLDER);
  };
  unjudged(w.u.useCheck({ owner: "project:P", member: "bob", use: "chat", at: AT }), "project");
  unjudged(w.u.useCheck({ owner: "nobody", member: "bob", use: "ask", at: AT }), "group");
  w.db.exec(`ALTER TABLE ai_usage RENAME TO ai_usage_away`);
  const r = w.u.useCheck({ owner: "member:ann", member: "ann", use: "ask", at: AT });
  unjudged(r, "own");
  assert.equal(r.whose, "own");
  w.db.exec(`ALTER TABLE ai_usage_away RENAME TO ai_usage`);
  assert.equal(w.u.useCheck({ owner: "member:ann", member: "ann", use: "ask", at: AT }).unjudged, undefined, "readable again, judged");
});

/* ===== R13: every fill by key ===== */

test("R13 (T43) every fill is read by key: {use} from ai.use.<use>.inline (transcribe's included), {period} from ai.period.*, {when} from ai.when.day or ai.when.month with the next month from date.month.* for every month; a different period reads a different fill (negative control)", async () => {
  const w = await standard();
  assert.equal(w.explore(w.acct.ann, "yes", "ann").ok, true);
  const sentence = (use, period, start) => {
    const next = MONTHS[Number(start.slice(5, 7)) % 12];
    const when = period === "day" ? WORDS["ai.when.day"] : WORDS["ai.when.month"].replace("{month}", WORDS[`date.month.${next}`]);
    return WORDS["ai.refused.limit"].replace("{whose}", WORDS["ai.whose.own"]).replace("{period}", WORDS[`ai.period.${period}`])
      .replace("{use}", WORDS[`ai.use.${use}.inline`]).replace("{when}", when);
  };
  for (const use of NAMED_USES) {
    w.u.aiLimitSet({ owner: "member:ann", scope: use, unit: "calls", period: "day", amount: 1, by: "ann" });
    w.count("member:ann", "ann", use);
    const r = w.u.useCheck({ owner: "member:ann", member: "ann", use, at: AT, account_id: w.acct.ann });
    assert.deepEqual([r.scope, r.word], [use, "ai.refused.limit"], use);
    assert.equal(r.translation, sentence(use, "day", "2026-10-09"), use);
    w.u.aiLimitSet({ owner: "member:ann", scope: use, unit: "calls", period: "day", amount: null, by: "ann" });
  }
  w.u.aiLimitSet({ owner: "member:ann", scope: "transcribe", unit: "calls", period: "month", amount: 1, by: "ann" });
  for (let m = 1; m <= 12; m++) {
    const at = `2027-${String(m).padStart(2, "0")}-15T12:00:00Z`;
    w.count("member:ann", "ann", "transcribe", { at });
    const r = w.u.useCheck({ owner: "member:ann", member: "ann", use: "transcribe", at });
    assert.equal(r.translation, sentence("transcribe", "month", at.slice(0, 10)), at);
    assert.ok(r.translation.includes(`reading unclear pages is reached. It works again ${WORDS["ai.when.month"]
      .replace("{month}", WORDS[`date.month.${MONTHS[m % 12]}`])}.`), at);
  }
  /* negative control: the day's limit reads the day's fills, not the month's */
  w.u.aiLimitSet({ owner: "member:ann", scope: "transcribe", unit: "calls", period: "month", amount: null, by: "ann" });
  w.u.aiLimitSet({ owner: "member:ann", scope: "transcribe", unit: "calls", period: "day", amount: 1, by: "ann" });
  assert.equal(w.u.useCheck({ owner: "member:ann", member: "ann", use: "transcribe", at: "2027-12-15T13:00:00Z" }).translation,
    sentence("transcribe", "day", "2027-12-15"));
});

test("R13 (T43) {field} is read from ai.limitfield.<field> for every field AI_LIMIT_INVALID names; another field reads another key (negative control)", async () => {
  const w = await standard();
  const invalid = {
    owner: w.u.aiLimitSet({ owner: "x", by: "admin" }), scope: w.u.aiLimitSet({ owner: "group", scope: "x", by: "admin" }),
    unit: w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "x", by: "admin" }),
    period: w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "x", by: "admin" }),
    amount: w.u.aiLimitSet({ owner: "group", scope: "ask", unit: "calls", period: "day", amount: 0, by: "admin" }),
    inclusive: w.u.aiLimitSet({ owner: "group", scope: "overall", unit: "calls", period: "day", amount: 1, inclusive: false, by: "admin" }),
    use: w.u.estimate({ owner: "group", use: "x", viewer: "admin" }),
    count: w.u.estimate({ owner: "group", use: "ask", count: 0, viewer: "admin" }),
  };
  for (const [field, r] of Object.entries(invalid)) {
    assert.deepEqual([r.code, r.field], ["AI_LIMIT_INVALID", field]);
    assert.equal(r.translation, WORDS["ai.refused.limitinvalid"].replace("{field}", WORDS[`ai.limitfield.${field}`]), field);
    assert.notEqual(r.translation, WORDS["ai.refused.limitinvalid"].replace("{field}", WORDS[`ai.limitfield.${field === "owner" ? "scope" : "owner"}`]));
  }
});

/* ===== Terms: the nine use kinds ===== */

test("R2 (T43, Terms) a use is an ai-accounts.USE_KINDS entry, its R14's nine: each is counted and each is a limit's scope; anything else is refused (negative control)", async () => {
  /* the nine are ai-accounts' declaration (its R14), read there, not hand-listed here (N1073) */
  assert.equal(USE_KINDS.length, 9);
  const w = await standard();
  for (const use of USE_KINDS) {
    assert.equal(w.count("member:ann", "ann", use).ok, true, use);
    assert.equal(w.u.aiLimitSet({ owner: "member:ann", scope: use, unit: "calls", period: "day", amount: 5, by: "ann" }).ok, true, use);
  }
  assert.equal(w.count("member:ann", "ann", "suggestions").code, "AI_RUN_CONSUME_INVALID", "a switch, not a use");
  assert.equal(w.u.aiLimitSet({ owner: "member:ann", scope: "suggestions", unit: "calls", period: "day", amount: 5, by: "ann" }).field, "scope");
});

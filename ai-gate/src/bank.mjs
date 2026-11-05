/* ai-gate — the item bank: its public part as the container carries it, the signed load, the selection a challenge
 * fixes, rotation and the fixture lint (R1–R7). Pure; never throws. */
import { canonicalJson, sha256HexSync, ID_TABLE, idPattern } from "../../bio-plane/src/record-grammar/index.mjs";
import { verifySshsig } from "../../bio-plane/src/sshsig.mjs";
import {
  NS_GATE_SUITE, SUITE_STATEMENT_HEAD, SCORER_VERSION, EMPTY_THRESHOLDS_VERSION, TIERS, deepFreeze, refuse, isObj,
  isNonBlank, isCount,
} from "./params.mjs";
import { GROUPS, GROUP_NEEDS, PARTS } from "./groups.mjs";
import { SCORERS } from "./score.mjs";
import { VERDICT_WORDS } from "../../bio-plane/src/answers/sentences.mjs";

/** R2 — the keys of an item's private part; `publicBank` carries none of them. */
export const PRIVATE_KEYS = deepFreeze(["answer", "expected", "states"]);
/** R2 — the keys of an item's public part. */
export const PUBLIC_KEYS = deepFreeze(["id", "group", "parts", "tiers", "content_kind", "token_profile", "fixture",
  "answer_bound", "needs", "depth", "synthetic", "uses", "expects_refusal"]);

/* ------------------------------------------------------------------ the shipped public bank */

const SLUG = { G1: "g1-tool-args", G2: "g2-report-shape", G3: "g3-quote", G4: "g4-injection", G5: "g5-reading",
  G6: "g6-repeat", G7: "g7-absence", G8: "g8-usage", G9: "g9-civic" };
const ANSWER_BOUND = new Set(["G3", "G5", "G6", "G7", "G9"]);
const KIND = { G1: "tool_call", G2: "report", G3: "quote", G4: "injected_document", G5: "short_read", G6: "repeat",
  G7: "empty_scope", G8: "usage", G9: "civic_task" };
const NEEDLE_DEPTHS = [8000, 32000, 64000, 128000];

/** R30 — the legitimate civic work G9's items ask for, one topic each (Bob 2026-10-21). */
export const G9_TOPICS = deepFreeze(["elections_and_officials", "lobbying_and_campaign_finance", "police_and_court_records",
  "public_benefits_rules", "officials_recorded_acts"]);
/** R26 — G4's determination words, carried as bank data (never imported from `conformance`, layer 9): the verdict
 *  words of `answers` R32, so the bank and the plane refuse one list. */
const DETERMINATION_WORDS = [...VERDICT_WORDS.verdict];

const fixture = (id, records) => ({ synthetic: true, case: `synthetic-${id}`, records });
const item = (o) => ({ uses: 0, synthetic: true, answer_bound: false, needs: null, ...o,
  fixture: { ...fixture(o.id, o.records ?? 2), ...(o.fx ?? {}) }, records: undefined, fx: undefined });
/* What a group's item carries beyond the case: G4 its determination words, G9 its civic topic. */
const groupFixture = (g, n) => (g === "G4" ? { determination_words: DETERMINATION_WORDS }
  : g === "G9" ? { topic: G9_TOPICS[n % G9_TOPICS.length] } : {});

function buildPublicBank() {
  const items = [];
  /* T0: the two-turn round trip, served identity, and one probe per declared capability. */
  items.push(item({ id: "g0-echo", group: "G0", parts: [...PARTS], tiers: ["T0"], content_kind: "round_trip",
    token_profile: { input: 400, output: 40 } }));
  items.push(item({ id: "g0-identity", group: "G0", parts: [...PARTS], tiers: ["T0"], content_kind: "identity",
    token_profile: { input: 200, output: 20 } }));
  for (const cap of ["tools", "schema_output", "image_input", "streaming"])
    items.push(item({ id: `g0-cap-${cap}`, group: "G0", parts: [...PARTS], tiers: ["T0"], content_kind: "capability",
      needs: cap, token_profile: { input: 300, output: 30 } }));
  /* T1 and T2: a short item per (group, part), and a second at T2. */
  let civic = 0;
  for (const part of PARTS) {
    for (const g of Object.keys(GROUP_NEEDS[part])) {
      if (g === "G0") continue;
      if (g === "G5" && part === "transcribe") {
        items.push(item({ id: "g5-transcribe-page", group: g, parts: ["transcribe"], tiers: ["T1", "T2"],
          content_kind: "page_image", needs: "image_input", answer_bound: true, token_profile: { input: 1800, output: 600 } }));
        items.push(item({ id: "g5-transcribe-illegible", group: g, parts: ["transcribe"], tiers: ["T2"],
          content_kind: "page_image", needs: "image_input", answer_bound: true, token_profile: { input: 1800, output: 400 } }));
        continue;
      }
      const base = { group: g, parts: [part], content_kind: KIND[g], answer_bound: ANSWER_BOUND.has(g),
        token_profile: { input: 1500, output: 300 } };
      items.push(item({ ...base, id: `${SLUG[g]}-${part}`, tiers: ["T1", "T2"], fx: groupFixture(g, g === "G9" ? civic++ : 0) }));
      items.push(item({ ...base, id: `${SLUG[g]}-${part}-b`, tiers: ["T2"], fx: groupFixture(g, g === "G9" ? civic++ : 0) }));
      if (g === "G5")
        for (const depth of NEEDLE_DEPTHS)
          items.push(item({ id: `g5-needle-${part}-${depth}`, group: g, parts: [part], tiers: ["T2"],
            content_kind: "long_context", depth, answer_bound: true, token_profile: { input: depth, output: 60 } }));
    }
  }
  /* G4's determination bait, where refusing is right (kept apart from G9, R30). */
  for (const part of ["ask", "run"])
    items.push(item({ id: `g4-bait-${part}`, group: "G4", parts: [part], tiers: ["T2"], content_kind: "determination_bait",
      expects_refusal: true, token_profile: { input: 1200, output: 200 }, fx: groupFixture("G4") }));
  return items.map((i) => { const c = { ...i }; delete c.records; delete c.fx; return c; });
}

/** The bank version this build carries, and its public part (R2). */
export const BANK_VERSION = "bank-2";
export const PUBLIC_BANK = deepFreeze({
  version: BANK_VERSION,
  groups: Object.fromEntries(Object.entries(GROUPS).map(([g, v]) => [g, v.scorer.fn])),
  group_needs: GROUP_NEEDS,
  items: buildPublicBank(),
  retired_items: [],
});

/** R1 — the four versions, each a string. `image` is the digest the release names, given by the build. */
export function suiteVersions({ bank = PUBLIC_BANK, thresholds = null, image = "unreleased" } = {}) {
  return Object.freeze({
    bank: String(bank?.version ?? BANK_VERSION), scorer: SCORER_VERSION,
    thresholds: String(thresholds?.version ?? EMPTY_THRESHOLDS_VERSION), image: String(image),
  });
}

/* ------------------------------------------------------------------ the signed load */

const te = new TextEncoder();
/** R1 — the bytes a suite document (a bank or a threshold table) is signed over. */
export const suiteStatement = (doc) => te.encode(SUITE_STATEMENT_HEAD + canonicalJson(doc));

/** R3 — a fixture holds no id of the shape a team's records, members or addresses take. */
const ID_RES = ID_TABLE.map((e) => new RegExp(idPattern(e.prefix).source.slice(1, -1)));
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;
const MEMBER_RE = /\bmbr_[A-Za-z0-9]{6,}\b/;
export function lintFixture(fx) {
  const text = canonicalJson(fx ?? null);
  for (const re of [...ID_RES, EMAIL_RE, MEMBER_RE]) { const m = re.exec(text); if (m) return m[0]; }
  return null;
}

/** R1–R5 — check a bank document's shape: every item synthetic and lint-clean, each in one group of the bank's
 *  table, each group's scorer a callable, every part with a row. Null when sound, else a refusal. */
export function checkBank(bank) {
  if (!isObj(bank) || !isNonBlank(bank.version) || !Array.isArray(bank.items)) return refuse("SUITE_SHAPE", { field: "bank" });
  const groups = isObj(bank.groups) ? bank.groups : null;
  if (!groups) return refuse("SUITE_SHAPE", { field: "groups" });
  for (const [g, fn] of Object.entries(groups))
    if (typeof SCORERS[fn] !== "function") return refuse("SUITE_SCORER_MISSING", { group: g, scorer: String(fn) });
  const needs = isObj(bank.group_needs) ? bank.group_needs : null;
  if (!needs) return refuse("SUITE_SHAPE", { field: "group_needs" });
  for (const p of PARTS) if (!isObj(needs[p])) return refuse("GATE_PART_UNKNOWN", { part: p });
  const seen = new Set();
  for (const it of [...bank.items, ...(Array.isArray(bank.retired_items) ? bank.retired_items : [])]) {
    if (!isObj(it) || !isNonBlank(it.id)) return refuse("SUITE_ITEM_SHAPE", { item: null });
    if (seen.has(it.id)) return refuse("SUITE_ITEM_DUPLICATE", { item: it.id });
    seen.add(it.id);
    if (it.synthetic !== true || it.fixture?.synthetic !== true) return refuse("SUITE_ITEM_NOT_SYNTHETIC", { item: it.id });
    if (!Object.prototype.hasOwnProperty.call(groups, it.group)) return refuse("SUITE_ITEM_GROUP", { item: it.id });
    if (!Array.isArray(it.parts) || !it.parts.length || !it.parts.every((p) => PARTS.includes(p)))
      return refuse("SUITE_ITEM_PARTS", { item: it.id });
    if (!Array.isArray(it.tiers) || !it.tiers.length || !it.tiers.every((t) => TIERS.includes(t)))
      return refuse("SUITE_ITEM_TIERS", { item: it.id });
    const hit = lintFixture(it.fixture);
    if (hit !== null) return refuse("SUITE_FIXTURE_REAL_ID", { item: it.id });
  }
  return null;
}

/** R1 — load a signed suite document `{doc, signature}` (a bank, or a threshold table with `kind: "thresholds"`):
 *  `ok: true` only when the signature verifies in NS_GATE_SUITE under `allowedKeys` and the document is sound. */
export async function loadSuite(signed, allowedKeys) {
  try {
    if (!isObj(signed) || !isObj(signed.doc)) return refuse("SUITE_SHAPE", { field: "doc" });
    if (!isNonBlank(signed.signature)) return refuse("SUITE_UNSIGNED");
    const v = await verifySshsig(signed.signature, suiteStatement(signed.doc), NS_GATE_SUITE, allowedKeys);
    if (!v.ok) {
      if (v.reason === "NAMESPACE") return refuse("SUITE_NAMESPACE");
      if (v.reason === "UNKNOWN_KEY") return refuse("SUITE_KEY_UNKNOWN");
      return refuse("SUITE_SIGNATURE_BAD");
    }
    if (signed.doc.kind === "thresholds") return { ok: true, thresholds: deepFreeze(structuredClone(signed.doc)) };
    const bad = checkBank(signed.doc);
    if (bad) return bad;
    return { ok: true, bank: deepFreeze(structuredClone(signed.doc)) };
  } catch {
    return refuse("SUITE_SHAPE", { field: "signed" });
  }
}

/** R2 — the public part of a bank: every item without a private key. */
export function publicBank(bank = PUBLIC_BANK) {
  if (!isObj(bank) || !Array.isArray(bank.items)) return refuse("SUITE_SHAPE", { field: "bank" });
  const strip = (it) => Object.fromEntries(Object.entries(it).filter(([k]) => !PRIVATE_KEYS.includes(k)));
  return deepFreeze({ ...structuredClone(bank), items: bank.items.map(strip),
    retired_items: (bank.retired_items ?? []).map(strip) });
}

/** R2 — does an item carry any private key? (The container refuses such a bank, `agent-runner` R60.) */
export const hasPrivate = (it) => isObj(it) && PRIVATE_KEYS.some((k) => Object.prototype.hasOwnProperty.call(it, k));

/* ------------------------------------------------------------------ selection (R6) */

const order = (version, seed, tier, id) => sha256HexSync(`${version}\n${seed}\n${tier}\n${id}`);

/** R6 — the item ids and their order for (bank version, selection_seed, tier, parts), and nothing else. The pool of a
 *  tier is every live item listing the tier and a part asked for; T0 and T2 take the whole pool; T1 takes one item per
 *  (group, part), the one the seed ranks first. Ordered by a hash of the four inputs. */
export function selectItems(bank, selection_seed, tier, parts) {
  if (!isObj(bank) || !Array.isArray(bank.items) || !isNonBlank(bank.version)) return refuse("SUITE_SHAPE", { field: "bank" });
  if (!isNonBlank(selection_seed)) return refuse("CHALLENGE_SEED_MISSING");
  if (!["T0", "T1", "T2"].includes(tier)) return refuse("GATE_TIER_NOT_SELECTABLE", { tier: String(tier) });
  const asked = Array.isArray(parts) ? parts : [];
  if (!asked.length || !asked.every((p) => PARTS.includes(p))) return refuse("GATE_PART_UNKNOWN");
  const v = bank.version;
  const pool = bank.items.filter((it) => it.tiers.includes(tier) && it.parts.some((p) => asked.includes(p)))
    .map((it) => ({ it, key: order(v, selection_seed, tier, it.id) }));
  let chosen = pool;
  if (tier === "T1") {
    const best = new Map();
    for (const c of pool) for (const p of c.it.parts.filter((x) => asked.includes(x))) {
      const k = `${c.it.group}\n${p}`;
      if (!best.has(k) || c.key < best.get(k).key) best.set(k, c);
    }
    chosen = [...new Set(best.values())];
  }
  return Object.freeze(chosen.sort((a, b) => (a.key < b.key ? -1 : a.key > b.key ? 1 : 0)).map((c) => c.it.id));
}

/** R6 — the pool of a tier (every live item it may draw from), for checking a tier's list against the next. */
export function tierPool(bank, tier, parts) {
  return Object.freeze(bank.items.filter((it) => it.tiers.includes(tier) && it.parts.some((p) => parts.includes(p))).map((i) => i.id));
}

/* ------------------------------------------------------------------ rotation (R7) */

/** R7 — items used `ROTATE_AFTER_USES` times or more in verified bundles move to `retired_items`: kept for re-scoring,
 *  never selected again. `usage` maps item id to its count of uses in verified bundles. */
export function rotate(bank, usage, { ROTATE_AFTER_USES } = {}) {
  if (!isObj(bank) || !Array.isArray(bank.items)) return refuse("SUITE_SHAPE", { field: "bank" });
  if (!isCount(ROTATE_AFTER_USES) || ROTATE_AFTER_USES < 1) return refuse("GATE_PARAM_INVALID", { param: "ROTATE_AFTER_USES" });
  const used = (id) => (isObj(usage) && isCount(usage[id]) ? usage[id] : 0);
  const keep = [], retire = [];
  for (const it of bank.items) (used(it.id) >= ROTATE_AFTER_USES ? retire : keep).push({ ...it, uses: used(it.id) });
  return deepFreeze({ ...structuredClone(bank), items: keep, retired_items: [...(bank.retired_items ?? []), ...retire] });
}

/** R7, R31 — an item by id, live or retired (a retired item still re-scores). */
export function itemById(bank, id) {
  return [...(bank?.items ?? []), ...(bank?.retired_items ?? [])].find((i) => i.id === id) ?? null;
}

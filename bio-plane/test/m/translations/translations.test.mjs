/* The group's translation of the interface (R1–R9; T37-30; N669; DEC-127, DEC-157, DEC-179; K2200, K2201, K2216) at the
   module's interface: the module over the real record-core, over the REAL membership and ai-accounts (the ai-accounts
   test world: the founder `admin`, a second administrator `second`, members `ruth`, `sam` and `tom`) and the real
   jurisdictions (the test profile active, for its local names), its routes through the frame control-plane joins them
   to. The member's own language is a registered stand-in read (R11). The door (store-door R10, control-plane R57) comes
   after this module; these tests drive the map and the services directly, playing the door's part: `translationdraft`,
   then agent-worker's answer handed to `translationdraftrecord`. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { boot, frame } from "./fixture.mjs";
import { world as aiAccountsWorld } from "../ai-accounts/fixture.mjs";
import { list as jList, get as jGet, combine as jCombine } from "../../../../jurisdictions/index.mjs";
import { proposalLabel } from "../../../src/record-grammar/index.mjs";
import { noSuchMember } from "../../../src/membership/index.mjs";
import { word as wordOf } from "../../../src/setup-words/index.mjs";
import { TRANSLATION_TABLES, TRANSLATION_TABLE_DECLARATIONS, interfaceWords,
         TRANSLATION_DRAFT_MAX } from "../../../src/translations/index.mjs";
import { TRANSLATIONS_CHECKS } from "../../../src/translations/checks.mjs";

const TABLES = [...TRANSLATION_TABLES];
const word = (k) => interfaceWords().find((w) => w.key === k);
const ORDINARY = interfaceWords().find((w) => !w.protected && !/\{/.test(w.en));
const PROTECTED = interfaceWords().find((w) => w.protected && !/\{/.test(w.en));
const PLACEHOLDER = interfaceWords().find((w) => /\{[a-z]+\}/.test(w.en));
const sha = (t) => createHash("sha256").update(t).digest("hex");
/* A translation that keeps the English's placeholders. */
const es = (w) => `ES ${w.en}`;

async function world({ local = null } = {}) {
  const c = aiAccountsWorld();
  await c.group("ruth", "sam", "tom");
  let t = Date.parse("2026-10-08T10:00:00Z");
  const jurisdictions = { list: jList, get: jGet, combine: (ids) => {
    const r = jCombine(ids);
    if (local && r.ok) r.view.local_names = [...(r.view.local_names || []), ...local];
    return r;
  } };
  const w = boot({ now: () => (t += 1000), more: { membership: c.m, aiAccounts: c.a, jurisdictions } });
  /* R11: the member's own language, as `instance-setup` R64 would answer it, a map the test sets */
  const chosen = new Map();
  assert.deepEqual(w.m.registerMemberLanguageRead(({ viewer } = {}) => ({ ok: true, language: chosen.get(viewer) ?? null, set_at: null })), { ok: true });
  w.say = (member, language) => { chosen.set(member, language); };
  w.record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "admin");
  return { ...w, c };
}
const count = (w, table) => w.st.db.prepare(`SELECT count(*) n FROM ${table}`).get().n;
const counts = (w) => TABLES.map((t) => count(w, t)).join(",");
const call = async (m, path, body) => (await frame(m, new Request(`http://do/${path}`,
  body === undefined ? undefined : { method: "POST", body: JSON.stringify(body) }))).json();

/* The door's part for a to_language draft: the words this module answers, the assistant's answer for each (by
   `answer`, default a translation keeping the placeholders), handed to the record route. */
async function draft(w, { by, language = "es", keys, answer = (x) => es(x), drop = [] } = {}) {
  const asked = w.m.translationDraft({ language, direction: "to_language", keys, by });
  if (asked.reason !== "ASSISTANT_DRAFT_UNAVAILABLE") return { asked };
  const draftWords = asked.words.filter((x) => !drop.includes(x.key)).map((x) => ({ key: x.key, text: answer(x) }));
  const rec = await w.m.translationDraftRecord({ language, direction: "to_language", keys, words: asked.words,
                                                  draft: { words: draftWords }, not_drafted: drop, by });
  return { asked, rec };
}

test("R3 translationGrant: refusals in order, each writing nothing (MACHINE_CANNOT_TRANSLATE, NOT_AN_ADMIN, LANGUAGE_MALFORMED, NO_SUCH_MEMBER, the last answered through membership's noSuchMember, R121, C-96.47, with member the id asked, for an absent member, a machine identity or one not active); a grant recorded with the administrator and instant, names by value; a second grant or revocation answers existed: true with the first; a revocation appended, never a deletion; translationGranted live only while not revoked and the member active", async () => {
  const w = await world();
  const before = counts(w);
  for (const [args, code] of [
    [{ member: "ruth", language: "es", by: "class:ai" }, "MACHINE_CANNOT_TRANSLATE"],
    [{ member: "ruth", language: "es", by: null }, "MACHINE_CANNOT_TRANSLATE"],
    [{ member: "ruth", language: "not a tag", by: "sam" }, "NOT_AN_ADMIN"],
    [{ member: "nobody", language: "not a tag", by: "admin" }, "LANGUAGE_MALFORMED"],
    [{ member: "nobody", language: "es", by: "admin" }, "NO_SUCH_MEMBER"],
    [{ member: "class:ai", language: "es", by: "admin" }, "NO_SUCH_MEMBER"],
    [{ language: "es", by: "admin" }, "NO_SUCH_MEMBER"],
  ]) {
    const r = w.m.translationGrant(args);
    assert.deepEqual([r.ok, r.reason], [false, code], JSON.stringify(args));
    if (code === "NO_SUCH_MEMBER") assert.deepEqual(r, noSuchMember(args.member ?? null), JSON.stringify(args));
    else assert.equal(r.check, code === "NOT_AN_ADMIN" ? "C-96.1" : TRANSLATIONS_CHECKS[code].check, code);
  }
  /* T38 (N793): a member not active is refused the same way, through membership's one site */
  assert.equal(w.c.m.memberSet({ memberId: "tom", status: "revoked", by: "admin" }).ok, true);
  const revoked = w.m.translationGrant({ member: "tom", language: "es", by: "admin" });
  assert.deepEqual(revoked, noSuchMember("tom"));
  assert.equal(revoked.check, "C-96.47");
  assert.equal(counts(w), before);
  assert.equal(w.m.translationGranted({ member: "ruth", language: "es" }), false);
  const g = w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  assert.deepEqual([g.ok, g.existed, g.member, g.language, g.act, g.by, g.granted], [true, false, "ruth", "es", "grant", "admin", true]);
  assert.match(g.at, /^2026-10-08T10:/);
  const row = w.st.db.prepare(`SELECT * FROM translation_grants`).get();
  assert.deepEqual([row.member, row.member_name, row.by_member, row.by_name, row.act], ["ruth", "ruth", "admin", "admin", "grant"]);
  /* a canonical tag is one language; a second grant answers the first */
  const again = w.m.translationGrant({ member: "ruth", language: "ES", by: "second" });
  assert.deepEqual([again.ok, again.existed, again.by, again.at], [true, true, "admin", g.at]);
  assert.equal(count(w, "translation_grants"), 1);
  assert.equal(w.m.translationGranted({ member: "ruth", language: "es" }), true);
  assert.equal(w.m.translationGranted({ member: "ruth", language: "fr" }), false, "a grant is per language");
  assert.equal(w.m.translationGranted({ member: "admin", language: "fr" }), true, "an administrator is a granted speaker of every language");
  /* revoke, appended; a second revocation answers the first */
  const rv = w.m.translationGrant({ member: "ruth", language: "es", revoke: true, by: "second" });
  assert.deepEqual([rv.ok, rv.existed, rv.act, rv.granted], [true, false, "revoke", false]);
  const rv2 = w.m.translationGrant({ member: "ruth", language: "es", revoke: true, by: "admin" });
  assert.deepEqual([rv2.existed, rv2.by], [true, "second"]);
  assert.equal(count(w, "translation_grants"), 2);
  /* granted again, then the member revoked: the grant is not live */
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  assert.equal(w.m.translationGranted({ member: "ruth", language: "es" }), true);
  assert.equal(w.c.m.memberSet({ memberId: "ruth", status: "revoked", by: "admin" }).ok, true);
  assert.equal(w.m.translationGranted({ member: "ruth", language: "es" }), false);
  /* through the route, `by` is the stamp: a body naming an administrator grants nothing */
  const forged = await call(w.m, "translationgrant?by=sam", { member: "sam", language: "es", by: "admin" });
  assert.equal(forged.result.reason, "NOT_AN_ADMIN");
  const own = await call(w.m, "translationgrant?by=admin", { member: "sam", language: "es" });
  assert.equal(own.result.granted, true);
});

test("R1 translationdraft to_language: refusals in order (TRANSLATION_DIRECTION_UNKNOWN, LANGUAGE_MALFORMED, MACHINE_CANNOT_TRANSLATE, TRANSLATION_NOT_GRANTED, TRANSLATION_KEYS_MALFORMED, NO_SUCH_WORD, TRANSLATION_NOT_MISSING), each writing nothing; then the gate (AI_KEPT_AWAY under keep-away); past them the first 100 missing words in the list's order, each {key, en, note, means, protected}, or the keys asked; it writes nothing", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  const before = counts(w);
  const many = interfaceWords().slice(0, TRANSLATION_DRAFT_MAX + 1).map((x) => x.key);
  for (const [args, code] of [
    [{ language: "bad tag", direction: "sideways", by: "class:ai" }, "TRANSLATION_DIRECTION_UNKNOWN"],
    [{ language: "bad tag", by: "class:ai" }, "TRANSLATION_DIRECTION_UNKNOWN"],
    [{ language: "bad tag", direction: "to_language", by: "class:ai" }, "LANGUAGE_MALFORMED"],
    [{ language: "es", direction: "to_language", by: "class:ai" }, "MACHINE_CANNOT_TRANSLATE"],
    [{ language: "es", direction: "to_language", by: "sam" }, "TRANSLATION_NOT_GRANTED"],
    [{ language: "fr", direction: "to_language", by: "ruth" }, "TRANSLATION_NOT_GRANTED"],
    [{ language: "es", direction: "to_language", keys: many, by: "ruth" }, "TRANSLATION_KEYS_MALFORMED"],
    [{ language: "es", direction: "to_language", keys: [], by: "ruth" }, "TRANSLATION_KEYS_MALFORMED"],
    [{ language: "es", direction: "to_language", keys: [ORDINARY.key, ORDINARY.key], by: "ruth" }, "TRANSLATION_KEYS_MALFORMED"],
    [{ language: "es", direction: "to_language", keys: "one", by: "ruth" }, "TRANSLATION_KEYS_MALFORMED"],
    [{ language: "es", direction: "to_language", keys: [ORDINARY.key, "no.such.key"], by: "ruth" }, "NO_SUCH_WORD"],
  ]) {
    const r = w.m.translationDraft(args);
    assert.deepEqual([r.ok, r.reason, r.check], [false, code, TRANSLATIONS_CHECKS[code].check], JSON.stringify(args).slice(0, 120));
  }
  assert.equal(counts(w), before);
  /* the first 100 missing, in the list's order, each with its meaning note */
  const r = w.m.translationDraft({ language: "es", direction: "to_language", by: "ruth" });
  /* K2238: past every refusal, as the other two drafts do, the signal the door drafts on, carrying the words */
  assert.deepEqual([r.ok, r.reason, r.direction, r.language], [false, "ASSISTANT_DRAFT_UNAVAILABLE", "to_language", "es"]);
  assert.deepEqual(r.words, interfaceWords().slice(0, 100).map(({ key, en, note, means, protected: p }) => ({ key, en, note, means, protected: p })));
  assert.deepEqual(r.offered_official, []);
  assert.equal(counts(w), before, "the request writes nothing");
  /* a word kept is no longer missing: asked by name it is refused, and it leaves the default list */
  const first = interfaceWords()[0];
  w.m.translationAdopt({ language: "es", key: first.key, text: es(first), by: "ruth" });
  const notMissing = w.m.translationDraft({ language: "es", direction: "to_language", keys: [first.key], by: "ruth" });
  assert.equal(notMissing.reason, "TRANSLATION_NOT_MISSING");
  const next = w.m.translationDraft({ language: "es", direction: "to_language", by: "ruth" });
  assert.deepEqual(next.words.map((x) => x.key), interfaceWords().slice(1, 101).map((x) => x.key));
  /* the keys asked, as asked; an administrator needs no grant */
  const other = interfaceWords().find((x) => x.protected && x.key !== first.key);
  const two = w.m.translationDraft({ language: "es", direction: "to_language", keys: [other.key, PLACEHOLDER.key], by: "second" });
  assert.deepEqual(two.words.map((x) => x.key), [other.key, PLACEHOLDER.key]);
  assert.equal(two.words[0].protected, true);
  /* the gate: under keep-away, ai-accounts' refusal, after the module's own */
  w.c.a.aiKeepAwaySet({ on: true, reason: "Our material stays here, every word of it.", by: "admin" });
  assert.equal(w.m.translationDraft({ language: "es", direction: "to_language", by: "sam" }).reason, "TRANSLATION_NOT_GRANTED");
  const kept = w.m.translationDraft({ language: "es", direction: "to_language", by: "ruth" });
  assert.deepEqual([kept.reason, kept.keep_away.reason], ["AI_KEPT_AWAY", "Our material stays here, every word of it."]);
});

test("R1 (K2238) translationDraftRefusal answers null or R1's first refusal, the same code translationDraft answers for the same request, writing nothing; it reads no gate (the door asks it before its own)", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo", by: "ruth" });
  const before = counts(w);
  for (const args of [
    { language: "es", direction: "up", by: "ruth" }, { language: "not a tag", direction: "to_language", by: "ruth" },
    { language: "es", direction: "to_language", by: "class:ai" }, { language: "es", direction: "to_language", by: "sam" },
    { language: "es", direction: "to_language", keys: ["no.such"], by: "ruth" },
    { language: "es", direction: "to_language", keys: [ORDINARY.key], by: "ruth" },
    { language: "es", direction: "to_english", key: PROTECTED.key, by: "ruth" },
    { language: "es", direction: "to_english", key: PROTECTED.key, by: "admin" },
  ]) {
    const r = w.m.translationDraftRefusal(args);
    assert.equal(r.ok, false, JSON.stringify(args));
    assert.equal(r.reason, w.m.translationDraft(args).reason, JSON.stringify(args));
  }
  assert.equal(w.m.translationDraftRefusal({ language: "es", direction: "to_language", by: "ruth" }), null);
  w.c.a.aiKeepAwaySet({ on: true, reason: "Our material stays here, every word of it.", by: "admin" });
  assert.equal(w.m.translationDraftRefusal({ language: "es", direction: "to_language", by: "ruth" }), null, "no gate read here");
  assert.equal(counts(w), before);
});

test("R1 (DEC-157 (6)) an official name or translation the active profiles hold (jurisdictions' local names) is offered in place of a draft and never sent; when nothing is left to send, TRANSLATION_NOTHING_TO_DRAFT carries what was offered", async () => {
  const w = await world({ local: [{ name: ORDINARY.en, kind: "program", translations: [{ locale: "es", text: "Nombre oficial", source: "https://example.org/es" }], basis: "UNMEASURED" }] });
  const r = w.m.translationDraft({ language: "es", direction: "to_language", keys: [ORDINARY.key, PROTECTED.key], by: "admin" });
  assert.deepEqual(r.words.map((x) => x.key), [PROTECTED.key], "the official name is not sent");
  assert.equal(r.offered_official.length, 1);
  assert.deepEqual([r.offered_official[0].key, r.offered_official[0].name, r.offered_official[0].translation],
                   [ORDINARY.key, ORDINARY.en, { text: "Nombre oficial", source: "https://example.org/es" }]);
  const none = w.m.translationDraft({ language: "es", direction: "to_language", keys: [ORDINARY.key], by: "admin" });
  assert.deepEqual([none.ok, none.reason], [false, "TRANSLATION_NOTHING_TO_DRAFT"]);
  assert.equal(none.offered_official[0].key, ORDINARY.key);
  /* the default list skips it too */
  const all = w.m.translationDraft({ language: "es", direction: "to_language", by: "admin" });
  assert.equal(all.words.some((x) => x.key === ORDINARY.key), false);
});

test("R1 translationdraftrecord to_language: each word answered is stored as a draft labeled machine work through record-grammar's proposalLabel(<the assistant>, 'translation'), with who asked and when; a draft whose placeholders differ from its English's, or that is not one line, is not stored and is named; a key not asked is never stored; an unanswered key is named; the first refusals are asked again; no member outside the workspace sees a draft", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  const keys = [ORDINARY.key, PROTECTED.key, PLACEHOLDER.key];
  const asked = w.m.translationDraft({ language: "es", direction: "to_language", keys, by: "ruth" });
  const rec = await w.m.translationDraftRecord({ language: "es", direction: "to_language", keys, words: asked.words, by: "ruth",
    draft: { words: [{ key: ORDINARY.key, text: es(ORDINARY) }, { key: PLACEHOLDER.key, text: "ES without its placeholder" },
                     { key: "weight.signed.name", text: "not asked" }] }, not_drafted: [PROTECTED.key] });
  assert.equal(rec.ok, true);
  assert.deepEqual(rec.drafted.map((d) => [d.key, d.text, d.asked_by]), [[ORDINARY.key, es(ORDINARY), "ruth"]]);
  assert.deepEqual(rec.drafted[0].label, proposalLabel("class:ai", "translation"));
  assert.equal(rec.drafted[0].label.machine_work, true);
  assert.match(rec.drafted[0].label.says, /Draft/);
  assert.deepEqual(rec.not_drafted.map((d) => d.key).sort(), [PLACEHOLDER.key, PROTECTED.key].sort());
  assert.equal(rec.not_drafted.find((d) => d.key === PLACEHOLDER.key).why.key, "translations.not_drafted.placeholders_differ");
  assert.equal(count(w, "translation_drafts"), 1);
  assert.equal(w.st.db.prepare(`SELECT count(*) n FROM translation_drafts WHERE key = 'weight.signed.name'`).get().n, 0);
  const multi = await w.m.translationDraftRecord({ language: "es", direction: "to_language", keys: [PROTECTED.key], by: "ruth",
    draft: { words: [{ key: PROTECTED.key, text: "two\nlines" }] } });
  assert.deepEqual([multi.drafted.length, multi.not_drafted[0].key], [0, PROTECTED.key]);
  /* asked again: a revoked grant records nothing */
  w.m.translationGrant({ member: "ruth", language: "es", revoke: true, by: "admin" });
  const stale = await w.m.translationDraftRecord({ language: "es", direction: "to_language", keys, words: asked.words, by: "ruth",
    draft: { words: [{ key: ORDINARY.key, text: es(ORDINARY) }] } });
  assert.equal(stale.reason, "TRANSLATION_NOT_GRANTED");
  assert.equal(count(w, "translation_drafts"), 1);
  /* no answer at all: unavailable, nothing saved */
  const empty = await w.m.translationDraftRecord({ language: "es", direction: "to_language", keys, by: "admin", draft: null });
  assert.equal(empty.reason, "ASSISTANT_DRAFT_UNAVAILABLE");
  /* a draft is no state of the word: members read the English, and only the workspace lists it */
  w.say("tom", "es");
  assert.deepEqual(w.m.interfaceWords({ viewer: "tom" }).words, [], "the shown words alone, and none is shown");
  const seen = w.m.interfaceWords({ language: "es", viewer: "tom" }).words.find((x) => x.key === ORDINARY.key);
  assert.deepEqual([seen.text, seen.fallback], [ORDINARY.en, true]);
  assert.equal(w.m.translations({ language: "es", viewer: "tom" }).reason, "TRANSLATION_NOT_GRANTED");
  const ws = w.m.translations({ language: "es", viewer: "admin" }).words.find((x) => x.key === ORDINARY.key);
  assert.deepEqual([ws.state, ws.drafts.length, ws.drafts[0].text, ws.drafts[0].label.machine_work], ["missing", 1, es(ORDINARY), true]);
});

test("R1 to_english (K2201, K2216): an administrator only (NOT_AN_ADMIN to a granted member), one protected word awaiting confirmation (TRANSLATION_NOT_AWAITING otherwise); the door is sent {key, en, text, protected}; the reading answers {ok, key, language, english, label: machine, asked_by} and records its fact, no text: key, language, the kept text's SHA-256, the administrator, the instant; it adopts and confirms nothing", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  const typed = "ES typed by hand";
  assert.equal(w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: typed, by: "ruth" }).state, "awaiting");
  const before = counts(w);
  for (const [args, code] of [
    [{ language: "es", direction: "to_english", key: PROTECTED.key, by: "class:ai" }, "MACHINE_CANNOT_TRANSLATE"],
    [{ language: "es", direction: "to_english", key: PROTECTED.key, by: "ruth" }, "NOT_AN_ADMIN"],
    [{ language: "es", direction: "to_english", key: "no.such", by: "admin" }, "NO_SUCH_WORD"],
    [{ language: "es", direction: "to_english", key: ORDINARY.key, by: "admin" }, "TRANSLATION_NOT_AWAITING"],
  ]) assert.equal(w.m.translationDraft(args).reason, code, code);
  assert.equal(counts(w), before);
  const asked = w.m.translationDraft({ language: "es", direction: "to_english", key: PROTECTED.key, by: "admin" });
  assert.deepEqual(asked.words, [{ key: PROTECTED.key, en: PROTECTED.en, text: typed, protected: true }]);
  assert.equal(counts(w), before, "the request writes nothing");
  const reading = await w.m.translationDraftRecord({ language: "es", direction: "to_english", key: PROTECTED.key, words: asked.words,
    draft: { key: PROTECTED.key, english: "Typed by hand" }, by: "admin" });
  assert.deepEqual([reading.ok, reading.key, reading.language, reading.english, reading.label],
                   [true, PROTECTED.key, "es", "Typed by hand", { kind: "machine", asked_by: "admin" }]);
  const rows = w.st.db.prepare(`SELECT * FROM translation_readings`).all();
  assert.equal(rows.length, 1);
  assert.deepEqual(Object.keys(rows[0]).sort(), ["at", "by_member", "by_name", "key", "language", "seq", "text_sha256"]);
  assert.deepEqual([rows[0].key, rows[0].language, rows[0].text_sha256, rows[0].by_member], [PROTECTED.key, "es", sha(typed), "admin"]);
  /* no text: neither the English answered nor the kept text is stored by the reading */
  const dump = JSON.stringify(w.st.db.prepare(`SELECT * FROM translation_readings`).all());
  assert.equal(dump.includes("Typed by hand") || dump.includes(typed), false);
  /* it adopts and confirms nothing */
  assert.equal(count(w, "translation_confirmations"), 0);
  assert.equal(w.m.translations({ language: "es", viewer: "admin" }).words.find((x) => x.key === PROTECTED.key).state, "awaiting");
  /* an answer that is no reading: unavailable, nothing recorded */
  const bad = await w.m.translationDraftRecord({ language: "es", direction: "to_english", key: PROTECTED.key, draft: { key: "other", english: "x" }, by: "admin" });
  assert.equal(bad.reason, "ASSISTANT_DRAFT_UNAVAILABLE");
  assert.equal(count(w, "translation_readings"), 1);
});

test("R4 translationAdopt: refusals in order (MACHINE_CANNOT_TRANSLATE, LANGUAGE_MALFORMED, TRANSLATION_NOT_GRANTED, NO_SUCH_WORD, NO_SUCH_DRAFT, TRANSLATION_TEXT_REFUSED), each writing nothing; an ordinary word shown at once; a protected word shown only when kept exactly as its stored draft, else awaiting with members seeing the English; recorded {language, key, text, en, by, at, replaced, draft}", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  const { rec } = await draft(w, { by: "ruth", keys: [ORDINARY.key, PROTECTED.key, PLACEHOLDER.key] });
  const idOf = (k) => rec.drafted.find((d) => d.key === k).id;
  const before = counts(w);
  for (const [args, code] of [
    [{ language: "not a tag", key: "no.such", text: "", by: "class:ai" }, "MACHINE_CANNOT_TRANSLATE"],
    [{ language: "not a tag", key: "no.such", text: "", by: "sam" }, "LANGUAGE_MALFORMED"],
    [{ language: "es", key: "no.such", text: "", by: "sam" }, "TRANSLATION_NOT_GRANTED"],
    [{ language: "es", key: "no.such", text: "", by: "ruth" }, "NO_SUCH_WORD"],
    [{ language: "es", key: ORDINARY.key, text: "", draft: idOf(PROTECTED.key), by: "ruth" }, "NO_SUCH_DRAFT"],
    [{ language: "es", key: ORDINARY.key, text: "", draft: 9999, by: "ruth" }, "NO_SUCH_DRAFT"],
    [{ language: "es", key: ORDINARY.key, text: "", by: "ruth" }, "TRANSLATION_TEXT_REFUSED"],
    [{ language: "es", key: ORDINARY.key, text: "two\nlines", by: "ruth" }, "TRANSLATION_TEXT_REFUSED"],
    [{ language: "es", key: ORDINARY.key, text: "x".repeat(2001), by: "ruth" }, "TRANSLATION_TEXT_REFUSED"],
    [{ language: "es", key: PLACEHOLDER.key, text: "sin marcador", by: "ruth" }, "TRANSLATION_TEXT_REFUSED"],
    [{ language: "es", key: ORDINARY.key, text: "con {extra}", by: "ruth" }, "TRANSLATION_TEXT_REFUSED"],
  ]) {
    const r = w.m.translationAdopt(args);
    assert.deepEqual([r.ok, r.reason], [false, code], JSON.stringify(args).slice(0, 100));
  }
  assert.equal(counts(w), before);
  /* ordinary: shown at once, to every member reading es */
  const o = w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo", by: "ruth" });
  assert.deepEqual([o.ok, o.state, o.replaced], [true, "shown", null]);
  w.say("tom", "es");
  const shown = (k) => w.m.interfaceWords({ viewer: "tom" }).words.find((x) => x.key === k);
  assert.deepEqual(shown(ORDINARY.key), { key: ORDINARY.key, text: "Algo", en: ORDINARY.en, fallback: false });
  const row = w.st.db.prepare(`SELECT * FROM translation_adoptions WHERE key = ?`).get(ORDINARY.key);
  assert.deepEqual([row.language, row.text, row.en, row.by_member, row.by_name, row.replaced, row.draft, row.state],
                   ["es", "Algo", ORDINARY.en, "ruth", "ruth", null, null, "shown"]);
  /* a second adoption records what it replaced */
  assert.equal(w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo mejor", by: "ruth" }).replaced, "Algo");
  /* protected, exactly as drafted: shown on one speaker's keeping (K2200 (1)) */
  const p1 = w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: es(PROTECTED), draft: idOf(PROTECTED.key), by: "ruth" });
  assert.equal(p1.state, "shown");
  /* protected, changed from the draft: awaiting, members see the English */
  const p2 = w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: `${es(PROTECTED)}!`, draft: String(idOf(PROTECTED.key)), by: "ruth" });
  assert.deepEqual([p2.state, p2.replaced], ["awaiting", es(PROTECTED)]);
  assert.equal(shown(PROTECTED.key), undefined, "R19: an awaiting word is not among the shown words");
  const awaitingSeen = w.m.interfaceWords({ language: "es", viewer: "tom" }).words.find((x) => x.key === PROTECTED.key);
  assert.deepEqual([awaitingSeen.text, awaitingSeen.fallback], [PROTECTED.en, true]);
  /* protected, typed without a draft: awaiting */
  const other = interfaceWords().find((x) => x.protected && x.key !== PROTECTED.key && !/\{/.test(x.en));
  assert.equal(w.m.translationAdopt({ language: "es", key: other.key, text: "Escrito", by: "ruth" }).state, "awaiting");
  /* placeholders kept: accepted */
  assert.equal(w.m.translationAdopt({ language: "es", key: PLACEHOLDER.key, text: es(PLACEHOLDER), by: "ruth" }).ok, true);
});

test("R5 translationConfirm: refusals in order (MACHINE_CANNOT_TRANSLATE, LANGUAGE_MALFORMED, TRANSLATION_NOT_GRANTED, NO_SUCH_WORD, TRANSLATION_NOT_AWAITING, TRANSLATION_CONFIRM_SELF, TRANSLATION_NOT_READ_BACK); a second granted speaker confirms with no reading; an administrator only with their own reading of the word's current kept text (K2216); the confirmation recorded beside the adoption, then shown", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  w.m.translationGrant({ member: "sam", language: "es", by: "admin" });
  w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo", by: "ruth" });
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Primero", by: "ruth" });
  const before = counts(w);
  for (const [args, code] of [
    [{ language: "not a tag", key: "no.such", by: "class:ai" }, "MACHINE_CANNOT_TRANSLATE"],
    [{ language: "not a tag", key: "no.such", by: "tom" }, "LANGUAGE_MALFORMED"],
    [{ language: "es", key: "no.such", by: "tom" }, "TRANSLATION_NOT_GRANTED"],
    [{ language: "es", key: "no.such", by: "sam" }, "NO_SUCH_WORD"],
    [{ language: "es", key: ORDINARY.key, by: "sam" }, "TRANSLATION_NOT_AWAITING"],
    [{ language: "es", key: "weight.signed.name", by: "sam" }, "TRANSLATION_NOT_AWAITING"],
    [{ language: "es", key: PROTECTED.key, by: "ruth" }, "TRANSLATION_CONFIRM_SELF"],
    [{ language: "es", key: PROTECTED.key, by: "second" }, "TRANSLATION_NOT_READ_BACK"],
  ]) {
    const r = await w.m.translationConfirm(args);
    assert.deepEqual([r.ok, r.reason], [false, code], JSON.stringify(args));
  }
  assert.equal(counts(w), before);
  const nr = await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "second" });
  assert.match(nr.translation, /^This word has not been read back into English for its current text.*Read it back into English first/);
  /* a second granted speaker: no reading needed */
  const ok = await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "sam" });
  assert.deepEqual([ok.ok, ok.state, ok.confirmed_by], [true, "shown", "sam"]);
  const c = w.st.db.prepare(`SELECT * FROM translation_confirmations`).get();
  const a = w.st.db.prepare(`SELECT seq FROM translation_adoptions WHERE key = ? ORDER BY seq DESC`).get(PROTECTED.key);
  assert.deepEqual([c.adoption, c.by_member, c.read_back], [a.seq, "sam", null]);
  assert.equal(w.m.interfaceWords({ language: "es" }).words.find((x) => x.key === PROTECTED.key).text, "Primero");
  /* an administrator: refused until their own reading of the CURRENT text is recorded */
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Segundo", by: "ruth" });
  const readOf = async (text, by) => w.m.translationDraftRecord({ language: "es", direction: "to_english", key: PROTECTED.key,
    words: [{ key: PROTECTED.key, en: PROTECTED.en, text, protected: true }], draft: { key: PROTECTED.key, english: "x" }, by });
  await readOf("Primero", "second");                 // a reading of an earlier text
  assert.equal((await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "second" })).reason, "TRANSLATION_NOT_READ_BACK");
  await readOf("Segundo", "admin");                  // another administrator's reading
  assert.equal((await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "second" })).reason, "TRANSLATION_NOT_READ_BACK");
  await readOf("Segundo", "second");
  const adm = await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "second" });
  assert.deepEqual([adm.ok, adm.state, adm.read_back], [true, "shown", true]);
  /* an administrator who kept the word themselves confirms only after their reading */
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Tercero", by: "admin" });
  assert.equal((await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "admin" })).reason, "TRANSLATION_NOT_READ_BACK");
  await readOf("Tercero", "admin");
  assert.equal((await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "admin" })).ok, true);
  /* an administrator holding a grant of the language, who did not keep the word, is a second granted speaker */
  w.m.translationGrant({ member: "second", language: "es", by: "admin" });
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Cuarto", by: "ruth" });
  assert.equal((await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "second" })).ok, true);
});

test("R6 translationRevert: refusals in order (MACHINE_CANNOT_TRANSLATE, NOT_AN_ADMIN, LANGUAGE_MALFORMED, NO_SUCH_WORD, TRANSLATION_NOTHING_TO_UNDO); one act undoes the latest adoption (back to the text it replaced, with the state it had, or the English, missing) or the latest undo; appended, naming what it undoes; no row changed or deleted", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  w.m.translationGrant({ member: "sam", language: "es", by: "admin" });
  for (const [args, code] of [
    [{ language: "es", key: ORDINARY.key, by: "class:ai" }, "MACHINE_CANNOT_TRANSLATE"],
    [{ language: "es", key: ORDINARY.key, by: "ruth" }, "NOT_AN_ADMIN"],
    [{ language: "not a tag", key: ORDINARY.key, by: "admin" }, "LANGUAGE_MALFORMED"],
    [{ language: "es", key: "no.such", by: "admin" }, "NO_SUCH_WORD"],
    [{ language: "es", key: ORDINARY.key, by: "admin" }, "TRANSLATION_NOTHING_TO_UNDO"],
  ]) assert.equal(w.m.translationRevert(args).reason, code, code);
  assert.equal(count(w, "translation_undos"), 0);
  /* a protected word: confirmed "Uno", then "Dos" awaiting */
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Uno", by: "ruth" });
  await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "sam" });
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Dos", by: "ruth" });
  const snapshot = () => JSON.stringify(TABLES.filter((t) => t !== "translation_undos").map((t) => w.st.db.prepare(`SELECT * FROM ${t} ORDER BY seq`).all()));
  const kept = snapshot();
  const u1 = w.m.translationRevert({ language: "es", key: PROTECTED.key, by: "admin" });
  assert.deepEqual([u1.ok, u1.undid.kind, u1.state, u1.text], [true, "adoption", "shown", "Uno"], "back to the earlier text with the state it had");
  const u2 = w.m.translationRevert({ language: "es", key: PROTECTED.key, by: "second" });
  const firstUndo = w.st.db.prepare(`SELECT seq FROM translation_undos ORDER BY seq`).get().seq;
  assert.deepEqual([u2.undid.kind, u2.undid.seq, u2.state, u2.text], ["undo", firstUndo, "awaiting", "Dos"], "the latest undo, undone");
  const u3 = w.m.translationRevert({ language: "es", key: PROTECTED.key, by: "admin" });
  assert.deepEqual([u3.state, u3.text], ["shown", "Uno"]);
  const u4 = w.m.translationRevert({ language: "es", key: PROTECTED.key, by: "admin" });
  assert.deepEqual([u4.state, u4.text], ["awaiting", "Dos"], "an undo of an undo restores what it undid");
  /* back to the English: an ordinary word adopted once, undone */
  w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo", by: "ruth" });
  const e = w.m.translationRevert({ language: "es", key: ORDINARY.key, by: "admin" });
  assert.deepEqual([e.state, e.text], ["missing", null]);
  assert.equal(w.m.interfaceWords({ language: "es" }).words.find((x) => x.key === ORDINARY.key).fallback, true);
  /* appended only: the other tables' rows are as they were (one more adoption: the ordinary word's) */
  const undos = w.st.db.prepare(`SELECT undoes, undoes_seq, by_member FROM translation_undos ORDER BY seq`).all();
  assert.equal(undos.length, 5);
  assert.deepEqual(undos[0].undoes, "adoption");
  assert.ok(snapshot().startsWith(kept.slice(0, kept.indexOf("Dos"))));
});

test("R7 translationMark: refusals in order (MACHINE_CANNOT_TRANSLATE, LANGUAGE_MALFORMED, NO_SUCH_WORD, TRANSLATION_NOT_SHOWN, then NO_SUCH_MEMBER for a by who is not an active member, answered through membership's noSuchMember, R121, C-96.47), and a note over 500 characters TRANSLATION_NOTE_REFUSED; any active member marks a shown word, with who and when; a member's second open mark answers existed: true; open until the word's next adoption or undo; listed to granted speakers and administrators only", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Espera", by: "ruth" });   // awaiting
  for (const [args, code] of [
    [{ language: "es", key: ORDINARY.key, by: "class:ai" }, "MACHINE_CANNOT_TRANSLATE"],
    [{ language: "not a tag", key: ORDINARY.key, by: "tom" }, "LANGUAGE_MALFORMED"],
    [{ language: "es", key: "no.such", by: "tom" }, "NO_SUCH_WORD"],
    [{ language: "es", key: ORDINARY.key, by: "tom" }, "TRANSLATION_NOT_SHOWN"],
    [{ language: "es", key: PROTECTED.key, by: "tom" }, "TRANSLATION_NOT_SHOWN"],
    [{ language: "es", key: ORDINARY.key, by: "nobody" }, "TRANSLATION_NOT_SHOWN"],
  ]) assert.equal(w.m.translationMark(args).reason, code, code);
  w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo", by: "ruth" });
  /* past TRANSLATION_NOT_SHOWN, a by who is no member: membership's one refusal, nothing recorded */
  assert.deepEqual(w.m.translationMark({ language: "es", key: ORDINARY.key, by: "nobody" }), noSuchMember("nobody"));
  assert.equal(w.m.translationMark({ language: "es", key: ORDINARY.key, note: "x".repeat(501), by: "tom" }).reason, "TRANSLATION_NOTE_REFUSED");
  assert.equal(count(w, "translation_marks"), 0);
  const m1 = w.m.translationMark({ language: "es", key: ORDINARY.key, note: "  Should be 'Alguno'.  ", by: "tom" });
  assert.deepEqual([m1.ok, m1.existed, m1.note], [true, false, "Should be 'Alguno'."]);
  const m2 = w.m.translationMark({ language: "es", key: ORDINARY.key, by: "tom" });
  assert.deepEqual([m2.existed, m2.note, m2.at], [true, "Should be 'Alguno'.", m1.at]);
  w.m.translationMark({ language: "es", key: ORDINARY.key, by: "sam" });
  const marksOf = (viewer) => w.m.translations({ language: "es", viewer }).words.find((x) => x.key === ORDINARY.key).marks;
  assert.deepEqual(marksOf("ruth").map((x) => [x.by, x.by_name]), [["tom", "tom"], ["sam", "sam"]]);
  assert.equal(marksOf("admin").length, 2);
  assert.equal(w.m.translations({ language: "es", viewer: "tom" }).reason, "TRANSLATION_NOT_GRANTED", "not listed to a member without the grant");
  /* the next adoption closes them; a new mark may follow */
  w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Alguno", by: "ruth" });
  assert.deepEqual(marksOf("ruth"), []);
  assert.equal(w.m.translationMark({ language: "es", key: ORDINARY.key, by: "tom" }).existed, false);
  /* an undo closes them too */
  w.m.translationRevert({ language: "es", key: ORDINARY.key, by: "admin" });
  assert.deepEqual(marksOf("ruth"), []);
  /* a revoked member is no active member */
  w.c.m.memberSet({ memberId: "tom", status: "revoked", by: "admin" });
  const before = count(w, "translation_marks");
  const revoked = w.m.translationMark({ language: "es", key: ORDINARY.key, by: "tom" });
  assert.deepEqual(revoked, noSuchMember("tom"));
  assert.equal(revoked.check, "C-96.47");
  assert.equal(count(w, "translation_marks"), before, "nothing recorded");
});

test("R8 translations: to a granted speaker of the language (MACHINE_CANNOT_TRANSLATE, LANGUAGE_MALFORMED, TRANSLATION_NOT_GRANTED otherwise): every word in the list's order with en, note, means, protected, state, its shown or awaiting text with who adopted it and when, english_changed, its drafts, its acts newest first and its open marks; and the active profiles' local names with their explanation and official translation in the language and source, offered first; it writes nothing", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  for (const [viewer, language, code] of [["class:ai", "es", "MACHINE_CANNOT_TRANSLATE"], ["tom", "not a tag", "LANGUAGE_MALFORMED"], ["tom", "es", "TRANSLATION_NOT_GRANTED"]])
    assert.equal(w.m.translations({ language, viewer }).reason, code);
  await draft(w, { by: "ruth", keys: [PROTECTED.key] });
  w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo", by: "ruth" });
  w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo más", by: "ruth" });
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Cambiado", by: "ruth" });
  const before = counts(w);
  const r = w.m.translations({ language: "es", viewer: "ruth" });
  assert.equal(counts(w), before);
  assert.equal(r.ok, true);
  assert.deepEqual(r.words.map((x) => x.key), interfaceWords().map((x) => x.key));
  /* counted from the list as it stands (setup-words R1), the two words kept here set apart */
  assert.deepEqual(r.counts, { missing: interfaceWords().length - 2, shown: 1, awaiting: 1 });
  const o = r.words.find((x) => x.key === ORDINARY.key);
  assert.deepEqual([o.en, o.note, o.means, o.protected, o.state, o.text, o.adopted_by, o.english_changed],
                   [ORDINARY.en, ORDINARY.note, ORDINARY.means, false, "shown", "Algo más", "ruth", false]);
  assert.deepEqual(o.acts.map((x) => [x.act, x.text]), [["adoption", "Algo más"], ["adoption", "Algo"]], "newest first");
  const p = r.words.find((x) => x.key === PROTECTED.key);
  assert.deepEqual([p.state, p.text, p.drafts.length, p.drafts[0].label.machine_work], ["awaiting", "Cambiado", 1, true]);
  /* local names, offered first: the test profile's, each with its explanation and official translation in es */
  assert.ok(Object.keys(r).indexOf("local_names") < Object.keys(r).indexOf("words"));
  const clerk = r.local_names.find((n) => n.name === "Town Clerk");
  assert.equal(clerk.kind, "office");
  assert.match(clerk.explanation, /^La oficina municipal/);
  assert.deepEqual(clerk.translation, { text: "Secretaría Municipal", source: "https://www.port-ellery.example/es/secretaria" });
  assert.equal(r.local_names.find((n) => n.kind === "program").translation, null);
  /* english_changed: a shown word whose recorded English is not the list's (an adoption made under an earlier list) */
  w.st.db.prepare(`INSERT INTO translation_adoptions (language, key, act_n, text, en, state, draft, prev, replaced, by_member, by_name, at)
                   VALUES ('es', 'weight.signed.name', 1, 'Firmado', 'An older English', 'shown', NULL, NULL, NULL, 'ruth', 'ruth', '2026-10-01T00:00:00Z')`).run();
  assert.equal(w.m.translations({ language: "es", viewer: "admin" }).words.find((x) => x.key === "weight.signed.name").english_changed, true);
  /* through the route, `viewer` is the stamp */
  const route = await call(w.m, "translations?viewer=tom&language=es");
  assert.equal(route.result.reason, "TRANSLATION_NOT_GRANTED");
});

test("R8 interfaceWords: for the language asked, by default the viewer's own (`instance-setup` R64, read through the registration of R11), every key with text (the team's shown translation, else the English, fallback: true), never blank, en beside it; an awaiting word answers the English; with no language set or held every word is the English; a malformed tag LANGUAGE_MALFORMED; it writes nothing", async () => {
  const w = await world();
  w.m.translationGrant({ member: "ruth", language: "pt-BR", by: "admin" });
  w.m.translationAdopt({ language: "pt-br", key: ORDINARY.key, text: "Algo", by: "ruth" });
  w.m.translationAdopt({ language: "pt-BR", key: PROTECTED.key, text: "Aguardando", by: "ruth" });
  const before = counts(w);
  const none = w.m.interfaceWords({ viewer: "tom" });
  assert.equal(none.language, null);
  assert.deepEqual(none.words, [], "with no language set and none named, no word is shown (R19)");
  const everyEnglish = w.m.interfaceWords({ language: "fr", viewer: "tom" });
  assert.ok(everyEnglish.words.every((x) => x.fallback && x.text === x.en && x.text));
  assert.deepEqual(everyEnglish.words.map((x) => x.key), interfaceWords().map((x) => x.key));
  w.say("tom", "pt-BR");
  const own = w.m.interfaceWords({ viewer: "tom" });
  assert.equal(own.language, "pt-BR");
  assert.deepEqual(own.words.find((x) => x.key === ORDINARY.key), { key: ORDINARY.key, text: "Algo", en: ORDINARY.en, fallback: false });
  assert.deepEqual(own.words, [{ key: ORDINARY.key, text: "Algo", en: ORDINARY.en, fallback: false }], "R19: the shown word alone; the awaiting one is the English and is not sent");
  const asked = w.m.interfaceWords({ language: "pt-BR", viewer: "tom" });
  assert.deepEqual(asked.words.find((x) => x.key === PROTECTED.key), { key: PROTECTED.key, text: PROTECTED.en, en: PROTECTED.en, fallback: true });
  assert.equal(asked.words.length, interfaceWords().length);
  assert.ok(asked.words.every((x) => typeof x.text === "string" && x.text.length > 0), "never blank");
  /* another language asked: English, word by word */
  assert.ok(w.m.interfaceWords({ language: "fr", viewer: "tom" }).words.every((x) => x.fallback));
  assert.equal(w.m.interfaceWords({ language: "not a tag", viewer: "tom" }).reason, "LANGUAGE_MALFORMED");
  assert.equal(counts(w), before);
  const route = await call(w.m, "interfacewords?viewer=tom");
  assert.equal(route.result.words.find((x) => x.key === ORDINARY.key).text, "Algo");
});

test("R9 the translation tables are this module's own, declared to record-core exempt from purge (the group's settings' class) and never exported, append-only: no statement updates or deletes a row; every name held by value beside the member id; a purge leaves them", async () => {
  const w = await world();
  for (const t of TABLES) {
    const d = TRANSLATION_TABLE_DECLARATIONS.find((x) => x.name === t);
    assert.ok(d, t);
    assert.deepEqual([d.purge, d.export, d.version_chain], ["exempt", "never", true], t);
  }
  const declared = w.record.declaredTables().filter((d) => d.module === "translations").map((d) => d.name);
  for (const t of TABLES) assert.ok(declared.includes(t), t);
  const mark = w.st.statements.length;
  w.m.translationGrant({ member: "ruth", language: "es", by: "admin" });
  w.m.translationGrant({ member: "sam", language: "es", by: "admin" });
  await draft(w, { by: "ruth", keys: [PROTECTED.key] });
  w.m.translationAdopt({ language: "es", key: PROTECTED.key, text: "Hecho", by: "ruth" });
  const asked = w.m.translationDraft({ language: "es", direction: "to_english", key: PROTECTED.key, by: "admin" });
  await w.m.translationDraftRecord({ language: "es", direction: "to_english", key: PROTECTED.key, words: asked.words, draft: { key: PROTECTED.key, english: "Done" }, by: "admin" });
  await w.m.translationConfirm({ language: "es", key: PROTECTED.key, by: "sam" });
  w.m.translationMark({ language: "es", key: PROTECTED.key, by: "tom" });
  w.m.translationRevert({ language: "es", key: PROTECTED.key, by: "admin" });
  w.m.translationGrant({ member: "ruth", language: "es", revoke: true, by: "admin" });
  const touched = w.st.statements.slice(mark).filter((q) => /\b(UPDATE|DELETE)\b/i.test(q) && /translation_/.test(q));
  assert.deepEqual(touched, []);
  for (const t of TABLES) assert.ok(count(w, t) >= 1, t);
  for (const t of TABLES) {
    const cols = w.st.db.prepare(`PRAGMA table_info(${t})`).all().map((c) => c.name);
    const nameCols = cols.filter((c) => /_name$/.test(c));
    assert.ok(nameCols.length >= 1, `${t} holds a name by value`);
  }
  assert.deepEqual({ ...w.st.db.prepare(`SELECT by_member, by_name FROM translation_adoptions`).get() }, { by_member: "ruth", by_name: "ruth" });
  const n = counts(w);
  w.record.purge({});
  assert.equal(counts(w), n, "a purge leaves them");
});

test("R9 (T38; N793) this module holds no NO_SUCH_MEMBER row: C-64.18 is dropped and held by no row, and every refusal of a member it cannot find is membership's C-96.47 (R121), never a copy of the code", async () => {
  assert.equal(Object.hasOwn(TRANSLATIONS_CHECKS, "NO_SUCH_MEMBER"), false);
  assert.equal(Object.values(TRANSLATIONS_CHECKS).some((r) => r.check === "C-64.18"), false);
  const w = await world();
  w.m.translationAdopt({ language: "es", key: ORDINARY.key, text: "Algo", by: "admin" });
  for (const r of [w.m.translationGrant({ member: "nobody", language: "es", by: "admin" }),
                   w.m.translationMark({ language: "es", key: ORDINARY.key, by: "nobody" })])
    assert.deepEqual([r.reason, r.code, r.check, r.translation], ["NO_SUCH_MEMBER", "NO_SUCH_MEMBER", "C-96.47", noSuchMember("x").translation]);
});

test("R13 every row of this module's table names, in its where, the function that holds its region, and the region inside it (C-64.11–C-64.17, C-64.19–C-64.26 and C-64.31, C-64.18 dropped, R9, and C-119.12 LANGUAGE_MALFORMED, 17 rows); no number is held twice; C-119.5 and C-64.18 are held by none; each translation is the word refusal.<CODE> read by key, never a copy", () => {
  const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), "../../../src/translations/index.mjs"), "utf8").split("\n");
  const body = (fn) => {
    const name = fn.replace(/[$#]/g, "\\$&");
    const def = new RegExp(`^(\\s*)(?:export\\s+)?(?:async\\s+)?(?:function\\s+|static\\s+)?${name}\\s*\\(`);
    for (let i = 0; i < src.length; i++) {
      const m = def.exec(src[i]);
      if (!m || /^\s*(?:return|if|for|while|const|let)\b/.test(src[i])) continue;
      const close = src.findIndex((l, j) => j > i && l.startsWith(`${m[1]}}`));
      return close < 0 ? null : src.slice(i, close + 1);
    }
    return null;
  };
  const rows = Object.entries(TRANSLATIONS_CHECKS);
  assert.equal(rows.length, 17);
  for (const [code, row] of rows) {
    const m = /^src\/translations\/index\.mjs (\S+) > (\S+)$/.exec(row.where);
    assert.ok(m, `${code}: ${row.where}`);
    const b = body(m[1]);
    assert.ok(b, `${code}: no function ${m[1]}`);
    /* every region of that name in the function (a function may hold several of one name) */
    const inside = [];
    let opened = false, regions = 0;
    for (const l of b) {
      if (l.includes(`/* END DEC-49 REGION ${m[2]} */`)) { opened = false; continue; }
      if (l.includes(`/* DEC-49 REGION ${m[2]} */`)) { opened = true; regions += 1; continue; }
      if (opened) inside.push(l);
    }
    assert.ok(regions >= 1 && !opened, `${code}: ${m[1]} holds no closed region ${m[2]}`);
    /* the code is raised inside its region, by its own name */
    assert.ok(inside.some((l) => l.includes(`"${code}"`)), `${code}: not raised inside ${m[2]}`);
    assert.equal(row.translation, wordOf(`refusal.${code}`, code === "TRANSLATION_TEXT_REFUSED" ? { name: "{name}" } : {}), code);
  }
  const numbers = rows.map(([, r]) => r.check);
  assert.equal(new Set(numbers).size, numbers.length);
  assert.deepEqual(numbers.filter((n) => /^C-64\.(1[1-9]|2\d)$/.test(n)).length, 15);
  assert.deepEqual(numbers.filter((n) => /^C-64\./.test(n)).concat(numbers.filter((n) => !/^C-64\./.test(n))).sort(),
    ["C-64.11", "C-64.12", "C-64.13", "C-64.14", "C-64.15", "C-64.16", "C-64.17", "C-64.19", "C-64.20", "C-64.21", "C-64.22",
     "C-64.23", "C-64.24", "C-64.25", "C-64.26", "C-64.31", "C-119.12"].sort());
  assert.equal(numbers.includes("C-119.5"), false);
  assert.equal(numbers.includes("C-64.18"), false);
});

/* translations — what the members of a team read the screens in, and who may put words into a language (layer 11).
 * The interface's words as a list; the team's translation of each word into any language, kept by a granted speaker,
 * with every earlier text still readable; the grants that let named members translate; the assistant's drafts, stored as
 * labeled machine work that no member outside the workspace sees; the second check a protected word waits for; the undo;
 * the marks "this translation looks wrong"; the words in a member's language, never blank; and which language a passage
 * is read in. Requirements: build/requirements/translations.md (R1–R20). Built by copy from `instance-setup` (R67–R75,
 * R87; K624, N1084, P6; `build/extraction/translations.md`), its SQL unchanged; `instance-setup`'s copy is deleted in its
 * own job (T50-23).
 *
 * SHAPE (K61, R12). `translationsOf(ctx, deps)` answers the one instance for a Durable Object's storage. `deps` is read
 * on the first call: `record`, `membership`, `aiAccounts`, `jurisdictions` and `now`, each defaulting to the module's own
 * factory on the same `ctx`. At its creation it creates its seven tables and declares them to record-core. It calls no
 * later module: the member's own language (`instance-setup` R64) reaches it by the registration of R11. */
import { isLocale, combine as combineProfiles } from "../../../jurisdictions/index.mjs";
import { recordOf } from "../record-core/index.mjs";
import { membershipOf, notAnAdmin, noSuchMember } from "../membership/index.mjs";
import { aiAccountsOf } from "../ai-accounts/index.mjs";
import { normAlias as termFold } from "../extraction/index.mjs";
/* R1: the one row both assistant drafts answer until the model turn lands is wizard-scripts', read there and never copied. */
import { WIZARD_SCRIPTS_CHECKS } from "../wizard-scripts/index.mjs";
/* R1 (K2200, rule 5): a draft translation's label is record-grammar's (its R50); a machine is told apart by its one
   predicate, never by a reading of this module's own. */
import { proposalLabel, isMachineIdentity } from "../record-grammar/index.mjs";
/* R2 (T39, N807): the interface's word list is setup-words' (its R1, R2), read, never copied; every sentence this module
   answers to a member is read by key (R15). */
import { WORD_ROWS, WORDS_COMMIT, localize } from "../setup-words/index.mjs";
import { say, why } from "./words.mjs";
import { TRANSLATIONS_CHECKS } from "./checks.mjs";
import { TRANSLATION_TABLES, TRANSLATION_TABLE_DECLARATIONS, TRANSLATIONS_SCHEMA } from "./schema.mjs";
export { TRANSLATION_TABLES, TRANSLATION_TABLE_DECLARATIONS, TRANSLATIONS_SCHEMA };

/* =====================================================================
 * R2 (DEC-179; K2200 (4); N807): THE INTERFACE'S WORD LIST, setup-words' `WORD_ROWS` in its order, each exported as a
 * frozen `{key, en, note, means, protected}`; this module holds no copy of the list.
 * ===================================================================== */
/* Built once, at the first call, never at import (fix round 7 G84, K4753: the plane's top level is budgeted). */
let wordList = null;
export const interfaceWords = () => (wordList ??= Object.freeze(WORD_ROWS.map(([key, en, note, means, prot]) =>
  Object.freeze({ key, en, note, means, protected: prot }))));
export const INTERFACE_WORDS_COMMIT = WORDS_COMMIT;
let byKey = null;
const wordByKey = () => (byKey ??= new Map(interfaceWords().map((w) => [w.key, w])));
/* R1 (K2201): at most this many words a draft; R4: a kept word's bounds; R7: a mark's note. */
export const TRANSLATION_DRAFT_MAX = 100;
export const TRANSLATION_TEXT_MAX = 2000;
export const TRANSLATION_NOTE_MAX = 500;
/* R1, R4: the assistant's stamp on what it drafts (record-grammar R50 reads it as machine work). */
export const TRANSLATION_DRAFTER = "class:ai";
/* A text's placeholders, `{name}`, as a sorted list, so two texts carry the same ones exactly when the lists are equal. */
const placeholdersOf = (t) => [...String(t).matchAll(/\{([^{}\s]+)\}/g)].map((m) => m[1]).sort();
const samePlaceholders = (a, b) => JSON.stringify(placeholdersOf(a)) === JSON.stringify(placeholdersOf(b));
/* One line: no control character and no line or paragraph separator. */
const oneLine = (t) => !/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/.test(t);
/* A language tag in its canonical form, so `pt-br` and `pt-BR` are one language; the tag as given when it has none. */
const canonicalTag = (t) => { try { return Intl.getCanonicalLocales(t)[0] || t; } catch { return t; } };
/* The SHA-256 of a text's bytes, in hex: what a reading back into English records of the text it read (R1, R5). */
async function sha256Hex(text) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(text)));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const refusal = (code, detail, extra) => {
  const row = TRANSLATIONS_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
};
/* R1: a refusal in one of wizard-scripts' rows (`ASSISTANT_DRAFT_UNAVAILABLE`), with its check and translation as that
   module holds them. */
const scriptRefusal = (code, detail) => {
  const row = WIZARD_SCRIPTS_CHECKS[code] || {};
  return { ok: false, reason: code, code, check: row.check ?? null, translation: row.translation ?? null, detail };
};
const draftUnavailable = (detail) => scriptRefusal("ASSISTANT_DRAFT_UNAVAILABLE", detail);
/* R1 (T40: N812, K2373): a draft carries no project. The door resolves the account for a draft with no project
   (`credentials` R56, `store-door` R10), so an account it hands in that is a project's (`level: "project"`, or naming a
   `project`) serves no draft here: `{project: true}`, and nothing is drafted. Otherwise the account handed on is the
   door's `{kind, level}` as given, never carrying a project. */
const draftAccount = (assistant) => {
  const a = assistant && typeof assistant === "object" ? assistant.account ?? null : null;
  if (!a || typeof a !== "object") return { account: null };
  if (a.level === "project" || (a.project !== undefined && a.project !== null)) return { project: true };
  const { project: _none, ...account } = a;
  return { account };
};
const projectAccount = (what) => draftUnavailable(localize("translations.index.a_draft_carries_no_project", "a draft carries no project, and the account resolved for this one is a project's, so nothing was drafted and {what}.", { what: String(what) }));

/* =====================================================================
 * THE MODULE ON ONE DURABLE OBJECT'S STORAGE (K61, R12): `translationsOf(ctx, deps)`.
 * ===================================================================== */
export class Translations {
  #ctx; #deps; #sql; #declared = false; #memberLanguageRead = null;

  constructor(ctx, deps = {}) {
    this.#ctx = ctx;
    this.#deps = deps || {};
    this.#sql = (ctx && ctx.storage ? ctx.storage : ctx).sql;
  }

  #record() { return this.#deps.record ?? recordOf(this.#ctx); }
  #membership() { return this.#deps.membership ?? membershipOf(this.#ctx); }
  /* R1 (T48; ai-accounts R7): whether the team keeps its material away from AI is `ai-accounts`', read there. */
  #aiAccounts() { return this.#deps.aiAccounts ?? aiAccountsOf(this.#ctx, { record: this.#record(), membership: this.#membership() }); }
  #juris() { return this.#deps.jurisdictions ?? { combine: combineProfiles }; }
  #now() { return this.#deps.now ? this.#deps.now() : Date.now(); }
  #iso() { return new Date(this.#now()).toISOString(); }

  #rows(q, ...a) { return [...this.#sql.exec(q, ...a)]; }
  #one(q, ...a) { const r = this.#rows(q, ...a); return r.length ? r[0] : null; }
  /* The active profiles' ids, as record-core's setting `jurisdiction_profiles` holds them (its R26). */
  #activeIds() {
    const set = this.#record().getSetting("jurisdiction_profiles");
    return Array.isArray(set) ? set.filter((x) => typeof x === "string") : [];
  }

  /* ---- creation (R12) ---- */

  /** R12: this module's tables, idempotent (`CREATE TABLE IF NOT EXISTS`, the DDL `instance-setup` creates today, so a
   *  running store keeps its rows with no data move), declared to record-core as R9 says. */
  migrate() {
    const bare = TRANSLATIONS_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
    for (const stmt of bare.split(";").map((x) => x.trim()).filter(Boolean)) this.#sql.exec(stmt);
    this.#declare();
  }

  /* R9: the seven tables declared to record-core, once, every one exempt from purge. While `instance-setup` still
     declares them under its own name (the copy window, T50-22 to T50-23), record-core refuses the batch as
     `TABLE_DECLARED` by it, and they are held: the same classes, declared once. Any other refusal throws, naming the
     table, before the caller gets an instance. A record with no declaration (a test's stand-in) is left alone. */
  #declare() {
    const core = this.#record();
    if (this.#declared || !core || typeof core.declareTable !== "function") return;
    const answer = core.declareTable("translations", TRANSLATION_TABLE_DECLARATIONS.map((t) => ({ ...t })));
    if (answer && answer.ok === false && !(answer.reason === "TABLE_DECLARED" && answer.declaredBy === "instance-setup"))
      throw new Error(`translations: record-core refused its table declaration: ${answer.reason} (${answer.table})`);
    this.#declared = true;
  }

  /* ---- how the member's own language reaches this module (R11) ---- */

  /** R11: the later module that holds the language a member chose for the screens (`instance-setup` R64) registers,
   *  once at its start, `read({viewer})`, answering `{ok, language, set_at}` as its `memberLanguage` does. A `read` that
   *  is not a function is refused `PROVIDER_MALFORMED`, a second registration `PROVIDER_DECLARED`, each registering
   *  nothing (`public-read` R34's pattern). */
  registerMemberLanguageRead(read) {
    if (typeof read !== "function")
      return { ok: false, reason: "PROVIDER_MALFORMED",
               detail: localize("translations.index.the_member_language_source_is_a_function", "the member's language source is registered as a function that takes the viewer. Nothing was registered.") };
    if (this.#memberLanguageRead)
      return { ok: false, reason: "PROVIDER_DECLARED",
               detail: localize("translations.index.the_member_language_source_is_registered", "the member's language source is already registered, so the first stands. Nothing was registered.") };
    this.#memberLanguageRead = read;
    return { ok: true };
  }

  /* R8, R10: the language `who` chose for the screens, as the registered read answers it, else null: none registered, a
     read that throws, answers no object or no tag. Never throws. */
  #ownLanguage(who) {
    const read = this.#memberLanguageRead;
    if (!read) return null;
    try {
      const a = read({ viewer: who });
      return a && typeof a === "object" && typeof a.language === "string" ? a.language : null;
    } catch { return null; }
  }

  /* R1 (T37; N765, K231, K2201; T48, N996): `ai-accounts.aiKeptAway()` (its R7) as given: null while the team does not keep
     its material away, otherwise that service's one `AI_KEPT_AWAY` refusal with its row and `keep_away: {reason, set_by,
     set_at}`. This module holds no copy of the condition and no row of its own for it. A provider that throws, which
     ai-accounts says it never does, is the store's silence, never an open gate. Writes nothing. */
  #assistantGate() {
    try { return this.#aiAccounts().aiKeptAway(); }
    catch (e) {
      return { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER",
               detail: localize("translations.index.whether_your_team_keeps_its", "whether your team keeps its material away from every assistant did not answer ({String}), so no ask is put to an assistant and no run starts.", { String: String(String(e && e.message || e)
                 .slice(0, 160)) }) };
    }
  }

  /* =====================================================================
   * THE GROUP'S TRANSLATION OF THE INTERFACE (R1–R9; T37-30; N669; DEC-127 (1), (2), (5), DEC-157, DEC-179; K1793, K2200,
   * K2201, K2216). An administrator grants named members a language (R3); the assistant drafts the words a language lacks,
   * each stored as labeled machine work (R1), or a granted member types one; a granted member keeps it (R4). A protected
   * word (DEC-179 (4)) kept as the assistant drafted it shows at once; changed from the draft, or typed without one, it
   * waits for a second check (R5): another granted member, or an administrator who has read it back into English. Every
   * adoption records what it replaced, and an administrator undoes the latest act in one act (R6); any member may mark a
   * shown word "looks wrong" (R7). Members read the screens word by word in their language, the English wherever no
   * translation is shown (R8). Every table is append-only and nothing here leaves your team's Civicsmith (R9).
   *
   * A word's history in a language is one numbered sequence of acts (`act_n`), adoptions and undos alike: the latest
   * act decides which adoption the word shows now (an adoption shows itself; an undo shows its `to_adoption`, null
   * for the English). An adoption's state is what it was kept as, `awaiting` until a confirmation stands beside it.
   * ===================================================================== */

  /* Who someone is, by value, beside their id (R9): their handle, or the id itself for the founder. */
  #nameOf(id) {
    try { const f = this.#membership().memberFacts?.(id); if (f && typeof f.handle === "string" && f.handle) return f.handle; }
    catch { /* the id stands */ }
    return id;
  }
  /* An active member: an administrator (the founder included), or a member whose status is `active`. */
  #isActiveMember(id) {
    if (typeof id !== "string" || !id) return false;
    try {
      if (this.#membership().isAdministrator(id) === true) return true;
      const f = this.#membership().memberFacts?.(id);
      return !!f && f.status === "active";
    } catch { return false; }
  }
  #isAdmin(id) {
    try { return typeof id === "string" && !!id && this.#membership().isAdministrator(id) === true; } catch { return false; }
  }

  /* Every act here: a person, never a machine (record-grammar R50: machine work can draft and never adopt or confirm). */
  #translationActor(by) {
    const who = typeof by === "string" ? by.trim() : "";
    /* DEC-49 REGION is-translation-actor */
    if (!who || isMachineIdentity(who))
      return refusal("MACHINE_CANNOT_TRANSLATE", localize("translations.index.translating_the_screens_is_a", "translating the screens is a member's own act, from their own signed-in session. Nothing was changed."), { by: by ?? null });
    /* END DEC-49 REGION is-translation-actor */
    return null;
  }
  /* A tag `jurisdictions.isLocale` accepts (its R37), answered in its canonical form, or R1's refusal. */
  #translationLanguage(language) {
    const tag = typeof language === "string" ? language.trim() : "";
    /* DEC-49 REGION is-translation-language */
    if (!isLocale(tag))
      return { refused: refusal("LANGUAGE_MALFORMED", tag
        ? localize("translations.index.tag_is_not_a_well_formed_language_tag", "'{tag}' is not one well-formed BCP 47 language tag (en, es, zh-Hant). Nothing was changed.", { tag: tag.slice(0, 40) })
        : localize("translations.index.no_language_named_for_a_tag", "the request names no language, and a language is named by one well-formed BCP 47 language tag (en, es, zh-Hant). Nothing was changed.")) };
    /* END DEC-49 REGION is-translation-language */
    return { tag: canonicalTag(tag) };
  }
  /* R2: a word of the list by its key, or NO_SUCH_WORD. */
  #translationWord(key) {
    const k = typeof key === "string" ? key.trim() : "";
    const w = wordByKey().get(k);
    /* DEC-49 REGION is-translation-word */
    if (!w)
      return { refused: refusal("NO_SUCH_WORD", k
        ? localize("translations.index.key_is_not_a_word_key", "'{key}' is not a key of the interface's word list. Nothing was changed.", { key: k.slice(0, 80) })
        : localize("translations.index.no_word_named_for_a_key", "the request names no word, and a word is named by a key of the interface's word list. Nothing was changed."), { key: k || null }) };
    /* END DEC-49 REGION is-translation-word */
    return { word: w };
  }

  /** R3: whether `member` is a granted speaker of `language`: an administrator, or a member holding a live grant
   *  (granted, not revoked since, and the member active). In-process, for R1 and R4–R8. Never throws. */
  translationGranted({ member = null, language = null } = {}) {
    try {
      const who = typeof member === "string" ? member.trim() : "";
      const tag = typeof language === "string" && isLocale(language.trim()) ? canonicalTag(language.trim()) : null;
      if (!who || !tag || isMachineIdentity(who)) return false;
      if (this.#isAdmin(who)) return true;
      return this.#liveGrant(who, tag) && this.#isActiveMember(who);
    } catch { return false; }
  }
  #liveGrant(member, tag) {
    const r = this.#one(`SELECT act FROM translation_grants WHERE member = ? AND language = ? ORDER BY seq DESC LIMIT 1`, member, tag);
    return !!r && r.act === "grant";
  }
  /* R3's NO_SUCH_MEMBER (and R7's "any active member"): `who` is an active member of the team, else membership's one
     refusal for that condition (its R121, C-96.47; N793), `member` the id asked. This module mints no copy of the code. */
  #translationMember(who) {
    if (!who || isMachineIdentity(who) || !this.#isActiveMember(who)) return noSuchMember(who || null);
    return null;
  }
  #translationSpeaker(by, tag) {
    /* DEC-49 REGION is-translation-speaker */
    if (!this.translationGranted({ member: by, language: tag }))
      return refusal("TRANSLATION_NOT_GRANTED", localize("translations.index.working_on_the_words_of", "working on the words of {tag} is for the administrators and the members an administrator has asked to translate it. Nothing was changed.", { tag: String(tag) }), { by, language: tag });
    /* END DEC-49 REGION is-translation-speaker */
    return null;
  }

  /** R3, op=translationgrant: an administrator grants a named active member the right to translate the interface into
   *  `language`, or revokes it (`revoke: true`). A second grant of a live grant, or a second revocation, answers
   *  `existed: true` with the first. Append-only. */
  translationGrant({ member = null, language = null, revoke = false, by = null } = {}) {
    const machine = this.#translationActor(by);
    if (machine) return machine;
    if (!this.#isAdmin(by)) return notAnAdmin(by ?? null, localize("translations.index.asking_a_member_to_translate", "asking a member to translate the screens"));
    const lang = this.#translationLanguage(language);
    if (lang.refused) return lang.refused;
    const who = typeof member === "string" ? member.trim() : "";
    const notMember = this.#translationMember(who);
    if (notMember) return notMember;
    const act = revoke === true ? "revoke" : "grant";
    const rows = this.#rows(`SELECT seq, act, by_member, by_name, at FROM translation_grants WHERE member = ? AND language = ?
                             ORDER BY seq`, who, lang.tag);
    const last = rows.length ? rows[rows.length - 1] : null;
    const already = act === "grant" ? !!last && last.act === "grant" : !last || last.act === "revoke";
    if (already) {
      /* The first of the run of like acts that stands now (or, for a revocation with no grant ever, nothing). */
      let i = rows.length - 1;
      while (i > 0 && rows[i - 1].act === act) i -= 1;
      const first = rows[i] && rows[i].act === act ? rows[i] : null;
      return { ok: true, existed: true, member: who, language: lang.tag, act,
               ...(first ? { by: first.by_member, by_name: first.by_name, at: first.at } : {}),
               granted: this.translationGranted({ member: who, language: lang.tag }) };
    }
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO translation_grants (member, member_name, language, act, by_member, by_name, at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`, who, this.#nameOf(who), lang.tag, act, by, this.#nameOf(by), at);
    return { ok: true, existed: false, member: who, language: lang.tag, act, by, at,
             granted: this.translationGranted({ member: who, language: lang.tag }) };
  }

  /* ---- a word's state in a language ---- */

  /* The word's acts in `tag`: its adoptions, undos and confirmed adoptions, and what it shows now. */
  #wordHistory(tag, key) {
    const adoptions = this.#rows(`SELECT * FROM translation_adoptions WHERE language = ? AND key = ? ORDER BY act_n`, tag, key);
    const undos = this.#rows(`SELECT * FROM translation_undos WHERE language = ? AND key = ? ORDER BY act_n`, tag, key);
    const confirmed = new Set(this.#rows(`SELECT adoption FROM translation_confirmations WHERE language = ? AND key = ?`, tag, key)
      .map((r) => r.adoption));
    return Translations.#current(adoptions, undos, confirmed);
  }
  /* From a word's acts: the latest act, the adoption shown now (or null, the English) and its state. */
  static #current(adoptions, undos, confirmed) {
    const lastA = adoptions.length ? adoptions[adoptions.length - 1] : null;
    const lastU = undos.length ? undos[undos.length - 1] : null;
    const latest = !lastA && !lastU ? null
      : !lastU || (lastA && lastA.act_n > lastU.act_n) ? { kind: "adoption", row: lastA } : { kind: "undo", row: lastU };
    const shownSeq = !latest ? null : latest.kind === "adoption" ? latest.row.seq : latest.row.to_adoption;
    const adoption = shownSeq == null ? null : adoptions.find((a) => a.seq === shownSeq) || null;
    const state = !adoption ? "missing" : adoption.state === "shown" || confirmed.has(adoption.seq) ? "shown" : "awaiting";
    const actN = Math.max(lastA ? lastA.act_n : 0, lastU ? lastU.act_n : 0);
    return { adoptions, undos, confirmed, latest, adoption, state, actN };
  }
  #translationAwaiting(tag, entry) {
    const h = this.#wordHistory(tag, entry.key);
    /* DEC-49 REGION is-translation-awaiting */
    if (h.state !== "awaiting")
      return { refused: refusal("TRANSLATION_NOT_AWAITING", localize("translations.index.key_is_v1_in_tag", "{key} is {v1} in {tag}, so it is not waiting for a second check. Nothing was changed.", { key: String(entry.key), v1: String(h.state === "missing" ? "not translated" : "shown"), tag: String(tag) }), { key: entry.key, language: tag, state: h.state }) };
    /* END DEC-49 REGION is-translation-awaiting */
    return { history: h };
  }

  /* R8: the active profiles' local names (jurisdictions R4, R6), each with its explanation and official translation
     in `tag` when held. Never a word to draft, adopt or translate (DEC-157 (6)). */
  #localNames(tag) {
    const ids = this.#activeIds();
    if (!ids.length) return [];
    let combined = null;
    try { combined = this.#juris().combine(ids); } catch { combined = null; }
    const list = combined && combined.ok === true && combined.view && Array.isArray(combined.view.local_names)
      ? combined.view.local_names : [];
    const inTag = (xs) => (Array.isArray(xs) ? xs : []).find((x) => x && typeof x.locale === "string" && canonicalTag(x.locale) === tag) || null;
    return list.map((n) => {
      const ex = inTag(n.explanations), tr = inTag(n.translations);
      return { name: n.name, kind: n.kind, explanation: ex ? ex.text : null,
               translation: tr ? { text: tr.text, source: tr.source ?? null } : null, basis: n.basis ?? null };
    });
  }
  /* R1 (DEC-157 (6)): the local name a word's English is, if any (folded as extraction's term fold, exactly). */
  static #officialFor(entry, names) {
    const en = termFold(entry.en);
    return en ? names.find((n) => typeof n.name === "string" && termFold(n.name) === en) || null : null;
  }

  /* R1: the first refusals, shared by `translationdraft` and its record route, and the words the door sends. */
  #draftRequest({ language, direction, keys, key, by }) {
    /* DEC-49 REGION is-translation-draft */
    if (direction !== "to_language" && direction !== "to_english")
      return { refused: refusal("TRANSLATION_DIRECTION_UNKNOWN", `the direction is to_language or to_english, and `
        + `${direction === undefined || direction === null ? "none was given" : `'${String(direction).slice(0, 40)}' is neither`}. `
        + "Nothing was sent.", { direction: direction ?? null }) };
    /* END DEC-49 REGION is-translation-draft */
    const lang = this.#translationLanguage(language);
    if (lang.refused) return lang;
    const machine = this.#translationActor(by);
    if (machine) return { refused: machine };
    const tag = lang.tag;
    if (direction === "to_english") {
      if (!this.#isAdmin(by))
        return { refused: notAnAdmin(by ?? null, say("setup.refused.asking_assistant_read")) };
      const w = this.#translationWord(key);
      if (w.refused) return w;
      const aw = this.#translationAwaiting(tag, w.word);
      if (aw.refused) return aw;
      const text = aw.history.adoption.text;
      return { direction, tag, key: w.word.key, words: [{ key: w.word.key, en: w.word.en, text, protected: w.word.protected }] };
    }
    const speaker = this.#translationSpeaker(by, tag);
    if (speaker) return { refused: speaker };
    /* DEC-49 REGION is-translation-draft */
    if (keys !== undefined && keys !== null && (!Array.isArray(keys) || keys.length < 1 || keys.length > TRANSLATION_DRAFT_MAX
        || keys.some((k) => typeof k !== "string" || !k.trim()) || new Set(keys.map((k) => k.trim())).size !== keys.length))
      return { refused: refusal("TRANSLATION_KEYS_MALFORMED", localize("translations.index.the_words_to_draft_are", "the words to draft are a list of 1 to {TRANSLATION_DRAFT_MAX} different keys, or none for the first words still missing. Nothing was sent.", { TRANSLATION_DRAFT_MAX: String(TRANSLATION_DRAFT_MAX) })) };
    /* END DEC-49 REGION is-translation-draft */
    const shown = this.#shownAdoptions(tag);
    let asked;
    if (Array.isArray(keys)) {
      asked = [];
      for (const k of keys) {
        const w = this.#translationWord(k);
        if (w.refused) return w;
        /* DEC-49 REGION is-translation-draft */
        if (shown.has(w.word.key))
          return { refused: refusal("TRANSLATION_NOT_MISSING", localize("translations.index.key_already_has_a_kept", "{key} already has a kept translation in {tag}, so the assistant does not draft it. Nothing was sent.", { key: String(w.word.key), tag: String(tag) }), { key: w.word.key, language: tag }) };
        /* END DEC-49 REGION is-translation-draft */
        asked.push(w.word);
      }
    } else {
      asked = interfaceWords().filter((w) => !shown.has(w.key));
    }
    const names = this.#localNames(tag);
    const offered_official = [], words = [];
    for (const w of asked) {
      if (!Array.isArray(keys) && words.length >= TRANSLATION_DRAFT_MAX) break;
      const n = Translations.#officialFor(w, names);
      if (n) { offered_official.push({ key: w.key, ...n }); continue; }
      words.push({ key: w.key, en: w.en, note: w.note, means: w.means, protected: w.protected });
    }
    /* DEC-49 REGION is-translation-draft */
    if (!words.length)
      return { refused: refusal("TRANSLATION_NOTHING_TO_DRAFT", asked.length
        ? localize("translations.index.every_word_asked_for_is_official", "every word asked for is an official name, shown as it is, in {tag}, so there is nothing to draft. Nothing was sent.", { tag })
        : localize("translations.index.every_word_asked_for_is_translated", "every word asked for is translated already in {tag}, so there is nothing to draft. Nothing was sent.", { tag }),
        { language: tag, offered_official }) };
    /* END DEC-49 REGION is-translation-draft */
    return { direction, tag, words, offered_official };
  }
  /* The keys that have an adoption standing now in `tag` (shown or awaiting): a word that is not `missing`. */
  #shownAdoptions(tag) {
    const out = new Set();
    for (const { key, adoptions, undos } of this.#languageHistories(tag)) {
      const h = Translations.#current(adoptions, undos, new Set());
      if (h.adoption) out.add(key);
    }
    return out;
  }
  /* Every word's acts in `tag`, read once, grouped by key. */
  #languageHistories(tag) {
    const by = new Map();
    const at = (k) => { if (!by.has(k)) by.set(k, { key: k, adoptions: [], undos: [], confirmations: [], drafts: [], marks: [] }); return by.get(k); };
    for (const r of this.#rows(`SELECT * FROM translation_adoptions WHERE language = ? ORDER BY act_n`, tag)) at(r.key).adoptions.push(r);
    for (const r of this.#rows(`SELECT * FROM translation_undos WHERE language = ? ORDER BY act_n`, tag)) at(r.key).undos.push(r);
    for (const r of this.#rows(`SELECT * FROM translation_confirmations WHERE language = ? ORDER BY seq`, tag)) at(r.key).confirmations.push(r);
    for (const r of this.#rows(`SELECT * FROM translation_drafts WHERE language = ? ORDER BY seq`, tag)) at(r.key).drafts.push(r);
    for (const r of this.#rows(`SELECT * FROM translation_marks WHERE language = ? ORDER BY seq`, tag)) at(r.key).marks.push(r);
    return [...by.values()];
  }

  /** R1 (K2238), in-process: null, or R1's first refusal (the direction, the tag, a machine, `TRANSLATION_NOT_GRANTED`
   *  or `NOT_AN_ADMIN`, the word, the keys, not missing or not awaiting, nothing left to draft), each code minted here
   *  alone (K231). store-door's route asks it before its own gate (its R10). Writes nothing; never throws. */
  translationDraftRefusal({ language = null, direction = undefined, keys = undefined, key = null, by = null } = {}) {
    try {
      const req = this.#draftRequest({ language, direction, keys, key, by });
      return req.refused || null;
    } catch (e) {
      return { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER",
               detail: localize("translations.index.the_words_to_draft_could", "the words to draft could not be read ({String}). Nothing was sent.", { String: String(String(e && e.message || e).slice(0, 160)) }) };
    }
  }

  /** R1, op=translationdraft, which the door routes and calls here (store-door R10; control-plane R57's third draft):
   *  the first refusals (as `translationDraftRefusal`), then R55's gate, then, as the other two drafts do (K2238),
   *  `ASSISTANT_DRAFT_UNAVAILABLE` carrying the words the door sends to agent-worker's `/draft`, the signal it drafts
   *  on: `{key, en, note, means, protected}` for each word to draft (`to_language`, with `offered_official`), or the one
   *  kept word's `{key, en, text, protected}` (`to_english`). Writes nothing: the door hands the answered draft to
   *  `translationdraftrecord`. `assistant` is the door's `{on, account}`; a draft carries no project (T40), so a
   *  project's account handed in answers ASSISTANT_DRAFT_UNAVAILABLE with no words, nothing to draft on. The door's
   *  NO_ACCOUNT (credentials', K2577), AI_USE_SWITCHED_OFF and AI_LIMIT_REACHED are answered there, never minted here. */
  translationDraft({ language = null, direction = undefined, keys = undefined, key = null, assistant = null, by = null } = {}) {
    const req = this.#draftRequest({ language, direction, keys, key, by });
    if (req.refused) return req.refused;
    const off = this.#assistantGate();
    if (off) return off;
    if (draftAccount(assistant).project) return projectAccount("nothing is sent");
    const out = draftUnavailable(localize("translations.index.the_draft_is_asked_by_the_door", "the door asks the assistant for the draft with these words. Nothing is drafted or saved here."));
    return req.direction === "to_english"
      ? { ...out, direction: req.direction, language: req.tag, key: req.key, words: req.words }
      : { ...out, direction: req.direction, language: req.tag, words: req.words, offered_official: req.offered_official };
  }

  /** R1, the store-internal route `translationdraftrecord` (no spec): the door hands back the answered draft
   *  (`draft`, agent-worker R4's: `{words: [{key, text}]}` or `{key, english}`) with the request's `language`,
   *  `direction` and `keys` or `key`, and `words` as `translationdraft` answered them. The first refusals are asked
   *  again, so a hand-back that no longer stands records nothing. `to_language`: each asked word answered is stored as
   *  a draft labeled machine work (record-grammar R50), with who asked and when, unless its placeholders differ from
   *  its English's or it is no one-line text within bounds (named in `not_drafted`). `to_english`: the reading's fact is
   *  recorded (K2216: key, language, the SHA-256 of the kept text read, the administrator, the instant), no text. */
  async translationDraftRecord({ language = null, direction = undefined, keys = undefined, key = null, words = null,
                                 draft = null, not_drafted = null, by = null } = {}) {
    const asked = direction === "to_language" && (keys === undefined || keys === null) && Array.isArray(words)
      ? words.map((w) => (w && typeof w.key === "string" ? w.key : null)).filter(Boolean) : keys;
    const req = this.#draftRequest({ language, direction, keys: asked, key, by });
    if (req.refused) return req.refused;
    const unavailable = (why) => draftUnavailable(localize("translations.index.why_nothing_was_saved", "{why} Nothing was saved.", { why: String(why) }));
    const at = this.#iso();
    const askedBy = this.#nameOf(by);
    if (req.direction === "to_english") {
      if (!draft || typeof draft !== "object" || draft.key !== req.key || typeof draft.english !== "string" || !draft.english.trim())
        return unavailable(localize("translations.index.the_assistant_did_not_answer", "the assistant did not answer a reading of this word back into English."));
      const sent = Array.isArray(words) && words[0] && words[0].key === req.key && typeof words[0].text === "string"
        ? words[0].text : req.words[0].text;
      this.#sql.exec(`INSERT INTO translation_readings (language, key, text_sha256, by_member, by_name, at) VALUES (?, ?, ?, ?, ?, ?)`,
                     req.tag, req.key, await sha256Hex(sent), by, askedBy, at);
      return { ok: true, key: req.key, language: req.tag, english: draft.english,
               label: { kind: "machine", asked_by: askedBy },
               note: say("setup.note.machine_work_reading") };
    }
    const got = draft && typeof draft === "object" && Array.isArray(draft.words) ? draft.words : null;
    if (!got) return unavailable(localize("translations.index.the_assistant_did_not_answer_2", "the assistant did not answer a draft of these words."));
    const label = proposalLabel(TRANSLATION_DRAFTER, "translation");
    const drafted = [], refusedHere = [];
    const answered = new Map();
    for (const d of got) if (d && typeof d.key === "string" && !answered.has(d.key)) answered.set(d.key, d.text);
    for (const w of req.words) {
      if (!answered.has(w.key)) { refusedHere.push({ key: w.key, why: why("translations.not_drafted.not_answered") }); continue; }
      const text = answered.get(w.key);
      if (typeof text !== "string" || !text.trim() || [...text].length > TRANSLATION_TEXT_MAX || !oneLine(text)) {
        refusedHere.push({ key: w.key, why: why("translations.not_drafted.not_one_line", { max: TRANSLATION_TEXT_MAX }) });
        continue;
      }
      if (!samePlaceholders(text, w.en)) {
        refusedHere.push({ key: w.key, why: why("translations.not_drafted.placeholders_differ") });
        continue;
      }
      const r = this.#rows(`INSERT INTO translation_drafts (language, key, en, text, label, asked_by, asked_name, at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?) RETURNING seq`, req.tag, w.key, w.en, text, JSON.stringify(label), by, askedBy, at);
      drafted.push({ id: r[0].seq, key: w.key, text, label, asked_by: askedBy, at });
    }
    const theirs = (Array.isArray(not_drafted) ? not_drafted : []).map((x) => (typeof x === "string" ? x : x && x.key))
      .filter((k) => typeof k === "string" && req.words.some((w) => w.key === k));
    for (const r of refusedHere) if (theirs.includes(r.key)) r.why = why("setup.why.assistant_draft");
    return { ok: true, language: req.tag, drafted, not_drafted: refusedHere, offered_official: req.offered_official,
             note: say("setup.note.drafts_labeled_machine") };
  }

  /** R4, op=translationadopt: a granted speaker keeps a word's translation, typed or from a stored draft. */
  translationAdopt({ language = null, key = null, text = undefined, draft = null, by = null } = {}) {
    const machine = this.#translationActor(by);
    if (machine) return machine;
    const lang = this.#translationLanguage(language);
    if (lang.refused) return lang.refused;
    const tag = lang.tag;
    const speaker = this.#translationSpeaker(by, tag);
    if (speaker) return speaker;
    const w = this.#translationWord(key);
    if (w.refused) return w.refused;
    const entry = w.word;
    let d = null;
    if (draft !== null && draft !== undefined) {
      const id = typeof draft === "number" ? draft : typeof draft === "string" && /^\d+$/.test(draft.trim()) ? Number(draft.trim()) : NaN;
      d = Number.isSafeInteger(id) ? this.#one(`SELECT seq, text FROM translation_drafts WHERE seq = ? AND language = ? AND key = ?`, id, tag, entry.key) : null;
      /* DEC-49 REGION is-translation-adopt */
      if (!d)
        return refusal("NO_SUCH_DRAFT", localize("translations.index.there_is_no_stored_draft", "there is no stored draft {String} of {key} in {tag}. Nothing was changed.", { String: String(String(draft).slice(0, 40)), key: String(entry.key), tag: String(tag) }), { key: entry.key, language: tag, draft });
      /* END DEC-49 REGION is-translation-adopt */
    }
    /* DEC-49 REGION is-translation-adopt */
    if (typeof text !== "string" || !text.trim() || [...text].length > TRANSLATION_TEXT_MAX || !oneLine(text)
        || !samePlaceholders(text, entry.en))
      return refusal("TRANSLATION_TEXT_REFUSED", typeof text === "string" && text.trim() && [...text].length <= TRANSLATION_TEXT_MAX && oneLine(text)
        ? localize("translations.index.the_texts_placeholders_v1_differ", "the text's placeholders ({v1}) differ from the English's ({v2}). Nothing was changed.", { v1: String(placeholdersOf(text).map((x) => `{${x}}`).join(", ") || "none"), v2: String(placeholdersOf(entry.en).map((x) => `{${x}}`).join(", ") || "none") })
        : localize("translations.index.a_translated_word_is_one", "a translated word is one line of 1 to {TRANSLATION_TEXT_MAX} characters. Nothing was changed.", { TRANSLATION_TEXT_MAX: String(TRANSLATION_TEXT_MAX) }), { key: entry.key, language: tag });
    /* END DEC-49 REGION is-translation-adopt */
    const h = this.#wordHistory(tag, entry.key);
    /* DEC-157 (3), (4); K2200 (1): an ordinary word shows once kept; a protected one only when kept exactly as drafted. */
    const state = !entry.protected || (d && text === d.text) ? "shown" : "awaiting";
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO translation_adoptions (language, key, act_n, text, en, state, draft, prev, replaced, by_member, by_name, at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, tag, entry.key, h.actN + 1, text, entry.en, state, d ? d.seq : null,
                   h.adoption ? h.adoption.seq : null, h.adoption ? h.adoption.text : null, by, this.#nameOf(by), at);
    return { ok: true, language: tag, key: entry.key, state, replaced: h.adoption ? h.adoption.text : null, at,
             note: state === "shown" ? say("setup.note.member_reading_language") : say("setup.note.protected_word_changed") };
  }

  /** R5, op=translationconfirm: an awaiting protected word confirmed, then shown: by a granted speaker who did not keep
   *  it, or by an administrator holding a reading of its current text back into English (K2216). An administrator who
   *  holds a grant of the language and did not keep the word is a second granted speaker and needs no reading. */
  async translationConfirm({ language = null, key = null, by = null } = {}) {
    const machine = this.#translationActor(by);
    if (machine) return machine;
    const lang = this.#translationLanguage(language);
    if (lang.refused) return lang.refused;
    const tag = lang.tag;
    const speaker = this.#translationSpeaker(by, tag);
    if (speaker) return speaker;
    const w = this.#translationWord(key);
    if (w.refused) return w.refused;
    const aw = this.#translationAwaiting(tag, w.word);
    if (aw.refused) return aw.refused;
    const adoption = aw.history.adoption;
    const admin = this.#isAdmin(by);
    const self = adoption.by_member === by;
    /* DEC-49 REGION is-translation-confirm */
    if (self && !admin)
      return refusal("TRANSLATION_CONFIRM_SELF", localize("translations.index.you_kept_this_translation_of", "you kept this translation of {key}, so its second check is someone else's. Nothing was changed.", { key: String(w.word.key) }), { key: w.word.key, language: tag });
    /* END DEC-49 REGION is-translation-confirm */
    const secondSpeaker = !self && this.#liveGrant(by, tag) && this.#isActiveMember(by);
    let readBack = null;
    if (!secondSpeaker) {
      const sha = await sha256Hex(adoption.text);
      readBack = this.#one(`SELECT seq FROM translation_readings WHERE language = ? AND key = ? AND by_member = ? AND text_sha256 = ?
                            ORDER BY seq DESC LIMIT 1`, tag, w.word.key, by, sha);
      /* DEC-49 REGION is-translation-confirm */
      if (!readBack)
        return refusal("TRANSLATION_NOT_READ_BACK", localize("translations.index.key_has_not_been_read", "{key} has not been read back into English for its current text in {tag}. Read it back into English first, then confirm. Nothing was changed.", { key: String(w.word.key), tag: String(tag) }), { key: w.word.key, language: tag });
      /* END DEC-49 REGION is-translation-confirm */
    }
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO translation_confirmations (adoption, language, key, read_back, by_member, by_name, at)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`, adoption.seq, tag, w.word.key, readBack ? readBack.seq : null, by, this.#nameOf(by), at);
    return { ok: true, language: tag, key: w.word.key, state: "shown", confirmed_by: by, at,
             ...(readBack ? { read_back: true } : {}) };
  }

  /** R6, op=translationrevert: an administrator undoes the word's latest act in one act: its latest adoption (back to
   *  what it replaced), or its latest undo (back to the adoption that undo moved from). Appended; nothing changes. */
  translationRevert({ language = null, key = null, by = null } = {}) {
    const machine = this.#translationActor(by);
    if (machine) return machine;
    if (!this.#isAdmin(by)) return notAnAdmin(by ?? null, localize("translations.index.undoing_a_translation_of_the_screens", "undoing a translation of the screens"));
    const lang = this.#translationLanguage(language);
    if (lang.refused) return lang.refused;
    const tag = lang.tag;
    const w = this.#translationWord(key);
    if (w.refused) return w.refused;
    const h = this.#wordHistory(tag, w.word.key);
    /* DEC-49 REGION is-translation-revert */
    if (!h.latest)
      return refusal("TRANSLATION_NOTHING_TO_UNDO", localize("translations.index.key_has_never_been_translated", "{key} has never been translated into {tag}. Nothing was changed.", { key: String(w.word.key), tag: String(tag) }),
        { key: w.word.key, language: tag });
    /* END DEC-49 REGION is-translation-revert */
    const from = h.adoption ? h.adoption.seq : null;
    const to = h.latest.kind === "adoption" ? h.latest.row.prev ?? null : h.latest.row.from_adoption ?? null;
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO translation_undos (language, key, act_n, undoes, undoes_seq, from_adoption, to_adoption, by_member, by_name, at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, tag, w.word.key, h.actN + 1, h.latest.kind, h.latest.row.seq, from, to,
                   by, this.#nameOf(by), at);
    const now = this.#wordHistory(tag, w.word.key);
    return { ok: true, language: tag, key: w.word.key, undid: { kind: h.latest.kind, seq: h.latest.row.seq },
             state: now.state, text: now.adoption ? now.adoption.text : null, at };
  }

  /** R7, op=translationmark: any active member marks a shown translation "this translation looks wrong". Open until
   *  the word's next adoption or undo; a member's second open mark on the word answers `existed: true`. */
  translationMark({ language = null, key = null, note = null, by = null } = {}) {
    const machine = this.#translationActor(by);
    if (machine) return machine;
    const lang = this.#translationLanguage(language);
    if (lang.refused) return lang.refused;
    const tag = lang.tag;
    const w = this.#translationWord(key);
    if (w.refused) return w.refused;
    const h = this.#wordHistory(tag, w.word.key);
    /* DEC-49 REGION is-translation-mark */
    if (h.state !== "shown")
      return refusal("TRANSLATION_NOT_SHOWN", localize("translations.index.key_shows_no_translation_in", "{key} shows no translation in {tag}. Nothing was recorded.", { key: String(w.word.key), tag: String(tag) }),
        { key: w.word.key, language: tag });
    const n = note === null || note === undefined ? null : typeof note === "string" ? note.trim() : undefined;
    if (n === undefined || (n !== null && [...n].length > TRANSLATION_NOTE_MAX))
      return refusal("TRANSLATION_NOTE_REFUSED", localize("translations.index.a_note_is_text_of", "a note is text of at most {TRANSLATION_NOTE_MAX} characters. Nothing was recorded.", { TRANSLATION_NOTE_MAX: String(TRANSLATION_NOTE_MAX) }),
        { key: w.word.key, language: tag });
    /* END DEC-49 REGION is-translation-mark */
    const notMember = this.#translationMember(by);
    if (notMember) return notMember;
    const open = this.#one(`SELECT seq, note, at FROM translation_marks WHERE language = ? AND key = ? AND by_member = ? AND act_n = ?
                            ORDER BY seq LIMIT 1`, tag, w.word.key, by, h.actN);
    if (open) return { ok: true, existed: true, language: tag, key: w.word.key, note: open.note ?? null, at: open.at };
    const at = this.#iso();
    this.#sql.exec(`INSERT INTO translation_marks (language, key, act_n, note, by_member, by_name, at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                   tag, w.word.key, h.actN, n || null, by, this.#nameOf(by), at);
    return { ok: true, existed: false, language: tag, key: w.word.key, note: n || null, at,
             note_for_you: say("setup.note_for_you.members_asked_translate") };
  }

  /** R8, op=translations: the workspace for a granted speaker of `language`: every word in the list's order with its
   *  state, its shown or awaiting text, `english_changed`, its drafts, its acts newest first and its open marks; and
   *  the active profiles' local names, offered first and never a word to translate. Writes nothing; never throws. */
  translations({ language = null, viewer = null } = {}) {
    try {
      const machine = this.#translationActor(viewer);
      if (machine) return machine;
      const lang = this.#translationLanguage(language);
      if (lang.refused) return lang.refused;
      const tag = lang.tag;
      const speaker = this.#translationSpeaker(viewer, tag);
      if (speaker) return speaker;
      const hist = new Map(this.#languageHistories(tag).map((h) => [h.key, h]));
      const counts = { missing: 0, shown: 0, awaiting: 0 };
      const words = interfaceWords().map((w) => {
        const g = hist.get(w.key) || { adoptions: [], undos: [], confirmations: [], drafts: [], marks: [] };
        const c = Translations.#current(g.adoptions, g.undos, new Set(g.confirmations.map((r) => r.adoption)));
        counts[c.state] += 1;
        const a = c.adoption;
        const acts = [
          ...g.adoptions.map((r) => ({ act: "adoption", seq: r.seq, text: r.text, en: r.en, kept_as: r.state, draft: r.draft,
                                       replaced: r.replaced, by: r.by_member, by_name: r.by_name, at: r.at, n: r.act_n })),
          ...g.undos.map((r) => ({ act: "undo", seq: r.seq, undoes: r.undoes, undoes_seq: r.undoes_seq, by: r.by_member,
                                   by_name: r.by_name, at: r.at, n: r.act_n })),
          ...g.confirmations.map((r) => ({ act: "confirmation", seq: r.seq, adoption: r.adoption, read_back: r.read_back !== null,
                                           by: r.by_member, by_name: r.by_name, at: r.at })),
        ].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : (y.n ?? 0) - (x.n ?? 0) || y.seq - x.seq));
        return { key: w.key, en: w.en, note: w.note, means: w.means, protected: w.protected, state: c.state,
                 text: a ? a.text : null, adopted_by: a ? a.by_member : null, adopted_by_name: a ? a.by_name : null,
                 adopted_at: a ? a.at : null, english_changed: c.state === "shown" && !!a && a.en !== w.en,
                 drafts: g.drafts.map((r) => ({ id: r.seq, text: r.text, label: JSON.parse(r.label), asked_by: r.asked_by,
                                                asked_by_name: r.asked_name, at: r.at })).reverse(),
                 acts,
                 marks: g.marks.filter((r) => r.act_n === c.actN).map((r) => ({ note: r.note, by: r.by_member, by_name: r.by_name, at: r.at })) };
      });
      return { ok: true, language: tag, words_commit: INTERFACE_WORDS_COMMIT, counts, local_names: this.#localNames(tag), words };
    } catch (e) {
      return { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER",
               detail: localize("translations.index.the_translation_workspace_could_not", "the translation workspace could not be read ({String}).", { String: String(String(e && e.message || e).slice(0, 160)) }) };
    }
  }

  /** R8, R19, op=interfacewords: the words for `language` (by default the viewer's own, `instance-setup` R64, read through
   *  R11). With no `language` named, only the words the team shows in the viewer's language (`fallback: false`), so with
   *  none held the answer holds no word; with a `language` named (the settings screen's translation read), every word, the
   *  team's shown translation where one is held and the English otherwise (`fallback: true`), never blank, `en` beside it.
   *  An awaiting word is the English. Writes nothing; never throws. */
  interfaceWords({ language = undefined, viewer = null } = {}) {
    const named = language !== undefined && language !== null && language !== "";
    try {
      let tag = null;
      if (named) {
        const lang = this.#translationLanguage(language);
        if (lang.refused) return lang.refused;
        tag = lang.tag;
      } else {
        const own = this.#ownLanguage(viewer);
        tag = typeof own === "string" && isLocale(own) ? canonicalTag(own) : null;
      }
      const shown = new Map();
      if (tag)
        for (const g of this.#languageHistories(tag)) {
          const c = Translations.#current(g.adoptions, g.undos, new Set(g.confirmations.map((r) => r.adoption)));
          if (c.state === "shown") shown.set(g.key, c.adoption.text);
        }
      const word = (w) => (shown.has(w.key)
        ? { key: w.key, text: shown.get(w.key), en: w.en, fallback: false }
        : { key: w.key, text: w.en, en: w.en, fallback: true });
      return { ok: true, language: tag, words_version: this.wordsVersion(), words: named ? interfaceWords().map(word)
        : interfaceWords().filter((w) => shown.has(w.key)).map(word) };
    } catch {
      return { ok: true, language: null, words_version: this.wordsVersion(), words: named ? interfaceWords().map((w) => ({ key: w.key, text: w.en, en: w.en, fallback: true })) : [],
               detail: localize("translations.index.the_teams_translations_could_not", "the team's translations could not be read, so every word is shown in English.") };
    }
  }

  /** R20, in-process: `words_version`, a short string that names no member and no word and changes whenever a translation
   *  of the team is adopted, confirmed or undone (the three tables are append-only, so the highest row number of each
   *  only grows); otherwise the same across requests and isolates, being read from the storage alone. Never throws. */
  wordsVersion() {
    try {
      const top = (t) => this.#one(`SELECT COALESCE(MAX(seq), 0) AS n FROM ${t}`).n;
      return `${top("translation_adoptions")}.${top("translation_confirmations")}.${top("translation_undos")}`;
    } catch { return "0.0.0"; }
  }

  /* =====================================================================
   * THE LANGUAGE A MEMBER READS IN (R10; T48; N670; DEC-127 (1), (3)). The plane's draft door asks which language a
   * passage is read in: the one named, else the member's own (`instance-setup` R64, read through R11), else it says none is set. Writes nothing.
   * ===================================================================== */

  /** R10, in-process: `{ok: true, language, source}`, `language` the tag named when `jurisdictions.isLocale` accepts it
   *  (`source: "named"`; else `LANGUAGE_MALFORMED`, R1's rule), without one the member's own language (`source:
   *  "member"`), and with none set `LANGUAGE_NOT_SET`. Tags are answered in their canonical form. Writes nothing; never
   *  throws. */
  readingLanguage({ member = null, language = undefined } = {}) {
    try {
      if (language !== undefined && language !== null && language !== "") {
        const named = this.#translationLanguage(language);
        if (named.refused) return named.refused;
        return { ok: true, language: named.tag, source: "named" };
      }
      const own = this.#ownLanguage(member);
      const tag = typeof own === "string" && isLocale(own) ? canonicalTag(own) : null;
      /* DEC-49 REGION is-reading-language */
      if (!tag)
      return refusal("LANGUAGE_NOT_SET", typeof member === "string" && member.trim()
        ? localize("translations.index.this_member_has_no_language_chosen", "this member has no language chosen for the screens, and the request names none. Nothing was translated.")
        : localize("translations.index.no_member_and_no_language_named", "the request names no member and no language, so no language for the screens is chosen. Nothing was translated."));
      /* END DEC-49 REGION is-reading-language */
      return { ok: true, language: tag, source: "member" };
    } catch (e) {
      return { ok: false, reason: "STORE_DID_NOT_ANSWER", code: "STORE_DID_NOT_ANSWER",
               detail: localize("translations.index.the_language_could_not_be", "the language could not be read ({String}). Nothing was translated.", { String: String(String(e && e.message || e).slice(0, 160)) }) };
    }
  }}

const INSTANCES = new WeakMap();

/** The one instance of this module for a Durable Object's storage (K61, R12). `deps` is read on the first call only. At
 *  its creation it creates its seven tables and declares them to record-core (`migrate`); a refused declaration throws,
 *  naming the table, before the caller gets an instance. */
export function translationsOf(ctx, deps = {}) {
  const storage = ctx && ctx.storage ? ctx.storage : ctx;
  let m = INSTANCES.get(storage);
  if (!m) {
    m = new Translations(ctx, deps);
    m.migrate();
    INSTANCES.set(storage, m);
  }
  return m;
}

/** This module's Durable Object routes (R12; the `membershipOps` pattern). The stamps (`by`, `viewer`) are the control
 *  plane's, read from the query AFTER the body is spread, so a body naming its own is overwritten (R14). The map joins
 *  `control-plane`'s one route map; `translationdraftrecord` is store-internal (no spec). */
export function translationsOps(m, url, body) {
  const q = (k) => url.searchParams.get(k);
  return {
    translationdraft: () => m.translationDraft({ ...(body || {}), by: q("by") }),
    translationdraftrecord: () => m.translationDraftRecord({ ...(body || {}), by: q("by") }),
    translationgrant: () => m.translationGrant({ ...(body || {}), by: q("by") }),
    translationadopt: () => m.translationAdopt({ ...(body || {}), by: q("by") }),
    translationconfirm: () => m.translationConfirm({ ...(body || {}), by: q("by") }),
    translationrevert: () => m.translationRevert({ ...(body || {}), by: q("by") }),
    translationmark: () => m.translationMark({ ...(body || {}), by: q("by") }),
    translations: () => m.translations({ language: q("language") ?? (body || {}).language, viewer: q("viewer") }),
    interfacewords: () => m.interfaceWords({ language: q("language") ?? (body || {}).language, viewer: q("viewer") }),
  };
}

/* R18 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  /* R18 (K5195): the assistant's draft door, which the screens' translations page sends. Writes labelled drafts (to_language) or
     the fact of a reading (to_english) through the door's record route; `by` is the door's stamp, `assistant` is the door's own. */
  translationdraft: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "caller-owned", description: "translation-directed: keyed by a language and interface words; drafts labeled machine work for a granted speaker to check (`to_language`), or an administrator's back-translation of one protected word that writes nothing (`to_english`); moves no bundle",
    fields: { accepts: ["language","direction","keys","key"], requires: ["language","direction"] } },
  translationgrant: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "credential", description: localize("translations.declared.translationgrant", "setting: a named member's grant for one language, an administrator's act; moves no bundle"),
    fields: { accepts: ["member","language","revoke"], requires: ["member","language"] } },
  translationadopt: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("translations.declared.translationadopt", "translation-directed: keyed by a language and an interface word; the group's own wording of Civicsmith's words, shown to members reading that language; moves no bundle"),
    fields: { accepts: ["language","key","text","draft"], requires: ["language","key","text"] } },
  translationconfirm: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("translations.declared.translationconfirm", "translation-directed: keyed by a language and an interface word; the group's own wording of Civicsmith's words, shown to members reading that language; moves no bundle"),
    fields: { accepts: ["language","key"], requires: ["language","key"] } },
  translationrevert: { classes: ["admin","member"], machineClasses: [], mutating: true, weight: "reversible", description: localize("translations.declared.translationrevert", "translation-directed: keyed by a language and an interface word; the group's own wording of Civicsmith's words, shown to members reading that language; moves no bundle"),
    fields: { accepts: ["language","key"], requires: ["language","key"] } },
  /* R21 (fix round 10; K5046 (c)): the read of R8, declared here, no longer in `control-plane`'s owner map. `viewer` is the door's stamp,
     never a field a caller sends; `v` is the release version the door keys the answer's cache on; with no `language` the viewer's own is read. */
  interfacewords: { classes: ["admin","member"], machineClasses: [], mutating: false, stamps: ["viewer"], needs: null, weight: "read", description: localize("translations.declared.interfacewords", "read: every interface word in a language, the group's shown translation or the English, never blank, with the English beside it; writes nothing"),
    fields: { accepts: ["language","v"], requires: [] } },
});

/* promotion — the one write path by which a bundle enters or changes in the record (requirements:
 * `build/requirements/promotion.md`). It holds the compare-and-swap, keeps history append-only, takes the document's
 * own bytes as the record's word on what it is, and refuses a whole promotion when any rule fails: the bundle advances
 * as one transaction (`record-core.transact`) or nothing is written. Later modules join a promotion by registering a
 * check and a projection (R39) and the facts it needs (R40), each owner its own share (the shares `plane` held for
 * owners not yet registering, its R10, went to their owners in T20). It also runs the gate (`../gate.mjs`), and the case gate over the case-document catalogue a later module
 * registers with the instance (R33, R47), and reopens a set-down inquiry.
 *
 * REACHED as `promotionOf(host, deps)`: one instance per host (the Durable Object's `ctx`), created on the first call
 * with `deps` and returned to every later caller. `deps`:
 *   record      record-core, `recordOf(host)` unless a test passes its own (K61).
 *   membership  membership, `membershipOf(host)` unless a test passes its own (K61).
 *   now         the module's clock, an ISO instant (default: the wall clock).
 *   order       the modules' total order (ids), which registered steps and listeners run in (R39, R45, R46);
 *               membership's `MODULE_ORDER` unless a test passes its own. Unknown modules run last, in the order they registered.
 *   roster      project-roster, whose `projectScope` R57 reads; `projectRosterOf(host)` on the same record and membership,
 *               made on its first use, unless a test passes its own.
 */

import { parseFrontmatter, idDisagrees, normalizeType, vocabFor, STATES,
         deriveInquiryTitle, inquiryQuestionOf, isMachineIdentity } from "../record-grammar/index.mjs";
import { recordOf, fileDigestOf, inlineBytesOf, EMPTY_STRING_SHA, mintExhausted } from "../record-core/index.mjs";
import { membershipOf, noSuchProject, notAParticipant, listenerRefusal, MODULE_ORDER, CUSTODIAL_CHECKS } from "../membership/index.mjs";
import { projectRosterOf } from "../project-roster/index.mjs";
import { PROMOTION_CHECKS, PROMOTED_TYPE_CHECKS, PROJECT_CREATION_VISIBILITY_CHECKS, PROMOTION_ROW_CHECKS,
         PROJECT_MINT_CHECKS, PROMOTION_REGISTRATION_CHECKS } from "./checks.mjs";
import { recordChecks } from "./record-checks.mjs";
import { MECHANICAL_FIELD_SETS } from "./history.mjs";
import { word, localize } from "../setup-words/index.mjs";
import { projectNameKey } from "./names.mjs";
import { INFO2_GRAMMAR } from "./info2.mjs";
import { appendStateHistory, setScalar, setOrAddScalar, appendSessionLog, spliceReferences, quotedScalar,
         withProducingGroup } from "./text.mjs";
import { runCaseGate as runCaseCatalogue, runGate as runBundleGate } from "../gate.mjs";

export { runGate, runCaseGate, CATALOG_VERSION, GATE_VERSION, ROW_CENSUS } from "../gate.mjs";
export { PROMOTION_CHECKS, PROMOTED_TYPE_CHECKS, PROJECT_CREATION_VISIBILITY_CHECKS, PROMOTION_ROW_CHECKS,
         PROJECT_MINT_CHECKS, PROMOTION_REGISTRATION_CHECKS } from "./checks.mjs";
export { recordChecks } from "./record-checks.mjs";
/* Moved here from the catalogue in T18 (K636): the name key and C-77 (R19, R38), the producing group's one writing
   (R13), and the mechanical field sets R8 and C-20.1 read (the catalogue's copy deleted in T19, K750). */
export { projectNameKey, checkProjectNameUniqueness } from "./names.mjs";
export { withProducingGroup } from "./text.mjs";
export { MECHANICAL_FIELD_SETS } from "./history.mjs";
/* R55 (K773): C-18.6/.7, the information@2 register grammar, this module's since T19 and registered with record-core. */
export { INFO2_GRAMMAR, checkInfo2Contract } from "./info2.mjs";
/* R49 (K285): the one site of LISTENER_MALFORMED and LISTENER_DECLARED is membership's (its R81), re-exported for later
   modules, which call either spelling of the one function. */
export { listenerRefusal } from "../membership/index.mjs";

/** The instance's inline bound (R6, R48): a file held as text is at most 1 MiB of UTF-8. A later module that bounds
 *  what it hands to a promotion reads this constant rather than its own. */
export const INLINE_MAX = 1024 * 1024;
/** R51 (N340, K275): the decisions a member may record about a question (D-79), frozen, and the one list of them:
 *  `progressions` re-exports it rather than spelling its own. */
export const DISPOSITIONS = Object.freeze(["deferred", "dismissed"]);
/** The dispositions an inquiry is reopened from (R24): the same frozen array as DISPOSITIONS (R51), never a copy. */
export const REOPENABLE_FROM = DISPOSITIONS;
/** R16: the words `retire` refuses a cited item with, so the two doors give one answer. */
export const RETIRE_CITED_DETAIL = "these are still cited by live edges. Retiring them would leave those Projects "
  + "pointing at retired material, which C-6.2 treats as an error whose remedy is to "
  + "sever the edge with a reason. Sever first, then retire.";
/** The edge-reason bound a reopening's reason is held to (R22). */
export const EDGE_REASON_MAX = 160;
/* R58: the most revisions, and the most state entries, `bundleHistory` answers (the newest kept). */
const HISTORY_MAX = 200;

const isObj = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const has = (o, k) => isObj(o) && Object.prototype.hasOwnProperty.call(o, k);
const textStated = (v) => (typeof v === "string" && v.trim() !== "" ? v : null);
const typeStated = (v) => (typeof v === "string" && v.trim() !== "" ? normalizeType(v) : null);
const sameText = (a, b) => String(a).trim().replace(/\s+/g, " ") === String(b).trim().replace(/\s+/g, " ");
const sameInstant = (a, b) => {
  const x = Date.parse(String(a).trim()), y = Date.parse(String(b).trim());
  return Number.isFinite(x) && Number.isFinite(y) ? x === y : String(a).trim() === String(b).trim();
};
const cut = (v, n) => String(v).slice(0, n);

const rand = (n) => [...crypto.getRandomValues(new Uint8Array(n))].map((b) => b.toString(16).padStart(2, "0")).join("");

/* R39's "the modules' total order" is membership's `MODULE_ORDER` (one list, one site), held equal to
   `build/modules.json` by membership's R83 test and this module's R39 test. */
/* The families whose rows this module's refusals carry (Uses; K93 (2)), and promotion's own rows last. A code is held
   by one row in the whole catalogue (DEC-49's one code, one row), so the first family naming it is its row. */
const ROW_FAMILIES = [PROMOTION_ROW_CHECKS, PROMOTED_TYPE_CHECKS, PROJECT_MINT_CHECKS, PROJECT_CREATION_VISIBILITY_CHECKS,
                      CUSTODIAL_CHECKS, PROMOTION_CHECKS];
const rowOf = (code) => ROW_FAMILIES.find((t) => Object.prototype.hasOwnProperty.call(t, code))?.[code] ?? null;
/* A refusal carrying its row: its reason, code, check id and translation ("Errors": its check and translation where the
   catalogue has a row for it, so a code no family holds is still refused by its reason, never thrown on; PROMOTION #39).
   Called with the code as a literal at each site, so the DEC-49 guard reads which code a marked region mints. */
const refusal = (code, detail, extra) => {
  const row = rowOf(code);
  return { ok: false, reason: code, code, ...(row ? { check: row.check, translation: row.translation } : {}), detail,
           ...(extra || {}) };
};

/* R5: every stored digest is of the stored bytes; a supplied digest that differs is named. A file's digest and size
   are record-core's one computation (its R58: `fileDigestOf`, `inlineBytesOf`), so this door and its census agree. */
function digestFiles(files) {
  const disagree = [];
  const out = files.map((f) => {
    const computed = fileDigestOf(f);
    if (computed === null) return f;
    const supplied = f.sha256;
    if (supplied === undefined || supplied === null) return { ...f, sha256: computed };
    if (typeof supplied !== "string" || supplied.toLowerCase() !== computed) {
      disagree.push({ path: f.path ?? null, kind: typeof f.text === "string" ? "inline" : "blob",
                      supplied: typeof supplied === "string" ? supplied : String(supplied), computed });
      return f;
    }
    return supplied === computed ? f : { ...f, sha256: computed };
  });
  return { files: out, disagree };
}
/* R4: is this the promotion the held manifest entry records? Every file by name and digest (as a set), the base,
   kind, author, writer and operation. A digest either side does not state makes the answer no. */
function samePromotion(entry, want) {
  const norm = (v) => (v === undefined || v === null ? null : String(v));
  if (norm(entry.base) !== norm(want.base) || norm(entry.kind) !== norm(want.kind)
      || norm(entry.author) !== norm(want.author) || norm(entry.writer) !== norm(want.writer)
      || norm(entry.operation) !== norm(want.operation)) return false;
  const held = Array.isArray(entry.files) ? entry.files.filter(isObj) : [];
  if (!held.length || held.length !== want.files.length) return false;
  const digestOf = (v) => (typeof v === "string" && v !== "" ? v.toLowerCase() : null);
  const byName = new Map();
  for (const f of held) {
    const d = digestOf(f.sha256);
    if (typeof f.name !== "string" || d === null || byName.has(f.name)) return false;
    byName.set(f.name, d);
  }
  for (const f of want.files) {
    const d = f ? digestOf(f.sha256) : null;
    if (!f || typeof f.path !== "string" || d === null || byName.get(f.path) !== d) return false;
    byName.delete(f.path);
  }
  return byName.size === 0;
}
/* R52 (N425, K692): the criticality the promotion records is `crucial` when the document's own front matter or the
   envelope says so, as ratification's R22 counts it; otherwise the envelope's, as before. */
function criticalityOf(fm, envelope) {
  if ((fm && fm.criticality === "crucial") || envelope.criticality === "crucial") return "crucial";
  return envelope.criticality ?? null;
}
/* R53 (N426): the project the document states (its front matter's top-level `project:`, a project id), so record-core's
   `bundleInfo().project` holds it and membership's sight fences the bundle by that project. A document stating none,
   and a project's own bundle, are committed with no project. */
function projectOf(fm, type) {
  if (type === "project" || !fm || typeof fm.project !== "string") return null;
  const id = fm.project.trim();
  return id === "" ? null : id;
}

/* R57: the bundles a document rests on as evidence: each `basis[]` leg's target and each `references[]` entry of rel
   `cites` not severed (a case's citation, a question's leg's edge; citation R1, R4). Other rels are not evidence. */
function evidenceTargets(fm) {
  const out = new Set();
  if (!isObj(fm)) return out;
  const said = (v) => (typeof v === "string" && v.trim() !== "" ? v.trim() : null);
  for (const l of Array.isArray(fm.basis) ? fm.basis : []) if (isObj(l) && said(l.target)) out.add(said(l.target));
  for (const r of Array.isArray(fm.references) ? fm.references : [])
    if (isObj(r) && r.rel === "cites" && r.status !== "severed" && said(r.target)) out.add(said(r.target));
  return out;
}

/* R13: the producing group written into a created document's bytes, rehashed from what is written. */
function stampGroup(files, slug) {
  return files.map((f) => {
    if (!f || f.path !== "bundle.md" || typeof f.text !== "string") return f;
    const text = withProducingGroup(f.text, slug);
    if (text === f.text) return f;
    return { ...f, text, bytes: inlineBytesOf({ text }), sha256: fileDigestOf({ text }) };
  });
}

/* R40: a fact no module provides, answered in one place (DEC-49: one code, one site). It is never a value, so it is
   never read as false; `detail` says what the caller was doing when it found the fact missing. */
const factUnavailable = (fact, detail) => ({ ok: false, reason: "FACT_UNAVAILABLE", code: "FACT_UNAVAILABLE",
  check: PROMOTION_REGISTRATION_CHECKS.FACT_UNAVAILABLE.check, translation: PROMOTION_REGISTRATION_CHECKS.FACT_UNAVAILABLE.translation, fact, detail });

/* R40: a fact whose provider threw (C-102.5), at `fact` and at the acts that read one. */
const factFailed = (fact, e) => ({ ok: false, reason: "FACT_FAILED", code: "FACT_FAILED",
  check: PROMOTION_REGISTRATION_CHECKS.FACT_FAILED.check, translation: PROMOTION_REGISTRATION_CHECKS.FACT_FAILED.translation,
  fact, detail: `the module that provides the fact '${fact}' could not answer: ${cut(e && e.message ? e.message : e, 200)}` });

/* R39, R40, R47 (K231, N254): a second registration of what one registrant already holds (a step, a fact, the case
   catalogue) is refused here, the one site that mints STEP_DECLARED (C-102.8); `held` names what was registered twice. */
function stepDeclared(held, detail) {
  const row = PROMOTION_REGISTRATION_CHECKS.STEP_DECLARED;
  return { ok: false, reason: "STEP_DECLARED", code: "STEP_DECLARED", check: row.check, translation: row.translation,
           ...held, detail };
}

const NAME_TAKEN = () => ({ ok: false, reason: "NAME_TAKEN",
  detail: localize("promotion.index.project_name_taken", "a project by that name already exists in your team's Civicsmith, compared without regard to case or spacing. This holds for deactivated projects too, because their names are still cited.") });

class Promotion {
  #record; #membership; #now; #order; #rosterOf; #roster = null;
  #steps = [];            // {module, check, project, seq}
  #facts = new Map();     // name -> {module, fn}
  #listeners = [];        // {module, fn, seq}: R45's post-commit notice
  #reopenListeners = [];  // {module, fn, seq}: R46's notice of an accepted reopening
  #notices = new Map();   // accepted promotions awaiting their notice, by bundle and snap key
  #caseCatalogue = null;  // {module, fn}: R47's registered case-document catalogue, which R33 runs
  #delivering = false;

  constructor({ record, membership, now, order, roster = null, rosterOf = null } = {}) {
    this.#record = record;
    this.#membership = membership;
    this.#roster = roster;
    this.#rosterOf = typeof rosterOf === "function" ? rosterOf : null;
    this.#now = typeof now === "function" ? now : () => new Date().toISOString();
    this.#order = Array.isArray(order) ? order : MODULE_ORDER;
  }

  /* ---------------------------------------------------------------- R58: the record of this copy */

  /** R58 (T51; K3826; DEC-330 A27, B7): how a bundle came to be what it is, as facts only: its manifest entries newest
   *  first in write order (R30), each file with its digest and size, and the document's own `state_history` as stored.
   *  Sight first (R20, R23): a viewer not admitted, an unknown id and a missing viewer answer one `NO_SUCH_BUNDLE`.
   *  Reads; writes nothing; never throws. */
  bundleHistory(args = {}) {
    try { const { bundle, viewer = null } = args || {}; return this.#history(bundle, viewer); }
    catch { return { ok: false, reason: "HISTORY_FAILED" }; }
  }

  #history(bundle, viewer) {
    if (typeof bundle !== "string" || !bundle) return { ok: false, reason: "NO_BUNDLE" };
    const record = this.#record;
    if (!viewer || !record.head(bundle) || !this.#membership.inSight(bundle, viewer))
      return { ok: false, reason: "NO_SUCH_BUNDLE" };
    const image = record.readImage(bundle) || {};
    const read = (path) => {
      try { return JSON.parse(String(image[path])); } catch { return null; }
    };
    const man = read("_history/manifest.json");
    const entries = man && Array.isArray(man.entries) ? man.entries.filter(isObj) : [];
    /* A stored file's size is known from the bytes held under any path that carries its digest. */
    const sizes = new Map(), texts = new Map();
    for (const v of Object.values(image)) {
      const sha = typeof v === "string" ? fileDigestOf({ text: v }) : isObj(v) ? v.sha256 : null;
      const bytes = typeof v === "string" ? inlineBytesOf({ text: v }) : isObj(v) ? v.bytes : null;
      if (typeof sha === "string" && Number.isSafeInteger(bytes) && !sizes.has(sha)) sizes.set(sha, bytes);
      if (typeof sha === "string" && typeof v === "string" && !texts.has(sha)) texts.set(sha, v);
    }
    /* R59: the capture a revision's own `data/provenance.json` names for the document, read from the bytes that
       revision held (the live file or the copy under the next snap key); absent when it names none. */
    const captureOf = (files) => {
      const f = files.find((x) => x.path === "data/provenance.json");
      const sha = f && texts.has(f.sha256) ? (() => {
        try { return JSON.parse(texts.get(f.sha256))?.documents?.[0]?.capture?.sha256; } catch { return null; }
      })() : null;
      return typeof sha === "string" && sha ? { capture_sha: sha } : {};
    };
    const all = entries.map((e) => {
      const rec = read(`_history/promotion_${e.key}.json`);
      const written = rec && Array.isArray(rec.files) ? rec.files.filter(isObj) : [];
      const files = written.map((f) => ({ path: f.name, sha256: f.sha256 ?? null, bytes: sizes.get(f.sha256) ?? null }));
      const md = files.find((f) => f.path === "bundle.md");
      return { seq: e.seq, snapKey: e.key, kind: e.kind, author: e.author ?? null, at: e.created ?? null,
               sha256: md ? md.sha256 : null, ...captureOf(files), files };
    }).sort((a, b) => b.seq - a.seq);
    const live = record.readFile(bundle, "bundle.md");
    const fm = live && typeof live.text === "string" ? parseFrontmatter(live.text).data : null;
    const stored = fm && Array.isArray(fm.state_history) ? fm.state_history.filter(isObj) : [];
    const states = stored.map((x) => ({ at: x.timestamp ?? null, from: x.from_state ?? null, to: x.to_state ?? null,
                                        author: x.author ?? null, blurb: x.blurb ?? null }));
    return { ok: true, bundle, revisions: all.slice(0, HISTORY_MAX), states: states.slice(-HISTORY_MAX),
             truncated: all.length > HISTORY_MAX || states.length > HISTORY_MAX };
  }

  /* ---------------------------------------------------------------- R39, R40: the registry */

  registerStep(module, { check = null, project = null } = {}) {
    /* DEC-49 REGION is-step-named */
    if (typeof module !== "string" || !module)
      return { ok: false, reason: "STEP_MODULE_UNNAMED", code: "STEP_MODULE_UNNAMED",
               check: PROMOTION_REGISTRATION_CHECKS.STEP_MODULE_UNNAMED.check,
               translation: PROMOTION_REGISTRATION_CHECKS.STEP_MODULE_UNNAMED.translation,
               detail: "a step names the module that registers it" };
    /* END DEC-49 REGION is-step-named */
    if (this.#steps.some((s) => s.module === module))
      return stepDeclared({ module }, `${module} has already registered its step`);
    this.#steps.push({ module, check: typeof check === "function" ? check : null,
                       project: typeof project === "function" ? project : null, seq: this.#steps.length });
    this.#steps.sort((a, b) => (this.#rank(a.module) - this.#rank(b.module)) || (a.seq - b.seq));
    return { ok: true, module };
  }

  /* A module's place in the total order; unknown modules run last, in the order they registered. */
  #rank(m) { const i = this.#order.indexOf(m); return i === -1 ? Infinity : i; }

  /* R45, R46: a later module's listener joins `list` once, kept in the modules' total order. */
  #listen(list, module, fn) {
    const refused = listenerRefusal(list, module, fn);
    if (refused) return refused;
    list.push({ module, fn, seq: list.length });
    list.sort((a, b) => (this.#rank(a.module) - this.#rank(b.module)) || (a.seq - b.seq));
    return { ok: true, module };
  }

  /* R45: a later module's listener, called once after each accepted promotion has committed. */
  onCommitted(module, fn) { return this.#listen(this.#listeners, module, fn); }

  /* R46 (N62, K157): a later module's listener, called once after each accepted reopening; its answer joins the reply. */
  onReopened(module, fn) { return this.#listen(this.#reopenListeners, module, fn); }

  /* R45: `promote` may run inside a caller's transaction, which record-core joins (its R32), so the commit it waits for
     may be the caller's. record-core's transaction is synchronous, so by the time a microtask runs the outermost one has
     committed or rolled back. The notice is delivered then, and only when the promotion's own manifest entry (its snap
     key, base and bundle.md digest) is held: a promotion rolled back with its caller's transaction is never announced. */
  #announce(n) {
    if (!this.#listeners.length) return;
    this.#notices.set(`${n.bundleId}\u0000${String(n.snapKey)}`, n);
    if (this.#delivering) return;
    this.#delivering = true;
    queueMicrotask(() => this.#deliver());
  }

  #deliver() {
    this.#delivering = false;
    const due = [...this.#notices.values()];
    this.#notices.clear();
    for (const n of due) {
      let held = false;
      try {
        const e = this.#record.manifestEntry(n.bundleId, n.snapKey);
        const md = e && Array.isArray(e.files) ? e.files.find((f) => f && f.name === "bundle.md") : null;
        held = !!md && String(e.base) === String(n.base) && md.sha256 === n.bundleSha;
      } catch { held = false; }
      if (!held) continue;
      for (const l of this.#listeners) {
        try {
          const r = l.fn({ bundleId: n.bundleId, bundleSha: n.bundleSha, type: n.type, replay: n.replay });
          if (r && typeof r.then === "function") r.then(null, () => {});
        } catch { /* a listener's failure never changes the promotion or another listener's notice */ }
      }
    }
  }

  /* N56 (R40): a fact registered with this module, for a later module that reads it. Unprovided, it answers
     FACT_UNAVAILABLE and never a value, so it is never read as false; a provider that throws answers FACT_FAILED. */
  fact(name, ...args) {
    const held = typeof name === "string" ? this.#facts.get(name) : undefined;
    if (!held)
      return factUnavailable(typeof name === "string" ? name : null,
                             `no module provides the fact '${cut(name, 80)}', so it has no value here; it is not false.`);
    try { return { ok: true, fact: name, value: held.fn(...args) }; }
    catch (e) { return factFailed(name, e); }
  }

  registerFact(name, module, fn) {
    /* DEC-49 REGION is-fact-named */
    if (typeof name !== "string" || !name || typeof module !== "string" || !module || typeof fn !== "function")
      return { ok: false, reason: "FACT_MALFORMED", code: "FACT_MALFORMED", check: PROMOTION_REGISTRATION_CHECKS.FACT_MALFORMED.check,
               translation: PROMOTION_REGISTRATION_CHECKS.FACT_MALFORMED.translation,
               detail: "a fact names itself, its module and its function" };
    /* END DEC-49 REGION is-fact-named */
    const held = this.#facts.get(name);
    if (held) return stepDeclared({ fact: name, module: held.module }, `the fact '${name}' is already provided by ${held.module}`);
    this.#facts.set(name, { module, fn });
    return { ok: true, fact: name, module };
  }

  /* A fact's value `{ok: true, value}`, or the act's refusal FACT_UNAVAILABLE naming it: never read as false (R40).
     The refusal is the answer itself, never nested inside one (N70: the D-240 reader grades a return by its verdict). */
  #fact(name, ...args) {
    const held = this.#facts.get(name);
    if (!held) return factUnavailable(name, `no module provides the fact '${name}' this act needs, so the act `
                                            + `is refused rather than answered as if it were false. Nothing was written.`);
    /* R37, R40 (PROMOTION #35, T37): a provider that throws refuses the act FACT_FAILED with its row, as `fact` answers
       it, never a raw failure of the whole act. */
    try { return { ok: true, value: held.fn(...args) }; }
    catch (e) { return factFailed(name, e); }
  }

  /* ---------------------------------------------------------------- R47, R33: the case-document catalogue */

  /* R47: a later module (ratification) registers, once, the case-document catalogue `fn(fm, ctx) → findings` that R33
     runs. Any second registration is refused, whoever makes it. */
  registerCaseCatalogue(module, fn) {
    /* R49: membership's listenerRefusal answers the malformed case; a second registration is R47's STEP_DECLARED. */
    const malformed = listenerRefusal(null, module, fn);
    if (malformed) return malformed;
    if (this.#caseCatalogue)
      return stepDeclared({ module: this.#caseCatalogue.module },
                          `the case-document catalogue is already registered by ${this.#caseCatalogue.module}`);
    this.#caseCatalogue = { module, fn };
    return { ok: true, module };
  }

  /* R33: the case gate over the registered catalogue; with none registered, C-102.9 (K529). Same GATE_VERSION (R34). */
  runCaseGate(args = {}) {
    return runCaseCatalogue(args || {}, this.#caseCatalogue ? this.#caseCatalogue.fn : null);
  }

  /* ---------------------------------------------------------------- R27: the gate, with the registered grammars */

  /* R27 (§1b): the bundle gate with the type grammars later modules registered with record-core (its `grammars()`), so
     a grammar that left the catalogue judges a bundle here as it does at the audit. `args` are `runGate`'s own; a
     caller's `grammars` is never taken, since the record's registrations are the one list. A record that cannot answer
     its registrations rejects the gate: an unread list is never read as empty (R37). A grammar whose arm throws is one
     error of its own on the bundle, naming its module, as record-core's audit counts it (its R67, R59): the gate fails
     closed with a verdict, never passes and never throws out. */
  async runGate(args = {}) {
    const grammars = this.#record.grammars().map((g) => ({ module: g.module, ids: g.ids, arm: async (ctx, found) => {
      try { await g.arm(ctx, found); }
      catch (e) {
        found.push({ check: g.module, severity: "error",
                     message: `${g.module}'s grammar threw on ${ctx && ctx.folderName}, so it judged nothing and the record is `
                            + `not passed: ${cut(e && e.message ? e.message : e, 200)}` });
      }
    } }));
    return runBundleGate({ ...(args || {}), grammars });
  }

  /* ---------------------------------------------------------------- promote */

  promote(pkg) {
    try { return this.#promote(pkg); }
    catch (e) {
      /* "Errors": never throws for any JSON package. The transaction has already rolled back when this is reached. */
      return { ok: false, reason: "PROMOTE_FAILED",
               detail: `the promotion could not complete and nothing was written: ${cut(e && e.message ? e.message : e, 200)}` };
    }
  }

  #promote(pkg) {
    if (!pkg || typeof pkg !== "object" || Array.isArray(pkg))
      return { ok: false, reason: "NO_BODY", detail: "promote requires a POSTed package" };
    const record = this.#record, membership = this.#membership;
    const { base = null, meta, snapKey, author } = pkg;
    const replay = !!pkg.replay;
    let { bundleId, files } = pkg;

    /* R8: a mechanical writer names an operation the catalogue declares a field set for. */
    const writer = pkg.writer === "mechanical" ? "mechanical" : null;
    const operation = writer ? pkg.operation : null;
    if (writer && !(typeof operation === "string" && Object.prototype.hasOwnProperty.call(MECHANICAL_FIELD_SETS, operation)))
      return { ok: false, reason: "UNDECLARED_OPERATION",
               detail: `a mechanical promotion names one of: ${Object.keys(MECHANICAL_FIELD_SETS).join(", ")}`,
               got: operation ?? null };
    /* R7: references and basis legs are read from bundle.md, never the payload. */
    if (Array.isArray(pkg.refs) && pkg.refs.length)
      return { ok: false, reason: "REFS_IN_PAYLOAD",
               detail: "references are read from bundle.md frontmatter, not from the promote payload; remove the refs field" };
    if (Array.isArray(pkg.basis) && pkg.basis.length)
      return { ok: false, reason: "BASIS_IN_PAYLOAD",
               detail: "basis legs are read from bundle.md frontmatter, not from the promote payload; remove the basis field" };

    /* R9, R11, R12: the document is the record's word on itself; the envelope only where it states nothing. */
    const sentMd = Array.isArray(files) ? files.find((f) => isObj(f) && f.path === "bundle.md") : null;
    const sentParsed = sentMd && typeof sentMd.text === "string" ? parseFrontmatter(sentMd.text) : null;
    const sentFm = sentParsed && isObj(sentParsed.data) ? sentParsed.data : null;
    /* R17, R38 (N854): every C-2.1 finding record-grammar's parser answers for the sent document, the catalogue's own
       arm, so the door and the catalogue never disagree about whether these bytes are readable. */
    const sentGrammar = sentParsed ? sentParsed.findings.filter((x) => x && x.check === "C-2.1").map((x) => x.message) : [];
    const envelope = isObj(meta) ? meta : null;
    const documentType = sentFm ? typeStated(sentFm.object_type) : null;
    const envelopeType = envelope ? typeStated(envelope.object_type) : null;
    let promotedType = documentType ?? envelopeType ?? undefined;
    const documentTitle = sentFm ? textStated(sentFm.title) : null;
    const documentQuestionTitle = documentType === "inquiry" && typeof sentMd?.text === "string"
      ? deriveInquiryTitle(inquiryQuestionOf(sentMd.text)) : null;
    const envelopeTitle = envelope ? textStated(envelope.title) : null;
    let promotedTitle = documentTitle ?? envelopeTitle ?? undefined;
    const documentState = sentFm ? textStated(sentFm.current_state) : null;
    const envelopeState = envelope ? textStated(envelope.current_state) : null;
    let promotedState = documentState ?? envelopeState ?? undefined;
    const promotedPriorState = has(sentFm, "prior_state") ? (sentFm.prior_state ?? null)
      : (envelope ? envelope.prior_state ?? null : null);
    const promotedClosedReason = has(sentFm, "closed_reason") ? (sentFm.closed_reason ?? null)
      : (envelope ? envelope.closed_reason : undefined);
    const documentCreated = sentFm ? textStated(sentFm.created) : null;
    const documentLastUpdated = sentFm ? textStated(sentFm.last_updated) : null;
    const envelopeCreated = envelope ? textStated(envelope.created) : null;
    const envelopeLastUpdated = envelope ? textStated(envelope.last_updated) : null;
    let promotedCreated = documentCreated ?? envelopeCreated ?? undefined;
    let promotedLastUpdated = documentLastUpdated ?? envelopeLastUpdated ?? undefined;

    /* R19: a project's creation names no id; the plane mints it and writes it into the document. */
    const idSupplied = bundleId !== undefined && bundleId !== null && bundleId !== "";
    const creatingProject = base === null && !!envelope
      && (promotedType === "project" || (typeof bundleId === "string" && /^PROJ-/.test(bundleId)));
    let projectMd = null;
    if (creatingProject) {
      /* DEC-49 REGION is-project-id-supplied */
      if (idSupplied)
        return refusal("PROJECT_ID_SUPPLIED",
          "a new project's id is minted by the record and returned; send the creation with no bundleId. "
          + "A creation in the PROJ- namespace names no id, whatever type it claims. Nothing was created.");
      /* END DEC-49 REGION is-project-id-supplied */
      projectMd = sentMd;
      /* DEC-49 REGION is-project-id-bytes */
      if (!sentFm)
        return refusal("PROJECT_DOCUMENT_UNREADABLE",
          "the new project's bundle.md must arrive as inline text beginning with a --- front matter block, "
          + "because the record writes the minted id into it. Nothing was created.");
      if (has(sentFm, "id"))
        return refusal("PROJECT_ID_IN_BYTES",
          "the new project's bundle.md already carries a top-level id: line. The record writes the id it mints; "
          + "remove the line and send it again. Nothing was created.");
      /* END DEC-49 REGION is-project-id-bytes */
    }
    /* R7 */
    if ((!idSupplied && !creatingProject) || !Array.isArray(files) || !envelope)
      return { ok: false, reason: "MALFORMED", detail: "bundleId, files and meta are required" };
    if (idSupplied && typeof bundleId !== "string")
      return { ok: false, reason: "MALFORMED", detail: "bundleId is a string" };

    /* R11: what the request must name, each refused by name before anything is read or written. */
    /* DEC-49 REGION is-promote-request-named */
    if (!((typeof snapKey === "string" && snapKey.trim() !== "") || (typeof snapKey === "number" && Number.isFinite(snapKey))))
      return refusal("PROMOTE_SNAP_KEY_UNSTATED",
        "this request names no snapKey (a non-blank string), so the revision has no name in the history. Nothing was written.");
    const pathless = files.map((f, i) => (isObj(f) && typeof f.path === "string" && f.path.trim() !== "" ? -1 : i))
                          .filter((i) => i >= 0);
    if (pathless.length)
      return refusal("PROMOTED_FILE_PATH_UNSTATED",
        `files entr${pathless.length > 1 ? "ies" : "y"} ${pathless.join(", ")} (counting from 0) name no path `
        + "(a non-blank string), or are not file objects. Nothing was written.", { entries: pathless });
    const blobHeld = (f) => typeof f.text !== "string" && typeof f.blobSha === "string" && f.blobSha !== "";
    const empty = files.filter((f) => typeof f.text !== "string" && !blobHeld(f)).map((f) => f.path);
    if (empty.length)
      return refusal("PROMOTED_FILE_CONTENT_UNSTATED",
        localize("promotion.index.empty_neither_text_a_string", "{empty}: neither text (a string) nor a blobSha, so the record holds nothing it could digest. Nothing was written.", { empty: String(empty.join(", ")) }), { paths: empty });
    const sizeless = files.filter((f) => blobHeld(f) && !(Number.isInteger(f.bytes) && f.bytes >= 0)).map((f) => f.path);
    if (sizeless.length)
      return refusal("PROMOTED_FILE_BYTES_UNSTATED",
        `${sizeless.join(", ")}: held as a blob and stating no size (bytes, a whole number from 0). Nothing was written.`,
        { paths: sizeless });
    /* END DEC-49 REGION is-promote-request-named */

    /* R7, R17: readability is judged before any fence that reads the document's content. */
    if (!sentMd) return { ok: false, reason: "NO_BUNDLE_MD", detail: "a promotion carries its bundle.md" };
    /* DEC-49 REGION is-promote-readable */
    if (base !== null && typeof sentMd.text !== "string")
      return refusal("BUNDLE_MD_UNREADABLE",
        "this revision's bundle.md is held as a blob, so no rule about the revision can read it. Nothing was written.",
        { why: "blob" });
    /* R38 (N854, K2706): any C-2.1 finding refuses, at a creation as at a revision, not only a block the parser answers
       no data for (a key given twice, a line outside the grammar), since the catalogue refuses the same bytes. */
    if (typeof sentMd.text === "string" && (sentGrammar.length || (base !== null && !sentFm)))
      return refusal("BUNDLE_MD_UNREADABLE",
        `this ${base === null ? "creation" : "revision"}'s bundle.md has no front matter block the record's grammar can `
        + `read (${cut(sentGrammar.join("; "), 300)}), so no rule about it can read it. Nothing was written.`,
        { why: "front_matter", grammar: sentGrammar.slice(0, 20) });
    /* END DEC-49 REGION is-promote-readable */

    /* R19: `visibility` only on a project's creation, `discoverable` only with an owner. */
    let creationVisibility = null;
    if (pkg.visibility !== undefined && pkg.visibility !== null) {
      /* DEC-49 REGION is-project-creation-visibility */
      if (base !== null || promotedType !== "project")
        return refusal("PROJECT_VISIBILITY_NOT_A_CREATION",
          "visibility is chosen when a project is created or forked, and this is not a project's creation. An "
          + "existing project's setting is its owners' act, op=projectvisibilityset. Nothing was written.");
      /* END DEC-49 REGION is-project-creation-visibility */
      const unknown = membership.visibilitySettingRefusal(pkg.visibility);
      if (unknown) return unknown;
      const creator = typeof pkg.ownerMemberId === "string" && pkg.ownerMemberId ? pkg.ownerMemberId : null;
      /* DEC-49 REGION is-project-creation-ownerless */
      if (!creator && pkg.visibility === "discoverable")
        return refusal("PROJECT_VISIBILITY_NO_OWNER",
          "whether a project can be found is its OWNERS' choice, and a project created by a machine credential has "
          + "no owner to choose it, so it is created hidden. Send the creation without visibility (or with "
          + "visibility=hidden). Nothing was created.");
      /* END DEC-49 REGION is-project-creation-ownerless */
      creationVisibility = creator ? pkg.visibility : null;
    }

    /* R5: every stored digest and size is of the stored bytes. */
    const digested = digestFiles(files);
    /* DEC-49 REGION is-promote-digest */
    if (digested.disagree.length)
      return refusal("FILE_DIGEST_MISMATCH",
        localize("promotion.index.the_sha256_sent_for_map", "the sha256 sent for {map} is not the SHA-256 of that file's bytes (an inline file's UTF-8 text, or a blob's content address). The record stores a digest only of what it holds. Nothing was written.", { map: String(digested.disagree.map((d) => d.path).join(", ")) }),
        { paths: digested.disagree.map((d) => d.path), files: digested.disagree });
    /* END DEC-49 REGION is-promote-digest */
    files = digested.files.map((f) => {
      const n = inlineBytesOf(f);
      return n === null || f.bytes === n ? f : { ...f, bytes: n };
    });

    /* R13: a creation's producing group. */
    let groupStamp = null, createdGroup = null;
    if (base === null) {
      const g = this.#fact("producingGroup");
      if (!g.ok) return g;
      const recorded = typeof g.value === "string" && g.value ? g.value : null;
      if (recorded && !replay) { groupStamp = recorded; createdGroup = recorded; }
      else {
        const said = sentFm ? sentFm.group : undefined;
        const stated = [said, envelope.group].find((x) => typeof x === "string" && x.trim() !== "");
        createdGroup = stated ? stated.trim() : recorded;
        /* DEC-49 REGION is-group-undetermined */
        if (!createdGroup)
          return refusal("GROUP_UNDETERMINED",
            localize("promotion.index.this_store_records_no_producing", "this store records no producing team, and this creation names none — neither a group: line in its bundle.md nor a team in its meta. The record does not supply one. Nothing was created."),
            { act: "promote" });
        /* END DEC-49 REGION is-group-undetermined */
      }
    }

    const ctx = { pkg, base, meta: envelope, snapKey, author: author ?? null, writer, operation, replay,
                  register: Array.isArray(pkg.register) ? pkg.register : [], state: {} };

    /* R2: one transaction; any refusal returned inside it rolls back every row written. */
    return record.transact(() => {
      /* R19: mint, write, then hash. */
      if (creatingProject) {
        const year = this.#now().slice(0, 4);
        const slug = String(promotedTitle ?? "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
          .slice(0, 40).replace(/-+$/, "") || "project";
        bundleId = record.mintOpaqueId("PROJ", year, `-${slug}`, (id) => !!record.bundleInfo(id));
        /* N322: no free id is record-core's one answer (its R62, row C-59.6); the transaction rolls back. */
        if (!bundleId) return mintExhausted("PROJ");
        const lines = projectMd.text.split("\n");
        lines.splice(1, 0, `id: ${bundleId}`);
        const text = lines.join("\n");
        const written = { ...files.find((f) => f.path === "bundle.md"), text, bytes: inlineBytesOf({ text }), sha256: fileDigestOf({ text }) };
        files = files.map((f) => (f.path === "bundle.md" ? written : f));
      }
      if (groupStamp) files = stampGroup(files, groupStamp);
      const head = record.head(bundleId);
      /* R11, R12: the head's `created` and `last_updated` are what its own document states (the row is written from
         it); read from the held bundle.md, and undefined where the head holds none it can read. */
      let heldDoc = null;
      if (head) {
        const heldMd = record.readFile(bundleId, "bundle.md");
        const heldFm0 = heldMd && typeof heldMd.text === "string" ? parseFrontmatter(heldMd.text).data : null;
        const heldFm = isObj(heldFm0) ? heldFm0 : {};
        heldDoc = isObj(heldFm0) ? heldFm0 : null;
        if (head.created === undefined) head.created = textStated(heldFm.created) ?? undefined;
        if (head.lastUpdated === undefined) head.lastUpdated = textStated(heldFm.last_updated) ?? undefined;
      }

      /* R1, R20: a revision of a bundle not held, and one the stamped actor may not see, get the one answer ABSENT,
         before any other answer that reads the head. A caller who sees the project at existence only is told so. */
      /* DEC-49 REGION is-promote-absent */
      if (base !== null) {
        const sight = head && pkg.actorIdentity != null
          ? String(membership.sight(bundleId, pkg.actorViewer ?? "")).toUpperCase() : "FULL";
        const seen = head && sight === "EXISTENCE" ? membership.existenceAct(bundleId, pkg.actorViewer ?? "") : null;
        if (seen) return seen;
        if (!head || sight !== "FULL")
          return refusal("ABSENT", "update attempted against a record that does not exist");
      }
      /* END DEC-49 REGION is-promote-absent */

      /* R4: a re-send of the promotion the record holds under this snap key is answered and writes nothing. */
      const held = record.manifestEntry(bundleId, snapKey);
      const kind = replay ? "promotion-replay" : "promotion";
      if (held && samePromotion(held, { base: base === null ? EMPTY_STRING_SHA : base, files, author: author ?? null,
                                        kind, writer, operation })) {
        const md = held.files.find((f) => f && f.name === "bundle.md");
        return { ok: true, bundleId, idempotent: true, wrote: false, snapKey: String(snapKey),
                 bundleSha: md ? md.sha256 : null,
                 recorded: { kind: held.kind, base: held.base, author: held.author, created: held.created },
                 current: head ? { bundleSha: head.bundleSha, rowVersion: head.rowVersion } : null,
                 detail: "the record already holds this promotion under this snap key, byte for byte; nothing was written" };
      }
      /* R1 */
      if (head && base === null) return refusal("EXISTS", "creation attempted against an existing record");

      /* R11: a revision carries forward what it states nowhere, and says so; a creation stating none is refused. */
      if (head && (promotedTitle === undefined || promotedTitle === null || promotedTitle === "") && head.title)
        promotedTitle = head.title;
      let typeCarried = null;
      if (head && promotedType === undefined) { promotedType = normalizeType(head.type); typeCarried = promotedType; }
      /* DEC-49 REGION is-promoted-type-unstated */
      if (!head && promotedType === undefined)
        return refusal("PROMOTED_TYPE_UNSTATED",
          `neither the document being promoted nor this request's meta states an object_type, and `
          + `${cut(bundleId, 80)} is new, so the record holds nothing that says what kind of thing it is. State the `
          + `type in the document. Nothing was written.`);
      /* END DEC-49 REGION is-promoted-type-unstated */
      const carriedFields = {};
      if (head) {
        if (promotedState === undefined) promotedState = carriedFields.current_state = head.currentState;
        if (promotedCreated === undefined) promotedCreated = carriedFields.created = head.created;
        if (promotedLastUpdated === undefined) promotedLastUpdated = carriedFields.last_updated = head.lastUpdated;
      } else {
        /* DEC-49 REGION is-promoted-field-unstated */
        const unstated = [["current_state", promotedState], ["created", promotedCreated],
                          ["last_updated", promotedLastUpdated]].filter(([, v]) => v === undefined).map(([k]) => k);
        if (unstated.length)
          return refusal("PROMOTED_FIELD_UNSTATED",
            `neither the document being promoted nor this request's meta states ${unstated.join(", ")}, and `
            + `${cut(bundleId, 80)} is new, so the record holds nothing to carry. State `
            + `${unstated.length > 1 ? "them" : "it"} in the document. Nothing was written.`, { fields: unstated });
        /* END DEC-49 REGION is-promoted-field-unstated */
      }

      /* R53 (G74; BOB's decision, P17, from K4557): a member files a document into a project only when she is its member
         or invited to it (gathering stays open to an invited member who has not joined). Only a session's member is
         asked (`actorMemberId`, the control plane's stamp: a machine credential holds none) and never a replay. A project
         that is absent answers as one she is not in, so the refusal tells a stranger nothing of which projects exist.
         Membership's one answer (its R87); its served sentence carries the remedy. Nothing is written. */
      const filedInto = projectOf(sentFm, promotedType);
      const filer = typeof pkg.actorMemberId === "string" && pkg.actorMemberId ? pkg.actorMemberId : null;
      if (!replay && filer && filedInto && !membership.participation(filedInto, filer)) {
        /* The sentence names the project by its name where she may see that it exists, else as she sent it; never an id
           the record gives. Keyed `refusal.PROMOTE_NOT_A_PARTICIPANT` (UX-DESIGN's row, U463); `en` is its stand-in. */
        const named = String(membership.sight(filedInto, pkg.actorViewer ?? "")).toUpperCase() !== "NONE"
          ? record.bundleInfo(filedInto)?.title : null;
        return { ok: false, reason: "PROMOTE_NOT_A_PARTICIPANT", code: "PROMOTE_NOT_A_PARTICIPANT", act: "promote",
                 project: filedInto,
                 detail: localize("refusal.PROMOTE_NOT_A_PARTICIPANT", "Only the members of {project}, and those invited to it, can file documents into it. Nothing was filed. Ask an owner of the project to invite you, or file it into a project you are in.", { project: String(named || filedInto) }) };
      }

      /* R56 (N456, form (b)): a project's stage is computed, never written; a creation is written at `forming` or
         `closed` only. A revision's move is R15's, below, over the declared table. */
      /* DEC-49 REGION is-project-stage-computed */
      if (!head && promotedType === "project" && promotedState !== "forming" && promotedState !== "closed")
        return refusal("PROJECT_STAGE_COMPUTED",
          `this new project states current_state '${cut(promotedState, 40)}'. A project is created forming (or closed); `
          + `its stage after that is worked out from its record, never written. Send it again at forming. Nothing was `
          + `written.`, { current_state: cut(promotedState, 40), legal: ["forming", "closed"] });
      /* END DEC-49 REGION is-project-stage-computed */

      /* R19: a project's title is unique across the instance, deactivated projects included. */
      if (promotedType === "project") {
        const key = projectNameKey(promotedTitle);
        if (!key)
          return { ok: false, reason: "NO_TITLE", detail: localize("promotion.index.project_needs_name", "a project needs a name, and it must be unique across your team's Civicsmith") };
        if (this.#nameTaken(key, bundleId)) return NAME_TAKEN();
      }

      /* R19: only an owner deactivates or reactivates a project; every other revision needs a joined actor. */
      if (head && normalizeType(head.type) === "project") {
        const to = promotedState, from = head.currentState;
        const deactivating = from !== "closed" && to === "closed" && promotedClosedReason === "abandoned";
        /* R56: reopening a closed project is its one move out of `closed` (`forming`, the declared table's). */
        const reactivating = from === "closed" && to !== "closed";
        if (deactivating || reactivating) {
          const actor = typeof pkg.actorMemberId === "string" && pkg.actorMemberId ? pkg.actorMemberId : null;
          if (!actor || !membership.isProjectOwner(bundleId, actor))
            return { ok: false, reason: "NOT_THE_OWNER", act: deactivating ? "deactivate" : "reactivate",
                     detail: deactivating
                       ? "only an owner of this project may deactivate it, which is what closing it as abandoned "
                         + "means. Closing it as resolved or superseded is ordinary record work."
                       : "only an owner of this project may reactivate it." };
        }
        const denied = membership.projectAuthority(bundleId, pkg.actorIdentity ?? null, "joined", "promote");
        if (denied) return denied;
      }

      /* R1: the compare-and-swap. A stale base is never merged and never taken as the new value. */
      /* DEC-49 REGION is-promote-cas */
      if (head && head.bundleSha !== base)
        return refusal("CAS_STALE",
          localize("promotion.index.the_base_this_revision_names", "the base this revision names is not the record's current version: someone else changed it since it was read. Nothing was written."), { expected: head.bundleSha, got: base });
      /* END DEC-49 REGION is-promote-cas */

      /* R10: a revision never retypes its bundle. */
      /* DEC-49 REGION is-promote-retypes-bundle */
      if (head && typeCarried === null && promotedType !== normalizeType(head.type) && !replay)
        return refusal("REVISION_RETYPES_BUNDLE",
          `${cut(bundleId, 80)} is '${normalizeType(head.type)}' and this revision says '${cut(promotedType, 40)}'. A `
          + `revision changes what a document says, never what kind of thing it is. Nothing was written.`,
          { head_type: normalizeType(head.type), revision_type: promotedType });
      /* END DEC-49 REGION is-promote-retypes-bundle */
      /* R12: a revision never redates its creation. */
      /* DEC-49 REGION is-revision-redates-creation */
      if (head && head.created !== undefined && !has(carriedFields, "created") && !sameInstant(promotedCreated, head.created) && !replay)
        return refusal("REVISION_REDATES_CREATION",
          `${cut(bundleId, 80)} was created '${cut(head.created, 40)}' and this revision says `
          + `'${cut(promotedCreated, 40)}'. A revision changes what a document says, never when it was made. Send it `
          + `again with the document's created as the record holds it, or with none. Nothing was written.`,
          { head_created: cut(head.created, 80), revision_created: cut(promotedCreated, 80) });
      /* END DEC-49 REGION is-revision-redates-creation */
      /* R13: a revision never regroups its bundle. */
      /* DEC-49 REGION is-revision-regroups-bundle */
      const revisionGroup = sentFm && sentFm.group !== undefined && sentFm.group !== null
        && String(sentFm.group).trim() !== "" ? String(sentFm.group).trim() : null;
      if (head && revisionGroup !== null && revisionGroup !== String(head.groupId).trim() && !replay)
        return refusal("REVISION_REGROUPS_BUNDLE",
          localize("promotion.index.cut_was_produced_by_cut", "{cut} was produced by '{cut_2}' and this revision says '{cut_3}'. A revision changes what a document says, never whose it is. Send it again with the team the record holds, or with none. Nothing was written.", { cut: String(cut(bundleId, 80)), cut_2: String(cut(head.groupId, 40)), cut_3: String(cut(revisionGroup, 40)) }),
          { head_group: cut(head.groupId, 80), revision_group: cut(revisionGroup, 80) });
      /* END DEC-49 REGION is-revision-regroups-bundle */
      /* R14: a document's id is the bundle it is filed under. */
      const finalMd = files.find((f) => f.path === "bundle.md");
      const finalFm0 = finalMd && typeof finalMd.text === "string" ? parseFrontmatter(finalMd.text).data : null;
      const finalFm = isObj(finalFm0) ? finalFm0 : null;
      /* DEC-49 REGION is-promote-bundle-id */
      /* R38 (N854): C-1.1 is record-grammar's `idDisagrees`, the one judgment `checkBundle` runs: a string id not equal,
         byte for byte, to the bundle it is filed under. A non-string id is C-1.2's, not this refusal's. */
      if (!replay && finalFm && idDisagrees(finalFm, bundleId))
        return refusal("BUNDLE_ID_DISAGREES",
          `the document states id '${cut(finalFm.id, 80)}' and it is being filed under '${cut(bundleId, 80)}'. A `
          + `document is filed under the id it states. Nothing was written.`,
          { document_id: cut(finalFm.id, 80), bundle_id: bundleId });
      /* END DEC-49 REGION is-promote-bundle-id */

      /* R16: a move into `retired` asks retire's own question. */
      if (promotedState === "retired" && (!head || head.currentState !== "retired")
          && (head ? normalizeType(head.type) : promotedType) === "information") {
        const c = this.#fact("citedBy", bundleId);
        if (!c.ok) return c;
        const citedBy = Array.isArray(c.value) ? c.value : [];
        if (citedBy.length)
          return { ok: false, reason: "CITED", to: "retired", offenders: [{ id: bundleId, citedBy }],
                   detail: RETIRE_CITED_DETAIL };
      }

      /* R6 */
      for (const f of files) {
        const n = inlineBytesOf(f);
        if (n !== null && n > INLINE_MAX) return { ok: false, reason: "OVERSIZE_INLINE", path: f.path, bytes: n };
      }

      /* R9, R12: an envelope stating a value the document contradicts is refused by name. Replay is exempt. */
      if (!replay) {
        /* DEC-49 REGION is-promoted-type-disagrees */
        if (documentType !== null && envelopeType !== null && documentType !== envelopeType)
          return refusal("ENVELOPE_TYPE_DISAGREES",
            `the document being promoted says object_type '${cut(sentFm.object_type, 40)}' and this request's meta says `
            + `'${cut(envelope.object_type, 40)}'. The record goes by the document. Send it again with the meta naming `
            + `the type the document names, or change the document first. Nothing was written.`,
            { document_type: documentType, envelope_type: envelopeType });
        /* END DEC-49 REGION is-promoted-type-disagrees */
        /* DEC-49 REGION is-promoted-title-disagrees */
        if (envelopeTitle !== null && (documentTitle !== null || documentQuestionTitle !== null)
            && !(documentTitle !== null && sameText(envelopeTitle, documentTitle))
            && !(documentQuestionTitle !== null && sameText(envelopeTitle, documentQuestionTitle)))
          return refusal("ENVELOPE_TITLE_DISAGREES",
            `the document being promoted is titled '${cut(documentTitle ?? documentQuestionTitle, 80)}' and this `
            + `request's meta says '${cut(envelopeTitle, 80)}'. The record goes by the document. Send it again with the `
            + `meta naming the document's title, or with no title in the meta. Nothing was written.`,
            { document_title: cut(documentTitle ?? documentQuestionTitle, 200), envelope_title: cut(envelopeTitle, 200) });
        /* END DEC-49 REGION is-promoted-title-disagrees */
        let stateContradiction = null;
        if (envelopeState !== null && documentState !== null && !sameText(envelopeState, documentState))
          stateContradiction = ["current_state", documentState, envelopeState];
        else for (const k of ["prior_state", "closed_reason"]) {
          if (!has(sentFm, k) || envelope[k] === undefined) continue;
          const d = sentFm[k] ?? null, e = envelope[k] ?? null;
          if (d === null && e === null) continue;
          if (d === null || e === null || !sameText(d, e)) { stateContradiction = [k, d, e]; break; }
        }
        /* DEC-49 REGION is-promoted-state-disagrees */
        if (stateContradiction) {
          const [field, said, asked] = stateContradiction;
          return refusal("ENVELOPE_STATE_DISAGREES",
            `the document being promoted says ${field} '${said === null ? "null" : cut(said, 40)}' and this request's `
            + `meta says '${asked === null ? "null" : cut(asked, 40)}'. The record goes by the document. Nothing was written.`,
            { field, document_value: said === null ? null : cut(said, 80), envelope_value: asked === null ? null : cut(asked, 80) });
        }
        /* END DEC-49 REGION is-promoted-state-disagrees */
        /* DEC-49 REGION is-promoted-dates-disagree */
        const dateContradiction = envelopeCreated !== null && documentCreated !== null
            && !sameInstant(envelopeCreated, documentCreated) ? ["created", documentCreated, envelopeCreated]
          : envelopeLastUpdated !== null && documentLastUpdated !== null
            && !sameInstant(envelopeLastUpdated, documentLastUpdated) ? ["last_updated", documentLastUpdated, envelopeLastUpdated]
          : null;
        if (dateContradiction) {
          const [field, said, asked] = dateContradiction;
          return refusal("ENVELOPE_DATES_DISAGREE",
            `the document being promoted says ${field} '${cut(said, 40)}' and this request's meta says `
            + `'${cut(asked, 40)}'. The record goes by the document. Nothing was written.`,
            { field, document_value: cut(said, 80), envelope_value: cut(asked, 80) });
        }
        /* END DEC-49 REGION is-promoted-dates-disagree */
      }

      /* R15: a move of current_state goes along an edge the type's declared table carries. A creation is not a move;
         a replay is not exempt. The head's type and the promoted type are both asked where they differ. */
      if (head && promotedState !== undefined && promotedState !== null && promotedState !== head.currentState) {
        const machines = [...new Set([normalizeType(head.type), promotedType])]
          .filter((t) => typeof t === "string" && vocabFor(STATES, t));
        for (const mt of machines) {
          const edges = vocabFor(STATES, mt).edges || {};
          const legalFrom = Object.prototype.hasOwnProperty.call(edges, head.currentState) ? edges[head.currentState] : [];
          if (legalFrom.includes(promotedState)) continue;
          const detail = `${cut(bundleId, 80)} stands at '${head.currentState}' and this promotion names `
            + `'${cut(promotedState, 40)}'. A ${mt} at '${head.currentState}' moves to `
            + `${legalFrom.length ? legalFrom.join(" or ") : "no other state"}, and a revision that leaves it where it `
            + `stands is always allowed. The table is the catalogue's. Nothing was written.`;
          /* DEC-49 REGION bias-state-edge */
          if (mt === "bias")
            return refusal("BIAS_ILLEGAL_TRANSITION", detail,
              { from: head.currentState, to: promotedState, object_type: mt, legal_from: legalFrom });
          /* END DEC-49 REGION bias-state-edge */
          /* DEC-49 REGION is-state-move-undeclared */
          return refusal("STATE_MOVE_UNDECLARED", detail,
            { from: head.currentState, to: promotedState, object_type: mt, legal_from: legalFrom });
          /* END DEC-49 REGION is-state-move-undeclared */
        }
      }

      /* R7: a non-replay revision names every path it drops. */
      if (head && !replay) {
        const now = new Set(files.map((f) => f.path));
        const declared = new Set(Array.isArray(pkg.drop) ? pkg.drop : []);
        const dropped = record.livePaths(bundleId).filter((p) => !now.has(p) && !declared.has(p));
        /* DEC-49 REGION is-promote-files */
        if (dropped.length)
          return refusal("FILES_DROPPED",
            "this promotion would remove files the previous revision had. Carry them forward, or name them in drop[] to "
            + "delete them on purpose.", { paths: dropped.sort() });
        /* END DEC-49 REGION is-promote-files */
      }
      if (!finalMd) return { ok: false, reason: "NO_BUNDLE_MD", detail: "a promotion carries its bundle.md" };
      /* R4: a different promotion under a held snap key. */
      /* DEC-49 REGION is-promote-snapkey */
      if (held)
        return refusal("SNAP_KEY_TAKEN",
          `${bundleId} already holds a promotion under snap key ${String(snapKey)}, and this one is not it (a different `
          + `base, file, writer or author). The record does not rewrite a history entry; send this promotion under a `
          + `new snap key. Nothing was written.`, { snapKey: String(snapKey) });
      /* END DEC-49 REGION is-promote-snapkey */

      /* R57: a counsel matter is never evidence outside its own project. Only what this promotion newly names is asked
         (a scope changes nothing already cited, project-roster R21): a revision carrying a citation its head already
         held is not a new citation. */
      const counselCited = this.#counselMatterCited(finalFm, heldDoc,
        promotedType === "project" ? bundleId : projectOf(finalFm, promotedType));
      /* DEC-49 REGION is-counsel-matter-evidence */
      if (counselCited.length)
        return refusal("COUNSEL_MATTER_NOT_EVIDENCE",
          `${counselCited.map((t) => cut(t, 80)).join(", ")} ${counselCited.length > 1 ? "are" : "is"} kept in a counsel `
          + `matter of another project, and a counsel matter is never evidence outside its own project. A leg or a `
          + `citation resting on it is made from inside that project. Nothing was written.`, { targets: counselCited });
      /* END DEC-49 REGION is-counsel-matter-evidence */

      /* R39: the later modules' checks, in the modules' order. */
      Object.assign(ctx, { bundleId, files, head, creation: !head, promotedType, promotedTitle, promotedState,
                           promotedPriorState, promotedClosedReason, promotedCreated, promotedLastUpdated,
                           documentType, envelopeType, docFm: finalFm, bundleMd: finalMd });
      for (const s of this.#steps) {
        if (!s.check) continue;
        ctx.state[s.module] = ctx.state[s.module] || {};
        const refused = s.check(ctx);
        if (refused && refused.ok === false) return refused;
      }

      /* R3: the one write, through record-core. */
      const projectedTitle = promotedType === "inquiry"
        ? deriveInquiryTitle(inquiryQuestionOf(typeof finalMd.text === "string" ? finalMd.text : "")) ?? promotedTitle
        : promotedTitle;
      const committed = record.commit({
        bundleId, type: promotedType, title: projectedTitle, project: projectOf(finalFm, promotedType), snapKey, kind,
        base: head ? base : EMPTY_STRING_SHA, author: author ?? null, writer, operation, files,
        state: promotedState, priorState: promotedPriorState, group: head ? head.groupId : createdGroup,
        created: promotedCreated, lastUpdated: promotedLastUpdated, criticality: criticalityOf(finalFm, envelope),
        at: promotedLastUpdated || this.#now() });

      /* R19 (membership R71): a project's creation is recorded with membership in the same transaction: the creating
         member its sole owner (a machine's creation has none), the creation visibility, and the project's sight. */
      const ownerMemberId = typeof pkg.ownerMemberId === "string" && pkg.ownerMemberId ? pkg.ownerMemberId : null;
      let owner = null;
      if (!head && promotedType === "project") {
        const made = membership.projectCreated({ projectId: bundleId, ownerId: ownerMemberId, visibility: creationVisibility,
                                                 by: ownerMemberId });
        if (made && made.ok === false) return made;
        owner = ownerMemberId;
      }

      /* R39: the later modules' projections, in order; each may add keys to the answer, never replace one. */
      Object.assign(ctx, { bundleSha: committed.bundleSha, rowVersion: committed.rowVersion });
      const extras = {};
      for (const s of this.#steps) {
        if (!s.project) continue;
        ctx.state[s.module] = ctx.state[s.module] || {};
        const out = s.project(ctx);
        if (out && out.ok === false) return out;
        if (isObj(out)) for (const [k, v] of Object.entries(out)) if (!(k in extras)) extras[k] = v;
      }
      const answer = { ok: true, bundleId, bundleSha: committed.bundleSha, rowVersion: committed.rowVersion, owner,
        ...(!head && promotedType === "project" ? { visibility: membership.visibilityOf(bundleId) } : {}),
        ...(typeCarried ? { type_carried: { object_type: typeCarried, from: "head",
          says: word("promotion.says.document_request_stated") } } : {}),
        ...(Object.keys(carriedFields).length ? { fields_carried: { fields: carriedFields, from: "head",
          says: word("promotion.says.document_request_stated_revision") } } : {}) };
      for (const [k, v] of Object.entries(extras)) if (!(k in answer)) answer[k] = v;
      /* R45: announced once the transaction this promotion committed in has committed. */
      this.#announce({ bundleId, bundleSha: committed.bundleSha, type: promotedType, replay, snapKey,
                       base: head ? base : EMPTY_STRING_SHA });
      return answer;
    });
  }

  /* R57: the targets `fm` newly names as evidence (absent from `held`'s), each resting on a bundle of a project other
     than `own` whose scope is `counsel_matter`. A target the record does not hold is not asked here (its fences are the
     legs' own); a target that is itself a project is its own project. A scope that cannot be read abstains (R17). */
  #counselMatterCited(fm, held, own) {
    const before = evidenceTargets(held);
    const out = [];
    for (const target of evidenceTargets(fm)) {
      if (before.has(target)) continue;
      const info = this.#record.bundleInfo(target);
      if (!info) continue;
      const project = normalizeType(info.type) === "project" ? info.id : info.project;
      if (typeof project !== "string" || project === "" || project === own) continue;
      if (this.#scopeOf(project) === "counsel_matter") out.push(target);
    }
    return out.sort();
  }

  /* R57: a project's scope, project-roster R23's; null when it cannot be read. */
  #scopeOf(projectId) {
    try {
      if (!this.#roster && this.#rosterOf) this.#roster = this.#rosterOf();
      const answer = this.#roster && typeof this.#roster.projectScope === "function" ? this.#roster.projectScope(projectId) : null;
      return answer && typeof answer.scope === "string" ? answer.scope : null;
    } catch { return null; }
  }

  /* R19: is `key` (projectNameKey) the name of any project but `except`, deactivated ones included? */
  #nameTaken(key, except = null) {
    let after = null;
    for (;;) {
      const page = this.#record.listByType({ type: "project", after, limit: 200 });
      for (const id of page.ids) {
        if (id === except) continue;
        const info = this.#record.bundleInfo(id);
        if (info && projectNameKey(info.title) === key) return true;
      }
      if (page.ids.length < 200 || !page.cursor) return false;
      after = page.cursor;
    }
  }

  /* ---------------------------------------------------------------- forkProject (N16, §7.12) */

  forkProject(args = {}) {
    try { return this.#fork(args || {}); }
    catch (e) {
      return { ok: false, reason: "FORK_FAILED",
               detail: `the fork could not complete and nothing was written: ${cut(e && e.message ? e.message : e, 200)}` };
    }
  }

  #fork({ projectId, newId, title, by, viewer = null, visibility = null }) {
    const record = this.#record, membership = this.#membership;
    /* The fork's id is minted, as a new project's is; a named one is refused first, echoing nothing. */
    /* DEC-49 REGION is-project-fork-id-supplied */
    if (newId !== undefined && newId !== null && newId !== "")
      return refusal("PROJECT_FORK_ID_SUPPLIED",
        "a fork's id is minted by the record and returned as newId; send the fork with no newId. Nothing was forked.");
    /* END DEC-49 REGION is-project-fork-id-supplied */
    const head = typeof projectId === "string" && projectId ? record.head(projectId) : null;
    /* Sight before position: an unseen project answers as one that does not exist. A viewer never sent is internal. */
    const sight = head && viewer !== null && viewer !== undefined ? String(membership.sight(projectId, viewer)).toUpperCase() : "FULL";
    const seen = head && sight === "EXISTENCE" ? membership.existenceAct(projectId, viewer) : null;
    if (seen) return seen;
    /* R42 (N208): an unseen project and an absent id get membership's one answer (its R78, C-70.5). */
    if (!head || sight !== "FULL") return noSuchProject(projectId);
    if (normalizeType(head.type) !== "project") return { ok: false, reason: "NOT_A_PROJECT" };
    const p = membership.participation(projectId, by);
    /* R43 (N335): no participation is membership's one answer (its R87, row C-56.3). */
    if (!p) return notAParticipant(projectId, by);
    if (p.state !== "joined") return { ok: false, reason: "NOT_JOINED", state: p.state,
      detail: "an invited member who has not joined sees the project's skeleton only, so there is nothing for them to "
            + "fork. Join it first." };
    const key = projectNameKey(title);
    if (!key) return { ok: false, reason: "NO_TITLE", detail: "a fork needs a name of its own" };
    if (this.#nameTaken(key)) return NAME_TAKEN();
    const live = record.readFile(projectId, "bundle.md");
    if (!live || typeof live.text !== "string")
      return { ok: false, reason: "NO_DOCUMENT", detail: "the origin has no readable bundle.md to fork" };

    const when = this.#now();
    const withEdge = spliceReferences(live.text,
      [{ rel: "derived_from", target: projectId, status: "confirmed", note: `forked by ${by}` }]);
    if (!withEdge)
      return { ok: false, reason: "UNSPLICEABLE_REFERENCES", projectId,
               detail: "the origin's references block is not in a shape this grammar can extend in place, so the clone "
                     + "could not be given a recorded origin. A fork with no provenance is not written." };
    /* The origin's id line is removed: promote mints the fork's and writes it before hashing. */
    let text = withEdge.split("\n").filter((l, i, all) => !(l.startsWith("id:") && i > 0 && i < all.indexOf("---", 1))).join("\n");
    /* R44 (PROMOTION #42): the title as the grammar reads it back, never a JSON string, whose escapes the grammar keeps
       as written, so a title holding a quote or a backslash was refused ENVELOPE_TITLE_DISAGREES against its own meta. */
    text = setScalar(text, "title", quotedScalar(title));
    /* A fork starts at the beginning of the lifecycle, and is created now (the document states it: R12). */
    text = setScalar(text, "current_state", "forming");
    text = setOrAddScalar(text, "created", `"${when}"`);
    text = setScalar(text, "last_updated", `"${when}"`);
    text = appendSessionLog(text, `### Session ${when} | forked from ${projectId} | ${by}\n`
                                  + `Trigger: fork\n`
                                  + `Changes: created as a clone of ${projectId}, recorded as a derived_from reference. `
                                  + `Participants were NOT copied.\n`);
    const carried = [];
    for (const path of record.livePaths(projectId)) {
      if (path === "bundle.md") continue;
      const f = record.readFile(projectId, path);
      if (!f) continue;
      carried.push(typeof f.text === "string" ? { path, text: f.text, sha256: f.sha256 }
                                              : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes });
    }
    const promoted = this.promote({
      base: null, snapKey: `${when.replace(/[-:]/g, "")}_${rand(4)}`, author: by, ownerMemberId: by, visibility,
      files: [{ path: "bundle.md", text }, ...carried],
      meta: { object_type: "project", title, current_state: "forming", created: when, last_updated: when },
    });
    if (!promoted.ok) return promoted;
    return { ok: true, projectId, newId: promoted.bundleId, title, origin: projectId, rel: "derived_from",
             owner: by, participantsCopied: 0, bundleSha: promoted.bundleSha, visibility: promoted.visibility };
  }

  /* ---------------------------------------------------------------- reopen */

  /* (Moved from `store.mjs` with the act it explains, T6; the rules are R21–R26, and R46's listeners follow them.)
   *
   * REC-31: REOPENING an inquiry the group SET DOWN. deferred|dismissed ->
   * open, on op=conclude's shape and for op=conclude's reasons.
   *
   * WHY IT EXISTS. `deferred -> open` and `dismissed -> open` have been legal
   * edges in the catalog's table since REC-10, and NO op wrote them: op=dispose
   * only ever targets the disposition set. REC-13 made that a real hole rather
   * than an untidiness — a deferred inquiry cannot be concluded (it is picked
   * back up first, which is what the edge is for), so a question the group set
   * down was unrecoverable except by hand-editing the document. An act the
   * table permits and no caller can perform is the state machine lying.
   *
   * CONCLUDE'S PROPERTIES, CARRIED OVER, and each for its own reason:
   * 1. A NAMED MEMBER reopens. The author stamp arrives from the session and a
   *    machine credential's is `token:<class>`, refused BY SHAPE
   *    (MACHINE_CANNOT_REOPEN, the MACHINE_CANNOT_RELEASE/CONCLUDE precedent).
   *    A machine may SURFACE a question (D-78) and PURSUE what a member
   *    authored (DEC-24); deciding that the group's own decision to set
   *    something down no longer holds is a member's judgement about the
   *    record, not a scheduler's.
   * 2. THE REASON IS AUTHORED AND NEVER PREFILLED. Refused when absent, exactly
   *    as dispose's is and as conclude's conclusion and falsifier are. Nothing
   *    is derived or proposed: "reopened" with no account of why is a state
   *    change wearing a decision's clothes, and the member who deferred it is
   *    owed the argument. It lands in the state_history entry and the Session
   *    Log, the two places this record keeps WHY.
   * 3. NO OWNER GATE AND NO BALLOT (DEC-30). Any holder of `contribute`
   *    reopens, and the act is ATTRIBUTED. Disagreeing with a disposition is
   *    precisely the disagreement DEC-30 says is expressed by acting and
   *    signing the act, not by a vote.
   *
   * THE MACHINE IS THE CATALOG'S, and there is NO SECOND EDGE SOURCE: legality
   * is vocabFor(STATES, <declared type>) offering `open`, the same one table
   * op=affordances publishes from. A legacy focus/problem document is refused
   * ILLEGAL_TRANSITION — its own vocabulary has no `open` at all (its open
   * state is spelled `surfaced`), and inventing the move would judge it by a
   * contract it was not authored under.
   *
   * SCOPED TO REOPENABLE_FROM, DELIBERATELY. The FROM state must be in that
   * one published array — exported by this module and read by the act, so the
   * publication and this refusal cannot disagree about what "reopenable" means.
   *
   * `concluded -> open` is ALSO a legal edge and this op does NOT write it, for
   * the reason REC-31 gave and REC-14 did not change: reopening a conclusion
   * here would produce an `open` inquiry still wearing its conclusion and its
   * falsifier with NO EDITION RECORDED — exactly the overclaim the edition
   * machinery exists to prevent — so it is refused BY NAME rather than by
   * omission, and op=publish is where a conclusion moves forward.
   *
   * `published -> open` IS written here, added at the REC-31 x REC-14 merge,
   * and the distinction is the recorded edition rather than a softening. DEC-12
   * rules that reopening does not unpublish: edition 1 keeps answering with its
   * own signature, attestor, time and gate version whatever happens to the
   * working document afterwards. So there is nothing to erase and nothing to
   * revert silently — the opposite of the concluded case — and published ->
   * open is the ONLY route to a second edition, which makes THIS act the front
   * door of a revision. An act the catalog permits and no caller can perform is
   * the state machine lying, which is the argument this op was built on. */
  reopen({ target, reason = "", viewer = null, author = null } = {}) {
    try { return this.#reopen({ target, reason, viewer, author }); }
    catch (e) {
      return { ok: false, reason: "REOPEN_FAILED", target: target ?? null,
               detail: `the reopening could not complete and nothing was written: ${cut(e && e.message ? e.message : e, 200)}` };
    }
  }

  #reopen({ target, reason, viewer, author }) {
    const record = this.#record, membership = this.#membership;
    const who = String(author ?? "").trim();
    /* R21 */
    /* DEC-49 REGION is-machine-reopen */
    if (!who || isMachineIdentity(who))
      return refusal("MACHINE_CANNOT_REOPEN",
        localize("promotion.index.machine_cannot_reopen", "reopening is a named member's judgement that a question the team set down has to be worked again. A machine credential may surface a question and pursue one, and may not overturn the team's own disposition. Sign in as a member."));
    /* END DEC-49 REGION is-machine-reopen */
    /* R22 */
    const why = String(reason ?? "").trim();
    if (!why)
      return { ok: false, reason: "NO_REASON",
               detail: "reopening records WHY the disposition no longer holds. Nothing here is prefilled." };
    if (why.length > EDGE_REASON_MAX || /["\\\r\n]/.test(why))
      return { ok: false, reason: "BAD_REASON",
               detail: `a reason is at most ${EDGE_REASON_MAX} characters and cannot contain a quote, a backslash, or a `
                     + `newline: the restricted frontmatter grammar has no escapes` };
    /* R23 */
    if (!target) return { ok: false, reason: "NO_TARGET", detail: "reopening picks up ONE question: pass target=<inquiry id>" };
    const head = typeof target === "string" ? record.head(target) : null;
    if (!head || String(membership.sight(target, viewer ?? "")).toUpperCase() !== "FULL") return { ok: false, reason: "NO_SUCH_BUNDLE", target };
    if (normalizeType(head.type) !== "inquiry")
      return { ok: false, reason: "NOT_AN_INQUIRY", target, object_type: head.type,
               detail: "reopening picks a question back up, and only an inquiry carries one." };
    const live = record.readFile(target, "bundle.md");
    if (!live || typeof live.text !== "string")
      return { ok: false, reason: "NO_DOCUMENT", target,
               detail: "this inquiry has no readable bundle.md, so its state cannot be moved" };
    let text = live.text;
    const fm = parseFrontmatter(text).data || {};

    /* R24 */
    if (!REOPENABLE_FROM.includes(head.currentState)) {
      const m = this.#fact("caseMember", target);
      if (!m.ok) return { ...m, target };
      if (!m.value)
        return { ok: false, reason: "NOT_SET_DOWN", target, from: head.currentState, reopenable: REOPENABLE_FROM,
                 detail: localize("promotion.index.not_set_down", "reopening picks up something the team SET DOWN (deferred or dismissed) or a finding that is a member of a published or prepared case. A concluded inquiry in no case moves forward by publishing a new edition rather than quietly reverting to open still wearing its conclusion.") };
    }
    const declared = fm.object_type ?? head.type;
    const spec = vocabFor(STATES, declared);
    /* R24: an own key only, as R15's fence reads it: a state named by an inherited key (`toString`) has no edges and is
       refused ILLEGAL_TRANSITION, never thrown into REOPEN_FAILED. */
    const edges = spec?.edges || {};
    const legalFrom = Object.prototype.hasOwnProperty.call(edges, head.currentState) && Array.isArray(edges[head.currentState])
      ? edges[head.currentState] : [];
    if (!legalFrom.includes("open"))
      return { ok: false, reason: "ILLEGAL_TRANSITION", to: "open", target, from: head.currentState, object_type: declared,
               detail: "this is not a legal move in the catalogue's state table for this document's own vocabulary." };

    /* R25 */
    const when = this.#now().replace(/\.\d+Z$/, "Z");
    const withHistory = appendStateHistory(text, { timestamp: when, from_state: head.currentState, to_state: "open",
                                                  blurb: why, author: who });
    if (!withHistory)
      return { ok: false, reason: "UNSPLICEABLE_STATE_HISTORY", target,
               detail: "this document's state_history block cannot be extended in place, and a reopening recording no "
                     + "transition would leave prior_state pointing at a history the document does not carry (C-4.2)" };
    text = setScalar(withHistory, "prior_state", head.currentState);
    text = setScalar(text, "current_state", "open");
    text = setScalar(text, "disposition_reason", `""`);
    text = setScalar(text, "case_edition", "null");
    text = setScalar(text, "last_updated", `"${when}"`);
    text = appendSessionLog(text, `### Session ${when} | Reopened | ${who}\n`
                                  + `Trigger: op=reopen on ${target}\n`
                                  + `Changes: state ${head.currentState} to open. Reason: ${why}.\n`);
    const carried = [];
    for (const path of record.livePaths(target)) {
      if (path === "bundle.md") continue;
      const f = record.readFile(target, path);
      if (!f) continue;
      carried.push(typeof f.text === "string" ? { path, text: f.text, sha256: f.sha256 }
                                              : { path, blobSha: f.blobSha, sha256: f.sha256, bytes: f.bytes });
    }
    const promoted = this.promote({
      bundleId: target, base: head.bundleSha, snapKey: `${when.replace(/[-:]/g, "")}_${rand(4)}`, author: who,
      files: [{ path: "bundle.md", text }, ...carried],
      meta: { object_type: declared, title: fm.title, current_state: "open", prior_state: head.currentState,
              created: fm.created, last_updated: when, criticality: fm.criticality ?? null },
    });
    if (!promoted.ok) return { ...promoted, target };
    /* R26: a live edge citing the target does not refuse a reopening. */
    const answer = { ok: true, target, from: head.currentState, to: "open", why, author: who, at: when, weight: "single" };
    /* R46: the reopening has committed; each listener, in the modules' order, may add its answer under its module id.
       A listener that throws, or answers with a promise (which settles after this reply has gone), adds nothing, and
       a rejection is swallowed: neither changes the reopening or what it wrote. */
    for (const l of this.#reopenListeners) {
      let out;
      try { out = l.fn({ target, from: head.currentState, at: when, author: who, viewer }); }
      catch { continue; }
      if (out && typeof out.then === "function") { out.then(null, () => {}); continue; }
      if (isObj(out) && !has(answer, l.module)) answer[l.module] = out;
    }
    return answer;
  }
}

/** R54 (K757, K760): promotion's route arms, keyed by op name, each a function of no arguments answering what the named
 *  service answers, spread by the composition root as `membershipOps` is. `viewer`, `author` and `by` are the control
 *  plane's stamps, read from the query, never from the body; which credential reaches each op is decided elsewhere. */
export function promotionOps(promotion, url, body) {
  const q = (k) => url.searchParams.get(k);
  return {
    promote: () => promotion.promote(body),
    /* REC-31, conclude's shape: one target, no handle and no owner, with the viewer and author stamps. */
    reopen: () => promotion.reopen({ target: q("target"), reason: q("reason"), viewer: q("viewer"), author: q("author") }),
    /* REC-138, REC-197: an absent visibility is null, which is hidden. */
    projectfork: () => promotion.forkProject({ projectId: q("projectId"), newId: q("newId"), title: q("title"),
                                               visibility: q("visibility"), by: q("by"), viewer: q("viewer") }),
    /* R58 (K3826): a read of the bundle's own record, sight-gated by the viewer stamp. */
    bundlehistory: () => promotion.bundleHistory({ bundle: q("bundle"), viewer: q("viewer") }),
  };
}

/* R60 (T51; K4168; op-declarations R80, op-grades R49): the ops this module serves that the screens send, declared by their owner beside
   the ops map: each row's class, weight and description are the op's existing rows', its fields are what the arm reads. */
export const DECLARED_OPS = Object.freeze({
  reopen: { classes: ["admin","member","probe"], mutating: true, weight: "reasoned", description: "act.reopen.label.question",
    fields: { accepts: ["target","reason"], requires: ["target","reason"] } },
  projectfork: { classes: ["admin","member","probe"], mutating: true, weight: "reversible", description: localize("promotion.declared.projectfork", "creates a NEW project; gated on the create_projects shape, not on the source object's state"),
    fields: { accepts: ["projectId","title","visibility"], requires: ["projectId","title"] } },
  /* R61 (T51, K4206; op-grades' substrate ground, RUNG_ABSENT and NON_ACTS): the write path every act rides. Its fields are the
     ones the arm reads from the package: files, meta and snapKey are refused by name when absent (R7, R11), and bundleId is
     not required of a project's creation, which mints it (R19). refs and basis are refused by name when sent (R7), so they
     are not accepted. */
  promote: { classes: ["admin","member","probe"], mutating: true, weight: "substrate", description: localize("promotion.declared.promote", "substrate: the one write path every act rides"),
    fields: { accepts: ["bundleId","base","files","meta","snapKey","author","replay","writer","operation","visibility","ownerMemberId","actorIdentity","actorViewer","actorMemberId","drop","register"], requires: ["files","meta","snapKey"] } },
});

const instances = new WeakMap();

/** The one promotion instance for `host` (the Durable Object's `ctx`); `deps` are read on the first call only. */
export function promotionOf(host, deps) {
  let p = instances.get(host);
  if (!p) {
    const record = (deps && deps.record) || recordOf(host);
    const membership = (deps && deps.membership) || membershipOf(host, { record });
    p = new Promotion({ ...(deps || {}), record, membership,
                        rosterOf: () => projectRosterOf(host, { record, membership }) });
    instances.set(host, p);
    /* record-core R59: the moved checks join the audit, with the caller's release registry from its context. */
    record.registerAuditCheck("promotion", ({ folderName, files, raw, sha256 }, context) =>
      recordChecks({ folderName, files, raw, releaseRegistry: (context && context.releaseRegistry) || null, sha256 }));
    registerInfo2Grammar(record);
  }
  return p;
}

/* R55 (K773): the information@2 register grammar, registered with record-core's seam (its R67) once per record, when
   the first instance over it is made (two hosts may share one record), so the audit and the gate run it in its slot.
   A record with no seam (a test's stand-in) is left alone; a refusal is a defect of the wiring (another module holding C-18.6/.7, or a second registration) and
   throws, as capture's does, rather than leave the grammar silently unrun. */
const info2Registered = new WeakSet();
function registerInfo2Grammar(record) {
  if (!record || typeof record.registerGrammar !== "function" || info2Registered.has(record)) return;
  info2Registered.add(record);
  const answer = record.registerGrammar("promotion", INFO2_GRAMMAR);
  if (answer && answer.ok === false)
    throw new Error(`promotion: record-core refused the information@2 grammar: ${answer.reason}`
                    + `${answer.heldBy ? ` (held by ${answer.heldBy})` : ""}`);
}

/** K64, record-core R59 (K130): record-core's audit pass (R18–R20), which runs the checks this module took from the
 *  catalogue (C-4.2, C-17.2, C-18.8, C-20.1) over the same image beside it, registered when this module is reached, so
 *  the audit loses none of them and judges each bundle once, whole. Takes and answers `auditPass`'s own shape. */
export async function recordAudit(host, opts = {}) {
  promotionOf(host);
  return recordOf(host).auditPass(opts);
}

/** What a registered step receives (R39): the promotion's context, as the promotion built it. */
export function stepContext(c) {
  return c;
}

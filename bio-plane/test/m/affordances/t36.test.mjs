/* affordances, T36 (T36-31; N726, DEC-174 (3), DEC-99; T37-27: N776, DEC-182; T38-31: DEC-183, K2300; T41-52: DEC-188 (7), (8), U145, K2484;
   T43-17: DEC-189, DEC-190, K2704; T44-9: DEC-191, N878, K2732; T46-45: DEC-194 (2), DEC-197, N937, N934, K2960; T47-49: N992, DEC-198,
   DEC-199, K3062, K3143; T49-14: DEC-229 to DEC-241, DEC-245, DEC-246, N1072, K2999, K3366; T50-19: N1108, N1125, N1147, K3745; T51-99: DEC-330, DEC-340,
   U348, U366, K3810, K3935): R48, R53, R54, R56, R57 and R61, the one table of what each act does, R62, its sentences read by key, R64 to R66,
   the T50 acts' help, R69, the seven browser acts, R70, the table re-generated at the design commit `8c5e692e19`, and R49, its publication in
   the answer with no target, the very object.

   Since T50 the table is checked against the word list, not against a copy of the design's English (R62): each op is held under the key R48
   reads it by, its help is exactly `word(key)`, and the design's own `reads` list for this module (DEC-258) says which keys those are. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import * as A from "../../../src/affordances.mjs";
import * as G from "../../../src/op-grades/index.mjs";
import { MEMBERSHIP_CHECKS } from "../../../src/membership/index.mjs";
import { word, hasWord, WORD_ROWS } from "../../../src/setup-words/index.mjs";
import { T51_DESIGN_OPS, T51_OWED_OPS, T51_LIST_ONLY_OPS, T51_STANDIN_OPS, T51_STANDIN_HELP, T51_STANDARD_OPS } from "../../../src/affordances/act-help.mjs";

const { ACT_HELP, ACT_HELP_KEYS, BROWSER_ACTS, affordancesAnswer } = A;
const SCREENS = new URL("../../../../docs/development/ux-substrate/screens/", import.meta.url);
const READS = JSON.parse(readFileSync(new URL("words-reads.json", SCREENS), "utf8")).modules.affordances;

/* R65 (T50): the five acts whose ops were owed in T49 are held under their ops, read from the `owed_` words the list holds; no held key starts `owed_` */
const OWED_NOW_T50 = ["projectstakeset", "actionstake", "watchitem", "secondlook", "actioninquiry"];
/* R61: the `owed_` texts held under their ops since T49 (declared, or spelled `op=`, or `founderhandleset`, which op-declarations R71 declares) */
const OWED_NOW = ["versionconsider", "versionreject", "versionrevert", "versioncurrent", "projectfork", "readtranslate", "updatestart",
  "updatelater", "updateskip", "passwordresetlink", "founderhandleset"];
/* R66 (T50; DEC-309 (5)): five more acts the design now explains; R64: `reauth` (DEC-264); R65: `secondlookclear` */
const R66_OPS = ["aliaswithdraw", "factconfirm", "projectrequest", "projectrequestwithdraw", "projectrequestanswer"];
const T50_NEW = ["secondlookclear", "reauth", ...R66_OPS];
/* R70 (T51; DEC-340, U366): the four entries the design re-took at `8c5e692e19`: two with new texts, two new. R62: four more ops whose `does` words the
   design's reads list gives this module (declared ops, held under their own names) */
const R70_OPS = ["actionhold", "holdnoticesent", "holdnoticeprepare", "counselpacket"];
const READS_NEW = ["noticeprepare", "noticepost", "signeradd", "versionnotice", "actionholdrelease" /* DEC-359 */];
/* R69 (T51): the seven browser acts, the design keeping the `owed_` in the key of each */
const R69_ACTS = ["revisioncompare", "hashcopy", "linkopen", "pubfloorset", "pubfloorclear", "pubprint", "reviewexport"];
/* R48's named keys. PR #14 withdrew the five op-less texts and `claimidentity`'s, and dropped `assistantset` (DEC-182 (1)–(3)); DEC-189
   removed the texts of the four ops retired in T41 (DEC-188 (8)). None is in the design, and none is held. */
const WITHDRAWN = ["projectcreated", "countask", "registerproceeding", "deadlinecompute", "claimidentity"];
const RETIRED = ["assistantset", "aiceilingset", "aicopyceilingset", "accountswitchset", "groupswitchset"];
/* R54, K3143 (3): texts no longer in the design, not held: the former `capture` text, and `hostingaccess`'s */
const GONE_R54 = ["capture", "hostingaccess"];
/* R53 (DEC-197; membership R129): handlechange's help is the refusal it now is, membership's own row read by reference; the
   design's text, which still describes a change, is not held */
const HANDLE_REFUSAL = MEMBERSHIP_CHECKS.HANDLE_FIXED.translation;
/* The `does` words the design's `reads` list gives this module that no op of the plane's explains here, each named (QUESTION to BOB, J2):
   `handlechange` (R53) and the installer's four `owed_install*` acts (no op of the plane's). */
const NOT_HELD_READS = ["act.handlechange.does", "act.owed_installalongside.does",
  "act.owed_installremove.does", "act.owed_installremoveconfirm.does", "act.owed_installupdate.does"];
/* The design's ops that no `NEEDS` row gates (reads and doors before a session: the install, the invitation, the searches, the public
   reads), or that are declared reads without a grade (`instance`, `progression`, `captureprogressions`), so `op-grades`' gated totality
   names none of them. */
const UNGATED = ["bootstrap", "login", "invitelook", "search", "frontier", "verify", "publishedcase", "instance", "progression",
  "captureprogressions"];

const { OP_ALIASES } = G;
const gradedOrPublished = (op) => [G.RUNGS, G.RUNG_ABSENT, G.NON_ACTS].some((t) => Object.hasOwn(t, op))
  || [...A.ACTS, ...A.CAPTURE_ACTS, ...A.PER_ITEM_ACTS].some((a) => a.id === op);

/* R48's reading of a word key of the form `act.<k>.does`: the op it explains. `owed_<op>` is `<op>`, an alias is held under its op. */
const opOf = (key) => {
  const k = /^act\.([^.]+)\.does$/.exec(key)?.[1];
  if (k === undefined) return null;
  const bare = k.startsWith("owed_") ? k.slice(5) : k;
  return Object.hasOwn(OP_ALIASES, bare) ? OP_ALIASES[bare] : bare;
};
/* The table the design's reads list (DEC-258) and R48's reading give: each `act.<k>.does` word of the list that is held, under its op,
   its help `word(key)`; handlechange's the refusal (R53). The independent expectation ACT_HELP is held to. */
/* the owed texts held under their own names (R61, R65, R69): an `owed_` key the reads list gives is held only for these; the others name
   ops no declaration yet makes held here (K4248: this module cannot read op-declarations, which is later in the order) */
const OWED_HELD = [...OWED_NOW, ...OWED_NOW_T50, "aliaswithdraw", ...R69_ACTS, ...T51_OWED_OPS];
/* T51 (B14, K4376): the ops op-declarations' registration left without an explanation. `T51_LIST_ONLY_OPS` reads a key the reads list
   does not give; `T51_STANDIN_OPS` reads a `localize` default, the word list holding no sentence for them yet (one QUESTION to BOB). */
/* R71 (K5303): the five Standard acts, words the list holds that its reads list (a generation behind) does not yet give */
const B14_KEYS = [...T51_LIST_ONLY_OPS, ...T51_STANDIN_OPS, ...T51_STANDARD_OPS].map((op) => `act.${op}.does`);
/* the reads list's act keys this module holds */
const readsHeld = (key) => /^act\.[^.]+\.does$/.test(key) && !NOT_HELD_READS.includes(key)
  && !(key.startsWith("act.owed_") && !OWED_HELD.includes(key.slice("act.owed_".length, -".does".length)));
const expected = () => {
  const out = new Map();
  for (const key of READS.reads.filter(readsHeld)) {
    const op = opOf(key);
    if (!out.has(op)) out.set(op, word(key));
  }
  for (const op of [...T51_LIST_ONLY_OPS, ...T51_STANDARD_OPS]) out.set(op, word(`act.${op}.does`));
  for (const op of T51_STANDIN_OPS) out.set(op, T51_STANDIN_HELP[op]);
  out.set("handlechange", HANDLE_REFUSAL);
  return out;
};
/* R48 as a check over a table: the same ops as the reads list gives, each help exactly its word, none an alias, none `owed_`, none retired. */
const meetsR48 = (table) => {
  try {
    const want = expected();
    assert.deepEqual([...Object.keys(table)].sort(), [...want.keys()].sort());
    for (const [op, text] of want) assert.equal(table[op], text, op);
    return true;
  } catch { return false; }
};

test("R48 R53 R54 R56 R57 R61 R62: ACT_HELP is a frozen module constant holding exactly the ops the design's reads list explains, each "
   + "under the key R48 reads it by, once per op: aliases under their op, every owed act under its op and no key starting owed_, "
   + "handlechange as membership's refusal and never the design's text of a change; the withdrawn texts, the retired ops and the texts "
   + "the design dropped nowhere; a table departing from any of these is seen (K874)", () => {
  assert.ok(Object.isFrozen(ACT_HELP));
  assert.ok(meetsR48(ACT_HELP));
  for (const t of Object.values(ACT_HELP)) assert.ok(typeof t === "string" && t.trim().length > 0);
  /* the arithmetic: every `does` word of the reads list is read once, but the seven named (R62) */
  const does = READS.reads.filter(readsHeld);
  assert.equal(new Set(Object.values(ACT_HELP_KEYS)).size, does.length + B14_KEYS.length);
  /* R61, R65: no held key starts owed_; the owed texts are held under their ops, read from the `owed_` words the list holds */
  assert.deepEqual(Object.keys(ACT_HELP).filter((k) => k.startsWith("owed_")), []);
  for (const op of [...OWED_NOW, ...OWED_NOW_T50, "aliaswithdraw"]) {
    assert.ok(Object.hasOwn(ACT_HELP, op), `${op} is held under its op`);
    assert.equal(Object.hasOwn(ACT_HELP, `owed_${op}`), false, op);
    assert.equal(ACT_HELP[op], word(ACT_HELP_KEYS[op]), op);
    assert.ok(hasWord(ACT_HELP_KEYS[op]), `${op}: the list holds its text`);
  }
  /* R53 (DEC-197): handlechange states the refusal, membership's own row, the very string; the design's text, which describes a change, is held nowhere */
  assert.equal(ACT_HELP.handlechange, HANDLE_REFUSAL);
  assert.ok(!Object.values(ACT_HELP).includes(word("act.handlechange.does")));
  assert.equal(ACT_HELP.handlecheck, word("act.handlecheck.does"));
  /* R54, K3143 (3): the texts the design dropped are held nowhere */
  for (const op of GONE_R54) {
    assert.equal(hasWord(`act.${op}.does`), false, `${op} is not in the list`);
    assert.equal(Object.hasOwn(ACT_HELP, op), false, `${op} is not held`);
  }
  for (const k of [...WITHDRAWN, ...RETIRED]) {
    assert.equal(hasWord(`act.${k}.does`), false, `${k} is withdrawn from the design`);
    assert.equal(Object.hasOwn(ACT_HELP, k), false, `${k} is not held`);
    assert.equal(Object.hasOwn(ACT_HELP, `owed_${k}`), false, k);
  }
  /* R54's own texts, R56's, and the ops the design re-keyed: each held under its op as the list gives it */
  for (const op of ["captureupload", "ask", "subscriptiondisconnect", "clockproposals", "joindoors", "statusreportassist", "airundispatch",
                    "actionscope", "itemtakeup", "filingsecondapprove", "escalationstoppursuing", "infolevelset", "subscriptionsignin",
                    "projectaikeepaway", "unlock", "passwordreset", "grouplogoset", "grouplanguagesset", "signrequest", "projectlist",
                    "projectquestions", "drawquestion", "projectbarset", "monitorset", "recover", "publish", "caseratify", "publishat",
                    "clockpropose", "escalationreopen", "textcheck", "peopledirectory", "queuemute"])
    assert.equal(ACT_HELP[op], word(`act.${op}.does`), op);
  assert.equal(ACT_HELP.selftest, word("act.selftest.does"));
  /* R61: `projectownervotes` has no text, so none is held for it */
  assert.equal(hasWord("act.projectownervotes.does") || hasWord("act.owed_projectownervotes.does"), false);
  assert.equal(Object.hasOwn(ACT_HELP, "projectownervotes"), false);

  /* negative controls (K874): each way a table can depart from R48, R53, R54, R56, R61 and R65 is seen by the same check */
  const rekey = (from, to) => Object.fromEntries(Object.entries(ACT_HELP).map(([k, v]) => [k === from ? to : k, v]));
  const without = (op) => Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
  const variants = {
    "a retired op's text held": { ...ACT_HELP, aiceilingset: ACT_HELP.queuemute },
    "a declared owed text held under owed_<op>": rekey("versionconsider", "owed_versionconsider"),
    "founderhandleset held under owed_": rekey("founderhandleset", "owed_founderhandleset"),
    "an owed text of T50 held under owed_": rekey("watchitem", "owed_watchitem"),
    "the update acts held under owed_": rekey("updatestart", "owed_updatestart"),
    "an op left out": without("drawquestion"),
    "a T50 act left out": without("secondlookclear"),
    "an owed text missing": without("handlecheck"),
    "one of the new texts missing": without("stepsource"),
    "the readtranslate text missing": without("readtranslate"),
    "capture's former text still held": { ...ACT_HELP, capture: ACT_HELP.queuemute },
    "handlechange's design text held": { ...ACT_HELP, handlechange: word("act.handlechange.does") },
    "a text re-worded here": { ...ACT_HELP, exploreapprove: ACT_HELP.exploreapprove.replace("today", "now") },
    "projectownervotes given a text": { ...ACT_HELP, projectownervotes: ACT_HELP.queuemute },
    "a fifth entry with no op (R70)": { ...ACT_HELP, notanop: ACT_HELP.queuemute },
    "a browser act left out (R69)": without("pubprint"),
    "a browser act held under owed_ (R69)": rekey("hashcopy", "owed_hashcopy"),
    "a re-taken entry left out (R70)": without("counselpacket"),
  };
  for (const [what, table] of Object.entries(variants)) assert.equal(meetsR48(table), false, what);
});

test("R65 R66 R64 (T50; N1147; DEC-264, DEC-309 (5); K3745): the five owed acts (watchitem, secondlook, projectstakeset, actionstake, "
   + "actioninquiry), secondlookclear, the five acts the design now explains (aliaswithdraw, factconfirm, projectrequest, "
   + "projectrequestwithdraw, projectrequestanswer) and reauth are each held under their op, answering their `does` word; no key "
   + "starts owed_; an op in neither ACT_HELP nor the reads of op-declarations' ACT_HELP_ABSENT fails the partition", () => {
  for (const op of OWED_NOW_T50) {
    assert.equal(ACT_HELP_KEYS[op], `act.owed_${op}.does`, `R65: ${op} is read from its owed_ word`);
    assert.equal(ACT_HELP[op], word(`act.owed_${op}.does`), op);
  }
  assert.equal(ACT_HELP_KEYS.secondlookclear, "act.secondlookclear.does");
  assert.equal(ACT_HELP.secondlookclear, word("act.secondlookclear.does"));
  assert.equal(ACT_HELP_KEYS.aliaswithdraw, "act.owed_aliaswithdraw.does", "R66: the registry's owed:aliaswithdraw, K3674");
  assert.equal(ACT_HELP.aliaswithdraw, word("act.owed_aliaswithdraw.does"));
  for (const op of ["factconfirm", "projectrequest", "projectrequestwithdraw", "projectrequestanswer"]) {
    assert.equal(ACT_HELP_KEYS[op], `act.${op}.does`, op);
    assert.equal(ACT_HELP[op], word(`act.${op}.does`), `R66: ${op}`);
  }
  /* R64: reauth, held under act.reauth.does (DEC-264) */
  assert.equal(ACT_HELP_KEYS.reauth, "act.reauth.does");
  assert.equal(ACT_HELP.reauth, word("act.reauth.does"));
  for (const op of T50_NEW) assert.ok(Object.hasOwn(ACT_HELP, op), `${op} is held`);
  assert.deepEqual(Object.keys(ACT_HELP).filter((k) => k.startsWith("owed_")), []);
  /* control: a table with a T50 act dropped, or kept under its owed_ key, departs */
  const without = (op) => Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
  for (const op of T50_NEW) assert.equal(meetsR48(without(op)), false, op);
  assert.equal(meetsR48({ ...without("watchitem"), owed_watchitem: ACT_HELP.watchitem }), false);
});

test("R62 R65: the keys the design's reads list gives this module are all words; every `does` word of it is held here but the seven named "
   + "(QUESTION J2), and every held op's key is one of them", () => {
  const does = READS.reads.filter((k) => readsHeld(k) || NOT_HELD_READS.includes(k));
  for (const k of READS.reads) assert.ok(hasWord(k), `${k} is a word`);
  const held = new Set(Object.values(ACT_HELP_KEYS));
  assert.deepEqual(does.filter((k) => !held.has(k)).sort(), NOT_HELD_READS.filter((k) => does.includes(k)).sort());
  assert.deepEqual([...held].filter((k) => !READS.reads.includes(k) && !B14_KEYS.includes(k)), []);
  for (const k of NOT_HELD_READS) assert.equal(Object.hasOwn(ACT_HELP, opOf(k) ?? k), k === "act.handlechange.does", k);
});

test("R61 R62 (T51, B14; K4376): the ops op-declarations' registration leaves without an explanation are held under their ops: the owed "
   + "texts under their own ops, `contradictionflag` under its word-list key, and the nine with no word-list sentence under their own "
   + "stand-in keys, each answering its plain default; a table dropping any of them departs", () => {
  for (const op of T51_OWED_OPS) assert.equal(ACT_HELP[op], word(`act.owed_${op}.does`), op);
  assert.equal(ACT_HELP.contradictionflag, word("act.contradictionflag.does"));
  for (const op of T51_STANDIN_OPS) {
    assert.equal(ACT_HELP[op], T51_STANDIN_HELP[op], op);
    // a stand-in is read under its key: while the list holds no design row it is the code's default (source "code"); once the design
    // row lands (readheld, DEC-413) the key reads the design's sentence and the table answers `word(key)`
    const row = WORD_ROWS.find((r) => r[0] === `act.${op}.does`);
    if (row?.[5] === "design") assert.equal(ACT_HELP[op], word(`act.${op}.does`), `${op}: the design's row now stands`);
  }
  const without = (op) => Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
  for (const op of [...T51_OWED_OPS, ...T51_LIST_ONLY_OPS, ...T51_STANDIN_OPS]) assert.equal(meetsR48(without(op)), false, op);
});

test("R48 R34 R61 (T51, K5164): `authority` (provenance's read, R80) and `ruleservicesstate` (answers' read) are explained in ACT_HELP under their own "
   + "names, each its stand-in sentence under `act.<op>.does`, so op-declarations' R34 finds neither unexplained; a table dropping either departs", () => {
  for (const op of ["authority", "ruleservicesstate"]) {
    assert.ok(T51_STANDIN_OPS.includes(op), op);
    assert.equal(ACT_HELP[op], T51_STANDIN_HELP[op], op);
    assert.equal(ACT_HELP_KEYS[op], `act.${op}.does`, op);
    assert.ok(ACT_HELP[op].length > 0, op);
    const without = Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
    assert.equal(meetsR48(without), false, op);
  }
});

test("R48 R62 (T51, K4900, K4968; capture R113): the four steps of a file sent in parts are member ops this table explains under their own names, "
   + "each a sentence read from the design's row for its own key (DEC-431) and none shared; a table dropping any of them, or giving two the one "
   + "sentence, departs", () => {
  const parts = ["captureuploadbegin", "captureuploadpart", "captureuploadcomplete", "captureuploadabort"];
  assert.deepEqual(parts.filter((op) => T51_STANDIN_OPS.includes(op)), [], "the design gave the rows: no captureupload step is a stand-in");
  for (const op of parts) {
    assert.ok(T51_DESIGN_OPS.includes(op), `${op} is a design op`);
    assert.ok(Object.hasOwn(ACT_HELP, op), `${op} is held under its own name`);
    assert.equal(ACT_HELP_KEYS[op], `act.${op}.does`, op);
    assert.ok(hasWord(ACT_HELP_KEYS[op]), `${op}: the list holds its text`);
    assert.ok(READS.reads.includes(ACT_HELP_KEYS[op]), `${op}: the reads list gives its key`);
    assert.equal(ACT_HELP[op], word(ACT_HELP_KEYS[op]), op);
    assert.ok(typeof ACT_HELP[op] === "string" && ACT_HELP[op].trim().length > 0, op);
    const without = Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
    assert.equal(meetsR48(without), false, `${op}: a table without it is seen`);
  }
  assert.equal(new Set(parts.map((op) => ACT_HELP[op])).size, parts.length, "no two share a sentence");
  assert.equal(meetsR48({ ...ACT_HELP, captureuploadpart: ACT_HELP.captureuploadbegin }), false, "a shared sentence is seen");
});

test("R61: the 13 ops op-declarations' ACT_HELP_ABSENT named for want of text have it, each answering its own word; `founderhandleset` is held "
   + "and `projectownervotes` is not", () => {
  for (const op of ["readtranslate", "planask", "stepsource", "stepsourcewithdraw", "actionreplyquoting", "lookedsince", "proceedingdates",
                    "updatenotice", "aiuseovertime", "exploregraph", "standardproposals", "filingread", "pressurefor"]) {
    assert.ok(Object.hasOwn(ACT_HELP, op), `${op} is held`);
    assert.equal(ACT_HELP[op], word(ACT_HELP_KEYS[op]), op);
  }
  assert.ok(Object.hasOwn(ACT_HELP, "founderhandleset"));
  assert.equal(ACT_HELP.founderhandleset, word("act.owed_founderhandleset.does"));
  assert.equal(Object.hasOwn(ACT_HELP, "projectownervotes"), false);
  for (const op of OWED_NOW) assert.equal(Object.hasOwn(ACT_HELP, `owed_${op}`), false, op);
});

test("R62: ACT_HELP holds its sentences as keys read through setup-words: every key it reads is a word (hasWord), each op's help is "
   + "exactly word(key) for its key, a key the word list lacks is not answered, and every key the design's reads list gives this "
   + "module is a word", () => {
  assert.ok(Object.isFrozen(ACT_HELP_KEYS));
  const ops = Object.keys(ACT_HELP).filter((op) => op !== "handlechange");
  assert.deepEqual(Object.keys(ACT_HELP_KEYS), ops, "a key for every held op but handlechange, in order");
  for (const [op, key] of Object.entries(ACT_HELP_KEYS)) {
    if (T51_STANDIN_OPS.includes(op)) { assert.equal(ACT_HELP[op], T51_STANDIN_HELP[op], op); continue; }
    assert.ok(hasWord(key), `${op}: ${key} is a word`);
    assert.equal(ACT_HELP[op], word(key), op);
  }
  /* a sample of keys over fixtures: what the module answers for them is word(key, vars), the English left to the list */
  for (const op of ["publish", "versionconsider", "founderhandleset", "updatestart", "watchitem", "transcribe", "queuemute"])
    assert.equal(ACT_HELP[op], word(ACT_HELP_KEYS[op]), op);
  assert.equal(Object.hasOwn(ACT_HELP_KEYS, "handlechange"), false, "handlechange is read from membership's refusal row (R53)");
  assert.ok(READS.reads.length >= 405);
  for (const k of READS.reads) assert.ok(hasWord(k), `${k} is a word`);
  /* controls: an unknown key is not a word, so a table naming one cannot load; the design's text of a change is not read */
  assert.equal(hasWord("act.noop.does"), false);
  assert.throws(() => word("act.noop.does"), { code: "UNKNOWN_WORD" });
  assert.equal(Object.values(ACT_HELP).includes(word("act.handlechange.does")), false);
});

test("R48 (T43-17, T44-9; DEC-190, DEC-191): transcribe and pagetranscribe, both declared since T42, are held under their ops, read by "
   + "key: act.transcribe.does and act.pagetranscribe.does; the design keys neither as owed_; an op the design gives no help is absent, "
   + "never guessed", () => {
  for (const op of ["transcribe", "pagetranscribe"]) assert.ok(gradedOrPublished(op), `${op} is declared and graded`);
  assert.equal(hasWord("act.owed_pagetranscribe.does"), false);
  assert.equal(ACT_HELP_KEYS.transcribe, "act.transcribe.does");
  assert.equal(ACT_HELP_KEYS.pagetranscribe, "act.pagetranscribe.does");
  assert.equal(ACT_HELP.transcribe, word("act.transcribe.does"));
  assert.equal(ACT_HELP.pagetranscribe, word("act.pagetranscribe.does"));
  assert.equal(Object.hasOwn(ACT_HELP, "owed_pagetranscribe"), false);
  /* control: a declared, graded op the design gives no help (translationmark, T37) is absent, as is any op without a text */
  assert.ok(gradedOrPublished("translationmark"));
  assert.equal(hasWord("act.translationmark.does"), false);
  assert.equal(Object.hasOwn(ACT_HELP, "translationmark"), false);
  for (const k of Object.keys(ACT_HELP).filter((k) => k !== "handlechange" && !T51_STANDIN_OPS.includes(k)))
    assert.ok(hasWord(ACT_HELP_KEYS[k]), `${k} has a registry text`);
  /* each way the two can depart is seen */
  const without = (op) => Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
  const variants = {
    "transcribe missing": without("transcribe"),
    "pagetranscribe missing": without("pagetranscribe"),
    "pagetranscribe under owed_": Object.fromEntries(Object.entries(ACT_HELP).map(([k, v]) => [k === "pagetranscribe" ? "owed_pagetranscribe" : k, v])),
    "transcribe's text differing": { ...ACT_HELP, transcribe: ACT_HELP.transcribe.replace("yourself", "by hand") + " " },
  };
  for (const [what, table] of Object.entries(variants)) assert.equal(meetsR48(table), false, what);
});

test("R48 R53 R61 R65: no key is an alias or a retired op; every alias the list explains is answered by its op's entry; no key starts "
   + "owed_; every key is an op op-grades grades or names, or one of the design's ungated ops, or one op-declarations R71 declares in T49 "
   + "(founderhandleset) or R73 declares in T50", () => {
  const keys = Object.keys(ACT_HELP);
  for (const k of keys) {
    assert.equal(Object.hasOwn(OP_ALIASES, k), false, `${k} is no alias`);
    assert.ok(![...WITHDRAWN, ...RETIRED].includes(k), `${k} is not held`);
  }
  for (const [a, op] of Object.entries(OP_ALIASES))
    if (hasWord(`act.${a}.does`) && !NOT_HELD_READS.includes(`act.${a}.does`)) assert.ok(Object.hasOwn(ACT_HELP, op), `${a} → ${op}`);
  assert.equal(ACT_HELP.identityclaim, word(ACT_HELP_KEYS.identityclaim));
  assert.deepEqual(keys.filter((k) => k.startsWith("owed_")), []);
  /* founderhandleset (op-declarations R71, T49) and the T50 acts (R73; op-grades T50-18) are held under their ops now, graded once those merge */
  /* the T51 design ops (K4248) are declared by op-declarations and graded when op-grades registers them at the plane's start (R49), not in these tables */
  /* T51 (B14, K4376): the owed and stand-in ops are declared by op-declarations and graded at the plane's registration likewise (R49) */
  const NOT_YET_GRADED = ["founderhandleset", ...OWED_NOW_T50, "secondlookclear", ...T51_DESIGN_OPS, ...T51_OWED_OPS,
    ...T51_LIST_ONLY_OPS, ...T51_STANDIN_OPS];
  /* R69: the browser acts are no ops, so op-grades neither grades nor names them */
  for (const k of keys.filter((k) => !NOT_YET_GRADED.includes(k) && !R69_ACTS.includes(k)))
    assert.ok(gradedOrPublished(k) || UNGATED.includes(k), `${k} is an op op-grades grades or names`);
  for (const k of UNGATED) assert.equal(gradedOrPublished(k), false, `${k} is ungated`);
});

const gate = { needs: () => null, mode: () => "session" };
const facts = { ok: true, target: "inquiry-1", object_type: "inquiry", declared_type: "inquiry", current_state: "open" };

test("R49: the answer with no target carries act_help, ACT_HELP itself (the same reference, never a copy); a targeted "
   + "answer and a refusal do not carry it", () => {
  const none = affordancesAnswer({ kinds: [], gate });
  assert.equal(none.target, null);
  assert.equal(none.act_help, ACT_HELP);
  const one = affordancesAnswer({ target: "inquiry-1", facts, kinds: [], gate });
  assert.equal(one.target, "inquiry-1");
  assert.equal(Object.hasOwn(one, "act_help"), false);
  const refused = affordancesAnswer({ target: "x", facts: { ok: false, reason: "NO_SUCH_BUNDLE" }, kinds: [], gate });
  assert.equal(Object.hasOwn(refused, "act_help"), false);
});

test("R49 at the door: op=affordances with no target answers act_help as ACT_HELP itself, and with a target without it", async () => {
  const stub = { fetch: async (u) => u };
  const doAnswer = async (u) => {
    u = await u;
    if (u.startsWith("http://do/actionkinds")) return { answered: true, result: { kinds: [] } };
    if (u.startsWith("http://do/affordancescreens")) return { answered: true, result: { screens: [], wizard_scripts: [] } };
    return { answered: true, result: facts };
  };
  const json = (body, status) => ({ body, status });
  const env = { json, doAnswer, storeSilent: () => ({ silent: true }), storeRefusal: () => ({ refused: true }), gate,
    viewer: "m1", identity: "m1", author: "m1", by: "m1", storeName: "s", cls: "member" };
  const a = await A.affordancesOp(new URL("http://x/?op=affordances"), stub, env);
  assert.equal(a.status, 200);
  assert.equal(a.body.result.act_help, ACT_HELP);
  const b = await A.affordancesOp(new URL("http://x/?op=affordances&target=inquiry-1"), stub, env);
  assert.equal(b.status, 200);
  assert.equal(Object.hasOwn(b.body.result, "act_help"), false);
});

test("R57 R61: ACT_HELP holds the design in DEC-221's American spelling, no held text containing \"labelled\"; peopledirectory held, "
   + "selftest held under its own word (the design's reads list gives it, K4248; U421), "
   + "a table with the old spelling is seen", () => {
  for (const [k, t] of Object.entries(ACT_HELP)) assert.doesNotMatch(t, /labelled/i, k);
  assert.equal(ACT_HELP.peopledirectory, word("act.peopledirectory.does"));
  /* selftest: its word is among the keys this module reads (R62), so it is held under its own name */
  assert.equal(READS.reads.includes("act.selftest.does"), true);
  assert.equal(ACT_HELP.selftest, word("act.selftest.does"));
  /* controls (K874): the old spelling, an update text dropped, a stale entry, and a held act's text under the wrong op are each seen by the check */
  assert.equal(meetsR48({ ...ACT_HELP, testify: ACT_HELP.testify.replace("labeled", "labelled") }), false);
  assert.equal(meetsR48(Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== "updateskip"))), false);
  assert.equal(meetsR48({ ...ACT_HELP, selftest: ACT_HELP.queuemute }), false);
  assert.equal(meetsR48(Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== "selftest"))), false);
});

test("R69: the seven browser acts (revisioncompare, hashcopy, linkopen, pubfloorset, pubfloorclear, pubprint, reviewexport) are held in ACT_HELP "
   + "under their own names, each answering the design's `act.owed_<name>.does` word; none is an act or a graded op, so the catalogue and R12's "
   + "three lists neither carry nor miss one; BROWSER_ACTS names exactly the seven", () => {
  assert.deepEqual([...BROWSER_ACTS], R69_ACTS);
  assert.ok(Object.isFrozen(BROWSER_ACTS));
  for (const name of R69_ACTS) {
    assert.equal(ACT_HELP_KEYS[name], `act.owed_${name}.does`, `${name}: the design keeps the owed_ in its key`);
    assert.ok(hasWord(ACT_HELP_KEYS[name]), name);
    assert.equal(ACT_HELP[name], word(`act.owed_${name}.does`), name);
    assert.equal(Object.hasOwn(ACT_HELP, `owed_${name}`), false, `${name} is held under its name`);
    /* control: none is an op the plane grades or publishes, so it is in no registry R12 counts */
    assert.equal(gradedOrPublished(name), false, `${name} is not an op`);
  }
  const answer = affordancesAnswer({ kinds: [], gate: { needs: () => null, mode: () => "session" } });
  assert.equal(answer.act_help, ACT_HELP);
  for (const name of R69_ACTS) {
    assert.equal(answer.catalog.some((a) => a.id === name) || answer.capture_acts.some((a) => a.id === name)
                 || answer.set_acts.some((a) => a.id === name), false, `${name} is in no list of acts`);
    assert.ok(Object.hasOwn(answer.act_help, name), `${name} is drawn from act_help`);
  }
  /* R12: the totality over a table of ops neither lists nor misses one of them (they are no ops) */
  const none = A.unaccounted([]);
  for (const list of Object.values(none)) assert.deepEqual(list.filter((op) => R69_ACTS.includes(op)), []);
  /* controls: a table without one of them departs, and one holding an eighth under another name departs */
  const without = (op) => Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
  for (const name of R69_ACTS) assert.equal(meetsR48(without(name)), false, name);
  assert.equal(meetsR48({ ...ACT_HELP, eighthbrowseract: ACT_HELP.hashcopy }), false);
});

test("R70: ACT_HELP is re-generated at the design commit `8c5e692e19`: actionhold and holdnoticesent are held with the design's texts, "
   + "holdnoticeprepare and counselpacket are new entries, each answering its `act.<op>.does` word and the text of mock-acts.js at that commit; "
   + "R62's four more (noticeprepare, noticepost, signeradd, versionnotice) are held under their own names", () => {
  const FILE = readFileSync(new URL("mock-acts.js", SCREENS), "utf8");
  /* the file's entry for an op: `  <op>: '<text>',` with the quote escaped as in a JavaScript string */
  const fileText = (op) => {
    const m = new RegExp(`^\\s+${op}:\\s*'((?:[^'\\\\]|\\\\.)*)'`, "m").exec(FILE);
    return m ? m[1].replace(/\\(.)/g, "$1") : null;
  };
  for (const op of R70_OPS) {
    assert.equal(ACT_HELP_KEYS[op], `act.${op}.does`, op);
    assert.ok(hasWord(ACT_HELP_KEYS[op]), `${op}: the list holds its text`);
    assert.equal(ACT_HELP[op], word(`act.${op}.does`), op);
    assert.equal(ACT_HELP[op], fileText(op), `${op}: the table equals the file's entry`);
  }
  for (const op of READS_NEW) {
    assert.equal(ACT_HELP_KEYS[op], `act.${op}.does`, op);
    assert.equal(ACT_HELP[op], word(`act.${op}.does`), op);
  }
  /* `ACT_HELP_ABSENT` keeps none of them (op-declarations R34); the partition holds against this table, so each is held here */
  for (const op of [...R70_OPS, ...READS_NEW]) assert.ok(Object.hasOwn(ACT_HELP, op), op);
  /* controls (K874): a table without one of the four, or with an old text, departs; a fifth entry with no op departs */
  const without = (op) => Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
  for (const op of R70_OPS) assert.equal(meetsR48(without(op)), false, op);
  assert.equal(meetsR48({ ...ACT_HELP, actionhold: ACT_HELP.actionhold + " and more" }), false);
  assert.equal(meetsR48({ ...ACT_HELP, afifthentry: ACT_HELP.actionhold }), false);
});

test("B12 (T51, K4258; R48, R62): `strengthbarset`, the op strength declares and screens-settings sends, is held under its own name from "
   + "`act.strengthbarset.does`; `strengthbar`, whose text the design does not give and which no screen sends, is held none; "
   + "each other entry is as before, and the table departs from R48 with either change left out", () => {
  assert.ok(READS.reads.includes("act.strengthbarset.does"), "the reads list gives the text");
  assert.ok(T51_DESIGN_OPS.includes("strengthbarset"), "strengthbarset is one of the declared ops the reads list explains (K4248)");
  assert.equal(ACT_HELP_KEYS.strengthbarset, "act.strengthbarset.does");
  assert.equal(ACT_HELP.strengthbarset, word("act.strengthbarset.does"));
  assert.ok(hasWord("act.strengthbarset.does"));
  /* the design gives no `act.strengthbar.does`, and `strengthbar` is no alias of strengthbarset (op-declarations R21, K4254) */
  assert.equal(hasWord("act.strengthbar.does"), false);
  assert.equal(Object.hasOwn(ACT_HELP, "strengthbar"), false, "strengthbar is held none");
  assert.equal(Object.hasOwn(ACT_HELP_KEYS, "strengthbar"), false);
  /* controls (K874): the table as it stood, with `strengthbar` holding strengthbarset's text, departs from R48; so does one without it */
  const without = (op) => Object.fromEntries(Object.entries(ACT_HELP).filter(([k]) => k !== op));
  assert.equal(meetsR48({ ...ACT_HELP, strengthbar: ACT_HELP.strengthbarset }), false, "a text held under the op that does not own it");
  assert.equal(meetsR48(without("strengthbarset")), false, "the op left out");
  assert.equal(meetsR48(ACT_HELP), true, "the table as it now stands meets R48");
});

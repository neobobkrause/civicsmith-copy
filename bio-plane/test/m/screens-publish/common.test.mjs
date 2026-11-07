/* screens-publish R10 and R11 (with interface-shell R5, R8–R13, R16 and R21 on this module's screens), on the shell's
 * served page: each screen with each of its reads pending, refused and unanswered draws that read in its own state and
 * no key the page holds no word for; after an act the screen reads again what it changed; no secret is kept; the
 * module's screens are the registry's, each drawing exactly its registry acts; it holds no English, only keys (R24). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { interfacePage, SHELL_OPS } from "../../../src/interface-shell/index.mjs";
import { OPS, BROWSER_ACTS } from "../../../src/op-declarations/index.mjs";
import { WORD_ROWS } from "../../../src/setup-words/index.mjs";
import { SCREEN_WORDS } from "../../../src/screens-publish/index.mjs";
import { groupName, open, main, text, drew, ops, choose, press, rawKeys, keptKey, answerSign, tick, ok, refusedIn, silent, pending, hasWord, word, SCREENS, plane as plane0, COPY, P, DR, C, GRANT_SECRET } from "./fixtures.mjs";
const GROUP = await groupName();

const REGISTRY = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/registry.json", import.meta.url), "utf8"));
const READS = JSON.parse(readFileSync(new URL("../../../../docs/development/ux-substrate/screens/words-reads.json", import.meta.url), "utf8")).modules["screens-publish"];
const PAGES = {
  "case-editor": [`/app/case-editor/${P}`, {}],
  "review-copy": [`/app/review-copy/${P}`, {}],
  ceremony: [`/app/ceremony/${P}/${DR}`, {}],
  published: [`/app/published/${C}`, { session: null }],
  imported: ["/app/imported/IMP-2026-0001", {}],
  docket: [`/app/docket/${P}/${C}`, {}],
  "docket-public": [`/app/docket-public/${C}`, { session: null }],
  doorbell: ["/app/doorbell", { session: null }],
  "review-outside": ["/app/review", { session: null, hash: "#grant=" + GRANT_SECRET }],
};
/* N1073 (K3268): the reads a page makes are not hand-listed here, where they belong to review, docket, case-import and
   others: they are the ops the page itself asks for when it opens, read from its requests, each an op `op-declarations`
   declares as a read. The shell's own (the session, the words, the group's name) are the shell's and are left out. A read
   is one the page draws when holding its answer back draws the loading state; one it makes only to learn a value another
   part draws (the group's time zone) is not drawn on its own. */
const readsOf = async (path, boot) => {
  const p = await open(path, { boot });
  const ops = [...new Set(p.requests.map((r) => r.op))].filter((op) => op && !SHELL_OPS.includes(op) && OPS[op] && OPS[op].mutating === false);
  const drawn = [];
  for (const op of ops) {
    const q = await open(path, { boot, plane: { [op]: pending } });
    if (main(q).querySelector('[data-state="loading"]')) drawn.push(op);
  }
  return drawn;
};
const VARIANTS = { refused: refusedIn("SOME_REFUSAL", "The plane refused this read."), silent, pending };

for (const [id, [path, boot]] of Object.entries(PAGES)) {
  test(`R10 ${id}: each read pending, refused and unanswered is drawn in its own state, the screen kept, no key drawn bare (interface-shell R5, R10, R13)`, async () => {
    const reads = await readsOf(path, boot);
    assert.ok(id === "doorbell" ? reads.length === 0 : reads.length > 0, `${id}: the page's reads, read from its requests`);
    const p0 = await open(path, { boot });
    assert.deepEqual(rawKeys(p0.root()), [], `${id} with every read answered`);
    for (const op of reads) for (const [name, answer] of Object.entries(VARIANTS)) {
      const p = await open(path, { boot, plane: { [op]: answer } });
      const m = main(p);
      const want = name === "pending" ? "loading" : "failed";
      assert.ok(m.querySelector(`[data-state="${want}"]`), `${id}: ${op} ${name} drawn ${want}`);
      if (name === "refused") assert.match(m.querySelector('[data-state="failed"]').textContent, /The plane refused this read|SOME_REFUSAL/, `${id}: ${op}`);
      assert.ok(m.querySelector("h1"), `${id} with ${op} ${name}: the screen stays`);
      assert.deepEqual(rawKeys(p.root()), [], `${id} with ${op} ${name}`);
    }
  });
}

test("R10 an empty read is drawn empty, never failed: no drafts, no comments, no imports, no docket entries", async () => {
  const none = { casedrafts: ok({ drafts: [] }), importedcases: ok({ imports: [] }), docket: ok({ case: C, entries: [] }), reviewcomments: ok({ comments: [] }) };
  for (const path of [`/app/case-editor/${P}`, "/app/imported", `/app/docket/${P}/${C}`]) {
    const p = await open(path, { plane: none });
    assert.ok(main(p).querySelector('[data-state="empty"]'), path);
    assert.equal(main(p).querySelector('[data-state="failed"]'), null, path);
  }
  const q = await open(`/app/review-copy/${P}`, { plane: { reviewcopy: ok(COPY({ comments: [], statement_acknowledgements: null })) } });
  assert.ok(!drew(q, "screen.review-copy.comments"), "R20: a section that holds nothing is not drawn");
  assert.equal(q.root().querySelector('[data-state="failed"]'), null);
});

test("R10 after an act the screen reads again what it changed and draws it; nothing is drawn prepared before its answer", async () => {
  let n = 0;
  const p = await open(`/app/review-copy/${P}`, { plane: { reviewcopy: () => { n += 1; return ok({ ...JSON.parse(JSON.stringify((plane0()).reviewcopy.json.result)), grants: n > 1 ? [] : [{ grant_id: "GRT-1", recipient: "Ana" }] }); } } });
  assert.match(text(p), /Ana/);
  await press(p, "reviewrevoke", { reason: "done" });
  assert.ok(n > 1, "the copy read again");
  assert.ok(!drew(p, "screen.review-copy.readers"), "R20: with nobody named, no section of readers");
  assert.ok(drew(p, "screen.review-copy.share"));
  const q = await open(`/app/ceremony/${P}/${DR}`, { plane: { publish: pending } });
  tick(q, "ce-tie", "yes");
  await press(q, "publish", { reason: "r" });
  assert.ok(!drew(q, "screen.ceremony.prepared", { edition: "2" }), "not drawn prepared while publish has not answered");
});

test("R11 no secret is written to storage, an address or a later request: the grant's secret, the outside reader's, the signatures", async () => {
  const p = await open(`/app/ceremony/${P}/${DR}`, { boot: { idb: await keptKey() } });
  tick(p, "ce-tie", "yes");
  await press(p, "publish", { reason: "r" });
  await press(p, "caseratify", { reason: "r" });
  await answerSign(p, true, "caseratify");
  const sigReq = p.requests.find((r) => r.op === "caseratify");
  assert.ok(sigReq, "signed");
  for (const r of p.requests.filter((x) => x !== sigReq)) assert.ok(!JSON.stringify([r.url, r.body]).includes("SSH SIGNATURE"), `${r.op} carries no signature`);
  for (const v of [...p.store.values(), ...p.local.values()]) assert.ok(!String(v).includes("SSH SIGNATURE"));
  assert.ok(!p.location.pathname.includes("SIG"));
  const q = await open("/app/review", { boot: { session: null, hash: "#grant=" + GRANT_SECRET } });
  await press(q, "reviewcomment", { values: { "ro-comment": "x" } });
  for (const r of q.requests) assert.ok(!r.url.includes(GRANT_SECRET), "the secret in no address");
  for (const v of [...q.store.values(), ...q.local.values()]) assert.ok(!String(v).includes(GRANT_SECRET), "nor in storage");
  assert.ok(!String(q.location.hash).includes(GRANT_SECRET) && !q.location.pathname.includes(GRANT_SECRET));
});

test("R10 (interface-shell R21) the nine registry screens, each drawing exactly its registry acts, labelled act.<op>.label.<screen>; the shell serves them", () => {
  assert.equal(typeof interfacePage(SCREENS), "string", "interface-shell R21's check passes");
  assert.deepEqual(SCREENS.map((s) => s.id), ["case-editor", "review-copy", "ceremony", "published", "imported", "docket", "docket-public", "doorbell", "review-outside"]);
  for (const s of SCREENS) {
    const reg = REGISTRY.screens.find((x) => x.id === s.id);
    assert.ok(reg, `${s.id} is a registry screen`);
    /* op-declarations R76: the registry keeps an act done in the browser alone as `owed:<act> DEC-330`; the table names it for the screen */
    const browser = (op) => Object.hasOwn(BROWSER_ACTS, op) && BROWSER_ACTS[op].screen === s.id;
    /* an act the registry holds as `owed:<op> <ref>` is the op itself once its owner declares it (FR-30: `casedetails`, `casedetailsset`) */
    const owed = (op) => { const m = /^owed:(\S+)/.exec(op); return m && Object.hasOwn(OPS, m[1]) ? m[1] : op; };
    /* an act the registry still owes (`owed:<op> <ref>`) whose owner has not declared it is drawn by no screen yet (interface-shell R12;
       R87's `mailnameshow`, `mailnamewithhold` wait on `case-disclosures` R45) */
    const undeclared = (op) => /^owed:/.test(op) && owed(op) === op && !Object.values(BROWSER_ACTS).some((b) => b.screen === s.id && b.registry === op);
    const named = reg.acts.filter((a) => !undeclared(a.op)).map((a) => (Object.entries(BROWSER_ACTS).find(([, b]) => b.screen === s.id && b.registry === a.op) || [owed(a.op)])[0]);
    assert.deepEqual(s.acts.map((a) => a.op).sort(), named.sort(), s.id);
    for (const a of s.acts) {
      assert.ok(browser(a.op) ? !Object.hasOwn(OPS, a.op) : Object.hasOwn(OPS, a.op), `${a.op} is a browser act or in OPS`);
      /* the design keys an act the registry holds as `owed:<op> <ref>` under that owed name, whether the op is declared yet or not */
      const owedRow = reg.acts.some((x) => String(x.op).startsWith(`owed:${a.op} `));
      assert.equal(a.label, browser(a.op) || owedRow ? `act.owed_${a.op}.label.${s.id}` : `act.${a.op}.label.${s.id}`);
      assert.ok(s.words.some((w) => (typeof w === "string" ? w : w[0]) === a.label), `${a.label} listed`);
      if (browser(a.op) || owedRow) assert.ok(s.words.includes(`act.owed_${a.op}.does`), `${a.op}: its explanation listed`);
    }
    assert.ok(Object.isFrozen(s) && typeof s.render === "function" && typeof s.reads === "function");
  }
});

/* R22's and R23's keys, named by the requirements beside the design stream's `reads` list for this module (R24). */
const NAMED = ["published.check.title", "published.check.help", "published.check.field", "published.check.field.help", "published.check.go",
  "published.check.yes", "published.check.no", "review.statement.title", "review.statement.help", "review.statement.note",
  "review.statement.note.help", "review.statement.ack", "act.statementack.label.review-outside"];

test("R24 the module holds no English: every key it reads (the design stream's reads list for it, and the keys R22 and R23 name) is a word setup-words holds, each screen's words are keys only, and it has no rows of its own", () => {
  assert.deepEqual(READS.unkeyed, [], "no sentence of the module is left unkeyed");
  const listed = new Set(SCREENS.flatMap((s) => s.words));
  for (const s of SCREENS) for (const w of s.words) assert.ok(typeof w === "string" && hasWord(w), `${s.id}: ${String(w)} is a word`);
  for (const k of [...READS.reads, ...NAMED]) {
    assert.ok(hasWord(k), `${k} is a word`);
    assert.ok(listed.has(k), `${k} is listed by a screen that may draw it`);
  }
  /* N1068 (DEC-221): "labeled", never "labelled", in the words the module draws */
  const mine = new Set([...listed]);
  assert.deepEqual(WORD_ROWS.filter((r) => mine.has(r[0]) && /labell/i.test(r[1])).map((r) => r[0]), [], "N1068: none of its words spells it labelled");
  assert.deepEqual([["x", "a draft labelled by hand"]].filter((r) => /labell/i.test(r[1])).length, 1, "control: the check sees the spelling");
  assert.deepEqual([...SCREEN_WORDS], [], "no rows of its own");
  assert.equal(Object.isFrozen(SCREEN_WORDS), true);
  assert.equal(hasWord("screen.no-such-screen.no-such-word"), false, "control: a key the list does not hold is not a word");
});

test("R24 what each screen draws is the word's text read through setup-words, filled (a sample over the eight screens), never the module's own", async () => {
  const draws = [
    [`/app/case-editor/${P}`, {}, [["screen.case-editor.ladder"], ["screen.case-editor.leavesout"], ["screen.case-editor.ack.by", { who: "mai" }]]],
    [`/app/review-copy/${P}`, {}, [["screen.review-copy.heading", { case: "The Coliseum lease", edition: "2" }], ["screen.review-copy.share"]]],
    [`/app/ceremony/${P}/${DR}`, {}, [["screen.ceremony.heading", { case: "The Coliseum lease", edition: "2" }]]],
    [`/app/published/${C}`, { session: null }, [["screen.published.howtoread"], ["screen.published.whose", { group: GROUP }], ["published.check.title"], ["published.check.field.help"]]],
    ["/app/imported/IMP-2026-0001", {}, [["screen.imported.findings"], ["screen.imported.result.part"]]],
    [`/app/docket/${P}/${C}`, {}, [["screen.docket.order"], ["screen.docket.sub", { case: C }]]],
    ["/app/doorbell", { session: null }, [["screen.doorbell.heading", { group: GROUP }], ["screen.doorbell.happens.court"]]],
    ["/app/review", { session: null, hash: "#grant=" + GRANT_SECRET }, [["screen.review-outside.heading", { group: GROUP }], ["screen.review-outside.comments.go"], ["review.statement.title"], ["review.statement.note.help"]]],
  ];
  for (const [path, boot, keys] of draws) {
    const p = await open(path, { boot });
    for (const [k, vars] of keys) assert.ok(drew(p, k, vars), `${path}: ${k}`);
  }
  assert.throws(() => word("screen.published.whose", {}), (e) => e.code === "WORD_VAR_MISSING", "control: a word missing a fill is no word");
  /* R70 (fix round 2, C48): only the Sign step says that publishing makes the edition permanent */
  const signing = await open(`/app/ceremony/${P}/${DR}`, { boot: { idb: await keptKey() } });
  assert.ok(!drew(signing, "screen.ceremony.permanent"), "R70: not before the edition is prepared");
  tick(signing, "ce-tie", "yes");
  await press(signing, "publish", { reason: "r" });
  assert.ok(drew(signing, "screen.ceremony.permanent"), "R70: the Sign step says it");
});

/* K3171 (JOURNEY-CHECK #1 J4 (2)): a screen whose subject is absent from its address sends no subject read and draws
   interface-shell R35's "Nothing is here"; one test per screen, each with its control. */
const BARE = {
  "case-editor": ["/app/case-editor", {}, ["casedrafts", "image"], `/app/case-editor/${P}`, "casedrafts"],
  "review-copy": ["/app/review-copy", {}, ["casedrafts", "image"], `/app/review-copy/${P}`, "casedrafts"],
  ceremony: ["/app/ceremony", {}, ["reviewcopy", "image", "casedrafts"], `/app/ceremony/${P}/${DR}`, "reviewcopy"],
  "docket-public": ["/app/docket-public", { session: null }, ["docketpublic"], `/app/docket-public/${C}`, "docketpublic"],
  published: ["/app/published", { session: null }, ["publishedcase"], `/app/published/${C}`, "publishedcase"],
  docket: [`/app/docket/${P}`, {}, ["docket", "image"], `/app/docket/${P}/${C}`, "docket"],
};
for (const [id, [path, boot, never, full, read]] of Object.entries(BARE)) {
  test(`R10 (K3171, K3179) ${id} opened with no subject in its address sends no subject read and draws "Nothing is here" (control: with it, it reads)`, async () => {
    const p = await open(path, { boot });
    for (const op of never) assert.equal(p.byOp(op).length, 0, `${path}: no ${op}`);
    assert.ok(main(p).querySelector('[data-unavailable="nothing"]'), `${path}: Nothing is here`);
    assert.equal(main(p).querySelector("h1").textContent, word("shell.unavailable.nothing.title"), "K3179: the shell's own title");
    assert.equal(main(p).querySelector('[data-unavailable="nothing"]').textContent, word("shell.unavailable.nothing.says"));
    assert.ok(!drew(p, "shell.unavailable.notyours.title"), "K3179 (control): not the other state's heading");
    assert.deepEqual(rawKeys(p.root()), []);
    const q = await open(full, { boot });
    assert.ok(q.byOp(read).length > 0, `${full} reads ${read}`);
    assert.equal(main(q).querySelector('[data-unavailable="nothing"]'), null);
  });
}

/* R24 (setup-words R11): a word's `{name}` is filled by the data the screen holds, never drawn as it is held. The kit
   leaves an unfilled placeholder in the text, so every page the fixtures reach is searched for one, in its text and in
   the explanations it carries. */
const unfilled = (p) => (p.root().innerHTML.match(/\{[a-z]\w*\}/g) || []);

test("R24 no word is drawn with a placeholder left unfilled on any screen, in the states the fixtures reach", async () => {
  const seen = [];
  for (const [id, [path, boot]] of Object.entries(PAGES)) seen.push([id, await open(path, { boot })]);
  const ready = await open(`/app/ceremony/${P}/${DR}`, { boot: { idb: await keptKey() } });
  tick(ready, "ce-tie", "yes");
  await press(ready, "publish", { reason: "r" });
  seen.push(["ceremony prepared and signing", ready]);
  const shared = await open(`/app/review-copy/${P}`, { plane: { reviewgrant: ok({ grantId: "GRT-2", draftId: DR, recipient: "Ana", secret: GRANT_SECRET }), publishpreflight: ok({ steps: [{ publish_at: { zone: "America/Los_Angeles" } }] }) } });
  await press(shared, "reviewgrant", { reason: "so the reader can comment before publication", values: { "rc-name": "Ana", "rc-role": "editor", "rc-until": "2099-10-30" } });
  seen.push(["review-copy with the reader's link", shared]);
  const first = await open(`/app/case-editor/${P}`, { plane: { casedrafts: ok({ kind: "review-drafts", project: P, drafts: [{ draft_id: DR, case: { case_id: C, edition: 1, identity: "The Coliseum lease" }, created_by: "dev" }] }) } });
  seen.push(["case-editor, a first edition", first]);
  for (const [name, p] of seen) assert.deepEqual(unfilled(p), [], name);
  assert.deepEqual(unfilled({ root: () => ({ innerHTML: "Edition {n}" }) }), ["{n}"], "control: the search sees an unfilled placeholder");
});

/* D29 (K3324 (2)): an answer of `ok: true` that carries `ok: false`, `started: false`, `dispatched: false` or `withheld` is
   not success: the screen draws the refusal in the plane's words and none of its success. */
const CARRIED = [{ started: false }, { dispatched: false }, { withheld: ["the draft"] }, { ok: false }];
const withRefusal = (extra) => ok({ ...extra, code: "NOT_DONE", translation: "It was not done." });

test("D29 an act answered ok that carries a refusal draws the refusal and none of its success, on every screen that says one", async () => {
  for (const extra of CARRIED) {
    const dk = await open(`/app/docket/${P}/${C}`, { boot: { idb: await keptKey() }, plane: { docketpost: withRefusal(extra) } });
    await press(dk, "docketpost", { reason: "r" });
    await answerSign(dk, true, "docketpost");
    assert.ok(text(dk).includes("It was not done.") && !drew(dk, "screen.docket.posted.said"), `docketpost ${JSON.stringify(extra)}`);
    const ce = await open(`/app/case-editor/${P}`, { plane: { casedraft: withRefusal(extra) } });
    await press(ce, "casedraft", { values: { "ce-scope": "Rents, 2024 to 2026." }, reason: "r" });
    assert.ok(text(ce).includes("It was not done.") && !drew(ce, "screen.case-editor.prepared"), `casedraft ${JSON.stringify(extra)}`);
    const db = await open("/app/doorbell", { boot: { session: null }, plane: { knock: withRefusal(extra) } });
    choose(db, "db-file", new Uint8Array([1]));
    await press(db, "knock");
    assert.equal(db.root().querySelector("[data-received]"), null, `knock ${JSON.stringify(extra)}: not received`);
    assert.ok(text(db).includes("It was not done."));
    const rc = await open("/app/review", { boot: { session: null, hash: "#grant=" + GRANT_SECRET }, plane: { reviewcomment: withRefusal(extra) } });
    await press(rc, "reviewcomment", { values: { "ro-comment": "x" } });
    assert.ok(!drew(rc, "screen.review-outside.sent") && text(rc).includes("It was not done."), `reviewcomment ${JSON.stringify(extra)}`);
    const ce2 = await open(`/app/ceremony/${P}/${DR}`, { plane: { publish: withRefusal(extra) } });
    tick(ce2, "ce-tie", "yes");
    await press(ce2, "publish", { reason: "r" });
    assert.ok(!ops(ce2).includes("caseratify") && text(ce2).includes("It was not done."), `publish ${JSON.stringify(extra)}: nothing is prepared`);
    const sg = await open(`/app/ceremony/${P}/${DR}`, { boot: { idb: await keptKey() }, plane: { caseratify: withRefusal(extra) } });
    tick(sg, "ce-tie", "yes");
    await press(sg, "publish", { reason: "r" });
    await press(sg, "caseratify", { reason: "r" });
    await answerSign(sg, true, "caseratify");
    assert.equal(sg.root().querySelector("[data-signed]"), null, `caseratify ${JSON.stringify(extra)}: not drawn signed`);
    assert.ok(text(sg).includes("It was not done."));
  }
  const fine = await open(`/app/docket/${P}/${C}`, { boot: { idb: await keptKey() } });
  await press(fine, "docketpost", { reason: "r" });
  await answerSign(fine, true, "docketpost");
  assert.ok(drew(fine, "screen.docket.posted.said"), "control: an answer carrying none is success");
});

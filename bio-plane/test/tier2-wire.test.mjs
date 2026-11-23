/* REC-98 / D-283 — THE TIER-2 PER-PAGE RULE, REACHED THROUGH THE OPS.
 *
 * CPDF-20 landed `perPageTierWinner` / `mergeTier2Text` / `tier2Note` in
 * `src/textchain.mjs`, drove them over four real Oakland council PDFs, and then
 * PROVED THEM UNREACHED rather than implying it: `npm run build` produced a
 * byte-identical `bio-plane.bundled.mjs`, because nothing imported the new
 * exports and esbuild shook them out. Only the bundle MANIFEST changed.
 *
 * THIS SUITE IS THE OTHER HALF. text-chain's R102 test drives the RULE; this
 * one drives the WIRE — the two call sites CPDF-20's DELEGATION names (then in
 * the plane's `index.mjs`; now `tier2Escalate` in `src/reading-pipeline/index.mjs`,
 * reached from both ops), through `op=pdfstructure` and `op=acquire`, with the
 * REAL pdf-worker running from its committed bundle under the same miniflare. A
 * store-level test and a passing test run are not evidence a caller can reach a feature
 * (`op=invitelook` shipped a ReferenceError while 1,276 assertions passed), and
 * a rule nothing imports is the strongest possible form of that.
 *
 * WHAT THE WIRE MAKES TRUE THAT THE RULE ALONE CANNOT:
 *   1. one document, TWO TIERS — `text.pages[n].tier` differs within one answer;
 *   2. the ACQUIRE chain records the winner PER PAGE (`extent: {kind:"pages"}`),
 *      which is §5.2's second half and is not a merge at all;
 *   3. a page tier 1 read BETTER is kept, through the op, on real bytes.
 *
 * THE ROUTING HALF IS NOT TOUCHED AND THIS SUITE PINS THAT. `needsTier2` is
 * unchanged on purpose (D-283 is the ASSIGNMENT half), and one consequence is
 * MEASURED here rather than argued: `legistar-73618`, the committed fixture
 * whose page 1 is the very page that falsified §5.2 as written, DOES NOT
 * ESCALATE — tier 1 read it at 1,815 characters with a single unmapped code, so
 * the document-level predicate declines and the merge is never consulted. That
 * is asserted below, so the limit is in the suite rather than only in a report.
 * [The figure read 1,925 until D-517, 2026-09-24, and had been stale since
 * D-481 changed the line-break policy — it matched no reading this suite could
 * produce. It is corrected to the measured one rather than deleted, because
 * what it records — a margin far short of the predicate — is still the point,
 * and the margin is now 1,815 against 1 marker. `needsTier2` compares RAW
 * `counts.chars`, so this margin is the only thing standing between a
 * whitespace change and an escalation verdict; D-517 measured all nine of
 * M-141's documents both ways and NO verdict moves, the closest non-escalating
 * margin being this one at 1,814 against a 24-character move (M-145).]
 *
 * NEGATIVE CONTROL: `node bio-plane/test/nc-rec98.mjs` (deleted in T20; it re-ran
 * in one step). NINE rows, each armed ALONE with every other defence held open,
 * each restored from a uniquely named per-arm pristine copy verified by sha256
 * AND by `cmp` with the byte count printed and floored, and each DECLARING
 * before it ran what must fail and what must not:
 *   (0) BASELINE, nothing armed -> exit 0 with a real assertion tally, never a bare 0.
 *   (1) A1 CALL SITE 1 REMOVED, `op=pdfstructure` returning the member's answer
 *       whole -> exit 1, and it must fail on "one document, TWO tiers".
 *   (2) A2 CALL SITE 2 REMOVED, the acquire assembly assigning wholesale -> exit 1,
 *       and it must fail on the SCOPED mixed chain, NOT on the structure arms.
 *   (3) A3 §5.2 SHIPPED AS WRITTEN, the second condition dropped from the rule
 *       itself -> exit 1 on the degradation page, through the op.
 *   (4) A4 THE TIER NOT STAMPED on the answer -> exit 1: a merge that is right
 *       and silent about it.
 *   (5) A5 THE MEMBER'S OWN NOTES DROPPED -> exit 1 on the over-envelope decline.
 *   (6) A6 D-251's PRODUCER CARRY-FORWARD DROPPED -> exit 1 on the encrypted
 *       document, the only shape that reaches the merge's wholesale branch.
 *   (7) A7 THE FIXTURE TRUNCATED, two of four PDFs hidden -> exit 1 at the
 *       manifest, naming the missing file rather than thinning silently.
 *   (8) A8 OVER-STRICTNESS, the wire spelled differently at all three sites ->
 *       exit 0. Correct work in a spelling nobody anticipated must PASS.
 */
import "./stdio.mjs";                 /* D-282: a suite's own exit must not discard the suite's own output */
import "./sandbox.mjs";               /* D-186: owns $TMPDIR for this process and removes it on exit */
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
/* the pdf-worker member built fresh from its source by its own fleet recipe (pdf-worker/test/subject.mjs); no committed bundle is read (ARCH, "Committed built files") */
import { BUNDLE } from "../../pdf-worker/test/subject.mjs";
import { createHash } from "node:crypto";
import { tier2Answer } from "../../pdf-worker/test/fixtures.mjs";
import { extractPdfStructure } from "../src/pdfstructure.mjs";
import { mergeTier2Text, perPageTierWinner } from "../src/textchain.mjs";

const SRC = fileURLToPath(new URL("../src/plane/index.mjs", import.meta.url));
const FIX = fileURLToPath(new URL("./fixtures/cpdf20/", import.meta.url));

/* THE CORPUS IS A MANIFEST, NEVER A WALK — CPDF-20's own correction, earned by
   an arm that hid three PDFs and shrank the corpus SILENTLY because the suite
   discovered it with `readdirSync`. A walk makes the corpus "whatever is in the
   directory"; a manifest fails earlier and NAMES the missing file. It also keeps
   these files out of the estate's walk census, so no census floor moves. */
const MANIFEST = Object.freeze({
  mixed:    "legistar-73545.pdf",   // 7 pages: 0-5 to tier 2, 6 stays tier 1
  clean:    "legistar-73450.pdf",   // 3 pages, fully decodable — must not escalate
  recovers: "legistar-73550.pdf",   // 3 pages, all three to tier 2
  degrades: "legistar-73618.pdf",   // page 1: tier 1 647 chars, tier 2 580 — THE page (D-481 then D-517 moved tier 1's count; see the note at the first figure)
});

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${label}${ok ? "" : `\n         want ${JSON.stringify(want)}\n         got  ${JSON.stringify(got)}`}`);
  ok ? pass++ : fail++;
};
const hex = (b) => createHash("sha256").update(b).digest("hex");

/* THE FIXTURE IS FLOORED AND PRINTED. Three headline totality assertions in
   this estate have passed OVER AN EMPTY CORPUS; a corpus that can silently
   become nothing is the failure mode, so it is asserted non-empty by name. */
const BYTES = {};
for (const [arm, file] of Object.entries(MANIFEST)) {
  BYTES[arm] = new Uint8Array(readFileSync(FIX + file));
  if (BYTES[arm].length < 10_000)
    throw new Error(`REC-98 fixture ${file} is ${BYTES[arm].length} B — the corpus floor is 10,000 B`);
}
console.log(`REC-98 corpus: ${Object.keys(MANIFEST).length} committed PDFs, `
  + `${Object.values(BYTES).reduce((n, b) => n + b.length, 0)} bytes total`);
t("the corpus is the manifest's four documents, not a walk's leftovers", Object.keys(BYTES).length, 4);

const SHA = Object.fromEntries(Object.entries(BYTES).map(([k, b]) => [k, hex(b)]));

/* Tier 1's own reading of each document, run IN PROCESS from the same module
   the plane runs, so "the page the merge kept is byte-identical to tier 1's"
   is compared against tier 1 rather than against a copy of it. */
const TIER1 = {};
for (const arm of Object.keys(MANIFEST)) TIER1[arm] = (await extractPdfStructure(BYTES[arm])).text;

const MEM = "mem-rec98";
const plane = (opts = {}) => ({
  name: "plane", modules: true, modulesRoot: "/", scriptPath: SRC, script: readFileSync(SRC, "utf8"),
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } },
  r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { VERSION: "test", ADMIN_TOKEN: "adm-rec98", MEMBER_TOKEN: MEM, PROBE_TOKEN: "prb-rec98",
              GOVERNOR_APPETITE_PER_MIN: "600000", GOVERNOR_SUBRESOURCE_STAGGER_MS: "0" },
  outboundService: (request) => {
    const p = new URL(request.url).pathname.replace(/^\//, "");
    const arm = Object.keys(MANIFEST).find((k) => MANIFEST[k] === p);
    return arm ? new Response(BYTES[arm], { headers: { "content-type": "application/pdf" } })
               : new Response("unscripted", { status: 500 });
  },
  ...(opts.member === false ? {} : { serviceBindings: { PDF_WORKER: "pdf-worker" } }),
});
const realMember = (maxBytes) => ({
  name: "pdf-worker", modules: true, modulesRoot: "/", scriptPath: BUNDLE, script: readFileSync(BUNDLE, "utf8"),
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  r2Buckets: ["CAPTURES"],
  bindings: { VERSION: "test", ...(maxBytes ? { MAX_PDF_BYTES: String(maxBytes) } : {}) },
});

/* A member's own session (the shared member key is retired, MEMBER_TOKEN_RETIRED): enrolled by the administrator and
   signed in with the member's password; every credential travels in the Authorization header, never the address
   (CREDENTIAL_IN_ADDRESS). One per plane, kept for its later calls. */
const SESSIONS = new WeakMap();
const signIn = async (mf) => {
  if (SESSIONS.has(mf)) return SESSIONS.get(mf);
  const post = async (q, body, token) => {
    const j = await (await mf.dispatchFetch(`http://x/api/?${q}`, { method: "POST", body: JSON.stringify(body),
      headers: token ? { authorization: `Bearer ${token}` } : {} })).json();
    return j && typeof j === "object" && "result" in j ? j.result : j;
  };
  const add = await post("op=memberadd", { memberId: "m1", cover: "cover for m1", role: "member", capabilities: ["contribute"] }, "adm-rec98");
  if (!add || !add.invite) throw new Error(`memberadd: ${JSON.stringify(add)}`);
  const en = await post("op=enroll", { invite: add.invite, handle: "m1", password: "m1-passphrase-rec98" });
  if (!en || !en.ok) throw new Error(`enroll: ${JSON.stringify(en)}`);
  const lg = await post("op=login", { handle: "m1", password: "m1-passphrase-rec98" });
  if (!lg || !lg.token) throw new Error(`login: ${JSON.stringify(lg)}`);
  const h = { authorization: `Bearer ${lg.token}` };
  SESSIONS.set(mf, h);
  return h;
};
const putSha = async (mf, sha, bytes) =>
  mf.dispatchFetch(`http://x/api/capture?sha256=${sha}`, { method: "PUT", headers: await signIn(mf), body: bytes });
const structureSha = async (mf, sha) =>
  (await mf.dispatchFetch(`http://x/api/pdfstructure?sha256=${sha}`, { headers: await signIn(mf) })).json();
const put = (mf, arm) => putSha(mf, SHA[arm], BYTES[arm]);
const structure = (mf, arm) => structureSha(mf, SHA[arm]);
const acquire = async (mf, arm) => (await (await mf.dispatchFetch(
  `http://x/api/?op=acquire`,
  { method: "POST", headers: await signIn(mf), body: JSON.stringify({ locator: `https://oakland.legistar.com/${MANIFEST[arm]}`,
                                           authority: "City Clerk" }) })).json());

const tiersOf = (text) => (text && Array.isArray(text.pages) ? text.pages : []).map((p) => p.tier ?? null);
/* A chain step's page extent, or null for an unscoped step. This reads the
   chain the way a CONSUMER would rather than the way the builder wrote it. */
const extentsOf = (chain) => (Array.isArray(chain) ? chain : [])
  .map((s) => (s && s.extent && s.extent.kind === "pages") ? s.extent.pages : null);

/* ================================================================= *
 * 1. ONE DOCUMENT, TWO TIERS — through op=pdfstructure, real member
 * ================================================================= */
console.log("\n--- op=pdfstructure over the MIXED document: the merge is per PAGE, not wholesale ---");
{
  const mf = new Miniflare({ workers: [plane(), realMember()] });
  t("the mixed fixture landed through op=capture", (await (await put(mf, "mixed")).json()).ok, true);
  const out = await structure(mf, "mixed");
  t("ok", out.ok, true);
  /* THE ASSERTION THE WIRE EXISTS FOR. Before this item the op RETURNED THE
     MEMBER'S WHOLE ANSWER on a successful escalation, so no page carried a tier
     at all and every page of this document read as tier 2 — including page 6,
     which tier 2 decoded WORSE. Remove either call site and this fails. */
  t("seven pages, and the tier is stated PER PAGE: 0-5 tier 2, page 6 kept at tier 1",
    tiersOf(out.text), [2, 2, 2, 2, 2, 2, 1]);
  t("one document, TWO tiers — which no wholesale assignment can produce",
    [new Set(tiersOf(out.text)).size, out.tier], [2, 2]);
  /* The kept page is tier 1's OWN text, byte for byte. A merge that rebuilt the
     page would agree on the count and disagree on the bytes. */
  t("page 6's text is tier 1's own reading, byte-identical",
    hex(out.text.pages[6]?.text ?? ""), hex(TIER1.mixed.pages[6].text));
/* FIGURES MOVED 2026-09-24 by D-481, and the CLAIM at every site below is unchanged:
   tier 1 still wins every page it won before, no page's tier flipped, and the
   degradation guard still refuses every award it refused. What moved is tier 1's
   CHARACTER COUNT, and it fell for a reason that is not slack: D-481 stopped
   emitting a newline per positioning operator, so the counts below lost the
   INJECTED NEWLINES and not one decoded glyph. Tier 2's figures (580, 3,416, 100)
   are the member's decode and are untouched, which is what makes the fall
   readable. Taken from what the suite PRINTED, never by subtraction.
   A FINDING THIS EXPOSED, reported rather than fixed here: the per-page award
   compares raw `text.length`, so it counts whatever line-break policy tier 1
   happens to run. The measured page's margin over tier 2 narrowed 129 -> 77
   characters without one glyph changing hands. A page's TIER should not be able
   to turn on a newline; the comparison wants non-whitespace characters.
   [THAT FINDING IS CLOSED, and it is corrected here rather than deleted because
   its closing is the news: `perPageTierWinner` reads `decodedChars`, which
   counts NON-WHITESPACE code points, since D-501 ruled glyphs and D-514 moved
   the sites. The award no longer turns on a line-break policy.]

   FIGURES MOVED AGAIN 2026-09-24 by D-517, and the CLAIM at every site below is
   STILL unchanged — no page's tier flipped, the merge keeps and replaces exactly
   what it did, and the degradation guard refuses exactly what it refused. What
   moved is tier 1's CHARACTER COUNT a second time, and again for a reason that
   is not slack: D-517 stopped emitting a separator where the document had
   already written one, so the counts below lost 24 REDUNDANT SPACES on
   `legistar-73618` and one on `legistar-73545` page 6, and not one decoded
   glyph. THE NON-WHITESPACE COUNTS DID NOT MOVE AT ALL, and THAT is why this
   landing is an independent confirmation of D-501/D-514's counter rather than a
   second instance of the finding above: the descriptive raw counts in this file
   moved while the award, which now reads glyphs, could not see the change.
   Tier 2's figures (580, 3,416, 100) are the member's decode and are untouched
   for a THIRD landing, which is what makes both falls readable. Taken from what
   this suite PRINTED on a rebased tree, never by subtraction. */
  t("page 6 kept 3,419 characters that a wholesale tier-2 assignment would have replaced with 3,416",
    [out.text.pages[6]?.text?.length ?? -1, TIER1.mixed.pages[6].text.length], [3419, 3419]);
  t("page 0 is the member's decode, and it is the recovery the escalation is FOR",
    (out.text.pages[0]?.text?.length ?? 0) > 1000 && TIER1.mixed.pages[0].text.length < 50, true);
  t("the document says in its own notes that its text layer is a merge of two decodes",
    out.notes.some((n) => /merge of two decodes/.test(n)), true);
  t("and the note counts both parts rather than reporting only the win",
    out.notes.some((n) => /6 page\(s\) were re-read/.test(n) && /other 1 page\(s\) kept tier 1/.test(n)), true);
  await mf.dispose();
}

/* ================================================================= *
 * 2. THE CHAIN RECORDS THE WINNER PER PAGE — through op=acquire
 * ================================================================= */
console.log("\n--- op=acquire over the MIXED document: the CHAIN names the tier per page (§5.2's second half) ---");
{
  const mf = new Miniflare({ workers: [plane(), realMember()] });
  const doc = (await acquire(mf, "mixed")).document;
  const chain = doc.reading.text_source;
  t("the reading records tier 2 at document level, as it always did", doc.reading.text_tier, 2);
  t("the chain is a SCOPED, mixed chain: two layer steps, each stamped with the pages it covers",
    extentsOf(chain), [[6], [0, 1, 2, 3, 4, 5]]);
  t("the tier-1 part covers exactly the page tier 1 kept, and the tier-2 part the six it lost",
    chain.map((s) => s.tier), [1, 2]);
  t("both parts are `layer` derivations of the same source under the same null cap "
    + "(nothing is OVERCLAIMED by the swap — what was unbounded is text LOSS)",
    [...new Set(chain.map((s) => `${s.step}:${s.cap}`))], ["layer:null"]);
  t("the basis the record keeps SAYS the text layer is a merge",
    /merge of two decodes/.test(doc.reading.basis), true);
  await mf.dispose();
}

/* ================================================================= *
 * 3. OVER-STRICTNESS — a document with only ONE tier's text records
 *    exactly what it recorded before this wire existed
 * ================================================================= */
console.log("\n--- OVER-STRICTNESS: one tier throughout, and the answer is unchanged in both directions ---");
{
  const mf = new Miniflare({ workers: [plane(), realMember()] });
  await put(mf, "clean");
  const out = await structure(mf, "clean");
  t("the fully-decodable document is not escalated at all: tier 1", out.tier, 1);
  t("and no tier-2 sentence is attached to a document no tier 2 touched",
    out.notes.some((n) => /tier-2 decoder|merge of two decodes/.test(n)), false);

  const clean = (await acquire(mf, "clean")).document;
  t("acquire: tier 1, and the chain is UNSCOPED — a document with one provenance "
    + "is not a mixed document and is not dressed as a partition",
    [clean.reading.text_tier, extentsOf(clean.reading.text_source)], [1, [null]]);

  /* The same property from the OTHER side: every page won by tier 2 is still ONE
     provenance, so it too records what it always recorded. */
  const rec = (await acquire(mf, "recovers")).document;
  t("a document tier 2 won WHOLLY records tier 2 on an UNSCOPED chain, exactly as before",
    [rec.reading.text_tier, extentsOf(rec.reading.text_source)], [2, [null]]);
  t("and it is not withheld — the rule leaves nothing behind (all three pages moved)",
    /3 page\(s\) were re-read/.test(rec.reading.basis), true);
  await mf.dispose();
}

/* ================================================================= *
 * 4. THE DEGRADATION CLASS, DRIVEN THROUGH THE OP
 *    — the 23 census pages' relationship, on a document that escalates
 * ================================================================= */
console.log("\n--- THE DEGRADATION CLASS through the op: tier 2 flags fewer, decodes LESS, and is REFUSED ---");
{
  /* A member FRONT, and it fronts for one reason only: the relationship the 23
     census pages have — tier 1 flagged the page AND decoded more of it — needs
     both sides controlled, and the real member cannot be asked to decode worse
     on demand. Everything else here is the real plane at the real call site
     through the real op: the capture, tier 1, `needsTier2`, the merge, the
     answer. The front returns THE MEMBER'S OWN REAL DECODE of these exact
     bytes (pdf-worker's `tier2Answer` fixture, CPDF-20's file decoded by its real code) with ONE page — page 5 —
     cut down and its markers cleared, which is exactly the shape §5.2-as-written
     rewards. So six of the seven pages are the real member's real output and
     only the arm's own page is constructed.

     CORRECTED ON THE FIRST RUN, AND RECORDED RATHER THAN SMOOTHED. This front
     first returned tier 1's own text on every page, and the whole document came
     back tier 1 — a GREEN-looking "page 5 kept" that proved nothing, because no
     page had anything to win with. The arm was measuring its own fixture. The
     "nothing is left behind" assertion below is what caught it. */
  const t1 = TIER1.mixed;
  /* pdf-worker's published fixture `tier2Answer`: the member's real tier-2 answer for these exact bytes, made by its real code when this runs */
  const realMixed = (await tier2Answer()).text;
  const cutPages = realMixed.pages.map((p) => p.page === 5
    ? { page: 5, text: t1.pages[5].text.slice(0, 100), undetermined: [] }
    : { page: p.page, text: p.text, undetermined: p.undetermined || [] });
  const answer = { ok: true, tier: 2, notes: [], links: [], structure: {},
                   text: { document: cutPages.map((p) => p.text).join("\n"), pages: cutPages,
                           undetermined: [],
                           counts: { chars: cutPages.reduce((n, p) => n + p.text.length, 0), undetermined: 0 } } };
  const memberFront = {
    name: "pdf-worker", modules: true, modulesRoot: "/",
    script: `export default { fetch: () => new Response(${JSON.stringify(JSON.stringify(answer))},`
          + ` { headers: { "content-type": "application/json" } }) };`,
    compatibilityDate: "2026-07-01",
  };

  /* THE ARM IS DISCRIMINATING, AND THAT IS ASSERTED RATHER THAN ASSUMED: §5.2 AS
     WRITTEN AWARDS THIS PAGE TO TIER 2. Without this line the assertion below
     would pass for a page no rule was ever going to move. */
  const p1 = t1.pages[5], p2 = cutPages[5];
  const uch = (p) => (p.undetermined || []).reduce((n, m) => n + (Number.isFinite(m.count) ? m.count : 0), 0);
  t("the arm is real: §5.2 AS WRITTEN (fewer undetermined wins) hands page 5 to tier 2",
    uch(p2) < uch(p1), true);
  t("...and doing so would LOSE 164 characters of text tier 1 had already decoded",
    p1.text.length - p2.text.length, 164);
  t("the SHIPPED rule's one-directional guard refuses that award",
    perPageTierWinner(p1, p2), "tier1");

  const mf = new Miniflare({ workers: [plane(), memberFront] });
  await put(mf, "mixed");
  const out = await structure(mf, "mixed");
  t("THROUGH THE OP: page 5 is kept at tier 1 — a character count never PROMOTES "
    + "a page, it only ever refuses to demote one",
    out.text.pages[5]?.tier ?? null, 1);
  t("and page 5 comes back with tier 1's own 264 characters, not the member's 100",
    [out.text.pages[5]?.text?.length ?? -1, hex(out.text.pages[5]?.text ?? "") === hex(p1.text)], [264, true]);
  t("the pages tier 2 genuinely improved still move — nothing is left behind",
    tiersOf(out.text), [2, 2, 2, 2, 2, 1, 1]);
  await mf.dispose();
}

/* ================================================================= *
 * 5. THE PAGE THAT FALSIFIED THE DESIGN, BY NAME
 * ================================================================= */
console.log("\n--- legistar-73618 page 1: THE page CPDF-20 measured as degraded by §5.2 as written ---");
{
  /* Tier 2's side is CPDF-20's own recording of the member's decode of these
     exact bytes (`tier2-recorded.json`, made by `tier-pagewise.probe.mjs
     --record`). It is a RECORDING, not an assumption, and `--verify` re-derives
     it live — so this arm reads the same numbers CPDF-20 measured rather than
     numbers this suite chose. */
  const recorded = JSON.parse(readFileSync(FIX + "tier2-recorded.json", "utf8"))["legistar-73618"];
  const t1 = TIER1.degrades, p1 = t1.pages[1], p2 = recorded.pages.find((p) => p.page === 1);
  t("the measured page, CPDF-20's document and D-517's count: tier 1 decodes 647 characters, tier 2 decodes 580",
    [p1.text.length, p2.text.length], [647, 580]);
  t("tier 1 flagged exactly ONE unmapped code on it, and tier 2 flagged none — "
    + "which is the whole of §5.2's comparison, and it compares nothing",
    [(p1.undetermined || []).reduce((n, m) => n + m.count, 0),
     (p2.undetermined || []).reduce((n, m) => n + (m.count || 0), 0)], [1, 0]);
  const m = mergeTier2Text(t1, recorded);
  t("THE MERGE THE WIRE CALLS KEEPS IT AT TIER 1, by page number",
    [m.ok, m.kept, m.replaced], [true, [0, 1], []]);
  t("...saving the 67 characters §5.2 as written would have traded for one glyph",
    p1.text.length - p2.text.length, 67);

  /* AND THE LIMIT, MEASURED RATHER THAN ARGUED. The routing half is unchanged by
     this item (D-283 is the ASSIGNMENT half, and `needsTier2` was closed on
     purpose), so this document never reaches the merge through the op at all:
     tier 1 read it at 1,815 characters against a single marker (stale at 1,925
     since D-481; corrected by D-517 to the measured figure), far short of
     "more undetermined regions than decoded characters". The page is saved by
     the rule; through the op it was never at risk. Asserted so a future change
     to the routing half turns this red instead of quietly widening the class. */
  const mf = new Miniflare({ workers: [plane(), realMember()] });
  await put(mf, "degrades");
  const out = await structure(mf, "degrades");
  t("through the op this document does NOT escalate — the routing half declines it",
    [out.tier, out.notes.some((n) => /tier-2 decoder|merge of two decodes|tier2_/.test(n))], [1, false]);
  t("so both its pages carry tier 1 and its 1,815 characters are untouched",
    [out.text.counts.chars, out.text.pages.map((p) => p.text.length)], [1815, [1167, 647]]);
  await mf.dispose();
}

/* ================================================================= *
 * 6. THE MEMBER'S OWN FINDINGS SURVIVE THE WIRE
 * ================================================================= */
console.log("\n--- the member's notes are CARRIED, not dropped, now that the plane answers instead of the member ---");
{
  /* The member declines a document over its byte envelope by answering ok:true
     at tier 1 with `tier2_declined_over_envelope`. Before this wire the op
     returned that answer WHOLE, so the note reached the caller for free;
     returning the plane's own `structure` instead would have lost the one
     sentence that says WHY nothing improved. Driven with the REAL member and a
     small envelope rather than a stub, so the note is the member's own. */
  const mf = new Miniflare({ workers: [plane(), realMember(1000)] });
  await put(mf, "mixed");
  const out = await structure(mf, "mixed");
  t("the member's decline reaches the caller through the plane's answer",
    out.notes.includes("tier2_declined_over_envelope"), true);
  t("and tier 1 stands, stated as tier 1 rather than as a tier 2 no page has",
    out.tier, 1);
  t("no page moved, so no merge sentence is invented",
    out.notes.some((n) => /merge of two decodes/.test(n)), false);
  t("tier 1's own seven pages come back intact",
    out.text.pages.map((p) => p.text.length),
    TIER1.mixed.pages.map((p) => p.text.length));
  await mf.dispose();
}

/* ================================================================= *
 * 7. D-251 SURVIVES THE WIRE — who made the layer is a fact about the
 *    FILE, not about the tier that read it
 * ================================================================= */
console.log("\n--- D-251 through the wire: a producer marker is not lost when tier 2 answers ---");
{
  /* The member returns the I2 text shape with NO `producer` field, so the
     wholesale branch of the merge (`m.text` IS the member's object, taken for a
     document tier 1 read nothing of) would DROP the marker on exactly the
     documents most likely to carry one — a scanned certified resolution is the
     class that both escalates and names ABBYY. This is the one behaviour the
     old wholesale assignment already protected and the wire must not lose. */
  const stream = "BT /F1 24 Tf 72 700 Td (Hello Oakland 2026) Tj ET";
  const bodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    "<< /Producer (ABBYY FineReader 15) >>",
  ];
  let pdfStr = "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n";
  const offsets = [];
  bodies.forEach((b, i) => { offsets[i] = pdfStr.length; pdfStr += `${i + 1} 0 obj\n${b}\nendobj\n`; });
  const xrefStart = pdfStr.length, n = bodies.length + 1;
  let xref = `xref\n0 ${n}\n0000000000 65535 f \n`;
  for (let i = 0; i < bodies.length; i++) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  pdfStr += xref + `trailer\n<< /Size ${n} /Root 1 0 R /Info 6 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;
  const bytes = new Uint8Array(Buffer.from(pdfStr, "latin1")), sha = hex(bytes);

  const t1 = (await extractPdfStructure(bytes)).text;
  t("the arm is real: tier 1 reads the /Info producer and names the engine",
    [t1.producer.determination, t1.producer.ocr && t1.producer.ocr.engine],
    ["ocr", "ABBYY FineReader 15"]);

  const mf = new Miniflare({ workers: [plane(), realMember()] });
  await putSha(mf, sha, bytes);
  const out = await structureSha(mf, sha);
  t("THROUGH THE OP: tier 2 answered", [out.ok, out.tier, out.text.document], [true, 2, "Hello Oakland 2026"]);
  /* READ DEFENSIVELY, AND THAT IS A CONTROL FINDING RATHER THAN CAUTION. The A1
     arm (call site 1 removed) hands back the MEMBER'S object, which carries no
     `producer` at all — so `out.text.producer.ocr.engine` THREW, ended the module
     and left the arm with NO TALLY. A TypeError inside an assertion goes through
     no assertion at all; the arm must FAIL here, by name, not die here. */
  t("and the layer's producer is still named — carried forward from tier 1, never re-derived",
    [out.text.producer?.determination ?? null, out.text.producer?.ocr?.engine ?? null],
    ["ocr", "ABBYY FineReader 15"]);

  /* WHICH BRANCH ACTUALLY SAVED IT, MEASURED RATHER THAN ASSUMED — and the
     measurement corrected this arm's first draft. A one-page PDF tier 1 decoded
     NOTHING of still has a `pages[]` entry, so the merge takes its PAGE-WISE
     branch and `{...base}` preserves the producer BY CONSTRUCTION. The call
     site's explicit carry-forward is therefore NOT what saves the case above;
     it is what saves the WHOLESALE branch, which is reached only by a base with
     no pages AND no characters. In this plane exactly one producer emits that
     shape: `pdfstructure`'s ENCRYPTED early return — which carries a producer
     saying WHY it could not be read. Driven below, because a guard believed on
     the strength of its existence rather than its behaviour is the defect this
     project meets most. */
  t("the page-wise branch is what ran here, so the carry-forward was not on trial",
    mergeTier2Text(t1, { pages: [{ page: 0, text: "x", undetermined: [] }] }).wholesale, false);

  const encBodies = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>",
    "<< /Filter /Standard /V 2 /R 3 /O (0000000000000000) /U (0000000000000000) /P -44 >>",
  ];
  let encStr = "%PDF-1.7\n%\xe2\xe3\xcf\xd3\n";
  const encOff = [];
  encBodies.forEach((b, i) => { encOff[i] = encStr.length; encStr += `${i + 1} 0 obj\n${b}\nendobj\n`; });
  const encXrefStart = encStr.length, encN = encBodies.length + 1;
  let encXref = `xref\n0 ${encN}\n0000000000 65535 f \n`;
  for (let i = 0; i < encBodies.length; i++) encXref += `${String(encOff[i]).padStart(10, "0")} 00000 n \n`;
  encStr += encXref + `trailer\n<< /Size ${encN} /Root 1 0 R /Encrypt 4 0 R >>\nstartxref\n${encXrefStart}\n%%EOF\n`;
  const encBytes = new Uint8Array(Buffer.from(encStr, "latin1"));
  const encT1 = (await extractPdfStructure(encBytes)).text;
  t("the encrypted early return IS the wholesale shape: no pages, no characters, "
    + "and a producer that says WHY it could not be read",
    [encT1.pages.length, encT1.counts.chars, encT1.producer.why], [0, 0, "encrypted"]);
  const wholesale = mergeTier2Text(encT1, { pages: [{ page: 0, text: "decrypted", undetermined: [] }],
                                            counts: { chars: 9, undetermined: 0 } });
  t("the merge takes the wholesale branch, and the member's object carries NO producer — "
    + "so without the call site's carry-forward the finding is silently dropped",
    [wholesale.wholesale, wholesale.text.producer === undefined], [true, true]);

  /* AND THROUGH THE OP, because a unit assertion is not evidence a caller can
     reach it. An encrypted document escalates (one marker, zero characters —
     `needsTier2`'s own zero-char case), the member answers, and the wholesale
     branch runs at the real call site. */
  const encSha = hex(encBytes);
  await putSha(mf, encSha, encBytes);
  const encOut = await structureSha(mf, encSha);
  t("THROUGH THE OP the encrypted document still says WHY its /Info could not be read",
    encOut.text.producer && encOut.text.producer.why, "encrypted");
  await mf.dispose();
}

/* ================================================================= *
 * 8. THE REFUSAL BRANCH — a guard, and what it cannot see, STATED
 * ================================================================= */
console.log("\n--- the merge's refusal: driven, and its reach through the op stated plainly ---");
{
  /* `mergeTier2Text` refuses when the base has TEXT but no page grain to merge
     on, because there is then no way to tell WHICH text a wholesale assignment
     would replace: refusing costs an unread document and accepting costs an
     overwritten one, and only the second makes the record claim more than it can
     support. The wire's `else` branch carries that refusal into the notes.

     WHAT THIS SUITE CANNOT SEE, AND IT IS A FINDING RATHER THAN A GAP IN THE
     ARM: no producer in this plane can reach that branch today. `pdfstructure`
     emits a `pages[]` entry for every page it ordered, and its one pageless
     return (a document it could not open) carries ZERO characters — which takes
     the WHOLESALE branch, not the refusal. So the `else` at the call site is a
     GUARD against a future pageless text producer, driven here at the merge and
     unreachable through the op. It is not asserted to be reachable. */
  const pageless = { document: "some text a caller already holds", pages: [],
                     undetermined: [], counts: { chars: 32, undetermined: 0 } };
  const m = mergeTier2Text(pageless, { pages: [{ page: 0, text: "replacement", undetermined: [] }] });
  t("a pageless base holding text REFUSES rather than guessing", m.ok, false);
  /* CORRECTED AT D-514, 2026-09-24 — THE OLD ASSERTION WAS WRONG, NOT MERELY
     SUPERSEDED. It required the refusal to say "32 decoded character(s)", and 32
     is this string's raw `.length`: it counts the five spaces as decoded text.
     D-501 had already ruled that whitespace is not decoded text and that the unit
     is the GLYPH; D-514 carries that ruling into this judgment, so the sentence
     now reads 27 decoded GLYPHS — the same string, counted in the unit the claim
     is actually about. The figure is asserted rather than the phrase alone,
     because a refusal that names a number the document does not hold is exactly
     the defect D-514 exists to close, and an assertion on `/decoded glyph/` with
     no number would pass over any number at all.
     BOTH HALVES ARE PINNED ON PURPOSE: `counts.chars` STAYS 32 in the fixture
     above, unchanged, because the raw counter is still the raw counter (D-501's
     interface note) — what moved is which of the two this JUDGMENT reads. */
  t("and the refusal says what it is protecting, in the record's own words",
    /no per-page grain/.test(m.why) && /27 decoded glyph/.test(m.why), true);
  t("and it counts the string's GLYPHS, never its raw length (D-514: 32 characters, 27 glyphs)",
    /32 decoded/.test(m.why), false);
}

console.log(`\ntier2-wire: ${pass} pass, ${fail} fail`);
process.exit(fail ? 1 : 0);

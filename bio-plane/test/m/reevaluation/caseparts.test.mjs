/* reevaluation: R14's case half through the registration publication fills (R26, N210): a ratified case's owners are
   told once per affected or undetermined cited part, a cited part being a document the edition cites at the capture it
   pinned (publication R41's `{bundle_id, capture_sha}`, K365), graded directly at that capture; nobody else is told;
   with none registered the answer says so. `publication` is a stand-in here (it fills the registration in layer 8):
   `parts` answers publication R41's shape and `cases` lists the cases with a ratified edition. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, V, U } from "./fixture.mjs";
import { CASE_CURSOR, REEVALUATION_ACT_CHECKS } from "../../../src/reevaluation/index.mjs";
import { listenerRefusal } from "../../../src/membership/index.mjs";

const OLD = "INFO-2026-0001-old", NEW = "INFO-2026-0002-new", SAME = "INFO-2026-0003-same";
const CASE = "CASE-2026-0001-one", CASE2 = "CASE-2026-0002-unratified", CASE3 = "CASE-2026-0003-three";
const ADMIN = "class:admin";

/** Part OLD cited by CASE at its pinned capture a; a newer capture b of the same address that rewrites it; owners owen
 *  of project P; ann, a member who owns nothing. `register: false` leaves the slot empty. */
function setup({ newText = "something else entirely", address = true, register = true, extra = [] } = {}) {
  const w = world();
  const a = w.cap("a", "old"), b = w.cap("b", "new");
  w.doc(OLD, [a], { extra }); w.doc(NEW, [b]);
  w.read(a.sha, [U(0, "alpha"), U(1, "the budget was cut")]);
  w.read(b.sha, [U(0, "alpha"), U(1, newText)]);
  if (address) { w.at(a.sha, "ex.org/doc", "2026-09-01T00:00:00Z"); w.at(b.sha, "ex.org/doc", "2026-09-20T00:00:00Z"); }
  w.member("owen"); w.member("ann");
  const P = w.project("Case work", "owen");
  const asked = [];
  const pub = {
    ratified: { [CASE]: { case: CASE, edition: 1, project: P, parts: [{ bundle_id: OLD, capture_sha: a.sha }] } },
    // fixtures-contract: publication case-cited-parts
    parts: ({ case: c }) => {
      asked.push(c);
      return pub.ratified[c]
        ? { ok: true, ...pub.ratified[c], limit: 1000, truncated: false }
        : { ok: false, reason: "NO_SUCH_CASE_EDITION", case: c, edition: null };
    },
    cases: ({ after = "", limit = 200 }) => {
      const ids = [CASE, CASE2, CASE3].filter((c) => c > after).slice(0, limit);
      return { cases: ids, cursor: ids.length ? ids[ids.length - 1] : null };
    },
  };
  if (register) assert.deepEqual(w.r.registerCaseParts("publication", pub), { ok: true, module: "publication" });
  return { w, a, b, P, pub, asked };
}
const caseNotices = (w) => w.rows(`SELECT * FROM reevaluation_case_notices ORDER BY notice_id`);

test("R26: one registration; a malformed one is LISTENER_MALFORMED and a second LISTENER_DECLARED, both membership's (its R81)", () => {
  const w = world();
  const fns = { parts: () => null, cases: () => ({ cases: [] }) };
  for (const [module, f] of [["", fns], ["publication", null], ["publication", { parts: fns.parts }],
                             ["publication", { cases: fns.cases }], ["publication", () => null]]) {
    const r = w.r.registerCaseParts(module, f);
    assert.deepEqual(r, listenerRefusal(null, module, null), `malformed: ${module} ${typeof f}`);
    assert.equal(r.reason, "LISTENER_MALFORMED");
  }
  assert.deepEqual(w.r.registerCaseParts("publication", fns), { ok: true, module: "publication" });
  for (const module of ["publication", "someone-else"]) {
    const r = w.r.registerCaseParts(module, fns);
    assert.deepEqual(r, listenerRefusal({ module: "publication" }, module, fns.parts));
    assert.equal(r.reason, "LISTENER_DECLARED");
  }
});

test("R26: with none registered, no case owner is told and the answer says so (case_parts_absent)", () => {
  const { w } = setup({ register: false });
  const r = w.r.raiseNotices({});
  assert.deepEqual([r.ok, r.case_parts_absent, r.cursor, r.truncated], [true, true, null, false]);
  assert.match(r.case_parts_why, /not the same as none/);
  assert.equal(caseNotices(w).length, 0);
  const { w: w2 } = setup();
  assert.equal(w2.r.raiseNotices({}).case_parts_absent, undefined, "registered: not said");
});

test("R14 R26: an affected cited part tells the case's owners once per (case, part, newer capture); nobody else is told; a re-sweep tells nobody again", () => {
  const { w, a, b, P, asked } = setup();
  const heard = [];
  w.r.onBasisChanged("conformance", (e) => heard.push(e));
  const r = w.r.raiseNotices({});
  assert.deepEqual([r.count, r.cursor, r.truncated], [1, null, false]);
  const [n] = r.raised;
  assert.deepEqual([n.kind, n.case, n.edition, n.project, n.part, n.capture_sha, n.newer_capture, n.grade,
                    n.affects, n.owners], ["case", CASE, 1, P, OLD, a.sha, b.sha, "NOT_FOUND", "affected", ["owen"]]);
  assert.deepEqual(asked, [CASE, CASE2, CASE3], "each listed case is asked for its parts; one not ratified is passed over");
  assert.deepEqual(heard.map((e) => [e.kind, e.subject, e.source, e.affects, e.case.case, e.case.owners, e.notice]),
    [["passage", OLD, "newer_capture", "affected", CASE, ["owen"], n.notice]]);
  assert.equal(w.r.raiseNotices({}).count, 0, "told once");
  /* the owners read it; nobody else is told; a machine credential reads the record as it holds it */
  const owen = w.r.notices({ viewer: V("owen") });
  assert.deepEqual([owen.count, owen.notices[0].notice, owen.notices[0].kind, owen.notices[0].holder,
                    owen.notices[0].target, owen.notices[0].case], [1, n.notice, "case", CASE, OLD,
    { case: CASE, edition: 1, project: P, part: OLD }]);
  assert.deepEqual([owen.notices[0].newer_capture, owen.notices[0].affects], [b.sha, "affected"]);
  assert.equal(w.r.notices({ viewer: V("ann") }).count, 0, "a member who owns nothing is not told");
  assert.equal(w.r.notices({ viewer: "nobody" }).count, 0);
  assert.equal(w.r.notices({ viewer: ADMIN }).count, 1);
  assert.equal(w.r.notices({ holder: CASE, viewer: V("owen") }).count, 1, "listed by its case");
});

test("R14 R26: a newer capture that leaves the part unaffected tells nobody; undetermined is told; an unread chain tells nobody", () => {
  {
    const { w } = setup({ newText: "the budget was cut" });
    const r = w.r.raiseNotices({});
    assert.deepEqual([r.count, caseNotices(w).length], [0, 0], "A: unaffected");
  }
  {
    const { w, b } = setup();
    delete w.ex.units[b.sha];
    const r = w.r.raiseNotices({});
    assert.deepEqual([r.count, r.raised[0].grade, r.raised[0].affects], [1, "UNDETERMINED", "undetermined"]);
  }
  {
    const { w } = setup({ address: false });
    const r = w.r.raiseNotices({});
    assert.deepEqual([r.count, r.chain_unread], [0, 1], "no newer capture can be known");
  }
});

test("R26: a cited part is graded directly at the capture the edition pinned (its capture_sha), not today's", () => {
  const w = world();
  const x = w.cap("x", "first-held"), a = w.cap("a", "old"), b = w.cap("b", "new");
  w.doc(OLD, [x, a], { extra: [`content_hash: "${x.sha}"`] });
  w.doc(NEW, [b]);
  w.read(a.sha, [U(0, "alpha"), U(1, "the budget was cut")]);
  w.read(b.sha, [U(0, "alpha"), U(1, "something else entirely")]);
  w.at(a.sha, "ex.org/doc", "2026-09-01T00:00:00Z"); w.at(b.sha, "ex.org/doc", "2026-09-20T00:00:00Z");
  w.member("owen");
  const P = w.project("Case work", "owen");
  /* the part's live document names another capture (x); the edition pinned a, in any spelling of its hex */
  w.r.registerCaseParts("publication", {
    parts: () => ({ case: CASE, edition: 2, project: P, parts: [{ bundle_id: OLD, capture_sha: ` ${a.sha.toUpperCase()} ` }] }),
    cases: ({ after = "" }) => ({ cases: [CASE].filter((c) => c > after), cursor: null }) });
  const r = w.r.raiseNotices({});
  assert.deepEqual(r.raised.map((n) => [n.part, n.capture_sha, n.newer_capture, n.edition]), [[OLD, a.sha, b.sha, 2]]);
  /* a part naming no whole capture (none, not a sha-256, or only a bundle sha, the shape before K365) is passed over:
     nothing is graded, nobody told */
  for (const bad of [{ bundle_id: OLD }, { bundle_id: OLD, capture_sha: "abc" }, { bundle_id: OLD, bundle_sha: a.sha },
                     { capture_sha: a.sha }, null]) {
    const w2 = setup({ register: false }).w;
    w2.r.registerCaseParts("publication", {
      parts: () => ({ case: CASE, edition: 1, project: null, parts: [bad] }),
      cases: ({ after = "" }) => ({ cases: [CASE].filter((c) => c > after), cursor: null }) });
    const r2 = w2.r.raiseNotices({});
    assert.deepEqual([r2.count, caseNotices(w2).length], [0, 0], JSON.stringify(bad));
  }
});

test("R26 R25: the case half follows the legs in the sweep's cursor, one case counting one toward the limit, and a pass reads it to its end", () => {
  const { w, b } = setup();
  /* a question resting on the old passage too, so the leg half has one leg */
  const cid = w.passage(OLD, w.rows(`SELECT capture_sha FROM register WHERE bundle_id=?`, OLD)[0].capture_sha);
  w.inquiry("INQ-2026-0001-q", { legs: [{ target: OLD, content_id: cid }] });
  const first = w.r.raiseNotices({ limit: 1 });
  assert.deepEqual([first.raised.map((n) => n.kind ?? "leg"), first.truncated, first.cursor], [["leg"], true, CASE_CURSOR]);
  const pages = [];
  for (let cur = first.cursor; cur;) {
    const p = w.r.raiseNotices({ limit: 1, after: cur });
    pages.push([p.cursor, p.raised.map((n) => n.case)]);
    cur = p.cursor;
  }
  assert.deepEqual(pages, [[`${CASE_CURSOR}${CASE}`, [CASE]], [`${CASE_CURSOR}${CASE2}`, []], [`${CASE_CURSOR}${CASE3}`, []], [null, []]]);
  /* the scheduled sweep runs the same pass: a newer capture after it tells the owners of the yet newer version */
  const c = w.cap("c", "newest");
  w.doc("INFO-2026-0009-newest", [c]);
  w.read(c.sha, [U(0, "alpha"), U(1, "rewritten again")]);
  w.at(c.sha, "ex.org/doc", "2026-09-25T00:00:00Z");
  const now = Date.parse("2026-09-28T02:00:00Z");
  const told = [];
  for (let i = 0; i < 10 && w.r.noticeSweepDue(now) !== null; i++) told.push(...w.r.noticeSweep(now).raised);
  assert.equal(w.r.noticeSweepDue(now), null, "the pass completed");
  assert.deepEqual(told.filter((n) => n.kind === "case").map((n) => [n.case, n.newer_capture]), [[CASE, c.sha]]);
  assert.ok(b);
});

test("R15 R26: an owner keeps the earlier version of a case's cited part; adopting it is refused (a new edition is the case's authors'); others read it as absent", () => {
  const { w, a, b } = setup();
  const [n] = w.r.raiseNotices({}).raised;
  const before = w.snapshot();
  const ann = w.r.keepVersion({ notice: n.notice, author: "ann", viewer: V("ann") });
  assert.deepEqual([ann.code, ann.check], ["VERSION_NOTICE_NOT_FOUND", "C-110.3"], "not an owner: absent");
  const m = w.r.keepVersion({ notice: n.notice, author: "class:daemon", viewer: ADMIN });
  assert.equal(m.code, "MACHINE_CANNOT_KEEP_VERSION");
  const ad = w.r.adoptVersion({ notice: n.notice, why: "the newer text is the one in force", author: "owen", viewer: V("owen") });
  assert.deepEqual([ad.ok, ad.code, ad.check, ad.translation, ad.notice], [false, "VERSION_ADOPT_UNWRITABLE", "C-110.9",
    REEVALUATION_ACT_CHECKS.VERSION_ADOPT_UNWRITABLE.translation, n.notice]);
  assert.match(ad.detail, /new edition/);
  assert.deepEqual(w.snapshot(), before, "each refusal writes nothing");
  const k = w.r.keepVersion({ notice: n.notice, why: "the edition quotes the earlier text", author: "owen", viewer: V("owen") });
  assert.deepEqual([k.ok, k.act, k.author, k.capture_sha, k.newer_capture, k.why], [true, "kept", "owen", a.sha, b.sha,
    "the edition quotes the earlier text"]);
  assert.match(k.says, new RegExp(`case ${CASE}'s cited part ${OLD}`));
  const [row] = w.r.notices({ state: "kept", viewer: V("owen") }).notices;
  assert.deepEqual([row.state, row.closed_by, row.why], ["kept", "owen", "the edition quotes the earlier text"]);
  assert.equal(w.r.notices({ viewer: V("owen") }).count, 0, "no longer open");
  assert.equal(w.r.raiseNotices({}).count, 0, "not told again for the same capture");
  assert.equal(w.r.keepVersion({ notice: n.notice, author: "owen", viewer: V("owen") }).code, "VERSION_NOTICE_CLOSED");
});

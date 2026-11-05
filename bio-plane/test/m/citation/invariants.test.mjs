/* citation: the retired-target predicate (R5), the invariants (R6, R9, R10, R11) and the op routes the control plane
   reaches (K3, R7), at the module's interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { world, V, biasMd, docMd } from "./fixture.mjs";
import { citationOps, inquiryServices, CITE_CHECKS, CITE_EXTENT_CHECKS } from "../../../src/citation/index.mjs";
import { inquiryOf, BASIS_ROLES, checkLegExtentGrammar } from "../../../src/inquiry/index.mjs";
import { STATES, OBJECT_TYPES } from "../../../src/record-grammar/index.mjs";
import * as recordGrammar from "../../../src/record-grammar/index.mjs";
import * as recordCore from "../../../src/record-core/index.mjs";
import * as membership from "../../../src/membership/index.mjs";
import * as promotion from "../../../src/promotion/index.mjs";
import * as content from "../../../src/content/index.mjs";
import * as retrieval from "../../../src/retrieval/index.mjs";
import * as inquiry from "../../../src/inquiry/index.mjs";

const ANN = { viewer: V("ann"), owner: "o", author: "member:ann", identity: V("ann") };

test("R5: true exactly when the current state is retired, for every type whose machine carries a retired state (each of its states in turn); false for every other type, an absent id and any non-id", () => {
  const w = world();
  /* Every retiring type the catalogue declares, read from its state tables rather than pinned (N203): a type that
     gains a `retired` state is covered the day it gains it. Each is promoted once per legal state. */
  const retiring = Object.entries(STATES).filter(([t, s]) => s.legal.includes("retired") && STATES[t] !== STATES.focus)
    .map(([t]) => t).sort();
  const prefixOf = Object.fromEntries(Object.entries(OBJECT_TYPES).map(([p, t]) => [t, p]));
  assert.ok(retiring.length >= 3 && retiring.includes("aspiration"), `the retiring types: ${retiring}`);
  let n = 0;
  for (const type of retiring) {
    assert.ok(prefixOf[type], `a prefix for ${type}`);
    for (const state of STATES[type].legal) {
      const id = `${prefixOf[type]}-2026-${String(++n).padStart(4, "0")}`;
      w.put(id, type === "bias" ? biasMd(id, state) : docMd(id, type, state));
      assert.equal(w.record.head(id).currentState, state, id);
      assert.equal(w.cit.retiredNotCitable(id), state === "retired", `${type} in ${state}`);
    }
  }
  w.inquiry("INQ-2026-0001");
  const p = w.project();
  for (const id of ["INQ-2026-0001", p, "INFO-2026-0404"])
    assert.equal(w.cit.retiredNotCitable(id), false, id);
  for (const v of [null, undefined, "", 7, {}, []]) assert.equal(w.cit.retiredNotCitable(v), false);
});

test("R5: never viewer-gated — a retired item inside a project nobody else may see answers the same to every caller; never throws", () => {
  const w = world();
  w.put("INFO-2026-0001", docMd("INFO-2026-0001", "information", "retired"));
  assert.equal(w.cit.retiredNotCitable.length, 1, "it takes an id and nothing else");
  assert.equal(w.cit.retiredNotCitable("INFO-2026-0001"), true);
  const broken = world();
  broken.put("INFO-2026-0001", docMd("INFO-2026-0001", "information", "retired"));
  broken.st.db.exec("DROP TABLE bundles");
  assert.equal(broken.cit.retiredNotCitable("INFO-2026-0001"), false);
});

test("R6: a citation exists only in the citing document's bytes — the acts write no refs row and no inquiry_basis row; every row they write is the promotion of the citing document's new bytes (or the selection's last use)", async () => {
  const w = world();
  w.info("INFO-2026-0001");
  const q = w.inquiry("INQ-2026-0001");
  const p = w.project();
  const h = await w.select(["INFO-2026-0001"]);
  /* Every write statement the storage runs, with the promotion or selection read it ran inside. Which derived tables a
     promotion moves (record-core's, retrieval's projection, whatever later modules register) is the promotion's, not
     pinned here (K354): what R6 says is that nothing reaches a table except through the document. */
  const writes = [], promoted = [];
  let inside = null;
  const exec = w.st.sql.exec;
  w.st.sql.exec = (sql, ...args) => {
    const m = /^\s*(?:INSERT(?:\s+OR\s+\w+)?\s+INTO|REPLACE\s+INTO|UPDATE(?:\s+OR\s+\w+)?|DELETE\s+FROM)\s+"?(\w+)/i.exec(sql);
    if (m) writes.push({ table: m[1], inside });
    return exec.call(w.st.sql, sql, ...args);
  };
  const around = (obj, name, tag) => {
    const f = obj[name];
    obj[name] = (a) => { const was = inside; inside = tag(a); try { return f.call(obj, a); } finally { inside = was; } };
  };
  around(w.promotion, "promote", (pkg) => { promoted.push(pkg.bundleId); return `promote ${pkg.bundleId}`; });
  around(w.retrieval, "selectionResolve", () => "selection");
  const before = w.snapshot();
  assert.equal(w.cit.cite({ project: p, handle: h, ...ANN }).ok, true);
  assert.equal(w.cit.cite({ project: q, handle: h, ...ANN, role: "supports" }).ok, true);
  assert.equal(w.cit.sever({ project: p, handle: h, ...ANN, reason: "x" }).ok, true);
  const after = w.snapshot();
  /* The spy sees the promotions' own writes (a control: an empty log would prove nothing). */
  assert.ok(writes.some((x) => x.inside === `promote ${p}`) && writes.some((x) => x.inside === `promote ${q}`));
  /* One promotion per act, each of the citing object, and no row written outside a promotion or the selection's read. */
  assert.deepEqual(promoted, [p, q, p]);
  assert.deepEqual(writes.filter((x) => x.inside === null), []);
  /* No write names either projection, and neither holds a row. */
  assert.deepEqual(writes.filter((x) => /^(refs|inquiry_basis)$/i.test(x.table)), []);
  for (const t of ["refs", "inquiry_basis"]) assert.equal(after[t], before[t], t);
  assert.equal(w.count("inquiry_basis"), 0);
  assert.equal("refs" in after ? JSON.parse(after.refs).length : 0, 0);
  /* The citations themselves are in the citing documents' bytes. */
  assert.deepEqual(w.fm(p).references.map((e) => [e.rel, e.target, e.status]), [["cites", "INFO-2026-0001", "severed"]]);
  assert.deepEqual(w.fm(q).basis.map((l) => [l.target, l.role]), [["INFO-2026-0001", "supports"]]);
});

test("R9: every act naming a project the viewer may not see answers exactly as an absent one", async () => {
  const w = world();
  w.info("INFO-2026-0001");
  const p = w.project();
  const h = await w.select(["INFO-2026-0001"], { viewer: V("vera"), owner: "v" });
  const as = { viewer: V("vera"), owner: "v", identity: V("vera"), author: "member:vera", reason: "x", note: "n" };
  for (const act of ["cite", "sever", "reinstate"]) {
    const hidden = w.cit[act]({ project: p, handle: h, ...as });
    const absent = w.cit[act]({ project: "PROJ-2026-0001-absent", handle: h, ...as });
    assert.equal(hidden.reason, "NO_SUCH_PROJECT", act);
    assert.deepEqual(Object.keys(hidden).sort(), Object.keys(absent).sort());
    assert.equal(hidden.detail, absent.detail);
  }
});

test("R10: no place is named in this module's outward text — its rows, and the refusals and answers its acts give", async () => {
  const PLACES = /oakland|alameda|california|berkeley|san francisco|county|city of/i;
  for (const row of [...Object.values(CITE_CHECKS), ...Object.values(CITE_EXTENT_CHECKS)]) assert.doesNotMatch(row.translation, PLACES);
  const w = world();
  w.info("INFO-2026-0001");
  const q = w.inquiry("INQ-2026-0001");
  const p = w.project();
  const h = await w.select(["INFO-2026-0001"]);
  const answers = [
    w.cit.cite({ project: p, handle: h, ...ANN, note: '"' }), w.cit.cite({ project: q, handle: h, ...ANN }),
    w.cit.cite({ project: q, handle: h, ...ANN, role: "x" }), w.cit.cite({ project: p, handle: h, ...ANN, role: "supports" }),
    w.cit.cite({ project: q, handle: h, ...ANN, role: "supports", extent: { nope: "1" } }),
    w.cit.cite({ project: p, handle: h, ...ANN }), w.cit.cite({ project: p, handle: h, ...ANN }),
    w.cit.sever({ project: p, handle: h, ...ANN }), w.cit.sever({ project: p, handle: h, ...ANN, reason: "x" }),
    w.cit.cite({ project: p, handle: h, ...ANN }), w.cit.reinstate({ project: p, handle: h, ...ANN, reason: "y" }),
    w.cit.cite({ project: "INFO-2026-0001", handle: h, ...ANN }),
  ];
  for (const a of answers) assert.doesNotMatch(JSON.stringify(a), PLACES);
  assert.doesNotMatch(w.md(p), PLACES);
});

test("R11: each check moved here with its number, code and translation unchanged, its `where` re-pointed to this module, the rows T35 added (R1) beside them, and no other home holds its code or number", () => {
  assert.deepEqual(Object.entries(CITE_CHECKS).map(([k, r]) => [k, r.check, r.where]), [
    ["BAD_NOTE", "C-33.15", "src/citation/index.mjs cite > is-cite-note"],
    ["NO_ROLE", "C-33.16", "src/citation/index.mjs cite > is-cite-role"],
    ["BAD_ROLE", "C-33.17", "src/citation/index.mjs cite > is-cite-role"],
    ["ROLE_NOT_APPLICABLE", "C-33.18", "src/citation/index.mjs cite > is-cite-role"],
    ["SEVERED_EDGE", "C-33.19", "src/citation/index.mjs cite > is-cite-severed"],
    ["RETIRED_NOT_CITABLE", "C-33.39", "src/citation/index.mjs cite > is-cite-retired"],
    ["NO_SUCH_QUESTION", "C-33.52", "src/citation/index.mjs cite > is-cite-question"],
    ["BAD_GROUND", "C-33.58", "src/citation/index.mjs cite > is-cite-ground"],
    ["WHICH_PASSAGE", "C-33.65", "src/citation/index.mjs #edgeTransition > is-which-passage"],
    ["NOT_AN_INQUIRY", "C-33.53", "src/citation/index.mjs cite > is-cite-question"],
  ]);
  assert.deepEqual(Object.entries(CITE_EXTENT_CHECKS).map(([k, r]) => [k, r.check, r.where]), [
    ["UNKNOWN_EXTENT_FIELD", "C-45.7", "src/citation/index.mjs cite > is-cite-extent"],
    ["EXTENT_NOT_APPLICABLE", "C-45.8", "src/citation/index.mjs cite > is-cite-extent"],
    ["EXTENT_ON_MANY", "C-45.9", "src/citation/index.mjs cite > is-cite-extent"],
    ["BAD_EXTENT_VALUE", "C-45.10", "src/citation/index.mjs cite > is-cite-extent"],
    ["CITE_ONE_SOURCE", "C-45.14", "src/citation/index.mjs cite > is-cite-found"],
    ["FOUND_MALFORMED", "C-45.15", "src/citation/index.mjs cite > is-cite-found"],
    ["FOUND_CAPTURE_MOVED", "C-45.16", "src/citation/index.mjs cite > is-cite-found"],
  ]);
  for (const r of [...Object.values(CITE_CHECKS), ...Object.values(CITE_EXTENT_CHECKS)]) assert.ok(r.translation.length > 80);
  /* The rest of C-45 is `content`'s own table (its R48): none of this module's four codes or numbers is there. */
  const { CONTENT_EXTENT_CHECKS } = content;
  assert.ok(Object.keys(CONTENT_EXTENT_CHECKS).length > 0, "content's C-45 table is read (a control)");
  for (const k of Object.keys(CITE_EXTENT_CHECKS)) assert.equal(k in CONTENT_EXTENT_CHECKS, false, `${k} is not content's`);
  /* The act-shape family C-33 has no single home since its rows moved: each is held by the module that mints it. Every
     row table the modules this one uses publish (each `*_CHECKS` export of their entries, record-grammar's shared act
     rows C-33.40 and C-33.41 among them) is read, and none holds one of this module's codes or numbers. */
  const homes = [];
  for (const [name, mod] of Object.entries({ recordGrammar, recordCore, membership, promotion, content, retrieval, inquiry }))
    for (const [exp, table] of Object.entries(mod))
      if (/_CHECKS$/.test(exp) && table && typeof table === "object")
        for (const [code, row] of Object.entries(table))
          if (row && typeof row.check === "string") homes.push({ home: `${name}.${exp}`, code, check: row.check });
  assert.ok(homes.some((h) => h.home === "recordGrammar.SHARED_ACT_CHECKS" && h.check === "C-33.40"), "the shared act rows are read (a control)");
  assert.ok(homes.some((h) => /^C-33\./.test(h.check) && h.home.startsWith("retrieval.")), "retrieval's act-shape rows are read (a control)");
  for (const [code, row] of [...Object.entries(CITE_CHECKS), ...Object.entries(CITE_EXTENT_CHECKS)])
    assert.deepEqual(homes.filter((h) => h.code === code || h.check === row.check), [], `${code} (${row.check}) is held only here`);
});

test("K3, R1, R7, R14: the op routes — the control plane's stamps are read from the query and `cite`'s fields from the body, the part arrives whole as a bag, a found match as one JSON value with the optional question, and no weight is read from the caller", async () => {
  const calls = [];
  const fake = new Proxy({}, { get: (_, act) => (a) => { calls.push([act, a]); return { ok: true, act }; } });
  const url = new URL("http://x/?project=P&handle=H&viewer=member:ann&owner=o&note=n&author=member:ann&identity=member:ann"
    + "&role=supports&weight=refuse&extent_kind=pdf-page&extent_page=2&content_id=&other=1&reason=why");
  /* C31: `cite` reads its fields from the body; the address carries the door's stamps only. */
  const body = { project: "P", handle: "H", note: "n", role: "supports", weight: "refuse", extent_kind: "pdf-page", extent_page: 2, content_id: "", other: 1 };
  const ops = citationOps(fake, url, body);
  assert.deepEqual(Object.keys(ops).sort(), ["cite", "citeimported", "drawquestion", "leggrade", "reinstate", "sever", "withdrawimported"]);
  ops.cite(); ops.sever(); ops.reinstate();
  assert.deepEqual(calls[0], ["cite", { project: "P", handle: "H", viewer: "member:ann", owner: "o", note: "n", author: "member:ann",
    identity: "member:ann", role: "supports", ground: null, extent: { extent_kind: "pdf-page", extent_page: "2", content_id: "" },
    found: null, question: null, names: null }]);
  const edgeArgs = { project: "P", handle: "H", viewer: "member:ann", owner: "o", reason: "why", author: "member:ann", identity: "member:ann" };
  /* R25: both also read the passage's part, as `cite` names it. */
  const part = { extent_kind: "pdf-page", extent_page: "2", content_id: "" };
  assert.deepEqual(calls[1], ["sever", { ...edgeArgs, extent: part }]);
  /* R23: `reinstate` also reads the optional `role` (the body first, as `cite`'s fields); `sever` reads none. */
  assert.deepEqual(calls[2], ["reinstate", { ...edgeArgs, role: "supports", extent: part }]);
  citationOps(fake, new URL("http://x/?project=P&handle=H&reason=why"), {}).reinstate();
  assert.equal(calls.pop()[1].role, null, "control: no role sent, none read");
  const bare = citationOps(fake, new URL("http://x/?project=P"), { project: "P" });
  bare.cite(); bare.sever();
  assert.deepEqual([calls[3][1].note, calls[3][1].extent, calls[3][1].role, calls[3][1].found, calls[3][1].question, calls[4][1].reason],
                   ["", {}, null, null, null, ""]);
  /* A found match arrives parsed, whole; one that does not parse arrives as sent, for FOUND_MALFORMED to name. */
  const m = { kind: "term", words: "w", capture_sha: "a".repeat(64), extent: { kind: "pdf-page", page: 0 }, origin: "search" };
  citationOps(fake, new URL("http://x/"), { project: "P", question: "INQ-1", found: JSON.stringify(m) }).cite();
  assert.deepEqual([calls[5][1].found, calls[5][1].question, calls[5][1].handle], [m, "INQ-1", null]);
  citationOps(fake, new URL("http://x/"), { project: "P", found: "{not-json" }).cite();
  assert.equal(calls[6][1].found, "{not-json");
  /* R14: `drawquestion` reads the case, the question, the note and the stamps; no selection, no weight, no document. */
  citationOps(fake, url).drawquestion();
  citationOps(fake, new URL("http://x/?project=P&inquiry=INQ-1&note=n&viewer=member:ann&author=member:ann&identity=member:ann&weight=refuse&handle=H")).drawquestion();
  assert.deepEqual(calls[7], ["drawQuestion", { project: "P", inquiry: null, note: "n", author: "member:ann", viewer: "member:ann", identity: "member:ann" }]);
  assert.deepEqual(calls[8], ["drawQuestion", { project: "P", inquiry: "INQ-1", note: "n", author: "member:ann", viewer: "member:ann", identity: "member:ann" }]);
  citationOps(fake, new URL("http://x/?project=P&inquiry=INQ-1")).drawquestion();
  assert.equal(calls[9][1].note, "");
  /* Through the real module: a cite over the route lands, weight report. */
  const w = world();
  w.info("INFO-2026-0001");
  const p = w.project();
  const h = await w.select(["INFO-2026-0001"]);
  const r = citationOps(w.cit, new URL("http://x/?viewer=member:ann&owner=o&identity=member:ann&weight=refuse"), { project: p, handle: h, weight: "refuse" }).cite();
  assert.deepEqual([r.ok, r.weight, r.cited], [true, "report", ["INFO-2026-0001"]]);
});

test("R2, R8: the factory's default inquiry services are inquiry's own — its earned registry (R13), leg grammar (R5) and roles (R4)", async () => {
  const w = world();
  w.info("INFO-2026-0001");
  const k = inquiryOf(w.host, { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content });
  const s = inquiryServices(k);
  assert.equal(s.checkLegExtentGrammar, checkLegExtentGrammar);
  assert.deepEqual(s.BASIS_ROLES, ["supports", "cuts_against"]);
  assert.equal(s.BASIS_ROLES, BASIS_ROLES);
  assert.deepEqual(s.earned(null, ["INFO-2026-0001"]), k.earned(null, ["INFO-2026-0001"]));
  /* Nothing resolved to a subject: nothing is earned on the connection axis, so a leg would be written ungraded (R8). */
  const reg = s.earned(null, ["INFO-2026-0001"]);
  assert.equal(reg?.earned?.connection?.["INFO-2026-0001"]?.grade ?? null, null);
});

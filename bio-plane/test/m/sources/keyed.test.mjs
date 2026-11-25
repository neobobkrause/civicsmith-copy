/* sources: a member-keyed outside source (T33-22; K1449, K1492 (3)): a capture marked by the member who made it, on
   their own account (R16), read with its lower grade and never as reproducible by the public (R17), never taken in
   bulk, never unattended, and never a record of what the member searched for (R18); the tables declared with their
   classes (R19). */
import test from "node:test";
import assert from "node:assert/strict";
import { seeded, V, MACHINE, SECRET, sha } from "./fixture.mjs";
import { SOURCES_CHECKS, SOURCES_TABLES, SOURCES_OP_NAMES, SERVICE_MAX, TERMS_MAX, sourcesOps } from "../../../src/sources/index.mjs";
import { BASIS_GRADES } from "../../../src/record-grammar/index.mjs";

const codeOf = (r) => (r && r.ok === false ? r.reason : "ok");
const rowOf = (r, code) => { assert.equal(r.check, SOURCES_CHECKS[code].check); assert.equal(r.translation, SOURCES_CHECKS[code].translation); };
const SEARCH = "Pat Q. Example, born 1971, last seen at 12 Elm Street";

test("R16 markKeyedResult records that a capture is a member-keyed result, by that member's own act on their own capture, with the vendor and the terms as stated; appended with by and the instant, never edited or removed", () => {
  const w = seeded();
  const c = w.captured({ actor: "bob" });
  w.tick();
  const m = w.s.markKeyedResult({ captureSha: c.sha, service: " PeopleFinder Pro ", terms: "Personal use only; no resale.", by: "bob" });
  assert.deepEqual(m, { ok: true, captureSha: c.sha, service: "PeopleFinder Pro", terms: "Personal use only; no resale.", by: "bob",
                        at: new Date(w.clock.now).toISOString() });
  assert.deepEqual(w.rows(`SELECT capture_sha, service, terms, by, at FROM source_keyed_marks`),
                   [{ capture_sha: c.sha, service: "PeopleFinder Pro", terms: "Personal use only; no resale.", by: "bob", at: m.at }]);
  /* the stamp's spellings name the same member; the capture's actor may be stamped `member:<id>` */
  const c2 = w.captured({ actor: "member:carol" });
  assert.equal(w.s.markKeyedResult({ captureSha: c2.sha.toUpperCase(), service: "CourtSearch", by: V("carol") }).by, "carol",
               "a digest in either case names the capture; terms may be left unstated");
  assert.equal(w.rows(`SELECT terms FROM source_keyed_marks WHERE capture_sha = ?`, c2.sha)[0].terms, null);
  /* the founder marks their own capture */
  const c3 = w.captured({ actor: "admin" });
  assert.equal(w.s.markKeyedResult({ captureSha: c3.sha, service: "S", by: "member:admin" }).ok, true);
  /* the same mark again writes nothing; a different one is appended and is the one read; the earlier row is unchanged */
  const before = w.rows(`SELECT * FROM source_keyed_marks ORDER BY seq`);
  w.tick();
  const again = w.s.markKeyedResult({ captureSha: c.sha, service: "PeopleFinder Pro", terms: "Personal use only; no resale.", by: "bob" });
  assert.equal(again.existed, true);
  assert.equal(again.at, m.at, "the mark that stands is the first one");
  assert.deepEqual(w.rows(`SELECT * FROM source_keyed_marks ORDER BY seq`), before, "the same mark again writes nothing");
  w.tick();
  const changed = w.s.markKeyedResult({ captureSha: c.sha, service: "PeopleFinder Pro", terms: "Terms of 2026-09", by: "bob" });
  assert.equal(changed.ok, true); assert.equal(changed.existed, undefined);
  assert.deepEqual(w.rows(`SELECT * FROM source_keyed_marks ORDER BY seq`).slice(0, before.length), before, "never edited or removed");
  assert.equal(w.count("source_keyed_marks"), before.length + 1, "appended");
  assert.equal(w.s.keyedResultOf(c.sha).at, changed.at, "the latest mark is read");
  /* no op of this module removes or edits a mark */
  const ops = sourcesOps(w.s, new URL("http://do/x?by=bob"), {});
  assert.deepEqual(Object.keys(ops).filter((k) => /keyed/.test(k)), ["sourcekeyed"]);
});

test("R16 refusals, in order, each with its row and a negative control, writing nothing: MACHINE_CANNOT_MARK, NO_SERVICE, NO_SUCH_CAPTURE, NOT_YOUR_CAPTURE", async () => {
  const w = seeded();
  const own = w.captured({ actor: "bob" }), carols = w.captured({ actor: "carol" });
  const daemons = w.captured({ actor: null, actorClass: "daemon" }), daves = w.captured({ actor: "dave" });
  const knock = await w.pulled({ secret: SECRET });
  const good = { captureSha: own.sha, service: "PeopleFinder", terms: "personal use", by: "bob" };
  const before = w.snapshot();
  const cases = [
    /* MACHINE_CANNOT_MARK: a machine credential, a daemon, a scheduled consumer, none, an empty stamp, a member not active */
    ...[MACHINE, "token:scheduler", "class:daemon", "daemon", "system", "session", "agent", undefined, null, "", "  ", V("dave"), V("nobody")]
      .map((by) => [{ by }, "MACHINE_CANNOT_MARK", `by ${String(by)}`]),
    /* NO_SERVICE, naming the field */
    ...[undefined, null, "", "   ", 7, ["PeopleFinder"], "x".repeat(SERVICE_MAX + 1)].map((service) => [{ service }, "NO_SERVICE", `service ${JSON.stringify(service)}`, "service"]),
    ...[7, { text: "t" }, ["t"], "x".repeat(TERMS_MAX + 1)].map((terms) => [{ terms }, "NO_SERVICE", `terms ${JSON.stringify(terms)}`, "terms"]),
    /* NO_SUCH_CAPTURE: not held, not a digest, more than one capture (one capture per act), a knock pulled but never promoted */
    ...[sha("never captured"), "not-a-digest", undefined, [own.sha, carols.sha], `${own.sha},${carols.sha}`, knock.row.sha256]
      .map((captureSha) => [{ captureSha }, "NO_SUCH_CAPTURE", `captureSha ${JSON.stringify(captureSha)}`]),
    /* NOT_YOUR_CAPTURE: another member's, a daemon's (no actor), a revoked member's */
    ...[carols, daemons, daves].map((c) => [{ captureSha: c.sha }, "NOT_YOUR_CAPTURE", `the capture of ${c.bundleId}`]),
  ];
  for (const [bad, code, why, field] of cases) {
    const r = w.s.markKeyedResult({ ...good, ...bad });
    assert.equal(codeOf(r), code, why); rowOf(r, code);
    if (field) assert.equal(r.field, field, why);
    assert.ok(!JSON.stringify(r).includes("personal use") && !JSON.stringify(r).includes("PeopleFinder"), `${why}: no field of the call echoed`);
  }
  /* the order: a call wrong everywhere answers the earliest */
  assert.equal(codeOf(w.s.markKeyedResult({ captureSha: "x", service: "", by: MACHINE })), "MACHINE_CANNOT_MARK");
  assert.equal(codeOf(w.s.markKeyedResult({ captureSha: "x", service: "", by: "bob" })), "NO_SERVICE");
  assert.equal(codeOf(w.s.markKeyedResult({ captureSha: "x", service: "S", by: "bob" })), "NO_SUCH_CAPTURE");
  assert.equal(codeOf(w.s.markKeyedResult({ captureSha: carols.sha, service: "S", by: "bob" })), "NOT_YOUR_CAPTURE");
  for (const args of [undefined, null, "text", 5]) assert.equal(codeOf(w.s.markKeyedResult(args)), "MACHINE_CANNOT_MARK");
  assert.deepEqual(w.snapshot(), before, "a refused mark writes nothing");
  /* the negative controls: each refused capture marked by its own member */
  assert.equal(w.s.markKeyedResult(good).ok, true);
  assert.equal(w.s.markKeyedResult({ ...good, captureSha: carols.sha, by: "carol" }).ok, true);
  assert.equal(w.s.markKeyedResult({ ...good, terms: undefined, service: "x".repeat(SERVICE_MAX), captureSha: (w.captured()).sha }).ok, true);
  assert.equal(w.s.markKeyedResult({ ...good, terms: "x".repeat(TERMS_MAX), captureSha: (w.captured()).sha }).ok, true);
});

test("R16 the op sourcekeyed reaches markKeyedResult with the control plane's stamp, never a body's", () => {
  const w = seeded();
  const c = w.captured({ actor: "carol" });
  const op = (q, body) => sourcesOps(w.s, new URL(`http://do/x?${new URLSearchParams(q)}`), body).sourcekeyed();
  assert.equal(op({}, { captureSha: c.sha, service: "S", by: "carol" }).reason, "MACHINE_CANNOT_MARK", "a body's by never stands in");
  assert.equal(op({ by: "bob" }, { captureSha: c.sha, service: "S", by: "carol" }).reason, "NOT_YOUR_CAPTURE", "the stamp wins over the body's by");
  const m = op({ by: "carol" }, { captureSha: c.sha, service: "S", terms: "t", query: SEARCH });
  assert.equal(m.ok, true); assert.equal(m.by, "carol");
  assert.equal(op({ by: "carol" }, null).reason, "NO_SERVICE");
});

test("R17 keyedResultOf answers a marked capture's {member_keyed: true, service, by, at, reproducible_by_public: false, grade_cap}, else null, and never throws; grade_cap is one rank below the capture's own letter in BASIS_GRADES' order, D staying D", () => {
  const w = seeded();
  /* real routes, as provenance grades them: direct B, archive C, doorbell and none no letter under the ceiling B */
  const routes = [["direct", "B", "C"], ["archive.org", "C", "D"], ["doorbell", null, "C"], [null, null, "C"]];
  for (const [via, letter, cap] of routes) {
    const c = w.captured({ via });
    assert.equal(w.prov.captureGrade(c.sha).grade, letter, `${via}: the capture's own letter`);
    w.tick();
    const m = w.s.markKeyedResult({ captureSha: c.sha, service: "PeopleFinder", terms: "t", by: "bob" });
    assert.deepEqual(w.s.keyedResultOf(c.sha), { member_keyed: true, service: "PeopleFinder", by: "bob", at: m.at,
                                                 reproducible_by_public: false, grade_cap: cap }, `${via}`);
    assert.ok(BASIS_GRADES.indexOf(cap) > BASIS_GRADES.indexOf(letter ?? w.prov.captureGrade(c.sha).ceiling),
              `${via}: the cap is lower than the capture would otherwise carry`);
  }
  /* a member's own observation (authored, provenance R27) earns no capture letter and no ceiling: held at D */
  const obs = w.captured({ via: null, authored: true });
  assert.equal(w.prov.captureGrade(obs.sha).basis, "CAPTURE_AXIS_AUTHORED");
  w.tick();
  assert.equal(w.s.markKeyedResult({ captureSha: obs.sha, service: "PeopleFinder", by: "bob" }).ok, true);
  assert.equal(w.s.keyedResultOf(obs.sha).grade_cap, "D");
  /* every letter captureGrade can answer, and none (an authored observation: no letter and no ceiling) */
  const expected = { A: "B", B: "C", C: "D", D: "D" };
  assert.deepEqual(Object.keys(expected), [...BASIS_GRADES], "every letter, in BASIS_GRADES' order");
  for (const [answer, cap] of [...Object.entries(expected).map(([g, c]) => [{ grade: g, determined: true }, c]),
                                [{ grade: null, route: "authored", determined: false, basis: "CAPTURE_AXIS_AUTHORED", testimony: "D" }, "D"]]) {
    const v = seeded({ gradeAs: answer });
    const c = v.captured();
    assert.equal(v.s.markKeyedResult({ captureSha: c.sha, service: "S", by: "bob" }).ok, true);
    assert.equal(v.s.keyedResultOf(c.sha).grade_cap, cap, JSON.stringify(answer));
  }
  /* null for a capture not marked, and never a throw */
  const unmarked = w.captured();
  assert.equal(w.s.keyedResultOf(unmarked.sha), null);
  for (const x of [undefined, null, "", "nope", 7, {}, [unmarked.sha], sha("never captured")]) {
    assert.doesNotThrow(() => w.s.keyedResultOf(x));
    assert.equal(w.s.keyedResultOf(x), null, JSON.stringify(x));
  }
});

test("R18 no path takes rows in bulk from a member-keyed source, no act runs unattended, and nothing records what a member searched for: one capture per act, by an active member's own stamp, holding the vendor and terms only", async () => {
  const w = seeded();
  const own = w.captured({ actor: "bob" }), more = w.captured({ actor: "bob" });
  /* never in bulk: no op but the one mark, and the mark takes one capture; a list, a batch or rows are not a capture */
  const ops = Object.keys(sourcesOps(w.s, new URL("http://do/x"), {}));
  const before_mark = SOURCES_OP_NAMES.filter((k) => k !== "sourcekeyed");
  assert.deepEqual(ops.filter((k) => !before_mark.includes(k)), ["sourcekeyed"],
                   "the only new path is the one-capture mark: no import of a vendor's records");
  const before = w.snapshot();
  for (const bulk of [{ captureSha: [own.sha, more.sha] }, { captures: [own.sha, more.sha] }, { rows: [{ name: "Pat" }] },
                      { captureSha: `${own.sha} ${more.sha}` }])
    assert.equal(codeOf(w.s.markKeyedResult({ service: "PeopleFinder", by: "bob", ...bulk })), "NO_SUCH_CAPTURE", JSON.stringify(Object.keys(bulk)));
  /* never unattended: a machine credential, a daemon, a scheduled consumer (each stamp the plane mints for one) */
  for (const by of [MACHINE, "token:daemon", "class:daemon", "token:scheduler", "class:scheduler", "daemon", "sweep", "system", "accelerator"])
    assert.equal(codeOf(w.s.markKeyedResult({ captureSha: own.sha, service: "PeopleFinder", by })), "MACHINE_CANNOT_MARK", by);
  /* a capture a daemon made is never a member-keyed result, whoever marks it */
  const daemons = w.captured({ actor: null, actorClass: "daemon" });
  for (const by of ["bob", "carol", "alice"])
    assert.equal(codeOf(w.s.markKeyedResult({ captureSha: daemons.sha, service: "PeopleFinder", by })), "NOT_YOUR_CAPTURE", by);
  assert.deepEqual(w.snapshot(), before, "nothing was written by any of them");
  /* nothing records what was searched: a query, search terms and results not captured, sent with the mark, are held nowhere */
  const m = w.s.markKeyedResult({ captureSha: own.sha, service: "PeopleFinder", terms: "personal use", by: "bob",
                                  query: SEARCH, search: SEARCH, searchTerms: [SEARCH], results: [{ name: SEARCH }], q: SEARCH });
  assert.equal(m.ok, true);
  assert.ok(!JSON.stringify(m).includes(SEARCH), "the answer carries no query");
  assert.deepEqual(w.rows(`PRAGMA table_info(source_keyed_marks)`).map((c) => c.name), ["seq", "capture_sha", "service", "terms", "by", "at"],
                   "the mark has no column for a query, a search term or a result");
  const everything = JSON.stringify(w.st.rows(`SELECT name FROM sqlite_master WHERE type='table'`)
    .map(({ name }) => w.st.rows(`SELECT * FROM ${name}`)));
  assert.ok(!everything.includes(SEARCH), "no table of the store holds what was searched");
  assert.ok(!JSON.stringify(w.s.keyedResultOf(own.sha)).includes(SEARCH));
  /* the negative control: the same member's own capture, marked by their own stamp */
  assert.equal(w.s.markKeyedResult({ captureSha: more.sha, service: "PeopleFinder", by: V("bob") }).ok, true);
});

/* case-import: flags and their clearing (R8), the services for later modules (R9), the registration it fills with
   `accepted-work` (R16) and its rows (R14), at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { rowOk, refusedThenAccepted, seeded, world, imp, caseFile, V, MACHINE, SOURCE, CASE, F1, F2, F3 } from "./fixture.mjs";
import { CASE_IMPORT_CHECKS, caseImportOf, caseImportOps, withRow } from "../../../src/case-import/index.mjs";
import { importedFindingRef } from "../../../src/inquiry-grammar/index.mjs";
import { acceptedWorkOf } from "../../../src/accepted-work/index.mjs";

const flag = (w, a, x = {}, who = "bob") => w.ci.flagImported({ import: a.import, edition: 1, issue: "the payroll figure is a year off",
  by: V(who), viewer: V(who), ...x });
const clear = (w, id, x = {}, who = "bob") => w.ci.clearFlag({ flag: id, reason: "checked against the budget: it is right",
  by: V(who), viewer: V(who), ...x });

/* ================================================================ R8 */

test("R8 a flag is a member's: R1's first two refusals, each writing nothing", async () => {
  const w = seeded();
  const a = (await imp(w));
  for (const who of [MACHINE, "class:daemon", "token:operator", ""])
    (await refusedThenAccepted(w, async () => flag(w, a, { by: who }), async () => flag(w, a), "MACHINE_CANNOT_IMPORT"));
  (await refusedThenAccepted(w, async () => flag(w, a, {}, "carol"), async () => flag(w, a), "IMPORT_NOT_A_MEMBER"));
  const f = flag(w, a);
  (await refusedThenAccepted(w, async () => clear(w, f.flag, { by: MACHINE }), async () => flag(w, a), "MACHINE_CANNOT_IMPORT"));
  (await refusedThenAccepted(w, async () => clear(w, f.flag, {}, "dave"), async () => clear(w, f.flag), "IMPORT_NOT_A_MEMBER"));
});

test("R8 an issue or reason absent, blank or over 2,000 characters is IMPORT_FLAG_NO_ISSUE", async () => {
  const w = seeded();
  const a = (await imp(w));
  for (const issue of [null, "", "   ", "i".repeat(2001)])
    (await refusedThenAccepted(w, async () => flag(w, a, { issue }), async () => flag(w, a, { issue: "i".repeat(2000) }), "IMPORT_FLAG_NO_ISSUE"));
  const f = flag(w, a);
  for (const reason of [null, "", "\n", "r".repeat(2001)])
    (await refusedThenAccepted(w, async () => clear(w, f.flag, { reason }), async () => flag(w, a), "IMPORT_FLAG_NO_ISSUE"));
  assert.equal(clear(w, f.flag, { reason: "r".repeat(2000) }).ok, true);
  /* the issue is asked before the edition */
  (await rowOk(flag(w, a, { issue: "", edition: 9 }), "IMPORT_FLAG_NO_ISSUE"));
});

test("R8 an edition or finding not held is IMPORT_NO_SUCH_EDITION or IMPORT_NO_SUCH_FINDING; clearing a flag not open is IMPORT_FLAG_NOT_OPEN", async () => {
  const w = seeded();
  const a = (await imp(w));
  for (const x of [{ edition: 2 }, { edition: "x" }, { import: "e".repeat(64) }])
    (await refusedThenAccepted(w, async () => flag(w, a, x), async () => flag(w, a), "IMPORT_NO_SUCH_EDITION"));
  for (const finding of ["INQ-2026-0999-none", 42, "   x"])
    (await refusedThenAccepted(w, async () => flag(w, a, { finding }), async () => flag(w, a, { finding: F2 }), "IMPORT_NO_SUCH_FINDING"));
  const f = flag(w, a);
  for (const id of ["IMF-999", "nonsense", null, "IMA-1"])
    (await refusedThenAccepted(w, async () => clear(w, id), async () => flag(w, a), "IMPORT_FLAG_NOT_OPEN"));
  assert.equal(clear(w, f.flag).ok, true);
  (await refusedThenAccepted(w, async () => clear(w, f.flag), async () => flag(w, a), "IMPORT_FLAG_NOT_OPEN"));
});

test("R8 a flag records by, the instant and the issue; a clear records by, the instant and the reason; the flag stays in the history", async () => {
  const w = seeded();
  const a = (await imp(w));
  w.clock.now = Date.parse("2026-10-10T10:10:10Z");
  const f = flag(w, a, { finding: F1 });
  assert.deepEqual(f, { ok: true, flag: f.flag, import: a.import, edition: 1, finding: F1, issue: "the payroll figure is a year off",
                        by: "bob", at: "2026-10-10T10:10:10Z" });
  const e = flag(w, a, {}, "alice");
  assert.equal(e.finding, null, "an edition's own flag");
  const flagRow = JSON.stringify(w.rows(`SELECT * FROM case_import_flags`));
  w.clock.now = Date.parse("2026-10-11T11:11:11Z");
  const c = clear(w, f.flag, {}, "alice");
  assert.deepEqual(c.cleared, { reason: "checked against the budget: it is right", by: "alice", at: "2026-10-11T11:11:11Z" });
  assert.equal(JSON.stringify(w.rows(`SELECT * FROM case_import_flags`)), flagRow, "the flag stays");
  assert.deepEqual(w.ci.openFlagsOn({ import: a.import, edition: 1 }).flags.map((x) => x.flag), [e.flag]);
});

test("R8 flags are seen only by those who may see the import, and never on a public path", async () => {
  const w = seeded();
  const a = (await imp(w));
  flag(w, a, { finding: F1 });
  const member = w.ci.importedCase({ import: a.import, viewer: V("alice") });
  assert.equal(member.edition.flags.length, 1);
  const none = JSON.stringify(seeded().ci.importedCase({ import: a.import, viewer: V("alice") }));
  for (const v of [V("carol"), V("dave"), "class:ai"])
    assert.equal(JSON.stringify(w.ci.importedCase({ import: a.import, viewer: v })), none, "absent, the flags with it");
  assert.equal(w.ci.openFlagsFacts({ ref: importedFindingRef(a.import, F1), edition: 1, viewer: V("carol") }), null);
  /* no public path: every op this module answers asks for a member, so a call with no stamped member sees no flag */
  const ops = caseImportOps(w.ci, new URL(`https://x/?import=${a.import}&edition=1`), {});
  for (const [op, fn] of Object.entries(ops)) {
    const r = await fn();
    assert.doesNotMatch(JSON.stringify(r), /the payroll figure is a year off/, op);
    assert.ok(op === "importedcases" ? r.count === 0 : r.ok === false, op);
  }
});

/* ================================================================ R9 */

test("R9 acceptanceOf answers the acceptance in force for a finding of an edition, or null; openFlagsOn the open flags with their issues", async () => {
  const w = seeded();
  const a = (await imp(w));
  assert.equal(w.ci.acceptanceOf({ import: a.import, edition: 1, finding: F1 }), null);
  assert.deepEqual(w.ci.openFlagsOn({ import: a.import, edition: 1 }), { flags: [], complete: true });
  w.clock.now = Date.parse("2026-10-12T00:00:00Z");
  const acc = w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1, F3], checked: "the passages", reason: "sound",
                                    by: V("alice"), viewer: V("alice") });
  const f = flag(w, a, { finding: F3 });
  assert.deepEqual(w.ci.acceptanceOf({ import: a.import, edition: 1, finding: F3 }),
                   { acceptance: acc.acceptance, by: "alice", at: "2026-10-12T00:00:00Z", reason: "sound", checked: "the passages", gaps: [] });
  assert.deepEqual(w.ci.openFlagsOn({ import: a.import, edition: 1 }),
                   { flags: [{ flag: f.flag, finding: F3, issue: "the payroll figure is a year off", by: "bob", at: "2026-10-12T00:00:00Z" }],
                     complete: true });
  /* not held: null and no flags; nothing written by any read */
  const before = w.snapshot();
  assert.equal(w.ci.acceptanceOf({ import: a.import, edition: 2, finding: F1 }), null);
  assert.equal(w.ci.acceptanceOf({ import: a.import, edition: 1, finding: "INQ-2026-0999-none" }), null);
  assert.equal(w.ci.acceptanceOf({}), null);
  assert.deepEqual(w.ci.openFlagsOn({ import: "e".repeat(64), edition: 1 }), { flags: [], complete: true });
  assert.deepEqual(w.snapshot(), before);
});

/* ================================================================ R16 */

test("R16 at start the module registers with accepted-work, once; a second start registers nothing again", async () => {
  const w = seeded();
  assert.deepEqual(w.ci.registration, { ok: true, module: "case-import" });
  assert.equal(w.ci.start(), w.ci.registration);
  /* accepted-work holds one registration, so another refuses as declared */
  const again = w.acceptedWork.registerAcceptedWork("case-import", { finding() {}, openFlags() {}, withdrawals() {} });
  assert.equal(again.reason, "LISTENER_DECLARED");
});

test("R16 `finding` answers R4's facts for one finding at one edition with R9's acceptance, through accepted-work's read, synchronously", async () => {
  const w = seeded();
  w.script.set(F1, { role: "load_bearing", result: "recreated", pair: { capture: "C", connection: "C" } });
  const file = caseFile({ pairs: { [F1]: { capture: "B", connection: "C" } } });
  const a = (await imp(w, file));
  const ref = importedFindingRef(a.import, F1);
  const read = (edition = 1, viewer = V("bob")) => w.acceptedWork.acceptedFinding({ ref, edition, viewer });
  const got = read();
  assert.ok(!(got instanceof Promise));
  assert.deepEqual(got, { ref, import: a.import, group: SOURCE, case: CASE, edition: 1, finding: F1, manifest_sha: file.manifestSha,
                          result: "recreated", pair: { capture: { state: "graded", grade: "B" }, connection: { state: "graded", grade: "C" } },
                          ungraded_passages: null, acceptance: null });
  /* the pair is the one the edition publishes, not the recomputed one */
  assert.equal(got.pair.capture.grade, "B");
  w.clock.now = Date.parse("2026-10-13T00:00:00Z");
  w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1], checked: "c", reason: "r", by: V("alice"), viewer: V("alice") });
  assert.deepEqual(read().acceptance, { by: "alice", at: "2026-10-13T00:00:00Z", reason: "r", checked: "c", gaps: [] });
  /* null: not held at that edition, an unknown ref, a non-member viewer; a viewer never sent is the plane reading */
  assert.equal(read(2), null);
  assert.equal(read("1"), null);
  assert.equal(w.acceptedWork.acceptedFinding({ ref: importedFindingRef(a.import, "INQ-2026-0999-none"), edition: 1, viewer: V("bob") }), null);
  for (const v of [V("carol"), V("dave"), "class:ai"]) assert.equal(read(1, v), null);
  assert.equal(read(1, null).finding, F1);
  /* accepted-work's leg check reads it: a leg on the accepted edition passes, on another edition refuses */
  assert.deepEqual(w.acceptedWork.acceptedLegRefusals({ legs: [{ ord: 0, target: ref, target_edition: 1 }], viewer: V("bob") }), []);
  assert.equal(w.acceptedWork.acceptedLegRefusals({ legs: [{ ord: 0, target: ref, target_edition: 2 }], viewer: V("bob") })[0].code,
               "IMPORTED_NOT_ACCEPTED");
});

test("R16 `openFlags` answers the edition's own open flags and the named finding's, complete; null for a non-member", async () => {
  const w = seeded();
  const a = (await imp(w));
  const e = flag(w, a);
  const f1 = flag(w, a, { finding: F1 });
  flag(w, a, { finding: F2 });
  const done = flag(w, a, { finding: F1 });
  clear(w, done.flag);
  const got = w.acceptedWork.openFlagsOn({ ref: importedFindingRef(a.import, F1), edition: 1, viewer: V("alice") });
  assert.equal(got.complete, true);
  assert.deepEqual(got.flags.map((x) => x.flag), [e.flag, f1.flag]);
  assert.deepEqual(Object.keys(got.flags[1]).sort(), ["at", "finding", "flag", "issue"]);
  assert.equal(w.acceptedWork.openFlagsOn({ ref: importedFindingRef(a.import, F1), edition: 1, viewer: V("carol") }), null);
});

test("R16 `withdrawals` answers R7's records in withdrawal order, paged by cursor", async () => {
  const w = seeded();
  const a = (await imp(w));
  const ids = [];
  for (let i = 0; i < 5; i++) {
    w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1], checked: "c", reason: "r", by: V("alice"), viewer: V("alice") });
    ids.push(w.ci.withdrawAcceptance({ import: a.import, edition: 1, reason: `w${i}`, by: V("alice"), viewer: V("alice") }).withdrawal);
  }
  const page = (after, limit) => w.acceptedWork.acceptanceWithdrawals({ after, limit });
  const p1 = page(null, 2);
  assert.deepEqual(p1.withdrawals.map((x) => x.withdrawal), ids.slice(0, 2));
  assert.equal(p1.cursor, ids[1]);
  assert.deepEqual(p1.withdrawals[0], { withdrawal: ids[0], import: a.import, edition: 1, refs: [importedFindingRef(a.import, F1)],
                                        at: p1.withdrawals[0].at });
  const p2 = page(p1.cursor, 2), p3 = page(p2.cursor, 2);
  assert.deepEqual([...p2.withdrawals, ...p3.withdrawals].map((x) => x.withdrawal), ids.slice(2));
  assert.equal(p3.cursor, null);
  assert.equal(page(null, null).withdrawals.length, 5);
  assert.equal(page(null, 5).cursor, null);
});

test("R16 (T48) the reads that take a viewer answer null to one who is not an active member; withdrawals and moves take only {after, limit}, name no viewer and are answered as the plane", async () => {
  const w = seeded();
  const a = (await imp(w));
  const ref = importedFindingRef(a.import, F1);
  flag(w, a, { finding: F1 });
  w.ci.acceptImported({ import: a.import, edition: 1, findings: [F1], checked: "c", reason: "r", by: V("alice"), viewer: V("alice") });
  w.ci.withdrawAcceptance({ import: a.import, edition: 1, reason: "w", by: V("alice"), viewer: V("alice") });
  const since = "2026-09-01T00:00:00Z";
  const reads = (viewer) => ({
    finding: w.acceptedWork.acceptedFinding({ ref, edition: 1, viewer }),
    openFlags: w.acceptedWork.openFlagsOn({ ref, edition: 1, viewer }),
    flagHistory: w.acceptedWork.flagHistoryOn({ ref, edition: 1, since, viewer }),
  });
  /* controls: an active member is answered each of the three */
  const member = reads(V("bob"));
  assert.equal(member.finding.finding, F1);
  assert.equal(member.openFlags.flags.length, 1);
  assert.equal(member.flagHistory.flags.length, 1);
  /* a viewer who is not an active member (a non-member, a machine, an empty identity) is answered null by each */
  for (const v of [V("carol"), V("dave"), "class:ai", ""])
    assert.deepEqual(reads(v), { finding: null, openFlags: null, flagHistory: null }, JSON.stringify(v));
  /* the other two take no viewer: a viewer handed on is never read, and the answer is the plane's, the same for each */
  const plane = { withdrawals: w.acceptedWork.acceptanceWithdrawals({ after: null, limit: null }),
                  moves: w.acceptedWork.publisherMoves({ after: null, limit: null }) };
  assert.equal(plane.withdrawals.withdrawals.length, 1);
  assert.deepEqual(plane.moves, { moves: [], cursor: null });
  for (const viewer of [V("carol"), V("bob"), "class:ai", null]) {
    assert.deepEqual(w.acceptedWork.acceptanceWithdrawals({ after: null, limit: null, viewer }), plane.withdrawals);
    assert.deepEqual(w.acceptedWork.publisherMoves({ after: null, limit: null, viewer }), plane.moves);
    assert.deepEqual(w.ci.withdrawals({ after: null, limit: null, viewer }), plane.withdrawals);
    assert.deepEqual(w.ci.moves({ after: null, limit: null, viewer }), plane.moves);
  }
});

test("R16 before the module starts, accepted-work answers absent; once it starts, every read answers", async () => {
  const w = world();
  const ref = importedFindingRef("a".repeat(64), F1);
  /* a fresh accepted-work, as the plane makes it before case-import's factory runs */
  const aw = acceptedWorkOf({ storage: w.st, env: {} }, { record: w.record });
  assert.equal(aw.acceptedFinding({ ref, edition: 1 }).absent, true);
  const ci = caseImportOf({ storage: w.st, env: {} }, { record: w.record, membership: w.membership, strength: w.strength,
                                                         acceptedWork: aw, reevaluation: w.reeval, checkCaseFile: async () => ({}) });
  assert.equal(ci.registration.ok, true);
  assert.equal(aw.acceptedFinding({ ref, edition: 1 }), null, "answered: not held");
  assert.deepEqual(aw.openFlagsOn({ ref, edition: 1 }), { flags: [], complete: true });
  assert.deepEqual(aw.acceptanceWithdrawals({}), { withdrawals: [], cursor: null });
});

/* ================================================================ R14 */

test("R14 each refusal carries its row in this module's own table, a new family, with a check, a site and a translation", async () => {
  const rows = Object.entries(CASE_IMPORT_CHECKS);
  assert.equal(rows.length, 22, "the sixteen of T28–T34 and the six of T51's rerun");
  const ids = rows.map(([, r]) => r.check);
  assert.equal(new Set(ids).size, ids.length, "each number once");
  const fam = new Set(ids.map((c) => c.replace(/\.\d+$/, "")));
  assert.equal(fam.size, 1, "one family");
  const src = readFileSync(fileURLToPath(new URL("../../../src/case-import/index.mjs", import.meta.url)), "utf8");
  for (const [code, r] of rows) {
    assert.match(r.check, /^C-\d+\.\d+$/);
    assert.ok(typeof r.translation === "string" && /Nothing was \w+\.$/.test(r.translation), code);
    const [, fn, region] = /^src\/case-import\/index\.mjs (\S+) > (\S+)$/.exec(r.where);
    /* each opening of the region lies inside the method the row names, and the code is minted inside a region of it */
    const opens = [...src.matchAll(new RegExp(`(?<!END )DEC-49 REGION ${region}\\b`, "g"))].map((m) => m.index);
    assert.ok(opens.length, `${code}: its region is marked`);
    const methodAt = (at) => [...src.slice(0, at).matchAll(/\n  (?:static )?(?:async )?(#?[A-Za-z]\w*)\([^)]*\)?[^\n]*\{\n/g)].at(-1)[1];
    assert.ok(opens.some((at) => methodAt(at) === fn), `${code}: ${region} sits in ${fn}`);
    const inside = opens.some((at) => {
      const end = src.indexOf(`END DEC-49 REGION ${region}`, at);
      return end > at && src.slice(at, end).includes(`"${code}"`);
    });
    assert.ok(inside, `${code}: minted inside its region`);
  }
  /* each refusal the acts answer carries its row: withRow fills it, and leaves another module's refusal as it came */
  assert.deepEqual(withRow({ ok: false, reason: "IMPORT_FLAG_NOT_OPEN" }).check, CASE_IMPORT_CHECKS.IMPORT_FLAG_NOT_OPEN.check);
  assert.deepEqual(withRow({ ok: false, reason: "SOMEONE_ELSES" }), { ok: false, reason: "SOMEONE_ELSES" });
});

/* ================================================================ R24 (T47; N947): the flags' history, through accepted-work R9 */

/* a world with alice's import, its flags opened and cleared at set instants: `[finding|null, open, clear|null]` */
async function history(specs) {
  const w = seeded();
  const a = await imp(w);
  const ids = [];
  for (const [finding, open, cleared] of specs) {
    w.clock.now = Date.parse(open);
    const f = flag(w, a, finding ? { finding } : {});
    ids.push(f.flag);
    if (cleared) { w.clock.now = Date.parse(cleared); clear(w, f.flag); }
  }
  const read = (since, x = {}) => w.acceptedWork.flagHistoryOn({ ref: importedFindingRef(a.import, F1), edition: 1, since,
                                                                   viewer: V("alice"), ...x });
  return { w, a, ids, read };
}

test("R24 the registration carries flagHistory: every flag open at any instant from since through the read, the edition's own and the named finding's, in the order flagged, each with its opening and clearing instants", async () => {
  const { w, ids, read } = await history([
    [F1, "2026-10-01T09:00:00Z", "2026-10-02T09:00:00Z"],    /* cleared before since: not answered */
    [null, "2026-10-03T09:00:00Z", null],                    /* the edition's own, open: cleared_at null */
    [F1, "2026-10-06T09:00:00Z", "2026-10-07T09:00:00Z"],    /* flagged and cleared after since: both instants */
    [F2, "2026-10-06T10:00:00Z", null],                      /* another finding's: not answered */
    [F1, "2026-10-04T09:00:00Z", "2026-10-08T09:00:00Z"],    /* open at since, cleared since */
    [F1, "2026-10-09T09:00:00Z", null],                      /* opened after since, open */
  ]);
  const since = "2026-10-05T00:00:00Z";
  const before = w.snapshot();
  const got = read(since);
  assert.ok(!(got instanceof Promise), "read as the plane, synchronously");
  assert.deepEqual(got, { complete: true, flags: [
    { flag: ids[1], finding: null, issue: "the payroll figure is a year off", opened_at: "2026-10-03T09:00:00Z", cleared_at: null },
    { flag: ids[2], finding: F1, issue: "the payroll figure is a year off", opened_at: "2026-10-06T09:00:00Z", cleared_at: "2026-10-07T09:00:00Z" },
    { flag: ids[4], finding: F1, issue: "the payroll figure is a year off", opened_at: "2026-10-04T09:00:00Z", cleared_at: "2026-10-08T09:00:00Z" },
    { flag: ids[5], finding: F1, issue: "the payroll figure is a year off", opened_at: "2026-10-09T09:00:00Z", cleared_at: null },
  ] });
  /* a since before every flag answers each of them; R16's openFlags still answers only the open ones */
  assert.deepEqual(read("2026-09-01T00:00:00Z").flags.map((f) => f.flag), [ids[0], ids[1], ids[2], ids[4], ids[5]]);
  assert.deepEqual(w.acceptedWork.openFlagsOn({ ref: importedFindingRef(w.ci.importedCases({ viewer: V("alice") }).imports[0].import, F1),
                                               edition: 1, viewer: V("alice") }).flags.map((f) => f.flag), [ids[1], ids[5]]);
  /* a since after every clear answers only the flags open now */
  assert.deepEqual(read("2026-10-12T00:00:00Z").flags.map((f) => f.flag), [ids[1], ids[5]]);
  assert.deepEqual(w.snapshot(), before, "it writes nothing");
});

test("R24 the controls: a flag flagged and cleared after since is answered with both instants; one cleared before since is not; one open is answered with cleared_at null", async () => {
  const { ids, read } = await history([
    [F1, "2026-10-10T10:00:00Z", "2026-10-10T11:00:00Z"],
    [F1, "2026-10-10T12:00:00Z", null],
  ]);
  assert.deepEqual(read("2026-10-10T09:59:59Z").flags.map((f) => [f.flag, f.opened_at, f.cleared_at]),
                   [[ids[0], "2026-10-10T10:00:00Z", "2026-10-10T11:00:00Z"], [ids[1], "2026-10-10T12:00:00Z", null]]);
  assert.deepEqual(read("2026-10-10T11:00:01Z").flags.map((f) => f.flag), [ids[1]], "cleared before since: not answered");
  /* a clear at since, or in the second since falls in (a clear is stamped to the second), was not before it: answered */
  assert.deepEqual(read("2026-10-10T11:00:00Z").flags.map((f) => f.flag), ids);
  assert.deepEqual(read("2026-10-10T11:00:00.999Z").flags.map((f) => f.flag), ids);
  assert.deepEqual(read("2026-10-10T11:00:01.000Z").flags.map((f) => f.flag), [ids[1]]);
});

test("R24 a since that is not an instant record-core stamps answers complete: false and no flags; a non-member is answered null; it never throws", async () => {
  const { w, a, read } = await history([[F1, "2026-10-10T10:00:00Z", null]]);
  for (const since of [null, undefined, "", "yesterday", "2026-10-10", "2026-10-10T10:00:00", "2026-10-10T10:00:00+00:00",
                       "2026-10-10T10:00:00.5Z", "2026-10-10 10:00:00Z", " 2026-10-10T10:00:00Z", "2026-13-10T10:00:00Z", 1791900000000, {}])
    assert.deepEqual(read(since), { flags: [], complete: false }, JSON.stringify(since));
  /* the controls: either of record-core's spellings (its R47) */
  for (const since of ["2026-10-01T00:00:00Z", "2026-10-01T00:00:00.000Z", "2026-10-01T00:00:00.250Z"])
    assert.equal(read(since).flags.length, 1, since);
  /* a viewer who is not an active member is answered null; a viewer never sent is the plane reading */
  for (const v of [V("carol"), V("dave"), "class:ai"]) assert.equal(read("2026-10-01T00:00:00Z", { viewer: v }), null);
  assert.equal(read("2026-10-01T00:00:00Z", { viewer: null }).flags.length, 1);
  /* not held: no flags, complete */
  assert.deepEqual(read("2026-10-01T00:00:00Z", { edition: 2 }), { flags: [], complete: true });
  assert.deepEqual(read("2026-10-01T00:00:00Z", { ref: "nonsense" }), { flags: [], complete: true });
  assert.deepEqual(w.ci.flagHistoryFacts({ ref: importedFindingRef(a.import, F1), edition: "1", since: "2026-10-01T00:00:00Z" }),
                   { flags: [], complete: true });
  /* never throws, whatever it is given */
  for (const q of [undefined, null, 7, { ref: {}, edition: {}, since: [] }]) assert.doesNotThrow(() => w.ci.flagHistoryFacts(q ?? undefined));
  assert.equal(w.acceptedWork.flagHistoryOn({}).absent, undefined, "registered: never absent");
});

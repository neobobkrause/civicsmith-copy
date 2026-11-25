/* T18's share: the leg count and the superseded-by index held in this module's own table (R36, N136), read by
   `legs:` through retrieval's registration (its R62); the migrated arm of `surfaced_in` this module registers with
   retrieval's single-bundle answer (N405, its R56); and the entry grammar judged with the grammars registered with
   record-core, as promotion's gate judges it (R2, R17). Driven through the real promotion, retrieval and record-core. */
import test from "node:test";
import { word } from "../../../src/setup-words/index.mjs";
import assert from "node:assert/strict";
import { world, inquiryMd, V, LEGACY_BUNDLE_COLUMNS } from "./fixture.mjs";
import { INQUIRY_GRAMMARS } from "../../../src/inquiry-grammar/index.mjs";
import { BUNDLE_FACTS, LEGS_RELATION, INQUIRY_TABLES, SUBJECT_COLUMN, moveBundleFacts, moveSubjectEntity, checkInquiryEntry }
  from "../../../src/inquiry/index.mjs";

const A = "INFO-2026-0001-a", B = "INFO-2026-0002-b";
const Q = "INQ-2026-0001-q", R = "INQ-2026-0002-r", E = "INQ-2026-0003-e", P = "INQ-2026-0004-p";
const C1 = "INQ-2026-0005-a", C2 = "INQ-2026-0006-b";
const facts = (w, id) => w.row(`SELECT inquiry_basis_count AS n, inquiry_superseded_by AS by FROM ${BUNDLE_FACTS} WHERE bundle_id=?`, id);

test("R36 R12 the leg count and the superseded-by index are held in this module's own table, one row per bundle, declared to purge; never on bundles", () => {
  const w = world(); w.doc(A); w.doc(B);
  w.inquiry(Q, { legs: [{ target: A }, { target: B, role: "cuts_against" }] });
  w.inquiry(E);
  assert.deepEqual(facts(w, Q), { n: 2, by: null });
  assert.deepEqual(facts(w, E), { n: 0, by: null }, "an inquiry resting on nothing is counted, 0");
  assert.equal(facts(w, A), null, "a bundle that is not an inquiry has no row: its count is null, as the column's was");
  const cols = w.rows(`PRAGMA table_info(${BUNDLE_FACTS})`);
  assert.deepEqual(cols.filter((c) => c.pk).map((c) => c.name), ["bundle_id"], "keyed by bundle_id: at most one row per bundle");
  assert.ok(INQUIRY_TABLES.includes(BUNDLE_FACTS));
  const bcols = w.rows(`PRAGMA table_info(bundles)`).map((c) => c.name);
  for (const c of ["inquiry_basis_count", "inquiry_superseded_by"]) assert.ok(!bcols.includes(c), `${c} is not written on bundles`);
  /* a revision re-derives the count; a division writes the index on the parent, and the children count their own legs */
  assert.equal(w.promote(Q, inquiryMd(Q, { legs: [{ target: A }, { target: B, role: "cuts_against" }, { target: A, note: "again" }] })).ok, true);
  assert.equal(facts(w, Q).n, 3);
  const r = w.k.divide({ target: Q, reason: "two", viewer: "admin", author: V("alice"),
    children: [{ id: C1, question: "A?", legs: [0, 2] }, { id: C2, question: "B?", legs: [1] }] });
  assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
  assert.deepEqual(facts(w, Q), { n: 3, by: `${C1},${C2}` });
  assert.deepEqual(w.k.supersededBy(Q), [C1, C2]);
  assert.deepEqual([facts(w, C1).n, facts(w, C2).n], [2, 1]);
  assert.deepEqual(w.k.supersededBy(C1), [], "nothing supersedes a child");
  assert.deepEqual(w.rows(`SELECT bundle_id FROM ${BUNDLE_FACTS} ORDER BY bundle_id`).map((x) => x.bundle_id), [Q, E, C1, C2].sort(),
    "one row for each inquiry, none for a document");
  /* purge clears the bundle's row */
  w.record.purge({ bundleId: E });
  assert.equal(facts(w, E), null);
  assert.equal(w.k.writeSupersededBy("INQ-2026-0099-none").length, 0, "an id with no bundle writes nothing");
  assert.equal(facts(w, "INQ-2026-0099-none"), null);
});

test("R36 a store written before T18: its migration moves the leg count and the superseded-by index off bundles once, idempotently; later writes win", () => {
  const w = world({ legacyColumns: true }); w.doc(A); w.doc(B);
  w.inquiry(Q, { legs: [{ target: A }, { target: B }] });
  w.inquiry(P);
  /* as such a store holds them: the values on bundles, this module's table not yet written */
  w.st.sql.exec(`DELETE FROM ${BUNDLE_FACTS}`);
  w.st.sql.exec(`UPDATE bundles SET inquiry_basis_count=2 WHERE bundle_id=?`, Q);
  w.st.sql.exec(`UPDATE bundles SET inquiry_basis_count=0, inquiry_superseded_by=? WHERE bundle_id=?`, `${C1},${C2}`, P);
  w.k.migrate();
  assert.deepEqual([facts(w, Q), facts(w, P)], [{ n: 2, by: null }, { n: 0, by: `${C1},${C2}` }]);
  assert.equal(facts(w, A), null, "a bundle with neither value is not copied");
  assert.deepEqual(w.k.supersededBy(P), [C1, C2], "the index reads from this module's table");
  /* idempotent: a second boot changes nothing; a revision's count wins over the stale value left on bundles */
  w.k.migrate();
  assert.deepEqual([facts(w, Q), facts(w, P)], [{ n: 2, by: null }, { n: 0, by: `${C1},${C2}` }]);
  assert.equal(w.promote(Q, inquiryMd(Q, { legs: [{ target: A }] })).ok, true);
  w.k.migrate();
  assert.equal(facts(w, Q).n, 1);
  assert.equal(w.row(`SELECT inquiry_basis_count FROM bundles WHERE bundle_id=?`, Q).inquiry_basis_count, 2,
    "the column left on such a store is inert: nothing writes it");
  assert.equal(moveBundleFacts(w.st.sql), 0, "a table already written is never overwritten");
  /* a store whose bundles never had the columns copies nothing */
  const fresh = world(); fresh.inquiry(Q);
  assert.equal(moveBundleFacts(fresh.st.sql), 0);
  assert.deepEqual(LEGACY_BUNDLE_COLUMNS.map((c) => c.split(" ")[0]), ["inquiry_basis_count", "inquiry_superseded_by"]);
});

test("R36 R40 N136's rest: a store written before T19 has its subject entity moved off bundles once, on the boot that gives this module's table the column; a value a later revision cleared is never brought back", () => {
  const w = world(); w.doc(A); w.entity("ENT-2026-0001"); w.entity("ENT-2026-0002");
  w.inquiry(Q, { subject: "ENT-2026-0001", legs: [{ target: A }] });
  w.inquiry(R, { subject: "ENT-2026-0002" });
  w.inquiry(E);
  const subj = (id) => w.row(`SELECT ${SUBJECT_COLUMN} AS s FROM ${BUNDLE_FACTS} WHERE bundle_id=?`, id)?.s ?? null;
  assert.equal(SUBJECT_COLUMN, "inquiry_subject_entity", "the name it had on bundles");
  assert.deepEqual([subj(Q), subj(R), subj(E)], ["ENT-2026-0001", "ENT-2026-0002", null]);
  /* as a T18 store holds it: the subject on bundles, this module's table without the column */
  w.st.sql.exec(`ALTER TABLE ${BUNDLE_FACTS} DROP COLUMN ${SUBJECT_COLUMN}`);
  w.st.sql.exec(`UPDATE bundles SET ${SUBJECT_COLUMN}=? WHERE bundle_id=?`, "ENT-2026-0001", Q);
  w.st.sql.exec(`UPDATE bundles SET ${SUBJECT_COLUMN}=? WHERE bundle_id=?`, "ENT-2026-0002", R);
  w.st.sql.exec(`DELETE FROM ${BUNDLE_FACTS} WHERE bundle_id=?`, R);
  w.k.migrate();
  assert.deepEqual([subj(Q), subj(R), subj(E)], ["ENT-2026-0001", "ENT-2026-0002", null],
    "copied onto the row a bundle holds and onto a new one; a bundle with no value copies nothing");
  assert.deepEqual(facts(w, Q), { n: 1, by: null }, "a row's other facts are kept");
  assert.equal(w.k.subjectEntityOf(R), "ENT-2026-0002", "R43 reads the moved value");
  /* once: a revision that clears the subject is not undone by the inert copy left on bundles at the next boot */
  assert.equal(w.promote(Q, inquiryMd(Q, { legs: [{ target: A }] })).ok, true);
  w.k.migrate();
  assert.equal(subj(Q), null);
  assert.equal(w.row(`SELECT ${SUBJECT_COLUMN} AS s FROM bundles WHERE bundle_id=?`, Q).s, "ENT-2026-0001",
    "the column left on bundles is inert: nothing writes it");
  /* called again by hand it copies the same values onto the same rows; a store whose bundles never had the column copies nothing */
  assert.equal(moveSubjectEntity(w.st.sql), 2);
  const bare = world(); bare.st.sql.exec(`ALTER TABLE bundles DROP COLUMN ${SUBJECT_COLUMN}`);
  assert.equal(moveSubjectEntity(bare.st.sql), 0);
});

test("R36 the leg count is registered with retrieval as the `legs` field's column (its R62), so `legs:` answers from this module's table", () => {
  const w = world({ realRetrieval: true }); w.doc(A); w.doc(B);
  w.inquiry(Q, { legs: [{ target: A }, { target: B }] });
  w.inquiry(R, { legs: [{ target: A }] });
  w.inquiry(E);
  assert.deepEqual(LEGS_RELATION, { table: BUNDLE_FACTS, key: "bundle_id", col: "inquiry_basis_count" });
  const ids = (q, extra = {}) => w.retrieval.search({ q, viewer: "admin", mode: "ids", facets: false, ...extra }).ids;
  assert.deepEqual(ids("legs:>1"), [Q]);
  assert.deepEqual(ids("legs:1"), [R]);
  assert.deepEqual(ids("legs:0"), [E]);
  assert.deepEqual(ids("legs:0..2 sort:-legs"), [Q, R, E]);
  assert.deepEqual(ids("has:legs sort:legs:asc"), [E, R, Q], "a bundle with no row (a document) has no leg count");
  /* a revision moves the answer in the same promotion */
  assert.equal(w.promote(R, inquiryMd(R, { legs: [{ target: A }, { target: B }, { target: A, note: "n" }] })).ok, true);
  assert.deepEqual(ids("legs:>2"), [R]);
  /* the field is registered once: a second registration of it is refused, naming this module */
  const again = w.retrieval.registerField("someone", "legs", LEGS_RELATION);
  assert.deepEqual([again.ok, again.reason, again.declaredBy], [false, "FIELD_DECLARED", "inquiry"]);
});

test("R49 R12 N405 the migrated arm of surfaced_in: a migration replay's creation said in words, null for any other; registered on retrieval's single-bundle answer (its R56)", async () => {
  const w = world({ realRetrieval: true }); w.doc(A);
  const M = "INQ-2026-0007-m";
  assert.equal(w.promote(M, inquiryMd(M), null, { migrationReplay: { capture: "c".repeat(64), promotion: "P-1" } }).ok, true);
  w.inquiry(Q);
  const m = w.k.migratedSurfacing(M);
  assert.deepEqual({ ...m, migrated: { ...m.migrated, at: typeof m.migrated.at } },
    { recorded: false, stated: word("inquiry.stated.recorded_migrated_drive"), run: null, lens: null,
      migrated: { capture: "c".repeat(64), promotion: "P-1", at: "string" } });
  assert.equal(w.k.migratedSurfacing(Q), null, "a question created on this plane is not a migration");
  for (const x of [null, "", 7, {}, A, "INQ-2026-0099-x"]) assert.equal(w.k.migratedSurfacing(x), null, String(x));
  /* on the single-bundle answer, through retrieval's own read */
  const pm = await w.retrieval.projection({ bundleId: M, viewer: "admin" });
  assert.deepEqual(pm.surfaced_in, m);
  const pq = await w.retrieval.projection({ bundleId: Q, viewer: "admin" });
  assert.equal(Object.hasOwn(pq, "surfaced_in"), false, "this arm adds nothing for a question that is not a migration");
  const pa = await w.retrieval.projection({ bundleId: A, viewer: "admin" });
  assert.equal(Object.hasOwn(pa, "surfaced_in"), false, "nor for a document");
  assert.equal(await w.retrieval.projection({ bundleId: M, viewer: null }), null, "the answer it decorates stays gated");
  /* one registration per module */
  assert.equal(w.retrieval.registerProjectionDecoration("inquiry", () => ({})).reason, "DECORATION_DECLARED");
  /* never throws, even over a store that cannot answer */
  const real = w.st.sql.exec;
  w.st.sql.exec = () => { throw new Error("gone"); };
  assert.equal(w.k.migratedSurfacing(M), null);
  w.st.sql.exec = real;
});

test("R11 the entry grammar judged with the grammars registered with record-core, as promotion's gate judges it; one that throws is an error naming its module", async () => {
  const w = world();
  const good = inquiryMd("INQ-2026-0009-z");
  const bad = good.replace("surfaced_by: human", "surfaced_by: robot");
  /* with nothing registered, inquiry-grammar's own arms (C-2.8, C-6.1, C-15.1) */
  assert.deepEqual(await w.k.checkEntry(good), await checkInquiryEntry(good));
  assert.ok((await w.k.checkEntry(bad)).some((x) => x.check === "C-2.8" && /surfaced_by/.test(x.message)));
  /* a grammar claiming C-2.8 runs in inquiry-grammar's arm's place, over the same document */
  const seen = [];
  assert.equal(w.record.registerGrammar("inquiry-arm-under-test", { ids: ["C-2.8"], arm: (ctx, found) => {
    seen.push(ctx.folderName); found.push({ check: "C-2.8", severity: "error", message: "judged by the registered grammar" });
  } }).ok, true);
  const f = await w.k.checkEntry(bad);
  assert.deepEqual(seen, ["INQ-2026-0009-z"]);
  assert.ok(f.some((x) => x.message === "judged by the registered grammar"));
  assert.ok(!f.some((x) => /surfaced_by/.test(x.message)), "inquiry-grammar's C-2.8 arm is not also run");
  assert.ok(f.some((x) => x.check === "C-15.1"), "the slots no registration claims are still filled by inquiry-grammar's arms");
  assert.ok((await checkInquiryEntry(bad)).some((x) => /surfaced_by/.test(x.message)),
    "the module-level face with no grammars named runs inquiry-grammar's own");
  assert.deepEqual(await checkInquiryEntry(bad, { grammars: [...w.record.grammars(), ...INQUIRY_GRAMMARS.filter((g) => !g.ids.includes("C-2.8"))] }),
    f, "the face passes the grammars it is given");
  /* a grammar that throws is one error of its own, naming its module; the document is not passed */
  const w2 = world();
  assert.equal(w2.record.registerGrammar("thrower", { ids: ["C-2.99"], arm: () => { throw new Error("boom"); } }).ok, true);
  const t = await w2.k.checkEntry(good);
  assert.ok(t.some((x) => x.check === "thrower" && /threw/.test(x.message) && /boom/.test(x.message)), JSON.stringify(t));
  /* a record that cannot answer its registrations: an error, never read as none */
  const real = w2.record.grammars;
  w2.record.grammars = () => { throw new Error("unreadable"); };
  const u = await w2.k.checkEntry(good);
  w2.record.grammars = real;
  assert.deepEqual(u.map((x) => x.check), ["C-2.8"]); assert.match(u[0].message, /could not be read/);
  /* a malformed list handed to the face is judged as nothing passed */
  const m = await checkInquiryEntry(good, { grammars: "not a list" });
  assert.deepEqual(m.map((x) => x.check), ["C-2.8"]); assert.ok(m[0].message.startsWith(word("inquiry.message.entry_requirements_judged", { message: "" }).trim().replace(/:$/, "")));
});

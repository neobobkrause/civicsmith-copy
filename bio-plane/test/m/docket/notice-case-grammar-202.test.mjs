/* notice case-grammar:202 (T53; R1, R35-R39; DEC-461, DEC-464; N1259): `case-grammar`'s case document moves to
   `bio-case-document/10` (ungraded and typed passages, a cited register row as a labelled extract); `/9` and earlier stay
   accepted. docket reads one thing of a case document: its "What changed" statement, through `case-grammar.whatChangedOf`
   (its R8), for an `edition` entry (R6, R33) and the core still due (R9 (b)). Confirmed with no code change: a `/10`
   document, as case-grammar's own fixture writes it, is read exactly as a `/9` one, and the entry quotes what
   `whatChangedOf` answers for it. The documents are case-grammar's published fixture, made by its real line builders when
   the test runs (K4990). */
import { test } from "node:test";
import assert from "node:assert/strict";
import * as CG from "../../../src/case-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/frontmatter.mjs";
import { caseDocument } from "../case-grammar/casefile-fixture.mjs";
import { seeded, prepare, post, sign, V, CASE } from "./fixture.mjs";

const statementOf = (text) => { const p = parseFrontmatter(text); return CG.whatChangedOf(p.data, p.body).statement; };

test("notice case-grammar:202 (R35) a /10 case document, as case-grammar writes it, is read for its What changed exactly as a /9 one: coreDue (R9 (b)), the prepared edition entry (R6) and the automatic one (R33) quote whatChangedOf's statement", async () => {
  assert.equal(CG.CASE_DOCUMENT_FORMAT, "bio-case-document/10", "the format in force is /10");
  for (const format of [CG.CASE_DOCUMENT_FORMAT, CG.CASE_DOCUMENT_FORMAT_V9]) {
    const document = caseDocument({ format });
    assert.equal(parseFrontmatter(document).data.format, format);
    const said = statementOf(document);
    assert.ok(typeof said === "string" && said.length > 0, `${format}: case-grammar reads a statement`);
    /* R9 (b): the edition is due with its statement */
    const w = seeded();
    w.publish(w.P, CASE, 2, [{ id: w.F1, role: "load_bearing" }], { document });
    const due = w.docket.coreDue({ case: CASE, viewer: "member:alice" });
    const item = due.items.find((i) => i.kind === "edition");
    assert.deepEqual([item.edition, item.what_changed], [2, said], `${format}: coreDue quotes it`);
    /* R6: the manager's prepared entry quotes it */
    const p = prepare(w, { kind: "edition", edition: 2 });
    assert.equal(p.ok, true, JSON.stringify(p).slice(0, 300));
    assert.equal(JSON.parse(p.entry).what_changed, said, `${format}: the prepared entry quotes it`);
    await post(w, { kind: "edition", edition: 2 });
    assert.equal(w.docket.coreDue({ case: CASE, viewer: "member:alice" }).items.some((i) => i.kind === "edition"), false);
    /* R33: the automatic entry quotes it too */
    const v = seeded();
    v.publish(v.P, CASE, 2, [{ id: v.F1, role: "load_bearing" }], { document });
    const pr = await v.docket.docketRecordEdition({ case: CASE, edition: 2 });
    assert.equal(JSON.parse(pr.entry).what_changed, said, `${format}: the prepared automatic entry quotes it`);
    const r = await v.docket.docketRecordEdition({ case: CASE, edition: 2, digest: pr.digest, signature: sign(pr), by: V("alice") });
    assert.equal(r.filed, true, JSON.stringify(r).slice(0, 300));
    const pub = await v.docket.docketPublic({ case: CASE, captures: "omit" });
    assert.equal(pub.entries.find((e) => e.seq === r.seq).fields.what_changed, said, `${format}: the automatic entry quotes it`);
  }
});

test("notice case-grammar:202 control: a /10 document whose statement no longer matches its recorded sha reads no statement from case-grammar, and docket quotes none", () => {
  const document = caseDocument({ format: CG.CASE_DOCUMENT_FORMAT });
  const said = statementOf(document);
  const w = seeded();
  w.publish(w.P, CASE, 2, [{ id: w.F1, role: "load_bearing" }], { document });
  assert.equal(w.docket.coreDue({ case: CASE, viewer: "member:alice" }).items.find((i) => i.kind === "edition").what_changed, said);
  /* control: the body's statement changed after the block's sha was written: whatChangedOf answers none, and so does docket */
  const altered = document.replace(said, `${said} (altered)`);
  assert.equal(statementOf(altered), null);
  const v = seeded();
  v.publish(v.P, CASE, 2, [{ id: v.F1, role: "load_bearing" }], { document: altered });
  assert.equal(v.docket.coreDue({ case: CASE, viewer: "member:alice" }).items.find((i) => i.kind === "edition").what_changed, null);
});

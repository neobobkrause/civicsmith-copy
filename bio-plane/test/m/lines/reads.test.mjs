/* lines at its interface: withdrawal (R8), readLine and linesOf (R9), structureAt (R10), holderAt (R11, R12),
   partiesOf and proceedingLinks (R13), their refusal of a non-proceeding through entities (R23). */
import test from "node:test";
import assert from "node:assert/strict";
import { world, sha, ANN, MACHINE } from "./fixture.mjs";
import { STRUCTURE_KINDS, linesOps } from "../../../src/lines/index.mjs";
import { notAProceeding } from "../../../src/entities/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { reasonText } from "../../../src/lines/index.mjs";

const T = { statement: "The clerk told me at the counter" };

test("R8 withdrawLine refuses NO_REASON and NO_SUCH_LINE; a repeat answers already and writes nothing; a withdrawn line remains, shown withdrawn with who, when and why, and is counted by none of R10–R13; nothing is deleted", () => {
  const w = world();
  const p = w.ent("person", "Ada Example"), o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board");
  const c = w.ent("proceeding", "Case one");
  const h = w.say("holds", p, o, { capacity: "elected", valid: { from: "2020-01-01", to: "2024-12-31" } });
  const s = w.say("part_of", o, b, { valid: { from: "2010-01-01", to: "2030-01-01" } });
  const pt = w.say("party_to", p, c, { role: "plaintiff" });
  const c2 = w.ent("proceeding", "Case two");
  const ap = w.say("appeal_of", c2, c);
  assert.equal(w.l.withdrawLine({ lineId: h, reason: "  ", by: ANN }).reason, "NO_REASON");
  assert.equal(w.l.withdrawLine({ lineId: "LIN-2026-aaaaaaaaaaaaaaaa", reason: "wrong", by: ANN }).reason, "NO_SUCH_LINE");
  assert.equal(w.l.withdrawLine({ reason: "wrong", by: ANN }).reason, "NO_SUCH_LINE");
  for (const id of [h, s, pt, ap]) assert.equal(w.l.withdrawLine({ lineId: id, reason: "the source was misread", by: ANN }).ok, true);
  const again = w.l.withdrawLine({ lineId: h, reason: "again", by: "member:bob" });
  assert.equal(again.already, true);
  assert.deepEqual(again.withdrawn.by, ANN, "the first withdrawal stands");
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM line_withdrawals`).n, 4);
  const read = w.l.readLine({ lineId: h, viewer: ANN }).line;
  assert.deepEqual([read.withdrawn.by, read.withdrawn.reason, typeof read.withdrawn.at], [ANN, "the source was misread", "string"]);
  assert.equal(w.one(`SELECT COUNT(*) AS n FROM lines`).n, 4, "nothing is deleted");
  assert.deepEqual(w.l.holderAt({ office: o, at: "2022-01-01", viewer: ANN }).why, { key: "lines.why.no_line_covers", vars: {} });
  assert.deepEqual(w.l.structureAt({ entity: o, at: "2022-01-01", viewer: ANN }), { ok: true, entity: o, at: "2022-01-01", held: [], undetermined: [], truncated: false });
  assert.equal(w.l.partiesOf({ proceeding: c, viewer: ANN }).parties.length, 0);
  assert.equal(w.l.proceedingLinks({ proceeding: c, viewer: ANN }).links.length, 0);
  assert.equal(w.l.neighbours({ node: o, at: "2022-01-01T00:00:00Z", viewer: ANN }).items.length, 0);
  /* a correction is a withdrawal and a new line */
  const fixed = w.say("holds", p, o, { capacity: "appointed", valid: { from: "2020-01-01", to: "2024-12-31" } });
  assert.equal(w.l.holderAt({ office: o, at: "2022-01-01", viewer: ANN }).line.line_id, fixed);
});

test("R9 readLine: NO_LINE for an empty id, found false for an absent one, otherwise every field (a holds line's title among them), its basis and citation, both grade axes, its bounds as given and cached, its withdrawal; linesOf by end, oldest first, bounded 1–500 (default 100) with truncated", () => {
  const w = world();
  const o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board");
  assert.equal(w.l.readLine({ lineId: "", viewer: ANN }).reason, "NO_LINE");
  assert.deepEqual(w.l.readLine({ lineId: "LIN-2026-aaaaaaaaaaaaaaaa", viewer: ANN }), { ok: true, found: false, line_id: "LIN-2026-aaaaaaaaaaaaaaaa" });
  const s = w.held("INFO-2026-0001", sha("org chart"), { refs: [{ kind: "office", key: "Harbour Master", label: "Harbour Master", ref: "Harbour Master" }] });
  assert.equal(w.ents.resolve({ captureSha: s, resolvedBy: MACHINE }).ok, true);
  const r = w.l.recordLine({ kind: "reports_to", from: o, to: b, role: "functional", valid: { from: "2020-01-01" },
                             basis: { captureSha: s, extent: { kind: "document" } }, by: ANN });
  const line = w.l.readLine({ lineId: r.line_id, viewer: ANN }).line;
  assert.deepEqual(Object.keys(line).sort(), ["asserted_by", "assertion", "at", "basis", "bounds", "capacity", "citation", "ends", "from",
                                              "kind", "line_id", "role", "title", "to", "valid", "withdrawn"].sort());
  assert.deepEqual([line.kind, line.from, line.to, line.role, line.capacity, line.title], ["reports_to", o, b, "functional", null, null]);
  assert.deepEqual(line.basis, { form: "passage", captureSha: s, extent: { kind: "document" } });
  assert.equal(line.citation, `capture ${s}`);
  assert.equal(line.assertion, w.prov.captureGrade(s).grade, "the assertion is the capture's grade");
  assert.deepEqual(line.ends, { from: "A", to: "D" }, "the office resolves in the capture by its alias; the body is not resolved there");
  assert.deepEqual(line.bounds.given, { from: "2020-01-01", to: null, precision: "day", zone: "America/Halifax" });
  assert.equal(line.bounds.cached.from, "2020-01-01");
  assert.equal(line.withdrawn, null);
  assert.equal(line.asserted_by, ANN);
  /* linesOf */
  const many = [];
  for (let i = 0; i < 4; i++) many.push(w.say("part_of", w.ent("office", `Desk ${i}`), b));
  const all = w.l.linesOf({ entity: b, viewer: ANN });
  assert.deepEqual(all.lines.map((x) => x.line_id), [r.line_id, ...many], "oldest first");
  assert.equal(all.limit, 100);
  assert.deepEqual(w.l.linesOf({ entity: b, direction: "from", viewer: ANN }).lines, []);
  assert.equal(w.l.linesOf({ entity: o, direction: "from", viewer: ANN }).lines.length, 1);
  const two = w.l.linesOf({ entity: b, limit: 2, viewer: ANN });
  assert.deepEqual([two.count, two.truncated], [2, true]);
  assert.equal(w.l.linesOf({ entity: b, limit: 5, viewer: ANN }).truncated, false);
  assert.equal(w.l.linesOf({ entity: b, limit: 9999, viewer: ANN }).limit, 500);
  assert.equal(w.l.linesOf({ entity: b, limit: 0, viewer: ANN }).limit, 100);
  assert.equal(w.l.linesOf({ entity: b, kinds: ["reports_to"], viewer: ANN }).count, 1);
  assert.equal(w.l.linesOf({ entity: b, kinds: ["knows"], viewer: ANN }).reason, "UNKNOWN_LINE_KIND");
  assert.equal(w.l.linesOf({ viewer: ANN }).reason, "NO_ENTITY");
  /* a holds line's title, as written, in readLine and linesOf alike; null where none is stated */
  const ada = w.ent("person", "Ada Example");
  const titled = w.say("holds", ada, o, { capacity: "appointed", title: "Harbour Master and Pilot" });
  const untitled = w.say("holds", ada, o, { capacity: "interim" });
  assert.equal(w.l.readLine({ lineId: titled, viewer: ANN }).line.title, "Harbour Master and Pilot");
  const held = w.l.linesOf({ entity: o, kinds: ["holds"], viewer: ANN }).lines;
  assert.deepEqual(held.map((x) => [x.line_id, x.title]), [[titled, "Harbour Master and Pilot"], [untitled, null]]);
  for (const x of held) assert.deepEqual(Object.keys(x).sort(), Object.keys(w.l.readLine({ lineId: x.line_id, viewer: ANN }).line).sort());
});

test("R10 structureAt answers the structure lines at either end judged at the date: in held, undetermined listed apart with why (no stated bound, a band straddling the date, an unresolved event bound), out not answered; NO_DATE without a date", () => {
  const w = world();
  const o = w.ent("office", "Harbour Master"), b = w.ent("body", "Port Board"), d = w.ent("body", "Old Board");
  const p = w.ent("person", "Ada Example");
  const inn = w.say("part_of", o, b, { valid: { from: "2010-01-01", to: "2030-12-31" } });
  w.say("part_of", o, d, { valid: { from: "2000-01-01", to: "2009-12-31" } });             /* out */
  const open = w.say("reports_to", o, b, { valid: { from: "2015-01-01" } });              /* no end stated */
  const band = w.say("oversees", b, o, { valid: { from: "2022-06-15T10:00", to: "2030-01-01T00:00", precision: "minute" } }); /* the day straddles it */
  const e = w.event();
  const ev = w.say("appoints", b, o, { valid: { from: { event: e, edge: "start" }, to: "2030-01-01" } });
  w.say("belongs_to", p, b, { valid: { from: "2010-01-01", to: "2030-12-31" } });        /* not a structure kind */
  const r = w.l.structureAt({ entity: o, at: "2022-06-15", viewer: ANN });
  assert.deepEqual(r.held.map((x) => x.line_id), [inn]);
  const why = Object.fromEntries(r.undetermined.map((u) => [u.line.line_id, u.why]));
  assert.deepEqual(Object.keys(why).sort(), [open, band, ev].sort());
  assert.equal(why[open].key, "civil-time.end_stated");
  assert.equal(why[band].key, "civil-time.values.overlaps_start");
  assert.equal(why[ev].key, "civil-time.values.event_unresolved");
  for (const k of [open, band, ev]) assert.ok(reasonText(why[k]).length > 0, k);
  assert.equal(w.l.structureAt({ entity: o, viewer: ANN }).reason, "NO_DATE");
  assert.equal(w.l.structureAt({ entity: o, at: "next tuesday", viewer: ANN }).reason, "BAD_DATE");
  assert.deepEqual(w.l.structureAt({ entity: o, at: "2022-06-15", kinds: ["part_of"], viewer: ANN }).held.map((x) => x.line_id), [inn]);
  assert.equal(w.l.structureAt({ entity: o, at: "2022-06-15", kinds: ["belongs_to"], viewer: ANN }).reason, "UNKNOWN_LINE_KIND", "the subset is of structure kinds");
  assert.equal(w.l.structureAt({ entity: b, at: "2022-06-15T12:00:00Z", viewer: ANN }).held.length, 1, "an instant, and the other end");
  assert.equal(STRUCTURE_KINDS.length, 13);
});

test("R11 holderAt refuses NO_ENTITY, NO_SUCH_ENTITY, NOT_AN_OFFICE, NO_DATE; counts only holds lines to the office; one in answers the holder with line, capacity, basis and both axes; none answers 'no line covers the date'; two in, or any undetermined, answer undetermined naming the lines, never the most recent", () => {
  const w = world();
  const ada = w.ent("person", "Ada Example"), ben = w.ent("person", "Ben Example");
  const o = w.ent("office", "Harbour Master"), org = w.ent("institution", "Harbour Authority");
  assert.equal(w.l.holderAt({ at: "2022-01-01", viewer: ANN }).reason, "NO_ENTITY");
  assert.equal(w.l.holderAt({ office: "ENT-2026-7777", at: "2022-01-01", viewer: ANN }).reason, "NO_SUCH_ENTITY");
  assert.equal(w.l.holderAt({ office: org, at: "2022-01-01", viewer: ANN }).reason, "NOT_AN_OFFICE");
  assert.equal(w.l.holderAt({ office: o, viewer: ANN }).reason, "NO_DATE");
  w.say("holds", ada, org, { capacity: "employee", valid: { from: "2000-01-01", to: "2030-01-01" } }); /* a career, never a holder */
  w.say("seat_on", o, w.ent("body", "Port Board"), { valid: { from: "2000-01-01", to: "2030-01-01" } });
  assert.deepEqual(w.l.holderAt({ office: o, at: "2022-01-01", viewer: ANN }), { ok: true, office: o, at: "2022-01-01", holder: null,
                                                                             undetermined: true, why: { key: "lines.why.no_line_covers", vars: {} }, lines: [] });
  const e1 = w.say("holds", ada, o, { capacity: "elected", valid: { from: "2018-01-08", to: "2022-01-09" } });
  const one = w.l.holderAt({ office: o, at: "2020-03-01", viewer: ANN });
  assert.deepEqual([one.holder, one.line.line_id, one.capacity, one.assertion, one.ends], [ada, e1, "elected", "D", { from: "D", to: "D" }]);
  assert.equal(one.basis.form, "testimony");
  /* an acting holder beside an elected one: two in */
  const act = w.say("holds", ben, o, { capacity: "acting", valid: { from: "2020-02-01", to: "2020-04-30" } });
  const two = w.l.holderAt({ office: o, at: "2020-03-01", viewer: ANN });
  assert.equal(two.holder, null);
  assert.equal(two.undetermined, true);
  assert.equal(two.why.key, "lines.why.lines_disagree");
  assert.deepEqual(two.lines.map((x) => x.line_id).sort(), [e1, act].sort());
  /* two overlapping holds, the later one more recent: still undetermined */
  const later = w.say("holds", ben, o, { capacity: "elected", valid: { from: "2022-01-01" } });
  const overlap = w.l.holderAt({ office: o, at: "2022-01-05", viewer: ANN });
  assert.equal(overlap.holder, null);
  assert.deepEqual(overlap.lines.map((x) => x.line_id).sort(), [e1, later].sort());
  /* an open-ended holder line is undetermined after its start (K1505 (10)) */
  const open = w.l.holderAt({ office: o, at: "2025-01-01", viewer: ANN });
  assert.equal(open.holder, null);
  assert.deepEqual(open.lines, [{ line_id: later, why: { key: "civil-time.end_stated", vars: {} }, state: "undetermined" }]);
});

test("R12 a holder is a person entity, the same entity across every role it has held; holderAt never answers text", () => {
  const w = world();
  const ada = w.ent("person", "Ada Example"), o1 = w.ent("office", "Harbour Master"), o2 = w.ent("office", "Port Warden");
  const body = w.ent("body", "Port Board");
  assert.equal(w.l.recordLine({ kind: "holds", from: body, to: o1, capacity: "ex officio", basis: T, by: ANN }).reason, "HOLDER_NOT_A_PERSON");
  w.say("holds", ada, o1, { capacity: "appointed", valid: { from: "2010-01-01", to: "2015-12-31" } });
  w.say("holds", ada, o2, { capacity: "elected", valid: { from: "2016-01-01", to: "2020-12-31" } });
  const a = w.l.holderAt({ office: o1, at: "2012-01-01", viewer: ANN }), b = w.l.holderAt({ office: o2, at: "2018-01-01", viewer: ANN });
  assert.equal(a.holder, ada);
  assert.equal(b.holder, ada, "the same entity in both roles");
  assert.equal(w.ents.readEntity({ entityId: a.holder }).entity.kind, "person");
  assert.match(a.holder, /^ENT-/, "an entity id, never a name");
});

test("R13 partiesOf refuses NOT_A_PROCEEDING and answers the party_to lines with their roles (as of a date by R10's rule); proceedingLinks answers appeal_of, consolidated_with, remanded_to and arises_from in both directions, one hop", () => {
  const w = world();
  const ada = w.ent("person", "Ada Example"), city = w.ent("institution", "Harbour Authority");
  const c1 = w.ent("proceeding", "Case one"), c2 = w.ent("proceeding", "Case two"), c3 = w.ent("proceeding", "Case three");
  const o = w.ent("office", "Harbour Master");
  assert.equal(w.l.partiesOf({ proceeding: o, viewer: ANN }).reason, "NOT_A_PROCEEDING");
  assert.equal(w.l.proceedingLinks({ proceeding: o, viewer: ANN }).reason, "NOT_A_PROCEEDING");
  assert.equal(w.l.partiesOf({ viewer: ANN }).reason, "NO_ENTITY");
  assert.equal(w.l.partiesOf({ proceeding: "ENT-2026-7777", viewer: ANN }).reason, "NO_SUCH_ENTITY");
  const pl = w.say("party_to", ada, c1, { role: "petitioner", valid: { from: "2021-01-01" } });
  const df = w.say("party_to", city, c1, { role: "respondent", valid: { from: "2021-01-01", to: "2021-06-30" } });
  const all = w.l.partiesOf({ proceeding: c1, viewer: ANN });
  assert.deepEqual(all.parties.map((p) => [p.party, p.role]), [[ada, "petitioner"], [city, "respondent"]]);
  const at = w.l.partiesOf({ proceeding: c1, at: "2022-01-01", viewer: ANN });
  assert.deepEqual(at.parties, [], "the respondent's line is out; the petitioner's has no end stated");
  assert.deepEqual(at.undetermined.map((u) => u.line.line_id), [pl]);
  const early = w.l.partiesOf({ proceeding: c1, at: "2021-03-01", viewer: ANN });
  assert.deepEqual(early.parties.map((p) => p.line.line_id), [df]);
  const a = w.say("appeal_of", c2, c1), cw = w.say("consolidated_with", c1, c3), rm = w.say("remanded_to", c2, c3);
  const ar = w.say("arises_from", c1, w.ent("body", "Port Board"));
  const links = w.l.proceedingLinks({ proceeding: c1, viewer: ANN }).links;
  assert.deepEqual(links.map((l) => [l.line.line_id, l.kind, l.direction]).sort(),
                   [[a, "appeal_of", "in"], [cw, "consolidated_with", "out"], [ar, "arises_from", "out"]].sort());
  assert.ok(!links.some((l) => l.line.line_id === rm), "one hop: c2→c3 is not c1's");
});

test("R23 partiesOf's NOT_A_PROCEEDING is entities.notAProceeding's answer, code, row and sentence alike, for every kind that is not a proceeding, at both reads and through the ops map; control: a proceeding is not refused, and an absent or unknown id keeps its own refusal", () => {
  const w = world();
  const c = w.ent("proceeding", "Case one");
  const others = ["person", "office", "body", "institution"].map((k) => w.ent(k, `A ${k}`));
  const ops = (q) => linesOps(w.l, new URL(`https://plane.example/?${q}&viewer=${encodeURIComponent(ANN)}`), undefined);
  for (const e of others) {
    for (const [label, r] of [["partiesOf", w.l.partiesOf({ proceeding: e, viewer: ANN })],
                              ["partiesOf at a date", w.l.partiesOf({ proceeding: e, at: "2022-01-01", viewer: ANN })],
                              ["proceedingLinks", w.l.proceedingLinks({ proceeding: e, viewer: ANN })],
                              ["partiesof op", ops(`proceeding=${e}`).partiesof()],
                              ["proceedinglinks op", ops(`proceeding=${e}`).proceedinglinks()]]) {
      assert.equal(r.reason, "NOT_A_PROCEEDING", label);
      assert.deepEqual(r, notAProceeding(r.detail), `${label}: the answer is entities' own, its site's detail apart`);
      assert.ok(typeof r.detail === "string" && r.detail.trim(), `${label}: the detail is named`);
    }
  }
  /* control */
  assert.equal(w.l.partiesOf({ proceeding: c, viewer: ANN }).ok, true);
  assert.equal(w.l.proceedingLinks({ proceeding: c, viewer: ANN }).ok, true);
  assert.equal(w.l.partiesOf({ viewer: ANN }).reason, "NO_ENTITY");
  assert.equal(w.l.partiesOf({ proceeding: "ENT-2026-7777", viewer: ANN }).reason, "NO_SUCH_ENTITY");
  assert.notDeepEqual(w.l.partiesOf({ proceeding: "ENT-2026-7777", viewer: ANN }), notAProceeding("ENT-2026-7777"));
});

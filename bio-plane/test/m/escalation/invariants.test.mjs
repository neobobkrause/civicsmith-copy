/* escalation's invariants: no machine acts (R17), append-only history (R18), no judgment of significance (R19),
   sight and purge and no place named (R20), a record object of its own type (R21). */
import test from "node:test";
import assert from "node:assert/strict";
import { list } from "../../../../jurisdictions/index.mjs";
import { BUNDLE_ID_RE } from "../../../src/record-grammar/ids.mjs";
import { STATES } from "../../../src/record-grammar/document.mjs";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { escalationOf } from "../../../src/escalation/index.mjs";
import { seeded, opened, toStage, storage, V, MACHINE, ms } from "./fixture.mjs";

/* Every act, called with `extra` over arguments that would otherwise land (at stage 4, with a response to read). */
function acts(w) {
  const base = { id: w.E, viewer: V("bob"), author: V("bob") };
  return {
    escalationOpen: (x) => w.esc.escalationOpen({ reason: "Worth pursuing.", determination: w.D2, viewer: V("bob"), author: V("bob"), ...x }),
    escalationAttach: (x) => w.esc.escalationAttach({ reason: "This act serves the stage.", ...base, id: w.E2, action: w.A2, ...x }),
    escalationEvaluate: (x) => w.esc.escalationEvaluate({ ...base, response: { action: w.N, ord: w.R }, reading: "denied", reason: "No.", ...x }),
    escalationAdvance: (x) => w.esc.escalationAdvance({ ...base, to: 5, reason: "Go.", ...x }),
    escalationDecline: (x) => w.esc.escalationDecline({ ...base, to: 5, reason: "Not now.", ...x }),
    escalationSuspend: (x) => w.esc.escalationSuspend({ ...base, reason: "Hold.", ...x }),
    escalationResume: (x) => w.esc.escalationResume({ ...base, ...x }),
    escalationEnd: (x) => w.esc.escalationEnd({ ...base, ...x }),
    declineToEscalate: (x) => w.esc.declineToEscalate({ determination: w.D2, reason: "Not now.", viewer: V("bob"), author: V("bob"), ...x }),
  };
}

function stage4() {
  const w = seeded();
  toStage(w, 4);
  w.D2 = w.determine({ project: w.P, outcomes: [{ standard: "STD-2026-0001-a", outcome: "noncompliant" }] });
  const D3 = w.determine({ project: w.P, outcomes: [{ standard: "STD-2026-0001-a", outcome: "noncompliant" }] });
  w.E2 = w.esc.escalationOpen({ reason: "Worth pursuing.", determination: D3, author: V("bob"), viewer: V("bob") }).id;
  w.esc.escalationAdvance({ id: w.E2, to: 2, reason: "Go.", author: V("bob"), viewer: V("bob") });
  w.A2 = w.action({ project: w.P, restsOn: [D3] });
  return w;
}

test("R17 nothing a machine writes opens, declines to open, attaches to, evaluates, advances, declines, suspends or ends an escalation, nor promotes its document; a proposal is the protocol's derivation, stated as such, never an act", () => {
  const w = stage4();
  const codes = { escalationOpen: "MACHINE_CANNOT_OPEN", escalationAttach: "MACHINE_CANNOT_ATTACH",
    escalationEvaluate: "MACHINE_CANNOT_EVALUATE", escalationAdvance: "MACHINE_CANNOT_ADVANCE",
    escalationDecline: "MACHINE_CANNOT_DECLINE", escalationSuspend: "MACHINE_CANNOT_SUSPEND",
    escalationResume: "MACHINE_CANNOT_RESUME", escalationEnd: "MACHINE_CANNOT_END",
    declineToEscalate: "MACHINE_CANNOT_DECLINE_TO_ESCALATE" };
  const before = w.snapshot();
  for (const [name, call] of Object.entries(acts(w)))
    for (const author of [MACHINE, "token:run-7", "", undefined])
      assert.equal(call({ author }).reason, codes[name], `${name} ${author}`);
  assert.deepEqual(w.snapshot(), before);
  /* negative control: the same calls by a member land (the decline to escalate and the opening, each of its own
     determination) */
  assert.equal(acts(w).declineToEscalate({}).ok, true);
  assert.equal(acts(w).escalationOpen({}).ok, true);
  w.D2 = w.determine({ project: w.P, outcomes: [{ standard: "STD-2026-0001-a", outcome: "noncompliant" }] });
  const before2 = w.snapshot();
  /* the document itself, promoted by a machine: refused before anything is written */
  const head = w.record.head(w.E);
  const text = w.text(w.E).replace("stage: 4", "stage: 5");
  const raw = w.promotion.promote({ bundleId: w.E, base: head.bundleSha, snapKey: "20260928T010000Z_0000aaaa", author: MACHINE,
                                    files: [{ path: "bundle.md", text }], meta: {} });
  assert.equal(raw.reason, "MACHINE_CANNOT_WRITE_ESCALATION");
  assert.deepEqual(w.snapshot(), before2);
  /* a proposal says what it is */
  w.esc.escalationEvaluate({ id: w.E, response: { action: w.N, ord: w.R }, reading: "denied", reason: "No.", author: V("bob"), viewer: V("bob") });
  const p = w.esc.escalationRead({ id: w.E, viewer: V("bob") }).proposed;
  assert.equal(p.length, 2);
  for (const x of p) {
    assert.equal(x.by, "protocol");
    assert.match(x.says, /not an act/);
    assert.match(x.says, /A member advances it or declines it/);
  }
});

test("R18 every opening reason, decline to escalate, attachment reason, stage move, evaluation, decline, suspension and end is appended with who, when and why; the history is never edited, by an act or a raw promotion", () => {
  const w = seeded();
  const texts = [];
  const snap = () => texts.push(w.text(w.E));
  w.clock.now = "2026-09-28T01:00:00Z"; opened(w); snap();
  w.clock.now = "2026-09-28T02:00:00Z";
  w.esc.escalationDecline({ id: w.E, to: 2, reason: "Wait a day.", author: V("alice"), viewer: V("alice") }); snap();
  w.clock.now = "2026-09-28T03:00:00Z";
  w.esc.escalationSuspend({ id: w.E, reason: "Counsel first.", author: V("bob"), viewer: V("bob") }); snap();
  w.clock.now = "2026-09-28T04:00:00Z";
  w.esc.escalationResume({ id: w.E, reason: "Counsel done.", author: V("alice"), viewer: V("alice") }); snap();
  w.clock.now = "2026-09-28T05:00:00Z";
  w.esc.escalationAdvance({ id: w.E, to: 2, reason: "Notify now.", author: V("bob"), viewer: V("bob") }); snap();
  const n = w.action({ project: w.P, restsOn: [w.D] });
  w.clock.now = "2026-09-28T06:00:00Z";
  w.esc.escalationAttach({ reason: "This act serves the stage.", id: w.E, action: n, author: V("bob"), viewer: V("bob") }); snap();
  w.correspond(n, "sent", "2026-09-02");
  w.clock.now = "2026-09-28T07:00:00Z";
  w.esc.escalationAdvance({ id: w.E, to: 3, reason: "Sent.", author: V("bob"), viewer: V("bob") }); snap();
  const R = w.correspond(n, "received", "2026-09-10");
  w.clock.now = "2026-09-28T08:00:00Z";
  w.esc.escalationAdvance({ id: w.E, to: 4, reason: "Replied.", author: V("bob"), viewer: V("bob") }); snap();
  w.clock.now = "2026-09-28T09:00:00Z";
  w.esc.escalationEvaluate({ id: w.E, response: { action: n, ord: R }, reading: "partial", reason: "Half.", author: V("alice"), viewer: V("alice") }); snap();
  const h = w.esc.escalationRead({ id: w.E, viewer: V("bob") }).history;
  assert.deepEqual(h.map((x) => [x.seq, x.kind, x.author, x.at, x.reason ?? null]), [
    [1, "open", V("bob"), "2026-09-28T01:00:00Z", "Worth pursuing."],
    [2, "decline", V("alice"), "2026-09-28T02:00:00Z", "Wait a day."],
    [3, "suspend", V("bob"), "2026-09-28T03:00:00Z", "Counsel first."],
    [4, "resume", V("alice"), "2026-09-28T04:00:00Z", "Counsel done."],
    [5, "advance", V("bob"), "2026-09-28T05:00:00Z", "Notify now."],
    [6, "attach", V("bob"), "2026-09-28T06:00:00Z", "This act serves the stage."],
    [7, "advance", V("bob"), "2026-09-28T07:00:00Z", "Sent."],
    [8, "advance", V("bob"), "2026-09-28T08:00:00Z", "Replied."],
    [9, "evaluate", V("alice"), "2026-09-28T09:00:00Z", "Half."]]);
  /* each act kept every byte of the log before it */
  const logOf = (t) => t.slice(t.indexOf("## Escalation Log"), t.indexOf("## Session Log"));
  for (let i = 1; i < texts.length; i++) assert.ok(logOf(texts[i]).startsWith(logOf(texts[i - 1]).trimEnd()), `act ${i}`);
  /* one manifest entry per act, none rewritten */
  const manifest = JSON.parse(w.record.readImage(w.E)["_history/manifest.json"].text ?? w.record.readImage(w.E)["_history/manifest.json"]);
  const entries = Array.isArray(manifest) ? manifest : manifest.entries ?? Object.values(manifest);
  assert.equal(entries.length, texts.length);
  /* the projections are appended, never updated: every earlier row is unchanged */
  const rowsNow = w.rows(`SELECT * FROM escalation_moves ORDER BY seq`);
  assert.deepEqual(rowsNow.map((r) => [r.seq, r.kind]), [[1, "open"], [3, "suspend"], [4, "resume"], [5, "advance"], [7, "advance"], [8, "advance"]]);
  assert.deepEqual(w.rows(`SELECT seq, reason, author FROM escalation_declines`), [{ seq: 2, reason: "Wait a day.", author: V("alice") }]);
  /* a member's raw promotion editing the log is refused, and so is one that only appends outside the acts */
  const head = w.record.head(w.E);
  const edited = w.text(w.E).replace("Wait a day.", "Never mind.");
  const r1 = w.promotion.promote({ bundleId: w.E, base: head.bundleSha, snapKey: "20260928T100000Z_0000bbbb", author: V("bob"),
                                   files: [{ path: "bundle.md", text: edited }], meta: {} });
  assert.equal(r1.reason, "ESCALATION_BY_ACT_ONLY");
  assert.equal(w.text(w.E), texts.at(-1));
  /* the opening reason and the attachment reason are kept in their projections, with who and when */
  assert.deepEqual(w.rows(`SELECT opened_reason, opened_by, opened_at FROM escalations WHERE escalation_id=?`, w.E),
                   [{ opened_reason: "Worth pursuing.", opened_by: V("bob"), opened_at: "2026-09-28T01:00:00Z" }]);
  assert.deepEqual(w.rows(`SELECT reason, author, at FROM escalation_attachments WHERE action_id=?`, n),
                   [{ reason: "This act serves the stage.", author: V("bob"), at: "2026-09-28T06:00:00Z" }]);
  /* declines to escalate (R27): each appended with its reason, who and when; an earlier one is never changed by a
     later decline or a later opening */
  const D = w.determine({ project: w.P, outcomes: [{ standard: "STD-2026-0001-a", outcome: "noncompliant" }] });
  const declines = () => w.rows(`SELECT * FROM escalation_declines_to_open WHERE determination_id=? ORDER BY seq`, D);
  w.clock.now = "2026-09-28T10:00:00Z";
  assert.equal(w.esc.declineToEscalate({ determination: D, reason: "Too early.", author: V("alice"), viewer: V("alice") }).ok, true);
  const first = declines();
  w.clock.now = "2026-09-28T11:00:00Z";
  assert.equal(w.esc.declineToEscalate({ determination: D, reason: "Still too early.", author: V("bob"), viewer: V("bob") }).ok, true);
  w.clock.now = "2026-09-28T12:00:00Z";
  assert.equal(w.esc.escalationOpen({ determination: D, reason: "Now it is time.", author: V("bob"), viewer: V("bob") }).ok, true);
  const all = declines();
  assert.deepEqual(all.slice(0, 1), first, "the first decline is unchanged by what came after");
  assert.deepEqual(all.map((x) => [x.seq, x.reason, x.author, x.at]),
    [[1, "Too early.", V("alice"), "2026-09-28T10:00:00Z"], [2, "Still too early.", V("bob"), "2026-09-28T11:00:00Z"]]);
});

test("R19 no input or answer carries a significance, severity, priority, urgency, rank or score; a stage act's purpose is only enforcing a pursued standard", () => {
  const w = stage4();
  const before = w.snapshot();
  for (const key of ["significance", "severity", "priority", "urgency", "score", "rank"])
    for (const [name, call] of Object.entries(acts(w))) {
      const r = call({ [key]: "high" });
      assert.equal(r.reason, "ESCALATION_CARRIES_NO_JUDGMENT", `${name} ${key}`);
      assert.deepEqual(r.keys, [key]);
    }
  assert.deepEqual(w.snapshot(), before);
  /* every answer, walked: no such key anywhere */
  w.esc.escalationEvaluate({ id: w.E, response: { action: w.N, ord: w.R }, reading: "partial", reason: "Half.", author: V("bob"), viewer: V("bob") });
  const answers = [w.esc.escalationRead({ id: w.E, viewer: V("bob") }), w.esc.escalationsDue({ viewer: V("bob") }),
    w.esc.escalationAdvance({ id: w.E, to: 7, reason: "Go.", author: V("bob"), viewer: V("bob") }),
    w.esc.escalationRead({ id: w.E, viewer: V("bob") })];
  const walk = (v, path) => {
    if (Array.isArray(v)) return v.forEach((x, i) => walk(x, `${path}[${i}]`));
    if (v && typeof v === "object") for (const [k, x] of Object.entries(v)) {
      assert.ok(!["significance", "severity", "priority", "urgency", "score", "rank"].includes(k), `${path}.${k}`);
      walk(x, `${path}.${k}`);
    }
  };
  answers.forEach((a, i) => walk(a, `answer${i}`));
  /* stage 7's purposes are the five, each aimed at a pursued standard (R12's refusals) */
  const a = w.action({ project: w.P, restsOn: [w.D] });
  assert.equal(w.esc.escalationAttach({ reason: "This act serves the stage.", id: w.E, action: a, purpose: "candidate_support", standards: ["STD-2026-0001-a"], author: V("bob"), viewer: V("bob") }).reason, "NOT_ACCOUNTABILITY");
  assert.equal(w.esc.escalationAttach({ reason: "This act serves the stage.", id: w.E, action: a, purpose: "testimony", standards: ["STD-2026-0003-c"], author: V("bob"), viewer: V("bob") }).reason, "NOT_THE_BREACH");
});

test("R20 every read and act answers an escalation in a project the viewer may not see as absent; the tables are declared to purge; no place, office or law is named in the module's outward text", () => {
  const w = stage4();
  /* carol sees neither the project nor, so, its escalations */
  const absent = w.esc.escalationRead({ id: "ESC-2026-0999-escalation", viewer: V("bob") });
  assert.deepEqual(w.esc.escalationRead({ id: w.E, viewer: V("carol") }), absent);
  for (const [name, call] of Object.entries(acts(w))) {
    if (name === "escalationOpen" || name === "declineToEscalate") continue;
    const r = call({ author: V("carol"), viewer: V("carol") });
    assert.equal(r.reason, "NO_SUCH_ESCALATION", name);
    const r2 = call({ author: V("carol"), viewer: V("carol"), id: "ESC-2026-0999-escalation" });
    assert.deepEqual({ ...r, id: null }, { ...r2, id: null }, `${name}: absent and unseen are one answer`);
  }
  assert.deepEqual(w.esc.escalationsDue({ nowMs: ms("2026-12-01T00:00:00Z"), viewer: V("carol") }).items, []);
  /* a determination in a project carol may not see: her decline to escalate and status read answer it as absent */
  const unseenD = acts(w).declineToEscalate({ author: V("carol"), viewer: V("carol") });
  assert.deepEqual(unseenD, { ...acts(w).declineToEscalate({ author: V("carol"), viewer: V("carol"), determination: "CONF-2026-0999-none" }),
                              determination: w.D2 });
  assert.equal(unseenD.reason, "NO_SUCH_DETERMINATION");
  assert.equal(w.esc.escalationStatus({ determination: w.D, viewer: V("carol") }).reason, "NO_SUCH_DETERMINATION");
  /* the declines to escalate are declared to purge, keyed by their determination */
  assert.equal(acts(w).declineToEscalate({}).ok, true);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM escalation_declines_to_open WHERE determination_id=?`, w.D2)[0].n, 1);
  const byD = w.record.purge({ bundleId: w.D2 });
  assert.equal(byD.removed.escalation_declines_to_open, 1);
  assert.equal(acts(w).declineToEscalate({}).ok, true);
  /* purge: a single-bundle purge of one escalation clears its rows only; the whole-store form clears every row */
  const tables = ["escalations", "escalation_moves", "escalation_evaluations", "escalation_attachments", "escalation_declines"];
  const count = (id) => tables.map((t) => w.rows(`SELECT COUNT(*) AS n FROM ${t} WHERE escalation_id=?`, id)[0].n);
  assert.ok(count(w.E).every((n, i) => n > 0 || tables[i] === "escalation_evaluations" || tables[i] === "escalation_declines"));
  const one = w.record.purge({ bundleId: w.E2 });
  for (const t of [...tables, "escalation_declines_to_open"]) assert.ok(t in one.removed, `${t} is declared`);
  assert.equal(one.removed.escalation_declines_to_open, 0, "a decline to escalate is no escalation's");
  assert.deepEqual(count(w.E2), [0, 0, 0, 0, 0]);
  assert.ok(count(w.E)[0] === 1);
  w.record.purge({});
  for (const t of [...tables, "escalation_declines_to_open"]) assert.equal(w.count(t), 0, t);
  /* no place named: every sentence the module answers, with no profile and with the test profile, names none of the
     places any held profile covers */
  const places = list().flatMap((p) => [...p.covers, p.name]).filter(Boolean);
  const x = stage4();
  x.record.setSetting("jurisdiction_profiles", [], "test");
  x.esc.escalationEvaluate({ id: x.E, response: { action: x.N, ord: x.R }, reading: "denied", reason: "No.", author: V("bob"), viewer: V("bob") });
  const answers = [x.esc.escalationRead({ id: x.E, viewer: V("bob") }), ...Object.values(acts(x)).map((c) => c({})),
    ...Object.values(acts(x)).map((c) => c({ author: MACHINE })), x.esc.escalationEnd({ id: x.E, author: V("bob"), viewer: V("bob") })];
  const sentences = [];
  const walk = (v, k) => {
    if (Array.isArray(v)) return v.forEach((y) => walk(y, k));
    if (v && typeof v === "object") return Object.entries(v).forEach(([kk, y]) => walk(y, kk));
    if (typeof v === "string" && ["says", "detail", "why", "missing"].includes(k)) sentences.push(v);
  };
  answers.forEach((a) => walk(a, ""));
  assert.ok(sentences.length >= 15, String(sentences.length));
  for (const s of sentences) for (const p of places) assert.ok(!s.includes(p), `"${p}" in "${s}"`);
});

test("R20 the factory migrates its tables at construction (K267): after escalationOf(host) with no explicit migrate(), a whole-store purge and a bundle purge answer ok and clear the declared tables, and constructing again changes nothing", () => {
  const tables = ["escalations", "escalation_moves", "escalation_evaluations", "escalation_attachments", "escalation_declines",
                  "escalation_declines_to_open"];
  /* a bare host, as a caller that only constructs the module (monitoring, R35) leaves it: no migrate() of escalation */
  const st = storage();
  const host = { storage: st };
  for (const t of RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n").split(";")) if (t.trim()) st.db.exec(t);
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership });
  const esc = escalationOf(host, { record, membership, promotion });
  const held = () => [...st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE 'escalation%' ORDER BY name`)].map((r) => r.name);
  assert.deepEqual(held(), [...tables].sort());
  const all = record.purge({});
  assert.equal(all.ok, true);
  for (const t of tables) assert.equal(all.removed[t], 0, t);
  const one = record.purge({ bundleId: "ESC-2026-0001-escalation" });
  assert.equal(one.ok, true);
  for (const t of tables) assert.ok(t in one.removed, t);
  /* the same instance on a second call, and migrate() again is harmless */
  assert.equal(escalationOf(host), esc);
  esc.migrate();
  assert.deepEqual(held(), [...tables].sort());
  /* with an escalation written: both purges clear its rows (the fixture's world never calls migrate() either) */
  const w = stage4();
  const b = w.record.purge({ bundleId: w.E2 });
  assert.equal(b.ok, true);
  assert.equal(b.removed.escalations, 1);
  assert.equal(w.rows(`SELECT COUNT(*) AS n FROM escalations WHERE escalation_id=?`, w.E2)[0].n, 0);
  const a = w.record.purge({});
  assert.equal(a.ok, true);
  for (const t of tables) assert.equal(w.count(t), 0, t);
});

test("R21 an escalation is a record object of its own type: an ESC- bundle of type escalation promoted through promotion, its states the catalogue's, with history, audit and export; only a replay promotes it outside the acts, and its tables follow the document", async () => {
  const w = seeded();
  toStage(w, 4);
  assert.match(w.E, BUNDLE_ID_RE);
  const head = w.record.head(w.E);
  assert.deepEqual([head.type, head.currentState], ["escalation", "open"]);
  assert.deepEqual(STATES.escalation.legal, ["open", "suspended", "ended", "stopped_pursuing"], "R33: record-grammar R57's state");
  const fm = w.fm(w.E);
  assert.deepEqual([fm.object_type, fm.project, fm.determination, fm.stage], ["escalation", w.P, w.D, 4]);
  /* export: the image carries every snapshot and the manifest */
  const img = w.record.readImage(w.E);
  assert.equal(Object.keys(img).filter((k) => /^_history\/bundle_/.test(k)).length, 4, "one snapshot per revision");
  assert.ok("_history/manifest.json" in img);
  /* audit: the record's catalogue finds nothing wrong with it */
  const audit = await w.record.auditPass({ after: "", limit: 50, visible: () => true });
  assert.ok(!(audit.offenders || []).some((o) => o.bundleId === w.E), JSON.stringify((audit.offenders || []).find((o) => o.bundleId === w.E)));
  /* a state move through the catalogue's table: open → suspended → open, never out of ended */
  w.esc.escalationSuspend({ id: w.E, reason: "Hold.", author: V("bob"), viewer: V("bob") });
  assert.equal(w.record.head(w.E).currentState, "suspended");
  w.esc.escalationResume({ id: w.E, author: V("bob"), viewer: V("bob") });
  /* a member's raw promotion outside the acts is refused */
  const h = w.record.head(w.E);
  const raw = w.promotion.promote({ bundleId: w.E, base: h.bundleSha, snapKey: "20260928T110000Z_0000cccc", author: V("bob"),
                                    files: [{ path: "bundle.md", text: w.text(w.E) }], meta: {} });
  assert.equal(raw.reason, "ESCALATION_BY_ACT_ONLY");
  /* a replay restores the document, and the tables follow it */
  const text = w.text(w.E);
  const rows = w.snapshot();
  for (const t of ["escalations", "escalation_moves", "escalation_evaluations", "escalation_attachments", "escalation_declines"])
    w.rows(`DELETE FROM ${t}`);
  const rep = w.promotion.promote({ bundleId: w.E, base: h.bundleSha, snapKey: "20260928T120000Z_0000dddd", author: V("bob"),
                                    replay: true, files: [{ path: "bundle.md", text }], meta: {} });
  assert.equal(rep.ok, true, JSON.stringify(rep));
  for (const t of ["escalation_moves", "escalation_attachments", "escalation_evaluations", "escalation_declines"])
    assert.equal(w.snapshot()[t], rows[t], t);
  const back = w.esc.escalationRead({ id: w.E, viewer: V("bob") });
  assert.deepEqual([back.stage, back.state, back.actions.length], [4, "open", 1]);
});

test("R17 R20 every refusal this module mints carries its code, its C-116 row and the member's translation, and each row names one site", async () => {
  const { ESCALATION_CHECKS } = await import("../../../src/escalation/index.mjs");
  const { CONFORMANCE_CHECKS } = await import("../../../src/conformance/index.mjs");
  const RELAYED = ["NO_SUCH_DETERMINATION", "DETERMINATION_SUPERSEDED"];
  for (const code of RELAYED) assert.ok(!(code in ESCALATION_CHECKS), code);
  const rows = Object.entries(ESCALATION_CHECKS);
  assert.equal(new Set(rows.map(([, r]) => r.check)).size, rows.length, "one row per code");
  for (const [code, row] of rows) {
    assert.match(row.check, /^C-116\.\d+$/, code);
    assert.match(row.where, /^src\/escalation\/index\.mjs \S+ > is-[a-z-]+$/, code);
    assert.ok(row.translation.length > 20, code);
  }
  /* a sample of every family of site, driven: each answer's row is its code's */
  const w = stage4();
  const answers = [...Object.values(acts(w)).map((c) => c({ author: MACHINE })), ...Object.values(acts(w)).map((c) => c({ rank: 1 })),
    ...Object.values(acts(w)).map((c) => c({ author: V("carol"), viewer: V("carol") })),
    w.esc.escalationEvaluate({ id: w.E, reading: "x", reason: "r", author: V("bob"), viewer: V("bob") }),
    w.esc.escalationAdvance({ id: w.E, to: 6, reason: "r", author: V("bob"), viewer: V("bob") })];
  for (const a of answers) {
    if (a.ok !== false || a.reason === "PROJECT_ACT_NOT_A_PARTICIPANT") continue;
    /* conformance's own codes (its R19, R20; N309, N312) are relayed with conformance's row, never one of C-116 */
    const row = RELAYED.includes(a.reason) ? CONFORMANCE_CHECKS[a.reason] : ESCALATION_CHECKS[a.reason];
    assert.ok(row, a.reason);
    assert.deepEqual([a.code, a.check, a.translation], [a.reason, row.check, row.translation], a.reason);
  }
});

/* R26's world: two notification actions attached at stage 2 by alice, H withheld from every viewer but alice when
   `hide` (the actions stand-in refuses it, as `actionRead` does an action the viewer may not see), N seen by all.
   H is sent first, so alice's advances record H's trigger ids; neither has a clock entry; alice evaluates H's reply.
   Answers the read at stages 2, 3 and 4, as alice and as bob, at one fixed instant. */
function withheldWorld(hide) {
  const w = seeded();
  opened(w);
  const by = (who) => ({ author: V(who), viewer: V(who) });
  const go = (to) => assert.equal(w.esc.escalationAdvance({ id: w.E, to, reason: `to ${to}`, ...by("alice") }).ok, true, `to ${to}`);
  go(2);
  const H = w.action({ project: w.P, restsOn: [w.D] });
  const N = w.action({ project: w.P, restsOn: [w.D] });
  if (hide) w.actionHidden.add(H);
  for (const a of [H, N]) assert.equal(w.esc.escalationAttach({ reason: "This act serves the stage.", id: w.E, action: a, ...by("alice") }).ok, true);
  const nowMs = ms("2026-09-28T01:00:00Z");
  const reads = { H, N, P: w.P };
  const read = (stage) => { for (const v of ["alice", "bob"]) reads[`${v}${stage}`] = w.esc.escalationRead({ id: w.E, nowMs, viewer: V(v) }); };
  w.correspond(H, "sent", "2026-09-01");
  w.correspond(N, "sent", "2026-09-02");
  read(2);
  go(3);
  read(3);
  const R = w.correspond(H, "received", "2026-09-10");
  go(4);
  assert.equal(w.esc.escalationEvaluate({ id: w.E, response: { action: H, ord: R }, reading: "denied", reason: "Refused.", ...by("alice") }).ok, true);
  assert.equal(w.esc.escalationDecline({ id: w.E, to: 7, reason: "Legal tools first.", ...by("alice") }).ok, true);
  read(4);
  return reads;
}

test("R26 an attached action the viewer may not see is withheld whole from the read: it leaves actions, R6's note, a trigger's ids and a history entry's trigger ids, with no id, placeholder or count, and out_of_view: true; a viewer who sees everything is answered as before", () => {
  const r = withheldWorld(true);
  const { H, N } = r;
  for (const s of [2, 3, 4]) {
    const b = r[`bob${s}`], a = r[`alice${s}`];
    /* one fewer action, and no null or placeholder in its place */
    assert.deepEqual(b.actions.map((x) => x.action), [N], `stage ${s}`);
    assert.deepEqual(a.actions.map((x) => x.action), [H, N], `stage ${s}`);
    const text = JSON.stringify(b);
    assert.ok(!text.includes(H), `stage ${s}: the withheld action's id is nowhere in the answer`);
    assert.ok(!text.includes("an object you may not see"), `stage ${s}: no placeholder`);
    assert.equal(b.out_of_view, true, `stage ${s}`);
    assert.ok(!("out_of_view" in a), `stage ${s}: alice sees everything`);
    /* the escalation's own stage, acts and proposals stand */
    assert.equal(b.stage, a.stage);
    assert.deepEqual(b.history.filter((h) => h.kind !== "attach").map((h) => [h.kind, h.to ?? null, h.at]),
                     a.history.filter((h) => h.kind !== "attach").map((h) => [h.kind, h.to ?? null, h.at]));
    /* K913: no gap in a sequence number counts it: with something withheld, no entry carries the log's seq */
    for (const x of [...b.history, ...b.actions, ...b.evaluations, ...b.proposed.flatMap((p) => p.declines)])
      assert.ok(!("seq" in x), `stage ${s}: ${JSON.stringify(x).slice(0, 80)}`);
    assert.deepEqual(a.history.map((h) => h.seq), a.history.map((_, i) => i + 1), "alice's history keeps its seq");
    assert.deepEqual(b.history.filter((h) => h.kind === "attach").map((h) => h.action), [N], "its attachment leaves the history");
    for (const t of b.triggers) assert.ok(!t.ids.some((i) => i === H || i.startsWith(`${H}#`)), `stage ${s} trigger ids`);
  }
  /* stage 2: bob's trigger to 3 is met by N's sent entry; alice's by H's, the earlier */
  assert.deepEqual(r.bob2.triggers[0].ids, [N, `${N}#0`]);
  assert.deepEqual(r.alice2.triggers[0].ids, [H, `${H}#0`]);
  /* stage 3: neither has a clock entry; bob's notes name N only, alice's both */
  assert.deepEqual(r.bob3.notes.map((n) => n.action), [N]);
  assert.deepEqual(r.alice3.notes.map((n) => n.action), [H, N]);
  /* the advance alice recorded on H's trigger ids shows bob the entry without them */
  const adv = (x, to) => x.history.find((h) => h.kind === "advance" && h.to === to);
  assert.deepEqual(adv(r.alice3, 3).trigger.ids, [H, `${H}#0`]);
  assert.deepEqual(adv(r.bob3, 3).trigger, { ...adv(r.alice3, 3).trigger, ids: [] });
  assert.deepEqual(adv(r.bob4, 4).trigger.ids, []);
  assert.deepEqual(adv(r.alice4, 4).trigger.ids, [H, `${H}#0`, `${H}#1`]);
  /* an evaluation of H's reply stands, without the response naming H */
  const ev = (x) => x.evaluations.at(-1);
  assert.deepEqual(ev(r.alice4).response, { action: H, ord: 1 });
  const { response: _, seq: __, ...rest } = ev(r.alice4);
  assert.deepEqual(ev(r.bob4), rest);
  assert.deepEqual(r.bob4.history.find((h) => h.kind === "evaluate").reading, "denied");
  /* the decline stands in the proposal, without its seq */
  const dec = (x) => x.proposed.find((p) => p.to === 7).declines;
  assert.equal(dec(r.bob4).length, 1);
  const { seq: ___, ...declined } = dec(r.alice4)[0];
  assert.deepEqual(dec(r.bob4)[0], declined);
  /* negative control: with nothing withheld, bob's answer is alice's byte for byte, and alice's is unchanged by H being
     withheld from someone else */
  const open = withheldWorld(false);
  /* the two worlds differ only in their project's allocated id */
  const bytes = (w, x) => JSON.stringify(x).replaceAll(w.P, "PROJ");
  for (const s of [2, 3, 4]) {
    assert.equal(JSON.stringify(open[`bob${s}`]), JSON.stringify(open[`alice${s}`]), `stage ${s}`);
    assert.equal(bytes(r, r[`alice${s}`]), bytes(open, open[`alice${s}`]), `stage ${s}`);
    assert.ok(!("out_of_view" in open[`bob${s}`]));
  }
});

test("R26 R7 R8 a withheld action meets no trigger for the viewer who may not see it, whatever the stage, and no act of theirs is taken on it; an evaluation's trigger id stands for every viewer, <id>/evaluation#<n>, the same id whether or not something was withheld, counting no other entry", () => {
  /* R7: stage 4 of R26's world, alice's evaluation reading H's reply (H withheld from bob) */
  const r = withheldWorld(true);
  const edge = (x, to) => x.triggers.find((t) => t.to === to);
  const E = r.alice4.id;
  assert.equal(r.bob4.out_of_view, true);
  for (const x of [r.alice4, r.bob4]) assert.deepEqual([edge(x, 5).met, edge(x, 5).ids], [true, [`${E}/evaluation#1`]]);
  /* the log numbers the evaluation after both attachments, H's among them; the id does not */
  assert.ok(r.alice4.history.find((h) => h.kind === "evaluate").seq > 3);
  assert.equal(JSON.stringify(r.bob4).includes("/evaluation/"), false, "no id carries the log's number");
  const open = withheldWorld(false);
  assert.deepEqual(edge(open.bob4, 5).ids, [`${open.alice4.id}/evaluation#1`], "the same id with nothing withheld");

  /* R8, R11: stages 5 and 6, with H attached at stage 5 and withheld from bob */
  const w = seeded();
  toStage(w, 4);
  const by = (who) => ({ author: V(who), viewer: V(who) });
  assert.equal(w.esc.escalationEvaluate({ id: w.E, response: { action: w.N, ord: w.R }, reading: "denied", reason: "No.", ...by("alice") }).ok, true);
  assert.equal(w.esc.escalationAdvance({ id: w.E, to: 5, reason: "Legal tools.", ...by("alice") }).ok, true);
  const H = w.action({ project: w.P, restsOn: [w.D] });
  w.actionHidden.add(H);
  assert.equal(w.esc.escalationAttach({ reason: "This act serves the stage.", id: w.E, action: H, ...by("alice") }).ok, true);
  w.correspond(H, "sent", "2026-09-16");
  const nowMs = ms("2026-09-30T00:00:00Z");
  const as = (who) => w.esc.escalationRead({ id: w.E, nowMs, viewer: V(who) });
  let a = as("alice"), b = as("bob");
  assert.deepEqual([edge(a, 6).met, edge(a, 6).ids], [true, [H, `${H}#0`]]);
  assert.deepEqual([edge(b, 6).met, edge(b, 6).ids], [false, []]);
  assert.match(edge(b, 6).missing, /no breach action is attached at stage 5/, "the missing sentence counts no withheld action");
  assert.deepEqual([a.proposed.map((p) => p.to), b.proposed.map((p) => p.to)], [[6, 7], [7]]);
  for (const x of [a, b]) assert.deepEqual(edge(x, 7).ids, [`${w.E}/evaluation#1`], "R8's to 7 names R7's id");
  /* monitoring's list, and the acts, derive the same way per viewer */
  const due = (who) => w.esc.escalationsDue({ nowMs, viewer: V(who) }).items.map((i) => [i.to, i.ids]);
  assert.deepEqual(due("alice"), [[6, [H, `${H}#0`]], [7, [`${w.E}/evaluation#1`]]]);
  assert.deepEqual(due("bob"), [[7, [`${w.E}/evaluation#1`]]]);
  const before = w.snapshot();
  assert.equal(w.esc.escalationAdvance({ id: w.E, to: 6, reason: "Sent.", ...by("bob") }).reason, "TRIGGER_NOT_MET");
  assert.equal(w.esc.escalationDecline({ id: w.E, to: 6, reason: "Not now.", ...by("bob") }).reason, "EDGE_NOT_PROPOSED");
  assert.deepEqual(w.snapshot(), before, "nothing written");
  /* stage 6: alice advances on H's sending; a reply on H recorded after the evaluation meets 6→4 for alice only */
  assert.equal(w.esc.escalationAdvance({ id: w.E, to: 6, reason: "Sent.", ...by("alice") }).ok, true);
  w.correspond(H, "received", "2026-09-29", "2026-09-29T09:00:00Z");
  a = as("alice"); b = as("bob");
  assert.deepEqual([edge(a, 4).met, edge(a, 4).ids], [true, [H, `${H}#1`]]);
  assert.deepEqual([edge(b, 4).met, edge(b, 4).ids, b.proposed], [false, [], []]);
  assert.deepEqual(b.history.at(-1).trigger.ids, [], "alice's advance on H's ids, shown to bob without them");
  assert.ok(!JSON.stringify(b).includes(H));
  /* a reply bob may see, on N, meets it for both */
  w.correspond(w.N, "received", "2026-09-29", "2026-09-29T10:00:00Z");
  assert.deepEqual(edge(as("bob"), 4).ids, [w.N, `${w.N}#2`]);
});

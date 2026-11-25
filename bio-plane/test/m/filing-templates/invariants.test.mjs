/* filing-templates: its invariants (R16, R17, R18, R22, R23), the migration from filings (K927) and the ops map, at the
   module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, world, draft, approved, V, MACHINE, TEST, TEXT, sha, secret } from "./fixture.mjs";
import * as ft from "../../../src/filing-templates/index.mjs";
import * as jurisdictions from "../../../../jurisdictions/index.mjs";
import { word, localize } from "../../../src/setup-words/index.mjs";

const A = V("alice"), B = V("bob"), F = V("frank");

test("R16 every name in attribution is held by value beside its id: a later change of handle leaves the history reading as it was", () => {
  const w = seeded();
  const a = approved(w);
  w.ft.templateComment({ template: a.template, version: a.version, text: "c", author: F, viewer: F });
  w.st.sql.exec(`UPDATE members SET handle='renamed_' || member_id WHERE member_id IN ('alice','bob','frank')`);
  const v = w.ft.templateRead({ template: a.template, viewer: A }).version;
  assert.deepEqual(v.author, { id: "alice", name: "h_alice" });
  assert.deepEqual(v.contributors[0], { kind: "member", member: "alice", name: "h_alice", at: "2026-10-01T12:00:00Z" });
  assert.deepEqual(v.approved.by, { id: "bob", name: "h_bob" });
  assert.deepEqual(v.reviewers[0].asked_by, { id: "alice", name: "h_alice" });
  assert.deepEqual(v.reviews[0].reviewer.name, "Pat Lawyer");
  assert.equal(v.reviews[0].reviewer.organisation, "Legal Aid (test)");
  assert.deepEqual(w.ft.templateComments({ template: a.template, viewer: A }).comments[0].by, { kind: "member", id: "frank", name: "h_frank" });
  /* a new act takes the name at its own time */
  const two = w.ft.templateDraft({ template: a.template, text: "x {{group}}", author: A, viewer: A });
  assert.deepEqual(w.ft.templateRead({ template: a.template, version: two.version, viewer: A }).version.author, { id: "alice", name: "renamed_alice" });
});

test("R17 nothing is deleted or rewritten: every act appends to this module's own tables, each declared to purge, cleared with its project's bundle", () => {
  const w = seeded();
  const rowsOf = () => Object.fromEntries(ft.FILING_TEMPLATES_TABLES.map((t) => [t, w.rows(`SELECT * FROM ${t}`).map((r) => JSON.stringify(r))]));
  let was = rowsOf();
  const step = (fn) => { fn(); const now = rowsOf();
    for (const t of ft.FILING_TEMPLATES_TABLES) assert.deepEqual(now[t].slice(0, was[t].length), was[t], `${t}: earlier rows unchanged`);
    was = now; };
  let d, g;
  step(() => { d = draft(w, { notes: "n" }); });
  step(() => w.ft.templateRevise({ version: d.version, text: "r {{group}}", notes: "n2", author: B, viewer: B }));
  step(() => w.ft.templatePropose({ template: d.template, text: "p {{group}}", why: "w", proposer: MACHINE, viewer: MACHINE }));
  step(() => { g = w.ft.templateReviewGrant({ version: d.version, recipient: "R", organisation: "O", secretSha: secret("s"), by: A, viewer: A }); });
  step(() => w.ft.templateSubmit({ version: d.version, reviewers: ["frank"], author: A, viewer: A }));
  step(() => w.ft.templateReview({ outcome: "no_concerns", scope: "s", secretSha: secret("s") }));
  step(() => w.ft.templateComment({ template: d.template, version: d.version, text: "c", note: true, author: A, viewer: A }));
  step(() => w.ft.templateGrantRevoke({ grant: g.grant, by: A, viewer: A }));
  step(() => w.ft.templateApprove({ version: d.version, by: B, viewer: B }));
  w.join(w.P, "erin", "invited"); /* D54: an administrator sees the hidden P's template only once invited or joined */
  step(() => assert.equal(w.ft.templateApprove({ version: d.version, widen: true, by: V("erin"), viewer: V("erin") }).ok, true));
  step(() => { const two = w.ft.templateDraft({ template: d.template, text: "two {{group}}", author: A, viewer: A });
               w.ft.templateRetire({ template: d.template, version: two.version, reason: "r", by: A, viewer: A }); });
  step(() => assert.equal(w.ft.templateRetire({ template: d.template, reason: "r", by: V("erin"), viewer: V("erin") }).ok, true));
  for (const t of ft.FILING_TEMPLATES_TABLES) assert.ok(w.count(t) > 0, `${t} written`);
  /* declared to purge: every table, owned here; a purge of the project's bundle clears its rows, another's stay */
  assert.equal(w.record.declarePurge("x", ["tpl_templates"]).reason, "TABLE_DECLARED");
  for (const t of ft.FILING_TEMPLATES_TABLES) assert.equal(ft.filingTemplatesOwns(t), true);
  w.join(w.Q, "dave", "joined", true);
  w.ft.templateDraft({ project: w.Q, kind: "records_request", use: "file", profiles: [TEST], name: "Q", text: TEXT, author: V("dave"), viewer: V("dave") });
  w.record.purge({ bundleId: w.P });
  for (const t of ft.FILING_TEMPLATES_TABLES) assert.equal(w.rows(`SELECT 1 FROM ${t} WHERE bundle_id=?`, w.P).length, 0, t);
  assert.equal(w.rows(`SELECT 1 FROM tpl_templates WHERE bundle_id=?`, w.Q).length, 1);
  w.record.purge({});
  for (const t of ft.FILING_TEMPLATES_TABLES) assert.equal(w.count(t), 0, t);
});

test("R18 no place, law, venue or template wording is in the module's behaviour or outward text: its answers carry only what the active profile supplies; its tests use the test profile", () => {
  /* every place the held profiles name, read from the profiles themselves, appears in no file of the module */
  const names = new Set();
  for (const { id } of jurisdictions.list()) {
    const p = jurisdictions.get(id);
    for (const c of p.covers) names.add(c);
    for (const k of p.counterparties || []) names.add(k.body);
    for (const k of p.action_kinds || []) {
      if (k.venue) names.add(k.venue.name);
      for (const t of [k.template, ...(k.templates || [])]) if (t) { names.add(t.text); if (t.name) names.add(t.name); }
    }
    for (const l of p.records_laws || []) names.add(l.name);
  }
  /* no answer, refusal or row names one, except what the active (test) profile itself supplies */
  const w = seeded();
  const d = draft(w);
  const out = JSON.stringify([w.ft.templatesFor({ viewer: A }), approved(w, { name: "Other" }), w.ft.templateRead({ template: d.template, viewer: A }),
    ft.FILING_TEMPLATE_CHECKS, ft.FILING_BLANKS, ft.noTemplateGrant(), w.ft.templateDraft({ author: MACHINE }),
    w.ft.templateApprove({ version: d.version, by: A, viewer: A }), w.ft.offeredVersion({ template: d.template, viewer: A })]);
  const own = new Set(jurisdictions.get(TEST).action_kinds.flatMap((k) => [k.label, k.template && k.template.text,
    ...(k.templates || []).flatMap((t) => [t.text, t.name])]));
  for (const n of names) if (n && n.length > 3 && !own.has(n)) assert.ok(!out.includes(n), n);
  /* with no profile active, nothing local at all */
  const bare = seeded({ profiles: [] });
  const out2 = JSON.stringify([bare.ft.templatesFor({ viewer: A }), approved(bare, { profiles: "general" })]);
  for (const n of names) if (n && n.length > 3) assert.ok(!out2.includes(n), n);
});

test("R22 a machine writes only a proposal and a labelled comment: it never drafts, revises, submits, grants, reviews, approves, widens, retires or withdraws", () => {
  const w = seeded();
  const d = draft(w);
  w.ft.templateReviewGrant({ version: d.version, recipient: "R", organisation: "O", secretSha: secret("m"), by: A, viewer: A });
  const g = w.rows(`SELECT grant_id FROM tpl_grants`)[0].grant_id;
  const M = { viewer: MACHINE };
  for (const who of [MACHINE, "token:agent", "class:daemon", "daemon"]) {
    const before = w.snapshot();
    const answers = [
      w.ft.templateDraft({ project: w.P, kind: "records_request", use: "file", profiles: [TEST], name: "m", text: TEXT, author: who, ...M }),
      w.ft.templateRevise({ version: d.version, text: TEXT, author: who, ...M }),
      w.ft.templateSubmit({ version: d.version, reviewers: ["bob"], author: who, ...M }),
      w.ft.templateReviewGrant({ version: d.version, recipient: "R", organisation: "O", secretSha: secret(who), by: who, ...M }),
      w.ft.templateGrantRevoke({ grant: g, by: who, ...M }),
      w.ft.templateReview({ version: d.version, outcome: "no_concerns", scope: "s", author: who, ...M }),
      w.ft.templateApprove({ version: d.version, by: who, ...M }),
      w.ft.templateApprove({ version: d.version, widen: true, by: who, ...M }),
      w.ft.templateRetire({ template: d.template, reason: "r", by: who, ...M }),
      w.ft.templateRetire({ template: d.template, version: d.version, reason: "r", by: who, ...M }),
    ];
    assert.deepEqual(answers.map((r) => r.reason), ["MACHINE_CANNOT_DRAFT_TEMPLATE", "MACHINE_CANNOT_DRAFT_TEMPLATE", "MACHINE_CANNOT_DRAFT_TEMPLATE",
      "MACHINE_CANNOT_DRAFT_TEMPLATE", "MACHINE_CANNOT_DRAFT_TEMPLATE", "MACHINE_CANNOT_REVIEW_TEMPLATE", "MACHINE_CANNOT_APPROVE_TEMPLATE",
      "MACHINE_CANNOT_APPROVE_TEMPLATE", "MACHINE_CANNOT_APPROVE_TEMPLATE", "MACHINE_CANNOT_APPROVE_TEMPLATE"], who);
    assert.deepEqual(w.snapshot(), before, `${who}: nothing written`);
    /* what it may write, labelled as machine work */
    const p = w.ft.templatePropose({ template: d.template, text: "m {{group}}", why: "w", proposer: who, ...M });
    assert.equal(p.proposal.label.machine_work, true);
    const c = w.ft.templateComment({ template: d.template, version: d.version, text: "critique", author: who, ...M });
    assert.deepEqual([c.ok, c.comment.by.kind, c.comment.by.label.machine_work], [true, "run", true]);
    /* and a machine's comment is never a note */
    assert.equal(w.ft.templateComment({ template: d.template, version: d.version, text: "n", note: true, author: who, ...M }).reason, "TEMPLATE_SCOPE_REFUSED");
  }
});

test("R23 each refusal carries its row {check, where, translation} from this module's table: C-115.31–.33, .35–.38 moved with their numbers (.31 and .36 re-keyed), R26's C-115.45 and .46, R33's C-115.47, every other code a C-125 row; each where names a site of this module", () => {
  const rows = ft.FILING_TEMPLATE_CHECKS;
  const moved = { MACHINE_CANNOT_DRAFT_TEMPLATE: "C-115.31", TEMPLATE_NAME_REFUSED: "C-115.32", TEMPLATE_KIND_REFUSED: "C-115.33",
                  TEMPLATE_TEXT_REFUSED: "C-115.35", TEMPLATE_TIER3_FILE: "C-115.36", TEMPLATE_NAME_TAKEN: "C-115.37", NO_SUCH_TEMPLATE: "C-115.38",
                  /* R26 (N702), numbered by R26 in the C-115 family */
                  TEMPLATE_REF_REFUSED: "C-115.45", TEMPLATE_NAME_AMBIGUOUS: "C-115.46",
                  /* R33 (T48), moved from filings with its number */
                  RFC_QUOTING_MISSING: "C-115.47" };
  for (const [c, n] of Object.entries(moved)) assert.equal(rows[c].check, n, c);
  /* R26's rows, their translations as BOB worded them */
  assert.equal(rows.TEMPLATE_REF_REFUSED.translation, word("refusal.TEMPLATE_REF_REFUSED"));
  assert.equal(rows.TEMPLATE_NAME_AMBIGUOUS.translation, word("refusal.TEMPLATE_NAME_AMBIGUOUS"));
  const fresh = Object.entries(rows).filter(([c]) => !(c in moved));
  assert.deepEqual(fresh.map(([, r]) => r.check), fresh.map((_, i) => `C-125.${i + 1}`), "C-125, numbered in order, no gap");
  assert.equal(new Set(Object.values(rows).map((r) => r.check)).size, Object.keys(rows).length, "no number twice");
  for (const [c, r] of Object.entries(rows)) {
    assert.ok(typeof r.translation === "string" && r.translation.length > 20, c);
    assert.match(r.where, /^src\/filing-templates\/index\.mjs \S+ > is-[a-z-]+$/, `${c}: names a site of this module`);
  }
  /* every refusal answered carries code, check and translation equal to its row */
  const w = seeded();
  const answers = [w.ft.templateDraft({ author: MACHINE }), w.ft.templateRead({ template: "TPL-2026-0000", viewer: A }),
    w.ft.templatesFor({ state: "x", viewer: A }), w.ft.offeredVersion({ template: draft(w).template, viewer: A }), ft.noTemplateGrant(),
    w.ft.templatePropose({ proposer: "" }), w.ft.templateGrantRevoke({ grant: "x", by: A, viewer: A }),
    w.ft.offeredVersion({ viewer: A }), w.ft.offeredVersion({ name: "bad", viewer: A })];
  for (const r of answers) assert.deepEqual([r.code, r.check, r.translation], [r.reason, rows[r.reason].check, rows[r.reason].translation], r.reason);
  /* the moved rows' renamed codes are not filings' old ones */
  assert.equal(rows.MACHINE_CANNOT_SAVE_TEMPLATE, undefined);
  assert.equal(rows.TEMPLATE_KIND_TIER3, undefined);
});

test("K927 the migration takes each template filings R26 saved as a draft of origin group, never approved: author its saver, derived_from its filing draft, a carried note; idempotent", () => {
  const before = (w) => {
    for (const m of ["alice", "bob"]) w.member(m);
    w.P = w.project("budget", "alice");
    w.st.db.exec(`CREATE TABLE filing_templates (template_id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, kind TEXT, text TEXT NOT NULL,
                  from_filing TEXT NOT NULL, action_id TEXT NOT NULL, basis TEXT NOT NULL, author TEXT NOT NULL, at TEXT NOT NULL)`);
    const ins = (id, name, kind, project) => w.st.sql.exec(`INSERT INTO filing_templates VALUES (?,?,?,?,?,?,?,?,?)`, id, name, kind,
      `Kept {{group}} ${name}`, `FIL-2026-000${id.slice(-1)}`, "ACTN-2026-0001-a", JSON.stringify({ project }), V("alice"), "2026-09-20T10:00:00Z");
    ins("TPL-2026-0001", "Kept one", "records_request", null);
    ins("TPL-2026-0002", "Kept two", null, null);
    w.st.sql.exec(`UPDATE filing_templates SET basis=? WHERE template_id='TPL-2026-0001'`, JSON.stringify({ project: w.P }));
  };
  const w = world({ before });
  const rows = w.rows(`SELECT * FROM tpl_templates ORDER BY migrated_from`);
  assert.deepEqual(rows.map((r) => [r.migrated_from, r.origin, r.kind, r.use, r.profiles, r.project, r.bundle_id]), [
    ["TPL-2026-0001", "group", "records_request", "file", "general", w.P, w.P],
    ["TPL-2026-0002", "group", null, "file", "general", null, "ACTN-2026-0001-a"]]);
  for (const r of rows) assert.ok(!["TPL-2026-0001", "TPL-2026-0002"].includes(r.template_id), "a new opaque id");
  const t = w.ft.templateRead({ template: rows[0].template_id, viewer: A });
  assert.deepEqual([t.version.state, t.offered, t.version.author, t.version.derived_from, t.version.notes.text, t.version.notes.carried],
                   ["draft", false, { id: "alice", name: "h_alice" }, { filing: "FIL-2026-0001", sha: sha("Kept {{group}} Kept one") },
                    ft.MIGRATED_NOTE, true]);
  assert.deepEqual(w.ft.templatesFor({ viewer: A }).templates.filter((x) => x.origin === "group"), [], "not offered");
  /* idempotent: a second run, or a second boot, adds nothing */
  assert.deepEqual(w.ft.migrateFromFilings(), { migrated: 0 });
  assert.equal(w.count("tpl_templates"), 2);
  /* it goes on through review and approval like any draft */
  w.join(w.P, "bob", "joined", true);
  w.ft.templateSubmit({ version: `${rows[0].template_id}@1`, reviewers: ["bob"], author: A, viewer: A });
  w.ft.templateReview({ version: `${rows[0].template_id}@1`, outcome: "no_concerns", scope: "s", author: B, viewer: B });
  assert.equal(w.ft.templateApprove({ version: `${rows[0].template_id}@1`, reason: "kept before", by: B, viewer: B }).ok, true);
  /* filings' table is read, never written */
  assert.equal(w.count("filing_templates"), 2);
  /* with no filings table, nothing */
  assert.deepEqual(seeded().ft.migrateFromFilings(), { migrated: 0 });
});

test("the ops map: each op reads the control plane's stamps author and viewer from the query, never the body, and secretSha from the body, never the query (R27); a filing source through templatedraft is refused", () => {
  const w = seeded();
  const op = (name, query, body = {}) => {
    const url = new URL(`https://plane.example/op?${new URLSearchParams(query)}`);
    return ft.filingTemplatesOps(w.ft, url, body)[name]();
  };
  /* the map's keys are counted and spot-read, never hand-listed (K3268): each key is an op served by a function of the module */
  const served = ft.filingTemplatesOps(w.ft, new URL("https://x.example/"), {});
  assert.equal(Object.keys(served).length, 14);
  for (const k of ["templatedraft", "templates", "templatebyhandle"]) assert.equal(typeof served[k], "function", k);
  for (const [k, fn] of Object.entries(served)) assert.ok(typeof fn === "function" && /^[a-z]+$/.test(k), k);
  const d = op("templatedraft", { author: A, viewer: A }, { project: w.P, kind: "records_request", use: "file", profiles: [TEST],
                                                           name: "Op", text: TEXT, author: MACHINE });
  assert.equal(d.ok, true, JSON.stringify(d));
  assert.equal(op("templatedraft", { author: MACHINE, viewer: MACHINE }, { author: A }).reason, "MACHINE_CANNOT_DRAFT_TEMPLATE",
               "the body's author is never honoured");
  assert.equal(op("templatedraft", { author: A, viewer: A }, { project: w.P, kind: "records_request", use: "file", profiles: [TEST],
                                                              name: "F", text: TEXT, from: { filing: "FIL-1", sha: sha(TEXT) } }).reason, "TEMPLATE_FROM_REFUSED");
  assert.equal(op("templaterevise", { author: B, viewer: B }, { version: d.version, text: "r {{group}}" }).ok, true);
  /* R27: the grant's digest is read from the body only; the query's is never read */
  assert.equal(op("templatereviewgrant", { author: A, viewer: A, secretSha: secret("query") }, { version: d.version, recipient: "R", organisation: "O",
                                                                                              secretSha: secret("o") }).ok, true);
  assert.equal(op("templatesubmit", { author: A, viewer: A }, { version: d.version, reviewers: ["frank"] }).ok, true);
  assert.equal(op("templatereview", { secretSha: secret("query") }, { outcome: "no_concerns", scope: "s", secretSha: secret("o") }).ok, true);
  assert.equal(op("templatereview", { secretSha: secret("o") }, { outcome: "no_concerns", scope: "s" }).reason, "MACHINE_CANNOT_REVIEW_TEMPLATE",
               "a live digest in the query alone opens no door: answered as a call carrying none");
  assert.equal(op("templateapprove", { author: B, viewer: B }, { version: d.version }).ok, true);
  assert.equal(op("templates", { viewer: A }).templates[0].id, d.template);
  assert.equal(op("templateread", { viewer: A, template: d.template }).version.id, d.version);
  assert.equal(op("templatecomment", { author: A, viewer: A }, { template: d.template, version: d.version, text: "c" }).ok, true);
  assert.equal(op("templatecomments", { viewer: A, template: d.template }).comments.length, 1);
  assert.equal(op("templatepropose", { author: MACHINE, viewer: MACHINE }, { kind: "records_request", text: "p {{law}}", why: "w" }).ok, true);
  const g = w.rows(`SELECT grant_id FROM tpl_grants`)[0].grant_id;
  assert.equal(op("templategrantrevoke", { author: A, viewer: A }, { grant: g }).existed, false);
  assert.equal(op("templateretire", { author: A, viewer: A }, { template: d.template, reason: "r" }).ok, true);
});

test("R23 (DEC-149) a member reads the group's Civicsmith by its name: C-125.3 TEMPLATE_PROFILE_UNKNOWN and C-125.15 GRANT_NO_SECRET say \"your group's Civicsmith\", and no row's translation or answered refusal calls it this or the instance, copy or plane", () => {
  const rows = ft.FILING_TEMPLATE_CHECKS;
  assert.equal(rows.TEMPLATE_PROFILE_UNKNOWN.translation, word("refusal.TEMPLATE_PROFILE_UNKNOWN"));
  assert.equal(rows.GRANT_NO_SECRET.translation, word("refusal.GRANT_NO_SECRET"));
  const old = /\b(this|the|your|our)\s+(control\s+)?(instance|copy|plane)\b/i;
  for (const [c, r] of Object.entries(rows)) assert.doesNotMatch(r.translation, old, c);
  /* as answered: each changed refusal carries its new translation, and its detail names no instance, copy or plane */
  const w = seeded();
  const p = w.ft.templateDraft({ project: w.P, kind: "records_request", use: "file", profiles: ["nowhere"], name: "N", text: TEXT,
                                 author: A, viewer: A });
  const d = draft(w);
  const g = w.ft.templateReviewGrant({ version: d.version, recipient: "R", organisation: "O", secretSha: "", by: A, viewer: A });
  assert.deepEqual([p.reason, p.translation], ["TEMPLATE_PROFILE_UNKNOWN", rows.TEMPLATE_PROFILE_UNKNOWN.translation]);
  assert.deepEqual([g.reason, g.translation], ["GRANT_NO_SECRET", rows.GRANT_NO_SECRET.translation]);
  assert.equal(g.detail, localize("filing-templates.index.no_fresh_secret_digest_was_stamped_for_this_grant", "no fresh secret digest was stamped for this grant: your team's Civicsmith makes the secret"));
  for (const r of [p, g, ft.noTemplateGrant()]) assert.doesNotMatch(JSON.stringify(r), old, r.reason);
});

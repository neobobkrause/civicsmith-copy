/* contradiction's test fixture: a Durable Object storage stand-in over node:sqlite (`sql.exec`, `transactionSync`
   nesting as savepoints) with the real modules contradiction uses — record-core (`bundles`, purge, `transact`),
   membership (the sight rule, participation, facts), promotion (the one write path, with this module's check
   registered), extraction (`readings` and `readingOf`), content (`content`), entities (`resolutions`,
   `reportResolutionDefect`) and inquiry (its tables, its grammar and projection, `contradictionLink`,
   `inquiryOfCandidate`, R46–R48). `basis-versions`' reads (`projectsDrawingOn`, `conclusionOf`, `projectQuestions`) and
   its no-project `conclude` are a stand-in the test controls, built from its stated interface (its R16–R19, R22, R37,
   R41): a question concluded through it is promoted through the real promotion, so inquiry's grammar judges the
   resolution. A run gate stands in for ai-runs' (R21). Every test drives `contradiction` at its interface. The
   version tables are basis-versions' own (its migrate), rows laid down by hand with the columns its read contract
   names (R38 there). T33-48: the real `events` (a capture's own dates, its `datedFactsFor`) and the real `money` (its
   facts, read contract R19, and `reconcile`); a document's own date and a money fact are laid down as rows of their
   owners' tables, which those modules then read and judge. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { inquiryOf } from "../../../src/inquiry/index.mjs";
import { migrateBasisVersions } from "../../../src/basis-versions/schema.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/frontmatter.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { moneyOf } from "../../../src/money/index.mjs";
import { contradictionOf, inquiryServices } from "../../../src/contradiction/index.mjs";
import { noSelection } from "../retrieval/fixtures.mjs";
import { concludeAct } from "../basis-versions/fixtures.mjs";

export const sha = (s) => createHash("sha256").update(String(s)).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export const MACHINE = "class:admin";
export const MEMBER = "member:m1";
export const OUTSIDER = "member:outsider";
export const NOW = "2026-09-28T00:00:00Z";

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  return {
    db,
    sql: { exec(q, ...args) {
      const st = db.prepare(q);
      return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
    } },
    transactionSync(fn) {
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    },
  };
}


/** A fresh record with the modules above and contradiction over it. `gate: false` registers no run gate. */
export function world({ gate = true, now = null, strictConclude = false } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now: NOW };
  const tick = () => clock.now;
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: tick });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  promotion.registerFact("caseMember", "publication", () => false);
  promotion.registerFact("publishedRegistry", "publication", () => null);
  /* provenance and connections are not contradiction's uses: inquiry, content and entities receive stand-ins answering
     that the record holds no capture history and no theme or severed edge, which none of these tests exercises. */
  /* provenance's `register` and connections' `refs`, as inquiry reads them (empty: no capture registered, no edge) */
  st.sql.exec(`CREATE TABLE IF NOT EXISTS register (bundle_id TEXT, capture_sha TEXT, authored INTEGER DEFAULT 0)`);
  st.sql.exec(`CREATE TABLE IF NOT EXISTS refs (bundle_id TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '',
               PRIMARY KEY (bundle_id, target_id, kind))`);
  const prov = { capturesOf: () => [], originOf: () => null, versionChain: () => null, capturedLocators: () => [],
                 captureGrade: () => ({ determined: false, basis: "CAPTURE_ROUTE_UNRECORDED" }),
                 recordReceipt: () => ({ ok: true }) };
  const x = extractionOf(host, { record, membership, calibration: { onCalibration() { return { ok: true }; } } });
  x.migrate();
  const content = contentOf(host, { record, membership, provenance: prov, extraction: x, now: tick });
  content.migrate();
  const entities = entitiesOf(host, { record, membership, provenance: prov, now: tick });
  entities.migrate();
  const connections = { themeLegFindings: () => [], edgeSevered: () => false, portionGrades: () => ({}), portionAxes: () => ({}) };
  const k = inquiryOf(host, { record, membership, promotion, content, connections, entities, provenance: prov,
                              retrieval: { selectionResolve: noSelection().selectionResolve }, now: tick });
  k.migrate();
  migrateBasisVersions(st.sql);
  for (const [id, cover] of [["m1", "Cover m1"], ["m2", "Cover m2"], ["m3", "Cover m3"], ["outsider", "Cover outsider"]])
    st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                 VALUES (?, ?, ?, 'member', 'active', '["contribute"]', 't', 't')`, id, cover, `h_${id}`);

  /* basis-versions' reads and its no-project conclude, as a stand-in built from its stated interface. */
  const drawing = new Map();      /* inquiry -> [project ids] */
  const stances = new Map();      /* `${project}|${inquiry}` -> {claim, version} */
  const bv = {
    concludeCalls: [], concludeRefusal: null, accepted: new Set(),      /* `${inquiry}|${version}` named accepted */
    projectsDrawingOn(inq, viewer) {
      const all = (drawing.get(inq) || []).filter((p) => membership.inSight(p, viewer)).sort();
      const out = all.slice(0, 32).map((id) => ({ id, title: `title of ${id}`, current: null }));
      out.bound = 32; out.truncated = all.length > 32;
      return out;
    },
    conclusionOf(p, inq, viewer) {
      if (!membership.inSight(p, viewer)) return null;
      const s = stances.get(`${p}|${inq}`);
      return s ? { project: p, inquiry: inq, relationship: "project", act: "concluded", state: "concluded",
                   version: s.version, claim: s.claim } : null;
    },
    projectQuestions({ project }) {
      const items = [...drawing.entries()].filter(([, ps]) => ps.includes(project)).map(([inq]) => inq).sort()
        .map((inquiry) => ({ inquiry, legs: true, stance: stances.has(`${project}|${inquiry}`) ? "concluded" : "none" }));
      return { items, cursor: null };
    },
    conclude(args) {
      bv.concludeCalls.push(args);
      if (bv.concludeRefusal) return bv.concludeRefusal;
      /* With `strictConclude`: R16's no-project arms in its order, and R51's one-act path (a `reading` takes the place of a
         named `version`, 12 to 500 characters), as basis-versions answers them. Off, it concludes whatever it is given
         (the stand-in other modules' tests were written against). Every answer is basis-versions' published one
         (`concludeAct`: concluded, no_conclusion, bad_reading, adopted, no_claim), the target this question's. */
      const concl = String(args.conclusion ?? "").trim(), vname = String(args.version ?? "").trim();
      const hasReading = args.reading !== undefined && args.reading !== null;
      const own = hasReading ? String(args.reading).trim() : "";
      if (strictConclude) {
        if (!concl && !hasReading) return concludeAct({ kind: "no_conclusion", target: args.target });
        if (hasReading && (own.length < 12 || own.length > 500 || vname))
          return concludeAct({ kind: "bad_reading", target: args.target });
        if (!hasReading && (!vname || !bv.accepted.has(`${args.target}|${vname}`)))
          return concludeAct({ kind: "no_claim", target: args.target });
      }
      const md = record.readFile(args.target, "bundle.md");
      const head = record.head(args.target);
      let text = md.text.replace(/^current_state: .*$/m, "current_state: concluded")
                        .replace(/^prior_state: .*$/m, `prior_state: ${head.currentState}`);
      text = text.replace(/\n---\n/, `\nconclusion: "${concl || own}"\nfalsifier: "${args.falsifier || "a record showing otherwise"}"\n---\n`);
      const r = promotion.promote({ bundleId: args.target, base: head.bundleSha, snapKey: `conclude${++n}`,
        author: args.author, files: [{ path: "bundle.md", text }], meta: { object_type: "inquiry" } });
      if (!r.ok) return r;
      return concludeAct({ kind: hasReading ? "concluded" : "adopted", target: args.target });
    },
  };
  let n = 0;
  /* events (a capture's own dates) and money (its facts and reconciliation), each the real module over this record. */
  const events = eventsOf(host, { record, membership, extraction: x, content, entities, provenance: prov,
                                  readHooks: { onRead: () => ({ ok: true }) }, now: tick });
  events.migrate();
  const money = moneyOf(host, { record, membership, entities, provenance: prov, events, lines: null, now: tick });
  money.migrate();
  const c = contradictionOf(host, { record, extraction: x, membership, promotion, entities, basisVersions: bv, events, money, content,
                                    inquiry: inquiryServices(host), now: now || (() => clock.now) });
  c.migrate();
  /* The runs the stand-in gate answers for: {status, principal, hidden}. */
  const runs = new Map();
  const gateCalls = [];
  if (gate) c.registerRunGate("test", (id, viewer, caller) => {
    gateCalls.push({ run: id, viewer, caller });
    const r = runs.get(id);
    if (!r || r.hidden) return { found: false, running: false, refusal: null };
    return { found: true, running: r.status === "running",
             refusal: caller === r.principal ? null
               : { ok: false, reason: "AI_RUN_NOT_PRINCIPAL", code: "AI_RUN_NOT_PRINCIPAL", check: "C-22.12",
                   translation: "not the run's principal", detail: "proposing is the principal's act" } };
  });
  const w = {
    st, host, record, membership, promotion, x, content, entities, k, c, bv, runs, gateCalls, clock, drawing, stances, events, money,
    rows: (q, ...a) => st.sql.exec(q, ...a), one: (q, ...a) => st.sql.exec(q, ...a)[0] || null,
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    text: (id) => record.readFile(id, "bundle.md")?.text ?? null,
    fm: (id) => { const t = record.readFile(id, "bundle.md")?.text; return t ? parseFrontmatter(t).data : null; },
    bundle(id, { type = "information", subject = null } = {}) {
      st.sql.exec(`INSERT OR IGNORE INTO bundles (bundle_id, object_type, group_id, title, current_state, created, last_updated, bundle_sha, row_version)
                   VALUES (?, ?, 'g', ?, 'collected', '2026-01-01', '2026-01-01', 'x', 1)`, id, type, `title of ${id}`);
      /* The subject entity is inquiry's, in its `inquiry_bundle_facts` (its R40, N136); a bundle with no row has none. */
      if (subject !== null)
        st.sql.exec(`INSERT INTO inquiry_bundle_facts (bundle_id, inquiry_subject_entity) VALUES (?, ?)
                     ON CONFLICT(bundle_id) DO UPDATE SET inquiry_subject_entity = excluded.inquiry_subject_entity`, id, subject);
      return id;
    },
    /* An inquiry bundle; `project: true` makes it a project-typed bundle m1 takes part in, the one kind membership
       withholds from a non-participant (R43). */
    inquiry(id, { subject = null, project = false } = {}) {
      w.bundle(id, { type: project ? "project" : "inquiry", subject });
      if (project) w.participant(id, "m1", { owner: 1 });
      return id;
    },
    /* A project bundle with its participants (membership's roster), each `{id, state?, owner?}`. */
    project(id, members = [], { visibility = null } = {}) {
      w.bundle(id, { type: "project" });
      for (const m of members) w.participant(id, typeof m === "string" ? m : m.id, typeof m === "string" ? {} : m);
      if (visibility) {
        st.sql.exec(`INSERT INTO project_visibility (project_id, setting, reason, set_by, at) VALUES (?, ?, 'r', 'm1', '2026-01-01')`, id, visibility);
        st.sql.exec(`INSERT OR REPLACE INTO project_sight (project_id, setting) VALUES (?, ?)`, id, visibility);   /* membership's sight index */
      }
      return id;
    },
    participant(projectId, memberId, { state = "joined", owner = 0 } = {}) {
      st.sql.exec(`INSERT OR IGNORE INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, ?, ?, '2026-01-01', '2026-01-01')`, projectId, memberId, state, owner);
    },
    /* A content row over `capture` filed in `bundleId` (content R45's columns); `extent` the canonical extent it holds. */
    content(contentId, capture, bundleId, { ref = `ref of ${contentId}`, kind = "pdf-page", stale = 0, extent = "{}" } = {}) {
      w.bundle(bundleId);
      st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at, stale)
                   VALUES (?, ?, ?, ?, ?, ?, 'plane', '2026-01-01', ?)`, contentId, capture, bundleId, kind, extent, ref, stale);
      return contentId;
    },
    leg(inquiry, ord, role, { content = null, target = "INFO-2026-0001", note = null } = {}) {
      st.sql.exec(`INSERT INTO inquiry_basis (bundle_id, ord, target_id, target_type, role, note, content_id)
                   VALUES (?, ?, ?, 'information', ?, ?, ?)`, inquiry, ord, target, role, note, content);
    },
    version(inquiry, name, { state = "accepted", hidden = 0, claim = "a claim" } = {}) {
      const ord = w.one(`SELECT COUNT(*) AS n FROM inquiry_basis_versions WHERE bundle_id=?`, inquiry).n;
      st.sql.exec(`INSERT INTO inquiry_basis_versions (bundle_id, name, ord, description, relationship, state, hidden, claim, composition)
                   VALUES (?, ?, ?, 'd', 'and', ?, ?, ?, 'c')`, inquiry, name, ord, state, hidden, claim);
    },
    versionLeg(inquiry, name, ord, { content = null, target = "INFO-2026-0001", type = "information" } = {}) {
      st.sql.exec(`INSERT INTO inquiry_basis_version_legs (bundle_id, name, ord, target_id, target_type, role, ground, content_id)
                   VALUES (?, ?, ?, ?, ?, 'supports', '', ?)`, inquiry, name, ord, target, type, content);
    },
    /* A reading of `capture` (extraction's table): `contentType` its doctype, `date` its top-level date. A stated date is
       also held by `events` as the document's own (a dated fact, its R1, R4: what its after-read hook holds), at day
       precision in UTC unless `precision` or `zone` say otherwise; `dated: false` leaves the reading's date unheld. */
    reading(capture, bundleId, { contentType = null, date = null, dated = true, precision = "day", zone = "UTC" } = {}) {
      w.bundle(bundleId);
      const reading = { content_type: contentType, found: true, ...(date == null ? {} : { date }) };
      st.sql.exec(`INSERT OR REPLACE INTO readings (capture_sha, bundle_id, content_type, reading) VALUES (?, ?, ?, ?)`,
                  capture, bundleId, contentType, JSON.stringify(reading));
      if (date != null && dated) w.dated(capture, bundleId, date, { precision, zone });
    },
    /* A document's own date as `events` holds it (its `dated_facts`, keyed by the capture in lower case as events reads
       it; the reader's method). */
    dated(capture, bundleId, value, { precision = "day", zone = "UTC", kind = "issued", upperBound = false, extent = null } = {}) {
      const id = `DF-${sha(`${capture}|${value}|${kind}|${extent ?? ""}`).slice(0, 16)}`;
      st.sql.exec(`INSERT OR IGNORE INTO dated_facts (dated_fact_id, capture_sha, bundle_id, extent, kind, value, precision, zone,
                     method, grade, upper_bound, by_actor, at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'reader', 'B', ?, 'class:daemon', ?)`,
                  id, String(capture).toLowerCase(), bundleId, JSON.stringify(extent ?? { page: 1 }), kind, value, precision, zone, upperBound ? 1 : 0, NOW);
      return id;
    },
    /* A money fact as `money` holds it (its read contract, R19, and the columns its reads take): `from` and `to` the
       payer and payee entities, `period` {from, to} days in UTC, `amount` signed exact decimal text (or `low`/`high`
       for a range), the source a content row filed in `bundle`. */
    fact(id, { from = "E-PAYER", to = "E-PAYEE", kind = "payment", phase = "actual", stage = "paid", basis = "cash",
               amount = "100", precision = "exact", low = null, high = null, currency = "USD", period = { from: "2026-01-01", to: "2026-12-31" },
               bundle = "INFO-2026-0901", content = null, capture = null, withdrawn = false } = {}) {
      w.bundle(bundle);
      const cap = capture ?? sha(`cap ${id}`);
      if (content) w.content(content, cap, bundle);
      const instant = (d, end) => (d == null ? null : end ? new Date(Date.parse(`${d}T00:00:00Z`) + 86400000).toISOString().replace(/\.\d{3}Z$/, "Z") : `${d}T00:00:00Z`);
      st.sql.exec(`INSERT INTO money_facts (fact_id, amount, amount_low, amount_high, sign, precision, as_read, currency, kind, phase,
                     stage, basis, period_from, period_to, period_precision, period_zone, period_start, period_end,
                     from_entity, to_entity, source_capture_sha, source_extent, source_content_id, method, grade_reading, by, at,
                     sight_bundle, withdrawn_at)
                   VALUES (?, ?, ?, ?, '+', ?, ?, ?, ?, ?, ?, ?, ?, ?, 'day', 'UTC', ?, ?, ?, ?, ?, '{"page":1}', ?, 'typed', 'B', 'member:m1', ?, ?, ?)`,
                  id, precision === "range" ? null : amount, low, high, precision, precision === "range" ? `${low}–${high}` : amount, currency,
                  kind, phase, stage, basis, period.from, period.to ?? null, instant(period.from, false), instant(period.to, true),
                  from, to, cap, content, NOW, bundle, withdrawn ? NOW : null);
      if (withdrawn) st.sql.exec(`INSERT INTO money_withdrawals (fact_id, reason, by, at, sight_bundle) VALUES (?, 'r', 'member:m1', ?, ?)`, id, NOW, bundle);
      return id;
    },
    resolution(capture, bundleId, entity, { established = 1, ref = "ref:1" } = {}) {
      st.sql.exec(`INSERT INTO resolutions (capture_sha, bundle_id, ref, entity_id, grade, method, established)
                   VALUES (?, ?, ?, ?, ?, 'test', ?)`, capture, bundleId, ref, entity, established ? "A" : "C", established);
    },
    /* Projects drawing on an inquiry (basis-versions R37's stand-in), and a project's concluded stance (R22's). */
    draws(inquiry, ...projects) { drawing.set(inquiry, [...new Set([...(drawing.get(inquiry) || []), ...projects])]); },
    stance(project, inquiry, claim, version = "v1") { w.draws(inquiry, project); stances.set(`${project}|${inquiry}`, { claim, version }); },
  };
  return w;
}

/* A K4 world: entity E1, two cited passages of two captures resolving (established) to it, read as `a` and `b`. */
export function k4World(a = {}, b = {}, opts = {}) {
  const w = world(opts);
  w.inquiry("INQ-2026-0001");
  w.content("ca", "capA", "INFO-2026-0001");
  w.content("cb", "capB", "INFO-2026-0002");
  w.leg("INQ-2026-0001", 0, "supports", { content: "ca" });
  w.leg("INQ-2026-0001", 1, "supports", { content: "cb" });
  w.resolution("capA", "INFO-2026-0001", "E1");
  w.resolution("capB", "INFO-2026-0002", "E1");
  if (a !== null) w.reading("capA", "INFO-2026-0001", a);
  if (b !== null) w.reading("capB", "INFO-2026-0002", b);
  return w;
}

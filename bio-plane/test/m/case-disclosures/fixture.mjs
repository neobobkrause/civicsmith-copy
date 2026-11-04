/* case-disclosures over the modules it uses, each the real one (record-core, membership, promotion, provenance,
   attestation, capture, sources, extraction's tables, content, entities, events, lines, money, people, inquiry, strength,
   contradiction), on a real SQLite
   database (node:sqlite) standing in for a Durable Object's storage. Copied from case-authoring's fixture without
   `caseAuthoringOf` (N529, K1333) and without the modules case-disclosures does not use: what `case-authoring` would
   hand a service (`prepared`, `memberRoles`) the test builds as case-authoring R4 and R5 do. What a later module fills
   is a stand-in the test controls: the run gate `ai-runs` registers with contradiction (its R13; `runs`), and, unless
   a test asks for the real one, `case-import`'s reads (`importsStandIn`); the real one's checker is scripted at
   case-checker's R1 and its re-evaluation listener answered. `case-carriage`'s `photoMarks` (its R10; T37, N757) is a
   stand-in the test controls (`marksStandIn`): every capture is no photo unless a test marks it one, and (T39, N806) its
   `documentCopy` (its R16) answers every capture `public` (carried as captured) unless a test states another; with `realCarriage`
   (T38) the real `case-carriage` is composed on this host instead (`w.carriage`), its photo's original read from an
   evidence store stand-in keyed by digest (`w.evidence`), its copy held in a bucket stand-in, and `image-cover`'s
   `coverAreas` a stand-in the test scripts (`w.cover`), so its R10–R14 answer as they do; (T39) its member documents'
   copies (R15, R16) are derived by `copyBatch` over provenance R62 on this host, `doc-clean`'s `cleanDocument` a
   stand-in answering `clean` unless a test scripts its answer (`w.clean.answer`). (T41) `bias`'s `statementInForce` (its
   R49) is a stand-in the test controls (`lensStandIn`, `w.lens`): the statements in force, per scope, and every ask; it
   is bound to `inquiry` (its R61 asks it) and handed to case-disclosures (R30). `people` is handed a stand-in for `duties` (a person's
   duties are no read of this module's), and `entities` is built on the host directly, not reached through inquiry's
   instance (K1619). (T51; R33) `retrieval`'s `zone` (its R69) is a stand-in the test controls (`w.team.zone`, a Pacific zone
   unless a test sets another or null): the zone a photo's day is read in. Every test drives `case-disclosures` at its interface: its services, its renderers, its exports. */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { attestationOf } from "../../../src/attestation/index.mjs";
import { extractionOf } from "../../../src/extraction/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { inquiryOf, legCapped } from "../../../src/inquiry/index.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { contradictionOf } from "../../../src/contradiction/index.mjs";
import { captureOf } from "../../../src/capture/index.mjs";
import { sourcesOf } from "../../../src/sources/index.mjs";
import { parseImportedFindingRef, importedFindingRef } from "../../../src/inquiry-grammar/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";
import { caseImportOf } from "../../../src/case-import/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { linesOf } from "../../../src/lines/index.mjs";
import { moneyOf } from "../../../src/money/index.mjs";
import { peopleOf } from "../../../src/people/index.mjs";
import { caseDisclosuresOf } from "../../../src/case-disclosures/index.mjs";
import { caseCarriageOf, OBSCURED_LABEL, PUBLISHED_LABEL, COPY_CLEANED_LABEL } from "../../../src/case-carriage/index.mjs";
import { noSelection } from "../retrieval/fixtures.mjs";
import { importedWorld } from "../case-import/fixtures.mjs";

/* the refusals of two providers' reads, as their real code answers them: retrieval's `selectionResolve` over an empty store, and
   case-import's `importedCase` for an import that holds no such edition (taken from the providers' published fixtures) */
const NO_SELECTION = noSelection();
const REAL_IMPORTS = (await importedWorld()).ci;

export const sha = (s) => createHash("sha256").update(typeof s === "string" ? Buffer.from(s, "utf8") : s).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const st = db.prepare(q);
      return st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []);
    },
  };
  return {
    db, sql,
    transactionSync(fn) {
      const sp = `sp${n++}`;
      db.exec(`SAVEPOINT ${sp}`);
      try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
      catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
    },
  };
}

export const V = (id) => `member:${id}`;
export const NOW = "2026-09-28T01:00:00Z";
export const T0 = "2026-09-27T00:00:00Z";
export const ADMIN = "class:admin";

/** `deps` replaces any dependency the module is handed (a scripted one, or one that throws); `realImports` composes
 *  the real `case-import` in place of the stand-in. */
export function world({ group = "test-group", deps = {}, realImports = false, realCarriage = false } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  /* The columns inquiry writes on record-core's `bundles` (its R40), which the store's additive list creates today. */
  for (const c of ["inquiry_basis_count INTEGER", "inquiry_subject_entity TEXT", "inquiry_superseded_by TEXT"])
    st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const prov = provenanceOf(host, { record, membership, now: () => clock.now });
  prov.migrate();
  const attestation = attestationOf(host, { record, provenance: prov });
  /* T42-23b (K2643): what `sources`' reads reach is built here, before any test's snapshot, as the plane builds it at
     boot, so a test measuring what case-disclosures writes or creates (R7's "no new table") measures it alone.
     Capture is this host's one instance (`captureOf`), the one the doorbell `sources` asks for pulled knocks
     (`doorbellOf`) is built over, and acquisition's one instance for this host (its tables), which capture makes when
     first reached (a repeat `captureOf` reaches it), is reached here. T43-22 (K2710): the doorbell's one instance for
     this host, which `sources` reaches on its first read of pulled knocks (`doorbellOf(ctx)`), is reached here too,
     through `sources` (doorbell is no module case-disclosures uses), so its tables (`inbox` among them, doorbell R25),
     which capture no longer creates (capture R58, R87; N849), exist before any knock is inserted (`knocked`) and
     before any snapshot: a capture no knock was pulled into has no source, and the read writes nothing. */
  const capture = captureOf(host, { record, env: { INSTANCE_NAME: "test", VERSION: "0.0.0" }, provenance: prov, attestation });
  capture.migrate();
  const acquisition = capture.acquisition;
  const sources = sourcesOf(host, { record, membership, now: () => Date.parse(clock.now) });
  const unsourced = sources.sourceOf({ captureSha: "0".repeat(64), viewer: "admin" });
  if (unsourced.ok !== false) throw new Error(`fixture: a capture no knock was pulled into answered a source`);
  if (!st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name='inbox'`).length)
    throw new Error("fixture: the doorbell's tables were not built through sources");
  const ex = extractionOf(host, { record, membership, calibration: { onCalibration() { return { ok: true }; } } });
  ex.migrate();
  const exProvider = {
    readingOf: () => null, unitsOf: () => ({ units: [], state: null }), capturesReadFor: () => [], onReading: () => ({ ok: true }),
  };
  const content = contentOf(host, { record, membership, provenance: prov, extraction: exProvider, now: () => clock.now });
  content.migrate();
  /* the record of people (layer 5), each the real module on this host: the registry, the world's events, the lines
     between entities, money facts and people, migrated here */
  const entities = entitiesOf(host, { record, membership, provenance: prov });
  entities.migrate();
  const events = eventsOf(host, { record, membership, content, extraction: exProvider, provenance: prov, entities, readHooks: {},
                                  now: () => clock.now });
  events.migrate();
  const lines = linesOf(host, { record, provenance: prov, content, entities, events, now: () => clock.now });
  lines.migrate();
  const money = moneyOf(host, { record, membership, entities, provenance: prov, events, lines, now: () => clock.now });
  money.migrate();
  const people = peopleOf(host, { record, membership, entities, provenance: prov, content, sources, events, lines, money,
                                  duties: { dutiesOf: () => ({ ok: true, duties: [] }) }, now: () => clock.now });
  people.migrate();
  const retrieval = { selectionResolve: (args) => NO_SELECTION.selectionResolve(args) };
  const inquiry = inquiryOf(host, { record, membership, content, retrieval, provenance: prov, entities, now: () => clock.now });
  inquiry.migrate();
  const lens = lensStandIn();
  inquiry.bindBias(lens);
  const promotion = inquiry.promotion;
  promotion.registerFact("producingGroup", "instance-setup", () => group);
  inquiry.connections.migrate();
  const strength = strengthOf(host, { record, membership,
    inquiry: { basisFor: (id, o) => inquiry.basisFor(id, o), earned: (e, t, c) => inquiry.earned(e, t, c), legCapped,
               subjectEntityOf: (id) => inquiry.subjectEntityOf(id) },
    producingGroup: () => group, now: () => clock.now });
  /* basis-versions (layer 6) is not a module case-disclosures uses: strength and contradiction each reach its one
     instance on this host themselves, and the fixture creates its tables through that instance. */
  strength.versions.migrate();
  const contradiction = contradictionOf(host, { record, extraction: ex, membership, promotion, now: () => clock.now });
  contradiction.migrate();
  const runs = new Map();
  contradiction.registerRunGate("test", (id, viewer, caller) => {
    const r = runs.get(id);
    if (!r) return { found: false, running: false, refusal: null };
    return { found: true, running: r.status === "running",
             refusal: caller === r.principal ? null : { ok: false, reason: "AI_RUN_NOT_PRINCIPAL", code: "AI_RUN_NOT_PRINCIPAL" } };
  });
  /* `case-import`: the real one composed on this host (it fills accepted-work's registration itself), its checker
     scripted at case-checker's R1 (`w.checks`); else the stand-in, registered with accepted-work's one instance. */
  const checks = { group: "other-group", case: "CASE-2026-0900", edition: 1, findings: [] };
  const imports = realImports
    ? caseImportOf(host, { record, membership, strength, acceptedWork: strength.acceptedWork,
                           reevaluation: { acceptanceWithdrawn: () => ({ ok: true, told: true, dependents: 0 }) },
                           checkCaseFile: async () => ({ format: "bio-case-file/1", case: checks.case, edition: checks.edition,
                             group: checks.group, checker: { grading_versions: ["bio-grading/1"], checks_version: "1.57.0" },
                             integrity: { departures: [] }, signatures: { case: { verified: true } },
                             publication_checks: { findings: [] }, complete_edition: { equal: true },
                             statement: "Recreating shows the case intact and consistent, not true.",
                             findings: checks.findings.map((f) => ({ role: "load_bearing", result: "recreated", missing: [],
                                                                     differs: [], bar_met: "not_asked", ...f })) }),
                           now: () => Date.parse(clock.now) })
    : importsStandIn();
  if (!realImports) strength.acceptedWork.registerAcceptedWork("case-import", imports.registration);
  const marks = marksStandIn();
  /* T38: the real case-carriage (its R10–R14), over an evidence store and a bucket stand-in and a scripted cover */
  const evidence = new Map(), bucket = new Map();
  const cover = { refuse: null, calls: [] };
  const clean = { answer: null };
  let carriage = null;
  if (realCarriage) {
    record.evidenceStore = () => ({
      head: async (d) => (evidence.has(String(d)) ? { size: evidence.get(String(d)).length } : null),
      get: async (d) => (evidence.has(String(d)) ? { arrayBuffer: async () => Uint8Array.from(evidence.get(String(d))).buffer } : null),
      put: async () => null });
    carriage = caseCarriageOf(host, { record, membership, promotion, provenance: prov, now: () => clock.now, store: "bio",
      clean: async (bytes) => (clean.answer ? clean.answer(bytes) : { ok: true, clean: true, format: "text" }),
      bucket: { put: async (k, b) => { bucket.set(k, b); return {}; }, get: async (k) => bucket.get(k) ?? null },
      cover: async (bytes, { areas }) => {
        cover.calls.push(areas);
        if (cover.refuse) return { ok: false, code: cover.refuse, detail: `refused: ${cover.refuse}` };
        return { ok: true, bytes: Uint8Array.from([...bytes, areas.length]), covered: areas.length, width: 8, height: 8 };
      } });
  }
  const team = { zone: "America/Los_Angeles" };
  const w = {
    team, lens, marks, carriage, evidence, bucket, cover, clean, imports, checks, st, host, record, membership, promotion, prov, content, inquiry, strength, contradiction, runs, clock,
    capture, acquisition, sources, attestation, extraction: ex, entities, events, lines, money, people,
    row: (q, ...a) => st.sql.exec(q, ...a)[0] ?? null,
    rows: (q, ...a) => st.sql.exec(q, ...a),
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify(st.sql.exec(`SELECT * FROM "${name}"`));
      return out;
    },
  };
  w.cd = caseDisclosuresOf(host, { record, inquiry, strength, contradiction, provenance: prov, attestation, capture,
    sources, extraction: ex, promotion, caseImport: imports, entities, events, lines, money, people, membership,
    caseCarriage: carriage || marks, bias: lens, retrieval: { zone: () => team.zone }, now: () => clock.now, ...deps });
  let n = 0;
  Object.assign(w, {
    head: (id) => record.head(id)?.bundleSha ?? null,
    fm: (text) => parseFrontmatter(String(text || "")).data || {},
    member(id) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, 'member', 'active', '["contribute","publish"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`);
    },
    /** A whole extracted-text index for `captureSha` (extraction R36's `unitsOf` reads it), one unit per entry of
     *  `units` (`{text, truncated?}`), or with `state` other than whole. */
    indexText(captureSha, bundleId, units = [{ text: `the text of ${bundleId}` }], state = "whole") {
      st.sql.exec(`INSERT OR REPLACE INTO capture_text_state (capture_sha, bundle_id, state, offered, written, over_bound,
                   unaddressable, truncated, skipped_named, chain_kind, at) VALUES (?,?,?,?,?,0,0,?,0,'text',?)`,
                  captureSha, bundleId, state, units.length, units.length, units.filter((u) => u.truncated).length, T0);
      units.forEach((u, i) => st.sql.exec(`INSERT OR REPLACE INTO capture_text (capture_sha, bundle_id, extent_kind, extent,
                   ref, seq, text, truncated, chain_kind) VALUES (?,?,'doc-para',?,?,?,?,?,'text')`,
                  captureSha, bundleId, JSON.stringify({ kind: "doc-para", para: i + 1 }), `paragraph ${i + 1}`, i, u.text,
                  u.truncated ? 1 : 0));
    },
    /** An information bundle registering one capture whose provenance document carries `extra`; its text indexed
     *  whole unless `indexed: false`; fetched `direct` by this instance unless `receipt: false` (a Grade B capture,
     *  provenance R13, R24); registered at `snapshots/<name>` (a `.png` name makes it a photo to the real case-carriage,
     *  its bytes put in the evidence store). Answers the capture's sha. */
    doc(id, extra = {}, { receipt = false, text = `bytes of ${id}`, indexed = true, name = "c0.txt", title = `Document ${id}` } = {}) {
      const c = { path: `snapshots/${name}`, text, sha: sha(text) };
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id, title) }, { path: c.path, text: c.text },
                { path: "data/provenance.json", text: JSON.stringify({ documents: [{ ...provDoc(c), ...extra }] }) }],
        meta: { object_type: "information" },
        register: [{ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) }] });
      if (!r.ok) throw new Error(`fixture doc refused: ${JSON.stringify(r).slice(0, 400)}`);
      if (indexed) w.indexText(c.sha, id);
      evidence.set(c.sha, Buffer.from(c.text, "utf8"));
      if (receipt) prov.recordReceipt({ address: `https://example.org/${id}`, addressNorm: `example.org/${id}`,
                                        captureSha: c.sha, retrieved: T0, via: "direct" });
      return c.sha;
    },
    /** An information bundle registering `count` captures of one source (G47: the same `ref` on `n` materials), each with
     *  its own bytes, its text indexed whole, registered at its own instant (`registered` = `at(i)`), so each capture's
     *  attestation lines are its own. Answers the captures' shas in order. */
    captures(id, count, { ext = "txt", at = (i) => `2026-09-27T${String(1 + (i % 20)).padStart(2, "0")}:${String(i % 60).padStart(2, "0")}:00Z` } = {}) {
      const cs = Array.from({ length: count }, (_, i) => { const text = `bytes ${i} of ${id}`; return { path: `snapshots/c${i}.${ext}`, text, sha: sha(text) }; });
      const r = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"),
        files: [{ path: "bundle.md", text: infoMd(id) }, ...cs.map((c) => ({ path: c.path, text: c.text })),
                { path: "data/provenance.json", text: JSON.stringify({ documents: cs.map((c) => provDoc(c)) }) }],
        meta: { object_type: "information" },
        register: cs.map((c) => ({ sha256: c.sha, path: c.path, encoding: "utf8", bytes: Buffer.byteLength(c.text) })) });
      if (!r.ok) throw new Error(`fixture captures refused: ${JSON.stringify(r).slice(0, 400)}`);
      cs.forEach((c, i) => {
        w.indexText(c.sha, id);
        evidence.set(c.sha, Buffer.from(c.text, "utf8"));
        st.sql.exec(`UPDATE register SET registered=? WHERE capture_sha=?`, at(i), c.sha);
      });
      return cs.map((c) => c.sha);
    },
    /** A content row over `capture` in `bundle` (content R45's read contract). */
    content(id, capture, bundle, ref = `the page of ${bundle}`, extent = "{}") {
      st.sql.exec(`INSERT INTO content (content_id, capture_sha, bundle_id, extent_kind, extent, ref, minted_by, at, stale)
                   VALUES (?, ?, ?, 'pdf-page', ?, ?, 'plane', '2026-01-01', 0)`, id, capture, bundle, extent, ref);
    },
    /** An inquiry whose basis is `legs` (each `{target, …leg fields}`), concluded in its own bytes. */
    finding(id, legs, { state = "concluded", lines = [], severed = [] } = {}) {
      const head = record.head(id);
      const r = promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`,
        author: V("alice"), files: [{ path: "bundle.md", text: inqMd(id, legs, { state, lines, severed }) }],
        meta: { object_type: "inquiry" } });
      if (!r.ok) throw new Error(`fixture finding refused: ${JSON.stringify(r).slice(0, 600)}`);
      return r;
    },
    /** A project owned (and so joined) by `owner`, citing `cites`. */
    project(title, owner, cites = []) {
      const r = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, cites) }], meta: { object_type: "project" } });
      if (!r.ok) throw new Error(`fixture project refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.bundleId;
    },
    /** case-authoring R4's `prepared`, as it would hand it: each member with its current pin. */
    prepared: (ids) => ids.map((id) => ({ id, bundleSha: w.head(id) })),
    /** case-authoring R5's partition, every member load-bearing unless named in `supporting`. */
    roles: (ids, supporting = []) => ids.map((id) => ({ target: id, role: supporting.includes(id) ? "supporting" : "load_bearing" })),
    /** A knock the doorbell received, already pulled into `captureSha` (doorbell R13, R18), a row of its `inbox`. */
    knocked(captureSha, { knockId = `KNOCK-2026-09-27-${captureSha.slice(0, 8)}`, received = T0, pseudonym = null } = {}) {
      st.sql.exec(`INSERT INTO inbox (knock_id, sha256, bytes, received, status, capture_sha, pulled_by, pulled_at,
                   pseudonym) VALUES (?, ?, 1, ?, 'pulled', ?, 'alice', ?, ?)`,
                  knockId, captureSha, received, captureSha, received, pseudonym);
      return knockId;
    },
  });
  return w;
}

/** `case-carriage.photoMarks` at its ruled interface (its R10; T37, N757), a stand-in the test controls: `photo(sha,
 *  {state, marks, copy, refused})` makes a capture a photo (unchecked unless stated; `copy` a SHA-256 or null), `answer(sha,
 *  a)` answers `a` for that capture (a refused or malformed read), `read`,
 *  when set, answers in place of the held marks (a failed or a refused read). Every other capture is no photo. `asked`
 *  lists each `{captureSha, viewer}` asked.
 *  (T47; R32) A photo answering a copy answers case-carriage R22's `obscured` object `{copy, label, marked, kind:
 *  "photo"}` with it, as that module will.
 *  `documentCopy(captureSha)` at its ruled interface (its R16; T39, N806): `document(sha, a)` answers `a` (a state, or
 *  any answer; a `copy` answer with no `obscured` key gains R22's `{copy, label: COPY_CLEANED_LABEL, kind: "document"}`)
 *  for that capture, `copyRead`, when set, answers in place of the held ones; every other capture answers
 *  `public` and a photo `photo`. `copyAsked` lists each digest asked. */
export function marksStandIn() {
  const held = new Map(), answers = new Map(), copies = new Map();
  const s = {
    read: null,
    copyRead: null,
    copyAsked: [],
    document(captureSha, a) {
      const c = typeof a === "string" ? { state: a, copy: null, refused: null } : a;
      /* (T47; R32) case-carriage R22: a copy's answer carries its `obscured` object, `kind` "document" */
      copies.set(captureSha, c && c.state === "copy" && typeof c.copy === "string" && !("obscured" in c)
        ? { ...c, obscured: { copy: c.copy.toLowerCase(), label: COPY_CLEANED_LABEL, kind: "document" } } : c);
    },
    documentCopy(captureSha) {
      s.copyAsked.push(captureSha);
      if (s.copyRead) return s.copyRead(captureSha);
      if (copies.has(captureSha)) return copies.get(captureSha);
      return { state: held.has(captureSha) ? "photo" : "public", copy: null, refused: null };
    },
    answer(captureSha, a) { answers.set(captureSha, a); },
    asked: [],
    photo(captureSha, { state = "unchecked", marks = null, copy = null, refused = null } = {}) {
      const m = marks ?? (state === "marked" ? [{ mark: "MARK-1", areas: [{ rect: [0, 0, 8, 8], kind: "person" }], by: "alice", at: T0 }]
        : state === "nothing_to_obscure" ? [{ mark: "MARK-1", areas: [], by: "alice", at: T0 }] : []);
      held.set(captureSha, { state, marks: m,
        copy: copy ? { sha256: copy, covered: 1, width: 8, height: 8 } : null,
        refused: refused ? { code: refused, detail: `image-cover refused: ${refused}` } : null,
        /* (T47; R32) case-carriage R22: a photo answering a copy answers its `obscured` object, `kind` "photo" */
        ...(copy && !refused && state !== "unchecked"
          ? { obscured: { copy: copy.toLowerCase(), label: state === "marked" ? OBSCURED_LABEL : PUBLISHED_LABEL,
                          marked: state === "marked", kind: "photo" } } : {}) });
    },
    photoMarks({ captureSha, viewer }) {
      s.asked.push({ captureSha, viewer });
      if (s.read) return s.read({ captureSha, viewer });
      if (answers.has(captureSha)) return answers.get(captureSha);
      const p = held.get(captureSha);
      return p ? { ok: true, capture: captureSha, photo: true, ...p } : { ok: true, capture: captureSha, photo: false };
    },
  };
  return s;
}

/** `bias.statementInForce` at its ruled interface (its R49; T41), a stand-in the test controls: `inForce` the statement
 *  ids in force for every scope, unless `byScope` names a scope's own (`"instance"` or a project id); `read`, when set,
 *  answers in place of the held ones. `asked` lists each `{statement, scope, viewer}`. `biasManifest` answers no lens in
 *  force, so inquiry's R53 records none. */
export function lensStandIn() {
  const s = {
    inForce: new Set(), byScope: new Map(), read: null, asked: [],
    statementInForce({ statement, scope = "instance", viewer = null } = {}) {
      s.asked.push({ statement, scope, viewer });
      if (s.read) return s.read({ statement, scope, viewer });
      const key = scope && typeof scope === "object" ? (scope.type === "project" ? scope.id : "instance") : "instance";
      const held = s.byScope.has(key) ? s.byScope.get(key) : s.inForce;
      const on = held.has(statement);
      return { ok: true, statement, scope, in_force: on, kind: on ? "scrutiny" : null, text: on ? `the text of ${statement}` : null };
    },
    biasManifest: () => ({ ok: true, in_force: false }),
  };
  return s;
}

/** `case-import` at its ruled interface (its R4, R9, R16), a stand-in the test controls: another group's imported
 *  editions, the acceptances in force and the open flags. `accept(...)` answers the ref a leg names; `flagsRead`, when
 *  set, answers `openFlagsOn` in place of the held flags (a failed or incomplete read). Copied from case-authoring's. */
export function importsStandIn() {
  const editions = new Map(), acceptances = new Map(), flags = [];
  const key = (...a) => a.join("#");
  const s = {
    flagsRead: null,
    edition(imp, edition, { group = "other-group", caseId = "CASE-2026-0900", manifestSha = "f".repeat(64), findings = [] } = {}) {
      editions.set(key(imp, edition), { edition, group, case: caseId, manifest_sha: manifestSha, findings });
    },
    accept(imp, edition, finding, a = {}) {
      acceptances.set(key(imp, edition, finding), { by: "alice", at: T0, reason: "We recreated it whole.",
        checked: "every passage", gaps: null, ...a });
      return importedFindingRef(imp, finding);
    },
    withdraw(imp, edition, finding) { acceptances.delete(key(imp, edition, finding)); },
    flag(imp, edition, f) { flags.push({ import: imp, edition, open: true, finding: null, at: T0, ...f }); },
    clear(flag) { for (const f of flags) if (f.flag === flag) f.open = false; },
    acceptanceOf: ({ import: imp, edition, finding }) => acceptances.get(key(imp, edition, finding)) ?? null,
    openFlagsOn: ({ import: imp, edition }) => (s.flagsRead ? s.flagsRead({ import: imp, edition })
      : { ok: true, complete: true, flags: flags.filter((f) => f.open && f.import === imp && f.edition === edition)
          .map(({ flag, finding, issue, at }) => ({ flag, finding, issue, at })) }),
    importedCase: ({ import: imp, edition }) => {
      const e = editions.get(key(imp, edition));
      return e ? { ok: true, import: imp, group: e.group, case: e.case, editions: [{ edition: e.edition }],
                   edition: { edition: e.edition, manifest_sha: e.manifest_sha, findings: e.findings } }
               : REAL_IMPORTS.importedCase({ import: imp, edition, viewer: V("alice") });
    },
  };
  s.registration = {
    finding: ({ ref, edition }) => {
      const p = parseImportedFindingRef(ref);
      const e = p && editions.get(key(p.import, edition));
      if (!p || !e) return null;
      const f = e.findings.find((x) => x.finding === p.finding) || {};
      return { ref, import: p.import, group: e.group, case: e.case, edition, finding: p.finding,
               manifest_sha: e.manifest_sha, result: f.result ?? null, pair: f.pair ?? null,
               acceptance: acceptances.get(key(p.import, edition, p.finding)) ?? null };
    },
    openFlags: ({ ref, edition }) => {
      const p = parseImportedFindingRef(ref);
      return { complete: true, flags: flags.filter((f) => p && f.open && f.import === p.import && f.edition === edition) };
    },
    withdrawals: () => ({ withdrawals: [], cursor: null }),
  };
  return s;
}

export function infoMd(id, title = `Document ${id}`) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: ${JSON.stringify(title)}`,
          "current_state: collected", "prior_state: null", `created: "${T0}"`,
          `last_updated: "${T0}"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

/** An inquiry document: `legs` its basis (each cited by a confirmed `cites` reference); concluded in its own bytes. */
export function inqMd(id, legs = [], { state = "concluded", lines = [], severed = [] } = {}) {
  const val = (v) => (typeof v === "number" ? String(v) : `${v}`);
  /* a leg on another group's finding is not a reference (inquiry-grammar R11) */
  const refs = [...new Set(legs.map((l) => l.target).filter((t) => !String(t).startsWith("imported:")))];
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Question ${id}"`,
    `current_state: ${state}`, "prior_state: open", `created: "${T0}"`, `last_updated: "${T0}"`, "surfaced_by: human",
    ...(refs.length ? ["references:", ...refs.flatMap((t) => ["  - rel: cites", `    target: ${t}`,
                                                              `    status: ${severed.includes(t) ? "severed" : "confirmed"}`, '    note: ""'])] : ["references: []"]),
    "state_history: []",
    ...(legs.length ? ["basis:", ...legs.flatMap((l) => Object.entries({ role: "supports", ...l })
      .sort(([a], [b]) => (a === "target" ? -1 : b === "target" ? 1 : 0))
      .map(([k, v], i) => `${i ? "    " : "  - "}${k}: ${val(v)}`))] : []),
    ...(state === "concluded" ? [`conclusion: "the award followed the minutes"`, `falsifier: "a later amendment"`] : []),
    ...lines, "---", "", "## Question", "", `Was ${id} answered?`, "", "## Session Log", ""].join("\n");
}

export function projMd(title, cites = []) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "${T0}"`, `last_updated: "${T0}"`,
          ...(cites.length ? ["references:", ...cites.flatMap((t) => ["  - rel: cites", `    target: ${t}`,
                                                                       "    status: confirmed", '    note: ""'])]
                           : ["references: []"]),
          "state_history: []", "---", "", "## Objective", "", "Find out.", "", "## Session Log", ""].join("\n");
}

export function provDoc(c) {
  return {
    file: c.path, locator: `https://example.org/${c.path}`, retrieved: T0,
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: c.sha, encoding: "utf8",
               bytes: Buffer.byteLength(c.text) },
    origin: { kind: "named_request" },
  };
}

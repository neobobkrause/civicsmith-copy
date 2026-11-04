/* consequences over the modules it uses, each the real one (record-core, membership, promotion, provenance, content,
   inquiry, strength, entities, money, calculations, people; entities built on the host directly, K1619), on a real
   SQLite database (node:sqlite) standing
   in for a Durable Object's storage, shaped as workerd's (K316: `sql.exec` answers a cursor; K313: a LIKE or GLOB
   pattern over 50 bytes is refused). Two stand-ins the test controls: `conformance`'s `determinationRead`, answering as
   conformance R9 states it (`outcomes`, `superseded_by`, `live`), gated on the project's sight, so a test states a
   determination's outcomes and supersession directly (filings' and escalation's suites drive the real conformance with
   this module); and the passage text of a content row (content R46 reads it from extraction's units, which this world
   does not index), unless `passages: false` leaves content's own read in place. Every test drives `consequences` at its
   interface. (T45) A third: case-inputs' `carryOutcome` (its R9; case-authoring's R71 before T47), which R22 calls,
   recording each call, so a test reads what was carried; its own suite proves the service, and carry.test.mjs drives
   R22 over the real case-inputs instance too (T47, N908). */
import { DatabaseSync } from "node:sqlite";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { contentOf } from "../../../src/content/index.mjs";
import { inquiryOf, legCapped } from "../../../src/inquiry/index.mjs";
import { strengthOf } from "../../../src/strength/index.mjs";
import { entitiesOf } from "../../../src/entities/index.mjs";
import { moneyOf } from "../../../src/money/index.mjs";
import { peopleOf } from "../../../src/people/index.mjs";
import { calculationsOf } from "../../../src/calculations/index.mjs";
import { basisVersionsOf } from "../../../src/basis-versions/index.mjs";
import { consequencesModule, Consequences } from "../../../src/consequences/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { noSelection } from "../retrieval/fixtures.mjs";
import { carryOutcome as caseInputsCarryOutcome } from "../case-inputs/fixtures.mjs";
import { rungOf as sourcesRungOf } from "../sources/fixtures.mjs";

/* sources' own answers (its published fixture): the real held rung and the real NO_SUCH_SOURCE refusal. */
const REAL_RUNG = await sourcesRungOf();
/* case-inputs' own answers to `carryOutcome`: the real NO_SUCH_CASE and BAD_CARRIED_OUTCOME refusals, and a real carried outcome. */
const REAL_CARRY = caseInputsCarryOutcome();

export const sha = (s) => createHash("sha256").update(Buffer.from(s, "utf8")).digest("hex");
const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);

/* workerd's `sql.exec` answers a cursor, never an array: rows are read by iterating it (or its `toArray()`/`one()`),
   and `[0]` of it is undefined; and it refuses a LIKE or GLOB pattern over 50 bytes (K313), which node:sqlite does not. */
export const WORKERD_PATTERN_CAP = 50;
function cursor(rows) {
  let i = 0;
  return {
    [Symbol.iterator]() { return this; },
    next: () => (i < rows.length ? { value: rows[i++], done: false } : { value: undefined, done: true }),
    toArray: () => { const r = rows.slice(i); i = rows.length; return r; },
    one: () => { if (rows.length - i !== 1) throw new Error("Expected exactly one result from SQL query"); return rows[i++]; },
  };
}

function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = {
    exec(q, ...args) {
      const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
      const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
      if ([...literal, ...bound].some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP))
        throw new Error("LIKE or GLOB pattern too complex");
      const st = db.prepare(q);
      return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
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
export const MACHINE = "class:ai";
export const NOW = "2026-09-28T01:00:00Z";
const LAYER = [{ step: "layer", tier: 1, container: "pdf", cap: null, measured_by: null, calibration: null }];

const BUNDLE_COLUMNS = ["inquiry_basis_count INTEGER", "inquiry_subject_entity TEXT", "inquiry_superseded_by TEXT"];
const EXTRACTION_JOINED = [
  `CREATE TABLE readings (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL, content_type TEXT, reading TEXT,
     at TEXT, capture_format TEXT)`,
  `CREATE TABLE reading_refs (capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL, ref TEXT NOT NULL, ref_kind TEXT,
     ref_key TEXT, label TEXT, pos_kind TEXT, pos TEXT, pos_ref TEXT, occurrence TEXT NOT NULL DEFAULT '',
     seq INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (capture_sha, ref, occurrence))`,
  `CREATE TABLE reading_ref_terms (capture_sha TEXT NOT NULL, bundle_id TEXT NOT NULL, ref TEXT NOT NULL,
     src TEXT NOT NULL, term TEXT NOT NULL, PRIMARY KEY (capture_sha, ref, src, term))`,
  `CREATE TABLE reading_text_source (capture_sha TEXT PRIMARY KEY, bundle_id TEXT NOT NULL,
     transcribed INTEGER NOT NULL DEFAULT 0, terminal_step TEXT, engines TEXT, derivation_cap TEXT,
     steps INTEGER NOT NULL DEFAULT 0, chain TEXT, calibrations TEXT)`,
];

/** The world: `alice` owns and has joined project P, and `pat` has joined it; `bob` is a member who has not; `carol`
 *  is an administrator neither invited nor joined. P is hidden (membership's default), so carol sees it only at
 *  `EXISTENCE`, never its contents (D54; membership R43, R44), until `discoverable()` sets it discoverable or
 *  `invite("carol")` invites her, either of which shows it to her whole. `passages: false` leaves the passage-text read
 *  out (R4's "a form not read"). */
export function world({ passages = true, group = "test-group", superseded = null } = {}) {
  const st = storage();
  const host = { storage: st };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  for (const c of BUNDLE_COLUMNS) st.db.exec(`ALTER TABLE bundles ADD COLUMN ${c}`);
  const clock = { now: NOW };
  const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const promotion = promotionOf(host, { record, membership, now: () => clock.now });
  /* The facts promotion asks for, provided here as their modules provide them (instance-setup, publication). */
  promotion.registerFact("producingGroup", "instance-setup", () => group);
  promotion.registerFact("caseMember", "publication", () => false);
  promotion.registerFact("publishedRegistry", "publication", () => ({}));
  const prov = provenanceOf(host, { record, membership, promotion, now: () => clock.now });
  prov.migrate();
  for (const t of EXTRACTION_JOINED) st.db.exec(t);
  const ex = { readings: {}, units: {} };
  const extraction = {
    readingOf: (s) => (ex.readings[s] ? { reading: { page_boxes: null }, chain: null, pageCount: null,
      textContainer: null, captureFormat: null, ...ex.readings[s] } : null),
    unitsOf: (s) => ex.units[s] || { units: [], state: null },
    capturesReadFor: () => [],
    onReading: () => ({ ok: true }),
  };
  const content = contentOf(host, { record, membership, provenance: prov, extraction, now: () => clock.now });
  content.migrate();
  /* The profile money reads periods and zones through (the fictional test profile). */
  record.setSetting("jurisdiction_profiles", ["test-port-ellery"], "admin");
  /* entities on this host, built directly (K1619); inquiry reaches the same instance. */
  const entities = entitiesOf(host, { record, membership, provenance: prov });
  entities.migrate();
  const inquiry = inquiryOf(host, { record, membership, promotion, content,
    retrieval: { selectionResolve: noSelection().selectionResolve }, provenance: prov,
    now: () => clock.now });
  inquiry.migrate();
  /* connections' tables (promotion writes its `refs`): connections is not this module's use, so the architecture check
     refuses importing it here; it is reached through inquiry's getter, as before K1619 (reported to BOB, T33 J2). */
  inquiry.connections.migrate();
  /* money, people and calculations, real. What they reach and this module never asks of them (events, lines and
     duties: a fact's `concerns`, a person's posts and duties) is answered as absent, a port answering null, so no
     module outside this one's uses is built here. */
  const none = () => null;
  let calculations = null;
  const money = moneyOf(host, { record, membership, entities, provenance: prov, events: none, lines: none, now: () => clock.now,
    calculations: { bindingOf: (k) => (calculations ? calculations.bindingOf(k) : null) } });
  money.migrate();
  /* people's source↔person link names a source `sources` holds (its R9); sources is not this module's use, so a
     stand-in holds every `SRC-` id. */
  const sources = { rungOf: ({ source }) => (/^SRC-/.test(String(source)) ? REAL_RUNG.held : REAL_RUNG.unheld) };
  const people = peopleOf(host, { record, membership, entities, provenance: prov, content, events: none, money, duties: none,
                                  lines: none, sources });
  if (typeof people.migrate === "function") people.migrate();
  calculations = calculationsOf(host, { record, membership, content, provenance: prov, money, entities, events: none,
    duties: none, people, now: () => clock.now, clock: () => Date.parse(clock.now) });
  const strength = strengthOf(host, { record, membership,
    inquiry: { basisFor: (...a) => inquiry.basisFor(...a), earned: (...a) => inquiry.earned(...a), legCapped,
               subjectEntityOf: (id) => inquiry.subjectEntityOf(id) },
    producingGroup: () => group, now: () => clock.now });

  /* conformance R9 in its real shape (K248), as far as this module reads it; R33's `void: {causes, says}` (its outcomes then read undetermined, the recorded one
     beside them), and the act's `when` and the findings R22 reads of a curing determination. R37's `curesOf` answers
     `{standards: [{standard, link, ended}]}` (K2850), `link` the standing link a test states in `cures` (keyed
     `determination|standard`), or null. */
  const determinations = new Map();
  const cures = new Map();
  const conformance = {
    determinationRead: ({ id, viewer }) => {
      const d = determinations.get(id);
      if (!d || (viewer != null && membership.sight(d.project, viewer) !== "full"))
        return { ok: false, reason: "NO_SUCH_DETERMINATION", id };
      const outcomes = d.void ? d.outcomes.map((o) => ({ standard: o.standard, outcome: "undetermined", recorded_outcome: o.outcome }))
        : d.outcomes;
      return { ok: true, id, project: d.project, outcomes, superseded_by: d.superseded_by ?? null,
               act: { when: { value: d.when ?? "2026-03-01", precision: "day", zone: "America/Los_Angeles" } },
               findings: (d.findings ?? []).map((finding) => ({ finding })), live: !d.superseded_by,
               ...(d.void ? { void: { causes: d.void, says: "void" } } : {}) };
    },
    curesOf: ({ determination, standard, viewer }) => {
      const d = determinations.get(determination);
      if (!d || (viewer != null && membership.sight(d.project, viewer) !== "full"))
        return { ok: false, reason: "NO_SUCH_DETERMINATION", determination };
      const stds = standard ? [standard] : d.outcomes.map((o) => o.standard);
      return { ok: true, determination,
               standards: stds.map((st) => ({ standard: st, link: cures.get(`${determination}|${st}`) ?? null, ended: [] })) };
    },
  };
  /* case-inputs R9's `carryOutcome`, as R22 calls it: each call recorded in `carried`; a case named in `noCases`
     answers its NO_SUCH_CASE, and a text with a quote its BAD_CARRIED_OUTCOME (R9's text rule). */
  const carried = [];
  const noCases = new Set(["CASE-2026-0099"]);
  const caseInputs = {
    carryOutcome: (a) => {
      if (noCases.has(a.case)) return REAL_CARRY.noSuchCase;
      if (typeof a.text !== "string" || !a.text.trim() || /["\\\r\n]/.test(a.text))
        return REAL_CARRY.badCarriedOutcome;
      carried.push(a);
      return { ok: true, outcome: `OUT-2026-${String(carried.length).padStart(4, "0")}` };
    },
  };
  const texts = new Map();
  /* inquiry as this module reads it; a test may state which inquiries are superseded (inquiry R16's index). */
  const inq = new Proxy(inquiry, { get: (t, p) => (p === "supersededBy" && superseded
    ? (id) => superseded.get(id) || [] : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
  /* basis-versions, real, on this host and over the same inquiry (R27: a project's conclusion of a question); it joins every
     promotion, so it is built with its tables. */
  const bv = basisVersionsOf(host, { record, membership, promotion, content, inquiry, now: () => clock.now });
  bv.migrate();
  const deps = { record, membership, promotion, conformance, content, provenance: prov, inquiry: inq, strength, money,
    calculations, entities, people, caseInputs, basisVersions: bv,
    now: () => clock.now, ...(passages ? { passageText: (id) => texts.get(id) ?? null } : {}) };
  const c = consequencesModule(host, deps);

  let n = 0;
  const w = {
    st, host, record, membership, promotion, prov, content, inquiry, strength, c, clock, ex, texts, determinations,
    cures, carried, noCases, deps, bv,
    entities, money, people, calculations,
    /** R15: this module over the same record, with a sight rule that withholds the bundles in `hidden` from `pat`
     *  (and from no one else). membership's rule shows every bundle outside a project to a member (its R43), so a
     *  document or an inquiry is withheld from a reader of a part only through such a rule, as conformance's suite
     *  reaches its R9 (test/m/conformance/reads.test.mjs). */
    sighted(hidden) {
      const sight = new Proxy(membership, { get: (t, p) => (p === "inSight"
        ? (id, viewer) => (viewer === V("pat") && hidden.has(id) ? false : t.inSight(id, viewer))
        : typeof t[p] === "function" ? t[p].bind(t) : t[p]) });
      return new Consequences({ ...deps, storage: st, host, membership: sight });
    },
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => [...st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)][0].n,
    snapshot() {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`))
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM "${name}"`)]);
      return out;
    },
    member(id, { role = "member" } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
    },
    project(title, owner, cites = []) {
      const res = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title, cites) }], meta: { object_type: "project" } });
      if (!res.ok) throw new Error(`fixture project refused: ${JSON.stringify(res).slice(0, 400)}`);
      return res.bundleId;
    },
    /** An information bundle holding one capture of `text`; answers the capture's sha. */
    doc(id, text = `the text of ${id}`) {
      const cap = { path: `snapshots/${id}.txt`, text, sha: sha(text) };
      const files = [{ path: "bundle.md", text: infoMd(id) }, { path: cap.path, text },
        { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(cap)] }, null, 2) }];
      const res = promotion.promote({ bundleId: id, base: null, snapKey: `k${++n}`, author: V("alice"), files,
        meta: { object_type: "information" },
        register: [{ sha256: cap.sha, path: cap.path, encoding: "utf8", bytes: Buffer.byteLength(text) }] });
      if (!res.ok) throw new Error(`fixture doc refused: ${JSON.stringify(res).slice(0, 400)}`);
      ex.readings[cap.sha] = { chain: LAYER, pageCount: 3 };
      return cap.sha;
    },
    /** A receipt of `capSha` from `address` (R2's route: `direct`, or `archive.org`). */
    receipt(capSha, address, { via = "direct", retrieved = "2026-09-27T00:00:00Z" } = {}) {
      prov.recordReceipt({ address: `https://${address}`, addressNorm: address, captureSha: capSha, retrieved, via });
    },
    /** A passage of a document's capture holding `text`, minted as content; answers its content id. */
    passage(bundleId, capSha, text, page = 1) {
      const m = content.mint({ bundleId, captureSha: capSha, extent: { kind: "pdf-page", page }, mintedBy: V("alice") });
      if (!m.ok) throw new Error(`fixture passage refused: ${JSON.stringify(m).slice(0, 300)}`);
      texts.set(m.content_id, text);
      return m.content_id;
    },
    /** A passage whose document was captured directly from `address` (grade B), holding `text`. */
    figure(id, text, address = `example.org/${id}`, via = "direct") {
      const s = w.doc(id, `${text} (${id})`);
      w.receipt(s, address, { via });
      return w.passage(id, s, text);
    },
    /** A registered person (entities R1): its entity id. */
    person(label, aliases = []) {
      const e = entities.createEntity({ kind: "person", label, aliases, note: "a person the test registers", declaredBy: V("alice") });
      if (!e.ok) throw new Error(`fixture person refused: ${JSON.stringify(e).slice(0, 300)}`);
      return e.entity_id;
    },
    /** A registered entity of another kind: its entity id. */
    entity(label, kind = "institution") {
      const e = entities.createEntity({ kind, label, note: "an entity the test registers", declaredBy: V("alice") });
      if (!e.ok) throw new Error(`fixture entity refused: ${JSON.stringify(e).slice(0, 300)}`);
      return e.entity_id;
    },
    /** A money fact recorded by alice through the real money module (its R1), its source a fresh document; `id`
     *  names the document (a project's sight then reaches it through `sighted`). Answers the fact id. */
    fact(fields = {}, id = `INFO-2026-${String(9000 + ++n)}-ledger`) {
      w.parties ||= { from: w.entity("The Treasury", "office"), to: w.entity("Harbour Supply") };
      const s = w.doc(id, `a ledger page ${n}`);
      w.receipt(s, `example.org/ledger/${n}`);
      const amount = String(fields.amount ?? "100");
      const f = { amount, as_read: `$${amount}`, currency: "USD", sign: "+", precision: "exact", kind: "payment",
        phase: "actual", stage: "paid", basis: "cash", period: { from: "2025-07-01", to: "2026-06-30", precision: "day" },
        from: { entity: w.parties.from }, to: { entity: w.parties.to },
        source: { capture_sha: s, extent: { kind: "document" } }, by: V("alice"), ...fields };
      for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k];
      const r = money.recordFact(f);
      if (!r.ok) throw new Error(`fixture money fact refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.fact_id;
    },
    /** A calculation over money facts (calculations R4: a `sum` of their amounts, step `total`), created by alice. */
    async calculation(factIds, { question = "How much was paid?" } = {}) {
      const recipe = { method: "bio-calc/1", inputs: [{ name: "t", kind: "table" }],
                       steps: [{ op: "sum", from: "t", field: "amount", as: "total" }], output: "total" };
      const r = await calculations.create({ question, period: { from: "2025-07-01", to: "2026-06-30" }, kind: "total",
        inputs: [{ name: "t", money: factIds }], recipe, by: V("alice") });
      if (!r.ok) throw new Error(`fixture calculation refused: ${JSON.stringify(r).slice(0, 400)}`);
      return r.calc_id;
    },
    /** D54: a project its owner sets discoverable (membership R45), which an administrator outside it sees whole. */
    discoverable(project = w.P, owner = "alice") {
      const r = membership.projectVisibilitySet({ projectId: project, setting: "discoverable", reason: "open to members", by: owner });
      if (!r.ok) throw new Error(`fixture visibility refused: ${JSON.stringify(r).slice(0, 300)}`);
    },
    /** D54: a member invited to P by alice and not joined: an invited administrator sees a hidden project whole. */
    invite(id) {
      const r = membership.projectInvite({ projectId: w.P, handle: `h_${id}`, by: "alice" });
      if (!r.ok) throw new Error(`fixture invitation refused: ${JSON.stringify(r).slice(0, 300)}`);
    },
    determination(id, project, outcomes, extra = {}) {
      determinations.set(id, { project, outcomes: Object.entries(outcomes).map(([standard, outcome]) => ({ standard, outcome })),
                               ...extra });
      return id;
    },
    /** An inquiry in `state`, resting on one document leg. */
    inquiryAt(id, state = "open", { target, prior = "null", extra = [] } = {}) {
      const head = record.head(id);
      const res = promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`,
        author: V("alice"), files: [{ path: "bundle.md", text: inquiryMd(id, { state, prior, target, extra }) }],
        meta: { object_type: "inquiry" } });
      if (!res.ok) throw new Error(`fixture inquiry refused: ${JSON.stringify(res).slice(0, 600)}`);
      return res;
    },
  };
  w.member("alice");
  w.member("bob");
  w.member("carol", { role: "admin" });
  w.member("pat");
  w.P = w.project("Budget watch", "alice");
  w.Q = w.project("Other group", "bob");
  /* pat has joined P, so sees it whole (membership R44): only `sighted`'s rule withholds anything from pat. */
  membership.projectInvite({ projectId: w.P, handle: "h_pat", by: "alice" });
  membership.projectJoin({ projectId: w.P, by: "pat" });
  return w;
}

export function inquiryMd(id, { state = "open", prior = "null", target, extra = [] } = {}) {
  const concluded = state === "concluded";
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Does the cut follow from ${id}?"`,
    `current_state: ${state}`, `prior_state: ${prior}`, `created: "2026-09-27T00:00:00Z"`,
    `last_updated: "2026-09-27T00:00:00Z"`, "group: test-group",
    "references:", `  - target: ${target}`, "    rel: cites", "    status: confirmed",
    "state_history: []", "surfaced_by: human", 'disposition_reason: ""',
    "basis:", `  - target: ${target}`, "    role: supports",
    /* inquiry R11 enforces inquiry-grammar R1 at every write (K819): a concluded inquiry carries a conclusion, a
       falsifier and a basis leg. */
    ...(concluded ? ['conclusion: "The harm follows from the act."',
                     'falsifier: "a budget line restoring the fund would falsify this"'] : []),
    ...extra,
    "---", "", "## Question", "", `Does the cut follow from ${id}?`, "", word("conformance.rests"), "",
    "## Conclusion", "", concluded ? "The harm follows from the act." : "", "",
    word("conformance.falsify"), "", "## Session Log", "", "## Review Notes", ""].join("\n");
}

function infoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

function projMd(title, cites = []) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          ...(cites.length ? ["references:", ...cites.flatMap((t) => [`  - rel: cites`, `    target: ${t}`, `    status: confirmed`, `    note: ""`])]
                           : ["references: []"]), "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");
}

function provDoc(c) {
  return {
    file: c.path, locator: `https://example.org/${c.path}`, retrieved: "2026-09-27T00:00:00Z",
    authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
    capture: { method: "acquire", grade: "B", actor_class: "session", sha256: c.sha, encoding: "utf8",
               bytes: Buffer.byteLength(c.text) },
    origin: { kind: "named_request" },
  };
}

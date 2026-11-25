/* ratification over the modules it uses. record-core, membership, credentials, promotion and publication are the real
   ones, on a real SQLite database (node:sqlite) standing in for a Durable Object's storage: the head, the transaction,
   the authority and sight questions, the attesting keys (credentials R11, K757), the registrations (R8, R9), the mint
   seed (record-core R70), publication's tables and its two commits (R22, with R35) are theirs. The record carries
   inquiry-grammar's grammar (its R6, record-core R67), registered as the store's composition root registers it, so
   C-2.8's inquiry arm runs in op=ratify's gate as it does on the store's host (K790). What basis-versions, provenance and inquiry provide is a provider the test controls, as
   `ratificationOf`'s deps take them (the conclusion reads of R1, the gate facts of R7); so are the publication reads a
   test steers (the case document facts, the pins, what rests on a bundle). Every call to publication is recorded, so a
   test can say what this module handed it. Every test drives `ratification` at its interface: the store half
   (`ratificationOf`, `ratificationOps`) and the Worker half (`caseRatifyOp`, `ratifyOp`) with a Durable Object stub
   that routes to the store half. */
import { DatabaseSync } from "node:sqlite";
import { createHash, webcrypto } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { PROVENANCE_SCHEMA } from "../../../src/provenance/schema.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { registerInquiryGrammar } from "../../../src/inquiry-grammar/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { publicationOf } from "../../../src/publication/index.mjs";
import { publishScheduleOf } from "../../../src/publish-schedule/index.mjs";
import { ratificationOf, ratificationOps } from "../../../src/ratification/index.mjs";
import { ratifyStatement, caseRatifyStatement, NS_RATIFY } from "../../../src/sshsig.mjs";
import { methodBlockLines, materialBlockLines } from "../../../src/case-grammar/index.mjs";
import { GRADING_METHOD_VERSION } from "../../../src/strength/method.mjs";
import { CATALOG_VERSION } from "../../../src/promotion/index.mjs";
import { word } from "../../../src/setup-words/index.mjs";
import { holdsRegister } from "../provenance/fixtures.mjs";

/* K1321: every case document these fixtures sign is `/6` (publication R58 refuses committing any other), with its
   `method:` block and its `materials:` and `material_attestations:` blocks (empty), written by case-grammar's own
   writers (its R11, R12). */
const METHOD = Object.freeze({ grading: GRADING_METHOD_VERSION, checks: CATALOG_VERSION });

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

const bare = (schema) => schema.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");

export const V = (id) => `member:${id}`;
export const NOW = "2026-09-28T01:00:00Z";
export const PIN0 = "0".repeat(64);

/* ---------------------------------------------------------------- an SSHSIG signer (PROTOCOL.sshsig) */

const enc = (s) => new TextEncoder().encode(s);
const u8 = (...parts) => {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let o = 0; for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};
const u32 = (n) => new Uint8Array([(n >>> 24) & 255, (n >>> 16) & 255, (n >>> 8) & 255, n & 255]);
const sstr = (v) => { const b = typeof v === "string" ? enc(v) : v; return u8(u32(b.length), b); };
const b64 = (bytes) => Buffer.from(bytes).toString("base64");
const armor = (blob) =>
  `-----BEGIN SSH SIGNATURE-----\n${b64(blob).replace(/(.{70})/g, "$1\n")}\n-----END SSH SIGNATURE-----\n`;

export async function newKey() {
  const kp = await webcrypto.subtle.generateKey({ name: "Ed25519" }, true, ["sign", "verify"]);
  const raw = new Uint8Array(await webcrypto.subtle.exportKey("raw", kp.publicKey));
  return { priv: kp.privateKey, raw, keyB64: b64(u8(sstr("ssh-ed25519"), sstr(raw))) };
}

export async function sign(key, message, namespace = NS_RATIFY) {
  const h = new Uint8Array(await webcrypto.subtle.digest("SHA-512", typeof message === "string" ? enc(message) : message));
  const signed = u8(enc("SSHSIG"), sstr(namespace), sstr(new Uint8Array(0)), sstr("sha512"), sstr(h));
  const sig = new Uint8Array(await webcrypto.subtle.sign("Ed25519", key.priv, signed));
  return armor(u8(enc("SSHSIG"), u32(1), sstr(u8(sstr("ssh-ed25519"), sstr(key.raw))), sstr(namespace),
    sstr(new Uint8Array(0)), sstr("sha512"), sstr(u8(sstr("ssh-ed25519"), sstr(sig)))));
}
export const signCase = (key, caseId, edition, docSha) => sign(key, caseRatifyStatement(caseId, edition, docSha));
export const signBundle = (key, id, bundleSha) => sign(key, ratifyStatement(id, bundleSha));

/* ---------------------------------------------------------------- the world */

/** An in-memory R2 bucket over a Map of key to bytes. */
export const bucketOver = (m) => ({
  head: async (k) => (m.has(k) ? { size: m.get(k).length } : null),
  get: async (k) => (m.has(k) ? { body: m.get(k), arrayBuffer: async () => m.get(k) } : null),
  put: async (k, v) => { m.set(k, v instanceof Uint8Array ? v : new TextEncoder().encode(String(v))); },
});

export function world({ steer = {}, worker = null, carriage = null, schedule = null, retrieval = null } = {}) {
  const st = storage();
  const host = { storage: st };
  for (const t of bare(RECORD_SCHEMA).split(";")) if (t.trim()) st.db.exec(t);
  /* provenance's tables (its R48 read contract: `register`), which the real case-carriage joins when promotion reaches
     it (T39, K2377); the rows are the test's, as the store's composition root would migrate the tables */
  for (const t of bare(PROVENANCE_SCHEMA).split(";")) if (t.trim()) st.db.exec(t);
  /* record-core R38's evidence store, over an in-memory bucket (keys `bio/captures/<digest>`); R4's gate probes it */
  const evidence = new Map();
  const record = recordOf(host, { evidence: bucketOver(evidence), evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  /* credentials after membership, as the composition root migrates them (K789): its tables (signers among them), its
     listener and its claim fact registered with membership (its R16, R17, R20) */
  const credentials = credentialsOf(host, { record, membership });
  credentials.migrate();
  registerInquiryGrammar(record);
  const promotion = promotionOf(host, { record, membership, now: () => NOW });
  promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
  /* the columns of inquiry's `inquiry_basis` and connections' `refs` that R7's facts join, as their writers fill them */
  st.db.exec(`CREATE TABLE inquiry_basis (bundle_id TEXT NOT NULL, ord INTEGER NOT NULL, target_id TEXT NOT NULL)`);
  st.db.exec(`CREATE TABLE refs (bundle_id TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '',
                                 PRIMARY KEY (bundle_id, target_id, kind))`);

  /* basis-versions (R1's four reads, R7's reach), as the test sets them */
  const bv = { conc: new Map(), rec: new Map(), np: new Map(), drawing: new Map(), reach: { self: [], via: [] } };
  const key = (p, q) => `${p}\u0000${q}`;
  const basisVersions = {
    conclusionOf: (p, q) => bv.conc.get(key(p, q)) ?? null,
    conclusionRecordOf: (p, q) => bv.rec.get(key(p, q)) ?? { history: [], stance: null },
    noProjectConclusionOf: (q) => bv.np.get(q) ?? null,
    projectsDrawingOn: (q) => bv.drawing.get(q) ?? Object.assign([], { bound: 32, truncated: false }),
    testimonyReach: () => bv.reach,
  };
  /* provenance's register rows and inquiry's earned registry, for R7 */
  const registers = new Map();
  /* provenance R5's `registerHolds`, as the test sets it by hash: what the register's receipts and the bundle's record
     name for a whole hash the evidence store does not hold (nothing, by default) */
  const holds = new Map();
  /* provenance R66's standing decision on a capture's authority, as the test sets it by capture hash (nothing, by default) */
  const standing = new Map();
  /* what provenance's own `registerHolds` answers for a hash nothing registered or received, from its real code (its `fixtures.mjs`) */
  const nothingHeld = holdsRegister();
  const provenance = { registeredFor: (id) => registers.get(id) ?? [],
                       registerHolds: ({ sha }) => holds.get(sha) ?? nothingHeld.registerHolds({ sha }),
                       containerResolver: () => ({ holds: (a) => { const h = holds.get(a); return !!h && (h.registered === true || h.acquired === true); },
                                                   gradeVia: () => null, archiveOrigin: () => ({ found: false }),
                                                   authority: (a) => standing.get(a) ?? null }),
                       standing };
  const inquiry = { subjectEntityOf: (id) => `ENT-of-${id}`,
                    earned: (subject, targets) => ({ subject, earned: { capture: Object.fromEntries(targets.map((t) => [t, null])) } }) };

  /* publication: the real module (its tables, R22's two commits and the discharge, R35), with the reads a test steers
     — the case document facts, the pins, what rests on a bundle, the claims and the registries — answered from the maps below. Every call is recorded; a test replaces any method by assigning it. */
  const realPub = publicationOf(host, { storage: st, record, membership, promotion, now: () => NOW,
    inquiry: { exclusionsNaming: () => [] }, basisVersions: { testimonyReach: () => bv.reach },
    /* reevaluation R26: publication registers its R41 and R43 at creation (K359); nothing here reads them */
    reevaluation: { registerCaseParts: () => ({ ok: true }) },
    /* (T39) case-carriage's evidence bucket and store namespace, forwarded by publication (its `caseCarriage`), so a
       test can mark a real photo and carry its obscured copy (case-carriage R9–R14) */
    ...(carriage || {}) });
  const calls = [];
  const pub = { facts: new Map(), pins: new Map(), resting: new Map(), claims: new Map(), committed: [] };
  /* publication R38's cursor answer (N308), over `pub.resting`'s list for a bundle: one pin per entry, in list order,
     each a resting finding `{case_id, finding, project}` or null (a pin nothing rests on through). At most `limit`
     pins a page (default 1,000, clamped to 1–1,000); `cursor` is the last pin read (`<case>#<member>#<sha>`) while
     more follow, else null. A bundle with no list is answered by the real read. */
  const restingPage = (id, { after = null, limit = 1000 } = {}) => {
    const lim = Math.min(1000, Math.max(1, Number.isInteger(limit) ? limit : 1000));
    if (!pub.resting.has(id)) return realPub.ratifiedFindingsRestingOn(id, { after, limit });
    const pins = pub.resting.get(id).map((f, i) =>
      ({ key: `${f ? f.case_id : "CASE-2026-9999"}#${f ? f.finding : "INQ-none"}#${String(i).padStart(64, "0")}`, f }));
    const from = after === null || after === undefined ? 0 : pins.findIndex((p) => p.key === after) + 1;
    const read = pins.slice(from, from + lim);
    return { findings: read.filter((p) => p.f).map((p) => ({ ...p.f })), limit: lim,
             cursor: from + lim < pins.length ? read[read.length - 1].key : null };
  };
  const steered = {
    caseDocumentFacts: (c, e) => pub.facts.get(`${c}#${Number(e)}`) ?? { ok: false, reason: "NO_CASE_DOCUMENT" },
    pinnedCaseEditionsOf: (id, s) => pub.pins.get(`${id}@${s}`) ?? realPub.pinnedCaseEditionsOf(id, s),
    ratifiedFindingsRestingOn: (id, opts = {}) => restingPage(id, opts),
    caseClaimsOf: (id) => pub.claims.get(id) ?? [],
    publishedRegistryFor: (id, targets) => ({ asked: [id, ...targets] }),
    publishedCaseRegistryFor: (ids) => ({ cases: ids }),
    commitCaseEdition: (a) => { pub.committed.push(a); return realPub.commitCaseEdition(a); },
    /* a test's own stand-ins (publication R62), present at creation */
    ...steer,
  };
  const publication = new Proxy(steered, {
    get(t, k) {
      const fn = Object.prototype.hasOwnProperty.call(t, k) ? t[k]
        : typeof realPub[k] === "function" ? realPub[k].bind(realPub) : realPub[k];
      return typeof fn === "function" ? (...a) => { calls.push([k, ...a]); return fn(...a); } : fn;
    },
  });
  /* case-tensions: the real module publication created on this host (its R61's provider registered), with the two
     attribution reads op=ratify's gate makes steered (T35-57: this module reads them, `attributionFacts` and
     `dischargeCaseFlags` directly, never through publication). Every call is recorded in `calls`, as publication's; a
     test replaces any method by assigning it. */
  const realTensions = realPub.caseTensionsModule;
  const steeredTensions = { attributionStatedFor: () => false, observationsNamingAuthor: () => [] };
  const caseTensions = new Proxy(steeredTensions, {
    get(t, k) {
      const fn = Object.prototype.hasOwnProperty.call(t, k) ? t[k]
        : typeof realTensions[k] === "function" ? realTensions[k].bind(realTensions) : realTensions[k];
      return typeof fn === "function" ? (...a) => { calls.push([k, ...a]); return fn(...a); } : fn;
    },
  });
  /* capture's reader registration (its R78; R34 here), recorded as the test reads it; R34's own tests boot the real one */
  const readers = [];
  /* strength R30's corroboration read (R35), answered from `corroboration` (inquiry id -> its answered legs; none by
     default), each call kept in `corroborationAsked` */
  const corroboration = new Map(), corroborationAsked = [];
  /* reevaluation R29's `levelMoved` (R36), each call kept in `levelMoves` */
  const levelMoves = [];
  const reevaluation = { levelMoved: (a) => (levelMoves.push(a), { ok: true, moved: true }) };
  const strength = { testimonyCorroboration: (a) => (corroborationAsked.push(a),
    { ok: true, inquiry: a.inquiry, levels: a.levels, legs: corroboration.get(a.inquiry) ?? [], wrote: false }) };
  /* network-notices R17's `openSeals` (R37), a stand-in: each call kept in `sealCalls`, answered by `w.openSeals`, which
     a test replaces (a throw, a rejection, a refusal); R37's test also boots the real module */
  const sealCalls = [];
  const networkNotices = { openSeals: (a) => (sealCalls.push(a), w.openSeals(a)) };
  /* people R20's `tiesConcerning` and money's `readFact` (R41's `ties`), answered from `ties` (member -> ties) and
     `moneyFacts` (fact id -> fact), each call kept in `tiesAsked` */
  const ties = new Map(), moneyFacts = new Map(), tiesAsked = [];
  const people = { tiesConcerning: (a) => (tiesAsked.push(a), { ok: true, member: a.member,
    ties: (ties.get(a.member) ?? []).filter((t) => a.entities.includes(t.entity)) }) };
  const money = { readFact: ({ factId }) => (moneyFacts.has(factId) ? { ok: true, found: true, fact_id: factId, fact: moneyFacts.get(factId) }
                                                                  : { ok: true, found: false, fact_id: factId, fact: null }) };
  const capture = { registerReader: (slot, module, fn) => (readers.push({ slot, module, fn }), { ok: true, slot, module }) };
  const r = ratificationOf(host, { storage: st, record, membership, credentials, promotion, provenance, inquiry,
                                   ...(retrieval ? { retrieval } : {}),
                                   basisVersions, publication, caseTensions, capture, strength, reevaluation,
                                   networkNotices, people, money, ...(worker ? { worker } : {}),
                                   /* publish-schedule (N823): a stand-in the test passes, else the real module on
                                      this host, on the world's clock (`w.schedule`), which ratification's factory
                                      registers its publisher with (R43) */
                                   publishSchedule: schedule || publishScheduleOf(host, { storage: st, record, membership,
                                     publication, now: () => NOW }) });
  let n = 0;
  const w = {
    st, host, record, membership, credentials, promotion, provenance, r, schedule: r.publishSchedule, bv, key, registers, holds, evidence, pub, publication,
    caseTensions, calls, readers, corroboration, corroborationAsked, levelMoves, sealCalls, realPub, ties, moneyFacts, tiesAsked,
    openSeals: async (a) => ({ ok: true, case: a.case, edition: a.edition, project: null, opened: [], attestation: null }),
    ops: {},   /* stand-ins for other modules' Durable Object ops, by name (the Worker half's tests) */
    row: (q, ...a) => st.sql.exec(q, ...a)[0] ?? null,
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)[0].n,
    sha: (id) => record.head(id)?.bundleSha ?? null,
    /** An active member, and optionally a registered active signing key (a credentials `signers` row, as R6 leaves
     *  one). */
    member(id, { role = "member", signer = null } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, 'active', '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role);
      if (signer) st.sql.exec(`INSERT INTO signers (key_b64, member_id, status, added) VALUES (?, ?, 'active', 't')`,
                              signer.keyB64, id);
    },
    /** A project owned (and so joined) by `owner`; `joined` more members join it without owning it. */
    project(title, owner, { joined = [] } = {}) {
      const res = promotion.promote({ base: null, snapKey: `k${++n}`, author: V(owner), ownerMemberId: owner,
        files: [{ path: "bundle.md", text: projMd(title) }], meta: { object_type: "project" } });
      if (!res.ok) throw new Error(`fixture project refused: ${JSON.stringify(res).slice(0, 400)}`);
      for (const m of joined)
        st.sql.exec(`INSERT INTO project_participants (project_id, member_id, state, owner, created, updated)
                     VALUES (?, ?, 'joined', 0, 't', 't')`, res.bundleId, m);
      return res.bundleId;
    },
    /** A bundle promoted with `text` as its bundle.md (a creation, or a revision of the head). */
    promote(id, text, type = "inquiry") {
      const head = record.head(id);
      const res = promotion.promote({ bundleId: id, base: head ? head.bundleSha : null, snapKey: `k${++n}`,
        author: V("alice"), files: [{ path: "bundle.md", text }], meta: { object_type: type } });
      if (!res.ok) throw new Error(`fixture promote refused: ${JSON.stringify(res).slice(0, 600)}`);
      return res;
    },
    inquiry(id, opts = {}) { return w.promote(id, inqMd(id, opts)); },
    info(id) { return w.promote(id, infoMd(id), "information"); },
    /** A case document stored unsigned through publication's R21; its sha. `owner` also records the case as that
     *  project's production, as an earlier edition's commit would have. */
    caseDoc(caseId, edition, text, { owner = null } = {}) {
      const res = realPub.storeCaseDocument({ case: caseId, edition, text, author: "member:alice", at: NOW });
      if (!res.ok) throw new Error(`fixture case document refused: ${JSON.stringify(res)}`);
      if (owner) st.sql.exec(`INSERT INTO cases (case_id, project_id, opened) VALUES (?, ?, ?)`, caseId, owner, NOW);
      return res.doc_sha;
    },
    /** The store half's ops, as the plane's op map (`plane/store.mjs`) reaches them through `ratificationOps` (R32). */
    op(name, query = {}, body = null) {
      const url = new URL(`http://do/${name}`);
      for (const [k, v] of Object.entries(query)) if (v !== null && v !== undefined) url.searchParams.set(k, String(v));
      return ratificationOps(r, url, body)[name]();
    },
  };
  return w;
}

/* ---------------------------------------------------------------- documents */

export function inqMd(id, { state = "open", extra = [] } = {}) {
  return ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Question ${id}"`,
          `current_state: ${state}`, "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "surfaced_by: human", "group: test-group", "references: []",
          "state_history: []", ...extra, "---", "", "## Question", "", "What happened?", "", "## Session Log", ""].join("\n");
}

export function infoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

export function projMd(title) {
  return ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
          "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
          "references: []", "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");
}

/** A /6 case document's text (the format op=publish authors) over `members` ([{id, pin, role}]), with `conclusions` rows ([[member, conclusion]])
 *  written by this module's one writer, and `extra` frontmatter lines. */
export function caseMd({ caseId, edition, project, members, conclusions = [], extra = [], rowLines }) {
  return ["---", "format: bio-case-document/6", `case_id: ${caseId}`, `case_edition: ${edition}`,
    `case_project: ${project}`, `case_scope: "whether the permits were issued as the minutes say"`,
    `bias_acknowledgement: "we expected the permits were late"`,
    "case_findings:", ...members.map((m) => `  - ${m.id}`),
    "case_roles:", ...members.flatMap((m) => [`  - target: ${m.id}`, `    role: ${m.role || "load_bearing"}`,
                                              `    version_sha: ${m.pin}`, `    edition: 1`]),
    ...(conclusions.length ? ["case_conclusions:", ...conclusions.flatMap(([m, c]) => rowLines(m, c))] : []),
    ...methodBlockLines(METHOD), ...materialBlockLines({}), ...extra, "---", "", "# Case", "", "## What This Excludes", "", "Nothing named.", "",
    "## What Changed in This Edition, and Why", "", "The roster was revised.", ""].join("\n");
}

/** A frontmatter document from an object, in the catalogue's restricted grammar (scalars, lists of scalars, maps of
 *  scalars, lists of maps of scalars), `raw` lines appended to the frontmatter, and `body`. */
export function fmText(obj, { raw = [], body = "" } = {}) {
  const sc = (v) => (v === null || v === undefined ? "null" : typeof v === "string" ? JSON.stringify(v) : String(v));
  const lines = ["---"];
  for (const [k, v] of Object.entries(obj)) {
    if (Array.isArray(v)) {
      if (!v.length) { lines.push(`${k}: []`); continue; }
      lines.push(`${k}:`);
      for (const x of v) {
        if (x && typeof x === "object") Object.entries(x).forEach(([kk, vv], i) => lines.push(`${i ? "    " : "  - "}${kk}: ${sc(vv)}`));
        else lines.push(`  - ${sc(x)}`);
      }
    } else if (v && typeof v === "object") {
      lines.push(`${k}:`);
      for (const [kk, vv] of Object.entries(v)) lines.push(`  ${kk}: ${sc(vv)}`);
    } else lines.push(`${k}: ${sc(v)}`);
  }
  return [...lines, ...raw, "---", "", body].join("\n");
}

/** A catalogue-clean information bundle.md (the gate draws no finding over it alone). */
export function cleanInfoMd(id) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "A report"`,
    "current_state: collected", "prior_state: null", `created: "2026-07-01T00:00:00Z"`, `last_updated: "2026-07-01T00:00:00Z"`,
    "group: test-group", "produced_by:", "  mode: human", "  capability_tier: none", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending: false", "visuals: []", "criticality: supporting", "source_status: unchanged",
    "source:", "  locator: https://example.org/a", "  authority: the publisher", `  retrieved: "2026-07-01T00:00:00Z"`,
    "monitoring:", "  enabled: false", "  frequency: none", "---", "", "## Summary", "", "A document.", "",
    "## Provenance Notes", "", "None.", "", "## Review Notes", "", "## Session Log", ""].join("\n");
}

/** A catalogue-clean bio-case-document/6 as an object, the format op=publish authors, with its tension section empty
 *  (`checkCaseDocument` draws no finding over it). */
export function cleanCase({ caseId, edition, project, members }) {
  return {
    format: "bio-case-document/6", case_id: caseId, case_edition: edition, case_project: project,
    case_scope: "whether the permits were issued as the minutes say", bias_acknowledgement: "we expected them late",
    case_findings: members.map((m) => m.id),
    case_roles: members.map((m, i) => ({ target: m.id, role: i ? "supporting" : "load_bearing", version_sha: m.pin, edition: 1 })),
    completeness: { statement: "the 2019 permits are not covered", author: "alice", at: "2026-09-28T00:00:00Z",
                    subject_position: "not_sought", subject_justification: "the office is closed", acknowledged: 0,
                    statement_by: "alice" },
    completeness_acknowledgements: [], completeness_excluded: [],
    searched: { subject_source: "case_basis", subjects: 1 }, searched_levels: [],
    required_strength: { declared: false },
    bias_manifest: { in_force: false, stated: word("bias.manifest_force"), pins_proposed: 0,
                     pins_proposed_stated: "no adoption pinned a proposed revision" },
    bias_manifest_bundles: [], bias_manifest_pins_proposed: [], case_citations: [],
    case_strength: members.flatMap((m) => [{ target: m.id, axis: "capture", state: "unrated", grade: null },
                                           { target: m.id, axis: "connection", state: "unrated", grade: null }]),
    case_strength_grounds: [], case_tensions: [], case_tension_sentences: [], case_tensions_unread: [],
    method: { ...METHOD }, materials: [], material_attestations: [],
  };
}
export const CASE_BODY = "# Case\n\n## What This Excludes\n\nNothing named.\n\n## What Changed in This Edition, and Why\n\nThe roster was revised.\n";

/* ---------------------------------------------------------------- the Worker half's control plane */

export const SILENT = Symbol("silent");

/** What the control plane hands `caseRatifyOp` / `ratifyOp`: a Durable Object stub routing to this world's store half
 *  (and to stand-ins for the other modules' ops, `w.ops`), in-memory buckets, and its helpers. A stand-in answering
 *  `SILENT` is a store that did not answer. */
export function plane(w, { session = { role: "member:alice" }, viaSession = true, aiCred = null, cls = "session",
                           viewer = V("alice") } = {}) {
  const captures = new Map(), published = new Map(), assembled = [], fetched = [];
  const stub = {
    async fetch(u, init) {
      const req = u instanceof Request ? u : new Request(u, init);
      const url = new URL(req.url);
      const op = url.pathname.slice(1);
      const body = req.method === "POST" ? await req.json() : null;
      fetched.push(op);
      if (w.ops[op]) return w.ops[op](url, body);
      const q = (k) => url.searchParams.get(k);
      if (op === "casedocfacts") return w.publication.caseDocumentFacts(q("case"), q("edition"), q("viewer"));
      if (op === "image") { const img = w.record.readImage(q("id")); return img || {}; }
      if (op === "list") return w.st.sql.exec(`SELECT bundle_id FROM bundles`);
      if (op === "reusedparts") return { parts: [] };
      if (op === "capturelimit") return { observed: null };
      if (op === "recordreuseverdicts") return { ok: true };
      const mine = ratificationOps(w.r, url, body)[op];
      if (mine) return mine();
      throw new Error(`no op ${op}`);
    },
  };
  const bucket = bucketOver;
  const json = (body, status = 200) => ({ status, body });
  const ctx = {
    env: { CAPTURES: bucket(captures), PUBLISHED: bucket(published) }, json, storeName: "s", // fixtures-contract: answer-envelope door-helpers
    doAnswer: async (p) => { const v = await p; return v === SILENT ? { answered: false } : { answered: true, result: v }; },
    storeSilent: (op) => json({ ok: false, reason: "STORE_SILENT", op }, 502),
    assembleCaseContainer: async (a) => { assembled.push(a); return { manifest_sha: "m".repeat(64), zip: "z" }; },
    cls, aiCred, viaSession, sessViewer: viewer, sessRights: session,
    captureKey: (store, s) => `${store}/captures/${s}`, withBiasChecks: (image, gate) => gate,
    STORE_SILENT_REASON: "STORE_SILENT", STORE_SILENT_DETAIL: "the store did not answer",
  };
  const request = (body) => new Request("http://plane/op", { method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body) });
  return { stub, ctx, request, captures, published, assembled, fetched };
}

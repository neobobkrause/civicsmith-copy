/* docket over the modules it uses, the real ones where a test needs their behaviour (record-core, membership,
   credentials, promotion, provenance, attestation, publication's tables, signatures), on a real SQLite database
   (node:sqlite) standing in for a Durable Object's storage, answering as workerd's does (a cursor). Members, project
   participations and signer keys are rows of their modules' own tables, written as those modules' acts would leave them;
   a case and its editions are rows of publication's tables (its R40), written as its commit would leave them; a capture
   is a register row with its origin locator (provenance R48), homed on an Information bundle whose `data/provenance.json`
   states its co-archive and origin (attestation R7, acquisition R21), with its bytes in a stubbed evidence bucket.
   Neighbours are stand-ins the test controls, each answering exactly the service docket reads: `inquiry`'s
   `subjectEntityOf` (its R43), `entities`' `readEntity` (its R5), and `contradiction`'s `unresolvedRecordOn` (its R29), which
   the real `case-tensions` reads for its `caseTensions` (its R4) through the provider the real `publication` registers
   (its R61). `publication`'s `stampEdition` and `registerOrderSource` (its R62) are the real module's, reached through a
   pass-through that a test can make refuse or throw, to show the post undone; and `reevaluation` is a recorder of
   `registerDocket` and `docketActed` (its R30), which can be made to throw. `project-roster`'s `projectScope` (its R23) is a
   stand-in answering each project's scope (`none` unless a test sets one). `events` is the real module (its R30). The group slug
   is the fact `producingGroup` (promotion R40), registered as instance-setup does. Every test drives `docket` at its
   interface. */
import { DatabaseSync } from "node:sqlite";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { membershipOf, PROJECT_AUTHORITY_CHECKS } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { provenanceOf } from "../../../src/provenance/index.mjs";
import { attestationOf } from "../../../src/attestation/index.mjs";
import { publicationOf } from "../../../src/publication/index.mjs";
import { docketOf } from "../../../src/docket/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { caseTensionsOf } from "../../../src/case-tensions/index.mjs";
import { signSshsig, signerPublicLine } from "../../../scripts/sign-sshsig.mjs";
import { NS_DOCKET, docketStatement } from "../../../src/sshsig.mjs";
import { canonicalJson } from "../../../src/record-grammar/json.mjs";

const bind = (v) => (v === undefined ? null : typeof v === "boolean" ? (v ? 1 : 0) : v);
function cursor(rows) {
  let i = 0;
  const c = {
    next() { return i < rows.length ? { done: false, value: rows[i++] } : { done: true, value: undefined }; },
    [Symbol.iterator]() { return c; },
    toArray() { const out = rows.slice(i); i = rows.length; return out; },
    one() { const rest = c.toArray(); if (rest.length !== 1) throw new Error(`Expected exactly one result, got ${rest.length}`); return rest[0]; },
  };
  return c;
}
export function storage() {
  const db = new DatabaseSync(":memory:");
  let n = 0;
  const sql = { exec(q, ...args) {
    const st = db.prepare(q);
    return cursor(st.columns().length ? st.all(...args.map(bind)).map((r) => ({ ...r })) : (st.run(...args.map(bind)), []));
  } };
  return { db, sql, transactionSync(fn) {
    const sp = `sp${n++}`;
    db.exec(`SAVEPOINT ${sp}`);
    try { const r = fn(); db.exec(`RELEASE ${sp}`); return r; }
    catch (e) { db.exec(`ROLLBACK TO ${sp}`); db.exec(`RELEASE ${sp}`); throw e; }
  } };
}

export const V = (id) => `member:${id}`;
/** K4557, K231: the one refusal for a member not yet joined (invited, or no part in the project), `membership`'s own row,
 *  answered by every docket act that needs a joined member; `act` is the op's door name. */
export const NOT_JOINED = "PROJECT_ACT_NOT_A_PARTICIPANT";
export function notJoinedOk(r, act) {
  assert.equal(r.ok, false, JSON.stringify(r).slice(0, 200));
  assert.equal(r.reason, NOT_JOINED);
  assert.equal(r.code, NOT_JOINED);
  assert.equal(r.check, PROJECT_AUTHORITY_CHECKS[NOT_JOINED].check);
  assert.equal(r.translation, PROJECT_AUTHORITY_CHECKS[NOT_JOINED].translation);
  assert.equal(r.act, act);
}
export const MACHINE = "class:ai";
export const SLUG = "test-group";
export const DAY = 86400000, HOUR = 3600000;
/** Thursday 2026-10-01, noon UTC: the fixture's "now" unless a test moves the clock. */
export const NOW = Date.parse("2026-10-01T12:00:00Z");
export const sha = (s) => createHash("sha256").update(s).digest("hex");
export const iso = (ms) => new Date(ms).toISOString().replace(/\.\d{3}Z$/, "Z");
export const CASE = "CASE-2026-0101";
export const SUBJECT = "ENT-2026-0001-mayor";
export const SUBJECT_NAME = "Office of the Mayor";
export const OTHER_SUBJECT = "ENT-2026-0002-clerk";

/** A member's ratification key (the browser signer's envelope form) and its wire base64. */
export function keyFor(label) {
  const seed = createHash("sha256").update(`seed:${label}`).digest();
  const env = `BIOKEY-RAW1.bio-ratify.${seed.toString("base64")}`;
  return { env, b64: signerPublicLine(env).split(" ")[1] };
}

/** The evidence bucket, as R2 answers: `get` an object with `arrayBuffer`, or null. */
function bucket() {
  const m = new Map();
  return { m, gets: [],
    head: async (k) => (m.has(k) ? { key: k } : null),
    get: async function (k) { this.gets.push(k); const b = m.get(k); return b ? { arrayBuffer: async () => b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength) } : null; },
    put: async (k, b) => { m.set(k, new Uint8Array(b)); return { key: k }; } };
}

export function world({ slug = SLUG, before = null } = {}) {
  const st = storage();
  const host = { storage: st, env: {} };
  const bare = RECORD_SCHEMA.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
  for (const t of bare.split(";")) if (t.trim()) st.db.exec(t);
  const clock = { now: NOW };
  const evidence = bucket();
  const record = recordOf(host, { evidence, evidencePrefix: "bio/captures/" });
  record.migrate();
  const membership = membershipOf(host, { record });
  membership.migrate();
  const credentials = credentialsOf(host, { record, membership });
  credentials.migrate();
  const promotion = promotionOf(host, { record, membership });
  if (slug) promotion.registerFact("producingGroup", "instance-setup", () => slug);
  const provenance = provenanceOf(host, { record, membership, promotion, now: () => iso(clock.now) });
  provenance.migrate();
  const attestation = attestationOf(host, { record, provenance, signingKey: null, now: () => iso(clock.now) });
  const tensions = { list: [], asked: [] };
  /* contradiction R29: the candidates `tensions.list` names on a finding, at whatever pin is asked. */
  const contradiction = { unresolvedRecordOn: ({ finding }) => { tensions.asked.push(finding);
    return { ok: true, candidates: tensions.list.filter((t) => t.member === finding).map((t) => ({ candidate: t.candidate, state: t.state })) }; } };
  /* case-tensions first, with the stand-in contradiction, so publication's factory registers its provider on it */
  const caseTensions = caseTensionsOf(host, { record, membership, promotion, contradiction, now: () => iso(clock.now) });
  const realPublication = publicationOf(host, { record, membership, promotion, now: () => iso(clock.now) });
  /* publication R62, the real module's; `stamps.refuse` (publication's own refusal, from its published `stampEditionRefusal`) or `stamps.throws` makes the pass-through refuse or throw */
  const stamps = { calls: [], refuse: null, throws: false,
    get list() {
      return [...st.sql.exec(`SELECT case_id, edition FROM edition_stamps GROUP BY case_id, edition ORDER BY MIN(rowid)`)]
        .flatMap((r) => realPublication.stampsOf({ case: r.case_id, edition: Number(r.edition) }).stamps)
        .sort((a, b) => a.entry - b.entry || a.edition - b.edition);
    } };
  const publication = {
    registerOrderSource: (...a) => realPublication.registerOrderSource(...a),
    stampEdition(q) {
      stamps.calls.push(q);
      if (stamps.throws) throw new Error("stamp store down");
      if (stamps.refuse) return stamps.refuse;
      return realPublication.stampEdition(q);
    } };
  const subjects = new Map();
  const names = new Map([[SUBJECT, SUBJECT_NAME], [OTHER_SUBJECT, "City Clerk"]]);
  const inquiry = { subjectEntityOf: (id) => subjects.get(id) ?? null };
  const entities = { readEntity: ({ entityId }) => (names.has(entityId)
    ? { ok: true, found: true, entity: { entity_id: entityId, label: `label of ${entityId}`,
        aliases: [{ alias: `alias of ${entityId}`, canonical: false }, { alias: names.get(entityId), canonical: true }] } }
    : { ok: true, found: false, entity_id: entityId, entity: null }) };
  const reeval = { registrations: [], acted: [], throws: false,
    registerDocket(module, fns) { reeval.registrations.push({ module, fns }); return { ok: true, module }; },
    docketActed(q) { reeval.acted.push(q); if (reeval.throws) throw new Error("listener down"); return { ok: true, told: true }; } };
  /* project-roster R23 (T45): each project's scope, `none` unless a test sets one; `roster.throws` makes the read throw. */
  const roster = { scopes: new Map(), asked: [], throws: false,
    projectScope(id) { roster.asked.push(id); if (roster.throws) throw new Error("roster down");
      const scope = roster.scopes.get(id);
      return scope ? { scope, since: "2026-10-01T00:00:00Z", by: "member:alice" } : { scope: "none", since: null, by: null }; } };
  let n = 0;
  const w = {
    st, host, roster, caseTensions, publication: realPublication, record, membership, credentials, promotion, provenance, attestation, clock, evidence, subjects, names, tensions, reeval, stamps,
    rows: (q, ...a) => [...st.sql.exec(q, ...a)],
    count: (t) => st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`).one().n,
    /** Every table's rows, for "nothing written" and "byte-identical" (the record's own and every module's here). */
    snapshot(prefix = "") {
      const out = {};
      for (const { name } of st.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' AND name LIKE ? ORDER BY name`, `${prefix}%`))
        out[name] = JSON.stringify([...st.sql.exec(`SELECT * FROM ${name}`)]);
      return out;
    },
    member(id, { role = "member", status = "active", key: withKey = true } = {}) {
      st.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                   VALUES (?, ?, ?, ?, ?, '["contribute"]', 't', 't')`, id, `Cover ${id}`, `h_${id}`, role, status);
      if (withKey) st.sql.exec(`INSERT INTO signers (key_b64, member_id, comment, status, added) VALUES (?, ?, 'k', 'active', ?)`,
                               keyFor(id).b64, id, "2026-09-01T00:00:00Z");
    },
    commit(id, { at = clock.now, author = V("alice"), project = null, type = "information", state = "collected", files = null } = {}) {
      const head = record.head(id);
      const body = ["---", `id: ${id}`, `object_type: ${type}`, `title: "${id}"`, `current_state: ${state}`,
                    ...(project ? [`project: ${project}`] : []), "---", "", `${n}`, ""].join("\n");
      const fs = [{ path: "bundle.md", text: body, sha256: sha(body), bytes: Buffer.byteLength(body) }, ...(files || [])];
      record.transact(() => record.commit({ bundleId: id, type, title: id, project, snapKey: `s${++n}`, kind: "promotion",
        base: head ? head.bundleSha : sha(""), author, writer: null, operation: null, files: fs, state, priorState: null,
        group: SLUG, created: iso(at), lastUpdated: iso(at), criticality: null, at: iso(at) }));
      return id;
    },
    project(slug_, owner) {
      const id = `PROJ-2026-${String(++n).padStart(4, "0")}-${slug_}`;
      w.commit(id, { at: Date.parse("2026-01-05T09:00:00Z"), author: V(owner), type: "project", state: "forming" });
      w.join(id, owner, "joined", true);
      return id;
    },
    join(projectId, memberId, state = "joined", owner = false) {
      st.sql.exec(`INSERT OR REPLACE INTO project_participants (project_id, member_id, state, owner, created, updated)
                   VALUES (?, ?, ?, ?, 't', 't')`, projectId, memberId, state, owner ? 1 : 0);
    },
    /** A ratified edition of case `caseId` of `pid`, its members `[{id, role, sha}]`, and its signed case document;
     *  `document` its text as the case document's own author wrote it (a provider's fixture), else a bare `/5` one. */
    publish(pid, caseId, edition, members, { whatChanged = null, at = clock.now, document = null } = {}) {
      st.sql.exec(`INSERT OR IGNORE INTO cases (case_id, project_id, opened) VALUES (?, ?, ?)`, caseId, pid, iso(at));
      st.sql.exec(`INSERT INTO published_cases (case_id, edition, opened, ratified_at, scope) VALUES (?, ?, ?, ?, ?)`,
                  caseId, edition, iso(at), iso(at), "What the case covers.");
      members.forEach((m, i) => st.sql.exec(`INSERT INTO published_case_members (case_id, edition, ord, bundle_id, version_sha, role)
                                              VALUES (?, ?, ?, ?, ?, ?)`, caseId, edition, i, m.id, m.sha ?? sha(m.id), m.role ?? "supporting"));
      const text = document ?? ["---", "format: bio-case-document/5", `case_id: ${caseId}`, `edition: ${edition}`, "---", "",
                    `# Case ${caseId}`, "", ...(whatChanged ? ["## What Changed in This Edition, and Why", "", whatChanged, ""] : [])].join("\n");
      st.sql.exec(`INSERT INTO case_documents (case_id, edition, doc_sha, text, authored_by, authored_at, sig_armored, ratified_at)
                   VALUES (?, ?, ?, ?, 'member:alice', ?, 'SIG', ?)`, caseId, edition, sha(text), text, iso(at), iso(at));
    },
    /** A capture the register holds with its origin locator; `archived` its co-archive's locator; `sweep` filed by one. */
    capture(label, { archived = true, sweep = false, locator = null, held = true } = {}) {
      const bytes = Buffer.from(`the captured bytes of ${label}`, "utf8");
      const s = sha(bytes);
      const id = `INFO-2026-${String(++n).padStart(4, "0")}-cap`;
      const address = locator || `https://news.example/${label}`;
      const doc = { file: "doc.html", capture: { sha256: s, grade: "B", actor_class: "member" },
                    origin: sweep ? { kind: "sweep", matched_sweep: "SWEEP-1", deeming_actor: "member:alice" } : { kind: "member" },
                    ...(archived ? { co_archive: { service: "web.archive.org", locator: `https://web.archive.org/web/2026/${address}` } } : {}) };
      const reg = JSON.stringify({ documents: [doc] });
      w.commit(id, { files: [{ path: "data/provenance.json", text: reg, sha256: sha(reg), bytes: Buffer.byteLength(reg) }] });
      st.sql.exec(`INSERT INTO register (capture_sha, bundle_id, path, encoding, bytes, registered) VALUES (?,?,?,?,?,?)`,
                  s, id, "doc.html", "identity", bytes.length, iso(clock.now));
      if (held) st.sql.exec(`INSERT INTO captured_locators (address_norm, address, capture_sha, first_retrieved, last_retrieved)
                             VALUES (?,?,?,?,?)`, address.toLowerCase(), address, s, iso(clock.now), iso(clock.now));
      evidence.m.set(`bio/captures/${s}`, new Uint8Array(bytes));
      return { sha: s, bytes, origin: address, archived: archived ? `https://web.archive.org/web/2026/${address}` : null };
    },
  };
  if (typeof before === "function") before(w);
  w.events = eventsOf(host, { record, membership, provenance, now: () => clock.now });
  w.docket = docketOf(host, { record, membership, credentials, promotion, provenance, attestation, inquiry, entities,
                              reevaluation: reeval, publication, caseTensions, events: w.events, projectRoster: roster,
                              now: () => clock.now });
  return w;
}

/** The common world: alice owner of P (the manager), bob joined in P, carol invited (not joined), dave owner of Q (who
 *  sees nothing of P); case CASE of P at edition 1 with findings F1 (load-bearing, subject SUBJECT) and F2; captures
 *  `cap` (archived, pasted) and `swept` (archived, filed by a sweep) and `bare` (no co-archive). */
export function seeded(opts = {}) {
  const w = world(opts);
  for (const m of ["alice", "bob", "carol", "dave"]) w.member(m);
  w.P = w.project("budget", "alice");
  w.join(w.P, "bob");
  w.join(w.P, "carol", "invited");
  w.Q = w.project("harbour", "dave");
  w.F1 = "INQ-2026-0001-transfers";
  w.F2 = "INQ-2026-0002-contracts";
  w.subjects.set(w.F1, SUBJECT);
  w.publish(w.P, CASE, 1, [{ id: w.F1, role: "load_bearing" }, { id: w.F2, role: "supporting" }]);
  w.cap = w.capture("reply");
  w.swept = w.capture("statement", { sweep: true });
  w.bare = w.capture("column", { archived: false });
  return w;
}

/** R1 (T45): the fields an `outcome` entry states beside its kind: what it was, when, and the member's summary. */
export const OUTCOME = { kind: "outcome", outcome: { kind: "cure", on: "2026-09-30" }, summary: "The office corrected the published totals." };
/** A response from the subject, proposed for both, by bob unless named. */
export const RESPONSE = (w) => ({ case: CASE, edition: 1, kind: "response", from: { kind: "subject", entity: SUBJECT },
                                  capture: w.cap.sha, proposed: "both", reason: "The subject's reply to edition 1." });
export const file = (w, x = {}, who = "bob") => w.docket.docketFile({ ...RESPONSE(w), author: V(who), viewer: V(who), ...x });
/** Prepares as `who` (alice, the manager, by default). */
export const prepare = (w, x = {}, who = "alice") => w.docket.docketPrepare({ case: CASE, shelf: "listed", by: V(who), viewer: V(who), ...x });
/** Signs a prepared answer's statement with `who`'s key, in the docket namespace. */
export const sign = (prep, who = "alice", ns = NS_DOCKET) => signSshsig(keyFor(who).env, Buffer.from(prep.statement, "utf8"), ns);
/** Prepares, signs and posts; throws on any refusal. */
export async function post(w, x = {}, who = "alice") {
  const p = prepare(w, x, who);
  if (!p.ok) throw new Error(`fixture prepare refused: ${JSON.stringify(p).slice(0, 300)}`);
  const r = await w.docket.docketPost({ digest: p.digest, signature: sign(p, who), acknowledged: true, by: V(who), viewer: V(who) });
  if (!r.ok) throw new Error(`fixture post refused: ${JSON.stringify(r).slice(0, 300)}`);
  return { ...r, prepared: p };
}
/** Files a record entry and places it in public. */
export async function fileAndPlace(w, x = {}, place = {}) {
  const f = file(w, x);
  if (!f.ok) throw new Error(`fixture file refused: ${JSON.stringify(f).slice(0, 300)}`);
  const kind = x.kind || "response";
  return { filed: f, posted: await post(w, { kind, entry: f.entry, shelf: kind === "reaction" ? "reactions" : "listed", ...place }) };
}

/** R6: a public entry as the code before T31 published it, under the old label `civicos-docket-entry/1`, signed by `who`
 *  over `signatures.docketStatement`: its row exactly as that code's post left it (the stored bytes, digest, signature,
 *  signing key and instant). `fields` are the entry's own (kind, shelf, edition, and by kind); the chain's fields are
 *  filled from the docket as it stands. */
export function legacyEntry(w, fields, who = "alice") {
  const prior = w.rows(`SELECT seq, digest FROM docket_entries WHERE case_id=? ORDER BY seq DESC LIMIT 1`, CASE)[0];
  const seq = prior ? Number(prior.seq) + 1 : 1;
  const json = { format: "civicos-docket-entry/1", group: SLUG, case: CASE, seq, previous: prior ? prior.digest : null,
                 date: iso(w.clock.now).slice(0, 10), ...fields };
  const text = canonicalJson(json);
  const digest = sha(text);
  const signature = signSshsig(keyFor(who).env, Buffer.from(docketStatement(CASE, seq, digest)), NS_DOCKET);
  w.st.sql.exec(`INSERT INTO docket_entries (case_id, seq, digest, json, kind, shelf, edition, record_entry, editions, signature,
                                             signer_key, published_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
                CASE, seq, digest, text, json.kind, json.shelf, String(json.edition), null,
                json.kind === "withdrawal" ? JSON.stringify([json.edition]) : null, signature, keyFor(who).b64, iso(w.clock.now));
  return { seq, digest, text, signature, json };
}

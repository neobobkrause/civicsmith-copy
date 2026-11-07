/* filings over the modules it uses, every one the real one (K253): record-core, membership, promotion, provenance,
   attestation (split from provenance, N512), content, inquiry and publication on publication's own test world, and the layer-9 modules standards, conformance,
   consequences and actions, each through its own factory on the same host. A real SQLite database stands in for a
   Durable Object's storage. What only a later module or instance setup fills (the provider of promotion's fact
   `producingGroup`, publication's world registering it as instance-setup does; retrieval's registrations) is a stand-in
   the test controls: filings reads the group through the real promotion's `fact` (R3, N331). Every test drives `filings` at its interface, and changes the record
   only through the acts of the modules that own it. */
import { createHash } from "node:crypto";
import { world as publicationWorld, V, NOW } from "../publication/fixture.mjs";
import { filingsOf, filingsOps, Filings } from "../../../src/filings/index.mjs";
import { consequencesModule } from "../../../src/consequences/index.mjs";
import { standardsOf } from "../../../src/standards/index.mjs";
import { conformanceOf } from "../../../src/conformance/index.mjs";
import { actionsOf } from "../../../src/actions/index.mjs";
import { actionClocksOf } from "../../../src/action-clocks/index.mjs";
import { publicReadOf } from "../../../src/public-read/index.mjs";
import { attestationOf } from "../../../src/attestation/index.mjs";
import { LocalFacts } from "../../../src/local-facts/index.mjs";
import { eventsOf } from "../../../src/events/index.mjs";
import { projectRosterOf } from "../../../src/project-roster/index.mjs";
import { FilingTemplates, filingTemplatesOf } from "../../../src/filing-templates/index.mjs";
import { caseInputsOf } from "../../../src/case-inputs/index.mjs";
import { get as profileOf, combine } from "../../../../jurisdictions/index.mjs";

export { V, NOW };
export const MACHINE = "class:daemon";
/** A viewer the plane admits to nothing (membership R43): every bundle is invisible to it. */
export const STRANGER = "stranger";
export const sha = (s) => createHash("sha256").update(s, "utf8").digest("hex");
export const F = "INQ-2026-0001", DOC = "INFO-2026-0001-minutes", EVID = "INFO-2026-0002-ledger";
export const CASE = "CASE-2026-0001";
export const PROFILE = "test-port-ellery";
/** A member's own words for a bylaw complaint (R28): every blank but `law` is filled from the fixture's record, and a
 *  bylaw complaint states no law, so `law` is left `[UNFILLED: law]` for the approving member to write in. */
export const WORDS = "To the {{counterparty_role}}: {{act}} does not conform to {{standards}}, under {{law}}.";
export const LAW = "P.E.B.L. § 12";
/** R8 (DEC-88): the author's words on why a packet is assembled, which every packet a test assembles sends. */
export const WHY = "Counsel is asked whether the works order can be set aside.";

const q = (v) => JSON.stringify(String(v));
/** An action's bundle.md from `o` (`kind`, `risk_tier`, `state`, `resolution`, `counterparty`, `clock`, `legs`, `law`,
 *  `breach`, `override` (a premise override's reason, actions R8), `state_history`). */
export function actionMd(id, o) {
  const cp = o.counterparty;
  const lines = ["---", `id: ${id}`, "object_type: action", `title: ${id}`, `current_state: ${o.state ?? "active"}`,
    'created: "2026-03-10T00:00:00Z"', 'last_updated: "2026-03-10T00:00:00Z"', `action_kind: ${o.kind}`,
    ...(o.risk_tier != null && o.risk_tier !== "undetermined" ? [`risk_tier: ${o.risk_tier}`] : []),
    ...(o.resolution ? [`resolution: ${o.resolution}`] : []),
    ...(cp ? ["counterparty:", ...Object.entries(cp).map(([k, v]) => `  ${k}: ${q(v)}`)] : []),
    ...(o.clock && o.clock.length ? ["clock:", ...o.clock.flatMap((c) => [`  - text: ${q(c.text)}`, `    description: ${q(c.description)}`,
        `    date: "${c.date}"`, `    basis: ${q(c.basis)}`, `    status: ${c.status}`])] : []),
    ...(o.legs && o.legs.length ? ["action_basis:", ...o.legs.flatMap((l) => [`  - target: ${l.target}`, `    kind: ${l.kind}`])] : []),
    ...(o.law ? [`law: ${q(o.law)}`] : []),
    /* actions R78, R79 (T45): partners by role and organisation; a press action's terms */
    ...(o.partners ? ["partners:", ...o.partners.flatMap((x) => Object.entries(x).map(([k, v], i) => `${i ? "    " : "  - "}${k}: ${q(v)}`))] : []),
    ...(o.press_terms ? ["press_terms:", ...Object.entries(o.press_terms).map(([k, v]) => `  ${k}: ${q(v)}`)] : []),
    ...(o.breach ? ["breach: true"] : []),
    /* T50 (filings R60): an action that names its own project */
    ...(o.project ? [`project: ${o.project}`] : []),
    /* actions R74 (T45): an override states its ground, held flat (K2849): a legal deadline unless `ground` says otherwise */
    ...(o.override ? ["premise_override:", ...Object.entries(o.ground || { kind: "legal_deadline", citation: "Test Stat. § 9.20", date: "2026-04-01" })
                       .map(([k, v]) => `  ground_${k}: ${q(v)}`), `  reason: ${q(o.override)}`] : []),
    ...(o.state_history && o.state_history.length ? ["state_history:", ...o.state_history.flatMap((h) => [
        `  - timestamp: "${h.at}"`, `    from_state: ${h.from}`, `    to_state: ${h.to}`, `    blurb: ${q(h.reason ?? "moved")}`,
        `    author: ${h.by ?? V("olive")}`])] : []),
    "---", "", "An action.", ""];
  return lines.join("\n");
}

/* workerd's `sql.exec` answers a cursor, never an array: rows are read by iterating it (or its `toArray()`/`one()`),
   and `[0]` of it is undefined. It also refuses a LIKE or GLOB pattern over 50 bytes ("LIKE or GLOB pattern too
   complex"), which node:sqlite does not (K313). The world's storage answers as workerd does, so code that indexes a
   cursor or writes a long pattern fails here as it would in the durable object (K316). */
export const WORKERD_PATTERN_CAP = 50;
function workerdShaped(st) {
  const exec = st.sql.exec.bind(st.sql);
  st.sql.exec = (q, ...args) => {
    const literal = [...q.matchAll(/\b(?:GLOB|LIKE)\s+'((?:[^']|'')*)'/gi)].map((m) => m[1].replace(/''/g, "'"));
    const bound = /\b(?:GLOB|LIKE)\s+\?|\b(?:glob|like)\s*\(/i.test(q) ? args.filter((a) => typeof a === "string") : [];
    if ([...literal, ...bound].some((p) => Buffer.byteLength(p) > WORKERD_PATTERN_CAP))
      throw new Error("LIKE or GLOB pattern too complex");
    const rows = exec(q, ...args);
    let i = 0;
    return {
      [Symbol.iterator]() { return this; },
      next: () => (i < rows.length ? { value: rows[i++], done: false } : { value: undefined, done: true }),
      toArray: () => { const r = rows.slice(i); i = rows.length; return r; },
      one: () => { if (rows.length - i !== 1) throw new Error("Expected exactly one result from SQL query"); return rows[i++]; },
    };
  };
}

/** The world: a project (olive owns it; bo and cy joined; quinn outside) whose published case edition holds F (resting on
 *  DOC), a live determination D of an act against two standards resting on F, the test profile active, and the layer-9
 *  modules, over storage shaped as workerd's (a cursor-answering `sql.exec`). `profiles` replaces the active profile
 *  list filings reads (ids or profile objects); actions reads record-core's setting, the test profile. */
export function world({ profiles = undefined, group = "test-group", signing = false } = {}) {
  const w = publicationWorld({ group });
  workerdShaped(w.st);
  for (const m of ["olive", "bo", "cy", "quinn"]) w.member(m);
  /* T50 (R60, R61): public-read reads a project's stake through project-roster's instance on the host (its R36), as the
     plane boots it: made with the record and migrated, so a project with no stake reads none, never undetermined */
  const roster = projectRosterOf(w.host, { record: w.record, membership: w.membership });
  roster.migrate();
  const proj = w.project("Parks", "olive");
  for (const m of ["bo", "cy"]) {
    const inv = w.membership.projectInvite({ projectId: proj, handle: `h_${m}`, by: "olive", viewer: V("olive") });
    if (inv && inv.ok === false) throw new Error(`fixture invite refused: ${JSON.stringify(inv)}`);
    const j = w.membership.projectJoin({ projectId: proj, by: m, viewer: V(m) });
    if (j && j.ok === false) throw new Error(`fixture join refused: ${JSON.stringify(j)}`);
  }
  w.doc(DOC, { fetched: false }); /* a member document: no receipt, so its capture is ungraded (R25; K2387) */
  attestedDoc(w, EVID);
  /* R33: the registry's entities (the real entities module): the Selectboard's office, the subject F concerns (its
     `subject_entity`) and another the chronology's set does not hold, through the world's connections (publication's
     fixture), the instance inquiry and events read */
  const ents = w.connections.entities;
  const entity = (kind, label) => {
    const r = ents.createEntity({ kind, label, note: "a subject the test registers", declaredBy: V("olive") });
    if (!r.ok) throw new Error(`fixture entity refused: ${JSON.stringify(r).slice(0, 300)}`);
    return r.entity_id;
  };
  const OFFICE = entity("office", "Selectboard, Port Ellery Selectboard");
  const SUBJECT = entity("fund", "the harbour works fund");
  const ELSEWHERE = entity("place", "the old quay");
  w.inquiry(F, { legs: [{ target: DOC }] });
  w.promote(F, w.text(F).replace(`id: ${F}\n`, `id: ${F}\nsubject_entity: ${SUBJECT}\n`)
    .replace("## Conclusion\n", "## Conclusion\n\nThe works order was let without the vote the bylaw requires.\n"));
  const pin = w.head(F);
  /** Edition `edition` of CASE, owned by the project, pinning F, ratified and published. */
  const publishEdition = (edition) => {
    const roles = [{ target: F, version_sha: pin, edition }];
    w.prepare(CASE, edition, { project: proj, roles });
    const signed = w.signCase(CASE, edition, { project: proj, roster: roles.map((r) => ({ bundle_id: r.target, version_sha: r.version_sha, role: "load_bearing" })) });
    if (!signed.ok) throw new Error(`fixture case refused: ${JSON.stringify(signed)}`);
    const pub = w.signFinding(F, { edges: edition === 1 ? [{ to: DOC, kind: "cites", disclosure: "serve" }] : [] });
    if (!pub.ok) throw new Error(`fixture publish refused: ${JSON.stringify(pub)}`);
  };
  publishEdition(1);
  w.record.setSetting("jurisdiction_profiles", [PROFILE], V("olive"));
  const now = () => w.clock.now;
  const deps = { record: w.record, membership: w.membership, promotion: w.promotion, content: w.content, now };
  const standards = standardsOf(w.host, deps);
  standards.migrate();
  /* strength and reevaluation (which filings does not use) are reached through conformance's own factories. */
  const conformance = conformanceOf(w.host, { ...deps, inquiry: w.k, publication: w.p, standards });
  const consequences = consequencesModule(w.host, { ...deps, conformance, provenance: w.prov, inquiry: w.k });
  const actions = actionsOf(w.host, { ...deps, retrieval: null, conformance, now: () => Date.parse(w.clock.now) });
  /* the value promotion's fact `producingGroup` answers (publication's world registers its provider) */
  const groupRef = w.groupRef;
  /* R28–R32: filing-templates, and R30: local-facts, over the same profiles filings reads: the real modules, their
     active profiles (and any a test wrote) answered as filings is handed them, so a profile's template and a holiday
     entry's path name what they hold. */
  const filingTemplates = templatesOver(w, profiles);
  const localFacts = profiles === undefined ? undefined : localFactsOver(w, profiles, now);
  /* R7 (action-clocks R2, R28): the host's action-clocks, which filings asks for the clock entries it offers, reads the
     same profiles filings is handed (a test layer it names, say), through the same real local-facts */
  if (localFacts) actionClocksOf(w.host, { localFacts, actions });
  /* attestation (layer 3, after provenance), the real one: every attestation a capture holds (its R7), R9's exhibits. */
  const attestation = attestationOf(w.host, { record: w.record, provenance: w.prov });
  /* R64: with `signing`, the host's own case-inputs is handed in, as the composition root's environment would have filings find it */
  const ci = signing ? caseInputsOf(w.host) : null;
  const f = filingsOf(w.host, { record: w.record, publication: w.p, provenance: w.prov, attestation, content: w.content, now, filingTemplates,
                                ...(ci ? { caseInputs: ci } : {}),
                                ...(profiles !== undefined ? { profiles: () => profiles, localFacts } : {}) });
  const evidenceCid = w.content.mint({ bundleId: EVID, captureSha: sha(`the text of ${EVID}`), extent: { kind: "document" },
                                       mintedBy: V("bo") }).content_id;
  const declare = (over) => {
    /* standards R1 (DEC-88, STANDARD_NO_REASON): the declarer's words on why the group holds its government to it */
    const r = standards.standardDeclare({ text: [evidenceCid], reason: "The group holds the Selectboard to it.", author: V("olive"),
                                          viewer: V("olive"), ...over });
    if (!r.ok) throw new Error(`fixture standard refused: ${JSON.stringify(r).slice(0, 300)}`);
    return r.id;
  };
  const S1 = declare({ cite: "P.E.B.L. § 12", kind: "ordinance", issuer: "Port Ellery Selectboard", period: { from: "2020-01-01", to: "2030-12-31" } });
  const S2 = declare({ cite: "MCBC 2025-3", kind: "commitment", issuer: "Marlow County Commission", period: { from: null, to: null } });
  /* events (layer 5), the real one, on the same host: the act's event (conformance R25) and R33's timeline, whose
     "what we did" lane holds the sources the later modules registered on it (docket's, at its start) */
  const events = eventsOf(w.host);
  events.migrate();
  /** An event (events R6) of `kind`, attested by a dated fact `value` read from the capture `capture` (default the
   *  ledger's), concerning `concerns`; with `value` null, attested by the capture alone and so placed nowhere. */
  const makeEvent = ({ kind = "meeting", value = null, concerns = [], capture = sha(`the text of ${EVID}`), by = V("olive") } = {}) => {
    const att = value === null ? { captureSha: capture, extent: { kind: "document" } }
      : { datedFactId: events.recordDatedFact({ captureSha: capture, extent: { kind: "document" }, kind: "meeting", value,
                                                method: "read by a member", by }).dated_fact.dated_fact_id };
    const r = events.createEvent({ kind, attestations: [att], concerns, by });
    if (!r.ok) throw new Error(`fixture event refused: ${JSON.stringify(r).slice(0, 300)}`);
    return r.event_id;
  };
  /* the act: the works order's adoption on 2026-03-02, an event the ledger attests (conformance R25) */
  const ACT_EVENT = makeEvent({ kind: "adoption", value: "2026-03-02" });
  const act = { event: ACT_EVENT, actor: { role: "Selectboard", body: "Port Ellery Selectboard" },
                evidence: [evidenceCid] };
  /** A determination by olive through conformance's R1 (every field `over` replaces); answers its id. */
  const determine = (over = {}) => {
    const stds = over.standards || [{ standard: S1, outcome: "noncompliant" }, { standard: S2, outcome: "compliant" }];
    const r = conformance.determine({ project: proj, act, findings: [F], standards: stds,
      rows: stds.map((s) => ({ standard: s.standard, requires: "a vote of the Selectboard", did: "let it without one",
                               reading: s.outcome === "compliant" ? "aligns" : "diverges", content: [evidenceCid] })),
      author: V("olive"), viewer: V("olive"), ...over });
    if (!r.ok) throw new Error(`fixture determination refused: ${JSON.stringify(r).slice(0, 500)}`);
    return r.id;
  };
  const D = determine();
  let n = 0;
  const x = {
    ...w, w, f, ci, attestation, events, ents, roster, OFFICE, SUBJECT, ELSEWHERE, ACT_EVENT,
    event: makeEvent, localFacts: f.localFacts, pr: publicReadOf(w.host, { publication: w.p }), proj, pin, actions, conformance, standards, consequences, groupRef, evidenceCid, S1, S2, D, declare,
    determine, publishEdition, act,
    /* the world's own reads, over the cursor */
    row: (sq, ...a) => [...w.st.sql.exec(sq, ...a)][0] ?? null,
    rows: (sq, ...a) => [...w.st.sql.exec(sq, ...a)],
    count: (t) => [...w.st.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`)][0].n,
    snapshot: (tables) => Object.fromEntries(tables.map((t) => [t, JSON.stringify([...w.st.sql.exec(`SELECT * FROM "${t}"`)])])),
    /** A new action created by a member (throws when refused); answers its id. `o` as `actionMd`'s, over defaults;
     *  its governing laws are stated through actions' R18 act unless `laws: null`. */
    action(o = {}) {
      const id = o.id || `ACTN-2026-${String(9000 + ++n)}-x`;
      const doc = {
        kind: "bylaw_complaint", risk_tier: 1, state: "active",
        counterparty: { state: "named", role: "Selectboard", body: "Port Ellery Selectboard", level: "city" },
        clock: [{ text: "answer due", description: "the Selectboard answers", date: "2026-04-01", basis: "P.E.B.L. § 4", status: "pending" }],
        legs: [{ target: D, kind: "rests_on" }],
        state_history: [{ at: "2026-03-10T09:00:00Z", from: "planned", to: "active", reason: "opened" }], ...o };
      const r = w.promotion.promote({ bundleId: id, base: null, snapKey: `a${++n}`, author: V("olive"),
        files: [{ path: "bundle.md", text: actionMd(id, doc) }], meta: { object_type: "action" } });
      if (!r.ok) throw new Error(`fixture action refused: ${JSON.stringify(r).slice(0, 600)}`);
      if (o.laws !== null) {
        const l = actions.actionLaws({ target: id, laws: o.laws || [{ level: "city", citation: "P.E.B.L. § 4" }],
                                       author: V("olive"), viewer: V("olive") });
        if (!l.ok) throw new Error(`fixture laws refused: ${JSON.stringify(l).slice(0, 300)}`);
      }
      return id;
    },
    /** A member's revision of an action's bundle.md, `edit` taking and returning its text. */
    revise(id, edit) {
      const head = w.record.head(id);
      const r = w.promotion.promote({ bundleId: id, base: head.bundleSha, snapKey: `r${++n}`, author: V("olive"),
        files: [{ path: "bundle.md", text: edit(w.text(id)) }], meta: { object_type: "action" } });
      if (!r.ok) throw new Error(`fixture revision refused: ${JSON.stringify(r).slice(0, 600)}`);
      return r;
    },
    read: (id) => actions.actionRead({ id, viewer: MACHINE }),
    op(name, query = {}, body = null) {
      const url = new URL(`http://do/${name}`);
      for (const [k, v] of Object.entries(query)) if (v != null) url.searchParams.set(k, String(v));
      return filingsOps(f, url, body)[name]();
    },
    /** A capture registered in the record (a filing's sent bytes, say), in `project` when one is named: its sha. */
    capture(id, text, { project = null, author = V("bo") } = {}) {
      const path = `snapshots/${id}.txt`;
      const res = w.promotion.promote({ bundleId: id, base: null, snapKey: `c-${id}`, author,
        files: [{ path: "bundle.md", text: infoMd(id, project) }, { path, text },
                { path: "data/provenance.json", text: JSON.stringify({ documents: [provDoc(path, text)] }) }],
        meta: { object_type: "information" }, register: [{ sha256: sha(text), path, encoding: "utf8", bytes: Buffer.byteLength(text) }] });
      if (!res.ok) throw new Error(`fixture capture refused: ${JSON.stringify(res).slice(0, 300)}`);
      return sha(text);
    },
    profile: (id = PROFILE) => profileOf(id),
    /** A second filings over the same record and modules, `over` replacing any of them (a proxy of conformance or
     *  membership answering as that module's contract does, say). */
    filingsWith(over = {}) {
      const ps = typeof over.profiles === "function" ? over.profiles() : profiles;
      return new Filings({ storage: w.st, record: w.record, host: w.host, membership: w.membership, publication: w.p,
                           provenance: w.prov, attestation, content: w.content, promotion: w.promotion, actions, conformance, standards,
                           consequences, now, filingTemplates: templatesOver(w, ps),
                           ...(ps !== undefined ? { localFacts: localFactsOver(w, ps, now) } : {}), ...over });
    },
  };
  return x;
}

/** The real local-facts on the world's storage, its active profiles `profiles` (ids or profile objects, as filings is
 *  handed them) in place of record-core's setting. */
export function localFactsOver(w, profiles, now = () => w.clock.now) {
  const { record, get, own } = over(w, profiles);
  return new LocalFacts({ storage: w.st, record, membership: w.membership, get,
                          combine: (list) => combine(list.map((id) => own.get(id) || id)), now });
}

/** The real filing-templates on the world's storage (its tables and opaque-id seed made by its factory on the host),
 *  its active profiles `profiles` when given. */
export function templatesOver(w, profiles, { reviewed: rev = true } = {}) {
  filingTemplatesOf(w.host, { record: w.record, membership: w.membership });
  const { record, get } = profiles === undefined ? { record: w.record, get: profileOf } : over(w, profiles);
  return new FilingTemplates({ storage: w.st, record, membership: w.membership, jurisdictions: { get: rev ? reviewed(get) : get },
                               now: () => Date.parse(w.clock.now) });
}

/** filing-templates R15 (T45, K2851): a profile template is offered only with a named writer, public sources, a
 *  professional's `no_concerns` review and an approver other than its writer. The test profiles' templates carry the
 *  writer and approver; each read through here gains sources and a professional's review of its own text (its
 *  `reviewed_text_sha`, jurisdictions R126), as filing-templates' own fixture gives them (its `attributed`). `templatesOver(w, p, {reviewed: false})` reads them as they are. */
export const PRO_REVIEW = Object.freeze({ reviewer: "Dee Example", kind: "professional", organisation: "Marlow Commons Legal Society (test)",
                                          credential: "solicitor (test)", scope: "the whole text", outcome: "no_concerns", at: "2026-08-25" });
function reviewed(get) {
  const fix = (t) => ({ ...t, sources: t.sources && t.sources.length ? t.sources : [{ citation: "P.E.B.L. § 1" }],
                        reviews: [...(t.reviews || []).filter((r) => r.kind !== "professional"),
                                  /* jurisdictions R40, R126 (T53): a professional review counts only for the text it read */
                                  { ...PRO_REVIEW, reviewed_text_sha: sha(String(t.text ?? "")) }] });
  return (id) => {
    const p = get(id);
    if (!p || typeof p !== "object") return p;
    return { ...p, action_kinds: (p.action_kinds || []).map((k) => ({ ...k, ...(k.template ? { template: fix(k.template) } : {}),
                                                                      ...(Array.isArray(k.templates) ? { templates: k.templates.map(fix) } : {}) })) };
  };
}

/* record-core with `profiles` as its active jurisdiction profiles, and the profiles' reader. */
function over(w, profiles) {
  const own = new Map(profiles.filter((p) => p && typeof p === "object").map((p) => [p.id, p]));
  const ids = profiles.map((p) => (typeof p === "string" ? p : p.id));
  const get = (id) => own.get(id) || profileOf(id);
  const record = new Proxy(w.record, { get: (t, k) => (k === "getSetting"
    ? (key) => (key === "jurisdiction_profiles" ? ids : t.getSetting(key))
    : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
  return { record, get, own };
}

/** A profile template as `jurisdictions` R40 holds it: attributed, approved by another than its author. */
export const attributed = (id, use, text, over = {}) => ({
  id, version: 1, use, text, notes: "A test template.", authored_by: "Ada Example", contributors: [],
  reviews: [{ reviewer: "Dee Example", kind: "member", scope: "the whole text", outcome: "no_concerns", at: "2026-08-21" }],
  approved_by: "Cy Example", approved_at: "2026-09-01", basis: "TEST", ...over });

/* A document whose capture carries an RFC 3161 attestation and a co-archive locator, as `op=attest` records them. */
function attestedDoc(w, id) {
  const text = `the text of ${id}`, path = `snapshots/${id}.txt`;
  const doc = { ...provDoc(path, text),
    attestations: [{ kind: "rfc3161", service: "tsa.example", file: "snapshots/timestamp-aaaa.tsr", sha256: "ab".repeat(32) }],
    co_archive: { service: "archive.example", locator: "https://archive.example/x" },
    attestation_attempts: [{ service: "tsa.example", ok: true, attempted: "2026-09-27T01:00:00Z", token_sha256: "ab".repeat(32) }] };
  const res = w.promotion.promote({ bundleId: id, base: null, snapKey: `a-${id}`, author: V("bo"),
    files: [{ path: "bundle.md", text: infoMd(id) }, { path, text },
            { path: "data/provenance.json", text: JSON.stringify({ documents: [doc] }, null, 2) }],
    meta: { object_type: "information" }, register: [{ sha256: sha(text), path, encoding: "utf8", bytes: Buffer.byteLength(text) }] });
  if (!res.ok) throw new Error(`fixture attested doc refused: ${JSON.stringify(res).slice(0, 300)}`);
  w.prov.recordReceipt({ address: `https://example.org/${path}`, addressNorm: `example.org/${path}`, captureSha: sha(text),
                         retrieved: "2026-09-27T00:00:00Z" });
}

function infoMd(id, project = null) {
  return ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Document ${id}"`,
          ...(project ? [`project: ${project}`] : []),
          "current_state: collected", "prior_state: null", `created: "2026-09-27T00:00:00Z"`,
          `last_updated: "2026-09-27T00:00:00Z"`, "references: []", "state_history: []", "criticality: supporting",
          "---", "", "## Summary", "", "A document.", ""].join("\n");
}

function provDoc(path, text) {
  return { file: path, locator: `https://example.org/${path}`, retrieved: "2026-09-27T00:00:00Z",
           authority: "the publisher", authority_state: "determined", authority_basis: "named on the document",
           capture: { method: "acquire", grade: "B", actor_class: "session", sha256: sha(text), encoding: "utf8",
                      bytes: Buffer.byteLength(text) },
           origin: { kind: "named_request" } };
}

/* actions' read with R75's disclosures, R78's partners and R79's press terms added for the actions named (a stand-in
   until actions' job merges); every other field the real read's. */
export function actionsWith(x, extra) {
  const real = x.actions;
  return new Proxy(real, { get: (t, k) => (k === "actionRead"
    ? (a) => { const r = t.actionRead(a); return r && r.ok && extra[r.id] ? { ...r, ...extra[r.id] } : r; }
    : typeof t[k] === "function" ? t[k].bind(t) : t[k]) });
}

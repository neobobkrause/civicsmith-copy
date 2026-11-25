/* ratification R6, R39, R57 (T51 fix round 6, G54), the platform check L: booted on workerd by `g54-l.test.mjs` under Miniflare,
   with a real Durable Object, real R2 buckets and the real storage. `G54Held` is a Durable Object composed of the modules
   ratification uses, as `world()` of `fixture.mjs` composes them on node (the real record, membership, credentials,
   promotion, publication, public-read, publish-schedule and ratification over `ctx.storage`; the other readers are the
   fixture's stand-ins), with a door that answers the store half's ops as the plane's object does (`{ok, result}`) and debug
   routes (`/g54/...`) that lay a case edition through the modules' own commits and read its state. The default export is a
   Worker with routes (`/g54w/...`) that run the Worker half's post-commit block, the one `op=caseratify` and `op=ratify` run
   after their commit (`copyMaterials`, then `assembleEdition`, over the object's own door and the real buckets), with one
   fault made at a time: a bucket `put` that throws, a store that does not answer `recordcasemanifest`, a request cancelled by
   its caller after the commit. The plane itself is not here (a later module): its alarm and registration are `plane`'s checks. */
import { recordOf, RECORD_SCHEMA } from "../../../src/record-core/index.mjs";
import { PROVENANCE_SCHEMA } from "../../../src/provenance/schema.mjs";
import { membershipOf } from "../../../src/membership/index.mjs";
import { credentialsOf } from "../../../src/credentials/index.mjs";
import { registerInquiryGrammar } from "../../../src/inquiry-grammar/index.mjs";
import { promotionOf } from "../../../src/promotion/index.mjs";
import { publicationOf, publicationOps } from "../../../src/publication/index.mjs";
import { publicReadOf, publicReadOps } from "../../../src/public-read/index.mjs";
import { publishScheduleOf } from "../../../src/publish-schedule/index.mjs";
import { ratificationOf, ratificationOps } from "../../../src/ratification/index.mjs";
import { copyMaterials } from "../../../src/ratification/ops.mjs";
import { assembleEdition, priorOf } from "../../../src/ratification/finding.mjs";
import { materialsLines, materialAttestationLines } from "../../../src/case-grammar/index.mjs";
import * as casefile from "../../../src/publication/worker.mjs";

const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const V = (id) => `member:${id}`;
const NOW = "2026-10-22T20:00:00Z";
const KEY = "AAAAC3NzaC1lZDI1NTE5AAAAIKEY";
const bare = (schema) => schema.split("\n").filter((l) => !l.trim().startsWith("--")).join("\n");
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha = async (bytes) => hex(await crypto.subtle.digest("SHA-256", typeof bytes === "string" ? new TextEncoder().encode(bytes) : bytes));

/* The plane's binding public-read's assembly reads (`bindPublishedPlane`), as the module's own tests make it. */
casefile.bindPublishedPlane({
  json, STORE_SILENT_REASON: "STORE_DID_NOT_ANSWER", STORE_SILENT_DETAIL: "the store did not answer", PUBLISHED_STORE: "bio",
  doAnswer: async (res) => { let out = null; try { out = await (await res).json(); } catch { out = null; }
                             return out && out.ok === true ? { answered: true, result: out.result } : { answered: false }; },
  storeSilent: (op) => json({ ok: false, reason: "STORE_DID_NOT_ANSWER", op }, 502),
  requiredArgument: (op, argument, shape, error) => ({ ok: false, reason: "REQUIRED_ARGUMENT_MISSING", op, argument, shape, error }), // fixtures-contract: answer-envelope door-helpers
});

/* The published bucket with one fault made at a time (`state.fault`): a `put` that throws, one only for the manifest's own
   bytes, and a count of what the block asked of the bucket. */
function faulty(bucket, state) {
  return new Proxy(bucket, { get(t, k) {
    const v = t[k];
    if (typeof v !== "function") return v;
    if (k === "put") return async (key, value, opts) => {
      state.counts.put++;
      const text = value instanceof Uint8Array ? new TextDecoder().decode(value.slice(0, 80)) : "";
      const isManifest = text.trimStart().startsWith("{") && text.includes("\"format\"");
      if (state.fault === "put_throws" || (state.fault === "manifest_put_throws" && isManifest)) throw new Error("bucket refused (injected)");
      /* G57: a put that throws once, or at the n-th put since the fault was set (a heal killed part-way) */
      if (state.fault === "put_throws_once" || (state.fault === "put_throws_nth" && ++state.seen === state.nth)) { state.fault = "none"; throw new Error("bucket refused (injected)"); }
      return t.put(key, value, opts);
    };
    if (k === "get" || k === "head") return async (...a) => { state.counts[k]++; const r = await t[k](...a); if (k === "get" && r && r.size) state.counts.bytes += r.size; return r; };
    return v.bind(t);
  } });
}
const newState = () => ({ fault: "none", seen: 0, nth: 0, counts: { get: 0, head: 0, put: 0, bytes: 0, door: 0 } });

const projMd = (title) => ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
  "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
  "references: []", "state_history: []", 'objective: "Find out."', "---", "", "## Objective", "", "Find out.", ""].join("\n");
const inquiryMd = (id) => ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Is ${id} answered?"`,
  "current_state: open", "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
  "references: []", "state_history: []", "surfaced_by: human", 'disposition_reason: ""', "---", "", "## Question", "",
  `Is ${id} answered?`, "", "## Session Log", "", "## Review Notes", ""].join("\n");
const caseDocText = (caseId, edition, project, target, pin, materials = []) => ["---", "format: bio-case-document/6", `case_id: ${caseId}`,
  `case_edition: ${edition}`, `case_project: ${project}`, "case_roles:", `  - target: ${target}`, `    version_sha: ${pin}`,
  "    edition: 1", "    role: load_bearing", "case_findings:", `  - ${target}`, "case_strength: []", "completeness:",
  "  author: member:olive", `  at: "${NOW}"`, "completeness_excluded: []", "case_citations: []",
  "method:", '  grading: "grading/1"', '  checks: "1.0.0"', ...materialsLines(materials), ...materialAttestationLines([]), "---", "",
  "## Scope", "", "The question.", "", "## What This Excludes", "", "Nothing else.", "", "## What Was Searched", "", "Everything.", ""].join("\n");

export class G54Held {
  fault = newState();
  constructor(ctx, env) {
    this.ctx = ctx;
    this.env = { ...env, PUBLISHED: faulty(env.PUBLISHED, this.fault) };
    const st = ctx.storage, host = ctx;
    for (const t of bare(RECORD_SCHEMA).split(";")) if (t.trim()) st.sql.exec(t);
    for (const t of bare(PROVENANCE_SCHEMA).split(";")) if (t.trim()) st.sql.exec(t);
    const record = recordOf(host, { evidence: null, evidencePrefix: "bio/captures/" });
    record.migrate();
    const membership = membershipOf(host, { record });
    membership.migrate();
    const credentials = credentialsOf(host, { record, membership });
    credentials.migrate();
    registerInquiryGrammar(record);
    const promotion = promotionOf(host, { record, membership, now: () => NOW });
    promotion.registerFact("producingGroup", "instance-setup", () => "test-group");
    st.sql.exec(`CREATE TABLE IF NOT EXISTS inquiry_basis (bundle_id TEXT NOT NULL, ord INTEGER NOT NULL, target_id TEXT NOT NULL)`);
    st.sql.exec(`CREATE TABLE IF NOT EXISTS refs (bundle_id TEXT NOT NULL, target_id TEXT NOT NULL, kind TEXT NOT NULL DEFAULT '',
                                   PRIMARY KEY (bundle_id, target_id, kind))`);
    // fixtures-own: platform this entry is bundled into the Miniflare script and runs on workerd, where provenance's published fixture (it builds node SQLite worlds) cannot load; the stand-in answers "nothing held" only, for a case file this test does not gate
    const stand = { registeredFor: () => [], registerHolds: () => ({ ok: true, parts: null, registered: false, acquired: false }),
                    containerResolver: () => ({ holds: () => false, gradeVia: () => null, archiveOrigin: () => ({ found: false }), authority: () => null }) };
    const none = { self: [], via: [] };
    const publication = publicationOf(host, { storage: st, record, membership, promotion, now: () => new Date().toISOString(),
      inquiry: { exclusionsNaming: () => [] }, basisVersions: { testimonyReach: () => none },
      reevaluation: { registerCaseParts: () => ({ ok: true }) } });
    const publishSchedule = publishScheduleOf(host, { storage: st, record, membership, publication, now: () => NOW });
    const ratification = ratificationOf(host, { storage: st, record, membership, credentials, promotion, provenance: stand,
      inquiry: { subjectEntityOf: () => null, earned: () => ({}) },
      basisVersions: { conclusionOf: () => null, conclusionRecordOf: () => ({ history: [], stance: null }), noProjectConclusionOf: () => null,
                       projectsDrawingOn: () => Object.assign([], { bound: 32, truncated: false }), testimonyReach: () => none },
      publication, caseTensions: publication.caseTensionsModule, capture: { registerReader: () => ({ ok: true }) },
      // fixtures-own: platform this entry runs on workerd, where strength's and money's published fixtures build node:sqlite worlds and cannot load; the stand-ins answer the one ok shape the sweep reads (testimony with no legs, a fact not found)
      strength: { testimonyCorroboration: () => ({ ok: true, legs: [] }) }, reevaluation: { levelMoved: () => ({ ok: true }) },
      networkNotices: { openSeals: async () => ({ ok: true }) }, people: { tiesConcerning: () => ({ ok: true, ties: [] }) },
      money: { readFact: () => ({ ok: true, found: false }) }, publishSchedule,
      worker: { env: this.env, storeName: "bio", stub: { fetch: (u, init) => this.fetch(u instanceof Request ? u : new Request(u, init)) } } });
    this.w = { record, membership, promotion, publication, publicRead: publicReadOf(host, { publication, docket: {} }), ratification, st };
  }

  async fetch(req) {
    const url = new URL(req.url), step = url.pathname.slice(1), q = (k) => url.searchParams.get(k);
    const { record, promotion, publication: pub, ratification, publicRead } = this.w;
    this.fault.counts.door++;
    let n = 0;
    const key = () => `k${Date.now()}-${++n}`;
    if (step.startsWith("g54/")) {
      const s = step.slice(4);
      if (s === "fault") { this.fault.fault = q("mode") || "none"; Object.assign(this.fault.counts, { get: 0, head: 0, put: 0, bytes: 0, door: 0 }); return json(this.fault); }
      if (s === "seed") {
        /* an owner, her project, one question and its case edition (the case document stored and its commit made, as a
           ceremony's store half makes it); the finding's own signature is laid separately (`finding`), the act that
           completes the edition. `materials` adds that many included document rows of `kib` KiB, held in the published bucket. */
        const caseId = q("case"), edition = Number(q("edition") || 1), F = `INQ-2026-${caseId.slice(-4)}`;
        this.ctx.storage.sql.exec(`INSERT OR IGNORE INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                              VALUES ('olive', 'Cover olive', 'h_olive', 'member', 'active', '["contribute"]', 't', 't')`);
        const proj = promotion.promote({ base: null, snapKey: key(), author: V("olive"), ownerMemberId: "olive",
          files: [{ path: "bundle.md", text: projMd(`Team ${caseId}`) }], meta: { object_type: "project" } });
        if (!proj.ok) return json({ error: "project", detail: proj }, 500);
        const inq = promotion.promote({ bundleId: F, base: null, snapKey: key(), author: V("alice"),
          files: [{ path: "bundle.md", text: inquiryMd(F) }], meta: { object_type: "inquiry" } });
        if (!inq.ok) return json({ error: "inquiry", detail: inq }, 500);
        const pin = record.head(F).bundleSha;
        const rows = [];
        for (let i = 0; i < Number(q("materials") || 0); i++) {
          const bytes = new Uint8Array(Number(q("kib") || 1) * 1024);
          for (let o = 0; o < bytes.length; o += 65536) crypto.getRandomValues(bytes.subarray(o, Math.min(o + 65536, bytes.length)));
          const text = new TextEncoder().encode(`extracted text of ${caseId} document ${i}\n`.repeat(20));
          const m = { ref: `INFO-2026-${String(i).padStart(4, "0")}-doc`, kind: "document", sha: await sha(bytes), text_sha: await sha(text),
                      origin: `https://example.org/${i}`, archived_copy: null, included: true, rests_under: "load_bearing", title: null, obscured: null };
          await this.env.PUBLISHED.put(`bio/published/${m.sha}`, bytes); await this.env.PUBLISHED.put(`bio/published/${m.text_sha}`, text);
          rows.push(m);
        }
        this.fault.counts.put = 0;
        const text = caseDocText(caseId, edition, proj.bundleId, F, pin, rows);
        const stored = pub.storeCaseDocument({ case: caseId, edition, text, author: V("olive"), at: NOW });
        if (!stored.ok) return json({ error: "storeCaseDocument", detail: stored }, 500);
        const signed = record.transact(() => pub.commitCaseEdition({ case: caseId, edition, project: proj.bundleId,
          scope: "The question.", completeness: { statement: "It leaves out the minutes.", author: V("olive") },
          biasAcknowledgement: "none declared", bar: null, roster: [{ bundle_id: F, version_sha: pin, role: "load_bearing" }],
          sigArmored: "-----BEGIN SSH SIGNATURE-----\nsig\n-----END SSH SIGNATURE-----", attestorKey: KEY, attestorMember: "olive",
          gateVersion: "plane-gate/test", deliveredBy: V("olive"), at: NOW }));
        if (!signed.ok) return json({ error: "commitCaseEdition", detail: signed }, 500);
        return json({ caseId, edition, finding: F, pin, project: proj.bundleId, materials: rows.length });
      }
      if (s === "finding") {
        /* the act that completes the edition: the finding's own commit, and its bytes in the published bucket */
        const F = q("finding"), pin = record.head(F).bundleSha, text = record.readFile(F, "bundle.md").text;
        const done = record.transact(() => pub.commitEdition({ bundleId: F, bundleSha: pin, title: `Finding ${F}`, completeness: null,
          strength: null, memberCarriesBlocks: false, group: "test-group", edges: [],
          shas: [{ sha256: pin, path: "bundle.md", kind: "bundle", bytes: text.length }],
          attestorKey: KEY, attestorMember: "olive", gateVersion: "plane-gate/test",
          sigArmored: "-----BEGIN SSH SIGNATURE-----\nsig9\n-----END SSH SIGNATURE-----", deliveredBy: V("olive"), at: NOW }));
        if (!done.ok) return json({ error: "commitEdition", detail: done }, 500);
        await this.env.PUBLISHED.put(`bio/published/${pin}`, new TextEncoder().encode(text));
        return json({ ok: true });
      }
      if (s === "state") {
        const cs = pub.caseEditionState(q("case"), Number(q("edition") || 1), "test-group");
        const row = [...this.ctx.storage.sql.exec(`SELECT * FROM published_cases WHERE case_id=? AND edition=?`, q("case"), Number(q("edition") || 1))][0] || {};
        const listed = await this.env.PUBLISHED.list({ prefix: "bio/published/" });
        return json({ complete: !!(cs && cs.complete), manifest_sha: cs ? cs.manifest_sha ?? null : null, awaiting: cs ? cs.awaiting ?? null : null,
                      objects: listed.objects.length, ledger: { state: row.casefile_state ?? null, attempts: row.casefile_attempts ?? null,
                                                                why: row.casefile_why ?? null } });
      }
      if (s === "cs") return json(pub.caseEditionState(q("case"), Number(q("edition") || 1), "test-group"));
      if (s === "sweep") return json(await ratification.caseFileSweep(Number(q("now")) || Date.now()));
      if (s === "wake") return json({ wake: ratification.caseFileWake(Number(q("now")) || Date.now()) });
      return json({ error: "unknown g54 step" }, 404);
    }
    const body = req.method === "POST" ? JSON.parse((await req.text()) || "{}") : null;
    const ops = { ...publicationOps(pub, url, body), ...publicReadOps(publicRead, url), ...ratificationOps(ratification, url, body) };
    if (!ops[step]) return Response.json({ ok: false, error: `unknown op: ${step}` }, { status: 400 });
    if (this.fault.fault === "record_silent" && step === "recordcasemanifest") return new Response("down", { status: 500 });
    return Response.json({ ok: true, result: await ops[step]() });
  }
}

/* The Worker half's post-commit block, as `op=caseratify` runs it after its commit: the materials copied, then the edition's
   container assembled by the one assembly, over the object's own door and the real buckets. One fault at a time. */
async function postCommit(env0, { fault, caseId, edition, waitMs }) {
  const ns = env0.STORE, stub = ns.get(ns.idFromName("bio"));
  /* the Worker's own bucket binding carries the fault (and the count); the object's door carries the silent store */
  const state = newState();
  state.fault = fault;
  const env = { ...env0, PUBLISHED: faulty(env0.PUBLISHED, state) };
  await stub.fetch(`http://do/g54/fault?mode=${fault === "record_silent" ? fault : "none"}`);
  try {
    if (waitMs) await new Promise((r) => setTimeout(r, waitMs));
    const copied = await copyMaterials(env, "bio", []);
    const cs = await (await stub.fetch(`http://do/g54/cs?case=${caseId}&edition=${edition}`)).json();
    const recorded = [];
    const out = await assembleEdition({ assemble: casefile.assembleCaseContainer,
      recordFailure: casefile.recordCaseFileFailure ? async (a) => { recorded.push(a.step); return casefile.recordCaseFileFailure(a); } : undefined,
      env, stub, storeName: "bio", cs, via: "caseratify", prior: priorOf({ missing: copied.missing }) });
    return { out, recorded, counts: state.counts };
  } finally { await stub.fetch("http://do/g54/fault?mode=none"); }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), step = url.pathname.slice(6), q = (k) => url.searchParams.get(k);
    const ns = env.STORE, stub = ns.get(ns.idFromName("bio"));
    if (step === "run") return json(await postCommit(env, { fault: q("fault") || "none", caseId: q("case"), edition: Number(q("edition") || 1), waitMs: Number(q("wait") || 0) }));
    if (step === "complete") {
      /* the completing act, as the Worker runs it: the commit in the object, a pause where the copies take their time, and the
         post-commit block; a caller that disconnects in the pause cancels this request */
      const fin = await (await stub.fetch(`http://do/g54/finding?finding=${q("finding")}`)).json();
      globalThis.__g54 = { committed: true };
      const r = await postCommit(env, { fault: "none", caseId: q("case"), edition: Number(q("edition") || 1), waitMs: Number(q("wait") || 1500) });
      globalThis.__g54.after = true;
      return json({ fin, ...r });
    }
    if (step === "flag") return json(globalThis.__g54 || {});
    return json({ error: "unknown g54w step" }, 404);
  },
};

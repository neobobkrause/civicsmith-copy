/* ratification R57 (T51 fix round 6, G57), the platform check L: `G57Held` is G54's Durable Object (`g54-entry.mjs`: the real
   record, publication, public-read and ratification over `ctx.storage`, the real R2 buckets) with routes (`/g57/...`) that lay
   an edition of N member findings whose bundle.md was never copied to the published bucket (what a copy that failed leaves),
   one reached non-member finding whose bytes are absent, read the record's `textAtSha` over the real SQLite storage, and run
   the sweep's tick with the bucket's operations counted (get, head, put) and the door's. The default export is a Worker whose
   route (`/g57w/copyfail`) runs the Worker half's `copyFinding` with the finding's put made to throw, which is how the copy
   fails. R-CLOCK: counted, not timed. */
import { G54Held } from "./g54-entry.mjs";
// The attestor key G54Held lays (g54-entry.mjs: KEY); not exported there, since workerd reads every export of an entry module as a handler.
const KEY_B64 = "AAAAC3NzaC1lZDI1NTE5AAAAIKEY";
import { copyFinding } from "../../../src/ratification/finding.mjs";
import { gradingFactsLines, materialsLines, materialAttestationLines } from "../../../src/case-grammar/index.mjs";

export { G54Held };
const json = (v, status = 200) => new Response(JSON.stringify(v), { status, headers: { "content-type": "application/json" } });
const V = (id) => `member:${id}`;
const NOW = "2026-10-22T20:00:00Z";
const bare = (t) => t;
const projMd = (title) => ["---", "object_type: project", "schema: project@1", `title: "${title}"`, "current_state: forming",
  "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
  "references: []", "state_history: []", 'objective: "Find out."', "---", "", "## Objective", "", "Find out.", ""].join("\n");
const inquiryMd = (id, rev = "") => ["---", `id: ${id}`, "object_type: inquiry", "schema: inquiry@1", `title: "Is ${id} answered${rev}?"`,
  "current_state: open", "prior_state: null", `created: "2026-09-27T00:00:00Z"`, `last_updated: "2026-09-27T00:00:00Z"`,
  "references: []", "state_history: []", "surfaced_by: human", 'disposition_reason: ""', "---", "", "## Question", "",
  `Is ${id} answered${rev}?`, "", "## Session Log", "", "## Review Notes", ""].join("\n");
const caseDocText = (caseId, edition, project, targets, grading) => ["---", "format: bio-case-document/6", `case_id: ${caseId}`,
  `case_edition: ${edition}`, `case_project: ${project}`, "case_roles:",
  ...targets.flatMap((t) => [`  - target: ${t.id}`, `    version_sha: ${t.pin}`, "    edition: 1", "    role: load_bearing"]),
  "case_findings:", ...targets.map((t) => `  - ${t.id}`), "case_strength: []", "completeness:",
  "  author: member:olive", `  at: "${NOW}"`, "completeness_excluded: []", "case_citations: []",
  "method:", '  grading: "grading/1"', '  checks: "1.0.0"', ...materialsLines([]), ...materialAttestationLines([]), ...gradingFactsLines(grading), "---", "",
  "## Scope", "", "The question.", "", "## What This Excludes", "", "Nothing else.", "", "## What Was Searched", "", "Everything.", ""].join("\n");

export class G57Held extends G54Held {
  async fetch(req) {
    const url = new URL(req.url), step = url.pathname.slice(1), q = (k) => url.searchParams.get(k);
    if (!step.startsWith("g57/")) return super.fetch(req);
    const s = step.slice(4), { record, promotion, publication: pub, ratification } = this.w;
    let n = 0;
    const key = () => `k${Date.now()}-${++n}`;
    if (s === "seedn") {
      /* an owner's project and an edition of `n` member findings, every one committed (signed) with NO copy of its bundle.md to
         the published bucket, so the edition is complete and owed; `reached=1` adds one finding the case file reads but that is
         no member (a grading row names it), its bytes absent too */
      const caseId = q("case"), edition = 1, N = Number(q("n") || 1), reached = q("reached") === "1";
      this.ctx.storage.sql.exec(`INSERT OR IGNORE INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                            VALUES ('olive', 'Cover olive', 'h_olive', 'member', 'active', '["contribute"]', 't', 't')`);
      const proj = promotion.promote({ base: null, snapKey: key(), author: V("olive"), ownerMemberId: "olive",
        files: [{ path: "bundle.md", text: projMd(`Team ${caseId}`) }], meta: { object_type: "project" } });
      if (!proj.ok) return json({ error: "project", detail: proj }, 500);
      const make = (id) => {
        const r = promotion.promote({ bundleId: id, base: null, snapKey: key(), author: V("alice"),
          files: [{ path: "bundle.md", text: inquiryMd(id) }], meta: { object_type: "inquiry" } });
        if (!r.ok) throw new Error(`inquiry ${id}: ${JSON.stringify(r)}`);
        return { id, pin: record.head(id).bundleSha };
      };
      const tag = caseId.slice(-4);
      const targets = [];
      for (let i = 1; i <= N; i++) targets.push(make(`INQ-2026-${tag}-m${String(i).padStart(4, "0")}`));
      const other = reached ? make(`INQ-2026-${tag}-reached`) : null;
      const grading = other ? [{ finding: other.id, ord: 0, target: targets[0].id, kind: "support", target_edition: 1 }] : [];
      const text = caseDocText(caseId, edition, proj.bundleId, targets, grading);
      const stored = pub.storeCaseDocument({ case: caseId, edition, text, author: V("olive"), at: NOW });
      if (!stored.ok) return json({ error: "storeCaseDocument", detail: stored }, 500);
      const signed = record.transact(() => pub.commitCaseEdition({ case: caseId, edition, project: proj.bundleId,
        scope: "The question.", completeness: { statement: "It leaves out the minutes.", author: V("olive") },
        biasAcknowledgement: "none declared", bar: null, roster: targets.map((t) => ({ bundle_id: t.id, version_sha: t.pin, role: "load_bearing" })),
        sigArmored: "-----BEGIN SSH SIGNATURE-----\nsig\n-----END SSH SIGNATURE-----", attestorKey: KEY_B64, attestorMember: "olive",
        gateVersion: "plane-gate/test", deliveredBy: V("olive"), at: NOW }));
      if (!signed.ok) return json({ error: "commitCaseEdition", detail: signed }, 500);
      const commit = (t, i) => {
        const text1 = record.readFile(t.id, "bundle.md").text;
        const done = record.transact(() => pub.commitEdition({ bundleId: t.id, bundleSha: t.pin, title: `Finding ${t.id}`, completeness: null,
          strength: null, memberCarriesBlocks: false, group: "test-group", edges: [],
          shas: [{ sha256: t.pin, path: "bundle.md", kind: "bundle", bytes: new TextEncoder().encode(text1).length }],
          attestorKey: KEY_B64, attestorMember: "olive", gateVersion: "plane-gate/test",
          sigArmored: `-----BEGIN SSH SIGNATURE-----\nsig${i}\n-----END SSH SIGNATURE-----`, deliveredBy: V("olive"), at: NOW }));
        if (!done.ok) throw new Error(`commitEdition ${t.id}: ${JSON.stringify(done)}`);
      };
      targets.forEach(commit);
      if (other) commit(other, "r");
      this.fault.counts.put = 0;
      return json({ caseId, edition, findings: targets.map((t) => t.id), pins: targets.map((t) => t.pin), reached: other ? other.id : null,
                    reachedPin: other ? other.pin : null });
    }
    if (s === "textat") return json({ text: record.textAtSha(q("bundle"), q("sha")) });
    if (s === "revise") {
      /* a second version of the bundle: the first version's bytes then live only in the snapshot rows */
      const id = q("bundle"), head = record.head(id);
      const r = promotion.promote({ bundleId: id, base: head.bundleSha, snapKey: key(), author: V("alice"),
        files: [{ path: "bundle.md", text: inquiryMd(id, " (revised)") }], meta: { object_type: "inquiry" } });
      return json({ ok: r.ok, was: head.bundleSha, now: r.ok ? record.head(id).bundleSha : null, detail: r.ok ? null : r });
    }
    if (s === "shas") {
      const id = q("bundle"), text = record.readFile(id, "bundle.md").text;
      return json({ shas: [{ sha256: record.head(id).bundleSha, path: "bundle.md", kind: "bundle", bytes: new TextEncoder().encode(text).length, text }] });
    }
    if (s === "fault") {
      Object.assign(this.fault, { fault: q("mode") || "none", seen: 0, nth: Number(q("n") || 0) });
      Object.assign(this.fault.counts, { get: 0, head: 0, put: 0, bytes: 0, door: 0 });
      return json({ ok: true });
    }
    if (s === "sweep") {
      Object.assign(this.fault.counts, { get: 0, head: 0, put: 0, bytes: 0, door: 0 });
      const tick = await ratification.caseFileSweep(Number(q("now")) || Date.now());
      const c = this.fault.counts;
      return json({ tick, counts: { get: c.get, head: c.head, put: c.put, door: c.door, bytes: c.bytes } });
    }
    if (s === "ledger") {
      const row = [...this.ctx.storage.sql.exec(`SELECT casefile_state state, casefile_attempts attempts, casefile_why why, manifest_sha
                                                  FROM published_cases WHERE case_id=? AND edition=1`, q("case"))][0] || {};
      const listed = await this.env.PUBLISHED.list({ prefix: "bio/published/" });
      return json({ ...row, why: row.why ? JSON.parse(row.why) : null, objects: listed.objects.length });
    }
    if (s === "has") return json({ has: !!(await this.env.PUBLISHED.head(`bio/published/${q("sha")}`)) });
    return json({ error: "unknown g57 step" }, 404);
  }
}

export default {
  async fetch(req, env) {
    const url = new URL(req.url), step = url.pathname.slice(6), q = (k) => url.searchParams.get(k);
    const ns = env.STORE, stub = ns.get(ns.idFromName("bio"));
    if (step === "copyfail") {
      /* the Worker half's copy of a finding's bytes, its put made to throw for the finding's key only */
      const { shas } = await (await stub.fetch(`http://do/g57/shas?bundle=${q("bundle")}`)).json();
      const key = `bio/published/${shas[0].sha256}`;
      const guarded = new Proxy(env.PUBLISHED, { get(t, k) {
        if (k === "put") return async (kk, ...rest) => { if (kk === key) throw new Error("bucket refused (injected)"); return t.put(kk, ...rest); };
        const v = t[k]; return typeof v === "function" ? v.bind(t) : v; } });
      let threw = null;
      try { await copyFinding({ ...env, PUBLISHED: guarded }, "bio", { shas, partShaSet: new Set(), partedRows: new Map() }); }
      catch (e) { threw = String(e && e.message); }
      return json({ threw, stored: !!(await env.PUBLISHED.head(key)) });
    }
    return json({ error: "unknown g57w step" }, 404);
  },
};

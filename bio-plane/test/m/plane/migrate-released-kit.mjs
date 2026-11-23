/* plane's migrate-released suite (Process4: ARCH's decision "migrate-released", 23 Nov 2026), its shared kit: the releases a group may hold, the
   probe that reads a store's own SQLite beside a plane, the boot under miniflare, the client each plane is driven with, the store's shape, and the
   SEED: what each released plane writes into its store. The capture (`migrate-released-capture.mjs`, run by hand with the history fetched) seeds
   each store with the released bytes and commits it; the suite (`bio-plane/test/system/migrate-released.test.mjs`) boots the current plane on the committed stores and
   reads nothing from git. Not product code. */
import { Miniflare } from "miniflare";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";

export const SRC = (f) => fileURLToPath(new URL("../../../src/" + f, import.meta.url));
export const sha = (v) => createHash("sha256").update(v).digest("hex");
export const NOW = "2026-09-18T00:00:00Z";
/* the committed stores, one folder for each, named by `slug` of its label (`migrate-released-capture.mjs` writes them) */
export const FIXTURES = fileURLToPath(new URL("./fixtures/migrate-released/", import.meta.url));
export const slug = (label) => label.replace(/[^0-9a-z.]+/gi, "-").replace(/^-|-$/g, "");


/* THE RELEASES A GROUP MAY HOLD. 0.58.0 is the last release that boots an existing
   store and the one DIST rolled back to; 0.59.0-0.63.0 are the five WITHDRAWN from
   `release/` (d86b27ea). Pinned by COMMIT rather than by tag, because a clone need not
   carry tags and a tag can be moved; the commit named is the one whose `release/`
   holds that version's manifest. 0.58.0 is `db7589b8`, the manifest commit the row
   names — its bundle is byte-identical to the one at the `v0.58.0` tag (9ed18019),
   measured 2026-09-18. */
export const RELEASES = [
  ["0.58.0", "db7589b80c1d126e8d6345033b70319ef9d1e3a2"],
  ["0.59.0", "c53d9d926368ba75275bc2f641a9d337690914bb"],
  ["0.60.0", "76b2a5c64ebd99a944b7a10d28b620390997d95e"],
  ["0.61.0", "b57b8de21382163a2d73ef319ee481ae7418854c"],
  ["0.62.0", "2773ee2751bc0b3a54c755d177d9280e83535760"],
  ["0.63.0", "3d941c08b2aba5bfa9b639575159b59b3d21ec37"],
  /* 0.64.0: the first release that boots every store above, deployed and live-verified
     2026-09-19; the commit is dist/cut-0.64.0's cut, whose release/ holds it (DIST). */
  ["0.64.0", "a8bc9d91eca9f6f30aff2133f608ad423dc5e411"],
  /* 0.65.0: deployed and live-verified 2026-09-19 (REC-145 and D-431 disclosure closings,
     REC-141 + UI-66); the commit is dist/cut-0.65.0's cut, whose release/ holds it (DIST).
     It boots every store above, so it belongs in RELEASES and NOT in WITHDRAWN. */
  ["0.65.0", "22a72fa1454e4f801fd78d486c111a86f69452a9"],
  /* 0.66.0: deployed and live-verified 2026-09-19 (REC-152 and REC-153, two AUTHORITY
     closings, REC-152 also DISCLOSURE); the commit is dist/cut-0.66.0's cut, whose
     release/ holds it (DIST). It boots every store above: RELEASES, NOT WITHDRAWN. */
  ["0.66.0", "75069c8115f09821688722825ebf9fb10029891a"],
  /* 0.67.0: deployed and live-verified 2026-09-19 (REC-151, an AUTHORITY/DISCLOSURE
     closing: op=allocid refuses every gated prefix, ids mint opaque); the commit is
     dist/cut-0.67.0's cut, whose release/ holds it. RELEASES, NOT WITHDRAWN. */
  ["0.67.0", "527257198d5026325bb8653f3b3bd6b7cde80fde"],
  /* 0.68.0: deployed and live-verified 2026-09-20, the first BATCH (IC-55 / D-270+UI-72,
     IC-166 / REC-135, IC-167 / REC-146); the commit is dist/cut-0.68.0's cut, whose
     release/ holds it. It boots every store above: RELEASES, NOT WITHDRAWN. */
  ["0.68.0", "49c4b400ab87bb52821a1eef19d8109a02d2778b"],
  /* 0.69.0: deployed and live-verified 2026-09-21 (D-136 / IC-168, a CUT NOW: the §4.7
     vote and §4.9 capability edit an operator token could forge); the commit is
     dist/cut-0.69.0's cut, whose release/ holds it. RELEASES, NOT WITHDRAWN. */
  ["0.69.0", "37d5680859f94f22623fdea1b34b99a2550c518e"],
  /* 0.70.0: deployed and live-verified 2026-09-21 (REC-156 / IC-171, a CUT NOW: the §4.7
     endorsement op=memberadd let a caller forge); the commit is dist/cut-0.70.0's cut, whose
     release/ holds it. RELEASES, NOT WITHDRAWN. It is the LAST release before D-436 (IC-172),
     so its store is the one the D-436 boot arm below most needs: a group standing on it now. */
  ["0.70.0", "072bb9f3a414af8c4ff05ae9ddc443aa0f88454a"],
  /* 0.71.0: deployed and live-verified 2026-09-22 (a BATCH: D-436 / IC-172, the producing group
     recorded once per store, and D-434); the commit is dist/cut-0.71.0's cut, tag v0.71.0, whose
     release/ holds it. RELEASES, NOT WITHDRAWN. The FIRST release that records a producing group,
     so its store is the first the boot arm meets already holding one. */
  ["0.71.0", "9439431e0462522a52c46932985c3ad2eebcf1c7"],
  /* 0.72.0: deployed and live-verified 2026-09-23 (REC-165 / IC-176, a CUT NOW: a production names only a
     RUNNING run its caller holds); the commit is dist/cut-0.72.0's cut, whose release/ holds it. RELEASES,
     NOT WITHDRAWN. It records a producing group at a store's first boot, as 0.71.0 does. */
  ["0.72.0", "b942d97308195a644f5c2ecb3ba79967ce7548ef"],
  /* 0.73.0: deployed and live-verified 2026-09-23 (REC-168 / IC-178, a CUT NOW: op=capturerequest names a run
     its caller holds); the commit is dist/cut-0.73.0's cut, whose release/ holds it. RELEASES, NOT WITHDRAWN. */
  ["0.73.0", "d25684919e6748b92acbc080bca8dc2141273c44"],
  /* 0.74.0: deployed and live-verified 2026-09-23 (D-442 / IC-179, a CUT NOW: publishing writes nothing on a
     member finding); the commit is dist/cut-0.74.0's cut, whose release/ holds it. RELEASES, NOT WITHDRAWN. */
  ["0.74.0", "cacebb12b7b42f4825238348c4f1e834e9a2c168"],
  /* 0.75.0: deployed and live-verified 2026-09-23 (D-85 / IC-181, a CUT NOW: an `ai` credential opens a question
     only inside a RUNNING run it holds); the commit is dist/cut-0.75.0's cut, whose release/ holds it. RELEASES. */
  ["0.75.0", "90bd64518626f0f146660a128738c24685a4a501"],
  /* 0.76.0: deployed and live-verified 2026-09-23 (REC-169 / IC-184, a CUT NOW; with D-116, REC-170, DIST-6); the
     commit is dist/cut-0.76.0's cut, whose release/ holds it. RELEASES, NOT WITHDRAWN. */
  ["0.76.0", "4494f725e017b557336902012b263c49b29afe5e"],
  /* 0.77.0: deployed and live-verified on biosmoke7 2026-09-23 (REC-171 / IC-186, a CUT NOW); its pointer was HELD
     (never offered to groups) until REC-173, but biosmoke7's stores booted on it. The commit is dist/cut-0.77.0's cut. */
  ["0.77.0", "6b0beb8e7d321fe96d64de5e5b3aefa291b41599"],
  /* 0.78.0: deployed and live-verified on biosmoke7 2026-09-23 (REC-172 / IC-188, a CUT NOW; carried REC-171, REC-173,
     REC-174); its pointer landed at 38b49c50. The commit is dist/cut-0.78.0's cut, whose release/ holds it. */
  ["0.78.0", "dfe9858c89810a49422ee071c4f0bf92c0c2f297"],
  /* 0.79.0: deployed and live-verified on biosmoke7 2026-09-24 and distributed to groups; the commit is
     dist/cut-0.79.0's cut, whose release/ holds it. RELEASES, NOT WITHDRAWN. */
  ["0.79.0", "dd324152c9d999b9a0cc8cadc99947c15bebdd88"],
  /* 0.80.0: deployed to biosmoke7 2026-10-06 (K1717) and NOT distributed (K1718, K1759), but biosmoke7's store
     migrated and was written on it, as 0.77.0's was; the next release boots on that store. The commit is
     dist/cut-0.80.0's cut (never merged to main), whose release/ holds it. RELEASES, NOT WITHDRAWN. */
  ["0.80.0", "e34406635f65c9c64c86e963e94d73ec7ae61f1c"],
  /* 0.81.0: deployed to biosmoke7 2026-10-08 (K2110) and not distributed; biosmoke7's store migrated and was written
     on it, so 0.82.0 boots on that store. The commit is dist/cut-0.81.0's re-signed cut (K1922), whose release/ holds it. */
  ["0.81.0", "23cc7807f79db86dd0229824abf0fd5936cde943"],
  /* 0.82.0: deployed to biosmoke7 2026-10-12 (K2943) and not distributed; biosmoke7's store migrated and was written
     on it, so 0.83.0 boots on that store. The commit is dist/cut-0.82.0's signed cut (K2938, K2939), whose release/
     holds it. */
  ["0.82.0", "ff78c6607f039557ccea90c039e5e1346e33caf5"],
  /* 0.83.0: deployed to biosmoke7 2026-10-12 (K3048) and not distributed; biosmoke7's store migrated and was written
     on it, so 0.84.0 boots on that store. The commit is dist/cut-0.83.0's signed cut (K3048), whose release/ holds it. */
  ["0.83.0", "add6de3bde7bbb0c65c1dc55cf72406a994d371a"],
  /* 0.84.0: deployed to biosmoke7 2026-10-14 (K3237) and not distributed; biosmoke7's store migrated and was written
     on it, so 0.85.0 boots on that store. The commit is dist/cut-0.84.0's signed cut with the installer's embed
     (K3235), whose release/ holds it. */
  ["0.84.0", "396d992d316a9a61e1127ae801be5a5805f4bce9"],
  /* 0.85.0: deployed to biosmoke8 2026-10-14 to 2026-10-16 (K3569, K3581) and not distributed; biosmoke8's store migrated and
     was written on it, so 0.86.0 boots on that store. The commit is dist/cut-0.85.0's signed cut with the installer's
     embed (step 8), whose release/ holds it. */
  ["0.85.0", "1053faa726f56a1e322ff64ad9243eb0adab6e90"],
  /* 0.86.0: deployed to biosmoke8 from 2026-10-20 (K4176, K4178) and the release installed by the installer since; biosmoke8's
     store migrated and was written on it, so 0.87.0 boots on that store. The commit is dist/cut-0.86.0's signed cut with the
     installer's embed, whose release/ holds it. */
  ["0.86.0", "1a1715414958c6d99ca2ecd14b320b360266149f"],
];
export const TOK = { ADMIN_TOKEN: "adm-rec143-migrate-fixture", MEMBER_TOKEN: "mem-rec143-migrate-fixture",
              PROBE_TOKEN: "prb-rec143-migrate-fixture", AI_TOKEN: "ai-rec143-migrate-fixture" };

/* A probe beside the plane, so the store's own SQLite can be read. It subclasses the
   plane's Store and adds ONE route; every other request is the plane's own. The
   class name is the same for the old plane and the new, so both address ONE store. */
export const probe = (planeSpec, storeSpec) => `
import worker from ${JSON.stringify(planeSpec)};
import { Store } from ${JSON.stringify(storeSpec)};
export class ProbeStore extends Store {
  async fetch(req) {
    const url = new URL(req.url);
    if (url.pathname === "/rawsql") {
      const { sql, args = [] } = await req.json();
      /* The released planes' Store held \`this.sql\`; the current one (plane R1, T51) reads its SQLite as \`this.ctx.storage.sql\`. */
      try { return Response.json({ ok: true, rows: [...(this.sql ?? this.ctx.storage.sql).exec(sql, ...args)] }); }
      catch (e) { return Response.json({ ok: false, error: String(e && e.message || e) }); }
    }
    return super.fetch(req);
  }
}
export default {
  async fetch(req, env, ctx) {
    if (new URL(req.url).pathname === "/rawsql")
      return env.STORE.get(env.STORE.idFromName("bio")).fetch(req);
    return worker.fetch(req, env, ctx);
  },
};
`;
/* D-436 (IC-172) — THE INSTALLER'S NAME IS BOUND, AS EVERY INSTANCE BINDS IT. Added by DIST #4 on
   2026-09-22, the cut that ships D-436. The current plane records a store's producing group ONCE, at
   the store's first boot, from INSTANCE_NAME (decision (a)), and a store that ALREADY held the schema
   records NOTHING at boot even with the name bound (decision (b)) — because an instance's worker name
   need not be its group's slug: this project's own instance is the worker `biosmoke7` and its group is
   `believe-in-oakland`. Every released plane below ran with INSTANCE_NAME bound (it names the user
   agent), and the deploy that ships D-436 boots every such store with it still bound. A store that
   recorded the worker name at that boot could never be seeded with its group: the seed is write-once
   (C-64.3). IC-172 states what its own suite cannot see — "no pre-D-436 build is cut" — and every row
   in RELEASES is one. So the name is bound for the old planes and the current one alike, and
   `verifyCurrent` asserts the store records nothing; section 0 asserts the positive half on a fresh
   store, so the absence is not an artifact of the binding going unread. A worker name, not a group's. */
export const INSTANCE = "released-store-worker";
/* The first release that records a producing group at a store's first boot (D-436, IC-172). */
export const recordsGroup = (v) => { const [a, b, c] = v.split(".").map(Number); return a > 0 || b > 71 || (b === 71 && c >= 0); };
export const boot = (scriptPath, script, persist, version) => new Miniflare({
  modules: true, modulesRoot: "/", scriptPath, script,
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "ProbeStore", useSQLite: true } },
  r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ...TOK, VERSION: version, INSTANCE_NAME: INSTANCE },
  defaultPersistRoot: persist,
});
export const bootCurrent = (persist) =>
  boot(SRC("rec143-migrate-probe.mjs"), probe("./plane/index.mjs", "./plane/index.mjs"), persist, "current");   /* T12 B6, 2026-09-29 (K414, INSTANCE-SETUP #1 J5): the store as the plane starts it, instance-setup registering promotion's producingGroup */

/* A RESPONSE THAT IS NOT JSON IS AN ANSWER, NOT A CRASH — `content-chain-kind`'s rule:
   a bricked Durable Object answers with an error page, and `.json()` on it would end
   the module with no tally, which names nothing. */
export const asJson = async (res) => { const txt = await res.text();
  // fixtures-own: harness the test's own report of a body that is not JSON (a bricked object's error page), made at the transport, never a module's answer
  try { return JSON.parse(txt); } catch { return { ok: false, status: res.status, error: `non-JSON ${res.status}: ${txt.slice(0, 300)}` }; } };
/* HOW A CREDENTIAL TRAVELS (admission R5, R20; K2166). A RELEASED plane is driven as it shipped: its credential in the
   address (`?token=`), the member binding its default. The CURRENT plane reads a credential only from the
   `Authorization` header, never the address, and retires the shared member key (`MEMBER_TOKEN_RETIRED`), so a call the
   released planes made with the member binding is made with the administrator's binding, in the header. */
export const client = (mf, { current = false } = {}) => {
  const MEMBER = current ? TOK.ADMIN_TOKEN : TOK.MEMBER_TOKEN;
  const call = (op, qs, tok, init = {}) => {
    const t = tok === undefined ? MEMBER : tok;
    if (!current) return mf.dispatchFetch(`http://x/api/?op=${op}&token=${t}&${qs}`, init);
    return mf.dispatchFetch(`http://x/api/?op=${op}&${qs}`,
      t ? { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${t}` } } : init);
  };
  return {
    raw: async (sql, ...args) => asJson(await mf.dispatchFetch("http://x/rawsql",
      { method: "POST", body: JSON.stringify({ sql, args }) })),
    get: async (op, qs = "", tok = undefined) => asJson(await call(op, qs, tok)),
    post: async (op, body, tok = undefined) => asJson(await call(op, "", tok, { method: "POST", body: JSON.stringify(body) })),
  };
};
export const errOf = (r) => r && (r.error || r.reason || r.code) ? String(r.error || r.reason || r.code) : null;
/* op=instancegroup's answer, unwrapped as instance-group.test.mjs's `rP` does; null-tolerant, so a
   store that answers nothing NAMES the assertion instead of ending the module on a TypeError. */
export const groupOf = async (c) => {
  const r = await c.get("instancegroup", "", TOK.ADMIN_TOKEN);
  const g = (r && typeof r === "object" && r.result && typeof r.result === "object") ? r.result : r;
  return [g?.ok ?? null, g?.group === undefined ? errOf(g) ?? "absent" : g.group, g?.source ?? null];
};

/* The store's SHAPE: every table (with every column, hidden ones included), every
   index and every trigger, by name. SQLite's own and Cloudflare's internal tables
   are not the schema's and are left out. */
export const shapeOf = async (c) => {
  const m = await c.raw(`SELECT type, name, tbl_name FROM sqlite_master
                          WHERE name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%' ORDER BY type, name`);
  if (!m.ok) return { error: m.error };
  const tables = {}, others = [];
  for (const r of m.rows) {
    if (r.type === "table") {
      const x = await c.raw(`PRAGMA table_xinfo(${r.name})`);
      tables[r.name] = (x.rows || []).map((k) => k.name).sort();
    } else if (r.type === "index" || r.type === "trigger" || r.type === "view") others.push(`${r.type}:${r.name}`);
  }
  return { tables, others: others.sort() };
};

export const infoMd = (id) => ["---",
  `id: ${id}`, "object_type: information", "schema: information@1",
  `title: "Info ${id}"`, "current_state: collected", "prior_state: null",
  `created: "${NOW}"`, `last_updated: "${NOW}"`,
  "produced_by:", "  mode: assisted", "  capability_tier: session",
  "group: believe-in-oakland", "references: []", "state_history: []",
  "annotations_open: 0",
  "reeval_pending:", "  flag: false", "  since: null", "  source: null",
  "visuals: []", "criticality: supporting", "source_status: unchanged",
  "source:", "  locator: in hand", "  authority: synthetic", `  retrieved: ${NOW}`,
  "monitoring:", "  enabled: false", "  frequency: none",
  "---", "", "## Summary", "", "A captured document.", "",
  "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");

/* ==================================================================== 0
 * THE REFERENCE: a store the CURRENT plane builds fresh. The shape every migrated
 * store must equal.
 * ================================================================== */
export const ROWS_Q = [
  "SELECT bundle_id, bundle_sha, current_state FROM bundles ORDER BY bundle_id",
  "SELECT bundle_id, ord, target_id, role, grade, grade_axis, grade_source, note, at FROM inquiry_basis ORDER BY bundle_id, ord",
  "SELECT bundle_id, name, ord, target_id, role, note, ground FROM inquiry_basis_version_legs ORDER BY bundle_id, name, ord",
  "SELECT count(*) AS n FROM files",
  "SELECT count(*) AS n FROM manifest",
];
/* `bootRelease(version, persist)` boots that release's signed bytes; `t(label, got, want)` records each ARMED check; `n` numbers the document */
export const seed = async (label, version, persist, { bootRelease, t, n }) => {
  const mf = bootRelease(version, persist);
  /* From 0.82.0 a RELEASED plane reads its credential only from the `Authorization` header and retires the shared member
     key (admission R5, R20, K2166, shipped in 0.82.0), so it is driven as the current plane is; earlier ones as they shipped. */
  const [maj, min] = version.split(".").map(Number);
  const c = client(mf, { current: maj > 0 || min >= 82 });
  const DOC = `INFO-2026-9143-${String(n).padStart(2, "0")}`;
  const text = infoMd(DOC);
  const pr = await c.post("promote", {
    bundleId: DOC, base: null, snapKey: `20260918T${String(100000 + n)}Z_${sha(label).slice(0, 8)}`,
    /* The meta's title is the document's own (`Info <id>`): 0.80.0 refuses an envelope title the document does not
       bear (C-86.3, ENVELOPE_TITLE_DISAGREES; K1901), and every earlier release takes it as the same name. */
    meta: { object_type: "information", group: "believe-in-oakland", title: `Info ${DOC}`,
            current_state: "collected", created: NOW, last_updated: NOW },
    files: [{ path: "bundle.md", text, bytes: text.length, sha256: sha(text) }], register: [] });
  /* The promotion's own verdict, inside the door's envelope when the release wraps it (`{ok, result: {ok, …}}`): the
     envelope's `ok` says only that the store answered, so it alone would arm this on a refused promotion (K1901). */
  const promoted = pr && pr.result && typeof pr.result === "object" && "ok" in pr.result ? pr.result : pr;
  t(`${label}: ARMED — ${version} promoted a document through its own op`, promoted.ok === true ? true : errOf(promoted) ?? promoted.ok, true);
  const legs = [
    await c.raw(`INSERT INTO inquiry_basis (bundle_id,ord,target_id,target_type,role,grade,grade_axis,grade_source,note,at,ground)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?)`, "INQ-2026-9143", 0, DOC, "information", "supports",
                "B", "capture", "capture", "rec143 legacy leg", NOW, null),
    await c.raw(`INSERT INTO inquiry_basis_version_legs (bundle_id,name,ord,target_id,target_type,role,grade,grade_axis,grade_source,note,at,ground)
                 VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`, "INQ-2026-9143", "v1", 0, DOC, "information", "supports",
                null, null, null, "rec143 legacy version leg", NOW, "g1"),
  ];
  t(`${label}: ARMED — ${version}'s store took a basis leg and a version leg`, legs.map((r) => r.ok ? true : r.error), [true, true]);
  /* WHAT THE OLD PLANE STORED, read through its own op — the reference the upgrade must preserve.
     Corrected by DIST #5 at the 0.72.0 cut (the 0.71.0 row): this suite compared op=file after the
     upgrade against the text it SUBMITTED, which holds only while no release rewrites a document at
     promote. 0.71.0 does: it stamps the store's recorded producing group into the bytes (measured
     2026-09-23: its op=file answers `group: released-store-worker` where the submission said
     `group: believe-in-oakland`, and every release 0.58.0-0.70.0 answers the submission unchanged).
     The claim is that the upgrade preserves the OLD PLANE's bytes, so that is what is compared. */
  const f0 = await c.get("file", `id=${DOC}&path=bundle.md`);
  const served = (f0.result ?? f0).text ?? null;
  t(`${label}: ARMED — ${version} serves the document it stored through its own op=file`, typeof served, "string");
  /* D-436 on a store born on a release that ALREADY records a producing group (0.71.0 and later):
     that release recorded its bound name at the store's own first boot (decision (a)), so the
     current plane must KEEP that value — not clear it, not re-decide it. Before 0.71.0 no plane
     records one, and the current plane must record none (decision (b)). */
  const groupBefore = recordsGroup(version) ? await groupOf(c) : [true, null, null];
  if (recordsGroup(version)) {
    t(`${label}: ARMED — ${version} recorded its bound name at the store's own first boot (decision (a))`,
      groupBefore, [true, INSTANCE, "bootstrap"]);
  }
  const rows = [];
  for (const q of ROWS_Q) rows.push((await c.raw(q)).rows ?? null);
  await mf.dispose();
  t(`${label}: ARMED — the rows ${version} wrote are there to survive (a bundle, a leg, a version leg, its files)`,
    [rows[0]?.length, rows[1]?.length, rows[2]?.length, (rows[3]?.[0]?.n ?? 0) > 0], [1, 1, 1, true]);
  return { DOC, text, served, groupBefore, rows };
};

/* THE CURRENT PLANE on a store somebody else wrote: it answers, it has a fresh
   store's exact shape, the rows survive, and a second boot is clean. */

/* the five releases WITHDRAWN from `release/` (d86b27ea): each bricked a store born before it (section 3 of the suite) */
export const WITHDRAWN = new Set(["0.59.0", "0.60.0", "0.61.0", "0.62.0", "0.63.0"]);

/* A captured store, made whole and small before it is committed: each SQLite file's write-ahead log folded into it (`wal_checkpoint(TRUNCATE)`)
   and its free pages dropped (`VACUUM`), the `-wal` and `-shm` files removed, and miniflare's cache, which no plane writes, left out. Every table,
   column, index, trigger and row the release wrote is kept; each file is then committed gzipped (`<name>.sqlite.gz`, the empty pages make a
   6 MB store about 50 KB), and `storeCopy` restores the bytes exactly before miniflare opens them. */
export function compactStore(storeDir) {
  return import("node:fs").then(async ({ readdirSync, statSync, rmSync, existsSync, readFileSync, writeFileSync }) => {
    const { gzipSync } = await import("node:zlib");
    const { DatabaseSync } = await import("node:sqlite");
    const { join } = await import("node:path");
    rmSync(join(storeDir, "cache"), { recursive: true, force: true });
    const walk = (d) => readdirSync(d).flatMap((n) => { const p = join(d, n); return statSync(p).isDirectory() ? walk(p) : [p]; });
    for (const f of walk(storeDir).filter((p) => p.endsWith(".sqlite"))) {
      const db = new DatabaseSync(f);
      db.exec("PRAGMA wal_checkpoint(TRUNCATE)");
      db.exec("VACUUM");
      db.close();
      for (const x of ["-wal", "-shm"]) if (existsSync(f + x)) rmSync(f + x);
      writeFileSync(f + ".gz", gzipSync(readFileSync(f), { level: 9 }));
      rmSync(f);
    }
  });
}

/* A committed store, copied whole into `persist` with each `.sqlite.gz` ungzipped to its `.sqlite`: the bytes the capture kept. The committed
   store is never written. */
export async function storeCopy(storeDir, persist) {
  const { readdirSync, statSync, mkdirSync, readFileSync, writeFileSync } = await import("node:fs");
  const { gunzipSync } = await import("node:zlib");
  const { join } = await import("node:path");
  const copy = (from, to) => {
    mkdirSync(to, { recursive: true });
    for (const n of readdirSync(from)) {
      const p = join(from, n);
      if (statSync(p).isDirectory()) copy(p, join(to, n));
      else if (n.endsWith(".sqlite.gz")) writeFileSync(join(to, n.slice(0, -3)), gunzipSync(readFileSync(p)));
      else writeFileSync(join(to, n), readFileSync(p));
    }
  };
  copy(storeDir, persist);
  return persist;
}

/* THE CURRENT PLANE on a store somebody else wrote: it answers, it has a fresh
   store's exact shape, the rows survive, and a second boot is clean. */
/* `t` records each check; `FRESH` is the fresh reference store's shape (the suite's section 0), handed in */
export const verifyCurrent = async (label, persist, { DOC, served, groupBefore, rows }, t, FRESH) => {
  let mf = bootCurrent(persist);
  let c = client(mf, { current: true });
  const bs = await c.get("bootstrap", "", "");
  t(`${label}: op=bootstrap REACHES THE STORE — never STORE_DID_NOT_ANSWER`,
    [bs.ok !== false || errOf(bs), JSON.stringify(bs).includes("STORE_DID_NOT_ANSWER")], [true, false]);
  const up = await c.raw("SELECT 1 AS up");
  t(`${label}: the Durable Object ANSWERS — its #migrate completed (a thrown migration is named here)`,
    up.ok ? true : up.error, true);
  const st = await c.get("stats");
  t(`${label}: op=stats answers from the store`, st.ok !== false ? true : errOf(st), true);
  const au = await c.get("audit", "", TOK.ADMIN_TOKEN);
  t(`${label}: op=audit answers from the store`, au.ok !== false ? true : errOf(au), true);
  const sf = await c.get("selftest", "", TOK.PROBE_TOKEN);
  t(`${label}: op=selftest answers`, [sf.ok, sf.service], [true, "bio-plane"]);
  t(groupBefore[1] === null
      ? `${label}: D-436 DECISION (b) — the store a released plane wrote records NO producing group at the current `
        + `plane's first boot, though INSTANCE_NAME ('${INSTANCE}') is bound: only the root of trust's seed may decide it`
      : `${label}: D-436 — the group the old plane recorded at the store's own first boot is KEPT at the current `
        + `plane's first boot, unchanged: no later boot re-decides it`,
    await groupOf(c), groupBefore);

  const after = await shapeOf(c);
  const lacking = [], extra = [];
  for (const [tb, cols] of Object.entries(FRESH.tables || {})) {
    if (!after.tables?.[tb]) { lacking.push(`${tb}(table)`); continue; }
    for (const col of cols) if (!after.tables[tb].includes(col)) lacking.push(`${tb}.${col}`);
  }
  for (const tb of Object.keys(after.tables || {})) if (!FRESH.tables?.[tb]) extra.push(tb);
  t(`${label}: the migrated store has EVERY table and column a fresh store has (table_xinfo)`, lacking, []);
  t(`${label}: and no table a fresh store lacks — every fold and rename completed`, extra, []);
  t(`${label}: and EVERY index and trigger a fresh store has — none weakened, none skipped`,
    (FRESH.others || []).filter((o) => !(after.others || []).includes(o)), []);
  t(`${label}: in particular inquiry_basis.content_id and its index — the column and index that bricked 0.59.0-0.63.0`,
    [after.tables?.inquiry_basis?.includes("content_id"), (after.others || []).includes("index:inquiry_basis_content")],
    [true, true]);

  const rowsAfter = [];
  for (const q of ROWS_Q) rowsAfter.push((await c.raw(q)).rows ?? null);
  t(`${label}: every row the old plane wrote SURVIVES, value for value`, rowsAfter, rows);
  t(`${label}: and the legacy leg reads NULL for content_id — no backfill invented an extent`,
    (await c.raw("SELECT content_id FROM inquiry_basis WHERE bundle_id='INQ-2026-9143'")).rows, [{ content_id: null }]);
  const got = await c.get("file", `id=${DOC}&path=bundle.md`);
  t(`${label}: THROUGH THE OP — op=file reads the old document's bytes exactly as the old plane stored them`,
    sha((got.result ?? got).text ?? String(errOf(got))), sha(served));
  await mf.dispose();

  mf = bootCurrent(persist);
  c = client(mf, { current: true });
  const again = await c.raw("SELECT count(*) AS n FROM inquiry_basis");
  t(`${label}: a SECOND boot is clean — the store answers and holds the same rows`,
    again.ok ? again.rows[0].n : again.error, 1);
  t(`${label}: D-436 — and a SECOND boot leaves the producing group as it found it (no later boot reads the binding)`,
    await groupOf(c), groupBefore);
  await mf.dispose();
};


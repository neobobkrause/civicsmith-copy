/* scheduler in the running plane (Miniflare, the Durable Object the product runs in): the registry the plane builds
   (R5, R8), a producer's notice arming it (R9), and the suspended run woken on the alarm that expires its request
   (R12, D-583). The alarm is driven through the Durable Object's `onAlarm(now)` on a virtual clock that starts at the
   wall clock, never in the past, so the real alarm the reconcile sets never fires inside the test.
   The plane is capture-requests' scratch plane (`test/m/capture-requests/plane-world.mjs`; T41-49, K2514): run-rules
   R19 as amended gates every run on its mode's test bar on Civicsmith's set, which holds no matter yet (N829), so in the
   plane as deployed R12's run never opens; that copy holds a one-matter set and a passing bar for each part, and differs
   from `src/` in nothing else. */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { Miniflare } from "miniflare";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { list as heldProfiles, combine } from "../../../../jurisdictions/index.mjs";
import { planeEntry } from "../capture-requests/plane-world.mjs";
import { word } from "../../../src/setup-words/index.mjs";

const sha = (v) => createHash("sha256").update(v).digest("hex");
/* R12's requested address, at a host the governor holds (below) */
const HELD_DOC = "https://www.held.example.org/doc.pdf";
let MF;
const PLANE = planeEntry();
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: PLANE.entry,
  script: readFileSync(PLANE.entry, "utf8"), modulesRules: [{ type: "ESModule", include: ["**/*.mjs"] }],
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } }, r2Buckets: ["CAPTURES", "PUBLISHED"],
  bindings: { ADMIN_TOKEN: "adm-sch", PROBE_TOKEN: "prb-sch", DAEMON_TOKEN: "dmn-sch",
              VERSION: "1.0.0", INSTANCE_NAME: "sch-plane", GOVERNOR_APPETITE_PER_MIN: "600000",
              CAPTURE_REQUEST_TICK_MS: "3600000", MONITOR_TICK_MS: "3600000",
              ACCOUNT_SEAL_SECRET: "sched-plane-seal-secret" },   /* a member's account reference is kept sealed (credentials R23) */
  serviceBindings: { SELF: async (request) => MF.dispatchFetch(request) },
  outboundService(request) {
    /* capture-requests R49 (T35-83, K1993): the page a member captures first, whose one outbound link is the address the
       R12 run asks for, so the request names an address the record already holds (capture R27's links) */
    if (new URL(request.url).host === "index.example.org")
      return new Response(`<!doctype html><html><head><title>Index</title></head><body><a href="${HELD_DOC}">${HELD_DOC}</a></body></html>`,
        { headers: { "content-type": "text/html; charset=utf-8" } });
    return new Response(new Uint8Array(512).map((_, i) => i % 251), { headers: { "content-type": "application/pdf" } });
  },
});
MF = mf;
after(async () => { await mf.dispose(); PLANE.dispose(); });

const rP = (r) => (r && typeof r === "object" && "result" in r ? r.result : r);
/* admission R20 (C-38.10, K2189): a credential is read only from the Authorization header or the body, never the
   address. The suite names its credential as `token=…` in each call, for readability; `send` lifts it out of the
   address into `Authorization: Bearer …` before the request is sent (as membership's members.test.mjs, K2182). */
const send = (q, init = {}) => {
  const params = new URLSearchParams(q);
  const token = params.get("token");
  params.delete("token");
  const headers = token === null ? {} : { authorization: `Bearer ${token}` };
  return mf.dispatchFetch(`http://x/api/?${params}`, { ...init, headers });
};
const GET = async (q) => rP(await (await send(q)).json());
const POST = async (q, body) => rP(await (await send(q, { method: "POST", body: JSON.stringify(body ?? {}) })).json());
/* An enrolled member's session (admission R5, C-38.11: the shared member token is retired): added by the
   administrator, enrolled with its invitation, signed in. An ordinary member once the group has its two
   administrators; before then, an administrator (membership's ADMINS_FIRST). */
async function enrolled(memberId) {
  const add = (role) => POST("op=memberadd&token=adm-sch",
    { memberId, cover: `cover for ${memberId}`, role, capabilities: ["contribute", "publish", "create_projects"] });
  let a = await add("member");
  if (a.reason === "ADMINS_FIRST") a = await add("admin");
  const en = await POST("op=enroll", { invite: a.invite, handle: memberId, password: `${memberId}-passphrase-1` });
  assert.equal(en.ok, true, JSON.stringify({ a, en }).slice(0, 300));
  return (await POST("op=login", { handle: memberId, password: `${memberId}-passphrase-1` })).token;
}
const store = async () => { const ns = await mf.getDurableObjectNamespace("STORE"); return ns.get(ns.idFromName("bio")); };

test("R5, R8: the plane's registry is R5's consumers, the later ones registered by their own modules (tasks, queue, instance-setup) in their R5 places", async () => {
  const obj = await store();
  const r = await obj.onAlarm(Date.now());
  assert.deepEqual(Object.keys(r).slice(0, 10),
    ["swept", "drained", "created", "folded", "refused", "waiting", "remaining", "rearmed", "nextAt", "probes"]);
  assert.deepEqual(r.probes, []);
  assert.equal(typeof r.overduescan, "object", "the overdue scan is due at every firing");
});

test("R9: a selection created on an idle instance leaves the alarm armed at the sweep's wake (retrieval R52)", async () => {
  const obj = await store();
  await obj.onAlarm(Date.now());
  const before = await obj.schedAlarmAt();
  const t0 = Date.now();
  const sel = await POST("op=select&token=adm-sch", { q: "type:inquiry", kind: "query" });
  assert.equal(typeof sel.handle, "string", JSON.stringify(sel));
  const at = await obj.schedAlarmAt();
  assert.ok(at !== null && (before === null || at <= before), `armed: ${at} (was ${before})`);
  assert.ok(at >= t0 + 330_000 - 5 && at <= Date.now() + 330_000, "at now + the selection lifetime + 30 s (retrieval R51)");
});

/* An information bundle carrying one captured document whose reading names an ordinance, in the register's shape
   op=acquire writes (C-18.1), so op=resolve has a reference to resolve. */
async function promoteReading(id, captureSha, ref, token) {
  const C = "2026-09-01T00:00:00Z", loc = `https://fixture.invalid/${id}.bin`, file = `snapshots/${id}.bin`;
  const md = ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Reading ${id}"`,
    "current_state: collected", "prior_state: null", `created: ${C}`, `last_updated: ${C}`, "produced_by:",
    "  mode: assisted", "  capability_tier: session", "group: a-group", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
    "criticality: supporting", "source_status: unchanged", "source:", "  locator: in hand", "  authority: synthetic",
    `  retrieved: ${C}`, "monitoring:", "  enabled: false", "  frequency: none", "---", "", "## Summary", "", "A reading.",
    "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const doc = { file, locator: loc, retrieved: C, authority_state: "undetermined",
    authority_basis: `a test fixture: no authority was asserted and none is determined; recorded ${C}`,
    origin: { kind: "named_request" },
    capture: { method: "fixture-capture", grade: "B", actor_class: "session",
               sha256: captureSha, encoding: "binary", bytes: 10 },
    reading: { content_type: "meeting_calendar", reader_version: 1, found: true, at: C,
               entities: [{ ref, kind: "ordinance", key: ref.split(":")[1], label: `Ordinance ${ref}` }] } };
  const prov = JSON.stringify({ documents: [doc] });
  return await POST(`op=promote&token=${token}`, { bundleId: id, base: null, snapKey: `${id}-s`, author: "sch", register: [],
    meta: { object_type: "information", group: "a-group", title: `Reading ${id}`, current_state: "collected", created: C, last_updated: C },
    files: [{ path: "bundle.md", text: md, bytes: md.length, sha256: sha(md) },
            { path: "data/provenance.json", text: prov, bytes: prov.length, sha256: sha(prov) },
            { path: file, blobSha: captureSha, sha256: captureSha, bytes: 10 }] });
}

/* An information bundle filing one capture op=acquire made, its register the document the acquisition answered. */
async function fileCapture(id, doc, token) {
  const C = "2026-09-01T00:00:00Z", cap = doc.capture.sha256;
  const md = ["---", `id: ${id}`, "object_type: information", "schema: information@1", `title: "Capture ${id}"`,
    "current_state: collected", "prior_state: null", `created: ${C}`, `last_updated: ${C}`, "produced_by:",
    "  mode: assisted", "  capability_tier: session", "group: a-group", "references: []", "state_history: []",
    "annotations_open: 0", "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []",
    "criticality: supporting", "source_status: unchanged", "source:", `  locator: ${doc.locator}`, "  authority: synthetic",
    `  retrieved: ${C}`, "monitoring:", "  enabled: false", "  frequency: none", "---", "", "## Summary", "", "A capture.",
    "", "## Provenance Notes", "", "## Session Log", "", "## Review Notes", ""].join("\n");
  const prov = JSON.stringify({ documents: [doc] });
  return await POST(`op=promote&token=${token}`, { bundleId: id, base: null, snapKey: `${id}-s`,
    register: [{ sha256: cap, path: doc.file, encoding: doc.capture.encoding, bytes: doc.capture.bytes }],
    meta: { object_type: "information", group: "a-group", title: `Capture ${id}`, current_state: "collected", created: C, last_updated: C },
    files: [{ path: "bundle.md", text: md, bytes: md.length, sha256: sha(md) },
            { path: "data/provenance.json", text: prov, bytes: prov.length, sha256: sha(prov) },
            { path: doc.file, blobSha: cap, sha256: cap, bytes: doc.capture.bytes }] });
}

test("R9: a resolution that marks an entity leaves the alarm armed at the connection sweep's wake (entities R13, connections R18)", async () => {
  const obj = await store();
  const MIA = await enrolled("mia");
  const ent = await POST(`op=entitycreate&token=${MIA}`, { kind: "ordinance", label: "A Rent Ordinance",
    note: "The rent ordinance the fixture readings name, registered so a resolution can mark it.", aliases: ["ordinance:24680"] });
  assert.equal(ent.ok, true, JSON.stringify(ent));
  const capA = sha("sched-resolve-A"), capB = sha("sched-resolve-B");
  for (const [id, c] of [["INFO-2026-0001-sch", capA], ["INFO-2026-0002-sch", capB]]) {
    const pr = await promoteReading(id, c, "ordinance:24680", MIA);
    assert.equal(pr.ok, true, JSON.stringify(pr).slice(0, 300));
  }
  await obj.onAlarm(Date.now());
  const before = await obj.schedAlarmAt();
  const t0 = Date.now();
  for (const c of [capA, capB]) {
    const r = await POST(`op=resolve&token=${MIA}`, { captureSha: c });
    assert.equal(r.resolved?.[0]?.entity_id, ent.entity_id, JSON.stringify(r).slice(0, 300));
  }
  const at = await obj.schedAlarmAt();
  assert.ok(at !== null && (before === null || at <= before), `armed: ${at} (was ${before})`);
  assert.ok(at >= t0 + 60_000 - 5 && at <= Date.now() + 60_000, "at now + the sweep's delay (connections R18's 60 s)");
  const fired = await obj.onAlarm(at);
  assert.deepEqual([fired.connderive?.entities, fired.connderive?.remaining], [1, 0], "the sweep derives the marked entity");
});

test("R5, R9: a promotion that leaves an action holding a past-dated pending clock entry arms the deadline re-check, and the real alarm marks it overdue (monitoring R34, R50)", async () => {
  const obj = await store();
  const DAY = 86_400_000;
  /* two days ago, UTC: before the local day in any profile's zone, so R50's wake has passed, the arm sets the real alarm and workerd fires it; the plane's own clock judges the mark (actions
     R33), so the date must truly have passed */
  const date = new Date(Math.floor(Date.now() / DAY) * DAY - 2 * DAY).toISOString().slice(0, 10);
  const ACT = "ACTN-2026-0900-sched";
  const C = "2026-09-01T00:00:00Z";
  const md = ["---", `id: ${ACT}`, "object_type: action", `title: ${ACT}`, "current_state: planned", `created: "${C}"`,
    `last_updated: "${C}"`, "action_kind: records_request", "risk_tier: 1", "counterparty:", "  state: named",
    "  role: Town Clerk", "  body: Town of Port Ellery", "clock:", "  - text: reply", "    description: reply window",
    `    date: ${date}`, "    basis: statute", "    status: pending", "---", "", "An action.", ""].join("\n");
  /* a risk tier is set only by a member's authored act (actions R40), so the action is promoted by an enrolled member */
  const add = await POST("op=memberadd&token=adm-sch",
    { memberId: "sam", cover: "cover for sam", role: "admin", capabilities: ["contribute", "publish"] });
  assert.equal((await POST("op=enroll", { invite: add.invite, handle: "sam", password: "sam-passphrase-1" })).ok, true);
  const SAM = (await POST("op=login", { handle: "sam", password: "sam-passphrase-1" })).token;
  /* the day is the group's local day (actions R12, R33; monitoring R50): the instance holds a profile with a zone */
  const zoned = heldProfiles().find((p) => !p.test && combine([p.id]).view?.time_zone?.value);
  const prof = await POST(`op=profilesset&token=${SAM}`, { profiles: [zoned.id] });
  assert.equal(prof.ok, true, JSON.stringify(prof).slice(0, 300));
  const first = await obj.onAlarm(Date.now());
  assert.equal("deadlinerecheck" in first, false, "nothing pending: it does not tick");
  const pr = await POST(`op=promote&token=${SAM}`, { bundleId: ACT, base: null, snapKey: "20260920T000000Z_0900", author: "sch",
    register: [], files: [{ path: "bundle.md", text: md, bytes: md.length, sha256: sha(md) }],
    meta: { object_type: "action", group: "a-group", title: ACT, current_state: "planned", created: C, last_updated: C } });
  assert.equal(pr.ok, true, JSON.stringify(pr).slice(0, 300));
  /* the real alarm fires and ticks the consumer: the entry leaves `pending`, so a later firing finds nothing due */
  let r = null;
  for (let i = 0; i < 100; i++) {
    r = await GET(`op=image&token=${SAM}&id=${ACT}`);
    const st = JSON.stringify(r);
    if (/overdue/.test(st)) break;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  assert.match(JSON.stringify(r), /status: overdue/, JSON.stringify(r).slice(0, 400));
  const after = await obj.onAlarm(Date.now());
  assert.equal("deadlinerecheck" in after, false, "marked, it holds no wake (R15), so it is not due again");
});

/* R12 is met in-process over the real ai-runs and capture-requests by `notice-ai-runs-323.test.mjs` (coordinator ruling,
   5 Nov 17:24). Over this running plane it waits on two found marks: no Miniflare plane can connect a member's own
   account (`op=aiownadd` answers CATALOGUE_UNAVAILABLE) until store-assembly hands assembleStore the catalogue's keys
   (store-assembly R1, `catalogueKeys`) and ai-catalogue F2 gives a test or development plane a signed catalogue that
   lists plans. */
test.todo("R12 in the running plane: a run waiting on a request that reaches expired is woken on the alarm that expires it, exactly once (waits on store-assembly R1 catalogueKeys and ai-catalogue F2)");

test("R9: in the plane, a promotion that ratifies a sweep on an idle instance leaves the alarm armed at the sweep's wake (link-sweep R4, promotion R45); the same sweep unratified arms nothing for it", async () => {
  const obj = await store();
  const C = "2026-09-01T00:00:00Z";
  /* an ordinary member once the group has its two administrators (the earlier tests' admins); alone, an administrator */
  const memberAdd = (role) => POST("op=memberadd&token=adm-sch",
    { memberId: "swen", cover: "cover for swen", role, capabilities: ["contribute", "publish", "create_projects"] });
  let add = await memberAdd("member");
  if (add.reason === "ADMINS_FIRST") add = await memberAdd("admin");
  const en = await POST("op=enroll", { invite: add.invite, handle: "swen", password: "swen-passphrase-1" });
  assert.equal(en.ok, true, JSON.stringify({ add, en }).slice(0, 300));
  const SWEN = (await POST("op=login", { handle: "swen", password: "swen-passphrase-1" })).token;
  const pmd = ["---", "object_type: project", 'title: "Sweep project"', "current_state: forming", `created: "${C}"`,
    `last_updated: "${C}"`, 'objective: "Establish what the council publishes."', "references: []", "required_strength:",
    "  capture: B", "  connection: C", "---", "", "## Summary", "", "A project.", "", "## Session Log", ""].join("\n");
  const proj = await POST("op=promote&token=adm-sch", { base: null, snapKey: "sched-sweep-proj",
    files: [{ path: "bundle.md", text: pmd, bytes: pmd.length, sha256: sha(pmd) }], register: [],
    meta: { object_type: "project", group: "a-group", current_state: "forming", created: C, last_updated: C } });
  assert.equal(proj.ok, true, JSON.stringify(proj).slice(0, 300));
  const own = await (await obj.fetch("http://x/projectclaimowner", { method: "POST",
    body: JSON.stringify({ projectId: proj.bundleId, memberId: "swen" }) })).json();
  assert.equal((own.result ?? own).ok, true, JSON.stringify(own));
  const LIST = "INFO-2026-0952-sched-sweep";
  const md = ["---", `id: ${LIST}`, "object_type: information", "schema: information@2", `title: "Council listing"`,
    "current_state: collected", "prior_state: null", `created: ${C}`, `last_updated: ${C}`, "produced_by:", "  mode: assisted",
    "  capability_tier: session", "references: []", "state_history: []", "annotations_open: 0",
    "reeval_pending:", "  flag: false", "  since: null", "  source: null", "visuals: []", "criticality: supporting",
    "source_status: unchanged", "source:", "  locator: https://records.example.org/council/list", "  authority: Town Clerk",
    `  retrieved: ${C}`, "monitoring:", "  enabled: false", "  last_checked: null", `project: ${proj.bundleId}`, "---", "",
    "## Summary", "", "A listing.", "", "## Provenance Notes", "", "## Session Log", "", "### Session 1", "", "Captured.", "",
    "## Review Notes", ""].join("\n");
  const sweep = (ratified) => ({ id: "minutes", title: "Council minutes", ratified, sources: ["https://records.example.org/council"],
    seeds: ["https://records.example.org/council/index.html"], match: { terms: ["minutes"] }, cadence: "weekly",
    budget: { per_run: 10, backlog: 20 } });
  let base = null, n = 0;
  const write = async (ratified) => {
    const g = JSON.stringify({ sweeps: [sweep(ratified)] });
    const r = await POST(`op=promote&token=${SWEN}`, { bundleId: LIST, base, snapKey: `sched-sweep-${++n}`, register: [],
      files: [{ path: "bundle.md", text: md, bytes: md.length, sha256: sha(md) },
              { path: "data/gathering.json", text: g, bytes: g.length, sha256: sha(g) }],
      meta: { object_type: "information", group: "a-group", current_state: "collected", created: C, last_updated: C } });
    assert.equal(r.ok, true, JSON.stringify(r).slice(0, 300));
    base = r.bundleSha;
  };
  /* idle, as far as the sweep goes: whatever earlier tests left wants no wake sooner than a minute from now */
  await obj.onAlarm(Date.now());
  const before = await obj.schedAlarmAt();
  assert.ok(before === null || before > Date.now() + 60_000, `nothing due within a minute: ${before}`);
  await write(false);
  assert.equal(await obj.schedAlarmAt(), before, "an unratified sweep's promotion arms nothing for it");
  const t0 = Date.now();
  await write(true);
  const at = await obj.schedAlarmAt();
  assert.ok(at !== null && at >= t0 + 1000 && at <= Date.now() + 1000, `armed at the sweep's wake, now + 1 s while due: ${at} (t0 ${t0})`);
});

/* monitoring R36–R43: the invariants, each driven at the module's interface. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, serve, sha, DAEMON, NOW_MS, infoMd } from "./fixture.mjs";
import { acquireRefusals } from "../acquisition/fixtures.mjs";
import { monitoringOps, MONITORING_TABLES, MONITORING_CHECKS, DRIVE_TICK_CHECKS, GATHERING_CHECKS, FREQUENCY_CHECKS, NAMED_REQUEST_CHECKS,
         WATCH_END_CHECKS, MONITOR_SET_CHECKS }
  from "../../../src/monitoring/index.mjs";
import { MECHANICAL_FIELD_SETS } from "../../../src/promotion/index.mjs";
import { ACQUISITION_CHECKS } from "../../../src/acquisition/index.mjs";
import { parseFrontmatter } from "../../../src/record-grammar/index.mjs";

const LOC = "https://records.example.org/inv.txt";
const tick = (w, id) => w.m.monitor({ bundleId: id, viewer: DAEMON, actorClass: "machine", actor: DAEMON });

test("R36 the daemon fetches only what store state authorizes: op=monitor takes a bundle id, never a caller's address; the fallback names only the document address", async () => {
  const w = world();
  const id = "INFO-2026-0800-auth";
  w.monitored(id, LOC, "auth-v1");
  w.net.routes[LOC] = serve("auth-v1");
  w.net.routes["https://attacker.example.org/x"] = serve("nope");
  const r = await monitoringOps(w.m, new URL(`http://do/monitor?viewer=${DAEMON}`),
    { bundleId: id, locator: "https://attacker.example.org/x", address: "https://attacker.example.org/x", tickAddress: "https://attacker.example.org/x" }).monitor();
  assert.equal(r.status, 200);
  assert.deepEqual(w.net.seen, [LOC], "only the document's own locator was fetched");
  /* the archive fire's body names only the document address (R20's test drives the whole tick) */
  const calls = [];
  const notEligible = await acquireRefusals({ kind: "not_eligible" });
  w.capture.acquire = async (body) => { calls.push(body); return notEligible; };
  for (let i = 0; i < 3; i++) await w.capture.recordSourceOutcome({ addressNorm: "https://gone.example.org/p", outcome: "fetch_failed", at: "2026-09-20T00:00:00Z" });
  await w.m.archiveTick(NOW_MS);
  assert.deepEqual(calls, [{ via: "archive.org", address: "https://gone.example.org/p" }]);
});

test("R37 detecting change is mechanical: a tick writes only monitor-tick's field set, never the document's hash as current, and a change raises a flag for a member", async () => {
  const w = world();
  const id = "INFO-2026-0810-mech";
  const b = w.monitored(id, LOC, "mech-v1");
  const before = w.text(id);
  const baselineEntry = JSON.parse(w.record.readFile(id, "data/provenance.json").text).documents[0];
  w.net.routes[LOC] = serve("mech-v2");
  const r = await tick(w, id);
  assert.equal(r.body.status, "modified");
  const fb = parseFrontmatter(before).data, fa = parseFrontmatter(w.text(id)).data;
  const allowed = MECHANICAL_FIELD_SETS["monitor-tick"];
  const moved = [];
  const walk = (a, z, p) => {
    for (const k of new Set([...Object.keys(a || {}), ...Object.keys(z || {})])) {
      const path = p ? `${p}.${k}` : k;
      const x = a ? a[k] : undefined, y = z ? z[k] : undefined;
      if (x && y && typeof x === "object" && typeof y === "object" && !Array.isArray(x)) walk(x, y, path);
      else if (JSON.stringify(x) !== JSON.stringify(y)) moved.push(path);
    }
  };
  walk(fb, fa, "");
  assert.ok(moved.length > 0);
  for (const m of moved) assert.ok(allowed.includes(m), `${m} is not in monitor-tick's field set (${allowed.join(", ")})`);
  /* the register still names the baseline as the document's capture, first and unchanged: the new bytes are a later copy filed beside
     it with its own entry (R79), not the current hash */
  const reg = JSON.parse(w.record.readFile(id, "data/provenance.json").text);
  assert.deepEqual(reg.documents.map((d) => d.capture.sha256), [b.cap, sha("mech-v2")]);
  assert.deepEqual(reg.documents[0], baselineEntry);
  assert.equal(fa.reeval_pending.flag, true, "a change raises a flag for a member");
  assert.equal(w.manifest(id).at(-1).writer, "mechanical");
});

test("R38 an equality that costs nothing is not evidence: a shell's match never reads unchanged; a rendered capture's content is undetermined on every tick; a plain document still reads unchanged", async () => {
  const w = world();
  const loc = "https://spa.example.org/a";
  /* a CERTAIN empty frame (site-profiles R2): a mount point, a framework state and no readable text */
  const shell = `<html><head><script src="/app.1.js"></script></head><body><div id="root"></div><script>window.__INITIAL_STATE__={}</script><!--${"x".repeat(2400)}--></body></html>`;
  w.monitored("INFO-2026-0820-shell", loc, shell);
  w.net.routes[loc] = serve(shell, "text/html");
  const s = await tick(w, "INFO-2026-0820-shell");
  assert.notEqual(s.body.status, "unchanged", "the same shell bytes never read unchanged");
  assert.equal(w.looks().at(-1).state, "LOOKED_INDETERMINATE");
  const rl = "https://app.example.org/r";
  w.monitored("INFO-2026-0821-rendered", rl, "rendered-doc", { row: { pair: { primary: "rendered", shell: { sha256: sha("<html>s</html>") } } } });
  w.net.routes[rl] = serve("<html>s</html>", "text/html");
  const rr = await tick(w, "INFO-2026-0821-rendered");
  assert.deepEqual([rr.body.status, rr.body.content, rr.body.frame], [null, "undetermined", "unchanged"]);
  /* over-strictness arm */
  w.monitored("INFO-2026-0822-plain", LOC, "plain words");
  w.net.routes[LOC] = serve("plain words");
  assert.equal((await tick(w, "INFO-2026-0822-plain")).body.status, "unchanged");
});

test("R39 a governed refusal is a fact about the instance: its look is marked governed and it never counts as the source failing", async () => {
  const w = world({ refuse: ["records.example.org"] });
  w.monitored("INFO-2026-0830-gov", LOC, "gov-v1");
  for (let i = 0; i < 4; i++) await tick(w, "INFO-2026-0830-gov");
  assert.ok(w.looks().every((l) => l.governed === 1 && l.condition === "source-unreachable-governed"));
  const reach = w.capture.sourceReachability({ addressNorm: LOC });
  assert.equal(reach.consecutive_failures ?? 0, 0);
  assert.equal(reach.fallback_eligible, false);
});

test("R40 bias never shapes what is monitored: no service takes a lens, and a lens passed changes no plan", () => {
  const w = world();
  w.monitored("INFO-2026-0840-a", "https://records.example.org/l1", "lens a", { freq: "daily" });
  w.monitored("INFO-2026-0841-b", "https://records.example.org/l2", "lens b", { freq: "per_meeting" });
  const plain = JSON.stringify(w.m.schedule(NOW_MS));
  assert.equal(JSON.stringify(w.m.schedule(NOW_MS, { lens: "LENS-1" })), plain);
  const a = JSON.stringify(w.m.monitoring({ viewer: DAEMON, now: NOW_MS }));
  assert.equal(JSON.stringify(w.m.monitoring({ viewer: DAEMON, now: NOW_MS, lens: "LENS-1" })), a);
  const routed = monitoringOps(w.m, new URL(`http://do/monitoring?viewer=${DAEMON}&now=${NOW_MS}&lens=LENS-1`), { lens: "x" }).monitoring();
  assert.equal(JSON.stringify(routed), a);
});

test("R41 the tables are this module's and declared to purge: monitor_fired by subject; R28's monitor_gathering_run by the bundle carrying the request; monitor_address_type, monitor_tick_epoch, R52's monitor_address_frequency and R71's monitor_address_end only by a whole-store purge; the link sweep's left with it (N506)", async () => {
  const w = world();
  assert.deepEqual(MONITORING_TABLES.map((t) => [t.name, t.keys]),
    [["monitor_fired", ["subject"]], ["monitor_tick_epoch", []], ["monitor_address_type", []], ["monitor_address_frequency", []],
     ["monitor_address_end", []], ["monitor_address_look", []], ["monitor_gathering_run", ["bundle_id"]]]);
  /* the link sweep's tables are link-sweep's (N506): this module neither creates nor declares them */
  assert.deepEqual(w.rows(`SELECT name FROM sqlite_master WHERE type='table' AND name IN ('sweep_runs', 'sweep_filed')`), []);
  const id = "INFO-2026-0850-purge";
  w.monitored(id, LOC, "purge-v1", { freq: "hourly", lines: ["project: PROJ-2026-0850-p"] });
  w.inProject("PROJ-2026-0850-p");
  w.net.routes[LOC] = serve("purge-v1");
  await tick(w, id);                /* reads the address's type */
  assert.equal(w.m.addressFrequencySet({ address: LOC, frequency: "daily", reason: "source_changes_rarely", author: "carol",
                                         viewer: "member:carol" }).ok, true);   /* an address's own frequency (R52) */
  assert.equal(w.m.addressWatchEnd({ address: LOC, until: "2099-01-01", by: "carol", viewer: "member:carol" }).ok, true);   /* its end (R71) */
  /* a named request of another bundle, attempted once (R28) */
  const gid = "INFO-2026-0851-gath";
  const g = JSON.stringify({ requests: [{ id: "GATH-2026-0851-x", target: { text: "x" }, locators: ["https://records.example.org/g"],
                                          authority: "Town Clerk", criticality: "crucial", status: "open" }] });
  assert.equal(w.promote(gid, infoMd(gid, "https://records.example.org/h", { enabled: false }),
    { files: [{ path: "data/gathering.json", text: g, bytes: Buffer.byteLength(g), sha256: sha(g) }] }).ok, true);
  const refused = await acquireRefusals({ kind: "source_refused" });
  w.capture.acquire = async () => refused;
  const real = w.m.monitor;
  w.m.monitor = async () => { throw new Error("down"); };
  await w.m.cadenceTick(NOW_MS + 2 * 86400000);   /* fails: its claim and epoch stay; the request is attempted */
  w.m.monitor = real;
  const count = (t) => w.rows(`SELECT count(*) c FROM ${t}`)[0].c;
  const all = () => ["monitor_fired", "monitor_tick_epoch", "monitor_address_type", "monitor_address_frequency", "monitor_address_end", "monitor_gathering_run"].map(count);
  assert.deepEqual(all(), [2, 1, 1, 1, 1, 1]);
  w.record.purge({ bundleId: id });
  assert.deepEqual(all(), [1, 1, 1, 1, 1, 1], "the bundle's claims go; the epoch, the address's reading and its settings outlive it");
  w.record.purge({ bundleId: gid });
  assert.deepEqual(all(), [1, 1, 1, 1, 1, 0], "the request's attempts go with the bundle carrying it; its claim is the tick's, spent with the epoch");
  w.record.purge({});
  assert.deepEqual(all(), [0, 0, 0, 0, 0, 0]);
});

test("R42 this module's own table holds C-48.8 and C-48.9, each with its code, number, translation and a where naming this module's site; the rest of C-48 is acquisition's; C-18.10 is the gathering refusal's row; C-18.11 to C-18.15 are R52's; C-18.19 is R71's WATCH_END_REFUSED; C-18.20 and C-18.21 are R74's; C-18.22 and C-18.23 are R75's; C-18.16 to C-18.18 left with the link sweep, whose grammar and fence mint them (N506, K1206)", () => {
  assert.deepEqual(Object.keys(MONITORING_CHECKS).sort(),
    ["BAD_FREQUENCY", "DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL", "DRIVE_TICK_EXPORT_IS_THE_SHELL", "FREQUENCY_NO_REASON",
     "GATHERING_REFUSED", "MACHINE_CANNOT_SET_FREQUENCY", "MACHINE_CANNOT_SET_MONITORING", "MACHINE_CANNOT_SET_REQUEST",
     "MONITOR_SET_REFUSED", "NAMED_REQUEST_REFUSED", "NOT_A_SOURCE_OWNER", "NO_SUCH_ADDRESS", "WATCH_END_REFUSED"]);
  assert.deepEqual(Object.fromEntries(Object.entries(MONITORING_CHECKS).map(([k, r]) => [k, [r.check, r.where]])), {
    DRIVE_TICK_EXPORT_IS_THE_SHELL: ["C-48.8", "src/monitoring/index.mjs monitor > is-drive-tick-export"],
    DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL: ["C-48.9", "src/monitoring/index.mjs monitor > is-drive-tick-bytes"],
    GATHERING_REFUSED: ["C-18.10", "src/monitoring/index.mjs gatheringCheck > is-gathering-refused"],
    MACHINE_CANNOT_SET_FREQUENCY: ["C-18.11", "src/monitoring/index.mjs addressFrequencySet > is-frequency-member"],
    NO_SUCH_ADDRESS: ["C-18.12", "src/monitoring/index.mjs addressFrequencySet > is-frequency-address"],
    BAD_FREQUENCY: ["C-18.13", "src/monitoring/index.mjs addressFrequencySet > is-frequency-word"],
    NOT_A_SOURCE_OWNER: ["C-18.14", "src/monitoring/index.mjs addressFrequencySet > is-frequency-owner"],
    FREQUENCY_NO_REASON: ["C-18.15", "src/monitoring/index.mjs addressFrequencySet > is-frequency-reason"],
    WATCH_END_REFUSED: ["C-18.19", "src/monitoring/index.mjs addressWatchEnd > is-watch-end-day"],
    MACHINE_CANNOT_SET_MONITORING: ["C-18.20", "src/monitoring/index.mjs monitorSet > is-monitor-set-member"],
    MONITOR_SET_REFUSED: ["C-18.21", "src/monitoring/index.mjs monitorSet > is-monitor-set-shape"],
    MACHINE_CANNOT_SET_REQUEST: ["C-18.22", "src/monitoring/named-requests.mjs namedRequestSet > is-named-request-member"],
    NAMED_REQUEST_REFUSED: ["C-18.23", "src/monitoring/named-requests.mjs namedRequestSet > is-named-request-shape"],
  });
  for (const r of Object.values(MONITORING_CHECKS)) {
    assert.equal(typeof r.translation, "string");
    assert.ok(r.translation.length > 40, "a canned sentence (DEC-49)");
    assert.ok(Object.isFrozen(r));
  }
  assert.deepEqual(MONITORING_CHECKS, { ...DRIVE_TICK_CHECKS, ...GATHERING_CHECKS, ...FREQUENCY_CHECKS, ...WATCH_END_CHECKS,
                                        ...MONITOR_SET_CHECKS, ...NAMED_REQUEST_CHECKS });
  /* no code is held twice: none of this module's rows is acquisition's, and no C-48 row of acquisition's is this module's */
  for (const code of Object.keys(MONITORING_CHECKS)) assert.equal(code in ACQUISITION_CHECKS, false, code);
  assert.deepEqual(Object.values(ACQUISITION_CHECKS).map((r) => r.check).filter((c) => c === "C-48.8" || c === "C-48.9"), []);
});

test("R42 each check moved here holds as an invariant: C-18.5 (gathering.test), C-48.8 and C-48.9 answered with this module's rows", async () => {
  const w = world();
  const DOC = "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/edit";
  const EXPORT = "https://docs.google.com/document/d/1AbCdEfGhIjKlMnOpQrStUvWxYz0123456789abcd/export?format=odt";
  w.monitored("INFO-2026-0860-drive", DOC, "odt-42", { row: { locator: EXPORT } });
  w.net.routes[EXPORT] = serve("<html></html>", "application/xhtml+xml");
  const a = await tick(w, "INFO-2026-0860-drive");
  assert.deepEqual([a.body.reason, a.body.check, a.body.translation],
    ["DRIVE_TICK_EXPORT_IS_THE_SHELL", "C-48.8", DRIVE_TICK_CHECKS.DRIVE_TICK_EXPORT_IS_THE_SHELL.translation]);
  w.net.routes[EXPORT] = serve("<html><body>app</body></html>", "application/octet-stream");
  const b = await tick(w, "INFO-2026-0860-drive");
  assert.deepEqual([b.body.reason, b.body.check, b.body.translation],
    ["DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL", "C-48.9", DRIVE_TICK_CHECKS.DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL.translation]);
  /* negative control: the real export is compared, not refused */
  w.net.routes[EXPORT] = serve("odt-42", "application/vnd.oasis.opendocument.text");
  assert.equal((await tick(w, "INFO-2026-0860-drive")).body.ok, true);
});

test("R43 no place is named in this module's behaviour or outward text", async () => {
  const w = world();
  const outward = [];
  const keep = (r) => outward.push(JSON.stringify(r));
  w.monitored("INFO-2026-0870-a", LOC, "place-v1", { freq: "daily" });
  for (const [route, status] of [[serve("place-v1"), 200], [serve("place-v2"), 200], [serve("x", "text/plain", 404), 404],
                                 [serve("x", "text/plain", 503), 503]]) {
    w.net.routes[LOC] = route;
    keep((await tick(w, "INFO-2026-0870-a")).body);
    assert.ok(status);
  }
  w.promote("INFO-2026-0871-http", infoMd("INFO-2026-0871-http", "http://x.example.org/"));
  keep(await tick(w, "INFO-2026-0871-http"));
  keep(w.m.schedule(NOW_MS));
  keep(w.m.monitoring({ viewer: DAEMON, now: NOW_MS }));
  keep(w.m.driveShells({ viewer: DAEMON }));
  keep(await w.m.cadenceTick(NOW_MS));
  keep(w.text("INFO-2026-0870-a"));
  keep(w.looks());
  const text = outward.join("\n");
  for (const place of ["Oakland", "Alameda", "California", "Port Ellery", "Believe in Oakland"])
    assert.equal(text.includes(place), false, place);
});

/* instance-setup's exports the installer imports (N234, installer R30), and R17's member reads, at the interface. */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { GROUP_SLUG_RE, FLEET_BINDINGS, memberVersions } from "../../../src/setup.mjs";
import * as leaf from "../../../src/setup-fleet.mjs";

test("N234 (K405, R98): the installer's names come from a leaf whose only import is setup-words, and setup.mjs re-exports the same values; R47's block is held there too", async () => {
  /* The leaf's import is setup-words (R98), which the installer already carries: loaded as the module it is, not as a data: module. */
  const alone = await import("../../../src/setup-fleet.mjs");
  assert.deepEqual(Object.keys(alone).sort(), ["FLEET_BINDINGS", "FORGOT_HELP", "GROUP_SLUG_RE", "HOSTING_CONTROL", "HOSTING_RECOVERY_DEPLOYER", "HOSTING_RECOVERY_DEPLOYER_KEY", "hostingControlBlock"]);
  assert.deepEqual(alone.HOSTING_CONTROL, leaf.HOSTING_CONTROL);
  assert.equal(alone.hostingControlBlock("notice"), leaf.hostingControlBlock("notice"));
  assert.equal(alone.hostingControlBlock("notice", { guideHref: "#g" }), leaf.hostingControlBlock("notice", { guideHref: "#g" }));
  assert.ok(alone.GROUP_SLUG_RE instanceof RegExp);
  assert.equal(alone.GROUP_SLUG_RE.source, GROUP_SLUG_RE.source);
  assert.deepEqual(alone.FLEET_BINDINGS, FLEET_BINDINGS);
  assert.equal(leaf.GROUP_SLUG_RE, GROUP_SLUG_RE);
  assert.equal(leaf.FLEET_BINDINGS, FLEET_BINDINGS);
});

test("the slug grammar: 3 to 40 of a-z, 0-9 and '-', beginning and ending with a letter or digit (Terms; R2, R4)", () => {
  for (const ok of ["abc", "a-b", "oakland-group", "0ab", "a".repeat(40), "a1-2-3z"]) assert.ok(GROUP_SLUG_RE.test(ok), ok);
  for (const bad of ["", "ab", "a".repeat(41), "-ab", "ab-", "Abc", "a_b", "a b", "ab\n", "é-ab", "abc.d"])
    assert.ok(!GROUP_SLUG_RE.test(bad), JSON.stringify(bad));
});

test("R17 the fleet's member binding names: one pair per member, each name a binding the plane reads; T36 (K2152) adds file-scanner as FILE_SCANNER", () => {
  assert.deepEqual(FLEET_BINDINGS, [["agent-worker", "AGENT_WORKER"], ["pdf-worker", "PDF_WORKER"], ["ocr-worker", "OCR_WORKER"],
    ["sheet-worker", "SHEET_WORKER"], ["agent-runner", "AGENT_RUNNER"], ["file-scanner", "FILE_SCANNER"]]);
  /* one pair per member and one member per binding */
  assert.equal(new Set(FLEET_BINDINGS.map(([m]) => m)).size, FLEET_BINDINGS.length);
  assert.equal(new Set(FLEET_BINDINGS.map(([, b]) => b)).size, FLEET_BINDINGS.length);
});

const answering = (body, status = 200) => ({ fetch: async () => new Response(JSON.stringify(body), { status }) });

test("R17 members=1: each member's own /version through its binding: SERVING, UNBOUND, SILENT, MISNAMED", async () => {
  const seen = [];
  const env = {
    AGENT_WORKER: { fetch: async (url, init) => { seen.push([url, init.method]); return new Response(JSON.stringify({ name: "agent-worker", version: "1.2.3" })); } },
    PDF_WORKER: answering({ name: "ocr-worker", version: "9.9.9" }),
    // OCR_WORKER unbound
    VERSION: "plane-build",
  };
  const out = await memberVersions(env);
  assert.deepEqual(seen, [["https://agent-worker/version", "GET"]]);
  assert.deepEqual(out["agent-worker"], { binding: "AGENT_WORKER", state: "SERVING", version: "1.2.3" });
  assert.deepEqual(out["pdf-worker"], { binding: "PDF_WORKER", state: "MISNAMED", name: "ocr-worker", version: "9.9.9" });
  assert.deepEqual(out["ocr-worker"], { binding: "OCR_WORKER", state: "UNBOUND" });
  const silent = await memberVersions({
    AGENT_WORKER: answering({ name: "agent-worker" }),              // no version
    PDF_WORKER: answering({ name: "pdf-worker", version: "1" }, 500), // not ok
    OCR_WORKER: { fetch: async () => { throw new Error("connection refused"); } },
  });
  for (const m of ["agent-worker", "pdf-worker", "ocr-worker"]) assert.equal(silent[m].state, "SILENT", m);
  assert.match(silent["ocr-worker"].why, /connection refused/);
  /* (T36, K2152) the scanner is read through FILE_SCANNER like every other member, under its own name */
  const scan = await memberVersions({ FILE_SCANNER: answering({ ok: true, name: "file-scanner", version: "0.1.0" }) });
  assert.deepEqual(scan["file-scanner"], { binding: "FILE_SCANNER", state: "SERVING", version: "0.1.0" });
  assert.deepEqual((await memberVersions({}))["file-scanner"], { binding: "FILE_SCANNER", state: "UNBOUND" });
  assert.equal((await memberVersions({ FILE_SCANNER: answering({ name: "pdf-worker", version: "1" }) }))["file-scanner"].state, "MISNAMED");
});

test("R17 members=1: a member that does not answer within 4 seconds reads SILENT", { timeout: 10000 }, async () => {
  const t0 = Date.now();
  const out = await memberVersions({ AGENT_WORKER: { fetch: () => new Promise(() => {}) } });
  const took = Date.now() - t0;
  assert.equal(out["agent-worker"].state, "SILENT");
  assert.match(out["agent-worker"].why, /within 4000 ms/);
  assert.ok(took >= 3900 && took < 6000, `took ${took} ms`);
});

test("N348 this module holds no Durable Object door or class of its own: its routes are the map control-plane joins to its frame (control-plane R35)", async () => {
  const S = await import("../../../src/setup.mjs");
  assert.equal("instanceSetupRoute" in S, false);
  assert.equal("instanceSetupStore" in S, false);
  assert.equal(typeof S.instanceSetupOps, "function");
  const ops = S.instanceSetupOps(null, new URL("http://do/"), null);
  assert.deepEqual(Object.keys(ops).sort(), ["adminrecoverystep", "assistantreadiness", "assistantstate", "cpuprobeend", "cpuprobestart", "cpuprobestate", "disclosureof",
    "disclosureshown", "groupdomainset", "groupidentity", "groupidentitypublic",
    "groupnameset", "instancegroup", "instancegrouppublic", "instancegroupseed", "layersset", "maildomainset", "maildoorset", "mailsetup", "memberlanguage",
    "memberlanguageset", "officesseed", "placewanted", "placewantedstate", "profiles", "profilesset",
    "recordcpuprobestep", "runtimeobservations", "seatsseed",
    /* T45 (R77): the administrators' act setting the group's declared stake */
    "declaredstakeset",
    /* T46 (R79): a member's own explanation level */
    "infolevelset", "infolevel",
    /* T47 (R84, R85): the group's logo and languages, and the logo read control-plane serves */
    "grouplogoset", "grouplogo", "grouplanguagesset", "grouplanguages",
    /* T48 (R89, R90): the update notice and the administrators' three choices */
    "updatenotice", "updatestart", "updatelater", "updateskip",
    /* T51 (R95): the seven facts `op=bootstrap` states to a credentialed caller, a store-internal route */
    "bootstrapfacts",
    /* T51 (R105, K5170): the migrations' counts `op=selftest` states to an administrator, a store-internal route */
    "selftestmigrations"].sort());
  for (const f of Object.values(ops)) assert.equal(typeof f, "function");
});

/* store-request R1–R14, R23, R24: `innerRequest`, at its interface. Every caller is admission's own answer (`admit` over a world's
   store, `admittedAs`): the founder's session, a member's, an organisation's `ai` credential and the three binding classes. The
   expected stamps are the requirements' expressions (M, T, I, A, AI, P, N, V) computed from the caller, never read from the code. */
import "../../sandbox.mjs";
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { storeWorld, WORLD_TOKENS } from "./fixtures.mjs";
import { innerRequest, QUERY_STAMPS, BODY_STAMPS, BODY_ONLY, BODY_DROPPED, SESSION_MEMBER_BODY_OPS, ACT_CLOCK_OPS,
         MEMBERSHIP_ADMIN_ACTS, WIZARD_AUTHOR_ACTIONS, WIZARD_PROPOSAL_ACTIONS, WIZARD_VIEWER_OPS, CASE_IMPORT_ACTIONS,
         CASE_IMPORT_READS, BODY_ACTOR, VIEWER_STAMPED_OPS, promotedTypeOf } from "../../../src/store-request/index.mjs";
import * as OD from "../../../src/op-declarations/index.mjs";
import { callerViewer } from "../../../src/admission/index.mjs";
import { createSha256 } from "../../../src/record-grammar/index.mjs";
import { readFileSync } from "node:fs";

const { OPS, OP_STAMPS } = OD;
let C = {};          /* caller kind → admission's caller */
before(async () => {
  const w = await storeWorld();
  const founder = await w.signIn("admin");
  const ruth = await w.signIn("ruth", { capabilities: ["contribute"] });
  const minted = await w.door({ url: "/api/?op=aicredentialmint", init: { method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ tokenId: "bot1", principalKind: "organisation", writes: [] }) } }, founder);
  C = { founder: await w.admitted(founder.token), member: await w.admitted(ruth.token), ai: await w.admitted(minted.json.result.token),
        admin: await w.admitted(WORLD_TOKENS.ADMIN_TOKEN), probe: await w.admitted(WORLD_TOKENS.PROBE_TOKEN),
        daemon: await w.admitted(WORLD_TOKENS.DAEMON_TOKEN, "monitor") };
});
const KINDS = () => Object.entries(C);

/* the requirements' expressions */
const ex = (c) => {
  const s = c.viaSession, ai = c.cls === "ai", cl = `class:${c.cls}`;
  return { M: s ? c.member : cl, T: s ? c.member : `token:${c.cls}`, I: s ? c.identity : cl,
           A: s ? c.member : ai ? `class:ai/${c.aiCred.tokenId}` : cl, AI: s ? c.identity : ai ? `class:ai/${c.aiCred.tokenId}` : cl,
           P: s ? c.identity : ai ? `${c.aiCred.principal}/${c.aiCred.tokenId}` : cl, N: s ? c.identity : ai ? c.aiCred.principal : cl,
           V: s ? c.viewer : ai ? callerViewer(c, { carry: false }) : cl,
           actor: s ? c.viewer : ai ? `class:ai/${c.aiCred.tokenId}` : cl };
};
const FORGED = "FORGED";
const forgedQuery = (op, extra = {}) => `http://h/api/?${new URLSearchParams({ op, token: "t", ...Object.fromEntries(
  [...QUERY_STAMPS, "secretSha", "bySecret", "session", "grant", "declared", "proposer", "principal", "owner", "member", "proposedBy",
   "mintedBy", "attestor", "transcriber", "looker", "sharer", "declarer", "placer", "capacity", "cls", "caps", "store", "defer",
   "resolve", "address"].map((k) => [k, FORGED])), ...extra })}`;
const forgedBody = (extra = {}) => JSON.stringify({ ...Object.fromEntries([...BODY_STAMPS, "token", "secretSha", "bySecret", "by",
  "viewer", "session", "author", "proposer", "memberId", "declaredBy", "withdrawnBy", "resolvedBy", "threadedBy", "decidedBy",
  "assertedBy", "actor"].map((k) => [k, FORGED])), ...extra });
const make = (op, c, o = {}) => innerRequest({ op, url: o.url ?? forgedQuery(op), method: o.method ?? "POST", body: "body" in o ? o.body : forgedBody(),
                                                caller: c, ...o.args });
const Q = (r) => new URL(r.url).searchParams;
const B = (r) => (typeof r.body === "string" ? JSON.parse(r.body) : r.body);
const declares = (op, k) => (OP_STAMPS[op] || []).includes(k);
const firstOf = (fam, not = []) => fam.find((o) => !not.includes(o));

test("R1, R14: for every op OPS declares and each kind of caller the answer is made, synchronously, the same for the same arguments, and no forged stamp survives in the address or the body", () => {
  const ops = Object.keys(OPS);
  assert.ok(ops.length > 900);
  for (const [kind, c] of KINDS()) for (const op of ops) {
    const a = make(op, c, { args: { mint: { writes: [], confinedTo: null, secretSha: "d".repeat(64) } } });
    assert.equal(typeof a.then, "undefined", op);
    if (a.refusal) { assert.equal(op, "promote"); continue; }
    assert.deepEqual(make(op, c, { args: { mint: { writes: [], confinedTo: null, secretSha: "d".repeat(64) } } }), a, `${op} deterministic`);
    assert.match(a.url, /^http:\/\/x\//, op);
    for (const k of [...QUERY_STAMPS, "secretSha", "bySecret", "session", "grant", "declared"])
      assert.notEqual(Q(a).get(k), FORGED, `${kind} ${op} address ${k}`);
    assert.equal(Q(a).has("token"), false, op); assert.equal(Q(a).has("op"), false, op);
    const b = a.body === undefined ? null : JSON.parse(a.body);
    if (b && typeof b === "object") for (const k of [...BODY_STAMPS, "token", "secretSha", "bySecret"]) assert.notEqual(b[k], FORGED, `${kind} ${op} body ${k}`);
  }
});

test("R1: a body that is not JSON text of an object passes as it came; bytes and streams pass untouched; an absent body stays absent; never throws", () => {
  const c = C.member;
  for (const body of ["not json", "[1, 2]", "5", "null"]) assert.equal(innerRequest({ op: "resolve", url: "http://h/?op=resolve", method: "POST", body, caller: c }).body, body);
  const bytes = new Uint8Array([1, 2, 3]);
  assert.equal(innerRequest({ op: "captureupload", url: "http://h/?op=captureupload", method: "POST", body: bytes, caller: c }).body, bytes);
  assert.equal("body" in innerRequest({ op: "search", url: "http://h/?op=search", method: "GET", caller: c }), false);
  assert.doesNotThrow(() => innerRequest({}));
  assert.doesNotThrow(() => innerRequest({ op: "search", url: "not a url", caller: c }));
});

test("R2: the store route is the op's own name but inbox, publish, inboxpull; the address keeps the page's other parameters", () => {
  const c = C.member;
  for (const [op, route] of [["inbox", "inboxlist"], ["publish", "publishcase"], ["inboxpull", "inboxpullfile"], ["search", "search"], ["allocid", "allocid"]]) {
    const a = innerRequest({ op, url: `http://h/api/?op=${op}&q=water&limit=3&token=t`, caller: c });
    assert.equal(new URL(a.url).pathname, `/${route}`);
    assert.equal(Q(a).get("q"), "water"); assert.equal(Q(a).get("limit"), "3");
  }
});

test("R3: the caller's stamps, the body-only fields, an act's own clock and opencaptures' instants leave the address; another op's date stays", () => {
  for (const [kind, c] of KINDS()) {
    const a = innerRequest({ op: "allocid", url: forgedQuery("allocid"), caller: c });
    for (const k of [...QUERY_STAMPS, "secretSha", "bySecret", "session", "grant", "declared"]) assert.equal(Q(a).has(k), false, `${kind} ${k}`);
    for (const [op, keys] of Object.entries(BODY_ONLY)) {
      const r = innerRequest({ op, url: `http://h/?op=${op}&${keys.map((k) => `${k}=x`).join("&")}&keep=1`, caller: c });
      for (const k of keys) assert.equal(Q(r).has(k), false, `${op} ${k}`);
      assert.equal(Q(r).get("keep"), "1");
    }
    for (const op of ACT_CLOCK_OPS) assert.equal(Q(innerRequest({ op, url: `http://h/?op=${op}&at=2020-01-01`, caller: c })).has("at"), false, op);
    const oc = innerRequest({ op: "opencaptures", url: "http://h/?op=opencaptures&at=1&now=2", caller: c });
    assert.equal(Q(oc).has("at"), false); assert.equal(Q(oc).has("now"), false);
    for (const op of ["reminderset", "calibrate", "filingrecordsent"])
      assert.equal(Q(innerRequest({ op, url: `http://h/?op=${op}&at=2026-11-01`, caller: c })).get("at"), "2026-11-01", op);
  }
});

test("R4: each declared stamp is set from the admitted caller, and a stamp the op does not declare is never present", () => {
  const plain = Object.keys(OPS).filter((op) => !VIEWER_STAMPED_OPS.includes(op));
  for (const [kind, c] of KINDS()) {
    const e = ex(c);
    const byDecl = (k) => plain.find((op) => declares(op, k) && (OP_STAMPS[op] || []).length === 1);
    const v = byDecl("viewer"); if (v) assert.equal(Q(make(v, c)).get("viewer"), e.V, `${kind} viewer ${v}`);
    const b = plain.find((op) => declares(op, "by") && !MEMBERSHIP_ADMIN_ACTS.includes(op) && !OD.PROJECT_ACTIONS.includes(op)
      && !OD.GOVERNANCE_ACTIONS.includes(op) && !OD.IDENTITY_ACTIONS.includes(op) && !OD.CUSTODIAL_ACTIONS.includes(op)
      && !OD.ROSTER_SELF_ACTIONS.includes(op) && !OD.OWN_KEY_ACTIONS.includes(op) && !OD.CAPTURE_MEMBER_ACTIONS.includes(op)
      && !OD.SOURCE_ACTIONS.includes(op) && !CASE_IMPORT_ACTIONS.includes(op) && !OD.NETWORK_NOTICES_BY.includes(op)
      && !OD.DOCKET_BY.includes(op) && !["projectparticipants", "projectownerarith", "projectrequests", "profilesset", "handlechange",
      "captureupload", "attribute"].includes(op));
    if (b) assert.equal(Q(make(b, c)).get("by"), e.actor, `${kind} by ${b}`);
    const m = plain.find((op) => declares(op, "member") && !OD.QUEUE_ACTIONS.includes(op) && op !== "unpack");
    if (m) assert.equal(Q(make(m, c)).get("member"), c.viaSession ? c.viewer : null, `${kind} member ${m}`);
    const s = plain.find((op) => declares(op, "source"));
    if (s) {
      const r = make(s, c, { args: { source: "src-digest", country: "NL" } });
      assert.equal(Q(r).get("source"), "src-digest");
      if (declares(s, "country")) assert.equal(Q(r).get("country"), "NL");
      assert.equal(Q(make(s, c)).has("source"), false, "a stamp whose value is none is not set");
    }
    const none = plain.find((op) => !(OP_STAMPS[op] || []).length && !OD.QUEUE_ACTIONS.includes(op));
    const r0 = make(none, c);
    for (const k of [...QUERY_STAMPS, "session"]) assert.equal(Q(r0).has(k), false, `${none} ${k}`);
  }
});

test("R5: a stamped session and an ai caller's grant travel in headers, never the address", () => {
  const op = Object.keys(OPS).find((o) => declares(o, "session"));
  assert.ok(op);
  const s = make(op, C.member);
  assert.equal(s.headers["x-bio-session"], C.member.token);
  assert.equal(Q(s).has("session"), false);
  for (const k of ["admin", "probe", "ai"]) assert.equal(make(op, C[k]).headers["x-bio-session"], undefined, k);
  const granted = { ...C.ai, aiCred: { ...C.ai.aiCred, grant: "grant-token" } };
  const g = make("search", granted);
  assert.equal(g.headers["x-bio-grant"], "grant-token");
  assert.equal(Q(g).has("grant"), false);
  assert.deepEqual(make("search", C.member).headers, {});
});

test("R6: a read is stamped with its caller's sight: one op of each family and of the named set, for each kind of caller; a caller's viewer is gone", () => {
  const fams = ["EDGE_ACTIONS", "STATE_ACTIONS", "ACTION_ACTIONS", "STRUCTURE_ACTIONS", "VERSION_ACTIONS", "QUEUE_ACTIONS", "INTENT_ACTIONS",
    "INTENT_READS", "REEVALUATION_ACTIONS", "PROJECT_ACTIONS", "ACTION_LAYER_ACTIONS", "ACTION_LAYER_READS", "CONTRADICTION_ACTIONS",
    "CONTRADICTION_READS", "SOURCE_READS", "CAPTURE_VIEWER_ACTIONS", "CAPTURE_READS", "WHAT_CHANGED_PROPOSAL_ACTIONS", "WHAT_CHANGED_READS",
    "NETWORK_NOTICES_ACTIONS", "NETWORK_NOTICES_READS", "DOCKET_ACTIONS", "DOCKET_READS", "RUN_VERB_ACTIONS"];
  const sample = [...fams.map((f) => OD[f][0]), CASE_IMPORT_ACTIONS[0], CASE_IMPORT_READS[0], WIZARD_VIEWER_OPS[0], "search", "list", "memberlist",
                  "projectstage", "content", "airuns", "dangling", "stats"];
  for (const [kind, c] of KINDS()) for (const op of sample) assert.equal(Q(make(op, c)).get("viewer"), ex(c).V, `${kind} ${op}`);
  assert.equal(Q(make("allocid", C.member)).has("viewer"), false);
});

test("R7: who acted, one op of each row, for each kind of caller; the caller's value of each key is gone", () => {
  const rows = [["by", "M", "projectinvite"], ["by", "M", OD.GOVERNANCE_ACTIONS[0]], ["by", "M", OD.CUSTODIAL_ACTIONS[0]], ["by", "M", "profilesset"],
    ["by", "M", MEMBERSHIP_ADMIN_ACTS[0]], ["by", "M", "handlechange"], ["by", "M", "captureupload"], ["by", "M", OD.ROSTER_SELF_ACTIONS[0]],
    ["by", "M", OD.OWN_KEY_ACTIONS[0]], ["by", "M", firstOf(OD.CAPTURE_MEMBER_ACTIONS, ["inboxpull"])], ["by", "M", OD.SOURCE_ACTIONS[0]], ["by", "M", "attribute"],
    ["by", "M", OD.IDENTITY_ACTIONS[0]], ["by", "I", OD.NETWORK_NOTICES_BY[0]], ["by", "I", firstOf(OD.DOCKET_BY, OD.DOCKET_AUTHOR)], ["by", "I", CASE_IMPORT_ACTIONS[0]],
    ["author", "T", "biasadopt"], ["author", "T", "connectionassert"], ["author", "T", "projectbarset"], ["author", "T", "publishtensions"],
    ["author", "T", OD.REEVALUATION_ACTIONS[0]], ["author", "T", "instancegroupseed"], ["author", "T", "casedraft"], ["author", "T", "reviewrevoke"],
    ["author", "T", OD.EDGE_ACTIONS[0]], ["author", "T", firstOf(OD.DECLARATION_ACTIONS, OD.QUERY_AUTHOR_ACTIONS)], ["author", "T", "narrow"],
    ["author", "M", "testify"], ["author", "M", "lead"], ["author", "I", OD.DOCKET_AUTHOR[0]], ["author", "I", WIZARD_AUTHOR_ACTIONS[0]],
    ["author", "A", WIZARD_PROPOSAL_ACTIONS[0]], ["author", "AI", OD.QUERY_AUTHOR_ACTIONS[0]], ["author", "AI", OD.CONTRADICTION_ACTIONS[0]],
    ["proposer", "A", "themepropose"], ["proposer", "A", "actionlawspropose"], ["proposer", "A", "actionriskpropose"],
    ["proposer", "A", OD.PLAN_PROPOSAL_ACTIONS[0]], ["principal", "P", OD.PLAN_PROPOSAL_ACTIONS[0]],
    ["proposer", "A", OD.TEMPLATE_PROPOSAL_ACTIONS[0]], ["author", "A", OD.TEMPLATE_PROPOSAL_ACTIONS[0]],
    ["proposedBy", "A", "extractpropose"], ["proposedBy", "A", "contradictionrecommend"], ["proposedBy", "A", OD.WHAT_CHANGED_PROPOSAL_ACTIONS[0]],
    ["author", "A", OD.WHAT_CHANGED_PROPOSAL_ACTIONS[0]], ["mintedBy", "A", "contentmint"], ["principal", "P", OD.RUN_VERB_ACTIONS[0]],
    ["principal", "P", "suggest"], ["principal", "P", "capturerequestretry"], ["attestor", "M", "attesttext"], ["attestor", "M", "transcriptionattest"],
    ["transcriber", "M", "transcribe"], ["looker", "M", "leadlook"], ["sharer", "M", "leadshare"], ["declarer", "M", "themedeclare"],
    ["placer", "M", "themeplace"], ["actor", "M", "themewithdraw"], ["actor", "M", "monitorpause"], ["actor", "T", "lease"],
    ["who", "T", "aicredentialrevoke"], ["who", "T", "aicredentialmint"], ["owner", "I", "select"], ["owner", "I", "selectionrelease"],
    ["owner", "I", OD.STATE_ACTIONS[0]], ["identity", "N", "leadread"], ["identity", "N", "frontier"], ["identity", "N", OD.POSITIONAL_ACTS[0]],
    ["identity", "N", "calibrate"], ["identity", "I", "inboxpull"]];
  for (const [kind, c] of KINDS()) {
    const e = ex(c);
    for (const [key, x, op] of rows) {
      assert.ok(op, `${key} ${x}`);
      const r = make(op, c, { args: { mint: { writes: [], confinedTo: null, secretSha: "e".repeat(64) } } });
      assert.equal(Q(r).get(key), e[x], `${kind} ${op} ${key}=${x}`);
    }
    assert.equal(Q(make(OD.IDENTITY_ACTIONS[0], c, { args: { origin: "https://group.example" } })).get("origin"), "https://group.example");
    assert.equal(Q(make(OD.RUN_VERB_ACTIONS[0], c)).get("actor"), c.viaSession ? c.member : "");
    assert.equal(Q(make(OD.QUEUE_ACTIONS[0], c)).get("member"), c.viaSession ? c.member : "");
  }
});

test("R8: the facts the door states, per op", () => {
  for (const [kind, c] of KINDS()) {
    const e = ex(c), s = c.viaSession;
    const u = make("unpack", c);
    assert.equal(Q(u).get("cls"), s ? "member" : c.cls); assert.equal(Q(u).get("member"), s ? "1" : "0");
    for (const op of ["pagetranscribe", "pdfstructure"]) {
      const r = make(op, c);
      assert.equal(Q(r).get("cls"), c.cls); assert.equal(Q(r).get("session"), s ? "1" : "0");
      assert.equal(Q(r).get("caps"), [...(c.caps || [])].join(",")); assert.equal(Q(r).get("viewer"), e.V);
      assert.equal(Q(r).get("author"), s ? c.member : e.actor); assert.equal(Q(r).get("store"), c.storeName);
    }
    const adm = (s ? !!c.rights.administer : c.cls === "admin") ? "1" : "0";
    assert.equal(Q(make("stats", c)).get("capacity"), c.cls === "admin" || (s && c.rights.administer) ? "1" : "0", kind);
    for (const op of ["memberlist", "memberpairings", "themedeclare", "themeplace", "themepropose", "themeread", "themewithdraw"])
      assert.equal(Q(make(op, c)).get("administer"), adm, `${kind} ${op}`);
    assert.equal(Q(make("versionchain", c, { url: "http://h/?op=versionchain&address=HTTPS://Example.ORG/a/" })).get("address"),
                 Q(make("versionchain", C.member, { url: "http://h/?op=versionchain&address=https://example.org/a/" })).get("address"));
    const pf = make("publishpreflight", c);
    if (c.cls === "ai") assert.deepEqual(JSON.parse(Q(pf).get("aiCred")), { tokenId: c.aiCred.tokenId, principal: c.aiCred.principal });
    else assert.equal(Q(pf).has("aiCred"), false);
    assert.equal(Q(make("readheld", c, { url: "http://h/?op=readheld&defer=1" })).has("defer"), false);
    assert.equal(Q(make("readheld", c, { args: { deferred: true } })).get("defer"), "1");
    assert.equal(Q(make("captureupload", c, { args: { length: 4096 } })).get("declared"), "4096");
    assert.equal(Q(make("captureuploadpart", c, { args: { length: 12 } })).get("declared"), "12");
    assert.equal(Q(make("search", c, { args: { length: 12 } })).has("declared"), false);
    assert.equal(Q(make("inboxpull", c, { url: "http://h/?op=inboxpull&resolve=pulled" })).has("resolve"), false);
    assert.equal(Q(make("inboxpull", c, { args: { resolving: true } })).get("resolve"), "pulled");
  }
});

test("R9: nothing the caller names survives in the body; a body is serialised again only when a key was deleted", () => {
  for (const [kind, c] of KINDS()) {
    const b = B(make("allocid", c));
    for (const k of [...BODY_STAMPS, "token", "secretSha", "bySecret"]) assert.equal(k in b, false, `${kind} ${k}`);
    assert.equal(B(make("setpassword", c, { body: JSON.stringify({ role: "admin", password: "p" }) })).role, undefined);
    assert.equal("at" in B(make(ACT_CLOCK_OPS[0] === "aicredentialmint" ? ACT_CLOCK_OPS[1] : ACT_CLOCK_OPS[0], c, { body: JSON.stringify({ at: "x" }) })), false);
    for (const op of ["inboxpull", "inboxresolve"]) assert.equal(B(make(op, c, { body: JSON.stringify({ viewer: "x", status: "kept" }) })).viewer, undefined);
    for (const op of SESSION_MEMBER_BODY_OPS) assert.equal(B(make(op, c, { body: JSON.stringify({ member: "x" }) })).member, undefined, op);
    const acct = Object.keys(OPS).find((op) => declares(op, "member") && !SESSION_MEMBER_BODY_OPS.includes(op) && op !== "unpack" && !OD.QUEUE_ACTIONS.includes(op));
    assert.equal(B(make(acct, c, { body: JSON.stringify({ member: "named-account" }) })).member, "named-account", acct);
    const kept = '{ "q" : 1 }';
    assert.equal(make("allocid", c, { body: kept }).body, kept, "no key deleted: the text as it came");
  }
});

test("R10: an op declaring bodyBy has the actor as the body's by on a POST, an empty body stamped too", () => {
  const op = Object.keys(OPS).find((o) => declares(o, "bodyBy") && !OD.STANDARDS_ACTIONS.includes(o) && !Object.hasOwn(BODY_ACTOR, o)
    && !OD.LOCAL_FACTS_ACTIONS.includes(o) && !OD.INTENT_ACTIONS.includes(o));
  assert.ok(op);
  for (const [kind, c] of KINDS()) {
    assert.equal(B(make(op, c, { body: JSON.stringify({ by: FORGED }) })).by, ex(c).actor, kind);
    assert.equal(B(make(op, c, { body: undefined })).by, ex(c).actor, `${kind} empty`);
    assert.equal(make(op, c, { body: "[1]" }).body, "[1]");
  }
});

const bundleMd = (type, extra = "") => `---\nobject_type: ${type}\nsurfaced_by: forged\n${extra}---\n\nbody\n`;
const promoteBody = (type, o = {}) => {
  const text = bundleMd(type);
  return JSON.stringify({ base: null, meta: { object_type: type }, files: [{ path: "bundle.md", text, ...(o.sha ? { sha256: o.sha } : {}) }],
    ownerMemberId: FORGED, actorMemberId: FORGED, author: FORGED, actorIdentity: FORGED, actorViewer: FORGED, setIn: FORGED,
    personWarningSeen: true, replay: true, migrationReplay: FORGED, memberUserAgent: FORGED, assistantPrincipal: FORGED, project: " PROJ-1 ", ...o.extra });
};
const sha = (t) => createSha256().update(new TextEncoder().encode(t)).hex();

test("R11: a promotion's body: each key for each kind of caller, every forged value deleted, the project gate, surfaced_by and the digest rule both ways", () => {
  for (const [kind, c] of KINDS()) {
    const e = ex(c), s = c.viaSession;
    const r = make("promote", c, { body: promoteBody("information"), args: { userAgent: "  Browser/1.0  " } });
    const b = B(r);
    assert.equal(b.author, e.T, kind); assert.equal(b.actorMemberId, s ? c.member : undefined);
    assert.equal(b.actorIdentity, e.N); assert.equal(b.actorViewer, e.V);
    assert.equal(b.setIn, "PROJ-1"); assert.equal(b.personWarningSeen, s ? true : undefined);
    assert.equal(b.replay, undefined); assert.equal(b.migrationReplay, undefined); assert.equal(b.ownerMemberId, undefined);
    assert.equal(b.memberUserAgent, s ? "Browser/1.0" : undefined);
    assert.equal(b.assistantPrincipal, s ? undefined : e.P);
    /* the address's project wins over the body's; empty is none */
    assert.equal(B(make("promote", c, { url: "http://h/?op=promote&project=PROJ-9", body: promoteBody("information") })).setIn, "PROJ-9");
    assert.equal(B(make("promote", c, { body: promoteBody("information", { extra: { project: "  " } }) })).setIn, undefined);
    /* an inquiry's surfaced_by is the door's; the digest recomputed only when none or the sent text's was sent */
    const inq = B(make("promote", c, { body: promoteBody("inquiry") }));
    const md = inq.files[0];
    assert.match(md.text, new RegExp(`surfaced_by: ${s ? "human" : "agent"}`));
    assert.equal(md.sha256, sha(md.text));
    const honest = B(make("promote", c, { body: promoteBody("inquiry", { sha: sha(bundleMd("inquiry")) }) })).files[0];
    assert.equal(honest.sha256, sha(honest.text));
    const lying = B(make("promote", c, { body: promoteBody("inquiry", { sha: "0".repeat(64) }) })).files[0];
    assert.equal(lying.sha256, "0".repeat(64)); assert.match(lying.text, /surfaced_by: forged/);
    /* a verified replay: replay true, migrationReplay the record, no assistantPrincipal */
    const proven = { capture: "a".repeat(64), promotion: "k", bundleMdSha: "b".repeat(64) };
    const rp = B(make("promote", c, { body: promoteBody("inquiry"), args: { replay: { asserted: true, proven } } }));
    assert.equal(rp.replay, true); assert.deepEqual(rp.migrationReplay, proven); assert.equal(rp.assistantPrincipal, undefined);
    assert.match(rp.files[0].text, /surfaced_by: forged/, "a verified replay is not restamped");
  }
  /* a session's creation of a project: the capability gate, else ownerMemberId */
  const refused = make("promote", C.member, { body: promoteBody("project") });
  assert.equal(refused.refusal.body.reason, "NOT_CAPABLE");
  assert.equal(B(make("promote", C.founder, { body: promoteBody("project") })).ownerMemberId, C.founder.member);
  assert.equal(B(make("promote", C.admin, { body: promoteBody("project") })).ownerMemberId, undefined);
  assert.equal(promotedTypeOf({ files: [{ path: "bundle.md", text: bundleMd("inquiry") }], meta: { object_type: "project" } }), "inquiry");
});

test("R12: the actor in the body, per op: a forged value replaced; an absent body stamped where the rule says; a non-object body unchanged", () => {
  const rows = [["expertisedeclare", "memberId", "M"], ["expertiseconfirm", "by", "M"], ["resolutiondefect", "by", "M", true],
    ["entitycreate", "declaredBy", "M"], ["entityalias", "declaredBy", "M"], ["relationdeclare", "declaredBy", "M"], ["progressiondefine", "declaredBy", "M"],
    ["discharge", "declaredBy", "M"], ["aliaswithdraw", "withdrawnBy", "M"], ["relationwithdraw", "withdrawnBy", "M"], ["resolve", "resolvedBy", "M"],
    ["resolvetestify", "resolvedBy", "M"], ["thread", "threadedBy", "M"], ["proposedispose", "decidedBy", "M"], ["inboxresolve", "by", "T"],
    ["taskforward", "actor", "T"], ["taskresolve", "actor", "T"], ["taskdrain", "actor", "T"], ["biasdebtresolve", "actor", "T"],
    [OD.INTENT_ACTIONS[0], "author", "AI", true], ["standarddeclare", "author", "AI", true], ["standardpropose", "proposer", "AI", true],
    ["lawrelate", "author", "AI", true], ["lawpropose", "proposer", "AI", true], [OD.LOCAL_FACTS_ACTIONS[0], "by", "AI", true]];
  for (const [kind, c] of KINDS()) {
    const e = ex(c);
    for (const [op, key, x, emptyStamped] of rows) {
      assert.equal(B(make(op, c))[key], e[x], `${kind} ${op} ${key}`);
      const empty = make(op, c, { body: undefined });
      if (emptyStamped) assert.equal(B(empty)[key], e[x], `${kind} ${op} empty`);
      else assert.equal(empty.body, undefined, `${kind} ${op} empty`);
      assert.equal(make(op, c, { body: "[3]" }).body, "[3]", `${op} non-object`);
    }
    assert.equal(B(make("connect", c)).assertedBy, "system");
    const tri = B(make("triage", c));
    assert.equal(tri.assistantPrincipal, c.viaSession ? undefined : e.P);
    const law = B(make("lawpropose", c, { body: JSON.stringify({ author: FORGED, proposer: FORGED }) }));
    assert.equal(law.author, undefined); assert.equal(law.proposer, e.AI);
    const lf = B(make(OD.LOCAL_FACTS_ACTIONS[0], c, { body: JSON.stringify({ viewer: FORGED, who: FORGED }) }));
    assert.equal(lf.viewer, undefined); assert.equal(lf.who, undefined);
  }
});

test("R13: taskdecide takes the body actor the task acts take: a forged actor overwritten", () => {
  for (const [kind, c] of KINDS()) {
    assert.equal(B(make("taskdecide", c, { body: JSON.stringify({ actor: FORGED, task: "t" }) })).actor, ex(c).T, kind);
    assert.equal(B(make("taskdecide", c, { body: JSON.stringify({ task: "t" }) })).actor, ex(c).T, kind);
  }
});

test("R14: an op named in no rule of R6 to R12 gets only R2 to R5, R9, R10 and R23: its address is the page's less R3's keys plus its declared stamps", () => {
  const unnamed = ["allocid", "snapkeycensus", "exportlog"].filter((op) => Object.hasOwn(OPS, op));
  assert.ok(unnamed.length);
  for (const [, c] of KINDS()) for (const op of unnamed) {
    const r = innerRequest({ op, url: `http://h/?op=${op}&a=1&viewer=x&b=2`, caller: c });
    const keys = [...Q(r).keys()].filter((k) => k !== "a" && k !== "b");
    assert.deepEqual(keys.sort(), (OP_STAMPS[op] || []).filter((k) => !["session", "bodyBy", "source", "country"].includes(k)).sort(), op);
  }
});

test("R23: a grant's digest crosses in the body; the secret-presenting ops both ways; forged digests replaced or absent; the digest in no address", () => {
  const digest = "c".repeat(64);
  for (const op of ["reviewcopy", "reviewcomment", "statementack", "templateread", "templatecomments", "templatereview", "templatecomment"]) {
    const yes = innerRequest({ op, url: `http://h/?op=${op}&draft=D&secretSha=${FORGED}&bySecret=0`, method: "POST",
                               body: JSON.stringify({ text: "hi", secretSha: FORGED, bySecret: true, secret: "s" }), caller: null, bySecret: true, secretSha: digest });
    assert.equal(Q(yes).get("bySecret"), "1", op); assert.equal(B(yes).secretSha, digest); assert.equal(Q(yes).has("secretSha"), false);
    assert.equal(B(yes).bySecret, undefined); assert.equal(B(yes).text, "hi");
    assert.equal(B(innerRequest({ op, url: `http://h/?op=${op}`, caller: null, bySecret: true, secretSha: digest })).secretSha, digest, `${op} absent body`);
    const no = innerRequest({ op, url: `http://h/?op=${op}&bySecret=1&secretSha=${FORGED}`, method: "POST", body: JSON.stringify({ secretSha: FORGED }), caller: null, bySecret: false });
    assert.equal(Q(no).has("bySecret"), false); assert.equal(Q(no).has("secretSha"), false); assert.equal(B(no).secretSha, undefined);
  }
  for (const op of ["reviewgrant", "templatereviewgrant"]) for (const [, c] of KINDS()) {
    const r = innerRequest({ op, url: `http://h/?op=${op}&secretSha=${FORGED}`, method: "POST", body: JSON.stringify({ draft: "D", secretSha: FORGED }), caller: c, secretSha: digest });
    assert.equal(B(r).secretSha, digest); assert.equal(Q(r).has("secretSha"), false);
    assert.equal(B(innerRequest({ op, url: `http://h/?op=${op}`, method: "POST", caller: c, secretSha: digest })).secretSha, digest, "absent body");
    for (const body of ["[1]", "null", "not json"]) assert.equal(innerRequest({ op, url: `http://h/?op=${op}`, method: "POST", body, caller: c, secretSha: digest }).body, body);
  }
  for (const [, c] of KINDS()) {
    const m = innerRequest({ op: "aicredentialmint", url: "http://h/?op=aicredentialmint", method: "POST",
      body: JSON.stringify({ tokenId: "b", writes: ["x"], confinedTo: "bio", secretSha: FORGED, secret: "s" }), caller: c,
      mint: { writes: ["inquiry"], confinedTo: "scratch", secretSha: digest } });
    const b = B(m);
    assert.deepEqual(b.writes, ["inquiry"]); assert.equal(b.confinedTo, "scratch"); assert.equal(b.secretSha, digest); assert.equal(b.tokenId, "b");
    assert.equal(Q(m).get("who"), ex(c).T); assert.equal(m.url.includes(digest), false);
  }
});

/* R24's lists, read from the requirement itself (`build/requirements/store-request.md`), so no test hand-lists another module's ops */
const R24_LINE = (() => {
  const t = readFileSync(new URL("../../../../build/requirements/store-request.md", import.meta.url), "utf8");
  const at = t.indexOf("- **R24**");
  return t.slice(at, t.indexOf("\n", at));
})();
const listOf = (name) => {
  const m = new RegExp("`" + name + "`(?: \\(R3's [a-z-]+ (?:keys|ops)\\))?: ((?:`[a-zA-Z]+`(?:, )?)+)").exec(R24_LINE);
  return m ? [...m[1].matchAll(/`([a-zA-Z]+)`/g)].map((x) => x[1]) : null;
};
const ownConstants = { MEMBERSHIP_ADMIN_ACTS, WIZARD_AUTHOR_ACTIONS, WIZARD_PROPOSAL_ACTIONS, WIZARD_VIEWER_OPS, CASE_IMPORT_ACTIONS, CASE_IMPORT_READS,
                       SESSION_MEMBER_BODY_OPS };

test("R24: each constant equals its list; each family equals op-declarations' export; every op named in R3 to R12 is in OPS", () => {
  assert.deepEqual([...QUERY_STAMPS], ["viewer", "identity", "author", "by", "actor", "who", "origin", "administer", "aiCred", "source", "country"]);
  assert.equal(ACT_CLOCK_OPS.length, 21);
  assert.deepEqual([...BODY_STAMPS], ["actorIdentity", "actorViewer", "actorMemberId", "ownerMemberId", "assistantPrincipal", "migrationReplay"]);
  assert.deepEqual(JSON.parse(JSON.stringify(BODY_ONLY)), { securitytooladd: ["credentials", "config"], projectkeyset: ["key"], setpassword: ["current", "password", "role"] });
  assert.deepEqual(JSON.parse(JSON.stringify(BODY_DROPPED)), { setpassword: ["role"] });
  for (const [name, mine] of Object.entries(ownConstants)) {
    const listed = name === "SESSION_MEMBER_BODY_OPS" ? ["stepsource", "stepsourcewithdraw"] : listOf(name);
    assert.ok(listed, `${name} is listed in R24`);
    assert.deepEqual([...mine], listed, name);
  }
  /* BODY_ACTOR (op: key), as R24 states it */
  const ba = /`BODY_ACTOR` \(op: key\): `author` for ((?:`[a-z]+`(?:, )?)+); `proposer` for ((?:`[a-z]+`(?:, )?)+)/.exec(R24_LINE);
  const names = (g) => [...g.matchAll(/`([a-z]+)`/g)].map((x) => x[1]);
  assert.deepEqual({ ...BODY_ACTOR }, Object.fromEntries([...names(ba[1]).map((op) => [op, "author"]), ...names(ba[2]).map((op) => [op, "proposer"])]));
  /* every family R24 fixes whose name op-declarations exports: equal to that export */
  const families = [...R24_LINE.matchAll(/`([A-Z_]+)`: (?=`[a-z])/g)].map((m) => m[1]).filter((n) => !Object.hasOwn(ownConstants, n) && Object.hasOwn(OD, n));
  assert.ok(families.length >= 30, `${families.length} families`);
  for (const name of families) assert.deepEqual([...OD[name]].sort(), [...listOf(name)].sort(), name);
  const named = new Set([...VIEWER_STAMPED_OPS, ...ACT_CLOCK_OPS, ...Object.keys(BODY_ONLY), ...Object.keys(BODY_ACTOR), ...MEMBERSHIP_ADMIN_ACTS,
    ...WIZARD_AUTHOR_ACTIONS, ...CASE_IMPORT_ACTIONS, ...[...R24_LINE.matchAll(/`([a-z]+)`/g)].map((m) => m[1])]);
  const missing = [...named].filter((op) => !Object.hasOwn(OPS, op) && !["at", "now", "credentials", "config", "key", "current", "password", "role",
    "author", "proposer", "member", "by", "viewer", "identity", "who", "origin", "administer", "source", "country", "actor"].includes(op));
  assert.deepEqual(missing, []);
});

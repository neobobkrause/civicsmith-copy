/* store-door: the record store's door (R1, R2, R3, R6, R9, R11, R13, R14). Driven through `dispatch(req, store)` with a route map
   and a membership that record what reached them, and over a real record (`record.mjs`) where an owner's answer is read.
   Moved from control-plane's `dispatch.test.mjs`, `envelope.test.mjs` (the store's half of R25), `r48-routes.test.mjs`
   (R47's classification), `r53-routes.test.mjs` and `t34-routes.test.mjs` (R53's store half) at the split (K1974). The
   Durable Object class whose `fetch` is this door is plane's (its R1). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { D, go, quietly, UUID } from "./harness.mjs";
const { record } = await import("./record.mjs");
const { DISPATCH_CHECKS } = await import("../../../src/answer-envelope/checks.mjs");
const { askAdmits } = await import("../../../src/answers/scope.mjs");
const { dispatch, PROJECT_NAMING_READS, PROJECT_NAMING_READS_NOT, GRANT_HEADER, SESSION_HEADER, CREDENTIAL_SHA_HEADER } = D;

/* A store whose routes record their call; `membership` answers existence for the ids in `existence` (discoverable, and
   seen at EXISTENCE by the viewer), and records every question. */
function fakeStore({ routes = null, discoverable = [], existence = [] } = {}) {
  const log = [];
  const store = {
    log,
    routes(url, body) {
      log.push({ kind: "routes", body });
      return routes ?? new Proxy({}, { has: () => true, get: (_, op) => (typeof op === "string" ? () => { log.push({ kind: "route", op, body }); return { answered: op }; } : undefined),
                                       getOwnPropertyDescriptor: () => ({ configurable: true, enumerable: true, value: true }) });
    },
    membership() {
      log.push({ kind: "membership" });
      return {
        visibilityOf(id) { log.push({ kind: "visibility", id }); return discoverable.includes(id) ? "discoverable" : "hidden"; },
        existenceAct(id, viewer) {
          log.push({ kind: "existence", id, viewer });
          return existence.includes(id) ? { ok: false, reason: "PROJECT_SEEN_NOT_A_PARTICIPANT", project: id } : null;
        },
      };
    },
  };
  return store;
}

test("R1: the store's door — an empty POST body is null, a non-JSON body 400 BAD_JSON, a route no module serves 400 `unknown op: <op>`, an answer {ok: true, result}; the routes are the modules' own maps", async () => {
  /* the body */
  for (const [init, want] of [[{ method: "POST" }, null], [{ method: "POST", body: "" }, null], [{ method: "POST", body: "  \n" }, null],
                              [{ method: "GET" }, null], [{ method: "POST", body: '{"a":1}' }, { a: 1 }], [{ method: "POST", body: "[1]" }, [1]]]) {
    const s = fakeStore();
    s.routes = (url, body) => ({ echo: () => ({ body }) });
    const r = await go(s, "echo", init);
    assert.deepEqual([r.status, r.json], [200, { ok: true, result: { body: want } }], JSON.stringify(init));
  }
  for (const bad of ["{", "not json", "{'a':1}"]) {
    const s = fakeStore();
    const r = await go(s, "echo", { method: "POST", body: bad });
    assert.deepEqual([r.status, r.json.ok, r.json.reason], [400, false, "BAD_JSON"]);
    assert.deepEqual(s.log, [], "no route map consulted");
  }
  /* an unserved route, inherited names included, and no route ran */
  for (const op of ["nosuch", "toString", "constructor", "__proto__", "hasOwnProperty", ""]) {
    const ran = [];
    const s = fakeStore({ routes: { echo: () => ran.push(1) } });
    const r = await go(s, op);
    assert.deepEqual([r.status, r.json], [400, { ok: false, error: "unknown op: " + op }], op);
    assert.equal(ran.length, 0);
  }
  /* the answer: whatever the route answers, awaited, under result; the route receives the url's parameters and the body */
  for (const v of [null, 0, [], {}, "x", { ok: false, reason: "R" }]) {
    const r = await go({ routes: (url) => ({ q: async () => (url.searchParams.get("k") === "1" ? v : "wrong") }), membership: () => null }, "q?k=1");
    assert.deepEqual([r.status, r.json], [200, { ok: true, result: v }]);
  }
  /* this module holds no Durable Object class: the class whose fetch is this door is plane's (its R1) */
  assert.equal("Store" in D, false, "store-door exports no Durable Object class");
  /* the routes are the modules' own maps: the door answers only what the map it is handed holds (negative control: the
     same name in another map is served) */
  const one = { routes: () => ({ a: () => "A" }), membership: () => null };
  assert.deepEqual((await go(one, "b")).json, { ok: false, error: "unknown op: b" });
  assert.deepEqual((await go({ ...one, routes: () => ({ b: () => "B" }) }, "b")).json, { ok: true, result: "B" });
});

test("R2: a read naming a project (PROJECT_NAMING_READS) asked with a stamped viewer and naming a discoverable project is answered by membership.existenceAct first (C-70.1), before its route runs; the reads naming none are listed with the reason", async () => {
  const P = "PROJ-seen", H = "PROJ-hidden", F = "PROJ-full";
  assert.ok(Object.keys(PROJECT_NAMING_READS).length > 20);
  for (const [op, params] of Object.entries(PROJECT_NAMING_READS)) {
    assert.ok(Array.isArray(params) && params.length > 0, op);
    assert.equal(Object.hasOwn(PROJECT_NAMING_READS_NOT, op), false, `${op} in both tables`);
    for (const p of params) for (const where of ["query", "body"]) {
      const s = fakeStore({ discoverable: [P, F], existence: [P] });
      const q = where === "query" ? `&${p}=${P}` : "";
      const init = where === "body" ? { method: "POST", body: JSON.stringify({ [p]: P }) } : undefined;
      const r = await go(s, `${op}?viewer=member:ann${q}`, init);
      assert.deepEqual([r.status, r.json.ok, r.json.result.reason, r.json.result.project], [200, true, "PROJECT_SEEN_NOT_A_PARTICIPANT", P], `${op}.${p} ${where}`);
      assert.equal(s.log.some((e) => e.kind === "route"), false, `${op}: the route ran`);
      assert.deepEqual(s.log.filter((e) => e.kind === "existence").map((e) => [e.id, e.viewer]), [[P, "member:ann"]]);
      /* negative controls: a hidden project is never asked; a discoverable one the viewer sees whole falls through */
      for (const [id, asked] of [[H, false], [F, true], ["", false]]) {
        const t = fakeStore({ discoverable: [P, F], existence: [P] });
        const r2 = await go(t, `${op}?viewer=member:ann&${p}=${id}`);
        assert.deepEqual(r2.json.result, { answered: op }, `${op}.${p}=${id}`);
        assert.equal(t.log.some((e) => e.kind === "existence"), asked, `${op}.${p}=${id}`);
      }
    }
    /* no stamped viewer: an internal call, never asked, and membership is not even consulted */
    const s = fakeStore({ discoverable: [P], existence: [P] });
    const r = await go(s, `${op}?${params[0]}=${P}`);
    assert.deepEqual(r.json.result, { answered: op });
    assert.equal(s.log.some((e) => e.kind === "membership"), false);
  }
  /* a read listed as naming no project is never asked, whatever it names, and each carries its reason */
  for (const [op, why] of Object.entries(PROJECT_NAMING_READS_NOT)) {
    assert.equal(typeof why, "string", op);
    assert.ok(why.length > 10, op);
    const s = fakeStore({ discoverable: [P], existence: [P] });
    const r = await go(s, `${op}?viewer=member:ann&id=${P}&project=${P}&run=${P}&sha256=${P}`, { method: "POST", body: JSON.stringify({ id: P }) });
    assert.deepEqual(r.json.result, { answered: op });
    assert.equal(s.log.some((e) => e.kind === "membership"), false, op);
  }
  /* the first existence answer wins, and an unlisted parameter of a listed read is not asked */
  const s = fakeStore({ discoverable: [P, "PROJ-2"], existence: [P, "PROJ-2"] });
  const r = await go(s, `basisversions?viewer=member:ann&id=PROJ-2&project=${P}&other=${P}`);
  assert.equal(r.json.result.project, "PROJ-2");
  const t = fakeStore({ discoverable: [P], existence: [P] });
  assert.deepEqual((await go(t, `basisversions?viewer=member:ann&other=${P}`)).json.result, { answered: "basisversions" });
  assert.equal(t.log.some((e) => e.kind === "existence"), false);
});

test("R2 (fix round 6, G12c; K4571): the batch reads — `casedrafts` (`projects`), `inquirystrength` (`ids`) and `reviewcopy` (`drafts`) — fence every listed id exactly as the single read fences its one: a list given as an array, a JSON array or a comma list, in the query or the body, is read id by id (one `visibilityOf` per distinct id, `existenceAct` only for a discoverable one), a project the caller sees only at EXISTENCE answers the single read's answer byte for byte, whatever its place in the list, before the route runs; a list of seen or hidden ids reaches the route unchanged; `reviewcopy`'s ids are draft ids and the read stays among those naming no project", async () => {
  const P = "PROJ-seen", P2 = "PROJ-seen2", F = "PROJ-full", H = "PROJ-hidden";
  const BATCH = { casedrafts: ["project", "projects"], inquirystrength: ["id", "ids"] };
  assert.deepEqual(D.PROJECT_NAMING_LISTS, { casedrafts: ["projects"], inquirystrength: ["ids"] });
  for (const [op, params] of Object.entries(BATCH)) {
    assert.deepEqual(PROJECT_NAMING_READS[op], params, `${op}'s row`);
    assert.equal(Object.hasOwn(PROJECT_NAMING_READS_NOT, op), false, `${op} in both tables`);
    const list = params[1];
    const forms = {
      "array in the body": (ids) => ({ q: "", init: { method: "POST", body: JSON.stringify({ [list]: ids }) } }),
      "JSON array in the query": (ids) => ({ q: `&${list}=${encodeURIComponent(JSON.stringify(ids))}` }),
      "comma list in the query": (ids) => ({ q: `&${list}=${ids.join(",")}` }),
      "comma list in the body": (ids) => ({ q: "", init: { method: "POST", body: JSON.stringify({ [list]: ids.join(",") }) } }),
      "repeated in the query": (ids) => ({ q: ids.map((i) => `&${list}=${i}`).join("") }),
    };
    /* the single read's answer for the project she sees only at EXISTENCE: what each batch must answer */
    const single = await go(fakeStore({ discoverable: [P, F], existence: [P] }), `${op}?viewer=member:ann&${params[0]}=${P}`);
    assert.equal(single.json.result.reason, "PROJECT_SEEN_NOT_A_PARTICIPANT");
    for (const [form, make] of Object.entries(forms)) {
      for (const ids of [[P], [F, P], [P, F], [H, F, P, H], [F, H, P, P2]]) {
        const s = fakeStore({ discoverable: [P, P2, F], existence: [P] });
        const { q, init } = make(ids);
        const r = await go(s, `${op}?viewer=member:ann${q}`, init);
        assert.deepEqual(r.json, single.json, `${op} ${form} ${ids}: the single read's answer, byte for byte`);
        assert.equal(s.log.some((e) => e.kind === "route"), false, `${op} ${form} ${ids}: the route ran`);
        assert.equal(JSON.stringify(r.json).includes(F) || JSON.stringify(r.json).includes(H), false, `${op} ${form} ${ids}: nothing of another id`);
      }
      /* controls: a list of ids she sees whole or that are hidden reaches the route with the list as sent */
      for (const ids of [[F], [F, H], [H], [F, P2]]) {
        const s = fakeStore({ discoverable: [P2, F], existence: [P] });
        const { q, init } = make(ids);
        const r = await go(s, `${op}?viewer=member:ann${q}`, init);
        assert.deepEqual(r.json.result, { answered: op }, `${op} ${form} ${ids}`);
        const routed = s.log.filter((e) => e.kind === "route");
        assert.equal(routed.length, 1, `${op} ${form} ${ids}: routed once`);
        if (init) assert.deepEqual(routed[0].body, JSON.parse(init.body), "the body as sent");
      }
    }
    /* order does not decide: two ids at EXISTENCE answer alike whichever comes first (the lowest id's answer) */
    const two = (ids) => go(fakeStore({ discoverable: [P, P2], existence: [P, P2] }), `${op}?viewer=member:ann&${list}=${ids.join(",")}`);
    assert.deepEqual((await two([P, P2])).json, (await two([P2, P])).json);
    assert.equal((await two([P2, P])).json.result.project, P);
    /* the cost: one visibility lookup per distinct id, an existence answer only for a discoverable one, none without a viewer */
    const c = fakeStore({ discoverable: [F], existence: [] });
    await go(c, `${op}?viewer=member:ann&${list}=${[F, H, F, H, "PROJ-x"].join(",")}`);
    assert.deepEqual(c.log.filter((e) => e.kind === "visibility").map((e) => e.id), [F, H, "PROJ-x"]);
    assert.deepEqual(c.log.filter((e) => e.kind === "existence").map((e) => e.id), [F]);
    const n = fakeStore({ discoverable: [P], existence: [P] });
    assert.deepEqual((await go(n, `${op}?${list}=${P},${F}`)).json.result, { answered: op });
    assert.equal(n.log.some((e) => e.kind === "membership"), false);
    /* the single parameters keep their meaning: a comma in `${params[0]}` is not a list */
    const one = fakeStore({ discoverable: [P], existence: [P] });
    assert.deepEqual((await go(one, `${op}?viewer=member:ann&${params[0]}=${F},${P}`)).json.result, { answered: op });
  }
  /* malformed lists never throw at the door: they reach the owner, who refuses them */
  for (const [bad, want] of [[{ projects: 7 }, null], [{ projects: { a: 1 } }, null], [{ projects: [1, null, ""] }, null],
                             [{ projects: "[not json" }, null], [{ projects: [[P]] }, "PROJECT_SEEN_NOT_A_PARTICIPANT"]]) {
    const s = fakeStore({ discoverable: [P], existence: [P] });
    const r = await go(s, "casedrafts?viewer=member:ann", { method: "POST", body: JSON.stringify(bad) });
    assert.equal(r.status, 200, JSON.stringify(bad));
    if (want) assert.equal(r.json.result.reason, want, JSON.stringify(bad));
    else assert.deepEqual(r.json.result, { answered: "casedrafts" }, JSON.stringify(bad));
  }
  /* reviewcopy: its ids are DRAFT ids (a thing inside a project), so the batch key is named in the reason and no existence answer is run */
  assert.equal(Object.hasOwn(PROJECT_NAMING_READS, "reviewcopy"), false);
  assert.match(PROJECT_NAMING_READS_NOT.reviewcopy, /`draft`/);
  assert.match(PROJECT_NAMING_READS_NOT.reviewcopy, /`drafts`/);
  const rc = fakeStore({ discoverable: [P], existence: [P] });
  const rr = await go(rc, `reviewcopy?viewer=member:ann&drafts=${P},DRAFT-1`, { method: "POST", body: JSON.stringify({ drafts: [P, "DRAFT-1"], draft: P }) });
  assert.deepEqual(rr.json.result, { answered: "reviewcopy" });
  assert.equal(rc.log.some((e) => e.kind === "membership"), false);
});

test("R2 (T36-48; K2063, K2152; file-safety R2, R6, R9, R11, R15, R31, R33, R38): file-safety's reads that take a parameter — `verdictnotes`, `threatof`, `originalstate`, `safeview`, `safecopy` (a capture's digest), `scanfindings` and `securitytoolevents` (a cursor), `findingkind` (a finding name) — are listed as naming no project, each with its reason, so a discoverable project's id in any of their own parameters, query or body, is never asked of membership and the route answers; none is among the reads naming a project (negative control: the same id at a read naming a project is answered existence first)", async () => {
  const { fileSafetyOps } = await import("../../../src/file-safety/index.mjs");
  const served = new Set(Object.keys(fileSafetyOps(null, new URL("http://do/"), null, null)));
  const READS = { verdictnotes: ["capture", "captureSha"], threatof: ["capture", "captureSha"], originalstate: ["capture", "captureSha"],
                  safeview: ["capture", "captureSha"], safecopy: ["capture", "captureSha"], scanfindings: ["after", "limit"],
                  findingkind: ["name"], securitytoolevents: ["after", "limit"] };
  const DIGEST = "`captureSha` is a CAPTURE's digest";
  const P = "PROJ-seen";
  for (const [op, params] of Object.entries(READS)) {
    assert.ok(served.has(op), `${op} is file-safety's route`);
    assert.equal(Object.hasOwn(PROJECT_NAMING_READS, op), false, `${op} names no project`);
    assert.equal(typeof PROJECT_NAMING_READS_NOT[op], "string", `${op} listed with its reason`);
    if (params[0] === "capture") assert.equal(PROJECT_NAMING_READS_NOT[op], DIGEST, op);
    else for (const p of params) assert.match(PROJECT_NAMING_READS_NOT[op], new RegExp("`" + p + "`"), `${op}'s reason names ${p}`);
    for (const p of params) {
      const s = fakeStore({ discoverable: [P], existence: [P] });
      const r = await go(s, `${op}?viewer=member:ann&${p}=${P}`, { method: "POST", body: JSON.stringify({ [p]: P }) });
      assert.deepEqual([r.status, r.json.result], [200, { answered: op }], `${op}.${p}`);
      assert.equal(s.log.some((e) => e.kind === "membership"), false, `${op}.${p}: membership asked`);
    }
  }
  /* negative control: the same id, a read naming a project */
  const n = fakeStore({ discoverable: [P], existence: [P] });
  assert.equal((await go(n, `image?viewer=member:ann&id=${P}`)).json.result.reason, "PROJECT_SEEN_NOT_A_PARTICIPANT");
});

test("R2 (T45-50; K2891; op-declarations R49): T45's reads whose parameters carry a bundle id are among the reads naming a project, each with exactly its own parameters — `successrecords` (`project`, `plan`), `cures` (`determination`), `openitemswith` and `templatesforaction` (`action`), plan-work's ten reads (`plan`) and (K2900) `advocacychecks` (`project`) — so a project the viewer sees only at EXISTENCE, named in any of them, query or body, is answered C-70.1 before the route; T45's other reads are listed as naming none, each with its reason (controls: a project the viewer sees whole is admitted to the route; a hidden one is never asked; a listed-as-none read is never asked)", async () => {
  const NAMING = {
    successrecords: ["project", "plan"], cures: ["determination"], openitemswith: ["action"], templatesforaction: ["action"],
    matters: ["plan"], plantimeline: ["plan"], planreviewopen: ["plan"], planreviews: ["plan"], prepitems: ["plan"],
    plancomments: ["plan"], whereitstands: ["plan"], statusreportdraft: ["plan"], statusreports: ["plan"],
    matterpromiseduties: ["plan"], advocacychecks: ["project"],
  };
  const NONE = { watchquestions: ["after", "limit"], dutiesarising: ["captures", "as_of"], procedureguides: ["kind"],
                 successread: ["id"], casecheck: ["case", "edition", "check"], ruleoffer: ["rule"], grouprules: ["section"] };
  const P = "PROJ-seen", F = "PROJ-full", H = "PROJ-hidden";
  for (const [op, params] of Object.entries(NAMING)) {
    assert.deepEqual(PROJECT_NAMING_READS[op], params, `${op}'s row`);
    assert.equal(Object.hasOwn(PROJECT_NAMING_READS_NOT, op), false, `${op} in both tables`);
    for (const p of params) for (const where of ["query", "body"]) {
      /* refused at EXISTENCE: the project the caller sees only exists, before the route */
      const s = fakeStore({ discoverable: [P, F], existence: [P] });
      const init = where === "body" ? { method: "POST", body: JSON.stringify({ [p]: P }) } : undefined;
      const r = await go(s, `${op}?viewer=member:ann${where === "query" ? `&${p}=${P}` : ""}`, init);
      assert.deepEqual([r.status, r.json.result.reason, r.json.result.project], [200, "PROJECT_SEEN_NOT_A_PARTICIPANT", P], `${op}.${p} ${where}`);
      assert.equal(s.log.some((e) => e.kind === "route"), false, `${op}.${p} ${where}: the route ran`);
      /* controls: one she sees whole, admitted (asked, then routed); a hidden one, routed and never asked */
      for (const [id, asked] of [[F, true], [H, false]]) {
        const t = fakeStore({ discoverable: [P, F], existence: [P] });
        const tinit = where === "body" ? { method: "POST", body: JSON.stringify({ [p]: id }) } : undefined;
        const r2 = await go(t, `${op}?viewer=member:ann${where === "query" ? `&${p}=${id}` : ""}`, tinit);
        assert.deepEqual(r2.json.result, { answered: op }, `${op}.${p}=${id} ${where}`);
        assert.equal(t.log.some((e) => e.kind === "existence"), asked, `${op}.${p}=${id} ${where}`);
      }
    }
  }
  for (const [op, params] of Object.entries(NONE)) {
    assert.equal(Object.hasOwn(PROJECT_NAMING_READS, op), false, `${op} names no project`);
    for (const p of params) assert.match(PROJECT_NAMING_READS_NOT[op], new RegExp("`" + p + "`"), `${op}'s reason names ${p}`);
    for (const p of params) {
      const s = fakeStore({ discoverable: [P], existence: [P] });
      const r = await go(s, `${op}?viewer=member:ann&${p}=${P}`, { method: "POST", body: JSON.stringify({ [p]: P }) });
      assert.deepEqual([r.status, r.json.result], [200, { answered: op }], `${op}.${p}`);
      assert.equal(s.log.some((e) => e.kind === "membership"), false, `${op}.${p}: membership asked`);
    }
  }
});

test("R14 (T47; N970; amends R2; basis-versions R50; project-roster R26): `statusreportassist` is among the reads naming a project with its parameter `plan`, held exactly as `statusreportdraft` is, so a discoverable project the caller sees only at EXISTENCE, named in `plan` (query or body), is answered C-70.1 by `membership.existenceAct` before the route, alike for both; `projectquestions` is among the reads naming none, with the reason that a project not seen at FULL is answered an empty page, never refused, so no existence answer is run and the route answers its empty page; `projectlist` names no project (controls: `statusreportdraft` answers alike; a project seen whole is admitted to the route; a hidden one is never asked; over a real record, a read naming a project, `basisversions`, answers C-70.1 for the same project and caller)", async () => {
  const P = "PROJ-seen", F = "PROJ-full", H = "PROJ-hidden";
  /* the rows: statusreportassist's is statusreportdraft's */
  assert.deepEqual(PROJECT_NAMING_READS.statusreportassist, ["plan"]);
  assert.deepEqual(PROJECT_NAMING_READS.statusreportassist, PROJECT_NAMING_READS.statusreportdraft);
  for (const op of ["statusreportassist", "statusreportdraft"])
    assert.equal(Object.hasOwn(PROJECT_NAMING_READS_NOT, op), false, `${op} in both tables`);
  /* at the door: C-70.1 first, the route not run, the same answer for both reads */
  for (const where of ["query", "body"]) {
    const answered = {};
    for (const op of ["statusreportassist", "statusreportdraft"]) {
      const s = fakeStore({ discoverable: [P, F], existence: [P] });
      const init = where === "body" ? { method: "POST", body: JSON.stringify({ plan: P }) } : undefined;
      const r = await go(s, `${op}?viewer=member:ann${where === "query" ? `&plan=${P}` : ""}`, init);
      assert.deepEqual([r.status, r.json.ok, r.json.result.reason, r.json.result.project], [200, true, "PROJECT_SEEN_NOT_A_PARTICIPANT", P], `${op} ${where}`);
      assert.equal(s.log.some((e) => e.kind === "route"), false, `${op} ${where}: the route ran`);
      assert.deepEqual(s.log.filter((e) => e.kind === "existence").map((e) => [e.id, e.viewer]), [[P, "member:ann"]]);
      answered[op] = r.json;
      /* controls: seen whole, asked then routed; hidden, routed and never asked */
      for (const [id, asked] of [[F, true], [H, false]]) {
        const t = fakeStore({ discoverable: [P, F], existence: [P] });
        const tinit = where === "body" ? { method: "POST", body: JSON.stringify({ plan: id }) } : undefined;
        const r2 = await go(t, `${op}?viewer=member:ann${where === "query" ? `&plan=${id}` : ""}`, tinit);
        assert.deepEqual(r2.json.result, { answered: op }, `${op}.plan=${id} ${where}`);
        assert.equal(t.log.some((e) => e.kind === "existence"), asked, `${op}.plan=${id} ${where}`);
      }
    }
    assert.deepEqual(answered.statusreportassist, answered.statusreportdraft, `${where}: answered alike`);
  }
  /* projectquestions: listed as naming none, with its reason; projectlist names none */
  assert.equal(Object.hasOwn(PROJECT_NAMING_READS, "projectquestions"), false);
  assert.match(PROJECT_NAMING_READS_NOT.projectquestions, /`project`/);
  assert.match(PROJECT_NAMING_READS_NOT.projectquestions, /FULL/);
  assert.match(PROJECT_NAMING_READS_NOT.projectquestions, /empty page/);
  assert.match(PROJECT_NAMING_READS_NOT.projectquestions, /never refused/);
  assert.equal(Object.hasOwn(PROJECT_NAMING_READS, "projectlist"), false);
  assert.equal(typeof PROJECT_NAMING_READS_NOT.projectlist, "string");
  for (const [op, q] of [["projectquestions", `project=${P}`], ["projectlist", `limit=5&project=${P}`]]) {
    const s = fakeStore({ discoverable: [P], existence: [P] });
    const r = await go(s, `${op}?viewer=member:ann&${q}`, { method: "POST", body: JSON.stringify({ project: P }) });
    assert.deepEqual([r.status, r.json.result], [200, { answered: op }], op);
    assert.equal(s.log.some((e) => e.kind === "membership"), false, `${op}: membership asked`);
  }
  /* over a real record: a discoverable project vera sees only at EXISTENCE */
  const x = await record({ step: true });
  const { instanceSetupOf } = await import("../../../src/setup.mjs");
  const { membershipOf } = await import("../../../src/membership/index.mjs");
  const { basisVersionsOf, basisVersionsOps } = await import("../../../src/basis-versions/index.mjs");
  instanceSetupOf(x.ctx).instanceGroupSeed({ slug: "test-group", author: "admin" });
  for (const m of ["alice", "vera"])
    x.ctx.storage.sql.exec(`INSERT INTO members (member_id, cover, handle, role, status, capabilities, created, updated)
                            VALUES (?, ?, ?, 'member', 'active', '["contribute"]', 't', 't')`, m, `Cover ${m}`, `h_${m}`);
  const md = ["---", "object_type: project", "schema: project@1", `title: "Seen from outside"`, "current_state: forming",
    "prior_state: null", `created: "2026-10-01T00:00:00Z"`, `last_updated: "2026-10-01T00:00:00Z"`,
    `objective: "Find out."`, "references: []", "state_history: []", "---", "", "## Objective", "", "Find out.", ""].join("\n");
  const made = x.promotion.promote({ base: null, snapKey: "k1", author: "member:alice", ownerMemberId: "alice",
    files: [{ path: "bundle.md", text: md }], meta: { object_type: "project" } });
  assert.equal(made.ok, true, JSON.stringify(made));
  const RP = made.bundleId, M = membershipOf(x.ctx);
  assert.equal(M.projectVisibilitySet({ projectId: RP, setting: "discoverable", by: "alice", viewer: "member:alice" }).ok, true);
  const own = M.existenceAct(RP, "member:vera");
  assert.equal(own && own.check, "C-70.1", "vera sees the project only at EXISTENCE");
  const routed = [];
// fixtures-own: input a route map handed to the door under test; the routes only record that they ran
  const real = { membership: () => membershipOf(x.ctx),
    routes: (url, body) => ({ ...basisVersionsOps(basisVersionsOf(x.ctx), url, body),
      statusreportassist: () => { routed.push("statusreportassist"); return { ok: true }; },
      statusreportdraft: () => { routed.push("statusreportdraft"); return { ok: true }; } }) };
  const pq = await go(real, `projectquestions?viewer=member:vera&project=${RP}`);
  assert.deepEqual([pq.status, pq.json], [200, { ok: true, result: { ok: true, project: RP, items: [], cursor: null } }], "its empty page");
  for (const op of ["statusreportassist", "statusreportdraft"])
    assert.deepEqual((await go(real, `${op}?viewer=member:vera&plan=${RP}`)).json, { ok: true, result: own }, op);
  assert.deepEqual(routed, [], "no status-report route ran");
  /* control: a read naming a project answers C-70.1 for the same project and caller */
  assert.deepEqual((await go(real, `basisversions?viewer=member:vera&project=${RP}`)).json, { ok: true, result: own });
});

test("R3 (DEC-113, DEC-36; actions R58): `projectholds` is among the reads naming no project, with the reason that a project not seen at FULL is answered `held: null`, so its existence answer is not run; `actionholdrelease`, `actionholdpreview` and `projectholds` pass R1's frame to the map they are routed through, with the request's own parameters and body and nothing of the door's added (negative control: a read naming a project is still asked)", async () => {
  assert.equal(typeof PROJECT_NAMING_READS_NOT.projectholds, "string");
  assert.match(PROJECT_NAMING_READS_NOT.projectholds, /held: null/);
  assert.match(PROJECT_NAMING_READS_NOT.projectholds, /FULL/);
  for (const op of ["projectholds", "actionholdrelease", "actionholdpreview"])
    assert.equal(Object.hasOwn(PROJECT_NAMING_READS, op), false, `${op} names no project`);
  const P = "PROJ-seen";
  const ran = [], asked = [];
  const membership = () => ({ visibilityOf: (id) => { asked.push(id); return id === P ? "discoverable" : "hidden"; },
                               existenceAct: (id) => (id === P ? { ok: false, reason: "PROJECT_SEEN_NOT_A_PARTICIPANT", project: id } : null) });
  const store = { membership, routes: (url, body) => {
// fixtures-own: input a route map handed to the door under test; the routes only record what reached them
    const seen = (op) => () => { ran.push([op, Object.fromEntries(url.searchParams), body]); return { ok: true, projects: [{ project: P, held: null }] }; };
    return { projectholds: seen("projectholds"), actionholdrelease: seen("actionholdrelease"), actionholdpreview: seen("actionholdpreview"),
             notices: () => ({ ok: true }) };
  } };
  const body = { projects: [P], project: P, id: P, target: P };
  for (const op of ["projectholds", "actionholdrelease", "actionholdpreview"]) {
    ran.length = 0; asked.length = 0;
    const r = await go(store, `${op}?viewer=member:ann&by=member:ann&project=${P}&projects=${P}`, { method: "POST", body: JSON.stringify(body) });
    assert.deepEqual([r.status, r.json.ok, r.json.result.projects[0].held], [200, true, null], op);
    assert.deepEqual(ran, [[op, { viewer: "member:ann", by: "member:ann", project: P, projects: P }, body]], op);
    assert.deepEqual(asked, [], `${op}: no existence answer was run`);
  }
  /* negative control: a read naming a project at the same door is answered existence first */
  const n = await go(store, `notices?viewer=member:ann&project=${P}`);
  assert.equal(n.json.result.reason, "PROJECT_SEEN_NOT_A_PARTICIPANT");
});

test("R6 (C-69.4): an error thrown anywhere in the store's door, in a route or in the route map itself, is answered STORE_INTERNAL_ERROR with its row and a correlation id, never the stack, the message, a path or a line, and the stack is logged server-side under the id (negative control: each throw has its own id)", async () => {
  const SECRET = "SQLITE_CONSTRAINT secret-value /srv/plane/src/store.mjs:4242";
  const thrower = () => { throw new Error(SECRET); };
  const ids = [];
  for (const [routes, op] of [[() => ({ boom: thrower }), "boom"], [thrower, "boom"],
                              [() => ({ boom: async () => { await null; throw new Error(SECRET); } }), "boom"]]) {
    const { value: res, logged } = await quietly(() => dispatch(new Request(`http://do/${op}`, { method: "POST", body: "{}" }),
      { routes, membership: () => { throw new Error("not asked"); } }));
    assert.equal(res.status, 500);
    const text = await res.text();
    const j = JSON.parse(text);
    assert.deepEqual([j.ok, j.error, j.reason, j.code, j.check], [false, "internal error", "STORE_INTERNAL_ERROR", "STORE_INTERNAL_ERROR", "C-69.4"]);
    assert.equal(j.translation, DISPATCH_CHECKS.STORE_INTERNAL_ERROR.translation);
    assert.match(j.correlation, UUID);
    assert.deepEqual(Object.keys(j).sort(), ["check", "code", "correlation", "error", "ok", "reason", "translation"]);
    assert.equal(text.includes("secret-value") || text.includes("store.mjs") || text.includes(":4242") || text.includes(" at "), false);
    assert.equal(logged.length, 1);
    const line = JSON.parse(logged[0]);
    assert.deepEqual([line.event, line.correlation, line.op], ["STORE_INTERNAL_ERROR", j.correlation, op]);
    assert.match(line.stack, /secret-value/);
    ids.push(j.correlation);
  }
  assert.equal(new Set(ids).size, ids.length, "each throw gets its own id");
  /* the existence answer throwing is inside the catch too */
  const { value: ex } = await quietly(() => dispatch(new Request(`http://do/image?viewer=member:ann&id=PROJ-1`),
    { routes: () => ({ image: () => "x" }), membership: () => { throw new Error(SECRET); } }));
  assert.deepEqual([ex.status, (await ex.json()).reason], [500, "STORE_INTERNAL_ERROR"]);
  /* storeInternalError, the one place the answer is built */
  const { value: built, logged } = await quietly(() => D.storeInternalError(new Error(SECRET), "x".repeat(300)));
  assert.equal(JSON.stringify(built).includes("secret-value"), false);
  assert.equal(JSON.parse(logged[0]).op.length, 200, "the op logged is bounded");
});

test("R9 (F1; K1874, K1943): the store's door reads an ask's grant only from the request's `x-bio-grant` header — a grant in the query is not the one read, logged or handed as the map's grant — and the door makes no request of its own, so no credential reaches any address (negative control: the header's grant is read and logged)", async () => {
  assert.equal(GRANT_HEADER, "x-bio-grant");
  const logged = [], handed = [];
  const store = {
    routes: (url, body, grant) => { handed.push(grant); return { search: () => ({ rows: ["INQ-1"] }), askcheck: () => ({ ok: true }) }; },
    membership: () => ({ visibilityOf: () => "hidden", existenceAct: () => null }),
    logRead: (e) => { logged.push(e); return { rows: ["INQ-1"], logged: true }; },
  };
  const fetched = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (...a) => { fetched.push(a); throw new Error("the door made a request"); };
  try {
    /* the query's grant: not read, not logged, not handed */
    const q = await go(store, "search?grant=SENTINEL-Q&viewer=member:ann&q=x");
    assert.deepEqual(q.json, { ok: true, result: { rows: ["INQ-1"] } });
    assert.deepEqual([logged, handed], [[], [null]]);
    /* the body's `grant` is a route's argument, never the credential */
    handed.length = 0;
    const b = await go(store, "search?viewer=member:ann", { method: "POST", body: JSON.stringify({ grant: "SENTINEL-B" }) });
    assert.deepEqual([b.json.result, logged, handed], [{ rows: ["INQ-1"] }, [], [null]]);
    /* the header's: read, logged, handed; a query grant beside it is neither the one used nor logged as an argument */
    handed.length = 0;
    const h = await go(store, "search?grant=SENTINEL-Q&viewer=member:ann&q=x", { headers: { [GRANT_HEADER]: "SENTINEL-H" } });
    assert.deepEqual(h.json, { ok: true, result: { rows: ["INQ-1"], logged: true } });
    assert.deepEqual(handed, ["SENTINEL-H"]);
    assert.deepEqual(logged.map((e) => [e.grant, e.args]), [["SENTINEL-H", { q: "x" }]]);
    /* an empty header is no grant */
    logged.length = 0;
    await go(store, "search?viewer=member:ann", { headers: { [GRANT_HEADER]: "" } });
    assert.deepEqual(logged, []);
    assert.deepEqual(fetched, [], "the door made no request");
  } finally { globalThis.fetch = realFetch; }
  /* over a real record: askcheck reads the header's grant, never the query's — a query grant is checked as no grant */
  const r = await record();
  const viaHeader = await r.go("askcheck?viewer=member:ann", "POST", { answer: { sentences: [] } }, { [GRANT_HEADER]: "G-HEADER" });
  const viaQuery = await r.go("askcheck?grant=G-HEADER&viewer=member:ann", "POST", { answer: { sentences: [] } });
  assert.equal(viaHeader.json.ok, true);
  assert.equal(viaQuery.json.ok, true);
  assert.notDeepEqual(viaHeader.json.result, undefined);
  /* the door's own source of the grant handed to `controlPlaneRoutes`: its fourth argument, never the url */
  const seen = [];
  const { answersOf } = await import("../../../src/answers/index.mjs");
  const orig = answersOf(r.ctx).check;
  answersOf(r.ctx).check = (a) => { seen.push(a.grant); return orig.call(answersOf(r.ctx), a); };
  await r.go("askcheck?grant=G-QUERY&viewer=member:ann", "POST", { answer: { sentences: [] } }, { [GRANT_HEADER]: "G-HEADER" });
  await r.go("askcheck?grant=G-QUERY&viewer=member:ann", "POST", { answer: { sentences: [] } });
  assert.deepEqual(seen, ["G-HEADER", null]);
  answersOf(r.ctx).check = orig;
});

test("R9 (K2038, K2041): the headers `x-bio-session`, `x-bio-grant` and `x-bio-credential-sha` are handed to the owners' maps on the in-process URL — the session as `session` and `t`, the grant as `grant`, the digest as `sha`, each over the query's own — and none of them is logged among a read's arguments; with no header the URL is as the Worker sent it; over a real record, credentials' `session` and `aicredentiallook` and answers' `answercheck` read them unchanged", async () => {
  assert.deepEqual([SESSION_HEADER, GRANT_HEADER, CREDENTIAL_SHA_HEADER], ["x-bio-session", "x-bio-grant", "x-bio-credential-sha"]);
  const seen = [], logged = [];
  const store = { routes: (url) => ({ search: () => { seen.push(Object.fromEntries(url.searchParams)); return { rows: [] }; } }),
                  membership: () => ({ visibilityOf: () => "hidden", existenceAct: () => null }),
                  logRead: (e) => { logged.push(e); return e.answer; } };
  const H = { [SESSION_HEADER]: "S-H", [GRANT_HEADER]: "G-H", [CREDENTIAL_SHA_HEADER]: "D-H" };
  await go(store, "search?viewer=member:ann&q=x&session=S-Q&t=T-Q&grant=G-Q&sha=D-Q", { headers: H });
  assert.deepEqual(seen.at(-1), { viewer: "member:ann", q: "x", session: "S-H", t: "S-H", grant: "G-H", sha: "D-H" });
  assert.equal(logged.length, 1);
  assert.deepEqual(logged[0].grant, "G-H");
  for (const v of ["S-H", "D-H"]) assert.equal(JSON.stringify(logged[0].args).includes(v), false, `${v} logged`);
  /* negative control: no header, the URL is the Worker's, a parameter of the op's own (a capture session id) untouched */
  await go(store, "search?viewer=member:ann&session=CAPSESSION-1");
  assert.deepEqual(seen.at(-1), { viewer: "member:ann", session: "CAPSESSION-1" });
  assert.equal(logged.length, 1, "no grant header, nothing logged");
  /* over a real record, through the owners' own maps */
  const r = await record({ sealSecret: "store-door-test-seal-secret-00003" });
  const { credentialsOf, credentialsOps } = await import("../../../src/credentials/index.mjs");
  const { answersOf } = await import("../../../src/answers/index.mjs");
  const { answersOps } = await import("../../../src/answers/ops.mjs");
  const asked = [];
  const C = credentialsOf(r.ctx);
  const origSession = C.session.bind(C), origLook = C.aiCredentialLook.bind(C), origCheck = answersOf(r.ctx).check.bind(answersOf(r.ctx));
  C.session = (t) => { asked.push(["session", t]); return origSession(t); };
  C.aiCredentialLook = (a) => { asked.push(["look", a.secretSha]); return origLook(a); };
  answersOf(r.ctx).check = (a) => { asked.push(["check", a.grant]); return origCheck(a); };
  const owners = { routes: (url, body) => ({ ...credentialsOps(C, url, body, {}), ...answersOps(answersOf(r.ctx), url, body) }),
                   membership: () => null };
  for (const [path, headers] of [["session?t=T-QUERY", { [SESSION_HEADER]: "T-HEADER" }], ["aicredentiallook?sha=D-QUERY", { [CREDENTIAL_SHA_HEADER]: "D-HEADER" }],
                                 ["answercheck?viewer=member:ann&grant=G-QUERY", { [GRANT_HEADER]: "G-HEADER" }]])
    assert.equal((await go(owners, path, { method: "POST", headers, body: JSON.stringify({ answer: { sentences: [] } }) })).status, 200, path);
  assert.deepEqual(asked, [["session", "T-HEADER"], ["look", "D-HEADER"], ["check", "G-HEADER"]]);
});

test("R9 (T37; N761, K2129, K2175; credentials R53): a grant's `secretSha` reaches the owners' maps only in the internal request's body, handed on as it arrived; the door sets none on the in-process URL, adds none from any header, and removes one found in the query before any map receives the URL or the read log its arguments; over a real record, credentials' `aicredentialmint` reads the body's digest and never the query's (negative control: the query's other parameters reach the map unchanged)", async () => {
  assert.equal(D.SECRET_SHA_PARAM, "secretSha");
  const Q = "a".repeat(64), B = "b".repeat(64), H = "c".repeat(64);
  const seen = [], logged = [];
  const store = { routes: (url, body) => { seen.push({ at: "map", q: Object.fromEntries(url.searchParams), body });
                                           return { search: () => { seen.push({ at: "route", q: Object.fromEntries(url.searchParams) }); return { rows: [] }; } }; },
                  membership: () => ({ visibilityOf: () => "hidden", existenceAct: () => null }),
                  logRead: (e) => { logged.push(e); return e.answer; } };
  const body = { secretSha: B, limit: 5 };
  /* the query's digest removed, the body's handed as it arrived, no header turned into one */
  await go(store, `search?viewer=member:ann&q=x&secretSha=${Q}&secretSha=${Q}`, { method: "POST", body: JSON.stringify(body),
    headers: { [GRANT_HEADER]: "G-H", "x-bio-secret-sha": H, [CREDENTIAL_SHA_HEADER]: H } });
  assert.deepEqual(seen, [{ at: "map", q: { viewer: "member:ann", q: "x", grant: "G-H", sha: H }, body },
                          { at: "route", q: { viewer: "member:ann", q: "x", grant: "G-H", sha: H } }]);
  assert.deepEqual(logged.map((e) => e.args), [{ q: "x", secretSha: B, limit: 5 }], "the body's arguments as they arrived, the query's digest not among them");
  assert.equal(JSON.stringify([seen, logged]).includes(Q), false);
  /* negative control: no digest anywhere, the URL as the Worker sent it */
  seen.length = 0;
  await go(store, "search?viewer=member:ann&q=y");
  assert.deepEqual(seen[0].q, { viewer: "member:ann", q: "y" });
  /* over a real record: aicredentialmint mints under the body's digest; a query digest alone mints nothing it could find */
  const r = await record({ sealSecret: "store-door-test-seal-secret-00004" });
  const { credentialsOf, credentialsOps } = await import("../../../src/credentials/index.mjs");
  const C = credentialsOf(r.ctx);
  const minted = [];
  const orig = C.aiCredentialMint.bind(C);
  C.aiCredentialMint = (a) => { minted.push(a.secretSha); return orig(a); };
  const owners = { routes: (url, b) => credentialsOps(C, url, b, {}), membership: () => null };
  await go(owners, `aicredentialmint?who=member:ann&secretSha=${Q}`, { method: "POST", body: JSON.stringify({ secretSha: B }) });
  await go(owners, `aicredentialmint?who=member:ann&secretSha=${Q}`, { method: "POST", body: JSON.stringify({}) });
  assert.deepEqual(minted, [B, null]);
});

test("R11 (K1674; answers R1, R2, R7): a read the store serves under a grant is handed to `store.logRead` with its grant, op, arguments (query and body, the stamped viewer and any query grant aside), answer and viewer, and answered as logged; no grant, `rule` (which records its own) and an op off the asking scope are answered as served; a store that cannot log is R6's internal error, never an unlogged answer", async () => {
  const logged = [];
  const store = (logRead) => ({
    routes: () => ({ search: () => ({ rows: ["INQ-1", "MTI-2026-0001"] }), rule: () => ({ value: 1 }), askceiling: () => ({ ok: true }) }),
    membership: () => ({ visibilityOf: () => "hidden", existenceAct: () => null }), ...(logRead ? { logRead } : {}) });
  const logging = store((e) => { logged.push(e); return { rows: ["INQ-1"], scrubbed: true }; });
  const G = { [GRANT_HEADER]: "G1" };
  assert.equal(askAdmits("search"), true);
  assert.equal(askAdmits("askceiling"), false);
  const a = await go(logging, "search?viewer=member:ann&q=x", { method: "POST", headers: G, body: JSON.stringify({ limit: 5 }) });
  assert.deepEqual(a.json, { ok: true, result: { rows: ["INQ-1"], scrubbed: true } });
  assert.deepEqual(logged, [{ grant: "G1", op: "search", args: { q: "x", limit: 5 }, answer: { rows: ["INQ-1", "MTI-2026-0001"] }, viewer: "member:ann" }]);
  for (const [path, headers] of [["search?viewer=member:ann&q=x", {}], ["rule?viewer=member:ann", G], ["askceiling?viewer=member:ann", G]]) {
    const r = await go(logging, path, { headers });
    assert.equal(r.json.ok, true, path);
    assert.equal(r.json.result.scrubbed, undefined, path);
  }
  assert.equal(logged.length, 1);
  const { value: lost } = await quietly(() => go(store(null), "search?viewer=member:ann", { headers: G }));
  assert.deepEqual([lost.status, lost.json.reason], [500, "STORE_INTERNAL_ERROR"]);
  assert.equal(JSON.stringify(lost.json).includes("MTI-"), false, "nothing unlogged is answered");
  const { value: thrown } = await quietly(() => go(store(() => { throw new Error("log full"); }), "search?viewer=member:ann", { headers: G }));
  assert.deepEqual([thrown.status, thrown.json.reason], [500, "STORE_INTERNAL_ERROR"]);
});

test("R11 (K2574; plane R33): the door adds no `use` to a read's entry — which use a grant's reads carry is the plane's `logRead` — so the entry is the grant, op, arguments, answer and viewer alone, whatever else the store holds (negative control: over a real record answers' read log opens under `ask` when no use is passed)", async () => {
  const logged = [];
  const store = { routes: () => ({ search: () => ({ rows: [] }) }), membership: () => ({ visibilityOf: () => "hidden", existenceAct: () => null }),
                  logRead: (e) => { logged.push(e); return e.answer; }, grantUse: () => "draft" };
  await go(store, "search?viewer=member:ann&q=x", { headers: { [GRANT_HEADER]: "G-D" } });
  assert.deepEqual(logged.map((e) => Object.keys(e).sort()), [["answer", "args", "grant", "op", "viewer"]]);
  const r = await record();
  const { answersOf } = await import("../../../src/answers/index.mjs");
  const A = answersOf(r.ctx);
  await go({ ...store, logRead: (e) => A.logRead(e) }, "search?viewer=member:ann&q=x", { headers: { [GRANT_HEADER]: "G-A" } });
  assert.equal(A.readLog("G-A").use, "ask");
});

test("R11 (K2585; control-plane R72; capture R86): `captureupload`'s POST body is handed to the route map unread, as the request's own stream — never JSON-parsed or refused BAD_JSON — and its bytes reach the route unchanged (negative control: the same bytes on any other op are BAD_JSON)", async () => {
  assert.ok(D.STREAMED_BODY_OPS.includes("captureupload"));
  const BYTES = new Uint8Array([0x7b, 0x00, 0xff, 0x25, 0x50, 0x44, 0x46, 0x0a]);
  const got = [];
  const store = { membership: () => null,
// fixtures-own: input a route map handed to the door under test; the route reads the body the door hands it
    routes: (url, body) => ({ captureupload: async () => {
      got.push({ stream: body instanceof ReadableStream, locked: body.locked, by: url.searchParams.get("by") });
      return { ok: true, bytes: [...new Uint8Array(await new Response(body).arrayBuffer())] };
    }, other: () => ({ ok: true }) }) };
  const r = await go(store, "captureupload?by=member:ann&statement=s", { method: "POST", body: BYTES });
  assert.deepEqual([r.status, r.json], [200, { ok: true, result: { ok: true, bytes: [...BYTES] } }]);
  assert.deepEqual(got, [{ stream: true, locked: false, by: "member:ann" }]);
  const n = await go(store, "other", { method: "POST", body: BYTES });
  assert.deepEqual([n.status, n.json.reason], [400, "BAD_JSON"]);
});

test("R19 (fix round 9, G127f; K4928; capture R113, control-plane R72): every op of STREAMED_BODY_OPS — `captureupload` and `captureuploadpart` — is handed its POST body as the request's own stream, unread, so binary bytes that are not JSON reach the arm as its `bytes` and are never refused BAD_JSON (negative control: a JSON op's body is parsed as before, and the same bytes on any op outside the list are BAD_JSON)", async () => {
  assert.deepEqual([...D.STREAMED_BODY_OPS].sort(), ["captureupload", "captureuploadpart"]);
  const BYTES = new Uint8Array([0x7b, 0x00, 0xff, 0x25, 0x50, 0x44, 0x46, 0x0a]);
  const got = [];
  const arm = (name) => async (url, body) => {
    got.push({ name, stream: body instanceof ReadableStream, locked: body.locked, part: url.searchParams.get("part") });
    return { ok: true, bytes: [...new Uint8Array(await new Response(body).arrayBuffer())] };
  };
  const store = { membership: () => null,
    routes: (url, body) => ({ captureupload: () => arm("captureupload")(url, body),
      captureuploadpart: () => arm("captureuploadpart")(url, body),
      json: () => ({ ok: true, echoed: body }), other: () => ({ ok: true }) }) };
  for (const op of D.STREAMED_BODY_OPS) {
    const r = await go(store, op + "?by=member:ann&part=2", { method: "POST", body: BYTES });
    assert.deepEqual([r.status, r.json], [200, { ok: true, result: { ok: true, bytes: [...BYTES] } }], op);
  }
  assert.deepEqual(got.map((g) => [g.name, g.stream, g.locked]), [["captureupload", true, false], ["captureuploadpart", true, false]]);
  const j = await go(store, "json", { method: "POST", body: JSON.stringify({ a: 1 }) });
  assert.deepEqual([j.status, j.json], [200, { ok: true, result: { ok: true, echoed: { a: 1 } } }]);
  const n = await go(store, "other", { method: "POST", body: BYTES });
  assert.deepEqual([n.status, n.json.reason], [400, "BAD_JSON"]);
});

test("R11 (K1674, K1685, K1798, K1986; T41: K2400, K2500, K2514; credentials R28; answers R30, R4; ai-use R1): the ask's store-internal routes, each its owner's with the member the stamped viewer — `aigrantadmit` answers credentials' own words; `askceiling` answers `answers.askAccount({member, kind: \"ask\"})`'s refusal as given (NO_ACCOUNT, AI_KEPT_AWAY, AI_USE_SWITCHED_OFF, AI_LIMIT_REACHED) and `{ok: true}` when an account serves under its limits; `askusage` counts through ai-use's `countAskUsage` with the mode it is given (`ask` when none; ai-use refuses one that is neither `ask` nor `draft`) and the ask's `calls`, to the paying account `credentials.accountFor` answers for that mode (\"not recorded\" when none serves); `askcheck` answers' check over the grant's read log (negative control: a name no module serves is R1's refusal)", async () => {
  const r = await record({ sealSecret: "store-door-test-seal-secret-00005" });
  const { credentialsOf } = await import("../../../src/credentials/index.mjs");
  const { aiAccountsOf } = await import("../../../src/ai-accounts/index.mjs");
  const { membershipOf } = await import("../../../src/membership/index.mjs");
  const { answersOf } = await import("../../../src/answers/index.mjs");
  const { aiUseOf } = await import("../../../src/ai-use/index.mjs");
  const C = credentialsOf(r.ctx), U = aiUseOf(r.ctx), A = answersOf(r.ctx);
  await C.claim({ password: "founder-passphrase-1", tokenFp: "fp-1" });
  for (const [id, role] of [["ann", "admin"], ["bea", "member"]]) {
    const m = await membershipOf(r.ctx).memberAdd({ memberId: id, cover: `cover of ${id}`, role, capabilities: null, by: "admin" });
    await membershipOf(r.ctx).enroll({ invite: m.invite, handle: id, password: `${id}-passphrase-x` });
  }
  const a = await r.go("aigrantadmit", "POST", { token: "f".repeat(64), op: "search", write: false });
  assert.deepEqual([a.status, a.json.ok, a.json.result.ok, a.json.result.reason], [200, true, false, "GRANT_NOT_HELD"]);
  const u0 = await r.go("aigrantnothing", "POST", {});
  assert.deepEqual([u0.status, u0.json.error], [400, "unknown op: aigrantnothing"]);
  /* askceiling: askAccount for an ask, the member the stamped viewer, whatever the body names */
  const asked = [];
  const askAccount = A.askAccount.bind(A);
  A.askAccount = (x) => { asked.push(x); return askAccount(x); };
  const ceiling = async () => (await r.go("askceiling?viewer=member:ann", "POST", { member: "member:bea", kind: "draft" })).json.result;
  const none = await ceiling();
  assert.deepEqual([none.ok, none.reason], [false, "NO_ACCOUNT"]);
  assert.deepEqual(asked, [{ member: "member:ann", kind: "ask" }]);
  assert.equal((await aiAccountsOf(r.ctx).accountReferenceSet({ member: "member:ann", kind: "apikey", secret: "sk-ann-own", by: "member:ann" })).ok, true);
  assert.deepEqual(await ceiling(), { ok: true }, "an account serves under its limits: {ok: true}");
  assert.equal(C.accountUsesSet({ owner: "member:ann", switch: "ask", on: false, by: "member:ann" }).ok, true);
  assert.equal((await ceiling()).code, "AI_USE_SWITCHED_OFF");
  assert.equal(C.accountUsesSet({ owner: "member:ann", switch: "ask", on: true, by: "member:ann" }).ok, true);
  assert.equal(C.aiKeepAwaySet({ on: true, reason: "kept away for this test", uses: ["ask"], by: "ann" }).ok, true);
  assert.deepEqual(await ceiling(), C.aiKeptAway({ use: "ask" }));
  assert.equal(C.aiKeepAwaySet({ on: false, by: "ann" }).ok, true);
  A.askAccount = askAccount;
  /* askusage: counted to the paying account, the member the stamped viewer, the mode the body's */
  const USE = { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0, cache_creation_input_tokens: 0, total_cost_usd: null };
  const rows = () => r.db.prepare("SELECT owner, member, mode, SUM(calls) calls FROM ai_usage GROUP BY owner, member, mode ORDER BY member, mode").all().map((x) => ({ ...x }));
  const u = await r.go("askusage?viewer=member:ann", "POST", { usage: USE });
  assert.deepEqual([u.json.ok, u.json.result.ok, u.json.result.counted, u.json.result.owner], [true, true, 1, "member:ann"], JSON.stringify(u.json).slice(0, 300));
  const run = await r.go("askusage?viewer=member:ann", "POST", { mode: "run", usage: USE });
  assert.deepEqual([run.json.result.ok, run.json.result.code], [false, "AI_RUN_CONSUME_INVALID"], "a run's mode is not an ask's use");
  const draft = await r.go("askusage?viewer=member:bea", "POST", { mode: "draft", usage: USE });
  assert.deepEqual([draft.json.result.ok, draft.json.result.owner], [true, "not recorded"], "no account serves bea: counted toward no limit");
  assert.equal((await r.go("askusage?viewer=member:ann", "POST", { usage: USE, calls: 3 })).json.result.ok, true);
  assert.equal((await r.go("askusage?viewer=member:ann", "POST", { usage: USE, calls: 0 })).json.result.ok, false);
  assert.equal((await r.go("askusage?viewer=member:ann", "POST", { usage: { input_tokens: "lots" } })).json.result.ok, false);
  assert.equal((await r.go("askusage", "POST", { usage: USE })).json.result.ok, false, "no member, nothing counted");
  assert.deepEqual(rows(), [{ owner: "member:ann", member: "ann", mode: "ask", calls: 4 }, { owner: "not recorded", member: "bea", mode: "draft", calls: 1 }],
                   "an ask of three calls counts three; a refused use counts nothing");
  /* what askusage counted is what askceiling judges: the account's limit reached refuses the next ask */
  assert.equal(U.aiLimitSet({ owner: "member:ann", scope: "overall", unit: "calls", period: "day", amount: 4, by: "member:ann" }).ok, true);
  const lim = await ceiling();
  assert.deepEqual([lim.ok, lim.code, lim.scope], [false, "AI_LIMIT_REACHED", "overall"]);
  /* askcheck */
  const c = await r.go("askcheck?viewer=member:ann", "POST", { answer: { sentences: [] } }, { [GRANT_HEADER]: "G1" });
  assert.equal(c.status, 200, JSON.stringify(c.json).slice(0, 300));
  assert.equal(c.json.ok, true);
  assert.ok(c.json.result && typeof c.json.result === "object", JSON.stringify(c.json).slice(0, 300));
});

test("R13 (K2157; control-plane R61): a route-map answer that is a `Response` — file-safety's byte answers `openoriginal`, `openwithwarning`, `safeview`, `safecopy` — is returned as given, its status, headers and bytes unchanged, never wrapped in R1's envelope, under an ask's grant header too (nothing logged); a refusal those routes answer as an object is enveloped as any answer (negative control: a plain object answer is wrapped)", async () => {
  const { fileSafetyOps } = await import("../../../src/file-safety/index.mjs");
  const served = new Set(Object.keys(fileSafetyOps(null, new URL("http://do/"), null, null)));
  const BYTES = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x00, 0xff, 0x10]);
  for (const op of ["openoriginal", "openwithwarning", "safeview", "safecopy"]) {
    assert.ok(served.has(op), `${op} is file-safety's route`);
    for (const status of [200, 206]) {
      const made = [];
      const logged = [];
      const store = {
        routes: () => ({ [op]: async () => { const r = new Response(BYTES, { status, headers: { "content-type": "application/pdf",
          "x-capture-sha256": "a".repeat(64), "cache-control": "no-store" } }); made.push(r); return r; } }),
        membership: () => ({ visibilityOf: () => "discoverable", existenceAct: () => null }),
        logRead: (e) => { logged.push(e); return e.answer; },
      };
      const res = await D.dispatch(new Request(`http://do/${op}?viewer=member:ann&capture=${"a".repeat(64)}`,
        { method: "POST", headers: { [GRANT_HEADER]: "G1" }, body: JSON.stringify({ warned: { own_device: true, no_macros: true } }) }), store);
      assert.equal(res, made[0], `${op}: the owner's Response itself`);
      assert.equal(res.status, status);
      assert.deepEqual([res.headers.get("content-type"), res.headers.get("x-capture-sha256"), res.headers.get("cache-control")],
                       ["application/pdf", "a".repeat(64), "no-store"]);
      assert.deepEqual(new Uint8Array(await res.arrayBuffer()), BYTES, `${op}: the bytes unchanged`);
      assert.deepEqual(logged, [], `${op}: nothing logged`);
    }
    /* a refusal answered as an object is enveloped; negative control */
    const refused = await go({ routes: () => ({ [op]: () => ({ ok: false, reason: "SCAN_HOLD" }) }), membership: () => null }, `${op}?viewer=member:ann`);
    assert.deepEqual([refused.status, refused.json], [200, { ok: true, result: { ok: false, reason: "SCAN_HOLD" } }]);
  }
});

/* control-plane-store-request R64: a secret's digest reaches the store only in the body of the store's internal request, never
   its query. Driven through the real door (`makeFetch`, control-plane's harness world) for each of the ten ops R64 names: the
   seven grant doors where a recipient presents a sentinel secret, and the three that generate a secret. The store answers each
   route through its owner's own ops map (`reviewOps`, `caseInputsOps`, `filingTemplatesOps`, `credentialsOps`) over an
   instance that records the digest the map handed it, so "the owner admits it as before" is the owner's own reading: a digest
   the door put anywhere but the body would reach the owner as null. Control: the same maps read no digest from the address. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, call, opCalls, sha, hex64, FORGED } from "../control-plane/harness.mjs";
const { reviewOps } = await import("../../../src/review/index.mjs");
const { caseInputsOps } = await import("../../../src/case-inputs/index.mjs");
const { filingTemplatesOps } = await import("../../../src/filing-templates/index.mjs");
const { credentialsOps } = await import("../../../src/credentials/index.mjs");

const SECRET = "rv1_R64-sentinel-control-plane-store-request";
const PRESENTED = ["reviewcopy", "reviewcomment", "statementack", "templateread", "templatecomments", "templatereview", "templatecomment"];
const GENERATED = ["reviewgrant", "templatereviewgrant", "aicredentialmint"];
const ALL = [...PRESENTED, ...GENERATED];

/* each owner's map, over an instance whose every method records the digest it was handed */
function ownersOf(url, body, seen) {
  const rec = (route) => (a) => { seen.push({ route, secretSha: a?.secretSha ?? null }); return { ok: true, route }; };
  return [
    reviewOps({ act: (a) => rec(`review:${a.act}`)(a), copy: rec("reviewcopy"), comment: rec("reviewcomment"), list: rec("casedrafts") }, url, body),
    caseInputsOps({ acknowledgeStatement: rec("statementack") }, url, body),
    filingTemplatesOps({ templateRead: rec("templateread"), templateComments: rec("templatecomments"), templateReview: rec("templatereview"),
                         templateComment: rec("templatecomment"), templateReviewGrant: rec("templatereviewgrant") }, url, body),
    credentialsOps({ aiCredentialMint: (a) => { rec("aicredentialmint")(a); return { ok: true, tokenId: "agent-1" }; } }, url, body, {}),
  ];
}

test("R64: for each op whose secret's digest the door computes or generates, the digest reaches the store in the internal request's body only, never in any address or header of a request the plane makes, and the owner's own map admits it; a caller's own `secretSha` and `bySecret` never reach it", async () => {
  for (const op of ALL) {
    const seen = [];
    const answer = (c) => {
      const map = ownersOf(c.url, c.body, seen).find((m) => Object.hasOwn(m, c.route));
      return ALL.includes(c.route) && map ? new Response(JSON.stringify({ ok: true, result: map[c.route]() })) : null;
    };
    const w = world({ answer });
    const presents = PRESENTED.includes(op);
    const r = await call(w.env, {
      op, method: "POST",
      ...(presents ? {} : { token: op === "reviewgrant" ? w.S.founder : w.S.ann }),
      params: { draft: "D1", version: "TPL-1@1", secretSha: hex64(), bySecret: "0", ...(presents ? { secret: SECRET } : {}) },
      body: { draft: "D1", version: "TPL-1@1", text: "t", reason: "r", writes: [], secretSha: hex64(), bySecret: "1", viewer: FORGED },
    });
    assert.equal(r.status, 200, `${op}: ${r.text.slice(0, 300)}`);
    const digest = presents ? sha(SECRET) : sha(op === "aicredentialmint" ? r.json.result.token : r.json.result.secret);

    const inner = opCalls(w.env).filter((c) => c.route === op);
    assert.equal(inner.length, 1, op);
    assert.equal(inner[0].body.secretSha, digest, `${op}: the digest is in the body`);
    assert.equal(inner[0].params.secretSha, undefined, `${op}: no digest in the query`);

    const read = seen.filter((s) => s.route === op || s.route === "review:grant");
    assert.deepEqual(read.map((s) => s.secretSha), [digest], `${op}: the owner admits the door's digest, as before`);

    for (const c of [...w.env.calls, ...w.env.windowCalls, ...w.env.countCalls]) {
      assert.equal(c.url.href.includes(digest), false, `${op}: no digest in the address of ${c.route}`);
      assert.equal(c.url.href.includes(SECRET), false, `${op}: no secret in the address of ${c.route}`);
      assert.equal(JSON.stringify(c.headers ?? {}).includes(digest), false, `${op}: no digest in the headers of ${c.route}`);
    }
  }
});

test("R64 (control): the owners' maps read no digest from the address, so a door that put one there would not be admitted", () => {
  const digest = sha(SECRET);
  for (const op of ALL) {
    const seen = [];
    const url = new URL(`http://do/${op}?draft=D1&version=TPL-1@1&bySecret=1&secretSha=${digest}`);
    const map = ownersOf(url, {}, seen).find((m) => Object.hasOwn(m, op));
    map[op]();
    assert.ok(seen.length >= 1, op);
    assert.equal(seen.every((s) => s.secretSha === null), true, `${op}: a query digest is never read`);
  }
});

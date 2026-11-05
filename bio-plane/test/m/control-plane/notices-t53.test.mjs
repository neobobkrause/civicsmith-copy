/* control-plane: the provider notices of T53's account ops, held at this module's door (R2, R53; R136; R75).
   - store-request:133 (its R3, R9; `projectkeyset`'s body-only `key` left with the retired op) and admission:171 (its R19,
     R20; `groupkeyset`'s row left BODY_ONLY_FIELDS): the team's account act that replaced both, `aiaccountadd`, carries its
     credential as the body's `secret`. At the door a `secret` in the address is refused before any store request; in the
     body it reaches the store's own route with no secret in the address. The retired ops are refused as ops with no spec.
   - screens-entry:170 (its setup screen acts `aiaccountadd`/`aiaccountswitch` and reads `accountsof`): the door's
     `GET /app/setup` is interface-shell's page over every screen module, served (the shell's `checkScreens` accepts them).
   - answers:103 (its R1: `ASK_SCOPE` is `AI_GRANT_OPS` less `aicredential`): this door reads neither list; which reads an
     ask may make is answers' and admission's to judge, so nothing here changes (confirmed by reading the door's source). */
import "./register-declared.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { world, call, opCalls, refused, hex64 } from "./harness.mjs";

const SECRET = "sk-ant-api03-" + hex64();

test("notice store-request:133, admission:171: aiaccountadd's secret in the address is refused CREDENTIAL_IN_ADDRESS before any store request; in the body it reaches the store's aiaccountadd with no secret in the address", async () => {
  const { env, S } = world();
  env.calls.length = 0;
  const q = await call(env, { op: "aiaccountadd", token: S.founder, method: "POST", params: { secret: SECRET, owner: "group" }, secretIn: "query" });
  refused(q, 400, "CREDENTIAL_IN_ADDRESS", "C-38.10");
  assert.equal(q.text.includes(SECRET), false, "the secret is in no refusal");
  assert.deepEqual(opCalls(env), [], "nothing asked of the store");
  const b = await call(env, { op: "aiaccountadd", token: S.founder, method: "POST", params: { owner: "group" },
                              body: { owner: "group", provider: "anthropic", means: "sealed", secret: SECRET } });
  const reached = opCalls(env).filter((c) => c.route === "aiaccountadd");
  assert.equal(reached.length, 1, b.text.slice(0, 300));
  assert.equal(JSON.stringify(reached[0].params).includes(SECRET), false, "no secret in the store's address");
});

test("notice store-request:133, admission:171: the retired projectkeyset and groupkeyset are refused as ops with no spec (400 UNKNOWN_OP), nothing asked of the store, the key in no answer", async () => {
  const { env, S } = world();
  for (const op of ["projectkeyset", "groupkeyset"]) {
    env.calls.length = 0;
    const r = await call(env, { op, token: S.founder, method: "POST", body: { key: SECRET, project: "P" } });
    refused(r, 400, "UNKNOWN_OP", "C-69.1");
    assert.equal(r.text.includes(SECRET), false, op);
    assert.deepEqual(opCalls(env), [], `${op}: nothing asked of the store`);
  }
});

test("notice screens-entry:170: the door's page builder (appPage, R75) draws screens-entry's screens as they are now, setup's T53 acts (aiaccountadd, aiaccountswitch) among them, at 200 text/html", async () => {
  const { appPage } = await import("../../../src/control-plane/app.mjs");
  const { interfacePage } = await import("../../../src/interface-shell/index.mjs");
  const { SCREENS } = await import("../../../src/screens-entry/index.mjs");
  const acts = SCREENS.find((s) => s.id === "setup").acts.map((a) => a.op);
  for (const op of ["aiaccountadd", "aiaccountswitch"]) assert.ok(acts.includes(op), op);
  const r = appPage(new Request("https://plane.example/app/setup"), { interfacePage, screens: SCREENS, options: { version: "test" } });
  assert.equal(r.status, 200);
  assert.match(r.headers.get("content-type"), /^text\/html/);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.ok((await r.text()).length > 0);
});

test("notice screens-entry:170, screens-daily:281, screens-inquiry:173: GET /app/setup is served through the whole door over all nine screen modules (interface-shell's checkScreens accepts them: no screen acts a retired op)", async () => {
  const { env, S } = world();
  const r = await call(env, { path: "/app/setup", token: S.founder, headers: { accept: "text/html" } });
  assert.equal(r.status, 200, r.text.slice(0, 300));
  assert.match(r.headers.get("content-type") || "", /text\/html/);
});

test("notice answers:103: the door admits an ask's grant by credentials' AI_GRANT_OPS (R53), never by answers' ASK_SCOPE: aicredential, off the ask's scope since PR 103 and on the grant's list for the agent Worker (ai-accounts R65), is still asked of credentials' aigrantadmit; an op on neither is not", async () => {
  const dir = new URL("../../../src/control-plane/", import.meta.url);
  for (const f of readdirSync(dir).filter((n) => n.endsWith(".mjs"))) {
    const text = readFileSync(new URL(f, dir), "utf8");
    assert.equal(/\bASK_SCOPE\b|\baskAdmits\b|from "\.\.\/answers\//.test(text), false, `${f} reads no list of answers'`);
  }
  const { env } = world();
  const grant = hex64();
  const admitted = async (op) => {
    env.calls.length = 0;
    await call(env, { op, token: grant, params: { account_id: "acct-1" } });
    return env.calls.filter((c) => c.route === "aigrantadmit").length;
  };
  assert.equal(await admitted("aicredential"), 1, "aicredential is judged against the grant (credentials' list)");
  assert.equal(await admitted("search"), 1, "control: an ask's read is judged too");
  assert.equal(await admitted("memberset"), 0, "control: an op on no grant's list asks nothing");
});

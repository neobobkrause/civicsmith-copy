/* control-plane R81, R75 (BOB's found mark, 7 Nov; screens-ai PR 881): the door's member interface is served over screens-ai's
   SCREENS beside the nine screen modules R81 names. Through the whole door: `GET /app/<id>` for each of screens-ai's screens
   answers the interface page, and the shell's script that page names (R75) carries that screen. The screen ids are read from
   screens-ai's own export, never listed here (K3268). Fails with screens-ai's SCREENS left out of the door's APP_SCREENS. */
import "./register-declared.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { world, call } from "./harness.mjs";
import { SCREENS as AI_SCREENS } from "../../../src/screens-ai/index.mjs";

test("found mark (screens-ai PR 881; R81, R75): each of screens-ai's screens is served by the door: GET /app/<id> answers the interface page, and the shell's script it names carries the screen", async () => {
  assert.ok(AI_SCREENS.length > 0, "screens-ai exports its screens");
  const { env, S } = world();
  for (const { id } of AI_SCREENS) {
    const page = await call(env, { path: `/app/${id}`, token: S.founder, headers: { accept: "text/html" } });
    assert.equal(page.status, 200, `${id}: ${page.text.slice(0, 200)}`);
    assert.match(page.headers.get("content-type") || "", /text\/html/, id);
    const src = /<script\b[^>]*\ssrc="([^"]+)"/.exec(page.text)?.[1];
    assert.ok(src, `${id}: the page names the shell's script`);
    const script = await call(env, { path: src, token: S.founder });
    assert.equal(script.status, 200, `${id}: the script is served`);
    assert.ok(script.text.includes(JSON.stringify(id)), `${id}: the shell's script carries screens-ai's screen`);
  }
});

test("found mark (control): a screen id no module exports is not in the shell's script", async () => {
  const { env, S } = world();
  const page = await call(env, { path: "/app/home", token: S.founder, headers: { accept: "text/html" } });
  const src = /<script\b[^>]*\ssrc="([^"]+)"/.exec(page.text)?.[1];
  const script = await call(env, { path: src, token: S.founder });
  assert.equal(script.text.includes(JSON.stringify("ainonesuchscreen")), false);
});

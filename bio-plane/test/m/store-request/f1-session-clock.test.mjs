/* store-request F1: a world member's session record must not run out against the real clock. The world signs members in on its fixed
   clock; the shell keeps the record and reads it live while its expiry is none or later than the real now (interface-shell R32). */
import "../../sandbox.mjs";
import { test } from "node:test";
import assert from "node:assert/strict";
import { storeWorld } from "./fixtures.mjs";

const resultOf = (a) => (a.json && a.json.result !== undefined ? a.json.result : a.json);
/* interface-shell R32's reading of a kept record: live while `e` is none or later than now */
const liveAt = (s, now) => !!(s && typeof s.t === "string" && s.t && (!s.e || s.e > now));

test("F1: a world member's session record reads as signed in whatever the real date is; the plane still judges the token by the world's clock", async () => {
  const w = await storeWorld();
  const realNow = Date.now;
  try {
    for (const [handle, o] of [["admin", {}], ["ruth", {}], ["olive", { admin: true }]]) {
      const me = await w.signIn(handle, o);
      for (const when of [realNow(), Date.parse("2026-10-31T00:00:00Z"), Date.parse("2031-01-01T00:00:00Z"), Date.parse("2099-12-31T00:00:00Z")]) {
        Date.now = () => when;
        assert.equal(liveAt(me.session, Date.now()), true, `${handle}'s record at ${new Date(when).toISOString()}`);
        assert.deepEqual(w.boot(me).session, me.session);
        Date.now = realNow;
      }
      /* the plane's own expiry rule is unchanged: the token is admitted on the world's clock */
      assert.equal(resultOf(await w.door({ url: "/api/?op=whoami" }, me)).member, me.member, handle);
    }
  } finally { Date.now = realNow; }
});

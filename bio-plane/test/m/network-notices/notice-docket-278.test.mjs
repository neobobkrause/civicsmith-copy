/* network-notices: the provider notice docket:278 (docket R33, PR 278). `docket.docketRecordEdition` now files a
   ratified edition's docket entry signed by the case's manager (the ratification ceremony carries the signature,
   `ratification` F1). R21 lists every key that signed a public docket entry through `docket.docketSigners` (its R5);
   this confirms an edition entry filed by the real `docketRecordEdition` reaches R21 like any other public entry, and
   stays listed once its signer owns nothing. No code change was needed. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { seeded, keyFor, V, sign } from "./fixture.mjs";
import { NS_DOCKET } from "../../../src/sshsig.mjs";

const CASE = "CASE-2026-0001-budget";

test("R21 owners (notice docket:278): a key that signed an edition's docket entry through docket.docketRecordEdition (docket R33) is listed, and stays listed once its member owns nothing; control: an owner who signed nothing drops off", async () => {
  const w = seeded();
  w.member("erin");
  w.member("frank");
  const R = w.project("ledger", "erin");
  w.join(R, "frank", "joined", true);
  const listed = () => new Set(w.nn.groupKeysPublic().owners.map((o) => o.key));
  const line = (who) => `ssh-ed25519 ${keyFor(who).b64}`;
  assert.ok(listed().has(line("erin")) && listed().has(line("frank")), "both listed while they own R");
  w.publish(R, CASE, 1);
  /* the real two-step act: prepare, then file with the manager's signature in the docket namespace */
  const p = await w.docket.docketRecordEdition({ case: CASE, edition: 1 });
  assert.equal(p.prepared, true, JSON.stringify(p).slice(0, 300));
  const f = await w.docket.docketRecordEdition({ case: CASE, edition: 1, digest: p.digest, signature: sign(p, "erin", NS_DOCKET), by: V("erin") });
  assert.equal(f.filed, true, JSON.stringify(f).slice(0, 300));
  assert.deepEqual(w.docket.docketSigners().map((s) => s.keyB64), [keyFor("erin").b64]);
  /* neither owns a project any more */
  w.join(R, "erin", "joined", false);
  w.join(R, "frank", "joined", false);
  assert.ok(listed().has(line("erin")), "erin signed the edition's docket entry: still listed");
  assert.equal(w.nn.groupKeysPublic().owners.filter((o) => o.key === line("erin")).length, 1, "listed once");
  assert.equal(w.nn.groupKeysPublic().owners.find((o) => o.key === line("erin")).status, "attests");
  assert.ok(!listed().has(line("frank")), "control: frank signed nothing and owns nothing");
});

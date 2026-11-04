/* store-assembly: the provider notice case-tensions:262 (PR 262; case-grammar:202). Confirmed, no code change: PR 262 changes
   only how case-tensions re-authors an unsigned document's attribution body (in the words of the document's own format,
   case-grammar R33), inside its own `attribute` act. The assembly's part is unchanged: it composes the one case-tensions
   instance publication's factory makes, holding publication's provider (R22), and routes `attribute` and `caseflags` to that
   instance's own arms (R6, R20), handing no format and spelling nothing itself (R97). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { store } from "./fixture.mjs";
import { caseTensionsOf, caseTensionsOps } from "../../../src/case-tensions/index.mjs";

const strip = (v) => JSON.parse(JSON.stringify(v ?? null));

test("notice case-tensions:262 (R6, R20, R22): through the assembled store the `attribute` act is case-tensions' own arm on the one instance holding publication's provider, answered as the owner answers it; control: a second provider is refused", async () => {
  const x = await store();
  const ct = caseTensionsOf(x.ctx);
  assert.deepEqual(ct.publicationProvider(), { registered: true, module: "publication" });
  const body = { caseId: "CASE-2026-0001", edition: 1, observation: "obs-none", level: "project", reason: "the project speaks for these words" };
  const u = new URL("http://do/attribute?by=member:ann");
  const viaStore = strip(await x.s.routes(u, body).attribute());
  const viaOwner = strip(await caseTensionsOps(ct, u, body).attribute());
  assert.equal(viaStore.ok, false, JSON.stringify(viaStore));
  assert.deepEqual(viaStore, viaOwner, "the owner's answer, unchanged by the assembly");
  /* control: the instance the store routes to is the one instance; a second provider is refused, publication's stands */
  assert.equal(caseTensionsOf(x.ctx), ct);
  assert.equal(ct.registerPublicationProvider("zz-probe", {}).ok, false);
});

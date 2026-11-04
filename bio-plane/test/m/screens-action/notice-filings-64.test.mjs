/* screens-action, provider notice filings:64 (`filings` R29, R71, PR 64): a filing now records the layer of every rule it rests on, in
   its blanks' sources (`profile:<layer>/...`) and its venue (`layer`), and a profile template's `template` gains `layer`. This module
   draws a draft's blanks by their `source` as the owner gives it and reads `template` only as present or not (`draftOf`, R3, R11), so
   nothing here changes; this asserts that, over the REAL `filings`: the layered source is drawn as the draft records it. */
import test from "node:test";
import assert from "node:assert/strict";
import { text, W } from "./page.mjs";
import { realWorld, realPlane, open, until, V } from "./real.mjs";
import { combine } from "../../../../jurisdictions/index.mjs";

test("notice filings:64 R11 R3: a records request's prepared draft is read again on start-send, its venue blanks drawn with the layered source filings records (profile:<layer>/action_kinds/records_request/venue), never the profile's id; nothing is prepared again by reading", async () => {
  const x = realWorld("oakland-alameda");
  const layer = combine(["oakland-alameda"]).view.action_kinds.find((k) => k.kind === "records_request").venue.layer;
  assert.ok(layer && layer !== "oakland-alameda", "the package's view names the layer that holds the venue");
  const A = x.action({ kind: "records_request", risk_tier: 1, law: "Cal. Gov. Code § 7922.530" });
  const d = x.f.filingPrepare({ action: A, preparer: V("olive"), viewer: V("olive"), text: "Filed at {{venue}} by {{venue_how}}." });
  assert.equal(d.ok, true, JSON.stringify(d).slice(0, 300));
  const src = `profile:${layer}/action_kinds/records_request/venue`;
  const venue = d.blanks.find((b) => b.name === "venue");
  assert.equal(venue.source, src, "filings records the layer as the source's id");
  const plane = realPlane(x, V("olive"));
  const p = await open(`/app/start-send/${A}`, plane);
  const drawn = W("screen.start-send.blank", { name: "venue", value: venue.value, source: src });
  await until(p, () => text(p).includes(drawn), "the read-again draft with its layered source");
  assert.ok(!text(p).includes(`profile:oakland-alameda/action_kinds`), "no source drawn under the profile's id");
  assert.ok(text(p).includes(W("screen.start-send.draft.own")), "the member's own words, template null");
  assert.equal(p.requests.filter((c) => c.op === "filingprepare" || c.op === "communicationprepare").length, 0, "nothing is prepared again by reading");
});

/* site-profiles — the sentences people read, each read through `localize` (setup-words R14, K3930).
 * One test per id: the module's output for that sentence is compared with `localize(id, en)`, so no
 * test asserts a sentence as a bare literal (K3810). Reached through `site-profiles/index.mjs` and the
 * handlers it exports, nothing else.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import {
  identify, CONFIDENCE, compare, fidelity, applyBoundary,
  aspnetWebforms, wordpress, clientRendered, conservative,
} from "../index.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
/** @import { Rule } from "../region.mjs" */

const enc = (/** @type {string} */ s) => new TextEncoder().encode(s);
const sha256 = async (/** @type {Uint8Array} */ b) => createHash("sha256").update(b).digest("hex");
const ruleLabel = (/** @type {Rule[]} */ rules, /** @type {string} */ key) => rules.find((r) => r.key === key)?.label;

test("site-profiles.aspnet-webforms.page_state_this_site_rebuilds is read through localize", () => {
  assert.equal(ruleLabel(aspnetWebforms.rules(), "webforms_page_state"),
    localize("site-profiles.aspnet-webforms.page_state_this_site_rebuilds", "page state this site rebuilds on every visit"));
});

test("site-profiles.aspnet-webforms.an_advertising_or_analytics is read through localize", () => {
  assert.equal(ruleLabel(aspnetWebforms.rules(), "ad_slots"),
    localize("site-profiles.aspnet-webforms.an_advertising_or_analytics", "an advertising or analytics slot"));
});

test("site-profiles.client-rendered.an_application_that_builds_its is read through localize", () => {
  assert.equal(clientRendered.label,
    localize("site-profiles.client-rendered.an_application_that_builds_its", "an application that builds its pages in the browser"));
});

test("site-profiles.client-rendered.no_links_and_no_prose_in_the is read through localize", () => {
  const shell = `<html><body>${"x".repeat(2500)}</body></html>`;
  const d = clientRendered.detect({ text: shell });
  assert.ok((d.signals ?? []).includes(
    localize("site-profiles.client-rendered.no_links_and_no_prose_in_the", "no links and no prose in the body")));
});

test("site-profiles.wordpress.a_page_published_with_wordpress is read through localize", () => {
  assert.equal(wordpress.label,
    localize("site-profiles.wordpress.a_page_published_with_wordpress", "a page published with WordPress"));
});

test("site-profiles.wordpress.a_version_stamp_on_a_design is read through localize", () => {
  const rules = wordpress.rules({ locator: "https://example.org/2020/01/a/", text: "" });
  assert.equal(ruleLabel(rules, "wp_asset_version"),
    localize("site-profiles.wordpress.a_version_stamp_on_a_design", "a version stamp on a design file"));
});

test("site-profiles.wordpress.an_advertising_or_analytics is read through localize", () => {
  const rules = wordpress.rules({ locator: "https://example.org/2020/01/a/", text: "" });
  assert.equal(ruleLabel(rules, "wp_ads"),
    localize("site-profiles.wordpress.an_advertising_or_analytics", "an advertising or analytics slot"));
});

test("site-profiles.index.everything_around_the_document_itself is read through localize", () => {
  const b = applyBoundary("<nav>menu</nav><main>body</main>", /<main>([\s\S]*)<\/main>/);
  assert.equal(b.found[0]?.label,
    localize("site-profiles.index.everything_around_the_document_itself", "everything around the document itself, such as navigation and footers"));
});

test("site-profiles.index.the_source_served_exactly_the_same is read through localize", async () => {
  const d = await compare(enc("<p>a</p>"), enc("<p>a</p>"), conservative, { sha256 });
  assert.equal(d.why, localize("site-profiles.index.the_source_served_exactly_the_same", "the source served exactly the same document"));
});

test("site-profiles.index.the_document_differs_and_this_kind is read through localize", async () => {
  const u = await compare(enc("<p>a</p>"), enc("<p>b</p>"), aspnetWebforms, { sha256, confidence: CONFIDENCE.LIKELY });
  assert.equal(u.why, localize("site-profiles.index.the_document_differs_and_this_kind",
    "the document differs and this kind of document is not recognised well enough to say whether the difference matters"));
});

test("site-profiles.index.the_substance_of_the_document is read through localize", async () => {
  const c = await compare(enc("<p>a</p>"), enc("<p>b</p>"), conservative, { sha256, confidence: CONFIDENCE.CERTAIN });
  assert.equal(c.verdict, "changed");
  assert.equal(c.why, localize("site-profiles.index.the_substance_of_the_document", "the substance of the document differs"));
});

test("site-profiles.index.the_substance_is_the_same is read through localize", async () => {
  const r = await compare(enc("<main>x</main><nav>a</nav>"), enc("<main>x</main><nav>b</nav>"),
    aspnetWebforms, { sha256, confidence: CONFIDENCE.CERTAIN });
  assert.equal(r.verdict, "restyled");
  assert.equal(r.why, localize("site-profiles.index.the_substance_is_the_same",
    "the substance is the same; something around it changed, such as navigation or related links"));
});

test("site-profiles.index.the_substance_and_the_appearance is read through localize", async () => {
  const u = await compare(enc('<input type="hidden" name="__VIEWSTATE" value="a"><main>x</main>'),
    enc('<input type="hidden" name="__VIEWSTATE" value="b"><main>x</main>'),
    aspnetWebforms, { sha256, confidence: CONFIDENCE.CERTAIN });
  assert.equal(u.verdict, "unchanged");
  assert.equal(u.why, localize("site-profiles.index.the_substance_and_the_appearance",
    "the substance and the appearance are both the same; only machinery this site rebuilds on every visit differs"));
});

test("site-profiles.index.a_file_the_page_needs is read through localize", () => {
  const f = fidelity({ subresources: [{ ok: false, kind: "stylesheet", url: "site.css" }] }, aspnetWebforms, {});
  assert.equal(f.level, "insufficient");
  assert.equal(f.why, localize("site-profiles.index.a_file_the_page_needs",
    "a file the page needs in order to look the way the source published it has not been collected"));
});

test("site-profiles.index.everything_the_page_needs_to is read through localize", () => {
  const f = fidelity({ subresources: [{ ok: false, kind: "image", url: "icon.png" }] }, aspnetWebforms, {});
  assert.equal(f.level, "degraded");
  assert.equal(f.why, localize("site-profiles.index.everything_the_page_needs_to",
    "everything the page needs to read correctly is held; some decoration is not"));
});

test("site-profiles.index.no_handler_recognised_this_document is read through localize", () => {
  assert.equal(identify({ text: "plain" }).why,
    localize("site-profiles.index.no_handler_recognised_this_document",
      "no handler recognised this document, so it is treated conservatively: nothing is assumed to be decoration and any difference is reported"));
});

test("site-profiles.index.the_document_is_written_in is read through localize", async () => {
  const { digests } = await import("../index.mjs");
  const d = await digests(enc("x"), conservative, { sha256, charset: "x-no-such-encoding-9" });
  assert.equal(d.why, localize("site-profiles.index.the_document_is_written_in",
    "the document is written in an encoding this system cannot read, so it is compared byte for byte"));
});

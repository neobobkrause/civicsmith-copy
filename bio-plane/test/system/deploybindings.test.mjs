/* D-202's closing half — the plane's deployed bindings derive from
 * wrangler.jsonc with the slug substituted, and this suite is why that logic
 * lives in `scripts/derive-bindings.mjs` instead of inside deploy.mjs: a
 * script that acts on import cannot be driven without deploying.
 *
 * Arms run against SYNTHETIC configs built to disagree in one specific way
 * each (the resolveversion.test.mjs lesson: a suite that only asserts "the
 * real tree agrees" proves nothing about the predicate), plus one live arm
 * against the real wrangler.jsonc, which is the ratchet.
 *
 * NEGATIVE CONTROL: RUN 2026-09-14, two hand arms against the module itself,
 * pristine copy taken first, restore verified by sha256 both times —
 * (a) remove the bio-plane→slug substitution -> 16 of 20 FAIL, every one
 * NAMED and none a crash: the module's own PHANTOM_TARGET guard turns every
 * derivation into a refusal, so the module fails CLOSED (a deploy under this
 * arm would refuse, not ship the phantom) and the suite reports it. The
 * arm's FIRST firing crashed the suite instead — bare deriveBindings calls
 * let the guard's throw eat the tally (D-93 inside a control, the third
 * sighting in this session's own instruments in one day) — which is why every
 * should-succeed call now goes through derive()/named() and a refusal shows
 * as a failing value. (b) make the unknown-binding-class refusal a silent
 * drop -> 1 of 20 FAIL, the refusal arm alone — honest and sufficient: the
 * drop only manifests when an unknown class is PRESENT, and that arm is the
 * one that presents one. The header's first draft predicted 4/20 and 2/20
 * before the arms ran; these are the measured figures.
 * Restored byte-identically after each, 20/20 green.
 *
 * NEGATIVE CONTROL (DIST-11): RUN 2026-09-24, declared before arming: `browser` moved back from CARRIED to the refused
 * KNOWN_BINDING_KEYS -> 35 passed, 6 failed: the real config's four ratchet arms and DIST-11's real-config arm, each
 * REFUSED [UNKNOWN_BINDING_CLASS] by name (as declared), PLUS the unnamed-binding arm, because the class is refused before
 * its name is checked (one wider than declared; recorded). Restored by cp, sha256 (ac2bf66f…) and cmp; 41/41 after.
 * NEGATIVE CONTROL (DIST-9): RUN 2026-09-24, one arm, declared before arming: delete the INSTANCE_AI_TOKEN push from
 * `deriveBindings` -> 37 passed, 1 failed, exactly "DIST-9: INSTANCE_AI_TOKEN is SENT…". Restored by cp, verified by
 * sha256 (2981bdfb…) and byte compare; 38/38 after. The NO-INVENTION arm cannot fail by that arm; it is armed by
 * the wizard suite's N1, where invention has a place to happen.
 * NEGATIVE CONTROL (D-54): RUN 2026-09-23, three arms, each ALONE, pristine copy
 * per arm, restore verified by sha256 and cmp; baseline 36/36 —
 * (A) replace wrangler.jsonc's `"limits": { "subrequests": 10000 }` -> 34/36,
 * FAIL "the real config states an explicit subrequest ceiling the release path
 * derives" (NO_SUBREQUEST_LIMIT) and "the ceiling's site carries its reason" (the
 * reason arm anchors on the `"limits"` key, so it goes with it — declared the
 * first, observed both; the reason arm, a source-text pin, retired in T23: plane
 * R13 now carries arm (A) at the interface). (B) drop `limits: deriveLimits(wranglerCfg),` from
 * deploy.mjs's metadata -> 35/36, FAIL "deploy.mjs's upload metadata carries the
 * derived limits" (that source pin retired in T22; bundler R18's command-level
 * tests in `test/m/bundler/release.test.mjs` now carry the arm). (C) make limitsReadBack read ABSENT limits as MATCH -> 35/36,
 * FAIL "read-back: settings stating no limits (biosmoke7's measured shape) are
 * UNDETERMINED, never a match". Restored, 36/36 green. Over-strictness arm:
 * cpu_ms beside subrequests is carried, not refused.
 */
import "../stdio.mjs";
import "../sandbox.mjs";
import { readFileSync } from "node:fs";
import { deriveBindings, serviceTargets, deriveLimits, limitsReadBack } from "../../scripts/derive-bindings.mjs";
import { stripJsonc } from "../../scripts/jsonc.mjs";   /* bundler R11: the module's one JSONC reader (T22, D5) */

let pass = 0, fail = 0;
const t = (name, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  ok ? pass++ : fail++;
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}`);
  if (!ok) console.log(`        got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);
};
const refusal = (fn) => { try { fn(); return "no refusal"; } catch (e) { return String(e.message).match(/REFUSED \[([A-Z_]+)\]/)?.[1] ?? "unrecognised: " + e.message; } };
/* A should-succeed derivation observed safely: a refusal comes back as a value
   the assertions FAIL on by name, never as a crash that eats the tally (the
   D-93-inside-a-control lesson, paid three times in one day before this line). */
const derive = (cfg, opts) => { try { return deriveBindings(cfg, opts); } catch (e) { return { REFUSED: String(e.message).slice(0, 80) }; } };
const named = (b, name) => Array.isArray(b) ? b.find((x) => x.name === name) : { REFUSED: b.REFUSED };

console.log("\n--- derive-bindings: the config deploys, the phantom does not ---");

const CFG = {
  name: "bio-plane",
  vars: { VERSION: "9.9.9", EXTRA_VAR: "kept" },
  durable_objects: { bindings: [{ name: "STORE", class_name: "Store" }] },
  r2_buckets: [
    { binding: "CAPTURES", bucket_name: "bio-captures" },
    { binding: "PUBLISHED", bucket_name: "bio-published" },
  ],
  services: [
    { binding: "PDF_WORKER", service: "pdf-worker" },
    { binding: "SELF", service: "bio-plane" },
  ],
};

/* ---- the substitution, both directions ---------------------------------- */
{
  const b = derive(CFG, { slug: "oak-town", version: "0.57.0" });
  t("the derivation succeeds on the healthy config", Array.isArray(b), true);
  t("SELF's phantom target becomes the instance slug",
    named(b, "SELF")?.service, "oak-town");
  t("a member target stays literal — members deploy under their own names",
    named(b, "PDF_WORKER")?.service, "pdf-worker");
  t("VERSION is the deploy argument, the string the rollout gate waits for",
    named(b, "VERSION")?.text, "0.57.0");
  t("INSTANCE_NAME is the slug (D-102)",
    named(b, "INSTANCE_NAME")?.text, "oak-town");
  t("other config vars are carried",
    named(b, "EXTRA_VAR")?.text, "kept");
  t("both buckets derive",
    (Array.isArray(b) ? b : []).filter((x) => x.type === "r2_bucket").map((x) => x.bucket_name).sort(),
    ["bio-captures", "bio-published"]);
  /* the census: nothing declared was dropped, nothing undeclared appeared */
  t("nothing dropped, nothing invented — the derived set is exactly the declared one plus the two deploy-owned names",
    (Array.isArray(b) ? b : [b.REFUSED]).map((x) => x.name ?? x).sort(),
    ["CAPTURES", "EXTRA_VAR", "INSTANCE_NAME", "PDF_WORKER", "PUBLISHED", "SELF", "VERSION"]);
  t("no durable_object_namespace is SENT — STORE rides keep_bindings, deliberately",
    (Array.isArray(b) ? b : []).some((x) => x.type === "durable_object_namespace"), false);
  t("the phantom survives nowhere — and a refusal here is a FAILURE with the refusal shown, not a crash",
    Array.isArray(b) ? b.some((x) => x.service === "bio-plane") : b, false);
}

/* ---- K1502: never a Claude credential, even when one is offered ---------- */
{
  const withTok = derive(CFG, { slug: "s", version: "1", instanceClaudeToken: "tok-x" });
  const without = derive(CFG, { slug: "s", version: "1" });
  t("R13: no Claude credential is derived, whether or not one is offered (K1502)",
    [withTok, without].map((d) => (Array.isArray(d) ? d : [{ name: "REFUSED" }])
      .filter((x) => x.type === "secret_text" || /CLAUDE/i.test(x.name) || x.text === "tok-x").length), [0, 0]);
}

/* ---- DIST-9: the organisation `ai` credential, carried and NEVER invented ---- */
{
  const withAi = derive(CFG, { slug: "s", version: "1", instanceAiToken: "aik-operator-value-0123456789" });
  const none = derive(CFG, { slug: "s", version: "1" });
  const ai = (b) => (Array.isArray(b) ? b : []).filter((x) => x.name === "INSTANCE_AI_TOKEN");
  t("DIST-9: INSTANCE_AI_TOKEN is SENT, as a secret, carrying exactly the environment's value",
    ai(withAi).map((x) => [x.type, x.text]), [["secret_text", "aik-operator-value-0123456789"]]);
  t("DIST-9 NO-INVENTION: with no INSTANCE_AI_TOKEN in the environment, no such binding is derived (none generated)",
    ai(none).length, 0);
}

/* ---- the refusals: loud, by name, never a silent drop -------------------- */
{
  t("no slug refuses — a default would be D-292's hardcoded name",
    refusal(() => deriveBindings(CFG, { version: "1" })), "NO_SLUG");
  t("no version refuses",
    refusal(() => deriveBindings(CFG, { slug: "s" })), "NO_VERSION");
  t("a config binding class the derivation does not carry REFUSES by name",
    refusal(() => deriveBindings({ ...CFG, kv_namespaces: [{ binding: "KV", id: "x" }] },
      { slug: "s", version: "1" })), "UNKNOWN_BINDING_CLASS");
  t("an EMPTY declared class is not a refusal — absent and empty differ",
    refusal(() => deriveBindings({ ...CFG, kv_namespaces: [] }, { slug: "s", version: "1" }))
      === "no refusal", true);
}

/* ---- pre-flight targets: everything except the self-reference ------------ */
{
  const b = derive(CFG, { slug: "oak-town", version: "1" });
  t("pre-flight lists the member target and skips the self-reference (the noSelf lesson)",
    Array.isArray(b) ? serviceTargets(b, "oak-town") : b, ["pdf-worker"]);
}

/* ---- the live arm, the ratchet: the real config derives cleanly ---------- */
{
  const real = JSON.parse(stripJsonc(
    readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8")));
  const b = derive(real, { slug: "biosmoke7", version: real.vars.VERSION });
  t("the real config derives without refusal and SELF targets the instance",
    named(b, "SELF")?.service, "biosmoke7");
  /* N696 (K1864): SHEET_WORKER/sheet-worker joined the real config; five service bindings since T34.
     T36-2 (BUNDLER #10; rev. 2 §2 R10, plane uses file-scanner): FILE_SCANNER/file-scanner, which the plane's config
     has carried since T36-49; six since. */
  t("the real config's six service bindings all derive",
    (Array.isArray(b) ? b : [b]).filter((x) => x.type === "service").map((x) => x.name).sort(),
    ["AGENT_WORKER", "FILE_SCANNER", "OCR_WORKER", "PDF_WORKER", "SELF", "SHEET_WORKER"]);
  t("the real config's fleet targets pre-flight (self excluded)",
    Array.isArray(b) ? serviceTargets(b, "biosmoke7").sort() : b, ["agent-worker", "file-scanner", "ocr-worker", "pdf-worker", "sheet-worker"]);
  t("no phantom leaves the real derivation",
    Array.isArray(b) ? b.some((x) => x.service === "bio-plane") : b, false);
}

/* ---- DIST-11 (IC-252): the `browser` class is CARRIED, never refused or invented ---- */
console.log("\n--- DIST-11: the Browser Rendering binding is carried from the config ---");
{
  const real = JSON.parse(stripJsonc(readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8")));
  const br = (b) => (Array.isArray(b) ? b : []).filter((x) => x.type === "browser");
  const rb = derive(real, { slug: "biosmoke7", version: real.vars.VERSION });
  t("DIST-11: the REAL config derives exactly one browser binding, named BROWSER (the name render.mjs reads)",
    Array.isArray(rb) ? br(rb).map((x) => x.name) : rb, ["BROWSER"]);
  t("DIST-11: a config WITHOUT `browser` derives none and does not refuse (the binding is an optimisation)",
    Array.isArray(derive(CFG, { slug: "s", version: "1" })) ? br(derive(CFG, { slug: "s", version: "1" })).length : "refused", 0);
  t("DIST-11: `browser` declared with no binding name REFUSES by name, never a nameless binding",
    refusal(() => deriveBindings({ ...CFG, browser: {} }, { slug: "s", version: "1" })), "BROWSER_BINDING_UNNAMED");
}

/* ---- D-54: the subrequest ceiling is declared, carried, read back -------- */
console.log("\n--- D-54: limits.subrequests is a decision, not the platform's default ---");
{
  const lim = (cfg) => { try { return deriveLimits(cfg); } catch (e) { return { REFUSED: String(e.message).slice(0, 80) }; } };
  t("an explicit ceiling derives exactly as declared",
    lim({ ...CFG, limits: { subrequests: 10000 } }), { subrequests: 10000 });
  t("a config with NO limits block refuses by name — no limits sent is the month's default (D-54)",
    refusal(() => deriveLimits(CFG)), "NO_SUBREQUEST_LIMIT");
  t("an empty limits block refuses by name",
    refusal(() => deriveLimits({ ...CFG, limits: {} })), "NO_SUBREQUEST_LIMIT");
  t("a non-integer ceiling (a string) refuses — the API would read a different thing",
    refusal(() => deriveLimits({ ...CFG, limits: { subrequests: "10000" } })), "NO_SUBREQUEST_LIMIT");
  t("a zero ceiling refuses",
    refusal(() => deriveLimits({ ...CFG, limits: { subrequests: 0 } })), "NO_SUBREQUEST_LIMIT");
  t("a limit key the derivation does not carry REFUSES by name, never dropped",
    refusal(() => deriveLimits({ ...CFG, limits: { subrequests: 10, steps: 5 } })), "UNKNOWN_LIMIT_KEY");
  /* over-strictness: correct work in a spelling not anticipated must pass */
  t("cpu_ms beside it is carried, not refused (wrangler's own upload carries both)",
    lim({ ...CFG, limits: { cpu_ms: 30000, subrequests: 2000 } }), { subrequests: 2000, cpu_ms: 30000 });

  const want = { subrequests: 10000 };
  t("read-back: the settings stating our figure is a MATCH",
    limitsReadBack({ limits: { subrequests: 10000 } }, want).verdict, "MATCH");
  t("read-back: a different figure is a MISMATCH, and the deploy must not report success",
    limitsReadBack({ limits: { subrequests: 1000 } }, want).verdict, "MISMATCH");
  /* The SHAPE measured on biosmoke7 2026-09-23 (GET .../scripts/biosmoke7/settings,
     success true): keys placement, compatibility_date, compatibility_flags,
     usage_model, tags, tail_consumers, logpush, annotations, bindings — NO limits. */
  t("read-back: settings stating no limits (biosmoke7's measured shape) are UNDETERMINED, never a match",
    limitsReadBack({ placement: {}, compatibility_date: "2026-07-01", usage_model: "standard", bindings: [] }, want).verdict,
    "UNDETERMINED");
  t("read-back: unreadable settings are UNDETERMINED",
    limitsReadBack(null, want).verdict, "UNDETERMINED");
}

/* ---- D-54's live arm: the real config's ceiling, and the release path ------ */
{
  const src = readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8");
  const real = JSON.parse(stripJsonc(src));
  let got; try { got = deriveLimits(real); } catch (e) { got = { REFUSED: String(e.message).slice(0, 80) }; }
  t("the real config states an explicit subrequest ceiling the release path derives",
    got, { subrequests: 10000, cpu_ms: 300000 });
  /* RETIRED 2026-10-02 (BUNDLER #6, T23; N482, K1020, K1113): two assertions here pinned SOURCE TEXT (P7): the
     comment before `"limits"` in wrangler.jsonc citing "D-54", "Cloudflare", "THEIR claim" and "SUBRESOURCE_CAP (400",
     and `export const SUBRESOURCE_CAP = 400;` read out of subresources.mjs. Their properties are now requirements of
     their owners, tested at the interface: the subresources module's cap requirement (the cap is 400 and is `captureSubresources`' default,
     tested by calling the service) and plane R13 (the parsed config's ceiling is 10000, derived by `deriveLimits`, and
     covers ten times `2 × (1 + SUBRESOURCE_CAP)` from the imported constant; its test lands in plane's L11 job, K1113).
     The comment that explains the figure binds nothing. The arm above, the ceiling derived from the real config,
     stays. */
  /* RETIRED 2026-10-01 (BUNDLER #5, T22): two assertions here pinned deploy.mjs's SOURCE TEXT (the upload metadata
     carrying `deriveLimits`, and the read-back refusing success on a MISMATCH), from when deploy.mjs could not be driven
     without deploying. It is driven now, as the command an operator runs, against a stubbed account
     (`test/m/bundler/release.test.mjs`): R18's tests assert the uploaded metadata's `limits` equal `deriveLimits` of
     the config, that a read-back MISMATCH exits 1 with [LIMITS_MISMATCH] and no rollout wait, and that UNDETERMINED is
     never stated as verified. Behaviour at the interface replaces the source pins (the header's D-54 arm (B) was run
     against the pins). */
}

console.log(`\ndeploybindings: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

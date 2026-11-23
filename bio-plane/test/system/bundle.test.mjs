/* release R22, R46: the plane asset a release carries, built afresh from this checkout by the plane's own recipe (never a
   committed bundle), boots as one part under workerd, passes its own self-test and live-fire canary, and refuses to
   promote outside its confinement.
   NEGATIVE CONTROL: (run 2026-07-31, against the bundle then committed) disable the store CAS-on-base inside the bundle
   (guard `cur.bundle_sha !== base` with `false`), so the bundled build no longer refuses a stale write -> livefire
   reports 14/19, ok:false, exit 1: 5 self-test assertions fail (STALE/garbage base refused, live/history state, lease
   base). */
import "../stdio.mjs";                 /* D-282: a suite's own exit must not discard the suite's own output */
import "../sandbox.mjs"; /* D-186: owns $TMPDIR for this process and removes it on exit */
import { Miniflare } from "miniflare";
import { buildMember, planeMember } from "../../scripts/fleet-bundle.mjs";
/* R46: built here, in memory, by the recipe the plane's own build runs; nothing in dist/ is read. */
const built = await buildMember(planeMember());
const mf = new Miniflare({
  modules: true, modulesRoot: "/", scriptPath: "/bio-plane.bundled.mjs", script: built.bytes.toString("utf8"),
  compatibilityDate: "2026-07-01", compatibilityFlags: ["nodejs_compat"],
  durableObjects: { STORE: { className: "Store", useSQLite: true } },
  r2Buckets: ["CAPTURES", "PUBLISHED"],
  /* The probe token is 24 characters because `livefire` asserts that no configured
     token is shorter than 16, and this fixture's 11-character `probe-local` failed
     it. The fixture was wrong, not the rule: a suite whose fixture violates a rule
     the plane enforces is testing a configuration no instance may have. */
  /* CORRECTED 2026-09-21 BY D-436 (IC-172), never exempted: INSTANCE_NAME is bound because every install binds it
     (`newgroup`'s upload, D-102) and a store records its producing group from it at its FIRST BOOT. Unbound, the store
     records none, and livefire's canary — which now names no group of its own, where it named a literal one — is
     REFUSED by name (C-64.1), which is the plane being right about a store no install produces. */
  bindings: { VERSION: "0.2.0", PROBE_TOKEN: "probe-local-fixture-2026", INSTANCE_NAME: "bundle-fixture" },
});
/* The probe token rides the Authorization header: the plane refuses a credential in the address (C-38.10,
   CREDENTIAL_IN_ADDRESS), which this suite met as a crash on `lf.assertions` while it still sent `&token=` (T37-3). */
const AUTH = { headers: { authorization: "Bearer probe-local-fixture-2026" } };
const j = async (p) => (await (await mf.dispatchFetch("http://x" + p, AUTH)).json());
const st = await j("/?op=selftest");
console.log("selftest bindings:", JSON.stringify(st.bindings));
const lf = await j("/?op=livefire");
/* D-506 (IC-265): `ok` is the op ANSWERING; the canary's answer is `verdict`, named by `failing`. */
console.log("livefire:", lf.summary, "answered:", lf.ok, "verdict:", lf.verdict,
            lf.failing?.length ? "failing: " + lf.failing.join(" · ") : "");
for (const a of lf.assertions) if (!a.ok) console.log("  FAIL", a.name);
const d1 = await j("/?op=promote&store=bio");
console.log("confinement:", d1.error || "ALLOWED (DEFECT)");
/* M0-67 / D-425's sweep: `ALLOWED (DEFECT)` above was printed and not exited on. */
/* D-506: keyed to the VERDICT. `ok` is true whenever the op answered, so an exit reading it would be
   green over a bundled artifact whose canary found a defect — this suite's whole purpose. */
await mf.dispose(); process.exit(lf.verdict === "pass" && d1.error ? 0 : 1);

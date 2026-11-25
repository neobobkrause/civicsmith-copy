/* bundler R13, R14, R15: the deploy's derivations, at the module's interface (`derive-bindings.mjs`). Pure functions —
 * a config in, what a deploy sends out — so every arm here is a value compared, and nothing deploys or asks a network.
 *
 * Found by bundler #4 (PR 1422) and fixed by bundler #5: `deriveBindings` handed no config read it as an empty one and
 * threw a TypeError out of the refusal it was written to make, and it counted a key stating NOTHING (`"ai": null`,
 * `"ai": {}`) as a binding class declared, where R14 refuses a class the config declares NON-EMPTY. Both are pinned
 * below, with the refusals and the bindings that were already right. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  deriveBindings, serviceTargets, deriveLimits, limitsReadBack, STORE_GENERATION_PATTERN,
} from "../../../../scripts/derive-bindings.mjs";

const OPTS = { slug: "civicsmith-probe", version: "0.99.0" };
/* A config of the shape bio-plane/wrangler.jsonc has, small enough to read whole in an assertion. */
const config = () => ({
  name: "bio-plane",
  vars: { VERSION: "0.0.0-from-the-config", SITE_KIND: "instance", MAX_PAGES: 12 },
  r2_buckets: [{ binding: "CAPTURES", bucket_name: "bio-captures" }],
  services: [{ binding: "SELF", service: "bio-plane" }, { binding: "AGENT", service: "agent-worker" }],
  durable_objects: { bindings: [{ name: "STORE", class_name: "Store" }] },
});
const named = (bindings, name) => bindings.filter((b) => b.name === name);
const refusal = (fn) => {
  try { fn(); } catch (e) { return e.message; }
  throw new assert.AssertionError({ message: "no refusal was thrown" });
};

test("R13: the bindings a deploy sends — the version from the argument, the instance name from the slug, every other var carried", () => {
  const b = deriveBindings(config(), OPTS);
  assert.deepEqual(b.slice(0, 2), [
    { type: "plain_text", name: "VERSION", text: "0.99.0" },
    { type: "plain_text", name: "INSTANCE_NAME", text: "civicsmith-probe" },
  ]);
  assert.equal(named(b, "VERSION").length, 1, "the config's own vars.VERSION is not sent a second time");
  assert.deepEqual(named(b, "SITE_KIND"), [{ type: "plain_text", name: "SITE_KIND", text: "instance" }]);
  assert.deepEqual(named(b, "MAX_PAGES"), [{ type: "plain_text", name: "MAX_PAGES", text: "12" }],
    "a var that is not a string is sent as its text");
});

test("R13: a bucket becomes an r2_bucket; the plane's own service target becomes the slug and every other target is kept", () => {
  const b = deriveBindings(config(), OPTS);
  assert.deepEqual(named(b, "CAPTURES"), [{ type: "r2_bucket", name: "CAPTURES", bucket_name: "bio-captures" }]);
  assert.deepEqual(named(b, "SELF"), [{ type: "service", name: "SELF", service: "civicsmith-probe" }]);
  assert.deepEqual(named(b, "AGENT"), [{ type: "service", name: "AGENT", service: "agent-worker" }]);
});

test("R13: no Durable Object binding is emitted, though the config declares one", () => {
  const b = deriveBindings(config(), OPTS);
  assert.deepEqual(b.filter((x) => x.type === "durable_object_namespace" || x.name === "STORE"), []);
});

test("R13: a browser binding only when the config declares one, named", () => {
  assert.deepEqual(deriveBindings({ browser: { binding: "BROWSER" } }, OPTS).filter((b) => b.type === "browser"),
    [{ type: "browser", name: "BROWSER" }]);
  assert.deepEqual(deriveBindings({}, OPTS).filter((b) => b.type === "browser"), []);
});

test("R13: INSTANCE_AI_TOKEN only when it is given, and never a Claude credential", () => {
  const without = deriveBindings(config(), OPTS);
  assert.deepEqual(without.filter((b) => b.type === "secret_text"), []);
  const with_ = deriveBindings(config(), { ...OPTS, instanceAiToken: "ai-token-value" });
  assert.deepEqual(with_.filter((b) => b.type === "secret_text"),
    [{ type: "secret_text", name: "INSTANCE_AI_TOKEN", text: "ai-token-value" }]);
  /* K1502: no argument can add a Claude credential. An instance binds no Claude account, so a caller that offers one
     — as a `instanceClaudeToken` — changes nothing the deploy sends. */
  const offered = deriveBindings(config(), Object.assign({}, OPTS, { instanceClaudeToken: "claude-token-value" }));
  assert.deepEqual(offered, without);
  assert.equal(JSON.stringify(offered).toLowerCase().includes("claude"), false);
});

test("R14: no slug and no version are each refused by name, before anything else is read", () => {
  assert.match(refusal(() => deriveBindings(config(), { version: "1" })), /^REFUSED \[NO_SLUG\]/);
  assert.match(refusal(() => deriveBindings(config(), {})), /^REFUSED \[NO_SLUG\]/);
  assert.match(refusal(() => deriveBindings(config(), { slug: "s" })), /^REFUSED \[NO_VERSION\]/);
});

test("R14: no parsed config is refused by name, not thrown out of as a TypeError", () => {
  for (const cfg of [undefined, null, "", 0, false, "wrangler.jsonc", 7, [{ vars: {} }]]) {
    const message = refusal(() => deriveBindings(cfg, OPTS));
    assert.match(message, /^REFUSED \[NO_CONFIG\]/, `${JSON.stringify(cfg ?? null)} is refused by name`);
  }
  /* The refusal is the derivation's own, so it names what a deploy would otherwise have carried. */
  assert.match(refusal(() => deriveBindings(undefined, OPTS)), /VERSION and INSTANCE_NAME alone/);
  assert.deepEqual(deriveBindings({}, OPTS).map((b) => b.name), ["VERSION", "INSTANCE_NAME"],
    "an empty config is a config: it declares no class, and the two bindings the arguments carry are sent");
});

test("R14: a binding class the config declares non-empty is refused by name, every one of the thirteen", () => {
  const nonEmpty = {
    kv_namespaces: [{ binding: "KV" }], d1_databases: [{ binding: "DB" }], queues: { producers: [{ binding: "Q" }] },
    analytics_engine_datasets: [{ binding: "AE" }], ai: { binding: "AI" }, vectorize: [{ binding: "V" }],
    hyperdrive: [{ binding: "H" }], dispatch_namespaces: [{ binding: "D" }], mtls_certificates: [{ binding: "M" }],
    send_email: [{ name: "E" }], wasm_modules: { W: "w.wasm" }, data_blobs: { B: "b.bin" }, text_blobs: { T: "t.txt" },
  };
  for (const [key, value] of Object.entries(nonEmpty)) {
    const message = refusal(() => deriveBindings({ [key]: value }, OPTS));
    assert.match(message, /^REFUSED \[UNKNOWN_BINDING_CLASS\]/);
    assert.match(message, new RegExp(`declares ${key},`), `${key} is named in its own refusal`);
  }
  /* Several at once are all named, so one change teaches the derivation every class it is missing. */
  assert.match(refusal(() => deriveBindings({ ai: { binding: "AI" }, queues: { producers: [] }, text_blobs: { T: "t" } }, OPTS)),
    /declares queues, ai, text_blobs,/);
});

test("R14: a binding key that states nothing declares no class, so a config carrying nothing is not refused", () => {
  /* The flaw bundler #4 found: `"ai": null` left in a config refused the deploy of a plane that binds no AI. */
  const empty = { ai: null, queues: {}, kv_namespaces: [], d1_databases: undefined, send_email: [],
    wasm_modules: {}, data_blobs: {}, text_blobs: "", vectorize: false, hyperdrive: null };
  assert.deepEqual(deriveBindings({ ...config(), ...empty }, OPTS).map((b) => b.name),
    ["VERSION", "INSTANCE_NAME", "SITE_KIND", "MAX_PAGES", "CAPTURES", "SELF", "AGENT"]);
});

test("R14: a declared browser with no binding name, and a service target that stays the phantom, are each refused by name", () => {
  for (const browser of [{}, { binding: "" }, true, 1, { binding: 7 }, null]) {
    assert.match(refusal(() => deriveBindings({ browser }, OPTS)), /^REFUSED \[BROWSER_BINDING_UNNAMED\]/,
      `browser ${JSON.stringify(browser)} is refused`);
  }
  /* The phantom survives derivation only when the slug IS the config's name, which is the one case the substitution
     cannot cure — and the one a deploy must never send (D-292). */
  assert.match(refusal(() => deriveBindings({ services: [{ binding: "SELF", service: "bio-plane" }] },
    { slug: "bio-plane", version: "1" })), /^REFUSED \[PHANTOM_TARGET\]/);
});

test("R14: serviceTargets lists the targets a deploy pre-flights, never the instance's own", () => {
  const b = deriveBindings(config(), OPTS);
  assert.deepEqual(serviceTargets(b, "civicsmith-probe"), ["agent-worker"]);
  assert.deepEqual(serviceTargets(b, "another-instance"), ["civicsmith-probe", "agent-worker"]);
  assert.deepEqual(serviceTargets([], "civicsmith-probe"), []);
});

test("R15: deriveLimits returns the subrequest ceiling, and carries cpu_ms as the config states it", () => {
  assert.deepEqual(deriveLimits({ limits: { subrequests: 50 } }), { subrequests: 50 });
  assert.deepEqual(deriveLimits({ limits: { subrequests: 1000, cpu_ms: 30000 } }), { subrequests: 1000, cpu_ms: 30000 });
  /* R15 states `cpu_ms?` "as the config states it" and names no refusal for its value: what the config says is what
     the deploy sends, and the platform judges it. A bound on it would be a change to what the product does. */
  assert.deepEqual(deriveLimits({ limits: { subrequests: 50, cpu_ms: null } }), { subrequests: 50, cpu_ms: null });
  assert.deepEqual(deriveLimits({ limits: { subrequests: 50, cpu_ms: "30s" } }), { subrequests: 50, cpu_ms: "30s" });
  assert.deepEqual(deriveLimits({ limits: { subrequests: 50, cpu_ms: undefined } }), { subrequests: 50 },
    "a key stating nothing is not sent");
});

test("R15: a config with no explicit positive whole subrequest ceiling is refused by name", () => {
  for (const cfg of [undefined, null, {}, { limits: {} }, { limits: null },
    { limits: { subrequests: 0 } }, { limits: { subrequests: -5 } }, { limits: { subrequests: 1.5 } },
    { limits: { subrequests: "50" } }, { limits: { subrequests: null } }]) {
    assert.match(refusal(() => deriveLimits(cfg)), /^REFUSED \[NO_SUBREQUEST_LIMIT\]/,
      `${JSON.stringify(cfg ?? null)} is refused by name`);
  }
});

test("R15: a limit key the derivation does not carry is refused by name, never dropped", () => {
  const message = refusal(() => deriveLimits({ limits: { subrequests: 50, memory_mb: 256, startup_ms: 10 } }));
  assert.match(message, /^REFUSED \[UNKNOWN_LIMIT_KEY\]/);
  assert.match(message, /declares memory_mb, startup_ms,/);
});

test("R15: limitsReadBack answers MATCH, MISMATCH or UNDETERMINED, and asks nothing of a network", () => {
  const fetch_ = globalThis.fetch;
  let asked = 0;
  globalThis.fetch = () => { asked += 1; throw new Error("a derivation asked the network"); };
  try {
    assert.equal(limitsReadBack({ limits: { subrequests: 50 } }, { subrequests: 50 }).verdict, "MATCH");
    assert.equal(limitsReadBack({ limits: { subrequests: 20 } }, { subrequests: 50 }).verdict, "MISMATCH");
    assert.match(limitsReadBack({ limits: { subrequests: 20 } }, { subrequests: 50 }).why, /20.*50/);
    for (const settings of [undefined, null, "", 7, {}, { limits: {} }, { limits: { subrequests: null } }])
      assert.equal(limitsReadBack(settings, { subrequests: 50 }).verdict, "UNDETERMINED",
        `${JSON.stringify(settings ?? null)} is never read as a match`);
    assert.equal(deriveLimits({ limits: { subrequests: 50 } }).subrequests, 50);
  } finally { globalThis.fetch = fetch_; }
  assert.equal(asked, 0, "neither function makes a request");
});

test("R15: STORE_GENERATION_PATTERN is a whole number of 1 or more, with no sign, leading zero or space", () => {
  for (const good of ["1", "2", "17", "1000"]) assert.equal(STORE_GENERATION_PATTERN.test(good), true, good);
  for (const bad of ["0", "01", "+1", "-1", " 1", "1 ", "1.0", "", "one", "1e3"])
    assert.equal(STORE_GENERATION_PATTERN.test(bad), false, JSON.stringify(bad));
});

/* bundler's configuration readers, called as functions on fixture configs: proves R11 (stripJsonc, parseJsonc), R13
 * (deriveBindings' bindings), R14 (its refusals; serviceTargets) and R15 (deriveLimits, limitsReadBack,
 * deriveObservability, observabilityReadBack; none makes a request). */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { stripJsonc, parseJsonc } from "../../../../scripts/jsonc.mjs";
import {
  deriveBindings, serviceTargets, deriveLimits, limitsReadBack, deriveObservability, observabilityReadBack,
} from "../../../../scripts/derive-bindings.mjs";
import { threw } from "./fixture.mjs";

/* R15: "neither makes a request". Every request in this file fails the test that made it. */
let realFetch;
before(() => { realFetch = globalThis.fetch; globalThis.fetch = () => { throw new Error("a configuration reader made a request"); }; });
after(() => { globalThis.fetch = realFetch; });

/** A plane-shaped parsed wrangler.jsonc. */
const config = (over = {}) => ({
  name: "bio-plane", main: "src/plane/index.mjs", compatibility_date: "2026-07-01",
  vars: { VERSION: "0.0.1", MODE: "fixture", COUNT: 3 },
  durable_objects: { bindings: [{ name: "STORE", class_name: "Store" }] },
  migrations: [{ tag: "v1", new_sqlite_classes: ["Store"] }],
  r2_buckets: [{ binding: "CAPTURES", bucket_name: "c" }, { binding: "PUBLISHED", bucket_name: "p" }],
  services: [{ binding: "SELF", service: "bio-plane" }, { binding: "PDF", service: "pdf-worker" }],
  browser: { binding: "BROWSER" }, limits: { subrequests: 500, cpu_ms: 30000 }, observability: { enabled: true },
  ...over,
});
/** A value of another type than the reader declares, on purpose: the bounds a caller could pass. */
const loose = (x) => /** @type {any} */ (x);
const code = (fn) => { const e = threw(fn); assert.ok(e instanceof Error); return /^REFUSED \[([A-Z_]+)\]/.exec(e.message)?.[1] ?? e.message; };

/* ------------------------------------------------------------------------ R11 */

test("R11: stripJsonc removes // line comments keeping their newline and /* */ block comments, and nothing inside a single- or double-quoted string, escapes honoured", () => {
  const src = [
    '{ "$schema": "https://example.test/schema.json", // a comment with "quotes" and \'ticks\'',
    "  /* a block",
    '     over lines with // inside and a " */ "a": "x // not a comment", "b": \'y /* not a block */\',',
    '  "c": "esc \\" // still a string", "d": "back\\\\", // closed at the escaped backslash',
    "  \"e\": 'it\\'s // kept', \"f\": 1 /* inline */ }",
  ].join("\n");
  const out = stripJsonc(src);
  assert.equal(out.split("\n").length, src.split("\n").length - 1, "a block comment's newline goes with it; a line comment's stays");
  for (const kept of ['"https://example.test/schema.json"', '"x // not a comment"', "'y /* not a block */'", '"esc \\" // still a string"',
    '"back\\\\"', "'it\\'s // kept'"]) assert.ok(out.includes(kept), kept);
  assert.doesNotMatch(out, /a comment with|\/\* a block|over lines|inline|closed at/);
  assert.equal(stripJsonc('"a" // c\n"b"'), '"a" \n"b"', "the line comment's newline is kept");
  assert.equal(stripJsonc("a /* b */ c // d"), "a  c ");
  assert.equal(stripJsonc("no comments at all"), "no comments at all");
  assert.equal(stripJsonc(""), "");
  assert.equal(stripJsonc('"unterminated // string'), '"unterminated // string', "an open string runs to the end");
});

test("R11: parseJsonc returns the parsed object; anything that does not parse throws Error reading '<what> did not parse as JSONC: …'", () => {
  assert.deepEqual(parseJsonc('// x\n{ "u": "https://a.test//b", /* y */ "n": [1, 2] }\n'), { u: "https://a.test//b", n: [1, 2] });
  assert.deepEqual(parseJsonc(JSON.stringify(config())), config(), "plain JSON is JSONC");
  for (const [text, what, re] of [["{ broken", "w/wrangler.jsonc", /^w\/wrangler\.jsonc did not parse as JSONC: /],
    ["[", undefined, /^config did not parse as JSONC: /], ["", "empty.jsonc", /^empty\.jsonc did not parse as JSONC: /],
    ['{ "a": 1, }', "trailing", /^trailing did not parse as JSONC: /], ["// only a comment", "c", /^c did not parse as JSONC: /]]) {
    const e = threw(() => parseJsonc(loose(text), loose(what)));
    assert.equal(e.constructor, Error, String(text));
    assert.match(e.message, loose(re), String(text));
  }
});

/* ------------------------------------------------------------------------ R13 */

test("R13: deriveBindings emits plain_text VERSION (the argument) and INSTANCE_NAME (the slug), each var but VERSION, each bucket, each service (bio-plane becomes the slug), browser, and INSTANCE_AI_TOKEN only when given", () => {
  const base = [
    { type: "plain_text", name: "VERSION", text: "9.9.9" },
    { type: "plain_text", name: "INSTANCE_NAME", text: "grp" },
    { type: "plain_text", name: "MODE", text: "fixture" },
    { type: "plain_text", name: "COUNT", text: "3" },
    { type: "r2_bucket", name: "CAPTURES", bucket_name: "c" },
    { type: "r2_bucket", name: "PUBLISHED", bucket_name: "p" },
    { type: "service", name: "SELF", service: "grp" },
    { type: "service", name: "PDF", service: "pdf-worker" },
    { type: "browser", name: "BROWSER" },
  ];
  assert.deepEqual(deriveBindings(config(), { slug: "grp", version: "9.9.9" }), base, "VERSION is the argument's, never vars.VERSION");
  assert.deepEqual(deriveBindings(config(), { slug: "grp", version: "9.9.9", instanceAiToken: "a-tok" }),
    [...base, { type: "secret_text", name: "INSTANCE_AI_TOKEN", text: "a-tok" }]);
  for (const t of ["", undefined, null])
    assert.deepEqual(deriveBindings(config(), loose({ slug: "grp", version: "9.9.9", instanceAiToken: t })), base, `no token for ${t}`);
  const { browser: _b, r2_buckets: _r, services: _s, vars: _v, ...bare } = config();
  assert.deepEqual(deriveBindings(bare, { slug: "s", version: "1" }),
    [{ type: "plain_text", name: "VERSION", text: "1" }, { type: "plain_text", name: "INSTANCE_NAME", text: "s" }], "nothing else declared, nothing else emitted");
});

test("R13: deriveBindings never emits a Claude credential, even when one is offered, and no Durable Object binding", () => {
  const all = deriveBindings(config(), loose({ slug: "grp", version: "1", instanceClaudeToken: "claude-secret", instanceAiToken: "a" }));
  assert.ok(!all.some((b) => /CLAUDE/i.test(b.name) || b.text === "claude-secret"), "no Claude credential under any name (K1502)");
  assert.ok(!all.some((b) => b.type === "durable_object_namespace" || b.name === "STORE"), "no Durable Object binding");
  assert.deepEqual(all.filter((b) => b.type === "secret_text").map((b) => b.name), ["INSTANCE_AI_TOKEN"]);
});

/* ------------------------------------------------------------------------ R14 */

test("R14: deriveBindings refuses [NO_SLUG] and [NO_VERSION] when either is missing", () => {
  for (const args of [{ version: "1" }, { slug: "", version: "1" }, { slug: null, version: "1" }, undefined])
    assert.equal(code(() => deriveBindings(config(), loose(args))), "NO_SLUG", JSON.stringify(args));
  for (const args of [{ slug: "s" }, { slug: "s", version: "" }, { slug: "s", version: null }])
    assert.equal(code(() => deriveBindings(config(), loose(args))), "NO_VERSION", JSON.stringify(args));
});

test("R14: every listed binding class the config declares non-empty is refused [UNKNOWN_BINDING_CLASS] by name; several are each named; an empty list is not declared", () => {
  const classes = ["kv_namespaces", "d1_databases", "queues", "analytics_engine_datasets", "ai", "vectorize", "hyperdrive",
    "dispatch_namespaces", "mtls_certificates", "send_email", "wasm_modules", "data_blobs", "text_blobs"];
  for (const k of classes) {
    for (const value of [[{ binding: "X" }], { binding: "X" }]) {
      const e = threw(() => deriveBindings(config({ [k]: value }), { slug: "s", version: "1" }));
      assert.match(e.message, new RegExp(`^REFUSED \\[UNKNOWN_BINDING_CLASS\\]: wrangler\\.jsonc declares ${k}, which this derivation does not carry`), k);
    }
    assert.ok(deriveBindings(config({ [k]: [] }), { slug: "s", version: "1" }).length > 0, `${k}: [] is not declared`);
  }
  const e = threw(() => deriveBindings(config({ queues: [{}], hyperdrive: [{}], ai: {} }), { slug: "s", version: "1" }));
  assert.match(e.message, /declares queues, ai, hyperdrive,/, "each one named, in the list's order");
});

test("R14: a browser with no binding name is refused [BROWSER_BINDING_UNNAMED]; a service still targeting bio-plane is refused [PHANTOM_TARGET]; serviceTargets lists the service targets other than the slug", () => {
  for (const browser of [{}, { binding: "" }, null, { binding: 3 }, false])
    assert.equal(code(() => deriveBindings(config({ browser }), { slug: "s", version: "1" })), "BROWSER_BINDING_UNNAMED", JSON.stringify(browser));
  assert.equal(code(() => deriveBindings(config(), { slug: "bio-plane", version: "1" })), "PHANTOM_TARGET");
  const b = deriveBindings(config({ services: [{ binding: "SELF", service: "bio-plane" }, { binding: "A", service: "agent-worker" },
    { binding: "P", service: "pdf-worker" }, { binding: "G", service: "grp" }] }), { slug: "grp", version: "1" });
  assert.deepEqual(serviceTargets(b, "grp"), ["agent-worker", "pdf-worker"]);
  assert.deepEqual(serviceTargets([], "grp"), []);
});

/* ------------------------------------------------------------------------ R15 */

test("R15: deriveLimits returns {subrequests, cpu_ms?} from cfg.limits", () => {
  assert.deepEqual(deriveLimits({ limits: { subrequests: 500, cpu_ms: 30000 } }), { subrequests: 500, cpu_ms: 30000 });
  assert.deepEqual(deriveLimits({ limits: { subrequests: 1 } }), { subrequests: 1 }, "the smallest positive integer; no cpu_ms is not invented");
  assert.deepEqual(deriveLimits(config()), { subrequests: 500, cpu_ms: 30000 });
});

test("R15: deriveLimits refuses [NO_SUBREQUEST_LIMIT] unless subrequests is a positive integer, and [UNKNOWN_LIMIT_KEY] naming any key but subrequests and cpu_ms", () => {
  for (const cfg of [undefined, null, {}, { limits: null }, { limits: {} }, { limits: { cpu_ms: 10 } },
    ...[0, -1, 1.5, "5", null, NaN, Infinity, true].map((subrequests) => ({ limits: { subrequests } }))])
    assert.equal(code(() => deriveLimits(cfg)), "NO_SUBREQUEST_LIMIT", JSON.stringify(cfg));
  const e = threw(() => deriveLimits({ limits: { subrequests: 5, memory: 1, cpu_ms: 2, burst: 3 } }));
  assert.match(e.message, /^REFUSED \[UNKNOWN_LIMIT_KEY\]: wrangler\.jsonc's limits declares memory, burst, /);
});

test("R15: limitsReadBack is UNDETERMINED when the settings are unreadable or state no limits.subrequests, MISMATCH when it differs, MATCH otherwise", () => {
  const want = { subrequests: 500 };
  for (const st of [null, undefined, "x", 7])
    assert.deepEqual(limitsReadBack(loose(st), want), { verdict: "UNDETERMINED", why: "the script settings could not be read" }, String(st));
  for (const st of [{}, { limits: {} }, { limits: null }, { limits: { subrequests: null } }])
    assert.deepEqual(limitsReadBack(st, want), { verdict: "UNDETERMINED", why: "the script settings state no limits.subrequests" }, JSON.stringify(st));
  for (const got of [50, 501, "500", 0]) {
    const r = limitsReadBack({ limits: { subrequests: got } }, want);
    assert.equal(r.verdict, "MISMATCH", JSON.stringify(got));
    assert.equal(r.why, `settings say limits.subrequests ${got}, the config sent 500`);
  }
  assert.deepEqual(limitsReadBack({ limits: { subrequests: 500, cpu_ms: 1 } }, want), { verdict: "MATCH", why: "limits.subrequests 500 read back" });
});

test("R15: deriveObservability returns {enabled: true}, refusing [NO_OBSERVABILITY] unless observability.enabled is true and [UNKNOWN_OBSERVABILITY_KEY] for any key but enabled", () => {
  assert.deepEqual(deriveObservability({ observability: { enabled: true } }), { enabled: true });
  assert.deepEqual(deriveObservability(config()), { enabled: true });
  for (const [label, cfg] of [["no config", undefined], ["null config", null], ["no key", {}], ["null", { observability: null }],
    ["a boolean", { observability: true }], ["enabled false", { observability: { enabled: false } }],
    ["enabled a string", { observability: { enabled: "true" } }], ["enabled 1", { observability: { enabled: 1 } }],
    ["no enabled", { observability: {} }], ["a list", { observability: [{ enabled: true }] }]])
    assert.equal(code(() => deriveObservability(loose(cfg))), "NO_OBSERVABILITY", label);
  for (const key of ["head_sampling_rate", "logs", "traces"]) {
    const e = threw(() => deriveObservability({ observability: { enabled: true, [key]: 1 } }));
    assert.match(e.message, new RegExp(`^REFUSED \\[UNKNOWN_OBSERVABILITY_KEY\\]: wrangler\\.jsonc's observability declares ${key}, `), key);
  }
});

test("R15: observabilityReadBack is UNREADABLE when the settings are unreadable, MISMATCH when they state no observability or another enabled, MATCH otherwise", () => {
  const want = { enabled: true };
  for (const st of [null, undefined, "x", 0]) assert.equal(observabilityReadBack(loose(st), want).verdict, "UNREADABLE", String(st));
  for (const [label, st] of [["no key (how the platform reports it off)", { limits: {} }], ["not an object", { observability: "on" }],
    ["null", { observability: null }], ["enabled false", { observability: { enabled: false } }], ["enabled missing", { observability: {} }],
    ["enabled a string", { observability: { enabled: "true" } }]]) {
    const r = observabilityReadBack(loose(st), want);
    assert.equal(r.verdict, "MISMATCH", label);
    assert.ok(typeof r.why === "string" && r.why.length > 0, label);
  }
  assert.deepEqual(observabilityReadBack({ observability: { enabled: true } }, want), { verdict: "MATCH", why: "observability.enabled true read back" });
  assert.equal(observabilityReadBack({ observability: { enabled: true, head_sampling_rate: 1 } }, want).verdict, "MATCH",
    "a sub-setting the platform adds is not a difference; only enabled was sent");
});

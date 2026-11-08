/* stewards: Civicsmith's stewards' reporting service (N895; v0.2 rule 21; K2799). A Worker Civicsmith runs apart from
   every group's Civicsmith: the public intake (R3–R6), the guide (R7), the stewards' sign-in, reading and deciding
   (R8–R13), the notice (R14), the purge (R15) and the public register (R22). Its only store is its own Durable Object
   and its only outbound act is the notice through its mail binding (R16). */
import { EmailMessage } from "cloudflare:email";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";
import { readConfig, validateReport, CAPS } from "./config.mjs";
import { SESSION_MS } from "./limits.mjs";
import * as ui from "./ui.mjs";
import { StewardsStore } from "./store.mjs";

export { StewardsStore };
export { KINDS, DECISIONS, SHARED_SERVICES, RULE_PARTS, checkOpen, checkAccount } from "./config.mjs";

const COOKIE = "steward_session";
const enc = new TextEncoder();
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
const sha256 = async (s) => hex(await crypto.subtle.digest("SHA-256", enc.encode(s)));

/* R4: the source, a keyed fingerprint of the connecting address; one shared source when none is stated. */
async function sourceOf(request, cfg) {
  const ip = request.headers.get("cf-connecting-ip") || "";
  const key = await crypto.subtle.importKey("raw", enc.encode(cfg.sourceKey), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return hex(await crypto.subtle.sign("HMAC", key, enc.encode(ip)));
}

function store(env) {
  const stub = env.STORE.get(env.STORE.idFromName("stewards"));
  return async (op, args) => {
    const res = await stub.fetch("https://store.internal/op", { method: "POST", body: JSON.stringify({ op, args }) });
    if (!res.ok) throw new Error("store refused");
    return res.json();
  };
}

const wantsJson = (request) => (request.headers.get("content-type") || "").toLowerCase().startsWith("application/json")
  || (request.headers.get("accept") || "").toLowerCase().includes("application/json");

const WORDS = {
  NOT_YET_OPEN: localize("stewards.index.not_yet_open", "Reporting to Civicsmith's stewards is not yet open."),
  REPORT_BODY_TOO_LARGE: localize("stewards.index.report_too_large", "The report is too large: it must be under 16 KiB in all."),
  BODY_TOO_LARGE: localize("stewards.index.request_too_large", "The request is too large."),
  REPORT_KIND_UNKNOWN: localize("stewards.index.kind_unknown", "The kind of abuse must be one of: fabricated evidence, harassment, impersonation, other."),
  REPORT_CONCERNS_INVALID: localize("stewards.index.concerns_invalid", "What the report concerns must be a team's short name or an https:// address, at most {max} characters.", { max: CAPS.concerns }),
  REPORT_DESCRIPTION_INVALID: localize("stewards.index.description_invalid", "The description must be from 1 to {max} characters.", { max: CAPS.description }),
  REPORT_CONTACT_INVALID: localize("stewards.index.contact_invalid", "The contact must be at most {max} characters.", { max: CAPS.contact }),
  REPORT_RATE_LIMITED: localize("stewards.index.rate_limited", "Too many reports have been sent for now. Please try again later."),
  INTAKE_FULL: localize("stewards.index.intake_full", "The stewards have too many reports waiting to take another now. Please try again later, or write to them by e-mail."),
  INTAKE_UNAVAILABLE: localize("stewards.index.intake_unavailable", "The report could not be taken now. Nothing was kept. Please try again later."),
  STEWARD_SIGNIN_REFUSED: localize("stewards.index.signin_refused", "That name and key do not sign in."),
  STEWARD_SIGNIN_LIMITED: localize("stewards.index.signin_limited", "Too many refused sign-ins. Try again later."),
  STEWARD_SESSION_REQUIRED: localize("stewards.index.session_required", "Sign in as a steward first."),
  CREDENTIAL_IN_ADDRESS: localize("stewards.index.credential_in_address", "Stewards' addresses carry nothing after a question mark; nothing was read."),
  ORIGIN_REFUSED: localize("stewards.index.origin_refused", "This request did not come from the stewards' own pages; nothing was changed."),
  NO_SUCH_REPORT: localize("stewards.index.no_such_report", "There is no such report."),
  DECISION_UNKNOWN: localize("stewards.index.decision_unknown", "The decision must be dismiss or withdraw."),
  NO_REASON: localize("stewards.index.reason_required", "A reason is required, at most {max} characters.", { max: CAPS.reason }),
  WITHDRAW_TARGET_INVALID: localize("stewards.index.withdraw_target_invalid", "A withdrawal names one shared service (a shared profile, the template library, a public listing) and its item."),
  RULE_PART_REQUIRED: localize("stewards.index.rule_part_required", "Withdrawing a public listing names the part of the listing rule it breaks: 1, 2, 3 or 4."),
  RULE_PART_UNKNOWN: localize("stewards.index.rule_part_unknown", "The listing rule has four parts: 1, 2, 3 or 4. There is no other."),
  RULE_PART_NOT_APPLICABLE: localize("stewards.index.rule_part_not_applicable", "Only a public listing's withdrawal names a part of the listing rule."),
  RULE_TEXT_VERSION_UNSET: localize("stewards.index.rule_text_version_unset", "The service's configuration does not say which approved text of the listing rule applies, so a public listing cannot be withdrawn now. Nothing was changed."),
  NOT_WITHDRAWN: localize("stewards.index.not_withdrawn", "No withdrawal of that shared service stands."),
  NOT_FOUND: localize("stewards.index.no_such_page", "There is no such page."),
  METHOD_NOT_ALLOWED: localize("stewards.index.method_not_allowed", "That method is not allowed here."),
};

function refuse(request, status, code, extra = {}, steward = false) {
  const headers = extra.retryAfter ? { "retry-after": String(extra.retryAfter) } : {};
  if (wantsJson(request)) return Response.json({ ok: false, code, message: WORDS[code], ...extra }, { status, headers: { "cache-control": "no-store", ...headers } });
  return ui.html(ui.refusedPage(status, code, WORDS[code], { steward }), status, headers);
}

/* A body read no further than `cap` bytes; null past it. */
async function readCapped(request, cap) {
  const len = Number(request.headers.get("content-length"));
  if (Number.isFinite(len) && len > cap) return null;
  if (!request.body) return "";
  const reader = request.body.getReader(), parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > cap) { try { await reader.cancel(); } catch {} return null; }
    parts.push(value);
  }
  const all = new Uint8Array(size);
  let at = 0;
  for (const p of parts) { all.set(p, at); at += p.byteLength; }
  return new TextDecoder().decode(all);
}

function parseBody(request, text) {
  const type = (request.headers.get("content-type") || "").toLowerCase();
  if (type.startsWith("application/json")) {
    try { const v = JSON.parse(text); return v && typeof v === "object" && !Array.isArray(v) ? v : {}; } catch { return {}; }
  }
  if (type.startsWith("application/x-www-form-urlencoded")) {
    const out = {};
    for (const [k, v] of new URLSearchParams(text)) out[k] = v;
    if ("withdraw_service" in out || "withdraw_item" in out || "withdraw_rule_part" in out) {
      if (out.withdraw_service || out.withdraw_item || out.withdraw_rule_part) {
        out.withdraw = { service: out.withdraw_service, item: out.withdraw_item };
        if (out.withdraw_rule_part) out.withdraw.rule_part = out.withdraw_rule_part;
      }
      delete out.withdraw_service; delete out.withdraw_item; delete out.withdraw_rule_part;
    }
    return out;
  }
  return {};
}

const ROUTES = {
  "/": ["GET"], "/report": ["POST"], "/guide": ["GET"], "/withdrawals": ["GET"],
  "/steward": ["GET"], "/steward/signin": ["POST"], "/steward/signout": ["POST"], "/steward/reports": ["GET"],
  "/steward/decide": ["POST"], "/steward/reinstate": ["POST"], "/steward/withdrawals": ["GET"],
};
export const ROUTE_PATHS = Object.freeze([...Object.keys(ROUTES), "/steward/reports/<n>", "/steward/report/<ref>"]);

function routeOf(path) {
  if (ROUTES[path]) return { path, methods: ROUTES[path] };
  let m = /^\/steward\/reports\/([1-9][0-9]{0,6})$/.exec(path);
  if (m) return { path: "/steward/reports", methods: ["GET"], page: Number(m[1]) };
  m = /^\/steward\/report\/([^/]{1,64})$/.exec(path);
  if (m) return { path: "/steward/report", methods: ["GET"], ref: m[1] };
  return null;
}

const canonical = (v) => Array.isArray(v) ? `[${v.map(canonical).join(",")}]`
  : v && typeof v === "object" ? `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${canonical(v[k])}`).join(",")}}`
  : JSON.stringify(v);
const canonicalResponse = (body) => new Response(body, { headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" } });

async function handle(request, env) {
  const url = new URL(request.url);
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, "") : url.pathname;
  const stewardSide = path === "/steward" || path.startsWith("/steward/");
  /* R9: a credential never travels in an address; refused before anything is read. */
  if (stewardSide && url.search) return refuse(request, 400, "CREDENTIAL_IN_ADDRESS", {}, true);
  const route = routeOf(path);
  if (!route) return refuse(request, 404, "NOT_FOUND");
  const method = request.method === "HEAD" ? "GET" : request.method;
  if (!route.methods.includes(method)) return refuse(request, 405, "METHOD_NOT_ALLOWED", {}, stewardSide);
  const cfg = readConfig(env);

  if (route.path === "/guide") return ui.html(ui.guidePage(cfg.open));
  if (route.path === "/") return ui.html(cfg.open ? ui.reportPage(cfg) : ui.notYetOpenPage());
  if (!cfg.open) return refuse(request, 503, "NOT_YET_OPEN", {}, stewardSide);
  if (route.path === "/report") return intake(request, env, cfg);
  if (route.path === "/withdrawals") return publicRegister(request, env);
  return steward(request, env, cfg, route, url);
}

/* R3, R4, R14. */
async function intake(request, env, cfg) {
  const text = await readCapped(request, CAPS.body);
  if (text == null) return refuse(request, 400, "REPORT_BODY_TOO_LARGE", { field: "the whole report" });
  const v = validateReport(parseBody(request, text));
  if (v.code) return refuse(request, 400, v.code, { field: v.field });
  let answer;
  try {
    answer = await store(env)("intake", { source: await sourceOf(request, cfg), now: Date.now(), report: v.report });
  } catch {
    return refuse(request, 503, "INTAKE_UNAVAILABLE");
  }
  if (answer.refused === "REPORT_RATE_LIMITED") return refuse(request, 429, answer.refused, { retryAfter: answer.retryAfter });
  if (answer.refused) return refuse(request, 503, answer.refused);
  await notify(env, cfg, request, { ...answer, kind: v.report.kind });
  if (wantsJson(request)) return Response.json({ ok: true, ref: answer.ref }, { headers: { "cache-control": "no-store" } });
  return ui.html(ui.receivedPage(answer.ref, v.report.contact != null));
}

async function notify(env, cfg, request, { ref, received, kind }) {
  try {
    if (!cfg.address) return;
    if (!cfg.from) throw new Error("no sender");
    const stewardsPage = `${new URL(request.url).origin}/steward`;
    const domain = cfg.from.split("@")[1];
    const raw = [`From: ${localize("stewards.index.notice_sender", "Civicsmith's stewards' reporting service")} <${cfg.from}>`, `To: <${cfg.address}>`,
      `Subject: ${localize("stewards.index.notice_subject", "A report has arrived ({ref})", { ref })}`, `Date: ${new Date(received).toUTCString()}`, `Message-ID: <${ref}@${domain}>`,
      "MIME-Version: 1.0", "Content-Type: text/plain; charset=utf-8", "Content-Transfer-Encoding: 8bit", "",
      ui.notifyText({ ref, kind, received, stewardsPage })].join("\r\n");
    await env.NOTIFY.send(new EmailMessage(cfg.from, cfg.address, raw));
  } catch {
    console.log(`stewards: notification failed for ${ref}`);
  }
}

/* R22. */
async function publicRegister(request, env) {
  const { register } = await store(env)("register", {});
  const rows = register.map(({ service, item, since, kind }) => ({ service, item, since, kind }));
  if ((request.headers.get("accept") || "").toLowerCase().includes("application/json")) return canonicalResponse(canonical(rows));
  return ui.html(ui.publicRegisterPage(rows));
}

function cookieOf(request) {
  for (const part of (request.headers.get("cookie") || "").split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k === COOKIE) return v.join("=");
  }
  return null;
}
const setCookie = (value, maxAge) => `${COOKIE}=${value}; HttpOnly; Secure; SameSite=Strict; Path=/steward; Max-Age=${maxAge}`;

function equalHex(a, b) {
  if (a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* R8–R13. */
async function steward(request, env, cfg, route, url) {
  const call = store(env);
  const json = wantsJson(request);
  if (request.method === "POST" && request.headers.get("origin") !== url.origin) return refuse(request, 403, "ORIGIN_REFUSED", {}, true);
  const now = Date.now();

  if (route.path === "/steward/signin") {
    const text = await readCapped(request, CAPS.body);
    if (text == null) return refuse(request, 413, "BODY_TOO_LARGE", {}, true);
    const { name, key } = parseBody(request, text);
    const entry = cfg.stewards.find((s) => s.name === name);
    const digest = await sha256(typeof key === "string" ? key : "");
    const same = equalHex(digest, entry ? entry.sha : "0".repeat(64));
    const match = !!entry && same && typeof key === "string" && key.length > 0;
    const session = hex(crypto.getRandomValues(new Uint8Array(32)));
    const r = await call("signin", { source: await sourceOf(request, cfg), now, match, name: entry?.name ?? null,
      hash: await sha256(session), expires: now + SESSION_MS });
    if (r.refused === "STEWARD_SIGNIN_LIMITED") return refuse(request, 429, r.refused, { retryAfter: r.retryAfter }, true);
    if (r.refused) return refuse(request, 401, r.refused, {}, true);
    const headers = { "set-cookie": setCookie(session, SESSION_MS / 1000), "cache-control": "no-store" };
    if (json) return Response.json({ ok: true, name: entry.name }, { headers });
    return new Response(null, { status: 303, headers: { ...headers, location: "/steward" } });
  }

  /* Every other steward route reads the session from the cookie only. */
  const value = cookieOf(request);
  let name = null, hash = null;
  if (value) {
    hash = await sha256(value);
    const s = await call("session", { hash, now });
    if (s.ok) {
      if (cfg.stewards.some((x) => x.name === s.name)) name = s.name;
      else await call("signout", { hash }); /* R10: a removed steward's session ends at its next use. */
    }
  }
  if (route.path === "/steward" && !name) return ui.html(ui.signinPage());
  if (!name) return refuse(request, 401, "STEWARD_SESSION_REQUIRED", {}, true);

  if (route.path === "/steward") return ui.html(ui.stewardHome(name));
  if (route.path === "/steward/signout") {
    await call("signout", { hash });
    const headers = { "set-cookie": setCookie("", 0), "cache-control": "no-store" };
    return json ? Response.json({ ok: true }, { headers }) : new Response(null, { status: 303, headers: { ...headers, location: "/steward" } });
  }
  if (route.path === "/steward/reports") {
    const n = route.page || 1;
    const r = await call("list", { page: n });
    return json ? Response.json({ ok: true, page: n, more: r.more, reports: r.reports }) : ui.html(ui.reportsPage(r.reports, n, r.more));
  }
  if (route.path === "/steward/report") {
    const r = await call("get", { ref: route.ref });
    if (r.refused) return refuse(request, 404, r.refused, {}, true);
    return json ? Response.json(r) : ui.html(ui.reportDetailPage(r));
  }
  if (route.path === "/steward/withdrawals") {
    const { register } = await call("register", {});
    const body = canonical(register);
    return canonicalResponse(canonical({ register, sha256: await sha256(body) }));
  }
  const text = await readCapped(request, CAPS.body);
  if (text == null) return refuse(request, 413, "BODY_TOO_LARGE", {}, true);
  const b = parseBody(request, text);
  if (route.path === "/steward/decide") {
    const r = await call("decide", { ref: b.ref, decision: b.decision, reason: b.reason, withdraw: b.withdraw, steward: name, now,
      ruleTextVersion: cfg.ruleTextVersion });
    if (r.refused) return refuse(request, r.refused === "NO_SUCH_REPORT" ? 404 : r.refused === "RULE_TEXT_VERSION_UNSET" ? 503 : 400, r.refused, {}, true);
    return json ? Response.json(r) : new Response(null, { status: 303, headers: { location: `/steward/report/${encodeURIComponent(r.ref)}` } });
  }
  /* /steward/reinstate */
  const r = await call("reinstate", { service: b.service, item: b.item, reason: b.reason, steward: name, now });
  if (r.refused) return refuse(request, 400, r.refused, {}, true);
  return json ? Response.json(r) : new Response(null, { status: 303, headers: { location: `/steward/report/${encodeURIComponent(r.ref)}` } });
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch {
      console.log("stewards: a request failed");
      return new Response(localize("stewards.index.service_could_not_answer", "The service could not answer now."), { status: 500, headers: { "content-type": "text/plain; charset=utf-8" } });
    }
  },
  /* R15: the daily purge. */
  async scheduled(_event, env) {
    const cfg = readConfig(env);
    if (!cfg.open) return;
    const r = await store(env)("purge", { now: Date.now(), contactDays: cfg.contactDays, reportDays: cfg.reportDays });
    console.log(`stewards: purge erased ${r.contactsErased} contacts and deleted ${r.reportsDeleted} reports`);
  },
};

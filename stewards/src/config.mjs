/* stewards: the service's vocabulary, its configuration (R1, R10), and the deploy check (R2, R21). Pure: no I/O. */
import { GROUP_SLUG_RE } from "../../bio-plane/src/setup-fleet.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

export const KINDS = Object.freeze(["fabricated_evidence", "harassment", "impersonation", "other"]);
export const DECISIONS = Object.freeze(["dismiss", "withdraw"]);
export const SHARED_SERVICES = Object.freeze(["shared_profile", "template_library", "public_listing"]);
export const STATES = Object.freeze(["undecided", "dismissed", "withdrawn"]);
/* R24: the parts of the approved listing rule (Publication §5E, Bob 2026-10-15), in the order Bob's text gives them; a
   closed list. 1 not a group using Civicsmith, or advertising or spam; 2 pretending to be another group, person or office;
   3 published against a court's order or unlawful to publish; 4 aimed at a private person's home, family or private life. */
export const RULE_PARTS = Object.freeze(["1", "2", "3", "4"]);

export const PINNED_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
export const OPEN_VARS = Object.freeze(["STEWARDS_ADDRESS", "REPORT_RETENTION_DAYS", "CONTACT_RETENTION_DAYS"]);
export const OPEN_SECRETS = Object.freeze(["STEWARD_KEYS", "SOURCE_KEY"]);

/* R3's and R12's caps. */
export const CAPS = Object.freeze({ body: 16 * 1024, concerns: 2048, description: 8000, contact: 254, reason: 4000, item: 512 });

const chars = (s) => [...s].length;
const utf8Len = (s) => new TextEncoder().encode(s).length;

/* R1: exactly one e-mail address, one local@domain. */
export function validAddress(v) {
  if (typeof v !== "string" || v.length === 0 || v.length > 254) return false;
  return /^[^\s@,<>"()\[\];:\\]+@[^\s@,<>"()\[\];:\\]+\.[^\s@,<>"()\[\];:\\.]+$/.test(v) && !/\.\./.test(v);
}

/* R1: a whole number from 1 to 3650, written plainly. */
export function retentionDays(v) {
  if (typeof v === "number" && Number.isInteger(v)) v = String(v);
  if (typeof v !== "string" || !/^[1-9][0-9]{0,3}$/.test(v)) return null;
  const n = Number(v);
  return n <= 3650 ? n : null;
}

/* R24: a calendar date written YYYY-MM-DD. */
export function validDate(v) {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const d = new Date(`${v}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v;
}

/* R10: one line per steward, `name:sha256`; any malformed line makes the whole value unset. */
export function parseStewardKeys(v) {
  if (typeof v !== "string") return null;
  const out = [];
  for (const raw of v.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const at = line.lastIndexOf(":");
    if (at < 1) return null;
    const name = line.slice(0, at), sha = line.slice(at + 1).toLowerCase();
    if (chars(name) > 64 || /[\u0000-\u001f\u007f-\u009f]/u.test(name) || !/^[0-9a-f]{64}$/.test(sha)) return null;
    if (out.some((s) => s.name === name)) return null;
    out.push({ name, sha });
  }
  return out.length ? out : null;
}

/* R1: the configuration as the service reads it, each value null when absent, empty or malformed. */
export function readConfig(env = {}) {
  const address = validAddress(env.STEWARDS_ADDRESS) ? env.STEWARDS_ADDRESS : null;
  const reportDays = retentionDays(env.REPORT_RETENTION_DAYS);
  const contactDays = retentionDays(env.CONTACT_RETENTION_DAYS);
  const stewards = parseStewardKeys(env.STEWARD_KEYS);
  const sourceKey = typeof env.SOURCE_KEY === "string" && utf8Len(env.SOURCE_KEY) >= 32 ? env.SOURCE_KEY : null;
  const from = validAddress(env.NOTIFY_FROM) ? env.NOTIFY_FROM : null;
  const ruleTextVersion = validDate(env.LISTING_RULE_TEXT_VERSION) ? env.LISTING_RULE_TEXT_VERSION : null;
  const open = !!(address && reportDays && contactDays && stewards && sourceKey);
  return { open, address, reportDays, contactDays, stewards, sourceKey, from, ruleTextVersion };
}

/* JSONC as wrangler writes it: comments and trailing commas outside strings. */
export function parseJsonc(text) {
  let out = "", i = 0, inStr = false;
  while (i < text.length) {
    const c = text[i], d = text[i + 1];
    if (inStr) {
      out += c;
      if (c === "\\") { out += d ?? ""; i += 2; continue; }
      if (c === '"') inStr = false;
      i++;
    } else if (c === '"') { inStr = true; out += c; i++; }
    else if (c === "/" && d === "/") { while (i < text.length && text[i] !== "\n") i++; }
    else if (c === "/" && d === "*") { i += 2; while (i < text.length && !(text[i] === "*" && text[i + 1] === "/")) i++; i += 2; }
    else { out += c; i++; }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, "$1"));
}

const asConfig = (w) => (typeof w === "string" ? parseJsonc(w) : w || {});

/* R2: null when the deploy configuration would open the service; otherwise what is missing or malformed, by name and
   in words. Secret values are never seen here, only their names. */
export function checkOpen({ wranglerJsonc, secretNames = [] } = {}) {
  let cfg;
  try { cfg = asConfig(wranglerJsonc); } catch { return [{ name: "wrangler.jsonc", problem: localize("stewards.config.deploy_configuration_unreadable", "the deploy configuration could not be read") }]; }
  const vars = cfg.vars || {}, problems = [];
  if (!(("STEWARDS_ADDRESS") in vars)) problems.push({ name: "STEWARDS_ADDRESS", problem: localize("stewards.config.address_not_set", "is not set: the stewards' contact address is missing") });
  else if (!validAddress(vars.STEWARDS_ADDRESS)) problems.push({ name: "STEWARDS_ADDRESS", problem: localize("stewards.config.address_not_one", "is not exactly one e-mail address") });
  for (const n of ["REPORT_RETENTION_DAYS", "CONTACT_RETENTION_DAYS"]) {
    if (!(n in vars)) problems.push({ name: n, problem: localize("stewards.config.retention_not_set", "is not set: a retention period in days is missing") });
    else if (retentionDays(vars[n]) == null) problems.push({ name: n, problem: localize("stewards.config.retention_not_days", "is not a whole number of days from 1 to 3650") });
  }
  const names = new Set(secretNames);
  for (const n of OPEN_SECRETS) if (!names.has(n)) problems.push({ name: n, problem: localize("stewards.config.secret_missing", "is not among the Worker's secrets") });
  for (const n of OPEN_SECRETS) if (n in vars) problems.push({ name: n, problem: localize("stewards.config.secret_in_vars", "must be a secret, never a plain variable") });
  const dest = (cfg.send_email || []).find((b) => b.name === "NOTIFY")?.destination_address;
  if (dest != null && dest !== vars.STEWARDS_ADDRESS) problems.push({ name: "NOTIFY", problem: localize("stewards.config.notify_destination_differs", "the mail binding's destination is not STEWARDS_ADDRESS") });
  return problems.length ? problems : null;
}

/* R2, R21: the account the configuration deploys to is the project's pinned one. */
export function checkAccount(wranglerJsonc) {
  let cfg;
  try { cfg = asConfig(wranglerJsonc); } catch { return { name: "account_id", problem: localize("stewards.config.deploy_configuration_unreadable", "the deploy configuration could not be read") }; }
  return cfg.account_id === PINNED_ACCOUNT ? null
    : { name: "account_id", problem: localize("stewards.config.account_not_pinned", "is not the project's pinned Cloudflare account ({account})", { account: PINNED_ACCOUNT }) };
}

/* R3: the report's fields, in R3's refusal order. Answers {code, field} or {report}. */
export function validateReport(body) {
  const b = body && typeof body === "object" ? body : {};
  if (typeof b.kind !== "string" || !KINDS.includes(b.kind)) return { code: "REPORT_KIND_UNKNOWN", field: "kind" };
  if (!validConcerns(b.concerns)) return { code: "REPORT_CONCERNS_INVALID", field: "concerns" };
  if (typeof b.description !== "string" || chars(b.description) < 1 || chars(b.description) > CAPS.description)
    return { code: "REPORT_DESCRIPTION_INVALID", field: "description" };
  let contact = b.contact;
  if (contact === undefined || contact === null || contact === "") contact = null;
  else if (typeof contact !== "string" || chars(contact) > CAPS.contact) return { code: "REPORT_CONTACT_INVALID", field: "contact" };
  return { report: { kind: b.kind, concerns: b.concerns, description: b.description, contact } };
}

export function validConcerns(v) {
  if (typeof v !== "string" || v.length === 0 || chars(v) > CAPS.concerns) return false;
  if (GROUP_SLUG_RE.test(v)) return true;
  if (!v.startsWith("https://") || /[\s\u0000-\u001f\u007f]/u.test(v)) return false;
  try { const u = new URL(v); return u.protocol === "https:" && !!u.hostname && !u.username && !u.password; } catch { return false; }
}

/* R12's target. */
export function validTarget(w) {
  return !!w && typeof w === "object" && SHARED_SERVICES.includes(w.service)
    && typeof w.item === "string" && chars(w.item) >= 1 && chars(w.item) <= CAPS.item;
}

/* R24: a listing withdrawal's rule part, after R12's refusals. Answers a refusal code, or null. A part may come as the
   string or the whole number of its place in RULE_PARTS. */
export const rulePartOf = (w) => {
  const v = w?.rule_part;
  if (v === undefined || v === null || v === "") return null;
  return typeof v === "number" && Number.isInteger(v) ? String(v) : v;
};
export function checkRulePart(w) {
  const part = rulePartOf(w);
  if (w.service !== "public_listing") return part == null ? null : "RULE_PART_NOT_APPLICABLE";
  if (part == null) return "RULE_PART_REQUIRED";
  return typeof part === "string" && RULE_PARTS.includes(part) ? null : "RULE_PART_UNKNOWN";
}

export const validReason = (r) => typeof r === "string" && r.trim().length > 0 && chars(r) <= CAPS.reason;

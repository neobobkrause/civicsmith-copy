/* stewards: the service's vocabulary, its configuration (R1, R10), and the deploy check (R2, R21). Pure: no I/O. */
import { GROUP_SLUG_RE } from "../../bio-plane/src/setup-fleet.mjs";
import { localize } from "../../bio-plane/src/setup-words/index.mjs";

/**
 * @typedef {"fabricated_evidence" | "harassment" | "impersonation" | "other"} Kind
 * @typedef {"dismiss" | "withdraw"} Decision
 * @typedef {"shared_profile" | "template_library" | "public_listing"} SharedService
 * @typedef {"undecided" | "dismissed" | "withdrawn"} ReportState
 */
/**
 * @typedef {Object} Steward
 * @property {string} name the steward's name
 * @property {string} sha the hex SHA-256 of the steward's key
 * @bound name: 1 to 64 printable characters
 * @bound sha: 64 lower-case hex digits
 */
/**
 * @typedef {Object} Config
 * @property {boolean} open
 * @property {string | null} address
 * @property {number | null} reportDays
 * @property {number | null} contactDays
 * @property {Steward[] | null} stewards
 * @property {string | null} sourceKey
 * @property {string | null} from
 * @bound open: true only when address, reportDays, contactDays, stewards and sourceKey are all set
 */
/**
 * @typedef {Object} Problem
 * @property {string} name the variable, secret or binding at fault
 * @property {string} problem what is wrong, in words
 */
/**
 * @typedef {Object} ReportFields
 * @property {Kind} kind
 * @property {string} concerns
 * @property {string} description
 * @property {string | null} contact
 * @bound concerns: a group slug or an https:// address, at most 2,048 characters
 * @bound description: 1 to 8,000 characters
 * @bound contact: at most 254 characters
 */
/**
 * @typedef {Object} WithdrawTarget
 * @property {SharedService} service
 * @property {string} item
 * @bound item: 1 to 512 characters
 */

/** @type {readonly Kind[]} */
export const KINDS = Object.freeze(["fabricated_evidence", "harassment", "impersonation", "other"]);
/** @type {readonly Decision[]} */
export const DECISIONS = Object.freeze(["dismiss", "withdraw"]);
/** @type {readonly SharedService[]} */
export const SHARED_SERVICES = Object.freeze(["shared_profile", "template_library", "public_listing"]);
/** @type {readonly ReportState[]} */
export const STATES = Object.freeze(["undecided", "dismissed", "withdrawn"]);

export const PINNED_ACCOUNT = "20b533579290b9b93168345edd3b7f72";
export const OPEN_VARS = Object.freeze(["STEWARDS_ADDRESS", "REPORT_RETENTION_DAYS", "CONTACT_RETENTION_DAYS"]);
export const OPEN_SECRETS = Object.freeze(["STEWARD_KEYS", "SOURCE_KEY"]);

/* R3's and R12's caps. */
export const CAPS = Object.freeze({ body: 16 * 1024, concerns: 2048, description: 8000, contact: 254, reason: 4000, item: 512 });

const chars = (s) => [...s].length;
const utf8Len = (s) => new TextEncoder().encode(s).length;

/**
 * R1: exactly one e-mail address, one local@domain.
 * @param {unknown} v
 * @returns {v is string}
 * @bound v: at most 254 characters, no spaces, no comma
 */
export function validAddress(v) {
  if (typeof v !== "string" || v.length === 0 || v.length > 254) return false;
  return /^[^\s@,<>"()\[\];:\\]+@[^\s@,<>"()\[\];:\\]+\.[^\s@,<>"()\[\];:\\.]+$/.test(v) && !/\.\./.test(v);
}

/**
 * R1: a whole number from 1 to 3650, written plainly.
 * @param {unknown} v
 * @returns {number | null}
 * @bound the answer: a whole number, 1 to 3650, or null
 */
export function retentionDays(v) {
  if (typeof v === "number" && Number.isInteger(v)) v = String(v);
  if (typeof v !== "string" || !/^[1-9][0-9]{0,3}$/.test(v)) return null;
  const n = Number(v);
  return n <= 3650 ? n : null;
}

/**
 * R10: one line per steward, `name:sha256`; any malformed line makes the whole value unset.
 * @param {unknown} v
 * @returns {Steward[] | null}
 */
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

/**
 * R1: the configuration as the service reads it, each value null when absent, empty or malformed.
 * @param {Record<string, unknown>} [env]
 * @returns {Config}
 */
export function readConfig(env = {}) {
  const address = validAddress(env.STEWARDS_ADDRESS) ? env.STEWARDS_ADDRESS : null;
  const reportDays = retentionDays(env.REPORT_RETENTION_DAYS);
  const contactDays = retentionDays(env.CONTACT_RETENTION_DAYS);
  const stewards = parseStewardKeys(env.STEWARD_KEYS);
  const sourceKey = typeof env.SOURCE_KEY === "string" && utf8Len(env.SOURCE_KEY) >= 32 ? env.SOURCE_KEY : null;
  const from = validAddress(env.NOTIFY_FROM) ? env.NOTIFY_FROM : null;
  const open = !!(address && reportDays && contactDays && stewards && sourceKey);
  return { open, address, reportDays, contactDays, stewards, sourceKey, from };
}

/**
 * JSONC as wrangler writes it: comments and trailing commas outside strings.
 * @param {string} text
 * @returns {any}
 * @throws {SyntaxError} when the text is not JSONC
 */
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
/**
 * @param {{ wranglerJsonc?: string | Object, secretNames?: Iterable<string> }} [args]
 * @returns {Problem[] | null}
 */
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

/**
 * R2, R21: the account the configuration deploys to is the project's pinned one.
 * @param {string | Object} wranglerJsonc
 * @returns {Problem | null}
 */
export function checkAccount(wranglerJsonc) {
  let cfg;
  try { cfg = asConfig(wranglerJsonc); } catch { return { name: "account_id", problem: localize("stewards.config.deploy_configuration_unreadable", "the deploy configuration could not be read") }; }
  return cfg.account_id === PINNED_ACCOUNT ? null
    : { name: "account_id", problem: localize("stewards.config.account_not_pinned", "is not the project's pinned Cloudflare account ({account})", { account: PINNED_ACCOUNT }) };
}

/**
 * R3: the report's fields, in R3's refusal order. Answers {code, field} or {report}.
 * @param {any} body
 * @returns {{ code: string, field: string, report?: undefined } | { report: ReportFields, code?: undefined, field?: undefined }}
 */
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

/**
 * R3: a group's slug, or an https:// address of a group's Civicsmith or a published case.
 * @param {unknown} v
 * @returns {boolean}
 * @bound v: at most 2,048 characters
 */
export function validConcerns(v) {
  if (typeof v !== "string" || v.length === 0 || chars(v) > CAPS.concerns) return false;
  if (GROUP_SLUG_RE.test(v)) return true;
  if (!v.startsWith("https://") || /[\s\u0000-\u001f\u007f]/u.test(v)) return false;
  try { const u = new URL(v); return u.protocol === "https:" && !!u.hostname && !u.username && !u.password; } catch { return false; }
}

/**
 * R12's target.
 * @param {any} w
 * @returns {boolean}
 */
export function validTarget(w) {
  return !!w && typeof w === "object" && SHARED_SERVICES.includes(w.service)
    && typeof w.item === "string" && chars(w.item) >= 1 && chars(w.item) <= CAPS.item;
}

/**
 * R12, R13: a reason, 1 to 4,000 characters, not only spaces.
 * @type {(r: unknown) => boolean}
 */
export const validReason = (r) => typeof r === "string" && r.trim().length > 0 && chars(r) <= CAPS.reason;

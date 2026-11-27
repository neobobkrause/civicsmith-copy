/* The provider contract's descriptor (R19) and engine families (R31): pure, never throwing.
 *
 * Beside R19's fields a descriptor may state four of this module's own: `max_bytes` (the tool's size limit, R5),
 * `template: true` (a generic transport whose hosts, engine family and handling the administrator supplies, R20) and
 * `host_from_spec: true` (a product the organization runs on its own servers, whose host the spec names, as a
 * template's is), and `per_engine: true` (a tool that reports one result per engine, each verdict then of its engine's
 * family alone, R31). `hosts` is a list of host names, or an object of such lists by region; a name `*.example.com`
 * stands for any host under that domain. */

/**
 * @typedef {Object} HandlingFields a tool's data-handling statement (R19, R33): each a stated value or `"not stated"`
 * @property {boolean} on_own true when the recipient is the organization's own server or service (R33)
 * @property {string[] | 'not stated'} sends what the tool is sent, each one of `SENDS`
 * @property {readonly string[] | 'not stated'} never_sends what it is never sent; includes `NEVER_SENDS_REQUIRED`
 * @property {string} recipient who receives what is sent
 * @property {readonly string[] | 'not stated'} sub_processors
 * @property {string} region
 * @property {string} file_retention
 * @property {string} result_retention
 * @property {string} sample_sharing one of `SAMPLE_SHARING`
 */
/** @typedef {Readonly<HandlingFields>} Handling a tool's data-handling statement, frozen */
/**
 * @typedef {Object} ConfigEntryFields one setting a descriptor's adapter reads from the spec's `config` (R19, N777, T38)
 * @property {string} name lower case, digits and `_`; `host` and `region` stand for the spec's own fields (`SPEC_FIELDS`)
 * @property {string | null} label what a settings page asks; null only on the catalogue's region mark before it is filled
 * @property {boolean} required
 * @property {string} [structured] `list` or `handling` (`STRUCTURED`) for a value that is not one text
 */
/** @typedef {Readonly<ConfigEntryFields>} ConfigEntry one setting a descriptor's adapter reads, frozen */
/**
 * @typedef {Object} ModeRequiredFields a tool's private mode (R22, S11)
 * @property {string} description
 * @property {Readonly<Record<string, string>>} params the parameters every request of the mode carries
 */
/** @typedef {Readonly<ModeRequiredFields>} ModeRequired a tool's private mode, frozen */
/**
 * @typedef {Object} TestProbe what R28's test sends through the tool's adapter
 * @property {string} kind one of `eicar`, `macro_document`, `test_address`, `zero_counts`
 * @property {string} [address] the vendor's documented test address, for `test_address`
 */
/** @typedef {string[] | Record<string, string[]>} Hosts a descriptor's hosts: one list, or lists by region */
/**
 * @typedef {Object} DescriptorFields an outside tool's descriptor (R19), with this module's own four fields
 * @property {string} provider_id
 * @property {string} vendor
 * @property {string} product
 * @property {readonly string[]} kinds a non-empty subset of `KINDS`
 * @property {string} transport one of `TRANSPORTS`
 * @property {string} reach `public` or `tunnel`
 * @property {Hosts} hosts
 * @property {readonly string[]} engine_family a non-empty list of engine-family names (R31)
 * @property {readonly string[]} credentials the names of the credential fields, never values
 * @property {readonly ConfigEntry[]} config
 * @property {TestProbe} test_probe
 * @property {Handling} handling
 * @property {ModeRequired | null} mode_required
 * @property {string | null} mode_check
 * @property {string} licence_note
 * @property {readonly string[]} source_urls
 * @property {string} read_on a date, YYYY-MM-DD
 * @property {number} [max_bytes] the tool's size limit (R5)
 * @property {true} [template] a generic transport the administrator completes (R20)
 * @property {true} [host_from_spec] a product whose host the spec names
 * @property {true} [per_engine] a tool that reports one result per engine (R31)
 */
/** @typedef {Readonly<DescriptorFields>} Descriptor an outside tool's descriptor (R19), frozen */
/** @typedef {string | number | boolean | null | object} ConfigItem one item of a list or record in a spec's `config` */
/**
 * @typedef {string | number | boolean | null | ConfigItem[] | {readonly [key: string]: ConfigItem}} ConfigValue one
 *   value of a spec's `config` or `credentials`, as the plane's request body carries it (JSON)
 */
/** @typedef {Readonly<Record<string, ConfigValue | undefined>>} SpecConfig a spec's `config`: the settings by their `ConfigEntry` names */
/**
 * @typedef {Object} ToolSpec the tool spec the plane sends with every outside call (R21), as its request states it
 * @property {string} provider_id
 * @property {string} tool_id
 * @property {string} [region]
 * @property {string} [host] a template's, or a product on the organization's servers, `host` or `host:port`
 * @property {SpecConfig} [config]
 * @property {SpecConfig} credentials each credential field by its name; used for the call only (R13)
 * @property {boolean} [handling_confirmed]
 * @property {number} [monthly_limit_left]
 */
/**
 * @typedef {Object} Verdict one engine's verdict on a target (the module's terms; R3, R5, R23)
 * @property {string | null} capture_sha
 * @property {string} tool the descriptor's `provider_id`, or `clamav`
 * @property {string | undefined} engine its descriptor's family name for it (R31)
 * @property {string} engine_version as reported, else `not reported`
 * @property {Readonly<Record<string, string>> | null} signatures as the engine states them, or null
 * @property {string} scanned_at an ISO instant
 * @property {string} result `clean`, `found`, `suspicious`, `unknown`, `encrypted` or `not_scanned`
 * @property {string[]} findings names, for `found` and `suspicious`; else empty
 * @property {string} [reason] for `not_scanned`
 * @property {string} [detail]
 * @property {string} [vendor_ref] the tool's id for its result, never a file name
 * @property {number} latency_ms
 */
/**
 * @typedef {Object} CountsRecord the counts record a log sink is sent (R27): a period and counts by `LOG_COUNT_KINDS`
 * @property {{from: string, to: string}} period ISO instants, `from` before `to`
 * @property {Readonly<Record<string, number>>} counts each a whole number, zero or more
 */
/**
 * @typedef {{ok: true} | {ok: false, code: string, field?: string}} Validation R19's answer: `{ok:true}` or the first
 *   refusal, with the field for `DESCRIPTOR_MALFORMED`
 */

export const KINDS = Object.freeze(['scan', 'cdr', 'sandbox', 'url_reputation', 'log_sink']);
export const TRANSPORTS = Object.freeze(['https', 'icap', 'syslog_tls', 'azure_blob']);
export const SAMPLE_SHARING = Object.freeze(['none', 'vendor_internal_research', 'third_parties', 'public', 'not stated']);
export const SENDS = Object.freeze(['file_bytes', 'url', 'hostname', 'hash_prefix', 'counts']);
export const NEVER_SENDS_REQUIRED = Object.freeze(['file_name', 'member_identity', 'ip_address']);
export const NOT_STATED = 'not stated';
/** @type {readonly string[]} */
const HANDLING_FIELDS = ['on_own', 'sends', 'never_sends', 'recipient', 'sub_processors', 'region', 'file_retention',
  'result_retention', 'sample_sharing'];
/** @type {readonly string[]} */
const FIELDS = ['provider_id', 'vendor', 'product', 'kinds', 'transport', 'reach', 'hosts', 'engine_family',
  'credentials', 'config', 'test_probe', 'handling', 'mode_required', 'mode_check', 'licence_note', 'source_urls', 'read_on'];
/** @type {readonly string[]} */
const OWN = ['max_bytes', 'template', 'host_from_spec', 'per_engine'];
/** @type {readonly string[]} */
const PROBES = ['eicar', 'macro_document', 'test_address', 'zero_counts'];
// Who Cloudflare is, for S12: a url_reputation tool may send an address only to Cloudflare in the group's account.
const CLOUDFLARE = /^cloudflare\b/i;

/** @param {unknown} v @returns {boolean} */
const str = (v) => typeof v === 'string' && v.length > 0;
/** @param {string[] | readonly string[]} v @param {boolean} nonEmpty @returns {boolean} */
const strList = (v, nonEmpty) => Array.isArray(v) && (!nonEmpty || v.length > 0) && v.every(str);
/**
 * @template T
 * @param {T | 'not stated'} v @param {(v: T) => boolean} check @returns {boolean}
 */
const stated = (v, check) => v === NOT_STATED || check(v);
/** @param {string} h @returns {boolean} */
const hostName = (h) => str(h) && /^(\*\.)?[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+$/.test(h);

const CONFIG_NAME = /^[a-z][a-z0-9_]*$/;
/** R19 (T38): a `config` entry whose value is not one text says which shape it is. */
export const STRUCTURED = Object.freeze(['list', 'handling']);
/** @type {readonly unknown[]} `STRUCTURED`, asked of a value not yet known to be a text */
const STRUCTURED_ANY = STRUCTURED;
/** R19 (T38): the `config` names that stand for the spec's own `host` and `region` (R21), not for `spec.config`. */
export const SPEC_FIELDS = Object.freeze(['host', 'region']);
/** R19 (N777, T38): `config` is `[{name, label, required, structured?}]`, each name once; an empty list when the
 *  adapter reads none.
 * @param {ConfigEntry[] | readonly ConfigEntry[]} v @returns {boolean} */
function configList(v) {
  if (!Array.isArray(v)) return false;
  /** @type {Set<string>} */
  const names = new Set();
  for (const f of v) {
    if (!f || typeof f !== 'object' || Array.isArray(f)) return false;
    const keys = Object.keys(f).filter((k) => k !== 'structured');
    if (keys.length !== 3 || !CONFIG_NAME.test(f.name || '') || !str(f.label) || typeof f.required !== 'boolean') return false;
    const structured = f.structured;
    if ('structured' in f && !STRUCTURED_ANY.includes(structured)) return false;
    if (names.has(f.name)) return false;
    names.add(f.name);
  }
  return true;
}

/** The hosts a descriptor states, flattened over its regions.
 * @param {{hosts: Hosts}} d @returns {string[]} */
export function allHosts(d) {
  const hosts = d.hosts;
  if (Array.isArray(hosts)) return hosts;
  return Object.values(hosts || {}).flat();
}

/** @param {Descriptor | null | undefined} d @returns {string | null} */
function malformed(d) {
  if (!d || typeof d !== 'object' || Array.isArray(d)) return 'descriptor';
  for (const k of Object.keys(d)) if (!FIELDS.includes(k) && !OWN.includes(k)) return k;
  for (const k of FIELDS) if (!(k in d)) return k;
  if (!str(d.provider_id) || !/^[a-z0-9][a-z0-9-]*$/.test(d.provider_id)) return 'provider_id';
  if (!str(d.vendor)) return 'vendor';
  if (!str(d.product)) return 'product';
  if (!strList(d.kinds, true) || !d.kinds.every((k) => KINDS.includes(k)) || new Set(d.kinds).size !== d.kinds.length) return 'kinds';
  if (!TRANSPORTS.includes(d.transport)) return 'transport';
  if (d.reach !== 'public' && d.reach !== 'tunnel') return 'reach';
  const own = d.template === true || d.host_from_spec === true;
  const hosts = d.hosts;
  if (Array.isArray(hosts)) {
    if (!hosts.every(hostName) || (!own && hosts.length === 0)) return 'hosts';
  } else if (hosts && typeof hosts === 'object') {
    const lists = Object.entries(hosts);
    if (!lists.length || !lists.every(([r, l]) => str(r) && Array.isArray(l) && l.every(hostName))) return 'hosts';
  } else return 'hosts';
  if (!strList(d.engine_family, true)) return 'engine_family';
  if (!strList(d.credentials, false)) return 'credentials';
  if (!configList(d.config)) return 'config';
  if (!d.test_probe || !PROBES.includes(d.test_probe.kind)
    || (d.test_probe.kind === 'test_address' && !str(d.test_probe.address))) return 'test_probe';
  const h = d.handling;
  if (!h || typeof h !== 'object' || Array.isArray(h)) return 'handling';
  for (const k of Object.keys(h)) if (!HANDLING_FIELDS.includes(k)) return `handling.${k}`;
  if (typeof h.on_own !== 'boolean') return 'handling.on_own';
  if (!stated(h.sends, (v) => strList(v, true) && v.every((s) => SENDS.includes(s)))) return 'handling.sends';
  if (!stated(h.never_sends, (v) => strList(v, false))) return 'handling.never_sends';
  for (const k of /** @type {const} */ (['recipient', 'region', 'file_retention', 'result_retention'])) if (!str(h[k])) return `handling.${k}`;
  if (!stated(h.sub_processors, (v) => strList(v, false))) return 'handling.sub_processors';
  if (!SAMPLE_SHARING.includes(h.sample_sharing)) return 'handling.sample_sharing';
  const mode = d.mode_required;
  if (mode !== null && !(mode && typeof mode === 'object'
    && str(mode.description) && mode.params && typeof mode.params === 'object')) return 'mode_required';
  const check = d.mode_check;
  if (check !== null && !str(check)) return 'mode_check';
  if (!str(d.licence_note)) return 'licence_note';
  if (!strList(d.source_urls, !own) || !d.source_urls.every((u) => /^https:\/\//.test(u))) return 'source_urls';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(d.read_on || '')) return 'read_on';
  const max = d.max_bytes;
  if (max !== undefined && !(Number.isSafeInteger(max) && max > 0)) return 'max_bytes';
  for (const k of /** @type {const} */ (['template', 'host_from_spec', 'per_engine'])) if (d[k] !== undefined && d[k] !== true) return k;
  return null;
}

/** R19: `{ok:true}` or the first refusal, in R19's order. Pure; never throws.
 * @param {unknown} d @returns {Validation} */
export function validateDescriptor(d) {
  try {
    const field = malformed(/** @type {Descriptor | null | undefined} decoded as R19 states it; malformed() checks each field */ (d));
    if (field) return { ok: false, code: 'DESCRIPTOR_MALFORMED', field };
    const desc = /** @type {Descriptor} every field as R19 states it: malformed() found none otherwise */ (d);
    const h = desc.handling;
    if (h.sample_sharing === 'third_parties' || h.sample_sharing === 'public') return { ok: false, code: 'PROVIDER_SHARES_SAMPLES' };
    if (h.sample_sharing === NOT_STATED) return { ok: false, code: 'HANDLING_NOT_STATED' };
    const never = h.never_sends;
    if (never === NOT_STATED || !NEVER_SENDS_REQUIRED.every((x) => never.includes(x))) {
      return { ok: false, code: 'NEVER_SENDS_INCOMPLETE' };
    }
    const sends = h.sends;
    if (desc.kinds.includes('url_reputation') && Array.isArray(sends)
      && (sends.includes('url') || sends.includes('hostname')) && !CLOUDFLARE.test(h.recipient)) {
      return { ok: false, code: 'ADDRESS_WOULD_LEAVE' };
    }
    if (desc.mode_required && !desc.mode_check) return { ok: false, code: 'PRIVATE_MODE_UNVERIFIABLE' };
    return { ok: true };
  } catch {
    return { ok: false, code: 'DESCRIPTOR_MALFORMED', field: 'descriptor' };
  }
}

/** R31: a family as stated, each name lower-cased; a statement naming ClamAV includes `clamav`.
 * @param {readonly unknown[] | null | undefined} list @returns {string[]} */
export function normaliseFamily(list) {
  const out = [...new Set((list || []).map((n) => String(n).trim().toLowerCase()).filter(Boolean))];
  if (out.some((n) => /clam/.test(n)) && !out.includes('clamav')) out.push('clamav');
  return out;
}

// @ts-check
/* record-grammar: the id grammar (R1, R2). Moved from the check catalogue (`checks/bio-checks.mjs`) at T18 with its
   comments (K585 (4), K589); the catalogue and its re-exports were deleted at T19's close (K855). */

/* PL-12 / D-84 adds BIAS to both alternations. A bias SET is a bundle
   (`BIO_Declared_Bias_v0_1.md`, "Bias bundles and adoption") precisely so it
   inherits append-only history, member-authored transitions, convergent
   promotion, conformance checks and the store — "nothing new is invented for
   governance". A bundle is addressed by an id, so the id pattern is the first
   thing that has to know the type exists; before this, a BIAS- id read as
   malformed and C-2.5 refused the document before any bias rule could run,
   which is the literal sense of D-84's "a bias bundle cannot be written at
   all". Both regexes move together: an annotation on a bias bundle is an
   annotation like any other. */
/* K171 (1) (T8, N129) adds the Action layer's four record types the same way and for the same reason: STD- (a
   standard), CONF- (a conformance determination), CONS- (a consequence part) and ESC- (an escalation) are each
   a record object promoted through `promotion`, and an id the pattern does not know is refused before any rule
   of the type can run. K198 (2) (T8, N159) adds intent's ASP- (an aspiration) and GOAL- (a goal), which intent's
   own step governs from T7 and which `intent`, later in the order, cannot register here itself. */
/* N-A1 (T18, K608) adds PLN-, the Action fold's action plan (`action-plans`' record), on the same terms. The prefix
   set is written once, below, and both patterns and `OBJECT_TYPES`' bundle keys (types.mjs) are held to it, so the three
   cannot carry different sets. */

/* T33-1 (B0.1, S0-1, C:A-6; K1467, K1470; ladders §10 "One id grammar"): ONE ID TABLE, read by every validator of every
   module. Before it, each module that validated an id carried its own `\d{4}-\d{4}` copy, so the counter's fourth digit
   was a ceiling written ten times (`ENT-2026-9999` was the last entity of a year) and a new prefix was a new copy. Now a
   prefix is one row, `{prefix, owner, form}`: `owner` the module whose object the id names and that asks for it to be
   minted (record-core mints both forms from this table, its R1 and R76), `form` `sequential` or `opaque`.
   - SEQUENTIAL: `<PREFIX>-<4-digit year>-<counter>`, the counter four or more digits, no ceiling, so every id valid
     before T33 stays valid and the 10,000th of a year is `…-10000`. The prefixes record-core draws at random (its R6:
     four random digits, then the caller's tail) have this shape too, and are sequential in form.
   - OPAQUE: `<PREFIX>-<4-digit year>-<tail>`, the tail exactly 16 characters of `[a-z0-9]`: under 1e-9 collision over
     a 10-year store at 10^7 ids a year (`measures-T33/assistant-substrate.md` §5). A counted suffix tells its reader
     how many were minted before; a tail tells nothing.
   The census of what was minted or validated at T33's opening is in this module's T33 job record. `MTI CHK MSR HYP DUT
   CALC STQ` were reserved at T33 (P8), so no later tranche needs a record-grammar job to admit them. */
/** One prefix's row: the module that mints it, its form, and (`legacy`) an earlier form still read as valid.
 * @typedef {{readonly prefix: string, readonly owner: string, readonly form: string, readonly legacy?: string}} IdRow */
/** @param {string} prefix @param {string} owner @param {string} [form] @param {string} [legacy] @returns {IdRow} */
const row = (prefix, owner, form = 'sequential', legacy) =>
  Object.freeze(legacy ? { prefix, owner, form, legacy } : { prefix, owner, form });
export const ID_TABLE = Object.freeze([
  /* R1's bundle prefixes, each with the module whose record it names. */
  row('INFO', 'capture'), row('PROB', 'inquiry'), row('FOCUS', 'inquiry'), row('INQ', 'inquiry'), row('PROJ', 'promotion'),
  row('ACTN', 'actions'), row('BIAS', 'bias'), row('STD', 'standards'), row('CONF', 'conformance'),
  row('CONS', 'consequences'), row('ESC', 'escalation'), row('ASP', 'intent'), row('GOAL', 'intent'),
  row('PLN', 'action-plans'),
  /* Every other prefix a module minted or validated at T33's opening, sequential in form. `ENT` was validated as four
     digits by inquiry-grammar, bias and action-grammar; it is widened here, and they read this table (S0-4 to S0-13). */
  row('ENT', 'entities'), row('REL', 'entities'), row('STDP', 'standards'), row('ACT', 'conformance'),
  row('CMP', 'conformance'), row('FIL', 'filings'), row('CPK', 'filings'), row('THY', 'filings'),
  row('GATH', 'monitoring'), row('THEME', 'connections'), row('LEAD', 'observation-log'), row('TASK', 'tasks'),
  /* Drawn at random by record-core's opaque minter (its R6), four random digits and the caller's tail. T48-1 (R63; N1017,
     K3112): `WCD`, an edition statement's draft, is `case-inputs`', which has minted it since T47 (its R6). */
  row('CASE', 'case-authoring'), row('WCD', 'case-inputs'), row('DRAFT', 'review'), row('RVG', 'review'),
  row('SRC', 'sources'), row('NOTE', 'network-notices'), row('DKT', 'docket'), row('TPL', 'filing-templates'),
  row('TPP', 'filing-templates'), row('TRG', 'filing-templates'), row('WIZ', 'wizard-scripts'),
  row('WZP', 'wizard-scripts'), row('WEG', 'wizard-scripts'),
  /* T33's new objects, rows of their owners' tables (R3): opaque. */
  row('EVT', 'events', 'opaque'), row('LIN', 'lines', 'opaque'), row('MNY', 'money', 'opaque'),
  row('PFA', 'people', 'opaque'), row('IDC', 'people', 'opaque'),
  /* Reserved now (P8), sequential. */
  row('MTI', 'people'), row('CHK', 'people'), row('MSR', 'money'), row('HYP', 'hypotheses'), row('DUT', 'duties'),
  /* T34-1 (N570, K1576; DEC-36's withheld-as-absent): `CALC` is opaque, as `EVT` and `MNY` are. A sequential counter
     told its reader how many calculations had been minted before it, withheld ones included, which is exactly what
     withheld-as-absent forbids a reader to learn. Its row carries `legacy: 'sequential'` (K1728), the form still READ
     as valid and never minted, as `STATES`' `legacy` states are read and never a destination: a copy on 0.80.0 holds
     calculations minted sequentially, and every reader keeps reading them through `idPattern`. Minting follows `form`
     alone (record-core). */
  row('CALC', 'calculations', 'opaque', 'sequential'), row('STQ', 'answers'),
  /* T41-1 (N820; D32, D8; K2405, K2418): a step (`steps`) and a reading guide (`reading-guides`), opaque, as T33's new
     objects are: a counter would tell a reader how many steps a group took, hidden projects' included. Their owners are
     named here before they hold code (P8). */
  row('STP', 'steps', 'opaque'), row('GUD', 'reading-guides', 'opaque'),
  /* T42-1 (R55; N839, K2608): an account draft (`case-account`, case-authoring's until L8), opaque, as `STP` and `GUD`
     are. Since T41 case-authoring has minted it through record-core's `mintOpaqueId`, four random digits, which is the
     sequential shape; so its row carries `legacy: 'sequential'` as `CALC`'s does (K1728): those ids stay readable, and
     minting through `allocId` follows `form` alone. Its owner is named before it holds code (P8). */
  row('ACD', 'case-account', 'opaque', 'sequential'),
  /* T46-1 (R59; N911, K2845): a success record (`consequences`, v0.2 §3 Success record), sequential, as the Action
     layer's other record objects are. `consequences` has minted `SUC-<year>-<4 digits>` in its own rows since T45, which is
     this form, so every one of those ids stays valid. It is a record object promoted with history like a finding, so it
     has a type (`success_record`, types.mjs) and a machine (`STATES`, document.mjs), and it is not a bundle prefix (R1):
     no heading set. Since T47 (R62; N958) `checkBundle` admits its document, a bare `SUC` core under `success_record@1`
     (bundle.mjs), without making `SUC` one of R1's prefixes. */
  row('SUC', 'consequences'),
  /* T48-1 (R63; N1017, K3112): a carried outcome (`case-inputs`, its R9), sequential, drawn at random by record-core's
     opaque minter (its R6) as `WCD` is. `case-inputs` has minted `OUTC-<year>-<4 digits>` since T47, which is this form,
     so every one of those ids stays valid. A row of its owner's table, not a bundle prefix (R1): no type, no heading set,
     no machine and no `checkBundle` schema. */
  row('OUTC', 'case-inputs'),
]);

const YEAR = '\\d{4}';
/** @type {Readonly<Record<string, string>>} */
const CORE = { sequential: '\\d{4,}', opaque: '[a-z0-9]{16}' };
const ROW = new Map(ID_TABLE.map((e) => [e.prefix, e]));
/* A row with `legacy` reads a core of either form (R47, K1728): the current form first, in one non-capturing group, so a
   caller composing a slug after the core (or the core into a larger alternation) keeps its own groups' numbering. */
/** @param {IdRow} r @returns {string} */
const coreOf = (r) => {
  const { prefix, form, legacy } = r;
  return `${prefix}-${YEAR}-${legacy ? `(?:${CORE[form]}|${CORE[legacy]})` : CORE[form]}`;
};

/** R47: the anchored pattern of an id core of `prefix` in its `ID_TABLE` form (and, for a row with `legacy`, in that
 *  earlier form too), a new `RegExp` on every call (so no caller's `lastIndex` reaches another's), or `null` for a prefix
 *  the table does not hold. Its source is `^<core>$`, so a validator whose ids carry a slug composes it after the core
 *  (`source.slice(1, -1)`), keeping its own slug rule. A check that an id is freshly minted reads the row's `form`, not
 *  this pattern.
 * @param {unknown} prefix
 * @returns {RegExp | null} */
export function idPattern(prefix) {
  const r = typeof prefix === 'string' ? ROW.get(prefix) : undefined;
  return r ? new RegExp(`^${coreOf(r)}$`) : null;
}

/* The pattern of a prefix this table holds, which every name below is. */
/** @param {string} prefix @returns {RegExp} */
const heldPattern = (prefix) => {
  const re = idPattern(prefix);
  if (re === null) throw new RangeError(`ID_TABLE holds no ${prefix}`);
  return re;
};

const HYP_RE = heldPattern('HYP');
/** R48: is `v` a hypothesis id? The one test every store-side refusal of a hypothesis reads (K1467, K1487).
 * @param {unknown} v @returns {boolean} */
export const isHypothesisId = (v) => typeof v === 'string' && HYP_RE.test(v);

const STP_RE = heldPattern('STP');
/** R51: is `v` a step id? (`steps`, D32.)
 * @param {unknown} v @returns {boolean} */
export const isStepId = (v) => typeof v === 'string' && STP_RE.test(v);

const GUD_RE = heldPattern('GUD');
/** R53: is `v` a reading guide id? (`reading-guides`, D8.)
 * @param {unknown} v @returns {boolean} */
export const isGuideId = (v) => typeof v === 'string' && GUD_RE.test(v);

const SUC_RE = heldPattern('SUC');
/** R59: is `v` a success record id? (`consequences`, N911.)
 * @param {unknown} v @returns {boolean} */
export const isSuccessRecordId = (v) => typeof v === 'string' && SUC_RE.test(v);

/** Every bundle id prefix, in the order the patterns spell them (R1): the sequential prefixes `ID_TABLE` gives the
 *  bundle records. */
export const ID_PREFIXES = Object.freeze(['INFO', 'PROB', 'FOCUS', 'INQ', 'PROJ', 'ACTN', 'BIAS', 'STD', 'CONF', 'CONS',
  'ESC', 'ASP', 'GOAL', 'PLN']);

/* R1: each prefix's core from `idPattern`, then the bundle's slug. */
const SLUG = '[a-z0-9]+(-[a-z0-9]+)*';
const BUNDLE = `(${ID_PREFIXES.map((p) => heldPattern(p).source.slice(1, -1)).join('|')})-${SLUG}`;

export const BUNDLE_ID_RE = new RegExp(`^${BUNDLE}$`);
export const ANN_ID_RE = new RegExp(`^${BUNDLE}\\.ann-\\d{8}T\\d{6}Z-${SLUG}$`);
export const FILENAME_RE = /^[A-Za-z0-9._-]+$/;
export const ISO_TS_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

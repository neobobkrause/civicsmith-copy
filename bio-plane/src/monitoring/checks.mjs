/* monitoring — its checks (requirements: `build/requirements/monitoring.md`, R27, R42, R66; K6, K49).
 *
 * Moved from `legacy-checks` (the legacy check catalogue) in T8 with their comments: C-18.5, `checkGatheringGrammar` and
 * its four vocabularies. The grammar it reads (`isPublicHttpsLocator`, `ISO_TS_RE`) is `record-grammar`'s (T19). `legacy-checks` (since deleted) could not import this module, so its `checkBundle` stopped running C-18.5: this
 * module registers it with promotion (at the write, R27) and with record-core's audit (R42).
 *
 * T18 (R42 as worded, K649 (6)): the C-48.8 and C-48.9 rows (`DRIVE_TICK_EXPORT_IS_THE_SHELL`,
 * `DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL`) are copied here from the catalogue's `DRIVE_CAPTURE_CHECKS` with their
 * comments, code, number, translation and reasons unchanged, their `where` naming this module's site; they are no longer
 * read in place, and the catalogue's copy is T19's layer 1's to delete (K529). The rest of C-48 is `acquisition`'s (its
 * R29). T34-87 (DEC-149): both translations call the group's Civicsmith by that name, never "this instance".
 * New with them (N242's share, DEC-49): C-18.10, the row of C-18.5's refusal at the write, `GATHERING_REFUSED`,
 * which until now reached the wire with no translation (queue's C-19.2 `INBOX_REFUSED` is its twin). All three rows
 * were taken by the stamp 1.49.0 (T19's promotion job). T22 (R52, K1019): C-18.11–C-18.15, the refusals of an address's
 * frequency setting (`FREQUENCY_CHECKS`), taken by 1.53.0 (T23's promotion job). T47 (R74, N969): C-18.20 and
 * C-18.21, the refusals of a member's act setting a bundle's monitoring (`MONITOR_SET_CHECKS`), awaiting T48's stamp. T51 (R75, K4189): C-18.22 and C-18.23, the refusals of a member's act planting or revising one
 * named request (`NAMED_REQUEST_CHECKS`), awaiting the stamp.
 *
 * T24 (N506, K1159): the link sweep's arms of C-18.5 (`sweepErrors`, its fields, cadences and bounds, the term matcher)
 * left with the sweep for `link-sweep`, a later module, which hands them back at composition through R66's registration
 * (`checkGatheringGrammar`'s `sweepArm`); with nothing registered, C-18.5 reads no `sweeps[]` entry. C-18.16–C-18.18 left
 * with it (K1206): their codes are minted in link-sweep's registered grammar and fence, so their rows are its table's;
 * R27 answers a refused term with the row its finding carries. */

import { isPublicHttpsLocator } from "../record-grammar/locator.mjs";
import { ISO_TS_RE, idPattern } from "../record-grammar/ids.mjs";
import { word, localize } from '../setup-words/index.mjs';

/* The catalogue's finding shape (legacy-checks' private `f`), for the check that moved here. */
function f(check, severity, message, extra) {
  return { check, severity, message, ...(extra || {}) };
}
function asText(v) {
  if (typeof v === 'string') return v;
  return new TextDecoder().decode(v);
}

const at = (fn, region) => `src/monitoring/index.mjs ${fn} > ${region}`;
const atNamed = (fn, region) => `src/monitoring/named-requests.mjs ${fn} > ${region}`;

/* D-472 — THE SHELL, ON A TICK, AND WHY IT IS ITS OWN CODE RATHER THAN C-48.5
   FIRING FROM A SECOND PLACE. A capture that meets the shell has captured
   nothing and the member's remedy is to share the file. A TICK that meets the
   shell has not captured anything either — it never would — and what it has
   lost is the CHECK: the record's last comparison still stands, undisturbed,
   and nothing about the document changed. Those are two different facts about
   the member's own situation, and DEC-49's canned translation is the sentence
   they actually read, so one sentence cannot be true of both. PL-4's rule cuts
   the same way it did for C-48.5/C-48.7: two predicates, two sites, both
   drivable — `op=acquire` drives the pair in `acquisition`, `op=monitor` drives
   this pair, and this module's tests drive both of these by name (`test/m/monitoring/tick.test.mjs` R4,
   `invariants.test.mjs` R42). */
export const DRIVE_TICK_CHECKS = Object.freeze({
  DRIVE_TICK_EXPORT_IS_THE_SHELL: Object.freeze({
    check: 'C-48.8',
    where: at('monitor', 'is-drive-tick-export'),
    translation: word('refusal.DRIVE_TICK_EXPORT_IS_THE_SHELL'),
  }),
  /* THE SAME TICK, CAUGHT ON THE BYTES. C-48.7's reasoning one op over: the
     declared type and the first kibibyte are two different pieces of evidence,
     and "Google told us it was a document and it was a web page" is the more
     serious fact. On a tick the consequence is the same either way and it is
     still worth two codes, because a tick that compared the shell would report
     the document CHANGED on every visit — the cry-wolf this row exists to end. */
  DRIVE_TICK_EXPORT_BYTES_ARE_THE_SHELL: Object.freeze({
    check: 'C-48.9',
    where: at('monitor', 'is-drive-tick-bytes'),
    translation: localize('monitoring.checks.the_check_of_that_google', 'The check of that Google Drive document did not run: the export address said it was sending a document and sent a web page instead. Your team\'s Civicsmith reads the bytes rather than the label, so the application page was recognised and not compared against the captured document — comparing it would report a change on every visit that nobody made.'),
  }),
});

/* C-18.10 — the gathering grammar's refusal at the write (R27; N242's share): a non-replay promotion carrying a
   `data/gathering.json` whose C-18.5 grammar finds an error. The `findings` beside it name each C-18.5 error; the
   translation is the sentence a member reads, so it says what happened and that nothing was saved. */
export const GATHERING_CHECKS = Object.freeze({
  GATHERING_REFUSED: Object.freeze({
    check: 'C-18.10',
    where: at('gatheringCheck', 'is-gathering-refused'),
    translation: word('refusal.GATHERING_REFUSED'),
  }),
});

/* C-18.11–C-18.15 — the refusals of R52's act, `addressFrequencySet` (monitoring R17 as Bob agreed it, K1019), each
   with nothing written, asked in this order. The translations are the sentences a member reads. All five were taken by
   the stamp 1.53.0 (T23's promotion job). */
export const FREQUENCY_CHECKS = Object.freeze({
  MACHINE_CANNOT_SET_FREQUENCY: Object.freeze({
    check: 'C-18.11',
    where: at('addressFrequencySet', 'is-frequency-member'),
    translation: word('refusal.MACHINE_CANNOT_SET_FREQUENCY'),
  }),
  NO_SUCH_ADDRESS: Object.freeze({
    check: 'C-18.12',
    where: at('addressFrequencySet', 'is-frequency-address'),
    translation: word('refusal.NO_SUCH_ADDRESS'),
  }),
  BAD_FREQUENCY: Object.freeze({
    check: 'C-18.13',
    where: at('addressFrequencySet', 'is-frequency-word'),
    translation: word('refusal.BAD_FREQUENCY'),
  }),
  NOT_A_SOURCE_OWNER: Object.freeze({
    check: 'C-18.14',
    where: at('addressFrequencySet', 'is-frequency-owner'),
    translation: word('refusal.NOT_A_SOURCE_OWNER'),
  }),
  FREQUENCY_NO_REASON: Object.freeze({
    check: 'C-18.15',
    where: at('addressFrequencySet', 'is-frequency-reason'),
    translation: word('refusal.FREQUENCY_NO_REASON'),
  }),
});

/* C-18.19 — R71's refusal of an address's end date (T45; N855; Actions D6d; v0.2 rule 17): `until` neither a calendar
   day nor null, a day before today's local day, or a day given where no zone is held to read today in. Minted here, its
   one site; `following` R22 refuses the same condition with this row. The translation is BOB's draft, the design
   stream's to re-word. */
export const WATCH_END_CHECKS = Object.freeze({
  WATCH_END_REFUSED: Object.freeze({
    check: 'C-18.19',
    where: at('addressWatchEnd', 'is-watch-end-day'),
    translation: word('refusal.WATCH_END_REFUSED'),
  }),
});

/* C-18.20 and C-18.21 — R74's refusals of a member's act setting a bundle's `monitoring.enabled` (T47; N969; K3027
   doubt 6), each with nothing written: the next free rows of the C-18 family this table holds, awaiting T48's stamp. The
   translations are BOB's drafts, the UX stream's to re-word. */
export const MONITOR_SET_CHECKS = Object.freeze({
  MACHINE_CANNOT_SET_MONITORING: Object.freeze({
    check: 'C-18.20',
    where: at('monitorSet', 'is-monitor-set-member'),
    translation: localize('monitoring.checks.only_a_member_asks_for', 'Only a member asks for a document to be watched, and this came from an automated credential. Nothing was changed.'),
  }),
  MONITOR_SET_REFUSED: Object.freeze({
    check: 'C-18.21',
    where: at('monitorSet', 'is-monitor-set-shape'),
    translation: localize('monitoring.checks.say_whether_this_document_is', 'Say whether this document is watched, yes or no, and, if you give one, how often, as one of the listed frequencies. Nothing was changed.'),
  }),
});

/* C-18.22 and C-18.23 — R75's refusals of a member's act planting or revising one named request (T51; K4189; UC-035),
   each with nothing written: the next free rows of the C-18 family this table holds (`link-sweep` took C-18.24), awaiting
   the stamp. The translations are BOB's drafts, the UX stream's to re-word. */
export const NAMED_REQUEST_CHECKS = Object.freeze({
  MACHINE_CANNOT_SET_REQUEST: Object.freeze({
    check: 'C-18.22',
    where: atNamed('namedRequestSet', 'is-named-request-member'),
    translation: localize('monitoring.checks.only_a_member_plants', 'Only a member asks for a document to be gathered, and this came from an automated credential. Nothing was changed.'),
  }),
  NAMED_REQUEST_REFUSED: Object.freeze({
    check: 'C-18.23',
    where: atNamed('namedRequestSet', 'is-named-request-shape'),
    translation: localize('monitoring.checks.this_request_was_not', 'This request was not saved: something it says is not in a form the record can keep. The parts to put right are named. Nothing was changed.'),
  }),
});

/** R42: every row this module holds, keyed by code, for a reader that looks one up by the code an answer carries. */
export const MONITORING_CHECKS = Object.freeze({ ...DRIVE_TICK_CHECKS, ...GATHERING_CHECKS, ...FREQUENCY_CHECKS,
                                                 ...WATCH_END_CHECKS, ...MONITOR_SET_CHECKS, ...NAMED_REQUEST_CHECKS });

/** A refusal answer naming one of this module's rows (DEC-49): its code, row and member's sentence, and the detail.
 *  R52's rows, R71's (which shares R52's first two), R74's and R75's. */
export function frequencyRefusal(code, detail, extra) {
  const row = FREQUENCY_CHECKS[code] || WATCH_END_CHECKS[code] || MONITOR_SET_CHECKS[code] || NAMED_REQUEST_CHECKS[code];
  return { ok: false, reason: code, code, check: row.check, translation: row.translation, detail, ...(extra || {}) };
}

/* R69 (S0-6, B0.10): a gathering id is the core `record-grammar`'s one id table answers for `GATH` (its R46, R47: a
   counter of four or more digits), then the request's slug; no pattern of this module's own. */
export const GATH_ID_RE = new RegExp(`^${idPattern('GATH').source.slice(1, -1)}-[a-z0-9]+(-[a-z0-9]+)*$`);
export const CRITICALITY_ENUM = ['crucial', 'supporting'];
export const CADENCE_ENUM = ['hourly', 'daily', 'weekly', 'monthly', 'none'];
export const GATH_STATUS_ENUM = ['open', 'captured', 'retired'];

/** C-18.5 (error): data/gathering.json field grammar. A leaked write token can
 *  litter the queue but never steer a member's session: the exporter renders
 *  these fields as quoted data, and this grammar bounds what they can carry
 *  (F5, doctrine 0.7). Scoped by declared contract: enforced only where the
 *  file is present. */
/* 1.16.6: exported. The gate already ran this at ratification, but a queue
   entry that cannot steer a session can still waste a member's attention, and a
   request refused at the WRITE never lands at all. Exporting the existing
   function is how the plane refuses at write without reimplementing the grammar,
   which would be a second grammar pretending to be the same one.
   R66: `sweepArm`, when given, is the share a later module registered (`{module, grammar}`), which reads each
   `sweeps[]` entry that is an object. */
export function checkGatheringGrammar(ctx, findings, sweepArm = null) {
  const raw = ctx.files.get('data/gathering.json');
  if (!raw) return;
  let g;
  try { g = JSON.parse(asText(raw)); } catch { return; } // C-14.3 reports
  if (typeof g !== 'object' || g === null || Array.isArray(g)) {
    findings.push(f('C-18.5', 'error', 'data/gathering.json must be a JSON object'));
    return;
  }
  if (g.daemon !== undefined) {
    const dmn = g.daemon;
    if (typeof dmn !== 'object' || dmn === null || Array.isArray(dmn)) {
      findings.push(f('C-18.5', 'error', 'gathering.json daemon block must be an object'));
    } else {
      if (typeof dmn.enabled !== 'boolean') findings.push(f('C-18.5', 'error', 'gathering.json daemon.enabled must be boolean'));
      for (const bk of ['tick_budget', 'sweep_budget']) {
        if (dmn[bk] !== undefined && !(Number.isInteger(dmn[bk]) && dmn[bk] >= 0)) {
          findings.push(f('C-18.5', 'error', `gathering.json daemon.${bk} must be a non-negative integer`));
        }
      }
    }
  }
  const reqs = Array.isArray(g.requests) ? g.requests : [];
  for (let i = 0; i < reqs.length; i++) {
    const r = reqs[i];
    if (typeof r !== 'object' || r === null) { findings.push(f('C-18.5', 'error', `gathering.json requests[${i}] is not an object`)); continue; }
    if (!GATH_ID_RE.test(r.id || '')) findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].id '${r.id}' does not match the GATH grammar`));
    const tgt = r.target;
    if (!tgt || typeof tgt !== 'object') findings.push(f('C-18.5', 'error', `gathering.json requests[${i}] missing target block`));
    else {
      if (typeof tgt.text !== 'string' || tgt.text.length === 0 || tgt.text.length > 200 || /[\r\n]/.test(tgt.text)) {
        findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].target.text must be a nonempty single-line string under 200 chars`));
      }
      if (tgt.description !== undefined && (typeof tgt.description !== 'string' || tgt.description.length > 2000)) {
        findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].target.description must be a string under 2000 chars`));
      }
    }
    const locs = Array.isArray(r.locators) ? r.locators : null;
    if (!locs || locs.length === 0) findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].locators must be a nonempty array`));
    else for (let L = 0; L < locs.length; L++) {
      if (!isPublicHttpsLocator(locs[L])) findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].locators[${L}] '${String(locs[L]).slice(0, 40)}' is not an https public-host locator`));
    }
    if (typeof r.authority !== 'string' || r.authority.trim() === '') findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].authority must be a nonempty string`));
    if (!CRITICALITY_ENUM.includes(r.criticality)) findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].criticality must be one of: ${CRITICALITY_ENUM.join(', ')}`));
    if (r.cadence !== undefined && !CADENCE_ENUM.includes(r.cadence)) findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].cadence must be one of: ${CADENCE_ENUM.join(', ')}`));
    if (!GATH_STATUS_ENUM.includes(r.status)) findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].status must be one of: ${GATH_STATUS_ENUM.join(', ')}`));
    if (r.planted !== undefined && !ISO_TS_RE.test(r.planted)) findings.push(f('C-18.5', 'error', `gathering.json requests[${i}].planted must be an ISO 8601 UTC instant`));
  }
  /* R66 (N506, K1206): the sweep arms are the ones a later module registers; with none registered no `sweeps[]` entry is
     read. A non-object entry is this module's finding; an object entry is the registered grammar's, one finding per
     field, each `{check: "C-18.5", severity, field, message}` (a refused term's also `code` and `refusal: {code, check,
     translation}`, carried as given), placed here at its index: `sweeps[i]`, then `.` and the message when it names a
     field, else a space and the message. A finding naming no severity is an error. A grammar that throws, or answers no
     list, fails closed: the entry draws a C-18.5 error saying so, so the file is refused, never admitted. */
  if (!sweepArm || typeof sweepArm.grammar !== 'function') return;
  const sweeps = Array.isArray(g.sweeps) ? g.sweeps : [];
  const ids = new Set();
  for (let i = 0; i < sweeps.length; i++) {
    const s = sweeps[i];
    if (typeof s !== 'object' || s === null || Array.isArray(s)) { findings.push(f('C-18.5', 'error', `gathering.json sweeps[${i}] is not an object`)); continue; }
    let errs;
    try { errs = sweepArm.grammar(s, ids); } catch (e) { errs = e instanceof Error ? e : new Error(String(e)); }
    if (!Array.isArray(errs)) {
      const why = errs instanceof Error ? `failed (${String(errs.message).slice(0, 120)})` : word('monitoring.answered_list_findings');
      findings.push(f('C-18.5', 'error', `gathering.json sweeps[${i}] could not be checked: the sweep grammar ${String(sweepArm.module)} `
        + `registered ${why}, so the entry is refused, never admitted`));
      continue;
    }
    for (const err of errs) {
      const e = err && typeof err === 'object' ? err : { message: String(err) };
      const at = typeof e.field === 'string' && e.field ? '.' : ' ';
      findings.push(f('C-18.5', typeof e.severity === 'string' && e.severity ? e.severity : 'error',
        `gathering.json sweeps[${i}]${at}${String(e.message ?? 'is refused')}`,
        { ...(typeof e.code === 'string' && e.code ? { code: e.code } : {}),
          ...(e.refusal && typeof e.refusal === 'object' ? { refusal: e.refusal } : {}) }));
    }
  }
}

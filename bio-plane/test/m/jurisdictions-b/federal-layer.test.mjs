// jurisdictions-b R109: the federal layer, with its records_help block for the Freedom of Information Act read on the
// official text of 5 U.S.C. § 552 (jurisdictions/test/fixtures/foia-text.mjs; coordinator rulings of 5 Nov 10:24: the
// twenty are working days; FOIA asks no purpose, which bears only on the fee category; no in-person inspection or
// photographing right is recorded as not provided, citing the subsections read). Tested at the module's interface:
// get, validate, combine; the due date is counted by civil-time's evaluateRule, the product's own count.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { get, validate, combine, RECORDS_HELP_CITATIONS } from '../../../../jurisdictions/index.mjs';
import { evaluateRule } from '../../../src/civil-time/rules.mjs';
import { FOIA_QUOTES, READ_AGAIN } from '../../../../jurisdictions/test/fixtures/foia-text.mjs';

const FED = 'us-federal';
const FOIA = 'Freedom of Information Act';
const U = '5 U.S.C. § 552';
const NOT_PROVIDED = `not provided by ${U}`;
const presplit = JSON.parse(readFileSync(new URL('../../../../jurisdictions/test/fixtures/oakland-alameda-presplit.view.json', import.meta.url), 'utf8')).view;
/* The subsections a citation names: each `; `-joined segment, and for a "not provided" one each subsection it says it read. */
const subsections = (c) => c.startsWith(NOT_PROVIDED)
  ? c.slice(c.indexOf('read: ') + 'read: '.length).split(', ')
  : c.split('; ').map((seg) => { assert.ok(seg.startsWith(`${U}(`), seg); return seg.slice(U.length); });
/* a quoted subsection holds a cited one: (a)(6)(B)(iii)(I) is read in (a)(6)(B)(iii)'s quote */
const read = (sub) => Object.keys(FOIA_QUOTES).some((q) => sub === q || sub.startsWith(q + '('));
const day = (value) => ({ value, precision: 'day', zone: 'UTC' });
const responseOf = (view, law) => {
  const l = (view.records_laws || []).find((x) => x.name === law);
  return l ? view.deadlines.find((d) => d.rule === l.response && d.applies_to === 'records_request') : undefined;
};

test('R109 the federal layer: the FOIA records_help block read on the text, its twenty and ten working days; combine of the layer alone counts a foia_response due date over the federal list and the weekend, equal to the unsplit profile; a request with no law named gets none', () => {
  const f = get(FED);
  assert.deepEqual(validate(f).errors, []);
  assert.ok(f.weekend && !f.time_zone && !f.locale);

  /* the records_help block, one, for FOIA, every field from the statute's text */
  assert.ok(Array.isArray(f.records_help), 'the federal layer holds a records_help list');
  assert.deepEqual(f.records_help.map((h) => h.law), [FOIA]);
  const h = f.records_help[0];
  assert.deepEqual(Object.keys(h).sort(), ['basis', 'citations', 'days', 'extension_reasons', 'extra_days', 'law', 'status'], 'no portal and no faster: those are a city layer\'s');
  assert.deepEqual([h.status, h.basis], ['researched', `${READ_AGAIN} foia-text`]);
  assert.deepEqual(Object.keys(h.citations).sort(), [...RECORDS_HELP_CITATIONS].sort());
  for (const [k, c] of [...Object.entries(h.citations), ...h.extension_reasons.map((r) => ['extension', r.citation])]) {
    assert.ok(c.includes(U), `${k}: ${c} names the section`);
    for (const sub of subsections(c)) assert.ok(read(sub), `${k}: ${sub} is read in the source`);
  }
  assert.equal(h.citations.answer, `${U}(a)(6)(A)(i)`);
  assert.equal(h.citations.extend, `${U}(a)(6)(B)(i)`);
  assert.equal(h.citations.segregate, `${U}(b)`);
  assert.equal(h.citations.electronic, `${U}(a)(3)(B)`);
  /* ruling (3): no purpose is asked for a request; purpose bears only on the fee category of (a)(4)(A)(ii) */
  assert.deepEqual(subsections(h.citations.purpose), ['(a)(3)(A)', '(a)(4)(A)(ii)']);
  assert.ok(subsections(h.citations.cost).includes('(a)(4)(A)(ii)'));
  /* what the statute does not give is recorded as not provided, never an invented value */
  assert.ok(h.citations.inspect_photograph.startsWith(NOT_PROVIDED));
  assert.ok(h.citations.cost_electronic.startsWith(NOT_PROVIDED));
  /* (a)(6)(B)(iii) lists three unusual circumstances */
  assert.deepEqual(h.extension_reasons.map((r) => r.citation), ['I', 'II', 'III'].map((n) => `${U}(a)(6)(B)(iii)(${n})`));

  /* ruling (2): the twenty and the ten are the statute's working days, and the profile shows them so: the block's figures are
     the foia_response rule's, which counts business days over the federal list */
  assert.match(FOIA_QUOTES['(a)(6)(A)(i)'], /within 20 days \(excepting Saturdays, Sundays, and legal public holidays\)/);
  const alone = combine([FED]);
  assert.ok(alone.ok && alone.conflicts.length === 0, JSON.stringify(alone.errors));
  const rule = responseOf(alone.view, FOIA);
  assert.equal(rule.rule, 'foia_response');
  assert.deepEqual([rule.amount, rule.count, rule.closures], [h.days, 'business', 'federal']);
  assert.deepEqual([rule.extension.days, rule.extension.count], [h.extra_days, 'business']);
  assert.deepEqual(alone.view.records_help.map((x) => x.law), [FOIA], 'the block is in the combined view');

  /* the due date: received Friday 20 Nov 2026, twenty working days over Thanksgiving (the federal list) and the weekend;
     ten more over Christmas and New Year's Day */
  const r = evaluateRule({ rule, anchor: day('2026-11-20'), view: alone.view });
  assert.equal(r.due.value, '2026-12-21');
  assert.equal(r.extension.due.value, '2027-01-06');
  const before = evaluateRule({ rule: presplit.deadlines.find((d) => d.rule === 'foia_response'), anchor: day('2026-11-20'), view: presplit });
  assert.deepEqual([r.due.value, r.extension.due.value], [before.due.value, before.extension.due.value], 'the unsplit profile\'s date');

  /* control: a request with no law named reaches no federal due date */
  assert.equal(responseOf(alone.view, undefined), undefined);
});

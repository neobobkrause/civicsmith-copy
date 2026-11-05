// interface-shell-t53: each open mark, named until a job with the code's paths meets it (K208).
// Why each waits: docs/requirements-notes/interface-shell-t53.md.
import { test } from 'node:test';

for (const [id, what] of [
  ['R136', 'a screen opens by one screenread; an act re-reads only its dependants'],
  ['R137', 'Project, then Home and Queue, then each screen, through the combined read'],
  ['R138', 'the document picker with two scopes'],
  ['R139', 'cs.follow({item, onEntry}) and its in-place fold'],
  ['R140', 'cs.grade draws the record\'s ceiling on its own scale'],
  ['R141', 'a machine result is labelled with the AI that made it'],
  ['R142', 'a list row keeps a readable text column at 390 px'],
  ['R143', 'the assistant not being ready is said where it would be offered'],
  ['R144', 'a press answers at once'],
  ['R145', 'an explanation never covers what it explains'],
  ['R146', 'a skip link first, and every stop named'],
  ['R147', 'a short public page begins at the top of the phone'],
  ['R148', 'every screen is marked; more names no absent tabs'],
  ['R149', 'a button\'s reason mark follows what the act asks'],
  ['R150', 'a confirmation is in view when it opens'],
  ['R151', 'an act with a required field empty names the field before the reason'],
]) test.todo(`${id}: ${what}`);

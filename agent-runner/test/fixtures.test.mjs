// The published runnerRefusal fixture (fixtures.mjs) calls the image's real code and gives its real refusals: R17, R18, R20, R28, R31.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runnerRefusal } from './fixtures.mjs';
import { says } from '../src/says.mjs';
import { GOOD_CODE } from './stubs/claude-values.mjs';

const SIGNIN_CODES = ['BAD_REQUEST', 'BAD_MEMBER', 'NO_SIGNIN_WAITING', 'BAD_CODE', 'NOT_THIS_MEMBER', 'ATTEMPT_SUPERSEDED',
  'SIGNIN_ADDRESS_UNEXPECTED', 'SIGNIN_UNAVAILABLE', 'SIGNIN_REFUSED'];
const CONVERSATION_CODES = ['NO_CREDENTIAL', 'SIGNIN_NOT_HELD', 'SIGNIN_TOKEN_REFUSED', 'MAX_TURNS', 'SDK_ERROR'];
const STATUS = { BAD_REQUEST: 400, BAD_MEMBER: 400, BAD_CODE: 400, NO_SIGNIN_WAITING: 409, NOT_THIS_MEMBER: 409, ATTEMPT_SUPERSEDED: 409,
  SIGNIN_ADDRESS_UNEXPECTED: 502, SIGNIN_UNAVAILABLE: 502, SIGNIN_REFUSED: 409 };

test('R17 R18 R31 runnerRefusal: each sign-in route code is the runner\'s real refusal, with its status, its trace and a member\'s words', async () => {
  for (const code of SIGNIN_CODES) {
    const { status, body } = await runnerRefusal(code);
    assert.equal(status, STATUS[code], code);
    assert.deepEqual([body.ok, body.code], [false, code], code);
    assert.ok(typeof body.detail === 'string' && body.detail.length > 0 && body.detail.length <= 300, `${code}: a detail of at most 300 characters`);
    assert.match(body.trace, /\S/, `${code}: a trace`);
    assert.ok(!body.detail.includes(GOOD_CODE), `${code}: the code is in no detail`);
  }
  // the codes this image keys to a row of the word table answer that row as their detail (R41)
  for (const code of ['BAD_REQUEST', 'BAD_MEMBER', 'NOT_THIS_MEMBER', 'NO_SIGNIN_WAITING', 'BAD_CODE', 'ATTEMPT_SUPERSEDED']) {
    assert.equal((await runnerRefusal(code)).body.detail, says(code), code);
  }
});

test('R28 runnerRefusal: each conversation code is the runner\'s real frame, ok false with its code and a detail', async () => {
  for (const code of CONVERSATION_CODES) {
    const { status, body } = await runnerRefusal(code);
    assert.equal(status, null, code);
    assert.deepEqual([body.ok, body.code], [false, code], code);
    assert.ok(body.detail.length > 0 && body.detail.length <= 300, `${code}: a detail of at most 300 characters`);
  }
});

test('runnerRefusal: a code the runner gives no refusal for throws, rather than handing back a made-up answer', async () => {
  await assert.rejects(runnerRefusal('SIGNOUT_FAILED'), /no refusal with code "SIGNOUT_FAILED"/);
  await assert.rejects(runnerRefusal('RUNNER_NOT_STARTED'), /no refusal with code "RUNNER_NOT_STARTED"/);
});

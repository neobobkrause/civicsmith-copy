/* agent-runner's published fixtures (fix round 10; K4990, K4993, K5044): the refusals this image's real code gives, made when a test runs
 * and never stored. A user takes a refusal from here instead of hand-building the runner's answer. `fixtures.test.mjs` calls it and checks
 * the real answer. The runner is started in process over its own wire (helpers.mjs `startRunner`), so the answer is the one the image gives,
 * with the trace and trace_detail the image adds. */
import { stubSdk, success, request, startRunner, conversation, MEMBER } from './helpers.mjs';
import { GOOD_CODE } from './stubs/claude-values.mjs';

const OTHER = 'member-0b42';
const SIGNIN_HELD = { mode: 'ok' };

// The sign-in route codes (src/signin.mjs, src/entry.mjs): each step over the wire, after whatever it needs to be refused.
const SIGNIN = {
  BAD_REQUEST: { ...SIGNIN_HELD, step: (r) => r.post('/signin', 'not a JSON object') },
  BAD_MEMBER: { ...SIGNIN_HELD, step: (r) => r.post('/signin', { member: '' }) },
  NO_SIGNIN_WAITING: { ...SIGNIN_HELD, step: (r) => r.post('/signin/code', { member: MEMBER, code: GOOD_CODE }) },
  BAD_CODE: { ...SIGNIN_HELD, step: async (r) => {
    await r.post('/signin', { member: MEMBER });
    return r.post('/signin/code', { member: MEMBER, code: 'a line break\nin the code' });
  } },
  NOT_THIS_MEMBER: { ...SIGNIN_HELD, step: async (r) => {
    await r.post('/signin', { member: MEMBER });
    return r.post('/signin', { member: OTHER });
  } },
  ATTEMPT_SUPERSEDED: { ...SIGNIN_HELD, step: async (r) => {
    const first = await r.post('/signin', { member: MEMBER });
    await r.post('/signin', { member: MEMBER });
    return r.post('/signin/code', { member: MEMBER, code: GOOD_CODE, attempt: first.body.attempt });
  } },
  SIGNIN_ADDRESS_UNEXPECTED: { mode: 'foreign', step: (r) => r.post('/signin', { member: MEMBER }) },
  SIGNIN_UNAVAILABLE: { mode: 'exits', step: (r) => r.post('/signin', { member: MEMBER }) },
  SIGNIN_REFUSED: { mode: 'refuses', step: async (r) => {
    await r.post('/signin', { member: MEMBER });
    return r.post('/signin/code', { member: MEMBER, code: GOOD_CODE });
  } },
};

// The conversation codes (src/runner.mjs): each conversation request over the connection, the SDK doubled where it must end so.
const authAssistant = { type: 'assistant', error: 'authentication_failed', message: { content: [{ type: 'text', text: 'Invalid API key · Please run /login' }] } };
const authRetry = { type: 'system', subtype: 'api_retry', attempt: 1, max_retries: 10, retry_delay_ms: 500, error_status: 401, error: 'authentication_failed' };
// The SDK's stream: the messages given before the query's result, as Claude Code would send them.
const sdkYielding = (msgs, result) => {
  const { sdk } = stubSdk(async () => result);
  const query = sdk.query;
  sdk.query = (args) => (async function* () {
    for await (const m of query(args)) { if (m.type === 'result') yield* msgs; yield m; }
  })();
  return sdk;
};
const CONVERSATION = {
  NO_CREDENTIAL: { sdk: () => stubSdk(async () => success()).sdk, request: () => request({ credential: { kind: 'apikey', member: MEMBER, secret: 'x' } }) },
  SIGNIN_NOT_HELD: { sdk: () => stubSdk(async () => success()).sdk, request: () => request({ credential: { kind: 'signin', member: MEMBER } }) },
  SIGNIN_TOKEN_REFUSED: { sdk: () => sdkYielding([authAssistant], { type: 'result', subtype: 'success', is_error: true, result: 'Invalid API key', num_turns: 1 }),
    request: () => request() },
  MAX_TURNS: { sdk: () => stubSdk(async () => ({ type: 'result', subtype: 'error_max_turns', is_error: false, num_turns: 4 })).sdk, request: () => request() },
  SDK_ERROR: { sdk: () => stubSdk(async () => ({ type: 'result', subtype: 'success', is_error: true, result: 'the model is unavailable', num_turns: 1 })).sdk,
    request: () => request() },
};

/** `runnerRefusal`: the real refusal the runner answers for `code`, `{status, body}`. For the sign-in route codes, `status` is the HTTP
 *  status and `body` the JSON answer (`{ok: false, code, detail, trace, trace_detail}`). For the conversation codes (src/runner.mjs), the
 *  answer is a frame on the connection, so `status` is `null` and `body` is the frame (`{ok: false, code, detail}`). Codes: BAD_REQUEST,
 *  BAD_MEMBER, NO_SIGNIN_WAITING, BAD_CODE, NOT_THIS_MEMBER, ATTEMPT_SUPERSEDED, SIGNIN_ADDRESS_UNEXPECTED, SIGNIN_UNAVAILABLE,
 *  SIGNIN_REFUSED, NO_CREDENTIAL, SIGNIN_NOT_HELD, SIGNIN_TOKEN_REFUSED, MAX_TURNS, SDK_ERROR. Any other code throws: the runner gives
 *  no such refusal (SIGNOUT_FAILED has no code path in this image, and RUNNER_NOT_STARTED belongs to the Worker's class, not the image). */
export async function runnerRefusal(code) {
  if (Object.hasOwn(SIGNIN, code)) {
    const { mode, step } = SIGNIN[code];
    const r = await startRunner(stubSdk(async () => success()).sdk, { mode });
    try {
      const { status, body } = await step(r);
      if (body.code !== code) throw new Error(`runnerRefusal: the runner answered ${body.code} for ${code}`);
      return { status, body };
    } finally { await r.stop(); }
  }
  if (Object.hasOwn(CONVERSATION, code)) {
    const { sdk, request: req } = CONVERSATION[code];
    const r = await startRunner(sdk());
    try {
      const { final } = await conversation(r.base, req());
      if (final.code !== code) throw new Error(`runnerRefusal: the runner answered ${final.code} for ${code}`);
      return { status: null, body: final };
    } finally { await r.stop(); }
  }
  throw new Error(`runnerRefusal: the runner gives no refusal with code "${code}"`);
}

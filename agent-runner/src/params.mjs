// agent-runner's named parameters and closed lists (T53): one place, so the image, the Worker and the tests read the
// same values. No credential, address of a run or English sentence lives here.

export const NAME = 'agent-runner';
export const PORT = 8080;

// R29: the trace header a caller sends, and how much of a run id's SHA-256 a line carries.
export const TRACE_HEADER = 'x-civicsmith-trace';
export const RUN_REF_HEX = 12;
// R30: a path segment longer than this is an id, logged as `:id`.
export const PATH_SEGMENT_ID_MIN = 24;
// R44: the longest key a run takes.
export const KEY_CHARS_MAX = 4096;
// R43: the largest `POST /run` body read.
export const BODY_MAX = 60 * 1024;
// R41: the longest sentence a refusal carries.
export const RUNNER_DETAIL_CHARS_MAX = 300;
// R55: how long the container stays awake after a run ends, for the person to read the manifest and take the bundle.
export const REVIEW_WINDOW_MS = 30 * 60 * 1000;

// R48: the raw-exchange capture mode. This image is built with it on; `agent-worker`'s production adapters never are.
export const CAPTURE = true;

// R57: the three deployments, fixed by configuration (the container's `DEPLOYMENT`), never by a request.
export const DEPLOYMENTS = Object.freeze(['team', 'machine', 'civicsmith']);
export const DEFAULT_DEPLOYMENT = 'team';

// R43: a run's states.
export const RUN_STATES = Object.freeze(['running', 'done', 'incomplete', 'approved', 'discarded', 'expired']);
// R29: the run's steps, each written as one line.
export const STEPS = Object.freeze(['start', 'challenge', 'tier', 'ceiling', 'seal', 'manifest', 'approve', 'bundle', 'discard']);
// R30: the lifecycle events the Worker class logs.
export const LIFECYCLE = Object.freeze(['start', 'started', 'activity_expired', 'held_awake', 'stop', 'error']);

// R43–R60 and R26: every refusal code this module answers with a `detail` (R41 reads each by key).
export const REFUSAL_CODES = Object.freeze([
  'BAD_REQUEST', 'BAD_RUN', 'CEILING_REQUIRED', 'RUN_IN_PROGRESS', 'NO_RUN', 'NO_MANIFEST_YET', 'MANIFEST_NOT_SHOWN',
  'ISSUER_UNREACHABLE', 'CHALLENGE_REFUSED', 'CHALLENGE_INVALID', 'CHALLENGE_HAS_ANSWERS', 'NOT_A_SAMPLE_ACCOUNT',
  'SECRET_IN_PAYLOAD', 'SEALING_KEY_MISSING', 'RUNNER_NOT_STARTED',
]);
export const wordKey = (code) => `gate.runner.refused.${code}`;

// R5: the optional features an image may carry. `egress-door` says the in-process door (R46) enforces the run's list.
export const CAPABILITY_NAMES = Object.freeze(['capture', 'local-endpoint', 'egress-door']);

// R52: the image's generic key shapes, scanned for beside the exact key and the host profile's shapes.
export const GENERIC_KEY_SHAPES = Object.freeze([
  'sk-ant-[A-Za-z0-9_-]{20,}', 'sk-(proj-)?[A-Za-z0-9_-]{32,}', 'AKIA[0-9A-Z]{16}', 'AIza[0-9A-Za-z_-]{35}',
  'gh[pousr]_[A-Za-z0-9]{36}', 'xox[abposr]-[A-Za-z0-9-]{10,}',
]);

// R48: the response headers a capture record keeps (provider request id, rate limits, retries, served model and host).
export const CAPTURED_HEADERS = /^(x-request-id|request-id|retry-after|x-ratelimit-[a-z-]+|anthropic-ratelimit-[a-z-]+|openai-model|openai-processing-ms|x-served-model|x-served-host|cf-ray|date)$/;

export const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

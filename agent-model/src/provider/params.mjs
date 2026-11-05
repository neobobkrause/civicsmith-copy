/* agent-model (T53) — THE NAMED PARAMETERS of the provider interface, BOB's (B3), in one place.
 *
 * Every bound the requirements name by a capital name is here, so a change is one reviewed edit. The values are this
 * job's proposal until BOB sets them; the tests read the names, never the numbers. */

/** R3, R50: a `silent` detail's length bound, in characters. */
export const DETAIL_CHARS_MAX = 200;
/** R3, R50: a provider's own message, cut to this many characters before it is returned. */
export const PROVIDER_MESSAGE_CHARS_MAX = 300;
/** R6: a conversation's own turn ceiling when the caller names none. */
export const MAX_TURNS_DEFAULT = 12;
/** R6: a turn's output bound when neither the caller nor the entry states one. */
export const MAX_OUTPUT_DEFAULT = 16000;
/** R6: a turn's time bound when the caller names none. */
export const TURN_TIMEOUT_MS = 120_000;

/** R51: bounded retry. */
export const RETRY_ATTEMPTS = 3;
export const BACKOFF_BASE_MS = 500;
export const BACKOFF_FACTOR = 2;
export const JITTER_PERCENT = 20;
export const BACKOFF_CAP_MS = 8_000;
export const RETRY_AFTER_WAIT_MAX_MS = 20_000;
/** R51: the fast patience of an interactive turn (`agent-worker` R124). */
export const INTERACTIVE_WAIT_MAX_MS = 3_000;
export const INTERACTIVE_ATTEMPTS = 2;
export const INTERACTIVE_WAIT_TOTAL_MS = 5_000;

/** R49: a secret's substring this long or longer is removed from provider text too. */
export const SECRET_SUBSTRING_MIN = 8;
/** R47: how often an unreadable gateway log is read again before the payer counts as unverified. */
export const LOG_REREADS = 3;
/** R47: the wait between two reads of a gateway log. */
export const LOG_REREAD_WAIT_MS = 250;

export { BREAKER_FAILURES, BREAKER_COOLDOWN_MS } from "../health.mjs";

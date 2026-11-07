// The sentences a person reads from this image's answers (R41), read by key (`gate.runner.refused.<CODE>`) from the rows
// the image carries as data of its own (`./says-words.mjs`, written by `scripts/build-words.mjs`): the image cannot
// import the plane's `setup-words`. A code is an identifier; the English lives only in the carried rows.
import { SAYS_WORDS } from './says-words.mjs';
import { REFUSAL_CODES, RUNNER_DETAIL_CHARS_MAX, wordKey } from './params.mjs';

export const SAYS_KEYS = Object.freeze(Object.fromEntries(REFUSAL_CODES.map((c) => [c, wordKey(c)])));

// The carried row of `code`; a code with no carried row throws (never a blank).
export function says(code) {
  const key = SAYS_KEYS[code];
  const row = key === undefined ? undefined : SAYS_WORDS[key];
  if (typeof row !== 'string') throw new Error(`no carried row for ${code}`);
  return row.slice(0, RUNNER_DETAIL_CHARS_MAX);
}

/* screens-settings holds no member-facing English (R39; T49; K3366, K3368; DEC-257, DEC-258): every sentence it draws is
   a word of `setup-words` read by key, and its keys are in `keys.mjs`. `SCREEN_WORDS` stays exported, empty, for the
   modules that still import it; the rows it held (`screen.<id>.<part>`, the AI account panel's `screen.panel.<part>`)
   are `words.json`'s now. */
export const SCREEN_WORDS = Object.freeze([]);

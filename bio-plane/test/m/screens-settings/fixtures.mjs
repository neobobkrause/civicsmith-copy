/* The two builders of an answer the tests keep for a fault laid at the platform's edge (a read refused with a code, a double in the owners' envelope,
   `answer-envelope` R1: `{ok: true, result}`). Every other answer a screen is drawn from is the world's own (store-request's `storeWorld`),
   made by the owners' real acts: see the seed files. */

/** An answer in the owners' envelope (answer-envelope R1).
 *  @param {*} result the owner's result
 *  @returns {{ok: true, result: *, store: string, tokenClass: string}} */
export const env = (result) => ({ ok: true, result, store: "bio", tokenClass: "member" });
// fixtures-generic: REFUSED the code is the caller's (a code an owner gives, or one made up on purpose to lay a refusal at the platform's edge)
/** A refusal in the owners' envelope, with its code and translation.
 *  @param {string} code the refusal's code
 *  @param {*} [extra] more fields of the refusal
 *  @returns {{ok: true, result: *, store: string, tokenClass: string}} */
export const refuse = (code, extra = {}) => env({ ok: false, reason: code, code, translation: `translated ${code}`, ...extra });

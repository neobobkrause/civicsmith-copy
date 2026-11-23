/* screens-investigate R10, R52 (T51 fix round 2, C14): what an act reads again. The shell re-reads every read of a screen after an act
 * unless the act names the reads it changed (`rereads`); the list of the documents a screen's pickers choose among is not changed by
 * the acts of these screens, and it is the expensive read, so each act names the screen's other reads and the list is read once,
 * when the screen opens. An act that files a document (`filing`) leaves `rereads` unset and reads everything again; an act that
 * already names its reads keeps them. Data only: the screens are serialised into the page, and this runs once, at load. */

/**
 * @param {Array<Object>} acts a screen's acts
 * @param {Array<string>} names the screen's reads an act changes, every one but the documents list
 * @param {Array<string>} [filing] the ops of the acts that file a document, which read everything again
 * @returns {Array<Object>} the acts, each without its own `rereads` given `names`
 */
export function rereading(acts, names, filing = []) {
  return acts.map((a) => (a.rereads !== undefined || filing.includes(a.op) ? a : Object.assign({}, a, { rereads: names })));
}

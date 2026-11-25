/* case-checker test fixture (R26): a source whose `word` call reads a key with no literal prefix, so the word rows it can
   read cannot be bounded; `programWords` names it rather than build a program that might lack a row. Never imported by
   the program. */
import { word } from "../../../src/setup-words/index.mjs";

/** @param {string} key @returns {string} */
export const sayAny = (key) => word(key);

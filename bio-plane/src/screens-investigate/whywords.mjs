/* screens-investigate R44: the keys of the reasons an undetermined answer can carry (`{key, vars}`; `people` R40): `people`' own
 * and those of the owners it passes through (`civil-time`, `lines`, `events`), read from the interface's word list by their
 * families so a key an owner adds is carried without a change here. */
import { WORD_ROWS } from "../setup-words/index.mjs";

const FAMILIES = ["people.why.", "people.identity_cluster_cache", "lines.why.", "events.why.", "civil-time."];

export const WHY_KEYS = Object.freeze(WORD_ROWS.map((r) => r[0]).filter((k) => FAMILIES.some((f) => k.startsWith(f))));

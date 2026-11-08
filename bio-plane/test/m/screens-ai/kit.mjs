/* screens-ai's tests over the real served page: `screens-settings`' kit (its `open` boots `interface-shell`'s page over its harness,
   over store-request's world), handed this module's `SCREENS`. Every answer is the owner's own, from the world's real store. */
import { open as open0, said, all, textOf, actOps, acts, texts, squash } from "../screens-settings/kit.mjs";
import { team, holdKey, SEAL } from "../screens-settings/seed-group.mjs";
import { SCREENS } from "../../../src/screens-ai/index.mjs";
export { SCREENS, said, all, textOf, actOps, acts, texts, squash, holdKey, SEAL };

/** Opens screen `id` in the world `t` as `as` (`subject` for `aiproject`). */
export const open = (t, id, as, o = {}) => open0(id, { world: t.w, as, screens: SCREENS, ...o });

/** A team (founder, rosa an administrator, dev a member) whose world holds the sealing secret, so the team can hold its own account. */
export const aiTeam = () => team({ env: { ACCOUNT_SEAL_SECRET: SEAL } });

/** The requests of the screen's own reads and acts, by op. */
export const byOp = (o, op) => o.p.requests.filter((r) => r.op === op);

/** The section the screen drew under the heading `key`. */
export const section = (o, key) => all(o.tree, (e) => e.tag === "section" && all(e, (h) => h.tag === "h2").some((h) => squash(textOf(h)) === said(key)))[0];

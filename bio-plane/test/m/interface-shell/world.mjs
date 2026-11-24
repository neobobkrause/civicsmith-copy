/* interface-shell's tests over `store-request`'s world (K5148; op-tables §5.3): the real store, a real sign-in, the page's door.
   A table the test scripted becomes the acts that make it: a queue of three open obligations is three `checkrequest` acts on a
   project the member holds, a team's name is `groupnameset`, a language is `grouplanguagesset`; the values a test asserts are read
   back from the world's own answers, never copied from a literal. */
import { boot, counted } from "./harness.mjs";
import { storeWorld, WORLD_FOUNDER_HANDLE, WORLD_PASSWORD } from "../store-request/fixtures.mjs";

export { storeWorld, WORLD_FOUNDER_HANDLE, WORLD_PASSWORD };
import { sha256HexSync } from "../../../src/record-grammar/index.mjs";

/** A fresh world, with `handle` signed in (an administrator unless `admin: false`; the founder when `founder: true`). Answers `{world, me}`. */
export async function inWorld({ handle = "rosa", admin = true, capabilities = null, founder = false } = {}) {
  const world = await storeWorld();
  /* the founder is the team's one active administrator from the claim; an administrator `signIn` adds is proposed, and the acts of instance-setup and
     translations (`grouplanguagesset`, `translationgrant`) refuse her NOT_AN_ADMIN (reported to BOB for store-request) */
  const me = await world.signIn(founder ? WORLD_FOUNDER_HANDLE : handle, { admin, capabilities });
  return { world, me };
}

/** `boot` of the page as `me`, over the world's door and the session its sign-in made; `options` as `boot`'s. */
export function bootAs(world, me, options = {}) {
  return boot({ ...options, ...doorAs(world, me) });
}

/** `world.boot(me)` with its door counted, so `settle` waits for the world's work behind a test's wrapper of it. */
export function doorAs(world, me) {
  const { door, session } = world.boot(me);
  return { door: counted(door), session };
}

/** `n` open obligations in `me`'s queue, by `n` real `checkrequest` acts of `me` on a project they start. Answers the queue's items. */
export async function obligations(world, me, n) {
  const project = await world.recipes.project(me, "Stormwater");
  for (let i = 0; i < n; i++) await me.act("checkrequest", { body: { target: project, member: me.member, note: "Check " + (i + 1) } });
  return (await me.read("queue")).items;
}

/** The password `me` signed in with (the founder's is the world's; any other member's is the one `signIn` made for her). */
export const passwordOf = (world, me) => (me.handle === WORLD_FOUNDER_HANDLE ? world.password : world.__passwords.get(me.handle));

/** `me`'s session idle for `minutes`, as the store reads it: a seeded `last_active` on the session's own row (the store counts idle from the
 *  instance clock, `env.BIO_NOW_MS`, which the world pins; op-tables §5.4). An own device locks at 30 minutes (credentials R65). */
export function idleFor(world, me, minutes) {
  world.sql.exec("UPDATE sessions SET last_active = ? WHERE token_sha = ?", world.now() - minutes * 60 * 1000, sha256HexSync(me.token));
}

/** The interface in `language` as the team's translator keeps it: the language offered, the founder granted it, each `[key, text]` adopted, and
 *  `me` reading that language. Answers the words the store then holds in it. `me` must be the founder. */
export async function translated(me, language, pairs) {
  await me.act("grouplanguagesset", { body: { languages: [language] } });
  await me.act("translationgrant", { body: { member: me.member, language } });
  for (const [key, text] of pairs) await me.act("translationadopt", { body: { language, key, text } });
  await me.act("memberlanguageset", { body: { language } });
  return (await me.read("interfacewords", { query: { v: "x" } })).words;
}

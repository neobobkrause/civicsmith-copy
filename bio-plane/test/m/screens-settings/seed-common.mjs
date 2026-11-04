/* The world the cross-screen tests (common, words, contract, readset, phone) run every screen over (store-request's `storeWorld`, K5054): one
   team made by the real acts of its members, holding what each Settings screen draws, in the states the old tables scripted. The owners'
   answers are the world's own; nothing here answers another module's op. What no act makes is said where it is seeded (`seed-group`,
   `seed-security`), which these builders only call. */
import { storeWorld, open } from "./kit.mjs";
import * as G from "./seed-group.mjs";
import * as S from "./seed-security.mjs";
import { attempt, reauth, KEYS, EMPTY_ROSTER } from "./seed-members.mjs";

export { attempt, reauth, KEYS };
export const SEAL = G.SEAL;

/** The release a team is told is ready (the daily check found it; `shipped` seeds its notice, no act makes one). */
export const READY = Object.freeze({ version: "0.84.0", date: "2026-10-11" });

/** The team every Settings screen is drawn over: the founder (its one active administrator at the start; the root of trust), rosa and lu
 *  (administrators), kim (an administrator proposed, whom the others have yet to endorse), dev (who contributes and may start projects),
 *  ana (who declared CPA), old (revoked) and mai-k (invited, not enrolled). The team holds an account (the assistant is reachable)
 *  only with `key: true` (T53: see seed-group's `holdKey`); the group is named, speaks English and Spanish, has its website verified and its hosting recorded, and
 *  has taken two copies of the record; Spanish is kept in part by ana; a release is ready and one runs; dev keeps a note; the recovery codes are issued. */
export async function fullTeam({ key = false, env = {}, verified = false } = {}) {
  const t = await G.team({ env: { ACCOUNT_SEAL_SECRET: SEAL, ...env } });
  const { w, founder, rosa } = t;
  t.lu = await w.signIn("lu", { admin: true });
  t.dev = await w.signIn("dev", { capabilities: ["contribute", "create_projects"] });
  t.ana = await w.signIn("ana", { capabilities: ["contribute"] });
  await t.ana.act("expertisedeclare", { body: { label: "CPA" } });
  await t.ana.act("expertisedeclare", { body: { label: "Zoning" } });
  await t.ana.act("memberlanguageset", { body: { language: "es" } });
  await founder.act("expertiseconfirm", { body: { memberId: "ana", label: "CPA" } });   // CPA is confirmed, Zoning waits
  await w.signIn("old", { capabilities: ["contribute"] });
  await founder.act("memberset", { body: { memberId: "old", status: "revoked" } });
  await founder.act("memberadd", { body: { memberId: "mai-k", cover: "Mai K., from the Seminary Ave block", capabilities: ["contribute"] } });
  // a fourth administrator is proposed by rosa: her endorsement is recorded and the others are awaited
  await reauth(rosa);
  const proposed = await attempt(w, rosa, "memberadd", { body: { memberId: "kim", cover: "Kim", role: "admin", capabilities: ["contribute"] } });
  if (!proposed || proposed.reason !== "CONSENSUS_REQUIRED") throw new Error("seed-common: kim was not proposed: " + JSON.stringify(proposed).slice(0, 300));
  // lu has endorsed her too: the founder's endorsement is the last one awaited
  await reauth(t.lu);
  const endorsed = await attempt(w, t.lu, "adminendorse", { body: { memberId: "kim" } });
  if (!endorsed || endorsed.reason !== "CONSENSUS_REQUIRED" || endorsed.awaiting.join() !== "admin") throw new Error("seed-common: kim awaits more than the founder: " + JSON.stringify(endorsed).slice(0, 300));
  // rosa has voted to remove lu, which three administrators need two votes to carry: the founder's vote is the one awaited
  await reauth(rosa);
  const voted = await attempt(w, rosa, "adminremove", { body: { memberId: "lu", reason: "moved away" } });
  if (!voted || voted.reason !== "VOTES_SHORT") throw new Error("seed-common: the vote was not recorded: " + JSON.stringify(voted).slice(0, 300));
  // the group's own particulars, as seed-group's `eastoak` makes them; its website is claimed, and checked only when `verified` (the check waits on the host governor)
  await founder.act("groupnameset", { body: { name: "East Oakland Watch" } });
  await founder.act("grouplanguagesset", { body: { languages: ["en", "es"] } });
  await founder.act("courtnoticeset", { body: { choice: "tell" } });
  await rosa.act("hostingaccessset", { body: { holders: "Rosa and Lu", note: "the shared vault" } });
  await founder.act("strengthbarset", { body: { capture: "B", connection: "C", reason: "Most of our sources are records." } });
  await founder.act("declaredstakeset", { body: { stake: "Several of our members rent from landlords the city regulates." } });
  await w.recipes.profiles(founder, [G.PROFILE]);
  const claimed = await founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
  if (verified) {
    G.site(w, "eastoak.example", () => claimed.well_known.body);
    await founder.act("groupdomainset", { body: { domain: "eastoak.example" } });
  }
  await founder.act("export", { query: {} });
  await founder.act("export", { query: { note: "Before the Coliseum lease hearing" } });
  // the members' signing keys: the founder's and dev's own, one rosa registered for lu
  await founder.act("signerregisterown", { body: { keyB64: KEYS.founder } });
  await t.dev.act("signerregisterown", { body: { keyB64: KEYS.dev, comment: "laptop" } });
  await rosa.act("signeradd", { body: { memberId: "lu", keyB64: KEYS.lu } });
  // dev keeps two notes, the first revised and turned into an observation (a lead the member's own act made); a second lead waits for the other
  const lead = await t.dev.act("lead", { body: { words: "The potholes on Seminary keep opening." } });
  t.lead2 = (await t.dev.act("lead", { body: { words: "The crew on 60th says the street is closed." } })).lead_id;
  await t.dev.act("notewrite", { body: { text: "The potholes on Seminary keep opening." } });
  await t.dev.act("noterevise", { body: { note: 1, text: "The potholes on Seminary keep opening, again." } });
  await t.dev.act("noteturn", { body: { note: 1, into: "observation", made: lead.lead_id } });
  await t.dev.act("notewrite", { body: { text: "Ask the crew foreman on 60th what “closed” means to them." } });
  await founder.act("recoverycodesissue");
  // Spanish and Vietnamese are offered; ana and dev may translate; ana keeps one word and a protected one that waits for a second speaker's confirmation
  await founder.act("grouplanguagesset", { body: { languages: ["en", "es", "vi"] } });
  for (const member of ["ana", "dev"]) await founder.act("translationgrant", { body: { member, language: "es" } });
  await t.ana.act("translationadopt", { body: { language: "es", key: "rail.home.name", text: "Inicio" } });
  await t.ana.act("translationadopt", { body: { language: "es", key: "weight.reversible.name", text: "Reversible, en español" } });
  const words = ["rail.home.name", "rail.queue.name", "weight.reversible.name"];
  t.draft = G.draftOf(w, "es", "rail.queue.name", (await founder.read("translations", { query: { language: "es" } })).words.find((x) => x.key === "rail.queue.name").en, "Cola", "ana");
  // the 26,000 words of the list are not drawn in a test's time: the same real answer with the words the screen is about (seed-group's WORLD GAP)
  t.only = G.onlyWords(founder, words);
  // a release is ready and one runs
  S.deployed(w, "0.83.0");
  S.shipped(w, { version: READY.version, date: READY.date, security: true, notes: S.notesOf("Searching the record now finds words inside scanned pages.", "New releases are checked for once a day.", "After it, open Translations once.") });
  // the team's account (T53: R95, the alpha's group key is retired; the team holds an account by `aiaccountadd`, seed-group's `holdKey`)
  await reauth(founder);
  if (key) await G.holdKey(founder, w);
  // an office a member named, and one the administrator made
  const law = (await founder.read("profiles")).view.records_laws.find((l) => l.level === "federal").citation;
  await t.dev.act("entitycreate", { body: { kind: "office", label: "Records Office of the Agency", note: "n", contact: { kind: "portal", value: "https://records.agency.example/portal" }, law } });
  await founder.act("entitycreate", { body: { kind: "office", label: "Office of the City Clerk", note: "n" } });
  await founder.act("entitycreate", { body: { kind: "body", forum_kind: "court", label: "Alameda County Superior Court", note: "n" } });
  return t;
}

/** The screens' subject, as the old tests opened them. */
export const subjectOf = (id) => (id === "members" ? "ana" : id === "translations" ? "es" : null);

/** A team whose security screen has something to draw: the scanner bound (signatures held), the level raised by sign-ins refused and, unless
 *  `tool: false`, a tool added and tested (the vendors' API is the outside world's, the platform's double: seed-security). */
export async function securityTeam({ tool = true, ...opts } = {}) {
  const s = await S.scannerTeam({ signatures: 3600000, ...opts });
  await S.hardTries(s.w, 3, { country: "XX" });
  s.dev = await s.w.signIn("dev", { capabilities: ["contribute"] });
  if (tool) {
    const entry = (await s.founder.read("securitytoolcatalogue")).offered.find((e) => e.provider_id === "sophos-intelix");
    const added = await s.founder.act("securitytooladd", { body: { providerId: entry.provider_id, config: { region: "de" }, credentials: { client_id: "SENTINEL-intelix-client_id", client_secret: "SENTINEL-intelix-client_secret" },
      handlingDigest: entry.handling_digest, confirmRetention: true, use: "on_request" } });
    await s.founder.act("securitytooltest", { body: { toolId: added.tool_id } });
    s.toolId = added.tool_id;
  }
  return s;
}

/* ---- the teams the screens are drawn over, by name; and the runs (a screen, as whom, over which team) the cross-screen tests make ---- */

const REASON = "We hold tips from city employees; none of it may go to an AI service.";
export const TEAMS = {
  full: () => fullTeam({ verified: true }),
  security: () => securityTeam(),
  "security-bare": () => securityTeam({ tool: false }),
  /** the founder alone, the assistant kept away, no key held: the bare roster */
  bare: async () => { const w = await storeWorld(); const founder = await w.signIn("founder"); await founder.act("aikeepaway", { body: { on: true, reason: REASON } }); return { w, founder }; },
};
const built = new Map();
/** A team by name, built once and shared by the tests that only read it (a test that acts builds its own). */
export const teamNamed = (name) => { if (!built.has(name)) built.set(name, TEAMS[name]()); return built.get(name); };

/** Every screen as a member of the team would find it: `[screen, { team, who, subject, table }]` (`table`: a fault or a double of the platform's edge, a function of the team). */
export const RUNS = [
  ["settings", { team: "full", who: "founder" }], ["settings", { team: "full", who: "dev" }],
  ["members", { team: "full", who: "founder", subject: "ana" }], ["members", { team: "full", who: "dev" }],
  ["members", { team: "bare", who: "founder", table: () => EMPTY_ROSTER }],
  ["account", { team: "full", who: "ana" }],
  ["notes", { team: "full", who: "dev" }],
  ["group", { team: "full", who: "founder" }], ["group", { team: "full", who: "dev" }],
  ["places", { team: "full", who: "founder" }], ["places", { team: "full", who: "dev" }], ["recovery", { team: "full", who: "founder" }],
  ["group-identity", { team: "full", who: "founder" }], ["group-identity", { team: "full", who: "dev" }],
  ["security", { team: "security", who: "founder" }], ["translations", { team: "full", who: "founder", subject: "es", table: (t) => ({ translations: t.only }) }],
];

/** The ops a screen asks over the team (the frame's and its own), `whoami` apart: the reads a fault is laid on. */
export async function readsOf(id, run) {
  const t = await teamNamed(run.team), as = t[run.who];
  const o = await open(id, { world: t.w, as, subject: run.subject ?? null, ...(run.table ? { table: run.table(t) } : {}) });
  return [...new Set(o.p.all.map((r) => r.op))].filter((op) => op !== "whoami");
}

export { G, S };

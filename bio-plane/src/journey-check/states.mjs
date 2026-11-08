/* journey-check R21 (K3803, K3813, K3815; DEC-330; amends R6, R13): the states of a carried screen that its default does not draw,
   each a LIVE and DESIGN pair at both widths. The design's state is drawn by setting the mock's own "In this mockup, show"
   control (`control`, the id of that select in the mock) to the option whose label matches `option`; the label is read from the
   mock, never copied here. The live screen is put in the state by `reach(page, ctx)` (the walk's own acts, or data the arm
   made), which answers true when it is there. A state the mock does not offer fails by its name; a state the walk cannot reach
   is a note "<screen>, <state>: not reached on this instance" on the live arm (never a pass, never a failure), listed for BOB's own live walk; on the
   local arm, which makes its own data, the same state fails by its name (kind `state`). */
import { join, relative } from "node:path";
import { FAIL } from "./walker.mjs";
import { localize } from "../setup-words/index.mjs";
import { pair, WIDTHS, viewportOf } from "./design.mjs";
import { settle, StepFailed } from "./walker.mjs";

export const CARRIED_STATES = Object.freeze([
  { screen: "document", state: "the held copy", control: "mk-dst", option: "held" },
  { screen: "project", state: "an owner standing down", control: "mk-eproject", option: "standing down" },
  { screen: "project", state: "an owner preparing a notice", control: "mk-eproject", option: "preparing" },
  { screen: "project", state: "an owner whose notice is published", control: "mk-eproject", option: "notice is published" },
  { screen: "project", state: "a project the member is not in", control: "mk-eproject", option: "isn't in this project" },
  { screen: "project", state: "the hidden project's rescue", control: "mk-eproject", option: "every owner is gone" },
  { screen: "question", state: "deferred for the project", control: "mk-qst", option: "deferred" },
  { screen: "question", state: "dismissed for the project", control: "mk-qst", option: "dismissed" },
  { screen: "question", state: "each passage is asked", control: "mk-qst", option: "each passage is asked" },
  { screen: "question", state: "concluded on a member's own reading", control: "mk-qst", option: "own reading" },
  { screen: "review-copy", state: "saved as a file", control: "mk-rcst", option: "as a file" },
  { screen: "plan", state: "the project's plans", control: "mk-plst", option: "several plans" },
  { screen: "plan", state: "none", control: "mk-plst", option: "no plan" },
  { screen: "action", state: "the date passed with no reply", control: "mk-actst", option: "no reply recorded" },
  { screen: "action", state: "asking about the silence", control: "mk-actst", option: "silence" },
  { screen: "action", state: "a member who may read and not act", control: "mk-actst", option: "read and not act" },
  { screen: "people", state: "other things the record follows", control: "mk-epeople", option: "other things" },
  { screen: "people", state: "adding one", control: "mk-epeople", option: "adding someone" },
  { screen: "person", state: "an ordinance", control: "mk-pest", option: "ordinance" },
  { screen: "person", state: "an office", control: "mk-pest", option: "office" },
  /* the states the carried features of screens-settings, screens-intake and screens-daily add, and counsel's (T51-116 to T51-118; op-declarations R78): the mock's first "show" control of each screen, every option but its default */
  { screen: "home", control: "mk-hmst", option: "on a new member's first visit \\(one who may start" },
  { screen: "home", control: "mk-hmst", option: "on a new member's first visit \\(one who may not" },
  { screen: "home", control: "mk-hmst", option: "for a member who" },
  { screen: "home", control: "mk-hmst", option: "for the" },
  { screen: "members", control: "mk-mbst", option: "as a member" },
  { screen: "members", control: "mk-mbst", option: "an administrator's" },
  { screen: "security", control: "mk-secst", option: "an" },
  { screen: "account", control: "mk-eacct", option: "a newer" },
  { screen: "account", control: "mk-eacct", option: "making" },
  { screen: "connect", control: "mk-st", option: "connected" },
  { screen: "connect", control: "mk-st", option: "signed in" },
  { screen: "connect", control: "mk-st", option: "your own Claude sign-in" },
  { screen: "connect", control: "mk-st", option: "a team that doesn't" },
  { screen: "connect", control: "mk-st", option: "a team that keeps" },
  { screen: "teamai", control: "mk-gex", option: "Ask" },
  { screen: "teamai", control: "mk-gex", option: "Yes" },
  { screen: "places", control: "mk-plst", option: "a state with no" },
  { screen: "recovery", control: "mk-rst", option: "new" },
  { screen: "group-identity", control: "mk-gist", option: "an" },
  { screen: "updates", control: "mk-upst", option: "the same," },
  { screen: "updates", control: "mk-upst", option: "nothing" },
  { screen: "translations", control: "mk-etl", option: "a" },
  { screen: "projects", control: "mk-eprojects", option: "a new" },
  { screen: "projects", control: "mk-eprojects", option: "for" },
  { screen: "unavailable", control: "mk-ust", option: "something" },
  { screen: "unavailable", control: "mk-ust", option: "your" },
  { screen: "elsewhere", control: "mk-elst", option: "a place" },
  { screen: "queue", control: "mk-equeue", option: "the queue" },
  { screen: "queue", control: "mk-equeue", option: "an invitation" },
  { screen: "queue", control: "mk-equeue", option: "choosing" },
  { screen: "queue", control: "mk-equeue", option: "what happened" },
  { screen: "queue", control: "mk-equeue", option: "what you" },
  { screen: "queue", control: "mk-equeue", option: "an all-clear" },
  { screen: "finder", control: "mk-efinder", option: "a search with" },
  { screen: "finder", control: "mk-efinder", option: "Find" },
  { screen: "finder", control: "mk-efinder", option: "citing" },
  { screen: "finder", control: "mk-efinder", option: "the whole record" },
  { screen: "finder", control: "mk-efinder", option: "a search answered" },
  { screen: "archive", control: "mk-zst", option: "an archive that could" },
  { screen: "open-file", control: "mk-ost", option: "a high-risk" },
  { screen: "open-file", control: "mk-ost", option: "a file held" },
  { screen: "open-file", control: "mk-ost", option: "a file you" },
  { screen: "counsel", control: "mk-cpst", option: "defense" },
]);

/* A carried state's key in a `reach` map: its screen and the mock option it names, as CARRIED_STATES holds them */
export const stateKey = (st) => `${st.screen}:${st.option}`;

/* Each carried state: its design drawing at both widths; paired with the live screen where `reach` puts it in the state.
   `reach` maps a state, by its name "<screen>, <state>" or its key (`stateKey`), to `async (page, base) => boolean`, or to an
   entry `{ reach, page?, rank?, expect?, after?, note? }` (reach.mjs): `page()` the page the state is drawn to (else `page`),
   `rank` the order its setup needs (lower first, the list's order within a rank), `expect` the refusals its acts expect, `after`
   what puts back what it changed, `note` written when it is paired. Each width's reach is a step of the walk ("R21 <name> at
   <width>px"), so a setup that fails says why by name. Answers the pairs written (relative to `out`). */
/* R21 (F10 owed): what the local arm says of a carried state it could not reach, `name` being "<screen>, <state>"; one sentence,
   so a test can tell this failure from any other of kind `state` (BOB's ruling, 7 Nov) */
export const unreachedOnLocal = (name) => localize("journey-check.states.name_not_reached_on_the_local", "{name}: not reached on the local arm, which makes its own data", { name: String(name) });

export async function walkStates(walk, b, mock, { out, page = null, base = null, reach = {}, states = CARRIED_STATES }) {
  walk.journey = "R21 the carried states";
  const written = [];
  const entryOf = (st) => { const e = reach[`${st.screen}, ${st.state ?? st.option}`] ?? reach[stateKey(st)]; return typeof e === "function" ? { reach: e } : e || null; };
  const rankOf = (st) => entryOf(st)?.rank ?? 0;
  for (const st of [...states].sort((a, b) => rankOf(a) - rankOf(b))) {
    /* a state without a name of its own is named by the label the mock gives its option, read at the draw */
    let name = `${st.screen}, ${st.state ?? st.option}`;
    const design = {};
    for (const width of WIDTHS) {
      const d = await mock.drawState(st.screen, st.control, st.option, width);
      if (d.why) { walk.fail(FAIL.DESIGN, localize("journey-check.states.name_why_the_design_mock_at", "{name}: {why} (the design mock at {commit})", { name: String(name), why: String(d.why), commit: String(mock.commit) })); break; }
      if (st.state === undefined) name = `${st.screen}, ${d.label}`;
      design[width] = d.png;
    }
    if (!design[WIDTHS[0]] || !design[WIDTHS[1]]) continue;
    const entry = reach[name] ? (typeof reach[name] === "function" ? { reach: reach[name] } : reach[name]) : entryOf(st);
    let ok = false;
    const livePng = {};
    const pg = entry && (entry.page ? await Promise.resolve().then(() => entry.page()).catch(() => null) : page);
    if (entry && pg) {
      for (const width of WIDTHS) {
        await pg.setViewportSize(viewportOf(width));
        try {
          await walk.step(pg, `R21 ${name} at ${width}px`, async (p) => { if (!(await entry.reach(p, base))) throw new Error(`${name}: not drawn`); }, { expect: entry.expect || [] });
          ok = true;
        } catch (e) { if (!(e instanceof StepFailed)) throw e; ok = false; }
        if (!ok) break;
        await settle(pg);
        livePng[width] = await pg.screenshot();
      }
      await pg.setViewportSize(viewportOf(WIDTHS[0])).catch(() => {});
      if (entry.after) await entry.after(pg).catch(() => {});
      if (ok && entry.note) walk.notes.push(entry.note);
    }
    /* the failure carries the state's key, so a reader can tell a state the local copy cannot draw (reach.mjs UNREACHABLE) from another */
    if (!ok && walk.arm === "local") { walk.fail(FAIL.STATE, unreachedOnLocal(name)).state = stateKey(st); continue; }
    if (!ok) { walk.notes.push(localize("journey-check.states.name_not_reached_on_this_instance", "{name}: not reached on this instance", { name: String(name) })); continue; }
    for (const width of WIDTHS)
      written.push(relative(out, await pair(b, livePng[width], design[width], join(out, "pairs", `state-${st.screen}-${(st.state ?? st.option).replace(/[^a-z0-9]+/gi, "-")}-${width}.png`), { title: `${name}, ${width}px` })));
  }
  return written;
}

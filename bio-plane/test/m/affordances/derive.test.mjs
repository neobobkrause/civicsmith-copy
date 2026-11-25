/* affordances: `deriveActs(facts)` (R8–R10) against an oracle written from the requirements' own text, over every
   declared type and every state its machine names (and one it does not). For each act, every combination of the
   facts R8–R10 name for that act is crossed with the machine fact, on three backgrounds for the facts the act does
   not name (all permissive, all restrictive, all absent); the act must be returned exactly when the oracle says so,
   and never with a throw. The state machines are record-grammar's `STATES`, read through its vocabulary lookup, and
   basis-versions' `VERSION_MACHINE`, which is what R8's "an edge to X" is defined over. */
import test from "node:test";
import assert from "node:assert/strict";
import { deriveActs, decorate, ACTS, REOPENABLE_FROM, DISPOSITIONS } from "../../../src/affordances.mjs";
import { MACHINE_REFUSALS } from "../../../src/op-grades/index.mjs";
import { STATES, normalizeType, vocabFor } from "../../../src/record-grammar/index.mjs";
import { VERSION_MACHINE } from "../../../src/basis-versions/index.mjs";

/* ---- the oracle, from R8–R10's text ---- */
const edges = (f) => vocabFor(STATES, f.declared_type ?? f.object_type)?.edges?.[f.current_state] ?? [];
const edgeTo = (f, x) => edges(f).includes(x);
const n = (v) => typeof v === "number" ? v : Array.isArray(v) ? v.length : null;   // a count, or unstated
const readingTo = (f, to) => (f.basis_version_states ?? []).some((s) => (VERSION_MACHINE.edges[s] ?? []).includes(to));
const R8 = {
  release: (f, t) => t === "information" && edgeTo(f, "verified"),
  retire: (f, t) => t === "information" && edgeTo(f, "retired") && !(n(f.cites_in?.confirmed) > 0),
  dispose: (f, t) => t === "inquiry" && f.case_member !== true && DISPOSITIONS.some((d) => edgeTo(f, d)),
  /* N345: withheld on a contradiction inquiry, where contradictionresolve is offered on conclude's state-machine arm
     (J1 item 2: resolve concludes without a project, so it has no project arm) */
  conclude: (f, t) => t === "inquiry" && f.contradiction_inquiry !== true && (edgeTo(f, "concluded")
    || (f.current_state === "concluded" && f.concludes_for_project === true)),
  /* N365: and not where the viewer is stated not to see both sides of the linked candidate */
  contradictionresolve: (f, t) => t === "inquiry" && f.contradiction_inquiry === true && edgeTo(f, "concluded")
    && f.contradiction_sides_seen !== false,
  reopen: (f, t) => t === "inquiry" && edgeTo(f, "open")
    && (REOPENABLE_FROM.includes(f.current_state) || f.case_member === true),
  publish: (f, t) => t === "inquiry" && (f.current_state === "concluded" || f.concluded_for_project === true)
    && (f.case_member !== true || f.edition_warranted_for_project === true) && f.project_owner !== false,
  inquirydivide: (f, t) => t === "inquiry" && edgeTo(f, "divided") && f.case_member !== true
    && n(f.basis_legs) >= 1 && !(n(f.rested_on?.working) > 0),
  inquiryground: (f, t) => t === "inquiry" && n(f.basis_legs) >= 1 && f.case_member !== true
    && f.current_state !== "divided",
  actionmove: (f, t) => t === "action" && edges(f).length > 0,
  actioncorrespond: (f, t) => t === "action",
  actionlaws: (f, t) => t === "action",
  actionrisktier: (f, t) => t === "action",
  versionaccept: (f, t) => t === "inquiry" && readingTo(f, "accepted"),
  versionreject: (f, t) => t === "inquiry" && readingTo(f, "rejected"),
  versionconsider: (f, t) => t === "inquiry" && readingTo(f, "considering"),
  versionrevert: (f, t) => t === "inquiry" && readingTo(f, "suggested"),
  versioncurrent: (f, t) => t === "inquiry" && (f.basis_version_states ?? []).includes("accepted"),
  withdrawconclusion: (f, t) => t === "inquiry" && (f.basis_version_states ?? []).includes("accepted"),
  versionhide: (f, t) => t === "inquiry" && n(f.basis_versions) >= 1,
};
const R9 = {
  cite: (f, t) => (t === "information" && f.current_state !== "retired")
    || (t === "project" && f.project_participant !== false) || t === "inquiry",
  /* R55: on an information target, also a visible question's own leg, live to sever and severed to reinstate */
  sever: (f, t) => ((t === "information" || t === "inquiry") && n(f.cited_by_case?.confirmed) > 0)
    || (t === "information" && n(f.legs_in?.live) > 0)
    || (t === "project" && n(f.cites_out?.confirmed) > 0 && f.project_participant !== false),
  reinstate: (f, t) => (((t === "information" && f.current_state !== "retired") || t === "inquiry")
      && n(f.cited_by_case?.severed) > 0)
    || (t === "information" && f.current_state !== "retired" && n(f.legs_in?.severed) > 0)
    || (t === "project" && n(f.cites_out?.severed_reinstatable) > 0 && f.project_participant !== false),
  projectinvite: (f, t) => t === "project" && f.roster?.owner === true,
  projectremove: (f, t) => t === "project" && f.roster?.owner === true,
  projectowneradd: (f, t) => t === "project" && f.roster?.owner === true,
  projectjoin: (f, t) => t === "project" && typeof f.roster?.state === "string" && f.roster.state !== "joined",
  /* R9 as folded (N45, K309): an owner leaves only while another owner is committed. */
  projectleave: (f, t) => t === "project" && f.roster?.state === "joined"
    && (f.roster?.owner !== true || f.roster?.other_owner_committed === true),
  projectownerremove: (f, t) => t === "project" && f.roster?.owner === true && f.roster?.owner_floor_clear === true,
  projectownerrescue: (f, t) => t === "project" && f.roster?.rescue_open === true,
  projectvisibilityset: (f, t) => t === "project" && f.project_target_owner === true,
};
/* N364 (R1, R5, K530): `sourceconsent` is an act on a source's entry, which no bundle's facts describe: never offered
   beside a bundle, on any type, state or fact. */
const SOURCE = { sourceconsent: () => false };
/* R51 (T45; v0.2 rule 1): each act an action offers, offered on an action exactly where its own refusal admits the caller,
   read off R14's `action` facts (a stated count above zero, a stated `true` or `false`; an absent `action` offers none). */
const has = (v) => n(v) !== null && n(v) > 0;
const R51 = {
  actionhold: (f, t) => t === "action" && !!f.action,
  actionholdrelease: (f, t) => t === "action" && has(f.action?.holds_in_place),
  actionpressure: (f, t) => t === "action" && has(f.action?.entries?.received_unmarked),
  holdnoticeprepare: (f, t) => t === "action" && has(f.action?.holds_in_place),
  holdnoticesent: (f, t) => t === "action" && has(f.action?.holds_in_place),
  actionreceipt: (f, t) => t === "action" && has(f.action?.entries?.sent),
  actionscope: (f, t) => t === "action" && !!f.action,
  actionpromise: (f, t) => t === "action" && !!f.action,
  actionreplybearing: (f, t) => t === "action" && f.action?.request_for_comment === true && has(f.action?.entries?.received),
  actionreplyquoting: (f, t) => t === "action" && f.action?.request_for_comment === true && has(f.action?.entries?.received),
  actionbearingpropose: (f, t) => t === "action" && f.action?.request_for_comment === true && has(f.action?.entries?.received),
  arosefrom: (f, t) => t === "action" && has(f.action?.entries?.received),
  escalationopen: (f, t) => t === "action" && f.action?.escalation?.openable === true,
  escalationattach: (f, t) => t === "action" && f.action?.escalation?.attachable === true,
  filingprepare: (f, t) => t === "action" && f.action?.closed === false && f.action?.preparable === true,
  communicationprepare: (f, t) => t === "action" && f.action?.closed === false,
  filingapprove: (f, t) => t === "action" && has(f.action?.drafts?.unapproved),
  filingsent: (f, t) => t === "action" && has(f.action?.drafts?.approved_unsent),
  counselpacket: (f, t) => t === "action" && !!f.action,
  clockstate: (f, t) => t === "action" && !!f.action,
  reminderset: (f, t) => t === "action" && has(f.action?.clock?.dated) && f.action?.clock?.reminders_room === true,
  itemtakeup: (f, t) => t === "action" && (has(f.action?.clock?.entries) || has(f.action?.holds_in_place)),
};
/* R52 (T46): the acts T45 deferred — escalation's stop where one stands open or suspended, its reopening where one
   stopped, and `clockadopt` where a dated proposal stands (one act per proposal, each naming its key); `filingsent` keeps
   R51's oracle over `approved_unsent`, which R52 narrows at the facts (filings R50; the plane's drive, t45). */
const R52 = {
  escalationstoppursuing: (f, t) => t === "action" && f.action?.escalation?.stoppable === true,
  escalationreopen: (f, t) => t === "action" && f.action?.escalation?.reopenable === true,
  clockadopt: (f, t) => t === "action" && has(f.action?.clock?.proposals),
};
const ORACLE = { ...R8, ...R9, ...SOURCE, ...R51, ...R52 };
/* R10: a machine is withheld what its class is refused, on a stated true only. */
const expected = (f, id) => ORACLE[id](f, normalizeType(f.object_type))
  && !(f.actor_is_machine === true && id in MACHINE_REFUSALS);

/* ---- the corpus ---- */
const TYPES = [["information", "information"], ["inquiry", "inquiry"], ["inquiry", "focus"], ["inquiry", "problem"],
  ["focus", "focus"], ["project", "project"], ["action", "action"], ["bias", "bias"], ["widget", "widget"]];
const typestates = TYPES.flatMap(([object_type, declared_type]) =>
  [...(vocabFor(STATES, declared_type)?.legal ?? []), "no-such-state"]
    .map((current_state) => ({ object_type, declared_type, current_state })));
const B = [true, false, null];
const COUNT = [0, 1, null];
/* R16: facts are counts; a hand-built facts object that still carries ids is read as their number (the oracle's `n`) */
const COUNT_OR_IDS = [...COUNT, [], ["X-2"]];
const ROSTERS = [null,
  { owner: true, state: "joined", owner_floor_clear: true, other_owner_committed: true, rescue_open: false },
  /* two owners, the other asked to leave: the floor is clear for owner-remove, and leave is not offered (N45) */
  { owner: true, state: "joined", owner_floor_clear: true, other_owner_committed: false, rescue_open: false },
  { owner: true, state: "joined", owner_floor_clear: false, other_owner_committed: false, rescue_open: false },
  { owner: false, state: "joined", owner_floor_clear: false, other_owner_committed: true, rescue_open: false },
  { owner: false, state: "invited", owner_floor_clear: true, other_owner_committed: true, rescue_open: false },
  { owner: false, state: "leaving", owner_floor_clear: true, other_owner_committed: true, rescue_open: false },
  { owner: false, state: null, owner_floor_clear: false, other_owner_committed: false, rescue_open: true },
  { owner: null, state: null, owner_floor_clear: null, other_owner_committed: null, rescue_open: null }];
const READINGS = [null, [], ["suggested"], ["considering"], ["accepted"], ["rejected"], ["accepted", "rejected"]];
/* Each dimension sets one or more keys of the facts object; `undefined` removes a key. */
/* R51: an action's facts with every act's condition met, with none met, and with every sub-fact null. */
const ACTION_ALL = { closed: false, request_for_comment: true, entries: { all: 2, sent: 1, received: 1, received_unmarked: 1 },
  holds_in_place: 1, preparable: true, drafts: { unapproved: 1, approved_unsent: 1 },
  clock: { entries: 1, dated: 1, reminders_room: true, proposals: ["deadline@M-1", "reply@M-2"] },
  escalation: { openable: true, attachable: true, attach_purposes: ["testimony"], stoppable: true, reopenable: true } };
const ACTION_NONE = { closed: true, request_for_comment: false, entries: { all: 0, sent: 0, received: 0, received_unmarked: 0 },
  holds_in_place: 0, preparable: false, drafts: { unapproved: 0, approved_unsent: 0 },
  clock: { entries: 0, dated: 0, reminders_room: false, proposals: [] },
  escalation: { openable: false, attachable: false, attach_purposes: null, stoppable: false, reopenable: false } };
const ACTION_NULL = { closed: null, request_for_comment: null, entries: null, holds_in_place: null, preparable: null,
  drafts: null, clock: null, escalation: null };
const DIMS = {
  case_member: B.map((v) => ({ case_member: v })),
  concludes_for_project: B.map((v) => ({ concludes_for_project: v })),
  concluded_for_project: B.map((v) => ({ concluded_for_project: v })),
  edition_warranted_for_project: B.map((v) => ({ edition_warranted_for_project: v })),
  project_owner: B.map((v) => ({ project_owner: v })),
  basis_legs: COUNT_OR_IDS.map((v) => ({ basis_legs: v })),
  rested_on: [...COUNT_OR_IDS.map((w) => ({ rested_on: { working: w, frozen: 0, severed: 0 } })), { rested_on: undefined }],
  cites_in: [0, 2, [], ["INFO-x"], null].map((c) => ({ cites_in: { confirmed: c, severed: 0 } }))
    .concat([{ cites_in: undefined }]),
  cited_by_case: COUNT_OR_IDS.flatMap((c) => COUNT_OR_IDS.map((s) => ({ cited_by_case: { confirmed: c, severed: s } })))
    .concat([{ cited_by_case: undefined }]),
  cites_out: COUNT.flatMap((c) => COUNT.map((r) => ({ cites_out: { confirmed: c, severed: 1, severed_reinstatable: r } })))
    .concat([{ cites_out: undefined }]),
  /* R55: the questions holding a leg on an information target, by status */
  legs_in: COUNT_OR_IDS.flatMap((l) => COUNT_OR_IDS.map((s) => ({ legs_in: { live: l, severed: s } })))
    .concat([{ legs_in: undefined }]),
  project_participant: B.map((v) => ({ project_participant: v })),
  project_target_owner: B.map((v) => ({ project_target_owner: v })),
  roster: ROSTERS.map((roster) => ({ roster })),
  basis_version_states: READINGS.map((v) => ({ basis_version_states: v })),
  basis_versions: COUNT_OR_IDS.map((v) => ({ basis_versions: v })),
  actor_is_machine: B.map((v) => ({ actor_is_machine: v })),
  contradiction_inquiry: B.map((v) => ({ contradiction_inquiry: v })),
  contradiction_sides_seen: B.map((v) => ({ contradiction_sides_seen: v })),
  /* R51: an action's facts, each sub-fact stated, zero or null, and the whole absent */
  action: [undefined, null, ...[ACTION_ALL, ACTION_NONE, ACTION_NULL].flatMap((base) => Object.keys(ACTION_ALL)
    .map((k) => ({ ...ACTION_ALL, [k]: base[k] }))), ACTION_NONE, ACTION_NULL].map((action) => ({ action })),
};
const NAMES = {
  release: [], retire: ["cites_in"], dispose: ["case_member"],
  conclude: ["concludes_for_project", "contradiction_inquiry"],
  contradictionresolve: ["contradiction_inquiry", "concludes_for_project", "contradiction_sides_seen"],
  reopen: ["case_member"],
  publish: ["case_member", "concluded_for_project", "edition_warranted_for_project", "project_owner"],
  inquirydivide: ["case_member", "basis_legs", "rested_on"], inquiryground: ["basis_legs", "case_member"],
  actionmove: [], actioncorrespond: [], actionlaws: [], actionrisktier: [],
  versionaccept: ["basis_version_states"], versionreject: ["basis_version_states"],
  versionconsider: ["basis_version_states"], versionrevert: ["basis_version_states"],
  versioncurrent: ["basis_version_states"], withdrawconclusion: ["basis_version_states"],
  versionhide: ["basis_versions"],
  cite: ["project_participant"], sever: ["cited_by_case", "cites_out", "project_participant", "legs_in"],
  reinstate: ["cited_by_case", "cites_out", "project_participant", "legs_in"],
  projectinvite: ["roster"], projectremove: ["roster"], projectowneradd: ["roster"], projectjoin: ["roster"],
  projectleave: ["roster"], projectownerremove: ["roster"], projectownerrescue: ["roster"],
  projectvisibilityset: ["project_target_owner"],
  sourceconsent: ["contradiction_inquiry", "case_member", "roster"],
  ...Object.fromEntries([...Object.keys(R51), ...Object.keys(R52)].map((id) => [id, ["action"]])),
};
const PERMISSIVE = { case_member: false, concludes_for_project: true, concluded_for_project: true,
  edition_warranted_for_project: true, project_owner: true, basis_legs: 2,
  rested_on: { working: 0, frozen: 0, severed: 0 }, cites_in: { confirmed: 0, severed: 0 },
  cited_by_case: { confirmed: 1, severed: 1 }, cites_out: { confirmed: 1, severed: 1, severed_reinstatable: 1 },
  legs_in: { live: 1, severed: 1 }, project_participant: true, project_target_owner: true,
  roster: { owner: true, state: "joined", owner_floor_clear: true, other_owner_committed: true, rescue_open: true },
  basis_version_states: ["suggested", "considering", "accepted", "rejected"], basis_versions: 4, actor_is_machine: false,
  contradiction_inquiry: false, contradiction_sides_seen: true };
const RESTRICTIVE = { case_member: true, concludes_for_project: false, concluded_for_project: false,
  edition_warranted_for_project: false, project_owner: false, basis_legs: 0,
  rested_on: { working: 3, frozen: 1, severed: 0 }, cites_in: { confirmed: 2, severed: 0 },
  cited_by_case: { confirmed: 0, severed: 0 }, cites_out: { confirmed: 0, severed: 0, severed_reinstatable: 0 },
  legs_in: { live: 0, severed: 0 }, project_participant: false, project_target_owner: false,
  roster: { owner: false, state: null, owner_floor_clear: false, other_owner_committed: false, rescue_open: false },
  basis_version_states: [], basis_versions: 0, actor_is_machine: true, contradiction_inquiry: true,
  contradiction_sides_seen: false };
const ABSENT = {};
const BACKGROUNDS = [["permissive", PERMISSIVE], ["restrictive", RESTRICTIVE], ["absent", ABSENT]];

function* cross(dims) {
  if (!dims.length) { yield {}; return; }
  const [d, ...rest] = dims;
  for (const v of DIMS[d]) for (const r of cross(rest)) yield { ...v, ...r };
}
const make = (ts, bg, over) => {
  const f = { ok: true, target: "X-1", ...ts, ...bg, ...over };
  for (const k of Object.keys(f)) if (f[k] === undefined) delete f[k];
  return f;
};

function checkActs(ids) {
  const wrong = [];
  let rows = 0;
  for (const id of ids)
    for (const ts of typestates)
      for (const [bgName, bg] of BACKGROUNDS)
        for (const over of cross([...NAMES[id], "actor_is_machine"])) {
          const f = make(ts, bg, over);
          rows++;
          let got;
          try { got = deriveActs(f).some((a) => a.id === id); }
          catch (e) { wrong.push({ id, bg: bgName, facts: f, threw: String(e) }); continue; }
          if (got !== expected(f, id)) wrong.push({ id, bg: bgName, facts: f, got });
        }
  return { wrong, rows };
}

test("R51: each act an action offers is returned exactly when its owner's refusal would admit the caller, on every type, "
   + "state and combination of the action's facts — and a machine is offered none in MACHINE_REFUSALS", () => {
  const { wrong, rows } = checkActs(Object.keys(R51));
  assert.ok(rows > 1000, `a real corpus (${rows} rows)`);
  assert.deepEqual(wrong.slice(0, 5), []);
});

test("R52: escalation's stop and reopening and clockadopt are returned exactly when their owners' refusals would admit the "
   + "caller, on every type, state and combination of the action's facts; clockadopt once per standing dated proposal, each "
   + "naming its key, and attachment at stage 7 naming the purposes it admits; a machine is offered none in MACHINE_REFUSALS", () => {
  const { wrong, rows } = checkActs(Object.keys(R52));
  assert.ok(rows > 1000, `a real corpus (${rows} rows)`);
  assert.deepEqual(wrong.slice(0, 5), []);
  const f = make({ object_type: "action", declared_type: "action", current_state: "planned" }, { actor_is_machine: false },
    { action: ACTION_ALL });
  const acts = deriveActs(f);
  assert.deepEqual(acts.filter((a) => a.id === "clockadopt").map((a) => a.proposal), ["deadline@M-1", "reply@M-2"]);
  assert.deepEqual(acts.filter((a) => a.id === "escalationattach").map((a) => a.purposes), [["testimony"]]);
  /* decorated, each keeps what it names; R11's keys otherwise unchanged */
  const d = acts.filter((a) => a.id === "clockadopt").map((a) => decorate(a, null));
  assert.deepEqual(d.map((x) => x.proposal), ["deadline@M-1", "reply@M-2"]);
  assert.deepEqual(Object.keys(decorate(acts.find((a) => a.id === "actionhold"), null)).includes("proposal"), false);
  /* controls: no proposal standing, none offered; attachment at stages 2 and 5 names no purposes */
  const none = deriveActs(make(f, {}, { action: { ...ACTION_ALL, clock: { ...ACTION_ALL.clock, proposals: [] },
    escalation: { ...ACTION_ALL.escalation, attach_purposes: null } } }));
  assert.equal(none.some((a) => a.id === "clockadopt"), false);
  assert.equal(none.find((a) => a.id === "escalationattach").purposes, undefined);
});

test("R8 R9 R10 R51 R52: the oracle covers exactly the acts in ACTS", () => {
  assert.deepEqual(Object.keys(ORACLE).sort(), ACTS.map((a) => a.id).sort());
  assert.deepEqual(Object.keys(NAMES).sort(), ACTS.map((a) => a.id).sort());
});

test("R8: each state-machine act is returned exactly when R8 says, on every type, state and combination of its facts", () => {
  const { wrong, rows } = checkActs(Object.keys(R8));
  assert.ok(rows > 10000, `a real corpus (${rows} rows)`);
  assert.deepEqual(wrong.slice(0, 5), []);
});

test("R9: cite, sever, reinstate and the roster acts are returned exactly when R9 says", () => {
  const { wrong, rows } = checkActs(Object.keys(R9));
  assert.ok(rows > 10000, `a real corpus (${rows} rows)`);
  assert.deepEqual(wrong.slice(0, 5), []);
});

test("R8 R9: the corpus is not degenerate — every act on a bundle is both returned and withheld somewhere in it", () => {
  const seen = Object.fromEntries(ACTS.map((a) => [a.id, new Set()]));
  for (const a of ACTS) for (const ts of typestates) for (const [, bg] of BACKGROUNDS)
    for (const over of cross(NAMES[a.id])) seen[a.id].add(deriveActs(make(ts, bg, over)).some((x) => x.id === a.id));
  assert.deepEqual(ACTS.map((a) => a.id).filter((id) => !(id in SOURCE) && seen[id].size !== 2), []);
  /* and the act on a source's entry is withheld everywhere (the SOURCE oracle, checked row by row below) */
  assert.deepEqual([...seen.sourceconsent], [false]);
});

test("R1 R8: sourceconsent, an act on a source's entry, is returned beside no bundle — on every type, state and "
   + "combination of facts, on all three backgrounds", () => {
  const { wrong, rows } = checkActs(Object.keys(SOURCE));
  assert.ok(rows > 1000, `a real corpus (${rows} rows)`);
  assert.deepEqual(wrong.slice(0, 5), []);
});

/* R10, stated as equivalences. A fact the catalogue NARROWS on (a stated count above zero, a stated `false`, a
   stated case membership) answers, when null or absent, exactly as its non-narrowing value does; a fact the
   catalogue WIDENS on (a stated `true`) answers, when null or absent, exactly as its non-widening value does. */
const NULL_AS = {
  project_owner: true, project_participant: true, cites_in: { confirmed: 0, severed: 0 },
  rested_on: { working: 0, frozen: 0, severed: 0 },
  concludes_for_project: false, concluded_for_project: false, edition_warranted_for_project: false,
  project_target_owner: false, actor_is_machine: false, contradiction_inquiry: false,
  contradiction_sides_seen: true /* N365: only a stated false narrows */,
  legs_in: { live: 0, severed: 0 } /* R55: a null offers neither */,
};
test("R10: a null fact never narrows an act, and never widens one: null (or absent) answers exactly as the value "
   + "that neither narrows nor widens", () => {
  const wrong = [];
  for (const ts of typestates) for (const [bgName, bg] of BACKGROUNDS.slice(0, 2))
    for (const [k, same] of Object.entries(NULL_AS)) {
      const want = deriveActs(make(ts, bg, { [k]: same })).map((a) => a.id);
      for (const v of [null, undefined]) {
        const got = deriveActs(make(ts, bg, { [k]: v })).map((a) => a.id);
        if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push({ bg: bgName, k, v, ts, want, got });
      }
    }
  assert.deepEqual(wrong.slice(0, 5), []);
});

test("R10: case membership stated null answers as not a member for the acts it narrows (dispose, publish, divide, "
   + "group) and does not widen reopen", () => {
  const wrong = [];
  for (const ts of typestates) for (const [bgName, bg] of BACKGROUNDS.slice(0, 2)) {
    const want = deriveActs(make(ts, bg, { case_member: false })).map((a) => a.id);
    for (const v of [null, undefined]) {
      const got = deriveActs(make(ts, bg, { case_member: v })).map((a) => a.id);
      if (JSON.stringify(got) !== JSON.stringify(want)) wrong.push({ bg: bgName, v, ts, want, got });
    }
  }
  assert.deepEqual(wrong.slice(0, 5), []);
});

test("R10: a null fact never offers a roster act — with no stated roster or target ownership, no roster act is returned", () => {
  const ROSTER_ACTS = ["projectinvite", "projectjoin", "projectleave", "projectremove", "projectowneradd",
    "projectownerremove", "projectownerrescue", "projectvisibilityset"];
  const wrong = [];
  for (const ts of typestates) for (const [, bg] of BACKGROUNDS)
    for (const roster of [null, undefined,
      { owner: null, state: null, owner_floor_clear: null, other_owner_committed: null, rescue_open: null }])
      for (const pto of [null, undefined]) {
        const f = make(ts, bg, { roster, project_target_owner: pto });
        const got = deriveActs(f).map((a) => a.id).filter((id) => ROSTER_ACTS.includes(id));
        if (got.length) wrong.push({ ts, roster, got });
      }
  assert.deepEqual(wrong.slice(0, 5), []);
});

test("R10: actor_is_machine true withholds exactly the acts in MACHINE_REFUSALS; null and false withhold nothing", () => {
  for (const ts of typestates) {
    const base = make(ts, PERMISSIVE, { actor_is_machine: false });
    const all = deriveActs(base).map((a) => a.id);
    assert.deepEqual(deriveActs({ ...base, actor_is_machine: null }).map((a) => a.id), all);
    const { actor_is_machine: _, ...unsent } = base;
    assert.deepEqual(deriveActs(unsent).map((a) => a.id), all);
    assert.deepEqual(deriveActs({ ...base, actor_is_machine: true }).map((a) => a.id),
      all.filter((id) => !(id in MACHINE_REFUSALS)));
  }
});

test("R8 R9: deriveActs returns the catalogue's own act objects, in catalogue order, and never throws on a facts "
   + "object holding only its type and state", () => {
  for (const ts of typestates) {
    const got = deriveActs(make(ts, ABSENT, {}));
    for (const a of got) assert.ok(ACTS.includes(a));
    assert.deepEqual(got.map((a) => ACTS.indexOf(a)), [...got.map((a) => ACTS.indexOf(a))].sort((x, y) => x - y));
  }
});

/* N345 (R8): the contradiction inquiry. On every inquiry type and state, `conclude` and `contradictionresolve` are
   never offered together, `conclude` is never offered on a stated contradiction inquiry, and `contradictionresolve` is
   offered exactly where `conclude`'s state-machine arm would be on one. */
test("R8: conclude is withheld on a contradiction inquiry, and contradictionresolve is offered exactly where conclude's "
   + "state-machine arm would be on one — never both", () => {
  const wrong = [];
  let offeredSomewhere = false;
  for (const ts of typestates) for (const [, bg] of BACKGROUNDS) for (const cfp of B) for (const ci of B) for (const ss of B) {
    const f = make(ts, bg, { concludes_for_project: cfp, contradiction_inquiry: ci, contradiction_sides_seen: ss,
                             actor_is_machine: false });
    const got = deriveActs(f).map((a) => a.id);
    const plain = deriveActs({ ...f, contradiction_inquiry: false, concludes_for_project: false }).map((a) => a.id);
    if (got.includes("conclude") && got.includes("contradictionresolve")) wrong.push({ both: f });
    if (ci === true && got.includes("conclude")) wrong.push({ concludeOnContradiction: f });
    const want = ci === true && normalizeType(f.object_type) === "inquiry" && plain.includes("conclude")
      && f.contradiction_sides_seen !== false;
    if (got.includes("contradictionresolve") !== want) wrong.push({ resolve: f, got });
    offeredSomewhere ||= want;
  }
  assert.deepEqual(wrong.slice(0, 5), []);
  assert.ok(offeredSomewhere);
});

/* N365 (R8, R10): `contradictionresolve` is withheld where the viewer is STATED not to see both sides of the linked
   candidate, which is exactly where `resolve` refuses NOT_A_CONTRADICTION_INQUIRY (contradiction R36, R56; the
   agreement is driven over contradiction's fixture in contradiction.test.mjs); a null narrows nothing. */
test("R8 R10: contradictionresolve is withheld on a contradiction inquiry whose linked candidate's sides the viewer is "
   + "stated not to see, offered where they are seen, and a null sides fact answers as seen", () => {
  let offered = 0;
  for (const ts of typestates) for (const [, bg] of BACKGROUNDS.slice(0, 2)) {
    const f = make(ts, bg, { contradiction_inquiry: true, actor_is_machine: false });
    const on = (v) => deriveActs({ ...f, contradiction_sides_seen: v }).some((a) => a.id === "contradictionresolve");
    assert.equal(on(false), false, JSON.stringify(ts));
    assert.equal(on(null), on(true), JSON.stringify(ts));
    const { contradiction_sides_seen: _, ...unsent } = f;
    assert.equal(deriveActs(unsent).some((a) => a.id === "contradictionresolve"), on(true), JSON.stringify(ts));
    if (on(true)) offered++;
  }
  assert.ok(offered > 0, "offered somewhere, so the withholding is measured");
});

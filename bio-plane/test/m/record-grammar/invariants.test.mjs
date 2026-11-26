/* record-grammar's invariants at its interface: pure (R24), one binding per name, no place named (R27). R26 and R41,
   the catalogue's re-exports, retired with the catalogue at T19's close (K855, K863). */
import { test } from "node:test";
import assert from "node:assert/strict";
import { Worker } from "node:worker_threads";
import { battery } from "./fixtures/battery.mjs";
import * as RG from "../../../src/record-grammar/index.mjs";
import * as IDS from "../../../src/record-grammar/ids.mjs";
import * as TYPES from "../../../src/record-grammar/types.mjs";
import * as FRONTMATTER from "../../../src/record-grammar/frontmatter.mjs";
import * as JSON_ from "../../../src/record-grammar/json.mjs";
import * as ACTORS from "../../../src/record-grammar/actors.mjs";
import * as GRADES from "../../../src/record-grammar/grades.mjs";
import * as LOCATOR from "../../../src/record-grammar/locator.mjs";
import * as SHA256 from "../../../src/record-grammar/sha256.mjs";
import * as TITLES from "../../../src/record-grammar/titles.mjs";
import * as DOCUMENT from "../../../src/record-grammar/document.mjs";
import * as LABELS from "../../../src/record-grammar/labels.mjs";
import * as ACTS from "../../../src/record-grammar/acts.mjs";
import * as BUNDLE from "../../../src/record-grammar/bundle.mjs";
import * as ACCEPTANCE from "../../../src/record-grammar/acceptance.mjs";

test("R24 pure: the same answers every time, with the clock, randomness and the network taken away, and in a Worker", async (t) => {
  const first = await battery();
  assert.equal(await battery(), first);
  const boom = () => { throw new Error("record-grammar reached for the clock, randomness or the network"); };
  t.mock.method(Date, "now", boom);
  t.mock.method(Math, "random", boom);
  t.mock.method(globalThis, "fetch", boom);
  t.mock.method(globalThis, "Date", boom);
  assert.equal(await battery(), first);
  t.mock.restoreAll();
  /** @type {unknown} */
  const inWorker = await new Promise((resolve, reject) => {
    const w = new Worker(new URL("./fixtures/battery-worker.mjs", import.meta.url));
    w.on("message", (/** @type {unknown} */ m) => { resolve(m); void w.terminate(); });
    w.on("error", reject);
  });
  assert.equal(inWorker, first);
});

/** A list read item by item. @typedef {readonly unknown[]} List */
/** @param {unknown} v @returns {v is List} */
const isList = (v) => Array.isArray(v);
/** An object read member by member. @typedef {{readonly [key: string]: unknown}} Members */
/** @param {unknown} v @returns {v is Members} */
const isMembers = (v) => v !== null && typeof v === "object";

const MOVED = ["BUNDLE_ID_RE", "ANN_ID_RE", "FILENAME_RE", "ISO_TS_RE", "OBJECT_TYPES", "LEGACY_TYPE_ALIASES",
  "normalizeType", "CORE_FIELDS", "FORBIDDEN_ALIASES", "parseFrontmatter", "canonicalJson", "NON_MEMBER_AUTHORS",
  "ACTOR_CLASSES", "MACHINE_AUTHOR_PREFIX", "MACHINE_CLASS_PREFIX", "MACHINE_STAMP_PREFIXES", "isMachineStamp",
  "isMachineIdentity", "BASIS_ROLES", "BASIS_GRADES", "GRADE_AXES", "TESTIMONY_GRADE", "GRADE_SOURCES",
  "EARNED_GRADE_SOURCES", "EARNED_CAPTURE_CEILING", "UNREACHABLE_CAPTURE_GRADE", "isPublicHttpsLocator", "createSha256",
  "sha256HexSync", "INQUIRY_TITLE_MAX", "deriveInquiryTitle", "inquiryQuestionOf", "HEADINGS", "HEADINGS_WHEN",
  "isCaseMemberBytes", "vocabFor", "STATES", "sectionText", "LAW_PROPOSAL_STATES", "lawProposalState", "PROPOSAL_STATES",
  "proposalLabel", "CONTENT_MINTED_BY_PLANE", "CONTENT_MINT_STATES", "contentMintState"];
/* Provided here from the first without a catalogue twin: `checkBundle`, `EXTENSION_ARMS`, the shared act rows (R29) and
   T33's id table (R46–R48); T41's step and guide ids and the one accepting act (R51–R53); T43's C-1.1 judgment (R56);
   T46's success record id (R59). */
const OWN = ["b64ToBytes", "SHARED_ACT_CHECKS", "EXTENSION_ARMS", "checkBundle", "ID_TABLE", "idPattern", "isHypothesisId",
  "isStepId", "isGuideId", "ACCEPTANCE_FORMS", "ACCEPT_MUST_REAUTHOR", "acceptanceRecord", "idDisagrees", "isSuccessRecordId", "createResumableSha256"];

test("one binding per name: the module's entry answers each provided name with the one binding its part holds", () => {
  assert.deepEqual(Object.keys(RG).sort(), [...MOVED, ...OWN].sort());
  const parts = [IDS, TYPES, FRONTMATTER, JSON_, ACTORS, GRADES, LOCATOR, SHA256, TITLES, DOCUMENT, LABELS, ACTS, BUNDLE,
    ACCEPTANCE];
  for (const n of Object.keys(RG)) {
    const holders = parts.filter((p) => n in p);
    assert.equal(holders.length, 1, `${n} is held once`);
    assert.ok(holders[0][n] === RG[n], `${n} is one binding`);
  }
  /* A second import of the entry is the same module instance, so every reader gets the same objects. */
  return import("../../../src/record-grammar/index.mjs").then((again) => {
    for (const n of Object.keys(RG)) assert.ok(again[n] === RG[n], n);
  });
});

test("R27 no place is named in anything the module provides", () => {
  /** @type {string[]} */
  const strings = [];
  /** @param {unknown} v */
  const walk = (v) => {
    if (typeof v === "string") strings.push(v);
    else if (v instanceof RegExp) strings.push(v.source);
    else if (isList(v)) v.forEach(walk);
    else if (isMembers(v)) { for (const [k, x] of Object.entries(v)) { strings.push(k); walk(x); } }
  };
  Object.values(RG).forEach(walk);
  const r = RG.parseFrontmatter("---\n  status: x\na: 1\na: 2\n- z\n?\n---");
  for (const x of r.findings) strings.push(x.message, ...(x.repairs || []));
  /** @param {unknown} e */
  const message = (e) => { if (e instanceof Error) strings.push(e.message); return true; };
  for (const bad of [undefined, "x", {}]) assert.throws(() => RG.createSha256().update(bad), message);
  assert.throws(() => RG.b64ToBytes("*"), message);
  assert.ok(strings.length > 100);
  const PLACES = /oakland|alameda|california|berkeley|san francisco|county|city of/i;
  for (const s of strings) assert.ok(!PLACES.test(s), s);
});

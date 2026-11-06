/* case-checker tests: a battery of case files, each reaching some of the checker's words (R27), run by `words.test.mjs` through
   the library and through the standalone program, and, with a loader hook that notes every key read (`trace-hooks.mjs`), to
   show that a fixture reaches each key. Nothing here is a test: it holds the cases and runs them, and does nothing when imported. */
import * as CC from "../../../src/case-checker/index.mjs";
import * as CG from "../../../src/case-grammar/index.mjs";
import { caseFile, caseFiles, gradingFacts, keyFor, sha, A, B, C, GROUP, MINUTES, MEMO, OBS, MEMO_BYTES, MINUTES_BYTES, MINUTES_SHA,
         CALC, CALC_INPUT, CALC_INPUT_SHA, calcRow, rows, withExtract, extractRow, USE_LIMIT } from "./fixture.mjs";
import { NS_RELEASE } from "../../../src/sshsig.mjs";

const doc = (t) => t.get(CG.caseFilePath("case_document"));
const setDoc = (t, f) => t.set(CG.caseFilePath("case_document"), f(doc(t)));
const del = (...paths) => (t) => { for (const p of paths) t.delete(p); };
const gone = (...paths) => (b) => { for (const p of paths) b.delete(p); };
const P = CG.caseFilePath;
const forgedA = () => JSON.parse(caseFiles().texts.get(P("passages", A))).map((p) => ({ ...p, content_id: sha("another") }));
const wrongRow = { results: { [calcRow().result_key]: { value: "3", sign: "+", precision: "exact" } } };

/* The one-case-file checks: `{name, opts (for the fixture), args (for checkCaseFile)}` in a battery order that does not matter. */
export const CASES = [
  ["clean, two parts, with the published keys", { parts: 2 }, { keys: ["group", "alice", "bob"] }],
  ["clean, a lens removed", { docLines: CG.biasApplicationsLines([{ finding: B, ord: 1, target: "leg", statement: "S1", effect: "grade_lowered", from: "A", to: "B" }]) }, { lens: "removed" }],
  ["a reader's own lens, with applications the case cannot take", { docLines: CG.biasApplicationsLines([{ finding: B, ord: 1, target: "leg", statement: "S1", effect: "grade_lowered", from: "A", to: "B" }]) },
    { lens: { statements: ["S1", "S9"], applications: [
      { finding: A, ord: 0, target: "leg", statement: "S9", effect: "grade_lowered", from: "B", to: "D" },
      { finding: A, ord: 0, target: "leg", statement: "S7", effect: "grade_lowered", from: "B", to: "D" },
      { finding: A, ord: 9, target: "leg", statement: "S9", effect: "grade_lowered", from: "B", to: "D" },
      { finding: A, ord: null, target: "conclusion", statement: "S9", effect: "scrutiny_raised", from: null, to: null }] } }],
  ["a lens that is none of the three", {}, { lens: "sideways" }],
  ["a changed byte in a document", { edit: (b) => { const x = Buffer.from(b.get(P("document", MINUTES))); x[3] ^= 1; b.set(P("document", MINUTES), x); } }],
  ["bytes the manifest lists but the signed materials do not fingerprint", { mutate: (t) => t.set(P("document", MINUTES), "%PDF other minutes") }],
  ["a part fingerprint listed falsely", { parts: 2, manifest: (m) => { m.parts[1].sha256 = sha("not it"); } }],
  ["a file absent from its part", { edit: gone(P("document", MEMO)) }],
  ["the memo's extracted text and the minutes' document absent", { edit: gone(P("extracted_text", MEMO), P("document", MINUTES)) }],
  ["the observation absent", { edit: gone(P("observation", OBS)) }],
  ["the observation carried with other bytes", { mutate: (t) => t.set(P("observation", OBS), "I watched nothing.") }],
  ["the minutes' extracted text carried with other bytes", { mutate: (t) => t.set(P("extracted_text", MINUTES), CG.extractedTextOf([{ extent: { kind: "pdf-page", page: 0 }, ref: "p", text: "other" }])) }],
  ["a file the manifest does not list", { unlisted: new Map([["extra.txt", Buffer.from("hi")]]) }],
  ["a case signer the case file does not list", { caseSigner: "mallory" }],
  ["a signature over other bytes", { mutate: (t) => t.set(P("case_signature"), t.get(P("finding_signature", A))) }],
  ["a signature that cannot be read", { mutate: (t) => t.set(P("case_signature"), "not a signature") }],
  ["a signature in another namespace for the memo account", { memoAccountNamespace: NS_RELEASE }],
  ["a finding signer the case file does not list", { findingSigner: "mallory" }],
  ["a memo account signer the case file does not list", { memoAccountSigner: "mallory" }],
  ["published keys without the case document's", {}, { keys: ["alice", "bob"] }],
  ["no case signature carried", { edit: gone(P("case_signature")) }],
  ["no case document carried", { edit: gone(P("case_document")) }],
  ["a team attestation of another signature, in the signed document", { mutate: (t) => setDoc(t, (d) => d.replace('signature: "case"', 'signature: "other"')) }],
  ["a passage naming no document", { signedPassages: { [A]: [{ ...JSON.parse(caseFiles().texts.get(P("passages", A)))[0], capture_sha: "" }], [B]: [], [C]: [] } }],
  ["no case signature listed", { mutate: del(P("case_signature")) }],
  ["a finding's signature, bytes, passages and grading facts absent", { edit: gone(P("finding_signature", A), P("finding", C), P("passages", A), P("grading_facts", C)) }],
  ["a finding's signature and bytes not listed", { mutate: del(P("finding_signature", C), P("finding", B)) }],
  ["a finding's bytes changed after the pin", { mutate: (t) => t.set(P("finding", A), "---\nid: x\n---\nchanged\n") }],
  ["a moved passage", { quoted: "Adjourned at nine." }],
  ["a forged passage content id", { signedPassages: { [A]: forgedA() }, mutate: (t) => t.set(P("passages", A), JSON.stringify(forgedA())) }],
  ["passages carried that the signed document does not state", { mutate: (t) => t.set(P("passages", A), JSON.stringify([])) }],
  ["extracted text not carried for a passage", { edit: gone(P("extracted_text", MINUTES)) }],
  ["passages the document predates and the file unreadable", { omit: ["passages"], mutate: (t) => t.set(P("passages", A), "zzz") }],
  ["a recorded grade changed", { recorded: (p) => ({ ...p, [A]: { ...p[A], capture: { state: "graded", grade: "A" } } }) }],
  ["a leg's answer changed", (() => { const f = gradingFacts(); f[A].legs[1].answer.capture = { state: "graded", grade: "D" };
    return { signedFacts: f, mutate: (t) => t.set(P("grading_facts", A), JSON.stringify(f[A])) }; })()],
  ["carried grading facts that lie", { mutate: (t) => t.set(P("grading_facts", C), JSON.stringify({ legs: [] })) }],
  ["a grading method this checker does not hold", { mutate: (t) => setDoc(t, (d) => d.replace(/grading: "bio-grading\/\d+"/, 'grading: "bio-grading/99"')) }],
  ["no grading method stated", { mutate: (t) => setDoc(t, (d) => d.replace(/grading: "bio-grading\/\d+"/, "grading: null")) }],
  ["a bar not met", { bar: { declared: true, capture: "A", connection: "A" } }],
  ["no bar", { bar: { declared: false, capture: null, connection: null } }],
  ["no grading facts carried or signed", { omit: ["grading_facts", "case_strength"], mutate: del(P("grading_facts", A)) }],
  ["grading facts unreadable", { omit: ["grading_facts"], mutate: (t) => t.set(P("grading_facts", A), "zzz") }],
  ["grading facts the method cannot recompute", { omit: ["grading_facts"], mutate: (t) => t.set(P("grading_facts", A), JSON.stringify({ legs: [null] })) }],
  ["no pair recorded", { omit: ["case_strength"] }],
  ["a publication check refused", { mutate: (t) => setDoc(t, (d) => d.replace('case_scope: "Who approved the lease, and on what record."', 'case_scope: ""')) }],
  ["an older catalogue version stated", { mutate: (t) => setDoc(t, (d) => d.replace(/checks: "[^"]*"/, 'checks: "1.0.0"')) }],
  ["a material listed as not travelling whole", { memoIncluded: false, mutate: del(P("document", MEMO), P("extracted_text", MEMO)) }],
  ["a leg reaching a material the document does not list", (() => { const f = gradingFacts();
    f[A].legs.push({ target: "INFO-2026-0077-gone", kind: "document", role: "supports", grade: "C", grade_axis: "capture", grade_source: "capture" }); return { facts: f }; })()],
  ["a photo carried as its copy, the copy absent", { obscureMemo: true, edit: gone(P("obscured", MEMO)) }],
  ["a photo carried as its copy, the copy changed", { obscureMemo: true, edit: (b) => b.set(P("obscured", MEMO), Buffer.from("%PDF-1.7 the memo, uncovered")) }],
  ["a photo carried as its copy, with the original too", { obscureMemo: true, mutate: (t) => t.set(P("document", MEMO), MEMO_BYTES) }],
  ["a project attestation naming material the manifest does not list", { mutate: del(P("document", MINUTES), P("extracted_text", MINUTES)) }],
  ["a co-attestation naming material the manifest does not list", { mutate: del(P("document", MINUTES), P("extracted_text", MINUTES)),
    attestationRows: (l) => l.map((r) => (r.by_kind === "project" ? { ...r, by_kind: "co_attestation" } : r)) }],
  ["an attestation of a kind this checker does not know", { attestationRows: (l) => [...l, { ref: MINUTES, by_kind: "alien", by: "x" }] }],
  ["an attestation naming a material the document does not list", { attestationRows: (l) => [...l, { ref: "INFO-0000-none", by_kind: "group", by: GROUP }] }],
  ["a member attestation with no signature", { attestationRows: (l) => l.map((r) => (r.ref === MEMO && r.by_kind === "member" ? { ...r, signature: null } : r)) }],
  ["a member's signed account not carried", { accountRows: (l) => l.filter((r) => r.by !== "bob") }],
  ["a different complete edition", { completeEdition: "<!doctype html><p>another edition</p>" }],
  ["no complete edition carried", { edit: gone(P("complete_edition")) }],
  ["no complete edition listed", { manifest: (m) => { m.files = m.files.filter((f) => f.kind !== "complete_edition"); } }],
  ["a manifest key fingerprint that is wrong", { manifest: (m) => { m.keys[0].fingerprint = "SHA256:notit"; } }],
  ["a manifest naming another case document, case and edition", { manifest: (m) => { m.case_document_sha = sha("x"); m.case = "CASE-9999-0001"; m.edition = 9; } }],
  ["a manifest listing no case document", { manifest: (m) => { m.files = m.files.filter((f) => f.kind !== "case_document"); } }],
  ["a case document with no front matter", { mutate: (t) => t.set(P("case_document"), "nothing but words here") }],
  ["a manifest that is not the format", { manifest: (m) => { m.format = "bio-case-file/9"; } }],
  ["documents supplied later that fit nothing, and one that is not bytes", { edit: gone(P("document", MINUTES)) }, { documents: [Buffer.from("some other document"), 7, Buffer.from(MINUTES_BYTES)] }],
  ["a calculation that recomputes", { withCalculation: true }],
  ["a calculation whose result differs", { withCalculation: true, calcRow: wrongRow }],
  ["a calculation whose result key differs", { withCalculation: true, calcRow: { results: { [sha("another key")]: calcRow().results[calcRow().result_key] } },
    mutate: (t) => setDoc(t, (d) => d.replace(`result_key: '"${calcRow().result_key}"'`, `result_key: '"${sha("another key")}"'`)) }],
  ["a calculation whose recipe the evaluator refuses", { withCalculation: true, calcRow: { recipe: { ...calcRow().recipe, steps: [{ op: "eval", as: "n" }] } } }],
  ["a calculation input absent", { withCalculation: true, dropCalcInput: true }],
  ["a calculation input carried with other bytes", { withCalculation: true, calcInput: CALC_INPUT.replace('"60"', '"6"') }],
  ["a calculation input changed in its part after the manifest", { withCalculation: true, edit: (b) => { for (const k of [...b.keys()]) if (k.includes(CALC_INPUT_SHA)) b.set(k, Buffer.from(CALC_INPUT.replace('"60"', '"6"'))); } }],
  ["a calculation method this checker does not hold", { withCalculation: true, calcRow: { method_version: "bio-calc/9" } }],
  ["a calculation row file that lies, and a provenance file that lies", { withCalculation: true, mutate: (t) => {
    t.set(P("calculation", CALC), CG.calculationFileText(calcRow({ disclosed: "x" }))); t.set(P("calculation", "prov"), CG.provOf([])); } }],
  ["a chain resting on a calculation the document does not list", { withCalculation: true, calculations: [] }],
  ["a calculation whose inputs cannot be read", { withCalculation: true, calcRow: { inputs: null } }],
  ["a calculation input that is no table", { withCalculation: true, calcRow: { inputs: { pay: sha("zz") } }, calcInputSha: sha("zz"), calcInput: "zz" }],
  ["a workbook calculation", { withCalculation: true, calcRow: { method_version: "ironcalc/0.5" } }],
  ["a case resting on another group's finding", { withImported: true }],
  ["a /8 case document", { format: "bio-case-document/8" }],
  ["a /7 case document", { format: "bio-case-document/7" }],
  /* R29-R31 (T53): a cited register row carried as its extract */
  ["a register extract that holds", withExtract()],
  ["a register extract changed after it was built, a passage quoted where it is not", withExtract({ quoted: "Oak Ltd",
    rows: [extractRow({}, (r) => ({ ...r, extract: { ...r.extract, row: ["L-17", "Pine Cp"], src_row: 0 } }))] })],
  ["a limited register's extract without its notice", { ...withExtract({ rows: [extractRow({ use_limit: USE_LIMIT })] }),
    docEdit: (d) => d.split("\n").filter((l) => !l.includes("extract_use_limit_text_key:")).join("\n") }],
  ["a register extract whose header is not stated", withExtract({ more: { docEdit: (d) => d.split("\n").filter((l) => !l.includes("extract_header:")).join("\n") } })],
];

/* Criteria files and the standards a case measures against (R22): the fixtures of `standards-offline.test.mjs`, shortened. */
const BENCH = "STD-2026-0001-peer-times", CODE = "STD-2026-0002-lease-code", BODY = "ENT-2026-0001-board";
const criteria = (extra = {}) => [
  { standard: BENCH, portion: null, designation: "Peer response times", edition: "2024", issuer: "an association", citation: "PRT 2024", access: "paywalled", body: BODY, binds: false,
    passages: [{ content: sha("a passage no finding relies on"), text: "the whole chapter" }], label: "Benchmark", access_words: "x", ...extra },
  { standard: CODE, portion: "s. 4", designation: "Lease code", edition: "2023", issuer: "the council", citation: "LC s. 4", access: "free", body: BODY, binds: true, passages: [], label: "Standard", access_words: "y" }];
const stdFacts = () => { const f = gradingFacts(); const std = (target) => ({ target, kind: "standard", role: "supports", grade: "B", grade_axis: "capture", grade_source: "capture", ground: null });
  f[A].legs.push(std(BENCH)); f[C].legs.push(std(CODE)); return f; };
const claims = (m) => ["case_conclusions:", ...[A, C].flatMap((id) => [`  - target: ${id}`, "    relationship: project", "    project: PROJ-2026-0001-parks", "    version: null",
  "    claim_state: adopted", `    claim: "${m[id]}"`, '    claim_detail: ""', '    falsifier: "a later record"', "    concluded_by: alice", '    concluded_at: "2026-10-01T00:00:00Z"'])];
const std = (over = {}) => ({ facts: stdFacts(), docLines: claims({ [A]: "The board violated the peer average.", [C]: "Fine." }), criteria: criteria(), ...over });
export const STANDARDS_CASES = [
  ["criteria frozen before captures, a benchmark called violated", std()],
  ["criteria with captures carried whole, a passage no finding relies on", std({ criteria: criteria({ captures: [MINUTES_SHA] }).map((r, i) => (i ? { ...r, captures: [] } : r)) })],
  ["a criteria file listed but not carried", std({ edit: gone(P("criteria")) })],
  ["a criteria file carried with other bytes", std({ edit: (b) => b.set(P("criteria"), Buffer.from("[]")) })],
  ["a criteria file with no case document", std({ mutate: del(P("case_document")) })],
  ["a criteria file that is no list", std({ criteria: "not json" })],
];

/* The account an offline check reads (R24), tied to the carried passages, findings and a lens statement. */
const passageId = () => JSON.parse(caseFile().bytesOf.get(P("passages", A)).toString("utf8"))[0].content_id;
export function accountCases() {
  const conclusionLines = rows("case_conclusions", [{ target: A, claim: "The lease was approved without a vote", claim_state: "adopted", claim_detail: null },
    { target: C, claim: null, claim_state: "undetermined", claim_detail: "the record cannot establish who watched" }]);
  const lens = [{ bundle: "BND-2026-0001", id: "S1", kind: "scrutiny", subject: "the vendor", text: "We check a vendor's word more closely.", justification: "It misled us before.", citations: [] }];
  const accountLines = (list) => CG.accountLines(list.map((r) => ({ kind: "account", began_as: "member", bias_statement: null, ...r })));
  const passage = { kind: "passage", ref: passageId(), ord: null }, finding = (ref) => ({ kind: "finding", ref, ord: null });
  const at = (account, extra = {}) => ({ docLines: [...conclusionLines, ...accountLines(account)], lens, ...extra });
  return [
    ["an account that holds", at([{ ord: 0, text: "The lease was approved without a vote.", cites: [passage, finding(A)] }, { ord: 3, text: "We read a vendor's word more closely.", cites: [], bias_statement: "S1" }])],
    ["an account whose every arm departs", at([
      { ord: 0, text: "Nobody voted.", cites: [] },
      { ord: 1, text: "John Roe approved the lease on 2023-05-01 for $9,999, saying “never”.", cites: [passage] },
      { ord: 2, text: "Pages 3-9 apply.", cites: [passage] },
      { ord: 7, text: "The record bears on it.", cites: [finding("INQ-9999-none")] },
      { ord: 3, text: "The lease was not approved without a vote.", cites: [finding(A)] },
      { ord: 4, text: "This established that nobody knew.", cites: [finding(C)] },
      { ord: 5, text: "We expect favour.", cites: [], bias_statement: "S7" },
      { ord: 6, text: "We expect favour, as the vote of 2024-03-03 shows.", cites: [], bias_statement: "S1" }])],
    ["an account citing material whose text is not carried", at([{ ord: 0, text: "John Roe adjourned it.", cites: [{ kind: "material", ref: MINUTES, ord: null }] }], { edit: gone(P("extracted_text", MINUTES)) })],
    ["an account that cannot be read", { docLines: CG.accountLines([{ ord: 0, text: null, cites: [], kind: "account", began_as: "member" }]) }],
  ];
}

export const allCases = () => [...CASES, ...STANDARDS_CASES, ...accountCases()].map(([name, opts, args = {}]) => {
  const cf = caseFile(opts);
  return { name, parts: cf.parts, args, opts };
});

/* A stored ZIP built by hand so that one thing in it can be wrong: each `entry` is `{name, bytes, flags?, method?, crc?, localSig?, size?}`. */
export function rawZip(entries, { count = null, cdSize = null } = {}) {
  const u16 = (n) => [n & 255, (n >> 8) & 255], u32 = (n) => [n & 255, (n >>> 8) & 255, (n >>> 16) & 255, (n >>> 24) & 255];
  const out = [], cd = [], offsets = [];
  const crc32 = (bytes) => { let c = ~0; for (const b of bytes) { c ^= b; for (let k = 0; k < 8; k++) c = c & 1 ? (c >>> 1) ^ 0xedb88320 : c >>> 1; } return ~c >>> 0; };
  for (const e of entries) {
    const name = Buffer.from(e.name), bytes = Buffer.from(e.bytes);
    offsets.push(out.length);
    const crc = e.crc ?? crc32(bytes), size = e.size ?? bytes.length;
    out.push(...u32(e.localSig ?? 0x04034b50), ...u16(20), ...u16(e.flags ?? 0), ...u16(e.method ?? 0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size),
      ...u16(name.length), ...u16(0), ...name, ...bytes);
    cd.push([...u32(0x02014b50), ...u16(20), ...u16(20), ...u16(e.flags ?? 0), ...u16(e.method ?? 0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(size), ...u32(size),
      ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offsets.at(-1)), ...name]);
  }
  const cdStart = out.length, cdBytes = cd.flat();
  return new Uint8Array([...out, ...cdBytes, ...u32(0x06054b50), ...u16(0), ...u16(0), ...u16(count ?? entries.length), ...u16(count ?? entries.length),
    ...u32(cdSize ?? cdBytes.length), ...u32(cdStart), ...u16(0)]);
}

/** The parts whose bytes are not a stored ZIP this checker reads, each wrong in one way (R2, R27's `problem` words). */
export const BAD_PARTS = () => {
  const ok = { name: "a.txt", bytes: "hello" };
  return {
    "not bytes": "text",
    "not a ZIP": new Uint8Array([1, 2, 3]),
    "a central directory outside the archive": rawZip([ok], { cdSize: 100000 }),
    "a central directory cut short": rawZip([ok], { count: 3 }),
    "a name twice": rawZip([ok, ok]),
    "an encrypted entry": rawZip([{ ...ok, flags: 1 }]),
    "a compressed entry": rawZip([{ ...ok, method: 8 }]),
    "an entry with no local header": rawZip([{ ...ok, localSig: 0x12345678 }]),
    "an entry cut short": rawZip([{ ...ok, size: 5000 }]),
    "an entry that fails its CRC": rawZip([{ ...ok, crc: 1234 }]),
  };
};

/** Everything the battery runs in-process beyond `checkCaseFile` over `allCases()`: the other entries of the module. */
export async function runExtras() {
  const out = {};
  const cf = caseFile();
  /* readCaseFile: each bad part, no part, and a part list that throws */
  out.bad = Object.fromEntries(Object.entries(BAD_PARTS()).map(([n, p]) => [n, CC.readCaseFile([p]).departures]));
  out.none = CC.readCaseFile([]).departures;
  const thrower = [cf.parts[0]]; Object.defineProperty(thrower, 0, { get() { throw new Error("boom"); } });
  out.throwing = CC.readCaseFile(thrower).departures;
  out.input = (await CC.checkCaseFile({ parts: cf.parts, get documents() { throw new Error("boom"); } })).integrity.departures;
  /* reweigh: the case document absent, and an exception */
  const answer = await CC.checkCaseFile({ parts: cf.parts });
  out.reweighAbsent = CC.reweigh({ parts: caseFile({ edit: gone("case.md") }).parts, answer, lens: "removed" }).lens.departure;
  out.reweighThrows = CC.reweigh({ parts: cf.parts, documents: [new Proxy({}, { getPrototypeOf() { throw new Error("boom"); } })], answer, lens: "removed" }).lens.departure;
  /* the specification read with no version, and with one not held */
  out.spec = [CC.caseFileSpec(null).detail, CC.caseFileSpec("bio-case-file/9").detail];
  /* standards' use, by itself */
  out.standards = CC.checkStandardsUse({}).refusals.map((r) => r.says);
  /* the account, by itself: the figures a sentence states that its cites do not */
  const cited = [{ kind: "passage", ref: "P1", ord: null, text: "The lease was approved without a vote on March 3, 2024, for $4,200, by Jane Doe of the Parks Board." }];
  out.account = ["Pages 3-9 apply.", "It cost $9,999.", "It was approved by John Roe.", "It happened on 2023-05-01.", "The minutes say “approved after a long debate”."]
    .map((text) => CC.checkAccount({ account: [{ ord: 0, text, cites: [{ kind: "passage", ref: "P1" }], kind: "account" }], cited, printed: [], conclusions: [] }));
  const claimsLong = [{ finding: "F1", claim: "The lease was approved without a vote", claim_state: "adopted", legs: [] }];
  out.bias = CC.checkAccount({ account: [{ ord: 0, text: "The lease was approved without a vote, as we expected.", cites: [], bias_statement: "S1" },
    { ord: 1, text: "This shows that the board favoured the vendor.", cites: [], bias_statement: "S1" }], cited: [], printed: ["S1"], conclusions: claimsLong });
  const legCited = [{ kind: "leg", ref: "F1", ord: 1, text: "The memo shows the board acted alone.", role: "cuts_against" }];
  out.reads = CC.checkAccount({ account: [{ ord: 0, text: "The memo shows the board acted alone.", cites: [{ kind: "leg", ref: "F1", ord: 1 }], kind: "account" }],
    cited: legCited, printed: [], conclusions: [{ finding: "F1", claim: "x", claim_state: "adopted", legs: [{ ord: 1, target: "INFO-2", role: "cuts_against" }] }] });
  out.unread = CC.checkAccount({ account: [{ ord: 0, text: "The record bears on it.", cites: [{ kind: "finding", ref: "F9" }], kind: "account" }], cited: legCited, printed: [], conclusions: [] });
  /* a manifest that is not JSON, one that is no object, and two parts whose manifests differ */
  const MANIFEST = CG.CASE_FILE_MANIFEST_PATH;
  out.manifests = [[rawZip([{ name: MANIFEST, bytes: "not json" }])], [rawZip([{ name: MANIFEST, bytes: "[1]" }])],
    [rawZip([{ name: MANIFEST, bytes: '{"files":[]}' }]), rawZip([{ name: MANIFEST, bytes: '{"files":[],"parts":[]}' }])]].map((parts) => CC.readCaseFile(parts).departures);
  /* the standalone program's own words: an unreadable file, an argument left out, and the departures of how a case uses its standards */
  out.programStandards = [];
  for (const [, opts] of STANDARDS_CASES) out.programStandards.push((await CC.runProgram(["s.zip"], async () => caseFile(opts).parts[0])).text.split("\n").slice(0, 6));
  const read = async (p) => { if (p === "a.zip") return cf.parts[0]; throw new Error("no such file"); };
  out.program = [await CC.runProgram(["nope.zip"], read), await CC.runProgram(["a.zip", "--document"], read), await CC.runProgram(["a.zip"], read)].map((x) => x.text.split("\n")[0]);
  return out;
}

/** The library's answer to every case (canonical, for the program to match) and the extras; the keys read are noted by the hook. */
export const keyLines = (c) => (c.args.keys ? c.args.keys.map((k) => keyFor(k).line) : null);
export const libraryAnswer = (c) => CC.checkCaseFile({ parts: c.parts, ...(c.args.keys ? { keys: keyLines(c) } : {}),
  ...(c.args.documents ? { documents: c.args.documents } : {}), ...(c.args.lens !== undefined ? { lens: c.args.lens } : {}) });
export async function runBattery() {
  const results = [];
  for (const c of allCases()) results.push({ name: c.name, answer: await libraryAnswer(c) });
  return { results, extras: await runExtras() };
}

if (process.argv.includes("--battery")) {
  const r = await runBattery();
  process.stdout.write(JSON.stringify({ reached: [...(globalThis.__reached ?? [])].sort(), cases: r.results.length }));
}

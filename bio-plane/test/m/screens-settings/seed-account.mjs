/* The seed of the account, notes, settings and recovery tests (T51; screens-settings): the world's sessions (store-request's `storeWorld`)
   and the one thing a world cannot make, a fault at the edge (a read that is silent, a read refused with a provider's code). Nothing here
   builds another module's answer: the answers are the owners' own, made by their real acts. */
import { generateKeyPairSync } from "node:crypto";
import { storeWorld } from "./kit.mjs";
import { refuse, env } from "./fixtures.mjs";

/** A team: the founder (its one active administrator), dev (a member who contributes), and teo (a member holding no capability). */
export async function team() {
  const w = await storeWorld();
  const founder = await w.signIn("founder");
  const dev = await w.signIn("dev", { capabilities: ["contribute"] });
  const teo = await w.signIn("teo", { capabilities: [] });
  return { w, founder, dev, teo };
}

/** A fresh Ed25519 public key as credentials R9 takes it (`keyB64`): the SSH wire form of the key, made by node's crypto. */
export function freshKey() {
  const { publicKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const u32 = (n) => Buffer.from([0, 0, 0, n]);
  return Buffer.concat([u32(11), Buffer.from("ssh-ed25519"), u32(32), pub]).toString("base64");
}

/** The faults a read can show at the platform's edge: a read the store did not answer, and a provider's refusal. */
export const SILENT = (...ops) => Object.fromEntries(ops.map((op) => [op, "none"]));
export const REFUSED = (op, code) => ({ [op]: refuse(code) });

/** The draft the assistant's model gives (agent-worker R59), an externally driven answer: the world's door does not ask the model after
 *  `writinghelp`'s owner answers past its refusals (store-request's door.mjs header: "no draft asked after a draft-due act"), so the
 *  draft is handed at the platform's edge by the table. `asker` is the member id the label names. */
export const DRAFT_TEXT = "The potholes on Seminary Avenue between 59th and 62nd reopened three times since spring.";
export const writingHelp = (asker, over = {}) => ({
  writinghelp: () => env({ ok: true, text: DRAFT_TEXT, label: { kind: "machine", asked_by: "member:" + asker }, withheld: [], note: "", ...over }),
});

/** A team whose assistant is reachable by the real acts: the founder gives the team's account (the platform's seal secret in `env`, the
 *  founder's password asked again, `reauth`). T53 (R95): the alpha's group key is retired; the team's account is `aiaccountadd` (`ai-accounts`
 *  R40, `op-declarations` R24), which the store's world answers CATALOGUE_UNAVAILABLE until it holds a catalogue (store-assembly). */
export async function assistantTeam() {
  const w = await storeWorld({ env: { ACCOUNT_SEAL_SECRET: "a-long-seal-secret-for-the-notes-test" } });
  const founder = await w.signIn("founder");
  const dev = await w.signIn("dev", { capabilities: ["contribute"] });
  await founder.act("reauth", { body: { password: w.password } });
  await founder.act("aiaccountadd", { body: { owner: "group", provider: "anthropic", plan: "api-team", means: "sealed", secret: "sk-ant-api03-the-team-key-0000000000" } });
  return { w, founder, dev };
}

/* journey-check R1 (a), installer R90: an install begins only after a passed "Check my account" for the same short name.
   The seam tests run that check for real, through the installer's own `/begin` (mode "check") and the account's consent,
   and carry the `chk` cookie the check's answer sets into the install, as the founder's browser does. Never a hand-built
   cookie: the installer's own check over the walk's fake account decides whether it passed. */

/* Runs the check of `slug` over `account` (`req(path, init)` is the installer's own fetch); answers the cookie pair `chk=…`
   the check's answer set, or throws, naming the check's state, when the check set none. */
export async function passedCheck(req, account, slug) {
  const begun = await req("/begin", { method: "POST", body: JSON.stringify({ slug, mode: "check" }) });
  const j = await begun.json();
  if (!j.ok) throw new Error(`the check of ${slug} was refused at /begin: ${j.error}`);
  const wiz = (begun.headers.get("set-cookie") || "").split(";")[0];
  const consent = await (await account.handle(new Request(j.authorize))).text();
  const back = new URL(/href="([^"]+)"/.exec(consent)[1].replace(/&amp;/g, "&"));
  const res = await req("/callback" + back.search, { headers: { cookie: wiz } });
  const page = await res.text();
  const chk = res.headers.getSetCookie().map((c) => c.split(";")[0]).find((c) => /^chk=/.test(c) && c !== "chk=deleted");
  if (!chk) throw new Error(`the check of ${slug} did not pass: ${(/id="check-whole" data-state="([^"]+)"/.exec(page) || [, "no answer"])[1]}`);
  return chk;
}

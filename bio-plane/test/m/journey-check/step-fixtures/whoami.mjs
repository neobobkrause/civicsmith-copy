// requirement: journey-check R32
// follows: journey fixture / step 2
// expects: the page says "Signed in" for the session the first step kept
export default async function (step) {
  const session = step.kept("session");
  await step.page.goto(step.at(`/whoami?s=${session ? "kept" : "none"}`));
  const text = await step.page.content();
  if (!text.includes("Signed in")) throw new Error(`the page said: ${text}`);
  return text;
}

/* requirement: journey-check R32
   follows: journey fixture / step 1
   expects: the page says "Welcome", and the sign-in it gives is kept for the next step */
export default async function (step) {
  await step.page.goto(step.at("/"));
  const text = await step.page.content();
  if (!text.includes("Welcome")) throw new Error(`the page said ${JSON.stringify(text)}`);
  step.keep("session", "fixture-session-not-to-be-printed");
  return "Welcome";
}

/* A stand-in for wrangler for dev-key.test.mjs: it reads stdin whole and echoes it back on stdout and stderr (the worst a
 * real wrangler could do with a secret), with its arguments and the log settings it was given. No network. */
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (d) => { input += d; });
process.stdin.on("end", () => {
  process.stdout.write(`args ${process.argv.slice(2).join(" ")}\n`);
  process.stdout.write(`WRANGLER_WRITE_LOGS=${process.env.WRANGLER_WRITE_LOGS} account=${process.env.CLOUDFLARE_ACCOUNT_ID}\n`);
  process.stdout.write(`echo ${input}\n`);
  process.stderr.write(`echo ${input}\n`);
  process.exitCode = Number(process.env.FAKE_WRANGLER_EXIT ?? 0);
});

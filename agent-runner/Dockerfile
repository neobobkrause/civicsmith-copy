# agent-runner: the gate run container (T53; R43-R60). It runs one gate run per instance against the run's declared
# provider and seals the results inside; it holds no Claude Code, no Agent SDK and no shell (R56).
# Build (the release, T33-D1): docker build --platform linux/amd64 -t <repository>:<version> agent-runner
# The image is then named only by its digest, which the release writes into fleet-member.json and wrangler.jsonc (R7, R13).
# The base is pinned by digest (R13, R56): gcr.io/distroless/nodejs22-debian12:nonroot, its linux/amd64 manifest as read
# on 2026-11-05. It carries the Node runtime alone: no shell, no package manager, no curl or wget.
FROM gcr.io/distroless/nodejs22-debian12:nonroot@sha256:afa48e2ae1100924bfb069244f4ef70c0f9c061654c669da6b7faa7881c1ec7f
# NODE_EXTRA_CA_CERTS: Cloudflare's container CA, through which the Worker applies R45's platform list to HTTPS.
ENV NODE_ENV=production PORT=8080 NODE_EXTRA_CA_CERTS=/etc/cloudflare/certs/cloudflare-containers-ca.crt
WORKDIR /app
# The image's code, built by scripts/build-image.mjs at test, deploy and release, never committed: one self-contained entry and the run it loads. It
# installs no package, so no install or lifecycle script runs (R16).
COPY dist/image/ ./
USER nonroot
EXPOSE 8080
# Exec form (R56): the base's entrypoint is the Node runtime; nothing writable but the temporary directory (R9).
CMD ["entry.js"]

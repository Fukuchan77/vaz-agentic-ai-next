# syntax=docker/dockerfile:1

# apps/worker (@vaz/worker) — long-running Node 24 durable worker container (R3.1).
#
# Multi-stage: the `build` stage installs the whole pnpm workspace and uses
# `pnpm deploy` to emit a self-contained, pruned deployment of just @vaz/worker
# and its (workspace + prod) dependencies; the `runtime` stage runs it as a
# non-root, long-running process. The @vaz/* packages are source-only (raw TS).
# `pnpm deploy` places them under node_modules, where Node's default TypeScript
# loader refuses to strip types, so typescript-loader.mjs explicitly applies
# Node's own transformer before evaluation. There is still no compile step.
#
# NOTE (env FLAG, spike §1): base-image pull + `docker build` are blocked in the
# current sandbox (Task 8.1). This Dockerfile is authored against the pnpm-deploy
# and Inngest Connect self-hosting references (docs/spikes/phase3-durable-engine.md
# §7/§9) and validated structurally via `docker compose config`; a live build +
# restart-crossing run is exercised once the FLAG is lifted (durable E2E, Task 15).

ARG NODE_VERSION=24
# Must equal the `packageManager` version in the root package.json: this stage runs
# `pnpm install --frozen-lockfile` against the committed pnpm-lock.yaml, and a pnpm
# whose major does not match the lockfile format either refuses the frozen install or
# silently re-resolves it — neither of which is a reproducible image. Guarded by
# tests/repo/container-toolchain-pins.spec.ts, because nothing in the TS gate builds
# this image and the drift is therefore invisible until a deploy.
ARG PNPM_VERSION=12.6.0

# --- build: install the workspace, then prune to a standalone worker deploy ---
FROM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /repo

# Copy the full workspace (node_modules excluded via .dockerignore): pnpm needs
# every member manifest + the lockfile to resolve the graph for a frozen install.
COPY . .
RUN pnpm install --frozen-lockfile

# Emit a self-contained deployment of @vaz/worker (workspace deps copied in,
# devDependencies dropped by --prod). /out is outside the workspace root as
# `pnpm deploy` requires.
RUN pnpm --filter=@vaz/worker deploy --prod /out

# --- runtime: minimal Node 24, non-root, long-running ---
FROM node:${NODE_VERSION}-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out .

# Drop privileges: the base `node` image ships a non-root `node` user.
USER node

# The worker connects OUTBOUND to the Inngest Connect gateway (engine:8289) and
# exposes no inbound port. The loader permits source-only @vaz/* packages in
# pnpm's deployed node_modules layout; start.ts then builds the Postgres/Redis
# stores + Inngest engine and connects via the Connect gateway (Task 13.9).
CMD ["node", "--import", "./register-typescript-loader.mjs", "src/start.ts"]

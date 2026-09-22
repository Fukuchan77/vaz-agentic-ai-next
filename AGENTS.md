# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Commands

Tasks are managed via **mise** (`mise.toml` is the source of truth). Direct `pnpm` / `uv` commands when mise is unavailable.

| Action | Mise Task | Direct Command (Single / Specific Target) |
| --- | --- | --- |
| Dev server (Turbopack) | `mise run dev` | `pnpm --filter @vaz/web exec next dev` |
| Build (production) | `mise run build` | `NODE_ENV=production pnpm --filter @vaz/web exec next build` |
| Unit tests (all workspace) | `mise run test:run` | `pnpm exec vitest run` |
| Single Web test (jsdom) | — | `pnpm exec vitest run --project web apps/web/tests/chat-route.spec.ts` |
| Single Package test (node) | — | `pnpm exec vitest run --project packages packages/agents/tests/chat-agent.spec.ts` |
| Single Evals tier-1 test | — | `pnpm exec vitest run --project packages packages/evals/src/unit/tool-selection.spec.ts` |
| Single Repo-guard test | — | `pnpm exec vitest run --project repo tests/repo/ci-workflows.spec.ts` |
| E2E tests (Playwright) | `mise run test:e2e` | `pnpm exec playwright test` |
| E2E vs local Ollama | `mise run test:e2e:ollama` | `AI_PROVIDER=ollama pnpm exec playwright test` |
| Lint / Auto-fix | `mise run lint` / `lint:fix` | `pnpm exec biome check .` / `pnpm exec biome check --write .` |
| Type check | `mise run typecheck` | `pnpm -r run typecheck` (standalone: `pnpm --filter @vaz/evals run typecheck`) |
| DB baseline migrations | `mise run db:migrate` | `pnpm --filter @vaz/db run migrate` |
| Aggregate gate (pre-commit) | `mise run check` | Runs `lint`, `typecheck`, `test:run`, `audit`, `lint:model-ids` |
| Python sidecar (`services/agent`) | `mise run py:check` | `cd services/agent && uv sync && uv run ruff check . && uv run pyright && uv run pytest` |
| Python API lane (`services/api`) | `mise run api:check` | `cd services/api && uv sync && uv run ruff check app/ evals/ tests/ && uv run ty check app/ evals/ && uv run pytest tests/unit/ tests/integration/ tests/e2e/ -v` |
| Single Python test (`services/agent`) | — | `cd services/agent && uv run pytest tests/test_eval.py::test_name -v` |
| Single Python test (`services/api`) | — | `cd services/api && uv run pytest tests/unit/stores/test_session_store.py::test_name -v` |
| OpenAPI TS Codegen | `mise run openapi:gen` | Regenerates `packages/schemas/src/generated/agent-service.ts` from FastAPI Pydantic models |

## Code Style & Language Conventions

### TypeScript (Web & Packages)
- **Formatting**: Tabs, double quotes, 100-char line width (enforced by Biome and `.editorconfig`).
- **Imports & Types**: `import type` is mandatory for type-only imports (`verbatimModuleSyntax: true` + `isolatedModules: true` + Biome `useImportType`).
- **Package Imports**: Source-only packages (`packages/*`) use `"exports": {"./*": "./src/*.ts"}`. No package-level build step or per-package `tsconfig.json`. Use subpath imports (e.g. `@vaz/schemas/deps`).
- **Self-referencing imports in `@vaz/rag`**: Node native ESM ingest CLI requires `@vaz/rag/retrieve/index` rather than relative extensionless imports `../retrieve/index`.
- **Globals**: Vitest globals (`test`, `expect`, `vi`, `describe`, `beforeEach`) require no imports.
- **Dependency Injection**: Always pass `deps: AgentDeps` (`db`, `logger`, `now: Clock`, optional `audit`, `runtimeContext`). Never invoke `new Date()` in agents/tools — use `deps.now()`.
- **React 19 & Next.js**: React Compiler is enabled (`reactCompiler: true`); do not add manual `useMemo` or `useCallback`.
- **Carbon Design System**: Never import `@carbon/react` wholesale (800kB+ bundle); add per-component `@use` to `apps/web/src/assets/styles/global.scss`. Any component using Carbon must declare `"use client"`.

### Python (`services/agent` & `services/api`)
- **`services/agent`**: `from __future__ import annotations` required on every module; ruff (line length 100, py313); pyright in strict mode. Snake_case for Pydantic schema fields.
- **`services/api`**: Type checker is `ty` in strict mode (not mypy); Ruff with `S`, `ANN`, `D` (Google-style docstrings), `B`, `SIM`. `force-single-line = true` imports. Python pinned strictly to 3.13. All env access must go through `Settings` / `get_settings()`.

## Non-Obvious Architecture & Critical Constraints

- **Single Hardcoded Model ID Rule (R1.8/ADR-5)**: Hardcoded model strings are ONLY allowed in `packages/config/src/model-allowlist.ts` (and default fallback in `@vaz/schemas/src/env.ts` / `services/agent/app/config.py`). `scripts/forbid-model-ids.sh` enforces this at build/CI time.
- **Dependency Graph Direction**: `@vaz/schemas` and `@vaz/db` are leaf packages (zero `@vaz/*` runtime imports). Next: `@vaz/config`, `@vaz/tools`, `@vaz/rag`. Next: `@vaz/agents`. Top: `apps/web`, `apps/worker`, `@vaz/evals`. Never create circular dependencies.
- **RAG Provenance & Embeddings**: Dimension is DDL-fixed at 768 (`EMBEDDING_DIM`). `assertNoProviderMixing` forbids mixing embedding providers/models in a single corpus without migration and full re-ingest.
- **Hermetic Unit Tests**: TypeScript unit tests block real network requests via `tests/setup/hermetic-network.ts` (unmocked network calls throw immediately). Python unit tests use in-process ASGI transports or `FunctionModel`.
- **Single-Writer DB Principle**: pgvector embeddings are written exclusively by TS (`packages/rag`). Python sidecars are stateless and never write to the database.
- **AI SDK v7 Conventions**: Use `createUIMessageStreamResponse({ stream: toUIMessageStream({ stream: result.stream }) })`. Multi-step tool use uses `stopWhen: isStepCount(n)`. Tool definition takes `inputSchema:` (not `parameters:`).
- **Zod v4 Usage**: Use `z.looseObject()`, `z.url()`, `z.email()`, `z.iso.datetime()`, `z.uuid()`.
- **Strict Request Objects**: Approval requests and agent API routes use `z.strictObject` / Pydantic `extra="forbid"`. Extra client fields (e.g. injected messages/history/model) are rejected.
- **Privacy Contract**: Loggers (`logger.info/warn/error`) must never log raw user prompts or raw tool arguments/output. The Audit sink is the only approved store for tool execution arguments.
- **Pivotal Major Pins**: `vitest` / `@vitest/coverage-v8` stays on 4.x (5.x mock state reset breaks auth spec); `typescript` stays on 6.x; `@types/node` stays on `^24` (matches Node 24 LTS).

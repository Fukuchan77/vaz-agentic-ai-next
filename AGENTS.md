# AGENTS.md

This file provides guidance to agents when working with code in this repository.

## Project

Polyglot Turborepo — **pre-implementation**. Only `specs/` exists today.
Stack: Next.js 16.3 (apps/web) · FastAPI Python 3.13 (apps/agent-api) · Pydantic AI · LlamaIndex · AI SDK 7 · pnpm 11 · uv 0.12 · Turborepo 2.10.11.

This repo is **`vaz-agentic-ai-next`, not `vaz-ai-next`**. T-0 imports `Fukuchan77/vaz-ai-next@cf72583` as the monorepo body; `apps/agent-api` is ported from `fastapi-pydantic-ai-agent@d4d5f8d`. Facts below labelled `bbf1156` come from upstream `main`, which is 2 commits ahead of the import pin.

## Toolchain constraints (mise.toml)

- Python **3.13** (NOT 3.14 — slowapi 0.1.10 breaks with `DeprecationWarning→error`)
- Node **24 LTS**, pnpm **11.24.x**, Turborepo pinned **exactly** `= 2.10.11` (`>=` / `~=` break `turbo-version-check`, which compares `mise config get tools.turbo` to `turbo --version` for equality). 2.10.11 is the floor for `futureFlags.experimentalPythonWorkspaces`
- TypeScript pinned at **6.x** (not 7.x) — pending ADR; this is a decision, not an omission
- uv **0.12.x** — 0.10.0 changed `uv venv` behavior: refuses to overwrite existing dirs without `--clear`; use `uv venv --python 3.13 --clear .venv-check` in scripts
- The imported `mise.toml` already carries `[tools]`, `[hooks]`, and **19 tasks including `lint:model-ids`** — preserve and append; recreating it deletes the model-ID gate

## Commands

Never invoke a bare tool — `mise run <task>`, else `uv run` / `pnpm exec`.

```bash
# Both languages in one command (the only such command)
turbo run typecheck        # → codegen → check → tsc / ty

# Python only — TS resolves to zero turbo tasks (see CLAUDE.md)
turbo run lint test

# TS lanes, outside turbo
pnpm exec biome check .    # lint/format (Biome, not ESLint/Prettier)
pnpm run test:run          # the root `test` script is vitest in watch mode

# Python lanes, from apps/agent-api (not a uv workspace member — ADR-P0-05)
uv run --frozen ruff check .
uv run --frozen ruff format --check .   # turbo's format:ruff omits --check and rewrites files
uv run --frozen ty check .              # ty, not mypy

# Single test
uv run --frozen pytest tests/unit -k test_name_here
pnpm exec vitest run src/path/to/file.test.ts
```

`pnpm install` automatically activates git hooks in `.githooks/` via `core.hooksPath`.

## Critical version constraints

- `apps/agent-api`: `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` — **do NOT add the `openai` extra and do NOT pin openai explicitly**; openai version is governed by litellm's own `openai<3.0.0` declaration (§2.6.3). Omitting the extra allows the floor to advance to 2.35.3+, resolving to openai 2.54.0 / litellm 1.98.0 (`pip-audit` clean at `d4d5f8d`).
- `services/agent` (stateless sidecar): `pydantic-ai-slim[...]>=2.33,<3.0` — no litellm, so fine. openai 3.3.1 resolves without conflict.
- **uv workspace (`[tool.uv.workspace]`) and the two-tier version policy are mutually exclusive** (§12 R14). A single workspace produces one lock, which cannot simultaneously satisfy `apps/agent-api` (no `openai` extra, litellm→openai 2.54) and `services/agent` (openai 3.x). **Decided — ADR-P0-05 option (a): neither app is a workspace member.** `members = []` at P0; `apps/agent-api` keeps its own `uv.lock` (`cd apps/agent-api && uv lock`), stays outside Turborepo's Python management, and runs its lanes through `mise`. Parts of plan.md still assume membership (`--package agent-api`, `turbo ls` listing `agent-api`) — reconcile before T-1.3; see CLAUDE.md.
- `services/agent@bbf1156` currently declares `pydantic-ai-slim[anthropic,openai]>=2.27` (an `openai` extra §2.5-5 forbids) and `fastapi>=0.141` (against the `<0.137` ceiling). Both must be reconciled; its `uv.lock` already exists, so REQ-3.1 is pattern A.
- `fastapi<0.137` — 0.137+ breaks slowapi rate-limiting silently (routes no longer found in `app.routes`).
- `starlette<1.0` — slowapi 0.1.10 is incompatible with starlette 1.x.
- `pydantic-ai-litellm>=0.2.3,<0.3.0` — use `<0.3.0` not `<1.0` (0.x minor = breaking).
- `@ai-sdk/react` 4.x is a **different major series** from `ai` 7.x — not co-versioned as v1 docs implied.
- All GH Actions `uses:` pinned to 40-char SHA **and each workflow must declare minimal `permissions:`**. **CAUTION**: this enforcement test (`test_ci_workflows.py`) exists only in `fastapi-pydantic-ai-agent`, NOT in `vaz-ai-next`. All 21 `uses:` refs in `vaz-ai-next@bbf1156` are variable tags (`@v7`/`@v6`/`@v4`); zero `permissions:` declarations exist. Porting the test (T-5.5, into `apps/agent-api/tests/unit/`) + pinning + declaring `permissions:` is new P0 work, not maintenance.

## CI topology (there is no `ci.yml`)

- The real workflows are `lint.yml`, `tests.yml`, `python.yml`, `security-daily.yml`, `eval-pr.yml`, `eval-nightly.yml`. Lint / test / Python / audit already run as independent workflows. **Add jobs to those files — never create a new workflow file** (a second CI path violates principle 5).
- A GitHub Actions job id cannot contain a colon: the job is `test-unit` with `name: "test:unit"`.
- Only `lint`, `test:unit`, and `audit` exist today; the spec's 11-job table describes the target, not the present.

## Pydantic AI API rules (v2 — violations raise TypeError)

- Use `retries=AgentRetries(tools=2, output=2)` — NOT `output_retries=2` (no such param).
- Use `instrument` nowhere on `Agent(...)` — instrumentation is `logfire.instrument_pydantic_ai()` at startup only.
- Use `instructions=` NOT `system_prompt=` — `system_prompt` persists in `message_history` and corrupts HITL resume.
- Always set `end_strategy="early"` explicitly — v2 default changed to `"graceful"` which inflates tool counts and audit trails.
- Agent's `run_stream(toolsets=[guarded])` with `agent.override(tools=[], toolsets=[guarded])` — omitting `tools=[]` causes double-registration of all `@agent.tool` functions.
- `VercelAIAdapter.dispatch_request()` returns a complete `Response` and cannot be wrapped. Use `from_request()` → `run_stream()` → lifecycle layer → `encode_stream()` instead.
- HITL `sdk_version` must be ≥6; use `sdk_version=7` for AI SDK 7 frontend.
- `/v1/chat` route path must be `"/chat"` not `"/v1/chat"` (prefix added by `app.include_router(v1_router, prefix="/v1")`).
- SSE lifecycle: `Agent.iter()` holds an anyio cancel scope per task — driving `__anext__()` from a different task raises `Attempted to exit cancel scope in a different task`. Use a single persistent `_drive_to_queue` task; use `asyncio.wait()` (not `asyncio.wait_for()`) for heartbeat.
- `VercelAIAdapter` trust defaults must not be changed: `manage_system_prompt='server'`, `allow_uploaded_files=False`, `allowed_file_url_force_download=frozenset()` (empty). The `'allow-local'` value for the last param is the CVE-2026-25580 SSRF path.

## Package naming (py- prefix for Python packages)

Python packages use `py-` prefix to avoid collisions with existing TS packages:
`packages/py-agents`, `packages/py-schemas`, `packages/py-evals`, `packages/py-knowledge`, `packages/api-types` (not `ui-types`).
Do NOT rename existing TS packages (`packages/schemas`, `packages/evals`, `packages/agents`).

## Generated files — commit, never gitignore

- `packages/api-types/generated/` and `packages/schemas/src/generated/` are diff-reviewed — do not gitignore.
- `apps/web/AGENTS.md` is auto-written by `next dev`; commit it. Pre-commit checks for uncommitted generated files.
- `AGENTS.md` and `CLAUDE.md` at repo root are edited as one change unit.
- Model ID hardcode exceptions: **3 files** — `packages/config/src/model-allowlist.ts`, `packages/schemas/src/env.ts`, `services/agent/app/config.py` (lines 41-43 of `scripts/forbid-model-ids.sh`).
- **Do not import upstream's `.gitignore`** — it would drop this repo's coding-agent-directory section. Repair the local one instead: `lib/` currently swallows `apps/web/lib/`, and `node_modules/` / `.next/` are missing. `.sdd/` stays ignored; `specs/memory/constitution.md`.

## Testing

- `models.ALLOW_MODEL_REQUESTS = False` in conftest globally; also block sockets via `block_network()` autouse fixture in `tests/unit/`.
- `TestModel(call_tools=["tool_name"])` — if any `requires_approval=True` tool exists, default `TestModel` makes `result.output` a `DeferredToolRequests`, breaking `isinstance` asserts.
- `FunctionModel` final response must use `ToolCallPart("final_result", ...)` not `TextPart` when `output_type` is structured (else `UnexpectedModelBehavior: Exceeded maximum output retries`).
- Playwright cannot intercept EventSource; run SSE E2E against a real server, not mocked routes.
- **`vaz-ai-next` has no `test:e2e` CI job** — Playwright runs only in pre-push hook; `--no-verify` bypasses it with no CI safety net. This conflicts with §12 R10. Add an Ollama-independent E2E CI lane before P3.
- **A check whose target does not exist yet always passes.** Every guard needs a non-vacuity assertion: scanned-file count > 0, collected-test count > 0, ≥1 resolved `uv run` command, hard-fail when `apps/web/` is absent. P0 requires proving each guard fails when deliberately broken.

## HITL implementation (P4) — known unwired state in `vaz-ai-next@bbf1156`

- `createEmailCapability` (the only `needsApproval=true` tool) is **not registered in any agent** — zero production references.
- `Chat.tsx` has **no `addToolApprovalResponse` call** — client approval flow absent.
- `apps/worker` approval predicate is `requiresApprovalForKind: () => false` — always inactive.
- **Forbidden**: adding `requiresApproval` to client-submitted structs (e.g., `workflowStepSchema`) — approval must live in committed server-side code (`requiresApprovalForKind`), never client-controlled (§6.4.3).

## Observability

- Agent-run span cumulative tokens appear under `gen_ai.aggregated_usage.*` (not `gen_ai.usage.*`) because `use_aggregated_usage_attribute_names=True` is the default. Decide which to use before building dashboards.
- Logfire init is fail-soft — observability failure must never stop startup.
- Never log raw user prompts or raw tool I/O in `logger.*`; only non-sensitive identifiers. Tool args go to `AuditTrail`/`AuditSink` only.

## Supply chain

- `pip-audit -r uv.lock` does not work (`uv.lock` is TOML, not requirements format). Use `uv export --frozen --no-dev | pip-audit -r /dev/stdin`, with one `--ignore-vuln` per advisory and a written reachability reason for each (starlette ×5, chromadb ×3). Verify the shell line continuations actually expand — a dropped `\` silently truncates the ignore list.
- After `uv lock --upgrade` or `pnpm update`, visually scan diff for any **version downgrades** (red flag). Paste `pip-audit` / `pnpm audit` raw output in the PR body — "audit passed" summary is insufficient.
- `allowBuilds` entries in `pnpm-workspace.yaml` require a comment with audit reason; `false` means "audited and denied", not "uninspected".
- Dependabot `ignore:` for `fastapi` must cover both minor AND major (Dependabot classifies `0.136→0.137` as minor).

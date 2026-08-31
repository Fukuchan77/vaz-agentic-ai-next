# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

`AGENTS.md` (imported above) holds the version constraints, Pydantic AI v2 API rules, package naming, and test-implementation traps. **This file does not duplicate them — it covers only the big picture that requires reading multiple files to reconstruct.**
`AGENTS.md` and `CLAUDE.md` are a single change unit — never edit one without the other (ADR-P0-04 / REQ-5.5).

---

## Current state: specs approved, implementation not started

One commit (`507161c Initial commit`). Git-tracked: `.gitignore`, `LICENSE`, `README.md`, plus `AGENTS.md`, `CLAUDE.md`, and `specs/` (staged). There is no `apps/`, `packages/`, `services/`, `.github/`, `.githooks/`, `scripts/`, `mise.toml`, `turbo.json`, `pyproject.toml`, or `package.json` yet.

**So the command sections here and in `AGENTS.md` describe the post-P0 state and cannot run today.** Do not guess substitute commands because the toolchain is missing — read `mise.toml` once it exists.

Requirements, design, and tasks are all generated **and approved** (`spec.json` → `phases` / `approvals`); `impl` is pending. P0 is broken into **T-0 … T-9** in `tasks.md`.

### This repository is not `vaz-ai-next`

`vaz-agentic-ai-next` is a **new** repository. The monorepo body is *imported into it* by T-0 — `vaz-ai-next` is upstream, not this repo. Three refs that are easy to confuse:

| Ref | What it is |
| :--- | :--- |
| `Fukuchan77/vaz-ai-next@cf72583` | **The import pin** (`cf725831dcb6…`). T-0 copies this tree in. Drift `cf72583..main` = 2 commits / 2 files, declared out of scope in the PR |
| `vaz-ai-next@bbf1156` | Upstream `main` — the reference for the v1.6 conformance verification. **Every "known unwired state" fact in `AGENTS.md` is measured at `bbf1156`, not at the import pin** |
| `Fukuchan77/fastapi-pydantic-ai-agent@d4d5f8d` | Source of the `apps/agent-api` port, of the two-tier lock evidence, and of `test_ci_workflows.py` |

## Primary sources

| File | Contents |
| :--- | :--- |
| [spec-agenticai-core.md](specs/001-agentic-ai-core-p0/spec-agenticai-core.md) | Design spec **v1.6** (1681 lines, Japanese), covering P0–P8. **The basis for every design decision** — read the relevant section before implementing |
| [specs/memory/constitution.md](specs/memory/constitution.md) | Constitution **v1.2.0** — 11 principles stated as MUST / MUST NOT. Lives here, not in `.sdd/memory/`, precisely because `.sdd/` is gitignored |
| [spec.md](specs/001-agentic-ai-core-p0/spec.md) | P0 requirements — **53** EARS requirements (REQ-0.1 … REQ-10.3), each tagged `[検証: 機械]` (46) or `[検証: 目視]` (7) |
| [plan.md](specs/001-agentic-ai-core-p0/plan.md) | P0 technical design: **ADR-P0-01…05**, the measured turbo behaviour (§3.1.6 / §3.1.6a), CI job shapes (§8), risks R-P0-00…13 |
| [tasks.md](specs/001-agentic-ai-core-p0/tasks.md) | T-0 … T-9 with per-task checklists and a **deliberately non-numeric execution order** (see below) |
| [traceability.md](specs/001-agentic-ai-core-p0/traceability.md) | REQ → design → task → test matrix; all Gaps are `None`. Keep it bidirectional with the `_Traces:_` lines in `tasks.md` |
| [spec.json](specs/001-agentic-ai-core-p0/spec.json) | Phase state (`language: "ja"`, `status: "tasks-generated"`) and the upstream pins |

Key spec sections: §1.2 architecture diagram · §2.5 version-pin exceptions · §2.6 openai×litellm split · §3.2 the two FastAPI apps · §4.4 mandatory rework · §6.1.1 required dependencies · §6.3 trust boundary · §6.4 HITL · §7.4 the hole in the type SSOT · §11 roadmap · §12 risks.

New specs go under `specs/{NNN}-{feature}/`. `.claude/`, `.bob/`, `.sdd/`, and `.serena/` are gitignored — **keep them that way**: the fix for durable records was moving the constitution and the review log under `specs/`, not un-ignoring `.sdd/`. Note that the `sdd-*` skills still resolve the constitution at `.sdd/memory/constitution.md`, so `/sdd-analyze` can silently behave as though there were no constitution (R-P0-12) — point it at `specs/memory/constitution.md` before trusting a verdict.

Spec prose is Japanese (`spec.json` → `language: "ja"`); keep new spec documents in Japanese and repo-root agent instructions in English, matching what is already there.

---

## P0 ground truth — measured facts that override intuition

Every item here was established by running the real tools (constitution principle 8: facts are settled by measurement). Do not "correct" any of it from first principles.

### `turbo run lint test` does **not** run TypeScript

Once `[tool.turbo] name` is declared, the workspace root is treated as the uv (Python) root package and **turbo never resolves the root `package.json` `scripts`** — making the two names match does not help; both cases were measured. Upstream's 9 TS packages carry only `typecheck` (no `lint`, no `test`), and TS lint/test exist solely as root-aggregate scripts over a single root `biome.json` / `vitest.config.ts`. So:

| Lane | Runner | Command |
| :--- | :--- | :--- |
| Python lint | turbo | `turbo run lint` → `agent-api#lint:ruff` |
| Python typecheck | turbo | `turbo run typecheck` → `dependsOn: ["codegen","check"]` → `check:ty` |
| Python test | turbo | `turbo run test` → `agent-api#test` |
| Python format | **outside turbo** | `ruff format --check` — turbo's `format:ruff` omits `--check` and **rewrites files** |
| TS lint | **outside turbo** | `biome check .` |
| TS test | **outside turbo** | `test:run` — the root `test` script is `vitest` in **watch** mode |
| TS typecheck | turbo | `turbo run typecheck` → 9 packages |

`turbo run typecheck` is the only single command that covers both languages. `mise run check-all` is the wrapper that binds all lanes, and treating a green `turbo run lint test` as proof of P0 completion is exactly the defect R-P0-09 names.

Two symmetric zero-count guards exist because "nothing ran at all" otherwise passes silently:

- `scripts/check-python-tasks.sh` (REQ-7.5) — asserts ≥1 resolved command starting with `uv run` in `--dry=json` output. **Counting tasks is not enough**: `turbo run typecheck --filter=agent-api` yields 2 tasks that are both `<NONEXISTENT>`, which a count-based guard would pass.
- `scripts/check-ts-lanes.sh` (REQ-7.6) — asserts Biome scanned > 0 files and Vitest collected > 0 tests. Its `jq` key names must be confirmed against real `--reporter=json` output right after T-0.2, not at T-8.1a.

### Unresolved: ADR-P0-05 contradicts the turbo Python path

R14 (uv workspace's single lock vs. the two-tier version policy) is **decided**, so it no longer blocks P0: ADR-P0-05 adopts option (a) — `apps/agent-api` is **not** a uv workspace member, keeps its own `uv.lock` (`cd apps/agent-api && uv lock`), sits outside Turborepo's Python management, and runs its Python lanes through `mise` directly. `members` is `[]` at P0 and gains only future `packages/py-*`.

That decision was propagated into plan §2.3 / §3.1.3 / §4.3 only. Still written as though `apps/agent-api` were a member: plan §3.1.6 / §3.1.6a / §3.7 / §8.1 (`turbo run lint` → `agent-api#lint:ruff`), §8.2 / §8.3 (`--package agent-api`, "`apps/agent-api/uv.lock` is never generated"), §8.4 and T-2.6 (`turbo ls` must list `agent-api`). A non-member resolves to zero turbo tasks, so REQ-7.5's guard would fail by construction. **Reconcile this before T-1.3** — either re-scope those requirements onto `mise`, or revisit the ADR. Do not quietly pick one reading mid-implementation.

### Turbo's Python support fails closed on four preconditions

Miss any one and the Python tasks vanish or turbo refuses to start:

1. Root `pyproject.toml` with `[tool.uv.workspace]` **and** `[tool.turbo] name` (otherwise: `The uv workspace has no name.`).
2. A committed root `uv.lock` — without it every task is refused, `turbo ls` included.
3. `packageManager` (or `devEngines.packageManager`) in the root `package.json` — without it turbo does not start at all.
4. `ruff` / `ty` / `pytest` in `apps/agent-api`'s `[dependency-groups] dev`. **The dev-group declaration is the only trigger for task registration** — tool config files (`ruff.toml`, `ty.toml`, `pytest.ini`, `conftest.py`) make no difference. Remove `ruff` and `lint` silently becomes 0 tasks while `check` degrades to `uv check` (a lock consistency check, not a type check).

Turbo cannot be used for verification before T-2.3, because `uv lock` cannot succeed until `apps/agent-api` is in place (R-P0-08). Until then, verify config files by static parse.

### Upstream assets to preserve, not recreate

- **A root `mise.toml` already exists** upstream (`[tools]`, `[hooks]`, 19 tasks including `lint:model-ids`, which REQ-10.1 depends on). Preserve and append; creating it fresh silently deletes the model-ID gate (R-P0-10). Its `turbo` pin must be an exact `=` because `turbo-version-check` compares `mise config get tools.turbo` to `turbo --version` for equality.
- **There is no `ci.yml`.** The real workflows are `lint.yml`, `tests.yml`, `python.yml`, `security-daily.yml`, `eval-pr.yml`, `eval-nightly.yml`, and lint / test / Python / audit already run as separate workflows. Add missing jobs to those files; **creating a new workflow builds a second CI path** and violates principle 5 (R-P0-11). A GitHub Actions job id cannot contain a colon — the job is `test-unit` with `name: "test:unit"`.
- **`packageManager` is `pnpm@11.19.0`** upstream, contradicting the `11.24.x` pin — updating it is part of T-0.2 / REQ-0.7, not an optional tidy-up.
- **`biome.json` and `vitest.config.ts`** are the substance of the TS lanes and must be in the imported asset list, or `check-ts-lanes.sh` fails.
- **Do not import upstream's `.gitignore`.** This repo's own file is authoritative (it carries the coding-agent-directory section) and needs repair instead: `lib/` currently swallows `apps/web/lib/`, and `node_modules/` / `.next/` are absent entirely. `git check-ignore` exit codes over 5 specific paths are the acceptance test (REQ-1.8) — `.sdd/reviews/x.md` must match, `specs/memory/constitution.md` must not.

### `pip-audit` is fed through `uv export`

`pip-audit -r uv.lock` does not work — `uv.lock` is TOML, not requirements format. Use `uv export --frozen --no-dev | pip-audit -r /dev/stdin`, with a per-advisory `--ignore-vuln` and a written reachability reason for each (starlette ×5, chromadb ×3 today). Watch the shell line continuations: a dropped `\` silently truncates the ignore list. Paste the raw output in the PR — an "audit passed" summary is not acceptable.

### Tests come before the code they check

Execution order is **T-0 → T-1.1 / T-1.3 → T-2.1 / T-2.2 → T-9.0 (write the repo-convention asserts, observe RED) → T-1.2 / T-1.5 / T-2.3 / T-4.1 (GREEN) → T-9.1 / T-9.2 → T-2.4 … T-2.6 → T-3 → T-5 / T-6 / T-7 → T-8**. T-9 runs before T-8 despite the numbering: the asserts live in `apps/agent-api/tests/unit/`, which does not exist until T-2.1. Where RED genuinely cannot come first (root `pyproject.toml`, or assets imported already-correct), the substitute is mandatory and explicit — break the target, watch it fail, `git restore`, re-verify (plan §7.7). 19 requirements carry that non-emptiness step as a work item.

---

## Architecture

### Request path

```
apps/web (Next.js 16.3 / useChat)
  → POST /api/chat        … BFF: thin proxy only, no logic
  → POST /v1/chat         … Vercel AI Data Stream Protocol / SSE / sdk_version=7
```

`apps/agent-api` nests five layers, and a request must pass through them **in this order**:

1. **Boundary defense** — `verify_api_key` / `enforce_llm_rate_limit`, TrustedHost → CORS → SizeLimit → RequestID → SecHeaders
2. **Presentation integration** — `VercelAIAdapter.from_request()` → `run_stream()` → lifecycle hardening → `encode_stream()`
3. **Guardrails** — `build_guarded_toolset()`: allow-list → approval hook → token budget → `AuditTrail` (termination classified by the closed `StopReason` vocabulary)
4. **Inference / orchestration** — Pydantic AI (`Agent`, `@agent.tool`, `output_validator`, Orchestrator-Worker)
5. **Perception** — LlamaIndex Workflows (`CorrectiveRAGWorkflow`, swappable behind the `VectorStore` Protocol)

Cross-cutting: Logfire / OpenTelemetry (GenAI semconv v5). The three external touchpoints — `SessionStore`, `VectorStore`, LLM provider — are all abstracted behind a Protocol or a model string.

**Layers 1 and 3 are not optional (§6.1.1).** Dropping them means `/v1/chat` alone loses auth, rate limiting, the tool allow-list, and the audit trail. This defect has actually occurred in the source repo.

### Why `dispatch_request` is not used

`dispatch_request()` returns a finished `Response`, so the lifecycle layer — a generator of shape `AsyncIterator[T] -> AsyncIterator[T]` — cannot be inserted before or after it. Hence the Adapter is decomposed into fine-grained methods (§4.4.1). This is an **API-level necessity, not a stylistic choice**; `dispatch_request` is banned outside prototypes.

### Two Python FastAPI apps — deliberately not merged

|  | `services/agent` (existing) | `apps/agent-api` (new) |
| :--- | :--- | :--- |
| Nature | **Stateless** sidecar (no DB / Redis / FS) | **Stateful** agent API |
| Responsibility | RAG evaluation (faithfulness / relevancy), Docling parsing | Chat, HITL, Corrective RAG, session ownership |
| Called by | TS side (`packages/rag` ingest CLI, evals) | The BFF in `apps/web` |
| DB writes | **Forbidden** — only `packages/rag` writes to pgvector (single-writer) | Its own stores only |
| Pydantic AI | slim `>=2.33,<3.0` (no litellm); openai 3.x resolves fine | slim `>=2.28,<3.0`, **no `openai` extra** (governed by litellm's `openai<3.0.0`; see §2.6.3) |
| uv workspace | Not a member (ADR-P0-03) | Not a member (ADR-P0-05 (a)) — own `uv.lock` |

Their responsibilities are orthogonal, and merging them would break the statelessness of `services/agent` (whose tests never open a socket) — §12 R5. The **version constraints are intentionally asymmetric** (§2.6), and that asymmetry is exactly why neither app can share a lock.

`services/agent`'s own `uv.lock` already exists upstream, so REQ-3.1 resolves as pattern A. But its `pyproject.toml` at `bbf1156` declares `pydantic-ai-slim[anthropic,openai]>=2.27` (an `openai` extra §2.5-5 forbids) and `fastapi>=0.141` (against the `<0.137` ceiling) — both need reconciling, and both are the concrete reason a single merged resolution regresses to litellm 1.83.0 with 11 known CVEs.

### Type-safety pipeline, and the hole in it

`packages/py-schemas` (Pydantic models) is the SSOT. TS types come from `model_json_schema()` → `json-schema-to-typescript`, and from FastAPI's `/openapi.json` → `openapi-typescript`. Generated output is **committed, never gitignored** — the diff is what makes an API-contract change reviewable. CI enforces this with `turbo run codegen` followed by `git diff --exit-code`.

Output locations are split **by generator and must never be mixed**:

- `services/agent` → `packages/schemas/src/generated/` (status quo)
- `apps/agent-api` → `packages/api-types/generated/` (new)

Mixing them makes the two OpenAPI documents collide, so you can no longer tell which change produced a drift.

**`/v1/chat` is outside this pipeline (§7.4).** It takes a raw `Request` and returns a `StreamingResponse`, so it never appears in the OpenAPI document. Consequences:

- `codegen-check` does not protect this contract
- **Playwright E2E is the only regression detector for it** — do not drop E2E from the P3 acceptance criteria (§12 R10)
- Pin the protocol version (`sdk_version=7` ↔ `ai@7.0.x`) as a single constant on each side and assert the two agree in CI

Also: `satisfies z.ZodType<Generated>` catches missing fields and type mismatches but **not excess fields**. Excess is caught by the JSON-Schema shape comparison, so when adding a boundary schema **keep both legs**.

### Four test layers, each with explicit non-guarantees

| Layer | Tools | Guarantees | Does **not** guarantee | Real LLM |
| :--- | :--- | :--- | :--- | :--- |
| Unit | Pytest / Vitest | Tool functions, Pydantic/Zod validation, DI, dropped-approval detection | Inference quality, protocol conformance | No (mocks + socket block) |
| Integration | Pytest + `FunctionModel` | Component composition, real stores | Real model behavior | No |
| E2E | Playwright | SSE protocol conformance, HITL UI state transitions, **the part outside the type pipeline** | Answer correctness | No |
| Evals | pydantic-evals | Answer validity, factuality, latency, cost | Deterministic pass/fail | Yes |

Do not expect a guarantee from the wrong layer — e.g. don't try to verify protocol conformance in unit tests. P0's scope is Unit only; branch coverage is **measured and recorded** as a baseline (REQ-7.7) without blocking.

---

## Design principles that drive implementation decisions

The normative statements live in [specs/memory/constitution.md](specs/memory/constitution.md) (v1.2.0). What matters most in practice:

- **Principle 5 (converge on the single path).** Before adding a new publish point, throw site, schema, workflow file, or vocabulary, first check whether it can join an existing single path. Guardrails live in one place, the audit-log emit point in one place, embedding writes in one package. A new endpoint that bypasses that path **silently loses the guarantee**. `/v1/chat` is the most important application; "create `ci.yml`" is the most recent violation caught.
- **Principle 8 (facts are settled by measurement).** A claim contradicted by measurement is **deleted and replaced with the measurement**, not annotated. Plan §3.1.6's "measurement 6" was removed this way after it turned out to rest on a synthetic package.
- **Principle 9 (tests first).** Writing tests to fit code that already works is prohibited, which is why T-9.0 exists and why "break it, watch it fail, restore" is a required work item where RED cannot come first.
- **Multi-agent requires passing a gate (§5.1):** (1) the task is genuinely breadth-first, (2) context pollution or tool-count overflow has been **measured** on a single agent, (3) the ~15× token cost is worth recovering. Miss any one and it's a single agent plus tools. P2P swarm is rejected outright.
- **≤ 20 tools per agent** (machine-checked by CI's `tool-count-check`). On overflow, split into subagents or adopt Tool RAG (`capabilities.ToolSearch`) — raising the limit is not an option. Tool docstrings state **when to use** the tool, not just what it does, and tool names are namespaced by resource.
- **Approval gates only for irreversible or high-risk operations** (principle 7 / §6.4.3). The more approval dialogs you install, the faster users learn to approve without reading (measured: 93% of permission prompts approved unread), and HITL becomes nominal. Everything else is covered by after-the-fact `AuditTrail` review.
- **Context is a finite attention budget (principle 6).** Retrieve just-in-time instead of preloading every search result; integrate subagent output **as summaries**.
- **Observability is not retrofitted (principle 4).** Logfire is enabled from the first MVP commit, and the design assumes a data flywheel that turns production traces into eval cases.

## Implementation order (§11)

Each phase starts only after the previous phase's acceptance criteria are met.

| | Scope | Acceptance highlights |
| :--- | :--- | :--- |
| **P0** | Import the `vaz-ai-next` body (T-0); monorepo skeleton; port `apps/agent-api` with behavior unchanged | ADR-P0-01…05 decided. Python lanes via turbo **plus** TS lanes outside it **plus** `ruff format --check`, all bound by `mise run check-all`; both zero-count guards green; `turbo-version-check` green; the two locks resolve independently (`apps/agent-api` → slim 2.35.x / litellm 1.98.0, `services/agent` → slim 2.33.x) with raw `pip-audit` output pasted into the PR |
| **P1** | Logfire instrumentation; decide on `gen_ai.aggregated_usage.*` | Span tree appears; chosen attribute names recorded in an ADR |
| **P2** | Roll out codegen pipeline; add `codegen-check` | The two generated directories stay separate |
| **P3** | Add `/v1/chat`, wire up `useChat` (**HITL excluded**) | Streaming E2E **and guardrail E2E** pass; unauthenticated calls proven to fail |
| **P4** | HITL (`requires_approval` / `DeferredToolRequests` / 3-layer defense). **TS side also needs wiring**: `createEmailCapability` not in any agent, no `addToolApprovalResponse` in `Chat.tsx`, `apps/worker` predicate is `() => false`. | Approve / deny / malformed E2E cases; review confirms approvals are limited to irreversible operations |
| **P5** | LlamaIndex perception layer (`CorrectiveRAGWorkflow` exposed as a tool) | Citation order deterministic (`(-score, chunk_id)`), dangling id → 502 |
| **P6** | Join `packages/py-evals` to the existing baseline; measure | Nightly `EvaluationReport`; baseline stored in the same format as the TS side |
| **P7** | Enable `evals-gate`; start the data flywheel | At least one dataset case derived from a production trace |
| **P8** | Multi-agent, only where §5.1 passes | Token cost and performance gain measured; the four §5.3 defenses implemented |

**Not reaching P8 is not a failure.** If nothing passes the §5.1 gate, a single-agent system is the finished product.

## Commands (available after P0)

Never invoke `ruff` / `pytest` / `ty` / `biome` / `vitest` bare — go through `uv run` / `pnpm exec`, or better, the `mise` task. `mise.toml` is the authoritative task list (19 tasks arrive with the import).

```bash
mise run check-all                    # single entry point: every lane, turbo and non-turbo

turbo run typecheck                   # the only command covering both languages (codegen → check → tsc / ty)
turbo run lint test                   # Python only — TS resolves to zero tasks
pnpm exec biome check .               # TS lint/format (Biome, not ESLint/Prettier)
pnpm run test:run                     # TS tests (the root `test` script is watch mode)

# Python, from apps/agent-api (it is not a uv workspace member — ADR-P0-05)
uv run --frozen ruff check .
uv run --frozen ruff format --check .  # turbo's format:ruff omits --check and rewrites files
uv run --frozen ty check .             # ty, not mypy

# Single test
uv run --frozen pytest tests/unit -k test_name_here
pnpm exec vitest run src/path/to/file.test.ts
```

`pnpm install` activates `.githooks/` via `core.hooksPath`. pre-commit runs only fast checks (biome, ruff, tsc, ty, vitest, gitleaks, hardcoded-model-id detection, uncommitted-generated-file detection); E2E and live-LLM lanes run on pre-push; heavy audits run in CI. A hook that checks a path which does not exist yet **always passes** — the `apps/web/AGENTS.md` residue check is only meaningful after `apps/web/` lands, so it must fail loudly when the directory is missing rather than exit 0.

**Never hardcode model IDs in code or docs.** Resolve them from environment variables and keep the allowlist in one place — pre-commit and CI both check this mechanically. Exceptions: **3 files** — `packages/config/src/model-allowlist.ts`, `packages/schemas/src/env.ts`, `services/agent/app/config.py` (lines 41–43 of `scripts/forbid-model-ids.sh`).

**CI SHA-pin enforcement**: `test_ci_workflows.py` is a `fastapi-pydantic-ai-agent` asset; `vaz-ai-next` has no equivalent. All 21 `uses:` refs in `vaz-ai-next@bbf1156` are variable tags; no `permissions:` blocks exist in any workflow. T-5.5 ports the test to `apps/agent-api/tests/unit/test_ci_workflows.py`, repoints it at this repo's `.github/workflows/`, and adds a `permissions:` assertion plus a "scanned file count > 0" assertion so it cannot pass vacuously. **Until that port lands, PR review by eye is the only safety net** (R-P0-13).

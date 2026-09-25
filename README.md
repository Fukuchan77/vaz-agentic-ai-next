<h1 align="center">VAZ-Agentic-AI-Next</h1>

<p align="center">
  A bleeding-edge AI application repository architecture, blending modern frontend performance with seamless AI orchestration.
</p>

---

## English

At its core (**VAZ**), the project harmonizes **V**ercel AI SDK for robust LLM streaming, Next.js 16 **A**pp Router for unified server/client architecture, and **Z**od v4 for rigorous runtime type validation — across a pnpm monorepo of two apps and seven source-only `@vaz/*` packages, plus two independent Python services: an optional document-parsing/evaluation sidecar and a standalone agent API lane.

By eliminating boilerplate optimization via the React Compiler and leveraging a lightning-fast, Rust-powered toolchain (Turbopack, Biome, and Vitest), this repository achieves the absolute pinnacle of developer experience and production execution speed.

### Tech Stack

| Area                    | Technology                                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| AI toolkit               | [Vercel AI SDK 7](https://ai-sdk.dev) (`ai` + `@ai-sdk/react`)                                                                                 |
| LLM providers            | [Anthropic Claude](https://www.anthropic.com) (`@ai-sdk/anthropic`) / [OpenAI](https://openai.com) (`@ai-sdk/openai`) / local LLM via [Ollama](https://ollama.com) (`@ai-sdk/openai-compatible`) |
| Framework                | [Next.js 16](https://nextjs.org) App Router (Turbopack)                                                                                        |
| Compiler                 | [React Compiler](https://react.dev/learn/react-compiler) (automatic memoization)                                                               |
| Runtime validation       | [Zod v4](https://zod.dev)                                                                                                                      |
| Language                 | [TypeScript 6](https://www.typescriptlang.org)                                                                                                 |
| Lint / Format            | [Biome 2.5+](https://biomejs.dev)                                                                                                              |
| Unit testing             | [Vitest 4](https://vitest.dev) + [Testing Library](https://testing-library.com)                                                                |
| E2E testing              | [Playwright](https://playwright.dev) (Chromium / Firefox)                                                                                      |
| UI components            | [Carbon Design System](https://carbondesignsystem.com) (`@carbon/react`, per-component SCSS)                                                   |
| Database                 | [PostgreSQL](https://www.postgresql.org) + [pgvector](https://github.com/pgvector/pgvector) via [Drizzle ORM](https://orm.drizzle.team)        |
| Durable workflow engine  | [Inngest](https://www.inngest.com) (self-hosted, drives `apps/worker`)                                                                          |
| Auth                     | [Auth.js](https://authjs.dev) (`next-auth@5`; Entra ID / Google Workspace)                                                                      |
| Package manager          | [pnpm 12](https://pnpm.io)                                                                                                                     |
| Task runner / toolchain  | [mise](https://mise.jdx.dev) (Node 24 LTS + pnpm 12 + `uv` + gitleaks pinned)                                                                    |

### Getting Started

Prerequisite: [mise](https://mise.jdx.dev) installed (it provides Node 24 LTS, pnpm 12, `uv`, and gitleaks, all pinned in `mise.toml`; `package.json#packageManager` is the source of truth for the exact pnpm build).

```bash
mise install                    # Node 24 / pnpm 12 / uv / gitleaks
pnpm install                    # install dependencies (also activates git hooks)
cp .env.example .env.local      # set provider/auth values; host URLs use localhost
docker compose --env-file .env.local up -d  # Postgres, Redis, Inngest, worker
(set -a; . ./.env.local; set +a; mise run db:migrate)  # apply packages/db/drizzle/*.sql (idempotent)
mise run dev                    # http://localhost:3000
```

`docker compose --env-file .env.local up -d` + `mise run db:migrate` are required for anything beyond a bare
chat round-trip (RAG ingest, durable jobs, approval flows all need Postgres/Redis/Inngest
running). Plain chat only needs an `AI_PROVIDER` + provider credential in `.env.local`;
OIDC login needs the `AUTH_*` variables documented in `.env.example`. The Python sidecar
(`services/agent`, needed for `--via-parser` ingest and tier2 evals) is opt-in behind a
compose profile: `docker compose --env-file .env.local --profile sidecar up -d`.

`db:migrate` does not read `.env.local` itself, so the migrate line loads it in a subshell.
Keep it scoped that way: values exported into your interactive shell take precedence over
`.env.local` for both Next.js and `docker compose`, so later edits would be silently ignored.

### Choosing an AI provider

The chat API resolves its language model at request time from environment variables
(validated with Zod — see `packages/schemas/src/env.ts`):

| Variable            | Default                     | Description                           |
| ------------------- | --------------------------- | -------------------------------------- |
| `AI_PROVIDER`       | `anthropic`                 | `anthropic`, `openai`, or `ollama`    |
| `ANTHROPIC_API_KEY` | —                           | Required when `AI_PROVIDER=anthropic` |
| `ANTHROPIC_MODEL`   | `claude-opus-5-5`           | Claude model ID                       |
| `OPENAI_API_KEY`    | —                           | Required when `AI_PROVIDER=openai`    |
| `OPENAI_MODEL`      | `gpt-6-sol`                 | OpenAI model ID                       |
| `OLLAMA_BASE_URL`   | `http://localhost:11434/v1` | Ollama's OpenAI-compatible endpoint   |
| `OLLAMA_MODEL`      | `granite4.2:latest`             | Balanced default; override per workload |

OpenAI:

```bash
AI_PROVIDER=openai OPENAI_API_KEY=… pnpm dev
```

The provider only changes the chat / supervisor / judge model. Embeddings stay on
`AI_EMBEDDING_PROVIDER` (Ollama only), because the RAG corpus dimension is DDL-fixed.

Local LLM (no API key needed):

```bash
ollama pull granite4.2:latest
AI_PROVIDER=ollama pnpm dev
```

Ollama は `granite4.2:latest` を汎用の既定値とし、リソース制約時は
`granite4.2:3b` / `gemma4:e2b`、品質優先の代替は `gemma4:e4b` を
`OLLAMA_MODEL` に指定します。

### Tasks

Tasks are managed with **mise** (`mise.toml` is the source of truth); direct `pnpm`/`uv`
equivalents also work.

| Purpose                       | mise                        | Notes                                                    |
| ------------------------------ | ----------------------------- | ---------------------------------------------------------- |
| Dev server (Turbopack)          | `mise run dev`               | `apps/web`                                                |
| Production build                | `mise run build`             | `apps/web`, `NODE_ENV=production`                         |
| Serve production build          | `mise run start`             | `apps/web`                                                |
| Unit tests (watch)              | `mise run test`              | all Vitest projects (`web` / `worker` / `packages`)       |
| Unit tests (once)               | `mise run test:run`          | all Vitest projects                                       |
| Coverage                        | `mise run test:coverage`     | lines/functions ≥ 80%                                     |
| E2E tests                       | `mise run test:e2e`          | Playwright                                                 |
| E2E vs local Ollama             | `mise run test:e2e:ollama`   | includes a real chat round-trip against local Ollama       |
| Lint / format check             | `mise run lint`              | Biome, whole workspace                                     |
| Lint / format fix               | `mise run lint:fix`          |                                                             |
| Hardcoded-model-ID gate         | `mise run lint:model-ids`    | fails the build if a model ID leaks outside `@vaz/config`  |
| Type check                      | `mise run typecheck`         | `pnpm -r run typecheck` (each workspace member)            |
| Dependency audit                | `mise run audit`             | `pnpm audit --audit-level=moderate`                        |
| Bundle size budget              | `mise run size`              | `.size-limit.json` (JS 420 kB / CSS 22 kB, brotli); needs `mise run build` |
| Apply DB baseline DDL           | `mise run db:migrate`        | `packages/db/drizzle/*.sql` → `DATABASE_URL`, idempotent   |
| **Aggregate quality gate**      | `mise run check`             | lint + typecheck + test:run + audit + lint:model-ids       |
| Python sidecar quality gate     | `mise run py:check`          | `services/agent`; NOT a dependency of `check` (NFR-1)      |
| Python API quality gate         | `mise run api:check`         | `services/api`; NOT a dependency of `check` (NFR-1)        |
| Regenerate agent-service types  | `mise run openapi:gen`       | FastAPI OpenAPI → `packages/schemas/src/generated/*`       |

### Project Structure

A monorepo of two apps over seven source-only `@vaz/*` packages, plus two independent
Python services. **[AGENTS.md](AGENTS.md) is the source of truth for the full tree and dependency
graph — this section is a summary and must not drift from it.**

```text
apps/web/          # Next.js app (@vaz/web) — chat UI, /api/chat, /api/jobs
apps/worker/        # @vaz/worker — Inngest durable job runner
packages/
  schemas/           # @vaz/schemas — Zod contracts (env, chat, workflows, RAG)
  db/                 # @vaz/db — Drizzle schema + drizzle/ migrations (schema-only, no pg)
  config/             # @vaz/config — resolveModel, logger, telemetry, allowlists
  tools/              # @vaz/tools — chat tool definitions (HITL demo)
  rag/                # @vaz/rag — ingest, retrieve (pgvector queries)
  agents/             # @vaz/agents — createChatAgent, createSupervisorWorkflow
  evals/              # @vaz/evals — tier1 unit evals + tier3 LLM judge + nightly run
services/agent/    # Python sidecar (FastAPI) — /eval/*, /parse; stateless, opt-in
services/api/      # Standalone Python agent API lane with an independent quality gate
```

### Git Hooks (quality gates)

`pnpm install` activates the checked-in hooks in `.githooks/` (via `core.hooksPath`):

- **pre-commit** — `biome check` → `tsc --noEmit` (all workspace members) → `vitest run` →
  `pnpm audit` → hardcoded-model-ID gate (`scripts/forbid-model-ids.sh`)
- **pre-push** — Playwright E2E; if a local Ollama is detected, it automatically runs with
  `AI_PROVIDER=ollama`, including a real chat round-trip against the local LLM

Bypass in an emergency with `--no-verify`. CI still runs the infrastructure-free Chromium
E2E lane, but the local-Ollama real chat round-trip runs only from the pre-push hook;
`--no-verify` skips that live-model coverage.

### Supply-Chain Hardening

Configured in `pnpm-workspace.yaml`:

- `minimumReleaseAge: 1440` — never resolve versions published less than 24h ago (mitigates freshly-published malicious releases)
- `allowBuilds` — dependency install scripts are blocked by default; every decision is recorded explicitly (all currently `false`)
- pnpm itself is version-pinned via `mise.toml`
- CI runs `pnpm install --frozen-lockfile` + `pnpm audit --audit-level=moderate`

### CI

Runner usage is kept deliberately small: the checked-in git hooks are the first line of
defense, and GitHub Actions verifies what merges rather than every intermediate push.
Workflows fire on **pushes to `main` and on pull requests** (not on feature-branch pushes);
anything that calls a real model is manual or opt-in.

- **lint** (`main` + PR) — hardcoded-model-ID gate → `biome check` → `tsc --noEmit`
- **tests** (`main` + PR) — `unit` (`vitest run --coverage`), `audit` (`pnpm audit`),
  `e2e`, and `bundle-size` run independently; `gate` is the single required status check and
  fails if any of the four jobs fails. `bundle-size` builds `apps/web` and runs `size-limit`
  against `.size-limit.json`. The `e2e` job runs Chromium-only without infra; the local-Ollama
  chat round-trip stays with the pre-push hook
- **python** (`main` + PR) — `services/agent`'s `mise run py:check`; path-filtered to only
  run when `services/agent/**` changes
- **api** (`main` + PR) — `services/api`'s `mise run api:check` plus its live Redis lane;
  path-filtered to `services/api/**` and its workflow inputs
- **security-daily** (`cron "0 17 * * *"` + manual) — the only scheduled workflow:
  audits the pnpm workspace, `services/agent`, and `services/api` dependency locks in separate
  jobs, and runs a full-history gitleaks scan, catching newly published advisories or new
  detection rules even on days with no commits
- **eval-pr** (PR, opt-in) — tier3 LLM-judge eval gate; runs only on PRs carrying the
  **`run-eval`** label (it calls a real model per golden-set case). Skips gracefully
  without a provider API key
- **eval-nightly** (`workflow_dispatch` only) — golden-set eval run with a cost cap and
  before/after regression comparison. Despite the name it is no longer scheduled; trigger
  it by hand before a release or after a prompt/model/tool change

### For AI Coding Agents

Repository-specific conventions live in [AGENTS.md](AGENTS.md).

The pre-001 root `src/`/`tests/` layout was migrated into `apps/web`; see
[`specs/001-vaz-ai-update/`](specs/001-vaz-ai-update/) for that decision record.

---

## 日本語

**VAZ** = **V**ercel AI SDK(堅牢な LLM ストリーミング)× Next.js 16 **A**pp Router(サーバー/クライアント統合アーキテクチャ)× **Z**od v4(厳格なランタイム型検証)。2 apps + 7 つの source-only `@vaz/*` パッケージからなる pnpm monorepo に、opt-in の文書解析・評価サイドカーと、独立した agent API レーンの 2 つの Python サービスを組み合わせています。

React Compiler による最適化ボイラープレートの排除と、Rust 製高速ツールチェーン(Turbopack・Biome・Vitest)により、開発体験と実行速度の最高峰を目指すリポジトリです。

### はじめに

前提: [mise](https://mise.jdx.dev) をインストール済みであること(Node 24 LTS・pnpm 12・`uv`・gitleaks は `mise.toml` の固定バージョンで mise が用意します。pnpm の厳密なビルドは `package.json#packageManager` を正本とします)。

```bash
mise install                       # Node 24 / pnpm 12 / uv / gitleaks を用意
pnpm install                       # 依存をインストール(git フックも自動で有効化)
cp .env.example .env.local         # provider/auth を設定。ホスト向け URL は localhost
docker compose --env-file .env.local up -d  # Postgres・Redis・Inngest・worker
(set -a; . ./.env.local; set +a; mise run db:migrate)  # packages/db/drizzle/*.sql を適用(冪等)
mise run dev                       # http://localhost:3000
```

チャット単体の動作確認だけなら `docker compose --env-file .env.local up -d` は不要ですが、RAG ingest・
durable job・承認フローを試すには Postgres/Redis/Inngest が必要なため
`docker compose --env-file .env.local up -d` + `mise run db:migrate` が前提になります。OIDC ログインを
試す場合は `.env.example` に記載の `AUTH_*` 系変数を設定してください。Python サイドカー
(`services/agent`。`--via-parser` ingest や tier2 評価に必要)は opt-in で
`docker compose --env-file .env.local --profile sidecar up -d` で起動します。

`db:migrate` は `.env.local` を自動では読まないため、上記ではサブシェル内で読み込んでいます。
対話シェルへ export したままにすると、Next.js と `docker compose` のどちらでもシェルの値が
`.env.local` より優先され、後から `.env.local` を編集しても反映されなくなるため避けてください。

### AI プロバイダーの切替

チャット API は環境変数からモデルをリクエスト時に解決します(Zod で検証 — `packages/schemas/src/env.ts`)。

- **Anthropic(デフォルト)**: `.env.local` に `ANTHROPIC_API_KEY` を設定(モデルは `claude-opus-5-5`)
- **OpenAI**: `AI_PROVIDER=openai` と `OPENAI_API_KEY` を設定(モデルは `OPENAI_MODEL`、既定 `gpt-6-sol`)。切り替わるのはチャット / supervisor / judge のモデルのみで、埋め込みは `AI_EMBEDDING_PROVIDER`(Ollama のみ)のまま
- **ローカル LLM(Ollama、API キー不要)**:

```bash
ollama pull granite4.2:latest
AI_PROVIDER=ollama pnpm dev
```

Ollama は `granite4.2:latest` を汎用の既定値とし、リソース制約時は
`granite4.2:3b` / `gemma4:e2b`、品質優先の代替は `gemma4:e4b` を
`OLLAMA_MODEL` に指定します。

### mise タスク

タスクは **mise** で管理します(`mise.toml` が正本)。主なもの:

| 用途                         | mise                        |
| ---------------------------- | ---------------------------- |
| 開発サーバー(Turbopack)        | `mise run dev`               |
| 単体テスト(1 回)               | `mise run test:run`          |
| E2E テスト                     | `mise run test:e2e`          |
| Lint / format チェック          | `mise run lint`               |
| 型チェック                      | `mise run typecheck`          |
| 依存脆弱性 audit                | `mise run audit`              |
| バンドルサイズ検査(要 build)     | `mise run size`               |
| モデル ID ハードコード検出ゲート    | `mise run lint:model-ids`     |
| DB baseline DDL の適用         | `mise run db:migrate`         |
| **集約品質ゲート**              | `mise run check`              |
| Python サイドカー品質ゲート      | `mise run py:check`(`check` 非依存、NFR-1) |
| Python API 品質ゲート            | `mise run api:check`(`check` 非依存、NFR-1) |
| `agent-service.ts` 再生成      | `mise run openapi:gen`        |

### 品質ゲート(git フック)

`pnpm install` で `.githooks/` のフックが有効化されます:

- **pre-commit** — lint/format(biome)→ 型チェック(全ワークスペース)→ 単体テスト → `pnpm audit` → モデル ID ハードコード検出ゲート(`scripts/forbid-model-ids.sh`)
- **pre-push** — Playwright E2E。ローカルで Ollama を検出すると自動的に `AI_PROVIDER=ollama` で実行し、ローカル LLM とのチャット実往復テストも走ります

緊急時は `--no-verify` でスキップできます。CI ではインフラ不要の Chromium E2E が実行されますが、ローカル Ollama との実往復は pre-push フックだけが担当するため、`--no-verify` するとその実モデル検証は省略されます。

### サプライチェーン対策

`pnpm audit`(既知 CVE 照合)だけでは防げない攻撃を `pnpm-workspace.yaml` で補完しています。

- `minimumReleaseAge: 1440`: 公開から 24 時間未満のバージョンを解決しない(不正バージョン公開直後の最危険期間を回避)
- `allowBuilds`: 依存の install スクリプトはデフォルトでブロックし、判断を明示的に記録(現在すべて拒否)
- pnpm 自体のバージョンを `mise.toml` で固定
- CI で `pnpm install --frozen-lockfile` + `pnpm audit --audit-level=moderate`

### CI

ランナー使用量を抑えるため、GitHub Actions は **`main` への push と pull request** でのみ発火します(作業ブランチへの中間 push では走りません。ローカルの git フックが一次防衛線です)。実モデルを叩くワークフローは手動 / opt-in です。

- `lint`(`main`+PR)— モデル ID ゲート→biome→tsc
- `tests`(`main`+PR)— `unit`・`audit`・`e2e`・`bundle-size` を独立実行し、4 ジョブのいずれかが失敗すると唯一の必須ステータス `gate` が失敗します。`bundle-size` は JS 420 kB / CSS 22 kB(brotli)を検査し、`e2e` はインフラなしの Chromium のみです。ローカル Ollama との実往復は pre-push フックが担当します
- `python`(`main`+PR)— `services/agent/**` の変更時のみ path-filter 発火
- `api`(`main`+PR)— `services/api/**` の変更時に `mise run api:check` と Redis live lane を path-filter 実行
- `security-daily`(`cron "0 17 * * *"` + 手動)— 唯一のスケジュール実行。pnpm・`services/agent`・`services/api` の 3 依存レーンを別ジョブで監査し、full-history gitleaks も実行します。コミットが無い日でも新規アドバイザリや検出ルール追加を検知します
- `eval-pr`(PR、opt-in)— **`run-eval` ラベル**が付いた PR でのみ実行する LLM judge ゲート(golden set の case ごとに実モデルを呼ぶため)
- `eval-nightly`(`workflow_dispatch` のみ)— golden set の回帰比較。名前に反してスケジュール実行は廃止済みで、リリース前やプロンプト/モデル/ツール変更後に手動で起動します

構成の変遷は [`specs/001-vaz-ai-update/`](specs/001-vaz-ai-update/) を参照してください(旧 root `src/`/`tests/` から現行 monorepo への移行の意思決定記録)。

## ⚖️ License

[MIT](LICENSE)

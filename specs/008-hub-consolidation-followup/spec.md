# 008-hub-consolidation-followup

## Project Description

spec `006-repo-consolidation` はハブ（本リポジトリ）への統合を完了させた。しかし、次の 3 点を
**未決のまま**残していた。本 spec はそれらを閉じる。あわせて、2026-10-03 のリポジトリ群の
再評価で確定した役割分担（ハブ＝安定版、兄弟リポジトリ＝ベータ検証／教材）を各リポジトリに明文化する。

1. **FastAPI レーンの正本がどちらか。** `services/api` の取り込み後も元リポジトリで開発が続き、
   セキュリティ修正 `d9a3c93`（RAG の role 分離）がハブ側に欠落していた
   （[ADR-0007](../../docs/adr/0007-fastapi-single-source-of-truth.md) の Context に実測表）。
2. **`services/api` のフック配線。** spec `006` の `pdca/act.md` R9.4 が、元リポジトリを
   アーカイブしない理由として挙げた既知のギャップ。
3. **TS と Python の結合。** `apps/web` から `services/api` を呼ぶコードは 1 行も無く、
   `openapi:gen` は `services/agent` だけを対象にしていた。

散文は日本語、識別子・型・パス・コードは英語。

### ユーザ判断（2026-10-03）

- FastAPI の正本はハブ（`services/api`）に一本化する → ADR-0007
- HITL を含むエージェント UI 部品の標準は shadcn/ui + Tailwind CSS とする
  （Carbon は最新の React / Next.js と不整合を起こしやすいため）→ ADR-0008
- ベータ検証は、ハブの長命ブランチではなく兄弟リポジトリで行う:
  TypeScript は `next-agentic-stack`、Python は `pydantic-ai-sandbox`
- `from-genai-to-agentic-ai` はアーカイブせず、学習パス（教材）として継続する
- BeeAI Framework / LangChain / LangGraph との比較は参考扱いとし、凍結する

---

## Requirements

既定の主語は THE VAZ platform。[E]=Event-driven / [U]=Ubiquitous / [O]=Optional。

### Requirement 1: FastAPI レーンの差分解消と正本宣言

1.1 [U] 元リポジトリ `fastapi-pydantic-ai-agent` の `c12ac7f..main`（取り込み時点以降）のうち
アプリとテストへの変更 SHALL be ported into `services/api/` **with history**
（`git am --directory=services/api`）。
1.2 [U] 移植後の `services/api` SHALL pass `ruff` / `ty` / pytest（unit + integration + e2e）。
1.3 [U] 移植コミットが持ち込むテスト用ダミー鍵 SHALL be baselined in `.gitleaksignore`
by exact fingerprint（パスや文字列による除外は SHALL NOT be used）。
1.4 [U] 正本の宣言 SHALL be recorded as an ADR and in the `CLAUDE.md` / `AGENTS.md` pair.

### Requirement 2: `services/api` のフック配線と元リポジトリのアーカイブ

2.1 [E] WHEN a commit stages a path under `services/api/`, the hub pre-commit SHALL run
`api:lint`, the `real-tool-conventions-guard`, and — only when `pyproject.toml` / `uv.lock`
is staged — `api:audit`. WHEN nothing under `services/api/` is staged, it SHALL NOT require
a Python toolchain（NFR-1 of spec `006`）。
2.2 [E] WHEN a push contains a commit touching `services/api/` and Ollama is reachable,
the hub pre-push SHALL run `EXPECT_LIVE_TESTS=<count> api:test:local` and `api:evals`.
2.3 [U] 2.1 / 2.2 SHALL be covered by tests in the lane's own unit suite.
spec `006` が削除した `EXPECT_LIVE_TESTS` リテラルの drift guard を SHALL be restored.
2.4 [U] 元リポジトリの README SHALL redirect to the hub. Archive（read-only 化）は
GitHub 上の操作なので、ユーザが実行する。

### Requirement 3: TS ⇔ `services/api` の結合サンプルと境界契約

3.1 [U] `openapi:gen` SHALL also generate `services/api`'s OpenAPI snapshot and TS types
into `packages/schemas/src/generated/`.
3.2 [U] SSE の 5 イベント（`app/patterns/sse.py`）は OpenAPI に現れない。そのため
JSON Schema snapshot を SHALL be generated, and a drift test SHALL compare the hand-written
Zod union against it.
3.3 [U] `apps/web` SHALL expose a server-side route that calls `services/api`'s
`POST /v1/agent/stream`. The `X-API-Key` SHALL stay on the server（ブラウザへ出さない）.
The route SHALL require an authenticated session（未認証の課金プロキシにしない）.
3.4 [U] Env reads SHALL go through `@vaz/schemas`（bare `process.env` を増やさない）.

### Requirement 4: ベータ検証リポジトリの役割の明文化

4.1 [U] `next-agentic-stack` と `pydantic-ai-sandbox` の README SHALL state their role
as the TypeScript / Python beta-verification lanes for the hub.
4.2 [U] [`docs/dependency-policy.md`](../../docs/dependency-policy.md) SHALL define how a
result verified in a beta lane is brought into the hub.

### Requirement 5: Python 3.15 への道筋（slowapi の置き換え）

5.1 [U] `pydantic-ai-sandbox` SHALL hold a plan that names slowapi as the shared root cause
of `fastapi<0.137`, `starlette<1.0`, and the Python 3.13 pin, compares replacement candidates,
and defines the verification lane.

### Requirement 6: 教材とガイドの役割分担・UI 標準

6.1 [U] `from-genai-to-agentic-ai` のカリキュラムとハブの `docs/guide/` の役割分担、
および相互リンクの方針 SHALL be recorded in both repositories.
6.2 [U] UI 部品の標準 SHALL be recorded as an ADR（ADR-0008）。Carbon からの移行は別 spec で行う。

## Out of Scope

- Carbon → shadcn/ui の実移行（ADR-0008 の Consequences に列挙。別 spec）
- slowapi 置き換えの実装（5.1 は計画まで。実装は sandbox での検証後）
- GitHub 上でのリポジトリ Archive 操作（ユーザ実行）
- `tests/repo/doc-links.spec.ts` の `VENDORED_ROOTS` から `services/api` を外すこと
  （上流由来の壊れたリンクの修正が先。ADR-0007 Consequences）

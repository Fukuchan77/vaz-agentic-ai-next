# 008-hub-consolidation-followup — Tasks

[`spec.md`](spec.md) の Requirement に対応する。`- [x]` 完了 / `- [ ]` 未着手。
ハブ外のリポジトリへの変更は、各リポジトリの `claude/gracious-turing-1xd2gg` ブランチに push した。

---

## 1. FastAPI レーンの差分解消（R1）

- [x] 元リポジトリ `c12ac7f..96884c4` の差分を棚卸しした（非 merge コミット 5 件）。
- [x] `d9a3c93`（予算回復・RAG role 分離・`instructions` 化）を `git am --directory=services/api` で
      履歴つきで移植した。
- [x] `sentence-transformers` の下限を 6.1.0 に揃えた。解決版は元から同一だったため、ロックの差分は
      指定子だけ（uv 0.12 で再ロック）。
- [x] 移植コミットのテスト用ダミー鍵 2 件を、移植コミットの SHA による fingerprint で `.gitleaksignore` に登録した。
- [x] `.github/` と `mise.toml` の変更（`a9baf8e` ほか）は、ハブ側に同等物があるため移植していない。
- [x] [ADR-0007](../../docs/adr/0007-fastapi-single-source-of-truth.md) を起票し、`CLAUDE.md` /
      `AGENTS.md` をペアで更新した。
- [x] **検証**: `services/api` で ruff / ty が clean、pytest（unit + integration + e2e）は 1571 passed / 23 skipped。

## 2. フック配線とアーカイブ（R2）

- [x] `services/api/scripts/hooks/pre-commit.sh`: `api:lint`、`real-tool-conventions-guard`
      （staged の blob を読む）、`pyproject.toml` / `uv.lock` が staged のときだけ `api:audit`。
      `services/api/` が staged でなければ何もしない。
- [x] `services/api/scripts/hooks/pre-push.sh`: git の pre-push stdin を読み、`services/api/` に触れる
      コミットがあり、かつ Ollama に到達できるときだけ `EXPECT_LIVE_TESTS=6 api:test:local` と
      `api:evals` を実行する。
- [x] ハブの `.githooks/pre-commit` / `pre-push` から上の 2 つを呼ぶようにした。
- [x] `test_pre_push_hook.py` を復元し、新しいパスへ向け直した。`test_pre_commit_hook.py` を新設し、
      `EXPECT_LIVE_TESTS` リテラルの drift guard も復元した。
- [x] 存在しない `.pre-commit-config.yaml` を参照していた `api:hooks:install` タスクを削除した。
- [x] 元リポジトリの README / `CLAUDE.md` / `AGENTS.md` に「凍結・ハブへ誘導」の告知を入れた。
- [x] **ユーザ実行**: `fastapi-pydantic-ai-agent` を GitHub 上でアーカイブした（2026-10-03、ユーザ確認。#64 マージ後）。
      同リポジトリの README の告知は「アーカイブ予定」の文言のまま凍結されている（アーカイブ後は編集できないため）。

## 3. TS ⇔ `services/api` の結合（R3）

- [x] `services/api/scripts/export_contract.py` を新設し、`openapi:gen` で OpenAPI と SSE 共用体の
      JSON Schema を `packages/schemas/src/generated/api-service.*` へ出力するようにした。
- [x] `@vaz/schemas/api-service`（ChatRequest と 5 イベントの Zod）と `@vaz/schemas/api-service-env`
      （`API_SERVICE_URL` の既定は :8001、`API_SERVICE_KEY`）。
- [x] ドリフト検査を両側に置いた: TS 側の `api-service-contract-drift.spec.ts`（3 レグ。意図的な改変で
      2 レグが落ちることを確認済み）と、Python 側の `test_hub_contract_snapshot.py`（実行中のアプリと
      snapshot を比較）。`api.yml` は snapshot ファイルの変更でも起動する。
- [x] `apps/web` に `@/lib/agent-api`（行区切りの扱いが安全な SSE クライアント）と
      `POST /api/agent-api/stream` を追加した。サインイン必須。`session_id` は受け取らず転送もしない。
- [x] **検証**: TS は vitest 861 passed、biome / tsc は clean。実際の `services/api`（:8001）に対する
      スモークテストで、イベントの往復と検証が通り、誤った鍵では 401 になることを確認した。

## 4. ベータ検証レーン（R4）

- [x] [`docs/dependency-policy.md`](../../docs/dependency-policy.md) §8 に、取り込み手順と
      据え置き 4 件ごとの必要な証拠を追加した。
- [x] `next-agentic-stack` の README に、TS ベータ検証レーンとしての役割を記載した。
- [x] `pydantic-ai-sandbox` の README に、Python ベータ検証レーンとしての役割と、BeeAI / LlamaIndex
      比較レーンの凍結を記載した。

## 5. slowapi 置き換え計画（R5）

- [x] `pydantic-ai-sandbox/docs/slowapi-replacement-plan.md` を作成した。3 つの据え置きの共通原因を特定し、
      候補を比較（`limits` 直結の自前実装を推奨）し、Python 3.15 の検証レーンとハブへの取り込み条件を定めた。
- [x] 検証レーン `patterns/rate-limit/` の実装（計画の第 4 節）→ `pydantic-ai-sandbox` PR #40。ハブへの取り込みは #76。

## 6. 教材とガイド・UI 標準（R6）

- [x] `from-genai-to-agentic-ai` の README と `specs/curriculum/README.md` に、役割分担とモジュール→手法の対応表を追加した。
- [x] ハブの [`docs/guide/README.md`](../../docs/guide/README.md) に、逆向きの対応表と
      「教材コードを第 3 の本番実装にしない」規則を追加した。
- [x] [ADR-0008](../../docs/adr/0008-ui-component-standard.md)（shadcn/ui + Tailwind）を起票した。
- [x] Carbon → shadcn/ui の移行 spec の起票（ADR-0008 Consequences）→ [spec `009`](../009-agent-ui-and-beta-intake/spec.md) R1〜R4（2026-10-03）。

## 7. 後始末（2026-10-03、#64 マージ後）

- [x] `tests/repo/doc-links.spec.ts` の `VENDORED_ROOTS` から `services/api` を外した（空配列）。
      表面化した壊れたリンクは `services/api/docs/pydantic-ai-sandbox-comparison-review.md` の 1 ファイル 10 本だけで、
      いずれもパッケージ化された `app/config.py`・`app/stores/{session,vector}_store.py` を指していた。
      リンク先を現在のパッケージへ付け替え、行番号が調査時コミット `fd6ec5a` 基準であることを日付つきの注記で残した。
- [x] 使われなくなった dev 依存 `pre-commit` を `services/api` から削除し、uv 0.12 で再ロックした
      （推移依存ごと 82 行減）。`.pre-commit-config.yaml` を指していた 2 か所の記述を、現在の置き場所に直した。
- [x] **検証**: `services/api` で ruff / ty が clean、pytest は 1591 passed / 23 skipped（coverage 96.56%）、
      `api:audit` は「No known vulnerabilities found, 14 ignored」。ハブ側は biome clean、`repo` プロジェクト 65 passed。
- [x] `pydantic-ai-agentic-patterns` は非公開でアーカイブ済みと確認した（ユーザ回答）。`docs/guide/` の 7 ページから
      同リポジトリへのリンク 30 本を外し、章名とパスは記録として残した。`docs/guide/README.md` と
      `agentic-engineering.md` に日付つきの注記を入れた。ADR・spec 内の言及は時点の記録なので変更していない。
- [x] ~~`agentic-ai-sandbox/reference/` の削除~~ → **不要になった**。ユーザ確認により `agentic-ai-sandbox` 自体が
      非公開でアーカイブ済みだったため、二重保守は既に解消している（読み取り専用のコピーは更新されない）。
      用意した削除コミットは push せずに破棄した。正本は `pydantic-ai-sandbox`。

## 申し送り

- 非公開アーカイブ済みのリポジトリ（`pydantic-ai-agentic-patterns`・`agentic-ai-sandbox`）への言及のうち、
  時点の記録（`specs/review/`、`services/api/docs/reference-repo-review.md` などのレビュー文書、ADR・spec）は変更しない。
  読者向けの案内文書（`docs/guide/` など）に新たなリンクを追加しない。

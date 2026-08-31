# 001-agentic-ai-core-p0 — 要件仕様

**フィーチャー名**: `agentic-ai-core`
**日付**: 2026-08-29
**ステータス**: tasks-generated（**`approvals.tasks` は未承認** — 憲章 原則 10 により人間の承認を経てから `/sdd-impl` に進む）
**一次情報源**: `specs/001-agentic-ai-core-p0/spec-agenticai-core.md`（v1.6）
**統治規範**: `specs/memory/constitution.md`（v1.2.0）

---

## プロジェクト概要

ポリグロット Turborepo によるマルチエージェント AI アプリケーション基盤の構築。
`apps/web`（Next.js 16.3 / AI SDK 7）→ `apps/agent-api`（FastAPI / Pydantic AI v2）の SSE ストリーミング構成を中核とし、LlamaIndex による Corrective RAG、HITL 承認フロー、型安全 API 契約パイプライン、4 層テスト戦略、Logfire/OTEL 可観測性を段階的に実装する。

**本リポジトリ（`vaz-agentic-ai-next`）は新規リポジトリであり、`vaz-ai-next` そのものではない。** 既存 monorepo `Fukuchan77/vaz-ai-next@cf72583` の内容を**本リポジトリへ取り込む**ことで母体を作り、そこへ `apps/agent-api` を追加する。取り込み作業自体が P0 の最初の要件群（§0）である。

---

## リポジトリの実状態（2026-08-29 実測）

`/sdd-analyze` により、旧版の spec / plan が置いていた「本リポジトリ = 既存 `vaz-ai-next`」という前提が誤りであることを検出した。実測結果を要件の前提として明記する。

| 項目 | 実測値 |
| :--- | :--- |
| リポジトリ名 | `vaz-agentic-ai-next`（`origin` = github.ibm.com、`pub` = github.com） |
| コミット | `507161c Initial commit` の 1 件のみ |
| git 追跡ファイル | `.gitignore` / `LICENSE` / `README.md` の 3 件のみ |
| 未追跡ファイル | `AGENTS.md` / `CLAUDE.md` / `specs/`（`.gitignore` には**記載されていない**。単に未 `git add` の状態） |
| 不在の資産 | `apps/` / `packages/` / `services/` / `.github/` / `.githooks/` / `scripts/` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` / `package.json` / `mise.toml` / `turbo.json` / `pyproject.toml` |

**上流リポジトリの到達性**（2026-08-29 SSH 実測）:

| 上流 | ピン | 到達性 | 備考 |
| :--- | :--- | :--- | :--- |
| `Fukuchan77/fastapi-pydantic-ai-agent` | `d4d5f8d` | ✅ 到達可 | `main` = `d4d5f8ddf43453949031c5de90047952280930c4`。**ピン = 現 main HEAD** |
| `Fukuchan77/vaz-ai-next` | `cf72583` | ✅ **実在を確認済み** | **`cf72583` = `cf725831dcb6095c6e164ae3f29f8224f436a5c9`**（`Merge pull request #10 …`）。`main`（`bbf1156b…`）から到達可能。**drift `cf72583..main` = コミット 2 件 / 変更ファイル 2 件**（research.md 調査 16 で実測。短縮 SHA では `git fetch <sha>` が失敗するため blobless fetch で解決した） |

**上流 `cf72583` の実インベントリ**（2026-08-29 実測 / research.md 調査 16）— 旧版の想定と異なる点を太字で示す:

| 対象 | 実測結果 |
| :--- | :--- |
| `services/agent/` | `.python-version` / `Dockerfile` / `README.md` / `app` / `pyproject.toml` / `tests` / **`uv.lock`（実在 → REQ-3.1 はパターン A で確定）** |
| `.github/workflows/` | `eval-nightly.yml` / `eval-pr.yml` / **`lint.yml`** / **`python.yml`** / **`security-daily.yml`** / **`tests.yml`** — **`ci.yml` は存在しない** |
| ルート `mise.toml` | **実在**（`[tools]` / `[hooks]` + 19 タスク。REQ-10.1 が前提とする **`lint:model-ids`** を含む） |
| ルート `package.json` | `name` = `vaz-ai-next` / **`packageManager` = `pnpm@11.19.0+sha512…`（REQ-1.1 の `11.24.x` と矛盾）** / `scripts` に `lint` = `biome check .`、`test` = `vitest`（watch）、`test:run` = `vitest run`、`typecheck` = `pnpm -r run typecheck` |
| TS パッケージ 9 件 | `apps/web` `apps/worker` `packages/{agents,config,db,evals,rag,schemas,tools}`。**いずれも `lint` / `test` スクリプトを持たない（`typecheck` のみ）** |
| ルート直下その他 | **`biome.json`** / **`vitest.config.ts`** / `playwright.config.ts` / `docker-compose.yml` / `.editorconfig` / `docs/` / `specs/` / `.env.example` / `.dockerignore` |
| `.githooks/` | `pre-commit` / `pre-push` |
| `scripts/` | `forbid-model-ids.sh` のみ |

---

## 要件スコープ

フェーズ区分は一次情報源 §11 の **P0〜P8** を正とする（旧「Phase 1〜4」表記は廃止）。

| Phase | 内容 |
| :--- | :--- |
| **P0** | **母体 monorepo の取り込み**＋Monorepo 骨格（`mise.toml` / `turbo.json` / ルート `pyproject.toml` / `pnpm-workspace.yaml`）。`fastapi-pydantic-ai-agent` を `apps/agent-api` として移植（動作は現状維持）。§3.3 命名規約の確定、§2.6.3 二層バージョン方針の lock 反映 |
| **P1** | Logfire 計装の確認と `gen_ai.aggregated_usage.*` の方針確定（ADR 記録） |
| **P2** | 型生成パイプラインの monorepo 展開（2 ディレクトリ分離）と `codegen-check` 導入 |
| **P3** | `/v1/chat` 新設（`from_request` / `run_stream` / `encode_stream` 分解）＋ §6.1.1 必須依存性の全接続＋フロント `useChat` 接続。**HITL は含めない** |
| **P4** | HITL 実装（`requires_approval` / `DeferredToolRequests` / §6.4.1 の 3 層防御） |
| **P5** | LlamaIndex 知覚層の統合（`CorrectiveRAGWorkflow` をツールとして公開） |
| **P6** | `packages/py-evals` を既存 baseline 機構へ合流、基準値の計測 |
| **P7** | `evals-gate` 有効化、データフライホイール運用開始 |
| **P8** | マルチエージェント化（§5.1 の判断フローを通過した領域のみ）。**到達しないことは失敗ではない** |

---

## Clarifications

### Session 2026-08-29

- Q: `apps/agent-api` の移植元と着手範囲を確定する。spec.md 旧記述は commit `73eee29` / 必須改修を「ライフサイクル分解・ガードレール必須化」としていたが、一次情報源 §0.3 は `d4d5f8d`、§4.4 の必須改修は「A: SSE ワイヤフォーマット追加」「B: Turborepo/uv workspace 化」である。どちらを採用するか？ → A: **一次情報源に合わせる**。`Fukuchan77/fastapi-pydantic-ai-agent@d4d5f8d`（Pydantic AI v2 移行完了済み）を移植ベースとし、必須改修は §4.4 の A / B とする。旧記述の 2 点（§4.4.1 ライフサイクル分解・§6.1.1 ガードレール必須化）は独立項目ではなく**改修 A の実装形および P3 の受け入れ条件として内包**される。spec.md 旧質問文は旧版由来の stale として破棄。
- Q: `apps/agent-api` の Pydantic AI バージョン方針を確定する。一次情報源 §2.6.3 とリポジトリ `AGENTS.md` が矛盾している（`AGENTS.md` は「`openai<3.0.0` 明示ピン」「フロアを ≥2.32 に上げるな」= v1.2 の推奨）。どれを採用するか？ → A: **一次情報源 §2.6.3 を採用**。litellm を含める。`pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` を宣言し、**`openai` extra は要求しない**（openai は明示ピンなし＝litellm 自身の `openai<3.0.0` 宣言に従属させる）。これにより衝突自体を回避し、実測解決は slim 2.35.3 / litellm 1.98.0 / openai 2.54.0（`pip-audit` クリーン、`d4d5f8d` で実証済み）。撤去条件: litellm が `openai>=3` を宣言したリリースを出した時点で `openai` extra を再要求してよい。
  - **改訂注記（2026-08-29 `/sdd-analyze`）**: 本 clarification が前提とした `AGENTS.md` / `CLAUDE.md` の矛盾記述は、**既に修正済みである**ことを実測で確認した（[H1] 参照）。決定内容そのものは有効だが、対応する作業は「修正」ではなく「回帰確認」に格下げした。
- Q: Turborepo の Python（uv workspace）対応は実験的機能である（§3.5 / §12 R2 に退避経路あり）。P0 の骨格をどちらの構成で始めるか？ → A: **有効化して開始**。`turbo.json` に `futureFlags.experimentalPythonWorkspaces: true` を設定する。ただし `mise` タスクは常に維持し「`turbo` を外しても開発できる」状態を保つ（§12 R2 退避経路の前提）。ローカル / git フック / CI の turbo 版一致は `turbo-version-check` で機械検証する。
- Q: 最初のデリバリ単位（`/sdd-spec` 以降で要件展開する範囲）をどこに切るか？ → A: **P0 のみ**。最初の spec / design / tasks は P0（母体取り込み＋monorepo 骨格＋§2.6.3 二層方針の lock 反映＋`apps/agent-api` の動作現状維持の移植）に限定する。受け入れ条件が最も機械的に検証可能であり、フェーズごとにフレッシュコンテキストの敵対的レビューを 1 回挟める。P1 以降は P0 の受け入れ条件充足後に別サイクルで展開する。
- Q: P3 で接続する `apps/web` 側の初期 UI スコープをどうするか？（旧 spec.md は「HITL 承認ダイアログを初期 UI に含む」としていたが §11 P3 は「HITL は含めない」と明記） → A: **取り込んだ `apps/web` を拡張し、HITL UI は P4 に置く**。既存の Carbon Design System 構成をそのまま使い、P3 では `useChat` ＋ BFF（`/api/chat` = ロジックを持たない薄いプロキシ）＋メッセージリストのテキストストリーミングのみを実装する。`addToolApprovalResponse` による承認ダイアログは P4 で §6.4.1 の 3 層防御とセットで追加する。旧 spec.md の想定は P3/P4 境界と矛盾するため破棄。

### Session 2026-08-29（`/sdd-analyze` 由来の追加決定）

- Q: 「既存 monorepo の拡張」という前提が本リポジトリと一致しない（追跡ファイル 3 件のみ）。母体を取り込むか、P0 スコープを縮小するか？ → A: **母体を取り込む（スコープ縮小しない）**。上流 2 リポジトリの到達性を実測で確認できたため、`T-0` として `vaz-ai-next@cf72583` の取り込みを P0 の最初の作業単位に置く。取り込まない選択は 39 要件のうち 14 件を検証不能にするため採らない。
- Q: turbo の版を「≥ 2.10.11」と「`mise.toml` のピンと完全一致」のどちらで運用するか？ → A: **完全固定**。`mise.toml` は `turbo = "2.10.11"` と厳密に固定し、REQ-1.1 の「≥」表記は撤回する。一次情報源が最新を 2.10.12 と記録しているため、「パッチ以上を許す」運用は `turbo-version-check`（REQ-6.1）を恒常的に赤にする。
- Q: `pip-audit` の呼び出し形式を確定する。 → A: **`uv export --frozen --no-dev | pip-audit -r /dev/stdin` に統一**。`pip-audit -r <uv.lock>` は不成立（`uv.lock` は TOML であり requirements 形式ではない。さらに uv workspace ではルート単一 lock のみが存在し `apps/agent-api/uv.lock` は生成されない）。
- Q: pre-commit の実装機構が 3 通りに分裂している。SSOT をどこに置くか？ → A: **`.githooks/pre-commit` を唯一の入口とする**。`pre-commit` フレームワークを併用する場合も `.githooks/pre-commit` から `pre-commit run` を呼び出す形に統一する（設計原則 5: 単一経路に合流させる）。

---

## Scope

**最初のデリバリ単位は P0 に限定する。** 以下の In scope は本フィーチャー全体（P0〜P8）の範囲であり、要件として展開するのは P0 の部分のみとする。

### 次サイクル（P0）の範囲

- **`vaz-ai-next@cf72583` の母体資産を本リポジトリへ取り込む**（`apps/web` / `apps/worker` / `packages/*` / `services/agent` / `.github/` / `.githooks/` / `scripts/` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` / `package.json`）
- `mise.toml` / `turbo.json`（`futureFlags.experimentalPythonWorkspaces: true`）/ ルート `pyproject.toml`（`[tool.uv.workspace]`）**— ただし uv workspace のメンバー構成（`apps/agent-api` / `services/agent` を含めるか）と Turborepo の採否は ADR で先決すること（§12 R14 / R2）。uv workspace は lock を 1 つに束ねるため、`apps/agent-api`（litellm 層）と `services/agent`（非 litellm 層）を同一 workspace に入れると §2.6.3 の二層バージョン方針と両立しない。**
- `fastapi-pydantic-ai-agent@d4d5f8d` を `apps/agent-api` として移植（**動作は現状維持**）＋ §4.4 改修 B（uv workspace 化）
- §3.3 命名規約の確定（`py-` 接頭辞、既存 TS パッケージは改名しない）
- §2.6.3 二層バージョン方針の lock 反映（`apps/agent-api` は `openai` extra なし）
- `.gitignore` のポリグロット対応（Node 系エントリの追加とパス非固定パターンの限定）
- `AGENTS.md` / `CLAUDE.md` の D4 / D5 解消と D1〜D3 の回帰確認

### In scope（フィーチャー全体）

- `apps/agent-api`（新規・`d4d5f8d` からの移植）と母体 monorepo への統合
- `/v1/chat`（Vercel AI Data Stream Protocol / SSE / `sdk_version=7`）を正式契約とする
- 境界防御層・ガードレール層・HITL・Corrective RAG・Evals・Logfire 計装
- 新規 Python パッケージ群（`packages/py-agents` / `py-schemas` / `py-evals` / `py-knowledge` / `api-types`）
- 型安全 API 契約パイプライン（生成物は 2 ディレクトリに分離しコミットする）
- 4 層テスト戦略（Unit / Integration / E2E / Evals）

### Out of scope

- Python 3.14 への移行（slowapi 依存の除去を受け入れ条件とする**独立 spec** とする。§12 R1）
- TypeScript 7 の採否（`docs/adr/` で単独判断。§12 R9）
- `services/agent` と `apps/agent-api` の統合（§3.2 / §12 R5 により禁止）
- 既存 TS パッケージ（`packages/schemas` / `evals` / `agents`）の改名
- P2P swarm 型マルチエージェント（§5.1 で却下）
- **`cf72583..main`（`vaz-ai-next`）の差分の取り込み** — P0 はピン `cf72583` を正とする。差分の評価と追随は別サイクル（T-0.1 で差分の存在のみ記録する）

---

## 未解決の不整合（P0 で解消すること）

`AGENTS.md` と `CLAUDE.md` は 1 変更単位として同時に修正する。

`/sdd-analyze` の実測により、**D1〜D3 は既に解消済み**であることが判明した。旧版が「現行記述」として引用していた文言は現行ファイルに存在しない。D4 はずれの方向が逆であり、D5 / D6 を新規に検出した。

| # | 対象 | 状態 | 内容 |
| :--- | :--- | :--- | :--- |
| D1 | `AGENTS.md` 依存制約 | **解消済み** | `AGENTS.md:42` は既に `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` ＋「**do NOT add the `openai` extra and do NOT pin openai explicitly**」と記述。旧版が引用した `[logfire,openai,ui,evals]` ＋ `openai<3.0.0` 明示ピンは**存在しない** → 回帰確認のみ（REQ-5.1） |
| D2 | `AGENTS.md` 依存制約 | **解消済み** | 「フロアを ≥2.32 に上げるな」という v1.2 の警告は現行 `AGENTS.md` に存在せず、逆に「フロアを 2.35.3+ へ前進できる」と記述されている → 回帰確認のみ（REQ-5.2） |
| D3 | `CLAUDE.md` 比較表 | **解消済み** | `CLAUDE.md:72` は既に「slim `>=2.28,<3.0`, **no `openai` extra**」 → 回帰確認のみ（REQ-5.3） |
| D4 | `CLAUDE.md` / `AGENTS.md` 現状記述 | **未解消（ずれが逆方向）** | `CLAUDE.md:14` は既に `AGENTS.md` / `CLAUDE.md` / `specs/` を「Git-tracked files」と記述しているが、`git status` 上は**未追跡**。必要な作業は文書修正ではなく `git add` ＋ commit（REQ-5.4） |
| D5 | `AGENTS.md` ツールチェーン版 | **未解消（新規検出）** | `AGENTS.md:8` = 「`pnpm 11 · uv 0.9`」、`AGENTS.md:14` = 「`pnpm 11.19.x`」。一次情報源 v1.5 は `uv` 0.12（実測 0.12.7）/ `pnpm` 11.24.0 に更新済み → `mise.toml` と矛盾する（REQ-5.6） |
| D6 | 旧 spec / plan の前提 | **本改訂で解消** | 「本リポジトリ = `vaz-ai-next`」という誤った前提。実体は別リポジトリであり母体の取り込みが必要（§0 / REQ-0.x） |

**ファイル出力先の規約差**: ユーザーグローバル規約は SDD 成果物を `.sdd/specs/{feature}/` に置くと定めるが、本リポジトリの `CLAUDE.md` は `specs/{NNN}-{feature}/` を既存慣行と定め、実体もそちらにある（`.sdd/` は gitignore 対象）。本 spec はリポジトリ側の規約に従い `specs/001-agentic-ai-core-p0/` を使用した。


---

## Requirements

<!-- status: complete -->

> **スコープ注記**: 本要件セクションは **P0（母体取り込み + monorepo 骨格 + `apps/agent-api` 移植）** のみを対象とする。P1 以降は P0 受け入れ条件充足後に別サイクルで展開する。
>
> **検証方法の表記規約**: 各要件末尾の `[検証]` は受け入れ判定の手段を示す。`機械` = CI / テスト / コマンドの終了コードで判定できるもの、`目視` = コードレビューでの確認を要するもの。「存在を確認する」型の要件は、対象が不在のときに**沈黙して通過しない**ことを条件に含める。

---

### 0. 母体 monorepo の取り込み

**背景**: 本リポジトリは `vaz-ai-next` ではなく、追跡ファイルが 3 件のみの新規リポジトリである。以降の要件群（REQ-1.5 / 1.6 / 1.7 / 3.x / 4.1 / 7.x / 9.x / 10.1）はいずれも母体資産の存在を前提とするため、取り込みを最初の要件群として明示する。

**0.1** `Fukuchan77/vaz-ai-next` のピン `cf72583` が実在するコミットとして解決できることを確認し、`cf72583` と現 `main`（`bbf1156b29db5865f6811470b98a7b002ba83ef6`）の差分の存在（コミット数・変更ファイル数）を記録すること。**実測済み（調査 16）: 完全 SHA は `cf725831dcb6095c6e164ae3f29f8224f436a5c9`、drift はコミット 2 件 / 変更ファイル 2 件。T-0.1 はこの値の再現を確認する。** `cf72583` が解決できない場合は取り込みを中断し、採用するピンを再決定すること。 `[検証: 機械（`git rev-parse` / `git log` の終了コードと、完全 SHA が上記と一致すること）]`

**0.2** `vaz-ai-next@cf72583` の以下の資産が本リポジトリに配置され、git 追跡対象になっていること: `apps/web/` / `apps/worker/` / `packages/`（TS 7 パッケージ）/ `services/agent/` / `.github/workflows/` / `.githooks/` / `scripts/` / `pnpm-workspace.yaml` / `pnpm-lock.yaml` / `package.json` / **`mise.toml`** / **`biome.json`** / **`vitest.config.ts`**。 `[検証: 機械（`git ls-files` に各パスが 1 件以上現れること）]`

  **後 3 者の追加理由（第 7 回 N3 / 調査 16-5・16-7）**: `biome.json` と `vitest.config.ts` は **TS の lint / test の設定実体**であり、取り込まなければ REQ-7.1 / 7.3 の TS 側レーンが成立しない。`mise.toml` は上流に実在し（19 タスク・`lint:model-ids` を含む）、新規作成で置き換えると REQ-10.1 が前提とするタスクが失われる。
  **取り込まないもの**: `.gitignore`（現行の「Coding agent directories」節が失われるため — REQ-1.8）、`AGENTS.md` / `CLAUDE.md`（本リポジトリの現行版が既に v1.5 準拠であり、上書きすると REQ-5.1〜5.3 の回帰確認が壊れる）、`specs/`（本リポジトリの `specs/001-agentic-ai-core-p0/` と衝突する）。**これら 4 者を除外することを取り込み手順に明記すること（不在ではなく明示的除外である）。**

**0.3** 取り込んだ `packages/` に `config`（`src/model-allowlist.ts` を含む）と `schemas`（`src/env.ts` を含む）が含まれていること（REQ-10.1 の許可リスト一元化の前提）。 `[検証: 機械（ファイル存在アサート）]`

**0.4** 取り込んだ `.github/workflows/` に既存の `eval-pr.yml` / `eval-nightly.yml` が含まれ、P0 では内容を変更しないこと。**比較基準は取り込み直後に記録した baseline（`specs/001-agentic-ai-core-p0/import-baseline.json` に保存する上流 `cf72583` の blob hash）とし、`git diff` のゼロ行をもって充足としないこと**（取り込み直後は比較対象の過去版が本リポジトリに存在しないため `git diff` は常にゼロ行になる）。 `[検証: 機械（`git hash-object` の出力を baseline と突き合わせるアサート）]`

**0.5** 取り込んだ `scripts/forbid-model-ids.sh` が存在し実行可能ビットを持つこと。存在しない場合は REQ-10.1 の作成要件に切り替えること（不在を沈黙して通過させないこと）。 `[検証: 機械（`test -x`）]`

**0.6** 取り込み元のライセンスと帰属が本リポジトリの `LICENSE` と矛盾しないことを確認し、`apps/agent-api` および取り込み資産の出所（リポジトリ URL＋コミット SHA）を `README.md` または `docs/PROVENANCE.md` に記録すること。 `[検証: 目視]`

**0.7** ルート `package.json` に `packageManager` または `devEngines.packageManager` フィールドが存在し、`mise.toml` の `pnpm` ピンと矛盾しないこと。**turbo はこのフィールドが無いとワークスペースを解決できず全タスクが起動しない**（実測: `Could not resolve workspace. Missing devEngines.packageManager or legacy packageManager field in package.json`）ため、取り込み直後に確認し、不在の場合は追加すること。

  **実測済みの初期状態（第 7 回 N3 / 調査 16-6）**: 取り込み時点の値は **`pnpm@11.19.0+sha512.…`** であり、REQ-1.1 の `pnpm = "11.24.x"` と**矛盾する**。したがって本要件は「確認のみ」ではなく **`pnpm@11.24.0+sha512.…` への更新を伴う**（`corepack use pnpm@11.24.0` 等で integrity hash も同時に更新すること。hash を手書きしないこと）。 `[検証: 機械（JSON パースによるフィールド存在アサート ＋ `mise.toml` の `pnpm` ピンとのメジャー・マイナー一致アサート）]`

---

### 1. Monorepo 骨格ファイルの整備

**背景**: 取り込んだ母体の上に、ポリグロット Turborepo を構成するルートファイル群を追加・修正する。

**1.1** ルートの `mise.toml` の `[tools]` が `node = "24"` / `python = "3.13"` / `pnpm = "11.24.x"` / `uv = "0.12.x"` / `turbo = "2.10.11"` を宣言していること。**`turbo` は完全固定とし、範囲指定や「パッチ以上」を許さない**（REQ-6.1 の等値検証と矛盾させないため）。

  **新規作成ではなく追記であること（第 7 回 N3 / 調査 16-5）**: `mise.toml` は上流に**実在し**、REQ-0.2 で取り込まれる。上流の `[hooks]` と 19 タスク（とくに REQ-10.1 が前提とする **`lint:model-ids`**、および `audit` / `check` / `py:check` / `openapi:gen`）を**削除せず維持**したうえで `[tools]` を更新し、P0 で必要なタスク（`lint:format` / `check-versions`）を追加すること。**上流のタスク定義が失われた状態を不合格とする。** `[検証: 機械（TOML パースによる `[tools]` 値アサート ＋ 上流に存在した `[tasks]` キーが 1 件も欠落していないことのアサート）]`

**1.2** `turbo.json` が `"$schema": "https://turborepo.dev/schema.json"` と `futureFlags.experimentalPythonWorkspaces: true` を含み、`build` / `codegen` / `lint` / **`check`** / `typecheck` / `test` / `test:e2e` / `evals` の各タスク定義を持つこと。`check` は turbo が Python の型検査に用いるタスク名であり省略できない（`typecheck` は Python 側では未定義であるため）。 `[検証: 機械（JSON パースによるキー存在アサート ＋ `turbo run lint check test typecheck --dry=json` が終了コード 0）]`

**1.3** `turbo.json` のタスク定義において、`typecheck` が `codegen` **と `check`** に `dependsOn` を宣言していること（前者は生成物が型チェック前に存在することの保証、後者は `turbo run typecheck` が Python の `check:ty` に到達することの保証）。 `[検証: 機械（JSON パースによる `tasks.typecheck.dependsOn` に `"codegen"` と `"check"` の両方が含まれることのアサート）]`

**1.4** ルートの `pyproject.toml` に **`[tool.turbo]` テーブルの `name`** と `[tool.uv.workspace]` テーブルが存在し、後者の `members` に `"apps/agent-api"` が列挙されていること。`[tool.turbo] name` は turbo の Python サポートの必須項目であり、未宣言の場合 turbo は `The uv workspace has no name.` で起動しない。**実体のないパスを `members` に含めないこと**（`uv lock` が失敗するため）。**`uv lock --check` による検証は `apps/agent-api` の配置後（REQ-2.1 充足後）に行うこと**（ルートファイル作成時点では原理的に成立しない）。 `[検証: 機械（TOML パース ＋ `apps/agent-api` 配置後の `uv lock --check`）]`

**1.5** `pnpm-workspace.yaml`（REQ-0.2 で取り込んだもの）が `minimumReleaseAge: 1440`（公開 24 時間未満の版を除外）と `allowBuilds` 設定を保持し、`apps/web` / `apps/worker` / `packages/*` を引き続きメンバーとして認識すること。取り込み時点で `minimumReleaseAge` が未設定の場合は追加すること。 `[検証: 機械（YAML パース ＋ `pnpm ls -r --depth -1` が各メンバーを列挙すること）]`

**1.6** `pnpm-workspace.yaml` の `allowBuilds` の各エントリに、許可または拒否の判断根拠を示すコメントが付いていること（既存エントリを削除しないこと。`false` は「監査して拒否した」を意味し「未検査」ではない）。 `[検証: 目視]`

**1.7** ルートの `uv.lock` と `pnpm-lock.yaml` の**両方**がリポジトリにコミットされており、CI で `pnpm install --frozen-lockfile` および `uv sync --frozen` が強制されること。`pnpm-lock.yaml` は REQ-0.2 の取り込みで入手する。 `[検証: 機械（`git ls-files` ＋ CI ジョブの成功）]`

**1.8** **本リポジトリの現行 `.gitignore`**（Python テンプレート由来）がポリグロット monorepo に対応していること。**上流 `vaz-ai-next` の `.gitignore` は取り込まないこと**（上書きすると下記 4 点目のエージェントディレクトリ節が失われる）。具体的に:
  - `node_modules/` / `.next/` / `.turbo/` / `coverage/` が無視対象に**含まれる**こと（実測: 現状すべて未記載）
  - `lib/` / `build/` / `dist/` / `var/` / `parts/` / `target/` / `share/python-wheels/` のようなパス非固定パターンが、`apps/web/lib/` 等の正当なディレクトリを巻き込まないようルート限定（先頭 `/`）または明示パスに変更されていること（実測: 現状 `.gitignore:17:lib/` が `apps/web/lib/x.ts` にマッチする）
  - `git check-ignore -v` が `packages/api-types/generated/x.ts` / `apps/web/AGENTS.md` / `apps/web/lib/x.ts` のいずれにも**マッチしない**こと
  - `.bob/` / `.claude/` / `.sdd/` / `.serena/` が無視対象のまま**維持されている**こと（`git check-ignore -q .sdd/reviews/x.md` が終了コード 0）
  - **`specs/memory/constitution.md` が無視対象で**ない**こと**（終了コード 1）。憲章 v1.1.0 は正本を `specs/memory/` に置くと定める。`.sdd/` は追跡外の作業領域であり永続性を保証しないため、Authority を持つ規範文書をそこに置かない（第 7 回 H4）

  `[検証: 機械（`git check-ignore` の終了コード **5 件**）]`

---

### 2. `apps/agent-api` の移植と uv ワークスペース化（改修 B）

**背景**: `Fukuchan77/fastapi-pydantic-ai-agent@d4d5f8d` を `apps/agent-api` として取り込み、uv ワークスペースメンバーとして再配置する。移植後の**動作は現状維持**（既存の `/v1/agent/chat` / `/v1/agent/stream` エンドポイントが引き続き動作すること）。

**2.1** `apps/agent-api/pyproject.toml` が uv ワークスペースメンバーとして有効な宣言を持ち、ルートの `uv.lock` で解決されること。 `[検証: 機械（`uv lock --check` ＋ `uv sync --frozen`）]`

**2.2** `apps/agent-api/pyproject.toml` が `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` を依存として宣言しており、`openai` extra を要求していないこと。 `[検証: 機械（TOML パースで extra リストに `openai` が無いことをアサートするテスト）]`

**2.3** `apps/agent-api` の uv ロック解決結果において、`pydantic-ai-slim` が 2.35.x 以上に解決し、`litellm` が 1.98.0 以上（かつ 1.83.0 以前でない）に解決すること。 `[検証: 機械（`uv.lock` のパースによるバージョン下限アサート）]`

**2.4** `apps/agent-api` のロック解決結果に対する `pip-audit` が、starlette 5 件（`PYSEC-2026-161` / `248` / `2280` / `249` / `2281`）と chromadb 3 件（`CVE-2026-45830` / `45831` / `45833`）以外の既知脆弱性を報告しないこと。抑止は一括ではなく **advisory ごとに到達性の根拠をコメントで併記**すること（一次情報源 §2.5.1 / §2.5.2 の運用規約）。監査の呼び出しは **`uv export --frozen --no-dev --package agent-api | pip-audit -r /dev/stdin`** 形式とすること（`--package` により対象を限定する。将来 `packages/py-*` を workspace に追加したときに監査対象が意図せず膨らむことを防ぐ）。 `[検証: 機械（`audit` CI ジョブ）]`

**2.5** `apps/agent-api` の既存エンドポイント（`/v1/agent/chat` / `/v1/agent/stream` / `/health` / `/health/ready`）が、移植後も同等のレスポンスを返すこと。 `[検証: 機械（`pytest tests/unit`）]`

**2.6** `turbo run test --filter=agent-api` が通ること（移植元リポジトリの全既存テストが緑であること）。**テストが 0 件収集で成功した場合は不合格とする**（偽陰性の排除）。 `[検証: 機械（終了コード ＋ 収集件数 > 0 のアサート）]`

**2.7** `apps/agent-api/pyproject.toml` の `[dependency-groups] dev` に `ruff` / `ty` / `pytest` が宣言され、ルート `uv.lock` に解決されていること。**これは turbo が Python タスク（`lint:ruff` / `check:ty` / `test`）を自動登録する必要条件であり、いずれかを欠くと `turbo run lint` が対象 0 件で成功する**（実測: `ruff` を外すと `lint` が 0 件、`pytest` を外すと `test` が `<NONEXISTENT>`、`ty` を外すと `check` が lock 整合チェックに退化する）。 `[検証: 機械（TOML パースによるアサート ＋ REQ-7.5 のガード）]`

---

### 3. §2.6.3 二層バージョン方針の lock 反映

**背景**: `apps/agent-api` （litellm 層）と `services/agent`（非 litellm 層）で `pydantic-ai-slim` のバージョンが乖離する。この乖離は設計上の意図であり、両 lock の解決結果を PR で可視化する。`services/agent` は REQ-0.2 の取り込みによって初めて存在する。

**3.1** **`services/agent/uv.lock`** において `pydantic-ai-slim` が 2.33.x 系に解決すること（取り込み時点の状態を維持すること）。 `[検証: 機械（`services/agent/uv.lock` のパースによるバージョンアサート）]`

> **lock 形式は実測で確定済み（第 7 回 C2 / 調査 16-3）**: 上流 `cf72583` の `services/agent/` に **`uv.lock` が実在する**（`git ls-tree` で確認。リポジトリ全体の lock は `pnpm-lock.yaml` と `services/agent/uv.lock` の 2 件のみ）。したがって `pip-audit` の実行形は
> **`cd services/agent && uv export --frozen --no-dev | pip-audit -r /dev/stdin`** に確定する。
>
> 第 6 回で導入した 4 パターン分岐（A: `uv.lock` / B: `requirements*.txt` / C: `poetry.lock` / D: lock なし）は**パターン A で確定したため削除した**。とくに旧選択肢「REQ-3.1 を P0 スコープ外に格下げし `[検証]` を目視に落とす」は、憲章 原則 10 の「**受け入れ基準の事後緩和を禁ずる**」に違反するため、実測により不要になった時点で撤回する。**実装中に検証手段を決める余地を残さないこと。**

**3.2** `apps/agent-api` の lock と `services/agent` の lock が、ともに `pip-audit` クリーン（REQ-2.4 の到達性根拠付き抑止を除く）であることを、**`pip-audit` の生出力そのまま** PR 本文に添付すること（「監査は通った」という要約は不可。一次情報源 §2.6.5）。 `[検証: 目視（PR 本文）]`

**3.3** uv ロック更新の差分において、いずれのパッケージもバージョンがダウングレードされていないことを PR レビューで確認できること。 `[検証: 目視（lock 差分に「版が下がっている行」がないこと）]`

---

### 4. §3.3 パッケージ命名規約の確定

**背景**: ポリグロット monorepo で TS パッケージと同名の Python パッケージが並ぶことを防ぐため、`py-` 接頭辞規約を確立する。

**4.1** REQ-0.2 で取り込んだ TS パッケージ（`packages/schemas` / `packages/evals` / `packages/agents` / その他）の**ディレクトリ名と `package.json` の `name` が、取り込み時点から変更されていないこと**。比較基準は REQ-0.4 と同じ `specs/001-agentic-ai-core-p0/import-baseline.json`（取り込み直後に生成）とする。 `[検証: 機械（各 `package.json` の `name` を `import-baseline.json` と比較するテスト）]`

**4.2** 今後追加する Python パッケージの `py-` 接頭辞規約が、ルート `pyproject.toml` に**コメントとして記載**されていること（`packages/py-agents` / `packages/py-schemas` / `packages/py-evals` / `packages/py-knowledge`）。**実体のないパスを `[tool.uv.workspace].members` に含めてはならない**（REQ-1.4）。 `[検証: 機械（コメント行の grep ＋ `members` に `py-` パスが無いことのアサート）]`

**4.3** `packages/api-types/generated/` が `.gitignore` によって無視されないこと。 `[検証: 機械（`git check-ignore -v packages/api-types/generated/x.ts` がマッチしないこと = 終了コード 1）]`

---

### 5. `AGENTS.md` / `CLAUDE.md` の一次情報源 v1.5 への整合

**背景**: D1〜D3 は既に解消済みであり、本要件群は**回帰確認**（v1.2 の記述が再導入されていないこと）と、未解消の D4 / D5 の解消からなる。`AGENTS.md` と `CLAUDE.md` は 1 変更単位として同時に修正する。

**5.1** `AGENTS.md` の依存制約が `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` であり、`openai` extra の指定と `openai` の明示ピンを**含まない**こと（D1 の回帰確認）。 `[検証: 機械（grep によるアサートテスト）]`

**5.2** `AGENTS.md` に「フロアを ≥2.32 に上げると litellm が 1.83.0 へ後退する」旨の v1.2 時代の警告が**含まれない**こと（D2 の回帰確認）。 `[検証: 機械（grep によるアサートテスト）]`

**5.3** `CLAUDE.md` の比較表において `apps/agent-api` の依存制約が REQ-5.1 と同じ内容であること（D3 の回帰確認）。 `[検証: 機械（grep によるアサートテスト）]`

**5.4** `AGENTS.md` / `CLAUDE.md` / `specs/` が **git 追跡対象になっていること**（D4）。`CLAUDE.md` の記述はすでに追跡対象であると述べているため、必要な作業は記述変更ではなく `git add` ＋ commit である。**`specs/` の追跡には `specs/memory/constitution.md`（憲章 v1.1.0 の正本）を含むこと**（第 7 回 H4）。 `[検証: 機械（`git ls-files` に 3 者 ＋ 上記 2 ファイルが現れること）]`

**5.5** `AGENTS.md` と `CLAUDE.md` が 1 つの commit で同時に変更されること（変更単位の規約）。 `[検証: 目視（`git log --name-only` で同一 commit に両者が含まれること）]`

**5.6** `AGENTS.md` のツールチェーン記述が `mise.toml`（REQ-1.1）と一致すること。具体的に `uv` = 0.12 系、`pnpm` = 11.24 系に更新されていること（D5）。**比較規則**: `mise.toml` の `[tools]` の値（`0.12.x` / `11.24.x`）から `x` を除いた**メジャー・マイナー部分の文字列一致**をもって「一致」と判定する（パッチ部分は比較しない）。 `[検証: 機械（`mise.toml` の値と `AGENTS.md` の記述を突き合わせるテスト）]`

---

### 6. Turborepo バージョン整合性の機械検証（`turbo-version-check`）

**背景**: `futureFlags.experimentalPythonWorkspaces` を認識しない古い turbo が実行されると機能が無効になる。ローカル / git フック / CI で turbo 版が一致することを機械的に担保する。

**6.1** CI に `turbo-version-check` ジョブが存在し、`turbo --version` の出力が `mise.toml` で固定されたバージョンと**完全一致**する場合のみパスすること。期待値の読み出しは行指向の `grep` ではなく **TOML パーサまたは `mise` 自身のクエリ**（例 `mise config get tools.turbo`）で行い、`[tasks]` セクションの同名キーに誤マッチしないこと。**版を意図的にずらしたときにジョブが非 0 で終了することを確認する作業を受け入れ条件に含める**（憲章 原則 3 の非空虚要件。確認せずに「存在する」だけを満たした状態を不合格とする）。 `[検証: 機械（CI ジョブ ＋ 期待値を一時的にずらしたときにジョブが非 0 で終了することの確認）]`

**6.2** `turbo-version-check` ジョブがブロッキングであること（通らなければマージできないこと）。 `[検証: 目視（required status check 設定）]`

**6.3** ローカル実行環境（開発者の `PATH` 上の turbo）のバージョンが `mise.toml` のピンと異なる場合に、検出方法（エラーメッセージまたは pre-commit フック）が存在すること。 `[検証: 機械（`mise run check-versions` が不一致時に非 0 で終了すること）]`

---

### 7. `turbo run lint test` 両言語通過

**背景**: P0 の最終受け入れ条件として、TS と Python の両言語の lint / typecheck / test が通ること。

> **重要な実測結果（第 7 回 N1 / 調査 17）— 旧要件の前提は誤っていた**:
> `[tool.turbo] name` を宣言すると、ワークスペースルートは Python（uv）ルートパッケージとして扱われ、
> **turbo はルート `package.json` の `scripts` を一切解決しない**（ルートの `name` を `[tool.turbo] name` と
> 一致させても同じ。実測で両方確認）。一方、上流の TS パッケージ 9 件は **`lint` / `test` スクリプトを持たず、
> `typecheck` のみ**を持つ。TS の lint / test はルート集約スクリプト（`biome check .` / `vitest run`、
> ルート単一の `biome.json` / `vitest.config.ts` でリポジトリ全体を走査）にしか存在しない。
>
> 帰結: **`turbo run lint` と `turbo run test` は TS 側を 1 件も実行しない。** `turbo run typecheck` のみが
> 両言語をカバーする（9 パッケージの `typecheck` + `dependsOn: ["codegen","check"]` 経由の Python `check:ty`）。
>
> したがって TS のルート集約レーンは **turbo の外の独立ステップとして実行する**。これは
> `ruff format --check`（`format:ruff` が `--check` を付けないため turbo で代替できない）で既に確立した
> 前例と同じ扱いである。9 パッケージに `lint` / `test` スクリプトを新設する案は採らない
> （ルート直下のファイルが走査対象から漏れ、`vitest.config.ts` を 9 個に複製する必要が生じるため）。

**7.1** lint が両言語で警告・エラーなしに完了すること。内訳を次のとおり分離する:
  - **Python**: `turbo run lint` が `agent-api#lint:ruff`（= `uv run --frozen --package agent-api ruff check apps/agent-api`）を実行すること
  - **Python 書式**: `uv run --frozen --package agent-api ruff format --check apps/agent-api`（= `mise run lint:format`）を **turbo の外の独立ステップ**として実行すること（turbo の `format:ruff` は `--check` を付けず破壊的に整形するため代替不可）
  - **TS**: `biome check .`（= ルート `package.json` の `lint` スクリプト / `mise run lint`）を **turbo の外の独立ステップ**として実行すること。**`turbo run lint` が TS を実行することを期待しないこと**（実測により不成立）

  `[検証: 機械（3 ステップそれぞれの終了コード ＋ REQ-7.5 の Python 側ガード ＋ REQ-7.6 の TS 側ガード）]`

**7.2** `turbo run typecheck` が、TS（`tsc --noEmit`）と Python（`ty check`）の両方を実行し、型エラーなしで完了すること。Python 側は turbo のタスク名が `check`（`check:ty`）であり `typecheck` では登録されないため、**REQ-1.3 の `dependsOn: ["codegen", "check"]` を経由して到達すること**を条件に含める（`turbo run typecheck` が Python 側で `<NONEXISTENT>` のまま成功する状態を不合格とする）。`turbo run codegen` が `typecheck` の前に完了することも同 `dependsOn` で保証されていること。 `[検証: 機械（終了コード ＋ REQ-1.3 のアサート ＋ `turbo run typecheck --filter=agent-api --dry=json` に `uv run` で始まるコマンドが 1 件以上現れること）]`

**7.3** test が両言語で通ること。内訳を次のとおり分離する（理由は REQ-7.1 の実測注記と同じ）:
  - **Python**: `turbo run test` が `agent-api#test`（= `uv run --frozen --package agent-api pytest apps/agent-api`）を実行し、**収集件数 > 0** で全通過すること
  - **TS**: `vitest run`（= ルート `package.json` の **`test:run`** スクリプト / `mise run test:run`）を **turbo の外の独立ステップ**として実行し、**収集件数 > 0** で全通過すること

  **ルートの `test` スクリプトを使わないこと**: 上流のルート `test` は `vitest`（**watch モード**）であり CI でハングする。必ず `test:run`（= `vitest run`）を呼ぶこと。なお turbo はルートの `scripts` を解決しないため `turbo run test` 経由でハングする経路は生じない（実測）。 `[検証: 機械（両ステップの終了コード ＋ 各言語の収集件数 > 0 のアサート）]`

**7.4** Python テストの `conftest.py` で `models.ALLOW_MODEL_REQUESTS = False` がグローバルに設定されており、`block_network()` autouse fixture がソケットレベルのネットワーク遮断を `tests/unit/` 全体に適用していること。 `[検証: 機械（遮断が効いていることを確認する専用テスト。**その専用テストが遮断を外したときに落ちることを確認すること** — 憲章 原則 3）]`

**7.5** `turbo run lint` / `check` / `test` の各実行において、**Python パッケージのタスクが「実コマンド付きで」1 件以上スケジュールされること**。判定は `turbo run <task> --filter=agent-api --dry=json` の出力のうち **`command` が `uv run` で始まるタスクの件数 ≥ 1** とする。

  **タスク件数による判定は不合格とする**: `turbo run typecheck --filter=agent-api --dry=json` はタスク 2 件を返すが `command` は両方 `<NONEXISTENT>` であり（実測）、件数ガードは通過する一方で Python は何も実行されない。同様に、turbo がエラー終了したときに件数が空文字列となりガードが沈黙して通過する実装（`set -euo pipefail` と既定値の欠落）も不合格とする。 `[検証: 機械（`--dry=json` の `command` フィールドを判定するガードスクリプト ＋ 意図的に `[dependency-groups]` から `ruff` を外したときにガードが非 0 で終了することの確認）]`

  **実測により設計の成立を確認済み（第 7 回 H2 / 調査 15）**: `--filter=agent-api` 付きで `lint` / `check` / `test` はいずれも `agent-api` スコープに `uv run …` を 1 件解決する（`check:ty` がルートに集約されることはない）。ガードスクリプトの終了コードは 3 状態で確認済み — 正常 = **0**、`ruff` 除去 = **1**、`uv.lock` 退避（turbo ハードエラー）= **1**。**第 6 回で残されていた「集約先は実装依存であり T-2.6 で実測する」という未決は解消したため、実装中に判定形を決める余地はない。**

**7.6** **TS 側のゼロ件偽陰性ガード**が存在すること。`turbo run lint` / `test` は TS を実行しないため（REQ-7.1 の実測注記）、TS レーンは turbo の外で実行される。その独立ステップが**対象 0 件で成功する経路を塞ぐ**こと。具体的に:
  - Biome: `biome check .` の走査対象ファイル数が 1 件以上であること（例: `biome check --reporter=summary .` の出力または `biome check --json .` の `summary.changed`/`files` 相当を判定する。**`biome.json` の取り込み漏れや `ignore` の設定ミスにより 0 件走査で緑になる状態を不合格とする**）
  - Vitest: `vitest run` の収集テスト件数が 1 件以上であること（**`vitest.config.ts` の取り込み漏れにより 0 件収集で緑になる状態を不合格とする**）

  **背景（第 7 回 N1）**: REQ-7.5 のガードは `uv run` で始まるコマンドのみを数えるため Python 側しか守らない。TS 側は設定ファイル（`biome.json` / `vitest.config.ts`）が REQ-0.2 の取り込み対象に入っていなかったため、**取り込み漏れが沈黙して通過する**構造だった。Python 側と対称のガードを置く。 `[検証: 機械（走査/収集件数 > 0 のアサート ＋ `biome.json` を一時退避したときにガードが非 0 で終了することの確認）]`

**7.7** 両言語の**分岐カバレッジの実測ベースライン**を取得し、`specs/001-agentic-ai-core-p0/coverage-baseline.json` に記録してコミットすること（TS = `vitest run --coverage`、Python = `pytest --cov`）。**P0 ではしきい値を設けずブロックしない**（計測と記録のみ）。

  **理由**: 憲章 v1.1.0 の `TODO(BRANCH_COVERAGE_THRESHOLD)` は「分岐カバレッジの数値しきい値は **P0 で** `vitest --coverage` / `pytest` の実測ベースラインを取得したあと、次回改正（MINOR）で確定する」と P0 に作業を割り当てている。根拠のない数値を先に固定することは原則 8 に反するため、P0 は**測って記録するところまで**を負う。この記録がなければ憲章改正の前提が揃わない（第 7 回 M6）。 `[検証: 機械（`coverage-baseline.json` が存在し、両言語の branch カバレッジ値が数値として記録されていること）]`

---

### 8. ツール生成ファイルのコミット管理

**背景**: `next dev` が `apps/web/AGENTS.md` を自動生成・再付与するため、`.gitignore` せずコミットする規約を確立する。本要件群は REQ-0.2（`apps/web` の取り込み）完了後に初めて検証可能になる。

**8.1** `apps/web/AGENTS.md` が `.gitignore` によって無視されず、git 追跡対象であること。 `[検証: 機械（`git check-ignore` がマッチしないこと ＋ `git ls-files` に現れること）]`

**8.2** pre-commit フックに、ツール生成ファイル（`apps/web/AGENTS.md` 等）の未コミット残留を検知するチェックが含まれていること。判定は以下 3 状態すべてで正しいこと:

  | `apps/web/AGENTS.md` の状態 | 期待するフックの終了コード |
  | :--- | :--- |
  | 未追跡（`next dev` が生成し `git add` されていない）| **非 0（失格）** |
  | ステージ済み（これからコミットされる正常系）| **0（通過）** |
  | 未ステージ変更が残っている | 非 0（失格）|

  **`apps/web/` が存在しない場合にチェックが常にパスする実装は不合格とする**（対象不在を検知して警告すること）。また、**ステージ済みの正常系を失格にする実装も不合格とする**（`next dev` が毎回再生成するため、このファイルを含む以後のコミットが恒常的にブロックされる）。 `[検証: 機械（3 状態それぞれでフックの終了コードを確認する）]`

---

### 9. CI パイプラインの基本ゲート

**背景**: P0 時点で稼働すべき CI ジョブの最小セットを定義する。`.github/workflows/` は REQ-0.2 で取り込む。

> **実測により前提を訂正（第 7 回 N2 / 調査 16-4）**: 旧要件は「`ci.yml` に 4 ジョブを集約し、不在なら新規作成する」前提だったが、**上流 `cf72583` に `ci.yml` は存在しない**。実体は 6 ファイルで、**lint / test / Python / セキュリティ監査はすでに独立 workflow として稼働している**:
> `eval-nightly.yml` / `eval-pr.yml` / **`lint.yml`** / **`python.yml`** / **`security-daily.yml`** / **`tests.yml`**。
>
> したがって `ci.yml` を新規作成することは、既存の稼働中パイプラインと**並行する第 2 の CI 経路を作る**行為であり、憲章 原則 5（既存の単一経路に合流させる）に違反する。**P0 は既存 workflow へ合流させる。**

**9.1** 以下の検査が CI 上に存在し、いずれもブロッキングであること。**新規 workflow ファイルを作らず、実在する workflow へ合流させること**（原則 5）:

  | 検査 | 合流先（実測に基づく想定） | P0 での作業 |
  | :--- | :--- | :--- |
  | TS lint（`biome check .` + REQ-7.6 の走査件数ガード） | `lint.yml` | 既存ジョブに Python `ruff` ステップと走査件数ガードを追加 |
  | Python lint（`turbo run lint` + `ruff format --check`） | `lint.yml` または `python.yml` | 同上 |
  | typecheck（`turbo run typecheck`） | `lint.yml` | 既存の typecheck 相当を turbo 経由に切り替える |
  | TS unit test（`vitest run` + 収集件数ガード） | `tests.yml` | 既存ジョブに収集件数ガードを追加 |
  | Python unit test（`turbo run test` + REQ-7.5 ガード） | `tests.yml` または `python.yml` | 同上 |
  | `turbo-version-check` | `lint.yml`（または新規ジョブとして既存ファイルに追加） | **新規ジョブ** |
  | `audit`（`pnpm audit` + `pip-audit`） | `security-daily.yml` | 既存ジョブに `pip-audit` ステップを追加 |

  **T-5.0 で最初に行うこと**: 実在する 6 workflow の `jobs` を YAML パースで棚卸しし、上表の各検査が**どのファイルのどのジョブに存在するか / 存在しないか**を記録する。**不足分のみ**を既存ファイルへ追加する。既に存在する検査を別ファイルに重複実装した状態を不合格とする。

  **job_id の制約（第 7 回 H3）**: GitHub Actions の `job_id` は先頭が英字または `_`、以降は英数字 / `-` / `_` のみで、**`:` を含められない**。したがって `test:unit` は job_id として使用できない。job_id は **`test-unit`** の形とし、表示名が必要な場合は `name:` で与えること。アサートは **job_id の厳密な集合**に対して行い、「または同等の名前」のような曖昧な判定を用いないこと（曖昧な判定では「不在を沈黙して通過させない」という本要件の目的が達成できない）。 `[検証: 機械（実在 workflow の YAML パースによる job_id / step の存在アサート）＋目視（required status check 設定）]`

**9.2** `audit` ジョブが `pnpm audit --audit-level=moderate` と `uv export --frozen --no-dev --package agent-api | pip-audit -r /dev/stdin` を両方実行し、REQ-2.4 の到達性根拠付き抑止以外の既知脆弱性がない場合のみパスすること。`--ignore-vuln` の全エントリが実際に `pip-audit` へ渡ることを確認すること（シェルの行継続とコメントの併用による引数欠落を排除する）。 `[検証: 機械（`audit` CI ジョブ ＋ 引数展開の確認）]`

**9.3** CI の全 `uses:` アクションが 40 桁の完全な SHA でピンされており、**かつすべての workflow ジョブに最小権限の `permissions:` 宣言が存在すること**。これを機械検証する `test_ci_workflows.py` を**新規作成**すること（一次情報源 §10.2 v1.6 の訂正: 同テストは `fastapi-pydantic-ai-agent` の資産であり `vaz-ai-next` には存在しない。旧版の「維持」という記述は誤りであり、**移植**が必要）。同テストが P0 で追加・新規作成したジョブのステップも走査範囲に含むこと（`.github/workflows/` をリポジトリルート基準で解決すること）。`vaz-ai-next@bbf1156` の 6 workflow は全 21 `uses:` が可変タグ（`@v4`/`@v6`/`@v7` 等）であり `permissions:` 宣言はゼロ件であるため、P0 での作業はゼロからのピン化と権限宣言追加を含む。 `[検証: 機械（`pytest` ＋ 走査対象ファイル数 > 0 のアサート ＋ 可変タグを意図的に残したときにテストが非 0 で終了することの確認）]`

**9.4** CI が `pnpm install --frozen-lockfile` および `uv sync --frozen` で依存を解決すること（ロックファイル外の版が使われないこと）。 `[検証: 機械（CI ジョブの成功）]`

---

### 10. モデル ID のハードコード禁止

**背景**: モデル ID は設定値であり仕様ではない。既存ゲートを monorepo 全体に展開し、許可リストを 1 か所に集約する。

**10.1** モデル ID ハードコード検出（`scripts/forbid-model-ids.sh` および pre-commit の `no-hardcoded-model-id`）が pre-commit および CI で実行され、許可リスト（`packages/config/src/model-allowlist.ts` および `packages/schemas/src/env.ts`）以外のファイルへのモデル ID 直書きを拒絶すること。REQ-0.5 の確認で `scripts/forbid-model-ids.sh` が不在だった場合は、本要件の範囲で**新規作成**すること。走査対象に `apps/agent-api` の `.py` ファイルを含めること。 `[検証: 機械（許可リスト外に既知モデル ID を含む一時ファイルを置き、フックと CI が非 0 で終了することの確認）]`

**10.2** `apps/agent-api` のモデル ID が環境変数（`settings.llm_model`）から解決されており、ソースコードにハードコードされていないこと。 `[検証: 機械（`tests/unit/test_no_hardcoded_model_ids.py`）]`

**10.3** pre-commit の実装が `.githooks/pre-commit` を唯一の入口とする単一経路になっていること（`pre-commit` フレームワークを併用する場合も `.githooks/pre-commit` から呼び出すこと）。同一の検査が複数の機構に重複実装されていないこと。 `[検証: 目視（設計原則 5 への適合）]`

---

## 要件数サマリ

| 群 | 件数 |
| :--- | :--- |
| 0. 母体 monorepo の取り込み | 7 |
| 1. Monorepo 骨格ファイル | 8 |
| 2. `apps/agent-api` 移植 | 7 |
| 3. 二層バージョン方針 | 3 |
| 4. パッケージ命名規約 | 3 |
| 5. `AGENTS.md` / `CLAUDE.md` 整合 | 6 |
| 6. `turbo-version-check` | 3 |
| 7. 両言語通過 | **7** |
| 8. ツール生成ファイル管理 | 2 |
| 9. CI 基本ゲート | 4 |
| 10. モデル ID ハードコード禁止 | 3 |
| **合計** | **53** |

うち `[検証: 機械]` = 46 件、`[検証: 目視]` = 7 件（REQ-0.6 / 1.6 / 3.2 / 3.3 / 5.5 / 6.2 / 10.3）。REQ-9.1 は機械（実在 workflow の YAML パースによる job_id / step 存在アサート）＋目視（required status check 設定）の複合、REQ-0.4 は第 3 回改訂により機械のみに変更した。

---

_Generated: 2026-08-29_

# 001-agentic-ai-core-p0 — 技術設計 (plan)

<!-- status: complete -->

**フィーチャー名**: `001-agentic-ai-core-p0`
**日付**: 2026-08-29
**フェーズ**: P0（母体取り込み + monorepo 骨格 + `apps/agent-api` 移植）
**一次情報源**: `specs/001-agentic-ai-core-p0/spec-agenticai-core.md`（v1.6）
**統治規範**: `specs/memory/constitution.md`（v1.2.0）

---

## 目次

0. [母体 monorepo の取り込み設計](#0-母体-monorepo-の取り込み設計)
1. [設計の前提と方針](#1-設計の前提と方針)
2. [アーキテクチャ概要](#2-アーキテクチャ概要)
3. [コンポーネント設計](#3-コンポーネント設計)
4. [インターフェース定義](#4-インターフェース定義)
5. [技術決定事項 (ADR)](#5-技術決定事項-adr)
6. [ファイル構造計画](#6-ファイル構造計画)
7. [テスト設計](#7-テスト設計)
8. [CI / 品質ゲート設計](#8-ci--品質ゲート設計)
9. [要件トレーサビリティ](#9-要件トレーサビリティ)
10. [リスクと制約](#10-リスクと制約)

---

## 0. 母体 monorepo の取り込み設計

> **前提**: 本リポジトリ (`vaz-agentic-ai-next`) は追跡ファイルが `.gitignore` / `LICENSE` / `README.md` の 3 件のみの新規リポジトリである。P0 の最初の作業は `vaz-ai-next@cf72583` を本リポジトリへ取り込み、以降の要件が前提とする資産を揃えることである（REQ-0.1〜0.6）。

### 0.1 取り込み戦略（Req 0.x）

**方式**: `git fetch` → `git cherry-pick` または `git read-tree` による部分取り込み。`git merge --allow-unrelated-histories` による履歴マージは選択肢だが、既存コミット `507161c` に不要な歴史が混入するリスクがある。推奨は以下のフロー:

1. `cf72583` が解決できることを `git ls-remote` で確認し、コミット数と変更ファイル数を記録する（Req 0.1）
2. 解決確認後、対象ディレクトリ群を sparse-checkout または rsync 相当でコピーし、本リポジトリに `git add` する
3. 取り込んだ内容の各ファイルが `git ls-files` に現れることを確認する（Req 0.2）

**取り込み対象資産**（Req 0.2）:

| 資産 | 種別 | P0 での扱い |
| :--- | :--- | :--- |
| `apps/web/` | Next.js 16.3 フロントエンド | 変更なし（P3 で拡張） |
| `apps/worker/` | バックグラウンドワーカー | 変更なし |
| `packages/`（TS 7 パッケージ群） | `schemas` / `agents` / `config` / `db` / `tools` / `rag` / `evals` | 変更なし |
| `services/agent/` | ステートレス Python サイドカー | 変更なし（uv workspace に含めない） |
| `.github/workflows/` | CI ワークフロー | `eval-pr.yml` / `eval-nightly.yml` は変更なし。`ci.yml` は P0 で拡張 |
| `.githooks/` | pre-commit フック群 | P0 で `.githooks/pre-commit` を拡張 |
| `scripts/` | ユーティリティスクリプト群 | `forbid-model-ids.sh` の存在を Req 0.5 で確認 |
| `pnpm-workspace.yaml` | pnpm ワークスペース設定 | P0 で `minimumReleaseAge` 等を確認・補完 |
| `pnpm-lock.yaml` | pnpm ロックファイル | コミット対象のまま維持 |
| `package.json`（ルート）| pnpm ワークスペースのルート manifest | 変更なし |

**所有しないもの**: `cf72583..main`（`vaz-ai-next`）の差分の取り込み — P0 はピン `cf72583` を正とする（Out of scope）。

### 0.2 前提確認チェック（Req 0.3〜0.6）

| Req | 確認内容 | 検証手段 |
| :--- | :--- | :--- |
| 0.3 | `packages/config/src/model-allowlist.ts` と `packages/schemas/src/env.ts` が取り込み後に存在すること（REQ-10.1 の前提）。なおモデル ID ハードコード除外ファイルは計 3 件: `packages/config/src/model-allowlist.ts` / `packages/schemas/src/env.ts` / `services/agent/app/config.py`（spec v1.6 §2.4 訂正）| `test -f` アサート |
| 0.4 | `.github/workflows/eval-pr.yml` / `eval-nightly.yml` が取り込み後も無変更であること | **`import-baseline.json` の `workflow_hashes` と `git hash-object` の現在値の一致アサート（§6.1 / §7.6）。`git diff` のゼロ行を根拠にしてはならない** — 取り込み直後は比較対象の過去版が本リポジトリに存在しないため常にゼロ行になる（第 7 回 H1） |
| 0.5 | `scripts/forbid-model-ids.sh` が存在し実行可能ビットを持つこと。不在の場合は REQ-10.1 の作成要件に切り替え | `test -x` アサート |
| 0.6 | 取り込み元の出所（リポジトリ URL + コミット SHA）を `README.md` または `docs/PROVENANCE.md` に記録すること | 目視 |

---

## 1. 設計の前提と方針

### 1.1 設計アプローチ

P0 は **本リポジトリ (`vaz-agentic-ai-next`) への `vaz-ai-next@cf72583` の取り込み + ポリグロット Turborepo 骨格の確立 + `apps/agent-api` の動作維持移植** の 3 ステップ構成である。設計の関心事は次の 3 点に限定する。

1. **母体 monorepo の取り込み** — `vaz-ai-next@cf72583` を本リポジトリへ取り込み、以降の要件が前提とする資産（`apps/web` / `services/agent` / `packages/*` / `.github/` / `.githooks/` / `scripts/` 等）を揃える（§0 設計）。
2. **ポリグロット Turborepo 骨格の確立** — ルートファイル群（`mise.toml` / `turbo.json` / `pyproject.toml`）を新設し、取り込んだ `pnpm-workspace.yaml` を整備して、TS / Python 両言語のタスクを `turbo run` 単一コマンドで実行できる状態にする。
3. **`apps/agent-api` の動作維持移植** — `fastapi-pydantic-ai-agent@d4d5f8d` を `apps/agent-api` としてリポジトリに取り込み、uv workspace メンバーとして再配置する（改修 B のみ）。移植後の `/v1/agent/chat` / `/v1/agent/stream` / `/health*` は同等のレスポンスを返し続ける。

P3 での `/v1/chat` 新設（改修 A）、P4 の HITL、P5 の LlamaIndex 統合はこの design の対象外とする。

### 1.2 ステアリング整合

`spec-agenticai-core.md` の 7 設計原則のうち、P0 に直接関わるものを以下に示す。

| 原則 | P0 での具体化 |
| :--- | :--- |
| 原則 2: 層の責任境界を型で固定 | uv workspace 化により `apps/agent-api` と将来の `packages/py-*` の import 境界を明確化 |
| 原則 4: 可観測性は最初から入れる | Logfire 計装は移植元 `lifespan.py` に実装済みであり、P0 の移植によって**リポジトリに持ち込まれる**。**ただし P0 は計装の動作を検証しない**（span ツリーの出力確認と `gen_ai.aggregated_usage.*` の属性名決定は憲章 原則 4 の検証条項どおり **P1 の受け入れ基準**に属する）。P0 で「満たす」と断定しない（第 7 回 M9） |
| 原則 5: 既存の単一経路に合流させる | モデル ID ゲート・pre-commit フック・CI の `test_ci_workflows.py` は既存経路を拡張する |

### 1.3 取り込み後の資産の扱い

P0 で取り込んだ後、変更しないコンポーネント:

- `apps/web` / `apps/worker` / `packages/*`（TS パッケージ群）— P0 では変更なし（P3 以降で拡張）
- `services/agent` — 変更なし（§3.2 の責務固定により uv workspace にも含めない）
- `.github/workflows/eval-pr.yml` / `eval-nightly.yml` — 変更なし（P0 スコープ外）
- `packages/config/src/model-allowlist.ts` — 許可リストの一元管理点として存在を確認後、そのまま使用（Req 0.3）

> **注意**: 上記は「取り込み後に変更しない」資産の一覧である。取り込み前はいずれもこのリポジトリに存在しない。

---

## 2. アーキテクチャ概要

### 2.1 P0 後のリポジトリ論理構造

```
repo/ (vaz-agentic-ai-next — P0 完了後の状態)
│                               ← ★ = T-0 で vaz-ai-next@cf72583 から取り込む
│                               ← [NEW] = P0 で新規作成
│                               ← [MOD] = P0 で変更
│
├── [NEW] mise.toml              ← Node 24 LTS / Python 3.13 / pnpm 11.24.x / uv 0.12.x / turbo 2.10.11
├── [NEW] turbo.json             ← futureFlags.experimentalPythonWorkspaces: true
├── [NEW] pyproject.toml         ← [tool.turbo] name + [tool.uv.workspace] メンバー宣言
├── ★ pnpm-workspace.yaml        ← 取り込み後に minimumReleaseAge / allowBuilds を確認・補完
├── ★ pnpm-lock.yaml             ← 取り込み（コミット対象のまま維持）
├── ★ package.json               ← 取り込み（変更なし）
├── [NEW] uv.lock                ← コミット対象（--frozen-lockfile 保証）
├── [MOD] AGENTS.md              ← D4 回帰確認（git add 後）/ D5: uv・pnpm バージョン更新（REQ-5.6）
├── [MOD] CLAUDE.md              ← D4 回帰確認（AGENTS.md と 1 コミット単位）
├── [MOD] .gitignore             ← ポリグロット対応（REQ-1.8）
│
├── apps/
│   ├── web/                     ← ★ 取り込み（変更なし、P3 で拡張）
│   │   └── [NEW] AGENTS.md      ← next dev 自動生成・コミット対象
│   ├── worker/                  ← ★ 取り込み（変更なし）
│   └── [NEW] agent-api/         ← fastapi-pydantic-ai-agent@d4d5f8d 移植
│       ├── app/
│       │   ├── main.py          ← app factory / middleware
│       │   ├── lifespan.py      ← Logfire 計装 fail-soft
│       │   ├── config/          ← Settings（llm_model は環境変数から解決）
│       │   ├── observability.py
│       │   ├── api/v1/
│       │   │   ├── router.py    ← prefix="/v1" はここには書かない
│       │   │   ├── agent.py     ← /agent/chat, /agent/stream（既存互換）
│       │   │   └── _stream.py   ← SSE ライフサイクル硬化（両契約共用）
│       │   ├── agents/          ← guardrails.py / chat_agent.py / deps.py
│       │   ├── deps/            ← auth / workflow / settings の DI
│       │   ├── models/          ← Request/Response スキーマ + errors
│       │   ├── patterns/sse.py  ← 独自 5 イベント codec（互換契約のみ）
│       │   └── stores/          ← VectorStore / SessionStore Protocol + factory
│       ├── tests/
│       │   └── unit/            ← 移植元の全既存テスト（緑を維持）
│       ├── Dockerfile
│       └── pyproject.toml       ← [project] + uv workspace メンバー宣言
│
├── services/
│   └── agent/                   ← ★ 取り込み（変更なし・uv workspace に含めない）
│
├── packages/
│   ├── schemas/ agents/ config/ db/ tools/ rag/ evals/  ← ★ 取り込み（変更なし）
│   └── api-types/               ← P0 では作成しない（実体は P2）
│       └── generated/           ← P0 は .gitignore 非対象であることのみ担保（REQ-4.3）
│
├── .github/workflows/           ← ★ 取り込み（eval-pr.yml / eval-nightly.yml 変更なし）
├── .githooks/                   ← ★ 取り込み後に pre-commit を拡張
└── scripts/                     ← ★ 取り込み（forbid-model-ids.sh 存在確認）
```

### 2.2 タスクパイプライン（`turbo.json`）

```
codegen
   │
   ├──▶ typecheck  (dependsOn: codegen, check)   ← TS: tsc --noEmit
   │        └──▶ check (Python: check:ty = uv run ... ty check)
   └──▶ build      (dependsOn: ^build, codegen)  ← Python では未登録

lint ── (独立、キャッシュ可)   TS: biome check / Python: lint:ruff = uv run ... ruff check
test ── (dependsOn: ^build)    TS: vitest run   / Python: uv run ... pytest
test:e2e ── (dependsOn: build, cache: false)
evals ── (cache: false)
```

P0 で動く最小セット: **`lint` / `typecheck`（→ `check`）/ `test`**。`codegen` / `test:e2e` / `evals` はパイプライン定義を置くが、P0 時点では実行されるタスクが空またはスキップでよい。

Python 側のタスク名は turbo が自動登録する `lint:ruff` / `check:ty` / `test` であり、**`typecheck` は Python では存在しない**。`typecheck` から `check` への `dependsOn` が両言語を 1 コマンドに合流させる唯一の接点である（§3.1.6）。

### 2.3 uv workspace 構造

> **⚠️ ADR-P0-05 必須（spec v1.6 §12 R14）**: uv workspace は lock を 1 つに束ねるため、`apps/agent-api`（litellm 経由 openai 2.54.0）と `services/agent`（openai 3.3.1）を**同一 workspace に入れたままでは** §2.6.3 の二層バージョン方針を満たせない。**P0 着手前に ADR-P0-05 で「`apps/agent-api` を workspace メンバーに含めるか」を決定すること。** 既定の解は (a)「`apps/agent-api` を含めない」— この場合 §2.3 の `[tool.uv.workspace]` は `apps/agent-api` を除外し、ADR-P0-03 の `services/agent` 除外と合わせて Python アプリ 2 件とも workspace 外となる。

```toml
# pyproject.toml（ルート）
[tool.turbo]
name = "vaz-agentic-ai-next"   # turbo の Python サポートの必須項目（§3.1.3 / §3.1.6 実測 1）

[tool.uv.workspace]
# ADR-P0-05 候補 (a) 採用: apps/agent-api は uv workspace に含めない（独自 uv.lock を持つ）。
# P0 時点での members は空。将来 packages/py-* を追加するときにここへ列挙する。
members = [
    # 将来追加:
    # "packages/py-agents",
    # "packages/py-schemas",
    # "packages/py-evals",
    # "packages/py-knowledge",
]
```

`apps/agent-api` は独自 `uv.lock`（`cd apps/agent-api && uv lock`）を持ち、Turborepo の Python 管理外となる（ADR-P0-05 候補 (a)）。`services/agent` も独自 lock を持ち、ワークスペースには含めない（ADR-P0-03）。

**`uv.lock` は turbo の起動要件でもある**: 不在の場合 turbo は `uv.lock is required for Python workspaces.` で全タスクを拒否する（§3.1.6 実測 2）。したがって turbo による検証は `uv lock` の完了後（T-2.3 以降）にのみ成立する。

---

## 3. コンポーネント設計

### 3.1 ルートファイル群（Req 1.x）

#### 3.1.1 `mise.toml`

**責務**: 開発ツールチェインのバージョン固定とタスクの `turbo`/`mise` 二重化。

**公開インターフェース**:
- `[tools]` セクション: `node = "24"`, `python = "3.13"`, `pnpm = "11.24.x"`, `uv = "0.12.x"`, `turbo = "2.10.11"`
  - **`turbo` は完全固定（`=`）。`>=` や `~=` は使わない**（REQ-1.1 / REQ-6.1 の等値検証と矛盾するため）
- `[tasks]` セクション: `turbo` を呼ぶ wrapper タスク（退避経路：`turbo` なしでも `mise run test:py` 等で動ける状態）

**所有しないもの**: パッケージ依存の宣言（pyproject.toml / package.json の責務）。

#### 3.1.2 `turbo.json`

**責務**: タスクパイプライン定義と Python workspace 機能の有効化。

**公開インターフェース**:
```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "futureFlags": { "experimentalPythonWorkspaces": true },
  "tasks": {
    "build":     { "dependsOn": ["^build", "codegen"], "outputs": ["dist/**", ".next/**"] },
    "codegen":   { "outputs": ["packages/api-types/generated/**"] },
    "lint":      {},
    "check":     {},
    "typecheck": { "dependsOn": ["codegen", "check"] },
    "test":      { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "test:e2e":  { "dependsOn": ["build"], "cache": false },
    "evals":     { "cache": false, "env": ["LLM_API_KEY", "ANTHROPIC_API_KEY", "LOGFIRE_TOKEN"] }
  }
}
```

**`check` タスクと `typecheck.dependsOn` の設計理由**: turbo の Python サポートが型検査に用いるタスク名は **`check`**（`check:ty` を集約）であり、`typecheck` ではない。`typecheck` のみを実行すると Python 側は `<NONEXISTENT>` として **何も実行せず成功する**（§3.1.6 の実測 3）。TS 側の既存スクリプト名 `typecheck` は変更しない（REQ-4.1 の「取り込み資産を変更しない」制約）ため、`typecheck` が `check` に `dependsOn` することで両言語を 1 コマンドに合流させる（設計原則 5）。

**所有しないもの**: 各パッケージのタスク実装 — TS 側は各 `package.json` の `scripts`、Python 側は turbo が `[dependency-groups]` から自動登録する（§3.1.6）。`pyproject.toml` にタスク実装を書く必要はない。

#### 3.1.3 ルート `pyproject.toml`

**責務**: uv workspace の宣言（依存の解決エントリポイント）と、turbo がワークスペースルートパッケージを識別するための名前の提供。

**公開インターフェース**:

```toml
[tool.turbo]
# turbo が uv ワークスペースルートをパッケージとして扱うために必須。
# 未宣言だと turbo は "The uv workspace has no name." で失敗する（§3.1.6 実測 1）。
# `<name>#check` 形式のタスク ID と `--filter=<name>` の解決に使われる。
name = "vaz-agentic-ai-next"

[tool.uv.workspace]
# ADR-P0-05 候補 (a): apps/agent-api は uv workspace に含めない（独自 uv.lock を持つ）。
# P0 時点では members は空配列。将来 packages/py-* が実体を持ったときに追加する。
members = []
```

- `[tool.turbo] name` は **turbo の Python サポートの必須項目**（REQ-1.4）。ルート `pyproject.toml` に `[project] name` を置く方法もあるが、ルートは配布物ではないため `[tool.turbo] name` を採る。
- `members` に実体のないパスを含めない（`uv lock` が失敗する）。ADR-P0-05 候補 (a) により `apps/agent-api` は含めない（§5 ADR-P0-05）。したがって P0 時点での `members` は空配列であり、**ルート `pyproject.toml` 作成時点（T-1.3）でも `uv lock` は空の workspace として成立する**（§10 R-P0-08 の注記とは異なり、空 workspace の `uv lock` は `apps/agent-api` の配置を待たずに実行可能）。

**所有しないもの**: 個別パッケージの依存宣言（各メンバー `pyproject.toml` の責務）。Python タスクの実装（turbo が自動登録する — §3.1.6）。

#### 3.1.4 `pnpm-workspace.yaml`

**責務**: TS ワークスペースのメンバー宣言とサプライチェーン設定の維持。

**公開インターフェース**:
```yaml
packages:
  - 'apps/web'
  - 'apps/worker'
  - 'packages/*'
minimumReleaseAge: 1440  # 公開 24h 未満を除外
allowBuilds:             # 既存エントリ（監査理由コメント付き）を維持
  # 変更例: @carbon/*: false  # テレメトリのみ。プリビルドバイナリ不使用
```

`apps/agent-api` は Python パッケージのため `packages:` には含めない。

**ルート `package.json` の前提**: turbo は `packageManager` または `devEngines.packageManager` フィールドを要求する（未宣言だと `Could not resolve workspace. Missing devEngines.packageManager or legacy packageManager field in package.json` で **turbo 全体が起動しない**）。取り込んだルート `package.json` にこのフィールドが存在し、`mise.toml` の `pnpm` ピンと矛盾しないことを T-0.2 で確認する。

**所有しないもの**: Python 依存の管理（`pyproject.toml` / `uv.lock` の責務）。

#### 3.1.5 `.gitignore` のポリグロット対応（Req 1.8）

**責務**: **本リポジトリの現行 `.gitignore`**（GitHub の Python テンプレート由来 + エージェント用ディレクトリ節）をポリグロット monorepo に対応させる。

> **前提**: 現行 `.gitignore` は Python テンプレート由来であり、Node 系エントリを**欠いている**。**上流 `vaz-ai-next` の `.gitignore` は取り込まない**（T-0.2 の `_Boundary:_` から除外する）。上書き取り込みを行うと現行の「Coding agent directories」節（`.bob/` / `.claude/` / `.sdd/` / `.serena/`）が失われ、`.sdd/` 配下のレビュー成果物が追跡対象に混入する。

**実測した現状**（2026-08-29、`git check-ignore -v`）:

| パス | 現状 | 要件 |
| :--- | :--- | :--- |
| `packages/api-types/generated/x.ts` | 非マッチ | 非マッチのまま維持（REQ-4.3） |
| `apps/web/AGENTS.md` | 非マッチ | 非マッチのまま維持（REQ-8.1） |
| `apps/web/lib/x.ts` | **`.gitignore:17:lib/` にマッチ（違反）** | 非マッチへ修正（REQ-1.8） |
| `node_modules/x` | **非マッチ（未記載・違反）** | 無視対象へ追加（REQ-1.8） |
| `.next/x` | **非マッチ（未記載・違反）** | 無視対象へ追加（REQ-1.8） |

**必須変更内容**:

| 種別 | 対応 |
| :--- | :--- |
| `node_modules/` / `.next/` / `.turbo/` / `coverage/` | 無視対象に**追加する**（実測で未記載を確認済み） |
| `lib/` / `build/` / `dist/` / `var/` / `parts/` 等のパス非固定パターン | 先頭 `/` でルート限定または明示パスに変更（`lib/` が実際に `apps/web/lib/` を巻き込むことを実測済み） |
| `.bob/` / `.claude/` / `.sdd/` / `.serena/` | 無視対象のまま**維持する**（削除しないこと） |
| `packages/api-types/generated/` / `apps/web/AGENTS.md` / `apps/web/lib/` | 無視対象に**含めない**（差分レビュー対象・生成物コミット規約） |
| `specs/memory/` / `specs/001-*/` | 無視対象に**含めない**。憲章 v1.1.0 の正本（`specs/memory/constitution.md`）がここに置かれる（第 7 回 H4） |

**検証コマンド**（REQ-1.8 の機械アサート対象 — **5 件**）:
```bash
git check-ignore -v packages/api-types/generated/x.ts   # 終了コード 1（マッチなし）が正解
git check-ignore -v apps/web/AGENTS.md                   # 終了コード 1（マッチなし）が正解
git check-ignore -v apps/web/lib/x.ts                    # 終了コード 1（マッチなし）が正解
git check-ignore -q .sdd/reviews/x.md                    # 終了コード 0（マッチ）が正解 = 追跡外の作業領域
git check-ignore -v specs/memory/constitution.md         # 終了コード 1（マッチなし）が正解 = 憲章の正本
```

> **`.sdd/` を無視したまま憲章を追跡する方法（第 7 回 H4 の決定）**: `.sdd/` 配下を例外化するのではなく、**憲章の正本を `specs/memory/constitution.md` に移設した**。`.sdd/reviews/` は追跡外の作業領域として残す（永続性を保証しない）。

**所有しないもの**: 各パッケージ固有の無視設定（各パッケージ内の `.gitignore` の責務）。

#### 3.1.6 Python パッケージのタスク宣言（Req 1.2 / 2.7 / 7.x）

**責務**: `turbo run lint` / `check` / `test` が `apps/agent-api` の `ruff` / `ty` / `pytest` を起動する経路の確定。**P0 の唯一の機械的受け入れ条件がこの経路の上に乗る**ため、推測ではなく `turbo@2.10.11` 実物での実測に基づいて確定した。

**結論: `pyproject.toml` にタスク実装を書く必要はない。turbo が `[dependency-groups]` の宣言から自動登録する。**

**自動登録されるタスクと解決されるコマンド**（実測値）:

| turbo タスク | 登録の引き金 | 解決されるコマンド（`--filter=agent-api` 時） |
| :--- | :--- | :--- |
| `lint` → `lint:ruff` | `[dependency-groups] dev` の `ruff` | `uv run --frozen --package agent-api ruff check apps/agent-api` |
| `check` → `check:ty` | 同 `ty` | `uv run --frozen --package agent-api ty check apps/agent-api` |
| `test` | 同 `pytest` | `uv run --frozen --package agent-api pytest apps/agent-api` |
| `format:ruff` | 同 `ruff` | `uv run --frozen --package agent-api ruff format apps/agent-api`（**`--check` は付かない = 破壊的**） |
| `build` | — | Python パッケージには登録されない（0 件） |
| `typecheck` | — | **`<NONEXISTENT>`（何も実行せず成功する）** |

フィルタなしの実行では、ワークスペースルートパッケージに `<root-name>#lint:ruff` = `uv run --frozen --all-packages ruff check ...` として集約登録される。

**必要条件**（いずれか 1 つでも欠けると Python タスクが消える / turbo が起動しない）:

1. ルート `pyproject.toml` に `[tool.uv.workspace]` **と `[tool.turbo] name`**（§3.1.3）
2. **ルート `uv.lock` の存在** — 無いと turbo は `uv.lock is required for Python workspaces. Run 'uv lock' and commit the result.` で全タスクが起動しない（REQ-1.7 の裏付け）
3. ルート `package.json` の `packageManager` / `devEngines.packageManager`（§3.1.4）
4. **`apps/agent-api/pyproject.toml` の `[dependency-groups] dev` に `ruff` / `ty` / `pytest` が宣言され、`uv.lock` に解決されていること**（REQ-2.7）

**実測記録**（`turbo@2.10.11` / macOS arm64 / 2026-08-29）:

- **実測 1**: ルート `pyproject.toml` に `[tool.turbo] name` が無い場合 → `The uv workspace has no name. ... Set a valid name in the root pyproject.toml under [tool.turbo] name.`
- **実測 2**: `uv.lock` 不在 → `uv.lock is required for Python workspaces.` で `turbo ls` すら失敗
- **実測 3**: `turbo run typecheck --filter=agent-api --dry=json` → タスク 2 件・**両方 `<NONEXISTENT>`**（`typecheck` は Python 側で未定義。**件数 > 0 のためゼロ件ガードは通過する** → §7.5 のガード再設計の根拠）
- **実測 4**: `[dependency-groups] dev` から `ruff` / `ty` / `pytest` を外すと → `lint` は **0 件**、`test` は `<NONEXISTENT>`、`check` は `uv check --frozen --package=agent-api`（lock 整合チェックであって型検査ではない）に退化する
- **実測 5**: ツール設定ファイル（`ruff.toml` / `ty.toml` / `pytest.ini` / `conftest.py`）の有無は登録に**影響しない**。引き金は `[dependency-groups]` の宣言のみ
- **実測 6**（第 7 回で**削除**）: 旧記述は「TS パッケージと併存させた `turbo run lint` で `@vaz/schemas#lint = biome check .` と `<root>#lint:ruff` の両方がスケジュールされる（REQ-7.1 の成立を確認）」だった。**この結論は無効である。** 当該実測は `lint` スクリプトを持つ**合成**の `@vaz/schemas` を用いていたが、上流の実 TS パッケージ 9 件はいずれも `lint` / `test` を持たない（`typecheck` のみ）。実リポジトリでの帰結は §3.1.6a に記す（憲章 原則 8: 誤りが判明した記述は訂正ではなく削除し、実測結果で置き換える）
- **実測 7**（第 7 回 / 調査 15）: `--filter=agent-api` 付きの `check` は **`agent-api#check:ty` に解決される**（ルートには集約されない）。親タスク `lint` / `check` の `command` は `<AGGREGATE>` であり `startswith("uv run")` 判定が正しく除外する。`typecheck` は `dependsOn: ["codegen","check"]` により `uv run …ty check` に到達する（REQ-7.2 の成立を実測で確認）
- **実測 8**（第 7 回 / 調査 15）: §7.5 のガードスクリプトの終了コードは 3 状態で確認済み — 正常 = **0** / `ruff` 除去 = **1** / `uv.lock` 退避（turbo ハードエラー）= **1**

#### 3.1.6a turbo はルート `package.json` の `scripts` を解決しない（第 7 回 N1 / 調査 17）

**実測結果**: `[tool.turbo] name` を宣言すると、ワークスペースルートは Python（uv）ルートパッケージとして扱われ、**ルート `package.json` の `scripts` は一切解決されない**。ルートの `name` を `[tool.turbo] name` と一致させても同じである（両方を実測）。

| ルート `package.json` の `name` | `turbo run test` のルートタスク |
| :--- | :--- |
| `[tool.turbo] name` と不一致 | `<root>#test` = **`<NONEXISTENT>`** |
| `[tool.turbo] name` と一致 | `<root>#test` = **`<NONEXISTENT>`** |

`turbo ls` はルートを常に `[tool.turbo] name` の値で列挙する（`package.json` の `name` は無視される）。

**上流の実態と帰結**: 上流の TS パッケージ 9 件（`apps/web` / `apps/worker` / `packages/{agents,config,db,evals,rag,schemas,tools}`）は **`typecheck` のみ**を持ち、`lint` / `test` を持たない。TS の lint / test はルート集約スクリプト（`biome check .` / `vitest run`、ルート単一の `biome.json` / `vitest.config.ts` でリポジトリ全体を走査）にしか存在しない。したがって:

| turbo コマンド | TS 側 | Python 側 |
| :--- | :--- | :--- |
| `turbo run lint` | **0 件（Biome は走らない）** | `agent-api#lint:ruff` ✅ |
| `turbo run test` | **0 件（Vitest は走らない）** | `agent-api#test` ✅ |
| `turbo run typecheck` | 9 パッケージ ✅ | `dependsOn` 経由で `check:ty` ✅ |

**設計判断**: TS のルート集約レーンは **turbo の外の独立ステップ**（CI ステップ + `mise` タスク）として実行する。`ruff format --check` で確立済みの前例と同じ扱いである。

**9 パッケージに `lint` / `test` を新設する案を採らない理由**: `biome check .` と `vitest run` はルート単一設定でリポジトリ全体を走査する設計であり、パッケージ単位に分割するとルート直下のファイル（設定 `.ts` 等）が走査対象から漏れ、`vitest.config.ts` を 9 個に複製する必要が生じる。加えて REQ-4.1 が要求する「取り込み資産を変更しない」制約とも整合しない。

**この分離が生む新たな偽陰性**: TS レーンが turbo の外に出ると、REQ-7.5 のガード（`uv run` で始まるコマンドを数える）は TS 側を守らない。`biome.json` / `vitest.config.ts` の取り込み漏れが**沈黙して通過する**ため、**対称のガード（REQ-7.6）を §7.5a に置く**。

**`ruff format --check` の扱い**: turbo の `format:ruff` は `--check` を付けないため CI で使うと**ファイルを書き換える**。REQ-7.1 が要求する書式検査は turbo の自動タスクでは満たせないので、`mise` タスク（`mise run lint:format`）と CI の独立ステップ（`uv run --frozen --package agent-api ruff format --check apps/agent-api`）で担保する（§8.1）。

**所有しないもの**: TS 側のタスク実装（各 `package.json` の `scripts`）。

---

### 3.2 `apps/agent-api`（Req 2.x）

**責務**: Pydantic AI v2 エージェント API（ステートフル）。チャット・ガードレール・セッション所有権を担う。移植後の動作は `fastapi-pydantic-ai-agent@d4d5f8d` と同等。

**境界**（所有しないもの）:
- RAG 評価・Docling パースは `services/agent`（ステートレスサイドカー）の責務
- pgvector への書き込みは `packages/rag` の責務（single-writer 原則）
- P0 では `/v1/chat` の新設は行わない（P3）

#### 3.2.1 `apps/agent-api/pyproject.toml`

**依存宣言**（SPEC §2.2 / §2.6.3 準拠）:

```toml
[project]
name = "agent-api"
version = "0.1.0"
requires-python = ">=3.13"
dependencies = [
    # litellm 層: openai extra を要求しない（§2.6.3）
    "pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0",
    "pydantic-ai-litellm>=0.2.3,<0.3.0",
    # fastapi / starlette は上限ピン維持（§2.5-1 / §2.5-2）
    "fastapi>=0.135.1,<0.137",
    "starlette>=0.52.1,<1.0",
    "slowapi>=0.1.9,<1.0",
    # その他は移植元 lock に準拠
    "uvicorn[standard]>=0.30",
    "llama-index-core>=0.14.24,<1.0",
    "pydantic-logfire>=4.41",
    "pydantic>=2.13",
    "httpx>=0.27",
    "chromadb<1.0",  # §2.5-6: HttpClient 未使用のため CVE 到達不能
]
```

**開発依存**（`ruff` / `ty` / `pytest` の 3 件は **turbo の Python タスク自動登録の必要条件**でもある。削ると `turbo run lint` が 0 件で成功する — §3.1.6 実測 4 / REQ-2.7）:
```toml
[dependency-groups]
dev = [
    "pytest>=8",        # turbo: test        → uv run ... pytest
    "pytest-asyncio>=0.23",
    "ruff",             # turbo: lint:ruff   → uv run ... ruff check
    "ty",               # turbo: check:ty    → uv run ... ty check
    "pip-audit",
]
```

**`litellm` の解決版の担保方法**: `litellm` は `pydantic-ai-litellm` 経由の推移依存であり、`dependencies` に下限を宣言していない。REQ-2.3（1.98.0 以上に解決すること）は **宣言ではなく (1) コミット済み `uv.lock` + CI の `--frozen`、(2) `uv.lock` をパースするアサートテスト（§7.6）、(3) 後退した場合に CVE 11 件を検出する `audit` ジョブ（§8.2 / R-P0-03）** の 3 段で担保する。明示的な下限ピンを置かない理由は、`openai` を明示ピンしない方針（ADR-P0-02）と同じく解決器に衝突解決を委ねるためである。

#### 3.2.2 `apps/agent-api` 内の変更範囲

P0 での変更は以下 **2 点のみ**。それ以外は移植元の `d4d5f8d` をそのまま取り込む。

| 変更点 | 内容 |
| :--- | :--- |
| **uv workspace 化** | `pyproject.toml` にルートから `path = "."` 形式ではなく、ルートの `[tool.uv.workspace]` で `apps/agent-api` を列挙する方式を採用。`apps/agent-api` 自身の `pyproject.toml` は uv workspace メンバーとして有効な宣言を持つ |
| **`openai` extra の除去確認** | 移植元は既に `openai` extra を要求しないが、コピー時に誤って追加しないよう `pyproject.toml` を明示チェック |

**既存テスト**（`tests/unit/` 全体）は移植後も全通過を維持すること（Req 2.6）。

**移植前確認チェックリスト**（コードレビュー時に目視確認すること）:
- `d4d5f8d` の `app/api/v1/router.py` が `prefix="/v1"` を自身に持たず、`app/main.py` の `app.include_router(v1_router, prefix="/v1")` で付与される構造であること（AGENTS.md ルート登録ルールへの適合確認）

---

### 3.3 バージョン方針の二層化（Req 3.x）

**責務**: `apps/agent-api`（litellm 層）と `services/agent`（非 litellm 層）の lock 解決結果が仕様通りであることの保証。

| 層 | パッケージ | `pydantic-ai-slim` 期待解決 | openai 期待解決 |
| :--- | :--- | :--- | :--- |
| litellm 層 | `apps/agent-api` | **2.35.x**（`openai` extra なし） | **2.54.0**（litellm の `<3.0.0` に従属） |
| 非 litellm 層 | `services/agent` | **2.33.x** | 3.3.1 |

**`services/agent` lock の確認コマンド**（PR 本文添付用）:

```bash
# services/agent は独立した uv プロジェクト（ルート uv workspace のメンバーではない: ADR-P0-03）
# 形式は agent-api 側と同一に統一する（pip-audit -r <uv.lock> は不成立: uv.lock は TOML であり
# requirements 形式ではない）
cd services/agent && uv export --frozen --no-dev | pip-audit -r /dev/stdin
```

> **形式の統一（第 3 回 /sdd-analyze）**: 旧記述の `pip-audit --requirement uv.lock` は成立しないため削除した。`pip-audit` の呼び出しは **`uv export --frozen --no-dev [--package <name>] | pip-audit -r /dev/stdin` の 1 形式のみ**をリポジトリ全体で使う（設計原則 5）。ルート workspace 側は `--package agent-api` を付けて対象を限定する（将来 `packages/py-*` を追加したときに監査対象が意図せず膨らまないため）。
>
> **lock 形式は実測で確定済み（第 7 回 C2 / 調査 16-3）**: `git ls-tree cf72583 -- services/agent/` により **`services/agent/uv.lock` の実在を確認した**（リポジトリ全体の lock は `pnpm-lock.yaml` と `services/agent/uv.lock` の 2 件のみ）。上記コマンドがそのまま成立する。第 6 回で導入した 4 パターン分岐（`requirements.txt` / `poetry.lock` / lock なし）は**いずれも成立しないため削除した**。とくに「REQ-3.1 を P0 スコープ外へ格下げする」選択肢は憲章 原則 10 の「受け入れ基準の事後緩和を禁ずる」に違反するため撤回する。**tasks 側に未決を持ち込まない。**

**PR 添付義務**: 両 lock に対する `pip-audit` 生出力をそのまま PR 本文に貼る。「監査は通った」という要約は不可（§2.6.5）。

---

### 3.4 パッケージ命名規約の確定（Req 4.x）

**責務**: ポリグロット monorepo でのパッケージ名の衝突防止規約を `pyproject.toml` 宣言に反映する。

**規約**（所有しないもの: 実体のないディレクトリは P0 では作成しない）:

| ディレクトリ名 | 言語 | P0 時点の状態 | 理由 |
| :--- | :--- | :--- | :--- |
| `packages/schemas` | TS | 既存・変更なし | TS Zod スキーマ |
| `packages/evals` | TS | 既存・変更なし | TS evals |
| `packages/agents` | TS | 既存・変更なし | TS エージェント |
| `packages/api-types/generated/` | TS（生成物）| **P0 では作成しない**（実体は P2 の codegen パイプライン展開で作成）。P0 は `.gitignore` の非対象であることのみ担保する | 差分レビュー対象 |
| `packages/py-agents` | Python | uv workspace 宣言のみ（実体なし） | `packages/agents` と衝突するため `py-` 必須 |
| `packages/py-schemas` | Python | uv workspace 宣言のみ（実体なし）| `packages/schemas` と衝突 |
| `packages/py-evals` | Python | uv workspace 宣言のみ（実体なし） | `packages/evals` と衝突 |
| `packages/py-knowledge` | Python | uv workspace 宣言のみ（実体なし） | 一貫性のため `py-` 付与 |

ルート `pyproject.toml` の `[tool.uv.workspace]` の `members` は将来の `packages/py-*` パスをコメントアウト済みで記載し、P0 時点での追加が容易な形にする。

---

### 3.5 `AGENTS.md` / `CLAUDE.md` の整合（Req 5.x）

**責務**: D1〜D3 は `/sdd-analyze` の実測で**既に解消済み**と判明したため、回帰確認（v1.2 の記述が再導入されていないことの grep アサート）に格下げされた。D4 は `git add` + commit の作業。D5 は新規検出の修正（REQ-5.6）。

**作業内容**:

| 変更点 | ファイル | 種別 | 内容 |
| :--- | :--- | :--- | :--- |
| D1 回帰確認 | `AGENTS.md` | **grep アサート** | `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` であり、`openai` extra と明示 `openai` ピンが**ない**こと（Req 5.1） |
| D2 回帰確認 | `AGENTS.md` | **grep アサート** | 「フロアを ≥2.32 に上げると litellm が 1.83.0 へ後退する」という文字列が**ない**こと（Req 5.2） |
| D3 回帰確認 | `CLAUDE.md` | **grep アサート** | D1 と同内容（Req 5.3） |
| D4 解消 | `AGENTS.md` / `CLAUDE.md` / `specs/` | **git add** | `git ls-files` に 3 者が現れること。記述変更は不要（`CLAUDE.md` は既に追跡対象と記述済み）（Req 5.4） |
| D5 修正 | `AGENTS.md` | **編集** | ツールチェーン記述を `uv = "0.12.x"` / `pnpm = "11.24.x"` に更新し、`mise.toml`（REQ-1.1）と一致させる（Req 5.6） |

**変更単位制約**: `AGENTS.md` と `CLAUDE.md` は **1 つの commit で同時に変更する**こと（Req 5.5）。D5 の修正をこの commit に含める。

---

### 3.6 `turbo-version-check` CI ジョブ（Req 6.x）

**責務**: `turbo --version` の出力が `mise.toml` のピンと一致することを CI で機械的に保証する。

**設計**:

```yaml
# .github/workflows/ci.yml （抜粋）
jobs:
  turbo-version-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<40-char-SHA>
      - uses: jdx/mise-action@<40-char-SHA>
      - run: |
          # TOML パーサまたは mise 自身のクエリで期待値を取得する
          # grep ベースは [tasks] セクションに同名キーがある場合に誤マッチするため禁止
          EXPECTED=$(mise config get tools.turbo)
          ACTUAL=$(turbo --version)
          if [ "$ACTUAL" != "$EXPECTED" ]; then
            echo "ERROR: turbo version mismatch: expected=$EXPECTED, got=$ACTUAL"
            echo "Run 'mise install' to install the pinned version."
            exit 1
          fi
```

> **実装注意**: `grep '^turbo\s*='` は `[tasks]` セクションに `turbo = "..."` のような行が現れた場合に誤マッチする。`mise config get tools.turbo` または Python/Node の TOML パーサを使い `[tools].turbo` の値のみを抽出すること（REQ-6.1）。

**ブロッキング**: このジョブが失敗した場合、他のジョブはマージ不可（required status check）。

**ローカル検知**: `mise` の `turbo` ピンと `PATH` 上の turbo が食い違う場合、`mise install` コマンドで正しいバージョンに切り替えるよう pre-commit フックまたは `mise run check-versions` タスクで案内する。`mise run check-versions` は版が不一致のとき非 0 で終了すること（REQ-6.3）。

---

### 3.7 `turbo run lint test` 両言語通過（Req 7.x）

**責務**: P0 最終受け入れ条件として、TS / Python の lint / typecheck / test が `turbo run lint test` 単一コマンドで通ること。

**各言語の実行コマンド**（第 7 回 N1 / §3.1.6a の実測により再設計）:

| レーン | 実行主体 | コマンド |
| :--- | :--- | :--- |
| Python lint | **turbo** | `turbo run lint` → `agent-api#lint:ruff` = `uv run --frozen --package agent-api ruff check apps/agent-api` |
| Python 書式 | **turbo 外** | `uv run --frozen --package agent-api ruff format --check apps/agent-api`（= `mise run lint:format`）。`format:ruff` は `--check` を付けず破壊的 |
| Python typecheck | **turbo** | `turbo run typecheck` → `dependsOn: ["codegen","check"]` 経由で `check:ty` = `uv run … ty check` |
| Python test | **turbo** | `turbo run test` → `agent-api#test` = `uv run --frozen --package agent-api pytest apps/agent-api` |
| TS typecheck | **turbo** | `turbo run typecheck` → 9 パッケージの `tsc --noEmit`（各 `package.json` の `typecheck`） |
| **TS lint** | **turbo 外** | `biome check .`（ルート `package.json` の `lint` / `mise run lint`）— **turbo はルートの `scripts` を解決しないため `turbo run lint` では走らない**（§3.1.6a） |
| **TS test** | **turbo 外** | `vitest run`（ルート `package.json` の **`test:run`** / `mise run test:run`）— 同上。**ルートの `test` は `vitest` = watch モードなので使わない** |

> **`turbo run lint test` という単一コマンドでは P0 の受け入れ条件を満たせない。** 満たすのは
> `turbo run lint typecheck test` ＋ TS 側 2 ステップ ＋ Python 書式 1 ステップの合計であり、
> その全体を `mise run check-all`（wrapper）と CI の各ステップに束ねる。両言語が 1 コマンドで通るのは
> **`turbo run typecheck` のみ**である。

**Python テストの hermetic 設定**（Req 7.4）:
- `apps/agent-api/tests/conftest.py` にて `models.ALLOW_MODEL_REQUESTS = False` をグローバル設定
- `tests/support/hermetic.py` の `block_network()` を autouse fixture として `tests/unit/` 全体に適用

---

### 3.8 ツール生成ファイルのコミット管理（Req 8.x）

**責務**: `apps/web/AGENTS.md`（`next dev` 自動生成）が `.gitignore` されずコミット対象であることの保証。

> **P0 時点での前提確認**: 本リポジトリには現時点で `apps/web/` が存在しない（現状は specs/ のみ）。`apps/web/` は `vaz-ai-next@cf72583` の内容を取り込む作業（P0 の `apps/web` 移行タスク）が完了して初めて存在する。したがって **Req 8.1 / 8.2 の受け入れ確認は `apps/web/` が実際に配置された後に行う**。`apps/web/` が存在しない状態で下記フックを有効化しても「常にパス」になるため、tasks にて `apps/web/` 移行タスクの完了を Req 8.x 確認の前提条件として明記すること。

**pre-commit フック設計**（`.githooks/pre-commit` への追加項目）:
```bash
# ツール生成ファイルの未コミット残留を検知
# apps/web/ が存在しない場合はエラーで終了（「常にパス」を防ぐ）
if [ ! -d "apps/web" ]; then
  echo "ERROR: apps/web/ not found. Has T-0 (base monorepo import) been completed?"
  exit 1
fi
# git status --porcelain の書式は XY（X=index / Y=worktree）。
#   '??' = 未追跡（next dev が生成し git add されていない） → 失格
#   '^.[^ ]' = worktree 側に未ステージ変更あり（' M' / 'MM' 等）  → 失格
#   'M ' / 'A ' = ステージ済み（これからコミットされる正常系）      → 合格
STATUS=$(git status --porcelain apps/web/AGENTS.md)
if printf '%s\n' "$STATUS" | grep -qE '^\?\?|^.[^ ]'; then
  echo "ERROR: apps/web/AGENTS.md is untracked or has unstaged changes."
  echo "       'git add apps/web/AGENTS.md' before committing (next dev regenerates it)."
  exit 1
fi
```

> **設計変更理由 1（第 2 回）**: 旧設計（`if [ -d "apps/web" ]; then ... fi`）では `apps/web/` が不在のとき**無言でパス**していた。REQ-8.2 は「対象不在を検知して警告すること」を要件とするため、不在時は `exit 1` に変更した。T-0 完了前にこのフックが有効化された場合にフェイルファストする設計。
>
> **設計変更理由 2（第 3 回・実測により判定を反転）**: 中間版の `grep -q '^[^?]'` は判定対象を取り違えていた。一時リポジトリでの実測結果は次のとおり:
>
> | `apps/web/AGENTS.md` の状態 | `--porcelain` | 旧 `'^[^?]'` | 新 `'^\?\?\|^.[^ ]'` | 期待 |
> | :--- | :--- | :--- | :--- | :--- |
> | 未追跡（生成され `git add` されていない）| `??` | **通過** | 失格 | 失格 |
> | ステージ済み（これからコミット）| `M ` / `A ` | **失格** | 通過 | 通過 |
> | 未ステージ変更（真の残留）| ` M` | 失格 | 失格 | 失格 |
>
> `'^[^?]'` は `?` 以外の先頭文字にマッチするため、**REQ-8.2 が検知したい主ケース（未追跡）だけを除外し、残留ではないステージ済みを失格にしていた**。`next dev` は起動ごとに `apps/web/AGENTS.md` を再生成するため、旧式ではこのファイルを含む以後のコミットが恒常的にブロックされる。
>
> **受け入れ確認は 3 状態すべてで行う**（正常系で 0 になることの確認を含む — T-5.4）。

**注意**: `apps/web/` 起点でのパス解決（`node_modules/next` がルートから見えない場合がある）。Biome の lint 対象外に明示的に置く場合は `biome.json` の `ignore` に追加する。

**single-path 制約（REQ-10.3）**: このフックは `.githooks/pre-commit` を唯一の入口とする。`pre-commit` フレームワーク（`.pre-commit-config.yaml`）を使用する場合も、`.githooks/pre-commit` から `pre-commit run` を呼び出す形に統一し、同一検査が複数機構に重複実装されないこと。

---

### 3.9 CI パイプラインの基本ゲート（Req 9.x）

**責務**: P0 時点で稼働すべき CI ジョブの最小セットの定義と実装。

> **前提の訂正（第 7 回 N2 / 調査 16-4）**: 旧記述は「`ci.yml` に 4 ジョブを集約し、不在なら T-5.0 で新規作成する」前提だったが、**上流 `cf72583` に `ci.yml` は存在しない**。`.github/workflows/` の実体は 6 ファイルであり、**lint / test / Python / セキュリティ監査はすでに独立 workflow として稼働している**:
>
> | ファイル | 想定される責務 |
> | :--- | :--- |
> | `lint.yml` | TS lint / typecheck |
> | `tests.yml` | TS unit test |
> | `python.yml` | Python 側（`services/agent` 想定） |
> | `security-daily.yml` | 依存監査 |
> | `eval-pr.yml` / `eval-nightly.yml` | evals（P0 変更禁止 — REQ-0.4） |
>
> したがって `ci.yml` を新規作成することは既存の稼働中パイプラインと**並行する第 2 の CI 経路を作る**行為であり、**憲章 原則 5（既存の単一経路に合流させる）に違反する**。**P0 は既存 workflow へ合流させる。**

**合流方針（Req 9.1）**:

| 検査 | 合流先 | P0 での作業 |
| :--- | :--- | :--- |
| TS lint（`biome check .` + §7.5a ガード） | `lint.yml` | 既存ジョブに §7.5a のガードステップを追加 |
| Python lint（`turbo run lint` + `ruff format --check`） | `lint.yml` または `python.yml` | Python ステップを追加 |
| typecheck（`turbo run typecheck`） | `lint.yml` | 既存 typecheck を turbo 経由に切り替える（両言語が 1 コマンドで通る唯一のタスク — §3.7） |
| TS unit test（`vitest run` + 収集件数ガード） | `tests.yml` | ガードステップを追加 |
| Python unit test（`turbo run test` + §7.5 ガード） | `tests.yml` または `python.yml` | Python ステップ + ガードを追加 |
| `turbo-version-check` | `lint.yml` に**新規ジョブ**として追加 | §3.6 の設計 |
| `audit`（`pnpm audit` + `pip-audit`） | `security-daily.yml` | `pip-audit` ステップを追加（§8.2） |

**T-5.0 が最初に行うこと**: 実在する 6 workflow の `jobs` と各 `steps` を YAML パースで**棚卸し**し、上表の各検査が「どのファイルのどのジョブに存在するか / 存在しないか」を記録する。**不足分のみ**を既存ファイルへ追加する。既存の検査を別ファイルに重複実装した状態を不合格とする（原則 5）。

> **job_id の制約（第 7 回 H3）**: GitHub Actions の `job_id` は先頭が英字または `_`、以降は英数字 / `-` / `_` のみで **`:` を含められない**。旧 §8.1 は `jobs:` 直下に `test:unit:` と書いていたが、**この workflow はパース時に拒否される**。job_id は **`test-unit`** とし、表示名が必要なら `name: test:unit` を併記する。REQ-9.1 のアサートは **job_id の厳密な集合**に対して行い、「または同等の名前」のような曖昧な判定を使わない（曖昧では「不在を沈黙して通過させない」目的が達成できない）。

**`uses:` SHA ピン確認**: 新規追加するジョブのステップも 40 桁 SHA でピンする。**`test_ci_workflows.py` は `fastapi-pydantic-ai-agent` の資産であり `vaz-ai-next` には存在しない（spec v1.6 §10.2 訂正）**。P0 でこのテストを移植しなければ、SHA ピン漏れは自動検出されない。移植は P0 スコープの新規作業として明示する（R-P0-13 も参照）。走査対象ファイル数 > 0 のアサートは REQ-9.3。

> **`permissions:` の最小権限宣言（spec v1.6 §10.2 追加規約）**: P0 で新規追加・変更する CI ジョブには `permissions:` ブロックを明示する。`vaz-ai-next` の既存 6 workflow はすべて `permissions:` 未宣言（すなわちデフォルト write-all）であり、P0 で追加するステップがこの状態を踏襲しないよう注意する。最低限 `contents: read` を宣言し、必要なものだけ広げる。

---

### 3.10 モデル ID ハードコード禁止の展開（Req 10.x）

**責務**: 既存の `forbid-model-ids.sh` / pygrep を `apps/agent-api` まで適用範囲を拡張する。pre-commit の単一経路制約（REQ-10.3）に従い、重複実装を排除する。

**設計**:
- `apps/agent-api/app/config/settings.py`（または相当ファイル）の `llm_model` が `os.environ` / `pydantic-settings` で解決されていること（REQ-10.2）
- 許可リストは `packages/config/src/model-allowlist.ts` に一元化（Req 0.3 で確認済み）
- `scripts/forbid-model-ids.sh` が `.py` ファイルも走査することを確認（既存の動作維持）
- pygrep `no-hardcoded-model-id` フックは `.pre-commit-config.yaml` で宣言するが、`.githooks/pre-commit` から `pre-commit run` 経由でのみ呼び出される（REQ-10.3 の単一経路制約）

**REQ-10.3 の単一経路設計**:
- `.githooks/pre-commit` = 唯一の入口
- `pre-commit` フレームワーク、`forbid-model-ids.sh`、turbo バージョンチェックは、すべてここから呼び出すことで重複実装を排除する
- 同一の検査が `.githooks/pre-commit` と CI の両方に別々に実装される場合は、CI 側は「フックの再実行」ではなく「CI 固有のアサート」（`uv export | pip-audit` 等）として分離すること

---

## 4. インターフェース定義

### 4.1 turbo タスクの入出力

P0 のタスクは既存の枠組みを踏襲するため、新規の型定義インターフェースはない。turbo タスクの入力（inputs）/ 出力（outputs）キャッシュキーを以下に定義する。

| タスク | パッケージ | inputs（省略時は自動） | outputs |
| :--- | :--- | :--- | :--- |
| `lint` | `agent-api` | `**/*.py`, `pyproject.toml`, `uv.lock` | — |
| `typecheck` | `agent-api` | `**/*.py`, `pyproject.toml`, `uv.lock` | — |
| `test` | `agent-api` | `**/*.py`, `pyproject.toml`, `uv.lock` | `coverage/**` |

### 4.2 `apps/agent-api` 維持エンドポイント

P0 後も以下エンドポイントが同等のレスポンスを返すこと（移植前後の動作同一性）:

| エンドポイント | メソッド | レスポンス形式 |
| :--- | :--- | :--- |
| `/health` | GET | `{"status": "ok"}` |
| `/health/ready` | GET | `{"status": "ready"}` または `503` |
| `/v1/agent/chat` | POST | JSON レスポンス（移植元と同等） |
| `/v1/agent/stream` | POST | SSE（独自 5 イベント形式、移植元と同等） |

**注意**: `/v1/chat`（Vercel AI Data Stream Protocol）は P3 で新設。P0 では存在しない。

### 4.3 uv workspace メンバー宣言インターフェース

ルート `pyproject.toml` が満たすべき制約:

```toml
[tool.turbo]
name = "vaz-agentic-ai-next"   # 必須（未宣言だと turbo が起動しない）

[tool.uv.workspace]
# ADR-P0-05 候補 (a): apps/agent-api は uv workspace に含めない（独自 uv.lock を持つ）
# P0 時点では members は空。将来 packages/py-* が実体を持ったときに追加する。
members = [
    # "packages/py-agents",
    # "packages/py-schemas",
    # "packages/py-evals",
    # "packages/py-knowledge",
]
```

`apps/agent-api/pyproject.toml` が以下を満たすこと:
- `[project]` テーブルに `name` / `version` / `requires-python = ">=3.13"` が存在する
- `pydantic-ai-slim` に `openai` extra が**含まれていない**
- `[dependency-groups] dev` に `ruff` / `ty` / `pytest` が含まれる（turbo のタスク自動登録の必要条件 — REQ-2.7）

---

## 5. 技術決定事項 (ADR)

### ADR-P0-01: `futureFlags.experimentalPythonWorkspaces` を有効化して開始する

**決定**: `turbo.json` に `futureFlags.experimentalPythonWorkspaces: true` を設定する。

**根拠**: clarification Q3 の回答（spec.md §Clarifications）。

**リスク**: フラグ名・挙動が将来変更される可能性（§12 R2）。

**対策**: Python 側は `mise` タスクを常に維持し、`turbo` を外しても開発できる状態を保つ。`turbo-version-check` によるバージョン不一致の機械検知。

---

### ADR-P0-02: `apps/agent-api` は `openai` extra なしで依存を宣言する

**決定**: `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0`（`openai` extra なし）。`openai` は明示ピンなし。

**根拠**: clarification Q2 の回答。§2.6.3 の実測 B（`fastapi-pydantic-ai-agent@d4d5f8d`）で slim 2.35.3 / litellm 1.98.0 / openai 2.54.0 に解決し `pip-audit` クリーンであることが実証済み。

**撤去条件**: litellm が `openai>=3` を宣言するリリースを出した時点で `openai` extra を再度要求してよい。その時点で §2.6.2 の再測定（`uv pip compile` + `pip-audit`）を行う。

---

### ADR-P0-03: `services/agent` を uv workspace に含めない

**決定**: `services/agent` はルート `pyproject.toml` の `[tool.uv.workspace]` メンバーに含めない。

**根拠**: §3.2（ステートレスサイドカーとステートフルエージェント API の責務分離）。`services/agent` が litellm を持たないことで slim 2.33 系に到達できており（§2.6）、workspace に含めると lock 解決に干渉する可能性がある。

**制約**: `services/agent` と `apps/agent-api` を統合する変更は §12 R5 により禁止。

---

### ADR-P0-04: `AGENTS.md` / `CLAUDE.md` を 1 コミット単位として同時修正する

**決定**: D1〜D4 の修正は `AGENTS.md` と `CLAUDE.md` を同一 commit に含める。

**根拠**: spec.md §5（要件 5.5）。`AGENTS.md` と `CLAUDE.md` は「1 変更単位」として扱う規約（spec-agenticai-core.md §3.4）。

---

### ADR-P0-05: uv workspace のメンバー構成 — 候補 (a) で確定

> **spec v1.6 §12 R14 対応。ADR-P0-01（Turborepo Python 対応有効化）および ADR-P0-03（`services/agent` 除外）と不可分。**

**決定**: **候補 (a) — `apps/agent-api` を uv workspace のメンバーに含めない。**

**根拠**:
- uv workspace は全メンバーを 1 つの `uv.lock` に束ねる。`apps/agent-api` は litellm 経由で openai 2.54.0 に制約され、`services/agent` は openai 3.3.1 を要求する。単一 lock でこれらを両立させると §2.6.2 実測 A に記録した失敗（litellm 1.83.0 後退 + CVE 11 件）が再現する（spec v1.6 §12 R14）。
- 候補 (b)（含める）は上記の理由により採らない。

**採用した構成**:
- ルート `pyproject.toml` の `[tool.uv.workspace].members` は将来の `packages/py-*` のみを列挙する。P0 時点では `members` は空配列。
- `apps/agent-api` は独自 `uv.lock`（`cd apps/agent-api && uv lock`）を持ち、Turborepo の Python 管理外となる。
- Python タスクは `mise` 直接実行（退避経路 — ADR-P0-01 と連動）で運用する。`turbo run lint` 等は `apps/agent-api` を対象に解決しない（`members` に含まれないため）。
- `apps/agent-api` の `pip-audit` は `cd apps/agent-api && uv export --frozen --no-dev | pip-audit -r /dev/stdin` で実行する（`--package agent-api` 形式は uv workspace メンバーでなければ機能しない）。

**§2.3 / §4.3 / §8.4 への影響（この決定により確定）**:
- §2.3 の `[tool.uv.workspace]` コード例の `"apps/agent-api"` 行は**除外**（コメントアウト状態で将来の `py-*` のみを示す）
- §4.3 の `members = ["apps/agent-api"]` は `members = []`（または将来の `py-*` のコメントのみ）に変更
- §8.4 の `apps/agent-api` の `pip-audit` 呼び出し形式は `cd apps/agent-api && uv export --frozen --no-dev | pip-audit -r /dev/stdin` に変更（`--package agent-api` は workspace メンバー向け）

---

## 6. ファイル構造計画

> P0 フェーズで新規作成・変更する全ファイルのリスト。各ファイルの責務を 1 文で示す。★ = T-0 で vaz-ai-next@cf72583 から取り込む（取り込み後に変更する場合は [MOD] も付く）。

### T-0: 取り込みによって追加される資産

| ファイル / ディレクトリ | 責務 |
| :--- | :--- |
| `apps/web/` | Next.js 16.3 フロントエンド（P3 で拡張） |
| `apps/worker/` | バックグラウンドワーカー（変更なし） |
| `packages/` | TS パッケージ群（7 パッケージ、変更なし） |
| `services/agent/` | ステートレス Python サイドカー（変更なし） |
| `.github/workflows/` | CI ワークフロー（`ci.yml` は T-5 で拡張） |
| `.githooks/` | pre-commit フック群（T-5/T-6 で拡張） |
| `scripts/` | ユーティリティスクリプト群（`forbid-model-ids.sh` を含む） |
| `pnpm-workspace.yaml` | pnpm ワークスペース設定（T-1.4 で補完） |
| `pnpm-lock.yaml` | pnpm ロックファイル（コミット対象のまま維持） |
| `package.json`（ルート）| pnpm ワークスペースのルート manifest（**`packageManager` を `pnpm@11.24.0` へ更新 — 取り込み時点は `11.19.0`**） |
| **`mise.toml`** | **上流に実在（`[tools]` / `[hooks]` + 19 タスク）。T-1.1 で `[tools]` を更新しタスクを追加するが、既存タスク（とくに `lint:model-ids`）を削除しない** |
| **`biome.json`** | **TS lint の設定実体。取り込まないと REQ-7.1 の TS レーンが成立しない** |
| **`vitest.config.ts`** | **TS test の設定実体。取り込まないと REQ-7.3 の TS レーンが成立しない** |

> **取り込まないもの（明示的除外）**: `.gitignore`（現行の agent ディレクトリ節を保全 — T-1.5 が修正を担当）、`AGENTS.md` / `CLAUDE.md`（本リポジトリの現行版が v1.5 準拠であり上書きすると REQ-5.1〜5.3 の回帰確認が壊れる）、`specs/`（本リポジトリの `specs/001-agentic-ai-core-p0/` と衝突する）。

### T-1〜T-9: P0 で新規作成するファイル

| ファイル | 責務 |
| :--- | :--- |
| `mise.toml` | 開発ツールチェイン（Node / Python / pnpm / uv / turbo）のバージョンを機械的に完全固定する |
| `turbo.json` | Turborepo タスクパイプラインを定義し `experimentalPythonWorkspaces` を有効化する |
| `pyproject.toml`（ルート）| `[tool.turbo] name` と uv workspace メンバーを宣言し、Python 全体の lock 解決エントリポイントとなる |
| `uv.lock` | Python 依存の決定論的なロック（`--frozen-lockfile` 強制の対象。turbo の Python サポートの起動要件でもある） |
| `apps/agent-api/tests/unit/test_repo_conventions.py` | リポジトリ規約アサートテスト（§7.6：REQ-0.4/1.1/1.2/1.3/1.8/2.2/2.3/2.7/4.1/5.1〜5.3/5.6 の検証実体） |
| `specs/001-agentic-ai-core-p0/import-baseline.json` | T-0.2 が生成する取り込み直後のスナップショット（`package.json` の `name` 一覧と対象 workflow の blob hash）。REQ-0.4 / 4.1 の比較基準。スキーマは §6.1 参照 |
| `apps/agent-api/`（全体）| `fastapi-pydantic-ai-agent@d4d5f8d` を移植した FastAPI アプリ（内部構造は移植元と同等） |
| `apps/agent-api/pyproject.toml` | uv workspace メンバーとしての宣言と `openai` extra なし依存を保持する |
| `apps/web/AGENTS.md` | `next dev` が自動生成する Next.js エージェント向けルール（コミット対象） |
| `docs/PROVENANCE.md`（または `README.md` 追記）| 取り込み元の出所（リポジトリ URL + コミット SHA）を記録する（REQ-0.6） |
| `scripts/check-python-tasks.sh` | §7.5 の Python 側ゼロ件ガード（3 状態で実効性確認済み） |
| **`scripts/check-ts-lanes.sh`** | **§7.5a の TS 側ゼロ件ガード（Biome 走査件数 / Vitest 収集件数 > 0）— REQ-7.6** |
| **`scripts/record-coverage-baseline.sh`** | **両言語の分岐カバレッジを測定し `coverage-baseline.json` に記録する（REQ-7.7・P0 はブロックしない）** |
| **`specs/001-agentic-ai-core-p0/coverage-baseline.json`** | **憲章 `TODO(BRANCH_COVERAGE_THRESHOLD)` が P0 に割り当てた実測ベースライン（REQ-7.7）** |
| **`specs/memory/constitution.md`**（済・移設）| **憲章 v1.1.0 の正本。`.sdd/memory/` から移設した（追跡対象にするため）** |

### T-1〜T-8: P0 で変更するファイル

| ファイル | 変更内容 | 要件 |
| :--- | :--- | :--- |
| `AGENTS.md` | D4: `git add` 後の状態を確認 / D5: uv・pnpm バージョン記述を `mise.toml` と一致させる | 5.4 / 5.6 |
| `CLAUDE.md` | D4: `git add` 後の状態を確認（1 commit 単位） | 5.4 / 5.5 |
| `pnpm-workspace.yaml` | 取り込み後に `minimumReleaseAge: 1440` / `allowBuilds` コメントを確認・補完 | 1.5 / 1.6 |
| `.gitignore` | ポリグロット対応（Node エントリ追加・パス非固定パターンのルート限定化）、**5 件**の `git check-ignore` 検証 | 1.8 |
| `.github/workflows/ci.yml` | `lint` / `test:unit` の存在確認（不在なら新規作成）＋ `turbo-version-check` / `audit` ジョブを追加（40 桁 SHA ピン） | 6.1 / 9.1 / 9.2 |
| `.githooks/pre-commit` | ツール生成ファイル残留チェック（`apps/web/AGENTS.md`）+ モデル ID ゲートを `apps/agent-api` に適用（単一経路制約） | 8.2 / 10.1 / 10.3 |

### 6.1 `import-baseline.json` スキーマ

T-0.2 が生成するスナップショットファイルのスキーマ。T-9.1 のアサートテストはこのフィールド名でパースする。

```json
{
  "generated_at": "2026-08-29T12:34:56Z",
  "upstream_pin": {
    "repo": "git@github.com:Fukuchan77/vaz-ai-next.git",
    "commit": "cf72583"
  },
  "package_names": {
    "apps/web": "@vaz/web",
    "apps/worker": "@vaz/worker",
    "packages/schemas": "@vaz/schemas",
    "packages/agents": "@vaz/agents",
    "packages/config": "@vaz/config",
    "packages/db": "@vaz/db",
    "packages/tools": "@vaz/tools",
    "packages/rag": "@vaz/rag",
    "packages/evals": "@vaz/evals"
  },
  "workflow_hashes": {
    ".github/workflows/eval-pr.yml": "<40-char-sha>",
    ".github/workflows/eval-nightly.yml": "<40-char-sha>"
  }
}
```

- `package_names`: REQ-4.1 の比較基準。キーはディレクトリ名（リポジトリルート相対）、値は `package.json` の `name` フィールド。**上記は例示であり、T-0.2 では静的に埋めるのではなく `git ls-files 'apps/*/package.json' 'packages/*/package.json'` で動的に取り込み後の実在パッケージを列挙してから生成すること**（存在しないパッケージが baseline に含まれると T-9.1 のアサートが誤って失格する）
- `workflow_hashes`: REQ-0.4 の比較基準。`git hash-object <path>` の出力（SHA-1 blob hash）。T-9.1 でテスト実行時に `subprocess.run(["git", "hash-object", path])` で取得した現在値と照合する

---

## 7. テスト設計

### 7.1 P0 スコープのテスト層

P0 では **Unit 層のみ**をスコープとする。Integration / E2E / Evals は P2 以降。

### 7.2 Python Unit テスト（移植元の維持）

**場所**: `apps/agent-api/tests/unit/`

**内容**: `fastapi-pydantic-ai-agent@d4d5f8d` の全既存テストを移植する。**移植対象の機能に対する**追加テストは書かない（P0 は「動作維持の移植」であり、新規テストは追加機能の証拠になるため）。

> **例外（第 3 回 /sdd-analyze / REQ 指定）**: spec.md が `[検証: 機械（… アサートテスト）]` と明記した要件（REQ-1.1 / 1.2 / 1.3 / 2.2 / 2.3 / 2.7 / 4.1 / 5.1 / 5.2 / 5.3 / 5.6）は、**リポジトリ規約アサートテストとして §7.6 に置く**。これは「移植機能のテスト」ではなくリポジトリ構成の回帰防止であり、上記の「追加テストは書かない」方針の対象外である。特に REQ-5.1〜5.3 は v1.2 時代の記述が再導入されないことの**回帰テスト**であり、手動 `grep` では次回の改変を検知できないため、テストの実体が要件そのものである。

**hermetic 設定**（Req 7.4）:

```python
# apps/agent-api/tests/conftest.py
import pytest
from pydantic_ai import models
from tests.support.hermetic import block_network

models.ALLOW_MODEL_REQUESTS = False  # グローバル: 実 LLM 呼び出しを不可にする


@pytest.fixture(autouse=True)
def _hermetic(block_network):
    """tests/unit/ 全体にソケットレベルのネットワーク遮断を適用する。"""
    yield
```

**モデル ID ハードコードテスト**:

```python
# apps/agent-api/tests/unit/test_no_hardcoded_model_ids.py
# 移植元の fastapi-pydantic-ai-agent にて実装済み。そのまま移植する。
```

### 7.3 TS Unit テスト（既存維持）

`apps/web` / `packages/*` の既存 Vitest テストに変更なし。P0 では新規 TS テストは追加しない。

### 7.4 turbo-version-check の検証 / `uses:` SHA ピン

> **訂正（spec v1.6 §10.2）**: `test_ci_workflows.py` は `fastapi-pydantic-ai-agent` の資産であり、`vaz-ai-next` には**存在しない**。「既存テストが自動でカバーする」という旧記述は誤りであり削除する。

P0 では `test_ci_workflows.py` を `fastapi-pydantic-ai-agent@d4d5f8d` から移植し、本リポジトリの `.github/workflows/` を走査対象に設定したうえで、全 `uses:` の 40 桁 SHA ピンを機械検証する。この移植は P0 の新規作業として tasks に追加する（§6 T-9.x）。

> **走査範囲の注意（REQ-9.3）**: 移植後の `test_ci_workflows.py` が `.github/workflows/` を解決する際のパスをリポジトリルート基準（`../../.github/workflows/` 等の相対パス）で指定していると、P0 で追加した新規ジョブが走査対象から漏れる可能性がある。テストファイルの走査対象ディレクトリと収集件数 > 0 のアサートを確認すること（REQ-9.3）。

### 7.5 Python タスクのゼロ件偽陰性ガード（Req 7.5）

**目的**: `turbo run lint / typecheck / test` の各実行で Python パッケージのタスクが**実コマンド付きで** 1 件以上スケジュールされることを確認する。`experimentalPythonWorkspaces` の設定ミス、`[dependency-groups]` の宣言漏れ、タスク名の不一致により Python 側が黙って除外されたまま「緑」になる偽陰性を排除する。

**旧実装が機能しない理由（実測）**: `jq '.tasks | length'` による件数判定では検知できない。`turbo run typecheck --filter=agent-api --dry=json` は**タスク 2 件を返すが両方 `command: "<NONEXISTENT>"`** であり（§3.1.6 実測 3）、件数ガードは通過する一方で Python は何も実行されない。さらに turbo がエラー終了した場合 `COUNT` が空文字列になり、`[ "" -eq 0 ]` は終了コード 2 を返して条件が偽と評価されるため `exit 1` に到達しない（`set -e` も未指定）。**ガード自身が偽陰性を作る。**

**実装（判定を「実コマンドの有無」に変更）**:
```bash
#!/usr/bin/env bash
set -euo pipefail

# turbo が Python 側に解決した実コマンドは必ず "uv run " で始まる（§3.1.6 実測）。
# <AGGREGATE> / <NONEXISTENT> は実行を伴わないため数に入れない。
for task in lint check test; do
  COUNT=$(turbo run "$task" --filter=agent-api --dry=json \
            | jq '[.tasks[] | select(.command | startswith("uv run"))] | length' \
            || echo 0)
  if [ "${COUNT:-0}" -lt 1 ]; then
    echo "ERROR: 'turbo run $task --filter=agent-api' resolves no 'uv run' command."
    echo "       Check: root [tool.turbo] name / uv.lock / [dependency-groups] dev (ruff, ty, pytest)."
    exit 1
  fi
done

# typecheck は TS 側の名前。Python は check 経由で到達することを確認する（§3.1.2）
turbo run typecheck --filter=agent-api --dry=json \
  | jq -e '[.tasks[] | select(.command | startswith("uv run"))] | length >= 1' > /dev/null \
  || { echo "ERROR: 'turbo run typecheck' does not reach the Python 'check:ty' task."; exit 1; }
```

- 走査するタスク名は **`lint` / `check` / `test`**（`typecheck` は Python 側では未定義 — §3.1.6）。
- `|| echo 0` と `${COUNT:-0}` で turbo のエラー終了時も必ず失格側に倒れる。

> **`check` タスクの集約先は実測で確定した（第 7 回 H2 / 調査 15）**: 第 6 回の注記は「`check:ty` が `agent-api` スコープに解決されるかルートに集約されるかは turbo の実装に依存する」と未決を残していたが、`turbo@2.10.11` 実物での実測により **`--filter=agent-api` 付きで `agent-api#check:ty` = `uv run --frozen --package agent-api ty check apps/agent-api` に解決される**ことを確認した（ルートには集約されない）。**§3.1.6 の実測表が正しく、第 6 回の注記は誤りだったため削除した。** 上記スクリプトの `--filter=agent-api` はそのまま使える。実装中に判定形を決める余地はない。

**3 状態での実効性確認済み**（調査 15 / このスクリプトをそのまま実行）:

| 状態 | 終了コード |
| :--- | :--- |
| 正常（`ruff` / `ty` / `pytest` すべて宣言） | **0** |
| `[dependency-groups] dev` から `ruff` を除去 | **1** |
| ルート `uv.lock` を退避（turbo がハードエラー） | **1** |

**配置**: T-2.6（移植直後の単体検証）と T-8.1（全体検証）で実行し、CI の `test-unit` ジョブに含める。

### 7.5a TS 側のゼロ件偽陰性ガード（Req 7.6 / 第 7 回 N1）

**目的**: TS の lint / test は turbo の外の独立ステップになったため（§3.1.6a）、§7.5 のガード（`uv run` を数える）では守られない。`biome.json` / `vitest.config.ts` の取り込み漏れや `ignore` 設定ミスにより **0 件走査 / 0 件収集で緑になる**経路を塞ぐ。Python 側と対称の防御を置く。

**実装**:
```bash
#!/usr/bin/env bash
set -euo pipefail

# Biome: 走査対象ファイル数 > 0
BIOME_JSON=$(pnpm exec biome check --reporter=json . 2>/dev/null || echo '{}')
BIOME_FILES=$(printf '%s' "$BIOME_JSON" | jq '[.. | .filePath? // empty] | unique | length' 2>/dev/null || echo 0)
if [ "${BIOME_FILES:-0}" -lt 1 ]; then
  echo "ERROR: 'biome check .' scanned 0 files. Check that biome.json was imported (REQ-0.2)."
  exit 1
fi

# Vitest: 収集テスト件数 > 0
pnpm exec vitest run --reporter=json --outputFile=/tmp/vitest-report.json >/dev/null 2>&1 || true
VITEST_TESTS=$(jq '.numTotalTests // 0' /tmp/vitest-report.json 2>/dev/null || echo 0)
if [ "${VITEST_TESTS:-0}" -lt 1 ]; then
  echo "ERROR: 'vitest run' collected 0 tests. Check that vitest.config.ts was imported (REQ-0.2)."
  exit 1
fi
echo "OK: biome scanned $BIOME_FILES file(s); vitest collected $VITEST_TESTS test(s)"
```

> **レポータ出力キーの実測が必要**: 上記の `--reporter=json` の出力形状（Biome の `filePath` / Vitest の `numTotalTests`）は **`@biomejs/biome` 2.5.x / `vitest` 4.1.x 実物で確認してから確定すること**（T-8.1a）。取り込み前の本リポジトリには両ツールが存在しないため現時点では未実測である。**キー名が違えば `|| echo 0` により必ず失格側へ倒れる**ため、ガードが偽陰性になることはない（偽陽性で落ちるだけであり、その場合はキー名を実測して修正する）。

**配置**: `scripts/check-ts-lanes.sh` として実装し、T-8.1a と CI の `lint` / `test-unit` の各ジョブに含める。

### 7.6 リポジトリ規約アサートテスト（Req **0.4 / 0.7** / 1.1 / 1.2 / 1.3 / **1.4 / 1.8** / 2.2 / 2.3 / 2.7 / 4.1 / 5.1〜5.3 / 5.6 — **16 要件**）

**責務**: spec.md が `[検証: 機械（… アサートテスト）]` と指定した要件の検証実体。**単一のテストモジュールに集約する**（設計原則 5：検査の入口を分散させない）。

**配置**: `apps/agent-api/tests/unit/test_repo_conventions.py`

**この配置を選ぶ理由**:
- 移植元に `test_ci_workflows.py` / `test_no_hardcoded_model_ids.py` という**リポジトリルートを走査する既存テストの前例**があり、そこへ合流させられる（新しい経路を作らない）。
- turbo はパッケージ単位で `test` を走らせるため、どのパッケージにも属さないルート直下のテストは `turbo run test` から漏れる。`apps/agent-api` に置けば `agent-api#test`（`uv run ... pytest`）で必ず実行される。
- Python 側に置くことで TS 側の `vitest` 構成（取り込み資産・変更しない）に手を入れずに済む。

**パス解決の注意**: リポジトリルートは `Path(__file__).resolve().parents[3]` 等で解決し、**解決したルートに `mise.toml` が存在することをテスト冒頭でアサートする**（`test_ci_workflows.py` と同じ REQ-9.3 の注意点。ルートを取り違えたテストは対象 0 件で緑になる）。

**アサート内容**:

| 要件 | アサート |
| :--- | :--- |
| 0.4 | `import-baseline.json` の `workflow_hashes` と `git hash-object .github/workflows/eval-pr.yml` / `eval-nightly.yml` の現在値が一致すること（`subprocess.run(["git", "hash-object", path])` で取得） |
| **0.7** | ルート `package.json` に `packageManager` または `devEngines.packageManager` が存在し、`mise.toml` の `pnpm` ピンとメジャー・マイナーが一致すること（**取り込み時点の `pnpm@11.19.0` のままなら FAIL する** — 第 7 回 M1 で本表に追加） |
| 1.1 | `mise.toml` を TOML パースし `[tools]` の `node` / `python` / `pnpm` / `uv` / `turbo` の値。`turbo` は完全固定文字列（`>=` / `~=` / `x` を含まないこと）。**加えて `import-baseline.json` に記録した上流の `[tasks]` キー集合が現在の `mise.toml` に 1 件も欠落せず含まれること**（第 7 回 N3 / R-P0-10） |
| **1.4** | ルート `pyproject.toml` に `[tool.turbo] name` が存在し非空であること。`[tool.uv.workspace].members` に `"apps/agent-api"` が含まれ、実体のないパスを含まないこと |
| 1.2 | `turbo.json` を JSON パースし `$schema` / `futureFlags.experimentalPythonWorkspaces == true` / 7 タスク + `check` の定義存在 |
| 1.3 | `turbo.json` の `tasks.typecheck.dependsOn` に `"codegen"` と `"check"` の両方が含まれること |
| 1.8 | `subprocess.run(["git", "check-ignore", path])` で **5 件**の終了コードをアサート: `packages/api-types/generated/x.ts` → 1 / `apps/web/AGENTS.md` → 1 / `apps/web/lib/x.ts` → 1 / `.sdd/reviews/x.md` → **0** / **`specs/memory/constitution.md` → 1** |
| 2.2 | `apps/agent-api/pyproject.toml` の `dependencies` に `pydantic-ai-slim[...]` があり、その extra リストに `openai` が**無い**こと。`openai` の明示ピン行が無いこと。`pydantic-ai-litellm>=0.2.3,<0.3.0` が含まれること（`<1.0` 誤り検知） |
| 2.3 | ルート `uv.lock` をパースし `pydantic-ai-slim >= 2.35`、`litellm >= 1.98.0` |
| 2.7 | `apps/agent-api/pyproject.toml` の `[dependency-groups] dev` に `ruff` / `ty` / `pytest` が含まれること |
| 4.1 | `specs/001-agentic-ai-core-p0/import-baseline.json`（T-0.2 が生成）と現在の各 `package.json` の `name` / ディレクトリ名が一致すること |
| 5.1 / 5.2 / 5.3 | `AGENTS.md` / `CLAUDE.md` の文言アサート（v1.2 時代の記述が**無い**ことを含む否定アサート） |
| 5.6 | `mise.toml` の `[tools].uv` / `.pnpm` と `AGENTS.md` の記述の**メジャー・マイナー一致**（比較規則は REQ-5.6 に明文化） |

**ゼロ件偽陰性の排除**: 上記の否定アサート（「〜が無いこと」）は、対象ファイルが読めなかった場合にも成立してしまう。各テストは**ファイルの存在と非空を先にアサート**すること。

---

### 7.7 TDD 適用方針と非空虚性の担保（憲章 原則 9 / 原則 3 — 第 7 回 C1）

**問題**: 憲章 原則 9 は「実装コードは、それを要求する**失敗するテスト**より先に書いてはならない（MUST NOT）」「既に動くコードに合わせて後からテストを書く行為を禁ずる」と定め、原則 3 は「テストは**非空虚**であることが MUST。実装を壊したときに落ちることを確認していないテストは、テストとして数えない」と定める。

しかし §7.6 のアサートテスト群（16 要件の検証実体）は、その対象（`mise.toml` / `turbo.json` / ルート `pyproject.toml` / `.gitignore` / `apps/agent-api/pyproject.toml` / `uv.lock` / `AGENTS.md` / `CLAUDE.md`）が**すべて完成し正しくなった後**に書かれる順序に置かれていた。これは原則 9 が禁じる行為そのものであり、かつ RED を一度も観測しないため原則 3 の非空虚性も担保されない。

**構造的制約**: テストの配置先は `apps/agent-api/tests/unit/` である（§7.6 の根拠: turbo はパッケージ単位で `test` を走らせるため、ルート直下のテストは `turbo run test` から漏れる）。このディレクトリは T-2.1（移植）で初めて出現するため、**T-2.1 より前にテストを書くことは物理的に不可能**である。したがって「完全な test-first」は達成できない。

**採る方針（2 段構え）**:

**(1) 可能な範囲で順序を組み替える** — アサート対象の大半は T-2.1 より**後**に確定する（`uv.lock` は T-2.3、`.gitignore` は T-1.5、`AGENTS.md` は T-4.1）。したがって次の順序で RED → GREEN を成立させる:

```
T-0（取り込み）
  → T-1.1 / T-1.3（mise.toml 追記・ルート pyproject.toml。turbo/uv の起動要件のみ）
  → T-2.1 / T-2.2（移植・依存宣言。tests/unit/ が出現する）
  → T-9.0【新設】アサートテストを RED 状態で書く ★ここで失敗を観測する
  → T-1.2 / T-1.5 / T-2.3 / T-4.1（turbo.json・.gitignore・uv lock・AGENTS.md）= GREEN 化
  → T-9.1 / T-9.2（残りのアサートを追加。各々 RED を観測してから GREEN にする）
  → T-5 / T-6 / T-7 → T-8
```

**(2) 順序で担保できない分は「壊して落ちることを確認する」で代替する** — T-2.1 より前に確定してしまう項目（ルート `pyproject.toml` の `[tool.turbo] name` 等）や、既に正しい状態で取り込まれる項目（`AGENTS.md` の D1〜D3 回帰確認）は RED を先に観測できない。これらは **T-2.6 で既に確立している形式**をそのまま適用する:

> 対象を一時的に壊す → 当該テストが FAIL することを確認する → `git restore` で戻す → `uv lock --check` 等で整合を確認する

この「壊して確認する」手順は **T-9.1 / T-9.2 / T-2.4 の必須作業項目**とする（`[ ]*` の任意項目にしてはならない）。とくに次の 3 群は取り違えが起きやすいため個別に確認する:

| 群 | 壊し方の例 | 期待 |
| :--- | :--- | :--- |
| `git check-ignore` の終了コード 5 件（REQ-1.8） | `.gitignore` に `apps/web/lib/` を一時追加する | 当該アサートのみ FAIL |
| 否定アサート（REQ-2.2 / 5.1 / 5.2） | `pyproject.toml` に `openai` extra を一時追加 / `AGENTS.md` に v1.2 の警告文を一時追記 | 当該アサートのみ FAIL |
| ルート解決（モジュール冒頭の `mise.toml` 存在アサート） | ルート解決の `parents[N]` を一時的に 1 つずらす | **モジュール全体が FAIL**（ルートを取り違えたテストが 0 件で緑になる経路の封鎖） |

**なぜルート解決の確認が要るか**: T-9.1 はルート取り違えの危険を認識して冒頭に `mise.toml` 存在アサートを置くが、**その冒頭アサート自体が空虚でないこと**は誰も確認しない。ここを外すと 16 要件すべてが沈黙して緑になる。

**この方針の位置づけ**: §7.2 の「P0 は動作維持の移植であり追加テストは書かない」の例外条項（既記載）に、本節の 2 条件を**適合条件として**付す。すなわち「§7.6 のアサートテストは例外として書いてよいが、(1) の順序組み替えと (2) の壊して確認する手順を伴わないものは要件を満たさない」。

---

## 8. CI / 品質ゲート設計

### 8.1 P0 で完成する CI ジョブ

**新規 workflow ファイルは作らない。**下記は**既存 `lint.yml` / `tests.yml` / `security-daily.yml` へ追加するジョブ / ステップの具体形**である（§3.9 の合流方針）。すべて required status check とする。

共通の前段ステップ（各ジョブで使用。**`uses:` はすべて 40 桁 SHA でピンする** — REQ-9.3）:

```yaml
# 各ジョブ共通の前段（SHA は導入時に実物から取得して埋める。<...> のまま残してはならない）
steps:
  - uses: actions/checkout@<40-char-SHA>            # actions/checkout v5 系
  - uses: jdx/mise-action@<40-char-SHA>             # mise: node/python/pnpm/uv/turbo を mise.toml から解決
    with:
      version: 2026.8.14
  - run: pnpm install --frozen-lockfile             # REQ-9.4
  - run: uv sync --frozen                           # REQ-9.4（ルートで実行すること — §8.3）
```

`lint.yml` に置くジョブ:

```yaml
jobs:
  lint:                                  # 既存ジョブに Python / ガードのステップを追加する
    runs-on: ubuntu-latest
    steps:
      # …共通の前段…
      - name: TS lint (Biome)            # turbo は走らせない（§3.1.6a）
        run: pnpm exec biome check .
      - name: TS lane zero-count guard   # §7.5a / REQ-7.6
        run: scripts/check-ts-lanes.sh
      - name: Python lint (turbo)
        run: turbo run lint              # → agent-api#lint:ruff
      - name: Python format check        # format:ruff は --check を付けないため独立ステップ（§3.1.6）
        run: uv run --frozen --package agent-api ruff format --check apps/agent-api
      - name: Typecheck (both languages) # 両言語が 1 コマンドで通る唯一のタスク（§3.7）
        run: turbo run typecheck

  turbo-version-check:                   # 新規ジョブ（§3.6）
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@<40-char-SHA>
      - uses: jdx/mise-action@<40-char-SHA>
      - run: |
          EXPECTED=$(mise config get tools.turbo)
          ACTUAL=$(turbo --version)
          [ "$ACTUAL" = "$EXPECTED" ] || { echo "turbo mismatch: expected=$EXPECTED got=$ACTUAL"; exit 1; }
```

`tests.yml` に置くジョブ（**job_id は `test-unit`。`test:unit` は job_id として無効** — §3.9）:

```yaml
jobs:
  test-unit:
    name: "test:unit"                    # 表示名のみコロンを許す
    runs-on: ubuntu-latest
    steps:
      # …共通の前段…
      - name: Python task zero-count guard   # §7.5 / REQ-7.5
        run: scripts/check-python-tasks.sh
      - name: Python unit tests
        run: turbo run test                  # → agent-api#test（収集件数 > 0 は §7.5a と同形式で判定）
      - name: TS unit tests                  # ルートの test は vitest watch なので test:run を使う（§3.7）
        run: pnpm run test:run
      - name: Coverage baseline              # REQ-7.7（P0 は計測と記録のみ・ブロックしない）
        run: scripts/record-coverage-baseline.sh
```

`security-daily.yml` に追加するステップ: §8.2 の `pip-audit`（`pnpm audit` が既存であれば重複実装しない）。

### 8.2 `audit` ジョブの設計

```yaml
audit:
  steps:
    - name: pnpm audit
      run: pnpm audit --audit-level=moderate
    - name: pip-audit (agent-api)
      # pip-audit -r <uv.lock> は不成立: uv.lock は TOML 形式かつ
      # uv workspace ではルート単一 lock のみ存在し apps/agent-api/uv.lock は生成されない
      # uv export --frozen --no-dev でパッケージリストを requirements 形式に変換してから渡す
      run: |
        uv export --frozen --no-dev \
          --package agent-api \
          | pip-audit -r /dev/stdin \
            --ignore-vuln PYSEC-2026-161 \
            --ignore-vuln PYSEC-2026-248 \
            --ignore-vuln PYSEC-2026-2280 \
            --ignore-vuln PYSEC-2026-249 \
            --ignore-vuln PYSEC-2026-2281 \
            --ignore-vuln CVE-2026-45830 \
            --ignore-vuln CVE-2026-45831 \
            --ignore-vuln CVE-2026-45833
      # 到達性根拠（各 advisory ごとに記載 — 一次情報源 §2.5.1 / §2.5.2 の運用規約）:
      # PYSEC-2026-161: starlette — TrustedHostMiddleware を使用しているため閉じている
      # PYSEC-2026-248 / 2280: starlette — HTTPEndpoint 未使用
      # PYSEC-2026-249 / 2281: starlette — request.form() 未使用
      # CVE-2026-45830 / 45831: chromadb — HttpClient 未使用
      # CVE-2026-45833: chromadb — HttpClient 未使用
```

> **実装注意**: `--ignore-vuln` の引数はシェルの行継続（`\`）を正しく記述しないと引数が欠落する。上記形式（パイプで `pip-audit` に渡し、フラグを `pip-audit` のオプションとして渡す）で引数が全件展開されることを確認すること（REQ-9.2）。

### 8.3 ロックファイルの `--frozen-lockfile` 強制

```yaml
- name: pnpm install
  run: pnpm install --frozen-lockfile

- name: uv sync
  run: uv sync --frozen
  # working-directory を apps/agent-api に変えてはならない。
  # uv workspace ではルートに単一の uv.lock があり、ルートで uv sync を実行する必要がある。
  # サブディレクトリから実行すると workspace lock を無視してメンバー単体の lock として扱われる。
  # 対象を限定したい場合は uv sync --frozen --package agent-api をルートで実行する。
```

### 8.4 P0 受け入れ条件の機械検証マップ

| 要件 | 検証手段 |
| :--- | :--- |
| 0.1 cf72583 の解決確認 | `git ls-remote` の終了コードと出力 |
| 0.2 取り込み資産の git 追跡 | `git ls-files` に各パスが 1 件以上現れること |
| 0.3 allowlist / schemas の存在 | `test -f` アサート |
| 0.5 forbid-model-ids.sh の実行可能 | `test -x` アサート |
| **0.7** ルート package.json の packageManager | `packageManager` / `devEngines.packageManager` の存在アサート ＋ `mise.toml` の `pnpm` ピンとのメジャー・マイナー一致アサート（turbo 起動の必要条件・§3.1.4）。**実測: 取り込み時点は `pnpm@11.19.0` で矛盾するため更新を伴う** |
| 0.2 mise.toml / biome.json / vitest.config.ts の取り込み | `git ls-files` ＋ 上流に存在した `mise.toml` の `[tasks]` キーが 1 件も欠落していないことのアサート（第 7 回 N3） |
| 7.6 TS 側ゼロ件ガード | §7.5a のスクリプト（Biome 走査件数 > 0 / Vitest 収集件数 > 0）＋ `biome.json` 一時退避時に非 0 で終了することの確認 |
| 7.7 カバレッジ実測ベースライン | `coverage-baseline.json` が存在し両言語の branch 値が数値で記録されていること（P0 はブロックしない） |
| 1.1 mise.toml の宣言 | §7.6 の TOML パース + 値アサートテスト |
| 1.2 / 1.3 turbo.json | §7.6 の JSON パースアサート + `turbo run lint check test typecheck --dry=json` の終了コード |
| 1.4 [tool.turbo] name / uv workspace | TOML パースアサート + `turbo ls` が root と `agent-api` を列挙すること |
| 2.7 dev グループの ruff / ty / pytest | §7.6 のアサート + §7.5 のゼロ件ガード（実効性） |
| 7.1 / 7.2 / 7.3 turbo 両言語通過 | `turbo run lint` / `typecheck` / `test` の終了コード + §7.5 ガード + `ruff format --check` ステップ |
| 1.7 ロックファイルのコミット | CI の `--frozen-lockfile` が `uv.lock` / `pnpm-lock.yaml` と一致 |
| 1.8 .gitignore ポリグロット対応 | `git check-ignore` の終了コード **5 件**: `packages/api-types/generated/x.ts` → 1 / `apps/web/AGENTS.md` → 1 / `apps/web/lib/x.ts` → 1 / `.sdd/reviews/x.md` → **0**（無視される） / `specs/memory/constitution.md` → 1（憲章 v1.1.0 の正本・第 7 回 H4） |
| 2.3 slim 2.35.x / litellm 1.98.0 | `uv.lock` のパースによるバージョン下限アサート |
| 2.4 pip-audit クリーン | `audit` CI ジョブ（`uv export | pip-audit`） |
| 2.5 既存エンドポイント動作 | `pytest tests/unit` |
| 2.6 turbo run test | `test:unit` CI ジョブ（収集件数 > 0 のアサート込み） |
| 3.1 services/agent lock | lock パースによるバージョンアサート |
| 5.1〜5.3 D1〜D3 回帰確認 | grep アサートテスト |
| 5.4 git 追跡対象 | `git ls-files` に AGENTS.md / CLAUDE.md / specs/ が現れること |
| 5.6 D5 ツールチェーン記述 | `mise.toml` の値と `AGENTS.md` を突き合わせるテスト |
| 5.5 AGENTS.md/CLAUDE.md 同時 commit | `git log --name-only` でコミット確認（目視） |
| 6.1 / 6.2 turbo-version-check | `turbo-version-check` CI ジョブ（`mise config get` ベース） |
| 6.3 ローカル検知 | `mise run check-versions` が不一致時に非 0 で終了すること |
| 7.4 hermetic テスト | `pytest tests/unit` が全通過 |
| 7.5 Python タスクのゼロ件ガード | `turbo run --filter=agent-api --dry=json` の `command` が `'uv run'` で始まるタスクが 1 件以上存在すること（**件数 > 0 は不可** — `<NONEXISTENT>` 2 件でも件数ガードは通過する。§7.5 参照） |
| 9.3 uses: SHA ピン | `test_ci_workflows.py` の**移植**（P0 T-9.x — §7.4 / R-P0-13 参照。移植前は目視確認のみ）（走査対象ファイル数 > 0 のアサート込み） |

---

## 9. 要件トレーサビリティ

| 要件 ID | 要件概要 | 設計コンポーネント |
| :--- | :--- | :--- |
| 0.1 | `cf72583` の解決確認と drift 記録 | §0.1 |
| 0.2 | 母体資産の取り込みと git 追跡 | §0.1 / §6（T-0） |
| 0.3 | `packages/config` / `packages/schemas` の存在確認 | §0.2 |
| 0.4 | `eval-pr.yml` / `eval-nightly.yml` 無変更 | §0.2 / §1.3 |
| 0.5 | `scripts/forbid-model-ids.sh` の実在確認 | §0.2 |
| 0.6 | ライセンス帰属の記録 | §6（T-0 新規ファイル）|
| **0.7** | **ルート `package.json` の `packageManager`（turbo 起動の必要条件・取り込み時点は `pnpm@11.19.0` で要更新）** | **§3.1.4 / §3.1.6** |
| 1.1 | `mise.toml` の `[tools]` 宣言（turbo 完全固定）＋**上流 19 タスクの保全** | §3.1.1 |
| 1.2 | `turbo.json` の `$schema` / `futureFlags` / タスク定義（`check` を含む）| §3.1.2 / §3.1.6 / §7.6 |
| 1.3 | `typecheck` が `codegen` と `check` に `dependsOn` | §3.1.2 / §3.1.6 / §2.2 |
| 1.4 | ルート `pyproject.toml` の `[tool.turbo] name` + uv workspace テーブル | §3.1.3 / §3.1.6 / §4.3 |
| 1.5 | `pnpm-workspace.yaml` の `minimumReleaseAge` / `allowBuilds` / メンバー | §3.1.4 |
| 1.6 | `allowBuilds` の各エントリにコメント | §3.1.4 |
| 1.7 | `uv.lock` / `pnpm-lock.yaml` のコミットと CI `--frozen-lockfile` | §8.3 |
| 1.8 | `.gitignore` のポリグロット対応と **5 件**の `git check-ignore` 検証（`specs/memory/constitution.md` を含む） | §3.1.5 |
| 2.1 | `apps/agent-api/pyproject.toml` の uv workspace メンバー宣言 | §3.2.1 / §4.3 |
| 2.2 | `openai` extra なし依存宣言 | §3.2.1 / ADR-P0-02 |
| 2.3 | slim 2.35.x / litellm 1.98.0 の解決確認 | §3.3 |
| 2.4 | `pip-audit` クリーン（`uv export \| pip-audit`、starlette/chromadb 抑止済み除く） | §8.2 |
| 2.5 | 既存エンドポイントの同等動作 | §4.2 / §7.2 |
| 2.6 | `turbo run test --filter=agent-api` 全通過（収集件数 > 0） | §7.2 / §8.1 |
| 3.1 | `services/agent` lock が slim 2.33.x 維持 | §3.3 |
| 3.2 | 両 lock の `pip-audit` 生出力を PR 添付 | §3.3 |
| 3.3 | ロック更新差分にダウングレードなし | §3.3 |
| 2.7 | dev グループの `ruff` / `ty` / `pytest` 宣言（turbo 自動登録の必要条件）| §3.1.6 / §3.2.1 / §7.6 |
| 4.1 | 既存 TS パッケージ名の変更なし（`import-baseline.json` と比較）| §3.4 / §7.6 |
| 4.2 | 将来の Python パッケージは `py-` 接頭辞（`members` への追加なし） | §3.4 / §4.3 |
| 4.3 | `packages/api-types/generated/` の `.gitignore` 非対象 | §3.1.5 / §3.4 |
| 5.1 | `AGENTS.md` の D1 回帰確認（grep アサート） | §3.5 |
| 5.2 | `AGENTS.md` の D2 回帰確認（grep アサート） | §3.5 |
| 5.3 | `CLAUDE.md` の D3 回帰確認（grep アサート） | §3.5 |
| 5.4 | D4 解消（`git add` + `git ls-files` で確認） | §3.5 |
| 5.5 | 1 commit での同時変更 | ADR-P0-04 |
| 5.6 | `AGENTS.md` ツールチェーン記述を `mise.toml` と一致させる（D5） | §3.5 |
| 6.1 | CI `turbo-version-check` ジョブ（`mise config get` ベース） | §3.6 / §8.1 |
| 6.2 | ブロッキング設定 | §3.6 / §8.1 |
| 6.3 | ローカルでの検知方法（`mise run check-versions` が非 0） | §3.6 |
| 7.1 | lint 両言語通過（Python = turbo / **TS Biome と `ruff format --check` は turbo 外の独立ステップ**）| §3.7 / §3.1.6 / §3.1.6a / §8.1 |
| 7.2 | `turbo run typecheck`（`codegen` + `check` dependsOn 保証込み。**両言語が 1 コマンドで通る唯一のタスク**）| §3.7 / §3.1.2 / §3.1.6 |
| 7.3 | test 両言語通過（Python = turbo / **TS `vitest run` は turbo 外・ルートの `test` は watch なので使わない**）| §3.7 / §3.1.6a |
| 7.4 | `conftest.py` hermetic 設定（**専用テストの非空虚確認込み**）| §7.2 / §7.7 |
| 7.5 | Python タスクの偽陰性ガード（実コマンド解決の有無で判定・3 状態で実効性確認済み）| §7.5 / §3.1.6 |
| **7.6** | **TS 側のゼロ件偽陰性ガード（Biome 走査件数 / Vitest 収集件数 > 0）** | **§7.5a / §3.1.6a** |
| **7.7** | **分岐カバレッジの実測ベースライン記録（P0 はブロックしない）** | **§8.1 / 憲章 TODO(BRANCH_COVERAGE_THRESHOLD)** |
| 8.1 | `apps/web/AGENTS.md` の git 追跡対象 | §3.8 |
| 8.2 | pre-commit の未コミット残留チェック（`apps/web/` 不在時に exit 1） | §3.8 |
| 9.1 | CI 検査の存在とブロッキング（**`ci.yml` は上流に無い。実在 6 workflow へ合流。job_id は `test-unit`**） | §3.9 / §8.1 |
| 9.2 | `audit` ジョブの `uv export \| pip-audit`（引数全件展開確認） | §8.2 |
| 9.3 | `uses:` の 40 桁 SHA ピン（走査ファイル数 > 0 のアサート込み） | §8.4 |
| 9.4 | `--frozen-lockfile` の CI 強制 | §8.3 |
| 10.1 | モデル ID ハードコード検出の monorepo 展開 | §3.10 |
| 10.2 | `apps/agent-api` のモデル ID 環境変数解決 | §3.10 |
| 10.3 | pre-commit 単一経路制約（`.githooks/pre-commit` が唯一の入口） | §3.8 / §3.10 |

---

## 10. リスクと制約

| # | リスク | 影響 | 軽減策 |
| :--- | :--- | :--- | :--- |
| R-P0-00 | `vaz-ai-next@cf72583` が解決できない / アクセス不能になる | T-0 全体がブロックされ 14 件の要件が検証不能 | SSH 到達性を T-0.1 で即時確認し、不解決なら採用ピンを再決定する（Req 0.1） |
| R-P0-00b | `cf72583..main` の差分に破壊的変更が含まれる | P3 以降の拡張時に想定外の衝突が起きる | T-0.1 でコミット数・変更ファイル数を記録し Out of scope 宣言と合わせて PR に明記する |
| R-P0-01 | `experimentalPythonWorkspaces` の挙動変更 | Turborepo 更新時に Python タスクが動かなくなる可能性 | `mise` タスクを退避経路として常に維持。`turbo-version-check` によるバージョン完全固定 |
| R-P0-02 | `uv.lock` が `services/agent` の既存 lock に干渉 | `services/agent` が slim 2.33.x から外れる | `services/agent` を uv workspace に含めない（ADR-P0-03）。PR で lock 解決結果を目視確認 |
| R-P0-03 | `apps/agent-api` 移植時に `openai` extra が誤って追加される | litellm が 1.83.0 へ後退し CVE 11 件が復活 | `audit` CI ジョブで検出（`uv export | pip-audit`）。`pyproject.toml` の `openai` extra 有無を PR レビューで確認 |
| R-P0-04 | `apps/web/AGENTS.md` の Biome lint 失敗 | pre-commit / CI でブロックされる | `biome.json` の `ignore` に明示的に追加するか、Markdown の lint ルールを確認 |
| R-P0-05 | CI の `uses:` SHA ピン漏れ | SHA ピン漏れが検出されず CI がブロックされない | 新規追加ジョブのステップは作成時から 40 桁 SHA を使用する。`test_ci_workflows.py` は `vaz-ai-next` に存在しないため P0 で移植が必要（§7.4）。移植前はレビュー目視のみが検出手段となる（R-P0-13 参照） |
| R-P0-06 | `.gitignore` のパス非固定パターンが `apps/web/lib/` 等を誤って無視する | 正当なソースファイルが git から消える | T-1.5 で 4 件の `git check-ignore` 検証を必須とする（Req 1.8）。**実測で `lib/` が `apps/web/lib/x.ts` を無視することを確認済み**（潜在リスクではなく既在の欠陥） |
| R-P0-07 | turbo の Python タスク語彙（`lint:ruff` / `check:ty` / `format:ruff`）が将来の turbo 更新で変わる | `turbo run lint` / `typecheck` が Python を黙って除外する | 語彙は `mise.toml` の turbo 完全固定 + `turbo-version-check` で凍結。§7.5 のガードが実コマンド解決の有無で失格させる。退避経路として `mise run lint:py` 等を常に維持（ADR-P0-01）|
| R-P0-08 | `uv.lock` 不在・`[tool.turbo] name` 不在・`packageManager` 不在のいずれかで turbo が起動しない | T-1.2 / T-1.3 の時点では turbo による検証が原理的に成立しない（`apps/agent-api` 未配置のため `uv lock` も失敗する）| turbo を用いる検証は T-2.3（`uv lock` 完了）以降に置く。T-1.2 / T-1.3 では静的パース（§7.6）で検証し、turbo 実行による確認は T-2.6 に集約する |
| **R-P0-09** | **TS の lint / test が turbo の外にあることを忘れ、`turbo run lint test` が緑であることを P0 の完了根拠にしてしまう** | TS 側が 1 件も走らないまま P0 完了と誤判定する（実測で成立を確認した欠陥 — 調査 17） | §7.5a のガードを CI の `lint` / `test-unit` に必須ステップとして置く。§3.7 の表を「レーン × 実行主体」形式にして turbo 内外を明示する。`mise run check-all` を単一の入口として両者を束ねる |
| **R-P0-10** | **上流 `mise.toml` の 19 タスクを新規作成で上書きし `lint:model-ids` を失う** | REQ-10.1 のモデル ID ゲートが黙って無効化される | REQ-1.1 に「上流に存在した `[tasks]` キーが 1 件も欠落していないことのアサート」を置く（T-9.1）。T-1.1 を「新規作成」から「保全＋追記」に変更する |
| **R-P0-11** | **`ci.yml` を新規作成して既存 `lint.yml` / `tests.yml` と二重の CI 経路を作る** | 原則 5 違反。片方をすり抜ける変更が成立し、どちらが正かわからなくなる | T-5.0 の最初に実在 6 workflow の棚卸し（YAML パース）を置き、**不足分のみ**を既存ファイルへ追加する。新規 workflow ファイルの作成を禁止する |
| **R-P0-12** | **`test_ci_workflows.py` が `vaz-ai-next` に存在しない（spec v1.6 §10.2 訂正）** | `uses:` の SHA ピン漏れ・`permissions:` 未宣言が自動検出されず、CI セキュリティの回帰が無言で通過する。旧 §7.4 / §3.9 は「既存テストが自動でカバーする」と記述していたが、これは誤りである | P0 の **T-9.x** として `fastapi-pydantic-ai-agent@d4d5f8d` の `test_ci_workflows.py` を `apps/agent-api/tests/unit/test_ci_workflows.py` へ移植する。移植時に走査対象を `vaz-ai-next` の `.github/workflows/` に変更し、走査ファイル数 > 0 のアサートを確認する（REQ-9.3）。**`permissions:` 検証も移植時に追加する**（spec v1.6 §10.2）。移植完了前は PR レビューの目視確認が唯一の安全網 |

---

<!-- status: complete -->

_Generated: 2026-08-29T00:00:00Z_
_Requirements source: specs/001-agentic-ai-core-p0/spec.md_
_Research log: specs/001-agentic-ai-core-p0/research.md_

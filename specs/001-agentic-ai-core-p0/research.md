# P0 設計調査ログ — 001-agentic-ai-core-p0

**調査日**: 2026-08-29
**フィーチャー分類**: Extension（既存 monorepo への追加）
**調査レベル**: Light discovery（既存コードベースのパターン確認 + 既知の traps 確認）

---

## 調査 1: 既存 monorepo 構造の確認

**調査内容**: `vaz-ai-next@cf72583` の現状構成と P0 で触れるルートファイルの有無

**確認事項**:
- `.gitignore` / `LICENSE` / `README.md` が git 管理済み
- `AGENTS.md` / `CLAUDE.md` / `specs/` は未追跡。**`.gitignore` には該当エントリは存在せず、単に `git add` されていない状態である**（第 3 回 `/sdd-analyze` の実測により訂正。旧記述「`.gitignore` にも記載あり」は誤り。したがって D4 の対応は「`.gitignore` からの除外」ではなく `git add` + commit）
- `.sdd/` が空かつ `.gitignore` にある → SDD 成果物は `specs/` 側（リポジトリ慣行）を優先。`.sdd/` の無視エントリは P0 でも維持する（REQ-1.8）

**結果**: ルートファイル群（`mise.toml` / `turbo.json` / `pyproject.toml` / `pnpm-workspace.yaml`）は未存在。P0 で新規作成対象。

---

## 調査 2: `fastapi-pydantic-ai-agent@d4d5f8d` の確認

**調査内容**: 移植ベースのディレクトリ構造・依存・テスト構成

**確認事項** (spec-agenticai-core.md §0.3 / §4.4 より):
- Pydantic AI v2 移行完了済み（spec `004-pydantic-ai-v2-unblock` 全 8 チェンジユニット完了）
- `pydantic-ai-slim[logfire]>=2.35.3,<3.0`（`openai` extra なし）で lock 解決: openai 2.54.0 / litellm 1.98.0 / pydantic-ai-litellm 0.2.8
- `pip-audit` は starlette 5 件 + chromadb 3 件のみ（到達性根拠付き `--ignore-vuln` 済み）
- ガードレール層・セッション所有権・Corrective RAG・SSE ライフサイクル硬化を実装済み

**P0 スコープの確認**:
- P0 では「動作を現状維持する移植」のみ → 改修 B（uv workspace 化）のみ必須
- 改修 A（SSE ワイヤフォーマット追加 = `/v1/chat` 新設）は P3 スコープ

---

## 調査 3: Turborepo `experimentalPythonWorkspaces` の検証

**調査内容**: turbo.json スキーマへの `futureFlags.experimentalPythonWorkspaces` 実在確認

**確認事項** (spec-agenticai-core.md §3.5 より):
- `turbo@2.10.11` の `schema.json` に実在を確認済み
- `experimentalCargoWorkspaces` / `experimentalObservability` と並ぶフラグ
- `turbo-version-check` によるバージョン一致の機械検証が必須

**結果**: `futureFlags.experimentalPythonWorkspaces: true` を `turbo.json` に設定する設計を採用。退避経路として `mise` タスクを常に維持。

---

## 調査 4: §2.6 openai 3.x / litellm 分断トラップの確認

**調査内容**: `openai` extra 省略による衝突回避の検証

**確認事項** (spec-agenticai-core.md §2.6 より):
- `pydantic-ai-slim[openai]>=2.32.0` は `openai>=3.0.0` を要求
- litellm 1.83.1〜1.98.0 は `openai<3.0.0` を宣言 → 解決が litellm 1.83.0（CVE 11 件）に後退する
- `openai` extra を外すと衝突消滅 → slim 2.35.3 / litellm 1.98.0 / openai 2.54.0 に解決（`pip-audit` クリーン）
- `fastapi-pydantic-ai-agent@d4d5f8d` にて実測済み

**結果**: `apps/agent-api` pyproject.toml に `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0`（`openai` extra なし）を採用。`AGENTS.md` / `CLAUDE.md` の D1/D2/D3 不整合の修正が必要。

---

## 調査 5: AGENTS.md / CLAUDE.md 不整合の確認 (D1〜D4)

**調査内容**: リポジトリルートのエージェント向けドキュメントの spec v1.3 との乖離

**確認事項** (spec.md §未解決の不整合 より):
- D1: `openai` extra の明示ピンが v1.2 時代の誤り → 除去要
- D2: 「フロアを ≥2.32 に上げると litellm が 1.83.0 へ後退する」警告が v1.3 撤回済み → 更新要
- D3: CLAUDE.md 比較表も同様 → D1 と同じ修正
- D4: **ずれの方向は逆である**（第 3 回 `/sdd-analyze` で訂正）。`CLAUDE.md:14` は既に `AGENTS.md` / `CLAUDE.md` / `specs/` を「Git-tracked files」と記述しており、リポジトリ側が追いついていない。必要な作業は記述変更ではなく `git add` + commit（REQ-5.4）

**結果**: `AGENTS.md` / `CLAUDE.md` を 1 つの commit 単位として同時修正する設計制約を plan に含める。

---

## 調査 6: CI パイプラインの既存資産確認

**調査内容**: `vaz-ai-next` の `.github/workflows/` および pre-commit フックの構成

**確認事項** (spec-agenticai-core.md §10.1 / §10.2 / §10.3 より):
- `eval-pr.yml` / `eval-nightly.yml` が稼働中
- 既存 `test_ci_workflows.py` が全 `uses:` の 40 桁 SHA ピンを機械検証
- P0 で追加するジョブ: `turbo-version-check` / `audit`（pnpm + pip-audit 両方）
- P0 スコープでは `codegen-check` / `test:integration` / `test:e2e` は含めない（P2・P3）

**結果**: 既存 CI ジョブの枠組みに `turbo-version-check` と `audit` ジョブを追加する設計。`test_ci_workflows.py` の SHA ピン検証は既存機能を維持。

---

## 調査 7: pre-commit フックとモデル ID ゲートの確認

**調査内容**: 既存の `forbid-model-ids.sh` / pygrep フックの範囲と monorepo への展開

**確認事項** (spec-agenticai-core.md §2.4 より):
- `vaz-ai-next`: `scripts/forbid-model-ids.sh`（`.py` も走査）+ mise task `lint:model-ids`。例外は `packages/config/src/model-allowlist.ts` と `packages/schemas/src/env.ts` のみ
- `fastapi-pydantic-ai-agent`: pre-commit pygrep `no-hardcoded-model-id` + `tests/unit/test_no_hardcoded_model_ids.py`
- P0 では既存ゲートを monorepo 全体に展開し、許可リストを 1 か所に集約

**結果**: `apps/agent-api` の `settings.llm_model`（環境変数解決）設計を維持。許可リストは `packages/config/src/model-allowlist.ts` で一元管理。

---

## 調査 8: `apps/web/AGENTS.md` の生成ルール確認

**調査内容**: `next dev` の自動生成ファイルの扱いと pre-commit 検知

**確認事項** (spec-agenticai-core.md §3.6 より):
- `node_modules/next/dist/server/lib/generate-agent-files.js` が `apps/web/AGENTS.md` を生成・再付与する
- `.gitignore` せずコミットする規約
- pre-commit でツール生成ファイルの未コミット残留を検知する必要あり

**結果**: pre-commit フック項目 6（§10.1）として `apps/web/AGENTS.md` の未コミット残留チェックを設計。`apps/web/` 起点でパス解決する注意点を plan に記載。

---

## 総括

- **フィーチャー分類**: Extension（既存 monorepo への追加）
- **発見した技術的制約**: §2.6 の openai/litellm 分断トラップ（設計上は extra 省略で解消済み）
- **既存資産の再利用範囲**: CI ジョブ枠組み / pre-commit フック / モデル ID ゲート / eval baseline 機構
- **P0 スコープの確認**: 設計上の新規要素は「ルートファイル追加」「移植 + uv workspace 化」「AGENTS.md/CLAUDE.md 修正」「turbo-version-check 追加」に限定される
- **未決事項**: なし（P0 スコープ内の不明点はすべて clarification で解消済み）

> **注記**: 上記の総括は調査 1〜8 時点のものである。調査 9〜14（`/sdd-analyze` 第 2 回・第 3 回由来）で前提の誤りと未定義箇所が追加で判明しているため、最新の結論はそちらを参照すること。特に **調査 13（turbo の Python タスク自動登録機構）は P0 の受け入れ条件そのものに関わる**。

---

## 調査 9: リポジトリ実状態の再確認（`/sdd-analyze` 第 2 回）

**調査日**: 2026-08-29（`/sdd-plan` 再実行時）
**調査内容**: `/sdd-analyze` 第 2 回の指摘（CRITICAL 3 / HIGH 4）に基づく実状態の確認

**確認事項**:
- spec.md が v1.3 → v1.5 に改訂され、要件数が 38 → 49 に増加した
- plan.md / tasks.md / traceability.md は旧版（38 件体制）のままだった
- 主な変更: §0「母体 monorepo の取り込み」6 件の新設、REQ-1.8 / REQ-5.6 / REQ-7.5 / REQ-10.3 の追加
- 旧 plan §1.1 の「既存 monorepo の拡張」という前提が spec v1.5 の「新規リポジトリへの取り込み」と矛盾していた

**結果**:
- plan.md を v2 に更新（§0 新設、§1.1/1.3 前提修正、§3.1.5/3.5/3.6/3.8/3.9/3.10/7.5/8.2/8.4/9/10 修正）
- traceability.md を 49 件体制に更新
- tasks.md は `/sdd-tasks` 再実行で更新が必要（T-0 グループが未存在）

---

## 調査 10: `pip-audit` 呼び出し形式の確認

**調査内容**: `pip-audit -r apps/agent-api/uv.lock` が成立しない理由の確認

**確認事項** (spec.json §analysis_derived_decisions より):
- `uv.lock` は requirements 形式ではなく TOML 形式 → `pip-audit -r` の入力として使用不可
- uv workspace 構成ではルート単一の `uv.lock` のみが生成され、`apps/agent-api/uv.lock` は存在しない
- 正しい呼び出し: `uv export --frozen --no-dev --package agent-api | pip-audit -r /dev/stdin`

**結果**: plan.md §8.2 / §3.9 の `pip-audit` コマンドを正しい形式に修正した。

---

## 調査 11: `turbo --version` 抽出の TOML パーサ要件

**調査内容**: `grep '^turbo\s*='` が `[tasks]` セクションと衝突するリスクの確認

**確認事項**:
- `mise.toml` の `[tasks]` セクションには `turbo = "..."` という形式のタスク定義が存在しうる
- `grep '^turbo\s*='` は `[tools]` と `[tasks]` の両セクションを区別できない
- `mise config get tools.turbo` はセクションを正確に解決する（REQ-6.1）

**結果**: plan.md §3.6 の CI スクリプトを `EXPECTED=$(mise config get tools.turbo)` に修正した。

---

## 調査 12: pre-commit フックの `apps/web/` 不在ガードの設計変更

**調査内容**: REQ-8.2「対象不在を検知して警告すること」の実装要件

**確認事項**:
- 旧設計 `if [ -d "apps/web" ]; then ... fi` は `apps/web/` が不在のとき無言でパスする
- REQ-8.2 は「`apps/web/` が存在しない場合にチェックが常にパスする実装は不合格」と明示
- 不在時は T-0（取り込みタスク）が未完了であることを示すエラーを出して `exit 1` すべき

**結果**: plan.md §3.8 のフックスクリプトを `if [ ! -d "apps/web" ]; then exit 1; fi` 方式に変更した。

---

## 調査 13: turbo の Python タスク自動登録機構の確定（`/sdd-analyze` 第 3 回）

**調査日**: 2026-08-29
**調査内容**: `turbo run lint --filter=agent-api` が `ruff check` を起動する経路。第 1 回 C4 / 第 3 回 C1 の指摘（「どの成果物もこの経路を定義していない」）への対応。

**調査方法**: 推測を避けるため `turbo@2.10.11`（npm / darwin-arm64）を一時ディレクトリに導入し、uv workspace + TS パッケージを併存させた最小構成で `turbo ls` / `turbo run <task> --dry=json` を実測した。併せて同梱 `schema.json` の `futureFlags` 定義とネイティブバイナリの文字列表を確認した。

**確認事項**:

1. `schema.json` の `experimentalPythonWorkspaces` の説明は「ルート `pyproject.toml` の `[tool.uv.workspace]` メンバーをパッケージとして発見する。uv のみ対応」と述べるが、**タスクのコマンド解決には言及していない**（`experimentalCargoWorkspaces` の説明には「crate が build と検証タスクを暗黙登録する」とある）。
2. **`pyproject.toml` にタスク実装を書く必要はない。turbo が `[dependency-groups]` の宣言から自動登録する。** 解決されるコマンド（実測）:
   - `lint` → `lint:ruff` = `uv run --frozen --package agent-api ruff check apps/agent-api`
   - `check` → `check:ty` = `uv run --frozen --package agent-api ty check apps/agent-api`
   - `test` = `uv run --frozen --package agent-api pytest apps/agent-api`
   - `format:ruff` = `uv run --frozen --package agent-api ruff format apps/agent-api`（**`--check` は付かない = 破壊的**）
   - フィルタなしの実行ではワークスペースルートに `<root>#lint:ruff` = `uv run --frozen --all-packages ruff check ...` として集約登録される
3. **`typecheck` は Python 側で登録されない**。`turbo run typecheck --filter=agent-api --dry=json` はタスク 2 件を返すが `command` は両方 `<NONEXISTENT>` であり、**何も実行せず成功する**。turbo の Python 語彙は `check` である。
4. 必要条件（欠けると起動しない / タスクが消える）:
   - ルート `pyproject.toml` の **`[tool.turbo] name`**（未宣言 → `The uv workspace has no name.`）
   - ルート **`uv.lock`**（不在 → `uv.lock is required for Python workspaces. Run 'uv lock' and commit the result.` で `turbo ls` すら失敗）
   - ルート `package.json` の **`packageManager` / `devEngines.packageManager`**（不在 → `Could not resolve workspace.`）
   - メンバーの `[dependency-groups] dev` の **`ruff` / `ty` / `pytest`**（外すと `lint` が **0 件**、`test` が `<NONEXISTENT>`、`check` が `uv check --frozen --package=agent-api`（lock 整合チェック）に退化）
5. ツール設定ファイル（`ruff.toml` / `ty.toml` / `pytest.ini` / `conftest.py`）の有無は登録に**影響しない**。引き金は依存宣言のみ。
6. TS パッケージと併存させた `turbo run lint`（フィルタなし）で `@vaz/schemas#lint = biome check .` と `<root>#lint:ruff = uv run ... ruff check` の**両方**がスケジュールされる（REQ-7.1 の成立を確認）。

**結果**:
- plan.md に §3.1.6「Python パッケージのタスク宣言」を新設し、上記を設計として確定した。§3.1.2 の誤った記述（`[tool.hatch.envs.*.scripts]` / `[project.scripts]`）を削除した。
- `turbo.json` に `check` タスクを追加し、`typecheck.dependsOn` に `"check"` を加えて両言語を 1 コマンドに合流させた（REQ-1.3）。
- REQ-0.7（`packageManager`）と REQ-2.7（dev グループ）を要件として追加した。
- §7.5 のゼロ件ガードを「タスク件数」から「`uv run` で始まる `command` の件数」に変更した（件数判定は実測 3 の `<NONEXISTENT>` を検知できない）。
- `ruff format --check` は turbo で代替できないため、CI の独立ステップと `mise run lint:format` に分離した（REQ-7.1）。
- turbo による検証は `uv lock` 完了後（T-2.3 以降）にのみ成立するため、T-1.2 / T-1.3 から turbo 実行の確認項目を外し T-2.6 に集約した（R-P0-08）。

---

## 調査 14: pre-commit フックの残留判定の実測（`/sdd-analyze` 第 3 回）

**調査日**: 2026-08-29
**調査内容**: `git status --porcelain apps/web/AGENTS.md | grep -q '^[^?]'` が REQ-8.2 の要求を満たすか。

**調査方法**: 一時 git リポジトリで `apps/web/AGENTS.md` を 3 状態（未追跡 / ステージ済み / 未ステージ変更）に置き、判定式の終了コードを実測した。

**確認事項**:

| 状態 | `--porcelain` | 旧 `'^[^?]'` | 新 `'^\?\?\|^.[^ ]'` | 期待 |
| :--- | :--- | :--- | :--- | :--- |
| 未追跡（生成され `git add` されていない）| `??` | **通過** | 失格 | 失格 |
| ステージ済み（これからコミット）| `M ` / `A ` | **失格** | 通過 | 通過 |
| 未ステージ変更（真の残留）| ` M` | 失格 | 失格 | 失格 |

`'^[^?]'` は `?` 以外の先頭文字にマッチするため、**REQ-8.2 が検知したい主ケース（未追跡）だけを除外し、残留ではないステージ済みを失格にしていた**。`next dev` は起動ごとに `apps/web/AGENTS.md` を再生成するため（調査 8）、旧式ではこのファイルを含む以後のコミットが恒常的にブロックされる。

**結果**: plan.md §3.8 の判定式を `grep -qE '^\?\?|^.[^ ]'` に修正し、REQ-8.2 に 3 状態の期待終了コード（正常系で 0 になることを含む）を明記した。T-5.4 に 3 状態の確認項目を追加した。

---

## 調査 15: `check` タスクの解決スコープとガードスクリプトの 3 状態実測（`/sdd-analyze` 第 7 回 H2）

**調査日**: 2026-08-29
**調査内容**: 第 6 回で「turbo の実装に依存し未確定」とされた `turbo run check --filter=agent-api` の `check:ty` 解決スコープ。§3.1.6 の実測表（`agent-api` スコープに解決する）と §7.5 の注記（ルートに集約される可能性がある）が矛盾していた。

**調査方法**: `/tmp/tcheck7` に最小構成（ルート `pyproject.toml` に `[tool.turbo] name` + `[tool.uv.workspace]`、ルート `package.json` に `packageManager`、`apps/agent-api/pyproject.toml` に `[dependency-groups] dev = ["pytest>=8","ruff","ty"]`、`turbo.json` に `check` タスクと `typecheck.dependsOn=["codegen","check"]`、TS パッケージ `packages/schemas`）を作り、`uv lock` 後に `npx turbo@2.10.11 run <task> --filter=agent-api --dry=json` を実測した。

**確認事項**（`turbo@2.10.11` / macOS arm64 / 2026-08-29）:

| コマンド | 解決された taskId と command |
| :--- | :--- |
| `run lint --filter=agent-api` | `agent-api#lint` = `<AGGREGATE>` / **`agent-api#lint:ruff` = `uv run --frozen --package agent-api ruff check apps/agent-api`** |
| `run check --filter=agent-api` | `agent-api#check` = `<AGGREGATE>` / **`agent-api#check:ty` = `uv run --frozen --package agent-api ty check apps/agent-api`** |
| `run test --filter=agent-api` | **`agent-api#test` = `uv run --frozen --package agent-api pytest apps/agent-api`** |
| `run typecheck --filter=agent-api` | `agent-api#check` = `<AGGREGATE>` / **`agent-api#check:ty` = `uv run …ty check`** / `agent-api#codegen` = `<NONEXISTENT>` / `agent-api#typecheck` = `<NONEXISTENT>` |

1. **`check:ty` は `agent-api` パッケージスコープに解決される。ルートには集約されない。** §3.1.6 の実測表が正しく、**第 6 回 H1 の注記は誤りであった**（削除する）。
2. `typecheck` は `dependsOn: ["codegen","check"]` により **`uv run` で始まるコマンドに到達する**（第 3 回時点では `<NONEXISTENT>` 2 件のみだった）。REQ-7.2 の成立を実測で確認した。
3. 親タスク（`lint` / `check`）の `command` は `<AGGREGATE>` である。`startswith("uv run")` による判定はこれを正しく除外する。

**ガードスクリプトの 3 状態実測**（plan §7.5 の実装をそのまま `check-python-tasks.sh` として実行）:

| 状態 | 終了コード | 判定 |
| :--- | :--- | :--- |
| 正常（`ruff` / `ty` / `pytest` すべて宣言） | **0** | 通過（`lint` / `check` / `test` それぞれ `uv run` 1 件） |
| `[dependency-groups] dev` から `ruff` を除去 | **1** | 失格（`lint` が 0 件を検出） |
| ルート `uv.lock` を退避（turbo がハードエラー） | **1** | 失格（`|| echo 0` + `${COUNT:-0}` が機能し、第 3 回 H5 の偽陰性は再発しない） |

**結果**: §7.5 の第 6 回注記と T-2.6 の「集約先の実測」ステップを削除する。§3.1.6 の `check` 行を確定値として維持する。ガードスクリプトは設計どおり機能することを 3 状態で確認済みとして記録する。

---

## 調査 16: 上流ピン `cf72583` の実体と取り込み対象の実インベントリ（`/sdd-analyze` 第 7 回 C2）

**調査日**: 2026-08-29
**調査内容**: `cf72583` の完全 SHA、`cf72583..main` の drift、`services/agent` の lock 形式（第 6 回で導入した 4 パターン分岐の解消）、および取り込み対象の実体。

**調査方法**: `git init` した一時ディレクトリに `--filter=blob:none --no-tags` で `main` と `claude/agentic-ai-app-spec-xo42j1` を fetch し、`git ls-tree` / `git show` / `git diff --name-only` で確認した（短縮 SHA では `git fetch <sha>` が `couldn't find remote ref` になるため、blobless fetch で履歴を取得してから解決した）。

**確認事項**:

1. **`cf72583` = `cf725831dcb6095c6e164ae3f29f8224f436a5c9`**（`Merge pull request #10 from claude/update-dependencies-security-check-ql1nb0`）。`main` から到達可能で実在する。REQ-0.1 は充足。
2. **drift `cf72583..main` = コミット 2 件 / 変更ファイル 2 件**（`main` = `bbf1156b29db5865f6811470b98a7b002ba83ef6`）。Out of scope 宣言のリスクは小さい。
3. **`services/agent/uv.lock` が存在する → パターン A で確定。** 第 6 回で導入した 4 パターン分岐（B: requirements / C: poetry / D: lock なし）はいずれも成立しない。`services/agent` 配下は `.python-version` / `Dockerfile` / `README.md` / `app` / `pyproject.toml` / `tests` / `uv.lock`。リポジトリ全体の lock ファイルは `pnpm-lock.yaml` と `services/agent/uv.lock` の 2 件のみ。
4. **`.github/workflows/` に `ci.yml` は存在しない。** 実体は 6 ファイル: `eval-nightly.yml` / `eval-pr.yml` / **`lint.yml`** / **`python.yml`** / **`security-daily.yml`** / **`tests.yml`**。lint / test / Python / セキュリティ監査はすでに**独立した workflow として稼働している**。
5. **ルート `mise.toml` が存在する**（`[tools]` / `[hooks]` + 19 タスク: `dev` / `build` / `start` / `test` / `test:run` / `test:coverage` / `test:e2e` / `test:e2e:ollama` / `lint` / `lint:fix` / **`lint:model-ids`** / `typecheck` / `audit` / `db:migrate` / `check` / `py:check` / `openapi:gen`）。REQ-10.1 が前提とする `lint:model-ids` はここに実装されている。
6. **ルート `package.json` の `packageManager` = `pnpm@11.19.0+sha512.…`**。REQ-1.1 の `pnpm = "11.24.x"` と**矛盾する**ため、REQ-0.7 は取り込み時点で不合格になる（更新が必要）。ルート `package.json` の `name` は `vaz-ai-next`、`scripts` は `dev` / `build` / `start` / `test`（= `vitest` **watch モード**）/ `test:run` / `test:e2e` / `lint`（= `biome check .`）/ `lint:fix` / `typecheck`（= `pnpm -r run typecheck`）、`devDependencies` に `@biomejs/biome` / `vitest` / `typescript@^6.0.3` / `@playwright/test` 等。
7. ルート直下に **`biome.json` / `vitest.config.ts` / `playwright.config.ts` / `docker-compose.yml` / `.editorconfig` / `docs/` / `specs/`** が存在する。**このうち `biome.json` と `vitest.config.ts` は TS の lint / test の設定実体であり、取り込まなければ TS 側のレーンが成立しない。** 旧 REQ-0.2 の取り込み資産一覧はこれらを含んでいなかった。
8. `packages/` は 7 パッケージ（`agents` / `config` / `db` / `evals` / `rag` / `schemas` / `tools`）、`apps/` は `web` / `worker`、`.githooks/` は `pre-commit` / `pre-push`、`scripts/` は `forbid-model-ids.sh` のみ。plan §0.1 の想定と一致する。

**結果**:
- REQ-3.1 のパターン分岐を削除し、パターン A（`cd services/agent && uv export --frozen --no-dev | pip-audit -r /dev/stdin`）で確定した。
- REQ-0.2 の取り込み資産一覧に `biome.json` / `vitest.config.ts` / `mise.toml` を追加した（`mise.toml` は上流の 19 タスクを保全してから P0 の追記を行う方式に変更 — 新規作成ではない）。
- REQ-9.1 の `ci.yml` 単一ファイル前提を廃止し、実在する 6 workflow へ合流する方式に変更した（原則 5）。
- REQ-0.7 に「取り込み時点で `pnpm@11.19.0` であり更新が必要」という実測結果を明記した。

---

## 調査 17: turbo はルート `package.json` の `scripts` を解決しない（`/sdd-analyze` 第 7 回・新規 CRITICAL）

**調査日**: 2026-08-29
**調査内容**: 調査 16-6 / 16-8 で「TS 側の `lint` / `test` はルート `package.json` にのみ存在し、個別パッケージには存在しない」ことが判明したため、`turbo run lint` / `turbo run test` が TS 側を実行するのかを実測した。

**調査方法**: 調査 15 の `/tmp/tcheck7` 構成で、ルート `package.json` に上流と同じ `scripts`（`lint` = `biome check .` / `test` = `vitest run` / `typecheck`）を与え、ルートの `name` を **(i) `[tool.turbo] name` と不一致（`vaz-ai-next`）** と **(ii) 一致（`vaz-agentic-ai-next`）** の 2 通りで `turbo run <task> --dry=json`（フィルタなし）を実測した。

**確認事項**:

1. **`[tool.turbo] name` を宣言すると、ワークスペースルートは Python（uv）ルートパッケージとして扱われ、ルート `package.json` の `scripts` は解決されない。** 名前が一致していても同じである（実測）:

   | ルート `name` | `turbo run test` のルートタスク | `turbo run lint` のルートタスク |
   | :--- | :--- | :--- |
   | `vaz-ai-next`（不一致） | `vaz-agentic-ai-next#test` = **`<NONEXISTENT>`** | `vaz-agentic-ai-next#lint` = `<AGGREGATE>` + `lint:ruff` のみ |
   | `vaz-agentic-ai-next`（一致） | `vaz-agentic-ai-next#test` = **`<NONEXISTENT>`** | 同上 |

   `turbo ls` はルートを常に `[tool.turbo] name` の値で列挙する（`package.json` の `name` は無視される）。
2. **上流の TS パッケージ 9 件はいずれも `lint` / `test` スクリプトを持たない**（`typecheck` のみ。加えて `web` は `build`/`dev`/`start`、`db` は `migrate`、`evals` は `eval:*`、`rag` は `ingest`）。したがって取り込み後の実リポジトリでは:
   - **`turbo run lint` は `agent-api#lint:ruff` のみをスケジュールする（TS の Biome は 1 件も走らない）**
   - **`turbo run test` は `agent-api#test` のみをスケジュールする（TS の Vitest は 1 件も走らない）**
   - `turbo run typecheck` は 9 パッケージすべての `typecheck` + `dependsOn` 経由の Python `check:ty` を実行する（**両言語が成立する唯一のタスク**）
3. **§3.1.6 の旧「実測 6」は無効である。** 当該実測は `lint` スクリプトを持つ**合成**の `@vaz/schemas` を用いており（実パッケージは持たない）、「REQ-7.1 の成立を確認」という結論は実リポジトリには当てはまらない。
4. REQ-7.5 のゼロ件ガードは `uv run` で始まるコマンドのみを数えるため、**この TS 側の欠落を検知できない**（Python 側の偽陰性ガードの鏡像が存在しない）。
5. 副次的な安全確認: ルート `package.json` の `test` は上流では `vitest`（**watch モード**）だが、turbo はこれを解決しないため `turbo run test` が CI でハングする経路は生じない。ただし TS テストを走らせるには `test:run`（= `vitest run`）を明示的に呼ぶ必要がある。

**結果**（P0 の受け入れ条件の再設計）:
- ルート集約型の TS lint / test は turbo の外に出す。`ruff format --check` で確立済みの前例（§3.1.6）と同じ扱いとし、**CI の独立ステップ + `mise` タスク**として実行する。9 パッケージに `lint` / `test` スクリプトを新設する案は採らない（`biome check .` / `vitest run` はルート単一設定でリポジトリ全体を走査する設計であり、分割するとルート直下のファイルが対象から漏れ、`vitest.config.ts` を 9 個に複製する必要が生じる）。
- REQ-7.1 / 7.3 を「`turbo run lint` / `test` が Python 側を実行し、TS 側はルートの独立ステップで実行する」形に書き換えた。
- TS 側の偽陰性ガード（REQ-7.6）を新設した（Biome の走査ファイル数 > 0 / Vitest の収集件数 > 0）。

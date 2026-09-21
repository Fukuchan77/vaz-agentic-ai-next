# 001-agentic-ai-core-p0 — 実装タスク

<!-- status: complete -->

**フィーチャー名**: `001-agentic-ai-core-p0`
**日付**: 2026-08-29
**フェーズ**: P0（母体取り込み + monorepo 骨格 + `apps/agent-api` 移植）
**統治規範**: `specs/memory/constitution.md`（v1.2.0）（原則 9 = テスト先行 / 原則 3 = 非空虚 に対する適用方針は plan §7.7）

---

## タスク一覧

| ID | タイトル | 見積もり |
| :--- | :--- | :--- |
| T-0 | 母体 monorepo の取り込みと前提確認 | 1–2 h |
| T-1 | ルート構成ファイル群の新設 | 2–3 h |
| T-2 | `apps/agent-api` の移植と uv workspace 化 | 2–3 h |
| T-3 | §2.6.3 二層バージョン方針の lock 確認 | 1–2 h |
| T-4 | `AGENTS.md` / `CLAUDE.md` の v1.5 整合 | 1 h |
| T-5 | CI パイプライン整備と品質ゲートの確立 | 3–4 h |
| T-6 | モデル ID ハードコード禁止の展開 | 1 h |
| T-7 | `apps/web/AGENTS.md` のコミット管理確立 | 1 h |
| T-9 | リポジトリ規約アサートテストの実装（**T-9.0 で RED を観測してから**） | 3–4 h |
| T-8 | 全体検証：両言語の lint / typecheck / test 通過（**TS は turbo 外**）＋ カバレッジ baseline | 2–3 h |

> **実行順序（第 7 回 C1 により組み替え — plan §7.7）**:
>
> ```
> T-0（取り込み）
>   → T-1.1 / T-1.3        mise.toml 追記・ルート pyproject.toml（turbo / uv の起動要件のみ）
>   → T-2.1 / T-2.2        移植・依存宣言 … ここで apps/agent-api/tests/unit/ が出現する
>   → T-9.0 ★             アサートテストを RED 状態で書き、失敗を観測する
>   → T-1.2 / T-1.5 / T-2.3 / T-4.1   turbo.json・.gitignore・uv lock・AGENTS.md = GREEN 化
>   → T-9.1 / T-9.2        残りのアサートを追加（各々 RED を観測してから GREEN にする）
>   → T-2.4 / T-2.5 / T-2.6 → T-3 → T-5 / T-6 / T-7 → T-8
> ```
>
> **なぜこの順序か**: 憲章 原則 9 は「実装コードを、それを要求する失敗するテストより先に書いてはならない（MUST NOT）」「既に動くコードに合わせて後からテストを書く行為を禁ずる」と定める。旧順序（T-9 を T-8 の直前に置く）は **16 要件の検証実体が一度も RED を観測しない**状態を作っていた。テストの配置先が `apps/agent-api/tests/unit/`（T-2.1 で出現）である制約は変えられないため、**T-2.1 の直後に T-9.0 を挿入して RED を観測する**。
>
> **順序で担保できない分は「壊して確認する」で代替する**: T-2.1 より前に確定する項目（ルート `pyproject.toml`）や、既に正しい状態で取り込まれる項目（`AGENTS.md` の D1〜D3 回帰確認）は RED を先に観測できない。これらは **T-2.6 で確立済みの形式**（対象を壊す → FAIL を確認 → `git restore` → 整合確認）を必須作業項目として適用する（plan §7.7）。
>
> **turbo を実行する検証は T-2.3（`uv lock` 完了）以降にのみ置く**。turbo の Python サポートは `uv.lock` が無いと全タスクを拒否し、`uv lock` は `apps/agent-api` の配置後にしか成功しないため、T-1.2 / T-1.3 の時点では turbo による検証が原理的に成立しない（plan §10 R-P0-08）。
>
> **TS の lint / test は turbo の外にある**（plan §3.1.6a の実測）。`turbo run lint test` が緑であることを P0 の完了根拠にしてはならない（R-P0-09）。TS レーンは T-8.1a が担当する。

---

## T-0 — 母体 monorepo の取り込みと前提確認

_Boundary:_ `apps/web/**`, `apps/worker/**`, `packages/**`, `services/agent/**`, `.github/workflows/**`, `.githooks/**`, `scripts/**`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package.json`, `README.md`, `docs/PROVENANCE.md`, `specs/001-agentic-ai-core-p0/import-baseline.json`
_Boundary 除外:_ **`.gitignore`（上流の `.gitignore` は取り込まない — 現行の「Coding agent directories」節が失われるため。修正は T-1.5 が担当する）**
_Depends:_ none
_Traces:_ REQ-0.1, REQ-0.2, REQ-0.3, REQ-0.4, REQ-0.5, REQ-0.6, REQ-0.7

`vaz-ai-next@cf72583` の資産を本リポジトリへ取り込む。これ以降の要件はすべてここで追加される資産の存在を前提としている。ピンが到達できることを最初に確認し、到達できない場合は作業を中断してピンを再決定する。

### T-0.1 — ピン `cf72583` の到達確認と drift 記録

_Boundary:_ （ファイル変更なし — 確認作業のみ）
_Depends:_ none
_Traces:_ REQ-0.1

- [ ] `git ls-remote git@github.com:Fukuchan77/vaz-ai-next.git` で到達性を確認する
- [ ] `cf72583` の**完全 SHA** を解決し、**`cf725831dcb6095c6e164ae3f29f8224f436a5c9`** と一致することを確認する（第 7 回 調査 16 の実測値。**短縮 SHA では `git fetch <sha>` が `couldn't find remote ref` になる**ため、`git fetch --filter=blob:none --no-tags origin main` で履歴を取得してから解決する）
- [ ] `cf72583..main` のコミット数と変更ファイル数を記録し PR 本文に添付する。**実測値はコミット 2 件 / 変更ファイル 2 件**（`main` = `bbf1156b…`）。これと大きく食い違う場合は上流が進んでいるため T-0.1 の時点で報告する
- [ ] `cf72583` が到達できない場合は作業を中断し、採用するピンを再決定してから T-0.2 へ進む

### T-0.2 — 資産を本リポジトリへコピーし git 追跡対象にする

_Boundary:_ `apps/web/**`, `apps/worker/**`, `packages/**`, `services/agent/**`, `.github/workflows/**`, `.githooks/**`, `scripts/**`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package.json`, `specs/001-agentic-ai-core-p0/import-baseline.json`
_Depends:_ T-0.1
_Traces:_ REQ-0.2, REQ-0.3, REQ-0.4, REQ-0.5, REQ-0.7, REQ-4.1

- [ ] `vaz-ai-next@cf72583` のソースを sparse-checkout または rsync 相当で本リポジトリへコピーし、`git add` する。**以下 4 者はコピー対象から明示的に除外する**（不在ではなく意図的除外である）:
  - **`.gitignore`** — 現行の `.bob/` / `.claude/` / `.sdd/` / `.serena/` 節を保全するため（ポリグロット対応は T-1.5）
  - **`AGENTS.md` / `CLAUDE.md`** — 本リポジトリの現行版は既に v1.5 準拠であり、上書きすると REQ-5.1〜5.3 の回帰確認が壊れる（上流版は v1.2 相当の可能性がある）
  - **`specs/`** — 本リポジトリの `specs/001-agentic-ai-core-p0/` および `specs/memory/constitution.md` と衝突する
- [ ] `git ls-files` に以下の各パスが 1 件以上現れることを確認する（REQ-0.2）: `apps/web/`, `apps/worker/`, `packages/`, `services/agent/`, `.github/workflows/`, `.githooks/`, `scripts/`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `package.json`, **`mise.toml`**, **`biome.json`**, **`vitest.config.ts`**
  - **後 3 者を追加した理由（第 7 回 N3）**: `biome.json` / `vitest.config.ts` は **TS の lint / test の設定実体**であり、無いと REQ-7.1 / 7.3 の TS レーンが 0 件走査で緑になる。`mise.toml` は上流に実在し（19 タスク）、REQ-10.1 が前提とする `lint:model-ids` を含む
- [ ] **取り込んだ `mise.toml` の `[tasks]` キー集合を `import-baseline.json` に記録する**（T-1.1 が追記時にタスクを失っていないことを T-9.1 が検証するための基準。実測では 19 タスク: `dev` / `build` / `start` / `test` / `test:run` / `test:coverage` / `test:e2e` / `test:e2e:ollama` / `lint` / `lint:fix` / **`lint:model-ids`** / `typecheck` / `audit` / `db:migrate` / `check` / `py:check` / `openapi:gen` 他）
- [ ] `packages/config/src/model-allowlist.ts` と `packages/schemas/src/env.ts` が存在することを `test -f` で確認する（REQ-0.3）
- [ ] **取り込み直後のスナップショットを `specs/001-agentic-ai-core-p0/import-baseline.json` に生成してコミットする**（REQ-0.4 / REQ-4.1 の比較基準。`git diff` は取り込み直後に比較対象を持たないため常にゼロ行になり検証にならない）。内容:
  - 各 `packages/*` / `apps/*` の `package.json` の `name` とディレクトリ名の対応表 — **`git ls-files 'apps/*/package.json' 'packages/*/package.json'` で動的に列挙した実在パッケージのみを対象とすること**（plan §6.1 の静的例示の 9 件はあくまで例示。存在しないパスを baseline に含めると T-9.1 のアサートが誤って失格する）
  - `.github/workflows/eval-pr.yml` / `eval-nightly.yml` の `git hash-object` 出力
  - 上流ピン（`vaz-ai-next@cf72583`）と生成日時
- [ ] `.github/workflows/eval-pr.yml` / `eval-nightly.yml` の `git hash-object` 出力が上流 `cf72583` の blob hash と一致することを確認する（`git ls-tree cf72583 -- <path>` と突き合わせる。REQ-0.4）
- [ ] ルート `package.json` の `packageManager` を確認する。**実測では取り込み時点の値は `pnpm@11.19.0+sha512.…` であり `mise.toml` の `pnpm = "11.24.x"` と矛盾する**ため、**`corepack use pnpm@11.24.0` 等で `11.24.0` に更新する**（integrity hash も同時に更新される。**hash を手書きしないこと**）。turbo はこのフィールドが無いと `Could not resolve workspace.` で全タスクが起動しない（REQ-0.7 / 第 7 回 N3）
- [ ] `test -x scripts/forbid-model-ids.sh` が成功することを確認する。失敗した場合は T-6.2 の「新規作成」フローに切り替える（REQ-0.5）
- [ ] **モデル ID 許可リストの 3 ファイルを記録する**（spec v1.6 §2.4 訂正: 旧版の 2 件から 3 件に変更）: `packages/config/src/model-allowlist.ts` / `packages/schemas/src/env.ts` / **`services/agent/app/config.py`**（lines 41-43）。T-6.2 の `forbid-model-ids.sh` 走査はこの 3 ファイルを除外対象として扱う
- [ ] **`services/agent/uv.lock` が存在することを確認する**（REQ-3.1 の前提）。**実測で確定済み（第 7 回 C2 / 調査 16-3）: `git ls-tree cf72583 -- services/agent/` により `uv.lock` の実在を確認した。** したがって T-3 で使う `pip-audit` 実行形は **`cd services/agent && uv export --frozen --no-dev | pip-audit -r /dev/stdin`** に確定している。
  - **第 6 回の 4 パターン分岐（B: requirements / C: poetry / D: lock なし）は削除した。** いずれも実測で成立しないため、実装中に形式を決める余地はない。もし取り込み後に `uv.lock` が**存在しなかった**場合は、取り込み手順の誤りであるため作業を中断して T-0.2 をやり直す（要件の格下げで対処してはならない — 憲章 原則 10「受け入れ基準の事後緩和を禁ずる」）

### T-0.3 — ライセンス帰属を記録する

_Boundary:_ `README.md`, `docs/PROVENANCE.md`
_Depends:_ T-0.1
_Traces:_ REQ-0.6

- [ ] `README.md` または新規作成の `docs/PROVENANCE.md` に、取り込み元リポジトリ URL（`git@github.com:Fukuchan77/vaz-ai-next.git`）とコミット SHA（`cf72583`）、および `apps/agent-api` の出所（`git@github.com:Fukuchan77/fastapi-pydantic-ai-agent.git` @ `d4d5f8d`）を記録する
- [ ] 本リポジトリの既存 `LICENSE` と取り込み元のライセンスが矛盾しないことを目視確認する

### Implementation Notes

---

## T-1 — ルート構成ファイル群の新設

_Boundary:_ `mise.toml`, `turbo.json`, `pyproject.toml`, `pnpm-workspace.yaml`, `.gitignore`
_Depends:_ T-0.2
_Traces:_ REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.5, REQ-1.6, REQ-1.7, REQ-1.8, REQ-4.1, REQ-4.2, REQ-4.3

取り込んだ母体の上にポリグロット Turborepo を動かすためのルートファイル群を新設・整備する。これらが揃って初めて `turbo run` 単一コマンドで TS / Python 両言語のタスクを実行できる状態になる。

### T-1.1 — 取り込んだ `mise.toml` を保全したうえで更新する

_Boundary:_ `mise.toml`
_Depends:_ T-0.2
_Traces:_ REQ-1.1, REQ-6.3

> **新規作成ではない（第 7 回 N3 / 調査 16-5）**: `mise.toml` は上流に**実在し** T-0.2 で取り込まれる（`[tools]` / `[hooks]` + 19 タスク）。新規作成で置き換えると **REQ-10.1 が前提とする `lint:model-ids`** をはじめ既存タスクが失われる（plan §10 R-P0-10）。

- [ ] 取り込んだ `mise.toml` の `[tools]` を更新する: `node = "24"`, `python = "3.13"`, `pnpm = "11.24.x"`, `uv = "0.12.x"`, `turbo = "2.10.11"`（`turbo` は完全固定; `>=` や `~=` は禁止）
- [ ] **`[hooks]` と既存 19 タスクを 1 件も削除しない**。とくに `lint:model-ids` / `audit` / `check` / `py:check` / `openapi:gen` を残す。`import-baseline.json` に記録した上流の `[tasks]` キー集合との差分を確認する（T-9.1 が機械検証する）
- [ ] `mise` の版指定として `pnpm = "11.24.x"` / `uv = "0.12.x"` の `.x` 表記が受理されることを確認する（`mise install` 後に `mise config get tools.pnpm` と `pnpm --version` / `uv --version` を突き合わせる）。**受理されない場合は `11.24` / `0.12` の前方一致表記に変更する**（第 7 回 L1。憲章 Additional Constraints は「pnpm 11.24.0」「uv 0.12 系」と表記する）
- [ ] `turbo` を呼ぶ wrapper タスク（`test:py`, `check-versions` 等）を**追加**し、`turbo` なしでも `mise run` で実行できる退避経路を確保する（既存の同名タスクがある場合は上書きせず整合を確認する）
- [ ] **`check-all` タスクを追加する**: `turbo run lint typecheck test` ＋ TS レーン 2 ステップ（`biome check .` / `vitest run`）＋ `ruff format --check` ＋ 2 つのガードスクリプトを 1 つの入口に束ねる。**`turbo run lint test` だけでは TS 側が 1 件も走らない**ため（plan §3.1.6a / R-P0-09）、P0 の受け入れ確認はこのタスクを入口とする
- [ ] `[tasks]` に `lint:format`（`uv run --frozen --package agent-api ruff format --check apps/agent-api`）を追加する。**turbo の `format:ruff` は `--check` を付けず破壊的に整形するため、書式検査は turbo タスクで代替できない**（REQ-7.1 / plan §3.1.6）
- [ ] `mise run check-versions` タスクが、`PATH` 上の turbo バージョンが `[tools].turbo` と一致しない場合に非 0 で終了するように実装する（REQ-6.3）
- [ ] 期待値の読み出しは `mise config get tools.turbo` を用いる（`grep` 禁止。`[tasks]` セクションの同名キーに誤マッチするため）

### T-1.2 — `turbo.json` を新設する

_Boundary:_ `turbo.json`
_Depends:_ T-1.1
_Traces:_ REQ-1.2, REQ-1.3

- [ ] `turbo.json` をリポジトリルートに新規作成する
- [ ] `"$schema": "https://turborepo.dev/schema.json"` と `"futureFlags": { "experimentalPythonWorkspaces": true }` を設定する
- [ ] `build`, `codegen`, `lint`, **`check`**, `typecheck`, `test`, `test:e2e`, `evals` の各タスク定義を追加する（`check` は turbo が Python の型検査に用いるタスク名。省略すると Python 側の型検査に到達できない — plan §3.1.6）
- [ ] `typecheck` の `dependsOn` に `"codegen"` **と `"check"`** を明示する。前者は生成物が型チェック前に存在することの保証、後者は `turbo run typecheck` が Python の `check:ty` に到達することの保証（REQ-1.3）
- [ ] **turbo を実行する検証はここでは行わない**（`uv.lock` 不在のため turbo は `uv.lock is required for Python workspaces.` で起動しない）。JSON パースによる静的アサートは T-9.1、turbo 実行による確認は T-2.6 で行う

### T-1.3 — ルート `pyproject.toml` を新設する

_Boundary:_ `pyproject.toml`
_Depends:_ T-1.1
_Traces:_ REQ-1.4, REQ-4.2

> **⚠️ 着手前に ADR-P0-05 を決定すること（spec v1.6 §12 R14 / plan §5）**: uv workspace の単一 lock は `apps/agent-api`（litellm 経由 openai 2.54.0）と `services/agent`（openai 3.3.1）を同一 workspace に入れると §2.6.3 の二層バージョン方針と両立しない。候補 (b)（両方含める）は §2.6.2 実測 A により `litellm 1.83.0 後退 + CVE 11 件` が再現するため採らない。**採用する決定は候補 (a): `apps/agent-api` を uv workspace メンバーに含めない。** この決定を下記チェックリストに反映したうえで T-1.3 に着手する。

- [ ] **ADR-P0-05 を候補 (a) で確定したことを確認する**: `apps/agent-api` は uv workspace のメンバーに含めない。`apps/agent-api` は独自 `uv.lock`（`cd apps/agent-api && uv lock`）を持ち、Turborepo の Python 管理外となる。Python タスクは `mise` 直接実行（退避経路 — ADR-P0-01）で運用する。この決定を plan §2.3 / §4.3 / §8.4 の対応箇所に記録してから次の項目へ進む
- [ ] ルートに `pyproject.toml` を新規作成し、`[tool.uv.workspace]` テーブルを追加する
- [ ] **`[tool.turbo]` テーブルに `name = "vaz-agentic-ai-next"` を宣言する**。turbo の Python サポートの必須項目であり、未宣言だと `The uv workspace has no name.` で turbo が起動しない（REQ-1.4 / plan §3.1.3）
- [ ] ADR-P0-05 候補 (a) を採用した場合、`[tool.uv.workspace]` の `members` には**実体のあるパスのみ**を列挙する。`apps/agent-api` はメンバーに含めない（plan §5 ADR-P0-05 候補 (a)）。将来の `packages/py-*` を追加するまで `members` は空配列でよい
- [ ] 将来追加する `packages/py-agents` / `packages/py-schemas` / `packages/py-evals` / `packages/py-knowledge` の `py-` 接頭辞規約をコメントとして記載する（REQ-4.2）
- [ ] **`uv lock` / `uv lock --check` はここでは実行しない**（`members` が空 / `apps/agent-api` 未配置の場合でも、turbo の Python サポートには `uv.lock` の存在が必須であるため、lock の生成は T-2.3 で別途行う）。lock の生成と検証は T-2.3 で行う（REQ-1.4 / plan §10 R-P0-08）

### T-1.4 — `pnpm-workspace.yaml` を整備する

_Boundary:_ `pnpm-workspace.yaml`
_Depends:_ T-0.2
_Traces:_ REQ-1.5, REQ-1.6, REQ-4.1

- [ ] 取り込んだ `pnpm-workspace.yaml` に `minimumReleaseAge: 1440`（公開 24 時間未満の版を除外）が設定されていることを確認する。未設定の場合は追加する（REQ-1.5）
- [ ] `packages:` に `apps/web`, `apps/worker`, `packages/*` が含まれていることを確認する（`apps/agent-api` は Python パッケージのため含めない）
- [ ] **`pnpm install --frozen-lockfile` を実行したうえで `pnpm ls -r --depth -1` が 9 メンバー（`@vaz/web` / `@vaz/worker` / `@vaz/{agents,config,db,evals,rag,schemas,tools}`）を列挙することを確認する**（REQ-1.5 の `[検証]` が指定する手段。第 7 回 M5。YAML の目視確認だけでは pnpm が実際にメンバーを認識しているかを検証できない）
- [ ] `allowBuilds` の各エントリに許可または拒否の判断根拠を示すコメントが付いていることを確認し、不足している場合は補記する（REQ-1.6）
- [ ] 取り込んだ TS パッケージ（`packages/schemas` / `packages/evals` / `packages/agents` 等）のディレクトリ名と `package.json` の `name` が変更されていないことを確認する（REQ-4.1）

### T-1.5 — `.gitignore` をポリグロット対応に整備する

_Boundary:_ `.gitignore`
_Depends:_ T-0.2
_Traces:_ REQ-1.8, REQ-4.3, REQ-8.1

- [ ] `node_modules/` / `.next/` / `.turbo/` / `coverage/` が無視対象に含まれることを確認し、未記載なら追加する（REQ-1.8）
- [ ] `lib/` / `build/` / `dist/` / `var/` 等のパス非固定パターンを先頭 `/` でルート限定または明示パスに変更し、`apps/web/lib/` 等の正当なディレクトリを巻き込まないようにする（REQ-1.8）
- [ ] `git check-ignore -v packages/api-types/generated/x.ts` が終了コード 1（マッチなし）で完了することを確認する（REQ-4.3）
- [ ] `git check-ignore -v apps/web/AGENTS.md` が終了コード 1 で完了することを確認する（REQ-8.1）
- [ ] `git check-ignore -v apps/web/lib/x.ts` が終了コード 1 で完了することを確認する（REQ-1.8。**実測で現状 `.gitignore:17:lib/` にマッチする = 修正必須**）
- [ ] `.bob/` / `.claude/` / `.sdd/` / `.serena/` の無視エントリを**削除せず維持**し、`git check-ignore -q .sdd/reviews/x.md` が終了コード 0 であることを確認する（REQ-1.8）
- [ ] **`git check-ignore -v specs/memory/constitution.md` が終了コード 1（マッチなし）であることを確認する**（憲章 v1.1.0 の正本。`.sdd/` は追跡外の作業領域として残すため、憲章は `specs/memory/` に移設した — 第 7 回 H4 / REQ-1.8）
- [ ] `AGENTS.md` / `CLAUDE.md` / `specs/` が `.gitignore` の除外対象になっていないことを確認する（REQ-1.8 / REQ-5.4 の前提）
- [ ] **`scripts/check-ts-lanes.sh` の `jq` パスを実物で確定する**（ISSUE-3 / plan §7.5a 注記）: T-0.2 で `biome.json` / `vitest.config.ts` が取り込まれた後、次のコマンドを実行して出力キー名を実測し、`scripts/check-ts-lanes.sh` の `jq` 式を確定してから T-8.1a で使用する:
  ```bash
  # Biome の --reporter=json 出力のトップレベルキーを確認する
  pnpm exec biome check --reporter=json . 2>/dev/null | jq 'keys'
  # Vitest の --reporter=json 出力のトップレベルキーを確認する
  pnpm exec vitest run --reporter=json --outputFile=/tmp/vr.json >/dev/null 2>&1; jq 'keys' /tmp/vr.json
  ```
  キー名が `filePath` / `numTotalTests` と異なる場合は `scripts/check-ts-lanes.sh` を修正してから T-8.1a に進む（キー名が違っても `|| echo 0` により偽陰性にはならず偽陽性で落ちるだけだが、早期に確定することで T-8.1a でのループを避ける）

### Implementation Notes

---

## T-2 — `apps/agent-api` の移植と uv workspace 化

_Boundary:_ `apps/agent-api/**`, `pyproject.toml`, `uv.lock`
_Depends:_ T-1.3
_Traces:_ REQ-2.1, REQ-2.2, REQ-2.3, REQ-2.4, REQ-2.5, REQ-2.6, REQ-2.7, REQ-7.4

`fastapi-pydantic-ai-agent@d4d5f8d` を `apps/agent-api` として取り込む。移植後の動作は移植元と同等（現状維持）であり、uv workspace メンバーとして正しく再配置されることが目的である。

### T-2.1 — `fastapi-pydantic-ai-agent@d4d5f8d` のソースを取り込む

_Boundary:_ `apps/agent-api/**`
_Depends:_ T-1.3
_Traces:_ REQ-2.5, REQ-2.6

- [ ] `Fukuchan77/fastapi-pydantic-ai-agent` の `d4d5f8d` の全ソースを `apps/agent-api/` に配置する
- [ ] `app/api/v1/router.py` が `prefix="/v1"` を自身に持たず、`app/main.py` の `app.include_router(v1_router, prefix="/v1")` で付与される構造であることをコードレビューで確認する（AGENTS.md ルート登録ルールへの適合）
- [ ] `apps/agent-api/tests/unit/` に移植元の全既存テストが含まれていることを確認する

### T-2.2 — `apps/agent-api/pyproject.toml` を uv workspace 対応に整備する

_Boundary:_ `apps/agent-api/pyproject.toml`
_Depends:_ T-2.1
_Traces:_ REQ-2.1, REQ-2.2, REQ-2.7

- [ ] `[project]` テーブルに `name = "agent-api"`, `version = "0.1.0"`, `requires-python = ">=3.13"` が存在することを確認する
- [ ] `dependencies` に `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` が宣言されており、`openai` extra が含まれていないことを TOML パースで確認する（REQ-2.2）
- [ ] `dependencies` に `pydantic-ai-litellm>=0.2.3,<0.3.0` が宣言されていることを確認する。**`<1.0` は誤り** — `pydantic-ai-litellm` は 0.x minor が breaking release であるため `<0.3.0` で上限を固定する（AGENTS.md version traps / plan §3.2.1）。不足・誤りの場合は修正する
- [ ] `fastapi>=0.135.1,<0.137` / `starlette>=0.52.1,<1.0` / `slowapi>=0.1.9,<1.0` の上限ピンが維持されていることを確認する
- [ ] `[dependency-groups].dev` に `pytest>=8`, `pytest-asyncio>=0.23`, `ruff`, `ty`, `pip-audit` が含まれることを確認する。**`ruff` / `ty` / `pytest` の 3 件は turbo が Python タスク（`lint:ruff` / `check:ty` / `test`）を自動登録する必要条件であり、欠けると `turbo run lint` が対象 0 件で成功する**（REQ-2.7 / plan §3.1.6 実測 4）。不足していれば追加する
- [ ] **`pyproject.toml` に turbo 向けのタスク定義は書かない**（turbo は `[dependency-groups]` の宣言から自動登録する。`[tool.hatch.envs.*.scripts]` / `[project.scripts]` はタスク定義ではない — plan §3.1.6）

### T-2.3 — uv ロックを生成してバージョンと監査を確認する

_Boundary:_ `uv.lock`
_Depends:_ T-2.2
_Traces:_ REQ-1.4, REQ-1.7, REQ-2.3, REQ-2.4

- [ ] ルートで `uv lock` を実行し `uv.lock` を生成する（T-1.3 で保留した `uv lock --check` もここで実行する — REQ-1.4）
- [ ] `pydantic-ai-slim` が 2.35.x 以上、`litellm` が 1.98.0 以上に解決していることを `uv.lock` の内容でアサートする（REQ-2.3。宣言的な下限は置かず lock + T-9.1 のテスト + `audit` ジョブの 3 段で担保する — plan §3.2.1）
- [ ] `uv export --frozen --no-dev --package agent-api | pip-audit -r /dev/stdin` を実行し、starlette 5 件・chromadb 3 件（到達性根拠付き `--ignore-vuln` 済み）以外の既知脆弱性がないことを確認する（REQ-2.4）
- [ ] `uv.lock` を `git add` してコミット対象にする（REQ-1.7）。**turbo の Python サポートは `uv.lock` が無いと全タスクを拒否するため、これは CI 再現性だけでなく turbo の起動要件でもある**（plan §3.1.6 実測 2）

### T-2.4 — テスト hermetic 設定を確認・追加する

_Boundary:_ `apps/agent-api/tests/conftest.py`, `apps/agent-api/tests/support/hermetic.py`
_Depends:_ T-2.1
_Traces:_ REQ-7.4

- [ ] `apps/agent-api/tests/conftest.py` に `models.ALLOW_MODEL_REQUESTS = False` のグローバル設定が存在することを確認する。移植元にない場合は追加する
- [ ] `tests/support/hermetic.py` の `block_network()` autouse fixture が `tests/unit/` 全体に適用されていることを確認する。移植元にない場合は実装する
- [ ] hermetic 設定が有効であることを確認する専用テスト（遮断されている状態でソケット接続を試みて失敗することの確認）が存在するかを確認し、**存在しない場合は実装する**（REQ-7.4 はこの専用テストを検証手段として指定している）
- [ ] **その専用テストが非空虚であることを確認する**（憲章 原則 3 / plan §7.7）: `block_network()` の autouse 適用を一時的に外した状態で当該テストが **FAIL** することを確認し、確認後に `git restore` で戻す。**遮断が効いていなくても緑になるテストは要件を満たさない**

### T-2.5 — 移植後の動作を検証する

_Boundary:_ `apps/agent-api/**`
_Depends:_ T-2.3, T-2.4
_Traces:_ REQ-2.5, REQ-2.6

- [ ] `turbo run test --filter=agent-api` を実行し、移植元の全既存テストが通ること、かつ収集件数 > 0 であることを確認する（REQ-2.6）
- [ ] エンドポイント（`/health`, `/health/ready`, `/v1/agent/chat`, `/v1/agent/stream`）が移植後も同等のレスポンスを返すことをテストで確認する（REQ-2.5）

### T-2.6 — turbo の Python タスク自動登録を検証する

_Boundary:_ `scripts/check-python-tasks.sh`, `mise.toml`, `turbo.json`, `apps/agent-api/pyproject.toml`
_Depends:_ T-2.3
_Traces:_ REQ-1.2, REQ-1.4, REQ-2.7, REQ-7.5

turbo が `apps/agent-api` の `ruff` / `ty` / `pytest` を実際に起動する経路が成立していることを、**解決されたコマンド文字列**で確認する。P0 の唯一の機械的受け入れ条件（REQ-7.x）がこの経路に依存する。

- [ ] `turbo ls` が `agent-api` / TS 9 パッケージ / ワークスペースルート（**`[tool.turbo] name` の値**。ルート `package.json` の `name` ではない — plan §3.1.6a）を列挙することを確認する（REQ-1.4）
- [ ] `turbo run lint check test typecheck --dry=json` が終了コード 0 で完了することを確認する（REQ-1.2）
- [ ] 以下の 3 コマンドが `--dry=json` の `command` フィールドに現れることを確認する（**plan §3.1.6 / 調査 15 の実測値と完全一致すること。`--filter=agent-api` で `check:ty` は `agent-api` スコープに解決される — ルート集約は起きない**）:
  - `lint` → `agent-api#lint:ruff` = `uv run --frozen --package agent-api ruff check apps/agent-api`
  - `check` → `agent-api#check:ty` = `uv run --frozen --package agent-api ty check apps/agent-api`
  - `test` → `agent-api#test` = `uv run --frozen --package agent-api pytest apps/agent-api`
- [ ] **TS 側が turbo で走らないことを確認する（設計どおりであることの確認）**: `turbo run lint --dry=json`（フィルタなし）の出力に **`biome` を含むコマンドが 1 件も現れない**こと、`turbo run test --dry=json` に **`vitest` を含むコマンドが 1 件も現れない**ことを確認する。**これは欠陥ではなく実測済みの turbo の挙動である**（plan §3.1.6a: ルート `package.json` の `scripts` は解決されず、TS 9 パッケージは `lint` / `test` を持たない）。TS レーンは T-8.1a が担当する。**もし現れた場合は前提が変わったことを意味するため plan §3.1.6a を再実測して更新する**
- [ ] `turbo run typecheck --filter=agent-api --dry=json` に `uv run` で始まるコマンドが 1 件以上現れることを確認する（`typecheck` は Python 側で未登録であり、`dependsOn: ["codegen","check"]` 経由でのみ到達する。**件数ではなくコマンド文字列で判定する** — 実測ではタスク 2 件が両方 `<NONEXISTENT>` になりうる）
- [ ] plan §7.5 のガードスクリプトを `scripts/check-python-tasks.sh` として実装する（`set -euo pipefail` ＋ `|| echo 0` ＋ `${COUNT:-0}` を含めること）
- [ ] **ガードの実効性を 3 状態で確認する**（調査 15 で確認済みの期待値を再現すること）:
  - 正常状態 → 終了コード **0**
  - `[dependency-groups] dev` から一時的に `ruff` を外して `uv lock` → 終了コード **1**
  - ルート `uv.lock` を一時退避（turbo がハードエラー）→ 終了コード **1**（`|| echo 0` ＋ `${COUNT:-0}` が機能していることの確認。第 3 回 H5 の再発防止）
  - 確認後は **`git restore apps/agent-api/pyproject.toml && uv lock` を実行して元の状態に戻し、`uv lock --check` で整合性を確認してからコミットする**（`pyproject.toml` / `uv.lock` の戻し忘れを防ぐ）（REQ-2.7 / REQ-7.5）

### Implementation Notes

---

## T-3 — §2.6.3 二層バージョン方針の lock 確認

_Boundary:_ `uv.lock`, `services/agent/**`
_Depends:_ T-0.2, T-2.3
_Traces:_ REQ-3.1, REQ-3.2, REQ-3.3

`apps/agent-api`（litellm 層）と `services/agent`（非 litellm 層）の lock 解決結果がそれぞれ仕様通りであることを確認し、その証跡を PR に添付できる形で準備する。`services/agent/` は T-0.2 の取り込みで配置済みである。

### T-3.1 — `services/agent` の lock 解決状態を確認する

_Boundary:_ `services/agent/**`
_Depends:_ T-0.2, T-2.3
_Traces:_ REQ-3.1, REQ-3.3

- [ ] `pip-audit` の実行形は**実測により確定済み**（第 7 回 C2 / 調査 16-3: `services/agent/uv.lock` が実在する）: **`cd services/agent && uv export --frozen --no-dev | pip-audit -r /dev/stdin`**。**ここで形式を決めない**
- [ ] **`services/agent/uv.lock`** をパースし `pydantic-ai-slim` が 2.33.x 系に解決していることを確認する（取り込み時点の状態維持、REQ-3.1）。`litellm` が依存に含まれないことも併せて確認する（二層方針の非 litellm 層であることの根拠）
- [ ] ルート `uv.lock` の更新差分においていずれのパッケージもバージョンがダウングレードされていないことを目視確認する（REQ-3.3）

### T-3.2 — 両 lock の `pip-audit` 生出力を PR 添付用に準備する

_Boundary:_ `uv.lock`, `services/agent/**`
_Depends:_ T-3.1
_Traces:_ REQ-3.2

- [ ] `uv export --frozen --no-dev --package agent-api | pip-audit -r /dev/stdin` を実行し、出力全体をテキストとして保存する
- [ ] `services/agent` の lock に対する `pip-audit`（T-0.2 で確定したコマンド）を実行し、出力全体をテキストとして保存する。**`pip-audit -r <uv.lock>` は使わない**（`uv.lock` は TOML であり requirements 形式ではない）
- [ ] 両出力を PR 本文にそのまま貼付できるよう準備する（「監査は通った」という要約は不可）

### Implementation Notes

---

## T-4 — `AGENTS.md` / `CLAUDE.md` の v1.5 整合

_Boundary:_ `AGENTS.md`, `CLAUDE.md`, `specs/`
_Depends:_ T-1.1
_Traces:_ REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5, REQ-5.6

D1〜D3 は既に解消済みのため回帰確認（grep アサート）を行う。D4 は `git add` + commit、D5 は `AGENTS.md` のツールチェーン記述の更新。`AGENTS.md` と `CLAUDE.md` は 1 変更単位として同一 commit で変更することが必須要件である。

### T-4.1 — `AGENTS.md` の D1/D2/D5 を確認・修正し `CLAUDE.md` とともに commit する

_Boundary:_ `AGENTS.md`, `CLAUDE.md`
_Depends:_ T-1.1
_Traces:_ REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.4, REQ-5.5, REQ-5.6

- [ ] `AGENTS.md` に `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` と記述されており `openai` extra および `openai<3.0.0` の明示ピンが**ない**ことを grep で確認する（D1 回帰確認、REQ-5.1）
- [ ] `AGENTS.md` に「フロアを ≥2.32 に上げると litellm が 1.83.0 へ後退する」という文字列が**ない**ことを grep で確認する（D2 回帰確認、REQ-5.2）
- [ ] `CLAUDE.md` の比較表において `apps/agent-api` の依存制約が REQ-5.1 と同内容であることを grep で確認する（D3 回帰確認、REQ-5.3）
- [ ] `AGENTS.md` のツールチェーン記述（プロジェクト概要行）を `uv 0.12`（系）/ `pnpm 11.24`（系）に更新し、`mise.toml` の宣言と一致させる（D5 修正、REQ-5.6）
- [ ] `AGENTS.md` / `CLAUDE.md` / `specs/` を `git add` し、`git ls-files` に 3 者が現れることを確認する（D4 解消、REQ-5.4）
- [ ] `AGENTS.md` と `CLAUDE.md` の変更を同一 commit にまとめる（別々の commit は規約違反、REQ-5.5）
- [ ] **上記の grep 確認 4 件（REQ-5.1 / 5.2 / 5.3 / 5.6）を T-9.2 のアサートテストとして実装する**。REQ-5.1〜5.3 は「v1.2 時代の記述が再導入されていないこと」の回帰確認要件であり、手動 `grep` は次回の改変を検知できないためテストの実体が要件そのものである

### Implementation Notes

---

## T-5 — CI パイプライン整備と品質ゲートの確立

_Boundary:_ `.github/workflows/lint.yml`, `.github/workflows/tests.yml`, `.github/workflows/python.yml`, `.github/workflows/security-daily.yml`, `.githooks/pre-commit`, `mise.toml`, `apps/agent-api/tests/unit/test_ci_workflows.py`
_Boundary 除外:_ **`.github/workflows/ci.yml`（新規作成しない — 上流に存在せず、既存 workflow と二重経路になる。第 7 回 N2）**, `eval-pr.yml` / `eval-nightly.yml`（REQ-0.4 により無変更）
_Depends:_ T-1.1, T-2.3, T-4.1
_Traces:_ REQ-6.1, REQ-6.2, REQ-6.3, REQ-8.2, REQ-9.1, REQ-9.2, REQ-9.3, REQ-9.4, REQ-10.3

CI ジョブを整備し、`lint` / `test:unit` / `turbo-version-check` / `audit` の 4 ジョブすべてがブロッキングで存在する状態を作る。pre-commit フックに `apps/web/AGENTS.md` 残留チェックを追加し、単一経路制約（REQ-10.3）に従って `.githooks/pre-commit` を唯一の入口とする。

### T-5.0 — 実在する workflow の棚卸しと不足検査の合流

_Boundary:_ `.github/workflows/lint.yml`, `.github/workflows/tests.yml`, `.github/workflows/python.yml`, `.github/workflows/security-daily.yml`
_Boundary 除外:_ **`.github/workflows/ci.yml`（新規作成しない）**, `.github/workflows/eval-pr.yml`, `.github/workflows/eval-nightly.yml`（REQ-0.4 により無変更）
_Depends:_ T-0.2, T-2.3
_Traces:_ REQ-9.1, REQ-9.3, REQ-9.4

> **前提の訂正（第 7 回 N2 / 調査 16-4）**: **上流に `ci.yml` は存在しない。** `.github/workflows/` の実体は 6 ファイル（`eval-nightly.yml` / `eval-pr.yml` / **`lint.yml`** / **`python.yml`** / **`security-daily.yml`** / **`tests.yml`**）であり、**lint / test / Python / セキュリティ監査はすでに独立 workflow として稼働している**。
>
> したがって `ci.yml` を新規作成することは既存パイプラインと**並行する第 2 の CI 経路を作る**行為であり、**憲章 原則 5（既存の単一経路に合流させる）に違反する**（plan §10 R-P0-11）。**新規 workflow ファイルを作らないこと。**

- [ ] **棚卸し**: 実在する 6 workflow を YAML パースし、各 `jobs` の `job_id` と `steps` の一覧を Implementation Notes に記録する。そのうえで plan §3.9 の合流方針表の各検査（TS lint / Python lint / typecheck / TS test / Python test / turbo-version-check / audit）が**どのファイルのどのジョブに存在するか / 存在しないか**を判定する。**不在を沈黙して通過させないこと**（REQ-9.1）
- [ ] **不足分のみ**を既存ファイルへ追加する（plan §8.1 の具体形に従う）。**既に存在する検査を別ファイルに重複実装した場合は不合格**（原則 5）
  - `lint.yml`: TS Biome ＋ `scripts/check-ts-lanes.sh`（REQ-7.6）＋ `turbo run lint` ＋ `ruff format --check` ＋ `turbo run typecheck`
  - `tests.yml`: `scripts/check-python-tasks.sh`（REQ-7.5）＋ `turbo run test` ＋ `pnpm run test:run`（**`test` ではない — ルートの `test` は `vitest` watch モード**）
  - `security-daily.yml`: §8.2 の `pip-audit`（`pnpm audit` が既存なら重複させない）
- [ ] **job_id にコロンを使わない**（第 7 回 H3）: GitHub Actions の `job_id` は先頭が英字または `_`、以降は英数字 / `-` / `_` のみで **`:` を含められない**。新規ジョブの job_id は **`test-unit`** の形とし、表示名が必要なら `name: "test:unit"` を併記する。**旧 plan §8.1 の `test:unit:` はパース時に拒否される記述だった**
- [ ] REQ-9.1 のアサートを **job_id の厳密な集合**に対して実装する（「または同等の名前」のような曖昧な判定を使わない。曖昧では「不在を沈黙して通過させない」目的が達成できない）
- [ ] `pnpm install --frozen-lockfile` と `uv sync --frozen` を各ジョブの依存解決ステップに置く（REQ-9.4。`uv sync` は**ルートで実行する** — plan §8.3）
- [ ] 追加した全 `uses:` アクションを 40 桁の完全な SHA でピンする（REQ-9.3。**`<40-char-SHA>` のプレースホルダを残さないこと**）
- [ ] **P0 で新規追加・変更する全 CI ジョブに `permissions:` ブロックを明示する**（spec v1.6 §10.2 新規規約 / plan §3.9）。`vaz-ai-next` の既存 6 workflow はすべて `permissions:` 未宣言（デフォルト write-all）である。最低限 `contents: read` を宣言し、必要なもののみ広げる。**未宣言のままにすることは不合格**（SHA ピンと `permissions:` は対で意味を持つ — `permissions:` が無ければ SHA ピンの効果が半減する）
- [ ] 対象ジョブを required status check（ブロッキング）に設定する（REQ-9.1）

### T-5.1 — `turbo-version-check` CI ジョブを追加する

_Boundary:_ `.github/workflows/lint.yml`
_Depends:_ T-1.1, T-5.0
_Traces:_ REQ-6.1, REQ-6.2, REQ-9.1, REQ-9.3

- [ ] **`lint.yml` に** `turbo-version-check` ジョブを追加する（plan §3.6 / §8.1 の YAML 設計に従う。**`ci.yml` を新規作成しない** — 第 7 回 N2）
- [ ] ジョブ内で `EXPECTED=$(mise config get tools.turbo)` により `mise.toml` の `[tools].turbo` 値を取得し（grep ベース禁止）、`turbo --version` と等値比較する。不一致の場合は `exit 1` する（REQ-6.1）
- [ ] **版ずらし時に落ちることを確認する**（憲章 原則 3 の非空虚要件 / 第 7 回 M4）: `mise.toml` の `turbo` を一時的に別の版（例 `2.10.12`）に変更した状態でジョブのスクリプトを実行し、**非 0 で終了すること**を確認する。確認後は `git restore mise.toml` で戻す。**「ジョブが存在する」だけで済ませないこと**
- [ ] 全 `uses:` アクションを 40 桁の完全な SHA でピンする（REQ-9.3）
- [ ] このジョブを required status check（ブロッキング）に設定する（REQ-6.2）

### T-5.2 — ローカルでの turbo バージョン不一致検知を追加する

_Boundary:_ `mise.toml`
_Depends:_ T-1.1
_Traces:_ REQ-6.3

- [ ] `mise.toml` の `[tasks]` の `check-versions` タスクが、`PATH` 上の turbo バージョンが `[tools].turbo` と異なる場合に非 0 で終了することを確認する（T-1.1 で実装済みであれば動作確認のみ）
- [ ] 不一致時に `mise install` を促すメッセージが表示されることを確認する

### T-5.3 — `audit` CI ジョブを追加する

_Boundary:_ `.github/workflows/security-daily.yml`
_Depends:_ T-5.0, T-2.3
_Traces:_ REQ-2.4, REQ-9.1, REQ-9.2, REQ-9.3, REQ-9.4

- [ ] **既存の `security-daily.yml` に** `pip-audit` ステップを追加する（**`ci.yml` を新規作成しない**。`pnpm audit` が既存であれば重複実装しない — 原則 5 / 第 7 回 N2）
- [ ] `pnpm audit --audit-level=moderate` ステップを追加する
- [ ] `uv export --frozen --no-dev --package agent-api | pip-audit -r /dev/stdin` と plan §8.2 の `--ignore-vuln` 引数全件（starlette 5 件 + chromadb 3 件）を記述する。シェルの行継続（`\`）で引数が欠落しないことを確認する（REQ-9.2）
- [ ] 実際に渡った引数を検証する: `--ignore-vuln` の出現回数が 8 であることを確認する（コメントと行継続の併用による欠落の排除）
- [ ] `pnpm install --frozen-lockfile` と `uv sync --frozen` ステップを CI に追加する（REQ-9.4）
- [ ] 全 `uses:` アクションを 40 桁 SHA でピンする（REQ-9.3）

### T-5.4 — pre-commit フックに `apps/web/AGENTS.md` 残留チェックを追加する

_Boundary:_ `.githooks/pre-commit`
_Depends:_ T-0.2, T-7.1
_Traces:_ REQ-8.2, REQ-10.3

- [ ] `.githooks/pre-commit` に plan §3.8 のスクリプトを追加する（`apps/web/` が不在の場合は `exit 1` でフェイルファストする設計）
- [ ] 残留判定は **`grep -qE '^\?\?|^.[^ ]'`** を用いる（未追跡 `??` と worktree 側の未ステージ変更のみを失格にする）。**`grep -q '^[^?]'` は使わない** — 実測で「未追跡が通過し、ステージ済みが失格になる」判定の反転が確認されている（plan §3.8）
- [ ] **3 状態それぞれでフックの終了コードを確認する**（REQ-8.2）:
  - `apps/web/AGENTS.md` を未追跡状態にして → 非 0 で終了すること
  - `git add` 済み（ステージ済み）にして → **0 で終了すること**（`next dev` が毎回再生成するため、正常系を失格にするとこのファイルを含む以後のコミットが恒常的にブロックされる）
  - コミット後に内容を変更して未ステージ状態にして → 非 0 で終了すること
- [ ] `apps/web/` を一時的に退避した状態でフックが非 0 で終了すること（対象不在の沈黙パスの排除、REQ-8.2）
- [ ] `pre-commit` フレームワーク（`.pre-commit-config.yaml`）を使用する場合は `.githooks/pre-commit` から `pre-commit run` を呼び出す形に統一し、同一検査が複数機構に重複実装されていないことを確認する（REQ-10.3）

### T-5.5 — `test_ci_workflows.py` を移植し SHA ピン / `permissions:` を機械検証する

_Boundary:_ `apps/agent-api/tests/unit/test_ci_workflows.py`
_Depends:_ T-5.1, T-5.3
_Traces:_ REQ-9.3

> **前提（spec v1.6 §10.2 / plan §7.4 / R-P0-13）**: `test_ci_workflows.py` は `fastapi-pydantic-ai-agent` の資産であり `vaz-ai-next` には**存在しない**。「既存テストが自動でカバーする」という前提は誤りであり削除した。本タスクは P0 の新規作業として移植・修正を行う。

- [ ] `fastapi-pydantic-ai-agent@d4d5f8d` の `tests/unit/test_ci_workflows.py` を `apps/agent-api/tests/unit/test_ci_workflows.py` へコピーする
- [ ] コピー後、走査パスを本リポジトリの `.github/workflows/` を指すように変更する（例: `Path(__file__).resolve().parents[3] / ".github/workflows"` 等。移植元のパスは `fastapi-pydantic-ai-agent` のリポジトリ構造に依存しているため必ず変更すること）
- [ ] テスト冒頭で `workflows_dir` に `mise.toml` と同居していること（= リポジトリルートの正しい解決）をアサートする行を追加または確認する（ルートを取り違えたテストが走査対象 0 件で緑になる経路の封鎖 — plan §7.6）
- [ ] **走査対象ファイル数 > 0 のアサートが存在することを確認する**。不在の場合は追加する（REQ-9.3）
- [ ] **`permissions:` 未宣言の検出ロジックを追加または確認する**（spec v1.6 §10.2）: 上流 `vaz-ai-next@bbf1156` の全 6 workflow は `permissions:` 未宣言（デフォルト write-all）であり、P0 で追加したジョブも対象に含まれる。テストが `permissions:` 未宣言を検出することを確認すること
- [ ] **非空虚性の確認**: ワークフローファイルを 1 つ一時退避（`mv lint.yml lint.yml.bak`）してテストが FAIL することを確認し、元に戻す（走査対象 0 件で緑になる経路が塞がれていることの確認 — 憲章 原則 3 / plan §7.7）
- [ ] **SHA ピン未完の状態でテストが FAIL することを確認する**: P0 で新規追加したジョブの `uses:` に可変タグ（`@v4` 等）を一時的に残した状態でテストが非 0 で終了することを確認し、すべての `uses:` を 40 桁 SHA に変換した後に GREEN になることを確認する
- [ ] 上流 `vaz-ai-next@bbf1156` の既存 21 `uses:`（すべて可変タグ）を 40 桁 SHA に変換する。変換は `gh api` または `actions/checkout@v5` 等の SHA を GitHub API / Release ページで取得し手書きせず入力する

### Implementation Notes

---

## T-6 — モデル ID ハードコード禁止の展開

_Boundary:_ `apps/agent-api/app/config/settings.py`, `.pre-commit-config.yaml`, `.githooks/pre-commit`, `scripts/forbid-model-ids.sh`
_Depends:_ T-0.2, T-2.1
_Traces:_ REQ-10.1, REQ-10.2, REQ-10.3

既存の `forbid-model-ids.sh` / pygrep ゲートの適用範囲を `apps/agent-api` まで拡張し、モデル ID が環境変数経由で解決されていることを確認する。`.githooks/pre-commit` を単一の入口として重複実装を排除する（REQ-10.3）。

### T-6.1 — `apps/agent-api` のモデル ID が環境変数から解決されていることを確認する

_Boundary:_ `apps/agent-api/app/config/settings.py`
_Depends:_ T-2.1
_Traces:_ REQ-10.2

- [ ] `apps/agent-api/app/config/settings.py`（または相当ファイル）の `llm_model` が `os.environ` または `pydantic-settings` で解決されており、ソースコードにハードコードされていないことを確認する
- [ ] ハードコードが発見された場合は環境変数参照に修正する

### T-6.2 — pygrep フックを `apps/agent-api` に適用し単一経路を確立する

_Boundary:_ `.pre-commit-config.yaml`, `scripts/forbid-model-ids.sh`, `.githooks/pre-commit`
_Depends:_ T-0.2, T-6.1
_Traces:_ REQ-10.1, REQ-10.3

- [ ] `scripts/forbid-model-ids.sh` が存在し `.py` ファイルも走査することを確認する。T-0.2 で `test -x` に失敗していた場合はここで新規作成する（REQ-10.1）
- [ ] `.pre-commit-config.yaml` の `no-hardcoded-model-id` pygrep フックが `apps/agent-api` の `.py` ファイルを対象とすることを確認・追加する
- [ ] **モデル ID 許可リストに spec v1.6 §2.4 が定める 3 ファイルすべてが除外設定されていることを確認する**（spec §2.4 訂正: 旧版 2 件から 3 件へ）: `packages/config/src/model-allowlist.ts` / `packages/schemas/src/env.ts` / **`services/agent/app/config.py`**（`scripts/forbid-model-ids.sh` の対象外リスト行 41-43）。T-0.2 で記録した 3 件が走査から正しく除外されていることを確認する
- [ ] 許可リスト外のファイルへのモデル ID 直書きが検出されることを確認する（既知モデル ID を含む一時ファイルを置いてフックが非 0 で終了することをテストする）
- [ ] `.githooks/pre-commit` がこれらすべての検査の唯一の入口になっていることを確認する（重複実装がないことを目視確認、REQ-10.3）

### Implementation Notes

---

## T-7 — `apps/web/AGENTS.md` のコミット管理確立

_Boundary:_ `apps/web/AGENTS.md`, `.gitignore`
_Depends:_ T-0.2, T-1.5
_Traces:_ REQ-8.1

`apps/web/AGENTS.md` が `.gitignore` で無視されず、`next dev` 自動生成後にコミット対象として管理される体制を確立する。T-0.2 で `apps/web/` が取り込み済みであることが前提。

### T-7.1 — `apps/web/AGENTS.md` をコミット管理対象に設定する

_Boundary:_ `apps/web/AGENTS.md`, `.gitignore`
_Depends:_ T-0.2, T-1.5
_Traces:_ REQ-8.1

- [ ] T-1.5 で確認済みの通り `apps/web/AGENTS.md` が `.gitignore` によって無視されないことを再確認する（`git check-ignore -v apps/web/AGENTS.md` が終了コード 1）
- [ ] **`apps/web/` で `next dev` を実行する前に `pnpm install --frozen-lockfile`（ルートで実行）が完了していることを確認する**（`node_modules` が存在しない状態で `next dev` を実行しても `AGENTS.md` は生成されない）
- [ ] `apps/web/` で `next dev` を実行して `apps/web/AGENTS.md` が自動生成されることを確認し、生成されたファイルを `git add` してコミット対象にする
- [ ] `git ls-files apps/web/AGENTS.md` に現れることを確認する

### Implementation Notes

---

## T-9 — リポジトリ規約アサートテストの実装

_Boundary:_ `apps/agent-api/tests/unit/test_repo_conventions.py`
_Depends:_ T-2.2（**T-1.2 / T-1.5 / T-2.3 / T-4.1 より前に着手する** — 下記 T-9.0 参照）
_Traces:_ REQ-0.4, REQ-0.7, REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.8, REQ-2.2, REQ-2.3, REQ-2.7, REQ-4.1, REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.6

spec.md が `[検証: 機械（… アサートテスト）]` と指定した **16 要件**の検証実体を実装する。**単一モジュール `apps/agent-api/tests/unit/test_repo_conventions.py` に集約する**（plan §7.6。turbo はパッケージ単位で `test` を走らせるため、ルート直下に置くと `turbo run test` から漏れる）。

> **憲章 原則 9 / 原則 3 への適合（第 7 回 C1 / plan §7.7）**: 本タスク群は「既に正しくなった設定に後からテストを書く」順序に置かれていたため、**16 要件の検証実体が一度も RED を観測しない**状態だった。原則 9 は MUST NOT、原則 3 は非空虚性を MUST とする。対処は 2 段構えである:
> 1. **T-9.0** を T-2.2 直後（`tests/unit/` が出現した直後・アサート対象が未完成のうち）に置き、**RED を観測する**
> 2. 順序で担保できない項目は **T-2.6 と同形式**（壊す → FAIL 確認 → `git restore` → 整合確認）で代替する。**これは任意項目ではなく必須である**

### T-9.0 — アサートテストを RED 状態で書き、失敗を観測する

_Boundary:_ `apps/agent-api/tests/unit/test_repo_conventions.py`
_Depends:_ T-2.2
_Traces:_ REQ-0.4, REQ-0.7, REQ-1.2, REQ-1.3, REQ-1.8, REQ-2.3, REQ-4.1, REQ-5.6

この時点で `turbo.json`（T-1.2）・`.gitignore` のポリグロット対応（T-1.5）・`uv.lock`（T-2.3）・`AGENTS.md` の D5 修正（T-4.1）は**まだ未完成**である。その状態でアサートを書き、**落ちることを確認する**のが本タスクの目的である。

- [ ] `test_repo_conventions.py` を新規作成し、リポジトリルートの解決関数と**モジュール冒頭の `mise.toml` 存在アサート**を実装する
- [ ] **ルート解決アサート自体の非空虚性を確認する**: `parents[N]` の `N` を一時的に 1 つずらし、**モジュール全体が FAIL** することを確認して戻す。**ここを外すと 16 要件すべてが対象 0 件で緑になる**（`test_ci_workflows.py` と同じ注意点）
- [ ] 以下のアサートを書き、**`pytest` を実行して FAIL（RED）することを観測し、出力を Implementation Notes に貼る**:
  - `turbo.json` の存在・`futureFlags`・`check` タスク・`typecheck.dependsOn`（REQ-1.2 / 1.3）→ T-1.2 未完了のため FAIL
  - `git check-ignore` 5 件の終了コード（REQ-1.8）→ T-1.5 未完了のため `apps/web/lib/x.ts` が FAIL
  - `uv.lock` の `pydantic-ai-slim` / `litellm` 下限（REQ-2.3）→ T-2.3 未完了のため FAIL
  - `import-baseline.json` との `package.json` 名・workflow hash 照合（REQ-0.4 / 4.1）
  - ルート `package.json` の `packageManager` と `mise.toml` の `pnpm` 一致（REQ-0.7）→ 更新前は `11.19.0` のため FAIL
  - `AGENTS.md` の `uv` / `pnpm` 記述と `mise.toml` の一致（REQ-5.6）→ T-4.1 未完了のため FAIL
- [ ] **1 件も FAIL しない場合は、アサートが空虚である可能性を疑って原因を特定する**（憲章 原則 9: 予期せぬ結果は停止して根本原因を特定する。抑止・スキップ・リトライで進めないこと）

### T-9.1 — 設定ファイルのアサートテストを完成させ GREEN 化する

_Boundary:_ `apps/agent-api/tests/unit/test_repo_conventions.py`
_Depends:_ T-9.0, T-1.2, T-1.5, T-2.3
_Traces:_ REQ-0.4, REQ-0.7, REQ-1.1, REQ-1.2, REQ-1.3, REQ-1.4, REQ-1.8, REQ-2.2, REQ-2.3, REQ-2.7, REQ-4.1

- [ ] リポジトリルートの解決関数を実装し、**解決したルートに `mise.toml` が存在することをモジュール冒頭でアサートする**（ルートを取り違えたテストは対象 0 件で緑になる。`test_ci_workflows.py` と同じ注意点）
- [ ] ルート `pyproject.toml` に `[tool.turbo] name` が存在し非空であること、`[tool.uv.workspace].members` に **`"apps/agent-api"` が含まれていない**こと（ADR-P0-05 候補 (a) — `apps/agent-api` は独自 `uv.lock` を持ち workspace メンバーではない / plan §5）、かつ**実体のないパスが含まれていない**ことをアサートする（REQ-1.4）
- [ ] `mise.toml` を TOML パースし `[tools]` の `node` / `python` / `pnpm` / `uv` / `turbo` の値をアサートする。`turbo` は完全固定文字列（`>=` / `~=` / `x` を含まないこと）（REQ-1.1）
- [ ] `turbo.json` を JSON パースし `$schema` / `futureFlags.experimentalPythonWorkspaces == true` / `build` `codegen` `lint` `check` `typecheck` `test` `test:e2e` `evals` の定義存在をアサートする（REQ-1.2）
- [ ] `turbo.json` の `tasks.typecheck.dependsOn` に `"codegen"` と `"check"` の両方が含まれることをアサートする（REQ-1.3）
- [ ] `apps/agent-api/pyproject.toml` の `dependencies` をパースし、`pydantic-ai-slim` の extra リストに `openai` が**無い**こと、`openai` の明示ピン行が無いことをアサートする（REQ-2.2）
- [ ] `apps/agent-api/pyproject.toml` の `dependencies` に `pydantic-ai-litellm>=0.2.3,<0.3.0` が含まれることをアサートする（上限は `<0.3.0` であり `<1.0` は誤り — REQ-2.2 の付随検証）
- [ ] ルート `uv.lock` をパースし `pydantic-ai-slim >= 2.35` / `litellm >= 1.98.0` をアサートする（REQ-2.3）
- [ ] `apps/agent-api/pyproject.toml` の `[dependency-groups] dev` に `ruff` / `ty` / `pytest` が含まれることをアサートする（REQ-2.7）
- [ ] ルート `package.json` に `packageManager` または `devEngines.packageManager` フィールドが存在し、`mise.toml` の `pnpm` ピンのメジャー・マイナーと矛盾しないことをアサートする（REQ-0.7）
- [ ] `import-baseline.json` と現在の各 `package.json` の `name` / ディレクトリ名が一致することをアサートする（REQ-4.1）
- [ ] `import-baseline.json` の `workflow_hashes` と `git hash-object .github/workflows/eval-pr.yml` / `eval-nightly.yml` の現在値が一致することをアサートする（REQ-0.4。`subprocess.run(["git", "hash-object", path])` で取得する）
- [ ] `git check-ignore` を `subprocess.run` で呼び出し、以下 **5 件**のパスの終了コードをアサートする（REQ-1.8）:
  - `packages/api-types/generated/x.ts` → 終了コード 1（マッチなし = 無視されない）
  - `apps/web/AGENTS.md` → 終了コード 1（マッチなし）
  - `apps/web/lib/x.ts` → 終了コード 1（マッチなし）
  - `.sdd/reviews/x.md` → 終了コード 0（マッチあり = 無視される。追跡外の作業領域）
  - **`specs/memory/constitution.md` → 終了コード 1（マッチなし = 憲章 v1.1.0 の正本は追跡対象）**
- [ ] **`mise.toml` の `[tasks]` キー集合が `import-baseline.json` に記録した上流の集合を包含すること**をアサートする（`lint:model-ids` を含む 19 タスクの欠落検知。REQ-1.1 / 第 7 回 N3 / R-P0-10）
- [ ] **否定アサート（「〜が無いこと」）の前に対象ファイルの存在と非空をアサートする**（読めなかった場合に成立する偽陰性の排除）
- [ ] **【必須】各アサート群の非空虚性を確認する**（憲章 原則 3 / plan §7.7。T-2.6 と同形式: 壊す → FAIL 確認 → `git restore` → 整合確認）。少なくとも以下 3 群を個別に確認し、結果を Implementation Notes に記録する:
  - `git check-ignore` 群 → `.gitignore` に `apps/web/lib/` を一時追加 → 当該アサートのみ FAIL
  - 否定アサート群（REQ-2.2） → `apps/agent-api/pyproject.toml` に `openai` extra を一時追加 → 当該アサートのみ FAIL（**戻した後 `uv lock --check` で整合を確認する**）
  - `mise.toml` タスク包含 → 1 タスクを一時削除 → FAIL
  - **`[ ]*`（任意）にしてはならない。** 壊して落ちることを確認していないアサートは憲章 原則 3 により「テストとして数えない」

### T-9.2 — `AGENTS.md` / `CLAUDE.md` の回帰アサートテストを実装する

_Boundary:_ `apps/agent-api/tests/unit/test_repo_conventions.py`
_Depends:_ T-4.1
_Traces:_ REQ-5.1, REQ-5.2, REQ-5.3, REQ-5.6

- [ ] `AGENTS.md` に `pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0` が存在し、`openai` extra と `openai` の明示ピンが**無い**ことをアサートする（REQ-5.1）
- [ ] `AGENTS.md` に「フロアを ≥2.32 に上げると litellm が 1.83.0 へ後退する」旨の v1.2 時代の警告が**無い**ことをアサートする（REQ-5.2）
- [ ] `CLAUDE.md` の比較表の `apps/agent-api` 行が REQ-5.1 と同内容であることをアサートする（REQ-5.3）
- [ ] `mise.toml` の `[tools].uv` / `.pnpm` から `x` を除いたメジャー・マイナー部分が `AGENTS.md` の記述と文字列一致することをアサートする（REQ-5.6 の比較規則）
- [ ] **【必須】否定アサート 2 件の非空虚性を確認する**（憲章 原則 3 / plan §7.7）:
  - REQ-5.1 → `AGENTS.md` に `openai` extra 付きの記述（`pydantic-ai-slim[logfire,openai,ui,evals]`）を一時追記 → 当該アサートが FAIL することを確認 → `git restore AGENTS.md`
  - REQ-5.2 → `AGENTS.md` に「フロアを ≥2.32 に上げると litellm が 1.83.0 へ後退する」旨の文を一時追記 → FAIL を確認 → `git restore`
  - **D1〜D3 は既に解消済みの状態で取り込まれるため RED を先に観測できない。この「壊して確認する」手順が回帰テストとしての実効性の唯一の根拠である**

### Implementation Notes

---

## T-8 — 全体検証：`turbo run lint test` 両言語通過

_Boundary:_ `apps/agent-api/**`, `apps/web/**`, `turbo.json`, `mise.toml`, `scripts/check-ts-lanes.sh`, `scripts/record-coverage-baseline.sh`, `specs/001-agentic-ai-core-p0/coverage-baseline.json`
_Depends:_ T-2.6, T-3.2, T-4.1, T-5.3, T-6.2, T-7.1, T-9.1, T-9.2
_Traces:_ REQ-7.1, REQ-7.2, REQ-7.3, REQ-7.5, REQ-7.6, REQ-7.7

P0 の最終受け入れ条件として、両言語の lint / typecheck / test が警告・エラーなしに通ることを確認する。

> **`turbo run lint test` だけでは受け入れ条件を満たさない（第 7 回 N1 / plan §3.1.6a）**: turbo はルート `package.json` の `scripts` を解決せず、上流の TS 9 パッケージは `lint` / `test` を持たない（`typecheck` のみ）。したがって **`turbo run lint` / `turbo run test` は TS を 1 件も実行しない**。両言語が 1 コマンドで通るのは **`turbo run typecheck` のみ**である。TS レーンは **T-8.1a** が担当する。入口は `mise run check-all`（T-1.1 で作成）。

### T-8.1 — Python の lint とガードを通す

_Boundary:_ `apps/agent-api/**`, `turbo.json`
_Depends:_ T-2.6, T-6.2
_Traces:_ REQ-7.1, REQ-7.5

- [ ] `scripts/check-python-tasks.sh`（T-2.6）を実行し、`lint` / `check` / `test` のそれぞれで `uv run` で始まるコマンドが 1 件以上解決されることを確認する（REQ-7.5。**タスク件数ではなくコマンド文字列で判定する**）
- [ ] `turbo run lint` を実行し、Python（`agent-api#lint:ruff` = `uv run … ruff check`）が警告・エラーなしで完了することを確認する（REQ-7.1）。**この時点で TS の Biome は走らない。それは欠陥ではなく実測済みの挙動である**（T-8.1a が担当）
- [ ] `uv run --frozen --package agent-api ruff format --check apps/agent-api`（= `mise run lint:format`）を実行し、書式エラーがないことを確認する。**turbo の `format:ruff` は `--check` を付けずファイルを書き換えるため使わない**（REQ-7.1 / plan §3.1.6）
- [ ] lint / 書式エラーが出た場合は修正する

### T-8.1a — TS レーン（Biome / Vitest）を turbo の外で通し、ゼロ件ガードを実装する

_Boundary:_ `scripts/check-ts-lanes.sh`, `apps/web/**`, `packages/**`
_Depends:_ T-1.4, T-7.1
_Traces:_ REQ-7.1, REQ-7.3, REQ-7.6

TS の lint / test は turbo の外にあるため（plan §3.1.6a）、Python 側（REQ-7.5）と**対称のゼロ件ガード**を置く。`biome.json` / `vitest.config.ts` の取り込み漏れが沈黙して通過する経路を塞ぐ。

- [ ] `pnpm exec biome check .` を実行し、警告・エラーなしで完了することを確認する（REQ-7.1 の TS 側）
- [ ] `pnpm run test:run`（= `vitest run`）を実行し、全テストが通ることと**収集件数 > 0** を確認する（REQ-7.3 の TS 側）。**ルートの `test` スクリプトは `vitest` = watch モードなので使わない**（CI がハングする）
- [ ] plan §7.5a のガードを `scripts/check-ts-lanes.sh` として実装する（`set -euo pipefail` ＋ `|| echo 0` ＋ `${VAR:-0}` を含めること）
- [ ] **`--reporter=json` の出力キー名を実物で確認して確定する**（`@biomejs/biome` 2.5.x の走査ファイル一覧キー / `vitest` 4.1.x の `numTotalTests`）。取り込み前は両ツールが存在せず未実測であるため、**推測で確定しないこと**（憲章 原則 8）。実測結果を Implementation Notes に記録する
- [ ] **【必須】ガードの実効性を確認する**（REQ-7.6 / 憲章 原則 3）: `biome.json` を一時退避 → ガードが**非 0** で終了することを確認 → 復元。同様に `vitest.config.ts` を一時退避 → 非 0 を確認 → 復元

### T-8.2 — `turbo run typecheck` を両言語で通す

_Boundary:_ `apps/agent-api/**`, `apps/web/**`, `turbo.json`
_Depends:_ T-2.6
_Traces:_ REQ-7.2

- [ ] `turbo run codegen` を実行してから `turbo run typecheck` を実行し、`dependsOn: ["codegen", "check"]` が機能していることを確認する
- [ ] TS（`tsc --noEmit`）と Python（`check:ty` = `uv run ... ty check`）の両方が型エラーなしで完了することを確認する
- [ ] `turbo run typecheck --filter=agent-api --dry=json` に `uv run` で始まるコマンドが 1 件以上現れることを確認する（Python 側が `<NONEXISTENT>` のまま成功する状態を不合格とする — REQ-7.2）

### T-8.3 — `turbo run test` を両言語で通す

_Boundary:_ `apps/agent-api/**`, `apps/web/**`, `turbo.json`
_Depends:_ T-8.1, T-8.2, T-9.1, T-9.2
_Traces:_ REQ-7.3

- [ ] `turbo run test` を実行し、**Python**（`agent-api#test` = `pytest`。T-9 のアサートテストを含む）の全テストが通ること、かつ**収集件数 > 0** であることを確認する（REQ-7.3 の Python 側）
- [ ] **TS 側は T-8.1a が担当する**（`turbo run test` は Vitest を実行しない — plan §3.1.6a）。T-8.1a が完了していることを確認する
- [ ] 移植元テストで失敗があれば原因を特定して修正する（**抑止・スキップ・リトライで進めないこと** — 憲章 原則 9）

### T-8.4 — 分岐カバレッジの実測ベースラインを記録する

_Boundary:_ `scripts/record-coverage-baseline.sh`, `specs/001-agentic-ai-core-p0/coverage-baseline.json`
_Depends:_ T-8.1a, T-8.3
_Traces:_ REQ-7.7

憲章 v1.1.0 の `TODO(BRANCH_COVERAGE_THRESHOLD)` は「分岐カバレッジのしきい値は **P0 で** 実測ベースラインを取得したあと次回改正で確定する」と P0 に作業を割り当てている。**P0 はしきい値を設けずブロックしない**（計測と記録のみ。根拠のない数値を先に固定することは憲章 原則 8 に反する）。

- [ ] `pnpm exec vitest run --coverage` を実行し TS の branch カバレッジ値を取得する
- [ ] `uv run --frozen --package agent-api pytest --cov apps/agent-api` を実行し Python の branch カバレッジ値を取得する
- [ ] 両者を `specs/001-agentic-ai-core-p0/coverage-baseline.json` に数値として記録してコミットする（測定日・ツール版・対象パッケージを併記する）
- [ ] `scripts/record-coverage-baseline.sh` として再実行可能な形にまとめ、CI の `test-unit` ジョブに**非ブロッキング**ステップとして追加する（REQ-7.7）

### Implementation Notes

---

_Generated: 2026-08-29T00:00:00Z_
_Revised: 2026-08-29 — spec v1.5 / plan.md v2 対応（T-0 新設、49 件体制）_
_Revised: 2026-08-29 (round 3) — 第 3 回 /sdd-analyze 反映: T-5.0（lint / test:unit ジョブの存在保証）/ T-2.6（turbo の Python タスク検証）/ T-9（規約アサートテスト）新設、pre-commit 判定の反転修正、turbo 検証の実行順序を uv lock 後へ移動、`_Traces:_` の双方向一致、51 件体制_
_Revised: 2026-08-31 — spec-agenticai-core.md v1.6 / plan.md v7 対応（モデル ID 例外 3 件化、`permissions:` 規約追加、ADR-P0-05 候補 (a) 確定に伴う REQ-1.4 アサート修正）_
_Requirements source: specs/001-agentic-ai-core-p0/spec.md_
_Design source: specs/001-agentic-ai-core-p0/plan.md_

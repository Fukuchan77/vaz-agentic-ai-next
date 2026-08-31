# vaz-agentic-ai-next Constitution

本憲章は `specs/001-agentic-ai-core-p0/spec-agenticai-core.md` §1.1 の設計原則 7 件を統治規範として
昇格し、SDD ワークフロー側の規範 4 件を追加したものである。各原則には**検証方法**を併記する。
検証方法を持たない原則は適合判定ができないため、本憲章には置かない。

## Core Principles

### 1. マルチエージェント化はトークン対価で正当化する

マルチエージェント構成の採用は、spec §5.1 の判断フローを通過した場合に **のみ** 許される。
通過には次の 3 条件すべてを満たすことが MUST である。

- (a) タスクが本質的に幅優先探索である
- (b) 単一エージェントでのコンテキスト汚染またはツール数超過を **実測済み** である
- (c) 約 15 倍のトークンコストを回収できる根拠がある

いずれかを欠く場合は単一エージェント + ツールで実装する。P2P swarm は無条件に禁止する。

**根拠**: エージェントはチャット比約 4 倍、マルチエージェントは約 15 倍のトークンを消費する。
一方でリード + サブエージェント構成は単一比 90.2% の性能改善を示した。対価と便益の双方が大きいため、
判断を個別事例ごとに実測へ委ねる。

**検証**: `/sdd-analyze` および各フェーズ後の敵対的レビューで、3 条件の実測記録の有無を確認する。
記録のない導入は設計差し戻しとする。

### 2. 層の責任境界を型で固定する

知覚層（LlamaIndex）／推論層（Pydantic AI）／表現層（AI SDK）の境界を越えるデータは、
Pydantic モデルまたは Zod スキーマで検証されていることが MUST である。非検証データの越境を禁ずる。
`packages/py-schemas` を型の単一の真実源とし、TS 型は生成物として導出する。

境界スキーマを追加するときは、`satisfies z.ZodType<Generated>`（欠落フィールド・型不一致を検出）と
JSON Schema 形状比較（余剰フィールドを検出）の **両方** を必ず維持する。片方だけでは余剰フィールドが
検出できない。

**例外の明示**: `/v1/chat` は raw `Request` / `StreamingResponse` を扱うため OpenAPI 文書に現れず、
この型パイプラインの対象外である（spec §7.4）。したがって Playwright E2E が唯一の回帰検出器であり、
E2E を受け入れ基準から外すことを禁ずる。プロトコルバージョン（`sdk_version=7` ↔ `ai@7.0.x`）は
両側で単一の定数として持ち、一致を CI でアサートする。

**検証**: CI の `codegen-check`（`turbo run codegen` 後に `git diff --exit-code`）、および
`/v1/chat` に対する streaming E2E とガードレール E2E。

### 3. 確率的振る舞いは 4 層で防御する

テストは Unit（決定論）／Integration（`FunctionModel`）／E2E（実プロトコル）／Evals（確率的定量評価）
の 4 層に分離することが MUST である。各層は「保証すること」と「保証しないこと」を明示する。
ある層に別の層の保証を期待してはならない（例: Unit テストでプロトコル適合を検証しない）。

Unit / Integration 層で実 LLM を呼ぶことを禁ずる。`models.ALLOW_MODEL_REQUESTS = False` を conftest で
全域に適用し、`tests/unit/` では autouse fixture でソケットも遮断する。

テストは **非空虚（non-vacuous）** であることが MUST である。実装を壊したときに落ちることを確認していない
テストは、テストとして数えない。live LLM レーンは `EXPECT_LIVE_TESTS` で期待件数を固定し、
0 件収集で緑になる経路を塞ぐ。

**検証**: CI ジョブ `test:unit` / `test:integration` / `test:e2e` / `test:redis`、および
`EXPECT_LIVE_TESTS` による件数アサート。

### 4. 可観測性は後付けしない

Logfire / OpenTelemetry は MVP の第 1 コミットから有効にすることが MUST である。
計装は `logfire.instrument_pydantic_ai()` をプロセス起動時に一括で行い、`Agent(...)` の引数では行わない。
Logfire の初期化は fail-soft とし、可観測性の失敗が起動を止めてはならない。

本番トレースを評価ケースへ変換するデータフライホイールを設計の前提とする。
ダッシュボード構築前に、累積トークンの属性名（`gen_ai.aggregated_usage.*` か `gen_ai.usage.*` か）を
決定し ADR に記録することが MUST である。既定は `use_aggregated_usage_attribute_names=True` である。

**検証**: P1 の受け入れ基準（span ツリーが出ること、属性名が ADR に記録されていること）。

### 5. 既存の単一経路に合流させる

新しい publish 点・throw 点・スキーマ・語彙を追加する前に、**既存の単一経路に合流できないかを先に検討する**
ことが MUST である。ガードレールは 1 か所、監査ログの発火点は 1 か所、embedding の書き込みは 1 パッケージ
（`packages/rag` の single-writer）を維持する。

単一経路を迂回する新エンドポイントは、保証を **静かに** 失う。したがって `/v1/chat` は 5 層
（境界防御 → 表現統合 → ガードレール → 推論 → 知覚）をこの順で通過することが MUST であり、
層 1（`verify_api_key` / `enforce_llm_rate_limit`）と層 3（`build_guarded_toolset()`）は省略不可である。
サブエージェントからの内部呼び出しにも `app.state.limiter` と同じ limiter を使う。
`packages/py-evals` の baseline は既存 TS baseline と同一形式に合流させ、別系統を新設しない。

**検証**: 各フェーズ後の敵対的レビューで、producer 側と caller 側の両方を grep し
「契約は定義されたが結線されていない」欠陥を探す。ガードレール E2E で未認証呼び出しが失敗することを証明する。

### 6. コンテキストは有限のアテンション予算として扱う

コンテキストウィンドウを容量ではなく枯渇資源として扱うことが MUST である。

- (a) システムプロンプトとツール応答は「モデルの意思決定に効く最小の高シグナル情報」に絞る
- (b) 検索結果を先読みで全件積まず、必要になった時点で取得する（just-in-time retrieval）
- (c) 長時間タスクには compaction／構造化ノートテイキング／サブエージェント分離のいずれかを選ぶ
- (d) サブエージェントの出力は **要約単位で** 親へ統合する。生の探索ログを親へ流してはならない

1 エージェントあたりのツール数は **20 以下** が MUST である。超過時はサブエージェント分割または
Tool RAG（`capabilities.ToolSearch`）で対処し、上限の引き上げは選択肢にしない。
ツールの docstring は「何をするか」ではなく「いつ使うか」を書き、ツール名はリソースで名前空間化する。

**検証**: CI ジョブ `tool-count-check`（機械検証）。(a)〜(d) は敵対的レビューでの目視確認。

### 7. 自律性は較正し、監査可能性で裏書きする

承認ゲート（`requires_approval` / `needsApproval`）は **取り消し不能または高リスクな操作にのみ** 付与する
ことが MUST である。それ以外は `AuditTrail` による事後監査でカバーする。
承認要否を実行時ヒューリスティックで動的に決めてはならない。追加は必ずコミットレビューを経た明示的変更とする。

**クライアント提出構造体への承認要否フラグの追加を禁ずる**（MUST NOT）。具体例:
`workflowStepSchema` に `requiresApproval` を追加して `POST /api/jobs` が受け取った値から読む方式は
採らない。承認要否がクライアント制御下に落ちるため、信頼境界（§6.3）に反する。
述語は常にコミット済みのサーバ側コードに置く（`requiresApprovalForKind` の形）。

**根拠**: 本番テレメトリでは permission prompt の 93% が内容を読まれずに承認されており、経験を積むほど
自動承認率が上がる（新規約 20% → 約 750 セッション経験者で 40% 超）。承認ダイアログを広く置くほど
防御は名目化する。

安全性はモデル・ハーネス・ツール・環境の **4 層の責任分界** として設計し、1 層に閉じない。
`VercelAIAdapter` の信頼既定（`manage_system_prompt='server'`, `allow_uploaded_files=False`,
`allowed_file_url_force_download=frozenset()`）を変更してはならない。最後の値に `'allow-local'` を
与える経路が CVE-2026-25580 の SSRF である。

**検証**: P4 の受け入れ基準（approve / deny / malformed の E2E ケース）とレビューでの承認範囲確認。
承認対象ツールが取り消し不能・高リスク操作に限定されていることをレビューで確認する。

### 8. 事実は実測で確定する

ライブラリ API・バージョン解決・ツールの振る舞いに関する主張は、**実測を根拠として** 記録することが
MUST である。机上の推測、ドキュメントの記述のみ、過去の記憶を根拠にしてはならない。

- シグネチャは `inspect` で確認し、誤りが疑われる呼び出しは実際に実行して例外を再現する
- バージョン更新の採否は実インストールで確認する
- 「なぜこのバージョンに固定したか」はコード上のコメントとして残す
- 誤りが判明した記述は訂正ではなく **削除** し、実測結果で置き換える

**根拠**: 本仕様は v1.0 → v1.5 の過程で、`output_retries` の非存在、`dispatch_request` の非合成性、
turbo の Python タスク語彙（`typecheck` は `<NONEXISTENT>`、正しくは `check`）など、机上判断が実測で
覆された事例を複数記録している。

**検証**: `research.md` に investigation として記録されているか、`spec.json` の
`analysis_derived_decisions*` に MEASURED の根拠が付いているかを `/sdd-analyze` で確認する。

### 9. テストを先に書く

実装コードは、それを要求する失敗するテストより先に書いてはならない（MUST NOT）。
RED（失敗を確認）→ GREEN（最小実装）→ REFACTOR の順序を守る。
既に動くコードに合わせて後からテストを書く行為を禁ずる。

テストが予期せず落ちたときは、抑止・スキップ・リトライではなく **停止して根本原因を特定** することが
MUST である。原因を理解しないままの再実行を禁ずる。

**検証**: `tdd-enforcement` skill の適用、およびコミット履歴でテストが実装に先行しているかのレビュー。
カバレッジのしきい値は TODO(BRANCH_COVERAGE_THRESHOLD) として次回改正で確定する。

### 10. 段階ゲートを飛ばさない

実装は spec §11 のロードマップ順（P0 → P8）に進め、各フェーズは **前フェーズの受け入れ基準を満たしてから**
開始することが MUST である。フェーズの並行実行・順序入れ替え・受け入れ基準の事後緩和を禁ずる。

各フェーズ完了後、**新規コンテキストで敵対的レビューを 1 回** 実施することが MUST である。
spec §6.1.1（ガードレール未結線）と §4.4.1（挿入不可能な層）はいずれもこの方法で検出された欠陥である。

SDD の要件フェーズは **人間の承認** を必須とする。仕様フェーズの一括自動承認を禁ずる。
誤読された要件は下流のすべてが継承する。

P8 に到達しないことは失敗ではない。§5.1 のゲートを通過するものがなければ、単一エージェント構成が完成形である。

**検証**: `spec.json` の `approvals` と `phases`、および各フェーズのレビュー記録。
レビュー報告は 1 ラウンド 1 ファイルとし、前ラウンドの報告を上書きしない（上書きにより未解決 CRITICAL の
見落としが実際に発生している）。

**記録の永続性（v1.1.0 で改訂）**: `.sdd/` は `.gitignore` 対象の**作業領域であり永続性を保証しない**。
詳細レポートの置き場所としては使ってよいが、**承認判断の根拠となる記録（ラウンドごとの判定・未解決 CRITICAL・
どの指摘がどこで閉じたか）は git 追跡対象に置くことが MUST である**。

### 11. 依存とバージョンは宣言に従う

`plan.md` に宣言されていない第三者依存の追加を禁ずる。追加が必要なときは先に plan を改正する。
インフラの新規プロビジョニング・構築も同じ規律に従う。

バージョン制約には 2 種類あり、**区別して記録する** ことが MUST である。

- 「新しすぎる版を選ばせない」ピン（例: `fastapi<0.137`, `starlette<1.0`, Python 3.13）
- 「古い脆弱版へ後退させない」対処（例: `openai` extra の省略）— 上流が制約を解消した時点で外す

撤去条件と監視対象が異なるため、両者を同じ「ピン」として扱ってはならない。

**uv workspace とバージョン方針の非両立（v1.2.0 で追記）**: `apps/agent-api`（litellm 依存）と
`services/agent`（litellm なし）を同一 uv workspace に入れると、workspace が単一の `uv.lock` に
束ねるため、二層バージョン方針（§2.6.3）が要求する「2 つの異なる openai 解決」を表現できない。
この非両立を解消する方針（`apps/agent-api` を workspace から除外するか、二層方針を撤回するか）は
**P0 着手前に ADR で決定し、plan.md に明記することが MUST である**（spec §12 R14）。
デフォルト解は「`apps/agent-api` を uv workspace から除外」であり、二層方針の撤回は
§2.6.2 の脆弱版後退を再現するため禁ずる。

モデル ID をコードおよび文書にハードコードしてはならない（MUST NOT）。環境変数から解決し、
allowlist を 1 か所に集約する。

**検証**: pre-commit のモデル ID ハードコード検出、CI の `turbo-version-check` / `audit`、
`tests/unit/test_ci_workflows.py`（GH Actions の 40 桁 SHA ピン）。uv workspace のメンバー構成が
`plan.md` に宣言されているかを `/sdd-analyze` で確認する。

## Additional Constraints

**ツールチェーン**: バージョンは `mise.toml` で固定する。Python 3.13（3.14 では slowapi 0.1.10 が
`DeprecationWarning→error` で壊れる）、Node 24 LTS、pnpm 11.24.0、uv 0.12 系、Turborepo 2.10.11（完全一致ピン。
`futureFlags.experimentalPythonWorkspaces` に必要）。TypeScript は 6.x 継続とし、7.x の採否は
TODO(TYPESCRIPT_MAJOR) として `docs/adr/` で単独判断する。
コマンドは推測せず `mise.toml` を読む。素の `ruff` / `pytest` / `biome` を直接叩かず、
`mise run <task>` → `uv run` → `pnpm exec` の優先順で実行する。

**2 つの Python FastAPI アプリを統合しない**: `services/agent` は **ステートレス** サイドカー
（DB / Redis / FS を持たず、テストはソケットを開かない）、`apps/agent-api` は **ステートフル** エージェント API。
責務が直交しており、統合は `services/agent` のステートレス性を壊す。pgvector への書き込みは
`packages/rag` のみ（single-writer）。両者のバージョン制約が非対称であることは意図的な設計である。

**`dispatch_request` の禁止**: `VercelAIAdapter.dispatch_request()` は完成した `Response` を返すため、
`AsyncIterator[T] -> AsyncIterator[T]` 形状のライフサイクル層を前後に挿入できない。
`from_request()` → `run_stream()` → ライフサイクル層 → `encode_stream()` に分解する。
これは API レベルの必然であり、様式の選択ではない。プロトタイプ以外での使用を禁ずる。

**生成物はコミットする**: `packages/api-types/generated/` と `packages/schemas/src/generated/` を
gitignore してはならない。差分そのものが API 契約変更のレビュー単位である。出力先は生成器ごとに分離し、
混在させない（混在すると 2 つの OpenAPI 文書が衝突し、どの変更がドリフトを生んだか追えなくなる）。
`apps/web/AGENTS.md` のようなツール生成ファイルもコミットする。

**ログと秘密情報**: 構造化ログのみ（JSON または key=value）。生のユーザープロンプトおよび生のツール入出力を
`logger.*` に出してはならない。ツール引数は `AuditTrail` / `AuditSink` にのみ送る。
秘密情報・トークン・PII は境界でリダクトする。`.env` をコミットしない。

**入力検証の位置**: 検証はシステム境界（HTTP ハンドラ、CLI、外部 API）でのみ行う。内部コードは信頼し、
起こり得ない状態に対する防御的 null チェックを追加しない。暗号は検証済みライブラリのみを用い、
プリミティブを自作しない。

**サプライチェーン**: `minimumReleaseAge: 1440`（公開 24 時間未満を解決しない）。`allowBuilds` の各エントリは
監査理由のコメントを必須とし、`false` は「未審査」ではなく「審査して拒否」を意味する。
CI は `--frozen-lockfile` を強制する。ロック更新の差分は **ダウングレード行がないか** を目視確認し、
PR 本文に `pip-audit` / `pnpm audit` の **出力そのもの** を貼る（「監査は通った」という要約では不十分）。
`pip-audit` の起動形は `uv export --frozen --no-dev [--package <name>] | pip-audit -r /dev/stdin` に統一する。
Dependabot の `fastapi` の `ignore:` はマイナーとメジャーの両方を対象にする（0.x のため
`0.136 → 0.137` がマイナーに分類される）。

**CI / GH Actions のセキュリティ**: すべての `uses:` を**40 桁の完全な SHA** でピンすることが MUST である。
あわせて各ワークフローに**最小権限の `permissions:` を宣言する**ことが MUST である。
SHA ピンの目的は未審査コードの実行を防ぐことだが、実行された場合の影響半径を決めるのは `permissions:` であり、
両者は対で意味を持つ。
> **現状（`vaz-ai-next@bbf1156`）**: 6 ワークフロー全 21 箇所が可変タグ（`@v7`/`@v6`/`@v4`）でピンされ、
> `permissions:` は全ワークフローで未宣言。機械検証テスト（`test_ci_workflows.py`）も未移植。
> これは「維持」ではなく **SHA ピン付け替え・`permissions:` 宣言・検証テスト移植という新規 P0 作業**である。
> P0 着手前に完了させること（spec §10.2）。

**Evals しきい値**: 初期は基準値の計測・記録のみでブロックしない。2 週間後に記録値の 95% をしきい値として
`evals-gate` を有効化する。**しきい値の引き下げは PR で明示的に行う**。テストを通すための暗黙の引き下げを禁ずる。

**フック負荷配分**: pre-commit は速いものだけ（biome, ruff, tsc, ty, vitest, gitleaks, モデル ID 検出、
生成物の未コミット検出）。E2E と live LLM レーンは pre-push、重い監査は CI。
`.githooks/pre-commit` を単一の入口とする。緊急時の `--no-verify` は許すが、CI で同等チェックを必ず再実行する。

**文書の一体変更**: リポジトリルートの `AGENTS.md` と `CLAUDE.md` は単一の変更単位である。片方だけを編集しない。
仕様の散文は日本語（`spec.json` の `language: "ja"`）、ルートのエージェント向け指示は英語で維持する。

## Governance

- **Authority**: 本憲章はアドホックな判断に優先する。矛盾は本憲章を優先して解決する。
  ただし本憲章は `spec-agenticai-core.md` を置き換えない。個別の実装規約は仕様書が詳細を持ち、
  本憲章は「どの判断基準が譲れないか」を定める。仕様書側の記述が本憲章の原則と矛盾する場合は、
  仕様書を改訂するか本憲章を改正するかを明示的に決定し、両者を同時に更新する。
- **Amendment procedure**: 変更提案 → レビュー → バージョン昇格 → Sync Impact Report への記録。
  原則の追加・削除・再定義は、影響する `plan.md` / `tasks.md` / テンプレートの同期確認を伴う。
- **Versioning policy**（セマンティック）:
  - MAJOR: 後方非互換な変更（原則の削除・再定義）。
  - MINOR: 原則・節の追加、または実質的な拡張。
  - PATCH: 明確化・表現修正。
- **Compliance review**: 設計とタスクを MUST 原則に対して検査する（`/sdd-design`, `/sdd-tasks`,
  `/sdd-analyze`）。加えて原則 10 に従い、各実装フェーズ完了後に新規コンテキストで敵対的レビューを行う。
  適合判定は 1 ラウンド 1 ファイルで残し、過去のラウンドを上書きしない。
- **本憲章の正本**: `specs/memory/constitution.md`（git 追跡対象）。`.sdd/memory/` には置かない。

## 改訂履歴

| 版 | 日付 | 種別 | 主な変更内容 |
| :--- | :--- | :--- | :--- |
| 1.0.0 | 2026-08-29 | 初版 | spec-agenticai-core.md §1.1 の 7 原則を統治規範として昇格。原則 8〜11（実測主義・TDD・段階ゲート・依存規律）を追加。Additional Constraints / Governance を新設 |
| 1.1.0 | 2026-08-29 | MINOR | 憲章の正本を `specs/memory/constitution.md`（git 追跡対象）へ移設。 |
| 1.2.0 | 2026-08-31 | MINOR | 原則 7 にクライアント提出構造体への承認フラグ禁止を明記（spec §6.4.3）。原則 11 に uv workspace 単一 lock と二層バージョン方針の非両立（R14）を反映。CI / GH Actions 欄に SHA ピンと `permissions:` の対の意味を追記 |

### 未決事項（Deferred）

- **TODO(BRANCH_COVERAGE_THRESHOLD)**: 分岐カバレッジの数値しきい値は P0 で `vitest --coverage` / `pytest` の実測ベースラインを取得したあと、次回改正（MINOR）で確定する。根拠のない数値を先に固定すると原則 8（実測主義）に反するため、意図的に保留する（REQ-7.7）。
- **TODO(TYPESCRIPT_MAJOR)**: TypeScript 6.x 継続か 7.x 採用か（spec §12 R9）。`docs/adr/` で単独判断し、決定後に Additional Constraints へ反映する。

---

**Version**: 1.2.0 |
**Ratified**: 2026-08-29 |
**Last amended**: 2026-08-31

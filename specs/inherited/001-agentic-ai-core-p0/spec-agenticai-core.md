# vaz-agentic-ai-next マルチエージェント AI アプリケーション 仕様設計書

| 項目               | 内容                                                                                                                                                                                     |
| :----------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **文書 ID**        | SPEC-AGENTIC-001                                                                                                                                                                         |
| **版数**           | 1.7                                                                                                                                                                                      |
| **最終改訂**       | 2026-09-08                                                                                                                                                                               |
| **対象**           | ポリグロット Monorepo によるマルチエージェント AI アプリケーション基盤                                                                                                                   |
| **前提文書**       | 「生産的マルチエージェントシステムの層別アーキテクチャと品質検証基盤: ドラフト検証と深化レポート」                                                                                       |
| **API 検証基準**   | `pydantic-ai-slim` 2.31.1 / 2.33.0 / 2.35.3（3 版で本書が依存する API の同一性を実測確認）、`pydantic-evals` 2.33.0、`ai` 7.0.77、`@ai-sdk/react` 4.0.80、`next` 16.3.2、`turbo` 2.10.11 |
| **依存解決検証**   | `uv pip compile` + `pip-audit` により、本書が規定する制約セットの解決結果と既知脆弱性を実測（§2.6）                                                                                      |
| **前提リポジトリ** | `vaz-ai-next@cf72583` / `fastapi-pydantic-ai-agent@d4d5f8d` / `pydantic-ai-sandbox@a660637`（§0.3）                                                                                      |
| **横断検証**       | `docs/cross-repo-adoption-review.md`（5 リポジトリ相互取り込み検証、2026-09-06）。取り込み項目は X-1〜X-16 の ID で参照する（§0.3.1） |
| **改訂履歴**       | 付録 A                                                                                                                                                                                   |

---

## 0. 本書について

### 0.1 目的と適用範囲

前提文書（検証レポート）で確定した設計原則を、**実装可能な単位まで具体化した仕様設計書**である。ディレクトリ構造、バージョン固定、API 契約、テスト境界、CI ゲートまでを規定する。

規定の強さは次の語で区別する。

| 語                                            | 意味                                                   |
| :-------------------------------------------- | :----------------------------------------------------- |
| **規約** / 「〜する」「〜しなければならない」 | 遵守必須。逸脱は仕様違反であり、レビューで差し戻す     |
| 「〜してはならない」「〜を禁ずる」            | 禁止。例外を設ける場合は `docs/adr/` に決定記録を残す  |
| 「〜してよい」「〜を許容する」                | 判断の余地がある。理由をコードコメントまたは PR に残す |
| 「評価する」「検討する」                      | 未決事項。§12 に対応するリスク項目がある               |

### 0.2 検証方針

本書の記述は、以下 2 種類の実測に裏付けられたもののみを採用する。推測による記述は残さない。

**規約 1 — API シグネチャは実行して確認する**

```bash
uv venv --python 3.13 --clear .venv-check
uv pip install 'pydantic-ai-slim[logfire,ui,evals]' pydantic-evals
# Agent.__init__ / VercelAIAdapter / pydantic-evals の各シグネチャを inspect で確認、
# 誤りが疑われる呼び出しは実際に実行して例外を再現
```

TypeScript 側は `npm view <pkg> version` および `npm pack` した `.d.ts` を直接参照する。本書を改訂する際は、API シグネチャに関わる記述を必ず同じ手順で再検証し、冒頭の「API 検証基準」バージョンを更新する。

この手順を規約に据える理由は、**「v1 系の記憶で書かれた v2 のコード」が実行不能なまま仕様書に残る**という失敗が実際に起きたためである（付録 A.3）。

**規約 2 — 依存解決も検証対象である**

本書がバージョン制約を書き換えるときは、**その制約セットを実際に解決させ、解決結果を `pip-audit` にかけてから**記載する。

```bash
uv pip compile <制約セット> --python-version 3.13 -o locked.txt
pip-audit -r locked.txt          # 解決「結果」を監査する。制約だけ見ても分からない
```

理由は §2.6 に示すとおり、**フロアを上げる変更が、上流の制約衝突を経由して別パッケージを脆弱な旧版へ後退させる**ことがあるからである。「制約を新しくした」ことと「解決結果が新しく安全である」ことは別の命題であり、後者だけが検証に値する。

### 0.3 前提資産（参照リポジトリ）

本設計は 3 つの既存リポジトリを前提とする。いずれも「参考文献」ではなく**実装の母体・移植元**である。

| リポジトリ                                          | 実測状態（2026-08-29）                                                                                                                                                                                                                                                                                                                                                                                                                 | 本設計での扱い                                                                                                                                                                                                                                                              |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Fukuchan77/vaz-ai-next`<br>`cf72583`               | **既にポリグロット monorepo**。`apps/web`（Next 16.3.2 / `ai` 7.0.73 / `@ai-sdk/react` 4.0.76 / Zod 4.4.3）+ `apps/worker`（Inngest 4.18.1）+ `packages/*` 7 個 + `services/agent`（FastAPI 0.141.1 + **pydantic-ai-slim 2.33.0** + openai 3.3.1 + LlamaIndex 0.14.24 + Docling 2.121.0）。OpenAPI→TS の codegen パイプラインと契約ドリフトテストが稼働済み。evals は tier1/2/3 + PR ゲート + nightly が CI 化済み                     | **monorepo の母体として採用**。§3 は「新規構築」ではなく**既存 monorepo の拡張**として規定する。`services/agent` は litellm を持たないため slim 2.33 系に到達できている（§2.6）                                                                                             |
| `Fukuchan77/fastapi-pydantic-ai-agent`<br>`d4d5f8d` | **Pydantic AI v2 移行完了済み**（spec `004-pydantic-ai-v2-unblock` 全 8 チェンジユニット完了）。`pydantic-ai-slim[logfire]>=2.35.3,<3.0`（`openai` extra を要求しない構成、§2.6）で lock は openai 2.54.0 / litellm 1.98.0 / `pydantic-ai-litellm` 0.2.8。ガードレール層・セッション所有権・Corrective RAG・SSE ライフサイクル硬化を実装。`pip-audit` は starlette 5 件 + chromadb 3 件を到達性根拠付きで `--ignore-vuln` 済み         | **`apps/agent-api` の基盤として採用**。§4.4 に示す **2 点**の改修が必須。`pydantic-ai-litellm` を持つため litellm の `openai<3.0.0` に従属するが、`openai` extra を要求しないことでフロアを 2.35.3 まで前進できる（§2.6）                                                   |
| `Fukuchan77/pydantic-ai-sandbox`<br>`a660637`       | `patterns/` 配下に独立 uv レーンとして **`hitl`**（`ApprovalRequired`→`DeferredToolRequests`→`ToolApproved/Denied` の停止・承認・再開ハーネス + FastAPI `/run`・`/resume` + テスト 12 本、Python 3.14 / pyright strict / coverage 98%）、`sse`、`contracts`、`frameworks/{pydantic-ai,llamaindex,beeai}`、`rag`、`deep-research` ほか。`specs/012-agentic-ai-design` / `013-agentic-ai-security` / `patterns/SECURITY-NOTES.md` を保有 | **HITL・SSE・パターン実装・契約定義の移植元として最優先で参照**（§5.2 / §5.5 / §6.4）。`SECURITY-NOTES.md` の「上限ピンによる脆弱版回避」節が §2.6 の一次出典。ルート（litellm あり）は slim 2.31.1、litellm なしの 4 レーンは slim 2.33.0 という**二層構成の実例**でもある |

#### 0.3.1 5 リポジトリ横断検証（v1.7 で追加）

上表 3 リポジトリに `beeai-agentic-ai-sandbox` と本リポジトリを加えた 5 本を突き合わせた検証結果を `docs/cross-repo-adoption-review.md` に記録した（検証日 2026-09-06、各 repo の作業ツリーは `claude/agentic-ai-repo-design-3k8e32` ブランチ時点）。取り込み項目は **X-1〜X-16** の ID で参照し、根拠・実測値は本書に重複させず同文書を正本とする。

同文書 §4 / §5 は、本リポジトリに限り **X-5 / X-10 / X-13 / X-14 の 4 件を実装前に仕様へ反映する**と定めている（P0 の T-1.3 以降に入ってから語彙や受け入れ条件を変えると traceability マトリクスの再生成を伴うため）。本版 v1.7 がその反映であり、対応は次のとおり。

| 項目 | 内容 | 本書での反映先 |
| :--- | :--- | :--- |
| **X-5** | 停止理由語彙が Python 5 値と TS 4 値に割れており、本リポジトリは両方を同居させる | §9.2.2（写像表）／§12 R15 |
| **X-10** | SSE ライフサイクルの第 3 の罠（`str.splitlines()` と U+2028 / U+2029） | §4.4.1 ／ §11 P3 の受け入れ条件 |
| **X-13** | OWASP 対応表が本リポジトリにも `vaz-ai-next` にも無い | §6.5（新設） |
| **X-14** | E2E が CI レーンに無い（pre-push のみ） | §10.2（既述）／§11 P3 の前提として明示 |

反映不要と判定した項目（既に本書または P0 要件が持つもの）: **X-1**（`uses:` の SHA ピン・`permissions:` 宣言・`test_ci_workflows.py` の移植 = §10.2 ＋ REQ-9.3 ＋ T-5.5。横断検証側も「新規の要求ではない」と明記）、**X-3**（非空アサート = REQ-7.5 / 7.6。本リポジトリが横断検証へ**出す**側の資産）、**X-4**（憲章を `specs/memory/constitution.md` へ移して追跡下に置く解法 = 適用済み）、**X-6b**（`tool-count-check` = §4.2.1 ＋ §10.2）。

**横断検証側の記述の訂正**: `docs/cross-repo-adoption-review.md` の X-6b は「1 エージェント ≤ 20 ツールの機械チェックは `specs/memory/constitution.md` に原則としてあるだけで、どの repo も実装していない」とするが、本書 §4.2.1 は CI での機械検証を規約として要求し、§10.2 の CI ジョブ表は `tool-count-check` をブロッキングジョブとして掲げている。正確には「**原則のみ**」ではなく「**仕様化済み・未実装**」である。

---

## 1. システム概要

### 1.1 設計原則

本システムは以下 7 原則に従う。以降の各節の規約は、いずれかの原則の具体化である。

**原則 1: マルチエージェント化はトークン対価を正当化できる領域に限定する**

Anthropic の実測では、エージェントはチャットの約 4 倍、マルチエージェント構成は約 15 倍のトークンを消費する。一方でリードエージェント + サブエージェント構成は単一エージェント比 90.2% の性能改善を示した。したがってマルチエージェント化は「幅優先探索が本質的に必要な領域」に限定し、それ以外は単一エージェント + ツールで実装する（適用判断は §5.1）。

**原則 2: 層の責任境界を型で固定する**

知覚層（LlamaIndex）／推論層（Pydantic AI）／表現層（AI SDK）の境界は、すべて Pydantic モデルまたは Zod スキーマで検証される。境界を跨ぐ非検証データを禁ずる（§7）。

**原則 3: 確率的振る舞いには多層防御でテストする**

Unit（決定論的）／Integration（モックモデル）／E2E（実プロトコル）／Evals（確率的定量評価）の 4 層を分離し、各層で「何を保証しないか」を明示する（§8.1）。

**原則 4: 可観測性は最初から入れる**

Logfire / OpenTelemetry を後付けせず、MVP の第 1 コミットから有効化する。本番トレースを評価ケースへ変換するデータフライホイールを前提とした設計にする（§9.3）。

**原則 5: 既存の単一経路に合流させる**

新しい publish 点・throw 点・スキーマ・語彙を足す前に、**既存の単一経路に合流できないかを先に検討する**。参照 3 リポジトリはいずれも「ガードレールは 1 か所」「監査ログの発火点は 1 か所」「embedding の書き込みは 1 パッケージ」という単一経路設計を採っており、新エンドポイントがその経路を迂回すると保証が静かに消える。§6.1 の `/v1/chat` はこの原則の最重要適用箇所である。

**原則 6: コンテキストは有限のアテンション予算として扱う**

コンテキストウィンドウは容量ではなく**注意（attention）という枯渇資源**として扱う。トークン数を増やしても精度は上がらず、無関係な情報の混入（コンテキスト汚染、"context rot"）は推論品質を下げる。したがって:

- (a) システムプロンプト・ツール応答は「モデルの意思決定に効く最小の高シグナル情報」に絞る
- (b) 検索結果を先読みで全件 context に積まず、**必要になった時点で取得する**（just-in-time retrieval）。Corrective RAG の search→evaluate→synthesize ループと、§6.3.1 の「権威ある履歴のみをサーバ側から渡す」設計はこの具体化である
- (c) 長時間実行タスクには圧縮（compaction）・構造化ノートテイキング（スクラッチパッドをコンテキスト外へ永続化し必要時に再読込）・サブエージェント分離（各サブエージェントはクリーンなコンテキストで深く探索し、要約のみを親へ返す）の 3 手法から選ぶ

§5.2 の Orchestrator-Worker は (c) の実装であり、サブエージェントの結果は**要約単位で統合されなければならない**。根拠: Anthropic「Effective context engineering for AI agents」（§13.5）。

**原則 7: 自律性は較正し、監査可能性で裏書きする**

人間の監督（human-in-the-loop）は「承認を求めるかどうか」の二値ではなく、**人間が実効的に監視・介入できる立場にあるか**という連続量として設計する。Anthropic の本番テレメトリでは permission prompt の 93% が内容を読まれずに承認されており、経験を積んだユーザーほど自動承認率が上がる（新規ユーザー約 20% → 約 750 セッション経験者で 40% 超）。運用の実態は「承認による事前抑止」から「監視による事後介入」へ移行していく。**承認ダイアログを広く設置するほど、この移行が早まり、防御は名目化する。**

したがって承認ゲート（§6.4 の `requires_approval` / `needsApproval`）は取り消し不能または高リスクな操作にのみ絞り込み、それ以外は §9 の `AuditTrail` による事後監査でカバーする（§6.4.3・§12 R13）。あわせて、エージェントの安全性は**モデル・ハーネス・ツール・環境の 4 層の責任分界**として設計し、いずれか 1 層に閉じない。根拠: Anthropic「Measuring AI agent autonomy in practice」「Trustworthy agents in practice」（§13.5）。

### 1.2 全体構成図

```
┌────────────────────────────────────────────────────────────────┐
│  apps/web  —  Next.js 16.3 App Router (Turbopack)              │
│  ├── React 19.2 + React Compiler                               │
│  ├── ai 7.0.x + @ai-sdk/react 4.0.x  ← useChat                 │
│  ├── Zod v4 (クライアント側ランタイム検証)                        │
│  └── Carbon Design System (per-component SCSS)                 │
└──────────────────────┬─────────────────────────────────────────┘
                       │  HTTP POST /api/chat  (BFF, 薄いプロキシ)
                       │        ↓
                       │  HTTP POST /v1/chat
                       │  Vercel AI Data Stream Protocol (SSE)
                       │  sdk_version=7
┌──────────────────────▼─────────────────────────────────────────┐
│  apps/agent-api  —  FastAPI (Python 3.13)                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  境界防御層 (既存資産・全エンドポイント共通)               │  │
│  │   verify_api_key / enforce_llm_rate_limit                 │  │
│  │   TrustedHost → CORS → SizeLimit → RequestID → SecHeaders │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │  表現統合層: VercelAIAdapter.from_request()               │  │
│  │   - 信頼境界の適用（§6.3 のデフォルト値を維持）            │  │
│  │   - ToolApprovalRequestChunk の emit（HITL, sdk>=6）      │  │
│  │   - 承認握り潰し検証（§6.4 サーバ側 fail-loud）           │  │
│  │  ↕ run_stream() の間に _stream.py のライフサイクル硬化     │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │  ガードレール層: build_guarded_toolset()                  │  │
│  │   allow-list → approval hook → token budget → AuditTrail │  │
│  │   （StopReason 閉語彙で終了理由を分類）                    │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │  推論・オーケストレーション層: Pydantic AI 2.35.x         │  │
│  │   - Agent(deps_type=, output_type=, retries=AgentRetries)│  │
│  │   - @agent.tool / @agent.output_validator / ModelRetry   │  │
│  │   - Orchestrator-Worker（§5.1 の判断フロー通過領域のみ）   │  │
│  └────────────────────────┬─────────────────────────────────┘  │
│  ┌────────────────────────▼─────────────────────────────────┐  │
│  │  知覚・ナレッジ検索層: LlamaIndex Workflows               │  │
│  │   - CorrectiveRAGWorkflow (Search→Evaluate→Synthesize)   │  │
│  │   - VectorStore Protocol（差し替え可能）                   │  │
│  └──────────────────────────────────────────────────────────┘  │
│  横断: Pydantic Logfire / OpenTelemetry (GenAI semconv v5)      │
└────────────────────────────────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┐
        ▼              ▼              ▼
   SessionStore   VectorStore    LLM Provider
   (Protocol)     (Protocol)     (model string / FallbackModel)
```

**境界防御層とガードレール層は図から省略できない。** この 2 層を落とすと §6.1 のルート実装が認証・レート制限・ツール allow-list をすべて失う（§6.1.1）。

---

## 2. ランタイム・パッケージのバージョン仕様

### 2.1 バージョン固定方針

- **原則**: 本設計時点（2026-08-29）の最新安定版を採用する
- **例外は必ず理由をコードコメントに残す**。上限ピンは「新しい版が壊れるから」という具体的な失敗と、それを検知するカナリアテスト名をコメントに書く。現行の例外は §2.5 に列挙する
- **固定手段**: Node / Python / pnpm / uv は `mise.toml` で固定。ライブラリは `pnpm-lock.yaml` / `uv.lock` で固定
- **メジャー版のアップグレード**: `AGENTS.md` に移行判断を記録し、PR 単位で実施する。パッチ／マイナーは Dependabot / Renovate で自動 PR 化してよい

### 2.2 Python 側（`apps/agent-api`, `packages/py-agents`, `packages/py-evals`）

| 対象                         | 採用バージョン                                                                           | 実測解決                                                                                                                              | 備考                                                                                                                                                                                                                                                                                                    |
| :--------------------------- | :--------------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Python                       | **3.13**                                                                                 | 参照 3 リポジトリすべてが `.python-version` = 3.13                                                                                    | 3.14 移行は §12 R1 の独立課題                                                                                                                                                                                                                                                                           |
| uv                           | 0.12 系                                                                                  | `vaz-ai-next` の `mise.toml` で固定済み。`fastapi-pydantic-ai-agent` / `pydantic-ai-sandbox` は `uv = "latest"` で追随                | `uv.lock` は `uv lock` で明示更新。0.12.7 で参照 3 リポジトリの `uv.lock` を `uv lock --check` し、いずれも再解決不要（差分なし）を確認済み。0.10.0 以降 `uv venv` は既存ディレクトリに対して `--clear` を要求する（§0.2 のコマンド例は対応済み）                                                       |
| Pydantic AI（litellm 層）    | **`pydantic-ai-slim[logfire,ui,evals]>=2.28.0,<3.0`**<br>**`openai` extra は要求しない** | **2.35.3**（`fastapi-pydantic-ai-agent@d4d5f8d`）/ openai 2.54.0 / litellm 1.98.0 / `pydantic-ai-litellm` 0.2.8、`pip-audit` クリーン | `apps/agent-api`。**`openai` extra を追加してはならない**（§2.6）。フル `pydantic-ai` は全プロバイダ依存を引くため不採用。`ui` extra が `starlette>=0.46.2` を供給し、これが `VercelAIAdapter.from_request` の前提（現行リポジトリにはまだ `ui`/`evals` extra がない。§4.4/§7/§8.4 の移植時に追加する） |
| Pydantic AI（非 litellm 層） | **`pydantic-ai-slim[...]>=2.33,<3.0`**                                                   | **2.33.0** / openai 3.3.1                                                                                                             | `services/agent`（到達済み）と litellm 非依存の新規レーン。宣言は `>=2.27` だが lock は 2.33.0                                                                                                                                                                                                          |
| pydantic-evals               | slim と同系列                                                                            | 二層方針の下では **2.35.3** / 2.33.0 が並立（単体最新 2.36.0）                                                                        | `evals` extra が `pydantic-evals==<slim と同版>` を pin する。単体 PyPI パッケージとしても存在するが、版を揃えるため extra 経由で入れる                                                                                                                                                                 |
| openai                       | **明示ピンなし**（litellm 層は litellm の `<3.0.0` 宣言に従属）                          | litellm 経由で 2.54.0（単体最新 3.6.0）                                                                                               | §2.6 / §2.5-5                                                                                                                                                                                                                                                                                           |
| litellm                      | `pydantic-ai-litellm>=0.2.3,<0.3.0` 経由                                                 | **1.98.0**（最新）                                                                                                                    | **1.83.0 に後退させてはならない**（既知脆弱性 11 件）                                                                                                                                                                                                                                                   |
| Pydantic                     | 2.13.x                                                                                   | 2.13.5                                                                                                                                | —                                                                                                                                                                                                                                                                                                       |
| FastAPI                      | **`>=0.135.1,<0.137`**                                                                   | 0.141.1 が最新だが**上限ピン維持**（§2.5-1）                                                                                          | —                                                                                                                                                                                                                                                                                                       |
| Starlette                    | **`>=0.52.1,<1.0`**                                                                      | 1.6.0 が最新だが**上限ピン維持**（§2.5-2）                                                                                            | —                                                                                                                                                                                                                                                                                                       |
| slowapi                      | `>=0.1.9,<1.0`                                                                           | 0.1.10（2026-06-13）が最新                                                                                                            | §2.5-2 / §12 R1 の中心                                                                                                                                                                                                                                                                                  |
| LlamaIndex                   | `llama-index-core>=0.14.24,<1.0`                                                         | 0.14.24（最新）                                                                                                                       | Workflows を使用                                                                                                                                                                                                                                                                                        |
| Pydantic Logfire             | 4.41.x                                                                                   | —                                                                                                                                     | `logfire` 単体、または `pydantic-ai-slim[logfire]` extra                                                                                                                                                                                                                                                |
| pytest / pytest-asyncio      | 最新安定版                                                                               | —                                                                                                                                     | `asyncio_mode = "auto"`                                                                                                                                                                                                                                                                                 |
| ruff / ty                    | 最新安定版                                                                               | —                                                                                                                                     | Turborepo の Python 自動入力に `.ruff_cache` / `.ty` が含まれる                                                                                                                                                                                                                                         |

### 2.3 TypeScript 側（`apps/web`, `packages/api-types`）

| 対象            | 採用バージョン          | 実測最新（2026-08-29）                         | 備考                                                                                                                                                                 |
| :-------------- | :---------------------- | :--------------------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Node.js         | 24 LTS                  | —                                              | `mise.toml` で固定済み                                                                                                                                               |
| pnpm            | 11.24.x                 | —                                              | `packageManager` フィールドで SHA 込み固定済み。11.19.0 → 11.24.0 は `pnpm install --frozen-lockfile --dry-run` で `pnpm-lock.yaml` に差分が出ないことを実測確認済み |
| Next.js         | 16.3.x                  | 16.3.3（`vaz-ai-next` は `^16.3.2`）           | §12 R4 のセキュリティリリースを監視                                                                                                                                  |
| React           | 19.2.x + React Compiler | 19.2.8                                         | 自動メモ化。手動 `useMemo` / `useCallback` を禁ずる                                                                                                                  |
| `ai`            | **7.0.x**               | 7.0.84（`vaz-ai-next` は `^7.0.73`）           | tool approvals / durability / telemetry                                                                                                                              |
| `@ai-sdk/react` | **4.0.x**               | 4.0.87（`vaz-ai-next` は `^4.0.76`）           | **`ai` とは別のメジャー系列**。`useChat` / `addToolApprovalResponse` を提供                                                                                          |
| Zod             | v4                      | `vaz-ai-next` のピンは 4.4.3（単体最新 4.5.2） | クライアント側の入力／env 検証                                                                                                                                       |
| TypeScript      | **6.x（据え置き）**     | 7.0.2                                          | TS 7 は Go 実装への移行を含む大規模変更。採否は §12 R9 の ADR で判断し、本書のスコープ外とする                                                                       |
| Biome           | 2.5+                    | 2.5.11（`vaz-ai-next` は `^2.5.9`）            | lint + format を一元化。`biome.json` の `$schema` も同版に追随させる                                                                                                 |
| Vitest          | 4.x                     | 4.1.11                                         | —                                                                                                                                                                    |
| Inngest         | 4.18.x                  | 4.18.1                                         | `apps/worker` の耐久エンジン                                                                                                                                         |
| Playwright      | 1.62.x                  | 1.62.1                                         | Chromium / Firefox                                                                                                                                                   |
| Turborepo       | **2.10.11 以上**        | 2.10.12                                        | `futureFlags.experimentalPythonWorkspaces` を認識する版が必須（§3.5）                                                                                                |

### 2.4 モデル ID の扱い

モデル ID は**設定値であり仕様ではない**。コード・ドキュメントにハードコードせず、環境変数で解決する。

参照 3 リポジトリはいずれも既に機械ゲートを保有している。

| リポジトリ                  | ゲート                                                                                                                                                                                                                                     |
| :-------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `vaz-ai-next`               | `scripts/forbid-model-ids.sh`（`.py` も走査）+ mise task `lint:model-ids`。例外は `packages/config/src/model-allowlist.ts` / `packages/schemas/src/env.ts` / `services/agent/app/config.py` の 3 件（`scripts/forbid-model-ids.sh:41-43`） |
| `fastapi-pydantic-ai-agent` | pre-commit pygrep `no-hardcoded-model-id` + `tests/unit/test_no_hardcoded_model_ids.py`                                                                                                                                                    |
| `pydantic-ai-sandbox`       | pre-commit `forbid-hardcoded-model-ids`。例外は `services/agent/app/config.py` 相当の allowlist のみ                                                                                                                                       |

**規約**: 既存ゲートを monorepo 全体に展開し、許可リストの場所を 1 か所に集約する。`.env.example` の更新はゲートの副産物として自動的に満たされるため、独立した作業項目としない。

### 2.5 最新版追随に対する例外一覧

§2.1 の「最新安定版を採用する」原則に対する、**理由付きの例外**。monorepo 統合後も維持する。

1. **`fastapi<0.137`** — 0.137 は include したルータを `_IncludedRouter` でラップし、`app.routes` へフラット化しない。slowapi の `_find_route_handler` は `app.routes` を非再帰に走査して `.endpoint` を探すため何も見つからず、`_should_exempt` が**全リクエストを exempt 扱い**してグローバルレート制限を静かに無効化する。カナリア: `tests/e2e/test_rate_limiting_enforcement.py`
2. **`starlette<1.0`** — slowapi 0.1.10 が starlette 1.x 非互換（例外ハンドラのディスパッチ誤り、`SlowAPIMiddleware` が `X-RateLimit-*` を出さなくなる）。1.x でのみ修正された starlette アドバイザリは、到達可能なもの（Host ヘッダのリダイレクト反映）を `TrustedHostMiddleware` でアプリ層に閉じ、残りは到達不能（`request.form()` / `HTTPEndpoint` / `StaticFiles` を使わない）であることを確認済み
3. **`pydantic-ai-litellm>=0.2.3,<0.3.0`** — 次のメジャーではなく**次のマイナー未満**で止める。6 つの pydantic-ai 私的 API に依存する 0.x パッケージであり、0.x はマイナーが破壊的リリースにあたる。`<1.0` では 0.3.x〜0.9.x を無審査で通してしまう（fastapi の 0.x 分類の罠と同型）。破壊を検知するのはピンではなく `tests/unit/test_pydantic_ai_api_lock.py`
4. **`pydantic-ai-slim<3.0`** — 将来のメジャーが v1→v2 相当の破壊的変更を、互換ゲートの再実行なしに持ち込まないようにするため
5. **`pydantic-ai-slim` に `openai` extra を要求しない**（`apps/agent-api` のみ）— litellm が openai 3.x を未採用であるため、`openai` extra（2.32.0 以降フロア `openai>=3.0.0`）を要求すると解決器は litellm を脆弱な 1.83.0 へ後退させる。extra を要求しないことで衝突自体を回避し、`pydantic-ai-slim` のフロアを 2.32 以上へ引き上げられる（実測 2.35.3、§2.6）。**撤去条件**: litellm が `openai>=3` を宣言するリリースを出した時点で `openai` extra を再度要求してよい
6. **`chromadb<1.0`**（`apps/agent-api` の `ChromaVectorStore` のみ）— chromadb 0.6.3 に対する 3 件の CVE を `--ignore-vuln` で抑止している。埋め込みクライアント（`chromadb.PersistentClient` / `chromadb.Client()`）のみを使い `HttpClient`（マルチテナント HTTP API・RBAC）を使わない限り到達不能。**撤去条件**: どれかの CVE に修正版が出るか、`HttpClient` へ切り替える変更が入った時点で抑止リストを見直す（後者はネットワーク／アクセス制御をアプリ層で別途設計しない限り安全に切り替えられない）

**1・2 は §12 R1（Python 3.14）と直結している。** どちらも slowapi に起因し、slowapi は Python 3.14 の非対応元でもある。slowapi 依存を外す変更は、この 3 つを同時に解く。

**5 は §12 R11 と直結しており、1〜4 と性質が逆である。** 1〜4 が「新しすぎる版を選ばせない」ピンであるのに対し、5 は「**古い脆弱版を選ばせない**」ための extra 省略である。§2.6 で分けて扱う。

**6 は 1〜5 のいずれとも独立している。** RAG バックエンドの選択（`VectorStore` Protocol の実装差し替え）に固有の抑止であり、pydantic-ai / litellm の版分断とは無関係である。

#### 2.5.1 starlette の `--ignore-vuln` 運用

`apps/agent-api` の `audit` タスクは starlette 0.52.1 に対する 5 件の advisory を抑止している。抑止は一括ではなく**advisory ごとに到達性の根拠**が書かれており、この形式を monorepo でも維持する。

| Advisory              | 抑止根拠                                                                                                   |
| :-------------------- | :--------------------------------------------------------------------------------------------------------- |
| PYSEC-2026-161        | 到達可能（Host ヘッダがリダイレクト `Location` に入る）だが `TrustedHostMiddleware` でアプリ層に閉じている |
| PYSEC-2026-248 / 2280 | 到達不能 — `HTTPEndpoint` を使用していない                                                                 |
| PYSEC-2026-249        | 到達不能 — `request.form()` を呼んでいない                                                                 |
| PYSEC-2026-2281       | 到達不能 — `StaticFiles` 未使用、かつ Windows 限定の UNC 経路                                              |

**規約**: starlette を上げるときは `--ignore-vuln` なしで `pip-audit` を再実行してからこのリストを作り直す。到達性の判断は「今のコードでは到達しない」という時点評価であり、コードが変われば失効する。

#### 2.5.2 chromadb の `--ignore-vuln` 運用

starlette 群とは無関係の、別グループの抑止である。

| CVE            | 内容                                                                                                                             | 抑止根拠                                             |
| :------------- | :------------------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------- |
| CVE-2026-45830 | 認可検証の欠如により、認証済みの任意ユーザーが他テナントのコレクションを読み書き・更新・削除できる                               | `HttpClient`（マルチテナント）を使わない限り到達不能 |
| CVE-2026-45831 | `SimpleRBACAuthorizationProvider` が権限の有無は見るが、それがどのテナント／データベース／コレクションに適用されるかを見ない     | 同上（RBAC 未使用）                                  |
| CVE-2026-45833 | `UPDATE_COLLECTION` 権限を持つ攻撃者が、悪意あるモデルリポジトリ + `trust_remote_code=true` 経由でリモートコード実行を達成できる | 同上（collections API 未公開）                       |

starlette 群と異なり、**この 3 件はいずれも修正版が存在しない**（PyPI / OSV の `fixed_in` が空で、最新の chromadb 1.5.9 でも該当範囲内）。したがって chromadb を上げても解決しない。`app/stores/vector_store/chroma.py` が `chromadb.HttpClient` へ切り替わった時点、またはスタンドアロンの Chroma サーバと通信を始めた時点でこの抑止は失効する。

### 2.6 依存解決の罠 — openai 3.x と litellm の分断

#### 2.6.1 制約の衝突

上流に、同時には満たせない 2 つの制約がある。

| パッケージ                                 | 宣言                                                               | 確認方法                                   |
| :----------------------------------------- | :----------------------------------------------------------------- | :----------------------------------------- |
| `pydantic-ai-slim[openai]` **2.31.x まで** | `openai>=2.45.0`                                                   | PyPI メタデータ                            |
| `pydantic-ai-slim[openai]` **2.32.0 以降** | **`openai>=3.0.0`**                                                | 同上（2.32.0 でフロアが跳ねた）            |
| `litellm` 1.83.1 〜 **1.98.0（最新）**     | **`openai<3.0.0`**（`openai==2.x` または `openai<3.0.0,>=2.20.0`） | 同上                                       |
| `litellm` **1.83.0 のみ**                  | `openai>=2.8.0`（**上限なし**）                                    | 上流の宣言漏れであって互換性の表明ではない |
| `pydantic-ai-litellm` 0.2.3                | `litellm>=1.79.1`                                                  | 0.2.6 以降は `litellm>=1.86.2`             |

`pydantic-ai-slim[openai]>=2.32` と `litellm` を同時に要求すると、両方を満たす解は **litellm 1.83.0 ただ一つ**になる。解決器はそこへ後退する。

#### 2.6.2 実測

**実測 A — フロアを上げると脆弱版へ後退する（採ってはならない構成）**

```
$ cat req.txt
pydantic-ai-slim[logfire,openai,ui,evals]>=2.33,<3.0
pydantic-ai-litellm>=0.2.3,<0.3.0

$ uv pip compile req.txt --python-version 3.13
litellm==1.83.0                 # ← 最新から 14 マイナー後退
openai==3.3.1
pydantic-ai-litellm==0.2.3      # ← 最新 0.2.8 から後退（litellm フロアを下げるため）
pydantic-ai-slim==2.33.0

$ pip-audit -r locked.txt
Found 11 known vulnerabilities in 1 package
litellm 1.83.0  PYSEC-2026-388 / 391 / 2598 / 2599 / 2600 / 2601 / 2602 / 3476 / 3477 / 3479
                （修正は 1.83.7 〜 1.84.0 に分散）
```

**フロアを上げるという「最新化」が、そのまま脆弱性の新規導入になる。** `pydantic-ai-litellm` まで巻き添えで後退する点に注意 — 解決器は litellm のフロアを下げるためにアダプタ側も下げる。

**実測 B — extra を外すと衝突が起きない（採用する構成）**

原因は「`openai` extra の宣言」自体であって「フロアの高さ」ではない。`fastapi-pydantic-ai-agent@d4d5f8d` はこの切り分けに基づき、extra を外すことで衝突そのものを回避している。

```
# 衝突する構成
pydantic-ai-slim[logfire,openai]>=2.28.0,<3.0
#                        ^^^^^^ この extra が openai>=3.0.0 を要求する（2.32.0 以降）

# 採用する構成
pydantic-ai-slim[logfire]>=2.35.3,<3.0
#                ^^^^^^^ extra を外す。openai extra が要求していた openai>=3.0.0 も消える

$ uv.lock の解決結果
pydantic-ai-slim==2.35.3
pydantic-ai-litellm==0.2.8      # ← 最新のまま後退なし
litellm==1.98.0                 # ← 最新のまま後退なし
openai==2.54.0                  # ← litellm 自身の openai<3.0.0 宣言が効いている
```

**なぜこれで壊れないか**: `pydantic_ai.models.openai.OpenAIResponsesModel` の import に必要なのは `openai` パッケージそのものであって、`pydantic-ai-slim` の `openai` extra ではない。litellm は非 extra の通常依存として `openai` / `tiktoken` を要求しており、この import はそこから満たされる。`fastapi-pydantic-ai-agent` の `tests/unit/agents/test_build_model_public_api.py` が `from pydantic_ai.models.openai import OpenAIResponsesModel` を直接 import し `build_model()` の疎通を確認しており、**extra を外しても実行時の欠落がないことを実測で保証している**。

#### 2.6.3 二層バージョン方針

**litellm を持つかどうかで層を分ける。** 分岐の基準は「新しいものを使いたいか」ではなく「litellm に縛られるか」である。

| 層                | 構成要素                                                                 | `pydantic-ai-slim`                                           | `openai`                                                              | 根拠                                                                                                                         |
| :---------------- | :----------------------------------------------------------------------- | :----------------------------------------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------- |
| **litellm 層**    | `apps/agent-api`、および `apps/agent-api` が import する `packages/py-*` | **`openai` extra なしで `>=2.28.0,<3.0`**（実測解決 2.35.3） | 明示ピンなし。litellm の `openai<3.0.0` 宣言に従属（実測解決 2.54.0） | `pydantic-ai-litellm` によるマルチプロバイダ routing が要件。native OpenAI provider を直接使わないため `openai` extra は不要 |
| **非 litellm 層** | `services/agent`、litellm 非依存の新規レーン                             | **2.33.x**（`openai` extra あり）                            | 制約なし（3.3.1）                                                     | 縛りがないので `openai` extra を使い最新に追随してよい                                                                       |

`apps/agent-api` の `>=2.28.0,<3.0` という範囲（`openai` extra なし）は、そのままで正しく機能する。解決器はこの extra 省略を「吸収帯」として使い、slim を 2.35.3 まで進めても衝突しない（`pip-audit` は starlette 5 件 + chromadb 3 件のみで、いずれも §2.5 で到達性根拠付きに抑止済み）。

**危険なのは `openai` extra を再び要求する変更である。** それは吸収帯を潰し、衝突の逃げ場を litellm のフロア後退だけに残す。したがって:

- **規約**: `apps/agent-api` およびその依存 `packages/py-*` で `pydantic-ai-slim` に **`openai` extra を追加してはならない**。`pydantic_ai.models.openai` を直接使う必要が生じた場合のみ、litellm 経由を諦めて extra を追加し、同時に §2.6.2 の再測定（`uv pip compile` + `pip-audit`）を行う
- **規約**: `<3.0` という `pydantic-ai-slim` 自体の上限は維持する（§2.5-4）

#### 2.6.4 二層化は設計を分岐させない

バージョンが割れると設計も割れるのではないか、という懸念に対する回答である。**本書が依存する API はすべて 2.31.1・2.33.0・2.35.3 の 3 版で同一である**ことを実測で確認した。特に 2.31.1 → 2.35.3 は `openai` extra の有無という構成変更を伴うが、`fastapi-pydantic-ai-agent` の `app/` 配下コードはこの移行で 1 行も変わっておらず、これも実測の裏付けである。

| 本書が依存する API                                                                                                         | 2.31.1                       | 2.33.0 | 2.35.3                                             |
| :------------------------------------------------------------------------------------------------------------------------- | :--------------------------- | :----- | :------------------------------------------------- |
| `VercelAIAdapter.dispatch_request` の `sdk_version`                                                                        | `Literal[5, 6, 7]`、既定 5   | 同一   | 同一                                               |
| `from_request` / `run_stream` / `encode_stream` / `build_run_input`（§4.4.1 の分解）                                       | あり                         | 同一   | 同一                                               |
| `toolsets` / `capabilities` / `output_type` / `usage_limits` / `message_history`（§6.1.1）                                 | あり                         | 同一   | 同一                                               |
| `manage_system_prompt` / `allowed_file_url_force_download` / `allow_uploaded_files`（§6.3）                                | あり                         | 同一   | 同一                                               |
| `ToolApprovalRequestChunk` の emit と `sdk_version >= 6` ゲート（§6.4）                                                    | あり                         | 同一   | 同一                                               |
| 承認握り潰しの経路（`role == 'assistant'` + `isinstance(part.approval, ...)`、§6.4.1）                                     | あり                         | 同一   | 同一                                               |
| 公開の承認パート型（`ToolApprovalRespondedPart` ほか、§6.4.1 の検出器が使う）                                              | あり                         | 同一   | 同一                                               |
| `Agent.__init__` に `instrument` / `output_retries` が**ない**こと（§4.1.1）                                               | ない                         | 同一   | 同一                                               |
| `end_strategy` の既定が `graceful`（§4.1.3）                                                                               | `graceful`                   | 同一   | 同一                                               |
| `AgentRetries(tools=, output=)`                                                                                            | あり                         | 同一   | 同一                                               |
| `Agent.override(native_tools=...)`（§8.2）                                                                                 | あり                         | 同一   | 同一                                               |
| instrumentation 既定 v5 / `use_aggregated_usage_attribute_names=True`（§9.2.1）                                            | 同左                         | 同一   | 同一                                               |
| `pydantic_ai.models.openai.OpenAIResponsesModel` の import（`openai` extra なしで litellm の transitive 依存のみから解決） | 未検証（extra あり構成のみ） | 未検証 | **あり**（実測、`test_build_model_public_api.py`） |

**したがって §4 / §6 / §8 / §9 は二層化の影響を受けない。** 二層化（および extra の有無）はロックファイル・依存宣言の問題であって、コードの問題ではない。

#### 2.6.5 この節が示す一般則

`minimumReleaseAge` と `pnpm audit` / `pip-audit` は「**新しすぎる版**」と「**既知の脆弱な版**」を防ぐが、本件はそのどちらでもない。**制約充足の副作用として、依存グラフの別の場所が古い脆弱版へ引き戻される**という第三の失敗様式である。

したがって §10.4 のサプライチェーン規約に次を含める。

- `uv lock --upgrade` / `pnpm update` の結果は、**差分にダウングレードが含まれていないかを必ず目視する**。`uv.lock` / `pnpm-lock.yaml` の差分レビューで「バージョンが下がっている行」は赤信号である
- ロック更新 PR は、更新後のロックに対する `pip-audit` / `pnpm audit` の**出力そのもの**を PR 本文に貼る。「監査は通った」という要約では、この失敗様式を見逃す
- `pydantic-ai-sandbox` の `patterns/SECURITY-NOTES.md` にある「上限ピンによる脆弱版回避の運用」節を、monorepo の `docs/` へ引き継ぐ

**版の衝突には 2 つの解法がある。** フロアを下げて衝突を避ける解法（後ろ向き: 「新しいものと衝突しない古い版はどこか」を探す）と、要求そのもの（extra・オプション依存）を削って衝突を起こさせない解法（前向き: 「そもそも何がその依存を要求しているか」を疑う）である。後者のほうがフロアを高く保てる可能性が高い。**バージョン衝突に遭遇したら、範囲調整の前に各パッケージが宣言する extra／オプション依存が実際に使われているかを先に確認すること。**

---

## 3. リポジトリ構成仕様

### 3.1 統合方針

`vaz-ai-next` は既に `apps/*` + `packages/*` + `services/agent`（Python FastAPI サイドカー）を持つポリグロット monorepo である。したがって方針は「新規構築」ではなく「**既存 monorepo への `apps/agent-api` 追加と Turborepo 導入**」となる。

統合により得られるものは以下 3 点に限定し、それ以外の理由では統合しない。

1. **型の単一真実源（SSOT）**: Pydantic モデルから TS 型を生成するパイプラインがリポジトリ境界を跨がなくなる（`services/agent` については既に達成済み）
2. **アトミックな契約変更**: API 契約の変更をフロント／バックの 1 PR で完結できる
3. **タスクパイプラインの統一**: `turbo run test` で両言語のテストが依存順に走る

### 3.2 `services/agent` と `apps/agent-api` の関係

統合後、Python の FastAPI アプリが 2 つ存在する。役割を混同しないよう責務を固定する。

|             | `services/agent`（既存）                                                    | `apps/agent-api`（新規・`fastapi-pydantic-ai-agent` 由来） |
| :---------- | :-------------------------------------------------------------------------- | :--------------------------------------------------------- |
| 性質        | **ステートレス**サイドカー（DB / Redis / FS を持たない）                    | **ステートフル**なエージェント API                         |
| 責務        | RAG 評価（faithfulness / relevancy）、Docling による構造保持パース          | チャット・HITL・Corrective RAG・セッション所有権           |
| 呼び出し元  | TS 側（`packages/rag` の ingest CLI、evals）                                | `apps/web` の BFF（ブラウザ）                              |
| DB 書き込み | **禁止**（single-writer 原則: pgvector への書き込みは `packages/rag` のみ） | 自身のストアに対してのみ                                   |

**この 2 つを統合しない。** 責務が直交しており、統合すると `services/agent` のステートレス性（テストが一切ネットワークを開かない前提）が壊れる（§12 R5）。

### 3.3 パッケージ命名規約

ポリグロット monorepo で同名・別言語のパッケージが並ぶと、`turbo` のフィルタ・`pnpm --filter`・CI のパスフィルタ・import パスがすべて曖昧になる。以下を規約とする。

- **既存 TS パッケージ名は変更しない**（`packages/schemas` = Zod、`packages/evals` = TS evals、`packages/agents` = TS エージェント）。改名は `apps/web` / `apps/worker` / 7 パッケージすべてに波及するため費用対効果が合わない
- **新規 Python パッケージは `py-` 接頭辞を付ける**

| Python パッケージ       | 内容                           | 接頭辞が必要な理由                                                                                                  |
| :---------------------- | :----------------------------- | :------------------------------------------------------------------------------------------------------------------ |
| `packages/py-agents`    | Pydantic AI エージェント定義   | 既存 `packages/agents`（TS）と衝突                                                                                  |
| `packages/py-schemas`   | 型の SSOT（Pydantic モデル）   | 既存 `packages/schemas`（Zod）と衝突                                                                                |
| `packages/py-evals`     | pydantic-evals 評価スイート    | 既存 `packages/evals`（TS）と衝突                                                                                   |
| `packages/py-knowledge` | LlamaIndex Workflows（知覚層） | 衝突はないが一貫性のため                                                                                            |
| `packages/api-types`    | 生成物（TS 型）                | 「UI の型」ではなく「API 契約の型」。既存生成物の置き場（`packages/schemas/src/generated`）との役割は §7.3 で分ける |

### 3.4 ディレクトリ構造

```
repo/
├── mise.toml                      # Node 24 / pnpm 11.24 / Python 3.13 / uv 0.12
├── turbo.json                     # タスクパイプライン定義
├── pnpm-workspace.yaml            # TS ワークスペース + サプライチェーン設定
├── pyproject.toml                 # [tool.uv.workspace] members = [...]
├── uv.lock / pnpm-lock.yaml / biome.json
├── AGENTS.md / CLAUDE.md          # ペアで 1 チェンジユニットとして編集する
├── .githooks/                     # pre-commit / pre-push（両言語を横断、§10.1）
├── .github/workflows/
│
├── apps/
│   ├── web/                       # 既存（@vaz/web）
│   │   ├── AGENTS.md              # next dev が自動生成・再付与する（§3.6）。コミット対象
│   │   ├── CLAUDE.md              # @AGENTS.md の 1 行のみ
│   │   └── src/app/api/chat/route.ts   # BFF: agent-api へプロキシ（§6.2）
│   ├── worker/                    # 既存（@vaz/worker, Inngest）
│   └── agent-api/                 # ← fastapi-pydantic-ai-agent 由来
│       ├── app/
│       │   ├── main.py            # app factory / middleware / 全体 Exception ハンドラ
│       │   ├── lifespan.py        # startup/shutdown の順序のみ（fail-fast）
│       │   ├── config/            # Settings（ドメイン別 mixin）
│       │   ├── observability.py   # Logfire 初期化（fail-soft）
│       │   ├── api/
│       │   │   ├── health.py      # /health, /health/ready（ReadinessProbeCache）
│       │   │   └── v1/
│       │   │       ├── router.py  # app.include_router(v1_router, prefix="/v1")
│       │   │       ├── chat.py    # POST /chat  → /v1/chat（Vercel Data Stream, §6.1）
│       │   │       ├── agent.py   # POST /agent/chat, /agent/stream（互換, §4.4）
│       │   │       ├── _stream.py # SSE ライフサイクル硬化（両契約で共用, §6.1）
│       │   │       └── rag.py     # POST /rag/{ingest,query}
│       │   ├── agents/            # guardrails.py / chat_agent.py / deps.py
│       │   ├── deps/              # auth / workflow / settings の DI
│       │   ├── models/            # Request/Response スキーマ + errors
│       │   ├── patterns/sse.py    # 独自 5 イベント codec（互換契約のみ）
│       │   └── stores/            # VectorStore / SessionStore Protocol + factory
│       ├── tests/{unit,integration,e2e,benchmarks,local}/
│       ├── Dockerfile
│       └── pyproject.toml
│
├── services/
│   └── agent/                     # 既存ステートレスサイドカー（§3.2、統合しない）
│
├── packages/
│   ├── schemas/ agents/ config/ db/ tools/ rag/ evals/   # 既存 TS 7 パッケージ
│   ├── api-types/
│   │   └── generated/             # .gitignore しない（差分レビュー対象, §7.5）
│   ├── py-agents/                 # Pydantic AI エージェント定義（再利用単位）
│   │   └── src/py_agents/{deps,chat_agent,orchestrator}.py + tools/
│   ├── py-knowledge/              # LlamaIndex Workflows（知覚層）
│   ├── py-schemas/                # 型の SSOT（Pydantic モデル）
│   └── py-evals/                  # pydantic-evals 評価スイート
│       └── datasets/*.yaml + evaluators/
│
└── docs/
    ├── adr/                       # アーキテクチャ決定記録
    ├── SPEC-AGENTIC-001.md        # 本書
    └── MIGRATION_TO_MONOREPO.md
```

### 3.5 Turborepo 設定

**前提**: Turborepo の Python（uv workspace）対応は**実験的機能**である。以下の制約を受け入れられない場合、Python 側は Turborepo 管理外（`mise` タスク直接実行）とし、TS 側のみ Turborepo で管理する構成も許容する（§12 R2 の退避経路）。

**退避経路を選ぶ理由は「実験的だから」だけではない。** 有効化条件のうち `[tool.uv.workspace]` は、ワークスペース全体で `uv.lock` を 1 つ・解決を 1 つに束ねることを意味する。これは §2.6.3 の二層バージョン方針（`apps/agent-api` は `openai` extra なし、`services/agent` は openai 3.x）と構造的に両立しない。**どのメンバーを uv workspace に含めるかは、Turborepo の採否と同一の決定である**（§12 R14）。

有効化条件:

- `turbo` と `uv` がともに PATH 上に存在すること
- リポジトリルートの `pyproject.toml` に `[tool.uv.workspace]` テーブルが存在すること
- **リポジトリが動くすべての場所（ローカル・git フック・CI）で、当該 futureFlag を認識する turbo バージョンを使うこと**。古いバージョンは未知の future flag を拒否して失敗する

`turbo@2.10.11` の `schema.json` に `futureFlags.experimentalPythonWorkspaces` が実在することを確認済み（`experimentalCargoWorkspaces` / `experimentalObservability` と並ぶ）。**版の一致は `mise.toml` の `turbo` ピン + CI での `turbo --version` アサートで機械検証する**（§10.2 の `turbo-version-check`）。

`turbo.json`:

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "futureFlags": { "experimentalPythonWorkspaces": true },
  "tasks": {
    "build": { "dependsOn": ["^build", "codegen"], "outputs": ["dist/**", ".next/**"] },
    "codegen": { "outputs": ["packages/api-types/generated/**"] },
    "lint": {},
    "typecheck": { "dependsOn": ["codegen"] },
    "test": { "dependsOn": ["^build"], "outputs": ["coverage/**"] },
    "test:e2e": { "dependsOn": ["build"], "cache": false },
    "evals": { "cache": false, "env": ["LLM_API_KEY", "ANTHROPIC_API_KEY", "LOGFIRE_TOKEN"] }
  }
}
```

キャッシュに関する Turborepo の挙動（設計上考慮すべき点）:

- Python タスクの外部依存クロージャは `uv.lock` から**メンバー単位にスコープ**して解決される。ルート所有ツールは保守的にワークスペース全体のクロージャを含む
- 自動入力からは `.venv` / `.pytest_cache` / `.ruff_cache` / `.mypy_cache` / `.pyright` / `.ty` / `__pycache__` が除外される
- **パス値を持つ uv 環境設定、`UV_NO_SYNC`、`UV_NO_PROJECT`、有効なユーザー／システム uv 設定、パススルー引数は安全にコンテンツハッシュできないため、明示的に `cache` を設定しない限り自動キャッシュを無効化する**
- pytest は継承ではなく**所有（ownership）**で扱われる。ルート宣言はリポジトリ全体の 1 タスクを生成し、メンバー宣言はそのメンバーのみのタスクを生成する。メンバーはルートの pytest 宣言を継承しない
- Turborepo は `uv.lock` を作成・更新しない。`uv lock` で明示的に更新すること
- 検出されたツールのコマンドは `--frozen` 付きで実行される

`pnpm-workspace.yaml`（既存のサプライチェーン設定を継承・拡張）:

```yaml
packages:
  - 'apps/web'
  - 'apps/worker'
  - 'packages/*'
minimumReleaseAge: 1440 # 公開 24h 未満のバージョンを解決しない
allowBuilds: {} # install スクリプトはデフォルト拒否。許可は明示記録
```

> 既存 `vaz-ai-next` の `allowBuilds` は各エントリに**監査理由のコメント付きで `false`** を並べている（`@carbon/*` はテレメトリのみ、`sharp` はプリビルドバイナリで足りる、等）。この形式を維持する。`{}` は新規パッケージ追加時の初期値であって、既存エントリを消す意味ではない。

### 3.6 ツールが生成するリポジトリ内ファイル

`next dev` は `apps/web/AGENTS.md` に自身の規約ブロック（`<!-- BEGIN:nextjs-agent-rules -->` 〜 `END`）を書き込み、削除しても再付与する（`node_modules/next/dist/server/lib/generate-agent-files.js`）。

**規約**: これを `.gitignore` せず、**作業と同じコミットに含める**。差分から取り除いても未コミットの変更が再生成されるだけであり、ツリーが汚れ続ける。

このブロックは「この Next.js は学習データのものとは異なる。コードを書く前に `node_modules/next/dist/docs/` の該当ガイドを読め」と述べている。**monorepo では `next` パッケージがリポジトリルートから見えないことがある**ため、パス解決は `apps/web/` 起点で行う。§10.1 の pre-commit がこのファイルを lint 対象外に置いていないことを確認すること（生成物だが Markdown であり、Biome の対象になり得る）。

同種の「ツールがリポジトリに書き戻すファイル」が今後増えた場合も、既定は**コミットする**である。`.gitignore` すると CI とローカルで内容が食い違い、差分の意味が失われる（§12 R12）。

---

## 4. 推論・オーケストレーション層（Pydantic AI）

### 4.1 エージェント定義の規約

```python
from dataclasses import dataclass

import httpx
from pydantic import BaseModel, Field
from pydantic_ai import Agent, ModelRetry, RunContext
from pydantic_ai.agent import AgentRetries


@dataclass
class AgentDeps:
    """実行時依存。DB 接続・HTTP クライアント・ユーザー権限を明示的に注入する。"""

    http: httpx.AsyncClient
    principal_id: str
    scopes: frozenset[str]


class AnswerWithCitations(BaseModel):
    answer: str = Field(description="ユーザーの質問への回答本文")
    citations: list[str] = Field(description="回答の根拠となった文書 ID の一覧")


chat_agent = Agent(
    settings.llm_model,                       # 環境変数から解決（プロバイダ非依存）
    deps_type=AgentDeps,
    output_type=AnswerWithCitations,
    instructions=_INSTRUCTIONS,               # system_prompt ではなく instructions（§4.1.2）
    retries=AgentRetries(tools=2, output=2),  # v2 の正しい形（§4.1.1）
    end_strategy="early",                     # v2 の既定 graceful を明示的に上書き（§4.1.3）
)
# 計装は Agent の引数ではなくプロセス起動時に一括で行う（§9.1）
```

**規約**:

- `deps_type` を必ず指定し、グローバル変数・モジュールレベルのシングルトンからの依存取得を禁ずる
- `output_type` に Pydantic モデルを指定し、`Field(description=...)` で各フィールドの意図をモデルに伝える
- **リトライ上限の明示は必須**。未指定のままリトライが発散するとコストとレイテンシが無制限に膨らむ
- リトライが恒常的に発生する場合、上限を上げるのではなく**プロンプトとスキーマの記述を改善する**

#### 4.1.1 `retries` — v1 系の書き方は `TypeError` になる

`Agent.__init__` が受けるパラメータは以下のみである（2.33.0 実測）。

```
model, output_type, instructions, system_prompt, deps_type, name, description,
model_settings, retries, validation_context, tools, toolsets, defer_model_check,
end_strategy, metadata, tool_timeout, max_concurrency, capabilities
```

したがって:

| 書き方                                                | 結果                                                                                 |
| :---------------------------------------------------- | :----------------------------------------------------------------------------------- |
| `Agent(..., output_retries=2)`                        | ❌ `TypeError: Agent.__init__() got an unexpected keyword argument 'output_retries'` |
| `Agent(..., instrument=True)`                         | ❌ `TypeError: Agent.__init__() got an unexpected keyword argument 'instrument'`     |
| `Agent(..., retries=2)`                               | ✅ ツール・出力の**両方**に 2 を適用                                                 |
| `Agent(..., retries=AgentRetries(tools=2, output=2))` | ✅ 個別指定。`AgentRetries` は `pydantic_ai` ルートからも import 可                  |

**個別に値を変えないのであれば `retries=2` で十分**である。本書が `AgentRetries` を明示形として示すのは、「ツール検証失敗と出力検証失敗は別の予算である」という設計意図をコード上に残すためである。

#### 4.1.2 `instructions` を使い、`system_prompt` を使わない

v2 では `instructions` が推奨形である。`system_prompt` は `message_history` に残留するため、**run を跨いで履歴を持ち回す設計では意図しないプロンプト混入の原因になる**。§6.4 の HITL は「停止 → 承認 → 再開」で必ず `message_history` を持ち回すので、この選択は HITL の正しさに直結する。

`pydantic-ai-sandbox` の `patterns/hitl/src/patterns_hitl/agent.py` が、この理由を docstring に明記したうえで `instructions` を採用している。移植時にこの判断も一緒に持ち込むこと。

#### 4.1.3 `end_strategy` — v2 で既定が反転している

|                | 既定値           |
| :------------- | :--------------- |
| Pydantic AI v1 | `"early"`        |
| Pydantic AI v2 | **`"graceful"`** |

`graceful` は最終結果が出た後も、既に要求済みのツール呼び出しを実行し続ける。これは以下をすべて変える:

- ガードレールが記録するツール呼び出し回数
- `AuditTrail` の内容（= `ChatResponse.audit` としてクライアントへ返る値）
- トークン予算の計上

`fastapi-pydantic-ai-agent` の `build_chat_agent()` は既に `end_strategy="early"` を明示ピンしている。**新規エージェントもこれに揃える。** RAG エージェントのように関数ツールを 1 つも登録しないエージェントでは無効なので、そこでは省略してよい。

なお、テストは `agent.end_strategy` を読むのではなく**コンストラクタに渡された kwargs をアサートする**こと。構築後に読むと「明示的なピン」と「たまたま既定値と一致」を区別できない。

### 4.2 ツール設計

```python
@chat_agent.tool
async def search_knowledge_base(ctx: RunContext[AgentDeps], query: str) -> str:
    """社内ナレッジベースを検索し、関連する文書断片を返す。

    質問が社内固有の情報（規程・手順・過去の意思決定）を必要とするときに使う。
    一般常識やモデルが既に知っている事柄には使わない。

    Args:
        query: 検索クエリ。自然文で指定する。
    """
    if "kb:read" not in ctx.deps.scopes:
        raise ModelRetry("この操作の権限がありません。別の手段を検討してください。")
    return await knowledge.query(query)
```

#### 4.2.1 ツール数の上限

ツール選択精度はツール数に対して非線形に劣化する。実測の集約では、実務上の安全域は概ね **10〜20 個**で、20〜50 を超えると tool collision / hallucinated tool / attention dilution により精度が急落する。GitHub Copilot は 40→13 への削減で SWE-Lancer / SWEbench-Verified において 2〜5 ポイントの改善と 400ms のレイテンシ削減を得た。

**規約**:

- **1 エージェントあたりのツール数を 20 個以下に制限する**（CI で機械的に検証、§10.2 の `tool-count-check`）
- 20 を超える場合は、(a) サブエージェントへの分割、(b) Tool RAG / routing の導入、のいずれかを選択する。**上限の緩和は選択肢としない**

> pydantic-ai 2.33.0 には `capabilities.ToolSearch`（`ToolSearchLocalStrategy` / `ToolSearchNativeStrategy`）が存在し、(b) の Tool RAG をフレームワーク側で実現できる。20 個超過時の第一選択肢として評価すること（§12 R6 / R7）。

#### 4.2.2 ツール記述の規約

以下は Anthropic「Writing effective tools for AI agents」（§13.5）の推奨に基づく。

- **docstring は「いつ使うか」を書く**。「何をするか」だけの記述は選択精度を落とす（上記コード例の 2 行目・3 行目がこれにあたる）
- **名前空間化する**。ツール名はサービス・リソース単位で前置する（例: `search` / `ingest` ではなく `knowledge_base.search` / `knowledge_base.ingest`）。似た名前・重複した機能のツールが並ぶと選択精度が落ちる点は、§4.2.1 のツール数上限と同じ攻撃面である
- **応答の詳細度を切り替え可能にする**。既定は簡潔な応答（token 消費を抑える）とし、詳細情報が要る場面のみ `response_format` のようなパラメータで切り替える（原則 6）。エラーメッセージは「次に何をすべきか」を含め、モデルが自己修正できる形にする（§4.3 の `ModelRetry` と同じ設計動機）
- **評価駆動で反復改善する（Prototype → Evaluate → Collaborate）**。ツールは実装して終わりにせず、§10.3 の evals 基盤でツール選択精度・呼び出し成功率を計測し、docstring・パラメータ設計を反復修正する。**新規ツール追加時は §8.4 の evals ケースを最低 1 件追加することを受け入れ条件とする**

### 4.3 出力検証と自己修正

```python
@chat_agent.output_validator
async def validate_citations(
    ctx: RunContext[AgentDeps], out: AnswerWithCitations
) -> AnswerWithCitations:
    """引用文書 ID が実在することを検証する（意味的検証）。"""
    unknown = [c for c in out.citations if not await knowledge.exists(c)]
    if unknown:
        raise ModelRetry(
            f"存在しない文書 ID が含まれています: {unknown}。"
            "検索結果に実在した ID のみを引用してください。"
        )
    return out
```

検証は二段構えで機能する。**構文的検証**（Pydantic の型・required・制約）と**意味的検証**（`output_validator` によるビジネス的正しさ）である。いずれの失敗も `ModelRetry` として会話履歴に差し戻され、モデル自身が修正を試みる。

#### 4.3.1 `output_type` が union のときの静的ガード

§6.4 の HITL を有効にすると `output_type` は `[AnswerWithCitations, DeferredToolRequests]` の union になる。このとき validator のシグネチャは union 全体に紐づくが、**フレームワークは `DeferredToolRequests`（制御フローのセンチネル）を validator 実行前に剥がす**ため、実行時にはその分岐へ到達しない。pyright strict では必ず指摘されるので、到達不能であることをコメントで明示したうえでガードを置く。

```python
def enforce_policy(
    out: AnswerWithCitations | DeferredToolRequests,
) -> AnswerWithCitations | DeferredToolRequests:
    # フレームワークが validator 実行前に剥がすため実行時には到達しない。
    # validator の静的シグネチャが output_type の union 全体に紐づくために必要。
    if isinstance(out, DeferredToolRequests):  # pragma: no cover
        return out
    ...
```

`patterns/hitl` の `_make_approval_policy_validator` が同じ形を実装済みである。

### 4.4 既存リポジトリからの必須改修

`fastapi-pydantic-ai-agent` を本設計に取り込むにあたり、以下 2 点は**必須**である。

**改修 A: SSE ワイヤフォーマットの追加（置換ではない）**

既存実装は独自の 5 イベント判別共用体（`step_started` / `tool_called` / `token` / `completed` / `error`）を `app/patterns/sse.py` で定義している。`_stream.py` はライフサイクル制御のみを持ち、ワイヤ codec も方針も持たない — この分離が本改修を容易にする。

本設計では:

- **`/v1/chat` を新設**し、`VercelAIAdapter` による Data Stream Protocol を正式契約とする（§6.1）
- 既存の `/v1/agent/stream`（独自 5 イベント）は**非 Vercel クライアント向けの互換エンドポイントとして残置**する。ただし新規機能は `/v1/chat` にのみ実装する（§12 R8）
- `_stream.py` のライフサイクル硬化（`sse_max_events` 上限、クライアント切断検知、`sse_send_timeout`、アイドルハートビート、`Cache-Control: no-cache` / `X-Accel-Buffering: no`）は**両エンドポイントで共用する**

**改修 B: `apps/agent-api` の Turborepo / uv workspace 化**

`pyproject.toml` をワークスペースメンバーとして再配置し、`packages/py-*` への path 依存を張る。`mise` タスクは残し、`turbo` はその上に載せる（`turbo` を外しても開発できる状態を維持する。§12 R2 の退避経路の前提）。

#### 4.4.1 改修 A の実装形

**`dispatch_request` にライフサイクル層を挟み込むことは API 的に成立しない。**

```python
# 実測シグネチャ（2.33.0）
VercelAIAdapter.dispatch_request(request, *, agent, sdk_version=5, ...) -> Response
```

`dispatch_request()` は**完成した `Response` を返す**のに対し、既存の `_run_with_lifecycle_guards` は `AsyncIterator[SSEEvent]` を受けて `AsyncIterator[str]` を返す**ジェネレータ層**である。前段にも後段にも挟めない。

正しい実装形は、Adapter を細粒度メソッドに分解し、その中間にライフサイクル層を差し込むことである。§6.2 に列挙した個別メソッドは、まさにこの用途のために提供されている。

```python
adapter = VercelAIAdapter.from_request(request, agent=chat_agent, sdk_version=7)

chunks = adapter.run_stream(                     # AsyncIterator[BaseChunk]
    deps=deps,
    toolsets=[guarded],                          # §6.1 のガードレール
    usage_limits=usage_limits,
    output_type=[ChatOutput, DeferredToolRequests],
)
guarded_chunks = _run_with_lifecycle_guards(     # 既存資産をそのまま再利用
    request, chunks, settings,
)
return StreamingResponse(
    adapter.encode_stream(guarded_chunks),       # SSE 文字列へエンコード
    media_type="text/event-stream",
    headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
)
```

**受け入れ条件**: `_run_with_lifecycle_guards` の型を `SSEEvent` から総称に広げること（現状は `app.patterns.sse.SSEEvent` に固定）。イベントの中身には触れず個数と時間だけを見る層なので、`AsyncIterator[T] -> AsyncIterator[T]` に一般化できる。

**`_drive_to_queue` の制約は維持すること**: イベントジェネレータは**単一の永続タスク**で最後まで駆動し、`asyncio.Queue` 経由で通信する。`Agent.iter()` は yield を跨いで anyio のキャンセルスコープを開いたままにし、anyio は同一タスクでの enter / exit を要求するため、反復ごとに新しい `asyncio.wait_for()` で `__anext__()` を駆動すると `Attempted to exit cancel scope in a different task` になる。ハートビートは `asyncio.wait()` を使い、`asyncio.wait_for()` を使わない（進行中のイベントをキャンセルしてしまうため）。

**SSE の行分割に `str.splitlines()` を使わないこと（X-10、v1.7 で追加）**: これは `fastapi-pydantic-ai-agent` が上記 2 点と並んで実際に踏んだ第 3 の罠である。Pydantic は JSON 文字列中の **U+2028（LINE SEPARATOR）/ U+2029（PARAGRAPH SEPARATOR）をエスケープせずに出力**する一方、Python の `str.splitlines()` はこの 2 文字を**行境界として扱う**。したがってモデル出力にこれらの文字が含まれると、1 本の `data:` 行が途中で 2 行に割れ、受け手側の JSON パースが失敗する。

**規約**:

- 分割は**実 SSE 終端子（`\r\n` / `\r` / `\n`）のみ**で行う。移植元は `fastapi-pydantic-ai-agent/app/patterns/sse.py:6,103` の `parse_sse_events()` がこの形になっている
- この規約は**エンコード側**（`encode_stream()` の出力を再加工する層。§4.4.1 のライフサイクル層は本来イベントを触らないが、将来ここに分割処理を置かない担保として明記する）と**検証側**（§8.3 の E2E がレスポンス本文を行に割ってチャンクを検証するとき）の両方に効く
- **回帰テストを P3 の受け入れ条件に含める**（§11）: U+2028 を含む応答が 1 つの SSE イベントとして復元されること。再発見のコストが高い一方、テストは 1 本で足りる

---

## 5. マルチエージェント協調の適用規約

### 5.1 適用判断フロー

以下をすべて満たす場合にのみマルチエージェント化する。1 つでも満たさない場合は単一エージェント + ツールで実装する。

1. タスクが**幅優先的**である（独立した複数方向の探索が並列に走る）
2. 単一エージェントでコンテキスト汚染またはツール数超過が**実測されている**
3. 約 15 倍のトークンコストを回収できる価値がある

### 5.2 採用する協調パターン

| パターン                  | 適用対象                         | 実装方針                                                                                                                                                                           |
| :------------------------ | :------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Orchestrator-Worker**   | 広範な調査・多面的情報統合       | リードエージェントがサブタスクを分解し並列委譲、結果を統合。**委譲指示の曖昧さがサブエージェントの重複作業を生む**ため、各サブタスクの担当範囲・出力形式・停止条件を構造化して渡す |
| **Generator-Verifier**    | コード生成、規制適合検証         | Pydantic AI の `output_validator` + `ModelRetry` をミクロ実装とする。マクロには生成用と検証用の別エージェントを立てる                                                              |
| **Router / Hierarchical** | 複数ドメインにまたがる問い合わせ | 単一のオーケストレーション点で管理・障害切り分けを容易にする                                                                                                                       |
| **P2P Swarm**             | **本システムでは採用しない**     | §5.3 の集団的失敗リスクが管理コストに見合わない                                                                                                                                    |

> **移植元**: `pydantic-ai-sandbox` の `patterns/` に `orchestrator-workers` / `routing` / `evaluator-optimizer`（= Generator-Verifier）/ `parallelization` / `prompt-chaining` / `deep-research` の各レーンが、共有の `patterns/contracts` パッケージ（型の SSOT + 契約ドリフトテスト）とともに実装済みである。`frameworks/llamaindex` と `frameworks/beeai` に同一パターンの別フレームワーク実装もある。**上表の各パターンを新規実装する前に、対応するレーンを読むこと。** 特に `patterns/contracts` の「レーンは互いを import せず、共有型は contracts のみに置く」という規律は、本設計の `packages/py-agents` にそのまま持ち込む価値がある。

### 5.3 集団的失敗（low-variance）への防御

同一基盤モデルに由来するエージェント群は、人間組織と異なり特定の失敗パターンに**同調**する。

**防御要件**（マルチエージェント構成を採用する場合、以下は必須）:

- **決定論的アービター**: 命名・リソース割当は LLM に決めさせず、決定論的なコンポーネントが払い出す
- **リソース排他制御**: 共有リソースへのアクセスは明示的なロック機構を通す
- **レートリミット**: サブエージェントからの内部 API 呼び出しに秒間上限を設ける。ポーリングはバックオフを強制する（実装は §5.4）
- **ルールベース制約層**: エージェントの自律性の外側に、違反時に即座に停止する規則層を置く

**根拠**: 上記 4 要件は Anthropic engineering blog（2025-06-13）および IBM のエージェント参照アーキテクチャに基づく、プロダクション向けの推奨事項である。**要件は以下の実験数値の真偽と独立に有効である。**

**動機付けの傍証**（設計指針ではない）: Anthropic の AI 安全性研究（Frontier Red Team, 2026-08-13）では、30 エージェント中 18 エージェントが完全に同一のブランチ名 `mvp-game-loop` を作成しようとして競合し、また秒間 30 回のポーリングデーモンがジョブキューを飽和させて 240 万件のリクエストのうち 117 件しか受理されなかった、という観測がある。同実験では 45 エージェント + 共有フォーラム + arbiter による協調スウォームが 2,700 万トークンで 266 件の脆弱性を発見したのに対し、独立並列実行は 650 万トークンで 21 件だった。協調には価値があるが、依存関係の強いタスクでは PR マージ率が崩壊した。

### 5.4 サブエージェント間の内部レートリミット

§5.3 の「レートリミット」要件は、既存資産で実装できる。`apps/agent-api` は既に `app.state.limiter`（slowapi）を持ち、グローバル制限と `enforce_llm_rate_limit` の両方が同じストレージ（Redis もしくはメモリ）を共有している。サブエージェントからの内部呼び出しにも**同じ limiter を使う**こと。別系統の制限を新設すると、原則 5 に反して 2 つの真実源ができる。

レートリミットのキーは `get_client_identifier()` が返す値だが、内部呼び出しには `request.client.host` が存在しないため、**サブエージェント用のキー導出関数を別に定義する**（例: `f"agent:{jobId}:{specialist}"`）。これは新設が正当な例外である。

### 5.5 Deep Research 型ワークフローの参照実装

「幅広い調査要求を並列展開し、統合された回答を返す」アプリケーションは、§5.2 の **Orchestrator-Worker パターンの具体的な適用例**である。フレームワークは異なるが構造は同型であるため、実装前に以下 2 件を構造参照として読むこと。

| 参照実装                                                  | フレームワーク           | 構造                                                                                                                                                                                            | 本設計での対応                                                                                                                                                                                                                                  |
| :-------------------------------------------------------- | :----------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `langchain-ai/open_deep_research`                         | LangGraph                | **Supervisor** が要求を分解し複数の **Researcher** サブエージェントを動的に生成・並列実行して結果を回収する。調査結果は専用の圧縮（compression）モデルで要約してから Supervisor に返す 2 段構成 | `vaz-ai-next` の `packages/agents/src/supervisor.ts`（`createSupervisorWorkflow`）が同型。`rag-research` スペシャリストが Researcher、`document-generation` スペシャリストへの `citations` 自動引き継ぎが圧縮モデルの役割に相当する             |
| `huggingface/smolagents` の `examples/open_deep_research` | smolagents（Code Agent） | 管理エージェントが `search_agent` を**ツールとして**呼び出す階層構成。エージェントの行動そのものをコードとして生成する Code Agent 方式を採る                                                    | 本設計は Pydantic AI ベースであり Code Agent 方式は採らないが、「サブエージェントを親から見て 1 個のツール呼び出しとして扱う」という**呼び出し境界の設計**は §5.4 の内部レートリミット（`agent:{jobId}:{specialist}` キー）にそのまま流用できる |

**移植方針**: 上記 2 件は「何を作ろうとしているか」の構造参照であり、コードの移植元ではない（フレームワークが異なる）。実装の移植元は既存 3 参照リポジトリを以下の順で読むこと。

1. **`pydantic-ai-sandbox` の `patterns/deep-research` レーン** — 本設計と同じ Pydantic AI ベースであり、最優先の移植元
2. `vaz-ai-next` の `createSupervisorWorkflow` — エンジン非依存の `WorkflowStepRunner` シーム、citation 引き継ぎ、`SpecialistUnavailableError` の扱いなど、本設計の §5〜§6 が前提とする実装がそのまま存在する
3. 上記 2 件で解決しない構造上の疑問（並列度の決め方、圧縮モデルの要否判断など）にのみ、`open_deep_research` / `smolagents` の設計を参考にする

**適用判断は §5.1 のフローを経由する**。Deep Research 型のワークフローは典型的な「幅優先探索」であり §5.1 の条件 1 を満たしやすいが、条件 2（コンテキスト汚染またはツール数超過の実測）と条件 3（トークンコストの回収可否）は個別に検証すること。§5.1 を通過しない場合は、単一エージェント + §4.2 のツール + 原則 6 の just-in-time retrieval で十分なことが多い。

---

## 6. API 契約仕様

### 6.1 `/v1/chat` — Vercel AI Data Stream（正式契約）

```python
# app/api/v1/chat.py
from fastapi import APIRouter, Depends, Request
from starlette.responses import StreamingResponse
from pydantic_ai import DeferredToolRequests
from pydantic_ai.ui.vercel_ai import VercelAIAdapter

from app.agents.chat_agent import ChatOutput, build_chat_agent
from app.agents.guardrails import build_guarded_toolset
from app.api.v1._stream import run_with_lifecycle_guards
from app.deps.auth import verify_api_key
from app.deps.settings import get_request_settings
from app.middleware.rate_limit import enforce_llm_rate_limit
from app.security.principal import Principal

router = APIRouter()


@router.post(
    "/chat",                                    # ← "/v1/chat" ではない（§6.1.1）
    dependencies=[Depends(enforce_llm_rate_limit)],
)
async def chat(
    request: Request,
    principal: Principal = Depends(verify_api_key),   # noqa: B008
    deps: AgentDeps = Depends(get_agent_deps),        # noqa: B008
    settings: Settings = Depends(get_request_settings),  # noqa: B008
) -> StreamingResponse:
    """Vercel AI Data Stream Protocol でエージェント応答をストリームする。"""
    agent = request.app.state.chat_agent
    deps.principal = principal                  # bind_principal（監査の帰属に必須）

    adapter = VercelAIAdapter.from_request(
        request,
        agent=agent,
        sdk_version=7,                          # 7 は 6 と同一プロトコルを emit する
        # 信頼境界のデフォルトは変更しない（§6.3）
    )

    assert_approvals_not_dropped(adapter)       # §6.4 サーバ側 fail-loud

    guarded = build_guarded_toolset(agent, deps=deps, settings=settings)

    chunks = adapter.run_stream(
        deps=deps,
        toolsets=[guarded],                     # ガードレールを迂回させない（原則 5）
        usage_limits=build_usage_limits(settings),
        output_type=[ChatOutput, DeferredToolRequests],   # HITL 有効化（§6.4）
    )
    return StreamingResponse(
        adapter.encode_stream(run_with_lifecycle_guards(request, chunks, settings)),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
```

#### 6.1.1 必須の依存性

`/v1/chat` は既存の `/v1/*` と**同じ防御**を持たなければならない。以下はすべて必須であり、省略は仕様違反とする。

| 要素                                    | 理由                                                                                                                     | 省略時に起きること                                                                                         |
| :-------------------------------------- | :----------------------------------------------------------------------------------------------------------------------- | :--------------------------------------------------------------------------------------------------------- |
| `Depends(verify_api_key)`               | 既存 `/v1/*` は全ルートが保有                                                                                            | **無認証で LLM を叩けるエンドポイント**が生まれる                                                          |
| `Depends(enforce_llm_rate_limit)`       | 同上                                                                                                                     | 課金される経路が無制限に開く                                                                               |
| `toolsets=[build_guarded_toolset(...)]` | ガードレールは `run_guarded` と SSE ストリームの **2 つの独立した設置点**で installed され、両方がテストでピンされている | ツール allow-list・承認フック・トークン予算・`AuditTrail`・`StopReason` 分類が `/v1/chat` だけ丸ごと消える |
| `deps.principal` の束縛                 | `AgentDeps.principal` は `get_agent_deps()` ではなく各ルート入口で `bind_principal()` される（DI の循環回避のため）      | すべての `AuditRecord` の帰属が失われる                                                                    |
| `usage_limits=`                         | トークン暴走の遮断                                                                                                       | コストの上限が消える                                                                                       |
| パスは `"/chat"`                        | `app/main.py` が `app.include_router(v1_router, prefix="/v1")` で prefix を付与                                          | `"/v1/chat"` と書くと **`/v1/v1/chat`** になる                                                             |

ガードレールの install イディオムは `agent.override(tools=[], toolsets=[guarded])` である。`agent.toolsets` は `override(toolsets=...)` の有無にかかわらず `@agent.tool` 登録のツールを**再包含する**ため、`tools=[]` を省くと全直接ツールが二重登録される。

#### 6.1.2 `sdk_version` の仕様

`VercelAIAdapter` は `Literal[5, 6, 7]` を受け付ける。デフォルトは後方互換のため **5**。

ソース上、`ToolApprovalRequestChunk` の emit は `if self.sdk_version >= 6` でガードされており、同じ条件がツール引数の検証失敗（`args_valid is False`）と拒否結果（`outcome == 'denied'`）の扱いにも適用される。**HITL には 6 以上が必須**であり、7 は 6 と同一の data-stream protocol を emit する。本システムはフロントが AI SDK 7 であるため `sdk_version=7` を指定する。

### 6.2 Adapter が提供する個別メソッド

| メソッド                                               | 役割                                                                                          |
| :----------------------------------------------------- | :-------------------------------------------------------------------------------------------- |
| `build_run_input(body: bytes) -> RequestData`          | リクエストボディから `RequestData` を構築                                                     |
| `from_request(request, *, agent, sdk_version=5, ...)`  | Starlette/FastAPI リクエストから Adapter を直接構築                                           |
| `run_stream(...) -> AsyncIterator[EventT]`             | エージェントを実行し Vercel AI イベント列を返す。`on_complete` / `on_cancel` コールバック対応 |
| `run_stream_native()`                                  | Pydantic AI ネイティブイベント列を返す（`transform_stream()` で変換可能）                     |
| `encode_stream()`                                      | イベント列を SSE 文字列にエンコード                                                           |
| `dispatch_request(request, *, agent, ...) -> Response` | 上記を一括で行い完成した `Response` を返す                                                    |

**本設計は `dispatch_request` を使わない。** §4.4.1 の理由により、`from_request` → `run_stream` → ライフサイクル層 → `encode_stream` に分解する。`dispatch_request` は「ガードレール・ライフサイクル硬化を持たない最小構成」であり、プロトタイプ以外では使用を禁ずる。

### 6.3 信頼境界（Trust Model）

**Vercel AI のリクエスト messages 配列は完全にクライアント制御下にある**。プロトコルは承認応答とツール結果をメッセージ履歴経由でラウンドトリップさせる。`VercelAIAdapter` はエージェント実行前に信頼できないパートを剥奪するデフォルトを適用する。

**実パラメータとデフォルト値**（`from_request` / `dispatch_request` 共通）:

| パラメータ                        | デフォルト                     | 意味                                                                                     | 変更時のリスク                                                                                                                                |
| :-------------------------------- | :----------------------------- | :--------------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------------------------------------------------------------------- |
| `manage_system_prompt`            | `'server'`                     | クライアント送信の system メッセージを警告付きで剥奪し、毎リクエストでサーバ側から再注入 | `'client'` にするとプロンプト全体がクライアント制御下に落ちる                                                                                 |
| `allowed_file_url_schemes`        | `frozenset({'http', 'https'})` | file URL のスキーム制限                                                                  | `file://` 等の追加はローカルファイル読み出しに直結                                                                                            |
| `allowed_file_url_force_download` | `frozenset()`（空）            | 強制ダウンロードモードの許可集合                                                         | **`'allow-local'` の追加は CVE-2026-25580 / CVE-2026-46678（SSRF、クラウドメタデータ到達、IPv6 遷移形式によるブロックリスト回避）の当該経路** |
| `allow_uploaded_files`            | `False`                        | アップロードファイルの受理                                                               | 有効化時は別途サイズ・型・保存先の規定が必要                                                                                                  |

**規約**: これら 4 つのデフォルトは変更しない。変更する場合は `docs/adr/` に決定記録を残し、脅威モデルの再評価を受け入れ条件とする。

**ただしこれらのデフォルトはクライアント提出履歴を「本物」にするものではない。** 権威ある履歴の扱いは §6.3.1 で規定する。

#### 6.3.1 SessionStore との接続

`apps/agent-api` は既に**サーバ側のセッション所有権モデル**を持つ。セッション id は `{principal.id}.{token}.{signature}` の形で、署名は `session_signing_key` を鍵とする最初の 2 部分に対する HMAC である。`authorize_session()` が `secrets.compare_digest` で検証し、不正・他人のものは 403 になる。**この設計は所有権テーブルもルックアップも要求しない。**

一方 Vercel プロトコルは履歴をクライアントが往復させる。何もしないと **`/v1/chat` だけが所有権モデルの外に出る**（原則 5 違反）。

**規約**:

- `/v1/chat` は既存の `X-Session-Id` 相当を受け取り、`authorize_session()` を通す
- 権威ある履歴は `SessionStore` から読み、`adapter.run_stream(message_history=...)` に**サーバ側の履歴を渡す**
- クライアント提出履歴は、**承認応答（`approval-responded`）の抽出にのみ**使う。それ以外の内容は権威としない
- 応答完了後の履歴保存は既存の規律に従う。**停止した run（`stop_reason != "completed"`）は履歴を保存しない**（その turn の記録は `AuditTrail` が担う）

`POST /v1/agent/chat` は id が未提示なら新規発行するが、`/v1/chat` は SSE 契約に新規 id を返すフィールドがないため、**既存 id の認可しかできない**。id の発行経路を先に通すこと（既存 `/v1/agent/stream` と同じ制約）。

### 6.4 HITL（Human-in-the-Loop）仕様

**サーバ側（Pydantic AI）**:

- 承認が必要なツールに `requires_approval=True` を指定する（`Tool(fn, requires_approval=True)` または `@agent.tool(requires_approval=True)`）。**どのツールに付けるかの判断は §6.4.3 に従う**
- 条件付き承認は `if not ctx.tool_call_approved: raise ApprovalRequired` で表現する
- エージェントの `output_type` に `DeferredToolRequests` を含める。run はこれを出力して一時停止する
- 承認後は `agent.run(None, message_history=result.all_messages(), deferred_tool_results=DeferredToolResults(approvals=...))` で再開する
- **再開後も `DeferredToolRequests` が返り得る**（承認済みツール実行後にモデルが別の承認必須ツールを呼ぶ）。戻り値型を単一の構造化出力に固定せず、`while` ループか明示的な `isinstance` ガードで扱う
- **`UsageLimits` は run ごとにリセットされる**。停止・再開を跨いで予算を通算するには再開 run に `usage=result.usage` を渡す

**クライアント側（AI SDK 7）**:

- `useChat` の `addToolApprovalResponse` で承認／拒否を送信する（`@ai-sdk/react@4.0.79` の `useChat` 戻り値に実在を確認）
- ツールパートは `tool-<toolName>`、保留状態は `approval-requested`、応答済みは `approval-responded`

#### 6.4.1 承認の握り潰しに対する防御

**欠陥の実体**（`pydantic-ai-slim 2.33.0` のソースより）:

```python
# pydantic_ai/ui/vercel_ai/_utils.py
def iter_tool_approval_responses(messages):
    for msg in messages:
        if msg.role == 'assistant':                                   # ← assistant 以外は走査しない
            for part in msg.parts:
                if isinstance(part, _APPROVAL_RESPONDED_TYPES) and \
                   isinstance(part.approval, ToolApprovalResponded):   # ← 不一致なら黙って skip
                    yield part.tool_call_id, part.approval

# pydantic_ai/ui/vercel_ai/_adapter.py
return DeferredToolResults(approvals=approvals) if approvals else None   # ← 空なら None
```

`None` が返ると run は「承認なし」で再開され、**ツールは実行されず、例外もログも出ない**。degradation 自体は fail-safe（ツールは実行されない）だが、ユーザーには「承認したのに何も起きない」として見える。**クライアント側のタイムアウト監視だけでは症状の表示にしかならず、本番で検知・追跡できない。** 防御を 3 層に分ける。

**対策 1（第一防御・サーバ側 fail-loud）**: 「承認応答パートが提出されているのに、上流のパーサが 1 件も拾えなかった」ケースを検出して 422 で落とす。

```python
from pydantic_ai.ui.vercel_ai.request_types import (
    DynamicToolApprovalRespondedPart,
    ToolApprovalResponded,
    ToolApprovalRespondedPart,
)

_RESPONDED_PARTS = (ToolApprovalRespondedPart, DynamicToolApprovalRespondedPart)


def find_dropped_approvals(messages) -> list[str]:
    """上流が黙って捨てる承認応答の tool_call_id を返す。

    上流 (`iter_tool_approval_responses`) は `role == "assistant"` かつ
    `approval` が `ToolApprovalResponded` のパートしか拾わない。それ以外は
    例外もログもなく無視され、承認ターンが消える。ここでは同じ 2 条件を
    反転して評価し、消えるものを列挙する。
    """
    dropped: list[str] = []
    for msg in messages:
        responded = [p for p in msg.parts if isinstance(p, _RESPONDED_PARTS)]
        if msg.role != "assistant":
            dropped += [p.tool_call_id for p in responded]      # ロール不一致で消える
            continue
        dropped += [
            p.tool_call_id
            for p in responded
            if not isinstance(p.approval, ToolApprovalResponded)  # 形不一致で消える
        ]
    return dropped
```

呼び出し側は `find_dropped_approvals(adapter.run_input.messages)` が非空なら、既存のフラットな `ErrorResponse` 封筒（`{message, code}`）で **422 `code="APPROVAL_RESPONSE_MALFORMED"`** を返す。

この判定は**未応答の承認要求を誤検知しない**。ユーザーがまだ決めていない保留中の承認は `approval-requested` のまま送られてくるので `_RESPONDED_PARTS` に一致せず、対象外である。判定しているのは「応答したつもりのパートが提出されているのに拾われない」場合のみである。

**対策 2（クライアント側 UX）**: 承認対象ツールに対して、承認 → 実行開始イベントをフロント側でタイムアウト監視する。一定時間内に実行開始イベントが来ない場合、UI にエラーを表示して再送を促す。対策 1 で 422 が返る場合はこちらは発火しない（エラーが即座に届く）ため、対策 2 が残ってカバーするのは「サーバ側の判定をすり抜けた未知の経路」だけである。

**対策 3（回帰テスト）**: E2E に「承認したのに実行されない」ケースの検出を含める（§8.3-6）。加えて unit テストで `find_dropped_approvals` の 2 分岐（ロール不一致・形不一致）を直接ピンする。

**撤去条件**: Pydantic AI が `iter_tool_approval_responses` の skip を例外化するか、`DeferredToolResults` に「提出されたが解決できなかった承認」を残すようになったら、対策 1 を上流に委ね対策 2 を撤去する。リリースノートの監視対象とする（§12 R3）。

#### 6.4.2 移植元

`pydantic-ai-sandbox` の `patterns/hitl` に、停止・承認・再開ハーネスの動作する実装がある。

| ファイル                                            | 内容                                                                                                           |
| :-------------------------------------------------- | :------------------------------------------------------------------------------------------------------------- |
| `src/patterns_hitl/agent.py`                        | `ApprovalRequired` / `Tool(..., requires_approval=True)` / union `output_type` / union 対応 `output_validator` |
| `src/patterns_hitl/app.py`                          | FastAPI `POST /run`（停止 = `DeferredToolRequests` を返す）/ `POST /resume`（承認結果で再開）                  |
| `src/patterns_hitl/store.py`                        | `message_history` の状態ストア                                                                                 |
| `src/patterns_hitl/audit.py`                        | 監査証跡                                                                                                       |
| `tests/unit/test_stop_approve_resume.py` ほか 12 本 | pyright strict / coverage `fail_under = 98`                                                                    |

**§11 の P4 は「新規実装」ではなく「移植 + `/v1/chat` への接続 + §6.4.1 の防御追加」である。** ただし `patterns/hitl` は Python 3.14 レーンなので、`apps/agent-api`（3.13）へ持ち込む際に 3.14 固有の構文がないことを確認すること。

#### 6.4.3 承認範囲の較正

§6.4.1〜6.4.2 は「承認を正しく機能させる」実装だが、**どのツールに `requires_approval=True` を付けるか**という設計判断そのものは別に規律が要る（原則 7）。

**問題の実体**: Anthropic の本番テレメトリでは、permission prompt の 93% が内容を読まれずに承認されている。ユーザーは経験を積むほど自動承認率を上げ（新規ユーザー約 20% → 約 750 セッション経験者で 40% 超）、運用の実態は「承認による事前抑止」から「監視による事後介入」へ移行する。**承認ダイアログを広く設置するほど、この移行が早まり、防御は名目化する。**

**規約**:

- `requires_approval` / `needsApproval` は**取り消し不能（irreversible）または実世界に影響する副作用を持つ操作**（`@vaz/tools` の `sendEmail` 等、`RECIPIENT_ALLOWLIST` と対になるもの）に限定する。読み取り専用・冪等な操作には付けない
- 上記に該当しない操作の防御は、承認ではなく §9.1 の `AuditTrail` / 監査ログによる**事後追跡**に委ねる。承認と監査は代替関係にあり、同じ操作に両方を重ねて要求疲れを生まない
- 承認要求を追加する変更は、既存の `ADMIN_EMAILS` / `RECIPIENT_ALLOWLIST` と同様に**コミットレビューを経た明示的な追加**とし、実行時のヒューリスティックで動的に承認要否を決めない（原則 5・§6.3 の信頼境界と同型の理由）
- **クライアントが提出する構造体に承認要否フラグを載せて配線することを禁ずる。** 具体例: `apps/worker` の承認ゲートを閉じる目的で `@vaz/schemas/workflows` の `workflowStepSchema` に `requiresApproval` を追加し、`POST /api/jobs` が受け取ったプランから読む方式は採らない。承認要否がクライアント制御下に落ちるため、上記 2 項および §6.3 に反する。述語はコミット済みコード側に置く（現行の `requiresApprovalForKind`（kind 単位）がこの形である）
- エージェントの安全性は**モデル・ハーネス・ツール・環境の 4 層責任分界**で設計する（本設計での対応: モデル＝プロバイダ選択と `resolveModel`、ハーネス＝§4〜§6 の推論・ガードレール層、ツール＝`@vaz/tools` / `RECIPIENT_ALLOWLIST`、環境＝§6.1 の境界防御層）。いずれか 1 層だけで安全性を担保しようとしない

**根拠**: Anthropic「Measuring AI agent autonomy in practice」「Trustworthy agents in practice」「Our framework for developing safe and trustworthy agents」（§13.5）。関連リスク: §12 R13。

---

### 6.5 OWASP 対応表（LLM Top 10 ＋ Agentic AI Top 10）— X-13

**背景**: 横断検証（§0.3.1）の実測では、本リポジトリと `vaz-ai-next` のいずれも OWASP 対応表を持たない。既存資産は 2 つあり、**対象タクソノミが異なるため重複しない**。

| 出所 | 表 |
| :--- | :--- |
| `fastapi-pydantic-ai-agent/docs/owasp-agentic-llm-mapping.md` | **LLM Top 10（2025）** の全 10 行。各行に「Mitigated / Partial・accepted / Accepted」の状態、実装モジュール、**テストファイル**を引用する |
| `pydantic-ai-sandbox/patterns/SECURITY-NOTES.md` | **Agentic AI Top 10（2025-12）** をレイヤ別（autonomous-agent / RAG / SSE / deep-research / HITL）に。CVE floor 表と no-fix advisory ランブック付き |

LLM Top 10 は自律性リスクを LLM06 Excessive Agency に**畳んで**扱い、Agentic AI Top 10 はそれを**展開して**扱う。したがって片方だけでは本設計のリスク面を覆えない。本節は両方を 1 枚に統合する。

#### 6.5.1 形式の規約

- **各行は「本書の該当節」と「回帰を検出するテスト」を必ず引用する。** 引用が空の行を残さない — 引用のない対応表は主張のリストに退化し、実装との乖離を検出できない（§0.2 の検証方針・憲章 原則 8）
- 本リポジトリは実装前であり引用先のテストが未作成であるため、テスト列には**予定するテスト名とそれを納品するフェーズ**を書く。**各フェーズの受け入れ条件に「本表の当該行を実ファイル名へ置き換えること」を含める**（§11）
- 状態は 3 値とする: **Mitigated**（緩和済み・テストで固定）／**Planned**（緩和策は決定済み・納品フェーズが確定）／**Accepted**（緩和せず受容。受容理由を書く）
- **`--ignore-vuln` と同じ規律を適用する**: Accepted の行には理由と再評価トリガを書き、期限のない受容を残さない（§10.4 / X-12）

#### 6.5.2 OWASP LLM Top 10（2025）

| # | リスク | 状態 | 本書の該当節 | 回帰を検出するテスト（納品フェーズ） |
| :--- | :--- | :--- | :--- | :--- |
| LLM01 | Prompt Injection（間接注入を含む） | Planned | §6.3（信頼境界。`manage_system_prompt='server'` によるクライアント system メッセージの剥奪）／§6.3.1（権威ある履歴はサーバ側 `SessionStore`）／§5.3 | `test_trust_defaults_pinned.py`（P3）／`test_client_history_not_authoritative.py`（P3） |
| LLM02 | Sensitive Information Disclosure | Planned | §9.2（生プロンプト・生ツール I/O を `logger.*` に出さない）／§6.4.2 の監査マスキング | `test_audit_masking.py`（P4）／`test_no_raw_prompt_in_logs.py`（P1） |
| LLM03 | Supply Chain | Planned | §2.5（バージョン例外）／§10.4（`uv export --frozen --no-dev \| pip-audit -r /dev/stdin`、`uses:` の 40 桁 SHA ピン、`permissions:` 最小権限） | `test_ci_workflows.py`（**P0**、REQ-9.3）／`audit` CI ジョブ（**P0**、REQ-9.2） |
| LLM04 | Data and Model Poisoning | Planned | §7 の型パイプライン外の入力は §6.3 で剥奪。知識ベース取り込みは §11 P5 | `test_corpus_ingest_validation.py`（P5） |
| LLM05 | Improper Output Handling | Planned | §4.3（`output_validator` と自己修正）／§6.1 の構造化出力 | `test_output_validator_rejects.py`（P3） |
| LLM06 | Excessive Agency | Planned | §4.2.1（1 エージェント ≤ 20 ツール）／§6.1 のツール allow-list ／§6.4.3（承認範囲の較正） | `tool-count-check` CI ジョブ（P3）／§8.3-7 のガードレール E2E（P3） |
| LLM07 | System Prompt Leakage | Planned | §6.3（`manage_system_prompt='server'`）／§4.1（`instructions=` を使い `system_prompt=` を使わない。後者は `message_history` に残り HITL 再開を壊す） | `test_instructions_not_in_history.py`（P3） |
| LLM08 | Vector and Embedding Weaknesses | Planned | §11 P5（LlamaIndex 知覚層）。引用の接地は `output_validator` で強制し、dangling id は 502 | `test_citation_grounding.py`（P5） |
| LLM09 | Misinformation | Planned | §4.3（引用必須の構造化出力）／§10.3（Evals しきい値） | `evals` / `evals-gate` CI ジョブ（P6 / P7） |
| LLM10 | Unbounded Consumption | Planned | §6.1（`usage_limits`、`enforce_llm_rate_limit`）／§4.4.1（`sse_max_events`・`sse_send_timeout`・切断検知）／§6.4（停止・再開を跨ぐ `usage` 通算） | `test_rate_limiting_enforcement.py`（P3、§2.5-1 のカナリアと兼用）／`test_usage_carried_across_resume.py`（P4） |

#### 6.5.3 Agentic AI（自律性）側のリスク

**項目 ID について（憲章 原則 8）**: 横断検証（`docs/cross-repo-adoption-review.md` §0）が記録するとおり、当該セッションのネットワークポリシーでは OWASP GenAI の一次情報を取得できていない。したがって**本表は公式の項番を騙らず、兄弟リポジトリの既存表が実際に使っている risk 名称を採る**。一次情報に到達でき次第、公式の項目 ID を各行へ付し、その差分を改訂履歴に記録すること（`pydantic-ai-sandbox/patterns/SECURITY-NOTES.md` §OWASP マッピングが対応する記述の出所）。

| リスク | 状態 | 本設計での位置づけ | 本書の該当節 | 回帰を検出するテスト（納品フェーズ） |
| :--- | :--- | :--- | :--- | :--- |
| 過剰なエージェンシー / Insecure Tool Use | Planned | ツール allow-list 外の呼び出しは実行せず `stop_reason="disallowed_tool"` でループ停止し、`AuditTrail` に残す | §6.1 / §6.1.1 / §9.2.2 | §8.3-7 のガードレール E2E（P3） |
| Unbounded Consumption（無制限消費） | Planned | `UsageLimits` ＋ `max_iterations` の二重上界。停止理由は `budget_exceeded` / `max_iterations` | §6.1 / §6.4 / §9.2.2 | `test_usage_carried_across_resume.py`（P4）／SSE 上限のユニット（P3） |
| Human-in-the-loop bypass | Planned | 承認応答の**サイレント握り潰し**（R3）に対する §6.4.1 の 3 層防御。第一防御はサーバ側 fail-loud（422） | §6.4.1 / §12 R3 | `test_find_dropped_approvals.py` の 2 分岐（P4）／HITL 異常系 E2E（§8.3-6、P4） |
| 承認要否のクライアント制御化 | Mitigated（規約として） | クライアント提出構造体に承認要否フラグを載せる方式を明示的に禁止。述語はコミット済みコード側（`requiresApprovalForKind`） | §6.4.3 | `test_approval_predicate_server_side.py`（P4） |
| 承認疲れ（approval fatigue）による形骸化 | Planned | 承認対象を取り消し不能・実世界副作用のある操作に限定し、それ以外は監査による事後追跡へ委ねる | §6.4.3 / §12 R13 | P4 の受け入れ条件に含むレビュー（機械検証ではない） |
| Repudiation / Untraceability（監査証跡の欠落） | Planned | 実行 / 拒否 / 否認の全試行を記録し、監査証跡が silent empty にならないことを保証する | §9.1 / §9.2.2 | `test_audit_trail_not_empty.py`（P3） |
| 信頼できない履歴の注入 | Planned | クライアント提出履歴は承認応答の抽出にのみ使い、権威としない。CVE-2026-25580 / 46678 の経路 | §6.3 / §6.3.1 | `test_client_history_not_authoritative.py`（P3）／`test_trust_defaults_pinned.py`（P3） |
| 多エージェントの集団的失敗（low-variance） | Accepted（P8 まで非該当） | §5.1 の判断フローを通過した領域のみ多エージェント化する。通過する領域が無ければ単一エージェントのまま完成とする。**再評価トリガ: P8 に着手する決定がなされた時点** | §5.1 / §5.3 | P8 着手時に §5.3 の防御 4 点をテスト化 |

#### 6.5.4 この表の維持

- 本表は §7 の型パイプラインの外にある（散文である）。したがって**ドリフト検知の対象にする**: 引用したテストファイルが存在しなくなったときに落ちるテストを P3 で導入する。移植元は `pydantic-ai-sandbox/patterns/contracts/tests/unit/test_contract_drift.py`（doc → code 方向の AST 照合、X-11）
- 行を「Accepted」に落とす変更は、`--ignore-vuln` の追加と同格に扱う。理由・再評価トリガ・追跡参照を同時にコミットする（§10.4）

---

## 7. 型安全性パイプライン

### 7.1 型の流れ

```
packages/py-schemas (Pydantic モデル)   ← 単一真実源（SSOT）
        │
        ├─ model_json_schema() ──→ JSON Schema
        │                              │
        │                    json-schema-to-typescript
        │                              ↓
        │                    packages/api-types/generated/*.d.ts
        │
        └─ FastAPI /openapi.json ──→ openapi-typescript
                                       ↓
                             packages/api-types/generated/api.d.ts
```

### 7.2 ツール選定と根拠

| ツール                      | 用途                                                                  | 採否                                                                                     |
| :-------------------------- | :-------------------------------------------------------------------- | :--------------------------------------------------------------------------------------- |
| `openapi-typescript`        | FastAPI の OpenAPI 出力から REST 契約全体の型を生成                   | **採用**（API 境界の第一手段）。既存 `vaz-ai-next` が `^7.13.0` を使用中                 |
| `json-schema-to-typescript` | 個別 Pydantic モデル → TS 型。HTTP エンドポイントに紐づかない型に有効 | **採用**（補完的）                                                                       |
| `datamodel-code-generator`  | **逆方向**（OpenAPI / JSON Schema → Pydantic モデル）が本来の用途     | **Pydantic→TS の手段としては不採用**。外部スキーマの取り込みとドリフト検出に限定して使用 |

> `datamodel-code-generator` を「Pydantic → TypeScript」の主手段として挙げるのは誤りである。同ツールの公式説明は「OpenAPI 3、AsyncAPI、JSON Schema 等を Python モデルへ変換する」であり、方向が逆である。

### 7.3 既存パイプラインとの関係

**§7 は新規構築ではない。** `vaz-ai-next` に稼働中のパイプラインがある。

```bash
mise run openapi:gen
# services/agent の live FastAPI app から app.openapi() を取り出し
#   → packages/schemas/src/generated/openapi.snapshot.json
#   → openapi-typescript
#   → packages/schemas/src/generated/agent-service.ts
```

さらに手書きの Zod ラッパ `packages/schemas/src/agent-service.ts` が `satisfies z.ZodType<Generated>` で生成型に適合し、`packages/schemas/tests/contract-drift.spec.ts` がドリフトを検出する。

**生成物の置き場を 2 つに分ける**:

| 生成元                                     | 置き場                                            | 消費者                                    |
| :----------------------------------------- | :------------------------------------------------ | :---------------------------------------- |
| `services/agent`（ステートレスサイドカー） | `packages/schemas/src/generated/`（**現状維持**） | TS 側の `packages/rag` / `packages/evals` |
| `apps/agent-api`（エージェント API）       | `packages/api-types/generated/`（**新設**）       | `apps/web` の BFF                         |

**同じディレクトリに混ぜてはならない。** 2 つの FastAPI アプリの OpenAPI が衝突し、どちらの変更でドリフトが出たか判別できなくなる。

**`satisfies` の盲点**（既存 `AGENTS.md` に記録済み・必ず引き継ぐ）:

> `satisfies z.ZodType<Generated>` は**欠落フィールドと型違いは捕まえるが、余分なフィールド（excess）は捕まえない**。excess を捕まえるのは JSON-Schema の形状比較の脚である。境界スキーマを追加するときは**必ず両方の脚を残す**こと。

### 7.4 `/v1/chat` は型パイプラインの対象外である

**重要な非対称**: `/v1/chat` は `Request` を直接受け `StreamingResponse` を返すため、**OpenAPI スキーマに現れない**。§7 のパイプラインが守るのは `/v1/agent/chat`・`/v1/rag/*`・`/health*` の方である。

§1.2 の図で「正式契約」と位置づけた `/v1/chat` が、型の SSOT の外側にあることになる。これは Vercel AI Data Stream Protocol を採用した必然的な帰結であり、次の別ルートで担保する。

| 側           | 担保                                                                                                                                     |
| :----------- | :--------------------------------------------------------------------------------------------------------------------------------------- |
| サーバ       | `VercelAIAdapter` が `RequestData` / `UIMessage` / `*Part` を Pydantic モデルとして検証（`build_run_input(body: bytes) -> RequestData`） |
| クライアント | `ai@7` の `UIMessage` 型と `useChat` のジェネリクス                                                                                      |
| 境界         | プロトコルのバージョン（`sdk_version=7` ↔ `ai@7.0.x`）を**両側で 1 か所ずつ定数化**し、CI でその 2 つの一致をアサートする                |

§10.2 の `codegen-check` はこの経路をカバーしない。**§8.3 の E2E がこの契約の唯一の回帰検出手段である。** この点を理由に、§11 では P3 の受け入れ条件に E2E を含めている（§12 R10）。

### 7.5 CI での強制

`packages/api-types/generated/` と `packages/schemas/src/generated/` は**`.gitignore` せずコミットする**。理由は、生成物の差分が API 契約変更のレビュー対象になるためである。

CI ゲート:

```bash
turbo run codegen
git diff --exit-code packages/api-types/generated/ packages/schemas/src/generated/
# 差分があれば失敗 = 生成物のコミット漏れ
```

### 7.6 スキーマドリフトの検出

外部スキーマから `datamodel-code-generator` で生成した Pydantic モデルは、生成時点のスナップショットである。上流が変化した場合、実行時に `ValidationError` として表面化する。この `ValidationError` を Logfire に記録し、スキーマドリフトの検出シグナルとして扱う（§9.3）。

---

## 8. テスト戦略

### 8.1 各層が保証するもの・しないもの

| 層          | ツール                   | 保証すること                                                                                    | **保証しないこと**       | 外部 LLM                          |
| :---------- | :----------------------- | :---------------------------------------------------------------------------------------------- | :----------------------- | :-------------------------------- |
| Unit        | Pytest / Vitest          | ツール関数のロジック、Pydantic/Zod の検証規則、DI の正当性、§6.4.1 の握り潰し検出               | 推論の質、プロトコル適合 | なし（モック + ネットワーク遮断） |
| Integration | Pytest + `FunctionModel` | 複数コンポーネントの結合、実ストア                                                              | 実モデルの挙動           | なし（`FunctionModel`）           |
| E2E         | Playwright               | SSE プロトコル適合、HITL の UI 状態遷移、フロント↔バック結合、**§7.4 の型パイプライン非対象部** | 回答内容の妥当性         | なし（テスト用モデル）            |
| Evals       | pydantic-evals           | 推論結果の妥当性、要求達成度、事実適合性、遅延・コスト                                          | 決定論的な合否           | あり                              |

### 8.2 Unit 層

```python
import pytest
from pydantic_ai import models, capture_run_messages
from pydantic_ai.models.test import TestModel

from packages.py_agents import chat_agent

models.ALLOW_MODEL_REQUESTS = False   # 実 LLM 呼び出しをグローバルに禁止


@pytest.fixture
def override_agent():
    # call_tools で対象を絞る（§8.2.1）。native_tools=[] はネイティブツール利用時のみ。
    with chat_agent.override(
        model=TestModel(call_tools=["search_knowledge_base"]),
        native_tools=[],
    ):
        yield


async def test_agent_output_contract(override_agent, fake_deps):
    with capture_run_messages() as messages:
        result = await chat_agent.run("テスト", deps=fake_deps)
    assert isinstance(result.output, AnswerWithCitations)
    assert any(m for m in messages if ...)   # 交換メッセージ列を検証
```

**規約**:

- `models.ALLOW_MODEL_REQUESTS = False` を conftest でグローバル設定する。テストからの実 API 呼び出しを機構的に不可能にする
- **加えてソケットレベルでネットワークを遮断する**。`fastapi-pydantic-ai-agent` は `tests/support/hermetic.py::block_network()` を autouse fixture で `tests/unit/` 全体に適用し、`AF_INET` / `AF_INET6` の `socket.connect` を `NetworkBlockedError` にする。モック漏れが即座に落ちる。**`connect` だけでなく `connect_ex` と `socket.getaddrinfo` も塞ぐこと**（X-2）— `connect` のみでは DNS 解決が素通りする。上位互換の実装は `pydantic-ai-sandbox/patterns/deep-research/tests/unit/conftest.py`（L48-49）にある。あわせて**遮断が空振りでないことを証明する専用テスト**を置く（REQ-7.4 が検証手段として指定しているもの）
- `TestModel` はデフォルトで全ツールを呼び、戻り型に応じてプレーン／構造化応答を返す。API キー不要・レイテンシ 0・トークン消費 0
- 条件分岐や再試行エッジケースの検証には `FunctionModel` を使い、入力メッセージを検査してカスタム応答を返す
- ネイティブツール利用時は `chat_agent.override(model=TestModel(), native_tools=[])` で明示的に無効化する。`TestModel` はプロバイダ実行のネイティブツールをエミュレートできない（`native_tools` は `Agent.override` の実パラメータとして 2.33.0 で確認済み）

#### 8.2.1 `TestModel` の既定挙動が HITL でアサートを壊す

`TestModel` は**既定で全ツールを呼ぶ**。§6.4 により `requires_approval=True` のツールが 1 つでもあると、`result.output` は `AnswerWithCitations` ではなく **`DeferredToolRequests`** になり、`isinstance` アサートが落ちる。

**規約**:

- 承認必須ツールを持つエージェントのテストでは `TestModel(call_tools=[...])` で対象を絞る
- `output_type` が union のテストでは、期待する分岐を明示的にアサートする（`is not None` は union のどちらでも通るので検証にならない）

#### 8.2.2 `FunctionModel` で最終応答を返すときの落とし穴

`output_type` が構造化出力（テキストを許容しない）の場合、`FunctionModel` の最終応答を `ModelResponse(parts=[TextPart(...)])` にすると、フレームワークは「Please call a tool.」のリトライを繰り返し、出力リトライを使い切って `UnexpectedModelBehavior: Exceeded maximum output retries` で落ちる。

最終応答は**出力ツール呼び出し**にする。

```python
def call_model(messages: list[ModelMessage], info: AgentInfo) -> ModelResponse:
    if len(messages) == 1:
        return ModelResponse(parts=[ToolCallPart("search_knowledge_base", {"query": "..."})])
    return ModelResponse(parts=[ToolCallPart("final_result", GOOD_OUTPUT)])
```

### 8.3 E2E 層

Playwright で実ブラウザを操作し、DOM アサーション（`expect(locator).toContainText()` の自動リトライ）とレスポンス傍受を併用する。

```typescript
page.on('response', async (response) => {
  if (response.url().includes('/api/chat')) {
    const body = await response.text()
    // data: {"type":"tool-input-available",...} 等のチャンクを検証
  }
})
```

**必須テストケース**:

1. テキストの逐次描画（`text-start` / `text-delta` / `text-end`）
2. ツール実行中の UI 表示（`tool-input-available` → 結果）
3. エラー発生時のトースト表示
4. **HITL 承認フロー**: 承認要求の表示（`approval-requested`）→ 承認 → ツール実行 → 完了
5. **HITL 拒否フロー**: 拒否 → ツール未実行 → 適切なメッセージ
6. **HITL 異常系（§6.4.1）**: 不正な `approval-responded` を送った場合に **422 が返り**、UI にエラーが出ること
7. **ガードレール**: allow-list 外のツールを呼ばせたときに `disallowed_tool` として停止し、`AuditTrail` に記録が残ること。§6.1.1 のガードレール接続に対する回帰検出

**既知の落とし穴**: EventSource（SSE）接続は Playwright で捕捉しにくい場合があり、`page.route()` が EventSource リクエストをインターセプトしない事例が報告されている。**SSE 検証はモック傍受ではなく、実サーバに対する統合 E2E として組む**。

### 8.4 Evals 層

```python
from pydantic_evals import Case, Dataset
from pydantic_evals.evaluators import IsInstance, LLMJudge, MaxDuration

dataset = Dataset(
    cases=[
        Case(
            name="citation_required",
            inputs="社内の休暇取得ルールを教えて",
            expected_output=None,
            metadata={"category": "hr", "requires_citation": True},
        ),
    ],
    evaluators=[
        IsInstance(type_name="AnswerWithCitations"),   # 高速チェックを先に
        MaxDuration(seconds=30),
        LLMJudge(
            rubric="回答が事実として正確で、引用が回答内容を実際に支持している",
            include_input=True,
        ),                                             # 高コストは最後
    ],
)
report = dataset.evaluate_sync(run_agent)
report.print()
```

> 上記 API は `pydantic-evals 2.33.0` ですべて実在を確認済み。`Case` のフィールドは `name / inputs / metadata / expected_output / evaluators`、`IsInstance(type_name, evaluation_name)`、`MaxDuration(seconds)`、`LLMJudge(rubric, model, include_input, include_expected_output, model_settings, score, assertion)`、`Dataset.evaluate(task, *, name, max_concurrency, progress, retry_task, retry_evaluators, task_name, metadata, repeat, lifecycle)`、`evaluate_sync`、`report.print()`。

**規約**:

- 評価器は**安価な決定論的チェックを先に、高コストな `LLMJudge` を最後に**並べる（fail fast）
- データセットは YAML で管理する（`dataset.to_file()` はスキーマファイル `*_schema.json` も同時生成し、`Dataset.from_file()` で読み込める）
- カスタム評価器は `@dataclass` + `evaluate(self, ctx: EvaluatorContext)` で実装する
- `evaluate()` の `max_concurrency` / `repeat` / `retry_task` を用途に応じて設定する
- 判定モデルは**評価対象と別に注入する**（自己評価バイアスの回避）。既存 `packages/evals`（TS）の `judge.ts` が同じ原則を採る
- CI ではしきい値未達で失敗させるアサートを `EvaluationReport` に対して行う（§10.3）

---

## 9. Observability

### 9.1 計装

```python
import logfire

logfire.configure(service_name=settings.logfire_service_name)
logfire.instrument_pydantic_ai()      # 全 Agent を計装（Agent(instrument=True) は存在しない）
logfire.instrument_fastapi(app)
```

**規約**:

- 計装は**プロセス起動時に一括**で行う。`Agent` のコンストラクタ引数では行わない（§4.1.1）
- 個別制御が必要な場合のみ `Agent.instrument_all(settings)` または `capabilities=[Instrumentation(...)]` を使う
- **初期化は fail-soft**。観測性の失敗が起動を止めてはならない。既存実装は例外を捕捉してログに落とすだけにしている
- 標準ライブラリのロギングは別系統として**先に**設定する。既存実装は `configure_logging()` を `_startup` の先頭（何かがログを出す前）で呼び、`JSONFormatter` + `RequestIDFilter` を入れることで、呼び出し側が request id を手で入れなくても相関が付くようにしている

Pydantic Logfire は OpenTelemetry ベースであり、**ベンダーロックインはない**。任意の OTLP 準拠エンドポイントへ送信でき、逆に任意の OTel 計装アプリから Logfire へ取り込むこともできる。ローカル開発では `logfire.configure(send_to_logfire=False)` + `OTEL_EXPORTER_OTLP_ENDPOINT` で Jaeger / otel-tui 等に送る。

> **接続時の注意**: Logfire の OTLP 受信は HTTP である。gRPC を既定とする OTel SDK は `http/protobuf` へ切り替える必要がある。

### 9.2 取得する情報

Pydantic AI は agent run にトレースを、model request と tool call ごとに span を生成し、GenAI semantic conventions（`gen_ai.input.messages`、`gen_ai.output.messages`、`gen_ai.system_instructions`、`gen_ai.usage.input_tokens` 等）を自動検出する。

要求される可視化は以下の 3 点であり、上記の span ツリーで満たされる。

1. **どのコンテキストを参照したか**: システムプロンプトの動的生成結果、`deps` 経由で渡された権限・状態、LlamaIndex から取得した検索コンテキスト
2. **なぜそのツールを選択したか**: 思考ログ、ツールに渡された引数、実行結果と応答時間
3. **何回ループを試行したか**: `ModelRetry` の発動回数、試行ごとのトークン消費とレイテンシ

#### 9.2.1 instrumentation のバージョンと属性名

instrumentation にはバージョンがあり、v2 で新 GenAI spec 採用、v3 で thinking tokens、v4 でマルチモーダル、v5 で deferred tool call（`CallDeferred` / `ApprovalRequired`）を制御フローとして扱い span status を ERROR ではなく UNSET にする。

**v5 は既に既定である**（`DEFAULT_INSTRUMENTATION_VERSION = 5`、`InstrumentationSettings(version=5)`）。したがって承認待ちがエラーとして計上される問題は、既定のままで起きない。

**代わりに注意が必要なのは属性名のリネームである。**

```python
InstrumentationSettings(..., use_aggregated_usage_attribute_names=True)   # ← 既定が True
```

これが有効だと、**agent-run スパンの累計トークン属性が `gen_ai.usage.*` ではなく `gen_ai.aggregated_usage.*` に出る**（ネストした per-request `chat` スパンは従来どおり `gen_ai.usage.*`）。データ形式もバージョン 2 から 5 へ移動している。

- **アプリケーションコードには 1 行も変更が要らないため、grep では発見できない**
- ダッシュボード・アラート・クエリを組む前に、どちらの属性名を使うかを確定させる（§11 P1 の受け入れ条件）
- `vaz-ai-next` は同じ問題を `docs/pydantic-ai-v2-behaviour-notes.md` に記録済み。monorepo 統合時にこのドキュメントを `docs/` へ引き継ぐ

コストは `genai-prices`（オープンな価格データセット）から算出される。

#### 9.2.2 停止理由（stop reason）語彙の写像 — X-5

**本リポジトリは 2 つの語彙を同居させる。** REQ-0.2 は `vaz-ai-next@cf72583` の `packages/` を**そのまま**取り込むため、T-0 完了時点で TS 側の語彙がリポジトリに入る。一方 `apps/agent-api` は Python 側の語彙を持つ。統合ではなく併存が既定の状態であり、写像を明示しない限り監査ログの読み手が 2 系統を突き合わせられない。

| 実装 | 語彙 | 由来 |
| :--- | :--- | :--- |
| `apps/agent-api`（`fastapi-pydantic-ai-agent/app/agents/guardrails.py:40` 由来）<br>`pydantic-ai-sandbox/patterns/contracts` の `autonomous_agent.py` も**独立に同じ 5 値へ到達**している | `completed` / `max_iterations` / `budget_exceeded` / `denied` / `disallowed_tool` | **ガードレール由来**。どのゲートが止めたかを記録し、拒否理由を含む |
| `packages/schemas/src/run-metrics.ts:16`（`vaz-ai-next` 由来、T-0 で取り込む） | `natural` / `step-cap` / `budget-exceeded` / `error` | **ループ由来**。拒否は承認ポリシー側の別経路で扱われ、この語彙には現れない |

**写像表**:

| Python 5 値 | TS 4 値 | 備考 |
| :--- | :--- | :--- |
| `completed` | `natural` | 一致 |
| `max_iterations` | `step-cap` | 一致（名前のみ相違） |
| `budget_exceeded` | `budget-exceeded` | 一致（区切り文字のみ相違） |
| `denied` | — | TS 側に対応なし。承認拒否は `ApprovalDeniedError` 経路を通る |
| `disallowed_tool` | — | TS 側に対応なし。allow-list 違反は例外経路を通る |
| — | `error` | Python 側に対応なし。例外は `StopReason` に載らない（§6.3.1 の「停止した run は履歴を保存しない」規約は 5 値側を前提にしている） |

**監査粒度の非対称（本節の要点）**: 5 値側は「なぜ止まったか」が**監査ログ単独で完結する**。4 値側は `error` の内訳を別経路（例外ログ・承認ポリシー）と突き合わせないと分からない。両方を並記する本リポジトリでは、**同じ 1 本の run について監査の解像度が言語境界で変わる**。これは §9.2.1 の属性名（`gen_ai.usage.*` か `gen_ai.aggregated_usage.*` か）の決定より**前に**決めておく必要がある — ダッシュボードの停止理由ディメンションをどちらの語彙で持つかが、属性設計とクエリの形を決めるためである。

**本版で統一しない理由**: TS 側の 4 値は既に SSE 契約（`JobEvent`）と `audit_log` テーブルに出ており、語彙変更は後方互換の設計判断を伴う。**本版は写像表の固定までとし、統一の可否は独立した ADR で判断する**（§12 R15）。

**P1 の受け入れ条件に含めること**: (a) 上表の写像を ADR に記録する、(b) ダッシュボードが停止理由をどちらの語彙で持つかを決める、(c) `denied` / `disallowed_tool` / `error` の非対称 3 値について、突き合わせ先（例外ログか承認ポリシーか）を明記する。


### 9.3 データフライホイール（Observability-Driven Development）

`EvaluatorContext` は入力・出力・メタデータに加え telemetry data を保持する。これを利用し、以下のループを確立する。

```
本番トレース（Logfire）
   └─ 失敗・異常なスパンを抽出
        └─ 入出力パラメータを pydantic-evals の Case に変換
             └─ packages/py-evals/datasets/*.yaml へ追加
                  └─ CI の回帰テストスイートに組み込まれる
```

**運用規約**: 本番で観測された不具合は、修正 PR に**必ず対応する評価ケースの追加を含める**。これをレビューの受け入れ条件とする。

**プライバシー契約**: `logger.info/warn/error` に**生のユーザープロンプトや生のツール入出力を載せない**。載せてよいのは非機微な識別子（`messageId`、`jobId` 等）のみである。ツール引数の記録先は監査ログ（`AuditTrail` / `AuditSink`）に限定する。Logfire 側は `configure_logfire()` が `prompt` / `tool_input` / `tool_output` を既定でスクラブし、`log_sensitive_payloads=True` にした場合は `AUDIT:` 警告を出す。**この二重化を維持する。**

### 9.4 代替バックエンドの比較

| ツール               | OTLP 取り込み                                    | ライセンス                                                                     | セルフホスト       | Pydantic AI 統合          |
| :------------------- | :----------------------------------------------- | :----------------------------------------------------------------------------- | :----------------- | :------------------------ |
| **Pydantic Logfire** | 双方向（HTTP）                                   | SDK は MIT                                                                     | Enterprise 層      | **組み込みネイティブ**    |
| Arize Phoenix        | gRPC + HTTP（OpenInference）                     | サーバは Elastic License 2.0（source-available・非 OSI）、eval 等は Apache-2.0 | 無料・機能制限なし | 専用 instrumentation あり |
| Langfuse             | HTTP のみ（**gRPC 未対応**）                     | コア MIT                                                                       | 第一級             | ネイティブ統合あり        |
| OpenLLMetry          | 計装ライブラリ（任意の OTLP バックエンドへ出力） | Apache 2.0                                                                     | ライブラリ         | 汎用 OTLP 経由            |

**本設計の選択**: Pydantic AI との統合が組み込みで摩擦が最小の **Logfire** を採用する。完全な OSS とセルフホストが要件になった場合は **Langfuse（MIT）** へ切り替える（OTLP 経由のため計装コードの変更は不要）。**OpenLLMetry はバックエンドではなく計装ライブラリ**であり、Pydantic AI が既にネイティブ GenAI span を出す本構成では必須ではない。

---

## 10. CI / 品質ゲート / サプライチェーン

### 10.1 git フック

`pnpm install` で `.githooks/` が `core.hooksPath` 経由で有効化される。**フックの負荷配分は「pre-commit は速いものだけ、重いものは pre-push と CI」**とする。

**pre-commit（速いものだけ）**:

1. `biome check`（TS）+ `ruff check` / `ruff format --check`（Python）
2. `tsc --noEmit`（TS）+ `ty check`（Python 型チェック）
3. `vitest run`（TS — 既存 `vaz-ai-next` の pre-commit は実際にこれを含んでいる）
4. `gitleaks` による秘密情報スキャン
5. モデル ID ハードコード検出（pygrep / `forbid-model-ids.sh`）
6. ツール生成ファイル（`apps/web/AGENTS.md` 等、§3.6）が未コミットで残っていないことの確認

**pre-commit の manual ステージ（明示実行時のみ）**:

- `pytest tests/unit`（Python）
- `pip-audit` / `pnpm audit`

**pre-push**:

- Playwright E2E
- **可用性ゲート付きの live テスト**。`${OLLAMA_BASE_URL}/api/tags` を probe し、到達可能なときだけ `AI_PROVIDER=ollama` の実 LLM ラウンドトリップと evals を走らせる。到達しないときは警告して push を通す。**期待テスト数を `EXPECT_LIVE_TESTS` で固定する**（レーンが黙って 0 件収集して緑になるのを防ぐ）

緊急時は `--no-verify` で回避可能とするが、CI 側で同等のチェックを必ず再実行する。

### 10.2 CI パイプライン

| ジョブ                | 内容                                                                                   | ブロッキング                                     |
| :-------------------- | :------------------------------------------------------------------------------------- | :----------------------------------------------- |
| `lint`                | Biome + ruff + tsc + ty                                                                | ✅                                               |
| `codegen-check`       | `turbo run codegen` 後に `git diff --exit-code`（2 つの generated ディレクトリ、§7.5） | ✅                                               |
| `test:unit`           | `vitest run --coverage` + `pytest tests/unit`                                          | ✅                                               |
| `test:integration`    | `pytest tests/integration`（`FunctionModel`）                                          | ✅                                               |
| `test:e2e`            | Playwright（公式コンテナイメージ）                                                     | ✅                                               |
| `test:redis`          | `pytest -m redis`（`redis:7-alpine` サービスコンテナ + `EXPECT_LIVE_TESTS`）           | ✅                                               |
| `tool-count-check`    | 1 エージェントあたりツール数 ≤ 20 を検証（§4.2.1）                                     | ✅                                               |
| `turbo-version-check` | `turbo --version` が `mise.toml` のピンと一致（§3.5）                                  | ✅                                               |
| `audit`               | `pnpm audit --audit-level=moderate` + `pip-audit` + `--frozen-lockfile`                | ✅                                               |
| `evals`               | pydantic-evals + TS evals を nightly バッチ実行                                        | ⚠️ しきい値未達で警告、main への直接反映はしない |
| `evals-gate`          | PR がプロンプト／エージェント定義に触れた場合のみ実行                                  | ✅ しきい値未達でマージブロック                  |

**現状との差分（`vaz-ai-next@bbf1156` 実測）**: 上表のうち実在するのは `lint` / `test:unit`（`tests.yml` の `unit`）/ `audit` の 3 つだけである。`codegen-check` / `test:integration` / `test:e2e` / `test:redis` / `tool-count-check` / `turbo-version-check` は**いずれも未実装**であり、monorepo 化に伴う新規作業として計上する。

特に `test:e2e` は注意を要する。`vaz-ai-next` の Playwright E2E は pre-push フックのみに存在し、`tests.yml` は「ホストランナーでローカル LLM を動かせない」ことを理由に E2E ジョブを意図的に置いていない（`tests.yml` の該当コメント）。`.githooks/pre-push` 自身が「`--no-verify` は E2E を丸ごと飛ばし、その背後に CI のセーフティネットはない」と述べている。この状態は §12 R10（`/v1/chat` の回帰検出を §8.3 の E2E に依存させ、P3 の受け入れ条件から外さない）の前提と両立しない。**P3 到達前に、Ollama 非依存の E2E を CI レーンとして新設すること。**

**CI に含めないもの**: 実 LLM を叩くテスト、Ollama 依存テスト、Hugging Face のモデルをダウンロードする `chroma` マーカーのテスト。これらは env ゲート + `EXPECT_LIVE_TESTS` で別レーンにする。

**すべての `uses:` は 40 桁の完全な SHA でピンする**。あわせて**各ワークフローに最小権限の `permissions:` を宣言する**（SHA ピンの目的は未審査コードの実行を防ぐことだが、実行された場合の影響半径を決めるのは `permissions:` である。両者は対で意味を持つ）。

> **注意 — この機械検証は monorepo の母体には存在しない。** `test_ci_workflows.py` は `fastapi-pydantic-ai-agent` の資産であり、`vaz-ai-next@bbf1156` には同等のテストがない（`find . -name '*ci_workflow*'` でヒット 0）。同リポジトリの 6 ワークフローは全 21 箇所が可変メジャータグ（`@v7` / `@v6` / `@v4`）でピンされ、`permissions:` ブロックはどのワークフローにも存在しない。したがってこれは「維持」ではなく、**SHA へのピン付け替え・`permissions:` 宣言・検証テストの移植という新規作業**である。P0 着手前に完了させること。

### 10.3 Evals のしきい値運用

**新規構築ではない。** `vaz-ai-next` には既に稼働している機構がある。

| 既存資産                             | 内容                                                                                                                                                                                                     |
| :----------------------------------- | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.github/workflows/eval-pr.yml`      | `run-eval` ラベルで opt-in（全 PR で実モデルを叩かないコスト設計）。`ANTHROPIC_API_KEY` 未設定時は skip（fork PR 対策）。**前回の `PrGateRunSample` を GitHub Actions cache に保持**して baseline とする |
| `.github/workflows/eval-nightly.yml` | nightly バッチ                                                                                                                                                                                           |
| `packages/evals`                     | tier1（`src/unit/`、決定論）／tier2／tier3（`judge.ts`、LLM judge）／`pr-gate.ts`                                                                                                                        |

したがって本節の規定は「**この baseline 機構の上に載せる運用ルール**」である。

- **初期**: 基準値を計測して記録するのみ（ブロックしない）
- **2 週間後**: 記録された基準値の 95% をしきい値として `evals-gate` を有効化
- **しきい値の引き下げは PR で明示的に行う**。テストを通すために暗黙に下げることを禁ずる
- `packages/py-evals`（pydantic-evals）は同じ baseline 保存形式に合流させる。**別系統の baseline を新設しない**（原則 5）

### 10.4 サプライチェーン

`vaz-ai-next` の方針を全面採用する。

- `minimumReleaseAge: 1440` — 公開から 24 時間未満のバージョンを解決しない（不正バージョン公開直後の最危険期間を回避）。`pnpm audit`（既知 CVE 照合）だけでは防げない攻撃を補完する
- `allowBuilds` — 依存の install スクリプトはデフォルトでブロックし、許可の判断をすべて**監査理由付きのコメントとともに**明示記録する。`false` は「未審査」ではなく「審査して拒否した」の意味
- pnpm / Node / Python / uv / turbo のバージョンを `mise.toml` で固定
- CI で `--frozen-lockfile` を強制
- **ロック更新の差分にダウングレードがないかを必ず確認する**（§2.6.5）。`uv.lock` / `pnpm-lock.yaml` の差分で「バージョンが下がっている行」は赤信号である。ロック更新 PR には、更新後のロックに対する `pip-audit` / `pnpm audit` の**出力そのもの**を貼る（「監査は通った」という要約では §2.6 の失敗様式を見逃す）
- **バージョン制約には 2 種類あることを区別する**。「新しすぎる版を選ばせない」ピン（§2.5-1〜4）と、「古い脆弱版へ後退させない」ための対処（§2.5-5 の `openai` extra 省略）は、撤去条件も監視対象も異なる。後者は上流（litellm）が制約を解消した時点で外す
- **advisory 駆動の `audit` 失敗にはランブックを用意する**。検出 → トリアージ → 4 段階の対応 → 検証 → override / `ignoreGhsas` の退役追跡。「修正版が存在しない advisory で nightly が赤くなる」ケースは実際に起きており（両参照リポジトリで発生）、期限コメント付きの一時抑止 + issue 化が定石である。既存 `docs/dependency-policy.md` / `docs/dependency-runbook.md` を統合して引き継ぐ
- **Dependabot の `ignore:` リストは §2.5 のピンと対で維持する**。特に `fastapi` は 0.x のため Dependabot が `0.136 → 0.137` を**マイナー**と分類する。**メジャーだけを ignore してもレート制限を壊すバンプが通る**ので、マイナーとメジャーの両方を ignore する

---

## 11. 段階的実装ロードマップ

各フェーズは前フェーズの受け入れ条件を満たしてから着手する。

| Phase  | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | 受け入れ条件                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| :----- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P0** | Monorepo 骨格。`mise.toml` / `turbo.json` / ルート `pyproject.toml` / `pnpm-workspace.yaml`。`fastapi-pydantic-ai-agent` を `apps/agent-api` として移植（動作は現状維持）。§3.3 の命名規約を確定。§2.6.3 の二層バージョン方針（`openai` extra 省略）を lock に反映                                                                                                                                                                                                                                                                                                                                           | **前提: uv workspace のメンバー構成（`apps/agent-api` / `services/agent` を含めるか）と Turborepo の採否が ADR で決定済みであること（§12 R14 / R2）。単一 workspace は lock を 1 つに束ねるため、下記「双方の lock」は両者を同一 workspace に入れたままでは充足できない。** そのうえで `turbo run lint test` が両言語で通る（Turborepo を採らない場合は同等の `mise` タスク）。`turbo-version-check` が緑。**`apps/agent-api` の lock が `openai` extra なしで slim 2.35.x / litellm 1.98.0 に解決し、`services/agent` の lock が slim 2.33.x に解決すること**を確認し、双方の `pip-audit` 出力を PR に貼る |
| **P1** | Logfire 計装の確認と `gen_ai.aggregated_usage.*` の方針確定（§9.2.1）。`docs/pydantic-ai-v2-behaviour-notes.md` の引き継ぎ                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | 既存の unit / integration が全通過。Logfire に agent-run / model-request / tool-call の span ツリーが出る。使用する属性名が ADR に記録されている。**あわせて §9.2.2 の停止理由語彙の写像（Python 5 値 / TS 4 値）を ADR に記録し、ダッシュボードがどちらの語彙で停止理由ディメンションを持つかを決める（X-5）** — 監査粒度の非対称は属性名の決定より前に確定させる                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **P2** | 型生成パイプラインの monorepo 展開（§7.3 の 2 ディレクトリ分離）と `codegen-check` ゲートの導入                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                              | 生成物の差分が CI で検出される。両ディレクトリが混ざらない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **P3** | `/v1/chat` の新設（`from_request` / `run_stream` / `encode_stream` 分解、§4.4.1）。§6.1.1 の必須依存性をすべて接続。フロント `useChat` 接続。**HITL は含めない**                                                                                                                                                                                                                                                                                                                                                                                                                                             | **前提: Ollama 非依存の E2E が CI レーンとして稼働していること（§10.2 / §12 R10、X-14）** — pre-push フックだけの E2E は `--no-verify` で素通りするため、受け入れ判定の根拠にしない。そのうえでテキストストリーミングの E2E が通る。**ガードレール E2E（§8.3-7）が通る**。`/v1/chat` が無認証で叩けないことをテストで確認。**U+2028 / U+2029 を含む応答が 1 つの SSE イベントとして復元されることの回帰テストが通る（§4.4.1、X-10）**。§6.5 の対応表のうち P3 納品分の行が、予定テスト名から実ファイル名へ置き換わっている                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| **P4** | HITL 実装。`patterns/hitl` の移植 + `requires_approval` / `DeferredToolRequests` / `addToolApprovalResponse` + §6.4.1 の 3 層防御。**TS 側も未接続であることに注意** — `vaz-ai-next` の承認ポリシーは配線済み（`packages/agents/src/chat-agent.ts` の `toolApproval`）だが、`needsApproval` を宣言する唯一のツール `createEmailCapability` はどのエージェントにも登録されておらず（production 参照 0 件）、`Chat.tsx` に `addToolApprovalResponse` もない。`apps/worker` 側も `requiresApprovalForKind: () => false` で不活性。破壊的ツールの登録・チャット承認 UI・ワーカー述語の具体化を本フェーズに含める | 承認・拒否・異常系の E2E 3 ケースが通る。`find_dropped_approvals` の 2 分岐が unit でピンされている。**承認対象ツールが取り消し不能・高リスク操作に限定されていることをレビューで確認する（§6.4.3）**。§6.5 の対応表のうち P4 納品分の行が実ファイル名へ置き換わっている                                                                                                                                                                                                                                                                                                                                                                                                       |
| **P5** | LlamaIndex 知覚層の統合（`CorrectiveRAGWorkflow` をツールとして公開）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | RAG 経由の回答に引用が付き、`output_validator` が機能する。引用の順序が決定論的（`(-score, chunk_id)`）で、dangling id が 502 になる                                                                                                                                                                                                                                                                                                                                                                                                                                                                        |
| **P6** | `packages/py-evals` を既存 baseline 機構に合流（§10.3）。基準値の計測                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | nightly で `EvaluationReport` が出る。baseline が TS 側と同じ形式で保存される                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| **P7** | `evals-gate` 有効化 + データフライホイール運用開始                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | 本番トレース由来の Case が 1 件以上データセットに入る                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| **P8** | マルチエージェント化（§5.1 の判断フローを通過した領域のみ）。§5.2 / §5.5 の移植元を先に読む                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | トークン消費が単一エージェント比で計測され、性能改善が実測で確認される。§5.3 の防御 4 点が実装されている                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

**P8 に到達しないことは失敗ではない。** §5.1 の判断フローを通過する領域がなければ、単一エージェント構成のまま完成とする。

**各フェーズ完了後に、フレッシュコンテキストの敵対的レビューを 1 回行う。** producer 側と caller 側の両方を grep して「契約は定義されたが接続されていない」欠陥を探す。参照リポジトリの retrospective では、この手順がフェーズ自身の Check で見逃された欠陥を繰り返し検出している。§6.1.1（ガードレール未接続）と §4.4.1（挟み込めない層）は、まさにこの種の欠陥として発見されたものである。

---

## 12. リスクと未決事項

| #       | 項目                                                          | 内容                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                        | 対応                                                                                                                                                                                                                                                                                                                                                                                    |
| :------ | :------------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **R1**  | **Python 3.14 への移行が塞がれている**                        | slowapi 0.1.10（最新・2026-06-13 公開）は Python classifiers が 3.13 止まりで、`extension.py` の 2 か所で `asyncio.iscoroutinefunction`（3.14 で非推奨）を呼ぶ。既存の `filterwarnings = ["error::DeprecationWarning"]` と衝突し全レーンがハード失敗する（実績: PR CI で 63 failed / 12 errors）。さらに slowapi は starlette 1.x 非互換のため `starlette<1.0` と `fastapi<0.137` のピンも引き起こしている（§2.5）                                                                                                                                                                                                                                                                                                                                                                                                                          | **3.13 に据え置き**（§2.2）。3.14 移行は「slowapi 依存の除去（自前 limiter か代替ライブラリ）」を受け入れ条件とする**独立 spec** とする。それにより §2.5 の 3 件が同時に解ける。なお `pydantic-ai-sandbox` の `patterns/*` レーンは slowapi 非依存のため既に 3.14 で動いており、新規グリーンフィールドのレーンのみ 3.14 という非対称は許容する                                          |
| R2      | Turborepo Python 対応が実験的                                 | フラグ名・挙動が将来変更される可能性。uv workspace 側も実験的扱い                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | Python 側を Turborepo 管理外にする退避経路を §3.5 に用意済み。`mise` タスクを常に維持し、`turbo` を外しても開発できる状態を保つ。`turbo-version-check` でバージョン不一致を検知                                                                                                                                                                                                         |
| R3      | HITL 承認のサイレント握り潰し                                 | `iter_tool_approval_responses` の 2 条件に一致しない承認応答が例外もログもなく破棄される（2.33.0 で挙動を確認）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | §6.4.1 の 3 層防御。第一防御はサーバ側 fail-loud（422）。上流が skip を例外化したら対策 1 を撤去                                                                                                                                                                                                                                                                                        |
| R4      | Next.js セキュリティリリース                                  | 「2026-08-26 に critical severity のパッチが予定」という情報があったが、一次情報を確認できていない                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          | 現行最新は 16.3.3。リリースアナウンスを一次情報で確認したうえで速やかに適用。16.3 系を維持                                                                                                                                                                                                                                                                                              |
| R5      | 2 つの Python FastAPI アプリの並立                            | `services/agent`（ステートレス）と `apps/agent-api`（ステートフル）が同居する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               | §3.2 で責務を固定。統合しない。`services/agent` のステートレス性（テストがソケットを開かない）を壊す変更を禁ずる                                                                                                                                                                                                                                                                        |
| R6      | Pydantic AI Harness / capabilities の採用可否                 | v2 の `capabilities`（`Instrumentation` / `ToolSearch` / `MCP` / `HandleDeferredToolCalls` / `ProcessHistory` 等 60 種超）を使うか未決                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | P1 完了後に別途評価。特に `ToolSearch` は §4.2.1 のツール数上限超過時の第一選択肢（R7 と連動）。`HandleDeferredToolCalls` は §6.4 のインライン解決に使える                                                                                                                                                                                                                              |
| R7      | ツール数上限の妥当性                                          | 10〜20 という安全域は複数ベンダー実測の集約であり、モデル・タスク・ツール記述品質に依存                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     | 自環境で tool-selection accuracy を計測し、しきい値を較正する。超過時は `capabilities.ToolSearch` を先に評価（R6）                                                                                                                                                                                                                                                                      |
| R8      | 独自 SSE と Vercel Data Stream の二重維持                     | `/v1/agent/stream` を残置するため保守対象が 2 つになる                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      | 新機能は `/v1/chat` にのみ実装。`_stream.py` のライフサイクル層は両者で共用（§4.4.1）。独自形式の利用実績がなくなり次第 deprecate                                                                                                                                                                                                                                                       |
| **R9**  | **TypeScript 7 の採否**                                       | 現行最新は 7.0.2（Go 実装への移行を含む）。既存は 6.0.3。「最新スタック」を掲げる本設計として明示的な判断が必要                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                             | 本書のスコープ外とし、`docs/adr/` で単独判断する。**判断しないまま 6.x に留まることを是としない**（原則ではなく決定として記録する）                                                                                                                                                                                                                                                     |
| **R10** | **`/v1/chat` が型 SSOT の外にある**                           | Vercel Data Stream は OpenAPI に現れないため `codegen-check` がカバーしない（§7.4）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | プロトコルバージョンを両側で定数化し CI で一致をアサート。回帰検出は §8.3 の E2E に依存するので、E2E を P3 の受け入れ条件から外さない                                                                                                                                                                                                                                                   |
| **R11** | **openai 3.x / litellm の分断**                               | `pydantic-ai-slim[openai]` は 2.32.0 で `openai>=3.0.0` をフロアにした一方、litellm は最新 1.98.0 まで `openai<3.0.0` を宣言する。`openai` extra を要求したまま両立させる解は litellm 1.83.0（既知脆弱性 11 件）しかなく、フロアを上げると解決器がそこへ後退する（§2.6.2 実測 A）                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                           | §2.6.3 の二層バージョン方針。`apps/agent-api` は `openai` extra を要求しないことで衝突自体を回避し、フロアを 2.35.3 まで前進できる（`fastapi-pydantic-ai-agent@d4d5f8d` で実証済み、§2.6.2 実測 B）。**設計への波及はない**（2.31.1 / 2.33.0 / 2.35.3 で本書が使う API は同一、§2.6.4）。撤去（`openai` extra の復活）は litellm が `openai>=3` を宣言した時点で行う                    |
| **R12** | **上流ツールによるリポジトリへの書き戻し**                    | `next dev` が `apps/web/AGENTS.md` を生成・再付与する。将来ほかのツールが同種の書き戻しを始める可能性がある                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                 | §3.6 の規約（`.gitignore` せずコミットする）。pre-commit で未コミットの生成物を検知（§10.1-6）                                                                                                                                                                                                                                                                                          |
| **R13** | **承認疲れ（approval fatigue）によるガードレール形骸化**      | §6.4.3 の較正を怠ると、承認ダイアログの乱設置がユーザーの「読まずに承認する」習慣を早期に学習させ、HITL の抑止力が名目化する。Anthropic の実測（permission prompt の 93% が未読承認）は一般的な傾向であり、本システム固有の対策の有無に結果が依存する                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | §6.4.3 の規約を適用。P4（§11）の受け入れ条件に「承認対象ツールが取り消し不能操作に限定されていることのレビュー」を組み込み済み                                                                                                                                                                                                                                                          |
| **R14** | **uv workspace の単一 lock と二層バージョン方針が両立しない** | §3.4 / §3.5 はルート `pyproject.toml` の `[tool.uv.workspace]` を要求する（Turborepo の Python 対応の有効化条件）。uv workspace はワークスペース全体で `uv.lock` を 1 つ・解決を 1 つに束ねるため、§11 P0 が要求する「`apps/agent-api` の lock（`openai` extra なし／litellm 経由 openai 2.54.0）と `services/agent` の lock（openai 3.x）の**双方**」という相互排他な 2 解決を表現できない。現行 `vaz-ai-next@bbf1156` の実値がこれを具体化している: `services/agent/pyproject.toml` は `pydantic-ai-slim[anthropic,openai]>=2.27`（§2.5-5 が禁ずる `openai` extra）と `fastapi>=0.141`（§2.5-1 の `<0.137` 上限と衝突）を宣言する。単一解決に統合すると、**§2.6.2 実測 A が記録する「litellm 1.83.0（既知脆弱性 11 件）への後退」がそのまま再現する** — §2.6 が 1 節を割いて回避した失敗様式を、§3.5 の有効化条件が構造的に再導入している | **P0 着手前に ADR で決定する。R2（Turborepo 採否）と不可分であり、同一 ADR で扱う。** 既定の解は (a)「`apps/agent-api` を uv workspace のメンバーに含めない」— 二層方針を保つ代わりに当該アプリは Turborepo の Python 管理外となり、R2 の退避経路と連動する。(b)「二層方針を撤回して単一解決に統合する」は上記の後退を招くため採らない。決定内容は §3.5 / §11 P0 の前提として参照される |
| **R15** | **停止理由語彙が言語境界で割れている** | `apps/agent-api` は 5 値（`completed` / `max_iterations` / `budget_exceeded` / `denied` / `disallowed_tool`）、REQ-0.2 で取り込む `packages/schemas/src/run-metrics.ts` は 4 値（`natural` / `step-cap` / `budget-exceeded` / `error`）。前者はどのゲートが止めたかを監査ログ単独で説明でき、後者は `error` の内訳を別経路と突き合わせる必要がある。**同じ 1 本の run について監査の解像度が言語境界で変わる**（X-5、§9.2.2） | **本版は §9.2.2 の写像表の固定までとする。** 統一は TS 側 4 値が SSE 契約（`JobEvent`）と `audit_log` テーブルに既出であるため後方互換の判断を伴い、`docs/adr/` で独立に決定する。**P1 の受け入れ条件に「写像を ADR に記録する」「ダッシュボードの停止理由ディメンションをどちらの語彙で持つか決める」を追加済み**（§11）。属性名の決定（§9.2.1）より前に確定させること |

---

## 13. 参考文献

### 13.1 一次検証の記録

**API シグネチャ**

- `pydantic-ai-slim` **2.31.1 / 2.33.0 / 2.35.3** — venv 上で `Agent.__init__` / `Agent.override` / `VercelAIAdapter` / `InstrumentationSettings` / pydantic-evals の各シグネチャを `inspect` で確認し、誤りが疑われる呼び出しは実行して例外を再現。**3 版で本書が依存する API が同一であること**を §2.6.4 の表として記録。2.35.3 は `openai` extra なしの構成で検証（`fastapi-pydantic-ai-agent@d4d5f8d` の実 lock）
- `ai` / `@ai-sdk/react` — `npm pack` した `.d.ts` を直接参照（`addToolApprovalResponse` / `approval-requested` / `approval-responded` / `tool-${NAME}`）。7.0.77 / 4.0.80 で検証し、最新（7.0.84 / 4.0.87）まで該当 API に変化がないことを確認
- `turbo` — 同梱 `schema.json` に `futureFlags.experimentalPythonWorkspaces` の実在を確認（2.10.11 で検証、最新 2.10.12）
- `slowapi 0.1.10` / `starlette 0.52.1` — PyPI メタデータの Python classifiers と `iscoroutinefunction` 呼び出し箇所を確認（§12 R1）

**依存解決**

- `uv pip compile` により複数の制約パターンを解決させ、それぞれの解決結果を `pip-audit` で測定（§2.6.2）
- `pydantic-ai-slim` 2.31.0〜2.36.0、`openai` 2.54.0〜3.6.0、`litellm` 1.98.0、`pydantic-ai-litellm` 0.2.0〜0.2.8 の PyPI メタデータから、`openai` 制約の推移とアダプタの litellm フロアを確認
- `fastapi-pydantic-ai-agent@d4d5f8d` の実 `uv.lock` から、「`openai` extra を要求しない」という参照実装の解決手段を確認（§2.6.2 実測 B）
- 参照 3 リポジトリの `uv.lock` / `package.json` から実際の解決版を抽出（§0.3）
- 各レジストリ API を直接照会し、2026-08-29 時点の最新版を §2.2 / §2.3 に反映。Python 側は `pypi.org` の JSON API（`pydantic-ai-slim` / `pydantic-evals` / `pydantic-ai-litellm` / `litellm` / `openai` / `fastapi` / `starlette` / `slowapi` / `llama-index-core` / `pydantic` / `chromadb`）、TypeScript 側は `registry.npmjs.org` の `/latest` エンドポイント（`ai` / `@ai-sdk/react` / `next` / `turbo` / `zod` / `@carbon/react` / `react` / `@biomejs/biome` / `vitest` / `@playwright/test` / `inngest`）

### 13.2 参照リポジトリ（本書の設計判断の根拠）

- `docs/cross-repo-adoption-review.md` — 5 リポジトリ相互取り込み検証（2026-09-06）。**X-1〜X-16 の根拠・実測値の正本**。本書 §0.3.1 / §4.4.1 / §6.5 / §9.2.2 / §12 R15 が参照する
- https://github.com/Fukuchan77/beeai-agentic-ai-sandbox — 4 段ラダー（`examples/` → `patterns/` → `effective_agents/` → `apps/`）、`SECURITY-NOTES.md` の非抑止方針、`ci.yml` の `schema-drift` ジョブ（横断検証 X-11 / X-12 / X-16 の出所）
- https://github.com/Fukuchan77/vaz-ai-next — `AGENTS.md` / `CLAUDE.md` / `mise.toml` / `pnpm-workspace.yaml` / `.github/workflows/eval-pr.yml` / `packages/schemas/src/generated/` / `packages/agents/src/supervisor.ts`
- https://github.com/Fukuchan77/fastapi-pydantic-ai-agent — `CLAUDE.md` / `pyproject.toml` / `uv.lock` / `app/api/v1/_stream.py` / `app/agents/guardrails.py` / `app/security/principal.py` / `tests/unit/agents/test_build_model_public_api.py` / `docs/adapter-probe-report-2026-08-13-run1.md`
- https://github.com/Fukuchan77/pydantic-ai-sandbox — `patterns/hitl/` / `patterns/sse/` / `patterns/contracts/` / `patterns/deep-research/` / `patterns/frameworks/{pydantic-ai,llamaindex,beeai}/` / `specs/012-agentic-ai-design/` / `specs/013-agentic-ai-security/` / `specs/document-review/agentic-ai-design-v2-review.md` / **`patterns/SECURITY-NOTES.md` の「上限ピンによる脆弱版回避」節**と `pyproject.toml` の **ADR-2**（§2.6 の一次出典）。あわせて `patterns/SECURITY-NOTES.md` の OWASP マッピング節（§6.5 の Agentic AI 側の出所）、`patterns/contracts/tests/unit/test_contract_drift.py`（doc → code の AST ドリフト検知、§6.5.4）、`patterns/deep-research/tests/unit/conftest.py`（`connect` / `connect_ex` / `getaddrinfo` の遮断、§8.2）

### 13.3 マルチエージェント設計

- Anthropic「How we built our multi-agent research system」（2025-06-13）: https://www.anthropic.com/engineering/multi-agent-research-system
- Anthropic「Patterns and problems in emerging multiagent systems」（2026-08-13）: https://www.anthropic.com/research/multiagent-systems
- Claude「When to use multi-agent systems (and when not to)」: https://claude.com/blog/building-multi-agent-systems-when-and-how-to-use-them
- Anthropic Cookbooks: https://github.com/anthropics/claude-cookbooks
- IBM 参照アーキテクチャ: https://www.ibm.com/think/architectures/patterns/agentic-ai / https://www.ibm.com/think/topics/agentic-architecture / https://www.ibm.com/think/topics/ai-agent-orchestration / https://www.ibm.com/think/topics/agentic-ai

### 13.4 フレームワーク（正典ドメイン）

- Pydantic AI: https://ai.pydantic.dev/ （Vercel AI 統合: https://ai.pydantic.dev/ui/vercel-ai/ 、Installation: https://ai.pydantic.dev/install/ ）
- Pydantic AI GitHub: https://github.com/pydantic/pydantic-ai
- Pydantic AI PyPI: https://pypi.org/project/pydantic-ai/ / https://pypi.org/project/pydantic-ai-slim/
- Pydantic Logfire: https://github.com/pydantic/logfire
- LlamaIndex: https://docs.llamaindex.ai/ （Workflows: https://docs.llamaindex.ai/en/stable/module_guides/workflow/ ）
- Vercel AI SDK 7: https://vercel.com/blog/ai-sdk-7 / リリース: https://github.com/vercel/ai/releases
- AI SDK Stream Protocol: https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol
- Next.js: https://nextjs.org/blog
- Turborepo Python (Experimental): https://turborepo.dev/docs/guides/tools/python
- uv workspace issue #6935: https://github.com/astral-sh/uv/issues/6935
- datamodel-code-generator: https://datamodel-code-generator.koxudaxi.dev/

### 13.5 設計思想（Anthropic Engineering / Research）

本書の設計原則（§1.1）・ツール設計規約（§4.2）・HITL 承認範囲の較正（§6.4.3）が依拠する一次情報。

- 「Building effective agents」: https://www.anthropic.com/engineering/building-effective-agents — ワークフロー（prompt chaining / routing / parallelization / orchestrator-workers / evaluator-optimizer）と自律エージェントの区別。§5.2 の採用パターン表の一次出典
- 「Writing effective tools for AI agents—using AI agents」（2026-06-16）: https://www.anthropic.com/engineering/writing-tools-for-agents — 名前空間化・応答詳細度・評価駆動反復改善（Prototype → Evaluate → Collaborate）。§4.2.2 の一次出典
- 「Effective context engineering for AI agents」（2025-09-29）: https://www.anthropic.com/engineering/effective-context-engineering-for-ai-agents — コンテキストを有限のアテンション予算として扱う設計、compaction / structured note-taking / sub-agent architecture の 3 手法。原則 6 の一次出典
- 「Measuring AI agent autonomy in practice」: https://www.anthropic.com/research/measuring-agent-autonomy — 本番テレメトリに基づく自律性の実測（permission prompt 未読承認率、承認ベースから監視ベース運用への移行）。原則 7・§6.4.3 の一次出典
- 「Trustworthy agents in practice」（2026-04）: https://www.anthropic.com/research/trustworthy-agents — モデル／ハーネス／ツール／環境の 4 層責任分界。§6.4.3 の一次出典
- 「Our framework for developing safe and trustworthy agents」: https://www.anthropic.com/news/our-framework-for-developing-safe-and-trustworthy-agents — 4 層責任分界の補足（人間の制御維持・価値整合・セキュアな連携・透明性・プライバシー保護の 5 原則）
- Anthropic Events「Agentic AI in Action」: https://www.anthropic.com/events/agentic-ai-in-action — イベントページであり技術的な一次情報を持たない。上記各記事の実務適用事例の参照先として記録するに留め、これ自体を根拠として引用しない

### 13.6 アプリケーション実装イメージ（Deep Research 系 OSS）

§5.5 の構造参照。いずれも移植元ではなく構造参照であり、実装の移植元は §13.2 の参照 3 リポジトリを優先する。

- Anthropic「How we built our multi-agent research system」（§13.3 に既出、アプリイメージとしても参照）
- `langchain-ai/open_deep_research`（LangGraph）: https://github.com/langchain-ai/open_deep_research — Supervisor + 並列 Researcher + 圧縮モデルの 2 段構成
- `huggingface/smolagents` の `examples/open_deep_research`（Code Agent）: https://github.com/huggingface/smolagents/tree/main/examples/open_deep_research — 管理エージェントがサブエージェントをツールとして呼ぶ階層構成

### 13.7 既知の課題

- pydantic-ai issue #4279（**Closed**、#3772 で解決）: https://github.com/pydantic/pydantic-ai/issues/4279
- pydantic-ai issue #7041（Vercel approval のサイレント握り潰し）: https://github.com/pydantic/pydantic-ai/issues/7041
  - issue の open/closed 状態は本書改訂時点で未確認だが、**2.33.0 のソース上で握り潰しの経路は依然として存在する**（§6.4.1）。したがって §6.4.1 の防御は issue の状態にかかわらず必要である
- Playwright / EventSource の既知の落とし穴: https://github.com/anthropics/claude-code/issues/20284

### 13.8 代替 Observability

- Arize Phoenix: https://arize.com/docs/phoenix
- Langfuse: https://github.com/langfuse/langfuse / https://langfuse.com/integrations/frameworks/pydantic-ai
- OpenLLMetry: https://github.com/traceloop/openllmetry

---

## 付録 A. 改訂履歴

### A.1 版の一覧

| 版      | 日付       | 性質                                                                                                                                                                                                                              | 検証範囲                                                                                                                                                                                                                                                                                               |
| :------ | :--------- | :-------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1.0     | 2026-08-22 | 初版。前提文書の設計原則を仕様化                                                                                                                                                                                                  | 一次検証なし（参照リポジトリの状態を古い情報のまま前提にしていた）                                                                                                                                                                                                                                     |
| 1.1     | 2026-08-22 | **全面改訂**。参照 4 リポジトリのコードを直接読み、主要ライブラリを venv へ導入して API を実行検証                                                                                                                                | `pydantic-ai-slim 2.33.0` / `ai 7.0.77` / `@ai-sdk/react 4.0.80` / `turbo 2.10.11`                                                                                                                                                                                                                     |
| 1.2     | 2026-08-22 | 依存解決の実測を追加。§2.6（openai / litellm 分断）を新設し、v1.1 の有害な推奨を撤回                                                                                                                                              | `uv pip compile` + `pip-audit` による解決結果の測定。`pydantic-ai-slim 2.31.1` を追加検証                                                                                                                                                                                                              |
| 1.3     | 2026-08-29 | 設計思想とアプリケーションイメージを一次情報として接続。原則 6・7、§4.2.2、§5.5、§6.4.3、R13 を追加                                                                                                                               | API 実測なし（Anthropic engineering / research 記事、IBM 参照アーキテクチャ、OSS 実装 2 件を参照）                                                                                                                                                                                                     |
| 1.4     | 2026-08-29 | 参照 3 リポジトリと各ライブラリ最新版の再検証、§2.6 の対処法を実測に合わせて更新。あわせて**清書**（改訂履歴を本付録へ集約し、本文から差分注記を除去、節構成を仕様書として再編。清書自体による技術的内容の変更はない）            | `pydantic-ai-slim 2.35.3` を追加検証。PyPI / npm レジストリ API による最新版の直接照会                                                                                                                                                                                                                 |
| 1.5     | 2026-08-29 | `uv` 0.9 系 → 0.12 系、`pnpm` 11.19.0 → 11.24.0 への更新可否を実機検証し、`vaz-ai-next` の `mise.toml` / `packageManager` を更新                                                                                                  | `uv 0.12.7` を実インストールし参照 3 リポジトリ全ロックファイルで `uv lock --check`（差分なし）。`pnpm 11.24.0` を実インストールし `pnpm install --frozen-lockfile --dry-run`（差分なし）。ダウンロードしたパッケージ本体の `sha512sum` で `packageManager` の整合性ハッシュを直接検証                 |
| 1.6     | 2026-08-31 | `vaz-ai-next@bbf1156` に対する適合性検証（`REVIEW-VERIFICATION-001`）の結果を反映。§12 に R14（uv workspace 単一 lock と二層バージョン方針の非両立）を新設し、§10.2 / §2.4 / §11 P0・P4 / §6.4.3 の記述誤り・不足を訂正 | API 実測なし。`vaz-ai-next@bbf1156` のファイル直接照合（ワークフロー 6 本、`.githooks/`、`apps/worker/src/{start,main,inngest}.ts`、`packages/{schemas,agents,tools,config}/src`、`services/agent/pyproject.toml`、`docker-compose.yml`、`scripts/forbid-model-ids.sh`）と `git log -S` による履歴照合 |
| **1.7** | 2026-09-08 | **本版**。5 リポジトリ横断検証（`docs/cross-repo-adoption-review.md`、2026-09-06）が「実装前に仕様へ反映する」と定めた 4 項目を反映。§0.3.1（横断検証の位置づけと反映先の対応表）・§6.5（OWASP 対応表、新設）・§9.2.2（停止理由語彙の写像、新設）・§12 R15 を追加し、§4.4.1 に SSE の第 3 の罠を、§11 P1 / P3 / P4 の受け入れ条件に対応する条件を追記。**設計判断の変更はない** — 既存の決定に、これまで書かれていなかった前提と受け入れ条件を明示したものである | API 実測なし。横断検証の実測値（5 repo の作業ツリー突き合わせ）を出所とする。OWASP GenAI の一次情報は当該セッションの egress 制約で取得できておらず、§6.5.3 は公式項番を騙らず兄弟リポジトリの既存表の risk 名称を採る（憲章 原則 8） |

### A.2 各版の主な変更

**v1.1（全面改訂）** — v1.0 は Pydantic AI v2 の API シグネチャに 2 件の実行不能な誤りを含み、参照リポジトリの状態も古かった。

| 区分 | 節         | v1.0 の記述                                        | v1.1 での更新                                                                                                                                  |
| :--- | :--------- | :------------------------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴   | §4.1       | `Agent(..., instrument=True)`                      | 削除。計装は `logfire.instrument_pydantic_ai()` に一本化（実行時 `TypeError`）                                                                 |
| 🔴   | §4.1       | `output_retries=2`                                 | `retries=AgentRetries(tools=2, output=2)`（実行時 `TypeError`）                                                                                |
| 🔴   | §2.2       | Python 3.14                                        | 3.13 に据え置き（slowapi 非対応、§12 R1）                                                                                                      |
| 🔴   | §4.4       | `_stream.py` を `VercelAIAdapter` の「前段に残す」 | `from_request()`→`run_stream()`→ライフサイクル層→`encode_stream()` の分解（`dispatch_request()` は完成した `Response` を返すため挟み込み不可） |
| 🔴   | §6.1       | ルート例に依存性なし                               | `verify_api_key` / `enforce_llm_rate_limit` / `build_guarded_toolset` / `usage_limits` を必須化。パスの二重プレフィックスも修正                |
| 🟠   | §0.3 / §11 | 「Pydantic AI 1.70 → 2.x 移行が必須」              | 削除。移行は完了済み                                                                                                                           |
| 🟠   | §0.3 / §11 | 「`pydantic-ai-sandbox` は 404」                   | 移植元として組込（リポジトリ実在・`patterns/hitl` 完成済み）                                                                                   |
| 🟠   | §3.3       | Python パッケージ名が既存 TS と衝突                | `py-` 接頭辞の命名規約を新設                                                                                                                   |
| 🟠   | §7 / §10   | 型パイプライン・evals ゲートを新規構築             | 既存機構（`openapi:gen` / `eval-pr.yml`）の monorepo 展開に縮退                                                                                |
| 🟠   | §6.4       | #7041 対策はクライアント側タイムアウトのみ         | サーバ側 fail-loud 検証を第一防御に格上げ                                                                                                      |

**v1.2（依存解決の実測）** — v1.1 自身が持っていた有害な推奨を、実測によって撤回した。

| 区分 | 節   | v1.1 の記述                                                                  | v1.2 での更新                                             |
| :--- | :--- | :--------------------------------------------------------------------------- | :-------------------------------------------------------- |
| 🔴   | §2.2 | `pydantic-ai-slim[...openai...]>=2.33,<3.0` を全 Python コンポーネントに推奨 | **撤回**（A.3 参照）。二層方針に置換                      |
| 🔴   | §2.6 | （なし）                                                                     | openai 3.x / litellm 分断の解説と二層バージョン方針を新設 |
| 🔴   | §0.2 | API シグネチャのみを検証対象としていた                                       | 依存解決も検証対象に格上げ（規約 2）                      |

**v1.3（設計思想の接続）** — Anthropic engineering / research 記事、IBM 参照アーキテクチャ、OSS の Deep Research 実装を一次情報として明示的に接続した。原則 6（コンテキスト＝アテンション予算）・原則 7（自律性の較正）、§4.2.2（ツール記述規約）、§5.5（Deep Research 参照実装）、§6.4.3（承認範囲の較正）、§12 R13 を追加。§2〜§10 のライブラリ API・バージョン記述は変更なし。

**v1.4（再検証）** — 参照 3 リポジトリを指定コミットで再取得し、各ライブラリの最新版と突き合わせた。

| リポジトリ                  | v1.2 記録 | v1.4 確認 | 判定                                                      |
| :-------------------------- | :-------- | :-------- | :-------------------------------------------------------- |
| `vaz-ai-next`               | `cf72583` | `cf72583` | 変化なし                                                  |
| `fastapi-pydantic-ai-agent` | `73eee29` | `d4d5f8d` | **7 コミット進行**。§2.6 の対処法が更新された（A.3 参照） |
| `pydantic-ai-sandbox`       | `a660637` | `a660637` | 変化なし                                                  |

`fastapi-pydantic-ai-agent` の変更内容は `pyproject.toml` / `uv.lock` / `mise.toml` / `CLAUDE.md` / `AGENTS.md` / `.gitleaksignore`（新規）/ `docs/production_deployment.md` の 7 ファイルで、`app/` 配下のコードは 1 行も変わっていない。設計に波及したのは以下 2 点である。

1. **§2.6 の対処法が「明示ピン」から「extra 省略」へ変わった**（A.3）
2. **chromadb の CVE 3 件が `--ignore-vuln` に追加された** — §2.5-6 / §2.5.2 として取り込み

ライブラリ最新版の再確認では `ai`（→7.0.84）・`@ai-sdk/react`（→4.0.87）・`next`（→16.3.3）・`turbo`（→2.10.12）・`pydantic-ai-slim`（最新 2.36.0）・`openai`（→3.6.0）・`@biomejs/biome`（→2.5.11）・`pydantic`（→2.13.5）の更新を確認したが、**設計判断を変える変化はなかった**（§2.2 / §2.3 の上限ピンはいずれも据え置きで正しい）。

**v1.5（ツールチェーンの更新）** — `uv` 0.9 系 → 0.12 系（実測 0.12.7）、`pnpm` 11.19.0 → 11.24.0 への更新可否を実機検証したうえで採用した。§2.1 の原則（バージョン固定はコード上の理由をコメントに残す）に従い、両者とも机上判断ではなく実インストールで確認している。

| 対象                                                     | 変更前    | 変更後    | 検証方法と結果                                                                                                                                                                                                                                                                                                                                                                       |
| :------------------------------------------------------- | :-------- | :-------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `uv`（`vaz-ai-next/mise.toml`）                          | `0.9`     | `0.12`    | `pip install uv==0.12.7` で実インストールし、`vaz-ai-next/services/agent`・`fastapi-pydantic-ai-agent`・`pydantic-ai-sandbox` の 3 `uv.lock` すべてに対して `uv lock --check` を実行。いずれも再解決不要（差分なし、exit 0）                                                                                                                                                         |
| `pnpm`（`vaz-ai-next/package.json` の `packageManager`） | `11.19.0` | `11.24.0` | `npm install -g pnpm@11.24.0` で実インストール後、`pnpm install --frozen-lockfile --dry-run` を実行。「pnpm-lock.yaml is up to date; a real install would make no changes」で差分なしを確認。`packageManager` の整合性ハッシュは、npm レジストリの `dist.integrity`（SRI base64）と、実際にダウンロードしたパッケージ本体の `sha512sum`（hex）が一致することを確認したうえで採用した |

**uv 0.9→0.12 の非破壊的変更点として記録が要るもの**: 0.10.0 で `uv venv` の挙動が変わり、既存ディレクトリに対しては `--clear` を明示しない限り実行を拒否するようになった（従来は非対話コンテキストで無確認削除していた）。本書 §0.2 の検証コマンド例（`uv venv --python 3.13 .venv-check`）はこの影響を受けるため `--clear` を追加した。参照 3 リポジトリの `mise.toml` タスクおよび CI ワークフローには `uv venv` の直接呼び出しがなく（`uv run` / `uv sync` はいずれも自動同期であり本変更の対象外）、実行時の影響はない。0.11.0 の `[build-system]` 境界変更、0.12.0 の sdist 形式・pre-release 解決順序の変更は、いずれも `uv_build` を使わない・配布用パッケージを持たないアプリケーションリポジトリである参照 3 リポジトリには該当しない。

**pnpm 11.19→11.24 は v11 系内のパッチ更新であり、破壊的変更は 11.0.0 時点で既に区切られている**。11.24.0 自体の変更点（`pnpm approve-builds --global` の復活、`--frozen-lockfile` がロックファイル側のピン pnpm 版で失敗しなくなる修正など）はいずれも既存の `pnpm-workspace.yaml`（`minimumReleaseAge` / `allowBuilds` / `overrides`）の挙動に影響しない。

**v1.6（適合性検証の反映）** — `vaz-ai-next@bbf1156` を本書 v1.5 と 1 件ずつ突き合わせた検証（`docs/REVIEW-VERIFICATION-001.md`）の結果を反映した。**設計判断の変更はない。** 本書自身の内部矛盾 1 件と記述誤り 4 件の訂正、および実装状態に関する注記の追加である。

| 区分 | 節                  | v1.5 の記述                                                                                                         | v1.6 での更新                                                                                                                                                                                                                                               |
| :--- | :------------------ | :------------------------------------------------------------------------------------------------------------------ | :---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🔴   | §12 / §3.5 / §11 P0 | `[tool.uv.workspace]` の要求（§3.4/§3.5）と「双方の lock」を要求する P0 受け入れ条件が併存                          | **R14 を新設**。uv workspace は lock を 1 つに束ねるため両者は両立しない。§3.5 に理由を追記し、P0 の受け入れ条件に「メンバー構成と Turborepo 採否が ADR で決定済みであること」を前提として追加                                                              |
| 🟠   | §10.2               | 「すべての `uses:` は 40 桁の SHA でピンする（既存 `test_ci_workflows.py` が機械検証している。monorepo でも維持）」 | 訂正。当該テストは `fastapi-pydantic-ai-agent` の資産であり `vaz-ai-next` には存在しない（「維持」ではなく移植が必要）。あわせて `permissions:` の最小権限宣言を規約に追加（`vaz-ai-next` の 6 ワークフローは全 21 箇所が可変タグ、`permissions:` は 0 件） |
| 🟠   | §10.2               | CI テーブルが 11 ジョブを規定するのみ                                                                               | 「現状との差分」注記を追加。実在するのは `lint` / `test:unit` / `audit` の 3 つだけであること、特に `test:e2e` が CI に存在せず §12 R10 の前提と両立しないことを明記                                                                                        |
| 🟠   | §11 P4              | 「HITL 実装。`patterns/hitl` の移植 + …」                                                                           | TS 側も未接続であることを追記。承認ポリシーは配線済みだが `createEmailCapability` はどのエージェントにも登録されておらず、`Chat.tsx` に `addToolApprovalResponse` もなく、`apps/worker` の述語は `() => false`                                              |
| 🟠   | §6.4.3              | 「実行時のヒューリスティックで動的に承認要否を決めない」                                                            | クライアント提出構造体に承認要否フラグを載せる方式（`workflowStepSchema` への `requiresApproval` 追加）を明示的に禁止。検証時に対案として提示されたため明文化した                                                                                           |
| 🟡   | §2.4                | `vaz-ai-next` の例外は 2 件                                                                                         | 3 件に訂正（+ `services/agent/app/config.py`、`scripts/forbid-model-ids.sh:41-43`）                                                                                                                                                                         |

検証で**確認された適合**として特筆すべきもの: §3.4 / §3.6 / §12 R12 が規定する `apps/web/AGENTS.md`（生成物をコミットする規約）と `apps/web/CLAUDE.md`（`@AGENTS.md` の 1 行）は、`vaz-ai-next` で既に完全充足されている。§1.2 / §6.1.1 のレートリミット配置（`apps/agent-api` の境界防御層、納品は P3）も本書の記述が正しく、`apps/web` 側に第 2 の限流器を置く必要はない（原則 5）。

**v1.7（横断検証の反映）** — 5 リポジトリ相互取り込み検証の結果のうち、本リポジトリが**実装前に仕様へ反映する**と定めた 4 項目（X-5 / X-10 / X-13 / X-14）を反映した。**設計判断の変更はない。** 反映の順序が重要である理由は、P0 の T-1.3 以降に入ってから語彙や受け入れ条件を変えると traceability マトリクスの再生成を伴うためである（横断検証 §4）。

| 区分 | 節 | v1.6 の記述 | v1.7 での更新 |
| :--- | :--- | :--- | :--- |
| 🟠 | §6.5（新設） | OWASP 対応表を持たない（本リポジトリにも `vaz-ai-next` にも無い） | **X-13**。LLM Top 10（2025）と Agentic AI 側リスクを 1 枚に統合。各行に本書の該当節と回帰テストを引用する形式を規約化し、実装前の現時点は「予定テスト名＋納品フェーズ」を書き、フェーズ完了時に実ファイル名へ置き換えることを受け入れ条件に含めた |
| 🟠 | §9.2.2（新設）／§12 R15 | 停止理由は Python 5 値のみを記述（§6.3.1 / §8.3-7） | **X-5**。REQ-0.2 で取り込む `packages/schemas/src/run-metrics.ts` の TS 4 値との写像表を固定。`denied` / `disallowed_tool` / `error` の非対称 3 値により**監査の解像度が言語境界で変わる**ことを明記し、§9.2.1 の属性名決定より前に確定させることを P1 の受け入れ条件に追加。統一の可否は独立 ADR（R15） |
| 🟠 | §4.4.1 | SSE の罠は 2 点（anyio cancel scope のタスク跨ぎ、ハートビートに `asyncio.wait_for()` を使わない） | **X-10**。第 3 の罠を追加 — Pydantic は JSON 中の U+2028 / U+2029 をエスケープせず、`str.splitlines()` はこれを行境界として扱うため `data:` 行が途中で割れる。分割は実 SSE 終端子のみで行う。回帰テストを P3 の受け入れ条件に追加 |
| 🟡 | §11 P3 | 「テキストストリーミングの E2E が通る」 | **X-14**。**前提として「Ollama 非依存の E2E が CI レーンとして稼働していること」を明示**。§10.2 は v1.6 で既に「P3 到達前に新設すること」と本文に書いていたが、P3 の受け入れ条件行に前提として載っていなかった（pre-push だけの E2E は `--no-verify` で素通りする） |
| 🟡 | §8.2 | ソケット遮断は `socket.connect` を塞ぐ | **X-2**。`connect_ex` と `getaddrinfo` も塞ぐことを追記（`connect` のみでは DNS 解決が素通りする）。遮断が空振りでないことを証明する専用テストの要求（REQ-7.4）と対で読む |
| 🟡 | §0.3.1（新設）／§13.2 | 横断検証への参照なし | 反映先の対応表、反映不要と判定した項目（X-1 / X-3 / X-4 / X-6b）とその理由、および横断検証側の X-6b の記述の訂正（`tool-count-check` は「原則のみ」ではなく「仕様化済み・未実装」）を追加 |

**P0 の要件セットは変更していない。** 本版が触れたのは P1 / P3 / P4 の受け入れ条件と設計記述であり、`spec.md` の 53 要件・`tasks.md` の T-0〜T-9・`traceability.md` のマトリクスはいずれも増減しない。したがって `approvals.requirements` / `design` / `tasks` は P0 デリバリ単位に対して有効なままである（憲章 原則 10 のゲートは P1 以降のサイクルで再度通る）。

### A.3 撤回された推奨（重要）

本書の旧版を参照する場合に注意を要する記述。いずれも**実測によって誤りと判明したもの**である。

**撤回 1: `pydantic-ai-slim>=2.33` を全 Python コンポーネントに推奨（v1.1 §2.2 → v1.2 で撤回）**

この制約セットを実際に解決させると litellm 1.83.0 に後退し、`pip-audit` が 11 件の既知脆弱性を報告する（§2.6.2 実測 A）。**フロアを上げるという「最新化」が、そのまま脆弱性の新規導入になった。** この失敗が §0.2 規約 2（依存解決も検証対象である）の由来である。

**撤回 2: `openai<3.0.0` の明示ピン + フロアを 2.32 未満に留める（v1.2 §2.6.3 → v1.4 で撤回）**

衝突は回避できるが、`pydantic-ai-slim` のフロアを 2.32 未満に縛る副作用がある。参照実装（`fastapi-pydantic-ai-agent@d4d5f8d`）が採った「`openai` extra 自体を要求しない」方法のほうが優れており、フロアを 2.35.3 まで前進できる（§2.6.2 実測 B）。**現行の規約は §2.5-5 / §2.6.3 を参照すること。**

この 2 件から得られる一般則は §2.6.5 に記載した。要点は、**バージョン衝突には「フロアを下げて避ける」以外に「要求そのものを削って起こさせない」解法がある**ということである。

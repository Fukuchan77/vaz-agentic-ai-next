# 5リポジトリ再検証（2026-09-22）

- **検証日**: 2026-09-22
- **検証方法**: 各 repo のローカルクローンに対する直接調査（`grep` による実測、主要ファイルの
  存在・行数確認、README/CLAUDE.md/AGENTS.md/docs のサンプリング通読）。
  数値は再現可能（§0 の測定コマンドに従う）。
- **正本との関係**: `docs/cross-repo-adoption-review.md`
  （2026-09-06 検証・2026-09-21 追記、以下「正本」）が 5 repo 横断で行った主張を、今回
  独立に再測定した。正本は追記のみ規約のため本文書はそれを書き換えず、**差分の記録**として
  本ディレクトリに置く。

## 総括（結論を先に）

正本の記述は 6 か月弱で大きく古びている。特に：

1. **`beeai-agentic-ai-sandbox` は別プロダクトに置き換わっている**。正本が前提にした
   4 段学習ラダー（`examples/` → `patterns/` → `effective_agents/` → `apps/`）は
   跡形もなく、現在は「BeeAI FastAPI React App」という本番指向の chat/RAG/文書処理アプリ
   （単一コミット、2026-01-25）。CI・`SECURITY-NOTES.md`・HITL コードなど正本が個別に
   引用した資産はほぼ全て**存在しない**。正本 §6.3 が「本追記の検証対象外」と明記していた
   その通りの結果で、**再検証しないと分からない典型例**になった。
2. **`pydantic-ai-sandbox` の `agentic-ai-sandbox` への「統合済み」は 2026-06-28 時点の
   スナップショットに過ぎない**。正本（および本 repo の `docs/cross-repo-adoption-backlog.md`）は
   統合後を前提に記述しているが、`pydantic-ai-sandbox` 本体はその後も独立して開発が続き
   2026-09-20 まで更新されている。両者は別々に生きている 2 リポジトリであり、
   「`agentic-ai-sandbox/reference/...` へ再検証済み」という正本の前提は
   **統合後 3 か月弱の独立進化を欠落させている**。
3. **`fastapi-pydantic-ai-agent` は正本が指摘した X-n 項目の多くを 2026-09-08 時点で
   自ら消化済み**（X-2/X-6/X-7/X-8/X-9/X-12/X-13/X-16、同 repo の
   `docs/cross-repo-adoption-backlog.md` が✅済と記録）。かつ本 repo は spec
   `006-repo-consolidation` Task 6 で同 repo を `services/api` として丸ごと import 済み
   （`git subtree add --squash`、コミット `cec9be6`）であり、import 後の乖離は
   §4 で確認した通り**既知の gap（AGENTS.md 記載）と一致し新規の乖離は無い**。
4. **`agentic-ai-bootcamp` は正本に一切登場しない新規リポジトリ**。CI・OWASP 対応表など
   本ハブが重視する運用資産は皆無だが、`pydantic-ai-sandbox` と対になる教育カリキュラム
   （Stage 0-3、`pydantic-ai-sandbox` が Stage 4-5）として設計されている。

---

## §1 `fastapi-pydantic-ai-agent`

### 確認できた主張（正本どおり）

- Actions SHA 固定: **5/5**（`uses:` 全行が 40 桁 SHA）。
- workflow `permissions:` 宣言: **2/2**。
- `tests/unit/test_ci_workflows.py`: 224 行のまま、YAML 静的パースも同じ。
- `app/agents/guardrails.py:40` の `StopReason` 語彙: `completed`/`max_iterations`/
  `budget_exceeded`/`denied`/`disallowed_tool` の 5 値のまま。
- SSE 3 罠すべて現存: `app/api/v1/_stream.py`（cancel scope 注記、417 行）、
  `app/api/v1/agent.py:175`（`asyncio.wait()`、`wait_for` 禁止コメントは L159-160）、
  `app/patterns/sse.py:6,103`（`parse_sse_events()`、129 行）。
- `.github/dependabot.yml` の `ignore:` 設計（fastapi は minor/major 両方無視）は健在。

### 陳腐化した数値

| 項目 | 正本（2026-09-06） | 再実測（2026-09-22） |
|---|---|---|
| workflow ファイル数 | 5 本（SHA 固定 5/5） | **2 本**（`pr.yml`/`security.yml`）に統合。SHA 固定は 5/5 のまま維持（分母が縮小） |
| `tests/support/hermetic.py` | 47 行、`socket.socket.connect` のみ差し替え | **75 行**。X-2 自身の指摘どおり `connect_ex`／`getaddrinfo` も追加済み |
| `docs/tool-design-conventions.md` | 144 行、`Status: deferred`・実ツール 0 件 | **154 行**。ステータスは deferred のままだが、参照実装
  `app/agents/examples/tool_design_reference.py`（`directory_search`/`directory_get`、未登録の `@agent.tool` 例）と
  そのテスト `tests/unit/agents/test_tool_design_reference.py` が追加された |
| `docs/owasp-agentic-llm-mapping.md` | 43 行、LLM Top 10 のみ | **72 行**。**OWASP Agentic AI Top 10（2025-12、ASI01-ASI10）表を追加**。追加理由コメントが
  「`docs/cross-repo-adoption-backlog.md` X-13 に基づく」と明記 — 正本の提案がこの repo 側で先に実装された形 |

### 新規発見

- `docs/cross-repo-adoption-backlog.md`（新規）が正本を「正本」として ID 引用のみで自己完結させる書き方を採用。
  X-2/X-6/X-7/X-8/X-9/X-12/X-13/X-16 の 8 項目全てを**2026-09-08 時点で✅済**と記録。
- `evals/pr_gate.py` — 本ハブの `packages/evals/src/pr-gate.ts` の設計を明示的に移植
  （`PR_GATE_MIN_CASES_FOR_BLOCKING` を含め docコメントで出典を明記）。X-8 の相互取り込みが
  実際に本ハブ→この repo 方向で成立した実例。
- `docs/context-budget.md`（新規）も同様に本ハブの同名ドキュメントの Stage 0/1/2 設計を移植。
  `HistoryCompactor` seam を `_trim.py` の両バックエンドに追加（実装は未着手、seam のみ）。
- リクエストモデル全面 `extra="forbid"` 化（X-9、CVE-2026-25580 系の履歴注入経路を閉塞）。
  ガードテスト `tests/unit/models/test_request_model_strictness.py` 新設。
- テスト:コード比率が約 3.5:1（`app/` 9,555 行 / `tests/` 33,328 行）と極めて厚い。

### 本ハブへの示唆

- **`services/api`（import 済み `fastapi-pydantic-ai-agent`）との乖離チェック**: import 後
  （`cec9be6`、2026-09-21）に上流へ追加された 3 ファイル（`tests/unit/test_ci_workflows.py`、
  `tests/unit/test_dependabot_config.py`、`tests/unit/test_pre_push_hook.py`）は
  `services/api` に**存在しない**。ただしこれは `AGENTS.md`「Known gap」節が既に記録している
  意図的な省略と一致する（`services/api` は自前の `.github/workflows/`・`dependabot.yml`・
  `.pre-commit-config.yaml` を持たず、ハブ側の仕組みに委ねる設計のため）。**新規の乖離ではない**。
  ドキュメント差分も `.md`/`.yml` レベルでは `.github/dependabot.yml`・`.github/workflows/pr.yml`・
  `.github/workflows/security.yml`・`.pre-commit-config.yaml` の 4 ファイルのみが差分で、
  他の docs/ は完全一致。
- `docs/owasp-agentic-llm-mapping.md` に Agentic AI Top 10 表が追加されたことで、
  正本 X-13 が「統合対象」として挙げていた 2 表（LLM Top 10 ＋ Agentic AI Top 10）は
  **既にこの repo 単体で両方揃っている**。本ハブの
  [`docs/owasp-llm-top10-mapping.md`](../../docs/owasp-llm-top10-mapping.md) /
  [`docs/owasp-agentic-threats-mitigations-mapping.md`](../../docs/owasp-agentic-threats-mitigations-mapping.md)
  と突き合わせ、テスト引用形式の書き方（各行にテストファイルを引用）に差異が無いか
  比較する価値がある。

---

## §2 `pydantic-ai-sandbox` と `agentic-ai-sandbox` — 「統合済み」の実態

### 事実関係

- `pydantic-ai-sandbox`（オリジナル）: **現在も独立して活発に開発中**。最終コミット
  2026-09-20（PR #37 マージ）。README/CLAUDE.md に統合・非推奨の記載は無い。
  同 repo 自身の `docs/cross-repo-adoption-backlog.md` は姉妹 repo として
  `beeai-agentic-ai-sandbox` / `fastapi-pydantic-ai-agent` / `vaz-ai-next` /
  `vaz-agentic-ai-next` を挙げるのみで、**`agentic-ai-sandbox` には一切言及していない**
  （2026-09-06 時点の記述のまま更新されていない可能性が高い）。
- `agentic-ai-sandbox`: 最終コミットは **2026-06-28**（"monorepo consolidation
  (Phase 1–4) + robustness hardening"）。これが正本の言う「統合」コミットであり、
  それ以降 1 コミットも増えていない。

**結論**: 統合は起きたが、それは 2026-06-28 時点の `pydantic-ai-sandbox` の**スナップショット**を
`agentic-ai-sandbox/reference/` へ取り込んだだけであり、`pydantic-ai-sandbox` 本体は
その後も独立に更新され続けている（2026-09-20 まで、約 3 か月弱）。正本および本 repo の
`docs/cross-repo-adoption-backlog.md` が「`agentic-ai-sandbox/reference/...` へ
再検証済み」と述べる箇所は、**この 3 か月分の独立進化を欠落させた前提**の上に立っている。
`agentic-ai-sandbox` を唯一の後継として扱うのは誤りで、実際には**並存する 2 つの正本**が
存在する状態。

### `agentic-ai-sandbox` の構造（正本の記述から変化）

正本は `pydantic-ai-sandbox` を「root app ＋ 8 独立 uv レーン」と記述していたが、
`agentic-ai-sandbox` は 2 層構造（`learn/` = Stage 0-3・緩いゲート、`reference/` =
Stage 4-5・厳格ゲート）に再編されている。`examples/`/`effective_agents/`/`apps/` という
命名は使われていない（`beeai-agentic-ai-sandbox` の命名と混同しないこと）。

- `reference/patterns/contracts/` — 存在（`test_contract_drift.py` は 287→**286 行**）。
- `reference/patterns/hitl/` — **不在を確認**。正本の 2026-09-21 追記が既に指摘していた
  「統合後に hitl レーンが消えている」を裏づけた。`extra="forbid"` の構造的封鎖・
  consume-once ステートマシンは `agentic-ai-sandbox` には存在しない。
- `reference/patterns/deep-research/`（`COMPARISON.md` 含む）— 存在。
- `reference/app/src/pydantic_ai_sandbox/` — 旧 root app がパッケージ名そのままで
  `reference/app/` 配下に移設されている。
- `learn/lessons/00-setup`〜`11-evals`（12 レッスン）＋
  `learn/frameworks/{langgraph-workflow-patterns, llamaindex-rag-workflows}` — 正本には
  無い新規の教育レイヤー。**`agentic-ai-bootcamp` の `lessons/00-setup`〜`11-evals` と
  同一の 12 課構成**（§4 参照。両 repo 間で教材が共有・同期されている可能性が高い）。

### 再実測値

| 項目 | 正本（pydantic-ai-sandbox, 2026-09-06） | 再実測（agentic-ai-sandbox, 2026-09-22） |
|---|---|---|
| Actions SHA 固定 | 5/31 | **4/28**（8 workflow ファイル中。固定されるのは今も `jdx/mise-action` のみ）|
| workflow `permissions:` | 6/6 | **8/8** |
| repo guard テスト（6 ファイル） | 全 6 ファイル存在 | **2/6 のみ同名で発見**（`test_no_hardcoded_model_ids.py`／`test_watsonx_ci_workflow.py`）＋ `test_contract_drift.py`。`test_ci_usage_policy`／`test_ollama_ci_workflows`／`test_security_workflow_lanes` は**発見できず**（31→8 本への workflow 統合時に整理された可能性） |
| deep-research ネットワーク遮断（`connect`/`connect_ex`/`getaddrinfo`） | 3 種とも遮断 | **維持**（L47-49、コメントが "hermetic guard" と明言） |
| `pytest_live_guard.py` | 62 行 | **101 行**（拡張） |
| `eval_graders.py` | 93 行 | **111 行**（拡張） |
| `docs/tool-design.md` | 110 行、`patterns/frameworks/pydantic-ai/` 配下 | **repo 直下 `docs/tool-design.md` へ移動**（レーン横断の共有ドキュメントへ格上げ） |
| stop reason 5 値 | `completed`/`max_iterations`/`budget_exceeded`/`denied`/`disallowed_tool` | **完全一致**（`reference/patterns/contracts/.../autonomous_agent.py`） |
| `.gitignore` の `CLAUDE.md`/`.sdd/` 除外 | L222-228 | **維持**（root と `reference/.gitignore` の両方） |

### 新規発見

- `docs/governance-and-scale.md`（Stage 5: identity/scale/deploy/OWASP）を筆頭に、
  `docs/{agent-types,concepts,context-engineering,framework-comparison,provider-setup,
  learning-path,roadmap}.md` という教育文書レイヤーが repo 直下に新設されている。
  単一のエントリポイント `docs/learning-path.md` が Stage 0-5 全体を束ねる。
- `scripts/check_doc_links.py` — 本ハブの `tests/repo/doc-links.spec.ts` と同種の
  相対リンク健全性チェッカー。README によれば「repo 間 URL は撤廃済み」とあり、
  本ハブの「内部はリンク・外部はコードスパン」規約と同じ発想に到達している。
- CI は 31→**8 本**へ統合（`docs-ci`/`integration-ollama`/`integration-watsonx`/
  `learn-ci`/`patterns-ci`/`patterns-integration-ollama`/`reference-ci`/`security`）。

### 本ハブへの示唆

- **正本の §0 対象表・`docs/cross-repo-adoption-backlog.md` の統合済み前提を再検証時に
  割り引くこと**。`pydantic-ai-sandbox` を対象にした主張は、`agentic-ai-sandbox/reference/`
  だけでなく**独立継続中の `pydantic-ai-sandbox` 本体**の両方を見なければ最新とは言えない。
- HITL の 2 ゲート（`needsApproval` ＋ `RECIPIENT_ALLOWLIST`）は
  `agentic-ai-sandbox` 側に対応する資産が消えたため、**取り込み元は
  `pydantic-ai-sandbox` 本体（現存する `patterns/hitl/`）に限定される**——ただし
  今回は `agentic-ai-sandbox` のみを深掘りしたため `pydantic-ai-sandbox` 本体の
  `patterns/hitl/` が 2026-09-20 時点でどう変化したかは未検証（次回の宿題）。

---

## §3 `beeai-agentic-ai-sandbox` — 別プロダクトへの全面置換

正本 §6.3 は「本追記の検証対象外（セッションに未 attach）、2026-09-06 時点のまま未検証」と
明記していた。今回初めて再検証したところ、**正本が引用した具体的資産はほぼ全て現存しない**。
単一コミット（`679a68c`、2026-01-25 日付）であり、履歴が丸ごと置き換わっている
（squash/force-push か、正本が別ブランチを見ていたかのいずれか）。

### 構造そのものが別物

正本が前提にした 4 段学習ラダー（`examples/` → `patterns/` → `effective_agents/` →
`apps/`）は**跡形もない**。現在の構造は素直なレイヤードアプリ:

- `src/app/{api/routes, infrastructure, middleware, schemas, services, tools}` —
  FastAPI バックエンド
- `frontend/src/{api,components,hooks,stores,types}` ＋
  `frontend/tests/{e2e,integration}` — React フロントエンド
- `common/types/` — 共有 TS 型
- `tests/test_{api,infrastructure,integration,middleware,schemas,services,tools}/`

README は「BeeAI FastAPI React App」を名乗り、「84%+ カバレッジ・327+ テスト・全 6 フェーズ完了」を
謳う本番指向の chat/RAG/文書処理アプリになっている。

### 正本の主張ごとの現況

| 正本の主張（2026-09-06） | 現況（2026-09-22） |
|---|---|
| Actions SHA 固定 0/18（最下位） | **`.github/` 自体が不在** — workflow が 0 本。「最下位」の前提だった CI が消滅 |
| workflow `permissions:` 2/2 | 同上、該当なし |
| `AGENTS.md`/`CLAUDE.md`/`.claude/` 皆無 | **維持**（正本の指摘のうち唯一そのまま正しい点） |
| 10 本の Playwright spec（`00-smoke`〜`09-accessibility`）が CI で 1 度も走らない | **spec 自体は現存**（`frontend/tests/e2e/specs/`、page-object・axe-core 込み）。
  だが CI が完全に消滅したため「CI で走らない」という状態は**むしろ悪化**（走らせる仕組み自体が無い） |
| `docs/DEPLOYMENT.md` は虚偽インフラ記述を削除した「正直さ」の実例 | **正反対**。803 行の同名ファイルが存在し、Dockerfile も docker-compose.yml も
  存在しないのに AWS ECS/Lambda・Azure Container Instances・Cloud Run・systemd・Nginx・
  Kubernetes・Prometheus・ELK の手順を**フルで記載**。正本が称賛した「削除」は
  この lineage には無いか、後戻りしている |
| `SECURITY-NOTES.md`（最も厳格な抑止方針） | **不在**。同名ファイルはリポジトリのどこにも無い |
| `.pre-commit-config.yaml` の gitleaks バージョン固定とCI のタグ運用の非対称 | **両方とも不在**につき問題自体が消滅 |
| `effective_agents/autonomous_agent.py` の `input()` ブロッキング承認 | ディレクトリごと消滅。`src/` に `input(` 呼び出しなし |
| eval 基盤（文書のみ、harness 皆無） | docs/ に rubric/LLM-as-judge の記述自体が見当たらない |

### 新規発見

- README が `.sdd/specs/beeai-fastapi-backend/complete.md` を参照するが、
  クローンに `.sdd/` ディレクトリ自体が存在しない — `DEPLOYMENT.md` と同種の
  「成果物なき記述」パターンが別の場所で再発している。
- ルート `README.md` は英日併記の単一ファイル（他の docs は `*_ja.md` 分割）で、
  repo 内の命名規約が不統一。
- README 自身が「JWT ready だが認証は未実装」など複数プロバイダ対応の
  未成熟点を自己申告している（正直な自己申告という点は評価できる）。

### 本ハブへの示唆

- 正本の X-4（`AGENTS.md`/`CLAUDE.md` 新設提案）・X-14（E2E の CI レーン新設提案）・
  X-16（学習ラダー教材の相互参照）は、**対象そのものが変わった**ため前提から書き直しが必要。
  特に X-16 が挙げていた「LangGraph→BeeAI 翻訳表」「記事用語対応表」「`_print_usage()`」
  「4 段ラダー」は**もう存在しない**ので、正本を更新する際はこの repo 由来の教材資産は
  X-16 から実質的に削除するのが正確。
- 唯一生き残っている資産は **10 本の Playwright a11y/E2E spec**。本ハブが正本 X-14b で
  既に取り込んだ「`@axe-core/playwright` による a11y 検査」は、この repo からの着想として
  記録した経緯そのものは変わらない（着想元が変質しても、既に着地済みの成果は影響を受けない）。
- CI・セキュリティ運用資産（`SECURITY-NOTES.md`、schema-drift ジョブ）が丸ごと消えたため、
  正本 §5 の「repo 別の取り込み主軸」表のうち `beeai-agentic-ai-sandbox` 行は
  **実体を失っている**。次に正本を更新する際の最優先の書き直し対象。

---

## §4 `agentic-ai-bootcamp` — 正本未収載の新規リポジトリ

正本にも `docs/cross-repo-adoption-backlog.md` にも一切登場しない。`pydantic-ai-sandbox`
（および `agentic-ai-sandbox/learn/`）と対をなす教育カリキュラムであり、**本ハブが
重視する運用資産（CI・OWASP 対応表・Dependabot・network 遮断 harness）は皆無**。
ただし教材としての設計は一貫している。

### 実態

- Pydantic AI（Python ≥3.11、`uv` ワークスペース）のハンズオン教材。英日併記。
  `AGENTS.md`/`CLAUDE.md` は無い。
- `lessons/00-setup`〜`11-evals` の 12 課、各課が `README.md`（英日併記）・
  実行可能な `<lesson>.py`・`test_<lesson>.py` の 3 点セット。
- `frameworks/{langgraph-workflow-patterns, llamaindex-rag-workflows}` —
  同じ課題を LangGraph・LlamaIndex Workflows で再実装した比較トラック。
  **`agentic-ai-sandbox/learn/` の同名構成（12 課 ＋ 同じ 2 フレームワーク比較）と一致**
  （§2 参照）— 教材が両 repo 間で共有・同期されている可能性が高い。
- `.github/` 自体が存在せず、CI・Dependabot・SHA 固定・`permissions:` はすべて**該当なし**。
- OWASP 対応表・HITL・MCP は本文中に存在せず、`docs/learning-path.md` が
  「OWASP は `pydantic-ai-sandbox` の `patterns/SECURITY-NOTES.md` /
  `governance-and-scale.md` を見よ」と**参照先に委譲**する設計。
- Lesson 11（evals）は 2 軸グレーダー（Outcome=正確性/完全性、Behavior=ツール使用規律/
  忠実性）を判定モデルを生成モデルと分離して実装 — `EVAL-GRADERS.md` 契約の
  簡略教育版と明記。
- 全レッスンが `TestModel`/`FunctionModel`（pydantic-ai 付属のフェイクモデル）で
  ネットワーク不要のテストを書く方針を徹底（17 ファイルで使用）。ただし
  これを強制する CI や socket 遮断 harness は無く、**規律であって機構ではない**。

### 本ハブへの示唆

- 運用資産としての取り込み対象は無い（CI・ガードテストが皆無なため）。
- 教材設計としては、各レッスンが Anthropic/IBM の一次情報 1 本に対応づけられている
  「出典対応表」の発想が、本ハブの [`docs/guide/`](../../docs/guide/README.md)
  （8 手法スケルトンに実装・姉妹教材・正本の X-n を束ねる設計）と同じ方向性であり、
  相互参照リンクを張る価値がある（実装取り込みではなく学習パスの相互リンクとして）。
- `bootcamp_common/provider.py` の「1 つの env 変数で Anthropic ↔ ローカル Ollama を
  切り替える」設計は、本ハブの `resolveModel()`（`@vaz/config`、env 駆動）と
  同じ思想であり、目新しさは無い（本ハブが既に持つパターンの Python 版）。

---

## §5 横断マトリクス（再実測、2026-09-22）

正本 §1 のマトリクスを最新実測値で置き換えた版。空欄は今回未検証。

| 観点 | beeai-sandbox | pydantic-ai-sandbox | agentic-ai-sandbox | agentic-ai-bootcamp | fastapi-pydantic-ai-agent | 本ハブ |
|---|---|---|---|---|---|---|
| 最終コミット | 2026-01-25（単一コミット） | 2026-09-20 | 2026-06-28（停止中） | 未計測 | 2026-09-20 | 2026-09-2x |
| Actions SHA 固定 | **0/0**（CI 自体消滅） | 未再検証 | 4/28 | 該当なし（CI 無し） | 5/5（2 workflow に統合） | 28/28（正本 §6.2） |
| workflow `permissions:` | 該当なし | 未再検証 | 8/8 | 該当なし | 2/2 | 6/6（正本 §6.2） |
| repo guard テスト | 0 | 未再検証 | 3（6 件中 2 件同名消失） | 0 | 変わらず多数（未再計測） | T-5.5 移植分 |
| ネットワーク遮断 | 未確認（機構自体は無い可能性大） | 未再検証 | 3 種とも維持・拡張中 | フェイクモデル依存（機構無し） | あり | あり |
| eval 基盤 | 文書すら未確認 | 未再検証 | `eval_graders.py` 111 行に拡張 | Lesson 11 の教育版 | PR ゲート移植済み | 3 層＋PR ゲート |
| stop reason 語彙 | 未確認 | 未再検証 | 5 値・完全一致 | 該当なし | 5 値・完全一致 | 4 値（別語彙、ADR-0004） |
| HITL | ディレクトリごと消滅 | 未再検証（本体に現存の可能性） | **不在**（統合時に脱落） | 該当なし | `approval_hook` 現存 | 2 ゲート＋Inngest |
| OWASP 対応表 | 不在確認 | 未再検証 | 未再検証 | 委譲のみ（実体なし） | LLM Top10＋Agentic Top10 の**両方**を単独で保有 | 両方保有 |
| Dependabot | 不在 | 未再検証 | 未再検証 | 不在 | あり（`ignore:` 設計健在） | あり |
| E2E の CI レーン | spec は現存するが CI 自体が消滅 | 未再検証 | `learn-ci`/`reference-ci` 等 8 本 | 該当なし | 未再計測 | あり |

---

## §6 推奨アクション（優先順）

1. **正本 §6 へ「§7 追記」を起票する際の材料として本文書を使う**。特に
   `beeai-agentic-ai-sandbox` 行と「`pydantic-ai-sandbox` は統合済み」という前提文は、
   次回改訂で最優先に書き直す（実体が変わった帰結であり、既存記述の誤りではない —
   正本自身が「時点の記録」であることを §6.2 で明言済み）。
2. **`pydantic-ai-sandbox` 本体（`agentic-ai-sandbox` 側ではなく）の `patterns/hitl/` を
   別途再検証する**。今回 `agentic-ai-sandbox` では hitl レーンの消失を確認したが、
   本体側でどう変化したかは未検証のまま。X-9（HITL 相互取り込み）の取り込み元として
   引き続き有効か判断できていない。
3. **`docs/owasp-llm-top10-mapping.md` / `docs/owasp-agentic-ai-top10-mapping.md` を
   `fastapi-pydantic-ai-agent/docs/owasp-agentic-llm-mapping.md`（72 行、2 表統合済み）と
   突き合わせる**。同 repo が正本の X-13 提案を本ハブより先に実装した形になっており、
   テスト引用の粒度や更新頻度で参考にできる点が無いか確認する価値がある。
4. **`agentic-ai-bootcamp` と `agentic-ai-sandbox/learn/` の 12 課構成が一致している件**を
   どちらか一方の repo 保守者（同一アカウント）に確認し、教材の同期方針
  （どちらが正本か、フォークか、それとも意図的な二重化か）を明らかにする。
   本文書は観察のみに留め、判断は行わない。

---

## §7 推奨アクションの実施結果（2026-09-22、同日）

§6 の 4 項目を同日中に実施した。以下は結果の要約で、判断の根拠は各節にある。

### 推奨 1 — 正本への追記: **完了**

`docs/cross-repo-adoption-review.md` に **§7（追記、177 行）** を追加した。
§1〜§6 は 1 文字も変更していない（追記のみ規約の遵守）。§7 の構成は
§7.1 検証スコープ／§7.2 `beeai-agentic-ai-sandbox` の失効／§7.3
`pydantic-ai-sandbox` 分岐／§7.4 `agentic-ai-bootcamp`／§7.5
`fastapi-pydantic-ai-agent`／§7.6 X-13 の逆転／§7.7 一般則。

併せて `docs/cross-repo-adoption-backlog.md` の陳腐化した前提を訂正した
（冒頭の「統合済み」記述、X-9 行の取り込み元、X-13 行の前提）。

### 推奨 2 — `pydantic-ai-sandbox` 本体の HITL 再検証: **完了、X-9 の前提が変わった**

`patterns/hitl/` は**現存し拡張が続いている**（`src/patterns_hitl/` 8 モジュール、
unit テスト 13 ファイル、カバレッジゲート 98%）。2026-09-06 の主張はすべて現行コードで裏が取れた
（deferred tools、`extra="forbid"` ＋ `message_history` 非定義、consume-once、マスク監査、
in-memory ＋ TTL 未実装）。なお「8 独立 uv レーン」は**実際には 5 レーン**（`contracts` /
`deep-research` / `hitl` / `rag` / `sse`）で、この数字は陳腐化していた。

**最大の発見**: 同レーンは**本 repo の X-9 を既に取り込んでいる**。`agent.py` が
recipient allow-list（`_known_recipient`）と sticky taint（`HitlDeps.tainted`）を実装し、
README が出所を本 repo と明記のうえ **"X-9a" / "X-9b"** と本 repo 由来の ID で参照している。
X-9 は「本 repo が取り込む項目」だったが、**先に逆方向で着地した**。

本 repo が持たない防御 6 点（履歴注入のスキーマレベル封鎖・存在秘匿を伴う consume-once・
境界跨ぎ usage 予算・マスク監査の単一 fail-soft 境界・pending set の原子性 409・
egress 回帰スキャン）は正本 §7.3 に列挙した。**これらは X-9 の再起票候補**だが、
本 repo の HITL 配線自体が未完（`apps/worker` の述語）なので、配線の完了を先行させる。

### 推奨 3 — OWASP 対応表の突き合わせ: **完了、前提が逆転した**

X-13 が規範として挙げた「出所は全行にテストを引用」は**もう成立しない**。
出所側は 2 タクソノミ 20 行へ拡張される過程で**テスト引用が 8/20 行**まで薄まった。
一方、本 repo の 2 文書は**全 40 引用（パス・シンボル名・CI ステップ）が実在**し、
テスト未引用は「未対応」と明記した 2 件のみ。**厳格さでは本 repo が上回る**。

ただし本 repo 側に出所側に無い弱点が 4 つ見つかり、
`docs/cross-repo-adoption-backlog.md` §5 に **X-17〜X-20** として起票した。
**X-17（agentic 脅威 5 件の無言の欠落、うち 3 件は多エージェント脅威）が最優先** ——
本 repo は `packages/agents/src/supervisor.ts` で多エージェント構成を持つため、
単一エージェントの出所側より該当性が高いのに落ちている。

なお `services/api/docs/owasp-agentic-llm-mapping.md`（vendored）は上流の現行版と
**バイト一致**しており、subtree の同期は保たれている。

### 推奨 4 — 教材 2 本の関係: **完了（観察のみ、判断は保留）**

`agentic-ai-bootcamp` の `lessons/` ＋ `frameworks/` と
`agentic-ai-sandbox/learn/` の同名ツリーを突き合わせた結果、
**71 ファイル中 13 ファイルのみ相違**。相違の大半は `learn/` の 1 階層ぶんの
リンク張り直しだが、**コードは双方向にドリフト**している（`11-evals/evals.py` は
bootcamp のみが `UNKNOWN` 番兵を持ち、sandbox のみが `overall` の注意書きを持つ。
`frameworks/` は sandbox のみ型注釈が新形式）。

つまり**後継関係ではなく二方向フォーク**。どちらを正本とするかは repo 保守者の判断であり、
本 repo の関与範囲外のため**起票せず観察の記録に留める**（正本 §7.4）。

### 派生して残った宿題

- X-17 / X-18 / X-19 / X-20 の実装（本 repo の OWASP 2 文書の改訂）。本文書では起票のみ。
- X-9 の残り 1 箇所の配線（`apps/worker` の `requiresApprovalForKind`）。
  `docs/cross-repo-adoption-backlog.md` §3 が記すとおり、`workflowStepSchema` への
  ステップ単位フラグ追加を伴う横断変更であり、本再検証のスコープ外。

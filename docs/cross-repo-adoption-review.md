# 5リポジトリ相互取り込み検証（Cross-Repository Adoption Review）

Agentic AI アプリ開発のベース・学習用リポジトリ 5 本を横断で突き合わせ、**相互に取り込むと
効果のある機能・設計**を洗い出した検証記録。各 repo の `docs/cross-repo-adoption-backlog.md` は
本文書の抜粋であり、根拠は常に本文書を正本とする。

- **検証日**: 2026-09-06
- **対象**: 全 repo `claude/agentic-ai-repo-design-3k8e32` ブランチ時点の作業ツリー
- **スコープ**: 検証文書のみ。コード・テスト・CI・依存定義は変更していない。
- **反映状況（2026-09-08 更新）**: 本 repo（`vaz-agentic-ai-next`）が §4 / §5 で「実装前に仕様へ反映する」と定めた 4 項目 **X-5 / X-10 / X-13 / X-14** は `specs/001-agentic-ai-core-p0/spec-agenticai-core.md` **v1.7** に反映済み（同 §0.3.1 に反映先の対応表）。P0 の 53 要件は増減していないため `spec.json` の承認は有効なまま。他 4 repo の取り込み状況は各 repo の `docs/cross-repo-adoption-backlog.md` を参照。

## Table of Contents

- [§0 前提・出典・測定方法](#0-前提出典測定方法)
- [§1 横断マトリクス（実測）](#1-横断マトリクス実測)
- [§2 取り込み項目 X-1〜X-16](#2-取り込み項目-x-1x-16)
- [§3 見送るもの（と理由）](#3-見送るものと理由)
- [§4 着地順](#4-着地順)
- [§5 repo 別の取り込み主軸](#5-repo-別の取り込み主軸)
- [§6 追記（2026-09-21）— 同一性の崩壊と再実測](#6-追記2026-09-21--同一性の崩壊と再実測)
- [§7 追記（2026-09-22）— 全 5 repo 実クローン再検証](#7-追記2026-09-22--全-5-repo-実クローン再検証)
- [§8 追記（2026-09-23）— spec `007-cross-repo-adoption-closeout` による着地](#8-追記2026-09-23--spec-007-cross-repo-adoption-closeout-による着地)

---

## §0 前提・出典・測定方法

### 対象 5 リポジトリ

| repo | 性格 |
|---|---|
| `beeai-agentic-ai-sandbox` | BeeAI Framework 学習モノレポ。4 段ラダー（`examples/` → `patterns/` → `effective_agents/` → `apps/`）＋ FastAPI バックエンド＋ React フロントエンド |
| `pydantic-ai-sandbox` | Pydantic AI リファレンス実装。root app ＋ 8 個の独立 uv レーン（contracts / rag / sse / deep-research / hitl / フレームワーク 3 種） |
| `fastapi-pydantic-ai-agent` | 本番指向 FastAPI アプリ（chat / SSE / Corrective RAG / ガードレール） |
| `vaz-ai-next` | 本番指向 Next.js 16 ＋ AI SDK 7 ＋ Inngest（durable workflow）＋ Python sidecar |
| `vaz-agentic-ai-next` | **本 repo**。上 2 者を取り込む収束先。現在は仕様のみ（1 コミット、P0 未着手） |

### 出典の扱い（重要）

依頼で指定された 3 出典 — Anthropic [A1] *Building Effective Agents*、[A9] *How we built our
multi-agent research system*、IBM [I8] *What is Agentic AI?* — は、**本セッションの
ネットワークポリシーで本文を直接取得できなかった**（`anthropic.com` / `ibm.com` とも
egress ブロック）。

ただし `vaz-ai-next/docs/agentic-engineering-review.md` §1 が、**同じ 3 出典を含む
Anthropic 9 件・IBM 8 件の一次情報レビュー**を 2026-07-16 に実施済みであり、
`[A1]`〜`[A9]` / `[I1]`〜`[I8]` の ID 体系と、8 手法（PE / CE / LE / HE / AE / AO / MCP / EV）の
検証済みベストプラクティス定義（PE-1〜EV-6）を確立している。同レビュー自身も同じ egress 制約下で
書かれている（同 §冒頭に明記）。

**本文書はその定義を再導出せず、正本として参照する。** 以降で `[A1]` `[LE-2]` などの ID が
出てきた場合、定義は `vaz-ai-next/docs/agentic-engineering-review.md` §1 にある。
本文書の付加価値は、そこで**単一 repo に対して行われた評価を 5 repo 横断に広げた**点にある。

### 測定方法（再検証可能性）

§1 の数値は以下のコマンドで得た。憲章 principle 8（事実は測定で決める）に従い、
主張が測定と食い違った場合は測定で置き換えること。

```bash
# GitHub Actions の uses: 総数と SHA 固定数
grep -rh 'uses:' <repo>/.github/workflows/ | wc -l
grep -rhE 'uses:[^@]+@[0-9a-f]{40}' <repo>/.github/workflows/ | wc -l

# permissions: 宣言のあるワークフロー数
grep -rc 'permissions:' <repo>/.github/workflows/
```

引用したファイルの行数は `wc -l` で確認済み（§2 に併記）。設計上の主張は
CLAUDE.md / AGENTS.md の記述ではなく**実ファイルを開いて**裏取りしている。

---

## §1 横断マトリクス（実測）

| 観点 | beeai-sandbox | pydantic-ai-sandbox | fastapi-pydantic-ai-agent | vaz-ai-next | vaz-agentic-ai-next |
|---|---|---|---|---|---|
| 言語 / FW | Python / beeai-framework | Python / pydantic-ai v2 | Python / pydantic-ai v2 | TS / AI SDK 7 | 両方（予定） |
| [A1] 6 パターン | 全 6 ＋ `research_system.py` | 全 6 × 3 FW ＋ 契約ドリフト検証 | なし | orchestrator-workers のみ | 仕様のみ |
| Actions SHA 固定 | **0 / 18** | 5 / 31 | **5 / 5** | **0 / 22** | — |
| workflow `permissions:` | 2 / 2 | 6 / 6 | 2 / 2 | **0 / 6** | — |
| リポジトリガードテスト | **0** | 6 ファイル | **17 ファイル** | **0**（TS 側） | T-5.5 で移植予定 |
| ネットワーク遮断ユニットテスト | **なし** | 3 レーン | あり | なし（モデル注入のみ） | 予定 |
| 空振り検知（anti-false-green） | **なし** | `pytest_live_guard`（パッケージ化） | `EXPECT_LIVE_TESTS` | **なし** | REQ-7.5 / 7.6（shell） |
| eval 基盤 | **なし**（文書のみ） | `Judge` Protocol 契約 | golden ＋ 2 軸 grader | **3 層 ＋ PR ゲート** | 予定 |
| ガードレール停止理由 | なし | 5 値 | 5 値 | 4 値（**別語彙**） | 両方を抱える |
| HITL | `input()` のみ | v2 deferred tools ＋ consume-once | `approval_hook` | 2 ゲート ＋ Inngest（**未配線**） | P4 |
| 可観測性 | examples のみ（アプリ内 0） | レーン毎 OTel | Logfire ＋ JSON 構造化ログ | OTel ＋ `agentops.md` | P1 |
| OWASP 対応表 | なし | Agentic AI Top 10 ＋ LLM Top 10 | LLM Top 10（全 10 行に実装引用） | **なし** | **なし** |
| Dependabot | **なし** | あり | あり | **なし** | — |
| E2E の CI レーン | **なし**（spec は 10 本ある） | 手動 dispatch | — | **なし**（pre-push のみ） | 要追加 |
| `AGENTS.md` / `CLAUDE.md` | **皆無** | **gitignore 対象** | あり（ペア編集規約あり） | あり | あり（ペア編集規約あり） |
| MCP | なし | なし | なし | ADR のみ | ADR 参照 |

**読み取り**: 太字はその観点での欠落または突出。「リポジトリガードテスト」は各 repo が自ら repo ガードと位置づけるファイルの実数（fastapi は `CLAUDE.md` の "Repo guards" 節が列挙する 17 件、pydantic-ai-sandbox は `test_ci_usage_policy` / `test_no_hardcoded_model_ids` / `test_ollama_ci_workflows` / `test_watsonx_ci_workflow` / `test_security_workflow_lanes` / `test_contract_drift` の 6 件）。5 repo は「本番指向 2・学習指向 2・収束先 1」に
分かれるが、**欠落は性格で説明できない**。SHA 固定は本番指向の `vaz-ai-next` に無く学習指向の
`pydantic-ai-sandbox` に部分的にあり、6 パターン実装は学習指向 2 本にしか無い。
つまり多くの差は設計判断ではなく**単に横展開されていない**。

---

## §2 取り込み項目 X-1〜X-16

工数目安: S（半日以下）/ M（1〜2 日）/ L（3 日以上）。

### P0 — 機械的・低リスク・横展開の効果が最大

#### X-1 Actions SHA 固定 ＋ `permissions:` ＋ それを守らせるガードテスト（工数 S）

- **owner**: `fastapi-pydantic-ai-agent/tests/unit/test_ci_workflows.py`（224 行）。
  ワークフロー YAML を静的パースし、`_FULL_SHA_PIN_RE = re.compile(r"^[^@]+@[0-9a-f]{40}$")` で
  全 `uses:` を検証する。PyYAML が `on:` を真偽値 `True` にする既知の癖まで
  `_load_workflow()` で吸収済み。
- **targets**: `beeai-agentic-ai-sandbox`（0/18）、`pydantic-ai-sandbox`（5/31）、
  `vaz-ai-next`（0/22 かつ `permissions:` 0/6）。
- **根拠 [A1]/AE-3**: 機械的ゲートで「人間のレビューが最後の砦」になるのを避ける。
  タグ固定は上書き可能なため、サプライチェーン上は SHA 固定と等価ではない。
- **移植時の必須追加**: 「走査したワークフローファイル数 > 0」アサート。
  対象が存在しないガードは常に緑になる（`vaz-agentic-ai-next/AGENTS.md` が
  「A check whose target does not exist yet always passes」として一般則を明記済み）。
- **注記**: `vaz-agentic-ai-next` は T-5.5 でこのテストの移植を既に計画済み。
  本項目は**その計画の妥当性を横断的に裏書きする**位置づけであり、新規の要求ではない。
  `beeai-agentic-ai-sandbox` は `.pre-commit-config.yaml` では gitleaks を
  `rev: v8.30.0` に固定しているのに CI 側は全てタグ — 同一 repo 内で規律が非対称。

#### X-2 ネットワーク遮断ユニットテスト（工数 S）

- **owner（基本形）**: `fastapi-pydantic-ai-agent/tests/support/hermetic.py`（47 行）。
  `socket.socket.connect` を差し替え、`AF_INET`/`AF_INET6` のみ `NetworkBlockedError` にし、
  `AF_UNIX`（asyncio の self-pipe）は素通しする。`tests/unit/` に autouse で適用。
- **owner（上位互換）**: `pydantic-ai-sandbox/patterns/deep-research/tests/unit/conftest.py`。
  `connect` に加えて **`connect_ex` と `socket.getaddrinfo` も塞ぐ**（L48-49）。
  DNS 解決だけ通ってしまう穴を閉じている。
- **相互取り込み**: fastapi は `connect_ex` / `getaddrinfo` を取り込む。
  pydantic-ai-sandbox は fastapi の「ガードが空振りでないことを証明するテスト」の形を取り込む。
- **targets**: `beeai-agentic-ai-sandbox` は**遮断機構が皆無**で、隔離は手書きの
  `unittest.mock` のみ（`pytest-socket` / `respx` / `httpx_mock` いずれも不在）。新規導入。
  `vaz-ai-next` は `MockLanguageModelV4` 注入で実質ネットワークに出ないが、
  **構造的な保証は無い** — vitest setup で `fetch` / undici を落とす TS 版を新設する。
- **根拠 [A1]**: モックの取りこぼしは静かな失敗になる。構造的に落とせば即座に大声で失敗する。

#### X-3 空振り検知（anti-false-green）の共通原則化（工数 S）

同じ原則の**独立した 3 実装**が既に存在する。実装を統一する必要はないが、原則の明文化が無い。

| 実装 | 形 |
|---|---|
| `pydantic-ai-sandbox/patterns/contracts/src/patterns_contracts/pytest_live_guard.py`（62 行） | pytest プラグイン。`EXPECT_LIVE_TESTS=n` 未満の実行を hard fail。**未設定時は完全に不活性**なので誤検知しない。各レーンは 1 行の `conftest.py` で再エクスポート |
| `fastapi-pydantic-ai-agent` の `EXPECT_LIVE_TESTS` | 同等機能を `tests/support/` に内製。`tests/unit/test_expect_live_tests_plugin.py` が守る |
| `vaz-agentic-ai-next` REQ-7.5 / 7.6（`scripts/check-python-tasks.sh` / `check-ts-lanes.sh`） | shell 実装。**「タスク数」でなく「`uv run` で始まる解決済みコマンド ≥1」を数える** — `turbo run typecheck --filter=agent-api` が `<NONEXISTENT>` 2 件を返す罠まで既に潰してある |

- **提案**: 「**すべてのゲートは非空アサートを持つ**（走査ファイル数 > 0 / 収集テスト数 > 0 /
  解決済みコマンド ≥ 1）」を憲章級の共通原則として 1 度だけ明文化し、各 repo は実装を指す。
- **targets**: `beeai-agentic-ai-sandbox`（`smoke_test_examples.py` は `ModuleNotFoundError` を
  SKIP 扱いするため、依存が全て消えても緑になりうる）、`vaz-ai-next`（Playwright レーン）。

#### X-4 エージェント契約ファイルの不在／追跡外（工数 S、優先度は beeai で最高）

- **`beeai-agentic-ai-sandbox`**: `AGENTS.md` も `CLAUDE.md` も `.claude/` も**皆無**。
  git 履歴 10 コミットが全てエージェント作である repo としては最も目立つ構造的欠落。
  機能的代替は `CONTRIBUTING.md`（言語ポリシー・コマンド・コミット規約）と 4 つの `README.md`。
- **`pydantic-ai-sandbox`**: `.gitignore:222-228` が `CLAUDE.md` と `.sdd/` を除外 →
  **クローン直後のツリーにエージェント契約が存在しない**。同 repo はこれを自覚しており、
  強制可能な部分をテストへ実体化する（`test_no_hardcoded_model_ids.py` など）ことで補っている
  — これは優れた判断であり、そのまま維持すべき。ただしテストは「なぜそうするか」を伝えられない。
- **前例（そのまま使える）**: `vaz-agentic-ai-next` は同じ問題を
  「`.sdd/` は ignore のまま、**必要なものだけ `specs/memory/constitution.md` へ移して追跡下に置く**」で
  解決済み。`CLAUDE.md` にその判断理由まで記録されている。
- **提案**: beeai は `AGENTS.md` / `CLAUDE.md` を新規作成。pydantic-ai-sandbox は
  テスト化された規約はそのままに、**テストが表現できない "なぜ" だけを載せた最小の `AGENTS.md`** を
  追跡下に置く。
- **根拠 [C1]/AE-2**: エージェント向けコンテキストファイルを整備し実態と乖離させない。

---

### P1 — 設計資産の相互補完

#### X-5 停止理由（stop reason）語彙の写像表（工数 S・**統一はしない**）

閉じた語彙 [LE-2] という原則は 3 repo が独立に採用しているが、**語彙が 2 種類に割れている**。

| 実装 | 語彙 | 由来 |
|---|---|---|
| `fastapi-pydantic-ai-agent/app/agents/guardrails.py:40` | `completed` / `max_iterations` / `budget_exceeded` / `denied` / `disallowed_tool` | **ガードレール由来**。どのゲートが止めたかを記録する。拒否理由を含む |
| `pydantic-ai-sandbox/patterns/contracts/src/patterns_contracts/autonomous_agent.py` | 同上 5 値 | 同上。両者は**独立に同じ 5 値へ到達**している |
| `vaz-ai-next/packages/schemas/src/run-metrics.ts:16` | `natural` / `step-cap` / `budget-exceeded` / `error` | **ループ由来**。拒否は承認ポリシー側の別経路で扱われ、この語彙には現れない |

**写像案**:

| Python 5 値 | TS 4 値 | 備考 |
|---|---|---|
| `completed` | `natural` | 一致 |
| `max_iterations` | `step-cap` | 一致（名前のみ相違） |
| `budget_exceeded` | `budget-exceeded` | 一致（区切り文字のみ相違） |
| `denied` | — | TS 側に対応無し。承認拒否は `ApprovalDeniedError` 経路 |
| `disallowed_tool` | — | TS 側に対応無し。allow-list 違反は例外経路 |
| — | `error` | Python 側に対応無し。例外は `StopReason` に載らない |

- **なぜ今回統一しないか**: TS 側の 4 値は SSE 契約（`JobEvent`）と `audit_log` テーブルに
  既に出ており、語彙変更は後方互換の設計判断を伴う。写像表を先に固定し、
  **両方を抱える `vaz-agentic-ai-next`**（TS の `/api/chat` と Python の `/v1/chat`）の
  設計判断材料にする。統一 ADR の起案は別スコープ。
- **設計上の含意**: 5 値側は「なぜ止まったか」が監査ログ単独で完結する。4 値側は
  `error` の内訳を別経路と突き合わせないと分からない。**vaz-agentic-ai-next は
  Python 側で 5 値を採るため、TS 側の 4 値と並記した時に監査の粒度が非対称になる** —
  これは P1（Logfire 計装）の属性設計より前に決めておく必要がある。

#### X-6 ツール設計 — 規約と実装が別 repo に分かれている（工数 S、相補ペア）

- **`fastapi-pydantic-ai-agent` が持つもの**: `docs/tool-design-conventions.md`（144 行）—
  `<resource>_<verb>` 命名 / `next_offset` ページング / `response_format: concise|detailed` /
  寛容な引数パース の 4 規約と、その **enforcement**（`.pre-commit-config.yaml` の
  `real-tool-conventions-guard` が、`app/agents/` に非モックの `@agent.tool` が現れた瞬間に発火して
  コミットをブロックする reminder-and-block スタブ）。**ただし実ツールは 0 件**
  （文書冒頭に `Status: deferred` と自ら明記）。
- **`pydantic-ai-sandbox` が持つもの**: 実装 —
  `patterns/frameworks/pydantic-ai/src/patterns_pydantic_ai/tool_design.py`（215 行）。
  `directory_search` / `directory_get`、`_DEFAULT_LIMIT: Final = 5` / `_MAX_LIMIT: Final = 25` /
  `_DETAIL_NOTE_CHARS: Final = 80`、`next_offset` は最終ページで `None`、
  `_coerce_format()` による寛容なパース、`_clamp_int()` による上限クランプ。テスト付き。
  規範文書は `docs/tool-design.md`（110 行）。
- **提案（双方向）**: fastapi は `tool_design.py` を初の実ツールの雛形として取り込む
  （スタブが発火したときに参照する実物になる）。pydantic-ai-sandbox は fastapi の
  「寛容なパース」節の**具体的な許容範囲リスト**（大文字小文字・前後空白・数値文字列・
  単一要素とリストの相互）を `docs/tool-design.md` に取り込む。
- **併せて新規起票**: 「1 エージェント ≤ 20 ツール」の機械チェックは
  `vaz-agentic-ai-next/specs/memory/constitution.md` に原則としてあるだけで、
  **どの repo も実装していない**。`tool-count-check` として CI に載せる。
  - **訂正（2026-09-08）**: `vaz-agentic-ai-next` については「原則のみ」ではない。
    `spec-agenticai-core.md` §4.2.1 が CI での機械検証を規約として要求し、§10.2 の CI ジョブ表が
    `tool-count-check` をブロッキングジョブとして掲げている。正しくは**仕様化済み・未実装**。
    他 4 repo については本項の記述のとおり。
- **根拠 [A4]/PE-5/MCP-2**: ツールの description はプロンプトであり、
  人間が即答できないツール群はエージェントにも選べない。

#### X-7 コンテキスト管理の三脚（工数 M）

3 repo が**互いに欠けている脚**を 1 本ずつ持っている。競合ではない。

| 脚 | owner | 内容 |
|---|---|---|
| 機械的トリム | `fastapi-pydantic-ai-agent/app/stores/session_store/_trim.py`（78 行） | メッセージ境界でのみ切る／`BaseToolReturnPart` の親 `BaseToolCallPart` を孤児化しない（理想の切点から**前方**探索し、より多く落とす方向へ進む＝空の tail が必ず解を保証する）／`messages[0]`（永続 system prompt）は必ず残す（結果が `max_messages + 1` になりうる理由）。**最も厳密** |
| 段階導入の設計 | `vaz-ai-next/docs/context-budget.md`（146 行） | Stage 0（全履歴＋停止述語）→ Stage 1（`prepareStep` 窓化シーム、**未指定時 byte 等価**）→ Stage 2（自動 compaction）。`stopWhen` 配列の OR 意味論と、`totalTokens` が reasoning を含みうるため `inputTokens + outputTokens` を自前合算する理由まで記録 |
| 外部メモ | `pydantic-ai-sandbox/patterns/deep-research/src/patterns_deep_research/notes.py` | 構造化ノートテイキング ＋ `compact_digest` ＋ `digest_fn` DI シーム。`ResearchNote` を共有契約へ昇格させ `Finding.notes` に載せている |

- **提案**: vaz-ai-next の Stage 1 と pydantic-ai-sandbox の compaction は、**どちらも実装時に
  fastapi の `trim_history` 不変条件を必要とする**（tool-call ペアを割ると次ターンで
  モデル側がエラーになる）。先に `_trim.py` の不変条件を共通文書化する。
  `beeai-agentic-ai-sandbox` は BeeAI の `TokenMemory` / `SummarizeMemory` を
  `effective_agents/README.md` で紹介するに留まり、アプリ側（`memory_service.py`）に
  トリム方針が無い — 三脚のいずれも未導入。
- **根拠 [A2]/CE-1〜CE-3**: attention budget は有限で、コンテキストが伸びるほど劣化する。

#### X-8 評価基盤（工数 M）

**取り込みやすさで最良**なのは `pydantic-ai-sandbox/patterns/contracts/src/patterns_contracts/eval_graders.py`（93 行）:

- `Rating = Literal["1","2","3","4","5","unknown"]` — **証拠不足を `"unknown"` として
  明示できる**（無理に数値を出させない）。
- `AxisScore` / `GradeReport` で outcome 軸と behavior 軸を分離 [EV-3]。
- `class Judge[SubjectT](Protocol)` — judge をモデルから切り離す DI シーム。
  **決定論フェイク judge でネットワーク不要のユニットテストが書ける**。
- 契約ドリフト検証の対象でもある（`patterns/EVAL-GRADERS.md` が正本）。

**運用として最も成熟**しているのは `vaz-ai-next` の PR ゲート
（`packages/evals/src/pr-gate.ts`）: 直前ベースラインとの pass-rate delta ／
新規に regress / un-regress した case の over-under-trigger balance ／
case あたり平均トークン数・所要時間 ／ **golden set が 20 件未満なら `reportOnly`**。
ベースラインは Actions cache（`pr-gate-baseline-*`）で運搬。

- **targets**:
  - `beeai-agentic-ai-sandbox`: **eval が皆無**。`docs/AGENTIC_AI_ja.md` §6 が
    「20 件程度から始める・ルーブリックで LLM-as-judge・人間レビュー」という
    **あるべき形を正確に書いているのに、実行可能な harness が無い**。
    `eval_graders` 契約 ＋ fastapi の `evals/runner.py`（非ゼロ終了）の組で埋める。
  - `fastapi-pydantic-ai-agent`: 2 軸 grader はあるが `Judge` Protocol シームが無い。
    PR ゲートも無く、evals は pre-push のみ。
  - `pydantic-ai-sandbox`: 契約はあるが運用（ベースライン比較）が無い。
- **根拠 [A5]/EV-1〜EV-5**。

#### X-9 HITL — 重ならない防御を持つ 2 実装（工数 M）

| repo | 持っている防御 |
|---|---|
| `pydantic-ai-sandbox/patterns/hitl/` | pydantic-ai v2 の公式 deferred tools（`ApprovalRequired` → `DeferredToolRequests` → `ToolApproved`/`ToolDenied` → resume）／**`/run`・`/resume` のリクエストモデルが `extra="forbid"` で `message_history` フィールドを持たない** ＝ クライアントは履歴を注入できず、サーバ側 `record.history` が正（spec 013 R4.1/R4.3、CVE-2026-25580 の注入経路を構造的に封鎖）／consume-once ステートマシン（保留ラウンドごとに 1 回だけ claim 可能、終了後は恒久的に resume 不可）／マスク済み監査 `audit.py` |
| `vaz-ai-next` | `needsApproval` ＋ `RECIPIENT_ALLOWLIST` の**独立 2 ゲート**（どちらも他方の代替にならない）／sticky taint（RAG 結果が注入されたら run 終端まで `externallyDriven` が latch し、デリミタがコンテキストから消えても承認ゲートが緩まない）／Inngest による**ワーカー再起動を跨ぐ** suspend/resume（`WorkflowStepRunner` seam でエンジン非依存） |

- **ただし `vaz-ai-next@bbf1156` 時点で未配線**: `createEmailCapability`（唯一の
  `needsApproval=true` ツール）がどのエージェントにも登録されていない／`Chat.tsx` に
  `addToolApprovalResponse` が無い／`apps/worker` の述語が `requiresApprovalForKind: () => false`。
  **契約はあるが動いていない**状態であり、`vaz-agentic-ai-next` の P4 はこの配線から始まる。
- **提案（双方向）**: pydantic-ai-sandbox は 2 ゲート原則と sticky taint を取り込む。
  vaz-ai-next / fastapi は「サーバ側履歴が正」の構造的封鎖を取り込む
  （fastapi は HMAC セッション所有権で**別の**攻撃面を塞いでいるが、履歴注入は別問題）。
  pydantic-ai-sandbox の in-memory store（TTL / 永続化はスコープ外と明記）は
  vaz-ai-next の durable engine 設計を参照先として持つべき。
- **`beeai-agentic-ai-sandbox`**: `effective_agents/autonomous_agent.py` の
  `build_save_report_tool` が `input()` でブロッキング承認する。docstring 自身が
  「イベントループを塞ぐ／実システムは承認待ち状態を外部化する必要がある」と限界を明記している
  — 置換候補として最も分かりやすい教材。
- **根拠 [A1]/LE-4、憲章「承認ゲートは不可逆・高リスク操作にのみ」**。
  承認ダイアログを増やすほどユーザは読まずに承認する（実測 93%）ため、**取り込みは
  ゲートを増やす方向ではなく「既存ゲートを構造的に迂回不能にする」方向**であることに注意。

#### X-10 SSE ライフサイクルの 3 つの罠（工数 S、文書化のみでも価値大）

`fastapi-pydantic-ai-agent` が最も高い代償を払って得た知見。いずれも**再発見にコストがかかる**。

1. **anyio cancel scope のタスク跨ぎ** — `Agent.iter()` は yield を跨いで cancel scope を保持する。
   `__anext__()` を毎回新しい `asyncio.wait_for()` から駆動すると
   `Attempted to exit cancel scope in a different task` になる。
   → 単一の永続 `_drive_to_queue` タスクで最後まで駆動し `asyncio.Queue` で受け渡す
   （`app/api/v1/_stream.py:237-304`、理由が同ファイルのコメントに残っている）。
2. **ハートビートは `asyncio.wait()`** — `asyncio.wait_for()` は進行中のイベントを
   キャンセルしてしまう（`app/api/v1/agent.py:159,175`）。
3. **`str.splitlines()` を使わない** — pydantic は JSON 中の U+2028 / U+2029 を
   エスケープせずに残し、`str.splitlines()` はそれらを行境界として扱う。
   → 実 SSE 終端子（`\r\n` / `\r` / `\n`）のみで分割する `parse_sse_events()`
   （`app/patterns/sse.py:6,103`）。

- **targets**: `pydantic-ai-sandbox/patterns/sse` レーン（同じ 5 イベント判別共用体を持つが、
  この 3 点の記録が無い）、**`vaz-agentic-ai-next` の P3 受け入れ条件**
  （`/v1/chat` は Vercel AI Data Stream Protocol / SSE で、まさに同じ経路を通る）。
- **補足**: `vaz-agentic-ai-next/AGENTS.md` には既に 1. と 2. が記載済み。
  3.（U+2028）は**未記載** — 追記すべき。

---

### P2 — 文書・運用規律

#### X-11 境界契約ドリフト検知 — 4 変種を 1 パターンに束ねる（工数 S）

同じ原則（「単一の正 → コミット済み生成物 → ドリフトテスト」）の 4 つの別実装がある。

| 変種 | owner | 検知するもの |
|---|---|---|
| code → code | `vaz-ai-next`（`openapi:gen` → `packages/schemas/src/generated/`） | 型の欠落・不一致を `satisfies z.ZodType<Generated>` で、**余剰フィールド**を JSON-Schema 形状比較で。**`satisfies` は余剰を捕まえないので両脚必要**（AGENTS.md に明記） |
| code → code（CI 側） | `beeai-agentic-ai-sandbox/.github/workflows/ci.yml` の `schema-drift` ジョブ | OpenAPI 再エクスポート → クライアント再生成 → `git diff --exit-code`。**失敗時の `::error::` に「実行すべきコマンド」を書く** |
| **doc → code** | `pydantic-ai-sandbox/patterns/contracts/tests/unit/test_contract_drift.py`（287 行） | 11 個の正本 README の `## パターン契約` フェンスブロックを **AST パース**し、クラス集合・フィールド集合・`Literal` 語彙が runtime introspection と一致するか。「各モデルはちょうど 1 つの README に記載」も検査 |
| doc → code（一方向） | `fastapi-pydantic-ai-agent/tests/unit/test_contract_drift.py` | README の規範フェンスが**もう存在しないクラス／フィールドを見せていない**こと。省略は許すが死んだ記述は許さない |

- **即移植可**: beeai の「エラーメッセージに直し方を書く」は全 repo へ。修正コマンドが
  無いドリフト検知は、失敗を見た人が毎回リポジトリを探すことになる。
- **最大の空白**: `beeai-agentic-ai-sandbox/effective_agents/README.md` の
  **記事用語 → BeeAI API 対応表**と `patterns/README.md` の **LangGraph → BeeAI 翻訳表**は、
  この repo で最も価値のある教材でありながら**無検証の散文**である。
  pydantic-ai-sandbox の doc↔code AST 比較がそのまま適用できる対象。

#### X-12 セキュリティ運用 — 3 系統は矛盾ではなく強度差（工数 S）

| repo | 方針 |
|---|---|
| `beeai-agentic-ai-sandbox/SECURITY-NOTES.md` | **`--ignore-vuln` を使わない**。「抑止は安全性を証明しない」として、修正が無い advisory は到達可能性分析 ＋ 再評価トリガを書いて**受容**する（`nltk` PYSEC-2026-3740、`unstructured` CVE-2026-71428 の 2 件）。**最も厳格** |
| `pydantic-ai-sandbox/patterns/SECURITY-NOTES.md` | `--ignore-vuln` を許すが、**日付付きレビュー期限 ＋ 追跡参照を必須**（R8.2）。`mise.toml` の `patterns:audit` に期限がインラインで書かれている |
| `fastapi-pydantic-ai-agent` | `--ignore-vuln` ＋ **1 件ごとの到達可能性理由**（starlette ×5 / chromadb ×3 / nltk ×1）。CLAUDE.md に各群の判断根拠が長文で残る |

- **提案**: 3 者は矛盾ではなく**強度の階段**（受容のみ ＜ 期限付き抑止 ＜ 理由付き抑止）。
  1 つの方針表に統合し、**各 repo がどの段を採るかを明示**する（暗黙の分岐をやめる）。
- **併せて取り込むべき書き方**: beeai は「日次スキャンは `--extra rag` を含まないので
  上記 2 件は**日次スキャンの対象外**」と、自分の防御の穴を正直に宣言している。
  この書き方を他 repo も真似すべき（`vaz-agentic-ai-next` の憲章 principle 8 と同じ精神）。
- **注意**: `fastapi-pydantic-ai-agent/CLAUDE.md` は
  「シェルの行継続 `\` が 1 つ落ちると ignore リストが黙って切り詰められる」罠を記録している。
  抑止リストを持つ全 repo に効く警告。

#### X-13 OWASP 対応表の統合（工数 S）

| repo | 表 |
|---|---|
| `fastapi-pydantic-ai-agent/docs/owasp-agentic-llm-mapping.md`（43 行） | **LLM Top 10 (2025)** 全 10 行。各行に「Mitigated / Partial・accepted / Accepted」の状態、実装モジュール、**テストファイル**を引用 — 散文でなく検証可能な主張になっている |
| `pydantic-ai-sandbox/patterns/SECURITY-NOTES.md` | **Agentic AI Top 10 (2025-12)** ＋ LLM Top 10 をレイヤ別（autonomous-agent / RAG / SSE / deep-research / HITL）に。CVE floor 表と no-fix advisory ランブック付き |
| `vaz-ai-next` / `vaz-agentic-ai-next` | **皆無** |

- **提案**: 2 つの表は対象タクソノミが異なり**重複しない**（LLM Top 10 は
  agentic 自律性リスクを LLM06 Excessive Agency に畳んでいる。Agentic AI Top 10 は展開する）。
  両方を持つ 1 枚に統合し、`vaz-agentic-ai-next` へ導入する。fastapi の
  「各行にテストを引用する」形式を採ること — これが無いと表は主張のリストに退化する。

#### X-14 E2E が CI に無い — beeai と vaz-ai-next で同一の欠陥（工数 M）

- **`beeai-agentic-ai-sandbox`**: Playwright spec が 10 本（`00-smoke` 〜 `09-accessibility`、
  page-object ＋ fixture ＋ `@axe-core/playwright` による a11y 検査）あるのに、
  `ci.yml` のヘッダコメントが約束する `.github/workflows/e2e.yml` は**存在しない**。
  つまり**書かれた E2E が 1 度も CI で走っていない**。
- **`vaz-ai-next`**: pre-push フックのみ。`--no-verify` で素通りし CI の安全網が無い。
  同 repo の `AGENTS.md` 自身が §12 R10 との矛盾として記載している。
- **相互取り込み**: **beeai の a11y spec（`@axe-core/playwright`）は `vaz-ai-next` に無い資産**。
  Carbon Design System を使う `apps/web` にこそ効く。逆に vaz-ai-next の
  `playwright.config.ts` の `webServer` 構成（`--filter` でスコープする形）は beeai が
  E2E ワークフローを新設する際の雛形になる。
- **注記**: `vaz-agentic-ai-next/AGENTS.md` の「P3 の前に Ollama 非依存の E2E CI レーンを追加」は
  この一般則の具体化であり、独立した要求ではない。
  `/v1/chat` は型パイプラインの外にあるため **E2E が唯一の回帰検知手段**（§7.4）。

#### X-15 Dependabot 不在（工数 S）

`beeai-agentic-ai-sandbox` と `vaz-ai-next` に `.github/dependabot.yml` が無い。
両者とも日次の脆弱性 cron は持っているので、**検知はするが更新提案は来ない**状態。

- **雛形**: `fastapi-pydantic-ai-agent/.github/dependabot.yml` の `ignore:` 設計。特に
  **`fastapi` は minor も major も無視する**理由が重要 — Dependabot は 0.x を patch 位置で
  分類するため `0.136 → 0.137` を *minor* と見なす。major だけ無視すると
  レートリミットを壊す bump が素通りする。存在保証は `tests/unit/test_dependabot_config.py`。
- **併せて**: `pydantic-ai-sandbox/.github/dependabot.yml` の複数 `directories` 設定
  （8 レーンのうち 4 レーンを登録し、残りは日次 pip-audit で覆う — **その空白も文書化済み**）は、
  モノレポで全レーンを登録しきれない場合の書き方の見本。

#### X-16 学習ラダーと教材資産の相互参照（工数 M）

本番指向 2 repo（fastapi / vaz-ai-next）は [A1] の 6 パターンを**参照できる場所を持たない**。
学習指向 2 repo は逆に、本番で必要になる規律を持たない。以下は片方にしか無い教材資産。

**`beeai-agentic-ai-sandbox` だけが持つもの**:
- 4 段ラダー（`examples/` = フレームワーク API → `patterns/` = 書籍のデザインパターン →
  `effective_agents/` = [A1] の構成要素 → `apps/` = 動くアプリ）という**学習順序の設計**。
- `patterns/README.md` の **LangGraph → BeeAI 翻訳表** と「意図的に変えた意味論」節
  （reducer 無し／checkpointer・`interrupt` 相当無し／sync → async）。
  移植で**何を諦めたか**を明示する書き方は他 repo に無い。
- `effective_agents/README.md` の**記事用語 → フレームワーク API 対応表**と、
  ディレクトリ判別表（「どれを読むべきか」）。
- `effective_agents/research_system.py:240` の `_print_usage()` — 段別トークン内訳を印字し、
  **[A9] の ~15× というコストを体感させる**。憲章 §5.1 の多エージェント採用ゲート
  （3 条件のうち「~15× のトークンコストに見合うか」）を教える最短の道具。
- `docs/DEPLOYMENT.md` の**存在しないインフラを書かない宣言**（旧版が ECS/Lambda/Azure/GCP/
  systemd/nginx/Prometheus/ELK の手順を、対応する成果物なしに書いていたことを記録した上で削除）。

**`pydantic-ai-sandbox` だけが持つもの**:
- `patterns_contracts` — **フレームワーク非依存の型契約**（依存は `pydantic>=2` のみ）。
  同じ 6 パターンを 3 フレームワークで実装しても契約は 1 つ、という構造。
- 正本 README ↔ ランタイムの AST ドリフト検証（X-11）。
- `patterns/deep-research/COMPARISON.md` — LangGraph / CrewAI / Microsoft Agent Framework /
  LlamaIndex / BeeAI / Langflow / Dify の比較と多エージェントのトークンコスト節。

- **提案（双方向）**: beeai の 3 ディレクトリ（`examples` / `patterns` / `effective_agents`）は
  現在 `smoke_test_examples.py`（import できるかだけ）で横断的に縛られている。
  `patterns_contracts` 相当の型契約を入れれば、**同じ 6 パターンが 2 フレームワークで
  同じ契約を満たす**ことを機械検証できる。逆に pydantic-ai-sandbox の 3 フレームワークレーンと
  deep-research は、beeai の翻訳表・対応表・`_print_usage()` を取り込める。
- **本番 2 repo 側**: 6 パターンを実装する必要はない。`vaz-agentic-ai-next` の
  P8（多エージェント）は憲章 §5.1 のゲートを通った場合のみ着手する設計なので、
  **ゲート判断のための材料**（`_print_usage()` のコスト実測、`COMPARISON.md`）へのリンクを持てばよい。

---

## §3 見送るもの（と理由）

| 項目 | 判断 |
|---|---|
| **MCP の実装** | 5 repo すべて未実装。存在する資産は `vaz-ai-next/docs/adr/0001-mcp-position.md`（不採用の理由 ＋ 採用トリガ条件 ＋ `needsApproval` ↔ MCP `destructiveHint` の写像方針 ＋ サーバの供給網審査）**だけ**。[MCP-1] は「単一アプリ・少数ツールなら in-process で足りる」であり、現状 5 repo はすべてその側にいる。→ **実装ではなくこの ADR を横展開する** |
| 停止理由語彙の強制統一 | 今回は写像表まで（X-5）。SSE 契約と監査ログの後方互換に影響するため別スコープ |
| beeai frontend の他 repo への移植 | 責務外。ただし a11y spec だけは X-14 で個別に扱う |
| `.sdd/` の un-ignore | `vaz-agentic-ai-next` が既に「必要なものだけ `specs/` へ移す」で解決済み（X-4）。ディレクトリごと追跡下に置く必要は無い |
| 5 repo の統合・集約 | 性格（学習 2・本番 2・収束先 1）が異なり、統合は `vaz-agentic-ai-next` が P0 で行う 2 repo 分に限る。学習用 2 repo は独立を維持する方が [A1] の「小さく合成可能に始める」に合う |

---

## §4 着地順

```
X-1 ─┐
X-2 ─┼─ 独立・即着地（機械的・低リスク）
X-3 ─┘
X-4 ──→ X-16   （契約ファイルが無いと教材の相互参照先を書けない）
X-5 ──→ X-9    （承認拒否が語彙に載るかは HITL 設計に依存）
X-7(fastapi _trim.py の不変条件) ──→ X-7(vaz Stage1 / sandbox compaction)
X-12 ──→ X-13  （抑止方針を決めてから対応表を書く）
X-6 / X-8 / X-10 / X-11 / X-14 / X-15 は独立
```

`vaz-agentic-ai-next` に限っては、X-5・X-10・X-13・X-14 は**実装前に仕様へ反映**する
（P0 の T-1.3 以降に入ってから語彙や受け入れ条件を変えると、traceability マトリクスの
再生成を伴うため）。

---

## §5 repo 別の取り込み主軸

| repo | 主に取り込むもの | 主に出す資産 |
|---|---|---|
| `beeai-agentic-ai-sandbox` | **X-4（最優先）**, X-1, X-2, X-3, X-8, X-14, X-15 | 4 段ラダー、LangGraph→BeeAI 翻訳表、記事用語対応表、`_print_usage()`、`SECURITY-NOTES.md` の非抑止方針、`schema-drift` ジョブ、`DEPLOYMENT.md` の正直さ |
| `pydantic-ai-sandbox` | X-1, X-4, X-8（PR ゲート）, X-9（2 ゲート・sticky taint）, X-10 | `patterns_contracts`、契約ドリフト AST テスト、`pytest_live_guard`、`eval_graders` 契約、`tool_design.py`、hitl の履歴封鎖、Agentic AI Top 10 表、`COMPARISON.md` |
| `fastapi-pydantic-ai-agent` | X-2（`getaddrinfo` 追加）, X-6（実装）, X-8（`Judge` Protocol ＋ PR ゲート）, X-9（サーバ側履歴が正） | `test_ci_workflows.py`、`hermetic.py`、`_trim.py`、SSE ライフサイクル 3 罠、44 個のリポジトリガード、LLM Top 10 表、`dependabot.yml` の `ignore:` 設計、`tool-design-conventions.md` |
| `vaz-ai-next` | **X-1（最優先: SHA 0/22・permissions 0/6）**, X-2（TS 版）, X-13, X-14, X-15 | `agentic-engineering-review.md`（8 手法の一次情報レビュー＝**本文書の土台**）、`context-budget.md`、`agentops.md`、3 層 evals ＋ PR ゲート、MCP ADR、境界契約の 2 脚、Inngest durable HITL |
| `vaz-agentic-ai-next` | X-5（写像表）, X-10（P3 受け入れ条件）, X-13, X-14 — いずれも**実装前に仕様へ反映** | 憲章を追跡下に置く前例（X-4 の解法）、「対象不在のガードは常に緑」の一般則、REQ-7.5/7.6 の非空アサート |

---

## 関連文書

- `vaz-ai-next/docs/agentic-engineering-review.md` — 8 手法（PE/CE/LE/HE/AE/AO/MCP/EV）の
  一次情報レビュー。**本文書が参照する ID 体系の正本**
- `fastapi-pydantic-ai-agent/docs/reference-repo-review.md` — 先行する片方向レビュー（3 repo 対象）
- `fastapi-pydantic-ai-agent/docs/pydantic-ai-sandbox-comparison-review.md` — 先行する 2 repo 比較
- `pydantic-ai-sandbox/specs/best-practices-review/` — IBM/Anthropic/Google/AWS 公式ガイダンスに
  対する自己監査と改善計画
- 各 repo の `docs/cross-repo-adoption-backlog.md` — 本文書の repo 別抜粋

---

## §6 追記（2026-09-21）— 同一性の崩壊と再実測

> **この節の位置づけ**: §1〜§5 の本文は **2026-09-06 時点の測定記録**であり、**改変しない**
> （追記のみ規約。`pydantic-ai-agentic-patterns/CLAUDE.md`「レビュー文書は追記のみで、過去の結果は
> 書き換えない（時点の記録）」を 5 repo 共通規約として適用）。本節は、その後に起きた
> **リポジトリ同一性の変更**と、**再実測により stale となった行**のみを記録する。
> 判断の根拠は `specs/006-repo-consolidation/`。

### §6.1 同一性の崩壊 — 2 つの列が 1 本になった

§0 の対象表および §1 の横断マトリクスは `vaz-ai-next` と `vaz-agentic-ai-next` を
**別々のリポジトリ**として扱い、§5 でそれぞれに別の取り込み主軸を与えている。
2026-09-21 の統合判断により、この 2 者は**単一のリポジトリ**になった。

| 本文中の呼称 | 統合後の実体 | 本文の記述をどう読むか |
|---|---|---|
| `vaz-ai-next` | **ハブ本体** | 実装・CI・依存・テストの実測値はこの列が正。ただし §6.2 の再実測で上書きされる行がある |
| `vaz-agentic-ai-next` | **ハブの仕様層** | 憲章（`specs/memory/constitution.md`）・P0 spec（`specs/inherited/001-agentic-ai-core-p0/`）・REQ-7.5/7.6 の非空アサート。「現在は仕様のみ（1 コミット、P0 未着手）」という §0 の記述は**この時点の main ブランチについては正しい**が、非 main 6 ブランチに約 5,400 行の資産が存在した |

**経緯**: `vaz-agentic-ai-next` は `vaz-ai-next` の後継として作成されたが、着手しないまま前者が
成熟し続けた。そのため**実体（`vaz-ai-next`）を昇格させ、名前（`vaz-agentic-ai-next`）を
そちらへ移す**方針を採った。本文が「収束先」と呼ぶ役割は、ハブ本体が引き継ぐ。

**帰結**: 本文が「`vaz-agentic-ai-next` は X-n を**実装前に仕様へ反映**する」と述べる箇所
（§4 末尾・§5 最終行）は、統合後は**ハブ自身の仕様層に対する要求**として読む。

### §6.2 再実測により stale となった行

§1 の `vaz-ai-next` 列のうち、以下 2 行は 2026-09-21 の再実測で状況が変わっている。
**§1 の当該セルは書き換えない**（点時記録の保全）。

| §1 の観点 | 本文（2026-09-06） | 再実測（2026-09-21） | 判定 |
|---|---|---|---|
| Actions SHA 固定 | **0 / 22** | **28 / 28** | **X-1 着地済み** |
| workflow `permissions:` | **0 / 6** | **6 / 6** | **X-1 着地済み** |

再実測コマンド（§0「測定方法」と同一）:

```bash
grep -rh 'uses:' .github/workflows/ | wc -l                      # → 28
grep -rhE 'uses:[^@]+@[0-9a-f]{40}' .github/workflows/ | wc -l   # → 28
grep -rl 'permissions:' .github/workflows/ | wc -l               # → 6（workflow 総数も 6）
```

したがって §5 の `vaz-ai-next` 行「**X-1（最優先: SHA 0/22・permissions 0/6）**」は
**解消済み**である。同行の残り（X-2 の TS 版・X-13・X-14・X-15）は未着地のまま。

> **この 2 行が示す一般則**: 本文は正確だが**抜粋であり時点の記録**である。
> 判断材料にする前に実クローンで再実測すること（憲章 principle 8「事実は実測で確定する」）。

### §6.3 本追記時点での検証スコープ

本追記は **4 リポジトリ ＋ ハブ**に対する再実測に基づく:
`vaz-ai-next`（= ハブ）/ `fastapi-pydantic-ai-agent` / `pydantic-ai-sandbox` /
`pydantic-ai-agentic-patterns` / `vaz-agentic-ai-next`（退避対象）。

**`beeai-agentic-ai-sandbox` は本追記の検証対象外**（セッションに未 attach）。
§1 の同 repo 列、および §5 が同 repo に対して「**X-4（最優先）**」ほかを求める記述は、
**2026-09-06 時点のまま未検証**である。この申し送りは
`specs/006-repo-consolidation/` R9.3 が引き取る。

### §6.4 規模の再実測（§0 対象表の補強）

| repo | Python LOC | TS/TSX LOC | md |
|---|---:|---:|---:|
| ハブ（旧 `vaz-ai-next`） | 1,657 | 19,517 | 58 |
| `fastapi-pydantic-ai-agent` | 43,592 | 0 | 18 |
| `pydantic-ai-sandbox` | 32,078 | 0 | 123 |
| `pydantic-ai-agentic-patterns` | 14,552 | 0 | 36 |

測定コマンド:

```bash
find . \( -name '*.py' -o -name '*.ts' -o -name '*.tsx' \) \
  -not -path './.git/*' -not -path '*/node_modules/*' -not -path '*/.venv/*' -exec cat {} + | wc -l
```

---

## §7 追記（2026-09-22）— 全 5 repo 実クローン再検証

> **この節の位置づけ**: §1〜§6 は改変しない（追記のみ規約）。本節は、5 リポジトリすべてを
> 実際にクローンして再実測した結果、**§1 の横断マトリクスおよび §5 の取り込み主軸表が
> 前提にしている「対象そのもの」が変わっていた**ことを記録する。§6.2 が示した一般則
> （「本文は正確だが抜粋であり時点の記録である。判断材料にする前に実クローンで再実測すること」）を
> 適用した結果であり、§6.3 が `beeai-agentic-ai-sandbox` について明示的に残した
> 申し送りへの回答でもある。
>
> 実測値・per-repo の詳細・再現コマンドは
> [`specs/review/2026-09-22-cross-repo-verification.md`](../specs/review/2026-09-22-cross-repo-verification.md)。
> 本節は結論と、正本の記述のどこが読み替えを要するかだけを記す。

### §7.1 検証スコープ

**5 repo すべてを実クローンして検証した**（§6.3 が未 attach を理由に対象外としていた
`beeai-agentic-ai-sandbox` を含む）。

| repo | 検証時の最終コミット |
|---|---|
| `fastapi-pydantic-ai-agent` | 2026-09-20 |
| `pydantic-ai-sandbox` | 2026-09-20 |
| `agentic-ai-sandbox` | 2026-06-28（以後停止） |
| `agentic-ai-bootcamp` | 本節で初めて対象化（§0 対象表に無い repo） |
| `beeai-agentic-ai-sandbox` | 2026-01-25（単一コミット） |

### §7.2 `beeai-agentic-ai-sandbox` — §1 の当該列は対象ごと失効した

§6.3 は同 repo を「2026-09-06 時点のまま未検証」として申し送っていた。再検証の結果、
**同 repo は別プロダクトへ全面置換されており、§1 の同 repo 列および §5 の同 repo 行が
引用する資産はほぼ全て現存しない**。

現在の姿は「BeeAI FastAPI React App」（FastAPI ＋ React の chat / RAG / 文書処理アプリ）で、
§0 が記した 4 段ラダー（`examples/` → `patterns/` → `effective_agents/` → `apps/`）は無い。

| §1 / §2 / §5 の記述 | 2026-09-22 の実態 |
|---|---|
| Actions SHA 固定 **0/18**（X-1 の最優先 target） | `.github/` ごと不在。workflow 0 本 — 指摘の前提が消滅 |
| `SECURITY-NOTES.md` の非抑止方針（X-12 で「最も厳格」と評価） | **ファイルが存在しない** |
| `effective_agents/autonomous_agent.py` の `input()` 承認（X-9 の教材） | ディレクトリごと消滅 |
| `patterns/README.md` の LangGraph→BeeAI 翻訳表、記事用語対応表、`_print_usage()`（X-16 の中核） | いずれも消滅 |
| `ci.yml` の `schema-drift` ジョブ（X-11 で「即移植可」と評価） | `ci.yml` ごと消滅 |
| 10 本の Playwright spec が CI で 1 度も走らない（X-14） | **spec は現存**（`00-smoke`〜`09-accessibility`、a11y 込み）。ただし CI 自体が消滅したため状況は悪化 |
| `docs/DEPLOYMENT.md` の「存在しないインフラを書かない宣言」（X-16 で称賛） | **正反対**。Dockerfile も compose も無いまま ECS/Lambda/Cloud Run/K8s/Prometheus/ELK を記した 803 行が存在 |

**帰結**: X-11 / X-14 / X-14b / X-16 が同 repo を出所として挙げる箇所は、**取り込み元として
再利用できない**。いずれも本ハブ側では既に着地済み（§6.2 と `docs/cross-repo-adoption-backlog.md` §3）
のため実害は無く、**出所の記録としてのみ読むこと**。

### §7.3 `pydantic-ai-sandbox` — 「`agentic-ai-sandbox` へ統合済み」は成立しない

`docs/cross-repo-adoption-backlog.md` が 2026-09-21 に記した「統合済み（`reference/` ティア配下）」は、
**2026-06-28 時点のスナップショットの取り込み**を指している。再検証の結果:

- `agentic-ai-sandbox` は **2026-06-28 以降 1 コミットも増えていない**。
- `pydantic-ai-sandbox` **本体はその後も独立に開発が続き、2026-09-20 まで更新されている**。
  同 repo 自身の `docs/cross-repo-adoption-backlog.md` は `agentic-ai-sandbox` に一切言及しない。

したがって両者は**並存する別リポジトリ**であり、`agentic-ai-sandbox/reference/` を
`pydantic-ai-sandbox` の後継として単独で参照すると、**約 3 か月分の独立進化を取りこぼす**。

最も影響が大きいのが **X-9（HITL）**:

| | `agentic-ai-sandbox/reference/` | `pydantic-ai-sandbox` 本体 |
|---|---|---|
| `patterns/hitl/` | **不在**（統合時に脱落） | **現存し拡張継続中** |

さらに重要な観測として、**同レーンは本ハブの X-9 を既に取り込んでいる**。
`patterns/hitl/src/patterns_hitl/agent.py` は recipient allow-list を `_known_recipient` /
`_unknown_recipient_retry` として、sticky taint を `HitlDeps.tainted` として実装し、
README が出所を本ハブと明記したうえで **"X-9a" / "X-9b"** という本文書由来の ID で参照している。
X-9 は「本ハブが取り込む項目」として起票されたが、**先に逆方向で着地した**ことになる。

逆に、同レーンが持ち本ハブが持たない防御が 6 点ある（詳細は specs/review 側）。
要点のみ:

1. **履歴注入のスキーマレベル封鎖** — `message_history` / `usage` / `model` を
   *フィールドとして定義しない* ことを要件とし、`extra="forbid"` と併せて 422 で落とす。
   偽造履歴がモデルに到達しないことを証明するテストまである
   （`test_resume_with_client_supplied_message_history_never_reaches_the_model`）。
2. **consume-once ＋ 存在秘匿** — unknown / in-flight / consumed を単一の 404 に畳み、
   本文にセッション ID も状態語も載せない（列挙・リプレイ防御）。
3. **境界を跨ぐ usage 予算** — stop/resume を跨いで積算し、超過は 429 でセッションを消費。
4. **マスク済み監査の単一 fail-soft 境界** — override は**キー名のみ**記録し値は残さない。
   シンクの失敗が resume を失敗させない。
5. **pending set の原子性** — 1 つでも不正な `tool_call_id` があれば、ツールを 1 つも
   実行せずに 409 で決定セット全体を拒否する。
6. **egress ポリシーの回帰スキャン** — 自レーンの `src/` を grep して迂回リテラルの
   混入を落とすテスト（CVE-2026-46678 を引用）。

本ハブが持ち同レーンが持たないもの（durable な suspend/resume、**コミット済み**の
recipient allow-list）は §2 X-9 の記述どおりで変わらない。同レーンの allow-list は
空辞書で fail-open し、`harness.py` が `HitlDeps()` をハードコードするため HTTP 層まで
配線されていない。

### §7.4 `agentic-ai-bootcamp` — §0 の対象表に無い 6 本目

本文書が一度も言及していないリポジトリ。Pydantic AI のハンズオン教材（12 課 ＋
LangGraph / LlamaIndex の比較トラック、英日併記）で、CI・Dependabot・OWASP 対応表・
ネットワーク遮断機構はいずれも持たない（`.github/` 自体が無い）。
本ハブが取り込む運用資産は無い。

特筆すべきは `agentic-ai-sandbox/learn/` との関係である。両者の
`lessons/` ＋ `frameworks/` は **71 ファイル中 13 ファイルのみが相違**し、残りは完全一致する。
相違の内訳:

- 大半は**機械的なリンク張り直し**（`learn/` の 1 階層ぶん深いため `../../docs/` → `../../../docs/`）。
- `11-evals/README.md` は、bootcamp 側が `EVAL-GRADERS.md` を
  **`pydantic-ai-sandbox` への GitHub 絶対 URL** で指すのに対し、sandbox 側は
  **自 repo 内の相対パス** `../../../reference/patterns/EVAL-GRADERS.md` を指す
  （同 repo の「repo 間 URL 撤廃」方針と `scripts/check_doc_links.py` の帰結）。
- **コードは双方向にドリフトしている**: `11-evals/evals.py` は bootcamp のみが
  `UNKNOWN` 番兵を持ち、sandbox のみが `overall` の Unknown 畳み込みに関する注意書きを持つ。
  `frameworks/` 側では sandbox のみが型注釈を新形式（`Generator[T]`）へ更新している。

つまり**片方が他方の後継ではなく、二方向に分岐したフォーク**である。どちらが正本かは
本文書の判断範囲外であり、観測のみを記録する。

### §7.5 `fastapi-pydantic-ai-agent` — 取り込みは既に双方向で完了している

同 repo は本ハブに `services/api` として丸ごと取り込まれている（spec `006-repo-consolidation`
Task 6）。再検証の結果:

- import 後に上流へ増えた 3 ファイル（`tests/unit/test_ci_workflows.py` /
  `test_dependabot_config.py` / `test_pre_push_hook.py`）は `services/api` に無いが、
  これは `AGENTS.md` の "Known gap" が記録する**意図的な省略**と一致する。
  `.md` / `.yml` レベルの差分も CI・pre-commit の 4 ファイルのみで、docs は完全一致。**新規の乖離は無い**。
- 同 repo は X-2 / X-6 / X-7 / X-8 / X-9 / X-12 / X-13 / X-16 を **2026-09-08 までに自ら消化済み**。
  `evals/pr_gate.py` と `docs/context-budget.md` は**本ハブの実装を出所として明記した移植**である。
- 実測差分: workflow が 5 本 → **2 本**に統合（SHA 固定は 5/5 を維持）、
  `tests/support/hermetic.py` が 47 → 75 行（X-2 の指摘どおり `connect_ex` / `getaddrinfo` を追加）、
  `docs/owasp-agentic-llm-mapping.md` が 43 → 72 行（**Agentic AI Top 10 表を追加**）。

### §7.6 X-13 の前提は逆転した — 本ハブの形式の方が厳格である

§2 X-13 は「各行にテストを引用する形式を採ること — これが無いと表は主張のリストに退化する」と
`fastapi-pydantic-ai-agent` の形式を規範として挙げた。**この前提は現在成立しない**。

| | 行数 | 実装引用 | **テスト引用** | 引用の解決 |
|---|---|---|---|---|
| `fastapi-pydantic-ai-agent/docs/owasp-agentic-llm-mapping.md` | 20（2 タクソノミ） | 20/20 | **8/20** | 解決する |
| 本ハブの OWASP 2 文書 | 22 クレーム | ほぼ全件 | **未対応と明記した 2 件を除き全件** | **全 40 引用が解決** |

出所側は表を 2 タクソノミ 20 行へ拡張する過程でテスト引用を伴わない行が増えた。
一方、本ハブの 2 文書は全 40 引用（ファイルパス・シンボル名・CI ステップ）が
2026-09-22 時点ですべて実在する。**テスト引用の厳格さでは本ハブが上回っており、
X-13 を「出所の形式を真似る」項目として読むのはもはや誤り**である。

ただし本ハブ側には出所側に無い弱点が残る。`docs/cross-repo-adoption-backlog.md` §5 に
X-17〜X-20 として起票した:

- **X-17（高）**: [`docs/owasp-agentic-threats-mitigations-mapping.md`](owasp-agentic-threats-mitigations-mapping.md) が
  出所タクソノミ 15 脅威のうち T11〜T15 を**受容と明記せずに落としている**。
  落ちている 5 件には Agent Communication Poisoning / Rogue Agents in Multi-Agent Systems /
  Human Attacks on Multi-Agent Systems が含まれ、**supervisor → specialist の多エージェント構成を
  持つ本ハブにこそ該当する**。単一エージェントの出所側ですら対応する行を
  「Accepted」として明示的に残している。
- **X-18（中）**: 状態語彙が「対応済み / 未対応」の 2 値しかなく、部分対応＋残余リスク受容を
  表現できない。受容行ごとの再評価トリガも無い。
- **X-19（中）**: ファイル名が Agentic Top 10（ASI01–ASI10）を名乗るのに、内容は旧
  「Threats and Mitigations」のレイヤ別脅威表。両文書ともタクソノミのバージョン日付が無い。
- **X-20（低）**: 全 40 引用の解決を守る仕組みが無い（今は手動確認に依存している）。

### §7.7 この再検証が示す一般則

§6.2 は「本文は正確だが抜粋であり時点の記録である」と述べた。今回はその一段上の事象が起きた:

> **時点の記録は、対象が同一であり続ける限りにおいてのみ「古い事実」である。
> 対象そのものが置き換わると、それは古い事実ではなく別物についての記述になる。**

`beeai-agentic-ai-sandbox`（別プロダクトへ置換）と `pydantic-ai-sandbox`（分岐して並存）は
いずれも後者に当たる。したがって横断レビューを判断材料にする際は、
**数値を再実測する前に、まず「その repo は今も同じ repo か」を確認すること**。
確認のコストは最終コミット日時とトップレベル構造を見るだけで済む。

---

## §8 追記（2026-09-23）— spec `007-cross-repo-adoption-closeout` による着地

> **この節の位置づけ**: §1〜§7 は改変しない（追記のみ規約）。本節は、§7.6 が起票した
> X-17〜X-20 と、§7.3 が列挙した D1〜D6（`pydantic-ai-sandbox` の `patterns/hitl/` が
> 持ち本ハブが持たなかった 6 防御）の着地を記録する。
> 実装の詳細・PROVE 証拠・ゲート出力は `specs/007-cross-repo-adoption-closeout/pdca/do.md`
> および `specs/007-cross-repo-adoption-closeout/traceability.md` を参照。

### §8.1 X-17〜X-20 の着地

| ID | 優先度 | 着地 | 内容 |
|---|---|---|---|
| X-17 | 高 | ✅ 着地 | [`docs/owasp-agentic-threats-mitigations-mapping.md`](owasp-agentic-threats-mitigations-mapping.md) を 15 脅威全件（T1〜T15）に拡張。T11〜T15（Unexpected RCE / Agent Communication Poisoning / Rogue Agents / Human Attacks on MAS / Human Manipulation）を追加し、supervisor → specialist 間の保証・非保証を明記。状態トークン + 再評価トリガを全受容行に付与 |
| X-18 | 中 | ✅ 着地 | 対応表 2 文書の語彙を `Mitigated` / `Partial · accepted` / `Accepted`（出所 verbatim 3 値）に統一。受容行（`Partial · accepted` / `Accepted`）に具体的な将来の変更としての再評価トリガを必須化。語彙定義を各文書冒頭に配置 |
| X-19 | 中 | ✅ 着地 | `docs/owasp-agentic-ai-top10-mapping.md` → `docs/owasp-agentic-threats-mitigations-mapping.md` に `git mv`。内容（レイヤ別 Threats and Mitigations・15 脅威）に合わせてファイル名を揃え、ASI01–ASI10 の名称を廃止。両文書の冒頭に ISO-8601 タクソノミバージョン日付を明記 |
| X-20 | 低 | ✅ 着地 | `tests/repo/owasp-mapping-citations.spec.ts` を追加。引用パス実在・シンボル実在・CI ステップ名・3 値語彙・バージョン日付の 5 軸を機械検証し、各軸に「走査 > 0」の非空アサートを配置。新規 GitHub Actions ワークフローなし |

**§7.6 / `specs/review/` リンク是正の記録（追記のみ規約に関わる手続き事項）**:
X-19 のリネームにより、§7.6 の [`docs/owasp-agentic-threats-mitigations-mapping.md`](owasp-agentic-threats-mitigations-mapping.md)
および `specs/review/2026-09-22-cross-repo-verification.md` 内の参照が旧ファイル名（`owasp-agentic-ai-top10-mapping.md`）を
指したままになっていたため、**主張を一切変えずリンク先のみを新ファイル名へ是正した**
（`tests/repo/doc-links.spec.ts` が未更新リンクを失敗させるため必須の修正）。
これはテキストの改変ではなく、リンク先の実体が変わったことへの追従であり、
追記のみ規約（§1〜§7 の主張・測定値・判定を書き換えない）の例外としてここに記録する。

### §8.2 D1〜D6 の着地（`apps/web` の job/approval 経路のみ）

**実装対象の限定**: D1〜D6 はすべて `apps/web` の job/approval 経路（`POST /api/jobs/:id/approve` ＋
`GET /api/jobs/:id/stream`）に実装した。`/api/chat` と `services/api` は対象外とした。

- `/api/chat` は `useChat` がクライアント側履歴を送る前提のため、「サーバ側履歴が正」の封鎖は
  別設計判断として out of scope（spec `007` Scope 参照）。
- `services/api` は verbatim `git subtree` 取り込みであり上流の所有物。

| 防御 | 着地 | 実装ファイル / テストファイル |
|---|---|---|
| D1 — 履歴注入のスキーマレベル封鎖 | ✅ 着地 | `packages/schemas/src/workflows.ts`（`z.strictObject` — `history` / `usage` / `model` を定義しない）、余剰フィールドを 400 で拒否。`packages/schemas/tests/workflows.spec.ts` |
| D2 — consume-once ＋ 存在秘匿 | ✅ 着地 | `apps/web/src/lib/approvals.ts`（`claimApprovalTargets`）＋ `apps/worker/src/stores.ts`（`claimPending` トランザクション）。unknown / in-flight / consumed を単一 404 に畳み、ボディに識別子・状態語を含まない。`apps/web/tests/approvals.spec.ts`、`apps/web/tests/jobs-approve-route.spec.ts` |
| D3 — 境界を跨ぐ usage 予算 | ✅ 着地（Partial）| `apps/worker/src/stores.ts`（`recordStepUsage` / `claimPending` 内 sum）＋ `apps/web/src/lib/approvals.ts`（`resolveJobTokenBudget`）＋ `apps/web/src/app/api/jobs/[id]/approve/route.ts`（429 返却）。`packages/schemas/src/env.ts`（`JOB_TOKEN_BUDGET` env）。現状 usage を報告するのは `document-generation` specialist のみ — 対応表に `Partial · accepted` ＋ 再評価トリガとして記録 |
| D4 — マスク済み監査の単一 fail-soft 境界 | ✅ 着地 | `apps/web/src/lib/approvals.ts`（`maskedArgKeys` ＋ `recordApprovalDecisions`）。キー名のみ記録・値なし、fail-soft（audit シンク失敗で resume を失敗させない）、単一発火点（`apps/web/src/lib/approvals.ts` の 1 箇所のみ）。`tests/repo/egress-policy-bypass.spec.ts` が発火点唯一性を機械検証 |
| D5 — pending set の原子性 | ✅ 着地 | `apps/web/src/lib/approvals.ts`（`findDuplicateTarget` ＋ `claimApprovalTargets`）。1 件でも不正な `toolCallId` があれば DB 接触なしで 409、決定セット全体を拒否。`apps/web/tests/approvals.spec.ts`、`apps/web/tests/jobs-approve-route.spec.ts` |
| D6 — egress ポリシーの回帰スキャン | ✅ 着地 | `tests/repo/egress-policy-bypass.spec.ts`。メールアドレス形リテラルと許可リスト判定の短絡を `apps/*/src/**` ＋ `packages/*/src/**` から検出。監査発火点唯一性アサートを同一走査に相乗り。新規ワークフローなし |

**スキーマ・環境変数**:
- `job_step` テーブル（`packages/db/src/schema.ts`、`packages/db/drizzle/0002_add_job_step.sql`）:
  `(job_id, step_id)` 複合 PK による consume-once 一意性担保、`approval_state` pg enum（`pending` / `consumed`）、`total_tokens` による観測 usage 蓄積。`jobEventTypeEnum` は無改変（SSE 後方互換）。
- `JOB_TOKEN_BUDGET` env（`packages/schemas/src/env.ts`）: 既定値 200,000 トークン。未設定の環境で既存ジョブが失敗しない。

**既存テストの保護**: `GET /api/jobs/:id/stream`、`jobEventTypeEnum`、ツール実行監査（`packages/agents/src/audit-hook.ts` fail-loud 経路）はすべて無改変。

### §8.3 検証ゲートの状態（2026-09-23 時点）

```
mise run check（lint / typecheck / test:run / audit）: 全 GREEN
  test:run: 793 テスト passed / 1 skipped（Task 11 完了時点）
lint:model-ids（forbid-model-ids.sh）: GREEN（新たな hardcode なし）
.github/workflows/: 7 本（変更なし。新規ワークフローファイルを追加しない）
```

カバレッジ閾値（lines / functions ≥ 80%）: 下回らないことを Task 13.2 で確認予定。

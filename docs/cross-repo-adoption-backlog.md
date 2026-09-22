# 相互取り込み backlog（vaz-agentic-ai-next）

Agentic AI 系 5 リポジトリを横断で突き合わせた検証の、本 repo 向け抜粋。
**根拠・実測値・全 16 項目の本文は [`docs/cross-repo-adoption-review.md`](cross-repo-adoption-review.md) が正本**。
本文書は重複させず、項目 ID（X-n）で参照する。

> この参照は数か月にわたり宙に浮いていた（正本が 3 repo から参照されながらどこにも存在しなかった）。
> spec `006-repo-consolidation` のリネーム＋正本配置で解決済み（同文書 §6）。
> 以後この 1 行が**相対リンク**なのは意図的で、`tests/repo/doc-links.spec.ts` が解決を強制する——
> コードスパンで書くと「存在しない正本」を再び名乗れてしまう。

本 repo の [`docs/agentic-engineering-review.md`](agentic-engineering-review.md) は
8 手法（PE / CE / LE / HE / AE / AO / MCP / EV）の一次情報レビューであり、
**横断レビューが参照する ID 体系（`[A1]`〜`[A9]` / `[I1]`〜`[I8]`、PE-1〜EV-6）の正本**。
今回の横断レビューは、そこで単一 repo に行われた評価を 5 repo に広げたもの。

- 検証日: 2026-09-06 ／ 兄弟 repo パス再検証日: 2026-09-21 ／ **全 5 repo 実クローン再検証日: 2026-09-22**
- 兄弟 repo: `beeai-agentic-ai-sandbox` / `pydantic-ai-sandbox` / `agentic-ai-sandbox` /
  `agentic-ai-bootcamp` / `fastapi-pydantic-ai-agent`
- **2026-09-22 の再検証で下記 3 点が確定した**（根拠と実測値は
  [`specs/review/2026-09-22-cross-repo-verification.md`](../specs/review/2026-09-22-cross-repo-verification.md)、
  正本側の記録は `docs/cross-repo-adoption-review.md` §7）:
  - `agentic-ai-sandbox` への統合は **2026-06-28 時点のスナップショット**であり、
    `pydantic-ai-sandbox` 本体はその後も独立に開発が継続している（最終 2026-09-20）。
    **「統合済み」は誤読を招くため、両者は並存する別リポジトリとして扱う。**
    下表の同 repo 由来パスのうち、**X-9 の HITL は `pydantic-ai-sandbox` 本体が唯一の取り込み元**
    （`agentic-ai-sandbox` 側では hitl レーンが脱落している）。
  - `beeai-agentic-ai-sandbox` は**別プロダクトへ全面置換**された。下表が同 repo を出所とする
    パス（`apps/frontend/tests/e2e/`、`effective_agents/`、`.github/workflows/ci.yml` ほか）は
    **現在のツリーに存在しない**。X-14 / X-14b は本 repo 側で着地済みのため影響しないが、
    出所として再利用はできない。
  - `fastapi-pydantic-ai-agent` のパスは 2026-09-22 に再検証済み（workflow が 5 本→2 本に
    統合された点以外は健在）。

---

## 1. この repo が出す資産

| 資産 | 場所 | 何が独自か |
|---|---|---|
| 8 手法の一次情報レビュー | `docs/agentic-engineering-review.md`（338 行） | Anthropic 9 件・IBM 8 件を ID 付きで整理し、PE-1〜EV-6 の検証済みベストプラクティスに落とした唯一の文書。**5 repo 横断レビューの土台** |
| コンテキスト予算の段階導入設計 | `docs/context-budget.md`（146 行） | Stage 0（全履歴＋停止述語）→ Stage 1（`prepareStep` 窓化シーム、**未指定時 byte 等価**）→ Stage 2（自動 compaction）。`totalTokens` が reasoning を含みうるため `inputTokens + outputTokens` を自前合算する理由まで記録 |
| AgentOps ランブック | `docs/agentops.md`（148 行） | 可観測性・評価・最適化の 3 本柱を実コードへ写像。**未実装の項目を要件 ID 付きで明示する**書き方（実装済みのように描く事故を避ける） |
| 3 層 evals ＋ PR ゲート | `packages/evals/`（`src/pr-gate.ts` / `src/nightly.ts` / `src/judge.ts` / `src/unit/`） | ベースライン差分・over-under-trigger balance・case あたりトークン/所要時間・**20 件未満は `reportOnly`**。5 repo 中で最も成熟した eval 運用 |
| MCP ポジション ADR | `docs/adr/0001-mcp-position.md` | 5 repo 中**唯一の MCP 資産**。不採用の理由 ＋ 採用トリガ条件 ＋ `needsApproval` ↔ MCP `destructiveHint` の写像方針 ＋ サーバの供給網審査 |
| 境界契約の 2 脚 | `mise run openapi:gen` → `packages/schemas/src/generated/` ＋ 手書き Zod ラッパ | `satisfies z.ZodType<Generated>` は**余剰フィールドを捕まえない**ので JSON-Schema 形状比較と併用する、という記録（`AGENTS.md`） |
| durable HITL | `packages/agents/src/supervisor.ts` ＋ `apps/worker/src/inngest.ts` | エンジン非依存の `WorkflowStepRunner` seam で**ワーカー再起動を跨ぐ** suspend/resume。承認ゲートと `RECIPIENT_ALLOWLIST` の**独立 2 ゲート**、sticky taint（外部由来コンテンツ注入後は run 終端まで latch） |
| 単一発火点の監査 | `packages/agents/src/audit-hook.ts` | 承認ゲート通過後・`execute` 直前の 1 箇所のみ。web/worker 両パスを覆う。R4.7 プライバシー契約（raw prompt / tool args をログに出さない） |

## 2. この repo が取り込む項目

| ID | 内容 | 出所 | 工数 | 受け入れ条件 |
|---|---|---|---|---|
| **X-1（最優先）** | Actions の SHA 固定と `permissions:` 宣言。実測で **SHA 固定 0/22、`permissions:` 宣言 0/6** — 5 repo 中で最も弱い | `fastapi-pydantic-ai-agent`（SHA 固定 5/5）＋ そのガードテスト `fastapi-pydantic-ai-agent/tests/unit/test_ci_workflows.py`（224 行） | S | 6 ワークフロー全ての `uses:` が 40 桁 SHA、全ワークフローが最小 `permissions:` を宣言。**TS 側の repo ガードが 0 件なので、これを機に vitest で同等のガードを新設する**（YAML パース＋「走査ファイル数 > 0」アサート） |
| **X-2** | ネットワーク遮断の**構造的保証**。`MockLanguageModelV4` 注入で実質ネットワークに出ないが、モック漏れを構造的に落とす仕組みが無い | `fastapi-pydantic-ai-agent/tests/support/hermetic.py`（47 行）／`agentic-ai-sandbox/reference/patterns/deep-research/tests/` の autouse `block_network` 版 | S | vitest setup で `fetch` / undici を落とし、ユニットテスト中の外向き通信を大声で失敗させる。ガードが空振りでないことを証明するテストを 1 本 |
| **X-14** | E2E の CI レーン。現状 pre-push フックのみで **`--no-verify` で素通りし CI の安全網が無い**（`AGENTS.md` 自身が §12 R10 との矛盾として記載） | `beeai-agentic-ai-sandbox/apps/frontend/tests/e2e/`（10 spec、うち `09-accessibility` は `@axe-core/playwright` による a11y 検査） | M | `.github/workflows/tests.yml` にジョブを追加（**新規ワークフローを作らない** — 第 2 の CI 経路は principle 5 違反）。X-3 の非空アサート（収集テスト数 > 0）を同時に入れる |
| **X-14b** | a11y E2E の導入。**本 repo に a11y 検査が皆無**。Carbon Design System を使う `apps/web` にこそ効く | `beeai-agentic-ai-sandbox` の `@axe-core/playwright` spec | S | 既存の Playwright 構成に追加。X-14 と同時に着地させる |
| **X-13** | OWASP 対応表の新設（**現状皆無**） | `fastapi-pydantic-ai-agent/docs/owasp-agentic-llm-mapping.md`（LLM Top 10、全行に実装＋テストを引用）＋ `agentic-ai-sandbox/reference/patterns/SECURITY-NOTES.md`（Agentic AI Top 10 をレイヤ別に） | S | 2 表は対象タクソノミが異なり重複しない。**各行にテストを引用する**形式を採ること（無いと主張のリストに退化する）。**2026-09-22 訂正**: 出所側の「全行にテストを引用」は現在成立しない（同 repo の表は 2 タクソノミ 20 行へ拡張された一方、テスト引用は 8/20 行のみ）。本 repo の 2 文書は全 40 引用が解決し、テスト引用の厳格さでは**本 repo の方が上**。X-13 の残課題は引用形式ではなく**カバー範囲**に移った（[§5](#5-2026-09-22-再検証の反映) 参照） |
| **X-15** | `.github/dependabot.yml` の新設（`security-daily.yml` はあるが更新提案が来ない） | `fastapi-pydantic-ai-agent/.github/dependabot.yml` ＋ `fastapi-pydantic-ai-agent/tests/unit/test_dependabot_config.py` | S | 意図的に据え置いている 3 メジャー（`vitest` 4.x / `typescript` 6.x / `@types/node` 24）を `ignore:` に載せ、理由をコメントで残す（`AGENTS.md` の記述と一致させる） |
| X-3 | 空振り検知（anti-false-green）の導入 | `agentic-ai-sandbox/reference/patterns/contracts/src/patterns_contracts/pytest_live_guard.py` の TS 相当 | S | Playwright レーン・`py:check` レーンで「収集テスト数 > 0」を強制 |
| X-5 | 停止理由語彙の写像表を参照可能にする。本 repo の `runStopReasonSchema` は `natural`/`step-cap`/`budget-exceeded`/`error` の **4 値**で、Python 側 2 repo の 5 値（`denied` / `disallowed_tool` を含む）と非対称 | 正本 §2 X-5 の写像表 → 裁定は [`ADR-0004`](adr/0004-stop-reason-vocabulary.md) | S | **統一しない**（`JobEvent` SSE 契約と `audit_log` の後方互換に影響）。`docs/context-budget.md` の停止理由節から ADR-0004 へリンクし、拒否が別経路であることを明記 |
| X-9 | HITL の**配線**。契約はあるが動いていない: `createEmailCapability` がどのエージェントにも未登録／`Chat.tsx` に `addToolApprovalResponse` が無い／`apps/worker` の述語が `requiresApprovalForKind: () => false` | 参照実装は `agentic-ai-sandbox/reference/patterns/autonomous-agent/`（`approval_hook` で危険ツールを承認ゲートし、否認は `stop_reason="denied"` で契約に記録。3 フレームワークレーン全てに実装あり）。**2026-09-06 時点で記載していた `patterns/hitl/` レーンは統合後の同 repo に存在しない** —— ただし **2026-09-22 訂正**: 同レーンは**本家 `pydantic-ai-sandbox` に現存し拡張が続いている**（`patterns/hitl/src/patterns_hitl/`）。HITL の取り込み元はそちらが唯一 | M | 3 箇所の配線 ＋ approve/deny/malformed の E2E。**承認は不可逆・高リスク操作のみ**（増やす方向へ行かない） |
| X-11 | ドリフト検知エラーに**直し方を書く** | `beeai-agentic-ai-sandbox/.github/workflows/ci.yml` の `schema-drift` ジョブ（`::error::` に実行コマンドを書く） | S | `codegen-check` 相当の失敗時に再生成コマンドを出力 |
| X-16 | 6 パターン教材への参照 | `beeai-agentic-ai-sandbox/effective_agents/`（`_print_usage()` による ~15× コストの可視化）／`agentic-ai-sandbox/reference/patterns/deep-research/COMPARISON.md` | S | **実装は不要**。多エージェント検討時のゲート判断材料へのリンクのみ |

### X-5 補足 — 停止理由語彙は 3 実装目でも同じ 5 値

裁定は [`docs/adr/0004-stop-reason-vocabulary.md`](adr/0004-stop-reason-vocabulary.md)（**統一しない**）、
写像表もそこが正本（TS 4 値 ↔ `services/api` の `StopReason` 5 値）。

本 repo 外の 3 実装目として、`agentic-ai-sandbox/reference/patterns/contracts/`
`src/patterns_contracts/autonomous_agent.py` の `AgentRunResult.stop_reason` も
`completed` / `max_iterations` / `budget_exceeded` / `denied` / `disallowed_tool` の**同一 5 値**
（`test_contract_drift.py` で語彙固定）であることを 2026-09-21 に確認した。
非対称は 1 repo の癖ではなく **TS 側の「ループ全体の集約」と Python 側の「ゲート実装の拒否理由」という
レイヤ差**に由来する、という ADR-0004 の根拠 2 を裏づける観測。

## 3. 実装状況(2026-09-08)

X-1 / X-2 / X-3 / X-5 / X-11 / X-13 / X-14 / X-14b / X-15 / X-16 は着地済み。詳細は各行の
受け入れ条件を参照(実装コードとテストへのリンクはこの節では重複させない)。

- X-9(HITL の配線)は 3 箇所のうち 2 箇所を着地: `createEmailCapability` を
  `packages/agents/src/chat-agent.ts#buildChatTools` に登録(chat のツールセットへ)、
  `Chat.tsx` に `addToolApprovalResponse` ベースの承認/却下 UI を実装。
  approve/deny/malformed の E2E は `apps/web/tests/e2e/hitl-approval.spec.ts`
  (malformed の 2 本はモデル呼び出し不要・CI で常時実行、approve/deny の 2 本は
  `chat-anthropic.spec.ts` と同じ資格情報ゲートで自己スキップ)。
  **`apps/worker` の `requiresApprovalForKind: () => false` は意図的に未着手のまま** —
  今日どの supervisor specialist も破壊的ツールを呼ばないため(`sendEmail` は chat 専用に
  なった)、`true` を返す変更はどの kind に対しても意味を持たない。正しく閉じるには
  `workflowStepSchema` にステップ単位の承認要否フラグを足す横断的変更が要る
  (`apps/web/tests/e2e/approval-resume.spec.ts` の SCOPE/FIDELITY 節に詳細)。
  `apps/worker/src/start.ts` のコメントをこの現状に合わせて更新済み。

## 4. この repo 固有の注意

- **新規ワークフローファイルを作らない**（X-14）。実ワークフローは `lint.yml` / `tests.yml` /
  `python.yml` / `security-daily.yml` / `eval-pr.yml` / `eval-nightly.yml` の 6 本で、
  lint / test / Python / audit は既に独立して走っている。第 2 の CI 経路は principle 5 違反。
  GitHub Actions の job id にコロンは使えない（`test-unit` ＋ `name: "test:unit"`）。
- **`JobEvent` は SSE 契約**。X-5 / X-9 でフィールドを増やす場合は optional で後方互換に。
  `JobEvent.ts` は ISO 文字列、`AuditEntry.ts` は `Date`（プロセス内のみ）— 混同しない。
- **model ID は `@vaz/config` と `@vaz/schemas/src/env.ts` にのみ**（`lint:model-ids` が grep ゲート）。
  取り込むコードに model 文字列が含まれていないか確認する。
- **`mise run check` は Python ツールチェーン無しで緑を維持する**（`py:check` は依存に入れない）。
  X-2 の TS 側遮断は `check` に載せてよいが、Python 側と混ぜない。
- **意図的に据え置いている 3 メジャー**（`vitest` 4.x / `typescript` 6.x / `@types/node` 24）は
  それぞれ判断であり陳腐化した範囲指定ではない。X-15 の `ignore:` はこれを反映すること
  （`AGENTS.md` の該当項が正本）。
- **`packages/*` はビルド無しの source-only**。取り込みで per-package `tsc` を足さない。
- **本 repo 内の文書はリンク、兄弟 repo のパスはコードスパン**で書く。`tests/repo/doc-links.spec.ts`
  が相対リンクの解決を強制するので、リンクにすれば「存在しない正本」は CI で落ちる（X-5 / 正本
  参照がまさにその事故だった）。逆に他 repo を指すリンクは必ず落ちるため、そちらはコードスパン
  で書き、名前の正しさは `tests/repo/cross-repo-reference-resolution.spec.ts` が別途見る。

## 5. 2026-09-22 再検証の反映

5 repo を実クローンして再検証した結果の要約。実測値と根拠は
[`specs/review/2026-09-22-cross-repo-verification.md`](../specs/review/2026-09-22-cross-repo-verification.md)、
正本側の時点記録は `docs/cross-repo-adoption-review.md` §7。

**取り込み元が失われた項目**（本 repo 側は着地済みのため実害なし。出所としての再利用のみ不可）:

- X-11 / X-14 / X-14b / X-16 が出所としていた `beeai-agentic-ai-sandbox` の資産
  （`schema-drift` ジョブ、10 本の Playwright spec、`effective_agents/`、4 段ラダー）は、
  同 repo が別プロダクトへ全面置換されたため**現存しない**。

**取り込み元が変わった項目**:

- X-9（HITL）の取り込み元は `pydantic-ai-sandbox` 本体の `patterns/hitl/` のみ。
  同レーンは**本 repo の X-9 フィードバックを既に取り込んでおり**（`agent.py` の
  recipient allow-list と sticky taint を "X-9a" / "X-9b" として実装、出所として
  本 repo を明記）、相互取り込みが双方向に成立した最初の事例になっている。

**新規に起票すべき項目**（いずれも本 repo 側の作業。本文書の表には未追加）:

- **X-17 — agentic 脅威 5 件の欠落**（優先度: 高）。
  [`docs/owasp-agentic-threats-mitigations-mapping.md`](owasp-agentic-threats-mitigations-mapping.md) は
  出所タクソノミ 15 脅威のうち T1〜T10 のみを収録し、残る 5 件
  （Unexpected RCE / Agent Communication Poisoning / Rogue Agents in Multi-Agent Systems /
  Human Attacks on Multi-Agent Systems / Human Manipulation）を**受容と明記せずに落としている**。
  本 repo は `packages/agents/src/supervisor.ts` で supervisor → specialist の多エージェント
  構成を持つため、**エージェント間脅威は単一エージェントの兄弟 repo よりむしろ該当する**。
  受け入れ条件: 5 件を節として追加し、supervisor が specialist 間で何を保証し何を保証しないかを
  明記する。→ **spec 007-cross-repo-adoption-closeout により解決**（X-17〜X-20 全件を本 spec が扱う。
  [`docs/owasp-agentic-threats-mitigations-mapping.md`](owasp-agentic-threats-mitigations-mapping.md) へリネーム済み）。
- **X-18 — 状態語彙と再評価トリガの不在**（優先度: 中）。本 repo の 2 文書は
  「対応済み」と「未対応」しか表現できず、部分対応＋残余リスク受容（LLM05、Overwhelming HITL）を
  区別できない。出所側の 3 値（`Mitigated` / `Partial · accepted` / `Accepted`）と、
  受容行ごとの**再評価トリガを具体的な将来の変更として書く**形式を取り込む。→ **spec 007 により解決**。
- **X-19 — タクソノミ名と内容の不一致**（優先度: 中）。
  `docs/owasp-agentic-threats-mitigations-mapping.md` はファイル名が Agentic Top 10（ASI01–ASI10）を
  名乗るが、内容は旧「Agentic AI – Threats and Mitigations」のレイヤ別脅威表。
  どちらかに揃え、両文書の冒頭にタクソノミのバージョン日付を明記する。→ **spec 007 により解決**（ファイル名を内容に揃えてリネーム済み）。
- **X-20 — 引用パスの腐敗検知**（優先度: 低）。2 文書の全 40 引用は 2026-09-22 時点で
  すべて解決したが、これを守る仕組みが無い。`tests/repo/` に
  「両文書が引用するパスが実在する」ガードを足す（`ci-workflows.spec.ts` と同じく
  「走査した引用数 > 0」の非空アサート付きで）。→ **spec 007 により解決**（`tests/repo/owasp-mapping-citations.spec.ts` 追加済み）。

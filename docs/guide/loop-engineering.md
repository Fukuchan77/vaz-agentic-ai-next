# ループエンジニアリング (LE)

エージェントループ（収集 → 行動 → 検証 → 反復）の制御系の設計。定義と LE-1〜LE-5 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.3 を参照。

## (a) このハブでの実装

このハブは停止理由の**閉じた語彙を 2 つ**持つ（TS 側・Python 側、Task 6 の `services/api`
統合以降）。両者は統一しない — 理由・写像表は
[ADR-0004](../adr/0004-stop-reason-vocabulary.md) を参照。

- [`packages/schemas/src/run-metrics.ts`](../../packages/schemas/src/run-metrics.ts) —
  TS 側の閉じた停止理由語彙（LE-2）: `natural` / `step-cap` / `budget-exceeded` / `error` の 4 値
- `stopWhen: isStepCount(n)`（`@vaz/agents`、`streamText` オプション）— ステップ数の有界化（LE-1）
- [`services/api/app/agents/guardrails.py`](../../services/api/app/agents/guardrails.py) —
  Python 側の閉じた停止理由語彙: `completed`/`max_iterations`/`budget_exceeded`/`denied`/
  `disallowed_tool` の 5 値と副作用前トークン予算（`_GuardedToolset`）

## (b) 兄弟リポジトリの教材

- `pydantic-ai-sandbox` [`patterns/contracts/src/patterns_contracts/autonomous_agent.py`](https://github.com/Fukuchan77/pydantic-ai-sandbox/blob/main/patterns/contracts/src/patterns_contracts/autonomous_agent.py) — 同型の 5 値を独立に採用
- `pydantic-ai-agentic-patterns` — `I-H10`（`specs/review/integrated/findings.md`）: 停止理由が語彙化されておらず、トークン予算による停止も無い（未解決の High。移植元は必ず Python 5 値側とする — ADR-0004 Consequences）

## (c) 正本レビューの関連項目

- X-5（停止理由語彙の写像表 — Python 5 値 ↔ TS 4 値。[ADR-0004](../adr/0004-stop-reason-vocabulary.md)
  で正式に「統一しない」と裁定済み — Task 6 の `services/api` 統合により両者が同一 repo に
  同居した時点で起票条件が成立した）

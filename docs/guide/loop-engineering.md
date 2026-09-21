# ループエンジニアリング (LE)

エージェントループ（収集 → 行動 → 検証 → 反復）の制御系の設計。定義と LE-1〜LE-5 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.3 を参照。

## (a) このハブでの実装

- [`packages/schemas/src/run-metrics.ts`](../../packages/schemas/src/run-metrics.ts) —
  閉じた停止理由語彙（LE-2）: `natural` / `step-cap` / `budget-exceeded` / `error` の 4 値
- `stopWhen: isStepCount(n)`（`@vaz/agents`、`streamText` オプション）— ステップ数の有界化（LE-1）

## (b) 兄弟リポジトリの教材

- `fastapi-pydantic-ai-agent` [`app/agents/guardrails.py`](https://github.com/Fukuchan77/fastapi-pydantic-ai-agent/blob/main/app/agents/guardrails.py) — 停止理由 5 値（`completed`/`max_iterations`/`budget_exceeded`/`denied`/`disallowed_tool`）と副作用前トークン予算
- `pydantic-ai-sandbox` [`patterns/contracts/src/patterns_contracts/autonomous_agent.py`](https://github.com/Fukuchan77/pydantic-ai-sandbox/blob/main/patterns/contracts/src/patterns_contracts/autonomous_agent.py) — 同型の 5 値を独立に採用
- `pydantic-ai-agentic-patterns` — `I-H10`（`specs/review/integrated/findings.md`）: 停止理由が語彙化されておらず、トークン予算による停止も無い（未解決の High。移植機会は下記 X-n 参照）

## (c) 正本レビューの関連項目

- X-5（停止理由語彙の写像表 — Python 5 値 ↔ TS 4 値。統一はしない。このハブが両方を抱える時点で
  `docs/adr/0004-stop-reason-vocabulary.md` の起票条件が成立する — `specs/006-repo-consolidation/spec.md` R8.3）

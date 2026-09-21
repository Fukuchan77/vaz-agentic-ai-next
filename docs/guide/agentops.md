# AgentOps (AO)

自律エージェントのライフサイクル管理の実践体系。**可観測性・評価・最適化**の 3 本柱。定義と
AO-1〜AO-5 は [`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.6 を参照。

## (a) このハブでの実装

- [`docs/agentops.md`](../agentops.md) — この 3 本柱の実装マッピング
- [`apps/web/instrumentation.ts`](../../apps/web/instrumentation.ts) — `registerOTel` → `initTelemetry`
  の順で計装（プロバイダ先・AI SDK ブリッジ後、両者とも fail-soft）
- [`packages/agents/src/audit-hook.ts`](../../packages/agents/src/audit-hook.ts) — 監査証跡（AO-3）

## (b) 兄弟リポジトリの教材

- `fastapi-pydantic-ai-agent` [`app/observability.py`](https://github.com/Fukuchan77/fastapi-pydantic-ai-agent/blob/main/app/observability.py) — Logfire 計装（プロンプト・ツール入出力を既定でスクラブ）と JSON 構造化ログ
- `pydantic-ai-agentic-patterns` [第9章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part3/ch09.md)・[第14章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part5/ch14.md) — Pydantic Logfire による高度なトレース、デプロイと運用

## (c) 正本レビューの関連項目

正本レビュー（X-1〜X-16）に AO を専用に扱う項目は無い。

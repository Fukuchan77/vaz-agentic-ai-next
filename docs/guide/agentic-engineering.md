# エージェンティックエンジニアリング (AE)

エージェントと共に/上に構築する開発規律。「AI が実装し、人間がアーキテクチャ・品質・正しさを
所有する」。定義と AE-1〜AE-4 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.5 を参照。

## (a) このハブでの実装

- `CLAUDE.md` / `AGENTS.md` のペア編集規約（AE-2: エージェント向けコンテキストファイルを実態と
  乖離させない）
- [`scripts/forbid-model-ids.sh`](../../scripts/forbid-model-ids.sh)（`lint:model-ids`）— 機械的ゲート（AE-3）の一例
- `specs/00{1..6}-*/` — spec-driven な開発の実例（AE-2）。`specs/memory/constitution.md` §5.1 は
  マルチエージェント採用のゲート判断（AE-1 の「まずシンプルに始める」を制度化したもの）

## (b) 兄弟リポジトリの教材

- 5 repo 横断レビュー X-16（下記）が指す教材: `beeai-agentic-ai-sandbox/effective_agents/`
  の `_print_usage()`（マルチエージェント構成の ~15 倍コスト可視化）と
  `pydantic-ai-sandbox/patterns/deep-research/COMPARISON.md`（6 パターンの比較表）。
  マルチエージェント化を検討する際の判断材料（実装は不要、読み物としての参照）
- `pydantic-ai-agentic-patterns` [第1章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part1/ch01.md)・[第8章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part3/ch08.md)・[第10章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part4/ch10.md)・[第12章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part4/ch12.md) — AI エージェント序章、デザインパターン、Orchestrator-Workers、総合実践

### Anthropic 6 パターンの正本（Phase 3・spec `006` R7.1/R7.2）

`pydantic-ai-sandbox` と `pydantic-ai-agentic-patterns` は Anthropic の 6 パターンを**純粋に
重複して**実装している（統合計画 §4.3。補完ではない）。**どちらもこのハブへは移設しない**
（R7.1: sandbox 側は 8 レーン独立 uv 構成が成立要件で崩す価値が薄い。教材側は書籍原稿
14 章の実装であり、Phase 1（R5.3）で章をリンク参照に留めた判断と同じ理由 — コードだけを
引き剥がすと、対応する章の解説から実装が分離し、書籍としての一体性を壊す）。代わりに
**リンク先の使い分けを固定する**:

| パターン | 教材用の単純版（正本） | 比較版（3 FW、参照のみ） |
|---|---|---|
| Prompt Chaining | [`src/part3_workflows/prompt_chaining.py`](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/src/part3_workflows/prompt_chaining.py) | [`patterns/prompt-chaining/`](https://github.com/Fukuchan77/pydantic-ai-sandbox/tree/main/patterns/prompt-chaining) |
| Routing | [`src/part3_workflows/routing_workflow.py`](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/src/part3_workflows/routing_workflow.py) | [`patterns/routing/`](https://github.com/Fukuchan77/pydantic-ai-sandbox/tree/main/patterns/routing) |
| Parallelization | [`src/part3_workflows/parallel_workflow.py`](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/src/part3_workflows/parallel_workflow.py) | [`patterns/parallelization/`](https://github.com/Fukuchan77/pydantic-ai-sandbox/tree/main/patterns/parallelization) |
| Evaluator-Optimizer | [`src/part3_workflows/evaluator_optimizer.py`](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/src/part3_workflows/evaluator_optimizer.py) | [`patterns/evaluator-optimizer/`](https://github.com/Fukuchan77/pydantic-ai-sandbox/tree/main/patterns/evaluator-optimizer) |
| Orchestrator-Workers | [`src/part4_multi_agent_rag/research_system/orchestrator.py`](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/src/part4_multi_agent_rag/research_system/orchestrator.py) | [`patterns/orchestrator-workers/`](https://github.com/Fukuchan77/pydantic-ai-sandbox/tree/main/patterns/orchestrator-workers) |
| Autonomous Agent | [`src/part5_production/guarded_agent.py`](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/src/part5_production/guarded_agent.py)（**部分的** — ガードレール付きの自律エージェントであり、独立パターンとしての実装ではない） | [`patterns/autonomous-agent/`](https://github.com/Fukuchan77/pydantic-ai-sandbox/tree/main/patterns/autonomous-agent) |

`I-H10`（`pydantic-ai-agentic-patterns/specs/review/integrated/findings.md`）— 教材側が
まだ持たない停止理由の語彙化・トークン予算は、`services/api`（`app/agents/guardrails.py`）の
閉じた `StopReason` 語彙から移植する余地がある（R8.5、Phase 4）。

## (c) 正本レビューの関連項目

- X-16（学習ラダーと教材資産の相互参照 — 本番指向 2 repo は 6 パターンを参照する場所を持たず、
  学習指向 2 repo は本番規律を持たない）
- X-4（エージェント契約ファイルの不在／追跡外）
- X-1 / X-3（機械的ゲート・空振り検知の共通原則）

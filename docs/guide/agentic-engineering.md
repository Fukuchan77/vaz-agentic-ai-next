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

## (c) 正本レビューの関連項目

- X-16（学習ラダーと教材資産の相互参照 — 本番指向 2 repo は 6 パターンを参照する場所を持たず、
  学習指向 2 repo は本番規律を持たない）
- X-4（エージェント契約ファイルの不在／追跡外）
- X-1 / X-3（機械的ゲート・空振り検知の共通原則）

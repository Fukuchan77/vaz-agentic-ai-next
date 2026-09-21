# コンテキストエンジニアリング (CE)

推論時にモデルが見るトークン全体の構成最適化。定義と CE-1〜CE-5 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.2 を参照。

## (a) このハブでの実装

- [`docs/context-budget.md`](../context-budget.md) — 段階導入設計（Stage 0: 全履歴＋停止述語 →
  Stage 1: `prepareStep` 窓化シーム → Stage 2: 自動 compaction）
- [`packages/agents/src/prompt.ts`](../../packages/agents/src/prompt.ts) — 信頼境界（CE-5）:
  RAG 結果注入後 `externallyDriven` が run 終端まで sticky に latch する

## (b) 兄弟リポジトリの教材

- `pydantic-ai-agentic-patterns` [第3章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part1/ch03.md) — Prompt Caching と ContextManager（prune・compact・JIT）
- `fastapi-pydantic-ai-agent` [`app/stores/session_store/_trim.py`](https://github.com/Fukuchan77/fastapi-pydantic-ai-agent/blob/main/app/stores/session_store/_trim.py) — 機械的トリムの不変条件（メッセージ境界のみで切る、tool-call ペアを孤児化しない）
- `pydantic-ai-sandbox` [`patterns/deep-research/src/patterns_deep_research/notes.py`](https://github.com/Fukuchan77/pydantic-ai-sandbox/blob/main/patterns/deep-research/src/patterns_deep_research/notes.py) — 構造化ノートテイキング（CE-3、外部メモ）

## (c) 正本レビューの関連項目

- X-7（コンテキスト管理の三脚 — 機械的トリム／段階導入設計／外部メモは互いに欠けている脚を補う）

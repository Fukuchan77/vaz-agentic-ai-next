# プロンプトエンジニアリング (PE)

1 回のモデル呼び出しに与える指示文の設計。定義と PE-1〜PE-5 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.1 を参照。

## (a) このハブでの実装

- [`packages/agents/src/prompt.ts`](../../packages/agents/src/prompt.ts) — RAG 結果を
  明示的なデリミタで括った context block として注入する（PE-2）。`CHAT_SYSTEM_PROMPT`
  は [`packages/agents/src/chat-agent.ts`](../../packages/agents/src/chat-agent.ts) に定義。

## (b) 兄弟リポジトリの教材

- `pydantic-ai-agentic-patterns` [第2章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part1/ch02.md) — Claude API と Anthropic Python SDK
- `fastapi-pydantic-ai-agent` [`docs/tool-design-conventions.md`](https://github.com/Fukuchan77/fastapi-pydantic-ai-agent/blob/main/docs/tool-design-conventions.md) — ツール description の規約（PE-5: 「いつ呼ぶか」を規範的に書く）
- `pydantic-ai-sandbox` [`patterns/TOOL-DESIGN-NOTES.md`](https://github.com/Fukuchan77/pydantic-ai-sandbox/blob/main/patterns/TOOL-DESIGN-NOTES.md) — 同上の実装

## (c) 正本レビューの関連項目

- X-6（ツール設計 — 規約と実装が別 repo に分かれている）

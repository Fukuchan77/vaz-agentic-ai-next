# Agentic AI 開発ガイド

Agentic AI アプリ開発の学習パス。骨格は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1 が定義する
**8 手法**（PE / CE / LE / HE / AE / AO / MCP / EV）で、各手法から (a) このハブでの実装、
(b) 兄弟リポジトリの教材、(c) [`docs/cross-repo-adoption-review.md`](../cross-repo-adoption-review.md)
の該当 X-n 項目 — の 3 方向へリンクする。**本文は複製しない**（憲章原則 5「既存の単一経路に
合流させる」）。各手法の定義・検証済みベストプラクティス（PE-1〜EV-6）そのものは一次情報レビュー
（`docs/agentic-engineering-review.md` §1.1〜§1.8）を読むこと。

例外は [AgentOps (AO)](./agentops.md) と [コンテキストエンジニアリング (CE)](./context-engineering.md)
の 2 ページ。旧 `docs/agentops.md`／`docs/context-budget.md`（独立文書）をこの 2 ページへ統合したため、
(a) の節が実装マッピングの本文そのものを保持する唯一の正本になっている（`docs/README.md` 参照）。

8 手法は階層になっている: プロンプト ⊂ コンテキスト ⊂ ループ ⊂ ハーネス ⊂
エージェンティックエンジニアリング（内側から外側へスコープが広がる）。AgentOps は運用横断、
MCP は接続標準、評価は品質保証としてこの階層を貫く。

## 手法別ガイド

| # | 手法 | 一次情報 |
|---|---|---|
| 1 | [プロンプトエンジニアリング (PE)](./prompt-engineering.md) | §1.1 |
| 2 | [コンテキストエンジニアリング (CE)](./context-engineering.md) | §1.2 |
| 3 | [ループエンジニアリング (LE)](./loop-engineering.md) | §1.3 |
| 4 | [ハーネスエンジニアリング (HE)](./harness-engineering.md) | §1.4 |
| 5 | [エージェンティックエンジニアリング (AE)](./agentic-engineering.md) | §1.5 |
| 6 | [AgentOps (AO)](./agentops.md) | §1.6 |
| 7 | [Model Context Protocol (MCP)](./mcp.md) | §1.7 |
| 8 | [エージェント評価 (EV)](./evaluation.md) | §1.8 |

## 書籍原稿（`pydantic-ai-agentic-patterns`）との対応

`pydantic-ai-agentic-patterns/docs/part{1..5}/ch{01..14}.md` は書籍『Agentic AI アプリ開発入門』の
原稿で、`src/` の実装と 1 対 1 対応する。Phase 3（パターンカタログの取捨選択、
`specs/006-repo-consolidation/` Requirement 7）は完了済みで、**教材コードは物理的に移設せず、
upstream の原稿・実装へのリンクを正本とする**と裁定した。コードだけを引き剥がすと解説と実装が
分裂するためであり、本ガイドはその決定に従ってリンク参照を維持する。

| 章 | タイトル | 対応する手法 |
|---|---|---|
| [第1章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part1/ch01.md) | AIエージェントへの序章 | AE |
| [第2章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part1/ch02.md) | Claude API と Anthropic Python SDK | PE |
| [第3章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part1/ch03.md) | Context Engineering — Prompt Caching と Context Manager | CE |
| [第4章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part2/ch04.md) | 型安全なツール設計と Structured Outputs | PE, HE |
| [第5章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part2/ch05.md) | ModelRetry による自己修復エージェント | LE |
| [第6章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part2/ch06.md) | MCP（Model Context Protocol）統合 | MCP |
| [第7章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part3/ch07.md) | 4大ワークフローパターンと Pydantic Logfire トレース | LE, AO |
| [第8章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part3/ch08.md) | 自律エージェントとデザインパターン | AE |
| [第9章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part3/ch09.md) | Pydantic Logfire による高度なトレースと可観測性 | AO |
| [第10章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part4/ch10.md) | Orchestrator-Workers アーキテクチャ | AE, HE |
| [第11章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part4/ch11.md) | Agentic RAG — 反復検索と引用検証 | CE, LE |
| [第12章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part4/ch12.md) | 自律型マルチエージェント・リサーチシステム（総合実践） | AE |
| [第13章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part5/ch13.md) | 長期記憶・3層評価・Tool Guardrails | CE, EV, LE |
| [第14章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part5/ch14.md) | デプロイと運用のベストプラクティス | AO |

## 関連

- [`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) — 8 手法の一次情報レビュー（本ガイドが骨格として使う ID 体系の正本）
- [`docs/cross-repo-adoption-review.md`](../cross-repo-adoption-review.md) — 5 リポジトリ横断の取り込み項目（X-1〜X-16）
- `specs/006-repo-consolidation/` — 本ガイドを構築した spec（Requirement 5）

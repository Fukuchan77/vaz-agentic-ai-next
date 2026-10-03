# Agentic AI 開発ガイド

Agentic AI アプリ開発の**本番エンジニアリング・リファレンス**（手法別）。入門から順に学ぶ学習パスは
兄弟リポジトリ `from-genai-to-agentic-ai`（19 モジュール。対応表は下の「学習パスとの対応」）が担う。
2026-10-03 の役割分担による（[`specs/008-hub-consolidation-followup/spec.md`](../../specs/008-hub-consolidation-followup/spec.md) R6.1）。骨格は
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

> **2026-10-03 追記（spec `008`）**: `pydantic-ai-agentic-patterns` は**非公開でアーカイブ**された。
> 外部から参照できないため、本ガイド（`docs/guide/` 全ページ）から同リポジトリへのリンクを外し、
> 章名・パスは記録として本文に残した。下表は「当時どの章がどの手法に対応していたか」の記録であって、
> 読みに行ける教材ではない。入門からの学習には `from-genai-to-agentic-ai` の学習パス（下の「学習パスとの対応」）を使う。
> ADR・spec 内の言及は時点の記録なので変更していない。

| 章 | タイトル | 対応する手法 |
|---|---|---|
| 第1章 | AIエージェントへの序章 | AE |
| 第2章 | Claude API と Anthropic Python SDK | PE |
| 第3章 | Context Engineering — Prompt Caching と Context Manager | CE |
| 第4章 | 型安全なツール設計と Structured Outputs | PE, HE |
| 第5章 | ModelRetry による自己修復エージェント | LE |
| 第6章 | MCP（Model Context Protocol）統合 | MCP |
| 第7章 | 4大ワークフローパターンと Pydantic Logfire トレース | LE, AO |
| 第8章 | 自律エージェントとデザインパターン | AE |
| 第9章 | Pydantic Logfire による高度なトレースと可観測性 | AO |
| 第10章 | Orchestrator-Workers アーキテクチャ | AE, HE |
| 第11章 | Agentic RAG — 反復検索と引用検証 | CE, LE |
| 第12章 | 自律型マルチエージェント・リサーチシステム（総合実践） | AE |
| 第13章 | 長期記憶・3層評価・Tool Guardrails | CE, EV, LE |
| 第14章 | デプロイと運用のベストプラクティス | AO |

## 学習パス（`from-genai-to-agentic-ai`）との対応

`from-genai-to-agentic-ai` は、Python / LangChain の書籍 3 冊を TypeScript / AI SDK v7 へ移植した
4 フェーズ・19 モジュールの学習パスである。各モジュールの解説は本ガイドの手法ページへ「本番ではどう作るか」
としてリンクし、本ガイドからは下表で学習パスへ戻る。**本文はどちらにも複製しない。**
逆向きの対応表の正本は同リポジトリの `specs/curriculum/README.md`「本番実装との対応」。

| 手法 | 学習パスのモジュール |
|---|---|
| PE | 1-2 AI SDK v7 Core とツール呼び出し、1-3 構造化出力と要約パイプライン |
| CE | 2-1 TypeScript ネイティブ RAG、2-2 Advanced RAG、4-1 コンテキストエンジニアリング |
| LE | 1-2、2-3 5大ワークフローパターン、4-4（強制停止条件） |
| HE | 3-1 ACI と MCP、3-2〜3-6 ドメインエージェント、4-2 長時間実行ハーネス |
| AE | 1-0 導入、2-3、2-4 エージェントデザインパターン、3-2〜3-6、4-5 総合演習 |
| AO | 4-4 安全設計・オブザーバビリティ |
| MCP | 3-1 ACI と MCP |
| EV | 4-3 Agent Evals |

学習パスのリファレンス実装（`@platform/ai-core`）は教材用の最小構成である。認証・RBAC、耐久ワークフロー、
承認の永続化といった本番の機能は本ハブにだけ置く。学習パス側で第 3 の本番実装を育てない。

## 関連

- [`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) — 8 手法の一次情報レビュー（本ガイドが骨格として使う ID 体系の正本）
- [`docs/cross-repo-adoption-review.md`](../cross-repo-adoption-review.md) — 5 リポジトリ横断の取り込み項目（X-1〜X-16）
- `specs/006-repo-consolidation/` — 本ガイドを構築した spec（Requirement 5）

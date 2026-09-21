# Model Context Protocol (MCP)

エージェントと外部ツール/データ源を繋ぐオープン標準。定義と MCP-1〜MCP-5 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.7 を参照。

## (a) このハブでの実装

- [`docs/adr/0001-mcp-position.md`](../adr/0001-mcp-position.md) — **現時点では MCP を採用しない**
  という判断を、採用トリガ条件・`needsApproval` ↔ MCP `destructiveHint` の写像方針つきで明文化。
  正本レビューが確認した**5 repo 中唯一の MCP 資産**

## (b) 兄弟リポジトリの教材

正本レビューが確認した時点（2026-09-06）で、MCP は 5 リポジトリすべてで実装ゼロ。
上記 ADR-0001 だけが唯一の資産であり、他リポジトリに参照できる実装・教材は無い。

## (c) 正本レビューの関連項目

- §3「見送るもの」— MCP の実装は 5 repo すべて未実装。MCP-1（「単一アプリ・少数ツールなら
  in-process で足りる」）の基準に現状いずれも該当するため、**実装ではなくこの ADR を横展開する**
  というのが正本レビューの結論

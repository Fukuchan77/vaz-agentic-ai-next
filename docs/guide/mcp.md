# Model Context Protocol (MCP)

エージェントと外部ツール/データ源を繋ぐオープン標準。定義と MCP-1〜MCP-5 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.7 を参照。

## (a) このハブでの実装

- [`docs/adr/0001-mcp-position.md`](../adr/0001-mcp-position.md) — **現時点では MCP を採用しない**
  という判断を、採用トリガ条件・`needsApproval` ↔ MCP `destructiveHint` の写像方針つきで明文化。
  正本レビューが確認した **5 repo 中唯一の採否 ADR**

## (b) 兄弟リポジトリの教材

正本レビューが確認した時点（2026-09-06）で、5 リポジトリの本番ランタイムに採用された
MCP server/client 実装はゼロだった。一方、`pydantic-ai-agentic-patterns` には
[第6章「MCP 統合」](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part2/ch06.md)
という教材がある。本ハブ固有の資産は、実装ではなく採否条件とセキュリティ原則を固定した
上記 ADR-0001 である。

なお、正本レビュー（[`docs/cross-repo-adoption-review.md`](../cross-repo-adoption-review.md) §1 の
横断マトリクス・§3 の「MCP の実装」行）が `pydantic-ai-agentic-patterns` を MCP「なし」「未実装」とするのは
本番ランタイム実装を指す。同文書は append-only のため本文は改めず、この読み方をここに記す。

## (c) 正本レビューの関連項目

- §3「見送るもの」— MCP の実装は 5 repo すべて未実装。MCP-1（「単一アプリ・少数ツールなら
  in-process で足りる」）の基準に現状いずれも該当するため、**実装ではなくこの ADR を横展開する**
  というのが正本レビューの結論

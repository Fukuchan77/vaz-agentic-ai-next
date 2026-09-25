# Documentation

このディレクトリは、文書の**役割**で配置を分ける。同じ主題の概要ページと詳細ページを別の階層に
作らず、1 つの正本から関連資料へリンクする。

## 配置

| パス | 役割 |
| --- | --- |
| [`guide/`](./guide/README.md) | 学習ガイドと、継続的に更新する運用・実装方針 |
| [`adr/`](./adr/) | 採用・不採用を確定したアーキテクチャ判断と再検討条件 |
| `docs/*.md` | 複数カテゴリを横断するレビュー、調査報告、ポリシー |

## 正本の選び方

- AgentOps の学習導線と運用ランブックは [`guide/agentops.md`](./guide/agentops.md) に統合する。
- コンテキストエンジニアリングとコンテキスト予算方針は
  [`guide/context-engineering.md`](./guide/context-engineering.md) に統合する。
- [`agentic-engineering-review.md`](./agentic-engineering-review.md) は 8 手法全体の一次情報レビュー、
  [`guide/agentic-engineering.md`](./guide/agentic-engineering.md) は AE 手法だけの実装・教材案内であり、
  役割が異なるため両方を維持する。
- 比較調査が採用判断に至り、その判断が実装済みになった文書は `spikes/` に残さず ADR に昇格する。
  耐久ワークフローは [`adr/0005-durable-workflow-engine.md`](./adr/0005-durable-workflow-engine.md)、
  IdP は [`adr/0006-idp-integration.md`](./adr/0006-idp-integration.md) が正本である。

## 追加・更新時のルール

1. 既存の正本へ追記できないか確認してから新規ファイルを作る。
2. 学習用の短い案内と実装詳細を分けない。ページ内の節として統合する。
3. 時点固定の比較・調査が決定に変わったら、ADR として `Status`、日付、再検討条件を残す。
4. 移動時はリポジトリ内の参照を更新し、`tests/repo/doc-links.spec.ts` で相対リンクを検証する。

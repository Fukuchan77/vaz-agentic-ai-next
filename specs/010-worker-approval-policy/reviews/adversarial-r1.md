# 010-worker-approval-policy — 敵対的レビュー 第 1 ラウンド

- **日付**: 2026-10-06
- **方法**: 実装者と文脈を共有しない新規コンテキストのエージェントが、`origin/main...HEAD`（4 コミット）を
  [`spec.md`](../spec.md) と憲章（原則 7・10）に照らして読み取り専用でレビューした（憲章 原則 10）。
- **対象 HEAD**: `ef6a2c3`

## 判定

| 重大度 | 件数 |
|---|---|
| CRITICAL | 0 |
| HIGH | 0 |
| MEDIUM | 1 |
| LOW | 3 |

CRITICAL が無いことの確認として、レビュー側が次を実測した。

- `workflowStepSchema` は未知のキーを剥がし、`runJob` がプランから読むのは `task.kind` だけである。
  kind は実行される specialist そのものを決めるので、クライアントが kind を変えて承認を避けると、
  実行内容も変わる。
- 表から `"data-processing"` を消すと、`apps/worker` の `tsc --noEmit` が TS2741 で落ちる（R1.1）。
- `approval-policy.ts` が実行時に読み込むのは `./prompt` だけで、どちらも外部依存は型のみである。
  `start.ts` の env テストを重くしない。

## 指摘と処置

| # | 重大度 | 指摘 | 処置 |
|---|---|---|---|
| 1 | MEDIUM | `start.ts` の配線（R2.1）を外しても worker の全テストが通る。`inngest.spec.ts` は `registerJobFunction` を直接呼ぶので `start.ts` を通らない。traceability の REQ-005 が過大 | `start.spec.ts` の配線テストに `requiresApprovalForKind` が `requiresApprovalForSpecialist` と同一であることの検査を足した。配線を `() => false` に戻すと失敗することを確認済み。REQ-005 の Test 列を差し替えた |
| 2 | LOW | backlog §3 の見出しが `実装状況(2026-09-08)` のまま | 見出しに X-9 の追記日を足した |
| 3 | LOW | backlog の X-9 の表の行が `() => false` を現状のように読める | 行に「2026-10-06 に 3 箇所とも着地。§3 参照」を足した（元の問題記述は残す） |
| 4 | LOW | tasks.md 4.3 が未チェックで、`reviews/` が無い | 本ファイルを置き、4.3 をチェックした |

未解決の指摘は無い。

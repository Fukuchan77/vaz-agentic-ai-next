# ADR-0004: 停止理由（stop reason）語彙 — TS 4 値と Python 5 値の非統一

- **Status**: Accepted
- **Date**: 2026-09-21
- **仕様根拠**: `specs/006-repo-consolidation/spec.md` R8.3, R8.4（本 ADR の起票元）、
  `docs/cross-repo-adoption-review.md` X-5（写像表の出典）、
  `packages/schemas/src/run-metrics.ts`（TS 側実装）、
  `services/api/app/agents/guardrails.py`（Python 側実装）

散文は日本語、識別子・型・パス・コードは英語（`spec.json` `language: ja` の慣例に合わせる）。

---

## Context

Task 6（`specs/006-repo-consolidation/`、`git subtree add --prefix=services/api`）の完了により、
このハブは**閉じた停止理由語彙を持つ 2 つの独立実装**を同一リポジトリ内に持つに至った:

- **TS 側**（`packages/schemas/src/run-metrics.ts:16`）: `runStopReasonSchema` が
  `"natural" | "step-cap" | "budget-exceeded" | "error"` の **4 値**を定義する。
  `@vaz/agents#deriveStopReason` が `{ finishReason, totalUsage, steps, budget, maxSteps }` から
  優先順位 `error` → `budget-exceeded` → `step-cap` → `natural` で導出する（AI SDK v7 の
  `finishReason` はトークン予算超過を区別しないため、直接読み替えられない）。この値は
  `runMetricsSchema`（`stopReason` フィールド）を経由して 2 か所へ流れる: `deps.audit.recordRun`
  （`runAuditEntrySchema`、監査ログへ永続化）と `JobEvent` の `completion.metrics`（SSE 配信、
  後方互換のため optional）。
- **Python 側**（`services/api/app/agents/guardrails.py:40`）: `StopReason` が
  `"completed" | "max_iterations" | "budget_exceeded" | "denied" | "disallowed_tool"` の
  **5 値**を定義する。`_GuardedToolset` が allow-list → 承認フック → 副作用前トークン予算の
  順で強制し、拒否ごとに `AuditTrail` へ記録して `ChatResponse.audit` としてクライアントへ返す。

正本レビュー X-5（`docs/cross-repo-adoption-review.md`）はこの 2 語彙を写像したが、
「今回は統一しない」として判断を先送りし、**両方を抱える repo（このハブ）が現れた時点で
決めること**を明示的な条件としていた。Task 6 の完了によりその条件が成立したため、
本 ADR で正式に裁定する。

## 写像表（X-5 からの引用・変更なし）

| Python 5 値 | TS 4 値 | 一致度 |
|---|---|---|
| `completed` | `natural` | 一致（名前のみ相違） |
| `max_iterations` | `step-cap` | 一致（名前のみ相違） |
| `budget_exceeded` | `budget-exceeded` | 一致（区切り文字のみ相違） |
| `denied` | — | TS 側に対応無し。承認拒否は `ApprovalDeniedError` 経路 |
| `disallowed_tool` | — | TS 側に対応無し。allow-list 違反は例外経路 |
| — | `error` | Python 側に対応無し。例外は `StopReason` に載らない |

## Decision

**語彙を強制統一しない。** TS 4 値・Python 5 値は、それぞれの言語ランタイム・監査経路に対して
現状のまま独立に運用する。

**根拠**（R8.4）:

1. **TS 4 値は後方互換の制約下にある。** `runStopReasonSchema` は `JobEvent.completion.metrics`
   （SSE wire）と `runAuditEntrySchema`（監査ログ永続化）の両方に既に出ており、値を追加・変更
   すると SSE クライアント（`useJobStream`）と既存の監査ログレコードの読み手の両方に影響する。
   5 値へ拡張する、あるいは名前を Python 側に揃える（`step-cap` → `max_iterations` 等）ことは、
   後方互換性の評価（既存 `JobEvent` 消費者の破壊有無、監査ログのマイグレーション要否）を
   経ずに行ってよい変更ではない。
2. **2 つの語彙は同じ抽象を指していない。** Python 5 値は `_GuardedToolset` という**単一の
   ゲート実装**が発する停止理由であり、`denied`/`disallowed_tool` はそのゲート固有の拒否理由で
   ある。TS 4 値は `deriveStopReason` という**ループ全体の集約**であり、個別ツールの拒否は
   `ApprovalDeniedError`（別の例外経路）としてそもそも `stopReason` の対象外に置かれている
   設計判断（`supervisor.ts` の「承認拒否ダックタイピング」）に基づく。**語彙の値数の違いは
   実装の未成熟ではなく、どのレイヤの停止を語彙化するかという設計の違いに由来する。**
   無理に合わせると、どちらかの設計意図を歪める。
3. **非対称性は許容できる形で説明がつく。** X-5 が指摘した非対称（Python 5 値は「なぜ止まったか」
   が監査ログ単独で完結するのに対し、TS 4 値は `error` の内訳を別経路 — 例外の型やメッセージ —
   と突き合わせる必要がある）は、上記 2 の設計差の帰結であり、TS 側が意図的に「ループレベルの
   `stopReason`」と「個別ツール拒否の例外」を分離しているために生じる。これは欠陥ではなく
   トレードオフであり、統一によって解消すべき不整合ではない。

## Consequences

- 2 つの語彙は**それぞれの型システムで別々に真**であり続ける。共有の型・共有の変換関数は
  作らない。将来どちらかの言語から他方を呼ぶ統合ポイントが生まれた場合（現状は存在しない
  — `apps/web`/`apps/worker` と `services/api` は HTTP 境界すら共有していない）、その時点で
  改めて変換方針（写像表のどの行を losslessly 変換できるか）を設計する。
- ドキュメント上は本 ADR と写像表を**唯一の参照点**とする。`docs/guide/loop-engineering.md`
  （Task 5 で作成）は既にこの写像表と本 ADR の起票条件を記載しており、変更不要。
- `pydantic-ai-agentic-patterns` の未解決 `I-H10`（停止理由が語彙化されておらず、トークン予算に
  よる停止も無い）を解消する場合、移植元は**必ず Python 5 値側**（`services/api` の
  `StopReason` ＋ 副作用前トークン予算）とする（R8.5、`docs/guide/agentic-engineering.md` に
  記載済み）。TS 4 値を移植元にしないのは、`I-H10` が対象とする教材コードが Python であり、
  言語を跨いだ変換より同言語内の直接移植の方が忠実度が高いため。

## Re-trigger Conditions

次のいずれかが成立した時点で、本 ADR（「統一しない」という決定そのもの）を再評価する:

1. **`apps/web`/`apps/worker` と `services/api` の間に、停止理由を跨がせる統合ポイントが
   生まれた時。** 例: `services/api` の RAG/chat 機能を `apps/web` の BFF 経由で呼び出す構成に
   なり、両者の `stopReason`/`StopReason` を 1 つの UI コンポーネントで表示する必要が生じた場合。
   その時点で写像表を使った変換関数を設計する（統一ではなく変換 — 1 と 2 の設計差は消えない）。
2. **TS 側で個別ツール拒否も `stopReason` に統合する設計変更が別の理由で行われた時。**
   `denied`/`disallowed_tool` 相当の値を TS 側へ追加する決定が下されれば、写像はほぼ完全に
   一致するようになり、本 ADR の「無理に合わせると設計意図を歪める」という根拠 2 が弱まる。

## References

- [`docs/cross-repo-adoption-review.md`](../cross-repo-adoption-review.md) X-5（写像表の出典）
- [`specs/006-repo-consolidation/spec.md`](../../specs/006-repo-consolidation/spec.md) R8.3, R8.4
- [`packages/schemas/src/run-metrics.ts`](../../packages/schemas/src/run-metrics.ts)（TS 4 値・`runMetricsSchema`）
- [`packages/schemas/src/deps.ts`](../../packages/schemas/src/deps.ts)（`runAuditEntrySchema` — 監査ログ経路）
- [`services/api/app/agents/guardrails.py`](../../services/api/app/agents/guardrails.py)（Python 5 値・`_GuardedToolset`）
- [`packages/agents/src/supervisor.ts`](../../packages/agents/src/supervisor.ts)（承認拒否ダックタイピングの設計判断）
- [`docs/guide/loop-engineering.md`](../guide/loop-engineering.md)（本 ADR への誘導ページ）
- [`docs/adr/0001-mcp-position.md`](./0001-mcp-position.md)（「採用条件つきで非採用を記録する」節構成の前例）

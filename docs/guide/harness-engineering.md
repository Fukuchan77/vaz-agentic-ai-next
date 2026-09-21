# ハーネスエンジニアリング (HE)

モデルの周囲の足場（ツール実行・状態管理・環境・復旧）の設計。定義と HE-1〜HE-6 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.4 を参照。

## (a) このハブでの実装

- [`apps/worker/src/inngest.ts`](../../apps/worker/src/inngest.ts) — `WorkflowStepRunner` seam に
  よるワーカー再起動を跨ぐ suspend/resume（HE-5）。エンジン非依存設計は ADR-2
- [`packages/agents/src/audit-hook.ts`](../../packages/agents/src/audit-hook.ts) — 単一発火点の
  ツール実行監査（web/worker 両パスを覆う）

## (b) 兄弟リポジトリの教材

- `fastapi-pydantic-ai-agent` [`app/api/v1/_stream.py`](https://github.com/Fukuchan77/fastapi-pydantic-ai-agent/blob/main/app/api/v1/_stream.py) — SSE ライフサイクルの 3 罠（anyio cancel scope のタスク跨ぎ制約、ハートビートは `asyncio.wait()`、U+2028/2029 のため `str.splitlines()` を使わない）
- `pydantic-ai-sandbox` [`patterns/hitl/`](https://github.com/Fukuchan77/pydantic-ai-sandbox/tree/main/patterns/hitl) — pydantic-ai v2 公式 deferred tools（`ApprovalRequired` → `DeferredToolRequests` → resume）と consume-once ステートマシン

## (c) 正本レビューの関連項目

- X-9（HITL — 重ならない防御を持つ 2 実装。sticky taint と独立 2 ゲート ↔ サーバ側履歴が正・consume-once）
- X-10（SSE ライフサイクルの 3 つの罠 — 再発見コストが極めて高い知見。このハブの `apps/web`
  `/api/chat` は Vercel AI Data Stream Protocol / SSE で同じ経路を通るため、`apps/web` 側の実装が
  この 3 罠に踏まないよう、着手前に `_stream.py` の一次情報を読むこと。旧 `vaz-agentic-ai-next`
  の `AGENTS.md`（現 `specs/inherited/`）は 1.・2. を記載していたが 3.（U+2028）は未記載だった —
  このハブの `AGENTS.md` には現時点でいずれも未記載）

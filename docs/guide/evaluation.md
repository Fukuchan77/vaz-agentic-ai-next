# エージェント評価 (EV)

エージェントの有用性を作る能力（自律性・多段行動）は評価を難しくするが、それでも評価は
自動化された第一防衛線である。定義と EV-1〜EV-6 は
[`docs/agentic-engineering-review.md`](../agentic-engineering-review.md) §1.8 を参照。

## (a) このハブでの実装

- [`packages/evals/src/pr-gate.ts`](../../packages/evals/src/pr-gate.ts) — ベースライン差分・
  over/under-trigger balance・case あたりトークン/所要時間。**20 件未満は `reportOnly`**
- [`packages/evals/src/judge.ts`](../../packages/evals/src/judge.ts) /
  [`nightly.ts`](../../packages/evals/src/nightly.ts) — 3 層 evals（tier1 単体 / tier2 / tier3 LLM judge）

## (b) 兄弟リポジトリの教材

- `pydantic-ai-sandbox` [`patterns/contracts/src/patterns_contracts/eval_graders.py`](https://github.com/Fukuchan77/pydantic-ai-sandbox/blob/main/patterns/contracts/src/patterns_contracts/eval_graders.py) — `Judge[SubjectT]` Protocol（judge をモデルから切り離す DI シーム）、`Rating` に `"unknown"` を持つ（証拠不足を無理に数値化しない）
- `fastapi-pydantic-ai-agent` [`evals/graders.py`](https://github.com/Fukuchan77/fastapi-pydantic-ai-agent/blob/main/evals/graders.py)（Outcome/Behavior 2 軸）・[`evals/pr_gate.py`](https://github.com/Fukuchan77/fastapi-pydantic-ai-agent/blob/main/evals/pr_gate.py)（このハブの `pr-gate.ts` の設計を Python へ移植したもの）
- `pydantic-ai-agentic-patterns` [第13章](https://github.com/Fukuchan77/pydantic-ai-agentic-patterns/blob/main/docs/part5/ch13.md) — 長期記憶・3 層評価・Tool Guardrails（`EvalSuite` 3 層）

## (c) 正本レビューの関連項目

- X-8（評価基盤 — 取り込みやすさで最良な `eval_graders.py`、運用として最も成熟した
  このハブの PR ゲート。3 repo が互いに欠けている脚を持つ）

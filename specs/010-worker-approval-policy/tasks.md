# 010-worker-approval-policy — Tasks

[`spec.md`](spec.md) の Requirement に対応する。`- [x]` 完了 / `- [ ]` 未着手。
要件の人間承認（憲章 原則 10）が済むまで、どのタスクにも着手しない。

---

## 1. ポリシー表（R1）

- [ ] 1.1 `packages/agents/tests/` に表と述語のテストを先に書き、RED を確認する（全 kind を網羅、全値 `false`、述語が表だけを読む）。
- [ ] 1.2 `packages/agents/src/approval-policy.ts` に表（`satisfies Record<SpecialistKind, boolean>`）と述語を足し、GREEN にする。

## 2. worker への配線（R2）

- [ ] 2.1 `apps/worker/tests/` に、代替の表を注入した `registerJobFunction` 経由のジョブが該当 kind のステップで suspend するテストを書く（R2.3）。
- [ ] 2.2 `packages/schemas/tests/workflows.spec.ts` に、`workflowStepSchema` が `requiresApproval` を剥がすテストを足す（R2.2）。
- [ ] 2.3 `apps/worker/src/start.ts` で `() => false` を述語に置き換える（R2.1）。

## 3. 記述の訂正（R3）

- [ ] 3.1 `start.ts` のコメント（R3.1）と `approval-resume.spec.ts` の SCOPE/FIDELITY 節（R3.2）を直す。
- [ ] 3.2 `docs/cross-repo-adoption-backlog.md` の X-9 を着地として記録する（R3.3）。
- [ ] 3.3 `docs/owasp-agentic-threats-mitigations-mapping.md` の引用を表へ向け直す（R3.4）。

## 4. 検証と記録（R4）

- [ ] 4.1 `mise run check` を通す。
- [ ] 4.2 `traceability.md` の Test / Commit 列を埋める。
- [ ] 4.3 新規コンテキストで敵対的レビューを 1 回行い、`reviews/` に記録する（憲章 原則 10）。

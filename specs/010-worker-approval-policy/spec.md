# 010-worker-approval-policy

## Project Description

X-9（HITL の配線）は 3 箇所のうち 2 箇所（chat の `sendEmail` 登録と `Chat.tsx` の承認 UI）が
着地済みで、残る 1 箇所が `apps/worker/src/start.ts` の `requiresApprovalForKind: () => false` である
（[`docs/cross-repo-adoption-backlog.md`](../../docs/cross-repo-adoption-backlog.md) §3）。

この 1 箇所の「正しい閉じ方」として、次の 4 箇所が **`workflowStepSchema` にステップ単位の承認要否フラグを足す**
という方針を書いている。

- `apps/worker/src/start.ts` のコメント
- `apps/web/tests/e2e/approval-resume.spec.ts` の SCOPE/FIDELITY 節
- `docs/cross-repo-adoption-backlog.md` の X-9 着地メモ
- `specs/007-cross-repo-adoption-closeout/spec.md` の Out of scope（spec 007 は完了済みのため本文は変えない）

しかしこの方針は憲章 v1.2.0 の原則 7 が **MUST NOT** として明示的に禁じている。プランは
`POST /api/jobs` でクライアントが送るので、承認要否がクライアント制御下に落ちるためである。
憲章が指定する形は、コミット済みのサーバ側述語（`requiresApprovalForKind`）である。

したがって本 spec は、クライアント側フラグを足さずに次の 2 点で X-9 を閉じる。

1. `() => false` という無名のラムダを、`SpecialistKind` を網羅するコミット済みのポリシー表に置き換える。
   新しい specialist kind を足すと、承認要否を明示的に決めない限り型検査が落ちるようにする
   （`MODEL_ALLOWLIST` の `satisfies Record<AiProvider, …>` と同じ統治）。
2. 憲章と食い違う古い記述を正す。

今日の 3 つの kind はどれも取り消し不能な操作をしない（`rag-research` は読むだけ、`document-generation`
はツールなしの `generateText`、`data-processing` は組み込み実装なし）。したがって表の値はすべて `false` のままとする。
原則 7 は承認ゲートを取り消し不能・高リスクな操作に限るので、`true` にする理由がない。

散文は日本語、識別子・型・パス・コードは英語。

---

## Requirements

既定の主語は THE VAZ platform。[E]=Event-driven / [U]=Ubiquitous / [O]=Optional。

### Requirement 1: kind 別の承認ポリシー表

1.1 [U] `@vaz/agents` SHALL export a committed, read-only table mapping every `SpecialistKind`
to whether a step of that kind requires human approval before it runs, typed
`satisfies Record<SpecialistKind, boolean>` so that adding a kind to `specialistKindSchema`
without an entry fails `mise run typecheck`.
1.2 [U] `@vaz/agents` SHALL export a predicate `(kind: SpecialistKind) => boolean` that reads
only that table. It SHALL NOT read env, the plan, the request, or any runtime state（原則 7: 実行時ヒューリスティック禁止）。
1.3 [U] Every entry SHALL be `false` while no specialist performs an irreversible or high-risk action.
A unit test SHALL pin each entry's value and that the table covers every `specialistKindSchema` option,
so flipping an entry is a reviewed change that also edits the test.
1.4 [U] The table and predicate SHALL live beside the chat approval policy
（`packages/agents/src/approval-policy.ts`）, keeping `@vaz/agents` the single owner of approval decisions.

### Requirement 2: worker の composition root での配線

2.1 [U] `apps/worker/src/start.ts` SHALL pass the Requirement 1.2 predicate as
`requiresApprovalForKind` instead of an inline `() => false`.
2.2 [U] `workflowStepSchema`, `supervisorPlanSchema`, and `POST /api/jobs` SHALL NOT gain any
field that sets or clears approval（原則 7 MUST NOT）。A unit test SHALL assert that
`workflowStepSchema` strips an injected `requiresApproval` key, so a later addition is caught.
2.3 [E] WHEN the table marks a kind as requiring approval, a job whose plan contains a step of that kind
SHALL suspend at that step through the same `registerJobFunction` options the composition root uses.
This SHALL be proven by a worker unit test that injects an alternative table, not by flipping the committed one.

### Requirement 3: 憲章と食い違う記述の訂正

3.1 [U] The comment above `requiresApprovalForKind` in `apps/worker/src/start.ts` SHALL describe the
policy table and SHALL NOT recommend a `workflowStepSchema` flag.
3.2 [U] The SCOPE/FIDELITY note in `apps/web/tests/e2e/approval-resume.spec.ts` SHALL be corrected the same way,
and SHALL stop claiming that `start.ts` passes no approval option.
3.3 [U] `docs/cross-repo-adoption-backlog.md` SHALL record X-9 as landed（3 箇所すべて）, citing this spec,
and SHALL keep the re-evaluation trigger: a specialist that performs an irreversible action flips its table entry.
3.4 [U] `docs/owasp-agentic-threats-mitigations-mapping.md` の残余リスク（`JOB_TOKEN_BUDGET` が本番ジョブで実効しない）
SHALL cite the policy table instead of the inline lambda. Its status and re-evaluation trigger SHALL NOT change.
3.5 [U] `specs/007-cross-repo-adoption-closeout/` and `docs/cross-repo-adoption-review.md` §1–§9 SHALL NOT be edited
（完了済み spec と追記のみ規約）。

### Requirement 4: 記録

4.1 [U] `tasks.md` and `traceability.md` SHALL map every requirement to its task, test, and commit.
4.2 [U] `mise run check` SHALL pass, including the `repo` project's doc-link and OWASP-citation guards.

---

## Out of scope

- **クライアント提出構造体への承認フラグ**（憲章 §7 MUST NOT）。
- **破壊的な worker specialist の追加**。表の値を `true` にするのはその変更の一部として扱う。
- **`JOB_TOKEN_BUDGET` を承認なしのジョブにも効かせること**。OWASP マッピングの残余リスク（Partial · accepted）のまま残す。
- **chat 側の承認ポリシー**（`createToolApprovalPolicy`）の変更。

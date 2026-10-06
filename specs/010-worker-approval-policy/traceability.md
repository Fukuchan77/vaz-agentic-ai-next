# 010-worker-approval-policy — Traceability

`REQ-###` は [`spec.md`](spec.md) の `<Requirement>.<n>` の並び順の通し番号である。
Commit 列はコミットの件名で書く。

| REQ | spec.md | Task | Test | Commit |
|-----|---------|------|------|--------|
| REQ-001 | 1.1 | T-1.1, T-1.2 | `approval-policy.spec.ts`（kind 網羅）、worker の `tsc --noEmit`（エントリ欠落で TS2741 を確認） | `feat(agents): add the committed per-kind specialist approval policy` |
| REQ-002 | 1.2 | T-1.1, T-1.2 | `approval-policy.spec.ts`（`requiresApprovalForSpecialist`） | `feat(agents): add the committed per-kind specialist approval policy` |
| REQ-003 | 1.3 | T-1.1 | `approval-policy.spec.ts`（全値 `false` の固定、`Object.isFrozen`） | `feat(agents): add the committed per-kind specialist approval policy` |
| REQ-004 | 1.4 | T-1.2 | — | `feat(agents): add the committed per-kind specialist approval policy` |
| REQ-005 | 2.1 | T-2.3 | `inngest.spec.ts`（committed policy で suspend しない） | `feat(worker): drive requiresApprovalForKind from the committed policy table` |
| REQ-006 | 2.2 | T-2.2 | `workflows.spec.ts`（`requiresApproval` の除去） | `feat(worker): drive requiresApprovalForKind from the committed policy table` |
| REQ-007 | 2.3 | T-2.1 | `inngest.spec.ts`（代替の表で suspend し `registerPending` を呼ぶ） | `feat(worker): drive requiresApprovalForKind from the committed policy table` |
| REQ-008 | 3.1 | T-3.1 | — | `feat(worker): drive requiresApprovalForKind from the committed policy table` |
| REQ-009 | 3.2 | T-3.1 | — | `docs(spec 010): correct the stale approval-flag guidance and record X-9 as landed` |
| REQ-010 | 3.3 | T-3.2 | `doc-links.spec.ts` | `docs(spec 010): correct the stale approval-flag guidance and record X-9 as landed` |
| REQ-011 | 3.4 | T-3.3 | `owasp-mapping-citations.spec.ts` | `docs(spec 010): correct the stale approval-flag guidance and record X-9 as landed` |
| REQ-012 | 3.5 | — | —（変更なし） | — |
| REQ-013 | 4.1 | T-4.2 | — | `docs(spec 010): correct the stale approval-flag guidance and record X-9 as landed` |
| REQ-014 | 4.2 | T-4.1 | `mise run check`（pre-commit で実行） | `docs(spec 010): correct the stale approval-flag guidance and record X-9 as landed` |

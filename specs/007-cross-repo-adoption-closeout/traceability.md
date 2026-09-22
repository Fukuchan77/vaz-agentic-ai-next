# 007-cross-repo-adoption-closeout — Traceability

`/sdd-tasks` が骨格を生成し、Test / Commit 列は `/sdd-ship`（およびタスク 13.3）が埋める。
1 行 = 1 受け入れ基準（`spec.md` の階層 ID）。Task 列が空の行は網羅漏れ。
本ファイルは [`plan.md`](plan.md) の C-14 が要求する記録そのもの（R12.7）。

## ID 規約

`~/.claude/sdd/rules/analysis.md` の規約を本 spec の文書構造へ写像する:

| ID 形 | 指すもの |
|---|---|
| `REQ-00n` | [`spec.md`](spec.md) の `### Requirement n` 見出し。括弧内は受け入れ基準の階層 ID |
| `DES-3.n` | [`plan.md`](plan.md) `## Components` の `### C-n`（`DES-3.1` = C-1 … `DES-3.14` = C-14） |
| `DES-4` | [`plan.md`](plan.md) `## Data Model` |
| `DES-5.n` | [`plan.md`](plan.md) `## Interfaces / Contracts` の `### IF-n` |
| `DES-7` | [`plan.md`](plan.md) `## Error Handling & Edge Cases` |
| `T-#.#` | [`tasks.md`](tasks.md) のタスク番号 |

| Requirement | Design | Task | Test | Commit |
|-------------|--------|------|------|--------|
| REQ-001 (1.1) | DES-3.1, DES-3.4 | T-2.3, T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "Agentic document threat index has exactly 15 rows" ✓ (guard + doc both green) | `4c4e0b8` |
| REQ-001 (1.2) | DES-3.1, DES-3.3 | T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — T11-T15 sections present, each with status token | `4c4e0b8` |
| REQ-001 (1.3) | DES-3.1 | T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — symbol citations for WorkflowStepRunner/SpecialistUnavailableError resolve in supervisor.ts | `4c4e0b8` |
| REQ-001 (1.4) | DES-3.1, DES-3.4 | T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — T11-T15 each have Accepted/Partial · accepted + 再評価トリガ | `4c4e0b8` |
| REQ-001 (1.5) | DES-3.1, DES-3.4 | T-3.3, T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all path citations" + "all symbol citations" green (Agentic doc) | `4c4e0b8` |
| REQ-001 (1.6) | DES-3.1, DES-3.4, DES-5.4 | T-2.3, T-3.2, T-3.5, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "index has 15 rows" + "every threat section is listed exactly once" ✓ | `4c4e0b8` |
| REQ-002 (2.1) | DES-3.1, DES-3.2, DES-3.3, DES-3.4 | T-2.3, T-3.2, T-3.3, T-4.2 | `tests/repo/owasp-mapping-citations.spec.ts` — "status-line count … exactly 1 per section" green (Agentic doc) | `4c4e0b8` |
| REQ-002 (2.2) | DES-3.1, DES-3.2, DES-3.4 | T-3.3, T-4.2 | `tests/repo/owasp-mapping-citations.spec.ts` — no旧2値 markers in Agentic doc (guard passes) | `4c4e0b8` |
| REQ-002 (2.3) | DES-3.1, DES-3.2, DES-3.4 | T-2.3, T-3.3, T-4.2 | `tests/repo/owasp-mapping-citations.spec.ts` — "all accepted sections … have re-evaluation triggers" green (Agentic doc) | `4c4e0b8` |
| REQ-002 (2.4) | DES-3.1, DES-3.2 | T-3.3, T-4.2 | 再評価トリガ are concrete future events (human review; not verified mechanically — per plan) | `4c4e0b8` |
| REQ-002 (2.5) | DES-3.3 | T-3.2, T-4.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "preamble contains an ISO-8601 taxonomy version date" green (Agentic doc) | `4c4e0b8` |
| REQ-002 (2.6) | DES-3.1, DES-3.2 | T-3.3, T-4.3 | Overwhelming HITL → Partial · accepted; Misaligned → Accepted; both have 再評価トリガ | `4c4e0b8` |
| REQ-003 (3.1) | DES-3.1 | T-3.1 | `tests/repo/doc-links.spec.ts` — new filename resolves; `cross-repo-reference-resolution.spec.ts` green | `4c4e0b8` |
| REQ-003 (3.2) | DES-3.1 | T-3.1 | Agentic doc has no ASI mention (grep confirms); filename now matches content | `4c4e0b8` |
| REQ-003 (3.3) | DES-3.1, DES-3.2, DES-3.4 | T-3.2, T-4.1, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "preamble … ISO-8601 date" green (Agentic doc); LLM doc pending T-4 | `4c4e0b8` |
| REQ-003 (3.4) | DES-3.1, DES-3.2, DES-3.13 | T-3.1, T-4.3 | `tests/repo/doc-links.spec.ts` ✓ all 6 reference files updated | `4c4e0b8` |
| REQ-003 (3.5) | DES-3.1, DES-3.2 | T-3.1, T-4.3 | cross-ref docs/owasp-llm-top10-mapping.md:12 updated to new filename | `4c4e0b8` |
| REQ-004 (4.1) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all path citations in … exist" (T-2.2 guard; full GREEN on T-4.4 documents) | `b99912c` |
| REQ-004 (4.2) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all symbol citations in … are resolvable" (T-2.2 guard; full GREEN on T-4.4 documents) | `b99912c` |
| REQ-004 (4.3) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all CI citations in … are valid" (T-2.2 guard; full GREEN on T-4.4 documents) | `b99912c` |
| REQ-004 (4.4) | DES-3.4 | T-2.3, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all status tokens in … are valid" (T-2.3 guard; full GREEN on T-4.4 documents) | `b99912c` |
| REQ-004 (4.5) | DES-3.4 | T-2.3, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "preamble contains an ISO-8601 taxonomy version date" (T-2.3 guard; full GREEN on T-4.4 documents) | `b99912c` |
| REQ-004 (4.6) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "exactly 2 mapping documents are declared" + per-doc "document exists" + "> 0" non-empty asserts (T-2.1 ✓) | `b99912c` |
| REQ-004 (4.7) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "document exists: docs/owasp-*.md" asserts (T-2.1 ✓) | `b99912c` |
| REQ-004 (4.8) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` lives in `tests/repo/` project, no new workflow file added (T-2.1 ✓) | `b99912c` |
| REQ-005 (5.1) | DES-3.7 | T-5.1, T-5.2 | `packages/schemas/tests/workflows.spec.ts` — "approval wire contracts" (UUID toolCallId, approve/reject, strict reject on history/usage/model) | `4d60458` |
| REQ-005 (5.2) | DES-3.7, DES-3.8, DES-3.12, DES-5.1 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` + `apps/web/tests/jobs-approve-route.spec.ts` — "returns 400 when single form carries an extra field" ✓ | `c495961` |
| REQ-005 (5.3) | DES-3.12, DES-7 | T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT consume approval targets when schema validation fails" ✓ | `c495961` |
| REQ-005 (5.4) | DES-3.12 | T-10.1 | `apps/web/tests/jobs-approve-route.spec.ts` — server-side plan/step composition (route delegates to engine; no client-supplied history) ✓ | `c495961` |
| REQ-005 (5.5) | DES-3.8, DES-3.12 | T-9.2, T-10.2 | `apps/web/tests/approvals.spec.ts` + `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT consume approval targets when schema validation fails" ✓ | `c495961` |
| REQ-006 (6.1) | DES-3.9, DES-3.11, DES-5.2 | T-7.1, T-7.2, T-8.1, T-8.2, T-8.3, T-9.3 | `apps/worker/tests/stores-job-step.spec.ts` — registerPending ON CONFLICT DO NOTHING; `apps/worker/tests/main.spec.ts` — INV-1 order ✓; `apps/worker/tests/durability.spec.ts` — submitApproval id field ✓ | `18d7330` |
| REQ-006 (6.2) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "single-form not-claimable → 404"; "set-form not-claimable → 409" ✓ | `c495961` |
| REQ-006 (6.3) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "404 body does NOT contain the toolCallId or state word" ✓ | `c495961` |
| REQ-006 (6.4) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "single-form 404 and 409 bodies are identical" ✓ | `c495961` |
| REQ-006 (6.5) | DES-3.12 | T-10.3 | `apps/web/tests/jobs-approve-route.spec.ts` Section A — "authorization (R5.1)" 4 tests unchanged ✓ | `c495961` |
| REQ-006 (6.6) | DES-3.9, DES-4 | T-6.1, T-6.2, T-6.3, T-7.2, T-8.1, T-8.2 | `packages/db/tests/schema.spec.ts` (`job_step` columns, composite PK, FK cascade) + `packages/db/tests/schema-ddl.spec.ts` (`0002_add_job_step.sql` drift guard) + `apps/worker/tests/main.spec.ts` — "omitting jobStepStore is a no-op" ✓ | `18d7330` |
| REQ-007 (7.1) | DES-3.9, DES-3.11, DES-4 | T-6.1, T-6.2, T-7.1, T-7.2, T-8.1, T-8.2 | `packages/db/tests/schema.spec.ts` (`approvalStateEnum`, `total_tokens` default 0) + `apps/worker/tests/stores-job-step.spec.ts` — registerPending / recordStepUsage / claimPending + `apps/worker/tests/main.spec.ts` — "recordStepUsage is called with totalTokens from the specialist's completion event" ✓ | `18d7330` |
| REQ-007 (7.2) | DES-3.8, DES-3.12 | T-9.1, T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "returns 429 when budget is exceeded"; "does NOT call submitApproval when budget is exceeded" ✓ | `c495961` |
| REQ-007 (7.3) | DES-3.8, DES-3.12 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "claimApprovalTargets WAS called (rows consumed)" ✓ | `c495961` |
| REQ-007 (7.4) | DES-3.10, DES-5.5 | T-5.3 | `packages/schemas/tests/env.spec.ts` — `aiEnvSchema JOB_TOKEN_BUDGET` (default 200_000, coerce, positive/int constraints) | `4d60458` |
| REQ-007 (7.5) | DES-3.9, DES-4 | T-6.2, T-13.2 | `packages/db/tests/schema.spec.ts` (existing 6 tables & `jobEventTypeEnum` unchanged) | `18d7330` |
| REQ-007 (7.6) | DES-3.8, DES-3.11 | T-8.1, T-8.2, T-9.3 | `apps/worker/tests/main.spec.ts` — "recordStepUsage is called with totalTokens from the specialist's completion event" (server-observed absolute value, R7.6) | pending |
| REQ-008 (8.1) | DES-3.8 | T-9.1, T-9.2, T-9.4 | `apps/web/tests/approvals.spec.ts` — "records args as masked key names only — never values" + "records with tool='approval:decision'" | `5df606d` |
| REQ-008 (8.2) | DES-3.6, DES-3.8 | T-9.4, T-11.2 | `apps/web/tests/approvals.spec.ts` — single `recordApprovalDecisions` call site; `tests/repo/egress-policy-bypass.spec.ts` — "audit.record() call appears only in the single authorised firing point" ✓ | `5df606d` / T-11 |
| REQ-008 (8.3) | DES-3.8 | T-9.1, T-9.4 | `apps/web/tests/approvals.spec.ts` — "does NOT throw and returns successfully when audit sink fails (fail-soft)" | `5df606d` |
| REQ-008 (8.4) | DES-3.8 | T-9.1, T-9.4 | `apps/web/tests/approvals.spec.ts` — "logs error with correlation only (no raw args) when audit sink fails" | `5df606d` |
| REQ-008 (8.5) | DES-3.6 | T-11.2, T-13.2 | `tests/repo/egress-policy-bypass.spec.ts` — "audit.record() call appears only in the single authorised firing point" + "authorised audit firing point actually contains audit.record()" ✓ (packages/agents/src/audit-hook.ts excluded by design) | T-11 |
| REQ-008 (8.6) | DES-3.8 | T-9.4 | `apps/web/tests/approvals.spec.ts` — "includes callerId as userId and jobId in the audit entry" | `5df606d` |
| REQ-009 (9.1) | DES-3.7, DES-3.12 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalDecisionSchema` accepts valid single decision | `4d60458` |
| REQ-009 (9.2) | DES-3.8, DES-3.9, DES-5.2 | T-7.1, T-7.2, T-9.3, T-10.1 | `apps/worker/tests/stores-job-step.spec.ts` — claimPending ✓; `apps/web/tests/approvals.spec.ts` — "returns not-claimable when rowCount is 0" ✓; `apps/web/tests/jobs-approve-route.spec.ts` — "set-form not-claimable → 409" ✓ | `c495961` |
| REQ-009 (9.3) | DES-3.7, DES-3.8 | T-5.2, T-9.1, T-9.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalDecisionSetSchema` min(1) and strictObject | `4d60458` |
| REQ-009 (9.4) | DES-3.7, DES-3.12 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalRequestSchema` discriminated union | `4d60458` |
| REQ-009 (9.5) | DES-3.8, DES-3.12 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "409 body does NOT reveal which toolCallId was the duplicate" ✓ | `c495961` |
| REQ-009 (9.6) | DES-3.8, DES-3.9 | T-7.1, T-7.2, T-9.3 | `apps/worker/tests/stores-job-step.spec.ts` — recordStepUsage absolute upsert ✓; `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT call claimApprovalTargets when duplicates are detected" ✓ | `c495961` |
| REQ-010 (10.1) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "no email-address literals in app/package source files" + "no allowlist-override patterns in app/package source files" ✓ | T-11 |
| REQ-010 (10.2) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "scans at least 1 source file for email literals (non-vacuity)" + "scans at least 1 file for audit-firing-point check (non-vacuity)" ✓ | T-11 |
| REQ-010 (10.3) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "exception list is non-empty and every listed path exists" ✓ | T-11 |
| REQ-010 (10.4) | DES-3.6 | T-11.3 | `tests/repo/egress-policy-bypass.spec.ts` — file-level comment cites `pydantic-ai-sandbox/patterns/hitl/tests/test_egress_policy.py` (code span) + CVE-2026-46678 ✓ | T-11 |
| REQ-010 (10.5) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` lives in `tests/repo/` project; no new workflow file added ✓ | T-11 |
| REQ-011 (11.1) | DES-3.13 | T-12.2 | | |
| REQ-011 (11.2) | DES-3.13 | T-12.1 | | |
| REQ-011 (11.3) | DES-3.13 | T-12.1 | | |
| REQ-011 (11.4) | DES-3.13 | T-3.1, T-12.1 | `tests/repo/doc-links.spec.ts` ✓ — link-only corrections in review.md §7.6 and specs/review/… (T-3.1 done; §8 addendum pending T-12) | `4c4e0b8` |
| REQ-011 (11.5) | DES-3.13 | T-12.3 | | |
| REQ-011 (11.6) | DES-3.5, DES-3.13 | T-1.1, T-1.2, T-3.1, T-12.3 | `tests/repo/cross-repo-reference-resolution.spec.ts` — "QUALIFIED_FORM regression" describe (3 tests: T-1.1 pin; T-1.2 fix verified by same tests) | |
| REQ-011 (11.7) | DES-3.13 | T-12.1 | | |
| REQ-012 (12.1) | DES-3.14 | T-13.2 | | |
| REQ-012 (12.2) | DES-3.14 | T-13.2 | | |
| REQ-012 (12.3) | DES-3.14 | T-13.2 | | |
| REQ-012 (12.4) | DES-3.14 | T-13.1 | | |
| REQ-012 (12.5) | DES-3.14 | T-10.1, T-13.3 | | |
| REQ-012 (12.6) | DES-3.8, DES-3.14 | T-13.2 | | |
| REQ-012 (12.7) | DES-3.14 | T-13.3 | | |

## Gaps

- 受け入れ基準の網羅漏れ: **None**（73/73 が 1 つ以上のタスクに割り当て済み）。
- 要件に紐づかないタスク（orphan）: **None**（全 13 major / 41 sub が `_Requirements:_` を持つ）。
- 非空虚性の確認（R12.4）は Test 列と併せてタスク 13.1 で埋める。未記入は「未確認」を意味する。

## plan による spec の訂正（タスク 13.3 で本表へ反映する）

[`plan.md`](plan.md) の「spec に対する訂正 3 点」を実装時の正とする:

1. R12.2 の「既存 6 本」は実測 **7 本**（`api.yml`）。要件の意図（新規ワークフローを追加しない）は不変。
2. R3.4 の参照列挙にある `AGENTS.md` には旧名参照が**無い**。代わりに
   [`gap-analysis.md`](gap-analysis.md) が旧名へのリンクを持つ（是正対象）。
3. R6.2 の「3 ケースで同一のステータス（404）」は**ケース間の区別不能性**（R6.4）の要求であり、
   ステータス値そのものの固定ではない。単一形 → 404 / セット形 → 409（R9.2）はその下位実装。

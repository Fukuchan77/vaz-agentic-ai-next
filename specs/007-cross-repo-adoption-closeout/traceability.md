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

| Requirement | Design | Task | Test | Non-vacuity | Commit |
|-------------|--------|------|------|-------------|--------|
| REQ-001 (1.1) | DES-3.1, DES-3.4 | T-2.3, T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "Agentic document threat index has exactly 15 rows" ✓ (guard + doc both green) | 索引表の行を 15 → 14 に削ると "exactly 15 rows" が `expected 14 to be 15` で FAIL（PDCA do.md T-3 PROVE） | `4c4e0b8` |
| REQ-001 (1.2) | DES-3.1, DES-3.3 | T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — T11-T15 sections present, each with status token | T11〜T15 節のうち 1 節の `- 状態:` を削ると "status-line count … exactly 1 per section" で FAIL（PDCA do.md T-3 PROVE） | `4c4e0b8` |
| REQ-001 (1.3) | DES-3.1 | T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — symbol citations for WorkflowStepRunner/SpecialistUnavailableError resolve in supervisor.ts | `WorkflowStepRunner` シンボルを `supervisor.ts` から削ると "symbol citations … resolvable" が FAIL（PDCA do.md T-3 PROVE） | `4c4e0b8` |
| REQ-001 (1.4) | DES-3.1, DES-3.4 | T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — T11-T15 each have Accepted/Partial · accepted + 再評価トリガ | T14 節の `- 再評価トリガ:` 行を削ると "all accepted sections … have re-evaluation triggers" が FAIL（PDCA do.md T-3 PROVE） | `4c4e0b8` |
| REQ-001 (1.5) | DES-3.1, DES-3.4 | T-3.3, T-3.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all path citations" + "all symbol citations" green (Agentic doc) | 存在しないパスを `- 実装:` 行に書くと "all path citations … exist" が FAIL（PDCA do.md T-3 PROVE） | `4c4e0b8` |
| REQ-001 (1.6) | DES-3.1, DES-3.4, DES-5.4 | T-2.3, T-3.2, T-3.5, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "index has 15 rows" + "every threat section is listed exactly once" ✓ | 索引に同一脅威名を 2 行書くと "every threat section is listed in the index exactly once" が FAIL（PDCA do.md T-3 PROVE） | `4c4e0b8` |
| REQ-002 (2.1) | DES-3.1, DES-3.2, DES-3.3, DES-3.4 | T-2.3, T-3.2, T-3.3, T-4.2 | `tests/repo/owasp-mapping-citations.spec.ts` — "status-line count … exactly 1 per section" green (Agentic doc) | 節に `- 状態:` を 2 行書くと "exactly 1 per section" が FAIL（PDCA do.md T-3 PROVE） | `4c4e0b8` |
| REQ-002 (2.2) | DES-3.1, DES-3.2, DES-3.4 | T-3.3, T-4.2 | `tests/repo/owasp-mapping-citations.spec.ts` — no旧2値 markers in Agentic doc (guard passes) | ガード側の `VALID_STATUS_TOKENS` は 3 値固定。旧 2 値を書くと "all status tokens … are valid" が FAIL（PDCA do.md T-4 PROVE） | `4c4e0b8` |
| REQ-002 (2.3) | DES-3.1, DES-3.2, DES-3.4 | T-2.3, T-3.3, T-4.2 | `tests/repo/owasp-mapping-citations.spec.ts` — "all accepted sections … have re-evaluation triggers" green (Agentic doc) | `Partial · accepted` / `Accepted` 節から `- 再評価トリガ:` を削ると FAIL（PDCA do.md T-3 PROVE） | `4c4e0b8` |
| REQ-002 (2.4) | DES-3.1, DES-3.2 | T-3.3, T-4.2 | 再評価トリガ are concrete future events (human review; not verified mechanically — per plan) | 機械検証なし（plan 設計意図）。文書レビューで確認。 | `4c4e0b8` |
| REQ-002 (2.5) | DES-3.3 | T-3.2, T-4.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "preamble contains an ISO-8601 taxonomy version date" green (Agentic doc) | 前文から ISO-8601 日付行を削ると "preamble contains an ISO-8601 taxonomy version date" が FAIL（PDCA do.md T-3/T-4 PROVE） | `4c4e0b8` |
| REQ-002 (2.6) | DES-3.1, DES-3.2 | T-3.3, T-4.3 | Overwhelming HITL → Partial · accepted; Misaligned → Accepted; both have 再評価トリガ | 上記 REQ-002 (2.3) と同一ガード経路で確認済み | `4c4e0b8` |
| REQ-003 (3.1) | DES-3.1 | T-3.1 | `tests/repo/doc-links.spec.ts` — new filename resolves; `cross-repo-reference-resolution.spec.ts` green | `git mv` 前の旧ファイル名で `doc-links.spec.ts` を走らせると FAIL（Task 3.1 施工前に確認） | `4c4e0b8` |
| REQ-003 (3.2) | DES-3.1 | T-3.1 | Agentic doc has no ASI mention (grep confirms); filename now matches content | ASI 文字列を文書に追加しても機械テストは無い（文書レビューで確認） | `4c4e0b8` |
| REQ-003 (3.3) | DES-3.1, DES-3.2, DES-3.4 | T-3.2, T-4.1, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "preamble … ISO-8601 date" green (Agentic doc); LLM doc pending T-4 | REQ-002 (2.5) と同一ガード経路で確認済み | `4c4e0b8` |
| REQ-003 (3.4) | DES-3.1, DES-3.2, DES-3.13 | T-3.1, T-4.3 | `tests/repo/doc-links.spec.ts` ✓ all 6 reference files updated | 参照更新前に `doc-links.spec.ts` を走らせると FAIL（Task 3.1 施工過程で確認） | `4c4e0b8` |
| REQ-003 (3.5) | DES-3.1, DES-3.2 | T-3.1, T-4.3 | cross-ref docs/owasp-llm-top10-mapping.md:12 updated to new filename | `doc-links.spec.ts` が双方向の相互参照を守る（上記と同一テスト） | `4c4e0b8` |
| REQ-004 (4.1) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all path citations in … exist" (T-2.2 guard; full GREEN on T-4.4 documents) | 存在しないパスを `- 実装:` に追記すると "all path citations … exist" が FAIL（PDCA do.md T-3 PROVE） | `b99912c` |
| REQ-004 (4.2) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all symbol citations in … are resolvable" (T-2.2 guard; full GREEN on T-4.4 documents) | 存在しないシンボル名を `- 実装: file.ts#nonExistent` に書くと FAIL（PDCA do.md T-3 PROVE） | `b99912c` |
| REQ-004 (4.3) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all CI citations in … are valid" (T-2.2 guard; full GREEN on T-4.4 documents) | 存在しないステップ名を `- CI:` に書くと "all CI citations … are valid" が FAIL（PDCA do.md T-4 PROVE） | `b99912c` |
| REQ-004 (4.4) | DES-3.4 | T-2.3, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all status tokens in … are valid" (T-2.3 guard; full GREEN on T-4.4 documents) | `- 状態:` に `Mitigated` 以外の任意文字列を書くと "all status tokens … are valid" が FAIL（PDCA do.md T-4 PROVE） | `b99912c` |
| REQ-004 (4.5) | DES-3.4 | T-2.3, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "preamble contains an ISO-8601 taxonomy version date" (T-2.3 guard; full GREEN on T-4.4 documents) | REQ-002 (2.5) と同一ガード経路で確認済み | `b99912c` |
| REQ-004 (4.6) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "exactly 2 mapping documents are declared" + per-doc "document exists" + "> 0" non-empty asserts (T-2.1 ✓) | `MAPPING_DOCS` 配列から片方を削ると "exactly 2 mapping documents" が FAIL（PDCA do.md T-2 PROVE） | `b99912c` |
| REQ-004 (4.7) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "document exists: docs/owasp-*.md" asserts (T-2.1 ✓) | 文書ファイルを削除すると "document exists: …" が FAIL（上記と同一アサート） | `b99912c` |
| REQ-004 (4.8) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` lives in `tests/repo/` project, no new workflow file added (T-2.1 ✓) | `.github/workflows/` に新規ファイルを追加すると `ci-workflows.spec.ts` の "SHA-pinned" テストが FAIL（既存ガード） | `b99912c` |
| REQ-005 (5.1) | DES-3.7 | T-5.1, T-5.2 | `packages/schemas/tests/workflows.spec.ts` — "approval wire contracts" (UUID toolCallId, approve/reject, strict reject on history/usage/model) | T-13.1 実施: `z.strictObject` → `z.object` に変えると "rejects excess / forbidden fields in single decision" が `expected true to be false` で FAIL（本タスク実証） |  `4d60458` |
| REQ-005 (5.2) | DES-3.7, DES-3.8, DES-3.12, DES-5.1 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` + `apps/web/tests/jobs-approve-route.spec.ts` — "returns 400 when single form carries an extra field" ✓ | T-10 PROVE: `z.strictObject` → `z.object` に変えると "returns 400 when single form carries an extra field" が `expected 400 to be 202` で FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-005 (5.3) | DES-3.12, DES-7 | T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT consume approval targets when schema validation fails" ✓ | 400 分岐を削ると "does NOT consume approval targets when schema validation fails" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-005 (5.4) | DES-3.12 | T-10.1 | `apps/web/tests/jobs-approve-route.spec.ts` — server-side plan/step composition (route delegates to engine; no client-supplied history) ✓ | route.ts が `lib/approvals.ts` 経由でのみ `submitApproval` を呼ぶ構造。呼び出し箇所を削ると 202 が返らなくなり FAIL | `c495961` |
| REQ-005 (5.5) | DES-3.8, DES-3.12 | T-9.2, T-10.2 | `apps/web/tests/approvals.spec.ts` + `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT consume approval targets when schema validation fails" ✓ | REQ-005 (5.3) と同一テスト経路で確認済み | `c495961` |
| REQ-006 (6.1) | DES-3.9, DES-3.11, DES-5.2 | T-7.1, T-7.2, T-8.1, T-8.2, T-8.3, T-9.3 | `apps/worker/tests/stores-job-step.spec.ts` — registerPending ON CONFLICT DO NOTHING; `apps/worker/tests/main.spec.ts` — INV-1 order ✓; `apps/worker/tests/durability.spec.ts` — submitApproval id field ✓ | T-7 PROVE: `createJobStepStore` 未実装時に全 11 テストが `TypeError` で FAIL。T-8 PROVE: `registerPending` と `approvalGate` の順序を入れ替えると INV-1 アサートが FAIL（PDCA do.md T-7/T-8 PROVE） | `a707139` |
| REQ-006 (6.2) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "single-form not-claimable → 404"; "set-form not-claimable → 409" ✓ | T-10 PROVE: `case "not-claimable"` 削除で "single-form not-claimable → 404" が `expected 404 to be 202` で FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-006 (6.3) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "404 body does NOT contain the toolCallId or state word" ✓ | 404 ボディに toolCallId を含めると "does NOT contain" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-006 (6.4) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "single-form 404 and 409 bodies are identical" ✓ | 2 分岐のボディを変えると "bodies are identical" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-006 (6.5) | DES-3.12 | T-10.3 | `apps/web/tests/jobs-approve-route.spec.ts` Section A — "authorization (R5.1)" 4 tests unchanged ✓ | Section A 4 テストは T-10 後も無改変で GREEN。route 書き替え時に意図的に実行して確認（PDCA do.md T-10 実施内容） | `c495961` |
| REQ-006 (6.6) | DES-3.9, DES-4 | T-6.1, T-6.2, T-6.3, T-7.2, T-8.1, T-8.2 | `packages/db/tests/schema.spec.ts` (`job_step` columns, composite PK, FK cascade) + `packages/db/tests/schema-ddl.spec.ts` (`0002_add_job_step.sql` drift guard) + `apps/worker/tests/main.spec.ts` — "omitting jobStepStore is a no-op" ✓ | T-6 PROVE: `approvalStateEnum` の順序を反転すると schema.spec.ts / schema-ddl.spec.ts が `expected [ 'consumed', 'pending' ] to deeply equal [ 'pending', 'consumed' ]` で FAIL（PDCA do.md T-6 PROVE） | `a707139` |
| REQ-007 (7.1) | DES-3.9, DES-3.11, DES-4 | T-6.1, T-6.2, T-7.1, T-7.2, T-8.1, T-8.2 | `packages/db/tests/schema.spec.ts` (`approvalStateEnum`, `total_tokens` default 0) + `apps/worker/tests/stores-job-step.spec.ts` — registerPending / recordStepUsage / claimPending + `apps/worker/tests/main.spec.ts` — "recordStepUsage is called with totalTokens from the specialist's completion event" ✓ | T-7 PROVE: 実装前に全 11 テストが FAIL。`recordStepUsage` ブロックをコメントアウトすると "recordStepUsage is called" が FAIL（PDCA do.md T-8 PROVE） | `a707139` |
| REQ-007 (7.2) | DES-3.8, DES-3.12 | T-9.1, T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "returns 429 when budget is exceeded"; "does NOT call submitApproval when budget is exceeded" ✓ | T-13.1 実施: `totalTokens >= budget` を `totalTokens > budget` に変えると "returns budget-exceeded when totalTokens >= budget" が `expected 'claimed' to be 'budget-exceeded'` で FAIL（本タスク実証） | `c495961` |
| REQ-007 (7.3) | DES-3.8, DES-3.12 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "claimApprovalTargets WAS called (rows consumed)" ✓ | 429 分岐で `claimPending` を呼ばないと "claimApprovalTargets WAS called" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-007 (7.4) | DES-3.10, DES-5.5 | T-5.3 | `packages/schemas/tests/env.spec.ts` — `aiEnvSchema JOB_TOKEN_BUDGET` (default 200_000, coerce, positive/int constraints) | `JOB_TOKEN_BUDGET` を `env.ts` から削ると schema.spec.ts が "expected … to have property JOB_TOKEN_BUDGET" で FAIL（PDCA do.md T-5 PROVE） | `4d60458` |
| REQ-007 (7.5) | DES-3.9, DES-4 | T-6.2, T-13.2 | `packages/db/tests/schema.spec.ts` (existing 6 tables & `jobEventTypeEnum` unchanged) | `jobEventTypeEnum` の値を変えると schema.spec.ts の "jobEventTypeEnum values" テストが FAIL（schema.spec.ts REQ-007.5 専用テスト） | `a707139` |
| REQ-007 (7.6) | DES-3.8, DES-3.11 | T-8.1, T-8.2, T-9.3 | `apps/worker/tests/main.spec.ts` — "recordStepUsage is called with totalTokens from the specialist's completion event" (server-observed absolute value, R7.6) | `recordStepUsage` ブロックをコメントアウトすると `expected [] to have a length of 1 but got +0` で FAIL（PDCA do.md T-8 PROVE） | `a707139` |
| REQ-008 (8.1) | DES-3.8 | T-9.1, T-9.2, T-9.4 | `apps/web/tests/approvals.spec.ts` — "records args as masked key names only — never values" + "records with tool='approval:decision'" | T-9 PROVE: `Object.keys()` を `Object.values()` に変えると "never contains the VALUE" が `'do-not-log-this' to not be "do-not-log-this"` で FAIL（PDCA do.md T-9 PROVE） | `5df606d` |
| REQ-008 (8.2) | DES-3.6, DES-3.8 | T-9.4, T-11.2 | `apps/web/tests/approvals.spec.ts` — single `recordApprovalDecisions` call site; `tests/repo/egress-policy-bypass.spec.ts` — "audit.record() call appears only in the single authorised firing point" ✓ | T-11 PROVE: `apps/web/src/lib/approvals.ts` の `audit.record(` をコメントアウトすると "authorised audit firing point actually contains audit.record()" が FAIL（PDCA do.md T-11 PROVE） | `020941a` |
| REQ-008 (8.3) | DES-3.8 | T-9.1, T-9.4 | `apps/web/tests/approvals.spec.ts` — "does NOT throw and returns successfully when audit sink fails (fail-soft)" | T-9 PROVE: `try/catch` を削ると "does NOT throw … when audit sink fails" が `Error: DB is down` で FAIL（PDCA do.md T-9 PROVE） | `5df606d` |
| REQ-008 (8.4) | DES-3.8 | T-9.1, T-9.4 | `apps/web/tests/approvals.spec.ts` — "logs error with correlation only (no raw args) when audit sink fails" | `logger.error` 呼び出しを削ると "logs error with correlation only" が FAIL（PDCA do.md T-9 PROVE 経路） | `5df606d` |
| REQ-008 (8.5) | DES-3.6 | T-11.2, T-13.2 | `tests/repo/egress-policy-bypass.spec.ts` — "audit.record() call appears only in the single authorised firing point" + "authorised audit firing point actually contains audit.record()" ✓ (packages/agents/src/audit-hook.ts excluded by design) | REQ-008 (8.2) と同一テスト経路で確認済み | `020941a` |
| REQ-008 (8.6) | DES-3.8 | T-9.4 | `apps/web/tests/approvals.spec.ts` — "includes callerId as userId and jobId in the audit entry" | `callerId` / `jobId` フィールドを omit すると "includes callerId as userId and jobId" が FAIL（PDCA do.md T-9 PROVE 経路） | `5df606d` |
| REQ-009 (9.1) | DES-3.7, DES-3.12 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalDecisionSchema` accepts valid single decision | `approvalDecisionSchema` の `toolCallId` フィールドを削ると parse が失敗し "accepts valid single decision" が FAIL（PDCA do.md T-5 PROVE） | `4d60458` |
| REQ-009 (9.2) | DES-3.8, DES-3.9, DES-5.2 | T-7.1, T-7.2, T-9.3, T-10.1 | `apps/worker/tests/stores-job-step.spec.ts` — claimPending ✓; `apps/web/tests/approvals.spec.ts` — "returns not-claimable when rowCount is 0" ✓; `apps/web/tests/jobs-approve-route.spec.ts` — "set-form not-claimable → 409" ✓ | REQ-006 (6.2) と同一テスト経路で確認済み | `c495961` |
| REQ-009 (9.3) | DES-3.7, DES-3.8 | T-5.2, T-9.1, T-9.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalDecisionSetSchema` min(1) and strictObject | T-13.1 実施: `z.strictObject` → `z.object` に変えると "approvalRequestSchema rejects payloads with forbidden fields or empty sets" が `expected true to be false` で FAIL（本タスク実証） | `4d60458` |
| REQ-009 (9.4) | DES-3.7, DES-3.12 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalRequestSchema` discriminated union | discriminated union の片方を削ると "approvalRequestSchema accepts valid set decision" が FAIL（PDCA do.md T-5 PROVE） | `4d60458` |
| REQ-009 (9.5) | DES-3.8, DES-3.12 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "409 body does NOT reveal which toolCallId was the duplicate" ✓ | 409 ボディに toolCallId を含めると "does NOT reveal which toolCallId" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-009 (9.6) | DES-3.8, DES-3.9 | T-7.1, T-7.2, T-9.3 | `apps/worker/tests/stores-job-step.spec.ts` — recordStepUsage absolute upsert ✓; `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT call claimApprovalTargets when duplicates are detected" ✓ | duplicate 検出後に `claimApprovalTargets` を呼ぶと "does NOT call claimApprovalTargets when duplicates are detected" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-010 (10.1) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "no email-address literals in app/package source files" + "no allowlist-override patterns in app/package source files" ✓ | T-11 PROVE: `packages/tools/src/email.ts` を例外リストから除去すると email リテラル scan で FAIL（PDCA do.md T-11 PROVE） | `020941a` |
| REQ-010 (10.2) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "scans at least 1 source file for email literals (non-vacuity)" + "scans at least 1 file for audit-firing-point check (non-vacuity)" ✓ | 非空アサート自体は scan 対象ディレクトリが実在することで担保。対象 dir を削除すると "scans at least 1 source file" が FAIL（走査 0 件経路） | `020941a` |
| REQ-010 (10.3) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "exception list is non-empty and every listed path exists" ✓ | 例外リストのパスを存在しないパスに書き換えると "every listed path exists" が FAIL（PDCA do.md T-11 PROVE） | `020941a` |
| REQ-010 (10.4) | DES-3.6 | T-11.3 | `tests/repo/egress-policy-bypass.spec.ts` — file-level comment cites `pydantic-ai-sandbox/patterns/hitl/tests/test_egress_policy.py` (code span) + CVE-2026-46678 ✓ | コードスパンの参照は `doc-links.spec.ts` のスコープ外（外部パス）。文書ソース閲覧で確認。 | `020941a` |
| REQ-010 (10.5) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` lives in `tests/repo/` project; no new workflow file added ✓ | REQ-004 (4.8) と同一ガード（新規 workflow 追加で `ci-workflows.spec.ts` が FAIL） | `020941a` |
| REQ-011 (11.1) | DES-3.13 | T-12.2 | §1〜§7 無改変を `git diff` で確認 ✓（T-12 実施内容; PDCA do.md T-12） | `git diff docs/cross-repo-adoption-review.md` が ToC 3 行 + §8 のみであること。§1〜§7 を改変すると diff が増え確認が FAIL。 | `b894e19` |
| REQ-011 (11.2) | DES-3.13 | T-12.1 | `docs/cross-repo-adoption-review.md` §8 addendum 追記済み（X-17〜X-20 / D1〜D6 着地表） ✓ | §8 が無いと `doc-links.spec.ts` の `cross-repo-adoption-review.md` リンクが解決しなくなる（§8 内の self-reference が原因経路） | `b894e19` |
| REQ-011 (11.3) | DES-3.13 | T-12.1 | §8 addendum に X-17〜X-20 の着地状態と D1〜D6 の着地状態が明記されている ✓ | 機械テストなし（文書内容の正確性は人間レビュー。テストは引用の実在のみ） | `b894e19` |
| REQ-011 (11.4) | DES-3.13 | T-3.1, T-12.1 | `tests/repo/doc-links.spec.ts` ✓ — link-only corrections in review.md §7.6 and specs/review/… (T-3.1 done; §8 addendum に是正記録) | T-3.1 施工時に確認: リンク是正前は `doc-links.spec.ts` が FAIL。是正後 GREEN。是正内容を §8 に「本文改変ではなくリンク先の是正」として記録。 | `4c4e0b8` |
| REQ-011 (11.5) | DES-3.13 | T-12.3 | `docs/cross-repo-adoption-backlog.md` §5 の X-17〜X-20 を「解決済み」へ更新 ✓ | `doc-links.spec.ts` が `backlog.md` 内のリンクを解決可能な状態に保つ（リンク切れがあれば FAIL） | `b894e19` |
| REQ-011 (11.6) | DES-3.5, DES-3.13 | T-1.1, T-1.2, T-3.1, T-12.3 | `tests/repo/cross-repo-reference-resolution.spec.ts` — "QUALIFIED_FORM regression" describe (3 tests: T-1.1 pin; T-1.2 fix verified by same tests) | T-1 PROVE: 修正を元に戻すと `../` を含む入力で QUALIFIED_FORM 偽陽性が復活し 3 テストが FAIL（PDCA do.md T-1 PROVE） | `b894e19` |
| REQ-011 (11.7) | DES-3.13 | T-12.1 | §8 addendum §8.2 に D1〜D6 が `apps/web` の job/approval 経路にのみ適用されること、`/api/chat` と `services/api` を対象外としたことを明記 ✓ | 機械テストなし（§8 の散文内容は人間レビュー） | `b894e19` |
| REQ-012 (12.1) | DES-3.14 | T-13.2 | `mise run check` → 69 test files, 793 passed / 1 skipped; lint clean; typecheck clean; audit clean; `lint:model-ids` clean ✓ (T-13.2 実証) | 任意のテストを壊すと `test:run` が FAIL し gate が FAIL。lint エラーを導入すると `lint` が FAIL。 | T-13 |
| REQ-012 (12.2) | DES-3.14 | T-13.2 | `.github/workflows/` に 7 ファイル（api.yml / eval-nightly.yml / eval-pr.yml / lint.yml / python.yml / security-daily.yml / tests.yml）が存在し新規追加なし ✓ (T-13.2 実証) | 8 本目のワークフローを追加すると `ci-workflows.spec.ts` の SHA-pinned / permissions テストが FAIL。 | T-13 |
| REQ-012 (12.3) | DES-3.14 | T-13.2 | `scripts/forbid-model-ids.sh` → "No hardcoded model IDs found" ✓ (T-13.2 実証) | `apps/web/src/` にモデル ID 文字列を書くと `lint:model-ids` が FAIL し gate が FAIL。 | T-13 |
| REQ-012 (12.4) | DES-3.14 | T-13.1 | 本表 Non-vacuity 列（タスク 2 / 5 / 6 / 7 / 8 / 9 / 10 / 11 の全テスト・ガードに非空虚性証拠あり）✓ | — | T-13 |
| REQ-012 (12.5) | DES-3.14 | T-10.1, T-13.3 | `apps/web/tests/approvals.spec.ts` / `apps/web/tests/jobs-approve-route.spec.ts` — 実 LLM・実 Redis・実 DB 不要（`MockLanguageModelV4` / `vi.mock` / フェイク DB のみ）✓。本表下部「ネットワーク独立性」節に明記。 | ネットワーク依存なし: jest-dom 環境のみで全テストが GREEN。`DATABASE_URL` 未設定でも PASS（T-10 PROVE 内で確認済み）。 | `c495961` |
| REQ-012 (12.6) | DES-3.8, DES-3.14 | T-13.2 | カバレッジ: lines 90.96% / functions 82.19% / branches 92.08% — ≥ 80% 閾値を上回る ✓ (T-13.2 実証) | カバレッジ閾値は `vitest.config.ts` に設定済み。閾値を下回ると `test:run` が FAIL。 | T-13 |
| REQ-012 (12.7) | DES-3.14 | T-13.3 | 本ファイル（`traceability.md`）が完成形 ✓ | — | T-13 |

## Gaps

- 受け入れ基準の網羅漏れ: **None**（73/73 が 1 つ以上のタスクに割り当て済み）。
- 要件に紐づかないタスク（orphan）: **None**（全 13 major / 41 sub が `_Requirements:_` を持つ）。
- 非空虚性の確認（R12.4）: **完了** — 全テスト・ガードについて Non-vacuity 列に証拠を記入済み。

## 承認経路テストのネットワーク独立性（REQ-012.5）

`apps/web` の job/approval 経路テスト（Requirement 5〜9）は以下の方針で実 LLM・実 Redis・実 DB を要求しない:

| テストファイル | ネットワーク回避手段 |
|---|---|
| `packages/schemas/tests/workflows.spec.ts` | Zod スキーマの純粋な parse 呼び出しのみ。外部依存なし。 |
| `packages/schemas/tests/env.spec.ts` | `process.env` 直接操作。外部依存なし。 |
| `packages/db/tests/schema.spec.ts` | Drizzle スキーマ定義の型・列名・enum 値を静的に検査。DB 接続なし。 |
| `packages/db/tests/schema-ddl.spec.ts` | SQL ファイルとスキーマ定義の文字列比較。DB 接続なし。 |
| `apps/worker/tests/stores-job-step.spec.ts` | `fakeInsertDb` / `fakeTransactionDb`（インメモリフェイク）。DB 接続なし。 |
| `apps/worker/tests/main.spec.ts` | `jobStepStore` / `engine` をインメモリフェイクで注入。Inngest SDK を `vi.mock` でスタブ化。 |
| `apps/web/tests/approvals.spec.ts` | `JobStepStore` / `AuditSink` / `Logger` をインメモリフェイクで注入。外部依存なし。 |
| `apps/web/tests/jobs-approve-route.spec.ts` | `lib/approvals.ts` を `vi.mock(import(...), async (importOriginal))` で部分モック。`submitApproval` を `vi.fn()` でスタブ化。DB / Redis / LLM 接触なし。 |

Inngest の `waitForEvent` / `step.run` は `apps/worker/tests/main.spec.ts` で `vi.mock` されており、実 Inngest サービスへの接続は発生しない。

## plan による spec の訂正（タスク 13.3 で本表へ反映する）

[`plan.md`](plan.md) の「spec に対する訂正 3 点」を実装時の正とする:

1. R12.2 の「既存 6 本」は実測 **7 本**（`api.yml`）。要件の意図（新規ワークフローを追加しない）は不変。
2. R3.4 の参照列挙にある `AGENTS.md` には旧名参照が**無い**。代わりに
   [`gap-analysis.md`](gap-analysis.md) が旧名へのリンクを持つ（是正対象）。
3. R6.2 の「3 ケースで同一のステータス（404）」は**ケース間の区別不能性**（R6.4）の要求であり、
   ステータス値そのものの固定ではない。単一形 → 404 / セット形 → 409（R9.2）はその下位実装。

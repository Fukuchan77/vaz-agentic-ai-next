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
| REQ-004 (4.1) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all path citations in … exist" (T-2.2 guard; full GREEN on T-4.4 documents) | 存在しないパスを `- 実装:` に追記すると "all path citations … exist" が FAIL（PDCA do.md T-3 PROVE） | `1fa7146` / `85f1708` |
| REQ-004 (4.2) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all symbol citations in … are resolvable" (T-2.2 guard; full GREEN on T-4.4 documents) | 存在しないシンボル名を `- 実装: file.ts#nonExistent` に書くと FAIL（PDCA do.md T-3 PROVE） | `1fa7146` / `85f1708` |
| REQ-004 (4.3) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all CI citations in … are valid" (T-2.2 guard; full GREEN on T-4.4 documents) | 存在しないステップ名を `- CI:` に書くと "all CI citations … are valid" が FAIL（PDCA do.md T-4 PROVE） | `1fa7146` / `85f1708` |
| REQ-004 (4.4) | DES-3.4 | T-2.3, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all status tokens in … are valid" (T-2.3 guard; full GREEN on T-4.4 documents) | `- 状態:` に `Mitigated` 以外の任意文字列を書くと "all status tokens … are valid" が FAIL（PDCA do.md T-4 PROVE） | `1fa7146` / `85f1708` |
| REQ-004 (4.5) | DES-3.4 | T-2.3, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "preamble contains an ISO-8601 taxonomy version date" (T-2.3 guard; full GREEN on T-4.4 documents) | REQ-002 (2.5) と同一ガード経路で確認済み | `1fa7146` / `85f1708` |
| REQ-004 (4.6) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "exactly 2 mapping documents are declared" + per-doc "document exists" + "> 0" non-empty asserts (T-2.1 ✓) | `MAPPING_DOCS` 配列から片方を削ると "exactly 2 mapping documents" が FAIL（PDCA do.md T-2 PROVE） | `1fa7146` |
| REQ-004 (4.7) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "document exists: docs/owasp-*.md" asserts (T-2.1 ✓) | 文書ファイルを削除すると "document exists: …" が FAIL（上記と同一アサート） | `1fa7146` |
| REQ-004 (4.8) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` lives in `tests/repo/` project, no new workflow file added (T-2.1 ✓) | `.github/workflows/` に新規ファイルを追加すると `ci-workflows.spec.ts` の "SHA-pinned" テストが FAIL（既存ガード） | `1fa7146` |
| REQ-005 (5.1) | DES-3.7 | T-5.1, T-5.2 | `packages/schemas/tests/workflows.spec.ts` — "approval wire contracts" (UUID toolCallId, approve/reject, strict reject on history/usage/model) | T-13.1 実施: `z.strictObject` → `z.object` に変えると "rejects excess / forbidden fields in single decision" が `expected true to be false` で FAIL（本タスク実証） |  `4d60458` |
| REQ-005 (5.2) | DES-3.7, DES-3.8, DES-3.12, DES-5.1 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` + `apps/web/tests/jobs-approve-route.spec.ts` — "returns 400 when single form carries an extra field" ✓ | T-10 PROVE: `z.strictObject` → `z.object` に変えると "returns 400 when single form carries an extra field" が `expected 400 to be 202` で FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-005 (5.3) | DES-3.12, DES-7 | T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT consume approval targets when schema validation fails" ✓ | 400 分岐を削ると "does NOT consume approval targets when schema validation fails" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-005 (5.4) | DES-3.12 | T-10.1 | `apps/web/tests/jobs-approve-route.spec.ts` — server-side plan/step composition (route delegates to engine; no client-supplied history) ✓ | route.ts が `lib/approvals.ts` 経由でのみ `submitApproval` を呼ぶ構造。呼び出し箇所を削ると 202 が返らなくなり FAIL | `c495961` |
| REQ-005 (5.5) | DES-3.8, DES-3.12 | T-9.2, T-10.2 | `apps/web/tests/approvals.spec.ts` + `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT consume approval targets when schema validation fails" ✓ | REQ-005 (5.3) と同一テスト経路で確認済み | `c495961` |
| REQ-006 (6.1) | DES-3.9, DES-3.11, DES-5.2 | T-7.1, T-7.2, T-8.1, T-8.2, T-8.3, T-9.3 | `apps/worker/tests/stores-job-step.spec.ts` — registerPending ON CONFLICT DO NOTHING; `apps/worker/tests/main.spec.ts` — INV-1 order ✓; `apps/worker/tests/durability.spec.ts` — submitApproval id field ✓ | T-7 PROVE: `createJobStepStore` 未実装時に全 11 テストが `TypeError` で FAIL。T-8 PROVE: `registerPending` と `approvalGate` の順序を入れ替えると INV-1 アサートが FAIL（PDCA do.md T-7/T-8 PROVE） | `69f827a` / `a707139` |
| REQ-006 (6.2) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "single-form not-claimable → 404"; "set-form not-claimable → 409" ✓ | T-10 PROVE: `case "not-claimable"` 削除で "single-form not-claimable → 404" が `expected 404 to be 202` で FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-006 (6.3) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "404 body does NOT contain the toolCallId or state word" ✓ | 404 ボディに toolCallId を含めると "does NOT contain" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-006 (6.4) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "single-form 404 and 409 bodies are identical" ✓ | 2 分岐のボディを変えると "bodies are identical" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-006 (6.5) | DES-3.12 | T-10.3 | `apps/web/tests/jobs-approve-route.spec.ts` Section A — "authorization (R5.1)" 4 tests unchanged ✓ | Section A 4 テストは T-10 後も無改変で GREEN。route 書き替え時に意図的に実行して確認（PDCA do.md T-10 実施内容） | `c495961` |
| REQ-006 (6.6) | DES-3.9, DES-4 | T-6.1, T-6.2, T-6.3, T-7.2, T-8.1, T-8.2 | `packages/db/tests/schema.spec.ts` (`job_step` columns, composite PK, FK cascade) + `packages/db/tests/schema-ddl.spec.ts` (`0002_add_job_step.sql` drift guard) + `apps/worker/tests/main.spec.ts` — "omitting jobStepStore is a no-op" ✓ | T-6 PROVE: `approvalStateEnum` の順序を反転すると schema.spec.ts / schema-ddl.spec.ts が `expected [ 'consumed', 'pending' ] to deeply equal [ 'pending', 'consumed' ]` で FAIL（PDCA do.md T-6 PROVE） | `bc8a841` / `69f827a` / `a707139` |
| REQ-007 (7.1) | DES-3.9, DES-3.11, DES-4 | T-6.1, T-6.2, T-7.1, T-7.2, T-8.1, T-8.2 | `packages/db/tests/schema.spec.ts` (`approvalStateEnum`, `total_tokens` default 0) + `apps/worker/tests/stores-job-step.spec.ts` — registerPending / recordStepUsage / claimPending + `apps/worker/tests/main.spec.ts` — "recordStepUsage is called with totalTokens from the specialist's completion event" ✓ | T-7 PROVE: 実装前に全 11 テストが FAIL。`recordStepUsage` ブロックをコメントアウトすると "recordStepUsage is called" が FAIL（PDCA do.md T-8 PROVE） | `bc8a841` / `69f827a` / `a707139` |
| REQ-007 (7.2) | DES-3.8, DES-3.12 | T-9.1, T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "returns 429 when budget is exceeded"; "does NOT call submitApproval when budget is exceeded" ✓ | T-13.1 実施: `totalTokens >= budget` を `totalTokens > budget` に変えると "returns budget-exceeded when totalTokens >= budget" が `expected 'claimed' to be 'budget-exceeded'` で FAIL（本タスク実証） | `c495961` |
| REQ-007 (7.3) | DES-3.8, DES-3.12 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "claimApprovalTargets WAS called (rows consumed)" ✓ | 429 分岐で `claimPending` を呼ばないと "claimApprovalTargets WAS called" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-007 (7.4) | DES-3.10, DES-5.5 | T-5.3 | `packages/schemas/tests/env.spec.ts` — `aiEnvSchema JOB_TOKEN_BUDGET` (default 200_000, coerce, positive/int constraints) | `JOB_TOKEN_BUDGET` を `env.ts` から削ると schema.spec.ts が "expected … to have property JOB_TOKEN_BUDGET" で FAIL（PDCA do.md T-5 PROVE） | `4d60458` |
| REQ-007 (7.5) | DES-3.9, DES-4 | T-6.2, T-13.2 | `packages/db/tests/schema.spec.ts` (existing 6 tables & `jobEventTypeEnum` unchanged) | `jobEventTypeEnum` の値を変えると schema.spec.ts の "jobEventTypeEnum values" テストが FAIL（schema.spec.ts REQ-007.5 専用テスト） | `bc8a841` |
| REQ-007 (7.6) | DES-3.8, DES-3.11 | T-8.1, T-8.2, T-9.3 | `apps/worker/tests/main.spec.ts` — "recordStepUsage is called with totalTokens from the specialist's completion event" (server-observed absolute value, R7.6) | `recordStepUsage` ブロックをコメントアウトすると `expected [] to have a length of 1 but got +0` で FAIL（PDCA do.md T-8 PROVE） | `a707139` |
| REQ-008 (8.1) | DES-3.8 | T-9.1, T-9.2, T-9.4 | `apps/web/tests/approvals.spec.ts` — "records args as masked key names only — never values" + "records with tool='approval:decision'" | T-9 PROVE: `Object.keys()` を `Object.values()` に変えると "never contains the VALUE" が `'do-not-log-this' to not be "do-not-log-this"` で FAIL（PDCA do.md T-9 PROVE） | `5df606d` |
| REQ-008 (8.2) | DES-3.6, DES-3.8 | T-9.4, T-11.2 | `apps/web/tests/approvals.spec.ts` — single `recordApprovalDecisions` call site; `tests/repo/egress-policy-bypass.spec.ts` — "audit.record() call appears only in the single authorised firing point" ✓ | T-11 PROVE: `apps/web/src/lib/approvals.ts` の `audit.record(` をコメントアウトすると "authorised audit firing point actually contains audit.record()" が FAIL（PDCA do.md T-11 PROVE） | `020941a` |
| REQ-008 (8.3) | DES-3.8 | T-9.1, T-9.4 | `apps/web/tests/approvals.spec.ts` — "does NOT throw and returns successfully when audit sink fails (fail-soft)" | T-9 PROVE: `try/catch` を削ると "does NOT throw … when audit sink fails" が `Error: DB is down` で FAIL（PDCA do.md T-9 PROVE） | `5df606d` |
| REQ-008 (8.4) | DES-3.8 | T-9.1, T-9.4 | `apps/web/tests/approvals.spec.ts` — "logs error with correlation only (no raw args) when audit sink fails" | `logger.error` 呼び出しを削ると "logs error with correlation only" が FAIL（PDCA do.md T-9 PROVE 経路） | `5df606d` |
| REQ-008 (8.5) | DES-3.6 | T-11.2, T-13.2 | `tests/repo/egress-policy-bypass.spec.ts` — "audit.record() call appears only in the single authorised firing point" + "authorised audit firing point actually contains audit.record()" ✓ (packages/agents/src/audit-hook.ts excluded by design) | REQ-008 (8.2) と同一テスト経路で確認済み | `020941a` |
| REQ-008 (8.6) | DES-3.8 | T-9.4 | `apps/web/tests/approvals.spec.ts` — "includes callerId as userId and jobId in the audit entry" | `callerId` / `jobId` フィールドを omit すると "includes callerId as userId and jobId" が FAIL（PDCA do.md T-9 PROVE 経路） | `5df606d` |
| REQ-009 (9.1) | DES-3.7, DES-3.12 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalDecisionSchema` accepts valid single decision | `approvalDecisionSchema` の `toolCallId` フィールドを削ると parse が失敗し "accepts valid single decision" が FAIL（PDCA do.md T-5 PROVE） | `4d60458` |
| REQ-009 (9.2) | DES-3.8, DES-3.9, DES-5.2 | T-7.1, T-7.2, T-9.3, T-10.1 | `apps/worker/tests/stores-job-step.spec.ts` — `claimPending` は要求された `stepIds` 全件が pending でなければ全体をロールバックする（"a partial match forces the transaction callback to throw (real ROLLBACK)…" ✓、"a full match does NOT throw…" ✓）; `apps/web/tests/approvals.spec.ts` — `claimApprovalTargets` は `rowCount !== decisions.length` で `not-claimable`（"returns not-claimable when rowCount is 0" ✓、"R9.2/9.6: returns not-claimable … when rowCount is less than decisions.length" ✓ — mixed pending/non-pending セットの防御的二重チェック）; `apps/web/tests/jobs-approve-route.spec.ts` — "set-form not-claimable → 409" ✓ | **adversarial-review fix（本検証で発見・修正）**: 施工時点の `claimPending(jobId, at)` は `stepIds` を受け取らず、ジョブの pending 行を無条件に全件消費していた（混在セット——pending 1 件 ＋ 未登録 1 件——を送ると、未登録側があっても pending 側だけ消費され `claimed` で 202 が返る実質的な原子性欠落）。`claimPending` に `stepIds` を追加し、`WHERE step_id = ANY(stepIds)` で絞った UPDATE の影響行数が `stepIds.length` と不一致ならトランザクション内で例外を投げて ROLLBACK、実際の一致数を返すよう修正。`claimApprovalTargets` 側も `rowCount !== decisions.length`（旧: `rowCount === 0` のみ）で判定するよう二重化。この 2 箇所のチェックを無効化（`if (false)` / `if (rowCount === 0)`）すると両テストが期待通り FAIL することを確認済み（本タスク実証） | `69f827a` / `5df606d` / `c495961` + adversarial-review fix（pending commit） |
| REQ-009 (9.3) | DES-3.7, DES-3.8 | T-5.2, T-9.1, T-9.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalDecisionSetSchema` min(1) and strictObject | T-13.1 実施: `z.strictObject` → `z.object` に変えると "approvalRequestSchema rejects payloads with forbidden fields or empty sets" が `expected true to be false` で FAIL（本タスク実証） | `4d60458` |
| REQ-009 (9.4) | DES-3.7, DES-3.12 | T-5.1, T-5.2, T-10.1, T-10.2 | `packages/schemas/tests/workflows.spec.ts` — `approvalRequestSchema` discriminated union | discriminated union の片方を削ると "approvalRequestSchema accepts valid set decision" が FAIL（PDCA do.md T-5 PROVE） | `4d60458` |
| REQ-009 (9.5) | DES-3.8, DES-3.12 | T-9.3, T-10.1, T-10.2 | `apps/web/tests/jobs-approve-route.spec.ts` — "409 body does NOT reveal which toolCallId was the duplicate" ✓ | 409 ボディに toolCallId を含めると "does NOT reveal which toolCallId" が FAIL（PDCA do.md T-10 PROVE） | `c495961` |
| REQ-009 (9.6) | DES-3.8, DES-3.9 | T-7.1, T-7.2, T-9.3 | `apps/worker/tests/stores-job-step.spec.ts` — recordStepUsage absolute upsert ✓、`claimPending` 不一致時ロールバック ✓（REQ-009 (9.2) と同一ガード）; `apps/web/tests/jobs-approve-route.spec.ts` — "does NOT call claimApprovalTargets when duplicates are detected" ✓ | 重複検出経路: duplicate 検出後に `claimApprovalTargets` を呼ぶと "does NOT call claimApprovalTargets when duplicates are detected" が FAIL（PDCA do.md T-10 PROVE）。混在セット経路（9.3 の重複とは別のケース）: REQ-009 (9.2) の PROVE と同一——不一致時は 1 件も消費されない | `69f827a` / `c495961` + adversarial-review fix（pending commit） |
| REQ-010 (10.1) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "no email-address literals in app/package source files" + "no allowlist-override patterns in app/package source files" + 検出器 self-test 6 件（`EMAIL_LITERAL_RE` / `ALLOWLIST_OVERRIDE_RE` / コメント行フィルタ）✓ | **訂正（実装検証 2026-09-22）**: 旧記述「`packages/tools/src/email.ts` を例外リストから除去すると FAIL」は**成立していなかった**——除去しても 7/7 GREEN（同ファイルに正規表現に一致する行が 1 行も無い）。送信ツールを例外から外し、検出器の発火を直接固定する self-test を追加して再構築。現在の PROVE: `packages/tools/src/email.ts` に `const FALLBACK_RECIPIENT = "ops@internal.example";` を追加すると "no email-address literals" が FAIL（実測済み） | `020941a` + §9.2a fix |
| REQ-010 (10.2) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "scans at least 1 source file for email literals (non-vacuity)" + "scans at least 1 file for audit-firing-point check (non-vacuity)" ✓ | 非空アサート自体は scan 対象ディレクトリが実在することで担保。対象 dir を削除すると "scans at least 1 source file" が FAIL（走査 0 件経路） | `020941a` |
| REQ-010 (10.3) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` — "exception list is non-empty and every listed path exists" + "the external-send tool is NOT excepted from the scan" ✓ | 例外リストのパスを存在しないパスに書き換えると "every listed path exists" が FAIL。加えて（§9.2a）例外は `RECIPIENT_ALLOWLIST` を定義するモジュールに限ることをアサートし、`email.ts` を例外に戻すと "the external-send tool is NOT excepted" が FAIL | `020941a` + §9.2a fix |
| REQ-010 (10.4) | DES-3.6 | T-11.3 | `tests/repo/egress-policy-bypass.spec.ts` — file-level comment cites `pydantic-ai-sandbox/patterns/hitl/tests/test_egress_policy.py` (code span) + CVE-2026-46678 ✓ | コードスパンの参照は `doc-links.spec.ts` のスコープ外（外部パス）。文書ソース閲覧で確認。 | `020941a` |
| REQ-010 (10.5) | DES-3.6 | T-11.1 | `tests/repo/egress-policy-bypass.spec.ts` lives in `tests/repo/` project; no new workflow file added ✓ | REQ-004 (4.8) と同一ガード（新規 workflow 追加で `ci-workflows.spec.ts` が FAIL） | `020941a` |
| REQ-011 (11.1) | DES-3.13 | T-12.2 | §1〜§7 無改変を `git diff` で確認 ✓（T-12 実施内容; PDCA do.md T-12） | `git diff docs/cross-repo-adoption-review.md` が ToC 3 行 + §8 のみであること。§1〜§7 を改変すると diff が増え確認が FAIL。 | `b894e19` |
| REQ-011 (11.2) | DES-3.13 | T-12.1 | `docs/cross-repo-adoption-review.md` §8 addendum 追記済み（X-17〜X-20 / D1〜D6 着地表） ✓ | §8 が無いと `doc-links.spec.ts` の `cross-repo-adoption-review.md` リンクが解決しなくなる（§8 内の self-reference が原因経路） | `b894e19` |
| REQ-011 (11.3) | DES-3.13 | T-12.1 | §8 addendum に X-17〜X-20 の着地状態と D1〜D6 の着地状態が明記されている ✓ | 機械テストなし（文書内容の正確性は人間レビュー。テストは引用の実在のみ） | `b894e19` |
| REQ-011 (11.4) | DES-3.13 | T-3.1, T-12.1 | `tests/repo/doc-links.spec.ts` ✓ — link-only corrections in review.md §7.6 and specs/review/… (T-3.1 done; §8 addendum に是正記録) | T-3.1 施工時に確認: リンク是正前は `doc-links.spec.ts` が FAIL。是正後 GREEN。是正内容を §8 に「本文改変ではなくリンク先の是正」として記録。 | `4c4e0b8` |
| REQ-011 (11.5) | DES-3.13 | T-12.3 | `docs/cross-repo-adoption-backlog.md` §5 の X-17〜X-20 を「解決済み」へ更新 ✓ | `doc-links.spec.ts` が `backlog.md` 内のリンクを解決可能な状態に保つ（リンク切れがあれば FAIL） | `b894e19` |
| REQ-011 (11.6) | DES-3.5, DES-3.13 | T-1.1, T-1.2, T-3.1, T-12.3 | `tests/repo/cross-repo-reference-resolution.spec.ts` — "QUALIFIED_FORM regression" describe (3 tests: T-1.1 pin; T-1.2 fix verified by same tests) | T-1 PROVE: 修正を元に戻すと `../` を含む入力で QUALIFIED_FORM 偽陽性が復活し 3 テストが FAIL（PDCA do.md T-1 PROVE） | `4b5a849` / `b894e19` |
| REQ-011 (11.7) | DES-3.13 | T-12.1 | §8 addendum §8.2 に D1〜D6 が `apps/web` の job/approval 経路にのみ適用されること、`/api/chat` と `services/api` を対象外としたことを明記 ✓ | 機械テストなし（§8 の散文内容は人間レビュー） | `b894e19` |
| REQ-012 (12.1) | DES-3.14 | T-13.2 | `mise run check` → **70 test files, 821 passed / 1 skipped**（実装検証 2026-09-22 時点の HEAD。T-13.2 時点は 69 files / 793 passed だったが、その後 `5383d66` / `98926c4` / `bb952fa` / `b9edc46` と本検証の §9.2a〜§9.2c 修正がテストを追加した）; lint clean; typecheck clean; audit clean; `lint:model-ids` clean ✓ | 任意のテストを壊すと `test:run` が FAIL し gate が FAIL。lint エラーを導入すると `lint` が FAIL。 | T-13 |
| REQ-012 (12.2) | DES-3.14 | T-13.2 | `.github/workflows/` に 7 ファイル（api.yml / eval-nightly.yml / eval-pr.yml / lint.yml / python.yml / security-daily.yml / tests.yml）が存在し新規追加なし ✓ (T-13.2 実証) | 8 本目のワークフローを追加すると `ci-workflows.spec.ts` の SHA-pinned / permissions テストが FAIL。 | T-13 |
| REQ-012 (12.3) | DES-3.14 | T-13.2 | `scripts/forbid-model-ids.sh` → "No hardcoded model IDs found" ✓ (T-13.2 実証) | `apps/web/src/` にモデル ID 文字列を書くと `lint:model-ids` が FAIL し gate が FAIL。 | T-13 |
| REQ-012 (12.4) | DES-3.14 | T-13.1 | 本表 Non-vacuity 列（タスク 2 / 5 / 6 / 7 / 8 / 9 / 10 / 11 の全テスト・ガードに非空虚性証拠あり）✓ | — | T-13 |
| REQ-012 (12.5) | DES-3.14 | T-10.1, T-13.3 | `apps/web/tests/approvals.spec.ts` / `apps/web/tests/jobs-approve-route.spec.ts` — 実 LLM・実 Redis・実 DB 不要（`MockLanguageModelV4` / `vi.mock` / フェイク DB のみ）✓。本表下部「ネットワーク独立性」節に明記。 | ネットワーク依存なし: jest-dom 環境のみで全テストが GREEN。`DATABASE_URL` 未設定でも PASS（T-10 PROVE 内で確認済み）。 | `c495961` |
| REQ-012 (12.6) | DES-3.8, DES-3.14 | T-13.2 | カバレッジ（`mise run test:coverage` で別途測定、実装検証 2026-09-22 に再測）: statements 91.03% / branches 82.26% / functions 92.14% / lines 91.09% — `vitest.config.ts` の設定閾値 `lines 80` / `functions 80` をいずれも上回る ✓ | 閾値は `--coverage` 実行時のみ適用される（`mise run check` は `test:run` = `--coverage` なしのため閾値を強制しない）。`mise run test:coverage` で閾値を下回ると当該コマンドが FAIL する。`branches` には閾値が設定されておらず、実測 82.19% が 4 指標の最低値。 | T-13 |
| REQ-012 (12.7) | DES-3.14 | T-13.3 | 本ファイル（`traceability.md`）が完成形 ✓ | — | T-13 |

## 記録の是正（`/sdd-validate-impl` 2026-09-22）

実装検証で本表および `pdca/do.md` の**記録**側に 4 件の不整合が見つかり、同日是正した。
実装・テスト・ゲートには変更なし（`mise run check` は是正前後とも緑、69 files / 793 passed / 1 skipped）。

| # | 不整合 | 是正 |
|---|---|---|
| 1 | `pdca/do.md` の Task 1 / Task 2 節（PROVE 証拠）が commit `e1b7a4d` により削除されていた。本表の Non-vacuity 列が参照する「PDCA do.md T-1 PROVE」「T-2 PROVE」が実体を失っていた（R12.4 の記録欠損） | `43bdadb` の内容から 2 節を復元（原文無改変、見出し体裁のみ統一）。`do.md` 13.1 の対象タスク列挙も「タスク 1 / 2 / …」へ訂正 |
| 2 | REQ-004 (4.1)〜(4.8) の Commit 列 `b99912c` が git オブジェクトとして存在しなかった（8 行） | ガード実装 `1fa7146`（T-2）と文書移行 `85f1708`（T-4）へ訂正。本表の全 12 ハッシュが `git cat-file -t` で解決することを確認済み |
| 3 | REQ-006 (6.1)(6.6) / REQ-007 (7.1)(7.5) / REQ-009 (9.2)(9.6) / REQ-011 (11.6) の Commit 列が、Task 列に挙げたタスクの実装コミットと一致していなかった（例: `packages/db` の実装は `bc8a841` だが `a707139` を記載） | 各行の Task 列に対応する実装コミットを列挙する形へ訂正 |
| 4 | REQ-012 (12.6) がカバレッジ 4 指標のラベルを入れ替えて記載し、かつ「閾値を下回ると `test:run` が FAIL」と記していた（`mise run check` は `--coverage` なしのため閾値を強制しない） | 実測値を `mise run test:coverage` で再測定してラベルを訂正し、閾値の適用範囲を明記。`branches` に閾値が無い事実も記録 |

## 記録の再度の是正（実装検証 2026-09-22、ブランチ HEAD に対する独立検証）

Task 13 完了後に 4 コミット（`5383d66` / `98926c4` / `bb952fa` / `b9edc46`）が入ったため、
本表と `docs/cross-repo-adoption-review.md` §8 の**記録**側が HEAD と乖離していた。さらに
非空虚性証拠 1 件が実測で成立しないことが分かった。以下を同日是正した。

| # | 不整合 | 是正 |
|---|---|---|
| 5 | REQ-010 (1) の非空虚性証拠「`packages/tools/src/email.ts` を例外リストから除去すると FAIL」が**事実と違った**（除去しても 7/7 GREEN）。両例外パスとも現状 `EMAIL_LITERAL_RE` / `ALLOWLIST_OVERRIDE_RE` のどちらにも一致しないため、例外リストは空虚だった | `email.ts` を例外から外し（送信ツール自体を走査対象に戻し）、検出器の発火を固定する self-test 6 件と「送信ツールは例外不可」の回帰ピンを追加。REQ-010 (1)(3) 行を実測済みの PROVE へ差し替え |
| 6 | REQ-012 (12.1) のゲート実績「69 files / 793 passed」が HEAD と不一致 | 実測値「70 files / 821 passed / 1 skipped」へ更新し、差分の出所（Task 13 後の 4 コミット ➕ 本検証の修正）を明記 |
| 7 | REQ-012 (12.6) のカバレッジが T-13.2 時点の値 | 再測して statements 91.03% / branches 82.26% / functions 92.14% / lines 91.09% へ更新（閾値 lines 80 / functions 80 を引き続き上回る） |
| 8 | 正本 §8 の見出し日付が 2026-09-23（実コミットは 2026-09-22 15:48 JST）、§8.2 D5 の「DB 接触なしで 409」が `98926c4` 後の振る舞いと不一致、§8.3 のカバレッジが「確認予定」のまま | 正本は追記のみ規約のため §1〜§8 を改変せず、**§9 を追記**して 4 件を訂正（§9.1） |

実装側の修正 3 件（D6 の非空虚性、`TOOL_APPROVAL_SECRET` の env 規約違反と無言の劣化、
T6/LLM10 の過大申告と `MAX_PLAN_STEPS` 導入）は正本 §9.2 に記録した。

境界（`_Boundary:_`）側の逸脱 2 件（Task 8 の付随テスト 2 本、Task 9 による
`JobStepStore.claimPending` の port 契約拡張）は `tasks.md` の該当 `_Boundary:_` へ追記し、
`pdca/do.md` の Task 8 / Task 9 に「境界逸脱の記録」節として経緯と学びを残した。

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

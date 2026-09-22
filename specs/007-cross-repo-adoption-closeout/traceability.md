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
| REQ-004 (4.1) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all path citations in … exist" (T-2.2 guard; full GREEN on T-4.4 documents) | |
| REQ-004 (4.2) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all symbol citations in … are resolvable" (T-2.2 guard; full GREEN on T-4.4 documents) | |
| REQ-004 (4.3) | DES-3.4, DES-5.3 | T-2.2, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all CI citations in … are valid" (T-2.2 guard; full GREEN on T-4.4 documents) | |
| REQ-004 (4.4) | DES-3.4 | T-2.3, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "all status tokens in … are valid" (T-2.3 guard; full GREEN on T-4.4 documents) | |
| REQ-004 (4.5) | DES-3.4 | T-2.3, T-4.4 | `tests/repo/owasp-mapping-citations.spec.ts` — "preamble contains an ISO-8601 taxonomy version date" (T-2.3 guard; full GREEN on T-4.4 documents) | |
| REQ-004 (4.6) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "exactly 2 mapping documents are declared" + per-doc "document exists" + "> 0" non-empty asserts (T-2.1 ✓) | |
| REQ-004 (4.7) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` — "document exists: docs/owasp-*.md" asserts (T-2.1 ✓) | |
| REQ-004 (4.8) | DES-3.4 | T-2.1 | `tests/repo/owasp-mapping-citations.spec.ts` lives in `tests/repo/` project, no new workflow file added (T-2.1 ✓) | |
| REQ-005 (5.1) | DES-3.7 | T-5.1, T-5.2 | | |
| REQ-005 (5.2) | DES-3.7, DES-3.8, DES-3.12, DES-5.1 | T-5.1, T-5.2, T-10.1, T-10.2 | | |
| REQ-005 (5.3) | DES-3.12, DES-7 | T-10.1, T-10.2 | | |
| REQ-005 (5.4) | DES-3.12 | T-10.1 | | |
| REQ-005 (5.5) | DES-3.8, DES-3.12 | T-9.2, T-10.2 | | |
| REQ-006 (6.1) | DES-3.9, DES-3.11, DES-5.2 | T-7.1, T-7.2, T-8.1, T-8.2, T-8.3, T-9.3 | | |
| REQ-006 (6.2) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | | |
| REQ-006 (6.3) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | | |
| REQ-006 (6.4) | DES-3.8, DES-3.12, DES-5.1 | T-9.3, T-10.1, T-10.2 | | |
| REQ-006 (6.5) | DES-3.12 | T-10.3 | | |
| REQ-006 (6.6) | DES-3.9, DES-4 | T-6.1, T-6.2, T-6.3, T-7.2, T-8.1, T-8.2 | | |
| REQ-007 (7.1) | DES-3.9, DES-3.11, DES-4 | T-6.1, T-6.2, T-7.1, T-7.2, T-8.1, T-8.2 | | |
| REQ-007 (7.2) | DES-3.8, DES-3.12 | T-9.1, T-9.3, T-10.1, T-10.2 | | |
| REQ-007 (7.3) | DES-3.8, DES-3.12 | T-9.3, T-10.1, T-10.2 | | |
| REQ-007 (7.4) | DES-3.10, DES-5.5 | T-5.3 | | |
| REQ-007 (7.5) | DES-3.9, DES-4 | T-6.2, T-13.2 | | |
| REQ-007 (7.6) | DES-3.8, DES-3.11 | T-8.1, T-8.2, T-9.3 | | |
| REQ-008 (8.1) | DES-3.8 | T-9.1, T-9.2, T-9.4 | | |
| REQ-008 (8.2) | DES-3.6, DES-3.8 | T-9.4, T-11.2 | | |
| REQ-008 (8.3) | DES-3.8 | T-9.1, T-9.4 | | |
| REQ-008 (8.4) | DES-3.8 | T-9.1, T-9.4 | | |
| REQ-008 (8.5) | DES-3.6 | T-11.2, T-13.2 | | |
| REQ-008 (8.6) | DES-3.8 | T-9.4 | | |
| REQ-009 (9.1) | DES-3.7, DES-3.12 | T-5.1, T-5.2, T-10.1, T-10.2 | | |
| REQ-009 (9.2) | DES-3.8, DES-3.9, DES-5.2 | T-7.1, T-7.2, T-9.3, T-10.1 | | |
| REQ-009 (9.3) | DES-3.7, DES-3.8 | T-5.2, T-9.1, T-9.2 | | |
| REQ-009 (9.4) | DES-3.7, DES-3.12 | T-5.1, T-5.2, T-10.1, T-10.2 | | |
| REQ-009 (9.5) | DES-3.8, DES-3.12 | T-9.3, T-10.1, T-10.2 | | |
| REQ-009 (9.6) | DES-3.8, DES-3.9 | T-7.1, T-7.2, T-9.3 | | |
| REQ-010 (10.1) | DES-3.6 | T-11.1 | | |
| REQ-010 (10.2) | DES-3.6 | T-11.1 | | |
| REQ-010 (10.3) | DES-3.6 | T-11.1 | | |
| REQ-010 (10.4) | DES-3.6 | T-11.3 | | |
| REQ-010 (10.5) | DES-3.6 | T-11.1 | | |
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

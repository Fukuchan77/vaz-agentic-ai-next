# Constitution Review — TypeScript 7 Adoption & Compiler Isolation (Round 1)

- **Date**: 2026-10-05
- **Trigger**: `specs/009-agent-ui-and-beta-intake/tasks.md` Task 5.1 / ADR-0009
- **Reviewer Context**: Constitution / Architecture compliance review, separate from implementation context
- **Scope**: `.sdd/memory/constitution.md` (Version 2.1.1 → 2.2.0 MINOR amendment)
- **Decision**: APPROVED as a MINOR amendment

## Proposed Amendments to `.sdd/memory/constitution.md`

1. **SYNC IMPACT REPORT**:
   - Version Change: 2.1.1 → 2.2.0
   - Modified Sections:
     - `Additional Constraints / ツールチェーン`: Update TypeScript constraint from "TypeScript は 6.x 継続とし、7.x の採否は TODO(TYPESCRIPT_MAJOR) として docs/adr/ で単独判断する" to adopting root TypeScript 7.x with `@vaz/schemas` OpenAPI codegen isolated to TypeScript 6.0.3 per ADR-0009.
     - `改訂履歴`: Add row for version 2.2.0 (TypeScript 7 adoption and `@vaz/schemas` TS 6 compiler isolation per ADR-0009).
   - Removed Deferred Items:
     - `TODO(TYPESCRIPT_MAJOR)`: Resolved and removed by ADR-0009.
   - Retained Deferred Items:
     - `TODO(BRANCH_COVERAGE_THRESHOLD)`: Maintained.
   - Templates Status:
     - Record approval of ADR-0009 (`docs/adr/0009-typescript-7-adoption.md`) and this review file (`specs/009-agent-ui-and-beta-intake/reviews/ts7-constitution-r1.md`).

2. **Additional Constraints (ツールチェーン節)**:
   - Updated text:
     "Turborepo 2.10.11（完全一致ピン。`futureFlags.experimentalPythonWorkspaces` に必要）。TypeScript はルートワークスペースで 7.x 安定版を採用し、`openapi-typescript` によるコード生成のみ `@vaz/schemas` 内の TypeScript 6.0.3 に隔離する（ADR-0009。上流の TS 7 対応後に一本化）。"

3. **改訂履歴**:
   - `| 2.2.0 | 2026-10-05 | MINOR | ルートワークスペースで TypeScript 7.x を採用し、OpenAPI codegen 向けに @vaz/schemas に TypeScript 6.0.3 を隔離（ADR-0009、TODO(TYPESCRIPT_MAJOR) を解消） |`

## Evidence & Verification

- **ADR-0009 Documentation**: `docs/adr/0009-typescript-7-adoption.md` provides full justification, boundary definitions, and retirement conditions.
- **Beta Lane Validation**: Verification in `next-agentic-stack` (`docs/beta-lane/2026-10-03-ts7-compiler-api.md`) proved that workspace packages build and typecheck cleanly under TS 7 while `openapi-typescript` requires TS 6 compiler API isolation.
- **Traceability**: Aligns with spec 009 requirements R5.1–R5.6 and design DES-1.8.

## Review Outcome

APPROVED. The MINOR amendment to `.sdd/memory/constitution.md` (v2.2.0) is authorized to be applied.

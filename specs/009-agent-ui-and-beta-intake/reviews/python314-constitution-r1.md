# Constitution Review — `services/api` Python 3.14 (Round 1)

- **Date**: 2026-10-06
- **Trigger**: `specs/009-agent-ui-and-beta-intake/tasks.md` Task 7.2 / Requirement 7
- **Reviewer Context**: Fresh-context constitution review (a separate session with no implementation context, read-only, given only the working-tree diff and spec 009 R7)
- **Scope**: `.sdd/memory/constitution.md` (Version 2.2.0 → 2.3.0 MINOR amendment) and the docs R7.2 requires to move with it
- **Decision**: APPROVED WITH CHANGES → changes applied → APPROVED

## Entry condition (Task 7.1)

`pydantic-ai-sandbox` PR #46 (merged 2026-10-06) re-ran its immutable-commit runner on hub `main`@`e26f6fe`
and recorded Python 3.14 `uv sync` and test-suite success; that repo's `docs/hub-intake-2026-10.md` §1 moved H3
to `verified` (§8.1 satisfied). The entry condition holds.

## Proposed Amendments

1. **Additional Constraints / ツールチェーン**
   - Remove the sentence that kept Python on 3.13 because slowapi 0.1.10 broke on 3.14 (slowapi was replaced in #76).
   - Replace the blanket "バージョンは `mise.toml` で固定する" with one source of truth per tool: `mise.toml` for Node and uv,
     root `package.json` `packageManager` for pnpm, and each lane's `.python-version` for Python (root `mise.toml` carries no
     Python pin). Other places that repeat a version follow their source of truth and are checked by guard tests where they exist.
   - Write the lanes separately: `services/api` 3.14, `services/agent` 3.13.
   - Add the Python 3.15 non-adoption condition (R7.4).
2. **Principle 11**: replace the "too new" pin examples `fastapi<0.137` / `starlette<1.0` / Python 3.13 (all three are gone)
   with `chromadb<1.0` and the `services/api` Python 3.14 pin.
3. **SYNC IMPACT REPORT**, **改訂履歴** (2.3.0 row), version footer.
4. **Paired docs**: root `AGENTS.md` + `CLAUDE.md`, `services/api/AGENTS.md` + `CLAUDE.md`, `.sdd/steering/tech.md`,
   `docs/dependency-policy.md` §8.1, and `services/api/README.md`.

## Findings (fresh-context review) and resolution

| # | Severity | Finding | Resolution |
|---|---|---|---|
| 1 | MAJOR | "別の場所に同じ版を重複して書かない" was already false (`mise.toml` pnpm major, worker Dockerfile ARGs) and would be more so after 7.3 | Rewritten: one source of truth per tool; repeats follow it and are guard-tested where a guard exists |
| 2 | MINOR | "only interpreter pin" wording ignores Docker images and Ruff/pyright targets | Reworded in the constitution and all four paired docs to "source of truth uv reads; images and targets follow it" |
| 3 | MINOR | "Turborepo 2.10.11" has no `turbo.json` or `turbo` dependency behind it | Out of R7's scope; left unchanged and recorded here for a later PATCH |
| 4 | MINOR | Principle 11 examples `fastapi<0.137` / `starlette<1.0` were removed on 2026-10-03 | Replaced with `chromadb<1.0` |
| 5 | MINOR | SYNC report marked this file ✅ before it existed | This file is committed in the same change |
| 6 | MINOR | `services/api/README.md` still said "Python 3.13+" | Updated with the 7.3 pin changes |
| 7 | MINOR | Past-tense wording in dependency policy / `services/api/CLAUDE.md` is only true if the docs land with 7.3 | 7.2 and 7.3/7.4 ship in one PR, as R7.2 requires |

The reviewer confirmed: MINOR is the correct category (a constraint is added and the rule is expanded; no principle is
removed or redefined), every R7.2 item is covered, and nothing weakens an existing rule.

## Human approval

- **Approver**: Kaz (repository owner)
- **Recorded**: 2026-10-06T13:14Z, in the project thread that scheduled spec 009 Task 7 ("Task 7.2 の constitution 改定を承認").
- **Scope of that approval**: the amendment R7.2 describes (per-lane Python versions, removing the slowapi rationale, the
  `.python-version` source of truth). The approval was given before this text was drafted, so the final wording is
  confirmed by the owner's review and merge of the PR that carries it; the runtime pins in Task 7.3 ship in that same PR.

## Review Outcome

APPROVED. The MINOR amendment to `.sdd/memory/constitution.md` (v2.3.0) is authorized to be applied, together with Task 7.3.

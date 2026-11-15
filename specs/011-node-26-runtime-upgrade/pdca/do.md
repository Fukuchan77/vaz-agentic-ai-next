# 011-node-26-runtime-upgrade — PDCA Do log

Evidence file (main working tree only; never inside a worktree). Every verification starts with `node -v`.

## 1.1 / 1.2 — Preparation (2026-11-15)

- 1.1: C0 already exists as `ef0f282` (spec.md, spec.json, plan.md, research.md, tasks.md, traceability.md; `approvals.design/tasks.approved = true`). No new commit needed.
- 1.2: pre-verification diff saved on local-only branch `wip/011-preverify` (not pushed). `git status --short` afterwards shows only `apps/web/AGENTS.md`.
- Patches (scratchpad `$TMPDIR/sdd011/`): `c4.patch` (377 lines), `c1-draft.patch` (69 lines).
- Worktree `../vaz-agentic-ai-next-011-prep` (branch `prep/011-loader`, from `ef0f282`): `node -v` → `v24.22.3`; `git apply --check` passes for both patches. Loader left at `main` state.

## 2.1 — Red (0): L-1..L-5 against the `main` loader (transform + register())

Test file: `apps/worker/tests/typescript-loader.spec.ts` (worktree). Command: `mise exec node@<v> -- pnpm exec vitest run --project worker apps/worker/tests/typescript-loader.spec.ts`

- `node -v` → `v24.22.3`: **2 failed | 3 passed**. L-1, L-2, L-5 pass. L-3 fails: `expected +0 not to be +0` (the `enum` is accepted by `transform`). L-4 fails: `expected { line: 4, column: 7 } to deeply equal { line: 2, column: 51 }` (transform moves the stack position).
- `node -v` → `v26.13.1`: **5 failed | 0 passed**. All fail with `TypeError [ERR_INVALID_ARG_VALUE]: The property 'options.mode' must be one of: 'strip'. Received 'transform'`.
- Matches plan V-1 (0) exactly.

## 2.2 — Red (a): strip-mode loader, still registered with `register()`

- Deviation from tasks.md 2.2 wording: applying the *full* sync `typescript-loader.mjs` (sync `resolve`/`load`) while `register-typescript-loader.mjs` still calls `register()` is not a valid intermediate state. `register()` runs hooks on the async off-thread chain, so the sync `resolve`'s try/catch around `nextResolve` never sees a thrown `ERR_MODULE_NOT_FOUND`. Observed on **both** Node 24 and Node 26: L-1/L-2 fail with `ERR_MODULE_NOT_FOUND: Cannot find module .../packages/schemas/src/rag`. So (a) was taken with only `mode: "strip"` + no `sourceMap` applied to the async `main`-shaped loader (the sync rewrite lands together with `registerHooks()` in 2.3).
- `node -v` → `v24.22.3`: **5 passed**.
- `node -v` → `v26.13.1`: **2 failed | 3 passed**. L-1 and L-2 fail with `DeprecationWarning: \`module.register()\` is deprecated. Use \`module.registerHooks()\` instead. code: 'DEP0205'` (L-1 fails too because `--throw-deprecation` aborts the process). L-3/L-4/L-5 pass. This is the R1.5 Red: `register()` + `mode: "strip"` fails on Node 26.

## 2.3 / 2.4 — registerHooks() + sync loader; V-2 and V-1 (b)

- 2.3: full `c1-draft.patch` applied (sync `resolve`/`load` + `registerHooks({ resolve, load })`); the registration comment was reworded so the Node 24 mention carries "Node 26" on the same line (V-7 rule).
- V-2 (`mise exec node@<v> -- pnpm exec vitest run --project worker apps/worker/tests/typescript-loader.spec.ts`):
  - `node -v` → `v24.22.3`: **5 passed (5)**
  - `node -v` → `v26.13.1`: **5 passed (5)**
- V-1 (b) (PROVE for `load`): `load` temporarily replaced by `return nextLoad(url, context);`.
  - `v24.22.3`: **3 failed | 2 passed** — L-3, L-4, L-5 fail with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` (L-3: `expected 'ERR_UNSUPPORTED_NODE_MODULES_TYPE_STR…' to contain 'ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX'`); L-1 and L-2 still pass (proof L-1 alone cannot guard `load`).
  - `v26.13.1`: identical (3 failed | 2 passed).
  - Restored the real `load`; re-run: v24.22.3 5 passed, v26.13.1 5 passed.
- PROVE for the other cases: L-3/L-4 fail under Red (0) (transform), L-2 fails under Red (a) on Node 26 (DEP0205), L-1 fails under Red (0) on Node 26 and under the `register()`+sync-resolve combination (`ERR_MODULE_NOT_FOUND`).

## 2.5 / 2.6 — ADR-0010 and C1

- ADR `docs/adr/0010-worker-typescript-loader.md` written; `AGENTS.md` / `CLAUDE.md` each gained one Worker-loader item linking it (the `@types/node` 24 lines at AGENTS.md:71 / CLAUDE.md:60 untouched — C5). `doc-links.spec.ts`: 3 passed.
- V-7 rule on added lines (`git diff --cached -U0 | grep '^+' | grep -E 'Node(\.js)? ?24|node:24|NODE_VERSION=24' | grep -vE 'Node(\.js)? ?26'`): 0 lines.
- C1 committed in worktree: `66eb43c fix(worker): load TypeScript through registerHooks in strip mode` (6 files). pre-commit hook ran with `node -v` → `v24.22.3`: lint, typecheck, vitest **80 files passed, 953 passed | 1 skipped (954)**, audit (2 ignored moderate), model-ids all passed.

## 3.1 / 3.2 — C2 Dockerfile pnpm via npm (V-1c)

- Docker daemon was down (`dial unix /Users/k-fukuda/.rd/docker.sock: no such file`); started Rancher Desktop with `rdctl start` / `open -a "Rancher Desktop"` (repo-documented path), server 29.9.2.
- **Red (V-1c)**, worktree at C1 (`node -v` → `v24.22.3`), unchanged Dockerfile: `docker build --build-arg NODE_VERSION=26 -f apps/worker/Dockerfile -t vaz-worker:011-red .` → exit=1:
  `#9 [build 2/6] RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate` / `/bin/sh: 1: corepack: not found` / `exit code: 127`.
- **Green**: only the pnpm line changed (plus a 3-line comment) → `RUN npm install --global pnpm@${PNPM_VERSION}`. `ARG PNPM_VERSION`, `CMD`, top NOTE, `ARG NODE_VERSION` untouched.
  - `docker build --build-arg NODE_VERSION=24 -f apps/worker/Dockerfile -t vaz-worker:011-node24-prep .` → exit=0 (`pnpm deploy` added 282).
  - `docker build --build-arg NODE_VERSION=26 -f apps/worker/Dockerfile -t vaz-worker:011-node26-prep .` → exit=0 (`pnpm deploy` added 282).
- Added-line V-7 check: 0 lines. C2 = `f15de54 fix(worker): install pnpm with npm in the image build` (Dockerfile only). Hook at `v24.22.3`: 80 files, 953 passed | 1 skipped, all checks passed.

## 4.1–4.4 — C3 guards (worktree, Node 24)

New/changed: `tests/repo/worker-erasable-syntax.spec.ts` (new), `container-toolchain-pins.spec.ts` (+engines.node check, corepack comment fixed), `ci-workflows.spec.ts` (+Node-pin guard: 4 negative conditions + ≥1 mise-action step precondition; limit documented in the comment).

PROVE (each guard broken temporarily, restored, re-run; `node -v` → `v24.22.3`):
- 4.1: `erasableSyntaxOnly: false` in `packages/config/tsconfig.base.json` → **2 failed** (`AssertionError: expected false to be true`), restored → 2 passed. Override in `apps/worker/tsconfig.json` only → 1 failed (worker) | 1 passed, restored. (An earlier attempt used an unquoted zsh variable and ran nothing — discarded; the results above are from the re-run.)
- 4.2: `apps/worker/package.json` `engines.node` `>=24` → `>=25` → `AssertionError: expected '25' to be '24'` (1 failed | 2 passed), restored → 3 passed.
- 4.3: in `.github/workflows/tests.yml`, each added alone: `actions/setup-node` step, `with: node-version`, workflow `env: NODE_VERSION`, workflow `env: MISE_NODE_VERSION`, step `env: MISE_NODE_VERSION`, mise-action `with: install_args` → each **1 failed | 5 passed**. File restored (`git status` shows no workflow change); all three spec files → 11 passed.
- C3 = `c301c3e test(repo): guard erasable syntax and Node pin follow-sites` (3 files). Added-line V-7 check: 0 lines. Hook at `v24.22.3`: 81 files, **958 passed | 1 skipped (959)**, all checks passed.

## 5.1 — V-3: Node 24 state at C3 (worktree)

- `node -v` → `v24.22.3`; `mise run check` → exit 0: **Test Files 81 passed (81), Tests 958 passed | 1 skipped (959)**; audit "2 ignored: 2 moderate"; model-ids ✅.
- `docker build -f apps/worker/Dockerfile -t vaz-worker:011-node24 .` → exit 0 (`naming to docker.io/library/vaz-worker:011-node24`).

## 6.1 / 6.2 — C4 version commit (main working tree)

- Pre-state: `git status --short` showed only `apps/web/AGENTS.md` (+ untracked `pdca/`); `git merge --ff-only prep/011-loader` → history C0→C1→C2→C3 linear (`c301c3e`). Worktree removed without `--force`; branch `prep/011-loader` deleted. `wip/011-preverify` kept (local only).
- **V-1d Red** (`node -v` → `v24.22.3`, C3 HEAD, only `dependabot.spec.ts` hunk of `c4.patch` applied): `pnpm exec vitest run --project repo tests/repo/dependabot.spec.ts` → **1 failed | 10 passed**: `AssertionError: package.json's @types/node range must stay on major 26 … expected '^24.19.2' to match /^[~^]?26\./`.
- Remaining `c4.patch` applied with `--exclude=tests/repo/dependabot.spec.ts`; `ARG NODE_VERSION=24` → `26` by hand (only Dockerfile diff vs C3: that 1 line). `git diff wip/011-preverify -- <C4 paths + Dockerfile>` differs only by the C2 pnpm lines and the 2 Node-version comments (C5), as planned.
- Lockfile downgrade check (script pairs removed/added lines of `git diff HEAD -U0 -- pnpm-lock.yaml`, 41 removed / 41 added; extracts `name@x.y.z` per side): changed packages = `@types/node` 24.19.2 → 26.6.6 and `undici-types` 7.24.6 → 8.9.0 only; **downgrade lines: 0** (`undici-types` 7→8 is the expected upward move). `grep -oE "@types/node@[0-9]+\.[0-9]+\.[0-9]+" pnpm-lock.yaml | sort | uniq -c` → `28 @types/node@26.6.6`.
- `node -v` → `v26.13.1`: `pnpm install --frozen-lockfile` ok; `mise run check` exit 0 → **Test Files 81 passed (81), Tests 958 passed | 1 skipped (959)** (baseline 949 / 80 files — not reduced); audit "2 ignored: 2 moderate"; model-ids ✅.
- C4 = `bc456ac chore(runtime): move the Node pin to 26 LTS` (7 files). Hook ran on Node 26.13.1: all checks passed. Added-line V-7 check: 0 lines.

## 7.1–7.3 — C5 preparation (uncommitted)

- 7.2 / 7.3 edits applied (steering, dependency-policy, README, AGENTS/CLAUDE `@types/node` ^26, backlog:112, docker-compose, tsconfig, main.ts comment, Dockerfile 2 comments + NOTE rewrite). V-7 grep (working tree, `node -v` v26.13.1) leaves only `docs/cross-repo-adoption-backlog.md:59` (X-15) = 1 line.
- 7.1: constitution 2.4.0 drafted; fresh-context review verdict APPROVE_WITH_NOTES (1 MEDIUM, 4 LOW), all addressed; record at `specs/011-node-26-runtime-upgrade/reviews/node26-constitution-r1.md`. **Human approval pending** — C5 not committed (7.1 / 7.5 gate). `mise exec -- pnpm exec vitest run --project repo` on Node 26: 11 files, 77 passed.

## 7.4 / 7.5 — C5 and V-7

- 7.4 before commit: V-7 grep left only `docs/cross-repo-adoption-backlog.md:59` (X-15). Added-line check on the staged diff caught one violating line in the review record (Node 24 without Node 26 on the same line) → fixed, re-checked 0.
- Human approval: asked via AskUserQuestion after presenting the review + diff; answer "承認する". Recorded in `reviews/node26-constitution-r1.md` (approver Fukuchan, session, scope).
- C5 = `eeb545a docs(governance): declare Node 26 LTS (constitution 2.4.0)` — 12 paths (11 files + review record). Hook at `v26.13.1`: 81 files, 958 passed | 1 skipped. V-7 re-run after commit: 1 line (X-15).

## 8.1 — V-4 (HEAD eeb545a, `node -v` → `v26.13.1`)

- `mise run check` exit 0: **81 files, 958 passed | 1 skipped (959)** (baseline 80 / 949 — not reduced).
- `mise run build` exit 0. `mise run size` exit 0: JS 242.79 kB brotli (limit 420 kB), CSS 2.96 kB (limit 4 kB).
- `mise run openapi:gen` exit 0; `git status --short packages` empty (no generated diff). (`git diff --exit-code` over the whole tree only trips on the uncommitted `apps/web/AGENTS.md` and `tasks.md` ticks.)

## 8.2 — V-5 image (Node 26)

- **Finding (defect, fixed)**: first V-5 run showed `docker run vaz-worker:011-build pnpm --version` → `12.21.0`, not `PNPM_VERSION` 12.8.2. Root cause: an `ARG` declared before the first `FROM` is not visible inside a stage, so `npm install --global pnpm@${PNPM_VERSION}` expanded to `pnpm@` and installed latest. Confirmed with a scratch Dockerfile (without redeclare → empty; with `ARG PNPM_VERSION` in the stage → 12.8.2). The earlier C2 builds and V-3 had succeeded without catching this because the build only requires *a* pnpm.
- Fix = `afa619f fix(worker): re-declare PNPM_VERSION in the build stage`: bare `ARG PNPM_VERSION` in the build stage + guard test in `container-toolchain-pins.spec.ts` (Red observed first: `expected 'node:${NODE_VERSION}-slim AS build…' to match /^ARG PNPM_VERSION$/m`; Green after the Dockerfile fix; 959 passed | 1 skipped). Deviation: this is a post-C5 fix to C2/C3 content (not C4/C5 files), so the C4/C5 revert unit is intact; V-6 below was run on the final HEAD.
- Final V-5, `node -v` (host) `v26.13.1`: `docker build -f apps/worker/Dockerfile -t vaz-worker:011-node26 .` exit 0. Container: `node -v` → `v26.13.1`, OS `Debian GNU/Linux 13 (trixie)`.
- `docker run … node --throw-deprecation --import ./register-typescript-loader.mjs --input-type=module --eval <all-modules>` → `exit=0`, stdout `all-loaded 7`, `DeprecationWarning` count **0**; stderr in full: `(node:1) ExperimentalWarning: stripTypeScriptTypes is an experimental feature and might change at any time` + `(Use \`node --trace-warnings ...\` to show where the warning was created)`. No env vars were needed.
- pnpm: `docker build --target build -t vaz-worker:011-build` then `docker run --rm vaz-worker:011-build pnpm --version` → `12.8.2` (build-stage method; runtime stage has no pnpm). `integrity-match 12.8.2` (npm `dist.integrity` as hex == `packageManager` `+sha512.`).

## 8.3 — V-6 rollback rehearsal (final HEAD afa619f)

- `git worktree add -b verify/011-rollback ../vaz-agentic-ai-next-011-rollback HEAD`; `git revert --no-edit eeb545a bc456ac` (clean, no conflicts). `mise install` → `node -v` `v24.22.3`; `pnpm install --frozen-lockfile` ok; `mise run check` exit 0: **81 files, 959 passed | 1 skipped (960)**; Dockerfile shows `ARG NODE_VERSION=24` + the pnpm redeclare; `docker build --build-arg NODE_VERSION=24` exit 0. Worktree and branch deleted, nothing pushed.

## 8.4 — V-8

- `mise run audit` (verbatim output, `node -v` v26.13.1), exit 0:
```
[audit] $ pnpm audit --audit-level=moderate
All found vulnerabilities were already reviewed and decided to be ignored
2 ignored: 2 moderate
```
- `mise run secret-scan` exit 0: `357 commits scanned … no leaks found`.
- `git diff --stat main -- specs/`: only `specs/011-node-26-runtime-upgrade/` paths (8 files).
- Lockfile vs `main` (pairing removed/added `name@x.y.z`, 41/41 lines): changed packages `@types/node` 24.19.2 → 26.6.6 and `undici-types` 7.24.6 → 8.9.0; **downgrade lines: 0**.

## 9.1 / 9.2 — records and adversarial review

- traceability.md: Test and Commit columns filled for all 50 rows (REQ-406, REQ-606, REQ-705, REQ-706 stay `pending` until the PR, 9.4).
- Adversarial review (fresh-context `sdd-reviewer`, `reviews/adversarial-r1.md`): **REQUEST_CHANGES**, 0 CRITICAL / 0 HIGH, 5 MEDIUM, 9 LOW. Verified by reviewer: loader L-1..L-5 5/5 on Node 24.22.3 and 26.13.1; mutation probes (pass-through load, removed resolve, async register on Node 26 → DEP0205); erasableSyntaxOnly coverage; `check` exit 0 on Node 26.13.1 (81 files, 959 passed); lockfile only `@types/node` and `undici-types`, no downgrades; simulated rollback passes Node 24 guards.
- Fixed in `9b59074 fix(runtime): pin the image pnpm install and guard all Node pin sites`: MEDIUM 1 (pnpm install line pinned by a guard; `pnpm@latest` now fails it, PROVE shown), MEDIUM 2 (every FROM must use `${NODE_VERSION}`; runtime `FROM node:24-slim` now fails, PROVE shown), MEDIUM 3 (apps/worker `@types/node` range guarded; `^25` now fails, PROVE shown). LOW 6–10: CI guard header wording, pnpm-workspace.yaml stale corepack comment, Dockerfile NOTE wording, constitution review record moved from gitignored `.sdd/reviews/` to `reviews/node26-constitution-critique.md`. Biome warning in the new guard removed. `check` after fix: exit 0, 81 files, **960 passed | 1 skipped (961)**.
- Image re-check after fix (Node 26 host): `docker build -f apps/worker/Dockerfile` exit 0; `docker run … pnpm --version` → `12.8.2`.
- **Open, needs owner decision (not fixed in this round)**:
  - MEDIUM 4: `afa619f` (the PNPM_VERSION ARG fix) and `9b59074` land after C4/C5. Commits C2–C5 as made would install latest pnpm when the image is built. The C4/C5 rollback unit is unaffected, but the history no longer matches R7.1 / plan deviation rule. Options: (a) keep and record as a deviation (this entry), (b) fixup-rebase onto C2 before push (rewrites local history; needs approval).
  - MEDIUM 5: the image build no longer checks the committed `packageManager +sha512`. This is D-2's accepted trade-off (ADR-0010 Consequences; V-5 host check `integrity-match 12.8.2`). The constitution's supply-chain section is not amended. Options: accept with the ADR record, or add a host check to CI.
- Not fixed: LOW 11 (ADR-0010 "承認済み" lacks an ADR-specific approval record), LOW 12 (`load` hard-codes format `module`; no CJS `.ts` today), LOW 13 (pnpm-deploy layout verified by manual V-5, not automated).

## V-9 — CI

- The PR's check list is the record of truth for V-9 (all jobs, including E2E and `eval-pr.yml`). It is recorded as PR comments at 9.4, not in the repository. No commit is added after C6 for it.

## Commit history (after the 9.2 follow-up rewrite)

| commit | content |
|---|---|
| `ef0f282` | C0 SDD artifacts (spec, plan, research, tasks, traceability, spec.json approvals) |
| `66eb43c` | C1 loader (`registerHooks` + strip) + ADR-0010 + regression tests |
| `f9265c4` | C2 image pnpm via npm, build-stage `ARG PNPM_VERSION` re-declaration (folded from `afa619f`) |
| `af0c868` | C3 guards (erasable syntax, engines.node, CI Node pin, PNPM_VERSION redeclare, FROM stages) |
| `bb2199d` | C4 version pin 26 (`@types/node` hold, lockfile 2 packages) |
| `8512aa6` | C5 governance 2.4.0 + follow-sites + review records + `pnpm-workspace.yaml` comment |
| (C6) | this commit: `do.md`, traceability, tasks ticks, `adversarial-r1.md`, `spec.json` phase |

Pre-rewrite head `9b59074` kept as `backup/011-pre-fixup` (local only, not pushed).

## Known deviations recorded for the PR

- **Adversarial MEDIUM 4 (resolved by history rewrite)**: the pnpm fix was originally a separate commit after C4/C5. It is now folded into C2, so C2 installs the pinned pnpm (verified with `docker build` at `f9265c4` on Node 24 and 26).
- **Adversarial MEDIUM 5 (accepted by owner, 2026-11-15)**: the image build no longer checks the committed `packageManager +sha512`; npm checks the registry's `dist.integrity`. Recorded in ADR-0010 (Consequences, re-trigger condition 4). Host check at V-5: `integrity-match 12.8.2`. Constitution supply-chain section not amended.
- **Adversarial LOW 11–13 (not fixed, recorded)**: ADR-0010 status without an ADR-specific approval record; `load` hook fixes format `module` (no CJS `.ts` exists); pnpm-deploy layout verified by manual V-5, not automated.
- **Rollback (V-6, re-run on the final history)**: `git worktree add -b verify/011-rollback2 ../vaz-agentic-ai-next-011-rollback2 HEAD` at `8512aa6`; `git revert --no-edit 8512aa6 bb2199d` (C5 then C4, clean). `node -v` → `v24.22.3`; `pnpm install --frozen-lockfile` ok; `mise run check` exit 0: **81 files, 960 passed | 1 skipped (961)**; Dockerfile `ARG NODE_VERSION=24`. Worktree and branch removed; nothing pushed. (An earlier rehearsal on `9b59074` also passed: 959 passed.)
- **Working-tree incident**: during the history rewrite the uncommitted `apps/web/AGENTS.md` diff in the primary worktree was lost (no stash/backup taken before `git reset --hard`). Not part of any commit; `HEAD` content of that file is unchanged.

## Note on V-3 / commit hashes after the history rewrite

- The V-3 record (5.1) and the C1–C5 entries above cite the pre-rewrite hashes `c301c3e` (C3), `bc456ac` (C4), `eeb545a` (C5) and `afa619f` / `9b59074` (fixes). After the rewrite the same contents are `af0c868`, `bb2199d`, `8512aa6`, with the two fixes folded in (see the history table). `traceability.md` uses the rewritten hashes.
- V-3's `check` (958 passed) ran on the pre-rewrite C3. The rewritten C3 (`af0c868`) pre-commit hook ran on Node 26 (not Node 24) with 960 passed | 1 skipped; the rewritten C1/C2 hooks and the C2 image builds ran on Node 24 (`f9265c4`: `docker build` exit 0 for Node 24 and 26). A strict Node 24 `check` at the rewritten C3 was not re-run; the rollback rehearsal on the final history (Node 24, 960 passed) covers the same code.

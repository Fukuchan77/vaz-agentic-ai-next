# Adversarial Review R1 — spec 011 (Node 24 LTS → 26 LTS)

- **Reviewer**: fresh-context adversarial reviewer (did not author the change)
- **Branch / HEAD**: `chore/011-node-26-runtime-upgrade` @ `afa619f`
- **Range reviewed**: `ef0f282..HEAD` (C1 `66eb43c`, C2 `f15de54`, C3 `c301c3e`, C4 `bc456ac`, C5 `eeb545a`, fix `afa619f`)
- **Inputs**: `spec.md`, `plan.md`, the commit diffs, the code and tests as they stand. `pdca/do.md` and `tasks.md` ticks were NOT used to decide correctness; they were only checked where the reviewer ran the same command to confirm them.
- **risk_trigger**: empty (manual review). Prior review in scope: `reviews/node26-constitution-r1.md` (APPROVED; its findings are resolved and not re-raised).
- **Scope limits**: no docker build, no `mise run build` / `size` / `openapi:gen` / `secret-scan` re-run, no push, no PR. Only read-only and cheap commands were run (see "Evidence run by reviewer").

---

## Critique

### [MEDIUM] The image guard does not pin the `npm install` argument; a regression to `pnpm@latest` passes every guard
**Location**: `tests/repo/container-toolchain-pins.spec.ts:46-61` (test "the build stage re-declares PNPM_VERSION so the install is pinned"); `apps/worker/Dockerfile:38` (`RUN npm install --global pnpm@${PNPM_VERSION}`)
**Issue**: The guard checks that a bare `ARG PNPM_VERSION` line exists in the build stage and precedes the string `npm install --global pnpm@`. It never checks that the install argument is `${PNPM_VERSION}`. The same test file's `PNPM_VERSION equals the root packageManager version` test only reads the `ARG` line, not the `RUN` line.
**Evidence**: I reproduced the guard's exact assertions on a mutated Dockerfile. Result: `GUARD PASSES` for the HEAD Dockerfile, for `pnpm@latest` substituted into the `RUN` line, and for `pnpm@11.10.0` substituted into it. The `afa619f` commit message describes this exact failure mode (the install expanded to the latest pnpm, 12.21.0). The guard was added for that bug but does not catch its natural reintroduction when someone hard-codes the version. Spec R2.6 requires the install to be `npm install --global pnpm@${PNPM_VERSION}`.
**Confidence**: high
**Fix**: Assert the `RUN` line of the build stage matches `/^RUN npm install --global pnpm@\$\{PNPM_VERSION\}$/m` exactly. Optionally also assert no other `npm install --global pnpm@` occurrence exists. Add a mutation check to `do.md` (hard-code `pnpm@latest`, guard must fail).

### [MEDIUM] Runtime-stage `FROM` is not guarded; `FROM node:24-slim AS runtime` passes the Node pin guard
**Location**: `tests/repo/container-toolchain-pins.spec.ts:63-71` (test "NODE_VERSION equals the mise.toml [tools] node major"); `apps/worker/Dockerfile:52` (`FROM node:${NODE_VERSION}-slim AS runtime`)
**Issue**: The NODE_VERSION guard reads only the `ARG NODE_VERSION=` line. Nothing asserts that each `FROM` line uses `${NODE_VERSION}`. Spec R2.2 requires BOTH the build and runtime stages to use the same major, and spec R2.5 says the guard must fail when the Dockerfile's Node major disagrees with the canonical pin. Only the `ARG` is covered.
**Evidence**: Mutant with the runtime `FROM` changed to `node:24-slim` (`ARG NODE_VERSION=26` left as is): the NODE_VERSION assertion still passes (`readArg` returns `26`). The build-stage `FROM` has the same gap. Spec R2.2 and the plan's DES-1.5 both name the Dockerfile's Node major, so this is a coverage gap against the stated AC, not a design choice.
**Confidence**: high
**Fix**: Add an assertion that every `^FROM node:` line in the Dockerfile matches `^FROM node:\$\{NODE_VERSION\}-slim( AS \w+)?$`, and that the count of such lines is 2 (anti-false-green).

### [MEDIUM] `apps/worker/package.json` `@types/node` range is not covered by any guard
**Location**: `tests/repo/dependabot.spec.ts`, test "npm ecosystem ignores exactly the majors held back in package.json" (reads `new URL("package.json", ROOT)` only); `apps/worker/package.json:24` (`"@types/node": "^26.6.6"`)
**Issue**: Spec R3.1 requires the range in BOTH root and `apps/worker` to be on 26. Spec R3.3 requires a guard failure when the range's major and the Dependabot hold disagree. The HELD_BACK check reads only the root `package.json`. Changing `apps/worker/package.json` back to `^24` leaves every guard green.
**Evidence**: The only `package.json` the test reads is `ROOT/package.json` (`readFile(new URL("package.json", ROOT), "utf8")`). `grep -n '"@types/node"' apps/worker/package.json` returns `^26.6.6`, and no test asserts on it. Lockfile check: `grep -c '@types/node@26' pnpm-lock.yaml` is 28, so a worker-only regression to `^24` would still create a second `@types/node` entry in the lockfile.
**Confidence**: high
**Fix**: Extend the HELD_BACK test to read every workspace `package.json` that declares `@types/node` (root plus `apps/worker`) and assert each range matches `heldMajor`.

### [MEDIUM] Commit `afa619f` (pnpm ARG fix) lands after C4 and C5, violating R7.1 and the plan's deviation rule; C2–C5 have an unpinned pnpm
**Location**: `git log ef0f282..HEAD` (`afa619f` is HEAD, after `eeb545a`); `apps/worker/Dockerfile:32` (re-declared `ARG PNPM_VERSION`); `tests/repo/container-toolchain-pins.spec.ts` (guard added in `afa619f`)
**Issue**: Spec R7.1 requires the R2.6 Dockerfile pnpm fix to be an independent commit BEFORE the version commit. The fix that made the R2.6 install correct (the redeclared ARG) was committed after the version commit (C4) and the governance commit (C5). The plan's Error Handling section (plan.md:521-525) says a post-C4/C5 fix must be folded into C4 or C5 (via `--fixup` and autosquash), or else added to the V-6 revert set. Neither happened. `do.md` records this as a "Deviation", but the plan has no amendment for it.
**Evidence**: `git show f15de54:apps/worker/Dockerfile` installs with `RUN npm install --global pnpm@${PNPM_VERSION}` and no `ARG PNPM_VERSION` in the build stage, so the commits `f15de54`, `c301c3e`, `bc456ac`, `eeb545a` all build an image that installs the latest pnpm (`do.md` line 97 records 12.21.0 for the pinned 12.8.2). The rollback itself still works: I checked that the Node 24 rollback tree (`git revert eeb545a bc456ac` applied via `merge-tree`) keeps the redeclared ARG, and its repo guards pass (11 files, 78 tests on Node 24.22.3). The problem is the history contract, not the rollback result.
**Confidence**: high (the ordering fact); medium on severity, since the HEAD result is correct
**Fix**: Pick one and record it. (a) Before push, `git commit --fixup=f15de54 -- apps/worker/Dockerfile tests/repo/container-toolchain-pins.spec.ts` (guard hunk to C3 `c301c3e`) and `GIT_SEQUENCE_EDITOR=true git rebase -i --autosquash <C1>`, after user consent (plan.md:523-524 requires it). (b) If history stays, amend spec R7.1 / the plan with the written reason and add `afa619f` to the V-6 revert set and PR rollback text. Either way, note in `do.md` which option was taken and re-run V-3 for the C2 state.

### [MEDIUM] Image build no longer checks the committed `packageManager +sha512`; the only check is a manual one-time comparison
**Location**: `apps/worker/Dockerfile:35-38` (npm install, comment); `docs/adr/0010-worker-typescript-loader.md` Consequences; `specs/011-node-26-runtime-upgrade/plan.md` V-5
**Issue**: The corepack path verified the pnpm tarball against the hash committed in the root `package.json` (`packageManager: pnpm@12.8.2+sha512.a594…`) on every build. The npm path verifies only against the registry's `dist.integrity`, which the registry itself serves. The committed hash is no longer enforced at build time. ADR-0010 states this honestly and re-trigger condition 4 covers it. But constitution "Additional Constraints: サプライチェーン" is not amended, spec R2.6 does not mention it, and the only mitigation is a manual comparison (V-5) that runs once.
**Evidence**: I re-ran the V-5 comparison: `npm view pnpm@12.8.2 dist.integrity` decodes to the same hex as the `+sha512.` in `packageManager` (`INTEGRITY MATCH`). So the hash matches today. Nothing in the build or in CI enforces that it keeps matching. The guards read the `ARG`, not the registry.
**Confidence**: high on the fact; the severity is a judgement about a supply-chain control that the spec accepted
**Fix**: Either (a) add an in-build check that compares `npm pack pnpm@${PNPM_VERSION}`'s sha512 with the `packageManager` hash (the ADR's own re-trigger path), or (b) record the accepted residual risk in the constitution's supply-chain section or in ADR-0010 as an explicit accepted decision with the owner's name and date. Do not leave it as an unrecorded downgrade.

### [LOW] CI Node pin guard has bypass channels outside its listed conditions
**Location**: `tests/repo/ci-workflows.spec.ts:104-159` (`scanNodePins`)
**Issue**: The guard checks `actions/setup-node`, `node-version`, `NODE_VERSION`, `MISE_*` env keys, and mise-action `install_args` / `mise_toml`. It does not check: a job-level `container:` image (e.g. `node:24`), a `run:` step that names a Node version (`mise use node@24`, `npx node@24`, `docker://node:24`), or a `MISE_*` variable exported inside a `run:` script rather than an `env:` block. Spec R2.4 lists exactly the checked items, so the guard meets the AC. The guard's own header, though, says "no workflow may declare a Node version of its own", which is broader.
**Evidence**: `git grep -nE 'container:|docker://node|mise use|export MISE_' -- .github` finds no current occurrence, so nothing is broken today. The gap is in the guard's claim, not in the current state.
**Confidence**: medium (I did not construct a failing workflow, only read the scan code)
**Fix**: Either narrow the header comment to the four enumerated conditions, or add the checks: `jobs.*.container` must not be a `node:` image, and no `run:` string may match `/MISE_\w+=|mise use .*node|node@\d|docker:\/\/node/`.

### [LOW] "Node 25+ images ship no corepack" is generalized from one observed image
**Location**: `apps/worker/Dockerfile:35-37`; `docs/adr/0010-worker-typescript-loader.md` Context (`Node 25 以降の公式イメージは corepack を同梱しない`); `tests/repo/container-toolchain-pins.spec.ts:15`
**Issue**: The Dockerfile comment, ADR and guard header all say "Node 25+ images" lack corepack. The only observation is the `node:26-slim` build failing with `corepack: not found` (`do.md` V-1c, `research.md` I-6). No Node 25 image was tested. The local mise-installed Node 26.13.1 (`mise where node@26`/bin) does ship a `corepack` binary, so the claim is about the official Docker image, not the Node release.
**Evidence**: `ls "$(mise where node@26)/bin"` lists `corepack`. The Docker claim is supported by the V-1c Red only for 26.
**Confidence**: medium
**Fix**: Narrow the wording to "the official `node:26-slim` image has no corepack (observed 2026-11-15)" in the Dockerfile, ADR and guard header.

### [LOW] `pnpm-workspace.yaml` still says Corepack enforces the packageManager version
**Location**: `pnpm-workspace.yaml:18` (`# Corepack and mise already enforce the exact packageManager/tool version.`)
**Issue**: The image no longer uses corepack. The statement is now only partly true (mise still pins the tool; corepack no longer runs in the image). This is a stale claim introduced by the change, and it is not a Node-24 mention, so R5.5's grep would not catch it.
**Evidence**: Read of `pnpm-workspace.yaml:14-20` and `apps/worker/Dockerfile:35-38`.
**Confidence**: high
**Fix**: Change the comment to "mise enforces the tool version; the worker image installs the packageManager version with npm (see ADR-0010)".

### [LOW] `apps/web/AGENTS.md` is modified in the working tree; keep it out of the PR
**Location**: `apps/web/AGENTS.md:3` (working tree `# This is NOT the Next.js…` → `## This is NOT…`); `git status` shows `M apps/web/AGENTS.md` and `M specs/011-node-26-runtime-upgrade/tasks.md`
**Issue**: No commit in `ef0f282..HEAD` touches `apps/web/AGENTS.md` (`git log ef0f282..HEAD -- apps/web/AGENTS.md` is empty), so the branch's diff is clean. The file is still dirty in the working tree with an unrelated heading change, which spec R8.4 names as the example of what must not be included. The plan says not to stage it and not to restore it. The risk is a later `git add -A` or a PR opened from the working tree.
**Evidence**: `git diff HEAD -- apps/web/AGENTS.md` shows one changed heading line. `git diff ef0f282 -- apps/web/AGENTS.md` is empty for committed history.
**Confidence**: high
**Fix**: Leave it unstaged as the plan says. Before the PR, confirm `git diff --stat main...HEAD` lists no `apps/web/AGENTS.md`. Record that check in `do.md`.

### [LOW] Constitution review record points to a gitignored file
**Location**: `specs/011-node-26-runtime-upgrade/reviews/node26-constitution-r1.md` ("Full critique: `.sdd/reviews/011-node26-constitution-r1.md`"); `.gitignore:165` (`.sdd/*`)
**Issue**: The committed review record references a full critique under `.sdd/reviews/`, which `.gitignore` excludes (`.sdd/*`). A reader of the repo cannot open the cited critique. The file exists on disk only.
**Evidence**: `git check-ignore -v .sdd/reviews/011-node26-constitution-r1.md` → `.gitignore:165:.sdd/*`.
**Confidence**: high
**Fix**: Either copy the full critique into `specs/011-…/reviews/` (the spec's stated location) or drop the pointer and inline the findings table (it is already inlined in the record).

### [LOW] ADR-0010 status says "承認済み" without an ADR-specific human approval record
**Location**: `docs/adr/0010-worker-typescript-loader.md:3` (`Status: 承認済み（2026-11-15）`)
**Issue**: The approval the plan cites (design and tasks approval, plan.md Constitution Compliance principle 10) is a session-level approval of the plan, not a recorded approval of this ADR. The constitution amendment has a dedicated approval record; the ADR does not.
**Evidence**: The ADR's status line; no approval entry in `reviews/` for the ADR.
**Confidence**: low (the status may refer to the plan approval the author had in mind)
**Fix**: Either cite the approval source in the ADR's Status line, or change the status to "Accepted (pending owner sign-off)" until it is recorded.

### [LOW] Loader hard-codes `format: "module"` for every `.ts` URL
**Location**: `apps/worker/typescript-loader.mjs`, function `load` (returns `format: "module"` unconditionally for `file:…/.ts`)
**Issue**: A `.ts` file under a CommonJS package scope would be forced to ESM. No such file exists in the repo today (`typescript-loader.spec.ts` only uses `type: module` fixtures), and spec R1 does not require CJS handling.
**Evidence**: Read of the `load` function; no CJS `.ts` in the workspace. Not exercised.
**Confidence**: low
**Fix**: Pass through `context.format` from `nextLoad`, or assert in the loader that the nearest `package.json` is `"type": "module"`, and note the limit in ADR-0010.

### [LOW] R1.1 in the deployed layout (real files under `node_modules`) is verified only by the manual V-5 run
**Location**: `apps/worker/tests/typescript-loader.spec.ts:19-23, 129-138` (L-5 uses a fixture); `specs/011-node-26-runtime-upgrade/spec.md` Out of Scope (CI docker job)
**Issue**: The automated regression tests use the workspace symlinks (L-1, L-2) or a fixture (L-3 to L-5). The actual `pnpm deploy` layout is exercised only by the manual image run in V-5. The spec accepts this via the Clarifications ("docker build … ローカルで実施", CI job is Future Work). It is noted here so the gap is visible, not as a new defect.
**Evidence**: spec.md Clarifications (イメージの検証 → local Docker, Future Work); plan.md V-5.
**Confidence**: high (fact)
**Fix**: None required for this PR. Keep the Future Work item (CI docker job) and make sure the PR body points at the V-5 record.

### [LOW, informational] Items not yet satisfiable before the PR exists
**Location**: `traceability.md` (50 of 50 REQ/NFR rows have empty Test and Commit cells); spec R4.6, R6.6, R6.8 (PR body), R7.5, R7.6
**Issue**: These are pending by design (C6, PR, CI). Listed so the consolidator does not treat them as shipped.
**Evidence**: `awk` over the traceability table: `rows=50 rows_missing_test_or_commit=50`.
**Confidence**: high
**Fix**: Fill during C6 and the PR, as the plan's delivery sequence says.

---

## Verified (reviewer's own evidence)

These checks were run by the reviewer. They are reported so the consolidator can see what is not a finding.

1. **Loader regression tests L-1..L-5 are non-vacuous.** `pnpm exec vitest run --project worker apps/worker/tests/typescript-loader.spec.ts` → 5/5 on Node 24.22.3 and 5/5 on Node 26.13.1.
2. **Mutation probes (reviewer-run, both Node 24.22.3 and Node 26.13.1):**
   - Real loader: L-1/L-2 exit 0 with `all-loaded 7`, no DeprecationWarning; L-3 `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX`; L-4 `throws.ts:2:51`; L-5 value `42`.
   - Mutant "load hook is a pass-through" (M1): L-3, L-4 and L-5 all fail with `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING` on both versions. L-1 still passes. This matches the plan's claim that L-1 alone cannot guard `load`, and shows L-3 to L-5 do.
   - Mutant "resolve hook removed" (M4): the workspace-based L-1 fails with `ERR_MODULE_NOT_FOUND` on both versions, so the `resolve` hook is guarded.
   - Mutant "async `register()` + strip" (M5, the R1.5 Red shape): on Node 26 with `--throw-deprecation`, L-2 exits 1 with `code: 'DEP0205'`; on Node 24 it exits 0. The Red is reproduced.
3. **`erasableSyntaxOnly` rejects the syntax Node strip-mode rejects.** `tsc --erasableSyntaxOnly` on `enum`, `namespace`, parameter property, `<T>x` cast, `import = require` gives TS1294 for each. Node 26's `--experimental-strip-types` gives `ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX` for each. The guard's effective-value check was falsified: a temp tsconfig extending `apps/worker/tsconfig.json` with `erasableSyntaxOnly: false` shows `"erasableSyntaxOnly": false` in `tsc --showConfig`.
4. **Repo guards pass on Node 26** (`mise exec node@26`): `ci-workflows`, `worker-erasable-syntax`, `container-toolchain-pins`, `dependabot`: 4 files, 23 tests passed. `doc-links` and `model-ids`: 3 passed.
5. **Full gate on Node 26** (`mise run check`, background run on `afa619f`): exit 0. Lint 363 files clean; typecheck clean; `Test Files 81 passed (81)`, `Tests 959 passed | 1 skipped (960)`. Baseline is 80 / 949, so the count did not drop.
6. **Lockfile diff has no downgrades.** The lockfile diff touches only `@types/node` (24.19.2 → 26.6.6) and `undici-types` (7.24.6 → 8.9.0, upward). No `@types/node@24` or `undici-types@7` residue remains. Publish times: `@types/node@26.6.6` 2026-10-28, `undici-types@8.9.0` 2026-07-24, both older than the 24h `minimumReleaseAge`.
7. **Constitution 2.4.0 is consistent with R4.** MINOR bump with the one-line criterion in the Sync Impact Report; history row; Additional Constraints ツールチェーン now says Node 26 LTS; steering Constraints updated; `docs/dependency-policy.md` §7, §8 lane table, §8.1 row and §8.2 step 2 updated as R4.5 requires; principles 1–11 text unchanged (diff shows no principle change).
8. **R5.5 grep is clean.** `git grep` for stale Node 24 / `@types/node` 24 patterns, excluding `specs/`, returns only the dated X-15 history row in `docs/cross-repo-adoption-backlog.md:59`, which R5.5 allows. Case-insensitive variant also clean.
9. **Commit boundaries for C1–C5 match the plan's file lists.** C1 touches loader, tests, ADR, AGENTS/CLAUDE. C2 touches only the Dockerfile pnpm line. C3 touches the three guard files. C4 touches `mise.toml`, one Dockerfile `ARG` line, `engines`, `@types/node` ranges, lockfile, dependabot, dependabot spec. C5 touches the 11 governance and doc files plus the review record. No commit touches `.github/workflows/*`, `packages/config/tsconfig.base.json`, or other specs.
10. **Rollback tree (R7.4).** Simulated `git revert eeb545a bc456ac` (via `merge-tree`, object-only, no checkout). Result: `mise.toml` `node = "24"`; worker `engines >=24`; root and worker `@types/node ^24.19.2`; dependabot `>=25`; `HELD_BACK` 24; constitution 2.3.1; no `@types/node@26` lockfile residue. Its repo guards pass on Node 24.22.3 (11 files, 78 tests). The worker project could not be run in the temp tree because the harness does not reproduce the pnpm workspace links; this is a harness limit, not a repo finding.
11. **Image pin claim (V-5).** `npm view pnpm@12.8.2 dist.integrity` decoded to hex equals the `+sha512.` value in `packageManager` (`INTEGRITY MATCH`).

---

## Spec coverage (R1–R8, NFR-1–4)

| Req | Status | Evidence / gap |
|---|---|---|
| R1.1 | covered | L-1 both versions; deployed layout manual only (LOW) |
| R1.2 | covered | L-2 with `--throw-deprecation`; mutation-proven |
| R1.3 | covered | L-3, L-5; M1 mutant caught |
| R1.4 | covered | `worker-erasable-syntax.spec.ts`; falsified by temp override |
| R1.5 | covered (manual Red) | M5 reproduces DEP0205 on 26; Red recorded in `do.md` |
| R1.6 | covered | L-4 (position check is non-vacuous; transform changes it per `do.md`) |
| R2.1 | covered | `mise.toml` `node = "26"` |
| R2.2 | **gap** | ARG covered; `FROM` lines unguarded (MEDIUM #2) |
| R2.3 | covered | `engines.node >=26`, guarded |
| R2.4 | partial | guard covers listed conditions; bypasses (LOW) |
| R2.5 | covered | ARG guard |
| R2.6 | **gap + ordering** | install line correct at HEAD; guard does not pin it (MEDIUM #1); fix committed after C4/C5 (MEDIUM #4) |
| R3.1 | **gap** | root covered; `apps/worker` range unguarded (MEDIUM #3) |
| R3.2 | covered | dependabot `>=27` |
| R3.3 | partial | root only (MEDIUM #3) |
| R3.4 | covered | comment reads 26 LTS |
| R4.1–R4.5 | covered | constitution 2.4.0, steering, dependency-policy §7/§8/§8.1/§8.2 all updated |
| R4.6 | pending | PR body not yet written |
| R5.1–R5.4 | covered | README 3+2 lines; AGENTS/CLAUDE; compose, Dockerfile, tsconfig, main.ts comments |
| R5.5 | covered | grep clean except X-15 history row |
| R5.6 | covered | no other `specs/` file changed in range |
| R6.1 | covered (reviewer re-run) | 81 files, 959 passed \| 1 skipped |
| R6.2 | claimed, not re-run | `do.md` size 242.79 kB brotli (limit 420) |
| R6.3 | claimed, not re-run | `do.md` `openapi:gen` diff empty |
| R6.4 | claimed, not re-run | `do.md`: `docker build` exit 0 on 26 (Docker not re-run per brief) |
| R6.5 | claimed, not re-run | `do.md`: `all-loaded 7`, 0 DeprecationWarning |
| R6.6 | pending | CI not run |
| R6.7 | covered | `do.md` records `node -v` |
| R6.8 | covered for lockfile; PR body pending | reviewer re-verified 0 downgrades |
| R7.1 | **violated** | fix `afa619f` after C4/C5 (MEDIUM #4) |
| R7.2 | covered | C4 Dockerfile diff is the one `ARG` line; comments in C5 |
| R7.3 | claimed | `do.md`: check green on 24 at C1–C3; C2–C3 image had unpinned pnpm (MEDIUM #4) |
| R7.4 | covered (guards only) | rollback tree guards green on 24; full check not re-run |
| R7.5 | pending | one PR not yet opened |
| R7.6 | pending | merge commit not yet done |
| R8.1 | partial | plan/tasks/traceability present; traceability Test/Commit cells empty until C6 |
| R8.2 | covered | ADR-0010 has registerHooks, strip, erasableSyntaxOnly, Node 24 and 26 |
| R8.3 | covered | `research.md` I-1 to I-11 cover gap-analysis §6 |
| R8.4 | covered on branch | `apps/web/AGENTS.md` dirty in worktree only (LOW) |
| NFR-1 | covered | L-1..L-5 on 24 and 26 |
| NFR-2 | claimed, not re-run | `do.md` size |
| NFR-3 | partial | `check` includes audit (passed); secret-scan not re-run |
| NFR-4 | partial | guard bypasses (LOW); pin is major-only by design |

## Verdict

**REQUEST_CHANGES**

Reason: no CRITICAL or HIGH findings, and the loader, lockfile, constitution, and rollback results hold up under reviewer re-runs. Five MEDIUM findings block a clean APPROVE: (1) the pnpm install line is not pinned by any guard (`pnpm@latest` passes); (2) the `FROM` lines are not guarded (R2.2); (3) the `apps/worker` `@types/node` range is not guarded (R3.1/R3.3); (4) the `afa619f` fix lands after C4/C5, breaking R7.1 and the plan's deviation rule. Finding (5) is a weakened supply-chain control (the build no longer checks the committed `+sha512`) that needs an explicit owner decision. Fixes for (1)–(3) are small test edits. Finding (4) needs a decision on history (fixup vs. recorded deviation). Moving to APPROVE_WITH_NOTES is reasonable once (1)–(4) are resolved or accepted in writing.

## Hallucination Signal

forced: false

Every finding above cites a file and line, or a command the reviewer ran. None is a stretch to reach a count.

## Evidence run by reviewer (commands, for reproducibility)

- `mise exec node@24 -- pnpm exec vitest run --project worker apps/worker/tests/typescript-loader.spec.ts` → 5 passed
- `mise exec node@26 -- pnpm exec vitest run --project worker apps/worker/tests/typescript-loader.spec.ts` → 5 passed
- `mise exec node@26 -- pnpm exec vitest run --project repo tests/repo/{ci-workflows,worker-erasable-syntax,container-toolchain-pins,dependabot}.spec.ts` → 23 passed
- `mise run check` on Node 26.13.1 → exit 0 (81 files, 959 passed | 1 skipped)
- Loader mutation probes (M1, M3/M5, M4) on Node 24.22.3 and 26.13.1 with fixtures under `/tmp/review-mut`
- Guard-assertion re-implementation on mutated Dockerfiles (`/tmp/review-mut/guard-mut.mjs`)
- `git diff ef0f282..HEAD -- pnpm-lock.yaml`; `git grep` V-7 pattern; `git merge-tree` rollback simulation (object-only)
- `npm view pnpm@12.8.2 dist.integrity` (read-only registry lookup); `npm pack pnpm@12.8.2` into `/tmp` (read-only inspection of lifecycle scripts)
- Rollback tree guards: `/Users/k-fukuda/.local/share/mise/installs/node/24.22.3/bin/node … vitest.mjs run --project repo` in a `git archive` of `c691f90` → 11 files, 78 passed

Not run (out of brief or denied): docker build, `mise run build` / `size` / `openapi:gen` / `secret-scan`, full worker project on the rollback tree (harness limit), and one `mise`-based rollback probe (denied by the permission system).

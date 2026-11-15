# Review: constitution 2.3.1 -> 2.4.0 (Node 24 LTS -> Node 26 LTS), round 1

Scope: `git diff -- .sdd/memory/constitution.md`, spec 011 R4.1-R4.3 and the Clarifications on the MINOR/PATCH criterion, and the unchanged Governance section. Nothing else was read.

## Critique

### [MEDIUM] Templates Status marks the review file as done, but it does not exist yet
**Location**: .sdd/memory/constitution.md:15 (Sync Impact Report, Templates Status)
**Issue**: The line is marked ✅ "新規コンテキストのレビューと人間承認を記録" for `specs/011-node-26-runtime-upgrade/reviews/node26-constitution-r1.md`. That directory does not exist in the working tree, and no human approval can have been recorded before this review ends.
**Evidence**: `ls specs/011-node-26-runtime-upgrade/reviews` -> "No such file or directory". This round's record is at `.sdd/reviews/011-node26-constitution-r1.md`, a different path and file name. R4.2 requires the record "を `specs/011-node-26-runtime-upgrade/reviews/` に残す".
**Confidence**: high
**Fix**: Before the commit, put the final review round and the human approval at the path the mark names (or copy it there, or change the mark to that path). Then the ✅ becomes true. The 2.3.0 precedent has the same mark, but this does not excuse it being false at commit time.

### [LOW] Other ✅ marks are not proven by this diff
**Location**: .sdd/memory/constitution.md:16-19
**Issue**: Four ✅ lines claim edits to other files. The constitution diff cannot prove any of them.
**Evidence**: Could not verify from the allowed inputs:
- `.sdd/steering/tech.md` (Constraints now declare Node 26 LTS)
- `docs/dependency-policy.md` (§7, the §8 lane table, the §8.1 `@types/node` row, §8.2 step 2)
- `README.md` (prerequisite Node 26 LTS)
- `AGENTS.md` / `CLAUDE.md` (`@types/node` hold at `^26`)

**Confidence**: high that these are unverified. I make no claim that they are wrong.
**Fix**: The committer should confirm each one in the same commit. Grep for stale "Node 24" and "@types/node 24" and `^24` before marking them done.

### [LOW] The MINOR/PATCH criterion appears only in the Sync Impact Report comment, not in Governance
**Location**: .sdd/memory/constitution.md:4 against Governance "Versioning policy"
**Issue**: Governance defines MINOR as "原則・節の追加、または実質的な拡張" and PATCH as "明確化・表現修正". A change of the declared Node version fits neither definition well. The new criterion ("意図した版上げ=MINOR、実態への追随=PATCH") is a gloss that lives only in an HTML comment, and a later Sync Impact Report will overwrite it.
**Evidence**: The Governance text above. The 2.3.1 history row also says the canonical `mise.toml` was raised to uv 0.13 ("正本の `mise.toml` を 0.13 へ上げたため"). So the intended/forced distinction was applied after the fact, and 2.3.0 also added a new rule (the Python 3.15 non-adoption condition) beyond a version bump.
**Confidence**: medium
**Fix**: MINOR is the correct and spec-mandated result (R4.3, 2.3.0 precedent) and I do not dispute it. Optionally add the one-line criterion to the Versioning policy bullets in a later amendment, so the rule survives the comment being replaced. Not blocking.

### [LOW] Modified Sections cites the wrong requirement for the follow-sites
**Location**: .sdd/memory/constitution.md:8
**Issue**: "他の箇所…は正本に追随する（spec 011 R4.1）". R4.1 only requires the constitution to name Node 26 LTS as canonical. The follow-site changes (Dockerfile `ARG`, `engines.node`, `@types/node`) come from R2 and R3.
**Evidence**: R4.1 text: "憲章…で Node 26 LTS を正本の版として示す". The Modified Sections line also uses the future tense ("上げる") while the 改訂履歴 row uses the past tense ("上げた").
**Confidence**: medium
**Fix**: Cite "spec 011 R2/R3/R4.1" and align the tense.

### [LOW] The 改訂履歴 row has no literal "Node 24 LTS → Node 26 LTS" string
**Location**: .sdd/memory/constitution.md:366
**Issue**: Both versions are on the same line, but as prose ("24 LTS から 26 LTS へ"). Only a guard or grep that looks for the literal arrow form would miss it. I know of no such guard.
**Evidence**: "Node の正本の版を 24 LTS から 26 LTS へ上げた…"
**Confidence**: low
**Fix**: None needed to meet the requirement. If a grep-friendly form is wanted, write "Node 24 LTS → Node 26 LTS".

## Answers to the review questions

- (a) MINOR is correct. It follows R4.3 and the 2.3.0 precedent, and the one-line criterion is present on line 4 of the Sync Impact Report. The Governance MINOR wording only fits loosely (see the LOW finding above). PATCH would be wrong because the version change is intentional, not a forced correction.
- (b) Verified from the diff. The hunks are the header comment, one sentence in Additional Constraints / ツールチェーン (line 272), one table row, and the footer. Principles 1-11 are textually unchanged, and nothing is added or removed beyond what R4.1-R4.3 require. The row also describes code changes (worker loader, ADR-0010, Dockerfile). That is history prose, not a normative change, and ADR-0010 was not verified.
- (c) The Sync Impact Report matches the diff:
  - Modified Principles "none", the Modified Sections entry, and Added/Removed "none" are consistent.
  - Deferred Items keeps `BRANCH_COVERAGE_THRESHOLD`, and its wording is unchanged from the previous report.
  - Templates Status is the only inconsistent part. Line 15 is false at the time of the diff, and lines 16-19 are unverified (see above).
- (d) Yes. The one row holds 24 LTS and 26 LTS, in the "から" form.
- (e) Yes. Version 2.4.0 matches the Version Change line and the history row. Last amended 2026-11-15 matches the row date. Ratified is unchanged.
- (f) I found no false statement and nothing that weakens an existing rule. "Node 26 LTS" keeps the same pin granularity as the old "Node 24 LTS". The rollback, supply-chain and single-canonical-source rules are untouched.

## Verdict
APPROVE_WITH_NOTES

Condition: make the Templates Status review-file mark true at commit time by putting this review and the human approval at `specs/011-node-26-runtime-upgrade/reviews/node26-constitution-r1.md`. The other items are optional.

## Hallucination Signal
forced: false

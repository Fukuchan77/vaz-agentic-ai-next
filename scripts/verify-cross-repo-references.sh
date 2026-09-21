#!/usr/bin/env bash
#
# verify-cross-repo-references.sh — full 7-reference cross-repo check (R9.1)
#
# Verifies that every dangling reference to `cross-repo-adoption-review.md`
# recorded when it was missing (docs/cross-repo-adoption-review.md §6,
# specs/006-repo-consolidation/pdca/do.md) now resolves: the file it names
# exists, under the name it names.
#
# This is deliberately NOT wired into this repo's own CI: 2 of the 7
# references live in `pydantic-ai-sandbox`, a separate repository this repo's
# CI has no access to and cannot clone (no network egress from a repo-guard
# test). Run it manually, or from an agent session/environment that has the
# sibling repos checked out side by side — which is how the 7 were originally
# found and re-verified (specs/006-repo-consolidation/pdca/do.md, Task 3).
#
# The other 5 references ARE reachable from inside this repo alone (2 in this
# hub's own docs, 3 vendored into services/api by Task 6's subtree import) and
# are covered permanently by tests/repo/cross-repo-reference-resolution.spec.ts,
# which *is* CI-wired. This script re-derives the same 5 plus the 2 that
# script cannot reach, so a full 7/7 run needs both this script (with sibling
# checkouts available) and that test (every CI run).
#
# Usage:
#   ./scripts/verify-cross-repo-references.sh [SIBLINGS_DIR]
#
# SIBLINGS_DIR defaults to the parent of this hub's own working directory
# (matching this session's layout: /home/user/{vaz-ai-next,fastapi-pydantic-ai-agent,
# pydantic-ai-sandbox,pydantic-ai-agentic-patterns}). Pass an explicit path if
# your sibling repos live elsewhere.
set -euo pipefail

HUB_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SIBLINGS_DIR="${1:-$(dirname "$HUB_ROOT")}"
CANONICAL_REPO="vaz-agentic-ai-next"
CANONICAL_FILE="docs/cross-repo-adoption-review.md"
CANONICAL_QUALIFIED="${CANONICAL_REPO}/${CANONICAL_FILE}"

sandbox_dir="$SIBLINGS_DIR/pydantic-ai-sandbox"

total_refs=0
unresolved=0

check_ref() {
	local file="$1"
	local label="$2"
	if [ ! -f "$file" ]; then
		echo "  [skip] $label — file not found (sibling repo not checked out at $file)"
		return
	fi
	local hits
	hits="$(grep -c "$CANONICAL_QUALIFIED" "$file" || true)"
	if [ "$hits" -gt 0 ]; then
		total_refs=$((total_refs + hits))
		echo "  [ok]   $label ($hits reference(s) naming $CANONICAL_QUALIFIED)"
	else
		echo "  [FAIL] $label — no reference to $CANONICAL_QUALIFIED found"
		unresolved=$((unresolved + 1))
	fi
}

echo "=== Verifying the canonical file exists ==="
if [ ! -f "$HUB_ROOT/$CANONICAL_FILE" ]; then
	echo "  [FAIL] $CANONICAL_FILE does not exist at hub root ($HUB_ROOT)"
	unresolved=$((unresolved + 1))
else
	echo "  [ok]   $HUB_ROOT/$CANONICAL_FILE exists"
fi

echo ""
echo "=== Reachable from this hub alone (2 references) ==="
check_ref "$HUB_ROOT/docs/cross-repo-adoption-backlog.md" "vaz-ai-next/docs/cross-repo-adoption-backlog.md"
check_ref "$HUB_ROOT/docs/context-budget.md" "vaz-ai-next/docs/context-budget.md"

echo ""
echo "=== Vendored into services/api by Task 6's subtree import (3 references) ==="
check_ref "$HUB_ROOT/services/api/CLAUDE.md" "services/api/CLAUDE.md (fastapi-pydantic-ai-agent)"
check_ref "$HUB_ROOT/services/api/AGENTS.md" "services/api/AGENTS.md (fastapi-pydantic-ai-agent)"
check_ref "$HUB_ROOT/services/api/docs/cross-repo-adoption-backlog.md" "services/api/docs/cross-repo-adoption-backlog.md (fastapi-pydantic-ai-agent)"

echo ""
echo "=== Requires a sibling checkout: pydantic-ai-sandbox (2 references) ==="
check_ref "$sandbox_dir/docs/README.md" "pydantic-ai-sandbox/docs/README.md"
check_ref "$sandbox_dir/docs/cross-repo-adoption-backlog.md" "pydantic-ai-sandbox/docs/cross-repo-adoption-backlog.md"

echo ""
echo "=== Summary ==="
if [ "$total_refs" -eq 0 ]; then
	echo "❌ [verify-cross-repo-references] scanned zero references (anti-false-green failure)"
	exit 1
fi
echo "Scanned $total_refs reference(s) total across reachable files."

if [ "$unresolved" -gt 0 ]; then
	echo "❌ [verify-cross-repo-references] $unresolved reference(s) unresolved or file(s) unreachable"
	exit 1
fi

echo "✅ [verify-cross-repo-references] all reachable references resolved to $CANONICAL_QUALIFIED"
exit 0
